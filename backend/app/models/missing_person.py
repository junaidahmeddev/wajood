"""MissingPerson ORM model."""

import enum
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Boolean, DateTime, Enum, Text, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from app.models.guid import GUID, SafeJSON
from sqlalchemy.orm import relationship
from app.database import Base


class MissingPersonStatus(str, enum.Enum):
    MISSING = "MISSING"
    IN_PROCESS = "IN_PROCESS"
    MATCHED = "MATCHED"
    FOUND_ALIVE = "FOUND_ALIVE"
    DECEASED = "DECEASED"
    CLOSED = "CLOSED"


class Gender(str, enum.Enum):
    MALE = "MALE"
    FEMALE = "FEMALE"
    OTHER = "OTHER"
    UNKNOWN = "UNKNOWN"


class MissingPerson(Base):
    __tablename__ = "missing_persons"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    reported_by = Column(GUID(), ForeignKey("users.id"), nullable=False)
    case_number = Column(String(50), unique=True, index=True, nullable=False)
    status = Column(Enum(MissingPersonStatus), default=MissingPersonStatus.MISSING, nullable=False)
    full_name = Column(String(255), nullable=False)
    age = Column(Integer, nullable=False)
    gender = Column(Enum(Gender), default=Gender.UNKNOWN, nullable=False)
    cnic = Column(String(20), nullable=True)
    last_seen_location = Column(String(500), nullable=True)
    last_seen_date = Column(DateTime(timezone=True), nullable=True)
    last_seen_city = Column(String(100), nullable=True)
    physical_description = Column(Text, nullable=True)
    clothing_description = Column(Text, nullable=True)
    distinguishing_marks = Column(Text, nullable=True)
    photo_url = Column(String(500), nullable=True)
    face_embedding = Column(SafeJSON, nullable=True)  # Stored as float array from DeepFace
    contact_name = Column(String(255), nullable=True)
    contact_phone = Column(String(50), nullable=True)
    is_disaster_case = Column(Boolean, default=False, nullable=False)
    disaster_event = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    reporter = relationship("User", back_populates="missing_persons")
    sightings = relationship("Sighting", back_populates="missing_person", cascade="all, delete-orphan")
    matches = relationship("Match", back_populates="missing_person", foreign_keys="Match.missing_person_id", cascade="all, delete-orphan")
    case_updates = relationship("CaseUpdate", back_populates="missing_person", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="missing_person", cascade="all, delete-orphan")
