from __future__ import annotations

from datetime import date
from typing import Annotated

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
    summary="รายงานงานสายตรวจประจำวัน",
)
def read_patrol_report(
    workday: Annotated[
        date,
        Query(description="วันที่รายงาน รูปแบบ YYYY-MM-DD"),
    ],
    shift_id: Annotated[
        int,
        Query(ge=1, description="รหัสผลัด shift_id"),
    ],
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
        workday=workday,
        shift_id=shift_id,
        department_id=department_id,
        division_id=division_id,
        route_id=route_id,
        location_id=location_id,
        employee_code=employee_code,
        status_filter=status_filter,
        keyword=keyword,
    )