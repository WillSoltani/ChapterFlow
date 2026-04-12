"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { fetchBookJson } from "@/app/book/_lib/book-api";

type Notification = {
  notificationId: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
};

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    fetchBookJson<{ notifications: Notification[]; unreadCount: number }>(
      "/app/api/book/me/notifications"
    )
      .then((res) => {
        setNotifications(res.notifications);
        setUnreadCount(res.unreadCount);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const markAllRead = () => {
    fetchBookJson("/app/api/book/me/notifications/read-all", {
      method: "POST",
    })
      .then(() => {
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() }))
        );
        setUnreadCount(0);
      })
      .catch(() => {});
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full hover:bg-(--cf-card-hover) transition-colors"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
      >
        <Bell className="h-[18px] w-[18px] text-(--cf-text-2)" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-(--cf-accent) px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-y-auto rounded-xl border border-(--cf-border) bg-(--cf-card) shadow-xl z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-(--cf-border)">
            <span className="text-sm font-semibold text-(--cf-text-1)">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-(--cf-accent) hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-(--cf-text-3)">
              No notifications yet
            </div>
          ) : (
            <ul className="divide-y divide-(--cf-border)">
              {notifications.slice(0, 20).map((n) => (
                <li
                  key={n.notificationId}
                  className={`px-4 py-3 text-sm ${n.readAt ? "opacity-60" : ""}`}
                >
                  <p className="font-medium text-(--cf-text-1) text-xs">
                    {n.title}
                  </p>
                  <p className="text-xs text-(--cf-text-3) mt-0.5 line-clamp-2">
                    {n.body}
                  </p>
                  <p className="text-[10px] text-(--cf-text-3)/50 mt-1">
                    {new Date(n.createdAt).toLocaleDateString()}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
