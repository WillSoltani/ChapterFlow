/**
 * READER-LANE bounded retry ON SCHEMA-INVALID OUTPUT — the retry has to TEACH.
 *
 * OBSERVED LIVE (cf-canary, Bennett `how-to-live-on-24-hours-a-day`): review
 * `review-af245c99` ended
 *
 *     SEMANTIC_PANEL_READER_FAILED:MODEL_OUTPUT_INVALID:model output failed
 *     source-controlled schema validation      (on ch09)
 *
 * i.e. one reader seat's output was rejected by the gateway's source-controlled
 * output schema on EVERY attempt of its bounded budget, the lane fail-closed the
 * seat, and the whole panel verdict became `outcome = ERROR`.
 *
 * WHAT ALREADY EXISTED before this file (Task 11ac, established by reading the
 * code, not assumed): `runReaderLanes` already retried a seat up to
 * `MAX_READER_SEAT_ATTEMPTS` times, and `isTransientReaderModelResult` already
 * classified `FAILED + MODEL_OUTPUT_INVALID` as retryable. The budget was THREE.
 *
 * WHAT DID NOT EXIST: the retry was a BLIND RE-ROLL. Every attempt sent byte-
 * identical prompt bytes, so a seat whose first draft missed a required field
 * had no idea what had been rejected and drew from the same distribution again.
 * The COMPILER lane (Task 11j) and the RESEARCH lane already feed the schema
 * rejection back into the next attempt's card
 * (`retryFeedbackSection` / `buildRetryFeedback`); the reader lane did not.
 *
 * These cases pin the port of that pattern onto the reader seat:
 *   (a) a GATEWAY schema rejection retries with the rejection NAMED and no
 *       fabricated echo of the raw output (the gateway never surfaces it);
 *   (b) a LOCAL reader-schema rejection — the runner SUCCEEDED but the strict
 *       reader assembly refused the object — retries with the validator's own
 *       message quoted, because here the defect IS available;
 *   (c) a transient non-completion (process failure / timeout) carries the
 *       "nothing was wrong with your content" note and NEVER the schema wording;
 *   (d) the informed budget recovers a seat that only clears on the LAST
 *       attempt, and the first attempt is never polluted with feedback;
 *   (e) fail-closed is unchanged: exhausting the budget still throws, and the
 *       feedback block never leaks lane/model/attempt identity into a blind seat.
 */

import assert from "node:assert/strict";

import {
  MAX_READER_SEAT_ATTEMPTS,
  READER_PANEL_SEATS,
  READER_SEAT_RETRY_FEEDBACK_HEADERS,
  runReaderLanes,
} from "../../src/review/laneOrchestrator.js";
import { REVIEW_FACTORS } from "../../src/artifacts/artifactTypes.js";
import type { ModelResult } from "../../src/runtime/modelResult.js";
import type { ModelTaskContext } from "../../src/contracts/v4Core.js";
import type { ModelTaskRunner } from "../../src/app/modelTaskRunner.js";
import type { ChapterV21 } from "../../src/types.js";
import { makeGateCleanChapter } from "../helpers.js";
import { finishV25Tests, requiredTest } from "./harness.js";

const BOOK = "reader-seat-feedback-book";
/** The gate-clean fixture chapter's quiz size: the reader panel derivation
 *  must cover exactly this many questions (R-133). */
const QUESTION_COUNT = makeGateCleanChapter("question-count-probe", 1).quiz.questions.length;

/** A schema-valid reader-experience content object (weights sum to 100, so a
 *  uniform per-factor score IS the composite). */
