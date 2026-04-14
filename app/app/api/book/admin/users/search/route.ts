import "server-only";

import { requireAdminUser } from "@/app/app/api/book/_lib/admin-auth";
import { bookOk, bookErr, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { getBookAnalyticsTableName } from "@/app/app/api/book/_lib/env";
import {
  listRecentUsersByPlan,
  searchUsersByEmail,
} from "@/app/app/api/book/_lib/admin-metrics";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return withBookApiErrors(req, async () => {
    await requireAdminUser();
    const analyticsTable = await getBookAnalyticsTableName();
    if (!analyticsTable) {
      return bookErr(req, 503, "analytics_unavailable", "Analytics table not configured.");
    }

    const url = new URL(req.url);
    const q = url.searchParams.get("q") || "";
    const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit") ?? "50")));

    let snapshots: Record<string, unknown>[];
    if (q) {
      snapshots = await searchUsersByEmail(analyticsTable, q, limit);
    } else {
      // Default: most recently active PRO + FREE users
      const [pro, free] = await Promise.all([
        listRecentUsersByPlan(analyticsTable, "PRO", Math.ceil(limit / 2)),
        listRecentUsersByPlan(analyticsTable, "FREE", Math.ceil(limit / 2)),
      ]);
      snapshots = [...pro, ...free]
        .sort((a, b) => readTime(b) - readTime(a))
        .slice(0, limit);
    }

    return bookOk({
      users: snapshots.map(formatUser),
      total: snapshots.length,
    });
  });
}

function readTime(item: Record<string, unknown>): number {
  const t = item.lastActiveAt;
  if (typeof t === "string") return new Date(t).getTime();
  return 0;
}

function formatUser(item: Record<string, unknown>) {
  return {
    userId: String(item.userId ?? ""),
    email: typeof item.email === "string" ? item.email : null,
    plan: typeof item.plan === "string" ? item.plan : "FREE",
    proStatus: typeof item.proStatus === "string" ? item.proStatus : null,
    firstSeenAt: typeof item.firstSeenAt === "string" ? item.firstSeenAt : null,
    lastActiveAt: typeof item.lastActiveAt === "string" ? item.lastActiveAt : null,
    totalReadingMs: typeof item.totalReadingMs === "number" ? item.totalReadingMs : 0,
    totalQuizAttempts: typeof item.totalQuizAttempts === "number" ? item.totalQuizAttempts : 0,
    totalQuizPasses: typeof item.totalQuizPasses === "number" ? item.totalQuizPasses : 0,
    flowPoints: typeof item.flowPoints === "number" ? item.flowPoints : 0,
    booksCompleted: typeof item.booksCompleted === "number" ? item.booksCompleted : 0,
    badgeCount: typeof item.badgeCount === "number" ? item.badgeCount : 0,
    onboardingCompletedAt:
      typeof item.onboardingCompletedAt === "string" ? item.onboardingCompletedAt : null,
  };
}
