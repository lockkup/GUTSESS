from __future__ import annotations

from datetime import date
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query
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
    # แยกตามแผน / นอกแผน
    # planned = vw_checkin_report
    # outside_plan = vw_checkin_unplanned
    plan_mode: Annotated[
        PlanMode,
        Query(
            description="ประเภทแผน planned=ตามแผน, outside_plan=นอกแผน",
        ),
    ] = "planned",

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

    # ไม่บังคับแล้ว
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
    return get_patrol_report_rows(
        db,
        plan_mode=plan_mode,
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
        employee_code=employee_code,
        status_filter=status_filter,
        keyword=keyword,
    )