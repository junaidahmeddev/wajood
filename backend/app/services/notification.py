"""Notification service utilizing async db, Redis 7 pub/sub, SMS stubs, and WhatsApp integrations."""

import uuid
import json
import logging
from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
import redis

from app.models.notification import Notification, NotificationType
from app.models.user import User
from app.models.organization import Organization
from app.models.missing_person import MissingPerson
from app.models.match import Match
from app.config import settings

logger = logging.getLogger("wajood_notifications")

# Initialize Redis client for pub/sub notifications
try:
    redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)
except Exception as e:
    logger.warning(f"Failed to connect to Redis for pub/sub: {e}")
    redis_client = None


def send_sms(phone: str, message: str):
    """
    Send SMS alert. Ready for Jazz SMS API integration in Pakistan.
    """
    logger.info(f"📱 [JAZZ SMS API STUB] Sending SMS to {phone}: '{message}'")
    print(f"--- JAZZ SMS API ---> To: {phone} | Msg: {message}")


def send_whatsapp(phone: str, message: str):
    """
    Send WhatsApp alert. Ready for Twilio WhatsApp API integration.
    """
    logger.info(f"💬 [TWILIO WHATSAPP API STUB] Sending WhatsApp to {phone}: '{message}'")
    print(f"--- TWILIO WHATSAPP ---> To: {phone} | Msg: {message}")


async def send_push(user_id: uuid.UUID, title: str, body: str):
    """
    Broadcast a push notification via Redis pub/sub.
    """
    if redis_client:
        try:
            channel = f"user_notifications:{str(user_id)}"
            payload = {
                "id": str(uuid.uuid4()),
                "type": "PUSH_ALERT",
                "title": title,
                "message": body,
                "created_at": datetime.now(timezone.utc).isoformat() if "datetime" in globals() else None,
            }
            redis_client.publish(channel, json.dumps(payload))
            logger.info(f"🔔 [PUSH BROADCAST] Broadcast pushed to user channel '{channel}': {title}")
        except Exception as e:
            logger.warning(f"Redis publish failed for push: {e}")
    else:
        logger.info(f"🔔 [PUSH STUB] To user {user_id}: {title} — {body}")


async def notify_family_match(db: AsyncSession, case_id: uuid.UUID, match_id: uuid.UUID):
    """
    Compose and dispatch high confidence match notifications to the family.
    """
    # Fetch case details
    case_res = await db.execute(select(MissingPerson).filter(MissingPerson.id == case_id))
    case = case_res.scalars().first()
    if not case:
        logger.error(f"Failed to locate case {case_id} for family match notification")
        return

    # Fetch match details
    match_res = await db.execute(select(Match).filter(Match.id == match_id))
    match = match_res.scalars().first()
    if not match:
        logger.error(f"Failed to locate match {match_id} for family match notification")
        return

    message = (
        f"WAJOOD Match Alert: A potential match with confidence score "
        f"{int(match.confidence_score * 100)}% has been detected for case {case.case_number} "
        f"({case.full_name}). Please review details in the portal."
    )

    # 1. Save standard notification record
    await send_notification(
        db,
        user_id=case.reported_by,
        type=NotificationType.MATCH_FOUND,
        message=message,
        case_id=case.id,
        sent_via="PUSH, SMS"
    )

    # 2. Dispatch SMS and WhatsApp to contact phone
    if case.contact_phone:
        send_sms(case.contact_phone, message)
        send_whatsapp(case.contact_phone, message)

    # 3. Dispatch Push Notification
    await send_push(case.reported_by, "High Confidence Match Detected", message)


