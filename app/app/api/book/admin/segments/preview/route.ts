import "server-only";

import { requireAdminUser } from "@/app/app/api/book/_lib/admin-auth";
import { bookOk, bookErr, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { getBookAnalyticsTableName, getBookTableName } from "@/app/app/api/book/_lib/env";
import { buildSegmentUsers } from "@/app/app/api/book/_lib/admin-metrics";
import { runSegment, type SegmentFilter } from "@/app/app/api/book/_lib/segment-engine";

export const runtime = "nodejs";

export async function POST(req: Request) {
  return withBookApiErrors(req, async () => {
    await requireAdminUser();
    const tableName = await getBookTableName();
    const analyticsTable = await getBookAnalyticsTableName();
    if (!analyticsTable) {
      return bookErr(req, 503, "analytics_unavailable", "Analytics table not configured.");
    }

    const body = await req.json().catch(() => ({}));
    const filters = Array.isArray((body as { filters?: unknown }).filters)
      ? ((body as { filters: unknown[] }).filters as SegmentFilter[])
      : [];

    const users = await buildSegmentUsers(tableName, analyticsTable);
    const matches = runSegment(users, filters);

    return bookOk({
      totalScanned: users.length,
      matchCount: matches.length,
      preview: matches.slice(0, 25).map((u) => ({
        userId: u.userId,
        email: u.email,
        plan: u.plan,
        proSource: u.proSource,
        countryCode: u.countryCode,
        lastActiveAt: u.lastActiveAt,
        booksCompleted: u.booksCompleted,
        flowPoints: u.flowPoints,
      })),
    });
  });
}
