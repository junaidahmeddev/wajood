"""WebSocket router — Real-time push notifications via Redis pub/sub.

Endpoint: /ws/{user_id}?token=<JWT>

Flow:
1. Client connects with JWT token as query parameter
2. Server validates JWT and authenticates user
3. Server subscribes to Redis channel `user_notifications:{user_id}`
4. Any notification published to that channel is forwarded to the WebSocket client
5. On disconnect, cleanup subscription and connection
"""

import asyncio
import json
import logging
import uuid
from typing import Dict, Set

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from jose import JWTError, jwt

from app.config import settings

logger = logging.getLogger("wajood_websocket")
router = APIRouter(tags=["WebSocket"])


# ═══════════════════════════════════════════════
# Connection Manager — tracks all active WebSocket connections
# ═══════════════════════════════════════════════
class ConnectionManager:
    """Manages active WebSocket connections keyed by user_id."""

    def __init__(self):
        # user_id -> set of WebSocket connections (supports multiple tabs/devices)
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, user_id: str, websocket: WebSocket):
        await websocket.accept()
        async with self._lock:
            if user_id not in self.active_connections:
                self.active_connections[user_id] = set()
            self.active_connections[user_id].add(websocket)
        logger.info(f"🔌 WebSocket connected: user={user_id} | active={self.total_connections}")

    async def disconnect(self, user_id: str, websocket: WebSocket):
        async with self._lock:
            if user_id in self.active_connections:
                self.active_connections[user_id].discard(websocket)
                if not self.active_connections[user_id]:
                    del self.active_connections[user_id]
        logger.info(f"🔌 WebSocket disconnected: user={user_id} | active={self.total_connections}")

    async def send_to_user(self, user_id: str, message: dict):
        """Send a JSON message to all connections of a specific user."""
        async with self._lock:
            connections = self.active_connections.get(user_id, set()).copy()

        dead_connections = []
        for ws in connections:
            try:
                await ws.send_json(message)
            except Exception:
                dead_connections.append(ws)

        # Cleanup dead connections
        if dead_connections:
            async with self._lock:
                for ws in dead_connections:
                    if user_id in self.active_connections:
                        self.active_connections[user_id].discard(ws)

    async def broadcast(self, message: dict):
        """Broadcast a message to ALL connected users (disaster alerts, etc)."""
        async with self._lock:
            all_connections = [
                (uid, ws)
                for uid, conns in self.active_connections.items()
                for ws in conns
            ]

        for uid, ws in all_connections:
            try:
                await ws.send_json(message)
            except Exception:
                pass

    @property
    def total_connections(self) -> int:
        return sum(len(conns) for conns in self.active_connections.values())

    @property
    def connected_users(self) -> list:
        return list(self.active_connections.keys())


# Global singleton
manager = ConnectionManager()


# ═══════════════════════════════════════════════
# JWT Authentication for WebSocket
# ═══════════════════════════════════════════════
def authenticate_ws_token(token: str) -> dict:
    """Validate JWT token and return payload. Raises ValueError on failure."""
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        user_id = payload.get("sub")
        if not user_id:
            raise ValueError("Missing user ID in token")
        return payload
    except JWTError as e:
        raise ValueError(f"Invalid token: {e}")


# ═══════════════════════════════════════════════
# Redis Pub/Sub Listener (async)
# ═══════════════════════════════════════════════
async def redis_subscriber(user_id: str, websocket: WebSocket):
    """
    Subscribe to Redis pub/sub channel for a specific user and forward
    messages to the WebSocket connection.

    Uses redis.asyncio for non-blocking subscription.
    """
    import redis.asyncio as aioredis

    try:
        redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        pubsub = redis_client.pubsub()

        # Subscribe to user-specific channel AND global broadcast channel
        user_channel = f"user_notifications:{user_id}"
        broadcast_channel = "wajood_broadcast"

        await pubsub.subscribe(user_channel, broadcast_channel)
        logger.info(f"📡 Redis subscribed: {user_channel}, {broadcast_channel}")

        async for message in pubsub.listen():
            if message["type"] == "message":
                try:
                    data = json.loads(message["data"])
                    data["_channel"] = message["channel"]
                    await websocket.send_json(data)
                except (json.JSONDecodeError, Exception) as e:
                    logger.warning(f"Failed to forward Redis message: {e}")

    except asyncio.CancelledError:
        logger.info(f"📡 Redis subscription cancelled for user {user_id}")
    except Exception as e:
        logger.warning(f"Redis subscriber error for user {user_id}: {e}")
    finally:
        try:
            await pubsub.unsubscribe(user_channel, broadcast_channel)
            await pubsub.close()
            await redis_client.close()
        except Exception:
            pass


# ═══════════════════════════════════════════════
# WebSocket Endpoint
# ═══════════════════════════════════════════════
@router.websocket("/ws/{user_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    user_id: str,
    token: str = Query(default=""),
):
    """
    Real-time WebSocket endpoint for push notifications.

    Connection URL: ws://host/ws/{user_id}?token=<JWT>

    Messages sent to the client are JSON objects with:
    {
        "type": "MATCH_FOUND" | "STATUS_UPDATE" | "DISASTER_ALERT" | "SIGHTING_REPORT" | ...,
        "message": "...",
        "case_id": "...",
        "created_at": "...",
        ...
    }

    The client can also send messages:
    - {"type": "ping"} → server responds with {"type": "pong"}
    - {"type": "subscribe", "channels": [...]} → future extension
    """
    # ── Authenticate ──
    if not token:
        await websocket.close(code=4001, reason="Missing authentication token")
        return

    try:
        payload = authenticate_ws_token(token)
        token_user_id = payload.get("sub", "")
        # Verify the token user matches the URL user
        if token_user_id != user_id:
            await websocket.close(code=4003, reason="Token user mismatch")
            return
    except ValueError as e:
        await websocket.close(code=4001, reason=str(e))
        return

    # ── Connect ──
    await manager.connect(user_id, websocket)

    # Start Redis subscriber in background
    redis_task = asyncio.create_task(redis_subscriber(user_id, websocket))

    try:
        # Send welcome message
        await websocket.send_json({
            "type": "CONNECTED",
            "message": f"Welcome to WAJOOD real-time feed",
            "user_id": user_id,
            "active_connections": manager.total_connections,
        })

        # ── Listen for client messages ──
        while True:
            try:
                data = await websocket.receive_json()
                msg_type = data.get("type", "")

                if msg_type == "ping":
                    await websocket.send_json({"type": "pong"})

                elif msg_type == "heartbeat":
                    await websocket.send_json({
                        "type": "heartbeat_ack",
                        "active_connections": manager.total_connections,
                    })

                else:
                    # Echo unknown message types back for debugging
                    await websocket.send_json({
                        "type": "echo",
                        "original": data,
                    })

            except WebSocketDisconnect:
                break
            except Exception as e:
                logger.warning(f"WebSocket receive error for user {user_id}: {e}")
                break

    finally:
        # Cleanup
        redis_task.cancel()
        try:
            await redis_task
        except asyncio.CancelledError:
            pass
        await manager.disconnect(user_id, websocket)


# ═══════════════════════════════════════════════
# Utility: Push notification to a user via WebSocket (importable)
# ═══════════════════════════════════════════════
async def push_ws_notification(user_id: str, notification: dict):
    """Push a notification directly to a user's WebSocket connections (no Redis)."""
    await manager.send_to_user(user_id, notification)


async def broadcast_ws_notification(notification: dict):
    """Broadcast a notification to all connected WebSocket clients."""
    await manager.broadcast(notification)
