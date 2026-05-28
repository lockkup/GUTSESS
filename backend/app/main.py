from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.endpoints import api_router
from app.core import settings
from app.core.database import engine
from app.core.orm import Base
from app.models import (  # noqa: F401
    AuditLog,
    CheckpointAssignment,
    CheckpointAssignmentCall,
    CheckpointAssignmentChange,
    CheckpointSchedule,
    CheckpointScheduleChange,
    CheckpointScheduleItem,
    CheckpointScheduleItemChange,
    Employees,
    FaceProfile,
    FaceProfileChange,
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


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
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


app.include_router(api_router, prefix="/api")