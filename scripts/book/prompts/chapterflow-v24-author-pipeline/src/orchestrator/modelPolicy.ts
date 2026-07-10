/**
 * modelPolicy — the ONE typed authority for model + reasoning-effort routing
 * (IMP-02; F-002/F-003 P1, F-024 input; master plan §8.10; frozen
 * `route-result` v1 contract).
 *
 * Before this package, routing lived in three places: per-role envelope
 * defaults (IMP-00), call-site explicit pins (writer/repair/bakeoff), and —
 * before IMP-00 — the operator's personal config (the rolled-back campaign's
 * confound: `model = "gpt-5.6-sol"` reached every unpinned call). This module
 * makes the decision table explicit, versioned, and hashable:
 *
 *   role → task class → (profile matrix) → requested model + effort
 *   call-site explicit values ride ABOVE the matrix (recorded as their tier)
 *   the NORMAL profile is `baseline-55` and cannot change here — activation
 *   is IMP-13's package, gated on §16 bakeoff + §17–§19 evidence.
 *
 * Provider outcomes are DISJOINT (frozen taxonomy): a timeout is not a content
 * failure; a safeguard/refusal is never replayed-until-pass; a preflight
 * rejection never reaches the provider at all. Every spawn emits a
 * RouteResultV1 sidecar next to its effective-context manifest, carrying the
 * drift fingerprint that IMP-13's requalification triggers key on.
 */

import { hashCanonical } from "../contracts/contractUtil.js";
import type { AgentRole, EffortLevelV1 } from "../contracts/executionProfile.js";
import type { ProviderOutcomeV1, RouteResultV1, TaskClassV1 } from "../contracts/routeContracts.js";

/** Bumped on ANY change to the matrices/mapping below — part of the drift
 *  fingerprint, so a policy edit stales prior qualification evidence. */
export const ROUTE_POLICY_VERSION = "route-policy-v1.0";

/** The qualified baseline model (the ONLY production route until IMP-13). */
export const BASELINE_MODEL = "gpt-5.5";

/** Named routing profiles (plan §IMP-02 item 2). Only `baseline-55` may serve
 *  as the NORMAL profile in this package; the others exist so evaluation and
 *  (later, authorized) activation are configuration, not code edits. */
export type RouteProfileName =
  | "baseline-55"            // the qualified production default (normal)
  | "sol-high-candidate"     // evaluation candidate: SOL @ high
  | "sol-xhigh-candidate"    // evaluation candidate: SOL @ xhigh
  | "legacy-stack-diagnostic"   // Stage-D cell: legacy prompts (stack pinned elsewhere)
  | "sol-stack-diagnostic"      // Stage-D cell: SOL-native prompts
  | "confirmatory-explicit"  // Stage-C cells: model/effort pinned per cell spec
  | "judge-qualified"        // qualified judge panel routes (IMP-11)
  | "last-qualified-sol"     // rollback target once a SOL profile qualifies
  | "experimental-explicit"; // anything else, always call-site explicit

/** The one normal profile. A different default requires IMP-13's authorized
 *  activation path — never an edit here (static-pinned by tests). */
export const NORMAL_PROFILE: RouteProfileName = "baseline-55";

/** Role → task class (17-class union frozen in route contracts). */
export const ROLE_TASK_CLASS: Record<AgentRole, TaskClassV1> = {
  "research": "research-synthesis",
  "source-repair": "source-repair",
  "source-verify": "source-verification",
  "source-compiler": "source-repair",
  "compiler-polish": "routine-repair",
  "autopilot-repair": "routine-repair",
  "autopilot-scout": "scout",
  "qc-reviewer": "chapter-direct-read",
  "author-writer": "author-first-write",
  "author-repair": "routine-repair",
  "chapter-reviewer": "chapter-direct-read",
  "book-acceptance-reader": "acceptance",
  "author-evidence": "key-derivation",
  "shipped-control": "release-verification",
  "eval-reader": "chapter-direct-read",
  "eval-book": "acceptance",
  "bakeoff-candidate": "bakeoff-candidate",
  "bakeoff-judge": "bakeoff-judge",
  "bakeoff-aux": "bakeoff-candidate",
  "cli-adhoc": "scout",
};

