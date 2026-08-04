/**
 * IMP-02: centralized model/effort routing — normal-profile matrix pins,
 * precedence, fail-closed validation, disjoint provider outcomes, drift
 * fingerprints, and the per-spawn RouteResultV1 sidecar. (F-002/F-003;
 * frozen `route-result` v1 contract.)
 */

import assert from "node:assert/strict";
import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { test } from "./harness.js";
import { PIPELINE_DIR, TMP_DIR } from "./helpers.js";
import {
  BASELINE_MODEL,
  NORMAL_PROFILE,
  ROUTE_POLICY_VERSION,
  RoutePreflightError,
  buildRouteResult,
  classifyProviderOutcome,
  normalRouteMatrix,
  resolveRoute,
  routeDriftFingerprint,
  SAFEGUARD_MARKERS,
} from "../src/orchestrator/modelPolicy.js";
import { AGENT_ROLES } from "../src/contracts/executionProfile.js";
import { validateRouteResult } from "../src/contracts/routeContracts.js";
import { spawnCodexAgent, type CodexRunnerArgs } from "../src/orchestrator/codexAgent.js";

test("the NORMAL profile is baseline-55 and every role resolves to the qualified baseline model", () => {
  assert.equal(NORMAL_PROFILE, "baseline-55", "activation is IMP-13's package — never an edit here");
  const matrix = normalRouteMatrix();
  assert.equal(matrix.length, AGENT_ROLES.length, "every role has a route");
  for (const row of matrix) assert.equal(row.model, BASELINE_MODEL, `${row.role} must route to the baseline`);
});

test("the baseline matrix encodes TODAY's efforts exactly (incl. the three role-level overrides)", () => {
  const efforts = Object.fromEntries(normalRouteMatrix().map((r) => [r.role, r.effort]));
  assert.deepEqual(efforts, {
    "research": "high",
    "source-repair": "high",
    "source-verify": "high",
    "source-compiler": "high",
    "compiler-polish": "medium",       // role override (routine-repair cell is xhigh)
    "autopilot-repair": "high",        // role override
    "autopilot-scout": "medium",
    "qc-reviewer": "high",
    "author-writer": "xhigh",
    "author-repair": "xhigh",
    "chapter-reviewer": "high",
    "book-acceptance-reader": "high",
    "author-evidence": "low",
    "shipped-control": "high",
    "eval-reader": "high",
    "eval-book": "high",
    "bakeoff-candidate": "medium",
    "bakeoff-judge": "high",
    "bakeoff-aux": "medium",
    "cli-adhoc": "high",               // role override (scout cell is medium)
  });
});

test("precedence: call-site explicit values win and are recorded at their tier; partial explicitness falls per-field", () => {
  const full = resolveRoute({ role: "chapter-reviewer", requestedModel: "gpt-5.6-terra", requestedEffort: "xhigh" });
  assert.deepEqual([full.model, full.effort, full.tier], ["gpt-5.6-terra", "xhigh", "call-explicit"]);
  const partial = resolveRoute({ role: "chapter-reviewer", requestedEffort: "low" });
  assert.deepEqual([partial.model, partial.effort, partial.tier], [BASELINE_MODEL, "low", "call-explicit"]);
  const none = resolveRoute({ role: "chapter-reviewer" });
  assert.deepEqual([none.model, none.effort, none.tier], [BASELINE_MODEL, "high", "normal-profile"]);
});

test("fail-closed: invalid model ids and efforts (including API-only 'max') are preflight rejections", () => {
  assert.throws(() => resolveRoute({ role: "research", requestedModel: "not a model!!" }), RoutePreflightError);
  assert.throws(() => resolveRoute({ role: "research", requestedEffort: "max" }), (e: Error) => e instanceof RoutePreflightError && /max/.test(e.message));
  assert.throws(() => resolveRoute({ role: "research", requestedEffort: "ultra" }), RoutePreflightError);
});

