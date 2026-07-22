import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

import type { UtcIso } from "../../src/contracts/v4Core.js";
import {
  FileRunStore,
  type RunDefinition,
  type RunStore,
} from "../../src/run-state/index.js";
import {
  CLAUDE_ROUTE_ID,
  createClaudeRoute,
  effortArgs,
  normalizeClaudeStdout,
} from "../../src/runtime/claudeRoute.js";
import type { ModelProcessRoute } from "../../src/runtime/codexRoute.js";
import { createExecutionPolicy } from "../../src/runtime/executionPolicy.js";
import type { ExecutionPolicy, ExecutionProfile } from "../../src/runtime/executionPolicyTypes.js";
import { createModelGateway } from "../../src/runtime/modelGateway.js";
import type { ModelTask } from "../../src/runtime/modelRequest.js";
import type { ProcessResult, ProcessSpec, ProcessSupervisor } from "../../src/runtime/processTypes.js";
import { finishV25Tests, requiredTest, type TestRoots } from "./harness.js";

const READ_ONLY_PROFILE: ExecutionProfile = {
  id: "read",
  workDirPolicy: "PIPELINE_ROOT",
  mode: "READ_ONLY",
  outputSchemaId: "json.object.v1",
  timeoutMs: 1,
  terminateGraceMs: 1,
  maxStdoutBytes: 1,
  maxStderrBytes: 1,
};

const WRITE_PROFILE: ExecutionProfile = {
  id: "write",
  workDirPolicy: "ATTEMPT_ROOT",
  mode: "WORKSPACE_WRITE",
  outputSchemaId: "json.object.v1",
  timeoutMs: 1,
  terminateGraceMs: 1,
  maxStdoutBytes: 1,
  maxStderrBytes: 1,
};

// ── build(): READ_ONLY analog (no tools, JSON envelope, prompt never in argv) ─

requiredTest("claude route READ_ONLY build: headless JSON, model, effort flag, tool lockdown, no prompt bytes in argv", () => {
  const route = createClaudeRoute("claude-sonnet-5", "high");
  assert.equal(route.id, CLAUDE_ROUTE_ID);
  const built = route.build(READ_ONLY_PROFILE);
  assert.equal(built.command, "claude");
  assert.equal(built.args.includes("-p"), true);
  assert.equal(built.args.join("\0"), ["-p", "--output-format", "json", "--model", "claude-sonnet-5", "--effort", "high", "--disallowedTools", "*"].join("\0"));
  // model flows in from the caller (config), verbatim
  assert.equal(built.args.includes("claude-sonnet-5"), true);
  // READ_ONLY analog: no write-mode permission grant leaks in
  assert.equal(built.args.includes("--permission-mode"), false);
  assert.equal(built.args.includes("acceptEdits"), false);
});

// ── build(): WORKSPACE_WRITE analog grants edits in cwd, not read-only args ──

requiredTest("claude route WORKSPACE_WRITE build: acceptEdits permission mode, no read-only tool lockdown", () => {
  const route = createClaudeRoute("claude-sonnet-5", "high");
  const built = route.build(WRITE_PROFILE);
  assert.equal(built.command, "claude");
  assert.equal(built.args.join("\0"), ["-p", "--output-format", "json", "--model", "claude-sonnet-5", "--effort", "high", "--permission-mode", "acceptEdits"].join("\0"));
  assert.equal(built.args.includes("--disallowedTools"), false);
});

requiredTest("claude route: the model id flows through verbatim (no hardcoded model)", () => {
  const a = createClaudeRoute("claude-sonnet-5", "high").build(READ_ONLY_PROFILE);
  const b = createClaudeRoute("claude-opus-5-terra", "high").build(READ_ONLY_PROFILE);
  assert.equal(a.args.includes("claude-sonnet-5"), true);
  assert.equal(b.args.includes("claude-opus-5-terra"), true);
  assert.notDeepEqual(a.args, b.args);
});

// ── effort tiers → the --effort argv flag (live probe: the CLI exposes it) ────

