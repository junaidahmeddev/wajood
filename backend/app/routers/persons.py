"""Persons (Found Persons) router — CRUD and search for found person records under /found (async)."""

import uuid
import logging
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.user import User, UserRole
from app.models.found_person import FoundPerson, FoundPersonStatus
from app.models.missing_person import Gender
from app.schemas.found_person import FoundPersonResponse
from app.middleware.rbac import get_current_user, check_permission
from app.services.file_storage import save_upload, validate_file
from app.services.face_recognition import extract_face_embedding
from app.services.audit_chain import create_audit_entry
from app.models.audit import AuditAction

logger = logging.getLogger("wajood_persons")
router = APIRouter(prefix="/api/persons", tags=["Persons"])


@router.post("/found", response_model=FoundPersonResponse, status_code=status.HTTP_201_CREATED)
async def register_found_person(
    approximate_age: Optional[int] = Form(None),
    gender: Gender = Form(...),
    found_location: Optional[str] = Form(None),
    found_date: Optional[str] = Form(None),
    found_city: Optional[str] = Form(None),
    physical_description: Optional[str] = Form(None),
    is_alive: bool = Form(True),
    morgue_id: Optional[str] = Form(None),
    hospital_name: Optional[str] = Form(None),
    notes: Optional[str] = Form(None),
    organization_id: Optional[str] = Form(None),
    photo: Optional[UploadFile] = File(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(check_permission("persons:create")),
):
    """Register a found person (restricted to NGO_WORKER, DOCTOR, OFFICER, VOLUNTEER, ADMIN)."""
    # Enforce role restriction
    if user.role not in [UserRole.NGO_WORKER, UserRole.DOCTOR, UserRole.OFFICER, UserRole.VOLUNTEER, UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Permission denied to register found persons")

    photo_url = None
    face_embedding = None

    if photo:
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
    if found_date:
        try:
            parsed_date = datetime.fromisoformat(found_date.replace("Z", "+00:00"))
        except ValueError:
            parsed_date = None

    org_uuid = None
    if organization_id:
        try:
            org_uuid = uuid.UUID(organization_id)
        except ValueError:
            org_uuid = None

    person = FoundPerson(
        registered_by=user.id,
        organization_id=org_uuid,
        status=FoundPersonStatus.UNIDENTIFIED,
        approximate_age=approximate_age,
        gender=gender,
        found_location=found_location,
        found_date=parsed_date,
        found_city=found_city,
        physical_description=physical_description,
        photo_url=photo_url,
        face_embedding=face_embedding,
        is_alive=is_alive,
        morgue_id=morgue_id,
        hospital_name=hospital_name,
        notes=notes,
    )
    db.add(person)
    await db.commit()
    await db.refresh(person)

    # Audit
    await create_audit_entry(
        db, action=AuditAction.CREATE, table_name="found_persons", record_id=person.id,
        changed_by=user.id, changed_data={"status": person.status.value},
    )

    # Queue background matching
    try:
        from app.tasks import run_found_person_matching_task
        run_found_person_matching_task.delay(str(person.id))
        logger.info(f"🚀 Queued matching background worker task for FoundPerson {person.id}")
    except Exception as e:
        logger.warning(f"Failed to queue celery matching task for FoundPerson: {e}")

    return FoundPersonResponse.model_validate(person)


@router.get("/found", response_model=list[FoundPersonResponse])
async def list_found_persons(
    status_filter: Optional[FoundPersonStatus] = Query(None, alias="status"),
    gender: Optional[Gender] = None,
    city: Optional[str] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(check_permission("persons:read")),
):
    """List all found persons (async)."""
    query = select(FoundPerson)

    if status_filter:
        query = query.filter(FoundPerson.status == status_filter)
    if gender:
        query = query.filter(FoundPerson.gender == gender)
    if city:
        query = query.filter(FoundPerson.found_city.ilike(f"%{city}%"))
    if search:
        query = query.filter(
            FoundPerson.physical_description.ilike(f"%{search}%")
            | FoundPerson.notes.ilike(f"%{search}%")
        )

    result = await db.execute(
        query.order_by(FoundPerson.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    )
    persons = result.scalars().all()
    return [FoundPersonResponse.model_validate(p) for p in persons]


@router.get("/found/{id}", response_model=FoundPersonResponse)
async def get_found_person_details(
    id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(check_permission("persons:read")),
):
    """Get found person details by ID (async)."""
    try:
        person_uuid = uuid.UUID(id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid person ID format")

    result = await db.execute(select(FoundPerson).filter(FoundPerson.id == person_uuid))
    person = result.scalars().first()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")
    return FoundPersonResponse.model_validate(person)


@router.patch("/found/{id}", response_model=FoundPersonResponse)
async def update_found_person_info(
    id: str,
    approximate_age: Optional[int] = Form(None),
    gender: Optional[Gender] = Form(None),
    found_location: Optional[str] = Form(None),
    found_city: Optional[str] = Form(None),
    physical_description: Optional[str] = Form(None),
    is_alive: Optional[bool] = Form(None),
    morgue_id: Optional[str] = Form(None),
    hospital_name: Optional[str] = Form(None),
    notes: Optional[str] = Form(None),
    status_update: Optional[FoundPersonStatus] = Form(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(check_permission("persons:update")),
):
    """Update found person info (async)."""
    try:
        person_uuid = uuid.UUID(id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid person ID format")

    result = await db.execute(select(FoundPerson).filter(FoundPerson.id == person_uuid))
    person = result.scalars().first()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")

    update_data = {}
    if approximate_age is not None:
        person.approximate_age = approximate_age
        update_data["approximate_age"] = approximate_age
    if gender is not None:
        person.gender = gender
        update_data["gender"] = gender.value
    if found_location is not None:
        person.found_location = found_location
        update_data["found_location"] = found_location
    if found_city is not None:
        person.found_city = found_city
        update_data["found_city"] = found_city
    if physical_description is not None:
        person.physical_description = physical_description
        update_data["physical_description"] = physical_description
    if is_alive is not None:
        person.is_alive = is_alive
        update_data["is_alive"] = is_alive
    if morgue_id is not None:
        person.morgue_id = morgue_id
        update_data["morgue_id"] = morgue_id
    if hospital_name is not None:
        person.hospital_name = hospital_name
        update_data["hospital_name"] = hospital_name
    if notes is not None:
        person.notes = notes
        update_data["notes"] = notes
    if status_update is not None:
        person.status = status_update
        update_data["status"] = status_update.value

    await db.commit()
    await db.refresh(person)

    # Audit
    await create_audit_entry(
        db, action=AuditAction.UPDATE, table_name="found_persons", record_id=person.id,
        changed_by=user.id, changed_data=update_data,
    )

    return FoundPersonResponse.model_validate(person)