test("provider outcomes are disjoint: timeout / infra / rate / clean; safeguard markers ship EMPTY (calibration-pending)", () => {
  assert.equal(classifyProviderOutcome({ completed: false, errorMessage: "codex exec timed out after 1800000ms" }), "timeout");
  assert.equal(classifyProviderOutcome({ completed: false, errorMessage: "spawn ENOENT" }), "infrastructure_failure");
  assert.equal(classifyProviderOutcome({ completed: true, exitCode: 1, stderr: "rate limit exceeded (429)" }), "provider_rate_or_capacity");
  assert.equal(classifyProviderOutcome({ completed: true, exitCode: 1, stderr: "some internal error" }), "infrastructure_failure");
  assert.equal(classifyProviderOutcome({ completed: true, exitCode: 0, finalMessage: "done" }), "content_completed");
  // Deliberate: no guessy refusal matcher — an empty marker list can never
  // misclassify a content failure as a safeguard (or vice versa). IMP-11/13
  // calibrate from observed events.
  assert.deepEqual([...SAFEGUARD_MARKERS], []);
});

test("drift fingerprint: stable for identical inputs; any field change re-fingerprints", () => {
  const base = { model: BASELINE_MODEL, effort: "high", taskClass: "chapter-direct-read" as const, routePolicyVersion: ROUTE_POLICY_VERSION, executionProfileHash: "p1", cliVersion: "codex-cli 0.144.1" };
  const fp = routeDriftFingerprint(base);
  assert.equal(routeDriftFingerprint({ ...base }), fp, "deterministic");
  for (const change of [{ model: "gpt-5.6-sol" }, { effort: "xhigh" }, { cliVersion: "codex-cli 0.145.0" }, { executionProfileHash: "p2" }, { routePolicyVersion: "route-policy-v1.1" }] as const) {
    assert.notEqual(routeDriftFingerprint({ ...base, ...change }), fp, `${Object.keys(change)[0]} change must re-fingerprint`);
  }
});

test("buildRouteResult emits a schema-valid frozen RouteResultV1", () => {
  const resolved = resolveRoute({ role: "author-writer" });
  const rr = buildRouteResult({ role: "author-writer", resolved, executionProfileHash: "h".repeat(64), cliVersion: "codex-cli 0.144.1", outcome: "content_completed" });
  assert.deepEqual(validateRouteResult(rr), []);
  assert.equal(rr.taskClass, "author-first-write");
  assert.equal(rr.requestedModel, BASELINE_MODEL);
});

// §16 route-invariant telemetry (owner directive 2026-07-11): every sidecar
// records the execution route. With the envelope's subscription-auth proof the
// route is the ChatGPT-subscription codex exec path; without it (injected test
// doubles) the sidecar says so honestly. Both stamp apiKeyPresent=false and
// apiFallbackAllowed=false — the values a metered or fallback route would need
// are unrepresentable, and the validator enforces the pairing.
test("buildRouteResult stamps the subscription-route telemetry from the auth proof", () => {
  const resolved = resolveRoute({ role: "bakeoff-judge" });
  const base = { role: "bakeoff-judge" as const, resolved, executionProfileHash: "h".repeat(64), cliVersion: "codex-cli 0.144.1", outcome: "content_completed" as const };

  const live = buildRouteResult({ ...base, authProof: { authMode: "chatgpt", apiKeyPresent: false, source: "auth.json" } });
  assert.deepEqual(validateRouteResult(live), []);
  assert.equal(live.executionRoute, "codex_exec_chatgpt_subscription");
  assert.equal(live.authMode, "chatgpt");
  assert.equal(live.apiKeyPresent, false);
  assert.equal(live.apiFallbackAllowed, false);

  const doubled = buildRouteResult(base);
  assert.deepEqual(validateRouteResult(doubled), []);
  assert.equal(doubled.executionRoute, "injected_test_runner");
  assert.equal(doubled.authMode, "test");

  assert.ok(
    validateRouteResult({ ...live, apiKeyPresent: true }).some((p) => p.includes("apiKeyPresent")),
    "a sidecar claiming a present API key is schema-invalid",
  );
  assert.ok(
    validateRouteResult({ ...live, authMode: "test" }).some((p) => p.includes("authMode")),
    "the subscription route requires chatgpt auth mode",
  );
});

