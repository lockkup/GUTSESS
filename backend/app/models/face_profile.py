from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text, text
from sqlalchemy.dialects.mysql import LONGTEXT
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.constants import DBConstants
from app.core.orm import Base

if TYPE_CHECKING:
    from app.models.employees import Employees


FACE_EMBEDDING_TYPE = Text().with_variant(LONGTEXT(), "mysql")


class FaceProfile(Base):
    __tablename__ = "face_profiles"
    __table_args__ = (
        Index(
            "ix_face_profiles_employee_active_not_deleted",
            "employee_code",
            "is_active",
            "mark_flag",
        ),
    )

    face_profile_id: Mapped[int] = mapped_column(
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

    reference_image: Mapped[str] = mapped_column(
        String(DBConstants.FACE_REFERENCE_IMAGE_LENGTH),
        nullable=False,
    )

    face_embedding: Mapped[str] = mapped_column(
        FACE_EMBEDDING_TYPE,
        nullable=False,
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

    employee: Mapped["Employees"] = relationship(
        "Employees",
        foreign_keys=[employee_code],
    )

    creator: Mapped["Employees"] = relationship(
        "Employees",
        foreign_keys=[created_by],
    )

    updater: Mapped["Employees | None"] = relationship(
        "Employees",
        foreign_keys=[updated_by],
    )