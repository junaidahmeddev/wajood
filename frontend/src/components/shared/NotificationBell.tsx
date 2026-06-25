"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { Notification } from "@/types";
import { formatDateTime } from "@/lib/utils";
import { useNotificationStore } from "@/store/notifications";
import { useWSContext } from "@/components/providers/WebSocketProvider";

export default function NotificationBell() {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);

  // WebSocket state
  const { isConnected } = useWSContext();
  const {
    notifications: wsNotifications,
    unreadCount: wsUnreadCount,
    hasNewAlert,
    markRead: wsMarkRead,
    markAllRead: wsMarkAllRead,
  } = useNotificationStore();

  // Fetch unread count from REST API
  const { data: apiCountData } = useQuery({
    queryKey: ["unreadCount"],
    queryFn: async () => {
      try {
        const res: any = await api.getUnreadCount();
        return typeof res === "number" ? res : res?.unread_count || 0;
      } catch {
        return 0;
      }
    },
    refetchInterval: 15000,
  });

  // Fetch list of recent notifications from REST API
  const { data: apiNotifications = [], isLoading: isLoadingList } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      try {
        const res: any = await api.getNotifications(false);
        return Array.isArray(res) ? res : [];
      } catch {
        return [];
      }
    },
    refetchInterval: 20000,
  });

  // Mark all read mutation
  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await api.markAllRead();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unreadCount"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      wsMarkAllRead();
    },
  });

  // Mark single read mutation
  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.markNotificationRead(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unreadCount"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  // Close dropdown on click outside
  useEffect(() => {
    if (!isOpen) return;
    const clickOutside = () => setIsOpen(false);
    document.addEventListener("click", clickOutside);
    return () => document.removeEventListener("click", clickOutside);
  }, [isOpen]);

  // Merge WS notifications with API notifications, deduplicate by id
  const mergedNotifications = (() => {
    const seen = new Set<string>();
    const merged: Array<{
      id: string;
      title: string;
      message: string;
      is_read: boolean;
      created_at: string;
      source: "ws" | "api";
    }> = [];

    // WS notifications first
    for (const n of wsNotifications) {
      if (!seen.has(n.id)) {
        seen.add(n.id);
        merged.push({
          id: n.id,
          title: n.type ? n.type.replace(/_/g, " ") : "System Alert",
          message: n.message,
          is_read: n.is_read,
          created_at: n.created_at,
          source: "ws",
        });
      }
    }

    // Then API notifications
    for (const n of apiNotifications) {
      if (!seen.has(n.id)) {
        seen.add(n.id);
        const rawType = n.type || n.notification_type || "ALERT";
        merged.push({
          id: n.id,
          title: n.title || rawType.replace(/_/g, " "),
          message: n.message,
          is_read: n.is_read,
          created_at: n.created_at,
          source: "api",
        });
      }
    }

    return merged.slice(0, 30);
  })();

  // Combined unread count
  const totalUnread = Math.max(wsUnreadCount, apiCountData || 0);

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition flex items-center justify-center ${
          hasNewAlert ? "animate-bell-shake ring-2 ring-indigo-500" : ""
        }`}
      >
        <span className="text-lg">🔔</span>
        {totalUnread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-[20px] rounded-full bg-red-600 border-2 border-slate-900 text-[10px] font-black text-white flex items-center justify-center px-1 font-mono shadow-lg animate-bounce">
            {totalUnread > 99 ? "99+" : totalUnread}
          </span>
        )}
        <span
          className={`absolute bottom-1 right-1 w-2 h-2 rounded-full border border-slate-900 ${
            isConnected ? "bg-emerald-500" : "bg-blue-500"
          }`}
          title={isConnected ? "Live WebSocket connection active" : "REST Polling active"}
        />
      </button>

      {/* Dropdown Overlay List */}
      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 sm:w-96 max-h-[80vh] glass-card border border-white/15 bg-slate-950/95 shadow-2xl z-[100] rounded-2xl flex flex-col overflow-hidden animate-fade-in">
          {/* Header */}
          <div className="p-4 border-b border-white/10 flex justify-between items-center bg-blue-950/20">
            <div className="flex items-center gap-2">
              <h5 className="text-sm font-black text-white tracking-wide">🚨 Notifications & Alerts</h5>
              <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-bold">
                {totalUnread} Unread
              </span>
            </div>
            {totalUnread > 0 && (
              <button
                onClick={() => markAllReadMutation.mutate()}
                className="text-xs text-indigo-400 font-bold hover:text-indigo-300 transition"
              >
                Mark all read ✓
              </button>
            )}
          </div>

          {/* List Content */}
          <div className="divide-y divide-white/5 overflow-y-auto flex-1 max-h-80">
            {isLoadingList && mergedNotifications.length === 0 ? (
              <div className="p-8 text-center text-xs font-mono text-slate-500 animate-pulse">
                Synchronizing national telemetry feed...
              </div>
            ) : mergedNotifications.length === 0 ? (
              <div className="p-10 text-center text-xs text-slate-400 font-medium flex flex-col items-center gap-2">
                <span className="text-2xl opacity-40">📭</span>
                <span>No notifications or match alerts logged yet.</span>
              </div>
            ) : (
              mergedNotifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => {
                    if (!notif.is_read) {
                      if (notif.source === "ws") {
                        wsMarkRead(notif.id);
                      } else {
                        markReadMutation.mutate(notif.id);
                      }
                    }
                  }}
                  className={`p-4 transition hover:bg-white/[0.04] cursor-pointer flex flex-col gap-1.5 ${
                    !notif.is_read ? "bg-blue-600/10 border-l-4 border-blue-500 pl-3" : "opacity-80"
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex items-center gap-2">
                      {!notif.is_read && (
                        <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0 animate-pulse" />
                      )}
                      <span className="text-xs font-black text-slate-200 uppercase tracking-wider line-clamp-1">
                        {notif.title}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono flex-shrink-0">
                      {formatDateTime(notif.created_at)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed font-sans">
                    {notif.message}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
