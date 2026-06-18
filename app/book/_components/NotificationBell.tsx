"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Award,
  BarChart3,
  Bell,
  BookOpen,
  Flame,
  HandHeart,
  TrendingUp,
  Users,
  XCircle,
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
      return { icon: XCircle, color: "var(--cf-danger-text)" };
    default:
      return { icon: Bell, color: "var(--cf-text-3)" };
  }
}

/**
 * Where a notification deep-links to. Payloads don't carry context ids yet, so
 * links are type-level (the relevant product area). Returns null when there's
 * no sensible destination — the item is still clickable to mark it read.
 */
function getNotificationHref(type: string): string | null {
  switch (type) {
    case "streak_at_risk":
    case "streak_milestone":
    case "weekly_digest":
    case "partner_nudge":
      return "/book/progress";
    case "badge_earned":
      return "/book/badges";
    case "tier_up":
      return "/rewards";
    case "welcome_back_nudge":
    case "reading_reminder":
    case "insight_spark":
      return "/dashboard";
    case "scenario_approved":
    case "scenario_rejected":
      return "/book/library";
    default:
      return null;
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
  const [error, setError] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    fetchBookJson<{ notifications: Notification[]; unreadCount: number }>(
      "/app/api/book/me/notifications"
    )
      .then((res) => {
        setNotifications(res.notifications);
        setUnreadCount(res.unreadCount);
        setError(false);
      })
      .catch(() => setError(true));
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, [load]);

  // Close on outside click and on Escape.
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const markRead = useCallback((n: Notification) => {
    if (n.readAt) return;
    // Optimistic: mark this one read and drop the unread count.
    const readAt = new Date().toISOString();
    setNotifications((prev) =>
      prev.map((x) => (x.notificationId === n.notificationId ? { ...x, readAt } : x))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
    fetchBookJson("/app/api/book/me/notifications", {
      method: "POST",
      body: JSON.stringify({ notificationId: n.notificationId, createdAt: n.createdAt }),
    }).catch(() => {});
  }, []);

  const markAllRead = () => {
    const now = new Date().toISOString();
    setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? now })));
    setUnreadCount(0);
    fetchBookJson("/app/api/book/me/notifications/read-all", { method: "POST" }).catch(() => {});
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="cf-pressable relative flex min-h-11 min-w-11 items-center justify-center rounded-full hover:bg-(--cf-card-hover) transition-colors"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls="notification-panel"
      >
        <Bell className="h-[18px] w-[18px] text-(--cf-text-2)" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-(--cf-accent) px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          id="notification-panel"
          role="region"
          aria-label="Notifications"
          className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-y-auto rounded-xl border border-(--cf-border) bg-(--cf-card) shadow-xl z-50"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-(--cf-border)">
            <span className="text-sm font-semibold text-(--cf-text-1)">Notifications</span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-xs text-(--cf-accent) hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          {error ? (
            <div className="px-4 py-8 text-center text-xs text-(--cf-text-3)">
              <p>Couldn&apos;t load notifications.</p>
              <button
                type="button"
                onClick={load}
                className="mt-2 text-(--cf-accent) hover:underline"
              >
                Try again
              </button>
            </div>
          ) : notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-(--cf-text-3)">
              You&apos;re all caught up — no notifications yet.
            </div>
          ) : (
            <ul className="divide-y divide-(--cf-border)">
              {notifications.slice(0, 20).map((n) => {
                const meta = getNotificationMeta(n.type);
                const Icon = meta.icon;
                const href = getNotificationHref(n.type);
                const itemClass = `flex w-full gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-(--cf-card-hover) ${
                  n.readAt ? "opacity-60" : ""
                }`;
                const inner = (
                  <>
                    <div
                      className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                      style={{ backgroundColor: `color-mix(in srgb, ${meta.color} 12%, transparent)` }}
                    >
                      <Icon className="h-3.5 w-3.5" style={{ color: meta.color }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-(--cf-text-1) text-xs">{n.title}</p>
                      <p className="text-xs text-(--cf-text-3) mt-0.5 line-clamp-2">{n.body}</p>
                      <p className="text-[10px] text-(--cf-text-3)/50 mt-1">
                        {formatRelativeTime(n.createdAt)}
                      </p>
                    </div>
                    {!n.readAt && (
                      <span
                        aria-hidden="true"
                        className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-(--cf-accent)"
                      />
                    )}
                  </>
                );
                return (
                  <li key={n.notificationId}>
                    {href ? (
                      <Link href={href} onClick={() => { markRead(n); setOpen(false); }} className={itemClass}>
                        {inner}
                      </Link>
                    ) : (
                      <button type="button" onClick={() => markRead(n)} className={itemClass}>
                        {inner}
                      </button>
                    )}
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
