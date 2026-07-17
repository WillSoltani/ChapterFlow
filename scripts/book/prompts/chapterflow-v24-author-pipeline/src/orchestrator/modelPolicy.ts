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
 *   the NORMAL profile is `provisional-56` — a 5.6-only production matrix
 *   (directive-1: GPT-5.5 removed as writer/reviewer/repair/fallback/baseline).
 *   Its model is the owner-ratified provisional default gpt-5.6-sol (D-9(b),
 *   ledger L-14), flagged PROVISIONAL_PENDING_WP-705 until the WP-705 bakeoff
 *   decision replaces it. Changing the winner is a one-line config edit here,
 *   never a matrix rewrite.
 *
 * Provider outcomes are DISJOINT (frozen taxonomy): a timeout is not a content
 * failure; a safeguard/refusal is never replayed-until-pass; a preflight
 * rejection never reaches the provider at all. Every spawn emits a
 * RouteResultV1 sidecar next to its effective-context manifest, carrying the
 * drift fingerprint that IMP-13's requalification triggers key on.
 */

import { hashCanonical } from "../contracts/contractUtil.js";
import type { AgentRole, EffortLevelV1 } from "../contracts/executionProfile.js";
import type { ChatgptAuthProofV1, ProviderOutcomeV1, RouteResultV1, TaskClassV1 } from "../contracts/routeContracts.js";

/** Bumped on ANY change to the matrices/mapping below — part of the drift
 *  fingerprint, so a policy edit stales prior qualification evidence. WP-302
 *  bumped v1.0 → v2.0 for the GPT-5.5 → 5.6 matrix cutover (directive-1); this
 *  intentionally stales all prior route qualification LOUDLY (WP-004 reconciles
 *  the stale campaign evidence). Typed `string` (not the narrow literal) so a
 *  future bump does not fracture the `typeof ROUTE_POLICY_VERSION` consumers. */
export const ROUTE_POLICY_VERSION: string = "route-policy-v2.0";

/** WP-705 owns the final production model decision (bakeoff evidence). Until its
 *  decision file lands, owner-ratified D-9(b) (ledger L-14) sets the provisional
 *  default. This marker is LOAD-BEARING: a test fails if it is removed before a
 *  WP-705 decision file replaces the constant below. */
export const PROVISIONAL_PENDING_WP705 = "PROVISIONAL_PENDING_WP-705" as const;

/** The winning model + decision status for the NORMAL profile — the ONE place a
 *  WP-705 config edit changes the production default (WP-302 scope item 2).
 *  directive-1 removed GPT-5.5 as writer/reviewer/repair/fallback/baseline; the
 *  provisional winner is gpt-5.6-sol (D-9(b)). Every normal-profile cell reads
 *  its model from `.model`, so changing the winner is a one-line edit here. */
export const NORMAL_PROFILE_MODEL: { readonly model: string; readonly status: string } = {
  model: "gpt-5.6-sol",
  status: PROVISIONAL_PENDING_WP705,
};

/** The normal-profile production model. Kept as the `BASELINE_MODEL` export for
 *  import stability across the pipeline; its VALUE is now the provisional 5.6
 *  default (the prior 5.5 baseline was deleted per directive-1). Typed `string` (not a literal)
 *  so consumers do not couple to a specific model id. WP-501 owns any rename of
 *  this symbol during the repo-wide 5.5-literal purge. */
export const BASELINE_MODEL: string = NORMAL_PROFILE_MODEL.model;

/** Named routing profiles (plan §IMP-02 item 2). Only `provisional-56` may serve
 *  as the NORMAL profile in this package; the others exist so evaluation and
 *  (later, authorized) activation are configuration, not code edits. The 5.6
 *  candidate profiles are DATA for the WP-703/704 bakeoff — naming one here does
 *  NOT route through it (directive-2: candidates gpt-5.6-sol/terra/luna). */
