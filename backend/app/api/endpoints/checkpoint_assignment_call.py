from __future__ import annotations

from fastapi import APIRouter, Depends, Path, Query, Response, status
from sqlalchemy.orm import Session

from app.core import get_db
from app.core.constants import DBConstants
from app.schemas.checkpoint_assignment_call import (
    CheckpointAssignmentCallAction,
    CheckpointAssignmentCallCreate,
    CheckpointAssignmentCallResponse,
    CheckpointAssignmentCallUpdate,
)
from app.services.checkpoint_assignment_call import CheckpointAssignmentCallService

router = APIRouter()


@router.post(
    "/",
    response_model=CheckpointAssignmentCallResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_checkpoint_assignment_call(
    payload: CheckpointAssignmentCallCreate,
    db: Session = Depends(get_db),
) -> CheckpointAssignmentCallResponse:
    return CheckpointAssignmentCallService.create_checkpoint_assignment_call(
        db=db,
        payload=payload,
    )


@router.get(
    "/",
    response_model=list[CheckpointAssignmentCallResponse],
    status_code=status.HTTP_200_OK,
)
def get_checkpoint_assignment_calls(
    skip: int = Query(DBConstants.DEFAULT_PAGE_SKIP, ge=0),
    limit: int = Query(
        DBConstants.DEFAULT_PAGE_LIMIT,
        ge=1,
        le=DBConstants.MAX_PAGE_LIMIT,
    ),
    assignment_id: int | None = Query(default=None, gt=0),
    is_active: bool | None = Query(default=None),
    include_deleted: bool = Query(default=False),
    db: Session = Depends(get_db),
) -> list[CheckpointAssignmentCallResponse]:
    return CheckpointAssignmentCallService.get_checkpoint_assignment_calls(
        db=db,
        skip=skip,
        limit=limit,
        assignment_id=assignment_id,
        is_active=is_active,
        include_deleted=include_deleted,
    )


@router.get(
    "/{assignment_call_id}",
    response_model=CheckpointAssignmentCallResponse,
    status_code=status.HTTP_200_OK,
)
def get_checkpoint_assignment_call(
    assignment_call_id: int = Path(..., gt=0),
    include_deleted: bool = Query(default=False),
    db: Session = Depends(get_db),
) -> CheckpointAssignmentCallResponse:
    return CheckpointAssignmentCallService.get_checkpoint_assignment_call(
        db=db,
        assignment_call_id=assignment_call_id,
        include_deleted=include_deleted,
    )


@router.patch(
    "/{assignment_call_id}",
    response_model=CheckpointAssignmentCallResponse,
    status_code=status.HTTP_200_OK,
)
def update_checkpoint_assignment_call(
    payload: CheckpointAssignmentCallUpdate,
    assignment_call_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
) -> CheckpointAssignmentCallResponse:
    return CheckpointAssignmentCallService.update_checkpoint_assignment_call(
        db=db,
        assignment_call_id=assignment_call_id,
        payload=payload,
    )


@router.delete(
    "/{assignment_call_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_checkpoint_assignment_call(
    payload: CheckpointAssignmentCallAction,
    assignment_call_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
) -> Response:
    CheckpointAssignmentCallService.delete_checkpoint_assignment_call(
        db=db,
        assignment_call_id=assignment_call_id,
        updated_by=payload.updated_by,
    )

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch(
    "/{assignment_call_id}/deactivate",
    response_model=CheckpointAssignmentCallResponse,
    status_code=status.HTTP_200_OK,
)
def deactivate_checkpoint_assignment_call(
    payload: CheckpointAssignmentCallAction,
    assignment_call_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
) -> CheckpointAssignmentCallResponse:
    return CheckpointAssignmentCallService.deactivate_checkpoint_assignment_call(
        db=db,
        assignment_call_id=assignment_call_id,
        updated_by=payload.updated_by,
    )