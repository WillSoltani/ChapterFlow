// Ordering + error-handling policy coverage for the quiz-submit loop-completion
// saga (WS3-003). The saga is money-adjacent and its side-effect ORDER + which
// failures are swallowed / recorded / propagated must stay byte-identical to the
// shipped inline route. These drive the pure `runLoopCompletionSaga` policy with
// injected recording mocks — no DynamoDB, no `server-only` transitive imports.
//
// Cases (derived from the shipped route):
//   1. happy-path — asserts the EXACT ordered sequence of side-effect calls.
//   2. swallowed-failure — a non-critical step (FSRS seed) throwing does NOT fail
//      the loop and does NOT block the completion marker.
//   3. critical-failure — the attempt-persist (recordQuizOutcome) throwing PROPAGATES
//      and no downstream step runs.
//   4. recorded-failure — a pipelineErrors step (streak) throwing does NOT fail the
//      loop but DOES block markLoopPipelineCompleted (and skips achievements).

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  runLoopCompletionSaga,
  type LoopCompletionContext,
  type LoopCompletionDeps,
} from "./quiz-submit-core";

// Derive the concrete return types straight from the dep contract so the fixtures
// need no imports from the AWS-backed repo modules.
type StreakResult = Awaited<ReturnType<LoopCompletionDeps["updateStreak"]>>;
type TierResult = Awaited<ReturnType<LoopCompletionDeps["updateTier"]>>;
type AchievementResults = Awaited<ReturnType<LoopCompletionDeps["checkAchievements"]>>;
type JourneyResults = Awaited<ReturnType<LoopCompletionDeps["checkAndAdvanceJourneys"]>>;
type ChapterContent = NonNullable<Awaited<ReturnType<LoopCompletionDeps["readChapterContent"]>>>;
type EventDefs = Awaited<ReturnType<LoopCompletionDeps["listEventDefinitions"]>>;
type UserEvents = Awaited<ReturnType<LoopCompletionDeps["listUserEvents"]>>;

const streakFixture = {
  streak: {
    currentStreak: 3,
    longestStreak: 5,
    streakShieldsHeld: 1,
    lastActiveDate: "2026-07-18",
  },
  streakReset: false,
  shieldsConsumed: 0,
  streakDayAwarded: true,
  welcomeBackAwarded: false,
  milestonesAwarded: [{ days: 3, ip: 15 }],
  gapDays: 0,
} as unknown as StreakResult;

const tierFixture = {
  advanced: true,
  newTier: "silver",
  definition: { displayName: "Silver" },
  advancementIP: 50,
  tier: { completedBooksByCategory: { psychology: ["b1"] } },
} as unknown as TierResult;

const achievementFixture: AchievementResults = [
  {
    achievementId: "a1",
    name: "First Loop",
    track: "consistency",
    ipAwarded: 10,
    celebrationCopy: "Nice!",
    isHidden: false,
  },
];

const journeyFixture: JourneyResults = [
  {
    journeyId: "j1",
    advanced: true,
    completed: true,
    bonusIPAwarded: 25,
    badgeAwarded: null,
  },
];

const chapterFixture = {
  reviewCards: [{ id: "c1" }],
  readingTimeMinutes: 12,
} as unknown as ChapterContent;

const eventDefFixture = {
  eventId: "e1",
  active: true,
  startDate: "2000-01-01T00:00:00.000Z",
  endDate: "2999-01-01T00:00:00.000Z",
  books: ["book-1"],
} as unknown as EventDefs[number];

const userEventsFixture = [{ eventId: "e1" }] as unknown as UserEvents;

