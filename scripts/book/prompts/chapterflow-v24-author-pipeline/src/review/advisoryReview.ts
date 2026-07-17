/**
 * advisoryReview (WP-403) — the split-lane reviewer rescoped to a SINGLE advisory
 * cross-model pass whose findings feed bounded repair and NEVER block publish.
 *
 * ── WHY THIS MODULE EXISTS ────────────────────────────────────────────────────
 *
 * The IMP-20 split lanes (reader / source / quiz) compose a deterministic
 * `AggregatedChapterReviewV1.finalStatus` that can still be BLOCK/REVISE
 * (`readerDecisionPolicy` v3 only demoted SOME reader/quiz signals to escalation —
 * a source/composite path still forces REVISE/BLOCK). Per rt-D3 the review lane
 * must be SEVERED from the publish gate entirely: the D7 rubric-audit ship gate
 * (WP-401) is now the ONLY ship gate, plus the deterministic floor. This module
 * turns the review verdict into two harmless things — bounded-repair INPUTS and
 * advisory telemetry — and it is TYPE-IMPOSSIBLE to read a ship-blocking bit off
 * its disposition (`shipBlocking` is the literal `false`).
 *
 * The aggregator (`aggregateChapterReview.ts`) still COMPUTES `finalStatus`; this
 * module is the boundary that guarantees that computation cannot reach promote /
 * publish as a blocker. The only ship-path consumer of a split-lane `finalStatus`
 * is the WP-202-quarantined `forwardChapterConductor.ts`, which has ZERO runtime
 * reach into promote/publish (tests/campaign-quarantine.test.ts); the promote /
 * publish path does not import the aggregator at all (tests/advisory-review.test.ts
 * locks that in). This module is the forward-looking advisory wiring for when the
 * single advisory pass is run on the author-first path.
 *
 * ── WHAT THIS MODULE OWNS (WP-403) ────────────────────────────────────────────
 *
 *   1. Advisory severance + repair-input mapping — a review verdict (any status)
 *      becomes complaint strings + frozen `RepairFindingV1[]` that feed the
 *      WP-404 cap-2 bounded-repair loop (`repairPatch.findingsFromComplaints`),
 *      never a promote blocker.
 *   2. Different-model-from-writer role selection seeded from the frozen v6 set
 *      (L-15) MINUS the void 5.5-era adjudicator (the retired GPT baseline; no-5.5 directive), with the D-2/M9 sol self-review
 *      fallback (run sol at a DIFFERENT effort, reduced finding weight) and a run-
 *      ledger record of the reviewer profiles.
 *   3. Advisory-finding-precision tracking with the D-2 removal condition
 *      (precision persistently < 50% → drop the lane).
 *
 * Source-EQUIPPED enforcement (WP-403 item 2) lives in the source lane runtime
 * (`sourceIntegrityReview.ts`, `assertSourceReviewPacketEquipped`); scale pinning
 * (item 4) lives in the lane contracts (`readerExperienceReview.REVIEW_SCORE_SCALE`).
 *
 * This module is PURE — no fs, no env, no spawn, no model call.
 */

import type { AggregatedChapterReviewV1 } from "../contracts/aggregateChapterReview.js";
import { type RepairFindingV1, validateRepairFinding } from "../contracts/repairContracts.js";
import { findingsFromComplaints } from "../orchestrator/repairPatch.js";
import { REVIEW_LANE_ROLES, type ReviewLaneRole } from "../bakeoff/migration/reviewLaneTypes.js";

// ── advisory severance: review verdict → repair inputs + telemetry ────────────

/** Policy version stamped into advisory records; a change stales prior selections. */
export const ADVISORY_REVIEW_POLICY_VERSION = "advisory-review-v1" as const;

/**
 * Invariant constant (documentation + a single import site tests assert on): the
 * review lane is advisory-only for SHIP. No promote/publish code may read a
 * ship-blocking bit from a review verdict — the D7 gate + deterministic floor are
 * the only ship gates. Kept as `true` so a consumer that ever branches on "is
 * review blocking?" reads the honest answer.
 */