export type RouteProfileName =
  | "provisional-56"         // the provisional 5.6 production default (NORMAL; gpt-5.6-sol, PENDING WP-705)
  | "sol-high-candidate"     // bakeoff candidate: gpt-5.6-sol @ high (confirmed capability)
  | "sol-xhigh-candidate"    // bakeoff candidate: gpt-5.6-sol @ xhigh (confirmed capability)
  | "terra-candidate"        // bakeoff candidate: gpt-5.6-terra — capability UNCONFIRMED (WP-502); call-explicit
  | "luna-candidate"         // bakeoff candidate: gpt-5.6-luna — capability UNCONFIRMED (WP-502); call-explicit
  | "legacy-stack-diagnostic"   // Stage-D cell: legacy prompts (stack pinned elsewhere)
  | "sol-stack-diagnostic"      // Stage-D cell: SOL-native prompts
  | "confirmatory-explicit"  // Stage-C cells: model/effort pinned per cell spec
  | "judge-qualified"        // qualified judge panel routes (IMP-11)
  | "last-qualified-sol"     // rollback target once a 5.6 profile qualifies (WP-705)
  | "experimental-explicit"; // anything else, always call-site explicit

/** The one normal profile. A different default (or a WP-705-selected winner)
 *  requires the authorized activation path — never an edit here (static-pinned
 *  by tests). */
export const NORMAL_PROFILE: RouteProfileName = "provisional-56";

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

/** The NORMAL 5.6 production matrix (WP-302). The class→effort SHAPE is preserved
 *  byte-for-byte from the retired baseline-55 matrix (author write xhigh; direct
 *  read / acceptance / verification / research high; key-derivation low;
 *  sweep / scout medium) — WP-302 changed the MODEL (5.5 → provisional 5.6),
 *  never the effort assignments. The model comes from `BASELINE_MODEL`
 *  (= `NORMAL_PROFILE_MODEL.model`), so the winner stays a single config value,
 *  not a literal buried per cell. Call-site explicit values (writer xhigh pin,
 *  evidence per-lane efforts, bakeoff specs) override per call at their tier. */
