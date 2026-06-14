/**
 * Pure, dependency-free AI config + parsing logic — no `server-only`, no AWS, no
 * env access — so it is unit-testable under `tsx --test`. The server-only surface
 * (env-resolved model getters, the Anthropic client factory, and metric emission)
 * lives in `ai-config.ts`, which re-exports everything here.
 */

// ── Model defaults ──────────────────────────────────────────────────────────
// Bare aliases (not date-suffixed) so they track the latest snapshot. Override
// per environment via the BOOK_AI_*_MODEL env/SSM params (see ai-config.ts).

/** Cheap classifier for community-scenario moderation. */
export const DEFAULT_SCENARIO_VALIDATION_MODEL = "claude-haiku-4-5";
/** Prose feedback on reader reflections. Replaces the now-deprecated Sonnet 4. */
export const DEFAULT_REFLECTION_FEEDBACK_MODEL = "claude-sonnet-4-6";
/** "Ask the Book" (Raymond) Q&A over book content. */
export const DEFAULT_ASK_BOOK_MODEL = "claude-haiku-4-5";

// ── Cost estimation ───────────────────────────────────────────────────────────

/** Per-1M-token USD pricing. Keys are matched by prefix (handles dated IDs). */
export const AI_PRICING: Record<string, { inputPerM: number; outputPerM: number }> = {
  "claude-opus-4-8": { inputPerM: 5, outputPerM: 25 },
  "claude-sonnet-4-6": { inputPerM: 3, outputPerM: 15 },
  "claude-sonnet-4": { inputPerM: 3, outputPerM: 15 }, // legacy Sonnet 4 (deprecated)
  "claude-haiku-4-5": { inputPerM: 1, outputPerM: 5 },
};

/** Minimal shape of the Anthropic `usage` object (cache fields are nullable). */
export type AiUsageLike = {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
};

function pricingFor(model: string): { inputPerM: number; outputPerM: number } | null {
  if (AI_PRICING[model]) return AI_PRICING[model];
  // Match the longest known prefix so dated IDs (…-20251001) resolve.
  let best: { key: string; price: { inputPerM: number; outputPerM: number } } | null = null;
  for (const [key, price] of Object.entries(AI_PRICING)) {
    if (model.startsWith(key) && (!best || key.length > best.key.length)) {
      best = { key, price };
    }
  }
  return best?.price ?? null;
}

/**
 * Estimate the USD cost of one Claude call. Cache reads bill at ~0.1x the input
 * rate and cache writes at ~1.25x. Unknown models return 0 (cost is best-effort
 * telemetry, never a correctness gate).
 */
export function estimateAiCostUsd(model: string, usage: AiUsageLike | null | undefined): number {
  if (!usage) return 0;
  const price = pricingFor(model);
  if (!price) return 0;
  const input = usage.input_tokens ?? 0;
  const output = usage.output_tokens ?? 0;
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;
  const cost =
    (input / 1_000_000) * price.inputPerM +
    (output / 1_000_000) * price.outputPerM +
    (cacheRead / 1_000_000) * price.inputPerM * 0.1 +
    (cacheWrite / 1_000_000) * price.inputPerM * 1.25;
  return Math.round(cost * 1_000_000) / 1_000_000; // round to micro-dollars
}

// ── Client-option env parsing ──────────────────────────────────────────────────

/**
 * Parse a bounded integer env var, falling back when unset, blank, non-numeric,
 * or below `min`. Trims first so a whitespace-only value (`"  "`) is treated as
 * blank — otherwise `Number("  ") === 0` would slip a 0 through (a `timeout: 0`
 * makes the Anthropic SDK abort every request on the next tick).
 */
export function intEnv(raw: string | undefined | null, fallback: number, min = 0): number {
  const trimmed = raw?.trim();
  const parsed = trimmed ? Number(trimmed) : NaN;
  if (!Number.isFinite(parsed) || parsed < min) return fallback;
  return Math.floor(parsed);
}

// ── Usage metric shapes ────────────────────────────────────────────────────────

export type AiFeature = "scenario_validation" | "reflection_feedback" | "ask_book";
export type AiOutcome = "success" | "error" | "client_abort";

// ── Scenario-validation parsing + decision mapping ─────────────────────────────

export type ScenarioDecision = "auto_approve" | "auto_reject" | "queue_for_review";

export type ScenarioValidationResult = {
  decision: ScenarioDecision;
  reason: string;
  /** The model that produced this decision (or the configured default when the
   *  call never ran, e.g. no API key). Recorded on the submission for audit. */
  model: string;
};

export type ScenarioSubmissionStatus = "approved" | "rejected" | "pending";

/** Coarse, low-cardinality bucket for the `reason` metric dimension (never the
 *  model's free-text reason — that would explode CloudWatch dimension cardinality). */
export type CoarseReason = "unavailable" | "parse_error" | "borderline" | "error";

/**
 * Parse the model's raw validation response into a decision. Any failure mode —
 * empty text, non-JSON, or an unexpected `decision` value — is treated as
 * `queue_for_review` so a malformed response is never silently auto-approved.
 * `model` is threaded through so the result records what actually ran.
 */
export function parseScenarioValidation(text: string, model: string): ScenarioValidationResult {
  const trimmed = (text ?? "").trim();
  if (!trimmed) {
    return { decision: "queue_for_review", reason: "Empty AI response", model };
  }
  let parsed: { decision?: unknown; reason?: unknown };
  try {
    parsed = JSON.parse(trimmed) as { decision?: unknown; reason?: unknown };
  } catch {
    return { decision: "queue_for_review", reason: "Unexpected AI response format", model };
  }
  if (typeof parsed !== "object" || parsed === null) {
    return { decision: "queue_for_review", reason: "Unexpected AI response format", model };
  }
  const decision = parsed.decision;
  if (
    decision === "auto_approve" ||
    decision === "auto_reject" ||
    decision === "queue_for_review"
  ) {
    return {
      decision,
      reason: typeof parsed.reason === "string" ? parsed.reason : "No reason provided",
      model,
    };
  }
  return { decision: "queue_for_review", reason: "Unexpected AI response format", model };
}

/** Map a validation decision to the submission's initial status. */
export function scenarioStatusFromDecision(decision: ScenarioDecision): ScenarioSubmissionStatus {
  if (decision === "auto_approve") return "approved";
  if (decision === "auto_reject") return "rejected";
  return "pending";
}

/** The fallback result when validation cannot run (no API key) — always queues. */
export function scenarioValidationUnavailable(model: string): ScenarioValidationResult {
  return { decision: "queue_for_review", reason: "AI validation unavailable", model };
}

/** Coarse bucket for the moderation-inflow metric dimension. */
export function coarseReason(reason: string): CoarseReason {
  const r = reason.toLowerCase();
  if (r.includes("unavailable")) return "unavailable";
  if (r.includes("format") || r.includes("empty")) return "parse_error";
  if (r.includes("error") || r.includes("failed")) return "error";
  return "borderline";
}
