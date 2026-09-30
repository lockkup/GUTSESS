from datetime import date

from sqlalchemy import Date, String, UniqueConstraint
from sqlalchemy.dialects.mysql import BIGINT, INTEGER
from sqlalchemy.orm import Mapped, mapped_column

from app.core.orm import Base


class WorkReportDocumentSequence(Base):
    __tablename__ = "work_report_document_sequence"

    __table_args__ = (
        UniqueConstraint(
            "contract_code",
            "document_date",
            name="uq_work_report_document_sequence",
        ),
    )

    sequence_id: Mapped[int] = mapped_column(
        BIGINT(unsigned=True),
        primary_key=True,
        autoincrement=True,
    )

    contract_code: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    document_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
    )

    last_sequence: Mapped[int] = mapped_column(
        INTEGER(unsigned=True),
        nullable=False,
        default=0,
    )