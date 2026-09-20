/**
 * Book-run service resilience — the wedges, the unbounded spends, and the
 * silent log.
 *
 * Every case here reproduces a state a LIVE run reached and could not leave:
 * a transient panel ERROR on a review-repair re-review with no successor path
 * (R-165), a fresh-QC ERROR that is terminal one lane over from the successor
 * built to fix exactly that (R-184), a canonical-review run left terminal
 * FAILED with no operator slot (R-186), a replayed repair ordinal recorded as
 * a completed rewrite (R-169), a budget typo discovered only after a whole
 * book had been paid for (R-177), and a single failed append to the audit log
 * discarding a run's completed model work (R-187).
 *
 * The bar every fix here holds to: nothing is forgiven silently. Each
 * successor is gated on per-invocation operator consent, each walk is bounded,
 * and exhaustion fails closed with the ceiling and its override named.
 */

import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  MAX_REVIEW_REPAIR_ORDINALS,
  resolveOperatorCompileRetries,
  resolveQcJudgeRuns,
  resolveReviewRepairOrdinals,
} from "../../src/app/bookRunApplicationService.js";
import { buildBookRunHarness, derivedIdOf, type BookRunHarness } from "./bookRunRepairRig.js";
import { finishV25Tests, requiredTest, type TestContext } from "./harness.js";

/** Run `body` with `name` set to `value` (or unset), restoring it afterwards. */
async function withEnv(name: string, value: string | undefined, body: () => Promise<void> | void): Promise<void> {
  const saved = process.env[name];
  try {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
    await body();
  } finally {
    if (saved === undefined) delete process.env[name];
    else process.env[name] = saved;
  }
}

// ───────────────────────────── R-165 ─────────────────────────────

requiredTest("R-165: a transient panel ERROR on a review-repair RE-review no longer wedges the book", async (context: TestContext) => {
  const book = "review-repair-rereview-error";
  // FAIL (the verdict that opens the repair lane), then the re-review of the
  // repaired successor comes back ERROR — a reader-lane infra loss, not a
  // verdict — and finally PASS once the panel is asked again.
  const h = await buildBookRunHarness(context, book, ["FAIL", "ERROR", "PASS"]);

  // WITHOUT consent the ERROR is terminal: the loop only continues on FAIL, so
  // the repaired candidate is stranded and the run dies naming its remedy.
  const first = await h.service.run({ ...h.request });
  assert.equal(first.ok, false, JSON.stringify(first));
  if (first.ok) throw new Error("an ERROR re-review must not be treated as a verdict");
  assert.equal(first.error.code, "BOOK_RUN_REVIEW_FAILED");
  assert.match(first.error.message, /reconcile-unsettled/, first.error.message);
  assert.equal(h.repairCalls().length, 1, "exactly one repair ran");
  assert.equal(h.events.some((e) => e.detail?.includes("action=REVIEW_SUCCESSOR")), false, "no successor without consent");

  // WITH consent the re-review is superseded once by a fresh panel, under the
  // repair ordinal's OWN successor label, and the book converges on that verdict.
  const flagged = await h.service.run({ ...h.request, resumeRunId: h.bookRunId, reconcileUnsettled: true });
  assert.equal(flagged.ok, true, flagged.ok ? "" : `${flagged.error.code}:${flagged.error.message}`);
  if (!flagged.ok) throw new Error("unreachable");
  assert.equal(flagged.value.status, "PROMOTED");
  const successorEvent = h.events.find((e) => e.detail?.includes("action=REVIEW_SUCCESSOR"));
  assert.ok(successorEvent, JSON.stringify(h.events.map((e) => e.detail)));
  assert.match(successorEvent.detail ?? "", /label=review-repair-1-successor-1/, successorEvent.detail);
  // The promoted verdict is the SUCCESSOR review of the repaired candidate.
  assert.equal(
    flagged.value.reviewId,
    derivedIdOf("review", derivedIdOf("review-repair-1-successor-1", h.bookRunId)),
    JSON.stringify(flagged.value),
  );
  // The repair itself was replayed, not re-run: no second successor candidate.
  assert.equal(new Set(h.repairCalls().map((call) => call.successorCandidateId)).size, 1);
});

// ───────────────────────────── R-186 ─────────────────────────────

requiredTest("R-186: a canonical-review run left terminal FAILED is recoverable under consent, and fails closed without it", async (context: TestContext) => {
  const book = "review-run-terminal-failed";
  const h = await buildBookRunHarness(context, book, ["PASS"]);
  // The infra-loss shape: the panel run for this book run is already terminal
  // FAILED. Its id is deterministic and its status immutable, so nothing that
  // re-derives it can ever get a verdict out of it again.
  await h.seedCanonicalReviewRunTerminal(h.bookRunId);

  const first = await h.service.run({ ...h.request });
  assert.equal(first.ok, false, JSON.stringify(first));
  if (first.ok) throw new Error("a terminal FAILED review run must not silently pass");
  assert.equal(first.error.code, "BOOK_RUN_REVIEW_FAILED");
  assert.match(first.error.message, /terminal FAILED/, first.error.message);
  assert.match(first.error.message, /reconcile-unsettled/, first.error.message);
  assert.equal(h.reviewCalls(), 0, "a dead run must not be re-entered");

  const flagged = await h.service.run({ ...h.request, resumeRunId: h.bookRunId, reconcileUnsettled: true });
  assert.equal(flagged.ok, true, flagged.ok ? "" : `${flagged.error.code}:${flagged.error.message}`);
  if (!flagged.ok) throw new Error("unreachable");
  assert.equal(flagged.value.status, "PROMOTED");
  assert.equal(h.reviewCalls(), 1, "the successor ran the panel exactly once");
  const successorEvent = h.events.find((e) => e.detail?.includes("action=REVIEW_SUCCESSOR"));
  assert.ok(successorEvent, JSON.stringify(h.events.map((e) => e.detail)));
  assert.match(successorEvent.detail ?? "", /predecessorError=BOOK_RUN_REVIEW_RUN_TERMINAL/, successorEvent.detail);
});

// ───────────────────────────── R-287 ─────────────────────────────

/**
 * The live wedge, sanitized to this rig's shape: ONE BLOCKER, code
 * PATTERN_AUDIT_DEFECT, whose entire case is authoring-internal
 * `examples[].planSpec` metadata recycling — while the deterministic audit the
 * reviewer was handed says `passed: true`. Copied from
 * review-120c5985fc3838d8d670bc914a22c450 (Franklin, run book-run-39a37d06).
 */
const PATTERN_AUDIT_ONLY_BLOCKER = {
  code: "PATTERN_AUDIT_DEFECT",
  severity: "BLOCKER" as const,
  message: "The pattern audit reports repeatedConcreteAnchors: 0, repeatedExampleFrameGroups: 0,"
    + " repeatedSurfaceFrameGroups: 0, and passed: true, but the chapter files themselves show"
    + " extensive, verbatim, systematic reuse of example-scenario settings across the book.",
  location: "examples[*].planSpec.domain / .audience / .stakes; critics/book-pattern-audit.json stats",
};

requiredTest("R-287: a PATTERN_AUDIT_DEFECT-only FAIL against a PASSING deterministic audit is superseded under consent, and only under consent", async (context: TestContext) => {
  const book = "review-pattern-audit-contradiction";
  // The stored FAIL, then a fresh panel that reads the reader projection and passes.
  const h = await buildBookRunHarness(context, book, ["FAIL", "PASS"], {
    reviewFailIssues: [PATTERN_AUDIT_ONLY_BLOCKER],
    // The live lane's own answer to this finding: compiler/context-owned, not repairable.
    repairFails: "REVIEW_REPAIR_FINDING_UNSCOPED",
  });

  // WITHOUT consent: the live wedge, byte-for-byte. A FAIL is a verdict, it
  // routes into the repair lane, and the lane refuses the finding.
  const first = await h.service.run({ ...h.request });
  assert.equal(first.ok, false, JSON.stringify(first));
  if (first.ok) throw new Error("a FAIL verdict must never promote on its own");
  assert.equal(first.error.code, "REVIEW_REPAIR_FINDING_UNSCOPED", first.error.message);
  assert.equal(h.repairCalls().length, 1, "the FAIL still routes to the repair lane without consent");
  assert.equal(h.events.some((e) => e.detail?.includes("action=REVIEW_SUCCESSOR")), false, "no successor without consent");

  // WITH consent: the stored FAIL is uncertainty — the reviewer contradicting the
  // deterministic audit about metadata no reader sees — so ONE fresh panel
  // supersedes it, before the repair lane is asked to fix a phantom.
  const flagged = await h.service.run({ ...h.request, resumeRunId: h.bookRunId, reconcileUnsettled: true });
  assert.equal(flagged.ok, true, flagged.ok ? "" : `${flagged.error.code}:${flagged.error.message}`);
  if (!flagged.ok) throw new Error("unreachable");
  assert.equal(flagged.value.status, "PROMOTED");
  assert.equal(h.repairCalls().length, 1, "the repair lane is not re-entered for a superseded FAIL");
  const successorEvent = h.events.find((e) => e.detail?.includes("action=REVIEW_SUCCESSOR"));
  assert.ok(successorEvent, JSON.stringify(h.events.map((e) => e.detail)));
  assert.match(successorEvent.detail ?? "", /label=review-successor-1/, successorEvent.detail);
  assert.match(successorEvent.detail ?? "", /reason=PATTERN_AUDIT_CONTRADICTION/, successorEvent.detail);
  assert.match(successorEvent.detail ?? "", /predecessorReviewId=/, successorEvent.detail);
  assert.equal(
    flagged.value.reviewId,
    derivedIdOf("review", derivedIdOf("review-successor-1", h.bookRunId)),
    JSON.stringify(flagged.value),
  );
});

