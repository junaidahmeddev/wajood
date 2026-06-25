"""User ORM model."""

import enum
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, Enum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from app.models.guid import GUID
from sqlalchemy.orm import relationship
from app.database import Base


class UserRole(str, enum.Enum):
    PUBLIC = "PUBLIC"
    NGO_WORKER = "NGO_WORKER"
    OFFICER = "OFFICER"
    DOCTOR = "DOCTOR"
    VOLUNTEER = "VOLUNTEER"
    JOURNALIST = "JOURNALIST"
    GOVT_OFFICIAL = "GOVT_OFFICIAL"
    FORENSICS = "FORENSICS"
    ADMIN = "ADMIN"


class User(Base):
    __tablename__ = "users"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    phone = Column(String(50), nullable=True)
    role = Column(Enum(UserRole), default=UserRole.PUBLIC, nullable=False)
    organization_id = Column(GUID(), ForeignKey("organizations.id"), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    organization = relationship("Organization", back_populates="members")
    missing_persons = relationship("MissingPerson", back_populates="reporter")
    case_updates = relationship("CaseUpdate", back_populates="user")
    audit_logs = relationship("AuditLog", back_populates="user")
    notifications = relationship("Notification", back_populates="user")
    sightings = relationship("Sighting", back_populates="reporter")
