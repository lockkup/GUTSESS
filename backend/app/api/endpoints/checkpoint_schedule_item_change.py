from __future__ import annotations

from fastapi import APIRouter, Depends, Path, Query, status
from sqlalchemy.orm import Session

from app.core import get_db
from app.core.constants import DBConstants
from app.schemas.checkpoint_schedule_item_change import (
    CheckpointScheduleItemChangeCreate,
    CheckpointScheduleItemChangeResponse,
)
from app.services.checkpoint_schedule_item_change import (
    CheckpointScheduleItemChangeService,
)

router = APIRouter()


@router.post(
    "/",
    response_model=CheckpointScheduleItemChangeResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_checkpoint_schedule_item_change(
    payload: CheckpointScheduleItemChangeCreate,
    db: Session = Depends(get_db),
) -> CheckpointScheduleItemChangeResponse:
    return (
        CheckpointScheduleItemChangeService
        .create_checkpoint_schedule_item_change(
            db=db,
            payload=payload,
        )
    )


@router.get(
    "/",
    response_model=list[CheckpointScheduleItemChangeResponse],
    status_code=status.HTTP_200_OK,
)
def get_checkpoint_schedule_item_changes(
    skip: int = Query(DBConstants.DEFAULT_PAGE_SKIP, ge=0),
    limit: int = Query(
        DBConstants.DEFAULT_PAGE_LIMIT,
        ge=1,
        le=DBConstants.MAX_PAGE_LIMIT,
    ),
    employee_code: str | None = Query(
        default=None,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    ),
    schedule_item_id: int | None = Query(default=None, gt=0),
    db: Session = Depends(get_db),
) -> list[CheckpointScheduleItemChangeResponse]:
    return (
        CheckpointScheduleItemChangeService
        .get_checkpoint_schedule_item_changes(
            db=db,
            skip=skip,
            limit=limit,
            employee_code=employee_code,
            schedule_item_id=schedule_item_id,
        )
    )


@router.get(
    "/{checkpoint_schedule_item_change_id}",
    response_model=CheckpointScheduleItemChangeResponse,
    status_code=status.HTTP_200_OK,
)
def get_checkpoint_schedule_item_change_by_id(
    checkpoint_schedule_item_change_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
) -> CheckpointScheduleItemChangeResponse:
    return (
        CheckpointScheduleItemChangeService
        .get_checkpoint_schedule_item_change_by_id(
            db=db,
            checkpoint_schedule_item_change_id=checkpoint_schedule_item_change_id,
        )
    )