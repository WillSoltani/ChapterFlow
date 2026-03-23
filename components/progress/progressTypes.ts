export type ReaderLevel =
  | "Curious Reader"
  | "Active Learner"
  | "Knowledge Builder"
  | "Thought Leader";

export type LearningStep = "summary" | "scenarios" | "quiz" | "unlock";
export type StepNumber = 1 | 2 | 3 | 4;
export type QuestType = "progress" | "boolean";

export interface ProgressUser {
  name: string;
  readerLevel: ReaderLevel;
  readerLevelProgress: number; // 0-100 toward next level
  flowPoints: number;
  isPro: boolean;
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
}

export interface ReviewData {
  overdueCount: number;
  dueTodayCount: number;
  upcomingThisWeekCount: number;
  totalConceptsLearned: number;
  forecast: Array<{ date: string; count: number }>;
}

export interface ReadingDay {
  date: string;
  minutes: number;
  chapters: number;
}

export interface ReadingActivityData {
  days: ReadingDay[];
  totalDaysWithData: number;
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
  questBonusFP: number;
  reviews: ReviewData;
  readingActivity: ReadingActivityData;
  nextMilestones: Milestone[];
}
