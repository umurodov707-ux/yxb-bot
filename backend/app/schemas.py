"""Pydantic request / response schemas."""
from __future__ import annotations
import os
from datetime import datetime
from typing import List, Optional, Any
from pydantic import BaseModel, Field, model_validator

from .models import UserRole, RegistrationStatus, RecordType, RecordStatus


# ── Departments ──────────────────────────────────────────────────────────────
class DepartmentShort(BaseModel):
    id: int
    name: str
    code: str
    sort_order: int
    parent_id: Optional[int]
    read_only_broadcast: bool
    model_config = {"from_attributes": True}


class DepartmentTree(DepartmentShort):
    children: List["DepartmentTree"] = []


# ── Users ─────────────────────────────────────────────────────────────────────
class UserOut(BaseModel):
    id: int
    telegram_id: int
    username: Optional[str]
    full_name: str
    position: str
    phone: Optional[str]
    role: UserRole
    reg_status: RegistrationStatus
    department_id: Optional[int]
    department_name: Optional[str] = None
    is_blocked: bool
    created_at: Optional[datetime] = None
    model_config = {"from_attributes": True}


# ── Registration ──────────────────────────────────────────────────────────────
class RegisterRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=160)
    position: str = Field(..., min_length=2, max_length=120)
    department_id: int
    phone: Optional[str] = None


class ApproveRequest(BaseModel):
    request_id: int
    approve: bool
    rejection_reason: Optional[str] = None


class RegistrationRequestOut(BaseModel):
    id: int
    telegram_id: int
    username: Optional[str]
    full_name: str
    position: str
    phone: Optional[str]
    department_id: Optional[int]
    department_name: Optional[str] = None
    status: RegistrationStatus
    created_at: Optional[datetime] = None
    model_config = {"from_attributes": True}


# ── Files ─────────────────────────────────────────────────────────────────────
class FileOut(BaseModel):
    id: int
    original_name: Optional[str]
    mime_type: Optional[str]
    file_size: Optional[int]
    tg_file_id: Optional[str]
    url: Optional[str] = None
    model_config = {"from_attributes": True}

    @model_validator(mode="before")
    @classmethod
    def _public_url(cls, obj):
        local_path = getattr(obj, "local_path", None)
        if local_path and not isinstance(obj, dict):
            return {
                "id": obj.id,
                "original_name": obj.original_name,
                "mime_type": obj.mime_type,
                "file_size": obj.file_size,
                "tg_file_id": obj.tg_file_id,
                "url": "/uploads/" + os.path.basename(local_path.replace("\\", "/")),
            }
        return obj


# ── Records ───────────────────────────────────────────────────────────────────
class RecordCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    body: Optional[str] = None
    record_type: RecordType = RecordType.message
    department_id: int
    record_date: Optional[datetime] = None
    # for admin broadcast:
    broadcast_to: Optional[List[int]] = None   # list of dept ids


class RecordOut(BaseModel):
    id: int
    title: str
    body: Optional[str]
    record_type: RecordType
    status: RecordStatus
    department_id: int
    department_name: Optional[str] = None
    author_id: Optional[int]
    author_name: Optional[str] = None
    broadcast_to: Optional[List[int]]
    record_date: datetime
    created_at: datetime
    files: List[FileOut] = []
    model_config = {"from_attributes": True}


class RecordUpdate(BaseModel):
    title: Optional[str] = None
    body: Optional[str] = None
    record_type: Optional[RecordType] = None


# ── Monitoring / Svodka ───────────────────────────────────────────────────────
class SvodkaRow(BaseModel):
    department_id: int
    department_name: str
    has_submitted: bool          # ✅ / ⏳
    record_count: int
    last_at: Optional[datetime]


class SvodkaResponse(BaseModel):
    date_from: datetime
    date_to: datetime
    rows: List[SvodkaRow]
    total: int
    submitted: int
    pending: int


# ── Generic ───────────────────────────────────────────────────────────────────
class MsgResponse(BaseModel):
    ok: bool = True
    msg: str = "OK"
