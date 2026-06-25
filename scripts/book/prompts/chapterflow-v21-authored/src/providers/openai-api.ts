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
  Provider,
  ProviderRawResult,
  defaultModelForProvider,
  withProviderTimeout,
} from "./types.js";

// Approximate prices per 1M tokens.
const PRICE_PER_M: Record<string, { in: number; out: number }> = {
  "gpt-4o":      { in: 2.50, out: 10.00 },
  "gpt-4o-mini": { in: 0.15, out:  0.60 },
  // Placeholder pricing for gpt-5.5; update when published.
  "gpt-5.5":     { in: 5.00, out: 20.00 },
};

function usesCompletionTokenLimit(model: string): boolean {
  return /^(gpt-5|o[134]|o\d)/.test(model);
}

let _client: OpenAI | null = null;
function client(): OpenAI {
  if (_client) return _client;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");
  _client = new OpenAI({ apiKey, maxRetries: 0 });
  return _client;
}

export const OpenAiApiProvider: Provider = {
  name: "openai-api",
  defaultModelForTier(tier: AgentTier): string {
    return defaultModelForProvider("openai-api", tier);
  },
  isConfigured(): boolean {
    return !!process.env.OPENAI_API_KEY;
  },
  async call(opts: CallOptions & { model: string }): Promise<ProviderRawResult> {
    const model = opts.model;
    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: "system", content: opts.system },
    ];
    if (opts.priorTurns) {
      for (const turn of opts.priorTurns) {
        messages.push({ role: turn.role, content: turn.content });
      }
    }
    messages.push({ role: "user", content: opts.user });

    const startedAt = Date.now();
    const tokenLimit = opts.maxTokens ?? 4096;
    const request: OpenAI.ChatCompletionCreateParamsNonStreaming = {
      model,
      messages,
      response_format: openAiResponseFormat(opts),
    };
    if (usesCompletionTokenLimit(model)) {
      request.max_completion_tokens = tokenLimit;
    } else {
      request.max_tokens = tokenLimit;
      request.temperature = opts.temperature ?? 0.7;
    }
    const response = await withProviderTimeout("openai-api", opts.timeoutMs ?? 240_000, (signal) =>
      client().chat.completions.create(request, { signal }),
    );
    const durationMs = Date.now() - startedAt;

    const raw = response.choices[0]?.message?.content ?? "";

    const inputTokens = response.usage?.prompt_tokens ?? 0;
    const outputTokens = response.usage?.completion_tokens ?? 0;
    const price = PRICE_PER_M[model];
    const estimatedCostUsd = price ? (inputTokens / 1e6) * price.in + (outputTokens / 1e6) * price.out : undefined;
    const usage = { inputTokens, outputTokens, estimatedCostUsd };

    return {
      provider: "openai-api",
      model,
      durationMs,
      raw,
      usage,
      inputTokens,
      outputTokens,
      estimatedCostUsd,
    };
  },
};

function openAiResponseFormat(opts: CallOptions): OpenAI.ChatCompletionCreateParamsNonStreaming["response_format"] {
  if (!opts.jsonMode) return undefined;
  if (opts.jsonSchema) {
    return {
      type: "json_schema",
      json_schema: {
        name: opts.jsonSchemaName ?? "chapterflow_response",
        strict: true,
        schema: opts.jsonSchema as Record<string, unknown>,
      },
    };
  }
  return { type: "json_object" };
}
