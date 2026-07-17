/**
 * WP-502 — 5.6 capability-probe protocol (V25 S-Tier §8 Lane 5).
 *
 * A bounded, fail-closed protocol that proves a named 5.6 model is usable BEFORE
 * any book run, making NO live model call on the default (dry) path. Four
 * ordered checks per (model, effort):
 *
 *   (a) existence     — the exact model slug + reasoning effort is advertised by
 *                       the LOCAL Codex `models_cache.json` (filesystem read only;
 *                       zero calls). A model absent from the cache is
 *                       `UNSUPPORTED(existence)`, NEVER a guess.
 *   (b) auth-route     — the isolated CODEX_HOME auth material is
 *                       ChatGPT-subscription OAuth, not a metered API key
 *                       (`assertChatgptSubscriptionAuth`; zero calls).
 *   (c) output-schema  — `codex exec --output-schema` strict-subset acceptance.
 *   (d) effort-flag    — `-c model_reasoning_effort=<effort>` acceptance.
 *
 * (c) and (d) are LIVE-ONLY: they require a real `codex exec` call and are gated
 * behind an explicit `--execute-live` flag, deferred to Phase-6 execution under
 * orchestrator custody. On the default (no `--execute-live`) path they report
 * `NOT_TESTED` — the dry boundary the WP-502 STOP condition mandates. The live
 * path makes AT MOST `MODEL_CAPABILITY_LIVE_CALL_BUDGET` (3) `codex exec` calls
 * per model total, ledgers each via the WP-503 unified ledger, NEVER retries a
 * refusal, and NEVER falls back to another route or model.
 *
 * Fail-closed: the protocol stops at the FIRST `UNSUPPORTED` check (later checks
 * are `NOT_TESTED`), and the aggregate report carries the
 * `UNSUPPORTED_MODEL_CONFIG` result WP-504's run-start halt consumes.
 *
 * REUSES (does not modify): `assertChatgptSubscriptionAuth` +
 * `FORBIDDEN_PROVIDER_ENV` (`executionEnvelope.ts`), the local models-cache
 * discovery shape (`forwardRoleQualificationLive.ts`), the `codex exec` schema
 * call shape (`imp24eSchemaProbe.ts`), and the frozen `EffortLevelV1` union
 * (no API-only `max`).
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

import { sha256Hex } from "../contracts/contractUtil.js";
import type { EffortLevelV1 } from "../contracts/executionProfile.js";
import type { ProviderOutcomeV1 } from "../contracts/routeContracts.js";
import {
  MODEL_CAPABILITY_CHECKS,
  MODEL_CAPABILITY_LIVE_CALL_BUDGET,
  MODEL_CAPABILITY_PROBE_REPORT_SCHEMA,
  MODEL_CAPABILITY_CHECK_RESULT_SCHEMA,
  unsupportedModelConfigFromCheck,
  validateModelCapabilityProbeReport,
  type ModelCapabilityCheckResultV1,
  type ModelCapabilityCheckV1,
  type ModelCapabilityProbeReportV1,
  type ModelCapabilityProbeStatusV1,
} from "../contracts/modelCapabilityProbe.js";
import { assertChatgptSubscriptionAuth, FORBIDDEN_PROVIDER_ENV } from "./executionEnvelope.js";
import { codexTransportSchemaCompatibilityErrors } from "./codexTransportConfig.js";
import type { CodexCliQualificationV1 } from "./cliQualification.js";
import type { CodexAgentResult, SpawnCodexAgentOptions } from "../orchestrator/codexAgent.js";

const EFFORTS: readonly EffortLevelV1[] = ["minimal", "low", "medium", "high", "xhigh"];

/** Fail-closed control error for the probe (usage / budget / policy violations
 *  the CLI surfaces as a non-zero exit). Distinct from a per-check UNSUPPORTED,
 *  which is DATA in the report, not a thrown control failure. */
export class ModelCapabilityProbeError extends Error {
  readonly classification = "capability_probe_control_failure" as const;
  constructor(message: string) {
    super(message);
    this.name = "ModelCapabilityProbeError";
  }
}

/** The minimal strict-subset JSON Schema the output-schema live check binds to
 *  `codex exec --output-schema`. Root object, `additionalProperties:false`,
 *  every property required — the exact strict-subset shape the Codex transport
 *  accepts (validated against `codexTransportSchemaCompatibilityErrors`). */
