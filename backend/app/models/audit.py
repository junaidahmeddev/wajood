"""AuditLog ORM model."""

import enum
import uuid
import json
import hashlib
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey, Enum, BigInteger, JSON
from sqlalchemy.dialects.postgresql import UUID
from app.models.guid import GUID, SafeJSON
from sqlalchemy.orm import relationship
from app.database import Base


class AuditAction(str, enum.Enum):
    CREATE = "CREATE"
    UPDATE = "UPDATE"
    DELETE = "DELETE"


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    sequence_number = Column(BigInteger, autoincrement=True, nullable=False, unique=True)
    table_name = Column(String(100), nullable=False)
    record_id = Column(GUID(), nullable=True)
    action = Column(Enum(AuditAction), nullable=False)
    changed_by = Column(GUID(), ForeignKey("users.id"), nullable=True)
    changed_data = Column(SafeJSON, nullable=True)
    previous_hash = Column(String(64), nullable=False)  # SHA-256
    current_hash = Column(String(64), nullable=False)  # SHA-256
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    user = relationship("User", back_populates="audit_logs")

    def compute_hash(self, prev_hash: str) -> str:
        """Compute SHA-256 hash of this record block."""
        from app.services.audit_chain import compute_hash as compute_service_hash
        return compute_service_hash(
            previous_hash=prev_hash,
            sequence_number=self.sequence_number or 0,
            table=self.table_name,
            record_id=str(self.record_id) if self.record_id else "",
            action=self.action.value if self.action else "",
            data=self.changed_data,
            timestamp=self.created_at.isoformat() if self.created_at else ""
        )
