// Pure, DynamoDB-free orchestration policy for the quiz-submit loop-completion
// saga (WS3-003). This is the *-core seam: it owns WHICH steps run, in WHAT
// order, what is awaited vs fire-and-forget, and which failures are swallowed vs
// recorded vs propagated — behind INJECTED dependencies so the policy can be
// unit-tested without reaching real DynamoDB (the repos it wires pull the AWS
// client in at module load and can't be imported under `tsx --test`).
//
// Behaviour is a byte-for-byte lift of the inline saga that used to live in
// app/app/api/book/me/quiz/[bookId]/[chapterNumber]/submit/route.ts. Nothing
// here decides anything new — the domain reads/writes are the same functions,
// called in the same sequence, with the same swallow/propagate semantics.
//
// ── Ordered side-effect policy (graded.passed path) ──────────────────────────
//   recordQuizOutcome           — CRITICAL (propagates on failure → aborts)
//   [fail path returns here]
//   awardQuizPassPoints         — CRITICAL
//   awardBookCompletePoints     — CRITICAL (only when completedBookNow)
//   Step 1  putLoopRecord       — awaited, idempotent → swallowed
//   ~       incrementDailyMetrics — FIRE-AND-FORGET (.catch)
//   ~       readChapterContent  — awaited, try/catch → null on failure
//   Step1.5 seedFsrsCards       — awaited, try/catch → swallowed (NOT recorded)
//   Step1.6 updateDepthModel    — awaited, try/catch → swallowed (NOT recorded)
//   Step 2  updateStreak        — awaited, try/catch → pipelineErrors "streak"
//   Step 3  updateTier          — awaited, try/catch → pipelineErrors "tier"
//   Step 4  checkAchievements   — gated on streak&&tier; else "achievements_skipped"
//   Step 5  maybeAwardInsightSpark — awaited, try/catch → pipelineErrors "insight_spark"
//   ~       createNotification  — FIRE-AND-FORGET (tier / achievements / streak / spark)
//   Step 6  event tracking      — awaited, try/catch → pipelineErrors "event_tracking"
//   Step 7  checkAndAdvanceJourneys — only when completedBookNow; → "journey_advancement"
//   markLoopPipelineCompleted   — ONLY when pipelineErrors is empty; try/catch → swallowed
//
// Each successful step also stamps a per-step marker via markLoopStep (best-effort;
// its own rejections are swallowed, mirroring the route's `.catch(() => {})`).

import type { LoopPipelineResult } from "@/app/book/_lib/flow-points-economy";
import type {
  BookUserNotificationItem,
  ChapterSummaryPayload,
  EventDefinitionItem,
  EventParticipationItem,
  ReviewCard,
} from "./types";
import type { StreakUpdateResult } from "./streak-repo";
import type { TierUpdateResult } from "./tier-repo";
import type { AchievementAwardResult, AchievementCheckContext } from "./achievement-repo";
import type { JourneyAdvancementResult } from "./journey-repo";

/** In-app notification the saga fires (best-effort); tableName is injected by the dep. */
export interface LoopNotificationInput {
  userId: string;
  type: BookUserNotificationItem["type"];
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
}

/**
 * Injected side effects. Each closes over its own table/user/book identifiers in
 * the service layer, so the pure policy only chooses call order + error handling.
 */
export interface LoopCompletionDeps {
  // ── Critical writes (a rejection propagates and aborts the whole request) ──
  recordQuizOutcome: () => Promise<void>;
  awardQuizPassPoints: () => Promise<boolean>;
  awardBookCompletePoints: () => Promise<boolean>;

  // ── Loop pipeline side effects ──
  putLoopRecord: () => Promise<void>;
  incrementDailyMetrics: () => Promise<void>;
  markLoopStep: (field: string) => Promise<void>;
  readChapterContent: () => Promise<ChapterSummaryPayload | null>;
  seedFsrsCards: (reviewCards: ReviewCard[]) => Promise<void>;
  updateDepthModel: (
    scorePercent: number,
    actualMinutes: number,
    readingTimeMinutes: number,
  ) => Promise<void>;
  updateStreak: () => Promise<StreakUpdateResult>;
  updateTier: () => Promise<TierUpdateResult>;
  getBookStartedAt: () => Promise<string | undefined>;
  checkAchievements: (
    ctx: Omit<AchievementCheckContext, "tableName">,
  ) => Promise<AchievementAwardResult[]>;
  maybeAwardInsightSpark: (dateStr: string) => Promise<{ triggered: boolean; amount: number }>;
  createNotification: (params: LoopNotificationInput) => Promise<unknown>;
  listEventDefinitions: () => Promise<EventDefinitionItem[]>;
  listUserEvents: () => Promise<EventParticipationItem[]>;
  recordEventChapter: (
    eventId: string,
    chapterId: string,
    eventDef: EventDefinitionItem,
  ) => Promise<unknown>;
  checkAndAdvanceJourneys: () => Promise<JourneyAdvancementResult[]>;
  markLoopPipelineCompleted: () => Promise<void>;

