/**
 * IMP-20 WP-A2 — migration-side shared types + frozen cross-WP function
 * signatures for the split-lane reviewer and §16 recovery.
 *
 * This module is PURE DATA: versioned TS schemas + schema-id constants +
 * function-type aliases. It performs NO file I/O, reads NO ambient
 * environment, and references NO canonical pipeline state. It is the Wave-A
 * interface surface every Wave-B migration package (B4/B5/B6/B7/B8/B10)
 * compiles against, so no two lanes can invent divergent shapes.
 *
 * Frozen decisions honored here (design §§F/G/H/K/M + section 6.1):
 *  - The judge registry is per-role (reader/source/quiz + inherited security),
 *    replacing the monolithic single-boolean qualification (E-06).
 *  - A soft (non-1.0) threshold whose denominator falls below
 *    MIN_SOFT_DENOMINATOR is REFUSED as underpowered, never silently passed
 *    (E-07 fix).
 *  - Role assignment is FIXED (one frozen primary per role across every
 *    candidate cell), never rotated by execution order (E-06/§G).
 *  - The corpus builder config carries typed, injected roots only — never an
 *    ambient scratchpad or absolute user/temp path (§J).
 *
 * The five registered contract TYPES (reader/source/quiz/aggregate/qualification)
 * live under src/contracts/ (WP-A1); this file owns only the migration-harness
 * shapes and the cross-WP function-type aliases that bind A1 producers to B10
 * consumers by a single frozen signature.
 */

import type { EffortLevelV1 } from "../../contracts/executionProfile.js";
import type { CriticFinding } from "../../types.js";
import type {
  ChapterStratumV1,
  ExperimentSpecV1,
  MigrationSampleRecordV1,
} from "./experimentTypes.js";
// Wave-A (WP-A1) registered contract types — referenced by the frozen
// function-type aliases and the per-role registry. Type-only imports: they are
// erased at execution time, so this module runs before A1 lands on disk while
// still binding one shape at typecheck.
import type { JudgeCapabilityQualificationV1 } from "../../contracts/judgeCapabilityQualification.js";
import type {
  AggregateChapterReviewInputV1,
  AggregatedChapterReviewV1,
} from "../../contracts/aggregateChapterReview.js";

// ── Schema-id constants (all migration-side split-lane schema ids) ────────────

export const FIXED_ROLE_ASSIGNMENT_SCHEMA = "split-lane-fixed-role-assignment-v1" as const;
export const ROLE_QUALIFICATION_REGISTRY_SCHEMA = "split-lane-role-qualification-registry-v1" as const;
export const REQUIRED_ROLE_SET_SCHEMA = "split-lane-required-role-set-v1" as const;
export const ROLE_JUDGE_SELECTION_SCHEMA = "split-lane-role-judge-selection-v1" as const;
export const ROLE_QUALIFICATION_OUTCOME_SCHEMA = "split-lane-role-qualification-outcome-v1" as const;
export const RECOVERY_ROLE_THRESHOLDS_SCHEMA = "split-lane-recovery-role-thresholds-v1" as const;
export const SPLIT_LANE_INSTRUMENT_MANIFEST_SCHEMA = "split-lane-instrument-manifest-v1" as const;
export const RECOVERY_EXPERIMENT_SPEC_SCHEMA = "split-lane-recovery-experiment-spec-v1" as const;
export const SPLIT_LANE_CORPUS_CONFIG_SCHEMA = "split-lane-corpus-builder-config-v1" as const;
export const DETERMINISTIC_CRITIC_BUNDLE_SCHEMA = "split-lane-deterministic-critic-bundle-v1" as const;
export const CLOSED_EXPERIMENT_REGISTRY_SCHEMA = "split-lane-closed-experiment-registry-v1" as const;

/**
 * Minimum per-capability denominator for any SOFT (non-1.0) blocking
 * percentage. A soft threshold measured over fewer cases is REFUSED as
 * underpowered — never silently passed on a tiny `num/den` (E-07: a 0.85 bar
 * over 4 cases collapses to a hidden 4/4). Reserved zero-miss categories are
 * exempt (they fail on any single miss regardless of denominator).
 */
