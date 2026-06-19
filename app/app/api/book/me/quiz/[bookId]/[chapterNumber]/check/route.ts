import "server-only";

import { requireActiveBookUser } from "@/app/app/api/book/_lib/account-guard";
import { getBookContentBucket, getBookTableName } from "@/app/app/api/book/_lib/env";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import { bookOk, requireBodyObject, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import {
  getLocalQuizQuestions,
  getUserAccessibleQuiz,
  isLocalV12Package,
} from "@/app/app/api/book/_lib/content-service";
import { buildQuizAttemptQuestions } from "@/app/app/api/book/_lib/quiz-session";
import { resolveLearningMode } from "@/app/app/api/book/_lib/learning-mode";
import { getUserSettingsItem } from "@/app/app/api/book/_lib/repo";
import { QUIZ_QUESTION_COUNTS } from "@/app/book/_lib/flow-points-economy";
import type { ReadingDepth } from "@/app/book/data/bookChapters";
import type { ToneKey } from "@/app/book/data/bookPackages";

export const runtime = "nodejs";

const QUIZ_QUESTION_COUNTS_BY_DIFFICULTY: Record<ReadingDepth, number> = {
  simple: 5,
  standard: 7,
  deeper: 10,
};

// Bound a single request so it can't be used to grade an arbitrarily large
// batch in one call. The real authoritative grade + rate limiting + cooldown
// live in /submit; /check is a read-only correctness oracle for the inline
// answering UX (see the SECURITY note below).
const MAX_CHECK_RESPONSES = 50;

type CheckResponseInput = {
  questionId: string;
  selectedChoiceId: string;
};

function parseResponses(body: Record<string, unknown>): CheckResponseInput[] {
  const responsesRaw = body.responses;
  if (!Array.isArray(responsesRaw) || responsesRaw.length === 0) {
    throw new BookApiError(
      400,
      "invalid_answers",
      "responses must include at least one answer to check."
    );
  }
  if (responsesRaw.length > MAX_CHECK_RESPONSES) {
    throw new BookApiError(
      400,
      "invalid_answers",
      `responses may include at most ${MAX_CHECK_RESPONSES} answers.`
    );
  }
  const seen = new Set<string>();
  return responsesRaw.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new BookApiError(400, "invalid_answers", `responses[${index}] must be an object.`);
    }
    const record = entry as Record<string, unknown>;
    const questionId =
      typeof record.questionId === "string" ? record.questionId.trim().slice(0, 256) : "";
    const selectedChoiceId =
      typeof record.selectedChoiceId === "string"
        ? record.selectedChoiceId.trim().slice(0, 256)
        : "";
    if (!questionId) {
      throw new BookApiError(400, "invalid_answers", `responses[${index}].questionId is required.`);
    }
    if (!selectedChoiceId) {
      throw new BookApiError(
        400,
        "invalid_answers",
        `responses[${index}].selectedChoiceId is required.`
      );
    }
    // One verdict per question per request (mirrors the submit route). This stops
    // a single /check call from probing several choices of the SAME question to
    // discover its answer — a scripted probe must then spend one request per
    // guess, matching the residual described in the route's SECURITY note.
    if (seen.has(questionId)) {
      throw new BookApiError(
        400,
        "invalid_answers",
        `responses contains duplicate questionId ${questionId}.`
      );
    }
    seen.add(questionId);
    return { questionId, selectedChoiceId };
  });
}

function parseDifficulty(value: unknown): ReadingDepth {
  return value === "simple" || value === "standard" || value === "deeper" ? value : "standard";
}

function parseTone(value: unknown): ToneKey {
  return value === "gentle" || value === "direct" || value === "competitive" ? value : "direct";
}

function readSavedTone(settings: unknown): string | null {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return null;
  const extended = (settings as { extended?: unknown }).extended;
  if (!extended || typeof extended !== "object" || Array.isArray(extended)) return null;
  return typeof (extended as { contentTone?: unknown }).contentTone === "string"
    ? ((extended as { contentTone?: string }).contentTone ?? null)
    : null;
}

