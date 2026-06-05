from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import exists, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.constants import DBConstants
from app.core.error_messages import (
    CHECKPOINT_ASSIGNMENT_CALL_NOT_FOUND_DETAIL,
    CHECKPOINT_ASSIGNMENT_NOT_FOUND_DETAIL,
    CREATED_BY_EMPLOYEE_NOT_FOUND_DETAIL,
    INACTIVE_CHECKPOINT_ASSIGNMENT_DETAIL,
    INVALID_CHECKPOINT_ASSIGNMENT_CALL_UPDATE_DETAIL,
    INVALID_REFERENCE_DETAIL,
    UPDATED_BY_EMPLOYEE_NOT_FOUND_DETAIL,
)
from app.models import CheckpointAssignment, CheckpointAssignmentCall, Employees
from app.schemas.checkpoint_assignment_call import (
    CheckpointAssignmentCallCreate,
    CheckpointAssignmentCallUpdate,
)


class CheckpointAssignmentCallService:
    @staticmethod
    def _get_integrity_error_message(exc: IntegrityError) -> str:
        """
        ใช้ดู error จริงจาก MySQL ตอน db.commit() ไม่ผ่าน

        ตัวอย่าง error ที่อาจเจอ:
        - Column 'call_datetime' cannot be null
        - Column 'updated_by' cannot be null
        - Data truncated for column 'call_status'
        - Cannot add or update a child row: a foreign key constraint fails
        """
        origin_error = getattr(exc, "orig", None)

        if origin_error is not None:
            return str(origin_error)

        return str(exc)

    @staticmethod
    def _commit(
        db: Session,
        refresh_obj: Any | None = None,
    ) -> None:
        try:
            db.commit()

            if refresh_obj is not None:
                db.refresh(refresh_obj)

        except IntegrityError as exc:
            db.rollback()

            db_error_message = (
                CheckpointAssignmentCallService._get_integrity_error_message(exc)
            )

            # แสดง error จริงที่ terminal uvicorn
            print(
                "CHECKPOINT_ASSIGNMENT_CALL INTEGRITY ERROR:",
                db_error_message,
            )

            # ช่วง debug ให้ frontend เห็น error จริง
            # ถ้าระบบนิ่งแล้ว ค่อยเปลี่ยนกลับเป็น detail=INVALID_REFERENCE_DETAIL ได้
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{INVALID_REFERENCE_DETAIL}: {db_error_message}",
            ) from exc

    @staticmethod
    def _ensure_exists(
        db: Session,
        column: Any,
        value: Any,
        error_detail: str,
    ) -> None:
        stmt = select(exists().where(column == value))

        if not db.scalar(stmt):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=error_detail,
            )

    @staticmethod
    def _validate_employee_exists(
        db: Session,
        employee_code: str,
        error_detail: str,
    ) -> None:
        CheckpointAssignmentCallService._ensure_exists(
            db=db,
            column=Employees.employee_code,
            value=employee_code,
            error_detail=error_detail,
        )

    @staticmethod
    def _validate_created_by(
        db: Session,
        created_by: str,
    ) -> None:
        CheckpointAssignmentCallService._validate_employee_exists(
            db=db,
            employee_code=created_by,
            error_detail=CREATED_BY_EMPLOYEE_NOT_FOUND_DETAIL,
        )

    @staticmethod
    def _validate_updated_by(
        db: Session,
        updated_by: str,
    ) -> None:
        CheckpointAssignmentCallService._validate_employee_exists(
            db=db,
            employee_code=updated_by,
            error_detail=UPDATED_BY_EMPLOYEE_NOT_FOUND_DETAIL,
        )

    @staticmethod
    def _get_active_checkpoint_assignment(
        db: Session,
        assignment_id: int,
    ) -> CheckpointAssignment:
        stmt = select(CheckpointAssignment).where(
            CheckpointAssignment.assignment_id == assignment_id,
            CheckpointAssignment.mark_flag.is_(False),
        )

        checkpoint_assignment = db.scalar(stmt)

        if checkpoint_assignment is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=CHECKPOINT_ASSIGNMENT_NOT_FOUND_DETAIL,
            )

        if checkpoint_assignment.is_active is False:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=INACTIVE_CHECKPOINT_ASSIGNMENT_DETAIL,
            )

        return checkpoint_assignment

    @staticmethod
    def _validate_active_checkpoint_assignment(
        db: Session,
        assignment_id: int,
    ) -> None:
        CheckpointAssignmentCallService._get_active_checkpoint_assignment(
            db=db,
            assignment_id=assignment_id,
        )

    @staticmethod
    def _normalize_call_status(value: Any) -> int | None:
        try:
            numeric_value = int(value)
        except (TypeError, ValueError):
            return None

        if numeric_value in (1, 2, 3):
            return numeric_value

        return None

    @staticmethod
    def _set_if_model_has_attr(
        model_obj: Any,
        field_name: str,
        value: Any,
    ) -> None:
        if hasattr(model_obj, field_name):
            setattr(model_obj, field_name, value)

    @staticmethod
    def _apply_call_status_to_assignment(
        checkpoint_assignment: CheckpointAssignment,
        call_status: Any,
        employee_code: str,
        now: datetime,
    ) -> None:
        """
        กติกาบันทึกการโทร:

        call_status = 1
        - ปกติ ไม่ต้องเข้าหน้างาน
        - ปิดงานทันทีเป็น completed

        call_status = 2
        - ผิดปกติ ไม่ต้องเข้าหน้างาน
        - ปิดงานทันทีเป็น completed

        call_status = 3
        - ผิดปกติ ต้องเข้าหน้างาน
        - ไม่ปิดงาน
        - ให้ยังคง pending / in_progress เพื่อเข้าตรวจต่อ
        """
        normalized_call_status = (
            CheckpointAssignmentCallService._normalize_call_status(call_status)
        )

        CheckpointAssignmentCallService._set_if_model_has_attr(
            checkpoint_assignment,
            "updated_by",
            employee_code,
        )
        CheckpointAssignmentCallService._set_if_model_has_attr(
            checkpoint_assignment,
            "updated_at",
            now,
        )

        if normalized_call_status in (1, 2):
            checkpoint_assignment.assignment_status = "completed"

            CheckpointAssignmentCallService._set_if_model_has_attr(
                checkpoint_assignment,
                "completed_at",
                now,
            )
            CheckpointAssignmentCallService._set_if_model_has_attr(
                checkpoint_assignment,
                "completed_by",
                employee_code,
            )

        if normalized_call_status == 3:
            # ห้ามปิดงาน
            # ให้คงสถานะเดิม เช่น pending หรือ in_progress
            return

    @staticmethod
    def get_checkpoint_assignment_call(
        db: Session,
        assignment_call_id: int,
        include_deleted: bool = False,
    ) -> CheckpointAssignmentCall:
        stmt = select(CheckpointAssignmentCall).where(
            CheckpointAssignmentCall.assignment_call_id == assignment_call_id
        )

        if not include_deleted:
            stmt = stmt.where(CheckpointAssignmentCall.mark_flag.is_(False))

        checkpoint_assignment_call = db.scalar(stmt)

        if checkpoint_assignment_call is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=CHECKPOINT_ASSIGNMENT_CALL_NOT_FOUND_DETAIL,
            )

        return checkpoint_assignment_call

    @staticmethod
    def get_checkpoint_assignment_calls(
        db: Session,
        skip: int = DBConstants.DEFAULT_PAGE_SKIP,
        limit: int = DBConstants.DEFAULT_PAGE_LIMIT,
        assignment_id: int | None = None,
        is_active: bool | None = None,
        include_deleted: bool = False,
    ) -> list[CheckpointAssignmentCall]:
        stmt = select(CheckpointAssignmentCall)

        if not include_deleted:
            stmt = stmt.where(CheckpointAssignmentCall.mark_flag.is_(False))

        if assignment_id is not None:
            stmt = stmt.where(
                CheckpointAssignmentCall.assignment_id == assignment_id
            )

        if is_active is not None:
            stmt = stmt.where(CheckpointAssignmentCall.is_active.is_(is_active))

        stmt = (
            stmt.order_by(
                CheckpointAssignmentCall.assignment_id.asc(),
                CheckpointAssignmentCall.call_datetime.desc(),
                CheckpointAssignmentCall.assignment_call_id.desc(),
            )
            .offset(skip)
            .limit(limit)
        )

        return list(db.scalars(stmt).all())

    @staticmethod
    def create_checkpoint_assignment_call(
        db: Session,
        payload: CheckpointAssignmentCallCreate,
    ) -> CheckpointAssignmentCall:
        CheckpointAssignmentCallService._validate_created_by(
            db=db,
            created_by=payload.created_by,
        )

        checkpoint_assignment = (
            CheckpointAssignmentCallService._get_active_checkpoint_assignment(
                db=db,
                assignment_id=payload.assignment_id,
            )
        )

        now = datetime.now()
        create_data = payload.model_dump(exclude_none=True)

        # กันกรณี frontend ไม่ได้ส่ง call_datetime
        # ถ้า DB มี NOT NULL และไม่มี DEFAULT จะไม่พังตอน commit
        create_data.setdefault("call_datetime", now)

        # กันกรณี column updated_by ใน DB เป็น NOT NULL
        # ตอนสร้างครั้งแรกให้ใช้คนเดียวกับ created_by
        create_data.setdefault("updated_by", payload.created_by)

        # อนุญาตให้ assignment_id เดิมบันทึกการโทรได้หลายครั้ง
        # 1 assignment_id = หลาย call log
        checkpoint_assignment_call = CheckpointAssignmentCall(**create_data)

        db.add(checkpoint_assignment_call)

        # สำคัญ:
        # call_status 1, 2 = ไม่ต้องเข้าหน้างาน ให้ปิดงานทันที
        # call_status 3 = ต้องเข้าหน้างาน ไม่ปิดงาน
        CheckpointAssignmentCallService._apply_call_status_to_assignment(
            checkpoint_assignment=checkpoint_assignment,
            call_status=payload.call_status,
            employee_code=payload.created_by,
            now=now,
        )

        CheckpointAssignmentCallService._commit(
            db=db,
            refresh_obj=checkpoint_assignment_call,
        )

        return checkpoint_assignment_call

    @staticmethod
    def update_checkpoint_assignment_call(
        db: Session,
        assignment_call_id: int,
        payload: CheckpointAssignmentCallUpdate,
    ) -> CheckpointAssignmentCall:
        CheckpointAssignmentCallService._validate_updated_by(
            db=db,
            updated_by=payload.updated_by,
        )

        checkpoint_assignment_call = (
            CheckpointAssignmentCallService.get_checkpoint_assignment_call(
                db=db,
                assignment_call_id=assignment_call_id,
            )
        )

        update_data = payload.model_dump(
            exclude_unset=True,
            exclude={"updated_by"},
        )

        if not update_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=INVALID_CHECKPOINT_ASSIGNMENT_CALL_UPDATE_DETAIL,
            )

        next_assignment_id = update_data.get(
            "assignment_id",
            checkpoint_assignment_call.assignment_id,
        )

        checkpoint_assignment = (
            CheckpointAssignmentCallService._get_active_checkpoint_assignment(
                db=db,
                assignment_id=next_assignment_id,
            )
        )

        for field, value in update_data.items():
            setattr(checkpoint_assignment_call, field, value)

        checkpoint_assignment_call.updated_by = payload.updated_by

        next_call_status = update_data.get(
            "call_status",
            checkpoint_assignment_call.call_status,
        )

        now = datetime.now()

        # ถ้าแก้ call_status เป็น 1 หรือ 2 ให้ปิดงาน
        # ถ้าเป็น 3 ไม่ปิดงาน
        CheckpointAssignmentCallService._apply_call_status_to_assignment(
            checkpoint_assignment=checkpoint_assignment,
            call_status=next_call_status,
            employee_code=payload.updated_by,
            now=now,
        )

        CheckpointAssignmentCallService._commit(
            db=db,
            refresh_obj=checkpoint_assignment_call,
        )

        return checkpoint_assignment_call

    @staticmethod
    def delete_checkpoint_assignment_call(
        db: Session,
        assignment_call_id: int,
        updated_by: str,
    ) -> None:
        CheckpointAssignmentCallService._validate_updated_by(
            db=db,
            updated_by=updated_by,
        )

        checkpoint_assignment_call = (
            CheckpointAssignmentCallService.get_checkpoint_assignment_call(
                db=db,
                assignment_call_id=assignment_call_id,
            )
        )

        checkpoint_assignment_call.updated_by = updated_by
        checkpoint_assignment_call.mark_flag = True

        CheckpointAssignmentCallService._commit(db=db)

    @staticmethod
    def deactivate_checkpoint_assignment_call(
        db: Session,
        assignment_call_id: int,
        updated_by: str,
    ) -> CheckpointAssignmentCall:
        CheckpointAssignmentCallService._validate_updated_by(
            db=db,
            updated_by=updated_by,
        )

        checkpoint_assignment_call = (
            CheckpointAssignmentCallService.get_checkpoint_assignment_call(
                db=db,
                assignment_call_id=assignment_call_id,
            )
        )

        if checkpoint_assignment_call.is_active is False:
            return checkpoint_assignment_call

        checkpoint_assignment_call.updated_by = updated_by
        checkpoint_assignment_call.is_active = False

        CheckpointAssignmentCallService._commit(
            db=db,
            refresh_obj=checkpoint_assignment_call,
        )

        return checkpoint_assignment_call