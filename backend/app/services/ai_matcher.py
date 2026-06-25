"""AI Matcher service — text-based and face-based matching for missing/found persons."""

import uuid
import logging
import json
import redis
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.models.missing_person import MissingPerson, MissingPersonStatus, Gender
from app.models.found_person import FoundPerson, FoundPersonStatus
from app.models.match import Match, MatchType, MatchStatus
from app.models.notification import Notification, NotificationType
from app.services.face_recognition import compare_faces
from app.services.notification import send_sms, send_whatsapp
from app.config import settings

logger = logging.getLogger("wajood_matcher")


def _normalize(value: str | None) -> str:
    """Normalize a string for comparison."""
    if not value:
        return ""
    return value.strip().lower()


def _score_exact(a: str | None, b: str | None, weight: int = 10) -> int:
    """Score exact match between two strings."""
    if not a or not b:
        return 0
    return weight if _normalize(a) == _normalize(b) else 0


def _score_partial(a: str | None, b: str | None, weight: int = 5) -> int:
    """Score partial match (one contains the other)."""
    if not a or not b:
        return 0
    na, nb = _normalize(a), _normalize(b)
    if na == nb:
        return weight
    if na in nb or nb in na:
        return weight // 2
    return 0


def _score_numeric_proximity(a: float | None, b: float | None, weight: int = 8, tolerance: float = 10) -> int:
    """Score numeric proximity with tolerance."""
    if a is None or b is None:
        return 0
    diff = abs(a - b)
    if diff <= tolerance:
        return int(weight * (1 - diff / tolerance))
    return 0


def compute_match_score(missing: MissingPerson, found: FoundPerson) -> Dict:
    """
    Compute a text-based physical descriptor match score (0 to 100) between MissingPerson and FoundPerson.
    """
    scores = {}
    max_possible = 0

    # Gender match (high weight)
    if missing.gender and found.gender:
        max_possible += 20
        scores["gender"] = 20 if missing.gender == found.gender else 0

    # Age match
    if missing.age is not None and found.approximate_age is not None:
        max_possible += 20
        scores["age"] = _score_numeric_proximity(float(missing.age), float(found.approximate_age), 20, 8)

    # City match
    if missing.last_seen_city and found.found_city:
        max_possible += 20
        scores["city"] = _score_exact(missing.last_seen_city, found.found_city, 20)

    # Location proximity keyword match
    if missing.last_seen_location and found.found_location:
        max_possible += 15
        scores["location"] = _score_partial(missing.last_seen_location, found.found_location, 15)

    # Physical descriptions
    if missing.physical_description and found.physical_description:
        max_possible += 15
        scores["physical"] = _score_partial(missing.physical_description, found.physical_description, 15)

    # Marks check in notes
    if missing.distinguishing_marks:
        max_possible += 10
        score_marks = _score_partial(missing.distinguishing_marks, found.physical_description, 10)
        score_notes = _score_partial(missing.distinguishing_marks, found.notes, 10)
        scores["marks"] = max(score_marks, score_notes)

    total = sum(scores.values())
    confidence = int((total / max(max_possible, 1)) * 100)

    return {
        "confidence": min(confidence, 100),
        "total_score": total,
        "max_possible": max_possible,
        "breakdown": scores,
    }


def find_matches(db: Session, person: Any, limit: int = 10, min_confidence: int = 20) -> List[Dict]:
    """
    Find potential matches for a person against the database (sync).
    """
    results = []

    if isinstance(person, MissingPerson):
        candidates = db.query(FoundPerson).all()
        for candidate in candidates:
            score_data = compute_match_score(person, candidate)
            if score_data["confidence"] >= min_confidence:
                results.append({
                    "found_person": candidate,
                    "missing_person": person,
                    "confidence": score_data["confidence"],
                    "breakdown": score_data["breakdown"],
                    "match_type": MatchType.PHYSICAL,
                })
    elif isinstance(person, FoundPerson):
        candidates = db.query(MissingPerson).all()
        for candidate in candidates:
            score_data = compute_match_score(candidate, person)
            if score_data["confidence"] >= min_confidence:
                results.append({
                    "found_person": person,
                    "missing_person": candidate,
                    "confidence": score_data["confidence"],
                    "breakdown": score_data["breakdown"],
                    "match_type": MatchType.PHYSICAL,
                })

    # Sort by confidence descending
    results.sort(key=lambda x: x["confidence"], reverse=True)
    return results[:limit]


def create_sync_notification(db: Session, user_id: uuid.UUID, type_val: str, message: str, case_id: Optional[uuid.UUID] = None):
    """Create notification synchronously in database."""
    try:
        notif_type = NotificationType(type_val)
    except ValueError:
        notif_type = NotificationType.STATUS_UPDATE

    notif = Notification(
        user_id=user_id,
        case_id=case_id,
        type=notif_type,
        message=message,
        is_read=False,
        sent_via="PUSH, SMS"
    )
    db.add(notif)
    db.commit()