async def disaster_broadcast(db: AsyncSession, message: str, city: str):
    """
    Bulk notify all active users residing in or belonging to organizations in the specified city.
    """
    # Query users belonging to organizations located in the target city
    result = await db.execute(
        select(User)
        .join(User.organization)
        .filter(Organization.city.ilike(f"%{city}%"), User.is_active == True)
    )
    target_users = result.scalars().all()

    # If no users linked to organization city, fetch all active users as fallback
    if not target_users:
        result = await db.execute(select(User).filter(User.is_active == True))
        target_users = result.scalars().all()

    broadcast_count = 0
    for user in target_users:
        # Create standard notification entry
        await send_notification(
            db,
            user_id=user.id,
            type=NotificationType.DISASTER_ALERT,
            message=f"[{city.upper()} DISASTER ALERT] {message}",
            sent_via="PUSH, EMAIL"
        )
        # Push notification
        await send_push(user.id, f"Disaster Alert: {city}", message)
        
        # SMS alert if user has phone
        if user.phone:
            send_sms(user.phone, f"[WAJOOD ALERT - {city.upper()}] {message}")
            
        broadcast_count += 1

    logger.info(f"🚨 disaster_broadcast completed. Notified {broadcast_count} users in city '{city}'")

    # Also broadcast via WebSocket to all connected clients via Redis pub/sub
    if redis_client:
        try:
            ws_payload = {
                "id": str(uuid.uuid4()),
                "type": "DISASTER_ALERT",
                "message": f"[{city.upper()} DISASTER ALERT] {message}",
                "city": city,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            redis_client.publish("wajood_broadcast", json.dumps(ws_payload))
            logger.info(f"📢 [DISASTER BROADCAST] Published alert to 'wajood_broadcast' channel")
        except Exception as e:
            logger.warning(f"Failed to publish disaster broadcast to Redis: {e}")

    return broadcast_count


# Core Notification Methods
async def send_notification(
    db: AsyncSession,
    user_id: uuid.UUID,
    type: NotificationType,
    message: str,
    case_id: Optional[uuid.UUID] = None,
    sent_via: str = "EMAIL",
) -> Notification:
    """
    Create a notification in DB and publish it via Redis pub/sub.
    """
    notif = Notification(
        user_id=user_id,
        case_id=case_id,
        type=type,
        message=message,
        is_read=False,
        sent_via=sent_via,
    )
    db.add(notif)
    await db.commit()
    await db.refresh(notif)

    # Console logging
    logger.info(f"[{type.value}] To user {user_id}: {message}")

    # Publish notification payload via Redis pub/sub for real-time clients
    if redis_client:
        try:
            channel = f"user_notifications:{str(user_id)}"
            payload = {
                "id": str(notif.id),
                "type": notif.type.value,
                "message": notif.message,
                "is_read": notif.is_read,
                "case_id": str(notif.case_id) if notif.case_id else None,
                "sent_via": notif.sent_via,
                "created_at": notif.created_at.isoformat() if notif.created_at else None,
            }
            redis_client.publish(channel, json.dumps(payload))
        except Exception as e:
            logger.warning(f"Redis publish failed: {e}")

    # Also push directly via WebSocket connection manager (same process)
    try:
        from app.routers.websocket import push_ws_notification
        ws_payload = {
            "type": notif.type.value,
            "message": notif.message,
            "case_id": str(notif.case_id) if notif.case_id else None,
            "created_at": notif.created_at.isoformat() if notif.created_at else None,
            "id": str(notif.id),
        }
        import asyncio
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(push_ws_notification(str(user_id), ws_payload))
        except RuntimeError:
            pass  # No running event loop (e.g. Celery worker) — Redis pub/sub handles it
    except ImportError:
        pass

    return notif


async def get_user_notifications(db: AsyncSession, user_id: uuid.UUID, unread_only: bool = False, limit: int = 50):
    """Retrieve notifications asynchronously."""
    query = select(Notification).filter(Notification.user_id == user_id)
    if unread_only:
        query = query.filter(Notification.is_read == False)
    
    result = await db.execute(query.order_by(Notification.created_at.desc()).limit(limit))
    return result.scalars().all()


async def mark_as_read(db: AsyncSession, notification_id: uuid.UUID, user_id: uuid.UUID) -> bool:
    """Mark notification as read asynchronously."""
    result = await db.execute(
        select(Notification).filter(
            Notification.id == notification_id,
            Notification.user_id == user_id,
        )
    )
    notif = result.scalars().first()
    if notif:
        notif.is_read = True
        await db.commit()
        return True
    return False


async def mark_all_as_read(db: AsyncSession, user_id: uuid.UUID) -> int:
    """Mark all notifications as read asynchronously."""
    result = await db.execute(
        update(Notification)
        .filter(Notification.user_id == user_id, Notification.is_read == False)
        .values(is_read=True)
    )
    await db.commit()
    return result.rowcount
