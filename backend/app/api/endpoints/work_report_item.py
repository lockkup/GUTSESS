from fastapi import APIRouter, Depends, Path, Query, status

from sqlalchemy.orm import Session

from app.core import get_db
from app.core.constants import DBConstants

from app.schemas.time_record_image import TimeRecordImageResponse
from app.schemas.work_report_item import (
    WorkReportItemAction,
    WorkReportItemCreate,
    WorkReportItemImagesSave,
    WorkReportItemResponse,
    WorkReportItemUpdate,
)
from app.services.work_report_item import WorkReportItemService


router = APIRouter(tags=["Work Report Items"])


@router.post(
    "/",
    response_model=WorkReportItemResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_work_report_item(
    payload: WorkReportItemCreate,
    db: Session = Depends(get_db),
) -> WorkReportItemResponse:
    return WorkReportItemService.create_work_report_item(
        db=db,
        payload=payload,
    )


@router.get(
    "/",
    response_model=list[WorkReportItemResponse],
    status_code=status.HTTP_200_OK,
)
def get_work_report_items(
    skip: int = Query(DBConstants.DEFAULT_PAGE_SKIP, ge=0),
    limit: int = Query(
        DBConstants.DEFAULT_PAGE_LIMIT,
        ge=1,
        le=DBConstants.MAX_PAGE_LIMIT,
    ),
    work_report_id: int | None = Query(default=None, gt=0),
    work_item_type_id: int | None = Query(default=None, gt=0),
    is_active: bool | None = Query(default=None),
    include_deleted: bool = Query(default=False),
    db: Session = Depends(get_db),
) -> list[WorkReportItemResponse]:
    return WorkReportItemService.get_work_report_items(
        db=db,
        skip=skip,
        limit=limit,
        work_report_id=work_report_id,
        work_item_type_id=work_item_type_id,
        is_active=is_active,
        include_deleted=include_deleted,
    )


@router.get(
    "/{work_report_item_id}/images",
    response_model=list[TimeRecordImageResponse],
    status_code=status.HTTP_200_OK,
)
def get_work_report_item_images(
    work_report_item_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
) -> list[TimeRecordImageResponse]:
    return WorkReportItemService.get_work_report_item_images(
        db=db,
        work_report_item_id=work_report_item_id,
    )


@router.post(
    "/{work_report_item_id}/images",
    response_model=list[TimeRecordImageResponse],
    status_code=status.HTTP_200_OK,
)
def save_work_report_item_images(
    payload: WorkReportItemImagesSave,
    work_report_item_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
) -> list[TimeRecordImageResponse]:
    return WorkReportItemService.save_work_report_item_images(
        db=db,
        work_report_item_id=work_report_item_id,
        image_base64_values=payload.image_base64_values,
        updated_by=payload.updated_by,
        image_ids=payload.image_ids,
        deleted_image_ids=payload.deleted_image_ids,
    )


@router.get(
    "/{work_report_item_id}",
    response_model=WorkReportItemResponse,
    status_code=status.HTTP_200_OK,
)
def get_work_report_item_by_id(
    work_report_item_id: int = Path(..., gt=0),
    include_deleted: bool = Query(default=False),
    db: Session = Depends(get_db),
) -> WorkReportItemResponse:
    return WorkReportItemService.get_work_report_item_by_id(
        db=db,
        work_report_item_id=work_report_item_id,
        include_deleted=include_deleted,
    )


@router.patch(
    "/{work_report_item_id}",
    response_model=WorkReportItemResponse,
    status_code=status.HTTP_200_OK,
)
def update_work_report_item(
    payload: WorkReportItemUpdate,
    work_report_item_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
) -> WorkReportItemResponse:
    return WorkReportItemService.update_work_report_item(
        db=db,
        work_report_item_id=work_report_item_id,
        payload=payload,
    )


@router.patch(
    "/{work_report_item_id}/deactivate",
    response_model=WorkReportItemResponse,
    status_code=status.HTTP_200_OK,
)
def deactivate_work_report_item(
    payload: WorkReportItemAction,
    work_report_item_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
) -> WorkReportItemResponse:
    return WorkReportItemService.deactivate_work_report_item(
        db=db,
        work_report_item_id=work_report_item_id,
        updated_by=payload.updated_by,
    )


@router.patch(
    "/{work_report_item_id}/activate",
    response_model=WorkReportItemResponse,
    status_code=status.HTTP_200_OK,
)
def activate_work_report_item(
    payload: WorkReportItemAction,
    work_report_item_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
) -> WorkReportItemResponse:
    return WorkReportItemService.activate_work_report_item(
        db=db,
        work_report_item_id=work_report_item_id,
        updated_by=payload.updated_by,
    )


@router.delete(
    "/{work_report_item_id}",
    response_model=WorkReportItemResponse,
    status_code=status.HTTP_200_OK,
)
def delete_work_report_item(
    payload: WorkReportItemAction,
    work_report_item_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
) -> WorkReportItemResponse:
    return WorkReportItemService.delete_work_report_item(
        db=db,
        work_report_item_id=work_report_item_id,
        updated_by=payload.updated_by,
    )
