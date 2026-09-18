/**
 * Reader-panel BOUNDED CONCURRENCY — the panel's wall-clock lever, and the
 * determinism guard that has to survive it.
 *
 * WHY: one full reader-panel verdict is 57-85 sequential `claude -p` reads
 * (3 seats x 19 chapters, plus retries) at minutes per call — 6-7 h per verdict,
 * which is the single largest term in a ~1.5-day pipeline loop. Every one of
 * those reads is independent: a seat reads one rendered chapter document and
 * returns a score card; nothing it reads is produced by another seat or another
 * chapter.
 *
 * WHAT IS PINNED HERE (three facts, in order of what they protect):
 *   1. The reads actually overlap, and the overlap is BOUNDED. A pool that is
 *      unbounded would put 57 subscription-route subprocesses on the wall at
 *      once; a pool of 1 is the sequential panel this change exists to remove.
 *      The bound is `chapterConcurrency x READER_PANEL_SEATS.length` — chapters
 *      are the only operator-facing dial and seat fan-out is fixed at 3.
 *   2. The stored record does NOT depend on completion order. Concurrency makes
 *      completion order a scheduling artifact; the panel's per-seat arrays
 *      (`seatIds`, `composites`, `readerResultSha256s`, the finding unions) and
 *      the evaluator's `issues[]` are all order-carrying. The same seat outputs
 *      must produce byte-identical issues whether the fastest seat finishes
 *      first or last.
 *   3. Fail-closed survives. A provider block still stops the panel from
 *      launching NEW reads (it can no longer un-launch the reads already in
 *      flight, which is a real and deliberate change in what a blocked run
 *      costs), and any fatal seat still makes the whole panel ERROR. Pinned at a
 *      dial of 1 AND at a dial > 1 — a block at a dial of 1 cannot show the
 *      widened blast radius, so a suite that only tested that setting would be
 *      blind to the shipped default's actual behaviour.
 *   4. The dial is REACHABLE. A concurrency knob an operator cannot turn is not a
 *      mitigation: the `--reader-concurrency N` flag has to carry a value through
 *      `createProductionBookRunComposition` into the evaluator, or the documented
 *      response to a mid-run rate-limit ("lower the dial") is an edit-and-restart.
 *
 * WHAT IS NOT CLAIMED: byte-identical `issues[]` on a PROVIDER-BLOCKED path.
 * Which chapters were claimed before the block tripped is a scheduling artifact,
 * so the SET of error issues a blocked review stores varies run to run (their
 * ORDER is still chapter order). That path is ERROR, which both repair gates
 * refuse, so no verdict moves — but it is a real narrowing of the guarantee and
 * the tests below assert only what actually holds.
 */

import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createProductionBookRunComposition } from "../../src/app/bookRunComposition.js";
import {
  DEFAULT_PANEL_CHAPTER_CONCURRENCY,
  SemanticPanelReviewEvaluator,
} from "../../src/app/semanticPanelReviewEvaluator.js";
import type { CandidateInputFile, CandidateSnapshot } from "../../src/books/candidateTypes.js";
import type { ModelTaskContext } from "../../src/contracts/v4Core.js";
import type { ModelResult } from "../../src/runtime/modelResult.js";
import type { ModelTaskRunner } from "../../src/app/modelTaskRunner.js";
import type {
  CanonicalReviewEvaluation,
  CanonicalReviewEvaluator,
} from "../../src/review/reviewTypes.js";
import { REVIEW_FACTORS } from "../../src/artifacts/artifactTypes.js";
import { READER_PANEL_SEATS } from "../../src/review/laneOrchestrator.js";
import type { ChapterV21 } from "../../src/types.js";
import { makeGateCleanChapter } from "../helpers.js";
import { finishV25Tests, requiredTest } from "./harness.js";

const PIPELINE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const BOOK = "panel-concurrency-book";
const CANDIDATE = "panel-concurrency-candidate-1";
const DIGEST = "panel-concurrency-digest";
const CREATED = "2026-09-18T12:00:00.000Z";
const QUESTION_COUNT = makeGateCleanChapter("question-count-probe", 1).quiz.questions.length;
const SEAT_COUNT = READER_PANEL_SEATS.length;