export const MIN_SOFT_DENOMINATOR = 10 as const;

// ── Review-lane roles + per-role qualification status ─────────────────────────

/** The three model-facing review lanes that carry a role-qualified judge and a
 *  hermetic role corpus. Security is qualified separately (inherited from the
 *  bound Layer-O v3 prerequisite), never via a review lane. */
export const REVIEW_LANE_ROLES = ["reader", "source", "quiz"] as const;
export type ReviewLaneRole = (typeof REVIEW_LANE_ROLES)[number];

/** Per-role qualification status — byte-identical to the JudgeCapability
 *  QualificationV1 capability enum (§F): a model may qualify one role and fail
 *  another; NOT_TESTED is a distinct, honestly-recorded state. */
export const ROLE_QUALIFICATION_STATUSES = ["QUALIFIED", "NOT_QUALIFIED", "NOT_TESTED"] as const;
export type RoleQualificationStatus = (typeof ROLE_QUALIFICATION_STATUSES)[number];

// ── §G — fixed judge assignment (replaces rotation) ───────────────────────────

/** A single judge slot. `profileId` is a stable identity ("<model>@<effort>");
 *  the candidate's authoring model NEVER selects or influences its judge. */
export type RoleJudgeRefV1 = {
  profileId: string;
  model: string;
  effort: EffortLevelV1;
};

/** The quiz checker is a DETERMINISTIC code path (answer-tell heuristic + key
 *  arithmetic), not a model profile — a model cannot hide a tell. */
export type QuizDeterministicCheckerV1 = {
  deterministic: true;
  checkerVersion: string;
};

/**
 * The fixed role assignment for a candidate cell (§G). The primary for each
 * role is the SAME across every candidate cell — a pure function of the
 * experiment spec, independent of executionOrder / cellId / candidate model.
 * A backup runs ONLY on the frozen balanced audit subset, high-severity source
 * findings, required disagreement adjudication, or prespecified operational
 * failure — never chosen by the output.
 */
export type FixedRoleAssignmentV1 = {
  schema: typeof FIXED_ROLE_ASSIGNMENT_SCHEMA;
  readerPrimary: RoleJudgeRefV1;
  readerBackup: RoleJudgeRefV1;
  sourcePrimary: RoleJudgeRefV1;
  sourceAdjudicator: RoleJudgeRefV1;
  quizChecker: QuizDeterministicCheckerV1;
  quizAdjudicator: RoleJudgeRefV1;
};

// ── §F — per-role qualification registry + fail-closed role-set + selection ────

/** The read-only registry of every candidate profile's per-role qualification
 *  (WP-A1 JudgeCapabilityQualificationV1 records). `assertRoleSetReady` and
 *  `selectRoleJudges` read it; one unqualified UNUSED profile never blocks. */
export type RoleQualificationRegistryV1 = {
  schema: typeof ROLE_QUALIFICATION_REGISTRY_SCHEMA;
  profiles: JudgeCapabilityQualificationV1[];
};

/** The fail-closed required-role set (§F "Required production/bakeoff roles"):
 *  reader needs a qualified primary + backup; source needs a primary plus an
 *  independent adjudicator OR a declared blind-human adjudication path; quiz
 *  needs the deterministic checker + a qualified semantic adjudicator. */
export type RequiredRoleSetV1 = {
  schema: typeof REQUIRED_ROLE_SET_SCHEMA;
  reader: { primary: boolean; backup: boolean };
  source: { primary: boolean; independentAdjudicator: boolean; blindHumanAdjudicationPath: boolean };
  quiz: { deterministicChecker: boolean; semanticAdjudicator: boolean };
};

/** The frozen judge selection for a role (§Selection policy). Frozen BEFORE any
 *  candidate output; tie-break by held-out alignment → high-severity FP rate →
 *  unresolved rate → invocation count, NEVER by model family. If only one
 *  profile qualifies for a safety-critical role and no independent adjudication
 *  path exists → BLOCKED. */
