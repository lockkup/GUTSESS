# backend/app/core/db/error_handler.py
from __future__ import annotations

from typing import Any

from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse
from sqlalchemy.exc import (
    DBAPIError,
    DataError,
    DatabaseError,
    IntegrityError,
    InterfaceError,
    OperationalError,
    SQLAlchemyError,
)
from sqlalchemy.exc import TimeoutError as SQLTimeoutError
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.audit_logger import audit

try:
    from app.core.registries import RESPONSE_REGISTRY
except Exception:
    RESPONSE_REGISTRY: dict[str, Any] = {}


def _get_entry(
    group: str,
    code: str,
    *,
    fallback_status: int,
    fallback_error: str,
    fallback_message: str,
) -> dict[str, Any]:
    group_data = RESPONSE_REGISTRY.get(group, {})

    if isinstance(group_data, dict):
        entry = group_data.get(code)
        if isinstance(entry, dict):
            return {
                "http_status": entry.get("http_status", fallback_status),
                "error": entry.get("error", fallback_error),
                "message": entry.get("message", fallback_message),
                "contacts": entry.get("contacts", []),
            }

    return {
        "http_status": fallback_status,
        "error": fallback_error,
        "message": fallback_message,
        "contacts": [],
    }


def _json_error(entry: dict[str, Any]) -> JSONResponse:
    return JSONResponse(
        status_code=int(entry.get("http_status", 500)),
        content={
            "detail": {
                "error": entry.get("error", "UNKNOWN_ERROR"),
                "message": entry.get("message", "เกิดข้อผิดพลาด"),
                "contacts": entry.get("contacts", []),
            }
        },
    )


def _audit_error(
    group: str,
    code: str,
    request: Request,
    detail: str,
) -> None:
    try:
        audit.error(
            group,
            code,
            request=request,
            user_name="SYSTEM",
            detail=detail,
        )
    except Exception:
        # ห้ามให้ audit log ทำให้ middleware พังซ้ำ
        pass


class DatabaseErrorMiddleware(BaseHTTPMiddleware):
    """
    Middleware สำหรับจับ database/runtime error
    แล้วแปลงเป็น response format เดียวกับระบบ login ของทีม

    วิธีใช้ใน main.py:
        app.add_middleware(DatabaseErrorMiddleware)
    """

    async def dispatch(self, request: Request, call_next):
        try:
            return await call_next(request)

        except HTTPException:
            # HTTPException จาก endpoint ให้ FastAPI จัดการเอง
            raise

        except (OperationalError, InterfaceError, DBAPIError, DatabaseError) as error:
            error_msg = str(error).lower()

            if "timeout" in error_msg or "timed out" in error_msg:
                entry = _get_entry(
                    "DB",
                    "ER_DB_501",
                    fallback_status=503,
                    fallback_error="ER_DB_501",
                    fallback_message="ไม่สามารถเชื่อมต่อฐานข้อมูลได้ กรุณาลองใหม่อีกครั้ง",
                )

                _audit_error(
                    "DB",
                    "ER_DB_501",
                    request,
                    "Database timeout during request",
                )

                return _json_error(entry)

            if "1129" in error_msg or "blocked" in error_msg:
                entry = _get_entry(
                    "DB",
                    "ER_DB_502",
                    fallback_status=503,
                    fallback_error="ER_DB_502",
                    fallback_message="ฐานข้อมูลบล็อกการเชื่อมต่อจากเครื่องนี้ กรุณาติดต่อผู้ดูแลระบบ",
                )

                _audit_error(
                    "DB",
                    "ER_DB_502",
                    request,
                    "Host blocked by MySQL due to connection errors",
                )

                return _json_error(entry)

            entry = _get_entry(
                "DB",
                "ER_DB_501",
                fallback_status=503,
                fallback_error="ER_DB_501",
                fallback_message="ไม่สามารถเชื่อมต่อฐานข้อมูลได้ กรุณาลองใหม่อีกครั้ง",
            )

            _audit_error(
                "DB",
                "ER_DB_501",
                request,
                "Database connection failed",
            )

            return _json_error(entry)

        except IntegrityError as error:
            error_msg = str(error).lower()

            if "duplicate" in error_msg or "unique" in error_msg:
                entry = _get_entry(
                    "CLIENT",
                    "ER_CLIENT_2004",
                    fallback_status=409,
                    fallback_error="ER_CLIENT_2004",
                    fallback_message="ข้อมูลซ้ำในระบบ",
                )

                _audit_error(
                    "CLIENT",
                    "ER_CLIENT_2004",
                    request,
                    "Duplicate entry detected",
                )

                return _json_error(entry)

            entry = _get_entry(
                "DB",
                "ER_DB_6061",
                fallback_status=400,
                fallback_error="ER_DB_6061",
                fallback_message="ข้อมูลอ้างอิงไม่ถูกต้อง หรือผิดเงื่อนไขฐานข้อมูล",
            )

            _audit_error(
                "DB",
                "ER_DB_6061",
                request,
                "Data integrity violation",
            )

            return _json_error(entry)

        except DataError:
            entry = _get_entry(
                "DB",
                "ER_DB_6060",
                fallback_status=400,
                fallback_error="ER_DB_6060",
                fallback_message="รูปแบบข้อมูลไม่ถูกต้อง หรือไม่สามารถประมวลผล query ได้",
            )

            _audit_error(
                "DB",
                "ER_DB_6060",
                request,
                "Database query execution failed",
            )

            return _json_error(entry)

        except SQLTimeoutError:
            entry = _get_entry(
                "DB",
                "ER_DB_501",
                fallback_status=503,
                fallback_error="ER_DB_501",
                fallback_message="ฐานข้อมูลตอบสนองช้าเกินไป กรุณาลองใหม่อีกครั้ง",
            )

            _audit_error(
                "DB",
                "ER_DB_501",
                request,
                "Database operation timeout",
            )

            return _json_error(entry)

        except SQLAlchemyError:
            entry = _get_entry(
                "DB",
                "ER_DB_6060",
                fallback_status=500,
                fallback_error="ER_DB_6060",
                fallback_message="เกิดข้อผิดพลาดจากฐานข้อมูล",
            )

            _audit_error(
                "DB",
                "ER_DB_6060",
                request,
                "SQLAlchemy unexpected error",
            )

            return _json_error(entry)

        except Exception as error:
            entry = _get_entry(
                "BACKEND",
                "ER_BACKEND_3001",
                fallback_status=500,
                fallback_error="ER_BACKEND_3001",
                fallback_message="เกิดข้อผิดพลาดที่เซิร์ฟเวอร์ กรุณาลองใหม่อีกครั้ง",
            )

            _audit_error(
                "BACKEND",
                "ER_BACKEND_3001",
                request,
                f"Unexpected error: {str(error)[:100]}",
            )

            return _json_error(entry)