requiredTest("R-287: a metadata-only FAIL on a repair-loop RE-review is superseded in the REPAIR lane's own label space", async (context: TestContext) => {
  const book = "review-pattern-audit-contradiction-repair";
  // THE LIVE LINEAGE, and the reason this case exists separately from the base-lane
  // one above. Franklin's BASE review (review-06d7596afd1f14dccd3eb2df99b22db6)
  // FAILed with 34 READER.BLOCKING.* blockers, which normalize away from
  // PATTERN_AUDIT_DEFECT and are therefore correctly INELIGIBLE — the base-lane
  // successor does not fire and must not. The review that wedged the run is the
  // ROUND-6 RE-REVIEW (review-120c5985fc3838d8d670bc914a22c450, bound to candidate
  // review-repair-6-candidate-06d7596a…), so the ONLY walk that can clear it is
  // #reviewSuccessor(labelPrefix: "review-repair-N") inside the repair loop. This
  // asserts that lane's own label space rather than inferring it from the shared
  // method.
  const h = await buildBookRunHarness(context, book, ["FAIL", "FAIL", "PASS"], {
    reviewFailIssuesPerFail: [
      [{ code: "READER.BLOCKING.internal_contradiction", severity: "BLOCKER", message: "the ruling in card 5 contradicts the deep read", location: "ch01/reader-b/deep" }],
      [PATTERN_AUDIT_ONLY_BLOCKER],
    ],
  });
  // One repair round, so the metadata-only RE-review ends the run instead of
  // walking into a second ordinal: the live shape is a run with nowhere left to go.
  await withEnv("CHAPTERFLOW_REVIEW_REPAIR_ROUNDS", "1", async () => {
    // WITHOUT consent: round 1 repairs the real blocker, its re-review comes back
    // metadata-only, the cap ends the run — and the remedy line names this case.
    const first = await h.service.run({ ...h.request });
    assert.equal(first.ok, false, JSON.stringify(first));
    if (first.ok) throw new Error("a FAIL must not promote without consent");
    assert.equal(first.error.code, "BOOK_RUN_REVIEW_FAILED", first.error.message);
    assert.match(first.error.message, /PATTERN_AUDIT_DEFECT/, first.error.message);
    assert.match(first.error.message, /reconcile-unsettled/, first.error.message);
    assert.equal(h.repairCalls().length, 1, "exactly one repair ran");
    assert.equal(h.events.some((e) => e.detail?.includes("action=REVIEW_SUCCESSOR")), false, "no successor without consent");

    // WITH consent: the base review replays its READER.BLOCKING FAIL and is STILL
    // not superseded (exactly one successor event, and it is the repair lane's),
    // the repair ordinal replays with no new candidate, and the RE-review's stored
    // FAIL is superseded under the repair ordinal's own label.
    const flagged = await h.service.run({ ...h.request, resumeRunId: h.bookRunId, reconcileUnsettled: true });
    assert.equal(flagged.ok, true, flagged.ok ? "" : `${flagged.error.code}:${flagged.error.message}`);
    if (!flagged.ok) throw new Error("unreachable");
    assert.equal(flagged.value.status, "PROMOTED");
    const successorEvents = h.events.filter((e) => e.detail?.includes("action=REVIEW_SUCCESSOR"));
    assert.equal(successorEvents.length, 1, JSON.stringify(successorEvents.map((e) => e.detail)));
    assert.match(successorEvents[0].detail ?? "", /label=review-repair-1-successor-1/, successorEvents[0].detail);
    assert.match(successorEvents[0].detail ?? "", /reason=PATTERN_AUDIT_CONTRADICTION/, successorEvents[0].detail);
    assert.equal(
      flagged.value.reviewId,
      derivedIdOf("review", derivedIdOf("review-repair-1-successor-1", h.bookRunId)),
      JSON.stringify(flagged.value),
    );
    assert.equal(new Set(h.repairCalls().map((call) => call.successorCandidateId)).size, 1, "the repair ordinal replayed; no second successor candidate");
  });
});

requiredTest("R-287: a FAIL carrying ANY other blocker stays a verdict even under consent", async (context: TestContext) => {
  const book = "review-pattern-audit-plus-contradiction";
  const h = await buildBookRunHarness(context, book, ["FAIL", "PASS"], {
    reviewFailIssues: [
      PATTERN_AUDIT_ONLY_BLOCKER,
      { code: "INTERNAL_CONTRADICTION", severity: "BLOCKER", message: "card 5 contradicts the deep read", location: "ch01" },
    ],
    repairFails: "REVIEW_REPAIR_FINDING_UNSCOPED",
  });
  const flagged = await h.service.run({ ...h.request, reconcileUnsettled: true });
  assert.equal(flagged.ok, false, JSON.stringify(flagged));
  if (flagged.ok) throw new Error("an on-page contradiction is a verdict, not uncertainty");
  assert.equal(flagged.error.code, "REVIEW_REPAIR_FINDING_UNSCOPED", flagged.error.message);
  assert.equal(h.events.some((e) => e.detail?.includes("action=REVIEW_SUCCESSOR")), false, "consent must not launder a real blocker");
});

requiredTest("R-287: a PATTERN_AUDIT_DEFECT-only FAIL is NOT superseded when the deterministic audit itself failed", async (context: TestContext) => {
  const book = "review-pattern-audit-agrees";
  const h = await buildBookRunHarness(context, book, ["FAIL", "PASS"], {
    reviewFailIssues: [PATTERN_AUDIT_ONLY_BLOCKER],
    patternAuditFails: true,
    repairFails: "REVIEW_REPAIR_FINDING_UNSCOPED",
  });
  const flagged = await h.service.run({ ...h.request, reconcileUnsettled: true });
  assert.equal(flagged.ok, false, JSON.stringify(flagged));
  if (flagged.ok) throw new Error("a reviewer AGREEING with a failing audit is a verdict");
  assert.equal(flagged.error.code, "REVIEW_REPAIR_FINDING_UNSCOPED", flagged.error.message);
  assert.equal(h.events.some((e) => e.detail?.includes("action=REVIEW_SUCCESSOR")), false, "no supersession when the audit agrees");
});

requiredTest("R-287: without consent the terminal message names this case as the remedy", async (context: TestContext) => {
  const book = "review-pattern-audit-remedy-line";
  // Round 1 repairs and its re-review returns the same metadata-only FAIL; the
  // cap then ends the run on the terminal review path, which is where the R-179
  // remedy line is written.
  const h = await buildBookRunHarness(context, book, ["FAIL", "FAIL"], {
    reviewFailIssues: [PATTERN_AUDIT_ONLY_BLOCKER],
  });
  await withEnv("CHAPTERFLOW_REVIEW_REPAIR_ROUNDS", "1", async () => {
    const result = await h.service.run({ ...h.request });
    assert.equal(result.ok, false, JSON.stringify(result));
    if (result.ok) throw new Error("a FAIL must not promote without consent");
    assert.equal(result.error.code, "BOOK_RUN_REVIEW_FAILED");
    assert.match(result.error.message, /canonical review outcome=FAIL/, result.error.message);
    assert.match(result.error.message, /PATTERN_AUDIT_DEFECT/, result.error.message);
    assert.match(result.error.message, /reconcile-unsettled/, result.error.message);
    assert.equal(h.events.some((e) => e.detail?.includes("action=REVIEW_SUCCESSOR")), false, "the remedy is named, not taken");
  });
});

