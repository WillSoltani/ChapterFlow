import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { createBookContentReader } from "../../src/books/bookContentReader.js";
import { createBookWriteLock } from "../../src/books/bookLease.js";
import { createCandidateStore } from "../../src/books/candidateStore.js";
import { createCurrentPointerStore } from "../../src/books/currentPointer.js";
import type { PlannedArtifact } from "../../src/contracts/v4Core.js";
import { createQcService, type QcEvaluation } from "../../src/qc/qcService.js";
import {
  createReviewServiceFactory,
  type CanonicalReviewResult,
} from "../../src/review/reviewService.js";
import { finishV25Tests, requiredTest } from "./harness.js";

const INVENTORY = [
  { kind: "CHAPTER", logicalPath: "chapters/ch01.md", mediaType: "text/markdown" },
] as const satisfies readonly PlannedArtifact[];

requiredTest("screening writes no canonical record and has no QC authority", async ({ roots, clock }) => {
  const bookId = "screening-authority-book";
  const candidateId = "candidate-screen";
  const lock = createBookWriteLock({ booksRoot: roots.booksRoot, timeoutMs: 1_000, pollMs: 1 });
  const pointerStore = createCurrentPointerStore({ booksRoot: roots.booksRoot, writeLock: lock });
  const candidateStore = createCandidateStore({ booksRoot: roots.booksRoot, writeLock: lock, currentPointerStore: pointerStore });
  const reader = createBookContentReader({ booksRoot: roots.booksRoot, currentPointerStore: pointerStore });
  const staged = await candidateStore.stage({
    bookId,
    candidateId,
    createdByRunId: "run-screen",
    expectedInventory: INVENTORY,
    files: [{ ...INVENTORY[0], bytes: Buffer.from("# Screened\n", "utf8") }],
    createdAt: "2026-07-20T12:00:00.000Z",
  });
  assert.equal(staged.ok, true);
  const opened = await reader.open({ bookId, selector: { kind: "CANDIDATE", candidateId } });
  assert.equal(opened.ok, true);
  assert.ok(opened.ok);

  let evaluatorCalls = 0;
  const review = createReviewServiceFactory({ booksRoot: roots.booksRoot, contentReader: reader, now: () => clock.now() }).create({
    async evaluate() {
      evaluatorCalls += 1;
      return { ok: true, value: { outcome: "PASS", issues: [] } };
    },
  });
  const screening = await review.screen(opened.value);
  assert.equal(screening.ok, true);
  assert.ok(screening.ok);
  assert.equal(screening.value.outcome, "SHORTLIST");
  assert.equal(evaluatorCalls, 0);
  assert.equal(existsSync(join(roots.booksRoot, bookId, "reviews")), false);

  const lookup = await review.get(bookId, "screening-only");
  assert.equal(lookup.ok, false);
  if (!lookup.ok) assert.equal(lookup.error.code, "REVIEW_NOT_FOUND");
  assert.equal(existsSync(join(roots.booksRoot, bookId, "reviews")), false);

  const qc = createQcService({
    booksRoot: roots.booksRoot,
    contentReader: reader,
    reviewService: review,
    writeLock: lock,
    now: () => clock.now(),
  });
  const evaluation: QcEvaluation = {
    roundId: "round-screen",
    candidate: screening.value.candidate,
    reviewId: "screening-only",
    outcome: "PASS",
    issues: [],
  };
  const unauthorized = await qc.runFresh({
    roundId: evaluation.roundId,
    candidate: opened.value,
    canonicalReview: screening.value as unknown as CanonicalReviewResult,
    evaluation,
  });
  assert.equal(unauthorized.ok, false);
  if (!unauthorized.ok) assert.equal(unauthorized.error.code, "QC_CANONICAL_REVIEW_REQUIRED");
  assert.equal(existsSync(join(roots.booksRoot, bookId, "qc")), false);
});

finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
