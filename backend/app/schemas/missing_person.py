"""MissingPerson Pydantic schemas."""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel
from uuid import UUID
from app.models.missing_person import MissingPersonStatus, Gender


class MissingPersonBase(BaseModel):
    full_name: str
    age: int
    gender: Gender
    cnic: Optional[str] = None
    last_seen_location: Optional[str] = None
    last_seen_date: Optional[datetime] = None
    last_seen_city: Optional[str] = None
    physical_description: Optional[str] = None
    clothing_description: Optional[str] = None
    distinguishing_marks: Optional[str] = None
    photo_url: Optional[str] = None
    face_embedding: Optional[List[float]] = None
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    is_disaster_case: bool = False
    disaster_event: Optional[str] = None


class MissingPersonCreate(MissingPersonBase):
    pass


class MissingPersonUpdate(BaseModel):
    status: Optional[MissingPersonStatus] = None
    full_name: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[Gender] = None
    cnic: Optional[str] = None
    last_seen_location: Optional[str] = None
    last_seen_date: Optional[datetime] = None
    last_seen_city: Optional[str] = None
    physical_description: Optional[str] = None
    clothing_description: Optional[str] = None
    distinguishing_marks: Optional[str] = None
    photo_url: Optional[str] = None
    face_embedding: Optional[List[float]] = None
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    is_disaster_case: Optional[bool] = None
    disaster_event: Optional[str] = None


class MissingPersonResponse(MissingPersonBase):
    id: UUID
    reported_by: UUID
    case_number: str
    status: MissingPersonStatus
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
