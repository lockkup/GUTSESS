from __future__ import annotations

from typing import Any

from sqlalchemy import func, select, update

from app.core import response
from app.core.db.engine import get_session
from app.models.departments import Department
from app.schemas.departments import DepartmentCreate, DepartmentUpdate


class DepartmentService:
    @staticmethod
    def _to_dict(row: Department) -> dict[str, Any]:
        return {
            "department_id": row.department_id,
            "department_name": row.department_name,
            "field_id": row.field_id,
            "is_active": row.is_active,
            "created_at": row.created_at,
            "updated_at": row.updated_at,
            "created_by": row.created_by,
            "updated_by": row.updated_by,
        }

    def list_departments(self) -> list[dict[str, Any]]:
        with get_session() as session:
            rows = (
                session.execute(
                    select(Department).order_by(Department.department_id.desc())
                )
                .scalars()
                .all()
            )

            return [self._to_dict(row) for row in rows]

    def create_department(self, payload: DepartmentCreate) -> dict[str, Any]:
        data = payload.model_dump()

        with get_session() as session:
            department_entry = Department(
                department_name=data["department_name"],
                field_id=data["field_id"],
                is_active=data.get("is_active", True),
                created_by=data["created_by"],
                updated_by=data["created_by"],
                created_at=func.now(),
                updated_at=func.now(),
            )

            session.add(department_entry)
            session.commit()
            session.refresh(department_entry)

            return self._to_dict(department_entry)

    def get_department(self, department_id: int) -> dict[str, Any]:
        with get_session() as session:
            row = (
                session.execute(
                    select(Department).where(
                        Department.department_id == department_id
                    )
                )
                .scalars()
                .first()
            )

            if not row:
                raise response.error("CLIENT.ER_CLIENT_2002")

            return self._to_dict(row)

    def update_department(
        self,
        department_id: int,
        payload: DepartmentUpdate,
    ) -> dict[str, Any]:
        updates = payload.model_dump(exclude_unset=True)

        if not updates:
            raise response.error("CLIENT.ER_CLIENT_2001")

        updates["updated_at"] = func.now()

        with get_session() as session:
            existing = (
                session.execute(
                    select(Department).where(
                        Department.department_id == department_id
                    )
                )
                .scalars()
                .first()
            )

            if not existing:
                raise response.error("CLIENT.ER_CLIENT_2002")

            session.execute(
                update(Department)
                .where(Department.department_id == department_id)
                .values(**updates)
            )
            session.commit()

        return self.get_department(department_id)

    def delete_department(self, department_id: int) -> dict[str, str]:
        """
        Soft delete:
        ไม่ลบ row จริงออกจาก MySQL เพราะ departments เป็นตาราง master
        และอาจถูกอ้างอิงจาก employees / divisions / reports
        """

        with get_session() as session:
            existing = (
                session.execute(
                    select(Department.department_id).where(
                        Department.department_id == department_id
                    )
                )
                .first()
            )

            if not existing:
                raise response.error("CLIENT.ER_CLIENT_2002")

            session.execute(
                update(Department)
                .where(Department.department_id == department_id)
                .values(
                    is_active=False,
                    updated_at=func.now(),
                )
            )
            session.commit()

        return {"detail": "Department deactivated successfully"}