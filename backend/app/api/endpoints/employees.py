from __future__ import annotations

from fastapi import APIRouter, Depends, Path, Query, status
from sqlalchemy.orm import Session

from app.core import get_db
from app.core.constants import DBConstants
from app.schemas.employees import EmployeesResponse
from app.services.employees import EmployeesService

router = APIRouter()


@router.get(
    "/",
    response_model=list[EmployeesResponse],
    status_code=status.HTTP_200_OK,
    summary="Get Employees",
)
def get_employees(
    skip: int = Query(DBConstants.DEFAULT_PAGE_SKIP, ge=0),
    limit: int = Query(
        DBConstants.DEFAULT_PAGE_LIMIT,
        ge=1,
        le=DBConstants.MAX_PAGE_LIMIT,
    ),
    db: Session = Depends(get_db),
) -> list[EmployeesResponse]:
    return EmployeesService.get_employees(
        db=db,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/{employee_code}",
    response_model=EmployeesResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Employee By Code",
)
def get_employee_by_code(
    employee_code: str = Path(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    ),
    db: Session = Depends(get_db),
) -> EmployeesResponse:
    return EmployeesService.get_employee_by_code(
        db=db,
        employee_code=employee_code,
    )