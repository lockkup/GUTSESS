# backend/app/services/patrol_report_export.py
# แยก Export Job ของแต่ละ Environment ด้วย queue_key
from __future__ import annotations

from datetime import datetime
from pathlib import Path

from fastapi import HTTPException, status
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask
from sqlalchemy import exists, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.error_messages import (
    DATABASE_ERROR_DETAIL,
    EMPLOYEE_NOT_FOUND_DETAIL,
    REPORT_EXPORT_JOB_FILE_EXPIRED_DETAIL,
    REPORT_EXPORT_JOB_FILE_NOT_FOUND_DETAIL,
    REPORT_EXPORT_JOB_NOT_CANCELLABLE_DETAIL,
    REPORT_EXPORT_JOB_NOT_DELETABLE_DETAIL,
    REPORT_EXPORT_JOB_NOT_FOUND_DETAIL,
    REPORT_EXPORT_JOB_NOT_READY_DETAIL,
    REPORT_EXPORT_JOB_NOT_RETRYABLE_DETAIL,
)
from app.models.employees import Employees
from app.models.report_export_job import ReportExportJob
from app.schemas.patrol_report_export import (
    PatrolReportExportCreate,
    PatrolReportExportResponse,
    ReportExportJobStatus,
)


class PatrolReportExportService:
    """
    จัดการ Job ของการ Export รายงานสายตรวจ

    Service นี้ทำเฉพาะ:
    - สร้าง Job queued
    - อ่านสถานะ / history
    - cancel / retry / soft delete
    - ตรวจไฟล์และคืน FileResponse สำหรับ download

    Service นี้ไม่สร้าง PDF เอง
    PDF Worker แยกต่างหากจะดึง Job ที่ job_status='queued'
    แล้วเรียก PatrolReportPdfService ในภายหลัง
    """

    REPORT_TYPE_PATROL = "patrol_report"

    STATUS_QUEUED = "queued"
    STATUS_PROCESSING = "processing"
    STATUS_COMPLETED = "completed"
    STATUS_FAILED = "failed"
    STATUS_CANCELLED = "cancelled"
    STATUS_EXPIRED = "expired"

    CANCELLABLE_STATUSES = {
        STATUS_QUEUED,
        STATUS_PROCESSING,
    }

    RETRYABLE_STATUSES = {
        STATUS_FAILED,
        STATUS_EXPIRED,
    }

    DELETABLE_STATUSES = {
        STATUS_COMPLETED,
        STATUS_FAILED,
        STATUS_CANCELLED,
        STATUS_EXPIRED,
    }

    # ตั้งค่าใน .env ได้ เช่น:
    # REPORT_EXPORT_ROOT=D:\GutsWebServer\ESS\exports

    @staticmethod
    def queue_patrol_report_export(
        *,
        db: Session,
        payload: PatrolReportExportCreate,
    ) -> PatrolReportExportResponse:
        PatrolReportExportService._ensure_employee_exists(
            db=db,
            employee_code=payload.requested_by,
        )

        export_job = ReportExportJob(
            report_type=PatrolReportExportService.REPORT_TYPE_PATROL,
            queue_key=(
                PatrolReportExportService.get_report_export_queue_key()
            ),
            filters_json=payload.filters.model_dump(mode="json"),
            include_images=payload.include_images,
            job_status=PatrolReportExportService.STATUS_QUEUED,
            progress_current=0,
            progress_total=0,
            requested_by=payload.requested_by,
            mark_flag=False,
        )

        try:
            db.add(export_job)
            db.commit()
            db.refresh(export_job)
        except SQLAlchemyError as exc:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=DATABASE_ERROR_DETAIL,
            ) from exc

        return PatrolReportExportResponse.model_validate(export_job)

    @staticmethod
    def get_patrol_report_exports(
        *,
        db: Session,
        skip: int,
        limit: int,
        requested_by: str | None,
        job_status: ReportExportJobStatus | None,
        include_deleted: bool,
    ) -> list[PatrolReportExportResponse]:
        statement = select(ReportExportJob).where(
            ReportExportJob.queue_key
            == PatrolReportExportService.get_report_export_queue_key(),
        )

        if not include_deleted:
            statement = statement.where(
                ReportExportJob.mark_flag.is_(False),
            )

        if requested_by:
            statement = statement.where(
                ReportExportJob.requested_by == requested_by,
            )

        if job_status:
            statement = statement.where(
                ReportExportJob.job_status == job_status,
            )

        statement = (
            statement.order_by(ReportExportJob.created_at.desc())
            .offset(skip)
            .limit(limit)
        )

        export_jobs = list(db.scalars(statement))

        return [
            PatrolReportExportResponse.model_validate(export_job)
            for export_job in export_jobs
        ]

    @staticmethod
    def get_patrol_report_export(
        *,
        db: Session,
        export_job_id: int,
        include_deleted: bool,
    ) -> PatrolReportExportResponse:
        export_job = PatrolReportExportService._get_export_job_or_404(
            db=db,
            export_job_id=export_job_id,
            include_deleted=include_deleted,
        )

        return PatrolReportExportResponse.model_validate(export_job)

    @staticmethod
    def download_patrol_report_export(
        *,
        db: Session,
        export_job_id: int,
    ) -> FileResponse:
        export_job = PatrolReportExportService._get_export_job_or_404(
            db=db,
            export_job_id=export_job_id,
            include_deleted=False,
        )

        if export_job.job_status != PatrolReportExportService.STATUS_COMPLETED:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=REPORT_EXPORT_JOB_NOT_READY_DETAIL,
            )

        if (
            export_job.expires_at is not None
            and export_job.expires_at <= datetime.now()
        ):
            raise HTTPException(
                status_code=status.HTTP_410_GONE,
                detail=REPORT_EXPORT_JOB_FILE_EXPIRED_DETAIL,
            )

        if not export_job.file_relative_path or not export_job.download_filename:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=REPORT_EXPORT_JOB_FILE_NOT_FOUND_DETAIL,
            )

        file_path = PatrolReportExportService._resolve_export_file_path(
            export_job.file_relative_path,
        )

        if not file_path.is_file():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=REPORT_EXPORT_JOB_FILE_NOT_FOUND_DETAIL,
            )

        return FileResponse(
            path=file_path,
            media_type="application/pdf",
            filename=export_job.download_filename,
            background=BackgroundTask(
                PatrolReportExportService._delete_export_file,
                file_path,
            ),
        )

    @staticmethod
    def cancel_patrol_report_export(
        *,
        db: Session,
        export_job_id: int,
        updated_by: str,
    ) -> PatrolReportExportResponse:
        PatrolReportExportService._ensure_employee_exists(
            db=db,
            employee_code=updated_by,
        )

        export_job = PatrolReportExportService._get_export_job_or_404(
            db=db,
            export_job_id=export_job_id,
            include_deleted=False,
        )

        if export_job.job_status not in PatrolReportExportService.CANCELLABLE_STATUSES:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=REPORT_EXPORT_JOB_NOT_CANCELLABLE_DETAIL,
            )

        export_job.job_status = PatrolReportExportService.STATUS_CANCELLED
        export_job.updated_by = updated_by
        export_job.completed_at = datetime.now()
        export_job.error_message = None

        PatrolReportExportService._commit_and_refresh(
            db=db,
            export_job=export_job,
        )

        return PatrolReportExportResponse.model_validate(export_job)

    @staticmethod
    def retry_patrol_report_export(
        *,
        db: Session,
        export_job_id: int,
        updated_by: str,
    ) -> PatrolReportExportResponse:
        PatrolReportExportService._ensure_employee_exists(
            db=db,
            employee_code=updated_by,
        )

        export_job = PatrolReportExportService._get_export_job_or_404(
            db=db,
            export_job_id=export_job_id,
            include_deleted=False,
        )

        if export_job.job_status not in PatrolReportExportService.RETRYABLE_STATUSES:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=REPORT_EXPORT_JOB_NOT_RETRYABLE_DETAIL,
            )

        export_job.job_status = PatrolReportExportService.STATUS_QUEUED
        export_job.progress_current = 0
        export_job.progress_total = 0
        export_job.file_relative_path = None
        export_job.download_filename = None
        export_job.file_size_bytes = None
        export_job.error_message = None
        export_job.started_at = None
        export_job.completed_at = None
        export_job.expires_at = None
        export_job.updated_by = updated_by

        PatrolReportExportService._commit_and_refresh(
            db=db,
            export_job=export_job,
        )

        return PatrolReportExportResponse.model_validate(export_job)

    @staticmethod
    def delete_patrol_report_export(
        *,
        db: Session,
        export_job_id: int,
        updated_by: str,
    ) -> None:
        PatrolReportExportService._ensure_employee_exists(
            db=db,
            employee_code=updated_by,
        )

        export_job = PatrolReportExportService._get_export_job_or_404(
            db=db,
            export_job_id=export_job_id,
            include_deleted=False,
        )

        if export_job.job_status not in PatrolReportExportService.DELETABLE_STATUSES:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=REPORT_EXPORT_JOB_NOT_DELETABLE_DETAIL,
            )

        export_job.mark_flag = True
        export_job.updated_by = updated_by

        PatrolReportExportService._commit_and_refresh(
            db=db,
            export_job=export_job,
        )

    @staticmethod
    def _get_export_job_or_404(
        *,
        db: Session,
        export_job_id: int,
        include_deleted: bool,
    ) -> ReportExportJob:
        statement = select(ReportExportJob).where(
            ReportExportJob.report_export_job_id == export_job_id,
            ReportExportJob.queue_key
            == PatrolReportExportService.get_report_export_queue_key(),
        )

        if not include_deleted:
            statement = statement.where(
                ReportExportJob.mark_flag.is_(False),
            )

        export_job = db.scalar(statement)

        if export_job is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=REPORT_EXPORT_JOB_NOT_FOUND_DETAIL,
            )

        return export_job

    @staticmethod
    def _ensure_employee_exists(
        *,
        db: Session,
        employee_code: str,
    ) -> None:
        employee_exists = db.scalar(
            select(
                exists().where(
                    Employees.employee_code == employee_code,
                ),
            ),
        )

        if not employee_exists:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=EMPLOYEE_NOT_FOUND_DETAIL,
            )

    @staticmethod
    def _commit_and_refresh(
        *,
        db: Session,
        export_job: ReportExportJob,
    ) -> None:
        try:
            db.commit()
            db.refresh(export_job)
        except SQLAlchemyError as exc:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=DATABASE_ERROR_DETAIL,
            ) from exc

    @staticmethod
    def _delete_export_file(file_path: Path) -> None:
        """
        ลบไฟล์ PDF หลัง FileResponse ส่ง response เสร็จแล้ว

        PDF ของ Patrol Report เป็น temporary export file
        ไม่เก็บถาวรบนเครื่อง Server
        """
        file_path.unlink(missing_ok=True)

    @staticmethod
    def _resolve_export_file_path(
        file_relative_path: str,
    ) -> Path:
        export_root = PatrolReportExportService._get_export_root()
        candidate_path = (
            export_root / file_relative_path.lstrip("/\\")
        ).resolve()

        try:
            candidate_path.relative_to(export_root)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=REPORT_EXPORT_JOB_FILE_NOT_FOUND_DETAIL,
            ) from exc

        return candidate_path

    @staticmethod
    def _get_export_root() -> Path:
        configured_path = settings.REPORT_EXPORT_ROOT.strip()

        if configured_path:
            return Path(configured_path).expanduser().resolve()

        # backend/app/services/patrol_report_export.py
        # parents[2] = backend
        return Path(__file__).resolve().parents[2] / "exports"

    @staticmethod
    def get_report_export_queue_key() -> str:
        configured_queue_key = settings.REPORT_EXPORT_QUEUE_KEY.strip()

        if not configured_queue_key:
            raise RuntimeError(
                "REPORT_EXPORT_QUEUE_KEY is not configured"
            )

        return configured_queue_key