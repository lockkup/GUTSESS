
from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy.orm import Session

from app.core import get_db
from app.core.constants import DBConstants
from app.schemas.checkpoint_assignment import (
    AssignmentStatus,
    CheckpointAreaOptionResponse,
    CheckpointAssignmentAction,
    CheckpointAssignmentCreate,
    CheckpointAssignmentDailyResponse,
    CheckpointAssignmentRecheck,
    CheckpointAssignmentReservationAction,
    CheckpointAssignmentResponse,
    CheckpointAssignmentUpdate,
    CheckpointMapLocationResponse,
    CheckpointMapLocationUpdateRequest,
    TakeoverCheckpointAssignmentRequest,
    TakeoverCheckpointAssignmentResponse,
)
from app.schemas.checkpoint_location import (
    VerifyCheckpointLocationRequest,
    VerifyCheckpointLocationResponse,
)
from app.services.checkpoint_assignment import CheckpointAssignmentService

router = APIRouter()

ShiftType = Literal["day", "night"]


@router.post(
    "/",
    response_model=CheckpointAssignmentResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_checkpoint_assignment(
    payload: CheckpointAssignmentCreate,
    db: Session = Depends(get_db),
) -> CheckpointAssignmentResponse:
    return CheckpointAssignmentService.create_checkpoint_assignment(
        db=db,
        payload=payload,
    )


@router.get(
    "/",
    response_model=list[CheckpointAssignmentResponse],
    status_code=status.HTTP_200_OK,
)
def get_checkpoint_assignments(
    skip: int = Query(DBConstants.DEFAULT_PAGE_SKIP, ge=0),
    limit: int = Query(
        DBConstants.DEFAULT_PAGE_LIMIT,
        ge=1,
        le=DBConstants.MAX_PAGE_LIMIT,
    ),
    work_date: date | None = Query(default=None),
    schedule_item_id: int | None = Query(default=None, gt=0),
    parent_assignment_id: int | None = Query(default=None, ge=0),
    assignment_status: AssignmentStatus | None = Query(default=None),
    is_active: bool | None = Query(default=None),
    include_deleted: bool = Query(default=False),
    db: Session = Depends(get_db),
) -> list[CheckpointAssignmentResponse]:
    return CheckpointAssignmentService.get_checkpoint_assignments(
        db=db,
        skip=skip,
        limit=limit,
        work_date=work_date,
        schedule_item_id=schedule_item_id,
        parent_assignment_id=parent_assignment_id,
        assignment_status=assignment_status,
        is_active=is_active,
        include_deleted=include_deleted,
    )


@router.get(
    "/daily",
    response_model=list[CheckpointAssignmentDailyResponse],
    status_code=status.HTTP_200_OK,
)
def get_daily_checkpoint_assignments(
    work_date: date = Query(...),
    shift_type: ShiftType | None = Query(default=None),
    employee_code: str | None = Query(default=None, min_length=1),
    division_id: int | None = Query(default=None, gt=0),
    route_id: int | None = Query(default=None, gt=0),
    is_active: bool | None = Query(default=True),
    include_deleted: bool = Query(default=False),
    db: Session = Depends(get_db),
) -> list[CheckpointAssignmentDailyResponse]:
    return CheckpointAssignmentService.get_daily_checkpoint_assignments(
        db=db,
        work_date=work_date,
        shift_type=shift_type,
        employee_code=employee_code,
        division_id=division_id,
        route_id=route_id,
        is_active=is_active,
        include_deleted=include_deleted,
    )


@router.get(
    "/area-options",
    response_model=list[CheckpointAreaOptionResponse],
    status_code=status.HTTP_200_OK,
)
def get_checkpoint_area_options(
    employee_code: str = Query(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    ),
    db: Session = Depends(get_db),
) -> list[CheckpointAreaOptionResponse]:
    return CheckpointAssignmentService.get_checkpoint_area_options(
        db=db,
        employee_code=employee_code,
    )


@router.get(
    "/map-location",
    response_model=CheckpointMapLocationResponse,
    status_code=status.HTTP_200_OK,
)
def get_checkpoint_map_location(
    contract_code: str = Query(..., min_length=1),
    location_name: str = Query(..., min_length=1),
    assignment_id: int | None = Query(default=None, gt=0),
    employee_code: str | None = Query(
        default=None,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    ),
    db: Session = Depends(get_db),
) -> CheckpointMapLocationResponse:
    # ต้องส่ง Assignment และพนักงานมาพร้อมกันเพื่อให้ Service ตรวจสอบบริบท
    if (assignment_id is None) != (employee_code is None):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="กรุณาระบุ assignment_id และ employee_code ให้ครบทั้งสองค่า",
        )

    # รองรับหน้าที่เปิดดูแผนที่แบบเดิมโดยไม่ได้ส่งบริบท Assignment
    if assignment_id is None:
        return CheckpointAssignmentService.get_checkpoint_map_location(
            db=db,
            contract_code=contract_code,
            location_name=location_name,
        )

    normalized_employee_code = (employee_code or "").strip()

    if len(normalized_employee_code) != DBConstants.EMPLOYEE_CODE_LENGTH:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="รหัสพนักงานไม่ถูกต้อง",
        )

    # Service ต้องตรวจสิทธิ์พนักงานและหาหน่วยงาน/ภาค/เขต/เส้นทางจาก Assignment
    # ก่อนคืนข้อมูลบริบทให้ Frontend ใช้ตรวจ Setting
    return CheckpointAssignmentService.get_checkpoint_map_location(
        db=db,
        contract_code=contract_code,
        location_name=location_name,
        assignment_id=assignment_id,
        employee_code=normalized_employee_code,
    )


