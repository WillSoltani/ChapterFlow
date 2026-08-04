import assert from "node:assert/strict";
import {
  appendFileSync,
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
} from "node:fs";
import { join, relative, sep } from "node:path";

import { createBookContentReader } from "../../src/books/bookContentReader.js";
import { createBookWriteLock } from "../../src/books/bookLease.js";
import { candidatePaths } from "../../src/books/bookPaths.js";
import { createCandidateStore } from "../../src/books/candidateStore.js";
import { createCurrentPointerStore } from "../../src/books/currentPointer.js";
import type { ModelTaskContext, PlannedArtifact } from "../../src/contracts/v4Core.js";
import type { QcLedgerRepairPoint } from "../../src/qc/qcLedgerRepair.js";
import {
  createQcService,
  type LedgerRepairRequest,
  type QcEvaluation,
} from "../../src/qc/qcService.js";
import { createReviewServiceFactory } from "../../src/review/reviewService.js";
import { finishV25Tests, requiredTest, type TestContext } from "./harness.js";

const INVENTORY = [
  { kind: "CHAPTER", logicalPath: "chapters/ch01.md", mediaType: "text/markdown" },
] as const satisfies readonly PlannedArtifact[];

type TreeEntry = { readonly mode: string; readonly mtimeNs: string; readonly bytes?: string };

