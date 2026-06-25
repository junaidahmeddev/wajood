"""WAJOOD — Seed Data — Auto-loads organizations, users, and sample cases on first startup.

This module is called from main.py during the lifespan startup event.
It checks if data already exists before inserting to ensure idempotency.
"""

import logging
import uuid
from datetime import datetime, timezone, timedelta

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database import SessionLocal
from app.models.organization import Organization, OrgType
from app.models.user import User, UserRole
from app.models.missing_person import MissingPerson, MissingPersonStatus, Gender
from app.models.found_person import FoundPerson, FoundPersonStatus
from app.models.case_update import CaseUpdate
from app.middleware.rbac import hash_password

logger = logging.getLogger("wajood_seed")


# ═══════════════════════════════════════════════
# Organization Seed Data
# ═══════════════════════════════════════════════
SEED_ORGANIZATIONS = [
    {
        "name": "Edhi Foundation",
        "type": OrgType.NGO,
        "city": "Karachi",
        "verified": True,
        "contact_email": "info@edhi.org",
        "contact_phone": "+92-21-111-1122",
        "address": "Edhi House, Bolton Market, Karachi",
    },
    {
        "name": "Chhipa Welfare",
        "type": OrgType.NGO,
        "city": "Karachi",
        "verified": True,
        "contact_email": "info@chhipa.org",
        "contact_phone": "+92-21-111-2233",
        "address": "Chhipa Center, North Nazimabad, Karachi",
    },
    {
        "name": "FIA Missing Persons Cell",
        "type": OrgType.LAW_ENFORCEMENT,
        "city": "Islamabad",
        "verified": True,
        "contact_email": "missing@fia.gov.pk",
        "contact_phone": "+92-51-9106384",
        "address": "FIA Headquarters, G-9/4, Islamabad",
    },
    {
        "name": "Jinnah Hospital Karachi",
        "type": OrgType.HOSPITAL,
        "city": "Karachi",
        "verified": True,
        "contact_email": "admin@jpmc.edu.pk",
        "contact_phone": "+92-21-99201300",
        "address": "Rafiqui Shaheed Road, Karachi",
    },
    {
        "name": "NDMA Pakistan",
        "type": OrgType.GOVERNMENT,
        "city": "Islamabad",
        "verified": True,
        "contact_email": "info@ndma.gov.pk",
        "contact_phone": "+92-51-9205037",
        "address": "Prime Minister's Office, Islamabad",
    },
]


# ═══════════════════════════════════════════════
# User Seed Data (one per role)
# ═══════════════════════════════════════════════
SEED_USERS = [
    {
        "email": "admin@wajood.pk",
        "full_name": "System Administrator",
        "phone": "+92-300-0000001",
        "role": UserRole.ADMIN,
        "password": "Admin1234!",
        "org_name": None,
    },
    {
        "email": "public@wajood.pk",
        "full_name": "Ahmed Khan",
        "phone": "+92-300-1234567",
        "role": UserRole.PUBLIC,
        "password": "Test1234!",
        "org_name": None,
    },
    {
        "email": "ngo@wajood.pk",
        "full_name": "Fatima Edhi",
        "phone": "+92-321-2345678",
        "role": UserRole.NGO_WORKER,
        "password": "Test1234!",
        "org_name": "Edhi Foundation",
    },
    {
        "email": "officer@wajood.pk",
        "full_name": "Inspector Rashid Mehmood",
        "phone": "+92-333-3456789",
        "role": UserRole.OFFICER,
        "password": "Test1234!",
        "org_name": "FIA",
    },
    {
        "email": "doctor@wajood.pk",
        "full_name": "Dr. Ayesha Siddiqui",
        "phone": "+92-345-4567890",
        "role": UserRole.DOCTOR,
        "password": "Test1234!",
        "org_name": "Jinnah Hospital",
    },
    {
        "email": "volunteer@wajood.pk",
        "full_name": "Ali Raza",
        "phone": "+92-312-5678901",
        "role": UserRole.VOLUNTEER,
        "password": "Test1234!",
        "org_name": None,
    },
    {
        "email": "media@wajood.pk",
        "full_name": "Sana Bucha",
        "phone": "+92-334-6789012",
        "role": UserRole.JOURNALIST,
        "password": "Test1234!",
        "org_name": None,
    },
    {
        "email": "govt@wajood.pk",
        "full_name": "Irfan Ahmad Mughal",
        "phone": "+92-301-7890123",
        "role": UserRole.GOVT_OFFICIAL,
        "password": "Test1234!",
        "org_name": "NDMA",
    },
    {
        "email": "forensics@wajood.pk",
        "full_name": "Dr. Tariq Mahmood",
        "phone": "+92-322-8901234",
        "role": UserRole.FORENSICS,
        "password": "Test1234!",
        "org_name": None,
    },
]


