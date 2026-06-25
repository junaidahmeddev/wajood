"""Cases (Missing Persons) router — full async CRUD with filtering, timeline, bulk intake, stats, and uploads."""

import random
import string
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database import get_db
from app.models.user import User, UserRole
from app.models.missing_person import MissingPerson, MissingPersonStatus, Gender
from app.models.case_update import CaseUpdate
from app.models.sighting import Sighting
from app.models.notification import NotificationType
from app.schemas.missing_person import MissingPersonCreate, MissingPersonResponse
from app.middleware.rbac import get_current_user, check_permission
from app.services.audit_chain import create_audit_entry
from app.services.notification import send_notification
from app.services.file_storage import save_upload, validate_file
from app.services.face_recognition import extract_face_embedding
from app.tasks import run_ai_matching_task
from app.models.audit import AuditAction
from pydantic import BaseModel

logger = logging.getLogger("wajood_cases")
router = APIRouter(prefix="/api/cases", tags=["Cases"])


class CaseUpdateResponse(BaseModel):
    id: uuid.UUID
    case_id: uuid.UUID
    updated_by: uuid.UUID
    update_type: str
    old_status: Optional[str] = None
    new_status: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class SightingResponse(BaseModel):
    id: uuid.UUID
    missing_person_id: uuid.UUID
    reported_by: uuid.UUID
    location: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    description: Optional[str] = None
    photo_url: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


def _generate_case_number() -> str:
    """Generate a unique case number like WJD-2024-XXXXX."""
    year = datetime.now().year
    code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=5))
    return f"WJD-{year}-{code}"


