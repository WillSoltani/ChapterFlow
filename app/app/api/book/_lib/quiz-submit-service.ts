import "server-only";

import type { AuthedUser } from "@/app/app/api/_lib/auth";
import { BookApiError } from "./errors";
import {
  getLocalQuizQuestions,
  getPublishedBookManifest,
  getUserAccessibleChapter,
  getUserAccessibleQuiz,
  isLocalV12Package,
} from "./content-service";
import { resolvePinnedChapterCount } from "./book-completion-core";
import { readJsonFromS3 } from "./storage";
import type { BookManifest } from "./types";
import { initializeCardsForChapter } from "./fsrs-repo";
import { updateDepthModel } from "./depth-routing";
import {
  analyticsTrackBookCompleted,
  analyticsTrackFlowPointsTransaction,
  analyticsTrackQuizAttempt,
  analyticsTrackQuizInteraction,
} from "./analytics-repo";
import { getBookAnalyticsTableName } from "./env";
import { nowIso } from "./keys";
import {
  buildProgressAfterQuizPass,
  buildQuizAttemptQuestions,
  buildQuizClientSession,
  buildQuizStateFromAttempts,
  cooldownSecondsForFailureStreak,
  gradeQuizAttemptQuestions,
  remainingCooldownSeconds,
} from "./quiz-session";
import { answersCoverAssignedQuestions } from "./quiz-coverage-core";
import {
  countRecentQuizAttempts,
  getUserBookState,
  getUserQuizState,
  getUserSettingsItem,
  incrementDailyReaderMetrics,
  listRecentQuizAttempts,
  markLoopPipelineCompleted,
  markLoopStepCompleted,
  putLoopRecord,
  recordQuizAttemptOutcome,
} from "./repo";
import { awardFlowPoints } from "./flow-points-repo";
import { scoreQuizResponsesByQuestionId } from "./quiz-service";
import { updateStreakOnLoopComplete } from "./streak-repo";
import { updateTierOnLoopComplete } from "./tier-repo";
import { checkAchievementsAfterLoopComplete } from "./achievement-repo";
import { checkAndAdvanceJourneys } from "./journey-repo";
import { listUserEvents, recordEventChapter } from "./events-repo";
import { listEventDefinitions } from "./admin-events-repo";
import { maybeAwardInsightSpark } from "./insight-spark";
import { createNotification } from "./notifications-repo";
import {
  CHAPTER_FP,
  LOOP_COMPLETE_IP,
  INSIGHT_POINTS_AMOUNTS,
  QUIZ_PASS_THRESHOLDS,
  QUIZ_QUESTION_COUNTS,
} from "@/app/book/_lib/flow-points-economy";
import {
  resolveLearningMode,
  resolveStrictQuizQuestionCount,
} from "./learning-mode";
import { resolveStreakMode, resolveStreakSkipDays } from "./streak-mode";
import type { ToneKey } from "@/app/book/data/book-package-core";
import { runLoopCompletionSaga, type LoopCompletionDeps } from "./quiz-submit-core";
import { logger } from "@/lib/logging/logger";

// quiz-submit-core.ts's LoopCompletionDeps.logError is a variadic
// (...args: unknown[]) => void sink (its call sites pass a "[tag]" string
// followed by an error/object/array in varying shapes). This shim derives a
// stable snake_case event name from the leading tag and folds the remaining
// args into structured fields so every call routes through the logger without
// having to change quiz-submit-core.ts's call sites.
function logLoopPipelineError(...args: unknown[]): void {
  const [first, ...rest] = args;
  const event =
    typeof first === "string"
      ? first
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_")
          .replace(/^_+|_+$/g, "") || "quiz_submit_loop_error"
      : "quiz_submit_loop_error";
  const fields: Record<string, unknown> = {};
  rest.forEach((arg, index) => {
    if (arg instanceof Error) {
      fields.err = arg;
    } else if (arg && typeof arg === "object" && !Array.isArray(arg)) {
      Object.assign(fields, arg);
    } else {
      fields[`arg${index}`] = arg;
    }
  });
  logger.error(event, fields);
}

const MAX_ATTEMPTS_PER_HOUR = 5;

export type RequestResponse = {
  questionId: string;
  selectedChoiceId?: string | null;
  selectedIndex?: number | null;
};

