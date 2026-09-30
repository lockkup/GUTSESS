

from datetime import date
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator


_NON_NULLABLE_UPDATE_FIELDS = (
    "contract_code",
    "document_date",
    "last_sequence",
)


class WorkReportDocumentSequenceBase(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    contract_code: str = Field(
        ...,
        min_length=1,
        max_length=50,
    )

    document_date: date

    last_sequence: int = Field(
        default=0,
        ge=0,
        le=99,
    )


class WorkReportDocumentSequenceCreate(
    WorkReportDocumentSequenceBase
):
    pass


class WorkReportDocumentSequenceUpdate(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    contract_code: str | None = Field(
        default=None,
        min_length=1,
        max_length=50,
    )

    document_date: date | None = None

    last_sequence: int | None = Field(
        default=None,
        ge=0,
        le=99,
    )

    @model_validator(mode="before")
    @classmethod
    def validate_no_null_for_required_db_fields(
        cls,
        data: Any,
    ) -> Any:
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


class WorkReportDocumentSequenceResponse(
    WorkReportDocumentSequenceBase
):
    model_config = ConfigDict(
        from_attributes=True,
        extra="forbid",
        str_strip_whitespace=True,
    )

    sequence_id: int = Field(
        ...,
        gt=0,
    )
