from __future__ import annotations

from datetime import date
from typing import Annotated, Literal, cast

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.patrol_report import (
    PatrolReportFilterOptionsResponse,
    PatrolReportResponse,
    PatrolStatus,
)
from app.services.patrol_report_service import (
    get_patrol_report_filter_options,
    get_patrol_report_rows,
)


router = APIRouter()

PlanMode = Literal["planned", "outside_plan"]


def _clean_text(value: str | None) -> str | None:
    if value is None:
        return None

    cleaned = value.strip()
    return cleaned if cleaned else None


def _parse_plan_modes(
    *,
    plan_modes: str | None,
    legacy_plan_mode: PlanMode | None,
) -> list[PlanMode]:
    """
    แปลง plan_modes แบบคั่นด้วย comma เป็นรายการ

    ตัวอย่าง:
    - planned
    - outside_plan
    - planned,outside_plan

    ยังคงรองรับ plan_mode แบบเดิม และใช้ planned เป็นค่าเริ่มต้น
    """

    if plan_modes is not None:
        raw_modes = [
            value.strip()
            for value in plan_modes.split(",")
            if value.strip()
        ]
    elif legacy_plan_mode is not None:
        raw_modes = [legacy_plan_mode]
    else:
        raw_modes = ["planned"]

    selected_modes: list[PlanMode] = []
    invalid_modes: list[str] = []

    for raw_mode in raw_modes:
        if raw_mode not in ("planned", "outside_plan"):
            invalid_modes.append(raw_mode)
            continue

        mode = cast(PlanMode, raw_mode)

        if mode not in selected_modes:
            selected_modes.append(mode)

    if invalid_modes:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "plan_modes ไม่ถูกต้อง: "
                f"{', '.join(invalid_modes)} "
                "(รองรับ planned, outside_plan)"
            ),
        )

    if not selected_modes:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="กรุณาระบุ plan_modes อย่างน้อย 1 รายการ",
        )

    return selected_modes


def _validate_date_range(
    *,
    workday: date | None,
    workday_start: date | None,
    workday_end: date | None,
    start_date: date | None,
    end_date: date | None,
) -> None:
    """
    ตรวจช่วงวันที่พื้นฐาน

    รองรับทั้งชื่อเดิม:
    - workday

    และชื่อใหม่:
    - workday_start / workday_end
    - start_date / end_date
    """

    if workday is not None:
        return

    real_start = workday_start or start_date
    real_end = workday_end or end_date

    if real_start is not None and real_end is not None and real_end < real_start:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="วันที่สิ้นสุดต้องไม่น้อยกว่าวันที่เริ่มต้น",
        )


def _validate_patrol_report_scope(
    *,
    department_id: int | None,
    division_id: int | None,
    route_id: int | None,
    location_id: int | None,
    employee_code: str | None,
    keyword: str | None,
) -> None:
    """
    กันไม่ให้ค้นหากว้างเกินไป

    เงื่อนไขที่อนุญาตให้ค้นหา:
    - เลือก ภาค + เขต
    - หรือเลือก เส้นทาง
    - หรือเลือก รายหน่วยงาน
    - หรือกรอกรหัสสายตรวจ
    - หรือกรอกคำค้นหา
    """

    has_department_and_division = (
        department_id is not None and division_id is not None
    )
    has_route = route_id is not None
    has_location = location_id is not None
    has_employee = employee_code is not None
    has_keyword = keyword is not None

    can_search = (
        has_department_and_division
        or has_route
        or has_location
        or has_employee
        or has_keyword
    )

    if can_search:
        return

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=(
            "กรุณาเลือก ภาค และ เขต ก่อนค้นหา "
            "หรือเลือก เส้นทาง / รายหน่วยงาน / กรอกคำค้นหา"
        ),
    )


@router.get(
    "/patrol/filter-options",
    response_model=PatrolReportFilterOptionsResponse,
    summary="ตัวเลือกตัวกรองรายงานสายตรวจ",
)
def read_patrol_report_filter_options(
    db: Session = Depends(get_db),
) -> PatrolReportFilterOptionsResponse:
    return get_patrol_report_filter_options(db)


