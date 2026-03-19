import { BOOKS_CATALOG } from "@/app/book/data/booksCatalog";
import {
  type ChapterStartMode,
  type PreferredExampleContext,
  getExampleContextTaskLabel,
} from "@/app/book/_lib/onboarding-personalization";
import { getBookChaptersBundle } from "@/app/book/data/mockChapters";

export type BookStatus = "completed" | "in_progress" | "not_started";

export type RecentBookProgress = {
  bookId: string;
  status: BookStatus;
  progressPercent: number;
  chapter: number;
  resumeChapterId: string;
  totalChapters: number;
  lastOpenedAt: string;
};

export type SessionTask = {
  id: string;
  label: string;
  minutes: number;
  complete: boolean;
};

export type BadgeItem = {
  id: string;
  name: string;
  description: string;
  icon: string;
  earned: boolean;
};

export type DailyInsight = {
  takeaway: string;
  action: string;
};

export const QUICK_REVIEW_PROMPTS = [
  "What one social habit from this chapter can you use today?",
  "Which example feels most realistic for your current week?",
  "What follow-up question would make your next conversation better?",
];

export function buildRecentBooks(selectedBookIds: string[]): RecentBookProgress[] {
  const selected = selectedBookIds.filter((id) =>
    BOOKS_CATALOG.some((book) => book.id === id)
  );
  const fallback = BOOKS_CATALOG.map((book) => book.id).filter((id) => !selected.includes(id));
  const ordered = [...selected, ...fallback].slice(0, 5);

  return ordered.map((bookId) => {
    const chapters = getBookChaptersBundle(bookId).chapters;
    const totalChapters = Math.max(1, chapters.length);
    return {
      bookId,
      status: "not_started",
      progressPercent: 0,
      chapter: 1,
      resumeChapterId: chapters[0]?.id ?? "",
      totalChapters,
      lastOpenedAt: "Not started",
    };
  });
}

export function buildTodaySessionTasks(
  currentChapter: number,
  options?: {
    chapterStartMode?: ChapterStartMode;
    preferredExampleContext?: PreferredExampleContext;
  }
): SessionTask[] {
  const chapterStartMode = options?.chapterStartMode ?? "balanced";
  const preferredExampleContext = options?.preferredExampleContext ?? "all";

  if (chapterStartMode === "summary-first") {
    return [
      {
        id: "summary",
        label: `Read the main point for Chapter ${currentChapter}`,
        minutes: 7,
        complete: false,
      },
      {
        id: "examples",
        label: getExampleContextTaskLabel(preferredExampleContext),
        minutes: 4,
        complete: false,
      },
      {
        id: "quiz",
        label: `Take the Chapter ${currentChapter} quiz`,
        minutes: 5,
        complete: false,
      },
      {
        id: "recap",
        label: "Capture one takeaway you can use today",
        minutes: 2,
        complete: false,
      },
    ];
  }

  if (chapterStartMode === "practical-first") {
    return [
      {
        id: "examples",
        label: getExampleContextTaskLabel(preferredExampleContext),
        minutes: 5,
        complete: false,
      },
      {
        id: "summary",
        label: `Read the core idea for Chapter ${currentChapter}`,
        minutes: 6,
        complete: false,
      },
      {
        id: "quiz",
        label: `Check your understanding in the quiz`,
        minutes: 5,
        complete: false,
      },
      {
        id: "recap",
        label: "Write one real-world move you want to try",
        minutes: 2,
        complete: false,
      },
    ];
  }

  return [
    {
      id: "review",
      label: "Review last chapter",
      minutes: 4,
      complete: false,
    },
    {
      id: "summary",
      label: `Read the main idea for Chapter ${currentChapter}`,
      minutes: 10,
      complete: false,
    },
    {
      id: "examples",
      label: getExampleContextTaskLabel(preferredExampleContext),
      minutes: 4,
      complete: false,
    },
    {
      id: "quiz",
      label: `Chapter ${currentChapter} quiz`,
      minutes: 5,
      complete: false,
    },
    {
      id: "recap",
      label: "Note one takeaway to keep",
      minutes: 2,
      complete: false,
    },
  ];
}

export function buildBadges(streakDays: number): BadgeItem[] {
  return [
    {
      id: "first-chapter",
      name: "First Chapter",
      description: "Finish your first chapter summary and quiz.",
      icon: "📘",
      earned: false,
    },
    {
      id: "7-day-streak",
      name: "7-Day Streak",
      description: "Read for seven days in a row.",
      icon: "🔥",
      earned: streakDays >= 7,
    },
    {
      id: "first-book",
      name: "First Book",
      description: "Complete your first book from start to finish.",
      icon: "🏁",
      earned: false,
    },
    {
      id: "perfect-score",
      name: "Perfect Score",
      description: "Get 100% on a chapter quiz.",
      icon: "💯",
      earned: false,
    },
    {
      id: "scholar",
      name: "Scholar",
      description: "Complete five books with quizzes.",
      icon: "🎓",
      earned: false,
    },
    {
      id: "consistency",
      name: "Consistency Pro",
      description: "Hit your daily goal for 30 days.",
      icon: "⏱️",
      earned: false,
    },
  ];
}

export function buildDailyInsight(bookTitle: string): DailyInsight {
  return {
    takeaway: `Today's takeaway from ${bookTitle}: low-pressure repetition builds social confidence faster than trying to perform perfectly.`,
    action:
      "Try one simple context opener today, then stay on the same topic with a real follow-up question.",
  };
}
