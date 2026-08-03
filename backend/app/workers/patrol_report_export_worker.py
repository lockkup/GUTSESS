# backend/app/workers/patrol_report_export_worker.py
from __future__ import annotations

import argparse
import logging
import os
import signal
import sys
import threading
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Iterator

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core import get_db
from app.models.report_export_job import ReportExportJob
from app.schemas.patrol_report_export import PatrolReportExportFilter
from app.services.patrol_report_export import PatrolReportExportService
from app.services.patrol_report_pdf_service import (
    PatrolReportPdfBuildError,
    PatrolReportPdfCancelledError,
    PatrolReportPdfNoDataError,
    PatrolReportPdfService,
)

logger = logging.getLogger("guts_ess.patrol_report_export_worker")

REPORT_TYPE_PATROL = "patrol_report"

STATUS_QUEUED = "queued"
STATUS_PROCESSING = "processing"
STATUS_COMPLETED = "completed"
STATUS_FAILED = "failed"
STATUS_CANCELLED = "cancelled"

POLL_SECONDS_ENV = "REPORT_EXPORT_WORKER_POLL_SECONDS"
RETENTION_HOURS_ENV = "REPORT_EXPORT_RETENTION_HOURS"

DEFAULT_POLL_SECONDS = 2.0
DEFAULT_RETENTION_HOURS = 24


@dataclass(frozen=True)
class ClaimedExportJob:
    """Snapshot ของ Job หลัง claim สำเร็จ เพื่อไม่ใช้ ORM object ข้าม transaction."""

    report_export_job_id: int
    report_type: str
    filters_json: dict
    include_images: bool


@contextmanager
def db_session() -> Iterator[Session]:
    """
    ใช้ get_db() ชุดเดียวกับ FastAPI เพื่อให้ Worker ใช้ .env และ
    SQLAlchemy configuration เดียวกับ API โดยไม่ต้องสร้าง engine ซ้ำ.
    """

    session_generator = get_db()
    db = next(session_generator)

    try:
        yield db
    finally:
        session_generator.close()


def now_local() -> datetime:
    """
    DB ของระบบเก็บ DATETIME แบบ naive อยู่แล้ว จึงใช้ datetime.now()
    ให้สอดคล้องกับ Service เดิม.
    """

    return datetime.now()


def env_positive_float(name: str, default: float) -> float:
    value = os.getenv(name, "").strip()

    if not value:
        return default

    try:
        number = float(value)
    except ValueError:
        logger.warning(
            "ค่า %s=%r ไม่ใช่ตัวเลขบวก จึงใช้ค่าเริ่มต้น %s",
            name,
            value,
            default,
        )
        return default

    if number <= 0:
        logger.warning(
            "ค่า %s=%r ต้องมากกว่า 0 จึงใช้ค่าเริ่มต้น %s",
            name,
            value,
            default,
        )
        return default

    return number


def env_positive_int(name: str, default: int) -> int:
    value = os.getenv(name, "").strip()

    if not value:
        return default

    try:
        number = int(value)
    except ValueError:
        logger.warning(
            "ค่า %s=%r ไม่ใช่จำนวนเต็มบวก จึงใช้ค่าเริ่มต้น %s",
            name,
            value,
            default,
        )
        return default

    if number <= 0:
        logger.warning(
            "ค่า %s=%r ต้องมากกว่า 0 จึงใช้ค่าเริ่มต้น %s",
            name,
            value,
            default,
        )
        return default

    return number


def configure_logging(level_name: str) -> None:
    level = getattr(logging, level_name.upper(), logging.INFO)

    logging.basicConfig(
        level=level,
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
        stream=sys.stdout,
    )


def get_export_root() -> Path:
    """
    ใช้ root เดียวกับ endpoint download เพื่อให้ file_relative_path
    ที่ Worker บันทึกถูกหาเจอผ่าน PatrolReportExportService.
    """

    export_root = PatrolReportExportService._get_export_root()
    export_root.mkdir(parents=True, exist_ok=True)

    return export_root.resolve()


def build_relative_output_path(report_export_job_id: int) -> Path:
    """
    เก็บ PDF แยกตามปี/เดือน ลดจำนวนไฟล์ใน folder เดียวกัน และไม่เก็บ
    absolute path ลงฐานข้อมูล.
    """

    generated_at = now_local()

    filename = (
        f"patrol_report_job_{report_export_job_id}_"
        f"{generated_at:%Y%m%d_%H%M%S}.pdf"
    )

    return Path("patrol_reports") / f"{generated_at:%Y}" / f"{generated_at:%m}" / filename


