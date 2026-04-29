from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.constants import DBConstants
from app.models.employees import Employees
from app.models.shift import Shift
from app.models.shift_change import ShiftChange
from app.schemas.shift_change import ShiftChangeCreate, ShiftChangeUpdate


SHIFT_CHANGE_NOT_FOUND_DETAIL = "Shift change not found"
EMPLOYEE_NOT_FOUND_DETAIL = "Employee not found"
SHIFT_NOT_FOUND_DETAIL = "Shift not found"
INVALID_REFERENCE_DETAIL = "Invalid reference data"


class ShiftChangeService:
    @staticmethod
    def _get_employee_by_code(
        db: Session,
        employee_code: str,
    ) -> Employees | None:
        stmt = select(Employees).where(Employees.employee_code == employee_code)
        return db.scalar(stmt)

    @staticmethod
    def _get_shift_by_id(
        db: Session,
        shift_id: int,
    ) -> Shift | None:
        stmt = select(Shift).where(Shift.shift_id == shift_id)
        return db.scalar(stmt)

    @staticmethod
    def _validate_references(
        db: Session,
        employee_code: str,
        shift_id: int,
    ) -> None:
        employee = ShiftChangeService._get_employee_by_code(db, employee_code)
        if employee is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=EMPLOYEE_NOT_FOUND_DETAIL,
            )

        shift = ShiftChangeService._get_shift_by_id(db, shift_id)
        if shift is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=SHIFT_NOT_FOUND_DETAIL,
            )

    @staticmethod
    def create_shift_change(
        db: Session,
        payload: ShiftChangeCreate,
    ) -> ShiftChange:
        employee_code = payload.employee_code.strip()
        user_name = payload.user_name.strip()
        action = payload.action.strip()

        ShiftChangeService._validate_references(
            db=db,
            employee_code=employee_code,
            shift_id=payload.shift_id,
        )

        shift_change = ShiftChange(
            employee_code=employee_code,
            shift_id=payload.shift_id,
            user_name=user_name,
            action=action,
        )

        try:
            db.add(shift_change)
            db.commit()
            db.refresh(shift_change)
        except IntegrityError:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=INVALID_REFERENCE_DETAIL,
            )

        return shift_change

    @staticmethod
    def get_shift_change_by_id(
        db: Session,
        shift_change_id: int,
    ) -> ShiftChange | None:
        stmt = select(ShiftChange).where(
            ShiftChange.shift_change_id == shift_change_id,
        )
        return db.scalar(stmt)

    @staticmethod
    def get_shift_changes(
        db: Session,
        skip: int = 0,
        limit: int = DBConstants.DEFAULT_PAGE_LIMIT,
        employee_code: str | None = None,
        shift_id: int | None = None,
    ) -> list[ShiftChange]:
        stmt = select(ShiftChange)

        clean_employee_code = employee_code.strip() if employee_code is not None else None
        if clean_employee_code:
            stmt = stmt.where(ShiftChange.employee_code == clean_employee_code)

        if shift_id is not None:
            stmt = stmt.where(ShiftChange.shift_id == shift_id)

        stmt = (
            stmt.order_by(
                ShiftChange.updated_at.desc(),
                ShiftChange.shift_change_id.desc(),
            )
            .offset(skip)
            .limit(limit)
        )

        return list(db.scalars(stmt).all())

    @staticmethod
    def update_shift_change(
        db: Session,
        shift_change_id: int,
        payload: ShiftChangeUpdate,
    ) -> ShiftChange | None:
        shift_change = ShiftChangeService.get_shift_change_by_id(db, shift_change_id)
        if shift_change is None:
            return None

        update_data = payload.model_dump(exclude_unset=True)

        if "employee_code" in update_data and update_data["employee_code"] is not None:
            update_data["employee_code"] = update_data["employee_code"].strip()

        if "user_name" in update_data and update_data["user_name"] is not None:
            update_data["user_name"] = update_data["user_name"].strip()

        if "action" in update_data and update_data["action"] is not None:
            update_data["action"] = update_data["action"].strip()

        next_employee_code = update_data.get("employee_code", shift_change.employee_code)
        next_shift_id = update_data.get("shift_id", shift_change.shift_id)

        ShiftChangeService._validate_references(
            db=db,
            employee_code=next_employee_code,
            shift_id=next_shift_id,
        )

        for field, value in update_data.items():
            setattr(shift_change, field, value)

        try:
            db.commit()
            db.refresh(shift_change)
        except IntegrityError:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=INVALID_REFERENCE_DETAIL,
            )

        return shift_change