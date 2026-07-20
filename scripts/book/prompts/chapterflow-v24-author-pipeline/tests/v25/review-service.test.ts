import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { createBookContentReader } from "../../src/books/bookContentReader.js";
import { createBookWriteLock } from "../../src/books/bookLease.js";
import { createCandidateStore } from "../../src/books/candidateStore.js";
import { createCurrentPointerStore } from "../../src/books/currentPointer.js";
import type { CandidateSnapshot } from "../../src/books/candidateTypes.js";
import type { ModelTaskContext, PlannedArtifact } from "../../src/contracts/v4Core.js";
import {
  createReviewServiceFactory,
  type CanonicalReviewEvaluator,
} from "../../src/review/reviewService.js";
import { finishV25Tests, requiredTest, type TestContext } from "./harness.js";

const INVENTORY = [
  { kind: "CHAPTER", logicalPath: "chapters/ch01.md", mediaType: "text/markdown" },
  { kind: "PROVENANCE", logicalPath: "provenance/ch01.json", mediaType: "application/json" },
] as const satisfies readonly PlannedArtifact[];

async function setupCandidate(context: TestContext, bookId: string, candidateId: string, suffix = "") {
  const lock = createBookWriteLock({ booksRoot: context.roots.booksRoot, timeoutMs: 1_000, pollMs: 1 });
  const pointerStore = createCurrentPointerStore({ booksRoot: context.roots.booksRoot, writeLock: lock });
  const candidateStore = createCandidateStore({
    booksRoot: context.roots.booksRoot,
    writeLock: lock,
    currentPointerStore: pointerStore,
  });
  const reader = createBookContentReader({ booksRoot: context.roots.booksRoot, currentPointerStore: pointerStore });
  const staged = await candidateStore.stage({
    bookId,
    candidateId,
    createdByRunId: "run-review-fixture",
    expectedInventory: INVENTORY,
    files: [
      { ...INVENTORY[0], bytes: Buffer.from(`# Chapter${suffix}\n`, "utf8") },
      { ...INVENTORY[1], bytes: Buffer.from(`{"source":"fixture${suffix}"}\n`, "utf8") },
    ],
    createdAt: "2026-07-20T12:00:00.000Z",
  });
  assert.equal(staged.ok, true);
  const opened = await reader.open({ bookId, selector: { kind: "CANDIDATE", candidateId } });
  assert.equal(opened.ok, true);
  assert.ok(opened.ok);
  return { lock, reader, candidateStore, snapshot: opened.value };
}

function taskContext(context: TestContext, bookId: string): ModelTaskContext {
  return {
    bookId,
    runId: "run-review",
    attemptId: "attempt-app-assigned",
    stageId: "stage-canonical-review",
    operationId: "review-operation",
    workDir: context.roots.tempRoot,
    signal: new AbortController().signal,
  };
}

requiredTest("canonical review reopens complete candidate and preserves app task context", async (context) => {
  const bookId = "review-complete-book";
  const { reader, snapshot } = await setupCandidate(context, bookId, "candidate-a");
  const suppliedContext = taskContext(context, bookId);
  let calls = 0;
  const evaluator: CanonicalReviewEvaluator = {
    async evaluate(input) {
      calls += 1;
      assert.strictEqual(input.taskContext, suppliedContext);
      assert.deepEqual(input.candidate.manifest.entries, snapshot.manifest.entries);
      assert.deepEqual(
        input.candidate.files.map((file) => Buffer.from(file.bytes)),
        snapshot.files.map((file) => Buffer.from(file.bytes)),
      );
      return { ok: true, value: { outcome: "PASS", issues: [] } };
    },
  };
  const review = createReviewServiceFactory({
    booksRoot: context.roots.booksRoot,
    contentReader: reader,
    now: () => context.clock.now(),
  }).create(evaluator);
  const result = await review.reviewCanonical({
    reviewId: "review-a",
    candidate: snapshot,
    taskContext: suppliedContext,
  });
  assert.equal(result.ok, true);
  assert.ok(result.ok);
  assert.equal(calls, 1);
  assert.deepEqual(result.value.candidate, {
    candidateId: snapshot.manifest.candidateId,
    manifestDigest: snapshot.manifest.manifestDigest,
  });
  assert.equal(result.value.outcome, "PASS");
  const recordPath = join(context.roots.booksRoot, bookId, "reviews", "review-a.json");
  assert.equal(existsSync(recordPath), true);
  assert.deepEqual(JSON.parse(readFileSync(recordPath, "utf8")), result.value);
  assert.deepEqual(await review.get(bookId, "review-a"), result);
});

