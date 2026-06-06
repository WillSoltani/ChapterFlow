import "server-only";

import { requireAdminUser } from "@/app/app/api/book/_lib/admin-auth";
import { bookOk, bookErr, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { getBookAnalyticsTableName, getBookTableName } from "@/app/app/api/book/_lib/env";
import { getUserSnapshot, getUserEvents } from "@/app/app/api/book/_lib/admin-metrics";
import {
  getUserEntitlement,
  getUserEngagement,
  listAllUserProgress,
  getAccountStatus,
  listAccountStatusChanges,
} from "@/app/app/api/book/_lib/repo";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  return withBookApiErrors(req, async () => {
    await requireAdminUser();
    const analyticsTable = await getBookAnalyticsTableName();
    if (!analyticsTable) {
      return bookErr(req, 503, "analytics_unavailable", "Analytics table not configured.");
    }
    const tableName = await getBookTableName();
    const { userId } = await params;
    if (!userId) {
      return bookErr(req, 400, "invalid_user_id", "userId required.");
    }

    const [snapshot, events, entitlement, engagement, progressList, accountStatus, statusHistory] =
      await Promise.all([
        getUserSnapshot(analyticsTable, userId),
        getUserEvents(analyticsTable, userId, 50),
        getUserEntitlement(tableName, userId).catch(() => null),
        getUserEngagement(tableName, userId).catch(() => null),
        listAllUserProgress(tableName, userId).catch(() => []),
        getAccountStatus(tableName, userId).catch(() => null),
        listAccountStatusChanges(tableName, userId, 25).catch(() => []),
      ]);

    if (!snapshot && !entitlement && !engagement) {
      return bookErr(req, 404, "user_not_found", "No data found for this user.");
    }

    return bookOk({
      userId,
      snapshot: snapshot ? cleanSnapshot(snapshot) : null,
      entitlement: entitlement ?? null,
      engagement: engagement ?? null,
      accountStatus: accountStatus?.status ?? "active",
      accountStatusChangedAt: accountStatus?.statusChangedAt ?? null,
      accountStatusHistory: statusHistory,
      progress: progressList.map((p) => ({
        bookId: p.bookId,
        currentChapterNumber: p.currentChapterNumber,
        unlockedThroughChapterNumber: p.unlockedThroughChapterNumber,
        completedChapters: p.completedChapters,
        lastActiveAt: p.lastActiveAt,
        preferredVariant: p.preferredVariant,
      })),
      events: events.map(formatEvent),
    });
  });
}

function cleanSnapshot(item: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(item)) {
    if (k === "PK" || k === "SK" || k.startsWith("GSI")) continue;
    out[k] = v;
  }
  return out;
}

function formatEvent(item: Record<string, unknown>) {
  return {
    eventId: String(item.eventId ?? ""),
    eventType: String(item.eventType ?? ""),
    occurredAt: String(item.occurredAt ?? item.createdAt ?? ""),
    bookId: typeof item.bookId === "string" ? item.bookId : undefined,
    chapterNumber: typeof item.chapterNumber === "number" ? item.chapterNumber : undefined,
  };
}