function makeDeps(
  calls: string[],
  overrides: Partial<LoopCompletionDeps> = {},
): LoopCompletionDeps {
  const base: LoopCompletionDeps = {
    recordQuizOutcome: async () => {
      calls.push("recordQuizOutcome");
    },
    awardQuizPassPoints: async () => {
      calls.push("awardQuizPassPoints");
      return true;
    },
    awardBookCompletePoints: async () => {
      calls.push("awardBookCompletePoints");
      return true;
    },
    putLoopRecord: async () => {
      calls.push("putLoopRecord");
    },
    incrementDailyMetrics: async () => {
      calls.push("incrementDailyMetrics");
    },
    markLoopStep: async (field) => {
      calls.push(`markLoopStep:${field}`);
    },
    readChapterContent: async () => {
      calls.push("readChapterContent");
      return chapterFixture;
    },
    seedFsrsCards: async () => {
      calls.push("seedFsrsCards");
    },
    updateDepthModel: async () => {
      calls.push("updateDepthModel");
    },
    updateStreak: async () => {
      calls.push("updateStreak");
      return streakFixture;
    },
    updateTier: async () => {
      calls.push("updateTier");
      return tierFixture;
    },
    getBookStartedAt: async () => {
      calls.push("getBookStartedAt");
      return "2026-07-01T00:00:00.000Z";
    },
    checkAchievements: async () => {
      calls.push("checkAchievements");
      return achievementFixture;
    },
    maybeAwardInsightSpark: async () => {
      calls.push("maybeAwardInsightSpark");
      return { triggered: true, amount: 40 };
    },
    createNotification: async (params) => {
      calls.push(`createNotification:${params.type}`);
      return { created: true };
    },
    listEventDefinitions: async () => {
      calls.push("listEventDefinitions");
      return [eventDefFixture];
    },
    listUserEvents: async () => {
      calls.push("listUserEvents");
      return userEventsFixture;
    },
    recordEventChapter: async () => {
      calls.push("recordEventChapter");
      return null;
    },
    checkAndAdvanceJourneys: async () => {
      calls.push("checkAndAdvanceJourneys");
      return journeyFixture;
    },
    markLoopPipelineCompleted: async () => {
      calls.push("markLoopPipelineCompleted");
    },
    logError: () => {},
  };
  return { ...base, ...overrides };
}

function passCtx(overrides: Partial<LoopCompletionContext> = {}): LoopCompletionContext {
  return {
    passed: true,
    completedBookNow: true,
    userId: "u1",
    bookId: "book-1",
    chapterNumber: 2,
    ts: "2026-07-18T00:00:00.000Z",
    timezone: "UTC",
    learningMode: "standard",
    isFirstAttempt: true,
    gradedScorePercent: 100,
    timeSpentSeconds: 300,
    pinnedChapterCount: 5,
    quizPassTotalPoints: 20,
    perfectBonus: 5,
    bookCompleteIP: 120,
    streakDayBonusIP: 15,
    welcomeBackIP: 30,
    ...overrides,
  };
}

test("happy path runs every side effect in the shipped order", async () => {
  const calls: string[] = [];
  const result = await runLoopCompletionSaga(makeDeps(calls), passCtx());

  assert.deepEqual(calls, [
    "recordQuizOutcome",
    "awardQuizPassPoints",
    "awardBookCompletePoints",
    "putLoopRecord",
    "incrementDailyMetrics",
    "readChapterContent",
    "seedFsrsCards",
    "markLoopStep:fsrsSeededAt",
    "updateDepthModel",
    "markLoopStep:depthModelUpdatedAt",
    "updateStreak",
    "markLoopStep:streakUpdatedAt",
    "updateTier",
    "markLoopStep:tierUpdatedAt",
    "getBookStartedAt",
    "checkAchievements",
    "markLoopStep:achievementsCheckedAt",
    "maybeAwardInsightSpark",
    "markLoopStep:insightSparkCheckedAt",
    "createNotification:tier_up",
    "createNotification:badge_earned",
    "createNotification:streak_milestone",
    "createNotification:insight_spark",
    "listEventDefinitions",
    "listUserEvents",
    "recordEventChapter",
    "markLoopStep:eventTrackingCheckedAt",
    "checkAndAdvanceJourneys",
    "markLoopStep:journeyAdvancedAt",
    "createNotification:badge_earned",
    "markLoopPipelineCompleted",
  ]);

  // Result payload is assembled from the step outputs + the award flags.
  assert.equal(result.quizPassAwarded, true);
  assert.equal(result.bookCompleteAwarded, true);
  assert.ok(result.loopPipeline);
  assert.equal(result.loopPipeline?.quizPassIP, 15); // 20 total - 5 perfect bonus
  assert.equal(result.loopPipeline?.perfectBonusIP, 5);
  assert.equal(result.loopPipeline?.bookCompleteIP, 120);
  assert.equal(result.loopPipeline?.streak.currentStreak, 3);
  assert.equal(result.loopPipeline?.streak.streakDayIP, 15);
  assert.equal(result.loopPipeline?.tier.advanced, true);
  assert.equal(result.loopPipeline?.achievements.length, 1);
  assert.equal(result.loopPipeline?.insightSpark.amount, 40);
  assert.equal(result.loopPipeline?.journeys?.length, 1);
});

