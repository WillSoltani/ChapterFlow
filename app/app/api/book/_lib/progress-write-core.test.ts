// Regression coverage for the prog-write cluster (A6/A7/A8): the canonical
// BOOK_PROGRESS write path must be concurrency-safe (no full-object Put that rolls
// back a concurrent completed-chapter / unlock) and a quiz-outcome TransactWrite
// cancellation must be classified by cause (not blanket "quiz_state_conflict").
//
// repo.ts can't be imported under `tsx --test` (it constructs the AWS client at module
// load), so these exercise the pure progress-write-core seam the repo functions delegate
// to. A tiny faithful DynamoDB UpdateExpression evaluator proves the SHIPPED update +
// guard behave correctly against an in-memory item across the concurrency scenarios.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildInteractionTouchUpdate,
  buildQuizPassProgressUpdate,
  classifyQuizOutcomeCancellation,
  QUIZ_OUTCOME_TX_INDEX,
} from "./progress-write-core";
import type { BookUserProgress } from "./types";

// ── A minimal SET-only UpdateExpression + ConditionExpression applier ──
// Supports exactly the subset the builders emit: `SET a = :v, #n = :v, ...` plus the
// guards `attribute_not_exists(x)`, `x = :v`, `x <= :v`, joined by OR. Faithful enough
// to prove the live expressions do what we claim.

type Item = Record<string, unknown>;

function resolvePath(item: Item, names: Record<string, string> | undefined, token: string): unknown {
  const name = token.startsWith("#") ? (names?.[token] ?? token) : token;
  return item[name];
}

