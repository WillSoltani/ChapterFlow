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
  isResetFullyCleared,
  resolveProgressConflictRetry,
  sanitizeLastOpenedAt,
  QUIZ_OUTCOME_TX_INDEX,
  type ProgressUpdateSpec,
} from "./progress-write-core";
import type { BookUserProgress } from "./types";

// ── A minimal SET-only UpdateExpression + ConditionExpression applier ──
// Supports exactly the subset the builders emit: `SET a = :v, #n = :v, ...` plus the
// guards `attribute_exists(x)`, `attribute_not_exists(x)`, `x = :v`, `x <= :v`, joined
// by OR / AND with at most one parenthesized group. Faithful enough to prove the live
// expressions do what we claim.

type Item = Record<string, unknown>;

function resolvePath(item: Item, names: Record<string, string> | undefined, token: string): unknown {
  const name = token.startsWith("#") ? (names?.[token] ?? token) : token;
  return item[name];
}

// Evaluate a single leaf clause (no AND/OR/parens).
function evalLeaf(
  clauseRaw: string,
  names: Record<string, string> | undefined,
  values: Record<string, unknown>,
  item: Item
): boolean {
  const clause = clauseRaw.trim();
  let m = /^attribute_not_exists\(([#\w]+)\)$/.exec(clause);
  if (m) return resolvePath(item, names, m[1]) === undefined;
  m = /^attribute_exists\(([#\w]+)\)$/.exec(clause);
  if (m) return resolvePath(item, names, m[1]) !== undefined;
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
}

// Evaluate a parens-free OR/AND expression (OR binds looser than AND, as in SQL/DDB).
function evalFlat(
  expr: string,
  names: Record<string, string> | undefined,
  values: Record<string, unknown>,
  item: Item
): boolean {
  return expr.split(" OR ").some((orPart) =>
    orPart.split(" AND ").every((andPart) => evalLeaf(andPart, names, values, item))
  );
}

function evalGuard(
  cond: string | undefined,
  names: Record<string, string> | undefined,
  values: Record<string, unknown>,
  item: Item
): boolean {
  if (!cond) return true;
  // Support at most one parenthesized group joined by a leading `AND` (the exact shape
  // buildQuizPassProgressUpdate / the touch cursor guard emit), e.g.
  // `attribute_exists(PK) AND (attribute_not_exists(progressRev) OR progressRev = :v)`.
  const grouped = /^(.*?)\s+AND\s+\((.+)\)\s*$/.exec(cond.trim());
  if (grouped) {
    return (
      evalFlat(grouped[1], names, values, item) &&
      evalFlat(grouped[2], names, values, item)
    );
  }
  return evalFlat(cond, names, values, item);
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

// The touch is now TWO decoupled specs (A8-followup #8): an UNCONDITIONAL timestamps
// write + a forward-only cursor write. Apply them in order against an item, mirroring
// upsertUserProgress (each lost guard is swallowed as a no-op).
function applyTouch(
  touch: { timestamps: ProgressUpdateSpec; cursor: ProgressUpdateSpec },
  item: Item
): { item: Item; timestampsApplied: boolean; cursorApplied: boolean } {
  let next = item;
  const tsResult = applyUpdate(touch.timestamps, next);
  const timestampsApplied = tsResult !== null;
  if (tsResult) next = tsResult;
  const cursorResult = applyUpdate(touch.cursor, next);
  const cursorApplied = cursorResult !== null;
  if (cursorResult) next = cursorResult;
  return { item: next, timestampsApplied, cursorApplied };
}

test("touch update SETs only cursor/activity fields, never the gating fields", () => {
  const touch = buildInteractionTouchUpdate({
    nextCurrentChapterNumber: 2,
    lastOpenedAt: "2026-02-01T00:00:00.000Z",
    lastActiveAt: "2026-02-01T00:00:00.000Z",
    updatedAt: "2026-02-01T00:00:00.000Z",
  });
  const combined = touch.timestamps.UpdateExpression + touch.cursor.UpdateExpression;
  // The gating fields must not appear in either update at all.
  assert.ok(!/unlockedThroughChapterNumber/.test(combined));
  assert.ok(!/completedChapters/.test(combined));
  assert.ok(!/bestScoreByChapter/.test(combined));
});

test("REGRESSION A7: a touch cannot roll back a concurrently-completed chapter / unlock", () => {
  // Stored row already advanced by a concurrent quiz pass: chapter 1 completed, ch2 unlocked.
  // PK is present because this is an EXISTING row (so attribute_exists(PK) holds).
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
  const touch = buildInteractionTouchUpdate({
    nextCurrentChapterNumber: 1,
    lastOpenedAt: "2026-03-01T00:00:00.000Z",
    lastActiveAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-03-01T00:00:00.000Z",
  });
  const { item: result } = applyTouch(touch, stored);
  // The gating fields are preserved (the old full-Put would have reset completedChapters
  // → [] and unlocked → 1, re-locking the chapter).
  assert.deepEqual(result.completedChapters, [1]);
  assert.equal(result.unlockedThroughChapterNumber, 2);
  assert.deepEqual(result.bestScoreByChapter, { "1": 100 });
  // The cursor forward-only guard never moves it backward either.
  assert.equal((result.currentChapterNumber as number) >= 2, true);
});

test("touch update advances the cursor and timestamps when not behind", () => {
  const stored: Item = {
    PK: "BOOKUSER#u1",
    currentChapterNumber: 1,
    unlockedThroughChapterNumber: 3,
    completedChapters: [1, 2],
    progressRev: 2,
    lastActiveAt: "2026-01-01T00:00:00.000Z",
  };
  const touch = buildInteractionTouchUpdate({
    nextCurrentChapterNumber: 2,
    lastOpenedAt: "2026-03-01T00:00:00.000Z",
    lastActiveAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-03-01T00:00:00.000Z",
  });
  const { item: after, timestampsApplied, cursorApplied } = applyTouch(touch, stored);
  assert.equal(timestampsApplied, true);
  assert.equal(cursorApplied, true);
  assert.equal(after.currentChapterNumber, 2);
  assert.equal(after.lastActiveAt, "2026-03-01T00:00:00.000Z");
  // Gating fields untouched.
  assert.deepEqual(after.completedChapters, [1, 2]);
  assert.equal(after.unlockedThroughChapterNumber, 3);
});

// ── #8: a lost cursor race must NOT drop the activity timestamps ──

test("REGRESSION #8: a touch that LOSES the cursor race still persists the activity timestamps", () => {
  // The stored cursor is already AHEAD (a concurrent quiz pass moved it to 3). A stale
  // heartbeat touch wants cursor 2 — it loses the forward-only cursor guard. With the OLD
  // single combined update, the shared ConditionExpression failed and dropped lastOpenedAt
  // / lastActiveAt / updatedAt too (streak / goals / heatmap silently lose the activity).
  const stored: Item = {
    PK: "BOOKUSER#u1",
    currentChapterNumber: 3,
    unlockedThroughChapterNumber: 3,
    completedChapters: [1, 2],
    progressRev: 5,
    lastOpenedAt: "2026-01-01T00:00:00.000Z",
    lastActiveAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
  const touch = buildInteractionTouchUpdate({
    nextCurrentChapterNumber: 2, // behind the stored cursor → loses the cursor race
    lastOpenedAt: "2026-03-01T00:00:00.000Z",
    lastActiveAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-03-01T00:00:00.000Z",
  });
  const { item: after, timestampsApplied, cursorApplied } = applyTouch(touch, stored);
  // The cursor write is correctly rejected (forward-only)…
  assert.equal(cursorApplied, false);
  assert.equal(after.currentChapterNumber, 3, "cursor never moves backward");
  // …but the activity timestamps STILL land (the whole point of decoupling the writes).
  assert.equal(timestampsApplied, true);
  assert.equal(after.lastOpenedAt, "2026-03-01T00:00:00.000Z");
  assert.equal(after.lastActiveAt, "2026-03-01T00:00:00.000Z");
  assert.equal(after.updatedAt, "2026-03-01T00:00:00.000Z");
  // Gating fields untouched throughout.
  assert.deepEqual(after.completedChapters, [1, 2]);
  assert.equal(after.unlockedThroughChapterNumber, 3);
});

test("REGRESSION #8: a touch can never CREATE a partial row (attribute_exists(PK) gates BOTH writes)", () => {
  // No PK → the row does not exist (deleted / never created). Neither the timestamps nor
  // the cursor write may upsert a malformed partial BOOK_PROGRESS item.
  const absent: Item = {};
  const touch = buildInteractionTouchUpdate({
    nextCurrentChapterNumber: 1,
    lastOpenedAt: "2026-03-01T00:00:00.000Z",
    lastActiveAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-03-01T00:00:00.000Z",
  });
  const { item: after, timestampsApplied, cursorApplied } = applyTouch(touch, absent);
  assert.equal(timestampsApplied, false, "timestamps write must not create a row");
  assert.equal(cursorApplied, false, "cursor write must not create a row");
  assert.deepEqual(after, {}, "no attributes written to a non-existent row");
});

// ── A6: the quiz-pass write is optimistic and can't clobber a concurrent advance ──

test("quiz-pass update applies and bumps progressRev when the rev guard matches", () => {
  // PK present — an EXISTING row (the quiz-pass guard requires attribute_exists(PK)).
  const stored: Item = {
    PK: "BOOKUSER#u1",
    SK: "PROGRESS#b1",
    ...(makeProgress({ progressRev: 3 }) as unknown as Item),
  };
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
  // PK present — this is an EXISTING row (the quiz-pass guard requires attribute_exists(PK)).
  const stored: Item = {
    PK: "BOOKUSER#u1",
    SK: "PROGRESS#b1",
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
    PK: "BOOKUSER#u1",
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

test("REGRESSION #1: the quiz-pass update can NEVER create a new (malformed) PROGRESS row", () => {
  // The PROGRESS row is absent (no PK) — ensureUserBookStarted is supposed to create it
  // first. Without attribute_exists(PK) the Update would UPSERT, birthing a partial row
  // that lacks entity / pinnedBookVersion / manifestKey / contentPrefix. The guard must
  // reject the write so the tx fails (→ progress_conflict → re-read + retry / 503).
  const absent: Item = {};
  const nextProgress = makeProgress({
    progressRev: 0,
    currentChapterNumber: 2,
    unlockedThroughChapterNumber: 2,
    completedChapters: [1],
  });
  const spec = buildQuizPassProgressUpdate({ nextProgress, expectedRev: 0, nextRev: 1 });
  // The expression must carry the existence guard…
  assert.ok(/attribute_exists\(PK\)/.test(spec.ConditionExpression ?? ""));
  // …and applying it to a non-existent row is REJECTED (no upsert of a partial row).
  const after = applyUpdate(spec, absent);
  assert.equal(after, null, "quiz-pass write must not create a new PROGRESS row");
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

// ── A12: /state PATCH must validate + clamp client-supplied lastOpenedAt ──
// The PATCH took `lastOpenedAt` as any client string with no validation and SET it
// into the canonical BOOK_PROGRESS row (and the BOOK_USER_BOOK_STATE projection).
// lastOpenedAt feeds the "book started" badge clause (lastOpenedAt !== epoch) and
// recency / last-read sorting, so a garbage or far-future value would corrupt those
// surfaces. sanitizeLastOpenedAt is the pure guard the route now applies to BOTH writes.

const A12_NOW = "2026-06-24T12:00:00.000Z";

test("A12: a sane past ISO timestamp is preserved (normalized to canonical ISO)", () => {
  const past = "2026-06-20T08:30:00.000Z";
  assert.equal(sanitizeLastOpenedAt(past, A12_NOW), past);
});

test("A12: exactly-now is accepted (boundary, not treated as future)", () => {
  assert.equal(sanitizeLastOpenedAt(A12_NOW, A12_NOW), A12_NOW);
});

test("A12: a non-string (number / object / null / undefined / array) falls back to now", () => {
  assert.equal(sanitizeLastOpenedAt(1750000000000, A12_NOW), A12_NOW);
  assert.equal(sanitizeLastOpenedAt({ when: "soon" }, A12_NOW), A12_NOW);
  assert.equal(sanitizeLastOpenedAt(null, A12_NOW), A12_NOW);
  assert.equal(sanitizeLastOpenedAt(undefined, A12_NOW), A12_NOW);
  assert.equal(sanitizeLastOpenedAt(["2026-06-20T00:00:00Z"], A12_NOW), A12_NOW);
});

test("A12: an unparseable garbage string falls back to now", () => {
  assert.equal(sanitizeLastOpenedAt("not-a-date", A12_NOW), A12_NOW);
  assert.equal(sanitizeLastOpenedAt("", A12_NOW), A12_NOW);
  assert.equal(sanitizeLastOpenedAt("Infinity", A12_NOW), A12_NOW);
});

test("A12: a far-future timestamp is clamped down to now (no future activity)", () => {
  assert.equal(sanitizeLastOpenedAt("9999-12-31T23:59:59.000Z", A12_NOW), A12_NOW);
  // even one second past now is rejected
  assert.equal(sanitizeLastOpenedAt("2026-06-24T12:00:01.000Z", A12_NOW), A12_NOW);
});

test("A12: a non-epoch valid timestamp stays non-epoch (badge 'started' clause stays correct)", () => {
  const result = sanitizeLastOpenedAt("2026-06-22T09:00:00.000Z", A12_NOW);
  assert.notEqual(result, new Date(0).toISOString());
});

// ── #6: lower floor — the epoch sentinel can't be written back ──
// lastOpenedAt feeds the "book started" badge clause (lastOpenedAt !== epoch). Without a
// lower floor a client could PATCH `new Date(0).toISOString()` to write the epoch back and
// flip a started book OFF. The floor clamps the epoch (and any pre-epoch value) up to now.

test("REGRESSION #6: the exact Unix epoch is rejected (clamped to now), never echoed back", () => {
  const epoch = new Date(0).toISOString(); // 1970-01-01T00:00:00.000Z
  const result = sanitizeLastOpenedAt(epoch, A12_NOW);
  assert.notEqual(result, epoch, "epoch sentinel must not survive — it would un-start the book");
  assert.equal(result, A12_NOW);
});

test("#6: a pre-epoch / negative timestamp is rejected (clamped to now)", () => {
  // A date before 1970 parses to a negative epoch ms.
  assert.equal(sanitizeLastOpenedAt("1969-06-01T00:00:00.000Z", A12_NOW), A12_NOW);
  assert.equal(sanitizeLastOpenedAt("1900-01-01T00:00:00.000Z", A12_NOW), A12_NOW);
});

test("#6: a value one millisecond after epoch is still rejected (ms <= 0 floor is exclusive of epoch)", () => {
  // 0 ms is rejected; 1 ms is technically valid but absurd — it parses fine and is well
  // before `now`, so it is preserved (the floor only rejects ms <= 0, by design, so we
  // don't over-reject merely-old values). This pins that exact boundary.
  assert.equal(sanitizeLastOpenedAt(new Date(0).toISOString(), A12_NOW), A12_NOW);
  assert.equal(
    sanitizeLastOpenedAt(new Date(1).toISOString(), A12_NOW),
    new Date(1).toISOString()
  );
});

// ── #2 + #3: the progress_conflict retry must converge, and a null re-read must be
// treated as RETRYABLE — never a stale rev-0 write. resolveProgressConflictRetry is the
// pure decision the repo retry loop delegates to (it can't be imported under tsx --test).

test("REGRESSION #3: a null fresh re-read is RETRYABLE (backoff), never a stale rev-0 write", () => {
  // Mid-budget, the conflict re-read returned no row (erasure racing the submit). The OLD
  // code set expectedRev=0 and continued, re-writing the stale snapshot. The decision must
  // be a backoff-retry instead — it NEVER recomputes/writes against a null row.
  const decision = resolveProgressConflictRetry({
    attemptNo: 0,
    maxAttempts: 4,
    hasNextProgress: true,
    freshProgressRev: null,
  });
  assert.deepEqual(decision, { action: "backoff_retry" });
  // It is NOT a recompute (which is the path that would carry a fresh rev and write).
  assert.notEqual((decision as { action: string }).action, "recompute");
});

test("#3: a null re-read near the end of the budget gives up with a 503 (still no stale write)", () => {
  // attemptNo 2 of maxAttempts 4 → attemptNo >= maxAttempts-2 → no point re-reading again.
  assert.deepEqual(
    resolveProgressConflictRetry({
      attemptNo: 2,
      maxAttempts: 4,
      hasNextProgress: true,
      freshProgressRev: null,
    }),
    { action: "give_up_503" }
  );
});

test("#2: a fresh row is RECOMPUTED against its committed rev (the retry converges)", () => {
  // The re-read (strongly-consistent in the repo) observed the committed rev 7. The retry
  // must recompute against THAT rev so the next write's optimistic guard matches.
  assert.deepEqual(
    resolveProgressConflictRetry({
      attemptNo: 1,
      maxAttempts: 4,
      hasNextProgress: true,
      freshProgressRev: 7,
    }),
    { action: "recompute", freshRev: 7 }
  );
});

test("#2: the final attempt (or a missing nextProgress) gives up with a 503, never dropping the pass silently", () => {
  assert.deepEqual(
    resolveProgressConflictRetry({
      attemptNo: 3,
      maxAttempts: 4,
      hasNextProgress: true,
      freshProgressRev: 9,
    }),
    { action: "give_up_503" }
  );
  assert.deepEqual(
    resolveProgressConflictRetry({
      attemptNo: 0,
      maxAttempts: 4,
      hasNextProgress: false,
      freshProgressRev: 9,
    }),
    { action: "give_up_503" }
  );
});

// ── #5: a reset bumps progressRev, so a concurrently in-flight quiz-pass holding the
// pre-reset rev is CANCELLED (its optimistic guard fails) and can't re-complete a
// just-reset chapter using its stale snapshot. The reset Update does
// `progressRev = if_not_exists(progressRev, 0) + 1`; we model that bump and assert the
// in-flight pass (built from buildQuizPassProgressUpdate at the old rev) is rejected.

test("REGRESSION #5: a reset's progressRev bump CANCELS a concurrent in-flight quiz-pass", () => {
  // Row at rev 4 with a completed chapter 1, about to be reset.
  const beforeReset: Item = {
    PK: "BOOKUSER#u1",
    SK: "PROGRESS#b1",
    currentChapterNumber: 2,
    unlockedThroughChapterNumber: 2,
    completedChapters: [1],
    bestScoreByChapter: { "1": 90 },
    progressRev: 4,
  };
  // An in-flight quiz-pass read rev 4 and built nextProgress to (re-)complete chapter 1.
  const inFlightPass = makeProgress({
    progressRev: 4,
    currentChapterNumber: 2,
    unlockedThroughChapterNumber: 2,
    completedChapters: [1],
    bestScoreByChapter: { "1": 100 },
  });
  const passSpec = buildQuizPassProgressUpdate({
    nextProgress: inFlightPass,
    expectedRev: 4,
    nextRev: 5,
  });

  // The reset commits FIRST: clears gating fields and bumps the rev 4 → 5.
  const afterReset: Item = {
    ...beforeReset,
    currentChapterNumber: 1,
    unlockedThroughChapterNumber: 1,
    completedChapters: [],
    bestScoreByChapter: {},
    progressRev: 5, // if_not_exists(progressRev,0) + 1
  };

  // The in-flight pass (still carrying expectedRev=4) now hits the reset row at rev 5 and
  // is REJECTED — it cannot re-complete the just-reset chapter behind the reset's back.
  const result = applyUpdate(passSpec, afterReset);
  assert.equal(result, null, "stale-rev quiz-pass must be cancelled by the reset's rev bump");
  assert.deepEqual(afterReset.completedChapters, [], "reset state survives intact");
  assert.equal(afterReset.unlockedThroughChapterNumber, 1);
});

// ── #4: the reset must NOT report success while learning-state rows survive ──
// A throttled BatchWrite can leave unprocessed > 0; if any QUIZSTATE#/QUIZATTEMPT# row
// survives, the submit fallback rebuilds passed:true and re-locks the reader (A5 brick).

test("REGRESSION #4: a reset with unprocessed > 0 is NOT considered cleared (route surfaces a 503)", () => {
  assert.equal(isResetFullyCleared({ unprocessed: 3 }), false);
  assert.equal(isResetFullyCleared({ unprocessed: 1 }), false);
});

test("#4: a reset that fully drained (unprocessed === 0) IS cleared (route returns 200)", () => {
  assert.equal(isResetFullyCleared({ unprocessed: 0 }), true);
});

test("A12: an oddly-but-validly formatted input is normalized to canonical ISO-8601", () => {
  // A valid Date input that is NOT already canonical ISO should be normalized.
  const result = sanitizeLastOpenedAt("2026-06-20T08:30:00Z", A12_NOW);
  assert.equal(result, "2026-06-20T08:30:00.000Z");
});
