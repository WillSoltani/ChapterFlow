import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { createBookContentReader } from "../../src/books/bookContentReader.js";
import { createBookWriteLock } from "../../src/books/bookLease.js";
import { bookPaths } from "../../src/books/bookPaths.js";
import { createCandidateStore } from "../../src/books/candidateStore.js";
import { createCurrentPointerStore, type CurrentPointerStore } from "../../src/books/currentPointer.js";
import type { QcRoundResult, QcService } from "../../src/qc/qcTypes.js";
import { createPromotionService, type PromotionRequest } from "../../src/release/promotionService.js";
import type { CanonicalReviewResult, ReviewService } from "../../src/review/reviewTypes.js";
import { finishV25Tests, requiredTest } from "./harness.js";

function deferred(): { readonly promise: Promise<void>; readonly resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

requiredTest("two concurrent valid promotions for one revision have one verified winner and one conflict", async ({ roots }) => {
  const bookId = "promotion-race-book";
  const lock = createBookWriteLock({ booksRoot: roots.booksRoot, timeoutMs: 1_000, pollMs: 1 });
  const pointerStore = createCurrentPointerStore({ booksRoot: roots.booksRoot, writeLock: lock });
  const candidateStore = createCandidateStore({
    booksRoot: roots.booksRoot,
    writeLock: lock,
    currentPointerStore: pointerStore,
  });
  const contentReader = createBookContentReader({ booksRoot: roots.booksRoot, currentPointerStore: pointerStore });
  const staged = await candidateStore.stage({
    bookId,
    candidateId: "candidate-race",
    createdByRunId: "run-race",
    expectedInventory: [{ kind: "CHAPTER", logicalPath: "chapters/ch01.md", mediaType: "text/markdown" }],
    files: [{
      kind: "CHAPTER",
      logicalPath: "chapters/ch01.md",
      mediaType: "text/markdown",
      bytes: Buffer.from("concurrent candidate\n", "utf8"),
    }],
    createdAt: "2026-07-20T12:00:00.000Z",
  });
  assert.ok(staged.ok);
  const input: PromotionRequest = {
    bookId,
    candidate: { candidateId: "candidate-race", manifestDigest: staged.value.manifestDigest },
    reviewId: "review-race",
    qcRoundId: "round-race",
    expectedBookRevision: 0,
    promotedAt: "2026-07-20T12:00:03.000Z",
  };
  const review: CanonicalReviewResult = {
    schemaVersion: "1",
    reviewId: input.reviewId,
    candidate: { ...input.candidate },
    outcome: "PASS",
    issues: [],
    completedAt: "2026-07-20T12:00:01.000Z",
  };
  const round: QcRoundResult = {
    schemaVersion: "1",
    roundId: input.qcRoundId,
    candidate: { ...input.candidate },
    reviewId: input.reviewId,
    outcome: "PASS",
    issues: [],
    completedAt: "2026-07-20T12:00:02.000Z",
  };
  const reviewService: ReviewService = {
    screen: async () => { throw new Error("screen is outside promotion"); },
    reviewCanonical: async () => { throw new Error("review execution is outside promotion"); },
    get: async () => ({ ok: true, value: review }),
  };
  const qcService: QcService = {
    readStatus: async () => { throw new Error("status is outside promotion"); },
    runFresh: async () => { throw new Error("QC execution is outside promotion"); },
    getRound: async () => ({ ok: true, value: round }),
    diagnose: async () => { throw new Error("diagnosis is outside promotion"); },
    repairLedger: async () => { throw new Error("repair is outside promotion"); },
  };

  const bothRevisionReads = deferred();
  let revisionReads = 0;
  let casCalls = 0;
  const racingPointerStore: CurrentPointerStore = {
    read: async (requestedBookId) => {
      const observed = await pointerStore.read(requestedBookId);
      revisionReads += 1;
      if (revisionReads === 2) bothRevisionReads.resolve();
      await bothRevisionReads.promise;
      return observed;
    },
    compareAndSet: async (cas) => {
      casCalls += 1;
      return pointerStore.compareAndSet(cas);
    },
  };
  const options = {
    candidateStore,
    contentReader,
    reviewService,
    qcService,
    currentPointerStore: racingPointerStore,
    clock: () => "2026-07-20T12:00:04.000Z",
  } as const;
  const left = createPromotionService(options);
  const right = createPromotionService(options);
  const [leftResult, rightResult] = await Promise.all([left.promote(input), right.promote(input)]);
  const results = [leftResult, rightResult];
  assert.equal(results.filter((result) => result.ok).length, 1);
  const conflict = results.find((result) => !result.ok);
  assert.ok(conflict && !conflict.ok);
  assert.equal(conflict.error.code, "REVISION_CONFLICT");
  assert.equal(revisionReads, 2);
  assert.equal(casCalls, 2);

  const winner = results.find((result) => result.ok);
  assert.ok(winner?.ok);
  assert.equal(winner.value.bookRevision, 1);
  assert.equal(winner.value.readback, "VERIFIED");
  const current = await pointerStore.read(bookId);
  assert.ok(current.ok && current.value);
  assert.equal(current.value.candidateId, input.candidate.candidateId);
  assert.equal(current.value.manifestDigest, input.candidate.manifestDigest);
  assert.equal(current.value.revision, 1);
  const pointerPath = bookPaths(roots.booksRoot, bookId).currentPointer;
  const committedBytes = readFileSync(pointerPath);
  assert.deepEqual(JSON.parse(committedBytes.toString("utf8")), current.value);
});

finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
