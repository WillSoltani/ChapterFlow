export type VariantFamily = "EMH" | "PBC";

export type VariantKey = "easy" | "medium" | "hard" | "precise" | "balanced" | "challenging";

export type ChapterSummaryBlock =
  | {
      type: "paragraph";
      text: string;
    }
  | {
      type: "bullet";
      text: string;
      detail?: string;
    };

/** Tone-keyed content: { gentle: string, direct: string, competitive: string } */
export type ToneKeyed = {
  gentle: string;
  direct: string;
  competitive: string;
};

export type OneMinuteRecapToneKeyed = ToneKeyed | {
  retrieve: ToneKeyed;
  connect: ToneKeyed;
  preview: ToneKeyed;
};

export type ChapterVariantContent = {
  importantSummary?: string;
  summaryBullets?: string[];
  summaryBlocks?: ChapterSummaryBlock[];
  takeaways?: string[];
  practice?: string[];
  /** Modern format: tone-keyed chapter breakdown narrative */
  chapterBreakdown?: ToneKeyed;
  /** Modern format: tone-keyed takeaway objects */
  keyTakeaways?: Array<{ point: ToneKeyed; moreDetails?: ToneKeyed }>;
  /** Modern format: tone-keyed one-minute recap */
  oneMinuteRecap?: OneMinuteRecapToneKeyed;
  activationPrompt?: ToneKeyed;
  selfCheckPrompt?: ToneKeyed;
  selfCheckPrompts?: ToneKeyed[];
  reflectionPrompts?: ToneKeyed[];
  predictionPrompt?: ToneKeyed;
};

export type BookPackageQuizQuestion = {
  questionId: string;
  prompt?: string;
  stem?: string;
  choices?: string[];
  options?: string[];
  correctAnswerIndex?: number;
  correctIndex?: number;
  explanation?: string | ToneKeyed;
  bloomsLevel?: string;
  depthLevel?: string;
};

export type BookPackageQuiz = {
  chapterId?: string;
  chapterNumber?: number;
  chapterTitle?: string;
  title?: string;
  passingScorePercent: number;
  questions: BookPackageQuizQuestion[];
  retryQuestions?: BookPackageQuizQuestion[];
};

export type BookPackageExample = {
  exampleId?: string;
  title?: string;
  scenario: string | ToneKeyed;
  whatToDo: string[] | ToneKeyed;
  whyItMatters: string | ToneKeyed;
  contexts?: string[];
  category?: string;
  format?: string;
  endingType?: string;
};

/** Tone-keyed review card for spaced repetition */
export type ReviewCard = {
  cardId?: string;
  front: ToneKeyed;
  back: ToneKeyed;
  difficulty?: "easy" | "medium" | "hard";
};

/** Tone-keyed implementation plan */
export type ImplementationPlan = {
  coreSkill?: ToneKeyed;
  concreteAction?: ToneKeyed;
  ifThenPlans?: Array<{
    context: string;
    plan: ToneKeyed;
  }>;
  ifThenPlan?: ToneKeyed;
  twentyFourHourChallenge?: ToneKeyed;
  weeklyPractice?: ToneKeyed;
  friction?: ToneKeyed;
  checkpoint?: ToneKeyed;
};

/**
 * v21-only chapter fields that have no v13/tone-keyed equivalent. The v21 → v13
 * adapter and validator carry these through unchanged so the reader can render
 * the hook banner, counterintuition, "try this now" directive, and memorable
 * lines. Absent for native v13 packages.
 */
/** v21 behavior-change layer (Layer A). Sub-objects are surfaced only when
 *  complete (the adapter drops partial/empty shapes), so the reader contract is
 *  all-or-nothing per sub-object. Mirrors the client `V21ExperiencePlan`. */
export type V21ExperiencePlan = {
  failureRecovery?: {
    normalizingLine: string;
    cueQuestion: string;
    options: string[];
    repairLine: string;
  };
  transferPrompt?: {
    prompt: string;
    contexts: string[];
  };
};

export type V21ChapterExtras = {
  hook?: string;
  counterintuition?: string;
  tryThisNow?: string;
  keyTakeaway?: string;
  memorableLines?: Array<{ text: string; location?: string; why?: string }>;
  experiencePlan?: V21ExperiencePlan;
};

