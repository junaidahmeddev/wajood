"""CaseUpdate ORM model — tracks state transitions of cases."""

import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from app.models.guid import GUID
from sqlalchemy.orm import relationship
from app.database import Base


class CaseUpdate(Base):
    __tablename__ = "case_updates"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    case_id = Column(GUID(), ForeignKey("missing_persons.id"), nullable=False)
    updated_by = Column(GUID(), ForeignKey("users.id"), nullable=False)
    update_type = Column(String(100), nullable=True)
    old_status = Column(String(50), nullable=True)
    new_status = Column(String(50), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    missing_person = relationship("MissingPerson", back_populates="case_updates")
    user = relationship("User", back_populates="case_updates")
