// This module was split out of repo.ts (WS3-004). Code moved verbatim.

import {
  GetCommand,
  PutCommand,
  TransactWriteCommand,
  type TransactWriteCommandInput,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { ddbDoc } from "@/app/app/api/_lib/aws";
import { BookApiError } from "./errors";
import { isBookCompleted } from "./book-completion-core";
import {
  bookUserPk,
  nowIso,
  progressSk,
  quizAttemptPk,
  quizAttemptSk,
  quizScopeKey,
  quizStateSk,
} from "./keys";
import type {
  BookUserEntitlement,
  BookUserProgress,
  BookUserQuizStateItem,
  QuizAttemptItem,
} from "./types";
import {
  buildInteractionTouchUpdate,
  buildQuizPassProgressUpdate,
  classifyQuizOutcomeCancellation,
  resolveProgressConflictRetry,
} from "./progress-write-core";
import {
  isConditionalCheckFailed,
  queryAllItems,
  readNum,
  readStr,
} from "./repo-shared";

function parseNumberArray(value: unknown): number[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  }
  if (value instanceof Set) {
    return Array.from(value).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  }
  return [];
}

/**
 * Persist an interaction "touch" of a started reader's progress (book opened /
 * chapter navigated / a reading-session heartbeat).
 *
 * This is a FIELD-SCOPED, CONDITIONAL update — NOT a full-object Put. It SETs only
 * the activity timestamps and bumps `currentChapterNumber` upward, and it NEVER writes
 * the gating fields (`unlockedThroughChapterNumber` / `completedChapters` /
 * `bestScoreByChapter`). The previous full-object Put re-wrote those stale, snapshot-read
 * values, so a touch racing a concurrent quiz-pass (every quiz submit calls
 * ensureUserBookStarted first) could roll back a freshly-completed chapter or unlock.
 *
 * The `currentChapterNumber` max-guard is enforced by the update's ConditionExpression;
 * a lost cursor race surfaces as ConditionalCheckFailed and is swallowed as a benign
 * no-op (the row is already at least as advanced), mirroring repointProgressVersion /
 * createProgressIfMissing. Pass `progress` as the already-touched row (the caller's
 * touchProgressForInteraction output); only its cursor + timestamps are read here.
 */
export async function upsertUserProgress(
  tableName: string,
  progress: BookUserProgress
): Promise<void> {
  const touchedAt = progress.updatedAt || nowIso();
  const { timestamps, cursor } = buildInteractionTouchUpdate({
    nextCurrentChapterNumber: progress.currentChapterNumber,
    lastOpenedAt: progress.lastOpenedAt ?? touchedAt,
    lastActiveAt: progress.lastActiveAt ?? touchedAt,
    updatedAt: touchedAt,
  });
  const Key = {
    PK: bookUserPk(progress.userId),
    SK: progressSk(progress.bookId),
  };
  // Two decoupled writes (see buildInteractionTouchUpdate): the activity timestamps
  // ALWAYS land (gated only by attribute_exists(PK)); the forward-only cursor advance
  // is best-effort. A lost cursor race must NOT cost the timestamps, so they are sent
  // separately rather than under one shared ConditionExpression.
  const send = async (spec: typeof timestamps): Promise<void> => {
    try {
      await ddbDoc.send(
        new UpdateCommand({
          TableName: tableName,
          Key,
          UpdateExpression: spec.UpdateExpression,
          ConditionExpression: spec.ConditionExpression,
          ExpressionAttributeNames: spec.ExpressionAttributeNames,
          ExpressionAttributeValues: spec.ExpressionAttributeValues,
        })
      );
    } catch (error: unknown) {
      // Lost the cursor max-guard to a concurrent (more-advanced) writer, OR the row
      // was deleted between read and write (attribute_exists(PK) failed) → benign no-op.
      if (isConditionalCheckFailed(error)) return;
      throw error;
    }
  };
  await send(timestamps);
  await send(cursor);
}

export async function createProgressIfMissing(
  tableName: string,
  progress: BookUserProgress
): Promise<void> {
  try {
    await ddbDoc.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          PK: bookUserPk(progress.userId),
          SK: progressSk(progress.bookId),
          entity: "BOOK_PROGRESS",
          ...progress,
        },
        ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)",
      })
    );
  } catch (error: unknown) {
    if (isConditionalCheckFailed(error)) return;
    throw error;
  }
}

