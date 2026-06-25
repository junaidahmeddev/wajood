"""Sighting Pydantic schemas."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from uuid import UUID


class SightingBase(BaseModel):
    missing_person_id: UUID
    location: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    description: Optional[str] = None
    photo_url: Optional[str] = None


class SightingCreate(SightingBase):
    pass


class SightingResponse(SightingBase):
    id: UUID
    reported_by: UUID
    created_at: datetime

    class Config:
        from_attributes = True