export function minimalStrictSubsetSchema(): Record<string, unknown> {
  return {
    type: "object",
    additionalProperties: false,
    required: ["ok"],
    properties: { ok: { type: "boolean" } },
  };
}

/** The local Codex model cache shape the zero-call existence check reads. Mirror
 *  of the frozen local-cache discovery type; kept local so the probe imports no
 *  qualification machinery. */
type LocalCodexModelCacheV1 = {
  fetched_at?: string;
  models?: Array<{
    slug?: string;
    visibility?: string;
    supported_reasoning_levels?: Array<{ effort?: string }>;
  }>;
};

export type ModelCapabilityProbeSpawn = (options: SpawnCodexAgentOptions) => Promise<CodexAgentResult>;

/** WP-503 unified-ledger append shape for a single live probe call. The default
 *  CLI sink routes this to `appendCallLedgerEntry`; tests inject a capturing
 *  sink so the model-free suite proves ledgering without touching tracked state. */
export type ModelCapabilityLedgerEntry = {
  family: "codex-exec";
  stage: string;
  role: string | null;
  model: string | null;
  effort: string | null;
  latencyMs: number | null;
  outcome: ProviderOutcomeV1;
  sessionId: string | null;
};
export type ModelCapabilityLedgerSink = (entry: ModelCapabilityLedgerEntry) => void;

export type RunModelCapabilityProbeArgs = {
  model: string;
  effort: EffortLevelV1;
  /** Live checks run ONLY when this is literal `true` (Phase-6, orchestrator
   *  custody). The dry default performs existence + auth-route with zero calls. */
  executeLive: boolean;
  /** Local Codex `models_cache.json` path (existence, zero calls). */
  modelsCachePath: string;
  /** Isolated CODEX_HOME `auth.json` path (auth-route, zero calls). */
  authJsonPath: string;
  /** Parent env checked for FORBIDDEN_PROVIDER_ENV before any live call. */
  env?: NodeJS.ProcessEnv;
  /** Optional staleness guard for the local cache (seconds). When set, a cache
   *  older than this (or future-skewed beyond `maxFutureSkewSeconds`) is
   *  `UNSUPPORTED(existence)`. Omitted → presence-only existence. */
  maxCacheAgeSeconds?: number;
  maxFutureSkewSeconds?: number;
};

export type ModelCapabilityProbeDeps = {
  clock?: () => Date;
  /** Live `codex exec` runner. NO runtime default — the CLI verb wires the
   *  real `spawnCodexAgent` only under `--execute-live`; a live run without a
   *  runner fails closed. Tests inject a runner that THROWS if the dry path
   *  ever reaches it, or one that counts calls for the budget guard. */
  spawn?: ModelCapabilityProbeSpawn;
  /** WP-503 ledger sink for live calls (default wired by the CLI verb). */
  ledger?: ModelCapabilityLedgerSink;
  /** Test seam: base dir for the live probe's ephemeral workspace. */
  workspaceBaseDir?: string;
  /** Live spawn plumbing (Phase-6 supplies these). */
  bin?: string;
  qualification?: CodexCliQualificationV1;
  /** Per-live-call timeout. */
  liveTimeoutMs?: number;
};

const NOT_EVALUATED_REASON = "not evaluated — a prior check failed (fail-closed stop)";

function mkCheck(
  model: string,
  effort: EffortLevelV1,
  check: ModelCapabilityCheckV1,
  status: ModelCapabilityProbeStatusV1,
  reason: string,
): ModelCapabilityCheckResultV1 {
  return { schema: MODEL_CAPABILITY_CHECK_RESULT_SCHEMA, model, effort, check, status, reason };
}

// ── (a) existence — local models_cache.json, zero calls ─────────────────────

