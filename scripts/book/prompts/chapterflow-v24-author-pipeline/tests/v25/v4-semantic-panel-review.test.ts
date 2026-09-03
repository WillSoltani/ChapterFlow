import assert from "node:assert/strict";

import { SemanticPanelReviewEvaluator } from "../../src/app/semanticPanelReviewEvaluator.js";
import type { CandidateInputFile, CandidateSnapshot } from "../../src/books/candidateTypes.js";
import type { ModelTaskContext } from "../../src/contracts/v4Core.js";
import type { ModelResult } from "../../src/runtime/modelResult.js";
import type { ModelTaskRunner } from "../../src/app/modelTaskRunner.js";
import type {
  CanonicalReviewEvaluation,
  CanonicalReviewEvaluator,
} from "../../src/review/reviewTypes.js";
import { REVIEW_FACTORS } from "../../src/artifacts/artifactTypes.js";
import { MAX_READER_SEAT_ATTEMPTS } from "../../src/review/laneOrchestrator.js";
import type { ChapterV21 } from "../../src/types.js";
import { makeGateCleanChapter } from "../helpers.js";
import { finishV25Tests, requiredTest } from "./harness.js";

const BOOK = "semantic-panel-book";
const CANDIDATE = "semantic-panel-candidate-1";
const DIGEST = "semantic-panel-digest";
const CREATED = "2026-07-21T12:00:00.000Z";

function jsonFile(logicalPath: string, value: unknown, kind: CandidateInputFile["kind"] = "SIDECAR"): CandidateInputFile {
  return { kind, logicalPath, mediaType: "application/json", bytes: Buffer.from(`${JSON.stringify(value)}\n`) };
}

/** Two-chapter immutable candidate snapshot (mirrors the qc-evaluator helper). */
function buildCandidate(chapters: readonly ChapterV21[]): CandidateSnapshot {
  const files: CandidateInputFile[] = chapters.map((chapter) =>
    jsonFile(
      `content/chapters/${BOOK}-ch${String(chapter.number).padStart(2, "0")}.v21-native.chapter.json`,
      chapter,
      "CHAPTER",
    ),
  );
  return {
    manifest: {
      schemaVersion: "1",
      bookId: BOOK,
      candidateId: CANDIDATE,
      createdByRunId: "run-semantic-panel",
      entries: files.map(({ bytes, ...entry }) => ({ ...entry, byteLength: bytes.byteLength })),
      manifestDigest: DIGEST,
      createdAt: CREATED,
    },
    files: files.map((file) => ({ ...file, byteLength: file.bytes.byteLength })),
  };
}

function twoChapterCandidate(): CandidateSnapshot {
  return buildCandidate([makeGateCleanChapter(BOOK, 1), makeGateCleanChapter(BOOK, 2)]);
}

function taskContext(): ModelTaskContext {
  return {
    bookId: BOOK,
    runId: "run-semantic-panel",
    attemptId: "panel-base",
    stageId: "canonical-review",
    operationId: "canonical-review",
    workDir: "/tmp/semantic-panel-workdir",
    signal: new AbortController().signal,
  };
}

/** A CanonicalReviewEvaluator stub whose outcome/issues the test controls. */
function baselineStub(evaluation: CanonicalReviewEvaluation, onCall?: () => void): CanonicalReviewEvaluator {
  return {
    async evaluate() {
      onCall?.();
      return { ok: true, value: evaluation };
    },
  };
}

type ReaderOverrides = {
  blockingFindings?: unknown[];
  advisoryFindings?: unknown[];
  escalationSignals?: unknown[];
  recommendation?: string;
  /** Uniform per-factor score; every weight sums to 100 so the composite equals
   *  this value. Defaults to the chapter bar (80) so the panel median passes. */
  score?: number;
  /** Per-factor overrides applied on top of `score` — the only way to build a
   *  panel whose factors are UNEVEN, which is what the factor-median line exists
   *  to expose. */
  scoreOverrides?: Record<string, number>;
};

/** A schema-valid reader-experience content object (the runtime stamps the
 *  schema/reviewerRole/rubricVersion + hash bindings on top). */