const NORMAL_56: Record<TaskClassV1, RouteCell> = {
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

/** The 5.6 candidate family set for the WP-703/704 bakeoff (directive-2). DATA
 *  only — naming a candidate here does NOT route through it. `gpt-5.6-sol` is the
 *  confirmed provisional default; terra/luna capability is UNCONFIRMED and gated
 *  on WP-502 — the bakeoff must not treat them as a live matrix cell until then
 *  (their profiles below are `call-explicit`, never an asserted matrix). */
export const CANDIDATE_MODELS: readonly { readonly family: string; readonly capability: "confirmed" | "unconfirmed-pending-WP-502" }[] = [
  { family: "gpt-5.6-sol", capability: "confirmed" },
  { family: "gpt-5.6-terra", capability: "unconfirmed-pending-WP-502" },
  { family: "gpt-5.6-luna", capability: "unconfirmed-pending-WP-502" },
];

/** WP-504: the set of model ids a PRODUCTION 5.6 route may explicitly request —
 *  DERIVED from the candidate family set above (data owned by WP-302/501), never
 *  a second hand-kept list. By naming ONLY the 5.6 candidates it excludes the
 *  retired legacy baseline and every non-5.6 id by construction (directive-1), so
 *  no forbidden id can be a member: a request for anything outside this set is an
 *  UNSUPPORTED_MODEL_CONFIG at route resolution, BEFORE any spawn (see
 *  `resolveRoute({ requireSupportedModel })` and `preflightOperatorModelSelection`).
 *  Membership is a SEPARATE, EARLIER gate than capability: it says
 *  "this is one of the models the program routes"; the WP-502 probe later says
 *  "…and it actually exists with the required --output-schema / effort
 *  capability." A model can pass membership (terra/luna) and still fail the
 *  capability probe — both raise the SAME typed error. */
export const SUPPORTED_MODEL_IDS: ReadonlySet<string> = new Set(CANDIDATE_MODELS.map((c) => c.family));

/** True iff `id` is a member of the 5.6 candidate set (the models the program is
 *  allowed to route). Does NOT assert capability (that is the WP-502 probe). */
export function isSupportedModelId(id: string): boolean {
  return SUPPORTED_MODEL_IDS.has(id);
}

/** Candidate/rollback matrices are DATA for later authorized use — nothing in
 *  this package routes through them (the normal profile is pinned). The SOL
 *  candidate cells carry the split the plan hypothesizes (high ordinary / xhigh
 *  source-adjacent) purely as the starting spec the bakeoff must confirm or
 *  replace. terra/luna carry no asserted matrix until WP-502 confirms them. */
const SOL_HIGH: Record<TaskClassV1, RouteCell> = Object.fromEntries(
  (Object.keys(NORMAL_56) as TaskClassV1[]).map((t) => [t, { model: "gpt-5.6-sol", effort: "high" as EffortLevelV1 }]),
) as Record<TaskClassV1, RouteCell>;

const SOL_XHIGH: Record<TaskClassV1, RouteCell> = Object.fromEntries(
  (Object.keys(NORMAL_56) as TaskClassV1[]).map((t) => [t, { model: "gpt-5.6-sol", effort: "xhigh" as EffortLevelV1 }]),
) as Record<TaskClassV1, RouteCell>;

const PROFILE_MATRICES: Record<RouteProfileName, Record<TaskClassV1, RouteCell> | "call-explicit"> = {
  "provisional-56": NORMAL_56,
  "sol-high-candidate": SOL_HIGH,
  "sol-xhigh-candidate": SOL_XHIGH,
  "terra-candidate": "call-explicit", // gpt-5.6-terra capability pending WP-502; bakeoff pins explicitly
  "luna-candidate": "call-explicit",  // gpt-5.6-luna capability pending WP-502; bakeoff pins explicitly
  "legacy-stack-diagnostic": "call-explicit",
  "sol-stack-diagnostic": "call-explicit",
  "confirmatory-explicit": "call-explicit",
  "judge-qualified": "call-explicit",
  "last-qualified-sol": "call-explicit", // becomes a concrete matrix only when WP-705 qualifies one
  "experimental-explicit": "call-explicit",
};

/** Read-only view of a named profile's matrix (or `"call-explicit"`). For
 *  docs/tests/bakeoff wiring: candidate profiles are DATA, never the normal
 *  route (`resolveRoute` resolves ONLY the NORMAL_PROFILE matrix). */
export function profileMatrix(name: RouteProfileName): Record<TaskClassV1, RouteCell> | "call-explicit" {
  return PROFILE_MATRICES[name];
}

/** Rollback order: the last-qualified 5.6 profile first, then the provisional
 *  normal profile as the emergency floor. directive-1: NO GPT-5.5 fallback may
 *  appear here (the retired `baseline-55` entry is gone). DATA ONLY — there is no
 *  automatic traversal: a failed 5.6 model fail-closes with `UNSUPPORTED_MODEL_CONFIG`
 *  and an alternate is reached ONLY via `resolveModelFallback`'s explicit
 *  operator-supplied config. `last-qualified-sol` is a fail-closed placeholder
 *  until WP-705 qualifies a concrete 5.6 matrix. */
export const ROLLBACK_ORDER: readonly RouteProfileName[] = ["last-qualified-sol", NORMAL_PROFILE];

/**
 * IMP-22's pre-authoring risk decision is deliberately separate from the
 * NORMAL route matrix above.  It is consulted only after a qualified local
 * forward policy has been validated, and it chooses between that policy's two
 * explicit SOL writer pins.  Keeping the classifier here makes risk routing a
 * central deterministic decision instead of an author-card or environment
 * convention.
 */
export const FORWARD_AUTHOR_RISK_POLICY_VERSION = "forward-author-risk-policy-v1" as const;

export type ForwardAuthoringRiskSignalsV1 = {
  sparseSourceDetail: boolean;
  sourceBoundNamedClaimCount: number;
  disputedOrConflictingEvidence: boolean;
  causalTeachingClaims: boolean;
  difficultAttribution: boolean;
  difficultQuizDesign: boolean;
  crossChapterDependency: boolean;
  priorConsecutiveFailures: number;
  sourceIntegrityAdjudication: boolean;
  repeatedFailureDiagnosis: boolean;
  finalReleaseVerification: boolean;
};

export type ForwardAuthoringRiskDecisionV1 = {
  policyVersion: typeof FORWARD_AUTHOR_RISK_POLICY_VERSION;
  riskClass: "ordinary" | "high-risk";
  reasons: string[];
  signalsSha256: string;
};

const FORWARD_RISK_SIGNAL_KEYS = [
  "sparseSourceDetail",
  "sourceBoundNamedClaimCount",
  "disputedOrConflictingEvidence",
  "causalTeachingClaims",
  "difficultAttribution",
  "difficultQuizDesign",
  "crossChapterDependency",
  "priorConsecutiveFailures",
  "sourceIntegrityAdjudication",
  "repeatedFailureDiagnosis",
  "finalReleaseVerification",
] as const satisfies readonly (keyof ForwardAuthoringRiskSignalsV1)[];

/**
 * Classify before the writer is spawned.  Unknown fields and malformed counts
 * are refused so a caller cannot smuggle an output-informed exception into the
 * policy.  Three or more source-bound named claims, or two consecutive prior
 * failures, are the only numeric thresholds; every other frozen signal is
 * independently sufficient for xhigh.
 */
export function classifyForwardAuthoringRisk(value: ForwardAuthoringRiskSignalsV1): ForwardAuthoringRiskDecisionV1 {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new RoutePreflightError("forward author risk signals must be an object");
  }
  const keys = Object.keys(value).sort();
  const expected = [...FORWARD_RISK_SIGNAL_KEYS].sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    throw new RoutePreflightError("forward author risk signals must contain exactly the frozen policy fields");
  }
  for (const key of FORWARD_RISK_SIGNAL_KEYS) {
    if (key === "sourceBoundNamedClaimCount" || key === "priorConsecutiveFailures") continue;
    if (typeof value[key] !== "boolean") throw new RoutePreflightError(`forward author risk signal ${key} must be boolean`);
  }
  for (const key of ["sourceBoundNamedClaimCount", "priorConsecutiveFailures"] as const) {
    if (!Number.isSafeInteger(value[key]) || value[key] < 0) {
      throw new RoutePreflightError(`forward author risk signal ${key} must be a non-negative safe integer`);
    }
  }

  const reasons: string[] = [];
  if (value.sparseSourceDetail) reasons.push("sparse_source_detail");
  if (value.sourceBoundNamedClaimCount >= 3) reasons.push("several_source_bound_named_claims");
  if (value.disputedOrConflictingEvidence) reasons.push("disputed_or_conflicting_evidence");
  if (value.causalTeachingClaims) reasons.push("causal_teaching_claims");
  if (value.difficultAttribution) reasons.push("difficult_attribution");
  if (value.difficultQuizDesign) reasons.push("difficult_quiz_design");
  if (value.crossChapterDependency) reasons.push("cross_chapter_dependency");
  if (value.priorConsecutiveFailures >= 2) reasons.push("prior_repeated_failure");
  if (value.sourceIntegrityAdjudication) reasons.push("source_integrity_adjudication");
  if (value.repeatedFailureDiagnosis) reasons.push("repeated_failure_diagnosis");
  if (value.finalReleaseVerification) reasons.push("final_release_verification");
  return {
    policyVersion: FORWARD_AUTHOR_RISK_POLICY_VERSION,
    riskClass: reasons.length > 0 ? "high-risk" : "ordinary",
    reasons,
    signalsSha256: hashCanonical(value),
  };
}

