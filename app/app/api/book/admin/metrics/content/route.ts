import "server-only";

import { requireAdminUser } from "@/app/app/api/book/_lib/admin-auth";
import { bookOk, bookErr, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { getBookAnalyticsTableName, getBookTableName } from "@/app/app/api/book/_lib/env";
import { listPublishedCatalogItems } from "@/app/app/api/book/_lib/repo";
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
    const days = lastNDays(Math.max(7, Math.min(180, range)));

    const catalog = await listPublishedCatalogItems(tableName);

    // Aggregate per-book stats from analytics events over the period
    const bookStats: Record<
      string,
      { quizAttempts: number; quizPasses: number; bookCompletions: number; readingMinutes: number }
    > = {};

    for (const d of days) {
      // quiz_attempt and quiz_passed events
      const [attempts, passes, completions, sessions] = await Promise.all([
        queryEventsForDay(analyticsTable, d, "quiz_attempt"),
        queryEventsForDay(analyticsTable, d, "quiz_passed"),
        queryEventsForDay(analyticsTable, d, "book_completed"),
        queryEventsForDay(analyticsTable, d, "reading_session"),
      ]);

      for (const e of attempts.events) {
        const bid = typeof e.bookId === "string" ? e.bookId : null;
        if (!bid) continue;
        bookStats[bid] = bookStats[bid] ?? { quizAttempts: 0, quizPasses: 0, bookCompletions: 0, readingMinutes: 0 };
        bookStats[bid].quizAttempts += 1;
      }
      for (const e of passes.events) {
        const bid = typeof e.bookId === "string" ? e.bookId : null;
        if (!bid) continue;
        bookStats[bid] = bookStats[bid] ?? { quizAttempts: 0, quizPasses: 0, bookCompletions: 0, readingMinutes: 0 };
        bookStats[bid].quizPasses += 1;
      }
      for (const e of completions.events) {
        const bid = typeof e.bookId === "string" ? e.bookId : null;
        if (!bid) continue;
        bookStats[bid] = bookStats[bid] ?? { quizAttempts: 0, quizPasses: 0, bookCompletions: 0, readingMinutes: 0 };
        bookStats[bid].bookCompletions += 1;
      }
      for (const e of sessions.events) {
        const bid = typeof e.bookId === "string" ? e.bookId : null;
        const ms = typeof e.deltaMs === "number" ? e.deltaMs : 0;
        if (!bid) continue;
        bookStats[bid] = bookStats[bid] ?? { quizAttempts: 0, quizPasses: 0, bookCompletions: 0, readingMinutes: 0 };
        bookStats[bid].readingMinutes += Math.round(ms / 60000);
      }
    }

    const books = catalog.map((c) => {
      const stats = bookStats[c.bookId] ?? {
        quizAttempts: 0,
        quizPasses: 0,
        bookCompletions: 0,
        readingMinutes: 0,
      };
      const passRate = stats.quizAttempts > 0 ? (stats.quizPasses / stats.quizAttempts) * 100 : 0;
      return {
        bookId: c.bookId,
        title: c.title,
        author: c.author,
        categories: c.categories,
        quizAttempts: stats.quizAttempts,
        quizPasses: stats.quizPasses,
        passRatePercent: Math.round(passRate),
        bookCompletions: stats.bookCompletions,
        readingMinutes: stats.readingMinutes,
      };
    });

    // Scenario submissions (community contributions) per day
    const scenarioSubs = await dailySeries(analyticsTable, days, "scenario_submitted");
    const scenarioApproved = await dailySeries(analyticsTable, days, "scenario_approved");

    return bookOk({
      generatedAt: new Date().toISOString(),
      range: days.length,
      books: books.sort((a, b) => b.readingMinutes - a.readingMinutes),
      scenarioSubmissions: scenarioSubs.map((d) => ({ date: d.date, value: d.events })),
      scenarioApprovals: scenarioApproved.map((d) => ({ date: d.date, value: d.events })),
    });
  });
}
