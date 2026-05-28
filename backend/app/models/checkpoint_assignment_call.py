from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.mysql import TINYINT
from sqlalchemy.orm import Mapped, mapped_column

from app.core.constants import DBConstants
from app.core.orm import Base


CALL_STATUS_TYPE = Integer().with_variant(TINYINT(), "mysql")


class CheckpointAssignmentCall(Base):
    __tablename__ = "checkpoint_assignment_call"

    __table_args__ = (
        UniqueConstraint(
            "assignment_id",
            name="uq_checkpoint_assignment_call_assignment_id",
        ),
        CheckConstraint(
            "call_status IN (1, 2, 3)",
            name="ck_checkpoint_assignment_call_status",
        ),
    )

    assignment_call_id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    assignment_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("checkpoint_assignment.assignment_id"),
        nullable=False,
    )

    call_datetime: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
    )

    contact_detail: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    # 1=ปกติไม่ต้องเข้าหน้างาน
    # 2=ผิดปกติไม่ต้องเข้าหน้างาน
    # 3=ผิดปกติต้องเข้าหน้างาน
    call_status: Mapped[int] = mapped_column(
        CALL_STATUS_TYPE,
        nullable=False,
    )

    call_note: Mapped[str | None] = mapped_column(
        Text,
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
        index=True,
    )

    updated_by: Mapped[str | None] = mapped_column(
        String(DBConstants.EMPLOYEE_CODE_LENGTH),
        ForeignKey("employees.employee_code"),
        nullable=True,
        index=True,
    )