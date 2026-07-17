/**
 * IMP-02: centralized model/effort routing — normal-profile matrix pins,
 * precedence, fail-closed validation, disjoint provider outcomes, drift
 * fingerprints, and the per-spawn RouteResultV1 sidecar. (F-002/F-003;
 * frozen `route-result` v1 contract.)
 */

import assert from "node:assert/strict";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
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
  SUPPORTED_MODEL_IDS,
  UNSUPPORTED_MODEL_CONFIG,
  UnsupportedModelConfigError,
  buildRouteResult,
  classifyProviderOutcome,
  isSupportedModelId,
  normalRouteMatrix,
  preflightOperatorModelSelection,
  profileMatrix,
  resolveModelFallback,
  resolveRoute,
  routeDriftFingerprint,
  unsupportedModelConfig,
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

// ── WP-504: fail-closed fallback/config policy (no 5.5; unsupported → halt) ────
// The pipeline fails closed on an unsupported 5.6 config and NEVER silently
// substitutes a model; an alternate 5.6 candidate is reachable ONLY by explicit
// operator config. All refusals are ONE typed error (a RoutePreflightError
// subclass), raised at route resolution BEFORE any spawn.

function captureError(fn: () => unknown): Error {
  try { fn(); } catch (e) { return e as Error; }
  throw new assert.AssertionError({ message: "expected the call to throw, but it returned" });
}

test("WP-504 taxonomy: the unsupported-config error is ONE hierarchy under RoutePreflightError (not a fork); 'max' effort uses it", () => {
  const maxErr = captureError(() => resolveRoute({ role: "research", requestedEffort: "max" }));
  assert.ok(maxErr instanceof UnsupportedModelConfigError, "the existing 'max' preflight now raises the unified config error");
  assert.ok(maxErr instanceof RoutePreflightError, "…which is STILL a RoutePreflightError (aligned with the prior taxonomy, not a second parallel error)");
  assert.equal((maxErr as UnsupportedModelConfigError).reason, "unsupported-effort");
  assert.equal((maxErr as UnsupportedModelConfigError).code, UNSUPPORTED_MODEL_CONFIG);
  assert.equal((maxErr as UnsupportedModelConfigError).classification, "policy_preflight_failure", "inherits the frozen disjoint provider-outcome classification unchanged");
  assert.match(maxErr.message, /max/);
});

test("WP-504: requireSupportedModel gates the 5.6 candidate set; the default foreign-provider recorder is preserved", () => {
  // opt-in ON: any explicit model outside the 5.6 candidate set fails closed —
  // the retired baseline AND a plausible-but-unqualified 5.6 sibling AND a foreign id.
  for (const bad of ["gpt-5.5", "gpt-5.6-mars", "claude-opus-4-7"]) {
    const e = captureError(() => resolveRoute({ role: "author-writer", requestedModel: bad, requireSupportedModel: true }));
    assert.ok(e instanceof UnsupportedModelConfigError, `${bad} must fail closed under requireSupportedModel`);
    assert.equal((e as UnsupportedModelConfigError).reason, "unsupported-model");
    assert.equal((e as UnsupportedModelConfigError).failingModel, bad, "the halt names the failing model");
    assert.equal((e as UnsupportedModelConfigError).code, UNSUPPORTED_MODEL_CONFIG);
  }
  // opt-in ON: every DECLARED 5.6 candidate passes membership (capability is a later WP-502 gate).
  for (const c of CANDIDATE_MODELS) {
    const r = resolveRoute({ role: "author-writer", requestedModel: c.family, requireSupportedModel: true });
    assert.equal(r.model, c.family);
    assert.ok(isSupportedModelId(r.model));
  }
  // opt-in OFF (default): the legacy multi-provider router records a foreign
  // call-explicit model VERBATIM — membership is NOT enforced on that path.
  const foreign = resolveRoute({ role: "cli-adhoc", requestedModel: "claude-opus-4-7" });
  assert.equal(foreign.model, "claude-opus-4-7");
  assert.equal(foreign.tier, "call-explicit");
  // FORMAT is enforced unconditionally in BOTH modes (a malformed id always halts).
  assert.throws(() => resolveRoute({ role: "cli-adhoc", requestedModel: "not a model!!" }), UnsupportedModelConfigError);
  // SUPPORTED_MODEL_IDS is EXACTLY the candidate families (derived from WP-302/501 data, not a 2nd list).
  assert.deepEqual([...SUPPORTED_MODEL_IDS].sort(), CANDIDATE_MODELS.map((c) => c.family).sort());
});

