from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    Boolean,
    Computed,
    DateTime,
    ForeignKey,
    Integer,
    SmallInteger,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.mysql import SMALLINT as MySQLSmallInteger
from sqlalchemy.orm import Mapped, mapped_column

from app.core.constants import DBConstants
from app.core.orm import Base


UnsignedSmallInteger = SmallInteger().with_variant(
    MySQLSmallInteger(unsigned=True),
    "mysql",
)


class CheckpointScheduleItem(Base):
    __tablename__ = "checkpoint_schedule_item"

    __table_args__ = (
        UniqueConstraint(
            "shift_id",
            "active_route_site_location_id",
            name="uq_checkpoint_schedule_item_active_shift_location",
        ),
        UniqueConstraint(
            "shift_id",
            "active_sequence_no",
            name="uq_checkpoint_schedule_item_active_shift_sequence",
        ),
    )

    schedule_item_id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    shift_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("shifts.shift_id"),
        nullable=False,
    )

    route_site_location_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("route_site_location.route_site_location_id"),
        nullable=False,
    )

    sequence_no: Mapped[int] = mapped_column(
        UnsignedSmallInteger,
        nullable=False,
        default=1,
        server_default=text("1"),
    )

    plan_day: Mapped[int] = mapped_column(
        UnsignedSmallInteger,
        nullable=False,
    )

    require_call: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default=text("0"),
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

    active_route_site_location_id: Mapped[int | None] = mapped_column(
        Integer,
        Computed(
            "CASE WHEN mark_flag = 0 THEN route_site_location_id ELSE NULL END",
            persisted=True,
        ),
        nullable=True,
    )

    active_sequence_no: Mapped[int | None] = mapped_column(
        Integer,
        Computed(
            "CASE WHEN mark_flag = 0 THEN sequence_no ELSE NULL END",
            persisted=True,
        ),
        nullable=True,
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