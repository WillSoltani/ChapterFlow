/**
 * Provider adapter: Anthropic API.
 *
 * Uses the @anthropic-ai/sdk (already in root package.json). Requires
 * ANTHROPIC_API_KEY in the environment. Suited for mass production: parallel
 * requests, predictable latency, prompt caching, real cost tracking.
 *
 * Default model per tier:
 *   writer     → claude-sonnet-4-6 (good quality, ~5x cheaper than Opus)
 *   researcher → claude-sonnet-4-6
 *   critic     → claude-haiku-4-5-20251001
 *
 * Override per call via CallOptions.model, or globally via env:
 *   CHAPTERFLOW_WRITER_MODEL, CHAPTERFLOW_CRITIC_MODEL, CHAPTERFLOW_RESEARCHER_MODEL
 */

import Anthropic from "@anthropic-ai/sdk";

import {
  AgentTier,
  CallOptions,
  CallResult,
  Provider,
  appendJsonInstruction,
  extractJson,
} from "./types.js";

const TIER_DEFAULT_MODELS: Record<AgentTier, string> = {
  writer: "claude-sonnet-4-6",
  researcher: "claude-sonnet-4-6",
  critic: "claude-haiku-4-5-20251001",
};

// Approximate input/output prices in USD per 1M tokens. Used only for the
// estimatedCostUsd field in CallResult; not authoritative.
const PRICE_PER_M: Record<string, { in: number; out: number }> = {
  "claude-opus-4-7":              { in: 15.0, out: 75.0 },
  "claude-sonnet-4-6":            { in:  3.0, out: 15.0 },
  "claude-haiku-4-5-20251001":    { in:  1.0, out:  5.0 },
};

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  _client = new Anthropic({ apiKey });
  return _client;
}

export const AnthropicApiProvider: Provider = {
  name: "anthropic-api",
  defaultModelForTier(tier: AgentTier): string {
    return TIER_DEFAULT_MODELS[tier];
  },
  isConfigured(): boolean {
    return !!process.env.ANTHROPIC_API_KEY;
  },
  async call<T = string>(opts: CallOptions): Promise<CallResult<T>> {
    const model = opts.model ?? TIER_DEFAULT_MODELS[opts.tier];
    const userText = opts.jsonMode ? appendJsonInstruction(opts.user) : opts.user;
    const messages: Anthropic.MessageParam[] = [];
    if (opts.priorTurns) {
      for (const turn of opts.priorTurns) {
        messages.push({ role: turn.role, content: turn.content });
      }
    }
    messages.push({ role: "user", content: userText });

    const startedAt = Date.now();
    const response = await client().messages.create({
      model,
      max_tokens: opts.maxTokens ?? 4096,
      temperature: opts.temperature ?? 0.7,
      system: [{ type: "text", text: opts.system, cache_control: { type: "ephemeral" } }],
      messages,
    });
    const durationMs = Date.now() - startedAt;

    const textBlocks = response.content.filter((b: any) => b.type === "text") as Array<{ type: "text"; text: string }>;
    const raw = textBlocks.map((b) => b.text).join("");

    let content: T;
    if (opts.jsonMode) {
      const jsonText = extractJson(raw);
      try {
        content = JSON.parse(jsonText) as T;
      } catch (err) {
        throw new Error(`Failed to parse JSON from ${model}: ${(err as Error).message}\n---\n${raw.slice(0, 500)}`);
      }
    } else {
      content = raw as unknown as T;
    }

    const usage: any = response.usage;
    const inputTokens = usage?.input_tokens ?? 0;
    const outputTokens = usage?.output_tokens ?? 0;
    const price = PRICE_PER_M[model];
    const estimatedCostUsd = price ? (inputTokens / 1e6) * price.in + (outputTokens / 1e6) * price.out : undefined;

    return {
      provider: "anthropic-api",
      model,
      durationMs,
      content,
      raw,
      inputTokens,
      outputTokens,
      cacheReadTokens: usage?.cache_read_input_tokens ?? 0,
      cacheWriteTokens: usage?.cache_creation_input_tokens ?? 0,
      estimatedCostUsd,
    };
  },
};