requiredTest("partial candidate and invalid evaluator output never become canonical PASS", async (context) => {
  const bookId = "review-error-book";
  const { reader, snapshot } = await setupCandidate(context, bookId, "candidate-a");
  let calls = 0;
  const review = createReviewServiceFactory({
    booksRoot: context.roots.booksRoot,
    contentReader: reader,
    now: () => context.clock.now(),
  }).create({
    async evaluate() {
      calls += 1;
      return {
        ok: true,
        value: {
          outcome: "PASS",
          issues: [{ code: "INVALID_PASS", severity: "BLOCKER", message: "contradictory pass" }],
        },
      };
    },
  });

  const partial: CandidateSnapshot = { ...snapshot, files: snapshot.files.slice(0, 1) };
  const rejected = await review.reviewCanonical({
    reviewId: "partial-review",
    candidate: partial,
    taskContext: taskContext(context, bookId),
  });
  assert.equal(rejected.ok, false);
  if (!rejected.ok) assert.equal(rejected.error.code, "CANDIDATE_MISMATCH");
  assert.equal(calls, 0);
  assert.equal(existsSync(join(context.roots.booksRoot, bookId, "reviews", "partial-review.json")), false);

  const invalid = await review.reviewCanonical({
    reviewId: "invalid-output-review",
    candidate: snapshot,
    taskContext: taskContext(context, bookId),
  });
  assert.equal(invalid.ok, true);
  assert.ok(invalid.ok);
  assert.equal(invalid.value.outcome, "ERROR");
  assert.equal(invalid.value.issues[0]?.code, "REVIEW_EVALUATOR_INVALID");
  assert.equal(calls, 1);
});

requiredTest("malformed evaluator failures store fixed ERROR records that round-trip", async (context) => {
  const bookId = "review-malformed-failure-book";
  const { reader, snapshot } = await setupCandidate(context, bookId, "candidate-a");
  const malformedFailures: readonly unknown[] = [
    { ok: false, error: { code: "BROKEN", message: { nested: true } } },
    { ok: false, error: { message: "missing error code" } },
  ];
  let calls = 0;
  const evaluator: CanonicalReviewEvaluator = {
    async evaluate() {
      const result = malformedFailures[calls];
      calls += 1;
      return result as never;
    },
  };
  const review = createReviewServiceFactory({
    booksRoot: context.roots.booksRoot,
    contentReader: reader,
    now: () => context.clock.now(),
  }).create(evaluator);

  for (let index = 0; index < malformedFailures.length; index += 1) {
    const reviewId = `malformed-failure-${index + 1}`;
    const result = await review.reviewCanonical({
      reviewId,
      candidate: snapshot,
      taskContext: taskContext(context, bookId),
    });
    assert.equal(result.ok, true, reviewId);
    assert.ok(result.ok);
    assert.equal(result.value.outcome, "ERROR", reviewId);
    assert.deepEqual(result.value.issues, [{
      code: "REVIEW_EVALUATOR_INVALID",
      severity: "BLOCKER",
      message: "canonical evaluator returned an invalid result",
    }], reviewId);
    assert.deepEqual(await review.get(bookId, reviewId), result, reviewId);
  }
  assert.equal(calls, malformedFailures.length);
});

requiredTest("canonical review ID replay is idempotent and conflicting identity preserves original", async (context) => {
  const bookId = "review-replay-book";
  const first = await setupCandidate(context, bookId, "candidate-a", " A");
  const secondStaged = await first.candidateStore.stage({
    bookId,
    candidateId: "candidate-b",
    createdByRunId: "run-review-fixture",
    expectedInventory: INVENTORY,
    files: [
      { ...INVENTORY[0], bytes: Buffer.from("# Chapter B\n", "utf8") },
      { ...INVENTORY[1], bytes: Buffer.from("{\"source\":\"fixture B\"}\n", "utf8") },
    ],
    createdAt: "2026-07-20T12:00:01.000Z",
  });
  assert.equal(secondStaged.ok, true);
  const second = await first.reader.open({ bookId, selector: { kind: "CANDIDATE", candidateId: "candidate-b" } });
  assert.equal(second.ok, true);
  assert.ok(second.ok);
  let calls = 0;
  const review = createReviewServiceFactory({
    booksRoot: context.roots.booksRoot,
    contentReader: first.reader,
    now: () => context.clock.now(),
  }).create({
    async evaluate() {
      calls += 1;
      return { ok: true, value: { outcome: "PASS", issues: [] } };
    },
  });
  const ctx = taskContext(context, bookId);
  const created = await review.reviewCanonical({ reviewId: "stable-review", candidate: first.snapshot, taskContext: ctx });
  assert.equal(created.ok, true);
  const recordPath = join(context.roots.booksRoot, bookId, "reviews", "stable-review.json");
  const originalBytes = readFileSync(recordPath);

  const replay = await review.reviewCanonical({ reviewId: "stable-review", candidate: first.snapshot, taskContext: ctx });
  assert.deepEqual(replay, created);
  assert.equal(calls, 1);
  assert.deepEqual(readFileSync(recordPath), originalBytes);

  const partialReplay = await review.reviewCanonical({
    reviewId: "stable-review",
    candidate: { ...first.snapshot, files: [] },
    taskContext: ctx,
  });
  assert.equal(partialReplay.ok, false);
  if (!partialReplay.ok) assert.equal(partialReplay.error.code, "CANDIDATE_MISMATCH");
  assert.equal(calls, 1);
  assert.deepEqual(readFileSync(recordPath), originalBytes);

  const conflict = await review.reviewCanonical({ reviewId: "stable-review", candidate: second.value, taskContext: ctx });
  assert.equal(conflict.ok, false);
  if (!conflict.ok) assert.equal(conflict.error.code, "REVIEW_ID_CONFLICT");
  assert.equal(calls, 1);
  assert.deepEqual(readFileSync(recordPath), originalBytes);
});

finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
