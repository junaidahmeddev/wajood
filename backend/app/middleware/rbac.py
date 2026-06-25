"""Role-Based Access Control (RBAC) middleware and dependencies."""

import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext
from app.config import settings
from app.database import get_db
from app.models.user import User, UserRole

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT bearer scheme
security = HTTPBearer()


def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict) -> str:
    """Create a JWT access token."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc).timestamp() + (settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    """Decode and validate a JWT token."""
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )


def refresh_access_token(expired_token: str) -> str:
    """Decode an expired token, verify signature, and return a new access token."""
    try:
        payload = jwt.decode(
            expired_token,
            settings.JWT_SECRET_KEY,
            options={"verify_exp": False},
            algorithms=[settings.JWT_ALGORITHM]
        )
        user_id = payload.get("sub")
        role = payload.get("role")
        if not user_id:
            raise JWTError("Invalid token payload")
        return create_access_token({"sub": user_id, "role": role})
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token signature",
        )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Extract and validate the current user from JWT token."""
    payload = decode_token(credentials.credentials)
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    try:
        user_uuid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user ID format in token",
        )

    result = await db.execute(select(User).filter(User.id == user_uuid))
    user = result.scalars().first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is disabled",
        )
    return user


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False)),
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    """Optionally extract the current user (for public endpoints that benefit from auth)."""
    if credentials is None:
        return None
    try:
        return await get_current_user(credentials, db)
    except HTTPException:
        return None


# ─── Role-based permission checking ───

# Define what each role can access
ROLE_PERMISSIONS = {
    UserRole.ADMIN: ["*"],
    UserRole.PUBLIC: [
        "cases:create", "cases:read_own", "cases:read_public", "sightings:create"
    ],
    UserRole.NGO_WORKER: [
        "persons:create", "persons:read", "shelter:update", "matches:read", "cases:read_public"
    ],
    UserRole.OFFICER: [
        "cases:read_all", "cases:read_pii", "matching:run", "cases:update", "cases:search_cross_district", "cases:export", "persons:read", "matches:read"
    ],
    UserRole.DOCTOR: [
        "persons:create", "persons:update", "matches:read", "cases:read_public"
    ],
    UserRole.VOLUNTEER: [
        "sightings:create", "cases:read_nearby", "tasks:accept", "cases:read_public"
    ],
    UserRole.JOURNALIST: [
        "analytics:read", "notifications:read_public", "cases:read_public"
    ],
    UserRole.GOVT_OFFICIAL: [
        "analytics:read", "disaster:trigger", "cases:create_bulk", "reports:export", "cases:read_public"
    ],
    UserRole.FORENSICS: [
        "forensics:dna_upload", "matching:read", "persons:update", "cases:read_public"
    ],
}


def check_permission(required_permission: str):
    """
    FastAPI dependency that checks if the current user has a specific permission.
    Usage: Depends(check_permission("cases:create"))
    """
    def _checker(user: User = Depends(get_current_user)):
        user_permissions = ROLE_PERMISSIONS.get(user.role, [])
        if "*" in user_permissions or required_permission in user_permissions:
            return user
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Permission denied: {required_permission} required",
        )
    return _checker


def require_roles(allowed_roles: List[UserRole]):
    """
    FastAPI dependency that restricts access to specific roles.
    Usage: Depends(require_roles([UserRole.ADMIN, UserRole.OFFICER]))
    """
    def _checker(user: User = Depends(get_current_user)):
        if user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access restricted to roles: {[r.value for r in allowed_roles]}",
            )
        return user
    return _checker
