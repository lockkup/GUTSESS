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
    WORK_REPORT_NOT_FOUND_DETAIL,
    WORK_REPORT_PURPOSE_NOT_FOUND_DETAIL,
)
from app.models.employees import Employees
from app.models.work_report import WorkReport
from app.models.work_report_purpose import WorkReportPurpose
from app.models.work_report_purpose_selection import WorkReportPurposeSelection
from app.schemas.work_report_purpose_selection import (
    WorkReportPurposeSelectionCreate,
    WorkReportPurposeSelectionUpdate,
)


class WorkReportPurposeSelectionService:
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
        employee = WorkReportPurposeSelectionService._get_employee(
            db=db,
            employee_code=employee_code,
        )

        if (
            employee is None
            or WorkReportPurposeSelectionService._is_deleted_or_inactive(
                employee
            )
        ):
            WorkReportPurposeSelectionService._raise_not_found(detail)

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
        work_report = WorkReportPurposeSelectionService._get_work_report(
            db=db,
            work_report_id=work_report_id,
        )

        if (
            work_report is None
            or WorkReportPurposeSelectionService._is_deleted_or_inactive(
                work_report
            )
        ):
            WorkReportPurposeSelectionService._raise_not_found(
                WORK_REPORT_NOT_FOUND_DETAIL
            )

        return work_report

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
        purpose = WorkReportPurposeSelectionService._get_work_report_purpose(
            db=db,
            purpose_id=purpose_id,
        )

        if (
            purpose is None
            or WorkReportPurposeSelectionService._is_deleted_or_inactive(
                purpose
            )
        ):
            WorkReportPurposeSelectionService._raise_not_found(
                WORK_REPORT_PURPOSE_NOT_FOUND_DETAIL
            )

        return purpose

    @staticmethod
    def _get_existing_selection(
        db: Session,
        work_report_purpose_selection_id: int,
        include_deleted: bool = False,
        for_update: bool = False,
    ) -> WorkReportPurposeSelection:
        stmt = select(WorkReportPurposeSelection).where(
            WorkReportPurposeSelection.work_report_purpose_selection_id
            == work_report_purpose_selection_id,
        )

        if not include_deleted:
            stmt = stmt.where(
                WorkReportPurposeSelection.mark_flag.is_(False),
            )

        if for_update:
            stmt = stmt.with_for_update()

        selection = db.scalar(stmt)

        if selection is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Work report purpose selection not found",
            )

        return selection

    @staticmethod
    def _ensure_active_selection_unique(
        db: Session,
        work_report_id: int,
        purpose_id: int,
        exclude_selection_id: int | None = None,
    ) -> None:
        stmt = select(
            WorkReportPurposeSelection.work_report_purpose_selection_id
        ).where(
            WorkReportPurposeSelection.work_report_id == work_report_id,
            WorkReportPurposeSelection.active_purpose_id == purpose_id,
        )

        if exclude_selection_id is not None:
            stmt = stmt.where(
                WorkReportPurposeSelection.work_report_purpose_selection_id
                != exclude_selection_id,
            )

        if db.scalar(stmt) is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=INVALID_REFERENCE_DETAIL,
            )

    @staticmethod
    def _commit_and_refresh(
        db: Session,
        instance: WorkReportPurposeSelection,
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
    def create_work_report_purpose_selection(
        db: Session,
        payload: WorkReportPurposeSelectionCreate,
    ) -> WorkReportPurposeSelection:
        create_data = payload.model_dump()

        work_report = (
            WorkReportPurposeSelectionService._ensure_work_report_exists(
                db=db,
                work_report_id=create_data["work_report_id"],
            )
        )

        WorkReportPurposeSelectionService._ensure_work_report_purpose_exists(
            db=db,
            purpose_id=create_data["purpose_id"],
        )

        created_by = work_report.created_by

        WorkReportPurposeSelectionService._ensure_employee_exists(
            db=db,
            employee_code=created_by,
            detail=CREATED_BY_EMPLOYEE_NOT_FOUND_DETAIL,
        )

        WorkReportPurposeSelectionService._ensure_active_selection_unique(
            db=db,
            work_report_id=create_data["work_report_id"],
            purpose_id=create_data["purpose_id"],
        )

        selection = WorkReportPurposeSelection(
            **create_data,
            created_by=created_by,
            mark_flag=False,
        )

        db.add(selection)

        WorkReportPurposeSelectionService._commit_and_refresh(
            db=db,
            instance=selection,
        )

        return selection

    @staticmethod
    def get_work_report_purpose_selection_by_id(
        db: Session,
        work_report_purpose_selection_id: int,
        include_deleted: bool = False,
    ) -> WorkReportPurposeSelection:
        return WorkReportPurposeSelectionService._get_existing_selection(
            db=db,
            work_report_purpose_selection_id=(
                work_report_purpose_selection_id
            ),
            include_deleted=include_deleted,
        )

    @staticmethod
    def get_work_report_purpose_selections(
        db: Session,
        skip: int = DBConstants.DEFAULT_PAGE_SKIP,
        limit: int = DBConstants.DEFAULT_PAGE_LIMIT,
        work_report_id: int | None = None,
        purpose_id: int | None = None,
        is_active: bool | None = None,
        include_deleted: bool = False,
    ) -> list[WorkReportPurposeSelection]:
        stmt = select(WorkReportPurposeSelection)

        if not include_deleted:
            stmt = stmt.where(
                WorkReportPurposeSelection.mark_flag.is_(False),
            )

        if work_report_id is not None:
            stmt = stmt.where(
                WorkReportPurposeSelection.work_report_id == work_report_id,
            )

        if purpose_id is not None:
            stmt = stmt.where(
                WorkReportPurposeSelection.purpose_id == purpose_id,
            )

        if is_active is not None:
            stmt = stmt.where(
                WorkReportPurposeSelection.is_active.is_(is_active),
            )

        stmt = (
            stmt.order_by(
                WorkReportPurposeSelection.work_report_id.desc(),
                WorkReportPurposeSelection.purpose_id.asc(),
                WorkReportPurposeSelection.work_report_purpose_selection_id.asc(),
            )
            .offset(skip)
            .limit(limit)
        )

        return list(db.scalars(stmt).all())

    @staticmethod
    def update_work_report_purpose_selection(
        db: Session,
        work_report_purpose_selection_id: int,
        payload: WorkReportPurposeSelectionUpdate,
    ) -> WorkReportPurposeSelection:
        selection = (
            WorkReportPurposeSelectionService._get_existing_selection(
                db=db,
                work_report_purpose_selection_id=(
                    work_report_purpose_selection_id
                ),
                include_deleted=False,
                for_update=True,
            )
        )

        update_data = payload.model_dump(exclude_unset=True)

        updated_by = update_data["updated_by"]

        WorkReportPurposeSelectionService._ensure_employee_exists(
            db=db,
            employee_code=updated_by,
            detail=UPDATED_BY_EMPLOYEE_NOT_FOUND_DETAIL,
        )

        new_purpose_id = update_data.get(
            "purpose_id",
            selection.purpose_id,
        )

        if new_purpose_id != selection.purpose_id:
            WorkReportPurposeSelectionService._ensure_work_report_purpose_exists(
                db=db,
                purpose_id=new_purpose_id,
            )

            WorkReportPurposeSelectionService._ensure_active_selection_unique(
                db=db,
                work_report_id=selection.work_report_id,
                purpose_id=new_purpose_id,
                exclude_selection_id=(
                    selection.work_report_purpose_selection_id
                ),
            )

        for field, value in update_data.items():
            setattr(selection, field, value)

        WorkReportPurposeSelectionService._commit_and_refresh(
            db=db,
            instance=selection,
        )

        return selection

    @staticmethod
    def deactivate_work_report_purpose_selection(
        db: Session,
        work_report_purpose_selection_id: int,
        updated_by: str,
    ) -> WorkReportPurposeSelection:
        selection = (
            WorkReportPurposeSelectionService._get_existing_selection(
                db=db,
                work_report_purpose_selection_id=(
                    work_report_purpose_selection_id
                ),
                include_deleted=False,
                for_update=True,
            )
        )

        WorkReportPurposeSelectionService._ensure_employee_exists(
            db=db,
            employee_code=updated_by,
            detail=UPDATED_BY_EMPLOYEE_NOT_FOUND_DETAIL,
        )

        selection.is_active = False
        selection.updated_by = updated_by

        WorkReportPurposeSelectionService._commit_and_refresh(
            db=db,
            instance=selection,
        )

        return selection

    @staticmethod
    def activate_work_report_purpose_selection(
        db: Session,
        work_report_purpose_selection_id: int,
        updated_by: str,
    ) -> WorkReportPurposeSelection:
        selection = (
            WorkReportPurposeSelectionService._get_existing_selection(
                db=db,
                work_report_purpose_selection_id=(
                    work_report_purpose_selection_id
                ),
                include_deleted=False,
                for_update=True,
            )
        )

        WorkReportPurposeSelectionService._ensure_employee_exists(
            db=db,
            employee_code=updated_by,
            detail=UPDATED_BY_EMPLOYEE_NOT_FOUND_DETAIL,
        )

        selection.is_active = True
        selection.updated_by = updated_by

        WorkReportPurposeSelectionService._commit_and_refresh(
            db=db,
            instance=selection,
        )

        return selection

    @staticmethod
    def delete_work_report_purpose_selection(
        db: Session,
        work_report_purpose_selection_id: int,
        updated_by: str,
    ) -> WorkReportPurposeSelection:
        selection = (
            WorkReportPurposeSelectionService._get_existing_selection(
                db=db,
                work_report_purpose_selection_id=(
                    work_report_purpose_selection_id
                ),
                include_deleted=False,
                for_update=True,
            )
        )

        WorkReportPurposeSelectionService._ensure_employee_exists(
            db=db,
            employee_code=updated_by,
            detail=UPDATED_BY_EMPLOYEE_NOT_FOUND_DETAIL,
        )

        selection.mark_flag = True
        selection.is_active = False
        selection.updated_by = updated_by

        WorkReportPurposeSelectionService._commit_and_refresh(
            db=db,
            instance=selection,
        )

        return selection
