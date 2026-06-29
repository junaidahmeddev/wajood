"""Analytics router — dashboard stats, charts data, and breakdowns (async)."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database import get_db
from app.models.user import User
from app.models.missing_person import MissingPerson, MissingPersonStatus
from app.models.found_person import FoundPerson, FoundPersonStatus
from app.models.match import Match, MatchStatus
from app.models.organization import Organization
from app.models.audit import AuditLog
from app.models.user import UserRole
from app.middleware.rbac import get_current_user, check_permission, require_roles

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])


@router.get("/overview")
async def get_overview_stats(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get overall dashboard overview statistics (async)."""
    # Count totals by status asynchronously
    total_missing = (await db.execute(select(func.count(MissingPerson.id)))).scalar() or 0
    
    active_missing = (await db.execute(
        select(func.count(MissingPerson.id)).filter(
            MissingPerson.status.in_([MissingPersonStatus.MISSING, MissingPersonStatus.IN_PROCESS, MissingPersonStatus.MATCHED])
        )
    )).scalar() or 0
    
    resolved_missing = (await db.execute(
        select(func.count(MissingPerson.id)).filter(
            MissingPerson.status.in_([MissingPersonStatus.FOUND_ALIVE, MissingPersonStatus.DECEASED, MissingPersonStatus.CLOSED])
        )
    )).scalar() or 0

    total_found = (await db.execute(select(func.count(FoundPerson.id)))).scalar() or 0
    
    unidentified_found = (await db.execute(
        select(func.count(FoundPerson.id)).filter(FoundPerson.status == FoundPersonStatus.UNIDENTIFIED)
    )).scalar() or 0

    returned_found = (await db.execute(
        select(func.count(FoundPerson.id)).filter(FoundPerson.status == FoundPersonStatus.RETURNED)
    )).scalar() or 0

    matched_found = (await db.execute(
        select(func.count(FoundPerson.id)).filter(FoundPerson.status == FoundPersonStatus.MATCHED)
    )).scalar() or 0

    return {
        "missing_persons": {
            "total": total_missing,
            "active": active_missing,
            "resolved": resolved_missing,
            "resolution_rate": round(resolved_missing / max(total_missing, 1) * 100, 1),
        },
        "found_persons": {
            "total": total_found,
            "unidentified": unidentified_found,
            "returned": returned_found,
            "matched": matched_found,
        },
        "overall": {
            "total_cases": total_missing + total_found,
            "active_cases": active_missing + unidentified_found,
        }
    }


@router.get("/by-city")
async def cases_by_city(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get case counts grouped by last seen city (async)."""
    result = await db.execute(
        select(MissingPerson.last_seen_city, func.count(MissingPerson.id))
        .filter(MissingPerson.last_seen_city.isnot(None))
        .group_by(MissingPerson.last_seen_city)
    )
    results = result.all()
    return [{"city": r[0], "count": r[1]} for r in results]


@router.get("/by-month")
async def cases_by_month(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get case counts grouped by month (async)."""
    result = await db.execute(
        select(
            func.to_char(MissingPerson.created_at, 'YYYY-MM').label('month'),
            func.count(MissingPerson.id)
        )
        .group_by('month')
        .order_by('month')
    )
    results = result.all()
    return [{"month": r[0], "count": r[1]} for r in results]


@router.get("/disaster")
async def disaster_stats(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get disaster case statistics grouped by event (async)."""
    result = await db.execute(
        select(MissingPerson.disaster_event, func.count(MissingPerson.id))
        .filter(MissingPerson.is_disaster_case == True)
        .group_by(MissingPerson.disaster_event)
    )
    results = result.all()
    return [{"disaster_event": r[0] or "General Disaster", "count": r[1]} for r in results]


@router.get("/match-rate")
async def match_rate(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get AI matching success rate statistics (async)."""
    total = (await db.execute(select(func.count(Match.id)))).scalar() or 0
    confirmed = (await db.execute(
        select(func.count(Match.id)).filter(Match.status == MatchStatus.CONFIRMED)
    )).scalar() or 0
    rejected = (await db.execute(
        select(func.count(Match.id)).filter(Match.status == MatchStatus.REJECTED)
    )).scalar() or 0

    success_rate = 0.0
    if (confirmed + rejected) > 0:
        success_rate = round(confirmed / (confirmed + rejected) * 100, 1)

    return {
        "total_matches": total,
        "confirmed": confirmed,
        "rejected": rejected,
        "success_rate": success_rate,
    }


@router.get("/dashboard")
async def dashboard_stats(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get high-level dashboard stats (async)."""
    users_count = (await db.execute(select(func.count(User.id)))).scalar() or 0
    cases_count = (await db.execute(select(func.count(MissingPerson.id)))).scalar() or 0
    orgs_count = (await db.execute(select(func.count(Organization.id)))).scalar() or 0
    matches_count = (await db.execute(select(func.count(Match.id)))).scalar() or 0
    active_cases = (await db.execute(
        select(func.count(MissingPerson.id)).filter(
            MissingPerson.status.in_([MissingPersonStatus.MISSING, MissingPersonStatus.IN_PROCESS, MissingPersonStatus.MATCHED])
        )
    )).scalar() or 0
    resolved_cases = (await db.execute(
        select(func.count(MissingPerson.id)).filter(
            MissingPerson.status.in_([MissingPersonStatus.FOUND_ALIVE, MissingPersonStatus.DECEASED, MissingPersonStatus.CLOSED])
        )
    )).scalar() or 0

    return {
        "cases": {
            "total": cases_count,
            "active": active_cases,
            "resolved": resolved_cases,
            "resolution_rate": round(resolved_cases / max(cases_count, 1) * 100, 1),
        },
        "persons": {
            "total": cases_count,
            "missing": active_cases,
            "found": resolved_cases,
            "unidentified": max(cases_count - active_cases - resolved_cases, 0),
        },
        "organizations": {
            "total": orgs_count,
            "verified": orgs_count,
        },
        "users": {
            "total": users_count,
        },
        "total_users": users_count,
        "total_cases": cases_count,
        "total_organizations": orgs_count,
        "total_matches": matches_count,
        "active_cases": active_cases,
        "resolved_cases": resolved_cases,
        "total_missing": active_cases,
        "found_alive": resolved_cases,
        "ai_matches": matches_count,
        "recovery_rate": f"{round(resolved_cases / max(cases_count, 1) * 100, 1)}%",
    }


@router.get("/audit-logs")
async def get_audit_logs(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_roles([UserRole.ADMIN])),
):
    """Get recent audit logs (Admin only)."""
    result = await db.execute(
        select(AuditLog).order_by(AuditLog.created_at.desc()).limit(50)
    )
    logs = result.scalars().all()
    return logs
