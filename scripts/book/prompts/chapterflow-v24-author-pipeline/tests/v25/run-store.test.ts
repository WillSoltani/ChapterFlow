import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

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

function candidateDefinition(bookId: string, runId: string): RunDefinition {
  return {
    ...definition(bookId, runId),
    commandId: "canonical-review",
    inputCandidate: { candidateId: "candidate-one", manifestDigest: "0".repeat(64) },
  };
}

function expectConflict(result: Result<unknown>, runId: string, label: string): void {
  assert.equal(result.ok, false, `expected CONFLICT for ${label}`);
  if (result.ok) return;
  assert.equal(result.error.code, "CONFLICT", label);
  assert.equal(result.error.message, `run ${runId} already exists with a different definition`, label);
}

async function captureStderr<T>(task: () => Promise<T>): Promise<{ readonly value: T; readonly lines: readonly string[] }> {
  const lines: string[] = [];
  const original = console.error;
  console.error = (...args: readonly unknown[]): void => { lines.push(args.map((arg) => String(arg)).join(" ")); };
  try {
    const value = await task();
    return { value, lines };
  } finally {
    console.error = original;
  }
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

function waitForChild(child: ChildProcess): Promise<{ readonly code: number | null; readonly stdout: string; readonly stderr: string }> {
  return new Promise((done) => {
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk: Buffer | string) => { stdout += chunk.toString(); });
    child.stderr?.on("data", (chunk: Buffer | string) => { stderr += chunk.toString(); });
    child.on("close", (code) => done({ code, stdout, stderr }));
  });
}

