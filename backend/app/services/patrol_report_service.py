from __future__ import annotations

from datetime import date, datetime, time, timedelta
from typing import Any, Literal, Mapping, cast

from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.constants import PatrolReportConstants
from app.core.error_messages import (
    PATROL_REPORT_DATE_REQUIRED_DETAIL,
    PATROL_REPORT_FETCH_FAILED_DETAIL,
    PATROL_REPORT_INVALID_DATE_RANGE_DETAIL,
)
from app.schemas.patrol_report import (
    PatrolDepartmentOption,
    PatrolDivisionOption,
    PatrolEmployeeOption,
    PatrolLocationOption,
    PatrolNotificationLevel,
    PatrolReportFilterOptionsResponse,
    PatrolReportResponse,
    PatrolRouteOption,
    PatrolStatus,
)


ReportPlanMode = Literal["planned", "outside_plan"]

UNPLANNED_VIEW_NAME = "vw_checkin_unplanned"

UNPLANNED_COLUMN_FIRST_NAME = "first_name"
UNPLANNED_COLUMN_LAST_NAME = "last_name"
UNPLANNED_COLUMN_DEPARTMENT_NAME = "department_name"
UNPLANNED_COLUMN_DIVISION_NAME = "division_name"


EN_MONTH_NAMES: dict[str, int] = {
    "january": 1,
    "jan": 1,
    "february": 2,
    "feb": 2,
    "march": 3,
    "mar": 3,
    "april": 4,
    "apr": 4,
    "may": 5,
    "june": 6,
    "jun": 6,
    "july": 7,
    "jul": 7,
    "august": 8,
    "aug": 8,
    "september": 9,
    "sep": 9,
    "october": 10,
    "oct": 10,
    "november": 11,
    "nov": 11,
    "december": 12,
    "dec": 12,
}

TH_MONTH_NAMES: dict[str, int] = {
    "มกราคม": 1,
    "ม.ค.": 1,
    "กุมภาพันธ์": 2,
    "ก.พ.": 2,
    "มีนาคม": 3,
    "มี.ค.": 3,
    "เมษายน": 4,
    "เม.ย.": 4,
    "พฤษภาคม": 5,
    "พ.ค.": 5,
    "มิถุนายน": 6,
    "มิ.ย.": 6,
    "กรกฎาคม": 7,
    "ก.ค.": 7,
    "สิงหาคม": 8,
    "ส.ค.": 8,
    "กันยายน": 9,
    "ก.ย.": 9,
    "ตุลาคม": 10,
    "ต.ค.": 10,
    "พฤศจิกายน": 11,
    "พ.ย.": 11,
    "ธันวาคม": 12,
    "ธ.ค.": 12,
}


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


def _parse_display_date_text(value: str) -> date | None:
    """
    รองรับ work_date ที่เป็นข้อความ เช่น:
    - วันThursdayที่ 4 June 2026
    - Thursday 4 June 2026
    - 4 June 2026
    - วันพฤหัสบดีที่ 4 มิถุนายน 2569
    - 4 มิ.ย. 2569
    """
    text_value = value.strip()

    if not text_value:
        return None

    cleaned = (
        text_value.replace("วัน", " ")
        .replace("ที่", " ")
        .replace(",", " ")
        .replace("-", " ")
        .replace("/", " ")
    )

    parts = [part.strip() for part in cleaned.split() if part.strip()]

    if len(parts) < 3:
        return None

    month_names: dict[str, int] = {}
    month_names.update(EN_MONTH_NAMES)
    month_names.update(TH_MONTH_NAMES)

    day_value: int | None = None
    month_value: int | None = None
    year_value: int | None = None

    for part in parts:
        lower_part = part.lower()

        if lower_part in month_names:
            month_value = month_names[lower_part]
            continue

        numeric_text = "".join(char for char in part if char.isdigit())

        if not numeric_text:
            continue

        numeric_value = int(numeric_text)

        if numeric_value > 2400:
            year_value = numeric_value - 543
            continue

        if numeric_value >= 1900:
            year_value = numeric_value
            continue

        if 1 <= numeric_value <= 31 and day_value is None:
            day_value = numeric_value

    if day_value is None or month_value is None or year_value is None:
        return None

    try:
        return date(year_value, month_value, day_value)
    except ValueError:
        return None


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
        return _parse_display_date_text(text_value)


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
    text_value = str(
        value or PatrolReportConstants.STATUS_PENDING,
    ).strip()

    if text_value in {
        PatrolReportConstants.STATUS_COMPLETED,
        PatrolReportConstants.STATUS_IN_PROGRESS,
        PatrolReportConstants.STATUS_PENDING,
    }:
        return cast(PatrolStatus, text_value)

    return cast(PatrolStatus, PatrolReportConstants.STATUS_PENDING)


