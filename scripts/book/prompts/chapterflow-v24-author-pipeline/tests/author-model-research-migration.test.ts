import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { runJsonModelTask, type ModelCallerExecution, type ModelTaskRunner } from "../src/app/modelTaskRunner.js";
import { MAX_BIBLIOGRAPHY_ATTEMPTS, runResearcherBibliography } from "../src/agents/researcher-bibliography.js";
import { MAX_CHAPTER_RESEARCH_ATTEMPTS, runResearcherChapter } from "../src/agents/researcher-chapter.js";
import { runTryThisNow } from "../src/agents/try-this-now.js";
import { runWriterBreakdown } from "../src/agents/writer-breakdown.js";
import { runWriterCards } from "../src/agents/writer-cards.js";
import { runWriterExample } from "../src/agents/writer-example.js";
import { researchBook } from "../src/researcher.js";
import { test } from "./harness.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OWNED = [
  "src/app/modelTaskRunner.ts", "src/agents/categorizer.ts", "src/agents/curriculum-planner.ts",
  "src/agents/editor-in-chief.ts", "src/agents/line-editor.ts", "src/agents/memorable-lines.ts",
  "src/agents/voice-pass.ts", "src/agents/researcher-bibliography.ts", "src/agents/researcher-chapter.ts",
  "src/agents/try-this-now.ts", "src/agents/writer-breakdown.ts", "src/agents/writer-cards.ts",
  "src/agents/writer-example.ts", "src/researcher.ts",
  "src/scratch/backfill-memorable-lines.ts", "src/scratch/regenerate-broken-memorable-lines.ts",
] as const;

const CALLER_TASKS = {
  "src/agents/categorizer.ts": "categorizer",
  "src/agents/curriculum-planner.ts": "curriculum-planner",
  "src/agents/editor-in-chief.ts": "editor-in-chief",
  "src/agents/line-editor.ts": "line-editor",
  "src/agents/memorable-lines.ts": "memorable-lines",
  "src/agents/voice-pass.ts": "voice-pass",
  "src/agents/researcher-bibliography.ts": "researcher-bibliography",
  "src/agents/researcher-chapter.ts": "researcher-chapter",
  "src/agents/try-this-now.ts": "try-this-now",
  "src/agents/writer-breakdown.ts": "writer-breakdown",
  "src/agents/writer-cards.ts": "writer-cards",
  "src/agents/writer-example.ts": "writer-example",
} as const;

function execution(output: unknown, calls: string[]): ModelCallerExecution {
  const runner: ModelTaskRunner = {
    async run(request) {
      calls.push(request.profileId);
      return { attemptId: request.context.attemptId, outcome: "SUCCEEDED", output };
    },
  };
  return {
    runner,
    context: {
      bookId: "test-book", runId: "run-research", attemptId: `attempt-${calls.length + 1}`,
      stageId: "research", operationId: "research-test", workDir: process.cwd(),
      signal: new AbortController().signal,
    },
  };
}

test("research callers are bounded: legacy writer callers make one explicit attempt; the chapter AND bibliography researchers retry with validator feedback up to MAX", async () => {
  const calls: string[] = [];
  const bibliographyInput = { title: "Test Book", author: "Test Author", bookIdHint: "test-book" };
  await assert.rejects(
    runResearcherBibliography(bibliographyInput, execution({}, calls), { sleep: async () => {} }),
    /bibliography invalid after \d+ attempts/,
  );
  // Task 11ag — DELIBERATE CHANGE to this invariant (was: exactly one attempt).
  // Bibliography is step 1 of a book run, so a single degenerate or transient
  // response aborted the ENTIRE run before any chapter work began. Live
  // 2026-07-28 (Franklin canary): a bare {} killed the run outright. It now
  // carries the same bounded retry as the chapter researcher. The remaining
  // legacy writer callers below (breakdown, cards, example, try-this-now) keep
  // their single-attempt boundary — they are v23-era surfaces that the v25
  // section-pack compiler does not use.
  assert.equal(calls.length, MAX_BIBLIOGRAPHY_ATTEMPTS);

  // The chapter researcher is the one exception: on invalid output it re-issues the
  // task with the validator's error list (Task 11a), bounded at MAX_CHAPTER_RESEARCH_ATTEMPTS.
  const chapterCallsBefore = calls.length;
  const bibliography: any = { bookId: "test-book", title: "Test Book", author: "Test Author", thesis: "test thesis", teachingArc: "test arc" };
  await assert.rejects(runResearcherChapter({ bibliography, chapter: { number: 1, title: "First" } }, execution({}, calls)), /chapter research invalid after \d+ attempts/);
  assert.equal(calls.length - chapterCallsBefore, MAX_CHAPTER_RESEARCH_ATTEMPTS);

  const brief: any = { bookId: "test-book", voiceCharter: {}, voiceSpecimens: [] };
  const plan: any = { chapterId: "test-book-ch01", number: 1, title: "First", coreMove: "specific core move", cardFocus: { count: 1 } };
  await assert.rejects(runWriterBreakdown({ brief, plan }, execution({}, calls)), /breakdown/);
  await assert.rejects(runWriterCards({ brief, plan, breakdown: {} as any }, execution({}, calls)), /cards/);
  await assert.rejects(
    runWriterExample(
      { brief, plan, spec: {} as any, specIndex: 0, usedNames: [] },
      execution({ exampleId: "", title: "", scenario: "", whatToDo: "", whyItMatters: "" }, calls),
    ),
    /example/,
  );
  const action = "Write one decision you must make today, name the smallest reversible step, and take it before you close this page.";
  assert.equal((await runTryThisNow({ brief, plan }, execution({ tryThisNow: action }, calls))).tryThisNow, action);
  // 4 single-attempt legacy writer callers (breakdown, cards, example, try-this-now)
  // + the bounded bibliography retries + the bounded chapter retries.
  assert.equal(calls.length, 4 + MAX_BIBLIOGRAPHY_ATTEMPTS + MAX_CHAPTER_RESEARCH_ATTEMPTS);
  assert.ok(calls.every((profile) => profile === "pipeline-read-json-v1"));
});

