import type { BookManifest, BookManifestChapter } from "./types";

/**
 * Resolve the chapter list a reader's progress NUMBERS
 * (completedChapters / currentChapterNumber / unlockedThroughChapterNumber /
 * bestScoreByChapter) must be mapped through to chapterIds.
 *
 * Progress is version-PINNED (see ensure-book-started.ts /
 * BookUserProgress.pinnedBookVersion + manifestKey + contentPrefix): the
 * catalog can advance to a different chapter list AFTER a user started a book,
 * but each user's pin stays frozen so a mid-read catalog advance can't diverge
 * their view. The chapter-number → chapterId mapping therefore MUST come from
 * the version the reader is pinned to — NOT the latest published manifest —
 * or a republish that reorders/renames chapters silently mis-maps a reader's
 * completed/unlocked chapters onto the wrong ids.
 *
 * The live (latest published) manifest is reused when the pin matches it, so
 * the common never-republished case costs no extra S3 read; the pinned manifest
 * is only fetched when the versions actually diverge. When there is no progress
 * row (never-started reader) the caller passes `pinnedBookVersion: null` and we
 * fall back to the live manifest's chapters — there is nothing pinned yet.
 *
 * Mirrors `resolvePinnedChapterCount` (book-completion-core.ts), which applies
 * the identical pin-vs-live reasoning to whole-book completion.
 */
export async function resolvePinnedManifestChapters(params: {
  /** The reader's pinned version, or null when no progress row exists. */
  pinnedBookVersion: number | null;
  liveVersion: number;
  liveManifest: Pick<BookManifest, "chapters">;
  readPinnedManifest: () => Promise<Pick<BookManifest, "chapters">>;
}): Promise<BookManifestChapter[]> {
  if (
    params.pinnedBookVersion === null ||
    params.pinnedBookVersion === params.liveVersion
  ) {
    return params.liveManifest.chapters;
  }
  const pinned = await params.readPinnedManifest();
  return pinned.chapters;
}