// ───────────────────────────── R-184 ─────────────────────────────

requiredTest("R-184: a fresh-QC ERROR is superseded once under consent instead of replaying model-free forever", async (context: TestContext) => {
  const book = "fresh-qc-error-successor";
  const h = await buildBookRunHarness(context, book, ["PASS", "PASS"], { qcOutcomes: ["ERROR", "PASS"] });

  const first = await h.service.run({ ...h.request });
  assert.equal(first.ok, false, JSON.stringify(first));
  if (first.ok) throw new Error("an ERROR fresh-QC round must not promote");
  assert.equal(first.error.code, "BOOK_RUN_QC_FAILED");
  assert.match(first.error.message, /reconcile-unsettled/, first.error.message);

  // Resume WITHOUT consent: the durable ERROR round replays verbatim, and the
  // remedy is still named. No successor round is minted.
  const replay = await h.service.run({ ...h.request, resumeRunId: h.bookRunId });
  assert.equal(replay.ok, false);
  if (replay.ok) throw new Error("unreachable");
  assert.equal(replay.error.code, "BOOK_RUN_QC_FAILED");
  assert.equal(h.events.some((e) => e.detail?.includes("action=QC_SUCCESSOR")), false, "no successor without consent");

  // Resume WITH consent: one fresh round under a distinct successor id, and the
  // run promotes on THAT round.
  const flagged = await h.service.run({ ...h.request, resumeRunId: h.bookRunId, reconcileUnsettled: true });
  assert.equal(flagged.ok, true, flagged.ok ? "" : `${flagged.error.code}:${flagged.error.message}`);
  if (!flagged.ok) throw new Error("unreachable");
  assert.equal(flagged.value.status, "PROMOTED");
  const successorRoundId = derivedIdOf("qc-successor-1", h.bookRunId);
  assert.equal(flagged.value.qcRoundId, successorRoundId, JSON.stringify(flagged.value));
  const successorEvent = h.events.find((e) => e.detail?.includes("action=QC_SUCCESSOR"));
  assert.ok(successorEvent, JSON.stringify(h.events.map((e) => e.detail)));
  assert.match(successorEvent.detail ?? "", /predecessorRoundId=/, successorEvent.detail);
  const stored = await h.qcStore.getRound(book, successorRoundId);
  assert.ok(stored.ok && stored.value.outcome === "PASS", JSON.stringify(stored));
});

// ───────────────────────────── R-176 ─────────────────────────────

requiredTest("R-176: a resumed fresh-QC round that does not bind this exact candidate and review is refused", async (context: TestContext) => {
  const book = "fresh-qc-round-identity";
  const h = await buildBookRunHarness(context, book, ["PASS", "PASS"], { promoteLocal: false });
  const first = await h.service.run({ ...h.request });
  assert.equal(first.ok, true, first.ok ? "" : `${first.error.code}:${first.error.message}`);

  // Rebind the durable round to a different candidate. This is the one
  // promotion-authorizing artifact the resume path read back by run-derived id
  // alone: before R-176 the resume would have promoted on it anyway.
  const roundId = derivedIdOf("qc", h.bookRunId);
  const stored = await h.qcStore.getRound(book, roundId);
  assert.ok(stored.ok, JSON.stringify(stored));
  const paths = h.qcStore.paths(book);
  assert.ok(paths.ok, JSON.stringify(paths));
  writeFileSync(
    paths.value.round(roundId),
    `${JSON.stringify({ ...stored.value, candidate: { candidateId: "some-other-candidate", manifestDigest: "0".repeat(64) } }, null, 2)}\n`,
    "utf8",
  );

  const resumed = await h.service.run({ ...h.request, resumeRunId: h.bookRunId });
  assert.equal(resumed.ok, false, JSON.stringify(resumed));
  if (resumed.ok) throw new Error("a round bound to another candidate must never authorize promotion");
  assert.equal(resumed.error.code, "BOOK_RUN_QC_FAILED");
  assert.match(resumed.error.message, /does not bind this exact candidate/, resumed.error.message);
});

// ───────────────────────────── R-169 ─────────────────────────────

requiredTest("R-169: a REPLAYED review-repair ordinal is logged SKIPPED, not as another completed repair", async (context: TestContext) => {
  const book = "review-repair-replay-log";
  // Round 1 executes and its re-review FAILs, so the cap ends the first run with
  // ordinal 1 COMPLETED and durable. The resume replays ordinal 1 (zero model
  // calls) before reaching fresh work.
  // base review FAIL, ordinal 1's re-review FAIL (cap reached), then on the
  // resume ordinal 2's re-review PASSes.
  const h = await buildBookRunHarness(context, book, ["FAIL", "FAIL", "PASS"]);
  await withEnv("CHAPTERFLOW_REVIEW_REPAIR_ROUNDS", "1", async () => {
    const first = await h.service.run({ ...h.request });
    assert.equal(first.ok, false, JSON.stringify(first));
    const freshStarted = h.events.filter((e) => e.phase === "repair" && e.status === "STARTED" && e.detail?.includes("action=REVIEW_REPAIR;"));
    assert.equal(freshStarted.length, 1, JSON.stringify(h.events.filter((e) => e.phase === "repair").map((e) => [e.status, e.detail])));

    const before = h.events.length;
    const resumed = await h.service.run({ ...h.request, resumeRunId: h.bookRunId, reconcileUnsettled: true });
    assert.equal(resumed.ok, true, resumed.ok ? "" : `${resumed.error.code}:${resumed.error.message}`);
    const onResume = h.events.slice(before).filter((e) => e.phase === "repair");
    const replayEvents = onResume.filter((e) => e.detail?.includes("action=REVIEW_REPAIR_REPLAY"));
    assert.equal(replayEvents.length, 1, JSON.stringify(onResume.map((e) => [e.status, e.detail])));
    assert.equal(replayEvents[0].status, "SKIPPED");
    assert.match(replayEvents[0].detail ?? "", /label=review-repair-1/, replayEvents[0].detail);
    // The replayed ordinal contributes NO STARTED and NO COMPLETED repair event:
    // the phase log now counts real chapter rewrites.
    assert.equal(
      onResume.filter((e) => e.status === "STARTED" && e.detail?.includes("label=review-repair-1;")).length,
      0,
      JSON.stringify(onResume.map((e) => [e.status, e.detail])),
    );
  });
});

// ───────────────────────────── R-187 ─────────────────────────────

requiredTest("R-187: a transient phase-event write is retried instead of discarding the run's completed model work", async (context: TestContext) => {
  const book = "event-write-retry";
  const h = await buildBookRunHarness(context, book, ["PASS"], { eventAppendFailures: 2 });
  const result = await h.service.run({ ...h.request });
  assert.equal(result.ok, true, result.ok ? "" : `${result.error.code}:${result.error.message}`);
  if (!result.ok) throw new Error("unreachable");
  assert.equal(result.value.status, "PROMOTED");
  // Two transient failures on the FIRST append cost two retries, not the run.
  assert.equal(h.eventAppendAttempts(), h.events.length + 2);
});

requiredTest("R-187: a PERSISTENT phase-event write failure still fails closed, with the remedy named", async (context: TestContext) => {
  const book = "event-write-persistent";
  const h = await buildBookRunHarness(context, book, ["PASS"], { eventAppendFailures: Number.MAX_SAFE_INTEGER });
  const result = await h.service.run({ ...h.request });
  assert.equal(result.ok, false, JSON.stringify(result));
  if (result.ok) throw new Error("an unlogged run must never continue");
  assert.equal(result.error.code, "BOOK_RUN_EVENT_WRITE_FAILED");
  assert.match(result.error.message, /book-run-events/, result.error.message);
  // Bounded: three attempts (two backoffs), never an unbounded spin.
  assert.equal(h.eventAppendAttempts(), 3);
});

// ───────────────────────────── R-177 ─────────────────────────────