@router.post("/", response_model=MissingPersonResponse, status_code=status.HTTP_201_CREATED)
async def create_case(
    full_name: str = Form(...),
    age: int = Form(...),
    gender: Gender = Form(...),
    cnic: Optional[str] = Form(None),
    last_seen_location: Optional[str] = Form(None),
    last_seen_date: Optional[str] = Form(None),
    last_seen_city: Optional[str] = Form(None),
    physical_description: Optional[str] = Form(None),
    clothing_description: Optional[str] = Form(None),
    distinguishing_marks: Optional[str] = Form(None),
    contact_name: Optional[str] = Form(None),
    contact_phone: Optional[str] = Form(None),
    is_disaster_case: bool = Form(False),
    disaster_event: Optional[str] = Form(None),
    photo: Optional[UploadFile] = File(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(check_permission("cases:create")),
):
    """Create a new missing person case with photo upload and face representation (async)."""
    photo_url = None
    face_embedding = None

    if photo:
        # Validate and save image
        error = validate_file(photo)
        if error:
            raise HTTPException(status_code=400, detail=error)
        photo_url = await save_upload(photo, subfolder="persons")

        # Extract biometric representation
        import os
        from app.config import settings
        local_path = os.path.join(settings.UPLOAD_DIR, photo_url.replace("/uploads/", ""))
        face_embedding = extract_face_embedding(local_path)

    parsed_date = None
    if last_seen_date:
        try:
            parsed_date = datetime.fromisoformat(last_seen_date.replace("Z", "+00:00"))
        except ValueError:
            parsed_date = None

    missing_person = MissingPerson(
        reported_by=user.id,
        case_number=_generate_case_number(),
        status=MissingPersonStatus.MISSING,
        full_name=full_name,
        age=age,
        gender=gender,
        cnic=cnic,
        last_seen_location=last_seen_location,
        last_seen_date=parsed_date,
        last_seen_city=last_seen_city,
        physical_description=physical_description,
        clothing_description=clothing_description,
        distinguishing_marks=distinguishing_marks,
        photo_url=photo_url,
        face_embedding=face_embedding,
        contact_name=contact_name,
        contact_phone=contact_phone,
        is_disaster_case=is_disaster_case,
        disaster_event=disaster_event,
    )
    db.add(missing_person)
    await db.commit()
    await db.refresh(missing_person)

    # Audit
    await create_audit_entry(
        db, action=AuditAction.CREATE, table_name="missing_persons", record_id=missing_person.id,
        changed_by=user.id,
        changed_data={"case_number": missing_person.case_number, "full_name": missing_person.full_name},
    )

    # Queue background AI matching task
    try:
        run_ai_matching_task.delay(str(missing_person.id))
        logger.info(f"🚀 Queued matching background worker task for MissingPerson {missing_person.id}")
    except Exception as e:
        logger.warning(f"Failed to queue celery matching task: {e}")

    return MissingPersonResponse.model_validate(missing_person)


@router.get("/", response_model=list[MissingPersonResponse])
async def list_cases(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status_filter: Optional[MissingPersonStatus] = Query(None, alias="status"),
    city: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List missing person cases with filtering and PII masking (async)."""
    from app.middleware.rbac import ROLE_PERMISSIONS
    user_permissions = ROLE_PERMISSIONS.get(user.role, [])
    has_read_all = "cases:read_all" in user_permissions or "*" in user_permissions
    has_read_public = "cases:read_public" in user_permissions
    has_read_own = "cases:read_own" in user_permissions

    if not (has_read_all or has_read_public or has_read_own):
        raise HTTPException(status_code=403, detail="Permission denied to list cases")

    query = select(MissingPerson)

    if not has_read_all and has_read_own and not has_read_public:
        query = query.filter(MissingPerson.reported_by == user.id)

    if status_filter:
        query = query.filter(MissingPerson.status == status_filter)
    if city:
        query = query.filter(MissingPerson.last_seen_city.ilike(f"%{city}%"))
    if start_date:
        query = query.filter(MissingPerson.last_seen_date >= start_date)
    if end_date:
        query = query.filter(MissingPerson.last_seen_date <= end_date)

    result = await db.execute(
        query.order_by(MissingPerson.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    )
    cases = result.scalars().all()

    has_pii = "cases:read_pii" in user_permissions or "*" in user_permissions
    response_cases = []
    for c in cases:
        c_schema = MissingPersonResponse.model_validate(c)
        if not has_pii and c.reported_by != user.id:
            c_schema.cnic = "MASKED"
            c_schema.contact_name = "MASKED"
            c_schema.contact_phone = "MASKED"
        response_cases.append(c_schema)

    return response_cases


@router.get("/stats")
async def get_stats(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get case statistics by city and status (async)."""
    # Stats by city
    city_result = await db.execute(
        select(MissingPerson.last_seen_city, func.count(MissingPerson.id))
        .filter(MissingPerson.last_seen_city.isnot(None))
        .group_by(MissingPerson.last_seen_city)
    )
    stats_city = [{"city": r[0], "count": r[1]} for r in city_result.all()]

    # Stats by status
    status_result = await db.execute(
        select(MissingPerson.status, func.count(MissingPerson.id))
        .group_by(MissingPerson.status)
    )
    stats_status = [{"status": r[0].value, "count": r[1]} for r in status_result.all()]

    return {
        "by_city": stats_city,
        "by_status": stats_status,
    }


@router.get("/{id}")
async def get_case_details(
    id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get a specific case with PII masking checks."""
    try:
        case_uuid = uuid.UUID(id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid case ID format")

    from app.middleware.rbac import ROLE_PERMISSIONS
    user_permissions = ROLE_PERMISSIONS.get(user.role, [])
    has_read_all = "cases:read_all" in user_permissions or "*" in user_permissions
    has_read_public = "cases:read_public" in user_permissions
    has_read_own = "cases:read_own" in user_permissions

    if not (has_read_all or has_read_public or has_read_own):
        raise HTTPException(status_code=403, detail="Permission denied to view case details")

    result = await db.execute(select(MissingPerson).filter(MissingPerson.id == case_uuid))
    missing_person = result.scalars().first()
    if not missing_person:
        raise HTTPException(status_code=404, detail="Case not found")

    if not has_read_all and has_read_own and not has_read_public and missing_person.reported_by != user.id:
        raise HTTPException(status_code=403, detail="Permission denied: not the owner of this case")

    has_pii = "cases:read_pii" in user_permissions or "*" in user_permissions
    case_schema = MissingPersonResponse.model_validate(missing_person)
    if not has_pii and missing_person.reported_by != user.id:
        case_schema.cnic = "MASKED"
        case_schema.contact_name = "MASKED"
        case_schema.contact_phone = "MASKED"

    updates_res = await db.execute(
        select(CaseUpdate).filter(CaseUpdate.case_id == case_uuid).order_by(CaseUpdate.created_at.desc())
    )
    updates = updates_res.scalars().all()

    return {
        "case": case_schema,
        "updates": [CaseUpdateResponse.model_validate(u) for u in updates]
    }


@router.patch("/{id}/status", response_model=MissingPersonResponse)
async def update_case_status(
    id: str,
    status_update: str = Form(...),
    notes: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(check_permission("cases:update")),
):
    """Update case status (restricted to authorized roles: NGO_WORKER, OFFICER, ADMIN)."""
    # Enforce role restriction
    if user.role not in [UserRole.NGO_WORKER, UserRole.OFFICER, UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Permission denied to update status")

    try:
        case_uuid = uuid.UUID(id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid case ID format")

    try:
        new_status_enum = MissingPersonStatus(status_update.upper())
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid status value: {status_update}")

    result = await db.execute(select(MissingPerson).filter(MissingPerson.id == case_uuid))
    missing_person = result.scalars().first()
    if not missing_person:
        raise HTTPException(status_code=404, detail="Case not found")

    old_status = missing_person.status.value
    missing_person.status = new_status_enum

    # Record in CaseUpdate
    case_update = CaseUpdate(
        case_id=missing_person.id,
        updated_by=user.id,
        update_type="STATUS_CHANGE",
        old_status=old_status,
        new_status=new_status_enum.value,
        notes=notes or f"Status updated by {user.full_name}",
    )
    db.add(case_update)

    # Notify reporter
    await send_notification(
        db, user_id=missing_person.reported_by,
        type=NotificationType.STATUS_UPDATE,
        message=f"Case {missing_person.case_number} status updated to {new_status_enum.value}",
        case_id=missing_person.id,
    )

    await db.commit()
    await db.refresh(missing_person)

    # Audit
    await create_audit_entry(
        db, action=AuditAction.UPDATE, table_name="missing_persons", record_id=missing_person.id,
        changed_by=user.id, changed_data={"status": new_status_enum.value},
    )

    return MissingPersonResponse.model_validate(missing_person)


@router.post("/{id}/sighting", response_model=SightingResponse, status_code=status.HTTP_201_CREATED)
async def add_sighting(
    id: str,
    location: str = Form(...),
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
    description: Optional[str] = Form(None),
    photo: Optional[UploadFile] = File(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(check_permission("cases:create")),
):
    """Add a sighting report for a missing person case (async)."""
    try:
        case_uuid = uuid.UUID(id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid case ID format")

    result = await db.execute(select(MissingPerson).filter(MissingPerson.id == case_uuid))
    missing_person = result.scalars().first()
    if not missing_person:
        raise HTTPException(status_code=404, detail="Case not found")

    photo_url = None
    if photo:
        error = validate_file(photo)
        if error:
            raise HTTPException(status_code=400, detail=error)
        photo_url = await save_upload(photo, subfolder="sightings")

    sighting = Sighting(
        missing_person_id=missing_person.id,
        reported_by=user.id,
        location=location,
        latitude=latitude,
        longitude=longitude,
        description=description,
        photo_url=photo_url,
    )
    db.add(sighting)
    await db.commit()
    await db.refresh(sighting)

    # Audit
    await create_audit_entry(
        db, action=AuditAction.CREATE, table_name="sightings", record_id=sighting.id,
        changed_by=user.id, changed_data={"missing_person_id": str(missing_person.id), "location": location},
    )

    # Send Notification to case reporter
    await send_notification(
        db, user_id=missing_person.reported_by,
        type=NotificationType.STATUS_UPDATE,
        message=f"A new sighting was reported for case {missing_person.case_number} at {location}",
        case_id=missing_person.id,
    )

    return SightingResponse.model_validate(sighting)


@router.get("/{id}/timeline")
async def get_case_timeline(
    id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(check_permission("cases:read")),
):
    """Get full case timeline chronologically."""
    try:
        case_uuid = uuid.UUID(id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid case ID format")

    result = await db.execute(select(MissingPerson).filter(MissingPerson.id == case_uuid))
    missing_person = result.scalars().first()
    if not missing_person:
        raise HTTPException(status_code=404, detail="Case not found")

    timeline = []

    # 1. Creation event
    timeline.append({
        "timestamp": missing_person.created_at.isoformat(),
        "event_type": "CREATION",
        "title": "Case Reported",
        "description": f"Case reported by {missing_person.contact_name or 'reporter'}",
    })

    # 2. Status Updates events
    updates_res = await db.execute(select(CaseUpdate).filter(CaseUpdate.case_id == case_uuid))
    for u in updates_res.scalars().all():
        timeline.append({
            "timestamp": u.created_at.isoformat(),
            "event_type": "STATUS_UPDATE",
            "title": f"Status changed: {u.old_status} → {u.new_status}",
            "description": u.notes or "",
        })

    # 3. Sightings events
    sightings_res = await db.execute(select(Sighting).filter(Sighting.missing_person_id == case_uuid))
    for s in sightings_res.scalars().all():
        timeline.append({
            "timestamp": s.created_at.isoformat(),
            "event_type": "SIGHTING",
            "title": f"Sighting reported at {s.location}",
            "description": s.description or "",
        })

    # Sort ascending by timestamp
    timeline.sort(key=lambda x: x["timestamp"])
    return timeline


@router.post("/disaster-intake", status_code=status.HTTP_201_CREATED)
async def disaster_intake(
    payload: List[Dict[str, Any]],
    db: AsyncSession = Depends(get_db),
    user: User = Depends(check_permission("cases:create")),
):
    """Bulk upload for disaster mode intake."""
    inserted_count = 0
    errors = []

    for index, data in enumerate(payload):
        try:
            missing_person = MissingPerson(
                reported_by=user.id,
                case_number=_generate_case_number(),
                status=MissingPersonStatus.MISSING,
                full_name=data["full_name"],
                age=int(data["age"]),
                gender=Gender(data["gender"].upper()),
                cnic=data.get("cnic"),
                last_seen_location=data.get("last_seen_location"),
                last_seen_city=data.get("last_seen_city"),
                physical_description=data.get("physical_description"),
                clothing_description=data.get("clothing_description"),
                distinguishing_marks=data.get("distinguishing_marks"),
                photo_url=data.get("photo_url"),
                contact_name=data.get("contact_name"),
                contact_phone=data.get("contact_phone"),
                is_disaster_case=True,
                disaster_event=data.get("disaster_event", "Disaster Bulk Ingest"),
            )
            db.add(missing_person)
            inserted_count += 1
            await db.flush()  # Allocate ID
            
            # Queue matching task
            run_ai_matching_task.delay(str(missing_person.id))
        except Exception as e:
            errors.append({"index": index, "error": str(e)})

    await db.commit()

    # Audit bulk create
    await create_audit_entry(
        db, action=AuditAction.CREATE, table_name="missing_persons",
        changed_by=user.id, changed_data={"bulk_intake_count": inserted_count, "errors_count": len(errors)},
    )

    return {
        "status": "success",
        "inserted_count": inserted_count,
        "errors": errors,
    }
