from __future__ import annotations

from fastapi import APIRouter, Depends, Path, Query, status
from sqlalchemy.orm import Session

from app.core import get_db
from app.core.constants import DBConstants
from app.schemas.checkpoint_schedule_change import (
    CheckpointScheduleChangeResponse,
)
from app.services.checkpoint_schedule_change import (
    CheckpointScheduleChangeService,
)

router = APIRouter()


@router.get(
    "/",
    response_model=list[CheckpointScheduleChangeResponse],
    status_code=status.HTTP_200_OK,
)
def get_checkpoint_schedule_changes(
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
    schedule_id: int | None = Query(default=None, gt=0),
    db: Session = Depends(get_db),
) -> list[CheckpointScheduleChangeResponse]:
    return CheckpointScheduleChangeService.get_checkpoint_schedule_changes(
        db=db,
        skip=skip,
        limit=limit,
        employee_code=employee_code,
        schedule_id=schedule_id,
    )


@router.get(
    "/{checkpoint_schedule_change_id}",
    response_model=CheckpointScheduleChangeResponse,
    status_code=status.HTTP_200_OK,
)
def get_checkpoint_schedule_change_by_id(
    checkpoint_schedule_change_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
) -> CheckpointScheduleChangeResponse:
    return CheckpointScheduleChangeService.get_checkpoint_schedule_change_by_id(
        db=db,
        checkpoint_schedule_change_id=checkpoint_schedule_change_id,
    )