export type BookPackageChapter = {
  book?: {
    bookId?: string;
    title?: string;
    author?: string;
  };
  chapterId: string;
  number: number;
  title: string;
  readingTimeMinutes: number;
  contentHash?: string;
  contentVariants: Partial<Record<VariantKey, ChapterVariantContent>>;
  examples: BookPackageExample[];
  quiz: BookPackageQuiz;
  implementationPlan?: ImplementationPlan;
  reviewCards?: ReviewCard[];
  keyTakeawayCard?: ToneKeyed;
  v21Extras?: V21ChapterExtras;
};

export type BookPackageEdition = {
  name: string;
  publishedYear?: number | null;
  publisher?: string;
  publishedDate?: string;
  imprintFamily?: string[];
  isbn10?: string;
  isbn13?: string;
  format?: string;
  language?: string;
  translator?: string;
  translationYear?: number | null;
  openLibraryEdition?: string;
  sourceText?: string;
  sourceProvenance?: string;
};

export type BookPackageBook = {
  bookId: string;
  title: string;
  author: string;
  categories: string[];
  tags?: string[];
  cover?: {
    emoji?: string;
    color?: string;
  };
  edition?: string | BookPackageEdition;
  variantFamily: VariantFamily;
  chapterRange?: string;
};

// ── Concept Dependency Graph ──────────────────────────────────────────────────

export type ConceptNode = {
  id: string;
  label: string;
  introducedIn: string;
  summary?: string;
};

export type ConceptEdge = {
  from: string;
  to: string;
  type: "prerequisite";
};

export type ConceptGraph = {
  concepts: ConceptNode[];
  edges: ConceptEdge[];
  chapterIntroduces: Record<string, string[]>;
  chapterRequires: Record<string, string[]>;
};

export type BookPackage = {
  schemaVersion: string;
  packageId: string;
  createdAt: string;
  contentOwner: string;
  licenseNotes?: string;
  book: BookPackageBook;
  chapters: BookPackageChapter[];
  conceptGraph?: ConceptGraph;
};

export type ChapterSummaryPayload = {
  chapterId: string;
  number: number;
  title: string;
  readingTimeMinutes: number;
  contentVariants: Partial<Record<VariantKey, ChapterVariantContent>>;
  examples: BookPackageExample[];
  implementationPlan?: ImplementationPlan;
  reviewCards?: ReviewCard[];
  keyTakeawayCard?: ToneKeyed;
  v21Extras?: V21ChapterExtras;
};

export type ChapterQuizPayload = {
  chapterId: string;
  number: number;
  title: string;
  passingScorePercent: number;
  questions: BookPackageQuizQuestion[];
  retryQuestions?: BookPackageQuizQuestion[];
};

export type BookManifestChapter = {
  chapterId: string;
  number: number;
  title: string;
  readingTimeMinutes: number;
  chapterKey: string;
  quizKey: string;
};

export type BookManifest = {
  schemaVersion: string;
  packageId: string;
  bookId: string;
  title: string;
  author: string;
  categories: string[];
  tags: string[];
  variantFamily: VariantFamily;
  chapterCount: number;
  createdAt: string;
  version: number;
  chapters: BookManifestChapter[];
};

export type BookCatalogItem = {
  bookId: string;
  title: string;
  author: string;
  categories: string[];
  tags: string[];
  cover?: {
    emoji?: string;
    color?: string;
  };
  variantFamily: VariantFamily;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  latestVersion: number;
  currentPublishedVersion?: number;
  updatedAt: string;
};

export type BookVersionItem = {
  bookId: string;
  version: number;
  packageId: string;
  schemaVersion: string;
  state: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  contentPrefix: string;
  manifestKey: string;
  createdAt: string;
  createdBy: string;
  publishedAt?: string;
  publishedBy?: string;
};

