"""
SQLAlchemy ORM models for ЙХБ system.
"""
from __future__ import annotations
import enum
from datetime import datetime
from sqlalchemy import (
    Column, Integer, BigInteger, String, Text, Boolean,
    DateTime, Enum as SAEnum, ForeignKey, JSON, LargeBinary, func,
)
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    pass


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------
class UserRole(str, enum.Enum):
    admin = "admin"
    user = "user"


class RegistrationStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class RecordType(str, enum.Enum):
    spravka = "spravka"           # Spravka / Hisobot
    document = "document"         # Fayl/Hujjat
    message = "message"           # Oddiy xabar
    urgent = "urgent"             # Shoshilinch xabar
    broadcast = "broadcast"       # Admin tomonidan barcha bo'limlarga


class RecordStatus(str, enum.Enum):
    sent = "sent"
    seen_by_admin = "seen_by_admin"


# ---------------------------------------------------------------------------
# Departments / Sections
# ---------------------------------------------------------------------------
class Department(Base):
    """
    Asosiy bo'limlar va ularning quyi bo'linmalari.
    parent_id = None  →  asosiy bo'lim
    parent_id = X     →  quyi bo'linma (ПЧ-1 ichida)
    """
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True)
    name = Column(String(120), nullable=False)      # "ПЧ-1", "ОПМС-203" …
    code = Column(String(40), unique=True)           # "PC_1", "OPMS_203" …
    sort_order = Column(Integer, default=0)
    parent_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    is_active = Column(Boolean, default=True)
    read_only_broadcast = Column(Boolean, default=False)  # True → faqat o'qish

    parent = relationship("Department", remote_side=[id], back_populates="children")
    children = relationship("Department", back_populates="parent",
                            order_by="Department.sort_order")
    users = relationship("User", back_populates="department")
    records = relationship("Record", back_populates="department")


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    telegram_id = Column(BigInteger, unique=True, nullable=False, index=True)
    username = Column(String(64), nullable=True)   # @username
    full_name = Column(String(160), nullable=False)
    position = Column(String(120), nullable=False)  # Lavozim
    phone = Column(String(30), nullable=True)

    role = Column(SAEnum(UserRole), default=UserRole.user, nullable=False)
    reg_status = Column(SAEnum(RegistrationStatus),
                        default=RegistrationStatus.pending, nullable=False)
    rejection_reason = Column(Text, nullable=True)

    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    department = relationship("Department", back_populates="users")

    is_blocked = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    approved_at = Column(DateTime(timezone=True), nullable=True)

    records = relationship("Record", back_populates="author")


# ---------------------------------------------------------------------------
# Records (ma'lumot/spravka/hujjat yozuvlari)
# ---------------------------------------------------------------------------
class Record(Base):
    __tablename__ = "records"

    id = Column(Integer, primary_key=True)
    title = Column(String(255), nullable=False)
    body = Column(Text, nullable=True)

    record_type = Column(SAEnum(RecordType), nullable=False, default=RecordType.message)
    status = Column(SAEnum(RecordStatus), default=RecordStatus.sent, nullable=False)

    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False)
    department = relationship("Department", back_populates="records")

    author_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # None → bot/admin
    author = relationship("User", back_populates="records")

    # Broadcast: list of department ids that received this record
    broadcast_to = Column(JSON, nullable=True)   # [dept_id, …]

    record_date = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    is_deleted = Column(Boolean, default=False)

    files = relationship("AttachedFile", back_populates="record",
                         cascade="all, delete-orphan")


# ---------------------------------------------------------------------------
# Attached files
# ---------------------------------------------------------------------------
class FileBlob(Base):
    """Fayl mazmuni bazada — Render diski tozalanganda ham fayl yo'qolmaydi."""
    __tablename__ = "file_blobs"

    id = Column(Integer, primary_key=True)
    stored_name = Column(String(255), unique=True, index=True, nullable=False)
    data = Column(LargeBinary, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class AttachedFile(Base):
    __tablename__ = "attached_files"

    id = Column(Integer, primary_key=True)
    record_id = Column(Integer, ForeignKey("records.id"), nullable=False)
    record = relationship("Record", back_populates="files")

    original_name = Column(String(255))
    mime_type = Column(String(80))
    file_size = Column(Integer)       # bytes
    # Either local path or Telegram file_id
    local_path = Column(String(512), nullable=True)
    tg_file_id = Column(String(200), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())


# ---------------------------------------------------------------------------
# Registration requests (pending approvals stored separately for quick access)
# ---------------------------------------------------------------------------
class RegistrationRequest(Base):
    __tablename__ = "registration_requests"

    id = Column(Integer, primary_key=True)
    telegram_id = Column(BigInteger, nullable=False, index=True)
    username = Column(String(64), nullable=True)
    full_name = Column(String(160), nullable=False)
    position = Column(String(120), nullable=False)
    phone = Column(String(30), nullable=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    status = Column(SAEnum(RegistrationStatus),
                    default=RegistrationStatus.pending, nullable=False)
    rejection_reason = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    reviewed_by = Column(BigInteger, nullable=True)   # admin telegram_id
