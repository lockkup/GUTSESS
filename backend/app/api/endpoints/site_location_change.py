from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy.orm import Session

from app.core import get_db
from app.core.constants import DBConstants
from app.schemas.site_location_change import (
    SiteLocationChangeCreate,
    SiteLocationChangeResponse,
    SiteLocationChangeUpdate,
)
from app.services.site_location_change import SiteLocationChangeService

router = APIRouter()

SITE_LOCATION_CHANGE_NOT_FOUND_DETAIL = "Site location change not found"


@router.post(
    "/",
    response_model=SiteLocationChangeResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_site_location_change(
    payload: SiteLocationChangeCreate,
    db: Session = Depends(get_db),
) -> SiteLocationChangeResponse:
    return SiteLocationChangeService.create_site_location_change(db, payload)


@router.get(
    "/{location_log_id}",
    response_model=SiteLocationChangeResponse,
    status_code=status.HTTP_200_OK,
)
def get_site_location_change_by_id(
    location_log_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
) -> SiteLocationChangeResponse:
    site_location_change = SiteLocationChangeService.get_site_location_change_by_id(
        db,
        location_log_id,
    )
    if site_location_change is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=SITE_LOCATION_CHANGE_NOT_FOUND_DETAIL,
        )
    return site_location_change


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
        None,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    ),
    location_id: int | None = Query(None, gt=0),
    db: Session = Depends(get_db),
) -> list[SiteLocationChangeResponse]:
    return SiteLocationChangeService.get_site_location_changes(
        db=db,
        skip=skip,
        limit=limit,
        employee_code=employee_code,
        location_id=location_id,
    )


@router.patch(
    "/{location_log_id}",
    response_model=SiteLocationChangeResponse,
    status_code=status.HTTP_200_OK,
)
def update_site_location_change(
    payload: SiteLocationChangeUpdate,
    location_log_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
) -> SiteLocationChangeResponse:
    site_location_change = SiteLocationChangeService.update_site_location_change(
        db,
        location_log_id,
        payload,
    )
    if site_location_change is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=SITE_LOCATION_CHANGE_NOT_FOUND_DETAIL,
        )
    return site_location_change