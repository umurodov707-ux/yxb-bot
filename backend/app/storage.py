"""Yuklangan fayllarni diskda va bazada saqlash.

Render bepul tarifida disk har deploy/qayta ishga tushishda tozalanadi,
shuning uchun fayl mazmuni bazaga ham yoziladi va kerak bo'lganda diskka tiklanadi.
"""
from __future__ import annotations
import os

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .config import settings
from .database import AsyncSessionLocal
from .models import FileBlob


def stored_name(local_path: str) -> str:
    return os.path.basename(local_path.replace("\\", "/"))


async def save_blob(db: AsyncSession, local_path: str) -> None:
    """Commit chaqiruvchi tomonidan qilinadi."""
    name = stored_name(local_path)
    exists = await db.execute(select(FileBlob.id).where(FileBlob.stored_name == name))
    if exists.first():
        return
    with open(local_path, "rb") as fh:
        db.add(FileBlob(stored_name=name, data=fh.read()))


async def resolve_file(name: str) -> str | None:
    """Diskdagi yo'lni qaytaradi; diskda bo'lmasa bazadan tiklaydi."""
    name = os.path.basename(name)
    if not name:
        return None
    path = os.path.join(settings.UPLOAD_DIR, name)
    if os.path.isfile(path):
        return path
    async with AsyncSessionLocal() as db:
        row = await db.execute(select(FileBlob.data).where(FileBlob.stored_name == name))
        data = row.scalar_one_or_none()
    if data is None:
        return None
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    tmp = path + ".part"
    with open(tmp, "wb") as fh:
        fh.write(data)
    os.replace(tmp, path)
    return path
