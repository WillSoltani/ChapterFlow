/**
 * Provider router (legacy "stack A" model transport). Picks the right provider
 * for each call based on:
 *   1. CallOptions.provider override (per-call)
 *   2. CHAPTERFLOW_PROVIDER env var (per-run)
 *   3. Default: anthropic-cli (works on Max subscription, no API key)
 *
 * MODEL RESOLUTION (WP-304 — envelope parity for the stack-A gap): the model+
 * effort DECISION is resolved through the central `modelPolicy.resolveRoute`
 * (the ONE typed decision table), exactly as the codex envelope does — NOT
 * through an ambient `CHAPTERFLOW_*_MODEL` env, which is now INERT (killed here
 * and in `types.ts`). A caller may still pin `opts.model` per call (recorded as
 * call-explicit); an unpinned call rides the normal-profile matrix. Every call
 * emits a `ProviderRouteResultV1` provenance record (see `routerRoute.ts`),
 * closing the "Claude-side calls unledgered" gap (V25-15).
 *
 * TRANSPORT/FAMILY: `modelPolicy` is a codex/GPT-5.6 authority; the subscription
 * CLI serves the CLAUDE family. The policy model is DISPATCHED only when the
 * selected provider serves that family (the mass-production `openai-api` route);
 * otherwise the provider's deterministic in-code default is used and recorded as
 * `modelSource:"provider-default"` — never an env-driven silent pick. See
 * `routerRoute.ts` for the full rationale.
 *
 * Mass-production setup (billed; requires the no-API guard OFF):
 *   export CHAPTERFLOW_PROVIDER=openai-api
 *   export OPENAI_API_KEY=...
 *   # model is resolved by modelPolicy (gpt-5.6-sol) — no per-tier model env.
 */

import { formatRuntimeFindings, validateProviderCallResult } from "../runtimeSchemas.js";
import {
  AgentTier,
  CallOptions,
  CallResult,
  Provider,
  ProviderAttemptMetadata,
  ProviderName,
  ProviderRawResult,
  ProviderTimeoutError,
  StructuredJsonError,
  appendJsonInstruction,
  defaultModelForProvider,
  defaultProviderName,
  parseStructuredJson,
  providerNameFromEnv,
} from "./types.js";
import type { AgentRole } from "../contracts/executionProfile.js";
import type { ProviderOutcomeV1 } from "../contracts/routeContracts.js";
import { type ResolvedRoute, resolveRoute } from "../orchestrator/modelPolicy.js";
import {
  PROVIDER_TIER_ROLE,
  type RouterModelSource,
  buildProviderRouteResult,
  persistProviderRouteResult,
  providerServesModel,
} from "./routerRoute.js";

type ProviderLoader = () => Promise<Provider>;

const PROVIDERS: Record<ProviderName, ProviderLoader> = {
  "anthropic-cli": async () => (await import("./cli.js")).ClaudeCliProvider,
  "anthropic-api": async () => (await import("./anthropic-api.js")).AnthropicApiProvider,
  "openai-api": async () => (await import("./openai-api.js")).OpenAiApiProvider,
};

const providerCache = new Map<ProviderName, Provider>();

function envProvider(): ProviderName | null {
  return providerNameFromEnv();
}

export function resolveProviderName(opts: Pick<CallOptions, "provider">): ProviderName {
  return opts.provider ?? envProvider() ?? defaultProviderName();
}

/** The `modelPolicy` role this call governs to: an explicit `opts.role` wins,
 *  otherwise the frozen tier→role map. */
function roleForCall(opts: Pick<CallOptions, "tier" | "role">): AgentRole {
  return opts.role ?? PROVIDER_TIER_ROLE[opts.tier];
}

/** The full model+effort DECISION for one router call, resolved through the
 *  central policy (WP-304). `resolved` is the policy decision (governance +
 *  provenance); `effectiveModel` is what actually dispatches to the transport,
 *  with `modelSource` recording why. The ambient `CHAPTERFLOW_*_MODEL` env plays
 *  NO part — it is inert. */
