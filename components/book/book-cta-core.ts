// D4 / C13: where "Continue" goes and what it says, shared by Home, Library and
// the book page so the label and the link always name the same chapter.

export function resumeChapterNumber({
  currentChapterNumber,
  chaptersCompleted,
  chapterCount,
}: {
  currentChapterNumber?: number | null | undefined;
  chaptersCompleted: number;
  chapterCount: number;
}): number {
  const next =
    typeof currentChapterNumber === "number" && Number.isFinite(currentChapterNumber)
      ? currentChapterNumber
      : chaptersCompleted + 1;
  return Math.max(1, Math.min(Math.round(next), Math.max(1, chapterCount)));
}

/** Chapter link by number; the chapter page resolves the number to the chapter. */
export function continueHref(bookId: string, chapterNumber: number): string {
  return `/book/library/${encodeURIComponent(bookId)}/chapter/${chapterNumber}`;
}

/** Review book / Continue chapter N / Start chapter N (HOME-10). */
export function bookCtaLabel(
  chapterNumber: number,
  { allCompleted = false, started = true }: { allCompleted?: boolean; started?: boolean } = {},
): string {
  if (allCompleted) return "Review book";
  return started ? `Continue chapter ${chapterNumber}` : `Start chapter ${chapterNumber}`;
}

const MIN_DAILY_GOAL_MINUTES = 5;

function positiveMinutes(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * C10: the daily goal (minutes) from a `/me/settings` payload's `settings`:
 * `extended.dailyGoalPreset` → `dailyGoal` → `onboarding.dailyGoal` → fallback.
 * Never below 5.
 */
export function dailyGoalFromSettings(settings: unknown, fallback: number): number {
  const root = asRecord(settings);
  const goal =
    positiveMinutes(asRecord(root?.extended)?.dailyGoalPreset) ??
    positiveMinutes(root?.dailyGoal) ??
    positiveMinutes(asRecord(root?.onboarding)?.dailyGoal) ??
    positiveMinutes(fallback) ??
    MIN_DAILY_GOAL_MINUTES;
  return Math.max(MIN_DAILY_GOAL_MINUTES, goal);
}

/** HOME-24: days to finish the minutes still left at the daily goal, at least 1. */
export function daysAtGoal({
  estimatedMinutes,
  progressPercent,
  goalMinutes,
}: {
  estimatedMinutes: number;
  progressPercent: number;
  goalMinutes: number;
}): number {
  const left =
    (Math.max(0, estimatedMinutes) * (100 - Math.min(100, Math.max(0, progressPercent)))) / 100;
  const goal = Math.max(MIN_DAILY_GOAL_MINUTES, goalMinutes);
  return Math.max(1, Math.ceil(left / goal));
}