function readerContent(overrides: ReaderOverrides = {}): Record<string, unknown> {
  const scores: Record<string, number> = {};
  for (const factor of REVIEW_FACTORS) scores[factor] = overrides.scoreOverrides?.[factor] ?? overrides.score ?? 80;
  return {
    scores,
    quizDerivation: { answers: [], mechanisms: [], confidence: [], ambiguities: [], tells: [] },
    recommendation: overrides.recommendation ?? "SHIP",
    blockingFindings: overrides.blockingFindings ?? [],
    escalationSignals: overrides.escalationSignals ?? [],
    advisoryFindings: overrides.advisoryFindings ?? [],
    strongestEvidence: [],
    weakestEvidence: [],
    oneParagraphVerdict: "A clean, usable chapter.",
  };
}

/** A runner scripted with an ordered queue of reader outputs. Records every
 *  reader-task prompt so the panel's reader-lane wiring is observable. */
function scriptedRunner(outputs: readonly unknown[]): {
  runner: ModelTaskRunner;
  calls: number;
  prompts: string[];
} {
  const queue = [...outputs];
  const state = { runner: undefined as unknown as ModelTaskRunner, calls: 0, prompts: [] as string[] };
  state.runner = {
    async run(request): Promise<ModelResult> {
      state.calls += 1;
      const task = request.prompt.inputs.find((input) => input.name === "system_prompt");
      if (task) state.prompts.push(new TextDecoder().decode(task.bytes));
      const output = queue.shift();
      if (output === undefined) {
        return {
          attemptId: request.context.attemptId,
          outcome: "FAILED",
          error: { code: "SCRIPT_EXHAUSTED", message: "no scripted reader output remaining" },
        };
      }
      if (typeof output === "string" && output === "__MODEL_FAIL__") {
        return {
          attemptId: request.context.attemptId,
          outcome: "FAILED",
          error: { code: "READER_MODEL_DOWN", message: "injected reader model failure" },
        };
      }
      if (typeof output === "object" && output !== null && "__fail" in output) {
        const fail = (output as { __fail: { outcome: ModelResult["outcome"]; code: string; message?: string } }).__fail;
        // R-001: the gateway now hands the PROVIDER'S OWN WORDS to the reader
        // lane on a non-zero exit, and the lane classifies on that text, so a
        // scripted failure has to be able to carry a specific message.
        return {
          attemptId: request.context.attemptId,
          outcome: fail.outcome,
          error: { code: fail.code, message: fail.message ?? "injected transient reader failure" },
        };
      }
      return { attemptId: request.context.attemptId, outcome: "SUCCEEDED", output };
    },
  };
  return state as { runner: ModelTaskRunner; calls: number; prompts: string[] };
}

requiredTest("semantic panel passes when baseline passes and every reader review is clean", async () => {
  const candidate = twoChapterCandidate();
  // Three reader seats per chapter (IMP-20 blind panel); one seat of ch1 raises
  // a single advisory, the other five reads are clean.
  const scripted = scriptedRunner([
    readerContent({ advisoryFindings: [{ category: "pacing", unit: "deep read", problem: "slightly slow open", evidenceSpans: [] }] }),
    readerContent(),
    readerContent(),
    readerContent(),
    readerContent(),
    readerContent(),
  ]);
  const evaluator = new SemanticPanelReviewEvaluator({
    baseline: baselineStub({ outcome: "PASS", issues: [{ code: "BASE.note", severity: "WARN", message: "baseline advisory" }] }),
    runner: scripted.runner,
  });

  const evaluated = await evaluator.evaluate({ candidate, taskContext: taskContext() });
  assert.ok(evaluated.ok, JSON.stringify(evaluated));
  assert.equal(evaluated.value.outcome, "PASS");
  // three reader seats per chapter × two chapters
  assert.equal(scripted.calls, 6);
  // reader-experience task prompt is what crossed the runner seam
  assert.ok(scripted.prompts.every((prompt) => prompt.includes("READER-EXPERIENCE REVIEW")), JSON.stringify(scripted.prompts));
  // baseline WARN + reader advisory WARN both surfaced
  assert.ok(evaluated.value.issues.some((issue) => issue.code === "BASE.note" && issue.severity === "WARN"));
  const advisory = evaluated.value.issues.filter((issue) => issue.severity === "WARN" && issue.code.startsWith("READER.ADVISORY"));
  assert.equal(advisory.length, 1, JSON.stringify(evaluated.value.issues));
  assert.equal(evaluated.value.issues.some((issue) => issue.severity === "BLOCKER"), false);
});

