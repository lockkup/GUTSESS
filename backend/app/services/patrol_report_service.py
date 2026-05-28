from __future__ import annotations

from datetime import date, datetime, time, timedelta
from typing import Any, Mapping, cast

from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.error_messages import PATROL_REPORT_FETCH_FAILED_DETAIL
from app.schemas.patrol_report import (
    PatrolNotificationLevel,
    PatrolReportResponse,
    PatrolStatus,
)


def _to_text(value: Any, fallback: str = "-") -> str:
    if value is None:
        return fallback

    text_value = str(value).strip()
    return text_value if text_value else fallback


def _to_optional_text(value: Any) -> str | None:
    if value is None:
        return None

    text_value = str(value).strip()
    return text_value if text_value else None


def _to_optional_int(value: Any) -> int | None:
    if value is None:
        return None

    text_value = str(value).strip()
    if not text_value:
        return None

    try:
        return int(text_value)
    except ValueError:
        return None


def _to_optional_positive_int(value: Any) -> int | None:
    int_value = _to_optional_int(value)

    if int_value is None or int_value < 1:
        return None

    return int_value


def _to_optional_date(value: Any) -> date | None:
    if value is None:
        return None

    if isinstance(value, datetime):
        return value.date()

    if isinstance(value, date):
        return value

    text_value = str(value).strip()
    if not text_value:
        return None

    try:
        return date.fromisoformat(text_value[:10])
    except ValueError:
        return None


def _format_time(value: Any) -> str | None:
    if value is None:
        return None

    if isinstance(value, datetime):
        return value.strftime("%H:%M")

    if isinstance(value, time):
        return value.strftime("%H:%M")

    if isinstance(value, timedelta):
        total_seconds = int(value.total_seconds())
        hours = total_seconds // 3600
        minutes = (total_seconds % 3600) // 60
        return f"{hours:02d}:{minutes:02d}"

    text_value = str(value).strip()

    if not text_value:
        return None

    if len(text_value) >= 5:
        return text_value[:5]

    return text_value


def _normalize_status(value: Any) -> PatrolStatus:
    text_value = str(value or "pending").strip()

    if text_value in {"completed", "in_progress", "pending"}:
        return cast(PatrolStatus, text_value)

    return "pending"


def _build_operator_name(employee_code: Any, position_name: Any) -> str | None:
    employee_code_text = str(employee_code).strip() if employee_code is not None else ""

    if not employee_code_text:
        return None

    position_name_text = (
        str(position_name).strip() if position_name is not None else ""
    )

    if position_name_text:
        return f"{employee_code_text} - {position_name_text}"

    return employee_code_text


def _calculate_days_without_inspection(
    *,
    report_workday: date | None,
    last_inspection_date: date | None,
    effective_from: date | None,
) -> int | None:
    if report_workday is None:
        return None

    base_date = last_inspection_date or effective_from

    if base_date is None:
        return None

    days_without_inspection = (report_workday - base_date).days

    if days_without_inspection < 0:
        return None

    return days_without_inspection


