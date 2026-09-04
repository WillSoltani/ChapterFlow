/**
 * The whole-book catalog-rubric STAGE (R-080): the panel's model seam, and the
 * gate the book run hangs off it.
 *
 * Hermetic throughout. The panel cases drive the REAL
 * `CatalogRubricPanelEvaluator` against a scripted `ModelTaskRunner` (no
 * provider, no network, injected backoff); the gate cases drive the real
 * `BookRunApplicationService` through the shared book-run rig with a scripted
 * panel, so the assertions about spend are counts of actual invocations.
 */

import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";

import {
  CatalogRubricPanelEvaluator,
  MAX_RUBRIC_READER_ATTEMPTS,
  registerHintForCandidate,
} from "../../src/app/catalogRubricPanelEvaluator.js";
import type { ModelTaskRunner } from "../../src/app/modelTaskRunner.js";
import type { CandidateInputFile, CandidateSnapshot } from "../../src/books/candidateTypes.js";
import type { ModelTaskContext } from "../../src/contracts/v4Core.js";
import type { ModelResult } from "../../src/runtime/modelResult.js";
import { REVIEW_FACTORS, type ReviewFactor } from "../../src/artifacts/artifactTypes.js";
import {
  CATALOG_RUBRIC_INSTRUMENT_VERSION,
  CATALOG_RUBRIC_TEXTURE_AXES,
  selectSeededChapterIndexes,
} from "../../src/review/catalogRubric.js";
import { createCatalogRubricStore } from "../../src/review/catalogRubricStore.js";
import type { ChapterV21 } from "../../src/types.js";
import { fixtureChapter } from "../model-bakeoff-helpers.js";
import { buildBookRunHarness } from "./bookRunRepairRig.js";
import { fakeReader, scriptedRubricPanel, unanimousReaders } from "./catalogRubricFakes.js";
import { finishV25Tests, requiredTest, type TestContext } from "./harness.js";

const PANEL_BOOK = "catalog-rubric-panel-book";

function jsonFile(logicalPath: string, value: unknown, kind: CandidateInputFile["kind"] = "SIDECAR"): CandidateInputFile {
  return { kind, logicalPath, mediaType: "application/json", bytes: Buffer.from(`${JSON.stringify(value)}\n`) };
}

function buildCandidate(
  bookId: string,
  chapters: readonly ChapterV21[],
  extras: readonly CandidateInputFile[] = [],
): CandidateSnapshot {
  const files: CandidateInputFile[] = [
    ...chapters.map((chapter) => jsonFile(
      `content/chapters/${bookId}-ch${String(chapter.number).padStart(2, "0")}.v21-native.chapter.json`,
      chapter,
      "CHAPTER",
    )),
    ...extras,
  ];
  return {
    manifest: {
      schemaVersion: "1",
      bookId,
      candidateId: `${bookId}-candidate`,
      createdByRunId: `${bookId}-run`,
      entries: files.map(({ bytes, ...entry }) => ({ ...entry, byteLength: bytes.byteLength })),
      manifestDigest: "a".repeat(64),
      createdAt: "2026-09-02T00:00:00.000Z",
    },
    files: files.map((file) => ({ ...file, byteLength: file.bytes.byteLength })),
  };
}

function chaptersFor(bookId: string, count: number): ChapterV21[] {
  return Array.from({ length: count }, (_value, index) => fixtureChapter(bookId, index + 1, `s${index + 1}`));
}

function taskContext(): ModelTaskContext {
  return {
    bookId: PANEL_BOOK,
    runId: "rubric-run-1",
    attemptId: "rubric-attempt-1",
    stageId: "catalog-rubric",
    operationId: "catalog-rubric",
    workDir: "/nonexistent-pipeline-root",
    signal: new AbortController().signal,
  };
}

/** A reader's returned JSON in the SKILL's own shape. */
function readerJson(number: number, overrides: Partial<Record<ReviewFactor, number>> & {
  gate?: "PASS" | "FAIL"; gateFailures?: string; churn?: string; base?: number;
  texture?: "LOW" | "MED" | "HIGH"; apparatusQuotes?: string;
} = {}): Record<string, unknown> {
  const base = overrides.base ?? 84;
  return {
    reader: number,
    gate_verdict: overrides.gate ?? "PASS",
    gate_failures: overrides.gateFailures ?? "none",
    ...Object.fromEntries(REVIEW_FACTORS.map((factor) => [factor, overrides[factor] ?? base])),
    book3_churn: overrides.churn ?? "LOW",
    ...Object.fromEntries(CATALOG_RUBRIC_TEXTURE_AXES.map((axis) => [axis, overrides.texture ?? "LOW"])),
    apparatus_quotes: overrides.apparatusQuotes ?? "none",
    texture_note: `reader ${number}: no dominant repeated shape`,
    note: `reader ${number}: strongest retention; weakest limits`,
  };
}

type ScriptedRun = ModelResult | ((request: Parameters<ModelTaskRunner["run"]>[0]) => ModelResult);