// ── spawn integration: the .route.json sidecar rides every manifested spawn ──

let seq = 0;
function sinkDir(): string {
  const d = join(TMP_DIR, `model-policy-${process.pid}-${seq++}`);
  mkdirSync(d, { recursive: true });
  return d;
}

test("spawn writes a route sidecar with content_completed and the resolved route", async () => {
  const sink = sinkDir();
  await spawnCodexAgent({
    task: "T", sessionId: "route-ok", cwd: PIPELINE_DIR, sandbox: "read-only",
    role: "chapter-reviewer",
    runner: async () => ({ stdout: "done", stderr: "", code: 0 }),
    manifestSink: sink, execBaseDir: sinkDir(),
  });
  const routeFile = readdirSync(sink).find((f) => f.endsWith(".route.json"));
  assert.ok(routeFile, "route sidecar written");
  const rr = JSON.parse(readFileSync(join(sink, routeFile!), "utf8"));
  assert.deepEqual(validateRouteResult(rr), []);
  assert.equal(rr.outcome, "content_completed");
  assert.equal(rr.requestedModel, BASELINE_MODEL);
  assert.equal(rr.requestedEffort, "high");
  assert.equal(rr.profileName, "baseline-55");
});

test("a timed-out spawn still writes its route sidecar (outcome=timeout) and rethrows", async () => {
  const sink = sinkDir();
  await assert.rejects(
    spawnCodexAgent({
      task: "T", sessionId: "route-timeout", cwd: PIPELINE_DIR, sandbox: "workspace-write",
      role: "author-writer",
      runner: async (_a: CodexRunnerArgs) => { throw new Error("codex exec timed out after 5ms"); },
      manifestSink: sink, execBaseDir: sinkDir(),
    }),
    /timed out/,
  );
  const routeFile = readdirSync(sink).find((f) => f.endsWith(".route.json"));
  assert.ok(routeFile, "sidecar exists even for a timeout");
  const rr = JSON.parse(readFileSync(join(sink, routeFile!), "utf8"));
  assert.equal(rr.outcome, "timeout");
  assert.equal(rr.taskClass, "author-first-write");
});

test("an invalid explicit effort fails the spawn preflight BEFORE any process (policy_preflight_failure)", async () => {
  await assert.rejects(
    spawnCodexAgent({
      task: "T", sessionId: "route-bad-effort", cwd: PIPELINE_DIR, sandbox: "read-only",
      role: "chapter-reviewer",
      reasoningEffort: "max" as never,
      runner: async () => { throw new Error("runner must never be reached"); },
      manifestSink: sinkDir(), execBaseDir: sinkDir(),
    }),
    (e: Error) => e instanceof RoutePreflightError,
  );
});

test("static scan: no production source hardcodes the baseline model outside the policy (pricing table excepted)", () => {
  const allow = new Set([
    "src/orchestrator/modelPolicy.ts",   // the owner
    "src/runtime/codexRoute.ts",         // sole V4 process-route owner
    "src/providers/openai-api.ts",       // pricing table keyed by model id (data, not a route)
    // IMP-20 §16 migration/bakeoff DATA — the frozen candidate/judge identities
    // UNDER comparison (not a production route). recoveryExperiment names the
    // fixed recovery candidate-profile set; layerNRetrospective names the
    // HISTORICAL Layer-N v2 judge families of a preserved run (a literal record
    // that must never silently re-point if BASELINE_MODEL later changes).
    "src/bakeoff/migration/recoveryExperiment.ts",
    "src/bakeoff/migration/layerNRetrospective.ts",
  ]);
  const offenders: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(join(PIPELINE_DIR, dir), { withFileTypes: true })) {
      const rel = join(dir, entry.name);
      if (entry.isDirectory()) walk(rel);
      else if (entry.name.endsWith(".ts") && !allow.has(rel) && /"gpt-5\.5"/.test(readFileSync(join(PIPELINE_DIR, rel), "utf8"))) {
        offenders.push(rel);
      }
    }
  };
  walk("src");
  assert.deepEqual(offenders, [], `baseline-model literals outside the policy:\n${offenders.join("\n")}`);
});
