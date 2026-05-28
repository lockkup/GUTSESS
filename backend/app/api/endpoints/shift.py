from __future__ import annotations

from fastapi import APIRouter, Depends, Path, Query, Response, status
from sqlalchemy.orm import Session

from app.core import get_db
from app.core.constants import DBConstants
from app.schemas.shift import ShiftAction, ShiftCreate, ShiftResponse, ShiftUpdate
from app.services.shift import ShiftService

router = APIRouter()


@router.post(
    "/",
    response_model=ShiftResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_shift(
    payload: ShiftCreate,
    db: Session = Depends(get_db),
) -> ShiftResponse:
    return ShiftService.create_shift(
        db=db,
        payload=payload,
    )


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
    return ShiftService.get_shift_by_id(
        db=db,
        shift_id=shift_id,
        include_deleted=include_deleted,
    )


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
    return ShiftService.update_shift(
        db=db,
        shift_id=shift_id,
        payload=payload,
    )


@router.delete(
    "/{shift_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_shift(
    payload: ShiftAction,
    shift_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
) -> Response:
    ShiftService.delete_shift(
        db=db,
        shift_id=shift_id,
        updated_by=payload.updated_by,
    )

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch(
    "/{shift_id}/deactivate",
    response_model=ShiftResponse,
    status_code=status.HTTP_200_OK,
)
def deactivate_shift(
    payload: ShiftAction,
    shift_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
) -> ShiftResponse:
    return ShiftService.deactivate_shift(
        db=db,
        shift_id=shift_id,
        updated_by=payload.updated_by,
    )


@router.patch(
    "/{shift_id}/activate",
    response_model=ShiftResponse,
    status_code=status.HTTP_200_OK,
)
def activate_shift(
    payload: ShiftAction,
    shift_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
) -> ShiftResponse:
    return ShiftService.activate_shift(
        db=db,
        shift_id=shift_id,
        updated_by=payload.updated_by,
    )