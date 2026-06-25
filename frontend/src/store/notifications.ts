/* ═══════════════════════════════════════════════
   WAJOOD — Zustand Notification Store (Real-Time)
   
   This store manages WebSocket-delivered notifications
   separate from the REST API polling. It provides:
   - Live notification queue from WebSocket
   - Unread count badge
   - Toast-style recent alerts
   ═══════════════════════════════════════════════ */

import { create } from "zustand";

export interface WSNotification {
  id: string;
  type: string;
  message: string;
  case_id?: string;
  created_at: string;
  is_read: boolean;
}

interface NotificationState {
  /** Live notifications received via WebSocket */
  notifications: WSNotification[];
  /** Count of unread live notifications */
  unreadCount: number;
  /** Whether a new notification just arrived (for bell animation) */
  hasNewAlert: boolean;

  /** Add a new notification from WebSocket */
  addNotification: (notif: WSNotification) => void;
  /** Mark a specific notification as read */
  markRead: (id: string) => void;
  /** Mark all notifications as read */
  markAllRead: () => void;
  /** Clear the new alert flag (after animation completes) */
  clearNewAlert: () => void;
  /** Clear all notifications */
  clearAll: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  hasNewAlert: false,

  addNotification: (notif) => {
    const current = get().notifications;

    // Deduplicate by id
    if (current.some((n) => n.id === notif.id)) return;

    // Skip CONNECTED type (internal protocol message)
    if (notif.type === "CONNECTED") return;

    const updated = [notif, ...current].slice(0, 100); // Keep max 100
    const unread = updated.filter((n) => !n.is_read).length;

    set({
      notifications: updated,
      unreadCount: unread,
      hasNewAlert: true,
    });
  },

  markRead: (id) => {
    const updated = get().notifications.map((n) =>
      n.id === id ? { ...n, is_read: true } : n
    );
    const unread = updated.filter((n) => !n.is_read).length;
    set({ notifications: updated, unreadCount: unread });
  },

  markAllRead: () => {
    const updated = get().notifications.map((n) => ({ ...n, is_read: true }));
    set({ notifications: updated, unreadCount: 0 });
  },

  clearNewAlert: () => set({ hasNewAlert: false }),

  clearAll: () => set({ notifications: [], unreadCount: 0, hasNewAlert: false }),
}));
