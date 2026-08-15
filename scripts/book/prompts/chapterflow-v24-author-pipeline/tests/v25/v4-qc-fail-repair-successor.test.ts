/**
 * The fresh-QC FAIL -> repair lane's SUCCESSOR walk.
 *
 * OBSERVED WEDGE (live canary). The book reached its first canonical review
 * PASS, executed fresh QC for the first time, and QC returned FAIL — correct,
 * and the FAIL routed into repair. Then every operator round after that printed
 * the identical three lines and died:
 *
 *     fresh-qc  COMPLETED  outcome=FAIL;roundId=qc-9089069490bcbde1…
 *     repair    STARTED    failedRoundId=qc-9089069490bcbde1…
 *     repair    FAILED     repair run is FAILED
 *
 * `CandidateRepairApplicationPort.run` refuses a repair run that is already
 * terminal and non-COMPLETED (REPAIR_RUN_TERMINAL). The QC lane handed it ONE
 * fixed run id, `derivedId("repair-run", runId)`, so the first repair that ended
 * FAILED froze the book permanently: every resume re-created the same id, read
 * the same immutable FAILED record, and died one step before promotion. There
 * was no successor.
 *
 * These cases pin the fix — the same successor machinery the fresh-qc judge
 * (#485) and the compiler operator-retry slots already have: walk ordinals to a
 * small cap, execute under the first free one, and derive EVERY id the
 * transition owns from the chosen ordinal. What must NOT change is also pinned:
 * the cap fails closed with its own number in the message, a COMPLETED-and-
 * SUCCESSFUL ordinal short-circuits with zero new model calls, and operator
 * intent (CANCELLED) is never walked past.
 *
 * SECOND WEDGE (disclosed by the first fix, not fixed by it). Walking only
 * FAILED left the COMMON case wedged: a repair that COMPLETES while its own
 * fresh QC still returns FAIL is recorded REPAIR_UNSUCCESSFUL, and its RUN is
 * COMPLETED. The walk stopped there, the port short-circuited to a successor
 * already known unsuccessful, and every operator round got the identical
 * REPAIR_DIAGNOSIS_REQUIRED. An ordinal is now spent when it is FAILED **or**
 * when its own DURABLE fresh QC round did not PASS — the same record the port
 * derives REPAIR_UNSUCCESSFUL from, read, never re-run.
 */

import assert from "node:assert/strict";

import { buildBookRunHarness, derivedIdOf } from "./bookRunRepairRig.js";
import { finishV25Tests, requiredTest, type TestContext } from "./harness.js";

/** Mirrors MAX_QC_REPAIR_RUNS in bookRunApplicationService (base + 2). */
const EXPECTED_CAP = 3;

requiredTest("a FAILED qc-repair run no longer wedges the book: the next round executes under a fresh successor ordinal", async (context: TestContext) => {
  const book = "qc-repair-wedge";
  const h = await buildBookRunHarness(context, book, ["PASS"], {
    qcOutcomes: ["FAIL"],
    promoteLocal: false,
  });
  // The durable shape an earlier operator round left behind.
  await h.seedQcRepairRun("repair", "FAILED");

  const result = await h.service.run({ ...h.request });
  if (!result.ok) throw new Error(`a FAILED repair run must not wedge the book: ${JSON.stringify(result.error)}`);
  assert.equal(result.value.status, "READY");

  // The repair executed under the SUCCESSOR ordinal, not the spent base id.
  assert.equal(h.qcRepairCalls().length, 1, JSON.stringify(h.qcRepairCalls()));
  const request = h.qcRepairCalls()[0];
  assert.equal(request.repairRunId, h.qcRepairRunId("repair-r2"), "the walk must skip the FAILED base ordinal");
  assert.notEqual(request.repairRunId, h.qcRepairRunId("repair"));

  // EVERY id the transition owns is ordinal-scoped, not just the run id: the
  // port binds its stored successor to `manifest.createdByRunId === repairRunId`
  // and joins the review/round/history records by these exact ids, so scoping
  // only the run would trade one wedge for a REPAIR_COMPLETED_MISMATCH.
  assert.equal(request.repairId, derivedIdOf("repair-r2", h.bookRunId));
  assert.equal(request.successorCandidateId, derivedIdOf("repair-r2-candidate", h.bookRunId));
  assert.equal(request.reviewId, derivedIdOf("repair-r2-review", h.bookRunId));
  assert.equal(request.freshRoundId, derivedIdOf("repair-r2-qc", h.bookRunId));
  assert.ok(request.attemptRoot.endsWith("repair-r2"), request.attemptRoot);

  // The dead predecessor is left exactly as the operator found it.
  const base = await h.runStore.readRun(book, h.qcRepairRunId("repair"), context.clock.now());
  assert.ok(base.ok);
  assert.equal(base.value.status, "FAILED", "the walk abandons nothing and rewrites nothing");

  // Operator-visible: the phase log names the ordinal that actually ran.
  assert.ok(
    h.events.some((event) => event.phase === "repair" && event.status === "STARTED" && event.detail?.includes("label=repair-r2")),
    JSON.stringify(h.events.filter((event) => event.phase === "repair").map((event) => [event.status, event.detail])),
  );
});

