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

export type ChapterVariantContent = {
  summaryBullets?: string[];
  summaryBlocks?: ChapterSummaryBlock[];
  takeaways?: string[];
  practice?: string[];
  /** Modern format: tone-keyed chapter breakdown narrative */
  chapterBreakdown?: ToneKeyed;
  /** Modern format: tone-keyed takeaway objects */
  keyTakeaways?: Array<{ point: ToneKeyed }>;
  /** Modern format: tone-keyed one-minute recap */
  oneMinuteRecap?: ToneKeyed;
};

export type BookPackageQuizQuestion = {
  questionId: string;
  prompt: string;
  choices: string[];
  correctAnswerIndex: number;
  explanation?: string;
};

export type BookPackageQuiz = {
  passingScorePercent: number;
  questions: BookPackageQuizQuestion[];
  retryQuestions?: BookPackageQuizQuestion[];
};

export type BookPackageExample = {
  exampleId: string;
  title: string;
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
  cardId: string;
  front: ToneKeyed;
  back: ToneKeyed;
};

/** Tone-keyed implementation plan */
export type ImplementationPlan = {
  coreSkill: ToneKeyed;
  [key: string]: ToneKeyed | unknown;
};

export type BookPackageChapter = {
  chapterId: string;
  number: number;
  title: string;
  readingTimeMinutes: number;
  contentVariants: Partial<Record<VariantKey, ChapterVariantContent>>;
  examples: BookPackageExample[];
  quiz: BookPackageQuiz;
  implementationPlan?: ImplementationPlan;
  reviewCards?: ReviewCard[];
  keyTakeawayCard?: ToneKeyed;
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
  edition?: string;
  variantFamily: VariantFamily;
  chapters: BookPackageChapter[];
};

export type BookPackage = {
  schemaVersion: string;
  packageId: string;
  createdAt: string;
  contentOwner: string;
  licenseNotes?: string;
  book: BookPackageBook;
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
  /** How the user obtained PRO — "stripe" for paid subscription, "license" for a free-pass key, "flow_points" for a timed reward pass */
  proSource?: "stripe" | "license" | "flow_points";
  freeBookSlots: number;
  unlockedBookIds: string[];
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  currentPeriodEnd?: string;
  /** The license key code that granted PRO access (if proSource === "license") */
  licenseKey?: string;
  /** ISO date when the license-based PRO expires (if proSource === "license") */
  licenseExpiresAt?: string;
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
