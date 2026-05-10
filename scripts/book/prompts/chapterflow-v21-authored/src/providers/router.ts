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
