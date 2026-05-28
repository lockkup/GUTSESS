from __future__ import annotations

from fastapi import APIRouter, Depends, Path, Query, status
from sqlalchemy.orm import Session

from app.core import get_db
from app.core.constants import DBConstants
from app.schemas.site_location_change import SiteLocationChangeResponse
from app.services.site_location_change import SiteLocationChangeService

router = APIRouter()


@router.get(
    "/",
    response_model=list[SiteLocationChangeResponse],
    status_code=status.HTTP_200_OK,
)
def get_site_location_changes(
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
    location_id: int | None = Query(default=None, gt=0),
    db: Session = Depends(get_db),
) -> list[SiteLocationChangeResponse]:
    return SiteLocationChangeService.get_site_location_changes(
        db=db,
        skip=skip,
        limit=limit,
        employee_code=employee_code,
        location_id=location_id,
    )


@router.get(
    "/{location_log_id}",
    response_model=SiteLocationChangeResponse,
    status_code=status.HTTP_200_OK,
)
def get_site_location_change_by_id(
    location_log_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
) -> SiteLocationChangeResponse:
    return SiteLocationChangeService.get_site_location_change_by_id(
        db=db,
        location_log_id=location_log_id,
    )