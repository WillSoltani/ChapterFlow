import "server-only";
import { NextResponse } from "next/server";
import { requireUser } from "@/app/app/api/_lib/auth";
import { withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import { getBookAnalyticsTableName, getBookTableName } from "@/app/app/api/book/_lib/env";
import { getUserSnapshot, getUserEvents } from "@/app/app/api/book/_lib/admin-metrics";
import {
  getUserEntitlement,
  getUserProfileItem,
  getUserSettingsItem,
  listAllUserBookStates,
  listAllUserProgress,
  listBadgeAwards,
  listReadingDays,
  listSavedBooks,
  listUserChapterStates,
} from "@/app/app/api/book/_lib/repo";
import {
  getUserFlowPointsState,
  listRecentFlowPointsLedger,
} from "@/app/app/api/book/_lib/flow-points-repo";

export const runtime = "nodejs";

type ExportData = {
  exportedAt: string;
  userId: string;
  profile: Record<string, unknown> | null;
  settings: Record<string, unknown> | null;
  entitlement: Record<string, unknown> | null;
  readingHistory: Array<Record<string, unknown>>;
  bookProgress: Array<Record<string, unknown>>;
  bookStates: Array<Record<string, unknown>>;
  chapterStates: Array<Record<string, unknown>>;
  savedBooks: Array<Record<string, unknown>>;
  badges: Array<Record<string, unknown>>;
  flowPoints: { balance: number; ledger: Array<Record<string, unknown>> };
  analytics: {
    snapshot: Record<string, unknown> | null;
    recentEvents: Array<Record<string, unknown>>;
  };
};

/** Strip internal key/index attributes from an analytics-table item. */
function cleanAnalyticsItem(item: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(item)) {
    if (k === "PK" || k === "SK" || k.startsWith("GSI")) continue;
    out[k] = v;
  }
  return out;
}

/**
 * GET /app/api/book/me/export?format=json|csv|markdown
 *
 * Full user data export. Returns a downloadable file containing all
 * user data: reading history, notes, bookmarks, quiz results, progress,
 * profile, settings, badges, flow points, saved books, and entitlements.
 */
