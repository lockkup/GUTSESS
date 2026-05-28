from __future__ import annotations

from fastapi import APIRouter, Depends, Path, Query, status
from sqlalchemy.orm import Session

from app.core import get_db
from app.core.constants import DBConstants
from app.schemas.shift_change import ShiftChangeResponse
from app.services.shift_change import ShiftChangeService

router = APIRouter()


@router.get(
    "/",
    response_model=list[ShiftChangeResponse],
    status_code=status.HTTP_200_OK,
)
def get_shift_changes(
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
    shift_id: int | None = Query(default=None, gt=0),
    db: Session = Depends(get_db),
) -> list[ShiftChangeResponse]:
    return ShiftChangeService.get_shift_changes(
        db=db,
        skip=skip,
        limit=limit,
        employee_code=employee_code,
        shift_id=shift_id,
    )


@router.get(
    "/{shift_change_id}",
    response_model=ShiftChangeResponse,
    status_code=status.HTTP_200_OK,
)
def get_shift_change_by_id(
    shift_change_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
) -> ShiftChangeResponse:
    return ShiftChangeService.get_shift_change_by_id(
        db=db,
        shift_change_id=shift_change_id,
    )