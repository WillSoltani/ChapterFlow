import "server-only";

import { requireAdminUser } from "@/app/app/api/book/_lib/admin-auth";
import { bookOk, bookErr, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { getBookAnalyticsTableName } from "@/app/app/api/book/_lib/env";
import {
  dailySeries,
  lastNDays,
  queryEventsForDay,
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
    const range = Number(url.searchParams.get("range") ?? "30");
    const days = lastNDays(Math.max(7, Math.min(180, range)));

    const [signups, onboarded, firstReading, firstQuiz, firstQuizPass] = await Promise.all([
      dailySeries(analyticsTable, days, "onboarding_completed"), // proxy for signups
      dailySeries(analyticsTable, days, "onboarding_completed"),
      dailySeries(analyticsTable, days, "reading_session"),
      dailySeries(analyticsTable, days, "quiz_attempt"),
      dailySeries(analyticsTable, days, "quiz_passed"),
    ]);

    // Top email domains over the period (proxy for organic vs vendor signups)
    const domainCounts = new Map<string, number>();
    for (const d of days) {
      const { events } = await queryEventsForDay(analyticsTable, d, "onboarding_completed");
      for (const e of events) {
        const email = e.email;
        if (typeof email === "string" && email.includes("@")) {
          const domain = email.split("@")[1].toLowerCase();
          domainCounts.set(domain, (domainCounts.get(domain) ?? 0) + 1);
        }
      }
    }
    const topDomains = Array.from(domainCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([domain, count]) => ({ domain, count }));

    // Funnel totals over the range
    const funnel = {
      onboarded: sum(onboarded),
      firstReading: sum(firstReading),
      firstQuiz: sum(firstQuiz),
      firstQuizPass: sum(firstQuizPass),
    };

    // Referral activations
    const referralActivated = await dailySeries(analyticsTable, days, "referral_activated");

    return bookOk({
      generatedAt: new Date().toISOString(),
      range: days.length,
      signups: signups.map((d) => ({ date: d.date, value: d.events })),
      funnel,
      topDomains,
      referrals: referralActivated.map((d) => ({ date: d.date, value: d.events })),
    });
  });
}

function sum(series: { events: number }[]): number {
  return series.reduce((acc, d) => acc + d.events, 0);
}