/** Effort-exactness overrides (plan item 3: encode existing behavior EXACTLY).
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

/** WP-504 halt code. DISTINCT from the frozen, DISJOINT provider-outcome
 *  taxonomy (`ProviderOutcomeV1`, which classifies what a provider DID): this
 *  classifies an operator/config REQUEST the pipeline refuses BEFORE any provider
 *  is reached. The terminal command (WP-601) maps it to a truthful non-zero exit
 *  (a usage-level bad flag → exit 2; a run-start capability/rollback halt →
 *  exit 1); run-start preflight (WP-602) surfaces it. */
export const UNSUPPORTED_MODEL_CONFIG = "UNSUPPORTED_MODEL_CONFIG" as const;

/** Which unsupported-config check failed — one discriminant so every entry point
 *  reports the SAME shape and the CLI can pick a truthful exit. */
export type UnsupportedModelConfigReason =
  | "unsupported-model"     // requested model malformed OR not in the 5.6 candidate set (directive-1)
  | "unsupported-effort"    // requested reasoning effort not in the local union (e.g. API-only "max")
  | "capability-absent"     // the WP-502 capability probe found a required capability missing
  | "unqualified-rollback"  // a rollback / last-qualified-sol target with no WP-705 qualification (fail-closed placeholder)
  | "no-fallback";          // selected model failed and NO explicit alternate config was supplied (no silent substitution)

