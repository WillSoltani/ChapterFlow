// Insight Points Economy — formerly Flow Points.
// DynamoDB fields unchanged for backward compatibility (points, lifetimeEarned, etc.).
// Source type strings unchanged (quiz_pass, book_complete, etc.).

import { BADGE_DEFINITIONS } from "@/app/book/data/mockBadges";

export const INSIGHT_POINTS_COOKIE_NAME = "cf_ref";
/** @deprecated Use INSIGHT_POINTS_COOKIE_NAME */
export const FLOW_POINTS_COOKIE_NAME = INSIGHT_POINTS_COOKIE_NAME;

export type FlowPointsSourceType =
  | "onboarding_complete"
  | "first_book_started"
  | "quiz_pass"
  | "book_complete"
  | "badge_earned"
  | "scenario_approved"
  | "referral_activation_inviter"
  | "referral_activation_invitee"
  | "referral_pro_inviter"
  | "reward_redemption"
  | "admin_adjustment";

export type FlowPointsRewardId =
  | "bonus_book_unlock"
  | "pro_pass_7d"
  | "pro_pass_30d";

export type FlowPointsRewardDefinition = {
  rewardId: FlowPointsRewardId;
  name: string;
  description: string;
  costPoints: number;
  type: "book_slot" | "pro_pass";
  bookSlotDelta?: number;
  durationDays?: number;
  oneTimePerUser: boolean;
  freeOnly?: boolean;
  highlight: string;
};

export type InsightPointsEarningRule = {
  sourceType: FlowPointsSourceType | "loop_complete" | "streak_day" | "welcome_back";
  label: string;
  /** Exact amount, or 0 if variable. For display, use displayValue. */
  amount: number;
  /** Human-readable IP range or value for "Ways to Earn" display — implements §8.4 */
  displayValue: string;
  /** Explanatory detail shown under the earning rule */
  detail: string;
  cadence: "one_time" | "per_chapter" | "per_book" | "per_badge" | "per_approved_submission" | "per_referral_stage" | "daily" | "per_return";
  note: string;
};
/** @deprecated Use InsightPointsEarningRule */
export type FlowPointsEarningRule = InsightPointsEarningRule;

export const INSIGHT_POINTS_AMOUNTS = {
  onboardingComplete: 120,
  firstBookStarted: 40,
  bookComplete: 120,
  scenarioApproved: 60,
  referralActivationInviter: 180,
  referralActivationInvitee: 80,
  referralProInviter: 600,
  streakDayBonus: 15,          // §1.1 — awarded on first loop of each active streak day
  welcomeBack: 30,             // §1.1 — awarded on first loop after 7+ inactive days
  // Removed in IP migration: quizPass (15), dailyGoalComplete (25), weeklyGoalComplete (50)
  // — see achievement-definitions.ts and streak system for replacements
} as const;
/** @deprecated Use INSIGHT_POINTS_AMOUNTS */
export const FLOW_POINTS_AMOUNTS = INSIGHT_POINTS_AMOUNTS;

/** Mode-dependent Insight Points for the chapter reading experience.
 *  Quiz pass values are the quiz-pass-only portion (§1.1).
 *  Loop complete values are in LOOP_COMPLETE_IP below. */
export const CHAPTER_FP = {
  quizPassFirstAttempt: { guided: 50, standard: 60, challenge: 90 },
  quizPassRetry: { guided: 30, standard: 35, challenge: 60 },
  quizPerfectScore: { guided: 30, standard: 50, challenge: 80 },
  // Removed in IP migration — see achievement-definitions.ts and streak system for replacements:
  // quizSpeedBonus, quizScoreImproved, scenarioSubmitted, streakBonus,
  // reviewSessionComplete, reviewAllCorrect
} as const;

/** Loop completion IP — awarded when Unlock step finishes after quiz pass (§1.1) */
export const LOOP_COMPLETE_IP = {
  guided: { firstAttempt: 30, retry: 20 },
  standard: { firstAttempt: 40, retry: 25 },
  challenge: { firstAttempt: 60, retry: 40 },
} as const;

/** Pass thresholds per learning mode (percentage) */
export const QUIZ_PASS_THRESHOLDS = {
  guided: 70,
  standard: 80,
  challenge: 90,
} as const;

