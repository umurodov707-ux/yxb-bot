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


# ── Xodim chatga rasm, hujjat yoki matn tashlaganda avtomatik saqlash ───────────
import asyncio, logging, os, uuid
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from ..database import AsyncSessionLocal
from ..models import User, Record, AttachedFile, RecordType, RecordStatus, RegistrationStatus
from ..storage import save_blob

log = logging.getLogger(__name__)

TG_DOWNLOAD_LIMIT = 20 * 1024 * 1024


def _attachment(msg: Message):
    """(file_id, original_name, mime, size, label) yoki None."""
    if msg.photo:
        p = msg.photo[-1]
        return p.file_id, "photo.jpg", "image/jpeg", p.file_size, "📸 Rasm"
    if msg.document:
        d = msg.document
        return d.file_id, d.file_name or "hujjat", d.mime_type or "application/octet-stream", d.file_size, f"📎 {d.file_name or 'Hujjat'}"
    if msg.video:
        v = msg.video
        return v.file_id, v.file_name or "video.mp4", v.mime_type or "video/mp4", v.file_size, "🎬 Video"
    if msg.voice:
        v = msg.voice
        return v.file_id, "ovozli_xabar.ogg", v.mime_type or "audio/ogg", v.file_size, "🎤 Ovozli xabar"
    if msg.audio:
        a = msg.audio
        return a.file_id, a.file_name or "audio.mp3", a.mime_type or "audio/mpeg", a.file_size, "🎵 Audio"
    return None


_album_records: dict[str, int] = {}
_album_locks: dict[str, asyncio.Lock] = {}


async def _download(msg: Message, file_id: str, orig_name: str) -> str:
    file_info = await msg.bot.get_file(file_id)
    ext = os.path.splitext(orig_name)[1] or os.path.splitext(file_info.file_path or "")[1]
    local_p = os.path.join(settings.UPLOAD_DIR, f"{uuid.uuid4().hex}{ext}")
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    await msg.bot.download_file(file_info.file_path, local_p)
    return local_p


async def _append_to_album(msg: Message, record_id: int) -> None:
    att = _attachment(msg)
    if not att:
        return
    file_id, orig_name, mime, size, _ = att
    try:
        local_p = await _download(msg, file_id, orig_name)
    except Exception:
        log.exception("Albom faylini yuklab bo'lmadi")
        return
    async with AsyncSessionLocal() as db:
        rec = await db.get(Record, record_id)
        if not rec:
            return
        if msg.caption and not rec.body:
            rec.body = msg.caption.strip()
            rec.title = rec.body.split("\n")[0][:60]
        db.add(AttachedFile(
            record_id=record_id, original_name=orig_name, mime_type=mime,
            file_size=size or os.path.getsize(local_p), local_path=local_p, tg_file_id=file_id,
        ))
        await save_blob(db, local_p)
        await db.commit()


@bot_router.message(
    F.photo | F.document | F.video | F.voice | F.audio | (F.text & ~F.text.startswith("/"))
)
async def handle_user_chat_message(msg: Message):
    gid = msg.media_group_id
    if not gid:
        await _save_message(msg)
        return
    lock = _album_locks.setdefault(gid, asyncio.Lock())
    async with lock:
        if gid in _album_records:
            await _append_to_album(msg, _album_records[gid])
        else:
            rid = await _save_message(msg)
            if rid:
                _album_records[gid] = rid
    if len(_album_records) > 500:
        for k in list(_album_records)[:250]:
            _album_records.pop(k, None)
            _album_locks.pop(k, None)


async def _save_message(msg: Message) -> int | None:
    async with AsyncSessionLocal() as db:
        res = await db.execute(
            select(User)
            .options(selectinload(User.department))
            .where(User.telegram_id == msg.from_user.id)
        )
        user = res.scalars().first()

        if not user or user.reg_status != RegistrationStatus.approved or user.is_blocked:
            await msg.reply(
                "⚠️ Siz hali ro‘yxatdan o‘tmagansiz yoki arizangiz tasdiqlanmagan.\n"
                "Pastdagi <b>📂 Ochish</b> tugmasi orqali ro‘yxatdan o‘ting.",
                parse_mode="HTML",
                reply_markup=main_menu_kb(settings.WEBAPP_URL),
            )
            return None

        if not user.department_id:
            await msg.reply("⚠️ Sizga biriktirilgan bo‘lim topilmadi. Admin bilan bog‘laning.")
            return None

        full_name = user.full_name
        dept_name = user.department.name if user.department else ""

        att = _attachment(msg)
        if att and att[3] and att[3] > TG_DOWNLOAD_LIMIT:
            await msg.reply(
                "⚠️ Fayl 20 MB dan katta — Telegram bot orqali qabul qilib bo‘lmaydi.\n"
                "Iltimos, uni Mini App orqali yuklang (📂 Ochish → 📎)."
            )
            return None

        text = (msg.caption or msg.text or "").strip()
        if text:
            title = text.split("\n")[0][:60] + ("..." if len(text) > 60 else "")
        else:
            title = (att[4] if msg.photo else att[1]) if att else "Tezkor ma'lumot"

        if msg.text:
            rec_type = RecordType.message
        elif msg.document:
            rec_type = RecordType.document
        else:
            rec_type = RecordType.spravka

        record = Record(
            title=title,
            body=text,
            record_type=rec_type,
            status=RecordStatus.sent,
            department_id=user.department_id,
            author_id=user.id,
        )
        db.add(record)
        await db.flush()

        if att:
            file_id, orig_name, mime, size, _ = att
            try:
                local_p = await _download(msg, file_id, orig_name)
            except Exception:
                log.exception("Telegram faylini yuklab bo'lmadi")
                await db.rollback()
                await msg.reply("❌ Faylni yuklab bo‘lmadi. Qaytadan yuboring yoki Mini App orqali yuklang.")
                return None
            db.add(AttachedFile(
                record_id=record.id,
                original_name=orig_name,
                mime_type=mime,
                file_size=size or os.path.getsize(local_p),
                local_path=local_p,
                tg_file_id=file_id,
            ))
            await save_blob(db, local_p)

        await db.commit()
        record_id = record.id

    resp_text = (
        "✅ <b>Qabul qilindi va lentaga joylandi!</b>\n\n"
        f"👤 {full_name}\n"
        f"🏢 {dept_name}\n"
    )
    if att:
        resp_text += f"📦 {att[4]}\n"
    await msg.reply(resp_text, parse_mode="HTML", reply_markup=main_menu_kb(settings.WEBAPP_URL))

    if msg.from_user.id not in settings.admin_ids_list:
        try:
            await notify_admins_new_record(msg.bot, dept_name, title, full_name, rec_type.value)
        except Exception:
            log.exception("Admin xabarnomasi yuborilmadi")
    return record_id
