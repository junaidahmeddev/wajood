"""FoundPerson Pydantic schemas."""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel
from uuid import UUID
from app.models.missing_person import Gender
from app.models.found_person import FoundPersonStatus


class FoundPersonBase(BaseModel):
    approximate_age: Optional[int] = None
    gender: Gender
    found_location: Optional[str] = None
    found_date: Optional[datetime] = None
    found_city: Optional[str] = None
    physical_description: Optional[str] = None
    photo_url: Optional[str] = None
    face_embedding: Optional[List[float]] = None
    is_alive: bool = True
    morgue_id: Optional[str] = None
    hospital_name: Optional[str] = None
    notes: Optional[str] = None


class FoundPersonCreate(FoundPersonBase):
    organization_id: Optional[UUID] = None


class FoundPersonUpdate(BaseModel):
    status: Optional[FoundPersonStatus] = None
    approximate_age: Optional[int] = None
    gender: Optional[Gender] = None
    found_location: Optional[str] = None
    found_date: Optional[datetime] = None
    found_city: Optional[str] = None
    physical_description: Optional[str] = None
    photo_url: Optional[str] = None
    face_embedding: Optional[List[float]] = None
    is_alive: Optional[bool] = None
    morgue_id: Optional[str] = None
    hospital_name: Optional[str] = None
    notes: Optional[str] = None
    organization_id: Optional[UUID] = None


class FoundPersonResponse(FoundPersonBase):
    id: UUID
    registered_by: UUID
    organization_id: Optional[UUID] = None
    status: FoundPersonStatus
    created_at: datetime

    class Config:
        from_attributes = True
