from __future__ import annotations

from datetime import date
from typing import TypeVar

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
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

TIME_RECORD_NOT_FOUND_DETAIL = "Time record not found"
OPEN_TIME_RECORD_NOT_FOUND_DETAIL = "Open time record not found"

T = TypeVar("T")


def _ensure_found(record: T | None, detail_message: str) -> T:
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=detail_message,
        )
    return record


@router.post(
    "/",
    response_model=TimeRecordResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_time_record(
    payload: TimeRecordCheckIn,
    db: Session = Depends(get_db),
) -> TimeRecordResponse:
    return TimeRecordService.create_time_record(db, payload)


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
    time_record = TimeRecordService.get_open_time_record_by_employee(db, employee_code)
    return _ensure_found(time_record, OPEN_TIME_RECORD_NOT_FOUND_DETAIL)


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
        None,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    ),
    shift_id: int | None = Query(None, gt=0),
    work_date: date | None = Query(
        None,
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
    time_record = TimeRecordService.get_time_record_by_id(db, time_record_id)
    return _ensure_found(time_record, TIME_RECORD_NOT_FOUND_DETAIL)


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
        None,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    ),
    shift_id: int | None = Query(None, gt=0),
    work_date: date | None = Query(
        None,
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
    time_record = TimeRecordService.update_time_record(db, time_record_id, payload)
    return _ensure_found(time_record, TIME_RECORD_NOT_FOUND_DETAIL)