test("WP-504: preflightOperatorModelSelection validates an operator selection through the ONE validator and echoes it (or fails closed)", () => {
  assert.deepEqual(preflightOperatorModelSelection({ model: "gpt-5.6-terra", effort: "high" }), { model: "gpt-5.6-terra", effort: "high" });
  assert.deepEqual(preflightOperatorModelSelection({}), {}, "no selection is valid — the matrix decides downstream");
  const badModel = captureError(() => preflightOperatorModelSelection({ model: "gpt-5.5" }));
  assert.ok(badModel instanceof UnsupportedModelConfigError && badModel.reason === "unsupported-model");
  const badEffort = captureError(() => preflightOperatorModelSelection({ effort: "max" }));
  assert.ok(badEffort instanceof UnsupportedModelConfigError && (badEffort as UnsupportedModelConfigError).reason === "unsupported-effort");
});

test("WP-504: every entry point raises the IDENTICAL typed error for the same unsupported config (parametrized)", () => {
  const entryPoints: Array<{ name: string; run: (model?: string, effort?: string) => void }> = [
    // resolveRoute at the operator boundary (author route / run-start all funnel here).
    { name: "resolveRoute(requireSupportedModel)", run: (model, effort) => { resolveRoute({ role: "author-writer", requestedModel: model, requestedEffort: effort, requireSupportedModel: true }); } },
    // the CLI --model/--effort handling (WP-601) calls this.
    { name: "preflightOperatorModelSelection", run: (model, effort) => { preflightOperatorModelSelection({ model, effort }); } },
  ];
  for (const ep of entryPoints) {
    const em = captureError(() => ep.run("gpt-5.5", undefined));
    assert.ok(em instanceof UnsupportedModelConfigError, `${ep.name}: unsupported model → unified error`);
    assert.equal((em as UnsupportedModelConfigError).code, UNSUPPORTED_MODEL_CONFIG);
    assert.equal((em as UnsupportedModelConfigError).reason, "unsupported-model");
    assert.equal((em as UnsupportedModelConfigError).failingModel, "gpt-5.5");
    assert.ok(em instanceof RoutePreflightError);

    const ee = captureError(() => ep.run(undefined, "max"));
    assert.ok(ee instanceof UnsupportedModelConfigError, `${ep.name}: 'max' effort → unified error`);
    assert.equal((ee as UnsupportedModelConfigError).reason, "unsupported-effort");
    assert.match(ee.message, /max/);
  }
});

test("WP-504: an unsupported operator model fails closed BEFORE any spawn (0 spawns)", () => {
  const spawns: string[] = [];
  // A stand-in conductor: validate the operator selection, and ONLY on success
  // proceed to the spawn. This is the shape WP-601/602 wire at run start.
  const conduct = (model: string) => {
    const sel = preflightOperatorModelSelection({ model }); // throws on unsupported config
    spawns.push(sel.model!);                                // unreachable unless validation passed
  };
  const e = captureError(() => conduct("gpt-5.5"));
  assert.ok(e instanceof UnsupportedModelConfigError && e.reason === "unsupported-model");
  assert.equal(spawns.length, 0, "no spawn followed the UNSUPPORTED_MODEL_CONFIG halt");
  // a supported candidate clears the gate and would proceed to spawn.
  conduct("gpt-5.6-terra");
  assert.deepEqual(spawns, ["gpt-5.6-terra"]);
});

test("WP-504 fallback: NO explicit alternate → fail-closed halt (the pipeline never silently substitutes a model)", () => {
  const e = captureError(() => resolveModelFallback({ failingModel: "gpt-5.6-sol", failingCheck: "capability probe" }));
  assert.ok(e instanceof UnsupportedModelConfigError);
  assert.ok(e instanceof RoutePreflightError);
  assert.equal((e as UnsupportedModelConfigError).reason, "no-fallback");
  assert.equal((e as UnsupportedModelConfigError).code, UNSUPPORTED_MODEL_CONFIG);
  assert.equal((e as UnsupportedModelConfigError).failingModel, "gpt-5.6-sol", "the halt names the failing model");
  assert.match(e.message, /does not fall back|no explicit alternate/);
});

