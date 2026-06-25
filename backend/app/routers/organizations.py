"""Organizations router — CRUD and admin verification (async)."""

import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.user import User, UserRole
from app.models.organization import Organization, OrgType
from app.schemas.organization import OrgCreate, OrgResponse, OrgUpdate
from app.middleware.rbac import get_current_user, require_roles, get_optional_user
from app.services.audit_chain import create_audit_entry
from app.models.audit import AuditAction

router = APIRouter(prefix="/api/organizations", tags=["Organizations"])


@router.post("/", response_model=OrgResponse, status_code=status.HTTP_201_CREATED)
async def create_organization(
    data: OrgCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Create a new organization (async)."""
    org = Organization(
        name=data.name,
        type=data.type,
        contact_email=data.contact_email,
        contact_phone=data.contact_phone,
        city=data.city,
        address=data.address,
        verified=False,
    )
    db.add(org)
    await db.commit()
    await db.refresh(org)

    # Log audit entry
    await create_audit_entry(
        db, action=AuditAction.CREATE, table_name="organizations", record_id=org.id,
        changed_by=user.id, changed_data={"name": org.name, "type": org.type.value},
    )

    return OrgResponse.model_validate(org)


@router.get("/", response_model=list[OrgResponse])
async def list_organizations(
    type_filter: Optional[OrgType] = Query(None, alias="type"),
    verified_only: bool = False,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: Optional[User] = Depends(get_optional_user),
):
    """List organizations with optional filters (async)."""
    query = select(Organization)

    # Regular users can only see verified organizations.
    if not user or user.role != UserRole.ADMIN:
        query = query.filter(Organization.verified == True)
    elif verified_only:
        query = query.filter(Organization.verified == True)

    if type_filter:
        query = query.filter(Organization.type == type_filter)
    if search:
        query = query.filter(Organization.name.ilike(f"%{search}%"))

    result = await db.execute(
        query.order_by(Organization.name).offset((page - 1) * per_page).limit(per_page)
    )
    orgs = result.scalars().all()
    return [OrgResponse.model_validate(o) for o in orgs]


@router.get("/{org_id}", response_model=OrgResponse)
async def get_organization(
    org_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get an organization by ID (async)."""
    try:
        org_uuid = uuid.UUID(org_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid organization ID format")

    result = await db.execute(select(Organization).filter(Organization.id == org_uuid))
    org = result.scalars().first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return OrgResponse.model_validate(org)


@router.patch("/{org_id}/verify", response_model=OrgResponse)
async def verify_organization(
    org_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_roles([UserRole.ADMIN])),
):
    """Verify an organization (admin only) (async)."""
    try:
        org_uuid = uuid.UUID(org_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid organization ID format")

    result = await db.execute(select(Organization).filter(Organization.id == org_uuid))
    org = result.scalars().first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    org.verified = True
    await db.commit()
    await db.refresh(org)

    # Log audit entry
    await create_audit_entry(
        db, action=AuditAction.UPDATE, table_name="organizations", record_id=org.id,
        changed_by=user.id, changed_data={"verified": True},
    )

    return OrgResponse.model_validate(org)