function jsonFile(logicalPath: string, value: unknown, kind: CandidateInputFile["kind"] = "SIDECAR"): CandidateInputFile {
  return { kind, logicalPath, mediaType: "application/json", bytes: Buffer.from(`${JSON.stringify(value)}\n`) };
}

function buildCandidate(chapterCount: number): CandidateSnapshot {
  const chapters: ChapterV21[] = Array.from({ length: chapterCount }, (_value, index) =>
    makeGateCleanChapter(BOOK, index + 1));
  const files: CandidateInputFile[] = chapters.map((chapter) =>
    jsonFile(
      `content/chapters/${BOOK}-ch${String(chapter.number).padStart(2, "0")}.v21-native.chapter.json`,
      chapter,
      "CHAPTER",
    ));
  return {
    manifest: {
      schemaVersion: "1",
      bookId: BOOK,
      candidateId: CANDIDATE,
      createdByRunId: "run-panel-concurrency",
      entries: files.map(({ bytes, ...entry }) => ({ ...entry, byteLength: bytes.byteLength })),
      manifestDigest: DIGEST,
      createdAt: CREATED,
    },
    files: files.map((file) => ({ ...file, byteLength: file.bytes.byteLength })),
  };
}

function taskContext(): ModelTaskContext {
  return {
    bookId: BOOK,
    runId: "run-panel-concurrency",
    attemptId: "panel-base",
    stageId: "canonical-review",
    operationId: "canonical-review",
    workDir: "/tmp/panel-concurrency-workdir",
    signal: new AbortController().signal,
  };
}

function baselineStub(): CanonicalReviewEvaluator {
  const evaluation: CanonicalReviewEvaluation = { outcome: "PASS", issues: [] };
  return { async evaluate() { return { ok: true, value: evaluation }; } };
}

/** The chapter's own answer key as derivation letters, so a clean seat AGREES
 *  with the key and the quiz adjudicator raises nothing (the concurrency facts
 *  under test must not be buried under derivation blockers). */
function keyLetters(chapterNumber: number): string[] {
  return makeGateCleanChapter(BOOK, chapterNumber).quiz.questions.map((question) => "abc"[question.correctIndex]);
}

/** A schema-valid reader-experience content object for one lane. `advisory`
 *  makes the lane's output DISTINGUISHABLE: advisory findings are unioned in
 *  seat order and land in `issues[]` tagged with their seat, so a panel that
 *  collected seats in completion order rather than seat order would reorder
 *  these and the byte-comparison below would catch it. */
function readerContent(chapterNumber: number, advisory: string, score: number): Record<string, unknown> {
  const scores: Record<string, number> = {};
  for (const factor of REVIEW_FACTORS) scores[factor] = score;
  return {
    scores,
    quizDerivation: {
      answers: keyLetters(chapterNumber),
      mechanisms: Array.from({ length: QUESTION_COUNT }, (_value, index) => `the prose settles q${index + 1}`),
      confidence: Array.from({ length: QUESTION_COUNT }, () => "high"),
      ambiguities: Array.from({ length: QUESTION_COUNT }, () => ""),
      tells: [],
    },
    recommendation: "SHIP",
    blockingFindings: [],
    escalationSignals: [],
    advisoryFindings: [{ category: "pacing", unit: "deep read", problem: advisory, evidenceSpans: [] }],
    strongestEvidence: [],
    weakestEvidence: [],
    oneParagraphVerdict: "A clean, usable chapter.",
  };
}

/** The (chapter, seat) lane a reader call belongs to, read off the operation id
 *  and attempt id the panel builds — the same identity the run store sees. */
function laneOf(context: ModelTaskContext): { chapterNumber: number; seatId: string; laneKey: string } {
  const match = /^reader-review-ch(\d+)-(seat-[a-z]+)$/.exec(context.operationId);
  if (match === null) throw new Error(`unexpected reader operationId: ${context.operationId}`);
  const chapterNumber = Number(match[1]);
  const seatId = match[2];
  return { chapterNumber, seatId, laneKey: `ch${match[1]}/${seatId}` };
}

