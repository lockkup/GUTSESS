from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, Path, Query, Response, status
from sqlalchemy.orm import Session

from app.core import get_db
from app.core.constants import DBConstants
from app.schemas.route_site_location import (
    RouteSiteLocationAction,
    RouteSiteLocationCreate,
    RouteSiteLocationResponse,
    RouteSiteLocationUpdate,
)
from app.services.route_site_location import RouteSiteLocationService

router = APIRouter()


@router.post(
    "/",
    response_model=RouteSiteLocationResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_route_site_location(
    payload: RouteSiteLocationCreate,
    db: Session = Depends(get_db),
) -> RouteSiteLocationResponse:
    return RouteSiteLocationService.create_route_site_location(
        db=db,
        payload=payload,
    )


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
    division_id: int | None = Query(default=None, gt=0),
    location_id: int | None = Query(default=None, gt=0),
    is_active: bool | None = Query(default=None),
    include_deleted: bool = Query(default=False),
    only_effective: bool = Query(default=False),
    work_date: date | None = Query(default=None),
    db: Session = Depends(get_db),
) -> list[RouteSiteLocationResponse]:
    return RouteSiteLocationService.get_route_site_locations(
        db=db,
        skip=skip,
        limit=limit,
        routes_id=routes_id,
        division_id=division_id,
        location_id=location_id,
        is_active=is_active,
        include_deleted=include_deleted,
        only_effective=only_effective,
        work_date=work_date,
    )


@router.get(
    "/{route_site_location_id}",
    response_model=RouteSiteLocationResponse,
    status_code=status.HTTP_200_OK,
)
def get_route_site_location(
    route_site_location_id: int = Path(..., gt=0),
    include_deleted: bool = Query(default=False),
    db: Session = Depends(get_db),
) -> RouteSiteLocationResponse:
    return RouteSiteLocationService.get_route_site_location(
        db=db,
        route_site_location_id=route_site_location_id,
        include_deleted=include_deleted,
    )


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
    return RouteSiteLocationService.update_route_site_location(
        db=db,
        route_site_location_id=route_site_location_id,
        payload=payload,
    )


@router.delete(
    "/{route_site_location_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_route_site_location(
    payload: RouteSiteLocationAction,
    route_site_location_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
) -> Response:
    RouteSiteLocationService.delete_route_site_location(
        db=db,
        route_site_location_id=route_site_location_id,
        updated_by=payload.updated_by,
    )

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch(
    "/{route_site_location_id}/deactivate",
    response_model=RouteSiteLocationResponse,
    status_code=status.HTTP_200_OK,
)
def deactivate_route_site_location(
    payload: RouteSiteLocationAction,
    route_site_location_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
) -> RouteSiteLocationResponse:
    return RouteSiteLocationService.deactivate_route_site_location(
        db=db,
        route_site_location_id=route_site_location_id,
        updated_by=payload.updated_by,
    )


@router.patch(
    "/{route_site_location_id}/activate",
    response_model=RouteSiteLocationResponse,
    status_code=status.HTTP_200_OK,
)
def activate_route_site_location(
    payload: RouteSiteLocationAction,
    route_site_location_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
) -> RouteSiteLocationResponse:
    return RouteSiteLocationService.activate_route_site_location(
        db=db,
        route_site_location_id=route_site_location_id,
        updated_by=payload.updated_by,
    )