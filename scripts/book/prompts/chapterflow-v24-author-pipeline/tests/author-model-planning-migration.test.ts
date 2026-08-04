import assert from "node:assert/strict";
import { mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { ModelCallerExecution, ModelTaskRunner } from "../src/app/modelTaskRunner.js";
import { runCategorizer } from "../src/agents/categorizer.js";
import { runCurriculumPlanner } from "../src/agents/curriculum-planner.js";
import { runEditorInChief } from "../src/agents/editor-in-chief.js";
import { runLineEditor } from "../src/agents/line-editor.js";
import { runMemorableLines } from "../src/agents/memorable-lines.js";
import { runVoicePass } from "../src/agents/voice-pass.js";
import { test } from "./harness.js";

function execution(output: unknown, calls: Array<{ profileId: string; attemptId: string }>): ModelCallerExecution {
  const runner: ModelTaskRunner = {
    async run(request) {
      calls.push({ profileId: request.profileId, attemptId: request.context.attemptId });
      return { attemptId: request.context.attemptId, outcome: "SUCCEEDED", output };
    },
  };
  return {
    runner,
    context: {
      bookId: "test-book",
      runId: "run-planning",
      attemptId: `attempt-${calls.length + 1}`,
      stageId: "planning",
      operationId: "planning-test",
      workDir: process.cwd(),
      signal: new AbortController().signal,
    },
  };
}

const text = (length: number, word = "sentence") => `${word} `.repeat(Math.ceil(length / (word.length + 1))).slice(0, length);

test("planning callers preserve normalized outputs through fixed JSON profile", async () => {
  const calls: Array<{ profileId: string; attemptId: string }> = [];
  const brief: any = {
    bookId: "test-book", title: "Test Book", author: "Test Author",
    thesisParagraph: text(80), coreIdeas: ["a", "b", "c"],
    voiceCharter: { signatureMoves: ["one", "two"], avoidMoves: ["three", "four"] },
    forbiddenMoves: ["x", "y", "z"],
  };
  assert.equal((await runEditorInChief(
    { bookId: "test-book", title: "Test Book", author: "Test Author" },
    execution(structuredClone(brief), calls),
  )).bookId, "test-book");

  const plan: any = {
    chapterId: "test-book-ch01", number: 1, title: "First",
    coreMove: "A sufficiently specific core move",
    exampleCount: 3,
    exampleSpecs: [1, 2, 3].map((n) => ({ domain: `specific domain ${n} detail`, requiredBeat: `specific required beat ${n} with enough detail` })),
    quizFocus: { count: 6 }, cardFocus: { count: 3 },
  };
  assert.equal((await runCurriculumPlanner(
    { brief, chapterId: "test-book-ch01", chapterNumber: 1, chapterTitle: "First" },
    execution(structuredClone(plan), calls),
  )).chapterId, "test-book-ch01");

  const draft = { fastRead: text(400, "fast"), deepRead: text(1100, "deep"), fullRead: text(2100, "full") };
  assert.deepEqual(await runVoicePass({ brief, plan, draft }, execution(structuredClone(draft), calls)), draft);
  assert.deepEqual(await runLineEditor({ brief, plan, draft }, execution(structuredClone(draft), calls)), draft);

  const memorableLines = { memorableLines: [1, 2, 3].map((n) => ({ text: `Memorable sentence number ${n} has enough length.`, location: "fullRead", why: "clear" })) };
  assert.equal((await runMemorableLines({ bookId: "test-book", chapterId: "test-book-ch01" }, execution(memorableLines, calls))).memorableLines.length, 3);

  const stateBooksDir = mkdtempSync(join(tmpdir(), "chapterflow-categorizer-"));
  const categorized = await runCategorizer(
    { bookId: "test-book", title: "Test Book", author: "Test Author", chapterTitles: ["First"] },
    { useCache: false, stateBooksDir },
    execution({ categories: ["Business", "Psychology"], tags: ["one", "two", "three", "four"] }, calls),
  );
  assert.equal(categorized.categories.length, 2);
  assert.equal(calls.length, 6);
  assert.ok(calls.every((call) => call.profileId === "pipeline-read-json-v1"));
});

test("planning caller without app wiring fails closed before runner work", async () => {
  await assert.rejects(
    runMemorableLines({ bookId: "test-book", chapterId: "test-book-ch01" }),
    /MODEL_TASK_RUNNER_REQUIRED/,
  );
});

test("unavailable route and malformed output perform no credential process or downstream work", async () => {
  const counters = { runner: 0, credentials: 0, process: 0, downstream: 0 };
  const failedExecution = execution({}, []);
  failedExecution.runner.run = async (request) => {
    counters.runner++;
    return {
      attemptId: request.context.attemptId,
      outcome: "FAILED",
      error: { code: "MODEL_PROFILE_INVALID", message: "execution profile unavailable" },
    };
  };
  await assert.rejects(
    runMemorableLines({ bookId: "test-book", chapterId: "test-book-ch01" }, failedExecution),
    /MODEL_TASK_FAILED:MODEL_PROFILE_INVALID:execution profile unavailable/,
  );
  assert.deepEqual(counters, { runner: 1, credentials: 0, process: 0, downstream: 0 });

  const stateBooksDir = mkdtempSync(join(tmpdir(), "chapterflow-malformed-"));
  await assert.rejects(
    runCategorizer(
      { bookId: "test-book", title: "Test Book", author: "Test Author", chapterTitles: ["First"] },
      { useCache: false, stateBooksDir },
      execution(null, []),
    ),
    /MODEL_TASK_OUTPUT_INVALID/,
  );
  assert.deepEqual(readdirSync(stateBooksDir), []);
});