export function probeExistence(args: {
  model: string;
  effort: EffortLevelV1;
  modelsCachePath: string;
  verifiedAt: string;
  maxCacheAgeSeconds?: number;
  maxFutureSkewSeconds?: number;
}): ModelCapabilityCheckResultV1 {
  const mk = (status: ModelCapabilityProbeStatusV1, reason: string): ModelCapabilityCheckResultV1 =>
    mkCheck(args.model, args.effort, "existence", status, reason);

  if (!existsSync(args.modelsCachePath)) {
    return mk("UNSUPPORTED", `local Codex models_cache.json is absent (${args.modelsCachePath}) — model existence is unprovable without a live account probe; refusing to guess`);
  }
  let cache: LocalCodexModelCacheV1;
  try {
    cache = JSON.parse(readFileSync(args.modelsCachePath, "utf8")) as LocalCodexModelCacheV1;
  } catch (err) {
    return mk("UNSUPPORTED", `local Codex models_cache.json is unreadable or not JSON (${(err as Error).message.split("\n")[0]})`);
  }
  if (!Array.isArray(cache.models)) {
    return mk("UNSUPPORTED", "local Codex models_cache.json has no model inventory");
  }
  if (args.maxCacheAgeSeconds !== undefined && typeof cache.fetched_at === "string") {
    const fetchedMs = Date.parse(cache.fetched_at);
    const verifiedMs = Date.parse(args.verifiedAt);
    if (Number.isFinite(fetchedMs) && Number.isFinite(verifiedMs)) {
      const ageSeconds = (verifiedMs - fetchedMs) / 1_000;
      if (ageSeconds > args.maxCacheAgeSeconds) {
        return mk("UNSUPPORTED", `local Codex models_cache.json is stale (${Math.floor(ageSeconds)}s old > ${args.maxCacheAgeSeconds}s)`);
      }
      if (ageSeconds < -(args.maxFutureSkewSeconds ?? 0)) {
        return mk("UNSUPPORTED", `local Codex models_cache.json timestamp is ${Math.ceil(-ageSeconds)}s in the future`);
      }
    }
  }
  const matches = cache.models.filter((m) => typeof m?.slug === "string" && m.slug === args.model);
  if (matches.length === 0) {
    return mk("UNSUPPORTED", `exact model slug "${args.model}" is absent from the local Codex cache`);
  }
  if (matches.length > 1) {
    return mk("UNSUPPORTED", `local Codex cache has duplicate exact slug "${args.model}" (ambiguous — refusing to guess)`);
  }
  const model = matches[0]!;
  const effortSupported = model.supported_reasoning_levels?.some((lvl) => lvl?.effort === args.effort) === true;
  if (!effortSupported) {
    return mk("UNSUPPORTED", `reasoning effort "${args.effort}" is not advertised for model "${args.model}" by the local Codex cache`);
  }
  const visibility = typeof model.visibility === "string" ? model.visibility : "unspecified";
  return mk("SUPPORTED", `exact model "${args.model}" and reasoning effort "${args.effort}" are advertised by the local Codex cache (visibility: ${visibility})`);
}

// ── (b) auth-route — assertChatgptSubscriptionAuth, zero calls ──────────────

export function probeAuthRoute(args: {
  model: string;
  effort: EffortLevelV1;
  authJsonPath: string;
}): ModelCapabilityCheckResultV1 {
  const mk = (status: ModelCapabilityProbeStatusV1, reason: string): ModelCapabilityCheckResultV1 =>
    mkCheck(args.model, args.effort, "auth-route", status, reason);
  try {
    // The SAME fail-closed assertion the hermetic envelope uses — no
    // re-implementation of the auth logic (a metered-key auth.json throws).
    const proof = assertChatgptSubscriptionAuth(args.authJsonPath);
    return mk("SUPPORTED", `auth material is ChatGPT-subscription OAuth (mode=${proof.authMode}, apiKeyPresent=${proof.apiKeyPresent}) — the metered-API route is unrepresentable`);
  } catch (err) {
    return mk("UNSUPPORTED", `ChatGPT-subscription auth route is not usable: ${(err as Error).message.split("\n")[0]}`);
  }
}

// ── live-call budget guard ──────────────────────────────────────────────────

/** Hard per-model live-call budget across the output-schema + effort-flag
 *  checks. `spend()` throws BEFORE a call would exceed the cap — the guard the
 *  WP-502 red-team ("unbounded per-model call loop") targets. */
export class LiveCallBudget {
  made = 0;
  constructor(readonly cap: number = MODEL_CAPABILITY_LIVE_CALL_BUDGET) {}
  spend(): void {
    if (this.made >= this.cap) {
      throw new ModelCapabilityProbeError(`live capability-probe call budget of ${this.cap} call(s)/model exceeded — refusing an unbounded probe loop`);
    }
    this.made += 1;
  }
  get remaining(): number {
    return this.cap - this.made;
  }
}