/** Parse + validate the client `responses` array. Throws BookApiError(400) on any defect. */
export function parseResponses(body: Record<string, unknown>): RequestResponse[] {
  const responsesRaw = body.responses;
  if (!Array.isArray(responsesRaw) || responsesRaw.length === 0) {
    throw new BookApiError(
      400,
      "invalid_answers",
      "responses must include one answer for every question."
    );
  }

  return responsesRaw.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new BookApiError(
        400,
        "invalid_answers",
        `responses[${index}] must be an object.`
      );
    }
    const record = entry as Record<string, unknown>;
    const questionId =
      typeof record.questionId === "string" ? record.questionId.trim().slice(0, 256) : "";
    const selectedChoiceId =
      typeof record.selectedChoiceId === "string"
        ? record.selectedChoiceId.trim().slice(0, 256)
        : null;
    const selectedIndexRaw =
      typeof record.selectedIndex === "number" && Number.isFinite(record.selectedIndex)
        ? Math.floor(record.selectedIndex)
        : null;

    if (!questionId) {
      throw new BookApiError(
        400,
        "invalid_answers",
        `responses[${index}].questionId is required.`
      );
    }
    if (!selectedChoiceId && selectedIndexRaw === null) {
      throw new BookApiError(
        400,
        "invalid_answers",
        `responses[${index}] must include selectedChoiceId or selectedIndex.`
      );
    }
    return {
      questionId,
      selectedChoiceId,
      selectedIndex: selectedIndexRaw,
    };
  });
}

function parseTone(value: unknown): ToneKey {
  return value === "gentle" || value === "direct" || value === "competitive"
    ? value
    : "direct";
}

function readSavedTone(settings: unknown): string | null {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return null;
  const extended = (settings as { extended?: unknown }).extended;
  if (!extended || typeof extended !== "object" || Array.isArray(extended)) return null;
  return typeof (extended as { contentTone?: unknown }).contentTone === "string"
    ? ((extended as { contentTone?: string }).contentTone ?? null)
    : null;
}

export interface CompleteLearningLoopInput {
  user: AuthedUser;
  bookId: string;
  /** Already floored / validated chapter number. */
  chapterNumber: number;
  responses: RequestResponse[];
  requestedAttemptNumber: number;
  timeSpentSeconds: number | undefined;
  /** Raw `body.tone` — resolved against saved settings after they load. */
  toneInput: unknown;
  /** Raw `body.timezone`. */
  timezoneInput: unknown;
  tableName: string;
  contentBucket: string;
}

/**
 * The quiz-submit loop-completion saga (WS3-003), lifted out of the fat route
 * controller. Loads state, grades, persists the attempt, awards flow points, and
 * runs the streak/tier/achievement/journey/event/insight-spark loop pipeline (via
 * the pure `runLoopCompletionSaga` policy in quiz-submit-core.ts), then returns the
 * response payload the route serializes with `bookOk`.
 *
 * ── 36-await step map (in execution order) ────────────────────────────────────
 *  Load / grade (this fn):
 *   1  getUserAccessibleQuiz            ┐
 *   2  getPublishedBookManifest         │ Promise.all
 *   3  getUserQuizState                 │
 *   4  listRecentQuizAttempts           │
 *   5  getUserSettingsItem              ┘
 *   6  resolvePinnedChapterCount        (may readJsonFromS3 pinned manifest)
 *   7  getLocalQuizQuestions
 *   8  isLocalV12Package
 *   —  [early return when quizState.passed]
 *   9  countRecentQuizAttempts          (rate-limit gate)
 *   —  grade (sync) + coverage/stale/cooldown guards (throw)
 *  Persist + award + pipeline (runLoopCompletionSaga in quiz-submit-core.ts):
 *  10  recordQuizAttemptOutcome         CRITICAL
 *   —  [fail path returns here]
 *  11  awardFlowPoints (quiz_pass)      CRITICAL
 *  12  awardFlowPoints (book_complete)  CRITICAL (completedBookNow)
 *  13  putLoopRecord                    idempotent → swallowed
 *  14  incrementDailyReaderMetrics      fire-and-forget
 *  15  getUserAccessibleChapter         → null on failure
 *  16  initializeCardsForChapter (FSRS) swallowed
 *  17  markLoopStepCompleted(fsrs)
 *  18  updateDepthModel                 swallowed
 *  19  markLoopStepCompleted(depth)
 *  20  updateStreakOnLoopComplete       → pipelineErrors
 *  21  markLoopStepCompleted(streak)
 *  22  updateTierOnLoopComplete         → pipelineErrors
 *  23  markLoopStepCompleted(tier)
 *  24  getUserBookState                 (completedBookNow)
 *  25  checkAchievementsAfterLoopComplete → pipelineErrors
 *  26  markLoopStepCompleted(achievements)
 *  27  maybeAwardInsightSpark           → pipelineErrors
 *  28  markLoopStepCompleted(spark)
 *   —  createNotification × N           fire-and-forget
 *  29  listEventDefinitions             → pipelineErrors
 *  30  listUserEvents
 *  31  recordEventChapter × N
 *  32  markLoopStepCompleted(events)
 *  33  checkAndAdvanceJourneys          → pipelineErrors
 *  34  markLoopStepCompleted(journeys)
 *  35  markLoopPipelineCompleted        (only when pipelineErrors empty) → swallowed
 *  Analytics (this fn):
 *  36  getBookAnalyticsTableName().then(...)  fire-and-forget fan-out
 */
