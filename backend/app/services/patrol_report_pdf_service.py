# backend/app/services/patrol_report_pdf_service.py
from __future__ import annotations

import base64
import binascii
import html
import io
import logging
import re
from dataclasses import dataclass, replace
from datetime import date, datetime, time
from pathlib import Path
from typing import Any, Callable, Iterable, Mapping

import pyvips
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen.canvas import Canvas
from reportlab.platypus import (
    Image as PdfImage,
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.constants import PatrolReportConstants
from app.schemas.patrol_report_export import (
    PatrolReportExportFilter,
    PatrolReportPlanMode,
)
from app.services.patrol_report_service import get_patrol_report_rows


logger = logging.getLogger(__name__)


class PatrolReportPdfBuildError(Exception):
    """เกิดข้อผิดพลาดระหว่างสร้างไฟล์ PDF."""


class PatrolReportPdfCancelledError(Exception):
    """ผู้ใช้หรือผู้ดูแลระบบยกเลิก Job ระหว่างสร้าง PDF."""


class PatrolReportPdfNoDataError(Exception):
    """ไม่พบข้อมูลรายงานตามเงื่อนไขที่บันทึกไว้ใน Export Job."""


@dataclass(frozen=True)
class PatrolReportPdfBuildResult:
    """ข้อมูลที่ Worker ต้องใช้เมื่อสร้างไฟล์ PDF สำเร็จ."""

    download_filename: str
    file_size_bytes: int
    report_row_count: int


@dataclass(frozen=True)
class PatrolReportPdfRow:
    """รูปแบบข้อมูลภายในสำหรับวาดรายงาน PDF."""

    number: int
    plan_mode: PatrolReportPlanMode
    workday: date | None
    check_in_datetime: datetime | None
    check_out_datetime: datetime | None
    contract_code: str
    location_name: str
    department_name: str
    division_name: str
    route_name: str
    shift_label: str
    display_status: str
    plan_date_text: str
    check_in_text: str
    check_out_text: str
    operator_text: str
    contact_detail: str
    call_note: str
    check_in_image: str | None
    check_out_image: str | None


@dataclass(frozen=True)
class PatrolReportPdfScope:
    """ชื่อ ภาค / เขต / เส้นทาง สำหรับแสดงในหัวรายงาน PDF."""

    department_name: str = ""
    division_name: str = ""
    route_name: str = ""


ProgressCallback = Callable[[int, int], None]
CancelledCallback = Callable[[], bool]


class PatrolReportPdfNumberedCanvas(Canvas):
    """Canvas สำหรับแสดงเลขหน้าแบบ X/จำนวนหน้าทั้งหมด."""

    def __init__(
        self,
        *args: Any,
        footer_right_margin: float,
        footer_y: float,
        font_name: str,
        font_size: float,
        **kwargs: Any,
    ) -> None:
        super().__init__(*args, **kwargs)

        self._saved_page_states: list[dict[str, Any]] = []
        self._footer_right_margin = footer_right_margin
        self._footer_y = footer_y
        self._font_name = font_name
        self._font_size = font_size

    def showPage(self) -> None:
        # เก็บ state ของแต่ละหน้าก่อน เพื่อทราบจำนวนหน้าทั้งหมดใน save()
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self) -> None:
        total_pages = len(self._saved_page_states)

        for page_state in self._saved_page_states:
            self.__dict__.update(page_state)
            self._draw_page_number(total_pages)
            super().showPage()

        super().save()

    def _draw_page_number(self, total_pages: int) -> None:
        self.saveState()
        self.setFont(self._font_name, self._font_size)
        self.setFillColor(colors.HexColor("#64748B"))
        self.drawRightString(
            self._pagesize[0] - self._footer_right_margin,
            self._footer_y,
            f"{self._pageNumber}/{total_pages}",
        )
        self.restoreState()


