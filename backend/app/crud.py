"""CRUD helpers — barcha DB operatsiyalari shu yerda."""
from __future__ import annotations
from datetime import datetime
from typing import List, Optional

from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from .models import (
    Department, User, UserRole, RegistrationStatus,
    Record, RecordType, RecordStatus, AttachedFile, RegistrationRequest,
)
from .schemas import RegisterRequest, RecordCreate, RecordUpdate


# ── Departments ───────────────────────────────────────────────────────────────
async def get_all_departments(db: AsyncSession) -> List[Department]:
    result = await db.execute(
        select(Department)
        .where(Department.is_active == True)
        .order_by(Department.sort_order)
    )
    return result.scalars().all()


async def get_department(db: AsyncSession, dept_id: int) -> Optional[Department]:
    result = await db.execute(select(Department).where(Department.id == dept_id))
    return result.scalars().first()


# ── Users ─────────────────────────────────────────────────────────────────────
async def get_user_by_tg(db: AsyncSession, telegram_id: int) -> Optional[User]:
    result = await db.execute(select(User).where(User.telegram_id == telegram_id))
    return result.scalars().first()


async def create_user_from_tg(
    db: AsyncSession,
    telegram_id: int,
    username: Optional[str],
    reg: RegisterRequest,
) -> User:
    user = User(
        telegram_id=telegram_id,
        username=username,
        full_name=reg.full_name,
        position=reg.position,
        phone=reg.phone,
        department_id=reg.department_id,
        reg_status=RegistrationStatus.pending,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def create_registration_request(
    db: AsyncSession,
    telegram_id: int,
    username: Optional[str],
    reg: RegisterRequest,
) -> RegistrationRequest:
    rr = RegistrationRequest(
        telegram_id=telegram_id,
        username=username,
        full_name=reg.full_name,
        position=reg.position,
        phone=reg.phone,
        department_id=reg.department_id,
    )
    db.add(rr)
    await db.commit()
    await db.refresh(rr)
    return rr


async def approve_registration(
    db: AsyncSession,
    request_id: int,
    approve: bool,
    rejection_reason: Optional[str],
    admin_tg_id: int,
) -> Optional[RegistrationRequest]:
    result = await db.execute(
        select(RegistrationRequest).where(RegistrationRequest.id == request_id)
    )
    rr = result.scalars().first()
    if not rr:
        return None

    new_status = RegistrationStatus.approved if approve else RegistrationStatus.rejected
    rr.status = new_status
    rr.reviewed_at = datetime.utcnow()
    rr.reviewed_by = admin_tg_id
    if rejection_reason:
        rr.rejection_reason = rejection_reason

    # Sync with User record
    user_res = await db.execute(
        select(User).where(User.telegram_id == rr.telegram_id)
    )
    user = user_res.scalars().first()
    if user:
        user.reg_status = new_status
        if approve:
            user.approved_at = datetime.utcnow()
            user.department_id = rr.department_id
        if rejection_reason:
            user.rejection_reason = rejection_reason

    await db.commit()
    return rr


async def get_pending_requests(db: AsyncSession) -> List[RegistrationRequest]:
    result = await db.execute(
        select(RegistrationRequest)
        .where(RegistrationRequest.status == RegistrationStatus.pending)
        .order_by(RegistrationRequest.created_at)
    )
    return result.scalars().all()


async def get_all_users(db: AsyncSession) -> List[User]:
    result = await db.execute(
        select(User).options(selectinload(User.department)).order_by(User.created_at.desc())
    )
    return result.scalars().all()


async def set_user_blocked(db: AsyncSession, user_id: int, blocked: bool) -> None:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if user:
        user.is_blocked = blocked
        await db.commit()


async def transfer_user_dept(db: AsyncSession, user_id: int, dept_id: int) -> None:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if user:
        user.department_id = dept_id
        await db.commit()


# ── Records ───────────────────────────────────────────────────────────────────
async def create_record(
    db: AsyncSession,
    data: RecordCreate,
    author_id: Optional[int] = None,
    source_department_id: Optional[int] = None,
) -> Record:
    rec = Record(
        title=data.title,
        body=data.body,
        record_type=data.record_type,
        department_id=data.department_id,
        source_department_id=source_department_id,
        author_id=author_id,
        broadcast_to=data.broadcast_to,
        record_date=data.record_date or datetime.utcnow(),
    )
    db.add(rec)
    await db.commit()
    await db.refresh(rec)
    return rec


async def get_records(
    db: AsyncSession,
    department_id: Optional[int] = None,
    record_type: Optional[RecordType] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    keyword: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    involving: bool = False,
    viewer_unit: Optional[int] = None,
    source_id: Optional[int] = None,
) -> List[Record]:
    """
    involving=True  — bo'limga yuborilgan YOKI shu bo'lim yuborgan yozuvlar.
    viewer_unit     — faqat shu bo'linma yuborganlari va bo'limning umumiy (manbasiz) yozuvlari.
    """
    q = (
        select(Record)
        .options(
            selectinload(Record.files), selectinload(Record.author),
            selectinload(Record.department), selectinload(Record.source_department),
        )
        .where(Record.is_deleted == False)
    )
    if department_id and involving:
        q = q.where(or_(Record.department_id == department_id, Record.source_department_id == department_id))
    elif department_id:
        q = q.where(Record.department_id == department_id)
    if viewer_unit:
        q = q.where(or_(Record.source_department_id == viewer_unit, Record.source_department_id.is_(None)))
    if source_id:
        q = q.where(Record.source_department_id == source_id)
    if record_type:
        q = q.where(Record.record_type == record_type)
    if date_from:
        q = q.where(Record.record_date >= date_from)
    if date_to:
        q = q.where(Record.record_date <= date_to)
    if keyword:
        q = q.where(
            or_(
                Record.title.ilike(f"%{keyword}%"),
                Record.body.ilike(f"%{keyword}%"),
            )
        )
    q = q.order_by(Record.record_date.desc()).limit(limit).offset(offset)
    result = await db.execute(q)
    return result.scalars().all()


async def get_record(db: AsyncSession, record_id: int) -> Optional[Record]:
    result = await db.execute(
        select(Record)
        .options(
            selectinload(Record.files), selectinload(Record.author),
            selectinload(Record.department), selectinload(Record.source_department),
        )
        .where(Record.id == record_id, Record.is_deleted == False)
    )
    return result.scalars().first()


async def update_record(
    db: AsyncSession, record_id: int, data: RecordUpdate
) -> Optional[Record]:
    rec = await get_record(db, record_id)
    if not rec:
        return None
    if data.title is not None:
        rec.title = data.title
    if data.body is not None:
        rec.body = data.body
    if data.record_type is not None:
        rec.record_type = data.record_type
    await db.commit()
    await db.refresh(rec)
    return rec


async def soft_delete_record(db: AsyncSession, record_id: int) -> bool:
    rec = await get_record(db, record_id)
    if not rec:
        return False
    rec.is_deleted = True
    await db.commit()
    return True


async def mark_record_seen(db: AsyncSession, record_id: int) -> None:
    rec = await get_record(db, record_id)
    if rec:
        rec.status = RecordStatus.seen_by_admin
        await db.commit()


# ── Attached files ────────────────────────────────────────────────────────────
async def add_file(
    db: AsyncSession,
    record_id: int,
    original_name: str,
    mime_type: str,
    file_size: int,
    local_path: Optional[str] = None,
    tg_file_id: Optional[str] = None,
) -> AttachedFile:
    f = AttachedFile(
        record_id=record_id,
        original_name=original_name,
        mime_type=mime_type,
        file_size=file_size,
        local_path=local_path,
        tg_file_id=tg_file_id,
    )
    db.add(f)
    if local_path:
        from .storage import save_blob
        await save_blob(db, local_path)
    await db.commit()
    await db.refresh(f)
    return f


# ── Svodka / Monitoring ───────────────────────────────────────────────────────
async def get_svodka(
    db: AsyncSession,
    date_from: datetime,
    date_to: datetime,
    parent_code: str = "PC",   # "PC", "PMS", or "HEAD"
) -> dict:
    """
    Tanlangan sana oralig'ida qaysi bo'linmalar yozuv tashlagan / tashlamamagan.
    """
    if parent_code == "HEAD":
        children_res = await db.execute(
            select(Department)
            .where(
                Department.parent_id.is_(None),
                Department.code.notin_(["PC", "PMS"]),
                Department.read_only_broadcast == False,
                Department.is_active == True,
            )
            .order_by(Department.sort_order, Department.id)
        )
        children = children_res.scalars().all()
    else:
        parent_res = await db.execute(
            select(Department).where(Department.code == parent_code)
        )
        parent = parent_res.scalars().first()
        if not parent:
            return {"rows": [], "total": 0, "submitted": 0, "pending": 0}

        children_res = await db.execute(
            select(Department)
            .where(Department.parent_id == parent.id, Department.is_active == True)
            .order_by(Department.sort_order, Department.id)
        )
        children = children_res.scalars().all()

    rows = []
    submitted = 0
    for child in children:
        dept_filter = (
            or_(Record.department_id == child.id, Record.source_department_id == child.id)
            if parent_code == "HEAD"
            else (Record.department_id == child.id)
        )
        count_res = await db.execute(
            select(func.count(Record.id)).where(
                dept_filter,
                Record.is_deleted == False,
                Record.record_date >= date_from,
                Record.record_date <= date_to,
            )
        )
        count = count_res.scalar() or 0

        last_res = await db.execute(
            select(func.max(Record.record_date)).where(
                dept_filter,
                Record.is_deleted == False,
            )
        )
        last_at = last_res.scalar()

        has_submitted = count > 0
        if has_submitted:
            submitted += 1

        rows.append({
            "department_id": child.id,
            "department_name": child.name,
            "has_submitted": has_submitted,
            "record_count": count,
            "last_at": last_at,
        })

    return {
        "rows": rows,
        "total": len(rows),
        "submitted": submitted,
        "pending": len(rows) - submitted,
    }
