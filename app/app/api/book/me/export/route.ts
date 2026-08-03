import "server-only";
import { NextResponse } from "next/server";
import { requireUser, requireRecentAuth } from "@/app/app/api/_lib/auth";
import {
  withBookApiErrors,
  enforceDailyUserLimit,
  dailyLimitDateKey,
} from "@/app/app/api/book/_lib/http";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import { getBookAnalyticsTableName, getBookTableName } from "@/app/app/api/book/_lib/env";
import { getUserSnapshot, getAllUserEvents } from "@/app/app/api/book/_lib/admin-metrics";
import { bookUserPk, exportLimitSk } from "@/app/app/api/book/_lib/keys";
import {
  getUserEntitlement,
  getUserProfileItem,
  getUserSettingsItem,
} from "@/app/app/api/book/_lib/repo";
import {
  exportAllBadgeAwards,
  exportAllBookStates,
  exportAllChapterStates,
  exportAllProgress,
  exportAllReadingDays,
  exportAllSavedBooks,
} from "@/app/app/api/book/_lib/export-repo";
import {
  ExportSourceTracker,
  type ExportManifest,
} from "@/app/app/api/book/_lib/export-manifest-core";
import {
  getUserFlowPointsState,
  listAllFlowPointsLedger,
} from "@/app/app/api/book/_lib/flow-points-repo";

export const runtime = "nodejs";

/**
 * GDPR/CCPA export is heavyweight (full-partition paginated scan + analytics
 * reads). A per-user daily cap stops abuse/runaway looping while staying well
 * above any legitimate need (a user downloads their own data a handful of times
 * per day at most). (#8)
 */
const EXPORT_DAILY_LIMIT = 5;

/**
 * Step-up window (#5, Tier 3): exporting ALL personal data is a sensitive
 * read — require a sign-in within the last 10 minutes so a walk-up/stolen-cookie
 * session can't quietly exfiltrate the full account.
 */
