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

export type ChapterVariantContent = {
  summaryBullets: string[];
  summaryBlocks?: ChapterSummaryBlock[];
  takeaways: string[];
  practice?: string[];
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
  scenario: string;
  whatToDo: string[];
  whyItMatters: string;
  contexts?: string[];
};

export type BookPackageChapter = {
  chapterId: string;
  number: number;
  title: string;
  readingTimeMinutes: number;
  contentVariants: Partial<Record<VariantKey, ChapterVariantContent>>;
  examples: BookPackageExample[];
  quiz: BookPackageQuiz;
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
  /** How the user obtained PRO — "stripe" for paid subscription, "license" for a free-pass key */
  proSource?: "stripe" | "license";
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
  scorePercent: number;
  passed: boolean;
  createdAt: string;
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
  createdAt: string;
  updatedAt: string;
};

export type BookUserProfileItem = {
  userId: string;
  profile: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
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
