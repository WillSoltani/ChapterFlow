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
};

/** A schema-valid reader-experience content object (the runtime stamps the
 *  schema/reviewerRole/rubricVersion + hash bindings on top). */
function readerContent(overrides: ReaderOverrides = {}): Record<string, unknown> {
  const scores: Record<string, number> = {};
  for (const factor of REVIEW_FACTORS) scores[factor] = overrides.score ?? 80;
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
  // The first seat of ch1 is unparseable → ch1 errors after one read; ch2's
  // three seats still run clean.
  const scripted = scriptedRunner(["this is not reader-review JSON", readerContent(), readerContent(), readerContent()]);
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

finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
