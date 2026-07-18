// ── BookPackage domain model (RAW / tone-keyed stage) ───────────────────────
//
// The BookPackage type family is single-sourced in `lib/book-package-types.ts`
// (see WS3-008). This module is the RAW-stage surface: it re-exports the raw
// (tone-keyed) definitions under their historical server names so every existing
// `./types` consumer keeps working unchanged. The tone-FLATTENED reader stage
// lives in `app/book/data/book-package-core.ts`. Do not redefine these here — edit
// the canonical module.
import type {
  VariantFamily,
  VariantKey,
  ToneKeyed,
  OneMinuteRecapToneKeyed,
  SummaryBlock as ChapterSummaryBlock,
  RawVariantContent as ChapterVariantContent,
  RawQuizQuestion as BookPackageQuizQuestion,
  RawQuiz as BookPackageQuiz,
  RawExample as BookPackageExample,
  RawReviewCard as ReviewCard,
  RawImplementationPlan as ImplementationPlan,
  V21ReaderPattern,
  V21ExperiencePlan,
  V21ChapterExtras,
  RawChapter as BookPackageChapter,
  BookPackageEdition,
  RawBook as BookPackageBook,
  ConceptNode,
  ConceptEdge,
  ConceptGraph,
  RawBookPackage as BookPackage,
} from "@/lib/book-package-types";