requiredTest("semantic panel is ERROR when a reader run is unparseable", async () => {
  const candidate = twoChapterCandidate();
  // The first seat of ch1 is unparseable on EVERY attempt: since the seat schema
  // retry (#463) an unparseable read is retried up to MAX_READER_SEAT_ATTEMPTS
  // before it throws, so the fixture must stay unparseable across the WHOLE
  // budget — derived from the constant, never a literal — or the retry would
  // consume a clean entry and the seat would recover. ch1 then errors; ch2's
  // three seats still run clean.
  const scripted = scriptedRunner([
    ...Array.from({ length: MAX_READER_SEAT_ATTEMPTS }, () => "this is not reader-review JSON"),
    readerContent(), readerContent(), readerContent(),
  ]);
  const evaluator = new SemanticPanelReviewEvaluator({
    baseline: baselineStub({ outcome: "PASS", issues: [] }),
    runner: scripted.runner,
  });
  const evaluated = await evaluator.evaluate({ candidate, taskContext: taskContext() });
  assert.ok(evaluated.ok, JSON.stringify(evaluated));
  assert.equal(evaluated.value.outcome, "ERROR");
  assert.ok(evaluated.value.issues.some((issue) => issue.code === "SEMANTIC_PANEL_READER_UNPARSEABLE"), JSON.stringify(evaluated.value.issues));
});

requiredTest("semantic panel is ERROR when a reader run fails to execute", async () => {
  const candidate = twoChapterCandidate();
  // The first seat of ch1 fails to execute → ch1 errors; ch2's three seats run clean.
  const scripted = scriptedRunner(["__MODEL_FAIL__", readerContent(), readerContent(), readerContent()]);
  const evaluator = new SemanticPanelReviewEvaluator({
    baseline: baselineStub({ outcome: "PASS", issues: [] }),
    runner: scripted.runner,
  });
  const evaluated = await evaluator.evaluate({ candidate, taskContext: taskContext() });
  assert.ok(evaluated.ok, JSON.stringify(evaluated));
  assert.equal(evaluated.value.outcome, "ERROR");
  assert.ok(evaluated.value.issues.some((issue) => issue.code === "SEMANTIC_PANEL_READER_FAILED"), JSON.stringify(evaluated.value.issues));
});

requiredTest("semantic panel FAILS with a BLOCKER when a reader flags an on-page blocker", async () => {
  const candidate = twoChapterCandidate();
  // One seat of ch1 raises an on-page blocker; the union blocks (fail-closed).
  const scripted = scriptedRunner([
    readerContent({
      recommendation: "BLOCK",
      blockingFindings: [{ category: "internal_contradiction", unit: "deep read", problem: "claims A then not-A on the same page", evidenceSpans: [] }],
    }),
    readerContent(),
    readerContent(),
    readerContent(),
    readerContent(),
    readerContent(),
  ]);
  const evaluator = new SemanticPanelReviewEvaluator({
    baseline: baselineStub({ outcome: "PASS", issues: [] }),
    runner: scripted.runner,
  });
  const evaluated = await evaluator.evaluate({ candidate, taskContext: taskContext() });
  assert.ok(evaluated.ok, JSON.stringify(evaluated));
  assert.equal(evaluated.value.outcome, "FAIL");
  assert.ok(evaluated.value.issues.some(
    (issue) => issue.code === "READER.BLOCKING.internal_contradiction" && issue.severity === "BLOCKER",
  ), JSON.stringify(evaluated.value.issues));
});

requiredTest("semantic panel FAILS when the 3-reader panel MEDIAN composite is below the chapter bar, even with no categorized blocking finding", async () => {
  const candidate = twoChapterCandidate();
  // ch1's three seats each return a low composite (20) with NO blocking finding;
  // the median (20) is below the chapter bar (80) so the chapter must fail on the
  // median alone. ch2's three seats are clean at the bar.
  const scripted = scriptedRunner([
    readerContent({ score: 20 }),
    readerContent({ score: 20 }),
    readerContent({ score: 20 }),
    readerContent(),
    readerContent(),
    readerContent(),
  ]);
  const evaluator = new SemanticPanelReviewEvaluator({
    baseline: baselineStub({ outcome: "PASS", issues: [] }),
    runner: scripted.runner,
  });
  const evaluated = await evaluator.evaluate({ candidate, taskContext: taskContext() });
  assert.ok(evaluated.ok, JSON.stringify(evaluated));
  assert.equal(evaluated.value.outcome, "FAIL");
  // The verdict was decided by the MEDIAN floor, not by any named blocking finding.
  const floorBlockers = evaluated.value.issues.filter(
    (issue) => issue.code === "READER.PANEL.BELOW_FLOOR" && issue.severity === "BLOCKER",
  );
  assert.equal(floorBlockers.length, 1, JSON.stringify(evaluated.value.issues));
  assert.ok(floorBlockers[0].location === "ch01", JSON.stringify(floorBlockers[0]));
  // No categorized reader blocking finding was raised — the median alone failed it.
  assert.equal(
    evaluated.value.issues.some((issue) => issue.code.startsWith("READER.BLOCKING.")),
    false,
    JSON.stringify(evaluated.value.issues),
  );
  // ch2 (clean at the bar) raised no floor blocker.
  assert.equal(floorBlockers.some((issue) => issue.location === "ch02"), false);
});