/** Deterministic lane ordinal: chapter-major, seat-minor — the order a
 *  SEQUENTIAL panel dispatches in, and the order the stored record must always
 *  be assembled in no matter what order the calls come back. */
function laneOrdinal(chapterNumber: number, seatId: string): number {
  const seatIndex = READER_PANEL_SEATS.findIndex((seat) => seat.id === seatId);
  if (seatIndex < 0) throw new Error(`unknown seat ${seatId}`);
  return (chapterNumber - 1) * SEAT_COUNT + seatIndex;
}

type LaneRunner = {
  readonly runner: ModelTaskRunner;
  /** Peak number of reader calls in flight at the same instant. */
  maxInFlight(): number;
  calls(): number;
  /** Lane keys in the order the runner was CALLED. */
  dispatched(): string[];
  /** Lane keys in the order the runner RETURNED. */
  completed(): string[];
};

/**
 * A reader runner that holds each call open for a per-lane delay, so the test
 * controls both how much overlap is observable and what order the calls come
 * back in. Every lane's content is a pure function of its (chapter, seat)
 * identity — never of arrival order — so the only thing `delayMs` can change is
 * the schedule.
 */
function laneRunner(options: Readonly<{
  delayMs: (lane: { chapterNumber: number; seatId: string; ordinal: number }) => number;
  fail?: (lane: { chapterNumber: number; seatId: string; ordinal: number }) => { code: string; message: string } | null;
  score?: (lane: { chapterNumber: number; seatId: string; ordinal: number }) => number;
}>): LaneRunner {
  let inFlight = 0;
  let maxInFlight = 0;
  let calls = 0;
  const dispatched: string[] = [];
  const completed: string[] = [];
  const runner: ModelTaskRunner = {
    async run(request): Promise<ModelResult> {
      const { chapterNumber, seatId, laneKey } = laneOf(request.context);
      const lane = { chapterNumber, seatId, ordinal: laneOrdinal(chapterNumber, seatId) };
      calls += 1;
      dispatched.push(laneKey);
      inFlight += 1;
      if (inFlight > maxInFlight) maxInFlight = inFlight;
      try {
        const wait = options.delayMs(lane);
        if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
        else await Promise.resolve();
        const failure = options.fail?.(lane) ?? null;
        if (failure !== null) {
          return { attemptId: request.context.attemptId, outcome: "FAILED", error: failure };
        }
        return {
          attemptId: request.context.attemptId,
          outcome: "SUCCEEDED",
          output: readerContent(chapterNumber, `advisory from ${laneKey}`, options.score?.(lane) ?? 80),
        };
      } finally {
        inFlight -= 1;
        completed.push(laneKey);
      }
    },
  };
  return {
    runner,
    maxInFlight: () => maxInFlight,
    calls: () => calls,
    dispatched: () => [...dispatched],
    completed: () => [...completed],
  };
}

requiredTest("reader reads overlap and the overlap is BOUNDED at chapterConcurrency x seats", async () => {
  const chapterCount = 4;
  const chapterConcurrency = 2;
  const candidate = buildCandidate(chapterCount);
  // Every read is held open for the same 20 ms, so the only thing that limits
  // how many are on the wall at once is the pool itself.
  const lanes = laneRunner({ delayMs: () => 20 });
  const evaluator = new SemanticPanelReviewEvaluator({
    baseline: baselineStub(),
    runner: lanes.runner,
    chapterConcurrency,
  });

  const evaluated = await evaluator.evaluate({ candidate, taskContext: taskContext() });
  assert.ok(evaluated.ok, JSON.stringify(evaluated));
  assert.equal(evaluated.value.outcome, "PASS", JSON.stringify(evaluated.value.issues));
  assert.equal(lanes.calls(), chapterCount * SEAT_COUNT);
  // THE LEVER: more than one read was in flight. On the sequential panel this is 1.
  assert.equal(
    lanes.maxInFlight(),
    chapterConcurrency * SEAT_COUNT,
    `expected the pool to hold exactly ${chapterConcurrency} x ${SEAT_COUNT} reads in flight, saw ${lanes.maxInFlight()}`,
  );
  // THE BOUND: it never exceeded the dial. An unbounded fan-out would put all
  // chapterCount x SEAT_COUNT subscription-route subprocesses on the wall.
  assert.ok(
    lanes.maxInFlight() < chapterCount * SEAT_COUNT,
    `the pool must stay bounded below the full ${chapterCount * SEAT_COUNT}-read fan-out, saw ${lanes.maxInFlight()}`,
  );
});

