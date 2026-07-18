// This module was split out of repo.ts (WS3-004). Code moved verbatim.

import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddbDoc } from "@/app/app/api/_lib/aws";
import { batchDeleteKeys } from "./ddb-batch-delete";
import {
  bookUserPk,
  loopSkPrefix,
  quizAttemptPkFromQuizStateSk,
  quizStateSk,
  quizStateSkPrefix,
} from "./keys";
import {
  queryAllItems,
  readStr,
} from "./repo-shared";

/**
 * Mark a quiz state's loop pipeline as fully completed. Used by the quiz
 * submit route after streak/tier/achievement/spark all run cleanly. The
 * absence of this field on a `passed: true` record means the pipeline
 * either crashed mid-flight or had a partial failure and should be retried.
 */
export async function markLoopPipelineCompleted(
  tableName: string,
  userId: string,
  bookId: string,
  chapterNumber: number,
  completedAt: string
): Promise<void> {
  await ddbDoc.send(
    new UpdateCommand({
      TableName: tableName,
      Key: {
        PK: bookUserPk(userId),
        SK: quizStateSk(bookId, chapterNumber),
      },
      UpdateExpression:
        "SET loopPipelineCompletedAt = :ts, updatedAt = :ts",
      ConditionExpression: "attribute_exists(PK)",
      ExpressionAttributeValues: {
        ":ts": completedAt,
      },
    })
  );
}

/**
 * Clear ALL per-chapter learning state for one book under a user, across THREE
 * key spaces:
 *   - `BOOK_USER_QUIZ_STATE` (`QUIZSTATE#<bookId>#…`) — user partition
 *   - `BOOK_USER_LOOP`       (`LOOP#<bookId>#…`)      — user partition
 *   - `BOOK_QUIZ_ATTEMPT`    (`QUIZATTEMPT#<userId>#<bookId>#<ch>`) — its OWN
 *     per-chapter partition, NOT under the user partition.
 *
 * The per-book progress reset (state/reset/route.ts) rewinds the canonical
 * `BOOK_PROGRESS` gating entitlement to chapter 1, but the quiz-submit route
 * reconstructs the chapter's quiz state as
 * `persistedQuizState ?? buildQuizStateFromAttempts({ attempts })` and then
 * short-circuits on `quizState?.passed` BEFORE the only code path that raises
 * `unlockedThroughChapterNumber` (`buildProgressAfterQuizPass`). So clearing
 * only the QUIZSTATE# row is NOT enough: with the row gone, the fallback rebuilds
 * `passed:true` from the SURVIVING QUIZATTEMPT# rows (an old passing attempt),
 * the short-circuit fires, and the reader stays permanently locked at chapter 1.
 * We must also delete the attempt partitions so the fallback has nothing to
 * reconstruct a stale pass from — the next submit is then a genuine fresh attempt.
 *
 * The submit route writes a quiz-state row alongside every recorded attempt, so
 * the QUIZSTATE# SKs we already query enumerate exactly the chapters that have an
 * attempt partition; we rebuild each `quizAttemptPk` from them
 * (`quizAttemptPkFromQuizStateSk`) and query+delete those partitions too.
 *
 * Idempotent: deleting an absent key is a no-op, so a retry (or a never-started
 * book) is safe. Returns the count actually deleted and the count that survived
 * all BatchWrite retries (callers should surface a non-zero `unprocessed`).
 */
export async function resetUserBookLearningState(
  tableName: string,
  userId: string,
  bookId: string
): Promise<{ deleted: number; unprocessed: number }> {
  const pk = bookUserPk(userId);
  // Two separate begins_with Queries, not one OR'd condition: a DynamoDB
  // KeyConditionExpression permits only a SINGLE sort-key condition, and the
  // QUIZSTATE# / LOOP# prefixes are disjoint ranges anyway. Each is a tight
  // range scan over the user's own partition.
  const [quizRows, loopRows] = await Promise.all([
    queryAllItems({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: { ":pk": pk, ":prefix": quizStateSkPrefix(bookId) },
    }),
    queryAllItems({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: { ":pk": pk, ":prefix": loopSkPrefix(bookId) },
    }),
  ]);

  const keys: { PK: string; SK: string }[] = [];
  for (const item of [...quizRows, ...loopRows]) {
    const sk = readStr(item.SK);
    if (sk) keys.push({ PK: pk, SK: sk });
  }

  // Derive the quiz-ATTEMPT partitions to clear from the quiz-state SKs (one per
  // chapter that has any attempt). Each lives in its own partition, so we Query
  // each one for its full key set and add those (PK, SK) pairs to the same
  // BatchWrite delete. Without this the reset leaves passing attempts behind and
  // the submit fallback reconstructs passed:true — A5's root cause.
  const attemptPks = new Set<string>();
  for (const item of quizRows) {
    const sk = readStr(item.SK);
    if (!sk) continue;
    const attemptPk = quizAttemptPkFromQuizStateSk(userId, sk);
    if (attemptPk) attemptPks.add(attemptPk);
  }
  if (attemptPks.size) {
    const attemptRowGroups = await Promise.all(
      [...attemptPks].map((attemptPk) =>
        queryAllItems({
          TableName: tableName,
          KeyConditionExpression: "PK = :pk",
          ExpressionAttributeValues: { ":pk": attemptPk },
          // These rows are read ONLY to delete them, so project just the key
          // attributes the BatchWrite needs — never the heavy BOOK_QUIZ_ATTEMPT
          // graded-response bodies. PK/SK aren't reserved words, so no aliasing.
          ProjectionExpression: "PK, SK",
        })
      )
    );
    for (const rows of attemptRowGroups) {
      for (const item of rows) {
        const itemPk = readStr(item.PK);
        const sk = readStr(item.SK);
        if (itemPk && sk) keys.push({ PK: itemPk, SK: sk });
      }
    }
  }

  // Chunk-and-retry BatchWrite delete (shared with account erasure). Preserves
  // the { deleted, unprocessed } shape the reset route relies on to detect a
  // partial sweep (isResetFullyCleared → retryable 503).
  return batchDeleteKeys(tableName, keys);
}
