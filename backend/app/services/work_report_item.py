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
    WORK_REPORT_ITEM_DETAIL_REQUIRED_DETAIL,
    WORK_REPORT_ITEM_NOT_FOUND_DETAIL,
    WORK_REPORT_ITEM_SEQUENCE_ALREADY_EXISTS_DETAIL,
    WORK_REPORT_ITEM_TYPE_NOT_FOUND_DETAIL,
    WORK_REPORT_NOT_FOUND_DETAIL,
)
from app.models.employees import Employees
from app.models.work_report import WorkReport
from app.models.work_report_item import WorkReportItem
from app.models.work_report_item_type import WorkReportItemType
from app.schemas.work_report_item import (
    WorkReportItemCreate,
    WorkReportItemUpdate,
)


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
