from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy.orm import Session

from app.core import get_db
from app.core.constants import DBConstants
from app.schemas.site_location import (
    SiteLocationCreate,
    SiteLocationResponse,
    SiteLocationUpdate,
)
from app.services.site_location import SiteLocationService

router = APIRouter()

NOT_FOUND_DETAIL = "Site location not found"


@router.post(
    "/",
    response_model=SiteLocationResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_site_location(
    payload: SiteLocationCreate,
    db: Session = Depends(get_db),
) -> SiteLocationResponse:
    return SiteLocationService.create_site_location(db, payload)


@router.get(
    "/",
    response_model=list[SiteLocationResponse],
    status_code=status.HTTP_200_OK,
)
def get_site_locations(
    skip: int = Query(DBConstants.DEFAULT_PAGE_SKIP, ge=0),
    limit: int = Query(
        DBConstants.DEFAULT_PAGE_LIMIT,
        ge=1,
        le=DBConstants.MAX_PAGE_LIMIT,
    ),
    is_active: bool | None = Query(default=None),
    location_name: str | None = Query(
        default=None,
        min_length=1,
        max_length=DBConstants.LOCATION_NAME_LENGTH,
    ),
    include_deleted: bool = Query(default=False),
    db: Session = Depends(get_db),
) -> list[SiteLocationResponse]:
    return SiteLocationService.get_site_locations(
        db=db,
        skip=skip,
        limit=limit,
        is_active=is_active,
        location_name=location_name,
        include_deleted=include_deleted,
    )


@router.get(
    "/{location_id}",
    response_model=SiteLocationResponse,
    status_code=status.HTTP_200_OK,
)
def get_site_location_by_id(
    location_id: int = Path(..., gt=0),
    include_deleted: bool = Query(default=False),
    db: Session = Depends(get_db),
) -> SiteLocationResponse:
    site_location = SiteLocationService.get_site_location_by_id(
        db=db,
        location_id=location_id,
        include_deleted=include_deleted,
    )
    if site_location is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=NOT_FOUND_DETAIL,
        )
    return site_location


@router.patch(
    "/{location_id}",
    response_model=SiteLocationResponse,
    status_code=status.HTTP_200_OK,
)
def update_site_location(
    payload: SiteLocationUpdate,
    location_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
) -> SiteLocationResponse:
    site_location = SiteLocationService.update_site_location(
        db=db,
        location_id=location_id,
        payload=payload,
    )
    if site_location is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=NOT_FOUND_DETAIL,
        )
    return site_location


@router.patch(
    "/{location_id}/deactivate",
    response_model=SiteLocationResponse,
    status_code=status.HTTP_200_OK,
)
def deactivate_site_location(
    location_id: int = Path(..., gt=0),
    updated_by: str = Query(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    ),
    db: Session = Depends(get_db),
) -> SiteLocationResponse:
    site_location = SiteLocationService.deactivate_site_location(
        db=db,
        location_id=location_id,
        updated_by=updated_by,
    )
    if site_location is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=NOT_FOUND_DETAIL,
        )
    return site_location


@router.patch(
    "/{location_id}/activate",
    response_model=SiteLocationResponse,
    status_code=status.HTTP_200_OK,
)
def activate_site_location(
    location_id: int = Path(..., gt=0),
    updated_by: str = Query(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    ),
    db: Session = Depends(get_db),
) -> SiteLocationResponse:
    site_location = SiteLocationService.activate_site_location(
        db=db,
        location_id=location_id,
        updated_by=updated_by,
    )
    if site_location is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=NOT_FOUND_DETAIL,
        )
    return site_location


@router.delete(
    "/{location_id}",
    response_model=SiteLocationResponse,
    status_code=status.HTTP_200_OK,
)
def delete_site_location(
    location_id: int = Path(..., gt=0),
    updated_by: str = Query(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    ),
    db: Session = Depends(get_db),
) -> SiteLocationResponse:
    site_location = SiteLocationService.delete_site_location(
        db=db,
        location_id=location_id,
        updated_by=updated_by,
    )
    if site_location is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=NOT_FOUND_DETAIL,
        )
    return site_location