export type RouterRouteDecision = {
  role: AgentRole;
  resolved: ResolvedRoute;
  effectiveModel: string;
  modelSource: RouterModelSource;
};

export function resolveRouterRoute(opts: CallOptions, providerName: ProviderName): RouterRouteDecision {
  const role = roleForCall(opts);
  // Precedence identical to WP-301's author route: a call-explicit `opts.model`
  // rides ABOVE the matrix (recorded call-explicit); otherwise the normal-profile
  // cell decides. Effort is never taken from the caller here (the CLI/API
  // transports have no reasoning-effort dial) — it is recorded from the policy.
  const resolved = resolveRoute({ role, requestedModel: opts.model });
  if (opts.model !== undefined) {
    // The caller pinned this model deliberately; dispatch it verbatim on whatever
    // provider they chose (e.g. an explicit `claude-opus-4-7` on anthropic-api).
    return { role, resolved, effectiveModel: opts.model, modelSource: "call-explicit" };
  }
  // Unpinned: dispatch the policy model iff the provider serves its family;
  // otherwise the provider's deterministic in-code default (ambient-free).
  if (providerServesModel(providerName, resolved.model)) {
    return { role, resolved, effectiveModel: resolved.model, modelSource: "policy" };
  }
  return {
    role,
    resolved,
    effectiveModel: defaultModelForProvider(providerName, opts.tier),
    modelSource: "provider-default",
  };
}

async function loadProvider(name: ProviderName): Promise<Provider> {
  const cached = providerCache.get(name);
  if (cached) return cached;
  const loader = PROVIDERS[name];
  if (!loader) throw new Error(`Unknown provider: ${name}`);
  const provider = await loader();
  providerCache.set(name, provider);
  return provider;
}

export async function selectProvider(opts: CallOptions): Promise<Provider> {
  const name = resolveProviderName(opts);
  const provider = await loadProvider(name);
  if (!provider) throw new Error(`Unknown provider: ${name}`);
  if (!provider.isConfigured()) {
    throw new Error(`Provider "${name}" is not configured. ${configHint(name)}`);
  }
  return provider;
}

/** The effective dispatched model for a call. Thin back-compat wrapper over the
 *  full `resolveRouterRoute` decision (model+effort governance + provenance). */
export function resolveModel(opts: CallOptions, provider: Provider): string {
  return resolveRouterRoute(opts, provider.name).effectiveModel;
}

/** Whether a metered API key is present for the selected transport. The CLI
 *  route never carries one; a billed provider may. Recorded honestly in the
 *  route provenance (the no-API guard already refuses billed providers under the
 *  ship invariant, so this is telemetry, not a permission). */
function apiKeyPresentFor(name: ProviderName): boolean {
  if (name === "anthropic-cli") return false;
  const key = name === "openai-api" ? "OPENAI_API_KEY" : "ANTHROPIC_API_KEY";
  return Boolean(process.env[key]);
}

function outcomeForError(err: unknown): ProviderOutcomeV1 {
  if (err instanceof ProviderTimeoutError) return "timeout";
  return "infrastructure_failure";
}

