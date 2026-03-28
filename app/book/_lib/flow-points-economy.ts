import { BADGE_DEFINITIONS } from "@/app/book/data/mockBadges";

export const FLOW_POINTS_COOKIE_NAME = "cf_ref";

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

export type FlowPointsEarningRule = {
  sourceType: FlowPointsSourceType;
  label: string;
  amount: number;
  cadence: "one_time" | "per_chapter" | "per_book" | "per_badge" | "per_approved_submission" | "per_referral_stage";
  note: string;
};

export const FLOW_POINTS_AMOUNTS = {
  onboardingComplete: 120,
  firstBookStarted: 40,
  quizPass: 15,
  bookComplete: 120,
  scenarioApproved: 60,
  referralActivationInviter: 180,
  referralActivationInvitee: 80,
  referralProInviter: 600,
  dailyGoalComplete: 25,
  weeklyGoalComplete: 50,
} as const;

/** Mode-dependent Flow Points for the chapter reading experience */
export const CHAPTER_FP = {
  quizPassFirstAttempt: { guided: 80, standard: 100, challenge: 150 },
  quizPassRetry: { guided: 50, standard: 60, challenge: 100 },
  quizPerfectScore: { guided: 30, standard: 50, challenge: 80 },
  quizSpeedBonus: { guided: 0, standard: 0, challenge: 30 },
  quizScoreImproved: 20,
  scenarioSubmitted: 60,
  streakBonus: 25,
  reviewSessionComplete: 15,
  reviewAllCorrect: 10,
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

export const FLOW_POINTS_EARNING_RULES: FlowPointsEarningRule[] = [
  {
    sourceType: "onboarding_complete",
    label: "Finish onboarding",
    amount: FLOW_POINTS_AMOUNTS.onboardingComplete,
    cadence: "one_time",
    note: "A meaningful early win for setting up the app properly.",
  },
  {
    sourceType: "first_book_started",
    label: "Start your first book",
    amount: FLOW_POINTS_AMOUNTS.firstBookStarted,
    cadence: "one_time",
    note: "Rewards real activation, not account creation alone.",
  },
  {
    sourceType: "quiz_pass",
    label: "Pass a chapter quiz",
    amount: FLOW_POINTS_AMOUNTS.quizPass,
    cadence: "per_chapter",
    note: "Only on the first pass for each chapter.",
  },
  {
    sourceType: "book_complete",
    label: "Finish a book",
    amount: FLOW_POINTS_AMOUNTS.bookComplete,
    cadence: "per_book",
    note: "Reserved for true milestone progress.",
  },
  {
    sourceType: "badge_earned",
    label: "Earn a badge",
    amount: 0,
    cadence: "per_badge",
    note: "Badge awards use each badge's published Flow Points value.",
  },
  {
    sourceType: "scenario_approved",
    label: "Get a scenario approved",
    amount: FLOW_POINTS_AMOUNTS.scenarioApproved,
    cadence: "per_approved_submission",
    note: "Paid only after moderation approval, never on raw submission.",
  },
  {
    sourceType: "referral_activation_inviter",
    label: "Refer an active reader",
    amount: FLOW_POINTS_AMOUNTS.referralActivationInviter,
    cadence: "per_referral_stage",
    note: "Paid when the referred user completes onboarding and starts their first book.",
  },
  {
    sourceType: "referral_pro_inviter",
    label: "Refer a Pro subscriber",
    amount: FLOW_POINTS_AMOUNTS.referralProInviter,
    cadence: "per_referral_stage",
    note: "Reserved for real paid conversion, not invite sends.",
  },
];

export function getFlowPointsReward(rewardId: FlowPointsRewardId): FlowPointsRewardDefinition | null {
  return FLOW_POINTS_REWARDS.find((reward) => reward.rewardId === rewardId) ?? null;
}

export function getBadgeFlowPoints(badgeId: string): number {
  return BADGE_DEFINITIONS.find((badge) => badge.id === badgeId)?.flowPoints ?? 0;
}

export function getBadgeName(badgeId: string): string | null {
  return BADGE_DEFINITIONS.find((badge) => badge.id === badgeId)?.name ?? null;
}

export function getFlowPointsSourceTitle(sourceType: FlowPointsSourceType): string {
  switch (sourceType) {
    case "onboarding_complete":
      return "Onboarding complete";
    case "first_book_started":
      return "First book started";
    case "quiz_pass":
      return "Quiz passed";
    case "book_complete":
      return "Book completed";
    case "badge_earned":
      return "Badge earned";
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
    default:
      return "Flow Points";
  }
}

export function getFlowPointsSourceSubtitle(
  sourceType: FlowPointsSourceType,
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
    default:
      return null;
  }
}
