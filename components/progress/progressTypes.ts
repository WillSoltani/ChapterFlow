import type { ServerTier } from "@/hooks/book/useServerTier";

export type LearningStep = "summary" | "scenarios" | "quiz" | "unlock";
export type StepNumber = 1 | 2 | 3 | 4;
export type QuestType = "progress" | "boolean";

export interface ProgressUser {
  name: string;
  /** Server tier pill; null while the tier read is pending or failed. */
  tier: TierPill | null;
  insightPoints: number;
  isPro: boolean;
}

export interface TierPill {
  label: string;
  /** 0-100: loops toward the next tier (100 at the top tier). */
  percent: number;
  nextLabel: string | null;
}

function isServerTier(tier: ServerTier | null | undefined): tier is ServerTier {
  return Boolean(tier && typeof tier.currentTierDisplay === "string" && tier.currentTierDisplay);
}

/** The Progress level pill from GET /me/tier, or null (hide the pill). */
export function tierPill(tier: ServerTier | null | undefined): TierPill | null {
  if (!isServerTier(tier)) return null;
  const next = tier.nextTier ?? null;
  const raw = next ? Number(next.loopsPercent) : 100;
  const percent = Number.isFinite(raw) ? Math.min(100, Math.max(0, Math.round(raw))) : 0;
  return { label: tier.currentTierDisplay, percent, nextLabel: next?.displayName ?? null };
}

export type TierLadderStatus = "passed" | "current" | "next" | "ahead";

export interface TierIdentity {
  displayName: string;
  identityStatement: string;
  nextTier: ServerTier["nextTier"];
  ladder: Array<ServerTier["tiers"][number] & { status: TierLadderStatus }>;
}

/** The Profile identity from GET /me/tier, or null (hide it). */
export function tierIdentity(tier: ServerTier | null | undefined): TierIdentity | null {
  if (!isServerTier(tier) || !Array.isArray(tier.tiers)) return null;
  const currentIdx = tier.tiers.findIndex((t) => t.name === tier.currentTier);
  if (currentIdx < 0) return null;
  const current = tier.tiers[currentIdx]!;
  return {
    displayName: tier.currentTierDisplay,
    identityStatement: current.identityStatement,
    nextTier: tier.nextTier ?? null,
    ladder: tier.tiers.map((t, i) => ({
      ...t,
      status: i < currentIdx ? "passed" : i === currentIdx ? "current" : i === currentIdx + 1 ? "next" : "ahead",
    })),
  };
}

export interface TodayGoal {
  targetMinutes: number;
  completedMinutes: number;
  stepsCompletedToday: number;
  totalStepsToday: number;
}

export interface StreakData {
  currentDays: number;
  bestDays: number;
  lastActiveDate: string;
  freezesEquipped: number;
  freezesAvailable: number;
  consistencyLast30Days: number;
  daysActiveLast7: number;
  /** Streak alive through yesterday, nothing read yet today (analytics.streakAtRisk). */
  atRisk: boolean;
}

export interface WeekSummaryData {
  timeReadMinutes: number;
  previousWeekMinutes: number;
  chaptersCompleted: number;
  previousWeekChapters: number;
  quizAccuracy: number | null;
  previousWeekQuizAccuracy: number | null;
  weekStartDate: string;
}

export interface ActiveBook {
  id: string;
  title: string;
  author: string;
  coverUrl: string;
  totalChapters: number;
  completedChapters: number;
  currentChapterNumber: number;
  currentChapterTitle: string;
  currentStep: LearningStep;
  currentStepNumber: StepNumber;
  lastActivity: string;
  lastActivityDate: string;
  readersCount: number;
  resumeChapterId: string;
}

export interface CompletedBook {
  id: string;
  title: string;
  author: string;
  coverUrl: string;
  totalChapters: number;
  completedDate: string;
  avgQuizScore: number;
}

export interface DailyQuest {
  id: string;
  title: string;
  icon: string;
  current: number;
  target: number;
  type: QuestType;
  completed: boolean;
  /** Minutes quest while Settings "Save reading history" is off (PROG-26). */
  historyOff?: boolean;
  /** Where tapping the quest goes (C13 resume chapter for quests 1 and 2). */
  href?: string;
}

export interface ReviewData {
  overdueCount: number;
  /** Due today and already reviewable (dueAt <= now). */
  dueTodayCount: number;
  /** Due later today; not reviewable yet. */
  laterTodayCount: number;
  upcomingThisWeekCount: number;
  totalConceptsLearned: number;
  forecast: Array<{ date: string; count: number }>;
}

export interface ReadingDay {
  date: string;
  minutes: number;
  chapters: number;
}

export interface HourlyReading {
  hour: number;
  minutes: number;
}

export interface ReadingActivityData {
  days: ReadingDay[];
  totalDaysWithData: number;
  /** Hourly minutes recorded on this device only. */
  todayHourly: HourlyReading[];
  /** Today's total from the account (every device). */
  todayMinutes: number;
}

export interface Milestone {
  id: string;
  name: string;
  icon: string;
  description: string;
  current: number;
  target: number;
}

export interface ProgressPageData {
  user: ProgressUser;
  todayGoal: TodayGoal;
  streak: StreakData;
  weekSummary: WeekSummaryData;
  activeBooks: ActiveBook[];
  completedBooks: CompletedBook[];
  dailyQuests: DailyQuest[];
  reviews: ReviewData;
  readingActivity: ReadingActivityData;
  nextMilestones: Milestone[];
  /** Settings "Save reading history" is off (PROG-26). */
  readingHistoryOff: boolean;
}
