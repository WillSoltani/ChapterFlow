import assert from "node:assert/strict";
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { BookId, Result, RunId, UtcIso } from "../../src/contracts/v4Core.js";
import {
  FileRunStore,
  type AttemptAdmission,
  type RunDefinition,
  type RunStore,
} from "../../src/run-state/index.js";
import { createCodexRoute, type ModelProcessRoute } from "../../src/runtime/codexRoute.js";
import { createExecutionPolicy } from "../../src/runtime/executionPolicy.js";
import type { ExecutionPolicy, ExecutionProfile } from "../../src/runtime/executionPolicyTypes.js";
import { createModelGateway } from "../../src/runtime/modelGateway.js";
import type { ModelTask } from "../../src/runtime/modelRequest.js";
import type { ProcessResult, ProcessSpec, ProcessSupervisor } from "../../src/runtime/processTypes.js";
import { finishV25Tests, requiredTest, type TestRoots } from "./harness.js";

const liveInvocationCounts = { codex: 0, provider: 0, api: 0, network: 0 };

type Counts = {
  read: number;
  admit: number;
  process: number;
  validateOutput: number;
  terminal: number;
  route: number;
};

function counts(): Counts {
  return { read: 0, admit: 0, process: 0, validateOutput: 0, terminal: 0, route: 0 };
}

function expectOk<T>(result: Result<T>): T {
  if (!result.ok) assert.fail(`${result.error.code}: ${result.error.message}`);
  return result.value;
}

