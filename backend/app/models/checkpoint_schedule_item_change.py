from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.constants import DBConstants
from app.core.orm import Base


class CheckpointScheduleItemChange(Base):
    __tablename__ = "checkpoint_schedule_item_change"

    checkpoint_schedule_item_change_id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    employee_code: Mapped[str] = mapped_column(
        String(DBConstants.EMPLOYEE_CODE_LENGTH),
        ForeignKey("employees.employee_code"),
        nullable=False,
        index=True,
    )

    schedule_item_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("checkpoint_schedule_item.schedule_item_id"),
        nullable=False,
        index=True,
    )

    user_name: Mapped[str] = mapped_column(
        String(DBConstants.USER_NAME_LENGTH),
        nullable=False,
    )

    action: Mapped[str] = mapped_column(
        String(DBConstants.CHECKPOINT_SCHEDULE_ITEM_CHANGE_ACTION_LENGTH),
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
    )