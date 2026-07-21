import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "./harness.js";

import { runContentRepairWorkflow, type ContentRepairRequest, type SuccessorQcOperation } from "../src/app/contentRepairWorkflow.js";
import { createBookWriteLock } from "../src/books/bookLease.js";
import { createCandidateStore } from "../src/books/candidateStore.js";
import type { CandidateSnapshot } from "../src/books/candidateTypes.js";
import { createCurrentPointerStore } from "../src/books/currentPointer.js";
import type { BookWriteLock } from "../src/books/leaseTypes.js";
import type { Result } from "../src/contracts/v4Core.js";
import { CandidateRepairService, type RepairService } from "../src/qc/repairCoordinator.js";
import { FileRepairHistoryStore } from "../src/qc/repairHistoryStore.js";
import type { QcDiagnosis, QcRoundResult, QcService } from "../src/qc/qcTypes.js";
import { FileRunStore } from "../src/run-state/fileRunStore.js";
import { createReviewServiceFactory } from "../src/review/reviewService.js";
import type { ReviewService } from "../src/review/reviewTypes.js";

const at = "2026-07-21T12:00:00.000Z";
const encoder = new TextEncoder();
const inventory = [{ kind: "CHAPTER", logicalPath: "chapters/ch01.json", mediaType: "application/json" }] as const;

function fail<T>(code: string, message = code): Result<T> {
  return { ok: false, error: { code, message } };
}

function identity(candidate: CandidateSnapshot) {
  return { candidateId: candidate.manifest.candidateId, manifestDigest: candidate.manifest.manifestDigest };
}

