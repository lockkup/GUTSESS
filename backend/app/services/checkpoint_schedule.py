from __future__ import annotations

from datetime import date
from typing import Any, Final

from fastapi import HTTPException, status
from sqlalchemy import exists, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.constants import DBConstants
from app.core.error_messages import (
    CHECKPOINT_SCHEDULE_DAY_REQUIRED_DETAIL,
    CHECKPOINT_SCHEDULE_NOT_FOUND_DETAIL,
    DUPLICATE_CHECKPOINT_SCHEDULE_DETAIL,
    EMPLOYEE_NOT_FOUND_DETAIL,
    INVALID_EFFECTIVE_DATE_DETAIL,
    INVALID_REFERENCE_DETAIL,
    SHIFT_NOT_FOUND_DETAIL,
)
from app.models import CheckpointSchedule, Employees, Shift
from app.schemas.checkpoint_schedule import (
    CheckpointScheduleCreate,
    CheckpointScheduleUpdate,
)


_NON_NULLABLE_UPDATE_FIELDS: Final[tuple[str, ...]] = (
    "schedule_name",
    "shift_id",
    "is_mon",
    "is_tue",
    "is_wed",
    "is_thu",
    "is_fri",
    "is_sat",
    "is_sun",
    "is_active",
    "effective_from",
)

_DAY_FIELDS: Final[tuple[str, ...]] = (
    "is_mon",
    "is_tue",
    "is_wed",
    "is_thu",
    "is_fri",
    "is_sat",
    "is_sun",
)