def _build_operator_name(employee_code: Any, position_name: Any) -> str | None:
    employee_code_text = str(employee_code).strip() if employee_code is not None else ""

    if not employee_code_text:
        return None

    position_name_text = str(position_name).strip() if position_name is not None else ""

    if position_name_text:
        return f"{employee_code_text} - {position_name_text}"

    return employee_code_text


def _build_schedule_text(by_contract: int | None) -> str:
    if by_contract is None:
        return "-"

    return f"{by_contract} วัน"


def _calculate_contract_day_number(
    *,
    effective_from: date | None,
    report_workday: date | None,
) -> int | None:
    if effective_from is None or report_workday is None:
        return None

    if report_workday < effective_from:
        return None

    return (report_workday - effective_from).days + 1


def _calculate_cycle_length(by_contract: int) -> int:
    return min(
        by_contract,
        PatrolReportConstants.MAX_CYCLE_LENGTH_DAYS,
    )


def _calculate_cycle_range(
    *,
    effective_from: date | None,
    report_workday: date | None,
    by_contract: int | None,
) -> tuple[date, date] | None:
    if effective_from is None:
        return None

    if by_contract is None or by_contract <= 0:
        return None

    contract_day_number = _calculate_contract_day_number(
        effective_from=effective_from,
        report_workday=report_workday,
    )

    if contract_day_number is None:
        return None

    cycle_length = _calculate_cycle_length(by_contract)
    cycle_index = (contract_day_number - 1) // cycle_length

    cycle_start = effective_from + timedelta(days=cycle_index * cycle_length)
    cycle_end = cycle_start + timedelta(days=cycle_length - 1)

    return cycle_start, cycle_end


def _calculate_report_day_number(
    *,
    effective_from: date | None,
    report_workday: date | None,
    has_today_time_record: bool,
    has_cycle_time_record: bool,
) -> int | None:
    if report_workday is None:
        return None

    if has_today_time_record:
        return 0

    if has_cycle_time_record:
        return None

    return _calculate_contract_day_number(
        effective_from=effective_from,
        report_workday=report_workday,
    )


def _get_patrol_notification(
    *,
    has_today_time_record: bool,
    has_cycle_time_record: bool,
    by_contract: int | None,
    report_day_number: int | None,
) -> tuple[PatrolNotificationLevel | None, str | None]:
    if has_today_time_record:
        return "green", "เข้าตรวจแล้ว"

    if has_cycle_time_record:
        return None, None

    if by_contract is None or report_day_number is None:
        return None, None

    if by_contract <= 0 or report_day_number <= 0:
        return None, None

    cycle_length = _calculate_cycle_length(by_contract)

    day_in_cycle = ((report_day_number - 1) % cycle_length) + 1
    yellow_until = cycle_length // 2
    remaining_days = cycle_length - day_in_cycle + 1

    if day_in_cycle <= yellow_until:
        return "yellow", f"เหลืออีก {remaining_days} วัน"

    if day_in_cycle < cycle_length:
        return "orange", f"เหลืออีก {remaining_days} วัน"

    return "red", f"ต้องเข้าภายในวันนี้ ครบ {cycle_length} วันแล้ว"


def _get_view_column_names(db: Session, view_name: str) -> set[str]:
    """
    ใช้เช็กคอลัมน์ใน view ก่อน SELECT
    เพื่อกัน error กรณี view ยังไม่มีคอลัมน์ใหม่
    เช่น plan_day, contact_detail, call_status, call_note
    """
    try:
        rows = db.execute(text(f"SHOW COLUMNS FROM {view_name}")).mappings().all()

        column_names: set[str] = set()
        for row in rows:
            field_name = row.get("Field")
            if field_name is not None:
                column_names.add(str(field_name))

        return column_names
    except SQLAlchemyError:
        return set()


def _select_view_column(
    column_names: set[str],
    column_name: str,
    *,
    alias: str | None = None,
) -> str:
    alias_name = alias or column_name

    if column_name in column_names:
        return f"v.{column_name}"

    return f"NULL AS {alias_name}"