  logError: (...args: unknown[]) => void;
}

/** Pure inputs (already computed by the service) the policy needs to branch + build its result. */
export interface LoopCompletionContext {
  passed: boolean;
  completedBookNow: boolean;
  userId: string;
  bookId: string;
  chapterNumber: number;
  ts: string;
  timezone: string;
  learningMode: string;
  isFirstAttempt: boolean;
  gradedScorePercent: number;
  timeSpentSeconds: number | undefined;
  pinnedChapterCount: number;
  // Amounts for building the LoopPipelineResult response payload.
  quizPassTotalPoints: number;
  perfectBonus: number;
  bookCompleteIP: number;
  streakDayBonusIP: number;
  welcomeBackIP: number;
}

export interface LoopCompletionResult {
  loopPipeline: LoopPipelineResult | null;
  quizPassAwarded: boolean;
  bookCompleteAwarded: boolean;
}

/**
 * Run the loop-completion saga. Returns the loop-pipeline payload (or null when the
 * quiz was failed) plus the award flags the analytics fan-out needs. Throws only if
 * a CRITICAL step (persist attempt / award flow points) rejects — every loop-pipeline
 * step is non-fatal, exactly as the shipped route behaves.
 */
export async function runLoopCompletionSaga(
  deps: LoopCompletionDeps,
  ctx: LoopCompletionContext,
): Promise<LoopCompletionResult> {
  const { userId, bookId, chapterNumber, ts } = ctx;

  // ── Persist the graded attempt (critical: propagates on failure) ──
  await deps.recordQuizOutcome();

  // On a failed quiz there are no awards and no loop pipeline.
  if (!ctx.passed) {
    return { loopPipeline: null, quizPassAwarded: false, bookCompleteAwarded: false };
  }

  // ── Award quiz-pass flow points (critical) ──
  const quizPassAwarded = await deps.awardQuizPassPoints();

  // ── Award whole-book-completion flow points (critical) ──
  const bookCompleteAwarded = ctx.completedBookNow
    ? await deps.awardBookCompletePoints()
    : false;

  const pipelineErrors: string[] = [];

  // Per-step completion marker on the LOOP record — best-effort (swallows).
  const markStep = (field: string) => deps.markLoopStep(field).catch(() => {});

  // ── Step 1: LOOP record (idempotent) ──
  try {
    await deps.putLoopRecord();
  } catch {
    // Idempotent — LOOP record already exists.
  }

  // Fire-and-forget: increment daily reader metrics for this book.
  deps.incrementDailyMetrics().catch(() => {});

  // Chapter content is read once and reused by the FSRS-seed (1.5) and depth-model
  // (1.6) steps. Both are non-critical: a read failure leaves it null and each
  // step no-ops without poisoning the loop pipeline.
  let chapterContent: ChapterSummaryPayload | null = null;
  try {
    chapterContent = await deps.readChapterContent();
  } catch (e) {
    deps.logError("[chapter-content-read-failure]", {
      userId, bookId, chapterNumber, error: String(e),
    });
  }

  // ── Step 1.5: Seed FSRS spaced-repetition cards (idempotent) ──
  try {
    const reviewCards = chapterContent?.reviewCards ?? [];
    if (reviewCards.length > 0) {
      await deps.seedFsrsCards(reviewCards);
      await markStep("fsrsSeededAt");
    }
  } catch (e) {
    // Non-critical, idempotent — do NOT record (would block markLoopPipelineCompleted).
    deps.logError("[fsrs-seed-failure]", {
      userId, bookId, chapterNumber, error: String(e),
    });
  }

  // ── Step 1.6: Update adaptive depth-routing model ──
  try {
    if (chapterContent && ctx.timeSpentSeconds !== undefined) {
      await deps.updateDepthModel(
        ctx.gradedScorePercent,
        ctx.timeSpentSeconds / 60,
        chapterContent.readingTimeMinutes,
      );
      await markStep("depthModelUpdatedAt");
    }
  } catch (e) {
    deps.logError("[depth-model-update-failure]", {
      userId, bookId, chapterNumber, error: String(e),
    });
  }

  // ── Step 2: Update streak ──
  let streakResult: StreakUpdateResult | null = null;
  try {
    streakResult = await deps.updateStreak();
    await markStep("streakUpdatedAt");
  } catch (e) {
    pipelineErrors.push("streak");
    deps.logError("[loop-pipeline-partial-failure]", {
      userId, bookId, chapterNumber, failedStep: "streak", error: String(e),
    });
  }

  // ── Step 3: Update tier ──
  let tierResult: TierUpdateResult | null = null;
  try {
    tierResult = await deps.updateTier();
    await markStep("tierUpdatedAt");
  } catch (e) {
    pipelineErrors.push("tier");
    deps.logError("[loop-pipeline-partial-failure]", {
      userId, bookId, chapterNumber, failedStep: "tier", error: String(e),
    });
  }

  // ── Step 4: Achievements ──
  let achievementResults: AchievementAwardResult[] = [];
  if (streakResult && tierResult) {
    try {
      let bookStartedAt: string | undefined;
      if (ctx.completedBookNow) {
        bookStartedAt = await deps.getBookStartedAt();
      }
      achievementResults = await deps.checkAchievements({
        userId,
        streak: streakResult.streak,
        tier: tierResult.tier,
        latestQuizScore: ctx.gradedScorePercent,
        latestLearningMode: ctx.learningMode,
        latestIsFirstAttempt: ctx.isFirstAttempt,
        bookId,
        bookCompleted: ctx.completedBookNow,
        bookChapterCount: ctx.pinnedChapterCount,
        loopCompletedAt: ts,
        userTimezone: ctx.timezone,
        bookStartedAt,
        inactiveDaysBeforeReturn: streakResult.gapDays,
        completedBooksInDistinctCategories: ctx.completedBookNow
          ? Object.keys(tierResult.tier.completedBooksByCategory ?? {}).filter(
              (cat) => (tierResult.tier.completedBooksByCategory?.[cat]?.length ?? 0) > 0,
            ).length
          : undefined,
      });
      await markStep("achievementsCheckedAt");
    } catch (e) {
      pipelineErrors.push("achievements");
      deps.logError("[loop-pipeline-partial-failure]", {
        userId, bookId, chapterNumber, failedStep: "achievements", error: String(e),
      });
    }
  } else {
    // Streak or tier missing — can't safely evaluate achievements.
    pipelineErrors.push("achievements_skipped");
  }

  // ── Step 5: Insight Spark ──
  let sparkResult: { triggered: boolean; amount: number } = { triggered: false, amount: 0 };
  try {
    const today =
      streakResult?.streak.lastActiveDate ??
      new Date().toISOString().slice(0, 10);
    sparkResult = await deps.maybeAwardInsightSpark(today);
    await markStep("insightSparkCheckedAt");
  } catch (e) {
    pipelineErrors.push("insight_spark");
    deps.logError("[loop-pipeline-partial-failure]", {
      userId, bookId, chapterNumber, failedStep: "spark", error: String(e),
    });
  }

  // Fire-and-forget in-app notifications for pipeline results.
  if (tierResult?.advanced && tierResult.newTier) {
    deps.createNotification({
      userId,
      type: "tier_up",
      title: `Tier Up: ${tierResult.definition?.displayName ?? tierResult.newTier}`,
      body: `You've advanced to ${tierResult.definition?.displayName ?? tierResult.newTier}! +${tierResult.advancementIP} IP`,
      metadata: { tier: tierResult.newTier, ip: tierResult.advancementIP },
    }).catch(() => {});
  }
  for (const a of achievementResults) {
    deps.createNotification({
      userId,
      type: "badge_earned",
      title: `Achievement: ${a.name}`,
      body: a.celebrationCopy || `You earned "${a.name}" (+${a.ipAwarded} IP)`,
      metadata: { achievementId: a.achievementId, ip: a.ipAwarded },
    }).catch(() => {});
  }
  if (streakResult?.milestonesAwarded.length) {
    for (const m of streakResult.milestonesAwarded) {
      deps.createNotification({
        userId,
        type: "streak_milestone",
        title: `${m.days}-Day Streak!`,
        body: `You've maintained a ${m.days}-day reading streak! +${m.ip} IP`,
        metadata: { days: m.days, ip: m.ip },
      }).catch(() => {});
    }
  }
  if (sparkResult.triggered) {
    deps.createNotification({
      userId,
      type: "insight_spark",
      title: "Insight Spark!",
      body: `You triggered a random Insight Spark! +${sparkResult.amount} IP`,
      metadata: { amount: sparkResult.amount },
    }).catch(() => {});
  }

  // ── Step 6: Event chapter tracking ──
  try {
    const now = new Date();
    const allEventDefs = await deps.listEventDefinitions();
    const activeEventDefs = allEventDefs.filter(
      (e) =>
        e.active !== false &&
        new Date(e.startDate) <= now &&
        new Date(e.endDate) >= now &&
        e.books.includes(bookId),
    );
    if (activeEventDefs.length > 0) {
      const userEvents = await deps.listUserEvents();
      const joinedEventIds = new Set(userEvents.map((e) => e.eventId));
      const chapterId = `${bookId}:ch${chapterNumber}`;
      for (const eventDef of activeEventDefs) {
        if (joinedEventIds.has(eventDef.eventId)) {
          await deps.recordEventChapter(eventDef.eventId, chapterId, eventDef);
        }
      }
    }
    await markStep("eventTrackingCheckedAt");
  } catch (e) {
    pipelineErrors.push("event_tracking");
    deps.logError("[loop-pipeline-partial-failure]", {
      userId, bookId, chapterNumber, failedStep: "event_tracking", error: String(e),
    });
  }

  // ── Step 7: Journey advancement ──
  let journeyResults: JourneyAdvancementResult[] = [];
  if (ctx.completedBookNow) {
    try {
      journeyResults = await deps.checkAndAdvanceJourneys();
      await markStep("journeyAdvancedAt");

      // Fire-and-forget notifications for journey completions.
      for (const jr of journeyResults) {
        if (jr.completed) {
          deps.createNotification({
            userId,
            type: "badge_earned",
            title: "Journey Complete!",
            body: `You completed a learning journey${jr.bonusIPAwarded > 0 ? ` and earned ${jr.bonusIPAwarded} IP` : ""}!`,
            metadata: { journeyId: jr.journeyId, ip: jr.bonusIPAwarded },
          }).catch(() => {});
        }
      }
    } catch (e) {
      pipelineErrors.push("journey_advancement");
      deps.logError("[loop-pipeline-partial-failure]", {
        userId, bookId, chapterNumber, failedStep: "journey_advancement", error: String(e),
      });
    }
  }

  // Always build a pipeline result with whatever fields succeeded.
  const loopPipeline: LoopPipelineResult = {
    quizPassIP: quizPassAwarded ? ctx.quizPassTotalPoints - ctx.perfectBonus : 0,
    perfectBonusIP: quizPassAwarded ? ctx.perfectBonus : 0,
    loopCompleteIP: 0, // Deferred to /unlock endpoint (§1.1)
    bookCompleteIP: bookCompleteAwarded ? ctx.bookCompleteIP : 0,
    streak: streakResult
      ? {
          currentStreak: streakResult.streak.currentStreak,
          longestStreak: streakResult.streak.longestStreak,
          shieldsHeld: streakResult.streak.streakShieldsHeld,
          streakReset: streakResult.streakReset,
          shieldsConsumed: streakResult.shieldsConsumed,
          streakDayIP: streakResult.streakDayAwarded ? ctx.streakDayBonusIP : 0,
          welcomeBackIP: streakResult.welcomeBackAwarded ? ctx.welcomeBackIP : 0,
          milestones: streakResult.milestonesAwarded.map((m) => ({ days: m.days, ip: m.ip })),
        }
      : {
          currentStreak: 0,
          longestStreak: 0,
          shieldsHeld: 0,
          streakReset: false,
          shieldsConsumed: 0,
          streakDayIP: 0,
          welcomeBackIP: 0,
          milestones: [],
        },
    tier:
      tierResult?.advanced
        ? {
            advanced: true,
            newTier: tierResult.newTier,
            displayName: tierResult.definition?.displayName ?? null,
            advancementIP: tierResult.advancementIP,
          }
        : { advanced: false, newTier: null, displayName: null, advancementIP: 0 },
    achievements: achievementResults.map((a) => ({
      id: a.achievementId,
      name: a.name,
      track: a.track,
      ip: a.ipAwarded,
      celebrationCopy: a.celebrationCopy,
      isHidden: a.isHidden,
    })),
    insightSpark: sparkResult.triggered
      ? { triggered: true, amount: sparkResult.amount }
      : { triggered: false, amount: 0 },
    ...(journeyResults.length > 0 ? { journeys: journeyResults } : {}),
  };

  // Mark the pipeline as fully completed only if every step succeeded. If anything
  // failed, the marker stays unset and operators can identify affected loops by
  // querying quiz states with passed=true and no marker.
  if (pipelineErrors.length === 0) {
    try {
      await deps.markLoopPipelineCompleted();
    } catch (e) {
      deps.logError("[loop-pipeline] failed to mark completion:", e);
    }
  } else {
    deps.logError(
      "[loop-pipeline] partial failure — affected steps:",
      pipelineErrors,
      { userId, bookId, chapterNumber },
    );
  }

  return { loopPipeline, quizPassAwarded, bookCompleteAwarded };
}
