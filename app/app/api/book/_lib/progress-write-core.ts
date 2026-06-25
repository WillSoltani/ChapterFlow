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
 *  - reject anything AT-OR-BEFORE the Unix epoch (ms <= 0) — a lower floor. Without it
 *    a client could PATCH `new Date(0).toISOString()` (or an absurd negative/pre-epoch
 *    value) to write back the exact epoch sentinel and flip the "book started" badge
 *    clause (`lastOpenedAt !== epoch`) OFF for a book they have actually opened. A real
 *    `lastOpenedAt` is always well after 1970, so clamping the epoch (and below) up to
 *    `now` can't lose a legitimate value;
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
  // Lower floor: the Unix epoch (and any pre-epoch / negative value) is the "never
  // opened" sentinel that drives the "book started" badge. Treat it as invalid so a
  // client can't reset activity back to epoch and un-start a book they have read.
  if (ms <= 0) return now;
  // No future timestamps: a clock-skewed or adversarial value can't push activity
  // ahead of server time.
  if (Number.isFinite(nowMs) && ms > nowMs) return now;
  return new Date(ms).toISOString();
}

/**
 * Forward-only clamp for the user-VISIBLE cursor in the BOOK_USER_BOOK_STATE projection
 * (`currentChapterId`). The canonical BOOK_PROGRESS `currentChapterNumber` is already
 * forward-only (buildInteractionTouchUpdate); this keeps the projection — the surface the
 * reader's /state GET actually returns — consistent with it.
 *
 * THE BUG this fixes: the /state PATCH resolved `currentChapterId` only by constraining it
 * to the UNLOCKED set, then PUT the projection unconditionally. So a stale tab (or a retried
 * request) carrying an OLDER chapter could drag the reader's visible cursor BACKWARD — and
 * diverge the projection (backward) from the canonical row (forward-only).
 *
 * FIX: pick whichever of (existing projection cursor, requested cursor) maps to the HIGHER
 * chapter number — never regress. `numberOf` maps a chapterId to its 1-based chapter number
 * on the reader's pinned manifest (unknown ids resolve to -Infinity so they lose to any real
 * id; a candidate that maps to nothing falls back to `existing`, then to `candidate`).
 *
 * Returns the chapterId the projection should store.
 */
export function clampCursorForward(params: {
  candidate: string;
  existing: string | undefined;
  numberOf: (chapterId: string) => number | undefined;
}): string {
  const rank = (chapterId: string | undefined): number => {
    if (!chapterId) return Number.NEGATIVE_INFINITY;
    const n = params.numberOf(chapterId);
    return typeof n === "number" && Number.isFinite(n)
      ? n
      : Number.NEGATIVE_INFINITY;
  };
  const candidateRank = rank(params.candidate);
  const existingRank = rank(params.existing);
  // Only keep `existing` when it is a KNOWN, strictly-more-advanced cursor. If neither
  // resolves to a real number (both -Infinity), fall through to the candidate so we never
  // return an empty/garbage existing value over a concrete candidate.
  if (params.existing && existingRank > candidateRank) {
    return params.existing;
  }
  return params.candidate;
}

export type ProgressUpdateSpec = {
  UpdateExpression: string;
  ConditionExpression?: string;
  ExpressionAttributeNames?: Record<string, string>;
  ExpressionAttributeValues: Record<string, unknown>;
};

/**
 * Field-scoped conditional updates for an interaction "touch" (book opened / chapter
 * navigated). It NEVER writes `unlockedThroughChapterNumber` / `completedChapters` /
 * `bestScoreByChapter`, so it can never roll back a concurrent quiz-pass unlock.
 *
 * THE BUG this shape fixes: a single combined update SETs the activity timestamps AND the
 * cursor under ONE `#current <= :current` ConditionExpression. That guard gates the WHOLE
 * write, so when a touch LOSES the cursor race (the stored cursor is already ahead — e.g. a
 * concurrent quiz pass advanced it, or a stale heartbeat arrives) the ConditionalCheckFailed
 * threw away `lastOpenedAt` / `lastActiveAt` / `updatedAt` too — silently dropping activity
 * timestamps that streaks / goals / heatmap / recency all depend on.
 *
 * FIX: return TWO independent specs so the two concerns are decoupled:
 *  - `timestamps` — UNCONDITIONAL activity write (guarded only by `attribute_exists(PK)` so
 *    it can never CREATE a malformed partial row). ALWAYS lands, race or no race.
 *  - `cursor` — forward-only `currentChapterNumber` advance, guarded by
 *    `attribute_not_exists(#current) OR #current <= :current`. On a lost race the caller
 *    swallows its ConditionalCheckFailed as a benign no-op (the row is already at least as
 *    advanced) — mirroring repointProgressVersion / createProgressIfMissing. The timestamps
 *    write is INDEPENDENT of this, so the cursor losing the race no longer costs activity.
 *
 * Both carry `attribute_exists(PK)` so neither can resurrect/upsert a deleted-or-never-
 * created PROGRESS row (which would lack entity / pinnedBookVersion / manifestKey).
 */
