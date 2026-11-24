"""Admin-only endpoints: users, requests, monitoring, svodka."""
from __future__ import annotations
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..auth import require_admin
from ..models import User
from ..crud import (
    get_pending_requests, approve_registration,
    get_all_users, set_user_blocked, transfer_user_dept,
    get_svodka,
)
from ..schemas import (
    RegistrationRequestOut, ApproveRequest, UserOut,
    SvodkaResponse, MsgResponse,
)

router = APIRouter(prefix="/admin", tags=["Admin"])


# ── Registration requests ─────────────────────────────────────────────────────
@router.get("/requests", response_model=List[RegistrationRequestOut])
async def list_requests(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    reqs = await get_pending_requests(db)
    result = []
    for r in reqs:
        out = RegistrationRequestOut.model_validate(r)
        # attach department name via relationship (lazy loaded via select)
        result.append(out)
    return result


@router.post("/requests/review", response_model=MsgResponse)
async def review_request(
    body: ApproveRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    rr = await approve_registration(
        db, body.request_id, body.approve,
        body.rejection_reason, admin.telegram_id,
    )
    if not rr:
        raise HTTPException(status_code=404, detail="Ariza topilmadi.")
    action = "Tasdiqlandi" if body.approve else "Rad etildi"
    return MsgResponse(msg=f"{action}.")


# ── Users management ──────────────────────────────────────────────────────────
@router.get("/users", response_model=List[UserOut])
async def list_users(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    users = await get_all_users(db)
    result = []
    for u in users:
        out = UserOut.model_validate(u)
        if u.department:
            out.department_name = u.department.name
        result.append(out)
    return result


@router.post("/users/{user_id}/block", response_model=MsgResponse)
async def block_user(
    user_id: int,
    blocked: bool = Body(..., embed=True),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    await set_user_blocked(db, user_id, blocked)
    return MsgResponse(msg="Yangilandi.")


@router.delete("/users/{user_id}", response_model=MsgResponse)
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Admin xodimni tizimdan butunlay o'chirib tashlaydi."""
    from ..models import User, RegistrationRequest
    from sqlalchemy import select, delete

    u_res = await db.execute(select(User).where(User.id == user_id))
    user = u_res.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="Xodim topilmadi.")

    # O'chirish
    await db.execute(delete(RegistrationRequest).where(RegistrationRequest.telegram_id == user.telegram_id))
    await db.delete(user)
    await db.commit()
    return MsgResponse(msg="Xodim tizimdan o'chirildi.")


@router.post("/users/{user_id}/transfer", response_model=MsgResponse)
async def transfer_user(
    user_id: int,
    department_id: int = Body(..., embed=True),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    await transfer_user_dept(db, user_id, department_id)
    return MsgResponse(msg="Bo'lim o'zgartirildi.")


# ── Svodka / Monitoring ───────────────────────────────────────────────────────
@router.get("/svodka", response_model=SvodkaResponse)
async def svodka(
    group: str = Query("PC", description="'PC' yoki 'PMS'"),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """ПЧ yoki ПМС guruhi bo'yicha topshirish nazorati."""
    now = datetime.utcnow()
    df = date_from or datetime(now.year, now.month, now.day)
    dt = date_to or (df + timedelta(days=1))

    data = await get_svodka(db, df, dt, parent_code=group)
    return SvodkaResponse(
        date_from=df, date_to=dt,
        rows=data["rows"],
        total=data["total"],
        submitted=data["submitted"],
        pending=data["pending"],
    )
