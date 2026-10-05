# app/api/endpoints/checkpoint_assignment_call.py

from __future__ import annotations

import json
from datetime import datetime

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Path,
    Query,
    Response,
    UploadFile,
    status,
)
from sqlalchemy.orm import Session

from app.core import get_db
from app.core.constants import DBConstants
from app.schemas.checkpoint_assignment_call import (
    CheckpointAssignmentCallAction,
    CheckpointAssignmentCallCreate,
    CheckpointAssignmentCallResponse,
    CheckpointAssignmentCallUpdate,
)
from app.services.checkpoint_assignment_call import (
    CheckpointAssignmentCallService,
)


router = APIRouter()


# ============================================================
# Helpers
# ============================================================

def _parse_image_ids(value: str) -> list[int | None]:
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="รูปแบบ image_ids ไม่ถูกต้อง",
        ) from exc

    if not isinstance(parsed, list):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="image_ids ต้องเป็นรายการ",
        )

    result: list[int | None] = []

    for item in parsed:
        if item is None:
            result.append(None)
            continue

        if (
            isinstance(item, bool)
            or not isinstance(item, int)
            or item <= 0
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="image_ids ต้องมีเฉพาะรหัสรูปที่มากกว่า 0 หรือ null",
            )

        result.append(item)

    if len(result) > DBConstants.CHECKPOINT_CALL_MAX_IMAGES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "สามารถแนบรูปภาพได้สูงสุด "
                f"{DBConstants.CHECKPOINT_CALL_MAX_IMAGES} รูป"
            ),
        )

    existing_ids = [
        image_id
        for image_id in result
        if image_id is not None
    ]

    if len(existing_ids) != len(set(existing_ids)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="image_ids มีรหัสรูปซ้ำ",
        )

    return result


def _parse_deleted_image_ids(value: str) -> list[int]:
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="รูปแบบ deleted_image_ids ไม่ถูกต้อง",
        ) from exc

    if not isinstance(parsed, list):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="deleted_image_ids ต้องเป็นรายการ",
        )

    result: list[int] = []

    for item in parsed:
        if (
            isinstance(item, bool)
            or not isinstance(item, int)
            or item <= 0
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "deleted_image_ids ต้องมีเฉพาะ"
                    "รหัสรูปที่มากกว่า 0"
                ),
            )

        result.append(item)

    if len(result) != len(set(result)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="deleted_image_ids มีรหัสรูปซ้ำ",
        )

    return result


async def _read_upload_files(
    images: list[UploadFile] | None,
) -> list[bytes]:
    image_bytes_list: list[bytes] = []

    if not images:
        return image_bytes_list

    try:
        for image in images:
            image_bytes_list.append(
                await image.read()
            )
    finally:
        for image in images:
            await image.close()

    return image_bytes_list


# ============================================================
# Create
# ============================================================