test("WP-504 fallback: last-qualified-sol is a fail-closed placeholder until WP-705 (file absent AND present both HALT)", () => {
  const absent = captureError(() => resolveModelFallback({ failingModel: "gpt-5.6-sol", failingCheck: "preflight", explicitAlternateProfile: "last-qualified-sol" }));
  assert.ok(absent instanceof UnsupportedModelConfigError);
  assert.equal((absent as UnsupportedModelConfigError).reason, "unqualified-rollback");
  assert.match(absent.message, /no WP-705 qualification file/);
  // Even once a WP-705 decision file appears, this build has no concrete matrix → still HALT.
  const present = captureError(() => resolveModelFallback({ failingModel: "gpt-5.6-sol", failingCheck: "preflight", explicitAlternateProfile: "last-qualified-sol", lastQualifiedSolDecisionFilePresent: true }));
  assert.ok(present instanceof UnsupportedModelConfigError);
  assert.equal((present as UnsupportedModelConfigError).reason, "unqualified-rollback");
  assert.match(present.message, /no last-qualified-sol matrix/);
});

test("WP-504 fallback: an alternate 5.6 candidate is reachable ONLY by explicit config, and never routes to the retired baseline", () => {
  const ok = resolveModelFallback({ failingModel: "gpt-5.6-sol", failingCheck: "capability probe", explicitAlternateProfile: "sol-xhigh-candidate" });
  assert.equal(ok.profileName, "sol-xhigh-candidate");
  assert.ok(ok.models.length > 0);
  for (const m of ok.models) {
    assert.ok(isSupportedModelId(m), `alternate must route only to 5.6 candidates; got ${m}`);
    assert.ok(!m.startsWith("gpt-5.5"), "no rollback path returns the retired baseline");
  }
  // A call-explicit / capability-pending profile carries no routable matrix → HALT (never a silent non-5.6 route).
  const callExplicit = captureError(() => resolveModelFallback({ failingModel: "gpt-5.6-sol", failingCheck: "preflight", explicitAlternateProfile: "terra-candidate" }));
  assert.ok(callExplicit instanceof UnsupportedModelConfigError);
  assert.equal((callExplicit as UnsupportedModelConfigError).reason, "unqualified-rollback");
});

