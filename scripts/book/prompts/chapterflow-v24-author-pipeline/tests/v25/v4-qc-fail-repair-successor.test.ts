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

/**
 * THIRD WEDGE — a REVIEW ERROR is not a verdict, so it must not spend an ordinal.
 *
 * OBSERVED LIVE (cf-canary, Franklin `book-run-d7e690f9`): `repair-r3` REPAIRED
 * its chapter, then its re-review came back `outcome: ERROR` (a reader seat's
 * schema-invalid output fail-closed the panel). The workflow returned
 * REPAIR_REVIEW_FAILED, the port wrote the repair run FAILED, and this walk —
 * which cannot tell "the book was judged and lost" from "the judge never
 * showed up" — skipped it as SPENT. That was the THIRD and last of
 * MAX_QC_REPAIR_RUNS, so the book wedged at the diagnosis gate with a repaired,
 * unjudged successor sitting on disk.
 *
 * `contentRepairWorkflow` now re-reviews the SAME staged successor inside the
 * run (bounded, fresh review ids) and, only if every attempt flakes, fails with
 * the DISTINCT reason `REPAIR_REVIEW_ERROR:` — a run-state terminal reason this
 * walk recognizes. Such an ordinal is still WALKED PAST (run state is terminal;
 * a dead run id can never be re-entered) but it no longer COSTS the book one of
 * its repair rounds: it extends the walk by one instead, bounded by
 * MAX_FORGIVEN_INFRA_ORDINALS so infrastructure noise cannot mint ids forever.
 * Every other FAILED reason is spent exactly as before.
 */
requiredTest("a qc-repair ordinal lost to a REVIEW ERROR does not spend the budget: the walk extends past it and the repair still runs", async (context: TestContext) => {
  const book = "qc-repair-review-error";
  const h = await buildBookRunHarness(context, book, ["PASS"], {
    qcOutcomes: ["FAIL"],
    promoteLocal: false,
  });
  // Exactly the live shape: the whole cap already burned, and the LAST of them
  // died of a review that never produced a verdict.
  await h.seedQcRepairRun("repair", "FAILED");
  await h.seedQcRepairRun("repair-r2", "FAILED");
  await h.seedQcRepairRun(
    "repair-r3",
    "FAILED",
    "REPAIR_REVIEW_ERROR:canonical review errored on all 3 bounded attempts of the same staged successor candidate-x; no verdict was produced",
  );

  const result = await h.service.run({ ...h.request });
  if (!result.ok) throw new Error(`an infra-lost ordinal must not exhaust the repair budget: ${JSON.stringify(result.error)}`);
  assert.equal(result.value.status, "READY");
  // The forgiven ordinal bought exactly one more: the repair executed under r4.
  assert.equal(h.qcRepairCalls().length, 1, JSON.stringify(h.qcRepairCalls()));
  assert.equal(h.qcRepairCalls()[0].repairRunId, h.qcRepairRunId("repair-r4"));
  // Nothing about the dead ordinals was rewritten.
  const flaked = await h.runStore.readRun(book, h.qcRepairRunId("repair-r3"), context.clock.now());
  assert.ok(flaked.ok);
  assert.equal(flaked.value.status, "FAILED", "the walk abandons nothing and rewrites nothing");
});

requiredTest("forgiveness is BOUNDED: once MAX_FORGIVEN_INFRA_ORDINALS review-ERROR ordinals are absorbed, the lane still fails closed with the cap named", async (context: TestContext) => {
  const book = "qc-repair-review-error-capped";
  const h = await buildBookRunHarness(context, book, ["PASS"], {
    qcOutcomes: ["FAIL"],
    promoteLocal: false,
  });
  const infraReason = "REPAIR_REVIEW_ERROR:canonical review errored on all 3 bounded attempts of the same staged successor candidate-x; no verdict was produced";
  // ORDER MATTERS (adversarial review caught the first version testing nothing):
  // the infra-lost ordinals come FIRST so forgiveness actually ENGAGES — both
  // forgivable slots absorb r1/r2 and raise the identity ceiling from 3 to 5 —
  // and THEN cap-many genuine failures (r3..r5) spend the whole budget. A third
  // infra flake at r6 must NOT be forgiven (bound is 2), so exhaustion is
  // reached with forgiveness maximally exercised.
  for (const label of ["repair", "repair-r2"]) await h.seedQcRepairRun(label, "FAILED", infraReason);
  for (const label of ["repair-r3", "repair-r4", "repair-r5"]) await h.seedQcRepairRun(label, "FAILED");
  await h.seedQcRepairRun("repair-r6", "FAILED", infraReason);

  const result = await h.service.run({ ...h.request });
  assert.equal(result.ok, false, JSON.stringify(result));
  if (result.ok) throw new Error("forgiveness must be bounded, never an unbounded ordinal mint");
  assert.equal(result.error.code, "BOOK_RUN_REPAIR_UNAVAILABLE");
  assert.ok(
    result.error.message.includes(String(EXPECTED_CAP)),
    `the cap must still be named in the failure: ${result.error.message}`,
  );
  assert.equal(h.qcRepairCalls().length, 0, "an exhausted budget must not re-enter a spent repair run");
});