# ═══════════════════════════════════════════════
# Sample Missing Persons Cases
# ═══════════════════════════════════════════════
SEED_CASES = [
    {
        "case_number": "WJD-2024-KHI01",
        "full_name": "Muhammad Bilal",
        "age": 14,
        "gender": Gender.MALE,
        "status": MissingPersonStatus.MISSING,
        "last_seen_city": "Karachi",
        "last_seen_location": "Saddar Bazaar, near Empress Market",
        "last_seen_date": datetime(2024, 11, 15, 14, 30, tzinfo=timezone.utc),
        "physical_description": "Height 5'2\", slim build, fair complexion, short black hair",
        "clothing_description": "Blue school uniform, white sneakers, black backpack",
        "distinguishing_marks": "Small scar on left eyebrow, birthmark on right hand",
        "contact_name": "Iqbal Ahmed (Father)",
        "contact_phone": "+92-300-2345678",
        "is_disaster_case": False,
        "photo_url": "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=150&auto=format&fit=crop",
    },
    {
        "case_number": "WJD-2024-LHR02",
        "full_name": "Zainab Fatima",
        "age": 8,
        "gender": Gender.FEMALE,
        "status": MissingPersonStatus.MISSING,
        "last_seen_city": "Lahore",
        "last_seen_location": "Anarkali Bazaar, near Food Street entrance",
        "last_seen_date": datetime(2024, 12, 1, 17, 0, tzinfo=timezone.utc),
        "physical_description": "Height 4'0\", medium build, wheatish complexion, long braided hair",
        "clothing_description": "Pink shalwar kameez, red dupatta, black sandals",
        "distinguishing_marks": "Dimples on both cheeks, mole below left ear",
        "contact_name": "Nasreen Bibi (Mother)",
        "contact_phone": "+92-321-3456789",
        "is_disaster_case": False,
        "photo_url": "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=150&auto=format&fit=crop",
    },
    {
        "case_number": "WJD-2024-ISB03",
        "full_name": "Hamza Ali Shah",
        "age": 22,
        "gender": Gender.MALE,
        "status": MissingPersonStatus.IN_PROCESS,
        "last_seen_city": "Islamabad",
        "last_seen_location": "F-6 Markaz, Super Market area",
        "last_seen_date": datetime(2024, 10, 20, 21, 15, tzinfo=timezone.utc),
        "physical_description": "Height 5'10\", athletic build, light brown complexion, beard",
        "clothing_description": "Grey hoodie, blue jeans, white Adidas sneakers",
        "distinguishing_marks": "Tattoo of crescent on right forearm",
        "contact_name": "Shah Zaman (Brother)",
        "contact_phone": "+92-333-4567890",
        "is_disaster_case": False,
        "photo_url": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=150&auto=format&fit=crop",
    },
    {
        "case_number": "WJD-2024-PSH04",
        "full_name": "Gul Naz",
        "age": 35,
        "gender": Gender.FEMALE,
        "status": MissingPersonStatus.MATCHED,
        "last_seen_city": "Peshawar",
        "last_seen_location": "Qissa Khwani Bazaar",
        "last_seen_date": datetime(2024, 9, 5, 10, 0, tzinfo=timezone.utc),
        "physical_description": "Height 5'4\", heavy build, dark complexion, henna-dyed hair",
        "clothing_description": "Black burqa, blue shalwar kameez underneath",
        "distinguishing_marks": "Gold dental cap on front tooth, henna on hands",
        "contact_name": "Fazal Rahman (Husband)",
        "contact_phone": "+92-345-5678901",
        "is_disaster_case": False,
        "photo_url": "https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=150&auto=format&fit=crop",
    },
    {
        "case_number": "WJD-2024-QTA05",
        "full_name": "Abdul Rehman Baloch",
        "age": 45,
        "gender": Gender.MALE,
        "status": MissingPersonStatus.FOUND_ALIVE,
        "last_seen_city": "Quetta",
        "last_seen_location": "Liaquat Bazaar, near Railway Station",
        "last_seen_date": datetime(2024, 8, 12, 8, 45, tzinfo=timezone.utc),
        "physical_description": "Height 5'8\", stocky build, dark complexion, grey hair, bushy mustache",
        "clothing_description": "White shalwar kameez, brown waistcoat, Balochi turban",
        "distinguishing_marks": "Missing left ring finger, deep scar across right palm",
        "contact_name": "Noor Muhammad (Son)",
        "contact_phone": "+92-312-6789012",
        "is_disaster_case": False,
        "photo_url": "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=150&auto=format&fit=crop",
    },
]