@router.post(
    "/{assignment_id}/update-map-location",
    response_model=CheckpointMapLocationResponse,
    status_code=status.HTTP_200_OK,
)
def update_checkpoint_map_location(
    payload: CheckpointMapLocationUpdateRequest,
    assignment_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
) -> CheckpointMapLocationResponse:
    return CheckpointAssignmentService.update_checkpoint_map_location(
        db=db,
        assignment_id=assignment_id,
        payload=payload,
    )


@router.post(
    "/verify-location",
    response_model=VerifyCheckpointLocationResponse,
    status_code=status.HTTP_200_OK,
)
def verify_checkpoint_location(
    payload: VerifyCheckpointLocationRequest,
    db: Session = Depends(get_db),
) -> VerifyCheckpointLocationResponse:
    return CheckpointAssignmentService.verify_checkpoint_location(
        db=db,
        payload=payload,
    )


@router.get(
    "/{assignment_id}",
    response_model=CheckpointAssignmentResponse,
    status_code=status.HTTP_200_OK,
)
def get_checkpoint_assignment(
    assignment_id: int = Path(..., gt=0),
    include_deleted: bool = Query(default=False),
    db: Session = Depends(get_db),
) -> CheckpointAssignmentResponse:
    return CheckpointAssignmentService.get_checkpoint_assignment(
        db=db,
        assignment_id=assignment_id,
        include_deleted=include_deleted,
    )


@router.patch(
    "/{assignment_id}",
    response_model=CheckpointAssignmentResponse,
    status_code=status.HTTP_200_OK,
)
def update_checkpoint_assignment(
    payload: CheckpointAssignmentUpdate,
    assignment_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
) -> CheckpointAssignmentResponse:
    return CheckpointAssignmentService.update_checkpoint_assignment(
        db=db,
        assignment_id=assignment_id,
        payload=payload,
    )


@router.post(
    "/{assignment_id}/reserve",
    response_model=CheckpointAssignmentResponse,
    status_code=status.HTTP_200_OK,
)
def reserve_checkpoint_assignment(
    payload: CheckpointAssignmentReservationAction,
    assignment_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
) -> CheckpointAssignmentResponse:
    return CheckpointAssignmentService.reserve_checkpoint_assignment(
        db=db,
        assignment_id=assignment_id,
        payload=payload,
    )


@router.post(
    "/{assignment_id}/cancel-reservation",
    response_model=CheckpointAssignmentResponse,
    status_code=status.HTTP_200_OK,
)
def cancel_checkpoint_assignment_reservation(
    payload: CheckpointAssignmentReservationAction,
    assignment_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
) -> CheckpointAssignmentResponse:
    return (
        CheckpointAssignmentService.cancel_checkpoint_assignment_reservation(
            db=db,
            assignment_id=assignment_id,
            payload=payload,
        )
    )


@router.patch(
    "/{assignment_id}/start",
    response_model=CheckpointAssignmentResponse,
    status_code=status.HTTP_200_OK,
)
def start_checkpoint_assignment(
    payload: CheckpointAssignmentAction,
    assignment_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
) -> CheckpointAssignmentResponse:
    return CheckpointAssignmentService.start_checkpoint_assignment(
        db=db,
        assignment_id=assignment_id,
        updated_by=payload.updated_by,
    )


@router.post(
    "/{assignment_id}/takeover",
    response_model=TakeoverCheckpointAssignmentResponse,
    status_code=status.HTTP_200_OK,
)
def takeover_checkpoint_assignment(
    payload: TakeoverCheckpointAssignmentRequest,
    assignment_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
) -> TakeoverCheckpointAssignmentResponse:
    return CheckpointAssignmentService.takeover_checkpoint_assignment(
        db=db,
        assignment_id=assignment_id,
        updated_by=payload.updated_by,
    )


@router.patch(
    "/{assignment_id}/complete",
    response_model=CheckpointAssignmentResponse,
    status_code=status.HTTP_200_OK,
)
def complete_checkpoint_assignment(
    payload: CheckpointAssignmentAction,
    assignment_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
) -> CheckpointAssignmentResponse:
    return CheckpointAssignmentService.complete_checkpoint_assignment(
        db=db,
        assignment_id=assignment_id,
        updated_by=payload.updated_by,
    )


@router.post(
    "/{assignment_id}/recheck",
    response_model=CheckpointAssignmentResponse,
    status_code=status.HTTP_201_CREATED,
)
def recheck_checkpoint_assignment(
    payload: CheckpointAssignmentRecheck,
    assignment_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
) -> CheckpointAssignmentResponse:
    return CheckpointAssignmentService.recheck_checkpoint_assignment(
        db=db,
        assignment_id=assignment_id,
        payload=payload,
    )


@router.patch(
    "/{assignment_id}/delete",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_checkpoint_assignment(
    payload: CheckpointAssignmentAction,
    assignment_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
) -> None:
    CheckpointAssignmentService.delete_checkpoint_assignment(
        db=db,
        assignment_id=assignment_id,
        updated_by=payload.updated_by,
    )
