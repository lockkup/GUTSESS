from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import exists, select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.constants import DBConstants
from app.core.error_messages import (
    CHECKPOINT_SCHEDULE_ITEM_CHANGE_NOT_FOUND_DETAIL,
    CHECKPOINT_SCHEDULE_ITEM_NOT_FOUND_DETAIL,
    DATABASE_ERROR_DETAIL,
    EMPLOYEE_NOT_FOUND_DETAIL,
    INVALID_REFERENCE_DETAIL,
)
from app.models.checkpoint_schedule_item import CheckpointScheduleItem
from app.models.checkpoint_schedule_item_change import CheckpointScheduleItemChange
from app.models.employees import Employees
from app.schemas.checkpoint_schedule_item_change import (
    CheckpointScheduleItemChangeCreate,
)


class CheckpointScheduleItemChangeService:
    @staticmethod
    def _get_employee_or_404(
        db: Session,
        employee_code: str,
    ) -> Employees:
        stmt = select(Employees).where(
            Employees.employee_code == employee_code
        )

        employee = db.scalar(stmt)

        if employee is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=EMPLOYEE_NOT_FOUND_DETAIL,
            )

        return employee

    @staticmethod
    def _ensure_schedule_item_exists(
        db: Session,
        schedule_item_id: int,
    ) -> None:
        stmt = select(
            exists().where(
                CheckpointScheduleItem.schedule_item_id == schedule_item_id
            )
        )

        if not db.scalar(stmt):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=CHECKPOINT_SCHEDULE_ITEM_NOT_FOUND_DETAIL,
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
    def create_checkpoint_schedule_item_change(
        db: Session,
        payload: CheckpointScheduleItemChangeCreate,
    ) -> CheckpointScheduleItemChange:
        employee_code = payload.employee_code.strip()

        employee = CheckpointScheduleItemChangeService._get_employee_or_404(
            db=db,
            employee_code=employee_code,
        )

        CheckpointScheduleItemChangeService._ensure_schedule_item_exists(
            db=db,
            schedule_item_id=payload.schedule_item_id,
        )

        checkpoint_schedule_item_change = CheckpointScheduleItemChange(
            employee_code=employee_code,
            schedule_item_id=payload.schedule_item_id,
            user_name=CheckpointScheduleItemChangeService._build_user_name(
                employee
            ),
            action=payload.action.strip(),
        )

        try:
            db.add(checkpoint_schedule_item_change)
            db.commit()
            db.refresh(checkpoint_schedule_item_change)
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

        return checkpoint_schedule_item_change

    @staticmethod
    def get_checkpoint_schedule_item_changes(
        db: Session,
        skip: int = DBConstants.DEFAULT_PAGE_SKIP,
        limit: int = DBConstants.DEFAULT_PAGE_LIMIT,
        employee_code: str | None = None,
        schedule_item_id: int | None = None,
    ) -> list[CheckpointScheduleItemChange]:
        stmt = select(CheckpointScheduleItemChange)

        if employee_code is not None:
            stmt = stmt.where(
                CheckpointScheduleItemChange.employee_code
                == employee_code.strip()
            )

        if schedule_item_id is not None:
            stmt = stmt.where(
                CheckpointScheduleItemChange.schedule_item_id
                == schedule_item_id
            )

        stmt = (
            stmt.order_by(
                CheckpointScheduleItemChange
                .checkpoint_schedule_item_change_id
                .desc()
            )
            .offset(skip)
            .limit(limit)
        )

        return list(db.scalars(stmt).all())

    @staticmethod
    def get_checkpoint_schedule_item_change_by_id(
        db: Session,
        checkpoint_schedule_item_change_id: int,
    ) -> CheckpointScheduleItemChange:
        stmt = select(CheckpointScheduleItemChange).where(
            CheckpointScheduleItemChange.checkpoint_schedule_item_change_id
            == checkpoint_schedule_item_change_id
        )

        checkpoint_schedule_item_change = db.scalar(stmt)

        if checkpoint_schedule_item_change is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=CHECKPOINT_SCHEDULE_ITEM_CHANGE_NOT_FOUND_DETAIL,
            )

        return checkpoint_schedule_item_change