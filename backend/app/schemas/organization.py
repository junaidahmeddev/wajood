"""Organization Pydantic schemas."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from uuid import UUID
from app.models.organization import OrgType


class OrgBase(BaseModel):
    name: str
    type: OrgType
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = None


class OrgCreate(OrgBase):
    pass


class OrgUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[OrgType] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = None


class OrgResponse(OrgBase):
    id: UUID
    verified: bool
    created_at: datetime

    class Config:
        from_attributes = True
