"""aiogram 3 klaviaturalar."""
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo
from aiogram.utils.keyboard import InlineKeyboardBuilder


def main_menu_kb(webapp_url: str, text: str = "📂 Mini App'ni ochish") -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    builder.button(
        text=text,
        web_app=WebAppInfo(url=webapp_url),
    )
    return builder.as_markup()


def approve_reject_kb(request_id: int) -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    builder.button(text="✅ Tasdiqlash", callback_data=f"approve:{request_id}")
    builder.button(text="❌ Rad etish",  callback_data=f"reject:{request_id}")
    builder.adjust(2)
    return builder.as_markup()


def confirm_reject_kb(request_id: int) -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    builder.button(text="Ha, rad etish", callback_data=f"reject_confirm:{request_id}")
    builder.button(text="Bekor qilish",  callback_data="cancel")
    builder.adjust(2)
    return builder.as_markup()
