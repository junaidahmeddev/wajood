"""Organization ORM model."""

import enum
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, Enum, Text
from sqlalchemy.dialects.postgresql import UUID
from app.models.guid import GUID
from sqlalchemy.orm import relationship
from app.database import Base


class OrgType(str, enum.Enum):
    NGO = "NGO"
    LAW_ENFORCEMENT = "LAW_ENFORCEMENT"
    HOSPITAL = "HOSPITAL"
    MORGUE = "MORGUE"
    FORENSICS = "FORENSICS"
    MEDIA = "MEDIA"
    GOVERNMENT = "GOVERNMENT"
    VOLUNTEER = "VOLUNTEER"


class Organization(Base):
    __tablename__ = "organizations"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    type = Column(Enum(OrgType), nullable=False)
    verified = Column(Boolean, default=False, nullable=False)
    contact_email = Column(String(255), nullable=True)
    contact_phone = Column(String(50), nullable=True)
    city = Column(String(100), nullable=True)
    address = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    members = relationship("User", back_populates="organization")
    found_persons = relationship("FoundPerson", back_populates="organization")
