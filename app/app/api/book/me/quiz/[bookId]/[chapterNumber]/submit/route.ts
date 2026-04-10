import "server-only";

import { requireUser } from "@/app/app/api/_lib/auth";
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
  getUserAccessibleQuiz,
  isLocalV12Package,
} from "@/app/app/api/book/_lib/content-service";
import {
  analyticsTrackBookCompleted,
  analyticsTrackFlowPointsTransaction,
  analyticsTrackQuizAttempt,
  analyticsTrackQuizInteraction,
} from "@/app/app/api/book/_lib/analytics-repo";
import { bookUserPk, loopSk, nowIso } from "@/app/app/api/book/_lib/keys";
import {
  buildProgressAfterQuizPass,
  buildQuizAttemptQuestions,
  buildQuizClientSession,
  buildQuizStateFromAttempts,
  cooldownSecondsForFailureStreak,
  gradeQuizAttemptQuestions,
  remainingCooldownSeconds,
} from "@/app/app/api/book/_lib/quiz-session";
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
import { maybeAwardInsightSpark } from "@/app/app/api/book/_lib/insight-spark";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { ddbDoc } from "@/app/app/api/_lib/aws";
import {
  CHAPTER_FP,
  LOOP_COMPLETE_IP,
  INSIGHT_POINTS_AMOUNTS,
  QUIZ_PASS_THRESHOLDS,
  QUIZ_QUESTION_COUNTS,
  type LoopPipelineResult,
} from "@/app/book/_lib/flow-points-economy";
import type { LearningMode } from "@/app/book/settings/types/settings";
import type { ReadingDepth } from "@/app/book/data/mockChapters";
import type { ToneKey } from "@/app/book/data/bookPackages";

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
    const user = await requireUser();
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
    const [{ progress, quiz: s3Quiz }, { manifest }, persistedQuizState, recentAttempts, userSettings] = await Promise.all([
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

    // Resolve learning mode from server-stored settings (not client request body)
    // to prevent gaming (e.g., submitting with "guided" mode for lower threshold)
    const rawMode = userSettings?.settings?.learningMode;
    const learningMode: LearningMode =
      rawMode === "guided" || rawMode === "standard" || rawMode === "challenge"
        ? rawMode
        : "standard";
    const tone = parseTone(body.tone ?? readSavedTone(userSettings?.settings));
    // Prefer quiz questions from local book-package JSON over stale S3 data.
    const localQuestions = getLocalQuizQuestions(bookId, chapterNumberInt, tone);
    const quiz = localQuestions
      ? { ...s3Quiz, questions: localQuestions }
      : s3Quiz;
    const strictV12 = isLocalV12Package(bookId);

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
            return {
              total: legacy.total,
              correct: legacy.correct,
              scorePercent: legacy.scorePercent,
              passed: legacy.scorePercent >= passingScorePercent,
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
      manifest.chapterCount > 0 &&
      completedChapterCount >= manifest.chapterCount;
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
    // TODO: Add a /me/loop-pipeline/repair endpoint that re-runs only the
    // missing steps. Note that updateTierOnLoopComplete is NOT idempotent
    // (totalLoopsCompleted increments on every call), so any retry layer must
    // gate per-step on a marker stored on the LOOP record.
    let loopPipeline: LoopPipelineResult | null = null;
    const pipelineErrors: string[] = [];

    if (graded.passed) {
      // Extract timezone from request body
      const timezone =
        typeof body.timezone === "string" && body.timezone.trim()
          ? body.timezone.trim()
          : "UTC";
      const bookCategory = manifest.categories?.[0] ?? "";
      const loopCompleteIPAmount = isFirstAttempt
        ? LOOP_COMPLETE_IP[learningMode].firstAttempt
        : LOOP_COMPLETE_IP[learningMode].retry;

      // ── Step 1: Award loop completion IP ──────────────────────────────
      let loopAward: { awarded: boolean } = { awarded: false };
      try {
        loopAward = await awardFlowPoints(tableName, {
          userId: user.sub,
          amount: loopCompleteIPAmount,
          sourceType: "loop_complete",
          sourceId: `${bookId}:${chapterNumberInt}`,
          metadata: {
            bookId,
            chapterNumber: chapterNumberInt,
            learningMode,
            isFirstAttempt,
          },
          createdAt: ts,
        });
      } catch (e) {
        pipelineErrors.push("loop_complete_ip");
        console.error("[loop-pipeline] loop_complete IP failed:", e);
      }

      // ── Step 2: Create LOOP record (idempotent) ───────────────────────
      if (loopAward.awarded) {
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
                createdAt: ts,
              },
              ConditionExpression:
                "attribute_not_exists(PK) AND attribute_not_exists(SK)",
            })
          );
        } catch {
          // Idempotent — LOOP record already exists
        }
      }

      // ── Step 3: Update streak ────────────────────────────────────────
      let streakResult: Awaited<ReturnType<typeof updateStreakOnLoopComplete>> | null = null;
      try {
        streakResult = await updateStreakOnLoopComplete(tableName, user.sub, timezone);
      } catch (e) {
        pipelineErrors.push("streak");
        console.error("[loop-pipeline] streak update failed:", e);
      }

      // ── Step 4: Update tier ──────────────────────────────────────────
      let tierResult: Awaited<ReturnType<typeof updateTierOnLoopComplete>> | null = null;
      try {
        tierResult = await updateTierOnLoopComplete(
          tableName,
          user.sub,
          graded.scorePercent,
          bookCategory
        );
      } catch (e) {
        pipelineErrors.push("tier");
        console.error("[loop-pipeline] tier update failed:", e);
      }

      // ── Step 5: Achievements ─────────────────────────────────────────
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
            bookChapterCount: manifest.chapterCount,
            loopCompletedAt: ts,
            userTimezone: timezone,
            bookStartedAt,
            inactiveDaysBeforeReturn: streakResult.gapDays,
            // Interim proxy: categoriesExplored counts categories with any loop,
            // not just fully-completed books. Good enough for Bridge Builder detection.
            // TODO: Track precise completedBooksDistinctCategories on tier record.
            completedBooksInDistinctCategories: completedBookNow
              ? tierResult.tier.categoriesExplored.length
              : undefined,
          });
        } catch (e) {
          pipelineErrors.push("achievements");
          console.error("[loop-pipeline] achievements check failed:", e);
        }
      } else {
        // Streak or tier missing — can't safely evaluate achievements.
        pipelineErrors.push("achievements_skipped");
      }

      // ── Step 6: Insight Spark ────────────────────────────────────────
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
      } catch (e) {
        pipelineErrors.push("insight_spark");
        console.error("[loop-pipeline] insight spark failed:", e);
      }

      // Always build a pipeline result with whatever fields succeeded.
      loopPipeline = {
        quizPassIP: quizPassAward.awarded ? totalQuizPoints - perfectBonus : 0,
        perfectBonusIP: quizPassAward.awarded ? perfectBonus : 0,
        loopCompleteIP: loopAward.awarded ? loopCompleteIPAmount : 0,
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
              totalChapterCount: manifest.chapterCount,
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