export type RoleJudgeSelectionV1 = {
  schema: typeof ROLE_JUDGE_SELECTION_SCHEMA;
  role: ReviewLaneRole;
  status: "SELECTED" | "BLOCKED";
  primaryProfileId: string | null;
  backupProfileId: string | null;
  blockedReason: string | null;
  /** ordered tie-break trace, most-preferred first. */
  selectionRationale: string[];
};

/** The outcome of qualifying one profile for one role. `refusedUnderpowered` is
 *  a DISTINCT outcome from NOT_QUALIFIED: it fires when a soft threshold's
 *  denominator < MIN_SOFT_DENOMINATOR, so a tiny-n masquerade never counts as a
 *  pass or a genuine fail (E-07). */
export type RoleQualificationOutcomeV1 = {
  schema: typeof ROLE_QUALIFICATION_OUTCOME_SCHEMA;
  role: ReviewLaneRole;
  status: RoleQualificationStatus;
  refusedUnderpowered: boolean;
  /** metric ids whose soft denominator fell below MIN_SOFT_DENOMINATOR. */
  underpoweredMetrics: string[];
  /** metric ids whose measured rate fell below the frozen bar. */
  failedThresholds: string[];
};

// ── §H/§I — per-role qualification thresholds ─────────────────────────────────

/** One threshold entry. `zeroMiss` marks a reserved category (fabrication,
 *  causal-overreach, source-contradiction, wrong quiz key) where a single miss
 *  fails regardless of rate. A soft (non-zeroMiss) bar carries a paired
 *  `minDenominator` so the E-07 underpowered rule is data-driven, not global. */
export type SoftThresholdV1 = {
  minRate: number;
  minDenominator: number;
  zeroMiss: boolean;
};

/** Per-role qualification thresholds (recovery-role-thresholds.v1.json, authored
 *  by WP-A3). NEVER edits native-review-thresholds.v2.json. */
export type RecoveryRoleThresholdsV1 = {
  schema: typeof RECOVERY_ROLE_THRESHOLDS_SCHEMA;
  thresholdsVersion: string;
  reader: Record<string, SoftThresholdV1>;
  source: Record<string, SoftThresholdV1>;
  quiz: Record<string, SoftThresholdV1>;
};

// ── §B/§D — deterministic critic bundle (full; CriticFinding[]) ───────────────

/**
 * The FULL deterministic-critic bundle produced by the source lane's
 * write-first prechecks (checkSourceRegister / checkChapterProvenance /
 * checkExampleSourceGrounding / staleness / relabel-containment). The semantic
 * reviewer NEVER re-votes these; the aggregator consumes the bundle sha. The
 * lean `DeterministicCriticSummaryV1` (bundleSha256 + hasBlocker +
 * blockerCheckIds) is the WP-A1 counterpart the aggregator binds.
 */
export type DeterministicCriticBundleV1 = {
  schema: typeof DETERMINISTIC_CRITIC_BUNDLE_SCHEMA;
  checks: CriticFinding[];
  bundleSha256: string;
};

// ── §H/§J — hermetic role corpus builder config ───────────────────────────────

/** Config for a pure, hermetic role corpus builder (§J). Roots arrive typed and
 *  injected; a missing mutation spec FAILS CLOSED (never a silent []); source
 *  semantics are NEVER inferred during normalization. */
export type SplitLaneCorpusConfigV1 = {
  schema: typeof SPLIT_LANE_CORPUS_CONFIG_SCHEMA;
  role: ReviewLaneRole;
  sourceRoots: { bookPackagesDir: string; sidecarRoot?: string; sourcePlanRoot?: string };
  /** committed in-repo path; FAIL-CLOSED if missing (never a silent []). */
  mutationSpecPath: string;
  /** binds each clean base to its REAL 140-eval Content Design Score (E-03). */
  cleanBaseScoreLedgerPath: string;
  /** books reserved for diagnostic/confirmatory candidate sets (H2 exclusion). */
  excludedCandidateBookIds: string[];
  minRenderBytes: number;
};

// ── §M — split-lane instrument manifest ───────────────────────────────────────

/**
 * Binds every behavior-affecting component of the split-lane instrument so that
 * a changed prompt, schema, threshold, corpus, or role-assignment policy stales
 * a prior qualification (analog of NativeReviewInstrumentManifestV2).
 */