requiredTest("CONTROL: an ordinal that died of a real repair failure is still SPENT — only a review ERROR is forgiven", async (context: TestContext) => {
  const book = "qc-repair-real-failure-spent";
  const h = await buildBookRunHarness(context, book, ["PASS"], {
    qcOutcomes: ["FAIL"],
    promoteLocal: false,
  });
  // The same shape as the forgiven case, except the last ordinal died of a REAL
  // repair failure. Byte-for-byte today's behaviour: budget exhausted.
  await h.seedQcRepairRun("repair", "FAILED");
  await h.seedQcRepairRun("repair-r2", "FAILED");
  await h.seedQcRepairRun("repair-r3", "FAILED", "REPAIR_MODEL_FAILED:repair model failed for chapter 1");

  const result = await h.service.run({ ...h.request });
  assert.equal(result.ok, false, JSON.stringify(result));
  if (result.ok) throw new Error("a real repair failure must still spend its ordinal");
  assert.equal(result.error.code, "BOOK_RUN_REPAIR_UNAVAILABLE");
  assert.equal(h.qcRepairCalls().length, 0);
  const fourth = await h.runStore.readRun(book, h.qcRepairRunId("repair-r4"), context.clock.now());
  assert.equal(fourth.ok, false, "no ordinal past the cap is minted for a real failure");
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

/**
 * ── THE CHAINED LADDER ───────────────────────────────────────────────────────
 *
 * THIRD WEDGE (the live canary's actual stopping point, and the reason the
 * escalation above was not enough on its own). The escalation named a round and
 * told the operator to run qc-diagnose. The operator ran it. A durable diagnosis
 * landed in `books/<id>/qc/diagnoses/`. And NOTHING COULD CONSUME IT: the
 * book-run built a repair request with no `diagnosisId` field at all, and the
 * only other diagnosis-accepting entry point (`runBookAutopilot`'s
 * `--content-repair-canary`) was unreachable dead code. Every later operator
 * round replayed the same COMPLETED-but-unsuccessful ordinal and printed the
 * same REPAIR_DIAGNOSIS_REQUIRED, forever.
 *
 * The forward path the port was always built for is a CHAIN: ordinal N+1
 * repairs ordinal N's SUCCESSOR, against ordinal N's OWN fresh round, citing the
 * diagnosis of exactly that round+candidate — which is precisely the request
 * shape `priorUnsuccessful` (candidateRepairApplicationPort.ts:386-390) detects
 * and demands a diagnosisId for. These cases pin that the book-run now builds
 * it, and — just as importantly — that it does NOT build it from a diagnosis of
 * the wrong round or the wrong candidate.
 */

requiredTest("a durable diagnosis for an unsuccessful ordinal's OWN round CHAINS the repair forward: ordinal 2 repairs ordinal 1's successor and cites the diagnosis", async (context: TestContext) => {
  const book = "qc-repair-chained";
  const h = await buildBookRunHarness(context, book, ["PASS"], {
    qcOutcomes: ["FAIL"],
    promoteLocal: false,
  });
  await h.seedCompletedQcRepair("repair", "FAIL");
  const failedSuccessor = await h.successorIdentity("repair");
  const diagnosis = await h.seedDiagnosis("repair");

  const result = await h.service.run({ ...h.request });
  if (!result.ok) throw new Error(`a diagnosed unsuccessful ordinal must chain, not escalate: ${JSON.stringify(result.error)}`);
  assert.equal(result.value.status, "READY");

  assert.equal(h.qcRepairCalls().length, 2, JSON.stringify(h.qcRepairCalls().map((call) => call.repairRunId)));
  // Call one is the REPLAY of ordinal 1 — no diagnosis, because ordinal 1
  // repaired the original candidate against the original failed round.
  assert.equal(h.qcRepairCalls()[0].repairRunId, h.qcRepairRunId("repair"));
  assert.equal(h.qcRepairCalls()[0].diagnosisId, undefined, "the replay of ordinal 1 must not acquire a diagnosis it never had");

  // Call two is the CHAINED link, and every field says so.
  const chained = h.qcRepairCalls()[1];
  assert.deepEqual(
    chained.failedCandidate,
    failedSuccessor,
    "the chain repairs ordinal 1's SUCCESSOR — repairing the ORIGINAL candidate again is the rejected draft",
  );
  assert.notEqual(
    chained.failedCandidate.candidateId,
    `${derivedIdOf("compiler-run", h.bookRunId)}-candidate`,
    "the chained repair must not re-target the compiled candidate",
  );
  assert.equal(chained.failedRoundId, derivedIdOf("repair-qc", h.bookRunId), "the chain is anchored on ordinal 1's OWN fresh round");
  assert.equal(chained.diagnosisId, diagnosis.diagnosisId, "the port's priorUnsuccessful gate is SATISFIED, not bypassed");

  // EVERY id derives from the ordinal-2 label, exactly as the walk requires.
  assert.equal(chained.repairRunId, h.qcRepairRunId("repair-r2"));
  assert.equal(chained.repairId, derivedIdOf("repair-r2", h.bookRunId));
  assert.equal(chained.successorCandidateId, derivedIdOf("repair-r2-candidate", h.bookRunId));
  assert.equal(chained.reviewId, derivedIdOf("repair-r2-review", h.bookRunId));
  assert.equal(chained.freshRoundId, derivedIdOf("repair-r2-qc", h.bookRunId));
  assert.ok(chained.attemptRoot.endsWith("repair-r2"), chained.attemptRoot);

  // The run carries ordinal 2's successor forward, not ordinal 1's.
  assert.equal(result.value.candidate.candidateId, derivedIdOf("repair-r2-candidate", h.bookRunId));

  // Operator-visible: the STARTED event for the chained link names the
  // diagnosis that authorized it and the ordinal it is chained from.
  const started = h.events
    .filter((event) => event.phase === "repair" && event.status === "STARTED")
    .map((event) => event.detail ?? "");
  assert.ok(
    started.some((detail) => (
      detail.includes("label=repair-r2")
      && detail.includes(`diagnosisId=${diagnosis.diagnosisId}`)
      && detail.includes("predecessorLabel=repair")
      && detail.includes(`failedRoundId=${derivedIdOf("repair-qc", h.bookRunId)}`)
    )),
    JSON.stringify(started),
  );
  // Ordinal 1's own STARTED event is unchanged — no diagnosis, no predecessor.
  assert.ok(started.some((detail) => detail.endsWith("label=repair")), JSON.stringify(started));
});

requiredTest("the chain is BOUNDED: an unsuccessful ordinal 2 with no diagnosis of its own escalates naming ORDINAL 2's round, not ordinal 1's", async (context: TestContext) => {
  const book = "qc-repair-chain-stop";
  const h = await buildBookRunHarness(context, book, ["PASS"], {
    qcOutcomes: ["FAIL"],
    promoteLocal: false,
  });
  await h.seedCompletedQcRepair("repair", "FAIL");
  await h.seedDiagnosis("repair");
  // The chain already advanced once and the second link ALSO came back
  // unsuccessful. There is no diagnosis for it, so the ladder stops exactly the
  // way it stops at link one.
  await h.seedCompletedQcRepair("repair-r2", "FAIL", { parentLabel: "repair", completedUnderDiagnosisId: "diagnosis-repair" });

  const result = await h.service.run({ ...h.request });
  assert.equal(result.ok, false, JSON.stringify(result));
  if (result.ok) throw new Error("an undiagnosed link must escalate, never chain on");
  assert.equal(result.error.code, "REPAIR_DIAGNOSIS_REQUIRED");
  assert.ok(
    result.error.message.includes(derivedIdOf("repair-r2-qc", h.bookRunId)),
    `the escalation names the round that actually failed last: ${result.error.message}`,
  );
  assert.ok(
    !result.error.message.includes(derivedIdOf("repair-qc", h.bookRunId)),
    `a stale predecessor round must not be what the operator is told to diagnose: ${result.error.message}`,
  );
  assert.equal(h.qcRepairCalls().length, 2, JSON.stringify(h.qcRepairCalls().map((call) => call.repairRunId)));
  assert.equal(h.qcRepairModelCalls(), 0, "both links were replays; a stopped chain costs no model work");
  const third = await h.runStore.readRun(book, h.qcRepairRunId("repair-r3"), context.clock.now());
  assert.equal(third.ok, false, "an undiagnosed link must not mint the next ordinal");
});

requiredTest("a fully diagnosed chain still fails closed at the cap: every ordinal spent, the ceiling named, no ordinal past it", async (context: TestContext) => {
  const book = "qc-repair-chain-capped";
  const h = await buildBookRunHarness(context, book, ["PASS"], {
    qcOutcomes: ["FAIL"],
    promoteLocal: false,
  });
  // Three completed-but-unsuccessful links, each one diagnosed: the chain has
  // every authorization it could ask for and STILL must not run forever.
  await h.seedCompletedQcRepair("repair", "FAIL");
  await h.seedDiagnosis("repair");
  // Each chained link EXECUTED under its predecessor's diagnosis — the rig's
  // replay identity check (mirroring the port's record.diagnosisId equality)
  // must see the same choice the ladder re-derives, or the replay is a
  // mismatch, which is a DIFFERENT defect than the cap this test pins.
  await h.seedCompletedQcRepair("repair-r2", "FAIL", { parentLabel: "repair", completedUnderDiagnosisId: "diagnosis-repair" });
  await h.seedDiagnosis("repair-r2");
  await h.seedCompletedQcRepair("repair-r3", "FAIL", { parentLabel: "repair-r2", completedUnderDiagnosisId: "diagnosis-repair-r2" });
  await h.seedDiagnosis("repair-r3");

  const result = await h.service.run({ ...h.request });
  assert.equal(result.ok, false, JSON.stringify(result));
  if (result.ok) throw new Error("an exhausted chain must fail closed, never loop");
  assert.equal(result.error.code, "BOOK_RUN_REPAIR_UNAVAILABLE");
  assert.ok(
    result.error.message.includes(String(EXPECTED_CAP)),
    `the cap must be named in the failure: ${result.error.message}`,
  );
  assert.equal(h.qcRepairCalls().length, EXPECTED_CAP, JSON.stringify(h.qcRepairCalls().map((call) => call.repairRunId)));
  assert.deepEqual(
    h.qcRepairCalls().map((call) => call.repairRunId),
    ["repair", "repair-r2", "repair-r3"].map((label) => h.qcRepairRunId(label)),
    "the chain walks each ordinal exactly once, in order",
  );
  assert.equal(h.qcRepairModelCalls(), 0, "every link was a durable replay");
  const fourth = await h.runStore.readRun(book, h.qcRepairRunId("repair-r4"), context.clock.now());
  assert.equal(fourth.ok, false, "the chain must not mint an ordinal past the cap");
});

requiredTest("a diagnosis of the WRONG ROUND chains nothing: the escalation stands", async (context: TestContext) => {
  const book = "qc-repair-diag-wronground";
  const h = await buildBookRunHarness(context, book, ["PASS"], {
    qcOutcomes: ["FAIL"],
    promoteLocal: false,
  });
  await h.seedCompletedQcRepair("repair", "FAIL");
  // A real diagnosis of the ORIGINAL fresh-QC round — the operator diagnosed the
  // wrong thing (or an older round). It names the right candidate, so only the
  // round check can reject it.
  await h.seedDiagnosis("repair", {
    diagnosisId: "diagnosis-original-round",
    roundId: derivedIdOf("qc", h.bookRunId),
  });

  const result = await h.service.run({ ...h.request });
  assert.equal(result.ok, false, "a diagnosis of a different round authorizes nothing");
  if (result.ok) throw new Error("unreachable");
  assert.equal(result.error.code, "REPAIR_DIAGNOSIS_REQUIRED");
  assert.ok(
    result.error.message.includes(derivedIdOf("repair-qc", h.bookRunId)),
    `the escalation still names the round that must be diagnosed: ${result.error.message}`,
  );
  assert.equal(h.qcRepairCalls().length, 1, "no second ordinal is minted on a mismatched diagnosis");
  const successor = await h.runStore.readRun(book, h.qcRepairRunId("repair-r2"), context.clock.now());
  assert.equal(successor.ok, false, "a mismatched diagnosis must never mint a successor ordinal");
});

requiredTest("a diagnosis of the WRONG CANDIDATE chains nothing: the escalation stands", async (context: TestContext) => {
  const book = "qc-repair-diag-wrongcand";
  const h = await buildBookRunHarness(context, book, ["PASS"], {
    qcOutcomes: ["FAIL"],
    promoteLocal: false,
  });
  await h.seedCompletedQcRepair("repair", "FAIL");
  const successorIdentity = await h.successorIdentity("repair");
  // Right round, right candidate ID, STALE DIGEST — the successor was rebuilt
  // after the diagnosis was taken. Identity is the pair, and the pair is what
  // the port's gate compares, so this must not chain either.
  await h.seedDiagnosis("repair", {
    diagnosisId: "diagnosis-stale-digest",
    candidate: { candidateId: successorIdentity.candidateId, manifestDigest: "0".repeat(64) },
  });

  const result = await h.service.run({ ...h.request });
  assert.equal(result.ok, false, "a diagnosis of a different candidate authorizes nothing");
  if (result.ok) throw new Error("unreachable");
  assert.equal(result.error.code, "REPAIR_DIAGNOSIS_REQUIRED");
  assert.ok(
    result.error.message.includes(derivedIdOf("repair-qc", h.bookRunId)),
    `the escalation still names the round that must be diagnosed: ${result.error.message}`,
  );
  assert.equal(h.qcRepairCalls().length, 1, "no second ordinal is minted on a mismatched diagnosis");
});

requiredTest("a resume onto a COMPLETED chained ordinal replays it: zero new model calls, no duplicate successor, same candidate", async (context: TestContext) => {
  const book = "qc-repair-chain-resume";
  const h = await buildBookRunHarness(context, book, ["PASS"], {
    qcOutcomes: ["FAIL"],
    promoteLocal: false,
  });
  await h.seedCompletedQcRepair("repair", "FAIL");
  await h.seedDiagnosis("repair");

  const first = await h.service.run({ ...h.request });
  if (!first.ok) throw new Error(`the chained link must converge: ${JSON.stringify(first.error)}`);
  assert.equal(h.qcRepairModelCalls(), 1, "the chained link does the repair work exactly once");
  assert.equal(h.qcRepairCalls()[1].repairRunId, h.qcRepairRunId("repair-r2"));

  const resumed = await h.service.run({ ...h.request, resumeRunId: h.bookRunId });
  if (!resumed.ok) throw new Error(`the resume must replay the chain, not re-run it: ${JSON.stringify(resumed.error)}`);
  assert.equal(resumed.value.status, "READY");
  assert.equal(h.qcRepairModelCalls(), 1, "a resume onto a COMPLETED chained ordinal must cost ZERO new model calls");
  assert.equal(
    resumed.value.candidate.candidateId,
    first.value.candidate.candidateId,
    "the same durable chained successor is re-read",
  );
  // The diagnosis lookup is a READ: the resume re-derives the identical
  // chained request, which is what keeps the port's COMPLETED replay from
  // answering REPAIR_COMPLETED_MISMATCH on the recorded diagnosisId.
  assert.equal(h.qcRepairCalls().length, 4, JSON.stringify(h.qcRepairCalls().map((call) => call.repairRunId)));
  assert.deepEqual(
    h.qcRepairCalls().slice(2).map((call) => call.repairRunId),
    [h.qcRepairRunId("repair"), h.qcRepairRunId("repair-r2")],
    "the resume walks the same two ordinals and mints no third",
  );
  assert.equal(h.qcRepairCalls()[3].diagnosisId, h.qcRepairCalls()[1].diagnosisId, "the replayed link cites the identical diagnosis");
  const third = await h.runStore.readRun(book, h.qcRepairRunId("repair-r3"), context.clock.now());
  assert.equal(third.ok, false, "a resume must not mint a third ordinal");
});

requiredTest("two diagnoses for the SAME round and candidate are not a coin flip: the EARLIEST by createdAt chains — the only selection no later qc-diagnose can disturb", async (context: TestContext) => {
  const book = "qc-repair-diag-ambiguous";
  const h = await buildBookRunHarness(context, book, ["PASS"], {
    qcOutcomes: ["FAIL"],
    promoteLocal: false,
  });
  await h.seedCompletedQcRepair("repair", "FAIL");
  // The operator ran qc-diagnose twice on the same round. Both are durable, both
  // match. LATEST-selection was REJECTED in adversarial review as a permanent
  // wedge: qc-diagnose mints a fresh uuid per invocation, so "latest" moves
  // every time the operator re-diagnoses — a chained ordinal COMPLETED under
  // diagnosis A would replay with B selected and the port's identity check
  // (record.diagnosisId !== request.diagnosisId) answers
  // REPAIR_COMPLETED_MISMATCH forever. The store is append-only, so the
  // EARLIEST (createdAt, diagnosisId) match is the one choice that is stable
  // under any number of later diagnoses.
  const earlier = await h.seedDiagnosis("repair", { diagnosisId: "diagnosis-earlier", createdAt: "2026-01-01T00:00:00.000Z" });
  await h.seedDiagnosis("repair", { diagnosisId: "diagnosis-later", createdAt: "2026-01-02T00:00:00.000Z" });

  const result = await h.service.run({ ...h.request });
  if (!result.ok) throw new Error(`an ambiguous but valid diagnosis set must still chain: ${JSON.stringify(result.error)}`);
  assert.equal(h.qcRepairCalls().length, 2);
  assert.equal(h.qcRepairCalls()[1].diagnosisId, earlier.diagnosisId, "the earliest diagnosis wins — append-stable");

  const started = h.events
    .filter((event) => event.phase === "repair" && event.status === "STARTED")
    .map((event) => event.detail ?? "");
  assert.ok(
    started.some((detail) => (
      detail.includes("label=repair-r2")
      && detail.includes("diagnosisMatches=2")
      && detail.includes("diagnosisSelected=EARLIEST_BY_CREATED_AT")
      && detail.includes(`diagnosisId=${earlier.diagnosisId}`)
    )),
    `the operator must be able to see that two diagnoses matched: ${JSON.stringify(started)}`,
  );
});

requiredTest("a LATER qc-diagnose cannot wedge a COMPLETED chained ordinal: replay under an appended diagnosis still re-derives the recorded choice", async (context: TestContext) => {
  const book = "qc-repair-diag-append";
  const h = await buildBookRunHarness(context, book, ["PASS"], {
    qcOutcomes: ["FAIL"],
    promoteLocal: false,
  });
  await h.seedCompletedQcRepair("repair", "FAIL");
  const original = await h.seedDiagnosis("repair", { diagnosisId: "diagnosis-original", createdAt: "2026-01-01T00:00:00.000Z" });

  // First run chains ordinal 2 under the only diagnosis and completes it.
  const first = await h.service.run({ ...h.request });
  if (!first.ok) throw new Error(`the diagnosed chain must run: ${JSON.stringify(first.error)}`);
  assert.equal(h.qcRepairCalls()[1].diagnosisId, original.diagnosisId);
  const callsAfterFirst = h.qcRepairCalls().length;

  // The operator re-diagnoses AFTER the chain completed. Under latest-selection
  // this exact resume wedged with REPAIR_COMPLETED_MISMATCH (the replay request
  // named the new diagnosis while the durable record held the original) — the
  // defect adversarial review caught. Earliest-selection re-derives the
  // original choice: the appended diagnosis is durable but never selected.
  await h.seedDiagnosis("repair", { diagnosisId: "diagnosis-appended", createdAt: "2026-01-05T00:00:00.000Z" });
  const resumed = await h.service.run({ ...h.request, resumeRunId: h.bookRunId, reconcileUnsettled: true });
  if (!resumed.ok) throw new Error(`an appended diagnosis must not wedge the replay: ${JSON.stringify(resumed.error)}`);
  const replayCalls = h.qcRepairCalls().slice(callsAfterFirst);
  for (const call of replayCalls.filter((c) => c.repairRunId === h.qcRepairRunId("repair-r2"))) {
    assert.equal(call.diagnosisId, original.diagnosisId, "replay re-derives the RECORDED choice, never the newest");
  }
});

finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
