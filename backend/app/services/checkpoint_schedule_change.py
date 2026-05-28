from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import exists, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.constants import DBConstants
from app.core.error_messages import (
    CHECKPOINT_SCHEDULE_CHANGE_NOT_FOUND_DETAIL,
    CHECKPOINT_SCHEDULE_NOT_FOUND_DETAIL,
    EMPLOYEE_NOT_FOUND_DETAIL,
    INVALID_REFERENCE_DETAIL,
)
from app.models.checkpoint_schedule import CheckpointSchedule
from app.models.checkpoint_schedule_change import CheckpointScheduleChange
from app.models.employees import Employees
from app.schemas.checkpoint_schedule_change import CheckpointScheduleChangeCreate


class CheckpointScheduleChangeService:
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
    def _ensure_schedule_exists(
        db: Session,
        schedule_id: int,
    ) -> None:
        stmt = select(
            exists().where(
                CheckpointSchedule.schedule_id == schedule_id
            )
        )

        if not db.scalar(stmt):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=CHECKPOINT_SCHEDULE_NOT_FOUND_DETAIL,
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
    def create_checkpoint_schedule_change(
        db: Session,
        payload: CheckpointScheduleChangeCreate,
    ) -> CheckpointScheduleChange:
        """
        ใช้สำหรับให้ service อื่นเรียกสร้างประวัติเท่านั้น
        ไม่ควรเปิดเป็น public POST endpoint จาก frontend โดยตรง
        """

        employee = CheckpointScheduleChangeService._get_employee_or_404(
            db=db,
            employee_code=payload.employee_code,
        )

        CheckpointScheduleChangeService._ensure_schedule_exists(
            db=db,
            schedule_id=payload.schedule_id,
        )

        checkpoint_schedule_change = CheckpointScheduleChange(
            employee_code=payload.employee_code,
            schedule_id=payload.schedule_id,
            user_name=CheckpointScheduleChangeService._build_user_name(
                employee
            ),
            action=payload.action.value,
        )

        try:
            db.add(checkpoint_schedule_change)
            db.commit()
            db.refresh(checkpoint_schedule_change)
        except IntegrityError as exc:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=INVALID_REFERENCE_DETAIL,
            ) from exc

        return checkpoint_schedule_change

    @staticmethod
    def get_checkpoint_schedule_changes(
        db: Session,
        skip: int = DBConstants.DEFAULT_PAGE_SKIP,
        limit: int = DBConstants.DEFAULT_PAGE_LIMIT,
        employee_code: str | None = None,
        schedule_id: int | None = None,
    ) -> list[CheckpointScheduleChange]:
        stmt = select(CheckpointScheduleChange)

        if employee_code is not None:
            employee_code = employee_code.strip()

            stmt = stmt.where(
                CheckpointScheduleChange.employee_code == employee_code
            )

        if schedule_id is not None:
            stmt = stmt.where(
                CheckpointScheduleChange.schedule_id == schedule_id
            )

        stmt = (
            stmt.order_by(
                CheckpointScheduleChange.checkpoint_schedule_change_id.desc()
            )
            .offset(skip)
            .limit(limit)
        )

        return list(db.scalars(stmt).all())

    @staticmethod
    def get_checkpoint_schedule_change_by_id(
        db: Session,
        checkpoint_schedule_change_id: int,
    ) -> CheckpointScheduleChange:
        stmt = select(CheckpointScheduleChange).where(
            CheckpointScheduleChange.checkpoint_schedule_change_id
            == checkpoint_schedule_change_id
        )

        checkpoint_schedule_change = db.scalar(stmt)

        if checkpoint_schedule_change is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=CHECKPOINT_SCHEDULE_CHANGE_NOT_FOUND_DETAIL,
            )

        return checkpoint_schedule_change