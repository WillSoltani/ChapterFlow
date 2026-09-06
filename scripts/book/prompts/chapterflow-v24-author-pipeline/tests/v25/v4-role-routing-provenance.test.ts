/**
 * Wave-0 package `routing-provenance` — per-role route selection and durable
 * routing provenance (register ids R-021, R-204, R-205, R-206, R-207, R-218,
 * R-223, R-227).
 *
 * The gate these cases hold: a task's pipeline ROLE must reach the route
 * builder (so config/model-routing.json's per-role effort tiers are the tiers
 * the CLI is actually invoked with), and every admitted attempt must journal
 * WHICH route/model/effort/role produced it, identically across a resume.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  FileRunStore,
  type RunDefinition,
} from "../../src/run-state/index.js";
import { createClaudeRoute, effortArgs } from "../../src/runtime/claudeRoute.js";
import {
  createDefaultModelRouteSelector,
  createModelRouteSelector,
  createRouteForRoleRoute,
  DEFAULT_MODEL_ROUTING_CONFIG_PATH,
  loadModelRoutingConfig,
  validateModelRoutingConfig,
  type ModelRoutingConfig,
} from "../../src/runtime/codexRoute.js";
import { createExecutionPolicy } from "../../src/runtime/executionPolicy.js";
import type { ExecutionPolicy } from "../../src/runtime/executionPolicyTypes.js";
import { createModelGateway } from "../../src/runtime/modelGateway.js";
import type { ModelTask } from "../../src/runtime/modelRequest.js";
import type { ProcessResult, ProcessSpec, ProcessSupervisor } from "../../src/runtime/processTypes.js";
import { finishV25Tests, requiredTest, type TestRoots } from "./harness.js";

const SRC_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "src");

function definition(bookId: string, runId: string, limit = 6): RunDefinition {
  return {
    schemaVersion: "1",
    bookId,
    runId,
    commandId: "model-command",
    sourceGitSha: "c".repeat(40),
    requiredStages: ["model"],
    requiredInventory: [],
    attemptLimits: { run: limit, byStage: { model: limit } },
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

function attemptDirectory(roots: TestRoots, name: string): string {
  const path = join(roots.workspacesRoot, name);
  mkdirSync(path, { recursive: true });
  return path;
}

function policy(roots: TestRoots): ExecutionPolicy {
  return createExecutionPolicy({
    pipelineRoot: roots.tempRoot,
    attemptRoot: roots.workspacesRoot,
    baseEnvironment: { PATH: "/synthetic/bin", HOME: roots.homeRoot },
  });
}

class RecordingSupervisor implements ProcessSupervisor {
  readonly specs: ProcessSpec[] = [];
  async run(spec: ProcessSpec): Promise<ProcessResult> {
    this.specs.push(spec);
    return {
      outcome: "EXITED",
      exitCode: 0,
      stdout: new TextEncoder().encode("{\"accepted\":true}"),
      stderr: new Uint8Array(),
      stdoutTruncated: false,
      stderrTruncated: false,
    };
  }
}

function task(run: RunDefinition, attemptId: string, workDir: string, role?: string): ModelTask {
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
      inputs: [{ name: "source", mediaType: "text/plain", bytes: new TextEncoder().encode("payload") }],
    },
    signal: new AbortController().signal,
    ...(role === undefined ? {} : { role: role as ModelTask["role"] }),
  };
}

function clock(): () => string {
  let tick = 0;
  return () => new Date(Date.UTC(2026, 0, 1, 0, 0, 1, tick++ * 10)).toISOString();
}

function journalPath(roots: TestRoots, run: RunDefinition): string {
  return join(roots.stateRoot, "books", run.bookId, "runs", run.runId, "attempts.jsonl");
}

function finishDetails(roots: TestRoots, run: RunDefinition): Map<string, string> {
  const details = new Map<string, string>();
  for (const line of readFileSync(journalPath(roots, run), "utf8").split("\n")) {
    if (line.trim().length === 0) continue;
    const event = JSON.parse(line) as { type: string; attemptId: string; detail?: string };
    if (event.type === "ATTEMPT_FINISHED") details.set(event.attemptId, event.detail ?? "");
  }
  return details;
}

function flagValue(args: readonly string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
}

// ── R-021/R-223: the role reaches the route builder ────────────────────────

requiredTest("a review-seat task builds at effort xhigh and a research task at medium, from the shipped config", async ({ roots }) => {
  const run = definition("role-effort-book", "role-effort-run");
  const store = new FileRunStore(roots.stateRoot);
  const created = await store.createRun(run);
  assert.equal(created.ok, true);
  const supervisor = new RecordingSupervisor();
  const gateway = createModelGateway({
    runStore: store,
    processSupervisor: supervisor,
    executionPolicy: policy(roots),
    routeSelector: createDefaultModelRouteSelector(),
    now: clock(),
  });

  const reviewResult = await gateway.execute(task(run, "attempt-review", attemptDirectory(roots, "review"), "review"));
  const researchResult = await gateway.execute(task(run, "attempt-research", attemptDirectory(roots, "research"), "research"));
  assert.equal(reviewResult.outcome, "SUCCEEDED", JSON.stringify(reviewResult.error ?? {}));
  assert.equal(researchResult.outcome, "SUCCEEDED", JSON.stringify(researchResult.error ?? {}));

  assert.equal(supervisor.specs.length, 2);
  assert.equal(flagValue(supervisor.specs[0]!.args, "--effort"), "xhigh", "review seat must build at its configured tier");
  assert.equal(flagValue(supervisor.specs[1]!.args, "--effort"), "medium", "research must build at its configured tier");
});

requiredTest("a task with no role still builds at the config defaultRoute tier", async ({ roots }) => {
  const run = definition("role-default-book", "role-default-run");
  const store = new FileRunStore(roots.stateRoot);
  assert.equal((await store.createRun(run)).ok, true);
  const supervisor = new RecordingSupervisor();
  const gateway = createModelGateway({
    runStore: store,
    processSupervisor: supervisor,
    executionPolicy: policy(roots),
    routeSelector: createDefaultModelRouteSelector(),
    now: clock(),
  });
  const result = await gateway.execute(task(run, "attempt-default", attemptDirectory(roots, "default")));
  assert.equal(result.outcome, "SUCCEEDED", JSON.stringify(result.error ?? {}));
  assert.equal(flagValue(supervisor.specs[0]!.args, "--effort"), loadModelRoutingConfig().defaultRoute.effort);
});

requiredTest("an unrecognised task role fails closed and starts no process", async ({ roots }) => {
  const run = definition("role-typo-book", "role-typo-run");
  const store = new FileRunStore(roots.stateRoot);
  assert.equal((await store.createRun(run)).ok, true);
  const supervisor = new RecordingSupervisor();
  const gateway = createModelGateway({
    runStore: store,
    processSupervisor: supervisor,
    executionPolicy: policy(roots),
    routeSelector: createDefaultModelRouteSelector(),
    now: clock(),
  });
  const result = await gateway.execute(task(run, "attempt-typo", attemptDirectory(roots, "typo"), "reviewer"));
  assert.equal(result.outcome, "FAILED");
  assert.equal(result.error?.code, "MODEL_TASK_INVALID");
  assert.equal(supervisor.specs.length, 0);
});

// ── R-223: the snapshot whitelist cannot silently drop a ModelTask field ───

requiredTest("snapshotTask's field whitelist covers every field ModelTask declares", () => {
  const requestSource = readFileSync(join(SRC_DIR, "runtime", "modelRequest.ts"), "utf8");
  const interfaceBody = /export interface ModelTask \{([\s\S]*?)\n\}/.exec(requestSource);
  assert.ok(interfaceBody, "ModelTask interface must be readable from modelRequest.ts");
  const declared = [...interfaceBody[1]!.matchAll(/^\s*readonly ([A-Za-z0-9_]+)\??:/gm)].map((m) => m[1]!);
  assert.ok(declared.length >= 9, `expected ModelTask fields, found ${declared.length}`);

  const gatewaySource = readFileSync(join(SRC_DIR, "runtime", "modelGateway.ts"), "utf8");
  const shallow = /const shallow: ModelTask = \{([\s\S]*?)\n {4}\};/.exec(gatewaySource);
  assert.ok(shallow, "snapshotTask must build its shallow ModelTask from a readable literal");
  for (const field of declared) {
    assert.match(shallow[1]!, new RegExp(`\\b${field}:`), `snapshotTask drops ModelTask.${field}`);
  }
});

// ── R-207: durable routing provenance, stable across a resume ──────────────

requiredTest("every finished attempt journals route, model, effort, role and the routing-config digest", async ({ roots }) => {
  const run = definition("provenance-book", "provenance-run");
  const store = new FileRunStore(roots.stateRoot);
  assert.equal((await store.createRun(run)).ok, true);
  const gateway = createModelGateway({
    runStore: store,
    processSupervisor: new RecordingSupervisor(),
    executionPolicy: policy(roots),
    routeSelector: createDefaultModelRouteSelector(),
    now: clock(),
  });
  assert.equal((await gateway.execute(task(run, "attempt-qc", attemptDirectory(roots, "qc"), "qc"))).outcome, "SUCCEEDED");

  const digest = createHash("sha256").update(readFileSync(DEFAULT_MODEL_ROUTING_CONFIG_PATH)).digest("hex").slice(0, 12);
  const detail = finishDetails(roots, run).get("attempt-qc") ?? "";
  assert.match(detail, /gateway=SUCCEEDED/);
  assert.match(detail, /;route=claude-subscription-v1;/);
  assert.match(detail, /;model=claude-sonnet-5;/);
  assert.match(detail, /;effort=xhigh;/);
  assert.match(detail, /;role=qc;/);
  assert.match(detail, new RegExp(`;routing=${digest}(;|$)`));
});

requiredTest("a resumed run replays the same routing provenance for the same role", async ({ roots }) => {
  const run = definition("resume-book", "resume-run");
  const first = new FileRunStore(roots.stateRoot);
  assert.equal((await first.createRun(run)).ok, true);
  const gatewayA = createModelGateway({
    runStore: first,
    processSupervisor: new RecordingSupervisor(),
    executionPolicy: policy(roots),
    routeSelector: createDefaultModelRouteSelector(),
    now: clock(),
  });
  assert.equal((await gatewayA.execute(task(run, "attempt-a", attemptDirectory(roots, "a"), "review"))).outcome, "SUCCEEDED");

  // Resume: a brand-new store, selector and gateway over the SAME durable run.
  const resumed = new FileRunStore(roots.stateRoot);
  const supervisorB = new RecordingSupervisor();
  const gatewayB = createModelGateway({
    runStore: resumed,
    processSupervisor: supervisorB,
    executionPolicy: policy(roots),
    routeSelector: createDefaultModelRouteSelector(),
    now: clock(),
  });
  assert.equal((await gatewayB.execute(task(run, "attempt-b", attemptDirectory(roots, "b"), "review"))).outcome, "SUCCEEDED");

  const details = finishDetails(roots, run);
  const provenance = (detail: string): string => detail.slice(detail.indexOf(";route="));
  assert.equal(provenance(details.get("attempt-b") ?? ""), provenance(details.get("attempt-a") ?? ""));
  assert.equal(flagValue(supervisorB.specs[0]!.args, "--effort"), "xhigh");

  const snapshot = await resumed.readRun(run.bookId, run.runId, "2026-01-01T01:00:00.000Z");
  assert.equal(snapshot.ok, true);
  assert.equal(snapshot.ok && snapshot.value.attempts.length, 2);
});

// ── R-206 / R-227: one effort-tier source of truth, fail-closed ────────────

requiredTest("createClaudeRoute rejects an unrecognised effort tier at construction", () => {
  assert.throws(() => createClaudeRoute("claude-sonnet-5", "bogus-effort"), /CLAUDE_ROUTE_EFFORT_INVALID/);
  // The argv-side normalizer stays a defensive no-op: it can no longer be
  // reached with an unknown tier, and it still never emits an invalid flag.
  assert.deepEqual(effortArgs("bogus-effort"), ["--effort", "high"]);
  // Re-anchored (2026-09-06): the route now also emits --restricted after the
  // effort pair, so the pin reads the flag/value pair by NAME instead of by a
  // tail offset that any later argv addition would silently shift.
  const maxArgs = createClaudeRoute("claude-sonnet-5", "max").build({
    id: "read",
    workDirPolicy: "PIPELINE_ROOT",
    mode: "READ_ONLY",
    outputSchemaId: "json.object.v1",
    timeoutMs: 1,
    terminateGraceMs: 1,
    maxStdoutBytes: 1,
    maxStderrBytes: 1,
  }).args;
  const effortIndex = maxArgs.indexOf("--effort");
  assert.notEqual(effortIndex, -1);
  assert.deepEqual(maxArgs.slice(effortIndex, effortIndex + 2), ["--effort", "max"]);
  assert.equal(maxArgs.includes("--restricted"), true);
});

requiredTest("the routing config can express every tier the claude route accepts, and nothing else", () => {
  const base = (effort: string): unknown => ({ defaultRoute: { route: "claude-cli", model: "claude-sonnet-5", effort } });
  for (const effort of ["low", "medium", "high", "xhigh", "max"]) {
    assert.equal(validateModelRoutingConfig(base(effort)).ok, true, `${effort} must validate`);
  }
  for (const effort of ["ultra", "HIGH", ""]) {
    assert.equal(validateModelRoutingConfig(base(effort)).ok, false, `${effort} must not validate`);
  }
});

// ── R-218: unknown role keys in the config are a validation error ──────────

requiredTest("an unknown role key in model-routing.json is rejected, not silently ignored", () => {
  const roleRoute = { route: "claude-cli", model: "claude-sonnet-5", effort: "high" };
  const typo = validateModelRoutingConfig({
    defaultRoute: roleRoute,
    roles: { review: roleRoute, reviw: roleRoute },
  });
  assert.equal(typo.ok, false);
  assert.equal(typo.ok === false && typo.errors.some((error) => error.path === "/roles/reviw"), true, JSON.stringify(typo));

  const known = validateModelRoutingConfig({
    defaultRoute: roleRoute,
    roles: { research: roleRoute, author: roleRoute, repair: roleRoute, review: roleRoute, qc: roleRoute },
  });
  assert.equal(known.ok, true);
});

requiredTest("the shipped model-routing schema pins the same role keys and effort tiers as the validator", () => {
  const schema = JSON.parse(readFileSync(resolve(dirname(DEFAULT_MODEL_ROUTING_CONFIG_PATH), "model-routing.schema.json"), "utf8")) as {
    definitions: { roleRoute: { properties: { effort: { enum: string[] } } } };
    properties: { roles: { propertyNames?: { enum: string[] } } };
  };
  assert.deepEqual(schema.definitions.roleRoute.properties.effort.enum, ["low", "medium", "high", "xhigh", "max"]);
  assert.deepEqual(schema.properties.roles.propertyNames?.enum, ["research", "author", "repair", "review", "qc"]);
});

// ── R-204 / R-205: no dead role channels left behind ───────────────────────

requiredTest("ExecutionProfile no longer declares the role field its own validator rejects", () => {
  const source = readFileSync(join(SRC_DIR, "runtime", "executionPolicyTypes.ts"), "utf8");
  const body = /export interface ExecutionProfile \{([\s\S]*?)\n\}/.exec(source);
  assert.ok(body, "ExecutionProfile interface must be readable");
  assert.equal(/\brole\??:/.test(body[1]!), false, "role must not be a second, validator-rejected threading channel");
});

requiredTest("createRouteForRoleRoute takes no discarded role parameter", () => {
  assert.equal(createRouteForRoleRoute.length, 1);
});

// ── the selector itself ────────────────────────────────────────────────────

requiredTest("createModelRouteSelector reports the resolved role route it built each route from", () => {
  const config: ModelRoutingConfig = {
    defaultRoute: { route: "claude-cli", model: "claude-sonnet-5", effort: "high" },
    roles: { review: { route: "claude-cli", model: "claude-sonnet-5", effort: "xhigh" } },
  };
  const selector = createModelRouteSelector(config, "abcdef012345");
  const review = selector.select("review");
  assert.equal(review.roleRoute?.effort, "xhigh");
  assert.equal(review.role, "review");
  assert.equal(review.configDigest, "abcdef012345");
  assert.equal(selector.select(undefined).roleRoute?.effort, "high");
  assert.equal(selector.select(undefined).role, undefined);
});

finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