class PatrolReportPdfService:
    """
    สร้าง PDF รายงานการเข้าตรวจหน่วยงานจาก vw_checkin_report

    หมายเหตุ:
    - Service นี้ไม่เปลี่ยนสถานะ report_export_job
      งานนั้นเป็นหน้าที่ของ patrol_report_export_worker.py
    - Filter จะถูกนำมาจาก filters_json ของ Job ที่สร้างจากหน้า Patrol Report
    - ใช้ MySQL view เดิมของระบบ เพื่อให้ข้อมูล Export ตรงกับข้อมูลหน้าเว็บ
    """

    VIEW_NAME = PatrolReportConstants.VIEW_NAME
    MAX_IMAGE_BYTES = 10 * 1024 * 1024

    # หน้ารายละเอียดรูปภาพ: แสดงได้ 2 จุดรักษาการณ์ต่อ 1 หน้า (A4 แนวนอน)
    # ลดความสูงรูปจาก 62 mm เหลือ 40 mm เพื่อให้ข้อมูลของ 2 จุดอยู่หน้าเดียวกัน
    IMAGE_DETAIL_ROWS_PER_PAGE = 2
    IMAGE_MAX_WIDTH_MM = 82
    IMAGE_MAX_HEIGHT_MM = 40

    # ย่อและบีบอัดเฉพาะสำเนารูปที่ฝังใน PDF โดยไม่แก้ไขไฟล์รูปต้นฉบับ
    # 180 DPI ยังชัดเพียงพอสำหรับตรวจสอบรูปบุคคลบนพื้นที่ 82 x 40 mm
    PDF_IMAGE_DPI = 180
    PDF_IMAGE_JPEG_QUALITY = 20

    # เก็บโลโก้ PNG ไว้ที่ backend/app/resources/images/logoguts.png
    # ใช้ PNG เพื่อให้ ReportLab แสดงผลได้เสถียรโดยไม่ต้องเพิ่ม dependency SVG.
    LOGO_FILE_NAME = "logoguts.png"
    LOGO_MAX_WIDTH_MM = 30
    LOGO_MAX_HEIGHT_MM = 18

    # ===== ฟอนต์ PDF =====
    # วางไฟล์ไว้ที่ backend/app/resources/fonts/
    # - Sarabun-Regular.ttf
    # - Sarabun-SemiBold.ttf
    FONT_REGULAR_NAME = "Sarabun"
    FONT_BOLD_NAME = "Sarabun-SemiBold"
    FONT_REGULAR_FILE = "Sarabun-Regular.ttf"
    FONT_BOLD_FILE = "Sarabun-SemiBold.ttf"

    # ===== ขนาดฟอนต์ / ระยะบรรทัด PDF: ปรับจากส่วนนี้ =====
    FONT_SIZE_TITLE = 16
    FONT_LEADING_TITLE = 18

    FONT_SIZE_SCOPE = 9
    FONT_LEADING_SCOPE = 12

    FONT_SIZE_SUBTITLE = 8
    FONT_LEADING_SUBTITLE = 11

    FONT_SIZE_HEADER_INFO = 8
    FONT_LEADING_HEADER_INFO = 11

    FONT_SIZE_APPENDIX_TITLE = 13
    FONT_LEADING_APPENDIX_TITLE = 17

    FONT_SIZE_DETAIL = 7
    FONT_LEADING_DETAIL = 9

    FONT_SIZE_IMAGE_SECTION = 9
    FONT_LEADING_IMAGE_SECTION = 11

    FONT_SIZE_SECTION_TITLE = 12
    FONT_LEADING_SECTION_TITLE = 16

    FONT_SIZE_TABLE_HEADER = 6.8
    FONT_LEADING_TABLE_HEADER = 8.5

    FONT_SIZE_TABLE_CELL = 6.6
    FONT_LEADING_TABLE_CELL = 8.2

    FONT_SIZE_OPERATOR_CELL = 6.2
    FONT_LEADING_OPERATOR_CELL = 7.8

    FONT_SIZE_IMAGE_LABEL = 8
    FONT_LEADING_IMAGE_LABEL = 10

    FONT_SIZE_IMAGE_EMPTY = 8
    FONT_LEADING_IMAGE_EMPTY = 10

    FONT_SIZE_FOOTER = 7

    _fonts_registered = False

    @staticmethod
    def build_patrol_report_pdf(
        *,
        db: Session,
        filters: PatrolReportExportFilter,
        include_images: bool,
        output_path: Path,
        progress_callback: ProgressCallback | None = None,
        is_cancelled: CancelledCallback | None = None,
    ) -> PatrolReportPdfBuildResult:
        """
        สร้าง PDF หนึ่งไฟล์ตาม filter ของ Job

        Worker จะเรียก method นี้ใน process แยกต่างหาก และรับผิดชอบ
        การ update status/progress/final file metadata กลับไปยัง MySQL.
        """

        output_path = Path(output_path)

        try:
            PatrolReportPdfService._raise_if_cancelled(is_cancelled)

            selected_plan_modes = (
                PatrolReportPdfService._get_selected_plan_modes(filters)
            )

            planned_rows: list[PatrolReportPdfRow] = []
            outside_plan_rows: list[PatrolReportPdfRow] = []

            if "planned" in selected_plan_modes:
                planned_rows = PatrolReportPdfService._fetch_report_rows(
                    db=db,
                    filters=filters,
                    include_images=include_images,
                )

            if "outside_plan" in selected_plan_modes:
                outside_plan_rows = (
                    PatrolReportPdfService._fetch_outside_plan_rows(
                        db=db,
                        filters=filters,
                        include_images=include_images,
                    )
                )

            total_rows = len(planned_rows) + len(outside_plan_rows)

            if total_rows <= 0:
                raise PatrolReportPdfNoDataError(
                    "ไม่พบข้อมูลรายงานตามเงื่อนไขที่เลือก"
                )

            # vw_checkin_report อาจไม่มีชื่อ ภาค/เขต/เส้นทาง
            # จึงอ่านชื่อจริงจากตาราง master ตาม filter ที่เลือกไว้
            scope = PatrolReportPdfService._fetch_scope_names(
                db=db,
                filters=filters,
            )

            output_path.parent.mkdir(parents=True, exist_ok=True)
            PatrolReportPdfService._register_thai_fonts()

            if progress_callback:
                progress_callback(0, total_rows)

            document = SimpleDocTemplate(
                str(output_path),
                pagesize=landscape(A4),
                leftMargin=12 * mm,
                rightMargin=12 * mm,
                topMargin=6 * mm,  # ขยับโลโก้และส่วนหัวขึ้น 10 มม.
                bottomMargin=14 * mm,
                title="รายงานการเข้าตรวจหน่วยงาน",
                author="GUTS-ESS",
            )

            story = PatrolReportPdfService._build_story(
                planned_rows=planned_rows,
                outside_plan_rows=outside_plan_rows,
                filters=filters,
                scope=scope,
                include_images=include_images,
                progress_callback=progress_callback,
                is_cancelled=is_cancelled,
            )

            PatrolReportPdfService._raise_if_cancelled(is_cancelled)

            document.build(
                story,
                canvasmaker=PatrolReportPdfService._create_numbered_canvas,
            )

            PatrolReportPdfService._raise_if_cancelled(is_cancelled)

            # ให้ Progress เป็น 100% หลัง ReportLab เขียนไฟล์เสร็จจริงเท่านั้น
            # เพื่อไม่ให้หน้าเว็บแสดง 100% ค้างระหว่างกำลังสร้างไฟล์ PDF.
            if progress_callback:
                progress_callback(total_rows, total_rows)

            if not output_path.is_file():
                raise PatrolReportPdfBuildError(
                    "ไม่พบไฟล์ PDF หลังจากสร้างรายงาน"
                )

            file_size_bytes = output_path.stat().st_size

            if file_size_bytes <= 0:
                raise PatrolReportPdfBuildError(
                    "ไฟล์ PDF ที่สร้างมีขนาด 0 byte"
                )

            generated_at = datetime.now()

            # ใช้ชื่อฝ่าย/ภาคที่ผู้ใช้เลือกจากตาราง departments
            # ตัวอย่าง: "ฝ่ายปฏิบัติการ ภาค 1"
            report_scope_name = (
                scope.department_name.strip()
                if scope.department_name and scope.department_name.strip()
                else "ฝ่ายปฏิบัติการ"
            )

            # ป้องกันอักขระที่ Windows ไม่อนุญาตให้ใช้ในชื่อไฟล์
            report_scope_name = re.sub(
                r'[\\/:*?"<>|]+',
                "-",
                report_scope_name,
            ).strip()

            download_filename = (
                f"รายงานประจำวัน{report_scope_name}_"
                f"{generated_at:%d%m%Y_%H%M%S}.pdf"
            )

            return PatrolReportPdfBuildResult(
                download_filename=download_filename,
                file_size_bytes=file_size_bytes,
                report_row_count=total_rows,
            )

        except PatrolReportPdfCancelledError:
            PatrolReportPdfService._remove_partial_file(output_path)
            raise

        except PatrolReportPdfNoDataError:
            PatrolReportPdfService._remove_partial_file(output_path)
            raise

        except PatrolReportPdfBuildError:
            PatrolReportPdfService._remove_partial_file(output_path)
            raise

        except Exception as exc:
            PatrolReportPdfService._remove_partial_file(output_path)
            raise PatrolReportPdfBuildError(
                "ไม่สามารถสร้างไฟล์ PDF รายงานได้"
            ) from exc

    @staticmethod
    def _fetch_report_rows(
        *,
        db: Session,
        filters: PatrolReportExportFilter,
        include_images: bool,
    ) -> list[PatrolReportPdfRow]:
        available_columns = PatrolReportPdfService._get_view_columns(db=db)

        if not available_columns:
            raise PatrolReportPdfBuildError(
                f"ไม่สามารถอ่านโครงสร้าง view {PatrolReportPdfService.VIEW_NAME} ได้"
            )

        sql, params = PatrolReportPdfService._build_report_query(
            filters=filters,
            available_columns=available_columns,
            include_images=include_images,
        )

        logger.info(
            "Patrol PDF query | filters=%s | params=%s | sql=%s",
            filters.model_dump(mode="json"),
            params,
            sql,
        )

        db_rows = db.execute(text(sql), params).mappings().all()

        logger.info("Patrol PDF result count=%s", len(db_rows))

        return [
            PatrolReportPdfService._map_pdf_row(
                mapping=row,
                number=index,
                plan_mode="planned",
                include_images=include_images,
            )
            for index, row in enumerate(db_rows, start=1)
        ]

    @staticmethod
    def _fetch_outside_plan_rows(
        *,
        db: Session,
        filters: PatrolReportExportFilter,
        include_images: bool,
    ) -> list[PatrolReportPdfRow]:
        """
        ดึงรายงานงานอื่น ๆ จาก vw_checkin_unplanned ผ่าน service เดียวกับหน้าเว็บ
        เพื่อให้เงื่อนไขและข้อมูลที่แสดงใน PDF ตรงกับตารางนอกแผน.
        """
        selected_status = str(
            PatrolReportPdfService._get_filter_value(filters, "status")
            or "all"
        )
        status_filter = (
            selected_status
            if selected_status in {"completed", "in_progress", "pending"}
            else None
        )

        report_rows = get_patrol_report_rows(
            db=db,
            plan_modes=["outside_plan"],
            workday_start=filters.workday_start,
            workday_end=filters.workday_end,
            shift_id=PatrolReportPdfService._resolve_shift_id(
                db=db,
                filters=filters,
            ),
            department_id=filters.department_id,
            division_id=filters.division_id,
            route_id=filters.route_id,
            location_id=filters.location_id,
            employee_code=filters.employee_code,
            status_filter=status_filter,
            keyword=filters.keyword or None,
        )

        # completed_call เป็นตัวกรองเฉพาะรายการที่มีผลการติดต่อ
        if selected_status == "completed_call":
            report_rows = [
                row
                for row in report_rows
                if PatrolReportPdfService._model_value(
                    row,
                    "callStatus",
                    "call_status",
                )
                is not None
            ]

        reservation_status = str(
            PatrolReportPdfService._get_filter_value(
                filters,
                "reservation_status",
                "reservationStatus",
            )
            or "all"
        )

        if selected_status == "pending" and reservation_status != "all":
            report_rows = [
                row
                for row in report_rows
                if bool(
                    PatrolReportPdfService._model_value(
                        row,
                        "reservedBy",
                        "reserved_by",
                    )
                )
                == (reservation_status == "reserved")
            ]

        return [
            PatrolReportPdfService._map_report_response_to_pdf_row(
                row=row,
                number=index,
                shift_type=filters.shift_type,
                include_images=include_images,
            )
            for index, row in enumerate(report_rows, start=1)
        ]

    @staticmethod
    def _resolve_shift_id(
        *,
        db: Session,
        filters: PatrolReportExportFilter,
    ) -> int | None:
        """
        หา shift_id จากค่าที่บันทึกใน Filter หรือตาราง shifts
        โดยไม่สมมติว่า 1=กลางวัน และ 2=กลางคืน.
        """

        explicit_shift_id = PatrolReportPdfService._get_filter_value(
            filters,
            "shift_id",
            "shiftId",
        )

        if explicit_shift_id is not None:
            try:
                parsed_shift_id = int(explicit_shift_id)
            except (TypeError, ValueError) as exc:
                raise PatrolReportPdfBuildError(
                    "shift_id ในเงื่อนไขรายงานไม่ถูกต้อง"
                ) from exc

            if parsed_shift_id <= 0:
                raise PatrolReportPdfBuildError(
                    "shift_id ในเงื่อนไขรายงานไม่ถูกต้อง"
                )

            return parsed_shift_id

        shift_type = str(
            PatrolReportPdfService._get_filter_value(
                filters,
                "shift_type",
                "shiftType",
            )
            or "all"
        )

        if shift_type == "all":
            return None

        if shift_type not in {"day", "night"}:
            raise PatrolReportPdfBuildError(
                f"ประเภทผลัดไม่ถูกต้อง: {shift_type}"
            )

        shift_columns = PatrolReportPdfService._get_view_columns(
            db=db,
            view_name="shifts",
        )

        if "shift_id" not in shift_columns:
            raise PatrolReportPdfBuildError(
                "ตาราง shifts ไม่มีคอลัมน์ shift_id"
            )

        match_parts: list[str] = []
        params: dict[str, Any] = {
            "shift_type": shift_type,
            "shift_name_pattern": (
                "%กลางวัน%" if shift_type == "day" else "%กลางคืน%"
            ),
        }

        for column_name in ("shift_type", "shift_code"):
            if column_name in shift_columns:
                match_parts.append(
                    f"LOWER(TRIM(CAST(`{column_name}` AS CHAR))) = :shift_type"
                )

        for column_name in ("shift_name_th", "shift_name"):
            if column_name in shift_columns:
                match_parts.append(
                    f"`{column_name}` LIKE :shift_name_pattern"
                )

        if not match_parts:
            raise PatrolReportPdfBuildError(
                "ตาราง shifts ไม่มีคอลัมน์ที่ใช้ระบุประเภทผลัด"
            )

        where_parts = ["(" + " OR ".join(match_parts) + ")"]

        if "mark_flag" in shift_columns:
            where_parts.append("COALESCE(`mark_flag`, 0) = 0")

        if "is_active" in shift_columns:
            where_parts.append("COALESCE(`is_active`, 1) = 1")

        statement = text(
            "SELECT `shift_id` FROM `shifts` "
            "WHERE " + " AND ".join(where_parts) + " "
            "ORDER BY `shift_id` ASC"
        )
        matched_shift_ids = list(
            dict.fromkeys(
                int(value)
                for value in db.execute(statement, params).scalars()
                if value is not None
            )
        )

        if not matched_shift_ids:
            shift_label = "กลางวัน" if shift_type == "day" else "กลางคืน"
            raise PatrolReportPdfBuildError(
                f"ไม่พบผลัด{shift_label}ในตาราง shifts"
            )

        if len(matched_shift_ids) > 1:
            shift_label = "กลางวัน" if shift_type == "day" else "กลางคืน"
            raise PatrolReportPdfBuildError(
                f"พบผลัด{shift_label}ที่เปิดใช้งานมากกว่า 1 รายการ"
            )

        return matched_shift_ids[0]

    @staticmethod
    def _model_value(row: Any, *names: str) -> Any:
        """อ่านค่าจาก Pydantic model ได้ทั้งชื่อ field และ alias."""
        for name in names:
            value = getattr(row, name, None)
            if value is not None:
                return value

        if hasattr(row, "model_dump"):
            dumped = row.model_dump(by_alias=True)
            for name in names:
                if dumped.get(name) is not None:
                    return dumped[name]

        return None

    @staticmethod
    def _map_report_response_to_pdf_row(
        *,
        row: Any,
        number: int,
        shift_type: str,
        include_images: bool,
    ) -> PatrolReportPdfRow:
        """แปลง PatrolReportResponse จาก service หน้าเว็บเป็นข้อมูล PDF."""

        def value(*names: str) -> Any:
            return PatrolReportPdfService._model_value(row, *names)

        check_in_datetime = value("checkInDateTime", "check_in_date_time")
        check_out_datetime = value("checkOutDateTime", "check_out_date_time")
        assignment_status = value("status")

        # เปลี่ยนเฉพาะข้อความในรายงานงานอื่น ๆ โดยไม่แก้สถานะจริงในฐานข้อมูล
        if assignment_status == "completed":
            assignment_status = "เรียบร้อย(ติดตาม/มอบหมาย)"

        mapping: dict[str, Any] = {
            "contract_code": value("contractCode", "contract_code"),
            "location_name": value("siteName", "site_name", "location_name"),
            "shift_label": (
                PatrolReportPdfService._get_outside_plan_shift_label(
                    check_in_datetime=check_in_datetime,
                    shift_type=shift_type,
                )
            ),
            "assignment_status": assignment_status,
            "reserved_by": value("reservedBy", "reserved_by"),
            "workday": (
                value("workday", "workDate", "work_date")
                or check_in_datetime
                or check_out_datetime
                or value("dateText", "date_text")
            ),
            "started_datetime": check_in_datetime,
            "completed_datetime": check_out_datetime,
            "employee_code": value("employeeCode", "employee_code"),
            "operator_name": value("operatorName", "operator_name"),
            "position_name": value("positionName", "position_name"),
            "contact_detail": value("contactDetail", "contact_detail"),
            "call_status": value("callStatus", "call_status"),
            "call_note": value("callNote", "call_note"),
            "check_in_image_url": value(
                "checkInImageUrl",
                "check_in_image_url",
            ) if include_images else None,
            "check_out_image_url": value(
                "checkOutImageUrl",
                "check_out_image_url",
            ) if include_images else None,
        }

        return PatrolReportPdfService._map_pdf_row(
            mapping=mapping,
            number=number,
            plan_mode="outside_plan",
            include_images=include_images,
        )

    @staticmethod
    def _get_outside_plan_shift_label(
        *,
        check_in_datetime: Any,
        shift_type: str,
    ) -> str:
        """แสดงผลัดของงานนอกแผนจากเวลาเข้า ตามกติกาเดียวกับ service หลัก."""
        parsed_datetime = PatrolReportPdfService._parse_datetime(
            check_in_datetime,
        )

        if parsed_datetime is not None:
            check_in_time = parsed_datetime.time()

            if time(8, 0) <= check_in_time < time(20, 0):
                return "กลางวัน"

            return "กลางคืน"

        return {
            "day": "กลางวัน",
            "night": "กลางคืน",
        }.get(shift_type, "-")

    @staticmethod
    def _get_view_columns(
        *,
        db: Session,
        view_name: str | None = None,
    ) -> set[str]:
        """
        อ่าน column ที่มีจริงใน view เพื่อรองรับ view ที่มี optional columns
        เช่น contact_detail, call_status, images_checkin_1.
        """

        selected_view_name = view_name or PatrolReportPdfService.VIEW_NAME

        statement = text(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = DATABASE()
              AND table_name = :table_name
            """
        )

        return {
            str(column_name).strip().lower()
            for column_name in db.execute(
                statement,
                {"table_name": selected_view_name},
            ).scalars()
            if str(column_name).strip()
        }

    @staticmethod
    def _build_report_query(
        *,
        filters: PatrolReportExportFilter,
        available_columns: set[str],
        include_images: bool = True,
    ) -> tuple[str, dict[str, Any]]:
        """
        สร้าง SQL จาก column ที่ผ่าน allow-list เท่านั้น
        จึงไม่เอาชื่อ column จาก input ของผู้ใช้ไปต่อ SQL โดยตรง.
        """

        where_parts: list[str] = []
        params: dict[str, Any] = {}

        def has_column(name: str) -> bool:
            return name.lower() in available_columns

        def add_equals(
            *,
            column_name: str,
            param_name: str,
            value: Any,
        ) -> None:
            if value is None:
                return

            if isinstance(value, str) and not value.strip():
                return

            if not has_column(column_name):
                raise PatrolReportPdfBuildError(
                    f"view {PatrolReportPdfService.VIEW_NAME} "
                    f"ไม่มีคอลัมน์ {column_name} สำหรับกรองรายงาน"
                )

            where_parts.append(f"`{column_name}` = :{param_name}")
            params[param_name] = value.strip() if isinstance(value, str) else value

        def get_filter(name: str, default: Any = None) -> Any:
            return getattr(filters, name, default)

        start_date = (
            get_filter("workday_start")
            or get_filter("workdayStart")
            or get_filter("start_date")
            or get_filter("startDate")
        )
        end_date = (
            get_filter("workday_end")
            or get_filter("workdayEnd")
            or get_filter("end_date")
            or get_filter("endDate")
        )

        # vw_checkin_report.work_date เป็นข้อความสำหรับแสดงผลจาก DATE_FORMAT(...)
        # แต่ workday เป็น DATE จริงและเป็น column ที่หน้า Patrol Report ใช้กรอง.
        # จึงห้ามใช้ work_date เปรียบเทียบกับวันที่จาก filter.
        if not has_column("workday"):
            raise PatrolReportPdfBuildError(
                f"view {PatrolReportPdfService.VIEW_NAME} ไม่มีคอลัมน์ workday"
            )

        if start_date:
            where_parts.append("`workday` >= :workday_start")
            params["workday_start"] = start_date

        if end_date:
            where_parts.append("`workday` <= :workday_end")
            params["workday_end"] = end_date

        add_equals(
            column_name="department_id",
            param_name="department_id",
            value=get_filter("department_id") or get_filter("departmentId"),
        )
        add_equals(
            column_name="division_id",
            param_name="division_id",
            value=get_filter("division_id") or get_filter("divisionId"),
        )
        add_equals(
            column_name="route_id",
            param_name="route_id",
            value=get_filter("route_id") or get_filter("routeId"),
        )
        add_equals(
            column_name="location_id",
            param_name="location_id",
            value=get_filter("location_id") or get_filter("locationId"),
        )
        add_equals(
            column_name="employee_code",
            param_name="employee_code",
            value=get_filter("employee_code") or get_filter("employeeCode"),
        )

        shift_type = (
            get_filter("shift_type")
            or get_filter("shiftType")
            or "all"
        )
        shift_id = get_filter("shift_id") or get_filter("shiftId")

        if shift_id is not None:
            add_equals(
                column_name="shift_id",
                param_name="shift_id",
                value=shift_id,
            )
        elif shift_type in {"day", "night"}:
            if not has_column("shift_name_th"):
                raise PatrolReportPdfBuildError(
                    f"view {PatrolReportPdfService.VIEW_NAME} "
                    "ไม่มีคอลัมน์ shift_name_th สำหรับกรองผลัด"
                )

            # ไม่ hardcode shift_id เพราะแต่ละฐานข้อมูลอาจใช้ ID ไม่เหมือนกัน.
            where_parts.append("`shift_name_th` LIKE :shift_name_pattern")
            params["shift_name_pattern"] = (
                "%กลางวัน%" if shift_type == "day" else "%กลางคืน%"
            )

        selected_status = get_filter("status") or "all"
        if selected_status != "all":
            if selected_status == "completed_call":
                if not has_column("call_status"):
                    raise PatrolReportPdfBuildError(
                        f"view {PatrolReportPdfService.VIEW_NAME} "
                        "ไม่มีคอลัมน์ call_status สำหรับกรองสถานะโทร"
                    )

                where_parts.append("`call_status` IS NOT NULL")
            else:
                if not has_column("assignment_status"):
                    raise PatrolReportPdfBuildError(
                        f"view {PatrolReportPdfService.VIEW_NAME} "
                        "ไม่มีคอลัมน์ assignment_status สำหรับกรองสถานะ"
                    )

                where_parts.append("`assignment_status` = :assignment_status")
                params["assignment_status"] = selected_status

        reservation_status = (
            get_filter("reservation_status")
            or get_filter("reservationStatus")
            or "all"
        )
        if (
            selected_status == "pending"
            and reservation_status != "all"
        ):
            if not has_column("reserved_by"):
                raise PatrolReportPdfBuildError(
                    f"view {PatrolReportPdfService.VIEW_NAME} "
                    "ไม่มีคอลัมน์ reserved_by สำหรับกรองการจอง"
                )

            reserved_expression = (
                "NULLIF(TRIM(CAST(`reserved_by` AS CHAR)), '')"
            )
            if reservation_status == "reserved":
                where_parts.append(f"{reserved_expression} IS NOT NULL")
            elif reservation_status == "unreserved":
                where_parts.append(f"{reserved_expression} IS NULL")

        # ไฟล์นี้ใช้กับ vw_checkin_report ซึ่งเป็นข้อมูลตามแผนอยู่แล้ว.
        # ห้ามตีความ planned/outside_plan จาก plan_day เพราะหน้า Patrol Report
        # ไม่ได้ใช้เงื่อนไขนี้ และจะทำให้ PDF ได้ข้อมูลไม่ตรงกับหน้าจอ.
        # กรณีนอกแผนควรใช้ vw_checkin_unplanned ใน service แยกต่างหาก.

        keyword = str(get_filter("keyword") or "").strip()
        if keyword:
            keyword_columns = [
                column
                for column in ("contract_code", "location_name", "site_name")
                if has_column(column)
            ]

            if not keyword_columns:
                raise PatrolReportPdfBuildError(
                    f"view {PatrolReportPdfService.VIEW_NAME} "
                    "ไม่มีคอลัมน์สำหรับค้นหาด้วยคำสำคัญ"
                )

            keyword_conditions = [
                f"`{column}` LIKE :keyword"
                for column in keyword_columns
            ]
            where_parts.append(
                "(" + " OR ".join(keyword_conditions) + ")"
            )
            params["keyword"] = f"%{keyword}%"

        select_columns = PatrolReportPdfService._get_report_select_columns(
            available_columns=available_columns,
            include_images=include_images,
        )
        select_clause = ", ".join(
            f"`{column_name}`"
            for column_name in select_columns
        )
        sql = (
            f"SELECT {select_clause} "
            f"FROM `{PatrolReportPdfService.VIEW_NAME}`"
        )

        if where_parts:
            sql += " WHERE " + " AND ".join(where_parts)

        # เรียงรายงานตามเหตุการณ์เข้าตรวจจริง:
        # 1) วันตามแผนงาน
        # 2) เวลาเข้า
        # 3) เวลาออก
        # 4) รหัสสัญญา / รหัสพนักงาน เพื่อให้ลำดับคงที่เมื่อเวลาเท่ากัน
        order_parts: list[str] = []

        if has_column("workday"):
            order_parts.append("`workday` ASC")

        if has_column("started_datetime"):
            # รายการที่ยังไม่มีเวลาเข้า เช่น pending จะอยู่ท้ายสุด
            order_parts.append("(`started_datetime` IS NULL) ASC")
            order_parts.append("`started_datetime` ASC")

        if has_column("completed_datetime"):
            # รายการที่ยังไม่มีเวลาออก เช่น in_progress จะอยู่หลังรายการที่ออกแล้ว
            order_parts.append("(`completed_datetime` IS NULL) ASC")
            order_parts.append("`completed_datetime` ASC")

        if has_column("contract_code"):
            order_parts.append("`contract_code` ASC")

        if has_column("employee_code"):
            order_parts.append("`employee_code` ASC")

        if order_parts:
            sql += " ORDER BY " + ", ".join(order_parts)

        return sql, params

    @staticmethod
    def _get_report_select_columns(
        *,
        available_columns: set[str],
        include_images: bool,
    ) -> list[str]:
        """
        เลือกเฉพาะคอลัมน์ที่ใช้สร้าง PDF

        เมื่อไม่แนบรูป จะไม่ดึงคอลัมน์รูปหรือ Base64 จาก MySQL เพื่อลด RAM
        ของ Worker และลดข้อมูลที่ต้องส่งจากฐานข้อมูล.
        """
        base_columns = (
            "workday",
            "work_date",
            "started_datetime",
            "completed_datetime",
            "check_in_date_time",
            "check_in_datetime",
            "check_out_date_time",
            "check_out_datetime",
            "contract_code",
            "location_name",
            "site_name",
            "department_name",
            "department_name_th",
            "department_label",
            "division_name",
            "division_name_th",
            "division_label",
            "route_name",
            "route_name_th",
            "route_label",
            "shift_name_th",
            "shift_label",
            "assignment_status",
            "status",
            "call_status",
            "reserved_by",
            "employee_code",
            "first_name",
            "last_name",
            "operator_name",
            "employee_name",
            "position_name",
            "contact_detail",
            "call_note",
        )
        image_columns = (
            "images_checkin_1",
            "images_checkin_2",
            "images_checkin_3",
            "images_checkout_1",
            "images_checkout_2",
            "images_checkout_3",
            "check_in_image_url",
            "checkin_image_url",
            "check_out_image_url",
            "checkout_image_url",
            "check_in_picture",
            "checkin_picture",
            "check_out_picture",
            "checkout_picture",
            "first_in_picture",
            "last_out_picture",
        )

        requested_columns = (
            base_columns + image_columns
            if include_images
            else base_columns
        )
        selected_columns = [
            column_name
            for column_name in requested_columns
            if column_name in available_columns
        ]

        if not selected_columns:
            raise PatrolReportPdfBuildError(
                f"view {PatrolReportPdfService.VIEW_NAME} "
                "ไม่มีคอลัมน์ที่ใช้สร้างรายงาน"
            )

        return selected_columns

    @staticmethod
    def _fetch_scope_names(
        *,
        db: Session,
        filters: PatrolReportExportFilter,
    ) -> PatrolReportPdfScope:
        """
        อ่านชื่อ ภาค / เขต / เส้นทาง จาก master table
        เพื่อไม่ให้หัวรายงาน PDF แสดงเป็นรหัส ID.

        ถ้า filter ไม่ได้เลือกค่าใด จะปล่อยว่างไว้และไม่แสดงขอบเขตนั้นในหัวรายงาน.
        ถ้า query ชื่อไม่สำเร็จ จะไม่ทำให้การสร้าง PDF ล้มเหลว;
        ระบบจะแสดง "ไม่พบชื่อ" แทน โดยดูรายละเอียดใน worker log ได้.
        """

        def get_filter_id(*names: str) -> int | None:
            raw_value = PatrolReportPdfService._get_filter_value(filters, *names)
            if raw_value is None:
                return None

            try:
                numeric_value = int(raw_value)
            except (TypeError, ValueError):
                return None

            return numeric_value if numeric_value > 0 else None

        def fetch_name(
            *,
            sql: str,
            value: int | None,
            scope_name: str,
        ) -> str:
            if value is None:
                return ""

            try:
                result = db.execute(text(sql), {"scope_id": value}).scalar()
            except Exception:
                logger.exception(
                    "ไม่สามารถอ่านชื่อ%sสำหรับหัวรายงาน PDF: id=%s",
                    scope_name,
                    value,
                )
                return ""

            return PatrolReportPdfService._text(result, "")

        department_id = get_filter_id("department_id", "departmentId")
        division_id = get_filter_id("division_id", "divisionId")
        route_id = get_filter_id("route_id", "routeId")

        return PatrolReportPdfScope(
            department_name=fetch_name(
                sql=(
                    "SELECT department_name FROM departments "
                    "WHERE department_id = :scope_id LIMIT 1"
                ),
                value=department_id,
                scope_name="ภาค",
            ),
            division_name=fetch_name(
                sql=(
                    "SELECT division_name FROM divisions "
                    "WHERE division_id = :scope_id LIMIT 1"
                ),
                value=division_id,
                scope_name="เขต",
            ),
            route_name=fetch_name(
                sql=(
                    "SELECT route_name FROM routes "
                    "WHERE route_id = :scope_id LIMIT 1"
                ),
                value=route_id,
                scope_name="เส้นทาง",
            ),
        )

    @staticmethod
    def _map_pdf_row(
        *,
        mapping: Mapping[str, Any],
        number: int,
        plan_mode: PatrolReportPlanMode,
        include_images: bool = True,
    ) -> PatrolReportPdfRow:
        row = {
            str(key).lower(): value
            for key, value in mapping.items()
        }

        contract_code = PatrolReportPdfService._text(
            row.get("contract_code"),
            "-",
        )
        location_name = PatrolReportPdfService._text(
            row.get("location_name") or row.get("site_name"),
            "-",
        )
        department_name = PatrolReportPdfService._text(
            row.get("department_name")
            or row.get("department_name_th")
            or row.get("department_label"),
            "",
        )
        division_name = PatrolReportPdfService._text(
            row.get("division_name")
            or row.get("division_name_th")
            or row.get("division_label"),
            "",
        )
        route_name = PatrolReportPdfService._text(
            row.get("route_name")
            or row.get("route_name_th")
            or row.get("route_label"),
            "",
        )
        shift_label = PatrolReportPdfService._text(
            row.get("shift_name_th") or row.get("shift_label"),
            "-",
        )

        assignment_status = PatrolReportPdfService._text(
            row.get("assignment_status") or row.get("status"),
            "pending",
        )
        call_status = row.get("call_status")
        reserved_by = PatrolReportPdfService._text(
            row.get("reserved_by"),
            "",
        )

        if call_status is not None and str(call_status).strip():
            display_status = "ตรวจแล้ว(โทร)"
        elif assignment_status == "pending" and reserved_by:
            display_status = (
                "รอดำเนินการเข้าตรวจ\n"
                f"โดยผู้จอง: {reserved_by}"
            )
        else:
            display_status = PatrolReportPdfService._status_label(
                assignment_status,
            )

        plan_date = row.get("workday") or row.get("work_date") or row.get("date_text")

        employee_code = PatrolReportPdfService._text(
            row.get("employee_code"),
            "",
        )
        first_name = PatrolReportPdfService._text(row.get("first_name"), "")
        last_name = PatrolReportPdfService._text(row.get("last_name"), "")
        full_name = " ".join(
            part
            for part in (first_name, last_name)
            if part
        ).strip()
        operator_name = (
            full_name
            or PatrolReportPdfService._text(
                row.get("operator_name")
                or row.get("employee_name")
                or row.get("position_name"),
                "",
            )
        )

        operator_text = "-"

        if employee_code and operator_name:
            operator_text = f"{employee_code} - {operator_name}"
        elif employee_code:
            operator_text = employee_code
        elif operator_name:
            operator_text = operator_name

        raw_check_in_datetime = (
            row.get("started_datetime")
            or row.get("check_in_date_time")
            or row.get("check_in_datetime")
            or row.get("started_at")
        )
        raw_check_out_datetime = (
            row.get("completed_datetime")
            or row.get("check_out_date_time")
            or row.get("check_out_datetime")
            or row.get("completed_at")
        )
        parsed_workday = PatrolReportPdfService._parse_datetime(plan_date)

        return PatrolReportPdfRow(
            number=number,
            plan_mode=plan_mode,
            workday=(
                parsed_workday.date() if parsed_workday is not None else None
            ),
            check_in_datetime=PatrolReportPdfService._parse_datetime(
                raw_check_in_datetime,
            ),
            check_out_datetime=PatrolReportPdfService._parse_datetime(
                raw_check_out_datetime,
            ),
            contract_code=contract_code,
            location_name=location_name,
            department_name=department_name,
            division_name=division_name,
            route_name=route_name,
            shift_label=shift_label,
            display_status=display_status,
            plan_date_text=PatrolReportPdfService._format_thai_date(plan_date),
            check_in_text=PatrolReportPdfService._format_thai_datetime(
                raw_check_in_datetime
            ),
            check_out_text=PatrolReportPdfService._format_thai_datetime(
                raw_check_out_datetime
            ),
            operator_text=operator_text,
            contact_detail=PatrolReportPdfService._text(
                row.get("contact_detail"),
                "-",
            ),
            call_note=PatrolReportPdfService._text(
                row.get("call_note"),
                "-",
            ),
            check_in_image=(
                PatrolReportPdfService._first_image_value(
                    row,
                    (
                        "images_checkin_1",
                        "images_checkin_2",
                        "images_checkin_3",
                        "check_in_image_url",
                        "checkin_image_url",
                        "check_in_picture",
                        "checkin_picture",
                        "first_in_picture",
                    ),
                )
                if include_images
                else None
            ),
            check_out_image=(
                PatrolReportPdfService._first_image_value(
                    row,
                    (
                        "images_checkout_1",
                        "images_checkout_2",
                        "images_checkout_3",
                        "check_out_image_url",
                        "checkout_image_url",
                        "check_out_picture",
                        "checkout_picture",
                        "last_out_picture",
                    ),
                )
                if include_images
                else None
            ),
        )

    @staticmethod
    def _build_story(
        *,
        planned_rows: list[PatrolReportPdfRow],
        outside_plan_rows: list[PatrolReportPdfRow],
        filters: PatrolReportExportFilter,
        scope: PatrolReportPdfScope,
        include_images: bool,
        progress_callback: ProgressCallback | None,
        is_cancelled: CancelledCallback | None,
    ) -> list[Any]:
        """รวมทุกรายการเป็นตารางเดียวและเรียงตามวันเวลาเข้าจริง."""
        selected_modes = PatrolReportPdfService._get_selected_plan_modes(filters)
        total_rows = len(planned_rows) + len(outside_plan_rows)
        progress_offset = 0
        story: list[Any] = []

        sections: list[
            tuple[
                PatrolReportPlanMode,
                str,
                list[PatrolReportPdfRow],
            ]
        ] = []

        if "planned" in selected_modes:
            sections.append(
                (
                    "planned",
                    "รายงาน-การเข้าตรวจหน่วยงานตามแผน",
                    planned_rows,
                )
            )

        if "outside_plan" in selected_modes:
            sections.append(
                (
                    "outside_plan",
                    "รายงาน - งานอื่น ๆ (ติดตาม / มอบหมาย)",
                    outside_plan_rows,
                )
            )

        numbered_sections: list[
            tuple[
                PatrolReportPlanMode,
                str,
                list[PatrolReportPdfRow],
            ]
        ] = []

        if not sections:
            return story

        # รวมข้อมูลตามแผนและงานอื่น ๆ ก่อน แล้วเรียงตามวันเวลาเข้าเดียวกัน
        # เพื่อไม่ให้งานอื่น ๆ ถูกนำไปต่อท้ายโดยไม่คำนึงถึงเวลาเข้าจริง.
        merged_rows = [
            row
            for _, _, rows in sections
            for row in rows
        ]

        merged_rows.sort(
            key=PatrolReportPdfService._combined_report_sort_key,
        )

        combined_rows = [
            replace(row, number=index)
            for index, row in enumerate(merged_rows, start=1)
        ]

        # เก็บกลุ่มตามประเภทไว้สำหรับข้อมูลหัวรายงาน ส่วนหน้ารายละเอียดรูปภาพ
        # จะใช้ combined_rows เพื่อเรียงลำดับเดียวกับตารางสรุป.
        for plan_mode, section_title, _ in sections:
            numbered_sections.append(
                (
                    plan_mode,
                    section_title,
                    [
                        row
                        for row in combined_rows
                        if row.plan_mode == plan_mode
                    ],
                )
            )

        is_combined_report = len(numbered_sections) > 1

        first_plan_mode, first_section_title, _ = numbered_sections[0]

        story.extend(
            PatrolReportPdfService._build_report_section_story(
                rows=combined_rows,
                plan_mode=first_plan_mode,
                section_title=(
                    "รายงานการเข้าตรวจหน่วยงาน"
                    if is_combined_report
                    else first_section_title
                ),
                filters=filters,
                scope=scope,
                include_images=include_images,
                progress_offset=progress_offset,
                progress_total=total_rows,
                progress_callback=progress_callback,
                is_cancelled=is_cancelled,
                combined_sections=(
                    numbered_sections
                    if is_combined_report
                    else None
                ),
            )
        )

        return story

    @staticmethod
    def _combined_report_sort_key(
        row: PatrolReportPdfRow,
    ) -> tuple[Any, ...]:
        """ลำดับตารางรวม: เวลาเข้า, เวลาออก และข้อมูลคงที่สำหรับกรณีเวลาเท่ากัน."""

        check_in_datetime = PatrolReportPdfService._normalize_sort_datetime(
            row.check_in_datetime,
        )
        check_out_datetime = PatrolReportPdfService._normalize_sort_datetime(
            row.check_out_datetime,
        )

        return (
            row.workday is None,
            row.workday or date.max,
            check_in_datetime is None,
            check_in_datetime or datetime.max,
            check_out_datetime is None,
            check_out_datetime or datetime.max,
            0 if row.plan_mode == "planned" else 1,
            row.contract_code,
            row.location_name,
            row.operator_text,
        )

    @staticmethod
    def _normalize_sort_datetime(value: datetime | None) -> datetime | None:
        """ทำ datetime ให้เปรียบเทียบกันได้ทั้งค่าที่มีและไม่มี timezone."""
        if value is None:
            return None

        if value.tzinfo is not None:
            return value.replace(tzinfo=None)

        return value

    @staticmethod
    def _build_report_section_story(
        *,
        rows: list[PatrolReportPdfRow],
        plan_mode: PatrolReportPlanMode,
        section_title: str,
        filters: PatrolReportExportFilter,
        scope: PatrolReportPdfScope,
        include_images: bool,
        progress_offset: int,
        progress_total: int,
        progress_callback: ProgressCallback | None,
        is_cancelled: CancelledCallback | None,
        combined_sections: list[
            tuple[
                PatrolReportPlanMode,
                str,
                list[PatrolReportPdfRow],
            ]
        ] | None = None,
    ) -> list[Any]:
        styles = PatrolReportPdfService._make_styles()

        story: list[Any] = []

        # ส่วนหัวรายงาน: โลโก้กึ่งกลาง + ชื่อรายงาน + ขอบเขต ภาค/เขต/เส้นทาง
        # หากยังไม่ได้วางไฟล์โลโก้ จะข้ามเฉพาะรูปโลโก้ แต่สร้าง PDF ต่อได้ตามปกติ.
        logo = PatrolReportPdfService._get_logo_image()
        if logo is not None:
            story.append(logo)
            story.append(Spacer(1, 1.5 * mm))

        story.append(
            Paragraph(
                html.escape(section_title),
                styles["title"],
            )
        )
        story.append(
            Paragraph(
                PatrolReportPdfService._format_scope_summary(
                    rows=rows,
                    filters=filters,
                    scope=scope,
                ),
                styles["scope"],
            )
        )
        story.append(Spacer(1, 2 * mm))

        # ซ้าย = เงื่อนไขที่เลือกดู / ขวา = เวลาที่ดึงข้อมูล
        header_info_table = Table(
            [
                [
                    Paragraph(
                        PatrolReportPdfService._format_selected_filters(
                            filters,
                            plan_mode=(
                                None
                                if combined_sections
                                else plan_mode
                            ),
                        ),
                        styles["filter_left"],
                    ),
                    Paragraph(
                        (
                            "เวลาที่ออกรายงาน: "
                            f"{html.escape(PatrolReportPdfService._format_thai_datetime(datetime.now()))}"
                        ),
                        styles["generated_at_right"],
                    ),
                ]
            ],
            colWidths=[178 * mm, 95 * mm],
            hAlign="LEFT",
        )
        header_info_table.setStyle(
            TableStyle(
                [
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 0),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                    ("TOPPADDING", (0, 0), (-1, -1), 0),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
                ]
            )
        )
        story.append(header_info_table)
        story.append(Spacer(1, 4 * mm))

        if not rows:
            story.append(
                Paragraph(
                    "ไม่พบข้อมูลรายงานในส่วนนี้ตามเงื่อนไขที่เลือก",
                    styles["cell_center"],
                )
            )
            return story

        table_header = [
            "ลำดับ",
            "รหัสสัญญา",
            "ชื่อจุดรักษาการณ์",
            "ผลัด",
            "สถานะ",
            (
                "วันที่ตามแผน / วันที่ปฏิบัติงาน"
                if combined_sections
                else (
                    "ตารางแผนงาน"
                    if plan_mode == "planned"
                    else "วันที่ปฏิบัติงาน"
                )
            ),
            "วันเวลาเข้า",
            "วันเวลาออก",
            "ผู้ดำเนินการ",
            "รายละเอียดการติดต่อ",
            "หมายเหตุ",
        ]

        table_data: list[list[Any]] = [
            [
                Paragraph(html.escape(header), styles["header_cell"])
                for header in table_header
            ]
        ]

        processed_rows = 0

        for row in rows:
            PatrolReportPdfService._raise_if_cancelled(is_cancelled)

            # แสดงทั้งข้อมูลตามแผนและงานอื่น ๆ ในตารางเดียวตามลำดับเวลาเข้า.
            table_data.append(
                [
                    Paragraph(str(row.number), styles["cell_center"]),
                    Paragraph(html.escape(row.contract_code), styles["cell"]),
                    Paragraph(html.escape(row.location_name), styles["cell"]),
                    Paragraph(
                        html.escape(row.shift_label),
                        styles["cell_center"],
                    ),
                    Paragraph(
                        html.escape(row.display_status).replace("\n", "<br/>"),
                        PatrolReportPdfService._get_status_badge_style(
                            display_status=row.display_status,
                            styles=styles,
                        ),
                    ),
                    Paragraph(
                        html.escape(row.plan_date_text),
                        styles["cell_center"],
                    ),
                    Paragraph(
                        html.escape(row.check_in_text),
                        styles["cell_center"],
                    ),
                    Paragraph(
                        html.escape(row.check_out_text),
                        styles["cell_center"],
                    ),
                    Paragraph(
                        html.escape(row.operator_text),
                        styles["operator_cell"],
                    ),
                    Paragraph(
                        html.escape(row.contact_detail),
                        styles["cell"],
                    ),
                    Paragraph(
                        html.escape(row.call_note),
                        styles["cell"],
                    ),
                ]
            )

            processed_rows += 1
            if progress_callback:
                completed_rows = progress_offset + processed_rows
                # สงวนขั้นสุดท้ายไว้ให้ document.build() เขียน PDF เสร็จก่อน
                # โดยเฉพาะรายงานที่แนบรูปซึ่งอาจใช้เวลาหลังสร้างตารางอีกมาก.
                reported_rows = min(
                    completed_rows,
                    max(progress_total - 1, 0),
                )
                progress_callback(
                    reported_rows,
                    progress_total,
                )

        main_table = Table(
            table_data,
            # A4 แนวนอน (พื้นที่ตาราง 273 mm):
            # ขยาย "ผู้ดำเนินการ" จาก 30 เป็น 45 mm
            # และแยก "รายละเอียดการติดต่อ" / "หมายเหตุ" เป็นคนละคอลัมน์.
            colWidths=[
                8 * mm,
                17 * mm,
                29 * mm,
                14 * mm,
                30 * mm,
                21 * mm,
                24 * mm,
                24 * mm,
                38 * mm,
                28 * mm,
                28 * mm,
            ],
            repeatRows=1,
            hAlign="LEFT",
        )
        main_table.setStyle(
            TableStyle(
                [
                    # หัวตารางสีเทา ตัวอักษรสีดำ
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#D9D9D9")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.black),

                    # ตารางข้อมูลสีขาวทุกแถว
                    ("BACKGROUND", (0, 1), (-1, -1), colors.white),

                    # ลำดับ + ผลัดถึงวันเวลาออก จัดกึ่งกลาง
                    ("ALIGN", (0, 0), (0, -1), "CENTER"),
                    ("ALIGN", (3, 0), (7, -1), "CENTER"),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),

                    ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#BFC5CC")),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                    ("LEFTPADDING", (0, 0), (-1, -1), 3),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 3),
                ]
            )
        )

        story.append(main_table)

        if include_images:
            scope_text = PatrolReportPdfService._format_scope_summary(
                rows=rows,
                filters=filters,
                scope=scope,
            )
            image_rows = [
                row
                for row in rows
                if row.check_in_image or row.check_out_image
            ]

            # ใช้ลำดับเดียวกับตารางสรุป และไม่รวมงานต่างประเภทไว้หน้าเดียวกัน
            # เพื่อให้หัวหน้ารายละเอียดตรงกับข้อมูลทุกแถวในหน้านั้น
            image_pages: list[
                tuple[PatrolReportPlanMode, list[PatrolReportPdfRow]]
            ] = []

            for row in image_rows:
                if (
                    not image_pages
                    or image_pages[-1][0] != row.plan_mode
                    or len(image_pages[-1][1])
                    >= PatrolReportPdfService.IMAGE_DETAIL_ROWS_PER_PAGE
                ):
                    image_pages.append((row.plan_mode, [row]))
                else:
                    image_pages[-1][1].append(row)

            for image_plan_mode, page_rows in image_pages:
                PatrolReportPdfService._raise_if_cancelled(is_cancelled)

                story.append(PageBreak())
                story.extend(
                    PatrolReportPdfService._build_image_detail_page_header_story(
                        scope_text=scope_text,
                        plan_mode=image_plan_mode,
                        styles=styles,
                    )
                )

                for row_index, row in enumerate(page_rows):
                    PatrolReportPdfService._raise_if_cancelled(is_cancelled)

                    story.extend(
                        PatrolReportPdfService._build_image_detail_story(
                            row=row,
                            styles=styles,
                        )
                    )

                    # เว้นระยะระหว่างจุดที่ 1 และจุดที่ 2 ในหน้าเดียวกัน
                    if row_index < len(page_rows) - 1:
                        story.append(Spacer(1, 4 * mm))

        return story

    @staticmethod
    def _get_status_badge_style(
        *,
        display_status: str,
        styles: Mapping[str, ParagraphStyle],
    ) -> ParagraphStyle:
        """เลือกสีป้ายสถานะในตารางสรุป โดยไม่เปลี่ยนค่าสถานะจริง."""
        normalized_status = str(display_status or "").strip()

        if normalized_status == "ตรวจแล้ว":
            return styles["status_completed"]

        if normalized_status.startswith("เรียบร้อย"):
            return styles["status_finished"]

        if normalized_status == "อยู่ระหว่างการเข้าตรวจ":
            return styles["status_in_progress"]

        if normalized_status == "ตรวจแล้ว(โทร)":
            return styles["status_completed_call"]

        return styles["cell_center"]

    @staticmethod
    def _build_image_detail_page_header_story(
        *,
        scope_text: str,
        plan_mode: PatrolReportPlanMode,
        styles: Mapping[str, ParagraphStyle],
    ) -> list[Any]:
        """สร้างหัวหน้ารายละเอียดรูปภาพ 1 ครั้งต่อ 1 หน้า."""
        detail_title = (
            "ข้อมูลรายละเอียดผู้เข้าตรวจหน่วยงาน รายบุคคล"
            if plan_mode == "planned"
            else "ข้อมูลรายละเอียดงานอื่น ๆ (ติดตาม / มอบหมาย) รายบุคคล"
        )

        return [
            Paragraph(
                (
                    f"{html.escape(detail_title)} "
                    '<font color="#DC2626">'
                    "(รูปเวลาเข้า และเวลาออกต้องเป็นบุคคลคนเดียวกัน)"
                    "</font>"
                ),
                styles["appendix_title"],
            ),
            Spacer(1, 1.5 * mm),
            Paragraph(html.escape(scope_text), styles["appendix_scope"]),
            Spacer(1, 3 * mm),
        ]

    @staticmethod
    def _build_image_detail_story(
        *,
        row: PatrolReportPdfRow,
        styles: Mapping[str, ParagraphStyle],
    ) -> list[Any]:
        """
        สร้างรายละเอียดรูปภาพของ 1 จุดรักษาการณ์แบบกระชับ
        เพื่อให้วางได้ 2 จุดต่อ 1 หน้า A4 แนวนอน.
        """
        title = f"{row.number}. {row.contract_code} - {row.location_name}"

        detail_data = [
            [
                Paragraph("ผลัด :", styles["detail_label_right"]),
                Paragraph(
                    html.escape(row.shift_label),
                    styles["detail_cell_center"],
                ),
                Paragraph("สถานะ :", styles["detail_label_right"]),
                Paragraph(
                    html.escape(row.display_status).replace("\n", "<br/>"),
                    PatrolReportPdfService._get_status_badge_style(
                        display_status=row.display_status,
                        styles=styles,
                    ),
                ),
            ],
            [
                Paragraph("เวลาเข้า :", styles["detail_label_right"]),
                Paragraph(
                    html.escape(row.check_in_text),
                    styles["detail_cell_center"],
                ),
                Paragraph("เวลาออก :", styles["detail_label_right"]),
                Paragraph(
                    html.escape(row.check_out_text),
                    styles["detail_cell_center"],
                ),
            ],
        ]

        detail_table = Table(
            detail_data,
            colWidths=[22 * mm, 72 * mm, 22 * mm, 72 * mm],
            hAlign="CENTER",
        )
        detail_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), colors.white),

                    # พื้นหลังสีเทาสำหรับหัวข้อ: ผลัด / สถานะ / เวลาเข้า / เวลาออก
                    ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#D9D9D9")),
                    ("BACKGROUND", (2, 0), (2, -1), colors.HexColor("#D9D9D9")),

                    ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#BFC5CC")),
                    ("ALIGN", (0, 0), (0, -1), "RIGHT"),
                    ("ALIGN", (1, 0), (1, -1), "CENTER"),
                    ("ALIGN", (2, 0), (2, -1), "RIGHT"),
                    ("ALIGN", (3, 0), (3, -1), "CENTER"),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                    ("LEFTPADDING", (0, 0), (-1, -1), 3),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 3),
                ]
            )
        )

        image_table = Table(
            [
                [
                    Paragraph("<b>รูปเวลาเข้า</b>", styles["image_label"]),
                    Paragraph("<b>รูปเวลาออก</b>", styles["image_label"]),
                ],
                [
                    PatrolReportPdfService._to_pdf_image_or_text(
                        row.check_in_image,
                        styles=styles,
                    ),
                    PatrolReportPdfService._to_pdf_image_or_text(
                        row.check_out_image,
                        styles=styles,
                    ),
                ],
            ],
            # กว้างรวม 188 mm เท่ากับ detail_table เพื่อให้ขอบซ้าย/ขวาตรงกัน
            colWidths=[94 * mm, 94 * mm],
            hAlign="CENTER",
        )
        image_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), colors.white),

                    # พื้นหลังสีเทาสำหรับหัวข้อรูปเวลาเข้า / รูปเวลาออก
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#D9D9D9")),

                    ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#BFC5CC")),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                    ("TOPPADDING", (0, 0), (-1, -1), 5),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ]
            )
        )

        return [
            KeepTogether(
                [
                    Paragraph(html.escape(title), styles["section_title"]),
                    Spacer(1, 1.5 * mm),
                    detail_table,
                    Spacer(1, 1.5 * mm),
                    image_table,
                ]
            )
        ]


    @staticmethod
    def _get_logo_image() -> PdfImage | None:
        """
        โหลดโลโก้ GUTS สำหรับหัวรายงาน

        ไฟล์ที่ต้องมี:
        backend/app/resources/images/logoguts.png
        """
        logo_path = (
            Path(__file__).resolve().parents[1]
            / "resources"
            / "images"
            / PatrolReportPdfService.LOGO_FILE_NAME
        )

        if not logo_path.is_file():
            logger.warning("ไม่พบโลโก้ PDF ที่ %s", logo_path)
            return None

        try:
            logo = PdfImage(str(logo_path))
            logo._restrictSize(
                PatrolReportPdfService.LOGO_MAX_WIDTH_MM * mm,
                PatrolReportPdfService.LOGO_MAX_HEIGHT_MM * mm,
            )
            logo.hAlign = "CENTER"
            return logo
        except Exception:
            logger.exception("ไม่สามารถโหลดโลโก้ PDF ได้: %s", logo_path)
            return None

    @staticmethod
    def _to_pdf_image_or_text(
        value: str | None,
        *,
        styles: Mapping[str, ParagraphStyle],
    ) -> Any:
        image_bytes = PatrolReportPdfService._read_image_bytes(value)

        if not image_bytes:
            return Paragraph("ไม่มีรูปภาพ", styles["image_empty"])

        try:
            compressed_bytes = (
                PatrolReportPdfService._prepare_image_bytes_for_pdf(
                    image_bytes
                )
            )
            image_buffer = io.BytesIO(compressed_bytes)

            pdf_image = PdfImage(image_buffer)
            # เก็บ buffer ไว้ตลอดอายุของ Flowable จน ReportLab สร้าง PDF เสร็จ
            pdf_image._source_buffer = image_buffer  # type: ignore[attr-defined]
            pdf_image._restrictSize(
                PatrolReportPdfService.IMAGE_MAX_WIDTH_MM * mm,
                PatrolReportPdfService.IMAGE_MAX_HEIGHT_MM * mm,
            )
            return pdf_image
        except Exception:
            logger.exception("ไม่สามารถเตรียมรูปภาพสำหรับ PDF ได้")
            return Paragraph(
                "ไม่สามารถแสดงรูปภาพได้",
                styles["image_empty"],
            )

    @staticmethod
    def _prepare_image_bytes_for_pdf(image_bytes: bytes) -> bytes:
        """
        ย่อและบีบอัดสำเนารูปสำหรับฝังใน PDF ด้วย pyvips

        - ไม่แก้ไขไฟล์รูปต้นฉบับ
        - หมุนรูปตาม EXIF
        - รักษาอัตราส่วนภาพและไม่ขยายรูปที่เล็กกว่าขนาดเป้าหมาย
        - วางภาพโปร่งใสบนพื้นหลังสีขาวก่อนบันทึกเป็น JPEG
        """
        max_width_px = max(
            1,
            round(
                PatrolReportPdfService.IMAGE_MAX_WIDTH_MM
                / 25.4
                * PatrolReportPdfService.PDF_IMAGE_DPI
            ),
        )
        max_height_px = max(
            1,
            round(
                PatrolReportPdfService.IMAGE_MAX_HEIGHT_MM
                / 25.4
                * PatrolReportPdfService.PDF_IMAGE_DPI
            ),
        )

        # อ่านและย่อจาก bytes โดยตรง เพื่อไม่ต้องถอดรหัสรูปขนาดเต็ม
        # size="down" ป้องกันการขยายรูปที่เล็กกว่าขนาดเป้าหมาย
        # no_rotate=False ให้หมุนรูปตาม EXIF โดยอัตโนมัติ
        image = pyvips.Image.thumbnail_buffer(
            image_bytes,
            max_width_px,
            height=max_height_px,
            size="down",
            no_rotate=False,
            fail_on="error",
        )

        # JPEG ไม่มี alpha channel จึงวางภาพโปร่งใสบนพื้นหลังสีขาวก่อน
        if image.hasalpha():
            image = image.flatten(background=[255, 255, 255])

        # รองรับรูป Grayscale, CMYK และรูปแบบสีอื่นก่อนบันทึกเป็น JPEG
        if image.interpretation != "srgb":
            image = image.colourspace("srgb")

        compressed_bytes = bytes(
            image.jpegsave_buffer(
                Q=PatrolReportPdfService.PDF_IMAGE_JPEG_QUALITY,
                optimize_coding=True,
                interlace=False,
                subsample_mode="on",
            )
        )

        if not compressed_bytes:
            raise ValueError("ไม่สามารถบีบอัดรูปภาพสำหรับ PDF ได้")

        return compressed_bytes

    @staticmethod
    def _read_image_bytes(value: str | None) -> bytes | None:
        if not value:
            return None

        text_value = str(value).strip()

        if (
            not text_value
            or text_value == "-"
            or text_value.upper() == "NULL"
        ):
            return None

        if text_value.lower().startswith("data:image/"):
            _, _, encoded = text_value.partition(",")
            return PatrolReportPdfService._decode_base64_image(encoded)

        if PatrolReportPdfService._looks_like_raw_base64(text_value):
            return PatrolReportPdfService._decode_base64_image(text_value)

        local_path = PatrolReportPdfService._resolve_local_upload_path(
            text_value,
        )

        if local_path is not None and local_path.is_file():
            try:
                data = local_path.read_bytes()
            except OSError:
                return None

            return (
                data
                if 0 < len(data) <= PatrolReportPdfService.MAX_IMAGE_BYTES
                else None
            )

        # ไม่ดาวน์โหลด URL ภายนอกใน Worker เพื่อกัน request ที่ไม่จำเป็น
        # และลดความเสี่ยง SSRF. สำหรับรูปจากระบบให้เก็บไว้ใน /uploads
        # หรือเป็น base64/data URI.
        return None

    @staticmethod
    def _decode_base64_image(encoded: str) -> bytes | None:
        try:
            image_bytes = base64.b64decode(
                encoded.strip(),
                validate=True,
            )
        except (binascii.Error, ValueError):
            return None

        if not image_bytes:
            return None

        if len(image_bytes) > PatrolReportPdfService.MAX_IMAGE_BYTES:
            return None

        return image_bytes

    @staticmethod
    def _resolve_local_upload_path(value: str) -> Path | None:
        """
        รองรับ path ที่เก็บใน DB เช่น:
        - uploads/checkin/a.jpg
        - /uploads/checkin/a.jpg
        - http://localhost:8000/uploads/checkin/a.jpg

        ห้ามให้ path ออกนอก backend/uploads.
        """

        uploads_root = Path(__file__).resolve().parents[2] / "uploads"
        normalized = value.replace("\\", "/")

        uploads_marker = "/uploads/"
        if uploads_marker in normalized:
            normalized = normalized.split(uploads_marker, 1)[1]
        elif normalized.startswith("uploads/"):
            normalized = normalized[len("uploads/"):]
        elif normalized.startswith("/uploads/"):
            normalized = normalized[len("/uploads/"):]
        else:
            return None

        candidate = (uploads_root / normalized.lstrip("/")).resolve()

        try:
            candidate.relative_to(uploads_root.resolve())
        except ValueError:
            return None

        return candidate

    @staticmethod
    def _first_image_value(
        row: Mapping[str, Any],
        candidate_keys: Iterable[str],
    ) -> str | None:
        for key in candidate_keys:
            value = row.get(key)

            if value is None:
                continue

            text_value = str(value).strip()

            if (
                text_value
                and text_value != "-"
                and text_value.upper() != "NULL"
            ):
                return text_value

        return None

    @staticmethod
    def _status_label(value: str) -> str:
        labels = {
            "completed": "ตรวจแล้ว",
            "in_progress": "อยู่ระหว่างการเข้าตรวจ",
            "pending": "รอดำเนินการเข้าตรวจ",
        }

        return labels.get(value.strip().lower(), value or "-")

    @staticmethod
    def _get_filter_value(
        filters: PatrolReportExportFilter,
        *names: str,
    ) -> Any:
        """อ่านค่า filter ได้ทั้งชื่อ snake_case และ camelCase."""
        for name in names:
            value = getattr(filters, name, None)

            if value is not None and str(value).strip():
                return value

        return None

    @staticmethod
    def _get_selected_plan_modes(
        filters: PatrolReportExportFilter,
    ) -> list[PatrolReportPlanMode]:
        """อ่านโหมดจาก schema ใหม่ และยังรองรับ Job เก่าที่มี plan_mode ค่าเดียว."""
        raw_modes = PatrolReportPdfService._get_filter_value(
            filters,
            "plan_modes",
            "planModes",
        )

        if raw_modes is None:
            legacy_mode = (
                PatrolReportPdfService._get_filter_value(
                    filters,
                    "plan_mode",
                    "planMode",
                )
                or "planned"
            )
            raw_modes = [legacy_mode]

        if isinstance(raw_modes, str):
            raw_modes = [raw_modes]

        selected_modes: list[PatrolReportPlanMode] = []
        for raw_mode in raw_modes:
            if raw_mode not in ("planned", "outside_plan"):
                continue

            if raw_mode not in selected_modes:
                selected_modes.append(raw_mode)

        return selected_modes or ["planned"]

    @staticmethod
    def _format_selected_filters(
        filters: PatrolReportExportFilter,
        *,
        plan_mode: PatrolReportPlanMode | None,
    ) -> str:
        """ข้อความเงื่อนไขที่เลือกดูสำหรับแสดงด้านซ้ายของส่วนหัว."""
        workday_start = PatrolReportPdfService._get_filter_value(
            filters,
            "workday_start",
            "workdayStart",
            "start_date",
            "startDate",
        )
        workday_end = PatrolReportPdfService._get_filter_value(
            filters,
            "workday_end",
            "workdayEnd",
            "end_date",
            "endDate",
        )
        shift_type = (
            PatrolReportPdfService._get_filter_value(
                filters,
                "shift_type",
                "shiftType",
            )
            or "all"
        )

        if plan_mode == "planned":
            plan_text = "การตรวจหน่วยงานตามแผน"
        elif plan_mode == "outside_plan":
            plan_text = "งานอื่น ๆ (ติดตาม / มอบหมาย)"
        else:
            plan_text = (
                "การตรวจหน่วยงานตามแผน และ "
                "งานอื่น ๆ (ติดตาม / มอบหมาย)"
            )
        shift_text = {
            "all": "ทั้งหมด",
            "day": "ผลัดกลางวัน",
            "night": "ผลัดกลางคืน",
        }.get(str(shift_type), str(shift_type))

        return (
            "ข้อมูลที่เลือกตรวจสอบ: "
            f"ช่วงวันที่ {html.escape(PatrolReportPdfService._format_thai_date(workday_start))}"
            f" - {html.escape(PatrolReportPdfService._format_thai_date(workday_end))}"
            f" | ประเภทรายงาน: {html.escape(plan_text)}"
            f" | ผลัด: {html.escape(shift_text)}"
        )

    @staticmethod
    def _format_scope_summary(
        *,
        rows: list[PatrolReportPdfRow],
        filters: PatrolReportExportFilter,
        scope: PatrolReportPdfScope,
    ) -> str:
        """แสดงชื่อ ภาค | เขต | เส้นทาง ใต้ชื่อรายงาน โดยไม่แสดงรหัส ID."""

        first_row = rows[0] if rows else None

        def get_scope_label(
            *,
            master_name: str,
            row_value: str | None,
            filter_names: tuple[str, ...],
        ) -> str | None:
            # ต้องตรวจ filter ก่อน เพื่อไม่ให้กรณีเลือก "ทั้งหมด"
            # หยิบชื่อขอบเขตจากข้อมูลแถวแรกมาแสดงโดยไม่ได้ตั้งใจ.
            filter_value = PatrolReportPdfService._get_filter_value(
                filters,
                *filter_names,
            )
            if filter_value is None:
                return None

            # เมื่อมีการเลือก filter: ตาราง master > view > ไม่พบชื่อ
            master_text = str(master_name or "").strip()
            if master_text:
                return master_text

            row_text = str(row_value or "").strip()
            if row_text:
                return row_text

            return "ไม่พบชื่อ"

        department_text = get_scope_label(
            master_name=scope.department_name,
            row_value=first_row.department_name if first_row else None,
            filter_names=("department_id", "departmentId"),
        )
        division_text = get_scope_label(
            master_name=scope.division_name,
            row_value=first_row.division_name if first_row else None,
            filter_names=("division_id", "divisionId"),
        )
        route_text = get_scope_label(
            master_name=scope.route_name,
            row_value=first_row.route_name if first_row else None,
            filter_names=("route_id", "routeId"),
        )

        # แสดงเฉพาะขอบเขตที่ผู้ใช้เลือกจริง เช่น route_id=None จะไม่แสดงเส้นทาง.
        return " | ".join(
            html.escape(scope_text)
            for scope_text in (
                department_text,
                division_text,
                route_text,
            )
            if scope_text
        )

    @staticmethod
    def _format_filter_summary(
        filters: PatrolReportExportFilter,
    ) -> str:
        """
        เก็บ method เดิมไว้สำหรับ compatibility กับ code อื่น
        แต่หน้า PDF ใหม่ใช้ _format_selected_filters() แยกจากเวลาที่ดึงข้อมูลแล้ว.
        """
        selected_modes = PatrolReportPdfService._get_selected_plan_modes(filters)
        return PatrolReportPdfService._format_selected_filters(
            filters,
            plan_mode=selected_modes[0],
        )

    @staticmethod
    def _format_thai_date(value: Any) -> str:
        parsed = PatrolReportPdfService._parse_datetime(value)

        if parsed is None:
            return "-"

        thai_months = (
            "ม.ค.",
            "ก.พ.",
            "มี.ค.",
            "เม.ย.",
            "พ.ค.",
            "มิ.ย.",
            "ก.ค.",
            "ส.ค.",
            "ก.ย.",
            "ต.ค.",
            "พ.ย.",
            "ธ.ค.",
        )

        return (
            f"{parsed.day} {thai_months[parsed.month - 1]} "
            f"{parsed.year + 543}"
        )

    @staticmethod
    def _format_thai_datetime(value: Any) -> str:
        parsed = PatrolReportPdfService._parse_datetime(value)

        if parsed is not None:
            return (
                f"{PatrolReportPdfService._format_thai_date(parsed)} "
                f"{parsed:%H:%M} น."
            )

        text_value = str(value or "").strip()
        if re.fullmatch(r"\d{1,2}:\d{2}(?::\d{2})?", text_value):
            return f"{text_value[:5]} น."

        return "-"

    @staticmethod
    def _parse_datetime(value: Any) -> datetime | None:
        if value is None:
            return None

        if isinstance(value, datetime):
            return value

        if isinstance(value, date):
            return datetime.combine(value, datetime.min.time())

        text_value = str(value).strip()

        if not text_value:
            return None

        normalized = text_value.replace("Z", "+00:00")

        try:
            return datetime.fromisoformat(normalized)
        except ValueError:
            pass

        for format_value in (
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M",
            "%Y-%m-%d",
        ):
            try:
                return datetime.strptime(text_value, format_value)
            except ValueError:
                continue

        return None

    @staticmethod
    def _text(value: Any, fallback: str = "-") -> str:
        if value is None:
            return fallback

        text_value = str(value).strip()

        return text_value or fallback

    @staticmethod
    def _looks_like_raw_base64(value: str) -> bool:
        if len(value) < 80:
            return False

        return re.fullmatch(
            r"[A-Za-z0-9+/]+={0,2}",
            value,
        ) is not None

    @staticmethod
    def _raise_if_cancelled(
        is_cancelled: CancelledCallback | None,
    ) -> None:
        if is_cancelled is not None and is_cancelled():
            raise PatrolReportPdfCancelledError()

    @staticmethod
    def _remove_partial_file(output_path: Path) -> None:
        try:
            if output_path.is_file():
                output_path.unlink()
        except OSError:
            pass

    @staticmethod
    def _register_thai_fonts() -> None:
        if PatrolReportPdfService._fonts_registered:
            return

        font_directory = (
            Path(__file__).resolve().parents[1]
            / "resources"
            / "fonts"
        )
        regular_path = font_directory / PatrolReportPdfService.FONT_REGULAR_FILE
        bold_path = font_directory / PatrolReportPdfService.FONT_BOLD_FILE

        if not regular_path.is_file() or not bold_path.is_file():
            raise PatrolReportPdfBuildError(
                "ไม่พบไฟล์ฟอนต์ Sarabun สำหรับสร้าง PDF"
            )

        pdfmetrics.registerFont(
            TTFont(
                PatrolReportPdfService.FONT_REGULAR_NAME,
                str(regular_path),
                shapable=True,
            )
        )
        pdfmetrics.registerFont(
            TTFont(
                PatrolReportPdfService.FONT_BOLD_NAME,
                str(bold_path),
                shapable=True,
            )
        )

        # รองรับข้อความที่ ReportLab แปลงจาก <b>...</b> ให้ใช้ Sarabun-SemiBold
        pdfmetrics.registerFontFamily(
            PatrolReportPdfService.FONT_REGULAR_NAME,
            normal=PatrolReportPdfService.FONT_REGULAR_NAME,
            bold=PatrolReportPdfService.FONT_BOLD_NAME,
        )

        PatrolReportPdfService._fonts_registered = True

    @staticmethod
    def _make_styles() -> dict[str, ParagraphStyle]:
        base_styles = getSampleStyleSheet()

        styles = {
            "title": ParagraphStyle(
                "PatrolReportTitle",
                parent=base_styles["Title"],
                fontName=PatrolReportPdfService.FONT_BOLD_NAME,
                fontSize=PatrolReportPdfService.FONT_SIZE_TITLE,
                leading=PatrolReportPdfService.FONT_LEADING_TITLE,
                alignment=TA_CENTER,
                spaceAfter=1.5 * mm,
            ),
            "scope": ParagraphStyle(
                "PatrolReportScope",
                parent=base_styles["Normal"],
                fontName=PatrolReportPdfService.FONT_REGULAR_NAME,
                fontSize=PatrolReportPdfService.FONT_SIZE_SCOPE,
                leading=PatrolReportPdfService.FONT_LEADING_SCOPE,
                alignment=TA_CENTER,
                textColor=colors.black,
            ),
            "subtitle": ParagraphStyle(
                "PatrolReportSubtitle",
                parent=base_styles["Normal"],
                fontName=PatrolReportPdfService.FONT_REGULAR_NAME,
                fontSize=PatrolReportPdfService.FONT_SIZE_SUBTITLE,
                leading=PatrolReportPdfService.FONT_LEADING_SUBTITLE,
                alignment=TA_CENTER,
                textColor=colors.HexColor("#334155"),
            ),
            "filter_left": ParagraphStyle(
                "PatrolReportFilterLeft",
                parent=base_styles["Normal"],
                fontName=PatrolReportPdfService.FONT_REGULAR_NAME,
                fontSize=PatrolReportPdfService.FONT_SIZE_HEADER_INFO,
                leading=PatrolReportPdfService.FONT_LEADING_HEADER_INFO,
                alignment=TA_LEFT,
                textColor=colors.black,
            ),
            "generated_at_right": ParagraphStyle(
                "PatrolReportGeneratedAtRight",
                parent=base_styles["Normal"],
                fontName=PatrolReportPdfService.FONT_REGULAR_NAME,
                fontSize=PatrolReportPdfService.FONT_SIZE_HEADER_INFO,
                leading=PatrolReportPdfService.FONT_LEADING_HEADER_INFO,
                alignment=TA_RIGHT,
                textColor=colors.black,
            ),
            "appendix_title": ParagraphStyle(
                "PatrolReportAppendixTitle",
                parent=base_styles["Heading2"],
                fontName=PatrolReportPdfService.FONT_BOLD_NAME,
                fontSize=PatrolReportPdfService.FONT_SIZE_APPENDIX_TITLE,
                leading=PatrolReportPdfService.FONT_LEADING_APPENDIX_TITLE,
                alignment=TA_CENTER,
                textColor=colors.HexColor("#1E3A8A"),
            ),
            "appendix_scope": ParagraphStyle(
                "PatrolReportAppendixScope",
                parent=base_styles["Normal"],
                fontName=PatrolReportPdfService.FONT_REGULAR_NAME,
                fontSize=PatrolReportPdfService.FONT_SIZE_SCOPE,
                leading=PatrolReportPdfService.FONT_LEADING_SCOPE,
                alignment=TA_CENTER,
                textColor=colors.black,
            ),
            "detail_label_right": ParagraphStyle(
                "PatrolReportDetailLabelRight",
                parent=base_styles["Normal"],
                fontName=PatrolReportPdfService.FONT_BOLD_NAME,
                fontSize=PatrolReportPdfService.FONT_SIZE_DETAIL,
                leading=PatrolReportPdfService.FONT_LEADING_DETAIL,
                alignment=TA_RIGHT,
                textColor=colors.black,
            ),
            "detail_value_right": ParagraphStyle(
                "PatrolReportDetailValueRight",
                parent=base_styles["Normal"],
                fontName=PatrolReportPdfService.FONT_REGULAR_NAME,
                fontSize=PatrolReportPdfService.FONT_SIZE_DETAIL,
                leading=PatrolReportPdfService.FONT_LEADING_DETAIL,
                alignment=TA_RIGHT,
                textColor=colors.black,
            ),
            "image_section_right": ParagraphStyle(
                "PatrolReportImageSectionRight",
                parent=base_styles["Normal"],
                fontName=PatrolReportPdfService.FONT_BOLD_NAME,
                fontSize=PatrolReportPdfService.FONT_SIZE_IMAGE_SECTION,
                leading=PatrolReportPdfService.FONT_LEADING_IMAGE_SECTION,
                alignment=TA_RIGHT,
                textColor=colors.black,
            ),
            "image_section_left": ParagraphStyle(
                "PatrolReportImageSectionLeft",
                parent=base_styles["Normal"],
                fontName=PatrolReportPdfService.FONT_BOLD_NAME,
                fontSize=PatrolReportPdfService.FONT_SIZE_IMAGE_SECTION,
                leading=PatrolReportPdfService.FONT_LEADING_IMAGE_SECTION,
                alignment=TA_LEFT,
                textColor=colors.black,
            ),
            "section_title": ParagraphStyle(
                "PatrolReportSectionTitle",
                parent=base_styles["Heading2"],
                fontName=PatrolReportPdfService.FONT_BOLD_NAME,
                fontSize=PatrolReportPdfService.FONT_SIZE_SECTION_TITLE,
                leading=PatrolReportPdfService.FONT_LEADING_SECTION_TITLE,
                alignment=TA_LEFT,
                textColor=colors.HexColor("#1E3A8A"),
            ),
            "header_cell": ParagraphStyle(
                "PatrolReportHeaderCell",
                parent=base_styles["Normal"],
                fontName=PatrolReportPdfService.FONT_BOLD_NAME,
                fontSize=PatrolReportPdfService.FONT_SIZE_TABLE_HEADER,
                leading=PatrolReportPdfService.FONT_LEADING_TABLE_HEADER,
                alignment=TA_CENTER,
                textColor=colors.black,
            ),
            "table_group": ParagraphStyle(
                "PatrolReportTableGroup",
                parent=base_styles["Normal"],
                fontName=PatrolReportPdfService.FONT_BOLD_NAME,
                fontSize=PatrolReportPdfService.FONT_SIZE_TABLE_HEADER,
                leading=PatrolReportPdfService.FONT_LEADING_TABLE_HEADER,
                alignment=TA_LEFT,
                textColor=colors.HexColor("#1E3A8A"),
            ),
            "cell": ParagraphStyle(
                "PatrolReportCell",
                parent=base_styles["Normal"],
                fontName=PatrolReportPdfService.FONT_REGULAR_NAME,
                fontSize=PatrolReportPdfService.FONT_SIZE_TABLE_CELL,
                leading=PatrolReportPdfService.FONT_LEADING_TABLE_CELL,
                alignment=TA_LEFT,
            ),
            "cell_center": ParagraphStyle(
                "PatrolReportCellCenter",
                parent=base_styles["Normal"],
                fontName=PatrolReportPdfService.FONT_REGULAR_NAME,
                fontSize=PatrolReportPdfService.FONT_SIZE_TABLE_CELL,
                leading=PatrolReportPdfService.FONT_LEADING_TABLE_CELL,
                alignment=TA_CENTER,
            ),
            "status_completed": ParagraphStyle(
                "PatrolReportStatusCompleted",
                parent=base_styles["Normal"],
                fontName=PatrolReportPdfService.FONT_BOLD_NAME,
                fontSize=PatrolReportPdfService.FONT_SIZE_TABLE_CELL,
                leading=PatrolReportPdfService.FONT_LEADING_TABLE_CELL,
                alignment=TA_CENTER,
                textColor=colors.HexColor("#15803D"),
                backColor=colors.HexColor("#DCFCE7"),
                borderColor=colors.HexColor("#86EFAC"),
                borderWidth=0.5,
                borderPadding=2,
            ),
            "status_finished": ParagraphStyle(
                "PatrolReportStatusFinished",
                parent=base_styles["Normal"],
                fontName=PatrolReportPdfService.FONT_BOLD_NAME,
                fontSize=6,
                leading=7.5,
                alignment=TA_CENTER,
                splitLongWords=False,
                textColor=colors.HexColor("#1D4ED8"),
                backColor=colors.HexColor("#DBEAFE"),
                borderColor=colors.HexColor("#93C5FD"),
                borderWidth=0.5,
                borderPadding=2,
            ),
            "status_in_progress": ParagraphStyle(
                "PatrolReportStatusInProgress",
                parent=base_styles["Normal"],
                fontName=PatrolReportPdfService.FONT_BOLD_NAME,
                fontSize=PatrolReportPdfService.FONT_SIZE_TABLE_CELL,
                leading=PatrolReportPdfService.FONT_LEADING_TABLE_CELL,
                alignment=TA_CENTER,
                textColor=colors.HexColor("#9A3412"),
                backColor=colors.HexColor("#FFF7ED"),
                borderColor=colors.HexColor("#FDBA74"),
                borderWidth=0.5,
                borderPadding=2,
            ),
            "status_completed_call": ParagraphStyle(
                "PatrolReportStatusCompletedCall",
                parent=base_styles["Normal"],
                fontName=PatrolReportPdfService.FONT_BOLD_NAME,
                fontSize=PatrolReportPdfService.FONT_SIZE_TABLE_CELL,
                leading=PatrolReportPdfService.FONT_LEADING_TABLE_CELL,
                alignment=TA_CENTER,
                textColor=colors.HexColor("#7E22CE"),
                backColor=colors.HexColor("#F3E8FF"),
                borderColor=colors.HexColor("#D8B4FE"),
                borderWidth=0.5,
                borderPadding=2,
            ),
            "operator_cell": ParagraphStyle(
                "PatrolReportOperatorCell",
                parent=base_styles["Normal"],
                fontName=PatrolReportPdfService.FONT_REGULAR_NAME,
                fontSize=PatrolReportPdfService.FONT_SIZE_OPERATOR_CELL,
                leading=PatrolReportPdfService.FONT_LEADING_OPERATOR_CELL,
                alignment=TA_LEFT,
            ),
            "detail_cell_center": ParagraphStyle(
                "PatrolReportDetailCellCenter",
                parent=base_styles["Normal"],
                fontName=PatrolReportPdfService.FONT_REGULAR_NAME,
                fontSize=PatrolReportPdfService.FONT_SIZE_DETAIL,
                leading=PatrolReportPdfService.FONT_LEADING_DETAIL,
                alignment=TA_CENTER,
            ),
            "image_label": ParagraphStyle(
                "PatrolReportImageLabel",
                parent=base_styles["Normal"],
                fontName=PatrolReportPdfService.FONT_BOLD_NAME,
                fontSize=PatrolReportPdfService.FONT_SIZE_IMAGE_LABEL,
                leading=PatrolReportPdfService.FONT_LEADING_IMAGE_LABEL,
                alignment=TA_CENTER,
            ),
            "image_empty": ParagraphStyle(
                "PatrolReportImageEmpty",
                parent=base_styles["Normal"],
                fontName=PatrolReportPdfService.FONT_REGULAR_NAME,
                fontSize=PatrolReportPdfService.FONT_SIZE_IMAGE_EMPTY,
                leading=PatrolReportPdfService.FONT_LEADING_IMAGE_EMPTY,
                alignment=TA_CENTER,
                textColor=colors.HexColor("#64748B"),
            ),
        }

        # เปิด OpenType shaping สำหรับข้อความภาษาไทย
        # เพื่อจัดตำแหน่งสระและวรรณยุกต์ให้สัมพันธ์กับพยัญชนะอย่างถูกต้อง
        for style in styles.values():
            style.shaping = True

        return styles

    @staticmethod
    def _create_numbered_canvas(
        *args: Any,
        **kwargs: Any,
    ) -> PatrolReportPdfNumberedCanvas:
        """สร้าง Canvas ที่แสดงเลขหน้าแบบ X/จำนวนหน้าทั้งหมด."""
        # บีบอัด content stream ของข้อความ เส้น และตารางใน PDF
        kwargs["pageCompression"] = 1

        return PatrolReportPdfNumberedCanvas(
            *args,
            footer_right_margin=12 * mm,
            footer_y=8 * mm,
            font_name=PatrolReportPdfService.FONT_REGULAR_NAME,
            font_size=PatrolReportPdfService.FONT_SIZE_FOOTER,
            **kwargs,
        )