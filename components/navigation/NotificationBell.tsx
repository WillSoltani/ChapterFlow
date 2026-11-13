"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Award,
  BarChart3,
  Bell,
  BookOpen,
  Clock,
  Flame,
  HandHeart,
  TrendingUp,
  Users,
  XCircle,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { fetchBookJson } from "@/lib/client/book-api";
import {
  fetchBookJsonCached,
  invalidateBookCache,
  peekBookCache,
  updateBookCache,
} from "@/lib/client/book-api-cache";

const NOTIFICATIONS_KEY = "/app/api/book/me/notifications";

type Notification = {
  notificationId: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
  // Some notification types (e.g. commitment_followup) carry context ids used to
  // deep-link to the specific item. Server returns the full record incl. metadata.
  metadata?: { commitmentId?: string; bookId?: string } & Record<string, unknown>;
};

function getNotificationMeta(type: string): { icon: LucideIcon; color: string } {
  switch (type) {
    case "streak_at_risk":
      return { icon: Flame, color: "var(--cf-warning-text)" };
    case "weekly_digest":
      return { icon: BarChart3, color: "var(--cf-accent)" };
    case "welcome_back_nudge":
      return { icon: HandHeart, color: "var(--cf-success-text)" };
    case "commitment_followup":
      return { icon: Clock, color: "var(--cf-info-text)" };
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
 * Where a notification deep-links to. Most links are type-level (the relevant
 * product area). Types that carry context ids in `metadata` deep-link to the
 * specific item (e.g. commitment_followup → the dashboard check-in for that
 * commitment). Returns null when there's no sensible destination — the item is
 * still clickable to mark it read.
 */
function getNotificationHref(n: Pick<Notification, "type" | "metadata">): string | null {
  switch (n.type) {
    case "streak_at_risk":
    case "streak_milestone":
    case "weekly_digest":
    case "partner_nudge":
      return "/book/progress";
    case "badge_earned":
      return "/book/badges";
    case "tier_up":
      return "/rewards";
    case "commitment_followup": {
      const id = n.metadata?.commitmentId;
      return id ? `/dashboard?focusCommitment=${encodeURIComponent(id)}` : "/dashboard";
    }
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

type NotificationsPayload = { notifications: Notification[]; unreadCount: number };

type NotificationBellProps = {
  /** Controlled open state. Leave both props off and the bell manages itself;
   *  TopNav passes them so only one header popover is open at a time. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function NotificationBell({ open: openProp, onOpenChange }: NotificationBellProps = {}) {
  // TopNav remounts on every page, so start from the shared cache instead of an
  // empty bell.
  const [notifications, setNotifications] = useState<Notification[]>(
    () => peekBookCache<NotificationsPayload>(NOTIFICATIONS_KEY)?.notifications ?? []
  );
  const [unreadCount, setUnreadCount] = useState(
    () => peekBookCache<NotificationsPayload>(NOTIFICATIONS_KEY)?.unreadCount ?? 0
  );
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const [error, setError] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const onOpenChangeRef = useRef(onOpenChange);
  useEffect(() => {
    onOpenChangeRef.current = onOpenChange;
  });
  const controlled = openProp !== undefined;
  const setOpen = useCallback(
    (next: boolean) => {
      if (!controlled) setOpenState(next);
      onOpenChangeRef.current?.(next);
    },
    [controlled]
  );

  // A mount reuses a reading from the last 30 s; concurrent loads share one
  // in-flight request (e2e/no-duplicate-endpoint-requests.spec.ts). Poll ticks
  // and the return to a visible tab force a fresh read.
  const load = useCallback((force = false) => {
    fetchBookJsonCached<NotificationsPayload>(
      NOTIFICATIONS_KEY,
      undefined,
      { forceRevalidate: force }
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
    const interval = setInterval(() => {
      if (!document.hidden) load(true);
    }, 60_000);
    let wasHidden = document.hidden;
    const onVisibilityChange = () => {
      if (wasHidden && !document.hidden) load(true);
      wasHidden = document.hidden;
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [load]);

  // Close on outside tap (pointerdown also fires for touch on iOS Safari, where
  // mousedown does not reach blank page areas) and on Escape, which puts focus
  // back on the bell.
  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, setOpen]);

  // The bell on the next page starts from the shared cache, so a read is written
  // there at once (a tap on a linked notification navigates straight away), and
  // the cached copy is dropped once the server has answered so the next page
  // reads the server's.
  const markRead = useCallback((n: Notification) => {
    if (n.readAt) return;
    // Optimistic: mark this one read and drop the unread count.
    const readAt = new Date().toISOString();
    setNotifications((prev) =>
      prev.map((x) => (x.notificationId === n.notificationId ? { ...x, readAt } : x))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
    updateBookCache<NotificationsPayload>(NOTIFICATIONS_KEY, (cached) => {
      const wasUnread = cached.notifications.some(
        (x) => x.notificationId === n.notificationId && !x.readAt
      );
      if (!wasUnread) return cached;
      return {
        ...cached,
        notifications: cached.notifications.map((x) =>
          x.notificationId === n.notificationId ? { ...x, readAt } : x
        ),
        unreadCount: Math.max(0, cached.unreadCount - 1),
      };
    });
    fetchBookJson(NOTIFICATIONS_KEY, {
      method: "POST",
      body: JSON.stringify({ notificationId: n.notificationId, createdAt: n.createdAt }),
    })
      .catch(() => {})
      .finally(() => invalidateBookCache(NOTIFICATIONS_KEY));
  }, []);

  const markAllRead = () => {
    const now = new Date().toISOString();
    setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? now })));
    setUnreadCount(0);
    updateBookCache<NotificationsPayload>(NOTIFICATIONS_KEY, (cached) => ({
      ...cached,
      notifications: cached.notifications.map((n) => ({ ...n, readAt: n.readAt ?? now })),
      unreadCount: 0,
    }));
    fetchBookJson("/app/api/book/me/notifications/read-all", { method: "POST" })
      .catch(() => {})
      .finally(() => invalidateBookCache(NOTIFICATIONS_KEY));
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        ref={buttonRef}
        onClick={() => setOpen(!open)}
        className="cf-pressable relative flex min-h-11 min-w-11 items-center justify-center rounded-full hover:bg-(--cf-card-hover) transition-colors"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        aria-expanded={open}
        aria-controls="notification-panel"
      >
        <Bell className="h-[18px] w-[18px] text-(--cf-text-2)" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-(--cf-accent) px-1 text-[10px] font-bold text-(--cf-accent-contrast)">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          id="notification-panel"
          role="region"
          aria-label="Notifications"
          className="fixed inset-x-3 top-16 max-h-[min(24rem,calc(100dvh-5rem))] overflow-y-auto rounded-xl border border-(--cf-border) bg-(--cf-card) shadow-xl z-50 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80 sm:max-h-96"
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
                onClick={() => load(true)}
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
                const href = getNotificationHref(n);
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