export const REVIEW_IS_ADVISORY_ONLY_FOR_SHIP = true as const;

/** The default repair scopes review complaints are eligible to touch when the
 *  caller does not pin a narrower set. `findingsFromComplaints` stamps these onto
 *  the finding's `permittedRepairScope`; the conductor re-verifies scope on apply,
 *  so this is an eligibility hint, never an authority. */
export const ADVISORY_DEFAULT_REPAIR_SCOPES: readonly string[] = ["prose"];

export type AdvisoryReviewDispositionV1 = {
  schema: "advisory-review-disposition-v1";
  policyVersion: typeof ADVISORY_REVIEW_POLICY_VERSION;
  /** The aggregator's computed status — carried as TELEMETRY only. */
  finalStatus: AggregatedChapterReviewV1["finalStatus"];
  /** LITERAL false: a review verdict can never contribute a ship blocker. The
   *  type makes "read the blocking bit" impossible, not merely discouraged. */
  shipBlocking: false;
  /** Every reason the review raised (blocking + revision + escalation), demoted to
   *  repair complaint strings the WP-404 loop feeds to `findingsFromComplaints`. */
  repairComplaints: string[];
  /** Ready-made frozen findings (the same bridge WP-404 uses) for direct wiring
   *  into the bounded-repair finding stream. */
  repairFindings: RepairFindingV1[];
  /** Advisory telemetry counts (never a gate). */
  telemetry: { blocking: number; revision: number; escalation: number };
};

/** Collect EVERY reason the review raised into a flat complaint list. A BLOCK
 *  verdict's `blockingReasons` are demoted here to repair inputs — they are NOT a
 *  ship blocker (the D7 gate owns ship). */
export function reviewReasonsForRepair(aggregate: AggregatedChapterReviewV1): string[] {
  return [
    ...aggregate.blockingReasons,
    ...aggregate.revisionReasons,
    ...aggregate.escalationReasons,
  ];
}

/**
 * Rescope a computed aggregate to its advisory disposition: the verdict never
 * blocks ship; its reasons become bounded-repair inputs + telemetry. `shipBlocking`
 * is the literal `false` regardless of `finalStatus` (BLOCK/REVISE included).
 */
export function advisoryReviewDisposition(
  aggregate: AggregatedChapterReviewV1,
  opts: { repairScopes?: readonly string[] } = {},
): AdvisoryReviewDispositionV1 {
  const scopes = [...(opts.repairScopes ?? ADVISORY_DEFAULT_REPAIR_SCOPES)];
  const repairComplaints = reviewReasonsForRepair(aggregate);
  return {
    schema: "advisory-review-disposition-v1",
    policyVersion: ADVISORY_REVIEW_POLICY_VERSION,
    finalStatus: aggregate.finalStatus,
    shipBlocking: false,
    repairComplaints,
    repairFindings: findingsFromComplaints(repairComplaints, scopes),
    telemetry: {
      blocking: aggregate.blockingReasons.length,
      revision: aggregate.revisionReasons.length,
      escalation: aggregate.escalationReasons.length,
    },
  };
}

// ── different-model-from-writer role selection (v6 seed − void 5.5) ────────────

export class AdvisoryRoleSelectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdvisoryRoleSelectionError";
  }
}

/** A model@effort profile identity, e.g. "gpt-5.6-sol@high". */
export type ReviewerProfile = { model: string; effort: string };

/** The single advisory finding-weight scale [0,1] — declared once (WP-403 item 4
 *  applied to the reviewer-weight axis). Full-weight = an independent reviewer;
 *  the reduced weight is the D-2/M9 self-review discount. */
export const ADVISORY_FINDING_WEIGHT_SCALE = { min: 0, max: 1 } as const;
export const ADVISORY_FULL_FINDING_WEIGHT = 1 as const;
/** D-2/M9: a sol reviewer forced onto the same model as the writer (terra/luna
 *  unsupported) runs at a DIFFERENT effort with its finding weight reduced — the
 *  self-review bias is acknowledged, never hidden. Independence of the SHIP
 *  decision is guaranteed by the Claude-side D7 gate, never by this lane. */