async function waitForFile(path: string): Promise<void> {
  for (let attempt = 0; attempt < 500; attempt++) {
    if (existsSync(path)) return;
    await new Promise((done) => setTimeout(done, 10));
  }
  throw new Error(`timed out waiting for child marker: ${path}`);
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

requiredTest("live cross-process lock owner is never expired or unlinked", async ({ roots }) => {
  const run = definition("process-lock-book", "process-lock-run");
  expectOk(await new FileRunStore(roots.stateRoot).createRun(run));
  const helper = join(roots.tempRoot, "hold-run-lock.ts");
  const events = join(roots.tempRoot, "lock-events.jsonl");
  const ready = join(roots.tempRoot, "owner-a-ready");
  writeFileSync(helper, `
import { appendFileSync, writeFileSync } from "node:fs";

async function main(): Promise<void> {
  const [moduleUrl, stateRoot, bookId, runId, role, holdText, eventsPath, readyPath] = process.argv.slice(2);
  const { withRunStateLock } = await import(moduleUrl);
  await withRunStateLock(stateRoot, bookId, runId, false, async () => {
    appendFileSync(eventsPath, JSON.stringify({ role, event: "enter", at: Date.now() }) + "\\n");
    if (role === "A") writeFileSync(readyPath, "ready\\n");
    await new Promise((done) => setTimeout(done, Number(holdText)));
    appendFileSync(eventsPath, JSON.stringify({ role, event: "exit", at: Date.now() }) + "\\n");
  });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
`);
  const moduleUrl = pathToFileURL(resolve("src/run-state/fileRunStore.ts")).href;
  const launch = (role: string, holdMilliseconds: number) => spawn(
    process.execPath,
    [...process.execArgv, helper, moduleUrl, roots.stateRoot, run.bookId, run.runId, role, String(holdMilliseconds), events, ready],
    { cwd: resolve("."), env: process.env, stdio: ["ignore", "pipe", "pipe"] },
  );

  const ownerA = launch("A", 1_500);
  const ownerADone = waitForChild(ownerA);
  await waitForFile(ready);
  const contenderB = launch("B", 10);
  const contenderBDone = waitForChild(contenderB);
  const [aResult, bResult] = await Promise.all([ownerADone, contenderBDone]);
  assert.equal(aResult.code, 0, aResult.stderr || aResult.stdout);
  assert.equal(bResult.code, 0, bResult.stderr || bResult.stdout);

  const recorded = readFileSync(events, "utf8").trim().split("\n").map((line) => JSON.parse(line) as {
    role: string;
    event: string;
    at: number;
  });
  const aEnter = recorded.find((entry) => entry.role === "A" && entry.event === "enter");
  const aExit = recorded.find((entry) => entry.role === "A" && entry.event === "exit");
  const bEnter = recorded.find((entry) => entry.role === "B" && entry.event === "enter");
  assert.ok(aEnter && aExit && bEnter);
  assert.ok(aExit.at - aEnter.at >= 1_400, "owner A must remain live beyond old one-second expiry");
  assert.ok(bEnter.at >= aExit.at, "contender entered before live owner exited");
  assert.equal(existsSync(join(runDir(roots.stateRoot, run), ".writer.lock")), false);
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

requiredTest("deleted attempt journal is corruption and cannot reset consumed budget", async ({ roots }) => {
  const run = definition("missing-journal-book", "missing-journal-run", { run: 2, write: 2 });
  const store = new FileRunStore(roots.stateRoot);
  expectOk(await store.createRun(run));
  expectOk(await store.admitAttempt(admission(run, "attempt-consumed")));
  const dir = runDir(roots.stateRoot, run);
  const runFile = join(dir, "run.json");
  const journal = join(dir, "attempts.jsonl");
  unlinkSync(journal);
  const beforeRun = readFileSync(runFile, "utf8");
  const beforeEntries = readdirSync(dir).sort();

  expectCode(await store.createRun(run), "STATE_CORRUPT");
  expectCode(await store.admitAttempt(admission(run, "attempt-must-not-reset", "write-after-delete")), "STATE_CORRUPT");
  expectCode(await store.requestCancel({
    bookId: run.bookId,
    runId: run.runId,
    reason: "must fail closed",
    requestedAt: "2026-01-01T00:00:00.020Z",
  }), "STATE_CORRUPT");
  assert.equal(readFileSync(runFile, "utf8"), beforeRun);
  assert.equal(existsSync(journal), false);
  assert.deepEqual(readdirSync(dir).sort(), beforeEntries);
});

requiredTest("invalid complete definition writes no run state", async ({ roots }) => {
  const store = new FileRunStore(roots.stateRoot);
  const invalid = { ...definition("safe-book", "safe-run"), requiredStages: ["write", "write"] } as RunDefinition;
  expectCode(await store.createRun(invalid), "INVALID_INPUT");
  assert.equal(existsSync(runDir(roots.stateRoot, invalid)), false);
});

requiredTest("resume under a newer code sha reopens the run instead of conflicting", async ({ roots }) => {
  const run = candidateDefinition("resume-book", "resume-run");
  const store = new FileRunStore(roots.stateRoot);
  expectOk(await store.createRun(run));
  const runFile = join(runDir(roots.stateRoot, run), "run.json");
  const beforeBytes = readFileSync(runFile, "utf8");

  const sameSha = await captureStderr(async () => await store.createRun(run));
  expectOk(sameSha.value);
  assert.deepEqual(sameSha.lines, [], "an unchanged sha must log nothing");

  const upgraded: RunDefinition = { ...run, sourceGitSha: "b".repeat(40) };
  const reopened = await captureStderr(async () => await store.createRun(upgraded));
  const snapshot = expectOk(reopened.value);

  assert.equal(snapshot.definition.sourceGitSha, run.sourceGitSha, "snapshot must carry the STORED sha");
  assert.equal(readFileSync(runFile, "utf8"), beforeBytes, "the durable record must not be rewritten");
  assert.deepEqual(reopened.lines, [
    `[run-state] run=${run.runId} action=REOPENED_UNDER_DIFFERENT_SOURCE_SHA stored=${"a".repeat(12)} current=${"b".repeat(12)}`,
  ]);
});

requiredTest("every identity field except the source sha still conflicts", async ({ roots }) => {
  const run = candidateDefinition("identity-book", "identity-run");
  const store = new FileRunStore(roots.stateRoot);
  expectOk(await store.createRun(run));
  const runFile = join(runDir(roots.stateRoot, run), "run.json");
  const beforeBytes = readFileSync(runFile, "utf8");

  const mutations: readonly (readonly [string, RunDefinition])[] = [
    ["candidateId", { ...run, inputCandidate: { candidateId: "candidate-two", manifestDigest: "0".repeat(64) } }],
    ["manifestDigest", { ...run, inputCandidate: { candidateId: "candidate-one", manifestDigest: "1".repeat(64) } }],
    ["inputCandidate absent", { ...definition(run.bookId, run.runId), commandId: "canonical-review" }],
    ["commandId", { ...run, commandId: "author-run" }],
    ["requiredStages", { ...run, requiredStages: ["review"], attemptLimits: { run: 2, byStage: { review: 2 } } }],
    ["requiredInventory", {
      ...run,
      requiredInventory: [{ kind: "CHAPTER", logicalPath: "chapters/ch02.md", mediaType: "text/markdown" }],
    }],
    ["attemptLimits.run", { ...run, attemptLimits: { run: 3, byStage: { write: 2 } } }],
    ["attemptLimits.byStage", { ...run, attemptLimits: { run: 2, byStage: { write: 1 } } }],
    ["createdAt", { ...run, createdAt: "2026-01-02T00:00:00.000Z" }],
  ];

  for (const [label, mutated] of mutations) {
    expectConflict(await store.createRun(mutated), run.runId, label);
    expectConflict(await store.createRun({ ...mutated, sourceGitSha: "b".repeat(40) }), run.runId, `${label} + new sha`);
    assert.equal(readFileSync(runFile, "utf8"), beforeBytes, label);
  }
});

requiredTest("bookId and runId stay path-keyed identity", async ({ roots }) => {
  const run = candidateDefinition("identity-owner-book", "shared-run");
  const store = new FileRunStore(roots.stateRoot);
  expectOk(await store.createRun(run));
  const runFile = join(runDir(roots.stateRoot, run), "run.json");
  const beforeBytes = readFileSync(runFile, "utf8");

  // A different bookId is never the same run: it is keyed to its own directory,
  // so it can never reopen — or silently adopt — the stored one.
  const otherBook: RunDefinition = { ...run, bookId: "identity-other-book" };
  expectOk(await store.createRun(otherBook));
  assert.notEqual(runDir(roots.stateRoot, otherBook), runDir(roots.stateRoot, run));
  assert.equal(readFileSync(runFile, "utf8"), beforeBytes);

  // And a record whose stored bookId disagrees with its path still fails closed.
  const tampered = JSON.parse(beforeBytes) as { definition: { bookId: string } };
  tampered.definition.bookId = "identity-other-book";
  writeFileSync(runFile, `${JSON.stringify(tampered)}\n`);
  expectCode(await store.createRun(run), "STATE_CORRUPT");
});

finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