function scriptedRunner(script: readonly ScriptedRun[]): {
  runner: ModelTaskRunner;
  calls: () => readonly Parameters<ModelTaskRunner["run"]>[0][];
} {
  const queue = [...script];
  const calls: Parameters<ModelTaskRunner["run"]>[0][] = [];
  return {
    calls: () => calls,
    runner: {
      async run(request) {
        calls.push(request);
        const next = queue.shift();
        if (next === undefined) throw new Error("scriptedRunner: called more times than scripted");
        return typeof next === "function" ? next(request) : next;
      },
    },
  };
}

function succeeded(attemptId: string, output: unknown): ModelResult {
  return { attemptId, outcome: "SUCCEEDED", output } as ModelResult;
}

const instantSleep = async (): Promise<void> => { /* no wall-clock wait in tests */ };

// ── The panel's model seam ──────────────────────────────────────────────────

requiredTest("the panel runs three readers over the whole book and binds the record to the candidate", async () => {
  const candidate = buildCandidate(PANEL_BOOK, chaptersFor(PANEL_BOOK, 3));
  const { runner, calls } = scriptedRunner([
    (request) => succeeded(request.context.attemptId, readerJson(1, { base: 86 })),
    (request) => succeeded(request.context.attemptId, readerJson(2, { base: 84 })),
    (request) => succeeded(request.context.attemptId, readerJson(3, { base: 82 })),
  ]);
  const panel = new CatalogRubricPanelEvaluator({ runner, sleep: instantSleep });
  const scored = await panel.score({
    bookId: PANEL_BOOK,
    title: "Panel Book",
    author: "Fixture Author",
    candidate,
    completedAt: "2026-09-02T01:00:00.000Z",
    taskContext: taskContext(),
  });
  assert.equal(scored.ok, true, JSON.stringify(scored));
  if (!scored.ok) return;
  assert.equal(scored.value.readers.length, 3);
  assert.deepEqual([...scored.value.sampledChapterNumbers], [1, 2, 3], "3 chapters is under the whole-book threshold");
  assert.equal(scored.value.totalChapters, 3);
  assert.deepEqual(scored.value.candidate, {
    candidateId: candidate.manifest.candidateId,
    manifestDigest: candidate.manifest.manifestDigest,
  });
  assert.match(scored.value.documentSha256, /^[0-9a-f]{64}$/);

  assert.equal(calls().length, 3, "exactly one call per reader");
  for (const [index, call] of calls().entries()) {
    assert.equal(call.role, "review", "every rubric read goes out under the review role");
    assert.equal(call.profileId, "attempt-read-json-v1");
    const [system, user] = call.prompt.inputs;
    const task = Buffer.from(system.bytes).toString("utf8");
    const document = Buffer.from(user.bytes).toString("utf8");
    assert.match(task, new RegExp(`You are reader #${index + 1} `));
    assert.match(task, /CORRECTNESS GATE/);
    // The whole book is in front of the reader, with its answer keys.
    for (const number of [1, 2, 3]) assert.match(document, new RegExp(`===== CHAPTER ${number} OF 3 =====`));
    assert.match(document, /## ANSWER KEY/);
    assert.match(document, /UNTRUSTED SOURCE DATA/);
  }
  // Distinct attempt ids per reader: run-state refuses a re-spawned attempt.
  const attemptIds = calls().map((call) => call.context.attemptId);
  assert.equal(new Set(attemptIds).size, 3, JSON.stringify(attemptIds));
});

requiredTest("a book over the whole-book threshold is sampled with score.py's seeded four", async () => {
  const book = "rubric-gate-book";
  const candidate = buildCandidate(book, chaptersFor(book, 10));
  const { runner, calls } = scriptedRunner([1, 2, 3].map(
    (number) => (request: Parameters<ModelTaskRunner["run"]>[0]) => succeeded(request.context.attemptId, readerJson(number)),
  ));
  const panel = new CatalogRubricPanelEvaluator({ runner, sleep: instantSleep });
  const scored = await panel.score({
    bookId: book,
    title: "Sampled Book",
    author: "Fixture Author",
    candidate,
    completedAt: "2026-09-02T01:00:00.000Z",
    taskContext: { ...taskContext(), bookId: book },
  });
  assert.equal(scored.ok, true, JSON.stringify(scored));
  if (!scored.ok) return;
  // score.py's select_idxs("rubric-gate-book", 10) is [4, 5, 6, 7] (0-based).
  assert.deepEqual([...selectSeededChapterIndexes(book, 10)], [4, 5, 6, 7]);
  assert.deepEqual([...scored.value.sampledChapterNumbers], [5, 6, 7, 8], "1-based chapter numbers of the seeded four");
  assert.equal(scored.value.totalChapters, 10);
  const document = Buffer.from(calls()[0].prompt.inputs[1].bytes).toString("utf8");
  for (const number of [5, 6, 7, 8]) assert.match(document, new RegExp(`===== CHAPTER ${number} OF 10 =====`));
  for (const number of [1, 2, 3, 4, 9, 10]) {
    assert.equal(document.includes(`===== CHAPTER ${number} OF 10 =====`), false, `chapter ${number} must not be sampled`);
  }
  const task = Buffer.from(calls()[0].prompt.inputs[0].bytes).toString("utf8");
  assert.match(task, /scoring 4 chapters/);
  assert.match(task, /They are chapters 5, 6, 7, 8 of 10/);
});

requiredTest("an infrastructure failure is an ERROR — never a manufactured PASS or FAIL", async () => {
  const candidate = buildCandidate(PANEL_BOOK, chaptersFor(PANEL_BOOK, 2));
  // MODEL_CAPACITY_EXHAUSTED is outside the transient class, so it is terminal
  // on the first attempt.
  const { runner, calls } = scriptedRunner([
    { attemptId: "a", outcome: "FAILED", error: { code: "MODEL_CAPACITY_EXHAUSTED", message: "no capacity" } } as ModelResult,
  ]);
  const panel = new CatalogRubricPanelEvaluator({ runner, sleep: instantSleep });
  const scored = await panel.score({
    bookId: PANEL_BOOK, title: "Panel Book", author: "Fixture Author", candidate,
    completedAt: "2026-09-02T01:00:00.000Z", taskContext: taskContext(),
  });
  assert.equal(scored.ok, false, JSON.stringify(scored));
  if (scored.ok) throw new Error("an unreachable model must never produce a rubric verdict");
  assert.equal(scored.error.code, "CATALOG_RUBRIC_READER_FAILED");
  assert.match(scored.error.message, /MODEL_CAPACITY_EXHAUSTED/);
  assert.equal(calls().length, 1, "a non-transient failure is not retried");
});

requiredTest("a transient blip is retried with a fresh attempt id and then succeeds", async () => {
  const candidate = buildCandidate(PANEL_BOOK, chaptersFor(PANEL_BOOK, 2));
  const slept: number[] = [];
  const { runner, calls } = scriptedRunner([
    { attemptId: "a", outcome: "FAILED", error: { code: "MODEL_OUTPUT_INVALID", message: "schema rejected" } } as ModelResult,
    (request) => succeeded(request.context.attemptId, readerJson(1)),
    (request) => succeeded(request.context.attemptId, readerJson(2)),
    (request) => succeeded(request.context.attemptId, readerJson(3)),
  ]);
  const panel = new CatalogRubricPanelEvaluator({
    runner,
    sleep: async (ms) => { slept.push(ms); },
  });
  const scored = await panel.score({
    bookId: PANEL_BOOK, title: "Panel Book", author: "Fixture Author", candidate,
    completedAt: "2026-09-02T01:00:00.000Z", taskContext: taskContext(),
  });
  assert.equal(scored.ok, true, JSON.stringify(scored));
  assert.equal(calls().length, 4, "one retry plus three successful reads");
  assert.deepEqual(slept, [2000], "the first retry waits the first backoff step");
  assert.equal(calls()[0].context.attemptId, "rubric-attempt-1-rubric-r1");
  assert.equal(calls()[1].context.attemptId, "rubric-attempt-1-rubric-r1-a2", "a retry admits a NEW attempt id");
});

requiredTest("a re-draw after a REFUSED block is told what was wrong; a re-draw after a blip is not", async () => {
  const candidate = buildCandidate(PANEL_BOOK, chaptersFor(PANEL_BOOK, 2));
  const { runner, calls } = scriptedRunner([
    // Reader 1, draw 1: assembles into nothing (no churn field) → REFUSED.
    (request) => succeeded(request.context.attemptId, { ...readerJson(1), book3_churn: undefined }),
    (request) => succeeded(request.context.attemptId, readerJson(1)),
    // Reader 2, draw 1: an infrastructure blip, which the reader did nothing to cause.
    { attemptId: "a", outcome: "FAILED", error: { code: "MODEL_OUTPUT_INVALID", message: "schema rejected" } } as ModelResult,
    (request) => succeeded(request.context.attemptId, readerJson(2)),
    (request) => succeeded(request.context.attemptId, readerJson(3)),
  ]);
  const panel = new CatalogRubricPanelEvaluator({ runner, sleep: instantSleep });
  const scored = await panel.score({
    bookId: PANEL_BOOK, title: "Panel Book", author: "Fixture Author", candidate,
    completedAt: "2026-09-02T01:00:00.000Z", taskContext: taskContext(),
  });
  assert.equal(scored.ok, true, JSON.stringify(scored));
  const prompts = calls().map((call) => {
    const systemPrompt = call.prompt.inputs.find((input) => input.name === "system_prompt");
    assert.notEqual(systemPrompt, undefined, "every rubric call carries the reader task as its system prompt");
    return Buffer.from(systemPrompt!.bytes).toString("utf8");
  });
  assert.equal(prompts[0].includes("YOUR PREVIOUS ANSWER WAS REJECTED"), false, "the first draw is blind");
  assert.equal(prompts[1].includes("YOUR PREVIOUS ANSWER WAS REJECTED"), true, "a refused draw is repaired, not re-rolled");
  assert.equal(prompts[1].includes("book3_churn"), true, "the repair note NAMES the refused field");
  assert.equal(
    prompts[3].includes("YOUR PREVIOUS ANSWER WAS REJECTED"),
    false,
    "an infrastructure blip is not the reader's fault and carries no repair note",
  );
  // The note re-states the format contract and never supplies a judgement.
  assert.equal(prompts[1].includes("Do not change your judgement to satisfy this note"), true);
});

requiredTest("a repair note does not survive an infrastructure blip on the SAME reader", async () => {
  const candidate = buildCandidate(PANEL_BOOK, chaptersFor(PANEL_BOOK, 2));
  const { runner, calls } = scriptedRunner([
    // Reader 1, draw 1: REFUSED by the strict assembly (no churn field).
    (request) => succeeded(request.context.attemptId, { ...readerJson(1), book3_churn: undefined }),
    // Reader 1, draw 2: the informed re-draw the refusal earns.
    { attemptId: "a", outcome: "FAILED", error: { code: "MODEL_OUTPUT_INVALID", message: "schema rejected" } } as ModelResult,
    // Reader 1, draw 3: follows an infrastructure BLIP, not a refusal. The
    // reader answered nothing on draw 2, so there is nothing to repair — and a
    // stale note tells it its (never-seen) last answer was rejected.
    (request) => succeeded(request.context.attemptId, readerJson(1)),
    (request) => succeeded(request.context.attemptId, readerJson(2)),
    (request) => succeeded(request.context.attemptId, readerJson(3)),
  ]);
  const panel = new CatalogRubricPanelEvaluator({ runner, sleep: instantSleep });
  const scored = await panel.score({
    bookId: PANEL_BOOK, title: "Panel Book", author: "Fixture Author", candidate,
    completedAt: "2026-09-02T01:00:00.000Z", taskContext: taskContext(),
  });
  assert.equal(scored.ok, true, JSON.stringify(scored));
  const prompts = calls().map((call) => {
    const systemPrompt = call.prompt.inputs.find((input) => input.name === "system_prompt");
    assert.notEqual(systemPrompt, undefined, "every rubric call carries the reader task as its system prompt");
    return Buffer.from(systemPrompt!.bytes).toString("utf8");
  });
  assert.equal(prompts.length, 5);
  assert.equal(prompts[0].includes("YOUR PREVIOUS ANSWER WAS REJECTED"), false, "the first draw is blind");
  assert.equal(
    prompts[1].includes("YOUR PREVIOUS ANSWER WAS REJECTED"),
    true,
    "the note applies to the draw IMMEDIATELY following the refusal",
  );
  assert.equal(
    prompts[2].includes("YOUR PREVIOUS ANSWER WAS REJECTED"),
    false,
    "a re-draw after an infrastructure blip carries no note — the reader was refused two draws ago, not last draw",
  );
});

requiredTest("output the strict assembly refuses exhausts the bounded budget and fails closed", async () => {
  const candidate = buildCandidate(PANEL_BOOK, chaptersFor(PANEL_BOOK, 2));
  const { runner, calls } = scriptedRunner(
    Array.from({ length: MAX_RUBRIC_READER_ATTEMPTS }, () =>
      (request: Parameters<ModelTaskRunner["run"]>[0]) => succeeded(request.context.attemptId, { reader: 1, gate_verdict: "PASS" })),
  );
  const panel = new CatalogRubricPanelEvaluator({ runner, sleep: instantSleep });
  const scored = await panel.score({
    bookId: PANEL_BOOK, title: "Panel Book", author: "Fixture Author", candidate,
    completedAt: "2026-09-02T01:00:00.000Z", taskContext: taskContext(),
  });
  assert.equal(scored.ok, false, JSON.stringify(scored));
  if (scored.ok) throw new Error("an unassemblable reader must never be scored");
  assert.equal(scored.error.code, "CATALOG_RUBRIC_READER_UNPARSEABLE");
  assert.equal(calls().length, MAX_RUBRIC_READER_ATTEMPTS, "the budget is spent exactly once, not per factor");
});

requiredTest("a provider block stops the panel on the first reader instead of walking three whole-book reads into it", async () => {
  const candidate = buildCandidate(PANEL_BOOK, chaptersFor(PANEL_BOOK, 2));
  const { runner, calls } = scriptedRunner([
    {
      attemptId: "a",
      outcome: "FAILED",
      error: { code: "MODEL_PROCESS_FAILED", message: "You've hit your weekly limit - resets Sep 6 at 8pm" },
    } as ModelResult,
  ]);
  const panel = new CatalogRubricPanelEvaluator({ runner, sleep: instantSleep });
  const scored = await panel.score({
    bookId: PANEL_BOOK, title: "Panel Book", author: "Fixture Author", candidate,
    completedAt: "2026-09-02T01:00:00.000Z", taskContext: taskContext(),
  });
  assert.equal(scored.ok, false, JSON.stringify(scored));
  if (scored.ok) throw new Error("a provider wall must not produce a verdict");
  assert.equal(scored.error.code, "CATALOG_RUBRIC_READER_FAILED");
  assert.match(scored.error.message, /blocked by the provider/);
  assert.equal(calls().length, 1, "no retry and no further readers against the same wall");
});

requiredTest("operator cancellation is reported as cancellation, not as a failed book", async () => {
  const candidate = buildCandidate(PANEL_BOOK, chaptersFor(PANEL_BOOK, 2));
  const { runner } = scriptedRunner([
    { attemptId: "a", outcome: "CANCELLED", error: { code: "MODEL_RUN_CANCELLED", message: "cancelled" } } as ModelResult,
  ]);
  const panel = new CatalogRubricPanelEvaluator({ runner, sleep: instantSleep });
  const scored = await panel.score({
    bookId: PANEL_BOOK, title: "Panel Book", author: "Fixture Author", candidate,
    completedAt: "2026-09-02T01:00:00.000Z", taskContext: taskContext(),
  });
  assert.equal(scored.ok, false, JSON.stringify(scored));
  if (scored.ok) throw new Error("a cancelled panel must not produce a verdict");
  assert.equal(scored.error.code, "CATALOG_RUBRIC_CANCELLED");
});

requiredTest("the register hint is read from the candidate's own voice card, then its bibliography", async () => {
  const chapters = chaptersFor(PANEL_BOOK, 2);
  const carded = buildCandidate(PANEL_BOOK, chapters, [
    jsonFile("inputs/compiler-section-task-context.json", {
      voiceCard: "voice: plain, concrete register; third-person retelling\ndo: name the concrete thing",
    }),
    jsonFile("inputs/research/bibliography.raw.json", { authorVoice: { register: "analytical" } }),
  ]);
  const hint = registerHintForCandidate(carded, "Fixture Author");
  assert.match(hint, /plain, concrete register; third-person retelling/, "the voice card wins");
  assert.equal(hint.includes("analytical"), false);

  const biblioOnly = buildCandidate(PANEL_BOOK, chapters, [
    jsonFile("inputs/compiler-section-task-context.json", { voiceCard: null }),
    jsonFile("inputs/research/bibliography.raw.json", { authorVoice: { register: "analytical" } }),
  ]);
  assert.match(registerHintForCandidate(biblioOnly, "Fixture Author"), /register is analytical/);

  const bare = buildCandidate(PANEL_BOOK, chapters);
  assert.match(registerHintForCandidate(bare, "Fixture Author"), /No register profile was recorded/);
});

// ── The gate on the book run ────────────────────────────────────────────────

requiredTest("a book above the bar clears the gate, is promoted, and carries its rubric evidence", async (context: TestContext) => {
  const book = "rubric-above-bar";
  const h = await buildBookRunHarness(context, book, ["PASS"], {
    rubricPanel: scriptedRubricPanel([{ readers: unanimousReaders(84) }]),
  });
  const result = await h.service.run({ ...h.request });
  assert.equal(result.ok, true, result.ok ? "" : `${result.error.code}:${result.error.message}`);
  if (!result.ok) return;
  assert.equal(result.value.status, "PROMOTED");
  const rubric = result.value.rubric;
  assert.ok(rubric, "a promoted run must carry its rubric evidence");
  assert.equal(rubric.composite, 84);
  assert.equal(rubric.bar, 80);
  assert.equal(rubric.gate, "PASS");
  assert.equal(rubric.churn, "LOW");
  assert.equal(rubric.factorFloor, 70);
  assert.equal(rubric.readerCount, 3);
  assert.equal(rubric.replayed, false);
  assert.deepEqual(rubric.candidate, result.value.candidate, "the panel is bound to the promoted candidate");
  assert.match(result.value.rubricScorecard ?? "", /## .* — scorecard \(ch 1\)/);

  // The gate ran between fresh-qc and promotion, and said so durably.
  const phases = h.events.map((event) => `${event.phase}:${event.status}`);
  const rubricIndex = phases.indexOf("rubric:COMPLETED");
  assert.ok(rubricIndex > phases.indexOf("fresh-qc:COMPLETED"), JSON.stringify(phases));
  assert.ok(rubricIndex < phases.indexOf("promotion:STARTED"), JSON.stringify(phases));
  const completed = h.events.find((event) => event.phase === "rubric" && event.status === "COMPLETED");
  assert.match(completed?.detail ?? "", /composite=84\.0;bar=80;gate=PASS;churn=LOW;replayed=false/);

  // And the panel is durable, bound to the exact candidate bytes.
  const stored = await h.rubricStore.getRecord(book, result.value.candidate.candidateId);
  assert.equal(stored.ok, true, JSON.stringify(stored));
  if (!stored.ok) return;
  assert.equal(stored.value.candidate.manifestDigest, result.value.candidate.manifestDigest);
  assert.equal(stored.value.readers.length, 3);
});

requiredTest("the durable record carries the BAR the gate enforced, not the compiled default", async (context: TestContext) => {
  const book = "rubric-recorded-bar";
  const h = await buildBookRunHarness(context, book, ["PASS"], {
    rubricPanel: scriptedRubricPanel([{ readers: unanimousReaders(84) }]),
    promoteLocal: false,
  });
  // 82, not the default 80: the release-side evidence reads the RECORD, so a
  // record that does not carry the run's bar can only be decorated with a
  // recomputed one — which is how a run gated at 90 shipped a sidecar saying 80.
  const result = await h.service.run({ ...h.request, rubricBar: 82 });
  assert.equal(result.ok, true, result.ok ? "" : `${result.error.code}:${result.error.message}`);
  if (!result.ok) return;
  assert.equal(result.value.rubric?.bar, 82);
  const stored = await h.rubricStore.getRecord(book, result.value.candidate.candidateId);
  assert.equal(stored.ok, true, JSON.stringify(stored));
  if (!stored.ok) return;
  assert.equal(stored.value.gateBar, 82, "the record states the bar its own run enforced");

  // A record that predates the field still replays — it simply cannot state a
  // bar — and an out-of-range one is refused rather than read.
  const paths = h.rubricStore.paths(book);
  assert.equal(paths.ok, true, JSON.stringify(paths));
  if (!paths.ok) return;
  const recordPath = paths.value.record(result.value.candidate.candidateId);
  const onDisk = JSON.parse(readFileSync(recordPath, "utf8")) as Record<string, unknown>;
  const { gateBar: _gateBar, ...legacy } = onDisk;
  writeFileSync(recordPath, `${JSON.stringify(legacy, null, 2)}\n`, "utf8");
  const replayed = await h.rubricStore.getRecord(book, result.value.candidate.candidateId);
  assert.equal(replayed.ok, true, JSON.stringify(replayed));
  if (!replayed.ok) return;
  assert.equal(replayed.value.gateBar, undefined, "a pre-field record records no bar; it does not inherit one");

  writeFileSync(recordPath, `${JSON.stringify({ ...onDisk, gateBar: 40 }, null, 2)}\n`, "utf8");
  const outOfRange = await h.rubricStore.getRecord(book, result.value.candidate.candidateId);
  assert.equal(outOfRange.ok, false, JSON.stringify(outOfRange));
});

requiredTest("a book below the bar is REFUSED promotion and the message names the weak factors", async (context: TestContext) => {
  const book = "rubric-below-bar";
  const h = await buildBookRunHarness(context, book, ["PASS"], {
    rubricPanel: scriptedRubricPanel([{
      readers: [1, 2, 3].map((number) => fakeReader(number, { base: 74, factors: { limits: 62, density: 66 } })),
    }]),
  });
  const result = await h.service.run({ ...h.request });
  assert.equal(result.ok, false, JSON.stringify(result));
  if (result.ok) throw new Error("a book below the owner's ruler must not be promoted");
  assert.equal(result.error.code, "RUBRIC_BELOW_BAR");
  assert.match(result.error.message, /composite 7\d\.\d < bar 80/);
  assert.match(result.error.message, /factor medians below 70: limits 62, density 66/);
  // Nothing was promoted: the pointer never moved.
  assert.equal(h.events.some((event) => event.phase === "promotion" && event.status === "STARTED"), false, JSON.stringify(h.events.map((e) => `${e.phase}:${e.status}`)));
  const failed = h.events.find((event) => event.phase === "rubric" && event.status === "FAILED");
  assert.match(failed?.detail ?? "", /^RUBRIC_BELOW_BAR;/);
});

requiredTest("a SPLIT correctness gate fails CLOSED with the disputed quote — never a majority PASS", async (context: TestContext) => {
  const book = "rubric-split-gate";
  const h = await buildBookRunHarness(context, book, ["PASS"], {
    rubricPanel: scriptedRubricPanel([{
      readers: [
        fakeReader(1, { base: 90 }),
        fakeReader(2, { base: 90 }),
        fakeReader(3, { base: 90, gate: "FAIL", gateFailures: "ch1 cites the Ruskin Institute, which does not exist" }),
      ],
    }]),
  });
  const result = await h.service.run({ ...h.request });
  assert.equal(result.ok, false, JSON.stringify(result));
  if (result.ok) throw new Error("two votes must not out-vote a quoted fabrication");
  assert.equal(result.error.code, "RUBRIC_GATE_SPLIT");
  assert.match(result.error.message, /SPLIT 2 PASS \/ 1 FAIL/);
  assert.match(result.error.message, /the Ruskin Institute, which does not exist/);
  assert.equal(h.events.some((event) => event.phase === "promotion"), false);
});

requiredTest("a unanimous FAIL gate fails closed with every quoted violation", async (context: TestContext) => {
  const book = "rubric-unanimous-fail";
  const h = await buildBookRunHarness(context, book, ["PASS"], {
    rubricPanel: scriptedRubricPanel([{
      readers: [1, 2, 3].map((number) => fakeReader(number, {
        base: 95, gate: "FAIL", gateFailures: `reader ${number} saw scaffold token "Fact 4" in the deep read`,
      })),
    }]),
  });
  const result = await h.service.run({ ...h.request });
  assert.equal(result.ok, false, JSON.stringify(result));
  if (result.ok) throw new Error("a corrupt book must not be promoted on a 95 composite");
  assert.equal(result.error.code, "RUBRIC_GATE_FAIL");
  assert.match(result.error.message, /FAILED unanimously \(3\/3\)/);
  assert.match(result.error.message, /reader 1 saw scaffold token/);
  assert.match(result.error.message, /reader 3 saw scaffold token/);
});

requiredTest("a panel ERROR is uncertainty, not a verdict — and it never promotes", async (context: TestContext) => {
  const book = "rubric-panel-error";
  const h = await buildBookRunHarness(context, book, ["PASS"], {
    rubricPanel: scriptedRubricPanel([
      { error: { code: "CATALOG_RUBRIC_READER_FAILED", message: "reader 2 did not complete" } },
    ]),
  });
  const result = await h.service.run({ ...h.request });
  assert.equal(result.ok, false, JSON.stringify(result));
  if (result.ok) throw new Error("an unscored book must not be promoted");
  assert.equal(result.error.code, "BOOK_RUN_RUBRIC_UNAVAILABLE", "an ERROR gets its own code, never RUBRIC_GATE_FAIL");
  assert.match(result.error.message, /CATALOG_RUBRIC_READER_FAILED/);
  // No durable record was written for an unscored candidate.
  const events = h.events.filter((event) => event.phase === "rubric");
  assert.deepEqual(events.map((event) => event.status), ["STARTED", "FAILED"]);
});

requiredTest("a resume REPLAYS the durable panel and spends nothing", async (context: TestContext) => {
  const book = "rubric-resume-replay";
  const h = await buildBookRunHarness(context, book, ["PASS", "PASS"], {
    // Scripted ONCE on purpose: a second score() would throw, so a re-score is a
    // hard failure rather than a silent extra spend.
    rubricPanel: scriptedRubricPanel([{ readers: unanimousReaders(84) }]),
    promoteLocal: false,
  });
  const first = await h.service.run({ ...h.request });
  assert.equal(first.ok, true, first.ok ? "" : `${first.error.code}:${first.error.message}`);
  if (!first.ok) return;
  assert.equal(first.value.rubric?.replayed, false);

  const resumed = await h.service.run({ ...h.request, resumeRunId: h.bookRunId });
  assert.equal(resumed.ok, true, resumed.ok ? "" : `${resumed.error.code}:${resumed.error.message}`);
  if (!resumed.ok) return;
  assert.equal(resumed.value.rubric?.replayed, true, "the resume read the durable record");
  assert.equal(resumed.value.rubric?.composite, 84);
  const completed = h.events.filter((event) => event.phase === "rubric" && event.status === "COMPLETED");
  assert.equal(completed.length, 2);
  assert.match(completed[1].detail ?? "", /replayed=true/);
});

requiredTest("raising the bar re-decides a STORED panel and still spends nothing", async (context: TestContext) => {
  const book = "rubric-bar-raise";
  const h = await buildBookRunHarness(context, book, ["PASS", "PASS"], {
    rubricPanel: scriptedRubricPanel([{ readers: unanimousReaders(84) }]),
    promoteLocal: false,
  });
  const first = await h.service.run({ ...h.request, rubricBar: 80 });
  assert.equal(first.ok, true, first.ok ? "" : `${first.error.code}:${first.error.message}`);

  const raised = await h.service.run({ ...h.request, resumeRunId: h.bookRunId, rubricBar: 90 });
  assert.equal(raised.ok, false, JSON.stringify(raised));
  if (raised.ok) throw new Error("a raised bar must re-decide the stored panel");
  assert.equal(raised.error.code, "RUBRIC_BELOW_BAR");
  assert.match(raised.error.message, /composite 84\.0 < bar 90/);

  // And an out-of-range bar is refused at the input boundary, before any work.
  const bad = await h.service.run({ ...h.request, resumeRunId: h.bookRunId, rubricBar: 120 });
  assert.equal(bad.ok, false, JSON.stringify(bad));
  if (bad.ok) return;
  assert.equal(bad.error.code, "BOOK_RUN_INPUT_INVALID");
  assert.match(bad.error.message, /rubric bar must be an integer 60-95/);
});

requiredTest("the gate applies to a --no-promote READY run too, not only to promotion", async (context: TestContext) => {
  const book = "rubric-ready-gate";
  const h = await buildBookRunHarness(context, book, ["PASS"], {
    rubricPanel: scriptedRubricPanel([{ readers: unanimousReaders(70) }]),
    promoteLocal: false,
  });
  const result = await h.service.run({ ...h.request });
  assert.equal(result.ok, false, JSON.stringify(result));
  if (result.ok) throw new Error("READY must not be reported for a book the ruler rejects");
  assert.equal(result.error.code, "RUBRIC_BELOW_BAR");
});

requiredTest("a stored record bound to different bytes is refused, never adapted", async (context: TestContext) => {
  const book = "rubric-record-rebind";
  const h = await buildBookRunHarness(context, book, ["PASS", "PASS"], {
    rubricPanel: scriptedRubricPanel([{ readers: unanimousReaders(84) }]),
    promoteLocal: false,
  });
  const first = await h.service.run({ ...h.request });
  assert.equal(first.ok, true, first.ok ? "" : `${first.error.code}:${first.error.message}`);
  if (!first.ok) return;

  const paths = h.rubricStore.paths(book);
  assert.equal(paths.ok, true, JSON.stringify(paths));
  if (!paths.ok) return;
  const recordPath = paths.value.record(first.value.candidate.candidateId);
  const onDisk = JSON.parse(readFileSync(recordPath, "utf8")) as Record<string, unknown>;
  writeFileSync(
    recordPath,
    `${JSON.stringify({
      ...onDisk,
      candidate: { ...(onDisk.candidate as Record<string, unknown>), manifestDigest: "b".repeat(64) },
    }, null, 2)}\n`,
    "utf8",
  );

  const resumed = await h.service.run({ ...h.request, resumeRunId: h.bookRunId });
  assert.equal(resumed.ok, false, JSON.stringify(resumed));
  if (resumed.ok) throw new Error("a panel of other bytes must never authorize this candidate");
  assert.equal(resumed.error.code, "BOOK_RUN_RUBRIC_UNAVAILABLE");
  assert.match(resumed.error.message, /binds manifestDigest/);
});

requiredTest("a TRUNCATED record does not replay as a full panel — the seat count is part of the schema", async (context: TestContext) => {
  const book = "rubric-record-truncated";
  const h = await buildBookRunHarness(context, book, ["PASS", "PASS"], {
    rubricPanel: scriptedRubricPanel([{ readers: unanimousReaders(84) }]),
    promoteLocal: false,
  });
  const first = await h.service.run({ ...h.request });
  assert.equal(first.ok, true, first.ok ? "" : `${first.error.code}:${first.error.message}`);
  if (!first.ok) return;

  const paths = h.rubricStore.paths(book);
  assert.equal(paths.ok, true, JSON.stringify(paths));
  if (!paths.ok) return;
  const recordPath = paths.value.record(first.value.candidate.candidateId);
  const onDisk = JSON.parse(readFileSync(recordPath, "utf8")) as Record<string, unknown>;
  const readers = onDisk.readers as unknown[];
  assert.equal(readers.length, 3);
  // One reader kept: a hand-edited or half-written record that would otherwise
  // replay as a three-reader panel and carry this candidate for zero spend.
  writeFileSync(recordPath, `${JSON.stringify({ ...onDisk, readers: [readers[0]] }, null, 2)}\n`, "utf8");
  const resumed = await h.service.run({ ...h.request, resumeRunId: h.bookRunId });
  assert.equal(resumed.ok, false, JSON.stringify(resumed));
  if (resumed.ok) throw new Error("a one-reader record must never replay as a panel");
  assert.equal(resumed.error.code, "BOOK_RUN_RUBRIC_UNAVAILABLE");

  // The same refusal for a record whose three blocks are the SAME seat.
  writeFileSync(
    recordPath,
    `${JSON.stringify({ ...onDisk, readers: [readers[0], readers[0], readers[0]] }, null, 2)}\n`,
    "utf8",
  );
  const duplicated = await h.service.run({ ...h.request, resumeRunId: h.bookRunId });
  assert.equal(duplicated.ok, false, JSON.stringify(duplicated));
  if (duplicated.ok) throw new Error("three copies of one seat are not three readers");
  assert.equal(duplicated.error.code, "BOOK_RUN_RUBRIC_UNAVAILABLE");
});

requiredTest("the rubric store refuses a conflicting second record for one immutable candidate", async (context: TestContext) => {
  const booksRoot = context.roots.tempRoot;
  const store = createCatalogRubricStore({ booksRoot });
  const record = {
    schemaVersion: "1" as const,
    instrumentVersion: CATALOG_RUBRIC_INSTRUMENT_VERSION,
    bookId: "store-book",
    candidate: { candidateId: "store-candidate", manifestDigest: "c".repeat(64) },
    title: "Store Book",
    author: "Fixture Author",
    totalChapters: 2,
    sampledChapterNumbers: [1, 2],
    documentSha256: "d".repeat(64),
    readers: unanimousReaders(84),
    completedAt: "2026-09-02T02:00:00.000Z",
  };
  const written = await store.putRecord("store-book", record);
  assert.equal(written.ok, true, JSON.stringify(written));
  // Idempotent on identical bytes.
  assert.equal((await store.putRecord("store-book", record)).ok, true);
  // Refused on different bytes for the same candidate.
  const conflicting = await store.putRecord("store-book", { ...record, readers: unanimousReaders(90) });
  assert.equal(conflicting.ok, false, JSON.stringify(conflicting));
  if (conflicting.ok) return;
  assert.equal(conflicting.error.code, "RUBRIC_RECORD_CONFLICT");

  const read = await store.getRecord("store-book", "store-candidate");
  assert.equal(read.ok, true, JSON.stringify(read));
  if (!read.ok) return;
  assert.equal(read.value.readers[0].scores.retention, 84, "the first record stands");
  assert.equal((await store.getRecord("store-book", "absent-candidate")).ok, false);
});

finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
