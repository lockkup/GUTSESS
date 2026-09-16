from __future__ import annotations

from fastapi import APIRouter, Depends, Path, Query, status
from sqlalchemy.orm import Session

from app.core import get_db
from app.core.constants import DBConstants
from app.schemas.work_report_item_type import (
    WorkReportItemTypeAction,
    WorkReportItemTypeCreate,
    WorkReportItemTypeResponse,
    WorkReportItemTypeUpdate,
)
from app.services.work_report_item_type import WorkReportItemTypeService


router = APIRouter(tags=["Work Report Item Types"])


@router.post(
    "/",
    response_model=WorkReportItemTypeResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_work_report_item_type(
    payload: WorkReportItemTypeCreate,
    db: Session = Depends(get_db),
) -> WorkReportItemTypeResponse:
    return WorkReportItemTypeService.create_work_report_item_type(
        db=db,
        payload=payload,
    )


@router.get(
    "/",
    response_model=list[WorkReportItemTypeResponse],
    status_code=status.HTTP_200_OK,
)
def get_work_report_item_types(
    skip: int = Query(DBConstants.DEFAULT_PAGE_SKIP, ge=0),
    limit: int = Query(
        DBConstants.DEFAULT_PAGE_LIMIT,
        ge=1,
        le=DBConstants.MAX_PAGE_LIMIT,
    ),
    work_item_code: str | None = Query(
        default=None,
        min_length=1,
        max_length=30,
    ),
    work_item_name: str | None = Query(
        default=None,
        min_length=1,
        max_length=100,
    ),
    require_detail: bool | None = Query(default=None),
    is_active: bool | None = Query(default=None),
    include_deleted: bool = Query(default=False),
    db: Session = Depends(get_db),
) -> list[WorkReportItemTypeResponse]:
    return WorkReportItemTypeService.get_work_report_item_types(
        db=db,
        skip=skip,
        limit=limit,
        work_item_code=work_item_code,
        work_item_name=work_item_name,
        require_detail=require_detail,
        is_active=is_active,
        include_deleted=include_deleted,
    )


@router.get(
    "/{work_item_type_id}",
    response_model=WorkReportItemTypeResponse,
    status_code=status.HTTP_200_OK,
)
def get_work_report_item_type_by_id(
    work_item_type_id: int = Path(..., gt=0),
    include_deleted: bool = Query(default=False),
    db: Session = Depends(get_db),
) -> WorkReportItemTypeResponse:
    return WorkReportItemTypeService.get_work_report_item_type_by_id(
        db=db,
        work_item_type_id=work_item_type_id,
        include_deleted=include_deleted,
    )


@router.patch(
    "/{work_item_type_id}",
    response_model=WorkReportItemTypeResponse,
    status_code=status.HTTP_200_OK,
)
def update_work_report_item_type(
    payload: WorkReportItemTypeUpdate,
    work_item_type_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
) -> WorkReportItemTypeResponse:
    return WorkReportItemTypeService.update_work_report_item_type(
        db=db,
        work_item_type_id=work_item_type_id,
        payload=payload,
    )


@router.patch(
    "/{work_item_type_id}/deactivate",
    response_model=WorkReportItemTypeResponse,
    status_code=status.HTTP_200_OK,
)
def deactivate_work_report_item_type(
    payload: WorkReportItemTypeAction,
    work_item_type_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
) -> WorkReportItemTypeResponse:
    return WorkReportItemTypeService.deactivate_work_report_item_type(
        db=db,
        work_item_type_id=work_item_type_id,
        updated_by=payload.updated_by,
    )


@router.patch(
    "/{work_item_type_id}/activate",
    response_model=WorkReportItemTypeResponse,
    status_code=status.HTTP_200_OK,
)
def activate_work_report_item_type(
    payload: WorkReportItemTypeAction,
    work_item_type_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
) -> WorkReportItemTypeResponse:
    return WorkReportItemTypeService.activate_work_report_item_type(
        db=db,
        work_item_type_id=work_item_type_id,
        updated_by=payload.updated_by,
    )


@router.delete(
    "/{work_item_type_id}",
    response_model=WorkReportItemTypeResponse,
    status_code=status.HTTP_200_OK,
)
def delete_work_report_item_type(
    payload: WorkReportItemTypeAction,
    work_item_type_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
) -> WorkReportItemTypeResponse:
    return WorkReportItemTypeService.delete_work_report_item_type(
        db=db,
        work_item_type_id=work_item_type_id,
        updated_by=payload.updated_by,
    )
