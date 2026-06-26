from __future__ import annotations

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings


engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,

    # MySQL อาจตัด connection ที่ idle นาน
    # ให้ SQLAlchemy recycle connection ก่อนถึงเวลานั้น
    pool_recycle=1800,

    # ใช้ร่วมกันระหว่าง FastAPI และ PDF Worker
    pool_size=10,
    max_overflow=10,

    future=True,
)

SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
    future=True,
)


def get_db() -> Generator[Session, None, None]:
    """
    Dependency สำหรับ FastAPI endpoint
    """

    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()