from __future__ import annotations

from fastapi import APIRouter, Depends, Path, Query, status
from sqlalchemy.orm import Session

from app.core import get_db
from app.core.constants import DBConstants
from app.schemas.divisions import DivisionResponse
from app.services.divisions import DivisionsService

router = APIRouter()


@router.get(
    "/",
    response_model=list[DivisionResponse],
    status_code=status.HTTP_200_OK,
)
def get_divisions(
    skip: int = Query(DBConstants.DEFAULT_PAGE_SKIP, ge=0),
    limit: int = Query(
        DBConstants.DEFAULT_PAGE_LIMIT,
        ge=1,
        le=DBConstants.MAX_PAGE_LIMIT,
    ),
    field_id: int | None = Query(default=None, gt=0),
    department_id: int | None = Query(default=None, gt=0),
    include_inactive: bool = Query(default=False),
    db: Session = Depends(get_db),
) -> list[DivisionResponse]:
    return DivisionsService.get_divisions(
        db=db,
        skip=skip,
        limit=limit,
        field_id=field_id,
        department_id=department_id,
        include_inactive=include_inactive,
    )


@router.get(
    "/{division_id}",
    response_model=DivisionResponse,
    status_code=status.HTTP_200_OK,
)
def get_division(
    division_id: int = Path(..., gt=0),
    include_inactive: bool = Query(default=False),
    db: Session = Depends(get_db),
) -> DivisionResponse:
    return DivisionsService.get_division(
        db=db,
        division_id=division_id,
        include_inactive=include_inactive,
    )