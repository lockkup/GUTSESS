from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.core.constants import DBConstants
from app.schemas.work_report_purpose_selection import (
    WorkReportPurposeSelectionResponse,
)


WorkReportStatus = Literal[
    "active",
    "cancelled",
]


_NON_NULLABLE_UPDATE_FIELDS = (
    "purpose_selections",
)


class WorkReportPurposeSelectionInput(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    purpose_id: int = Field(
        ...,
        gt=0,
    )

    purpose_detail: str | None = Field(
        default=None,
        max_length=500,
    )


class WorkReportBase(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    time_record_id: int = Field(
        ...,
        gt=0,
    )

    additional_note: str | None = Field(
        default=None,
        max_length=500,
    )

    client_first_name: str | None = Field(
        default=None,
        max_length=DBConstants.FIRST_NAME_LENGTH,
    )

    client_last_name: str | None = Field(
        default=None,
        max_length=DBConstants.LAST_NAME_LENGTH,
    )

    client_position: str | None = Field(
        default=None,
        max_length=DBConstants.WORK_REPORT_SIGNATURE_POSITION_LENGTH,
    )

    signature_path: str | None = Field(
        default=None,
        max_length=DBConstants.WORK_REPORT_SIGNATURE_PATH_LENGTH,
    )


class WorkReportCreate(WorkReportBase):
    purpose_selections: list[WorkReportPurposeSelectionInput] = Field(
        ...,
        min_length=1,
        max_length=3,
    )

    @model_validator(mode="after")
    def validate_unique_purpose_selections(self) -> WorkReportCreate:
        purpose_ids = [
            item.purpose_id
            for item in self.purpose_selections
        ]

        if len(purpose_ids) != len(set(purpose_ids)):
            raise ValueError(
                "purpose_selections contains duplicate purpose_id"
            )

        return self


class WorkReportUpdate(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    purpose_selections: (
        list[WorkReportPurposeSelectionInput] | None
    ) = Field(
        default=None,
        min_length=1,
        max_length=3,
    )

    additional_note: str | None = Field(
        default=None,
        max_length=500,
    )

    client_first_name: str | None = Field(
        default=None,
        max_length=DBConstants.FIRST_NAME_LENGTH,
    )

    client_last_name: str | None = Field(
        default=None,
        max_length=DBConstants.LAST_NAME_LENGTH,
    )

    client_position: str | None = Field(
        default=None,
        max_length=DBConstants.WORK_REPORT_SIGNATURE_POSITION_LENGTH,
    )

    signature_path: str | None = Field(
        default=None,
        max_length=DBConstants.WORK_REPORT_SIGNATURE_PATH_LENGTH,
    )

    updated_by: str = Field(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )

    @model_validator(mode="before")
    @classmethod
    def validate_no_null_for_required_db_fields(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data

        null_fields = [
            field
            for field in _NON_NULLABLE_UPDATE_FIELDS
            if field in data and data[field] is None
        ]

        if null_fields:
            raise ValueError(
                f"{', '.join(null_fields)} cannot be null"
            )

        return data

    @model_validator(mode="after")
    def validate_unique_purpose_selections(
        self,
    ) -> WorkReportUpdate:
        if self.purpose_selections is None:
            return self

        purpose_ids = [
            item.purpose_id
            for item in self.purpose_selections
        ]

        if len(purpose_ids) != len(set(purpose_ids)):
            raise ValueError(
                "purpose_selections contains duplicate purpose_id"
            )

        return self


class WorkReportAction(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    updated_by: str = Field(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )


class WorkReportResponse(WorkReportBase):
    model_config = ConfigDict(
        from_attributes=True,
        extra="forbid",
        str_strip_whitespace=True,
    )

    work_report_id: int = Field(
        ...,
        gt=0,
    )

    document_no: str | None = Field(
        default=None,
        max_length=50,
    )

    report_status: WorkReportStatus

    is_active: bool

    purpose_selections: list[WorkReportPurposeSelectionResponse] = Field(
        default_factory=list,
    )

    signature_datetime: datetime | None = None

    mark_flag: bool

    created_at: datetime
    updated_at: datetime

    created_by: str = Field(
        ...,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )

    updated_by: str | None = Field(
        default=None,
        min_length=DBConstants.EMPLOYEE_CODE_LENGTH,
        max_length=DBConstants.EMPLOYEE_CODE_LENGTH,
    )
