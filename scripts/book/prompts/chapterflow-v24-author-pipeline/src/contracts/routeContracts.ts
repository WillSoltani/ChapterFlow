/**
 * Model-routing contracts (frozen by IMP-00; IMPLEMENTED by IMP-02).
 *
 * Master plan §8.10 / F-002 / F-003 / F-024: one typed policy resolves task
 * class → profile → requested/effective model + effort, with provider outcomes
 * kept DISJOINT — `provider_safeguard_or_refusal` is a bounded first-class
 * result, never replayed-until-pass and never scored as prose failure. The
 * route result references the exact execution-profile hash so route provenance
 * includes instructions/config/tools, not just the model label.
 */

import { ContractDescriptor, expectFields, isNonEmptyString } from "./contractUtil.js";

export type TaskClassV1 =
  | "research-synthesis"
  | "source-repair"
  | "author-first-write"
  | "author-regeneration"
  | "routine-repair"
  | "source-sensitive-repair"
  | "chapter-direct-read"
  | "source-verification"
  | "tiebreak"
  | "acceptance"
  | "key-derivation"
  | "sweep"
  | "scout"
  | "red-team"
  | "release-verification"
  | "bakeoff-candidate"
  | "bakeoff-judge";

export type ProviderOutcomeV1 =
  | "content_completed"
  | "content_invalid"
  | "infrastructure_failure"
  | "timeout"
  | "provider_safeguard_or_refusal"
  | "provider_rate_or_capacity"
  | "policy_preflight_failure";

export const PROVIDER_OUTCOMES: readonly ProviderOutcomeV1[] = [
  "content_completed", "content_invalid", "infrastructure_failure", "timeout",
  "provider_safeguard_or_refusal", "provider_rate_or_capacity", "policy_preflight_failure",
];

/** Proof object produced by the envelope's fail-closed auth assertion
 *  (`assertChatgptSubscriptionAuth`): the isolated CODEX_HOME's auth material
 *  is ChatGPT-subscription OAuth with no usable API key. Constructed ONLY by
 *  that assertion — a spawn whose auth material is API-key-based throws before
 *  the model receives the prompt, so a `true` apiKeyPresent is unrepresentable. */
export type ChatgptAuthProofV1 = {
  authMode: "chatgpt";
  apiKeyPresent: false;
  source: "auth.json";
};

export type RouteResultV1 = {
  schema: "route-result-v1";
  taskClass: TaskClassV1;
  profileName: string;
  routePolicyVersion: string;
  requestedModel: string;
  requestedEffort: string;
  /** Filled when the provider exposes the resolved identity (alias → snapshot). */
  effectiveModel?: string;
  effectiveEffort?: string;
  aliasOrSnapshot?: string;
  executionProfileHash: string;
  cliVersion: string;
  providerSessionId?: string;
  outcome: ProviderOutcomeV1;
  /** §16 route-invariant telemetry (owner directive 2026-07-11): which
   *  execution route carried this spawn. Real spawns record the ChatGPT-
   *  subscription `codex exec` route, proven fail-closed BEFORE spawn by
   *  `assertChatgptSubscriptionAuth`; injected-runner test doubles record the
   *  test route. Absent only on pre-v2 sidecars already on disk. */
  executionRoute?: "codex_exec_chatgpt_subscription" | "injected_test_runner";
  /** Auth mode proven from the isolated CODEX_HOME auth material ("test" for
   *  injected-runner doubles that never reach a provider). */
  authMode?: "chatgpt" | "test";
  /** Literal false: a spawn with API-key auth material or API-key env vars
   *  fails preflight, so no sidecar with a present key can exist. */
  apiKeyPresent?: false;
  /** Literal false: the broker has no API-provider fallback branch — a
   *  capacity/rate event is a recorded outcome, never a provider switch. */
  apiFallbackAllowed?: false;
  /** Stable fingerprint over model id/alias metadata, effort, prompt-stack
   *  version, execution-profile version, CLI version, provider, task class —
   *  a change fires the IMP-13 requalification trigger. */
  driftFingerprint: string;
};

export function validateRouteResult(r: unknown): string[] {
  const errors: string[] = [];
  if (r === null || typeof r !== "object") return ["route: not an object"];
  const v = r as Record<string, unknown>;
  expectFields(v, [
    "schema", "taskClass", "profileName", "routePolicyVersion", "requestedModel",
    "requestedEffort", "executionProfileHash", "cliVersion", "outcome", "driftFingerprint",
  ], errors, "route");
  if (v.schema !== "route-result-v1") errors.push("route: wrong schema tag");
  if (!PROVIDER_OUTCOMES.includes(v.outcome as ProviderOutcomeV1)) errors.push(`route: unknown outcome "${String(v.outcome)}"`);
  if (!isNonEmptyString(v.executionProfileHash)) errors.push("route: executionProfileHash required (model label alone is not provenance)");
  if (v.executionRoute !== undefined) {
    if (v.executionRoute !== "codex_exec_chatgpt_subscription" && v.executionRoute !== "injected_test_runner") {
      errors.push(`route: unknown executionRoute "${String(v.executionRoute)}"`);
    }
    if (v.apiKeyPresent !== false) errors.push("route: apiKeyPresent must be recorded false (an API-key spawn is unrepresentable — preflight throws first)");
    if (v.apiFallbackAllowed !== false) errors.push("route: apiFallbackAllowed must be recorded false (no fallback branch exists)");
    if (v.executionRoute === "codex_exec_chatgpt_subscription" && v.authMode !== "chatgpt") {
      errors.push("route: the subscription route requires authMode \"chatgpt\"");
    }
    if (v.executionRoute === "injected_test_runner" && v.authMode !== "test") {
      errors.push("route: the injected test route requires authMode \"test\"");
    }
  }
  return errors;
}

export const ROUTE_CONTRACT: ContractDescriptor = {
  name: "route-result",
  version: 2, // v2: §16 route-invariant directive 2026-07-11 — subscription-route telemetry fields
  ownerPrompt: "IMP-02",
  description: "Task-class routing result with disjoint provider outcomes, execution-profile binding, drift fingerprint for requalification triggers, and per-spawn subscription-route telemetry (executionRoute/authMode/apiKeyPresent/apiFallbackAllowed).",
  fields: {
    RouteResultV1: {
      schema: "\"route-result-v1\"",
      taskClass: "17-member task union (research-synthesis … bakeoff-judge)",
      profileName: "string", routePolicyVersion: "string",
      requestedModel: "string", requestedEffort: "string",
      effectiveModel: "string?", effectiveEffort: "string?", aliasOrSnapshot: "string?",
      executionProfileHash: "string", cliVersion: "string", providerSessionId: "string?",
      outcome: "\"content_completed\"|\"content_invalid\"|\"infrastructure_failure\"|\"timeout\"|\"provider_safeguard_or_refusal\"|\"provider_rate_or_capacity\"|\"policy_preflight_failure\"",
      executionRoute: "\"codex_exec_chatgpt_subscription\"|\"injected_test_runner\"?",
      authMode: "\"chatgpt\"|\"test\"?",
      apiKeyPresent: "false? (a true value is unrepresentable — preflight throws)",
      apiFallbackAllowed: "false? (no fallback branch exists)",
      driftFingerprint: "string",
    },
  },
};
