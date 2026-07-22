import "server-only";

import { requireAdminUser } from "@/app/app/api/book/_lib/admin-auth";
import { bookOk, withBookApiErrors, bookErr } from "@/app/app/api/book/_lib/http";
import { getBookAnalyticsTableName, getBookTableName } from "@/app/app/api/book/_lib/env";
import {
  dauForDay,
  dailySeries,
  dayKey,
  lastNDays,
  scanAllEntitlements,
  batchGetUserSnapshots,
  shiftDays,
  sumFieldOnDay,
} from "@/app/app/api/book/_lib/admin-metrics";
import { listPendingScenarioModerationItems } from "@/app/app/api/book/_lib/repo";
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

    const today = dayKey();
    const yesterday = dayKey(shiftDays(new Date(), -1));
    const days14 = lastNDays(14);

    const now = Date.now();
    const ms7d = 7 * 86_400_000;
    const ms30d = 30 * 86_400_000;

    const [
      dauToday,
      dauYesterday,
      newSignupsToday,
      newSignupsYesterday,
      quizAttemptsToday,
      quizPassesToday,
      readingMsToday,
      readingMsYesterday,
      pendingScenarios,
      entitlements,
      dauSpark,
      signupSpark,
      readingSpark,
      quizPassSpark,
    ] = await Promise.all([
      dauForDay(analyticsTable, today),
      dauForDay(analyticsTable, yesterday),
      countEvents(analyticsTable, today, "onboarding_completed"),
      countEvents(analyticsTable, yesterday, "onboarding_completed"),
      countEvents(analyticsTable, today, "quiz_attempt"),
      countEvents(analyticsTable, today, "quiz_passed"),
      sumFieldOnDay(analyticsTable, today, "reading_session", "deltaMs"),
      sumFieldOnDay(analyticsTable, yesterday, "reading_session", "deltaMs"),
      listPendingScenarioModerationItems(tableName, 50).catch(() => []),
      scanAllEntitlements(tableName).catch((err) => {
        logger.warn("admin_overview_entitlement_scan_failed", { err });
        return [];
      }),
      dailyDAU(analyticsTable, days14),
      dailySeries(analyticsTable, days14, "onboarding_completed"),
      dailyReading(analyticsTable, days14),
      dailySeries(analyticsTable, days14, "quiz_passed"),
    ]);

    // Count plans from entitlements (source of truth for plan)
    const proEntitlements = entitlements.filter(
      (e) => e.plan === "PRO" && e.proStatus !== "canceled" && e.proStatus !== "inactive",
    );
    const freeEntitlements = entitlements.filter((e) => e.plan === "FREE");
    const proTotal = proEntitlements.length;
    const freeTotal = freeEntitlements.length;

    // For activity counts on PRO users, look up their analytics snapshot
    // to read lastActiveAt, then bucket.
    let proActive7d = 0;
    let proActive30d = 0;
    if (proEntitlements.length > 0) {
      const proUserIds = proEntitlements.map((e) => e.userId);
      const snapshots = await batchGetUserSnapshots(analyticsTable, proUserIds);
      for (const userId of proUserIds) {
        const snap = snapshots.get(userId);
        const lastActiveAt = snap?.lastActiveAt;
        if (typeof lastActiveAt !== "string") continue;
        const ts = new Date(lastActiveAt).getTime();
        if (Number.isNaN(ts)) continue;
        if (now - ts <= ms7d) proActive7d += 1;
        if (now - ts <= ms30d) proActive30d += 1;
      }
    }

    const readingMinutesToday = Math.round(readingMsToday / 60000);
    const readingMinutesYesterday = Math.round(readingMsYesterday / 60000);

    return bookOk({
      generatedAt: new Date().toISOString(),
      kpis: {
        dau: { value: dauToday, prior: dauYesterday },
        newSignups: { value: newSignupsToday, prior: newSignupsYesterday },
        quizAttempts: { value: quizAttemptsToday, prior: 0 },
        quizPasses: { value: quizPassesToday, prior: 0 },
        readingMinutes: { value: readingMinutesToday, prior: readingMinutesYesterday },
        pendingScenarios: { value: pendingScenarios.length },
        proTotal: { value: proTotal },
        freeTotal: { value: freeTotal },
        proActive30d: { value: proActive30d },
        proActive7d: { value: proActive7d },
      },
      sparks: {
        dau: dauSpark,
        signups: signupSpark.map((d) => ({ date: d.date, value: d.events })),
        reading: readingSpark,
        quizPasses: quizPassSpark.map((d) => ({ date: d.date, value: d.events })),
      },
    });
  });
}

async function countEvents(table: string, day: string, eventType: string): Promise<number> {
  const series = await dailySeries(table, [day], eventType);
  return series[0]?.events ?? 0;
}

async function dailyDAU(table: string, days: string[]) {
  return Promise.all(
    days.map(async (d) => ({ date: d, value: await dauForDay(table, d) })),
  );
}

async function dailyReading(table: string, days: string[]) {
  return Promise.all(
    days.map(async (d) => {
      const ms = await sumFieldOnDay(table, d, "reading_session", "deltaMs");
      return { date: d, value: Math.round(ms / 60000) };
    }),
  );
}