def _get_patrol_notification(
    *,
    by_contract: int | None,
    days_without_inspection: int | None,
    last_inspection_date: date | None,
    effective_from: date | None,
) -> tuple[PatrolNotificationLevel, str | None]:
    if by_contract is None or days_without_inspection is None:
        return "none", None

    if days_without_inspection <= 0:
        return "none", None

    yellow_threshold = max(1, by_contract // 2)
    orange_threshold = max(1, by_contract - 1)

    if last_inspection_date is not None:
        date_text = f"ตรวจล่าสุด {last_inspection_date.isoformat()}"
    elif effective_from is not None:
        date_text = f"ยังไม่พบการตรวจ ตั้งแต่เริ่มสัญญา {effective_from.isoformat()}"
    else:
        date_text = "ยังไม่พบการตรวจล่าสุด"

    notification_text = (
        f"{date_text} / ไม่ได้ตรวจ {days_without_inspection} วัน "
        f"/ รอบสัญญา {by_contract} วัน"
    )

    if days_without_inspection >= by_contract:
        return "red", notification_text

    if days_without_inspection >= orange_threshold:
        return "orange", notification_text

    if days_without_inspection >= yellow_threshold:
        return "yellow", notification_text

    return "none", None


def _map_patrol_report_row(
    row_no: int,
    row: Mapping[str, Any],
) -> PatrolReportResponse:
    effective_from = _to_optional_date(row.get("effective_from"))
    by_contract = _to_optional_positive_int(row.get("by_contract"))
    report_workday = _to_optional_date(row.get("workday"))
    last_inspection_date = _to_optional_date(row.get("last_inspection_date"))

    days_without_inspection = _calculate_days_without_inspection(
        report_workday=report_workday,
        last_inspection_date=last_inspection_date,
        effective_from=effective_from,
    )

    notification_level, notification_text = _get_patrol_notification(
        by_contract=by_contract,
        days_without_inspection=days_without_inspection,
        last_inspection_date=last_inspection_date,
        effective_from=effective_from,
    )

    return PatrolReportResponse(
        id=row_no,
        contractCode=_to_text(row.get("contract_code")),
        siteName=_to_text(row.get("location_name")),
        status=_normalize_status(row.get("assignment_status")),

        effectiveFrom=effective_from,
        byContract=by_contract,
        planDay=_to_optional_positive_int(row.get("plan_day")),

        lastInspectionDate=last_inspection_date,
        daysWithoutInspection=days_without_inspection,
        notificationLevel=notification_level,
        notificationText=notification_text,

        shiftLabel=_to_text(row.get("shift_name_th")),
        dateText=_to_text(row.get("work_date")),

        contactDetail=_to_optional_text(row.get("contact_detail")),
        callStatus=_to_optional_int(row.get("call_status")),
        callNote=_to_optional_text(row.get("call_note")),

        scheduleText="-",
        checkInTime=_format_time(row.get("started_at")),
        checkOutTime=_format_time(row.get("completed_at")),
        operatorName=_build_operator_name(
            row.get("employee_code"),
            row.get("position_name"),
        ),
    )


def get_patrol_report_rows(
    db: Session,
    *,
    workday: date,
    department_id: int,
    division_id: int,
    shift_id: int,
    status_filter: PatrolStatus | None = None,
    keyword: str | None = None,
) -> list[PatrolReportResponse]:
    sql_parts = [
        """
        SELECT
            v.contract_code,
            v.location_name,
            v.shift_name_th,
            v.assignment_status,
            v.plan_day,
            v.work_date,
            v.workday,
            v.effective_from,
            v.by_contract,
            v.contact_detail,
            v.call_status,
            v.call_note,
            v.started_at,
            v.completed_at,
            v.employee_code,
            v.position_name,
            (
                SELECT MAX(v2.workday)
                FROM vw_checkin_report v2
                WHERE v2.contract_code = v.contract_code
                  AND v2.department_id = v.department_id
                  AND v2.division_id = v.division_id
                  AND v2.shift_id = v.shift_id
                  AND v2.workday <= :workday
                  AND v2.assignment_status = 'completed'
                  AND v2.completed_at IS NOT NULL
            ) AS last_inspection_date
        FROM vw_checkin_report v
        WHERE v.workday = :workday
          AND v.department_id = :department_id
          AND v.division_id = :division_id
          AND v.shift_id = :shift_id
        """
    ]

    params: dict[str, Any] = {
        "workday": workday,
        "department_id": department_id,
        "division_id": division_id,
        "shift_id": shift_id,
    }

    if status_filter:
        sql_parts.append("AND v.assignment_status = :status_filter")
        params["status_filter"] = status_filter

    if keyword and keyword.strip():
        sql_parts.append(
            """
            AND (
                v.contract_code LIKE :keyword
                OR v.location_name LIKE :keyword
            )
            """
        )
        params["keyword"] = f"%{keyword.strip()}%"

    sql_parts.append(
        """
        ORDER BY
            CASE
                WHEN v.call_status IS NOT NULL THEN 4
                WHEN v.assignment_status = 'in_progress' THEN 1
                WHEN v.assignment_status = 'pending' THEN 2
                WHEN v.assignment_status = 'completed' THEN 3
                ELSE 5
            END,
            v.contract_code,
            v.location_name
        """
    )

    statement = text("\n".join(sql_parts))

    try:
        rows = db.execute(statement, params).mappings().all()

        return [
            _map_patrol_report_row(row_no, row)
            for row_no, row in enumerate(rows, start=1)
        ]

    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=PATROL_REPORT_FETCH_FAILED_DETAIL,
        ) from exc