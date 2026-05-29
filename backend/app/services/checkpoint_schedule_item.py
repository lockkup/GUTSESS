from __future__ import annotations

from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import exists, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.constants import DBConstants
from app.core.error_messages import (
    CHECKPOINT_SCHEDULE_ITEM_NOT_FOUND_DETAIL,
    DUPLICATE_CHECKPOINT_SCHEDULE_ITEM_DETAIL,
    EMPLOYEE_NOT_FOUND_DETAIL,
    INVALID_CHECKPOINT_SCHEDULE_ITEM_UPDATE_DETAIL,
    INVALID_REFERENCE_DETAIL,
    ROUTE_SITE_LOCATION_NOT_FOUND_DETAIL,
    SHIFT_NOT_FOUND_DETAIL,
)
from app.models import (
    CheckpointScheduleItem,
    Employees,
    RouteSiteLocation,
    Shift,
)
from app.schemas.checkpoint_schedule_item import (
    CheckpointScheduleItemCreate,
    CheckpointScheduleItemUpdate,
)


class CheckpointScheduleItemService:
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
    def _ensure_not_duplicate(
        db: Session,
        *,
        shift_id: int,
        route_site_location_id: int,
        sequence_no: int,
        exclude_schedule_item_id: int | None = None,
    ) -> None:
        conditions = [
            CheckpointScheduleItem.shift_id == shift_id,
            CheckpointScheduleItem.mark_flag.is_(False),
            or_(
                CheckpointScheduleItem.route_site_location_id
                == route_site_location_id,
                CheckpointScheduleItem.sequence_no == sequence_no,
            ),
        ]

        if exclude_schedule_item_id is not None:
            conditions.append(
                CheckpointScheduleItem.schedule_item_id
                != exclude_schedule_item_id
            )

        stmt = select(exists().where(*conditions))

        if db.scalar(stmt):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=DUPLICATE_CHECKPOINT_SCHEDULE_ITEM_DETAIL,
            )

    @staticmethod
    def get_checkpoint_schedule_item(
        db: Session,
        schedule_item_id: int,
        include_deleted: bool = False,
    ) -> CheckpointScheduleItem:
        stmt = select(CheckpointScheduleItem).where(
            CheckpointScheduleItem.schedule_item_id == schedule_item_id
        )

        if not include_deleted:
            stmt = stmt.where(CheckpointScheduleItem.mark_flag.is_(False))

        checkpoint_schedule_item = db.scalar(stmt)

        if checkpoint_schedule_item is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=CHECKPOINT_SCHEDULE_ITEM_NOT_FOUND_DETAIL,
            )

        return checkpoint_schedule_item

    @staticmethod
    def get_checkpoint_schedule_items(
        db: Session,
        skip: int = DBConstants.DEFAULT_PAGE_SKIP,
        limit: int = DBConstants.DEFAULT_PAGE_LIMIT,
        shift_id: int | None = None,
        route_site_location_id: int | None = None,
        is_active: bool | None = None,
        include_deleted: bool = False,
    ) -> list[CheckpointScheduleItem]:
        stmt = select(CheckpointScheduleItem)

        if not include_deleted:
            stmt = stmt.where(CheckpointScheduleItem.mark_flag.is_(False))

        if shift_id is not None:
            stmt = stmt.where(
                CheckpointScheduleItem.shift_id == shift_id
            )

        if route_site_location_id is not None:
            stmt = stmt.where(
                CheckpointScheduleItem.route_site_location_id
                == route_site_location_id
            )

        if is_active is not None:
            stmt = stmt.where(
                CheckpointScheduleItem.is_active == is_active
            )

        stmt = (
            stmt.order_by(
                CheckpointScheduleItem.shift_id.asc(),
                CheckpointScheduleItem.sequence_no.asc(),
                CheckpointScheduleItem.schedule_item_id.asc(),
            )
            .offset(skip)
            .limit(limit)
        )

        return list(db.scalars(stmt).all())

    @staticmethod
    def create_checkpoint_schedule_item(
        db: Session,
        payload: CheckpointScheduleItemCreate,
    ) -> CheckpointScheduleItem:
        CheckpointScheduleItemService._ensure_exists(
            db=db,
            column=Employees.employee_code,
            value=payload.created_by,
            error_detail=EMPLOYEE_NOT_FOUND_DETAIL,
        )

        CheckpointScheduleItemService._ensure_exists(
            db=db,
            column=Shift.shift_id,
            value=payload.shift_id,
            error_detail=SHIFT_NOT_FOUND_DETAIL,
        )

        CheckpointScheduleItemService._ensure_exists(
            db=db,
            column=RouteSiteLocation.route_site_location_id,
            value=payload.route_site_location_id,
            error_detail=ROUTE_SITE_LOCATION_NOT_FOUND_DETAIL,
        )

        CheckpointScheduleItemService._ensure_not_duplicate(
            db=db,
            shift_id=payload.shift_id,
            route_site_location_id=payload.route_site_location_id,
            sequence_no=payload.sequence_no,
        )

        checkpoint_schedule_item = CheckpointScheduleItem(
            **payload.model_dump(),
        )

        try:
            db.add(checkpoint_schedule_item)
            db.commit()
            db.refresh(checkpoint_schedule_item)
        except IntegrityError as exc:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=DUPLICATE_CHECKPOINT_SCHEDULE_ITEM_DETAIL,
            ) from exc

        return checkpoint_schedule_item

    @staticmethod
    def update_checkpoint_schedule_item(
        db: Session,
        schedule_item_id: int,
        payload: CheckpointScheduleItemUpdate,
    ) -> CheckpointScheduleItem:
        CheckpointScheduleItemService._ensure_exists(
            db=db,
            column=Employees.employee_code,
            value=payload.updated_by,
            error_detail=EMPLOYEE_NOT_FOUND_DETAIL,
        )

        checkpoint_schedule_item = (
            CheckpointScheduleItemService.get_checkpoint_schedule_item(
                db=db,
                schedule_item_id=schedule_item_id,
            )
        )

        update_data = payload.model_dump(
            exclude_unset=True,
            exclude_none=True,
        )

        business_update_data = {
            field: value
            for field, value in update_data.items()
            if field != "updated_by"
        }

        if not business_update_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=INVALID_CHECKPOINT_SCHEDULE_ITEM_UPDATE_DETAIL,
            )

        validation_map = {
            "shift_id": (
                Shift.shift_id,
                SHIFT_NOT_FOUND_DETAIL,
            ),
            "route_site_location_id": (
                RouteSiteLocation.route_site_location_id,
                ROUTE_SITE_LOCATION_NOT_FOUND_DETAIL,
            ),
        }

        for field, (column, error_detail) in validation_map.items():
            if field in business_update_data:
                CheckpointScheduleItemService._ensure_exists(
                    db=db,
                    column=column,
                    value=business_update_data[field],
                    error_detail=error_detail,
                )

        should_check_duplicate = any(
            field in business_update_data
            for field in (
                "shift_id",
                "route_site_location_id",
                "sequence_no",
            )
        )

        if should_check_duplicate:
            next_shift_id = business_update_data.get(
                "shift_id",
                checkpoint_schedule_item.shift_id,
            )
            next_route_site_location_id = business_update_data.get(
                "route_site_location_id",
                checkpoint_schedule_item.route_site_location_id,
            )
            next_sequence_no = business_update_data.get(
                "sequence_no",
                checkpoint_schedule_item.sequence_no,
            )

            CheckpointScheduleItemService._ensure_not_duplicate(
                db=db,
                shift_id=next_shift_id,
                route_site_location_id=next_route_site_location_id,
                sequence_no=next_sequence_no,
                exclude_schedule_item_id=schedule_item_id,
            )

        for field, value in update_data.items():
            setattr(checkpoint_schedule_item, field, value)

        try:
            db.commit()
            db.refresh(checkpoint_schedule_item)
        except IntegrityError as exc:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=DUPLICATE_CHECKPOINT_SCHEDULE_ITEM_DETAIL,
            ) from exc

        return checkpoint_schedule_item

    @staticmethod
    def delete_checkpoint_schedule_item(
        db: Session,
        schedule_item_id: int,
        updated_by: str,
    ) -> None:
        CheckpointScheduleItemService._ensure_exists(
            db=db,
            column=Employees.employee_code,
            value=updated_by,
            error_detail=EMPLOYEE_NOT_FOUND_DETAIL,
        )

        checkpoint_schedule_item = (
            CheckpointScheduleItemService.get_checkpoint_schedule_item(
                db=db,
                schedule_item_id=schedule_item_id,
            )
        )

        checkpoint_schedule_item.updated_by = updated_by
        checkpoint_schedule_item.mark_flag = True

        try:
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=INVALID_REFERENCE_DETAIL,
            ) from exc