export async function completeLearningLoop(input: CompleteLearningLoopInput) {
  const {
    user,
    bookId,
    chapterNumber: chapterNumberInt,
    responses,
    requestedAttemptNumber,
    timeSpentSeconds,
    toneInput,
    timezoneInput,
    tableName,
    contentBucket,
  } = input;

  const [{ progress, quiz: s3Quiz }, { manifest, version: liveManifestVersion }, persistedQuizState, recentAttempts, userSettings] = await Promise.all([
    getUserAccessibleQuiz({
      tableName,
      contentBucket,
      userId: user.sub,
      bookId,
      chapterNumber: chapterNumberInt,
    }),
    getPublishedBookManifest({
      tableName,
      contentBucket,
      bookId,
    }),
    getUserQuizState(tableName, user.sub, bookId, chapterNumberInt),
    listRecentQuizAttempts(tableName, user.sub, bookId, chapterNumberInt, 20),
    getUserSettingsItem(tableName, user.sub),
  ]);

  // Whole-book completion must be judged against the user's PINNED version's chapter
  // count, not the live catalog's (`manifest` above is the latest published version).
  // The catalog can advance to a different chapterCount after this user started, while
  // their `completedChapters` stay pinned — see book-completion-core.ts. Reuses the
  // already-fetched live manifest when the pin matches it (no extra S3 read).
  const pinnedChapterCount = await resolvePinnedChapterCount({
    pinnedBookVersion: progress.pinnedBookVersion,
    liveVersion: liveManifestVersion,
    liveManifest: manifest,
    readPinnedManifest: () =>
      readJsonFromS3<BookManifest>(contentBucket, progress.manifestKey),
  });

  // Resolve learning mode from server-stored settings (not client request body)
  // to prevent gaming (e.g., submitting with "guided" mode for a lower threshold).
  // SET-1: the shared resolver reads canonical top-level settings.learningMode
  // (self-healing back to settings.extended) so a non-Standard reader is graded
  // and paid (CHAPTER_FP / LOOP_COMPLETE_IP, stamped onto the LOOP record below)
  // on the mode they chose, not always "standard". Identical to the GET + /check
  // routes by construction. See docs/audit-fixes/SET-1.md.
  const learningMode = resolveLearningMode(userSettings?.settings);
  const tone = parseTone(toneInput ?? readSavedTone(userSettings?.settings));
  // Prefer quiz questions from local book-package JSON over stale S3 data.
  const localQuestions = await getLocalQuizQuestions(bookId, chapterNumberInt, tone);
  const quiz = localQuestions
    ? { ...s3Quiz, questions: localQuestions }
    : s3Quiz;
  const strictV12 = await isLocalV12Package(bookId);

  const quizState =
    persistedQuizState ??
    buildQuizStateFromAttempts({
      userId: user.sub,
      bookId,
      chapterNumber: chapterNumberInt,
      chapterId: quiz.chapterId,
      attempts: recentAttempts,
    });

  // Resolve the attempt's question count ENTIRELY from server-stored settings
  // (profile-customized flag + learning mode), never the client `difficulty`
  // body param. This is the pass / next-chapter-unlock gate: a client-chosen
  // difficulty previously let a reader submit against the smallest set
  // (simple=5) to clear a strict-package quiz and farm Insight Points. The
  // un-customized fast path still yields 5 (matching the GET the reader was
  // served and the client's default short-path) while a customized reader is
  // sized at their mode's count and cannot shrink it. Must equal the GET +
  // /check routes exactly (shared resolver) or grading mis-counts.
  const maxQuestions = strictV12
    ? resolveStrictQuizQuestionCount(userSettings?.settings)
    : QUIZ_QUESTION_COUNTS[learningMode];

  if (quizState?.passed) {
    return {
      quiz: buildQuizClientSession({
        quiz,
        userId: user.sub,
        bookId,
        chapterNumber: chapterNumberInt,
        quizState,
        latestAttempt: recentAttempts[0] ?? null,
        history: recentAttempts,
        passingScorePercent: strictV12 ? quiz.passingScorePercent : undefined,
        maxQuestions,
        preserveAuthoredOrder: strictV12,
      }),
      progress: {
        currentChapterNumber: progress.currentChapterNumber,
        unlockedThroughChapterNumber: progress.unlockedThroughChapterNumber,
        completedChapters: progress.completedChapters,
      },
    };
  }

  const retryAfterSeconds = remainingCooldownSeconds(quizState?.nextEligibleAttemptAt ?? null);
  if (retryAfterSeconds > 0) {
    throw new BookApiError(
      429,
      "attempt_cooldown",
      "Retake is temporarily locked after repeated failed attempts.",
      {
        retryAfterSeconds,
        failureStreak: quizState?.failureStreak ?? 1,
        nextAttemptAvailableAt: quizState?.nextEligibleAttemptAt ?? null,
      }
    );
  }

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const recentAttemptsCount = await countRecentQuizAttempts(
    tableName,
    user.sub,
    bookId,
    chapterNumberInt,
    oneHourAgo
  );
  if (recentAttemptsCount >= MAX_ATTEMPTS_PER_HOUR) {
    throw new BookApiError(
      429,
      "attempt_rate_limited",
      "Too many quiz attempts. Please wait before trying again.",
      { retryAfterSeconds: 3600 }
    );
  }

  const modeThreshold = QUIZ_PASS_THRESHOLDS[learningMode];
  const passingScorePercent = strictV12
    ? (quiz.passingScorePercent || 80)
    : Math.max(modeThreshold, quiz.passingScorePercent || modeThreshold);
  const previousAttemptsCount = Math.max(0, quizState?.attemptsCount ?? 0);
  const expectedAttemptNumber = previousAttemptsCount + 1;
  if (requestedAttemptNumber !== expectedAttemptNumber) {
    throw new BookApiError(
      409,
      "quiz_session_stale",
      "This quiz session is out of date. Refresh and try again."
    );
  }

  const attemptQuestions = buildQuizAttemptQuestions({
    quiz: {
      ...quiz,
      passingScorePercent,
    },
    userId: user.sub,
    bookId,
    chapterNumber: chapterNumberInt,
    attemptNumber: expectedAttemptNumber,
    maxQuestions,
    preserveAuthoredOrder: strictV12,
  });

  // Enforce full coverage before grading on BOTH the strict and legacy
  // (index-only) paths. The strict gradeQuizAttemptQuestions already checks
  // questionResults.length === questions.length, but the legacy scorer
  // computes its score over responses.length, so a single correct index-only
  // answer would otherwise grade as 100% and pass the quiz (unlocking the
  // next chapter and farming Insight Points). Require one answer per
  // attempt question so neither path can pass on partial coverage.
  // Require the responses to answer EXACTLY the assigned attempt questions —
  // not just the right count. The legacy index-only scorer grades against the
  // full quiz.questions pool, so a count-only check could be satisfied with
  // answers to non-assigned pool questions (whose correct indices are exposed),
  // re-opening the pass/unlock bypass. See answersCoverAssignedQuestions (tested).
  const answersExactlyCoverAttempt = answersCoverAssignedQuestions(
    attemptQuestions.map((q) => q.questionId),
    responses.map((r) => r.questionId)
  );
  if (!answersExactlyCoverAttempt) {
    throw new BookApiError(
      400,
      "invalid_answers",
      `responses must answer exactly the ${attemptQuestions.length} assigned question(s).`
    );
  }

  let graded;
  try {
    const hasChoiceIds = responses.some((response) => Boolean(response.selectedChoiceId));
    graded = hasChoiceIds
      ? gradeQuizAttemptQuestions(attemptQuestions, responses, passingScorePercent)
      : (() => {
          const legacy = scoreQuizResponsesByQuestionId(
            {
              ...quiz,
              passingScorePercent,
            },
            responses.map((response) => ({
              questionId: response.questionId,
              selectedIndex: response.selectedIndex ?? -1,
            })),
            {
              questionPool: quiz.questions,
            }
          );
          // Score over the full attempt question set, not responses.length,
          // so the legacy path can't inflate the percentage by submitting
          // fewer answers than the chapter requires.
          const attemptTotal = attemptQuestions.length;
          const legacyScorePercent =
            attemptTotal > 0 ? Math.round((legacy.correct / attemptTotal) * 100) : 0;
          return {
            total: attemptTotal,
            correct: legacy.correct,
            scorePercent: legacyScorePercent,
            passed: legacyScorePercent >= passingScorePercent,
            questionResults: legacy.review.map((review) => ({
              questionId: review.questionId,
              selectedChoiceId:
                review.selectedIndex >= 0
                  ? `${review.questionId}::choice::${review.selectedIndex}`
                  : null,
              selectedIndex: review.selectedIndex,
              correctChoiceId: `${review.questionId}::choice::${review.correctIndex}`,
              correctIndex: review.correctIndex,
              isCorrect: review.isCorrect,
            })),
          };
        })();
  } catch (error: unknown) {
    throw new BookApiError(
      400,
      "invalid_answers",
      error instanceof Error ? error.message : "Quiz answers are invalid."
    );
  }

  const ts = nowIso();
  const nextFailureStreak = graded.passed
    ? 0
    : Math.max(0, quizState?.failureStreak ?? 0) + 1;
  const cooldownSeconds = graded.passed
    ? 0
    : cooldownSecondsForFailureStreak(nextFailureStreak);
  const nextEligibleAttemptAt = graded.passed
    ? null
    : new Date(Date.now() + cooldownSeconds * 1000).toISOString();
  const nextProgress = graded.passed
    ? buildProgressAfterQuizPass(progress, {
        chapterNumber: chapterNumberInt,
        scorePercent: graded.scorePercent,
      })
    : undefined;
  const attempt = {
    userId: user.sub,
    bookId,
    chapterNumber: chapterNumberInt,
    chapterId: quiz.chapterId,
    quizId: `${bookId}:${chapterNumberInt}`,
    attemptNumber: expectedAttemptNumber,
    passingScorePercent,
    scorePercent: graded.scorePercent,
    correctCount: graded.correct,
    totalQuestions: graded.total,
    passed: graded.passed,
    cooldownSeconds,
    nextEligibleAttemptAt,
    unlockedNextChapter: graded.passed,
    responses,
    questionResults: graded.questionResults,
    timeSpentSeconds,
    createdAt: ts,
    updatedAt: ts,
  };
  const nextQuizState = {
    userId: user.sub,
    bookId,
    chapterNumber: chapterNumberInt,
    chapterId: quiz.chapterId,
    quizId: `${bookId}:${chapterNumberInt}`,
    attemptsCount: expectedAttemptNumber,
    failureStreak: nextFailureStreak,
    passed: graded.passed,
    highestScorePercent: Math.max(
      graded.scorePercent,
      quizState?.highestScorePercent ?? 0
    ),
    lastScorePercent: graded.scorePercent,
    lastCorrectCount: graded.correct,
    lastTotalQuestions: graded.total,
    lastAttemptAt: ts,
    lastAttemptNumber: expectedAttemptNumber,
    nextEligibleAttemptAt,
    passedAt: graded.passed ? ts : quizState?.passedAt,
    unlockedNextChapter: graded.passed,
    createdAt: quizState?.createdAt ?? ts,
    updatedAt: ts,
  };

  // Mode-dependent Insight Points (quiz-pass portion only — §1.1).
  // Loop completion IP, streak/tier/achievements/insight spark are awarded inline below.
  const isFirstAttempt = expectedAttemptNumber === 1;
  const quizPassPoints = isFirstAttempt
    ? CHAPTER_FP.quizPassFirstAttempt[learningMode]
    : CHAPTER_FP.quizPassRetry[learningMode];
  const perfectBonus =
    graded.scorePercent === 100 ? CHAPTER_FP.quizPerfectScore[learningMode] : 0;
  const totalQuizPoints = quizPassPoints + perfectBonus;

  const completedChapterCount = nextProgress?.completedChapters.length ?? 0;
  const completedBookNow =
    graded.passed &&
    completedChapterCount > 0 &&
    pinnedChapterCount > 0 &&
    completedChapterCount >= pinnedChapterCount;

  // Loop-complete IP is deferred to the /unlock endpoint (§1.1). Only the LOOP
  // record is created here (loopCompleteIPAmount is stamped onto it).
  const loopCompleteIPAmount = isFirstAttempt
    ? LOOP_COMPLETE_IP[learningMode].firstAttempt
    : LOOP_COMPLETE_IP[learningMode].retry;
  const timezone =
    typeof timezoneInput === "string" && timezoneInput.trim()
      ? timezoneInput.trim()
      : "UTC";
  const bookCategory = manifest.categories?.[0] ?? "";

  // ── Loop-completion saga: persist attempt → award flow points → streak / tier /
  // achievements / journeys / events / insight-spark. The pure ordering + error
  // policy lives in quiz-submit-core.ts (runLoopCompletionSaga); here we only bind
  // the real DynamoDB-backed side effects. Runs the whole flow for BOTH pass and
  // fail — the persist (recordQuizAttemptOutcome) is unconditional; awards + the
  // loop pipeline are gated on `passed` inside the policy.
  const deps: LoopCompletionDeps = {
    recordQuizOutcome: () =>
      recordQuizAttemptOutcome(tableName, {
        previousAttemptsCount,
        attempt,
        nextQuizState,
        nextProgress,
        // When the optimistic progressRev guard loses a concurrency race, recompute the
        // pass merge against the freshly-read row so a concurrent writer's completed
        // chapters / unlocks are preserved (the pass is never silently dropped).
        recomputeNextProgress: (freshProgress) =>
          buildProgressAfterQuizPass(freshProgress, {
            chapterNumber: chapterNumberInt,
            scorePercent: graded.scorePercent,
          }),
      }),
    awardQuizPassPoints: async () =>
      (
        await awardFlowPoints(tableName, {
          userId: user.sub,
          amount: totalQuizPoints,
          sourceType: "quiz_pass",
          sourceId: `${bookId}:${chapterNumberInt}`,
          metadata: {
            bookId,
            chapterLabel: `Chapter ${chapterNumberInt}`,
            chapterNumber: chapterNumberInt,
            learningMode,
            isFirstAttempt,
            perfectBonus: perfectBonus > 0,
          },
          createdAt: ts,
        })
      ).awarded,
    awardBookCompletePoints: async () =>
      (
        await awardFlowPoints(tableName, {
          userId: user.sub,
          amount: INSIGHT_POINTS_AMOUNTS.bookComplete,
          sourceType: "book_complete",
          sourceId: bookId,
          metadata: {
            bookId,
            bookTitle: manifest.title,
          },
          createdAt: ts,
        })
      ).awarded,
    putLoopRecord: () =>
      putLoopRecord(tableName, {
        userId: user.sub,
        bookId,
        chapterNumber: chapterNumberInt,
        completedAt: ts,
        quizScore: graded.scorePercent,
        learningMode,
        isFirstAttempt,
        category: bookCategory,
        loopCompleteIPAmount,
        createdAt: ts,
      }),
    incrementDailyMetrics: () =>
      incrementDailyReaderMetrics(tableName, {
        bookId,
        dayKey: ts.slice(0, 10),
        ts,
      }),
    markLoopStep: (field) =>
      markLoopStepCompleted(tableName, {
        userId: user.sub,
        bookId,
        chapterNumber: chapterNumberInt,
        field,
        ts,
      }),
    readChapterContent: async () =>
      (
        await getUserAccessibleChapter({
          tableName,
          contentBucket,
          userId: user.sub,
          bookId,
          chapterNumber: chapterNumberInt,
        })
      ).chapter,
    seedFsrsCards: async (reviewCards) => {
      await initializeCardsForChapter(
        tableName,
        user.sub,
        bookId,
        chapterNumberInt,
        reviewCards,
        tone,
      );
    },
    updateDepthModel: async (scorePercent, actualMinutes, readingTimeMinutes) => {
      await updateDepthModel(
        tableName,
        user.sub,
        bookId,
        chapterNumberInt,
        scorePercent,
        actualMinutes,
        readingTimeMinutes,
      );
    },
    updateStreak: () =>
      // SET-7: resolve streak mode + skip-day tolerance from server-stored
      // settings (not the request body) so a "flexible" reader keeps their
      // streak across short gaps without it being claimable per-request. Reads
      // the same userSettings already loaded above for learning mode.
      updateStreakOnLoopComplete(tableName, user.sub, timezone, {
        mode: resolveStreakMode(userSettings?.settings),
        skipDays: resolveStreakSkipDays(userSettings?.settings),
      }),
    updateTier: () =>
      updateTierOnLoopComplete(
        tableName,
        user.sub,
        graded.scorePercent,
        bookCategory,
        {
          completedBookNow,
          bookId,
        }
      ),
    getBookStartedAt: async () => {
      const bookState = await getUserBookState(tableName, user.sub, bookId);
      return bookState?.createdAt || undefined;
    },
    checkAchievements: (achCtx) =>
      checkAchievementsAfterLoopComplete({ tableName, ...achCtx }),
    maybeAwardInsightSpark: (dateStr) =>
      maybeAwardInsightSpark(
        tableName,
        user.sub,
        dateStr,
        `${bookId}:${chapterNumberInt}`
      ),
    createNotification: (params) => createNotification(tableName, params),
    listEventDefinitions: () => listEventDefinitions(tableName),
    listUserEvents: () => listUserEvents(tableName, user.sub),
    recordEventChapter: (eventId, chapterId, eventDef) =>
      recordEventChapter(tableName, user.sub, eventId, chapterId, eventDef),
    checkAndAdvanceJourneys: () =>
      checkAndAdvanceJourneys(tableName, user.sub, bookId),
    markLoopPipelineCompleted: () =>
      markLoopPipelineCompleted(tableName, user.sub, bookId, chapterNumberInt, ts),
    logError: (...args) => logLoopPipelineError(...args),
  };

  const saga = await runLoopCompletionSaga(deps, {
    passed: graded.passed,
    completedBookNow,
    userId: user.sub,
    bookId,
    chapterNumber: chapterNumberInt,
    ts,
    timezone,
    learningMode,
    isFirstAttempt,
    gradedScorePercent: graded.scorePercent,
    timeSpentSeconds,
    pinnedChapterCount,
    quizPassTotalPoints: totalQuizPoints,
    perfectBonus,
    bookCompleteIP: INSIGHT_POINTS_AMOUNTS.bookComplete,
    streakDayBonusIP: INSIGHT_POINTS_AMOUNTS.streakDayBonus,
    welcomeBackIP: INSIGHT_POINTS_AMOUNTS.welcomeBack,
  });
  const loopPipeline = saga.loopPipeline;

  getBookAnalyticsTableName()
    .then((analyticsTable) => {
      if (!analyticsTable) return;
      const tasks: Promise<unknown>[] = [
        analyticsTrackQuizAttempt(analyticsTable, {
          userId: user.sub,
          bookId,
          chapterNumber: chapterNumberInt,
          attemptNumber: expectedAttemptNumber,
          scorePercent: graded.scorePercent,
          correctCount: graded.correct,
          totalQuestions: graded.total,
          passed: graded.passed,
          cooldownSeconds,
          unlockedNextChapter: graded.passed,
        }),
        analyticsTrackQuizInteraction(analyticsTable, {
          userId: user.sub,
          eventType: graded.passed ? "quiz_passed" : "quiz_failed",
          bookId,
          chapterNumber: chapterNumberInt,
          attemptNumber: expectedAttemptNumber,
          scorePercent: graded.scorePercent,
          contextKey: `QUIZ#${bookId}#${String(chapterNumberInt).padStart(4, "0")}`,
        }),
      ];

      if (graded.passed) {
        tasks.push(
          analyticsTrackQuizInteraction(analyticsTable, {
            userId: user.sub,
            eventType: "chapter_unlocked",
            bookId,
            chapterNumber: chapterNumberInt + 1,
            attemptNumber: expectedAttemptNumber,
            contextKey: `QUIZ#${bookId}#${String(chapterNumberInt).padStart(4, "0")}`,
          })
        );
      }

      if (saga.quizPassAwarded) {
        tasks.push(
          analyticsTrackFlowPointsTransaction(analyticsTable, {
            userId: user.sub,
            deltaPoints: totalQuizPoints,
            direction: "earn",
            sourceType: "quiz_pass",
            sourceId: `${bookId}:${chapterNumberInt}`,
            metadata: {
              bookId,
              chapterLabel: `Chapter ${chapterNumberInt}`,
              chapterNumber: chapterNumberInt,
              learningMode,
            },
          })
        );
      }

      if (completedBookNow) {
        tasks.push(
          analyticsTrackBookCompleted(analyticsTable, {
            userId: user.sub,
            bookId,
            totalChapterCount: pinnedChapterCount,
          })
        );
      }

      if (saga.bookCompleteAwarded) {
        tasks.push(
          analyticsTrackFlowPointsTransaction(analyticsTable, {
            userId: user.sub,
            deltaPoints: INSIGHT_POINTS_AMOUNTS.bookComplete,
            direction: "earn",
            sourceType: "book_complete",
            sourceId: bookId,
            metadata: {
              bookId,
              bookTitle: manifest.title,
            },
          })
        );
      }

      if (loopPipeline) {
        if (loopPipeline.loopCompleteIP > 0) {
          tasks.push(
            analyticsTrackFlowPointsTransaction(analyticsTable, {
              userId: user.sub,
              deltaPoints: loopPipeline.loopCompleteIP,
              direction: "earn",
              sourceType: "loop_complete",
              sourceId: `${bookId}:${chapterNumberInt}`,
              metadata: { bookId, chapterNumber: chapterNumberInt, learningMode },
            })
          );
        }
        if (loopPipeline.streak.streakDayIP > 0) {
          tasks.push(
            analyticsTrackFlowPointsTransaction(analyticsTable, {
              userId: user.sub,
              deltaPoints: loopPipeline.streak.streakDayIP,
              direction: "earn",
              sourceType: "streak_day",
              sourceId: `${user.sub}:${ts.slice(0, 10)}`,
              metadata: {
                bookId,
                chapterNumber: chapterNumberInt,
                currentStreak: loopPipeline.streak.currentStreak,
              },
            })
          );
        }
        if (loopPipeline.streak.welcomeBackIP > 0) {
          tasks.push(
            analyticsTrackFlowPointsTransaction(analyticsTable, {
              userId: user.sub,
              deltaPoints: loopPipeline.streak.welcomeBackIP,
              direction: "earn",
              sourceType: "welcome_back",
              sourceId: `${user.sub}:${ts.slice(0, 10)}`,
              metadata: { bookId, chapterNumber: chapterNumberInt },
            })
          );
        }
        for (const milestone of loopPipeline.streak.milestones) {
          tasks.push(
            analyticsTrackFlowPointsTransaction(analyticsTable, {
              userId: user.sub,
              deltaPoints: milestone.ip,
              direction: "earn",
              sourceType: "streak_milestone",
              sourceId: `${user.sub}:${milestone.days}`,
              metadata: { bookId, chapterNumber: chapterNumberInt, days: milestone.days },
            })
          );
        }
        if (loopPipeline.tier.advanced && loopPipeline.tier.advancementIP > 0) {
          tasks.push(
            analyticsTrackFlowPointsTransaction(analyticsTable, {
              userId: user.sub,
              deltaPoints: loopPipeline.tier.advancementIP,
              direction: "earn",
              sourceType: "tier_advance",
              sourceId: `${user.sub}:${loopPipeline.tier.newTier ?? "unknown"}`,
              metadata: {
                bookId,
                chapterNumber: chapterNumberInt,
                tierName: loopPipeline.tier.displayName ?? loopPipeline.tier.newTier,
              },
            })
          );
        }
        for (const achievement of loopPipeline.achievements) {
          tasks.push(
            analyticsTrackFlowPointsTransaction(analyticsTable, {
              userId: user.sub,
              deltaPoints: achievement.ip,
              direction: "earn",
              sourceType: "achievement_earned",
              sourceId: `${user.sub}:${achievement.id}`,
              metadata: {
                bookId,
                chapterNumber: chapterNumberInt,
                achievementName: achievement.name,
                track: achievement.track,
              },
            })
          );
        }
        if (loopPipeline.insightSpark.triggered && loopPipeline.insightSpark.amount > 0) {
          tasks.push(
            analyticsTrackFlowPointsTransaction(analyticsTable, {
              userId: user.sub,
              deltaPoints: loopPipeline.insightSpark.amount,
              direction: "earn",
              sourceType: "insight_spark",
              sourceId: `${user.sub}:${ts.slice(0, 10)}`,
              metadata: { bookId, chapterNumber: chapterNumberInt },
            })
          );
        }
      }

      return Promise.allSettled(tasks);
    })
    .catch(() => {});

  const history = [attempt, ...recentAttempts].slice(0, 5);
  return {
    quiz: buildQuizClientSession({
      quiz: {
        ...quiz,
        passingScorePercent,
      },
      userId: user.sub,
      bookId,
      chapterNumber: chapterNumberInt,
      quizState: nextQuizState,
      latestAttempt: attempt,
      history,
      maxQuestions,
      preserveAuthoredOrder: strictV12,
    }),
    progress: {
      currentChapterNumber:
        nextProgress?.currentChapterNumber ?? progress.currentChapterNumber,
      unlockedThroughChapterNumber:
        nextProgress?.unlockedThroughChapterNumber ??
        progress.unlockedThroughChapterNumber,
      completedChapters:
        nextProgress?.completedChapters ?? progress.completedChapters,
    },
    // Loop-complete pipeline results (streak, tier, achievements, IP)
    // Included when the quiz was passed — null otherwise.
    ...(loopPipeline ? { loopPipeline } : {}),
  };
}