type RouteCell = { model: string; effort: EffortLevelV1 };

/** The baseline matrix encodes TODAY's behavior exactly (plan item 3): the
 *  efforts each call site pins, with the qualified baseline model everywhere —
 *  no ambient inheritance, no silent low/medium lane changes before evaluation.
 *  Call-site explicit values (writer xhigh pin, evidence per-lane efforts,
 *  bakeoff specs) override per call and are recorded at their tier. */
const BASELINE_55: Record<TaskClassV1, RouteCell> = {
  "research-synthesis": { model: BASELINE_MODEL, effort: "high" },
  "source-repair": { model: BASELINE_MODEL, effort: "high" },
  "author-first-write": { model: BASELINE_MODEL, effort: "xhigh" },
  "author-regeneration": { model: BASELINE_MODEL, effort: "xhigh" },
  "routine-repair": { model: BASELINE_MODEL, effort: "xhigh" },
  "source-sensitive-repair": { model: BASELINE_MODEL, effort: "xhigh" },
  "chapter-direct-read": { model: BASELINE_MODEL, effort: "high" },
  "source-verification": { model: BASELINE_MODEL, effort: "high" },
  "tiebreak": { model: BASELINE_MODEL, effort: "high" },
  "acceptance": { model: BASELINE_MODEL, effort: "high" },
  "key-derivation": { model: BASELINE_MODEL, effort: "low" },
  "sweep": { model: BASELINE_MODEL, effort: "medium" },
  "scout": { model: BASELINE_MODEL, effort: "medium" },
  "red-team": { model: BASELINE_MODEL, effort: "high" },
  "release-verification": { model: BASELINE_MODEL, effort: "high" },
  "bakeoff-candidate": { model: BASELINE_MODEL, effort: "medium" },
  "bakeoff-judge": { model: BASELINE_MODEL, effort: "high" },
};

/** Candidate/rollback matrices are DATA for later authorized use — nothing in
 *  this package routes through them (the normal profile is pinned). SOL cells
 *  carry the split the plan hypothesizes (high ordinary / xhigh source-adjacent)
 *  purely as the starting spec the bakeoff must confirm or replace. */
const SOL_HIGH: Record<TaskClassV1, RouteCell> = Object.fromEntries(
  (Object.keys(BASELINE_55) as TaskClassV1[]).map((t) => [t, { model: "gpt-5.6-sol", effort: "high" as EffortLevelV1 }]),
) as Record<TaskClassV1, RouteCell>;

const SOL_XHIGH: Record<TaskClassV1, RouteCell> = Object.fromEntries(
  (Object.keys(BASELINE_55) as TaskClassV1[]).map((t) => [t, { model: "gpt-5.6-sol", effort: "xhigh" as EffortLevelV1 }]),
) as Record<TaskClassV1, RouteCell>;

const PROFILE_MATRICES: Record<RouteProfileName, Record<TaskClassV1, RouteCell> | "call-explicit"> = {
  "baseline-55": BASELINE_55,
  "sol-high-candidate": SOL_HIGH,
  "sol-xhigh-candidate": SOL_XHIGH,
  "legacy-stack-diagnostic": "call-explicit",
  "sol-stack-diagnostic": "call-explicit",
  "confirmatory-explicit": "call-explicit",
  "judge-qualified": "call-explicit",
  "last-qualified-sol": "call-explicit", // becomes a concrete matrix only when IMP-13 qualifies one
  "experimental-explicit": "call-explicit",
};