// ── live checks (c)/(d) — one bounded `codex exec` call each ─────────────────

type LiveContext = {
  model: string;
  effort: EffortLevelV1;
  budget: LiveCallBudget;
  spawn: ModelCapabilityProbeSpawn;
  ledger: ModelCapabilityLedgerSink;
  workspaceBaseDir: string;
  bin?: string;
  qualification?: CodexCliQualificationV1;
  liveTimeoutMs: number;
};

const LIVE_ROLE = "chapter-reviewer" as const; // read-only hermetic profile (reused, imp24e)

/** SUPPORTED only when the process actually completed with schema-bound
 *  authoritative output; any refusal/invalid/timeout/infra outcome is a
 *  fail-closed UNSUPPORTED. NEVER retried. */
async function runLiveProbeCall(
  ctx: LiveContext,
  check: "output-schema" | "effort-flag",
): Promise<ModelCapabilityCheckResultV1> {
  const mk = (status: ModelCapabilityProbeStatusV1, reason: string): ModelCapabilityCheckResultV1 =>
    mkCheck(ctx.model, ctx.effort, check, status, reason);

  ctx.budget.spend(); // fail-closed BEFORE the call if the budget is exhausted

  const stage = `capability-probe:${check}`;
  const sessionId = `capability-probe-${check}-${sha256Hex(`${ctx.model}|${ctx.effort}|${check}`).slice(0, 16)}`;
  const workspace = mkdtempSync(join(ctx.workspaceBaseDir, `cap-probe-${check}-`));
  const manifestSink = join(workspace, "logs");
  mkdirSync(manifestSink, { recursive: true });

  let outputSchemaPath: string | undefined;
  if (check === "output-schema") {
    const schema = minimalStrictSubsetSchema();
    const schemaErrors = codexTransportSchemaCompatibilityErrors(schema);
    if (schemaErrors.length > 0) {
      rmSync(workspace, { recursive: true, force: true });
      throw new ModelCapabilityProbeError(`internal: minimal output-schema is not a valid Codex transport strict subset: ${schemaErrors.join("; ")}`);
    }
    outputSchemaPath = join(workspace, "capability-probe.schema.json");
    writeFileSync(outputSchemaPath, `${JSON.stringify(schema, null, 2)}\n`);
  }

  const task = check === "output-schema"
    ? "Capability probe (WP-502). Return exactly this JSON and nothing else: {\"ok\":true}"
    : "Capability probe (WP-502). Reply with the single word OK and nothing else.";

  const options: SpawnCodexAgentOptions = {
    task,
    sessionId,
    cwd: workspace,
    sandbox: "read-only",
    writableRoots: [],
    skipGitRepoCheck: true,
    timeoutMs: ctx.liveTimeoutMs,
    model: ctx.model,
    reasoningEffort: ctx.effort,
    role: LIVE_ROLE,
    manifestSink,
    execBaseDir: join(workspace, "exec"),
    workspaceManifest: { dir: workspace, files: [] },
    ...(outputSchemaPath ? { outputSchemaPath } : {}),
    ...(ctx.bin ? { bin: ctx.bin } : {}),
    ...(ctx.qualification ? { qualification: ctx.qualification } : {}),
  };

  let result: CodexAgentResult | null = null;
  let thrown: unknown = null;
  const startedAt = Date.now();
  try {
    result = await ctx.spawn(options);
  } catch (err) {
    thrown = err;
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }

  const latencyMs = result?.durationMs ?? (Date.now() - startedAt);
  const outcome: ProviderOutcomeV1 = result?.outcome
    ?? (result === null ? "infrastructure_failure" : result.exitCode === 0 ? "content_completed" : "content_invalid");

  // Ledger EVERY call (completed, refused, timed out) — an outcome is never
  // dropped. Best-effort so a ledger I/O fault can never mask the probe result.
  try {
    ctx.ledger({
      family: "codex-exec",
      stage,
      role: LIVE_ROLE,
      model: ctx.model,
      effort: ctx.effort,
      latencyMs,
      outcome,
      sessionId,
    });
  } catch { /* ledger is best-effort; the probe result stands */ }

  if (thrown !== null) {
    return mk("UNSUPPORTED", `${check} live probe failed before/without a usable response (${(thrown as Error).message?.split("\n")[0] ?? String(thrown)}); NOT retried`);
  }
  const r = result!;
  if (check === "output-schema") {
    const schemaBound = r.finalMessageSource === "output-file";
    let parsed = false;
    try { JSON.parse(r.finalMessage); parsed = true; } catch { /* recorded below */ }
    if (r.ok && r.exitCode === 0 && outcome === "content_completed" && schemaBound && parsed) {
      return mk("SUPPORTED", "codex exec accepted the --output-schema strict subset and returned schema-bound authoritative JSON");
    }
    return mk("UNSUPPORTED", `codex exec did not accept the --output-schema strict subset (exit=${r.exitCode}, outcome=${outcome}, schemaBound=${schemaBound}, parsedJson=${parsed}); NOT retried`);
  }
  if (r.ok && r.exitCode === 0 && outcome === "content_completed") {
    return mk("SUPPORTED", `codex exec accepted -c model_reasoning_effort=${ctx.effort} and completed`);
  }
  return mk("UNSUPPORTED", `codex exec did not accept reasoning effort "${ctx.effort}" (exit=${r.exitCode}, outcome=${outcome}); NOT retried`);
}