export type {
  VariantFamily,
  VariantKey,
  ToneKeyed,
  OneMinuteRecapToneKeyed,
  ChapterSummaryBlock,
  ChapterVariantContent,
  BookPackageQuizQuestion,
  BookPackageQuiz,
  BookPackageExample,
  ReviewCard,
  ImplementationPlan,
  V21ReaderPattern,
  V21ExperiencePlan,
  V21ChapterExtras,
  BookPackageChapter,
  BookPackageEdition,
  BookPackageBook,
  ConceptNode,
  ConceptEdge,
  ConceptGraph,
  BookPackage,
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
  /** How the user obtained PRO — "stripe" for a paid Stripe subscription, "apple" for an App Store / StoreKit in-app subscription, "license" for a free-pass key, "flow_points" for a timed reward pass, "gift_code" for a gifted Pro window. Apple and promotional sources expire at read time; signed notifications also reconcile stored state (see getUserEntitlement). */
  proSource?: "stripe" | "apple" | "license" | "flow_points" | "gift_code" | "admin";
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
  /**
   * High-water mark of the most recent Stripe webhook `event.created` (epoch
   * seconds) applied to this entitlement. Set by updateUserEntitlementFromStripe
   * to reject out-of-order/reordered Stripe events; see
   * stripe-entitlement-write-core.ts. Dispute writes do not touch it.
   */
  lastStripeEventAt?: number;
  /** Apple `originalTransactionId` — stable identity of the App Store subscription (if proSource === "apple") */
  appleOriginalTransactionId?: string;
  /** Apple product id of the current App Store subscription (if proSource === "apple") */
  appleProductId?: string;
  /**
   * High-water mark of the most recent Apple `signedDate` (epoch MILLISECONDS)
   * applied to this entitlement. Set by updateUserEntitlementFromApple to reject
   * out-of-order App Store Server Notifications / re-verifications; see
   * apple-entitlement-write-core.ts. The Apple mirror of lastStripeEventAt.
   */
  lastAppleSignedDate?: number;
  /**
   * Sticky chargeback marker set by charge.dispute.created and cleared only when
   * the dispute is won. Blocks Stripe re-activation (the webhook grant write is
   * refused by attribute_not_exists(disputeOpen)) and new Stripe Checkout until
   * the dispute is resolved. Absent when no dispute is open.
   */
  disputeOpen?: boolean;
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
  // Monotonic optimistic-concurrency counter for the canonical PROGRESS#<bookId> item.
  // Bumped on every quiz-pass mutation and used as the write guard so a stale full-row
  // write can't clobber a concurrently-advanced row. Absent on legacy items (treated
  // as 0). See progress-write-core.ts.
  progressRev?: number;
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

/**
 * Push transport a device row targets. `"web"` = a browser Web-Push
 * subscription (VAPID); `"ios"` = an Apple Push Notification service (APNs)
 * device token from the native iOS app. The send path (notifications-repo →
 * push-service) branches on this to pick web-push vs APNs.
 */
export type DevicePlatform = "web" | "ios";

/**
 * A registered push target for one user+device.
 *
 * Web-Push rows carry `endpoint` + `keys` (p256dh/auth) and `platform:"web"`.
 * iOS/APNs rows carry `apnsToken` (the hex device token) and `platform:"ios"`;
 * the web-push `endpoint`/`keys` are absent. Fields are optional at the type
 * level because the two platforms populate disjoint subsets — the register
 * route validates that the right subset is present for the declared platform
 * (see device-register-core.ts). The DynamoDB SK is a hash of the endpoint
 * (web) or the apnsToken (ios), so distinct devices never collide.
 */
export type BookUserDeviceTokenItem = {
  userId: string;
  /** Web-Push service endpoint URL. Present only when platform === "web". */
  endpoint?: string;
  /** Web-Push encryption keys. Present only when platform === "web". */
  keys?: { p256dh: string; auth: string };
  /** APNs device token (lowercase hex). Present only when platform === "ios". */
  apnsToken?: string;
  platform: DevicePlatform;
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
  | "cognito_delete"
  // Step-up session revocation (AdminUserGlobalSignOut) on self-delete /
  // deactivate failed — sessions may NOT have been revoked. Operator follow-up.
  | "cognito_global_signout"
  // Sign in with Apple token revocation on account delete failed for an
  // Apple-linked user that held a revocable token — Apple's /auth/revoke errored
  // after retries. Operator follow-up (App Review requires the token be revoked).
  | "apple_token_revoke";

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
  // Count of scored chapters folded into this model (NOT a chapter number).
  // Drives the recommendation's "enough data" gate. Optional for backward-compat
  // with items written before this counter existed — see depthModelDataPoints().
  dataPoints?: number;
  lastUpdatedChapter: number;
  updatedAt: string;
};

// ── Commitment (Feature #3) ──────────────────────────────────────────────────

export type CommitmentStatus = "active" | "completed" | "skipped" | "expired";

// Structured self-report captured at follow-through time, alongside the free-text
// reflection — so "% of commitments that helped" is measurable (it is not derivable
// from free text). Set only on the `complete` action.
export type CommitmentOutcome = "helped" | "partly" | "didnt";

// Two-axis completion (feedback #4): the APPLICATION axis — "you used it" — DERIVED
// from commitment follow-through, never stored on BookUserProgress, never a gate,
// awards no IP. The quiz pass (`knowledgeComplete`) stays the sole completion gate.
// Precedence is by status-strength, not recency: applied > committed > none.
//   - "applied"   = a commitment was followed through (returned days later + reported)
//   - "committed" = an if-then commitment is active (not yet followed through)
//   - "none"      = no commitment, or only skipped/expired
export type ChapterApplicationState = "none" | "committed" | "applied";

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

export type NotebookEntryType =
  | "note"
  | "reflection"
  | "bookmark"
  | "commitment"
  | "highlight";

/**
 * Highlight colours the iOS reader may tag a selection with. A small closed
 * enum so a client can't write an unbounded/garbage colour; the server
 * validates against this set (see notebook-highlights-core.ts).
 */
export type HighlightColor = "yellow" | "green" | "blue" | "pink" | "orange";

/**
 * Opaque position anchor for a reader highlight. The server validates it for
 * SHAPE only (field presence + types) and never interprets it — the iOS reader
 * owns the meaning and uses it to re-locate the selection inside a rendered
 * chapter block. Persisted verbatim and echoed back untouched.
 */
export type HighlightAnchor = {
  variant: string;
  tone: string;
  blockIndex: number;
  blockType: string;
  startChar: number;
  endChar: number;
};

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
  // Highlight-only fields (Feature B6). Present ONLY on `type: "highlight"`
  // entries; omitted for every existing entry type, which keeps the existing
  // note/bookmark/commitment shape unchanged.
  color?: HighlightColor;
  snippet?: string;
  anchor?: HighlightAnchor;
};

/**
 * Persisted reader-highlight record. Lives under the user partition
 * (`BOOKUSER#<sub>`) keyed `HIGHLIGHT#<highlightId>` (see `highlightSk`), so the
 * account-erasure partition sweep reaches it and a per-user Query enumerates all
 * of a user's highlights. Unlike notes/bookmarks (projected from chapter state)
 * and commitments, highlights are first-class user-created rows.
 */
export type BookUserHighlightItem = {
  userId: string;
  highlightId: string;
  bookId: string;
  bookTitle: string;
  chapterNumber: number;
  chapterTitle: string;
  color: HighlightColor;
  snippet: string;
  anchor: HighlightAnchor;
  createdAt: string;
  updatedAt: string;
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