requiredTest("claude route effort tiers ride in argv via --effort <tier>, not an env channel", () => {
  for (const effort of ["low", "medium", "high", "xhigh", "max"] as const) {
    const built = createClaudeRoute("claude-sonnet-5", effort).build(READ_ONLY_PROFILE);
    // --effort <tier> appears as an adjacent flag/value pair in argv
    const idx = built.args.indexOf("--effort");
    assert.notEqual(idx, -1, `--effort must be present for ${effort}`);
    assert.equal(built.args[idx + 1], effort);
    // the effort is NOT smuggled through an env channel
    assert.equal(typeof (createClaudeRoute("claude-sonnet-5", effort) as { env?: unknown }).env, "undefined");
  }
  assert.deepEqual(effortArgs("xhigh"), ["--effort", "xhigh"]);
});

requiredTest("claude route: an unknown effort string degrades to the high tier flag value, never an invalid flag", () => {
  assert.deepEqual(effortArgs("bogus-effort"), ["--effort", "high"]);
  const built = createClaudeRoute("claude-sonnet-5", "bogus-effort").build(READ_ONLY_PROFILE);
  const idx = built.args.indexOf("--effort");
  assert.equal(built.args[idx + 1], "high");
});

// ── output-envelope adapter (Task 7 Step 4) ─────────────────────────────────

requiredTest("normalizeClaudeStdout unwraps the --output-format json envelope to the inner JSON", () => {
  const inner = JSON.stringify({ accepted: true, notes: ["ok"] });
  const envelope = JSON.stringify({
    type: "result",
    subtype: "success",
    is_error: false,
    result: inner,
    session_id: "s-1",
    total_cost_usd: 0.01,
  });
  const normalized = normalizeClaudeStdout(new TextEncoder().encode(envelope));
  assert.deepEqual(JSON.parse(new TextDecoder().decode(normalized)), { accepted: true, notes: ["ok"] });
});

requiredTest("normalizeClaudeStdout passes through on error envelope, non-string result, and non-JSON", () => {
  const errorEnvelope = JSON.stringify({ type: "result", is_error: true, result: "rate limited" });
  assert.equal(new TextDecoder().decode(normalizeClaudeStdout(new TextEncoder().encode(errorEnvelope))), errorEnvelope);

  const objResult = JSON.stringify({ type: "result", result: { already: "object" } });
  assert.equal(new TextDecoder().decode(normalizeClaudeStdout(new TextEncoder().encode(objResult))), objResult);

  const notJson = "this is not json at all";
  assert.equal(new TextDecoder().decode(normalizeClaudeStdout(new TextEncoder().encode(notJson))), notJson);
});

// ── gateway integration: envelope unwrap + effort env merge + guard ──────────

function definition(bookId: string, runId: string): RunDefinition {
  return {
    schemaVersion: "1",
    bookId,
    runId,
    commandId: "model-command",
    sourceGitSha: "c".repeat(40),
    requiredStages: ["model"],
    requiredInventory: [],
    attemptLimits: { run: 4, byStage: { model: 4 } },
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

function task(run: RunDefinition, attemptId: string, workDir: string): ModelTask {
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
      inputs: [{ name: "source", mediaType: "text/plain", bytes: new TextEncoder().encode("PROMPT_BYTES_9f") }],
    },
    signal: new AbortController().signal,
  };
}

function clock(): () => UtcIso {
  let tick = 0;
  return () => new Date(Date.UTC(2026, 0, 1, 0, 0, 1, tick++ * 10)).toISOString();
}

function policy(roots: TestRoots): ExecutionPolicy {
  return createExecutionPolicy({
    pipelineRoot: roots.tempRoot,
    attemptRoot: roots.workspacesRoot,
    baseEnvironment: {
      PATH: "/synthetic/bin",
      HOME: roots.homeRoot,
      ANTHROPIC_API_KEY: "must-not-pass",
      OPENAI_API_KEY: "must-not-pass",
    },
  });
}

function attemptDirectory(roots: TestRoots, name: string): string {
  const path = join(roots.workspacesRoot, name);
  mkdirSync(path, { recursive: true });
  return path;
}

