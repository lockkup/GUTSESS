from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import exists, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.constants import DBConstants
from app.core.error_messages import (
    AUDIT_LOG_NOT_FOUND_DETAIL,
    EMPLOYEE_NOT_FOUND_DETAIL,
    INVALID_REFERENCE_DETAIL,
)
from app.models.audit_log import AuditLog
from app.models.employees import Employees
from app.schemas.audit_log import AuditLogCreate


class AuditLogService:
    @staticmethod
    def _validate_employee_exists(
        db: Session,
        employee_code: str | None,
    ) -> None:
        if employee_code is None:
            return

        stmt = select(
            exists().where(Employees.employee_code == employee_code)
        )

        if not db.scalar(stmt):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=EMPLOYEE_NOT_FOUND_DETAIL,
            )

    @staticmethod
    def create_audit_log(
        db: Session,
        payload: AuditLogCreate,
    ) -> AuditLog:
        AuditLogService._validate_employee_exists(
            db=db,
            employee_code=payload.employee_code,
        )

        audit_log = AuditLog(
            employee_code=payload.employee_code,
            user_name=payload.user_name,
            ip_address=payload.ip_address,
            action=payload.action,
        )

        try:
            db.add(audit_log)
            db.commit()
            db.refresh(audit_log)
        except IntegrityError as exc:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=INVALID_REFERENCE_DETAIL,
            ) from exc

        return audit_log

    @staticmethod
    def get_audit_log_by_id(
        db: Session,
        log_id: int,
    ) -> AuditLog:
        stmt = select(AuditLog).where(AuditLog.log_id == log_id)
        audit_log = db.scalar(stmt)

        if audit_log is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=AUDIT_LOG_NOT_FOUND_DETAIL,
            )

        return audit_log

    @staticmethod
    def get_audit_logs(
        db: Session,
        skip: int = DBConstants.DEFAULT_PAGE_SKIP,
        limit: int = DBConstants.DEFAULT_PAGE_LIMIT,
        employee_code: str | None = None,
        user_name: str | None = None,
    ) -> list[AuditLog]:
        stmt = select(AuditLog)

        clean_employee_code = (
            employee_code.strip()
            if employee_code is not None
            else None
        )
        if clean_employee_code:
            stmt = stmt.where(AuditLog.employee_code == clean_employee_code)

        clean_user_name = (
            user_name.strip()
            if user_name is not None
            else None
        )
        if clean_user_name:
            stmt = stmt.where(AuditLog.user_name.contains(clean_user_name))

        stmt = (
            stmt.order_by(
                AuditLog.timestamp.desc(),
                AuditLog.log_id.desc(),
            )
            .offset(skip)
            .limit(limit)
        )

        return list(db.scalars(stmt).all())