/**
 * PAR-2 — advance a started reader's pinned version fields (pinnedBookVersion,
 * contentPrefix, manifestKey) to a newer published version, leaving every other
 * progress field untouched. A field-scoped, conditional `UpdateCommand` (rather
 * than a full-item Put) guarantees this can never:
 *   - clobber a concurrent interaction write (lastOpenedAt / currentChapterNumber
 *     / a quiz outcome) — those fields are simply not in the update, and
 *   - downgrade a row another request advanced further — the
 *     `pinnedBookVersion = :expected` guard makes a stale upgrade a no-op.
 * This is sound ONLY because the caller upgrades exclusively under the
 * prefix-identity gate (see version-upgrade-core.ts), where the chapter-number
 * remap is the identity and no progress number changes. If that gate is ever
 * relaxed to renumber chapters, this must become a full-row write.
 *
 * Returns true when applied, false when the guard no longer holds (already
 * advanced / changed concurrently). Throws on unexpected DDB errors so the
 * caller's fail-safe can keep the reader on their existing content.
 */
export async function repointProgressVersion(
  tableName: string,
  params: {
    userId: string;
    bookId: string;
    expectedPinnedVersion: number;
    pinnedBookVersion: number;
    contentPrefix: string;
    manifestKey: string;
    updatedAt: string;
  }
): Promise<boolean> {
  try {
    await ddbDoc.send(
      new UpdateCommand({
        TableName: tableName,
        Key: {
          PK: bookUserPk(params.userId),
          SK: progressSk(params.bookId),
        },
        UpdateExpression:
          "SET pinnedBookVersion = :version, contentPrefix = :prefix, manifestKey = :manifestKey, updatedAt = :updatedAt",
        ConditionExpression: "attribute_exists(PK) AND pinnedBookVersion = :expected",
        ExpressionAttributeValues: {
          ":version": params.pinnedBookVersion,
          ":prefix": params.contentPrefix,
          ":manifestKey": params.manifestKey,
          ":updatedAt": params.updatedAt,
          ":expected": params.expectedPinnedVersion,
        },
      })
    );
    return true;
  } catch (error: unknown) {
    if (isConditionalCheckFailed(error)) return false;
    throw error;
  }
}

export async function getUserProgress(
  tableName: string,
  userId: string,
  bookId: string,
  options?: { consistentRead?: boolean }
): Promise<BookUserProgress | null> {
  const res = await ddbDoc.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        PK: bookUserPk(userId),
        SK: progressSk(bookId),
      },
      // Default stays eventually-consistent (every existing caller). The post-create
      // re-read in ensureUserBookStarted opts into a strongly-consistent read so a
      // just-written BOOK_PROGRESS row is guaranteed visible (A10 init-500 race).
      ConsistentRead: options?.consistentRead === true ? true : undefined,
    })
  );
  const item = res.Item;
  if (!item) return null;
  return {
    userId,
    bookId,
    pinnedBookVersion: readNum(item.pinnedBookVersion) ?? 1,
    contentPrefix: readStr(item.contentPrefix) || "",
    manifestKey: readStr(item.manifestKey) || "",
    currentChapterNumber: readNum(item.currentChapterNumber) ?? 1,
    unlockedThroughChapterNumber: readNum(item.unlockedThroughChapterNumber) ?? 1,
    completedChapters: parseNumberArray(item.completedChapters),
    bestScoreByChapter:
      typeof item.bestScoreByChapter === "object" && item.bestScoreByChapter !== null
        ? (item.bestScoreByChapter as Record<string, number>)
        : {},
    lastOpenedAt: readStr(item.lastOpenedAt),
    lastActiveAt: readStr(item.lastActiveAt),
    streakDays: readNum(item.streakDays),
    preferredVariant: readStr(item.preferredVariant) as BookUserProgress["preferredVariant"],
    progressRev: readNum(item.progressRev) ?? 0,
    updatedAt: readStr(item.updatedAt) || "",
    createdAt: readStr(item.createdAt) || "",
  };
}

export async function listAllUserProgress(
  tableName: string,
  userId: string
): Promise<BookUserProgress[]> {
  const rows = await queryAllItems({
    TableName: tableName,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
    ExpressionAttributeValues: {
      ":pk": bookUserPk(userId),
      ":prefix": "PROGRESS#",
    },
    ScanIndexForward: false,
  });
  const out: BookUserProgress[] = [];
  for (const item of rows) {
    const bookId = readStr(item.bookId);
    if (!bookId) continue;
    out.push({
      userId,
      bookId,
      pinnedBookVersion: readNum(item.pinnedBookVersion) ?? 1,
      contentPrefix: readStr(item.contentPrefix) || "",
      manifestKey: readStr(item.manifestKey) || "",
      currentChapterNumber: readNum(item.currentChapterNumber) ?? 1,
      unlockedThroughChapterNumber: readNum(item.unlockedThroughChapterNumber) ?? 1,
      completedChapters: parseNumberArray(item.completedChapters),
      bestScoreByChapter:
        typeof item.bestScoreByChapter === "object" && item.bestScoreByChapter !== null
          ? (item.bestScoreByChapter as Record<string, number>)
          : {},
      lastOpenedAt: readStr(item.lastOpenedAt),
      lastActiveAt: readStr(item.lastActiveAt),
      streakDays: readNum(item.streakDays),
      preferredVariant: readStr(item.preferredVariant) as BookUserProgress["preferredVariant"],
      progressRev: readNum(item.progressRev) ?? 0,
      updatedAt: readStr(item.updatedAt) || "",
      createdAt: readStr(item.createdAt) || "",
    });
  }
  return out;
}