requiredTest("semantic panel PASSES when the panel median sits exactly on the chapter bar", async () => {
  const candidate = twoChapterCandidate();
  // Seat composites 80/80/80 → median 80 == bar; the floor is a strict `< bar`.
  const scripted = scriptedRunner([
    readerContent({ score: 80 }),
    readerContent({ score: 80 }),
    readerContent({ score: 80 }),
    readerContent({ score: 80 }),
    readerContent({ score: 80 }),
    readerContent({ score: 80 }),
  ]);
  const evaluator = new SemanticPanelReviewEvaluator({
    baseline: baselineStub({ outcome: "PASS", issues: [] }),
    runner: scripted.runner,
  });
  const evaluated = await evaluator.evaluate({ candidate, taskContext: taskContext() });
  assert.ok(evaluated.ok, JSON.stringify(evaluated));
  assert.equal(evaluated.value.outcome, "PASS");
  assert.equal(
    evaluated.value.issues.some((issue) => issue.code === "READER.PANEL.BELOW_FLOOR"),
    false,
    JSON.stringify(evaluated.value.issues),
  );
});

requiredTest("semantic panel recovers a transient reader failure via bounded retry and still PASSes (finding 38 LAYER A)", async () => {
  const candidate = twoChapterCandidate();
  // ch1 seat-cold's FIRST read fails transiently (MODEL_PROCESS_FAILED); its
  // bounded retry succeeds. Previously this one blip fail-closed the whole review
  // to ERROR. The other reads are clean.
  const scripted = scriptedRunner([
    { __fail: { outcome: "FAILED", code: "MODEL_PROCESS_FAILED" } },
    readerContent(),
    readerContent(),
    readerContent(),
    readerContent(),
    readerContent(),
    readerContent(),
  ]);
  const evaluator = new SemanticPanelReviewEvaluator({
    baseline: baselineStub({ outcome: "PASS", issues: [] }),
    runner: scripted.runner,
    sleep: async () => {},
  });
  const evaluated = await evaluator.evaluate({ candidate, taskContext: taskContext() });
  assert.ok(evaluated.ok, JSON.stringify(evaluated));
  assert.equal(evaluated.value.outcome, "PASS");
  // 1 transient + retry + 5 more clean reads = 7 calls.
  assert.equal(scripted.calls, 7, "the transient seat was retried, not fail-closed");
  assert.equal(evaluated.value.issues.some((issue) => issue.severity === "BLOCKER"), false, JSON.stringify(evaluated.value.issues));
});

requiredTest("semantic panel stays ERROR (fail-closed) when a reader exhausts its bounded retry", async () => {
  const candidate = twoChapterCandidate();
  // ch1 seat-cold fails transiently on every one of its bounded attempts → the
  // seat still errors and the panel fail-closes to ERROR (retry does not weaken
  // the gate; it only recovers a blip that clears).
  const scripted = scriptedRunner([
    ...Array.from({ length: MAX_READER_SEAT_ATTEMPTS }, () => ({ __fail: { outcome: "TIMED_OUT", code: "MODEL_PROCESS_FAILED" } })),
    readerContent(),
    readerContent(),
    readerContent(),
  ]);
  const evaluator = new SemanticPanelReviewEvaluator({
    baseline: baselineStub({ outcome: "PASS", issues: [] }),
    runner: scripted.runner,
    sleep: async () => {},
  });
  const evaluated = await evaluator.evaluate({ candidate, taskContext: taskContext() });
  assert.ok(evaluated.ok, JSON.stringify(evaluated));
  assert.equal(evaluated.value.outcome, "ERROR");
  assert.ok(evaluated.value.issues.some((issue) => issue.code === "SEMANTIC_PANEL_READER_FAILED"), JSON.stringify(evaluated.value.issues));
});

