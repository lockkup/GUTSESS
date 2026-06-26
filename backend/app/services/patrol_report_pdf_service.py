# backend/app/services/patrol_report_pdf_service.py
from __future__ import annotations

import base64
import binascii
import html
import io
import logging
import os
import re
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Any, Callable, Iterable, Mapping

from PIL import Image as PilImage
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    Image as PdfImage,
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
from app.schemas.patrol_report_export import PatrolReportExportFilter


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
    IMAGE_MAX_WIDTH_MM = 82
    IMAGE_MAX_HEIGHT_MM = 62

    # เก็บโลโก้ PNG ไว้ที่ backend/app/resources/images/logoguts.png
    # ใช้ PNG เพื่อให้ ReportLab แสดงผลได้เสถียรโดยไม่ต้องเพิ่ม dependency SVG.
    LOGO_FILE_NAME = "logoguts.png"
    LOGO_MAX_WIDTH_MM = 30
    LOGO_MAX_HEIGHT_MM = 18

    FONT_REGULAR_NAME = "Prompt"
    FONT_BOLD_NAME = "Prompt-SemiBold"
    FONT_REGULAR_FILE = "Prompt-Regular.ttf"
    FONT_BOLD_FILE = "Prompt-SemiBold.ttf"

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

            rows = PatrolReportPdfService._fetch_report_rows(
                db=db,
                filters=filters,
            )

            if not rows:
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
                progress_callback(0, len(rows))

            document = SimpleDocTemplate(
                str(output_path),
                pagesize=landscape(A4),
                leftMargin=12 * mm,
                rightMargin=12 * mm,
                topMargin=16 * mm,
                bottomMargin=14 * mm,
                title="รายงานการเข้าตรวจหน่วยงาน",
                author="GUTS-ESS",
            )

            story = PatrolReportPdfService._build_story(
                rows=rows,
                filters=filters,
                scope=scope,
                include_images=include_images,
                progress_callback=progress_callback,
                is_cancelled=is_cancelled,
            )

            PatrolReportPdfService._raise_if_cancelled(is_cancelled)

            document.build(
                story,
                onFirstPage=PatrolReportPdfService._draw_page_footer,
                onLaterPages=PatrolReportPdfService._draw_page_footer,
            )

            PatrolReportPdfService._raise_if_cancelled(is_cancelled)

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
            download_filename = (
                f"รายงานการเข้าตรวจหน่วยงาน_{generated_at:%Y%m%d_%H%M%S}.pdf"
            )

            return PatrolReportPdfBuildResult(
                download_filename=download_filename,
                file_size_bytes=file_size_bytes,
                report_row_count=len(rows),
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
    ) -> list[PatrolReportPdfRow]:
        available_columns = PatrolReportPdfService._get_view_columns(db=db)

        if not available_columns:
            raise PatrolReportPdfBuildError(
                f"ไม่สามารถอ่านโครงสร้าง view {PatrolReportPdfService.VIEW_NAME} ได้"
            )

        sql, params = PatrolReportPdfService._build_report_query(
            filters=filters,
            available_columns=available_columns,
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
            )
            for index, row in enumerate(db_rows, start=1)
        ]

    @staticmethod
    def _get_view_columns(*, db: Session) -> set[str]:
        """
        อ่าน column ที่มีจริงใน view เพื่อรองรับ view ที่มี optional columns
        เช่น contact_detail, call_status, images_checkin_1.
        """

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
                {"table_name": PatrolReportPdfService.VIEW_NAME},
            ).scalars()
            if str(column_name).strip()
        }

    @staticmethod
    def _build_report_query(
        *,
        filters: PatrolReportExportFilter,
        available_columns: set[str],
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
                return

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
        elif shift_type == "day" and has_column("shift_name_th"):
            # ไม่ hardcode shift_id เพราะแต่ละฐานข้อมูลอาจใช้ ID ไม่เหมือนกัน.
            where_parts.append("`shift_name_th` LIKE :shift_name_pattern")
            params["shift_name_pattern"] = "%กลางวัน%"
        elif shift_type == "night" and has_column("shift_name_th"):
            where_parts.append("`shift_name_th` LIKE :shift_name_pattern")
            params["shift_name_pattern"] = "%กลางคืน%"

        selected_status = get_filter("status") or "all"
        if selected_status != "all":
            if selected_status == "completed_call" and has_column("call_status"):
                where_parts.append("`call_status` IS NOT NULL")
            elif has_column("assignment_status"):
                where_parts.append("`assignment_status` = :assignment_status")
                params["assignment_status"] = selected_status

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

            if keyword_columns:
                keyword_conditions = [
                    f"`{column}` LIKE :keyword"
                    for column in keyword_columns
                ]
                where_parts.append(
                    "(" + " OR ".join(keyword_conditions) + ")"
                )
                params["keyword"] = f"%{keyword}%"

        sql = f"SELECT * FROM `{PatrolReportPdfService.VIEW_NAME}`"

        if where_parts:
            sql += " WHERE " + " AND ".join(where_parts)

        order_columns = [
            column
            for column in (
                "work_date",
                "workday",
                "route_id",
                "location_id",
                "contract_code",
                "employee_code",
            )
            if has_column(column)
        ]

        if order_columns:
            sql += " ORDER BY " + ", ".join(
                f"`{column}` ASC"
                for column in order_columns
            )

        return sql, params

    @staticmethod
    def _fetch_scope_names(
        *,
        db: Session,
        filters: PatrolReportExportFilter,
    ) -> PatrolReportPdfScope:
        """
        อ่านชื่อ ภาค / เขต / เส้นทาง จาก master table
        เพื่อไม่ให้หัวรายงาน PDF แสดงเป็นรหัส ID.

        ถ้า filter ไม่ได้เลือกค่าใด จะปล่อยว่างไว้ แล้วส่วนหัวจะแสดง "ทั้งหมด".
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

        display_status = (
            "ตรวจแล้ว(โทร)"
            if call_status is not None and str(call_status).strip()
            else PatrolReportPdfService._status_label(assignment_status)
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

        return PatrolReportPdfRow(
            number=number,
            contract_code=contract_code,
            location_name=location_name,
            department_name=department_name,
            division_name=division_name,
            route_name=route_name,
            shift_label=shift_label,
            display_status=display_status,
            plan_date_text=PatrolReportPdfService._format_thai_date(plan_date),
            check_in_text=PatrolReportPdfService._format_thai_datetime(
                row.get("started_datetime")
                or row.get("check_in_date_time")
                or row.get("check_in_datetime")
                or row.get("started_at")
            ),
            check_out_text=PatrolReportPdfService._format_thai_datetime(
                row.get("completed_datetime")
                or row.get("check_out_date_time")
                or row.get("check_out_datetime")
                or row.get("completed_at")
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
            check_in_image=PatrolReportPdfService._first_image_value(
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
            ),
            check_out_image=PatrolReportPdfService._first_image_value(
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
            ),
        )

    @staticmethod
    def _build_story(
        *,
        rows: list[PatrolReportPdfRow],
        filters: PatrolReportExportFilter,
        scope: PatrolReportPdfScope,
        include_images: bool,
        progress_callback: ProgressCallback | None,
        is_cancelled: CancelledCallback | None,
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
                "รายงานการเข้าตรวจหน่วยงาน",
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
                        PatrolReportPdfService._format_selected_filters(filters),
                        styles["filter_left"],
                    ),
                    Paragraph(
                        (
                            "เวลาที่ดึงข้อมูล: "
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

        table_header = [
            "ลำดับ",
            "รหัสสัญญา",
            "ชื่อจุดรักษาการณ์",
            "ผลัด",
            "สถานะ",
            "ตารางแผนงาน",
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

        total = len(rows)

        for current, row in enumerate(rows, start=1):
            PatrolReportPdfService._raise_if_cancelled(is_cancelled)

            # แยกข้อมูลการติดต่อและหมายเหตุเป็นคนละคอลัมน์
            # เพื่อให้หัวรายงานตรงกับตารางหน้า Patrol Report.
            table_data.append(
                [
                    Paragraph(str(row.number), styles["cell_center"]),
                    Paragraph(html.escape(row.contract_code), styles["cell"]),
                    Paragraph(html.escape(row.location_name), styles["cell"]),
                    Paragraph(html.escape(row.shift_label), styles["cell_center"]),
                    Paragraph(html.escape(row.display_status), styles["cell_center"]),
                    Paragraph(html.escape(row.plan_date_text), styles["cell_center"]),
                    Paragraph(html.escape(row.check_in_text), styles["cell_center"]),
                    Paragraph(html.escape(row.check_out_text), styles["cell_center"]),
                    # เพิ่มความกว้างของคอลัมน์ผู้ดำเนินการและลด font ลงเล็กน้อย
                    # เพื่อให้รหัสพนักงานพร้อมชื่อ-นามสกุลแสดงได้ครบขึ้น.
                    Paragraph(html.escape(row.operator_text), styles["operator_cell"]),
                    Paragraph(html.escape(row.contact_detail), styles["cell"]),
                    Paragraph(html.escape(row.call_note), styles["cell"]),
                ]
            )

            if progress_callback:
                progress_callback(current, total)

        main_table = Table(
            table_data,
            # A4 แนวนอน (พื้นที่ตาราง 273 mm):
            # ขยาย "ผู้ดำเนินการ" จาก 30 เป็น 45 mm
            # และแยก "รายละเอียดการติดต่อ" / "หมายเหตุ" เป็นคนละคอลัมน์.
            colWidths=[
                8 * mm,
                17 * mm,
                31 * mm,
                15 * mm,
                19 * mm,
                23 * mm,
                25 * mm,
                25 * mm,
                45 * mm,
                32 * mm,
                33 * mm,
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
            image_rows = [
                row
                for row in rows
                if row.check_in_image or row.check_out_image
            ]

            if image_rows:
                scope_text = PatrolReportPdfService._format_scope_summary(
                    rows=rows,
                    filters=filters,
                    scope=scope,
                )

                for index, row in enumerate(image_rows):
                    PatrolReportPdfService._raise_if_cancelled(is_cancelled)

                    # หน้ารายละเอียดของแต่ละรายการต้องเริ่มหน้าใหม่
                    # และแสดง ภาค / เขต / เส้นทาง ให้ครบทุกหน้า
                    story.append(PageBreak())

                    story.extend(
                        PatrolReportPdfService._build_image_detail_story(
                            row=row,
                            scope_text=scope_text,
                            styles=styles,
                        )
                    )

        return story

    @staticmethod
    def _build_image_detail_story(
        *,
        row: PatrolReportPdfRow,
        scope_text: str,
        styles: Mapping[str, ParagraphStyle],
    ) -> list[Any]:
        """
        สร้างหน้ารายละเอียดรูปภาพรายบุคคล

        ยึดโครงตารางเดิมด้านซ้าย:
        - ช่องหัวข้อ ผลัด / สถานะ / เวลาเข้า / เวลาออก ชิดขวา
        - ช่องค่าข้อมูล กลางวัน / ตรวจแล้ว / วันเวลา ชิดกึ่งกลาง
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
                    html.escape(row.display_status),
                    styles["detail_cell_center"],
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

        # ยึดตำแหน่งตารางเดิมด้านซ้ายของหน้า PDF
        detail_table = Table(
            detail_data,
            colWidths=[22 * mm, 72 * mm, 22 * mm, 72 * mm],
            hAlign="LEFT",
        )
        detail_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), colors.white),
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
            colWidths=[91 * mm, 91 * mm],
            hAlign="LEFT",
        )
        image_table.setStyle(
            TableStyle(
                [
                    # ตารางรูปภาพใช้พื้นขาวทั้งหมด
                    ("BACKGROUND", (0, 0), (-1, -1), colors.white),
                    ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#BFC5CC")),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                    ("TOPPADDING", (0, 0), (-1, -1), 5),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ]
            )
        )

        return [
            Paragraph(
                (
                    "ข้อมูลรายละเอียดผู้เข้าตรวจหน่วยงาน รายบุคคล "
                    '<font color="#DC2626">'
                    "(รูปเวลาเข้า และเวลาออกต้องเป็นบุคคลคนเดียวกัน)"
                    "</font>"
                ),
                styles["appendix_title"],
            ),
            Spacer(1, 1.5 * mm),
            Paragraph(html.escape(scope_text), styles["appendix_scope"]),
            Spacer(1, 4 * mm),
            Paragraph(html.escape(title), styles["section_title"]),
            Spacer(1, 2 * mm),
            detail_table,
            Spacer(1, 3 * mm),
            Paragraph("รูปภาพ", styles["image_section_left"]),
            Spacer(1, 1.5 * mm),
            image_table,
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
            with PilImage.open(io.BytesIO(image_bytes)) as image:
                image.verify()

            pdf_image = PdfImage(io.BytesIO(image_bytes))
            pdf_image._source_buffer = image_bytes  # type: ignore[attr-defined]
            pdf_image._restrictSize(
                PatrolReportPdfService.IMAGE_MAX_WIDTH_MM * mm,
                PatrolReportPdfService.IMAGE_MAX_HEIGHT_MM * mm,
            )
            return pdf_image
        except Exception:
            return Paragraph(
                "ไม่สามารถแสดงรูปภาพได้",
                styles["image_empty"],
            )

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
    def _format_selected_filters(
        filters: PatrolReportExportFilter,
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
        plan_mode = (
            PatrolReportPdfService._get_filter_value(
                filters,
                "plan_mode",
                "planMode",
            )
            or "planned"
        )
        shift_type = (
            PatrolReportPdfService._get_filter_value(
                filters,
                "shift_type",
                "shiftType",
            )
            or "all"
        )

        plan_text = "ตามแผน" if plan_mode == "planned" else "นอกแผน"
        shift_text = {
            "all": "ทั้งหมด",
            "day": "ผลัดกลางวัน",
            "night": "ผลัดกลางคืน",
        }.get(str(shift_type), str(shift_type))

        return (
            "ข้อมูลที่เลือกดู: "
            f"ช่วงวันที่ {html.escape(PatrolReportPdfService._format_thai_date(workday_start))}"
            f" - {html.escape(PatrolReportPdfService._format_thai_date(workday_end))}"
            f" | ประเภทแผน: {html.escape(plan_text)}"
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
            all_text: str = "ทั้งหมด",
        ) -> str:
            # ลำดับความสำคัญ: ตาราง master > view > ทั้งหมด/ไม่พบชื่อ
            master_text = str(master_name or "").strip()
            if master_text:
                return master_text

            row_text = str(row_value or "").strip()
            if row_text:
                return row_text

            filter_value = PatrolReportPdfService._get_filter_value(
                filters,
                *filter_names,
            )
            return all_text if filter_value is None else "ไม่พบชื่อ"

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

        return (
            f"ภาค: {html.escape(department_text)}"
            f" | เขต: {html.escape(division_text)}"
            f" | เส้นทาง: {html.escape(route_text)}"
        )

    @staticmethod
    def _format_filter_summary(
        filters: PatrolReportExportFilter,
    ) -> str:
        """
        เก็บ method เดิมไว้สำหรับ compatibility กับ code อื่น
        แต่หน้า PDF ใหม่ใช้ _format_selected_filters() แยกจากเวลาที่ดึงข้อมูลแล้ว.
        """
        return PatrolReportPdfService._format_selected_filters(filters)

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
                "ไม่พบไฟล์ฟอนต์ Prompt สำหรับสร้าง PDF"
            )

        pdfmetrics.registerFont(
            TTFont(
                PatrolReportPdfService.FONT_REGULAR_NAME,
                str(regular_path),
            )
        )
        pdfmetrics.registerFont(
            TTFont(
                PatrolReportPdfService.FONT_BOLD_NAME,
                str(bold_path),
            )
        )

        PatrolReportPdfService._fonts_registered = True

    @staticmethod
    def _make_styles() -> dict[str, ParagraphStyle]:
        base_styles = getSampleStyleSheet()

        return {
            "title": ParagraphStyle(
                "PatrolReportTitle",
                parent=base_styles["Title"],
                fontName=PatrolReportPdfService.FONT_BOLD_NAME,
                fontSize=16,
                leading=20,
                alignment=TA_CENTER,
                spaceAfter=1.5 * mm,
            ),
            "scope": ParagraphStyle(
                "PatrolReportScope",
                parent=base_styles["Normal"],
                fontName=PatrolReportPdfService.FONT_REGULAR_NAME,
                fontSize=9,
                leading=12,
                alignment=TA_CENTER,
                textColor=colors.black,
            ),
            "subtitle": ParagraphStyle(
                "PatrolReportSubtitle",
                parent=base_styles["Normal"],
                fontName=PatrolReportPdfService.FONT_REGULAR_NAME,
                fontSize=8,
                leading=11,
                alignment=TA_CENTER,
                textColor=colors.HexColor("#334155"),
            ),
            "filter_left": ParagraphStyle(
                "PatrolReportFilterLeft",
                parent=base_styles["Normal"],
                fontName=PatrolReportPdfService.FONT_REGULAR_NAME,
                fontSize=8,
                leading=11,
                alignment=TA_LEFT,
                textColor=colors.black,
            ),
            "generated_at_right": ParagraphStyle(
                "PatrolReportGeneratedAtRight",
                parent=base_styles["Normal"],
                fontName=PatrolReportPdfService.FONT_REGULAR_NAME,
                fontSize=8,
                leading=11,
                alignment=TA_RIGHT,
                textColor=colors.black,
            ),
            "appendix_title": ParagraphStyle(
                "PatrolReportAppendixTitle",
                parent=base_styles["Heading2"],
                fontName=PatrolReportPdfService.FONT_BOLD_NAME,
                fontSize=13,
                leading=17,
                alignment=TA_LEFT,
                textColor=colors.HexColor("#1E3A8A"),
            ),
            "appendix_scope": ParagraphStyle(
                "PatrolReportAppendixScope",
                parent=base_styles["Normal"],
                fontName=PatrolReportPdfService.FONT_REGULAR_NAME,
                fontSize=9,
                leading=12,
                alignment=TA_LEFT,
                textColor=colors.black,
            ),
            "detail_label_right": ParagraphStyle(
                "PatrolReportDetailLabelRight",
                parent=base_styles["Normal"],
                fontName=PatrolReportPdfService.FONT_BOLD_NAME,
                fontSize=7,
                leading=9,
                alignment=TA_RIGHT,
                textColor=colors.black,
            ),
            "detail_value_right": ParagraphStyle(
                "PatrolReportDetailValueRight",
                parent=base_styles["Normal"],
                fontName=PatrolReportPdfService.FONT_REGULAR_NAME,
                fontSize=7,
                leading=9,
                alignment=TA_RIGHT,
                textColor=colors.black,
            ),
            "image_section_right": ParagraphStyle(
                "PatrolReportImageSectionRight",
                parent=base_styles["Normal"],
                fontName=PatrolReportPdfService.FONT_BOLD_NAME,
                fontSize=9,
                leading=11,
                alignment=TA_RIGHT,
                textColor=colors.black,
            ),
            "image_section_left": ParagraphStyle(
                "PatrolReportImageSectionLeft",
                parent=base_styles["Normal"],
                fontName=PatrolReportPdfService.FONT_BOLD_NAME,
                fontSize=9,
                leading=11,
                alignment=TA_LEFT,
                textColor=colors.black,
            ),
            "section_title": ParagraphStyle(
                "PatrolReportSectionTitle",
                parent=base_styles["Heading2"],
                fontName=PatrolReportPdfService.FONT_BOLD_NAME,
                fontSize=12,
                leading=16,
                alignment=TA_LEFT,
                textColor=colors.HexColor("#1E3A8A"),
            ),
            "header_cell": ParagraphStyle(
                "PatrolReportHeaderCell",
                parent=base_styles["Normal"],
                fontName=PatrolReportPdfService.FONT_BOLD_NAME,
                fontSize=6.8,
                leading=8.5,
                alignment=TA_CENTER,
                textColor=colors.black,
            ),
            "cell": ParagraphStyle(
                "PatrolReportCell",
                parent=base_styles["Normal"],
                fontName=PatrolReportPdfService.FONT_REGULAR_NAME,
                fontSize=6.6,
                leading=8.2,
                alignment=TA_LEFT,
            ),
            "cell_center": ParagraphStyle(
                "PatrolReportCellCenter",
                parent=base_styles["Normal"],
                fontName=PatrolReportPdfService.FONT_REGULAR_NAME,
                fontSize=6.6,
                leading=8.2,
                alignment=TA_CENTER,
            ),
            "operator_cell": ParagraphStyle(
                "PatrolReportOperatorCell",
                parent=base_styles["Normal"],
                fontName=PatrolReportPdfService.FONT_REGULAR_NAME,
                fontSize=6.2,
                leading=7.8,
                alignment=TA_LEFT,
            ),
            "detail_cell_center": ParagraphStyle(
                "PatrolReportDetailCellCenter",
                parent=base_styles["Normal"],
                fontName=PatrolReportPdfService.FONT_REGULAR_NAME,
                fontSize=7,
                leading=9,
                alignment=TA_CENTER,
            ),
            "image_label": ParagraphStyle(
                "PatrolReportImageLabel",
                parent=base_styles["Normal"],
                fontName=PatrolReportPdfService.FONT_BOLD_NAME,
                fontSize=8,
                leading=10,
                alignment=TA_CENTER,
            ),
            "image_empty": ParagraphStyle(
                "PatrolReportImageEmpty",
                parent=base_styles["Normal"],
                fontName=PatrolReportPdfService.FONT_REGULAR_NAME,
                fontSize=8,
                leading=10,
                alignment=TA_CENTER,
                textColor=colors.HexColor("#64748B"),
            ),
        }

    @staticmethod
    def _draw_page_footer(canvas: Any, document: Any) -> None:
        canvas.saveState()

        canvas.setFont(PatrolReportPdfService.FONT_REGULAR_NAME, 7)
        canvas.setFillColor(colors.HexColor("#64748B"))

        footer_text = (
            f"GUTS-ESS | รายงานการเข้าตรวจหน่วยงาน | หน้า {document.page}"
        )

        canvas.drawString(
            document.leftMargin,
            8 * mm,
            footer_text,
        )

        canvas.restoreState()
