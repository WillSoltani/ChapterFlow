/**
 * WP-502 — 5.6 capability-probe protocol (model-free).
 *
 * Every test here is deliberately model-free: the live `codex exec` path is
 * exercised ONLY through an injected runner (a test double), never a real spawn.
 * Two of the doubles THROW if invoked, proving the dry default path issues zero
 * model calls; the others count invocations, proving the ≤3-calls/model budget
 * and the no-retry-on-refusal invariant.
 */

import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { test } from "./harness.js";
import {
  MODEL_CAPABILITY_CHECKS,
  MODEL_CAPABILITY_LIVE_CALL_BUDGET,
  validateModelCapabilityCheckResult,
  validateModelCapabilityProbeReport,
  validateUnsupportedModelConfig,
  unsupportedModelConfigFromCheck,
  type ModelCapabilityCheckResultV1,
  type ModelCapabilityProbeReportV1,
} from "../src/contracts/modelCapabilityProbe.js";
import {
  LiveCallBudget,
  ModelCapabilityProbeError,
  probeAuthRoute,
  probeExistence,
  runModelCapabilityProbe,
  type ModelCapabilityLedgerEntry,
  type ModelCapabilityProbeSpawn,
} from "../src/exec/modelCapabilityProbe.js";
import type { CodexAgentResult, SpawnCodexAgentOptions } from "../src/orchestrator/codexAgent.js";

const MODEL = "gpt-5.6-sol";

function freshDir(label: string): string {
  return mkdtempSync(join(tmpdir(), `cap-probe-test-${label}-`));
}

function writeModelsCache(dir: string, models: unknown[]): string {
  const path = join(dir, "models_cache.json");
  writeFileSync(path, JSON.stringify({ fetched_at: new Date().toISOString(), models }, null, 2));
  return path;
}

function writeAuth(dir: string, contents: unknown): string {
  const path = join(dir, "auth.json");
  writeFileSync(path, typeof contents === "string" ? contents : JSON.stringify(contents));
  return path;
}

function chatgptAuth(dir: string): string {
  return writeAuth(dir, { auth_mode: "chatgpt", OPENAI_API_KEY: null, tokens: { id_token: "fixture" } });
}

function solModelsCache(dir: string): string {
  return writeModelsCache(dir, [
    { slug: MODEL, visibility: "list", supported_reasoning_levels: [{ effort: "high" }, { effort: "xhigh" }] },
  ]);
}

/** A spawn double that FAILS the test the instant it is invoked — proves the dry
 *  path never reaches a model call. */
const throwingSpawn: ModelCapabilityProbeSpawn = () => {
  throw new Error("MODEL CALL LEAK: the probe invoked the spawn runner when it must not have");
};

function okResult(opts: SpawnCodexAgentOptions): CodexAgentResult {
  return {
    ok: true,
    exitCode: 0,
    finalMessage: opts.outputSchemaPath ? '{"ok":true}' : "OK",
    stdout: "",
    stderr: "",
    durationMs: 7,
    sessionId: opts.sessionId,
    finalMessageSource: "output-file",
    outcome: "content_completed",
  };
}

// ── (1) contract validator: accepts well-formed, rejects each malformed field ─

test("WP-502 contract: validator accepts a well-formed check result and rejects each malformed field", () => {
  const good: ModelCapabilityCheckResultV1 = {
    schema: "model-capability-check-result-v1",
    model: MODEL,
    effort: "high",
    check: "existence",
    status: "SUPPORTED",
    reason: "exact model and effort advertised by the local cache",
  };
  assert.deepEqual(validateModelCapabilityCheckResult(good), []);

  const bad = (patch: Record<string, unknown>): string[] =>
    validateModelCapabilityCheckResult({ ...good, ...patch });
  assert.ok(bad({ schema: "wrong" }).length > 0, "wrong schema rejected");
  assert.ok(bad({ model: "" }).length > 0, "empty model rejected");
  assert.ok(bad({ effort: "max" }).length > 0, "API-only effort 'max' rejected (repo-local union)");
  assert.ok(bad({ effort: "sky-high" }).length > 0, "unknown effort rejected");
  assert.ok(bad({ check: "network" }).length > 0, "unknown check rejected");
  assert.ok(bad({ status: "MAYBE" }).length > 0, "unknown status rejected");
  assert.ok(bad({ reason: "" }).length > 0, "empty reason rejected");
  assert.ok(validateModelCapabilityCheckResult({ ...good, extra: 1 }).length > 0, "unknown key rejected");
  assert.ok(validateModelCapabilityCheckResult(null).length > 0, "non-object rejected");
  assert.ok(validateModelCapabilityCheckResult({ ...good, reason: undefined }).length > 0, "missing field rejected");
});