test("research orchestrator has no ambient default model binding", async () => {
  await assert.rejects(researchBook("Test Book", "Test Author"), /MODEL_TASK_RUNNER_REQUIRED/);
});

test("researcher chapter prompt keeps good paraphrase notes free of meta narration", () => {
  const prompt = readFileSync(resolve(__dirname, "../prompts/researcher-chapter.system.md"), "utf8");
  const goodBlock = prompt.match(/### Good `paraphraseNotes`\s*\n\s*"([\s\S]*?)"\s*\n\s*\nWrite the ChapterResearchResult JSON now\./);
  assert.ok(goodBlock, "Good paraphraseNotes exemplar must remain extractable");

  const metaReference = /\b(?:this chapter|the chapter|the author|the book|chapter\s+\d+)\b|\bin (?:this )?(?:chapter|section|book)\b/i;
  assert.doesNotMatch(goodBlock[1], metaReference);

  const richSourceRule = prompt.match(/6\. \*\*`paraphraseNotes` is the rich source\.\*\*([^\n]+)/);
  assert.ok(richSourceRule, "paraphraseNotes instruction must remain extractable");
  assert.match(richSourceRule[1], /claims and examples directly in source order/i);
  assert.match(richSourceRule[1], /final practical rule/i);
  assert.doesNotMatch(richSourceRule[1], /what the chapter does|conclusion it lands on/i);
});

test("explicit model caller profile override preserves injected work directory", async () => {
  const seen: Array<{ profileId: string; workDir: string }> = [];
  const workDir = resolve(__dirname, ".tmp", "isolated-attempt");
  const runner: ModelTaskRunner = {
    async run(request) {
      seen.push({ profileId: request.profileId, workDir: request.context.workDir });
      return { attemptId: request.context.attemptId, outcome: "SUCCEEDED", output: { ok: true } };
    },
  };
  await runJsonModelTask(
    {
      runner,
      profileId: "attempt-read-json-v1",
      context: {
        bookId: "test-book",
        runId: "run-profile",
        attemptId: "attempt-profile",
        stageId: "research",
        operationId: "research-profile",
        workDir,
        signal: new AbortController().signal,
      },
    },
    "researcher-chapter",
    "system",
    "user",
  );
  assert.deepEqual(seen, [{ profileId: "attempt-read-json-v1", workDir }]);
});

test("owned model caller inventory has zero direct/provider/process routes", () => {
  const pipelineRoot = resolve(__dirname, "..");
  for (const path of OWNED) {
    const source = readFileSync(resolve(pipelineRoot, path), "utf8");
    assert.doesNotMatch(source, /\b(callClaude|callModel)\b/);
    assert.doesNotMatch(source, /from\s+["'][^"']*providers\//);
    assert.doesNotMatch(source, /from\s+["'](?:node:)?child_process["']/);
    assert.doesNotMatch(source, /CHAPTERFLOW_(?:PROVIDER|RESEARCHER_MODEL)/);
    assert.doesNotMatch(source, /(?:anthropic-cli|provider-default)/);
  }
  for (const [path, taskId] of Object.entries(CALLER_TASKS)) {
    const source = readFileSync(resolve(pipelineRoot, path), "utf8");
    assert.match(source, new RegExp(`runJsonModelTask<[^>]+>\\([^\\n]+[\"']${taskId}[\"']`));
  }
});

test("both retained scratch callers return stable disabled error", async () => {
  const backfill = await import("../src/scratch/backfill-memorable-lines.js");
  const regenerate = await import("../src/scratch/regenerate-broken-memorable-lines.js");
  await assert.rejects(backfill.main(), /SCRATCH_DISABLED:MODEL_TASK_RUNNER_REQUIRED/);
  await assert.rejects(regenerate.main(), /SCRATCH_DISABLED:MODEL_TASK_RUNNER_REQUIRED/);
});
