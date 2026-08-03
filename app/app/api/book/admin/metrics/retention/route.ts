import "server-only";

import { requireAdminUser } from "@/app/app/api/book/_lib/admin-auth";
import { bookOk, bookErr, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { getBookAnalyticsTableName } from "@/app/app/api/book/_lib/env";
import {
  bucketReadingFrequency,
  buildCohortRetention,
  scanAllUserSnapshots,
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

    const warnings: string[] = [];
    let snapshots: Record<string, unknown>[] = [];
    try {
      snapshots = await scanAllUserSnapshots(
        analyticsTable,
        "userId, firstSeenAt, readingDays, lastActiveAt",
      );
    } catch (err) {
      logger.warn("admin_retention_snapshot_scan_failed", { err });
      warnings.push("Retention data unavailable (database scan failed).");
    }

    // Coerce DDB Set type → array of strings for downstream computation
    const coerced = snapshots.map((s) => ({
      firstSeenAt: typeof s.firstSeenAt === "string" ? s.firstSeenAt : undefined,
      readingDays: coerceDayStrings(s.readingDays),
      lastActiveAt: typeof s.lastActiveAt === "string" ? s.lastActiveAt : undefined,
    }));

    const cohorts = buildCohortRetention(coerced, 8);
    const frequency = bucketReadingFrequency(coerced);

    // D1/D7/D14/D30 return rates from cohort matrix
    const dayN = computeDayNRates(coerced, [1, 7, 14, 30]);

    // Streak distribution buckets — derive from current consecutive-day streaks
    const streakBuckets = bucketStreaks(coerced);

    return bookOk({
      generatedAt: new Date().toISOString(),
      total: coerced.length,
      cohorts,
      frequency,
      dayN,
      streakBuckets,
      warnings,
    });
  });
}

function coerceDayStrings(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  if (value instanceof Set) return Array.from(value as Set<string>);
  // DDB DocumentClient may return a Set wrapper; try .values
  const maybe = value as { values?: unknown };
  if (Array.isArray(maybe.values)) return maybe.values.filter((v: unknown): v is string => typeof v === "string");
  return [];
}

function computeDayNRates(
  snapshots: Array<{ firstSeenAt?: string | undefined; readingDays: string[] }>,
  daysList: number[],
): Array<{ day: number; rate: number; sample: number }> {
  return daysList.map((d) => {
    let denominator = 0;
    let numerator = 0;
    for (const s of snapshots) {
      if (!s.firstSeenAt) continue;
      const first = new Date(s.firstSeenAt);
      if (Number.isNaN(first.getTime())) continue;
      // Only count users who had a chance to be active by D+d
      if (Date.now() - first.getTime() < d * 86_400_000) continue;
      denominator += 1;
      const cutoff = new Date(first.getTime() + d * 86_400_000)
        .toISOString()
        .slice(0, 10);
      const firstStr = s.firstSeenAt.slice(0, 10);
      const wasActive = s.readingDays.some((day) => day > firstStr && day <= cutoff);
      if (wasActive) numerator += 1;
    }
    return {
      day: d,
      rate: denominator > 0 ? Math.round((numerator / denominator) * 100) : 0,
      sample: denominator,
    };
  });
}

function bucketStreaks(
  snapshots: Array<{ readingDays: string[] }>,
): Array<{ bucket: string; count: number }> {
  const buckets = { "0": 0, "1-3": 0, "4-7": 0, "8-14": 0, "15-30": 0, "30-100": 0, "100+": 0 };
  for (const s of snapshots) {
    const streak = currentStreakFromDays(s.readingDays);
    if (streak === 0) buckets["0"] += 1;
    else if (streak <= 3) buckets["1-3"] += 1;
    else if (streak <= 7) buckets["4-7"] += 1;
    else if (streak <= 14) buckets["8-14"] += 1;
    else if (streak <= 30) buckets["15-30"] += 1;
    else if (streak <= 100) buckets["30-100"] += 1;
    else buckets["100+"] += 1;
  }
  return Object.entries(buckets).map(([bucket, count]) => ({ bucket, count }));
}

function currentStreakFromDays(days: string[]): number {
  if (days.length === 0) return 0;
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  // Anchor must be today or yesterday
  const sorted = Array.from(new Set(days)).sort((a, b) => b.localeCompare(a));
  if (sorted[0] !== today && sorted[0] !== yesterday) return 0;

  let streak = 0;
  let cursor = new Date(sorted[0]);
  for (const day of sorted) {
    if (day === cursor.toISOString().slice(0, 10)) {
      streak += 1;
      cursor = new Date(cursor.getTime() - 86_400_000);
    } else {
      break;
    }
  }
  return streak;
}
