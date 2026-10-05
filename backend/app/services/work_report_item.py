from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.constants import DBConstants
from app.core.error_messages import (
    CREATED_BY_EMPLOYEE_NOT_FOUND_DETAIL,
    INVALID_REFERENCE_DETAIL,
    UPDATED_BY_EMPLOYEE_NOT_FOUND_DETAIL,
    WORK_REPORT_ITEM_DETAIL_REQUIRED_DETAIL,
    WORK_REPORT_ITEM_NOT_FOUND_DETAIL,
    WORK_REPORT_ITEM_OTHER_REQUIRED_DETAIL,
    WORK_REPORT_ITEM_SEQUENCE_ALREADY_EXISTS_DETAIL,
    WORK_REPORT_ITEM_TYPE_NOT_FOUND_DETAIL,
    WORK_REPORT_NOT_FOUND_DETAIL,
)
from app.models.employees import Employees
from app.models.time_record import TimeRecord
from app.models.time_record_image import TimeRecordImage
from app.models.work_report import WorkReport
from app.models.work_report_item import WorkReportItem
from app.models.work_report_item_type import WorkReportItemType
from app.schemas.work_report_item import (
    WorkReportItemCreate,
    WorkReportItemUpdate,
)
from app.services.image_storage import ImageStorageError, ImageStorageService


MAX_WORK_REPORT_ITEM_IMAGES = 5


