from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, Path, Query, Response, status
from sqlalchemy.orm import Session

from app.core import get_db
from app.core.constants import DBConstants
from app.schemas.route_location_update_setting import (
    RouteLocationUpdateSettingAction,
    RouteLocationUpdateSettingCreate,
    RouteLocationUpdateSettingResponse,
    RouteLocationUpdateSettingUpdate,
)
from app.services.route_location_update_setting_service import (
    RouteLocationUpdateSettingService,
)

router = APIRouter()


@router.post(
    "/",
    response_model=RouteLocationUpdateSettingResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_route_location_update_setting(
    payload: RouteLocationUpdateSettingCreate,
    db: Session = Depends(get_db),
) -> RouteLocationUpdateSettingResponse:
    return RouteLocationUpdateSettingService.create_route_location_update_setting(
        db=db,
        payload=payload,
    )


@router.get(
    "/",
    response_model=list[RouteLocationUpdateSettingResponse],
    status_code=status.HTTP_200_OK,
)
def get_route_location_update_settings(
    skip: int = Query(DBConstants.DEFAULT_PAGE_SKIP, ge=0),
    limit: int = Query(
        DBConstants.DEFAULT_PAGE_LIMIT,
        ge=1,
        le=DBConstants.MAX_PAGE_LIMIT,
    ),
    department_id: int | None = Query(default=None, gt=0),
    division_id: int | None = Query(default=None, gt=0),
    route_id: int | None = Query(default=None, gt=0),
    allow_location_update: bool | None = Query(default=None),
    is_active: bool | None = Query(default=None),
    include_deleted: bool = Query(default=False),
    only_effective: bool = Query(default=False),
    work_date: date | None = Query(default=None),
    db: Session = Depends(get_db),
) -> list[RouteLocationUpdateSettingResponse]:
    return RouteLocationUpdateSettingService.get_route_location_update_settings(
        db=db,
        skip=skip,
        limit=limit,
        department_id=department_id,
        division_id=division_id,
        route_id=route_id,
        allow_location_update=allow_location_update,
        is_active=is_active,
        include_deleted=include_deleted,
        only_effective=only_effective,
        work_date=work_date,
    )


@router.get(
    "/{setting_id}",
    response_model=RouteLocationUpdateSettingResponse,
    status_code=status.HTTP_200_OK,
)
def get_route_location_update_setting(
    setting_id: int = Path(..., gt=0),
    include_deleted: bool = Query(default=False),
    db: Session = Depends(get_db),
) -> RouteLocationUpdateSettingResponse:
    return RouteLocationUpdateSettingService.get_route_location_update_setting(
        db=db,
        setting_id=setting_id,
        include_deleted=include_deleted,
    )


@router.patch(
    "/{setting_id}",
    response_model=RouteLocationUpdateSettingResponse,
    status_code=status.HTTP_200_OK,
)
def update_route_location_update_setting(
    payload: RouteLocationUpdateSettingUpdate,
    setting_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
) -> RouteLocationUpdateSettingResponse:
    return RouteLocationUpdateSettingService.update_route_location_update_setting(
        db=db,
        setting_id=setting_id,
        payload=payload,
    )


@router.delete(
    "/{setting_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_route_location_update_setting(
    payload: RouteLocationUpdateSettingAction,
    setting_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
) -> Response:
    RouteLocationUpdateSettingService.delete_route_location_update_setting(
        db=db,
        setting_id=setting_id,
        updated_by=payload.updated_by,
    )

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch(
    "/{setting_id}/deactivate",
    response_model=RouteLocationUpdateSettingResponse,
    status_code=status.HTTP_200_OK,
)
def deactivate_route_location_update_setting(
    payload: RouteLocationUpdateSettingAction,
    setting_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
) -> RouteLocationUpdateSettingResponse:
    return RouteLocationUpdateSettingService.deactivate_route_location_update_setting(
        db=db,
        setting_id=setting_id,
        updated_by=payload.updated_by,
    )


@router.patch(
    "/{setting_id}/activate",
    response_model=RouteLocationUpdateSettingResponse,
    status_code=status.HTTP_200_OK,
)
def activate_route_location_update_setting(
    payload: RouteLocationUpdateSettingAction,
    setting_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
) -> RouteLocationUpdateSettingResponse:
    return RouteLocationUpdateSettingService.activate_route_location_update_setting(
        db=db,
        setting_id=setting_id,
        updated_by=payload.updated_by,
    )