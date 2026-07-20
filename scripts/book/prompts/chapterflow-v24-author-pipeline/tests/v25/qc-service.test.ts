import assert from "node:assert/strict";
import { appendFileSync, existsSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { createBookContentReader } from "../../src/books/bookContentReader.js";
import { createBookWriteLock } from "../../src/books/bookLease.js";
import { candidatePaths, contentPath } from "../../src/books/bookPaths.js";
import { createCandidateStore } from "../../src/books/candidateStore.js";
import { createCurrentPointerStore } from "../../src/books/currentPointer.js";
import type { ModelTaskContext, PlannedArtifact } from "../../src/contracts/v4Core.js";
import { createQcService, type QcEvaluation, type QcIssue } from "../../src/qc/qcService.js";
import { createReviewServiceFactory } from "../../src/review/reviewService.js";
import { finishV25Tests, requiredTest, type TestContext } from "./harness.js";

const INVENTORY = [
  { kind: "CHAPTER", logicalPath: "chapters/ch01.md", mediaType: "text/markdown" },
] as const satisfies readonly PlannedArtifact[];

async function setup(context: TestContext, bookId: string) {
  const candidateId = "candidate-qc";
  const lock = createBookWriteLock({ booksRoot: context.roots.booksRoot, timeoutMs: 1_000, pollMs: 1 });
  const pointerStore = createCurrentPointerStore({ booksRoot: context.roots.booksRoot, writeLock: lock });
  const candidateStore = createCandidateStore({ booksRoot: context.roots.booksRoot, writeLock: lock, currentPointerStore: pointerStore });
  const reader = createBookContentReader({ booksRoot: context.roots.booksRoot, currentPointerStore: pointerStore });
  const staged = await candidateStore.stage({
    bookId,
    candidateId,
    createdByRunId: "run-qc-fixture",
    expectedInventory: INVENTORY,
    files: [{ ...INVENTORY[0], bytes: Buffer.from("# QC Fixture\n", "utf8") }],
    createdAt: "2026-07-20T12:00:00.000Z",
  });
  assert.equal(staged.ok, true);
  const opened = await reader.open({ bookId, selector: { kind: "CANDIDATE", candidateId } });
  assert.equal(opened.ok, true);
  assert.ok(opened.ok);

  const review = createReviewServiceFactory({
    booksRoot: context.roots.booksRoot,
    contentReader: reader,
    now: () => context.clock.now(),
  }).create({ async evaluate() { return { ok: true, value: { outcome: "PASS", issues: [] } }; } });
  const taskContext: ModelTaskContext = {
    bookId,
    runId: "run-qc",
    attemptId: "attempt-review",
    stageId: "stage-review",
    operationId: "canonical-review",
    workDir: context.roots.tempRoot,
    signal: new AbortController().signal,
  };
  const canonical = await review.reviewCanonical({ reviewId: "review-qc", candidate: opened.value, taskContext });
  assert.equal(canonical.ok, true);
  assert.ok(canonical.ok);
  const qc = createQcService({
    booksRoot: context.roots.booksRoot,
    contentReader: reader,
    reviewService: review,
    writeLock: lock,
    now: () => context.clock.now(),
    diagnosisId: () => context.ids.next("diagnosis"),
  });
  return { candidateId, lock, reader, snapshot: opened.value, canonical: canonical.value, review, qc };
}

function evaluation(
  setupResult: Awaited<ReturnType<typeof setup>>,
  roundId: string,
  outcome: "PASS" | "FAIL" | "ERROR",
  issues: readonly QcIssue[] = [],
): QcEvaluation {
  return {
    roundId,
    candidate: {
      candidateId: setupResult.snapshot.manifest.candidateId,
      manifestDigest: setupResult.snapshot.manifest.manifestDigest,
    },
    reviewId: setupResult.canonical.reviewId,
    outcome,
    issues,
  };
}

requiredTest("fresh QC exact join creates one idempotent PASS round", async (context) => {
  const bookId = "qc-pass-book";
  const rig = await setup(context, bookId);
  const pass = evaluation(rig, "round-pass", "PASS");
  const created = await rig.qc.runFresh({
    roundId: pass.roundId,
    candidate: rig.snapshot,
    canonicalReview: rig.canonical,
    evaluation: pass,
  });
  assert.equal(created.ok, true);
  assert.ok(created.ok);
  assert.equal(created.value.outcome, "PASS");
  assert.deepEqual(await rig.qc.getRound(bookId, pass.roundId), created);
  const status = await rig.qc.readStatus(bookId);
  assert.equal(status.ok, true);
  assert.ok(status.ok);
  assert.equal(status.value.ledgerRevision, 1);
  assert.deepEqual(status.value.issues, []);

  const ledgerPath = join(context.roots.booksRoot, bookId, "qc", "ledger.jsonl");
  const beforeReplay = readFileSync(ledgerPath);
  const replay = await rig.qc.runFresh({
    roundId: pass.roundId,
    candidate: rig.snapshot,
    canonicalReview: rig.canonical,
    evaluation: pass,
  });
  assert.deepEqual(replay, created);
  assert.deepEqual(readFileSync(ledgerPath), beforeReplay);

  const partialReplay = await rig.qc.runFresh({
    roundId: pass.roundId,
    candidate: { ...rig.snapshot, files: [] },
    canonicalReview: rig.canonical,
    evaluation: pass,
  });
  assert.equal(partialReplay.ok, false);
  if (!partialReplay.ok) assert.equal(partialReplay.error.code, "QC_CANDIDATE_MISMATCH");
  assert.deepEqual(readFileSync(ledgerPath), beforeReplay);

  const conflict = evaluation(rig, pass.roundId, "FAIL", [
    { code: "DIRTY", severity: "BLOCKER", message: "deterministic dirty result" },
  ]);
  const rejected = await rig.qc.runFresh({
    roundId: conflict.roundId,
    candidate: rig.snapshot,
    canonicalReview: rig.canonical,
    evaluation: conflict,
  });
  assert.equal(rejected.ok, false);
  if (!rejected.ok) assert.equal(rejected.error.code, "QC_ROUND_ID_CONFLICT");
  assert.deepEqual(readFileSync(ledgerPath), beforeReplay);
});

requiredTest("exact replay heals torn round ledger while malformed and conflicting ledgers fail", async (context) => {
  const bookId = "qc-torn-round-book";
  const rig = await setup(context, bookId);
  const pass = evaluation(rig, "round-torn", "PASS");
  const created = await rig.qc.runFresh({
    roundId: pass.roundId,
    candidate: rig.snapshot,
    canonicalReview: rig.canonical,
    evaluation: pass,
  });
  assert.equal(created.ok, true);
  const qcRoot = join(context.roots.booksRoot, bookId, "qc");
  const roundPath = join(qcRoot, `${pass.roundId}.json`);
  const ledgerPath = join(qcRoot, "ledger.jsonl");
  const roundBytes = readFileSync(roundPath);

  unlinkSync(ledgerPath);
  const pureMissing = await rig.qc.readStatus(bookId);
  assert.equal(pureMissing.ok, false);
  if (!pureMissing.ok) assert.equal(pureMissing.error.code, "QC_LEDGER_MISSING");
  assert.equal(existsSync(ledgerPath), false, "pure status read must not heal torn persistence");

  const healed = await rig.qc.runFresh({
    roundId: pass.roundId,
    candidate: rig.snapshot,
    canonicalReview: rig.canonical,
    evaluation: pass,
  });
  assert.deepEqual(healed, created);
  assert.deepEqual(readFileSync(roundPath), roundBytes, "healing must not replace equivalent round bytes");
  assert.equal(existsSync(ledgerPath), true);
  const healedLedger = readFileSync(ledgerPath);
  const status = await rig.qc.readStatus(bookId);
  assert.equal(status.ok, true);
  assert.ok(status.ok);
  assert.equal(status.value.ledgerRevision, 1);
  assert.deepEqual(status.value.issues, []);

  appendFileSync(ledgerPath, "{malformed-replay-ledger\n", "utf8");
  const malformed = await rig.qc.runFresh({
    roundId: pass.roundId,
    candidate: rig.snapshot,
    canonicalReview: rig.canonical,
    evaluation: pass,
  });
  assert.equal(malformed.ok, false);
  if (!malformed.ok) assert.equal(malformed.error.code, "QC_LEDGER_MALFORMED");
  assert.deepEqual(readFileSync(roundPath), roundBytes);

  const conflictingEvent = JSON.parse(healedLedger.toString("utf8")) as { round: { outcome: string } };
  conflictingEvent.round.outcome = "FAIL";
  const conflictingLedger = Buffer.from(`${JSON.stringify(conflictingEvent)}\n`, "utf8");
  writeFileSync(ledgerPath, conflictingLedger);
  const conflicting = await rig.qc.runFresh({
    roundId: pass.roundId,
    candidate: rig.snapshot,
    canonicalReview: rig.canonical,
    evaluation: pass,
  });
  assert.equal(conflicting.ok, false);
  if (!conflicting.ok) assert.equal(conflicting.error.code, "QC_ROUND_ID_CONFLICT");
  assert.deepEqual(readFileSync(roundPath), roundBytes);
  assert.deepEqual(readFileSync(ledgerPath), conflictingLedger);

  const equivalentEvent = JSON.parse(healedLedger.toString("utf8")) as { revision: number; round: { outcome: string } };
  const duplicateOrders = [
    { name: "equivalent then conflicting", events: [equivalentEvent, conflictingEvent] },
    { name: "conflicting then equivalent", events: [conflictingEvent, equivalentEvent] },
  ] as const;
  for (const duplicate of duplicateOrders) {
    const events = duplicate.events.map((event, index) => ({ ...event, revision: index + 1 }));
    const duplicateLedger = Buffer.from(`${events.map((event) => JSON.stringify(event)).join("\n")}\n`, "utf8");
    writeFileSync(ledgerPath, duplicateLedger);
    const rejectedDuplicate = await rig.qc.runFresh({
      roundId: pass.roundId,
      candidate: rig.snapshot,
      canonicalReview: rig.canonical,
      evaluation: pass,
    });
    assert.equal(rejectedDuplicate.ok, false, duplicate.name);
    if (!rejectedDuplicate.ok) assert.equal(rejectedDuplicate.error.code, "QC_ROUND_ID_CONFLICT", duplicate.name);
    assert.deepEqual(readFileSync(roundPath), roundBytes, duplicate.name);
    assert.deepEqual(readFileSync(ledgerPath), duplicateLedger, duplicate.name);
  }

  writeFileSync(ledgerPath, healedLedger);
  assert.equal((await rig.qc.readStatus(bookId)).ok, true);
});

requiredTest("QC identity mismatch writes zero bytes", async (context) => {
  const bookId = "qc-mismatch-book";
  const rig = await setup(context, bookId);
  const pass = evaluation(rig, "round-initial", "PASS");
  const initial = await rig.qc.runFresh({ roundId: pass.roundId, candidate: rig.snapshot, canonicalReview: rig.canonical, evaluation: pass });
  assert.equal(initial.ok, true);
  const qcRoot = join(context.roots.booksRoot, bookId, "qc");
  const ledgerPath = join(qcRoot, "ledger.jsonl");
  const beforeBytes = readFileSync(ledgerPath);
  const beforeNames = readdirSync(qcRoot).sort();

  const cases = [
    {
      name: "round",
      roundId: "round-request",
      canonical: rig.canonical,
      evaluation: evaluation(rig, "round-evaluation", "PASS"),
    },
    {
      name: "candidate",
      roundId: "round-candidate",
      canonical: rig.canonical,
      evaluation: { ...evaluation(rig, "round-candidate", "PASS"), candidate: { ...pass.candidate, manifestDigest: "wrong-digest" } },
    },
    {
      name: "review",
      roundId: "round-review",
      canonical: rig.canonical,
      evaluation: { ...evaluation(rig, "round-review", "PASS"), reviewId: "wrong-review" },
    },
    {
      name: "canonical outcome",
      roundId: "round-canonical",
      canonical: { ...rig.canonical, outcome: "FAIL" as const },
      evaluation: evaluation(rig, "round-canonical", "PASS"),
    },
  ];
  for (const item of cases) {
    const result = await rig.qc.runFresh({
      roundId: item.roundId,
      candidate: rig.snapshot,
      canonicalReview: item.canonical,
      evaluation: item.evaluation,
    });
    assert.equal(result.ok, false, item.name);
    assert.deepEqual(readFileSync(ledgerPath), beforeBytes, item.name);
    assert.deepEqual(readdirSync(qcRoot).sort(), beforeNames, item.name);
  }
});

requiredTest("FAIL diagnosis is exact while PASS ERROR missing and stale rounds cannot diagnose", async (context) => {
  const bookId = "qc-diagnosis-book";
  const rig = await setup(context, bookId);
  const failIssues: QcIssue[] = [
    { code: "QC_DIRTY", severity: "BLOCKER", message: "chapter requires repair", location: "chapters/ch01.md" },
  ];
  const failOne = evaluation(rig, "round-fail-one", "FAIL", failIssues);
  const failTwo = evaluation(rig, "round-fail-two", "FAIL", failIssues);
  const pass = evaluation(rig, "round-pass", "PASS");
  const error = evaluation(rig, "round-error", "ERROR", [
    { code: "QC_EVALUATOR_ERROR", severity: "BLOCKER", message: "evaluator unavailable" },
  ]);
  for (const item of [failOne, failTwo, pass, error]) {
    const stored = await rig.qc.runFresh({ roundId: item.roundId, candidate: rig.snapshot, canonicalReview: rig.canonical, evaluation: item });
    assert.equal(stored.ok, true, item.roundId);
  }
  const storedError = await rig.qc.getRound(bookId, error.roundId);
  assert.equal(storedError.ok, true);
  assert.ok(storedError.ok);
  assert.equal(storedError.value.outcome, "ERROR");
  const status = await rig.qc.readStatus(bookId);
  assert.equal(status.ok, true);
  assert.ok(status.ok);
  assert.ok(status.value.issues.some((issue) => issue.severity === "BLOCKER"));

  const diagnosis = await rig.qc.diagnose(bookId, failOne.roundId);
  assert.equal(diagnosis.ok, true);
  assert.ok(diagnosis.ok);
  assert.equal(diagnosis.value.roundId, failOne.roundId);
  assert.deepEqual(diagnosis.value.candidate, failOne.candidate);
  assert.deepEqual(diagnosis.value.issues, failIssues);

  for (const roundId of [pass.roundId, error.roundId]) {
    const denied = await rig.qc.diagnose(bookId, roundId);
    assert.equal(denied.ok, false, roundId);
    if (!denied.ok) assert.equal(denied.error.code, "QC_DIAGNOSIS_NOT_ALLOWED", roundId);
  }
  const missing = await rig.qc.diagnose(bookId, "round-missing");
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.equal(missing.error.code, "QC_ROUND_NOT_FOUND");

  const candidateRoot = candidatePaths(context.roots.booksRoot, bookId, rig.candidateId).contentRoot;
  writeFileSync(contentPath(candidateRoot, INVENTORY[0].logicalPath), "# Mutated after round\n");
  const stale = await rig.qc.diagnose(bookId, failTwo.roundId);
  assert.equal(stale.ok, false);
  if (!stale.ok) assert.equal(stale.error.code, "QC_DIAGNOSIS_STALE");
});

requiredTest("diagnosis authority checks every same-round ledger event independent of order", async (context) => {
  const scenarios = [
    { name: "single exact FAIL", events: ["EXACT"], allowed: true },
    { name: "all-equivalent duplicates", events: ["EXACT", "EXACT"], allowed: true },
    { name: "equivalent then conflicting", events: ["EXACT", "CONFLICT"], allowed: false },
    { name: "conflicting then equivalent", events: ["CONFLICT", "EXACT"], allowed: false },
  ] as const;
  for (let index = 0; index < scenarios.length; index += 1) {
    const scenario = scenarios[index];
    const bookId = `qc-diagnosis-authority-${index + 1}`;
    const rig = await setup(context, bookId);
    const issues: QcIssue[] = [
      { code: "QC_DIRTY", severity: "BLOCKER", message: "chapter requires repair" },
    ];
    const fail = evaluation(rig, "round-diagnosis-authority", "FAIL", issues);
    const stored = await rig.qc.runFresh({
      roundId: fail.roundId,
      candidate: rig.snapshot,
      canonicalReview: rig.canonical,
      evaluation: fail,
    });
    assert.equal(stored.ok, true, scenario.name);

    const qcRoot = join(context.roots.booksRoot, bookId, "qc");
    const ledgerPath = join(qcRoot, "ledger.jsonl");
    const roundPath = join(qcRoot, `${fail.roundId}.json`);
    type MutableRoundEvent = {
      schemaVersion: "1";
      kind: "ROUND";
      revision: number;
      round: { outcome: "PASS" | "FAIL" | "ERROR" };
    };
    const exactEvent = JSON.parse(readFileSync(ledgerPath, "utf8")) as MutableRoundEvent;
    const conflictingEvent = JSON.parse(readFileSync(ledgerPath, "utf8")) as MutableRoundEvent;
    conflictingEvent.round.outcome = "ERROR";
    const events = scenario.events.map((kind, eventIndex) => ({
      ...(kind === "EXACT" ? exactEvent : conflictingEvent),
      revision: eventIndex + 1,
    }));
    const ledgerBytes = Buffer.from(`${events.map((event) => JSON.stringify(event)).join("\n")}\n`, "utf8");
    writeFileSync(ledgerPath, ledgerBytes);

    const roundBytes = readFileSync(roundPath);
    const qcNames = readdirSync(qcRoot).sort();
    const idsBefore = context.ids.report();
    const diagnosis = await rig.qc.diagnose(bookId, fail.roundId);
    if (scenario.allowed) {
      assert.equal(diagnosis.ok, true, scenario.name);
      assert.ok(diagnosis.ok);
      assert.equal(diagnosis.value.roundId, fail.roundId, scenario.name);
      assert.deepEqual(diagnosis.value.candidate, fail.candidate, scenario.name);
      assert.deepEqual(diagnosis.value.issues, issues, scenario.name);
    } else {
      assert.equal(diagnosis.ok, false, scenario.name);
      if (!diagnosis.ok) assert.equal(diagnosis.error.code, "QC_DIAGNOSIS_STALE", scenario.name);
      assert.deepEqual(readFileSync(ledgerPath), ledgerBytes, scenario.name);
      assert.deepEqual(readFileSync(roundPath), roundBytes, scenario.name);
      assert.deepEqual(readdirSync(qcRoot).sort(), qcNames, scenario.name);
      assert.deepEqual(context.ids.report(), idsBefore, scenario.name);
    }
  }
});

finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