function evalGuard(
  cond: string | undefined,
  names: Record<string, string> | undefined,
  values: Record<string, unknown>,
  item: Item
): boolean {
  if (!cond) return true;
  // Only OR-joined clauses appear in these builders.
  return cond.split(" OR ").some((clauseRaw) => {
    const clause = clauseRaw.trim();
    let m = /^attribute_not_exists\(([#\w]+)\)$/.exec(clause);
    if (m) return resolvePath(item, names, m[1]) === undefined;
    m = /^([#\w]+)\s*=\s*(:[\w]+)$/.exec(clause);
    if (m) return resolvePath(item, names, m[1]) === values[m[2]];
    m = /^([#\w]+)\s*<=\s*(:[\w]+)$/.exec(clause);
    if (m) {
      const left = resolvePath(item, names, m[1]);
      const right = values[m[2]];
      if (typeof left !== "number" || typeof right !== "number") return false;
      return left <= right;
    }
    throw new Error(`unsupported guard clause: ${clause}`);
  });
}

function applySet(
  updateExpr: string,
  names: Record<string, string> | undefined,
  values: Record<string, unknown>,
  item: Item
): Item {
  const body = updateExpr.replace(/^SET\s+/, "");
  const next = { ...item };
  for (const assignRaw of body.split(",")) {
    const assign = assignRaw.trim();
    const m = /^([#\w]+)\s*=\s*(:[\w]+)$/.exec(assign);
    if (!m) throw new Error(`unsupported assignment: ${assign}`);
    const name = m[1].startsWith("#") ? (names?.[m[1]] ?? m[1]) : m[1];
    next[name] = values[m[2]];
  }
  return next;
}

/** Apply a spec like a conditional UpdateCommand. Returns the new item, or null when
 *  the ConditionExpression rejected the write (ConditionalCheckFailed). */
function applyUpdate(
  spec: {
    UpdateExpression: string;
    ConditionExpression?: string;
    ExpressionAttributeNames?: Record<string, string>;
    ExpressionAttributeValues: Record<string, unknown>;
  },
  item: Item
): Item | null {
  if (!evalGuard(spec.ConditionExpression, spec.ExpressionAttributeNames, spec.ExpressionAttributeValues, item)) {
    return null;
  }
  return applySet(spec.UpdateExpression, spec.ExpressionAttributeNames, spec.ExpressionAttributeValues, item);
}

function makeProgress(over: Partial<BookUserProgress> = {}): BookUserProgress {
  return {
    userId: "u1",
    bookId: "b1",
    pinnedBookVersion: 1,
    contentPrefix: "p",
    manifestKey: "m",
    currentChapterNumber: 1,
    unlockedThroughChapterNumber: 1,
    completedChapters: [],
    bestScoreByChapter: {},
    lastOpenedAt: "2026-01-01T00:00:00.000Z",
    lastActiveAt: "2026-01-01T00:00:00.000Z",
    progressRev: 0,
    updatedAt: "2026-01-01T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

// ── A7: the interaction touch never writes the gating fields ──

test("touch update SETs only cursor/activity fields, never the gating fields", () => {
  const spec = buildInteractionTouchUpdate({
    nextCurrentChapterNumber: 2,
    lastOpenedAt: "2026-02-01T00:00:00.000Z",
    lastActiveAt: "2026-02-01T00:00:00.000Z",
    updatedAt: "2026-02-01T00:00:00.000Z",
  });
  // The gating fields must not appear in the update at all.
  assert.ok(!/unlockedThroughChapterNumber/.test(spec.UpdateExpression));
  assert.ok(!/completedChapters/.test(spec.UpdateExpression));
  assert.ok(!/bestScoreByChapter/.test(spec.UpdateExpression));
});

test("REGRESSION A7: a touch cannot roll back a concurrently-completed chapter / unlock", () => {
  // Stored row already advanced by a concurrent quiz pass: chapter 1 completed, ch2 unlocked.
  // PK is present because this is an EXISTING row (so attribute_not_exists(PK) is false).
  const stored: Item = {
    PK: "BOOKUSER#u1",
    SK: "PROGRESS#b1",
    currentChapterNumber: 2,
    unlockedThroughChapterNumber: 2,
    completedChapters: [1],
    bestScoreByChapter: { "1": 100 },
    progressRev: 1,
    lastActiveAt: "2026-01-01T00:00:00.000Z",
  };
  // A stale "touch" built from a pre-pass snapshot (cursor still 1).
  const spec = buildInteractionTouchUpdate({
    nextCurrentChapterNumber: 1,
    lastOpenedAt: "2026-03-01T00:00:00.000Z",
    lastActiveAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-03-01T00:00:00.000Z",
  });
  const after = applyUpdate(spec, stored);
  // Whatever happens, the gating fields are preserved (the old full-Put would have
  // reset completedChapters → [] and unlocked → 1, re-locking the chapter).
  const result = after ?? stored;
  assert.deepEqual(result.completedChapters, [1]);
  assert.equal(result.unlockedThroughChapterNumber, 2);
  assert.deepEqual(result.bestScoreByChapter, { "1": 100 });
  // The cursor max-guard never moves it backward either.
  assert.equal((result.currentChapterNumber as number) >= 2, true);
});

test("touch update advances the cursor and timestamps when not behind", () => {
  const stored: Item = {
    currentChapterNumber: 1,
    unlockedThroughChapterNumber: 3,
    completedChapters: [1, 2],
    progressRev: 2,
    lastActiveAt: "2026-01-01T00:00:00.000Z",
  };
  const spec = buildInteractionTouchUpdate({
    nextCurrentChapterNumber: 2,
    lastOpenedAt: "2026-03-01T00:00:00.000Z",
    lastActiveAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-03-01T00:00:00.000Z",
  });
  const after = applyUpdate(spec, stored);
  assert.notEqual(after, null);
  assert.equal(after!.currentChapterNumber, 2);
  assert.equal(after!.lastActiveAt, "2026-03-01T00:00:00.000Z");
  // Gating fields untouched.
  assert.deepEqual(after!.completedChapters, [1, 2]);
  assert.equal(after!.unlockedThroughChapterNumber, 3);
});

// ── A6: the quiz-pass write is optimistic and can't clobber a concurrent advance ──

test("quiz-pass update applies and bumps progressRev when the rev guard matches", () => {
  const stored: Item = makeProgress({ progressRev: 3 }) as unknown as Item;
  const nextProgress = makeProgress({
    progressRev: 3,
    currentChapterNumber: 2,
    unlockedThroughChapterNumber: 2,
    completedChapters: [1],
    bestScoreByChapter: { "1": 90 },
    updatedAt: "2026-04-01T00:00:00.000Z",
  });
  const spec = buildQuizPassProgressUpdate({ nextProgress, expectedRev: 3, nextRev: 4 });
  const after = applyUpdate(spec, stored);
  assert.notEqual(after, null);
  assert.deepEqual(after!.completedChapters, [1]);
  assert.equal(after!.unlockedThroughChapterNumber, 2);
  assert.equal(after!.progressRev, 4); // monotonic bump
});

test("REGRESSION A6: a stale quiz-pass write is REJECTED when another writer bumped the rev", () => {
  // Concurrent writer already advanced the row: rev 3 → 4, completed [1, 2].
  const stored: Item = {
    progressRev: 4,
    currentChapterNumber: 3,
    unlockedThroughChapterNumber: 3,
    completedChapters: [1, 2],
    bestScoreByChapter: { "1": 100, "2": 100 },
  };
  // Our request built nextProgress from the rev-3 snapshot (only knows about ch1).
  const staleNext = makeProgress({
    progressRev: 3,
    currentChapterNumber: 2,
    unlockedThroughChapterNumber: 2,
    completedChapters: [1],
    bestScoreByChapter: { "1": 90 },
  });
  const spec = buildQuizPassProgressUpdate({ nextProgress: staleNext, expectedRev: 3, nextRev: 4 });
  const after = applyUpdate(spec, stored);
  // The optimistic guard rejects the stale write — the old full-Put would have OVERWRITTEN
  // the row back to completed [1], losing chapter 2.
  assert.equal(after, null, "stale quiz-pass write must be rejected, not applied");
  // The recompute-against-fresh path (rev 4) then merges ch1 into [1, 2] and succeeds.
  const merged = makeProgress({
    progressRev: 4,
    currentChapterNumber: 3,
    unlockedThroughChapterNumber: 3,
    completedChapters: [1, 2],
    bestScoreByChapter: { "1": 100, "2": 100 },
  });
  const retry = buildQuizPassProgressUpdate({ nextProgress: merged, expectedRev: 4, nextRev: 5 });
  const afterRetry = applyUpdate(retry, stored);
  assert.notEqual(afterRetry, null);
  assert.deepEqual(afterRetry!.completedChapters, [1, 2]);
  assert.equal(afterRetry!.progressRev, 5);
});

test("quiz-pass update applies on a legacy row with no progressRev attribute", () => {
  const legacy: Item = {
    currentChapterNumber: 1,
    unlockedThroughChapterNumber: 1,
    completedChapters: [],
    bestScoreByChapter: {},
    // no progressRev — attribute_not_exists(progressRev) must allow the first write.
  };
  const nextProgress = makeProgress({
    progressRev: 0,
    currentChapterNumber: 2,
    unlockedThroughChapterNumber: 2,
    completedChapters: [1],
  });
  const spec = buildQuizPassProgressUpdate({ nextProgress, expectedRev: 0, nextRev: 1 });
  const after = applyUpdate(spec, legacy);
  assert.notEqual(after, null);
  assert.equal(after!.progressRev, 1);
  assert.deepEqual(after!.completedChapters, [1]);
});

// ── A8: reason-aware cancellation classification ──

function txCancel(reasonCodes: (string | undefined)[]): unknown {
  return {
    name: "TransactionCanceledException",
    CancellationReasons: reasonCodes.map((Code) => (Code ? { Code } : { Code: "None" })),
  };
}

test("REGRESSION A8: a transient TransactionConflict is NOT a quiz_state_conflict", () => {
  // Progress item (index 2) cancelled by a concurrent write — TransactionConflict, not a
  // condition failure. The old catch mapped this to a permanent quiz_state_conflict,
  // silently dropping a PASSED quiz.
  const err = txCancel(["None", "None", "TransactionConflict"]);
  assert.equal(classifyQuizOutcomeCancellation(err), "transient");
});

test("A8: a throttle on any item is transient, never quiz_state_conflict", () => {
  assert.equal(
    classifyQuizOutcomeCancellation(txCancel(["ThrottlingError", "None", "None"])),
    "transient"
  );
  assert.equal(
    classifyQuizOutcomeCancellation(
      txCancel(["None", "ProvisionedThroughputExceeded", "None"])
    ),
    "transient"
  );
});

test("A8: the attemptsCount guard (index 1) failing IS a real quiz_state_conflict", () => {
  const err = txCancel(["None", "ConditionalCheckFailed", "None"]);
  assert.equal(classifyQuizOutcomeCancellation(err), "quiz_state_conflict");
  assert.equal(QUIZ_OUTCOME_TX_INDEX.quizState, 1);
});

test("A8: the attempt-already-exists guard (index 0) failing IS a quiz_state_conflict", () => {
  const err = txCancel(["ConditionalCheckFailed", "None", "None"]);
  assert.equal(classifyQuizOutcomeCancellation(err), "quiz_state_conflict");
});

test("A8: the progressRev guard (index 2) failing is a recompute+retry, not a conflict", () => {
  const err = txCancel(["None", "None", "ConditionalCheckFailed"]);
  assert.equal(classifyQuizOutcomeCancellation(err), "progress_conflict");
  assert.equal(QUIZ_OUTCOME_TX_INDEX.progress, 2);
});

test("A8: a plain single-item ConditionalCheckFailedException is a quiz_state_conflict", () => {
  assert.equal(
    classifyQuizOutcomeCancellation({ name: "ConditionalCheckFailedException" }),
    "quiz_state_conflict"
  );
});

test("A8: a cancellation with no reasons populated is transient (never silently a conflict)", () => {
  assert.equal(
    classifyQuizOutcomeCancellation({ name: "TransactionCanceledException" }),
    "transient"
  );
});

test("A8: a non-cancellation error is reported as not_a_cancellation (rethrown by caller)", () => {
  assert.equal(classifyQuizOutcomeCancellation(new Error("boom")), "not_a_cancellation");
  assert.equal(classifyQuizOutcomeCancellation(null), "not_a_cancellation");
  assert.equal(
    classifyQuizOutcomeCancellation({ name: "ResourceNotFoundException" }),
    "not_a_cancellation"
  );
});