/**
 * Atomically record the outcome of a quiz attempt: the attempt row, the per-chapter
 * quiz-state (guarded by the attemptsCount optimistic check), and — on a pass — the
 * canonical PROGRESS#<bookId> mutation.
 *
 * Concurrency safety (prog-write cluster):
 *  - The progress mutation is an `Update` action guarded by an optimistic `progressRev`
 *    check (NOT a blind full-object Put), so a concurrent writer's completed-chapter /
 *    unlock can't be rolled back.
 *  - A failed TransactWrite is classified by its index-aligned CancellationReasons
 *    (classifyQuizOutcomeCancellation) rather than blanket-mapped to quiz_state_conflict:
 *      • attempt(0) / quiz-state(1) condition failed → real 409 quiz_state_conflict.
 *      • progress-rev(2) condition failed → re-read progress, recompute nextProgress
 *        via `recomputeNextProgress`, and retry (the pass is NOT dropped).
 *      • a transient cancel (TransactionConflict / throttle / capacity) → retry with
 *        backoff, then a retriable 503 — never a silent quiz_state_conflict.
 */
export async function recordQuizAttemptOutcome(
  tableName: string,
  params: {
    previousAttemptsCount: number;
    attempt: QuizAttemptItem;
    nextQuizState: BookUserQuizStateItem;
    nextProgress?: BookUserProgress;
    // Recompute nextProgress against a freshly-read row when the optimistic
    // progressRev guard loses a race. Defaults to keeping the originally-computed row
    // (the snapshot merge already includes this chapter), which is still correct but a
    // recompute keeps a concurrent writer's other completed chapters.
    recomputeNextProgress?: (freshProgress: BookUserProgress) => BookUserProgress;
  }
): Promise<void> {
  const MAX_ATTEMPTS = 4;
  // `expectedRev` for the progress guard is the rev carried by the row the caller built
  // nextProgress from (0 for legacy rows that never had one).
  let expectedRev = params.nextProgress?.progressRev ?? 0;
  let nextProgress = params.nextProgress;

  for (let attemptNo = 0; attemptNo < MAX_ATTEMPTS; attemptNo += 1) {
    const transactItems: NonNullable<TransactWriteCommandInput["TransactItems"]> = [
      {
        Put: {
          TableName: tableName,
          Item: {
            PK: quizAttemptPk(
              params.attempt.userId,
              params.attempt.bookId,
              params.attempt.chapterNumber
            ),
            SK: quizAttemptSk(params.attempt.createdAt),
            entity: "BOOK_QUIZ_ATTEMPT",
            quizScope: quizScopeKey(params.attempt.bookId, params.attempt.chapterNumber),
            ...params.attempt,
          },
          ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)",
        },
      },
      {
        Put: {
          TableName: tableName,
          Item: {
            PK: bookUserPk(params.nextQuizState.userId),
            SK: quizStateSk(
              params.nextQuizState.bookId,
              params.nextQuizState.chapterNumber
            ),
            entity: "BOOK_USER_QUIZ_STATE",
            ...params.nextQuizState,
          },
          ConditionExpression:
            "attribute_not_exists(PK) OR attribute_not_exists(attemptsCount) OR attemptsCount = :previousAttemptsCount",
          ExpressionAttributeValues: {
            ":previousAttemptsCount": params.previousAttemptsCount,
          },
        },
      },
    ];

    if (nextProgress) {
      const spec = buildQuizPassProgressUpdate({
        nextProgress,
        expectedRev,
        nextRev: expectedRev + 1,
      });
      // Index 2 in transactItems — must match QUIZ_OUTCOME_TX_INDEX.progress.
      transactItems.push({
        Update: {
          TableName: tableName,
          Key: {
            PK: bookUserPk(nextProgress.userId),
            SK: progressSk(nextProgress.bookId),
          },
          UpdateExpression: spec.UpdateExpression,
          ConditionExpression: spec.ConditionExpression,
          ExpressionAttributeNames: spec.ExpressionAttributeNames,
          ExpressionAttributeValues: spec.ExpressionAttributeValues,
        },
      });
    }

    try {
      await ddbDoc.send(new TransactWriteCommand({ TransactItems: transactItems }));
      return;
    } catch (error: unknown) {
      const klass = classifyQuizOutcomeCancellation(error);

      if (klass === "quiz_state_conflict") {
        throw new BookApiError(
          409,
          "quiz_state_conflict",
          "Quiz state changed. Refresh and try again."
        );
      }

      const isLastAttempt = attemptNo === MAX_ATTEMPTS - 1;
      const contended503 = (): BookApiError =>
        new BookApiError(
          503,
          "progress_write_contended",
          "Saving your progress hit heavy contention. Please try again."
        );

      if (klass === "progress_conflict") {
        // The optimistic progressRev guard lost (another writer advanced the row), OR the
        // attribute_exists(PK) guard failed (the row is absent). Either way: re-read the
        // committed row, recompute the merge against it, and retry — never drop this pass
        // nor clobber the concurrent writer's chapters.
        if (isLastAttempt || !nextProgress) {
          throw contended503();
        }
        // Strongly-consistent re-read: the eventually-consistent default could still
        // observe the PRE-conflict snapshot, so the recompute would carry the SAME stale
        // expectedRev and the retry would just lose the guard again — spinning until the
        // attempt budget is exhausted and 503-ing a quiz that actually passed. Mirrors the
        // ensureUserBookStarted A10 init re-read.
        const fresh = await getUserProgress(
          tableName,
          nextProgress.userId,
          nextProgress.bookId,
          { consistentRead: true }
        );
        // Pure decision (resolveProgressConflictRetry): a null re-read is treated as
        // RETRYABLE (back off + re-read) — it must NEVER fall through to re-write the
        // stale snapshot at expectedRev=0, which would re-lower gating fields.
        const decision = resolveProgressConflictRetry({
          attemptNo,
          maxAttempts: MAX_ATTEMPTS,
          hasNextProgress: true,
          freshProgressRev: fresh ? (fresh.progressRev ?? 0) : null,
        });
        if (decision.action === "give_up_503") {
          throw contended503();
        }
        if (decision.action === "backoff_retry") {
          await new Promise((resolve) => setTimeout(resolve, 25 * (attemptNo + 1)));
          continue;
        }
        // recompute against the fresh row.
        expectedRev = decision.freshRev;
        nextProgress = params.recomputeNextProgress
          ? params.recomputeNextProgress(fresh!)
          : { ...nextProgress, progressRev: expectedRev };
        continue;
      }

      if (klass === "transient") {
        if (isLastAttempt) {
          throw new BookApiError(
            503,
            "quiz_write_contended",
            "Saving your quiz result hit heavy contention. Please try again."
          );
        }
        await new Promise((resolve) => setTimeout(resolve, 25 * (attemptNo + 1)));
        continue;
      }

      // not_a_cancellation → an unexpected error: rethrow as-is.
      throw error;
    }
  }
}

