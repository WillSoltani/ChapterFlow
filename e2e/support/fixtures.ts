// Fixture data for the signed-in harness (e2e/signed-in.spec.ts).
//
// Everything here is dated relative to FIXED_NOW, never to the wall clock, so a
// run on any day sees the same "today", the same streak and the same due
// reviews. The spec installs FIXED_NOW as the browser clock (page.clock) before
// the first navigation.
import catalogMetadata from "../../lib/books-catalog.metadata.json";

export type Persona = "returning" | "new";

export const FIXED_NOW = "2026-11-12T15:00:00.000Z";
export const FIXED_NOW_MS = Date.parse(FIXED_NOW);
export const TODAY = FIXED_NOW.slice(0, 10);

const DAY = 86_400_000;
const HOUR = 3_600_000;

/** An ISO timestamp `msAgo` before FIXED_NOW. */
export const at = (msAgo: number): string => new Date(FIXED_NOW_MS - msAgo).toISOString();
/** A YYYY-MM-DD day `daysAgo` before FIXED_NOW (UTC). */
export const dayKey = (daysAgo: number): string => at(daysAgo * DAY).slice(0, 10);

// ---------------------------------------------------------------- catalog
type CatalogMeta = {
  id: string;
  title: string;
  author: string;
  icon?: string;
  coverImage?: string;
  category?: string;
  categories?: string[];
  difficulty?: string;
  estimatedMinutes?: number;
  chapterCount?: number;
  synopsis?: string;
  tags?: string[];
};

const META = catalogMetadata as unknown as CatalogMeta[];

export function catalogBook(m: CatalogMeta) {
  return {
    id: m.id,
    title: m.title,
    author: m.author,
    icon: m.icon,
    coverImage: m.coverImage,
    category: m.category,
    categories: m.categories,
    difficulty: m.difficulty,
    estimatedMinutes: m.estimatedMinutes,
    chapterCount: m.chapterCount,
    synopsis: m.synopsis,
    tags: m.tags ?? [],
    variantFamily: "EMH",
    publishedVersion: 1,
  };
}

export const CATALOG = META.map(catalogBook).sort((a, b) => a.title.localeCompare(b.title));

/** Books the `returning` persona has started, and the titles the pages must show. */
export const STARTED_BOOKS = ["atomic-habits", "deep-work", "the-power-of-habit"] as const;
export const FIXTURE_BOOK_TITLE = META.find((m) => m.id === "atomic-habits")?.title ?? "Atomic Habits";

// ---------------------------------------------------------------- progress
type Prog = {
  bookId: string;
  current: number;
  unlocked: number;
  completed: number[];
  scores: Record<string, number>;
  last: string;
};

export function personaProgress(persona: Persona): Prog[] {
  if (persona === "new") return [];
  return [
    { bookId: "atomic-habits", current: 4, unlocked: 4, completed: [1, 2, 3], scores: { "1": 89, "2": 78, "3": 100 }, last: at(3 * HOUR) },
    { bookId: "deep-work", current: 2, unlocked: 2, completed: [1], scores: { "1": 86 }, last: at(2 * DAY) },
    {
      bookId: "the-power-of-habit",
      current: 9,
      unlocked: 9,
      completed: [1, 2, 3, 4, 5, 6, 7, 8, 9],
      scores: Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => [String(n), 80 + (n % 3) * 7])),
      last: at(20 * DAY),
    },
  ];
}

const chapterId = (bookId: string, n: number) => `${bookId}-ch${String(n).padStart(2, "0")}`;

// ---------------------------------------------------------------- fixtures
export type Fixtures = ReturnType<typeof buildFixtures>;

