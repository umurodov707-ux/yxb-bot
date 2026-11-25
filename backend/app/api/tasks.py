"""Telegramma / prikaz ijrosi: admin bo'linmalarga topshiradi, bo'linmalar bajaradi, admin qabul qiladi."""
from __future__ import annotations
import logging, os, uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Body, Depends, File, Form, HTTPException, Request, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..auth import get_current_user, require_admin
from ..config import settings
from ..crud import add_file, create_record, get_record
from ..database import get_db
from ..models import (
    Assignment, AssignmentStatus as AS, Department, Record, RecordType,
    RegistrationStatus, User, UserRole,
)
from ..schemas import MsgResponse, RecordCreate
from .records import _notify_unit, _record_to_out, is_unit

router = APIRouter(prefix="/tasks", tags=["Telegramma ijrosi"])
log = logging.getLogger(__name__)


def _utc_naive(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def _iso(dt: Optional[datetime]) -> Optional[str]:
    return _utc_naive(dt).isoformat() if dt else None


def _overdue(rec: Record, a: Assignment) -> bool:
    dl = _utc_naive(rec.deadline)
    return bool(dl and a.status in (AS.pending.value, AS.returned.value) and datetime.utcnow() > dl)


async def _save_uploads(db: AsyncSession, rec_id: int, files: List[UploadFile]) -> None:
    max_bytes = settings.MAX_UPLOAD_MB * 1024 * 1024
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    for upload in files:
        content = await upload.read()
        if not content:
            continue
        if len(content) > max_bytes:
            raise HTTPException(status_code=413, detail=f"{upload.filename} hajmi katta.")
        ext = os.path.splitext(upload.filename or "")[-1]
        path = os.path.join(settings.UPLOAD_DIR, f"{uuid.uuid4().hex}{ext}")
        with open(path, "wb") as fh:
            fh.write(content)
        await add_file(db, rec_id, original_name=upload.filename or os.path.basename(path),
                       mime_type=upload.content_type or "application/octet-stream",
                       file_size=len(content), local_path=path)


async def _notify_admins(request: Request, text: str) -> None:
    bot = getattr(request.app.state, "bot", None)
    if not bot:
        return
    from ..bot.keyboards import main_menu_kb
    for admin_id in settings.admin_ids_list:
        try:
            await bot.send_message(admin_id, text, reply_markup=main_menu_kb(settings.WEBAPP_URL))
        except Exception:
            log.warning("Adminga xabar yuborilmadi: %s", admin_id)


def _deadline_text(rec: Record) -> str:
    dl = _utc_naive(rec.deadline)
    if not dl:
        return ""
    # Toshkent vaqti (UTC+5)
    from datetime import timedelta
    return (dl + timedelta(hours=5)).strftime("%d.%m.%Y %H:%M")


def _assignment_out(rec: Record, a: Assignment) -> dict:
    return {
        "unit_id": a.unit_id,
        "unit_name": a.unit.name if a.unit else None,
        "unit_code": a.unit.code if a.unit else None,
        "status": a.status,
        "overdue": _overdue(rec, a),
        "report_text": a.report_text,
        "report": _record_to_out(a.report_record) if a.report_record else None,
        "submitted_by": a.submitter.full_name if a.submitter else None,
        "submitted_at": _iso(a.submitted_at),
        "review_note": a.review_note,
        "reviewed_at": _iso(a.reviewed_at),
    }


def _counts(rec: Record) -> dict:
    c = {"total": len(rec.assignments), "accepted": 0, "submitted": 0, "returned": 0, "pending": 0, "overdue": 0}
    for a in rec.assignments:
        c[a.status] = c.get(a.status, 0) + 1
        if _overdue(rec, a):
            c["overdue"] += 1
    return c


async def _load_task(db: AsyncSession, task_id: int) -> Record:
    res = await db.execute(
        select(Record)
        .options(
            selectinload(Record.files), selectinload(Record.author),
            selectinload(Record.department), selectinload(Record.source_department),
            selectinload(Record.assignments).selectinload(Assignment.unit),
            selectinload(Record.assignments).selectinload(Assignment.submitter),
            selectinload(Record.assignments).selectinload(Assignment.report_record).selectinload(Record.files),
            selectinload(Record.assignments).selectinload(Assignment.report_record).selectinload(Record.author),
            selectinload(Record.assignments).selectinload(Assignment.report_record).selectinload(Record.department),
            selectinload(Record.assignments).selectinload(Assignment.report_record).selectinload(Record.source_department),
        )
        .where(Record.id == task_id, Record.is_deleted == False)
    )
    rec = res.scalars().first()
    if not rec or not rec.assignments:
        raise HTTPException(status_code=404, detail="Topshiriq topilmadi.")
    return rec


# ── Bo'linmalar ro'yxati (ijrochi tanlash uchun) ─────────────────────────────
@router.get("/units")
async def assignable_units(db: AsyncSession = Depends(get_db), _admin: User = Depends(require_admin)):
    depts = (await db.execute(select(Department).order_by(Department.sort_order, Department.id))).scalars().all()
    parents = {d.id: d.code for d in depts}
    return [
        {"id": d.id, "name": d.name, "group": parents.get(d.parent_id or 0) or d.code}
        for d in depts if is_unit(d, parents)
    ]


# ── POST /tasks — admin telegramma joylaydi va ijrochilarni belgilaydi ───────
@router.post("", status_code=201)
async def create_task(
    request: Request,
    title: str = Form(...),
    body: Optional[str] = Form(None),
    unit_ids: str = Form(...),                     # vergul bilan: "13,14,32"
    deadline: Optional[datetime] = Form(None),
    files: List[UploadFile] = File(default=[]),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    ids = sorted({int(x) for x in unit_ids.split(",") if x.strip().isdigit()})
    if not ids:
        raise HTTPException(status_code=400, detail="Kamida bitta ijrochi bo'linmani tanlang.")
    tg_dept = (await db.execute(select(Department).where(Department.code == "TELEGRAMMA"))).scalars().first()
    if not tg_dept:
        raise HTTPException(status_code=500, detail="'Телеграмма, приказ' bo'limi topilmadi.")
    units = (await db.execute(select(Department).where(Department.id.in_(ids)))).scalars().all()
    if len(units) != len(ids):
        raise HTTPException(status_code=400, detail="Noto'g'ri bo'linma tanlangan.")

    rec = await create_record(db, RecordCreate(title=title, body=body, record_type=RecordType.broadcast,
                                               department_id=tg_dept.id), author_id=admin.id)
    rec_db = await db.get(Record, rec.id)
    rec_db.deadline = _utc_naive(deadline)
    rec_db.broadcast_to = ids
    for uid in ids:
        db.add(Assignment(record_id=rec.id, unit_id=uid, status=AS.pending.value))
    await db.commit()
    await _save_uploads(db, rec.id, files)

    task = await _load_task(db, rec.id)
    dl = _deadline_text(task)
    text = f"📜 <b>Yangi telegramma — ijro uchun</b>\n\n<b>{title}</b>"
    if body:
        text += f"\n{body[:600]}"
    if dl:
        text += f"\n\n⏰ Ijro muddati: <b>{dl}</b>"
    text += "\n\nMini App → «Ijro uchun» bo'limida «Bajarildi» deb belgilang."
    for uid in ids:
        await _notify_unit(request, db, uid, text)
    return {"id": rec.id, **_counts(task)}


# ── GET /tasks — admin: hammasi; bo'linma xodimi: o'ziga topshirilganlar ─────
@router.get("")
async def list_tasks(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    if user.role != UserRole.admin and not user.department_id:
        return []
    q = (
        select(Record)
        .options(selectinload(Record.assignments), selectinload(Record.files))
        .where(Record.is_deleted == False, Record.assignments.any())
        .order_by(Record.id.desc())
        .limit(200)
    )
    if user.role != UserRole.admin:
        q = q.where(Record.assignments.any(Assignment.unit_id == user.department_id))
    recs = (await db.execute(q)).scalars().all()
    out = []
    for r in recs:
        item = {
            "id": r.id, "title": r.title, "body": r.body,
            "created_at": _iso(r.created_at), "deadline": _iso(r.deadline),
            "has_files": bool(r.files),
        }
        if user.role == UserRole.admin:
            item.update(_counts(r))
        else:
            mine = next(a for a in r.assignments if a.unit_id == user.department_id)
            item.update({"status": mine.status, "overdue": _overdue(r, mine), "review_note": mine.review_note})
        out.append(item)
    return out


# ── GET /tasks/{id} ───────────────────────────────────────────────────────────
@router.get("/{task_id}")
async def get_task(task_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    rec = await _load_task(db, task_id)
    base = {"task": _record_to_out(rec), "deadline": _iso(rec.deadline)}
    if user.role == UserRole.admin:
        rows = sorted(rec.assignments, key=lambda a: (a.unit.sort_order if a.unit else 0, a.unit_id))
        return {**base, "counts": _counts(rec), "assignments": [_assignment_out(rec, a) for a in rows]}
    mine = next((a for a in rec.assignments if a.unit_id == user.department_id), None)
    if not mine:
        raise HTTPException(status_code=403, detail="Bu topshiriq sizning bo'linmangizga tegishli emas.")
    return {**base, "mine": _assignment_out(rec, mine)}


# ── POST /tasks/{id}/submit — bo'linma: "Bajarildi" ───────────────────────────
@router.post("/{task_id}/submit", response_model=MsgResponse)
async def submit_task(
    task_id: int,
    request: Request,
    report_text: str = Form(...),
    files: List[UploadFile] = File(default=[]),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not report_text.strip():
        raise HTTPException(status_code=400, detail="Nima bajarilganini qisqacha yozing.")
    if not user.department_id:
        raise HTTPException(status_code=400, detail="Sizga bo'linma biriktirilmagan.")
    rec = await _load_task(db, task_id)
    a = next((x for x in rec.assignments if x.unit_id == user.department_id), None)
    if not a:
        raise HTTPException(status_code=403, detail="Bu topshiriq sizning bo'linmangizga tegishli emas.")
    if a.status == AS.accepted.value:
        raise HTTPException(status_code=400, detail="Bu topshiriq allaqachon qabul qilingan.")

    report = await create_record(
        db,
        RecordCreate(title=f"Ijro: {rec.title}"[:255], body=report_text.strip(),
                     record_type=RecordType.spravka, department_id=user.department_id),
        author_id=user.id, source_department_id=user.department_id,
    )
    await _save_uploads(db, report.id, files)

    a = await db.get(Assignment, a.id)
    a.status = AS.submitted.value
    a.report_text = report_text.strip()
    a.report_record_id = report.id
    a.submitted_by = user.id
    a.submitted_at = datetime.utcnow()
    a.review_note = None
    await db.commit()

    unit = await db.get(Department, user.department_id)
    unit_name = unit.name if unit else ""
    await _notify_admins(request, f"✅ <b>{unit_name}</b> telegrammani bajardi — tekshiring:\n\n"
                                  f"📜 {rec.title}\n📝 {report_text.strip()[:400]}")
    return MsgResponse(msg="Yuborildi. Admin tekshiradi.")


# ── POST /tasks/{id}/review — admin: qabul / qaytarish ────────────────────────
@router.post("/{task_id}/review", response_model=MsgResponse)
async def review_task(
    task_id: int,
    request: Request,
    unit_id: int = Body(...),
    accept: bool = Body(...),
    note: Optional[str] = Body(None),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    rec = await _load_task(db, task_id)
    a = next((x for x in rec.assignments if x.unit_id == unit_id), None)
    if not a:
        raise HTTPException(status_code=404, detail="Ijrochi topilmadi.")
    if not accept and not (note or "").strip():
        raise HTTPException(status_code=400, detail="Qaytarish sababini yozing.")
    a = await db.get(Assignment, a.id)
    a.status = AS.accepted.value if accept else AS.returned.value
    a.review_note = (note or "").strip() or None
    a.reviewed_at = datetime.utcnow()
    await db.commit()

    if accept:
        text = f"✅ <b>Ijro qabul qilindi</b>\n\n📜 {rec.title}"
    else:
        text = f"↩ <b>Ijro qaytarildi — qayta bajaring</b>\n\n📜 {rec.title}\n💬 {a.review_note}"
    await _notify_unit(request, db, unit_id, text)
    return MsgResponse(msg="Qabul qilindi." if accept else "Qaytarildi.")


# ── POST /tasks/{id}/remind — admin: bajarmaganlarga eslatma ──────────────────
@router.post("/{task_id}/remind", response_model=MsgResponse)
async def remind_task(task_id: int, request: Request, db: AsyncSession = Depends(get_db),
                      _admin: User = Depends(require_admin)):
    rec = await _load_task(db, task_id)
    targets = [a.unit_id for a in rec.assignments if a.status in (AS.pending.value, AS.returned.value)]
    dl = _deadline_text(rec)
    text = f"⏰ <b>Eslatma: telegramma ijrosi</b>\n\n📜 {rec.title}" + (f"\nMuddat: <b>{dl}</b>" if dl else "")
    sent = 0
    for uid in targets:
        sent += await _notify_unit(request, db, uid, text)
    return MsgResponse(msg=f"{len(targets)} ta bo'linmaga ({sent} xodim) eslatma yuborildi.")