@router.get(
    "/patrol",
    response_model=list[PatrolReportResponse],
    summary="รายงานงานสายตรวจ",
)
def read_patrol_report(
    # เลือกได้หลายประเภท โดยคั่นค่าด้วย comma
    # planned = vw_checkin_report
    # outside_plan = vw_checkin_unplanned
    plan_modes: Annotated[
        str | None,
        Query(
            description=(
                "ประเภทงานหลายรายการคั่นด้วย comma เช่น "
                "planned,outside_plan"
            ),
        ),
    ] = None,

    # รองรับ frontend เดิมที่ส่ง plan_mode ค่าเดียว
    plan_mode: Annotated[
        PlanMode | None,
        Query(
            description=(
                "ประเภทงานแบบเดิม planned=ตามแผน, "
                "outside_plan=งานอื่น ๆ"
            ),
        ),
    ] = None,

    # รองรับ backend เดิม / frontend เดิม ที่ส่ง workday วันเดียว
    workday: Annotated[
        date | None,
        Query(description="วันที่รายงาน รูปแบบ YYYY-MM-DD"),
    ] = None,

    # รองรับ frontend ใหม่แบบช่วงวันที่
    workday_start: Annotated[
        date | None,
        Query(description="วันที่เริ่มต้น รูปแบบ YYYY-MM-DD"),
    ] = None,
    workday_end: Annotated[
        date | None,
        Query(description="วันที่สิ้นสุด รูปแบบ YYYY-MM-DD"),
    ] = None,

    # รองรับชื่อ param อีกแบบจาก frontend
    start_date: Annotated[
        date | None,
        Query(description="วันที่เริ่มต้น รูปแบบ YYYY-MM-DD"),
    ] = None,
    end_date: Annotated[
        date | None,
        Query(description="วันที่สิ้นสุด รูปแบบ YYYY-MM-DD"),
    ] = None,

    # ถ้า frontend เลือกผลัด = ทั้งหมด จะไม่ส่ง shift_id มา
    shift_id: Annotated[
        int | None,
        Query(ge=1, description="รหัสผลัด shift_id"),
    ] = None,

    department_id: Annotated[
        int | None,
        Query(ge=1, description="รหัสภาค department_id"),
    ] = None,
    division_id: Annotated[
        int | None,
        Query(ge=1, description="รหัสเขต division_id"),
    ] = None,
    route_id: Annotated[
        int | None,
        Query(ge=1, description="รหัสเส้นทาง route_id"),
    ] = None,
    location_id: Annotated[
        int | None,
        Query(ge=1, description="รหัสหน่วยงาน location_id"),
    ] = None,
    employee_code: Annotated[
        str | None,
        Query(
            max_length=20,
            description="รหัสสายตรวจ employee_code",
        ),
    ] = None,
    status_filter: Annotated[
        PatrolStatus | None,
        Query(
            alias="status",
            description="สถานะ completed, in_progress, pending",
        ),
    ] = None,
    keyword: Annotated[
        str | None,
        Query(
            max_length=100,
            description="ค้นหารหัสสัญญา / ชื่อหน่วยงาน / ผู้ตรวจ",
        ),
    ] = None,
    db: Session = Depends(get_db),
) -> list[PatrolReportResponse]:
    clean_employee_code = _clean_text(employee_code)
    clean_keyword = _clean_text(keyword)
    selected_plan_modes = _parse_plan_modes(
        plan_modes=plan_modes,
        legacy_plan_mode=plan_mode,
    )

    _validate_date_range(
        workday=workday,
        workday_start=workday_start,
        workday_end=workday_end,
        start_date=start_date,
        end_date=end_date,
    )

    _validate_patrol_report_scope(
        department_id=department_id,
        division_id=division_id,
        route_id=route_id,
        location_id=location_id,
        employee_code=clean_employee_code,
        keyword=clean_keyword,
    )

    return get_patrol_report_rows(
        db,
        plan_modes=selected_plan_modes,
        workday=workday,
        workday_start=workday_start,
        workday_end=workday_end,
        start_date=start_date,
        end_date=end_date,
        shift_id=shift_id,
        department_id=department_id,
        division_id=division_id,
        route_id=route_id,
        location_id=location_id,
        employee_code=clean_employee_code,
        status_filter=status_filter,
        keyword=clean_keyword,
    )