requiredTest("R-224/R-001: a provider-blocked reader seat STOPS the panel instead of burning one seat on every remaining chapter", async () => {
  const candidate = twoChapterCandidate();
  // The live 2026-08-28 envelope text, as the gateway now preserves it through a
  // NON-ZERO exit. Two facts are pinned together here:
  //   1. the seat does NOT consume its bounded retry budget — `isTransientReaderModelResult`
  //      sees the provider's words and refuses to re-attempt (the `sleep` below
  //      throws, so any backoff would fail the test loudly);
  //   2. the PANEL stops. Before this change the catch in the evaluator did
  //      `continue`, so every remaining chapter still opened a seat against the
  //      same exhausted window — one wasted provider call per chapter, per
  //      operator round, on a wall that cannot clear inside the run.
  const quotaMessage = "You've hit your weekly limit \u00b7 resets Sep 1 at 8pm (America/Halifax) (api_error_status=429)";
  const scripted = scriptedRunner([
    { __fail: { outcome: "FAILED", code: "MODEL_PROCESS_FAILED", message: quotaMessage } },
    readerContent(), readerContent(), readerContent(),
    readerContent(), readerContent(), readerContent(),
  ]);
  const evaluator = new SemanticPanelReviewEvaluator({
    baseline: baselineStub({ outcome: "PASS", issues: [] }),
    runner: scripted.runner,
    sleep: async () => { throw new Error("a provider block must never be backed off and retried"); },
  });

  const evaluated = await evaluator.evaluate({ candidate, taskContext: taskContext() });

  assert.ok(evaluated.ok, JSON.stringify(evaluated));
  // Uncertainty, not a verdict: ERROR is what the two repair gates refuse.
  assert.equal(evaluated.value.outcome, "ERROR");
  assert.equal(scripted.calls, 1, "a provider block must cost exactly one seat call for the whole panel");
  const infra = evaluated.value.issues.find((entry) => entry.code === "SEMANTIC_PANEL_READER_FAILED");
  assert.ok(infra, JSON.stringify(evaluated.value.issues));
  // The operator reads the provider's own words rather than an opaque sentence.
  assert.match(infra!.message, /weekly limit/);
  assert.match(infra!.message, /resets Sep 1 at 8pm/);
  // Nothing was recorded against a chapter the panel never read.
  assert.equal(
    evaluated.value.issues.some((entry) => (entry.location ?? "").startsWith("ch02")),
    false,
    JSON.stringify(evaluated.value.issues),
  );
});

requiredTest("R-224: an ordinary reader-lane failure still reads every remaining chapter — only a PROVIDER BLOCK stops the panel", async () => {
  const candidate = twoChapterCandidate();
  // Negative control for the stop above. A one-off seat failure carries no
  // provider block, so the panel keeps reading: the early stop must be
  // message-classified, not "any throw ends the panel".
  const scripted = scriptedRunner([
    "__MODEL_FAIL__",
    readerContent(), readerContent(), readerContent(),
    readerContent(), readerContent(), readerContent(),
  ]);
  const evaluator = new SemanticPanelReviewEvaluator({
    baseline: baselineStub({ outcome: "PASS", issues: [] }),
    runner: scripted.runner,
  });

  const evaluated = await evaluator.evaluate({ candidate, taskContext: taskContext() });

  assert.ok(evaluated.ok, JSON.stringify(evaluated));
  assert.equal(evaluated.value.outcome, "ERROR");
  // ch01 seat 1 failed; ch02's three seats still ran.
  assert.equal(scripted.calls, 4);
  assert.ok(
    evaluated.value.issues.some((entry) => (entry.location ?? "").startsWith("ch02")),
    JSON.stringify(evaluated.value.issues),
  );
});

requiredTest("semantic panel short-circuits on a baseline non-PASS and runs zero reader tasks", async () => {
  const candidate = twoChapterCandidate();
  const scripted = scriptedRunner([readerContent(), readerContent()]);
  let baselineCalls = 0;
  const evaluator = new SemanticPanelReviewEvaluator({
    baseline: baselineStub(
      { outcome: "FAIL", issues: [{ code: "BASE.blocker", severity: "BLOCKER", message: "baseline blocked" }] },
      () => { baselineCalls += 1; },
    ),
    runner: scripted.runner,
  });
  const evaluated = await evaluator.evaluate({ candidate, taskContext: taskContext() });
  assert.ok(evaluated.ok, JSON.stringify(evaluated));
  assert.equal(evaluated.value.outcome, "FAIL");
  assert.equal(baselineCalls, 1);
  // The reader lane never runs when the baseline did not PASS.
  assert.equal(scripted.calls, 0);
});

