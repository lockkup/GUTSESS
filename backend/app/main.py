# backend/app/main.py
from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware

from app.api.endpoints import api_router
from app.core import settings
from app.core.audit_logger import clear_audit_context, set_audit_context
from app.core.db.error_handler import DatabaseErrorMiddleware
from app.models import (  # noqa: F401
    AuditLog,
    CheckpointAssignment,
    CheckpointAssignmentCall,
    CheckpointAssignmentChange,
    CheckpointSchedule,
    CheckpointScheduleChange,
    CheckpointScheduleItem,
    CheckpointScheduleItemChange,
    Department,
    EmployeePermission,
    Employees,
    FaceProfile,
    FaceProfileChange,
    NamePrefix,
    Position,
    Role,
    Route,
    RouteSiteLocation,
    RouteSiteLocationChange,
    Shift,
    ShiftChange,
    SiteLocation,
    SiteLocationChange,
    TimeRecord,
)


def parse_allowed_origins(origin_value: str | None) -> list[str]:
    if not origin_value:
        return []

    return [origin.strip() for origin in origin_value.split(",") if origin.strip()]


class AuditContextMiddleware(BaseHTTPMiddleware):
    """
    Inject audit context so audit.action() / audit.error()
    can work without repeating request params everywhere.
    """

    async def dispatch(self, request: Request, call_next):
        set_audit_context(request=request, user_name="SYSTEM")

        try:
            response = await call_next(request)
            return response
        finally:
            clear_audit_context()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ============================================================
    # ตาราง MySQL ถูกสร้างไว้แล้วโดยทีม
    # ดังนั้นไม่ต้องให้ backend create table เองตอน start
    #
    # ถ้าเปิดบรรทัดนี้ไว้ และ model มี ForeignKey ไปยังตารางที่ยังไม่มี
    # ใน SQLAlchemy metadata เช่น fields.field_id อาจทำให้ startup error ได้
    # ============================================================

    # Base.metadata.create_all(bind=engine)

    yield


app = FastAPI(
    title=settings.APP_NAME,
    lifespan=lifespan,
)

allowed_origins = parse_allowed_origins(settings.FRONTEND_ORIGIN)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inject audit context for endpoints
app.add_middleware(AuditContextMiddleware)

# Catch DB errors globally and return consistent JSON error format
app.add_middleware(DatabaseErrorMiddleware)


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
    )


BASE_DIR = Path(__file__).resolve().parent.parent
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")


@app.get("/")
def root() -> dict[str, str]:
    return {"message": f"{settings.APP_NAME} is running"}


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/health")
def api_health_check() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(api_router, prefix="/api")