import "server-only";

import { requireAdminUser } from "@/app/app/api/book/_lib/admin-auth";
import { bookOk, bookErr, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { getBookAnalyticsTableName, getBookTableName } from "@/app/app/api/book/_lib/env";
import { listPendingScenarioModerationItems } from "@/app/app/api/book/_lib/repo";
import {
  dailySeries,
  lastNDays,
  queryEventsForDay,
} from "@/app/app/api/book/_lib/admin-metrics";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return withBookApiErrors(req, async () => {
    await requireAdminUser();
    const tableName = await getBookTableName();
    const analyticsTable = await getBookAnalyticsTableName();
    if (!analyticsTable) {
      return bookErr(req, 503, "analytics_unavailable", "Analytics table not configured.");
    }

    const url = new URL(req.url);
    const range = Number(url.searchParams.get("range") ?? "30");
    const days = lastNDays(Math.max(7, Math.min(90, range)));

    const [pendingScenarios, scenarioSubmittedSeries, scenarioApprovedSeries, referralEvents] =
      await Promise.all([
        listPendingScenarioModerationItems(tableName, 100).catch(() => []),
        dailySeries(analyticsTable, days, "scenario_submitted"),
        dailySeries(analyticsTable, days, "scenario_approved"),
        dailySeries(analyticsTable, days, "referral_claimed"),
      ]);

    // AI auto-decisions in the period: count auto_approve / auto_reject / queue_for_review
    const aiDecisions = { auto_approve: 0, auto_reject: 0, queue_for_review: 0 };
    for (const d of days) {
      const { events } = await queryEventsForDay(analyticsTable, d, "scenario_submitted");
      for (const e of events) {
        const stage = typeof e.stage === "string" ? e.stage : "submitted";
        if (stage === "auto_approved") aiDecisions.auto_approve += 1;
        else if (stage === "auto_rejected") aiDecisions.auto_reject += 1;
        else aiDecisions.queue_for_review += 1;
      }
    }

    return bookOk({
      generatedAt: new Date().toISOString(),
      range: days.length,
      pendingScenarioCount: pendingScenarios.length,
      pendingScenariosPreview: pendingScenarios.slice(0, 10).map((s) => ({
        submissionId: s.submissionId,
        title: s.title,
        scope: s.scope,
        userEmail: s.userEmail ?? null,
        bookId: s.bookId,
        chapterNumber: s.chapterNumber,
        queuedAt: s.queuedAt,
        aiReason: s.aiValidation?.reason ?? null,
      })),
      scenarioSubmissions: scenarioSubmittedSeries.map((d) => ({ date: d.date, value: d.events })),
      scenarioApprovals: scenarioApprovedSeries.map((d) => ({ date: d.date, value: d.events })),
      aiDecisions,
      referralActivity: referralEvents.map((d) => ({ date: d.date, value: d.events })),
    });
  });
}