def remove_file_if_exists(path: Path) -> None:
    try:
        if path.is_file():
            path.unlink()
    except OSError:
        logger.warning("ลบไฟล์ไม่สำเร็จ: %s", path, exc_info=True)


def claim_next_export_job() -> ClaimedExportJob | None:
    """
    Claim Job ที่ queued หนึ่งรายการแบบ atomic.

    MySQL 8 รองรับ SKIP LOCKED ทำให้ถ้าอนาคตมี Worker มากกว่า 1 ตัว
    แต่ละตัวจะไม่หยิบ Job เดียวกันซ้ำ.
    """

    with db_session() as db:
        with db.begin():
            statement = (
                select(ReportExportJob)
                .where(
                    ReportExportJob.report_type == REPORT_TYPE_PATROL,
                    ReportExportJob.job_status == STATUS_QUEUED,
                    ReportExportJob.mark_flag.is_(False),
                )
                .order_by(
                    ReportExportJob.created_at.asc(),
                    ReportExportJob.report_export_job_id.asc(),
                )
                .limit(1)
                .with_for_update(skip_locked=True)
            )

            export_job = db.scalar(statement)

            if export_job is None:
                return None

            export_job.job_status = STATUS_PROCESSING
            export_job.progress_current = 0
            export_job.progress_total = 0
            export_job.file_relative_path = None
            export_job.download_filename = None
            export_job.file_size_bytes = None
            export_job.error_message = None
            export_job.started_at = now_local()
            export_job.completed_at = None
            export_job.expires_at = None

            db.flush()

            return ClaimedExportJob(
                report_export_job_id=export_job.report_export_job_id,
                report_type=export_job.report_type,
                filters_json=dict(export_job.filters_json or {}),
                include_images=bool(export_job.include_images),
            )


def is_job_cancelled(report_export_job_id: int) -> bool:
    """
    PDF Service จะเรียก function นี้ระหว่างสร้างตาราง/รูปภาพ.
    ถ้า Admin กด cancel จะหยุดสร้างโดยเร็วที่สุด.
    """

    with db_session() as db:
        statement = select(
            ReportExportJob.job_status,
            ReportExportJob.mark_flag,
        ).where(
            ReportExportJob.report_export_job_id == report_export_job_id,
        )

        result = db.execute(statement).one_or_none()

        if result is None:
            return True

        job_status, mark_flag = result

        return bool(mark_flag) or job_status == STATUS_CANCELLED


def update_progress(
    report_export_job_id: int,
    *,
    current: int,
    total: int,
) -> None:
    """
    อัปเดต progress ด้วย Session ใหม่ เพื่อไม่ให้การสร้าง PDF long-running
    ค้าง transaction เดียวกับหน้าจอ API.
    """

    safe_current = max(0, int(current))
    safe_total = max(0, int(total))

    if safe_total > 0:
        safe_current = min(safe_current, safe_total)

    with db_session() as db:
        statement = (
            update(ReportExportJob)
            .where(
                ReportExportJob.report_export_job_id == report_export_job_id,
                ReportExportJob.job_status == STATUS_PROCESSING,
                ReportExportJob.mark_flag.is_(False),
            )
            .values(
                progress_current=safe_current,
                progress_total=safe_total,
            )
        )

        db.execute(statement)
        db.commit()