export async function GET(req: Request) {
  return withBookApiErrors(req, async () => {
    const user = await requireUser();
    const tableName = await getBookTableName();
    const analyticsTable = await getBookAnalyticsTableName();

    const url = new URL(req.url);
    const format = url.searchParams.get("format") || "json";
    if (format !== "json" && format !== "csv" && format !== "markdown") {
      throw new BookApiError(400, "invalid_format", "format must be json, csv, or markdown");
    }

    // Fetch all user data in parallel
    const [
      profile,
      settings,
      entitlement,
      readingDays,
      progress,
      bookStates,
      chapterStates,
      savedBooks,
      badges,
      flowPointsState,
      flowPointsLedger,
      analyticsSnapshot,
      analyticsEvents,
    ] = await Promise.all([
      getUserProfileItem(tableName, user.sub).catch(() => null),
      getUserSettingsItem(tableName, user.sub).catch(() => null),
      getUserEntitlement(tableName, user.sub).catch(() => null),
      listReadingDays(tableName, user.sub).catch(() => []),
      listAllUserProgress(tableName, user.sub).catch(() => []),
      listAllUserBookStates(tableName, user.sub).catch(() => []),
      listUserChapterStates(tableName, user.sub).catch(() => []),
      listSavedBooks(tableName, user.sub).catch(() => []),
      listBadgeAwards(tableName, user.sub).catch(() => []),
      getUserFlowPointsState(tableName, user.sub).catch(() => ({ points: 0 })),
      listRecentFlowPointsLedger(tableName, user.sub).catch(() => []),
      analyticsTable
        ? getUserSnapshot(analyticsTable, user.sub).catch(() => null)
        : Promise.resolve(null),
      analyticsTable
        ? getUserEvents(analyticsTable, user.sub, 200).catch(() => [])
        : Promise.resolve([] as Record<string, unknown>[]),
    ]);

    // Respect saveReadingHistory privacy preference
    const privacy = settings?.settings?.privacy as
      | { saveReadingHistory?: boolean }
      | undefined;
    const saveReadingHistory = privacy?.saveReadingHistory ?? true;

    const data: ExportData = {
      exportedAt: new Date().toISOString(),
      userId: user.sub,
      profile: profile?.profile ?? null,
      settings: settings?.settings ?? null,
      entitlement: entitlement
        ? {
            plan: entitlement.plan,
            proStatus: entitlement.proStatus,
            proSource: entitlement.proSource,
            freeBookSlots: entitlement.freeBookSlots,
            unlockedBookIds: entitlement.unlockedBookIds,
            currentPeriodEnd: entitlement.currentPeriodEnd,
          }
        : null,
      readingHistory: saveReadingHistory
        ? readingDays.map((d) => ({
            date: d.dayKey,
            totalMinutes: Math.round(d.totalActiveMs / 60000),
            totalMs: d.totalActiveMs,
            updatedAt: d.updatedAt,
          }))
        : [],
      bookProgress: progress.map((p) => ({
        bookId: p.bookId,
        currentChapter: p.currentChapterNumber,
        unlockedThrough: p.unlockedThroughChapterNumber,
        completedChapters: p.completedChapters,
        bestScoreByChapter: p.bestScoreByChapter,
        lastActiveAt: p.lastActiveAt,
        createdAt: p.createdAt,
      })),
      bookStates: bookStates.map((s) => ({
        bookId: s.bookId,
        currentChapterId: s.currentChapterId,
        completedChapterIds: s.completedChapterIds,
        chapterScores: s.chapterScores,
        chapterCompletedAt: s.chapterCompletedAt,
        lastOpenedAt: s.lastOpenedAt,
      })),
      chapterStates: chapterStates.map((cs) => ({
        bookId: cs.bookId,
        chapterNumber: cs.chapterNumber,
        notes: (cs.state as Record<string, unknown>)?.notes ?? null,
        bookmarkedTakeaways:
          (cs.state as Record<string, unknown>)?.bookmarkedTakeaways ?? [],
        quizAnswers: (cs.state as Record<string, unknown>)?.quizAnswers ?? {},
        quizResult: (cs.state as Record<string, unknown>)?.quizResult ?? null,
        updatedAt: cs.updatedAt,
      })),
      savedBooks: savedBooks.map((s) => ({
        bookId: s.bookId,
        savedAt: s.savedAt,
      })),
      badges: badges.map((b) => ({
        badgeId: b.badgeId,
        tier: b.tier,
        earnedAt: b.earnedAt,
      })),
      flowPoints: {
        balance: flowPointsState.points,
        ledger: flowPointsLedger.map((l) => ({
          direction: l.direction,
          amount: l.amount,
          sourceType: l.sourceType,
          sourceId: l.sourceId,
          createdAt: l.createdAt,
        })),
      },
      // Analytics-table data we hold about you (snapshot incl. approximate
      // location/device + recent events) — included for a complete access copy.
      analytics: {
        snapshot: analyticsSnapshot ? cleanAnalyticsItem(analyticsSnapshot) : null,
        recentEvents: analyticsEvents.map(cleanAnalyticsItem),
      },
    };

    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `chapterflow-export-${timestamp}`;

    if (format === "json") {
      return new NextResponse(JSON.stringify(data, null, 2), {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="${filename}.json"`,
        },
      });
    }

    if (format === "csv") {
      return new NextResponse(exportToCsv(data), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}.csv"`,
        },
      });
    }

    // markdown
    return new NextResponse(exportToMarkdown(data), {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}.md"`,
      },
    });
  });
}

// ─── CSV formatter ──────────────────────────────────────────────────────────

