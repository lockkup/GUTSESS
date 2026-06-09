# backend/app/services/employee_permissions.py
from __future__ import annotations

import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.employee_permissions import EmployeePermission
from app.schemas.employee_permissions import (
    EmployeePermissionCreate,
    EmployeePermissionUpdate,
)

logger = logging.getLogger(__name__)


class EmployeePermissionService:
    @staticmethod
    def create(
        db: Session,
        permission_in: EmployeePermissionCreate,
    ) -> EmployeePermission:
        db_obj = EmployeePermission(**permission_in.model_dump())

        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)

        return db_obj

    @staticmethod
    def get_by_employee_code(
        db: Session,
        employee_code: str,
    ) -> list[EmployeePermission]:
        stmt = (
            select(EmployeePermission)
            .where(EmployeePermission.employee_code == employee_code)
            .order_by(EmployeePermission.permissions_name.asc())
        )

        return list(db.scalars(stmt).all())

    @staticmethod
    def get_active_by_employee_code(
        db: Session,
        employee_code: str,
    ) -> list[EmployeePermission]:
        stmt = (
            select(EmployeePermission)
            .where(
                EmployeePermission.employee_code == employee_code,
                EmployeePermission.is_active.is_(True),
            )
            .order_by(EmployeePermission.permissions_name.asc())
        )

        return list(db.scalars(stmt).all())

    @staticmethod
    def get_active_permission_names(
        db: Session,
        employee_code: str,
    ) -> list[str]:
        stmt = select(EmployeePermission.permissions_name).where(
            EmployeePermission.employee_code == employee_code,
            EmployeePermission.is_active.is_(True),
        )

        return list(db.scalars(stmt).all())

    @staticmethod
    def has_permission(
        db: Session,
        employee_code: str,
        permissions_name: str,
    ) -> bool:
        stmt = select(EmployeePermission).where(
            EmployeePermission.employee_code == employee_code,
            EmployeePermission.permissions_name == permissions_name,
            EmployeePermission.is_active.is_(True),
        )

        return db.scalar(stmt) is not None

    @staticmethod
    def get_specific_permission(
        db: Session,
        employee_code: str,
        permissions_name: str,
    ) -> EmployeePermission | None:
        stmt = select(EmployeePermission).where(
            EmployeePermission.employee_code == employee_code,
            EmployeePermission.permissions_name == permissions_name,
        )

        return db.scalar(stmt)

    @staticmethod
    def update(
        db: Session,
        employee_code: str,
        permissions_name: str,
        permission_in: EmployeePermissionUpdate,
    ) -> EmployeePermission | None:
        db_obj = EmployeePermissionService.get_specific_permission(
            db=db,
            employee_code=employee_code,
            permissions_name=permissions_name,
        )

        if db_obj is None:
            return None

        update_data = permission_in.model_dump(exclude_unset=True)

        for field, value in update_data.items():
            setattr(db_obj, field, value)

        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)

        return db_obj

    @staticmethod
    def delete(
        db: Session,
        employee_code: str,
        permissions_name: str,
    ) -> bool:
        db_obj = EmployeePermissionService.get_specific_permission(
            db=db,
            employee_code=employee_code,
            permissions_name=permissions_name,
        )

        if db_obj is None:
            return False

        db.delete(db_obj)
        db.commit()

        return True

    @staticmethod
    def soft_delete(
        db: Session,
        employee_code: str,
        permissions_name: str,
        updated_by: str | None = None,
    ) -> EmployeePermission | None:
        db_obj = EmployeePermissionService.get_specific_permission(
            db=db,
            employee_code=employee_code,
            permissions_name=permissions_name,
        )

        if db_obj is None:
            return None

        db_obj.is_active = False

        if hasattr(db_obj, "updated_by"):
            db_obj.updated_by = updated_by

        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)

        return db_obj


employee_permission_service = EmployeePermissionService()
employee_permissions_service = employee_permission_service