/** Retry allowances per learning mode (retries per question, NOT total attempts) */
export const QUIZ_RETRIES_PER_QUESTION = {
  guided: 2,
  standard: 1,
  challenge: 0,
} as const;

/** Auto-advance delay per mode (ms) */
export const QUIZ_AUTO_ADVANCE_DELAY = {
  guided: 3000,
  standard: 2000,
  challenge: 1500,
} as const;

/** Challenge mode total time limit (seconds) */
export const CHALLENGE_QUIZ_TIME_LIMIT = 600; // 10 minutes

export const FLOW_POINTS_REWARDS: FlowPointsRewardDefinition[] = [
  {
    rewardId: "bonus_book_unlock",
    name: "Bonus Book Unlock",
    description: "Add one extra free book slot without subscribing.",
    costPoints: 900,
    type: "book_slot",
    bookSlotDelta: 1,
    oneTimePerUser: true,
    freeOnly: true,
    highlight: "Best for readers who want one more title before going Pro.",
  },
  {
    rewardId: "pro_pass_7d",
    name: "7-Day Pro Pass",
    description: "Unlock unlimited books and premium reading modes for one week.",
    costPoints: 2400,
    type: "pro_pass",
    durationDays: 7,
    oneTimePerUser: true,
    freeOnly: true,
    highlight: "A short premium sprint that lets engaged readers feel the full product.",
  },
  {
    rewardId: "pro_pass_30d",
    name: "30-Day Pro Pass",
    description: "Earn a full month of Pro through long-term progress and referrals.",
    costPoints: 6500,
    type: "pro_pass",
    durationDays: 30,
    oneTimePerUser: true,
    freeOnly: true,
    highlight: "High-value and intentionally hard to reach without real usage or quality referrals.",
  },
];

// Implements §8.4 — Accurate "Ways to Earn" specification
export const INSIGHT_POINTS_EARNING_RULES: InsightPointsEarningRule[] = [
  {
    sourceType: "quiz_pass",
    label: "Complete a learning loop",
    amount: 0,
    displayValue: "80–230 IP",
    detail: "Varies by mode and quiz performance. Challenge mode and perfect scores earn the most.",
    cadence: "per_chapter",
    note: "Includes quiz pass + loop completion. Only on the first pass for each chapter.",
  },
  {
    sourceType: "streak_day",
    label: "Maintain your streak",
    amount: INSIGHT_POINTS_AMOUNTS.streakDayBonus,
    displayValue: "+15 IP/day",
    detail: "Awarded on your first loop each day while your streak is active.",
    cadence: "daily",
    note: "Requires completing at least one full learning loop per day.",
  },
  {
    sourceType: "book_complete",
    label: "Finish a book",
    amount: INSIGHT_POINTS_AMOUNTS.bookComplete,
    displayValue: "120 IP",
    detail: "Awarded when you complete every chapter.",
    cadence: "per_book",
    note: "Reserved for true milestone progress.",
  },
  {
    sourceType: "badge_earned",
    label: "Earn an achievement",
    amount: 0,
    displayValue: "15–500 IP",
    detail: "Different achievements award different amounts. Check the Achievements tab for details.",
    cadence: "per_badge",
    note: "Achievement awards use each achievement's published Insight Points value.",
  },
  {
    sourceType: "onboarding_complete",
    label: "Complete onboarding",
    amount: INSIGHT_POINTS_AMOUNTS.onboardingComplete,
    displayValue: "120 IP",
    detail: "One-time award for setting up your reading preferences.",
    cadence: "one_time",
    note: "A meaningful early win for setting up the app properly.",
  },
  {
    sourceType: "referral_activation_inviter",
    label: "Refer a friend",
    amount: 0,
    displayValue: "1 week Pro or 200 IP",
    detail: "Give a friend a free week of Pro — you'll both be rewarded.",
    cadence: "per_referral_stage",
    note: "Paid when the referred user completes their first full learning loop.",
  },
];
/** @deprecated Use INSIGHT_POINTS_EARNING_RULES */
export const FLOW_POINTS_EARNING_RULES = INSIGHT_POINTS_EARNING_RULES;

export const INSIGHT_POINTS_REWARDS = FLOW_POINTS_REWARDS;