function csvEscape(value: unknown): string {
  const str = value == null ? "" : String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function csvSection(title: string, headers: string[], rows: unknown[][]): string {
  const lines = [`# ${title}`, headers.map(csvEscape).join(",")];
  for (const row of rows) {
    lines.push(row.map(csvEscape).join(","));
  }
  return lines.join("\n");
}

function exportToCsv(data: ExportData): string {
  const sections: string[] = [];

  // Reading History
  if (data.readingHistory.length > 0) {
    sections.push(
      csvSection(
        "Reading History",
        ["Date", "Minutes Read", "Total Ms"],
        data.readingHistory.map((r) => [r.date, r.totalMinutes, r.totalMs])
      )
    );
  }

  // Book Progress
  if (data.bookProgress.length > 0) {
    sections.push(
      csvSection(
        "Book Progress",
        ["Book ID", "Current Chapter", "Unlocked Through", "Completed Chapters", "Last Active"],
        data.bookProgress.map((p) => [
          p.bookId,
          p.currentChapter,
          p.unlockedThrough,
          JSON.stringify(p.completedChapters),
          p.lastActiveAt,
        ])
      )
    );
  }

  // Chapter Notes & Bookmarks
  const chaptersWithNotes = data.chapterStates.filter(
    (cs) => cs.notes || (Array.isArray(cs.bookmarkedTakeaways) && (cs.bookmarkedTakeaways as unknown[]).length > 0)
  );
  if (chaptersWithNotes.length > 0) {
    sections.push(
      csvSection(
        "Notes & Bookmarks",
        ["Book ID", "Chapter", "Notes", "Bookmarked Takeaways", "Updated At"],
        chaptersWithNotes.map((cs) => [
          cs.bookId,
          cs.chapterNumber,
          cs.notes,
          JSON.stringify(cs.bookmarkedTakeaways),
          cs.updatedAt,
        ])
      )
    );
  }

  // Quiz Results
  const chaptersWithQuiz = data.chapterStates.filter((cs) => cs.quizResult != null);
  if (chaptersWithQuiz.length > 0) {
    sections.push(
      csvSection(
        "Quiz Results",
        ["Book ID", "Chapter", "Result", "Updated At"],
        chaptersWithQuiz.map((cs) => [
          cs.bookId,
          cs.chapterNumber,
          JSON.stringify(cs.quizResult),
          cs.updatedAt,
        ])
      )
    );
  }

  // Saved Books
  if (data.savedBooks.length > 0) {
    sections.push(
      csvSection(
        "Saved Books",
        ["Book ID", "Saved At"],
        data.savedBooks.map((s) => [s.bookId, s.savedAt])
      )
    );
  }

  // Badges
  if (data.badges.length > 0) {
    sections.push(
      csvSection(
        "Badges",
        ["Badge ID", "Tier", "Earned At"],
        data.badges.map((b) => [b.badgeId, b.tier, b.earnedAt])
      )
    );
  }

  // Flow Points
  if (data.flowPoints.ledger.length > 0) {
    sections.push(
      csvSection(
        "Insight Points Transactions",
        ["Direction", "Amount", "Source Type", "Source ID", "Date"],
        data.flowPoints.ledger.map((l) => [
          l.direction,
          l.amount,
          l.sourceType,
          l.sourceId,
          l.createdAt,
        ])
      )
    );
  }

  return sections.join("\n\n");
}

// ─── Markdown formatter ─────────────────────────────────────────────────────

function exportToMarkdown(data: ExportData): string {
  const lines: string[] = [
    "# ChapterFlow Data Export",
    "",
    `Exported: ${data.exportedAt}`,
    "",
  ];

  // Profile
  if (data.profile) {
    lines.push("## Profile", "");
    for (const [k, v] of Object.entries(data.profile)) {
      if (v != null && typeof v !== "object") {
        lines.push(`- **${k}:** ${v}`);
      }
    }
    lines.push("");
  }

  // Entitlement
  if (data.entitlement) {
    lines.push("## Subscription", "");
    lines.push(`- **Plan:** ${data.entitlement.plan}`);
    if (data.entitlement.proStatus) lines.push(`- **Status:** ${data.entitlement.proStatus}`);
    if (data.entitlement.currentPeriodEnd)
      lines.push(`- **Period End:** ${data.entitlement.currentPeriodEnd}`);
    lines.push("");
  }

  // Reading History
  if (data.readingHistory.length > 0) {
    lines.push("## Reading History", "");
    lines.push("| Date | Minutes Read |");
    lines.push("| ---- | ----------- |");
    for (const r of data.readingHistory) {
      lines.push(`| ${r.date} | ${r.totalMinutes} |`);
    }
    lines.push("");
  }

  // Book Progress
  if (data.bookProgress.length > 0) {
    lines.push("## Book Progress", "");
    for (const p of data.bookProgress) {
      lines.push(`### ${p.bookId}`, "");
      lines.push(`- Current chapter: ${p.currentChapter}`);
      lines.push(`- Unlocked through: ${p.unlockedThrough}`);
      lines.push(`- Completed chapters: ${JSON.stringify(p.completedChapters)}`);
      lines.push(`- Last active: ${p.lastActiveAt ?? "N/A"}`);
      lines.push("");
    }
  }

  // Notes & Bookmarks
  const chaptersWithNotes = data.chapterStates.filter(
    (cs) => cs.notes || (Array.isArray(cs.bookmarkedTakeaways) && (cs.bookmarkedTakeaways as unknown[]).length > 0)
  );
  if (chaptersWithNotes.length > 0) {
    lines.push("## Notes & Bookmarks", "");
    for (const cs of chaptersWithNotes) {
      lines.push(`### ${cs.bookId} - Chapter ${cs.chapterNumber}`, "");
      if (cs.notes) {
        lines.push("**Notes:**", "", String(cs.notes), "");
      }
      if (Array.isArray(cs.bookmarkedTakeaways) && (cs.bookmarkedTakeaways as unknown[]).length > 0) {
        lines.push(`**Bookmarked Takeaways:** ${JSON.stringify(cs.bookmarkedTakeaways)}`, "");
      }
    }
  }

  // Saved Books
  if (data.savedBooks.length > 0) {
    lines.push("## Saved Books", "");
    for (const s of data.savedBooks) {
      lines.push(`- ${s.bookId} (saved ${s.savedAt})`);
    }
    lines.push("");
  }

  // Badges
  if (data.badges.length > 0) {
    lines.push("## Badges Earned", "");
    for (const b of data.badges) {
      lines.push(`- **${b.badgeId}**${b.tier ? ` (${b.tier})` : ""} - earned ${b.earnedAt}`);
    }
    lines.push("");
  }

  // Flow Points
  lines.push("## Insight Points", "");
  lines.push(`**Balance:** ${data.flowPoints.balance}`, "");
  if (data.flowPoints.ledger.length > 0) {
    lines.push("| Direction | Amount | Source | Date |");
    lines.push("| --------- | ------ | ------ | ---- |");
    for (const l of data.flowPoints.ledger) {
      lines.push(`| ${l.direction} | ${l.amount} | ${l.sourceType} | ${l.createdAt} |`);
    }
    lines.push("");
  }

  // Analytics data we hold (snapshot + recent events)
  if (data.analytics.snapshot || data.analytics.recentEvents.length > 0) {
    lines.push("## Usage Analytics", "");
    if (data.analytics.snapshot) {
      lines.push("**Profile snapshot** (includes approximate location and device, where available):", "");
      for (const [k, v] of Object.entries(data.analytics.snapshot)) {
        if (v != null && typeof v !== "object") lines.push(`- **${k}:** ${v}`);
      }
      lines.push("");
    }
    if (data.analytics.recentEvents.length > 0) {
      lines.push(`**Recent events:** ${data.analytics.recentEvents.length} (most recent first)`, "");
    }
  }

  return lines.join("\n");
}