requiredTest("R-177: a malformed repair-budget override is refused as INPUT before any model work", async (context: TestContext) => {
  const book = "budget-env-fail-fast";
  const h = await buildBookRunHarness(context, book, ["PASS"]);
  await withEnv("CHAPTERFLOW_QC_REPAIR_RUNS", "three", async () => {
    const result = await h.service.run({ ...h.request });
    assert.equal(result.ok, false, JSON.stringify(result));
    if (result.ok) throw new Error("a malformed budget must not run a book");
    // Pre-R-177 this threw a raw Error out of run(), from inside the QC-FAIL
    // branch — after research, compile, the whole panel and the whole judge.
    assert.equal(result.error.code, "BOOK_RUN_INPUT_INVALID");
    assert.match(result.error.message, /CHAPTERFLOW_QC_REPAIR_RUNS/, result.error.message);
    assert.equal(h.reviewCalls(), 0, "not one model call may be spent on a run that cannot finish");
  });
  await withEnv("CHAPTERFLOW_OPERATOR_COMPILE_RETRIES", "0", async () => {
    const result = await h.service.run({ ...h.request });
    assert.equal(result.ok, false, JSON.stringify(result));
    if (result.ok) throw new Error("an out-of-range budget must not run a book");
    assert.equal(result.error.code, "BOOK_RUN_INPUT_INVALID");
    assert.match(result.error.message, /CHAPTERFLOW_OPERATOR_COMPILE_RETRIES must be 1-50/, result.error.message);
  });
});

// ────────────────────────── R-185 / R-178 ─────────────────────────

requiredTest("R-185/R-178: the judge and operator-retry budgets have env resolvers with the same fail-closed contract as the other two", () => {
  assert.equal(resolveQcJudgeRuns(), 5, "the compiled default is unchanged");
  assert.equal(resolveOperatorCompileRetries(), 20);
  for (const [name, resolver, ok, max] of [
    ["CHAPTERFLOW_QC_JUDGE_RUNS", resolveQcJudgeRuns, "8", 10],
    ["CHAPTERFLOW_OPERATOR_COMPILE_RETRIES", resolveOperatorCompileRetries, "30", 50],
  ] as const) {
    process.env[name] = ok;
    try {
      assert.equal(resolver(), Number(ok), `${name} must be honoured`);
      process.env[name] = "";
      assert.ok(resolver() > 0, `${name} empty must fall back to the default`);
      process.env[name] = "5.5";
      assert.throws(() => resolver(), new RegExp(`${name} is set but not an integer`));
      process.env[name] = String(max + 1);
      assert.throws(() => resolver(), new RegExp(`${name} must be 1-${max}`));
      process.env[name] = "0";
      assert.throws(() => resolver(), new RegExp(`${name} must be 1-${max}`));
    } finally {
      delete process.env[name];
    }
  }
});

// ─────────────────────── interrupted panel (R-219) ───────────────────────

requiredTest("R-219: a panel interrupted mid-flight is reconciled under consent so a fresh successor panel can supersede it", async (context: TestContext) => {
  const book = "review-run-interrupted-panel";
  const h = await buildBookRunHarness(context, book, ["PASS"]);
  // The live 2026-09-16 shape (book-run-4dc2a413): the machine rebooted with the
  // reader panel mid-flight, so the canonical review run is RUNNING, its one
  // canonical attempt is SUCCEEDED, and no review was ever stored. The run id is
  // deterministic and the reader lane's seat attempt ids are too, so re-entering
  // this review is not viable — the successor panel is the designed remedy.
  await h.seedCanonicalReviewRunInterrupted(h.bookRunId, "SUCCEEDED");
  const reviewRunId = derivedIdOf("review-run", h.bookRunId);

  // WITHOUT consent: byte-identical to today — fail closed, same message, no
  // model call, and the interrupted run is left exactly as it was found.
  const first = await h.service.run({ ...h.request });
  assert.equal(first.ok, false, JSON.stringify(first));
  if (first.ok) throw new Error("an interrupted panel must never be superseded without consent");
  assert.equal(first.error.code, "BOOK_RUN_REVIEW_FAILED");
  assert.match(first.error.message, /settled review call lacks durable review; replay refused/, first.error.message);
  assert.equal(h.reviewCalls(), 0, "a wedged review must not be re-entered");
  assert.equal(h.events.some((e) => e.detail?.includes("action=REVIEW_SUCCESSOR")), false, "no successor without consent");
  const untouched = await h.runStore.readRun(book, reviewRunId, context.clock.now());
  assert.ok(untouched.ok, JSON.stringify(untouched));
  assert.equal(untouched.value.status, "RUNNING", "an unflagged resume reconciles nothing");

  // WITH consent: the interrupted run is driven terminal FAILED with the
  // reconcile marker, and the EXISTING successor walk mints one fresh panel in
  // this same invocation.
  const flagged = await h.service.run({ ...h.request, resumeRunId: h.bookRunId, reconcileUnsettled: true });
  assert.equal(flagged.ok, true, flagged.ok ? "" : `${flagged.error.code}:${flagged.error.message}`);
  if (!flagged.ok) throw new Error("unreachable");
  assert.equal(flagged.value.status, "PROMOTED");
  assert.equal(h.reviewCalls(), 1, "the successor ran the panel exactly once");
  const successorEvent = h.events.find((e) => e.detail?.includes("action=REVIEW_SUCCESSOR"));
  assert.ok(successorEvent, JSON.stringify(h.events.map((e) => e.detail)));
  assert.match(successorEvent.detail ?? "", /label=review-successor-1/, successorEvent.detail);
  assert.match(successorEvent.detail ?? "", /predecessorError=BOOK_RUN_REVIEW_RUN_TERMINAL/, successorEvent.detail);
  assert.equal(
    flagged.value.reviewId,
    derivedIdOf("review", derivedIdOf("review-successor-1", h.bookRunId)),
    JSON.stringify(flagged.value),
  );
  const abandoned = await h.runStore.readRun(book, reviewRunId, context.clock.now());
  assert.ok(abandoned.ok, JSON.stringify(abandoned));
  assert.equal(abandoned.value.status, "FAILED", "the interrupted run must not be left advertising live work");
});

requiredTest("R-219: an interrupted panel whose lease is still ACTIVE stays fail-closed even under consent", async (context: TestContext) => {
  const book = "review-run-interrupted-active";
  const h = await buildBookRunHarness(context, book, ["PASS"]);
  // An unexpired lease may still be owned by a LIVE process: reconciling it
  // would settle work nobody abandoned. ACTIVE is never touched.
  await h.seedCanonicalReviewRunInterrupted(h.bookRunId, "ACTIVE");
  const reviewRunId = derivedIdOf("review-run", h.bookRunId);

  const flagged = await h.service.run({ ...h.request, reconcileUnsettled: true });
  assert.equal(flagged.ok, false, JSON.stringify(flagged));
  if (flagged.ok) throw new Error("a live panel lease must never be superseded");
  assert.equal(flagged.error.code, "BOOK_RUN_REVIEW_FAILED");
  assert.match(flagged.error.message, /canonical review attempt is unsettled; replay refused/, flagged.error.message);
  assert.equal(h.reviewCalls(), 0, "no successor panel may be minted over a live lease");
  assert.equal(h.events.some((e) => e.detail?.includes("action=REVIEW_SUCCESSOR")), false);
  const live = await h.runStore.readRun(book, reviewRunId, context.clock.now());
  assert.ok(live.ok, JSON.stringify(live));
  assert.equal(live.value.status, "RUNNING");
  assert.equal(live.value.attempts[0].status, "ACTIVE");
});

requiredTest("R-219: the repair-loop RE-review reconciles an interrupted panel the same way, with its own successor label", async (context: TestContext) => {
  const book = "review-repair-interrupted-panel";
  // base review FAIL opens the repair lane; the repaired successor's re-review
  // was the panel the reboot caught, and the fresh successor panel PASSes.
  // The re-review's panel run BINDS the repaired successor, so its interrupted
  // shape can only be planted once that successor is staged: a STALE lease that
  // outlived the process that owned it, and no review ever stored.
  let harness: BookRunHarness | undefined;
  let seeded = false;
  const h = await buildBookRunHarness(context, book, ["FAIL", "PASS"], {
    afterReviewRepair: async (successor) => {
      if (seeded || harness === undefined) return;
      seeded = true;
      await harness.seedCanonicalReviewRunInterrupted(derivedIdOf("review-repair-1", harness.bookRunId), "STALE", successor);
    },
  });
  harness = h;
  const reReviewParentRunId = derivedIdOf("review-repair-1", h.bookRunId);
  const reReviewRunId = derivedIdOf("review-run", reReviewParentRunId);

  const first = await h.service.run({ ...h.request });
  assert.equal(first.ok, false, JSON.stringify(first));
  if (first.ok) throw new Error("an interrupted re-review must not be superseded without consent");
  assert.equal(first.error.code, "BOOK_RUN_REVIEW_FAILED");
  assert.match(first.error.message, /canonical review attempt is unsettled; replay refused/, first.error.message);

  const flagged = await h.service.run({ ...h.request, resumeRunId: h.bookRunId, reconcileUnsettled: true });
  assert.equal(flagged.ok, true, flagged.ok ? "" : `${flagged.error.code}:${flagged.error.message}`);
  if (!flagged.ok) throw new Error("unreachable");
  assert.equal(flagged.value.status, "PROMOTED");
  assert.equal(
    flagged.value.reviewId,
    derivedIdOf("review", derivedIdOf("review-repair-1-successor-1", h.bookRunId)),
    JSON.stringify(flagged.value),
  );
  const successorEvent = h.events.find((e) => e.detail?.includes("action=REVIEW_SUCCESSOR"));
  assert.ok(successorEvent, JSON.stringify(h.events.map((e) => e.detail)));
  assert.match(successorEvent.detail ?? "", /label=review-repair-1-successor-1/, successorEvent.detail);
  // The stale attempt is settled ABANDONED with the recovery marker, not left
  // advertising live work, and its run is terminal.
  const abandoned = await h.runStore.readRun(book, reReviewRunId, context.clock.now());
  assert.ok(abandoned.ok, JSON.stringify(abandoned));
  assert.equal(abandoned.value.status, "FAILED");
  assert.equal(abandoned.value.attempts[0].status, "ABANDONED");
  const journal = readFileSync(join(h.runStore.runDirectory!(book, reReviewRunId), "attempts.jsonl"), "utf8");
  assert.match(journal, /RECONCILED_UNSETTLED_ON_RESUME/, journal);
});

