from __future__ import annotations

from datetime import date, datetime, time, timedelta
from typing import Any, Mapping, cast

from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.error_messages import PATROL_REPORT_FETCH_FAILED_DETAIL
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

    # นับรวมวันเริ่มสัญญาเป็นวันที่ 1
    # effective_from = 2026-05-20
    # workday        = 2026-05-20 => วันที่ 1
    # workday        = 2026-05-21 => วันที่ 2
    return (report_workday - effective_from).days + 1


def _calculate_cycle_length(by_contract: int) -> int:
    # ตามภาพตัวอย่าง:
    # 3 วัน  = เหลือง 1, ส้ม 2, แดง 3
    # 5 วัน  = เหลือง 1-2, ส้ม 3-4, แดง 5
    # 7 วัน  = เหลือง 1-3, ส้ม 4-6, แดง 7
    # 15 วัน = เหลือง 1-7, ส้ม 8-14, แดง 15
    #
    # ถ้า 30 วัน ใช้ pattern 15 วันวน 2 รอบ
    return min(by_contract, 15)


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

    # วันนี้มี time_record จริง ให้เป็น 0 เพื่อแสดงเขียว
    if has_today_time_record:
        return 0

    # ในรอบนี้เคยมี time_record ก่อนถึงวันนี้แล้ว
    # วันนี้ไม่ต้องแสดงจำนวนวันแจ้งเตือน
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
    # เขียวเฉพาะวันที่มี time_record จริงของจุดนี้
    if has_today_time_record:
        return "green", "เข้าตรวจแล้ว"

    # ถ้าในรอบนี้เคยมี time_record แล้ว แต่วันนี้ไม่ได้ตรวจ
    # ไม่ต้องแสดง yellow/orange/red
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


def _get_time_record_flags(
    db: Session,
    rows: list[Mapping[str, Any]],
) -> list[tuple[bool, bool]]:
    # return แต่ละ row:
    # (
    #   has_today_time_record,
    #   has_cycle_time_record,
    # )
    flags: list[tuple[bool, bool]] = [(False, False) for _ in rows]

    cycle_infos: list[tuple[int, int, date, date]] = []
    location_ids: set[int] = set()

    min_cycle_start: date | None = None
    max_lookup_workday: date | None = None

    for index, row in enumerate(rows):
        effective_from = _to_optional_date(row.get("effective_from"))
        report_workday = _to_optional_date(row.get("workday"))
        by_contract = _to_optional_positive_int(row.get("by_contract"))
        location_id = _to_optional_positive_int(row.get("location_id"))

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

        # สำคัญ:
        # ใช้ถึงวันที่รายงานเท่านั้น
        # ห้ามใช้ cycle_end เพราะจะเห็น time_record ในอนาคต
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

    # ไม่ใช้ shift_id ใน SQL นี้
    # เพราะสีเขียวต้องดูจาก time_record ของจุดนี้เท่านั้น
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

        # วันนี้มี time_record จริงไหม
        has_today_time_record = report_workday in inspection_dates

        # รอบนี้เคยมี time_record ตั้งแต่วันเริ่มรอบถึงวันที่รายงานไหม
        # ไม่ดูวันที่หลัง report_workday
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
    effective_from = _to_optional_date(row.get("effective_from"))
    by_contract = _to_optional_positive_int(row.get("by_contract"))
    report_workday = _to_optional_date(row.get("workday"))
    last_inspection_date = _to_optional_date(row.get("last_inspection_date"))
    patrol_status = _normalize_status(row.get("assignment_status"))

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
        contractCode=_to_text(row.get("contract_code")),
        siteName=_to_text(row.get("location_name")),
        status=patrol_status,

        departmentId=_to_optional_positive_int(row.get("department_id")),
        divisionId=_to_optional_positive_int(row.get("division_id")),
        routeId=_to_optional_positive_int(row.get("route_id")),
        locationId=_to_optional_positive_int(row.get("location_id")),

        effectiveFrom=effective_from,
        byContract=by_contract,

        planDay=None,

        lastInspectionDate=last_inspection_date,

        # ถ้าวันนี้มี time_record จะเป็น 0
        # ถ้าในรอบนี้เคยตรวจแล้ว แต่วันนี้ไม่ได้ตรวจ จะเป็น None
        # ถ้ายังไม่เคยตรวจในรอบนี้ จะเป็นจำนวนวันที่นับจาก effective_from
        daysWithoutInspection=report_day_number,

        notificationLevel=notification_level,
        notificationText=notification_text,

        shiftLabel=_to_text(row.get("shift_name_th")),
        dateText=_to_text(row.get("work_date")),

        checkInTime=_format_time(row.get("started_at")),
        checkOutTime=_format_time(row.get("completed_at")),

        employeeCode=_to_optional_text(row.get("employee_code")),
        positionName=_to_optional_text(row.get("position_name")),
        operatorName=_build_operator_name(
            row.get("employee_code"),
            row.get("position_name"),
        ),

        contactDetail=None,
        callStatus=None,
        callNote=None,

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
                    routeName=_to_text(row.get("route_name"), f"เส้นทาง {route_id}"),
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
            routes=routes,
            locations=locations,
            employees=employees,
        )

    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=PATROL_REPORT_FETCH_FAILED_DETAIL,
        ) from exc


def get_patrol_report_rows(
    db: Session,
    *,
    workday: date,
    shift_id: int,
    department_id: int | None = None,
    division_id: int | None = None,
    route_id: int | None = None,
    location_id: int | None = None,
    employee_code: str | None = None,
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
            v.work_date,
            v.started_at,
            v.completed_at,
            v.employee_code,
            v.position_name,
            v.effective_from,
            v.by_contract,
            v.workday,
            v.department_id,
            v.division_id,
            v.route_id,
            v.location_id,
            v.shift_id,
            NULL AS last_inspection_date
        FROM vw_checkin_report v
        WHERE v.workday = :workday
          AND v.shift_id = :shift_id
        """
    ]

    params: dict[str, Any] = {
        "workday": workday,
        "shift_id": shift_id,
    }

    if department_id is not None:
        sql_parts.append("AND v.department_id = :department_id")
        params["department_id"] = department_id

    if division_id is not None:
        sql_parts.append("AND v.division_id = :division_id")
        params["division_id"] = division_id

    if route_id is not None:
        sql_parts.append("AND v.route_id = :route_id")
        params["route_id"] = route_id

    if location_id is not None:
        sql_parts.append("AND v.location_id = :location_id")
        params["location_id"] = location_id

    if employee_code and employee_code.strip():
        sql_parts.append("AND v.employee_code = :employee_code")
        params["employee_code"] = employee_code.strip()

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
                WHEN v.assignment_status = 'in_progress' THEN 1
                WHEN v.assignment_status = 'pending' THEN 2
                WHEN v.assignment_status = 'completed' THEN 3
                ELSE 4
            END,
            v.contract_code,
            v.location_name
        """
    )

    statement = text("\n".join(sql_parts))

    try:
        # ต้องรันใน session/connection เดียวกันก่อน SELECT รายงาน
        # เพื่อให้ DATE_FORMAT(... %W ... %M ...) ใน vw_checkin_report แสดงวัน/เดือนเป็นภาษาไทย
        db.execute(text("SET lc_time_names = 'th_TH'"))

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