test("a non-critical step failure (FSRS seed) does not fail the loop or block completion", async () => {
  const calls: string[] = [];
  const deps = makeDeps(calls, {
    seedFsrsCards: async () => {
      calls.push("seedFsrsCards");
      throw new Error("fsrs boom");
    },
  });

  const result = await runLoopCompletionSaga(deps, passCtx());

  // The loop still completes and the pipeline payload is built...
  assert.ok(result.loopPipeline);
  // ...the FSRS marker is NOT stamped (the seed threw before it)...
  assert.equal(calls.includes("markLoopStep:fsrsSeededAt"), false);
  // ...but downstream steps still ran and the completion marker was still set
  // (FSRS is swallowed, never added to pipelineErrors).
  assert.equal(calls.includes("updateStreak"), true);
  assert.equal(calls.includes("markLoopPipelineCompleted"), true);
});

test("a critical failure (attempt persist) propagates and aborts the saga", async () => {
  const calls: string[] = [];
  const deps = makeDeps(calls, {
    recordQuizOutcome: async () => {
      calls.push("recordQuizOutcome");
      throw new Error("persist boom");
    },
  });

  await assert.rejects(runLoopCompletionSaga(deps, passCtx()), /persist boom/);
  // Nothing after the critical persist ran — no awards, no pipeline.
  assert.deepEqual(calls, ["recordQuizOutcome"]);
});

test("a recorded-failure step (streak) is swallowed but blocks the completion marker", async () => {
  const calls: string[] = [];
  const deps = makeDeps(calls, {
    updateStreak: async () => {
      calls.push("updateStreak");
      throw new Error("streak boom");
    },
  });

  const result = await runLoopCompletionSaga(deps, passCtx());

  // Loop does not throw and still returns a pipeline payload...
  assert.ok(result.loopPipeline);
  // ...streak marker not stamped, and with no streak result achievements are skipped...
  assert.equal(calls.includes("markLoopStep:streakUpdatedAt"), false);
  assert.equal(calls.includes("checkAchievements"), false);
  // ...tier still ran (independent step)...
  assert.equal(calls.includes("updateTier"), true);
  // ...but the completion marker is NOT set (pipelineErrors is non-empty).
  assert.equal(calls.includes("markLoopPipelineCompleted"), false);
  // Streak block falls back to zeros when the streak update failed.
  assert.equal(result.loopPipeline?.streak.currentStreak, 0);
});

test("a failed quiz persists the attempt but runs no awards or loop pipeline", async () => {
  const calls: string[] = [];
  const result = await runLoopCompletionSaga(makeDeps(calls), passCtx({ passed: false }));

  assert.deepEqual(calls, ["recordQuizOutcome"]);
  assert.equal(result.loopPipeline, null);
  assert.equal(result.quizPassAwarded, false);
  assert.equal(result.bookCompleteAwarded, false);
});
