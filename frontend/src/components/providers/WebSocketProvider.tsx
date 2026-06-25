"use client";

/**
 * WebSocketProvider — Global provider component that initializes
 * the WebSocket connection when the user is authenticated.
 * 
 * Place this inside the app layout to enable real-time notifications
 * across all portals.
 */

import { useWebSocket } from "@/hooks/useWebSocket";
import { useNotificationStore } from "@/store/notifications";
import { useEffect, createContext, useContext } from "react";

interface WSContextValue {
  status: string;
  isConnected: boolean;
  sendMessage: (data: Record<string, unknown>) => void;
}

const WSContext = createContext<WSContextValue>({
  status: "disconnected",
  isConnected: false,
  sendMessage: () => {},
});

export function useWSContext() {
  return useContext(WSContext);
}

export default function WebSocketProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { status, isConnected, sendMessage } = useWebSocket({
    autoConnect: true,
    heartbeatInterval: 30000,
    maxRetries: 10,
  });

  const { hasNewAlert, clearNewAlert } = useNotificationStore();

  // Auto-clear the new alert flag after 5 seconds (for bell animation)
  useEffect(() => {
    if (hasNewAlert) {
      const timer = setTimeout(() => clearNewAlert(), 5000);
      return () => clearTimeout(timer);
    }
  }, [hasNewAlert, clearNewAlert]);

  return (
    <WSContext.Provider value={{ status, isConnected, sendMessage }}>
      {children}
    </WSContext.Provider>
  );
}
