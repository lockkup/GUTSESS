from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.constants import DBConstants
from app.core.orm import Base


class CheckpointAssignment(Base):
    __tablename__ = "checkpoint_assignment"

    __table_args__ = (
        UniqueConstraint(
            "work_date",
            "schedule_item_id",
            "parent_assignment_key",
            "active_unique_key",
            name="uq_cp_assign_work_item_parent",
        ),
        Index(
            "ix_cp_assign_work_date",
            "work_date",
        ),
    )

    assignment_id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    work_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
    )

    schedule_item_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("checkpoint_schedule_item.schedule_item_id"),
        nullable=False,
        index=True,
    )

    # ใช้เชื่อมงานสายตรวจกับหลักฐานการลงเวลาใน time_record
    # งานที่ยังไม่ได้เช็คอิน หรือเป็นงานที่ไม่ได้ผูก time_record จะเป็น NULL
    time_record_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("time_record.time_record_id"),
        nullable=True,
        index=True,
    )

    parent_assignment_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("checkpoint_assignment.assignment_id"),
        nullable=True,
        index=True,
    )

    parent_assignment_key: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default=text("0"),
        index=True,
    )

    active_unique_key: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default=text("0"),
        index=True,
    )

    recheck_depth: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default=text("0"),
    )

    due_datetime: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )

    assignment_status: Mapped[str] = mapped_column(
        Enum(
            "pending",
            "in_progress",
            "completed",
            "repaired",
            name="checkpoint_assignment_status_enum",
            native_enum=False,
            validate_strings=True,
            length=DBConstants.CHECKPOINT_ASSIGNMENT_STATUS_LENGTH,
        ),
        nullable=False,
        default="pending",
        server_default=text("'pending'"),
    )

    started_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )

    started_by: Mapped[str | None] = mapped_column(
        String(DBConstants.EMPLOYEE_CODE_LENGTH),
        ForeignKey("employees.employee_code"),
        nullable=True,
    )

    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )

    completed_by: Mapped[str | None] = mapped_column(
        String(DBConstants.EMPLOYEE_CODE_LENGTH),
        ForeignKey("employees.employee_code"),
        nullable=True,
    )

    recheck_reason: Mapped[str | None] = mapped_column(
        String(DBConstants.REMARK_LENGTH),
        nullable=True,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default=text("1"),
    )

    mark_flag: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default=text("0"),
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"),
    )

    created_by: Mapped[str] = mapped_column(
        String(DBConstants.EMPLOYEE_CODE_LENGTH),
        ForeignKey("employees.employee_code"),
        nullable=False,
    )

    updated_by: Mapped[str | None] = mapped_column(
        String(DBConstants.EMPLOYEE_CODE_LENGTH),
        ForeignKey("employees.employee_code"),
        nullable=True,
    )