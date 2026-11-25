"""Admin-only endpoints: users, requests, monitoring, svodka."""
from __future__ import annotations
from datetime import datetime, timedelta
from typing import List, Optional

import logging

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request
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
    from sqlalchemy import select
    from ..models import Department
    reqs = await get_pending_requests(db)
    names = dict((await db.execute(select(Department.id, Department.name))).all())
    result = []
    for r in reqs:
        out = RegistrationRequestOut.model_validate(r)
        out.department_name = names.get(r.department_id)
        result.append(out)
    return result


@router.post("/requests/review", response_model=MsgResponse)
async def review_request(
    body: ApproveRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    rr = await approve_registration(
        db, body.request_id, body.approve,
        body.rejection_reason, admin.telegram_id,
    )
    if not rr:
        raise HTTPException(status_code=404, detail="Ariza topilmadi.")
    bot = getattr(request.app.state, "bot", None)
    if bot:
        from ..bot.keyboards import main_menu_kb
        from ..config import settings
        try:
            if body.approve:
                await bot.send_message(
                    rr.telegram_id,
                    "✅ <b>Arizangiz tasdiqlandi!</b>\n\nEndi Mini App'ni ochib ishlashingiz mumkin.",
                    reply_markup=main_menu_kb(settings.WEBAPP_URL),
                )
            else:
                await bot.send_message(
                    rr.telegram_id,
                    "❌ Arizangiz rad etildi." + (f"\nSabab: {body.rejection_reason}" if body.rejection_reason else ""),
                )
        except Exception:
            logging.getLogger(__name__).exception("Xodimga javob yuborilmadi")
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


@router.post("/users/{user_id}/head", response_model=MsgResponse)
async def set_dept_head(
    user_id: int,
    head: bool = Body(..., embed=True),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    from ..models import Department
    from .records import is_send_target
    u = await db.get(User, user_id)
    if not u:
        raise HTTPException(status_code=404, detail="Xodim topilmadi.")
    if head:
        dept = await db.get(Department, u.department_id) if u.department_id else None
        if not is_send_target(dept):
            raise HTTPException(status_code=400, detail="Rahbar faqat bosh bo'lim (Фойдаланиш, Капитал, ...) xodimi bo'la oladi.")
    u.is_dept_head = head
    await db.commit()
    return MsgResponse(msg="Rahbar qilindi." if head else "Rahbarlik olib tashlandi.")


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


async def send_daily_svodka(app, force: bool = False) -> bool:
    """Har kuni Toshkent vaqti bilan 18:00 da adminlarga kunlik svodkani botda yuboradi."""
    import os
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    from ..bot.keyboards import main_menu_kb
    from ..config import settings
    from ..database import AsyncSessionLocal
    from ..models import AssignmentStatus as AS, Record

    bot = getattr(app.state, "bot", None)
    if not bot or not settings.admin_ids_list:
        return False

    uz_now = datetime.utcnow() + timedelta(hours=5)
    today_str = uz_now.strftime("%Y-%m-%d")
    marker = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".daily_svodka_date")
    if not force:
        if uz_now.hour < 18:
            return False
        if os.path.exists(marker):
            try:
                if open(marker, encoding="utf-8").read().strip() == today_str:
                    return False
            except OSError:
                pass

    # Bugungi Toshkent kuni (00:00..23:59 UTC+5) UTC ko'rinishida
    df = datetime(uz_now.year, uz_now.month, uz_now.day) - timedelta(hours=5)
    dt = df + timedelta(days=1)

    async with AsyncSessionLocal() as db:
        pc = await get_svodka(db, df, dt, parent_code="PC")
        pms = await get_svodka(db, df, dt, parent_code="PMS")
        head = await get_svodka(db, df, dt, parent_code="HEAD")
        res = await db.execute(
            select(Record)
            .options(selectinload(Record.assignments))
            .where(Record.is_deleted == False, Record.assignments.any())
        )
        tasks = res.scalars().all()

    now_utc = datetime.utcnow()
    active_tasks = 0
    overdue_units = 0
    for t in tasks:
        not_done = [a for a in t.assignments if a.status != AS.accepted.value]
        if not_done:
            active_tasks += 1
        if t.deadline and t.deadline.replace(tzinfo=None) < now_utc:
            overdue_units += sum(1 for a in t.assignments if a.status in (AS.pending.value, AS.returned.value))

    def fmt_group(title: str, g: dict) -> list[str]:
        lines = [f"<b>{title}:</b> {g['submitted']}/{g['total']} topshirdi"]
        missed = [r["department_name"] for r in g["rows"] if not r["has_submitted"]]
        if missed:
            lines.append("⏳ Topshirmaganlar: " + ", ".join(missed[:12]) + (f" (+{len(missed)-12})" if len(missed) > 12 else ""))
        else:
            lines.append("✅ Barchasi topshirdi")
        return lines

    parts = [
        f"📊 <b>Kunlik svodka — {uz_now.strftime('%d.%m.%Y')}</b>",
        "",
        *fmt_group("ПЧ", pc),
        "",
        *fmt_group("ПМС / ОПМС", pms),
        "",
        *fmt_group("Bo'limlar (Фойдаланиш, Капитал...)", head),
        "",
        f"📜 <b>Faol telegrammalar:</b> {active_tasks} ta"
        + (f" (🚨 kechikkan bo‘linmalar: {overdue_units})" if overdue_units else ""),
    ]
    text = "\n".join(parts)
    kb = main_menu_kb(f"{settings.WEBAPP_URL.rstrip('/')}/admin/svodka", "📊 Svodkani ochish")

    pdf_bytes = None
    try:
        from ..pdf_report import build_daily_svodka_pdf
        pdf_bytes = build_daily_svodka_pdf(uz_now, pc, pms, head, active_tasks, overdue_units)
    except Exception:
        logging.getLogger(__name__).exception("PDF svodka yaratishda xato")

    from aiogram.types import BufferedInputFile
    fname = f"svodka_{today_str}.pdf"
    for admin_id in settings.admin_ids_list:
        try:
            if pdf_bytes:
                await bot.send_document(
                    admin_id,
                    BufferedInputFile(pdf_bytes, filename=fname),
                    caption=text[:1020],
                    reply_markup=kb,
                )
            else:
                await bot.send_message(admin_id, text, reply_markup=kb)
        except Exception:
            logging.getLogger(__name__).warning("Kunlik svodka yuborilmadi: %s", admin_id)

    try:
        with open(marker, "w", encoding="utf-8") as fh:
            fh.write(today_str)
    except OSError:
        pass
    return True


@router.post("/svodka/send-bot", response_model=MsgResponse)
async def send_svodka_to_bot(
    request: Request,
    _admin: User = Depends(require_admin),
):
    """Admin talabiga ko'ra bugungi PDF svodkani darhol bot chatiga yuboradi."""
    ok = await send_daily_svodka(request.app, force=True)
    if not ok:
        raise HTTPException(status_code=503, detail="Bot faol emas yoki ADMIN_IDS sozlanmagan.")
    return MsgResponse(msg="PDF svodka bot chatiga yuborildi.")