async function harness() {
  const booksRoot = await mkdtemp(join(tmpdir(), "chapterflow-content-repair-"));
  let lockFails = false;
  const realLock = createBookWriteLock({ booksRoot, timeoutMs: 1_000, pollMs: 1 });
  const lock: BookWriteLock = {
    run: (bookId, operation) => lockFails ? Promise.resolve(fail("LOCK_BUSY")) : realLock.run(bookId, operation),
  };
  const pointer = createCurrentPointerStore({ booksRoot, writeLock: lock });
  const candidates = createCandidateStore({ booksRoot, writeLock: lock, currentPointerStore: pointer });
  const staged = await candidates.stage({
    bookId: "book", candidateId: "candidate-0", createdByRunId: "seed-run",
    expectedInventory: inventory,
    files: [{ ...inventory[0], bytes: encoder.encode('{"text":"before"}') }],
    createdAt: at,
  });
  assert.equal(staged.ok, true);
  const opened = await candidates.open({ bookId: "book", selector: { kind: "CANDIDATE", candidateId: "candidate-0" } });
  assert.equal(opened.ok, true);
  if (!opened.ok) throw new Error("predecessor missing");
  const predecessor = opened.value;

  const calls = { createSuccessor: 0, screen: 0, review: 0, qc: 0, diagnose: 0, diagnosisLookup: 0 };
  const rounds = new Map<string, QcRoundResult>();
  rounds.set("round-0", { schemaVersion: "1", roundId: "round-0", candidate: identity(predecessor), reviewId: "review-0", outcome: "FAIL", issues: [], completedAt: at });
  let diagnosis: Result<QcDiagnosis> = fail("DIAGNOSIS_MISSING");
  let qcOutcome: "PASS" | "FAIL" | "ERROR" = "PASS";
  let reviewOverride: ((candidate: CandidateSnapshot, reviewId: string) => unknown) | undefined;
  let qcOverride: ((candidate: CandidateSnapshot, reviewId: string, roundId: string) => unknown) | undefined;
  let qcBlocked: Result<QcRoundResult> | undefined;

  const reviews: ReviewService = {
    async screen(candidate) {
      calls.screen++;
      return { ok: true, value: { candidate: identity(candidate), outcome: "SHORTLIST", issues: [] } };
    },
    async reviewCanonical({ candidate, reviewId }) {
      calls.review++;
      const overridden = reviewOverride?.(candidate, reviewId);
      if (overridden) return { ok: true, value: overridden as never };
      return { ok: true, value: { schemaVersion: "1", reviewId, candidate: identity(candidate), outcome: "PASS", issues: [], completedAt: at } };
    },
    async get() { return fail("REVIEW_NOT_FOUND"); },
  };
  const qc: QcService = {
    async readStatus() { return fail("UNUSED"); },
    async runFresh({ candidate, canonicalReview, roundId }) {
      calls.qc++;
      const overridden = qcOverride?.(candidate, canonicalReview.reviewId, roundId);
      const result = (overridden ?? { schemaVersion: "1", roundId, candidate: identity(candidate), reviewId: canonicalReview.reviewId, outcome: qcOutcome, issues: [], completedAt: at }) as QcRoundResult;
      rounds.set(result.roundId, result);
      return { ok: true, value: result };
    },
    async getRound(_bookId, roundId) {
      const round = rounds.get(roundId);
      return round ? { ok: true, value: round } : fail("QC_ROUND_NOT_FOUND");
    },
    async diagnose() { calls.diagnose++; return diagnosis; },
    async repairLedger() { return fail("UNUSED"); },
  };
  const history = new FileRepairHistoryStore({ booksRoot, writeLock: lock });
  const innerRepairs = new CandidateRepairService({
    candidates,
    history,
    qc,
    diagnoses: {
      async getDiagnosis() {
        calls.diagnosisLookup++;
        return diagnosis;
      },
    },
  });
  const repairs: RepairService = {
    async createSuccessor(request) {
      calls.createSuccessor++;
      return innerRepairs.createSuccessor(request);
    },
  };
  const successorQc: SuccessorQcOperation = {
    async run({ candidate, canonicalReview, roundId }) {
      if (qcBlocked) return qcBlocked;
      return qc.runFresh({
        roundId,
        candidate,
        canonicalReview,
        evaluation: {
          roundId,
          candidate: identity(candidate),
          reviewId: canonicalReview.reviewId,
          outcome: qcOutcome,
          issues: [],
        },
      });
    },
  };

  function request(input: Partial<ContentRepairRequest> = {}): ContentRepairRequest {
    const controller = input.taskContext ? undefined : new AbortController();
    const successorCandidateId = input.successorCandidateId ?? "candidate-1";
    return {
      bookId: "book",
      failedCandidate: identity(predecessor),
      failedRoundId: "round-0",
      repairId: "repair-1",
      successorCandidateId,
      reviewId: "review-1",
      freshRoundId: "round-1",
      expectedInventory: inventory,
      files: [{ ...inventory[0], bytes: encoder.encode(`{"text":"after-${successorCandidateId}"}`) }],
      createdAt: at,
      taskContext: {
        bookId: "book", runId: "run-1", attemptId: "attempt-1", stageId: "content-repair",
        operationId: "repair-1", workDir: booksRoot, signal: controller?.signal ?? input.taskContext!.signal,
      },
      ...input,
    };
  }

  async function run(input: ContentRepairRequest) {
    return runContentRepairWorkflow(input, {
      candidates, history, reviews, repairs, successorQc,
    });
  }

  return {
    booksRoot, candidates, predecessor, history, calls, request, run,
    setDiagnosis(value: Result<QcDiagnosis>) { diagnosis = value; },
    setQcOutcome(value: "PASS" | "FAIL" | "ERROR") { qcOutcome = value; },
    setReviewOverride(value: typeof reviewOverride) { reviewOverride = value; },
    setQcOverride(value: typeof qcOverride) { qcOverride = value; },
    setQcBlocked(value: Result<QcRoundResult> | undefined) { qcBlocked = value; },
    setLockFails(value: boolean) { lockFails = value; },
    setFailedRoundOutcome(value: "PASS" | "FAIL" | "ERROR") {
      const round = rounds.get("round-0");
      if (round) rounds.set("round-0", { ...round, outcome: value });
    },
  };
}

async function caseWithCleanup(run: (make: () => ReturnType<typeof harness>) => Promise<void>): Promise<void> {
  const roots: string[] = [];
  const make = async () => {
    const value = await harness();
    roots.push(value.booksRoot);
    return value;
  };
  try {
    await run(make);
  } finally {
    await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
  }
}

test("first repair preserves predecessor and creates reviewed fresh-QC successor", () => caseWithCleanup(async (make) => {
  const h = await make();
  const result = await h.run(h.request());
  assert.equal(result.ok && result.value.status, "PASS");
  if (!result.ok) return;
  assert.notEqual(result.value.successor.manifest.manifestDigest, h.predecessor.manifest.manifestDigest);
  const predecessor = await h.candidates.open({ bookId: "book", selector: { kind: "CANDIDATE", candidateId: "candidate-0" } });
  assert.equal(predecessor.ok && new TextDecoder().decode(predecessor.value.files[0]?.bytes), '{"text":"before"}');
  assert.deepEqual(h.calls, { createSuccessor: 1, screen: 1, review: 1, qc: 1, diagnose: 0, diagnosisLookup: 0 });
}));

test("old canonical review cannot authorize successor", () => caseWithCleanup(async (make) => {
  const h = await make();
  h.setReviewOverride(() => ({ schemaVersion: "1", reviewId: "old-review", candidate: identity(h.predecessor), outcome: "PASS", issues: [], completedAt: at }));
  const result = await h.run(h.request());
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "REPAIR_REVIEW_STALE");
  assert.equal(h.calls.qc, 0);
}));

