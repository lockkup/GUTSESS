from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.constants import DBConstants
from app.models.employees import Employees
from app.models.face_profile import FaceProfile
from app.models.face_profile_change import FaceProfileChange
from app.schemas.face_profile_change import (
    FaceProfileChangeCreate,
    FaceProfileChangeUpdate,
)


FACE_PROFILE_CHANGE_NOT_FOUND_DETAIL = "Face profile change not found"
EMPLOYEES_NOT_FOUND_DETAIL = "Employees not found"
FACE_PROFILE_NOT_FOUND_DETAIL = "Face profile not found"
INVALID_REFERENCE_DETAIL = "Invalid reference data"


class FaceProfileChangeService:
    @staticmethod
    def _get_employees_by_code(
        db: Session,
        employee_code: str,
    ) -> Employees | None:
        stmt = select(Employees).where(Employees.employee_code == employee_code)
        return db.scalar(stmt)

    @staticmethod
    def _get_face_profile_by_id(
        db: Session,
        face_profile_id: int,
    ) -> FaceProfile | None:
        stmt = select(FaceProfile).where(
            FaceProfile.face_profile_id == face_profile_id,
        )
        return db.scalar(stmt)

    @staticmethod
    def _validate_references(
        db: Session,
        employee_code: str,
        face_profile_id: int,
    ) -> None:
        employees = FaceProfileChangeService._get_employees_by_code(
            db,
            employee_code,
        )
        if employees is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=EMPLOYEES_NOT_FOUND_DETAIL,
            )

        face_profile = FaceProfileChangeService._get_face_profile_by_id(
            db,
            face_profile_id,
        )
        if face_profile is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=FACE_PROFILE_NOT_FOUND_DETAIL,
            )

    @staticmethod
    def create_face_profile_change(
        db: Session,
        payload: FaceProfileChangeCreate,
    ) -> FaceProfileChange:
        employee_code = payload.employee_code.strip()
        user_name = payload.user_name.strip()
        action = payload.action.strip()

        FaceProfileChangeService._validate_references(
            db=db,
            employee_code=employee_code,
            face_profile_id=payload.face_profile_id,
        )

        face_profile_change = FaceProfileChange(
            employee_code=employee_code,
            face_profile_id=payload.face_profile_id,
            user_name=user_name,
            action=action,
        )

        try:
            db.add(face_profile_change)
            db.commit()
            db.refresh(face_profile_change)
        except IntegrityError:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=INVALID_REFERENCE_DETAIL,
            )

        return face_profile_change

    @staticmethod
    def get_face_profile_change_by_id(
        db: Session,
        face_profile_change_id: int,
    ) -> FaceProfileChange | None:
        stmt = select(FaceProfileChange).where(
            FaceProfileChange.face_profile_change_id == face_profile_change_id,
        )
        return db.scalar(stmt)

    @staticmethod
    def get_face_profile_changes(
        db: Session,
        skip: int = 0,
        limit: int = DBConstants.DEFAULT_PAGE_LIMIT,
        employee_code: str | None = None,
        face_profile_id: int | None = None,
    ) -> list[FaceProfileChange]:
        stmt = select(FaceProfileChange)

        clean_employee_code = employee_code.strip() if employee_code is not None else None
        if clean_employee_code:
            stmt = stmt.where(FaceProfileChange.employee_code == clean_employee_code)

        if face_profile_id is not None:
            stmt = stmt.where(FaceProfileChange.face_profile_id == face_profile_id)

        stmt = (
            stmt.order_by(
                FaceProfileChange.updated_at.desc(),
                FaceProfileChange.face_profile_change_id.desc(),
            )
            .offset(skip)
            .limit(limit)
        )

        return list(db.scalars(stmt).all())

    @staticmethod
    def update_face_profile_change(
        db: Session,
        face_profile_change_id: int,
        payload: FaceProfileChangeUpdate,
    ) -> FaceProfileChange | None:
        face_profile_change = FaceProfileChangeService.get_face_profile_change_by_id(
            db,
            face_profile_change_id,
        )
        if face_profile_change is None:
            return None

        update_data = payload.model_dump(exclude_unset=True)

        if "employee_code" in update_data and update_data["employee_code"] is not None:
            update_data["employee_code"] = update_data["employee_code"].strip()

        if "user_name" in update_data and update_data["user_name"] is not None:
            update_data["user_name"] = update_data["user_name"].strip()

        if "action" in update_data and update_data["action"] is not None:
            update_data["action"] = update_data["action"].strip()

        next_employee_code = update_data.get(
            "employee_code",
            face_profile_change.employee_code,
        )
        next_face_profile_id = update_data.get(
            "face_profile_id",
            face_profile_change.face_profile_id,
        )

        FaceProfileChangeService._validate_references(
            db=db,
            employee_code=next_employee_code,
            face_profile_id=next_face_profile_id,
        )

        for field, value in update_data.items():
            setattr(face_profile_change, field, value)

        try:
            db.commit()
            db.refresh(face_profile_change)
        except IntegrityError:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=INVALID_REFERENCE_DETAIL,
            )

        return face_profile_change