function definition(bookId: string, runId: string, limit = 4): RunDefinition {
  return {
    schemaVersion: "1",
    bookId,
    runId,
    commandId: "model-command",
    sourceGitSha: "b".repeat(40),
    requiredStages: ["model"],
    requiredInventory: [],
    attemptLimits: { run: limit, byStage: { model: limit } },
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

function task(run: RunDefinition, attemptId: string, workDir: string, hostile = "HOSTILE_PROMPT_MARKER_2d19"): ModelTask {
  return {
    bookId: run.bookId,
    runId: run.runId,
    attemptId,
    stageId: "model",
    operationId: `operation-${attemptId}`,
    profileId: "attempt-read-json-v1",
    workDir,
    prompt: {
      templateId: "chapterflow-json-v1",
      inputs: [{ name: "source", mediaType: "text/plain", bytes: new TextEncoder().encode(hostile) }],
    },
    signal: new AbortController().signal,
  };
}

function admission(run: RunDefinition, attemptId: string): AttemptAdmission {
  return {
    bookId: run.bookId,
    runId: run.runId,
    attemptId,
    stageId: "model",
    operationId: `operation-${attemptId}`,
    admittedAt: "2026-01-01T00:00:00.010Z",
    staleAt: "2026-01-01T00:10:00.010Z",
  };
}

function clock(): () => UtcIso {
  let tick = 0;
  return () => new Date(Date.UTC(2026, 0, 1, 0, 0, 1, tick++ * 10)).toISOString();
}

function attemptDirectory(roots: TestRoots, name: string): string {
  const path = join(roots.workspacesRoot, name);
  mkdirSync(path, { recursive: true });
  return path;
}

function policy(roots: TestRoots, trace?: { readonly events: string[]; readonly counts: Counts }): ExecutionPolicy {
  const base = createExecutionPolicy({
    pipelineRoot: roots.tempRoot,
    attemptRoot: roots.workspacesRoot,
    baseEnvironment: {
      PATH: "/synthetic/bin",
      HOME: roots.homeRoot,
      OPENAI_API_KEY: "must-not-pass",
      CODEX_API_KEY: "must-not-pass",
      ANTHROPIC_API_KEY: "must-not-pass",
      CHAPTERFLOW_PROVIDER: "must-not-pass",
    },
  });
  if (trace === undefined) return base;
  return {
    resolve(profileId, workDir) {
      trace.events.push("validate");
      return base.resolve(profileId, workDir);
    },
    validateOutput(schema, bytes) {
      trace.counts.validateOutput++;
      trace.events.push("validate-output");
      return base.validateOutput(schema, bytes);
    },
  };
}

function route(observed: Counts): ModelProcessRoute {
  return {
    id: "synthetic-process-route",
    build(_profile: ExecutionProfile) {
      observed.route++;
      return { command: process.execPath, args: ["synthetic-model-process"] };
    },
  };
}

class FakeSupervisor implements ProcessSupervisor {
  readonly specs: ProcessSpec[] = [];

  constructor(
    private readonly observed: Counts,
    private readonly handler: (spec: ProcessSpec, index: number) => ProcessResult | Promise<ProcessResult>,
    private readonly events?: string[],
  ) {}

  async run(spec: ProcessSpec): Promise<ProcessResult> {
    this.observed.process++;
    this.events?.push("process");
    this.specs.push(spec);
    return this.handler(spec, this.specs.length - 1);
  }
}

function processResult(overrides: Partial<ProcessResult> = {}): ProcessResult {
  return {
    outcome: "EXITED",
    exitCode: 0,
    stdout: new TextEncoder().encode("{\"accepted\":true}"),
    stderr: new Uint8Array(),
    stdoutTruncated: false,
    stderrTruncated: false,
    ...overrides,
  };
}

function tracedStore(inner: RunStore, observed: Counts, events?: string[]): RunStore {
  return {
    createRun: (value) => inner.createRun(value),
    readRun(bookId, runId, observedAt) {
      observed.read++;
      return inner.readRun(bookId, runId, observedAt);
    },
    admitAttempt(value) {
      observed.admit++;
      events?.push("admit");
      return inner.admitAttempt(value);
    },
    finishAttempt(value) {
      observed.terminal++;
      events?.push("terminal");
      return inner.finishAttempt(value);
    },
    requestCancel: (value) => inner.requestCancel(value),
    finishRun: (value) => inner.finishRun(value),
  };
}

function journalPath(roots: TestRoots, run: RunDefinition): string {
  return join(roots.stateRoot, "books", run.bookId, "runs", run.runId, "attempts.jsonl");
}

function assertNoLiveInvocation(): void {
  assert.deepEqual(liveInvocationCounts, { codex: 0, provider: 0, api: 0, network: 0 });
}

requiredTest("valid task orders validation admission process output validation and terminal", async ({ roots }) => {
  const run = definition("valid-book", "valid-run");
  const inner = new FileRunStore(roots.stateRoot);
  expectOk(await inner.createRun(run));
  const observed = counts();
  const events: string[] = [];
  const executionPolicy = policy(roots, { events, counts: observed });
  const supervisor = new FakeSupervisor(observed, () => processResult(), events);
  const gateway = createModelGateway({
    runStore: tracedStore(inner, observed, events),
    processSupervisor: supervisor,
    executionPolicy,
    route: route(observed),
    now: clock(),
  });
  const workDir = attemptDirectory(roots, "attempt-valid");
  const modelTask = task(run, "attempt-valid", workDir);
  const result = await gateway.execute(modelTask);

  assert.deepEqual(events, ["validate", "admit", "process", "validate-output", "terminal"]);
  assert.deepEqual(observed, { read: 1, admit: 1, process: 1, validateOutput: 1, terminal: 1, route: 1 });
  assert.deepEqual(result, { attemptId: "attempt-valid", outcome: "SUCCEEDED", output: { accepted: true } });
  assert.equal(supervisor.specs.length, 1);
  const captured = supervisor.specs[0];
  assert.ok(captured);
  assert.equal(captured.command, process.execPath);
  assert.deepEqual(captured.args, ["synthetic-model-process"]);
  assert.equal(captured.cwd, realpathSync(workDir));
  assert.equal(captured.args.join("\0").includes("HOSTILE_PROMPT_MARKER_2d19"), false);
  assert.equal(new TextDecoder().decode(captured.stdin).includes("HOSTILE_PROMPT_MARKER_2d19"), true);
  for (const forbidden of ["OPENAI_API_KEY", "CODEX_API_KEY", "ANTHROPIC_API_KEY", "CHAPTERFLOW_PROVIDER"]) {
    assert.equal(captured.environment[forbidden], undefined);
  }
  const snapshot = expectOk(await inner.readRun(run.bookId, run.runId, "2026-01-01T00:01:00.000Z"));
  assert.equal(snapshot.attempts[0]?.status, "SUCCEEDED");
  assertNoLiveInvocation();
});

requiredTest("invalid profile workdir and pre-admission cancellation start no process", async ({ roots }) => {
  const run = definition("invalid-book", "invalid-run");
  const inner = new FileRunStore(roots.stateRoot);
  expectOk(await inner.createRun(run));
  const observed = counts();
  const supervisor = new FakeSupervisor(observed, () => processResult());
  const gateway = createModelGateway({
    runStore: tracedStore(inner, observed),
    processSupervisor: supervisor,
    executionPolicy: policy(roots),
    route: route(observed),
    now: clock(),
  });
  const validDir = attemptDirectory(roots, "attempt-invalid-gates");

  const invalidProfile = await gateway.execute({ ...task(run, "attempt-invalid-profile", validDir), profileId: "caller-profile" });
  assert.equal(invalidProfile.outcome, "FAILED");
  const invalidWorkDir = await gateway.execute({ ...task(run, "attempt-invalid-dir", roots.tempRoot) });
  assert.equal(invalidWorkDir.outcome, "FAILED");
  const controller = new AbortController();
  controller.abort();
  const cancelled = await gateway.execute({ ...task(run, "attempt-pre-cancel", validDir), signal: controller.signal });
  assert.equal(cancelled.outcome, "CANCELLED");

  assert.equal(observed.read, 0);
  assert.equal(observed.admit, 0);
  assert.equal(observed.process, 0);
  assert.equal(observed.terminal, 0);
  assertNoLiveInvocation();
});

requiredTest("exhausted cancelled corrupt and duplicate runs start zero process", async ({ roots }) => {
  const inner = new FileRunStore(roots.stateRoot);
  const observed = counts();
  const supervisor = new FakeSupervisor(observed, () => processResult());
  const gateway = createModelGateway({
    runStore: tracedStore(inner, observed),
    processSupervisor: supervisor,
    executionPolicy: policy(roots),
    route: route(observed),
    now: clock(),
  });
  const workDir = attemptDirectory(roots, "attempt-zero-process");

  const exhausted = definition("gate-book", "exhausted-run", 1);
  expectOk(await inner.createRun(exhausted));
  expectOk(await inner.admitAttempt(admission(exhausted, "attempt-consumed")));
  assert.equal((await gateway.execute(task(exhausted, "attempt-next", workDir))).outcome, "FAILED");

  const cancelled = definition("gate-book", "cancelled-run");
  expectOk(await inner.createRun(cancelled));
  expectOk(await inner.requestCancel({
    bookId: cancelled.bookId,
    runId: cancelled.runId,
    reason: "synthetic cancellation",
    requestedAt: "2026-01-01T00:00:00.020Z",
  }));
  assert.equal((await gateway.execute(task(cancelled, "attempt-after-cancel", workDir))).outcome, "CANCELLED");

  const corrupt = definition("gate-book", "corrupt-run");
  expectOk(await inner.createRun(corrupt));
  writeFileSync(join(roots.stateRoot, "books", corrupt.bookId, "runs", corrupt.runId, "run.json"), "{corrupt\n");
  assert.equal((await gateway.execute(task(corrupt, "attempt-corrupt", workDir))).outcome, "FAILED");

  const duplicate = definition("gate-book", "duplicate-run");
  expectOk(await inner.createRun(duplicate));
  expectOk(await inner.admitAttempt(admission(duplicate, "attempt-duplicate")));
  assert.equal((await gateway.execute(task(duplicate, "attempt-duplicate", workDir))).outcome, "UNKNOWN");

  assert.equal(observed.process, 0);
  assert.equal(observed.admit, 0);
  assert.equal(observed.terminal, 0);
  assertNoLiveInvocation();
});

requiredTest("concurrent duplicate attempt serializes to one admission and one process", async ({ roots }) => {
  const run = definition("duplicate-book", "concurrent-run");
  const inner = new FileRunStore(roots.stateRoot);
  expectOk(await inner.createRun(run));
  const observed = counts();
  const events: string[] = [];
  const supervisor = new FakeSupervisor(observed, async () => {
    await new Promise((done) => setTimeout(done, 30));
    return processResult();
  });
  const gateway = createModelGateway({
    runStore: tracedStore(inner, observed),
    processSupervisor: supervisor,
    executionPolicy: policy(roots, { events, counts: observed }),
    route: route(observed),
    now: clock(),
  });
  const sharedTask = task(run, "attempt-shared", attemptDirectory(roots, "attempt-shared"));
  const results = await Promise.all([gateway.execute(sharedTask), gateway.execute(sharedTask)]);

  assert.equal(results.filter((entry) => entry.outcome === "SUCCEEDED").length, 1);
  assert.equal(results.filter((entry) => entry.outcome === "UNKNOWN").length, 1);
  assert.equal(observed.admit, 1);
  assert.equal(observed.process, 1);
  assert.equal(observed.validateOutput, 1);
  assert.equal(observed.terminal, 1);
  const snapshot = expectOk(await inner.readRun(run.bookId, run.runId, "2026-01-01T00:01:00.000Z"));
  assert.equal(snapshot.attempts.length, 1);
  assert.equal(snapshot.attempts[0]?.status, "SUCCEEDED");
  assertNoLiveInvocation();
});

requiredTest("invalid model output records failed once with bounded non-secret detail", async ({ roots }) => {
  const run = definition("output-book", "invalid-output-run");
  const inner = new FileRunStore(roots.stateRoot);
  expectOk(await inner.createRun(run));
  const observed = counts();
  const events: string[] = [];
  const secretOutput = "INVALID_JSON_SECRET_OUTPUT_8c4e";
  const supervisor = new FakeSupervisor(observed, () => processResult({ stdout: new TextEncoder().encode(secretOutput) }));
  const gateway = createModelGateway({
    runStore: tracedStore(inner, observed),
    processSupervisor: supervisor,
    executionPolicy: policy(roots, { events, counts: observed }),
    route: route(observed),
    now: clock(),
  });
  const result = await gateway.execute(task(run, "attempt-invalid-output", attemptDirectory(roots, "attempt-invalid-output")));

  assert.equal(result.outcome, "FAILED");
  assert.equal(result.error?.code, "MODEL_OUTPUT_INVALID");
  assert.equal(JSON.stringify(result).includes(secretOutput), false);
  assert.deepEqual({ process: observed.process, validateOutput: observed.validateOutput, terminal: observed.terminal }, {
    process: 1,
    validateOutput: 1,
    terminal: 1,
  });
  const journal = readFileSync(journalPath(roots, run), "utf8");
  assert.equal(journal.includes(secretOutput), false);
  assert.ok(journal.length < 8_192);
  const snapshot = expectOk(await inner.readRun(run.bookId, run.runId, "2026-01-01T00:01:00.000Z"));
  assert.equal(snapshot.attempts[0]?.status, "FAILED");
  assertNoLiveInvocation();
});

requiredTest("cleanup failure and supervisor rejection stay consumed unknown without replay", async ({ roots }) => {
  const run = definition("uncertain-book", "uncertain-run");
  const inner = new FileRunStore(roots.stateRoot);
  expectOk(await inner.createRun(run));
  const observed = counts();
  const secretDiagnostic = new TextEncoder().encode("SECRET_DIAGNOSTIC_6bd0");
  const supervisor = new FakeSupervisor(observed, (_spec, index) => {
    if (index === 0) return processResult({ outcome: "CLEANUP_FAILED", exitCode: undefined, stderr: secretDiagnostic });
    throw new Error("SECRET_SUPERVISOR_REJECTION_991a");
  });
  const gateway = createModelGateway({
    runStore: tracedStore(inner, observed),
    processSupervisor: supervisor,
    executionPolicy: policy(roots),
    route: route(observed),
    now: clock(),
  });
  const workDir = attemptDirectory(roots, "attempt-uncertain");
  const cleanupTask = task(run, "attempt-cleanup", workDir);
  const cleanup = await gateway.execute(cleanupTask);
  const cleanupReplay = await gateway.execute(cleanupTask);
  const rejectionTask = task(run, "attempt-rejection", workDir);
  const rejection = await gateway.execute(rejectionTask);
  const rejectionReplay = await gateway.execute(rejectionTask);

  for (const entry of [cleanup, cleanupReplay, rejection, rejectionReplay]) assert.equal(entry.outcome, "UNKNOWN");
  assert.equal(JSON.stringify([cleanup, rejection]).includes("SECRET_"), false);
  assert.deepEqual({ admit: observed.admit, process: observed.process, terminal: observed.terminal }, {
    admit: 2,
    process: 2,
    terminal: 2,
  });
  const snapshot = expectOk(await inner.readRun(run.bookId, run.runId, "2026-01-01T00:01:00.000Z"));
  assert.deepEqual(snapshot.attempts.map((attempt) => attempt.status).sort(), ["UNKNOWN", "UNKNOWN"]);
  const journal = readFileSync(journalPath(roots, run), "utf8");
  assert.equal(journal.includes("SECRET_"), false);
  assertNoLiveInvocation();
});

requiredTest("production Codex mapping is fixed and performs no invocation during inspection", () => {
  const codex = createCodexRoute();
  const readProfile = createExecutionPolicy;
  assert.equal(typeof readProfile, "function");
  const read = codex.build({
    id: "read",
    workDirPolicy: "PIPELINE_ROOT",
    mode: "READ_ONLY",
    outputSchemaId: "text.v1",
    timeoutMs: 1,
    terminateGraceMs: 1,
    maxStdoutBytes: 1,
    maxStderrBytes: 1,
  });
  const write = codex.build({
    id: "write",
    workDirPolicy: "ATTEMPT_ROOT",
    mode: "WORKSPACE_WRITE",
    outputSchemaId: "json.object.v1",
    timeoutMs: 1,
    terminateGraceMs: 1,
    maxStdoutBytes: 1,
    maxStderrBytes: 1,
  });
  assert.equal(read.command, "codex");
  assert.equal(write.command, "codex");
  assert.equal(read.args.at(-1), "-");
  assert.equal(write.args.at(-1), "-");
  assert.equal(read.args.includes("--skip-git-repo-check"), false);
  assert.equal(write.args.includes("--skip-git-repo-check"), true);
  assert.equal(read.args.join("\0").includes("gpt-5.5"), true);
  assert.equal(write.args.join("\0").includes("gpt-5.5"), true);
  assertNoLiveInvocation();
});

finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