/** Rollback order (plan item 20): last-qualified SOL first, then the baseline
 *  as TEMPORARY emergency routing. Data only — selection is an IMP-13 decision. */
export const ROLLBACK_ORDER: readonly RouteProfileName[] = ["last-qualified-sol", "baseline-55"];

/** Baseline-exactness overrides (plan item 3: encode existing behavior EXACTLY).
 *  Three roles share a task class with a different pre-IMP-02 default effort —
 *  the matrix would silently change their cost/behavior, so the role-level
 *  value wins here until the bakeoff earns a change:
 *   - autopilot-repair ran high (routine-repair cell is xhigh for author-repair);
 *   - compiler-polish ran medium; cli-adhoc ran high (scout cell is medium). */
export const ROLE_EFFORT_OVERRIDES: Partial<Record<AgentRole, EffortLevelV1>> = {
  "autopilot-repair": "high",
  "compiler-polish": "medium",
  "cli-adhoc": "high",
};

const EFFORTS: readonly EffortLevelV1[] = ["minimal", "low", "medium", "high", "xhigh"];

export class RoutePreflightError extends Error {
  readonly classification: ProviderOutcomeV1 = "policy_preflight_failure";
}

export type ResolvedRoute = {
  taskClass: TaskClassV1;
  profileName: RouteProfileName;
  routePolicyVersion: string;
  model: string;
  effort: EffortLevelV1;
  /** Which precedence tier decided the values (recorded, never guessed). */
  tier: "call-explicit" | "normal-profile";
};

/** Resolve one call's route. Precedence (plan item 6): call-site explicit
 *  values (test injection / frozen bakeoff spec / operator pin all arrive here)
 *  → the approved NORMAL profile matrix. Partial explicitness is allowed
 *  (e.g. reviewers pin effort but not model) — each field records its source
 *  by construction: an explicit field wins, a missing one falls to the matrix. */
export function resolveRoute(args: {
  role: AgentRole;
  requestedModel?: string;
  requestedEffort?: string;
}): ResolvedRoute {
  const taskClass = ROLE_TASK_CLASS[args.role];
  if (!taskClass) throw new RoutePreflightError(`no task class mapped for role "${args.role}"`);
  const matrix = PROFILE_MATRICES[NORMAL_PROFILE];
  if (matrix === "call-explicit") throw new RoutePreflightError(`normal profile ${NORMAL_PROFILE} has no matrix — invalid policy state`);
  const cell = matrix[taskClass];

  if (args.requestedModel !== undefined && !isValidModelId(args.requestedModel)) {
    throw new RoutePreflightError(`invalid model id "${args.requestedModel}" — refusing to spawn (no silent fallback)`);
  }
  if (args.requestedEffort !== undefined && !EFFORTS.includes(args.requestedEffort as EffortLevelV1)) {
    throw new RoutePreflightError(
      `invalid reasoning effort "${args.requestedEffort}" (allowed: ${EFFORTS.join(", ")}; API-only "max" is NOT in the local union) — refusing to spawn`,
    );
  }
  const explicit = args.requestedModel !== undefined || args.requestedEffort !== undefined;
  return {
    taskClass,
    profileName: NORMAL_PROFILE,
    routePolicyVersion: ROUTE_POLICY_VERSION,
    model: args.requestedModel ?? cell.model,
    effort: (args.requestedEffort as EffortLevelV1) ?? ROLE_EFFORT_OVERRIDES[args.role] ?? cell.effort,
    tier: explicit ? "call-explicit" : "normal-profile",
  };
}

export function isValidModelId(id: string): boolean {
  return /^[a-z0-9][a-z0-9.-]{1,63}$/.test(id);
}

/** Stable requalification fingerprint (plan item 13 / IMP-13 drift triggers):
 *  any change to model identity, effort, policy version, execution profile,
 *  CLI version, or task class re-fingerprints the route. */
