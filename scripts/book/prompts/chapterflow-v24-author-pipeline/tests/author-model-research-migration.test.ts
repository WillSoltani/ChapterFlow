import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { ModelCallerExecution, ModelTaskRunner } from "../src/app/modelTaskRunner.js";
import { runResearcherBibliography } from "../src/agents/researcher-bibliography.js";
import { runResearcherChapter } from "../src/agents/researcher-chapter.js";
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

test("research callers make one bounded explicit attempt and never retry malformed output", async () => {
  const calls: string[] = [];
  const bibliographyInput = { title: "Test Book", author: "Test Author", bookIdHint: "test-book" };
  await assert.rejects(runResearcherBibliography(bibliographyInput, execution({}, calls)), /bibliography/);
  const bibliography: any = { bookId: "test-book", title: "Test Book", author: "Test Author", thesis: "test thesis", teachingArc: "test arc" };
  await assert.rejects(runResearcherChapter({ bibliography, chapter: { number: 1, title: "First" } }, execution({}, calls)), /chapter/);
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
  assert.equal(calls.length, 6);
  assert.ok(calls.every((profile) => profile === "pipeline-read-json-v1"));
});

test("research orchestrator has no ambient default model binding", async () => {
  await assert.rejects(researchBook("Test Book", "Test Author"), /MODEL_TASK_RUNNER_REQUIRED/);
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
