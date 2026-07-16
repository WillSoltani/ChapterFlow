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
  CANDIDATE_MODELS,
  NORMAL_PROFILE,
  NORMAL_PROFILE_MODEL,
  PROVISIONAL_PENDING_WP705,
  ROLLBACK_ORDER,
  ROUTE_POLICY_VERSION,
  RoutePreflightError,
  buildRouteResult,
  classifyProviderOutcome,
  normalRouteMatrix,
  profileMatrix,
  resolveRoute,
  routeDriftFingerprint,
  SAFEGUARD_MARKERS,
} from "../src/orchestrator/modelPolicy.js";
import { AGENT_ROLES } from "../src/contracts/executionProfile.js";
import { validateRouteResult } from "../src/contracts/routeContracts.js";
import { spawnCodexAgent, type CodexRunnerArgs } from "../src/orchestrator/codexAgent.js";

test("the NORMAL profile is provisional-56 and every role resolves to the 5.6 default (no gpt-5.5 reachable)", () => {
  assert.equal(NORMAL_PROFILE, "provisional-56", "a WP-705-selected winner requires the authorized path — never an edit here");
  // directive-1: GPT-5.5 removed as writer/reviewer/repair/fallback/baseline.
  assert.equal(BASELINE_MODEL, "gpt-5.6-sol", "provisional default is gpt-5.6-sol (D-9(b), ledger L-14)");
  assert.ok(BASELINE_MODEL.startsWith("gpt-5.6"), "the normal profile is 5.6-only");
  assert.notEqual(BASELINE_MODEL, "gpt-5.5", "gpt-5.5 is void per directive-1");
  const matrix = normalRouteMatrix();
  assert.equal(matrix.length, AGENT_ROLES.length, "every role has a route");
  for (const row of matrix) {
    assert.equal(row.model, BASELINE_MODEL, `${row.role} must route to the 5.6 default`);
    assert.ok(!row.model.startsWith("gpt-5.5"), `${row.role}: NO normal-profile route may return gpt-5.5`);
  }
});

test("resolveRoute author-writer returns gpt-5.6 @ xhigh at the normal-profile tier", () => {
  const r = resolveRoute({ role: "author-writer" });
  assert.ok(r.model.startsWith("gpt-5.6"), "author writer routes to a 5.6 model");
  assert.equal(r.model, "gpt-5.6-sol");
  assert.equal(r.effort, "xhigh", "author-first-write keeps the xhigh effort shape");
  assert.equal(r.tier, "normal-profile", "an unpinned author call rides the normal matrix, not a call-explicit pin");
  assert.equal(r.taskClass, "author-first-write");
  assert.equal(r.profileName, "provisional-56");
});

test("ROUTE_POLICY_VERSION is bumped for the 5.6 cutover (stales prior qualification loudly)", () => {
  assert.equal(ROUTE_POLICY_VERSION, "route-policy-v2.0", "WP-302 bumped v1.0 → v2.0");
  assert.notEqual(ROUTE_POLICY_VERSION, "route-policy-v1.0", "prior route qualification evidence must stale");
});

// The exact NORMAL matrix pinned with teeth: model AND effort per role. The
// class→effort SHAPE is preserved from the retired baseline-55 matrix; only the
// MODEL changed (5.5 → provisional 5.6). A silent lane/model change fails here.
test("the NORMAL matrix pins model+effort exactly (effort shape preserved; model = 5.6 default)", () => {
  const matrix = Object.fromEntries(normalRouteMatrix().map((r) => [r.role, { model: r.model, effort: r.effort }]));
  const m = BASELINE_MODEL; // gpt-5.6-sol
  assert.deepEqual(matrix, {
    "research": { model: m, effort: "high" },
    "source-repair": { model: m, effort: "high" },
    "source-verify": { model: m, effort: "high" },
    "source-compiler": { model: m, effort: "high" },
    "compiler-polish": { model: m, effort: "medium" },       // role override (routine-repair cell is xhigh)
    "autopilot-repair": { model: m, effort: "high" },        // role override
    "autopilot-scout": { model: m, effort: "medium" },
    "qc-reviewer": { model: m, effort: "high" },
    "author-writer": { model: m, effort: "xhigh" },
    "author-repair": { model: m, effort: "xhigh" },
    "chapter-reviewer": { model: m, effort: "high" },
    "book-acceptance-reader": { model: m, effort: "high" },
    "author-evidence": { model: m, effort: "low" },
    "shipped-control": { model: m, effort: "high" },
    "eval-reader": { model: m, effort: "high" },
    "eval-book": { model: m, effort: "high" },
    "bakeoff-candidate": { model: m, effort: "medium" },
    "bakeoff-judge": { model: m, effort: "high" },
    "bakeoff-aux": { model: m, effort: "medium" },
    "cli-adhoc": { model: m, effort: "high" },               // role override (scout cell is medium)
  });
});

