"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, RefreshCw, Radio } from "lucide-react";
import { adminGet } from "@/app/book/admin/_components/admin-api";
import { AdminCard, PageHeader } from "@/app/book/admin/_components/AdminCard";
import { ErrorAlert } from "@/app/book/admin/_components/ErrorAlert";
import { EmptyState } from "@/components/ui/EmptyState";
import { TableSkeleton } from "@/app/book/admin/_components/Skeleton";

type LiveEvent = {
  eventId: string;
  eventType: string;
  userId: string;
  occurredAt: string;
  eventDate: string;
  plan?: string;
  bookId?: string;
  chapterNumber?: number;
  metadata?: Record<string, unknown>;
};

type Response = { generatedAt: string; events: LiveEvent[] };

const POLL_INTERVAL_MS = 10_000;

export function LiveActivityClient() {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [filter, setFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const intervalRef = useRef<number | null>(null);

  const reload = async () => {
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "200" });
      if (typeFilter) params.set("type", typeFilter);
      const data = await adminGet<Response>(`/events-feed?${params.toString()}`);
      setEvents(data.events);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load events");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, [typeFilter]);

  useEffect(() => {
    if (paused) {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    intervalRef.current = window.setInterval(reload, POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [paused, typeFilter]);

  const filtered = filter
    ? events.filter((e) => {
        const f = filter.toLowerCase();
        return (
          e.userId.toLowerCase().includes(f) ||
          e.eventType.toLowerCase().includes(f) ||
          (e.bookId ?? "").toLowerCase().includes(f)
        );
      })
    : events;

  const eventTypes = Array.from(new Set(events.map((e) => e.eventType))).sort();

  return (
    <div>
      <PageHeader
        title="Live activity"
        description={`Polling every ${POLL_INTERVAL_MS / 1000}s · ${events.length} events loaded`}
        action={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPaused((p) => !p)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-(--cf-border) bg-(--cf-surface) px-3 py-1.5 text-[12px] font-medium text-(--cf-text-2) shadow-(--cf-input-inset-shadow) transition hover:bg-(--cf-surface-muted) hover:text-(--cf-text-1)"
            >
              {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
              {paused ? "Resume" : "Pause"}
            </button>
            <button
              type="button"
              onClick={reload}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-(--cf-border) bg-(--cf-surface) px-3 py-1.5 text-[12px] font-medium text-(--cf-text-2) shadow-(--cf-input-inset-shadow) transition hover:bg-(--cf-surface-muted) hover:text-(--cf-text-1) disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        }
      />

      {error && <ErrorAlert error={error} onRetry={reload} />}

      <AdminCard
        action={
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter (user / book / type)"
              className="rounded-lg border border-(--cf-border) bg-(--cf-surface-muted) px-3 py-1.5 text-[12px] text-(--cf-text-1) placeholder:text-(--cf-text-soft) shadow-(--cf-input-inset-shadow) focus:border-(--cf-accent) focus:outline-none focus:ring focus:ring-(--cf-accent)/20"
            />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-lg border border-(--cf-border) bg-(--cf-surface-muted) px-3 py-1.5 text-[12px] text-(--cf-text-1) shadow-(--cf-input-inset-shadow) focus:border-(--cf-accent) focus:outline-none focus:ring focus:ring-(--cf-accent)/20"
            >
              <option value="">All event types</option>
              {eventTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        }
      >
        {loading && events.length === 0 ? (
          <TableSkeleton rows={8} cols={6} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Radio}
            title="No events to show"
            description={
              filter || typeFilter
                ? "Try clearing your filters."
                : "Once users start engaging with the app, events will stream in here."
            }
            compact
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-[12px]">
              <thead>
                <tr className="border-b border-(--cf-border) text-left text-[11px] uppercase tracking-[0.08em] text-(--cf-text-soft)">
                  <th className="py-2 pr-3">Time</th>
                  <th className="py-2 pr-3">Event</th>
                  <th className="py-2 pr-3">User</th>
                  <th className="py-2 pr-3">Plan</th>
                  <th className="py-2 pr-3">Book / Chapter</th>
                  <th className="py-2 pr-3">Details</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr
                    key={e.eventId}
                    className="border-b border-(--cf-border)/50 transition hover:bg-(--cf-surface-muted)/40"
                  >
                    <td className="py-1.5 pr-3 tabular-nums text-(--cf-text-3)">
                      {formatTime(e.occurredAt)}
                    </td>
                    <td className="py-1.5 pr-3">
                      <span className="rounded-md border border-(--cf-accent-border) bg-(--cf-accent-soft) px-1.5 py-0.5 text-[11px] font-medium text-(--cf-accent)">
                        {e.eventType}
                      </span>
                    </td>
                    <td
                      className="py-1.5 pr-3 font-mono text-[11px] text-(--cf-text-2)"
                      title={e.userId}
                    >
                      {e.userId.slice(0, 8)}…
                    </td>
                    <td className="py-1.5 pr-3 text-(--cf-text-3)">{e.plan ?? "—"}</td>
                    <td className="py-1.5 pr-3 text-(--cf-text-3)">
                      {e.bookId ? (
                        <span title={e.bookId}>
                          {e.bookId.slice(0, 14)}
                          {e.bookId.length > 14 ? "…" : ""}
                          {e.chapterNumber !== undefined ? ` · ch${e.chapterNumber}` : ""}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-1.5 pr-3 text-(--cf-text-soft)">
                      {summarizeMetadata(e.metadata)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminCard>
    </div>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function summarizeMetadata(meta?: Record<string, unknown>): string {
  if (!meta) return "—";
  const interesting = ["scorePercent", "passed", "deltaMs", "deltaPoints", "sourceType", "badgeId"];
  const parts: string[] = [];
  for (const key of interesting) {
    if (meta[key] !== undefined) {
      parts.push(`${key}=${String(meta[key])}`);
    }
  }
  return parts.length ? parts.join(" · ") : "";
}
