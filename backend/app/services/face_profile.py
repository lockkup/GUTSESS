from __future__ import annotations

import json
import math
import shutil
import uuid
from pathlib import Path
from typing import Any

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.constants import DBConstants
from app.core.error_messages import (
    CREATED_BY_EMPLOYEE_NOT_FOUND_DETAIL,
    EMBEDDING_DIMENSION_MISMATCH_DETAIL,
    EMPLOYEE_NOT_FOUND_DETAIL,
    FACE_EMBEDDING_INVALID_DIMENSION_DETAIL,
    FACE_EMBEDDING_MUST_BE_FINITE_DETAIL,
    FACE_EMBEDDING_MUST_BE_LIST_DETAIL,
    FACE_EMBEDDING_MUST_BE_NUMBERS_DETAIL,
    FACE_EMBEDDING_MUST_BE_VALID_JSON_DETAIL,
    FACE_EMBEDDING_PENDING_DETAIL,
    FACE_MATCHED_DETAIL,
    FACE_NOT_MATCHED_DETAIL,
    FACE_PROFILE_NOT_FOUND_DETAIL,
    INVALID_REFERENCE_DETAIL,
    REFERENCE_IMAGE_REQUIRED_DETAIL,
    STORED_FACE_EMBEDDING_INVALID_JSON_DETAIL,
    STORED_FACE_EMBEDDING_NOT_FOUND_DETAIL,
    UPDATED_BY_EMPLOYEE_NOT_FOUND_DETAIL,
    UPLOADED_FILE_MUST_BE_IMAGE_DETAIL,
)
from app.models.employees import Employees
from app.models.face_profile import FaceProfile
from app.models.face_profile_change import FaceProfileChange
from app.schemas.face_profile import FaceProfileCreate, FaceProfileUpdate
from app.schemas.face_verify import FaceVerifyRequest


