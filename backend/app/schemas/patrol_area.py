# app/schemas/patrol_area.py

from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.core.constants import DBConstants


class PatrolAreaSearchResponse(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
        extra="forbid",
        str_strip_whitespace=True,
    )

    # =========================================================
    # ความสัมพันธ์จาก route_site_location
    # =========================================================
    route_site_location_id: int = Field(
        ...,
        gt=0,
    )

    # =========================================================
    # ภาค จาก departments
    # =========================================================
    department_id: int = Field(
        ...,
        gt=0,
    )

    department_name: str = Field(
        ...,
        min_length=1,
        max_length=150,
    )

    # =========================================================
    # เขต จาก divisions
    # =========================================================
    division_id: int = Field(
        ...,
        gt=0,
    )

    division_name: str = Field(
        ...,
        min_length=1,
        max_length=150,
    )

    # =========================================================
    # เส้นทาง จาก routes
    # =========================================================
    routes_id: int = Field(
        ...,
        gt=0,
    )

    route_name: str = Field(
        ...,
        min_length=1,
        max_length=150,
    )

    # =========================================================
    # ข้อมูลจุดรักษาการณ์ จาก site_location
    # =========================================================
    location_id: int = Field(
        ...,
        gt=0,
    )

    contract_code: str = Field(
        ...,
        min_length=1,
        max_length=DBConstants.CONTRACT_CODE_LENGTH,
    )

    location_name: str = Field(
        ...,
        min_length=1,
        max_length=DBConstants.LOCATION_NAME_LENGTH,
    )

    location_detail: str | None = Field(
        default=None,
        max_length=DBConstants.LOCATION_DETAIL_LENGTH,
    )

    latitude: Decimal = Field(
        ...,
        ge=Decimal("-90"),
        le=Decimal("90"),
    )

    longitude: Decimal = Field(
        ...,
        ge=Decimal("-180"),
        le=Decimal("180"),
    )

    radius_meter: int = Field(
        ...,
        ge=0,
    )

    grace_meter: int = Field(
        ...,
        ge=0,
    )

    # รายการกลุ่มตรวจที่ Backend รวมวันตามผลัดแล้ว
    #
    # ตัวอย่าง:
    # [
    #     "วันจันทร์/พุธ ผลัดกลางวัน",
    #     "วันศุกร์/อาทิตย์ ผลัดกลางคืน",
    # ]
    patrol_rounds: list[str] = Field(
        default_factory=list,
    )

    updated_at: datetime