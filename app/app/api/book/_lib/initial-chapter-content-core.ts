export interface ReadOnlyChapterHydrationEntitlement {
  plan: "FREE" | "PRO";
  unlockedBookIds: string[];
}

export interface ReadOnlyChapterHydrationProgress {
  pinnedBookVersion: number;
  contentPrefix: string;
  unlockedThroughChapterNumber: number;
}

/**
 * A server render may read only a currently-published, already-started chapter.
 * A stale version pin deliberately falls back to the client/API path, which owns
 * the existing version-repoint mutation.
 */
export function isInitialReaderProgressEligible(params: {
  progress: ReadOnlyChapterHydrationProgress | null;
  publishedVersion: number;
  chapterNumber: number;
}): boolean {
  const { progress, publishedVersion, chapterNumber } = params;
  return (
    progress !== null &&
    chapterNumber >= 1 &&
    progress.contentPrefix.trim().length > 0 &&
    progress.pinnedBookVersion === publishedVersion &&
    chapterNumber <= progress.unlockedThroughChapterNumber
  );
}

/**
 * Run an optional chapter-content read only when the current entitlement still
 * grants that book. Progress alone is not proof: a Pro-started book may remain
 * in progress after a downgrade without occupying a Free unlocked slot.
 */
export async function runAuthorizedChapterHydration<T>(params: {
  entitlement: ReadOnlyChapterHydrationEntitlement | null;
  bookId: string;
  load: () => Promise<T>;
}): Promise<T | null> {
  const allowed =
    params.entitlement?.plan === "PRO" ||
    params.entitlement?.unlockedBookIds.includes(params.bookId) === true;
  if (!allowed) return null;
  return params.load();
}