export type SplitLaneInstrumentManifestV1 = {
  schema: typeof SPLIT_LANE_INSTRUMENT_MANIFEST_SCHEMA;
  readerRubricVersion: string;
  sourceRubricVersion: string;
  readerSchemaSha256: string;
  sourceSchemaSha256: string;
  quizAdjudicationSchemaSha256: string;
  quizPhase2Version: string;
  aggregationVersion: string;
  /** a changed role-assignment policy stales qualification. */
  roleAssignmentPolicyVersion: string;
  fixedRoleAssignmentSha256: string;
  executionProfileHash: string;
  routePolicyVersion: string;
  thresholdsSha256: string;
  readerCorpusSha256: string;
  sourceCorpusSha256: string;
  quizCorpusSha256: string;
};

// ── §M — new recovery experiment spec ─────────────────────────────────────────

/** A candidate judge profile. Runtime judges are GPT profiles routed through the
 *  ChatGPT-authenticated subscription route only — never a non-GPT or
 *  external-API model. */
export type RecoveryJudgeProfileV1 = {
  profileId: string;
  model: string;
  effort: EffortLevelV1;
};

/** One candidate cell (a chapter under one authoring configuration). */
export type RecoveryCandidateCellV1 = {
  cellId: string;
  authoringConfigId: string;
  bookId: string;
  chapterNumber: number;
  stratum: ChapterStratumV1;
};

/** Source/quiz escalation rules bound into the experiment. A reader escalation
 *  is advisory only — it can raise a REVISE, never a source BLOCK. */
export type RecoveryEscalationPolicyV1 = {
  sourceHighSeverityRequiresAdjudicator: boolean;
  quizAmbiguityRequiresAdjudicator: boolean;
  readerEscalationAdvisoryOnly: boolean;
};

/** The no-API execution policy + bounded-retry + call ceiling. `authMode` is
 *  the fail-closed subscription route; content/safeguard retries are disabled —
 *  only bounded infra replay of disjoint provider outcomes is allowed. */
export type RecoveryExecutionPolicyV1 = {
  authMode: "chatgpt-subscription-codex-exec";
  routePolicyVersion: string;
  boundedRetry: { maxReplaysPerCall: number; replayableOutcomes: string[] };
  callCeiling: number;
};

/**
 * The new recovery experiment (id `s16-reviewer-recovery-v1`) — a NEW identity,
 * not a revision of any old seal. Binds every §M component. The literal
 * `imp13Dormant`/`productionActivation`/`separateAuthorizationRequired` fields
 * encode the safety invariants at the type level so they cannot be flipped.
 */
export type RecoveryExperimentSpecV1 = {
  schema: typeof RECOVERY_EXPERIMENT_SPEC_SCHEMA;
  experimentId: string;
  stage: "diagnostic" | "confirmatory";
  title: string;
  /** the five registered split-lane contract schema ids. */
  contractSchemaIds: {
    readerExperienceReview: string;
    sourceIntegrityReview: string;
    quizIntegrityResult: string;
    aggregatedChapterReview: string;
    judgeCapabilityQualification: string;
  };
  instrumentManifest: SplitLaneInstrumentManifestV1;
  roleThresholdsSha256: string;
  candidateJudgeProfiles: RecoveryJudgeProfileV1[];
  roleAssignment: FixedRoleAssignmentV1;
  roleAssignmentPolicyVersion: string;
  requiredRoles: RequiredRoleSetV1;
  escalation: RecoveryEscalationPolicyV1;
  strata: ChapterStratumV1[];
  candidateInputs: {
    diagnostic: RecoveryCandidateCellV1[];
    confirmatory: RecoveryCandidateCellV1[];
  };
  randomizationSeed: string;
  schedules: { pilotSeed: string; diagnosticSeed: string };
  execution: RecoveryExecutionPolicyV1;
  humanAdjudicationPause: { required: boolean; unadjudicatedDisputes: string[] };
  imp13Dormant: true;
  productionActivation: false;
  separateAuthorizationRequired: true;
  bookSpecificExceptions: string[];
};

