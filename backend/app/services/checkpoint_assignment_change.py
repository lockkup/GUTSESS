from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import exists, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.constants import DBConstants
from app.core.error_messages import (
    CHECKPOINT_ASSIGNMENT_CHANGE_NOT_FOUND_DETAIL,
    CHECKPOINT_ASSIGNMENT_NOT_FOUND_DETAIL,
    EMPLOYEE_NOT_FOUND_DETAIL,
    INVALID_CHECKPOINT_ASSIGNMENT_CHANGE_ACTION_DETAIL,
    INVALID_REFERENCE_DETAIL,
)
from app.models.checkpoint_assignment import CheckpointAssignment
from app.models.checkpoint_assignment_change import CheckpointAssignmentChange
from app.models.employees import Employees
from app.schemas.checkpoint_assignment_change import (
    CheckpointAssignmentChangeAction,
)


class CheckpointAssignmentChangeService:
    @staticmethod
    def _get_employee_or_404(
        db: Session,
        employee_code: str,
    ) -> Employees:
        employee_code = employee_code.strip()

        stmt = select(Employees).where(
            Employees.employee_code == employee_code
        )

        employee = db.scalar(stmt)

        if employee is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=EMPLOYEE_NOT_FOUND_DETAIL,
            )

        return employee

    @staticmethod
    def _ensure_assignment_exists(
        db: Session,
        assignment_id: int,
    ) -> None:
        stmt = select(
            exists().where(
                CheckpointAssignment.assignment_id == assignment_id
            )
        )

        if not db.scalar(stmt):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=CHECKPOINT_ASSIGNMENT_NOT_FOUND_DETAIL,
            )

    @staticmethod
    def _build_user_name(employee: Employees) -> str:
        user_name = getattr(employee, "user_name", None)

        if isinstance(user_name, str) and user_name.strip():
            return user_name.strip()

        first_name = getattr(employee, "first_name", "") or ""
        last_name = getattr(employee, "last_name", "") or ""

        full_name = f"{first_name} {last_name}".strip()

        if full_name:
            return full_name

        return employee.employee_code

    @staticmethod
    def _normalize_action(
        action: CheckpointAssignmentChangeAction | str,
    ) -> str:
        if isinstance(action, CheckpointAssignmentChangeAction):
            return action.value

        action_value = action.strip()

        if not action_value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=INVALID_CHECKPOINT_ASSIGNMENT_CHANGE_ACTION_DETAIL,
            )

        if len(action_value) > DBConstants.CHECKPOINT_ASSIGNMENT_CHANGE_ACTION_LENGTH:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=INVALID_CHECKPOINT_ASSIGNMENT_CHANGE_ACTION_DETAIL,
            )

        return action_value

    @staticmethod
    def create_checkpoint_assignment_change(
        db: Session,
        employee_code: str,
        assignment_id: int,
        action: CheckpointAssignmentChangeAction | str,
        commit: bool = True,
    ) -> CheckpointAssignmentChange:
        employee_code = employee_code.strip()
        action_value = CheckpointAssignmentChangeService._normalize_action(
            action
        )

        employee = CheckpointAssignmentChangeService._get_employee_or_404(
            db=db,
            employee_code=employee_code,
        )

        CheckpointAssignmentChangeService._ensure_assignment_exists(
            db=db,
            assignment_id=assignment_id,
        )

        checkpoint_assignment_change = CheckpointAssignmentChange(
            employee_code=employee_code,
            assignment_id=assignment_id,
            user_name=CheckpointAssignmentChangeService._build_user_name(
                employee
            ),
            action=action_value,
        )

        try:
            db.add(checkpoint_assignment_change)

            if commit:
                db.commit()
                db.refresh(checkpoint_assignment_change)
            else:
                db.flush()

        except IntegrityError as exc:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=INVALID_REFERENCE_DETAIL,
            ) from exc

        return checkpoint_assignment_change

    @staticmethod
    def get_checkpoint_assignment_changes(
        db: Session,
        skip: int = DBConstants.DEFAULT_PAGE_SKIP,
        limit: int = DBConstants.DEFAULT_PAGE_LIMIT,
        employee_code: str | None = None,
        assignment_id: int | None = None,
    ) -> list[CheckpointAssignmentChange]:
        stmt = select(CheckpointAssignmentChange)

        if employee_code is not None:
            employee_code = employee_code.strip()

            stmt = stmt.where(
                CheckpointAssignmentChange.employee_code == employee_code
            )

        if assignment_id is not None:
            stmt = stmt.where(
                CheckpointAssignmentChange.assignment_id == assignment_id
            )

        stmt = (
            stmt.order_by(
                CheckpointAssignmentChange
                .checkpoint_assignment_change_id
                .desc()
            )
            .offset(skip)
            .limit(limit)
        )

        return list(db.scalars(stmt).all())

    @staticmethod
    def get_checkpoint_assignment_change_by_id(
        db: Session,
        checkpoint_assignment_change_id: int,
    ) -> CheckpointAssignmentChange:
        stmt = select(CheckpointAssignmentChange).where(
            CheckpointAssignmentChange.checkpoint_assignment_change_id
            == checkpoint_assignment_change_id
        )

        checkpoint_assignment_change = db.scalar(stmt)

        if checkpoint_assignment_change is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=CHECKPOINT_ASSIGNMENT_CHANGE_NOT_FOUND_DETAIL,
            )

        return checkpoint_assignment_change