// ───────────────────────────── R-288 ─────────────────────────────
//
// A DISPUTED review: the repair writer, handed every chapter the review's
// blockers name, returns all of them unchanged (REPAIR_OUTPUT_NO_CHANGE).
//
// Live Franklin (run book-run-39a37d06, 2026-09-20 00:22-00:27Z): the baseline
// structural reviewer FAILed with ONE blocker, QUIZ_DEFECT, locating ch09
// material ("Society of the Free and Easy", notes dated May 19th 1731) in ch14's
// quiz q03. The reviewed candidate's ch14 contains neither string — its q03 is
// about the Board of Trade rejecting the union plan, and ch09 carries nine such
// mentions. The writer, handed the real ch14, changed nothing; the ordinal died
// REPAIR_OUTPUT_NO_CHANGE; the next resume spent the next ordinal on the same
// stored FAIL. Ordinals 12, 13 and 14 went in four minutes, 14 of 20 spent, with
// eleven rounds of real repairs banked that no fresh run can inherit.
//
// Under consent the REVIEW is re-judged instead: one fresh panel re-reads the
// same candidate. Nothing is laundered — the successor is a full panel, and its
// FAIL binds exactly as its predecessor's did.

/** The scripted lane failure the real port answers when every chapter an ordinal
 *  put in front of the writer came back unchanged and none was accepted (its
 *  post-loop all-declined check, PR #573 — this branch is stacked on it). The real
 *  message is `replacement did not change chapter <n>`; the rig's is its own
 *  string, so the assertions below pin the CODE and the added remedy. */
const DECLINED = "REPAIR_OUTPUT_NO_CHANGE";

/**
 * The successor label space a DISPUTED review owns.
 *
 * It is keyed to the DISPUTED REVIEW — not to the repair ordinal that happened
 * to disclose the dispute — so a later flagged resume, which necessarily walks
 * to a FRESH ordinal (the declining one is durably FAILED), re-derives the SAME
 * label, finds the stored successor verdict and replays it with ZERO model
 * calls. Keyed to the ordinal instead, every flagged resume would buy another
 * independent panel roll on byte-identical bytes.
 */
const disputedSuccessorLabel = (bookRunId: string): string => `disputed-${derivedIdOf("review", bookRunId)}-successor-1`;

requiredTest("R-288: an all-declined repair ordinal fails closed WITHOUT consent, naming the flag and the dispute", async (context: TestContext) => {
  const book = "review-repair-declined-no-consent";
  const h = await buildBookRunHarness(context, book, ["FAIL", "PASS"], { repairFails: DECLINED });

  const result = await h.service.run({ ...h.request });
  assert.equal(result.ok, false, JSON.stringify(result));
  if (result.ok) throw new Error("a declined repair must never promote the book");
  // The lane's own terminal answer, unchanged...
  assert.equal(result.error.code, DECLINED, result.error.message);
  assert.match(result.error.message, /scripted repair failure/, result.error.message);
  // ...plus the R-179-style remedy: the flag AND this case, so the operator
  // reading it can tell a declining writer from a broken one.
  assert.match(result.error.message, /DISPUTED/, result.error.message);
  assert.match(result.error.message, /reconcile-unsettled/, result.error.message);
  assert.equal(h.events.some((e) => e.detail?.includes("action=REVIEW_SUCCESSOR")), false, "no successor without consent");
  assert.equal(h.reviewCalls(), 1, "the remedy is named, not taken: no second panel");
  assert.equal(h.repairCalls().length, 1, "and no second ordinal is spent on the same stored FAIL");
});

requiredTest("R-288: under consent a DISPUTED review is superseded by exactly one fresh panel, and the run promotes on its verdict", async (context: TestContext) => {
  const book = "review-repair-declined-consent";
  // The stored FAIL, then the fresh panel that re-reads the same candidate and
  // finds the disputed defect is not there.
  const h = await buildBookRunHarness(context, book, ["FAIL", "PASS"], { repairFails: DECLINED });

  const flagged = await h.service.run({ ...h.request, reconcileUnsettled: true });
  assert.equal(flagged.ok, true, flagged.ok ? "" : `${flagged.error.code}:${flagged.error.message}`);
  if (!flagged.ok) throw new Error("unreachable");
  assert.equal(flagged.value.status, "PROMOTED");
  // ONE successor, in the DISPUTED REVIEW's label space (not the ordinal's — see
  // disputedSuccessorLabel), naming the case.
  const successorEvents = h.events.filter((e) => e.detail?.includes("action=REVIEW_SUCCESSOR"));
  assert.equal(successorEvents.length, 1, JSON.stringify(successorEvents.map((e) => e.detail)));
  assert.ok(
    successorEvents[0].detail?.includes(`label=${disputedSuccessorLabel(h.bookRunId)}`),
    successorEvents[0].detail,
  );
  assert.match(successorEvents[0].detail ?? "", /reason=DISPUTED_REVIEW/, successorEvents[0].detail);
  assert.match(successorEvents[0].detail ?? "", /predecessorReviewId=/, successorEvents[0].detail);
  // The promoted verdict IS that successor panel's, on the unchanged candidate.
  assert.equal(
    flagged.value.reviewId,
    derivedIdOf("review", derivedIdOf(disputedSuccessorLabel(h.bookRunId), h.bookRunId)),
    JSON.stringify(flagged.value),
  );
  assert.equal(h.reviewCalls(), 2, "exactly one fresh panel, not a re-roll per ordinal");
  assert.equal(h.repairCalls().length, 1, "no second ordinal is spent on the disputed review");
});

requiredTest("R-288: a successor that FAILs with real blockers goes to NORMAL repair, not to another supersession", async (context: TestContext) => {
  const book = "review-repair-declined-successor-fails";
  // Base FAIL -> ordinal 1 declines -> successor panel FAILs (a real blocker
  // this time) -> ordinal 2 repairs it -> the re-review passes.
  const h = await buildBookRunHarness(context, book, ["FAIL", "FAIL", "PASS"], {
    repairFailsPerCall: [DECLINED],
  });

  const flagged = await h.service.run({ ...h.request, reconcileUnsettled: true });
  assert.equal(flagged.ok, true, flagged.ok ? "" : `${flagged.error.code}:${flagged.error.message}`);
  if (!flagged.ok) throw new Error("unreachable");
  assert.equal(flagged.value.status, "PROMOTED");
  const successorEvents = h.events.filter((e) => e.detail?.includes("action=REVIEW_SUCCESSOR"));
  assert.equal(successorEvents.length, 1, JSON.stringify(successorEvents.map((e) => e.detail)));
  // The second ordinal repairs the SUCCESSOR's findings — the fresh verdict, not
  // the disputed one — which is what "continue the loop from the successor's
  // verdict" has to mean.
  const calls = h.repairCalls();
  assert.equal(calls.length, 2, JSON.stringify(calls.map((call) => call.repairRunId)));
  assert.equal(calls[1].repairRunId, h.reviewRepairRunId("review-repair-2"));
  assert.equal(
    calls[1].failedReviewId,
    derivedIdOf("review", derivedIdOf(disputedSuccessorLabel(h.bookRunId), h.bookRunId)),
    "the second ordinal must repair the SUCCESSOR review's blockers",
  );
});

