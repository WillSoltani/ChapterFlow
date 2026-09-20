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
import { writeFileSync } from "node:fs";

import {
  MAX_REVIEW_REPAIR_ORDINALS,
  resolveOperatorCompileRetries,
  resolveQcJudgeRuns,
  resolveReviewRepairOrdinals,
} from "../../src/app/bookRunApplicationService.js";
import { buildBookRunHarness, derivedIdOf } from "./bookRunRepairRig.js";
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

  // Invocation two: the declining ordinals are durably FAILED, so the walk MUST
  // spend a fresh ordinal — but the dispute is the same stored review, so the
  // successor label is the same and its stored verdict is replayed.
  const second = await h.service.run({ ...h.request, resumeRunId: h.bookRunId, reconcileUnsettled: true });
  assert.equal(second.ok, false, JSON.stringify(second));
  if (second.ok) throw new Error("a resume must not promote a book by re-rolling the panel that already judged it");
  assert.equal(
    h.reviewCalls(),
    2,
    "a re-disputed review must REPLAY its stored successor verdict, never buy another panel on the same bytes",
  );
  // The resume really did reach the repair lane (the bound is the panel, not the run).
  assert.equal(h.repairCalls().length, 4, JSON.stringify(h.repairCalls().map((call) => call.repairRunId)));
  assert.equal(h.repairCalls()[2].repairRunId, h.reviewRepairRunId("review-repair-3"), "the walk still spends a fresh ordinal");
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
