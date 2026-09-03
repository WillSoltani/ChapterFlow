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
  resolveOperatorCompileRetries,
  resolveQcJudgeRuns,
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

finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
