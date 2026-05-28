from __future__ import annotations

from typing import Any, Final

from fastapi import HTTPException, status
from fastapi.encoders import jsonable_encoder
from pydantic import ValidationError
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.constants import DBConstants
from app.core.error_messages import (
    DATABASE_ERROR_DETAIL,
    DUPLICATE_SHIFT_DETAIL,
    EMPLOYEE_NOT_FOUND_DETAIL,
    INVALID_REFERENCE_DETAIL,
    SHIFT_NOT_FOUND_DETAIL,
)
from app.models.employees import Employees
from app.models.shift import Shift
from app.schemas.shift import ShiftBase, ShiftCreate, ShiftUpdate


SHIFT_BUSINESS_FIELDS: Final[tuple[str, ...]] = (
    "shift_name_en",
    "shift_name_th",
    "start_time",
    "end_time",
    "crosses_midnight",
    "break_minutes",
    "work_minutes",
    "grace_in_minutes",
    "grace_out_minutes",
    "checkin_open_before_minutes",
    "checkin_open_after_minutes",
    "checkout_open_before_minutes",
    "checkout_open_after_minutes",
    "is_active",
    "effective_from",
    "effective_to",
)


class ShiftService:
    @staticmethod
    def _commit_and_refresh(db: Session, instance: Shift) -> None:
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
                detail=DATABASE_ERROR_DETAIL,
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
    ) -> str:
        normalized_employee_code = employee_code.strip()

        employee = ShiftService._get_employee_by_code(
            db=db,
            employee_code=normalized_employee_code,
        )
        if employee is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=EMPLOYEE_NOT_FOUND_DETAIL,
            )

        return normalized_employee_code

    @staticmethod
    def _get_shift(
        db: Session,
        shift_id: int,
        include_deleted: bool = False,
    ) -> Shift | None:
        stmt = select(Shift).where(Shift.shift_id == shift_id)

        if not include_deleted:
            stmt = stmt.where(Shift.mark_flag.is_(False))

        return db.scalar(stmt)

    @staticmethod
    def _get_shift_or_404(
        db: Session,
        shift_id: int,
        include_deleted: bool = False,
    ) -> Shift:
        shift = ShiftService._get_shift(
            db=db,
            shift_id=shift_id,
            include_deleted=include_deleted,
        )
        if shift is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=SHIFT_NOT_FOUND_DETAIL,
            )

        return shift

    @staticmethod
    def _validate_shift_data(data: dict[str, Any]) -> None:
        try:
            ShiftBase(**data)
        except ValidationError as e:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=jsonable_encoder(e.errors()),
            ) from e

    @staticmethod
    def _build_shift_validation_data(
        shift: Shift,
        update_data: dict[str, Any],
    ) -> dict[str, Any]:
        return {
            field: update_data.get(field, getattr(shift, field))
            for field in SHIFT_BUSINESS_FIELDS
        }

    @staticmethod
    def _ensure_not_duplicate(
        db: Session,
        data: dict[str, Any],
        exclude_shift_id: int | None = None,
    ) -> None:
        stmt = select(Shift).where(
            Shift.mark_flag.is_(False),
            or_(
                Shift.shift_name_en == data["shift_name_en"],
                Shift.shift_name_th == data["shift_name_th"],
            ),
            or_(
                Shift.effective_to.is_(None),
                Shift.effective_to >= data["effective_from"],
            ),
        )

        if data["effective_to"] is not None:
            stmt = stmt.where(Shift.effective_from <= data["effective_to"])

        if exclude_shift_id is not None:
            stmt = stmt.where(Shift.shift_id != exclude_shift_id)

        existing_shift = db.scalar(stmt)
        if existing_shift is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=DUPLICATE_SHIFT_DETAIL,
            )

    @staticmethod
    def _update_fields(
        instance: Shift,
        data: dict[str, Any],
    ) -> None:
        for field, value in data.items():
            setattr(instance, field, value)

    @staticmethod
    def _set_shift_flags(
        db: Session,
        shift_id: int,
        updated_by: str,
        *,
        is_active: bool | None = None,
        mark_flag: bool | None = None,
    ) -> Shift:
        normalized_updated_by = ShiftService._validate_employee_reference(
            db=db,
            employee_code=updated_by,
        )

        shift = ShiftService._get_shift_or_404(
            db=db,
            shift_id=shift_id,
            include_deleted=False,
        )

        if is_active is not None:
            shift.is_active = is_active

        if mark_flag is not None:
            shift.mark_flag = mark_flag

        shift.updated_by = normalized_updated_by

        ShiftService._commit_and_refresh(db, shift)

        return shift

    @staticmethod
    def create_shift(
        db: Session,
        payload: ShiftCreate,
    ) -> Shift:
        data = payload.model_dump()
        data["created_by"] = ShiftService._validate_employee_reference(
            db=db,
            employee_code=data["created_by"],
        )

        ShiftService._validate_shift_data(
            {field: data[field] for field in SHIFT_BUSINESS_FIELDS}
        )
        ShiftService._ensure_not_duplicate(
            db=db,
            data=data,
        )

        shift = Shift(**data)

        db.add(shift)
        ShiftService._commit_and_refresh(db, shift)

        return shift

    @staticmethod
    def get_shifts(
        db: Session,
        skip: int = DBConstants.DEFAULT_PAGE_SKIP,
        limit: int = DBConstants.DEFAULT_PAGE_LIMIT,
        is_active: bool | None = None,
        include_deleted: bool = False,
    ) -> list[Shift]:
        stmt = select(Shift)

        if not include_deleted:
            stmt = stmt.where(Shift.mark_flag.is_(False))

        if is_active is not None:
            stmt = stmt.where(Shift.is_active.is_(is_active))

        stmt = stmt.order_by(Shift.shift_id.asc()).offset(skip).limit(limit)

        return list(db.scalars(stmt).all())

    @staticmethod
    def get_shift_by_id(
        db: Session,
        shift_id: int,
        include_deleted: bool = False,
    ) -> Shift:
        return ShiftService._get_shift_or_404(
            db=db,
            shift_id=shift_id,
            include_deleted=include_deleted,
        )

    @staticmethod
    def update_shift(
        db: Session,
        shift_id: int,
        payload: ShiftUpdate,
    ) -> Shift:
        update_data = payload.model_dump(exclude_unset=True)

        update_data["updated_by"] = ShiftService._validate_employee_reference(
            db=db,
            employee_code=update_data["updated_by"],
        )

        shift = ShiftService._get_shift_or_404(
            db=db,
            shift_id=shift_id,
            include_deleted=False,
        )

        validation_data = ShiftService._build_shift_validation_data(
            shift=shift,
            update_data=update_data,
        )
        ShiftService._validate_shift_data(validation_data)
        ShiftService._ensure_not_duplicate(
            db=db,
            data=validation_data,
            exclude_shift_id=shift_id,
        )

        ShiftService._update_fields(
            instance=shift,
            data=update_data,
        )

        ShiftService._commit_and_refresh(db, shift)

        return shift

    @staticmethod
    def deactivate_shift(
        db: Session,
        shift_id: int,
        updated_by: str,
    ) -> Shift:
        return ShiftService._set_shift_flags(
            db=db,
            shift_id=shift_id,
            updated_by=updated_by,
            is_active=False,
        )

    @staticmethod
    def activate_shift(
        db: Session,
        shift_id: int,
        updated_by: str,
    ) -> Shift:
        return ShiftService._set_shift_flags(
            db=db,
            shift_id=shift_id,
            updated_by=updated_by,
            is_active=True,
        )

    @staticmethod
    def delete_shift(
        db: Session,
        shift_id: int,
        updated_by: str,
    ) -> Shift:
        return ShiftService._set_shift_flags(
            db=db,
            shift_id=shift_id,
            updated_by=updated_by,
            is_active=False,
            mark_flag=True,
        )