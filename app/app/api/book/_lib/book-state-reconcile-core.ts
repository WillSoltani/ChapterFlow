import type { BookUserBookStateItem, BookUserProgress } from "./types";

// The BOOK_USER_BOOK_STATE projection is refreshed only when a client PATCHes
// it, but which chapters are completed and unlocked (and their best scores) is
// decided by the quiz-pass path on BOOK_PROGRESS. These helpers map that
// progress row onto chapter ids so every read reports the same truth.

export type ProgressProjectionSource = Pick<
  BookUserProgress,
  "completedChapters" | "unlockedThroughChapterNumber" | "bestScoreByChapter"
>;

export type ProgressProjection = Pick<
  BookUserBookStateItem,
  "completedChapterIds" | "unlockedChapterIds" | "chapterScores"
>;

export function projectProgressToChapterIds(
  progress: ProgressProjectionSource | null,
  chapters: ReadonlyArray<{ number: number; chapterId: string }>
): ProgressProjection {
  const chapterIdByNumber = new Map(
    chapters.map((chapter) => [chapter.number, chapter.chapterId])
  );
  const firstChapterId = chapters[0]?.chapterId ?? "";
  const unlockedThrough = progress?.unlockedThroughChapterNumber ?? 1;
  const unlockedChapterIds = chapters
    .filter((chapter) => chapter.number <= unlockedThrough)
    .map((chapter) => chapter.chapterId);
  return {
    completedChapterIds: (progress?.completedChapters ?? [])
      .map((number) => chapterIdByNumber.get(number) ?? "")
      .filter(Boolean),
    unlockedChapterIds: unlockedChapterIds.length
      ? unlockedChapterIds
      : firstChapterId
        ? [firstChapterId]
        : [],
    chapterScores: Object.fromEntries(
      Object.entries(progress?.bestScoreByChapter ?? {})
        .map(([chapterNumber, score]) => {
          const chapterId = chapterIdByNumber.get(Number(chapterNumber));
          return chapterId ? [chapterId, score] : null;
        })
        .filter((entry): entry is [string, number] => Boolean(entry))
    ),
  };
}

/**
 * Replace the stored projection's completed / unlocked / score fields with the
 * values derived from the progress row. The reader's own UI fields (cursor,
 * completion stamps, timestamps) are kept. Without a progress row or a chapter
 * list there is nothing to derive from, so the stored state is returned as is.
 */
export function overlayProgressOnBookState(
  state: BookUserBookStateItem,
  progress: ProgressProjectionSource | null,
  chapters: ReadonlyArray<{ number: number; chapterId: string }>
): BookUserBookStateItem {
  if (!progress || chapters.length === 0) return state;
  return { ...state, ...projectProgressToChapterIds(progress, chapters) };
}