requiredTest("a COMPLETED qc-repair run short-circuits on resume: no double repair, no new ordinal, zero new model calls", async (context: TestContext) => {
  const book = "qc-repair-idempotent";
  const h = await buildBookRunHarness(context, book, ["PASS"], {
    qcOutcomes: ["FAIL"],
    promoteLocal: false,
  });

  const first = await h.service.run({ ...h.request });
  if (!first.ok) throw new Error(`the first repair must converge: ${JSON.stringify(first.error)}`);
  assert.equal(h.qcRepairModelCalls(), 1, "the first round does the repair work");
  assert.equal(h.qcRepairCalls()[0].repairRunId, h.qcRepairRunId("repair"), "an unseeded book uses the historical base id");
  const completed = await h.runStore.readRun(book, h.qcRepairRunId("repair"), context.clock.now());
  assert.ok(completed.ok);
  assert.equal(completed.value.status, "COMPLETED");
  const reviewsAfterFirst = h.reviewCalls();

  const resumed = await h.service.run({ ...h.request, resumeRunId: h.bookRunId });
  if (!resumed.ok) throw new Error(`the resume must replay, not re-repair: ${JSON.stringify(resumed.error)}`);
  assert.equal(resumed.value.status, "READY");
  assert.equal(h.qcRepairModelCalls(), 1, "a COMPLETED repair run must cost ZERO new model calls on resume");
  assert.equal(h.reviewCalls(), reviewsAfterFirst, "a resume must replay stored reviews, not re-run the panel");
  assert.equal(h.qcRepairCalls().length, 2);
  assert.equal(
    h.qcRepairCalls()[1].repairRunId,
    h.qcRepairRunId("repair"),
    "a COMPLETED ordinal is the answer, not a reason to mint the next one",
  );
  const noSuccessor = await h.runStore.readRun(book, h.qcRepairRunId("repair-r2"), context.clock.now());
  assert.equal(noSuccessor.ok, false, "no -r2 run is minted once an ordinal has COMPLETED");
  assert.equal(resumed.value.candidate.candidateId, first.value.candidate.candidateId, "the same durable successor is re-read");
});

requiredTest("a COMPLETED-but-UNSUCCESSFUL qc-repair ordinal is NOT walked past: the designed REPAIR_DIAGNOSIS_REQUIRED escalation survives, naming the ordinal's own round", async (context: TestContext) => {
  const book = "qc-repair-unsuccessful";
  const h = await buildBookRunHarness(context, book, ["PASS"], {
    qcOutcomes: ["FAIL"],
    promoteLocal: false,
  });
  // The COMMON outcome of a repair round: the repair ran, staged its successor,
  // the successor was reviewed and re-QC'd — and that fresh QC still returned
  // FAIL. This is the pipeline's DESIGNED diagnosis escalation, not a wedge:
  // the forward path is qc-diagnose on the named round, then a CHAINED repair
  // of that successor (the port's priorUnsuccessful gate demands the
  // diagnosisId exactly there). An earlier draft of the walk skipped this
  // ordinal and minted a fresh repair of the ORIGINAL candidate with NO
  // diagnosis — bypassing the gate and orphaning the successor. Adversarial
  // review rejected it; this test pins the escalation so a future walk cannot
  // silently bulldoze it again.
  await h.seedCompletedQcRepair("repair", "FAIL");

  const result = await h.service.run({ ...h.request });
  assert.equal(result.ok, false, "an unsuccessful repair must escalate, not silently re-repair");
  if (result.ok) throw new Error("unreachable");
  assert.equal(result.error.code, "REPAIR_DIAGNOSIS_REQUIRED");
  assert.match(result.error.message, /qc-diagnose /, "the escalation names the operator action");
  assert.ok(
    result.error.message.includes(derivedIdOf("repair-qc", h.bookRunId)),
    `the escalation names the ordinal's OWN failed round: ${result.error.message}`,
  );

  // No new repair was minted: the walk stopped ON the completed ordinal and the
  // port replayed it (one call, the ordinal's own ids, zero fresh model work).
  assert.equal(h.qcRepairCalls().length, 1, JSON.stringify(h.qcRepairCalls()));
  assert.equal(h.qcRepairCalls()[0].repairRunId, h.qcRepairRunId("repair"));

  // Nothing about the ordinal is rewritten.
  const kept = await h.runStore.readRun(book, h.qcRepairRunId("repair"), context.clock.now());
  assert.ok(kept.ok);
  assert.equal(kept.value.status, "COMPLETED");
});