requiredTest("the default dial is the research lane's, and it is the only concurrency dial", async () => {
  // The panel copies the research stage's operator-facing default rather than
  // inventing one, and there is exactly ONE dial: seat fan-out is fixed at the
  // frozen seat count, so total concurrent subscription-route processes is
  // exactly DEFAULT_PANEL_CHAPTER_CONCURRENCY x READER_PANEL_SEATS.length.
  assert.equal(DEFAULT_PANEL_CHAPTER_CONCURRENCY, 3);
  const candidate = buildCandidate(4);
  const lanes = laneRunner({ delayMs: () => 20 });
  const evaluator = new SemanticPanelReviewEvaluator({ baseline: baselineStub(), runner: lanes.runner });
  const evaluated = await evaluator.evaluate({ candidate, taskContext: taskContext() });
  assert.ok(evaluated.ok, JSON.stringify(evaluated));
  assert.equal(lanes.maxInFlight(), DEFAULT_PANEL_CHAPTER_CONCURRENCY * SEAT_COUNT);
});

requiredTest("a non-positive concurrency dial is refused instead of silently coerced", () => {
  for (const bad of [0, -1, 1.5, Number.NaN]) {
    assert.throws(
      () => new SemanticPanelReviewEvaluator({
        baseline: baselineStub(),
        runner: laneRunner({ delayMs: () => 0 }).runner,
        chapterConcurrency: bad,
      }),
      /SEMANTIC_PANEL_CONCURRENCY_INVALID/,
      `chapterConcurrency ${String(bad)} must be refused`,
    );
  }
});

requiredTest("the issues array is byte-identical when the reads complete in REVERSE order", async () => {
  const chapterCount = 4;
  const candidate = buildCandidate(chapterCount);
  const laneCount = chapterCount * SEAT_COUNT;
  // Run A: every read returns immediately — completion order == dispatch order.
  const fast = laneRunner({ delayMs: () => 0 });
  const runA = await new SemanticPanelReviewEvaluator({
    baseline: baselineStub(),
    runner: fast.runner,
    chapterConcurrency: chapterCount,
  }).evaluate({ candidate, taskContext: taskContext() });
  // Run B: the LAST lane dispatched returns FIRST and the first returns last,
  // with every chapter in flight at once — completion order fully reversed.
  // 25 ms of separation per lane (not 5-6): a CI box running other suites in
  // parallel can delay a timer by more than a few milliseconds, and a flaky
  // determinism guard is worse than none.
  const reversed = laneRunner({ delayMs: (lane) => (laneCount - lane.ordinal) * 25 });
  const runB = await new SemanticPanelReviewEvaluator({
    baseline: baselineStub(),
    runner: reversed.runner,
    chapterConcurrency: chapterCount,
  }).evaluate({ candidate, taskContext: taskContext() });

  assert.ok(runA.ok && runB.ok, JSON.stringify({ runA, runB }));
  // The premise: the two runs really did complete in different orders.
  assert.notDeepEqual(
    reversed.completed(),
    fast.completed(),
    "the shuffle fixture did not actually change completion order — the test would prove nothing",
  );
  assert.deepEqual(
    reversed.completed(),
    [...fast.completed()].reverse(),
    JSON.stringify({ fast: fast.completed(), reversed: reversed.completed() }),
  );
  // The verdict: identical bytes. Per-seat arrays and finding unions are
  // assembled in chapter-then-seat order, never in completion order.
  assert.equal(
    JSON.stringify(runB.value.issues),
    JSON.stringify(runA.value.issues),
    JSON.stringify({ a: runA.value.issues, b: runB.value.issues }, null, 2),
  );
  // And the order really is the sequential one: chapter-major, seat-minor.
  const advisoryLocations = runA.value.issues
    .filter((entry) => entry.code.startsWith("READER.ADVISORY."))
    .map((entry) => entry.location);
  const expected: string[] = [];
  for (let chapterNumber = 1; chapterNumber <= chapterCount; chapterNumber += 1) {
    for (const seat of READER_PANEL_SEATS) {
      expected.push(`ch${String(chapterNumber).padStart(2, "0")}/${seat.id}/deep read`);
    }
  }
  assert.deepEqual(advisoryLocations, expected, JSON.stringify(advisoryLocations));
});

