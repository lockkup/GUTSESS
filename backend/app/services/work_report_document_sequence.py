from __future__ import annotations

from datetime import date

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.dialects.mysql import insert as mysql_insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.error_messages import INVALID_REFERENCE_DETAIL
from app.models.work_report_document_sequence import (
    WorkReportDocumentSequence,
)


MAX_DOCUMENT_SEQUENCE = 99


class WorkReportDocumentSequenceService:
    @staticmethod
    def get_by_contract_and_date(
        db: Session,
        contract_code: str,
        document_date: date,
    ) -> WorkReportDocumentSequence | None:
        clean_contract_code = contract_code.strip()

        stmt = select(WorkReportDocumentSequence).where(
            WorkReportDocumentSequence.contract_code
            == clean_contract_code,
            WorkReportDocumentSequence.document_date
            == document_date,
        )

        return db.scalar(stmt)

    @staticmethod
    def reserve_next_sequence(
        db: Session,
        contract_code: str,
        document_date: date,
    ) -> int:
        """
        จองเลข running ถัดไปแบบ atomic แยกตาม
        contract_code + document_date

        สำคัญ:
        - method นี้ไม่ commit transaction
        - caller ต้อง commit พร้อมกับการสร้าง work_report
        - หาก caller rollback การเพิ่ม last_sequence จะ rollback ตามไปด้วย
        """

        clean_contract_code = contract_code.strip()

        if not clean_contract_code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=INVALID_REFERENCE_DETAIL,
            )

        insert_stmt = mysql_insert(
            WorkReportDocumentSequence
        ).values(
            contract_code=clean_contract_code,
            document_date=document_date,
            last_sequence=1,
        )

        upsert_stmt = insert_stmt.on_duplicate_key_update(
            last_sequence=(
                WorkReportDocumentSequence.last_sequence + 1
            ),
        )

        try:
            db.execute(upsert_stmt)

            sequence_stmt = select(
                WorkReportDocumentSequence.last_sequence
            ).where(
                WorkReportDocumentSequence.contract_code
                == clean_contract_code,
                WorkReportDocumentSequence.document_date
                == document_date,
            )

            next_sequence = db.scalar(sequence_stmt)

        except IntegrityError as exc:
            db.rollback()

            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=INVALID_REFERENCE_DETAIL,
            ) from exc

        if next_sequence is None:
            db.rollback()

            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=INVALID_REFERENCE_DETAIL,
            )

        if next_sequence > MAX_DOCUMENT_SEQUENCE:
            db.rollback()

            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Work report document number sequence "
                    "exceeded 99 for this contract and date"
                ),
            )

        return int(next_sequence)

    @staticmethod
    def generate_document_no(
        db: Session,
        contract_code: str,
        document_date: date,
    ) -> str:
        clean_contract_code = contract_code.strip()

        next_sequence = (
            WorkReportDocumentSequenceService.reserve_next_sequence(
                db=db,
                contract_code=clean_contract_code,
                document_date=document_date,
            )
        )

        buddhist_year = document_date.year + 543

        date_part = (
            f"{document_date.day:02d}"
            f"{document_date.month:02d}"
            f"{buddhist_year:04d}"
        )

        return (
            f"{clean_contract_code}_"
            f"{date_part}_"
            f"{next_sequence:02d}"
        )