requiredTest("a COMPLETED-and-SUCCESSFUL qc-repair ordinal is still the answer: it short-circuits with ZERO model calls and mints no successor", async (context: TestContext) => {
  const book = "qc-repair-successful";
  const h = await buildBookRunHarness(context, book, ["PASS"], {
    qcOutcomes: ["FAIL"],
    promoteLocal: false,
  });
  // Same durable shape as the case above in every respect but the one that
  // decides: this ordinal's fresh QC PASSED.
  await h.seedCompletedQcRepair("repair", "PASS");

  const result = await h.service.run({ ...h.request });
  if (!result.ok) throw new Error(`a successful ordinal must be re-read, not re-run: ${JSON.stringify(result.error)}`);
  assert.equal(result.value.status, "READY");
  assert.equal(h.qcRepairCalls().length, 1);
  assert.equal(
    h.qcRepairCalls()[0].repairRunId,
    h.qcRepairRunId("repair"),
    "a PASSING ordinal is never walked past",
  );
  assert.equal(h.qcRepairModelCalls(), 0, "a COMPLETED-and-successful ordinal must cost ZERO model calls");
  assert.equal(
    result.value.candidate.candidateId,
    derivedIdOf("repair-candidate", h.bookRunId),
    "the durable successor of the completed ordinal is what the run carries forward",
  );
  const successor = await h.runStore.readRun(book, h.qcRepairRunId("repair-r2"), context.clock.now());
  assert.equal(successor.ok, false, "a successful ordinal must not mint the next one");
});

requiredTest("the qc-repair successor walk is BOUNDED: it fails closed with the cap named, and never re-enters a spent ordinal", async (context: TestContext) => {
  const book = "qc-repair-capped";
  const h = await buildBookRunHarness(context, book, ["PASS"], {
    qcOutcomes: ["FAIL"],
    promoteLocal: false,
  });
  for (const label of ["repair", "repair-r2", "repair-r3"]) {
    await h.seedQcRepairRun(label, "FAILED");
  }

  const result = await h.service.run({ ...h.request });
  assert.equal(result.ok, false, JSON.stringify(result));
  if (result.ok) throw new Error("an exhausted successor budget must fail closed, never loop");
  assert.equal(result.error.code, "BOOK_RUN_REPAIR_UNAVAILABLE");
  assert.ok(
    result.error.message.includes(String(EXPECTED_CAP)),
    `the cap must be named in the failure: ${result.error.message}`,
  );
  assert.equal(h.qcRepairCalls().length, 0, "an exhausted budget must not re-enter a spent repair run");
  const fourth = await h.runStore.readRun(book, h.qcRepairRunId("repair-r4"), context.clock.now());
  assert.equal(fourth.ok, false, "the walk must not mint an ordinal past the cap");
  assert.ok(
    h.events.some((event) => event.phase === "repair" && event.status === "FAILED" && event.detail?.includes(String(EXPECTED_CAP))),
    JSON.stringify(h.events.filter((event) => event.phase === "repair").map((event) => [event.status, event.detail])),
  );
});