export const ADVISORY_SELF_REVIEW_FINDING_WEIGHT = 0.5 as const;

/**
 * The frozen v6 advisory seed (L-15: PILOT_ROLE_SET_READY @ 8224f079a). The source
 * ADJUDICATOR slot (the retired 5.5-era @xhigh) is VOID for the target architecture (no-5.5
 * directive) and is OMITTED here — the advisory lane never blocks, so it runs
 * without a blocking adjudicator. Quiz correctness is deterministic (an answer-tell
 * code path), so the quiz slot's model is recorded but the different-model rule
 * does not gate it.
 */
export const ADVISORY_REVIEWER_SEED_V6: Readonly<Record<ReviewLaneRole, ReviewerProfile>> = {
  reader: { model: "gpt-5.6-sol", effort: "high" },
  source: { model: "gpt-5.6-sol", effort: "xhigh" },
  quiz: { model: "gpt-5.6-sol", effort: "xhigh" },
};

/** Effort preference order used to pick a DIFFERENT effort for the sol self-review
 *  fallback — strongest first, so the reviewer stays capable while its profileId
 *  is guaranteed to differ from the writer's. */
const EFFORT_PREFERENCE: readonly string[] = ["xhigh", "high", "medium", "low", "minimal"];

/** The lanes the different-model-from-writer rule gates (plan instruction 3). Quiz
 *  is EXEMPT — its correctness is a deterministic checker, not a model verdict. */
export const DIFFERENT_MODEL_GATED_LANES: readonly ReviewLaneRole[] = ["reader", "source"];

export function profileId(p: ReviewerProfile): string {
  return `${p.model}@${p.effort}`;
}

export function parseProfileId(id: string): ReviewerProfile {
  const at = id.lastIndexOf("@");
  if (at <= 0 || at === id.length - 1) {
    throw new AdvisoryRoleSelectionError(`invalid reviewer profileId "${id}" (expected "<model>@<effort>")`);
  }
  return { model: id.slice(0, at), effort: id.slice(at + 1) };
}

export type AdvisoryLaneAssignmentV1 = {
  role: ReviewLaneRole;
  profileId: string;
  model: string;
  effort: string;
  /** [0,1] on ADVISORY_FINDING_WEIGHT_SCALE — reduced when self-review applies. */
  findingWeight: number;
  /** True when the reviewer is forced onto the writer's model (sol, terra/luna
   *  unsupported) and shifted to a different effort — the D-2/M9 discount. */
  selfReview: boolean;
  /** Whether the different-model-from-writer rule gates this lane (quiz is exempt). */
  differentModelGated: boolean;
  /** Non-null iff an effort shift was applied to satisfy the different-model rule. */
  fallbackReason: string | null;
};

export type AdvisoryReviewerLedgerRecordV1 = {
  schema: "advisory-reviewer-ledger-record-v1";
  policyVersion: typeof ADVISORY_REVIEW_POLICY_VERSION;
  writerProfileId: string;
  lanes: Record<ReviewLaneRole, AdvisoryLaneAssignmentV1>;
  /** Load-bearing honesty: SHIP-decision independence is the D7 gate's, not this
   *  lane's — recorded so no reader mistakes reduced-weight self-review for it. */
  independenceGuaranteedBy: "claude-side-d7-gate";
};

export type AdvisoryReviewerSelectionV1 = {
  schema: "advisory-reviewer-selection-v1";
  policyVersion: typeof ADVISORY_REVIEW_POLICY_VERSION;
  writerProfileId: string;
  lanes: Record<ReviewLaneRole, AdvisoryLaneAssignmentV1>;
  ledgerRecord: AdvisoryReviewerLedgerRecordV1;
};

function firstEffortDifferentFrom(effort: string): string {
  const alt = EFFORT_PREFERENCE.find((e) => e !== effort);
  // EFFORT_PREFERENCE has 5 distinct entries; there is always an alternative.
  return alt ?? effort;
}