/**
 * POST /app/api/book/me/quiz/[bookId]/[chapterNumber]/check
 *
 * Grades one or more in-progress quiz answers and returns ONLY their
 * correctness — never the answer key. This closes H3 (SEC-QUIZ-LEAK): the GET
 * quiz payload no longer ships `correctChoiceId` for an unanswered ("ready")
 * attempt, so the reader's inline correct/incorrect feedback round-trips here
 * instead of comparing against a shipped key.
 *
 * SECURITY — what this endpoint deliberately does and does NOT do:
 *  - It returns `{ results: [{ questionId, isCorrect }] }`. It NEVER returns
 *    `correctChoiceId` (or any encoding of the answer index). A wrong guess
 *    yields `isCorrect: false` and nothing more; the correct answer is revealed
 *    only AFTER /submit, in the post-submit review projection.
 *  - It is read-only: no attempt is recorded, no IP/streak/unlock is touched,
 *    no quiz state is written. /submit remains the sole authority for the grade,
 *    the chapter unlock, and the IP economy, and keeps its own re-grade,
 *    per-attempt rate limit (MAX_ATTEMPTS_PER_HOUR) and failure cooldowns.
 *  - It rebuilds the attempt's questions with the SAME seed inputs the GET route
 *    uses (userId/bookId/chapterNumber/attemptNumber + maxQuestions +
 *    preserveAuthoredOrder), so the shuffled choiceIds match what the reader is
 *    looking at and grading is identical to /submit's gradeQuizAttemptQuestions.
 *  - Access control mirrors GET: getUserAccessibleQuiz throws for a chapter the
 *    user cannot access, so this cannot grade a locked chapter.
 *
 * Residual (accepted): any inline-feedback quiz is, by construction, a
 * correctness oracle — a scripted client could probe choices to discover an
 * answer. That is a strictly higher bar than the closed leak (which handed the
 * answer in plaintext with zero probing). parseResponses rejects duplicate
 * questionIds, so a single call cannot batch-probe the several choices of one
 * question — discovering one answer costs one request per guess — and the
 * authoritative, rate-limited /submit still governs the actual pass. If stronger
 * anti-cheat is wanted later, the right move is a stateful per-question guess
 * budget keyed on (user, attempt, question) — out of scope here.
 */
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
    const attemptNumber =
      typeof body.attemptNumber === "number" && Number.isFinite(body.attemptNumber)
        ? Math.max(1, Math.floor(body.attemptNumber))
        : 1;

    const tableName = await getBookTableName();
    const contentBucket = await getBookContentBucket();

    const [{ quiz: s3Quiz }, userSettings] = await Promise.all([
      getUserAccessibleQuiz({
        tableName,
        contentBucket,
        userId: user.sub,
        bookId,
        chapterNumber: chapterNumberInt,
      }),
      getUserSettingsItem(tableName, user.sub),
    ]);

    // Resolve learning mode / tone / maxQuestions exactly as the GET route does,
    // from server-stored settings (never the request body) so the rebuilt
    // question set — and therefore the choiceId scheme — matches what was served.
    // SET-1: the shared resolver guarantees this stays identical to the GET +
    // submit routes (a divergence here would mis-grade).
    const learningMode = resolveLearningMode(userSettings?.settings);
    const difficulty = parseDifficulty(body.difficulty);
    const tone = parseTone(body.tone ?? readSavedTone(userSettings?.settings));
    const localQuestions = getLocalQuizQuestions(bookId, chapterNumberInt, tone);
    const quiz = localQuestions ? { ...s3Quiz, questions: localQuestions } : s3Quiz;
    const strictV12 = isLocalV12Package(bookId);
    const maxQuestions = strictV12
      ? QUIZ_QUESTION_COUNTS_BY_DIFFICULTY[difficulty]
      : QUIZ_QUESTION_COUNTS[learningMode];

    const attemptQuestions = buildQuizAttemptQuestions({
      quiz,
      userId: user.sub,
      bookId,
      chapterNumber: chapterNumberInt,
      attemptNumber,
      maxQuestions,
      preserveAuthoredOrder: strictV12,
    });
    const byId = new Map(attemptQuestions.map((question) => [question.questionId, question]));

    const results = responses.map((response) => {
      const question = byId.get(response.questionId);
      // Unknown question id (stale session / tampered body): report not-correct
      // rather than 400, so a transient mismatch degrades to "try again" in the
      // UI instead of breaking the whole quiz. Never echoes a key either way.
      const isCorrect = question
        ? question.correctChoiceId === response.selectedChoiceId
        : false;
      return { questionId: response.questionId, isCorrect };
    });

    const response = bookOk({ results });
    // This is a per-keystroke grade check; never cache it.
    response.headers.set("Cache-Control", "no-store");
    return response;
  });
}
