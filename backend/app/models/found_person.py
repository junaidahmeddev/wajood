"""FoundPerson ORM model."""

import enum
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Boolean, DateTime, Enum, Text, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from app.models.guid import GUID, SafeJSON
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.missing_person import Gender


class FoundPersonStatus(str, enum.Enum):
    UNIDENTIFIED = "UNIDENTIFIED"
    MATCHED = "MATCHED"
    RETURNED = "RETURNED"
    DECEASED = "DECEASED"


class FoundPerson(Base):
    __tablename__ = "found_persons"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    registered_by = Column(GUID(), ForeignKey("users.id"), nullable=False)
    organization_id = Column(GUID(), ForeignKey("organizations.id"), nullable=True)
    status = Column(Enum(FoundPersonStatus), default=FoundPersonStatus.UNIDENTIFIED, nullable=False)
    approximate_age = Column(Integer, nullable=True)
    gender = Column(Enum(Gender), default=Gender.UNKNOWN, nullable=False)
    found_location = Column(String(500), nullable=True)
    found_date = Column(DateTime(timezone=True), nullable=True)
    found_city = Column(String(100), nullable=True)
    physical_description = Column(Text, nullable=True)
    photo_url = Column(String(500), nullable=True)
    face_embedding = Column(SafeJSON, nullable=True)
    is_alive = Column(Boolean, default=True, nullable=False)
    morgue_id = Column(String(100), nullable=True)
    hospital_name = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    organization = relationship("Organization", back_populates="found_persons")
    matches = relationship("Match", back_populates="found_person", cascade="all, delete-orphan")
