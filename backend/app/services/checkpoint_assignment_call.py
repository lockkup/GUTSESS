# app/services/checkpoint_assignment_call.py

from __future__ import annotations

import shutil
from datetime import datetime
from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi import HTTPException, status
from sqlalchemy import exists, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

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
from app.models import (
    CheckpointAssignment,
    CheckpointAssignmentCall,
    Employees,
)
from app.models.time_record_image import TimeRecordImage
from app.schemas.checkpoint_assignment_call import (
    CheckpointAssignmentCallCreate,
    CheckpointAssignmentCallUpdate,
)
from app.services.image_storage import (
    ImageStorageError,
    ImageStorageService,
)


class CheckpointAssignmentCallService:
    MAX_RECORD_CALL_IMAGES = DBConstants.CHECKPOINT_CALL_MAX_IMAGES

    # ============================================================
    # Database error helpers
    # ============================================================

    @staticmethod
    def _get_integrity_error_message(
        exc: IntegrityError,
    ) -> str:
        """
        ใช้ดู error จริงจาก MySQL ตอน db.commit() ไม่ผ่าน

        ตัวอย่าง error ที่อาจเจอ:
        - Column 'call_datetime' cannot be null
        - Column 'updated_by' cannot be null
        - Data truncated for column 'call_status'
        - Cannot add or update a child row:
          a foreign key constraint fails
        """

        origin_error = getattr(exc, "orig", None)

        if origin_error is not None:
            return str(origin_error)

        return str(exc)

    # ============================================================
    # Image cleanup
    # ============================================================

    @staticmethod
    def _cleanup_saved_images(
        image_paths: list[str],
    ) -> None:
        """
        ลบไฟล์รูปที่บันทึกไปแล้วกรณี transaction ล้มเหลว

        ไม่ให้ไฟล์ค้างอยู่ใน uploads/record_call/
        โดยไม่มีข้อมูลในฐานข้อมูล
        """

        if not image_paths:
            return

        try:
            ImageStorageService.delete_images(
                image_paths
            )

        except ImageStorageError as exc:
            # cleanup ล้มเหลวไม่ควรบดบัง error หลัก
            print(
                "CHECKPOINT_ASSIGNMENT_CALL IMAGE "
                "CLEANUP ERROR:",
                str(exc),
            )

    # ============================================================
    # Flush
    # ============================================================

    @staticmethod
    def _flush(
        db: Session,
    ) -> None:
        """
        ใช้ flush เพื่อให้ได้ assignment_call_id
        ก่อน commit transaction

        จำเป็นสำหรับการสร้าง path รูป:

        /uploads/record_call/
        YYYY/MM/employee_code/assignment_call_id/
        """

        try:
            db.flush()

        except IntegrityError as exc:
            db.rollback()

            db_error_message = (
                CheckpointAssignmentCallService
                ._get_integrity_error_message(exc)
            )

            print(
                "CHECKPOINT_ASSIGNMENT_CALL "
                "INTEGRITY ERROR:",
                db_error_message,
            )

            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"{INVALID_REFERENCE_DETAIL}: "
                    f"{db_error_message}"
                ),
            ) from exc

    # ============================================================
    # Commit
    # ============================================================

    @staticmethod
    def _commit(
        db: Session,
        refresh_obj: Any | None = None,
        cleanup_image_paths: list[str] | None = None,
    ) -> None:
        try:
            db.commit()

            if refresh_obj is not None:
                db.refresh(refresh_obj)

        except IntegrityError as exc:
            db.rollback()

            if cleanup_image_paths:
                (
                    CheckpointAssignmentCallService
                    ._cleanup_saved_images(
                        cleanup_image_paths
                    )
                )

            db_error_message = (
                CheckpointAssignmentCallService
                ._get_integrity_error_message(exc)
            )

            # แสดง error จริงที่ terminal uvicorn
            print(
                "CHECKPOINT_ASSIGNMENT_CALL "
                "INTEGRITY ERROR:",
                db_error_message,
            )

            # ช่วง debug ให้ frontend เห็น error จริง
            # ถ้าระบบนิ่งแล้ว ค่อยเปลี่ยนกลับเป็น
            # detail=INVALID_REFERENCE_DETAIL
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"{INVALID_REFERENCE_DETAIL}: "
                    f"{db_error_message}"
                ),
            ) from exc

    # ============================================================
    # Generic existence validation
    # ============================================================

    @staticmethod
    def _ensure_exists(
        db: Session,
        column: Any,
        value: Any,
        error_detail: str,
    ) -> None:
        stmt = select(
            exists().where(column == value)
        )

        if not db.scalar(stmt):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=error_detail,
            )

    # ============================================================
    # Employee validation
    # ============================================================

    @staticmethod
    def _validate_employee_exists(
        db: Session,
        employee_code: str,
        error_detail: str,
    ) -> None:
        (
            CheckpointAssignmentCallService
            ._ensure_exists(
                db=db,
                column=Employees.employee_code,
                value=employee_code,
                error_detail=error_detail,
            )
        )

    @staticmethod
    def _validate_created_by(
        db: Session,
        created_by: str,
    ) -> None:
        (
            CheckpointAssignmentCallService
            ._validate_employee_exists(
                db=db,
                employee_code=created_by,
                error_detail=(
                    CREATED_BY_EMPLOYEE_NOT_FOUND_DETAIL
                ),
            )
        )

    @staticmethod
    def _validate_updated_by(
        db: Session,
        updated_by: str,
    ) -> None:
        (
            CheckpointAssignmentCallService
            ._validate_employee_exists(
                db=db,
                employee_code=updated_by,
                error_detail=(
                    UPDATED_BY_EMPLOYEE_NOT_FOUND_DETAIL
                ),
            )
        )

    # ============================================================
    # Checkpoint assignment
    # ============================================================

    @staticmethod
    def _get_active_checkpoint_assignment(
        db: Session,
        assignment_id: int,
    ) -> CheckpointAssignment:
        stmt = select(
            CheckpointAssignment
        ).where(
            CheckpointAssignment.assignment_id
            == assignment_id,
            CheckpointAssignment.mark_flag.is_(False),
        )

        checkpoint_assignment = db.scalar(stmt)

        if checkpoint_assignment is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=(
                    CHECKPOINT_ASSIGNMENT_NOT_FOUND_DETAIL
                ),
            )

        if checkpoint_assignment.is_active is False:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    INACTIVE_CHECKPOINT_ASSIGNMENT_DETAIL
                ),
            )

        return checkpoint_assignment

    @staticmethod
    def _validate_active_checkpoint_assignment(
        db: Session,
        assignment_id: int,
    ) -> None:
        (
            CheckpointAssignmentCallService
            ._get_active_checkpoint_assignment(
                db=db,
                assignment_id=assignment_id,
            )
        )

    # ============================================================
    # Call status
    # ============================================================

    @staticmethod
    def _normalize_call_status(
        value: Any,
    ) -> int | None:
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
            setattr(
                model_obj,
                field_name,
                value,
            )

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
        - ให้ยังคง pending / in_progress
          เพื่อเข้าตรวจต่อ
        """

        normalized_call_status = (
            CheckpointAssignmentCallService
            ._normalize_call_status(call_status)
        )

        (
            CheckpointAssignmentCallService
            ._set_if_model_has_attr(
                checkpoint_assignment,
                "updated_by",
                employee_code,
            )
        )

        (
            CheckpointAssignmentCallService
            ._set_if_model_has_attr(
                checkpoint_assignment,
                "updated_at",
                now,
            )
        )

        if normalized_call_status in (1, 2):
            checkpoint_assignment.assignment_status = (
                "completed"
            )

            (
                CheckpointAssignmentCallService
                ._set_if_model_has_attr(
                    checkpoint_assignment,
                    "completed_at",
                    now,
                )
            )

            (
                CheckpointAssignmentCallService
                ._set_if_model_has_attr(
                    checkpoint_assignment,
                    "completed_by",
                    employee_code,
                )
            )

        if normalized_call_status == 3:
            # ห้ามปิดงาน
            # ให้คงสถานะเดิม เช่น pending
            # หรือ in_progress
            return

    # ============================================================
    # Validate record call images
    # ============================================================

    @staticmethod
    def _validate_record_call_images(
        image_bytes_list: list[bytes],
    ) -> None:
        """
        ฝั่ง Frontend จำกัดไว้สูงสุด 3 รูปแล้ว
        แต่ Backend ต้องตรวจซ้ำอีกครั้ง
        """

        if (
            len(image_bytes_list)
            > CheckpointAssignmentCallService
            .MAX_RECORD_CALL_IMAGES
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"สามารถแนบรูปภาพได้สูงสุด "
                    f"{DBConstants.CHECKPOINT_CALL_MAX_IMAGES} รูป"
                ),
            )

        for image_bytes in image_bytes_list:
            if not image_bytes:
                raise HTTPException(
                    status_code=(
                        status.HTTP_400_BAD_REQUEST
                    ),
                    detail="พบไฟล์รูปภาพว่าง",
                )

    # ============================================================
    # Save record call images
    # ============================================================

    @staticmethod
    def _save_record_call_images(
        db: Session,
        *,
        checkpoint_assignment_call:
            CheckpointAssignmentCall,
        employee_code: str,
        image_bytes_list: list[bytes],
    ) -> list[str]:
        """
        บันทึกรูปลง:

        /uploads/record_call/
        YYYY/MM/employee_code/assignment_call_id/

        และสร้าง metadata ใน time_record_image
        """

        if not image_bytes_list:
            return []

        assignment_call_id = (
            checkpoint_assignment_call
            .assignment_call_id
        )

        if (
            assignment_call_id is None
            or assignment_call_id <= 0
        ):
            raise HTTPException(
                status_code=(
                    status.HTTP_400_BAD_REQUEST
                ),
                detail=(
                    "assignment_call_id "
                    "is required before saving images"
                ),
            )

        call_datetime = (
            checkpoint_assignment_call
            .call_datetime
        )

        if call_datetime is None:
            call_datetime = datetime.now()

        record_call_date = call_datetime.date()

        saved_image_paths: list[str] = []

        try:
            for sequence_no, image_bytes in enumerate(
                image_bytes_list,
                start=1,
            ):
                image_path = (
                    ImageStorageService
                    .save_checkpoint_call_image(
                        image_bytes=image_bytes,
                        work_date=record_call_date,
                        employee_code=employee_code,
                        assignment_call_id=(
                            assignment_call_id
                        ),
                        sequence_no=sequence_no,
                    )
                )

                saved_image_paths.append(
                    image_path
                )

                time_record_image = TimeRecordImage(
                    time_record_id=None,
                    work_report_item_id=None,
                    assignment_call_id=(
                        assignment_call_id
                    ),
                    image_type=DBConstants.CHECKPOINT_CALL_IMAGE_TYPE,
                    image_scope_id=0,
                    sequence_no=sequence_no,
                    image_path=image_path,
                    created_by=employee_code,
                )

                db.add(
                    time_record_image
                )

        except ImageStorageError as exc:
            db.rollback()

            (
                CheckpointAssignmentCallService
                ._cleanup_saved_images(
                    saved_image_paths
                )
            )

            raise HTTPException(
                status_code=(
                    status.HTTP_400_BAD_REQUEST
                ),
                detail=str(exc),
            ) from exc

        return saved_image_paths

    # ============================================================
    # Differential update - record call images
    # ============================================================

    @staticmethod
    def _get_record_call_images(
        checkpoint_assignment_call: CheckpointAssignmentCall,
    ) -> list[TimeRecordImage]:
        return sorted(
            [
                image
                for image in checkpoint_assignment_call.images
                if (
                    image.image_type
                    == DBConstants.CHECKPOINT_CALL_IMAGE_TYPE
                    and image.image_scope_id == 0
                )
            ],
            key=lambda image: (
                image.sequence_no,
                image.time_record_image_id,
            ),
        )

    @staticmethod
    def _validate_record_call_image_update(
        *,
        current_images: list[TimeRecordImage],
        image_ids: list[int | None],
        deleted_image_ids: list[int],
        image_bytes_list: list[bytes],
    ) -> None:
        (
            CheckpointAssignmentCallService
            ._validate_record_call_images(
                image_bytes_list
            )
        )

        if (
            len(image_ids)
            > CheckpointAssignmentCallService
            .MAX_RECORD_CALL_IMAGES
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "สามารถแนบรูปภาพได้สูงสุด "
                    f"{DBConstants.CHECKPOINT_CALL_MAX_IMAGES} รูป"
                ),
            )

        new_image_slots = sum(
            1
            for image_id in image_ids
            if image_id is None
        )

        if new_image_slots != len(image_bytes_list):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "จำนวนตำแหน่งรูปใหม่ใน image_ids "
                    "ไม่ตรงกับจำนวนไฟล์ images"
                ),
            )

        current_ids = {
            image.time_record_image_id
            for image in current_images
        }

        kept_ids = {
            image_id
            for image_id in image_ids
            if image_id is not None
        }

        deleted_ids = set(
            deleted_image_ids
        )

        if kept_ids & deleted_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "รูปภาพเดียวกันไม่สามารถอยู่ทั้ง "
                    "image_ids และ deleted_image_ids"
                ),
            )

        if not kept_ids.issubset(current_ids):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "พบ image_id ที่ไม่ได้อยู่ใน "
                    "บันทึกการโทรรายการนี้"
                ),
            )

        if not deleted_ids.issubset(current_ids):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "พบ deleted_image_id ที่ไม่ได้อยู่ใน "
                    "บันทึกการโทรรายการนี้"
                ),
            )

        expected_deleted_ids = (
            current_ids - kept_ids
        )

        if expected_deleted_ids != deleted_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "รายการรูปเดิมที่คงไว้และรายการรูปที่ลบ "
                    "ไม่ตรงกับข้อมูลรูปปัจจุบัน"
                ),
            )

    @staticmethod
    def _public_upload_path_from_absolute(
        absolute_path: Path,
    ) -> str:
        upload_root = (
            ImageStorageService
            .UPLOAD_ROOT
            .resolve()
        )

        resolved_path = absolute_path.resolve()

        try:
            relative_path = (
                resolved_path.relative_to(
                    upload_root
                )
            )
        except ValueError as exc:
            raise ImageStorageError(
                "Invalid upload image path"
            ) from exc

        return (
            f"{ImageStorageService.PUBLIC_UPLOAD_PREFIX}/"
            f"{relative_path.as_posix()}"
        )

    @staticmethod
    def _backup_record_call_images(
        current_images: list[TimeRecordImage],
        kept_image_ids: set[int],
    ) -> dict[int, tuple[Path, Path]]:
        """
        คืนค่า:
        {
            time_record_image_id:
                (original_path, backup_path)
        }

        รูปที่ยังต้องใช้งานต้องมีไฟล์จริง
        ส่วนรูปที่กำลังลบ ถ้าไฟล์จริงหายอยู่แล้ว
        ยังอนุญาตให้ลบ metadata ได้
        """

        backups: dict[int, tuple[Path, Path]] = {}

        try:
            for image in current_images:
                image_id = (
                    image.time_record_image_id
                )

                original_path = (
                    ImageStorageService
                    .resolve_image_path(
                        image.image_path
                    )
                )

                if not original_path.is_file():
                    if image_id in kept_image_ids:
                        raise ImageStorageError(
                            "Existing checkpoint call image file "
                            f"not found: {image.image_path}"
                        )

                    continue

                backup_path = (
                    original_path.with_name(
                        "."
                        f"{original_path.name}."
                        f"{uuid4().hex}.bak"
                    )
                )

                shutil.copy2(
                    original_path,
                    backup_path,
                )

                backups[image_id] = (
                    original_path,
                    backup_path,
                )

        except (OSError, ImageStorageError) as exc:
            for _, backup_path in backups.values():
                try:
                    if backup_path.is_file():
                        backup_path.unlink()
                except OSError:
                    pass

            if isinstance(exc, ImageStorageError):
                raise

            raise ImageStorageError(
                "Unable to backup existing checkpoint call images"
            ) from exc

        return backups

    @staticmethod
    def _delete_current_record_call_files(
        current_images: list[TimeRecordImage],
    ) -> None:
        try:
            for image in current_images:
                absolute_path = (
                    ImageStorageService
                    .resolve_image_path(
                        image.image_path
                    )
                )

                if absolute_path.is_file():
                    absolute_path.unlink()

        except (OSError, ImageStorageError) as exc:
            if isinstance(exc, ImageStorageError):
                raise

            raise ImageStorageError(
                "Unable to prepare existing checkpoint call images"
            ) from exc

    @staticmethod
    def _restore_record_call_image_files(
        backups: dict[int, tuple[Path, Path]],
        output_paths: list[Path],
    ) -> None:
        """
        ใช้เมื่อ DB transaction หรือการเขียนไฟล์ล้มเหลว

        1. ลบไฟล์ผลลัพธ์ที่สร้างระหว่าง update
        2. คืนไฟล์เดิมจาก backup
        """

        restore_errors: list[Exception] = []

        for output_path in {
            path.resolve()
            for path in output_paths
        }:
            try:
                if output_path.is_file():
                    output_path.unlink()
            except OSError as exc:
                restore_errors.append(exc)

        for original_path, backup_path in backups.values():
            try:
                original_path.parent.mkdir(
                    parents=True,
                    exist_ok=True,
                )

                if backup_path.is_file():
                    backup_path.replace(
                        original_path
                    )
            except OSError as exc:
                restore_errors.append(exc)

        if restore_errors:
            print(
                "CHECKPOINT_ASSIGNMENT_CALL "
                "IMAGE RESTORE ERROR:",
                str(restore_errors[0]),
            )

    @staticmethod
    def _cleanup_record_call_image_backups(
        backups: dict[int, tuple[Path, Path]],
    ) -> None:
        for _, backup_path in backups.values():
            try:
                if backup_path.is_file():
                    backup_path.unlink()
            except OSError as exc:
                print(
                    "CHECKPOINT_ASSIGNMENT_CALL "
                    "IMAGE BACKUP CLEANUP ERROR:",
                    str(exc),
                )

    @staticmethod
    def _copy_existing_record_call_image(
        *,
        source_backup_path: Path,
        original_path: Path,
        sequence_no: int,
    ) -> tuple[str, Path]:
        extension = original_path.suffix.lower()

        if not extension:
            raise ImageStorageError(
                "Existing checkpoint call image extension is invalid"
            )

        target_path = (
            original_path.with_name(
                f"{sequence_no:03d}{extension}"
            )
        )

        try:
            target_path.parent.mkdir(
                parents=True,
                exist_ok=True,
            )

            shutil.copy2(
                source_backup_path,
                target_path,
            )

        except OSError as exc:
            raise ImageStorageError(
                "Unable to restore existing checkpoint call image"
            ) from exc

        image_path = (
            CheckpointAssignmentCallService
            ._public_upload_path_from_absolute(
                target_path
            )
        )

        return image_path, target_path

    # ============================================================
    # Get one
    # ============================================================

    @staticmethod
    def get_checkpoint_assignment_call(
        db: Session,
        assignment_call_id: int,
        include_deleted: bool = False,
    ) -> CheckpointAssignmentCall:
        stmt = (
            select(
                CheckpointAssignmentCall
            )
            .options(
                selectinload(
                    CheckpointAssignmentCall.images
                )
            )
            .where(
                CheckpointAssignmentCall
                .assignment_call_id
                == assignment_call_id
            )
        )

        if not include_deleted:
            stmt = stmt.where(
                CheckpointAssignmentCall
                .mark_flag
                .is_(False)
            )

        checkpoint_assignment_call = (
            db.scalar(stmt)
        )

        if checkpoint_assignment_call is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=(
                    CHECKPOINT_ASSIGNMENT_CALL_NOT_FOUND_DETAIL
                ),
            )

        return checkpoint_assignment_call

    # ============================================================
    # Get list
    # ============================================================

    @staticmethod
    def get_checkpoint_assignment_calls(
        db: Session,
        skip: int = DBConstants.DEFAULT_PAGE_SKIP,
        limit: int = DBConstants.DEFAULT_PAGE_LIMIT,
        assignment_id: int | None = None,
        is_active: bool | None = None,
        include_deleted: bool = False,
    ) -> list[CheckpointAssignmentCall]:
        stmt = select(
            CheckpointAssignmentCall
        ).options(
            selectinload(
                CheckpointAssignmentCall.images
            )
        )

        if not include_deleted:
            stmt = stmt.where(
                CheckpointAssignmentCall
                .mark_flag
                .is_(False)
            )

        if assignment_id is not None:
            stmt = stmt.where(
                CheckpointAssignmentCall
                .assignment_id
                == assignment_id
            )

        if is_active is not None:
            stmt = stmt.where(
                CheckpointAssignmentCall
                .is_active
                .is_(is_active)
            )

        stmt = (
            stmt
            .order_by(
                CheckpointAssignmentCall
                .assignment_id
                .asc(),
                CheckpointAssignmentCall
                .call_datetime
                .desc(),
                CheckpointAssignmentCall
                .assignment_call_id
                .desc(),
            )
            .offset(skip)
            .limit(limit)
        )

        return list(
            db.scalars(stmt).all()
        )

    # ============================================================
    # Create
    # ============================================================

    @staticmethod
    def create_checkpoint_assignment_call(
        db: Session,
        payload: CheckpointAssignmentCallCreate,
        image_bytes_list: list[bytes] | None = None,
    ) -> CheckpointAssignmentCall:
        """
        สร้างบันทึกการโทรพร้อมรูปภาพ

        Flow:

        1. Validate ผู้บันทึก
        2. Validate Assignment
        3. สร้าง checkpoint_assignment_call
        4. flush เพื่อให้ได้ assignment_call_id
        5. บันทึกรูปลง /uploads/record_call/
        6. เพิ่ม metadata ลง time_record_image
        7. Update checkpoint_assignment ตาม call_status
        8. commit transaction
        """

        images = (
            image_bytes_list
            if image_bytes_list is not None
            else []
        )

        (
            CheckpointAssignmentCallService
            ._validate_record_call_images(
                images
            )
        )

        (
            CheckpointAssignmentCallService
            ._validate_created_by(
                db=db,
                created_by=payload.created_by,
            )
        )

        checkpoint_assignment = (
            CheckpointAssignmentCallService
            ._get_active_checkpoint_assignment(
                db=db,
                assignment_id=(
                    payload.assignment_id
                ),
            )
        )

        now = datetime.now()

        create_data = payload.model_dump(
            exclude_none=True
        )

        # กันกรณี frontend ไม่ได้ส่ง
        # call_datetime
        create_data.setdefault(
            "call_datetime",
            now,
        )

        # กันกรณี column updated_by ใน DB
        # เป็น NOT NULL
        # ตอนสร้างครั้งแรกให้ใช้คนเดียวกับ
        # created_by
        create_data.setdefault(
            "updated_by",
            payload.created_by,
        )

        checkpoint_assignment_call = (
            CheckpointAssignmentCall(
                **create_data
            )
        )

        db.add(
            checkpoint_assignment_call
        )

        # --------------------------------------------------------
        # Flush ก่อน เพื่อให้ MySQL สร้าง
        # assignment_call_id
        #
        # ยังไม่ commit
        # --------------------------------------------------------

        (
            CheckpointAssignmentCallService
            ._flush(db)
        )

        saved_image_paths: list[str] = []

        try:
            # ----------------------------------------------------
            # บันทึกรูป
            # ----------------------------------------------------

            saved_image_paths = (
                CheckpointAssignmentCallService
                ._save_record_call_images(
                    db=db,
                    checkpoint_assignment_call=(
                        checkpoint_assignment_call
                    ),
                    employee_code=(
                        payload.created_by
                    ),
                    image_bytes_list=images,
                )
            )

            # ----------------------------------------------------
            # call_status
            #
            # 1, 2 = ไม่ต้องเข้าหน้างาน
            #        ปิดงานทันที
            #
            # 3    = ต้องเข้าหน้างาน
            #        ไม่ปิดงาน
            # ----------------------------------------------------

            (
                CheckpointAssignmentCallService
                ._apply_call_status_to_assignment(
                    checkpoint_assignment=(
                        checkpoint_assignment
                    ),
                    call_status=(
                        payload.call_status
                    ),
                    employee_code=(
                        payload.created_by
                    ),
                    now=now,
                )
            )

            # ----------------------------------------------------
            # Commit ทั้ง Call + Image metadata
            # + Assignment status พร้อมกัน
            # ----------------------------------------------------

            (
                CheckpointAssignmentCallService
                ._commit(
                    db=db,
                    cleanup_image_paths=(
                        saved_image_paths
                    ),
                )
            )

        except HTTPException:
            # _save_record_call_images()
            # rollback และ cleanup แล้ว
            raise

        except Exception:
            db.rollback()

            (
                CheckpointAssignmentCallService
                ._cleanup_saved_images(
                    saved_image_paths
                )
            )

            raise

        # Query ใหม่เพื่อ preload images
        # สำหรับ Response schema
        return (
            CheckpointAssignmentCallService
            .get_checkpoint_assignment_call(
                db=db,
                assignment_call_id=(
                    checkpoint_assignment_call
                    .assignment_call_id
                ),
            )
        )

    # ============================================================
    # Update
    # ============================================================

    @staticmethod
    def update_checkpoint_assignment_call(
        db: Session,
        assignment_call_id: int,
        payload: CheckpointAssignmentCallUpdate,
        image_ids: list[int | None] | None = None,
        deleted_image_ids: list[int] | None = None,
        image_bytes_list: list[bytes] | None = None,
    ) -> CheckpointAssignmentCall:
        """
        แก้ไขบันทึกการโทรเดิมแบบ Differential Update

        image_ids:
        - รหัสรูปเดิมที่ยังคงอยู่
        - null คือตำแหน่งของรูปใหม่

        deleted_image_ids:
        - รหัสรูปเดิมที่ถูกลบหรือถูกเปลี่ยนออก

        image_bytes_list:
        - ส่งเฉพาะไฟล์ใหม่
        """

        final_image_ids = (
            image_ids
            if image_ids is not None
            else []
        )

        deleted_ids = (
            deleted_image_ids
            if deleted_image_ids is not None
            else []
        )

        new_images = (
            image_bytes_list
            if image_bytes_list is not None
            else []
        )

        (
            CheckpointAssignmentCallService
            ._validate_updated_by(
                db=db,
                updated_by=payload.updated_by,
            )
        )

        checkpoint_assignment_call = (
            CheckpointAssignmentCallService
            .get_checkpoint_assignment_call(
                db=db,
                assignment_call_id=(
                    assignment_call_id
                ),
            )
        )

        current_images = (
            CheckpointAssignmentCallService
            ._get_record_call_images(
                checkpoint_assignment_call
            )
        )

        (
            CheckpointAssignmentCallService
            ._validate_record_call_image_update(
                current_images=current_images,
                image_ids=final_image_ids,
                deleted_image_ids=deleted_ids,
                image_bytes_list=new_images,
            )
        )

        update_data = payload.model_dump(
            exclude_unset=True,
            exclude_none=True,
            exclude={"updated_by"},
        )

        # อนุญาตให้ล้างรายละเอียดการโทร (call_note) เป็น NULL
        # แต่ยังคงตัด None ของ field อื่น เช่น call_datetime
        # เพื่อไม่ให้ชนกับ column NOT NULL ในฐานข้อมูล
        if (
            "call_note" in payload.model_fields_set
            and payload.call_note is None
        ):
            update_data["call_note"] = None

        has_image_update = (
            bool(current_images)
            or bool(final_image_ids)
            or bool(deleted_ids)
            or bool(new_images)
        )

        if (
            not update_data
            and not has_image_update
        ):
            raise HTTPException(
                status_code=(
                    status.HTTP_400_BAD_REQUEST
                ),
                detail=(
                    INVALID_CHECKPOINT_ASSIGNMENT_CALL_UPDATE_DETAIL
                ),
            )

        next_assignment_id = (
            update_data.get(
                "assignment_id",
                checkpoint_assignment_call
                .assignment_id,
            )
        )

        checkpoint_assignment = (
            CheckpointAssignmentCallService
            ._get_active_checkpoint_assignment(
                db=db,
                assignment_id=(
                    next_assignment_id
                ),
            )
        )

        for field, value in (
            update_data.items()
        ):
            setattr(
                checkpoint_assignment_call,
                field,
                value,
            )

        checkpoint_assignment_call.updated_by = (
            payload.updated_by
        )

        next_call_status = (
            update_data.get(
                "call_status",
                checkpoint_assignment_call
                .call_status,
            )
        )

        current_by_id = {
            image.time_record_image_id: image
            for image in current_images
        }

        kept_image_ids = {
            image_id
            for image_id in final_image_ids
            if image_id is not None
        }

        backups: dict[
            int,
            tuple[Path, Path],
        ] = {}

        output_paths: list[Path] = []

        now = datetime.now()

        try:
            # ----------------------------------------------------
            # สำรองไฟล์เดิมก่อนแก้ไข
            # ----------------------------------------------------

            backups = (
                CheckpointAssignmentCallService
                ._backup_record_call_images(
                    current_images=current_images,
                    kept_image_ids=kept_image_ids,
                )
            )

            # ----------------------------------------------------
            # ย้าย sequence_no ใน DB ไปช่วงชั่วคราว
            # กัน Unique Constraint ชนตอนสลับลำดับ
            # ----------------------------------------------------

            for temp_index, image in enumerate(
                current_images,
                start=1,
            ):
                image.sequence_no = (
                    1000 + temp_index
                )

            db.flush()

            # ----------------------------------------------------
            # ลบ metadata ของรูปที่ไม่อยู่ในผลลัพธ์สุดท้าย
            # ----------------------------------------------------

            for image_id in deleted_ids:
                image = current_by_id[
                    image_id
                ]

                db.delete(
                    image
                )

            # ----------------------------------------------------
            # ลบไฟล์เดิมออกจากตำแหน่งจริงชั่วคราว
            #
            # เรามี backup แล้ว จึงสามารถสร้างไฟล์ใหม่ตาม
            # sequence_no สุดท้าย 001 / 002 / 003 ได้
            # ----------------------------------------------------

            (
                CheckpointAssignmentCallService
                ._delete_current_record_call_files(
                    current_images
                )
            )

            call_datetime = (
                checkpoint_assignment_call
                .call_datetime
            )

            if call_datetime is None:
                call_datetime = now

            record_call_date = (
                call_datetime.date()
            )

            new_image_iterator = iter(
                new_images
            )

            # ใช้ created_by ของ Call เป็น path หลัก
            # เพื่อให้รูปทั้งหมดของ Call เดียวกันอยู่โฟลเดอร์เดียวกัน
            storage_employee_code = (
                checkpoint_assignment_call
                .created_by
                or payload.updated_by
            )

            # ----------------------------------------------------
            # สร้างผลลัพธ์ตามลำดับที่ Frontend ส่งมา
            # ----------------------------------------------------

            for sequence_no, image_id in enumerate(
                final_image_ids,
                start=1,
            ):
                if image_id is not None:
                    image = current_by_id[
                        image_id
                    ]

                    backup_data = backups.get(
                        image_id
                    )

                    if backup_data is None:
                        raise ImageStorageError(
                            "Existing checkpoint call image "
                            "backup not found"
                        )

                    (
                        original_path,
                        backup_path,
                    ) = backup_data

                    (
                        image_path,
                        output_path,
                    ) = (
                        CheckpointAssignmentCallService
                        ._copy_existing_record_call_image(
                            source_backup_path=(
                                backup_path
                            ),
                            original_path=(
                                original_path
                            ),
                            sequence_no=(
                                sequence_no
                            ),
                        )
                    )

                    output_paths.append(
                        output_path
                    )

                    image.sequence_no = (
                        sequence_no
                    )

                    image.image_path = (
                        image_path
                    )

                    continue

                try:
                    image_bytes = next(
                        new_image_iterator
                    )
                except StopIteration as exc:
                    raise HTTPException(
                        status_code=(
                            status.HTTP_400_BAD_REQUEST
                        ),
                        detail=(
                            "จำนวนไฟล์รูปใหม่ไม่ตรงกับ "
                            "ตำแหน่งรูปใหม่"
                        ),
                    ) from exc

                image_path = (
                    ImageStorageService
                    .save_checkpoint_call_image(
                        image_bytes=image_bytes,
                        work_date=record_call_date,
                        employee_code=(
                            storage_employee_code
                        ),
                        assignment_call_id=(
                            assignment_call_id
                        ),
                        sequence_no=(
                            sequence_no
                        ),
                    )
                )

                output_path = (
                    ImageStorageService
                    .resolve_image_path(
                        image_path
                    )
                )

                output_paths.append(
                    output_path
                )

                db.add(
                    TimeRecordImage(
                        time_record_id=None,
                        work_report_item_id=None,
                        assignment_call_id=(
                            assignment_call_id
                        ),
                        image_type=(
                            DBConstants
                            .CHECKPOINT_CALL_IMAGE_TYPE
                        ),
                        image_scope_id=0,
                        sequence_no=(
                            sequence_no
                        ),
                        image_path=(
                            image_path
                        ),
                        created_by=(
                            payload.updated_by
                        ),
                    )
                )

            # ----------------------------------------------------
            # Update assignment ตาม call_status
            # ----------------------------------------------------

            (
                CheckpointAssignmentCallService
                ._apply_call_status_to_assignment(
                    checkpoint_assignment=(
                        checkpoint_assignment
                    ),
                    call_status=next_call_status,
                    employee_code=(
                        payload.updated_by
                    ),
                    now=now,
                )
            )

            # ----------------------------------------------------
            # Commit Call + Images + Assignment พร้อมกัน
            # ----------------------------------------------------

            db.commit()

        except IntegrityError as exc:
            db.rollback()

            (
                CheckpointAssignmentCallService
                ._restore_record_call_image_files(
                    backups=backups,
                    output_paths=output_paths,
                )
            )

            db_error_message = (
                CheckpointAssignmentCallService
                ._get_integrity_error_message(
                    exc
                )
            )

            print(
                "CHECKPOINT_ASSIGNMENT_CALL "
                "INTEGRITY ERROR:",
                db_error_message,
            )

            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"{INVALID_REFERENCE_DETAIL}: "
                    f"{db_error_message}"
                ),
            ) from exc

        except ImageStorageError as exc:
            db.rollback()

            (
                CheckpointAssignmentCallService
                ._restore_record_call_image_files(
                    backups=backups,
                    output_paths=output_paths,
                )
            )

            raise HTTPException(
                status_code=(
                    status.HTTP_400_BAD_REQUEST
                ),
                detail=str(exc),
            ) from exc

        except HTTPException:
            db.rollback()

            (
                CheckpointAssignmentCallService
                ._restore_record_call_image_files(
                    backups=backups,
                    output_paths=output_paths,
                )
            )

            raise

        except Exception:
            db.rollback()

            (
                CheckpointAssignmentCallService
                ._restore_record_call_image_files(
                    backups=backups,
                    output_paths=output_paths,
                )
            )

            raise

        else:
            (
                CheckpointAssignmentCallService
                ._cleanup_record_call_image_backups(
                    backups
                )
            )

        return (
            CheckpointAssignmentCallService
            .get_checkpoint_assignment_call(
                db=db,
                assignment_call_id=(
                    assignment_call_id
                ),
            )
        )

    # ============================================================
    # Soft delete
    # ============================================================

    @staticmethod
    def delete_checkpoint_assignment_call(
        db: Session,
        assignment_call_id: int,
        updated_by: str,
    ) -> None:
        (
            CheckpointAssignmentCallService
            ._validate_updated_by(
                db=db,
                updated_by=updated_by,
            )
        )

        checkpoint_assignment_call = (
            CheckpointAssignmentCallService
            .get_checkpoint_assignment_call(
                db=db,
                assignment_call_id=(
                    assignment_call_id
                ),
            )
        )

        checkpoint_assignment_call.updated_by = (
            updated_by
        )

        checkpoint_assignment_call.mark_flag = (
            True
        )

        (
            CheckpointAssignmentCallService
            ._commit(
                db=db
            )
        )

    # ============================================================
    # Deactivate
    # ============================================================

    @staticmethod
    def deactivate_checkpoint_assignment_call(
        db: Session,
        assignment_call_id: int,
        updated_by: str,
    ) -> CheckpointAssignmentCall:
        (
            CheckpointAssignmentCallService
            ._validate_updated_by(
                db=db,
                updated_by=updated_by,
            )
        )

        checkpoint_assignment_call = (
            CheckpointAssignmentCallService
            .get_checkpoint_assignment_call(
                db=db,
                assignment_call_id=(
                    assignment_call_id
                ),
            )
        )

        if (
            checkpoint_assignment_call
            .is_active
            is False
        ):
            return checkpoint_assignment_call

        checkpoint_assignment_call.updated_by = (
            updated_by
        )

        checkpoint_assignment_call.is_active = (
            False
        )

        (
            CheckpointAssignmentCallService
            ._commit(
                db=db,
                refresh_obj=(
                    checkpoint_assignment_call
                ),
            )
        )

        return (
            CheckpointAssignmentCallService
            .get_checkpoint_assignment_call(
                db=db,
                assignment_call_id=(
                    assignment_call_id
                ),
            )
        )