/**
 * Select the advisory reviewer roles for one book run. Seeds from the frozen v6
 * set, then enforces the different-model-from-writer rule for the reader/source
 * lanes: a seed whose profileId equals the resolved writer profile is a same-model
 * collision — since terra/luna are unsupported (only sol is available), the D-2/M9
 * fallback shifts the reviewer to a DIFFERENT effort and reduces its finding weight
 * (self-review acknowledged). The result records every reviewer profile in a run-
 * ledger record. Quiz is recorded verbatim (deterministic correctness, not gated).
 */
export function selectAdvisoryReviewerRoles(input: {
  writerProfileId: string;
  seed?: Readonly<Record<ReviewLaneRole, ReviewerProfile>>;
}): AdvisoryReviewerSelectionV1 {
  const writerProfileId = input.writerProfileId;
  // Validate the writer profile shape up front (fail-closed on a malformed pin).
  parseProfileId(writerProfileId);
  const seed = input.seed ?? ADVISORY_REVIEWER_SEED_V6;

  const lanes = {} as Record<ReviewLaneRole, AdvisoryLaneAssignmentV1>;
  for (const role of REVIEW_LANE_ROLES) {
    const s = seed[role];
    const gated = DIFFERENT_MODEL_GATED_LANES.includes(role);
    let profile = { ...s };
    let selfReview = false;
    let fallbackReason: string | null = null;

    if (gated && profileId(profile) === writerProfileId) {
      // Same-model-as-writer collision. Only sol is available (terra/luna
      // unsupported, WP-502 pending), so shift effort rather than model (D-2/M9).
      const writer = parseProfileId(writerProfileId);
      const shifted = firstEffortDifferentFrom(writer.effort);
      profile = { model: profile.model, effort: shifted };
      selfReview = true;
      fallbackReason =
        `D-2/M9 sol self-review fallback: seed ${role} profile ${profileId(s)} == writer ${writerProfileId}; ` +
        `terra/luna unsupported, so ran ${profile.model}@${shifted} (different effort) with reduced finding weight`;
    }

    lanes[role] = {
      role,
      profileId: profileId(profile),
      model: profile.model,
      effort: profile.effort,
      findingWeight: selfReview ? ADVISORY_SELF_REVIEW_FINDING_WEIGHT : ADVISORY_FULL_FINDING_WEIGHT,
      selfReview,
      differentModelGated: gated,
      fallbackReason,
    };
  }

  const ledgerRecord: AdvisoryReviewerLedgerRecordV1 = {
    schema: "advisory-reviewer-ledger-record-v1",
    policyVersion: ADVISORY_REVIEW_POLICY_VERSION,
    writerProfileId,
    lanes,
    independenceGuaranteedBy: "claude-side-d7-gate",
  };

  const selection: AdvisoryReviewerSelectionV1 = {
    schema: "advisory-reviewer-selection-v1",
    policyVersion: ADVISORY_REVIEW_POLICY_VERSION,
    writerProfileId,
    lanes,
    ledgerRecord,
  };
  // Post-condition: the selection satisfies its own invariant (a shifted effort
  // always differs). A seed that could not be made to differ is a hard error.
  assertReviewerDiffersFromWriter(selection, writerProfileId);
  return selection;
}

/**
 * Fail-closed assertion: every different-model-GATED lane's reviewer profile must
 * differ from the writer profile. A same-model selection is a BLOCKED role
 * selection (AdvisoryRoleSelectionError), never a silent pass (plan instruction 3).
 */
export function assertReviewerDiffersFromWriter(
  selection: AdvisoryReviewerSelectionV1,
  writerProfileId: string,
): void {
  for (const role of DIFFERENT_MODEL_GATED_LANES) {
    const lane = selection.lanes[role];
    if (lane && lane.profileId === writerProfileId) {
      throw new AdvisoryRoleSelectionError(
        `BLOCKED role selection: ${role} reviewer profile ${lane.profileId} equals the writer profile ${writerProfileId} ` +
          `(different-model-from-writer rule violated; the D-2/M9 effort-shift fallback must apply)`,
      );
    }
  }
}

