// Maps the production `/api/book/me/dashboard` payload onto the presentational
// `LibraryBook[]` / `UserStats` / `WeeklyChallenge` shapes the library UI
// components consume, so the existing presentational components
// (HeroRecommendation, ActiveReads, CompletedShelf, CuratedSection, BrowseAll,
// WeeklyChallenge) need no changes. This replaces the MOCK_* data path.

import type {
  LibraryCatalogBook,
  LibraryBookEntry,
} from "@/lib/library-data";
import type { DashboardEntitlement } from "@/lib/dashboard-contracts";
import {
  buildLibraryBookFromCatalog,
  type LibraryBook,
  type UserStats,
  type WeeklyChallenge,
} from "./libraryData";

export type { DashboardEntitlement } from "@/lib/dashboard-contracts";

export function toLibraryBooks(
  catalog: LibraryCatalogBook[],
  entries: LibraryBookEntry[],
): LibraryBook[] {
  const entryByBook = new Map(entries.map((entry) => [entry.id, entry]));
  return catalog.map((book) =>
    buildLibraryBookFromCatalog(book, entryByBook.get(book.id)),
  );
}

function deriveLevel(xp: number): { level: number; xpToNextLevel: number } {
  // TODO: no backend "level" source yet — derive deterministically from the
  // insight-points balance until a tier/level endpoint is wired.
  const level = Math.max(1, Math.floor(xp / 500) + 1);
  return { level, xpToNextLevel: level * 500 };
}

// The dashboard payload has no streak or next-badge source, so toUserStats()
// only produces the fields backed by real data. We omit currentStreak /
// streakIsActiveToday / nextBadge rather than emit fabricated constants (a
// hardcoded "streak 0" / "Avid Reader, N to go" would be wrong for every user
// and a trap for any future consumer). Wire them through here once a real
// /api/book/me/streak (and a tier/badge endpoint) exists.
export type LibraryUserStats = Omit<
  UserStats,
  "currentStreak" | "streakIsActiveToday" | "nextBadge"
>;

export function toUserStats(options: {
  entitlement: DashboardEntitlement;
  entries: LibraryBookEntry[];
  insightPointsBalance: number;
  firstName: string;
}): LibraryUserStats {
  const { entitlement, entries, insightPointsBalance, firstName } = options;
  const booksCompleted = entries.filter((entry) => entry.status === "completed").length;
  const isPro = entitlement?.plan === "PRO";
  const freeBooksLimit = entitlement?.freeBookSlots ?? 2;
  const freeBooksUsed = Math.min(
    freeBooksLimit,
    entitlement?.unlockedBookIds?.length ?? 0,
  );
  const xp = Math.max(0, insightPointsBalance | 0);
  const { level, xpToNextLevel } = deriveLevel(xp);

  return {
    firstName: firstName || "Reader",
    level,
    xp,
    xpToNextLevel,
    booksCompleted,
    isPro,
    freeBooksUsed,
    freeBooksLimit,
  };
}

// Static editorial nudge — no backend source. Honest: just a category to
// explore (no fabricated reward/progress; see WeeklyChallenge type).
export const WEEKLY_CHALLENGE: WeeklyChallenge = {
  description: "Start a book in Psychology",
  category: "Psychology",
};