export async function callModel<T = string>(opts: CallOptions): Promise<CallResult<T>> {
  // No-API invariant choke point. In codex no-API mode (CHAPTERFLOW_NO_API_CODEX_QC=1) ALL model
  // work is supposed to run via `codex exec` sessions, never a billed provider. If a FUNDED
  // provider call reaches this router anyway — a critic, verb, or judge that secretly calls a
  // model (e.g. quiz-judge defaulting to openai-api) — REFUSE rather than silently spend money the
  // no-API mode promises it won't. This is the single architectural enforcement the invariant
  // previously lacked (it was only avoided by convention). The subscription CLI provider is not a
  // funded API, so it stays exempt; to intentionally spend on the API, unset the env.
  const name = resolveProviderName(opts);
  if (process.env.CHAPTERFLOW_NO_API_CODEX_QC === "1" && (name === "anthropic-api" || name === "openai-api")) {
    throw new Error(`no-API mode (CHAPTERFLOW_NO_API_CODEX_QC=1) forbids a billed "${name}" model call (tier=${opts.tier}). All model work must run via codex exec. To spend on the API, unset CHAPTERFLOW_NO_API_CODEX_QC.`);
  }
  const provider = await selectProvider(opts);
  // WP-304: resolve model+effort through the central policy (governance), not an
  // ambient env; `model` is the effective transport model, `decision` carries the
  // policy provenance recorded below (on BOTH success and failure paths).
  const decision = resolveRouterRoute(opts, name);
  const model = decision.effectiveModel;
  const recordRoute = (outcome: ProviderOutcomeV1): void => {
    persistProviderRouteResult(
      buildProviderRouteResult({
        tier: opts.tier,
        role: decision.role,
        resolved: decision.resolved,
        modelSource: decision.modelSource,
        effectiveProvider: name,
        effectiveModel: model,
        outcome,
        apiKeyPresent: apiKeyPresentFor(name),
        telemetry: { stage: opts.stage, runId: opts.runId, bookId: opts.bookId, chapterId: opts.chapterId, costCenter: opts.costCenter },
      }),
    );
  };

  const rawResponses: string[] = [];
  const attemptMetadata: ProviderAttemptMetadata[] = [];
  const startedAt = Date.now();
  let first: ProviderRawResult;
  try {
    first = await callWithOwnedRetries(provider, prepareCallOptions(opts, model), attemptMetadata, rawResponses);
  } catch (err) {
    recordRoute(outcomeForError(err));
    throw err;
  }

  let effective = first;
  let content: T;
  if (opts.jsonMode) {
    try {
      content = parseStructuredJson<T>(first.raw, opts.jsonSchema);
    } catch (err) {
      let repair: ProviderRawResult;
      try {
        repair = await runJsonRepair(provider, opts, model, first.raw, err, attemptMetadata, rawResponses);
      } catch (repairSpawnErr) {
        recordRoute(outcomeForError(repairSpawnErr));
        throw repairSpawnErr;
      }
      effective = repair;
      try {
        content = parseStructuredJson<T>(repair.raw, opts.jsonSchema);
      } catch (repairErr) {
        recordRoute("content_completed"); // the provider returned; the CONTENT failed schema, not the transport
        const detail = repairErr instanceof StructuredJsonError ? repairErr.issues.join("; ") : (repairErr as Error).message;
        throw new Error(`Structured JSON from ${name}/${model} failed after 1 repair attempt: ${detail}`);
      }
    }
  } else {
    content = first.raw as unknown as T;
  }

  const totalDurationMs = Date.now() - startedAt;
  const result: CallResult<T> = {
    ...effective,
    provider: name,
    model,
    durationMs: totalDurationMs,
    content,
    attempts: attemptMetadata.length,
    attemptMetadata,
    rawResponses,
  };
  const validation = validateProviderCallResult(result);
  if (!validation.ok) {
    recordRoute("content_completed");
    throw new Error(`Provider "${name}" returned an invalid CallResult: ${formatRuntimeFindings(validation.findings)}`);
  }
  recordRoute("content_completed");
  return result;
}

function prepareCallOptions(opts: CallOptions, model: string): CallOptions & { model: string } {
  return {
    ...opts,
    model,
    user: opts.jsonMode ? appendJsonInstruction(opts.user, opts.jsonSchema) : opts.user,
  };
}

