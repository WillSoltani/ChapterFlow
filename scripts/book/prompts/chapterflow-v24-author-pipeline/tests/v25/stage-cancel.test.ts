import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { Result } from "../../src/contracts/v4Core.js";
import {
  FileRunStore,
  FileStageCoordinator,
  reconcileAttempt,
  type AttemptAdmission,
  type RunDefinition,
  type StageCheckpoint,
} from "../../src/run-state/index.js";
import { finishV25Tests, requiredTest } from "./harness.js";

function definition(bookId: string, runId: string): RunDefinition {
  return {
    schemaVersion: "1",
    bookId,
    runId,
    commandId: "walk",
    sourceGitSha: "d".repeat(40),
    requiredStages: ["write", "review"],
    requiredInventory: [{ kind: "CHAPTER", logicalPath: "chapters/ch01.md", mediaType: "text/markdown" }],
    attemptLimits: { run: 3, byStage: { write: 2, review: 1 } },
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

function admission(run: RunDefinition, attemptId: string): AttemptAdmission {
  return {
    bookId: run.bookId,
    runId: run.runId,
    attemptId,
    stageId: "write",
    operationId: "write-ch01",
    admittedAt: "2026-01-01T00:00:00.010Z",
    staleAt: "2026-01-01T00:00:00.050Z",
  };
}

function checkpoint(run: RunDefinition, status: StageCheckpoint["status"] = "COMPLETED"): StageCheckpoint {
  return {
    schemaVersion: "1",
    bookId: run.bookId,
    runId: run.runId,
    stageId: "write",
    status,
    attemptIds: ["attempt-one"],
    completedAt: "2026-01-01T00:00:00.040Z",
  };
}

function expectOk<T>(result: Result<T>): T {
  if (!result.ok) assert.fail(`${result.error.code}: ${result.error.message}`);
  return result.value;
}

function expectCode(result: Result<unknown>, code: string): void {
  assert.equal(result.ok, false, `expected ${code}`);
  if (!result.ok) assert.equal(result.error.code, code);
}

requiredTest("durable cancellation blocks work and waits for reconciliation", async ({ roots }) => {
  const run = definition("cancel-book", "cancel-run");
  const store = new FileRunStore(roots.stateRoot);
  const coordinator = new FileStageCoordinator(roots.stateRoot);
  expectOk(await store.createRun(run));
  expectOk(await store.admitAttempt(admission(run, "attempt-one")));
  const cancel = {
    bookId: run.bookId,
    runId: run.runId,
    reason: "operator requested stop",
    requestedAt: "2026-01-01T00:00:00.020Z",
  };
  expectOk(await store.requestCancel(cancel));
  const runFile = join(roots.stateRoot, "books", run.bookId, "runs", run.runId, "run.json");
  const cancelBytes = readFileSync(runFile, "utf8");
  expectOk(await store.requestCancel(cancel));
  assert.equal(readFileSync(runFile, "utf8"), cancelBytes);

  const reopened = new FileRunStore(roots.stateRoot);
  expectCode(await reopened.admitAttempt({ ...admission(run, "attempt-two"), admittedAt: "2026-01-01T00:00:00.030Z" }), "CANCELLED");
  expectCode(await new FileStageCoordinator(roots.stateRoot).checkpoint(checkpoint(run)), "CANCELLED");
  expectCode(await reopened.finishRun({
    bookId: run.bookId,
    runId: run.runId,
    status: "CANCELLED",
    finishedAt: "2026-01-01T00:00:00.060Z",
  }), "UNSETTLED_ATTEMPTS");

  expectOk(await reconcileAttempt(reopened, {
    bookId: run.bookId,
    runId: run.runId,
    attemptId: "attempt-one",
    outcome: "UNKNOWN",
    finishedAt: "2026-01-01T00:00:00.060Z",
    detail: "process state unavailable after restart",
  }));
  expectOk(await reopened.finishRun({
    bookId: run.bookId,
    runId: run.runId,
    status: "CANCELLED",
    finishedAt: "2026-01-01T00:00:00.070Z",
  }));

  const terminal = expectOk(await new FileRunStore(roots.stateRoot).readRun(run.bookId, run.runId, "2026-01-01T00:00:00.080Z"));
  assert.equal(terminal.status, "CANCELLED");
  assert.equal(terminal.cancellationReason, cancel.reason);
  assert.equal(terminal.attempts[0]?.status, "UNKNOWN");
  expectCode(await coordinator.planResume(run), "TERMINAL");
  expectCode(await reopened.admitAttempt({
    ...admission(run, "attempt-three"),
    admittedAt: "2026-01-01T00:00:00.080Z",
    staleAt: "2026-01-01T00:00:00.100Z",
  }), "TERMINAL");
});

requiredTest("settled required-stage failure persists reason and cannot resume", async ({ roots }) => {
  const run = definition("failure-book", "failure-run");
  const store = new FileRunStore(roots.stateRoot);
  const coordinator = new FileStageCoordinator(roots.stateRoot);
  expectOk(await store.createRun(run));
  expectOk(await store.admitAttempt(admission(run, "attempt-one")));
  expectOk(await store.finishAttempt({
    bookId: run.bookId,
    runId: run.runId,
    attemptId: "attempt-one",
    outcome: "FAILED",
    finishedAt: "2026-01-01T00:00:00.030Z",
    detail: "required validation failed",
  }));
  expectOk(await coordinator.checkpoint(checkpoint(run, "FAILED")));
  const finish = {
    bookId: run.bookId,
    runId: run.runId,
    status: "FAILED" as const,
    finishedAt: "2026-01-01T00:00:00.050Z",
    reason: "write stage failed required validation",
  };
  expectOk(await store.finishRun(finish));
  const terminalBytes = readFileSync(join(roots.stateRoot, "books", run.bookId, "runs", run.runId, "run.json"), "utf8");
  expectOk(await store.finishRun(finish));
  assert.equal(readFileSync(join(roots.stateRoot, "books", run.bookId, "runs", run.runId, "run.json"), "utf8"), terminalBytes);

  const reopened = new FileRunStore(roots.stateRoot);
  const snapshot = expectOk(await reopened.readRun(run.bookId, run.runId, "2026-01-01T00:00:00.060Z"));
  assert.equal(snapshot.status, "FAILED");
  assert.equal(snapshot.terminalReason, finish.reason);
  expectCode(await new FileStageCoordinator(roots.stateRoot).planResume(run), "TERMINAL");
  expectCode(await reopened.admitAttempt({
    ...admission(run, "attempt-two"),
    admittedAt: "2026-01-01T00:00:00.060Z",
    staleAt: "2026-01-01T00:00:00.090Z",
  }), "TERMINAL");
});

finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
