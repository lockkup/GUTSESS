from datetime import date, datetime
from typing import Any
from zoneinfo import ZoneInfo

from fastapi import HTTPException, status
from sqlalchemy import and_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.core.constants import DBConstants
from app.core.error_messages import (
    CREATED_BY_EMPLOYEE_NOT_FOUND_DETAIL,
    INVALID_REFERENCE_DETAIL,
    SITE_LOCATION_NOT_FOUND_DETAIL,
    TIME_RECORD_NOT_FOUND_DETAIL,
    UPDATED_BY_EMPLOYEE_NOT_FOUND_DETAIL,
    WORK_REPORT_ALREADY_EXISTS_DETAIL,
    WORK_REPORT_NOT_FOUND_DETAIL,
    WORK_REPORT_PURPOSE_NOT_FOUND_DETAIL,
)
from app.models.employees import Employees
from app.models.site_location import SiteLocation
from app.models.time_record import TimeRecord
from app.models.work_report import WorkReport
from app.models.work_report_detail import WorkReportDetail
from app.models.work_report_item import WorkReportItem
from app.models.work_report_purpose import WorkReportPurpose
from app.models.work_report_purpose_selection import WorkReportPurposeSelection
from app.schemas.work_report import WorkReportCreate, WorkReportUpdate
from app.services.image_storage import ImageStorageError, ImageStorageService
from app.services.work_report_document_sequence import (
    WorkReportDocumentSequenceService,
)

BANGKOK_TIMEZONE = ZoneInfo("Asia/Bangkok")

