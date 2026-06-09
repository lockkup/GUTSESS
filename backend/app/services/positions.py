from __future__ import annotations

from typing import Any

from sqlalchemy import func, select, update

from app.core import response
from app.core.db.engine import get_session
from app.models.positions import Position
from app.schemas.positions import PositionCreate, PositionUpdate


class PositionService:
    @staticmethod
    def _to_dict(row: Position) -> dict[str, Any]:
        return {
            "position_id": row.position_id,
            "position_name": row.position_name,
            "is_active": row.is_active,
            "position_detail": row.position_detail,
            "created_at": row.created_at,
            "updated_at": row.updated_at,
            "created_by": row.created_by,
            "updated_by": row.updated_by,
        }

    def list_positions(self) -> list[dict[str, Any]]:
        with get_session() as session:
            rows = (
                session.execute(
                    select(Position).order_by(Position.position_id.desc())
                )
                .scalars()
                .all()
            )

            return [self._to_dict(row) for row in rows]

    def create_position(self, payload: PositionCreate) -> dict[str, Any]:
        data = payload.model_dump()

        with get_session() as session:
            position_entry = Position(
                position_name=data["position_name"],
                is_active=data.get("is_active", True),
                position_detail=data.get("position_detail"),
                created_by=data["created_by"],
                updated_by=data["created_by"],
                created_at=func.now(),
                updated_at=func.now(),
            )

            session.add(position_entry)
            session.commit()
            session.refresh(position_entry)

            return self._to_dict(position_entry)

    def get_position(self, position_id: int) -> dict[str, Any]:
        with get_session() as session:
            row = (
                session.execute(
                    select(Position).where(Position.position_id == position_id)
                )
                .scalars()
                .first()
            )

            if not row:
                raise response.error("CLIENT.ER_CLIENT_2002")

            return self._to_dict(row)

    def update_position(
        self,
        position_id: int,
        payload: PositionUpdate,
    ) -> dict[str, Any]:
        updates = payload.model_dump(exclude_unset=True)

        if not updates:
            raise response.error("CLIENT.ER_CLIENT_2001")

        updates["updated_at"] = func.now()

        with get_session() as session:
            existing = (
                session.execute(
                    select(Position.position_id).where(
                        Position.position_id == position_id
                    )
                )
                .first()
            )

            if not existing:
                raise response.error("CLIENT.ER_CLIENT_2002")

            session.execute(
                update(Position)
                .where(Position.position_id == position_id)
                .values(**updates)
            )
            session.commit()

        return self.get_position(position_id)

    def delete_position(self, position_id: int) -> dict[str, str]:
        """
        Soft delete:
        ไม่ลบ row จริงออกจาก MySQL เพราะ positions เป็นตาราง master
        และอาจถูกอ้างอิงจาก employees หรือข้อมูลย้อนหลัง
        """

        with get_session() as session:
            existing = (
                session.execute(
                    select(Position.position_id).where(
                        Position.position_id == position_id
                    )
                )
                .first()
            )

            if not existing:
                raise response.error("CLIENT.ER_CLIENT_2002")

            session.execute(
                update(Position)
                .where(Position.position_id == position_id)
                .values(
                    is_active=False,
                    updated_at=func.now(),
                )
            )
            session.commit()

        return {"detail": "Position deactivated successfully"}