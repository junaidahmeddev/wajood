"""Notifications router (async)."""

import uuid
from typing import Optional, List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from app.database import get_db
from app.models.user import User, UserRole
from app.models.notification import Notification, NotificationType
from app.middleware.rbac import get_current_user, require_roles
from app.services.notification import get_user_notifications, mark_as_read, mark_all_as_read, send_notification

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])


class NotificationResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    case_id: Optional[uuid.UUID] = None
    type: NotificationType
    message: str
    is_read: bool
    sent_via: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class BroadcastRequest(BaseModel):
    title: Optional[str] = "🚨 Emergency Broadcast"
    message: str
    city: Optional[str] = None


@router.get("/", response_model=list[NotificationResponse])
async def get_notifications(
    unread_only: bool = False,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get notifications for the current user (async)."""
    notifs = await get_user_notifications(db, user.id, unread_only=unread_only)
    return [NotificationResponse.model_validate(n) for n in notifs]


@router.get("/unread-count")
async def unread_count(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get count of unread notifications (async)."""
    count = (await db.execute(
        select(func.count(Notification.id)).filter(
            Notification.user_id == user.id,
            Notification.is_read == False
        )
    )).scalar() or 0
    return {"unread_count": count}


@router.patch("/read-all")
async def read_all_notifications(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Mark all notifications as read (async)."""
    count = await mark_all_as_read(db, user.id)
    return {"status": "success", "count": count}



@router.patch("/{id}/read")
async def read_notification(
    id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Mark a notification as read (async)."""
    try:
        notif_uuid = uuid.UUID(id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid notification ID format")

    success = await mark_as_read(db, notif_uuid, user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"status": "read"}


@router.post("/broadcast", status_code=status.HTTP_201_CREATED)
async def admin_broadcast_alert(
    payload: BroadcastRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_roles([UserRole.ADMIN])),
):
    """Broadcast alert alert message to all active users (Admin only)."""
    # Fetch all active users
    result = await db.execute(select(User).filter(User.is_active == True))
    active_users = result.scalars().all()

    full_msg = f"{payload.title or '🚨 Broadcast'}: {payload.message}"
    if payload.city and payload.city != "All Cities":
        full_msg = f"[{payload.city}] {full_msg}"

    broadcast_count = 0
    for u in active_users:
        # Create notification for user
        await send_notification(
            db,
            user_id=u.id,
            type=NotificationType.DISASTER_ALERT,
            message=full_msg,
            sent_via="EMAIL",
        )
        broadcast_count += 1

    return {
        "status": "success",
        "broadcast_count": broadcast_count,
        "message": full_msg,
    }