requiredTest("a PROVIDER BLOCK stops launching new chapter reads and the panel still ERRORs", async () => {
  const chapterCount = 4;
  const candidate = buildCandidate(chapterCount);
  const quotaMessage = "You've hit your weekly limit · resets Sep 1 at 8pm (America/Halifax) (api_error_status=429)";
  // ch01's first seat walks into the wall. With a dial of 1 no other chapter has
  // been claimed yet, so the stop is directly observable: only ch01 is read.
  const lanes = laneRunner({
    delayMs: () => 0,
    fail: (lane) => (lane.chapterNumber === 1 && lane.seatId === READER_PANEL_SEATS[0].id
      ? { code: "MODEL_PROCESS_FAILED", message: quotaMessage }
      : null),
  });
  const evaluated = await new SemanticPanelReviewEvaluator({
    baseline: baselineStub(),
    runner: lanes.runner,
    chapterConcurrency: 1,
    // A provider block must never be backed off and retried.
    sleep: async () => { throw new Error("a provider block must never be backed off and retried"); },
  }).evaluate({ candidate, taskContext: taskContext() });

  assert.ok(evaluated.ok, JSON.stringify(evaluated));
  assert.equal(evaluated.value.outcome, "ERROR");
  // The blocked chapter's OWN seats were already launched together (that is the
  // cost of the fan-out, and it is bounded); no LATER chapter was launched.
  assert.equal(lanes.calls(), SEAT_COUNT, JSON.stringify(lanes.dispatched()));
  assert.ok(lanes.dispatched().every((lane) => lane.startsWith("ch01/")), JSON.stringify(lanes.dispatched()));
  const infra = evaluated.value.issues.find((entry) => entry.code === "SEMANTIC_PANEL_READER_FAILED");
  assert.ok(infra, JSON.stringify(evaluated.value.issues));
  assert.match(infra!.message, /weekly limit/);
  assert.equal(
    evaluated.value.issues.some((entry) => !(entry.location ?? "ch01").startsWith("ch01")),
    false,
    JSON.stringify(evaluated.value.issues),
  );
});

