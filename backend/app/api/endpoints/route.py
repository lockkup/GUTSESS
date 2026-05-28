from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy.orm import Session

from app.core import get_db
from app.core.constants import DBConstants
from app.core.error_messages import ROUTE_NOT_FOUND_DETAIL
from app.schemas.route import RouteDetailResponse, RouteResponse
from app.services.route import RouteService

router = APIRouter()


@router.get(
    "/",
    response_model=list[RouteResponse],
    status_code=status.HTTP_200_OK,
)
def get_routes(
    skip: int = Query(DBConstants.DEFAULT_PAGE_SKIP, ge=0),
    limit: int = Query(
        DBConstants.DEFAULT_PAGE_LIMIT,
        ge=1,
        le=DBConstants.MAX_PAGE_LIMIT,
    ),
    is_active: bool | None = Query(default=None),
    db: Session = Depends(get_db),
) -> list[RouteResponse]:
    return RouteService.get_routes(
        db=db,
        skip=skip,
        limit=limit,
        is_active=is_active,
    )


@router.get(
    "/{route_id}",
    response_model=RouteDetailResponse,
    status_code=status.HTTP_200_OK,
)
def get_route_by_id(
    route_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
) -> RouteDetailResponse:
    route = RouteService.get_route_by_id(
        db=db,
        route_id=route_id,
    )

    if route is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=ROUTE_NOT_FOUND_DETAIL,
        )

    return route