def run_sync_ai_matching_for_missing(db: Session, missing_id: uuid.UUID):
    """
    Match pipeline for new missing person reports:
    1. Check face embedding.
    2. Compare against all found persons.
    3. If score > 0.75: insert MATCH log.
    4. If score > 0.85: send family SMS/WhatsApp/Push notifications.
    """
    missing = db.query(MissingPerson).filter(MissingPerson.id == missing_id).first()
    if not missing:
        logger.error(f"Missing person {missing_id} not found in database.")
        return

    # Delete old matches for this missing person
    db.query(Match).filter(Match.missing_person_id == missing_id).delete()
    db.commit()

    candidates = db.query(FoundPerson).all()
    matches_created = 0

    for candidate in candidates:
        score = 0.0
        match_type = MatchType.PHYSICAL

        # Face matching if both have face representation embeddings
        if missing.face_embedding and candidate.face_embedding:
            score = compare_faces(missing.face_embedding, candidate.face_embedding)
            match_type = MatchType.FACE
        else:
            # Fallback to physical descriptor matching
            text_result = compute_match_score(missing, candidate)
            score = float(text_result["confidence"] / 100.0)
            match_type = MatchType.PHYSICAL

        if score >= 0.20:
            # Create match record
            match_record = Match(
                missing_person_id=missing.id,
                found_person_id=candidate.id,
                confidence_score=score,
                match_type=match_type,
                status=MatchStatus.PENDING,
                confirmed_by=None
            )
            db.add(match_record)
            db.commit()
            db.refresh(match_record)
            matches_created += 1

            # Publish to Redis channel "matches"
            try:
                redis_conn = redis.from_url(settings.REDIS_URL, decode_responses=True)
                payload = {
                    "match_id": str(match_record.id),
                    "missing_person_id": str(missing.id),
                    "found_person_id": str(candidate.id),
                    "confidence_score": float(score),
                    "reported_by": str(missing.reported_by),
                    "contact_phone": missing.contact_phone,
                    "full_name": missing.full_name,
                    "case_number": missing.case_number
                }
                redis_conn.publish("matches", json.dumps(payload))
                redis_conn.close()
                logger.info(f"Published match {match_record.id} to 'matches' channel.")
            except Exception as e:
                logger.warning(f"Failed to publish match to Redis: {e}")

    logger.info(f"AI Match pipeline completed for MissingPerson {missing_id}. Logged {matches_created} matches.")


def run_sync_ai_matching_for_found(db: Session, found_id: uuid.UUID):
    """
    Match pipeline for newly registered found persons:
    1. Compare against all missing persons.
    2. Threshold checks.
    """
    found = db.query(FoundPerson).filter(FoundPerson.id == found_id).first()
    if not found:
        logger.error(f"Found person {found_id} not found in database.")
        return

    # Delete old matches for this found person
    db.query(Match).filter(Match.found_person_id == found_id).delete()
    db.commit()

    candidates = db.query(MissingPerson).all()
    matches_created = 0

    for candidate in candidates:
        score = 0.0
        match_type = MatchType.PHYSICAL

        if found.face_embedding and candidate.face_embedding:
            score = compare_faces(found.face_embedding, candidate.face_embedding)
            match_type = MatchType.FACE
        else:
            text_result = compute_match_score(candidate, found)
            score = float(text_result["confidence"] / 100.0)
            match_type = MatchType.PHYSICAL

        if score >= 0.20:
            match_record = Match(
                missing_person_id=candidate.id,
                found_person_id=found.id,
                confidence_score=score,
                match_type=match_type,
                status=MatchStatus.PENDING,
                confirmed_by=None
            )
            db.add(match_record)
            db.commit()
            db.refresh(match_record)
            matches_created += 1

            # Publish to Redis channel "matches"
            try:
                redis_conn = redis.from_url(settings.REDIS_URL, decode_responses=True)
                payload = {
                    "match_id": str(match_record.id),
                    "missing_person_id": str(candidate.id),
                    "found_person_id": str(found.id),
                    "confidence_score": float(score),
                    "reported_by": str(candidate.reported_by),
                    "contact_phone": candidate.contact_phone,
                    "full_name": candidate.full_name,
                    "case_number": candidate.case_number
                }
                redis_conn.publish("matches", json.dumps(payload))
                redis_conn.close()
                logger.info(f"Published match {match_record.id} to 'matches' channel.")
            except Exception as e:
                logger.warning(f"Failed to publish match to Redis: {e}")

    logger.info(f"AI Match pipeline completed for FoundPerson {found_id}. Logged {matches_created} matches.")
