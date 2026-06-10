import { test } from "node:test";
import assert from "node:assert/strict";
// Import the PURE core directly — `ai-config.ts` pulls in `server-only`, which
// throws under `tsx --test`. (Same split as account-guard-policy / reconciliation-core.)
import {
  AI_PRICING,
  DEFAULT_ASK_BOOK_MODEL,
  DEFAULT_REFLECTION_FEEDBACK_MODEL,
  DEFAULT_SCENARIO_VALIDATION_MODEL,
  coarseReason,
  estimateAiCostUsd,
  intEnv,
  parseScenarioValidation,
  scenarioStatusFromDecision,
  scenarioValidationUnavailable,
} from "./ai-config-core";

const MODEL = "claude-haiku-4-5";

// ── parseScenarioValidation: the core "AI unavailable / malformed" safety net ──

test("parseScenarioValidation accepts each valid decision and threads the model", () => {
  for (const decision of ["auto_approve", "auto_reject", "queue_for_review"] as const) {
    const r = parseScenarioValidation(
      JSON.stringify({ decision, reason: "because" }),
      MODEL,
    );
    assert.equal(r.decision, decision);
    assert.equal(r.reason, "because");
    assert.equal(r.model, MODEL);
  }
});

test("parseScenarioValidation defaults a missing reason", () => {
  const r = parseScenarioValidation(JSON.stringify({ decision: "auto_approve" }), MODEL);
  assert.equal(r.decision, "auto_approve");
  assert.equal(r.reason, "No reason provided");
});

test("parseScenarioValidation never auto-approves on a malformed response", () => {
  const badInputs = [
    "", // empty
    "   ", // whitespace
    "not json at all",
    "{ broken json",
    JSON.stringify({ decision: "maybe", reason: "?" }), // unexpected value
    JSON.stringify({ reason: "no decision field" }),
    JSON.stringify({ decision: 42 }),
    JSON.stringify("auto_approve"), // a bare JSON string, not an object
  ];
  for (const input of badInputs) {
    const r = parseScenarioValidation(input, MODEL);
    assert.equal(
      r.decision,
      "queue_for_review",
      `malformed input must queue, not auto-decide: ${JSON.stringify(input)}`,
    );
    assert.notEqual(r.decision, "auto_approve");
    assert.equal(r.model, MODEL);
  }
});

// ── decision → status mapping ─────────────────────────────────────────────────

test("scenarioStatusFromDecision maps all three decisions", () => {
  assert.equal(scenarioStatusFromDecision("auto_approve"), "approved");
  assert.equal(scenarioStatusFromDecision("auto_reject"), "rejected");
  assert.equal(scenarioStatusFromDecision("queue_for_review"), "pending");
});

test("AI-unavailable fallback queues for human review (never approved)", () => {
  const r = scenarioValidationUnavailable(MODEL);
  assert.equal(r.decision, "queue_for_review");
  assert.equal(scenarioStatusFromDecision(r.decision), "pending");
  assert.equal(r.model, MODEL);
});

// ── cost estimation ────────────────────────────────────────────────────────────

test("estimateAiCostUsd prices Haiku and Sonnet correctly", () => {
  // haiku-4-5: $1/M in, $5/M out
  assert.equal(
    estimateAiCostUsd("claude-haiku-4-5", { input_tokens: 1000, output_tokens: 500 }),
    0.0035,
  );
  // sonnet-4-6: $3/M in, $15/M out
  assert.equal(
    estimateAiCostUsd("claude-sonnet-4-6", { input_tokens: 2000, output_tokens: 1000 }),
    0.021,
  );
});

test("estimateAiCostUsd resolves date-suffixed model IDs by prefix", () => {
  assert.equal(
    estimateAiCostUsd("claude-haiku-4-5-20251001", { input_tokens: 1000, output_tokens: 500 }),
    0.0035,
  );
});

test("estimateAiCostUsd tolerates null cache fields and missing usage", () => {
  const cost = estimateAiCostUsd("claude-haiku-4-5", {
    input_tokens: 1000,
    output_tokens: 0,
    cache_read_input_tokens: null,
    cache_creation_input_tokens: null,
  });
  assert.ok(Number.isFinite(cost));
  assert.equal(cost, 0.001);
  assert.equal(estimateAiCostUsd("claude-haiku-4-5", null), 0);
  assert.equal(estimateAiCostUsd("claude-haiku-4-5", undefined), 0);
});

test("estimateAiCostUsd returns 0 for an unknown model", () => {
  assert.equal(estimateAiCostUsd("some-other-model", { input_tokens: 1000, output_tokens: 1000 }), 0);
});

// ── moderation-metric dimension stays low-cardinality ──────────────────────────

test("coarseReason buckets reasons into a small fixed set", () => {
  assert.equal(coarseReason("AI validation unavailable"), "unavailable");
  assert.equal(coarseReason("Unexpected AI response format"), "parse_error");
  assert.equal(coarseReason("Empty AI response"), "parse_error");
  assert.equal(coarseReason("Validation unavailable"), "unavailable");
  assert.equal(coarseReason("borderline — a human should decide"), "borderline");
  const allowed = new Set(["unavailable", "parse_error", "borderline", "error"]);
  for (const reason of ["", "anything else", "weird", "REQUEST FAILED"]) {
    assert.ok(allowed.has(coarseReason(reason)));
  }
});

// ── client-option env parsing (timeout/retries) ───────────────────────────────

test("intEnv falls back on unset, blank, whitespace, non-numeric, or below-min input", () => {
  // The whitespace case is the real bug guard: Number("  ") === 0 would otherwise
  // produce timeout: 0, which makes the Anthropic SDK abort every request.
  assert.equal(intEnv(undefined, 30000, 1), 30000);
  assert.equal(intEnv(null, 30000, 1), 30000);
  assert.equal(intEnv("", 30000, 1), 30000);
  assert.equal(intEnv("   ", 30000, 1), 30000);
  assert.equal(intEnv("abc", 30000, 1), 30000);
  assert.equal(intEnv("-5", 30000, 1), 30000);
  assert.equal(intEnv("0", 30000, 1), 30000); // below min for timeout → fallback
});

test("intEnv honors valid values and allows 0 when min is 0 (retries disable)", () => {
  assert.equal(intEnv("45000", 30000, 1), 45000);
  assert.equal(intEnv("  45000  ", 30000, 1), 45000); // trims surrounding whitespace
  assert.equal(intEnv("0", 2, 0), 0); // explicit 0 retries is honored
  assert.equal(intEnv("3", 2, 0), 3);
  assert.equal(intEnv("2.9", 2, 0), 2); // floored
});

// ── model defaults are modern, non-deprecated, bare aliases ────────────────────

test("default models are current bare aliases (no deprecated Sonnet 4)", () => {
  assert.equal(DEFAULT_SCENARIO_VALIDATION_MODEL, "claude-haiku-4-5");
  assert.equal(DEFAULT_REFLECTION_FEEDBACK_MODEL, "claude-sonnet-4-6");
  assert.equal(DEFAULT_ASK_BOOK_MODEL, "claude-haiku-4-5");
  for (const m of [
    DEFAULT_SCENARIO_VALIDATION_MODEL,
    DEFAULT_REFLECTION_FEEDBACK_MODEL,
    DEFAULT_ASK_BOOK_MODEL,
  ]) {
    assert.notEqual(m, "claude-sonnet-4-20250514"); // deprecated, retires 2026-06-15
    assert.ok(AI_PRICING[m], `default model ${m} must have pricing for cost monitoring`);
  }
});
