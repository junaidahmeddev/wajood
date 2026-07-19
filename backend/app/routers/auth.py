"""Authentication router — register, login, profile (async)."""

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.middleware.rbac import (
    hash_password, verify_password, create_access_token, get_current_user, require_roles
)
from app.models.user import User, UserRole
from app.schemas.user import UserCreate, UserLogin, UserResponse, TokenResponse, UserUpdate
from app.services.audit_chain import create_audit_entry

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(data: UserCreate, request: Request, db: AsyncSession = Depends(get_db)):
    """Register a new user (async)."""
    # Check if email already exists
    result = await db.execute(select(User).filter(User.email == data.email))
    existing = result.scalars().first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    user = User(
        email=data.email,
        full_name=data.full_name,
        password_hash=hash_password(data.password),
        phone=data.phone,
        role=data.role,
        organization_id=data.organization_id,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    # Audit log
    from app.models.audit import AuditAction
    await create_audit_entry(
        db, action=AuditAction.CREATE, table_name="users", record_id=user.id,
        changed_by=user.id,
        changed_data={"role": user.role.value},
    )

    # Generate token
    token = create_access_token({"sub": str(user.id), "role": user.role.value})
    return TokenResponse(
        access_token=token,
        user=UserResponse.model_validate(user),
    )


@router.post("/login", response_model=TokenResponse)
async def login(data: UserLogin, request: Request, db: AsyncSession = Depends(get_db)):
    """Login with email and password (async)."""
    result = await db.execute(select(User).filter(User.email == data.email))
    user = result.scalars().first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled",
        )

    # Audit log
    from app.models.audit import AuditAction
    await create_audit_entry(
        db, action=AuditAction.UPDATE, table_name="users", record_id=user.id,
        changed_by=user.id, changed_data={"event": "login"},
    )

    token = create_access_token({"sub": str(user.id), "role": user.role.value})
    return TokenResponse(
        access_token=token,
        user=UserResponse.model_validate(user),
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(request: Request, db: AsyncSession = Depends(get_db)):
    """Refresh JWT token."""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header",
        )
    token = auth_header.split(" ")[1]
    
    from jose import jwt
    from app.config import settings
    from app.middleware.rbac import refresh_access_token
    import uuid

    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            options={"verify_exp": False},
            algorithms=[settings.JWT_ALGORITHM]
        )
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token payload")
        
        result = await db.execute(select(User).filter(User.id == uuid.UUID(user_id)))
        user = result.scalars().first()
        if not user or not user.is_active:
            raise HTTPException(status_code=401, detail="User not found or inactive")
        
        new_token = refresh_access_token(token)
        return TokenResponse(
            access_token=new_token,
            user=UserResponse.model_validate(user),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token refresh failed: {str(e)}",
        )


@router.get("/me", response_model=UserResponse)
async def get_profile(user: User = Depends(get_current_user)):
    """Get current user profile (async)."""
    return UserResponse.model_validate(user)


@router.get("/users", response_model=list[UserResponse])
async def get_users(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_roles([UserRole.ADMIN])),
):
    """Get all registered users (Admin only)."""
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    users = result.scalars().all()
    return [UserResponse.model_validate(u) for u in users]


@router.patch("/users/{id}", response_model=UserResponse)
async def update_user(
    id: str,
    data: UserUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_roles([UserRole.ADMIN])),
):
    """Update user info (Admin only) (async)."""
    import uuid
    try:
        user_uuid = uuid.UUID(id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user ID format")

    result = await db.execute(select(User).filter(User.id == user_uuid))
    db_user = result.scalars().first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_user, key, value)

    await db.commit()
    await db.refresh(db_user)

    # Log audit entry
    from app.models.audit import AuditAction
    await create_audit_entry(
        db, action=AuditAction.UPDATE, table_name="users", record_id=db_user.id,
        changed_by=user.id, changed_data=update_data,
    )

    return UserResponse.model_validate(db_user)
