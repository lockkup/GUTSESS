from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.constants import DBConstants
from app.schemas.employees import EmployeesResponse
from app.services.employees import EmployeesService

router = APIRouter()

EMPLOYEES_NOT_FOUND_DETAIL = "Employees not found"


@router.get(
    "/",
    response_model=list[EmployeesResponse],
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
    return EmployeesService.get_employees(db=db, skip=skip, limit=limit)


@router.get(
    "/{employee_code}",
    response_model=EmployeesResponse,
    summary="Get Employees By Code",
)
def get_employees_by_code(
    employee_code: str = Path(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    ),
    db: Session = Depends(get_db),
) -> EmployeesResponse:
    employees = EmployeesService.get_employee_by_code(
        db=db,
        employee_code=employee_code,
    )

    if employees is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=EMPLOYEES_NOT_FOUND_DETAIL,
        )

    return employees