function readerContent(score = 80): Record<string, unknown> {
  const scores: Record<string, number> = {};
  for (const factor of REVIEW_FACTORS) scores[factor] = score;
  return {
    scores,
    // One derivation per question (R-133): the strict reader assembly rejects a
    // seat whose positional derivation does not cover the chapter's quiz.
    quizDerivation: {
      answers: Array.from({ length: QUESTION_COUNT }, () => "a"),
      mechanisms: Array.from({ length: QUESTION_COUNT }, (_value, index) => `the prose forces choice a in q${index + 1}`),
      confidence: Array.from({ length: QUESTION_COUNT }, () => "high"),
      ambiguities: Array.from({ length: QUESTION_COUNT }, () => ""),
      tells: [],
    },
    recommendation: "SHIP",
    blockingFindings: [],
    escalationSignals: [],
    advisoryFindings: [],
    strongestEvidence: [],
    weakestEvidence: [],
    oneParagraphVerdict: "A clean, usable chapter.",
  };
}

/** The live round-4 LOCAL-schema shape: valid JSON the gateway happily passes,
 *  refused by the strict reader assembly because `quizDerivation.tells` is gone. */
function locallyInvalidReaderContent(): Record<string, unknown> {
  const content = readerContent();
  const quizDerivation = { ...(content.quizDerivation as Record<string, unknown>) };
  delete quizDerivation.tells;
  return { ...content, quizDerivation };
}

type ScriptEntry =
  | Record<string, unknown>
  | { readonly __fail: { outcome: ModelResult["outcome"]; code: string; message: string } };

function gatewayInvalid(): ScriptEntry {
  return {
    __fail: {
      outcome: "FAILED",
      code: "MODEL_OUTPUT_INVALID",
      message: "model output failed source-controlled schema validation",
    },
  };
}

function processFailure(): ScriptEntry {
  return { __fail: { outcome: "FAILED", code: "MODEL_PROCESS_FAILED", message: "anthropic claude-opus-4 overloaded at https://api.anthropic.com/v1/messages (profile attempt-read-json-v1)" } };
}

function isFailure(value: ScriptEntry): value is { __fail: { outcome: ModelResult["outcome"]; code: string; message: string } } {
  return typeof value === "object" && value !== null && "__fail" in value;
}

/** A runner scripted with an ordered queue, recording the SYSTEM PROMPT and the
 *  attempt id of every call so the retry card is directly observable. */
function scriptedRunner(queue: readonly ScriptEntry[]): {
  runner: ModelTaskRunner;
  prompts: string[];
  attemptIds: string[];
} {
  const pending = [...queue];
  const prompts: string[] = [];
  const attemptIds: string[] = [];
  const runner: ModelTaskRunner = {
    async run(request): Promise<ModelResult> {
      attemptIds.push(request.context.attemptId);
      const task = request.prompt.inputs.find((input) => input.name === "system_prompt");
      prompts.push(task ? new TextDecoder().decode(task.bytes) : "");
      const next = pending.shift();
      if (next === undefined) {
        return {
          attemptId: request.context.attemptId,
          outcome: "FAILED",
          error: { code: "SCRIPT_EXHAUSTED", message: "no scripted reader output remaining" },
        };
      }
      if (isFailure(next)) {
        return { attemptId: request.context.attemptId, outcome: next.__fail.outcome, error: { code: next.__fail.code, message: next.__fail.message } };
      }
      return { attemptId: request.context.attemptId, outcome: "SUCCEEDED", output: next };
    },
  };
  return { runner, prompts, attemptIds };
}

function taskContext(): ModelTaskContext {
  return {
    bookId: BOOK,
    runId: "SENTINEL-RUN-ID",
    attemptId: "SENTINEL-ATTEMPT-ID",
    stageId: "canonical-review",
    operationId: "SENTINEL-OPERATION-ID",
    workDir: "/tmp/reader-seat-feedback-workdir",
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
    sleep: async (): Promise<void> => {},
  };
}

/** Every seat after the first, scripted clean, so a test can focus on seat 1. */
function cleanTail(): ScriptEntry[] {
  return [readerContent(), readerContent()];
}

