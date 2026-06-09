from __future__ import annotations

from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, Path, Query, status
from sqlalchemy.orm import Session

from app.core import get_db
from app.core.constants import DBConstants
from app.schemas.checkpoint_assignment import (
    AssignmentStatus,
    CheckpointAssignmentAction,
    CheckpointAssignmentCreate,
    CheckpointAssignmentDailyResponse,
    CheckpointAssignmentRecheck,
    CheckpointAssignmentResponse,
    CheckpointAssignmentUpdate,
)
from app.schemas.checkpoint_location import (
    VerifyCheckpointLocationRequest,
    VerifyCheckpointLocationResponse,
)
from app.services.checkpoint_assignment import CheckpointAssignmentService

router = APIRouter()

ShiftType = Literal["day", "night"]


@router.post(
    "/",
    response_model=CheckpointAssignmentResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_checkpoint_assignment(
    payload: CheckpointAssignmentCreate,
    db: Session = Depends(get_db),
) -> CheckpointAssignmentResponse:
    return CheckpointAssignmentService.create_checkpoint_assignment(
        db=db,
        payload=payload,
    )


@router.get(
    "/",
    response_model=list[CheckpointAssignmentResponse],
    status_code=status.HTTP_200_OK,
)
def get_checkpoint_assignments(
    skip: int = Query(DBConstants.DEFAULT_PAGE_SKIP, ge=0),
    limit: int = Query(
        DBConstants.DEFAULT_PAGE_LIMIT,
        ge=1,
        le=DBConstants.MAX_PAGE_LIMIT,
    ),
    work_date: date | None = Query(default=None),
    schedule_item_id: int | None = Query(default=None, gt=0),
    parent_assignment_id: int | None = Query(default=None, ge=0),
    assignment_status: AssignmentStatus | None = Query(default=None),
    is_active: bool | None = Query(default=None),
    include_deleted: bool = Query(default=False),
    db: Session = Depends(get_db),
) -> list[CheckpointAssignmentResponse]:
    return CheckpointAssignmentService.get_checkpoint_assignments(
        db=db,
        skip=skip,
        limit=limit,
        work_date=work_date,
        schedule_item_id=schedule_item_id,
        parent_assignment_id=parent_assignment_id,
        assignment_status=assignment_status,
        is_active=is_active,
        include_deleted=include_deleted,
    )


@router.get(
    "/daily",
    response_model=list[CheckpointAssignmentDailyResponse],
    status_code=status.HTTP_200_OK,
)
def get_daily_checkpoint_assignments(
    work_date: date = Query(...),
    shift_type: ShiftType | None = Query(default=None),
    employee_code: str | None = Query(default=None, min_length=1),
    is_active: bool | None = Query(default=True),
    include_deleted: bool = Query(default=False),
    db: Session = Depends(get_db),
) -> list[CheckpointAssignmentDailyResponse]:
    return CheckpointAssignmentService.get_daily_checkpoint_assignments(
        db=db,
        work_date=work_date,
        shift_type=shift_type,
        employee_code=employee_code,
        is_active=is_active,
        include_deleted=include_deleted,
    )


@router.post(
    "/verify-location",
    response_model=VerifyCheckpointLocationResponse,
    status_code=status.HTTP_200_OK,
)
def verify_checkpoint_location(
    payload: VerifyCheckpointLocationRequest,
    db: Session = Depends(get_db),
) -> VerifyCheckpointLocationResponse:
    return CheckpointAssignmentService.verify_checkpoint_location(
        db=db,
        payload=payload,
    )


@router.get(
    "/{assignment_id}",
    response_model=CheckpointAssignmentResponse,
    status_code=status.HTTP_200_OK,
)
def get_checkpoint_assignment(
    assignment_id: int = Path(..., gt=0),
    include_deleted: bool = Query(default=False),
    db: Session = Depends(get_db),
) -> CheckpointAssignmentResponse:
    return CheckpointAssignmentService.get_checkpoint_assignment(
        db=db,
        assignment_id=assignment_id,
        include_deleted=include_deleted,
    )


@router.patch(
    "/{assignment_id}",
    response_model=CheckpointAssignmentResponse,
    status_code=status.HTTP_200_OK,
)
def update_checkpoint_assignment(
    payload: CheckpointAssignmentUpdate,
    assignment_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
) -> CheckpointAssignmentResponse:
    return CheckpointAssignmentService.update_checkpoint_assignment(
        db=db,
        assignment_id=assignment_id,
        payload=payload,
    )


@router.patch(
    "/{assignment_id}/start",
    response_model=CheckpointAssignmentResponse,
    status_code=status.HTTP_200_OK,
)
def start_checkpoint_assignment(
    payload: CheckpointAssignmentAction,
    assignment_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
) -> CheckpointAssignmentResponse:
    return CheckpointAssignmentService.start_checkpoint_assignment(
        db=db,
        assignment_id=assignment_id,
        updated_by=payload.updated_by,
    )


@router.patch(
    "/{assignment_id}/complete",
    response_model=CheckpointAssignmentResponse,
    status_code=status.HTTP_200_OK,
)
def complete_checkpoint_assignment(
    payload: CheckpointAssignmentAction,
    assignment_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
) -> CheckpointAssignmentResponse:
    return CheckpointAssignmentService.complete_checkpoint_assignment(
        db=db,
        assignment_id=assignment_id,
        updated_by=payload.updated_by,
    )


@router.post(
    "/{assignment_id}/recheck",
    response_model=CheckpointAssignmentResponse,
    status_code=status.HTTP_201_CREATED,
)
def recheck_checkpoint_assignment(
    payload: CheckpointAssignmentRecheck,
    assignment_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
) -> CheckpointAssignmentResponse:
    return CheckpointAssignmentService.recheck_checkpoint_assignment(
        db=db,
        assignment_id=assignment_id,
        payload=payload,
    )


@router.patch(
    "/{assignment_id}/delete",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_checkpoint_assignment(
    payload: CheckpointAssignmentAction,
    assignment_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
) -> None:
    CheckpointAssignmentService.delete_checkpoint_assignment(
        db=db,
        assignment_id=assignment_id,
        updated_by=payload.updated_by,
    )