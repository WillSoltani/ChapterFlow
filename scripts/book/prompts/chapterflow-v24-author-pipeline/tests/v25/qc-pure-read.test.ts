import assert from "node:assert/strict";
import {
  appendFileSync,
  lstatSync,
  readFileSync,
  readdirSync,
} from "node:fs";
import { join, relative, sep } from "node:path";

import { createBookContentReader } from "../../src/books/bookContentReader.js";
import { createBookWriteLock } from "../../src/books/bookLease.js";
import { createCandidateStore } from "../../src/books/candidateStore.js";
import { createCurrentPointerStore } from "../../src/books/currentPointer.js";
import type { ModelTaskContext, PlannedArtifact } from "../../src/contracts/v4Core.js";
import { createQcService, type QcEvaluation } from "../../src/qc/qcService.js";
import { createReviewServiceFactory } from "../../src/review/reviewService.js";
import { finishV25Tests, requiredTest, type TestContext } from "./harness.js";

const INVENTORY = [
  { kind: "CHAPTER", logicalPath: "chapters/ch01.md", mediaType: "text/markdown" },
] as const satisfies readonly PlannedArtifact[];

type TreeEntry = {
  readonly type: "directory" | "file" | "symlink" | "other";
  readonly mode: string;
  readonly mtimeNs: string;
  readonly bytes?: string;
};

function snapshotTree(root: string): Record<string, TreeEntry> {
  const snapshot: Record<string, TreeEntry> = {};
  const visit = (path: string): void => {
    const stat = lstatSync(path, { bigint: true });
    const key = relative(root, path).split(sep).join("/") || ".";
    snapshot[key] = {
      type: stat.isDirectory() ? "directory" : stat.isFile() ? "file" : stat.isSymbolicLink() ? "symlink" : "other",
      mode: stat.mode.toString(),
      mtimeNs: stat.mtimeNs.toString(),
      ...(stat.isFile() ? { bytes: readFileSync(path).toString("base64") } : {}),
    };
    if (stat.isDirectory()) {
      for (const name of readdirSync(path).sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right)))) {
        visit(join(path, name));
      }
    }
  };
  visit(root);
  return snapshot;
}

async function setup(context: TestContext, bookId: string) {
  const candidateId = "candidate-pure";
  const lock = createBookWriteLock({ booksRoot: context.roots.booksRoot, timeoutMs: 1_000, pollMs: 1 });
  const pointerStore = createCurrentPointerStore({ booksRoot: context.roots.booksRoot, writeLock: lock });
  const candidateStore = createCandidateStore({ booksRoot: context.roots.booksRoot, writeLock: lock, currentPointerStore: pointerStore });
  const reader = createBookContentReader({ booksRoot: context.roots.booksRoot, currentPointerStore: pointerStore });
  const staged = await candidateStore.stage({
    bookId,
    candidateId,
    createdByRunId: "run-pure",
    expectedInventory: INVENTORY,
    files: [{ ...INVENTORY[0], bytes: Buffer.from("# Pure read\n", "utf8") }],
    createdAt: "2026-07-20T12:00:00.000Z",
  });
  assert.equal(staged.ok, true);
  const opened = await reader.open({ bookId, selector: { kind: "CANDIDATE", candidateId } });
  assert.equal(opened.ok, true);
  assert.ok(opened.ok);
  const review = createReviewServiceFactory({ booksRoot: context.roots.booksRoot, contentReader: reader, now: () => context.clock.now() }).create({
    async evaluate() { return { ok: true, value: { outcome: "PASS", issues: [] } }; },
  });
  const taskContext: ModelTaskContext = {
    bookId,
    runId: "run-pure",
    attemptId: "attempt-pure",
    stageId: "stage-review",
    operationId: "review-pure",
    workDir: context.roots.tempRoot,
    signal: new AbortController().signal,
  };
  const canonical = await review.reviewCanonical({ reviewId: "review-pure", candidate: opened.value, taskContext });
  assert.equal(canonical.ok, true);
  assert.ok(canonical.ok);
  const qc = createQcService({ booksRoot: context.roots.booksRoot, contentReader: reader, reviewService: review, writeLock: lock, now: () => context.clock.now() });
  const evaluation: QcEvaluation = {
    roundId: "round-pure",
    candidate: { candidateId, manifestDigest: opened.value.manifest.manifestDigest },
    reviewId: canonical.value.reviewId,
    outcome: "PASS",
    issues: [],
  };
  const round = await qc.runFresh({ roundId: evaluation.roundId, candidate: opened.value, canonicalReview: canonical.value, evaluation });
  assert.equal(round.ok, true);
  return { review, qc };
}

requiredTest("review and QC status getters preserve path byte mode and mtime inventory", async (context) => {
  const bookId = "pure-read-book";
  const { review, qc } = await setup(context, bookId);
  const bookRoot = join(context.roots.booksRoot, bookId);
  const before = snapshotTree(bookRoot);
  assert.equal((await review.get(bookId, "review-pure")).ok, true);
  assert.equal((await qc.getRound(bookId, "round-pure")).ok, true);
  assert.equal((await qc.readStatus(bookId)).ok, true);
  assert.deepEqual(snapshotTree(bookRoot), before);
});

requiredTest("missing and malformed strict reads return blockers without repair quarantine or touch", async (context) => {
  const { review, qc } = await setup(context, "malformed-ledger-book");
  const beforeMissing = snapshotTree(context.roots.booksRoot);
  const missingReview = await review.get("missing-book", "missing-review");
  const missingRound = await qc.getRound("missing-book", "missing-round");
  const missingStatus = await qc.readStatus("missing-book");
  assert.equal(missingReview.ok, false);
  assert.equal(missingRound.ok, false);
  assert.equal(missingStatus.ok, false);
  if (!missingStatus.ok) assert.equal(missingStatus.error.code, "QC_LEDGER_MISSING");
  assert.deepEqual(snapshotTree(context.roots.booksRoot), beforeMissing);

  const bookRoot = join(context.roots.booksRoot, "malformed-ledger-book");
  const ledgerPath = join(bookRoot, "qc", "ledger.jsonl");
  appendFileSync(ledgerPath, "{malformed-ledger-line\n", "utf8");
  const beforeMalformed = snapshotTree(bookRoot);
  const malformed = await qc.readStatus("malformed-ledger-book");
  assert.equal(malformed.ok, false);
  if (!malformed.ok) assert.equal(malformed.error.code, "QC_LEDGER_MALFORMED");
  assert.equal((await qc.getRound("malformed-ledger-book", "round-pure")).ok, true);
  assert.deepEqual(snapshotTree(bookRoot), beforeMalformed);
  assert.equal(readdirSync(join(bookRoot, "qc")).some((name) => name.includes("quarantine") || name.includes("preserved")), false);
});

finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
