import "server-only";

import { requireActiveBookUser } from "@/app/app/api/book/_lib/account-guard";
import {
  getBookAnalyticsTableName,
  getBookContentBucket,
  getBookTableName,
} from "@/app/app/api/book/_lib/env";
import {
  applyStartDeviceCookie,
  ensureUserBookStarted,
} from "@/app/app/api/book/_lib/ensure-book-started";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import { bookOk, requireBodyObject, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import {
  getLocalQuizQuestions,
  getPublishedBookManifest,
  getUserAccessibleChapter,
  getUserAccessibleQuiz,
  isLocalV12Package,
} from "@/app/app/api/book/_lib/content-service";
import { resolvePinnedChapterCount } from "@/app/app/api/book/_lib/book-completion-core";
import { readJsonFromS3 } from "@/app/app/api/book/_lib/storage";
import type { BookManifest } from "@/app/app/api/book/_lib/types";
import { initializeCardsForChapter } from "@/app/app/api/book/_lib/fsrs-repo";
import {
  analyticsTrackBookCompleted,
  analyticsTrackFlowPointsTransaction,
  analyticsTrackQuizAttempt,
  analyticsTrackQuizInteraction,
} from "@/app/app/api/book/_lib/analytics-repo";
import { bookMetricsPk, bookUserPk, dailyMetricsSk, loopSk, nowIso } from "@/app/app/api/book/_lib/keys";
import {
  buildProgressAfterQuizPass,
  buildQuizAttemptQuestions,
  buildQuizClientSession,
  buildQuizStateFromAttempts,
  cooldownSecondsForFailureStreak,
  gradeQuizAttemptQuestions,
  remainingCooldownSeconds,
} from "@/app/app/api/book/_lib/quiz-session";
import { answersCoverAssignedQuestions } from "@/app/app/api/book/_lib/quiz-coverage-core";
import {
  countRecentQuizAttempts,
  getUserBookState,
  getUserQuizState,
  getUserSettingsItem,
  listRecentQuizAttempts,
  markLoopPipelineCompleted,
  recordQuizAttemptOutcome,
} from "@/app/app/api/book/_lib/repo";
import { awardFlowPoints } from "@/app/app/api/book/_lib/flow-points-repo";
import { scoreQuizResponsesByQuestionId } from "@/app/app/api/book/_lib/quiz-service";
import { updateStreakOnLoopComplete } from "@/app/app/api/book/_lib/streak-repo";
import { updateTierOnLoopComplete } from "@/app/app/api/book/_lib/tier-repo";
import { checkAchievementsAfterLoopComplete } from "@/app/app/api/book/_lib/achievement-repo";
import { checkAndAdvanceJourneys, type JourneyAdvancementResult } from "@/app/app/api/book/_lib/journey-repo";
import { listUserEvents, recordEventChapter } from "@/app/app/api/book/_lib/events-repo";
import { listEventDefinitions } from "@/app/app/api/book/_lib/admin-events-repo";
import { maybeAwardInsightSpark } from "@/app/app/api/book/_lib/insight-spark";
import { createNotification } from "@/app/app/api/book/_lib/notifications-repo";
import { PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddbDoc } from "@/app/app/api/_lib/aws";
import {
  CHAPTER_FP,
  LOOP_COMPLETE_IP,
  INSIGHT_POINTS_AMOUNTS,
  QUIZ_PASS_THRESHOLDS,
  QUIZ_QUESTION_COUNTS,
  type LoopPipelineResult,
} from "@/app/book/_lib/flow-points-economy";
import { resolveLearningMode } from "@/app/app/api/book/_lib/learning-mode";
import { resolveStreakMode, resolveStreakSkipDays } from "@/app/app/api/book/_lib/streak-mode";
import type { ReadingDepth } from "@/app/book/data/bookChapters";
import type { ToneKey } from "@/app/book/data/book-package-core";

export const runtime = "nodejs";

const MAX_ATTEMPTS_PER_HOUR = 5;
const QUIZ_QUESTION_COUNTS_BY_DIFFICULTY: Record<ReadingDepth, number> = {
  simple: 5,
  standard: 7,
  deeper: 10,
};

type RequestResponse = {
  questionId: string;
  selectedChoiceId?: string | null;
  selectedIndex?: number | null;
};

function parseResponses(body: Record<string, unknown>): RequestResponse[] {
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

function parseDifficulty(value: unknown): ReadingDepth {
  return value === "simple" || value === "standard" || value === "deeper"
    ? value
    : "standard";
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

export async function POST(
  req: Request,
  { params }: { params: Promise<{ bookId: string; chapterNumber: string }> }
) {
  return withBookApiErrors(req, async () => {
    const user = await requireActiveBookUser();
    const { bookId, chapterNumber } = await params;
    const chapterNum = Number(chapterNumber);
    if (!bookId || !Number.isFinite(chapterNum) || chapterNum < 1) {
      throw new BookApiError(400, "invalid_chapter", "Invalid chapter number.");
    }
    const chapterNumberInt = Math.floor(chapterNum);

    let bodyRaw: unknown;
    try {
      bodyRaw = await req.json();
    } catch {
      throw new BookApiError(400, "invalid_json", "Request body must be valid JSON.");
    }
    const body = requireBodyObject(bodyRaw);
    const responses = parseResponses(body);
    const requestedAttemptNumber =
      typeof body.attemptNumber === "number" && Number.isFinite(body.attemptNumber)
        ? Math.max(1, Math.floor(body.attemptNumber))
        : 1;
    const difficulty = parseDifficulty(body.difficulty);
    const timeSpentSeconds =
      typeof body.timeSpentSeconds === "number" && Number.isFinite(body.timeSpentSeconds)
        ? Math.max(0, Math.min(60 * 60, Math.floor(body.timeSpentSeconds)))
        : undefined;

    const tableName = await getBookTableName();
    const contentBucket = await getBookContentBucket();
    const started = await ensureUserBookStarted({
      req,
      user,
      tableName,
      contentBucket,
      bookId,
      interactionChapterNumber: chapterNumberInt,
    });
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
    const tone = parseTone(body.tone ?? readSavedTone(userSettings?.settings));
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

    const maxQuestions = strictV12
      ? QUIZ_QUESTION_COUNTS_BY_DIFFICULTY[difficulty]
      : QUIZ_QUESTION_COUNTS[learningMode];

    if (quizState?.passed) {
      const response = bookOk({
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
      });
      return applyStartDeviceCookie(response, started);
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

    await recordQuizAttemptOutcome(tableName, {
      previousAttemptsCount,
      attempt,
      nextQuizState,
      nextProgress,
    });

    // Mode-dependent Insight Points (quiz-pass portion only — §1.1).
    // Loop completion IP, streak/tier/achievements/insight spark are awarded inline below.
    const isFirstAttempt = expectedAttemptNumber === 1;
    const quizPassPoints = isFirstAttempt
      ? CHAPTER_FP.quizPassFirstAttempt[learningMode]
      : CHAPTER_FP.quizPassRetry[learningMode];
    const perfectBonus =
      graded.scorePercent === 100 ? CHAPTER_FP.quizPerfectScore[learningMode] : 0;
    const totalQuizPoints = quizPassPoints + perfectBonus;

    const quizPassAward =
      graded.passed
        ? await awardFlowPoints(tableName, {
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
        : { awarded: false as const };
    const completedChapterCount = nextProgress?.completedChapters.length ?? 0;
    const completedBookNow =
      graded.passed &&
      completedChapterCount > 0 &&
      pinnedChapterCount > 0 &&
      completedChapterCount >= pinnedChapterCount;
    const bookCompleteAward =
      completedBookNow
        ? await awardFlowPoints(tableName, {
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
        : { awarded: false as const };

    // ── Loop-complete pipeline (streak, tier, achievements, insight spark) ──
    // Runs when the quiz is passed, making the server the source of truth
    // for streaks, tiers, and achievement awards.
    //
    // Each step is wrapped in its own try/catch so a failure in one phase
    // doesn't blank out the whole pipeline. The completion marker
    // (loopPipelineCompletedAt on the quiz state) is only set if every
    // critical step succeeded — operators can detect partially-failed loops
    // by querying for `passed=true AND attribute_not_exists(loopPipelineCompletedAt)`.
    //
    // Per-step markers (streakUpdatedAt, tierUpdatedAt, etc.) are set on the
    // LOOP record after each step. Partial failures are detected via
    // scripts/repair-partial-loops.ts which gates re-runs on these markers.
    // updateTierOnLoopComplete accepts skipLoopCountIncrement for safe repair.
    let loopPipeline: LoopPipelineResult | null = null;
    const pipelineErrors: string[] = [];

    if (graded.passed) {
      // Extract timezone from request body
      const timezone =
        typeof body.timezone === "string" && body.timezone.trim()
          ? body.timezone.trim()
          : "UTC";
      const bookCategory = manifest.categories?.[0] ?? "";
      // Loop-complete IP is deferred to the /unlock endpoint (§1.1).
      // Only the LOOP record is created here to mark the quiz pass.
      const loopCompleteIPAmount = isFirstAttempt
        ? LOOP_COMPLETE_IP[learningMode].firstAttempt
        : LOOP_COMPLETE_IP[learningMode].retry;

      // ── Step 1: Create LOOP record (idempotent) ───────────────────────
      try {
        await ddbDoc.send(
          new PutCommand({
            TableName: tableName,
            Item: {
              PK: bookUserPk(user.sub),
              SK: loopSk(bookId, chapterNumberInt),
              entity: "BOOK_USER_LOOP",
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
            },
            ConditionExpression:
              "attribute_not_exists(PK) AND attribute_not_exists(SK)",
          })
        );
      } catch {
        // Idempotent — LOOP record already exists
      }

      // Fire-and-forget: increment daily reader metrics for this book.
      const dayKey = ts.slice(0, 10);
      ddbDoc.send(
        new UpdateCommand({
          TableName: tableName,
          Key: { PK: bookMetricsPk(bookId), SK: dailyMetricsSk(dayKey) },
          UpdateExpression:
            "SET entity = :entity, bookId = :bookId, dayKey = :day, updatedAt = :now ADD uniqueReaders :one, loopCompletions :one",
          ExpressionAttributeValues: {
            ":entity": "BOOK_CHAPTER_DAILY_METRICS",
            ":bookId": bookId,
            ":day": dayKey,
            ":now": ts,
            ":one": 1,
          },
        })
      ).catch(() => {});

      // Helper to mark per-step completion on the LOOP record.
      const markLoopStep = (field: string) =>
        ddbDoc.send(
          new UpdateCommand({
            TableName: tableName,
            Key: { PK: bookUserPk(user.sub), SK: loopSk(bookId, chapterNumberInt) },
            UpdateExpression: `SET ${field} = :ts`,
            ExpressionAttributeValues: { ":ts": ts },
          })
        ).catch(() => {});

      // ── Step 1.5: Seed FSRS spaced-repetition cards (idempotent) ──────
      // This is the load-bearing seam: without it /me/reviews stays empty
      // and the dashboard has nothing real to show. initializeCardsForChapter
      // dedupes per card, so re-passes / retries are safe.
      try {
        const { chapter: chapterContent } = await getUserAccessibleChapter({
          tableName,
          contentBucket,
          userId: user.sub,
          bookId,
          chapterNumber: chapterNumberInt,
        });
        const reviewCards = chapterContent.reviewCards ?? [];
        if (reviewCards.length > 0) {
          await initializeCardsForChapter(
            tableName,
            user.sub,
            bookId,
            chapterNumberInt,
            reviewCards,
            tone,
          );
          await markLoopStep("fsrsSeededAt");
        }
      } catch (e) {
        // FSRS seeding is a non-critical, idempotent side effect — do NOT add it
        // to pipelineErrors (that would block markLoopPipelineCompleted and force
        // the whole loop pipeline to re-run). The next pass or the backfill seeds it.
        console.error("[fsrs-seed-failure]", {
          userId: user.sub, bookId, chapterNumber: chapterNumberInt,
          error: String(e),
        });
      }

      // ── Step 2: Update streak ────────────────────────────────────────
      let streakResult: Awaited<ReturnType<typeof updateStreakOnLoopComplete>> | null = null;
      try {
        // SET-7: resolve streak mode + skip-day tolerance from server-stored
        // settings (not the request body) so a "flexible" reader keeps their
        // streak across short gaps without it being claimable per-request. Reads
        // the same userSettings already loaded above for learning mode.
        streakResult = await updateStreakOnLoopComplete(tableName, user.sub, timezone, {
          mode: resolveStreakMode(userSettings?.settings),
          skipDays: resolveStreakSkipDays(userSettings?.settings),
        });
        await markLoopStep("streakUpdatedAt");
      } catch (e) {
        pipelineErrors.push("streak");
        console.error("[loop-pipeline-partial-failure]", {
          userId: user.sub, bookId, chapterNumber: chapterNumberInt,
          failedStep: "streak", error: String(e),
        });
      }

      // ── Step 3: Update tier ──────────────────────────────────────────
      let tierResult: Awaited<ReturnType<typeof updateTierOnLoopComplete>> | null = null;
      try {
        tierResult = await updateTierOnLoopComplete(
          tableName,
          user.sub,
          graded.scorePercent,
          bookCategory,
          {
            completedBookNow,
            bookId,
          }
        );
        await markLoopStep("tierUpdatedAt");
      } catch (e) {
        pipelineErrors.push("tier");
        console.error("[loop-pipeline-partial-failure]", {
          userId: user.sub, bookId, chapterNumber: chapterNumberInt,
          failedStep: "tier", error: String(e),
        });
      }

      // ── Step 4: Achievements ─────────────────────────────────────────
      let achievementResults: Awaited<
        ReturnType<typeof checkAchievementsAfterLoopComplete>
      > = [];
      if (streakResult && tierResult) {
        try {
          let bookStartedAt: string | undefined;
          if (completedBookNow) {
            const bookState = await getUserBookState(tableName, user.sub, bookId);
            bookStartedAt = bookState?.createdAt || undefined;
          }
          achievementResults = await checkAchievementsAfterLoopComplete({
            userId: user.sub,
            tableName,
            streak: streakResult.streak,
            tier: tierResult.tier,
            latestQuizScore: graded.scorePercent,
            latestLearningMode: learningMode,
            latestIsFirstAttempt: isFirstAttempt,
            bookId,
            bookCompleted: completedBookNow,
            bookChapterCount: pinnedChapterCount,
            loopCompletedAt: ts,
            userTimezone: timezone,
            bookStartedAt,
            inactiveDaysBeforeReturn: streakResult.gapDays,
            completedBooksInDistinctCategories: completedBookNow
              ? Object.keys(tierResult.tier.completedBooksByCategory ?? {}).filter(
                  (cat) => (tierResult.tier.completedBooksByCategory?.[cat]?.length ?? 0) > 0
                ).length
              : undefined,
          });
          await markLoopStep("achievementsCheckedAt");
        } catch (e) {
          pipelineErrors.push("achievements");
          console.error("[loop-pipeline-partial-failure]", {
            userId: user.sub, bookId, chapterNumber: chapterNumberInt,
            failedStep: "achievements", error: String(e),
          });
        }
      } else {
        // Streak or tier missing — can't safely evaluate achievements.
        pipelineErrors.push("achievements_skipped");
      }

      // ── Step 5: Insight Spark ────────────────────────────────────────
      let sparkResult: { triggered: boolean; amount: number } = {
        triggered: false,
        amount: 0,
      };
      try {
        const today =
          streakResult?.streak.lastActiveDate ??
          new Date().toISOString().slice(0, 10);
        sparkResult = await maybeAwardInsightSpark(
          tableName,
          user.sub,
          today,
          `${bookId}:${chapterNumberInt}`
        );
        await markLoopStep("insightSparkCheckedAt");
      } catch (e) {
        pipelineErrors.push("insight_spark");
        console.error("[loop-pipeline-partial-failure]", {
          userId: user.sub, bookId, chapterNumber: chapterNumberInt,
          failedStep: "spark", error: String(e),
        });
      }

      // Fire-and-forget in-app notifications for pipeline results.
      if (tierResult?.advanced && tierResult.newTier) {
        createNotification(tableName, {
          userId: user.sub,
          type: "tier_up",
          title: `Tier Up: ${tierResult.definition?.displayName ?? tierResult.newTier}`,
          body: `You've advanced to ${tierResult.definition?.displayName ?? tierResult.newTier}! +${tierResult.advancementIP} IP`,
          metadata: { tier: tierResult.newTier, ip: tierResult.advancementIP },
        }).catch(() => {});
      }
      for (const a of achievementResults) {
        createNotification(tableName, {
          userId: user.sub,
          type: "badge_earned",
          title: `Achievement: ${a.name}`,
          body: a.celebrationCopy || `You earned "${a.name}" (+${a.ipAwarded} IP)`,
          metadata: { achievementId: a.achievementId, ip: a.ipAwarded },
        }).catch(() => {});
      }
      if (streakResult?.milestonesAwarded.length) {
        for (const m of streakResult.milestonesAwarded) {
          createNotification(tableName, {
            userId: user.sub,
            type: "streak_milestone",
            title: `${m.days}-Day Streak!`,
            body: `You've maintained a ${m.days}-day reading streak! +${m.ip} IP`,
            metadata: { days: m.days, ip: m.ip },
          }).catch(() => {});
        }
      }
      if (sparkResult.triggered) {
        createNotification(tableName, {
          userId: user.sub,
          type: "insight_spark",
          title: "Insight Spark!",
          body: `You triggered a random Insight Spark! +${sparkResult.amount} IP`,
          metadata: { amount: sparkResult.amount },
        }).catch(() => {});
      }

      // ── Step 6: Event chapter tracking ──────────────────────────────
      try {
        const now = new Date();
        const allEventDefs = await listEventDefinitions(tableName);
        const activeEventDefs = allEventDefs.filter(
          (e) =>
            e.active !== false &&
            new Date(e.startDate) <= now &&
            new Date(e.endDate) >= now &&
            e.books.includes(bookId),
        );
        if (activeEventDefs.length > 0) {
          const userEvents = await listUserEvents(tableName, user.sub);
          const joinedEventIds = new Set(userEvents.map((e) => e.eventId));
          const chapterId = `${bookId}:ch${chapterNumberInt}`;
          for (const eventDef of activeEventDefs) {
            if (joinedEventIds.has(eventDef.eventId)) {
              await recordEventChapter(
                tableName,
                user.sub,
                eventDef.eventId,
                chapterId,
                eventDef,
              );
            }
          }
        }
        await markLoopStep("eventTrackingCheckedAt");
      } catch (e) {
        pipelineErrors.push("event_tracking");
        console.error("[loop-pipeline-partial-failure]", {
          userId: user.sub, bookId, chapterNumber: chapterNumberInt,
          failedStep: "event_tracking", error: String(e),
        });
      }

      // ── Step 7: Journey advancement ──────────────────────────────────
      let journeyResults: JourneyAdvancementResult[] = [];
      if (completedBookNow) {
        try {
          journeyResults = await checkAndAdvanceJourneys(
            tableName,
            user.sub,
            bookId,
          );
          await markLoopStep("journeyAdvancedAt");

          // Fire-and-forget notifications for journey completions
          for (const jr of journeyResults) {
            if (jr.completed) {
              createNotification(tableName, {
                userId: user.sub,
                type: "badge_earned",
                title: "Journey Complete!",
                body: `You completed a learning journey${jr.bonusIPAwarded > 0 ? ` and earned ${jr.bonusIPAwarded} IP` : ""}!`,
                metadata: { journeyId: jr.journeyId, ip: jr.bonusIPAwarded },
              }).catch(() => {});
            }
          }
        } catch (e) {
          pipelineErrors.push("journey_advancement");
          console.error("[loop-pipeline-partial-failure]", {
            userId: user.sub, bookId, chapterNumber: chapterNumberInt,
            failedStep: "journey_advancement", error: String(e),
          });
        }
      }

      // Always build a pipeline result with whatever fields succeeded.
      loopPipeline = {
        quizPassIP: quizPassAward.awarded ? totalQuizPoints - perfectBonus : 0,
        perfectBonusIP: quizPassAward.awarded ? perfectBonus : 0,
        loopCompleteIP: 0, // Deferred to /unlock endpoint (§1.1)
        bookCompleteIP: bookCompleteAward.awarded ? INSIGHT_POINTS_AMOUNTS.bookComplete : 0,
        streak: streakResult
          ? {
              currentStreak: streakResult.streak.currentStreak,
              longestStreak: streakResult.streak.longestStreak,
              shieldsHeld: streakResult.streak.streakShieldsHeld,
              streakReset: streakResult.streakReset,
              shieldsConsumed: streakResult.shieldsConsumed,
              streakDayIP: streakResult.streakDayAwarded
                ? INSIGHT_POINTS_AMOUNTS.streakDayBonus
                : 0,
              welcomeBackIP: streakResult.welcomeBackAwarded
                ? INSIGHT_POINTS_AMOUNTS.welcomeBack
                : 0,
              milestones: streakResult.milestonesAwarded.map((m) => ({
                days: m.days,
                ip: m.ip,
              })),
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

      // Mark the pipeline as fully completed only if every step succeeded.
      // If anything failed, the marker stays unset and operators can identify
      // affected loops by querying quiz states with passed=true and no marker.
      if (pipelineErrors.length === 0) {
        try {
          await markLoopPipelineCompleted(
            tableName,
            user.sub,
            bookId,
            chapterNumberInt,
            ts
          );
        } catch (e) {
          console.error("[loop-pipeline] failed to mark completion:", e);
        }
      } else {
        console.error(
          "[loop-pipeline] partial failure — affected steps:",
          pipelineErrors,
          { userId: user.sub, bookId, chapterNumber: chapterNumberInt }
        );
      }
    }

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

        if (quizPassAward.awarded) {
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

        if (bookCompleteAward.awarded) {
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
    const response = bookOk({
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
    });
    return applyStartDeviceCookie(response, started);
  });
}