async function callWithOwnedRetries(
  provider: Provider,
  opts: CallOptions & { model: string },
  attemptMetadata: ProviderAttemptMetadata[],
  rawResponses: string[],
): Promise<ProviderRawResult> {
  const maxAttempts = normalizeMaxAttempts(opts.maxAttempts);
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const kind: ProviderAttemptMetadata["kind"] = attempt === 1 ? "initial" : "retry";
    const startedAt = Date.now();
    try {
      const raw = await provider.call(opts);
      rawResponses.push(raw.raw);
      attemptMetadata.push({
        attempt: attemptMetadata.length + 1,
        durationMs: raw.durationMs,
        kind,
        rawBytes: Buffer.byteLength(raw.raw, "utf8"),
      });
      return raw;
    } catch (err) {
      lastError = err;
      attemptMetadata.push({
        attempt: attemptMetadata.length + 1,
        durationMs: Date.now() - startedAt,
        kind,
        error: (err as Error).message,
      });
      if (attempt === maxAttempts) break;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function runJsonRepair(
  provider: Provider,
  opts: CallOptions,
  model: string,
  raw: string,
  cause: unknown,
  attemptMetadata: ProviderAttemptMetadata[],
  rawResponses: string[],
): Promise<ProviderRawResult> {
  const repairUser = appendJsonInstruction(buildJsonRepairPrompt(raw, cause), opts.jsonSchema);
  const repairOpts: CallOptions & { model: string } = {
    ...opts,
    model,
    user: repairUser,
    maxAttempts: 1,
    priorTurns: [
      ...(opts.priorTurns ?? []),
      { role: "user", content: opts.jsonMode ? appendJsonInstruction(opts.user, opts.jsonSchema) : opts.user },
      { role: "assistant", content: raw },
    ],
  };
  const startedAt = Date.now();
  try {
    const repaired = await provider.call(repairOpts);
    rawResponses.push(repaired.raw);
    attemptMetadata.push({
      attempt: attemptMetadata.length + 1,
      durationMs: repaired.durationMs,
      kind: "json-repair",
      rawBytes: Buffer.byteLength(repaired.raw, "utf8"),
    });
    return repaired;
  } catch (err) {
    attemptMetadata.push({
      attempt: attemptMetadata.length + 1,
      durationMs: Date.now() - startedAt,
      kind: "json-repair",
      error: (err as Error).message,
    });
    throw err;
  }
}

function buildJsonRepairPrompt(raw: string, cause: unknown): string {
  const issues = cause instanceof StructuredJsonError ? cause.issues.join("; ") : (cause as Error).message;
  const boundedRaw = raw.length > 4_000 ? `${raw.slice(0, 4_000)}\n[previous response truncated for repair prompt]` : raw;
  return [
    "Your previous response was not accepted as structured JSON.",
    `Validation error: ${issues}`,
    "Return only a corrected JSON value. Preserve the intended data, but do not include prose or markdown.",
    "",
    "Previous response:",
    boundedRaw,
  ].join("\n");
}

function normalizeMaxAttempts(value: number | undefined): number {
  if (value === undefined) return 1;
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    throw new Error(`maxAttempts must be an integer from 1 to 5; got ${String(value)}`);
  }
  return value;
}

function configHint(name: ProviderName): string {
  switch (name) {
    case "anthropic-cli": return "Install with `npm install -g @anthropic-ai/claude-code` and run `claude /login`.";
    case "anthropic-api": return "Set ANTHROPIC_API_KEY in your environment.";
    case "openai-api":    return "Set OPENAI_API_KEY in your environment.";
  }
}

/** Convenience: ping the active provider with a single tiny call. */
export async function pingProvider(): Promise<{ ok: boolean; provider: ProviderName; model: string; message: string }> {
  const providerName = (() => {
    try {
      return resolveProviderName({});
    } catch {
      return defaultProviderName();
    }
  })();
  try {
    const result = await callModel<string>({
      tier: "critic",
      system: "You answer in one word.",
      user: "Say the word: ok",
      maxTokens: 16,
      timeoutMs: 60_000,
    });
    return { ok: true, provider: result.provider, model: result.model, message: result.content.trim() };
  } catch (err) {
    return { ok: false, provider: providerName, model: "?", message: (err as Error).message };
  }
}

export function defaultModelForProviderName(provider: ProviderName, tier: AgentTier): string {
  return defaultModelForProvider(provider, tier);
}
