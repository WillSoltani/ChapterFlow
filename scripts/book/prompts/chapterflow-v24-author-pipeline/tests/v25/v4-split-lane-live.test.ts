/**
 * Task 9 — IMP-20 split-lane blind reader panel, live path (stage 2).
 *
 * `runReaderLanes` restores the IMP-20 3-reader panel onto the live semantic
 * review seam: three INDEPENDENT reader seats read the same chapter through the
 * injected runner, and their composites are MEDIANED (never averaged, never
 * single-reader). This file is the behavioral contract for the extracted lane
 * orchestrator, exercised entirely model-free through a scripted `ModelTaskRunner`
 * (the FakeExecutor seam) — ZERO real model call.
 *
 * Mirrors the IMP-20 spec-grade tests it revives:
 *   (a) 3 tasks spawned, one per seat, with DISTINCT role prompts;
 *   (b) median aggregation — composites 4/7/9 → 7 (not the mean 6.67, not one reader);
 *   (c) blindness invariant — no seat prompt carries author-lane identity
 *       (model name, author/role id, or attempt metadata), mirroring
 *       review-blind-lane.test.ts's leak-scan assertion style.
 */

import assert from "node:assert/strict";

import {
  MAX_READER_SEAT_ATTEMPTS,
  READER_PANEL_SEATS,
  READER_SEAT_RETRY_BACKOFF_MS,
  isTransientReaderModelResult,
  runReaderLanes,
  type ReaderPanelReviewV1,
} from "../../src/review/laneOrchestrator.js";
import { REVIEW_FACTORS } from "../../src/artifacts/artifactTypes.js";
import { ReaderExperienceReviewError } from "../../src/review/readerExperienceReview.js";
import type { ModelResult } from "../../src/runtime/modelResult.js";
import type { ModelTaskContext } from "../../src/contracts/v4Core.js";
import type { ModelTaskRunner } from "../../src/app/modelTaskRunner.js";
import type { ChapterV21 } from "../../src/types.js";
import { makeGateCleanChapter } from "../helpers.js";
import { finishV25Tests, requiredTest } from "./harness.js";

const BOOK = "split-lane-live-book";

/** A schema-valid reader-experience content object; every factor gets `score`
 *  so `computeReaderComposite` (a weighted mean whose weights sum to 100)
 *  collapses to exactly `score`. */
