/**
 * WP-304 — provider-router envelope parity (close the stack-A gap).
 *
 * The legacy provider router (`router.ts` → `claudeClient.ts`) is the residual
 * non-hermetic model transport. These tests pin the parity brought to it:
 *   1. model+effort resolves through `modelPolicy.resolveRoute` (default + call-
 *      explicit override), NEVER through the ambient `CHAPTERFLOW_*_MODEL` env;
 *   2. the env-model surface is INERT (tamper-proof, both pure and end-to-end);
 *   3. a `ProviderRouteResultV1` provenance record is written per call;
 *   4. the anthropic-cli transport pins the model with an explicit `--model`, so
 *      ambient user config cannot silently change it.
 *
 * Everything runs model-free: the pure resolution/provenance functions are called
 * directly, and the one end-to-end path spawns a FAKE `claude` node script (a
 * module-level fixture, never a live model/CLI verb — L-22 compliant).
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { test } from "./harness.js";
import { PIPELINE_DIR, TMP_DIR } from "./helpers.js";
import { BASELINE_MODEL } from "../src/orchestrator/modelPolicy.js";
import { type CallOptions, defaultModelForProvider } from "../src/providers/types.js";
import { resolveRouterRoute } from "../src/providers/router.js";
import {
  PROVIDER_TIER_ROLE,
  buildProviderRouteResult,
  modelFamilyOf,
  persistProviderRouteResult,
  providerModelFamily,
  providerServesModel,
} from "../src/providers/routerRoute.js";

const CLAUDE_WRITER_DEFAULT = "claude-opus-4-7"; // types.ts DEFAULT_MODELS["anthropic-cli"].writer

function base(over: Partial<CallOptions> = {}): CallOptions {
  return { tier: "writer", system: "s", user: "u", maxTokens: 8, timeoutMs: 1000, ...over };
}

function tmpDir(label: string): string {
  const d = resolve(TMP_DIR, "provider-router-envelope", `${label}-${process.pid}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(d, { recursive: true });
  return d;
}

// ── 1. policy resolution: default (family match) ─────────────────────────────

test("resolveRouterRoute (default, provider serves the policy family) dispatches the policy model", () => {
  // openai-api serves the gpt family, so the codex-family policy model dispatches.
  const d = resolveRouterRoute(base({ tier: "critic" }), "openai-api");
  assert.equal(d.role, "qc-reviewer", "critic tier maps to the qc-reviewer role");
  assert.equal(d.resolved.taskClass, "chapter-direct-read");
  assert.equal(d.resolved.model, BASELINE_MODEL, "the policy resolved the normal-profile model");
  assert.equal(d.resolved.tier, "normal-profile", "an unpinned call rides the matrix, not a call-explicit pin");
  assert.equal(d.effectiveModel, BASELINE_MODEL, "dispatched model = policy model (family matches)");
  assert.equal(d.modelSource, "policy");
});

// ── 2. policy resolution: default (family MISMATCH → provider default) ────────

test("resolveRouterRoute (default, provider family MISMATCH) records policy but dispatches the provider default", () => {
  // anthropic-cli serves claude, not the codex-family policy model → provider default.
  const d = resolveRouterRoute(base({ tier: "writer" }), "anthropic-cli");
  assert.equal(d.role, "cli-adhoc", "writer tier maps to the neutral cli-adhoc role, NOT author-writer");
  assert.equal(d.resolved.model, BASELINE_MODEL, "the policy decision is still recorded (governance)");
  assert.equal(d.effectiveModel, CLAUDE_WRITER_DEFAULT, "dispatched model falls to the claude-family provider default");
  assert.equal(d.modelSource, "provider-default");
  assert.notEqual(d.effectiveModel, d.resolved.model, "family mismatch is explicit, never a silent codex-on-claude dispatch");
});

// ── 3. call-explicit override wins and is recorded as such ───────────────────

test("resolveRouterRoute (call-explicit model) dispatches the pin verbatim and records call-explicit", () => {
  const d = resolveRouterRoute(base({ tier: "writer", model: "claude-opus-4-7" }), "anthropic-cli");
  assert.equal(d.effectiveModel, "claude-opus-4-7");
  assert.equal(d.modelSource, "call-explicit");
  assert.equal(d.resolved.tier, "call-explicit", "the policy records the pin at the call-explicit tier");
  assert.equal(d.resolved.model, "claude-opus-4-7");
});

test("resolveRouterRoute honors an explicit opts.role over the tier default", () => {
  const d = resolveRouterRoute(base({ tier: "critic", role: "research" }), "anthropic-cli");
  assert.equal(d.role, "research");
  assert.equal(d.resolved.taskClass, "research-synthesis");
});

// ── 4. env-tamper inertness (pure) ───────────────────────────────────────────

test("CHAPTERFLOW_*_MODEL env is INERT: neither the router nor provider defaults read it", () => {
  const snapshot = {
    CHAPTERFLOW_WRITER_MODEL: process.env.CHAPTERFLOW_WRITER_MODEL,
    CHAPTERFLOW_CRITIC_MODEL: process.env.CHAPTERFLOW_CRITIC_MODEL,
    CHAPTERFLOW_CLAUDE_WRITER: process.env.CHAPTERFLOW_CLAUDE_WRITER,
    CHAPTERFLOW_OPENAI_CRITIC: process.env.CHAPTERFLOW_OPENAI_CRITIC,
  };
  try {
    process.env.CHAPTERFLOW_WRITER_MODEL = "tampered-writer-model";
    process.env.CHAPTERFLOW_CRITIC_MODEL = "tampered-critic-model";
    process.env.CHAPTERFLOW_CLAUDE_WRITER = "tampered-claude-writer";
    process.env.CHAPTERFLOW_OPENAI_CRITIC = "tampered-openai-critic";

    // Router resolution ignores every env override.
    const cli = resolveRouterRoute(base({ tier: "writer" }), "anthropic-cli");
    assert.equal(cli.effectiveModel, CLAUDE_WRITER_DEFAULT);
    assert.notEqual(cli.effectiveModel, "tampered-writer-model");
    assert.notEqual(cli.effectiveModel, "tampered-claude-writer");

    const oai = resolveRouterRoute(base({ tier: "critic" }), "openai-api");
    assert.equal(oai.effectiveModel, BASELINE_MODEL);
    assert.notEqual(oai.effectiveModel, "tampered-critic-model");

    // Provider default table ignores the per-provider env too.
    assert.equal(defaultModelForProvider("anthropic-cli", "writer"), CLAUDE_WRITER_DEFAULT);
    assert.equal(defaultModelForProvider("openai-api", "critic"), "gpt-4o-mini");
  } finally {
    for (const [k, v] of Object.entries(snapshot)) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
  }
});

// ── model-family predicates ──────────────────────────────────────────────────

test("model-family predicates: codex policy model is openai-family; claude ids are claude-family", () => {
  assert.equal(modelFamilyOf(BASELINE_MODEL), "openai", "gpt-5.6-sol is the openai/gpt family");
  assert.equal(modelFamilyOf("claude-opus-4-7"), "claude");
  assert.equal(modelFamilyOf("something-weird"), "other");
  assert.equal(providerModelFamily("openai-api"), "openai");
  assert.equal(providerModelFamily("anthropic-cli"), "claude");
  assert.equal(providerModelFamily("anthropic-api"), "claude");
  assert.equal(providerServesModel("openai-api", BASELINE_MODEL), true);
  assert.equal(providerServesModel("anthropic-cli", BASELINE_MODEL), false);
  assert.equal(providerServesModel("anthropic-api", "claude-opus-4-7"), true);
  // The tier→role map never claims the author-first ship-path roles.
  assert.deepEqual(PROVIDER_TIER_ROLE, { writer: "cli-adhoc", researcher: "research", critic: "qc-reviewer" });
  for (const role of Object.values(PROVIDER_TIER_ROLE)) {
    assert.ok(role !== "author-writer" && role !== "author-repair", "the router never claims the author ship-path roles");
  }
});

// ── 5. provenance record shape + drift fingerprint ───────────────────────────

test("buildProviderRouteResult carries the policy decision, the effective transport, and a drift fingerprint", () => {
  const d = resolveRouterRoute(base({ tier: "writer" }), "anthropic-cli");
  const rec = buildProviderRouteResult({
    tier: "writer", role: d.role, resolved: d.resolved, modelSource: d.modelSource,
    effectiveProvider: "anthropic-cli", effectiveModel: d.effectiveModel, outcome: "content_completed", apiKeyPresent: false,
  });
  assert.equal(rec.schema, "provider-route-result-v1");
  assert.equal(rec.role, "cli-adhoc");
  assert.equal(rec.policyModel, BASELINE_MODEL, "the governance decision is preserved in the record");
  assert.equal(rec.effectiveModel, CLAUDE_WRITER_DEFAULT, "the effective transport model is recorded honestly");
  assert.equal(rec.modelSource, "provider-default");
  assert.equal(rec.effectiveProvider, "anthropic-cli");
  assert.equal(rec.executionRoute, "provider_router:anthropic-cli");
  assert.equal(rec.outcome, "content_completed");
  assert.equal(typeof rec.driftFingerprint, "string");
  assert.ok(rec.driftFingerprint.length >= 32);

  // The fingerprint keys on the EFFECTIVE model: a different transport model
  // re-fingerprints; an identical record is stable.
  const same = buildProviderRouteResult({
    tier: "writer", role: d.role, resolved: d.resolved, modelSource: d.modelSource,
    effectiveProvider: "anthropic-cli", effectiveModel: d.effectiveModel, outcome: "content_completed", apiKeyPresent: false,
  });
  assert.equal(same.driftFingerprint, rec.driftFingerprint, "identical inputs → stable fingerprint");
  const different = buildProviderRouteResult({
    tier: "writer", role: d.role, resolved: d.resolved, modelSource: d.modelSource,
    effectiveProvider: "anthropic-cli", effectiveModel: "claude-sonnet-4-6", outcome: "content_completed", apiKeyPresent: false,
  });
  assert.notEqual(different.driftFingerprint, rec.driftFingerprint, "a different effective model re-fingerprints");
});

// ── 6. provenance persisted per call ─────────────────────────────────────────

test("persistProviderRouteResult writes a round-trippable sidecar and never collides", () => {
  const dir = tmpDir("persist");
  const d = resolveRouterRoute(base({ tier: "researcher" }), "openai-api");
  const rec = buildProviderRouteResult({
    tier: "researcher", role: d.role, resolved: d.resolved, modelSource: d.modelSource,
    effectiveProvider: "openai-api", effectiveModel: d.effectiveModel, outcome: "content_completed", apiKeyPresent: true,
    telemetry: { stage: "researcher-chapter", runId: "run-1", bookId: "zz-book", chapterId: "zz-book-ch01" },
  });
  const p1 = persistProviderRouteResult(rec, dir);
  const p2 = persistProviderRouteResult(rec, dir);
  assert.ok(p1 && p2 && p1 !== p2, "two writes land in distinct files (seq/pid keyed)");
  const files = readdirSync(dir).filter((f) => f.endsWith(".provider-route.json"));
  assert.equal(files.length, 2);
  const roundTrip = JSON.parse(readFileSync(p1!, "utf8"));
  assert.equal(roundTrip.role, "research");
  assert.equal(roundTrip.effectiveModel, BASELINE_MODEL);
  assert.equal(roundTrip.telemetry.stage, "researcher-chapter");
});

// ── 7. end-to-end (fake-claude fixture): provenance per call, env inertness,
//       and the explicit --model pin all hold on the real callModel path ──────

function writeFakeClaude(recordPath: string): string {
  const dir = resolve(TMP_DIR, "provider-router-envelope");
  mkdirSync(dir, { recursive: true });
  const bin = resolve(dir, `fake-claude-${process.pid}.cjs`);
  writeFileSync(
    bin,
    `#!/usr/bin/env node
const fs = require("node:fs");
let stdin = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (d) => { stdin += d; });
process.stdin.on("end", () => {
  fs.writeFileSync(${JSON.stringify(recordPath)}, JSON.stringify({ argv: process.argv.slice(2) }, null, 2));
  process.stdout.write(JSON.stringify({ result: "cli ok", usage: { input_tokens: 3, output_tokens: 4 } }));
});
`,
    "utf8",
  );
  chmodSync(bin, 0o755);
  return bin;
}

test("end-to-end callModel via anthropic-cli: policy-resolved --model is pinned (env inert) and a route sidecar is written", () => {
  const sink = tmpDir("e2e-sink");
  const record = resolve(tmpDir("e2e-rec"), "cli-record.json");
  const fakeClaude = writeFakeClaude(record);
  // Same CJS-interop guard as provider-contract.test.ts: under \`--import tsx -e\`
  // the named exports arrive under \`.default\`.
  const script = `
    const m = await import("./src/providers/router.ts");
    const { callModel } = m.callModel ? m : m.default;
    await callModel({ provider: "anthropic-cli", tier: "writer", system: "s", user: "u", maxTokens: 8, timeoutMs: 4000 });
  `;
  const childEnv: Record<string, string | undefined> = {
    ...process.env,
    CHAPTERFLOW_NO_API_CODEX_QC: undefined,       // anthropic-cli is exempt regardless; keep the guard off
    CHAPTERFLOW_CLAUDE_BIN: fakeClaude,
    CHAPTERFLOW_CLAUDE_SKIP_AUTH_CHECK: "1",
    CHAPTERFLOW_PROVIDER_ROUTE_SINK: sink,
    // Tamper the (now inert) env-model surface: the dispatched model must ignore it.
    CHAPTERFLOW_WRITER_MODEL: "tampered-writer-model",
    CHAPTERFLOW_CLAUDE_WRITER: "tampered-claude-writer",
  };
  for (const [k, v] of Object.entries(childEnv)) if (v === undefined) delete childEnv[k];

  execFileSync(process.execPath, ["--import", "tsx", "-e", script], {
    cwd: PIPELINE_DIR, env: childEnv as NodeJS.ProcessEnv, encoding: "utf8", timeout: 15_000, stdio: ["ignore", "pipe", "pipe"],
  });

  // (a) the CLI received an explicit --model = the policy-resolved provider
  //     default, NOT the tampered env value → env inert + ambient-config-proof.
  assert.ok(existsSync(record), "fake claude recorded its argv");
  const argv: string[] = JSON.parse(readFileSync(record, "utf8")).argv;
  const modelIdx = argv.indexOf("--model");
  assert.ok(modelIdx >= 0, "the CLI call pins --model explicitly");
  assert.equal(argv[modelIdx + 1], CLAUDE_WRITER_DEFAULT, "the pinned model is the policy-resolved provider default");
  assert.notEqual(argv[modelIdx + 1], "tampered-writer-model");
  assert.notEqual(argv[modelIdx + 1], "tampered-claude-writer");

  // (b) a provenance sidecar was written for the call, carrying policy + transport.
  const sidecars = readdirSync(sink).filter((f) => f.endsWith(".provider-route.json"));
  assert.equal(sidecars.length, 1, "exactly one route record per call");
  const rec = JSON.parse(readFileSync(resolve(sink, sidecars[0]), "utf8"));
  assert.equal(rec.schema, "provider-route-result-v1");
  assert.equal(rec.role, "cli-adhoc");
  assert.equal(rec.policyModel, BASELINE_MODEL, "governance decision recorded");
  assert.equal(rec.effectiveModel, CLAUDE_WRITER_DEFAULT, "effective transport recorded");
  assert.equal(rec.modelSource, "provider-default");
  assert.equal(rec.effectiveProvider, "anthropic-cli");
  assert.equal(rec.outcome, "content_completed");
});
