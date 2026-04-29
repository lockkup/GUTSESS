from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.constants import DBConstants
from app.core.orm import Base


class FaceProfileChange(Base):
    __tablename__ = "face_profile_change"

    face_profile_change_id: Mapped[int] = mapped_column(
        BigInteger().with_variant(Integer, "sqlite"),
        primary_key=True,
        autoincrement=True,
    )

    employee_code: Mapped[str] = mapped_column(
        String(DBConstants.EMPLOYEE_CODE_LENGTH),
        ForeignKey("employees.employee_code"),
        nullable=False,
        index=True,
    )

    face_profile_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("face_profiles.face_profile_id"),
        nullable=False,
        index=True,
    )

    user_name: Mapped[str] = mapped_column(
        String(DBConstants.USER_NAME_LENGTH),
        nullable=False,
    )

    action: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.current_timestamp(),
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.current_timestamp(),
        onupdate=func.current_timestamp(),
    )