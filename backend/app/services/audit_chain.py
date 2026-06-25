"""Tamper-evident audit chain service using SHA-256 hash linking (async)."""

import json
import hashlib
import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.audit import AuditLog, AuditAction


def compute_hash(
    previous_hash: str,
    sequence_number: int,
    table: str,
    record_id: str,
    action: str,
    data: Optional[dict],
    timestamp: str
) -> str:
    """
    Compute cryptographic SHA-256 hash:
    SHA-256(f"{previous_hash}|{sequence_number}|{table}|{record_id}|{action}|{json(data)}|{timestamp}")
    """
    serialized_data = json.dumps(data, sort_keys=True) if data is not None else "{}"
    payload = f"{previous_hash}|{sequence_number}|{table}|{record_id}|{action}|{serialized_data}|{timestamp}"
    return hashlib.sha256(payload.encode()).hexdigest()


async def log_action(
    db: AsyncSession,
    table: str,
    record_id: Optional[uuid.UUID],
    action: str,
    data: Optional[dict] = None,
    user_id: Optional[uuid.UUID] = None
) -> AuditLog:
    """
    Log action by:
    1. Getting last record's hash and sequence number.
    2. Computing new hash with compute_hash.
    3. Inserting audit_log row.
    """
    # Try parsing action string to AuditAction enum
    try:
        action_enum = AuditAction(action.upper())
    except ValueError:
        action_enum = AuditAction.UPDATE

    # Retrieve last entry
    result = await db.execute(select(AuditLog).order_by(AuditLog.sequence_number.desc()))
    last_entry = result.scalars().first()

    previous_hash = last_entry.current_hash if last_entry else "GENESIS"
    sequence_number = (last_entry.sequence_number + 1) if last_entry else 1

    timestamp = datetime.now(timezone.utc)
    timestamp_str = timestamp.isoformat()

    current_hash = compute_hash(
        previous_hash=previous_hash,
        sequence_number=sequence_number,
        table=table,
        record_id=str(record_id) if record_id else "",
        action=action_enum.value,
        data=data,
        timestamp=timestamp_str
    )

    entry = AuditLog(
        sequence_number=sequence_number,
        table_name=table,
        record_id=record_id,
        action=action_enum,
        changed_by=user_id,
        changed_data=data,
        previous_hash=previous_hash,
        current_hash=current_hash,
        created_at=timestamp
    )

    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return entry


async def verify_chain(db: AsyncSession) -> dict:
    """
    Walk the entire audit log chain, recomputing every hash, and return broken links.
    """
    result = await db.execute(select(AuditLog).order_by(AuditLog.sequence_number.asc()))
    entries = result.scalars().all()

    if not entries:
        return {"valid": True, "checked": 0, "broken_links": []}

    broken_links = []
    previous_hash = "GENESIS"

    for entry in entries:
        timestamp_str = entry.created_at.isoformat() if entry.created_at else ""
        expected_hash = compute_hash(
            previous_hash=previous_hash,
            sequence_number=entry.sequence_number,
            table=entry.table_name,
            record_id=str(entry.record_id) if entry.record_id else "",
            action=entry.action.value,
            data=entry.changed_data,
            timestamp=timestamp_str
        )

        if entry.current_hash != expected_hash:
            broken_links.append({
                "sequence_number": entry.sequence_number,
                "entry_id": str(entry.id),
                "reason": "current_hash_mismatch",
                "expected": expected_hash,
                "actual": entry.current_hash,
            })
        if entry.previous_hash != previous_hash:
            broken_links.append({
                "sequence_number": entry.sequence_number,
                "entry_id": str(entry.id),
                "reason": "previous_hash_link_broken",
                "expected": previous_hash,
                "actual": entry.previous_hash,
            })
        previous_hash = entry.current_hash

    return {
        "valid": len(broken_links) == 0,
        "checked": len(entries),
        "broken_links": broken_links,
    }


# Backward compatibility aliases
async def create_audit_entry(
    db: AsyncSession,
    action: AuditAction,
    table_name: str,
    record_id: Optional[uuid.UUID] = None,
    changed_by: Optional[uuid.UUID] = None,
    changed_data: Optional[dict] = None,
) -> AuditLog:
    return await log_action(
        db=db,
        table=table_name,
        record_id=record_id,
        action=action.value,
        data=changed_data,
        user_id=changed_by
    )


async def verify_chain_integrity(db: AsyncSession) -> dict:
    return await verify_chain(db)
