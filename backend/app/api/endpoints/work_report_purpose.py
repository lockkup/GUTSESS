from fastapi import APIRouter, Depends, Path, Query, status
from sqlalchemy.orm import Session

from app.core import get_db
from app.core.constants import DBConstants
from app.schemas.work_report_purpose import (
    WorkReportPurposeAction,
    WorkReportPurposeCreate,
    WorkReportPurposeResponse,
    WorkReportPurposeUpdate,
)
from app.services.work_report_purpose import WorkReportPurposeService


router = APIRouter(tags=["Work Report Purposes"])


@router.post(
    "/",
    response_model=WorkReportPurposeResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_work_report_purpose(
    payload: WorkReportPurposeCreate,
    db: Session = Depends(get_db),
) -> WorkReportPurposeResponse:
    return WorkReportPurposeService.create_work_report_purpose(
        db=db,
        payload=payload,
    )


@router.get(
    "/",
    response_model=list[WorkReportPurposeResponse],
    status_code=status.HTTP_200_OK,
)
def get_work_report_purposes(
    skip: int = Query(DBConstants.DEFAULT_PAGE_SKIP, ge=0),
    limit: int = Query(
        DBConstants.DEFAULT_PAGE_LIMIT,
        ge=1,
        le=DBConstants.MAX_PAGE_LIMIT,
    ),
    purpose_code: str | None = Query(
        default=None,
        min_length=1,
        max_length=30,
    ),
    purpose_name: str | None = Query(
        default=None,
        min_length=1,
        max_length=100,
    ),
    is_active: bool | None = Query(default=None),
    include_deleted: bool = Query(default=False),
    db: Session = Depends(get_db),
) -> list[WorkReportPurposeResponse]:
    return WorkReportPurposeService.get_work_report_purposes(
        db=db,
        skip=skip,
        limit=limit,
        purpose_code=purpose_code,
        purpose_name=purpose_name,
        is_active=is_active,
        include_deleted=include_deleted,
    )


@router.get(
    "/{purpose_id}",
    response_model=WorkReportPurposeResponse,
    status_code=status.HTTP_200_OK,
)
def get_work_report_purpose_by_id(
    purpose_id: int = Path(..., gt=0),
    include_deleted: bool = Query(default=False),
    db: Session = Depends(get_db),
) -> WorkReportPurposeResponse:
    return WorkReportPurposeService.get_work_report_purpose_by_id(
        db=db,
        purpose_id=purpose_id,
        include_deleted=include_deleted,
    )


@router.patch(
    "/{purpose_id}",
    response_model=WorkReportPurposeResponse,
    status_code=status.HTTP_200_OK,
)
def update_work_report_purpose(
    payload: WorkReportPurposeUpdate,
    purpose_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
) -> WorkReportPurposeResponse:
    return WorkReportPurposeService.update_work_report_purpose(
        db=db,
        purpose_id=purpose_id,
        payload=payload,
    )


@router.patch(
    "/{purpose_id}/deactivate",
    response_model=WorkReportPurposeResponse,
    status_code=status.HTTP_200_OK,
)
def deactivate_work_report_purpose(
    payload: WorkReportPurposeAction,
    purpose_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
) -> WorkReportPurposeResponse:
    return WorkReportPurposeService.deactivate_work_report_purpose(
        db=db,
        purpose_id=purpose_id,
        updated_by=payload.updated_by,
    )


@router.patch(
    "/{purpose_id}/activate",
    response_model=WorkReportPurposeResponse,
    status_code=status.HTTP_200_OK,
)
def activate_work_report_purpose(
    payload: WorkReportPurposeAction,
    purpose_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
) -> WorkReportPurposeResponse:
    return WorkReportPurposeService.activate_work_report_purpose(
        db=db,
        purpose_id=purpose_id,
        updated_by=payload.updated_by,
    )


@router.delete(
    "/{purpose_id}",
    response_model=WorkReportPurposeResponse,
    status_code=status.HTTP_200_OK,
)
def delete_work_report_purpose(
    payload: WorkReportPurposeAction,
    purpose_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
) -> WorkReportPurposeResponse:
    return WorkReportPurposeService.delete_work_report_purpose(
        db=db,
        purpose_id=purpose_id,
        updated_by=payload.updated_by,
    )