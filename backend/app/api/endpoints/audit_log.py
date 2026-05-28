from __future__ import annotations

from fastapi import APIRouter, Depends, Path, Query, status
from sqlalchemy.orm import Session

from app.core import get_db
from app.core.constants import DBConstants
from app.schemas.audit_log import AuditLogCreate, AuditLogResponse
from app.services.audit_log import AuditLogService

router = APIRouter()


@router.post(
    "/",
    response_model=AuditLogResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_audit_log(
    payload: AuditLogCreate,
    db: Session = Depends(get_db),
) -> AuditLogResponse:
    return AuditLogService.create_audit_log(
        db=db,
        payload=payload,
    )


@router.get(
    "/{log_id}",
    response_model=AuditLogResponse,
    status_code=status.HTTP_200_OK,
)
def get_audit_log_by_id(
    log_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
) -> AuditLogResponse:
    return AuditLogService.get_audit_log_by_id(
        db=db,
        log_id=log_id,
    )


@router.get(
    "/",
    response_model=list[AuditLogResponse],
    status_code=status.HTTP_200_OK,
)
def get_audit_logs(
    skip: int = Query(DBConstants.DEFAULT_PAGE_SKIP, ge=0),
    limit: int = Query(
        DBConstants.DEFAULT_PAGE_LIMIT,
        ge=1,
        le=DBConstants.MAX_PAGE_LIMIT,
    ),
    employee_code: str | None = Query(
        default=None,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    ),
    user_name: str | None = Query(
        default=None,
        min_length=1,
        max_length=DBConstants.USER_NAME_LENGTH,
    ),
    db: Session = Depends(get_db),
) -> list[AuditLogResponse]:
    return AuditLogService.get_audit_logs(
        db=db,
        skip=skip,
        limit=limit,
        employee_code=employee_code,
        user_name=user_name,
    )