test("WP-504: there is NO cross-model auto-retry loop — resolveModelFallback is a single pure decision, and ROLLBACK_ORDER carries no 5.5", () => {
  // Structural: the fallback resolver never iterates model-after-model and never
  // traverses ROLLBACK_ORDER as a silent fallback ladder.
  const src = readFileSync(join(PIPELINE_DIR, "src/orchestrator/modelPolicy.ts"), "utf8");
  const start = src.indexOf("export function resolveModelFallback");
  const end = src.indexOf("export function preflightOperatorModelSelection");
  assert.ok(start >= 0 && end > start, "located the resolveModelFallback body");
  const body = src.slice(start, end);
  assert.ok(!/\bfor\s*\(|\bwhile\s*\(/.test(body), "resolveModelFallback must contain no for/while retry loop");
  assert.ok(!/ROLLBACK_ORDER/.test(body), "resolveModelFallback must not traverse ROLLBACK_ORDER as a silent fallback ladder");
  // Data check: ROLLBACK_ORDER names no retired-baseline profile.
  assert.ok(!ROLLBACK_ORDER.includes("baseline-55" as never));
});

test("WP-504: the WP-502 capability halt is the SAME typed error (unsupportedModelConfig factory)", () => {
  const e = unsupportedModelConfig({ reason: "capability-absent", failingModel: "gpt-5.6-terra", failingCheck: "codex exec --output-schema / effort capability probe", detail: "probe: --output-schema unsupported" });
  assert.ok(e instanceof UnsupportedModelConfigError);
  assert.ok(e instanceof RoutePreflightError, "the capability halt shares the ONE preflight hierarchy");
  assert.equal(e.code, UNSUPPORTED_MODEL_CONFIG);
  assert.equal(e.reason, "capability-absent");
  assert.equal(e.failingModel, "gpt-5.6-terra");
  assert.equal(e.classification, "policy_preflight_failure");
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

// ── forbidden-model static gate (WP-501, directive-1) ─────────────────────────
// gpt-5.5 is VOID for the target architecture: no writer/reviewer/repair/
// fallback/benchmark/judge/default may reference it. The gate FAILS on ANY
// `gpt-5.5` occurrence (quoted model-id literal OR unquoted prose) in a
// non-allowlisted production `src/**` .ts file — so a file either legitimately
// RECORDS the historical id (allowlisted, all-or-nothing) or contains none.
const FORBIDDEN_MODEL_ID = /gpt-5\.5/;

// The ONLY production-source files permitted to carry the gpt-5.5 token. Every
// entry is a retained DATA record, never a live route (renaming an offending
// file INTO this set cannot launder a real route — each reason is load-bearing):
const FORBIDDEN_MODEL_ALLOWLIST = new Set([
  // (a) historical-evidence instruments — the frozen candidate/judge identities
  //     of preserved migration runs (a literal record that must never silently
  //     re-point if BASELINE_MODEL changes). NOT a production route.
  "src/bakeoff/migration/recoveryExperiment.ts",     // fixed recovery candidate-profile set
  "src/bakeoff/migration/layerNRetrospective.ts",    // HISTORICAL Layer-N v2 judge families (preserved run)
  "src/bakeoff/migration/pilotRoleReadinessInstrument.ts", // IMP-24G §5.6 owner-frozen candidate order
  // (b) pricing data provider — a model-id-keyed price table (data, not a route).
  "src/providers/openai-api.ts",
  // (c) WP-501 Part-3 historical-identity freezes — HISTORICAL_BASELINE_55, the
  //     frozen pre-migration gpt-5.5 baseline the migration bakeoff measured the
  //     SOL candidate against. Decoupled from the live BASELINE_MODEL so the
  //     historical `55` arm can never again re-point when the live baseline flips.
  "src/bakeoff/migration/experimentTypes.ts",              // defines HISTORICAL_BASELINE_55
  "src/orchestrator/forwardLocalActivationMaterializer.ts",   // baseline-55 rollback previousProfile
  "src/orchestrator/forwardLocalActivationMaterializerV2.ts", // baseline-55 rollback previousProfile
]);

function scanForbiddenModelIds(baseDir: string, startSubdir: string, allow: Set<string>): string[] {
  const offenders: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(join(baseDir, dir), { withFileTypes: true })) {
      const rel = join(dir, entry.name);
      if (entry.isDirectory()) walk(rel);
      else if (entry.name.endsWith(".ts") && !allow.has(rel) && FORBIDDEN_MODEL_ID.test(readFileSync(join(baseDir, rel), "utf8"))) {
        offenders.push(rel);
      }
    }
  };
  walk(startSubdir);
  return offenders;
}

test("forbidden-model gate: no production src references gpt-5.5 outside the historical/pricing/freeze allowlist (directive-1)", () => {
  const offenders = scanForbiddenModelIds(PIPELINE_DIR, "src", FORBIDDEN_MODEL_ALLOWLIST);
  assert.deepEqual(offenders, [], `gpt-5.5 in non-allowlisted production source — directive-1 forbids a live 5.5 route/judge/default:\n${offenders.join("\n")}`);
});

test("forbidden-model gate has TEETH: a NEW gpt-5.5 reference in a non-allowlisted file is reported; a 5.6 sibling is not; the allowlist genuinely exempts", () => {
  const base = join(TMP_DIR, `forbidden-model-neg-${process.pid}-${seq++}`);
  mkdirSync(join(base, "src", "nested"), { recursive: true });
  // A planted production-path file reintroducing the void model id (in a TEMP
  // tree — never under the repo's src/, so it neither trips the real gate nor
  // gets committed; this is the standing form of the charter's scratch check).
  writeFileSync(join(base, "src", "nested", "reintroduced.ts"), 'export const WRITER = "gpt-5.5";\n');
  // A clean 5.6 sibling must NOT be flagged (the gate is specific to 5.5).
  writeFileSync(join(base, "src", "nested", "clean.ts"), 'export const WRITER = "gpt-5.6-sol";\n');
  assert.deepEqual(
    scanForbiddenModelIds(base, "src", new Set()),
    ["src/nested/reintroduced.ts"],
    "the gate must flag the new gpt-5.5 reference and ONLY it",
  );
  // Allowlisting the planted file exempts it (all-or-nothing by file).
  assert.deepEqual(scanForbiddenModelIds(base, "src", new Set(["src/nested/reintroduced.ts"])), []);
});