def finish_completed_job(
    claimed_job: ClaimedExportJob,
    *,
    output_file: Path,
    relative_output_path: Path,
    download_filename: str,
    file_size_bytes: int,
    retention_hours: int,
) -> bool:
    """
    บันทึก completed เฉพาะเมื่อ Job ยังเป็น processing.
    ถ้าผู้ใช้กด cancel ระหว่าง build จะลบไฟล์และไม่เขียนทับเป็น completed.
    """

    with db_session() as db:
        with db.begin():
            statement = (
                select(ReportExportJob)
                .where(
                    ReportExportJob.report_export_job_id
                    == claimed_job.report_export_job_id,
                )
                .with_for_update()
            )

            export_job = db.scalar(statement)

            if (
                export_job is None
                or export_job.mark_flag
                or export_job.job_status == STATUS_CANCELLED
            ):
                remove_file_if_exists(output_file)
                return False

            if export_job.job_status != STATUS_PROCESSING:
                remove_file_if_exists(output_file)
                logger.warning(
                    "Job %s มีสถานะ %s ระหว่าง finalize จึงไม่เขียน completed",
                    claimed_job.report_export_job_id,
                    export_job.job_status,
                )
                return False

            export_job.job_status = STATUS_COMPLETED
            # PDF Service เรียก progress callback เป็นจำนวน row.
            # เมื่อ completed ให้ progress จบที่ total เสมอ.
            if export_job.progress_total > 0:
                export_job.progress_current = export_job.progress_total
            else:
                export_job.progress_current = 0

            export_job.file_relative_path = relative_output_path.as_posix()
            export_job.download_filename = download_filename
            export_job.file_size_bytes = max(0, int(file_size_bytes))
            export_job.error_message = None
            export_job.completed_at = now_local()
            export_job.expires_at = now_local() + timedelta(hours=retention_hours)


    return True


def mark_job_failed(
    claimed_job: ClaimedExportJob,
    *,
    safe_error_message: str,
) -> None:
    """
    เก็บเฉพาะข้อความที่ปลอดภัยต่อผู้ใช้ใน DB และเก็บ traceback จริงใน log.
    ห้ามเอา exception/internal DB detail ลง error_message.
    """

    with db_session() as db:
        with db.begin():
            statement = (
                select(ReportExportJob)
                .where(
                    ReportExportJob.report_export_job_id
                    == claimed_job.report_export_job_id,
                )
                .with_for_update()
            )

            export_job = db.scalar(statement)

            if export_job is None or export_job.mark_flag:
                return

            if export_job.job_status == STATUS_CANCELLED:
                return

            export_job.job_status = STATUS_FAILED
            export_job.error_message = safe_error_message[:2000]
            export_job.completed_at = now_local()


def process_claimed_export_job(
    claimed_job: ClaimedExportJob,
    *,
    retention_hours: int,
) -> bool:
    """
    สร้าง PDF หนึ่ง Job และบันทึกผลกลับ report_export_job.
    Return True เมื่อเริ่มประมวลผล Job แล้ว ไม่ว่าจะ completed/failed/cancelled.
    """

    if claimed_job.report_type != REPORT_TYPE_PATROL:
        mark_job_failed(
            claimed_job,
            safe_error_message="ไม่รองรับประเภทรายงานนี้",
        )
        return True

    relative_output_path = build_relative_output_path(
        claimed_job.report_export_job_id,
    )
    output_file = get_export_root() / relative_output_path

    try:
        filters = PatrolReportExportFilter.model_validate(
            claimed_job.filters_json,
        )
    except Exception:
        logger.exception(
            "Job %s มี filters_json ไม่ถูกต้อง",
            claimed_job.report_export_job_id,
        )
        mark_job_failed(
            claimed_job,
            safe_error_message="ระบบประมวลผลรายงานยังไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแลระบบ",
        )
        return True

    try:
        with db_session() as db:
            build_result = PatrolReportPdfService.build_patrol_report_pdf(
                db=db,
                filters=filters,
                include_images=claimed_job.include_images,
                output_path=output_file,
                progress_callback=lambda current, total: update_progress(
                    claimed_job.report_export_job_id,
                    current=current,
                    total=total,
                ),
                is_cancelled=lambda: is_job_cancelled(
                    claimed_job.report_export_job_id,
                ),
            )

        finalized = finish_completed_job(
            claimed_job,
            output_file=output_file,
            relative_output_path=relative_output_path,
            download_filename=build_result.download_filename,
            file_size_bytes=build_result.file_size_bytes,
            retention_hours=retention_hours,
        )

        if finalized:
            logger.info(
                "สร้าง PDF สำเร็จ: job_id=%s rows=%s size=%s bytes",
                claimed_job.report_export_job_id,
                build_result.report_row_count,
                build_result.file_size_bytes,
            )
        else:
            logger.info(
                "หยุด finalize เพราะ Job ถูกยกเลิก/เปลี่ยนสถานะ: job_id=%s",
                claimed_job.report_export_job_id,
            )

    except PatrolReportPdfCancelledError:
        remove_file_if_exists(output_file)
        logger.info(
            "ยกเลิกการสร้าง PDF: job_id=%s",
            claimed_job.report_export_job_id,
        )

    except PatrolReportPdfNoDataError as exc:
        remove_file_if_exists(output_file)
        logger.info(
            "ไม่พบข้อมูลสำหรับ PDF: job_id=%s",
            claimed_job.report_export_job_id,
        )
        mark_job_failed(
            claimed_job,
            safe_error_message=str(exc),
        )

    except PatrolReportPdfBuildError:
        remove_file_if_exists(output_file)
        logger.exception(
            "สร้าง PDF ไม่สำเร็จ: job_id=%s",
            claimed_job.report_export_job_id,
        )
        mark_job_failed(
            claimed_job,
            safe_error_message="ไม่สามารถสร้างไฟล์ PDF รายงานได้ กรุณาลองใหม่อีกครั้ง",
        )

    except Exception:
        remove_file_if_exists(output_file)
        logger.exception(
            "Worker พบข้อผิดพลาดที่ไม่คาดคิด: job_id=%s",
            claimed_job.report_export_job_id,
        )
        mark_job_failed(
            claimed_job,
            safe_error_message="เกิดข้อผิดพลาดระหว่างสร้างไฟล์รายงาน",
        )

    return True