def _get_time_record_flags(
    db: Session,
    rows: list[Mapping[str, Any]],
) -> list[tuple[bool, bool]]:
    flags: list[tuple[bool, bool]] = [(False, False) for _ in rows]

    cycle_infos: list[tuple[int, int, date, date]] = []
    location_ids: set[int] = set()

    min_cycle_start: date | None = None
    max_lookup_workday: date | None = None

    for index, row in enumerate(rows):
        effective_from = _to_optional_date(
            row.get(PatrolReportConstants.COLUMN_EFFECTIVE_FROM),
        )
        report_workday = _to_optional_date(
            row.get(PatrolReportConstants.COLUMN_WORKDAY),
        )
        by_contract = _to_optional_positive_int(
            row.get(PatrolReportConstants.COLUMN_BY_CONTRACT),
        )
        location_id = _to_optional_positive_int(
            row.get(PatrolReportConstants.COLUMN_LOCATION_ID),
        )

        if report_workday is None or location_id is None:
            continue

        cycle_range = _calculate_cycle_range(
            effective_from=effective_from,
            report_workday=report_workday,
            by_contract=by_contract,
        )

        if cycle_range is None:
            continue

        cycle_start, _cycle_end = cycle_range

        cycle_infos.append(
            (
                index,
                location_id,
                report_workday,
                cycle_start,
            )
        )

        location_ids.add(location_id)

        if min_cycle_start is None or cycle_start < min_cycle_start:
            min_cycle_start = cycle_start

        if max_lookup_workday is None or report_workday > max_lookup_workday:
            max_lookup_workday = report_workday

    if not cycle_infos:
        return flags

    if min_cycle_start is None or max_lookup_workday is None:
        return flags

    if not location_ids:
        return flags

    params: dict[str, Any] = {
        "min_cycle_start": min_cycle_start,
        "max_lookup_workday": max_lookup_workday,
    }

    location_placeholders: list[str] = []
    for index, location_id in enumerate(sorted(location_ids)):
        key = f"location_id_{index}"
        location_placeholders.append(f":{key}")
        params[key] = location_id

    location_in_sql = ", ".join(location_placeholders)

    inspection_sql = text(
        f"""
        SELECT DISTINCT
            tr.work_date,
            tr.checkin_location_id,
            tr.checkout_location_id
        FROM time_record tr
        WHERE tr.work_date BETWEEN :min_cycle_start AND :max_lookup_workday
          AND (
              tr.checkin IS NOT NULL
              OR tr.checkout IS NOT NULL
          )
          AND (
              tr.checkin_location_id IN ({location_in_sql})
              OR tr.checkout_location_id IN ({location_in_sql})
          )
        """
    )

    inspection_rows = db.execute(inspection_sql, params).mappings().all()

    inspection_dates_by_location: dict[int, set[date]] = {}

    for inspection_row in inspection_rows:
        inspection_work_date = _to_optional_date(inspection_row.get("work_date"))
        if inspection_work_date is None:
            continue

        checkin_location_id = _to_optional_positive_int(
            inspection_row.get("checkin_location_id"),
        )
        checkout_location_id = _to_optional_positive_int(
            inspection_row.get("checkout_location_id"),
        )

        if checkin_location_id is not None:
            inspection_dates_by_location.setdefault(
                checkin_location_id,
                set(),
            ).add(inspection_work_date)

        if checkout_location_id is not None:
            inspection_dates_by_location.setdefault(
                checkout_location_id,
                set(),
            ).add(inspection_work_date)

    for index, location_id, report_workday, cycle_start in cycle_infos:
        inspection_dates = inspection_dates_by_location.get(location_id, set())

        has_today_time_record = report_workday in inspection_dates

        has_cycle_time_record = any(
            cycle_start <= inspection_date <= report_workday
            for inspection_date in inspection_dates
        )

        flags[index] = (
            has_today_time_record,
            has_cycle_time_record,
        )

    return flags


