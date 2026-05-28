from __future__ import annotations

from fastapi import APIRouter, Depends, Path, Query, status
from sqlalchemy.orm import Session

from app.core import get_db
from app.core.constants import DBConstants
from app.schemas.checkpoint_assignment_change import (
    CheckpointAssignmentChangeCreate,
    CheckpointAssignmentChangeResponse,
)
from app.services.checkpoint_assignment_change import (
    CheckpointAssignmentChangeService,
)

router = APIRouter()


@router.post(
    "/",
    response_model=CheckpointAssignmentChangeResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_checkpoint_assignment_change(
    payload: CheckpointAssignmentChangeCreate,
    db: Session = Depends(get_db),
) -> CheckpointAssignmentChangeResponse:
    return CheckpointAssignmentChangeService.create_checkpoint_assignment_change(
        db=db,
        payload=payload,
    )


@router.get(
    "/",
    response_model=list[CheckpointAssignmentChangeResponse],
    status_code=status.HTTP_200_OK,
)
def get_checkpoint_assignment_changes(
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
    assignment_id: int | None = Query(default=None, gt=0),
    db: Session = Depends(get_db),
) -> list[CheckpointAssignmentChangeResponse]:
    return CheckpointAssignmentChangeService.get_checkpoint_assignment_changes(
        db=db,
        skip=skip,
        limit=limit,
        employee_code=employee_code,
        assignment_id=assignment_id,
    )


@router.get(
    "/{checkpoint_assignment_change_id}",
    response_model=CheckpointAssignmentChangeResponse,
    status_code=status.HTTP_200_OK,
)
def get_checkpoint_assignment_change_by_id(
    checkpoint_assignment_change_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
) -> CheckpointAssignmentChangeResponse:
    return (
        CheckpointAssignmentChangeService
        .get_checkpoint_assignment_change_by_id(
            db=db,
            checkpoint_assignment_change_id=checkpoint_assignment_change_id,
        )
    )