test("WP-502 contract: UNSUPPORTED_MODEL_CONFIG validator accepts well-formed and rejects malformed", () => {
  const good = {
    schema: "unsupported-model-config-v1" as const,
    model: MODEL,
    effort: "high" as const,
    failingCheck: "existence" as const,
    reason: "exact model slug is absent from the local Codex cache",
  };
  assert.deepEqual(validateUnsupportedModelConfig(good), []);
  assert.ok(validateUnsupportedModelConfig({ ...good, schema: "x" }).length > 0);
  assert.ok(validateUnsupportedModelConfig({ ...good, failingCheck: "nope" }).length > 0);
  assert.ok(validateUnsupportedModelConfig({ ...good, effort: "max" }).length > 0);
  assert.ok(validateUnsupportedModelConfig({ ...good, model: "" }).length > 0);
});

test("WP-502 contract: aggregate report validator enforces 4 ordered checks + config-iff-UNSUPPORTED", () => {
  const mk = (check: string, status: string): ModelCapabilityCheckResultV1 => ({
    schema: "model-capability-check-result-v1",
    model: MODEL, effort: "high",
    check: check as ModelCapabilityCheckResultV1["check"],
    status: status as ModelCapabilityCheckResultV1["status"],
    reason: `${check}: ${status}`,
  });
  const report: ModelCapabilityProbeReportV1 = {
    schema: "model-capability-probe-report-v1",
    model: MODEL, effort: "high", executeLive: false,
    verifiedAt: new Date().toISOString(),
    checks: [mk("existence", "SUPPORTED"), mk("auth-route", "SUPPORTED"), mk("output-schema", "NOT_TESTED"), mk("effort-flag", "NOT_TESTED")],
    liveCallsMade: 0,
    liveCallBudget: MODEL_CAPABILITY_LIVE_CALL_BUDGET,
    overall: "NOT_FULLY_TESTED",
    unsupportedConfig: null,
  };
  assert.deepEqual(validateModelCapabilityProbeReport(report), []);

  // out of order
  assert.ok(validateModelCapabilityProbeReport({
    ...report,
    checks: [mk("auth-route", "SUPPORTED"), mk("existence", "SUPPORTED"), mk("output-schema", "NOT_TESTED"), mk("effort-flag", "NOT_TESTED")],
  }).length > 0, "out-of-order checks rejected");

  // wrong length
  assert.ok(validateModelCapabilityProbeReport({ ...report, checks: report.checks.slice(0, 3) }).length > 0, "missing a check rejected");

  // UNSUPPORTED overall MUST carry a config
  assert.ok(validateModelCapabilityProbeReport({ ...report, overall: "UNSUPPORTED", unsupportedConfig: null }).length > 0, "UNSUPPORTED without config rejected");

  // a config present on a non-UNSUPPORTED overall
  assert.ok(validateModelCapabilityProbeReport({
    ...report,
    unsupportedConfig: { schema: "unsupported-model-config-v1", model: MODEL, effort: "high", failingCheck: "existence", reason: "x" },
  }).length > 0, "config present on non-UNSUPPORTED rejected");

  // wrong budget
  assert.ok(validateModelCapabilityProbeReport({ ...report, liveCallBudget: 9 }).length > 0, "wrong budget rejected");

  assert.throws(() => unsupportedModelConfigFromCheck(mk("existence", "SUPPORTED")), /cannot build/, "config only from an UNSUPPORTED check");
});

// ── (2) existence: local cache only, no network guess ────────────────────────