requiredTest("an operator-CANCELLED qc-repair run is never walked past: cancellation is intent, not a dead ordinal", async (context: TestContext) => {
  const book = "qc-repair-cancelled";
  const h = await buildBookRunHarness(context, book, ["PASS"], {
    qcOutcomes: ["FAIL"],
    promoteLocal: false,
  });
  await h.seedQcRepairRun("repair", "CANCELLED");

  const result = await h.service.run({ ...h.request });
  assert.equal(result.ok, false, JSON.stringify(result));
  if (result.ok) throw new Error("a cancelled repair must not be silently retried under a successor");
  assert.equal(result.error.code, "REPAIR_CANCELLED");
  assert.equal(h.qcRepairCalls().length, 1);
  assert.equal(
    h.qcRepairCalls()[0].repairRunId,
    h.qcRepairRunId("repair"),
    "the cancelled ordinal is handed straight back to the port, which answers REPAIR_CANCELLED",
  );
  const successor = await h.runStore.readRun(book, h.qcRepairRunId("repair-r2"), context.clock.now());
  assert.equal(successor.ok, false, "operator intent must never mint a successor");
});

requiredTest("a repair that FAILS its own ordinal leaves a successor available to the NEXT operator round", async (context: TestContext) => {
  const book = "qc-repair-nextround";
  const h = await buildBookRunHarness(context, book, ["PASS"], {
    qcOutcomes: ["FAIL"],
    qcRepairFails: "REPAIR_MODEL_FAILED",
    promoteLocal: false,
  });

  // Round one: the repair does its own terminal write, exactly as the port does.
  const first = await h.service.run({ ...h.request });
  assert.equal(first.ok, false, JSON.stringify(first));
  if (first.ok) throw new Error("a failed repair must not promote");
  assert.equal(first.error.code, "REPAIR_MODEL_FAILED");
  const base = await h.runStore.readRun(book, h.qcRepairRunId("repair"), context.clock.now());
  assert.ok(base.ok);
  assert.equal(base.value.status, "FAILED");

  // Round two — the operator simply runs again. THIS is the wedge: before the
  // walk, this second call died REPAIR_RUN_TERMINAL and did so forever.
  const second = await h.service.run({ ...h.request, resumeRunId: h.bookRunId });
  assert.equal(second.ok, false, JSON.stringify(second));
  if (second.ok) throw new Error("the scripted repair still fails; only the RUN ID should move");
  assert.notEqual(second.error.code, "REPAIR_RUN_TERMINAL", "a spent repair run must never be the book's terminal answer");
  assert.equal(second.error.code, "REPAIR_MODEL_FAILED", "round two reaches the repair itself, not its predecessor's tombstone");
  assert.equal(h.qcRepairCalls()[1].repairRunId, h.qcRepairRunId("repair-r2"));
});

requiredTest("the review-repair operator line reports the RESOLVED cap, not the compiled-in constant", async (context: TestContext) => {
  const saved = process.env.CHAPTERFLOW_REVIEW_REPAIR_ROUNDS;
  const savedError = console.error;
  const lines: string[] = [];
  try {
    // An override of 3 with the default constant of 2: the loop honours 3, and
    // the line the operator watches used to interpolate the CONSTANT — printing
    // "round=3/2", under-reporting the very limit it is reporting.
    process.env.CHAPTERFLOW_REVIEW_REPAIR_ROUNDS = "3";
    console.error = (...args: unknown[]) => { lines.push(args.map(String).join(" ")); };
    const h = await buildBookRunHarness(context, "qc-repair-caplog", ["FAIL", "PASS"], { promoteLocal: false });
    const result = await h.service.run({ ...h.request });
    console.error = savedError;
    if (!result.ok) throw new Error(`the override run must converge: ${JSON.stringify(result.error)}`);
    const reviewRepairLines = lines.filter((line) => line.includes("[book-run] review-repair"));
    assert.equal(reviewRepairLines.length, 1, JSON.stringify(lines));
    assert.ok(reviewRepairLines[0].includes("round=1/3"), reviewRepairLines[0]);
    assert.ok(!reviewRepairLines[0].includes("round=1/2"), reviewRepairLines[0]);
  } finally {
    console.error = savedError;
    if (saved === undefined) delete process.env.CHAPTERFLOW_REVIEW_REPAIR_ROUNDS;
    else process.env.CHAPTERFLOW_REVIEW_REPAIR_ROUNDS = saved;
  }
});

finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
