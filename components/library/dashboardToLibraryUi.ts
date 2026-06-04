// Maps the production `/api/book/me/dashboard` payload onto the presentational
// `LibraryBook[]` / `UserStats` / `WeeklyChallenge` shapes the library UI
// components consume, so the existing presentational components
// (HeroRecommendation, ActiveReads, CompletedShelf, CuratedSection, BrowseAll,
// WeeklyChallenge) need no changes. This replaces the MOCK_* data path.

import type {
  LibraryCatalogBook,
  LibraryBookEntry,
} from "@/app/book/_lib/library-data";
import {
  buildLibraryBookFromCatalog,
  type LibraryBook,
  type UserStats,
  type WeeklyChallenge,
} from "./libraryData";

/** The subset of the dashboard `entitlement` object the library UI reads. */
export type DashboardEntitlement = {
  plan: "FREE" | "PRO";
  freeBookSlots: number;
  unlockedBookIds: string[];
} | null;

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

export function toUserStats(options: {
  entitlement: DashboardEntitlement;
  entries: LibraryBookEntry[];
  insightPointsBalance: number;
  firstName: string;
}): UserStats {
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
    // TODO: no streak in the dashboard payload — wire /api/book/me/streak later.
    currentStreak: 0,
    streakIsActiveToday: false,
    nextBadge: { name: "Avid Reader", booksAway: Math.max(0, 2 - booksCompleted) },
    isPro,
    freeBooksUsed,
    freeBooksLimit,
  };
}

// TODO: no backend source for a weekly challenge yet — static editorial config.
export const WEEKLY_CHALLENGE: WeeklyChallenge = {
  description: "Start a book in Psychology",
  category: "Psychology",
  reward: { xp: 100, badge: "Explorer" },
  progress: { current: 1, target: 2 },
};