/** WP-504: the ONE typed config-refusal, raised at route resolution BEFORE any
 *  spawn. A SUBCLASS of `RoutePreflightError` (NOT a second parallel error), so
 *  every existing `instanceof RoutePreflightError` fail-closed check still catches
 *  it and the frozen `policy_preflight_failure` provider-outcome classification is
 *  inherited unchanged (directive-4: align with the existing `max`-effort
 *  preflight, don't fork the taxonomy). `code` is the halt code; `reason`,
 *  `failingModel`, and `failingCheck` name EXACTLY what was refused (no silent
 *  degradation). There is NO fallback branch inside this error — the pipeline
 *  fails closed; an alternate 5.6 candidate is reachable ONLY by explicit operator
 *  config (see `resolveModelFallback`). */
export class UnsupportedModelConfigError extends RoutePreflightError {
  readonly code = UNSUPPORTED_MODEL_CONFIG;
  readonly reason: UnsupportedModelConfigReason;
  readonly failingCheck: string;
  readonly failingModel?: string;
  constructor(args: { reason: UnsupportedModelConfigReason; failingCheck: string; failingModel?: string; detail?: string }) {
    const named = args.failingModel !== undefined ? ` model "${args.failingModel}"` : "";
    super(`${UNSUPPORTED_MODEL_CONFIG} [${args.reason}]:${named} failed check "${args.failingCheck}"${args.detail !== undefined ? ` — ${args.detail}` : ""} (no silent fallback — halt)`);
    this.name = "UnsupportedModelConfigError";
    this.reason = args.reason;
    this.failingCheck = args.failingCheck;
    if (args.failingModel !== undefined) this.failingModel = args.failingModel;
  }
}

/** Factory the WP-502 capability probe (and the rollback policy) call so every
 *  unsupported-config halt is the SAME typed error. WP-502 executes the live
 *  probe and, on an absent capability, raises
 *  `unsupportedModelConfig({ reason: "capability-absent", failingModel,
 *   failingCheck: "codex exec --output-schema / effort capability probe", detail })`.
 *  WP-504 DEFINES the error here; WP-502 RAISES it at run start. */
