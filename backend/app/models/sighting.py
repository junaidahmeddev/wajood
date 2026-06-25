"""Sighting ORM model — tracks sightings of missing persons."""

import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from app.models.guid import GUID
from sqlalchemy.orm import relationship
from app.database import Base


class Sighting(Base):
    __tablename__ = "sightings"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    missing_person_id = Column(GUID(), ForeignKey("missing_persons.id"), nullable=False)
    reported_by = Column(GUID(), ForeignKey("users.id"), nullable=False)
    location = Column(String(500), nullable=False)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    description = Column(Text, nullable=True)
    photo_url = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    missing_person = relationship("MissingPerson", back_populates="sightings")
    reporter = relationship("User", back_populates="sightings")