export type BookUserEntitlement = {
  userId: string;
  plan: "FREE" | "PRO";
  proStatus?: "inactive" | "active" | "past_due" | "canceled";
  /** How the user obtained PRO — "stripe" for paid subscription, "license" for a free-pass key, "flow_points" for a timed reward pass, "gift_code" for a gifted Pro window. license/flow_points/gift_code are time-limited and expire (see getUserEntitlement). */
  proSource?: "stripe" | "license" | "flow_points" | "gift_code" | "admin";
  freeBookSlots: number;
  unlockedBookIds: string[];
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  /** Stripe Price id of the current subscription (for plan reconciliation). */
  stripePriceId?: string;
  /** Stripe recurring interval ("month" | "year") of the current subscription. */
  subscriptionInterval?: string;
  currentPeriodEnd?: string;
  /** True if the Stripe subscription is set to cancel at the end of the current period (no auto-renew) */
  cancelAtPeriodEnd?: boolean;
  /** The license key code that granted PRO access (if proSource === "license") */
  licenseKey?: string;
  /** ISO date when the license-based PRO expires (if proSource === "license") */
  licenseExpiresAt?: string;
  /** Billing intelligence — populated from Stripe webhooks (null for license/flow_points sources) */
  billingCountry?: string;
  billingCurrency?: string;
  subscriptionAmountCents?: number;
  cardBrand?: string;
  cardCountry?: string;
  lastInvoiceAmountCents?: number;
  lastInvoiceCurrency?: string;
  lastInvoicePaidAt?: string;
  discountCouponId?: string;
  failedPaymentLastReason?: string;
  updatedAt: string;
};

/** A single pre-generated free-pass license key stored in DynamoDB */
export type LicenseKeyItem = {
  code: string;
  plan: "PRO";
  validMonths: number;
  status: "available" | "redeemed" | "revoked";
  redeemedBy?: string;
  redeemedAt?: string;
  createdAt: string;
  /** Optional human note for tracking (e.g., "Given to John Doe") */
  note?: string;
};

export type BookUserProgress = {
  userId: string;
  bookId: string;
  pinnedBookVersion: number;
  contentPrefix: string;
  manifestKey: string;
  currentChapterNumber: number;
  unlockedThroughChapterNumber: number;
  completedChapters: number[];
  bestScoreByChapter: Record<string, number>;
  lastOpenedAt?: string;
  lastActiveAt?: string;
  streakDays?: number;
  preferredVariant?: VariantKey;
  updatedAt: string;
  createdAt: string;
};

export type QuizAttemptItem = {
  userId: string;
  bookId: string;
  chapterNumber: number;
  chapterId?: string;
  quizId: string;
  attemptNumber: number;
  passingScorePercent: number;
  scorePercent: number;
  correctCount: number;
  totalQuestions: number;
  passed: boolean;
  cooldownSeconds: number;
  nextEligibleAttemptAt?: string | null;
  unlockedNextChapter: boolean;
  responses: Array<{
    questionId: string;
    selectedChoiceId?: string | null;
    selectedIndex?: number | null;
  }>;
  questionResults: Array<{
    questionId: string;
    selectedChoiceId?: string | null;
    selectedIndex?: number | null;
    correctChoiceId: string;
    correctIndex: number;
    isCorrect: boolean;
  }>;
  timeSpentSeconds?: number;
  createdAt: string;
  updatedAt: string;
};