requiredTest("a GATEWAY schema rejection retries with the rejection NAMED — and never fabricates the unavailable raw output", async () => {
  const chapter = makeGateCleanChapter(BOOK, 1);
  const scripted = scriptedRunner([gatewayInvalid(), readerContent(), ...cleanTail()]);

  const panel = await runReaderLanes(panelInput(chapter, scripted.runner));
  assert.equal(panel.medianComposite, 80, JSON.stringify(panel.composites));
  assert.equal(scripted.prompts.length, 4, JSON.stringify(scripted.attemptIds));

  const first = scripted.prompts[0];
  const retry = scripted.prompts[1];
  // The first attempt is a clean read — no correction block at all.
  assert.ok(
    !first.includes(READER_SEAT_RETRY_FEEDBACK_HEADERS.gatewaySchema),
    "the FIRST attempt must carry no rejection header",
  );
  assert.ok(!first.includes(READER_SEAT_RETRY_FEEDBACK_HEADERS.readerSchema), "the FIRST attempt must carry no rejection header");
  // The retry names the gateway rejection and the gateway's own message.
  assert.ok(
    retry.includes(READER_SEAT_RETRY_FEEDBACK_HEADERS.gatewaySchema),
    `the retry card must name the gateway schema rejection:\n${retry.slice(0, 600)}`,
  );
  assert.ok(
    retry.includes("model output failed source-controlled schema validation"),
    `the retry card must quote what the gateway said was invalid:\n${retry.slice(0, 600)}`,
  );
  // The raw invalid output never leaves the gateway — the card must not pretend
  // to echo one back (the same rule the compiler lane's 3e case pins).
  assert.ok(!/your rejected (draft|output) was/i.test(retry), "the gateway's raw output is unavailable and must not be fabricated");
  // The retry is still the frozen reader instrument under the same blind seat lens.
  assert.ok(retry.includes("READER-EXPERIENCE REVIEW"), "the retry must still carry the frozen reader instrument");
  assert.ok(retry.startsWith("READER-PANEL SEAT"), "the retry must still open with the blind seat lens");
});

requiredTest("a LOCAL reader-schema rejection retries with the validator's own message quoted — the defect IS available here", async () => {
  const chapter = makeGateCleanChapter(BOOK, 1);
  const scripted = scriptedRunner([locallyInvalidReaderContent(), readerContent(), ...cleanTail()]);

  const panel = await runReaderLanes(panelInput(chapter, scripted.runner));
  assert.equal(panel.medianComposite, 80, JSON.stringify(panel.composites));

  const retry = scripted.prompts[1];
  assert.ok(
    retry.includes(READER_SEAT_RETRY_FEEDBACK_HEADERS.readerSchema),
    `the retry card must name the reader-schema rejection:\n${retry.slice(0, 600)}`,
  );
  // The strict reader assembly names the missing field; that name is the whole
  // point of feeding the failure back rather than re-rolling blind.
  assert.ok(
    /tells/.test(retry),
    `the retry card must name WHAT was invalid (quizDerivation.tells):\n${retry.slice(0, 900)}`,
  );
  assert.ok(
    !retry.includes(READER_SEAT_RETRY_FEEDBACK_HEADERS.gatewaySchema),
    "a local rejection must not be reported as a gateway rejection",
  );
});

requiredTest("a transient non-completion carries the 'nothing was wrong with your content' note and NEVER the schema wording", async () => {
  const chapter = makeGateCleanChapter(BOOK, 1);
  const scripted = scriptedRunner([processFailure(), readerContent(), ...cleanTail()]);

  await runReaderLanes(panelInput(chapter, scripted.runner));
  const retry = scripted.prompts[1];
  assert.ok(
    retry.includes(READER_SEAT_RETRY_FEEDBACK_HEADERS.transient),
    `a transient retry must say the attempt did not complete:\n${retry.slice(0, 600)}`,
  );
  assert.ok(!retry.includes(READER_SEAT_RETRY_FEEDBACK_HEADERS.gatewaySchema), "a transient failure is not a schema rejection");
  assert.ok(!retry.includes(READER_SEAT_RETRY_FEEDBACK_HEADERS.readerSchema), "a transient failure is not a schema rejection");
});

