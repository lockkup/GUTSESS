# backend/app/services/audit_logs.py
from __future__ import annotations

from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.db.engine import get_session
from app.models.audit_logs import AuditLog
from app.schemas.audit_logs import AuditLogCreate


def _to_dict(row: AuditLog) -> dict[str, Any]:
    return {
        "log_id": row.log_id,
        "employee_code": row.employee_code,
        "user_name": row.user_name,
        "ip_address": row.ip_address,
        "action": row.action,
        "timestamp": row.timestamp,
    }


class AuditLogService:
    @staticmethod
    def create_audit_log(
        db: Session,
        payload: AuditLogCreate,
    ) -> dict[str, Any]:
        data = payload.model_dump()

        audit_log = AuditLog(
            employee_code=data.get("employee_code"),
            user_name=data["user_name"],
            ip_address=data["ip_address"],
            action=data["action"],
        )

        db.add(audit_log)
        db.commit()
        db.refresh(audit_log)

        return _to_dict(audit_log)

    @staticmethod
    def get_audit_log_by_id(
        db: Session,
        log_id: int,
    ) -> dict[str, Any] | None:
        row = db.scalar(
            select(AuditLog).where(AuditLog.log_id == log_id)
        )

        if row is None:
            return None

        return _to_dict(row)

    @staticmethod
    def get_audit_logs(
        db: Session,
        skip: int = 0,
        limit: int = 100,
        employee_code: str | None = None,
        user_name: str | None = None,
    ) -> list[dict[str, Any]]:
        stmt = select(AuditLog)

        if employee_code:
            stmt = stmt.where(AuditLog.employee_code == employee_code)

        if user_name:
            stmt = stmt.where(AuditLog.user_name.contains(user_name))

        rows = (
            db.scalars(
                stmt.order_by(AuditLog.timestamp.desc(), AuditLog.log_id.desc())
                .offset(skip)
                .limit(limit)
            )
            .all()
        )

        return [_to_dict(row) for row in rows]

    def create(self, payload: AuditLogCreate | dict[str, Any]) -> dict[str, Any]:
        data = payload.model_dump() if hasattr(payload, "model_dump") else payload

        with get_session() as db:
            audit_log = AuditLog(
                employee_code=data.get("employee_code"),
                user_name=data["user_name"],
                ip_address=data["ip_address"],
                action=data["action"],
            )

            db.add(audit_log)
            db.commit()
            db.refresh(audit_log)

            return _to_dict(audit_log)

    def list_logs(
        self,
        employee_code: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> dict[str, Any]:
        with get_session() as db:
            stmt = select(AuditLog)

            if employee_code:
                stmt = stmt.where(AuditLog.employee_code == employee_code)

            total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0

            rows = (
                db.scalars(
                    stmt.order_by(AuditLog.timestamp.desc(), AuditLog.log_id.desc())
                    .offset(offset)
                    .limit(limit)
                )
                .all()
            )

            return {
                "total": total,
                "items": [_to_dict(row) for row in rows],
            }

    def get(self, log_id: int) -> dict[str, Any] | None:
        with get_session() as db:
            row = db.scalar(
                select(AuditLog).where(AuditLog.log_id == log_id)
            )

            if row is None:
                return None

            return _to_dict(row)


audit_log_service = AuditLogService()
audit_logs_service = audit_log_service