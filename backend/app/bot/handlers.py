"""
aiogram 3 handlerlar.
Bot startup'da app.include_router(bot_router) qilinadi.
"""
from __future__ import annotations
from aiogram import Router, F
from aiogram.types import Message, CallbackQuery
from aiogram.filters import CommandStart

from ..config import settings
from .keyboards import main_menu_kb, approve_reject_kb, confirm_reject_kb

bot_router = Router()

# ── /start ────────────────────────────────────────────────────────────────────
@bot_router.message(CommandStart())
async def cmd_start(msg: Message):
    text = (
        "👋 <b>ЙХБ Hujjatlar va Spravkalar</b> tizimiga xush kelibsiz!\n\n"
        "Pastdagi tugmani bosib Mini App'ni oching:\n"
        "• Ro'yxatdan o'ting (agar hali o'tmagan bo'lsangiz)\n"
        "• O'z bo'limingiz lentasiga kiring\n"
        "• Spravka, hujjat va xabarlar yuklang"
    )
    await msg.answer(
        text,
        parse_mode="HTML",
        reply_markup=main_menu_kb(settings.WEBAPP_URL),
    )


# ── Yangi ariza keldi → adminga xabar ────────────────────────────────────────
async def notify_admins_new_request(
    bot,
    request_id: int,
    full_name: str,
    position: str,
    dept_name: str,
    tg_username: str | None,
):
    text = (
        f"📋 <b>Yangi ro'yxatdan o'tish arizasi</b>\n\n"
        f"👤 F.I.Sh.: <b>{full_name}</b>\n"
        f"💼 Lavozim: {position}\n"
        f"🏢 Bo'lim: {dept_name}\n"
        f"🔗 Telegram: {'@' + tg_username if tg_username else 'ko`rsatilmagan'}\n\n"
        f"#ariza_{request_id}"
    )
    kb = approve_reject_kb(request_id)
    for admin_id in settings.admin_ids_list:
        try:
            await bot.send_message(admin_id, text, parse_mode="HTML", reply_markup=kb)
        except Exception:
            pass


# ── Approve callback ──────────────────────────────────────────────────────────
@bot_router.callback_query(F.data.startswith("approve:"))
async def cb_approve(cq: CallbackQuery):
    from ..database import AsyncSessionLocal
    from ..crud import approve_registration, get_pending_requests
    from sqlalchemy import select
    from ..models import RegistrationRequest

    request_id = int(cq.data.split(":")[1])
    async with AsyncSessionLocal() as db:
        rr = await approve_registration(
            db, request_id, True, None, cq.from_user.id
        )
    if rr:
        await cq.message.edit_text(
            cq.message.text + "\n\n✅ <b>Tasdiqlandi</b>", parse_mode="HTML"
        )
        # notify user
        try:
            await cq.bot.send_message(
                rr.telegram_id,
                "✅ <b>Arizangiz tasdiqlandi!</b>\n\nEndi Mini App'ni ochib ishlashingiz mumkin.",
                parse_mode="HTML",
                reply_markup=main_menu_kb(settings.WEBAPP_URL),
            )
        except Exception:
            pass
    await cq.answer("Tasdiqlandi.")


# ── Reject callback ───────────────────────────────────────────────────────────
@bot_router.callback_query(F.data.startswith("reject:"))
async def cb_reject(cq: CallbackQuery):
    request_id = int(cq.data.split(":")[1])
    await cq.message.edit_reply_markup(reply_markup=confirm_reject_kb(request_id))
    await cq.answer()


@bot_router.callback_query(F.data.startswith("reject_confirm:"))
async def cb_reject_confirm(cq: CallbackQuery):
    from ..database import AsyncSessionLocal
    from ..crud import approve_registration

    request_id = int(cq.data.split(":")[1])
    async with AsyncSessionLocal() as db:
        rr = await approve_registration(
            db, request_id, False, "Admin tomonidan rad etildi.", cq.from_user.id
        )
    if rr:
        await cq.message.edit_text(
            cq.message.text + "\n\n❌ <b>Rad etildi</b>", parse_mode="HTML"
        )
        try:
            await cq.bot.send_message(
                rr.telegram_id,
                "❌ Arizangiz rad etildi.\nQo'shimcha ma'lumot uchun admin bilan bog'laning.",
                parse_mode="HTML",
            )
        except Exception:
            pass
    await cq.answer("Rad etildi.")


@bot_router.callback_query(F.data == "cancel")
async def cb_cancel(cq: CallbackQuery):
    await cq.answer("Bekor qilindi.")


# ── New record notification (called from API) ─────────────────────────────────
async def notify_admins_new_record(
    bot,
    dept_name: str,
    record_title: str,
    author_name: str,
    record_type: str,
):
    text = (
        f"📄 <b>Yangi yozuv</b> [{record_type}]\n"
        f"🏢 Bo'lim: {dept_name}\n"
        f"📌 Sarlavha: {record_title}\n"
        f"👤 Muallif: {author_name}"
    )
    for admin_id in settings.admin_ids_list:
        try:
            await bot.send_message(admin_id, text, parse_mode="HTML")
        except Exception:
            pass
