# backend/app/core/__init__.py
from __future__ import annotations

from typing import Any

from fastapi import HTTPException

from .config import Settings, get_settings, settings
from .database import SessionLocal, engine, get_db
from .orm import Base

# ตอนนี้ .security เป็นโฟลเดอร์แล้ว
# จะ import จาก backend/app/core/security/__init__.py
from .security import create_access_token, hash_password, verify_password

try:
    from .registries import ACTION_REGISTRY, RESPONSE_REGISTRY
except Exception:
    ACTION_REGISTRY: dict[str, Any] = {}
    RESPONSE_REGISTRY: dict[str, Any] = {}


try:
    # รองรับโค้ดทีมที่ใช้ response จาก response_helper
    from .registries.response_helper import response
except Exception:

    class _ResponseCompat:
        """
        Compatibility helper สำหรับโค้ดทีมที่เรียก:
            from app.core import response
            raise response.error("CLIENT.ER_CLIENT_2004")
        """

        def error(self, key: str) -> HTTPException:
            group = "BACKEND"
            code = key

            if "." in key:
                group, code = key.split(".", 1)

            entry: dict[str, Any] = {}

            group_data = RESPONSE_REGISTRY.get(group, {})
            if isinstance(group_data, dict):
                entry = group_data.get(code, {}) or {}

            status_code = int(entry.get("http_status", 500))
            error_code = entry.get("error", code)
            message = entry.get(
                "message",
                "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์ กรุณาลองใหม่อีกครั้ง",
            )
            contacts = entry.get("contacts", [])

            return HTTPException(
                status_code=status_code,
                detail={
                    "error": error_code,
                    "message": message,
                    "contacts": contacts,
                },
            )

    response = _ResponseCompat()


__all__ = [
    "Settings",
    "get_settings",
    "settings",
    "engine",
    "SessionLocal",
    "get_db",
    "Base",
    "hash_password",
    "verify_password",
    "create_access_token",
    "ACTION_REGISTRY",
    "RESPONSE_REGISTRY",
    "response",
]