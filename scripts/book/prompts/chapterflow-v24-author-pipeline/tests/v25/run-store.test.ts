import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { Result } from "../../src/contracts/v4Core.js";
import {
  FileRunStore,
  type AttemptAdmission,
  type RunDefinition,
} from "../../src/run-state/index.js";
import { finishV25Tests, requiredTest } from "./harness.js";

function definition(
  bookId: string,
  runId: string,
  limits: { readonly run: number; readonly write: number } = { run: 2, write: 2 },
): RunDefinition {
  return {
    schemaVersion: "1",
    bookId,
    runId,
    commandId: "author-run",
    sourceGitSha: "a".repeat(40),
    requiredStages: ["write"],
    requiredInventory: [{ kind: "CHAPTER", logicalPath: "chapters/ch01.md", mediaType: "text/markdown" }],
    attemptLimits: { run: limits.run, byStage: { write: limits.write } },
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

function admission(run: RunDefinition, attemptId: string, operationId = "write-ch01"): AttemptAdmission {
  return {
    bookId: run.bookId,
    runId: run.runId,
    attemptId,
    stageId: "write",
    operationId,
    admittedAt: "2026-01-01T00:00:00.010Z",
    staleAt: "2026-01-01T00:00:01.010Z",
  };
}

function expectOk<T>(result: Result<T>): T {
  if (!result.ok) assert.fail(`${result.error.code}: ${result.error.message}`);
  return result.value;
}

function expectCode(result: Result<unknown>, code: string): void {
  assert.equal(result.ok, false, `expected ${code}`);
  if (result.ok) return;
  assert.equal(result.error.code, code);
}

function runDir(root: string, run: RunDefinition): string {
  return join(root, "books", run.bookId, "runs", run.runId);
}

requiredTest("last-slot contenders consume one durable admission", async ({ roots }) => {
  const run = definition("race-book", "race-run", { run: 1, write: 1 });
  const left = new FileRunStore(roots.stateRoot);
  const right = new FileRunStore(roots.stateRoot);
  expectOk(await left.createRun(run));

  const results = await Promise.all([
    left.admitAttempt(admission(run, "attempt-left", "write-left")),
    right.admitAttempt(admission(run, "attempt-right", "write-right")),
  ]);
  assert.equal(results.filter((result) => result.ok).length, 1);
  assert.equal(results.filter((result) => !result.ok && result.error.code === "LIMIT_REACHED").length, 1);

  const snapshot = expectOk(await new FileRunStore(roots.stateRoot).readRun(run.bookId, run.runId, "2026-01-01T00:00:00.020Z"));
  assert.equal(snapshot.attempts.length, 1);
  assert.equal(readFileSync(join(runDir(roots.stateRoot, run), "attempts.jsonl"), "utf8").trim().split("\n").length, 1);
});

requiredTest("admission and attempt terminal replays preserve exact bytes", async ({ roots }) => {
  const run = definition("replay-book", "replay-run");
  const store = new FileRunStore(roots.stateRoot);
  expectOk(await store.createRun(run));
  const admitted = admission(run, "attempt-one");
  expectOk(await store.admitAttempt(admitted));
  const journal = join(runDir(roots.stateRoot, run), "attempts.jsonl");
  const afterAdmission = readFileSync(journal, "utf8");

  expectOk(await store.admitAttempt(admitted));
  assert.equal(readFileSync(journal, "utf8"), afterAdmission);
  expectCode(await store.admitAttempt({ ...admitted, operationId: "changed-operation" }), "CONFLICT");
  assert.equal(readFileSync(journal, "utf8"), afterAdmission);

  const finish = {
    bookId: run.bookId,
    runId: run.runId,
    attemptId: admitted.attemptId,
    outcome: "SUCCEEDED" as const,
    finishedAt: "2026-01-01T00:00:00.030Z",
    detail: "persisted",
  };
  expectOk(await store.finishAttempt(finish));
  const afterFinish = readFileSync(journal, "utf8");
  expectOk(await store.finishAttempt(finish));
  assert.equal(readFileSync(journal, "utf8"), afterFinish);
  expectCode(await store.finishAttempt({ ...finish, outcome: "FAILED" }), "CONFLICT");
  assert.equal(readFileSync(journal, "utf8"), afterFinish);
});

requiredTest("crash-shaped admitted work becomes stale without replay", async ({ roots }) => {
  const run = definition("stale-book", "stale-run");
  const firstProcess = new FileRunStore(roots.stateRoot);
  expectOk(await firstProcess.createRun(run));
  const admitted = { ...admission(run, "attempt-crashed"), staleAt: "2026-01-01T00:00:00.050Z" };
  expectOk(await firstProcess.admitAttempt(admitted));

  const reopened = new FileRunStore(roots.stateRoot);
  const snapshot = expectOk(await reopened.readRun(run.bookId, run.runId, "2026-01-01T00:00:00.050Z"));
  assert.equal(snapshot.attempts.length, 1);
  assert.equal(snapshot.attempts[0]?.status, "STALE");
  assert.equal(snapshot.attempts[0]?.admission.attemptId, "attempt-crashed");
  assert.equal(readFileSync(join(runDir(roots.stateRoot, run), "attempts.jsonl"), "utf8").trim().split("\n").length, 1);
});

requiredTest("corrupt journal makes every run mutator fail without durable write", async ({ roots }) => {
  const run = definition("corrupt-book", "journal-run", { run: 3, write: 3 });
  const store = new FileRunStore(roots.stateRoot);
  expectOk(await store.createRun(run));
  const admitted = admission(run, "attempt-original");
  expectOk(await store.admitAttempt(admitted));
  const dir = runDir(roots.stateRoot, run);
  const runFile = join(dir, "run.json");
  const journal = join(dir, "attempts.jsonl");
  writeFileSync(journal, `${readFileSync(journal, "utf8")}{torn`);
  const beforeRun = readFileSync(runFile, "utf8");
  const beforeJournal = readFileSync(journal, "utf8");

  const results: Result<unknown>[] = [
    await store.createRun(run),
    await store.admitAttempt(admission(run, "attempt-new", "write-new")),
    await store.finishAttempt({
      bookId: run.bookId,
      runId: run.runId,
      attemptId: admitted.attemptId,
      outcome: "UNKNOWN",
      finishedAt: "2026-01-01T00:00:00.040Z",
    }),
    await store.requestCancel({
      bookId: run.bookId,
      runId: run.runId,
      reason: "operator stop",
      requestedAt: "2026-01-01T00:00:00.040Z",
    }),
    await store.finishRun({
      bookId: run.bookId,
      runId: run.runId,
      status: "FAILED",
      finishedAt: "2026-01-01T00:00:00.040Z",
      reason: "broken lifecycle",
    }),
  ];
  for (const result of results) expectCode(result, "STATE_CORRUPT");
  assert.equal(readFileSync(runFile, "utf8"), beforeRun);
  assert.equal(readFileSync(journal, "utf8"), beforeJournal);
});

requiredTest("corrupt run record blocks create and admission without overwrite", async ({ roots }) => {
  const run = definition("corrupt-book", "record-run");
  const store = new FileRunStore(roots.stateRoot);
  expectOk(await store.createRun(run));
  const path = join(runDir(roots.stateRoot, run), "run.json");
  writeFileSync(path, "{bad-run\n");
  const before = readFileSync(path, "utf8");
  expectCode(await store.createRun(run), "STATE_CORRUPT");
  expectCode(await store.admitAttempt(admission(run, "attempt-never")), "STATE_CORRUPT");
  assert.equal(readFileSync(path, "utf8"), before);
});

requiredTest("invalid complete definition writes no run state", async ({ roots }) => {
  const store = new FileRunStore(roots.stateRoot);
  const invalid = { ...definition("safe-book", "safe-run"), requiredStages: ["write", "write"] } as RunDefinition;
  expectCode(await store.createRun(invalid), "INVALID_INPUT");
  assert.equal(existsSync(runDir(roots.stateRoot, invalid)), false);
});

finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
