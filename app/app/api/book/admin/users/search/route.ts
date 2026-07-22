import "server-only";

import { requireAdminUser } from "@/app/app/api/book/_lib/admin-auth";
import { bookOk, bookErr, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { getBookAnalyticsTableName, getBookTableName } from "@/app/app/api/book/_lib/env";
import {
  listRecentUsersByPlan,
  searchUsersByEmail,
  scanAllEntitlements,
  type EntitlementSnapshot,
} from "@/app/app/api/book/_lib/admin-metrics";
import { logger } from "@/lib/logging/logger";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return withBookApiErrors(req, async () => {
    await requireAdminUser();
    const analyticsTable = await getBookAnalyticsTableName();
    if (!analyticsTable) {
      return bookErr(req, 503, "analytics_unavailable", "Analytics table not configured.");
    }
    const tableName = await getBookTableName();

    const url = new URL(req.url);
    const q = url.searchParams.get("q") || "";
    const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit") ?? "50")));

    const [snapshots, entitlements] = await Promise.all([
      q
        ? searchUsersByEmail(analyticsTable, q, limit)
        : Promise.all([
            listRecentUsersByPlan(analyticsTable, "PRO", Math.ceil(limit / 2)),
            listRecentUsersByPlan(analyticsTable, "FREE", Math.ceil(limit / 2)),
          ]).then(([pro, free]) =>
            [...pro, ...free]
              .sort((a, b) => readTime(b) - readTime(a))
              .slice(0, limit),
          ),
      scanAllEntitlements(tableName).catch((err) => {
        logger.warn("admin_users_search_entitlement_scan_failed", { err });
        return [] as EntitlementSnapshot[];
      }),
    ]);

    // Index entitlements by userId for quick overlay
    const entitlementByUser = new Map<string, EntitlementSnapshot>();
    for (const e of entitlements) entitlementByUser.set(e.userId, e);

    return bookOk({
      users: snapshots.map((s) => formatUser(s, entitlementByUser.get(String(s.userId ?? "")))),
      total: snapshots.length,
    });
  });
}

function readTime(item: Record<string, unknown>): number {
  const t = item.lastActiveAt;
  if (typeof t === "string") return new Date(t).getTime();
  return 0;
}

function formatUser(item: Record<string, unknown>, ent?: EntitlementSnapshot) {
  // Entitlement is the source of truth for plan / proSource. If no
  // entitlement exists, fall back to the analytics snapshot's plan field.
  const plan = ent?.plan ?? (typeof item.plan === "string" ? item.plan : "FREE");
  const proStatus = ent?.proStatus ?? (typeof item.proStatus === "string" ? item.proStatus : null);
  const proSource = ent?.proSource ?? (typeof item.proSource === "string" ? item.proSource : null);

  return {
    userId: String(item.userId ?? ""),
    email: typeof item.email === "string" ? item.email : null,
    plan,
    proStatus,
    proSource,
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
