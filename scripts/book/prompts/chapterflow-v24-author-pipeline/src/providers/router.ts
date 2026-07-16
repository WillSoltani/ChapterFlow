/**
 * Provider router. Picks the right provider for each call based on:
 *   1. CallOptions.provider override (per-call)
 *   2. CHAPTERFLOW_PROVIDER env var (per-run)
 *   3. Default: anthropic-cli (works on Max subscription, no API key)
 *
 * Per-tier model override via env vars:
 *   CHAPTERFLOW_WRITER_MODEL
 *   CHAPTERFLOW_RESEARCHER_MODEL
 *   CHAPTERFLOW_CRITIC_MODEL
 *
 * Mass-production setup:
 *   export CHAPTERFLOW_PROVIDER=anthropic-api
 *   export ANTHROPIC_API_KEY=...
 *   export CHAPTERFLOW_WRITER_MODEL=claude-sonnet-4-6
 *   export CHAPTERFLOW_CRITIC_MODEL=claude-haiku-4-5-20251001
 *
 * Or with OpenAI:
 *   export CHAPTERFLOW_PROVIDER=openai-api
 *   export OPENAI_API_KEY=...
 *   export CHAPTERFLOW_WRITER_MODEL=gpt-5.6-sol
 *   export CHAPTERFLOW_CRITIC_MODEL=gpt-4o-mini
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
  StructuredJsonError,
  appendJsonInstruction,
  defaultModelForProvider,
  defaultProviderName,
  parseStructuredJson,
  providerNameFromEnv,
} from "./types.js";

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

function envModelForTier(tier: AgentTier): string | null {
  const key = `CHAPTERFLOW_${tier.toUpperCase()}_MODEL`;
  return process.env[key] ?? null;
}

export function resolveProviderName(opts: Pick<CallOptions, "provider">): ProviderName {
  return opts.provider ?? envProvider() ?? defaultProviderName();
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

export function resolveModel(opts: CallOptions, provider: Provider): string {
  return opts.model ?? envModelForTier(opts.tier) ?? provider.defaultModelForTier(opts.tier);
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
  const model = resolveModel(opts, provider);
  const rawResponses: string[] = [];
  const attemptMetadata: ProviderAttemptMetadata[] = [];
  const startedAt = Date.now();
  const first = await callWithOwnedRetries(provider, prepareCallOptions(opts, model), attemptMetadata, rawResponses);

  let effective = first;
  let content: T;
  if (opts.jsonMode) {
    try {
      content = parseStructuredJson<T>(first.raw, opts.jsonSchema);
    } catch (err) {
      const repair = await runJsonRepair(provider, opts, model, first.raw, err, attemptMetadata, rawResponses);
      effective = repair;
      try {
        content = parseStructuredJson<T>(repair.raw, opts.jsonSchema);
      } catch (repairErr) {
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
    throw new Error(`Provider "${name}" returned an invalid CallResult: ${formatRuntimeFindings(validation.findings)}`);
  }
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
