from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy.orm import Session

from app.core import get_db
from app.core.constants import DBConstants
from app.schemas.shift import ShiftCreate, ShiftResponse, ShiftUpdate
from app.services.shift import ShiftService

router = APIRouter()

SHIFT_NOT_FOUND_DETAIL = "Shift not found"


@router.post(
    "/",
    response_model=ShiftResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_shift(
    payload: ShiftCreate,
    db: Session = Depends(get_db),
) -> ShiftResponse:
    return ShiftService.create_shift(db, payload)


@router.get(
    "/",
    response_model=list[ShiftResponse],
    status_code=status.HTTP_200_OK,
)
def get_shifts(
    skip: int = Query(DBConstants.DEFAULT_PAGE_SKIP, ge=0),
    limit: int = Query(
        DBConstants.DEFAULT_PAGE_LIMIT,
        ge=1,
        le=DBConstants.MAX_PAGE_LIMIT,
    ),
    is_active: bool | None = Query(default=None),
    include_deleted: bool = Query(default=False),
    db: Session = Depends(get_db),
) -> list[ShiftResponse]:
    return ShiftService.get_shifts(
        db=db,
        skip=skip,
        limit=limit,
        is_active=is_active,
        include_deleted=include_deleted,
    )


@router.get(
    "/{shift_id}",
    response_model=ShiftResponse,
    status_code=status.HTTP_200_OK,
)
def get_shift_by_id(
    shift_id: int = Path(..., gt=0),
    include_deleted: bool = Query(default=False),
    db: Session = Depends(get_db),
) -> ShiftResponse:
    shift = ShiftService.get_shift_by_id(
        db=db,
        shift_id=shift_id,
        include_deleted=include_deleted,
    )
    if shift is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=SHIFT_NOT_FOUND_DETAIL,
        )
    return shift


@router.patch(
    "/{shift_id}",
    response_model=ShiftResponse,
    status_code=status.HTTP_200_OK,
)
def update_shift(
    payload: ShiftUpdate,
    shift_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
) -> ShiftResponse:
    shift = ShiftService.update_shift(
        db=db,
        shift_id=shift_id,
        payload=payload,
    )
    if shift is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=SHIFT_NOT_FOUND_DETAIL,
        )
    return shift


@router.patch(
    "/{shift_id}/deactivate",
    response_model=ShiftResponse,
    status_code=status.HTTP_200_OK,
)
def deactivate_shift(
    shift_id: int = Path(..., gt=0),
    updated_by: str = Query(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    ),
    db: Session = Depends(get_db),
) -> ShiftResponse:
    shift = ShiftService.deactivate_shift(
        db=db,
        shift_id=shift_id,
        updated_by=updated_by,
    )
    if shift is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=SHIFT_NOT_FOUND_DETAIL,
        )
    return shift


@router.patch(
    "/{shift_id}/activate",
    response_model=ShiftResponse,
    status_code=status.HTTP_200_OK,
)
def activate_shift(
    shift_id: int = Path(..., gt=0),
    updated_by: str = Query(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    ),
    db: Session = Depends(get_db),
) -> ShiftResponse:
    shift = ShiftService.activate_shift(
        db=db,
        shift_id=shift_id,
        updated_by=updated_by,
    )
    if shift is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=SHIFT_NOT_FOUND_DETAIL,
        )
    return shift


@router.delete(
    "/{shift_id}",
    response_model=ShiftResponse,
    status_code=status.HTTP_200_OK,
)
def delete_shift(
    shift_id: int = Path(..., gt=0),
    updated_by: str = Query(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    ),
    db: Session = Depends(get_db),
) -> ShiftResponse:
    shift = ShiftService.delete_shift(
        db=db,
        shift_id=shift_id,
        updated_by=updated_by,
    )
    if shift is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=SHIFT_NOT_FOUND_DETAIL,
        )
    return shift