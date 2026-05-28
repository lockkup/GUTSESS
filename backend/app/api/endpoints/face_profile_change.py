from __future__ import annotations

from fastapi import APIRouter, Depends, Path, Query, status
from sqlalchemy.orm import Session

from app.core import get_db
from app.core.constants import DBConstants
from app.schemas.face_profile_change import (
    FaceProfileChangeCreate,
    FaceProfileChangeResponse,
)
from app.services.face_profile_change import FaceProfileChangeService

router = APIRouter()


@router.post(
    "/",
    response_model=FaceProfileChangeResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_face_profile_change(
    payload: FaceProfileChangeCreate,
    db: Session = Depends(get_db),
) -> FaceProfileChangeResponse:
    return FaceProfileChangeService.create_face_profile_change(
        db=db,
        payload=payload,
    )


@router.get(
    "/{face_profile_change_id}",
    response_model=FaceProfileChangeResponse,
    status_code=status.HTTP_200_OK,
)
def get_face_profile_change_by_id(
    face_profile_change_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
) -> FaceProfileChangeResponse:
    return FaceProfileChangeService.get_face_profile_change_by_id(
        db=db,
        face_profile_change_id=face_profile_change_id,
    )


@router.get(
    "/",
    response_model=list[FaceProfileChangeResponse],
    status_code=status.HTTP_200_OK,
)
def get_face_profile_changes(
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
    face_profile_id: int | None = Query(default=None, gt=0),
    db: Session = Depends(get_db),
) -> list[FaceProfileChangeResponse]:
    return FaceProfileChangeService.get_face_profile_changes(
        db=db,
        skip=skip,
        limit=limit,
        employee_code=employee_code,
        face_profile_id=face_profile_id,
    )