import logging
import uuid
import json
import redis
import threading
from datetime import datetime, timezone
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from celery.signals import worker_ready

from app.celery_app import celery_app
from app.config import settings
from app.services.ai_matcher import run_sync_ai_matching_for_missing, run_sync_ai_matching_for_found

logger = logging.getLogger("wajood_celery")

# Create sync session specifically for Celery task processing
sync_engine = create_engine(settings.SYNC_DATABASE_URL)
SyncSession = sessionmaker(bind=sync_engine)


@celery_app.task(name="app.tasks.run_ai_matching")
def run_ai_matching_task(missing_person_id: str):
    """Celery background task to match a reported missing person against all registered found persons."""
    logger.info(f"🔄 Executing background matching analysis for MissingPerson {missing_person_id}...")
    db = SyncSession()
    try:
        mp_uuid = uuid.UUID(missing_person_id)
    except ValueError:
        logger.error(f"❌ Invalid UUID format: {missing_person_id}")
        return f"Invalid UUID format: {missing_person_id}"

    try:
        run_sync_ai_matching_for_missing(db, mp_uuid)
        return f"Successfully processed matches for MissingPerson {missing_person_id}."
    except Exception as e:
        logger.error(f"❌ Error executing background matching for MissingPerson: {e}")
        return f"Error: {e}"
    finally:
        db.close()


@celery_app.task(name="app.tasks.run_found_person_matching")
def run_found_person_matching_task(found_person_id: str):
    """Celery background task to match a registered found person against all reported missing persons."""
    logger.info(f"🔄 Executing background matching analysis for FoundPerson {found_person_id}...")
    db = SyncSession()
    try:
        fp_uuid = uuid.UUID(found_person_id)
    except ValueError:
        logger.error(f"❌ Invalid UUID format: {found_person_id}")
        return f"Invalid UUID format: {found_person_id}"

    try:
        run_sync_ai_matching_for_found(db, fp_uuid)
        return f"Successfully processed matches for FoundPerson {found_person_id}."
    except Exception as e:
        logger.error(f"❌ Error executing background matching for FoundPerson: {e}")
        return f"Error: {e}"
    finally:
        db.close()


def run_redis_matches_subscriber():
    logger.info("📡 Starting Redis matches channel subscriber thread...")
    r = redis.from_url(settings.REDIS_URL, decode_responses=True)
    pubsub = r.pubsub()
    pubsub.subscribe("matches")
    
    # Deferred imports to prevent circular dependencies
    from app.models.notification import Notification, NotificationType
    from app.services.notification import send_sms
    
    for message in pubsub.listen():
        if message["type"] == "message":
            try:
                data = json.loads(message["data"])
                match_id = data.get("match_id")
                reported_by = data.get("reported_by")
                contact_phone = data.get("contact_phone")
                confidence_score = data.get("confidence_score", 0.0)
                full_name = data.get("full_name")
                case_number = data.get("case_number")
                missing_person_id = data.get("missing_person_id")
                
                if not match_id or not reported_by:
                    continue
                
                # Use Redis setnx for distributed deduplication lock (expiry: 5 mins)
                lock_key = f"processed_match_lock:{match_id}"
                if not r.set(lock_key, "1", ex=300, nx=True):
                    logger.info(f"Match {match_id} already being processed, skipping duplicate.")
                    continue
                
                logger.info(f"🔔 Celery worker picked up match {match_id} from Redis channel 'matches'")
                
                # Send SMS stub and push notification if confidence score is high (>85%)
                if confidence_score > 0.85:
                    message_text = (
                        f"WAJOOD Auto Alert: A potential match with similarity confidence of "
                        f"{int(confidence_score * 100)}% has been detected for your reported missing person "
                        f"{full_name} (Case: {case_number}). Please review in portal."
                    )
                    
                    # Create database Notification record
                    db = SyncSession()
                    notif_id = str(uuid.uuid4())
                    try:
                        notif = Notification(
                            id=uuid.UUID(notif_id),
                            user_id=uuid.UUID(reported_by),
                            case_id=uuid.UUID(missing_person_id),
                            type=NotificationType.MATCH_FOUND,
                            message=message_text,
                            is_read=False,
                            sent_via="PUSH, SMS"
                        )
                        db.add(notif)
                        db.commit()
                        db.refresh(notif)
                        logger.info(f"Created Notification {notif.id} in database for user {reported_by}")
                    except Exception as db_err:
                        logger.error(f"Error saving match notification to DB: {db_err}")
                        db.rollback()
                    finally:
                        db.close()
                    
                    # Send SMS alert stub
                    if contact_phone:
                        send_sms(contact_phone, message_text)
                    
                    # Send WebSocket push alert to user channel
                    user_channel = f"user_notifications:{reported_by}"
                    ws_payload = {
                        "id": notif_id,
                        "type": "MATCH_FOUND",
                        "message": message_text,
                        "case_id": missing_person_id,
                        "created_at": datetime.now(timezone.utc).isoformat()
                    }
                    r.publish(user_channel, json.dumps(ws_payload))
                    logger.info(f"WebSocket push sent to user channel '{user_channel}' for match {match_id}")
            except Exception as e:
                logger.error(f"Error in Redis matches subscriber loop: {e}")


@worker_ready.connect
def on_worker_ready(sender, **kwargs):
    t = threading.Thread(target=run_redis_matches_subscriber, daemon=True)
    t.start()
