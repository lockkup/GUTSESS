# backend/app/core/db/engine.py
from __future__ import annotations

from contextlib import contextmanager
from typing import Generator

from sqlalchemy.orm import Session

from app.core.orm import Base

try:
    from app.core.database import get_db as _project_get_db
except ImportError:
    from app.core.orm import get_db as _project_get_db

try:
    from app.core.database import engine
except ImportError:
    try:
        from app.core.orm import engine
    except ImportError:
        engine = None


def get_db() -> Generator[Session, None, None]:
    """
    Wrapper สำหรับโค้ดของทีมที่ import:
    from app.core.db.engine import get_db

    ใช้ get_db เดิมของโปรเจกต์เรา ไม่สร้าง engine ใหม่
    """
    yield from _project_get_db()


@contextmanager
def get_session() -> Generator[Session, None, None]:
    """
    Wrapper สำหรับโค้ดของทีมที่ใช้:

    with get_session() as session:
        ...

    ใช้ session จาก get_db เดิมของโปรเจกต์เรา
    """
    db_generator = _project_get_db()
    db = next(db_generator)

    try:
        yield db
    finally:
        db_generator.close()


__all__ = [
    "Base",
    "engine",
    "get_db",
    "get_session",
]