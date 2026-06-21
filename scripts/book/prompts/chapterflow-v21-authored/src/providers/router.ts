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
 *   export CHAPTERFLOW_WRITER_MODEL=gpt-5.5
 *   export CHAPTERFLOW_CRITIC_MODEL=gpt-4o-mini
 */

import { AgentTier, CallOptions, CallResult, Provider, ProviderName } from "./types.js";
import { ClaudeCliProvider } from "./cli.js";
import { AnthropicApiProvider } from "./anthropic-api.js";
import { OpenAiApiProvider } from "./openai-api.js";

const PROVIDERS: Record<ProviderName, Provider> = {
  "anthropic-cli": ClaudeCliProvider,
  "anthropic-api": AnthropicApiProvider,
  "openai-api":    OpenAiApiProvider,
};

function envProvider(): ProviderName | null {
  const raw = process.env.CHAPTERFLOW_PROVIDER;
  if (!raw) return null;
  if (raw in PROVIDERS) return raw as ProviderName;
  throw new Error(`CHAPTERFLOW_PROVIDER=${raw} is not a known provider. Use one of: ${Object.keys(PROVIDERS).join(", ")}`);
}

function envModelForTier(tier: AgentTier): string | null {
  const key = `CHAPTERFLOW_${tier.toUpperCase()}_MODEL`;
  return process.env[key] ?? null;
}

export function selectProvider(opts: CallOptions): Provider {
  const name = opts.provider ?? envProvider() ?? "anthropic-cli";
  const provider = PROVIDERS[name];
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
  const name: ProviderName = opts.provider ?? envProvider() ?? "anthropic-cli";
  if (process.env.CHAPTERFLOW_NO_API_CODEX_QC === "1" && (name === "anthropic-api" || name === "openai-api")) {
    throw new Error(`no-API mode (CHAPTERFLOW_NO_API_CODEX_QC=1) forbids a billed "${name}" model call (tier=${opts.tier}). All model work must run via codex exec. To spend on the API, unset CHAPTERFLOW_NO_API_CODEX_QC.`);
  }
  const provider = selectProvider(opts);
  const model = resolveModel(opts, provider);
  return provider.call<T>({ ...opts, model });
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
    return { ok: false, provider: "anthropic-cli", model: "?", message: (err as Error).message };
  }
}
