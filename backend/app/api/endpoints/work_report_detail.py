from fastapi import APIRouter, Depends, Path, Query, status
from sqlalchemy.orm import Session

from app.core import get_db
from app.core.constants import DBConstants
from app.schemas.work_report_detail import (
    WorkReportDetailAction,
    WorkReportDetailCreate,
    WorkReportDetailResponse,
    WorkReportDetailUpdate,
)
from app.services.work_report_detail import WorkReportDetailService


router = APIRouter(tags=["Work Report Details"])


@router.post(
    "/",
    response_model=WorkReportDetailResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_work_report_detail(
    payload: WorkReportDetailCreate,
    db: Session = Depends(get_db),
) -> WorkReportDetailResponse:
    return WorkReportDetailService.create_work_report_detail(
        db=db,
        payload=payload,
    )


@router.get(
    "/",
    response_model=list[WorkReportDetailResponse],
    status_code=status.HTTP_200_OK,
)
def get_work_report_details(
    skip: int = Query(DBConstants.DEFAULT_PAGE_SKIP, ge=0),
    limit: int = Query(
        DBConstants.DEFAULT_PAGE_LIMIT,
        ge=1,
        le=DBConstants.MAX_PAGE_LIMIT,
    ),
    work_report_id: int | None = Query(default=None, gt=0),
    section_no: int | None = Query(default=None, ge=3, le=4),
    is_active: bool | None = Query(default=None),
    include_deleted: bool = Query(default=False),
    db: Session = Depends(get_db),
) -> list[WorkReportDetailResponse]:
    return WorkReportDetailService.get_work_report_details(
        db=db,
        skip=skip,
        limit=limit,
        work_report_id=work_report_id,
        section_no=section_no,
        is_active=is_active,
        include_deleted=include_deleted,
    )


@router.get(
    "/{work_report_detail_id}",
    response_model=WorkReportDetailResponse,
    status_code=status.HTTP_200_OK,
)
def get_work_report_detail_by_id(
    work_report_detail_id: int = Path(..., gt=0),
    include_deleted: bool = Query(default=False),
    db: Session = Depends(get_db),
) -> WorkReportDetailResponse:
    return WorkReportDetailService.get_work_report_detail_by_id(
        db=db,
        work_report_detail_id=work_report_detail_id,
        include_deleted=include_deleted,
    )


@router.patch(
    "/{work_report_detail_id}",
    response_model=WorkReportDetailResponse,
    status_code=status.HTTP_200_OK,
)
def update_work_report_detail(
    payload: WorkReportDetailUpdate,
    work_report_detail_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
) -> WorkReportDetailResponse:
    return WorkReportDetailService.update_work_report_detail(
        db=db,
        work_report_detail_id=work_report_detail_id,
        payload=payload,
    )


@router.patch(
    "/{work_report_detail_id}/deactivate",
    response_model=WorkReportDetailResponse,
    status_code=status.HTTP_200_OK,
)
def deactivate_work_report_detail(
    payload: WorkReportDetailAction,
    work_report_detail_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
) -> WorkReportDetailResponse:
    return WorkReportDetailService.deactivate_work_report_detail(
        db=db,
        work_report_detail_id=work_report_detail_id,
        updated_by=payload.updated_by,
    )


@router.patch(
    "/{work_report_detail_id}/activate",
    response_model=WorkReportDetailResponse,
    status_code=status.HTTP_200_OK,
)
def activate_work_report_detail(
    payload: WorkReportDetailAction,
    work_report_detail_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
) -> WorkReportDetailResponse:
    return WorkReportDetailService.activate_work_report_detail(
        db=db,
        work_report_detail_id=work_report_detail_id,
        updated_by=payload.updated_by,
    )


@router.delete(
    "/{work_report_detail_id}",
    response_model=WorkReportDetailResponse,
    status_code=status.HTTP_200_OK,
)
def delete_work_report_detail(
    payload: WorkReportDetailAction,
    work_report_detail_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
) -> WorkReportDetailResponse:
    return WorkReportDetailService.delete_work_report_detail(
        db=db,
        work_report_detail_id=work_report_detail_id,
        updated_by=payload.updated_by,
    )