requiredTest("R-288: a successor whose OWN repair ordinal is all-declined fails closed — one supersession per invocation", async (context: TestContext) => {
  const book = "review-repair-declined-twice";
  // Every ordinal declines, and the successor panel FAILs too: the reviewer and
  // the writer disagree systematically, which no further panel can settle.
  const h = await buildBookRunHarness(context, book, ["FAIL", "FAIL", "PASS"], { repairFails: DECLINED });

  const flagged = await h.service.run({ ...h.request, reconcileUnsettled: true });
  assert.equal(flagged.ok, false, JSON.stringify(flagged));
  if (flagged.ok) throw new Error("a twice-disputed review must never promote");
  assert.equal(flagged.error.code, DECLINED, flagged.error.message);
  assert.match(flagged.error.message, /already superseded one DISPUTED review/, flagged.error.message);
  const successorEvents = h.events.filter((e) => e.detail?.includes("action=REVIEW_SUCCESSOR"));
  assert.equal(successorEvents.length, 1, "the bound is ONE fresh panel per invocation");
  assert.equal(h.reviewCalls(), 2, "no third panel is paid for");
  assert.equal(h.repairCalls().length, 2, "and the walk stops instead of eating the ordinal space");
});

requiredTest("R-288: a SECOND flagged resume replays the stored successor verdict — one panel per disputed review, not one per resume", async (context: TestContext) => {
  const book = "review-repair-declined-resume";
  // The scripted panel answers, in call order: the base FAIL, then the ONE
  // successor panel this disputed review is allowed, which FAILs too. A THIRD
  // call would be a second fresh roll on the same disputed review and the same
  // bytes — and it is scripted PASS, so if the code ever buys it the book
  // promotes on a verdict it paid for by re-rolling. That must not happen.
  const h = await buildBookRunHarness(context, book, ["FAIL", "FAIL", "PASS"], { repairFails: DECLINED });

  // Invocation one: ordinal 1 declines -> the review is DISPUTED -> one fresh
  // panel -> it FAILs -> ordinal 2 declines that too -> the per-invocation
  // supersession bound stops the run.
  const first = await h.service.run({ ...h.request, reconcileUnsettled: true });
  assert.equal(first.ok, false, JSON.stringify(first));
  assert.equal(h.reviewCalls(), 2, "one base panel plus one successor panel");
  assert.equal(h.repairCalls().length, 2, JSON.stringify(h.repairCalls().map((call) => call.repairRunId)));

  // Invocation two: the declining ordinals are durably FAILED and the walk steps
  // over both. Ordinal 1's dispute WAS applied in invocation one — this run's
  // phase log carries the successor STARTED event to prove it — so R-290
  // re-applies it and replays the STORED successor verdict with zero model
  // calls. Ordinal 2's was not: the supersession bound refused it, nothing was
  // minted, and an ordinal with no durable supersession is left exactly as the
  // pre-R-290 walk left it — stepped over, with a fresh ordinal spent to
  // re-discover the decline, which the bound then refuses again.
  //
  // WHAT R-290 CHANGED HERE, AND WHY IT IS NOT A WEAKENING. Before it, this
  // resume walked to FRESH ordinals 3 AND 4, paying a full repair pass each to
  // re-discover both declines on disk; it now re-applies the one that is
  // evidenced and spends a single ordinal on the one that is not. The thing this
  // case exists to forbid — buying a second panel on byte-identical bytes — is
  // asserted below and unchanged.
  const second = await h.service.run({ ...h.request, resumeRunId: h.bookRunId, reconcileUnsettled: true });
  assert.equal(second.ok, false, JSON.stringify(second));
  if (second.ok) throw new Error("a resume must not promote a book by re-rolling the panel that already judged it");
  assert.equal(
    h.reviewCalls(),
    2,
    "a re-disputed review must REPLAY its stored successor verdict, never buy another panel on the same bytes",
  );
  assert.equal(second.error.code, DECLINED, second.error.message);
  assert.match(second.error.message, /already superseded one DISPUTED review/, second.error.message);
  assert.equal(
    h.repairCalls().length,
    3,
    `a replayed dispute re-reads run state; it must not re-buy the decline already on disk: ${
      JSON.stringify(h.repairCalls().map((call) => call.repairRunId))}`,
  );
  assert.equal(
    h.repairCalls()[2].repairRunId,
    h.reviewRepairRunId("review-repair-3"),
    "the UNEVIDENCED second dispute still costs the walk a fresh ordinal, exactly as before R-290",
  );
  // ONE successor STARTED event per invocation, all naming the SAME label: the
  // second is the replay of the first, not a second successor identity.
  const successorEvents = h.events.filter((e) => e.detail?.includes("action=REVIEW_SUCCESSOR"));
  assert.equal(successorEvents.length, 2, JSON.stringify(successorEvents.map((e) => e.detail)));
  const labels = new Set(successorEvents.map((e) => (/label=(\S+?);/.exec(e.detail ?? "") ?? [])[1]));
  assert.deepEqual([...labels], [disputedSuccessorLabel(h.bookRunId)], JSON.stringify(successorEvents.map((e) => e.detail)));
});

requiredTest("R-288: under consent, a repair ordinal that fails with any OTHER code still fails closed — the dispute path is REPAIR_OUTPUT_NO_CHANGE only", async (context: TestContext) => {
  const book = "review-repair-declined-other-code";
  // The consent flag is set, so nothing but the CODE keeps this run out of the
  // successor path. A writer whose model call FAILED has told us nothing about
  // whether the defect is on the page, so it is not evidence against the review.
  const h = await buildBookRunHarness(context, book, ["FAIL", "PASS"], { repairFails: "REVIEW_REPAIR_MODEL_FAILED" });

  const flagged = await h.service.run({ ...h.request, reconcileUnsettled: true });
  assert.equal(flagged.ok, false, JSON.stringify(flagged));
  if (flagged.ok) throw new Error("a broken repair writer must never supersede the review that named the defect");
  assert.equal(flagged.error.code, "REVIEW_REPAIR_MODEL_FAILED", flagged.error.message);
  assert.equal(flagged.error.message.includes("DISPUTED"), false, flagged.error.message);
  assert.equal(
    h.events.some((e) => e.detail?.includes("action=REVIEW_SUCCESSOR")),
    false,
    JSON.stringify(h.events.filter((e) => e.detail?.includes("SUCCESSOR")).map((e) => e.detail)),
  );
  assert.equal(h.reviewCalls(), 1, "no panel is bought for a repair failure that is not a decline");
  assert.equal(h.repairCalls().length, 1, "and the lane fails closed on its own terminal answer");
});

// ───────────────────────────── R-290 ─────────────────────────────
//
// THE DISPUTE HAS TO REPLAY WITH THE WALK.
//
// A supersession is not a durable fork in the ordinal walk: it is a decision the
// loop made IN MEMORY, from the failure of one ordinal. On the next invocation
// the walk replays — ordinals are re-read from run state, in order — and the
// declining ordinal comes back as a plain FAILED one that the walk steps over
// (SKIP_FAILED_REPAIR_RUN), carrying the loop straight to the NEXT ordinal while
// `review` is still the DISPUTED review. That next ordinal is COMPLETED: it was
// executed, in the previous invocation, against the SUCCESSOR's verdict and a
// different chapter set. The port replays it, compares the targeted set derived
// from the failedReviewId it was handed against the attempts the run recorded,
// and refuses: REVIEW_REPAIR_COMPLETED_MISMATCH.
//
// Live Franklin (run book-run-39a37d06, 2026-09-20 07:30Z). Invocation N:
// ordinal 15 repaired ch14 against review-3406164e…, the writer declined, the
// dispute minted `disputed-review-3406164e…-successor-1` (review-6ac3f48f…,
// FAIL, one ch12 blocker), ordinal 16 repaired ch12 against THAT review and
// COMPLETED. Invocation N+1: ordinal 15 -> SKIP_FAILED_REPAIR_RUN, ordinal 16 ->
// REVIEW_REPAIR_REPLAY with failedReviewId=review-3406164e… -> "completed
// review-repair run attempts do not match exact targeted chapter set"
// ([repair-ch12] vs a targeted set of [ch14]). Three identical terminal lines,
// then the driver stopped the run as wedged.
//
// The fix: when the walk steps over a FAILED ordinal whose DURABLE terminal
// reason is the all-declined one, the loop re-applies that ordinal's dispute
// before spending anything — the successor label is keyed to the review, so the
// STORED verdict replays with zero model calls and the walk arrives at the next
// ordinal holding the same review it held the first time.

