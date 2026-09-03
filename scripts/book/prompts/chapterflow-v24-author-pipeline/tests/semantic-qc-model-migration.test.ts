import assert from "node:assert/strict";

import type { ModelCallerExecution } from "../src/app/modelTaskRunner.js";
import { makeLiveAskModel } from "../src/critics/semantic/quizKeyJudge.js";
import { test } from "./harness.js";

function execution(output: unknown, calls: { count: number }): ModelCallerExecution {
  return {
    context: {
      bookId: "semantic-book", runId: "run-1", attemptId: "attempt-1", stageId: "quiz-key",
      operationId: "q1", workDir: "/tmp", signal: new AbortController().signal,
    },
    runner: {
      async run(request) {
        calls.count += 1;
        assert.equal(request.profileId, "pipeline-read-json-v1");
        return { attemptId: request.context.attemptId, outcome: "SUCCEEDED", output };
      },
    },
  };
}

const input = { prompt: "Question?", choices: ["A", "B", "C"] };

test("semantic quiz judge routes only through injected ModelTaskRunner", async () => {
  const calls = { count: 0 };
  const result = await makeLiveAskModel({ execution: execution({ index: 1, confidence: "high", correctText: "B", reason: "fit" }, calls) })(input);
  // R-078 added the explanation-audit channel; a model that omits it means
  // "no unsupported clause", which the live ask normalizes to an empty list.
  assert.deepEqual(result, { index: 1, confidence: "high", correctText: "B", reason: "fit", unsupportedExplanationClaims: [] });
  assert.equal(calls.count, 1);
});

test("semantic quiz judge rejects deprecated model selectors before runner", async () => {
  const calls = { count: 0 };
  await assert.rejects(
    makeLiveAskModel({ execution: execution({}, calls), provider: "openai-api" })(input),
    /UNSUPPORTED_MODEL_SELECTOR/,
  );
  assert.equal(calls.count, 0);
});

test("semantic quiz judge fails closed without injected runner", async () => {
  await assert.rejects(makeLiveAskModel()(input), /MODEL_TASK_RUNNER_REQUIRED/);
});
