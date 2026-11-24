"""
ЙХБ Backend — FastAPI + aiogram 3

Ishga tushirish:
    cd backend
    pip install -r requirements.txt
    uvicorn main:app --reload --port 8000

Telegram Webhook uchun:
    BOT_TOKEN va WEBAPP_URL to'g'ri o'rnatilgan bo'lishi kerak.
"""
from __future__ import annotations
import asyncio, hashlib, hmac, logging, os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from aiogram import Bot, Dispatcher
from aiogram.enums import ParseMode
from aiogram.client.default import DefaultBotProperties

from app.config import settings
from app.database import init_db
from app.bot.handlers import bot_router

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ── Bot + Dispatcher ──────────────────────────────────────────────────────────
bot = Bot(
    token=settings.BOT_TOKEN,
    default=DefaultBotProperties(parse_mode=ParseMode.HTML),
)
dp = Dispatcher()
dp.include_router(bot_router)

WEBHOOK_SECRET = hashlib.sha256(f"{settings.SECRET_KEY}:{settings.BOT_TOKEN}".encode()).hexdigest()[:48]


# ── Lifespan ──────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    logger.info("DB initialized / seeded.")

    # Admin foydalanuvchini har doim admin qilib approved qilib qo'yish
    from app.database import AsyncSessionLocal
    from app.models import User, UserRole, RegistrationStatus, Department
    from sqlalchemy import select
    async with AsyncSessionLocal() as session:
        for admin_tg_id in settings.admin_ids_list:
            res = await session.execute(select(User).where(User.telegram_id == admin_tg_id))
            u = res.scalars().first()
            if not u:
                dept_res = await session.execute(select(Department).limit(1))
                d = dept_res.scalars().first()
                u = User(
                    telegram_id=admin_tg_id,
                    full_name="Bosh Admin",
                    position="Boshliq / Admin",
                    role=UserRole.admin,
                    reg_status=RegistrationStatus.approved,
                    department_id=d.id if d else None,
                )
                session.add(u)
            else:
                u.role = UserRole.admin
                u.reg_status = RegistrationStatus.approved
            await session.commit()

    task = None
    use_webhook = settings.WEBAPP_URL.startswith("https://") and "example" not in settings.WEBAPP_URL
    if settings.BOT_TOKEN != "CHANGEME" and use_webhook:
        from aiogram.types import MenuButtonWebApp, WebAppInfo
        hook_url = f"{settings.WEBAPP_URL.rstrip('/')}/webhook/tg"
        await bot.set_webhook(
            hook_url,
            secret_token=WEBHOOK_SECRET,
            allowed_updates=dp.resolve_used_update_types(),
            drop_pending_updates=False,
        )
        try:
            await bot.set_chat_menu_button(
                menu_button=MenuButtonWebApp(text="📂 Ochish", web_app=WebAppInfo(url=settings.WEBAPP_URL))
            )
        except Exception:
            logger.exception("Menu button setup failed")
        logger.info("Webhook set: %s", hook_url)
    elif settings.BOT_TOKEN != "CHANGEME":
        async def run_polling():
            await bot.delete_webhook(drop_pending_updates=False)
            while True:
                try:
                    await dp.start_polling(bot, handle_signals=False, close_bot_session=False)
                except asyncio.CancelledError:
                    raise
                except Exception:
                    logger.exception("Polling crashed, restarting in 5s")
                await asyncio.sleep(5)

        task = asyncio.create_task(run_polling())
        logger.info("Bot polling started.")
    else:
        logger.warning("BOT_TOKEN not set — bot disabled.")

    yield

    if task:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass


# ── FastAPI app ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="ЙХБ Hujjatlar va Spravkalar",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # production'da WEBAPP_URL bilan cheklang
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static file serving (uploaded files)
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

# ── Routers ───────────────────────────────────────────────────────────────────
from app.api.auth_router import router as auth_router
from app.api.departments import router as dept_router
from app.api.records import router as records_router
from app.api.admin import router as admin_router

app.include_router(auth_router,    prefix="/api/v1")
app.include_router(dept_router,    prefix="/api/v1")
app.include_router(records_router, prefix="/api/v1")
app.include_router(admin_router,   prefix="/api/v1")


# ── Webhook endpoint ──────────────────────────────────────────────────────────
from aiogram.types import Update
from fastapi import Header, HTTPException


@app.post("/webhook/tg", include_in_schema=False)
async def telegram_webhook(
    update: dict,
    x_telegram_bot_api_secret_token: str | None = Header(default=None),
):
    if not hmac.compare_digest(x_telegram_bot_api_secret_token or "", WEBHOOK_SECRET):
        raise HTTPException(status_code=403)
    try:
        await dp.feed_update(bot, Update.model_validate(update, context={"bot": bot}))
    except Exception:
        # 200 qaytaramiz, aks holda Telegram shu update'ni qayta-qayta yuborib navbatni to'sib qo'yadi
        logger.exception("Update %s ni qayta ishlashda xato", update.get("update_id"))
    return {"ok": True}


@app.get("/files/{stored}/{name}", include_in_schema=False)
async def download_file(stored: str, name: str, inline: bool = False):
    """Faylni asl nomi va to'g'ri turi bilan beradi — telefon uni Word/Excel/PDF da ochadi."""
    from fastapi.responses import FileResponse
    import mimetypes

    stored = os.path.basename(stored)
    path = os.path.join(settings.UPLOAD_DIR, stored)
    if not stored or not os.path.isfile(path):
        raise HTTPException(status_code=404)
    media_type = mimetypes.guess_type(name)[0] or mimetypes.guess_type(stored)[0] or "application/octet-stream"
    return FileResponse(
        path,
        media_type=media_type,
        filename=name,
        content_disposition_type="inline" if inline else "attachment",
    )


@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}


# ── Frontend SPA — OXIRIDA ro'yxatdan o'tishi shart ──────────────────────────
# Avval backend/static ni, topilmasa frontend/dist ni tekshiradi
FRONTEND_DIST = os.path.join(os.path.dirname(__file__), "static")
if not os.path.isdir(FRONTEND_DIST):
    FRONTEND_DIST = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")

if os.path.isdir(FRONTEND_DIST):
    from fastapi.responses import FileResponse
    _assets_path = os.path.join(FRONTEND_DIST, "assets")
    if os.path.isdir(_assets_path):
        app.mount("/assets", StaticFiles(directory=_assets_path), name="frontend-assets")

    @app.get("/", include_in_schema=False)
    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str = ""):
        return FileResponse(os.path.join(FRONTEND_DIST, "index.html"))


# Make bot accessible to handlers module
app.state.bot = bot
