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
    WORK_REPORT_ITEM_TYPE_CODE_ALREADY_EXISTS_DETAIL,
    WORK_REPORT_ITEM_TYPE_NOT_FOUND_DETAIL,
)
from app.models.employees import Employees
from app.models.work_report_item_type import WorkReportItemType
from app.schemas.work_report_item_type import (
    WorkReportItemTypeCreate,
    WorkReportItemTypeUpdate,
)


class WorkReportItemTypeService:
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
        employee = WorkReportItemTypeService._get_employee(
            db=db,
            employee_code=employee_code,
        )

        if employee is None or WorkReportItemTypeService._is_deleted_or_inactive(
            employee
        ):
            WorkReportItemTypeService._raise_not_found(detail)

        return employee

    @staticmethod
    def _get_existing_work_report_item_type(
        db: Session,
        work_item_type_id: int,
        include_deleted: bool = False,
        for_update: bool = False,
    ) -> WorkReportItemType:
        stmt = select(WorkReportItemType).where(
            WorkReportItemType.work_item_type_id == work_item_type_id,
        )

        if not include_deleted:
            stmt = stmt.where(
                WorkReportItemType.mark_flag.is_(False),
            )

        if for_update:
            stmt = stmt.with_for_update()

        work_report_item_type = db.scalar(stmt)

        if work_report_item_type is None:
            WorkReportItemTypeService._raise_not_found(
                WORK_REPORT_ITEM_TYPE_NOT_FOUND_DETAIL
            )

        return work_report_item_type

    @staticmethod
    def _ensure_work_item_code_unique(
        db: Session,
        work_item_code: str,
        exclude_work_item_type_id: int | None = None,
    ) -> None:
        # ตรวจทุกแถว รวมรายการที่ soft delete แล้ว เพราะฐานข้อมูลกำหนด
        # UniqueConstraint ที่ work_item_code โดยตรง
        stmt = select(WorkReportItemType.work_item_type_id).where(
            WorkReportItemType.work_item_code == work_item_code,
        )

        if exclude_work_item_type_id is not None:
            stmt = stmt.where(
                WorkReportItemType.work_item_type_id
                != exclude_work_item_type_id,
            )

        if db.scalar(stmt) is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=WORK_REPORT_ITEM_TYPE_CODE_ALREADY_EXISTS_DETAIL,
            )

    @staticmethod
    def _commit_and_refresh(
        db: Session,
        instance: WorkReportItemType,
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
    def create_work_report_item_type(
        db: Session,
        payload: WorkReportItemTypeCreate,
    ) -> WorkReportItemType:
        create_data = payload.model_dump()

        WorkReportItemTypeService._ensure_employee_exists(
            db=db,
            employee_code=create_data["created_by"],
            detail=CREATED_BY_EMPLOYEE_NOT_FOUND_DETAIL,
        )

        WorkReportItemTypeService._ensure_work_item_code_unique(
            db=db,
            work_item_code=create_data["work_item_code"],
        )

        work_report_item_type = WorkReportItemType(
            **create_data,
            mark_flag=False,
        )

        db.add(work_report_item_type)

        WorkReportItemTypeService._commit_and_refresh(
            db=db,
            instance=work_report_item_type,
        )

        return work_report_item_type

    @staticmethod
    def get_work_report_item_type_by_id(
        db: Session,
        work_item_type_id: int,
        include_deleted: bool = False,
    ) -> WorkReportItemType:
        return WorkReportItemTypeService._get_existing_work_report_item_type(
            db=db,
            work_item_type_id=work_item_type_id,
            include_deleted=include_deleted,
        )

    @staticmethod
    def get_work_report_item_types(
        db: Session,
        skip: int = DBConstants.DEFAULT_PAGE_SKIP,
        limit: int = DBConstants.DEFAULT_PAGE_LIMIT,
        work_item_code: str | None = None,
        work_item_name: str | None = None,
        require_detail: bool | None = None,
        is_active: bool | None = None,
        include_deleted: bool = False,
    ) -> list[WorkReportItemType]:
        stmt = select(WorkReportItemType)

        if not include_deleted:
            stmt = stmt.where(
                WorkReportItemType.mark_flag.is_(False),
            )

        if work_item_code:
            stmt = stmt.where(
                WorkReportItemType.work_item_code == work_item_code.strip(),
            )

        if work_item_name:
            stmt = stmt.where(
                WorkReportItemType.work_item_name.contains(
                    work_item_name.strip()
                ),
            )

        if require_detail is not None:
            stmt = stmt.where(
                WorkReportItemType.require_detail.is_(require_detail),
            )

        if is_active is not None:
            stmt = stmt.where(
                WorkReportItemType.is_active.is_(is_active),
            )

        stmt = (
            stmt.order_by(
                WorkReportItemType.display_order.asc(),
                WorkReportItemType.work_item_type_id.asc(),
            )
            .offset(skip)
            .limit(limit)
        )

        return list(db.scalars(stmt).all())

    @staticmethod
    def update_work_report_item_type(
        db: Session,
        work_item_type_id: int,
        payload: WorkReportItemTypeUpdate,
    ) -> WorkReportItemType:
        work_report_item_type = (
            WorkReportItemTypeService._get_existing_work_report_item_type(
                db=db,
                work_item_type_id=work_item_type_id,
                include_deleted=False,
                for_update=True,
            )
        )

        update_data = payload.model_dump(exclude_unset=True)

        WorkReportItemTypeService._ensure_employee_exists(
            db=db,
            employee_code=update_data["updated_by"],
            detail=UPDATED_BY_EMPLOYEE_NOT_FOUND_DETAIL,
        )

        new_work_item_code = update_data.get(
            "work_item_code",
            work_report_item_type.work_item_code,
        )

        if new_work_item_code != work_report_item_type.work_item_code:
            WorkReportItemTypeService._ensure_work_item_code_unique(
                db=db,
                work_item_code=new_work_item_code,
                exclude_work_item_type_id=work_item_type_id,
            )

        for field, value in update_data.items():
            setattr(work_report_item_type, field, value)

        WorkReportItemTypeService._commit_and_refresh(
            db=db,
            instance=work_report_item_type,
        )

        return work_report_item_type

    @staticmethod
    def deactivate_work_report_item_type(
        db: Session,
        work_item_type_id: int,
        updated_by: str,
    ) -> WorkReportItemType:
        work_report_item_type = (
            WorkReportItemTypeService._get_existing_work_report_item_type(
                db=db,
                work_item_type_id=work_item_type_id,
                include_deleted=False,
                for_update=True,
            )
        )

        WorkReportItemTypeService._ensure_employee_exists(
            db=db,
            employee_code=updated_by,
            detail=UPDATED_BY_EMPLOYEE_NOT_FOUND_DETAIL,
        )

        work_report_item_type.is_active = False
        work_report_item_type.updated_by = updated_by

        WorkReportItemTypeService._commit_and_refresh(
            db=db,
            instance=work_report_item_type,
        )

        return work_report_item_type

    @staticmethod
    def activate_work_report_item_type(
        db: Session,
        work_item_type_id: int,
        updated_by: str,
    ) -> WorkReportItemType:
        work_report_item_type = (
            WorkReportItemTypeService._get_existing_work_report_item_type(
                db=db,
                work_item_type_id=work_item_type_id,
                include_deleted=False,
                for_update=True,
            )
        )

        WorkReportItemTypeService._ensure_employee_exists(
            db=db,
            employee_code=updated_by,
            detail=UPDATED_BY_EMPLOYEE_NOT_FOUND_DETAIL,
        )

        work_report_item_type.is_active = True
        work_report_item_type.updated_by = updated_by

        WorkReportItemTypeService._commit_and_refresh(
            db=db,
            instance=work_report_item_type,
        )

        return work_report_item_type

    @staticmethod
    def delete_work_report_item_type(
        db: Session,
        work_item_type_id: int,
        updated_by: str,
    ) -> WorkReportItemType:
        work_report_item_type = (
            WorkReportItemTypeService._get_existing_work_report_item_type(
                db=db,
                work_item_type_id=work_item_type_id,
                include_deleted=False,
                for_update=True,
            )
        )

        WorkReportItemTypeService._ensure_employee_exists(
            db=db,
            employee_code=updated_by,
            detail=UPDATED_BY_EMPLOYEE_NOT_FOUND_DETAIL,
        )

        work_report_item_type.mark_flag = True
        work_report_item_type.is_active = False
        work_report_item_type.updated_by = updated_by

        WorkReportItemTypeService._commit_and_refresh(
            db=db,
            instance=work_report_item_type,
        )

        return work_report_item_type