// ── orchestration ────────────────────────────────────────────────────────────

function assemble(
  model: string,
  effort: EffortLevelV1,
  executeLive: boolean,
  verifiedAt: string,
  byCheck: Map<ModelCapabilityCheckV1, ModelCapabilityCheckResultV1>,
  liveCallsMade: number,
): ModelCapabilityProbeReportV1 {
  const checks = MODEL_CAPABILITY_CHECKS.map((c) => {
    const r = byCheck.get(c);
    if (r === undefined) throw new ModelCapabilityProbeError(`internal: probe produced no result for check "${c}"`);
    return r;
  });
  const firstUnsupported = checks.find((c) => c.status === "UNSUPPORTED") ?? null;
  const allSupported = checks.every((c) => c.status === "SUPPORTED");
  const overall = firstUnsupported !== null
    ? "UNSUPPORTED" as const
    : allSupported
      ? "SUPPORTED" as const
      : "NOT_FULLY_TESTED" as const;
  const report: ModelCapabilityProbeReportV1 = {
    schema: MODEL_CAPABILITY_PROBE_REPORT_SCHEMA,
    model,
    effort,
    executeLive,
    verifiedAt,
    checks,
    liveCallsMade,
    liveCallBudget: MODEL_CAPABILITY_LIVE_CALL_BUDGET,
    overall,
    unsupportedConfig: firstUnsupported !== null ? unsupportedModelConfigFromCheck(firstUnsupported) : null,
  };
  const errors = validateModelCapabilityProbeReport(report);
  if (errors.length > 0) {
    throw new ModelCapabilityProbeError(`internal: assembled capability-probe report is invalid: ${errors.join("; ")}`);
  }
  return report;
}

/** Run the bounded, fail-closed capability probe for one (model, effort). The
 *  dry default (executeLive=false) makes ZERO model calls: existence + auth-route
 *  are local, and the two live checks report `NOT_TESTED`. */
