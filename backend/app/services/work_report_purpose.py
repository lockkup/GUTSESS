from __future__ import annotations

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
    WORK_REPORT_PURPOSE_CODE_ALREADY_EXISTS_DETAIL,
    WORK_REPORT_PURPOSE_NOT_FOUND_DETAIL,
)
from app.models.employees import Employees
from app.models.work_report_purpose import WorkReportPurpose
from app.schemas.work_report_purpose import (
    WorkReportPurposeCreate,
    WorkReportPurposeUpdate,
)


class WorkReportPurposeService:
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
        employee = WorkReportPurposeService._get_employee(
            db=db,
            employee_code=employee_code,
        )

        if employee is None or WorkReportPurposeService._is_deleted_or_inactive(
            employee
        ):
            WorkReportPurposeService._raise_not_found(detail)

        return employee

    @staticmethod
    def _get_existing_work_report_purpose(
        db: Session,
        purpose_id: int,
        include_deleted: bool = False,
        for_update: bool = False,
    ) -> WorkReportPurpose:
        stmt = select(WorkReportPurpose).where(
            WorkReportPurpose.purpose_id == purpose_id,
        )

        if not include_deleted:
            stmt = stmt.where(
                WorkReportPurpose.mark_flag.is_(False),
            )

        if for_update:
            stmt = stmt.with_for_update()

        work_report_purpose = db.scalar(stmt)

        if work_report_purpose is None:
            WorkReportPurposeService._raise_not_found(
                WORK_REPORT_PURPOSE_NOT_FOUND_DETAIL
            )

        return work_report_purpose

    @staticmethod
    def _ensure_purpose_code_unique(
        db: Session,
        purpose_code: str,
        exclude_purpose_id: int | None = None,
    ) -> None:
        # ตรวจทุกแถว รวมรายการที่ soft delete แล้ว เพราะฐานข้อมูลกำหนด
        # UniqueConstraint ที่ purpose_code โดยตรง
        stmt = select(WorkReportPurpose.purpose_id).where(
            WorkReportPurpose.purpose_code == purpose_code,
        )

        if exclude_purpose_id is not None:
            stmt = stmt.where(
                WorkReportPurpose.purpose_id != exclude_purpose_id,
            )

        if db.scalar(stmt) is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=WORK_REPORT_PURPOSE_CODE_ALREADY_EXISTS_DETAIL,
            )

    @staticmethod
    def _commit_and_refresh(
        db: Session,
        instance: WorkReportPurpose,
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
    def create_work_report_purpose(
        db: Session,
        payload: WorkReportPurposeCreate,
    ) -> WorkReportPurpose:
        create_data = payload.model_dump()

        WorkReportPurposeService._ensure_employee_exists(
            db=db,
            employee_code=create_data["created_by"],
            detail=CREATED_BY_EMPLOYEE_NOT_FOUND_DETAIL,
        )

        WorkReportPurposeService._ensure_purpose_code_unique(
            db=db,
            purpose_code=create_data["purpose_code"],
        )

        work_report_purpose = WorkReportPurpose(
            **create_data,
            mark_flag=False,
        )

        db.add(work_report_purpose)

        WorkReportPurposeService._commit_and_refresh(
            db=db,
            instance=work_report_purpose,
        )

        return work_report_purpose

    @staticmethod
    def get_work_report_purpose_by_id(
        db: Session,
        purpose_id: int,
        include_deleted: bool = False,
    ) -> WorkReportPurpose:
        return WorkReportPurposeService._get_existing_work_report_purpose(
            db=db,
            purpose_id=purpose_id,
            include_deleted=include_deleted,
        )

    @staticmethod
    def get_work_report_purposes(
        db: Session,
        skip: int = DBConstants.DEFAULT_PAGE_SKIP,
        limit: int = DBConstants.DEFAULT_PAGE_LIMIT,
        purpose_code: str | None = None,
        purpose_name: str | None = None,
        is_active: bool | None = None,
        include_deleted: bool = False,
    ) -> list[WorkReportPurpose]:
        stmt = select(WorkReportPurpose)

        if not include_deleted:
            stmt = stmt.where(
                WorkReportPurpose.mark_flag.is_(False),
            )

        if purpose_code:
            stmt = stmt.where(
                WorkReportPurpose.purpose_code == purpose_code.strip(),
            )

        if purpose_name:
            stmt = stmt.where(
                WorkReportPurpose.purpose_name.contains(purpose_name.strip()),
            )

        if is_active is not None:
            stmt = stmt.where(
                WorkReportPurpose.is_active.is_(is_active),
            )

        stmt = (
            stmt.order_by(
                WorkReportPurpose.display_order.asc(),
                WorkReportPurpose.purpose_id.asc(),
            )
            .offset(skip)
            .limit(limit)
        )

        return list(db.scalars(stmt).all())

    @staticmethod
    def update_work_report_purpose(
        db: Session,
        purpose_id: int,
        payload: WorkReportPurposeUpdate,
    ) -> WorkReportPurpose:
        work_report_purpose = (
            WorkReportPurposeService._get_existing_work_report_purpose(
                db=db,
                purpose_id=purpose_id,
                include_deleted=False,
                for_update=True,
            )
        )

        update_data = payload.model_dump(exclude_unset=True)

        WorkReportPurposeService._ensure_employee_exists(
            db=db,
            employee_code=update_data["updated_by"],
            detail=UPDATED_BY_EMPLOYEE_NOT_FOUND_DETAIL,
        )

        new_purpose_code = update_data.get(
            "purpose_code",
            work_report_purpose.purpose_code,
        )

        if new_purpose_code != work_report_purpose.purpose_code:
            WorkReportPurposeService._ensure_purpose_code_unique(
                db=db,
                purpose_code=new_purpose_code,
                exclude_purpose_id=purpose_id,
            )

        for field, value in update_data.items():
            setattr(work_report_purpose, field, value)

        WorkReportPurposeService._commit_and_refresh(
            db=db,
            instance=work_report_purpose,
        )

        return work_report_purpose

    @staticmethod
    def deactivate_work_report_purpose(
        db: Session,
        purpose_id: int,
        updated_by: str,
    ) -> WorkReportPurpose:
        work_report_purpose = (
            WorkReportPurposeService._get_existing_work_report_purpose(
                db=db,
                purpose_id=purpose_id,
                include_deleted=False,
                for_update=True,
            )
        )

        WorkReportPurposeService._ensure_employee_exists(
            db=db,
            employee_code=updated_by,
            detail=UPDATED_BY_EMPLOYEE_NOT_FOUND_DETAIL,
        )

        work_report_purpose.is_active = False
        work_report_purpose.updated_by = updated_by

        WorkReportPurposeService._commit_and_refresh(
            db=db,
            instance=work_report_purpose,
        )

        return work_report_purpose

    @staticmethod
    def activate_work_report_purpose(
        db: Session,
        purpose_id: int,
        updated_by: str,
    ) -> WorkReportPurpose:
        work_report_purpose = (
            WorkReportPurposeService._get_existing_work_report_purpose(
                db=db,
                purpose_id=purpose_id,
                include_deleted=False,
                for_update=True,
            )
        )

        WorkReportPurposeService._ensure_employee_exists(
            db=db,
            employee_code=updated_by,
            detail=UPDATED_BY_EMPLOYEE_NOT_FOUND_DETAIL,
        )

        work_report_purpose.is_active = True
        work_report_purpose.updated_by = updated_by

        WorkReportPurposeService._commit_and_refresh(
            db=db,
            instance=work_report_purpose,
        )

        return work_report_purpose

    @staticmethod
    def delete_work_report_purpose(
        db: Session,
        purpose_id: int,
        updated_by: str,
    ) -> WorkReportPurpose:
        work_report_purpose = (
            WorkReportPurposeService._get_existing_work_report_purpose(
                db=db,
                purpose_id=purpose_id,
                include_deleted=False,
                for_update=True,
            )
        )

        WorkReportPurposeService._ensure_employee_exists(
            db=db,
            employee_code=updated_by,
            detail=UPDATED_BY_EMPLOYEE_NOT_FOUND_DETAIL,
        )

        work_report_purpose.mark_flag = True
        work_report_purpose.is_active = False
        work_report_purpose.updated_by = updated_by

        WorkReportPurposeService._commit_and_refresh(
            db=db,
            instance=work_report_purpose,
        )

        return work_report_purpose