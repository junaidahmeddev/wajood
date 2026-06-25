"""Match ORM model — tracks matches between missing and found persons."""

import enum
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, Enum, ForeignKey, Float
from sqlalchemy.dialects.postgresql import UUID
from app.models.guid import GUID
from sqlalchemy.orm import relationship
from app.database import Base


class MatchType(str, enum.Enum):
    FACE = "FACE"
    PHYSICAL = "PHYSICAL"
    DNA = "DNA"
    MANUAL = "MANUAL"


class MatchStatus(str, enum.Enum):
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    REJECTED = "REJECTED"


class Match(Base):
    __tablename__ = "matches"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    missing_person_id = Column(GUID(), ForeignKey("missing_persons.id"), nullable=False)
    found_person_id = Column(GUID(), ForeignKey("found_persons.id"), nullable=False)
    confidence_score = Column(Float, nullable=False)  # 0.0 to 1.0
    match_type = Column(Enum(MatchType), nullable=False)
    status = Column(Enum(MatchStatus), default=MatchStatus.PENDING, nullable=False)
    confirmed_by = Column(GUID(), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    missing_person = relationship("MissingPerson", back_populates="matches", foreign_keys=[missing_person_id])
    found_person = relationship("FoundPerson", back_populates="matches", foreign_keys=[found_person_id])
    validator = relationship("User", foreign_keys=[confirmed_by])
