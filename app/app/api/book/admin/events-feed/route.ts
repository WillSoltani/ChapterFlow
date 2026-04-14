import "server-only";

import { requireAdminUser } from "@/app/app/api/book/_lib/admin-auth";
import { bookOk, bookErr, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { getBookAnalyticsTableName } from "@/app/app/api/book/_lib/env";
import { dayKey, queryEventsForDay, shiftDays } from "@/app/app/api/book/_lib/admin-metrics";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return withBookApiErrors(req, async () => {
    await requireAdminUser();
    const analyticsTable = await getBookAnalyticsTableName();
    if (!analyticsTable) {
      return bookErr(req, 503, "analytics_unavailable", "Analytics table not configured.");
    }

    const url = new URL(req.url);
    const limit = Math.max(1, Math.min(500, Number(url.searchParams.get("limit") ?? "200")));
    const eventTypeFilter = url.searchParams.get("type") || undefined;

    // Pull today's events; if we don't have enough, pull yesterday's too.
    const today = dayKey();
    const yesterday = dayKey(shiftDays(new Date(), -1));

    const todayRes = await queryEventsForDay(analyticsTable, today, eventTypeFilter);
    let merged = todayRes.events;
    if (merged.length < limit) {
      const ydRes = await queryEventsForDay(analyticsTable, yesterday, eventTypeFilter);
      merged = merged.concat(ydRes.events);
    }

    // Sort newest first by occurredAt or eventId timestamp piece.
    merged.sort((a, b) => {
      const ta = readTime(a);
      const tb = readTime(b);
      return tb - ta;
    });
    const sliced = merged.slice(0, limit).map(formatEvent);

    return bookOk({
      generatedAt: new Date().toISOString(),
      events: sliced,
    });
  });
}

function readTime(item: Record<string, unknown>): number {
  const occurredAt = item.occurredAt;
  if (typeof occurredAt === "string") return new Date(occurredAt).getTime();
  const createdAt = item.createdAt;
  if (typeof createdAt === "string") return new Date(createdAt).getTime();
  return 0;
}

function formatEvent(item: Record<string, unknown>) {
  return {
    eventId: String(item.eventId ?? ""),
    eventType: String(item.eventType ?? "unknown"),
    userId: String(item.userId ?? ""),
    occurredAt: String(item.occurredAt ?? item.createdAt ?? ""),
    eventDate: String(item.eventDate ?? ""),
    plan: typeof item.plan === "string" ? item.plan : undefined,
    bookId: typeof item.bookId === "string" ? item.bookId : undefined,
    chapterNumber:
      typeof item.chapterNumber === "number" ? item.chapterNumber : undefined,
    metadata: stripKeys(item),
  };
}

const SKIP_KEYS = new Set([
  "PK",
  "SK",
  "GSI1PK",
  "GSI1SK",
  "GSI2PK",
  "GSI2SK",
  "GSI3PK",
  "GSI3SK",
  "eventId",
  "eventType",
  "userId",
  "occurredAt",
  "eventDate",
  "createdAt",
  "updatedAt",
  "entity",
]);

function stripKeys(item: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(item)) {
    if (!SKIP_KEYS.has(k)) out[k] = v;
  }
  return out;
}
