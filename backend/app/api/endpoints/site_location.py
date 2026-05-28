from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, Path, Query, Response, status
from sqlalchemy.orm import Session

from app.core import get_db
from app.core.constants import DBConstants
from app.schemas.site_location import (
    SiteLocationAction,
    SiteLocationCreate,
    SiteLocationResponse,
    SiteLocationUpdate,
)
from app.services.site_location import SiteLocationService

router = APIRouter()


@router.post(
    "/",
    response_model=SiteLocationResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_site_location(
    payload: SiteLocationCreate,
    db: Session = Depends(get_db),
) -> SiteLocationResponse:
    return SiteLocationService.create_site_location(
        db=db,
        payload=payload,
    )


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
    contract_code: str | None = Query(
        default=None,
        min_length=1,
        max_length=DBConstants.CONTRACT_CODE_LENGTH,
    ),
    location_name: str | None = Query(
        default=None,
        min_length=1,
        max_length=DBConstants.LOCATION_NAME_LENGTH,
    ),
    by_contract: int | None = Query(
        default=None,
        ge=1,
    ),
    effective_from: date | None = Query(default=None),
    effective_to: date | None = Query(default=None),
    include_deleted: bool = Query(default=False),
    db: Session = Depends(get_db),
) -> list[SiteLocationResponse]:
    return SiteLocationService.get_site_locations(
        db=db,
        skip=skip,
        limit=limit,
        is_active=is_active,
        contract_code=contract_code,
        location_name=location_name,
        by_contract=by_contract,
        effective_from=effective_from,
        effective_to=effective_to,
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
    return SiteLocationService.get_site_location_by_id(
        db=db,
        location_id=location_id,
        include_deleted=include_deleted,
    )


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
    return SiteLocationService.update_site_location(
        db=db,
        location_id=location_id,
        payload=payload,
    )


@router.patch(
    "/{location_id}/deactivate",
    response_model=SiteLocationResponse,
    status_code=status.HTTP_200_OK,
)
def deactivate_site_location(
    payload: SiteLocationAction,
    location_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
) -> SiteLocationResponse:
    return SiteLocationService.deactivate_site_location(
        db=db,
        location_id=location_id,
        updated_by=payload.updated_by,
    )


@router.patch(
    "/{location_id}/activate",
    response_model=SiteLocationResponse,
    status_code=status.HTTP_200_OK,
)
def activate_site_location(
    payload: SiteLocationAction,
    location_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
) -> SiteLocationResponse:
    return SiteLocationService.activate_site_location(
        db=db,
        location_id=location_id,
        updated_by=payload.updated_by,
    )


@router.delete(
    "/{location_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_site_location(
    payload: SiteLocationAction,
    location_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
) -> Response:
    SiteLocationService.delete_site_location(
        db=db,
        location_id=location_id,
        updated_by=payload.updated_by,
    )

    return Response(status_code=status.HTTP_204_NO_CONTENT)