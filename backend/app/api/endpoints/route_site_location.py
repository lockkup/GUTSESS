from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy.orm import Session

from app.core import get_db
from app.core.constants import DBConstants
from app.schemas.route_site_location import (
    RouteSiteLocationCreate,
    RouteSiteLocationResponse,
    RouteSiteLocationUpdate,
)
from app.services.route_site_location import RouteSiteLocationService

router = APIRouter()

ROUTE_SITE_LOCATION_NOT_FOUND_DETAIL = "Route site location not found"


@router.post(
    "/",
    response_model=RouteSiteLocationResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_route_site_location(
    payload: RouteSiteLocationCreate,
    db: Session = Depends(get_db),
) -> RouteSiteLocationResponse:
    return RouteSiteLocationService.create_route_site_location(db, payload)


@router.get(
    "/",
    response_model=list[RouteSiteLocationResponse],
    status_code=status.HTTP_200_OK,
)
def get_route_site_locations(
    skip: int = Query(DBConstants.DEFAULT_PAGE_SKIP, ge=0),
    limit: int = Query(
        DBConstants.DEFAULT_PAGE_LIMIT,
        ge=1,
        le=DBConstants.MAX_PAGE_LIMIT,
    ),
    routes_id: int | None = Query(default=None, gt=0),
    site_location_id: int | None = Query(default=None, gt=0),
    db: Session = Depends(get_db),
) -> list[RouteSiteLocationResponse]:
    return RouteSiteLocationService.get_route_site_locations(
        db=db,
        skip=skip,
        limit=limit,
        routes_id=routes_id,
        site_location_id=site_location_id,
    )


@router.get(
    "/{route_site_location_id}",
    response_model=RouteSiteLocationResponse,
    status_code=status.HTTP_200_OK,
)
def get_route_site_location_by_id(
    route_site_location_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
) -> RouteSiteLocationResponse:
    route_site_location = RouteSiteLocationService.get_route_site_location_by_id(
        db=db,
        route_site_location_id=route_site_location_id,
    )
    if route_site_location is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=ROUTE_SITE_LOCATION_NOT_FOUND_DETAIL,
        )
    return route_site_location


@router.patch(
    "/{route_site_location_id}",
    response_model=RouteSiteLocationResponse,
    status_code=status.HTTP_200_OK,
)
def update_route_site_location(
    payload: RouteSiteLocationUpdate,
    route_site_location_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
) -> RouteSiteLocationResponse:
    route_site_location = RouteSiteLocationService.update_route_site_location(
        db=db,
        route_site_location_id=route_site_location_id,
        payload=payload,
    )
    if route_site_location is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=ROUTE_SITE_LOCATION_NOT_FOUND_DETAIL,
        )
    return route_site_location


@router.delete(
    "/{route_site_location_id}",
    response_model=RouteSiteLocationResponse,
    status_code=status.HTTP_200_OK,
)
def delete_route_site_location(
    route_site_location_id: int = Path(..., gt=0),
    updated_by: str = Query(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    ),
    db: Session = Depends(get_db),
) -> RouteSiteLocationResponse:
    route_site_location = RouteSiteLocationService.delete_route_site_location(
        db=db,
        route_site_location_id=route_site_location_id,
        updated_by=updated_by,
    )
    if route_site_location is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=ROUTE_SITE_LOCATION_NOT_FOUND_DETAIL,
        )
    return route_site_location