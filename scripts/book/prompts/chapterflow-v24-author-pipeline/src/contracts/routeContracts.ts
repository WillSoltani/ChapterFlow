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
  return errors;
}

export const ROUTE_CONTRACT: ContractDescriptor = {
  name: "route-result",
  version: 1,
  ownerPrompt: "IMP-02",
  description: "Task-class routing result with disjoint provider outcomes, execution-profile binding, and drift fingerprint for requalification triggers.",
  fields: {
    RouteResultV1: {
      schema: "\"route-result-v1\"",
      taskClass: "17-member task union (research-synthesis … bakeoff-judge)",
      profileName: "string", routePolicyVersion: "string",
      requestedModel: "string", requestedEffort: "string",
      effectiveModel: "string?", effectiveEffort: "string?", aliasOrSnapshot: "string?",
      executionProfileHash: "string", cliVersion: "string", providerSessionId: "string?",
      outcome: "\"content_completed\"|\"content_invalid\"|\"infrastructure_failure\"|\"timeout\"|\"provider_safeguard_or_refusal\"|\"provider_rate_or_capacity\"|\"policy_preflight_failure\"",
      driftFingerprint: "string",
    },
  },
};