export function routeDriftFingerprint(args: {
  model: string;
  effort: string;
  taskClass: TaskClassV1;
  routePolicyVersion: string;
  executionProfileHash: string;
  cliVersion: string;
}): string {
  return hashCanonical({
    provider: "codex-cli",
    model: args.model,
    effort: args.effort,
    taskClass: args.taskClass,
    routePolicyVersion: args.routePolicyVersion,
    executionProfileHash: args.executionProfileHash,
    cliVersion: args.cliVersion,
  });
}

/** Codex refusal/safeguard marker list — deliberately EMPTY at v1: no observed
 *  local samples exist to calibrate on, and a guessy matcher would misclassify
 *  content failures as safeguards (the plan forbids conflation in BOTH
 *  directions). The taxonomy slot, the no-replay rule, and this hook ship now;
 *  IMP-11/IMP-13 calibrate the markers from real observed events. */
export const SAFEGUARD_MARKERS: readonly string[] = [];

export const RATE_MARKERS: readonly string[] = ["rate limit", "429", "capacity", "overloaded"];

/** Classify a spawn-layer provider outcome. DISJOINT by construction; the
 *  content-vs-semantic split above this layer lives in the IMP-01 attempt
 *  outcomes (validation_failed etc.), not here. */
export function classifyProviderOutcome(result: {
  completed: boolean;
  exitCode?: number;
  errorMessage?: string;
  stderr?: string;
  finalMessage?: string;
}): ProviderOutcomeV1 {
  if (!result.completed) {
    const msg = result.errorMessage ?? "";
    if (/timed out/i.test(msg)) return "timeout";
    return "infrastructure_failure";
  }
  const haystack = `${result.stderr ?? ""}\n${result.finalMessage ?? ""}`.toLowerCase();
  if (SAFEGUARD_MARKERS.some((m) => haystack.includes(m.toLowerCase()))) return "provider_safeguard_or_refusal";
  if ((result.exitCode ?? 0) !== 0 && RATE_MARKERS.some((m) => haystack.includes(m))) return "provider_rate_or_capacity";
  if ((result.exitCode ?? 0) !== 0) return "infrastructure_failure";
  return "content_completed";
}

/** Assemble the per-spawn RouteResultV1 sidecar (frozen contract). */
export function buildRouteResult(args: {
  role: AgentRole;
  resolved: ResolvedRoute;
  executionProfileHash: string;
  cliVersion: string;
  providerSessionId?: string;
  outcome: ProviderOutcomeV1;
}): RouteResultV1 {
  return {
    schema: "route-result-v1",
    taskClass: args.resolved.taskClass,
    profileName: args.resolved.profileName,
    routePolicyVersion: args.resolved.routePolicyVersion,
    requestedModel: args.resolved.model,
    requestedEffort: args.resolved.effort,
    aliasOrSnapshot: args.resolved.model, // codex exposes no resolved snapshot id locally; record the requested alias honestly
    executionProfileHash: args.executionProfileHash,
    cliVersion: args.cliVersion,
    ...(args.providerSessionId ? { providerSessionId: args.providerSessionId } : {}),
    outcome: args.outcome,
    driftFingerprint: routeDriftFingerprint({
      model: args.resolved.model,
      effort: args.resolved.effort,
      taskClass: args.resolved.taskClass,
      routePolicyVersion: args.resolved.routePolicyVersion,
      executionProfileHash: args.executionProfileHash,
      cliVersion: args.cliVersion,
    }),
  };
}

/** The full route matrix for docs/tests/audits: every role under the normal
 *  profile, with its task class and resolved cell. */
export function normalRouteMatrix(): Array<{ role: AgentRole; taskClass: TaskClassV1; model: string; effort: EffortLevelV1 }> {
  return (Object.keys(ROLE_TASK_CLASS) as AgentRole[]).map((role) => {
    const r = resolveRoute({ role });
    return { role, taskClass: r.taskClass, model: r.model, effort: r.effort };
  });
}