function readerContent(
  score: number,
  overrides: {
    blockingFindings?: unknown[];
    advisoryFindings?: unknown[];
    escalationSignals?: unknown[];
    recommendation?: string;
  } = {},
): Record<string, unknown> {
  const scores: Record<string, number> = {};
  for (const factor of REVIEW_FACTORS) scores[factor] = score;
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

/** A runner scripted with an ordered queue of reader outputs; records every
 *  seat's system-prompt so the panel's blind lane wiring is observable. */
function scriptedRunner(outputs: readonly unknown[]): {
  runner: ModelTaskRunner;
  prompts: string[];
  attemptIds: string[];
} {
  const queue = [...outputs];
  const prompts: string[] = [];
  const attemptIds: string[] = [];
  const runner: ModelTaskRunner = {
    async run(request): Promise<ModelResult> {
      attemptIds.push(request.context.attemptId);
      const task = request.prompt.inputs.find((input) => input.name === "system_prompt");
      if (task) prompts.push(new TextDecoder().decode(task.bytes));
      const output = queue.shift();
      if (output === undefined) {
        return { attemptId: request.context.attemptId, outcome: "FAILED", error: { code: "SCRIPT_EXHAUSTED", message: "no scripted reader output" } };
      }
      if (output === "__MODEL_FAIL__") {
        return { attemptId: request.context.attemptId, outcome: "FAILED", error: { code: "READER_MODEL_DOWN", message: "injected reader failure" } };
      }
      return { attemptId: request.context.attemptId, outcome: "SUCCEEDED", output };
    },
  };
  return { runner, prompts, attemptIds };
}

/** A task context whose identity fields are DISTINCTIVE sentinels so the
 *  blindness scan can prove none of them leaked into a reader prompt. */
function taskContext(): ModelTaskContext {
  return {
    bookId: BOOK,
    runId: "SENTINEL-RUN-ID",
    attemptId: "SENTINEL-ATTEMPT-ID",
    stageId: "canonical-review",
    operationId: "SENTINEL-OPERATION-ID",
    workDir: "/tmp/split-lane-live-workdir",
    signal: new AbortController().signal,
  };
}

function panelInput(chapter: ChapterV21, runner: ModelTaskRunner) {
  return {
    chapter,
    chapterNumber: chapter.number,
    runner,
    readers: READER_PANEL_SEATS.length,
    taskContext: taskContext(),
    profileId: "attempt-read-json-v1",
  };
}

/**
 * A reader-model failure descriptor the retry-scripted runner returns instead of
 * an output object. `outcome`/`code` drive the transient classifier (Task 11ac):
 * FAILED+MODEL_PROCESS_FAILED, TIMED_OUT, and FAILED+MODEL_OUTPUT_INVALID are the
 * bounded-retry transient classes; CANCELLED / UNKNOWN are fatal (fail-closed).
 */
type ReaderFailure = { readonly __fail: { outcome: ModelResult["outcome"]; code: string; message: string } };
function readerFailure(outcome: ModelResult["outcome"], code: string, message = "injected"): ReaderFailure {
  return { __fail: { outcome, code, message } };
}
function isReaderFailure(value: unknown): value is ReaderFailure {
  return typeof value === "object" && value !== null && "__fail" in value;
}

/** A runner scripted with an ordered queue of reader outputs OR failure
 *  descriptors; records every attemptId so the retry loop's fresh ordinal
 *  attempt ids are observable. */
function retryScriptedRunner(queue: readonly unknown[]): {
  runner: ModelTaskRunner;
  attemptIds: string[];
  calls: number;
} {
  const pending = [...queue];
  const state = { runner: undefined as unknown as ModelTaskRunner, attemptIds: [] as string[], calls: 0 };
  state.runner = {
    async run(request): Promise<ModelResult> {
      state.calls += 1;
      state.attemptIds.push(request.context.attemptId);
      const next = pending.shift();
      if (next === undefined) {
        return { attemptId: request.context.attemptId, outcome: "FAILED", error: { code: "SCRIPT_EXHAUSTED", message: "no scripted reader output" } };
      }
      if (isReaderFailure(next)) {
        return { attemptId: request.context.attemptId, outcome: next.__fail.outcome, error: { code: next.__fail.code, message: next.__fail.message } };
      }
      return { attemptId: request.context.attemptId, outcome: "SUCCEEDED", output: next };
    },
  };
  return state as { runner: ModelTaskRunner; attemptIds: string[]; calls: number };
}

requiredTest("isTransientReaderModelResult retries process-failure / timeout / output-invalid, but never CANCELLED or UNKNOWN", () => {
  assert.equal(isTransientReaderModelResult({ attemptId: "a", outcome: "FAILED", error: { code: "MODEL_PROCESS_FAILED", message: "x" } }), true);
  assert.equal(isTransientReaderModelResult({ attemptId: "a", outcome: "TIMED_OUT", error: { code: "MODEL_PROCESS_FAILED", message: "x" } }), true);
  assert.equal(isTransientReaderModelResult({ attemptId: "a", outcome: "FAILED", error: { code: "MODEL_OUTPUT_INVALID", message: "x" } }), true);
  // Fatal: operator intent and uncertain teardown must never burn a retry.
  assert.equal(isTransientReaderModelResult({ attemptId: "a", outcome: "CANCELLED", error: { code: "MODEL_RUN_CANCELLED", message: "x" } }), false);
  assert.equal(isTransientReaderModelResult({ attemptId: "a", outcome: "UNKNOWN", error: { code: "MODEL_EXECUTION_UNCERTAIN", message: "x" } }), false);
  // A FAILED with a non-transient code (e.g. capacity/admission) is fatal.
  assert.equal(isTransientReaderModelResult({ attemptId: "a", outcome: "FAILED", error: { code: "MODEL_CAPACITY_EXHAUSTED", message: "x" } }), false);
});

requiredTest("runReaderLanes retries the three transient reader classes with fresh ordinal attempt ids and recovers", async () => {
  const chapter = makeGateCleanChapter(BOOK, 1);
  // seat-cold: process-failure then success; seat-skeptic: timeout then success;
  // seat-practitioner: output-invalid then success. Every seat recovers on retry.
  const scripted = retryScriptedRunner([
    readerFailure("FAILED", "MODEL_PROCESS_FAILED"), readerContent(80),
    readerFailure("TIMED_OUT", "MODEL_PROCESS_FAILED"), readerContent(80),
    readerFailure("FAILED", "MODEL_OUTPUT_INVALID"), readerContent(80),
  ]);
  const backoffs: number[] = [];
  const panel = await runReaderLanes({
    ...panelInput(chapter, scripted.runner),
    sleep: async (ms: number) => { backoffs.push(ms); },
  });

  assert.equal(panel.medianComposite, 80, JSON.stringify(panel.composites));
  // 3 seats × (1 transient + 1 success) = 6 calls.
  assert.equal(scripted.calls, 6, JSON.stringify(scripted.attemptIds));
  // Each seat's retry admitted a NEW ordinal attempt id (never re-spawned the same one).
  assert.equal(new Set(scripted.attemptIds).size, 6, "every attempt id is distinct");
  assert.equal(scripted.attemptIds.filter((id) => id.endsWith("-a2")).length, 3, JSON.stringify(scripted.attemptIds));
  // The first attempt of a seat keeps its base id; the retry appends the ordinal.
  assert.ok(scripted.attemptIds.some((id) => id.endsWith("-seat-cold")), JSON.stringify(scripted.attemptIds));
  assert.ok(scripted.attemptIds.some((id) => id.endsWith("-seat-cold-a2")), JSON.stringify(scripted.attemptIds));
  // Bounded escalating backoff was honored once per recovered seat.
  assert.deepEqual(backoffs, [READER_SEAT_RETRY_BACKOFF_MS[0], READER_SEAT_RETRY_BACKOFF_MS[0], READER_SEAT_RETRY_BACKOFF_MS[0]]);
});

requiredTest("runReaderLanes never retries a CANCELLED or UNKNOWN reader result — it propagates fail-closed", async () => {
  const chapter = makeGateCleanChapter(BOOK, 1);
  for (const fatal of [readerFailure("CANCELLED", "MODEL_RUN_CANCELLED"), readerFailure("UNKNOWN", "MODEL_EXECUTION_UNCERTAIN")]) {
    const scripted = retryScriptedRunner([fatal, readerContent(80), readerContent(80)]);
    const backoffs: number[] = [];
    await assert.rejects(
      () => runReaderLanes({ ...panelInput(chapter, scripted.runner), sleep: async (ms: number) => { backoffs.push(ms); } }),
      /SEMANTIC_PANEL_READER_(CANCELLED|UNKNOWN)/,
    );
    // No retry: exactly one call for the first seat, and no backoff slept.
    assert.equal(scripted.calls, 1, JSON.stringify(scripted.attemptIds));
    assert.deepEqual(backoffs, []);
  }
});

requiredTest("runReaderLanes fails closed when a reader exhausts its bounded retry (all attempts transient)", async () => {
  const chapter = makeGateCleanChapter(BOOK, 1);
  const scripted = retryScriptedRunner([
    readerFailure("FAILED", "MODEL_PROCESS_FAILED"),
    readerFailure("FAILED", "MODEL_PROCESS_FAILED"),
    readerFailure("FAILED", "MODEL_PROCESS_FAILED"),
  ]);
  const backoffs: number[] = [];
  await assert.rejects(
    () => runReaderLanes({ ...panelInput(chapter, scripted.runner), sleep: async (ms: number) => { backoffs.push(ms); } }),
    /SEMANTIC_PANEL_READER_FAILED/,
  );
  // The bounded cap is honored: exactly MAX attempts for the first seat, then throw.
  assert.equal(scripted.calls, MAX_READER_SEAT_ATTEMPTS, JSON.stringify(scripted.attemptIds));
  // Backoff slept between attempts but not after the final failure.
  assert.equal(backoffs.length, MAX_READER_SEAT_ATTEMPTS - 1);
});

/** The exact live round-4 shape: the runner SUCCEEDED but the seat's JSON fails
 *  the local reader-review strict assembly (quizDerivation missing `tells`). The
 *  gateway only checks that stdout is JSON — the reader schema is enforced in
 *  runReaderLanes — so this is the same variance class as MODEL_OUTPUT_INVALID
 *  and must consume the same bounded retry budget instead of erroring the panel. */
function schemaInvalidReaderContent(score: number): Record<string, unknown> {
  const content = readerContent(score);
  const quizDerivation = { ...(content.quizDerivation as Record<string, unknown>) };
  delete quizDerivation.tells;
  return { ...content, quizDerivation };
}

requiredTest("runReaderLanes retries a schema-invalid seat output within the bounded budget and recovers (live round-4 class)", async () => {
  const chapter = makeGateCleanChapter(BOOK, 1);
  const scripted = retryScriptedRunner([
    schemaInvalidReaderContent(80), readerContent(80),
    readerContent(80),
    readerContent(80),
  ]);
  const backoffs: number[] = [];
  const panel = await runReaderLanes({
    ...panelInput(chapter, scripted.runner),
    sleep: async (ms: number) => { backoffs.push(ms); },
  });
  assert.equal(panel.medianComposite, 80, JSON.stringify(panel.composites));
  // First seat: invalid + retry; other seats: one call each.
  assert.equal(scripted.calls, 4, JSON.stringify(scripted.attemptIds));
  assert.equal(scripted.attemptIds.filter((id) => id.endsWith("-a2")).length, 1, JSON.stringify(scripted.attemptIds));
  assert.deepEqual(backoffs, [READER_SEAT_RETRY_BACKOFF_MS[0]]);
});

requiredTest("runReaderLanes fails closed when a seat's output is schema-invalid on every bounded attempt", async () => {
  const chapter = makeGateCleanChapter(BOOK, 1);
  const scripted = retryScriptedRunner([
    schemaInvalidReaderContent(80),
    schemaInvalidReaderContent(80),
    schemaInvalidReaderContent(80),
  ]);
  const backoffs: number[] = [];
  await assert.rejects(
    () => runReaderLanes({ ...panelInput(chapter, scripted.runner), sleep: async (ms: number) => { backoffs.push(ms); } }),
    (error: unknown) => error instanceof ReaderExperienceReviewError,
  );
  assert.equal(scripted.calls, MAX_READER_SEAT_ATTEMPTS, JSON.stringify(scripted.attemptIds));
  assert.equal(backoffs.length, MAX_READER_SEAT_ATTEMPTS - 1);
});

requiredTest("runReaderLanes spawns exactly one reader task per seat, each with a distinct role prompt", async () => {
  const chapter = makeGateCleanChapter(BOOK, 1);
  const scripted = scriptedRunner([readerContent(80), readerContent(80), readerContent(80)]);
  const panel = await runReaderLanes(panelInput(chapter, scripted.runner));

  // Three seats → three tasks.
  assert.equal(READER_PANEL_SEATS.length, 3, "the live panel is a 3-reader panel");
  assert.equal(scripted.prompts.length, 3, "one reader task per seat");
  assert.equal(panel.readerCount, 3);
  assert.equal(panel.seatIds.length, 3);
  // Distinct seat ids and distinct prompts (each seat reads under its own lens).
  assert.equal(new Set(panel.seatIds).size, 3, "seat ids are distinct");
  assert.equal(new Set(scripted.prompts).size, 3, "each seat prompt is distinct");
  // Every prompt is still the reader-experience instrument.
  assert.ok(scripted.prompts.every((p) => p.includes("READER-EXPERIENCE REVIEW")), JSON.stringify(scripted.prompts));
  // Distinct attempt ids so the reader-lane run never collides three reads onto one attempt.
  assert.equal(new Set(scripted.attemptIds).size, 3, "each seat gets a distinct attemptId");
});

requiredTest("runReaderLanes medians the seat composites — 4/7/9 → 7 (never the mean, never a single reader)", async () => {
  const chapter = makeGateCleanChapter(BOOK, 1);
  const scripted = scriptedRunner([readerContent(4), readerContent(7), readerContent(9)]);
  const panel = await runReaderLanes(panelInput(chapter, scripted.runner));

  assert.deepEqual([...panel.composites].sort((a, b) => a - b), [4, 7, 9], JSON.stringify(panel.composites));
  assert.equal(panel.medianComposite, 7, "the median of 4/7/9 is 7");
  assert.notEqual(panel.medianComposite, (4 + 7 + 9) / 3, "the panel medians, it never averages");
});

requiredTest("runReaderLanes keeps every seat prompt BLIND — no model name, author/role id, or attempt metadata leaks", async () => {
  const chapter = makeGateCleanChapter(BOOK, 1);
  const scripted = scriptedRunner([readerContent(80), readerContent(80), readerContent(80)]);
  await runReaderLanes(panelInput(chapter, scripted.runner));

  const identityLeaks = [
    // attempt / run / operation metadata sentinels
    "SENTINEL-ATTEMPT-ID", "SENTINEL-RUN-ID", "SENTINEL-OPERATION-ID",
    // model-family identity a reader must never see
    "gpt-5", "gpt-4", "claude", "sonnet", "codex", "o3", "-sol",
    // author-lane identity
    "author-session", "author role", "authoring model",
  ];
  for (const prompt of scripted.prompts) {
    for (const leak of identityLeaks) {
      assert.ok(!prompt.toLowerCase().includes(leak.toLowerCase()), `a seat prompt leaked identity string "${leak}"`);
    }
  }
});

requiredTest("runReaderLanes unions blocking + advisory + escalation findings across seats, tagged by seat", async () => {
  const chapter = makeGateCleanChapter(BOOK, 1);
  const scripted = scriptedRunner([
    readerContent(80, {
      recommendation: "BLOCK",
      blockingFindings: [{ category: "internal_contradiction", unit: "deep read", problem: "claims A then not-A", evidenceSpans: [] }],
    }),
    readerContent(80, {
      advisoryFindings: [{ category: "pacing", unit: "hook", problem: "slow open", evidenceSpans: [] }],
    }),
    readerContent(80),
  ]);
  const panel: ReaderPanelReviewV1 = await runReaderLanes(panelInput(chapter, scripted.runner));

  assert.equal(panel.blockingFindings.length, 1, JSON.stringify(panel.blockingFindings));
  assert.equal(panel.blockingFindings[0].category, "internal_contradiction");
  assert.ok(panel.blockingFindings[0].seatId.length > 0, "a blocker is tagged with the seat that raised it");
  assert.equal(panel.advisoryFindings.length, 1);
  assert.equal(panel.advisoryFindings[0].category, "pacing");
});

finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