export function buildInteractionTouchUpdate(params: {
  nextCurrentChapterNumber: number;
  lastOpenedAt: string;
  lastActiveAt: string;
  updatedAt: string;
}): { timestamps: ProgressUpdateSpec; cursor: ProgressUpdateSpec } {
  return {
    timestamps: {
      UpdateExpression:
        "SET lastOpenedAt = :lastOpenedAt, lastActiveAt = :lastActiveAt, updatedAt = :updatedAt",
      ConditionExpression: "attribute_exists(PK)",
      ExpressionAttributeValues: {
        ":lastOpenedAt": params.lastOpenedAt,
        ":lastActiveAt": params.lastActiveAt,
        ":updatedAt": params.updatedAt,
      },
    },
    cursor: {
      UpdateExpression: "SET #current = :current",
      ConditionExpression:
        "attribute_exists(PK) AND (attribute_not_exists(#current) OR #current <= :current)",
      ExpressionAttributeNames: {
        // currentChapterNumber is not a reserved word, but alias it for symmetry and to
        // keep the builder robust if the attribute name ever changes.
        "#current": "currentChapterNumber",
      },
      ExpressionAttributeValues: {
        ":current": params.nextCurrentChapterNumber,
      },
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
 * `nextProgress`. The guard is
 * `attribute_exists(PK) AND (attribute_not_exists(progressRev) OR progressRev = :expectedRev)`:
 *  - `attribute_exists(PK)` makes this an UPDATE-ONLY write — it can never CREATE a new
 *    PROGRESS#<bookId> row. A bare Update would upsert, and an upsert here writes only the
 *    gating/activity fields the SET clause names, producing a MALFORMED partial row with no
 *    `entity` discriminator / `pinnedBookVersion` / `manifestKey` / `contentPrefix`. The row
 *    is guaranteed to exist (ensureUserBookStarted creates it before any quiz submit); if it
 *    is somehow absent the tx must FAIL (→ classified `progress_conflict`, re-read + retry,
 *    then surface a retriable error) rather than silently birth a broken item.
 *  - the rev clause makes the write a no-op (ConditionalCheckFailed) if any other writer
 *    advanced the row in between, so a stale full-object never clobbers a concurrent unlock.
 *    The caller re-reads, recomputes nextProgress against the fresh row, and retries.
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
      "attribute_exists(PK) AND (attribute_not_exists(progressRev) OR progressRev = :expectedRev)",
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

/**
 * Pure decision for the `progress_conflict` retry branch of recordQuizAttemptOutcome.
 *
 * When the quiz-pass progress Update loses its optimistic guard (another writer advanced
 * the row, OR the `attribute_exists(PK)` guard failed because the row is absent), the
 * caller re-reads the committed row (strongly-consistent — see the `consistentRead` flag
 * the repo passes) and asks this function what to do next:
 *
 *  - `give_up_503` — out of attempts: surface a retriable 503 (NEVER drop the pass, NEVER
 *    write the stale snapshot).
 *  - `recompute` — the fresh row exists: recompute the merge against `freshRev` and retry.
 *  - `backoff_retry` — the fresh row is genuinely ABSENT (erasure racing the submit, or it
 *    never existed): do NOT re-write the stale `nextProgress` at expectedRev=0 (that is the
 *    bug — it re-lowers gating fields under a rev-0 guard). Back off and re-read on the next
 *    iteration; if the budget is nearly exhausted, give up with a 503.
 *
 * `attemptNo` is 0-based; `maxAttempts` is the total budget.
 */
export type ProgressConflictDecision =
  | { action: "give_up_503" }
  | { action: "recompute"; freshRev: number }
  | { action: "backoff_retry" };

export function resolveProgressConflictRetry(params: {
  attemptNo: number;
  maxAttempts: number;
  hasNextProgress: boolean;
  freshProgressRev: number | null; // null === the re-read returned no row
}): ProgressConflictDecision {
  const isLastAttempt = params.attemptNo === params.maxAttempts - 1;
  if (isLastAttempt || !params.hasNextProgress) {
    return { action: "give_up_503" };
  }
  if (params.freshProgressRev === null) {
    // Row absent: retryable, but bail before burning the final attempt on a re-read that
    // would just fail again. NEVER fall through to a stale rev-0 write.
    if (params.attemptNo >= params.maxAttempts - 2) {
      return { action: "give_up_503" };
    }
    return { action: "backoff_retry" };
  }
  return { action: "recompute", freshRev: params.freshProgressRev };
}

/**
 * Pure decision for the per-book progress RESET (state/reset route): given the
 * `{ deleted, unprocessed }` outcome of resetUserBookLearningState's BatchWrite sweep,
 * decide whether the reset can report success.
 *
 * A throttled BatchWrite can leave `unprocessed > 0` after its bounded retry budget. If
 * ANY QUIZSTATE# / QUIZATTEMPT# row survives, the quiz-submit fallback reconstructs
 * `passed:true` from the leftovers and silently re-locks the reader at chapter 1 (the A5
 * brick) — while a naive handler returns 200. So a non-zero `unprocessed` must surface a
 * RETRYABLE failure rather than a false success. The reset is idempotent, so the client
 * safely retries and the next sweep clears the stragglers.
 *
 * Returns true when the learning-state sweep fully cleared (safe to report success).
 */
export function isResetFullyCleared(outcome: { unprocessed: number }): boolean {
  return outcome.unprocessed <= 0;
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
