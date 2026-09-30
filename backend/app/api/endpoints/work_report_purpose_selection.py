from fastapi import APIRouter, Depends, Path, Query, status
from sqlalchemy.orm import Session

from app.core import get_db
from app.core.constants import DBConstants
from app.schemas.work_report_purpose_selection import (
    WorkReportPurposeSelectionAction,
    WorkReportPurposeSelectionCreate,
    WorkReportPurposeSelectionResponse,
    WorkReportPurposeSelectionUpdate,
)
from app.services.work_report_purpose_selection import (
    WorkReportPurposeSelectionService,
)


router = APIRouter(tags=["Work Report Purpose Selections"])


@router.post(
    "/",
    response_model=WorkReportPurposeSelectionResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_work_report_purpose_selection(
    payload: WorkReportPurposeSelectionCreate,
    db: Session = Depends(get_db),
) -> WorkReportPurposeSelectionResponse:
    return (
        WorkReportPurposeSelectionService
        .create_work_report_purpose_selection(
            db=db,
            payload=payload,
        )
    )


@router.get(
    "/",
    response_model=list[WorkReportPurposeSelectionResponse],
    status_code=status.HTTP_200_OK,
)
def get_work_report_purpose_selections(
    skip: int = Query(DBConstants.DEFAULT_PAGE_SKIP, ge=0),
    limit: int = Query(
        DBConstants.DEFAULT_PAGE_LIMIT,
        ge=1,
        le=DBConstants.MAX_PAGE_LIMIT,
    ),
    work_report_id: int | None = Query(default=None, gt=0),
    purpose_id: int | None = Query(default=None, gt=0),
    is_active: bool | None = Query(default=None),
    include_deleted: bool = Query(default=False),
    db: Session = Depends(get_db),
) -> list[WorkReportPurposeSelectionResponse]:
    return (
        WorkReportPurposeSelectionService
        .get_work_report_purpose_selections(
            db=db,
            skip=skip,
            limit=limit,
            work_report_id=work_report_id,
            purpose_id=purpose_id,
            is_active=is_active,
            include_deleted=include_deleted,
        )
    )


@router.get(
    "/{work_report_purpose_selection_id}",
    response_model=WorkReportPurposeSelectionResponse,
    status_code=status.HTTP_200_OK,
)
def get_work_report_purpose_selection_by_id(
    work_report_purpose_selection_id: int = Path(..., gt=0),
    include_deleted: bool = Query(default=False),
    db: Session = Depends(get_db),
) -> WorkReportPurposeSelectionResponse:
    return (
        WorkReportPurposeSelectionService
        .get_work_report_purpose_selection_by_id(
            db=db,
            work_report_purpose_selection_id=(
                work_report_purpose_selection_id
            ),
            include_deleted=include_deleted,
        )
    )


@router.patch(
    "/{work_report_purpose_selection_id}",
    response_model=WorkReportPurposeSelectionResponse,
    status_code=status.HTTP_200_OK,
)
def update_work_report_purpose_selection(
    payload: WorkReportPurposeSelectionUpdate,
    work_report_purpose_selection_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
) -> WorkReportPurposeSelectionResponse:
    return (
        WorkReportPurposeSelectionService
        .update_work_report_purpose_selection(
            db=db,
            work_report_purpose_selection_id=(
                work_report_purpose_selection_id
            ),
            payload=payload,
        )
    )


@router.patch(
    "/{work_report_purpose_selection_id}/deactivate",
    response_model=WorkReportPurposeSelectionResponse,
    status_code=status.HTTP_200_OK,
)
def deactivate_work_report_purpose_selection(
    payload: WorkReportPurposeSelectionAction,
    work_report_purpose_selection_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
) -> WorkReportPurposeSelectionResponse:
    return (
        WorkReportPurposeSelectionService
        .deactivate_work_report_purpose_selection(
            db=db,
            work_report_purpose_selection_id=(
                work_report_purpose_selection_id
            ),
            updated_by=payload.updated_by,
        )
    )


@router.patch(
    "/{work_report_purpose_selection_id}/activate",
    response_model=WorkReportPurposeSelectionResponse,
    status_code=status.HTTP_200_OK,
)
def activate_work_report_purpose_selection(
    payload: WorkReportPurposeSelectionAction,
    work_report_purpose_selection_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
) -> WorkReportPurposeSelectionResponse:
    return (
        WorkReportPurposeSelectionService
        .activate_work_report_purpose_selection(
            db=db,
            work_report_purpose_selection_id=(
                work_report_purpose_selection_id
            ),
            updated_by=payload.updated_by,
        )
    )


@router.delete(
    "/{work_report_purpose_selection_id}",
    response_model=WorkReportPurposeSelectionResponse,
    status_code=status.HTTP_200_OK,
)
def delete_work_report_purpose_selection(
    payload: WorkReportPurposeSelectionAction,
    work_report_purpose_selection_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
) -> WorkReportPurposeSelectionResponse:
    return (
        WorkReportPurposeSelectionService
        .delete_work_report_purpose_selection(
            db=db,
            work_report_purpose_selection_id=(
                work_report_purpose_selection_id
            ),
            updated_by=payload.updated_by,
        )
    )
