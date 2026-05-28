from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import exists, select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.constants import DBConstants
from app.core.error_messages import (
    DATABASE_ERROR_DETAIL,
    EMPLOYEE_NOT_FOUND_DETAIL,
    INVALID_REFERENCE_DETAIL,
    SHIFT_CHANGE_NOT_FOUND_DETAIL,
    SHIFT_NOT_FOUND_DETAIL,
)
from app.models.employees import Employees
from app.models.shift import Shift
from app.models.shift_change import ShiftChange
from app.schemas.shift_change import ShiftChangeCreate


class ShiftChangeService:
    @staticmethod
    def _get_employee_or_404(
        db: Session,
        employee_code: str,
    ) -> Employees:
        normalized_employee_code = employee_code.strip()

        stmt = select(Employees).where(
            Employees.employee_code == normalized_employee_code,
        )

        employee = db.scalar(stmt)

        if employee is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=EMPLOYEE_NOT_FOUND_DETAIL,
            )

        return employee

    @staticmethod
    def _ensure_shift_exists(
        db: Session,
        shift_id: int,
    ) -> None:
        stmt = select(
            exists().where(
                Shift.shift_id == shift_id,
            ),
        )

        if not db.scalar(stmt):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=SHIFT_NOT_FOUND_DETAIL,
            )

    @staticmethod
    def _build_user_name(employee: Employees) -> str:
        user_name = getattr(employee, "user_name", None)

        if isinstance(user_name, str) and user_name.strip():
            return user_name.strip()

        first_name = getattr(employee, "first_name", "") or ""
        last_name = getattr(employee, "last_name", "") or ""

        full_name = f"{first_name} {last_name}".strip()

        if full_name:
            return full_name

        return employee.employee_code

    @staticmethod
    def create_shift_change(
        db: Session,
        payload: ShiftChangeCreate,
        *,
        commit: bool = True,
    ) -> ShiftChange:
        """
        ใช้สำหรับให้ service อื่นเรียกสร้างประวัติเท่านั้น
        ไม่ควรเปิดเป็น public POST endpoint จาก frontend โดยตรง

        ถ้าต้องการให้ shift และ shift_change อยู่ใน transaction เดียวกัน
        ให้ service หลักเรียกด้วย commit=False แล้ว commit ที่ service หลัก
        """

        normalized_employee_code = payload.employee_code.strip()

        employee = ShiftChangeService._get_employee_or_404(
            db=db,
            employee_code=normalized_employee_code,
        )

        ShiftChangeService._ensure_shift_exists(
            db=db,
            shift_id=payload.shift_id,
        )

        shift_change = ShiftChange(
            employee_code=normalized_employee_code,
            shift_id=payload.shift_id,
            user_name=ShiftChangeService._build_user_name(employee),
            action=payload.action.value,
        )

        try:
            db.add(shift_change)

            if commit:
                db.commit()
                db.refresh(shift_change)
            else:
                db.flush()
        except IntegrityError as exc:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=INVALID_REFERENCE_DETAIL,
            ) from exc
        except SQLAlchemyError as exc:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=DATABASE_ERROR_DETAIL,
            ) from exc

        return shift_change

    @staticmethod
    def get_shift_changes(
        db: Session,
        skip: int = DBConstants.DEFAULT_PAGE_SKIP,
        limit: int = DBConstants.DEFAULT_PAGE_LIMIT,
        employee_code: str | None = None,
        shift_id: int | None = None,
    ) -> list[ShiftChange]:
        stmt = select(ShiftChange)

        clean_employee_code = (
            employee_code.strip()
            if employee_code is not None
            else None
        )

        if clean_employee_code:
            stmt = stmt.where(
                ShiftChange.employee_code == clean_employee_code,
            )

        if shift_id is not None:
            stmt = stmt.where(
                ShiftChange.shift_id == shift_id,
            )

        stmt = (
            stmt.order_by(
                ShiftChange.created_at.desc(),
                ShiftChange.shift_change_id.desc(),
            )
            .offset(skip)
            .limit(limit)
        )

        return list(db.scalars(stmt).all())

    @staticmethod
    def get_shift_change_by_id(
        db: Session,
        shift_change_id: int,
    ) -> ShiftChange:
        stmt = select(ShiftChange).where(
            ShiftChange.shift_change_id == shift_change_id,
        )

        shift_change = db.scalar(stmt)

        if shift_change is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=SHIFT_CHANGE_NOT_FOUND_DETAIL,
            )

        return shift_change