const EXPORT_MAX_AUTH_AGE_MINUTES = 10;

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
  consent: { termsAcceptedAt: string | null; termsVersion: string | null };
  analytics: {
    snapshot: Record<string, unknown> | null;
    recentEvents: Array<Record<string, unknown>>;
  };
  /**
   * Completeness manifest (#3): per-source exported counts + whether the export
   * is complete. `complete:false` means at least one source failed to read or
   * was truncated — the export still succeeds, this just tells the truth.
   */
  manifest: ExportManifest;
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
    requireRecentAuth(user, EXPORT_MAX_AUTH_AGE_MINUTES);
    const tableName = await getBookTableName();
    const analyticsTable = await getBookAnalyticsTableName();

    const url = new URL(req.url);
    const format = url.searchParams.get("format") || "json";
    if (format !== "json" && format !== "csv" && format !== "markdown") {
      throw new BookApiError(400, "invalid_format", "format must be json, csv, or markdown");
    }

    // Reserve one unit of the per-user daily export allowance BEFORE doing the
    // heavy paginated reads, so a runaway/abusive caller is rejected cheaply.
    await enforceDailyUserLimit({
      tableName,
      userPk: bookUserPk(user.sub),
      counterSk: exportLimitSk(dailyLimitDateKey()),
      limit: EXPORT_DAILY_LIMIT,
      entity: "BOOK_EXPORT_COUNT",
      resource: "data exports",
    });

    // Track per-source completeness so the manifest can flag a silently-failed
    // or truncated source (#3). Array sources go through runSource (records
    // read_failed on a thrown read, truncated on a paginated cap); scalar
    // sources go through runScalar so a thrown read is recorded too, instead of
    // a silent `.catch` emitting an indistinguishable null with complete:true.
    const tracker = new ExportSourceTracker();

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
      tracker.runScalar("profile", () => getUserProfileItem(tableName, user.sub), null),
      tracker.runScalar("settings", () => getUserSettingsItem(tableName, user.sub), null),
      tracker.runScalar("entitlement", () => getUserEntitlement(tableName, user.sub), null),
      tracker.runSource("readingDays", () => exportAllReadingDays(tableName, user.sub), []),
      tracker.runSource("bookProgress", () => exportAllProgress(tableName, user.sub), []),
      tracker.runSource("bookStates", () => exportAllBookStates(tableName, user.sub), []),
      tracker.runSource("chapterStates", () => exportAllChapterStates(tableName, user.sub), []),
      tracker.runSource("savedBooks", () => exportAllSavedBooks(tableName, user.sub), []),
      tracker.runSource("badges", () => exportAllBadgeAwards(tableName, user.sub), []),
      tracker.runScalar<{ points: number }>(
        "flowPointsBalance",
        () => getUserFlowPointsState(tableName, user.sub),
        { points: 0 },
      ),
      tracker.runSource(
        "flowPointsLedger",
        () => listAllFlowPointsLedger(tableName, user.sub),
        [],
      ),
      analyticsTable
        ? tracker.runScalar("analyticsSnapshot", () => getUserSnapshot(analyticsTable, user.sub), null)
        : Promise.resolve(null),
      analyticsTable
        ? tracker.runSource(
            "analyticsEvents",
            () => getAllUserEvents(analyticsTable, user.sub),
            [] as Record<string, unknown>[],
          )
        : Promise.resolve([] as Record<string, unknown>[]),
    ]);
    // When analytics isn't configured we never read events/snapshot; record them
    // as complete (empty) sources rather than leaving holes in the manifest.
    if (!analyticsTable) {
      tracker.record({ name: "analyticsSnapshot", count: 0, complete: true });
      tracker.record({ name: "analyticsEvents", count: 0, complete: true });
    }

    // Respect saveReadingHistory privacy preference
    const privacy = settings?.settings?.privacy as
      | { saveReadingHistory?: boolean }
      | undefined;
    const saveReadingHistory = privacy?.saveReadingHistory ?? true;

    const rawProfile = (profile?.profile ?? {}) as Record<string, unknown>;

    const exportedAt = new Date().toISOString();
    const manifest = tracker.build(exportedAt);

    const data: ExportData = {
      exportedAt,
      userId: user.sub,
      profile: profile?.profile ?? null,
      settings: settings?.settings ?? null,
      consent: {
        termsAcceptedAt:
          typeof rawProfile.termsAcceptedAt === "string" ? rawProfile.termsAcceptedAt : null,
        termsVersion:
          typeof rawProfile.termsVersion === "string" ? rawProfile.termsVersion : null,
      },
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
        // Index -> takeaway text, so the export shows the actual bookmarked copy
        // rather than opaque indices (legacy states have only the indices).
        bookmarkedTakeawayTexts:
          (cs.state as Record<string, unknown>)?.bookmarkedTakeawayTexts ?? {},
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
      manifest,
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

// Bookmarked takeaways for one chapter-state record. Prefer the persisted text
// (bookmarkedTakeawayTexts); fall back to the bare numeric indices for legacy
// states that predate the text map.
function bookmarkDisplayValues(cs: Record<string, unknown>): string[] {
  const texts = cs.bookmarkedTakeawayTexts;
  if (texts && typeof texts === "object" && !Array.isArray(texts)) {
    const values = Object.values(texts as Record<string, unknown>).filter(
      (v): v is string => typeof v === "string" && v.trim().length > 0
    );
    if (values.length > 0) return values;
  }
  const indices = cs.bookmarkedTakeaways;
  return Array.isArray(indices) ? indices.map((i) => String(i)) : [];
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
          JSON.stringify(bookmarkDisplayValues(cs)),
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

  // Export Manifest — completeness of every source. Always emitted so a partial
  // export is never mistaken for a complete one.
  sections.push(
    csvSection(
      `Export Manifest (complete=${data.manifest.complete ? "yes" : "no"})`,
      ["Source", "Records", "Complete", "Reason"],
      data.manifest.sources.map((s) => [
        s.name,
        s.count,
        s.complete ? "yes" : "no",
        s.reason ?? "",
      ])
    )
  );

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
      const bookmarkValues = bookmarkDisplayValues(cs);
      if (bookmarkValues.length > 0) {
        lines.push("**Bookmarked Takeaways:**", "");
        for (const value of bookmarkValues) {
          lines.push(`- ${value}`);
        }
        lines.push("");
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
      const evSrc = data.manifest.sources.find((s) => s.name === "analyticsEvents");
      const completeness =
        evSrc && !evSrc.complete ? "PARTIAL — see Export Manifest below" : "complete history";
      lines.push(
        `**Events:** ${data.analytics.recentEvents.length} (most recent first; ${completeness})`,
        ""
      );
    }
  }

  // Export manifest — completeness of every source in this export.
  lines.push("## Export Manifest", "");
  lines.push(`- **Complete:** ${data.manifest.complete ? "yes" : "no"}`);
  if (data.manifest.partialSources.length > 0) {
    lines.push(`- **Incomplete sources:** ${data.manifest.partialSources.join(", ")}`);
    lines.push(
      "",
      "> Some data sources could not be read in full for this export. The data above is still yours, but is partial for the sources listed. Try again later or email support@chapterflow.ca.",
    );
  }
  lines.push("", "| Source | Records | Complete |", "| ------ | ------- | -------- |");
  for (const s of data.manifest.sources) {
    lines.push(`| ${s.name} | ${s.count} | ${s.complete ? "yes" : `no (${s.reason ?? "?"})`} |`);
  }
  lines.push("");

  return lines.join("\n");
}