class CapturingSupervisor implements ProcessSupervisor {
  readonly specs: ProcessSpec[] = [];
  constructor(private readonly stdout: Uint8Array) {}
  async run(spec: ProcessSpec): Promise<ProcessResult> {
    this.specs.push(spec);
    return {
      outcome: "EXITED",
      exitCode: 0,
      stdout: this.stdout,
      stderr: new Uint8Array(),
      stdoutTruncated: false,
      stderrTruncated: false,
    };
  }
}

async function expectRun(store: RunStore, run: RunDefinition): Promise<void> {
  const created = await store.createRun(run);
  if (!created.ok) assert.fail(`${created.error.code}: ${created.error.message}`);
}

requiredTest("gateway on claude route: unwraps envelope to inner object, effort in argv, API keys stripped", async ({ roots }) => {
  const run = definition("claude-book", "claude-run");
  const store = new FileRunStore(roots.stateRoot);
  await expectRun(store, run);
  const inner = { accepted: true };
  const envelope = JSON.stringify({ type: "result", subtype: "success", is_error: false, result: JSON.stringify(inner) });
  const supervisor = new CapturingSupervisor(new TextEncoder().encode(envelope));
  const gateway = createModelGateway({
    runStore: store,
    processSupervisor: supervisor,
    executionPolicy: policy(roots),
    route: createClaudeRoute("claude-sonnet-5", "xhigh"),
    now: clock(),
    // hermetic: never touch a real claude binary from the test suite
    modelCliPreflight: async () => {},
  });
  const result = await gateway.execute(task(run, "attempt-claude", attemptDirectory(roots, "attempt-claude")));

  assert.deepEqual(result, { attemptId: "attempt-claude", outcome: "SUCCEEDED", output: { accepted: true } });
  assert.equal(supervisor.specs.length, 1);
  const spec = supervisor.specs[0]!;
  assert.equal(spec.command, "claude");
  // prompt is on stdin, never argv
  assert.equal(spec.args.join("\0").includes("PROMPT_BYTES_9f"), false);
  assert.equal(new TextDecoder().decode(spec.stdin).includes("PROMPT_BYTES_9f"), true);
  // effort xhigh → the --effort argv flag (live probe), not an env channel
  const effortIdx = spec.args.indexOf("--effort");
  assert.notEqual(effortIdx, -1);
  assert.equal(spec.args[effortIdx + 1], "xhigh");
  // API keys still stripped
  assert.equal(spec.environment.ANTHROPIC_API_KEY, undefined);
  assert.equal(spec.environment.OPENAI_API_KEY, undefined);
  // HOME preserved → claude keeps its subscription credentials
  assert.equal(spec.environment.HOME, roots.homeRoot);
});

requiredTest("gateway route-env merge is guarded: a route claiming a forbidden key can never reintroduce it", async ({ roots }) => {
  const run = definition("guard-book", "guard-run");
  const store = new FileRunStore(roots.stateRoot);
  await expectRun(store, run);
  const hostileRoute: ModelProcessRoute = {
    id: "hostile-env-route",
    build() {
      return { command: "claude", args: ["-p"] };
    },
    env() {
      return { ANTHROPIC_API_KEY: "SMUGGLED_KEY_dead", "bad name": "x", MAX_THINKING_TOKENS: "1234" };
    },
  };
  const supervisor = new CapturingSupervisor(new TextEncoder().encode("{\"ok\":true}"));
  const gateway = createModelGateway({
    runStore: store,
    processSupervisor: supervisor,
    executionPolicy: policy(roots),
    route: hostileRoute,
    now: clock(),
    modelCliPreflight: async () => {},
  });
  const result = await gateway.execute(task(run, "attempt-guard", attemptDirectory(roots, "attempt-guard")));

  assert.equal(result.outcome, "SUCCEEDED");
  const env = supervisor.specs[0]!.environment;
  assert.equal(env.ANTHROPIC_API_KEY, undefined, "forbidden provider key must be dropped from route env");
  assert.equal(env["bad name"], undefined, "malformed env name must be dropped");
  assert.equal(env.MAX_THINKING_TOKENS, "1234", "well-formed non-forbidden route env passes through");
  assert.equal(JSON.stringify(env).includes("SMUGGLED_KEY_dead"), false);
});

finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
