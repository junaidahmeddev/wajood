"""Match Pydantic schemas."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from uuid import UUID
from app.models.match import MatchType, MatchStatus
from app.schemas.missing_person import MissingPersonResponse
from app.schemas.found_person import FoundPersonResponse


class MatchBase(BaseModel):
    missing_person_id: UUID
    found_person_id: UUID
    confidence_score: float
    match_type: MatchType
    status: MatchStatus = MatchStatus.PENDING


class MatchCreate(MatchBase):
    pass


class MatchUpdate(BaseModel):
    status: Optional[MatchStatus] = None
    confirmed_by: Optional[UUID] = None


class MatchResponse(MatchBase):
    id: UUID
    confirmed_by: Optional[UUID] = None
    created_at: datetime
    missing_person: Optional[MissingPersonResponse] = None
    found_person: Optional[FoundPersonResponse] = None

    class Config:
        from_attributes = True
