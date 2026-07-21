import assert from "node:assert/strict";
import { existsSync, lstatSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { createBookContentReader } from "../../src/books/bookContentReader.js";
import { createBookWriteLock } from "../../src/books/bookLease.js";
import { createCandidateStore } from "../../src/books/candidateStore.js";
import { createCurrentPointerStore } from "../../src/books/currentPointer.js";
import type { ModelTaskContext, PlannedArtifact } from "../../src/contracts/v4Core.js";
import { createReviewServiceFactory } from "../../src/review/reviewService.js";
import { createReviewStore } from "../../src/review/reviewStore.js";
import { driveV4FreshQc } from "../../src/qc/auto/driver.js";
import { createQcService } from "../../src/qc/qcService.js";
import { createQcStore } from "../../src/qc/qcStore.js";
import type { QcEvaluation, QcService } from "../../src/qc/qcTypes.js";
import { finishV25Tests, requiredTest, type TestContext } from "./harness.js";

const INVENTORY = [
  { kind: "CHAPTER", logicalPath: "chapters/ch01.md", mediaType: "text/markdown" },
] as const satisfies readonly PlannedArtifact[];
const CHAPTER_BYTES = Buffer.from("# Disposable automated QC candidate\n\nEvidence-bound fixture.\n", "utf8");

type TreeEntry = { readonly type: string; readonly mode: string; readonly mtimeNs: string; readonly bytes?: string };

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

async function setup(context: TestContext) {
  const bookId = context.ids.next("book");
  const candidateId = context.ids.next("candidate");
  const runId = context.ids.next("run");
  const reviewId = context.ids.next("review");
  const lock = createBookWriteLock({ booksRoot: context.roots.booksRoot, timeoutMs: 2_000, pollMs: 1 });
  const pointer = createCurrentPointerStore({ booksRoot: context.roots.booksRoot, writeLock: lock });
  const candidates = createCandidateStore({ booksRoot: context.roots.booksRoot, writeLock: lock, currentPointerStore: pointer });
  const reader = createBookContentReader({ booksRoot: context.roots.booksRoot, currentPointerStore: pointer });
  const staged = await candidates.stage({
    bookId,
    candidateId,
    createdByRunId: runId,
    expectedInventory: INVENTORY,
    files: [{ ...INVENTORY[0], bytes: CHAPTER_BYTES }],
    createdAt: context.clock.now(),
  });
  assert.equal(staged.ok, true);
  const opened = await reader.open({ bookId, selector: { kind: "CANDIDATE", candidateId } });
  assert.equal(opened.ok, true);
  assert.ok(opened.ok);

  const taskContext: ModelTaskContext = {
    bookId,
    runId,
    attemptId: context.ids.next("attempt"),
    stageId: context.ids.next("stage"),
    operationId: context.ids.next("operation"),
    workDir: context.roots.tempRoot,
    signal: new AbortController().signal,
  };
  const review = createReviewServiceFactory({
    booksRoot: context.roots.booksRoot,
    contentReader: reader,
    now: () => context.clock.now(),
  }).create({
    async evaluate(input) {
      assert.equal(input.candidate.manifest.bookId, bookId);
      assert.equal(input.candidate.manifest.candidateId, candidateId);
      assert.equal(input.candidate.files.length, 1);
      assert.deepEqual(Buffer.from(input.candidate.files[0].bytes), CHAPTER_BYTES);
      assert.equal(input.taskContext.attemptId, taskContext.attemptId);
      return { ok: true, value: { outcome: "PASS", issues: [] } };
    },
  });
  const canonical = await review.reviewCanonical({ reviewId, candidate: opened.value, taskContext });
  assert.equal(canonical.ok, true);
  assert.ok(canonical.ok);
  const storedReview = await createReviewStore(context.roots.booksRoot).get(bookId, reviewId);
  assert.equal(storedReview.ok, true);
  assert.ok(storedReview.ok);
  assert.deepEqual(storedReview.value, canonical.value);

  const qc = createQcService({
    booksRoot: context.roots.booksRoot,
    contentReader: reader,
    reviewService: review,
    writeLock: lock,
    now: () => context.clock.now(),
  });
  return {
    bookId,
    candidate: opened.value,
    canonical: canonical.value,
    qc,
    lock,
    cohort: {
      bookId,
      legacyWriterEnabled: false,
      v4WriterEnabled: true,
      cutoverComplete: true,
      v4WriteObserved: true,
    },
    qcStore: createQcStore({ booksRoot: context.roots.booksRoot }),
    pointer,
  };
}

function projection(rig: Awaited<ReturnType<typeof setup>>, roundId: string) {
  return {
    bookId: rig.bookId,
    roundId,
    candidate: {
      candidateId: rig.candidate.manifest.candidateId,
      manifestDigest: rig.candidate.manifest.manifestDigest,
    },
    reviewId: rig.canonical.reviewId,
    publishable: true,
  };
}

requiredTest("fresh driver persists ERROR without advance and preserves PASS FAIL ERROR", async (context) => {
  const rig = await setup(context);
  const submissions: string[] = [];
  const observedQc: QcService = {
    readStatus: (bookId) => rig.qc.readStatus(bookId),
    runFresh: async (input) => {
      submissions.push(input.roundId);
      return rig.qc.runFresh(input);
    },
    getRound: (bookId, roundId) => rig.qc.getRound(bookId, roundId),
    diagnose: (bookId, roundId) => rig.qc.diagnose(bookId, roundId),
    repairLedger: (request) => rig.qc.repairLedger(request),
  };
  const marker = join(context.roots.tempRoot, "finalization-committed.json");
  const errorRoundId = context.ids.next("round-error");
  const errorResult = await driveV4FreshQc({
    qcService: observedQc,
    writeLock: rig.lock,
    cohort: rig.cohort,
    roundId: errorRoundId,
    candidate: rig.candidate,
    canonicalReview: rig.canonical,
    finalization: projection(rig, errorRoundId),
    evaluateCompletedChecks: () => { throw new Error("fake QC evaluator exception"); },
    commitFinalization: () => { throw new Error("ERROR must not commit finalization"); },
    verifyFullBook: () => { throw new Error("ERROR must not verify full book"); },
  });
  assert.equal(errorResult.outcome, "ERROR");
  assert.equal(existsSync(marker), false);
  const storedError = await rig.qcStore.getRound(rig.bookId, errorRoundId);
  assert.equal(storedError.ok, true);
  assert.ok(storedError.ok);
  assert.equal(storedError.value.outcome, "ERROR");
  assert.equal(storedError.value.issues[0]?.code, "QC_EVALUATOR_EXCEPTION");
  assert.deepEqual(await rig.pointer.read(rig.bookId), { ok: true, value: null });

  const failRoundId = context.ids.next("round-fail");
  const failResult = await driveV4FreshQc({
    qcService: observedQc,
    writeLock: rig.lock,
    cohort: rig.cohort,
    roundId: failRoundId,
    candidate: rig.candidate,
    canonicalReview: rig.canonical,
    finalization: projection(rig, failRoundId),
    evaluateCompletedChecks: () => ({
      deterministic: { outcome: "PASS", issues: [] },
      model: { outcome: "FAIL", issues: [{ code: "QC_MODEL_FAIL", severity: "BLOCKER", message: "model check failed" }] },
    }),
    commitFinalization: () => { throw new Error("FAIL must not commit finalization"); },
    verifyFullBook: () => { throw new Error("FAIL must not verify full book"); },
  });
  assert.equal(failResult.outcome, "FAIL");
  assert.equal((await rig.qcStore.getRound(rig.bookId, failRoundId)).ok, true);

  const passRoundId = context.ids.next("round-pass");
  const passResult = await driveV4FreshQc({
    qcService: observedQc,
    writeLock: rig.lock,
    cohort: rig.cohort,
    roundId: passRoundId,
    candidate: rig.candidate,
    canonicalReview: rig.canonical,
    finalization: projection(rig, passRoundId),
    evaluateCompletedChecks: () => ({
      deterministic: { outcome: "PASS", issues: [] },
      model: { outcome: "PASS", issues: [] },
    } as const),
    commitFinalization: (value) => {
      writeFileSync(marker, JSON.stringify(value));
      return { ok: true, value: null };
    },
    verifyFullBook: async (round) => {
      const stored = await rig.qcStore.getRound(rig.bookId, round.roundId);
      return existsSync(marker) && stored.ok && stored.value.outcome === "PASS";
    },
  });
  assert.equal(passResult.outcome, "PASS");
  assert.equal(existsSync(marker), true);
  assert.deepEqual(submissions, [errorRoundId, failRoundId, passRoundId]);
});

requiredTest("stale book round candidate digest review and evaluation identities mutate zero bytes", async (context) => {
  const rig = await setup(context);
  const roundId = context.ids.next("round-current");
  const identity = {
    candidateId: rig.candidate.manifest.candidateId,
    manifestDigest: rig.candidate.manifest.manifestDigest,
  };
  const base: QcEvaluation = {
    roundId,
    candidate: identity,
    reviewId: rig.canonical.reviewId,
    outcome: "PASS",
    issues: [],
  };
  const bookRoot = join(context.roots.booksRoot, rig.bookId);
  const before = snapshotTree(bookRoot);
  const mixedCalls = { evaluation: 0, runFresh: 0, finalization: 0, verification: 0 };
  const mixedQc: QcService = {
    readStatus: (bookId) => rig.qc.readStatus(bookId),
    runFresh: (input) => { mixedCalls.runFresh += 1; return rig.qc.runFresh(input); },
    getRound: (bookId, storedRoundId) => rig.qc.getRound(bookId, storedRoundId),
    diagnose: (bookId, storedRoundId) => rig.qc.diagnose(bookId, storedRoundId),
    repairLedger: (request) => rig.qc.repairLedger(request),
  };
  const mixed = await driveV4FreshQc({
    qcService: mixedQc,
    writeLock: rig.lock,
    cohort: { ...rig.cohort, legacyWriterEnabled: true },
    roundId,
    candidate: rig.candidate,
    canonicalReview: rig.canonical,
    finalization: projection(rig, roundId),
    evaluateCompletedChecks: () => {
      mixedCalls.evaluation += 1;
      return { deterministic: { outcome: "PASS", issues: [] }, model: { outcome: "PASS", issues: [] } };
    },
    commitFinalization: () => { mixedCalls.finalization += 1; return { ok: true, value: null }; },
    verifyFullBook: () => { mixedCalls.verification += 1; return true; },
  });
  assert.equal(mixed.outcome, "BLOCKED");
  assert.equal(mixed.reason, "QC_MIXED_WRITERS_BLOCKED");
  assert.deepEqual(mixedCalls, { evaluation: 0, runFresh: 0, finalization: 0, verification: 0 });
  assert.deepEqual(snapshotTree(bookRoot), before);
  const stale: readonly QcEvaluation[] = [
    { ...base, roundId: context.ids.next("round-stale") },
    { ...base, candidate: { ...identity, candidateId: context.ids.next("candidate-stale") } },
    { ...base, candidate: { ...identity, manifestDigest: "0".repeat(64) } },
    { ...base, reviewId: context.ids.next("review-stale") },
  ];
  for (const evaluation of stale) {
    const result = await rig.qc.runFresh({
      roundId,
      candidate: rig.candidate,
      canonicalReview: rig.canonical,
      evaluation,
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.code, "QC_JOIN_MISMATCH");
    assert.deepEqual(snapshotTree(bookRoot), before);
  }

  const staleProjection = { ...projection(rig, roundId), bookId: context.ids.next("book-stale") };
  const rejectingQc: QcService = {
    readStatus: (bookId) => rig.qc.readStatus(bookId),
    runFresh: () => { throw new Error("stale projection must block before fresh QC"); },
    getRound: (bookId, storedRoundId) => rig.qc.getRound(bookId, storedRoundId),
    diagnose: (bookId, storedRoundId) => rig.qc.diagnose(bookId, storedRoundId),
    repairLedger: (request) => rig.qc.repairLedger(request),
  };
  const blocked = await driveV4FreshQc({
    qcService: rejectingQc,
    writeLock: rig.lock,
    cohort: rig.cohort,
    roundId,
    candidate: rig.candidate,
    canonicalReview: rig.canonical,
    finalization: staleProjection,
    evaluateCompletedChecks: () => { throw new Error("stale projection must block before evaluation"); },
    commitFinalization: () => { throw new Error("stale projection must not finalize"); },
    verifyFullBook: () => { throw new Error("stale projection must not verify full book"); },
  });
  assert.equal(blocked.outcome, "BLOCKED");
  assert.equal(blocked.reason, "QC_FRESHNESS_MISMATCH");
  assert.deepEqual(snapshotTree(bookRoot), before);
  assert.deepEqual(await rig.pointer.read(rig.bookId), { ok: true, value: null });
});

finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
