"""Records CRUD endpoint — faqat tasdiqlangan xodimlar uchun."""
from __future__ import annotations
import os, shutil, uuid
from datetime import datetime
from typing import List, Optional

from fastapi import (
    APIRouter, Body, Depends, HTTPException, Query,
    UploadFile, File, Form, status,
)
from sqlalchemy import and_, case, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..config import settings
from ..database import get_db
from ..auth import get_current_user, require_admin
from ..models import User, UserRole, RecordType, Record, RecordStatus, Department
from ..crud import (
    create_record, get_records, get_record,
    update_record, soft_delete_record, add_file, mark_record_seen,
)
from ..schemas import RecordCreate, RecordOut, RecordUpdate, MsgResponse, FileOut

router = APIRouter(prefix="/records", tags=["Records"])

UPLOAD_DIR = settings.UPLOAD_DIR
os.makedirs(UPLOAD_DIR, exist_ok=True)


def _record_to_out(rec) -> RecordOut:
    dept_name = None
    try:
        if rec.department:
            dept_name = rec.department.name
    except Exception:
        pass

    author_name = None
    try:
        if rec.author:
            author_name = rec.author.full_name
    except Exception:
        pass

    src_name = None
    try:
        if rec.source_department:
            src_name = rec.source_department.name
    except Exception:
        pass

    out = RecordOut.model_validate(rec)
    out.department_name = dept_name
    out.source_department_name = src_name
    out.author_name = author_name
    out.files = [FileOut.model_validate(f) for f in (rec.files or [])]
    return out


GROUP_CODES = {"PC", "PMS"}


def is_send_target(dept: Department | None) -> bool:
    """Bo'linma xodimi yubora oladigan bosh bo'lim (Фойдаланиш, Капитал, ... Бошкалар)."""
    return bool(dept and dept.parent_id is None and dept.code not in GROUP_CODES and not dept.read_only_broadcast)