function snapshotTree(root: string): Record<string, TreeEntry> {
  const snapshot: Record<string, TreeEntry> = {};
  const visit = (path: string): void => {
    const stat = lstatSync(path, { bigint: true });
    const key = relative(root, path).split(sep).join("/") || ".";
    snapshot[key] = {
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

async function setup(
  context: TestContext,
  bookId: string,
  point?: (name: QcLedgerRepairPoint) => void,
) {
  const candidateId = "candidate-repair";
  const lock = createBookWriteLock({ booksRoot: context.roots.booksRoot, timeoutMs: 1_000, pollMs: 1 });
  const pointerStore = createCurrentPointerStore({ booksRoot: context.roots.booksRoot, writeLock: lock });
  const candidateStore = createCandidateStore({ booksRoot: context.roots.booksRoot, writeLock: lock, currentPointerStore: pointerStore });
  const reader = createBookContentReader({ booksRoot: context.roots.booksRoot, currentPointerStore: pointerStore });
  const staged = await candidateStore.stage({
    bookId,
    candidateId,
    createdByRunId: "run-ledger-repair",
    expectedInventory: INVENTORY,
    files: [{ ...INVENTORY[0], bytes: Buffer.from("# Ledger repair fixture\n", "utf8") }],
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
    runId: "run-ledger-repair",
    attemptId: "attempt-review",
    stageId: "stage-review",
    operationId: "review",
    workDir: context.roots.tempRoot,
    signal: new AbortController().signal,
  };
  const canonical = await review.reviewCanonical({ reviewId: "review-repair", candidate: opened.value, taskContext });
  assert.equal(canonical.ok, true);
  assert.ok(canonical.ok);
  const qc = createQcService({
    booksRoot: context.roots.booksRoot,
    contentReader: reader,
    reviewService: review,
    writeLock: lock,
    now: () => context.clock.now(),
    repairSeams: { point },
  });
  const evaluation: QcEvaluation = {
    roundId: "round-fail",
    candidate: { candidateId, manifestDigest: opened.value.manifest.manifestDigest },
    reviewId: canonical.value.reviewId,
    outcome: "FAIL",
    issues: [{ code: "DIRTY", severity: "BLOCKER", message: "repair required" }],
  };
  const round = await qc.runFresh({ roundId: evaluation.roundId, candidate: opened.value, canonicalReview: canonical.value, evaluation });
  assert.equal(round.ok, true);
  return {
    qc,
    candidateRoot: candidatePaths(context.roots.booksRoot, bookId, candidateId).candidateRoot,
    ledgerPath: join(context.roots.booksRoot, bookId, "qc", "ledger.jsonl"),
  };
}

requiredTest("confirmed current ledger repair preserves source and increments revision once", async (context) => {
  const bookId = "ledger-repair-book";
  const rig = await setup(context, bookId);
  appendFileSync(rig.ledgerPath, "{malformed-line\n", "utf8");
  const malformedBytes = readFileSync(rig.ledgerPath);
  const candidateBefore = snapshotTree(rig.candidateRoot);

  const wrongConfirmation = await rig.qc.repairLedger({
    bookId,
    repairId: "repair-wrong-confirmation",
    expectedRevision: 1,
    confirmation: "WRONG",
  } as unknown as LedgerRepairRequest);
  assert.equal(wrongConfirmation.ok, false);
  if (!wrongConfirmation.ok) assert.equal(wrongConfirmation.error.code, "QC_LEDGER_REPAIR_CONFIRMATION_REQUIRED");
  assert.deepEqual(readFileSync(rig.ledgerPath), malformedBytes);

  const wrongRevision = await rig.qc.repairLedger({
    bookId,
    repairId: "repair-wrong-revision",
    expectedRevision: 9,
    confirmation: "REPAIR_QC_LEDGER",
  });
  assert.equal(wrongRevision.ok, false);
  if (!wrongRevision.ok) assert.equal(wrongRevision.error.code, "QC_LEDGER_REVISION_CONFLICT");
  assert.deepEqual(readFileSync(rig.ledgerPath), malformedBytes);

  const request: LedgerRepairRequest = {
    bookId,
    repairId: "repair-current-ledger",
    expectedRevision: 1,
    confirmation: "REPAIR_QC_LEDGER",
  };
  const repaired = await rig.qc.repairLedger(request);
  assert.equal(repaired.ok, true);
  assert.ok(repaired.ok);
  assert.deepEqual({ before: repaired.value.beforeRevision, after: repaired.value.afterRevision }, { before: 1, after: 2 });
  assert.equal(existsSync(repaired.value.preservedSourcePath), true);
  assert.deepEqual(readFileSync(repaired.value.preservedSourcePath), malformedBytes);
  const status = await rig.qc.readStatus(bookId);
  assert.equal(status.ok, true);
  assert.ok(status.ok);
  assert.equal(status.value.ledgerRevision, 2);
  assert.ok(status.value.issues.some((issue) => issue.severity === "BLOCKER"));
  const round = await rig.qc.getRound(bookId, "round-fail");
  assert.equal(round.ok, true);
  assert.ok(round.ok);
  assert.equal(round.value.outcome, "FAIL");
  assert.deepEqual(snapshotTree(rig.candidateRoot), candidateBefore);

  const repairedLedgerBytes = readFileSync(rig.ledgerPath);
  const replay = await rig.qc.repairLedger(request);
  assert.deepEqual(replay, repaired);
  assert.deepEqual(readFileSync(rig.ledgerPath), repairedLedgerBytes);
});

requiredTest("repair crash before ledger replace leaves original ledger", async (context) => {
  const bookId = "ledger-repair-before-crash";
  let armed = false;
  const rig = await setup(context, bookId, (name) => {
    if (armed && name === "ledger.before-replace") throw new Error("crash before ledger replace");
  });
  appendFileSync(rig.ledgerPath, "{malformed-before\n", "utf8");
  const malformedBytes = readFileSync(rig.ledgerPath);
  const candidateBefore = snapshotTree(rig.candidateRoot);
  armed = true;
  const result = await rig.qc.repairLedger({
    bookId,
    repairId: "repair-before-crash",
    expectedRevision: 1,
    confirmation: "REPAIR_QC_LEDGER",
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "QC_LEDGER_REPAIR_IO");
  assert.deepEqual(readFileSync(rig.ledgerPath), malformedBytes);
  const preserved = join(context.roots.booksRoot, bookId, "qc", "ledger-preserved", "repair-before-crash.jsonl");
  assert.deepEqual(readFileSync(preserved), malformedBytes);
  const status = await rig.qc.readStatus(bookId);
  assert.equal(status.ok, false);
  if (!status.ok) assert.equal(status.error.code, "QC_LEDGER_MALFORMED");
  assert.deepEqual(snapshotTree(rig.candidateRoot), candidateBefore);
});

requiredTest("repair crash after ledger replace exposes complete replacement", async (context) => {
  const bookId = "ledger-repair-after-crash";
  let armed = false;
  const rig = await setup(context, bookId, (name) => {
    if (armed && name === "ledger.after-replace") throw new Error("crash after ledger replace");
  });
  appendFileSync(rig.ledgerPath, "{malformed-after\n", "utf8");
  const malformedBytes = readFileSync(rig.ledgerPath);
  const candidateBefore = snapshotTree(rig.candidateRoot);
  armed = true;
  const result = await rig.qc.repairLedger({
    bookId,
    repairId: "repair-after-crash",
    expectedRevision: 1,
    confirmation: "REPAIR_QC_LEDGER",
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "QC_LEDGER_REPAIR_IO");
  assert.notDeepEqual(readFileSync(rig.ledgerPath), malformedBytes);
  const preserved = join(context.roots.booksRoot, bookId, "qc", "ledger-preserved", "repair-after-crash.jsonl");
  assert.deepEqual(readFileSync(preserved), malformedBytes);
  const status = await rig.qc.readStatus(bookId);
  assert.equal(status.ok, true);
  assert.ok(status.ok);
  assert.equal(status.value.ledgerRevision, 2);
  assert.ok(status.value.issues.some((issue) => issue.severity === "BLOCKER"));
  assert.deepEqual(snapshotTree(rig.candidateRoot), candidateBefore);
});

finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