test("old QC record and reused round cannot authorize successor", () => caseWithCleanup(async (make) => {
  const h = await make();
  h.setQcOverride(() => ({ schemaVersion: "1", roundId: "round-0", candidate: identity(h.predecessor), reviewId: "review-1", outcome: "PASS", issues: [], completedAt: at }));
  const result = await h.run(h.request());
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "REPAIR_QC_STALE");
  const reused = await h.run(h.request({ freshRoundId: "round-0", successorCandidateId: "candidate-x" }));
  assert.equal(reused.ok, false);
  if (!reused.ok) assert.equal(reused.error.code, "REPAIR_QC_ROUND_REUSED");
  h.setFailedRoundOutcome("ERROR");
  const infra = await h.run(h.request({ successorCandidateId: "candidate-error" }));
  assert.equal(infra.ok, false);
  if (!infra.ok) assert.equal(infra.error.code, "REPAIR_FAILED_QC_STALE");
}));

test("second repair without diagnosis blocks before candidate creation", () => caseWithCleanup(async (make) => {
  const h = await make();
  h.setQcOutcome("FAIL");
  const first = await h.run(h.request());
  assert.equal(first.ok && first.value.status, "REPAIR_UNSUCCESSFUL");
  if (!first.ok) return;
  const secondRequest = h.request({ failedCandidate: identity(first.value.successor), failedRoundId: "round-1", repairId: "repair-2", successorCandidateId: "candidate-2", reviewId: "review-2", freshRoundId: "round-2" });
  const second = await h.run(secondRequest);
  assert.equal(second.ok, false);
  if (!second.ok) assert.equal(second.error.code, "REPAIR_DIAGNOSIS_REQUIRED");
  const absent = await h.candidates.open({ bookId: "book", selector: { kind: "CANDIDATE", candidateId: "candidate-2" } });
  assert.equal(absent.ok, false);
}));

test("stale diagnosis digest blocks second repair", () => caseWithCleanup(async (make) => {
  const h = await make();
  h.setQcOutcome("FAIL");
  const first = await h.run(h.request());
  assert.equal(first.ok, true);
  if (!first.ok) return;
  h.setDiagnosis({ ok: true, value: { diagnosisId: "diagnosis-1", roundId: "round-1", candidate: identity(h.predecessor), issues: [], createdAt: at } });
  const second = await h.run(h.request({ failedCandidate: identity(first.value.successor), failedRoundId: "round-1", diagnosisId: "diagnosis-1", repairId: "repair-2", successorCandidateId: "candidate-2", reviewId: "review-2", freshRoundId: "round-2" }));
  assert.equal(second.ok, false);
  if (!second.ok) assert.equal(second.error.code, "REPAIR_DIAGNOSIS_STALE");
}));

test("matching diagnosis permits one ordinal-two successor", () => caseWithCleanup(async (make) => {
  const h = await make();
  h.setQcOutcome("FAIL");
  const first = await h.run(h.request());
  assert.equal(first.ok, true);
  if (!first.ok) return;
  const failedCandidate = identity(first.value.successor);
  h.setDiagnosis({ ok: true, value: { diagnosisId: "diagnosis-1", roundId: "round-1", candidate: failedCandidate, issues: [], createdAt: at } });
  h.setQcOutcome("PASS");
  const second = await h.run(h.request({ failedCandidate, failedRoundId: "round-1", diagnosisId: "diagnosis-1", repairId: "repair-2", successorCandidateId: "candidate-2", reviewId: "review-2", freshRoundId: "round-2" }));
  assert.equal(second.ok && second.value.ordinal, 2);
  assert.equal(h.calls.diagnosisLookup, 1);
  assert.equal(h.calls.diagnose, 0);
}));

test("identical orphan successor reconciles after pre-history failure", () => caseWithCleanup(async (make) => {
  const h = await make();
  h.setQcOutcome("ERROR");
  const request = h.request();
  const first = await h.run(request);
  assert.equal(first.ok, false);
  if (!first.ok) assert.equal(first.error.code, "REPAIR_QC_ERROR");
  const emptyHistory = await h.history.list("book");
  assert.equal(emptyHistory.ok && emptyHistory.value.length, 0);
  const orphan = await h.candidates.open({ bookId: "book", selector: { kind: "CANDIDATE", candidateId: "candidate-1" } });
  assert.equal(orphan.ok, true);
  h.setQcOutcome("PASS");
  const retry = await h.run(request);
  assert.equal(retry.ok, true);
  if (orphan.ok && retry.ok) assert.deepEqual(retry.value.successor.manifest, orphan.value.manifest);
  assert.equal(h.calls.diagnose, 0);
}));

