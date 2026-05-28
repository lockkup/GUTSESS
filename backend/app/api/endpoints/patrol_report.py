from __future__ import annotations

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.patrol_report import PatrolReportResponse, PatrolStatus
from app.services.patrol_report_service import get_patrol_report_rows


router = APIRouter()


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
    department_id: Annotated[
        int,
        Query(ge=1, description="รหัสฝ่าย/แผนก department_id"),
    ],
    division_id: Annotated[
        int,
        Query(ge=1, description="รหัส division_id"),
    ],
    shift_id: Annotated[
        int,
        Query(ge=1, description="รหัสผลัด shift_id"),
    ],
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
        department_id=department_id,
        division_id=division_id,
        shift_id=shift_id,
        status_filter=status_filter,
        keyword=keyword,
    )