requiredTest("the informed budget recovers a seat that only clears on its LAST attempt, and every retry carries the feedback", async () => {
  const chapter = makeGateCleanChapter(BOOK, 1);
  // Schema-invalid on every attempt but the last one the budget allows.
  const script: ScriptEntry[] = [];
  for (let attempt = 1; attempt < MAX_READER_SEAT_ATTEMPTS; attempt += 1) script.push(gatewayInvalid());
  script.push(readerContent());
  const scripted = scriptedRunner([...script, ...cleanTail()]);

  const panel = await runReaderLanes(panelInput(chapter, scripted.runner));
  // A VERDICT, not an ERROR: the seat recovered inside its bounded budget.
  assert.equal(panel.medianComposite, 80, JSON.stringify(panel.composites));
  assert.equal(panel.readerCount, READER_PANEL_SEATS.length);
  assert.equal(scripted.prompts.length, MAX_READER_SEAT_ATTEMPTS + 2, JSON.stringify(scripted.attemptIds));

  const seatOne = scripted.prompts.slice(0, MAX_READER_SEAT_ATTEMPTS);
  assert.equal(
    seatOne.filter((prompt) => prompt.includes(READER_SEAT_RETRY_FEEDBACK_HEADERS.gatewaySchema)).length,
    MAX_READER_SEAT_ATTEMPTS - 1,
    "every attempt after the first must carry the rejection feedback",
  );
  // Fresh ordinal attempt ids, one per attempt — no re-spawn of a spent id.
  assert.equal(new Set(scripted.attemptIds).size, scripted.attemptIds.length, JSON.stringify(scripted.attemptIds));
});

requiredTest("feedback does not weaken the gate: an all-invalid seat still fail-closes to SEMANTIC_PANEL_READER_FAILED", async () => {
  const chapter = makeGateCleanChapter(BOOK, 1);
  const script: ScriptEntry[] = [];
  for (let attempt = 1; attempt <= MAX_READER_SEAT_ATTEMPTS; attempt += 1) script.push(gatewayInvalid());
  const scripted = scriptedRunner(script);

  await assert.rejects(
    () => runReaderLanes(panelInput(chapter, scripted.runner)),
    /^Error: SEMANTIC_PANEL_READER_FAILED:MODEL_OUTPUT_INVALID:/,
  );
  assert.equal(scripted.prompts.length, MAX_READER_SEAT_ATTEMPTS, JSON.stringify(scripted.attemptIds));
});

requiredTest("the feedback block keeps the seat BLIND — no run/attempt/operation or model identity leaks into a retry", async () => {
  const chapter = makeGateCleanChapter(BOOK, 1);
  // transientFailure() carries a DELIBERATELY poisoned provider message
  // (anthropic/claude/model/url/profile id) — adversarial review demonstrated
  // the leak through the TRANSIENT card, and the earlier fixture ("overloaded")
  // could not have caught it. Every failure class runs before the scan.
  const scripted = scriptedRunner([processFailure(), gatewayInvalid(), locallyInvalidReaderContent(), readerContent(), ...cleanTail()]);
  await runReaderLanes(panelInput(chapter, scripted.runner));

  const identityLeaks = [
    "SENTINEL-ATTEMPT-ID", "SENTINEL-RUN-ID", "SENTINEL-OPERATION-ID",
    "gpt-5", "gpt-4", "claude", "sonnet", "codex", "o3", "-sol",
    "anthropic", "openai", "api.anthropic", "https://", "attempt-read-json",
    "author-session", "author role", "authoring model",
  ];
  for (const prompt of scripted.prompts) {
    for (const leak of identityLeaks) {
      assert.ok(
        !prompt.toLowerCase().includes(leak.toLowerCase()),
        `a retry prompt leaked identity string "${leak}"`,
      );
    }
  }
});

finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