requiredTest("a fatal seat still ERRORs the whole panel under concurrency, after in-flight reads settle", async () => {
  const chapterCount = 4;
  const candidate = buildCandidate(chapterCount);
  // ch02's middle seat is CANCELLED (never retried, always fatal). Its two
  // sibling seats are the SLOWEST reads in the panel, so if the panel returned
  // on the first rejection instead of waiting, they would still be in flight
  // when evaluate() resolved — which is exactly what finishRun refuses
  // (UNSETTLED_ATTEMPTS) once these calls are real gateway attempts.
  const lanes = laneRunner({
    delayMs: (lane) => (lane.chapterNumber === 2 && lane.seatId !== READER_PANEL_SEATS[1].id ? 30 : 0),
    fail: (lane) => (lane.chapterNumber === 2 && lane.seatId === READER_PANEL_SEATS[1].id
      ? { code: "MODEL_RUN_CANCELLED", message: "operator cancelled" }
      : null),
  });
  const evaluated = await new SemanticPanelReviewEvaluator({
    baseline: baselineStub(),
    runner: lanes.runner,
    chapterConcurrency: chapterCount,
  }).evaluate({ candidate, taskContext: taskContext() });

  assert.ok(evaluated.ok, JSON.stringify(evaluated));
  assert.equal(evaluated.value.outcome, "ERROR");
  // Every read this panel started has finished before evaluate() returned.
  assert.equal(lanes.completed().length, lanes.calls(), JSON.stringify(lanes.dispatched()));
  assert.equal(lanes.calls(), chapterCount * SEAT_COUNT, JSON.stringify(lanes.dispatched()));
  const failed = evaluated.value.issues.filter((entry) => entry.code === "SEMANTIC_PANEL_READER_FAILED");
  assert.equal(failed.length, 1, JSON.stringify(evaluated.value.issues));
  assert.equal(failed[0].location, "ch02");
  // An ordinary fatal seat is NOT a provider block: every other chapter was
  // still read and still carries its own record.
  for (const chapterNumber of [1, 3, 4]) {
    const location = `ch${String(chapterNumber).padStart(2, "0")}`;
    assert.ok(
      evaluated.value.issues.some((entry) => entry.code === "READER.PANEL.FACTOR_SCORES" && entry.location === location),
      `${location} must still carry its panel record: ${JSON.stringify(evaluated.value.issues)}`,
    );
  }
});

requiredTest("a PROVIDER BLOCK at a dial > 1 bounds the blast radius at the dial, and the record stays chapter-ordered", async () => {
  // The companion to the dial-of-1 case above, and the one that matters for the
  // SHIPPED default: at a dial of 1 a provider block cannot show the widened
  // blast radius (only one chapter was ever claimed), so that test cannot
  // distinguish "stopped early" from "stopped at the dial". This one can.
  const chapterCount = 6;
  const chapterConcurrency = 3;
  const candidate = buildCandidate(chapterCount);
  const quotaMessage = "You've hit your weekly limit \u00b7 resets Sep 1 at 8pm (America/Halifax) (api_error_status=429)";
  // The pool claims its first `chapterConcurrency` chapters SYNCHRONOUSLY (the
  // cursor advances before the first await), so ch01-ch03 are in flight and
  // ch04-ch06 are unclaimed when ch01 walks into the wall. ch01's blocked seat
  // fails immediately and its two siblings are the panel's FASTEST reads (10 ms),
  // so ch01's rejection — and with it `providerBlocked` — lands a clear 50 ms
  // before ch02/ch03 finish (60 ms). The gap is explicit wall-clock, not a
  // same-millisecond timer-ordering coincidence: a fixture whose counts depended
  // on scheduler tie-breaking would be exactly the flaky determinism guard this
  // file exists to avoid.
  const lanes = laneRunner({
    delayMs: (lane) => (lane.chapterNumber === 1
      ? (lane.seatId === READER_PANEL_SEATS[0].id ? 0 : 10)
      : 60),
    fail: (lane) => (lane.chapterNumber === 1 && lane.seatId === READER_PANEL_SEATS[0].id
      ? { code: "MODEL_PROCESS_FAILED", message: quotaMessage }
      : null),
  });
  const evaluated = await new SemanticPanelReviewEvaluator({
    baseline: baselineStub(),
    runner: lanes.runner,
    chapterConcurrency,
    sleep: async () => { throw new Error("a provider block must never be backed off and retried"); },
  }).evaluate({ candidate, taskContext: taskContext() });

  assert.ok(evaluated.ok, JSON.stringify(evaluated));
  assert.equal(evaluated.value.outcome, "ERROR");
  // THE BOUND: the wall was walked into by exactly the chapters the dial had
  // already claimed — not by the whole book. This is the honest cost of the
  // change (a sequential panel spent SEAT_COUNT calls here), and it is bounded
  // by the one dial an operator can lower.
  assert.equal(
    lanes.calls(),
    chapterConcurrency * SEAT_COUNT,
    JSON.stringify(lanes.dispatched()),
  );
  assert.ok(
    lanes.calls() > SEAT_COUNT,
    "a dial > 1 must actually demonstrate the widened blast radius, or this test proves nothing",
  );
  const claimed = new Set(lanes.dispatched().map((lane) => lane.slice(0, 4)));
  assert.deepEqual([...claimed].sort(), ["ch01", "ch02", "ch03"], JSON.stringify(lanes.dispatched()));
  // No read was abandoned in flight: every admitted attempt settled before
  // evaluate() returned (what finishRun enforces with UNSETTLED_ATTEMPTS).
  assert.equal(lanes.completed().length, lanes.calls(), JSON.stringify(lanes.dispatched()));
  // What IS still deterministic on the blocked path: the ORDER. Every issue the
  // blocked review stores is emitted in chapter order by phase 2, whatever order
  // the reads came back in. (The SET is schedule-dependent — see the file header;
  // that is not asserted here because it is not true.)
  // (Locations are chapter-major, seat-minor, and SEAT order is the frozen panel
  // order — not alphabetical — so the invariant is a non-decreasing chapter
  // number, not a sorted string list.)
  const chapterOf = (location: string): number => {
    const match = /^ch(\d{2})/.exec(location);
    if (match === null) throw new Error(`unexpected issue location: ${location}`);
    return Number(match[1]);
  };
  const chapterSequence = evaluated.value.issues
    .map((entry) => entry.location)
    .filter((location): location is string => typeof location === "string")
    .map(chapterOf);
  assert.ok(chapterSequence.length > 0, JSON.stringify(evaluated.value.issues));
  for (let index = 1; index < chapterSequence.length; index += 1) {
    assert.ok(
      chapterSequence[index] >= chapterSequence[index - 1],
      `issues must be emitted in chapter order, saw ${JSON.stringify(chapterSequence)}`,
    );
  }
  // Nothing beyond the claimed chapters produced a record.
  assert.equal(
    chapterSequence.some((chapterNumber) => chapterNumber > chapterConcurrency),
    false,
    JSON.stringify(chapterSequence),
  );
  const infra = evaluated.value.issues.find((entry) => entry.code === "SEMANTIC_PANEL_READER_FAILED");
  assert.ok(infra, JSON.stringify(evaluated.value.issues));
  assert.match(infra!.message, /weekly limit/);
});

