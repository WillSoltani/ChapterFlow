// Pure maths for Progress "Today's Quests" and the daily goal ring
// (PROG-14, PROG-16, PROG-24).

import type { AnalyticsState, BookProgressSnapshot } from "@/hooks/book/useBookAnalytics";
import type { DailyQuest } from "./progressTypes";
import { localDateKey } from "./review-data-core";

const REVIEW_QUEST_MAX = 5;
/** PROG-22: the spaced-review page. */
export const REVIEW_PAGE_PATH = "/book/progress/review";

const STEP_BEFORE: Record<NonNullable<BookProgressSnapshot["currentLoopStep"]>, number> = {
  summary: 0,
  scenarios: 1,
  quiz: 2,
  unlock: 3,
};

export type QuestAnalytics = Pick<AnalyticsState, "dailyGoalMinutes" | "minutesReadToday" | "readingHistoryOff"> & {
  heatmapCells: Array<Pick<AnalyticsState["heatmapCells"][number], "key" | "chapters">>;
  recentlyOpenedSnapshots: Array<
    { book: { id: string } } & Pick<
      BookProgressSnapshot,
      "resumeChapterNumber" | "currentLoopStep" | "lastActivityAt" | "previousChapterAwaitingFinish"
    >
  >;
};

function chaptersFinishedToday(analytics: QuestAnalytics, todayKey: string): number {
  return analytics.heatmapCells.find((cell) => cell.key === todayKey)?.chapters ?? 0;
}

/** C13: the lead book's resume chapter, or the Library with no book in progress. */
function leadChapterHref(analytics: QuestAnalytics): string {
  const lead = analytics.recentlyOpenedSnapshots[0];
  if (!lead) return "/book/library";
  return `/book/library/${encodeURIComponent(lead.book.id)}/chapter/${lead.resumeChapterNumber}`;
}

/**
 * Today's quests. `dueNow` = review cards due now; `reviewedToday` = cards
 * already reviewed today (they left the due pile, so they still count toward
 * the quest's target).
 */
export function buildDailyQuests(
  analytics: QuestAnalytics,
  dueNow: number,
  todayKey: string,
  reviewedToday = 0
): DailyQuest[] {
  const goal = analytics.dailyGoalMinutes;
  const chapterHref = leadChapterHref(analytics);
  const chaptersToday = chaptersFinishedToday(analytics, todayKey);
  const quests: DailyQuest[] = [
    {
      id: "q1",
      title: `Read for ${goal} minutes`,
      icon: "\u{1F4D6}",
      current: Math.min(analytics.minutesReadToday, goal),
      target: goal,
      type: "progress",
      completed: analytics.minutesReadToday >= goal,
      href: chapterHref,
      historyOff: analytics.readingHistoryOff,
    },
    {
      id: "q2",
      title: "Finish a chapter",
      icon: "\u{1F9E0}",
      current: Math.min(chaptersToday, 1),
      target: 1,
      type: "boolean",
      completed: chaptersToday >= 1,
      href: chapterHref,
    },
  ];
  const reviewTarget = Math.min(REVIEW_QUEST_MAX, Math.max(0, dueNow) + Math.max(0, reviewedToday));
  if (reviewTarget > 0) {
    quests.push({
      id: "q3",
      title: `Review ${reviewTarget} ${reviewTarget === 1 ? "concept" : "concepts"}`,
      icon: "\u{1F504}",
      current: Math.min(reviewedToday, reviewTarget),
      target: reviewTarget,
      type: "progress",
      completed: reviewedToday >= reviewTarget,
      href: REVIEW_PAGE_PATH,
    });
  }
  return quests;
}

/** Ring centre: minutes done ("3m" over "of 10 min"), or "Done!" at the goal. */
export function goalRingCenter(
  completedMinutes: number,
  targetMinutes: number
): { value: string; caption: string } {
  if (targetMinutes > 0 && completedMinutes >= targetMinutes) {
    return { value: "Done!", caption: `${targetMinutes} min goal reached` };
  }
  return { value: `${Math.max(0, completedMinutes)}m`, caption: `of ${targetMinutes} min` };
}

/**
 * Learning steps done today: 4 per chapter finished today, plus the lead
 * book's steps before its current one, only when that book was active today.
 * A chapter whose quiz was passed without "Finish chapter" adds its three
 * steps: Continue already names the next chapter, so they would be lost.
 */
export function stepsCompletedToday(analytics: QuestAnalytics, todayKey: string): number {
  const lead = analytics.recentlyOpenedSnapshots[0];
  const activeToday = lead ? localDateKey(new Date(lead.lastActivityAt)) === todayKey : false;
  const partial =
    activeToday && lead
      ? (lead.previousChapterAwaitingFinish ? 3 : 0) +
        (lead.currentLoopStep ? STEP_BEFORE[lead.currentLoopStep] : 0)
      : 0;
  return chaptersFinishedToday(analytics, todayKey) * 4 + partial;
}
