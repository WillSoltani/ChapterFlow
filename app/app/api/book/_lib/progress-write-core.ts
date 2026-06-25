// Pure, DynamoDB-free builders + classifiers for the canonical BOOK_PROGRESS
// (SK `PROGRESS#<bookId>`) write path. This is the *-core seam so the concurrency
// logic can be unit-tested without reaching real DynamoDB (repo.ts pulls in the
// AWS client at module load and can't be imported under `tsx --test`).
//
// THE PROBLEM these replace: the per-book progress item was previously written via
// UNCONDITIONAL full-object `Put`s (upsertUserProgress / recordQuizAttemptOutcome).
// `nextProgress` is computed from a snapshot read at the START of the request, so
// two concurrent writers (two tabs, a double-tap submit, a retried request, or the
// `ensureUserBookStarted` touch racing the quiz-pass write) each Put their own stale
// full object — the later writer silently rolls back the earlier writer's
// `completedChapters` / `unlockedThroughChapterNumber`, i.e. it un-completes a
// chapter or re-locks an unlock.
//
// FIX: field-scoped conditional `Update`s instead of full Puts.
//  - The interaction "touch" only SETs cursor/activity fields and a max-guard on
//    `currentChapterNumber`; it NEVER writes the gating fields.
//  - The quiz-pass write carries a monotonic `progressRev` optimistic-concurrency
//    guard so a stale write is rejected (the caller re-reads + recomputes + retries),
//    rather than blindly clobbering a concurrently-advanced row.

import type { BookUserProgress } from "./types";

/**
 * Validate + clamp a client-supplied `lastOpenedAt` before it reaches the canonical
 * BOOK_PROGRESS row (and the per-book BOOK_USER_BOOK_STATE projection).
 *
 * THE PROBLEM: the /state PATCH took `lastOpenedAt` as any client string with no
 * validation (`typeof x === "string" ? x : now`) and SET it straight into the
 * canonical progress item. `lastOpenedAt` feeds the "book started" badge clause
 * (`lastOpenedAt !== epoch`) and recency / last-read sorting, so a client could PATCH
 * a garbage string ("not-a-date") or a far-future value ("9999-12-31...") to corrupt
 * those surfaces.
 *
 * FIX (pure, here in the *-core seam so it's unit-testable without DynamoDB):
 *  - reject non-strings and anything that doesn't parse to a finite epoch → fall back
 *    to `now`;
 *  - clamp anything strictly AFTER `now` back to `now` (no future timestamps);
 *  - otherwise normalize to a canonical ISO-8601 string so an oddly-but-validly
 *    formatted input is stored consistently.
 *
 * `now` must itself be a valid ISO timestamp (the caller's `nowIso()`); it is the
 * floor/ceiling the result is measured against and the fallback on any rejection.
 */
export function sanitizeLastOpenedAt(value: unknown, now: string): string {
  const nowMs = new Date(now).getTime();
  if (typeof value !== "string") return now;
  const ms = new Date(value).getTime();
  if (!Number.isFinite(ms)) return now;
  // No future timestamps: a clock-skewed or adversarial value can't push activity
  // ahead of server time.
  if (Number.isFinite(nowMs) && ms > nowMs) return now;
  return new Date(ms).toISOString();
}

export type ProgressUpdateSpec = {
  UpdateExpression: string;
  ConditionExpression?: string;
  ExpressionAttributeNames?: Record<string, string>;
  ExpressionAttributeValues: Record<string, unknown>;
};

/**
 * Field-scoped conditional update for an interaction "touch" (book opened / chapter
 * navigated). SETs only the activity timestamps and bumps `currentChapterNumber`
 * upward — it NEVER writes `unlockedThroughChapterNumber` / `completedChapters` /
 * `bestScoreByChapter`, so it can never roll back a concurrent quiz-pass unlock.
 *
 * `nextCurrentChapterNumber` is the already-max'd cursor the caller wants. The
 * `ConditionExpression` guards the whole update so a stale cursor can't move the row
 * backward: it applies only when the stored cursor is missing or <= the new value.
 * On a lost race the caller treats the conditional failure as a benign no-op (the row
 * is already at least as advanced) — see repointProgressVersion / createProgressIfMissing
 * which swallow ConditionalCheckFailed the same way.
 */
export function buildInteractionTouchUpdate(params: {
  nextCurrentChapterNumber: number;
  lastOpenedAt: string;
  lastActiveAt: string;
  updatedAt: string;
}): ProgressUpdateSpec {
  return {
    UpdateExpression:
      "SET #current = :current, lastOpenedAt = :lastOpenedAt, " +
      "lastActiveAt = :lastActiveAt, updatedAt = :updatedAt",
    ConditionExpression:
      "attribute_not_exists(PK) OR attribute_not_exists(#current) OR #current <= :current",
    ExpressionAttributeNames: {
      // currentChapterNumber is not a reserved word, but alias it for symmetry and to
      // keep the builder robust if the attribute name ever changes.
      "#current": "currentChapterNumber",
    },
    ExpressionAttributeValues: {
      ":current": params.nextCurrentChapterNumber,
      ":lastOpenedAt": params.lastOpenedAt,
      ":lastActiveAt": params.lastActiveAt,
      ":updatedAt": params.updatedAt,
    },
  };
}