requiredTest("the dial an operator supplies reaches the panel evaluator through the production composition", async ({ roots }) => {
  // A dial nothing can set is not a mitigation. The CLI flag's value has to
  // travel cli.ts -> createProductionBookRunComposition -> the evaluator's
  // constructor, and the pass-through branch that carries it must be EXECUTED by
  // a test rather than shipped dead.
  //
  // The proof is the refusal: SEMANTIC_PANEL_CONCURRENCY_INVALID is thrown in
  // exactly one place in the pipeline (the evaluator's constructor), so a
  // composition that rejects a dial of 0 has demonstrably handed its own input to
  // `new SemanticPanelReviewEvaluator({ chapterConcurrency })`. Drop the
  // pass-through and this composition builds happily on the default instead.
  const base = {
    bookId: "panel-dial-book",
    pipelineRoot: PIPELINE_ROOT,
    v25Root: resolve(roots.tempRoot, "panel-dial-v25"),
    attemptRoot: resolve(roots.attemptsRoot, "panel-dial-attempts"),
  };
  for (const bad of [0, -1, 1.5]) {
    await assert.rejects(
      createProductionBookRunComposition({ ...base, readerPanelChapterConcurrency: bad }),
      /SEMANTIC_PANEL_CONCURRENCY_INVALID/,
      `readerPanelChapterConcurrency ${bad} must be refused at the composition boundary`,
    );
  }
  // And a valid dial composes: the option is accepted, not merely validated.
  const composed = await createProductionBookRunComposition({ ...base, readerPanelChapterConcurrency: 1 });
  assert.ok(composed.app.bookRun, "a supplied dial must not break the book-run binding");
});

finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