def _map_patrol_report_row(
    row_no: int,
    row: Mapping[str, Any],
    *,
    has_today_time_record: bool,
    has_cycle_time_record: bool,
) -> PatrolReportResponse:
    effective_from = _to_optional_date(
        row.get(PatrolReportConstants.COLUMN_EFFECTIVE_FROM),
    )
    by_contract = _to_optional_positive_int(
        row.get(PatrolReportConstants.COLUMN_BY_CONTRACT),
    )
    report_workday = _to_optional_date(
        row.get(PatrolReportConstants.COLUMN_WORKDAY),
    )
    last_inspection_date = _to_optional_date(row.get("last_inspection_date"))
    patrol_status = _normalize_status(
        row.get(PatrolReportConstants.COLUMN_ASSIGNMENT_STATUS),
    )

    report_day_number = _calculate_report_day_number(
        effective_from=effective_from,
        report_workday=report_workday,
        has_today_time_record=has_today_time_record,
        has_cycle_time_record=has_cycle_time_record,
    )

    notification_level, notification_text = _get_patrol_notification(
        has_today_time_record=has_today_time_record,
        has_cycle_time_record=has_cycle_time_record,
        by_contract=by_contract,
        report_day_number=report_day_number,
    )

    return PatrolReportResponse(
        id=row_no,
        contractCode=_to_text(
            row.get(PatrolReportConstants.COLUMN_CONTRACT_CODE),
        ),
        siteName=_to_text(
            row.get(PatrolReportConstants.COLUMN_LOCATION_NAME),
        ),
        status=patrol_status,

        departmentId=_to_optional_positive_int(
            row.get(PatrolReportConstants.COLUMN_DEPARTMENT_ID),
        ),
        divisionId=_to_optional_positive_int(
            row.get(PatrolReportConstants.COLUMN_DIVISION_ID),
        ),
        routeId=_to_optional_positive_int(
            row.get(PatrolReportConstants.COLUMN_ROUTE_ID),
        ),
        locationId=_to_optional_positive_int(
            row.get(PatrolReportConstants.COLUMN_LOCATION_ID),
        ),

        effectiveFrom=effective_from,
        byContract=by_contract,

        planDay=_to_optional_positive_int(
            row.get(PatrolReportConstants.COLUMN_PLAN_DAY),
        ),

        lastInspectionDate=last_inspection_date,

        daysWithoutInspection=report_day_number,

        notificationLevel=notification_level
        or cast(
            PatrolNotificationLevel,
            PatrolReportConstants.DEFAULT_NOTIFICATION_LEVEL,
        ),
        notificationText=notification_text,

        shiftLabel=_to_text(
            row.get(PatrolReportConstants.COLUMN_SHIFT_NAME_TH),
        ),
        dateText=_to_text(
            row.get(PatrolReportConstants.COLUMN_WORK_DATE),
        ),

        checkInTime=_format_time(
            row.get(PatrolReportConstants.COLUMN_STARTED_AT),
        ),
        checkOutTime=_format_time(
            row.get(PatrolReportConstants.COLUMN_COMPLETED_AT),
        ),

        employeeCode=_to_optional_text(
            row.get(PatrolReportConstants.COLUMN_EMPLOYEE_CODE),
        ),
        positionName=_to_optional_text(
            row.get(PatrolReportConstants.COLUMN_POSITION_NAME),
        ),
        operatorName=_build_operator_name(
            row.get(PatrolReportConstants.COLUMN_EMPLOYEE_CODE),
            row.get(PatrolReportConstants.COLUMN_POSITION_NAME),
        ),

        contactDetail=_to_optional_text(
            row.get(PatrolReportConstants.COLUMN_CONTACT_DETAIL),
        ),
        callStatus=_to_optional_positive_int(
            row.get(PatrolReportConstants.COLUMN_CALL_STATUS),
        ),
        callNote=_to_optional_text(
            row.get(PatrolReportConstants.COLUMN_CALL_NOTE),
        ),

        scheduleText=_build_schedule_text(by_contract),
    )


def get_patrol_report_filter_options(
    db: Session,
) -> PatrolReportFilterOptionsResponse:
    departments_sql = text(
        """
        SELECT
            dp.department_id,
            COALESCE(
                NULLIF(TRIM(dp.department_name), ''),
                CONCAT('ภาค ', dp.department_id)
            ) AS department_name
        FROM departments dp
        ORDER BY dp.department_id
        """
    )

    divisions_sql = text(
        """
        SELECT
            dv.division_id,
            COALESCE(
                NULLIF(TRIM(dv.division_name), ''),
                CONCAT('เขต ', dv.division_id)
            ) AS division_name,
            dv.department_id
        FROM divisions dv
        ORDER BY dv.department_id, dv.division_id
        """
    )

    routes_sql = text(
        """
        SELECT DISTINCT
            rsl.routes_id AS route_id,
            CONCAT('เส้นทาง ', rsl.routes_id) AS route_name,
            dv.department_id,
            rsl.division_id
        FROM route_site_location rsl
        LEFT JOIN divisions dv
            ON rsl.division_id = dv.division_id
        WHERE rsl.routes_id IS NOT NULL
        ORDER BY dv.department_id, rsl.division_id, rsl.routes_id
        """
    )

    locations_sql = text(
        """
        SELECT DISTINCT
            sl.location_id,
            sl.contract_code,
            sl.location_name,
            rsl.routes_id AS route_id,
            dv.department_id,
            rsl.division_id
        FROM route_site_location rsl
        LEFT JOIN site_location sl
            ON rsl.location_id = sl.location_id
        LEFT JOIN divisions dv
            ON rsl.division_id = dv.division_id
        WHERE sl.location_id IS NOT NULL
        ORDER BY
            dv.department_id,
            rsl.division_id,
            rsl.routes_id,
            sl.contract_code,
            sl.location_name
        """
    )

    employees_sql = text(
        """
        SELECT DISTINCT
            em.employee_code,
            NULL AS employee_name,
            po.position_name
        FROM employees em
        LEFT JOIN positions po
            ON em.position_id = po.position_id
        WHERE em.employee_code IS NOT NULL
        ORDER BY em.employee_code
        """
    )

    try:
        department_rows = db.execute(departments_sql).mappings().all()
        division_rows = db.execute(divisions_sql).mappings().all()
        route_rows = db.execute(routes_sql).mappings().all()
        location_rows = db.execute(locations_sql).mappings().all()
        employee_rows = db.execute(employees_sql).mappings().all()

        departments: list[PatrolDepartmentOption] = []
        for row in department_rows:
            department_id = _to_optional_positive_int(row.get("department_id"))
            if department_id is None:
                continue

            departments.append(
                PatrolDepartmentOption(
                    departmentId=department_id,
                    departmentName=_to_text(
                        row.get("department_name"),
                        f"ภาค {department_id}",
                    ),
                )
            )

        divisions: list[PatrolDivisionOption] = []
        for row in division_rows:
            division_id = _to_optional_positive_int(row.get("division_id"))
            if division_id is None:
                continue

            divisions.append(
                PatrolDivisionOption(
                    divisionId=division_id,
                    divisionName=_to_text(
                        row.get("division_name"),
                        f"เขต {division_id}",
                    ),
                    departmentId=_to_optional_positive_int(
                        row.get("department_id"),
                    ),
                )
            )

        routes: list[PatrolRouteOption] = []
        for row in route_rows:
            route_id = _to_optional_positive_int(row.get("route_id"))
            if route_id is None:
                continue

            routes.append(
                PatrolRouteOption(
                    routeId=route_id,
                    routeName=_to_text(
                        row.get("route_name"),
                        f"เส้นทาง {route_id}",
                    ),
                    departmentId=_to_optional_positive_int(
                        row.get("department_id"),
                    ),
                    divisionId=_to_optional_positive_int(row.get("division_id")),
                )
            )

        locations: list[PatrolLocationOption] = []
        for row in location_rows:
            location_id = _to_optional_positive_int(row.get("location_id"))
            if location_id is None:
                continue

            locations.append(
                PatrolLocationOption(
                    locationId=location_id,
                    contractCode=_to_text(row.get("contract_code")),
                    locationName=_to_text(row.get("location_name")),
                    routeId=_to_optional_positive_int(row.get("route_id")),
                    departmentId=_to_optional_positive_int(
                        row.get("department_id"),
                    ),
                    divisionId=_to_optional_positive_int(row.get("division_id")),
                )
            )

        employees: list[PatrolEmployeeOption] = []
        for row in employee_rows:
            employee_code = _to_optional_text(row.get("employee_code"))
            if employee_code is None:
                continue

            employees.append(
                PatrolEmployeeOption(
                    employeeCode=employee_code,
                    employeeName=_to_optional_text(row.get("employee_name")),
                    positionName=_to_optional_text(row.get("position_name")),
                )
            )

        return PatrolReportFilterOptionsResponse(
            departments=departments,
            divisions=divisions,
            locations=locations,
            routes=routes,
            employees=employees,
        )

    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=PATROL_REPORT_FETCH_FAILED_DETAIL,
        ) from exc


