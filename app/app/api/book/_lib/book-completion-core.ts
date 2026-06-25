import type { BookManifest } from "./types";

/**
 * Resolve the chapter count to judge whole-book completion against.
 *
 * Completion must be measured against the user's PINNED book version, not the
 * live catalog version. The catalog can advance to a different chapterCount
 * after a user starts a book — each user's pin stays frozen (see
 * ensure-book-started.ts / BookUserProgress.pinnedBookVersion). Mixing the
 * pinned `completedChapters` with the live catalog's chapterCount would either
 * miss-credit a finished pinned-version reader (catalog grew) or falsely flag
 * completion mid-book (catalog shrank).
 *
 * The live manifest is reused when the pin matches it, so the common
 * never-republished case costs no extra S3 read; the pinned manifest is only
 * fetched when the versions actually diverge.
 */
export async function resolvePinnedChapterCount(params: {
  pinnedBookVersion: number;
  liveVersion: number;
  liveManifest: Pick<BookManifest, "chapterCount">;
  readPinnedManifest: () => Promise<Pick<BookManifest, "chapterCount">>;
}): Promise<number> {
  if (params.pinnedBookVersion === params.liveVersion) {
    return params.liveManifest.chapterCount;
  }
  const pinned = await params.readPinnedManifest();
  return pinned.chapterCount;
}

/**
 * Decide whole-book completion for a single progress row.
 *
 * EXACT path (`chapterCount` known): the book is complete iff every authored
 * chapter has been finished (`completedChapters.length >= chapterCount`). This
 * handles out-of-order completion and is the only way to know "done" for sure.
 *
 * UNKNOWN path (`chapterCount` undefined — e.g. a transient manifest-read
 * failure): completion is genuinely unknowable, so we return `false` rather than
 * guess. The legacy fallback heuristic
 *   `completedChapters.length > 0 && currentChapterNumber <= completedChapters.length`
 * was structurally broken: `buildProgressAfterQuizPass` always sets
 * `currentChapterNumber = max(current, chapterNumber + 1)`, so after a reader
 * sequentially finishes the final chapter N, `currentChapterNumber === N + 1`
 * while `completedChapters.length === N`, making `N + 1 <= N` false — a fully
 * read book could NEVER report as completed. We don't substitute a different
 * count-free guess (none is correct: without the total, "on the last chapter"
 * and "finished the book" are indistinguishable). Callers should supply the
 * pinned chapter count; this only fires on a read failure, where under-counting
 * completions is the safe, non-misleading default.
 */
export function isBookCompleted(
  progress: { completedChapters: number[]; currentChapterNumber: number },
  chapterCount: number | undefined
): boolean {
  if (chapterCount === undefined) return false;
  return progress.completedChapters.length >= chapterCount;
}

/**
 * Build a `bookId -> chapterCount` map by reading each progress row's PINNED
 * manifest, for feeding `summarizeProgress`. Pure: the actual S3 read is injected
 * as `readManifestChapterCount`, so the de-dupe / best-effort / validity logic is
 * unit-testable without `server-only`.
 *
 * - Rows with no `manifestKey` are skipped.
 * - Manifest keys are de-duped so two rows sharing one pinned manifest cause one
 *   read.
 * - A read that throws or yields a non-positive/NaN count omits that book from
 *   the map (completion stays uncredited — the safe default; see isBookCompleted)
 *   rather than failing the whole summary.
 */
export async function buildPinnedChapterCountMap(params: {
  entries: Array<{ bookId: string; manifestKey: string }>;
  readManifestChapterCount: (manifestKey: string) => Promise<number>;
}): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  const seenKeys = new Set<string>();
  const reads = params.entries
    .filter((entry) => {
      if (!entry.manifestKey) return false;
      if (seenKeys.has(entry.manifestKey)) return false;
      seenKeys.add(entry.manifestKey);
      return true;
    })
    .map(async (entry) => {
      try {
        const count = await params.readManifestChapterCount(entry.manifestKey);
        if (typeof count === "number" && Number.isFinite(count) && count > 0) {
          counts.set(entry.bookId, count);
        }
      } catch {
        // Omit this book — completion stays uncredited rather than failing the
        // whole /me/progress summary on one bad read.
      }
    });
  await Promise.all(reads);
  return counts;
}
