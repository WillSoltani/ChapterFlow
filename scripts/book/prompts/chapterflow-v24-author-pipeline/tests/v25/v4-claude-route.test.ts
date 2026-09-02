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
import { createModelTaskRunner, runJsonModelTask } from "../../src/app/modelTaskRunner.js";
import { isTransientReaderModelResult } from "../../src/review/laneOrchestrator.js";
import { isUnretryableProviderMessage } from "../../src/runtime/modelErrors.js";
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
    // the effort is NOT smuggled through the env channel (the route DOES supply
    // env now — the output-token ceiling — but never its effort tier)
    const routeEnv = createClaudeRoute("claude-sonnet-5", effort).env?.(READ_ONLY_PROFILE) ?? {};
    for (const value of Object.values(routeEnv)) {
      assert.notEqual(value, effort, "effort must ride argv, never env");
    }
    assert.equal("CLAUDE_EFFORT" in routeEnv || "EFFORT" in routeEnv, false);
  }
  assert.deepEqual(effortArgs("xhigh"), ["--effort", "xhigh"]);
});

requiredTest("claude route env raises the output-token ceiling to the model maximum", () => {
  // Live evidence (Franklin canary): ch01 learning-pack at Sonnet@high generated
  // ~21 minutes then died `response exceeded the 32000 output token maximum`
  // (is_error=true, exit 1) on two of three attempts, while the third produced a
  // complete pack — the CLI's default cap sat astride the workload's natural
  // variance, and extended-thinking spend counts against it. The route supplies
  // the ceiling through the gateway's guarded env channel so ambient shell
  // exports can never change model behavior.
  const routeEnv = createClaudeRoute("claude-sonnet-5", "high").env?.(READ_ONLY_PROFILE);
  assert.ok(routeEnv, "the route must supply env");
  assert.equal(routeEnv!.CLAUDE_CODE_MAX_OUTPUT_TOKENS, "64000");
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
  constructor(private readonly stdout: Uint8Array, private readonly exitCode = 0) {}
  async run(spec: ProcessSpec): Promise<ProcessResult> {
    this.specs.push(spec);
    return {
      outcome: "EXITED",
      exitCode: this.exitCode,
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

requiredTest("is_error envelope classifies as MODEL_PROCESS_FAILED with the API message, never OUTPUT_INVALID (Task 11x)", async ({ roots }) => {
  const run = definition("claude-book", "claude-classify-run");
  const store = new FileRunStore(roots.stateRoot);
  await expectRun(store, run);
  const errorEnvelope = JSON.stringify({
    type: "result", subtype: "success", is_error: true, api_error_status: 400,
    result: "API Error: 400 Output blocked by content filtering policy",
  });
  const supervisor = new CapturingSupervisor(new TextEncoder().encode(errorEnvelope));
  const gateway = createModelGateway({
    runStore: store,
    processSupervisor: supervisor,
    executionPolicy: policy(roots),
    route: createClaudeRoute("claude-sonnet-5", "high"),
    now: clock(),
    modelCliPreflight: async () => {},
  });
  const result = await gateway.execute(task(run, "attempt-classify", attemptDirectory(roots, "attempt-classify")));
  assert.equal(result.outcome, "FAILED");
  assert.equal(result.error?.code, "MODEL_PROCESS_FAILED");
  assert.match(result.error?.message ?? "", /content filtering policy/);
  assert.match(result.error?.message ?? "", /api_error_status=400/);
});

requiredTest("R-001: a NON-ZERO exit still preserves the provider envelope message so quota classification can read it", async ({ roots }) => {
  const run = definition("claude-book", "claude-nonzero-exit-run");
  const store = new FileRunStore(roots.stateRoot);
  await expectRun(store, run);
  // Live evidence, 2026-08-28: the claude CLI printed this envelope on stdout AND
  // exited 1. Before R-001 the gateway took the non-zero-exit branch, which threw
  // the envelope away and reported "bounded model process did not succeed", so
  // every downstream isUnretryableProviderMessage() check saw nothing to match.
  const quotaEnvelope = JSON.stringify({
    type: "result",
    is_error: true,
    api_error_status: 429,
    result: "You've hit your weekly limit \u00b7 resets Sep 1 at 8pm (America/Halifax)",
  });
  const supervisor = new CapturingSupervisor(new TextEncoder().encode(quotaEnvelope), 1);
  const gateway = createModelGateway({
    runStore: store,
    processSupervisor: supervisor,
    executionPolicy: policy(roots),
    route: createClaudeRoute("claude-sonnet-5", "high"),
    now: clock(),
    modelCliPreflight: async () => {},
  });
  const result = await gateway.execute(task(run, "attempt-nonzero", attemptDirectory(roots, "attempt-nonzero")));
  assert.equal(result.outcome, "FAILED");
  assert.equal(result.error?.code, "MODEL_PROCESS_FAILED");
  const message = result.error?.message ?? "";
  assert.match(message, /weekly limit/);
  assert.match(message, /resets Sep 1 at 8pm/);
  assert.match(message, /api_error_status=429/);
  // the whole point: the preserved text is what the retry lanes classify on
  assert.equal(isUnretryableProviderMessage(message), true);

  // Reader lane (src/review/laneOrchestrator.ts): decides on the ModelResult
  // directly — a quota block must not be seen as a transient, 21-seat-retryable
  // failure. Before R-001 this returned true.
  assert.equal(isTransientReaderModelResult(result), false);

  // Research lanes (researcher-chapter.ts / researcher-bibliography.ts): decide on
  // the message runJsonModelTask THROWS. Run the real runner over the real gateway
  // so the wiring, not a hand-built string, is what is asserted.
  const researchTask = task(run, "attempt-nonzero-research", attemptDirectory(roots, "attempt-nonzero-research"));
  const thrown = await runJsonModelTask(
    {
      runner: createModelTaskRunner(gateway),
      context: researchTask,
      profileId: "attempt-read-json-v1",
    },
    "researcher-chapter",
    "system",
    "user",
  ).then(() => null, (error: unknown) => error as Error);
  assert.ok(thrown instanceof Error);
  assert.match(thrown.message, /^MODEL_TASK_FAILED:MODEL_PROCESS_FAILED:/);
  assert.equal(isUnretryableProviderMessage(thrown.message), true);
});

finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
