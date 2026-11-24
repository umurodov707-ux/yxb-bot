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
import asyncio, logging, os
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


# ── Lifespan ──────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    logger.info("DB initialized / seeded.")

    # Start polling in background (for dev).
    # In production use Webhook instead.
    if settings.BOT_TOKEN != "CHANGEME":
        task = asyncio.create_task(dp.start_polling(bot))
        logger.info("Bot polling started.")
    else:
        task = None
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

@app.post("/webhook/{token}")
async def telegram_webhook(token: str, update: dict):
    if token != settings.BOT_TOKEN:
        from fastapi import HTTPException
        raise HTTPException(status_code=403)
    tg_update = Update(**update)
    await dp.feed_update(bot, tg_update)
    return {"ok": True}


@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}


# ── Frontend SPA — OXIRIDA ro'yxatdan o'tishi shart ──────────────────────────
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