requiredTest("R-290: a dispute is RE-APPLIED when the ordinal walk replays it on a later resume, instead of mismatching the next ordinal", async (context: TestContext) => {
  const book = "review-repair-dispute-replays";
  // Panels, in call order: the base FAIL; the ONE successor panel the dispute
  // buys, which FAILs with its own (different) blockers; the re-review of the
  // ordinal that repairs those, which FAILs and hits the round cap; and finally
  // the re-review the SECOND invocation pays for, which passes.
  const h = await buildBookRunHarness(context, book, ["FAIL", "FAIL", "FAIL", "PASS"], {
    repairFailsPerCall: [DECLINED],
  });
  const baseReviewId = derivedIdOf("review", h.bookRunId);
  const successorReviewId = derivedIdOf("review", derivedIdOf(disputedSuccessorLabel(h.bookRunId), h.bookRunId));

  // ── Invocation N: dispute, successor FAIL, a real repair against it, cap ──
  const first = await h.service.run({ ...h.request, reconcileUnsettled: true });
  assert.equal(first.ok, false, JSON.stringify(first));
  if (first.ok) throw new Error("the round cap must stop invocation N short of a verdict");
  assert.equal(first.error.code, "BOOK_RUN_REVIEW_FAILED", first.error.message);
  assert.equal(h.repairCalls().length, 2, JSON.stringify(h.repairCalls().map((call) => call.repairRunId)));
  assert.equal(h.repairCalls()[0].failedReviewId, baseReviewId, "ordinal 1 repaired the DISPUTED review");
  assert.equal(h.repairCalls()[1].failedReviewId, successorReviewId, "ordinal 2 repaired the SUCCESSOR's verdict");
  assert.equal(h.reviewCalls(), 3, "base panel, the one successor panel, and the re-review");

  // ── Invocation N+1: the walk replays, and the dispute must replay with it ──
  const eventsBefore = h.events.length;
  const second = await h.service.run({ ...h.request, resumeRunId: h.bookRunId, reconcileUnsettled: true });
  const resumeEvents = h.events.slice(eventsBefore);
  assert.equal(
    second.ok,
    true,
    second.ok ? "" : `${second.error.code}:${second.error.message}`,
  );
  if (!second.ok) throw new Error("unreachable");
  assert.equal(second.value.status, "PROMOTED");
  // The wedge itself: the replayed ordinal 2 must be handed the review it was
  // executed against, never the disputed one.
  assert.equal(
    h.events.some((event) => event.detail?.includes("REVIEW_REPAIR_COMPLETED_MISMATCH")),
    false,
    JSON.stringify(h.events.filter((event) => event.detail?.includes("MISMATCH")).map((event) => event.detail)),
  );
  assert.equal(h.repairCalls()[2].repairRunId, h.reviewRepairRunId("review-repair-2"), "the walk replays ordinal 2");
  assert.equal(
    h.repairCalls()[2].failedReviewId,
    successorReviewId,
    "the replayed ordinal must be repaired against the SUCCESSOR review, exactly as it was executed",
  );
  // EXACTLY ONE dispute in this invocation, on the same review-keyed label...
  const disputes = resumeEvents.filter((event) => event.detail?.includes("reason=DISPUTED_REVIEW"));
  assert.equal(disputes.length, 1, JSON.stringify(resumeEvents.map((event) => event.detail)));
  assert.ok(
    disputes[0].detail?.includes(`label=${disputedSuccessorLabel(h.bookRunId)}`),
    disputes[0].detail,
  );
  assert.ok(disputes[0].detail?.includes(`predecessorReviewId=${baseReviewId}`), disputes[0].detail);
  // ...bought with ZERO fresh panel calls: the stored successor verdict replays.
  // The only new panel this invocation pays for is the re-review of the FRESH
  // ordinal it went on to spend.
  assert.equal(h.reviewCalls(), 4, "a replayed dispute must never buy a second panel on the same bytes");
  assert.equal(h.repairCalls().length, 4, JSON.stringify(h.repairCalls().map((call) => call.repairRunId)));
  assert.equal(h.repairCalls()[3].repairRunId, h.reviewRepairRunId("review-repair-3"), "and the walk continues past it");
});

requiredTest("R-290: WITHOUT consent the replayed dispute fails closed with the same DISPUTED remedy, spending nothing", async (context: TestContext) => {
  const book = "review-repair-dispute-replay-no-consent";
  const h = await buildBookRunHarness(context, book, ["FAIL", "FAIL", "FAIL", "PASS"], {
    repairFailsPerCall: [DECLINED],
  });

  const first = await h.service.run({ ...h.request, reconcileUnsettled: true });
  assert.equal(first.ok, false, JSON.stringify(first));
  assert.equal(h.repairCalls().length, 2, JSON.stringify(h.repairCalls().map((call) => call.repairRunId)));

  // The consent is per invocation. A resume WITHOUT it re-reads the same skipped
  // ordinal and answers exactly what the declining ordinal answered the first
  // time: the lane's own terminal code, the durable terminal reason it recorded,
  // and the R-179 remedy naming the flag and the case.
  const callsBefore = h.repairCalls().length;
  const panelsBefore = h.reviewCalls();
  const second = await h.service.run({ ...h.request, resumeRunId: h.bookRunId });
  assert.equal(second.ok, false, JSON.stringify(second));
  if (second.ok) throw new Error("a disputed review must never promote a book without consent");
  assert.equal(second.error.code, DECLINED, second.error.message);
  assert.ok(second.error.message.startsWith("replacement did not change chapter "), second.error.message);
  assert.match(second.error.message, /DISPUTED/, second.error.message);
  assert.match(second.error.message, /reconcile-unsettled/, second.error.message);
  assert.equal(h.repairCalls().length, callsBefore, "no ordinal is spent on a dispute the operator has not granted");
  assert.equal(h.reviewCalls(), panelsBefore, "and no panel is bought");
});