def _get_patrol_report_unplanned_rows(
    db: Session,
    *,
    report_start: date,
    report_end: date,
    shift_id: int | None = None,
    department_id: int | None = None,
    division_id: int | None = None,
    route_id: int | None = None,
    location_id: int | None = None,
    employee_code: str | None = None,
    status_filter: PatrolStatus | None = None,
    keyword: str | None = None,
) -> list[PatrolReportResponse]:
    view_column_names = _get_view_column_names(
        db,
        UNPLANNED_VIEW_NAME,
    )

    has_department_name = UNPLANNED_COLUMN_DEPARTMENT_NAME in view_column_names
    has_division_name = UNPLANNED_COLUMN_DIVISION_NAME in view_column_names
    has_shift_id = PatrolReportConstants.COLUMN_SHIFT_ID in view_column_names

    join_parts: list[str] = []

    if has_department_name:
        join_parts.append(
            f"""
            LEFT JOIN departments dp
                ON TRIM(dp.department_name)
                    = TRIM(v.{UNPLANNED_COLUMN_DEPARTMENT_NAME})
            """
        )
        department_id_select = "dp.department_id"
    else:
        department_id_select = "NULL"

    if has_division_name:
        if has_department_name:
            join_parts.append(
                f"""
                LEFT JOIN divisions dv
                    ON TRIM(dv.division_name)
                        = TRIM(v.{UNPLANNED_COLUMN_DIVISION_NAME})
                    AND (
                        dp.department_id IS NULL
                        OR dv.department_id = dp.department_id
                    )
                """
            )
        else:
            join_parts.append(
                f"""
                LEFT JOIN divisions dv
                    ON TRIM(dv.division_name)
                        = TRIM(v.{UNPLANNED_COLUMN_DIVISION_NAME})
                """
            )

        division_id_select = "dv.division_id"
    else:
        division_id_select = "NULL"

    join_parts.append(
        f"""
        LEFT JOIN site_location sl
            ON TRIM(sl.contract_code)
                = TRIM(v.{PatrolReportConstants.COLUMN_CONTRACT_CODE})
            AND TRIM(sl.location_name)
                = TRIM(v.{PatrolReportConstants.COLUMN_LOCATION_NAME})
        """
    )

    route_id_select = """
        (
            SELECT MIN(rsl.routes_id)
            FROM route_site_location rsl
            WHERE rsl.location_id = sl.location_id
        )
    """

    shift_id_select = (
        f"v.{PatrolReportConstants.COLUMN_SHIFT_ID}"
        if has_shift_id
        else "NULL"
    )

    sql_parts = [
        f"""
        SELECT
            v.{PatrolReportConstants.COLUMN_CONTRACT_CODE},
            v.{PatrolReportConstants.COLUMN_LOCATION_NAME},

            'นอกแผน' AS {PatrolReportConstants.COLUMN_SHIFT_NAME_TH},

            CASE
                WHEN v.{PatrolReportConstants.COLUMN_COMPLETED_AT} IS NOT NULL
                    THEN '{PatrolReportConstants.STATUS_COMPLETED}'
                ELSE '{PatrolReportConstants.STATUS_IN_PROGRESS}'
            END AS {PatrolReportConstants.COLUMN_ASSIGNMENT_STATUS},

            v.{PatrolReportConstants.COLUMN_WORK_DATE},
            v.{PatrolReportConstants.COLUMN_STARTED_AT},
            v.{PatrolReportConstants.COLUMN_COMPLETED_AT},
            v.{PatrolReportConstants.COLUMN_EMPLOYEE_CODE},
            v.{PatrolReportConstants.COLUMN_POSITION_NAME},

            NULL AS {PatrolReportConstants.COLUMN_EFFECTIVE_FROM},
            NULL AS {PatrolReportConstants.COLUMN_BY_CONTRACT},
            NULL AS {PatrolReportConstants.COLUMN_PLAN_DAY},

            v.{PatrolReportConstants.COLUMN_WORK_DATE}
                AS {PatrolReportConstants.COLUMN_WORKDAY},

            {department_id_select}
                AS {PatrolReportConstants.COLUMN_DEPARTMENT_ID},
            {division_id_select}
                AS {PatrolReportConstants.COLUMN_DIVISION_ID},
            {route_id_select}
                AS {PatrolReportConstants.COLUMN_ROUTE_ID},
            sl.location_id
                AS {PatrolReportConstants.COLUMN_LOCATION_ID},

            {shift_id_select}
                AS {PatrolReportConstants.COLUMN_SHIFT_ID},

            NULL AS {PatrolReportConstants.COLUMN_CONTACT_DETAIL},
            NULL AS {PatrolReportConstants.COLUMN_CALL_STATUS},
            NULL AS {PatrolReportConstants.COLUMN_CALL_NOTE},

            NULL AS last_inspection_date
        FROM {UNPLANNED_VIEW_NAME} v
        {' '.join(join_parts)}
        WHERE 1 = 1
        """
    ]

    params: dict[str, Any] = {}

    if shift_id is not None and has_shift_id:
        sql_parts.append(f"AND v.{PatrolReportConstants.COLUMN_SHIFT_ID} = :shift_id")
        params["shift_id"] = shift_id

    if department_id is not None:
        if has_department_name:
            sql_parts.append("AND dp.department_id = :department_id")
            params["department_id"] = department_id
        else:
            sql_parts.append("AND 1 = 0")

    if division_id is not None:
        if has_division_name:
            sql_parts.append("AND dv.division_id = :division_id")
            params["division_id"] = division_id
        else:
            sql_parts.append("AND 1 = 0")

    if route_id is not None:
        sql_parts.append(
            """
            AND EXISTS (
                SELECT 1
                FROM route_site_location rsl_filter
                WHERE rsl_filter.location_id = sl.location_id
                  AND rsl_filter.routes_id = :route_id
            )
            """
        )
        params["route_id"] = route_id

    if location_id is not None:
        sql_parts.append("AND sl.location_id = :location_id")
        params["location_id"] = location_id

    if employee_code and employee_code.strip():
        sql_parts.append(
            f"AND v.{PatrolReportConstants.COLUMN_EMPLOYEE_CODE} = :employee_code",
        )
        params["employee_code"] = employee_code.strip()

    if status_filter == PatrolReportConstants.STATUS_COMPLETED:
        sql_parts.append(
            f"AND v.{PatrolReportConstants.COLUMN_COMPLETED_AT} IS NOT NULL",
        )

    if status_filter == PatrolReportConstants.STATUS_IN_PROGRESS:
        sql_parts.append(
            f"AND v.{PatrolReportConstants.COLUMN_COMPLETED_AT} IS NULL",
        )

    if status_filter == PatrolReportConstants.STATUS_PENDING:
        sql_parts.append("AND 1 = 0")

    if keyword and keyword.strip():
        keyword_conditions = [
            f"v.{PatrolReportConstants.COLUMN_CONTRACT_CODE} LIKE :keyword",
            f"v.{PatrolReportConstants.COLUMN_LOCATION_NAME} LIKE :keyword",
            f"v.{PatrolReportConstants.COLUMN_EMPLOYEE_CODE} LIKE :keyword",
        ]

        if UNPLANNED_COLUMN_FIRST_NAME in view_column_names:
            keyword_conditions.append(f"v.{UNPLANNED_COLUMN_FIRST_NAME} LIKE :keyword")

        if UNPLANNED_COLUMN_LAST_NAME in view_column_names:
            keyword_conditions.append(f"v.{UNPLANNED_COLUMN_LAST_NAME} LIKE :keyword")

        if PatrolReportConstants.COLUMN_POSITION_NAME in view_column_names:
            keyword_conditions.append(
                f"v.{PatrolReportConstants.COLUMN_POSITION_NAME} LIKE :keyword",
            )

        sql_parts.append(
            f"""
            AND (
                {' OR '.join(keyword_conditions)}
            )
            """
        )
        params["keyword"] = f"%{keyword.strip()}%"

    sql_parts.append(
        f"""
        ORDER BY
            v.{PatrolReportConstants.COLUMN_WORK_DATE} DESC,
            v.{PatrolReportConstants.COLUMN_STARTED_AT} DESC,
            v.{PatrolReportConstants.COLUMN_CONTRACT_CODE},
            v.{PatrolReportConstants.COLUMN_LOCATION_NAME}
        """
    )

    statement = text("\n".join(sql_parts))

    rows = [
        dict(row)
        for row in db.execute(statement, params).mappings().all()
    ]

    filtered_rows: list[dict[str, Any]] = []

    for row in rows:
        report_workday = _to_optional_date(
            row.get(PatrolReportConstants.COLUMN_WORKDAY),
        )

        if report_workday is None:
            continue

        if report_workday < report_start or report_workday > report_end:
            continue

        row[PatrolReportConstants.COLUMN_WORKDAY] = report_workday
        filtered_rows.append(row)

    filtered_rows.sort(
        key=lambda row: (
            _to_optional_date(row.get(PatrolReportConstants.COLUMN_WORKDAY)) or date.min,
            _format_time(row.get(PatrolReportConstants.COLUMN_STARTED_AT)) or "",
            _to_text(row.get(PatrolReportConstants.COLUMN_CONTRACT_CODE)),
            _to_text(row.get(PatrolReportConstants.COLUMN_LOCATION_NAME)),
        ),
        reverse=True,
    )

    results: list[PatrolReportResponse] = []

    for index, row in enumerate(filtered_rows):
        results.append(
            _map_patrol_report_row(
                index + 1,
                row,
                has_today_time_record=False,
                has_cycle_time_record=False,
            )
        )

    return results