class FaceProfileService:
    UPLOAD_DIR = Path("uploads/face_profiles")

    @staticmethod
    def _get_employee_or_404(
        db: Session,
        employee_code: str,
        detail: str = EMPLOYEE_NOT_FOUND_DETAIL,
    ) -> Employees:
        clean_employee_code = employee_code.strip()

        stmt = select(Employees).where(
            Employees.employee_code == clean_employee_code,
        )
        employee = db.scalar(stmt)

        if employee is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=detail,
            )

        return employee

    @staticmethod
    def _get_actor_name(
        db: Session,
        employee_code: str,
        not_found_detail: str,
    ) -> str:
        employee = FaceProfileService._get_employee_or_404(
            db=db,
            employee_code=employee_code,
            detail=not_found_detail,
        )

        first_name = str(getattr(employee, "first_name", "") or "").strip()
        last_name = str(getattr(employee, "last_name", "") or "").strip()
        full_name = f"{first_name} {last_name}".strip()

        return full_name or employee.employee_code

    @staticmethod
    def _get_face_profile_or_404(
        db: Session,
        face_profile_id: int,
        include_deleted: bool = False,
    ) -> FaceProfile:
        stmt = select(FaceProfile).where(
            FaceProfile.face_profile_id == face_profile_id,
        )

        if not include_deleted:
            stmt = stmt.where(FaceProfile.mark_flag.is_(False))

        face_profile = db.scalar(stmt)

        if face_profile is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=FACE_PROFILE_NOT_FOUND_DETAIL,
            )

        return face_profile

    @staticmethod
    def _save_image(
        image_file: UploadFile,
        employee_code: str,
    ) -> str:
        if image_file is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=REFERENCE_IMAGE_REQUIRED_DETAIL,
            )

        if not image_file.content_type or not image_file.content_type.startswith(
            "image/"
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=UPLOADED_FILE_MUST_BE_IMAGE_DETAIL,
            )

        FaceProfileService.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

        suffix = Path(image_file.filename or "").suffix.lower() or ".jpg"
        filename = f"{employee_code}_{uuid.uuid4().hex}{suffix}"
        file_path = FaceProfileService.UPLOAD_DIR / filename

        with file_path.open("wb") as buffer:
            shutil.copyfileobj(image_file.file, buffer)

        return str(file_path).replace("\\", "/")

    @staticmethod
    def _remove_file(file_path: str | None) -> None:
        if not file_path:
            return

        try:
            Path(file_path).unlink(missing_ok=True)
        except OSError:
            pass

    @staticmethod
    def _normalize_embedding_list(face_embedding: Any) -> list[float]:
        if face_embedding is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=FACE_EMBEDDING_MUST_BE_LIST_DETAIL,
            )

        if not isinstance(face_embedding, list):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=FACE_EMBEDDING_MUST_BE_LIST_DETAIL,
            )

        if len(face_embedding) != DBConstants.FACE_EMBEDDING_DIMENSION:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=FACE_EMBEDDING_INVALID_DIMENSION_DETAIL,
            )

        try:
            normalized = [float(value) for value in face_embedding]
        except (TypeError, ValueError) as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=FACE_EMBEDDING_MUST_BE_NUMBERS_DETAIL,
            ) from exc

        if not all(math.isfinite(value) for value in normalized):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=FACE_EMBEDDING_MUST_BE_FINITE_DETAIL,
            )

        return normalized

    @staticmethod
    def _normalize_embedding_json(face_embedding_json: str) -> str:
        clean_face_embedding_json = face_embedding_json.strip()

        try:
            parsed = json.loads(clean_face_embedding_json)
        except json.JSONDecodeError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=FACE_EMBEDDING_MUST_BE_VALID_JSON_DETAIL,
            ) from exc

        normalized = FaceProfileService._normalize_embedding_list(parsed)
        return json.dumps(normalized)

    @staticmethod
    def _prepare_embedding_value(
        face_embedding_json: str | None,
        default_to_pending: bool,
    ) -> str | None:
        if face_embedding_json and face_embedding_json.strip():
            return FaceProfileService._normalize_embedding_json(face_embedding_json)

        if default_to_pending:
            return DBConstants.FACE_PENDING_EMBEDDING_VALUE

        return None

    @staticmethod
    def _parse_stored_embedding(raw_embedding: str | None) -> list[float]:
        if not raw_embedding:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=STORED_FACE_EMBEDDING_NOT_FOUND_DETAIL,
            )

        if raw_embedding.strip() == DBConstants.FACE_PENDING_EMBEDDING_VALUE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=FACE_EMBEDDING_PENDING_DETAIL,
            )

        try:
            parsed = json.loads(raw_embedding)
        except json.JSONDecodeError as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=STORED_FACE_EMBEDDING_INVALID_JSON_DETAIL,
            ) from exc

        return FaceProfileService._normalize_embedding_list(parsed)

    @staticmethod
    def _euclidean_distance(
        v1: list[float],
        v2: list[float],
    ) -> float:
        if len(v1) != len(v2):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=EMBEDDING_DIMENSION_MISMATCH_DETAIL,
            )

        return math.sqrt(sum((a - b) ** 2 for a, b in zip(v1, v2)))

    @staticmethod
    def _add_change_log(
        db: Session,
        face_profile: FaceProfile,
        action: str,
        user_name: str,
    ) -> None:
        face_profile_change = FaceProfileChange(
            employee_code=face_profile.employee_code,
            face_profile_id=face_profile.face_profile_id,
            user_name=user_name,
            action=action,
        )
        db.add(face_profile_change)

    @staticmethod
    def _deactivate_other_active_face_profiles(
        db: Session,
        employee_code: str,
        updated_by: str,
        actor_name: str,
        exclude_face_profile_id: int | None = None,
    ) -> None:
        stmt = select(FaceProfile).where(
            FaceProfile.employee_code == employee_code,
            FaceProfile.is_active.is_(True),
            FaceProfile.mark_flag.is_(False),
        )

        if exclude_face_profile_id is not None:
            stmt = stmt.where(
                FaceProfile.face_profile_id != exclude_face_profile_id,
            )

        face_profiles = db.scalars(stmt).all()

        for face_profile in face_profiles:
            face_profile.is_active = False
            face_profile.updated_by = updated_by

            FaceProfileService._add_change_log(
                db=db,
                face_profile=face_profile,
                action="AUTO_DEACTIVATE",
                user_name=actor_name,
            )

    @staticmethod
    def _get_latest_active_face_profile(
        db: Session,
        employee_code: str,
    ) -> FaceProfile:
        clean_employee_code = employee_code.strip()

        stmt = (
            select(FaceProfile)
            .where(
                FaceProfile.employee_code == clean_employee_code,
                FaceProfile.is_active.is_(True),
                FaceProfile.mark_flag.is_(False),
            )
            .order_by(FaceProfile.face_profile_id.desc())
            .limit(1)
        )

        face_profile = db.scalar(stmt)

        if face_profile is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=FACE_PROFILE_NOT_FOUND_DETAIL,
            )

        return face_profile

    @staticmethod
    def verify_face(
        db: Session,
        payload: FaceVerifyRequest,
    ) -> dict[str, object]:
        employee_code = payload.employee_code.strip()

        FaceProfileService._get_employee_or_404(
            db=db,
            employee_code=employee_code,
        )

        face_profile = FaceProfileService._get_latest_active_face_profile(
            db=db,
            employee_code=employee_code,
        )

        stored_embedding = FaceProfileService._parse_stored_embedding(
            face_profile.face_embedding,
        )
        incoming_embedding = FaceProfileService._normalize_embedding_list(
            payload.face_embedding,
        )

        distance = FaceProfileService._euclidean_distance(
            stored_embedding,
            incoming_embedding,
        )
        threshold = DBConstants.FACE_VERIFY_THRESHOLD
        is_match = distance <= threshold

        return {
            "is_match": is_match,
            "message": FACE_MATCHED_DETAIL if is_match else FACE_NOT_MATCHED_DETAIL,
            "distance": round(distance, 6),
            "threshold": threshold,
        }

    @staticmethod
    def get_face_profiles(
        db: Session,
        skip: int = DBConstants.DEFAULT_PAGE_SKIP,
        limit: int = DBConstants.DEFAULT_PAGE_LIMIT,
        is_active: bool | None = None,
        include_deleted: bool = False,
    ) -> list[FaceProfile]:
        stmt = select(FaceProfile)

        if not include_deleted:
            stmt = stmt.where(FaceProfile.mark_flag.is_(False))

        if is_active is not None:
            stmt = stmt.where(FaceProfile.is_active.is_(is_active))

        stmt = (
            stmt.order_by(FaceProfile.face_profile_id.desc())
            .offset(skip)
            .limit(limit)
        )

        return list(db.scalars(stmt).all())

    @staticmethod
    def get_face_profile_by_id(
        db: Session,
        face_profile_id: int,
        include_deleted: bool = False,
    ) -> FaceProfile:
        return FaceProfileService._get_face_profile_or_404(
            db=db,
            face_profile_id=face_profile_id,
            include_deleted=include_deleted,
        )

    @staticmethod
    def create_face_profile(
        db: Session,
        payload: FaceProfileCreate,
        image_file: UploadFile,
        face_embedding_json: str | None = None,
    ) -> FaceProfile:
        data = payload.model_dump()

        data["employee_code"] = data["employee_code"].strip()
        data["created_by"] = data["created_by"].strip()

        FaceProfileService._get_employee_or_404(
            db=db,
            employee_code=data["employee_code"],
        )
        actor_name = FaceProfileService._get_actor_name(
            db=db,
            employee_code=data["created_by"],
            not_found_detail=CREATED_BY_EMPLOYEE_NOT_FOUND_DETAIL,
        )

        saved_path: str | None = None

        try:
            saved_path = FaceProfileService._save_image(
                image_file=image_file,
                employee_code=data["employee_code"],
            )
            data["reference_image"] = saved_path
            data["face_embedding"] = FaceProfileService._prepare_embedding_value(
                face_embedding_json=face_embedding_json,
                default_to_pending=True,
            )
            data["mark_flag"] = False

            face_profile = FaceProfile(**data)

            db.add(face_profile)
            db.flush()

            if face_profile.is_active:
                FaceProfileService._deactivate_other_active_face_profiles(
                    db=db,
                    employee_code=face_profile.employee_code,
                    updated_by=data["created_by"],
                    actor_name=actor_name,
                    exclude_face_profile_id=face_profile.face_profile_id,
                )

            FaceProfileService._add_change_log(
                db=db,
                face_profile=face_profile,
                action="CREATE",
                user_name=actor_name,
            )

            db.commit()
            db.refresh(face_profile)

        except HTTPException:
            db.rollback()
            FaceProfileService._remove_file(saved_path)
            raise

        except IntegrityError as exc:
            db.rollback()
            FaceProfileService._remove_file(saved_path)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=INVALID_REFERENCE_DETAIL,
            ) from exc

        return face_profile

    @staticmethod
    def update_face_profile(
        db: Session,
        face_profile_id: int,
        payload: FaceProfileUpdate,
        image_file: UploadFile | None = None,
        face_embedding_json: str | None = None,
    ) -> FaceProfile:
        face_profile = FaceProfileService._get_face_profile_or_404(
            db=db,
            face_profile_id=face_profile_id,
            include_deleted=False,
        )

        update_data = payload.model_dump(
            exclude_unset=True,
            exclude_none=True,
        )

        updated_by = update_data["updated_by"].strip()
        actor_name = FaceProfileService._get_actor_name(
            db=db,
            employee_code=updated_by,
            not_found_detail=UPDATED_BY_EMPLOYEE_NOT_FOUND_DETAIL,
        )
        update_data["updated_by"] = updated_by

        old_reference_image = face_profile.reference_image
        saved_path: str | None = None

        try:
            if image_file is not None:
                saved_path = FaceProfileService._save_image(
                    image_file=image_file,
                    employee_code=face_profile.employee_code,
                )
                update_data["reference_image"] = saved_path
                update_data["face_embedding"] = (
                    FaceProfileService._prepare_embedding_value(
                        face_embedding_json=face_embedding_json,
                        default_to_pending=True,
                    )
                )

            else:
                prepared_embedding = FaceProfileService._prepare_embedding_value(
                    face_embedding_json=face_embedding_json,
                    default_to_pending=False,
                )
                if prepared_embedding is not None:
                    update_data["face_embedding"] = prepared_embedding

            for field, value in update_data.items():
                setattr(face_profile, field, value)

            if face_profile.is_active and not face_profile.mark_flag:
                FaceProfileService._deactivate_other_active_face_profiles(
                    db=db,
                    employee_code=face_profile.employee_code,
                    updated_by=updated_by,
                    actor_name=actor_name,
                    exclude_face_profile_id=face_profile.face_profile_id,
                )

            FaceProfileService._add_change_log(
                db=db,
                face_profile=face_profile,
                action="UPDATE",
                user_name=actor_name,
            )

            db.commit()
            db.refresh(face_profile)

        except HTTPException:
            db.rollback()
            FaceProfileService._remove_file(saved_path)
            raise

        except IntegrityError as exc:
            db.rollback()
            FaceProfileService._remove_file(saved_path)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=INVALID_REFERENCE_DETAIL,
            ) from exc

        if saved_path and old_reference_image != saved_path:
            FaceProfileService._remove_file(old_reference_image)

        return face_profile

    @staticmethod
    def _change_face_profile_state(
        db: Session,
        face_profile_id: int,
        updated_by: str,
        is_active: bool,
        mark_flag: bool,
        action: str,
    ) -> FaceProfile:
        face_profile = FaceProfileService._get_face_profile_or_404(
            db=db,
            face_profile_id=face_profile_id,
            include_deleted=False,
        )

        clean_updated_by = updated_by.strip()
        actor_name = FaceProfileService._get_actor_name(
            db=db,
            employee_code=clean_updated_by,
            not_found_detail=UPDATED_BY_EMPLOYEE_NOT_FOUND_DETAIL,
        )

        face_profile.is_active = is_active
        face_profile.mark_flag = mark_flag
        face_profile.updated_by = clean_updated_by

        try:
            if face_profile.is_active and not face_profile.mark_flag:
                FaceProfileService._deactivate_other_active_face_profiles(
                    db=db,
                    employee_code=face_profile.employee_code,
                    updated_by=clean_updated_by,
                    actor_name=actor_name,
                    exclude_face_profile_id=face_profile.face_profile_id,
                )

            FaceProfileService._add_change_log(
                db=db,
                face_profile=face_profile,
                action=action,
                user_name=actor_name,
            )

            db.commit()
            db.refresh(face_profile)

        except IntegrityError as exc:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=INVALID_REFERENCE_DETAIL,
            ) from exc

        return face_profile

    @staticmethod
    def deactivate_face_profile(
        db: Session,
        face_profile_id: int,
        updated_by: str,
    ) -> FaceProfile:
        return FaceProfileService._change_face_profile_state(
            db=db,
            face_profile_id=face_profile_id,
            updated_by=updated_by,
            is_active=False,
            mark_flag=False,
            action="DEACTIVATE",
        )

    @staticmethod
    def activate_face_profile(
        db: Session,
        face_profile_id: int,
        updated_by: str,
    ) -> FaceProfile:
        return FaceProfileService._change_face_profile_state(
            db=db,
            face_profile_id=face_profile_id,
            updated_by=updated_by,
            is_active=True,
            mark_flag=False,
            action="ACTIVATE",
        )

    @staticmethod
    def delete_face_profile(
        db: Session,
        face_profile_id: int,
        updated_by: str,
    ) -> FaceProfile:
        return FaceProfileService._change_face_profile_state(
            db=db,
            face_profile_id=face_profile_id,
            updated_by=updated_by,
            is_active=False,
            mark_flag=True,
            action="DELETE",
        )