test("5.6 candidate profiles exist as data but are inert (never the normal route; terra/luna unasserted pending WP-502)", () => {
  // The normal profile is NOT a candidate.
  assert.equal(NORMAL_PROFILE, "provisional-56");
  assert.notEqual(profileMatrix(NORMAL_PROFILE), "call-explicit", "the normal profile MUST have a concrete matrix so unpinned calls don't throw");
  // SOL candidate matrices are concrete DATA (confirmed capability) — the bakeoff's starting spec.
  const solHigh = profileMatrix("sol-high-candidate");
  const solXhigh = profileMatrix("sol-xhigh-candidate");
  assert.notEqual(solHigh, "call-explicit");
  assert.notEqual(solXhigh, "call-explicit");
  if (solHigh !== "call-explicit") assert.deepEqual(solHigh["author-first-write"], { model: "gpt-5.6-sol", effort: "high" });
  if (solXhigh !== "call-explicit") assert.deepEqual(solXhigh["author-first-write"], { model: "gpt-5.6-sol", effort: "xhigh" });
  // terra/luna capability is UNCONFIRMED — no asserted matrix before WP-502 (red-team gate).
  assert.equal(profileMatrix("terra-candidate"), "call-explicit", "terra must not be an asserted matrix cell before WP-502");
  assert.equal(profileMatrix("luna-candidate"), "call-explicit", "luna must not be an asserted matrix cell before WP-502");
  // The candidate family set names the three (directive-2); terra/luna are gated.
  assert.deepEqual([...CANDIDATE_MODELS], [
    { family: "gpt-5.6-sol", capability: "confirmed" },
    { family: "gpt-5.6-terra", capability: "unconfirmed-pending-WP-502" },
    { family: "gpt-5.6-luna", capability: "unconfirmed-pending-WP-502" },
  ]);
});

test("the provisional default carries the WP-705 marker, and no rollback path returns gpt-5.5", () => {
  // Load-bearing PROVISIONAL flag: must remain until a WP-705 decision file replaces the constant.
  assert.equal(PROVISIONAL_PENDING_WP705, "PROVISIONAL_PENDING_WP-705");
  assert.equal(NORMAL_PROFILE_MODEL.status, PROVISIONAL_PENDING_WP705, "the normal-profile model is flagged provisional pending WP-705");
  assert.equal(NORMAL_PROFILE_MODEL.model, "gpt-5.6-sol");
  // ROLLBACK_ORDER carries NO gpt-5.5 profile (the retired baseline-55 is gone).
  assert.ok(!ROLLBACK_ORDER.includes("baseline-55" as never), "no gpt-5.5 baseline in rollback (directive-1)");
  assert.ok(ROLLBACK_ORDER.includes(NORMAL_PROFILE), "the provisional normal profile is the emergency floor");
  for (const name of ROLLBACK_ORDER) {
    const mtx = profileMatrix(name);
    if (mtx !== "call-explicit") {
      for (const cell of Object.values(mtx)) assert.ok(!cell.model.startsWith("gpt-5.5"), `${name} must not route to gpt-5.5`);
    }
  }
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
  // base.model is now the 5.6 default; use a DIFFERENT candidate model so the change actually differs.
  for (const change of [{ model: "gpt-5.6-terra" }, { effort: "xhigh" }, { cliVersion: "codex-cli 0.145.0" }, { executionProfileHash: "p2" }, { routePolicyVersion: "route-policy-v3.0" }] as const) {
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
  assert.equal(rr.profileName, "provisional-56");
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
    "src/providers/openai-api.ts",       // pricing table keyed by model id (data, not a route)
    // IMP-20 §16 migration/bakeoff DATA — the frozen candidate/judge identities
    // UNDER comparison (not a production route). recoveryExperiment names the
    // fixed recovery candidate-profile set; layerNRetrospective names the
    // HISTORICAL Layer-N v2 judge families of a preserved run (a literal record
    // that must never silently re-point if BASELINE_MODEL later changes).
    "src/bakeoff/migration/recoveryExperiment.ts",
    "src/bakeoff/migration/layerNRetrospective.ts",
    // P3 readiness instrument: the IMP-24G §5.6 owner-frozen candidate order —
    // a literal record of the profiles under comparison (data, not a route)
    // that must never silently re-point if BASELINE_MODEL later changes.
    "src/bakeoff/migration/pilotRoleReadinessInstrument.ts",
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
