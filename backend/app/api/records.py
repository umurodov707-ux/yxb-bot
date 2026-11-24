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

    out = RecordOut.model_validate(rec)
    out.department_name = dept_name
    out.author_name = author_name
    out.files = [FileOut.model_validate(f) for f in (rec.files or [])]
    return out


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
    # Oddiy xodim faqat o'z bo'limini ko'radi
    if user.role != UserRole.admin:
        department_id = user.department_id

    recs = await get_records(
        db, department_id, record_type, date_from, date_to, keyword, limit, offset
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
    # Oddiy xodim faqat o'z bo'limiga yoza oladi
    if user.role != UserRole.admin:
        department_id = user.department_id

    if not department_id:
        raise HTTPException(status_code=400, detail="Bo'lim ko'rsatilmagan.")

    data = RecordCreate(
        title=title, body=body, record_type=record_type,
        department_id=department_id, record_date=record_date,
    )
    rec = await create_record(db, data, author_id=user.id)

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
    _admin: User = Depends(require_admin),
):
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    admin_ids = select(User.id).where(User.role == UserRole.admin)

    agg = await db.execute(
        select(
            Record.department_id,
            func.count(Record.id),
            func.sum(case((Record.created_at >= today, 1), else_=0)),
            func.sum(case(
                (and_(Record.status == RecordStatus.sent,
                      or_(Record.author_id.is_(None), Record.author_id.not_in(admin_ids))), 1),
                else_=0,
            )),
            func.max(Record.id),
        )
        .where(Record.is_deleted == False)
        .group_by(Record.department_id)
    )
    stats = {row[0]: row[1:] for row in agg.all()}

    last_ids = [s[3] for s in stats.values() if s[3]]
    last_map = {}
    if last_ids:
        res = await db.execute(
            select(Record).options(selectinload(Record.author), selectinload(Record.files))
            .where(Record.id.in_(last_ids))
        )
        last_map = {r.department_id: r for r in res.scalars().all()}

    depts = (await db.execute(select(Department).order_by(Department.sort_order, Department.id))).scalars().all()
    out = []
    for d in depts:
        total, today_cnt, unread, _ = stats.get(d.id, (0, 0, 0, None))
        last = last_map.get(d.id)
        out.append({
            "department_id": d.id,
            "name": d.name,
            "code": d.code,
            "parent_id": d.parent_id,
            "total": total or 0,
            "today": int(today_cnt or 0),
            "unread": int(unread or 0),
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
        .where(Record.department_id == department_id, Record.status == RecordStatus.sent)
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