# ═══════════════════════════════════════════════
# Main Seed Function
# ═══════════════════════════════════════════════
async def run_seed():
    """Run all seed operations. Idempotent — skips if data already exists."""
    async with SessionLocal() as db:
        try:
            # Check if seed data already exists
            user_count_result = await db.execute(select(func.count()).select_from(User))
            user_count = user_count_result.scalar()
            if user_count > 1:  # More than just the admin from old seed
                logger.info("📦 Seed data already exists — skipping seed.")
                return

            logger.info("🌱 Starting seed data loading...")

            # ── 1. Seed Organizations ──
            org_map = {}  # name -> Organization object
            for org_data in SEED_ORGANIZATIONS:
                # Check if org already exists
                result = await db.execute(
                    select(Organization).filter(Organization.name == org_data["name"])
                )
                existing = result.scalars().first()
                if existing:
                    org_map[org_data["name"]] = existing
                    logger.info(f"  ⏭️  Organization already exists: {org_data['name']}")
                    continue

                org = Organization(
                    name=org_data["name"],
                    type=org_data["type"],
                    city=org_data["city"],
                    verified=org_data["verified"],
                    contact_email=org_data["contact_email"],
                    contact_phone=org_data["contact_phone"],
                    address=org_data["address"],
                )
                db.add(org)
                org_map[org_data["name"]] = org

            await db.flush()  # Flush to generate UUIDs for organizations
            logger.info(f"  ✅ {len(SEED_ORGANIZATIONS)} organizations seeded")

            # ── 2. Seed Users ──
            user_map = {}  # email -> User object
            for user_data in SEED_USERS:
                # Check if user already exists
                result = await db.execute(
                    select(User).filter(User.email == user_data["email"])
                )
                existing = result.scalars().first()
                if existing:
                    user_map[user_data["email"]] = existing
                    logger.info(f"  ⏭️  User already exists: {user_data['email']}")
                    continue

                # Resolve organization (with fuzzy name mapping support)
                org_id = None
                if user_data["org_name"]:
                    if user_data["org_name"] in org_map:
                        org_id = org_map[user_data["org_name"]].id
                    else:
                        for name, org in org_map.items():
                            if user_data["org_name"] in name or name in user_data["org_name"]:
                                org_id = org.id
                                break

                user = User(
                    email=user_data["email"],
                    full_name=user_data["full_name"],
                    phone=user_data["phone"],
                    password_hash=hash_password(user_data["password"]),
                    role=user_data["role"],
                    organization_id=org_id,
                    is_active=True,
                )
                db.add(user)
                user_map[user_data["email"]] = user

            await db.flush()  # Flush to generate UUIDs for users
            logger.info(f"  ✅ {len(SEED_USERS)} users seeded")

            # ── 3. Seed Missing Persons Cases ──
            case_count_result = await db.execute(select(func.count()).select_from(MissingPerson))
            case_count = case_count_result.scalar()
            if case_count > 0:
                logger.info(f"  ⏭️  {case_count} cases already exist — skipping case seed")
            else:
                # Use public user as the reporter for all seed cases
                reporter = user_map.get("public@wajood.pk")
                if not reporter:
                    logger.warning("  ⚠️  public@wajood.pk not found — cannot seed cases")
                else:
                    for case_data in SEED_CASES:
                        missing = MissingPerson(
                            reported_by=reporter.id,
                            case_number=case_data["case_number"],
                            full_name=case_data["full_name"],
                            age=case_data["age"],
                            gender=case_data["gender"],
                            status=case_data["status"],
                            last_seen_city=case_data["last_seen_city"],
                            last_seen_location=case_data["last_seen_location"],
                            last_seen_date=case_data["last_seen_date"],
                            physical_description=case_data["physical_description"],
                            clothing_description=case_data["clothing_description"],
                            distinguishing_marks=case_data["distinguishing_marks"],
                            contact_name=case_data["contact_name"],
                            contact_phone=case_data["contact_phone"],
                            is_disaster_case=case_data["is_disaster_case"],
                            photo_url=case_data["photo_url"],
                        )
                        db.add(missing)

                    await db.flush()
                    logger.info(f"  ✅ {len(SEED_CASES)} missing person cases seeded")

                    # Add a CaseUpdate for non-MISSING cases to show timeline activity
                    officer = user_map.get("officer@wajood.pk")
                    if officer:
                        # Case 3: IN_PROCESS
                        result = await db.execute(
                            select(MissingPerson).filter(MissingPerson.case_number == "WJD-2024-ISB03")
                        )
                        case3 = result.scalars().first()
                        if case3:
                            db.add(CaseUpdate(
                                case_id=case3.id,
                                updated_by=officer.id,
                                update_type="STATUS_CHANGE",
                                old_status="MISSING",
                                new_status="IN_PROCESS",
                                notes="FIA investigation initiated. Witness statements collected from F-6 area.",
                             ))

                        # Case 4: MATCHED
                        result = await db.execute(
                            select(MissingPerson).filter(MissingPerson.case_number == "WJD-2024-PSH04")
                        )
                        case4 = result.scalars().first()
                        if case4:
                            db.add(CaseUpdate(
                                case_id=case4.id,
                                updated_by=officer.id,
                                update_type="STATUS_CHANGE",
                                old_status="MISSING",
                                new_status="MATCHED",
                                notes="Potential match found at Edhi shelter in Peshawar. Face similarity: 87%. Awaiting family confirmation.",
                            ))

                        # Case 5: FOUND_ALIVE
                        result = await db.execute(
                            select(MissingPerson).filter(MissingPerson.case_number == "WJD-2024-QTA05")
                        )
                        case5 = result.scalars().first()
                        if case5:
                            db.add(CaseUpdate(
                                case_id=case5.id,
                                updated_by=officer.id,
                                update_type="STATUS_CHANGE",
                                old_status="MISSING",
                                new_status="IN_PROCESS",
                                notes="Sighting reported near Quetta railway station. Police dispatch assigned.",
                            ))
                            db.add(CaseUpdate(
                                case_id=case5.id,
                                updated_by=officer.id,
                                update_type="STATUS_CHANGE",
                                old_status="IN_PROCESS",
                                new_status="FOUND_ALIVE",
                                notes="Person recovered alive from a shelter in Quetta. Reunited with family.",
                            ))

                        logger.info("  ✅ Case timeline updates seeded")

            # ── Commit everything ──
            await db.commit()
            logger.info("🌱 ✅ Seed data loading complete!")

            # Print login credentials summary
            logger.info("═" * 60)
            logger.info("  SEED USER CREDENTIALS")
            logger.info("═" * 60)
            for u in SEED_USERS:
                role_str = u["role"].value.ljust(15)
                logger.info(f"  {role_str} → {u['email']} / {u['password']}")
            logger.info("═" * 60)

        except Exception as e:
            logger.error(f"❌ Seed data failed: {e}")
            await db.rollback()
            raise