test("cancellation and lock failure stop later review and QC authority", () => caseWithCleanup(async (make) => {
  const cancelled = await make();
  const controller = new AbortController();
  controller.abort();
  const cancelledResult = await cancelled.run(cancelled.request({ taskContext: { bookId: "book", runId: "run-c", attemptId: "attempt-c", stageId: "content-repair", operationId: "repair-c", workDir: cancelled.booksRoot, signal: controller.signal } }));
  assert.equal(cancelledResult.ok, false);
  assert.deepEqual(cancelled.calls, { createSuccessor: 0, screen: 0, review: 0, qc: 0, diagnose: 0, diagnosisLookup: 0 });

  const locked = await make();
  locked.setLockFails(true);
  const lockedResult = await locked.run(locked.request());
  assert.equal(lockedResult.ok, false);
  if (!lockedResult.ok) assert.equal(lockedResult.error.code, "LOCK_BUSY");
  assert.deepEqual({ screen: locked.calls.screen, review: locked.calls.review, qc: locked.calls.qc }, { screen: 0, review: 0, qc: 0 });
}));

test("canonical review PASS without completed successor reviewer evidence writes no QC or history", () => caseWithCleanup(async (make) => {
  const h = await make();
  h.setQcBlocked(fail("REPAIR_QC_EVIDENCE_UNAVAILABLE"));
  const result = await h.run(h.request());
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "REPAIR_QC_EVIDENCE_UNAVAILABLE");
  assert.equal(h.calls.review, 1);
  assert.equal(h.calls.qc, 0);
  const history = await h.history.list("book");
  assert.equal(history.ok && history.value.length, 0);
}));

test("deterministic review run and stored canonical review reconcile without second model execution", async () => {
  const root = await mkdtemp(join(tmpdir(), "chapterflow-content-repair-run-"));
  try {
    const requireOk = <T>(result: Result<T>): T => {
      if (!result.ok) assert.fail(`${result.error.code}:${result.error.message}`);
      return result.value;
    };
    const booksRoot = join(root, "books");
    await mkdir(booksRoot, { recursive: true });
    const runStore = new FileRunStore(join(root, "run-state"));
    const writeLock = createBookWriteLock({ booksRoot, timeoutMs: 1_000, pollMs: 1 });
    const pointer = createCurrentPointerStore({ booksRoot, writeLock });
    const candidates = createCandidateStore({ booksRoot, writeLock, currentPointerStore: pointer });
    const candidateId = "successor-round-0";
    const runId = "content-repair-round-0";
    const reviewId = "review-round-0";
    const reviewAt = "2026-07-21T12:00:01.000Z";
    const staged = await candidates.stage({
      bookId: "book",
      candidateId,
      parentCandidateId: "candidate-0",
      createdByRunId: runId,
      expectedInventory: inventory,
      files: [{ ...inventory[0], bytes: encoder.encode('{"text":"after"}') }],
      createdAt: at,
    });
    requireOk(staged);
    const opened = await candidates.open({ bookId: "book", selector: { kind: "CANDIDATE", candidateId } });
    const successor = requireOk(opened);
    const definition = {
      schemaVersion: "1" as const,
      bookId: "book",
      runId,
      commandId: "content-repair-canary",
      sourceGitSha: "a".repeat(40),
      requiredStages: ["content-repair-canary"],
      requiredInventory: inventory,
      inputCandidate: identity(successor),
      attemptLimits: { run: 1, byStage: { "content-repair-canary": 1 } },
      createdAt: at,
    };
    requireOk(await runStore.createRun(definition));
    let modelCalls = 0;
    const reviews = createReviewServiceFactory({
      booksRoot,
      contentReader: { open: (input) => candidates.open(input) },
      now: () => reviewAt,
    }).create({
      async evaluate() {
        modelCalls++;
        return { ok: true, value: { outcome: "PASS", issues: [] } };
      },
    });
    const context = {
      bookId: "book", runId, attemptId: "attempt-round-0", stageId: "content-repair-canary",
      operationId: "repair-round-0", workDir: root, signal: new AbortController().signal,
    };
    const first = requireOk(await reviews.reviewCanonical({ reviewId, candidate: successor, taskContext: context }));
    requireOk(await runStore.finishRun({ bookId: "book", runId, status: "COMPLETED", finishedAt: reviewAt }));
    const restarted = requireOk(await runStore.createRun(definition));
    assert.equal(restarted.status, "COMPLETED");
    const second = requireOk(await reviews.reviewCanonical({ reviewId, candidate: successor, taskContext: context }));
    requireOk(await runStore.finishRun({ bookId: "book", runId, status: "COMPLETED", finishedAt: reviewAt }));
    assert.equal(modelCalls, 1);
    assert.deepEqual(second, first);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
