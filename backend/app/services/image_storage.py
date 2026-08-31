# app/services/image_storage.py

from __future__ import annotations

import base64
import binascii
import re
from datetime import date
from pathlib import Path
from typing import Final


class ImageStorageError(Exception):
    """
    Error สำหรับงานจัดเก็บรูปภาพ

    ให้ Service ที่เรียกใช้งานเป็นผู้แปลงเป็น HTTPException
    ตาม business context ของตัวเอง
    """

    pass


class ImageStorageService:
    """
    จัดการไฟล์รูปภาพของระบบ GUTS ESS

    Phase 1:
    - checkin
    - checkout

    โครงสร้างไฟล์:

    uploads/
    └── time_record/
        └── YYYY/
            └── MM/
                └── employee_code/
                    └── time_record_id/
                        ├── checkin/
                        │   ├── 001.jpg
                        │   └── 002.jpg
                        └── checkout/
                            ├── 001.jpg
                            └── 002.jpg
    """

    # ============================================================
    # Paths
    # ============================================================

    # ตัวอย่าง:
    #
    # D:\Projects\guts-ess\
    # ├── backend\
    # ├── frontend\
    # └── uploads\
    #
    # image_storage.py อยู่ที่:
    # backend/app/services/image_storage.py
    PROJECT_ROOT: Final[Path] = Path(__file__).resolve().parents[3]

    UPLOAD_ROOT: Final[Path] = PROJECT_ROOT / "uploads"

    PUBLIC_UPLOAD_PREFIX: Final[str] = "/uploads"

    # ============================================================
    # Phase 1 image types
    # ============================================================

    ALLOWED_IMAGE_TYPES: Final[frozenset[str]] = frozenset(
        {
            "checkin",
            "checkout",
        }
    )

    # ============================================================
    # Supported image formats
    # ============================================================

    MIME_TO_EXTENSION: Final[dict[str, str]] = {
        "image/jpeg": ".jpg",
        "image/jpg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
    }

    DATA_URI_PATTERN: Final[re.Pattern[str]] = re.compile(
        r"^data:(image/(?:jpeg|jpg|png|webp));base64$",
        re.IGNORECASE,
    )

    # ============================================================
    # Validation
    # ============================================================

    @staticmethod
    def _validate_employee_code(employee_code: str) -> str:
        cleaned_value = employee_code.strip()

        if not cleaned_value:
            raise ImageStorageError("employee_code is required")

        # ป้องกัน path traversal เช่น ../../
        if not re.fullmatch(r"[A-Za-z0-9_-]+", cleaned_value):
            raise ImageStorageError("employee_code contains invalid characters")

        return cleaned_value

    @classmethod
    def _validate_image_type(cls, image_type: str) -> str:
        cleaned_value = image_type.strip().lower()

        if cleaned_value not in cls.ALLOWED_IMAGE_TYPES:
            raise ImageStorageError(
                f"Unsupported image_type: {cleaned_value}"
            )

        return cleaned_value

    @staticmethod
    def _validate_time_record_id(time_record_id: int) -> int:
        if time_record_id <= 0:
            raise ImageStorageError(
                "time_record_id must be greater than 0"
            )

        return time_record_id

    @staticmethod
    def _validate_sequence_no(sequence_no: int) -> int:
        if sequence_no <= 0:
            raise ImageStorageError(
                "sequence_no must be greater than 0"
            )

        return sequence_no

    # ============================================================
    # Base64
    # ============================================================

    @classmethod
    def _decode_base64_image(
        cls,
        image_base64: str,
    ) -> tuple[bytes, str]:
        """
        รองรับทั้ง:

        data:image/jpeg;base64,/9j/4AAQ...
        และ
        /9j/4AAQ...

        คืนค่า:
        (
            image_bytes,
            extension,
        )
        """

        cleaned_value = image_base64.strip()

        if not cleaned_value:
            raise ImageStorageError("Image data is empty")

        declared_mime_type: str | None = None
        encoded_value = cleaned_value

        # --------------------------------------------------------
        # Data URI
        # --------------------------------------------------------

        if cleaned_value.lower().startswith("data:"):
            try:
                header, encoded_value = cleaned_value.split(",", 1)
            except ValueError as exc:
                raise ImageStorageError(
                    "Invalid image data URI"
                ) from exc

            match = cls.DATA_URI_PATTERN.fullmatch(header.strip())

            if match is None:
                raise ImageStorageError(
                    "Unsupported image data URI"
                )

            declared_mime_type = match.group(1).lower()

            if declared_mime_type == "image/jpg":
                declared_mime_type = "image/jpeg"

        # --------------------------------------------------------
        # ลบ whitespace ที่อาจติดมากับ Base64
        # --------------------------------------------------------

        encoded_value = "".join(encoded_value.split())

        if not encoded_value:
            raise ImageStorageError("Image Base64 data is empty")

        # --------------------------------------------------------
        # Decode
        # --------------------------------------------------------

        try:
            image_bytes = base64.b64decode(
                encoded_value,
                validate=True,
            )
        except (ValueError, binascii.Error) as exc:
            raise ImageStorageError(
                "Invalid Base64 image data"
            ) from exc

        if not image_bytes:
            raise ImageStorageError("Decoded image is empty")

        # --------------------------------------------------------
        # ตรวจชนิดไฟล์จาก Binary จริง
        # --------------------------------------------------------

        detected_mime_type = cls._detect_mime_type(image_bytes)

        if detected_mime_type is None:
            raise ImageStorageError(
                "Unsupported or invalid image file"
            )

        # ถ้ามี MIME จาก data URI ต้องตรงกับ binary จริง
        if (
            declared_mime_type is not None
            and declared_mime_type != detected_mime_type
        ):
            raise ImageStorageError(
                "Image MIME type does not match image data"
            )

        extension = cls.MIME_TO_EXTENSION[detected_mime_type]

        return image_bytes, extension

    @staticmethod
    def _detect_mime_type(
        image_bytes: bytes,
    ) -> str | None:
        """
        ตรวจชนิดภาพจาก file signature
        """

        # JPEG
        if image_bytes.startswith(b"\xff\xd8\xff"):
            return "image/jpeg"

        # PNG
        if image_bytes.startswith(
            b"\x89PNG\r\n\x1a\n"
        ):
            return "image/png"

        # WEBP
        if (
            len(image_bytes) >= 12
            and image_bytes[0:4] == b"RIFF"
            and image_bytes[8:12] == b"WEBP"
        ):
            return "image/webp"

        return None

    # ============================================================
    # Path
    # ============================================================

    @classmethod
    def _build_relative_directory(
        cls,
        work_date: date,
        employee_code: str,
        time_record_id: int,
        image_type: str,
    ) -> Path:
        return (
            Path("time_record")
            / f"{work_date.year:04d}"
            / f"{work_date.month:02d}"
            / employee_code
            / str(time_record_id)
            / image_type
        )

    @classmethod
    def _build_public_path(
        cls,
        relative_file_path: Path,
    ) -> str:
        """
        Windows:
        time_record\\2026\\08\\632070\\1001\\checkin\\001.jpg

        DB:
        /uploads/time_record/2026/08/632070/1001/checkin/001.jpg
        """

        return (
            f"{cls.PUBLIC_UPLOAD_PREFIX}/"
            f"{relative_file_path.as_posix()}"
        )

    # ============================================================
    # Save
    # ============================================================

    @classmethod
    def save_time_record_image(
        cls,
        *,
        image_base64: str,
        work_date: date,
        employee_code: str,
        time_record_id: int,
        image_type: str,
        sequence_no: int,
    ) -> str:
        """
        บันทึกรูป TimeRecord

        ตัวอย่าง:

        save_time_record_image(
            image_base64=payload.images_checkin_1,
            work_date=date(2026, 8, 19),
            employee_code="632070",
            time_record_id=1001,
            image_type="checkin",
            sequence_no=1,
        )

        คืนค่า:

        /uploads/time_record/2026/08/632070/1001/checkin/001.jpg
        """

        employee_code = cls._validate_employee_code(
            employee_code
        )

        image_type = cls._validate_image_type(
            image_type
        )

        time_record_id = cls._validate_time_record_id(
            time_record_id
        )

        sequence_no = cls._validate_sequence_no(
            sequence_no
        )

        image_bytes, extension = cls._decode_base64_image(
            image_base64
        )

        relative_directory = cls._build_relative_directory(
            work_date=work_date,
            employee_code=employee_code,
            time_record_id=time_record_id,
            image_type=image_type,
        )

        absolute_directory = (
            cls.UPLOAD_ROOT / relative_directory
        )

        try:
            absolute_directory.mkdir(
                parents=True,
                exist_ok=True,
            )
        except OSError as exc:
            raise ImageStorageError(
                "Unable to create image directory"
            ) from exc

        filename = f"{sequence_no:03d}{extension}"

        relative_file_path = (
            relative_directory / filename
        )

        absolute_file_path = (
            cls.UPLOAD_ROOT / relative_file_path
        )

        # --------------------------------------------------------
        # Atomic-ish write
        #
        # เขียน .tmp ก่อน แล้วค่อย replace เป็นไฟล์จริง
        # ลดโอกาสได้ไฟล์ไม่สมบูรณ์หากเขียนไฟล์ล้มเหลวกลางทาง
        # --------------------------------------------------------

        temporary_file_path = absolute_file_path.with_name(
            f"{absolute_file_path.name}.tmp"
        )

        try:
            temporary_file_path.write_bytes(image_bytes)
            temporary_file_path.replace(absolute_file_path)
        except OSError as exc:
            try:
                if temporary_file_path.exists():
                    temporary_file_path.unlink()
            except OSError:
                pass

            raise ImageStorageError(
                "Unable to save image file"
            ) from exc

        return cls._build_public_path(
            relative_file_path
        )

    # ============================================================
    # Resolve DB path → physical path
    # ============================================================

    @classmethod
    def resolve_image_path(
        cls,
        image_path: str,
    ) -> Path:
        """
        แปลง:

        /uploads/time_record/2026/08/632070/1001/checkin/001.jpg

        เป็น physical path:

        D:\\Projects\\guts-ess\\uploads\\time_record\\...
        """

        cleaned_value = image_path.strip()

        expected_prefix = (
            f"{cls.PUBLIC_UPLOAD_PREFIX}/"
        )

        if not cleaned_value.startswith(expected_prefix):
            raise ImageStorageError(
                "Invalid upload image path"
            )

        relative_value = cleaned_value[
            len(expected_prefix):
        ]

        relative_path = Path(relative_value)

        upload_root = cls.UPLOAD_ROOT.resolve()

        absolute_path = (
            upload_root / relative_path
        ).resolve()

        # ป้องกัน ../ หลุดออกจาก uploads
        if (
            absolute_path != upload_root
            and upload_root not in absolute_path.parents
        ):
            raise ImageStorageError(
                "Invalid upload image path"
            )

        return absolute_path

    # ============================================================
    # Delete
    # ============================================================

    @classmethod
    def delete_image(
        cls,
        image_path: str,
    ) -> None:
        """
        ใช้สำหรับ rollback / cleanup รูปที่บันทึกแล้ว
        """

        absolute_path = cls.resolve_image_path(
            image_path
        )

        try:
            if absolute_path.is_file():
                absolute_path.unlink()
        except OSError as exc:
            raise ImageStorageError(
                "Unable to delete image file"
            ) from exc

    @classmethod
    def delete_images(
        cls,
        image_paths: list[str],
    ) -> None:
        """
        ลบหลายรูป

        ใช้กรณี DB transaction ล้มเหลวหลังจากบันทึกไฟล์แล้ว
        """

        errors: list[Exception] = []

        for image_path in image_paths:
            try:
                cls.delete_image(image_path)
            except ImageStorageError as exc:
                errors.append(exc)

        if errors:
            raise ImageStorageError(
                "Unable to delete one or more image files"
            )