"use client";

/**
 * useWebSocket — Custom React hook for WAJOOD real-time WebSocket connection.
 *
 * Features:
 * - Auto-connects when user is authenticated
 * - Auto-reconnects with exponential backoff on disconnect
 * - Heartbeat ping/pong to keep connection alive
 * - Exposes incoming notifications and connection status
 * - Integrates with Zustand notification store
 */

import { useEffect, useRef, useCallback, useState } from "react";
import { useAuthStore } from "@/store";
import { useNotificationStore } from "@/store/notifications";

export type WSStatus = "connecting" | "connected" | "disconnected" | "error";

export interface WSMessage {
  type: string;
  message?: string;
  case_id?: string;
  id?: string;
  created_at?: string;
  city?: string;
  [key: string]: unknown;
}

interface UseWebSocketOptions {
  /** Auto-connect when user is authenticated. Default: true */
  autoConnect?: boolean;
  /** Heartbeat interval in ms. Default: 30000 (30s) */
  heartbeatInterval?: number;
  /** Max reconnection attempts. Default: 10 */
  maxRetries?: number;
  /** Base reconnect delay in ms. Default: 1000 */
  baseDelay?: number;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    autoConnect = true,
    heartbeatInterval = 30000,
    maxRetries = 10,
    baseDelay = 1000,
  } = options;

  const { user, token, isAuthenticated } = useAuthStore();
  const { addNotification } = useNotificationStore();

  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectRef = useRef<NodeJS.Timeout | null>(null);
  const retriesRef = useRef(0);

  const [status, setStatus] = useState<WSStatus>("disconnected");
  const [lastMessage, setLastMessage] = useState<WSMessage | null>(null);

  // Compute the WebSocket URL
  const getWSUrl = useCallback(() => {
    if (!user?.id || !token) return null;

    if (process.env.NEXT_PUBLIC_WS_URL) {
      return `${process.env.NEXT_PUBLIC_WS_URL}/${user.id}?token=${token}`;
    }

    // Determine ws:// or wss:// based on current page protocol
    const protocol = typeof window !== "undefined" && window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = typeof window !== "undefined" ? window.location.host : "localhost:8000";

    return `${protocol}//${host}/ws/${user.id}?token=${token}`;
  }, [user?.id, token]);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
    if (reconnectRef.current) {
      clearTimeout(reconnectRef.current);
      reconnectRef.current = null;
    }
  }, []);

  // Connect to WebSocket
  const connect = useCallback(() => {
    const url = getWSUrl();
    if (!url) return;

    // Don't connect if already connected
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      return;
    }

    // Close existing connection if any
    if (wsRef.current) {
      wsRef.current.close();
    }

    cleanup();
    setStatus("connecting");

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus("connected");
        retriesRef.current = 0;
        console.log("🔌 WAJOOD WebSocket connected");

        // Start heartbeat
        heartbeatRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping" }));
          }
        }, heartbeatInterval);
      };

      ws.onmessage = (event) => {
        try {
          const data: WSMessage = JSON.parse(event.data);
          setLastMessage(data);

          // Skip internal protocol messages
          if (data.type === "pong" || data.type === "heartbeat_ack" || data.type === "echo") {
            return;
          }

          // Forward notification to the store
          if (
            data.type === "MATCH_FOUND" ||
            data.type === "STATUS_UPDATE" ||
            data.type === "DISASTER_ALERT" ||
            data.type === "SIGHTING_REPORT" ||
            data.type === "CASE_CREATED" ||
            data.type === "MATCH_CONFIRMED" ||
            data.type === "CONNECTED"
          ) {
            addNotification({
              id: data.id || crypto.randomUUID(),
              type: data.type,
              message: data.message || "",
              case_id: data.case_id,
              created_at: data.created_at || new Date().toISOString(),
              is_read: false,
            });
          }
        } catch (e) {
          console.warn("Failed to parse WebSocket message:", e);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        setStatus("error");
      };

      ws.onclose = (event) => {
        setStatus("disconnected");
        cleanup();
        console.log(`🔌 WebSocket disconnected (code: ${event.code})`);

        // Don't reconnect on intentional close or auth failure
        if (event.code === 4001 || event.code === 4003 || event.code === 1000) {
          return;
        }

        // Auto-reconnect with exponential backoff
        if (retriesRef.current < maxRetries) {
          const delay = Math.min(baseDelay * Math.pow(2, retriesRef.current), 30000);
          retriesRef.current += 1;
          console.log(`🔄 Reconnecting in ${delay}ms (attempt ${retriesRef.current}/${maxRetries})...`);

          reconnectRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else {
          console.warn("❌ Max WebSocket reconnection attempts reached");
        }
      };
    } catch (e) {
      console.error("Failed to create WebSocket:", e);
      setStatus("error");
    }
  }, [getWSUrl, cleanup, heartbeatInterval, maxRetries, baseDelay, addNotification]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    cleanup();
    retriesRef.current = maxRetries; // Prevent reconnection
    if (wsRef.current) {
      wsRef.current.close(1000, "Client disconnect");
      wsRef.current = null;
    }
    setStatus("disconnected");
  }, [cleanup, maxRetries]);

  // Send a message to the server
  const sendMessage = useCallback((data: Record<string, unknown>) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  // Auto-connect effect
  useEffect(() => {
    if (autoConnect && isAuthenticated && user?.id && token) {
      connect();
    }

    return () => {
      cleanup();
      if (wsRef.current) {
        wsRef.current.close(1000, "Component unmount");
        wsRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoConnect, isAuthenticated, user?.id, token]);

  return {
    status,
    lastMessage,
    connect,
    disconnect,
    sendMessage,
    isConnected: status === "connected",
  };
}

export default useWebSocket;