class WorkReportItemService:
    @staticmethod
    def _is_deleted_or_inactive(record: Any) -> bool:
        if bool(getattr(record, "mark_flag", False)):
            return True

        if getattr(record, "is_active", True) is False:
            return True

        return False

    @staticmethod
    def _raise_not_found(detail: str) -> None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=detail,
        )

    @staticmethod
    def _get_employee(
        db: Session,
        employee_code: str,
    ) -> Employees | None:
        stmt = select(Employees).where(
            Employees.employee_code == employee_code,
        )
        return db.scalar(stmt)

    @staticmethod
    def _ensure_employee_exists(
        db: Session,
        employee_code: str,
        detail: str,
    ) -> Employees:
        employee = WorkReportItemService._get_employee(
            db=db,
            employee_code=employee_code,
        )

        if employee is None or WorkReportItemService._is_deleted_or_inactive(
            employee
        ):
            WorkReportItemService._raise_not_found(detail)

        return employee

    @staticmethod
    def _get_work_report(
        db: Session,
        work_report_id: int,
    ) -> WorkReport | None:
        stmt = select(WorkReport).where(
            WorkReport.work_report_id == work_report_id,
        )
        return db.scalar(stmt)

    @staticmethod
    def _ensure_work_report_exists(
        db: Session,
        work_report_id: int,
    ) -> WorkReport:
        work_report = WorkReportItemService._get_work_report(
            db=db,
            work_report_id=work_report_id,
        )

        if work_report is None or WorkReportItemService._is_deleted_or_inactive(
            work_report
        ):
            WorkReportItemService._raise_not_found(
                WORK_REPORT_NOT_FOUND_DETAIL
            )

        return work_report

    @staticmethod
    def _get_time_record(
        db: Session,
        time_record_id: int,
    ) -> TimeRecord | None:
        stmt = select(TimeRecord).where(
            TimeRecord.time_record_id == time_record_id,
        )
        return db.scalar(stmt)

    @staticmethod
    def _get_work_report_item_images(
        db: Session,
        work_report_item_id: int,
    ) -> list[TimeRecordImage]:
        stmt = (
            select(TimeRecordImage)
            .where(
                TimeRecordImage.work_report_item_id
                == work_report_item_id,
                TimeRecordImage.image_type == "work_report",
            )
            .order_by(
                TimeRecordImage.sequence_no.asc(),
                TimeRecordImage.time_record_image_id.asc(),
            )
        )

        return list(db.scalars(stmt).all())

    @staticmethod
    def _cleanup_image_paths(
        image_paths: list[str],
    ) -> None:
        if not image_paths:
            return

        try:
            ImageStorageService.delete_images(image_paths)
        except ImageStorageError:
            # cleanup เป็น best effort ไม่ให้ error นี้กลบ error หลัก
            pass

    @staticmethod
    def _get_work_report_item_type(
        db: Session,
        work_item_type_id: int,
    ) -> WorkReportItemType | None:
        stmt = select(WorkReportItemType).where(
            WorkReportItemType.work_item_type_id == work_item_type_id,
        )
        return db.scalar(stmt)

    @staticmethod
    def _ensure_work_report_item_type_exists(
        db: Session,
        work_item_type_id: int,
    ) -> WorkReportItemType:
        work_report_item_type = (
            WorkReportItemService._get_work_report_item_type(
                db=db,
                work_item_type_id=work_item_type_id,
            )
        )

        if (
            work_report_item_type is None
            or WorkReportItemService._is_deleted_or_inactive(
                work_report_item_type
            )
        ):
            WorkReportItemService._raise_not_found(
                WORK_REPORT_ITEM_TYPE_NOT_FOUND_DETAIL
            )

        return work_report_item_type

    @staticmethod
    def _get_existing_work_report_item(
        db: Session,
        work_report_item_id: int,
        include_deleted: bool = False,
        for_update: bool = False,
    ) -> WorkReportItem:
        stmt = select(WorkReportItem).where(
            WorkReportItem.work_report_item_id == work_report_item_id,
        )

        if not include_deleted:
            stmt = stmt.where(
                WorkReportItem.mark_flag.is_(False),
            )

        if for_update:
            stmt = stmt.with_for_update()

        work_report_item = db.scalar(stmt)

        if work_report_item is None:
            WorkReportItemService._raise_not_found(
                WORK_REPORT_ITEM_NOT_FOUND_DETAIL
            )

        return work_report_item

    @staticmethod
    def _ensure_sequence_unique(
        db: Session,
        work_report_id: int,
        sequence_no: int,
        exclude_work_report_item_id: int | None = None,
    ) -> None:
        # ตรงกับ Generated Column active_sequence_no:
        # รายการที่ soft delete แล้วจะไม่ขวางการใช้ sequence_no เดิม
        stmt = select(WorkReportItem.work_report_item_id).where(
            WorkReportItem.work_report_id == work_report_id,
            WorkReportItem.sequence_no == sequence_no,
            WorkReportItem.mark_flag.is_(False),
        )

        if exclude_work_report_item_id is not None:
            stmt = stmt.where(
                WorkReportItem.work_report_item_id
                != exclude_work_report_item_id,
            )

        if db.scalar(stmt) is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=WORK_REPORT_ITEM_SEQUENCE_ALREADY_EXISTS_DETAIL,
            )

    @staticmethod
    def _validate_work_item_detail(
        work_report_item_type: WorkReportItemType,
        work_item_detail: str | None,
    ) -> None:
        if work_report_item_type.require_detail and (
            work_item_detail is None or not work_item_detail.strip()
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=WORK_REPORT_ITEM_DETAIL_REQUIRED_DETAIL,
            )

    @staticmethod
    def _normalize_work_item_other(
        work_report_item_type: WorkReportItemType,
        work_item_other: str | None,
    ) -> str | None:
        if work_report_item_type.work_item_code != "other":
            return None

        other_text = work_item_other.strip() if work_item_other else ""
        if not other_text:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=WORK_REPORT_ITEM_OTHER_REQUIRED_DETAIL,
            )

        return other_text

    @staticmethod
    def _commit_and_refresh(
        db: Session,
        instance: WorkReportItem,
    ) -> None:
        try:
            db.commit()
            db.refresh(instance)
        except IntegrityError as exc:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=INVALID_REFERENCE_DETAIL,
            ) from exc

    @staticmethod
    def create_work_report_item(
        db: Session,
        payload: WorkReportItemCreate,
    ) -> WorkReportItem:
        create_data = payload.model_dump()

        WorkReportItemService._ensure_employee_exists(
            db=db,
            employee_code=create_data["created_by"],
            detail=CREATED_BY_EMPLOYEE_NOT_FOUND_DETAIL,
        )

        WorkReportItemService._ensure_work_report_exists(
            db=db,
            work_report_id=create_data["work_report_id"],
        )

        work_report_item_type = (
            WorkReportItemService._ensure_work_report_item_type_exists(
                db=db,
                work_item_type_id=create_data["work_item_type_id"],
            )
        )

        WorkReportItemService._ensure_sequence_unique(
            db=db,
            work_report_id=create_data["work_report_id"],
            sequence_no=create_data["sequence_no"],
        )

        WorkReportItemService._validate_work_item_detail(
            work_report_item_type=work_report_item_type,
            work_item_detail=create_data.get("work_item_detail"),
        )

        create_data["work_item_other"] = (
            WorkReportItemService._normalize_work_item_other(
                work_report_item_type=work_report_item_type,
                work_item_other=create_data.get("work_item_other"),
            )
        )

        work_report_item = WorkReportItem(
            **create_data,
            mark_flag=False,
        )

        db.add(work_report_item)

        WorkReportItemService._commit_and_refresh(
            db=db,
            instance=work_report_item,
        )

        return work_report_item

    @staticmethod
    def get_work_report_item_by_id(
        db: Session,
        work_report_item_id: int,
        include_deleted: bool = False,
    ) -> WorkReportItem:
        return WorkReportItemService._get_existing_work_report_item(
            db=db,
            work_report_item_id=work_report_item_id,
            include_deleted=include_deleted,
        )

    @staticmethod
    def get_work_report_items(
        db: Session,
        skip: int = DBConstants.DEFAULT_PAGE_SKIP,
        limit: int = DBConstants.DEFAULT_PAGE_LIMIT,
        work_report_id: int | None = None,
        work_item_type_id: int | None = None,
        is_active: bool | None = None,
        include_deleted: bool = False,
    ) -> list[WorkReportItem]:
        stmt = select(WorkReportItem)

        if not include_deleted:
            stmt = stmt.where(
                WorkReportItem.mark_flag.is_(False),
            )

        if work_report_id is not None:
            stmt = stmt.where(
                WorkReportItem.work_report_id == work_report_id,
            )

        if work_item_type_id is not None:
            stmt = stmt.where(
                WorkReportItem.work_item_type_id == work_item_type_id,
            )

        if is_active is not None:
            stmt = stmt.where(
                WorkReportItem.is_active.is_(is_active),
            )

        stmt = (
            stmt.order_by(
                WorkReportItem.work_report_id.asc(),
                WorkReportItem.sequence_no.asc(),
                WorkReportItem.work_report_item_id.asc(),
            )
            .offset(skip)
            .limit(limit)
        )

        return list(db.scalars(stmt).all())

    @staticmethod
    def get_work_report_item_images(
        db: Session,
        work_report_item_id: int,
    ) -> list[TimeRecordImage]:
        WorkReportItemService._get_existing_work_report_item(
            db=db,
            work_report_item_id=work_report_item_id,
            include_deleted=False,
        )

        return WorkReportItemService._get_work_report_item_images(
            db=db,
            work_report_item_id=work_report_item_id,
        )

    @staticmethod
    def save_work_report_item_images(
        db: Session,
        work_report_item_id: int,
        image_base64_values: list[str],
        updated_by: str,
        image_ids: list[int | None] | None = None,
        deleted_image_ids: list[int] | None = None,
    ) -> list[TimeRecordImage]:
        """
        บันทึกรูปของ Work Report Item โดยไม่ลบ/สร้าง row ใหม่ทั้งหมดทุกครั้ง

        รองรับ 2 รูปแบบเพื่อไม่ให้ API เดิมพัง:

        1) Legacy mode
           - ไม่ส่ง image_ids
           - image_base64_values คือรูปสุดท้ายทั้งหมด เรียงตาม sequence 1..N
           - row เดิมที่ sequence ตรงกันจะถูก UPDATE path แทน DELETE + INSERT
           - row ที่เกินจำนวนรูปสุดท้ายจะถูกลบ

        2) Differential mode
           - ส่ง image_ids ให้ตำแหน่งตรงกับ image_base64_values
           - ค่าเป็น int  = รูปเดิม ให้คง row/ไฟล์เดิมไว้ ไม่ upload ซ้ำ
           - ค่าเป็น None = รูปใหม่ หรือรูปที่ใช้แทนรูปเดิม
           - deleted_image_ids ใช้ระบุรูปเดิมที่ผู้ใช้ลบ/เปลี่ยนออก
           - ถ้ารูปใหม่อยู่ตำแหน่งเดียวกับรูปเดิมที่ถูกเปลี่ยน จะ reuse row เดิม
             ทำให้ time_record_image_id และ sequence_no เดิมยังคงอยู่

        หมายเหตุ:
        - รองรับรูปสูงสุด MAX_WORK_REPORT_ITEM_IMAGES รูป
        - การลบไฟล์จริงทำหลัง DB commit สำเร็จเท่านั้น
        """
        if len(image_base64_values) > MAX_WORK_REPORT_ITEM_IMAGES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "work report item supports a maximum of "
                    f"{MAX_WORK_REPORT_ITEM_IMAGES} images"
                ),
            )

        if image_ids is not None and len(image_ids) != len(image_base64_values):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="image_ids must have the same length as image_base64_values",
            )

        work_report_item = (
            WorkReportItemService._get_existing_work_report_item(
                db=db,
                work_report_item_id=work_report_item_id,
                include_deleted=False,
                for_update=True,
            )
        )

        WorkReportItemService._ensure_employee_exists(
            db=db,
            employee_code=updated_by,
            detail=UPDATED_BY_EMPLOYEE_NOT_FOUND_DETAIL,
        )

        work_report = WorkReportItemService._ensure_work_report_exists(
            db=db,
            work_report_id=work_report_item.work_report_id,
        )

        time_record = WorkReportItemService._get_time_record(
            db=db,
            time_record_id=work_report.time_record_id,
        )

        if time_record is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=INVALID_REFERENCE_DETAIL,
            )

        old_images = WorkReportItemService._get_work_report_item_images(
            db=db,
            work_report_item_id=work_report_item_id,
        )
        old_by_id = {
            image.time_record_image_id: image
            for image in old_images
        }
        old_by_sequence = {
            image.sequence_no: image
            for image in old_images
        }
        old_image_paths = {
            image.image_path
            for image in old_images
            if image.image_path
        }

        saved_image_paths: list[str] = []
        cleanup_after_commit: set[str] = set()

        try:
            # ==============================================================
            # Differential mode: รูปเดิมที่ image_id ยังอยู่ จะไม่ upload ซ้ำ
            # ==============================================================
            if image_ids is not None:
                requested_existing_ids = [
                    image_id
                    for image_id in image_ids
                    if image_id is not None
                ]

                if len(requested_existing_ids) != len(
                    set(requested_existing_ids)
                ):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="duplicate image_id in work report item images",
                    )

                for image_id in requested_existing_ids:
                    if image_id not in old_by_id:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=INVALID_REFERENCE_DETAIL,
                        )

                deleted_ids = set(deleted_image_ids or [])

                for image_id in deleted_ids:
                    if image_id not in old_by_id:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=INVALID_REFERENCE_DETAIL,
                        )

                requested_existing_id_set = set(requested_existing_ids)

                if requested_existing_id_set & deleted_ids:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=(
                            "the same image cannot be kept and deleted "
                            "in one request"
                        ),
                    )

                # รูปเดิมที่ client ไม่ได้ส่งกลับมา ถือว่าไม่อยู่ในผลลัพธ์สุดท้าย
                # deleted_image_ids ช่วยบอกว่ารูปใดเป็นการลบ/เปลี่ยนโดยตั้งใจ
                omitted_old_ids = set(old_by_id) - requested_existing_id_set
                removed_or_replaced_ids = omitted_old_ids | deleted_ids

                # รูปเดิมที่ยังอยู่: ไม่แตะไฟล์ ไม่เปลี่ยน row และไม่ upload ซ้ำ
                active_image_ids = set(requested_existing_id_set)
                used_sequences = {
                    old_by_id[image_id].sequence_no
                    for image_id in active_image_ids
                }

                # เก็บ candidate ที่ผู้ใช้กดเปลี่ยนไว้ตาม sequence เดิม
                replace_candidate_by_sequence = {
                    old_by_id[image_id].sequence_no: old_by_id[image_id]
                    for image_id in removed_or_replaced_ids
                    if image_id in old_by_id
                }
                reused_replacement_ids: set[int] = set()
                deleted_db_ids: set[int] = set()

                # ลบ row ที่แน่ชัดว่าไม่ได้ถูกใช้ต่อก่อน เพื่อเคลียร์ unique sequence
                # แต่ยังไม่ลบ candidate ที่อาจ reuse เป็นรูปแทนใน sequence เดิม
                for old_image in old_images:
                    image_id = old_image.time_record_image_id

                    if image_id in active_image_ids:
                        continue

                    if old_image.sequence_no in range(
                        1,
                        len(image_ids) + 1,
                    ):
                        continue

                    db.delete(old_image)
                    deleted_db_ids.add(image_id)

                    if old_image.image_path:
                        cleanup_after_commit.add(old_image.image_path)

                db.flush()

                for slot_index, (image_id, image_value) in enumerate(
                    zip(image_ids, image_base64_values),
                    start=1,
                ):
                    # รูปเดิม: คง row และ path เดิมทั้งหมด
                    if image_id is not None:
                        continue

                    image_base64 = (image_value or "").strip()

                    # None + ไม่มีข้อมูลรูป = ช่องว่าง ไม่ต้องสร้างรูป
                    if not image_base64:
                        continue

                    # ถ้าตำแหน่งนี้เดิมมีรูปที่ถูกลบ/เปลี่ยน ให้ UPDATE row เดิม
                    replace_candidate = replace_candidate_by_sequence.get(
                        slot_index
                    )

                    if (
                        replace_candidate is not None
                        and replace_candidate.time_record_image_id
                        not in active_image_ids
                    ):
                        previous_path = replace_candidate.image_path

                        image_path = ImageStorageService.save_time_record_image(
                            image_base64=image_base64,
                            work_date=time_record.work_date,
                            employee_code=time_record.employee_code,
                            time_record_id=time_record.time_record_id,
                            image_type="work_report",
                            sequence_no=replace_candidate.sequence_no,
                            work_report_item_id=work_report_item_id,
                        )

                        saved_image_paths.append(image_path)
                        replace_candidate.image_path = image_path

                        reused_replacement_ids.add(
                            replace_candidate.time_record_image_id
                        )
                        active_image_ids.add(
                            replace_candidate.time_record_image_id
                        )
                        used_sequences.add(replace_candidate.sequence_no)

                        if (
                            previous_path
                            and previous_path != image_path
                        ):
                            cleanup_after_commit.add(previous_path)

                        continue

                    # รูปใหม่จริง ๆ: เลือก sequence ที่ว่าง
                    preferred_sequence = slot_index

                    if preferred_sequence not in used_sequences:
                        sequence_no = preferred_sequence
                    else:
                        sequence_no = next(
                            (
                                candidate_sequence
                                for candidate_sequence in range(
                                    1,
                                    MAX_WORK_REPORT_ITEM_IMAGES + 1,
                                )
                                if candidate_sequence not in used_sequences
                            ),
                            0,
                        )

                    if sequence_no == 0:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=(
                                "work report item supports a maximum of "
                                f"{MAX_WORK_REPORT_ITEM_IMAGES} images"
                            ),
                        )

                    # ถ้า sequence ที่จะใช้ยังมี row เก่าที่ไม่ได้ใช้งาน ให้ลบก่อน
                    sequence_owner = old_by_sequence.get(sequence_no)

                    if (
                        sequence_owner is not None
                        and sequence_owner.time_record_image_id
                        not in active_image_ids
                        and sequence_owner.time_record_image_id
                        not in reused_replacement_ids
                    ):
                        db.delete(sequence_owner)
                        deleted_db_ids.add(
                            sequence_owner.time_record_image_id
                        )

                        if sequence_owner.image_path:
                            cleanup_after_commit.add(
                                sequence_owner.image_path
                            )

                        db.flush()

                    image_path = ImageStorageService.save_time_record_image(
                        image_base64=image_base64,
                        work_date=time_record.work_date,
                        employee_code=time_record.employee_code,
                        time_record_id=time_record.time_record_id,
                        image_type="work_report",
                        sequence_no=sequence_no,
                        work_report_item_id=work_report_item_id,
                    )

                    saved_image_paths.append(image_path)
                    used_sequences.add(sequence_no)

                    new_image = TimeRecordImage(
                        time_record_id=time_record.time_record_id,
                        work_report_item_id=work_report_item_id,
                        image_type="work_report",
                        image_scope_id=work_report_item_id,
                        sequence_no=sequence_no,
                        image_path=image_path,
                        created_by=updated_by,
                    )
                    db.add(new_image)

                # ลบ row เก่าที่ไม่ได้อยู่ในผลลัพธ์สุดท้าย และไม่ได้ reuse
                for old_image in old_images:
                    image_id = old_image.time_record_image_id

                    if image_id in active_image_ids:
                        continue

                    if image_id in reused_replacement_ids:
                        continue

                    if image_id in deleted_db_ids:
                        continue

                    db.delete(old_image)
                    deleted_db_ids.add(image_id)

                    if old_image.image_path:
                        cleanup_after_commit.add(old_image.image_path)

            # ==============================================================
            # Legacy mode: รองรับ endpoint เดิมที่ส่งรูปสุดท้ายทั้งหมดเป็น base64
            # ==============================================================
            else:
                cleaned_images = [
                    image_value.strip()
                    for image_value in image_base64_values
                    if image_value and image_value.strip()
                ]

                if len(cleaned_images) > MAX_WORK_REPORT_ITEM_IMAGES:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=(
                            "work report item supports a maximum of "
                            f"{MAX_WORK_REPORT_ITEM_IMAGES} images"
                        ),
                    )

                final_sequence_set = set(
                    range(1, len(cleaned_images) + 1)
                )

                # ลบเฉพาะ row ที่เกินจำนวนรูปสุดท้าย
                for old_image in old_images:
                    if old_image.sequence_no in final_sequence_set:
                        continue

                    db.delete(old_image)

                    if old_image.image_path:
                        cleanup_after_commit.add(old_image.image_path)

                if old_images:
                    db.flush()

                for sequence_no, image_base64 in enumerate(
                    cleaned_images,
                    start=1,
                ):
                    existing_image = old_by_sequence.get(sequence_no)
                    previous_path = (
                        existing_image.image_path
                        if existing_image is not None
                        else None
                    )

                    image_path = ImageStorageService.save_time_record_image(
                        image_base64=image_base64,
                        work_date=time_record.work_date,
                        employee_code=time_record.employee_code,
                        time_record_id=time_record.time_record_id,
                        image_type="work_report",
                        sequence_no=sequence_no,
                        work_report_item_id=work_report_item_id,
                    )

                    saved_image_paths.append(image_path)

                    if existing_image is not None:
                        # สำคัญ: UPDATE row เดิม ไม่ DELETE + INSERT
                        # ทำให้ time_record_image_id / created_at เดิมยังอยู่
                        existing_image.image_path = image_path

                        if (
                            previous_path
                            and previous_path != image_path
                        ):
                            cleanup_after_commit.add(previous_path)
                    else:
                        db.add(
                            TimeRecordImage(
                                time_record_id=time_record.time_record_id,
                                work_report_item_id=work_report_item_id,
                                image_type="work_report",
                                image_scope_id=work_report_item_id,
                                sequence_no=sequence_no,
                                image_path=image_path,
                                created_by=updated_by,
                            )
                        )

            db.commit()

        except HTTPException:
            db.rollback()

            WorkReportItemService._cleanup_image_paths(
                [
                    path
                    for path in saved_image_paths
                    if path not in old_image_paths
                ]
            )

            raise

        except ImageStorageError as exc:
            db.rollback()

            # ลบเฉพาะไฟล์ใหม่ที่ไม่ใช่ path เดิม
            WorkReportItemService._cleanup_image_paths(
                [
                    path
                    for path in saved_image_paths
                    if path not in old_image_paths
                ]
            )

            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(exc),
            ) from exc

        except IntegrityError as exc:
            db.rollback()

            WorkReportItemService._cleanup_image_paths(
                [
                    path
                    for path in saved_image_paths
                    if path not in old_image_paths
                ]
            )

            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=INVALID_REFERENCE_DETAIL,
            ) from exc

        # ลบไฟล์เก่าหลัง DB commit สำเร็จเท่านั้น
        final_images = WorkReportItemService._get_work_report_item_images(
            db=db,
            work_report_item_id=work_report_item_id,
        )
        final_image_paths = {
            image.image_path
            for image in final_images
            if image.image_path
        }

        WorkReportItemService._cleanup_image_paths(
            [
                path
                for path in cleanup_after_commit
                if path not in final_image_paths
            ]
        )

        return final_images

    @staticmethod
    def update_work_report_item(
        db: Session,
        work_report_item_id: int,
        payload: WorkReportItemUpdate,
    ) -> WorkReportItem:
        work_report_item = (
            WorkReportItemService._get_existing_work_report_item(
                db=db,
                work_report_item_id=work_report_item_id,
                include_deleted=False,
                for_update=True,
            )
        )

        update_data = payload.model_dump(exclude_unset=True)

        WorkReportItemService._ensure_employee_exists(
            db=db,
            employee_code=update_data["updated_by"],
            detail=UPDATED_BY_EMPLOYEE_NOT_FOUND_DETAIL,
        )

        WorkReportItemService._ensure_work_report_exists(
            db=db,
            work_report_id=work_report_item.work_report_id,
        )

        new_sequence_no = update_data.get(
            "sequence_no",
            work_report_item.sequence_no,
        )

        if new_sequence_no != work_report_item.sequence_no:
            WorkReportItemService._ensure_sequence_unique(
                db=db,
                work_report_id=work_report_item.work_report_id,
                sequence_no=new_sequence_no,
                exclude_work_report_item_id=work_report_item_id,
            )

        if (
            "work_item_type_id" in update_data
            or "work_item_detail" in update_data
            or "work_item_other" in update_data
        ):
            new_work_item_type_id = update_data.get(
                "work_item_type_id",
                work_report_item.work_item_type_id,
            )

            if new_work_item_type_id != work_report_item.work_item_type_id:
                work_report_item_type = (
                    WorkReportItemService._ensure_work_report_item_type_exists(
                        db=db,
                        work_item_type_id=new_work_item_type_id,
                    )
                )
            else:
                work_report_item_type = (
                    WorkReportItemService._get_work_report_item_type(
                        db=db,
                        work_item_type_id=new_work_item_type_id,
                    )
                )

                if work_report_item_type is None:
                    WorkReportItemService._raise_not_found(
                        WORK_REPORT_ITEM_TYPE_NOT_FOUND_DETAIL
                    )

            new_work_item_detail = update_data.get(
                "work_item_detail",
                work_report_item.work_item_detail,
            )

            WorkReportItemService._validate_work_item_detail(
                work_report_item_type=work_report_item_type,
                work_item_detail=new_work_item_detail,
            )

            new_work_item_other = update_data.get(
                "work_item_other",
                work_report_item.work_item_other,
            )
            update_data["work_item_other"] = (
                WorkReportItemService._normalize_work_item_other(
                    work_report_item_type=work_report_item_type,
                    work_item_other=new_work_item_other,
                )
            )

        for field, value in update_data.items():
            setattr(work_report_item, field, value)

        WorkReportItemService._commit_and_refresh(
            db=db,
            instance=work_report_item,
        )

        return work_report_item

    @staticmethod
    def deactivate_work_report_item(
        db: Session,
        work_report_item_id: int,
        updated_by: str,
    ) -> WorkReportItem:
        work_report_item = (
            WorkReportItemService._get_existing_work_report_item(
                db=db,
                work_report_item_id=work_report_item_id,
                include_deleted=False,
                for_update=True,
            )
        )

        WorkReportItemService._ensure_employee_exists(
            db=db,
            employee_code=updated_by,
            detail=UPDATED_BY_EMPLOYEE_NOT_FOUND_DETAIL,
        )

        work_report_item.is_active = False
        work_report_item.updated_by = updated_by

        WorkReportItemService._commit_and_refresh(
            db=db,
            instance=work_report_item,
        )

        return work_report_item

    @staticmethod
    def activate_work_report_item(
        db: Session,
        work_report_item_id: int,
        updated_by: str,
    ) -> WorkReportItem:
        work_report_item = (
            WorkReportItemService._get_existing_work_report_item(
                db=db,
                work_report_item_id=work_report_item_id,
                include_deleted=False,
                for_update=True,
            )
        )

        WorkReportItemService._ensure_employee_exists(
            db=db,
            employee_code=updated_by,
            detail=UPDATED_BY_EMPLOYEE_NOT_FOUND_DETAIL,
        )

        work_report_item.is_active = True
        work_report_item.updated_by = updated_by

        WorkReportItemService._commit_and_refresh(
            db=db,
            instance=work_report_item,
        )

        return work_report_item

    @staticmethod
    def delete_work_report_item(
        db: Session,
        work_report_item_id: int,
        updated_by: str,
    ) -> WorkReportItem:
        work_report_item = (
            WorkReportItemService._get_existing_work_report_item(
                db=db,
                work_report_item_id=work_report_item_id,
                include_deleted=False,
                for_update=True,
            )
        )

        WorkReportItemService._ensure_employee_exists(
            db=db,
            employee_code=updated_by,
            detail=UPDATED_BY_EMPLOYEE_NOT_FOUND_DETAIL,
        )

        work_report_item.mark_flag = True
        work_report_item.is_active = False
        work_report_item.updated_by = updated_by

        WorkReportItemService._commit_and_refresh(
            db=db,
            instance=work_report_item,
        )

        return work_report_item
