from __future__ import annotations

from fastapi import APIRouter, Depends, Path, Query, Response, status
from sqlalchemy.orm import Session

from app.core import get_db
from app.core.constants import DBConstants
from app.schemas.checkpoint_schedule import (
    CheckpointScheduleAction,
    CheckpointScheduleCreate,
    CheckpointScheduleResponse,
    CheckpointScheduleUpdate,
)
from app.services.checkpoint_schedule import CheckpointScheduleService

router = APIRouter()


@router.post(
    "/",
    response_model=CheckpointScheduleResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_checkpoint_schedule(
    payload: CheckpointScheduleCreate,
    db: Session = Depends(get_db),
) -> CheckpointScheduleResponse:
    return CheckpointScheduleService.create_checkpoint_schedule(
        db=db,
        payload=payload,
    )


@router.get(
    "/",
    response_model=list[CheckpointScheduleResponse],
    status_code=status.HTTP_200_OK,
)
def get_checkpoint_schedules(
    skip: int = Query(DBConstants.DEFAULT_PAGE_SKIP, ge=0),
    limit: int = Query(
        DBConstants.DEFAULT_PAGE_LIMIT,
        ge=1,
        le=DBConstants.MAX_PAGE_LIMIT,
    ),
    shift_id: int | None = Query(default=None, gt=0),
    is_active: bool | None = Query(default=None),
    include_deleted: bool = Query(default=False),
    db: Session = Depends(get_db),
) -> list[CheckpointScheduleResponse]:
    return CheckpointScheduleService.get_checkpoint_schedules(
        db=db,
        skip=skip,
        limit=limit,
        shift_id=shift_id,
        is_active=is_active,
        include_deleted=include_deleted,
    )


@router.get(
    "/{schedule_id}",
    response_model=CheckpointScheduleResponse,
    status_code=status.HTTP_200_OK,
)
def get_checkpoint_schedule_by_id(
    schedule_id: int = Path(..., gt=0),
    include_deleted: bool = Query(default=False),
    db: Session = Depends(get_db),
) -> CheckpointScheduleResponse:
    return CheckpointScheduleService.get_checkpoint_schedule_by_id(
        db=db,
        schedule_id=schedule_id,
        include_deleted=include_deleted,
    )


@router.patch(
    "/{schedule_id}",
    response_model=CheckpointScheduleResponse,
    status_code=status.HTTP_200_OK,
)
def update_checkpoint_schedule(
    payload: CheckpointScheduleUpdate,
    schedule_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
) -> CheckpointScheduleResponse:
    return CheckpointScheduleService.update_checkpoint_schedule(
        db=db,
        schedule_id=schedule_id,
        payload=payload,
    )


@router.delete(
    "/{schedule_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_checkpoint_schedule(
    payload: CheckpointScheduleAction,
    schedule_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
) -> Response:
    CheckpointScheduleService.delete_checkpoint_schedule(
        db=db,
        schedule_id=schedule_id,
        updated_by=payload.updated_by,
    )

    return Response(status_code=status.HTTP_204_NO_CONTENT)