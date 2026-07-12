/**
 * IMP-20 WP-B6 — per-role judge-qualification registry, fail-closed role-set
 * gate, and frozen judge selection (design §F).
 *
 * This module RETIRES the monolithic single-boolean judge gate (E-06): a profile
 * is qualified independently per review lane (reader / source / quiz), and a
 * profile may qualify for one role while failing another. Security is NOT
 * measured here — it is INHERITED from the bound Stage-Q Layer-O v3 qualification
 * (LN-08 delegates the security boundary to Layer-O); a profile absent from that
 * panel records NOT_TESTED, never an assumed pass.
 *
 * Three fail-closed guarantees are enforced:
 *  1. E-07 underpowered rule — a SOFT (non-zero-miss) blocking percentage whose
 *     per-capability denominator falls below the frozen minimum is REFUSED as
 *     underpowered (a distinct outcome), never silently passed on a tiny num/den.
 *     A `0.85` bar over four cases (which would collapse to a hidden 4/4) is
 *     refused. Vacuous `den === 0` passes are guarded for every metric class.
 *  2. `assertRoleSetReady` throws when a required role lacks a qualified primary,
 *     a qualified backup, an independent source adjudicator (or a declared blind
 *     human path), or a qualified quiz semantic adjudicator.
 *  3. `selectRoleJudges` freezes the judge choice BEFORE any candidate output and
 *     never tie-breaks by model family. A single-qualifier safety-critical role
 *     with no independent adjudication path stays BLOCKED.
 *
 * PURE logic only: no file I/O, no ambient environment, no model calls, no
 * canonical state references. It compiles against the Wave-A frozen shapes in
 * reviewLaneTypes.ts (WP-A2) and the registered JudgeCapabilityQualificationV1
 * contract (WP-A1), so producers and the recovery conductor share one signature.
 */

import { MigrationGuardError } from "./guards.js";
import {
  MIN_SOFT_DENOMINATOR,
  ROLE_JUDGE_SELECTION_SCHEMA,
  ROLE_QUALIFICATION_OUTCOME_SCHEMA,
  type RecoveryRoleThresholdsV1,
  type RequiredRoleSetV1,
  type ReviewLaneRole,
  type RoleJudgeSelectionV1,
  type RoleMetricDenominatorsV1,
  type RoleMetricRatesV1,
  type RoleQualificationOutcomeV1,
  type RoleQualificationRegistryV1,
  type RoleQualificationStatus,
} from "./reviewLaneTypes.js";
import type { EffortLevelV1 } from "../../contracts/executionProfile.js";
import type { JudgeCapabilityQualificationV1 } from "../../contracts/judgeCapabilityQualification.js";

// ── role → registry status field mapping ──────────────────────────────────────

/** The JudgeCapabilityQualificationV1 field that carries a lane's per-role
 *  qualification status. Security is inherited separately, never a review lane. */
const ROLE_STATUS_FIELD: Record<
  ReviewLaneRole,
  "readerExperience" | "sourceIntegrity" | "quizIntegrity"
> = {
  reader: "readerExperience",
  source: "sourceIntegrity",
  quiz: "quizIntegrity",
};

/**
 * Roles for which a single qualified profile is NOT sufficient because the lane
 * carries an external-truth blocking verdict and needs an INDEPENDENT
 * adjudicator. The source lane blocks fabrication / causal-overreach /
 * source-contradiction, so a lone source qualifier with no independent
 * adjudication path keeps the campaign blocked. Reader is a craft lane; the quiz
 * lane already carries an independent DETERMINISTIC checker (answer-tell + key
 * arithmetic) alongside its semantic adjudicator, so neither triggers the
 * single-qualifier block on its own.
 */
const SAFETY_CRITICAL_SELECTION_ROLES: ReadonlySet<ReviewLaneRole> = new Set<ReviewLaneRole>(["source"]);

// ── §F — per-role qualification with the E-07 underpowered rule ────────────────

/**
 * Qualify ONE profile for ONE review lane against the role's frozen thresholds.
 *
 * Frozen behavior (design §F / E-07):
 *  - A SOFT bar (`zeroMiss === false`) whose denominator is below
 *    `max(MIN_SOFT_DENOMINATOR, bar.minDenominator)` is REFUSED as underpowered:
 *    it is added to `underpoweredMetrics` and is NEITHER a pass nor a genuine
 *    fail. A `0.85`-over-4 family (den 4 < 10) is refused even though 4/4 would
 *    numerically clear 0.85.
 *  - A reserved zero-miss bar (`zeroMiss === true`, e.g. fabrication /
 *    causal-overreach / source-contradiction / wrong quiz key) fails on any
 *    single miss regardless of denominator, and CANNOT be certified over zero
 *    (or unmeasured) cases — a `den === 0` reserved category is a hard fail.
 *  - Status precedence is fail-closed: a well-powered genuine failure yields
 *    NOT_QUALIFIED; otherwise an underpowered soft metric yields NOT_TESTED (a
 *    verdict distinct from a genuine NOT_QUALIFIED); only a fully-powered clean
 *    sweep yields QUALIFIED.
 */
