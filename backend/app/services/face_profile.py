from __future__ import annotations

import json
import math
import shutil
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.constants import INVALID_REFERENCE_DETAIL
from app.models.employees import Employees
from app.models.face_profile import FaceProfile
from app.schemas.face_profile import FaceProfileCreate, FaceProfileUpdate
from app.schemas.face_verify import FaceVerifyRequest


class FaceProfileService:
    UPLOAD_DIR = Path("uploads/face_profiles")
    VERIFY_THRESHOLD = 0.45
    PENDING_EMBEDDING_VALUE = "PENDING_EMBEDDING"

    @staticmethod
    def _validate_employee_reference(db: Session, employee_code: str) -> None:
        employee_code = employee_code.strip()

        employees = (
            db.query(Employees)
            .filter(Employees.employee_code == employee_code)
            .first()
        )
        if employees is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=INVALID_REFERENCE_DETAIL,
            )

    @staticmethod
    def _save_image(image_file: UploadFile, employee_code: str) -> str:
        if image_file is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Reference image is required",
            )

        if not image_file.content_type or not image_file.content_type.startswith("image/"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file must be an image",
            )

        FaceProfileService.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

        suffix = Path(image_file.filename or "").suffix or ".jpg"
        filename = f"{employee_code}_{uuid.uuid4().hex}{suffix}"
        file_path = FaceProfileService.UPLOAD_DIR / filename

        with file_path.open("wb") as buffer:
            shutil.copyfileobj(image_file.file, buffer)

        return str(file_path).replace("\\", "/")

    @staticmethod
    def _normalize_embedding_list(face_embedding: list[float]) -> list[float]:
        if not face_embedding:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="face_embedding is required",
            )

        try:
            normalized = [float(x) for x in face_embedding]
        except (TypeError, ValueError) as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="face_embedding must be a list of numbers",
            ) from exc

        if len(normalized) != 128:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="face_embedding must contain 128 values",
            )

        return normalized

    @staticmethod
    def _normalize_embedding_json(face_embedding_json: str) -> str:
        try:
            parsed = json.loads(face_embedding_json)
        except json.JSONDecodeError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="face_embedding must be valid JSON",
            ) from exc

        normalized = FaceProfileService._normalize_embedding_list(parsed)
        return json.dumps(normalized)

    @staticmethod
    def _parse_stored_embedding(raw_embedding: str | None) -> list[float]:
        if not raw_embedding:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Stored face embedding not found",
            )

        if raw_embedding.strip() == FaceProfileService.PENDING_EMBEDDING_VALUE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Face embedding is pending. Please update face profile first.",
            )

        try:
            parsed = json.loads(raw_embedding)
        except json.JSONDecodeError as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Stored face embedding is invalid JSON",
            ) from exc

        return FaceProfileService._normalize_embedding_list(parsed)

    @staticmethod
    def _euclidean_distance(v1: list[float], v2: list[float]) -> float:
        if len(v1) != len(v2):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Embedding dimension mismatch",
            )

        return math.sqrt(sum((a - b) ** 2 for a, b in zip(v1, v2)))

    @staticmethod
    def _get_latest_active_face_profile(
        db: Session,
        employee_code: str,
    ) -> FaceProfile:
        face_profile = (
            db.query(FaceProfile)
            .filter(
                FaceProfile.employee_code == employee_code,
                FaceProfile.is_active.is_(True),
                FaceProfile.mark_flag.is_(False),
            )
            .order_by(FaceProfile.face_profile_id.desc())
            .first()
        )

        if face_profile is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Face profile not found",
            )

        return face_profile

    @staticmethod
    def verify_face(
        db: Session,
        payload: FaceVerifyRequest,
    ) -> dict[str, object]:
        employee_code = payload.employee_code.strip()
        FaceProfileService._validate_employee_reference(db, employee_code)

        face_profile = FaceProfileService._get_latest_active_face_profile(
            db,
            employee_code,
        )

        stored_embedding = FaceProfileService._parse_stored_embedding(
            face_profile.face_embedding
        )
        incoming_embedding = FaceProfileService._normalize_embedding_list(
            payload.face_embedding
        )

        distance = FaceProfileService._euclidean_distance(
            stored_embedding,
            incoming_embedding,
        )
        threshold = FaceProfileService.VERIFY_THRESHOLD
        is_match = distance <= threshold

        if not is_match:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=(
                    f"Face not matched "
                    f"(distance={distance:.4f}, threshold={threshold:.4f})"
                ),
            )

        return {
            "is_match": True,
            "message": "Face matched",
            "distance": round(distance, 6),
            "threshold": threshold,
        }

    @staticmethod
    def get_face_profiles(
        db: Session,
        skip: int = 0,
        limit: int = 100,
        is_active: bool | None = None,
        include_deleted: bool = False,
    ) -> list[FaceProfile]:
        query = db.query(FaceProfile)

        if not include_deleted:
            query = query.filter(FaceProfile.mark_flag.is_(False))

        if is_active is not None:
            query = query.filter(FaceProfile.is_active.is_(is_active))

        return (
            query.order_by(FaceProfile.face_profile_id.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    @staticmethod
    def get_face_profile_by_id(
        db: Session,
        face_profile_id: int,
        include_deleted: bool = False,
    ) -> FaceProfile | None:
        query = db.query(FaceProfile).filter(
            FaceProfile.face_profile_id == face_profile_id
        )

        if not include_deleted:
            query = query.filter(FaceProfile.mark_flag.is_(False))

        return query.first()

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

        FaceProfileService._validate_employee_reference(db, data["employee_code"])
        FaceProfileService._validate_employee_reference(db, data["created_by"])

        saved_path = FaceProfileService._save_image(
            image_file,
            data["employee_code"],
        )
        data["reference_image"] = saved_path

        if face_embedding_json:
            data["face_embedding"] = FaceProfileService._normalize_embedding_json(
                face_embedding_json
            )
        else:
            data["face_embedding"] = FaceProfileService.PENDING_EMBEDDING_VALUE

        data["mark_flag"] = False

        face_profile = FaceProfile(**data)

        try:
            db.add(face_profile)
            db.commit()
            db.refresh(face_profile)
        except IntegrityError:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=INVALID_REFERENCE_DETAIL,
            )

        return face_profile

    @staticmethod
    def update_face_profile(
        db: Session,
        face_profile_id: int,
        payload: FaceProfileUpdate,
        image_file: UploadFile | None = None,
        face_embedding_json: str | None = None,
    ) -> FaceProfile | None:
        face_profile = FaceProfileService.get_face_profile_by_id(
            db=db,
            face_profile_id=face_profile_id,
            include_deleted=False,
        )
        if face_profile is None:
            return None

        update_data = payload.model_dump(exclude_unset=True)

        if image_file is not None:
            saved_path = FaceProfileService._save_image(
                image_file,
                face_profile.employee_code,
            )
            update_data["reference_image"] = saved_path

            if face_embedding_json:
                update_data["face_embedding"] = (
                    FaceProfileService._normalize_embedding_json(
                        face_embedding_json
                    )
                )
            else:
                update_data["face_embedding"] = (
                    FaceProfileService.PENDING_EMBEDDING_VALUE
                )

        elif face_embedding_json:
            update_data["face_embedding"] = FaceProfileService._normalize_embedding_json(
                face_embedding_json
            )

        if "updated_by" in update_data and update_data["updated_by"] is not None:
            update_data["updated_by"] = update_data["updated_by"].strip()
            FaceProfileService._validate_employee_reference(
                db,
                update_data["updated_by"],
            )

        for field, value in update_data.items():
            setattr(face_profile, field, value)

        try:
            db.commit()
            db.refresh(face_profile)
        except IntegrityError:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=INVALID_REFERENCE_DETAIL,
            )

        return face_profile

    @staticmethod
    def deactivate_face_profile(
        db: Session,
        face_profile_id: int,
        updated_by: str,
    ) -> FaceProfile | None:
        face_profile = FaceProfileService.get_face_profile_by_id(
            db=db,
            face_profile_id=face_profile_id,
            include_deleted=False,
        )
        if face_profile is None:
            return None

        updated_by = updated_by.strip()
        FaceProfileService._validate_employee_reference(db, updated_by)

        face_profile.is_active = False
        face_profile.updated_by = updated_by

        db.commit()
        db.refresh(face_profile)
        return face_profile

    @staticmethod
    def activate_face_profile(
        db: Session,
        face_profile_id: int,
        updated_by: str,
    ) -> FaceProfile | None:
        face_profile = FaceProfileService.get_face_profile_by_id(
            db=db,
            face_profile_id=face_profile_id,
            include_deleted=False,
        )
        if face_profile is None:
            return None

        updated_by = updated_by.strip()
        FaceProfileService._validate_employee_reference(db, updated_by)

        face_profile.is_active = True
        face_profile.updated_by = updated_by

        db.commit()
        db.refresh(face_profile)
        return face_profile

    @staticmethod
    def delete_face_profile(
        db: Session,
        face_profile_id: int,
        updated_by: str,
    ) -> FaceProfile | None:
        face_profile = FaceProfileService.get_face_profile_by_id(
            db=db,
            face_profile_id=face_profile_id,
            include_deleted=False,
        )
        if face_profile is None:
            return None

        updated_by = updated_by.strip()
        FaceProfileService._validate_employee_reference(db, updated_by)

        face_profile.mark_flag = True
        face_profile.is_active = False
        face_profile.updated_by = updated_by

        db.commit()
        db.refresh(face_profile)
        return face_profile