requiredTest("R-290: an all-declined ordinal that NEVER got a supersession is walked past, not superseded on the resume", async (context: TestContext) => {
  const book = "review-repair-declined-without-supersession";
  // THE LIVE FRANKLIN SHAPE THE FIRST TWO R-290 CASES DO NOT COVER.
  //
  // Both of those start from an invocation in which the dispute really was
  // applied, so a stored successor is waiting on disk. The live run carries the
  // other kind too: ordinal 8 died all-declined ("replacement did not change
  // chapter 6") against review-1720d489…, on code that had no DISPUTED path at
  // all, and the run then walked past it and COMPLETED ordinal 10 against THAT
  // SAME review — `disputed-review-1720d489…-successor-1` is not on disk and
  // never was. It is also the FIRST all-declined ordinal the walk meets, three
  // ordinals ahead of the one the fix exists for.
  //
  // So a re-application keyed only on "this ordinal died all-declined and its
  // STARTED event names the review I am holding" fires HERE: it buys a fresh
  // reader panel nobody asked for on the path whose whole contract is "the
  // stored successor replays with zero model calls", spends the single
  // MAX_DISPUTED_REVIEW_SUPERSESSIONS slot on it, and replaces the review the
  // NEXT ordinal's completed attempts were recorded against. The run never
  // reaches the ordinal it was supposed to un-wedge.
  //
  // The predicate has to be durable EVIDENCE THE SUPERSESSION HAPPENED — this
  // run's own review-phase STARTED event naming the review-keyed successor label
  // and reason=DISPUTED_REVIEW — and an ordinal with no such event must leave
  // the lane behaving exactly as it did before R-290.
  const h = await buildBookRunHarness(context, book, ["FAIL", "FAIL", "FAIL", "PASS"], {
    repairFailsPerCall: [DECLINED],
  });
  const baseReviewId = derivedIdOf("review", h.bookRunId);

  // ── Invocation one, NO consent: ordinal 1 declines and the run fails closed,
  // leaving the all-declined ordinal durable and NO successor anywhere. ──
  const first = await h.service.run({ ...h.request });
  assert.equal(first.ok, false, JSON.stringify(first));
  if (first.ok) throw new Error("a declined repair must never promote the book");
  assert.equal(first.error.code, DECLINED, first.error.message);
  assert.equal(h.events.some((e) => e.detail?.includes("action=REVIEW_SUCCESSOR")), false, "no successor was minted");

  // ── Invocation two, still NO consent: the walk steps over ordinal 1 and spends
  // FRESH ordinals against the SAME review — the pre-R-290 behaviour, which an
  // ordinal that never had a dispute must keep. ──
  const second = await h.service.run({ ...h.request, resumeRunId: h.bookRunId });
  assert.equal(second.ok, false, JSON.stringify(second));
  if (second.ok) throw new Error("the round cap must stop invocation two short of a verdict");
  assert.equal(second.error.code, "BOOK_RUN_REVIEW_FAILED", second.error.message);
  assert.equal(h.repairCalls().length, 3, JSON.stringify(h.repairCalls().map((call) => call.repairRunId)));
  assert.equal(h.repairCalls()[1].repairRunId, h.reviewRepairRunId("review-repair-2"), "the walk spent a fresh ordinal");
  assert.equal(
    h.repairCalls()[1].failedReviewId,
    baseReviewId,
    "and it repaired the SAME review the declined ordinal was handed",
  );

  // ── Invocation three, WITH consent: the flag is set, so nothing but the
  // evidence keeps ordinal 1 out of the successor path. ──
  const eventsBefore = h.events.length;
  const panelsBefore = h.reviewCalls();
  const third = await h.service.run({ ...h.request, resumeRunId: h.bookRunId, reconcileUnsettled: true });
  const resumeEvents = h.events.slice(eventsBefore);
  assert.equal(third.ok, true, third.ok ? "" : `${third.error.code}:${third.error.message}`);
  if (!third.ok) throw new Error("unreachable");
  assert.equal(third.value.status, "PROMOTED");
  // Nothing was superseded: no dispute event, no successor identity, no panel.
  assert.deepEqual(
    resumeEvents.filter((event) => event.detail?.includes("action=REVIEW_SUCCESSOR")).map((event) => event.detail),
    [],
    "an ordinal with no durable supersession must not acquire one on a resume",
  );
  assert.equal(
    h.reviewCalls(),
    panelsBefore + 1,
    "the only panel this invocation may buy is the re-review of the fresh ordinal it spends",
  );
  // And the walk still un-wedges: the completed ordinals replay against the
  // reviews they were executed against, with no mismatch.
  assert.equal(
    h.events.some((event) => event.detail?.includes("REVIEW_REPAIR_COMPLETED_MISMATCH")),
    false,
    JSON.stringify(h.events.filter((event) => event.detail?.includes("MISMATCH")).map((event) => event.detail)),
  );
  assert.equal(h.repairCalls()[3].repairRunId, h.reviewRepairRunId("review-repair-2"), "ordinal 2 replays");
  assert.equal(h.repairCalls()[3].failedReviewId, baseReviewId, "against the review it was executed against");
});

requiredTest("R-290: a REPLAYED supersession whose stored successor is gone fails closed instead of buying a panel", async (context: TestContext) => {
  const book = "review-repair-dispute-replay-successor-gone";
  // The replay path exists to RE-READ a verdict, not to roll one: the label is
  // keyed to the disputed review precisely so the second invocation costs zero
  // model calls. If the stored verdict is not there — deleted, or its landing
  // ordinal moved on past a stored ERROR — then "replay" is a fresh panel the
  // declining invocation already paid for, on bytes nothing has changed since.
  // The LAST scripted panel is a PASS, so a run that ever bought a re-roll here
  // would promote the book on it.
  const h = await buildBookRunHarness(context, book, ["FAIL", "FAIL", "FAIL", "PASS"], {
    repairFailsPerCall: [DECLINED],
  });
  const successorReviewId = derivedIdOf("review", derivedIdOf(disputedSuccessorLabel(h.bookRunId), h.bookRunId));

  const first = await h.service.run({ ...h.request, reconcileUnsettled: true });
  assert.equal(first.ok, false, JSON.stringify(first));
  assert.equal(h.reviewCalls(), 3, "the base panel, the one successor panel the dispute bought, and one re-review");

  // The supersession is still in the phase log; only its verdict is gone.
  h.deleteStoredReview(successorReviewId);
  const panelsBefore = h.reviewCalls();
  const second = await h.service.run({ ...h.request, resumeRunId: h.bookRunId, reconcileUnsettled: true });
  assert.equal(second.ok, false, JSON.stringify(second));
  if (second.ok) throw new Error("a resume must not promote a book on a panel it re-rolled");
  assert.equal(second.error.code, DECLINED, second.error.message);
  assert.ok(second.error.message.startsWith("replacement did not change chapter "), second.error.message);
  assert.match(second.error.message, /never buys a fresh reader panel/, second.error.message);
  assert.equal(h.reviewCalls(), panelsBefore, "and it buys no panel on the way to saying so");
});

// ───────────────────────────── R-289 ─────────────────────────────

requiredTest("R-289: the review-repair ORDINAL ceiling is an operator knob with the same fail-closed contract as the other budgets", () => {
  assert.equal(resolveReviewRepairOrdinals(), MAX_REVIEW_REPAIR_ORDINALS, "the compiled default is unchanged");
  assert.equal(MAX_REVIEW_REPAIR_ORDINALS, 20, "the default itself must not move");
  const name = "CHAPTERFLOW_REVIEW_REPAIR_ORDINALS";
  try {
    process.env[name] = "30";
    assert.equal(resolveReviewRepairOrdinals(), 30, "an operator override is honoured");
    process.env[name] = "";
    assert.equal(resolveReviewRepairOrdinals(), MAX_REVIEW_REPAIR_ORDINALS, "empty falls back to the default");
    process.env[name] = "abc";
    assert.throws(() => resolveReviewRepairOrdinals(), /not an integer/, "garbage fails closed, never silently defaults");
    process.env[name] = "0";
    assert.throws(() => resolveReviewRepairOrdinals(), /must be 1-50/, "zero would disable the lane silently");
    process.env[name] = "51";
    assert.throws(() => resolveReviewRepairOrdinals(), /must be 1-50/, "a typo must not mint identities forever");
  } finally {
    delete process.env[name];
  }
});

requiredTest("R-289: the ordinal knob caps the walk, is named in the exhaustion message, and is refused at INPUT when malformed", async (context: TestContext) => {
  const book = "review-repair-ordinal-knob";
  const h = await buildBookRunHarness(context, book, ["FAIL", "PASS"]);
  // Three spent ordinals, and a ceiling of three.
  for (const ordinal of [1, 2, 3]) await h.seedReviewRepairRun(`review-repair-${ordinal}`, "FAILED");

  await withEnv("CHAPTERFLOW_REVIEW_REPAIR_ORDINALS", "3", async () => {
    const result = await h.service.run({ ...h.request });
    assert.equal(result.ok, false, JSON.stringify(result));
    if (result.ok) throw new Error("an exhausted ordinal space must fail closed, never loop");
    assert.equal(result.error.code, "BOOK_RUN_REPAIR_UNAVAILABLE");
    assert.match(result.error.message, /after 3 ordinals/, result.error.message);
    // The remedy names the ORDINAL dial (the one that moves this wall) and its
    // own range, not the round dial that bounds spend.
    assert.match(result.error.message, /CHAPTERFLOW_REVIEW_REPAIR_ORDINALS \(1-50\)/, result.error.message);
    assert.equal(h.repairCalls().length, 0, "an exhausted ceiling must not re-enter a spent repair run");
    const past = await h.runStore.readRun(book, h.reviewRepairRunId("review-repair-4"), context.clock.now());
    assert.equal(past.ok, false, "the walk must not mint an ordinal past the operator's ceiling");
  });

  // R-177: a malformed ceiling is an INPUT error, refused before any model work.
  await withEnv("CHAPTERFLOW_REVIEW_REPAIR_ORDINALS", "abc", async () => {
    const result = await h.service.run({ ...h.request });
    assert.equal(result.ok, false, JSON.stringify(result));
    if (result.ok) throw new Error("a malformed ceiling must not run a book");
    assert.equal(result.error.code, "BOOK_RUN_INPUT_INVALID");
    assert.match(result.error.message, /CHAPTERFLOW_REVIEW_REPAIR_ORDINALS/, result.error.message);
  });
  await withEnv("CHAPTERFLOW_REVIEW_REPAIR_ORDINALS", "51", async () => {
    const result = await h.service.run({ ...h.request });
    assert.equal(result.ok, false, JSON.stringify(result));
    if (result.ok) throw new Error("an out-of-range ceiling must not run a book");
    assert.equal(result.error.code, "BOOK_RUN_INPUT_INVALID");
    assert.match(result.error.message, /CHAPTERFLOW_REVIEW_REPAIR_ORDINALS must be 1-50/, result.error.message);
  });
});

finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