def process_one_export_job(*, retention_hours: int) -> bool:
    """Claim และประมวลผล queued Job หนึ่งรายการ."""

    claimed_job = claim_next_export_job()

    if claimed_job is None:
        return False

    logger.info(
        "เริ่มสร้าง PDF: job_id=%s",
        claimed_job.report_export_job_id,
    )

    process_claimed_export_job(
        claimed_job,
        retention_hours=retention_hours,
    )

    return True


def run_worker(
    *,
    poll_seconds: float,
    retention_hours: int,
    stop_event: threading.Event,
) -> None:
    logger.info(
        "Patrol report export worker started. poll_seconds=%s retention_hours=%s",
        poll_seconds,
        retention_hours,
    )

    while not stop_event.is_set():
        try:
            processed = process_one_export_job(
                retention_hours=retention_hours,
            )
        except Exception:
            logger.exception("Worker loop error")
            processed = False

        if not processed:
            stop_event.wait(poll_seconds)

    logger.info("Patrol report export worker stopped.")


def build_argument_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="GUTS-ESS Patrol Report PDF Export Worker",
    )

    parser.add_argument(
        "--once",
        action="store_true",
        help="ประมวลผล queued Job ได้สูงสุด 1 รายการ แล้วหยุด",
    )

    parser.add_argument(
        "--poll-seconds",
        type=float,
        default=env_positive_float(
            POLL_SECONDS_ENV,
            DEFAULT_POLL_SECONDS,
        ),
        help=f"เวลาพักเมื่อไม่มี Job (default from {POLL_SECONDS_ENV})",
    )

    parser.add_argument(
        "--retention-hours",
        type=int,
        default=env_positive_int(
            RETENTION_HOURS_ENV,
            DEFAULT_RETENTION_HOURS,
        ),
        help=f"อายุไฟล์ PDF หลัง completed (default from {RETENTION_HOURS_ENV})",
    )

    parser.add_argument(
        "--log-level",
        default=os.getenv("REPORT_EXPORT_WORKER_LOG_LEVEL", "INFO"),
        help="DEBUG, INFO, WARNING, ERROR",
    )

    return parser


def main() -> int:
    args = build_argument_parser().parse_args()

    if args.poll_seconds <= 0:
        raise SystemExit("--poll-seconds ต้องมากกว่า 0")

    if args.retention_hours <= 0:
        raise SystemExit("--retention-hours ต้องมากกว่า 0")

    configure_logging(args.log_level)

    if args.once:
        processed = process_one_export_job(
            retention_hours=args.retention_hours,
        )
        return 0 if processed else 0

    stop_event = threading.Event()

    def request_stop(signum: int, _frame: object) -> None:
        logger.info("Received signal %s. Requesting worker shutdown.", signum)
        stop_event.set()

    signal.signal(signal.SIGINT, request_stop)

    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, request_stop)

    run_worker(
        poll_seconds=args.poll_seconds,
        retention_hours=args.retention_hours,
        stop_event=stop_event,
    )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
