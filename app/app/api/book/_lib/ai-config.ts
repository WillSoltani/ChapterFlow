import "server-only";

import { getServerEnv } from "@/app/app/api/_lib/server-env";
import { putOpsMetric } from "@/app/app/api/book/_lib/cloudwatch-metrics";
import {
  DEFAULT_ASK_BOOK_MODEL,
  DEFAULT_REFLECTION_FEEDBACK_MODEL,
  DEFAULT_SCENARIO_VALIDATION_MODEL,
  estimateAiCostUsd,
  intEnv,
  type AiFeature,
  type AiOutcome,
  type AiUsageLike,
} from "@/app/app/api/book/_lib/ai-config-core";

/**
 * Server-only configuration + observability for the app's Claude (Anthropic) usage.
 *
 * Three features call Claude — scenario validation (cheap classifier), reflection
 * feedback (prose), and Ask the Book (Q&A). This module resolves which model each
 * uses (env-overridable, no deploy needed), the shared client timeout/retry policy,
 * and emits the cost/token/latency/error metrics for every call. The pure parsing
 * and cost logic lives in `ai-config-core.ts` (re-exported below) so it stays
 * unit-testable without pulling in `server-only`/AWS.
 *
 * All metrics emit through `putOpsMetric` into the `ChapterFlow/Ops` namespace —
 * the only namespace the frontend ServerFn Lambda's IAM policy permits for
 * `cloudwatch:PutMetricData`. Emitting to any other namespace is silently denied.
 */

export * from "@/app/app/api/book/_lib/ai-config-core";

// ── Model resolvers (env override → default) ──────────────────────────────────

export async function getScenarioValidationModel(): Promise<string> {
  return (await getServerEnv("BOOK_AI_VALIDATION_MODEL")) || DEFAULT_SCENARIO_VALIDATION_MODEL;
}

export async function getReflectionFeedbackModel(): Promise<string> {
  return (await getServerEnv("BOOK_AI_FEEDBACK_MODEL")) || DEFAULT_REFLECTION_FEEDBACK_MODEL;
}

export async function getAskBookModel(): Promise<string> {
  return (await getServerEnv("BOOK_AI_ASK_MODEL")) || DEFAULT_ASK_BOOK_MODEL;
}

// ── Client options (timeout / retry) ──────────────────────────────────────────

const DEFAULT_AI_TIMEOUT_MS = 30_000;
const DEFAULT_AI_MAX_RETRIES = 2;

export type AiClientOptions = { timeout: number; maxRetries: number };

/**
 * Timeout (ms) + retry policy applied to every Anthropic client. The SDK's
 * `maxRetries` only covers request *establishment* (429/5xx/connection) — it does
 * NOT resume a stream that drops after tokens have started flowing.
 */
export async function getAiClientOptions(): Promise<AiClientOptions> {
  const [timeoutRaw, retriesRaw] = await Promise.all([
    getServerEnv("BOOK_AI_TIMEOUT_MS"),
    getServerEnv("BOOK_AI_MAX_RETRIES"),
  ]);
  return {
    // timeout must be >= 1ms — a 0 makes the SDK abort every request immediately.
    timeout: intEnv(timeoutRaw, DEFAULT_AI_TIMEOUT_MS, 1),
    // 0 retries is a valid "disable retries" setting.
    maxRetries: intEnv(retriesRaw, DEFAULT_AI_MAX_RETRIES, 0),
  };
}

/**
 * Build an Anthropic client with the shared timeout/retry policy. Lazily imports
 * the SDK (keeps it off the cold-start path of routes that never call Claude).
 */
export async function getAnthropicClient(apiKey: string) {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const options = await getAiClientOptions();
  return new Anthropic({ apiKey, ...options });
}

// ── Usage / cost / error metrics ──────────────────────────────────────────────

/**
 * Fire-and-forget: emit cost/token/latency/error metrics for one Claude call to
 * `ChapterFlow/Ops`. Never throws — a metrics outage must not affect the request.
 */
export function recordAiUsage(params: {
  feature: AiFeature;
  model: string;
  usage?: AiUsageLike | null;
  latencyMs?: number;
  outcome: AiOutcome;
}): void {
  const { feature, model, usage, latencyMs, outcome } = params;
  const dims = { feature, model, outcome };
  const input = usage?.input_tokens ?? 0;
  const output = usage?.output_tokens ?? 0;
  const costUsd = estimateAiCostUsd(model, usage);

  try {
    void putOpsMetric("AiRequest", 1, dims);
    if (input > 0) void putOpsMetric("AiInputTokens", input, dims);
    if (output > 0) void putOpsMetric("AiOutputTokens", output, dims);
    if (costUsd > 0) void putOpsMetric("AiCostUsd", costUsd, dims, "None");
    if (typeof latencyMs === "number" && latencyMs >= 0) {
      void putOpsMetric("AiLatencyMs", latencyMs, dims, "Milliseconds");
    }
    if (outcome === "error") void putOpsMetric("AiError", 1, { feature, model });
  } catch {
    // swallow — telemetry must never break the caller
  }
}