/**
 * Field-scoped conditional update for the quiz-pass progress mutation. `nextProgress`
 * is the FULL recomputed row (merged `completedChapters`, max'd cursors and per-chapter
 * best score) — but instead of overwriting the whole item we SET exactly the fields the
 * pass changes and guard the write with an optimistic `progressRev` check.
 *
 * `expectedRev` is the revision read in the same request snapshot that produced
 * `nextProgress`. The guard `attribute_not_exists(progressRev) OR progressRev = :expectedRev`
 * makes the write a no-op (ConditionalCheckFailed) if any other writer advanced the row
 * in between, so a stale full-object never clobbers a concurrent unlock. The caller
 * re-reads, recomputes nextProgress against the fresh row, and retries.
 *
 * NOTE: `completedChapters` stays a List (number[]) for backward-compat with existing
 * prod items — we do NOT switch it to a DynamoDB Set (ADD on an existing List attribute
 * is rejected, and an empty Set is forbidden per the aws.ts invariant). The merge is
 * done in-memory by buildProgressAfterQuizPass; the optimistic guard is what makes the
 * full-list SET safe under concurrency.
 */
export function buildQuizPassProgressUpdate(params: {
  nextProgress: BookUserProgress;
  expectedRev: number;
  nextRev: number;
}): ProgressUpdateSpec {
  const p = params.nextProgress;
  return {
    UpdateExpression:
      "SET #current = :current, unlockedThroughChapterNumber = :unlocked, " +
      "completedChapters = :completed, bestScoreByChapter = :bestScores, " +
      "lastOpenedAt = :lastOpenedAt, lastActiveAt = :lastActiveAt, " +
      "updatedAt = :updatedAt, progressRev = :nextRev",
    ConditionExpression:
      "attribute_not_exists(progressRev) OR progressRev = :expectedRev",
    ExpressionAttributeNames: {
      "#current": "currentChapterNumber",
    },
    ExpressionAttributeValues: {
      ":current": p.currentChapterNumber,
      ":unlocked": p.unlockedThroughChapterNumber,
      ":completed": p.completedChapters,
      ":bestScores": p.bestScoreByChapter,
      ":lastOpenedAt": p.lastOpenedAt ?? p.updatedAt,
      ":lastActiveAt": p.lastActiveAt ?? p.updatedAt,
      ":updatedAt": p.updatedAt,
      ":expectedRev": params.expectedRev,
      ":nextRev": params.nextRev,
    },
  };
}

export type QuizOutcomeCancelClass =
  // A real state change the user must refresh past: the attempt already exists
  // (index 0 guard) or the quiz-state attemptsCount guard lost (index 1).
  | "quiz_state_conflict"
  // The optimistic progress-rev guard (index 2) lost — safe to recompute + retry.
  | "progress_conflict"
  // A non-condition cancel (TransactionConflict / throttle / capacity) or any other
  // transient cause — retry the whole transaction with backoff; do NOT drop the pass.
  | "transient"
  // Not a TransactWrite cancellation at all — rethrow as-is.
  | "not_a_cancellation";

/**
 * The index of each item inside recordQuizAttemptOutcome's TransactWrite, so the
 * classifier can map an index-aligned CancellationReason to a cause. Keep in lockstep
 * with the transactItems array order in repo.ts.
 */
export const QUIZ_OUTCOME_TX_INDEX = {
  attempt: 0,
  quizState: 1,
  progress: 2,
} as const;

type CancellationReason = { Code?: string };

function cancellationReasons(error: unknown): CancellationReason[] | null {
  if (!error || typeof error !== "object") return null;
  const rec = error as Record<string, unknown>;
  const isCancel =
    rec.name === "TransactionCanceledException" ||
    rec.__type === "TransactionCanceledException";
  if (!isCancel) return null;
  const reasons = rec.CancellationReasons;
  return Array.isArray(reasons) ? (reasons as CancellationReason[]) : [];
}

/**
 * Reason-aware classification of a failed quiz-outcome TransactWrite. Replaces the old
 * "any TransactionCanceledException → quiz_state_conflict" catch, which silently turned
 * a transient TransactionConflict / throttle into a permanent "Quiz state changed.
 * Refresh and try again." — dropping a PASSED quiz (no completion, no unlock, no IP).
 *
 * - A plain ConditionalCheckFailedException (single-item, e.g. attempt-already-exists
 *   surfaced outside a transaction) → quiz_state_conflict.
 * - A TransactionCanceledException: inspect the index-aligned CancellationReasons.
 *   Only the attempt (0) or quiz-state attemptsCount (1) guard failing is a real
 *   state conflict; the progress-rev guard (2) failing is a recompute+retry; any
 *   other ConditionalCheckFailed or a non-condition Code (TransactionConflict,
 *   ThrottlingError, ProvisionedThroughputExceeded, ...) is transient.
 */
export function classifyQuizOutcomeCancellation(error: unknown): QuizOutcomeCancelClass {
  if (error && typeof error === "object") {
    const rec = error as Record<string, unknown>;
    if (
      rec.name === "ConditionalCheckFailedException" ||
      rec.__type === "ConditionalCheckFailedException"
    ) {
      return "quiz_state_conflict";
    }
  }

  const reasons = cancellationReasons(error);
  if (reasons === null) return "not_a_cancellation";

  const failedAt = (index: number): boolean =>
    reasons[index]?.Code === "ConditionalCheckFailed";

  if (failedAt(QUIZ_OUTCOME_TX_INDEX.attempt)) return "quiz_state_conflict";
  if (failedAt(QUIZ_OUTCOME_TX_INDEX.quizState)) return "quiz_state_conflict";
  if (failedAt(QUIZ_OUTCOME_TX_INDEX.progress)) return "progress_conflict";

  // The SDK didn't populate reasons, OR the cancellation is for a non-condition cause
  // (TransactionConflict / throttle / capacity) — never silently a quiz_state_conflict.
  return "transient";
}