@router.post(
    "/",
    response_model=CheckpointAssignmentCallResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_checkpoint_assignment_call(
    assignment_id: int = Form(
        ...,
        gt=0,
    ),
    contact_detail: str = Form(
        ...,
        min_length=1,
    ),
    call_status: int = Form(
        ...,
        ge=1,
        le=3,
    ),
    call_note: str | None = Form(
        default=None,
    ),
    is_active: bool = Form(
        default=True,
    ),
    call_datetime: datetime | None = Form(
        default=None,
    ),
    created_by: str = Form(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    ),
    images: list[UploadFile] | None = File(
        default=None,
    ),
    db: Session = Depends(get_db),
) -> CheckpointAssignmentCallResponse:
    """
    สร้างบันทึกการโทร

    รองรับ multipart/form-data

    fields:
    - assignment_id
    - contact_detail
    - call_status
    - call_note
    - is_active
    - call_datetime
    - created_by

    files:
    - images สูงสุด 3 รูป
    """

    payload = CheckpointAssignmentCallCreate(
        assignment_id=assignment_id,
        contact_detail=contact_detail,
        call_status=call_status,
        call_note=call_note,
        is_active=is_active,
        call_datetime=call_datetime,
        created_by=created_by,
    )

    image_bytes_list = await _read_upload_files(
        images
    )

    return (
        CheckpointAssignmentCallService
        .create_checkpoint_assignment_call(
            db=db,
            payload=payload,
            image_bytes_list=image_bytes_list,
        )
    )


# ============================================================
# Get list
# ============================================================

@router.get(
    "/",
    response_model=list[CheckpointAssignmentCallResponse],
    status_code=status.HTTP_200_OK,
)
def get_checkpoint_assignment_calls(
    skip: int = Query(
        DBConstants.DEFAULT_PAGE_SKIP,
        ge=0,
    ),
    limit: int = Query(
        DBConstants.DEFAULT_PAGE_LIMIT,
        ge=1,
        le=DBConstants.MAX_PAGE_LIMIT,
    ),
    assignment_id: int | None = Query(
        default=None,
        gt=0,
    ),
    is_active: bool | None = Query(
        default=None,
    ),
    include_deleted: bool = Query(
        default=False,
    ),
    db: Session = Depends(get_db),
) -> list[CheckpointAssignmentCallResponse]:
    return (
        CheckpointAssignmentCallService
        .get_checkpoint_assignment_calls(
            db=db,
            skip=skip,
            limit=limit,
            assignment_id=assignment_id,
            is_active=is_active,
            include_deleted=include_deleted,
        )
    )


# ============================================================
# Get one
# ============================================================

@router.get(
    "/{assignment_call_id}",
    response_model=CheckpointAssignmentCallResponse,
    status_code=status.HTTP_200_OK,
)
def get_checkpoint_assignment_call(
    assignment_call_id: int = Path(
        ...,
        gt=0,
    ),
    include_deleted: bool = Query(
        default=False,
    ),
    db: Session = Depends(get_db),
) -> CheckpointAssignmentCallResponse:
    return (
        CheckpointAssignmentCallService
        .get_checkpoint_assignment_call(
            db=db,
            assignment_call_id=assignment_call_id,
            include_deleted=include_deleted,
        )
    )


# ============================================================
# Update
# ============================================================

@router.patch(
    "/{assignment_call_id}",
    response_model=CheckpointAssignmentCallResponse,
    status_code=status.HTTP_200_OK,
)
async def update_checkpoint_assignment_call(
    assignment_call_id: int = Path(
        ...,
        gt=0,
    ),
    contact_detail: str | None = Form(
        default=None,
        min_length=1,
    ),
    call_status: int | None = Form(
        default=None,
        ge=1,
        le=3,
    ),
    call_note: str | None = Form(
        default=None,
    ),
    is_active: bool | None = Form(
        default=None,
    ),
    call_datetime: datetime | None = Form(
        default=None,
    ),
    updated_by: str = Form(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    ),
    image_ids: str = Form(
        default="[]",
    ),
    deleted_image_ids: str = Form(
        default="[]",
    ),
    images: list[UploadFile] | None = File(
        default=None,
    ),
    db: Session = Depends(get_db),
) -> CheckpointAssignmentCallResponse:
    """
    แก้ไขบันทึกการโทรเดิมแบบ Differential Update

    fields:
    - contact_detail
    - call_status
    - call_note
    - is_active
    - call_datetime
    - updated_by
    - image_ids
        JSON array ตามลำดับรูปปัจจุบัน
        เช่น [131, 132, null]

        number = รูปเดิมที่ยังคงอยู่
        null   = ตำแหน่งของรูปใหม่

    - deleted_image_ids
        JSON array ของรหัสรูปเดิมที่ถูกลบหรือเปลี่ยน
        เช่น [132]

    files:
    - images
        ส่งเฉพาะรูปใหม่หรือรูปที่ใช้แทนรูปเดิม
    """

    parsed_image_ids = _parse_image_ids(
        image_ids
    )

    parsed_deleted_image_ids = (
        _parse_deleted_image_ids(
            deleted_image_ids
        )
    )

    new_image_slots = sum(
        1
        for image_id in parsed_image_ids
        if image_id is None
    )

    image_bytes_list = await _read_upload_files(
        images
    )

    if new_image_slots != len(image_bytes_list):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "จำนวนตำแหน่งรูปใหม่ใน image_ids "
                "ไม่ตรงกับจำนวนไฟล์ images"
            ),
        )

    payload = CheckpointAssignmentCallUpdate(
        contact_detail=contact_detail,
        call_status=call_status,
        call_note=call_note,
        is_active=is_active,
        call_datetime=call_datetime,
        updated_by=updated_by,
    )

    return (
        CheckpointAssignmentCallService
        .update_checkpoint_assignment_call(
            db=db,
            assignment_call_id=assignment_call_id,
            payload=payload,
            image_ids=parsed_image_ids,
            deleted_image_ids=parsed_deleted_image_ids,
            image_bytes_list=image_bytes_list,
        )
    )


# ============================================================
# Soft delete
# ============================================================

@router.delete(
    "/{assignment_call_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_checkpoint_assignment_call(
    payload: CheckpointAssignmentCallAction,
    assignment_call_id: int = Path(
        ...,
        gt=0,
    ),
    db: Session = Depends(get_db),
) -> Response:
    (
        CheckpointAssignmentCallService
        .delete_checkpoint_assignment_call(
            db=db,
            assignment_call_id=assignment_call_id,
            updated_by=payload.updated_by,
        )
    )

    return Response(
        status_code=status.HTTP_204_NO_CONTENT
    )


# ============================================================
# Deactivate
# ============================================================

@router.patch(
    "/{assignment_call_id}/deactivate",
    response_model=CheckpointAssignmentCallResponse,
    status_code=status.HTTP_200_OK,
)
def deactivate_checkpoint_assignment_call(
    payload: CheckpointAssignmentCallAction,
    assignment_call_id: int = Path(
        ...,
        gt=0,
    ),
    db: Session = Depends(get_db),
) -> CheckpointAssignmentCallResponse:
    return (
        CheckpointAssignmentCallService
        .deactivate_checkpoint_assignment_call(
            db=db,
            assignment_call_id=assignment_call_id,
            updated_by=payload.updated_by,
        )
    )
