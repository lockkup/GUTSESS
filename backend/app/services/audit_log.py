from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.constants import DBConstants
from app.models.audit_log import AuditLog
from app.models.employees import Employees
from app.schemas.audit_log import AuditLogCreate

AUDIT_LOG_NOT_FOUND_DETAIL = "Audit log not found"
EMPLOYEES_NOT_FOUND_DETAIL = "Employees not found"
INVALID_REFERENCE_DETAIL = "Invalid reference data"


class AuditLogService:
    @staticmethod
    def _get_employees_by_code(
        db: Session,
        employee_code: str,
    ) -> Employees | None:
        stmt = select(Employees).where(Employees.employee_code == employee_code)
        return db.scalar(stmt)

    @staticmethod
    def _validate_employees_reference(
        db: Session,
        employee_code: str | None,
    ) -> None:
        if employee_code is None:
            return

        employees = AuditLogService._get_employees_by_code(db, employee_code)
        if employees is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=EMPLOYEES_NOT_FOUND_DETAIL,
            )

    @staticmethod
    def create_audit_log(
        db: Session,
        payload: AuditLogCreate,
    ) -> AuditLog:
        employee_code = payload.employee_code.strip() if payload.employee_code is not None else None
        user_name = payload.user_name.strip()
        ip_address = payload.ip_address.strip()
        action = payload.action.strip()

        AuditLogService._validate_employees_reference(db, employee_code)

        audit_log = AuditLog(
            employee_code=employee_code,
            user_name=user_name,
            ip_address=ip_address,
            action=action,
        )

        try:
            db.add(audit_log)
            db.commit()
            db.refresh(audit_log)
        except IntegrityError:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=INVALID_REFERENCE_DETAIL,
            )

        return audit_log

    @staticmethod
    def get_audit_log_by_id(
        db: Session,
        log_id: int,
    ) -> AuditLog | None:
        stmt = select(AuditLog).where(AuditLog.log_id == log_id)
        return db.scalar(stmt)

    @staticmethod
    def get_audit_logs(
        db: Session,
        skip: int = 0,
        limit: int = DBConstants.DEFAULT_PAGE_LIMIT,
        employee_code: str | None = None,
        user_name: str | None = None,
    ) -> list[AuditLog]:
        stmt = select(AuditLog)

        clean_employee_code = employee_code.strip() if employee_code is not None else None
        if clean_employee_code:
            stmt = stmt.where(AuditLog.employee_code == clean_employee_code)

        clean_user_name = user_name.strip() if user_name is not None else None
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

        return db.scalars(stmt).all()