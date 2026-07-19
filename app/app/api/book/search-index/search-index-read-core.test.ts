import test from "node:test";
import assert from "node:assert/strict";

import { readSearchIndex } from "./search-index-read-core";

function deps() {
  const calls = { logged: [] as unknown[], metrics: 0 };
  return {
    calls,
    logError: (error: unknown) => {
      calls.logged.push(error);
    },
    emitOpsFailure: async () => {
      calls.metrics += 1;
    },
  };
}

test("passes a non-empty body through untouched", async () => {
  const d = deps();
  const result = await readSearchIndex({
    fetchIndexBody: async () => `[{"id":"x"}]`,
    logError: d.logError,
    emitOpsFailure: d.emitOpsFailure,
  });
  assert.deepEqual(result, { kind: "ok", body: `[{"id":"x"}]` });
  assert.equal(d.calls.logged.length, 0);
  assert.equal(d.calls.metrics, 0);
});

test("an absent body is a legitimate empty index — no log, no metric", async () => {
  const d = deps();
  const result = await readSearchIndex({
    fetchIndexBody: async () => undefined,
    logError: d.logError,
    emitOpsFailure: d.emitOpsFailure,
  });
  assert.deepEqual(result, { kind: "empty" });
  assert.equal(d.calls.logged.length, 0);
  assert.equal(d.calls.metrics, 0);
});

test("an S3/env failure is not a silent empty 200: logs and emits the ops metric", async () => {
  const d = deps();
  const boom = new Error("Missing env var BOOK_CONTENT_BUCKET");
  const result = await readSearchIndex({
    fetchIndexBody: async () => {
      throw boom;
    },
    logError: d.logError,
    emitOpsFailure: d.emitOpsFailure,
  });
  assert.deepEqual(result, { kind: "failed" });
  assert.deepEqual(d.calls.logged, [boom]);
  assert.equal(d.calls.metrics, 1);
});

test("a throwing metric emitter does not mask the degrade result", async () => {
  const d = deps();
  const result = await readSearchIndex({
    fetchIndexBody: async () => {
      throw new Error("s3 down");
    },
    logError: d.logError,
    emitOpsFailure: async () => {
      throw new Error("cloudwatch down");
    },
  });
  assert.deepEqual(result, { kind: "failed" });
  assert.equal(d.calls.logged.length, 1);
});
