from __future__ import annotations

from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import exists, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.constants import DBConstants
from app.core.error_messages import (
    EMPLOYEE_NOT_FOUND_DETAIL,
    FACE_PROFILE_CHANGE_NOT_FOUND_DETAIL,
    FACE_PROFILE_NOT_FOUND_DETAIL,
    INVALID_REFERENCE_DETAIL,
)
from app.models.employees import Employees
from app.models.face_profile import FaceProfile
from app.models.face_profile_change import FaceProfileChange
from app.schemas.face_profile_change import FaceProfileChangeCreate


class FaceProfileChangeService:
    @staticmethod
    def _ensure_exists(
        db: Session,
        error_detail: str,
        *conditions: Any,
    ) -> None:
        stmt = select(exists().where(*conditions))

        if not db.scalar(stmt):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=error_detail,
            )

    @staticmethod
    def _validate_references(
        db: Session,
        employee_code: str,
        face_profile_id: int,
    ) -> None:
        FaceProfileChangeService._ensure_exists(
            db,
            EMPLOYEE_NOT_FOUND_DETAIL,
            Employees.employee_code == employee_code,
        )

        FaceProfileChangeService._ensure_exists(
            db,
            FACE_PROFILE_NOT_FOUND_DETAIL,
            FaceProfile.face_profile_id == face_profile_id,
            FaceProfile.employee_code == employee_code,
        )

    @staticmethod
    def create_face_profile_change(
        db: Session,
        payload: FaceProfileChangeCreate,
    ) -> FaceProfileChange:
        FaceProfileChangeService._validate_references(
            db=db,
            employee_code=payload.employee_code,
            face_profile_id=payload.face_profile_id,
        )

        face_profile_change = FaceProfileChange(**payload.model_dump())

        try:
            db.add(face_profile_change)
            db.commit()
            db.refresh(face_profile_change)
        except IntegrityError as exc:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=INVALID_REFERENCE_DETAIL,
            ) from exc

        return face_profile_change

    @staticmethod
    def get_face_profile_change_by_id(
        db: Session,
        face_profile_change_id: int,
    ) -> FaceProfileChange:
        stmt = select(FaceProfileChange).where(
            FaceProfileChange.face_profile_change_id == face_profile_change_id,
        )

        face_profile_change = db.scalar(stmt)

        if face_profile_change is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=FACE_PROFILE_CHANGE_NOT_FOUND_DETAIL,
            )

        return face_profile_change

    @staticmethod
    def get_face_profile_changes(
        db: Session,
        skip: int = DBConstants.DEFAULT_PAGE_SKIP,
        limit: int = DBConstants.DEFAULT_PAGE_LIMIT,
        employee_code: str | None = None,
        face_profile_id: int | None = None,
    ) -> list[FaceProfileChange]:
        stmt = select(FaceProfileChange)

        clean_employee_code = (
            employee_code.strip() if employee_code is not None else None
        )

        if clean_employee_code:
            stmt = stmt.where(
                FaceProfileChange.employee_code == clean_employee_code,
            )

        if face_profile_id is not None:
            stmt = stmt.where(
                FaceProfileChange.face_profile_id == face_profile_id,
            )

        stmt = (
            stmt.order_by(
                FaceProfileChange.created_at.desc(),
                FaceProfileChange.face_profile_change_id.desc(),
            )
            .offset(skip)
            .limit(limit)
        )

        return list(db.scalars(stmt).all())