export function buildFixtures(persona: Persona) {
  const isNew = persona === "new";
  const sub = isNew ? "u-sam-rivera" : "u-maya-chen";
  const displayName = isNew ? "Sam Rivera" : "Maya Chen";
  const [givenName = "", familyName = ""] = displayName.split(" ");
  const createdAt = isNew ? at(1 * HOUR) : at(70 * DAY);
  const settingsUpdatedAt = isNew ? at(30 * 60_000) : at(40 * DAY);
  const progress = personaProgress(persona);

  const profile = {
    profile: {
      displayName,
      username: isNew ? "sam_rivera" : "maya_chen",
      tagline: "Building a calmer, sharper reading practice.",
      bio: "Using ChapterFlow to turn reading into retained insight.",
      timezone: "UTC",
      country: "Canada",
      occupation: isNew ? "Student" : "Professional",
      readingGoal: isNew ? "curiosity" : "career",
      referralSource: "Word of mouth",
      pronouns: isNew ? "They / Them" : "She / Her",
      avatarDataUrl: null,
      avatarAccent: isNew ? "emerald" : "sky",
      createdAt,
      profileVisibility: "private",
      selectedCategories: isNew ? ["Psychology", "Productivity"] : ["Productivity", "Psychology"],
      selectedBookIds: isNew ? ["atomic-habits"] : [...STARTED_BOOKS],
      dailyGoalMinutes: 20,
      onboardingCompleted: true,
      streakMode: true,
      showReadingStatsPublic: false,
      showBadgesPublic: false,
      showReadingHistoryPublic: false,
    },
    identity: {
      sub,
      email: isNew ? "sam.rivera@example.com" : "maya.chen@example.com",
      emailVerified: true,
      displayName,
      authDisplayName: displayName,
      profileDisplayName: displayName,
      givenName,
      familyName,
      preferredUsername: isNew ? "sam_rivera" : "maya_chen",
      avatarDataUrl: null,
      source: "profile",
    },
    inferredLocation: { source: "cloudfront", precision: "city", countryCode: "CA", countryName: "Canada", regionCode: "NS", regionName: "Nova Scotia", city: "Halifax" },
    updatedAt: settingsUpdatedAt,
  };

  const onboardingProfile = {
    motivation: isNew ? "curiosity" : "career",
    interests: isNew ? ["Psychology", "Productivity"] : ["Productivity", "Psychology"],
    tone: "gentle",
    dailyGoal: 20,
    chapterOrder: "summary_first",
    scenarioFocus: isNew ? "mixed" : "work",
    starterShelf: isNew ? ["atomic-habits"] : [...STARTED_BOOKS],
    firstQuizScore: 80,
    firstChapterCompleted: true,
    onboardingCompleted: true,
    onboardingCompletedAt: createdAt,
    onboardingVersion: "v2",
  };

  const settings = {
    settings: {
      appearance: { theme: "light" },
      learningMode: "standard",
      extended: { learningMode: "standard", dailyGoalPreset: 20, contentTone: "gentle" },
      notifications: {
        channels: { inApp: true, email: true, push: false },
        readingReminderEnabled: true,
        reminderTimeLocal: "20:00",
        reminderTimezone: "UTC",
        streakReminderEnabled: true,
        badgeCelebrationEnabled: true,
        achievementAlertsEnabled: true,
        weeklyDigestEnabled: true,
        welcomeBackEnabled: true,
      },
      onboarding: onboardingProfile,
      tone: "gentle",
      dailyGoal: 20,
      chapterOrder: "summary_first",
      scenarioFocus: onboardingProfile.scenarioFocus,
      whatsNewSeenAt: at(10 * DAY),
    },
    updatedAt: settingsUpdatedAt,
  };

  // Returning is FREE with 3 unlocked books (2 default slots + 1 earned), so
  // starting a fourth would hit the paywall; new is FREE with 2 open slots.
  const unlocked = isNew ? [] : [...STARTED_BOOKS];
  const freeBookSlots = isNew ? 2 : 3;
  const entitlements = {
    entitlement: {
      plan: "FREE",
      proStatus: "inactive",
      freeBookSlots,
      unlockedBookIds: unlocked,
      unlockedBooksCount: unlocked.length,
      remainingFreeStarts: Math.max(0, freeBookSlots - unlocked.length),
      cancelAtPeriodEnd: false,
    },
    paywall: {
      price: "$7.99/month",
      pricingTiers: [
        { interval: "monthly", price: "$7.99", label: "$7.99 CAD/month", period: "month" },
        { interval: "annual", price: "$5.99", label: "$5.99 CAD/month, billed annually", annualTotal: "$71.88", period: "year" },
        { interval: "annual_upfront", price: "$59.99", label: "$59.99 CAD/year", period: "year" },
      ],
      benefits: ["Unlock unlimited books", "Continue progress across devices", "Get advanced learning modes as they ship"],
    },
  };

  const notification = (id: string, type: string, title: string, body: string, ago: number, read: boolean) => ({
    userId: sub,
    notificationId: id,
    type,
    title,
    body,
    channel: "in_app",
    readAt: read ? at(ago - HOUR) : null,
    createdAt: at(ago),
  });
  const notificationItems = isNew
    ? []
    : [
        notification("ntf-3", "insight_spark", "Insight Spark", "A review card is ready. Two minutes keeps it fresh.", 6 * HOUR, false),
        notification("ntf-2", "weekly_digest", "Your week in ChapterFlow", "You finished 3 chapters and passed 3 quizzes.", 2 * DAY, false),
        notification("ntf-1", "streak_milestone", "7-day streak", "A full week of reading.", 5 * DAY, true),
      ];
  const notifications = {
    notifications: notificationItems,
    items: notificationItems,
    unreadCount: notificationItems.filter((n) => !n.readAt).length,
    nextCursor: null,
    hasMore: false,
  };

  const savedItems = isNew
    ? []
    : [{ userId: sub, bookId: "thinking-fast-and-slow", savedAt: at(7 * DAY), updatedAt: at(7 * DAY) }];
  const saved = { saved: savedItems, savedBookIds: savedItems.map((s) => s.bookId) };

  const badges = {
    awards: isNew
      ? []
      : [
          { userId: sub, badgeId: "first-book-started", earnedAt: at(60 * DAY), updatedAt: at(60 * DAY) },
          { userId: sub, badgeId: "first-chapter", earnedAt: at(59 * DAY), updatedAt: at(59 * DAY) },
          { userId: sub, badgeId: "first-quiz-pass", earnedAt: at(59 * DAY), updatedAt: at(59 * DAY) },
        ],
  };

  const card = (cardId: string, bookId: string, chapterNumber: number, front: string, back: string, dueAgo: number) => ({
    userId: sub,
    cardId,
    bookId,
    chapterNumber,
    stability: 6.1,
    difficulty: 5.2,
    elapsedDays: 3,
    scheduledDays: 3,
    reps: 3,
    lapses: 0,
    state: "review",
    dueAt: at(dueAgo),
    lastReviewAt: at(3 * DAY),
    front,
    back,
    createdAt: at(50 * DAY),
    updatedAt: at(3 * DAY),
    retrievability: 0.82,
  });
  const dueCards = isNew
    ? []
    : [
        card("card-ah-1", "atomic-habits", 1, "Why focus on systems instead of goals?", "Systems are what produce progress; goals only set a direction.", DAY),
        card("card-ah-2", "atomic-habits", 2, "What are the three layers of behavior change?", "Outcomes, processes and identity.", 6 * HOUR),
        card("card-dw-1", "deep-work", 1, "How does Newport define deep work?", "Distraction-free concentration that pushes cognitive limits.", 2 * HOUR),
      ];
  const futureCards = isNew
    ? []
    : [card("card-ah-3", "atomic-habits", 3, "Name the four stages of the habit loop.", "Cue, craving, response, reward.", -3 * DAY)];
  const reviews = { cards: dueCards, count: dueCards.length, items: dueCards, nextCursor: null, hasMore: false };
  const reviewsAll = { cards: [...dueCards, ...futureCards] };
  const reviewsStats = {
    stats: {
      totalCards: dueCards.length + futureCards.length,
      dueCards: dueCards.length,
      avgRetrievability: isNew ? 0 : 0.84,
      bookIds: isNew ? [] : ["atomic-habits", "deep-work"],
    },
  };

  const streak = isNew
    ? { currentStreak: 0, longestStreak: 0, lastActiveDate: null, shieldsHeld: 0, consistencyScore: 0, nextMilestone: { days: 3, ip: 25, daysRemaining: 3 }, milestonesReached: [] }
    : { currentStreak: 12, longestStreak: 12, lastActiveDate: TODAY, shieldsHeld: 1, consistencyScore: 80, nextMilestone: { days: 14, ip: 100, daysRemaining: 2 }, milestonesReached: [3, 7] };

  const balance = isNew ? 0 : 1240;
  const flowPoints = {
    summary: {
      balance,
      lifetimeEarned: isNew ? 0 : 2140,
      lifetimeSpent: isNew ? 0 : 900,
      rewardReadyCount: 0,
      nextReward: {
        rewardId: "pro_pass_7d",
        name: "7-Day Pro Pass",
        costPoints: 2400,
        pointsRemaining: 2400 - balance,
        progressPercent: Math.round((balance / 2400) * 100),
      },
    },
    rewards: [],
    recentTransactions: isNew
      ? []
      : [
          { transactionId: "tx-2", direction: "earn", amount: 150, sourceType: "loop_complete", rewardId: null, title: "Learning loop completed", subtitle: null, createdAt: at(DAY) },
          { transactionId: "tx-1", direction: "earn", amount: 120, sourceType: "onboarding_complete", rewardId: null, title: "Onboarding complete", subtitle: null, createdAt: at(60 * DAY) },
        ],
    referral: { code: "FIXTURE1", path: "/ref/FIXTURE1", pendingInvites: 0, activatedInvites: 0, proInvites: 0, activationPointsEarned: 0, proPointsEarned: 0 },
    waysToEarn: [],
  };

  const tiers = [
    ["reader", "Reader", 0, 0, 0],
    ["analyst", "Analyst", 25, 70, 2],
    ["synthesizer", "Synthesizer", 100, 75, 5],
    ["polymath", "Polymath", 300, 80, 10],
    ["luminary", "Luminary", 750, 85, 11],
  ] as const;
  const tier = {
    currentTier: "reader",
    currentTierDisplay: "Reader",
    loopsCompleted: isNew ? 0 : 7,
    avgQuizScore: isNew ? 0 : 90,
    categoriesExplored: isNew ? 0 : 2,
    nextTier: {
      name: "analyst",
      displayName: "Analyst",
      loopsRequired: 25,
      loopsRemaining: isNew ? 25 : 18,
      loopsPercent: isNew ? 0 : 28,
      avgScoreRequired: 70,
      avgScoreMet: !isNew,
      categoriesRequired: 2,
      categoriesRemaining: isNew ? 2 : 0,
      categoriesPercent: isNew ? 0 : 100,
    },
    tiers: tiers.map(([name, displayName, loopsRequired, avgScoreRequired, categoriesRequired], i) => ({
      name,
      displayName,
      loopsRequired,
      avgScoreRequired,
      categoriesRequired,
      identityStatement: `You read as a ${displayName}.`,
      reached: i === 0,
    })),
  };

  const events = { events: [] };
  const journeys = { journeys: [] };
  const notebook = { entries: [], items: [], totalCount: 0, nextCursor: null, hasMore: false };
  const onboardingProgress = { onboardingCompleted: true, progress: null, preferences: onboardingProfile };
  const commitments = { commitments: [] };
  const pairs = { pair: null, partner: null };
  const progressList = {
    summary: {},
    books: progress.map((p) => ({
      bookId: p.bookId,
      pinnedBookVersion: "v21",
      currentChapterNumber: p.current,
      unlockedThroughChapterNumber: p.unlocked,
      completedChapters: p.completed,
      bestScoreByChapter: p.scores,
      lastOpenedAt: p.last,
      lastActiveAt: p.last,
      updatedAt: p.last,
    })),
  };
  const shop = { items: [], giftAFriend: { id: "gift-a-friend", name: "Gift a Friend", ipCost: 500, affordable: balance >= 500 }, balance, currentTier: "reader" };
  const search = CATALOG.map((b) => ({
    id: `book:${b.id}`,
    type: "book",
    bookId: b.id,
    bookTitle: b.title,
    author: b.author,
    text: `${b.title} by ${b.author}`,
    tags: b.tags,
    categories: b.categories ?? [],
  }));

  // me/dashboard: what Home, Library and Progress read in one request.
  const readingDays = isNew
    ? []
    : [...Array.from({ length: 12 }, (_, i) => i), 16, 17, 19, 23, 24, 30].map((i) => ({
        userId: sub,
        dayKey: dayKey(i),
        totalActiveMs: (12 + ((i * 7) % 25)) * 60_000,
        updatedAt: at(i * DAY),
      }));
  const dashboard = {
    catalog: CATALOG,
    entitlement: {
      userId: sub,
      plan: entitlements.entitlement.plan,
      proStatus: entitlements.entitlement.proStatus,
      freeBookSlots,
      unlockedBookIds: unlocked,
      updatedAt: at(DAY),
    },
    profile: profile.profile,
    settings: settings.settings,
    progress: progress.map((p) => ({
      userId: sub,
      bookId: p.bookId,
      pinnedBookVersion: 1,
      contentPrefix: "x",
      manifestKey: "x",
      currentChapterNumber: p.current,
      unlockedThroughChapterNumber: p.unlocked,
      completedChapters: p.completed,
      bestScoreByChapter: p.scores,
      lastOpenedAt: p.last,
      lastActiveAt: p.last,
      updatedAt: p.last,
      createdAt: at(60 * DAY),
    })),
    bookStates: progress.map((p) => ({
      userId: sub,
      bookId: p.bookId,
      currentChapterId: chapterId(p.bookId, p.current),
      completedChapterIds: p.completed.map((n) => chapterId(p.bookId, n)),
      unlockedChapterIds: Array.from({ length: p.unlocked }, (_, i) => chapterId(p.bookId, i + 1)),
      chapterScores: Object.fromEntries(Object.entries(p.scores).map(([n, s]) => [chapterId(p.bookId, Number(n)), s])),
      chapterCompletedAt: Object.fromEntries(p.completed.map((n, i) => [chapterId(p.bookId, n), at((p.completed.length - i) * 2 * DAY)])),
      lastReadChapterId: chapterId(p.bookId, p.current),
      lastOpenedAt: p.last,
      createdAt: at(60 * DAY),
      updatedAt: p.last,
    })),
    chapterStates: progress.flatMap((p) =>
      p.completed.map((n) => ({
        userId: sub,
        bookId: p.bookId,
        chapterNumber: n,
        chapterId: chapterId(p.bookId, n),
        state: { activeTab: "quiz", readingDepth: "medium", quizResult: { score: p.scores[String(n)] ?? 80, passed: true } },
        createdAt: at(30 * DAY),
        updatedAt: at(5 * DAY),
      })),
    ),
    saved: savedItems,
    readingDays,
    badgeAwards: badges.awards,
    insightPointsBalance: balance,
    partial: false,
    warnings: [] as string[],
  };

  return {
    sub,
    settingsUpdatedAt,
    profile,
    settings,
    entitlements,
    notifications,
    saved,
    badges,
    reviews,
    reviewsAll,
    reviewsStats,
    streak,
    flowPoints,
    tier,
    events,
    journeys,
    notebook,
    onboardingProgress,
    commitments,
    pairs,
    progressList,
    shop,
    search,
    dashboard,
  };
}