# ── GET /records ──────────────────────────────────────────────────────────────
@router.get("", response_model=List[RecordOut])
async def list_records(
    department_id: Optional[int] = Query(None),
    record_type: Optional[RecordType] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    keyword: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    involving, viewer_unit = True, None
    if user.role != UserRole.admin:
        own = user.department_id
        dept = await db.get(Department, department_id) if department_id else None
        if dept and dept.read_only_broadcast:
            involving = False                      # e'lonlar — hammaga
        elif dept and dept.id != own and is_send_target(dept):
            involving, viewer_unit = False, own    # faqat o'z bo'linmasi yuborganlari + bo'lim e'lonlari
        else:
            department_id = own                    # o'z bo'linmasi: kelgan va yuborgan hammasi

    recs = await get_records(
        db, department_id, record_type, date_from, date_to, keyword, limit, offset,
        involving=involving, viewer_unit=viewer_unit,
    )
    return [_record_to_out(r) for r in recs]


# ── POST /records ─────────────────────────────────────────────────────────────
@router.post("", response_model=RecordOut, status_code=201)
async def create_new_record(
    title: str = Form(...),
    body: Optional[str] = Form(None),
    record_type: RecordType = Form(RecordType.message),
    department_id: Optional[int] = Form(None),
    record_date: Optional[datetime] = Form(None),
    files: List[UploadFile] = File(default=[]),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    source_id = None
    if user.role != UserRole.admin:
        source_id = user.department_id
        target = await db.get(Department, department_id) if department_id else None
        if not (target and target.id != user.department_id and is_send_target(target)):
            department_id = user.department_id

    if not department_id:
        raise HTTPException(status_code=400, detail="Bo'lim ko'rsatilmagan.")

    data = RecordCreate(
        title=title, body=body, record_type=record_type,
        department_id=department_id, record_date=record_date,
    )
    rec = await create_record(db, data, author_id=user.id, source_department_id=source_id)

    # save files
    max_bytes = settings.MAX_UPLOAD_MB * 1024 * 1024
    for upload in files:
        content = await upload.read()
        if len(content) > max_bytes:
            raise HTTPException(status_code=413, detail=f"{upload.filename} hajmi katta.")
        ext = os.path.splitext(upload.filename or "")[-1]
        fname = f"{uuid.uuid4().hex}{ext}"
        fpath = os.path.join(UPLOAD_DIR, fname)
        with open(fpath, "wb") as fh:
            fh.write(content)
        await add_file(
            db, rec.id,
            original_name=upload.filename or fname,
            mime_type=upload.content_type or "application/octet-stream",
            file_size=len(content),
            local_path=fpath,
        )

    # reload with files
    rec = await get_record(db, rec.id)
    return _record_to_out(rec)


# ── GET /records/summary (admin) — bo'limlar ro'yxati, chatlar kabi ───────────
@router.get("/summary")
async def departments_summary(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    is_admin = user.role == UserRole.admin
    own = user.department_id
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    admin_ids = set((await db.execute(select(User.id).where(User.role == UserRole.admin))).scalars().all())

    rows = (await db.execute(
        select(Record.id, Record.department_id, Record.source_department_id,
               Record.created_at, Record.status, Record.author_id)
        .where(Record.is_deleted == False)
    )).all()

    depts = (await db.execute(select(Department).order_by(Department.sort_order, Department.id))).scalars().all()
    if not is_admin:
        depts = [d for d in depts if d.id == own or d.read_only_broadcast or is_send_target(d)]

    def visible(d: Department, r) -> bool:
        if is_admin or d.id == own:
            return r.department_id == d.id or r.source_department_id == d.id
        if d.read_only_broadcast:
            return r.department_id == d.id
        return r.department_id == d.id and r.source_department_id in (own, None)

    def is_today(ts) -> bool:
        return ts is not None and ts.replace(tzinfo=None) >= today

    stats = {}
    for d in depts:
        mine = [r for r in rows if visible(d, r)]
        last = max(mine, key=lambda r: r.id, default=None)
        stats[d.id] = (
            len(mine),
            sum(1 for r in mine if is_today(r.created_at)),
            sum(1 for r in mine if r.status == RecordStatus.sent and r.author_id not in admin_ids) if is_admin else 0,
            last.id if last else None,
        )

    last_ids = {s_[3] for s_ in stats.values() if s_[3]}
    last_map = {}
    if last_ids:
        res = await db.execute(
            select(Record).options(selectinload(Record.author), selectinload(Record.files))
            .where(Record.id.in_(last_ids))
        )
        last_map = {r.id: r for r in res.scalars().all()}

    out = []
    for d in depts:
        total, today_cnt, unread, last_id = stats[d.id]
        last = last_map.get(last_id)
        out.append({
            "department_id": d.id,
            "name": d.name,
            "code": d.code,
            "parent_id": d.parent_id,
            "sort_order": d.sort_order,
            "read_only": bool(d.read_only_broadcast),
            "total": total,
            "today": today_cnt,
            "unread": unread,
            "last_title": last.title if last else None,
            "last_author": last.author.full_name if last and last.author else None,
            "last_type": last.record_type.value if last else None,
            "last_has_files": bool(last and last.files),
            "last_at": last.created_at.isoformat() if last and last.created_at else None,
        })
    return out


# ── POST /records/seen (admin) — bo'limdagi xabarlarni ko'rildi deb belgilash ──
@router.post("/seen", response_model=MsgResponse)
async def mark_department_seen(
    department_id: int = Body(..., embed=True),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    await db.execute(
        update(Record)
        .where(
            or_(Record.department_id == department_id, Record.source_department_id == department_id),
            Record.status == RecordStatus.sent,
        )
        .values(status=RecordStatus.seen_by_admin)
    )
    await db.commit()
    return MsgResponse(msg="OK")


# ── GET /records/:id ──────────────────────────────────────────────────────────
@router.get("/{record_id}", response_model=RecordOut)
async def get_one_record(
    record_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rec = await get_record(db, record_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Topilmadi.")
    # access check
    if user.role != UserRole.admin and rec.department_id != user.department_id:
        raise HTTPException(status_code=403, detail="Ruxsat yo'q.")
    if user.role == UserRole.admin:
        await mark_record_seen(db, record_id)
    return _record_to_out(rec)


# ── PATCH /records/:id ────────────────────────────────────────────────────────
@router.patch("/{record_id}", response_model=RecordOut)
async def patch_record(
    record_id: int,
    data: RecordUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_admin),
):
    rec = await update_record(db, record_id, data)
    if not rec:
        raise HTTPException(status_code=404, detail="Topilmadi.")
    return _record_to_out(rec)


# ── DELETE /records/:id ───────────────────────────────────────────────────────
@router.delete("/{record_id}", response_model=MsgResponse)
async def delete_record(
    record_id: int,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    deleted = await soft_delete_record(db, record_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Topilmadi.")
    return MsgResponse(msg="O'chirildi.")


# ── POST /records/broadcast (admin only) ─────────────────────────────────────
@router.post("/broadcast", response_model=List[RecordOut], status_code=201)
async def broadcast_record(
    title: str = Form(...),
    body: Optional[str] = Form(None),
    record_type: RecordType = Form(RecordType.broadcast),
    department_ids: str = Form(...),   # comma-separated
    record_date: Optional[datetime] = Form(None),
    files: List[UploadFile] = File(default=[]),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_admin),
):
    """
    Admin bitta xabarni bir nechta bo'limlarga yuboradi.
    Har bir bo'lim uchun alohida Record yaratiladi.
    """
    dept_ids = [int(x.strip()) for x in department_ids.split(",") if x.strip()]
    if not dept_ids:
        raise HTTPException(status_code=400, detail="Bo'limlar ko'rsatilmagan.")

    all_depts = dept_ids  # will be stored as broadcast_to

    max_bytes = settings.MAX_UPLOAD_MB * 1024 * 1024
    saved_files = []
    for upload in files:
        content = await upload.read()
        if len(content) > max_bytes:
            raise HTTPException(status_code=413, detail=f"{upload.filename} hajmi katta.")
        ext = os.path.splitext(upload.filename or "")[-1]
        fname = f"{uuid.uuid4().hex}{ext}"
        fpath = os.path.join(UPLOAD_DIR, fname)
        with open(fpath, "wb") as fh:
            fh.write(content)
        saved_files.append((upload.filename or fname, upload.content_type or "application/octet-stream", len(content), fpath))

    results = []
    for dept_id in dept_ids:
        data = RecordCreate(
            title=title, body=body, record_type=record_type,
            department_id=dept_id, record_date=record_date,
            broadcast_to=all_depts,
        )
        rec = await create_record(db, data, author_id=user.id)
        for orig_name, mime, size, path in saved_files:
            await add_file(db, rec.id, orig_name, mime, size, local_path=path)
        rec = await get_record(db, rec.id)
        results.append(_record_to_out(rec))

    return results
