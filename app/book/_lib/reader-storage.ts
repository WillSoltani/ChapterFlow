"use client";

export type StoredBookProgressSnapshot = {
  currentChapterId: string;
  completedChapterIds: string[];
  unlockedChapterIds: string[];
  chapterScores: Record<string, number>;
  chapterCompletedAt: Record<string, string>;
  lastReadChapterId: string;
  lastOpenedAt: string;
};

export type StoredReaderStateSnapshot = {
  activeTab: "summary" | "examples" | "quiz";
  readingDepth: "simple" | "standard" | "deeper";
  exampleFilter: "all" | "work" | "school" | "personal";
  quizAnswers: Record<string, number>;
  quizResult: { score: number; passed: boolean } | null;
  quizRetakeCount: number;
  quizFailureStreak: number;
  quizCooldownUntil: string | null;
  notes: string;
  focusMode: boolean;
  fontScale: "sm" | "md" | "lg";
  showRecap: boolean;
  explanationOpen: Record<string, boolean>;
};

export const BOOK_PROGRESS_STORAGE_PREFIX = "book-accelerator:book-progress:v3";
export const CHAPTER_READER_STORAGE_PREFIX = "book-accelerator:chapter-reader:v1";

export function getBookProgressStorageKey(bookId: string) {
  return `${BOOK_PROGRESS_STORAGE_PREFIX}:${bookId}`;
}

export function getChapterReaderStorageKey(bookId: string, chapterId: string) {
  return `${CHAPTER_READER_STORAGE_PREFIX}:${bookId}:${chapterId}`;
}

function isValidTimestamp(value: string): boolean {
  return Number.isFinite(new Date(value).getTime());
}

export function parseStoredBookProgress(
  raw: string | null
): StoredBookProgressSnapshot | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredBookProgressSnapshot>;
    return {
      currentChapterId:
        typeof parsed.currentChapterId === "string" ? parsed.currentChapterId : "",
      completedChapterIds: Array.isArray(parsed.completedChapterIds)
        ? parsed.completedChapterIds.filter(
            (value): value is string => typeof value === "string"
          )
        : [],
      unlockedChapterIds: Array.isArray(parsed.unlockedChapterIds)
        ? parsed.unlockedChapterIds.filter(
            (value): value is string => typeof value === "string"
          )
        : [],
      chapterScores:
        parsed.chapterScores && typeof parsed.chapterScores === "object"
          ? Object.fromEntries(
              Object.entries(parsed.chapterScores).filter(
                ([chapterId, score]) =>
                  typeof chapterId === "string" && Number.isFinite(Number(score))
              )
            )
          : {},
      chapterCompletedAt:
        parsed.chapterCompletedAt && typeof parsed.chapterCompletedAt === "object"
          ? Object.fromEntries(
              Object.entries(parsed.chapterCompletedAt).filter(
                ([chapterId, completedAt]) =>
                  typeof chapterId === "string" &&
                  typeof completedAt === "string" &&
                  completedAt.trim() &&
                  isValidTimestamp(completedAt)
              )
            )
          : {},
      lastReadChapterId:
        typeof parsed.lastReadChapterId === "string" ? parsed.lastReadChapterId : "",
      lastOpenedAt:
        typeof parsed.lastOpenedAt === "string" && parsed.lastOpenedAt.trim()
          ? parsed.lastOpenedAt
          : new Date(0).toISOString(),
    };
  } catch {
    return null;
  }
}

export function parseStoredReaderState(
  raw: string | null
): StoredReaderStateSnapshot | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredReaderStateSnapshot>;
    return {
      activeTab:
        parsed.activeTab === "summary" ||
        parsed.activeTab === "examples" ||
        parsed.activeTab === "quiz"
          ? parsed.activeTab
          : "summary",
      readingDepth:
        parsed.readingDepth === "simple" ||
        parsed.readingDepth === "standard" ||
        parsed.readingDepth === "deeper"
          ? parsed.readingDepth
          : "deeper",
      exampleFilter:
        parsed.exampleFilter === "all" ||
        parsed.exampleFilter === "personal" ||
        parsed.exampleFilter === "school" ||
        parsed.exampleFilter === "work"
          ? parsed.exampleFilter
          : "all",
      quizAnswers:
        parsed.quizAnswers && typeof parsed.quizAnswers === "object"
          ? Object.fromEntries(
              Object.entries(parsed.quizAnswers).filter(
                ([questionId, answer]) =>
                  typeof questionId === "string" && Number.isFinite(Number(answer))
              )
            )
          : {},
      quizResult:
        parsed.quizResult && typeof parsed.quizResult === "object"
          ? {
              score: Number(parsed.quizResult.score ?? 0),
              passed: Boolean(parsed.quizResult.passed),
            }
          : null,
      quizRetakeCount:
        typeof parsed.quizRetakeCount === "number" &&
        Number.isFinite(parsed.quizRetakeCount) &&
        parsed.quizRetakeCount >= 0
          ? Math.floor(parsed.quizRetakeCount)
          : 0,
      quizFailureStreak:
        typeof parsed.quizFailureStreak === "number" &&
        Number.isFinite(parsed.quizFailureStreak) &&
        parsed.quizFailureStreak >= 0
          ? Math.floor(parsed.quizFailureStreak)
          : 0,
      quizCooldownUntil:
        typeof parsed.quizCooldownUntil === "string" && parsed.quizCooldownUntil.trim()
          ? parsed.quizCooldownUntil
          : null,
      notes: typeof parsed.notes === "string" ? parsed.notes : "",
      focusMode:
        typeof parsed.focusMode === "boolean" ? parsed.focusMode : false,
      fontScale:
        parsed.fontScale === "sm" ||
        parsed.fontScale === "md" ||
        parsed.fontScale === "lg"
          ? parsed.fontScale
          : "md",
      showRecap:
        typeof parsed.showRecap === "boolean" ? parsed.showRecap : false,
      explanationOpen:
        parsed.explanationOpen && typeof parsed.explanationOpen === "object"
          ? Object.fromEntries(
              Object.entries(parsed.explanationOpen).filter(
                ([questionId, open]) =>
                  typeof questionId === "string" && typeof open === "boolean"
              )
            )
          : {},
    };
  } catch {
    return null;
  }
}