class WorkReportService:
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
    def _active_purpose_selections_option():
        return selectinload(
            WorkReport.purpose_selections.and_(
                WorkReportPurposeSelection.mark_flag.is_(False),
                WorkReportPurposeSelection.is_active.is_(True),
            )
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
        employee = WorkReportService._get_employee(
            db=db,
            employee_code=employee_code,
        )

        if employee is None or WorkReportService._is_deleted_or_inactive(
            employee
        ):
            WorkReportService._raise_not_found(detail)

        return employee

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
    def _ensure_time_record_exists(
        db: Session,
        time_record_id: int,
    ) -> TimeRecord:
        time_record = WorkReportService._get_time_record(
            db=db,
            time_record_id=time_record_id,
        )

        if time_record is None:
            WorkReportService._raise_not_found(
                TIME_RECORD_NOT_FOUND_DETAIL
            )

        return time_record

    @staticmethod
    def _get_contract_code_for_time_record(
        db: Session,
        time_record: TimeRecord,
    ) -> str:
        location_id = (
            time_record.checkin_location_id
            or time_record.checkout_location_id
        )

        if location_id is None:
            WorkReportService._raise_not_found(
                SITE_LOCATION_NOT_FOUND_DETAIL
            )

        stmt = select(SiteLocation.contract_code).where(
            SiteLocation.location_id == location_id,
        )

        contract_code = db.scalar(stmt)

        if contract_code is None or not contract_code.strip():
            WorkReportService._raise_not_found(
                SITE_LOCATION_NOT_FOUND_DETAIL
            )

        return contract_code.strip()

    @staticmethod
    def _get_work_report_purpose(
        db: Session,
        purpose_id: int,
    ) -> WorkReportPurpose | None:
        stmt = select(WorkReportPurpose).where(
            WorkReportPurpose.purpose_id == purpose_id,
        )
        return db.scalar(stmt)

    @staticmethod
    def _ensure_work_report_purpose_exists(
        db: Session,
        purpose_id: int,
    ) -> WorkReportPurpose:
        work_report_purpose = WorkReportService._get_work_report_purpose(
            db=db,
            purpose_id=purpose_id,
        )

        if (
            work_report_purpose is None
            or WorkReportService._is_deleted_or_inactive(
                work_report_purpose
            )
        ):
            WorkReportService._raise_not_found(
                WORK_REPORT_PURPOSE_NOT_FOUND_DETAIL
            )

        return work_report_purpose

    @staticmethod
    def _ensure_purposes_exist(
        db: Session,
        purpose_selections: list[dict[str, Any]],
    ) -> None:
        for selection in purpose_selections:
            WorkReportService._ensure_work_report_purpose_exists(
                db=db,
                purpose_id=selection["purpose_id"],
            )

    @staticmethod
    def _get_existing_work_report(
        db: Session,
        work_report_id: int,
        include_deleted: bool = False,
        for_update: bool = False,
    ) -> WorkReport:
        stmt = (
            select(WorkReport)
            .options(
                WorkReportService._active_purpose_selections_option()
            )
            .where(
                WorkReport.work_report_id == work_report_id,
            )
            .execution_options(populate_existing=True)
        )

        if not include_deleted:
            stmt = stmt.where(
                WorkReport.mark_flag.is_(False),
            )

        if for_update:
            stmt = stmt.with_for_update()

        work_report = db.scalar(stmt)

        if work_report is None:
            WorkReportService._raise_not_found(
                WORK_REPORT_NOT_FOUND_DETAIL
            )

        return work_report

    @staticmethod
    def _ensure_time_record_unique(
        db: Session,
        time_record_id: int,
    ) -> None:
        # ตรวจทุกแถว รวมรายการที่ soft delete แล้ว เพราะฐานข้อมูลกำหนด
        # UniqueConstraint ที่ time_record_id โดยตรง
        stmt = select(WorkReport.work_report_id).where(
            WorkReport.time_record_id == time_record_id,
        )

        if db.scalar(stmt) is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=WORK_REPORT_ALREADY_EXISTS_DETAIL,
            )

    @staticmethod
    def _rollback_integrity_error(
        db: Session,
        exc: IntegrityError,
    ) -> None:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=INVALID_REFERENCE_DETAIL,
        ) from exc

    @staticmethod
    def _generate_document_no(
        db: Session,
        contract_code: str,
        document_date: date,
    ) -> str:
        """
        สร้าง document_no โดยจองเลข running แบบ atomic จาก
        work_report_document_sequence

        รูปแบบ:
        {contract_code}_{DDMMBBBB}_{running}

        ตัวอย่าง:
        ทดสอบ03_24092569_01

        WorkReportDocumentSequenceService จะใช้ MySQL
        INSERT ... ON DUPLICATE KEY UPDATE เพื่อป้องกัน
        เลขซ้ำเมื่อมีหลาย request ทำงานพร้อมกัน

        method นี้ไม่ commit transaction เอง
        เพื่อให้การจองเลขและการสร้าง work_report
        commit / rollback ไปพร้อมกัน
        """
        return WorkReportDocumentSequenceService.generate_document_no(
            db=db,
            contract_code=contract_code,
            document_date=document_date,
        )

    @staticmethod
    def _sync_purpose_selections(
        db: Session,
        work_report: WorkReport,
        purpose_selections: list[dict[str, Any]],
        updated_by: str,
    ) -> None:
        WorkReportService._ensure_purposes_exist(
            db=db,
            purpose_selections=purpose_selections,
        )

        stmt = (
            select(WorkReportPurposeSelection)
            .where(
                WorkReportPurposeSelection.work_report_id
                == work_report.work_report_id,
                WorkReportPurposeSelection.mark_flag.is_(False),
            )
            .with_for_update()
        )

        existing_selections = list(db.scalars(stmt).all())
        existing_by_purpose_id = {
            selection.purpose_id: selection
            for selection in existing_selections
        }

        requested_purpose_ids = {
            selection["purpose_id"]
            for selection in purpose_selections
        }

        for existing in existing_selections:
            if existing.purpose_id not in requested_purpose_ids:
                existing.mark_flag = True
                existing.is_active = False
                existing.updated_by = updated_by

        for selection_data in purpose_selections:
            purpose_id = selection_data["purpose_id"]
            purpose_detail = selection_data.get("purpose_detail")

            existing = existing_by_purpose_id.get(purpose_id)

            if existing is not None:
                existing.purpose_detail = purpose_detail
                existing.is_active = True
                existing.updated_by = updated_by
                continue

            db.add(
                WorkReportPurposeSelection(
                    work_report_id=work_report.work_report_id,
                    purpose_id=purpose_id,
                    purpose_detail=purpose_detail,
                    is_active=True,
                    mark_flag=False,
                    created_by=work_report.created_by,
                    updated_by=updated_by,
                )
            )

    @staticmethod
    def ensure_work_report_for_time_record(
        db: Session,
        time_record_id: int,
    ) -> WorkReport:
        existing_stmt = (
            select(WorkReport)
            .options(
                WorkReportService._active_purpose_selections_option()
            )
            .where(
                WorkReport.time_record_id == time_record_id,
            )
            .execution_options(populate_existing=True)
        )

        existing_work_report = db.scalar(existing_stmt)

        if existing_work_report is not None:
            return existing_work_report

        time_record = WorkReportService._ensure_time_record_exists(
            db=db,
            time_record_id=time_record_id,
        )

        created_by = time_record.employee_code

        WorkReportService._ensure_employee_exists(
            db=db,
            employee_code=created_by,
            detail=CREATED_BY_EMPLOYEE_NOT_FOUND_DETAIL,
        )

        contract_code = WorkReportService._get_contract_code_for_time_record(
            db=db,
            time_record=time_record,
        )
        document_date = time_record.work_date

        document_no = WorkReportService._generate_document_no(
            db=db,
            contract_code=contract_code,
            document_date=document_date,
        )

        work_report = WorkReport(
            time_record_id=time_record_id,
            document_no=document_no,
            additional_note=None,
            client_first_name=None,
            client_last_name=None,
            client_position=None,
            signature_path=None,
            signature_datetime=None,
            is_active=True,
            report_status="active",
            mark_flag=False,
            created_by=created_by,
            updated_by=None,
        )

        try:
            db.add(work_report)
            db.commit()
        except IntegrityError as exc:
            db.rollback()

            # ป้องกันกรณี request เดียวกันเข้ามาพร้อมกัน
            # สำหรับ time_record_id เดียวกัน:
            # request ที่สร้างสำเร็จแล้วให้คืน work_report เดิม
            existing_after_rollback = db.scalar(
                select(WorkReport)
                .options(
                    WorkReportService._active_purpose_selections_option()
                )
                .where(
                    WorkReport.time_record_id == time_record_id,
                )
                .execution_options(populate_existing=True)
            )

            if existing_after_rollback is not None:
                return existing_after_rollback

            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=INVALID_REFERENCE_DETAIL,
            ) from exc

        return WorkReportService._get_existing_work_report(
            db=db,
            work_report_id=work_report.work_report_id,
            include_deleted=False,
        )

    @staticmethod
    def create_work_report(
        db: Session,
        payload: WorkReportCreate,
    ) -> WorkReport:
        create_data = payload.model_dump()
        purpose_selections = create_data.pop("purpose_selections")

        time_record = WorkReportService._ensure_time_record_exists(
            db=db,
            time_record_id=create_data["time_record_id"],
        )

        created_by = time_record.employee_code

        WorkReportService._ensure_employee_exists(
            db=db,
            employee_code=created_by,
            detail=CREATED_BY_EMPLOYEE_NOT_FOUND_DETAIL,
        )

        WorkReportService._ensure_purposes_exist(
            db=db,
            purpose_selections=purpose_selections,
        )

        WorkReportService._ensure_time_record_unique(
            db=db,
            time_record_id=create_data["time_record_id"],
        )

        # ใช้รหัสสัญญาจากหน่วยงานของ time_record
        # และใช้ work_date เป็นวันที่ในเลขเอกสาร
        # ตัวอย่าง: U1N2608202XFJ03_21092569_01
        contract_code = WorkReportService._get_contract_code_for_time_record(
            db=db,
            time_record=time_record,
        )
        document_date = time_record.work_date

        document_no = WorkReportService._generate_document_no(
            db=db,
            contract_code=contract_code,
            document_date=document_date,
        )

        work_report = WorkReport(
            **create_data,
            document_no=document_no,
            report_status="active",
            created_by=created_by,
            mark_flag=False,
        )

        try:
            db.add(work_report)
            db.flush()

            for selection_data in purpose_selections:
                db.add(
                    WorkReportPurposeSelection(
                        work_report_id=work_report.work_report_id,
                        purpose_id=selection_data["purpose_id"],
                        purpose_detail=selection_data.get(
                            "purpose_detail"
                        ),
                        is_active=True,
                        mark_flag=False,
                        created_by=created_by,
                        updated_by=None,
                    )
                )

            db.commit()

            return WorkReportService._get_existing_work_report(
                db=db,
                work_report_id=work_report.work_report_id,
                include_deleted=False,
            )
        except IntegrityError as exc:
            db.rollback()

            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=INVALID_REFERENCE_DETAIL,
            ) from exc

    @staticmethod
    def get_work_report_by_id(
        db: Session,
        work_report_id: int,
        include_deleted: bool = False,
    ) -> WorkReport:
        return WorkReportService._get_existing_work_report(
            db=db,
            work_report_id=work_report_id,
            include_deleted=include_deleted,
        )

    @staticmethod
    def get_work_report_by_time_record_id(
        db: Session,
        time_record_id: int,
        include_deleted: bool = False,
    ) -> WorkReport:
        stmt = (
            select(WorkReport)
            .options(
                WorkReportService._active_purpose_selections_option()
            )
            .where(
                WorkReport.time_record_id == time_record_id,
            )
            .execution_options(populate_existing=True)
        )

        if not include_deleted:
            stmt = stmt.where(
                WorkReport.mark_flag.is_(False),
            )

        work_report = db.scalar(stmt)

        if work_report is None:
            WorkReportService._raise_not_found(
                WORK_REPORT_NOT_FOUND_DETAIL
            )

        return work_report

    @staticmethod
    def get_work_reports(
        db: Session,
        skip: int = DBConstants.DEFAULT_PAGE_SKIP,
        limit: int = DBConstants.DEFAULT_PAGE_LIMIT,
        time_record_id: int | None = None,
        purpose_id: int | None = None,
        is_active: bool | None = None,
        include_deleted: bool = False,
    ) -> list[WorkReport]:
        stmt = select(WorkReport).options(
            WorkReportService._active_purpose_selections_option()
        )

        if not include_deleted:
            stmt = stmt.where(
                WorkReport.mark_flag.is_(False),
            )

        if time_record_id is not None:
            stmt = stmt.where(
                WorkReport.time_record_id == time_record_id,
            )

        if purpose_id is not None:
            stmt = stmt.where(
                WorkReport.purpose_selections.any(
                    and_(
                        WorkReportPurposeSelection.purpose_id
                        == purpose_id,
                        WorkReportPurposeSelection.mark_flag.is_(False),
                        WorkReportPurposeSelection.is_active.is_(True),
                    )
                )
            )

        if is_active is not None:
            stmt = stmt.where(
                WorkReport.is_active.is_(is_active),
            )

        stmt = (
            stmt.order_by(
                WorkReport.created_at.desc(),
                WorkReport.work_report_id.desc(),
            )
            .offset(skip)
            .limit(limit)
            .execution_options(populate_existing=True)
        )

        return list(db.scalars(stmt).unique().all())

    @staticmethod
    def save_work_report_signature(
        db: Session,
        work_report_id: int,
        signature_base64: str,
        updated_by: str,
    ) -> WorkReport:
        work_report = WorkReportService._get_existing_work_report(
            db=db,
            work_report_id=work_report_id,
            include_deleted=False,
            for_update=True,
        )

        WorkReportService._ensure_employee_exists(
            db=db,
            employee_code=updated_by,
            detail=UPDATED_BY_EMPLOYEE_NOT_FOUND_DETAIL,
        )

        time_record = WorkReportService._ensure_time_record_exists(
            db=db,
            time_record_id=work_report.time_record_id,
        )

        previous_signature_path = work_report.signature_path

        try:
            signature_path = ImageStorageService.save_time_record_image(
                image_base64=signature_base64,
                work_date=time_record.work_date,
                employee_code=time_record.employee_code,
                time_record_id=time_record.time_record_id,
                image_type="signature",
                sequence_no=1,
            )
        except ImageStorageError as exc:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(exc),
            ) from exc

        work_report.signature_path = signature_path
        work_report.signature_datetime = datetime.now(
            BANGKOK_TIMEZONE
        ).replace(tzinfo=None)
        work_report.updated_by = updated_by

        try:
            db.commit()
        except IntegrityError as exc:
            db.rollback()

            if signature_path != previous_signature_path:
                try:
                    ImageStorageService.delete_image(signature_path)
                except ImageStorageError:
                    pass

            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=INVALID_REFERENCE_DETAIL,
            ) from exc

        if (
            previous_signature_path
            and previous_signature_path != signature_path
        ):
            try:
                ImageStorageService.delete_image(
                    previous_signature_path
                )
            except ImageStorageError:
                pass

        return WorkReportService._get_existing_work_report(
            db=db,
            work_report_id=work_report_id,
            include_deleted=False,
        )

    @staticmethod
    def update_work_report(
        db: Session,
        work_report_id: int,
        payload: WorkReportUpdate,
    ) -> WorkReport:
        work_report = WorkReportService._get_existing_work_report(
            db=db,
            work_report_id=work_report_id,
            include_deleted=False,
            for_update=True,
        )

        update_data = payload.model_dump(exclude_unset=True)
        purpose_selections = update_data.pop(
            "purpose_selections",
            None,
        )
        updated_by = update_data["updated_by"]

        WorkReportService._ensure_employee_exists(
            db=db,
            employee_code=updated_by,
            detail=UPDATED_BY_EMPLOYEE_NOT_FOUND_DETAIL,
        )

        if purpose_selections is not None:
            WorkReportService._sync_purpose_selections(
                db=db,
                work_report=work_report,
                purpose_selections=purpose_selections,
                updated_by=updated_by,
            )

        for field, value in update_data.items():
            setattr(work_report, field, value)

        # บันทึกแก้ไขรายงานที่ยกเลิกโดยใช้ ID และเลขเอกสารเดิม
        if work_report.report_status == "cancelled":
            work_report.report_status = "active"
            work_report.is_active = True

        try:
            db.commit()
        except IntegrityError as exc:
            WorkReportService._rollback_integrity_error(
                db=db,
                exc=exc,
            )

        return WorkReportService._get_existing_work_report(
            db=db,
            work_report_id=work_report_id,
            include_deleted=False,
        )

    @staticmethod
    def cancel_work_report(
        db: Session,
        work_report_id: int,
        updated_by: str,
    ) -> WorkReport:
        """

        ยกเลิกบันทึกรายงานโดยเก็บข้อมูลเดิมทั้งหมดไว้
        - work_report.is_active = False

        - work_report.mark_flag = False

        - work_report.report_status = "cancelled"

        - ไม่แก้ไข work_report_item

        - ไม่แก้ไข work_report_detail

        - ไม่แก้ไข work_report_purpose_selection

        - ไม่ล้างข้อมูลรายละเอียดหรือข้อมูลลายเซ็น

        """
        work_report = WorkReportService._get_existing_work_report(
            db=db,
            work_report_id=work_report_id,
            include_deleted=False,
            for_update=True,
        )

        WorkReportService._ensure_employee_exists(
            db=db,
            employee_code=updated_by,
            detail=UPDATED_BY_EMPLOYEE_NOT_FOUND_DETAIL,
        )

        work_report.is_active = False
        work_report.mark_flag = False
        work_report.report_status = "cancelled"
        work_report.updated_by = updated_by

        try:
            db.commit()
        except IntegrityError as exc:
            WorkReportService._rollback_integrity_error(
                db=db,
                exc=exc,
            )

        return WorkReportService._get_existing_work_report(
            db=db,
            work_report_id=work_report_id,
            include_deleted=False,
        )

    @staticmethod
    def deactivate_work_report(
        db: Session,
        work_report_id: int,
        updated_by: str,
    ) -> WorkReport:
        work_report = WorkReportService._get_existing_work_report(
            db=db,
            work_report_id=work_report_id,
            include_deleted=False,
            for_update=True,
        )

        WorkReportService._ensure_employee_exists(
            db=db,
            employee_code=updated_by,
            detail=UPDATED_BY_EMPLOYEE_NOT_FOUND_DETAIL,
        )

        work_report.is_active = False
        work_report.mark_flag = False
        work_report.report_status = "cancelled"
        work_report.updated_by = updated_by

        try:
            db.commit()
        except IntegrityError as exc:
            WorkReportService._rollback_integrity_error(
                db=db,
                exc=exc,
            )

        return WorkReportService._get_existing_work_report(
            db=db,
            work_report_id=work_report_id,
            include_deleted=False,
        )

    @staticmethod
    def activate_work_report(
        db: Session,
        work_report_id: int,
        updated_by: str,
    ) -> WorkReport:
        work_report = WorkReportService._get_existing_work_report(
            db=db,
            work_report_id=work_report_id,
            include_deleted=False,
            for_update=True,
        )

        WorkReportService._ensure_employee_exists(
            db=db,
            employee_code=updated_by,
            detail=UPDATED_BY_EMPLOYEE_NOT_FOUND_DETAIL,
        )

        work_report.is_active = True
        work_report.mark_flag = False
        work_report.report_status = "active"
        work_report.updated_by = updated_by

        try:
            db.commit()
        except IntegrityError as exc:
            WorkReportService._rollback_integrity_error(
                db=db,
                exc=exc,
            )

        return WorkReportService._get_existing_work_report(
            db=db,
            work_report_id=work_report_id,
            include_deleted=False,
        )

    @staticmethod
    def delete_work_report(
        db: Session,
        work_report_id: int,
        updated_by: str,
    ) -> WorkReport:
        """
        ล้างข้อมูลบันทึกรายงานของรายการนี้ โดยไม่ลบ time_record

        - time_record เป็นหลักฐาน Check-in / Check-out จึงต้องเก็บไว้
        - work_report.time_record_id เป็น UNIQUE จึงคง WorkReport แถวเดิม
        - ล้าง additional_note
        - ล้างข้อมูลผู้ว่าจ้าง/ตัวแทนและ path ลายเซ็น
        - soft delete work_report_item ที่ยังใช้งานอยู่
        - soft delete work_report_detail ที่ยังใช้งานอยู่
        - soft delete work_report_purpose_selection ที่ยังใช้งานอยู่
        """
        work_report = WorkReportService._get_existing_work_report(
            db=db,
            work_report_id=work_report_id,
            include_deleted=False,
            for_update=True,
        )

        WorkReportService._ensure_employee_exists(
            db=db,
            employee_code=updated_by,
            detail=UPDATED_BY_EMPLOYEE_NOT_FOUND_DETAIL,
        )

        item_stmt = (
            select(WorkReportItem)
            .where(
                WorkReportItem.work_report_id == work_report_id,
                WorkReportItem.mark_flag.is_(False),
            )
            .with_for_update()
        )
        work_report_items = list(db.scalars(item_stmt).all())

        detail_stmt = (
            select(WorkReportDetail)
            .where(
                WorkReportDetail.work_report_id == work_report_id,
                WorkReportDetail.mark_flag.is_(False),
            )
            .with_for_update()
        )
        work_report_details = list(db.scalars(detail_stmt).all())

        purpose_stmt = (
            select(WorkReportPurposeSelection)
            .where(
                WorkReportPurposeSelection.work_report_id
                == work_report_id,
                WorkReportPurposeSelection.mark_flag.is_(False),
            )
            .with_for_update()
        )
        purpose_selections = list(db.scalars(purpose_stmt).all())

        for item in work_report_items:
            item.mark_flag = True
            item.is_active = False
            item.updated_by = updated_by

        for detail in work_report_details:
            detail.mark_flag = True
            detail.is_active = False
            detail.updated_by = updated_by

        for selection in purpose_selections:
            selection.mark_flag = True
            selection.is_active = False
            selection.updated_by = updated_by

        work_report.additional_note = None
        work_report.client_first_name = None
        work_report.client_last_name = None
        work_report.client_position = None
        work_report.signature_path = None
        work_report.signature_datetime = None
        work_report.mark_flag = False
        work_report.is_active = True
        work_report.report_status = "active"
        work_report.updated_by = updated_by

        try:
            db.commit()
        except IntegrityError as exc:
            WorkReportService._rollback_integrity_error(
                db=db,
                exc=exc,
            )

        return WorkReportService._get_existing_work_report(
            db=db,
            work_report_id=work_report_id,
            include_deleted=False,
        )