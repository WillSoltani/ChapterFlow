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
