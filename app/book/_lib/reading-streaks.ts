"use client";

const STORAGE_KEY = "book-accelerator:streak:v1";

export type StreakState = {
  currentStreak: number;
  longestStreak: number;
  lastQuizPassDate: string | null; // YYYY-MM-DD
  freezesRemaining: number;
  weekStartDate: string; // Monday YYYY-MM-DD
};

const DEFAULT_STATE: StreakState = {
  currentStreak: 0,
  longestStreak: 0,
  lastQuizPassDate: null,
  freezesRemaining: 2,
  weekStartDate: getMonday(new Date()),
};

function toDateString(date: Date): string {
  return date.toISOString().split("T")[0];
}

function getMonday(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return toDateString(d);
}

function daysBetween(from: string, to: string): number {
  const msPerDay = 86400000;
  return Math.round(
    (new Date(to).getTime() - new Date(from).getTime()) / msPerDay
  );
}

export function loadStreak(): StreakState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw) as Partial<StreakState>;
    return {
      currentStreak:
        typeof parsed.currentStreak === "number" ? parsed.currentStreak : 0,
      longestStreak:
        typeof parsed.longestStreak === "number" ? parsed.longestStreak : 0,
      lastQuizPassDate:
        typeof parsed.lastQuizPassDate === "string"
          ? parsed.lastQuizPassDate
          : null,
      freezesRemaining:
        typeof parsed.freezesRemaining === "number"
          ? parsed.freezesRemaining
          : 2,
      weekStartDate:
        typeof parsed.weekStartDate === "string"
          ? parsed.weekStartDate
          : getMonday(new Date()),
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function saveStreak(state: StreakState): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export type StreakCheckResult =
  | { type: "active_today" }
  | { type: "continues_if_active" }
  | { type: "no_streak" }
  | { type: "auto_freeze"; message: string }
  | { type: "streak_broken"; message: string };

/** Check streak status on app open. Also handles weekly freeze reset. */
export function checkStreak(): StreakCheckResult {
  const streak = loadStreak();
  const today = toDateString(new Date());
  const yesterday = toDateString(
    new Date(Date.now() - 86400000)
  );

  // Weekly freeze reset
  const currentMonday = getMonday(new Date());
  if (streak.weekStartDate !== currentMonday) {
    streak.freezesRemaining = 2;
    streak.weekStartDate = currentMonday;
    saveStreak(streak);
  }

  if (!streak.lastQuizPassDate || streak.currentStreak === 0) {
    return { type: "no_streak" };
  }

  if (streak.lastQuizPassDate === today) {
    return { type: "active_today" };
  }

  if (streak.lastQuizPassDate === yesterday) {
    return { type: "continues_if_active" };
  }

  // Missed at least one day
  const missed = daysBetween(streak.lastQuizPassDate, today);

  if (missed === 2 && streak.freezesRemaining > 0) {
    // Missed exactly yesterday
    streak.freezesRemaining--;
    saveStreak(streak);
    return {
      type: "auto_freeze",
      message: `Streak freeze applied! Your ${streak.currentStreak}-day streak is safe.`,
    };
  }

  // Streak broken
  const brokenStreak = streak.currentStreak;
  streak.currentStreak = 0;
  saveStreak(streak);
  return {
    type: "streak_broken",
    message: `Your ${brokenStreak}-day streak ended. Start a new one today!`,
  };
}

/** Extend the streak when user passes a quiz */
export function onQuizPass(): StreakState {
  const streak = loadStreak();
  const today = toDateString(new Date());

  if (streak.lastQuizPassDate !== today) {
    streak.currentStreak++;
    streak.lastQuizPassDate = today;
    if (streak.currentStreak > streak.longestStreak) {
      streak.longestStreak = streak.currentStreak;
    }
  }

  saveStreak(streak);
  return streak;
}

/** Get milestone message for current streak, or null */
export function getStreakMilestone(streak: number): string | null {
  const milestones: Record<number, string> = {
    7: "7-day streak! You're building a learning habit.",
    14: "14-day streak! Consistency pays off.",
    30: "30-day streak! Incredible dedication.",
    60: "60-day streak! You're in rare company.",
    100: "100 days! You're in the top 1% of learners.",
  };
  return milestones[streak] ?? null;
}
