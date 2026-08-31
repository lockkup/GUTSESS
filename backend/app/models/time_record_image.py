# app/models/time_record_image.py

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    SmallInteger,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.constants import DBConstants
from app.core.orm import Base

if TYPE_CHECKING:
    from app.models.time_record import TimeRecord


class TimeRecordImage(Base):
    __tablename__ = "time_record_image"

    __table_args__ = (
        UniqueConstraint(
            "time_record_id",
            "image_type",
            "sequence_no",
            name="uq_time_record_image_type_sequence",
        ),
        CheckConstraint(
            "sequence_no > 0",
            name="ck_time_record_image_sequence_no_positive",
        ),
        Index(
            "ix_time_record_image_time_record_type",
            "time_record_id",
            "image_type",
        ),
    )

    time_record_image_id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    time_record_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey(
            "time_record.time_record_id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    image_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )

    sequence_no: Mapped[int] = mapped_column(
        SmallInteger,
        nullable=False,
    )

    image_path: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
    )

    created_by: Mapped[str] = mapped_column(
        String(DBConstants.EMPLOYEE_CODE_LENGTH),
        ForeignKey("employees.employee_code"),
        nullable=False,
        index=True,
    )

    time_record: Mapped["TimeRecord"] = relationship(
        "TimeRecord",
        back_populates="images",
    )