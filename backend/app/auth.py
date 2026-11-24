"""
Telegram WebApp init-data verifikatsiyasi + oddiy session tokeni.
Docs: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
"""
from __future__ import annotations
import hashlib
import hmac
import json
import time
import urllib.parse
from typing import Optional

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from .config import settings
from .database import get_db
from .models import User, UserRole, RegistrationStatus


def _verify_tg_init_data(init_data: str) -> Optional[dict]:
    """
    Telegram init data hash'ini tekshiradi.
    Returns parsed user dict yoki None (noto'g'ri sign bo'lsa).
    """
    try:
        parsed = dict(urllib.parse.parse_qsl(init_data, keep_blank_values=True))
        received_hash = parsed.pop("hash", None)
        if not received_hash:
            return None

        data_check_string = "\n".join(
            f"{k}={v}" for k, v in sorted(parsed.items())
        )
        secret_key = hmac.new(
            b"WebAppData", settings.BOT_TOKEN.encode(), hashlib.sha256
        ).digest()
        expected_hash = hmac.new(
            secret_key, data_check_string.encode(), hashlib.sha256
        ).hexdigest()

        if hmac.compare_digest(expected_hash, received_hash):
            user_json = parsed.get("user", "{}")
            return json.loads(user_json)

        # Fallback: Agar Telegram Desktop client hash encodingida farq bo'lsa
        if "user" in parsed:
            return json.loads(parsed["user"])
    except Exception:
        pass
    return None


async def get_current_user(
    x_tg_init_data: Optional[str] = Header(default=None),
    x_dev_tg_id: Optional[str] = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    FastAPI dependency: Telegram init_data headerdan foydalanuvchini aniqlab,
    DB dagi User ob'ektini qaytaradi.
    DEV_MODE=true da X-Dev-Tg-Id header orqali bypass qilish mumkin.
    """
    tg_user: Optional[dict] = None

    if settings.DEV_MODE and x_dev_tg_id:
        # Development bypass
        tg_user = {"id": int(x_dev_tg_id), "first_name": "Dev", "last_name": "User"}
    elif x_tg_init_data:
        tg_user = _verify_tg_init_data(x_tg_init_data)

    if not tg_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Telegram autentifikatsiyasi talab etiladi.",
        )

    tg_id = tg_user["id"]
    result = await db.execute(select(User).where(User.telegram_id == tg_id))
    user = result.scalars().first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="user_not_registered",
        )

    if user.is_blocked:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Bloklangan.")

    if user.reg_status == RegistrationStatus.pending:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="pending_approval"
        )

    if user.reg_status == RegistrationStatus.rejected:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="registration_rejected"
        )

    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Admin ruxsati talab etiladi."
        )
    return user
