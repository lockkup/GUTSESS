from __future__ import annotations

from fastapi import APIRouter, Depends, Path, Query, status
from sqlalchemy.orm import Session

from app.core import get_db
from app.core.constants import DBConstants
from app.schemas.route_site_location_change import RouteSiteLocationChangeResponse
from app.services.route_site_location_change import RouteSiteLocationChangeService

router = APIRouter()


@router.get(
    "/",
    response_model=list[RouteSiteLocationChangeResponse],
    status_code=status.HTTP_200_OK,
)
def get_route_site_location_changes(
    skip: int = Query(DBConstants.DEFAULT_PAGE_SKIP, ge=0),
    limit: int = Query(
        DBConstants.DEFAULT_PAGE_LIMIT,
        ge=1,
        le=DBConstants.MAX_PAGE_LIMIT,
    ),
    db: Session = Depends(get_db),
) -> list[RouteSiteLocationChangeResponse]:
    return RouteSiteLocationChangeService.get_route_site_location_changes(
        db=db,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/{route_site_location_change_id}",
    response_model=RouteSiteLocationChangeResponse,
    status_code=status.HTTP_200_OK,
)
def get_route_site_location_change_by_id(
    route_site_location_change_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
) -> RouteSiteLocationChangeResponse:
    return RouteSiteLocationChangeService.get_route_site_location_change_by_id(
        db=db,
        route_site_location_change_id=route_site_location_change_id,
    )