export function qualifyRole(
  role: ReviewLaneRole,
  metrics: RoleMetricRatesV1,
  thresholds: RecoveryRoleThresholdsV1,
  denominators: RoleMetricDenominatorsV1,
): RoleQualificationOutcomeV1 {
  const roleBars = thresholds[role] ?? {};
  const underpoweredMetrics: string[] = [];
  const failedThresholds: string[] = [];

  for (const [metricId, bar] of Object.entries(roleBars)) {
    const den = denominators[metricId] ?? 0;
    const rate = metrics[metricId];
    const measured = typeof rate === "number" && Number.isFinite(rate);

    if (bar.zeroMiss) {
      // Reserved zero-miss category: any single miss fails; a reserved category
      // with no cases (or no measurement) cannot be certified — fail closed.
      if (den <= 0 || !measured || (rate as number) < bar.minRate) {
        failedThresholds.push(metricId);
      }
      continue;
    }

    // Soft blocking percentage — enforce the E-07 minimum denominator first, so
    // a tiny-n masquerade never counts as a pass OR a genuine fail. This also
    // guards the vacuous `den === 0` pass.
    const minDen = Math.max(MIN_SOFT_DENOMINATOR, bar.minDenominator);
    if (den < minDen) {
      underpoweredMetrics.push(metricId);
      continue;
    }
    if (!measured || (rate as number) < bar.minRate) {
      failedThresholds.push(metricId);
    }
  }

  const refusedUnderpowered = underpoweredMetrics.length > 0;
  let status: RoleQualificationStatus;
  if (failedThresholds.length > 0) {
    status = "NOT_QUALIFIED";
  } else if (refusedUnderpowered) {
    status = "NOT_TESTED";
  } else {
    status = "QUALIFIED";
  }

  return {
    schema: ROLE_QUALIFICATION_OUTCOME_SCHEMA,
    role,
    status,
    refusedUnderpowered,
    underpoweredMetrics,
    failedThresholds,
  };
}

// ── §F — security-boundary inheritance from Stage-Q Layer-O v3 ─────────────────

/**
 * The read-only Stage-Q Layer-O v3 qualification result the security boundary is
 * inherited from (LN-08). A minimal projection of
 * `STAGE-Q-V3-QUALIFICATION-RESULT.json` — this module never reads it from disk;
 * the parsed result is injected by the caller.
 */
export type LayerOV3QualificationResultV1 = {
  result: string;
  judges: Array<{ judge: string; qualified: boolean }>;
};

/**
 * Inherit the `securityBoundary` status for a profile from the bound Layer-O v3
 * panel: a profile present in the panel AND qualified there inherits QUALIFIED;
 * every other profile (a candidate that never ran through Layer-O) records
 * NOT_TESTED. Security is NEVER re-measured by a review lane. The lookup keys on
 * the panel profile id ("<model>@<effort>").
 */
export function inheritSecurityBoundary(
  profileId: string,
  layerO: LayerOV3QualificationResultV1,
): RoleQualificationStatus {
  const entry = layerO.judges.find((j) => j.judge === profileId);
  return entry && entry.qualified === true ? "QUALIFIED" : "NOT_TESTED";
}

// ── §F — assemble a registered JudgeCapabilityQualificationV1 registry entry ───

/**
 * Compose the three per-role `qualifyRole` outcomes plus the inherited security
 * boundary into one registered JudgeCapabilityQualificationV1 registry entry.
 * The four capabilities remain independent — a profile may carry mixed statuses.
 */
export function assembleJudgeQualification(args: {
  profileId: string;
  model: string;
  effort: EffortLevelV1;
  readerOutcome: RoleQualificationOutcomeV1;
  sourceOutcome: RoleQualificationOutcomeV1;
  quizOutcome: RoleQualificationOutcomeV1;
  securityBoundary: RoleQualificationStatus;
  evidenceHashes: string[];
  corpusHashes: string[];
  instrumentHashes: string[];
  qualifiedAt: string;
}): JudgeCapabilityQualificationV1 {
  return {
    profileId: args.profileId,
    model: args.model,
    effort: args.effort,
    readerExperience: args.readerOutcome.status,
    sourceIntegrity: args.sourceOutcome.status,
    quizIntegrity: args.quizOutcome.status,
    securityBoundary: args.securityBoundary,
    evidenceHashes: args.evidenceHashes,
    corpusHashes: args.corpusHashes,
    instrumentHashes: args.instrumentHashes,
    qualifiedAt: args.qualifiedAt,
  };
}

// ── §F — fail-closed required-role-set gate ───────────────────────────────────

function countQualified(registry: RoleQualificationRegistryV1, role: ReviewLaneRole): number {
  const field = ROLE_STATUS_FIELD[role];
  return registry.profiles.filter((p) => p[field] === "QUALIFIED").length;
}

