from __future__ import annotations

from fastapi import HTTPException, status
from fastapi.encoders import jsonable_encoder
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.constants import DBConstants
from app.models.employees import Employees
from app.models.shift import Shift
from app.schemas.shift import ShiftBase, ShiftCreate, ShiftUpdate

SHIFT_NOT_FOUND_DETAIL = "Shift not found"
EMPLOYEE_NOT_FOUND_DETAIL = "Employee not found"
INVALID_REFERENCE_DETAIL = "Invalid reference data"


class ShiftService:
    @staticmethod
    def _commit_and_refresh(db: Session, instance: Shift) -> None:
        """Commit, refresh และ rollback เมื่อเกิด error"""
        try:
            db.commit()
            db.refresh(instance)
        except IntegrityError as e:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=INVALID_REFERENCE_DETAIL,
            ) from e
        except SQLAlchemyError as e:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database error: {str(e)}",
            ) from e

    @staticmethod
    def _get_employee_by_code(
        db: Session,
        employee_code: str,
    ) -> Employees | None:
        stmt = select(Employees).where(Employees.employee_code == employee_code)
        return db.scalar(stmt)

    @staticmethod
    def _validate_employee_reference(
        db: Session,
        employee_code: str,
    ) -> None:
        employee_code = employee_code.strip()

        employee = ShiftService._get_employee_by_code(db, employee_code)
        if employee is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=EMPLOYEE_NOT_FOUND_DETAIL,
            )

    @staticmethod
    def create_shift(
        db: Session,
        payload: ShiftCreate,
    ) -> Shift:
        data = payload.model_dump()

        data["shift_name_en"] = data["shift_name_en"].strip()
        data["shift_name_th"] = data["shift_name_th"].strip()
        data["created_by"] = data["created_by"].strip()

        ShiftService._validate_employee_reference(db, data["created_by"])

        shift = Shift(**data)

        if shift.mark_flag is None:
            shift.mark_flag = False

        db.add(shift)
        ShiftService._commit_and_refresh(db, shift)

        return shift

    @staticmethod
    def get_shifts(
        db: Session,
        skip: int = 0,
        limit: int = DBConstants.DEFAULT_PAGE_LIMIT,
        is_active: bool | None = None,
        include_deleted: bool = False,
    ) -> list[Shift]:
        stmt = select(Shift)

        if not include_deleted:
            stmt = stmt.where(Shift.mark_flag.is_(False))

        if is_active is not None:
            stmt = stmt.where(Shift.is_active == is_active)

        stmt = stmt.order_by(Shift.shift_id.asc()).offset(skip).limit(limit)

        return list(db.scalars(stmt).all())

    @staticmethod
    def get_shift_by_id(
        db: Session,
        shift_id: int,
        include_deleted: bool = False,
    ) -> Shift | None:
        stmt = select(Shift).where(Shift.shift_id == shift_id)

        if not include_deleted:
            stmt = stmt.where(Shift.mark_flag.is_(False))

        return db.scalar(stmt)

    @staticmethod
    def update_shift(
        db: Session,
        shift_id: int,
        payload: ShiftUpdate,
    ) -> Shift | None:
        shift = ShiftService.get_shift_by_id(
            db=db,
            shift_id=shift_id,
            include_deleted=False,
        )
        if shift is None:
            return None

        update_data = payload.model_dump(exclude_unset=True)

        if "shift_name_en" in update_data and update_data["shift_name_en"] is not None:
            update_data["shift_name_en"] = update_data["shift_name_en"].strip()

        if "shift_name_th" in update_data and update_data["shift_name_th"] is not None:
            update_data["shift_name_th"] = update_data["shift_name_th"].strip()

        if "updated_by" in update_data and update_data["updated_by"] is not None:
            update_data["updated_by"] = update_data["updated_by"].strip()
            ShiftService._validate_employee_reference(db, update_data["updated_by"])

        validation_data = {
            "shift_name_en": update_data.get("shift_name_en", shift.shift_name_en),
            "shift_name_th": update_data.get("shift_name_th", shift.shift_name_th),
            "start_time": update_data.get("start_time", shift.start_time),
            "end_time": update_data.get("end_time", shift.end_time),
            "crosses_midnight": update_data.get(
                "crosses_midnight",
                shift.crosses_midnight,
            ),
            "break_minutes": update_data.get("break_minutes", shift.break_minutes),
            "work_minutes": update_data.get("work_minutes", shift.work_minutes),
            "grace_in_minutes": update_data.get(
                "grace_in_minutes",
                shift.grace_in_minutes,
            ),
            "grace_out_minutes": update_data.get(
                "grace_out_minutes",
                shift.grace_out_minutes,
            ),
            "checkin_open_before_minutes": update_data.get(
                "checkin_open_before_minutes",
                shift.checkin_open_before_minutes,
            ),
            "checkin_open_after_minutes": update_data.get(
                "checkin_open_after_minutes",
                shift.checkin_open_after_minutes,
            ),
            "checkout_open_before_minutes": update_data.get(
                "checkout_open_before_minutes",
                shift.checkout_open_before_minutes,
            ),
            "checkout_open_after_minutes": update_data.get(
                "checkout_open_after_minutes",
                shift.checkout_open_after_minutes,
            ),
            "is_active": update_data.get("is_active", shift.is_active),
            "effective_from": update_data.get(
                "effective_from",
                shift.effective_from,
            ),
            "effective_to": update_data.get("effective_to", shift.effective_to),
        }

        try:
            ShiftBase(**validation_data)
        except ValidationError as e:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=jsonable_encoder(e.errors()),
            ) from e

        for field, value in update_data.items():
            setattr(shift, field, value)

        ShiftService._commit_and_refresh(db, shift)

        return shift

    @staticmethod
    def deactivate_shift(
        db: Session,
        shift_id: int,
        updated_by: str,
    ) -> Shift | None:
        shift = ShiftService.get_shift_by_id(
            db=db,
            shift_id=shift_id,
            include_deleted=False,
        )
        if shift is None:
            return None

        updated_by = updated_by.strip()
        ShiftService._validate_employee_reference(db, updated_by)

        shift.is_active = False
        shift.updated_by = updated_by

        ShiftService._commit_and_refresh(db, shift)

        return shift

    @staticmethod
    def activate_shift(
        db: Session,
        shift_id: int,
        updated_by: str,
    ) -> Shift | None:
        shift = ShiftService.get_shift_by_id(
            db=db,
            shift_id=shift_id,
            include_deleted=False,
        )
        if shift is None:
            return None

        updated_by = updated_by.strip()
        ShiftService._validate_employee_reference(db, updated_by)

        shift.is_active = True
        shift.updated_by = updated_by

        ShiftService._commit_and_refresh(db, shift)

        return shift

    @staticmethod
    def delete_shift(
        db: Session,
        shift_id: int,
        updated_by: str,
    ) -> Shift | None:
        shift = ShiftService.get_shift_by_id(
            db=db,
            shift_id=shift_id,
            include_deleted=False,
        )
        if shift is None:
            return None

        updated_by = updated_by.strip()
        ShiftService._validate_employee_reference(db, updated_by)

        shift.mark_flag = True
        shift.is_active = False
        shift.updated_by = updated_by

        ShiftService._commit_and_refresh(db, shift)

        return shift