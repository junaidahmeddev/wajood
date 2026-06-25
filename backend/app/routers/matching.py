"""Matching router — AI-powered person matching (async)."""

import uuid
import logging
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from app.database import get_db
from app.models.user import User, UserRole
from app.models.missing_person import MissingPerson, MissingPersonStatus
from app.models.found_person import FoundPerson, FoundPersonStatus
from app.models.match import Match, MatchStatus, MatchType
from app.models.notification import NotificationType
from app.schemas.match import MatchResponse
from app.middleware.rbac import get_current_user, check_permission
from app.tasks import run_ai_matching_task
from app.services.audit_chain import create_audit_entry
from app.models.audit import AuditAction
from app.services.file_storage import save_upload, validate_file
from app.services.face_recognition import extract_face_embedding
from app.services.notification import send_notification

logger = logging.getLogger("wajood_matching")
router = APIRouter(prefix="/api/matching", tags=["Matching"])


def _cosine_similarity(v1, v2) -> float:
    """Calculate cosine similarity between two float vectors."""
    if not v1 or not v2:
        return 0.0
    import json
    if isinstance(v1, str):
        try:
            v1 = json.loads(v1)
        except json.JSONDecodeError:
            pass
    if isinstance(v2, str):
        try:
            v2 = json.loads(v2)
        except json.JSONDecodeError:
            pass
            
    import numpy as np
    a = np.array(v1)
    b = np.array(v2)
    min_len = min(len(a), len(b))
    if min_len == 0:
        return 0.0
    a = a[:min_len]
    b = b[:min_len]
    dot = np.dot(a, b)
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(dot / (norm_a * norm_b))


@router.post("/search")
async def ai_face_search(
    photo: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(check_permission("matching:read")),
):
    """AI Face Search: upload a photo and get ranked potential matches from database."""
    error = validate_file(photo)
    if error:
        raise HTTPException(status_code=400, detail=error)

    # Save photo temporarily
    photo_url = await save_upload(photo, subfolder="search_queries")

    import os
    from app.config import settings
    local_path = os.path.join(settings.UPLOAD_DIR, photo_url.replace("/uploads/", ""))
    
    # Extract query embedding
    query_embedding = extract_face_embedding(local_path)
    if not query_embedding:
        raise HTTPException(status_code=400, detail="No face detected or biometrics extraction failed")

    ranked_matches = []

    # 1. Fetch missing persons with embeddings
    mp_result = await db.execute(select(MissingPerson).filter(MissingPerson.face_embedding.isnot(None)))
    missing_persons = mp_result.scalars().all()
    for mp in missing_persons:
        sim = _cosine_similarity(query_embedding, mp.face_embedding)
        confidence = max(0.0, sim)
        if confidence >= 0.2:  # Similarity threshold
            ranked_matches.append({
                "type": "MISSING_PERSON",
                "confidence_score": confidence,
                "person": {
                    "id": str(mp.id),
                    "full_name": mp.full_name,
                    "case_number": mp.case_number,
                    "city": mp.last_seen_city,
                    "photo_url": mp.photo_url,
                    "status": mp.status.value,
                    "age": mp.age,
                    "gender": mp.gender.value,
                }
            })

    # 2. Fetch found persons with embeddings
    fp_result = await db.execute(select(FoundPerson).filter(FoundPerson.face_embedding.isnot(None)))
    found_persons = fp_result.scalars().all()
    for fp in found_persons:
        sim = _cosine_similarity(query_embedding, fp.face_embedding)
        confidence = max(0.0, sim)
        if confidence >= 0.2:
            ranked_matches.append({
                "type": "FOUND_PERSON",
                "confidence_score": confidence,
                "person": {
                    "id": str(fp.id),
                    "full_name": "Unidentified Person" if not fp.physical_description else fp.physical_description[:30],
                    "city": fp.found_city,
                    "photo_url": fp.photo_url,
                    "status": fp.status.value,
                    "approximate_age": fp.approximate_age,
                    "gender": fp.gender.value,
                }
            })

    # Rank by confidence descending
    ranked_matches.sort(key=lambda x: x["confidence_score"], reverse=True)
    return ranked_matches[:20]