export function summarizeProgress(
  entries: BookUserProgress[],
  ent: BookUserEntitlement | null,
  // Per-book total chapter count, keyed by bookId — supply each user's PINNED
  // version's chapterCount (see /me/progress route). "Completed" then means every
  // chapter is done (completedChapters.length >= chapterCount), which is exact and
  // handles out-of-order completion. When a book's count is missing (omitted, or a
  // transient manifest-read failure) it is NOT counted as completed — see
  // isBookCompleted: there is no correct count-free completion heuristic.
  chapterCounts?: Map<string, number> | Record<string, number>
): {
  booksStarted: number;
  booksCompleted: number;
  chaptersCompleted: number;
  averageBestScore: number;
  plan: "FREE" | "PRO";
  freeBookSlots: number;
  unlockedBooksCount: number;
} {
  const chapterCountFor = (bookId: string): number | undefined => {
    if (!chapterCounts) return undefined;
    const raw =
      chapterCounts instanceof Map ? chapterCounts.get(bookId) : chapterCounts[bookId];
    return typeof raw === "number" && Number.isFinite(raw) && raw > 0 ? raw : undefined;
  };

  const booksStarted = entries.length;
  let booksCompleted = 0;
  let chaptersCompleted = 0;
  const scores: number[] = [];

  for (const p of entries) {
    chaptersCompleted += p.completedChapters.length;
    const totalChapters = chapterCountFor(p.bookId);
    // Completion is decided by the pure core: exact when the (pinned) chapter
    // count is known, and conservatively `false` when it isn't — the old
    // count-free heuristic could never credit a sequentially-finished book
    // because `buildProgressAfterQuizPass` always advances currentChapterNumber
    // past completedChapters.length. See book-completion-core.ts / isBookCompleted.
    if (isBookCompleted(p, totalChapters)) {
      booksCompleted += 1;
    }
    for (const value of Object.values(p.bestScoreByChapter)) {
      if (typeof value === "number" && Number.isFinite(value)) scores.push(value);
    }
  }

  const averageBestScore =
    scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

  return {
    booksStarted,
    booksCompleted,
    chaptersCompleted,
    averageBestScore,
    plan: ent?.plan ?? "FREE",
    freeBookSlots: ent?.freeBookSlots ?? 2,
    unlockedBooksCount: ent?.unlockedBookIds.length ?? 0,
  };
}

