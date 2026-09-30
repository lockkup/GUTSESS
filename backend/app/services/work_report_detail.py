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
    WORK_REPORT_DETAIL_NOT_FOUND_DETAIL,
    WORK_REPORT_NOT_FOUND_DETAIL,
)
from app.models.employees import Employees
from app.models.work_report import WorkReport
from app.models.work_report_detail import WorkReportDetail
from app.schemas.work_report_detail import (
    WorkReportDetailCreate,
    WorkReportDetailUpdate,
)


class WorkReportDetailService:
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
        employee = WorkReportDetailService._get_employee(
            db=db,
            employee_code=employee_code,
        )

        if (
            employee is None
            or WorkReportDetailService._is_deleted_or_inactive(employee)
        ):
            WorkReportDetailService._raise_not_found(detail)

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
        work_report = WorkReportDetailService._get_work_report(
            db=db,
            work_report_id=work_report_id,
        )

        if (
            work_report is None
            or WorkReportDetailService._is_deleted_or_inactive(work_report)
        ):
            WorkReportDetailService._raise_not_found(
                WORK_REPORT_NOT_FOUND_DETAIL
            )

        return work_report

    @staticmethod
    def _get_existing_work_report_detail(
        db: Session,
        work_report_detail_id: int,
        include_deleted: bool = False,
        for_update: bool = False,
    ) -> WorkReportDetail:
        stmt = select(WorkReportDetail).where(
            WorkReportDetail.work_report_detail_id
            == work_report_detail_id,
        )

        if not include_deleted:
            stmt = stmt.where(
                WorkReportDetail.mark_flag.is_(False),
            )

        if for_update:
            stmt = stmt.with_for_update()

        work_report_detail = db.scalar(stmt)

        if work_report_detail is None:
            WorkReportDetailService._raise_not_found(
                WORK_REPORT_DETAIL_NOT_FOUND_DETAIL
            )

        return work_report_detail

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
    def create_work_report_detail(
        db: Session,
        payload: WorkReportDetailCreate,
    ) -> WorkReportDetail:
        create_data = payload.model_dump()

        WorkReportDetailService._ensure_work_report_exists(
            db=db,
            work_report_id=create_data["work_report_id"],
        )

        WorkReportDetailService._ensure_employee_exists(
            db=db,
            employee_code=create_data["created_by"],
            detail=CREATED_BY_EMPLOYEE_NOT_FOUND_DETAIL,
        )

        work_report_detail = WorkReportDetail(
            **create_data,
            mark_flag=False,
            updated_by=None,
        )

        try:
            db.add(work_report_detail)
            db.commit()
        except IntegrityError as exc:
            WorkReportDetailService._rollback_integrity_error(
                db=db,
                exc=exc,
            )

        return WorkReportDetailService._get_existing_work_report_detail(
            db=db,
            work_report_detail_id=work_report_detail.work_report_detail_id,
            include_deleted=False,
        )

    @staticmethod
    def get_work_report_detail_by_id(
        db: Session,
        work_report_detail_id: int,
        include_deleted: bool = False,
    ) -> WorkReportDetail:
        return WorkReportDetailService._get_existing_work_report_detail(
            db=db,
            work_report_detail_id=work_report_detail_id,
            include_deleted=include_deleted,
        )

    @staticmethod
    def get_work_report_details(
        db: Session,
        skip: int = DBConstants.DEFAULT_PAGE_SKIP,
        limit: int = DBConstants.DEFAULT_PAGE_LIMIT,
        work_report_id: int | None = None,
        section_no: int | None = None,
        is_active: bool | None = None,
        include_deleted: bool = False,
    ) -> list[WorkReportDetail]:
        stmt = select(WorkReportDetail)

        if not include_deleted:
            stmt = stmt.where(
                WorkReportDetail.mark_flag.is_(False),
            )

        if work_report_id is not None:
            stmt = stmt.where(
                WorkReportDetail.work_report_id == work_report_id,
            )

        if section_no is not None:
            stmt = stmt.where(
                WorkReportDetail.section_no == section_no,
            )

        if is_active is not None:
            stmt = stmt.where(
                WorkReportDetail.is_active.is_(is_active),
            )

        stmt = (
            stmt.order_by(
                WorkReportDetail.section_no.asc(),
                WorkReportDetail.sequence_no.asc(),
                WorkReportDetail.work_report_detail_id.asc(),
            )
            .offset(skip)
            .limit(limit)
        )

        return list(db.scalars(stmt).all())

    @staticmethod
    def update_work_report_detail(
        db: Session,
        work_report_detail_id: int,
        payload: WorkReportDetailUpdate,
    ) -> WorkReportDetail:
        work_report_detail = (
            WorkReportDetailService._get_existing_work_report_detail(
                db=db,
                work_report_detail_id=work_report_detail_id,
                include_deleted=False,
                for_update=True,
            )
        )

        update_data = payload.model_dump(exclude_unset=True)
        updated_by = update_data.pop("updated_by")

        WorkReportDetailService._ensure_employee_exists(
            db=db,
            employee_code=updated_by,
            detail=UPDATED_BY_EMPLOYEE_NOT_FOUND_DETAIL,
        )

        for field, value in update_data.items():
            setattr(work_report_detail, field, value)

        work_report_detail.updated_by = updated_by

        try:
            db.commit()
        except IntegrityError as exc:
            WorkReportDetailService._rollback_integrity_error(
                db=db,
                exc=exc,
            )

        return WorkReportDetailService._get_existing_work_report_detail(
            db=db,
            work_report_detail_id=work_report_detail_id,
            include_deleted=False,
        )

    @staticmethod
    def deactivate_work_report_detail(
        db: Session,
        work_report_detail_id: int,
        updated_by: str,
    ) -> WorkReportDetail:
        work_report_detail = (
            WorkReportDetailService._get_existing_work_report_detail(
                db=db,
                work_report_detail_id=work_report_detail_id,
                include_deleted=False,
                for_update=True,
            )
        )

        WorkReportDetailService._ensure_employee_exists(
            db=db,
            employee_code=updated_by,
            detail=UPDATED_BY_EMPLOYEE_NOT_FOUND_DETAIL,
        )

        work_report_detail.is_active = False
        work_report_detail.updated_by = updated_by

        try:
            db.commit()
        except IntegrityError as exc:
            WorkReportDetailService._rollback_integrity_error(
                db=db,
                exc=exc,
            )

        return WorkReportDetailService._get_existing_work_report_detail(
            db=db,
            work_report_detail_id=work_report_detail_id,
            include_deleted=False,
        )

    @staticmethod
    def activate_work_report_detail(
        db: Session,
        work_report_detail_id: int,
        updated_by: str,
    ) -> WorkReportDetail:
        work_report_detail = (
            WorkReportDetailService._get_existing_work_report_detail(
                db=db,
                work_report_detail_id=work_report_detail_id,
                include_deleted=False,
                for_update=True,
            )
        )

        WorkReportDetailService._ensure_employee_exists(
            db=db,
            employee_code=updated_by,
            detail=UPDATED_BY_EMPLOYEE_NOT_FOUND_DETAIL,
        )

        work_report_detail.is_active = True
        work_report_detail.updated_by = updated_by

        try:
            db.commit()
        except IntegrityError as exc:
            WorkReportDetailService._rollback_integrity_error(
                db=db,
                exc=exc,
            )

        return WorkReportDetailService._get_existing_work_report_detail(
            db=db,
            work_report_detail_id=work_report_detail_id,
            include_deleted=False,
        )

    @staticmethod
    def delete_work_report_detail(
        db: Session,
        work_report_detail_id: int,
        updated_by: str,
    ) -> WorkReportDetail:
        work_report_detail = (
            WorkReportDetailService._get_existing_work_report_detail(
                db=db,
                work_report_detail_id=work_report_detail_id,
                include_deleted=False,
                for_update=True,
            )
        )

        WorkReportDetailService._ensure_employee_exists(
            db=db,
            employee_code=updated_by,
            detail=UPDATED_BY_EMPLOYEE_NOT_FOUND_DETAIL,
        )

        work_report_detail.mark_flag = True
        work_report_detail.is_active = False
        work_report_detail.updated_by = updated_by

        try:
            db.commit()
        except IntegrityError as exc:
            WorkReportDetailService._rollback_integrity_error(
                db=db,
                exc=exc,
            )

        return WorkReportDetailService._get_existing_work_report_detail(
            db=db,
            work_report_detail_id=work_report_detail_id,
            include_deleted=True,
        )
