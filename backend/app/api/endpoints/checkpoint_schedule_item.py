from __future__ import annotations

from fastapi import APIRouter, Depends, Path, Query, Response, status
from sqlalchemy.orm import Session

from app.core import get_db
from app.core.constants import DBConstants
from app.schemas.checkpoint_schedule_item import (
    CheckpointScheduleItemAction,
    CheckpointScheduleItemCreate,
    CheckpointScheduleItemResponse,
    CheckpointScheduleItemUpdate,
)
from app.services.checkpoint_schedule_item import CheckpointScheduleItemService

router = APIRouter()


@router.post(
    "/",
    response_model=CheckpointScheduleItemResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_checkpoint_schedule_item(
    payload: CheckpointScheduleItemCreate,
    db: Session = Depends(get_db),
) -> CheckpointScheduleItemResponse:
    return CheckpointScheduleItemService.create_checkpoint_schedule_item(
        db=db,
        payload=payload,
    )


@router.get(
    "/",
    response_model=list[CheckpointScheduleItemResponse],
    status_code=status.HTTP_200_OK,
)
def get_checkpoint_schedule_items(
    skip: int = Query(DBConstants.DEFAULT_PAGE_SKIP, ge=0),
    limit: int = Query(
        DBConstants.DEFAULT_PAGE_LIMIT,
        ge=1,
        le=DBConstants.MAX_PAGE_LIMIT,
    ),
    schedule_id: int | None = Query(default=None, gt=0),
    route_site_location_id: int | None = Query(default=None, gt=0),
    is_active: bool | None = Query(default=None),
    include_deleted: bool = Query(default=False),
    db: Session = Depends(get_db),
) -> list[CheckpointScheduleItemResponse]:
    return CheckpointScheduleItemService.get_checkpoint_schedule_items(
        db=db,
        skip=skip,
        limit=limit,
        schedule_id=schedule_id,
        route_site_location_id=route_site_location_id,
        is_active=is_active,
        include_deleted=include_deleted,
    )


@router.get(
    "/{schedule_item_id}",
    response_model=CheckpointScheduleItemResponse,
    status_code=status.HTTP_200_OK,
)
def get_checkpoint_schedule_item(
    schedule_item_id: int = Path(..., gt=0),
    include_deleted: bool = Query(default=False),
    db: Session = Depends(get_db),
) -> CheckpointScheduleItemResponse:
    return CheckpointScheduleItemService.get_checkpoint_schedule_item(
        db=db,
        schedule_item_id=schedule_item_id,
        include_deleted=include_deleted,
    )


@router.patch(
    "/{schedule_item_id}",
    response_model=CheckpointScheduleItemResponse,
    status_code=status.HTTP_200_OK,
)
def update_checkpoint_schedule_item(
    payload: CheckpointScheduleItemUpdate,
    schedule_item_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
) -> CheckpointScheduleItemResponse:
    return CheckpointScheduleItemService.update_checkpoint_schedule_item(
        db=db,
        schedule_item_id=schedule_item_id,
        payload=payload,
    )


@router.delete(
    "/{schedule_item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_checkpoint_schedule_item(
    payload: CheckpointScheduleItemAction,
    schedule_item_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
) -> Response:
    CheckpointScheduleItemService.delete_checkpoint_schedule_item(
        db=db,
        schedule_item_id=schedule_item_id,
        updated_by=payload.updated_by,
    )

    return Response(status_code=status.HTTP_204_NO_CONTENT)