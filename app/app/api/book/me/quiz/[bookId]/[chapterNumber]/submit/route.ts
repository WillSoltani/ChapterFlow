import "server-only";
import { requireUser } from "@/app/app/api/_lib/auth";
import {
  bookOk,
  requireBodyObject,
  withBookApiErrors,
} from "@/app/app/api/book/_lib/http";
import { getBookContentBucket, getBookTableName } from "@/app/app/api/book/_lib/env";
import { getUserAccessibleQuiz } from "@/app/app/api/book/_lib/content-service";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import {
  scoreQuizResponsesByQuestionId,
  scoreQuizSubmission,
} from "@/app/app/api/book/_lib/quiz-service";
import {
  countRecentQuizAttempts,
  listRecentQuizAttempts,
  updateProgressAfterQuizPass,
  writeQuizAttempt,
} from "@/app/app/api/book/_lib/repo";
import { nowIso } from "@/app/app/api/book/_lib/keys";
import type { ChapterQuizPayload } from "@/app/app/api/book/_lib/types";

export const runtime = "nodejs";

const MAX_ATTEMPTS_PER_HOUR = 5;
const BASE_COOLDOWN_SECONDS = 60;

function rotateChoices(choices: string[], by: number): string[] {
  if (choices.length === 0) return [];
  const shift = ((by % choices.length) + choices.length) % choices.length;
  if (shift === 0) return choices;
  return choices.map((_, index) => choices[(index + shift) % choices.length]);
}

function dedupeQuestionsById(questions: ChapterQuizPayload["questions"]) {
  const seen = new Set<string>();
  return questions.filter((question) => {
    if (seen.has(question.questionId)) return false;
    seen.add(question.questionId);
    return true;
  });
}

function buildRetryPool(quiz: ChapterQuizPayload): ChapterQuizPayload["questions"] {
  const authored = Array.isArray(quiz.retryQuestions) ? quiz.retryQuestions : [];
  const generated = quiz.questions.map((question, index) => {
    const correctChoice = question.choices[question.correctAnswerIndex];
    const distractors = question.choices.filter(
      (_, choiceIndex) => choiceIndex !== question.correctAnswerIndex
    );
    const paddedDistractors = [...distractors];
    while (paddedDistractors.length < 3) {
      paddedDistractors.push("An unrelated claim that misses the core concept.");
    }
    const baseChoices = [correctChoice, ...paddedDistractors.slice(0, 3)];
    const rotated = rotateChoices(baseChoices, (quiz.number + index) % 4);
    const rotatedCorrectIndex = rotated.findIndex((choice) => choice === correctChoice);
    return {
      questionId: `${question.questionId}-retry-${String(index + 1).padStart(2, "0")}`,
      prompt: question.prompt,
      choices: rotated,
      correctAnswerIndex: rotatedCorrectIndex >= 0 ? rotatedCorrectIndex : 0,
      explanation: question.explanation,
    };
  });
  return dedupeQuestionsById([...authored, ...generated]).slice(0, 5);
}

function currentFailureStreak(
  attemptsDescending: Array<{ passed: boolean }>
): number {
  let streak = 0;
  for (const attempt of attemptsDescending) {
    if (attempt.passed) break;
    streak += 1;
  }
  return streak;
}

