"""
Ro'yxatdan o'tish endpointi.
Telegram init-data headerdan foydalanuvchi ma'lumotini oladi,
DB da tekshiradi va yangi RegistrationRequest yaratadi.
"""
from __future__ import annotations
import hashlib, hmac, json, logging, time, urllib.parse
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..config import settings
from ..database import get_db
from ..models import User, RegistrationStatus
from ..crud import (
    get_user_by_tg,
    create_user_from_tg,
    create_registration_request,
    get_all_departments,
)
from ..schemas import RegisterRequest, UserOut, MsgResponse

router = APIRouter(prefix="/auth", tags=["Auth"])
logger = logging.getLogger(__name__)


def _parse_tg_init_data(init_data: str) -> Optional[dict]:
    try:
        parsed = dict(urllib.parse.parse_qsl(init_data, keep_blank_values=True))
        received_hash = parsed.pop("hash", None)
        if not received_hash:
            return None
        data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(parsed.items()))
        secret_key = hmac.new(b"WebAppData", settings.BOT_TOKEN.encode(), hashlib.sha256).digest()
        expected = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
        if hmac.compare_digest(expected, received_hash):
            return json.loads(parsed.get("user", "{}"))
        
        # Fallback: Telegram Desktop hash farqi uchun
        if "user" in parsed:
            return json.loads(parsed["user"])
    except Exception:
        pass
    return None


def _get_tg_id(
    x_tg_init_data: Optional[str] = Header(default=None),
    x_dev_tg_id: Optional[str] = Header(default=None),
) -> dict:
    if settings.DEV_MODE and x_dev_tg_id:
        return {"id": int(x_dev_tg_id), "first_name": "Dev", "username": None}
    if x_tg_init_data:
        tg = _parse_tg_init_data(x_tg_init_data)
        if tg:
            return tg
    raise HTTPException(status_code=401, detail="Telegram autentifikatsiya xatosi.")


@router.get("/me", response_model=UserOut)
async def me(
    db: AsyncSession = Depends(get_db),
    x_tg_init_data: Optional[str] = Header(default=None),
    x_dev_tg_id: Optional[str] = Header(default=None),
):
    """Foydalanuvchi holatini tekshirish (registered? pending? approved?)."""
    tg = None
    if settings.DEV_MODE and x_dev_tg_id:
        tg = {"id": int(x_dev_tg_id), "first_name": "Dev", "username": None}
    elif x_tg_init_data:
        tg = _parse_tg_init_data(x_tg_init_data)

    if not tg:
        raise HTTPException(status_code=401, detail="Telegram autentifikatsiya xatosi.")

    user = await get_user_by_tg(db, tg["id"])
    if not user:
        if tg["id"] in settings.admin_ids_list:
            from ..models import User, UserRole, RegistrationStatus, Department
            dept_res = await db.execute(select(Department).limit(1))
            d = dept_res.scalars().first()
            user = User(
                telegram_id=tg["id"],
                full_name="Bosh Admin",
                position="Boshliq / Admin",
                role=UserRole.admin,
                reg_status=RegistrationStatus.approved,
                department_id=d.id if d else None,
            )
            db.add(user)
            await db.commit()
            user = await get_user_by_tg(db, tg["id"])
        else:
            raise HTTPException(status_code=404, detail="user_not_registered")

    # Get department name safely
    dept_name = None
    if user.department_id:
        from ..models import Department
        d_res = await db.execute(select(Department).where(Department.id == user.department_id))
        d_obj = d_res.scalars().first()
        if d_obj:
            dept_name = d_obj.name

    return UserOut(
        id=user.id,
        telegram_id=user.telegram_id,
        username=user.username,
        full_name=user.full_name,
        position=user.position,
        phone=user.phone,
        role=user.role,
        reg_status=user.reg_status,
        department_id=user.department_id,
        department_name=dept_name,
        is_blocked=bool(user.is_blocked),
        created_at=user.created_at or datetime.utcnow(),
    )


@router.post("/register", response_model=MsgResponse, status_code=201)
async def register(
    body: RegisterRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    tg: dict = Depends(_get_tg_id),
):
    """Yangi foydalanuvchi ro'yxatdan o'tish arizasi."""
    tg_id = tg["id"]
    username = tg.get("username")

    # already exists?
    existing = await get_user_by_tg(db, tg_id)
    if existing:
        if existing.reg_status == RegistrationStatus.approved:
            return MsgResponse(msg="Allaqachon tasdiqlangansiz.")
        if existing.reg_status == RegistrationStatus.pending:
            return MsgResponse(msg="Arizangiz ko'rib chiqilmoqda.")

    # validate department
    all_depts = await get_all_departments(db)
    dept_ids = {d.id for d in all_depts}
    if body.department_id not in dept_ids:
        raise HTTPException(status_code=400, detail="Noto'g'ri bo'lim id.")

    if existing:
        existing.full_name = body.full_name
        existing.position = body.position
        existing.phone = body.phone
        existing.department_id = body.department_id
        existing.username = username
        existing.reg_status = RegistrationStatus.pending
        existing.rejection_reason = None
        await db.commit()
    else:
        await create_user_from_tg(db, tg_id, username, body)
    req = await create_registration_request(db, tg_id, username, body)

    # Admin Telegramiga to'g'ridan-to'g'ri Tasdiqlash / Rad etish tugmalari bilan xabar yuborish
    try:
        from ..bot.handlers import notify_admins_new_request
        dept_name = next((d.name for d in all_depts if d.id == body.department_id), "Noma'lum")
        bot = getattr(request.app.state, "bot", None)
        if bot:
            await notify_admins_new_request(
                bot=bot,
                request_id=req.id,
                full_name=body.full_name,
                position=body.position,
                dept_name=dept_name,
                tg_username=username,
            )
    except Exception as e:
        logger.exception("Adminlarga ariza xabari yuborilmadi: %s", e)

    return MsgResponse(msg="Arizangiz yuborildi. Admin tasdiqlashini kuting.")