// ── §K — closed-experiment registry (closure JSON shape) ──────────────────────

/** The exact call ledger recorded at closure. BOTH campaign totals are stated
 *  explicitly (711 §16-ledgered + the 100 Layer-N v1 = 811 ever). */
export type ClosedCallLedgerV1 = {
  /** 711 = Stage-Q Layer-O 540 + Layer-N v2 171. */
  campaignTotalConsumed: number;
  /** 811 = campaignTotalConsumed + the 100 earlier Layer-N v1 live calls. */
  totalLiveCallsEverIncludingLayerNv1: number;
  stageQLayerOCalls: number;
  layerNv2Calls: number;
  layerNv1Calls: number;
  sealedHardMax: number;
  diagnosticCalls: number;
  confirmatoryCalls: number;
};

/** A preserved old-experiment seal reference. */
export type ClosedExperimentSealRefV1 = {
  experimentId: string;
  sealId: string;
  sealSha256: string;
};

/**
 * The immutable legacy-campaign closure record (§K). Status is frozen to the
 * required literal; `closedExperimentIds` mirrors the in-code CLOSED_EXPERIMENT_
 * IDS set; `preservedArtifactHashes` binds every preserved run-dir file + seal
 * so the immutability test can recompute equality. The old campaign cannot
 * resume and produced NO authoring migration decision.
 */
export type ClosedExperimentRegistryV1 = {
  schema: typeof CLOSED_EXPERIMENT_REGISTRY_SCHEMA;
  status: "ARCHIVED_INCONCLUSIVE_REVIEW_INSTRUMENT_MISMATCH";
  closedExperimentIds: string[];
  oldSeals: ClosedExperimentSealRefV1[];
  callLedger: ClosedCallLedgerV1;
  stageQHistory: string[];
  layerNHistory: string[];
  preservedArtifactHashes: Record<string, string>;
  authoringMigrationDecisionProduced: false;
  oldArtifactsImmutable: true;
  oldResultsAreDevelopmentEvidence: true;
  canResume: false;
  unresolvedRisks: string[];
  closedAt: string;
};

// ── Cross-WP frozen function-type aliases (section 6.1) ────────────────────────
//
// Every producer (B4/B5/B6) and consumer (B10) compiles against ONE shape, so
// divergence cannot surface as a reconciliation edit into a completed B file at
// the Wave-C typecheck. Parameter AND return types are all frozen in Wave A.

/** Per-role measured rates (metric id → rate in [0,1]). */
export type RoleMetricRatesV1 = Record<string, number>;
/** Per-role case denominators (metric id → count). */
export type RoleMetricDenominatorsV1 = Record<string, number>;

/** WP-B4 `aggregateChapterReview` — the conductor owns the final status. */
export type AggregateChapterReviewFn = (input: AggregateChapterReviewInputV1) => AggregatedChapterReviewV1;

/** WP-B5 `assignFixedRoles` — pure function of the spec; independent of the
 *  record's executionOrder / cellId / candidate model. */
export type AssignFixedRolesFn = (
  spec: ExperimentSpecV1,
  record: MigrationSampleRecordV1,
) => FixedRoleAssignmentV1;

/** WP-B6 `assertRoleSetReady` — fail-closed; throws when a required role lacks a
 *  qualified primary/backup/adjudicator. */
export type AssertRoleSetReadyFn = (
  registry: RoleQualificationRegistryV1,
  requiredRoles: RequiredRoleSetV1,
) => void;

/** WP-B6 `selectRoleJudges` — frozen selection before candidate outputs. */
export type SelectRoleJudgesFn = (
  registry: RoleQualificationRegistryV1,
  role: ReviewLaneRole,
) => RoleJudgeSelectionV1;

/** WP-B6 `qualifyRole` — measures one role; guards vacuous `den===0` passes and
 *  underpowered soft denominators. */
export type QualifyRoleFn = (
  role: ReviewLaneRole,
  metrics: RoleMetricRatesV1,
  thresholds: RecoveryRoleThresholdsV1,
  denominators: RoleMetricDenominatorsV1,
) => RoleQualificationOutcomeV1;