/**
 * The fail-closed gate the RECOVERY conductor calls before any candidate output.
 * Throws MigrationGuardError when the registry cannot satisfy the required role
 * set (design §F "Required production/bakeoff roles"):
 *  - reader: a qualified primary AND a qualified backup (two distinct profiles);
 *  - source: a qualified primary AND EITHER an independent adjudicator (a second
 *    qualified source profile) OR a declared blind-human adjudication path;
 *  - quiz: the deterministic checker (a code path, structurally always present)
 *    AND a qualified semantic adjudicator.
 * Only the requirements flagged `true` in `requiredRoles` are enforced; an
 * unqualified UNUSED profile blocks nothing.
 */
export function assertRoleSetReady(
  registry: RoleQualificationRegistryV1,
  requiredRoles: RequiredRoleSetV1,
): void {
  const readerQ = countQualified(registry, "reader");
  const sourceQ = countQualified(registry, "source");
  const quizQ = countQualified(registry, "quiz");

  // Reader — primary + distinct backup.
  if (requiredRoles.reader.primary && readerQ < 1) {
    throw new MigrationGuardError(
      "role set not ready: reader lane has no qualified primary judge",
    );
  }
  if (requiredRoles.reader.backup && readerQ < 2) {
    throw new MigrationGuardError(
      "role set not ready: reader lane needs a qualified backup judge distinct from the primary",
    );
  }

  // Source — primary + independent adjudication (a second qualified model OR a
  // declared blind-human path). A single source qualifier with no independent
  // path is a safety-critical block.
  if (requiredRoles.source.primary && sourceQ < 1) {
    throw new MigrationGuardError(
      "role set not ready: source lane has no qualified primary judge",
    );
  }
  if (requiredRoles.source.independentAdjudicator) {
    const hasIndependentModel = sourceQ >= 2;
    const hasBlindHumanPath = requiredRoles.source.blindHumanAdjudicationPath === true;
    if (!hasIndependentModel && !hasBlindHumanPath) {
      throw new MigrationGuardError(
        "role set not ready: safety-critical source lane needs an independent adjudicator " +
          "(a second qualified profile) or a declared blind-human adjudication path",
      );
    }
  }

  // Quiz — deterministic checker (always present as a code path) + a qualified
  // semantic adjudicator.
  if (requiredRoles.quiz.semanticAdjudicator && quizQ < 1) {
    throw new MigrationGuardError(
      "role set not ready: quiz lane has no qualified semantic adjudicator",
    );
  }
}

// ── §F — frozen judge selection (before candidate outputs) ─────────────────────

function blockedSelection(
  role: ReviewLaneRole,
  primaryProfileId: string | null,
  reason: string,
  rationale: string[],
): RoleJudgeSelectionV1 {
  return {
    schema: ROLE_JUDGE_SELECTION_SCHEMA,
    role,
    status: "BLOCKED",
    primaryProfileId,
    backupProfileId: null,
    blockedReason: reason,
    selectionRationale: rationale,
  };
}

/**
 * Freeze the judge choice for a role BEFORE any candidate output.
 *
 * The registered registry entries carry per-role qualification status but no
 * numeric alignment / false-positive / unresolved / invocation metrics, so among
 * the qualified profiles the selection is by a STABLE, family-agnostic order
 * (profile id). The frozen policy — highest held-out alignment, then lower
 * high-severity FP rate, then lower unresolved rate, then lower invocation count,
 * NEVER model family — is recorded in `selectionRationale`.
 *
 * A safety-critical role (source) with only one qualified profile and no
 * independent adjudication path is returned BLOCKED, so the campaign stays
 * blocked rather than routing a lone judge onto a truth-bearing lane.
 */
export function selectRoleJudges(
  registry: RoleQualificationRegistryV1,
  role: ReviewLaneRole,
): RoleJudgeSelectionV1 {
  const field = ROLE_STATUS_FIELD[role];
  const qualified = registry.profiles.filter((p) => p[field] === "QUALIFIED");
  const ordered = [...qualified].sort((a, b) => a.profileId.localeCompare(b.profileId));

  const rationale: string[] = [
    "policy: highest held-out alignment, then lower high-severity false-positive rate, " +
      "then lower unresolved rate, then lower invocation count; never tie-broken by model family",
    "frozen before any candidate output; deterministic stable order over qualified profiles",
    `qualified profiles for "${role}": ${ordered.map((p) => p.profileId).join(", ") || "(none)"}`,
  ];

  if (ordered.length === 0) {
    return blockedSelection(role, null, `no profile qualifies for the "${role}" role`, rationale);
  }

  if (SAFETY_CRITICAL_SELECTION_ROLES.has(role) && ordered.length < 2) {
    return blockedSelection(
      role,
      ordered[0].profileId,
      `only one qualified profile for safety-critical role "${role}" and no independent adjudication path`,
      rationale,
    );
  }

  return {
    schema: ROLE_JUDGE_SELECTION_SCHEMA,
    role,
    status: "SELECTED",
    primaryProfileId: ordered[0].profileId,
    backupProfileId: ordered.length >= 2 ? ordered[1].profileId : null,
    blockedReason: null,
    selectionRationale: rationale,
  };
}