export type BookUserQuizStateItem = {
  userId: string;
  bookId: string;
  chapterNumber: number;
  chapterId?: string;
  quizId: string;
  attemptsCount: number;
  failureStreak: number;
  passed: boolean;
  highestScorePercent: number;
  lastScorePercent: number;
  lastCorrectCount: number;
  lastTotalQuestions: number;
  lastAttemptAt?: string;
  lastAttemptNumber?: number;
  nextEligibleAttemptAt?: string | null;
  passedAt?: string;
  unlockedNextChapter: boolean;
  /** ISO timestamp set when the loop pipeline (streak/tier/achievement/spark) finished cleanly. */
  loopPipelineCompletedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type ScenarioScope = "work" | "school" | "personal";
export type ScenarioSubmissionStatus = "pending" | "approved" | "rejected";

export type BookUserScenarioSubmissionItem = {
  userId: string;
  submissionId: string;
  bookId: string;
  chapterNumber: number;
  chapterId?: string;
  title: string;
  scenario: string;
  whatToDo: string;
  whyItMatters: string;
  scope: ScenarioScope;
  status: ScenarioSubmissionStatus;
  pointsAwarded: number;
  createdAt: string;
  updatedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewNotes?: string;
  userEmail?: string;
  userName?: string;
  aiValidation?: {
    decision: "auto_approve" | "auto_reject" | "queue_for_review";
    reason: string;
    model: string;
    validatedAt: string;
  };
};

export type BookScenarioModerationItem = BookUserScenarioSubmissionItem & {
  queuedAt: string;
};

export type BookScenarioLookupItem = {
  submissionId: string;
  userId: string;
  bookId: string;
  chapterNumber: number;
  createdAt: string;
  status: ScenarioSubmissionStatus;
  pointsAwarded: number;
  queuedAt?: string;
  approvedAt?: string;
  updatedAt: string;
};

export type BookApprovedScenarioItem = {
  submissionId: string;
  userId: string;
  bookId: string;
  chapterNumber: number;
  chapterId?: string;
  title: string;
  scenario: string;
  whatToDo: string;
  whyItMatters: string;
  scope: ScenarioScope;
  approvedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type BookUserEngagementItem = {
  userId: string;
  points: number;
  lifetimeEarned?: number;
  lifetimeSpent?: number;
  totalEarnEvents?: number;
  totalSpendEvents?: number;
  createdAt: string;
  updatedAt: string;
};

import type { FlowPointsSourceType } from "@/app/book/_lib/flow-points-economy";
export type { FlowPointsSourceType };

// ── Streak System (§10.1) ──────────────────────────────────────────────────

export type BookUserStreakItem = {
  userId: string;
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null;
  lastActiveTimezone: string | null;
  streakShieldsHeld: number;
  shieldUsedDates: string[];
  consistencyLast30: number;
  consistencyAbove80Since: string | null;
  milestonesReached: number[];
  createdAt: string;
  updatedAt: string;
};

// ── Tier System (§10.1) ────────────────────────────────────────────────────

export type TierName = "reader" | "analyst" | "synthesizer" | "polymath" | "luminary";

export type BookUserTierItem = {
  userId: string;
  currentTier: TierName;
  totalLoopsCompleted: number;
  avgQuizScoreSum: number;
  avgQuizScoreCount: number;
  categoriesExplored: string[];
  completedBooksByCategory: Record<string, string[]>;
  tiersAdvanced: TierName[];
  tierAdvancedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

// ── Achievement System (§10.1) ─────────────────────────────────────────────

export type AchievementTrack = "mastery" | "consistency" | "exploration" | "hidden";

export type BookUserAchievementItem = {
  userId: string;
  achievementId: string;
  track: AchievementTrack;
  earnedAt: string;
  ipAwarded: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

// ── Loop Completion Record (§10.1) ─────────────────────────────────────────

export type BookUserLoopItem = {
  userId: string;
  bookId: string;
  chapterNumber: number;
  completedAt: string;
  quizScore: number;
  learningMode: string;
  isFirstAttempt: boolean;
  category: string;
  loopCompleteIPAmount?: number;
  streakUpdatedAt?: string;
  tierUpdatedAt?: string;
  achievementsCheckedAt?: string;
  insightSparkCheckedAt?: string;
  createdAt: string;
};

// ── Notification Preferences ───────────────────────────────────────────────

export type NotificationChannel = "in_app" | "email" | "push";

export type NotificationPreferences = {
  channels: { inApp: boolean; email: boolean; push: boolean };
  readingReminderEnabled: boolean;
  reminderTimeLocal?: string;
  reminderTimezone?: string;
  streakReminderEnabled: boolean;
  badgeCelebrationEnabled: boolean;
  achievementAlertsEnabled: boolean;
  weeklyDigestEnabled?: boolean;
  welcomeBackEnabled?: boolean;
};

export type BookUserNotificationItem = {
  userId: string;
  notificationId: string;
  type: "badge_earned" | "tier_up" | "streak_milestone" | "insight_spark" | "reading_reminder" | "streak_at_risk" | "weekly_digest" | "welcome_back_nudge" | "partner_nudge" | "commitment_followup" | "event_reminder" | "scenario_approved" | "scenario_rejected";
  title: string;
  body: string;
  channel: NotificationChannel;
  readAt: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

// ── Device Token (Push Notifications) ──────────────────────────────────────

export type BookUserDeviceTokenItem = {
  userId: string;
  endpoint: string;
  keys: { p256dh: string; auth: string };
  platform: "web";
  createdAt: string;
  lastSeenAt: string;
};

// ── Gift Code (§5.1) ──────────────────────────────────────────────────────

export type BookUserGiftCodeItem = {
  code: string;
  giverUserId: string;
  giftType: "pro_week";
  ipCost: number;
  status: "available" | "redeemed" | "expired";
  redeemedBy?: string;
  redeemedAt?: string;
  createdAt: string;
};

// ── Inventory Record (§10.1) ───────────────────────────────────────────────

export type InventoryItemType = "theme" | "frame" | "seasonal";

export type BookUserInventoryItem = {
  userId: string;
  itemId: string;
  itemType: InventoryItemType;
  acquiredAt: string;
  equipped: boolean;
  ipCost: number;
  createdAt: string;
};

export type FlowPointsRewardId =
  | "bonus_book_unlock"
  | "pro_pass_7d"
  | "pro_pass_30d";

export type BookUserFlowPointsLedgerItem = {
  userId: string;
  transactionId: string;
  direction: "earn" | "spend" | "adjustment";
  amount: number;
  sourceType: FlowPointsSourceType;
  sourceId: string;
  rewardId?: FlowPointsRewardId;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type BookUserFlowPointsGrantItem = {
  userId: string;
  sourceType: FlowPointsSourceType;
  sourceId: string;
  amount: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type BookUserRewardRedemptionItem = {
  userId: string;
  redemptionId: string;
  rewardId: FlowPointsRewardId;
  costPoints: number;
  status: "fulfilled";
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type BookUserRewardClaimItem = {
  userId: string;
  rewardId: FlowPointsRewardId;
  redemptionId: string;
  claimedAt: string;
  updatedAt: string;
};

export type BookUserReferralProfileItem = {
  userId: string;
  inviteCode: string;
  pendingInvites: number;
  activatedInvites: number;
  proInvites: number;
  activationPointsEarned: number;
  proPointsEarned: number;
  createdAt: string;
  updatedAt: string;
};

export type BookReferralCodeLookupItem = {
  inviteCode: string;
  inviterUserId: string;
  createdAt: string;
  updatedAt: string;
};

export type BookUserReferralClaimItem = {
  userId: string;
  claimId: string;
  inviterUserId: string;
  inviteCode: string;
  status: "pending" | "activated" | "paid" | "blocked" | "expired";
  claimedAt: string;
  activationQualifiedAt?: string;
  activationRewardedAt?: string;
  proRewardedAt?: string;
  blockedReason?: string;
  updatedAt: string;
};

export type BookUserProfileItem = {
  userId: string;
  profile: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type BookRiskEventScope = "device" | "network" | "network_ua";
export type BookRiskEventType = "onboarding_completed" | "free_unlock_granted";

export type BookRiskEventItem = {
  scope: BookRiskEventScope;
  fingerprint: string;
  eventType: BookRiskEventType;
  userId: string;
  createdAt: string;
  emailVerified?: boolean;
  deviceId?: string;
  metadata?: Record<string, unknown>;
};

export type BookUserSettingsItem = {
  userId: string;
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type AccountStatus = "active" | "deactivated" | "deleted";

export type AccountStatusItem = {
  userId: string;
  status: AccountStatus;
  statusChangedAt: string;
  statusReason?: string;
  previousPlan?: "FREE" | "PRO";
  previousProSource?: string;
};

/**
 * Append-only audit record of a single account-status transition. Captures who
 * changed it (the user themselves, an admin, or the system), when, and why.
 */
export type AccountStatusChangeItem = {
  userId: string;
  status: AccountStatus;
  previousStatus?: AccountStatus | null;
  changedAt: string;
  /** "self" | "admin:<adminUserId>" | "system" */
  changedBy: string;
  reason?: string;
};

export type OpsFailureKind =
  | "stripe_cancel"
  | "stripe_cancel_at_period_end"
  | "stripe_customer_delete"
  | "cognito_delete";

/**
 * A recorded operational failure that a human operator should follow up on.
 * Currently used for Stripe subscription-cancellation failures during account
 * delete/deactivate, which previously were swallowed silently.
 */
export type OpsFailureItem = {
  id: string;
  kind: OpsFailureKind;
  /** Where the failure occurred, e.g. "account_delete" | "account_deactivate". */
  context: string;
  userId: string;
  subscriptionId?: string;
  stripeCustomerId?: string;
  errorCode?: string;
  errorMessage?: string;
  createdAt: string;
  resolvedAt?: string;
  /** Admin userId who resolved it (or "auto" when a retry succeeded). */
  resolvedBy?: string;
  resolutionNote?: string;
};

export type BookUserSavedBookItem = {
  userId: string;
  bookId: string;
  savedAt: string;
  updatedAt: string;
  source?: string;
  priority?: number;
  pinned?: boolean;
};

export type BookUserBookStateItem = {
  userId: string;
  bookId: string;
  currentChapterId: string;
  completedChapterIds: string[];
  unlockedChapterIds: string[];
  chapterScores: Record<string, number>;
  chapterCompletedAt: Record<string, string>;
  lastReadChapterId: string;
  lastOpenedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type BookUserChapterStateItem = {
  userId: string;
  bookId: string;
  chapterNumber: number;
  chapterId?: string;
  state: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type BookUserReadingDayItem = {
  userId: string;
  dayKey: string;
  totalActiveMs: number;
  updatedAt: string;
  lastActivityAt?: string;
};

export type BookUserBadgeAwardItem = {
  userId: string;
  badgeId: string;
  earnedAt: string;
  updatedAt: string;
  tier?: string;
};

// ── FSRS Spaced Repetition (§ Algorithm Feature 4) ──────────────────────────

export type FSRSCardState = {
  userId: string;
  cardId: string;
  bookId: string;
  chapterNumber: number;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  state: "new" | "learning" | "review" | "relearning";
  dueAt: string;
  lastReviewAt: string;
  front: string;
  back: string;
  createdAt: string;
  updatedAt: string;
};

export type FSRSRating = 1 | 2 | 3 | 4;

export type FSRSReviewLog = {
  userId: string;
  reviewId: string;
  cardId: string;
  bookId: string;
  rating: FSRSRating;
  scheduledDays: number;
  elapsedDays: number;
  reviewedAt: string;
  state: "new" | "learning" | "review" | "relearning";
};

// ── Adaptive Depth Routing (§ Algorithm Feature 5) ──────────────────────────

export type DepthFeatureVector = {
  avgQuizScore: number;
  avgReadingTimeRatio: number;
  recentScoreTrend: number;
  reviewCardRecall: number;
};

export type BookUserDepthModelItem = {
  userId: string;
  bookId: string;
  recommendedDepth: VariantKey;
  confidence: number;
  featureVector: DepthFeatureVector;
  lastUpdatedChapter: number;
  updatedAt: string;
};

// ── Commitment (Feature #3) ──────────────────────────────────────────────────

export type CommitmentStatus = "active" | "completed" | "skipped" | "expired";

// Structured self-report captured at follow-through time, alongside the free-text
// reflection — so "% of commitments that helped" is measurable (it is not derivable
// from free text). Set only on the `complete` action.
export type CommitmentOutcome = "helped" | "partly" | "didnt";

export type BookUserCommitmentItem = {
  userId: string;
  commitmentId: string;
  bookId: string;
  chapterNumber: number;
  ifThenPlan: string;
  commitDate: string;
  followUpDate: string;
  followUpDays: 3 | 7;
  status: CommitmentStatus;
  followThroughReflection: string | null;
  followThroughSubmittedAt: string | null;
  outcome?: CommitmentOutcome | null;
  ipAwarded: number;
  notificationSentAt: string | null;
  createdAt: string;
  updatedAt: string;
};

// ── AI Reflection Feedback (Feature #2) ──────────────────────────────────────

export type BookUserReflectionFeedbackItem = {
  userId: string;
  bookId: string;
  chapterNumber: number;
  exampleId: string;
  reflectionHash: string;
  feedbackText: string;
  model: string;
  createdAt: string;
  updatedAt: string;
};

// ── Journey (Feature #6) ─────────────────────────────────────────────────────

export type BookUserJourneyItem = {
  userId: string;
  journeyId: string;
  startedAt: string;
  currentBookIndex: number;
  completedBookIds: string[];
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type JourneyBookEntry = {
  bookId: string;
  order: number;
  reason: string;
};

export type JourneyDefinition = {
  journeyId: string;
  title: string;
  description: string;
  category: string;
  difficulty: string;
  estimatedWeeks: number;
  books: JourneyBookEntry[];
  badge: { badgeId: string; name: string; icon: string };
  bonusIP: number;
  coverGradient: [string, string];
};

// ── Reading Partner (Feature #7) ─────────────────────────────────────────────

export type BookUserPairItem = {
  userId: string;
  partnerId: string;
  pairedAt: string;
  status: "active" | "ended";
  endedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type BookPairInviteItem = {
  inviteCode: string;
  inviterUserId: string;
  status: "pending" | "accepted" | "expired";
  acceptedBy?: string;
  expiresAt: string;
  createdAt: string;
};

// ── Share Card Event (Feature #9) ────────────────────────────────────────────

export type BookUserShareEventItem = {
  userId: string;
  shareId: string;
  cardType: "chapter" | "badge" | "streak" | "book";
  destination: "clipboard" | "twitter" | "linkedin" | "download";
  bookId?: string;
  chapterNumber?: number;
  badgeId?: string;
  referralCode: string;
  createdAt: string;
};

// ── Notebook Tags (Feature #14) ──────────────────────────────────────────────

export type NotebookTagsItem = {
  userId: string;
  bookId: string;
  chapterNumber: number;
  tags: string[];
  updatedAt: string;
};

export type NotebookEntryType = "note" | "reflection" | "bookmark" | "commitment";

export type NotebookEntry = {
  id: string;
  type: NotebookEntryType;
  bookId: string;
  bookTitle: string;
  chapterNumber: number;
  chapterTitle: string;
  content: string;
  tags: string[];
  createdAt: string;
};

// ── FSRS Card State (Feature #12) ────────────────────────────────────────────

export type FsrsCardState = "new" | "learning" | "review" | "relearning";

export type FsrsCardItem = {
  userId: string;
  cardId: string;
  bookId: string;
  chapterNumber: number;
  front: string;
  back: string;
  difficulty: number;
  stability: number;
  dueDate: string;
  scheduledDays: number;
  reps: number;
  lapses: number;
  state: FsrsCardState;
  lastReviewDate: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FsrsReviewLogItem = {
  userId: string;
  reviewId: string;
  cardId: string;
  grade: 1 | 2 | 3 | 4;
  scheduledDays: number;
  elapsedDays: number;
  stability: number;
  difficulty: number;
  state: FsrsCardState;
  reviewedAt: string;
  createdAt: string;
};

// ── AI Chat (Feature #16) ────────────────────────────────────────────────────

export type AiQuestionCountItem = {
  userId: string;
  date: string;
  count: number;
  updatedAt: string;
};

export type AiCachedAnswerItem = {
  bookId: string;
  questionHash: string;
  question: string;
  answer: string;
  citations: number[];
  tone: string;
  bookVersion: number;
  hitCount: number;
  createdAt: string;
};

// ── Seasonal Event (Feature #17) ─────────────────────────────────────────────

export type EventDefinition = {
  eventId: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  books: string[];
  dailyChapterTarget: number;
  targetChapters: number;
  badge: { badgeId: string; name: string; icon: string };
  bonusIP: number;
};

export type EventDefinitionItem = EventDefinition & {
  active: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
};

export type EventParticipationItem = {
  userId: string;
  eventId: string;
  joinedAt: string;
  dailyProgress: Record<string, string[]>;
  totalChaptersCompleted: number;
  completed: boolean;
  completedAt: string | null;
  badgeAwarded: boolean;
  ipBonusAwarded: boolean;
  createdAt: string;
  updatedAt: string;
};