// ── advisory-finding-precision tracking (D-2 removal condition) ────────────────

/** Minimum confirmed/total sample before the drop condition can fire — a lane is
 *  never dropped on a thin sample (D-2 "persistently"). */
export const ADVISORY_PRECISION_MIN_SAMPLE = 20 as const;
/** The precision floor below which a lane is dropped (D-2: < 50%). */
export const ADVISORY_PRECISION_FLOOR = 0.5 as const;

export type AdvisoryLaneCounterV1 = { confirmed: number; total: number };

export type AdvisoryPrecisionCounterV1 = {
  schema: "advisory-finding-precision-v1";
  policyVersion: typeof ADVISORY_REVIEW_POLICY_VERSION;
  lanes: Record<ReviewLaneRole, AdvisoryLaneCounterV1>;
};

export function emptyAdvisoryPrecisionCounter(): AdvisoryPrecisionCounterV1 {
  const lanes = {} as Record<ReviewLaneRole, AdvisoryLaneCounterV1>;
  for (const role of REVIEW_LANE_ROLES) lanes[role] = { confirmed: 0, total: 0 };
  return { schema: "advisory-finding-precision-v1", policyVersion: ADVISORY_REVIEW_POLICY_VERSION, lanes };
}

/**
 * Accumulate one batch of advisory-finding outcomes for a lane. `total` advisory
 * findings were raised; `confirmed` of them were actionable / true positives (the
 * precision numerator). Pure: returns a new counter, never mutates.
 */
export function recordAdvisoryFindingOutcomes(
  counter: AdvisoryPrecisionCounterV1,
  role: ReviewLaneRole,
  batch: { confirmed: number; total: number },
): AdvisoryPrecisionCounterV1 {
  if (!Number.isFinite(batch.confirmed) || !Number.isFinite(batch.total) || batch.confirmed < 0 || batch.total < 0) {
    throw new AdvisoryRoleSelectionError(`advisory precision batch must carry non-negative counts (got confirmed=${batch.confirmed}, total=${batch.total})`);
  }
  if (batch.confirmed > batch.total) {
    throw new AdvisoryRoleSelectionError(`advisory precision batch confirmed (${batch.confirmed}) cannot exceed total (${batch.total})`);
  }
  const lanes = {} as Record<ReviewLaneRole, AdvisoryLaneCounterV1>;
  for (const r of REVIEW_LANE_ROLES) lanes[r] = { ...counter.lanes[r] };
  lanes[role] = { confirmed: lanes[role].confirmed + batch.confirmed, total: lanes[role].total + batch.total };
  return { ...counter, lanes };
}

/** Confirmed/total for a lane, or null when no advisory findings have been scored. */
export function advisoryLanePrecision(counter: AdvisoryPrecisionCounterV1, role: ReviewLaneRole): number | null {
  const c = counter.lanes[role];
  return c.total === 0 ? null : c.confirmed / c.total;
}

/**
 * D-2 removal condition: a lane is dropped when its advisory-finding precision is
 * PERSISTENTLY below the floor — i.e. a meaningful sample (>= min) AND precision <
 * floor. A thin sample never drops a lane.
 */
export function advisoryLaneShouldBeDropped(
  counter: AdvisoryPrecisionCounterV1,
  role: ReviewLaneRole,
  opts: { minSample?: number; floor?: number } = {},
): boolean {
  const minSample = opts.minSample ?? ADVISORY_PRECISION_MIN_SAMPLE;
  const floor = opts.floor ?? ADVISORY_PRECISION_FLOOR;
  const c = counter.lanes[role];
  const precision = advisoryLanePrecision(counter, role);
  return precision !== null && c.total >= minSample && precision < floor;
}

// Re-export the frozen finding validator so advisory callers can prove a mapped
// finding is contract-valid without reaching into the contracts layer directly.
export { validateRepairFinding };
