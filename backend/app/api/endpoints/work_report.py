from fastapi import APIRouter, Body, Depends, Path, Query, status
from sqlalchemy.orm import Session

from app.core import get_db
from app.core.constants import DBConstants
from app.schemas.work_report import (
    WorkReportAction,
    WorkReportCreate,
    WorkReportResponse,
    WorkReportUpdate,
)
from app.services.work_report import WorkReportService


router = APIRouter(tags=["Work Reports"])


@router.post(
    "/",
    response_model=WorkReportResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_work_report(
    payload: WorkReportCreate,
    db: Session = Depends(get_db),
) -> WorkReportResponse:
    return WorkReportService.create_work_report(
        db=db,
        payload=payload,
    )


@router.post(
    "/time-record/{time_record_id}/ensure",
    response_model=WorkReportResponse,
    status_code=status.HTTP_200_OK,
)
def ensure_work_report_for_time_record(
    time_record_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
) -> WorkReportResponse:
    return WorkReportService.ensure_work_report_for_time_record(
        db=db,
        time_record_id=time_record_id,
    )


@router.post(
    "/{work_report_id}/signature",
    response_model=WorkReportResponse,
    status_code=status.HTTP_200_OK,
)
def save_work_report_signature(
    work_report_id: int = Path(..., gt=0),
    signature_base64: str = Body(..., min_length=1),
    updated_by: str = Body(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    ),
    db: Session = Depends(get_db),
) -> WorkReportResponse:
    return WorkReportService.save_work_report_signature(
        db=db,
        work_report_id=work_report_id,
        signature_base64=signature_base64,
        updated_by=updated_by,
    )


@router.get(
    "/",
    response_model=list[WorkReportResponse],
    status_code=status.HTTP_200_OK,
)
def get_work_reports(
    skip: int = Query(DBConstants.DEFAULT_PAGE_SKIP, ge=0),
    limit: int = Query(
        DBConstants.DEFAULT_PAGE_LIMIT,
        ge=1,
        le=DBConstants.MAX_PAGE_LIMIT,
    ),
    time_record_id: int | None = Query(default=None, gt=0),
    purpose_id: int | None = Query(default=None, gt=0),
    is_active: bool | None = Query(default=None),
    include_deleted: bool = Query(default=False),
    db: Session = Depends(get_db),
) -> list[WorkReportResponse]:
    return WorkReportService.get_work_reports(
        db=db,
        skip=skip,
        limit=limit,
        time_record_id=time_record_id,
        purpose_id=purpose_id,
        is_active=is_active,
        include_deleted=include_deleted,
    )


@router.get(
    "/time-record/{time_record_id}",
    response_model=WorkReportResponse,
    status_code=status.HTTP_200_OK,
)
def get_work_report_by_time_record_id(
    time_record_id: int = Path(..., gt=0),
    include_deleted: bool = Query(default=False),
    db: Session = Depends(get_db),
) -> WorkReportResponse:
    return WorkReportService.get_work_report_by_time_record_id(
        db=db,
        time_record_id=time_record_id,
        include_deleted=include_deleted,
    )


@router.get(
    "/{work_report_id}",
    response_model=WorkReportResponse,
    status_code=status.HTTP_200_OK,
)
def get_work_report_by_id(
    work_report_id: int = Path(..., gt=0),
    include_deleted: bool = Query(default=False),
    db: Session = Depends(get_db),
) -> WorkReportResponse:
    return WorkReportService.get_work_report_by_id(
        db=db,
        work_report_id=work_report_id,
        include_deleted=include_deleted,
    )


@router.patch(
    "/{work_report_id}",
    response_model=WorkReportResponse,
    status_code=status.HTTP_200_OK,
)
def update_work_report(
    payload: WorkReportUpdate,
    work_report_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
) -> WorkReportResponse:
    return WorkReportService.update_work_report(
        db=db,
        work_report_id=work_report_id,
        payload=payload,
    )


@router.patch(
    "/{work_report_id}/cancel",
    response_model=WorkReportResponse,
    status_code=status.HTTP_200_OK,
)
def cancel_work_report(
    payload: WorkReportAction,
    work_report_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
) -> WorkReportResponse:
    return WorkReportService.cancel_work_report(
        db=db,
        work_report_id=work_report_id,
        updated_by=payload.updated_by,
    )


@router.patch(
    "/{work_report_id}/deactivate",
    response_model=WorkReportResponse,
    status_code=status.HTTP_200_OK,
)
def deactivate_work_report(
    payload: WorkReportAction,
    work_report_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
) -> WorkReportResponse:
    return WorkReportService.deactivate_work_report(
        db=db,
        work_report_id=work_report_id,
        updated_by=payload.updated_by,
    )


@router.patch(
    "/{work_report_id}/activate",
    response_model=WorkReportResponse,
    status_code=status.HTTP_200_OK,
)
def activate_work_report(
    payload: WorkReportAction,
    work_report_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
) -> WorkReportResponse:
    return WorkReportService.activate_work_report(
        db=db,
        work_report_id=work_report_id,
        updated_by=payload.updated_by,
    )


@router.delete(
    "/{work_report_id}",
    response_model=WorkReportResponse,
    status_code=status.HTTP_200_OK,
)
def delete_work_report(
    payload: WorkReportAction,
    work_report_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
) -> WorkReportResponse:
    return WorkReportService.delete_work_report(
        db=db,
        work_report_id=work_report_id,
        updated_by=payload.updated_by,
    )
