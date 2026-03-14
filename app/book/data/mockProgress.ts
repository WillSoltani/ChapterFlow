import { BOOKS_CATALOG } from "@/app/book/data/booksCatalog";
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
  currentChapter: number
): SessionTask[] {
  return [
    {
      id: "review",
      label: "Review last chapter",
      minutes: 4,
      complete: false,
    },
    {
      id: "read",
      label: `Read Chapter ${currentChapter}`,
      minutes: 10,
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
      label: "1-min recap",
      minutes: 1,
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