@router.post("/trigger/{case_id}")
async def trigger_matching(
    case_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(check_permission("matching:run")),
):
    """Manually trigger AI matching for a case."""
    try:
        case_uuid = uuid.UUID(case_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid case ID format")

    result = await db.execute(select(MissingPerson).filter(MissingPerson.id == case_uuid))
    missing_person = result.scalars().first()
    if missing_person:
        try:
            run_ai_matching_task.delay(str(case_uuid))
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to queue background matching task: {e}")
        return {"status": "queued", "message": "AI matching task triggered for MissingPerson."}

    fp_res = await db.execute(select(FoundPerson).filter(FoundPerson.id == case_uuid))
    found_person = fp_res.scalars().first()
    if not found_person:
        raise HTTPException(status_code=404, detail="Case or Person record not found")

    try:
        from app.tasks import run_found_person_matching_task
        run_found_person_matching_task.delay(str(case_uuid))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to queue found matching task: {e}")

    return {"status": "queued", "message": "AI matching task triggered for FoundPerson."}


@router.get("/results/{case_id}", response_model=list[MatchResponse])
async def get_match_results(
    case_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(check_permission("matching:read")),
):
    """Get all match results for a case (async)."""
    try:
        case_uuid = uuid.UUID(case_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid case ID format")

    result = await db.execute(
        select(Match)
        .options(
            joinedload(Match.missing_person),
            joinedload(Match.found_person),
        )
        .filter((Match.missing_person_id == case_uuid) | (Match.found_person_id == case_uuid))
        .order_by(Match.confidence_score.desc())
    )
    results = result.scalars().all()
    return [MatchResponse.model_validate(r) for r in results]


@router.get("/queue", response_model=list[MatchResponse])
async def get_pending_queue(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(check_permission("matching:read")),
):
    """Get all pending matches across all cases (async)."""
    result = await db.execute(
        select(Match)
        .options(
            joinedload(Match.missing_person),
            joinedload(Match.found_person),
        )
        .filter(Match.status == MatchStatus.PENDING)
        .order_by(Match.confidence_score.desc())
    )
    results = result.scalars().all()
    return [MatchResponse.model_validate(r) for r in results]


@router.patch("/results/{match_id}/confirm")
async def confirm_match(
    match_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(check_permission("matching:run")),
):
    """Confirm a match (officer, ngo worker or admin only) (async)."""
    # Enforce role restriction: OFFICER, NGO_WORKER or ADMIN
    if user.role not in [UserRole.OFFICER, UserRole.ADMIN, UserRole.NGO_WORKER]:
        raise HTTPException(status_code=403, detail="Only Officers, NGO Workers or Admins can confirm matches")

    try:
        match_uuid = uuid.UUID(match_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid match ID format")

    result = await db.execute(
        select(Match)
        .options(joinedload(Match.missing_person), joinedload(Match.found_person))
        .filter(Match.id == match_uuid)
    )
    match_res = result.scalars().first()
    if not match_res:
        raise HTTPException(status_code=404, detail="Match result not found")

    match_res.status = MatchStatus.CONFIRMED
    match_res.confirmed_by = user.id

    if match_res.missing_person:
        match_res.missing_person.status = MissingPersonStatus.MATCHED
    if match_res.found_person:
        match_res.found_person.status = FoundPersonStatus.MATCHED

    # Send Notification to case reporter
    if match_res.missing_person:
        await send_notification(
            db, user_id=match_res.missing_person.reported_by,
            type=NotificationType.MATCH_FOUND,
            message=f"A match has been CONFIRMED for case {match_res.missing_person.case_number}!",
            case_id=match_res.missing_person.id,
        )

    await db.commit()

    # Log audit entry
    await create_audit_entry(
        db, action=AuditAction.UPDATE, table_name="matches", record_id=match_res.id,
        changed_by=user.id, changed_data={"status": "CONFIRMED", "confirmed_by": str(user.id)},
    )

    return {"status": "confirmed", "match_id": match_id}


@router.patch("/results/{match_id}/reject")
async def reject_match(
    match_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(check_permission("matching:run")),
):
    """Reject a match (async)."""
    try:
        match_uuid = uuid.UUID(match_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid match ID format")

    result = await db.execute(select(Match).filter(Match.id == match_uuid))
    match_res = result.scalars().first()
    if not match_res:
        raise HTTPException(status_code=404, detail="Match result not found")

    match_res.status = MatchStatus.REJECTED
    await db.commit()

    # Log audit entry
    await create_audit_entry(
        db, action=AuditAction.UPDATE, table_name="matches", record_id=match_res.id,
        changed_by=user.id, changed_data={"status": "REJECTED"},
    )

    return {"status": "rejected", "match_id": match_id}