export function unsupportedModelConfig(args: { reason: UnsupportedModelConfigReason; failingCheck: string; failingModel?: string; detail?: string }): UnsupportedModelConfigError {
  return new UnsupportedModelConfigError(args);
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
  /** WP-504: when true (the operator boundary — CLI `--model`/`--effort`, run-start
   *  preflight, capability pre-gate), an EXPLICIT model must be a member of the 5.6
   *  candidate set or the call fails closed with `UNSUPPORTED_MODEL_CONFIG`. Default
   *  false preserves the provider-agnostic decision recorder that the legacy
   *  multi-provider router uses to dispatch (and honestly record) an explicit
   *  foreign-provider model (e.g. a claude id on anthropic-cli), and the bakeoff /
   *  historical qualification replays that legitimately evaluate non-normal
   *  candidates. Effort-union and model-FORMAT validation are UNCONDITIONAL either
   *  way — an out-of-union effort ("max") or a malformed id always fails closed. */
  requireSupportedModel?: boolean;
}): ResolvedRoute {
  const taskClass = ROLE_TASK_CLASS[args.role];
  if (!taskClass) throw new RoutePreflightError(`no task class mapped for role "${args.role}"`);
  const matrix = PROFILE_MATRICES[NORMAL_PROFILE];
  if (matrix === "call-explicit") throw new RoutePreflightError(`normal profile ${NORMAL_PROFILE} has no matrix — invalid policy state`);
  const cell = matrix[taskClass];

  if (args.requestedModel !== undefined) {
    if (!isValidModelId(args.requestedModel)) {
      throw new UnsupportedModelConfigError({
        reason: "unsupported-model",
        failingModel: args.requestedModel,
        failingCheck: "well-formed model id",
        detail: "refusing to spawn (no silent fallback)",
      });
    }
    if (args.requireSupportedModel && !isSupportedModelId(args.requestedModel)) {
      throw new UnsupportedModelConfigError({
        reason: "unsupported-model",
        failingModel: args.requestedModel,
        failingCheck: "member of the 5.6 candidate set",
        detail: `allowed: ${[...SUPPORTED_MODEL_IDS].join(", ")} (directive-1: 5.6 candidates only — no legacy baseline, no non-5.6 route)`,
      });
    }
  }
  if (args.requestedEffort !== undefined && !EFFORTS.includes(args.requestedEffort as EffortLevelV1)) {
    throw new UnsupportedModelConfigError({
      reason: "unsupported-effort",
      failingCheck: "member of the local reasoning-effort union",
      detail: `requested "${args.requestedEffort}"; allowed: ${EFFORTS.join(", ")}; API-only "max" is NOT in the local union — refusing to spawn`,
    });
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

/**
 * WP-504 — the fallback / rollback SEMANTICS (directive-1: no 5.5; directive-4:
 * no silent behavior, no unbounded loops). The pipeline has NO automatic model
 * substitution: when the selected 5.6 model fails preflight or the WP-502
 * capability probe, the run HALTS with `UNSUPPORTED_MODEL_CONFIG`. This function
 * encodes the ONLY escape and is a PURE single decision — it never iterates over
 * models, so there is structurally no "retry on the next model" loop.
 *
 *   • No explicit alternate supplied            → HALT (`no-fallback`).
 *   • `last-qualified-sol`                       → HALT (`unqualified-rollback`) —
 *     a fail-closed placeholder until WP-705 lands both a decision file AND a
 *     concrete 5.6 matrix; this build carries neither.
 *   • An explicit alternate that is `call-explicit` or routes to any non-candidate
 *     model                              → HALT (never reaches the retired baseline).
 *   • An explicit alternate whose CONCRETE matrix routes only to 5.6 candidates
 *                                                → accepted (the ONLY success path;
 *     reachable ONLY via an operator-supplied `explicitAlternateProfile`, never
 *     an ambient default).
 *
 * `ROLLBACK_ORDER` remains DATA (docs/tests); selecting from it is this explicit,
 * operator-gated decision, never a silent traversal.
 */
export function resolveModelFallback(args: {
  failingModel: string;
  failingCheck: string;
  /** ONLY an operator-supplied override reaches an alternate; undefined ⇒ HALT. */
  explicitAlternateProfile?: RouteProfileName;
  /** Whether a WP-705 decision file exists for `last-qualified-sol` (still HALTs
   *  until the matrix is authored — reported in the halt detail). */
  lastQualifiedSolDecisionFilePresent?: boolean;
}): { profileName: RouteProfileName; models: readonly string[] } {
  const alt = args.explicitAlternateProfile;

  if (alt === undefined) {
    throw new UnsupportedModelConfigError({
      reason: "no-fallback",
      failingModel: args.failingModel,
      failingCheck: args.failingCheck,
      detail: "no explicit alternate model config was supplied — the pipeline does not fall back to another model",
    });
  }

  if (alt === "last-qualified-sol") {
    throw new UnsupportedModelConfigError({
      reason: "unqualified-rollback",
      failingModel: args.failingModel,
      failingCheck: "WP-705 qualification (decision file + concrete 5.6 matrix) for last-qualified-sol",
      detail: args.lastQualifiedSolDecisionFilePresent
        ? "a WP-705 decision file is present but this build carries no last-qualified-sol matrix — WP-705 authors it before this rollback can route"
        : "last-qualified-sol is a fail-closed placeholder — no WP-705 qualification file exists yet",
    });
  }

  const mtx = profileMatrix(alt);
  if (mtx === "call-explicit") {
    throw new UnsupportedModelConfigError({
      reason: "unqualified-rollback",
      failingModel: args.failingModel,
      failingCheck: `explicit alternate profile "${alt}" has a concrete routable matrix`,
      detail: "call-explicit profiles carry no matrix to route — pin a concrete 5.6 candidate profile",
    });
  }
  const models = [...new Set(Object.values(mtx).map((c) => c.model))];
  const forbidden = models.filter((m) => !isSupportedModelId(m));
  if (forbidden.length > 0) {
    throw new UnsupportedModelConfigError({
      reason: "unsupported-model",
      failingCheck: `explicit alternate profile "${alt}" routes only to 5.6 candidates`,
      detail: `profile routes to non-candidate model(s): ${forbidden.join(", ")}`,
    });
  }
  return { profileName: alt, models };
}

/**
 * WP-504 — the operator-selection boundary. The CLI `--model`/`--effort` handler
 * (WP-601) and run-start preflight (WP-602) call THIS to validate an operator's
 * model/effort selection BEFORE any authoring. It funnels through the ONE
 * validator (`resolveRoute`, `requireSupportedModel: true`) so this boundary, the
 * author route, and every other route resolution raise the IDENTICAL typed
 * `UnsupportedModelConfigError` for the same unsupported config. On success it
 * echoes back the operator's RAW selection (each role's own `resolveRoute`
 * applies it downstream); on failure it throws before returning — so no spawn can
 * follow. The neutral `cli-adhoc` role reaches the validator without pinning a
 * production role.
 */
export function preflightOperatorModelSelection(args: {
  model?: string;
  effort?: string;
}): { model?: string; effort?: EffortLevelV1 } {
  resolveRoute({
    role: "cli-adhoc",
    requestedModel: args.model,
    requestedEffort: args.effort,
    requireSupportedModel: true,
  });
  return {
    ...(args.model !== undefined ? { model: args.model } : {}),
    ...(args.effort !== undefined ? { effort: args.effort as EffortLevelV1 } : {}),
  };
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

/** Narrow explicit refusal classifier shared by route provenance and the
 * reviewer adapter. This does not populate the uncalibrated provider-marker
 * registry: it recognizes only direct refusal declarations in the final text
 * or the already-frozen explicit transport phrases. */
export function explicitRefusalSignal(args: {
  finalMessage?: string;
  transport?: string;
}): string | null {
  const final = (args.finalMessage ?? "").trim();
  if (/^(?:i(?:'m| am) sorry\b[\s\S]{0,160}\b(?:cannot|can't|unable|won't)|i (?:cannot|can't|am unable|won't)\b|unable to comply\b|request (?:was )?refused\b)/i.test(final)) {
    return "final output is a refusal";
  }
  if (/\b(?:provider safeguard|safeguard triggered|safety refusal|policy refusal|refused by (?:the )?provider)\b/i.test(args.transport ?? "")) {
    return "provider reported a safeguard/refusal";
  }
  return null;
}

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
  if (explicitRefusalSignal({ finalMessage: result.finalMessage, transport: haystack }) !== null) {
    return "provider_safeguard_or_refusal";
  }
  if (SAFEGUARD_MARKERS.some((m) => haystack.includes(m.toLowerCase()))) return "provider_safeguard_or_refusal";
  if ((result.exitCode ?? 0) !== 0 && RATE_MARKERS.some((m) => haystack.includes(m))) return "provider_rate_or_capacity";
  if ((result.exitCode ?? 0) !== 0) return "infrastructure_failure";
  return "content_completed";
}

/** Assemble the per-spawn RouteResultV1 sidecar (frozen contract). `authProof`
 *  is the envelope's fail-closed subscription-auth proof: present ⇒ this spawn
 *  ran on the ChatGPT-subscription codex exec route; absent ⇒ an
 *  injected-runner test double that never reached a provider. Both stamp
 *  `apiFallbackAllowed: false` — no fallback branch exists in the broker. */
export function buildRouteResult(args: {
  role: AgentRole;
  resolved: ResolvedRoute;
  executionProfileHash: string;
  cliVersion: string;
  providerSessionId?: string;
  outcome: ProviderOutcomeV1;
  authProof?: ChatgptAuthProofV1;
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
    executionRoute: args.authProof ? "codex_exec_chatgpt_subscription" : "injected_test_runner",
    authMode: args.authProof ? "chatgpt" : "test",
    apiKeyPresent: false,
    apiFallbackAllowed: false,
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