export function getInsightPointsReward(rewardId: FlowPointsRewardId): FlowPointsRewardDefinition | null {
  return FLOW_POINTS_REWARDS.find((reward) => reward.rewardId === rewardId) ?? null;
}
/** @deprecated Use getInsightPointsReward */
export const getFlowPointsReward = getInsightPointsReward;

export function getAchievementIP(badgeId: string): number {
  return BADGE_DEFINITIONS.find((badge) => badge.id === badgeId)?.flowPoints ?? 0;
}
/** @deprecated Use getAchievementIP */
export const getBadgeFlowPoints = getAchievementIP;

export function getBadgeName(badgeId: string): string | null {
  return BADGE_DEFINITIONS.find((badge) => badge.id === badgeId)?.name ?? null;
}

export function getInsightPointsSourceTitle(sourceType: string): string {
  switch (sourceType) {
    case "onboarding_complete":
      return "Onboarding complete";
    case "first_book_started":
      return "First book started";
    case "quiz_pass":
      return "Quiz passed";
    case "loop_complete":
      return "Learning loop completed";
    case "book_complete":
      return "Book completed";
    case "badge_earned":
      return "Achievement earned";
    case "achievement_earned":
      return "Achievement earned";
    case "scenario_approved":
      return "Scenario approved";
    case "referral_activation_inviter":
      return "Referral became active";
    case "referral_activation_invitee":
      return "You joined through a referral";
    case "referral_pro_inviter":
      return "Referral upgraded to Pro";
    case "reward_redemption":
      return "Reward redeemed";
    case "admin_adjustment":
      return "Points adjustment";
    case "streak_day":
      return "Streak day bonus";
    case "streak_milestone":
      return "Streak milestone";
    case "tier_advance":
      return "Tier advancement";
    case "insight_spark":
      return "Insight Spark";
    case "welcome_back":
      return "Welcome back";
    default:
      return "Insight Points";
  }
}
/** @deprecated Use getInsightPointsSourceTitle */
export const getFlowPointsSourceTitle = getInsightPointsSourceTitle;

export function getInsightPointsSourceSubtitle(
  sourceType: string,
  metadata?: Record<string, unknown> | null
): string | null {
  switch (sourceType) {
    case "quiz_pass": {
      const bookTitle = typeof metadata?.bookTitle === "string" ? metadata.bookTitle : null;
      const chapterLabel =
        typeof metadata?.chapterLabel === "string" ? metadata.chapterLabel : null;
      if (bookTitle && chapterLabel) return `${bookTitle} · ${chapterLabel}`;
      return chapterLabel ?? bookTitle;
    }
    case "book_complete":
      return typeof metadata?.bookTitle === "string" ? metadata.bookTitle : null;
    case "badge_earned":
      return typeof metadata?.badgeName === "string" ? metadata.badgeName : null;
    case "scenario_approved": {
      const scope = typeof metadata?.scope === "string" ? metadata.scope : null;
      return scope ? `${scope[0]?.toUpperCase() ?? ""}${scope.slice(1)} scenario` : null;
    }
    case "reward_redemption":
      return typeof metadata?.rewardName === "string" ? metadata.rewardName : null;
    case "referral_activation_inviter":
    case "referral_activation_invitee":
    case "referral_pro_inviter":
      return typeof metadata?.inviteCode === "string" ? `Invite ${metadata.inviteCode}` : null;
    case "loop_complete": {
      const bookTitle = typeof metadata?.bookTitle === "string" ? metadata.bookTitle : null;
      const chapterLabel =
        typeof metadata?.chapterLabel === "string" ? metadata.chapterLabel : null;
      if (bookTitle && chapterLabel) return `${bookTitle} · ${chapterLabel}`;
      return chapterLabel ?? bookTitle;
    }
    case "streak_day":
      return typeof metadata?.date === "string" ? `Day ${metadata.currentStreak ?? ""}` : null;
    case "streak_milestone":
      return typeof metadata?.days === "number" ? `${metadata.days}-day streak` : null;
    case "achievement_earned":
      return typeof metadata?.achievementName === "string" ? metadata.achievementName : null;
    case "tier_advance":
      return typeof metadata?.tierName === "string" ? metadata.tierName : null;
    case "welcome_back":
      return null;
    default:
      return null;
  }
}
/** @deprecated Use getInsightPointsSourceSubtitle */
export const getFlowPointsSourceSubtitle = getInsightPointsSourceSubtitle;
