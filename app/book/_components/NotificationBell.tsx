"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Award,
  BarChart3,
  Bell,
  BookOpen,
  Flame,
  HandHeart,
  TrendingUp,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { fetchBookJson } from "@/app/book/_lib/book-api";

type Notification = {
  notificationId: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
};

function getNotificationMeta(type: string): { icon: LucideIcon; color: string } {
  switch (type) {
    case "streak_at_risk":
      return { icon: Flame, color: "var(--cf-warning-text)" };
    case "weekly_digest":
      return { icon: BarChart3, color: "var(--cf-accent)" };
    case "welcome_back_nudge":
      return { icon: HandHeart, color: "var(--cf-success-text)" };
    case "reading_reminder":
      return { icon: BookOpen, color: "var(--cf-accent)" };
    case "badge_earned":
      return { icon: Award, color: "var(--cf-warning-text)" };
    case "tier_up":
      return { icon: TrendingUp, color: "var(--cf-accent)" };
    case "streak_milestone":
      return { icon: Flame, color: "var(--cf-accent)" };
    case "insight_spark":
      return { icon: Zap, color: "var(--cf-warning-text)" };
    case "partner_nudge":
      return { icon: Users, color: "var(--cf-accent)" };
    case "scenario_approved":
      return { icon: Award, color: "var(--cf-success-text)" };
    case "scenario_rejected":
      return { icon: Bell, color: "var(--cf-warning-text)" };
    default:
      return { icon: Bell, color: "var(--cf-text-3)" };
  }
}

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return "Yesterday";
  if (diffD < 7) return `${diffD}d ago`;
  if (diffD < 30) return `${Math.floor(diffD / 7)}w ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

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
              {notifications.slice(0, 20).map((n) => {
                const meta = getNotificationMeta(n.type);
                const Icon = meta.icon;
                return (
                  <li
                    key={n.notificationId}
                    className={`flex gap-3 px-4 py-3 text-sm ${n.readAt ? "opacity-60" : ""}`}
                  >
                    <div
                      className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                      style={{ backgroundColor: `color-mix(in srgb, ${meta.color} 12%, transparent)` }}
                    >
                      <Icon className="h-3.5 w-3.5" style={{ color: meta.color }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-(--cf-text-1) text-xs">
                        {n.title}
                      </p>
                      <p className="text-xs text-(--cf-text-3) mt-0.5 line-clamp-2">
                        {n.body}
                      </p>
                      <p className="text-[10px] text-(--cf-text-3)/50 mt-1">
                        {formatRelativeTime(n.createdAt)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
