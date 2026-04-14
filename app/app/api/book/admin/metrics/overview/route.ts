import "server-only";

import { requireAdminUser } from "@/app/app/api/book/_lib/admin-auth";
import { bookOk, withBookApiErrors, bookErr } from "@/app/app/api/book/_lib/http";
import { getBookAnalyticsTableName, getBookTableName } from "@/app/app/api/book/_lib/env";
import {
  activeUsersByPlan,
  dauForDay,
  dailySeries,
  dayKey,
  lastNDays,
  shiftDays,
  sumFieldOnDay,
  totalUsersByPlan,
} from "@/app/app/api/book/_lib/admin-metrics";
import { listPendingScenarioModerationItems } from "@/app/app/api/book/_lib/repo";

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
    const days30 = lastNDays(30);

    const sinceIso30d = shiftDays(new Date(), -30).toISOString();
    const sinceIso7d = shiftDays(new Date(), -7).toISOString();

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
      proTotal,
      freeTotal,
      proActive30d,
      proActive7d,
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
      totalUsersByPlan(analyticsTable, "PRO"),
      totalUsersByPlan(analyticsTable, "FREE"),
      activeUsersByPlan(analyticsTable, "PRO", sinceIso30d),
      activeUsersByPlan(analyticsTable, "PRO", sinceIso7d),
      dailyDAU(analyticsTable, days14),
      dailySeries(analyticsTable, days14, "onboarding_completed"),
      dailyReading(analyticsTable, days14),
      dailySeries(analyticsTable, days14, "quiz_passed"),
    ]);

    void days30;

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