test("WP-502 existence: SUPPORTED when present, UNSUPPORTED when absent / effort-unadvertised / cache-missing", () => {
  const dir = freshDir("existence");
  try {
    const cachePath = solModelsCache(dir);
    const verifiedAt = new Date().toISOString();

    const present = probeExistence({ model: MODEL, effort: "high", modelsCachePath: cachePath, verifiedAt });
    assert.equal(present.status, "SUPPORTED", present.reason);
    assert.equal(present.check, "existence");

    const absent = probeExistence({ model: "gpt-5.6-terra", effort: "high", modelsCachePath: cachePath, verifiedAt });
    assert.equal(absent.status, "UNSUPPORTED");
    assert.match(absent.reason, /absent from the local Codex cache/);

    const badEffort = probeExistence({ model: MODEL, effort: "minimal", modelsCachePath: cachePath, verifiedAt });
    assert.equal(badEffort.status, "UNSUPPORTED");
    assert.match(badEffort.reason, /reasoning effort "minimal" is not advertised/);

    const missing = probeExistence({ model: MODEL, effort: "high", modelsCachePath: join(dir, "nope.json"), verifiedAt });
    assert.equal(missing.status, "UNSUPPORTED");
    assert.match(missing.reason, /models_cache\.json is absent/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── (3) auth-route: fail-closed on non-chatgpt auth material ──────────────────

test("WP-502 auth-route: SUPPORTED on chatgpt OAuth, UNSUPPORTED (fail-closed) on metered/absent auth", () => {
  const dir = freshDir("auth");
  try {
    const ok = probeAuthRoute({ model: MODEL, effort: "high", authJsonPath: chatgptAuth(dir) });
    assert.equal(ok.status, "SUPPORTED", ok.reason);

    const apikeyDir = freshDir("auth-apikey");
    const apikey = probeAuthRoute({ model: MODEL, effort: "high", authJsonPath: writeAuth(apikeyDir, { auth_mode: "apikey", OPENAI_API_KEY: "sk-fixture" }) });
    assert.equal(apikey.status, "UNSUPPORTED");
    assert.match(apikey.reason, /auth route is not usable/);
    rmSync(apikeyDir, { recursive: true, force: true });

    const besideDir = freshDir("auth-beside");
    const beside = probeAuthRoute({ model: MODEL, effort: "high", authJsonPath: writeAuth(besideDir, { auth_mode: "chatgpt", OPENAI_API_KEY: "sk-fixture", tokens: { id_token: "x" } }) });
    assert.equal(beside.status, "UNSUPPORTED", "a usable key beside chatgpt mode fails closed");
    rmSync(besideDir, { recursive: true, force: true });

    const absent = probeAuthRoute({ model: MODEL, effort: "high", authJsonPath: join(dir, "nope.json") });
    assert.equal(absent.status, "UNSUPPORTED");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── (4) verb WITHOUT --execute-live makes ZERO model calls ───────────────────

test("WP-502 dry path: executeLive=false makes zero model calls and reports NOT_TESTED for both live checks", async () => {
  const dir = freshDir("dry");
  try {
    const report = await runModelCapabilityProbe(
      { model: MODEL, effort: "high", executeLive: false, modelsCachePath: solModelsCache(dir), authJsonPath: chatgptAuth(dir) },
      { spawn: throwingSpawn }, // throws if the dry path ever reaches a model call
    );
    assert.deepEqual(validateModelCapabilityProbeReport(report), [], "dry report is well-formed");
    assert.equal(report.liveCallsMade, 0);
    assert.equal(report.overall, "NOT_FULLY_TESTED");
    assert.equal(report.unsupportedConfig, null);
    const byCheck = Object.fromEntries(report.checks.map((c) => [c.check, c.status]));
    assert.equal(byCheck["existence"], "SUPPORTED");
    assert.equal(byCheck["auth-route"], "SUPPORTED");
    assert.equal(byCheck["output-schema"], "NOT_TESTED");
    assert.equal(byCheck["effort-flag"], "NOT_TESTED");
    assert.deepEqual(report.checks.map((c) => c.check), [...MODEL_CAPABILITY_CHECKS]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("WP-502 dry path: a missing model fails closed at existence with UNSUPPORTED_MODEL_CONFIG and zero calls", async () => {
  const dir = freshDir("dry-missing");
  try {
    const report = await runModelCapabilityProbe(
      { model: "gpt-5.6-terra", effort: "high", executeLive: false, modelsCachePath: solModelsCache(dir), authJsonPath: chatgptAuth(dir) },
      { spawn: throwingSpawn },
    );
    assert.equal(report.overall, "UNSUPPORTED");
    assert.ok(report.unsupportedConfig, "UNSUPPORTED_MODEL_CONFIG present for WP-504");
    assert.equal(report.unsupportedConfig!.failingCheck, "existence");
    assert.deepEqual(validateUnsupportedModelConfig(report.unsupportedConfig), []);
    // fail-closed stop: later checks are NOT_TESTED, never silently passed
    const byCheck = Object.fromEntries(report.checks.map((c) => [c.check, c.status]));
    assert.equal(byCheck["auth-route"], "NOT_TESTED");
    assert.equal(byCheck["output-schema"], "NOT_TESTED");
    assert.equal(byCheck["effort-flag"], "NOT_TESTED");
    assert.equal(report.liveCallsMade, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── (5) call-budget guard: live path caps at 3 calls/model ───────────────────

test("WP-502 budget guard: LiveCallBudget spends up to the cap then fails closed", () => {
  const budget = new LiveCallBudget();
  assert.equal(budget.cap, MODEL_CAPABILITY_LIVE_CALL_BUDGET);
  for (let i = 0; i < MODEL_CAPABILITY_LIVE_CALL_BUDGET; i++) budget.spend();
  assert.equal(budget.made, MODEL_CAPABILITY_LIVE_CALL_BUDGET);
  assert.equal(budget.remaining, 0);
  assert.throws(() => budget.spend(), (e: unknown) => e instanceof ModelCapabilityProbeError, "a call past the budget fails closed");
});

test("WP-502 live path: happy path uses exactly 2 ledgered calls (well under the 3/model cap) and never retries", async () => {
  const dir = freshDir("live-ok");
  try {
    let calls = 0;
    const ledger: ModelCapabilityLedgerEntry[] = [];
    const countingSpawn: ModelCapabilityProbeSpawn = async (opts) => { calls++; return okResult(opts); };
    const report = await runModelCapabilityProbe(
      { model: MODEL, effort: "high", executeLive: true, modelsCachePath: solModelsCache(dir), authJsonPath: chatgptAuth(dir), env: {} },
      { spawn: countingSpawn, ledger: (e) => ledger.push(e), workspaceBaseDir: dir },
    );
    assert.equal(calls, 2, "output-schema + effort-flag = exactly two live calls");
    assert.ok(calls <= MODEL_CAPABILITY_LIVE_CALL_BUDGET, "never exceeds the 3/model budget");
    assert.equal(report.liveCallsMade, 2);
    assert.equal(report.overall, "SUPPORTED");
    assert.equal(report.unsupportedConfig, null);
    assert.equal(ledger.length, 2, "every live call is ledgered");
    assert.deepEqual(ledger.map((e) => e.stage).sort(), ["capability-probe:effort-flag", "capability-probe:output-schema"]);
    assert.ok(ledger.every((e) => e.family === "codex-exec" && e.outcome === "content_completed"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("WP-502 live path: a refusal on the first live check fails closed with NO retry and no second call", async () => {
  const dir = freshDir("live-refuse");
  try {
    let calls = 0;
    const refusingSpawn: ModelCapabilityProbeSpawn = async (opts) => {
      calls++;
      return { ok: false, exitCode: 1, finalMessage: "", stdout: "", stderr: "refused", durationMs: 3, sessionId: opts.sessionId, finalMessageSource: "stdout-fallback", outcome: "provider_safeguard_or_refusal" };
    };
    const report = await runModelCapabilityProbe(
      { model: MODEL, effort: "high", executeLive: true, modelsCachePath: solModelsCache(dir), authJsonPath: chatgptAuth(dir), env: {} },
      { spawn: refusingSpawn, workspaceBaseDir: dir },
    );
    assert.equal(calls, 1, "refusal is not retried and the second live check is NOT attempted (fail-closed stop)");
    assert.equal(report.liveCallsMade, 1);
    assert.equal(report.overall, "UNSUPPORTED");
    assert.equal(report.unsupportedConfig!.failingCheck, "output-schema");
    const byCheck = Object.fromEntries(report.checks.map((c) => [c.check, c.status]));
    assert.equal(byCheck["output-schema"], "UNSUPPORTED");
    assert.equal(byCheck["effort-flag"], "NOT_TESTED");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("WP-502 live path: a forbidden provider env key refuses the live probe before any call", async () => {
  const dir = freshDir("live-forbidden");
  try {
    await assert.rejects(
      () => runModelCapabilityProbe(
        { model: MODEL, effort: "high", executeLive: true, modelsCachePath: solModelsCache(dir), authJsonPath: chatgptAuth(dir), env: { OPENAI_API_KEY: "sk-should-never-run" } },
        { spawn: throwingSpawn, workspaceBaseDir: dir },
      ),
      (e: unknown) => e instanceof ModelCapabilityProbeError && /prohibited provider key/.test((e as Error).message),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("WP-502: an API-only 'max' effort is rejected as a usage error (repo-local EffortLevelV1 union)", async () => {
  const dir = freshDir("effort-max");
  try {
    await assert.rejects(
      () => runModelCapabilityProbe(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { model: MODEL, effort: "max" as any, executeLive: false, modelsCachePath: solModelsCache(dir), authJsonPath: chatgptAuth(dir) },
        { spawn: throwingSpawn },
      ),
      (e: unknown) => e instanceof ModelCapabilityProbeError && /no API-only "max"/.test((e as Error).message),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