def get_patrol_report_rows(
    db: Session,
    *,
    plan_mode: ReportPlanMode = "planned",
    workday: date | None = None,
    workday_start: date | None = None,
    workday_end: date | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    shift_id: int | None = None,
    department_id: int | None = None,
    division_id: int | None = None,
    route_id: int | None = None,
    location_id: int | None = None,
    employee_code: str | None = None,
    status_filter: PatrolStatus | None = None,
    keyword: str | None = None,
) -> list[PatrolReportResponse]:
    report_start = workday_start or start_date or workday
    report_end = workday_end or end_date or workday_start or start_date or workday

    if report_start is None or report_end is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=PATROL_REPORT_DATE_REQUIRED_DETAIL,
        )

    if report_start > report_end:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=PATROL_REPORT_INVALID_DATE_RANGE_DETAIL,
        )

    if plan_mode == "outside_plan":
        try:
            return _get_patrol_report_unplanned_rows(
                db=db,
                report_start=report_start,
                report_end=report_end,
                shift_id=shift_id,
                department_id=department_id,
                division_id=division_id,
                route_id=route_id,
                location_id=location_id,
                employee_code=employee_code,
                status_filter=status_filter,
                keyword=keyword,
            )

        except SQLAlchemyError as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=PATROL_REPORT_FETCH_FAILED_DETAIL,
            ) from exc

    view_column_names = _get_view_column_names(
        db,
        PatrolReportConstants.VIEW_NAME,
    )

    plan_day_select = _select_view_column(
        view_column_names,
        PatrolReportConstants.COLUMN_PLAN_DAY,
        alias=PatrolReportConstants.COLUMN_PLAN_DAY,
    )
    contact_detail_select = _select_view_column(
        view_column_names,
        PatrolReportConstants.COLUMN_CONTACT_DETAIL,
        alias=PatrolReportConstants.COLUMN_CONTACT_DETAIL,
    )
    call_status_select = _select_view_column(
        view_column_names,
        PatrolReportConstants.COLUMN_CALL_STATUS,
        alias=PatrolReportConstants.COLUMN_CALL_STATUS,
    )
    call_note_select = _select_view_column(
        view_column_names,
        PatrolReportConstants.COLUMN_CALL_NOTE,
        alias=PatrolReportConstants.COLUMN_CALL_NOTE,
    )

    sql_parts = [
        f"""
        SELECT
            v.{PatrolReportConstants.COLUMN_CONTRACT_CODE},
            v.{PatrolReportConstants.COLUMN_LOCATION_NAME},
            v.{PatrolReportConstants.COLUMN_SHIFT_NAME_TH},
            v.{PatrolReportConstants.COLUMN_ASSIGNMENT_STATUS},
            v.{PatrolReportConstants.COLUMN_WORK_DATE},
            v.{PatrolReportConstants.COLUMN_STARTED_AT},
            v.{PatrolReportConstants.COLUMN_COMPLETED_AT},
            v.{PatrolReportConstants.COLUMN_EMPLOYEE_CODE},
            v.{PatrolReportConstants.COLUMN_POSITION_NAME},
            v.{PatrolReportConstants.COLUMN_EFFECTIVE_FROM},
            v.{PatrolReportConstants.COLUMN_BY_CONTRACT},
            {plan_day_select},
            v.{PatrolReportConstants.COLUMN_WORKDAY},
            v.{PatrolReportConstants.COLUMN_DEPARTMENT_ID},
            v.{PatrolReportConstants.COLUMN_DIVISION_ID},
            v.{PatrolReportConstants.COLUMN_ROUTE_ID},
            v.{PatrolReportConstants.COLUMN_LOCATION_ID},
            v.{PatrolReportConstants.COLUMN_SHIFT_ID},
            {contact_detail_select},
            {call_status_select},
            {call_note_select},
            NULL AS last_inspection_date
        FROM {PatrolReportConstants.VIEW_NAME} v
        WHERE v.{PatrolReportConstants.COLUMN_WORKDAY}
            BETWEEN :workday_start AND :workday_end
        """
    ]

    params: dict[str, Any] = {
        "workday_start": report_start,
        "workday_end": report_end,
    }

    if shift_id is not None:
        sql_parts.append(f"AND v.{PatrolReportConstants.COLUMN_SHIFT_ID} = :shift_id")
        params["shift_id"] = shift_id

    if department_id is not None:
        sql_parts.append(
            f"AND v.{PatrolReportConstants.COLUMN_DEPARTMENT_ID} = :department_id",
        )
        params["department_id"] = department_id

    if division_id is not None:
        sql_parts.append(
            f"AND v.{PatrolReportConstants.COLUMN_DIVISION_ID} = :division_id",
        )
        params["division_id"] = division_id

    if route_id is not None:
        sql_parts.append(f"AND v.{PatrolReportConstants.COLUMN_ROUTE_ID} = :route_id")
        params["route_id"] = route_id

    if location_id is not None:
        sql_parts.append(
            f"AND v.{PatrolReportConstants.COLUMN_LOCATION_ID} = :location_id",
        )
        params["location_id"] = location_id

    if employee_code and employee_code.strip():
        sql_parts.append(
            f"AND v.{PatrolReportConstants.COLUMN_EMPLOYEE_CODE} = :employee_code",
        )
        params["employee_code"] = employee_code.strip()

    if status_filter:
        sql_parts.append(
            f"AND v.{PatrolReportConstants.COLUMN_ASSIGNMENT_STATUS} = :status_filter",
        )
        params["status_filter"] = status_filter

    if keyword and keyword.strip():
        sql_parts.append(
            f"""
            AND (
                v.{PatrolReportConstants.COLUMN_CONTRACT_CODE} LIKE :keyword
                OR v.{PatrolReportConstants.COLUMN_LOCATION_NAME} LIKE :keyword
            )
            """
        )
        params["keyword"] = f"%{keyword.strip()}%"

    sql_parts.append(
        f"""
        ORDER BY
            v.{PatrolReportConstants.COLUMN_WORKDAY} DESC,
            v.{PatrolReportConstants.COLUMN_SHIFT_ID} ASC,
            v.{PatrolReportConstants.COLUMN_DIVISION_ID} ASC,
            v.{PatrolReportConstants.COLUMN_ROUTE_ID} ASC,
            v.{PatrolReportConstants.COLUMN_CONTRACT_CODE} ASC,
            v.{PatrolReportConstants.COLUMN_LOCATION_NAME} ASC
        """
    )

    statement = text("\n".join(sql_parts))

    try:
        db.execute(
            text(
                f"SET lc_time_names = '{PatrolReportConstants.MYSQL_THAI_LOCALE}'",
            )
        )

        rows = [
            dict(row)
            for row in db.execute(statement, params).mappings().all()
        ]

        time_record_flags = _get_time_record_flags(
            db=db,
            rows=rows,
        )

        results: list[PatrolReportResponse] = []

        for index, row in enumerate(rows):
            has_today_time_record, has_cycle_time_record = time_record_flags[index]

            results.append(
                _map_patrol_report_row(
                    index + 1,
                    row,
                    has_today_time_record=has_today_time_record,
                    has_cycle_time_record=has_cycle_time_record,
                )
            )

        return results

    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=PATROL_REPORT_FETCH_FAILED_DETAIL,
        ) from exc