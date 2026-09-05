from __future__ import annotations

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core import get_db
from app.core.constants import DBConstants
from app.schemas.patrol_area import (
    PatrolAreaLocationUpdateRequest,
    PatrolAreaLocationUpdateResponse,
    PatrolAreaSearchResponse,
)
from app.services.patrol_area import PatrolAreaService

router = APIRouter()


@router.get(
    "/contract-codes",
    response_model=list[str],
    status_code=status.HTTP_200_OK,
)
def get_patrol_area_contract_codes(
    db: Session = Depends(get_db),
) -> list[str]:
    return PatrolAreaService.get_contract_codes(
        db=db,
    )


@router.get(
    "/search",
    response_model=list[PatrolAreaSearchResponse],
    status_code=status.HTTP_200_OK,
)
def search_patrol_areas(
    keyword: str | None = Query(
        default=None,
        min_length=1,
        max_length=DBConstants.PATROL_AREA_SEARCH_KEYWORD_LENGTH,
    ),
    contract_code: str | None = Query(
        default=None,
        min_length=1,
        max_length=DBConstants.CONTRACT_CODE_LENGTH,
    ),
    skip: int = Query(
        DBConstants.DEFAULT_PAGE_SKIP,
        ge=0,
    ),
    limit: int = Query(
        DBConstants.PATROL_AREA_SEARCH_DEFAULT_LIMIT,
        ge=1,
        le=DBConstants.PATROL_AREA_SEARCH_MAX_LIMIT,
    ),
    db: Session = Depends(get_db),
) -> list[PatrolAreaSearchResponse]:
    return PatrolAreaService.search_patrol_areas(
        db=db,
        keyword=keyword,
        contract_code=contract_code,
        skip=skip,
        limit=limit,
    )


@router.post(
    "/update-location",
    response_model=PatrolAreaLocationUpdateResponse,
    status_code=status.HTTP_200_OK,
)
def update_patrol_area_location(
    payload: PatrolAreaLocationUpdateRequest,
    db: Session = Depends(get_db),
) -> PatrolAreaLocationUpdateResponse:
    return PatrolAreaService.update_patrol_area_location(
        db=db,
        payload=payload,
    )
