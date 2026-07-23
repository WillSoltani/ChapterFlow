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
  READER_PANEL_SEATS,
  runReaderLanes,
  type ReaderPanelReviewV1,
} from "../../src/review/laneOrchestrator.js";
import { REVIEW_FACTORS } from "../../src/artifacts/artifactTypes.js";
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
