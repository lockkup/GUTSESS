from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status, Form, File, UploadFile
from sqlalchemy.orm import Session

from app.core import get_db
from app.core.constants import DBConstants
from app.schemas.face_profile import FaceProfileCreate, FaceProfileResponse, FaceProfileUpdate
from app.schemas.face_verify import FaceVerifyRequest, FaceVerifyResponse
from app.services.face_profile import FaceProfileService

router = APIRouter()

FACE_PROFILE_NOT_FOUND_DETAIL = "Face profile not found"


@router.post(
    "/verify",
    response_model=FaceVerifyResponse,
    status_code=status.HTTP_200_OK,
)
def verify_face_profile(
    payload: FaceVerifyRequest,
    db: Session = Depends(get_db),
) -> FaceVerifyResponse:
    result = FaceProfileService.verify_face(
        db=db,
        payload=payload,
    )
    return FaceVerifyResponse(**result)


@router.post(
    "/",
    response_model=FaceProfileResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_face_profile(
    employee_code: str = Form(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    ),
    is_active: bool = Form(True),
    created_by: str = Form(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    ),
    face_embedding: str | None = Form(default=None),
    reference_image: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> FaceProfileResponse:
    payload = FaceProfileCreate(
        employee_code=employee_code,
        is_active=is_active,
        created_by=created_by,
    )
    return FaceProfileService.create_face_profile(
        db=db,
        payload=payload,
        image_file=reference_image,
        face_embedding_json=face_embedding,
    )


@router.get(
    "/",
    response_model=list[FaceProfileResponse],
    status_code=status.HTTP_200_OK,
)
def get_face_profiles(
    skip: int = Query(DBConstants.DEFAULT_PAGE_SKIP, ge=0),
    limit: int = Query(
        DBConstants.DEFAULT_PAGE_LIMIT,
        ge=1,
        le=DBConstants.MAX_PAGE_LIMIT,
    ),
    is_active: bool | None = Query(default=None),
    include_deleted: bool = Query(default=False),
    db: Session = Depends(get_db),
) -> list[FaceProfileResponse]:
    return FaceProfileService.get_face_profiles(
        db=db,
        skip=skip,
        limit=limit,
        is_active=is_active,
        include_deleted=include_deleted,
    )


@router.get(
    "/{face_profile_id}",
    response_model=FaceProfileResponse,
    status_code=status.HTTP_200_OK,
)
def get_face_profile_by_id(
    face_profile_id: int = Path(..., gt=0),
    include_deleted: bool = Query(default=False),
    db: Session = Depends(get_db),
) -> FaceProfileResponse:
    face_profile = FaceProfileService.get_face_profile_by_id(
        db=db,
        face_profile_id=face_profile_id,
        include_deleted=include_deleted,
    )
    if face_profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=FACE_PROFILE_NOT_FOUND_DETAIL,
        )
    return face_profile


@router.patch(
    "/{face_profile_id}",
    response_model=FaceProfileResponse,
    status_code=status.HTTP_200_OK,
)
def update_face_profile(
    face_profile_id: int = Path(..., gt=0),
    is_active: bool | None = Form(default=None),
    updated_by: str = Form(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    ),
    face_embedding: str | None = Form(default=None),
    reference_image: UploadFile | None = File(default=None),
    db: Session = Depends(get_db),
) -> FaceProfileResponse:
    payload = FaceProfileUpdate(
        is_active=is_active,
        updated_by=updated_by,
    )

    face_profile = FaceProfileService.update_face_profile(
        db=db,
        face_profile_id=face_profile_id,
        payload=payload,
        image_file=reference_image,
        face_embedding_json=face_embedding,
    )
    if face_profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=FACE_PROFILE_NOT_FOUND_DETAIL,
        )
    return face_profile


@router.patch(
    "/{face_profile_id}/deactivate",
    response_model=FaceProfileResponse,
    status_code=status.HTTP_200_OK,
)
def deactivate_face_profile(
    face_profile_id: int = Path(..., gt=0),
    updated_by: str = Query(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    ),
    db: Session = Depends(get_db),
) -> FaceProfileResponse:
    face_profile = FaceProfileService.deactivate_face_profile(
        db=db,
        face_profile_id=face_profile_id,
        updated_by=updated_by,
    )
    if face_profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=FACE_PROFILE_NOT_FOUND_DETAIL,
        )
    return face_profile


@router.patch(
    "/{face_profile_id}/activate",
    response_model=FaceProfileResponse,
    status_code=status.HTTP_200_OK,
)
def activate_face_profile(
    face_profile_id: int = Path(..., gt=0),
    updated_by: str = Query(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    ),
    db: Session = Depends(get_db),
) -> FaceProfileResponse:
    face_profile = FaceProfileService.activate_face_profile(
        db=db,
        face_profile_id=face_profile_id,
        updated_by=updated_by,
    )
    if face_profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=FACE_PROFILE_NOT_FOUND_DETAIL,
        )
    return face_profile


@router.delete(
    "/{face_profile_id}",
    response_model=FaceProfileResponse,
    status_code=status.HTTP_200_OK,
)
def delete_face_profile(
    face_profile_id: int = Path(..., gt=0),
    updated_by: str = Query(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    ),
    db: Session = Depends(get_db),
) -> FaceProfileResponse:
    face_profile = FaceProfileService.delete_face_profile(
        db=db,
        face_profile_id=face_profile_id,
        updated_by=updated_by,
    )
    if face_profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=FACE_PROFILE_NOT_FOUND_DETAIL,
        )
    return face_profile