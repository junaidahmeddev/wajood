"""Notification ORM model."""

import enum
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey, Enum, Text, Boolean
from sqlalchemy.dialects.postgresql import UUID
from app.models.guid import GUID
from sqlalchemy.orm import relationship
from app.database import Base


class NotificationType(str, enum.Enum):
    MATCH_FOUND = "MATCH_FOUND"
    STATUS_UPDATE = "STATUS_UPDATE"
    NEW_CASE_NEARBY = "NEW_CASE_NEARBY"
    DISASTER_ALERT = "DISASTER_ALERT"


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    user_id = Column(GUID(), ForeignKey("users.id"), nullable=False)
    case_id = Column(GUID(), ForeignKey("missing_persons.id"), nullable=True)
    type = Column(Enum(NotificationType), nullable=False)
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False, nullable=False)
    sent_via = Column(String(50), nullable=True)  # SMS, WHATSAPP, PUSH, EMAIL
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    user = relationship("User", back_populates="notifications")
    missing_person = relationship("MissingPerson", back_populates="notifications")
