// Pure journey reconciliation policy (no AWS imports, unit-testable). The repo
// wires the reads/writes in journey-repo.ts `reconcileJourneyCompletedBooks`.

import { isBookCompleted } from "./book-completion-core";

export type JourneyAdvancementResult = {
  journeyId: string;
  advanced: boolean;
  completed: boolean;
  bonusIPAwarded: number;
  badgeAwarded: string | null;
};

export interface JourneyReconcileDeps {
  /** Progress rows for the given books (books never started are simply absent). */
  readProgress: (bookIds: string[]) => Promise<
    Array<{
      bookId: string;
      completedChapters: number[];
      currentChapterNumber: number;
      manifestKey: string;
    }>
  >;
  /** bookId -> pinned chapter count; a book missing from the map is never credited. */
  readChapterCounts: (
    entries: Array<{ bookId: string; manifestKey: string }>
  ) => Promise<Map<string, number>>;
  /**
   * Credit one book to the journey. Idempotent: null when it was already
   * credited. `completedAt` is set only on the call that completed the journey.
   */
  advance: (bookId: string) => Promise<{ completedAt: string | null } | null>;
  /** The journey's completion award (bonus points + badge). */
  awardCompletion: () => Promise<{ bonusIPAwarded: number; badgeAwarded: string | null }>;
}

export function pendingJourneyBookIds(
  def: { books: Array<{ bookId: string }> },
  completedBookIds: string[]
): string[] {
  const done = new Set(completedBookIds);
  return def.books.map((b) => b.bookId).filter((id) => !done.has(id));
}

/**
 * Credit every journey book the reader has already finished but the journey has
 * not counted yet, and run the completion award when that finishes the journey.
 * Returns null when nothing new was credited.
 */
export async function reconcileJourneyCore(
  deps: JourneyReconcileDeps,
  journey: { journeyId: string; completedBookIds: string[]; completedAt: string | null },
  def: { books: Array<{ bookId: string }> }
): Promise<JourneyAdvancementResult | null> {
  if (journey.completedAt) return null;
  const pending = pendingJourneyBookIds(def, journey.completedBookIds ?? []);
  if (pending.length === 0) return null;

  const rows = (await deps.readProgress(pending)).filter((r) => r.manifestKey);
  if (rows.length === 0) return null;
  const counts = await deps.readChapterCounts(
    rows.map((r) => ({ bookId: r.bookId, manifestKey: r.manifestKey }))
  );
  const finished = rows
    .filter((r) => isBookCompleted(r, counts.get(r.bookId)))
    .map((r) => r.bookId);

  let advanced = false;
  let completed = false;
  for (const bookId of finished) {
    const updated = await deps.advance(bookId);
    if (!updated) continue;
    advanced = true;
    if (updated.completedAt) completed = true;
  }
  if (!advanced) return null;

  const award = completed
    ? await deps.awardCompletion()
    : { bonusIPAwarded: 0, badgeAwarded: null };
  return {
    journeyId: journey.journeyId,
    advanced: true,
    completed,
    ...award,
  };
}

/** One result per journey: combine the direct advance and the reconcile pass. */
export function mergeJourneyResults(
  results: JourneyAdvancementResult[]
): JourneyAdvancementResult[] {
  const byId = new Map<string, JourneyAdvancementResult>();
  for (const r of results) {
    const prev = byId.get(r.journeyId);
    byId.set(
      r.journeyId,
      prev
        ? {
            journeyId: r.journeyId,
            advanced: prev.advanced || r.advanced,
            completed: prev.completed || r.completed,
            bonusIPAwarded: prev.bonusIPAwarded + r.bonusIPAwarded,
            badgeAwarded: prev.badgeAwarded ?? r.badgeAwarded,
          }
        : r
    );
  }
  return [...byId.values()];
}
