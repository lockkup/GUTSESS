from __future__ import annotations

from fastapi import APIRouter, Depends, Path, Query, Response, status
from sqlalchemy.orm import Session

from app.core import get_db
from app.core.constants import DBConstants
from app.schemas.patrol_report_export import (
    PatrolReportExportAction,
    PatrolReportExportCreate,
    PatrolReportExportResponse,
    ReportExportJobStatus,
)
from app.services.patrol_report_export import PatrolReportExportService

router = APIRouter()


@router.post(
    "/",
    response_model=PatrolReportExportResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
def queue_patrol_report_export(
    payload: PatrolReportExportCreate,
    db: Session = Depends(get_db),
) -> PatrolReportExportResponse:
    """
    สร้าง Job สถานะ queued เท่านั้น

    Worker แยกต่างหากจะเป็นผู้ดึง Job ไปสร้าง PDF พร้อมรูปภาพ
    จึงใช้ HTTP 202 Accepted แทน 201 เพราะตอนตอบกลับ PDF ยังไม่เสร็จ
    """
    return PatrolReportExportService.queue_patrol_report_export(
        db=db,
        payload=payload,
    )


@router.get(
    "/",
    response_model=list[PatrolReportExportResponse],
    status_code=status.HTTP_200_OK,
)
def get_patrol_report_exports(
    skip: int = Query(DBConstants.DEFAULT_PAGE_SKIP, ge=0),
    limit: int = Query(
        DBConstants.DEFAULT_PAGE_LIMIT,
        ge=1,
        le=DBConstants.MAX_PAGE_LIMIT,
    ),
    requested_by: str | None = Query(
        default=None,
        min_length=1,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    ),
    job_status: ReportExportJobStatus | None = Query(default=None),
    include_deleted: bool = Query(default=False),
    db: Session = Depends(get_db),
) -> list[PatrolReportExportResponse]:
    """
    ใช้สำหรับหน้า 'ประวัติการสร้างรายงาน' หรือ Admin Monitor Job
    """
    return PatrolReportExportService.get_patrol_report_exports(
        db=db,
        skip=skip,
        limit=limit,
        requested_by=requested_by,
        job_status=job_status,
        include_deleted=include_deleted,
    )


@router.get(
    "/{export_job_id}",
    response_model=PatrolReportExportResponse,
    status_code=status.HTTP_200_OK,
)
def get_patrol_report_export(
    export_job_id: int = Path(..., gt=0),
    include_deleted: bool = Query(default=False),
    db: Session = Depends(get_db),
) -> PatrolReportExportResponse:
    """
    Frontend ใช้ Polling endpoint นี้ทุก 2-3 วินาที
    เพื่อตรวจ status และ progress ของการสร้าง PDF
    """
    return PatrolReportExportService.get_patrol_report_export(
        db=db,
        export_job_id=export_job_id,
        include_deleted=include_deleted,
    )


@router.get(
    "/{export_job_id}/download",
    status_code=status.HTTP_200_OK,
)
def download_patrol_report_export(
    export_job_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
) -> Response:
    """
    Service ต้องตรวจสิทธิ์/สถานะ completed/ไฟล์มีอยู่จริง
    แล้วคืน FileResponse กลับมา

    ห้ามคืน absolute path หรือ public file path ให้ Frontend
    """
    return PatrolReportExportService.download_patrol_report_export(
        db=db,
        export_job_id=export_job_id,
    )


@router.patch(
    "/{export_job_id}/cancel",
    response_model=PatrolReportExportResponse,
    status_code=status.HTTP_200_OK,
)
def cancel_patrol_report_export(
    payload: PatrolReportExportAction,
    export_job_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
) -> PatrolReportExportResponse:
    """
    ยกเลิกได้เฉพาะ Job ที่ queued หรือ processing
    Worker ต้องตรวจ status ก่อนทำแต่ละ batch เพื่อหยุดงานได้
    """
    return PatrolReportExportService.cancel_patrol_report_export(
        db=db,
        export_job_id=export_job_id,
        updated_by=payload.updated_by,
    )


@router.post(
    "/{export_job_id}/retry",
    response_model=PatrolReportExportResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
def retry_patrol_report_export(
    payload: PatrolReportExportAction,
    export_job_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
) -> PatrolReportExportResponse:
    """
    ใช้ Retry เฉพาะ Job ที่ failed หรือ expired ตาม business rule ใน Service
    """
    return PatrolReportExportService.retry_patrol_report_export(
        db=db,
        export_job_id=export_job_id,
        updated_by=payload.updated_by,
    )


@router.patch(
    "/{export_job_id}/delete",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_patrol_report_export(
    payload: PatrolReportExportAction,
    export_job_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
) -> None:
    """
    Soft delete ด้วย mark_flag ตามแนวทางเดียวกับ module อื่นในระบบ
    """
    PatrolReportExportService.delete_patrol_report_export(
        db=db,
        export_job_id=export_job_id,
        updated_by=payload.updated_by,
    )