function cooldownSecondsForFailureStreak(streak: number): number {
  if (streak <= 0) return 0;
  return BASE_COOLDOWN_SECONDS * 2 ** Math.max(0, streak - 1);
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

    let bodyRaw: unknown;
    try {
      bodyRaw = await req.json();
    } catch {
      throw new BookApiError(400, "invalid_json", "Request body must be valid JSON.");
    }
    const body = requireBodyObject(bodyRaw);
    const answers = body.answers;
    const responsesRaw = body.responses;
    const hasLegacyAnswers = Array.isArray(answers);
    const hasResponses = Array.isArray(responsesRaw);
    if (!hasLegacyAnswers && !hasResponses) {
      throw new BookApiError(
        400,
        "invalid_answers",
        "Provide answers (legacy array) or responses (questionId + selectedIndex)."
      );
    }
    const normalizedAnswers = hasLegacyAnswers
      ? (answers as unknown[]).map((value, idx) => {
          if (
            typeof value !== "number" ||
            !Number.isFinite(value) ||
            Math.floor(value) !== value
          ) {
            throw new BookApiError(
              400,
              "invalid_answers",
              `answers[${idx}] must be an integer.`
            );
          }
          return value;
        })
      : null;
    const normalizedResponses = hasResponses
      ? (responsesRaw as unknown[]).map((entry, idx) => {
          if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
            throw new BookApiError(
              400,
              "invalid_answers",
              `responses[${idx}] must be an object.`
            );
          }
          const rec = entry as Record<string, unknown>;
          const questionId =
            typeof rec.questionId === "string" ? rec.questionId.trim().slice(0, 256) : "";
          const selectedIndex = rec.selectedIndex;
          if (!questionId) {
            throw new BookApiError(
              400,
              "invalid_answers",
              `responses[${idx}].questionId is required.`
            );
          }
          if (
            typeof selectedIndex !== "number" ||
            !Number.isFinite(selectedIndex) ||
            Math.floor(selectedIndex) !== selectedIndex
          ) {
            throw new BookApiError(
              400,
              "invalid_answers",
              `responses[${idx}].selectedIndex must be an integer.`
            );
          }
          return { questionId, selectedIndex };
        })
      : null;

    const tableName = await getBookTableName();
    const contentBucket = await getBookContentBucket();
    const chapterNumberInt = Math.floor(chapterNum);

    const recentAttemptItems = await listRecentQuizAttempts(
      tableName,
      user.sub,
      bookId,
      chapterNumberInt,
      20
    );
    const streakBeforeAttempt = currentFailureStreak(recentAttemptItems);
    const latestAttempt = recentAttemptItems[0];
    if (latestAttempt && !latestAttempt.passed && streakBeforeAttempt > 0) {
      const cooldownSeconds = cooldownSecondsForFailureStreak(streakBeforeAttempt);
      const nextAttemptAtMs =
        new Date(latestAttempt.createdAt).getTime() + cooldownSeconds * 1000;
      const retryAfterSeconds = Math.ceil((nextAttemptAtMs - Date.now()) / 1000);
      if (retryAfterSeconds > 0) {
        throw new BookApiError(
          429,
          "attempt_cooldown",
          "Retake is temporarily locked after repeated failed attempts.",
          {
            retryAfterSeconds,
            failureStreak: streakBeforeAttempt,
            nextAttemptAvailableAt: new Date(nextAttemptAtMs).toISOString(),
          }
        );
      }
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

    const { quiz } = await getUserAccessibleQuiz({
      tableName,
      contentBucket,
      userId: user.sub,
      bookId,
      chapterNumber: chapterNumberInt,
    });

    const retryPool = buildRetryPool(quiz);
    const fullPool = [...quiz.questions, ...retryPool];
    const result =
      normalizedResponses && normalizedResponses.length > 0
        ? scoreQuizResponsesByQuestionId(
            quiz,
            normalizedResponses,
            { questionPool: fullPool }
          )
        : scoreQuizSubmission(quiz, normalizedAnswers ?? []);
    const ts = nowIso();
    await writeQuizAttempt(tableName, {
      userId: user.sub,
      bookId,
      chapterNumber: chapterNumberInt,
      scorePercent: result.scorePercent,
      passed: result.passed,
      createdAt: ts,
    });

    if (result.passed) {
      await updateProgressAfterQuizPass(tableName, {
        userId: user.sub,
        bookId,
        chapterNumber: chapterNumberInt,
        scorePercent: result.scorePercent,
      });
    }

    const failureStreak = result.passed ? 0 : streakBeforeAttempt + 1;
    const cooldownSeconds = result.passed
      ? 0
      : cooldownSecondsForFailureStreak(failureStreak);
    const nextAttemptAvailableAt = result.passed
      ? null
      : new Date(Date.now() + cooldownSeconds * 1000).toISOString();

    return bookOk({
      scorePercent: result.scorePercent,
      passed: result.passed,
      passingScorePercent: quiz.passingScorePercent,
      totalQuestions: result.total,
      correctAnswers: result.correct,
      unlockedNextChapter: result.passed,
      review: result.review,
      failureStreak,
      cooldownSeconds,
      nextAttemptAvailableAt,
    });
  });
}
