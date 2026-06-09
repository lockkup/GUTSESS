from __future__ import annotations

from typing import Any

from sqlalchemy import func, select, update

from app.core import response
from app.core.db.engine import get_session
from app.models.name_prefixs import NamePrefix
from app.schemas.name_prefixs import NamePrefixCreate, NamePrefixUpdate


class NamePrefixService:
    @staticmethod
    def _to_dict(row: NamePrefix) -> dict[str, Any]:
        return {
            "prefix_id": row.prefix_id,
            "prefix_name": row.prefix_name,
            "is_active": row.is_active,
            "created_at": row.created_at,
            "updated_at": row.updated_at,
            "created_by": row.created_by,
            "updated_by": row.updated_by,
        }

    def list_prefixes(self) -> list[dict[str, Any]]:
        with get_session() as session:
            rows = (
                session.execute(
                    select(NamePrefix).order_by(NamePrefix.prefix_id.desc())
                )
                .scalars()
                .all()
            )

            return [self._to_dict(row) for row in rows]

    def create_prefix(self, payload: NamePrefixCreate) -> dict[str, Any]:
        data = payload.model_dump()

        with get_session() as session:
            prefix_entry = NamePrefix(
                prefix_name=data["prefix_name"],
                is_active=data.get("is_active", True),
                created_by=data["created_by"],
                updated_by=data["created_by"],
                created_at=func.now(),
                updated_at=func.now(),
            )

            session.add(prefix_entry)
            session.commit()
            session.refresh(prefix_entry)

            return self._to_dict(prefix_entry)

    def get_prefix(self, prefix_id: int) -> dict[str, Any]:
        with get_session() as session:
            row = (
                session.execute(
                    select(NamePrefix).where(NamePrefix.prefix_id == prefix_id)
                )
                .scalars()
                .first()
            )

            if not row:
                raise response.error("CLIENT.ER_CLIENT_2002")

            return self._to_dict(row)

    def update_prefix(
        self,
        prefix_id: int,
        payload: NamePrefixUpdate,
    ) -> dict[str, Any]:
        updates = payload.model_dump(exclude_unset=True)

        if not updates:
            raise response.error("CLIENT.ER_CLIENT_2001")

        updates["updated_at"] = func.now()

        with get_session() as session:
            existing = (
                session.execute(
                    select(NamePrefix.prefix_id).where(
                        NamePrefix.prefix_id == prefix_id
                    )
                )
                .first()
            )

            if not existing:
                raise response.error("CLIENT.ER_CLIENT_2002")

            session.execute(
                update(NamePrefix)
                .where(NamePrefix.prefix_id == prefix_id)
                .values(**updates)
            )
            session.commit()

        return self.get_prefix(prefix_id)

    def delete_prefix(self, prefix_id: int) -> dict[str, str]:
        """
        Soft delete:
        ไม่ลบ row จริงออกจาก MySQL เพราะ name_prefixs เป็นตาราง master
        และอาจถูกอ้างอิงจาก employees หรือข้อมูลย้อนหลัง
        """

        with get_session() as session:
            existing = (
                session.execute(
                    select(NamePrefix.prefix_id).where(
                        NamePrefix.prefix_id == prefix_id
                    )
                )
                .first()
            )

            if not existing:
                raise response.error("CLIENT.ER_CLIENT_2002")

            session.execute(
                update(NamePrefix)
                .where(NamePrefix.prefix_id == prefix_id)
                .values(
                    is_active=False,
                    updated_at=func.now(),
                )
            )
            session.commit()

        return {"detail": "Name Prefix deactivated successfully"}