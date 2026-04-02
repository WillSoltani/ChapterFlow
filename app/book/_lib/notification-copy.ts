// Implements §2.5 — Notification and Copy Framework.
// All notification copy follows: learning accomplishment first, IP value second.
// Never guilt, shame, or fear of loss — even on streak breaks.

// ── Types ───────────────────────────────────────────────────────────────────

export type NotificationType =
  | "loop_complete"
  | "perfect_score"
  | "streak_day"
  | "streak_approaching_milestone"
  | "streak_broken"
  | "streak_saved_by_shield"
  | "welcome_back_7"
  | "welcome_back_14"
  | "book_complete"
  | "tier_advance"
  | "achievement_earned"
  | "achievement_hidden";

export type NotificationCopy = {
  type: NotificationType;
  headline: string;
  /** IP amount shown below headline in smaller text. null = no IP shown. */
  ipDisplay: string | null;
  /** Optional secondary text */
  detail: string | null;
};

// ── Copy generators ─────────────────────────────────────────────────────────

/** §2.5 — Daily loop completion (streak active) */
export function loopCompleteNotification(
  chapterName: string,
  streakDays: number,
  totalIP: number
): NotificationCopy {
  return {
    type: "loop_complete",
    headline: `${chapterName} complete.${streakDays > 0 ? ` Day ${streakDays} of your reading streak.` : ""}`,
    ipDisplay: `+${totalIP} IP`,
    detail: null,
  };
}

/** §8.2 — Perfect score celebration */
export function perfectScoreNotification(
  chapterName: string,
  totalIP: number,
  perfectBonus: number
): NotificationCopy {
  return {
    type: "perfect_score",
    headline: `Perfect comprehension of ${chapterName}. Not a single concept missed.`,
    ipDisplay: `+${totalIP} IP (includes +${perfectBonus} IP perfect score bonus)`,
    detail: null,
  };
}

/** §2.5 — Streak approaching milestone (1 day before) */
export function streakApproachingNotification(
  milestoneDay: number
): NotificationCopy {
  return {
    type: "streak_approaching_milestone",
    headline: `Tomorrow is day ${milestoneDay}. One more loop and you'll hit a new milestone.`,
    ipDisplay: null, // No IP shown — anticipation, not reward preview
    detail: null,
  };
}

/** §2.5 — Streak broken */
export function streakBrokenNotification(
  lastStreak: number,
  longestStreak: number
): NotificationCopy {
  return {
    type: "streak_broken",
    headline: `Your streak paused at ${lastStreak} days. Your longest streak of ${longestStreak} days is yours permanently. Ready to start fresh whenever you are.`,
    ipDisplay: null, // No IP. Warm. Permanent record emphasized.
    detail: null,
  };
}

/** §2.5 — Streak saved by shield */
export function streakSavedByShieldNotification(
  streakDays: number,
  shieldsRemaining: number
): NotificationCopy {
  return {
    type: "streak_saved_by_shield",
    headline: `Your Streak Shield kept your ${streakDays}-day streak alive. ${shieldsRemaining} shield${shieldsRemaining !== 1 ? "s" : ""} remaining.`,
    ipDisplay: null,
    detail: null,
  };
}

/** §2.5 — Welcome back (7–13 days) */
export function welcomeBack7Notification(): NotificationCopy {
  return {
    type: "welcome_back_7",
    headline: "Welcome back. Your reading history and progress are right where you left it.",
    ipDisplay: "+30 IP",
    detail: null,
  };
}

/** §2.5 — Welcome back (14+ days, may trigger Second Wind achievement) */
export function welcomeBack14Notification(): NotificationCopy {
  return {
    type: "welcome_back_14",
    headline: "It's good to have you back. Pick up wherever feels right.",
    ipDisplay: "+30 IP",
    detail: null,
  };
}

/** §8.2 — Book completion */
export function bookCompleteNotification(
  bookTitle: string,
  chapterCount: number,
  category: string
): NotificationCopy {
  return {
    type: "book_complete",
    headline: `You finished ${bookTitle}. That's ${chapterCount} chapters of genuine understanding in ${category}.`,
    ipDisplay: "+120 IP",
    detail: null,
  };
}

/** §8.2 — Tier advancement */
export function tierAdvanceNotification(
  displayName: string,
  loopsCompleted: number,
  avgScore: number,
  categoriesExplored: number,
  advancementIP: number
): NotificationCopy {
  const summaryParts: string[] = [];
  if (loopsCompleted > 0) summaryParts.push(`${loopsCompleted} chapters`);
  if (categoriesExplored > 0) summaryParts.push(`${categoriesExplored} categories`);

  return {
    type: "tier_advance",
    headline: `You've reached ${displayName} — you've demonstrated consistent comprehension across ${summaryParts.join(" in ")}.`,
    ipDisplay: advancementIP > 0 ? `+${advancementIP} IP` : null,
    detail: avgScore > 0 ? `Average score: ${avgScore}%` : null,
  };
}

/** §4.4 — Hidden achievement discovery */
export function hiddenAchievementNotification(
  name: string,
  celebrationCopy: string,
  ipAwarded: number
): NotificationCopy {
  return {
    type: "achievement_hidden",
    headline: `Discovery unlocked: ${name}`,
    ipDisplay: `+${ipAwarded} IP`,
    detail: celebrationCopy,
  };
}

/** §4.1–4.3 — Regular achievement */
export function achievementNotification(
  name: string,
  celebrationCopy: string,
  ipAwarded: number
): NotificationCopy {
  return {
    type: "achievement_earned",
    headline: celebrationCopy,
    ipDisplay: `+${ipAwarded} IP`,
    detail: null,
  };
}

// ── Copy anti-patterns (documented for reference, never generated) ──────────
//
// These patterns are NEVER used per §8.2:
// - Leading with points: "+100 IP! You completed a chapter!"
// - Gaming language: "Level up! Achievement unlocked! XP earned!"
// - Guilt: "Don't break your streak! You'll lose your progress!"
// - Hollow enthusiasm: "Amazing! Incredible! You're on fire!"
// - Comparison: "You're in the top 5% of readers!"