/**
 * Reset the canonical gating entitlement (BOOK_PROGRESS row) back to chapter
 * 1, conditioned on the row still existing. Moved verbatim from
 * me/books/[bookId]/state/reset/route.ts (WS3-002). Returns true when the
 * reset was applied, false when the row vanished between the caller's read
 * and this write (e.g. a racing account erasure) — the caller must not
 * resurrect it or write the denormalised projection in that case.
 */
export async function resetProgressGating(
  tableName: string,
  userId: string,
  bookId: string,
  now: string
): Promise<boolean> {
  try {
    await ddbDoc.send(
      new UpdateCommand({
        TableName: tableName,
        Key: { PK: bookUserPk(userId), SK: progressSk(bookId) },
        ConditionExpression: "attribute_exists(SK)",
        // Bump progressRev as part of the reset. The quiz-pass write is guarded by an
        // optimistic `progressRev = :expectedRev` check (buildQuizPassProgressUpdate);
        // incrementing it here CANCELS any concurrently in-flight quiz-pass that read
        // the pre-reset rev, so it can't commit a completion on top of the just-reset
        // row using its stale snapshot. (if_not_exists covers legacy rows with no rev.)
        UpdateExpression:
          "SET currentChapterNumber = :one, unlockedThroughChapterNumber = :one, completedChapters = :empty, bestScoreByChapter = :emptyMap, lastOpenedAt = :now, lastActiveAt = :now, updatedAt = :now, progressRev = if_not_exists(progressRev, :zero) + :one",
        ExpressionAttributeValues: {
          ":one": 1,
          ":zero": 0,
          ":empty": [] as number[],
          ":emptyMap": {} as Record<string, number>,
          ":now": now,
        },
      })
    );
    return true;
  } catch (error: unknown) {
    const name =
      error && typeof error === "object"
        ? (error as Record<string, unknown>).name ??
          (error as Record<string, unknown>).__type
        : undefined;
    if (name === "ConditionalCheckFailedException") {
      // The entitlement row vanished between read and write — do not resurrect it.
      return false;
    }
    throw error;
  }
}

/**
 * Apply one field-scoped conditional Update to the BOOK_PROGRESS row's cursor
 * / activity-timestamp fields (a `buildInteractionTouchUpdate` spec half —
 * either the `timestamps` or the `cursor` half). Moved verbatim from the
 * `sync` closure in me/books/[bookId]/state/route.ts's PATCH handler
 * (WS3-002): a `ConditionalCheckFailedException` (the row vanished, or the
 * cursor's forward-only guard lost a race) is swallowed as a benign no-op;
 * any other error is rethrown.
 */
export async function applyProgressCursorTouch(
  tableName: string,
  userId: string,
  bookId: string,
  spec: {
    UpdateExpression: string;
    ConditionExpression?: string;
    ExpressionAttributeNames?: Record<string, string>;
    ExpressionAttributeValues?: Record<string, unknown>;
  }
): Promise<void> {
  try {
    await ddbDoc.send(
      new UpdateCommand({
        TableName: tableName,
        Key: { PK: bookUserPk(userId), SK: progressSk(bookId) },
        UpdateExpression: spec.UpdateExpression,
        ConditionExpression: spec.ConditionExpression,
        ExpressionAttributeNames: spec.ExpressionAttributeNames,
        ExpressionAttributeValues: spec.ExpressionAttributeValues,
      })
    );
  } catch (error: unknown) {
    const name =
      error && typeof error === "object"
        ? (error as Record<string, unknown>).name ??
          (error as Record<string, unknown>).__type
        : undefined;
    if (name !== "ConditionalCheckFailedException") {
      throw error;
    }
  }
}