export async function runModelCapabilityProbe(
  args: RunModelCapabilityProbeArgs,
  deps: ModelCapabilityProbeDeps = {},
): Promise<ModelCapabilityProbeReportV1> {
  if (typeof args.model !== "string" || args.model.trim().length === 0) {
    throw new ModelCapabilityProbeError("capability probe requires a non-empty model slug");
  }
  if (!EFFORTS.includes(args.effort)) {
    throw new ModelCapabilityProbeError(`capability probe effort "${String(args.effort)}" is not a supported reasoning effort (minimal|low|medium|high|xhigh — the repo-local union has no API-only "max")`);
  }
  const verifiedAt = (deps.clock?.() ?? new Date()).toISOString();
  const byCheck = new Map<ModelCapabilityCheckV1, ModelCapabilityCheckResultV1>();
  let liveCallsMade = 0;

  const notTested = (check: ModelCapabilityCheckV1, reason: string): void => {
    byCheck.set(check, mkCheck(args.model, args.effort, check, "NOT_TESTED", reason));
  };
  const finishFailClosed = (): ModelCapabilityProbeReportV1 => {
    for (const c of MODEL_CAPABILITY_CHECKS) {
      if (!byCheck.has(c)) notTested(c, NOT_EVALUATED_REASON);
    }
    return assemble(args.model, args.effort, args.executeLive, verifiedAt, byCheck, liveCallsMade);
  };

  // (a) existence — local, zero calls.
  const existence = probeExistence({
    model: args.model,
    effort: args.effort,
    modelsCachePath: args.modelsCachePath,
    verifiedAt,
    maxCacheAgeSeconds: args.maxCacheAgeSeconds,
    maxFutureSkewSeconds: args.maxFutureSkewSeconds,
  });
  byCheck.set("existence", existence);
  if (existence.status !== "SUPPORTED") return finishFailClosed();

  // (b) auth-route — local, zero calls.
  const auth = probeAuthRoute({ model: args.model, effort: args.effort, authJsonPath: args.authJsonPath });
  byCheck.set("auth-route", auth);
  if (auth.status !== "SUPPORTED") return finishFailClosed();

  // (c)/(d) live checks — deferred unless explicitly authorized.
  if (args.executeLive !== true) {
    const deferred = "live check deferred — requires an authorized `codex exec` call (--execute-live, Phase-6 orchestrator custody); the dry default makes zero model calls";
    notTested("output-schema", deferred);
    notTested("effort-flag", deferred);
    return assemble(args.model, args.effort, args.executeLive, verifiedAt, byCheck, liveCallsMade);
  }

  // Live path: fail-closed on any forbidden provider env before a call fires.
  const env = args.env ?? process.env;
  const forbidden = FORBIDDEN_PROVIDER_ENV.filter((k) => typeof env[k] === "string" && (env[k] as string).length > 0);
  if (forbidden.length > 0) {
    throw new ModelCapabilityProbeError(`refusing live capability probe: parent env carries prohibited provider key(s) ${forbidden.join(", ")} — the ChatGPT-subscription route must be the only representable one`);
  }
  if (typeof deps.spawn !== "function") {
    throw new ModelCapabilityProbeError("live capability probe requires an injected/real spawn runner");
  }

  const ctx: LiveContext = {
    model: args.model,
    effort: args.effort,
    budget: new LiveCallBudget(),
    spawn: deps.spawn,
    ledger: deps.ledger ?? (() => { /* no-op sink; the CLI wires the WP-503 ledger */ }),
    workspaceBaseDir: deps.workspaceBaseDir ?? tmpdir(),
    bin: deps.bin,
    qualification: deps.qualification,
    liveTimeoutMs: deps.liveTimeoutMs ?? 120_000,
  };

  const outputSchema = await runLiveProbeCall(ctx, "output-schema");
  byCheck.set("output-schema", outputSchema);
  liveCallsMade = ctx.budget.made;
  if (outputSchema.status !== "SUPPORTED") {
    // Fail-closed stop: do not spend a second live call proving a further check
    // on an already-unsupported model.
    notTested("effort-flag", NOT_EVALUATED_REASON);
    return assemble(args.model, args.effort, args.executeLive, verifiedAt, byCheck, liveCallsMade);
  }

  const effortFlag = await runLiveProbeCall(ctx, "effort-flag");
  byCheck.set("effort-flag", effortFlag);
  liveCallsMade = ctx.budget.made;
  return assemble(args.model, args.effort, args.executeLive, verifiedAt, byCheck, liveCallsMade);
}

/** One-line human summary for the CLI verb. */
export function formatCapabilityProbeReport(report: ModelCapabilityProbeReportV1): string {
  const lines: string[] = [];
  lines.push(`capability-probe: ${report.model} @ ${report.effort} — ${report.overall}`);
  lines.push(`  mode: ${report.executeLive ? "LIVE (--execute-live)" : "DRY (default, zero model calls)"}  ·  live calls: ${report.liveCallsMade}/${report.liveCallBudget}`);
  for (const c of report.checks) {
    const icon = c.status === "SUPPORTED" ? "✓" : c.status === "UNSUPPORTED" ? "✗" : "·";
    lines.push(`  ${icon} ${c.check}: ${c.status} — ${c.reason}`);
  }
  if (report.unsupportedConfig !== null) {
    lines.push(`  UNSUPPORTED_MODEL_CONFIG → failingCheck=${report.unsupportedConfig.failingCheck}: ${report.unsupportedConfig.reason}`);
  }
  return lines.join("\n");
}
