"""Records CRUD endpoint — faqat tasdiqlangan xodimlar uchun."""
from __future__ import annotations
import os, shutil, uuid
from datetime import datetime
from typing import List, Optional

from fastapi import (
    APIRouter, Depends, HTTPException, Query,
    UploadFile, File, Form, status,
)
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..database import get_db
from ..auth import get_current_user, require_admin
from ..models import User, UserRole, RecordType
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
