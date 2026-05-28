# app/schemas/checkpoint_location.py

from pydantic import BaseModel, ConfigDict, Field


class VerifyCheckpointLocationRequest(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    # ใช้เป็นตัวหลักในการหา location จากฐานข้อมูล
    assignment_id: int = Field(..., gt=0)

    # ใช้ประกอบการแสดงผล / debug เท่านั้น
    # backend ไม่ควรใช้ unit_name เป็นตัวค้นหาหลัก
    unit_name: str | None = None

    # ตำแหน่งปัจจุบันจากมือถือ
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)

    # ความคลาดเคลื่อน GPS หน่วยเมตร
    accuracy: int | None = Field(default=None, ge=0)


class VerifyCheckpointLocationResponse(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    allowed: bool
    message: str

    # ระยะห่างระหว่าง GPS ปัจจุบันกับจุดตรวจในฐานข้อมูล
    distance_meter: float | None = None

    # รัศมีที่ใช้ตัดสิน เช่น radius_meter + grace_meter
    radius_meter: float | None = None

    # accuracy ที่ frontend ส่งมา
    accuracy: int | None = None

    # ส่งกลับไว้ debug
    assignment_id: int | None = None
    unit_name: str | None = None