requiredTest("a below-floor chapter also carries its per-factor medians, weakest first", async () => {
  const candidate = twoChapterCandidate();
  // ch1: transfer and practical are collapsed while the rest sit at the bar, so
  // the composite lands under the floor for a REASON the composite cannot state.
  // Seat scores differ per seat so the per-factor MEDIAN (not a single seat's
  // opinion) is what the line reports.
  const uneven = (transfer: number, practical: number) =>
    readerContent({ scoreOverrides: { transfer, practical, retention: 40 } });
  const scripted = scriptedRunner([
    uneven(10, 30),
    uneven(20, 20),
    uneven(30, 10),
    readerContent(),
    readerContent(),
    readerContent(),
  ]);
  const evaluator = new SemanticPanelReviewEvaluator({
    baseline: baselineStub({ outcome: "PASS", issues: [] }),
    runner: scripted.runner,
  });
  const evaluated = await evaluator.evaluate({ candidate, taskContext: taskContext() });
  assert.ok(evaluated.ok, JSON.stringify(evaluated));
  assert.equal(evaluated.value.outcome, "FAIL");

  const chapterOne = evaluated.value.issues.filter(
    (issue) => issue.code === "READER.PANEL.FACTOR_SCORES" && issue.location === "ch01",
  );
  assert.equal(chapterOne.length, 1, JSON.stringify(evaluated.value.issues));
  // Diagnosis, never a gate: it must be a WARN, or a description of the scores
  // would start failing chapters on its own.
  assert.equal(chapterOne[0].severity, "WARN");
  // The medians are the middle seat value per factor: transfer 20, practical 20.
  assert.match(chapterOne[0].message, /factor medians weakest-first: (transfer 20, practical 20|practical 20, transfer 20), retention 40,/, chapterOne[0].message);
});

/**
 * The emission is UNCONDITIONAL, and that is the fix, not an oversight.
 *
 * A QC round can only be minted from a PASSING canonical review (qcService
 * QC_JOIN_MISMATCH / CandidateQcEvaluator CANDIDATE_QC_CANONICAL_PASS_REQUIRED),
 * the book-run service stops at BOOK_RUN_REVIEW_FAILED on any non-PASS review,
 * and repair reads a committed QC round. So the review shape repair reads is
 * always a PASS — and a PASS review has no BLOCKER on it at all. A per-factor
 * diagnosis emitted only for a chapter the panel BLOCKED can therefore never be
 * read by the lane it was built for.
 */
requiredTest("EVERY chapter the panel reads carries its per-factor medians — including the ones it passed", async () => {
  const candidate = twoChapterCandidate();
  const scripted = scriptedRunner(Array.from({ length: 6 }, () => readerContent()));
  const evaluator = new SemanticPanelReviewEvaluator({
    baseline: baselineStub({ outcome: "PASS", issues: [] }),
    runner: scripted.runner,
  });
  const evaluated = await evaluator.evaluate({ candidate, taskContext: taskContext() });
  assert.ok(evaluated.ok, JSON.stringify(evaluated));
  assert.equal(evaluated.value.outcome, "PASS");
  const factorIssues = evaluated.value.issues.filter((issue) => issue.code === "READER.PANEL.FACTOR_SCORES");
  assert.deepEqual(factorIssues.map((issue) => issue.location), ["ch01", "ch02"], JSON.stringify(evaluated.value.issues));
  assert.ok(factorIssues.every((issue) => issue.severity === "WARN"), JSON.stringify(factorIssues));
  // The line states the bar it was measured against, so a reader of the round
  // never has to guess which ruler produced the number.
  assert.match(factorIssues[0].message, /reader-panel median composite 80 \(chapter bar 70\)/, factorIssues[0].message);
  // Describing the scores must never gate: a PASS with ten factor WARNs is still a PASS.
  assert.equal(evaluated.value.issues.some((issue) => issue.severity === "BLOCKER"), false, JSON.stringify(evaluated.value.issues));
});

finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
