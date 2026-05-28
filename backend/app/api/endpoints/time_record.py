from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, Path, Query, status
from sqlalchemy.orm import Session

from app.core import get_db
from app.core.constants import DBConstants
from app.schemas.time_record import (
    TimeRecordCheckIn,
    TimeRecordCheckOut,
    TimeRecordListItemResponse,
    TimeRecordResponse,
)
from app.services.time_record import TimeRecordService

router = APIRouter(tags=["Time Records"])


@router.post(
    "/",
    response_model=TimeRecordResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_time_record(
    payload: TimeRecordCheckIn,
    db: Session = Depends(get_db),
) -> TimeRecordResponse:
    return TimeRecordService.create_time_record(
        db=db,
        payload=payload,
    )


# =========================================================
# OPEN RECORD: ATTENDANCE
# ใช้กับเมนู "ลงเวลา เข้า-ออกงาน"
# ต้องดึงเฉพาะ time_record ที่ไม่ได้ผูกกับ checkpoint_assignment.time_record_id
# =========================================================
@router.get(
    "/open/attendance/{employee_code}",
    response_model=TimeRecordResponse,
    status_code=status.HTTP_200_OK,
)
def get_open_attendance_time_record_by_employee(
    employee_code: str = Path(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    ),
    db: Session = Depends(get_db),
) -> TimeRecordResponse:
    return TimeRecordService.get_open_attendance_time_record_by_employee(
        db=db,
        employee_code=employee_code,
    )


# =========================================================
# OPEN RECORD: CHECKPOINT
# ใช้กับเมนู "ตารางงานสายตรวจ"
# ต้องดึง time_record ผ่าน checkpoint_assignment.time_record_id
# จาก assignment_id ที่เลือก
# =========================================================
@router.get(
    "/open/checkpoint/{employee_code}/{assignment_id}",
    response_model=TimeRecordResponse,
    status_code=status.HTTP_200_OK,
)
def get_open_checkpoint_time_record_by_employee(
    employee_code: str = Path(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    ),
    assignment_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
) -> TimeRecordResponse:
    return TimeRecordService.get_open_checkpoint_time_record_by_employee(
        db=db,
        employee_code=employee_code,
        assignment_id=assignment_id,
    )


# =========================================================
# BACKWARD COMPATIBILITY
# endpoint เดิม /open/{employee_code}
# ให้ใช้เป็นงานปกติเท่านั้น เพื่อไม่ให้ดึง record สายตรวจมาแสดงผิดหน้า
# =========================================================
@router.get(
    "/open/{employee_code}",
    response_model=TimeRecordResponse,
    status_code=status.HTTP_200_OK,
)
def get_open_time_record_by_employee(
    employee_code: str = Path(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    ),
    db: Session = Depends(get_db),
) -> TimeRecordResponse:
    return TimeRecordService.get_open_attendance_time_record_by_employee(
        db=db,
        employee_code=employee_code,
    )


@router.get(
    "/list-items",
    response_model=list[TimeRecordListItemResponse],
    status_code=status.HTTP_200_OK,
)
def get_time_record_list_items(
    skip: int = Query(DBConstants.DEFAULT_PAGE_SKIP, ge=0),
    limit: int = Query(
        DBConstants.DEFAULT_PAGE_LIMIT,
        ge=1,
        le=DBConstants.MAX_PAGE_LIMIT,
    ),
    employee_code: str | None = Query(
        default=None,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    ),
    shift_id: int | None = Query(default=None, gt=0),
    work_date: date | None = Query(
        default=None,
        description="กรองข้อมูลตามวันที่ปฏิบัติงาน (YYYY-MM-DD)",
    ),
    db: Session = Depends(get_db),
) -> list[TimeRecordListItemResponse]:
    return TimeRecordService.get_time_record_list_items(
        db=db,
        skip=skip,
        limit=limit,
        employee_code=employee_code,
        shift_id=shift_id,
        work_date=work_date,
    )


@router.get(
    "/{time_record_id}",
    response_model=TimeRecordResponse,
    status_code=status.HTTP_200_OK,
)
def get_time_record_by_id(
    time_record_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
) -> TimeRecordResponse:
    return TimeRecordService.get_time_record_by_id(
        db=db,
        time_record_id=time_record_id,
    )


@router.get(
    "/",
    response_model=list[TimeRecordResponse],
    status_code=status.HTTP_200_OK,
)
def get_time_records(
    skip: int = Query(DBConstants.DEFAULT_PAGE_SKIP, ge=0),
    limit: int = Query(
        DBConstants.DEFAULT_PAGE_LIMIT,
        ge=1,
        le=DBConstants.MAX_PAGE_LIMIT,
    ),
    employee_code: str | None = Query(
        default=None,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    ),
    shift_id: int | None = Query(default=None, gt=0),
    work_date: date | None = Query(
        default=None,
        description="กรองข้อมูลตามวันที่ปฏิบัติงาน (YYYY-MM-DD)",
    ),
    db: Session = Depends(get_db),
) -> list[TimeRecordResponse]:
    return TimeRecordService.get_time_records(
        db=db,
        skip=skip,
        limit=limit,
        employee_code=employee_code,
        shift_id=shift_id,
        work_date=work_date,
    )


@router.patch(
    "/{time_record_id}",
    response_model=TimeRecordResponse,
    status_code=status.HTTP_200_OK,
)
def update_time_record(
    payload: TimeRecordCheckOut,
    time_record_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
) -> TimeRecordResponse:
    return TimeRecordService.update_time_record(
        db=db,
        time_record_id=time_record_id,
        payload=payload,
    )