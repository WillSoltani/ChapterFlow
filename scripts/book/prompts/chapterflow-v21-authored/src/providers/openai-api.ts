/**
 * Provider adapter: OpenAI API.
 *
 * Uses the official `openai` SDK (already in root package.json). Requires
 * OPENAI_API_KEY in the environment.
 *
 * Default model per tier:
 *   writer     → gpt-5.5 (or gpt-4o; configurable per env)
 *   researcher → gpt-4o-mini
 *   critic     → gpt-4o-mini
 *
 * For mass production: parallel requests, JSON mode via response_format.
 */

import OpenAI from "openai";

import {
  AgentTier,
  CallOptions,
  CallResult,
  Provider,
  appendJsonInstruction,
  extractJson,
} from "./types.js";

const TIER_DEFAULT_MODELS: Record<AgentTier, string> = {
  // gpt-5.5 is the user's request; resolved via env CHAPTERFLOW_WRITER_MODEL
  // override if the actual model name differs in their account. gpt-4o is the
  // safe fallback that exists today.
  writer: process.env.CHAPTERFLOW_OPENAI_WRITER ?? "gpt-4o",
  researcher: process.env.CHAPTERFLOW_OPENAI_RESEARCHER ?? "gpt-4o-mini",
  critic: process.env.CHAPTERFLOW_OPENAI_CRITIC ?? "gpt-4o-mini",
};

// Approximate prices per 1M tokens.
const PRICE_PER_M: Record<string, { in: number; out: number }> = {
  "gpt-4o":      { in: 2.50, out: 10.00 },
  "gpt-4o-mini": { in: 0.15, out:  0.60 },
  // Placeholder pricing for gpt-5.5; update when published.
  "gpt-5.5":     { in: 5.00, out: 20.00 },
};

let _client: OpenAI | null = null;
function client(): OpenAI {
  if (_client) return _client;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");
  _client = new OpenAI({ apiKey });
  return _client;
}

export const OpenAiApiProvider: Provider = {
  name: "openai-api",
  defaultModelForTier(tier: AgentTier): string {
    return TIER_DEFAULT_MODELS[tier];
  },
  isConfigured(): boolean {
    return !!process.env.OPENAI_API_KEY;
  },
  async call<T = string>(opts: CallOptions): Promise<CallResult<T>> {
    const model = opts.model ?? TIER_DEFAULT_MODELS[opts.tier];
    const userText = opts.jsonMode ? appendJsonInstruction(opts.user) : opts.user;

    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: "system", content: opts.system },
    ];
    if (opts.priorTurns) {
      for (const turn of opts.priorTurns) {
        messages.push({ role: turn.role, content: turn.content });
      }
    }
    messages.push({ role: "user", content: userText });

    const startedAt = Date.now();
    const response = await client().chat.completions.create({
      model,
      messages,
      max_tokens: opts.maxTokens ?? 4096,
      temperature: opts.temperature ?? 0.7,
      response_format: opts.jsonMode ? { type: "json_object" } : undefined,
    });
    const durationMs = Date.now() - startedAt;

    const raw = response.choices[0]?.message?.content ?? "";

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

    const inputTokens = response.usage?.prompt_tokens ?? 0;
    const outputTokens = response.usage?.completion_tokens ?? 0;
    const price = PRICE_PER_M[model];
    const estimatedCostUsd = price ? (inputTokens / 1e6) * price.in + (outputTokens / 1e6) * price.out : undefined;

    return {
      provider: "openai-api",
      model,
      durationMs,
      content,
      raw,
      inputTokens,
      outputTokens,
      estimatedCostUsd,
    };
  },
};