class CheckpointScheduleService:
    @staticmethod
    def _ensure_exists(
        db: Session,
        column: Any,
        value: Any,
        error_detail: str,
    ) -> None:
        stmt = select(exists().where(column == value))

        if not db.scalar(stmt):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=error_detail,
            )

    @staticmethod
    def _ensure_no_null_for_required_db_fields(update_data: dict[str, Any]) -> None:
        null_fields = [
            field
            for field in _NON_NULLABLE_UPDATE_FIELDS
            if field in update_data and update_data[field] is None
        ]

        if null_fields:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{', '.join(null_fields)} cannot be null",
            )

    @staticmethod
    def _validate_effective_date_range(
        effective_from: date,
        effective_to: date | None,
    ) -> None:
        if effective_to is not None and effective_to < effective_from:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=INVALID_EFFECTIVE_DATE_DETAIL,
            )

    @staticmethod
    def _validate_at_least_one_day(day_values: dict[str, bool]) -> None:
        if not any(day_values.values()):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=CHECKPOINT_SCHEDULE_DAY_REQUIRED_DETAIL,
            )

    @staticmethod
    def _ensure_not_duplicate(
        db: Session,
        schedule_name: str,
        shift_id: int,
        effective_from: date,
        exclude_schedule_id: int | None = None,
    ) -> None:
        stmt = select(
            exists().where(
                CheckpointSchedule.schedule_name == schedule_name,
                CheckpointSchedule.shift_id == shift_id,
                CheckpointSchedule.effective_from == effective_from,
                CheckpointSchedule.mark_flag.is_(False),
            )
        )

        if exclude_schedule_id is not None:
            stmt = select(
                exists().where(
                    CheckpointSchedule.schedule_name == schedule_name,
                    CheckpointSchedule.shift_id == shift_id,
                    CheckpointSchedule.effective_from == effective_from,
                    CheckpointSchedule.mark_flag.is_(False),
                    CheckpointSchedule.schedule_id != exclude_schedule_id,
                )
            )

        if db.scalar(stmt):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=DUPLICATE_CHECKPOINT_SCHEDULE_DETAIL,
            )

    @staticmethod
    def get_checkpoint_schedule_by_id(
        db: Session,
        schedule_id: int,
        include_deleted: bool = False,
    ) -> CheckpointSchedule:
        stmt = select(CheckpointSchedule).where(
            CheckpointSchedule.schedule_id == schedule_id
        )

        if not include_deleted:
            stmt = stmt.where(CheckpointSchedule.mark_flag.is_(False))

        checkpoint_schedule = db.scalar(stmt)

        if checkpoint_schedule is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=CHECKPOINT_SCHEDULE_NOT_FOUND_DETAIL,
            )

        return checkpoint_schedule

    @staticmethod
    def get_checkpoint_schedules(
        db: Session,
        skip: int = DBConstants.DEFAULT_PAGE_SKIP,
        limit: int = DBConstants.DEFAULT_PAGE_LIMIT,
        shift_id: int | None = None,
        is_active: bool | None = None,
        include_deleted: bool = False,
    ) -> list[CheckpointSchedule]:
        stmt = select(CheckpointSchedule)

        if not include_deleted:
            stmt = stmt.where(CheckpointSchedule.mark_flag.is_(False))

        if shift_id is not None:
            stmt = stmt.where(CheckpointSchedule.shift_id == shift_id)

        if is_active is not None:
            stmt = stmt.where(CheckpointSchedule.is_active.is_(is_active))

        stmt = (
            stmt.order_by(
                CheckpointSchedule.shift_id.asc(),
                CheckpointSchedule.effective_from.desc(),
                CheckpointSchedule.schedule_id.desc(),
            )
            .offset(skip)
            .limit(limit)
        )

        return list(db.scalars(stmt).all())

    @staticmethod
    def create_checkpoint_schedule(
        db: Session,
        payload: CheckpointScheduleCreate,
    ) -> CheckpointSchedule:
        CheckpointScheduleService._ensure_exists(
            db=db,
            column=Employees.employee_code,
            value=payload.created_by,
            error_detail=EMPLOYEE_NOT_FOUND_DETAIL,
        )

        CheckpointScheduleService._ensure_exists(
            db=db,
            column=Shift.shift_id,
            value=payload.shift_id,
            error_detail=SHIFT_NOT_FOUND_DETAIL,
        )

        CheckpointScheduleService._ensure_not_duplicate(
            db=db,
            schedule_name=payload.schedule_name,
            shift_id=payload.shift_id,
            effective_from=payload.effective_from,
        )

        checkpoint_schedule = CheckpointSchedule(**payload.model_dump())

        try:
            db.add(checkpoint_schedule)
            db.commit()
            db.refresh(checkpoint_schedule)
        except IntegrityError as exc:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=INVALID_REFERENCE_DETAIL,
            ) from exc

        return checkpoint_schedule

    @staticmethod
    def update_checkpoint_schedule(
        db: Session,
        schedule_id: int,
        payload: CheckpointScheduleUpdate,
    ) -> CheckpointSchedule:
        update_data = payload.model_dump(exclude_unset=True)

        CheckpointScheduleService._ensure_no_null_for_required_db_fields(
            update_data=update_data,
        )

        CheckpointScheduleService._ensure_exists(
            db=db,
            column=Employees.employee_code,
            value=payload.updated_by,
            error_detail=EMPLOYEE_NOT_FOUND_DETAIL,
        )

        checkpoint_schedule = CheckpointScheduleService.get_checkpoint_schedule_by_id(
            db=db,
            schedule_id=schedule_id,
        )

        if "shift_id" in update_data:
            CheckpointScheduleService._ensure_exists(
                db=db,
                column=Shift.shift_id,
                value=update_data["shift_id"],
                error_detail=SHIFT_NOT_FOUND_DETAIL,
            )

        effective_from = update_data.get(
            "effective_from",
            checkpoint_schedule.effective_from,
        )
        effective_to = update_data.get(
            "effective_to",
            checkpoint_schedule.effective_to,
        )

        CheckpointScheduleService._validate_effective_date_range(
            effective_from=effective_from,
            effective_to=effective_to,
        )

        day_values = {
            field: update_data.get(field, getattr(checkpoint_schedule, field))
            for field in _DAY_FIELDS
        }

        CheckpointScheduleService._validate_at_least_one_day(day_values)

        schedule_name = update_data.get(
            "schedule_name",
            checkpoint_schedule.schedule_name,
        )
        shift_id = update_data.get(
            "shift_id",
            checkpoint_schedule.shift_id,
        )

        CheckpointScheduleService._ensure_not_duplicate(
            db=db,
            schedule_name=schedule_name,
            shift_id=shift_id,
            effective_from=effective_from,
            exclude_schedule_id=schedule_id,
        )

        for field, value in update_data.items():
            setattr(checkpoint_schedule, field, value)

        try:
            db.commit()
            db.refresh(checkpoint_schedule)
        except IntegrityError as exc:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=INVALID_REFERENCE_DETAIL,
            ) from exc

        return checkpoint_schedule

    @staticmethod
    def delete_checkpoint_schedule(
        db: Session,
        schedule_id: int,
        updated_by: str,
    ) -> None:
        CheckpointScheduleService._ensure_exists(
            db=db,
            column=Employees.employee_code,
            value=updated_by,
            error_detail=EMPLOYEE_NOT_FOUND_DETAIL,
        )

        checkpoint_schedule = CheckpointScheduleService.get_checkpoint_schedule_by_id(
            db=db,
            schedule_id=schedule_id,
        )

        checkpoint_schedule.updated_by = updated_by
        checkpoint_schedule.mark_flag = True

        try:
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=INVALID_REFERENCE_DETAIL,
            ) from exc