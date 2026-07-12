/**
 * IMP-20 WP-B10 — the new §16 recovery experiment (`s16-reviewer-recovery-v1`):
 * spec builder, split-lane instrument manifest, seal-preparation tooling, and
 * the no-model recovery pilot dry run (design §§M/N).
 *
 * A NEW identity — NOT a revision of any old seal (`assertNotClosed(
 * RECOVERY_EXPERIMENT_ID)` never throws). The spec binds every behavior-
 * affecting component (five split-lane contract schema ids, the three role
 * corpus/spec hashes, the role-qualification thresholds hash, the candidate
 * judge profiles, the FIXED role-assignment policy, source/quiz escalation
 * rules, diagnostic/confirmatory candidate inputs, seeds, schedules, the no-API
 * execution policy, bounded-retry policy, call ceiling, the human-adjudication
 * pause, and IMP-13 dormancy) so a changed prompt/schema/threshold/corpus/role
 * assignment stales a prior qualification.
 *
 * This module is PURE DATA + PURE FUNCTIONS: it performs NO file I/O, reads NO
 * ambient environment, references NO canonical pipeline state, and makes NO
 * model call. Every sibling Wave-B capability it consumes (B4 aggregate, B5
 * assignFixedRoles, B6 assertRoleSetReady/selectRoleJudges, B8 assertNotClosed)
 * arrives ONLY through the Wave-A frozen function-type aliases via dependency
 * injection — never a direct import of a sibling runtime module.
 *
 * Frozen safety invariants encoded at the type level and NEVER flippable here:
 *  - the full diagnostic is NOT sealed until the role-qualified reviewer set
 *    exists (`prepareRecoverySeal`/`sealRecoveryExperiment` gate on the injected
 *    `assertRoleSetReady`); this package only PREPARES a seal, never seals;
 *  - the pilot dry run makes ZERO model calls and every planned spawn resolves
 *    to the `injected_test_runner` route (`authMode:"test"`, no API, no fallback);
 *  - `imp13Dormant`/`productionActivation`/`separateAuthorizationRequired` are
 *    literal-typed, so no code path can activate production or IMP-13.
 */

import { hashCanonical } from "../../contracts/contractUtil.js";
import { READER_EXPERIENCE_RUBRIC_VERSION } from "../../contracts/readerExperienceReview.js";
import type { JudgeCapabilityQualificationV1 } from "../../contracts/judgeCapabilityQualification.js";
import { CHAPTER_STRATA, type ChapterStratumV1 } from "./experimentTypes.js";
import {
  FIXED_ROLE_ASSIGNMENT_SCHEMA,
  RECOVERY_EXPERIMENT_SPEC_SCHEMA,
  SPLIT_LANE_INSTRUMENT_MANIFEST_SCHEMA,
  type AggregateChapterReviewFn,
  type AssignFixedRolesFn,
  type AssertRoleSetReadyFn,
  type FixedRoleAssignmentV1,
  type RecoveryCandidateCellV1,
  type RecoveryExperimentSpecV1,
  type RecoveryJudgeProfileV1,
  type RequiredRoleSetV1,
  type RoleJudgeRefV1,
  type RoleQualificationRegistryV1,
  type SelectRoleJudgesFn,
  type SplitLaneInstrumentManifestV1,
} from "./reviewLaneTypes.js";

// ── Frozen recovery identity + behavior versions ──────────────────────────────

/** The NEW recovery experiment identity — a fresh id, not an old seal revision. */
export const RECOVERY_EXPERIMENT_ID = "s16-reviewer-recovery-v1" as const;

/** Behavior versions owned by the recovery experiment. A change to any of these
 *  stales a prior qualification via the instrument manifest hash. The three
 *  contract-id-shaped versions bind the recovery lane to the exact registered
 *  contract semantics without importing a sibling runtime module. */
export const RECOVERY_ROLE_ASSIGNMENT_POLICY_VERSION = "recovery-fixed-role-policy-v1" as const;
export const RECOVERY_AGGREGATION_VERSION = "aggregated-chapter-review-v1" as const;
export const RECOVERY_SOURCE_RUBRIC_VERSION = "source-integrity-review-v1" as const;
export const RECOVERY_QUIZ_PHASE2_VERSION = "quiz-integrity-adjudication-v1" as const;

/** The five registered split-lane contract schema ids the spec binds. */
export const RECOVERY_CONTRACT_SCHEMA_IDS = {
  readerExperienceReview: "reader-experience-review-v1",
  sourceIntegrityReview: "source-integrity-review-v1",
  quizIntegrityResult: "quiz-integrity-result-v1",
  aggregatedChapterReview: "aggregated-chapter-review-v1",
  judgeCapabilityQualification: "judge-capability-qualification-v1",
} as const;

/**
 * Proposed live-call budget (design §5). These are ESTIMATES bound to the final
 * built corpus sizes; the authorization packet re-derives them. Qualification
 * and pilot are separately gated; the diagnostic is not sealed until
 * qualification completes. A NEW ceiling bound to the NEW experiment id — the
 * old 2096 ceiling is NOT reused.
 */
export const RECOVERY_PROPOSED_QUALIFICATION_CALLS = 440 as const;
export const RECOVERY_PROPOSED_PILOT_CALLS = 72 as const;
export const RECOVERY_PROPOSED_HARD_CEILING = 640 as const;

/** The pilot preflight STOP conditions (design §N). Any one, if it would occur,
 *  halts the pilot before authorization of the full diagnostic. */
export const RECOVERY_PILOT_STOP_CONDITIONS = [
  "role-instrument defect",
  "source evidence missing from a required case",
  "differential judge assignment",
  "stale hash",
  "new ambiguous gold",
  "unbounded or hidden retry",
  "API route",
  "material judge disagreement with no frozen adjudication path",
] as const;

/**
 * The four candidate judge profiles under comparison (design §5). Runtime
 * profiles are GPT-via-ChatGPT-subscription-codex only — NEVER an Anthropic/
 * Claude model, NEVER an external-API model. The owner prefers NO model; each is
 * qualified per role on held-out gold and selected by alignment, never family.
 */
export const RECOVERY_CANDIDATE_JUDGE_PROFILES: readonly RecoveryJudgeProfileV1[] = [
  { profileId: "gpt-5.5@high", model: "gpt-5.5", effort: "high" },
  { profileId: "gpt-5.5@xhigh", model: "gpt-5.5", effort: "xhigh" },
  { profileId: "gpt-5.6-sol@high", model: "gpt-5.6-sol", effort: "high" },
  { profileId: "gpt-5.6-sol@xhigh", model: "gpt-5.6-sol", effort: "xhigh" },
];

/**
 * The pre-qualification PENDING judge sentinel. Before the role-qualified
 * reviewer set exists, NO judge is selected: the spec carries a
 * clearly-non-preferential pending ref in every role slot. The real fixed
 * assignment is produced post-qualification by the injected `selectRoleJudges`
 * (B6) — the design forbids selecting a judge by model preference, so no
 * candidate is named primary until qualification runs.
 */
const PENDING_JUDGE: RoleJudgeRefV1 = { profileId: "pending-role-qualification", model: "pending", effort: "high" };

/** The frozen fail-closed required-role set (§F "Required production/bakeoff
 *  roles"): reader primary + backup; source primary + independent adjudicator;
 *  quiz deterministic checker + semantic adjudicator. */
export const RECOVERY_REQUIRED_ROLES: RequiredRoleSetV1 = {
  schema: "split-lane-required-role-set-v1",
  reader: { primary: true, backup: true },
  source: { primary: true, independentAdjudicator: true, blindHumanAdjudicationPath: false },
  quiz: { deterministicChecker: true, semanticAdjudicator: true },
};

// ── Inputs (injected; never read ambiently) ───────────────────────────────────

/**
 * The binding hashes + versions the spec builder embeds. Every value is COMPUTED
 * by the caller (the Wave-C CLI or the one-time committed-artifact generator)
 * from the committed A3 inputs — this module reads NO file. The corpus hashes
 * bind the committed corpus BUILD specs (the frozen recipe) at seal-preparation
 * time; the Wave-C seal step rebinds them to the built-corpus bytes once the
 * corpora are built and role qualification runs.
 */
export type RecoverySpecInputsV1 = {
  readerSchemaSha256: string;
  sourceSchemaSha256: string;
  quizAdjudicationSchemaSha256: string;
  executionProfileHash: string;
  routePolicyVersion: string;
  thresholdsSha256: string;
  readerCorpusSha256: string;
  sourceCorpusSha256: string;
  quizCorpusSha256: string;
  randomizationSeed: string;
  pilotSeed: string;
  diagnosticSeed: string;
};

// ── Cell enumeration (4 strata × 4 authoring configs × 1 sample = 16) ──────────

/** The four blinded authoring configuration ids (§N). Candidate identities are
 *  BLIND — a config id never names a model, so no reviewer or aggregation can
 *  read authoring identity. */
export const RECOVERY_AUTHORING_CONFIG_IDS = ["cfg-1", "cfg-2", "cfg-3", "cfg-4"] as const;

/** Deterministically enumerate the 16 recovery pilot/diagnostic cells: one
 *  representative chapter per stratum × four blind authoring configs. Book ids
 *  are pilot-scoped labels (the dry run authors nothing and reads no book); they
 *  are DISJOINT from the excluded diagnostic/confirmatory candidate books
 *  (start-with-why, radical-candor) by construction. */
export function enumerateRecoveryCells(): RecoveryCandidateCellV1[] {
  const cells: RecoveryCandidateCellV1[] = [];
  CHAPTER_STRATA.forEach((stratum: ChapterStratumV1, sIdx) => {
    RECOVERY_AUTHORING_CONFIG_IDS.forEach((authoringConfigId) => {
      cells.push({
        cellId: `${stratum}--${authoringConfigId}`,
        authoringConfigId,
        bookId: `pilot-${stratum}`,
        chapterNumber: sIdx + 1,
        stratum,
      });
    });
  });
  return cells;
}

/** The frozen balanced audit subset — one cell per stratum (the first authoring
 *  config), so a backup/adjudicator read is balanced across strata and chosen
 *  BEFORE any output exists, never by which candidate produced the output. */
export function recoveryAuditSubsetCellIds(cells: RecoveryCandidateCellV1[]): string[] {
  return cells.filter((c) => c.authoringConfigId === RECOVERY_AUTHORING_CONFIG_IDS[0]).map((c) => c.cellId);
}

// ── Fixed role assignment (pending pre-qualification) ──────────────────────────

/** The pre-qualification fixed role assignment: a single frozen assignment
 *  reused for EVERY cell (the anti-rotation invariant is structural — one object,
 *  no executionOrder dependence). All slots are PENDING until qualification. */
export function buildPendingRoleAssignment(): FixedRoleAssignmentV1 {
  return {
    schema: FIXED_ROLE_ASSIGNMENT_SCHEMA,
    readerPrimary: PENDING_JUDGE,
    readerBackup: PENDING_JUDGE,
    sourcePrimary: PENDING_JUDGE,
    sourceAdjudicator: PENDING_JUDGE,
    quizChecker: { deterministic: true, checkerVersion: RECOVERY_QUIZ_PHASE2_VERSION },
    quizAdjudicator: PENDING_JUDGE,
  };
}

// ── Instrument manifest ────────────────────────────────────────────────────────

/** Build the split-lane instrument manifest (§M). Binds every behavior-affecting
 *  component so a changed prompt/schema/threshold/corpus/role-assignment policy
 *  stales a prior qualification (analog of NativeReviewInstrumentManifestV2). */
export function buildSplitLaneInstrumentManifest(
  inputs: RecoverySpecInputsV1,
  fixedRoleAssignmentSha256: string,
): SplitLaneInstrumentManifestV1 {
  return {
    schema: SPLIT_LANE_INSTRUMENT_MANIFEST_SCHEMA,
    readerRubricVersion: READER_EXPERIENCE_RUBRIC_VERSION,
    sourceRubricVersion: RECOVERY_SOURCE_RUBRIC_VERSION,
    readerSchemaSha256: inputs.readerSchemaSha256,
    sourceSchemaSha256: inputs.sourceSchemaSha256,
    quizAdjudicationSchemaSha256: inputs.quizAdjudicationSchemaSha256,
    quizPhase2Version: RECOVERY_QUIZ_PHASE2_VERSION,
    aggregationVersion: RECOVERY_AGGREGATION_VERSION,
    roleAssignmentPolicyVersion: RECOVERY_ROLE_ASSIGNMENT_POLICY_VERSION,
    fixedRoleAssignmentSha256,
    executionProfileHash: inputs.executionProfileHash,
    routePolicyVersion: inputs.routePolicyVersion,
    thresholdsSha256: inputs.thresholdsSha256,
    readerCorpusSha256: inputs.readerCorpusSha256,
    sourceCorpusSha256: inputs.sourceCorpusSha256,
    quizCorpusSha256: inputs.quizCorpusSha256,
  };
}

/** Canonical hash of an instrument manifest — a qualification records this in its
 *  `instrumentHashes`, so any manifest drift stales the qualification. */
export function splitLaneInstrumentManifestSha256(m: SplitLaneInstrumentManifestV1): string {
  return hashCanonical(m);
}

// ── Recovery experiment spec ───────────────────────────────────────────────────

/** Build the frozen recovery experiment spec (§M). Pure: identical inputs →
 *  byte-identical spec. */
export function buildRecoveryExperimentSpec(inputs: RecoverySpecInputsV1): RecoveryExperimentSpecV1 {
  const roleAssignment = buildPendingRoleAssignment();
  const fixedRoleAssignmentSha256 = hashCanonical(roleAssignment);
  const instrumentManifest = buildSplitLaneInstrumentManifest(inputs, fixedRoleAssignmentSha256);
  const cells = enumerateRecoveryCells();
  return {
    schema: RECOVERY_EXPERIMENT_SPEC_SCHEMA,
    experimentId: RECOVERY_EXPERIMENT_ID,
    stage: "diagnostic",
    title: "§16 split-lane reviewer recovery — diagnostic (prepared, not sealed)",
    contractSchemaIds: { ...RECOVERY_CONTRACT_SCHEMA_IDS },
    instrumentManifest,
    roleThresholdsSha256: inputs.thresholdsSha256,
    candidateJudgeProfiles: RECOVERY_CANDIDATE_JUDGE_PROFILES.map((p) => ({ ...p })),
    roleAssignment,
    roleAssignmentPolicyVersion: RECOVERY_ROLE_ASSIGNMENT_POLICY_VERSION,
    requiredRoles: RECOVERY_REQUIRED_ROLES,
    escalation: {
      sourceHighSeverityRequiresAdjudicator: true,
      quizAmbiguityRequiresAdjudicator: true,
      readerEscalationAdvisoryOnly: true,
    },
    strata: [...CHAPTER_STRATA],
    candidateInputs: {
      // The pilot cells ARE the diagnostic candidate inputs; the confirmatory set
      // stays empty until a clean pilot authorizes it (design §N).
      diagnostic: cells,
      confirmatory: [],
    },
    randomizationSeed: inputs.randomizationSeed,
    schedules: { pilotSeed: inputs.pilotSeed, diagnosticSeed: inputs.diagnosticSeed },
    execution: {
      authMode: "chatgpt-subscription-codex-exec",
      routePolicyVersion: inputs.routePolicyVersion,
      // Bounded infra replay ONLY (§16 control 5): at most one replay per call,
      // ONLY for disjoint provider outcomes — NEVER a content or safeguard retry,
      // NEVER output-informed resampling.
      boundedRetry: {
        maxReplaysPerCall: 1,
        replayableOutcomes: ["infrastructure_failure", "timeout", "provider_rate_or_capacity"],
      },
      callCeiling: RECOVERY_PROPOSED_HARD_CEILING,
    },
    humanAdjudicationPause: {
      required: true,
      // R-4: the 14 disputed sol source-register cases remain UNADJUDICATED
      // (owner gate). No judge is qualified from them; the retrospective marks
      // them UNADJUDICATED, never true/false.
      unadjudicatedDisputes: [
        "14 sol source-register cases UNADJUDICATED (owner gate) — see LAYER_N_V2_SPLIT_LANE_RETROSPECTIVE",
      ],
    },
    imp13Dormant: true,
    productionActivation: false,
    separateAuthorizationRequired: true,
    bookSpecificExceptions: [],
  };
}

/** Canonical hash of a recovery spec — the seal-prep binds this, so a changed
 *  role assignment (or any spec field) stales the seal (integration 11). */
export function recoverySpecSha256(spec: RecoveryExperimentSpecV1): string {
  return hashCanonical(spec);
}

/** True iff a qualification was measured under the CURRENT instrument manifest.
 *  A changed prompt/schema/threshold/corpus/role assignment changes the manifest
 *  hash, so an old qualification is NOT fresh (integration 10). */
export function recoveryQualificationIsFresh(
  qual: JudgeCapabilityQualificationV1,
  manifestSha256: string,
): boolean {
  return qual.instrumentHashes.includes(manifestSha256);
}

// ── Injected conductor dependencies (Wave-A frozen aliases only) ──────────────

/** B8 `assertNotClosed` arrives injected (guards.ts gains it in the closure WP);
 *  the recovery module never imports it directly. */
export type AssertNotClosedFn = (id: string) => void;

/**
 * The recovery conductor's full injected dependency surface — every sibling
 * Wave-B capability, bound ONLY by its Wave-A frozen function-type alias:
 *  - `aggregate` (B4)         composes the three lane results in the full run;
 *  - `assignFixedRoles` (B5)  supplies the migration harness's fixed assignment;
 *  - `assertRoleSetReady` (B6) fail-closed pre-seal gate;
 *  - `selectRoleJudges` (B6)  frozen judge selection (post-qualification);
 *  - `assertNotClosed` (B8)   closed-experiment freeze gate.
 * The integration wave passes the real implementations; this package injects
 * test doubles. `aggregate` and `assignFixedRoles` drive the full post-
 * authorization diagnostic (NOT executed here) and are bound at the type level.
 */
export type RecoveryConductorDepsV1 = {
  aggregate: AggregateChapterReviewFn;
  assignFixedRoles: AssignFixedRolesFn;
  assertRoleSetReady: AssertRoleSetReadyFn;
  selectRoleJudges: SelectRoleJudgesFn;
  assertNotClosed: AssertNotClosedFn;
};

// ── Seal preparation (never seals; fail-closed on role qualification) ──────────

export type RecoverySealPrepV1 = {
  schema: "split-lane-recovery-seal-prep-v1";
  experimentId: string;
  specSha256: string;
  instrumentManifestSha256: string;
  roleThresholdsSha256: string;
  fixedRoleAssignmentSha256: string;
  contractSchemaIds: string[];
  corpusHashes: { reader: string; source: string; quiz: string };
  /** ALWAYS false in this package: the full diagnostic is sealed only after the
   *  role-qualified reviewer set exists AND a separate authorization is granted. */
  sealed: false;
  sealBlockedReason: string;
  /** Whether the injected `assertRoleSetReady` accepts the current registry. */
  roleQualifiedSetExists: boolean;
  requiredRoles: RequiredRoleSetV1;
  proposedQualificationCalls: number;
  proposedPilotCalls: number;
  proposedHardCeiling: number;
  humanAdjudicationPauseRequired: true;
  imp13Dormant: true;
  productionActivation: false;
  separateAuthorizationRequired: true;
  preparedAt: string;
};

export type PrepareRecoverySealDeps = Pick<RecoveryConductorDepsV1, "assertRoleSetReady" | "assertNotClosed">;

/**
 * Prepare (but NEVER finalize) the recovery seal. Fail-closed:
 *  - `assertNotClosed(experimentId)` refuses a closed id (the new id passes);
 *  - `assertRoleSetReady` decides whether the role-qualified reviewer set exists.
 * The returned prep is ALWAYS `sealed:false` — sealing the full diagnostic is a
 * separate, authorization-gated action outside this package (§M "Do not seal the
 * full diagnostic until the role-qualified reviewer set exists").
 */
export function prepareRecoverySeal(
  spec: RecoveryExperimentSpecV1,
  registry: RoleQualificationRegistryV1,
  requiredRoles: RequiredRoleSetV1,
  deps: PrepareRecoverySealDeps,
  preparedAt: string,
): RecoverySealPrepV1 {
  deps.assertNotClosed(spec.experimentId);
  let roleQualifiedSetExists = false;
  let sealBlockedReason = "";
  try {
    deps.assertRoleSetReady(registry, requiredRoles);
    roleQualifiedSetExists = true;
    sealBlockedReason =
      "role-qualified reviewer set exists, but sealing the full diagnostic requires a separate authorization (not granted in this implementation package)";
  } catch (err) {
    roleQualifiedSetExists = false;
    sealBlockedReason = `role-qualified reviewer set does not exist: ${(err as Error).message}`;
  }
  return {
    schema: "split-lane-recovery-seal-prep-v1",
    experimentId: spec.experimentId,
    specSha256: recoverySpecSha256(spec),
    instrumentManifestSha256: splitLaneInstrumentManifestSha256(spec.instrumentManifest),
    roleThresholdsSha256: spec.roleThresholdsSha256,
    fixedRoleAssignmentSha256: spec.instrumentManifest.fixedRoleAssignmentSha256,
    contractSchemaIds: [
      spec.contractSchemaIds.readerExperienceReview,
      spec.contractSchemaIds.sourceIntegrityReview,
      spec.contractSchemaIds.quizIntegrityResult,
      spec.contractSchemaIds.aggregatedChapterReview,
      spec.contractSchemaIds.judgeCapabilityQualification,
    ],
    corpusHashes: {
      reader: spec.instrumentManifest.readerCorpusSha256,
      source: spec.instrumentManifest.sourceCorpusSha256,
      quiz: spec.instrumentManifest.quizCorpusSha256,
    },
    sealed: false,
    sealBlockedReason,
    roleQualifiedSetExists,
    requiredRoles,
    proposedQualificationCalls: RECOVERY_PROPOSED_QUALIFICATION_CALLS,
    proposedPilotCalls: RECOVERY_PROPOSED_PILOT_CALLS,
    proposedHardCeiling: RECOVERY_PROPOSED_HARD_CEILING,
    humanAdjudicationPauseRequired: true,
    imp13Dormant: true,
    productionActivation: false,
    separateAuthorizationRequired: true,
    preparedAt,
  };
}

export type SealRecoveryExperimentDeps = Pick<
  RecoveryConductorDepsV1,
  "assertRoleSetReady" | "assertNotClosed" | "selectRoleJudges"
>;

export type RecoverySealV1 = {
  schema: "split-lane-recovery-seal-v1";
  experimentId: string;
  specSha256: string;
  instrumentManifestSha256: string;
  sealedRoleSelection: {
    reader: string | null;
    source: string | null;
    quiz: string | null;
  };
  sealedAt: string;
};

/**
 * Actually seal the full diagnostic — GATED. Throws (fail-closed) unless the
 * injected `assertRoleSetReady` accepts the registry, so a campaign can NEVER
 * start before role qualification (integration 13). NOT invoked in this package
 * (the pilot must pass and a separate authorization must be granted first); it
 * exists so the go-forward path is present and testable. Records the frozen
 * per-role judge selection via the injected `selectRoleJudges` (B6).
 */
export function sealRecoveryExperiment(
  spec: RecoveryExperimentSpecV1,
  registry: RoleQualificationRegistryV1,
  requiredRoles: RequiredRoleSetV1,
  deps: SealRecoveryExperimentDeps,
  sealedAt: string,
): RecoverySealV1 {
  deps.assertNotClosed(spec.experimentId);
  // Fail-closed: refuses to seal until the role-qualified reviewer set exists.
  deps.assertRoleSetReady(registry, requiredRoles);
  const reader = deps.selectRoleJudges(registry, "reader");
  const source = deps.selectRoleJudges(registry, "source");
  const quiz = deps.selectRoleJudges(registry, "quiz");
  return {
    schema: "split-lane-recovery-seal-v1",
    experimentId: spec.experimentId,
    specSha256: recoverySpecSha256(spec),
    instrumentManifestSha256: splitLaneInstrumentManifestSha256(spec.instrumentManifest),
    sealedRoleSelection: {
      reader: reader.primaryProfileId,
      source: source.primaryProfileId,
      quiz: quiz.primaryProfileId,
    },
    sealedAt,
  };
}

// ── No-model recovery pilot dry run (16 cells, zero calls) ────────────────────

/** A planned spawn that the pilot would make when authorized — recorded here
 *  WITHOUT making the call. Every route is the `injected_test_runner` test route:
 *  no API, no fallback, no provider reached. */
export type PlannedRecoverySpawnV1 = {
  cellId: string;
  authoringConfigId: string;
  stratum: ChapterStratumV1;
  lane: "reader" | "source" | "quiz-derivation" | "quiz-adjudication";
  isAuditBackup: boolean;
  route: {
    executionRoute: "injected_test_runner";
    authMode: "test";
    apiKeyPresent: false;
    apiFallbackAllowed: false;
  };
};

export type RecoveryPilotDryRunV1 = {
  schema: "split-lane-recovery-pilot-dryrun-v1";
  experimentId: string;
  cellCount: number;
  auditSubsetCellIds: string[];
  plannedSpawns: PlannedRecoverySpawnV1[];
  /** Hard evidence of the no-model guarantee. */
  modelCallsMade: 0;
  apiCallsMade: 0;
  /** True iff EVERY planned route is the test route (no API, no fallback) AND no
   *  spawn was attempted. */
  routeInvariantHeld: boolean;
  /** The single fixed role-assignment hash used for EVERY cell (anti-rotation). */
  fixedRoleAssignmentSha256: string;
  stopConditions: string[];
  imp13Dormant: true;
  productionActivation: false;
  ranAt: string;
};

/** If a caller injects a spawn double, it MUST NOT be reached — a dry run makes
 *  zero calls. The double throws to make an accidental call a loud failure. */
export type DryRunSpawnGuard = () => never;

export type RunRecoveryPilotDryRunDeps = Pick<RecoveryConductorDepsV1, "assertNotClosed"> & {
  /** Optional spawn double asserted NEVER to be invoked. */
  onSpawnAttempt?: DryRunSpawnGuard;
};

const PILOT_LANES: ReadonlyArray<PlannedRecoverySpawnV1["lane"]> = [
  "reader",
  "source",
  "quiz-derivation",
  "quiz-adjudication",
];

/**
 * Prepare (NOT execute) the recovery pilot: 4 strata × 4 authoring configs × 1
 * sample = 16 candidate cells, identical inputs, fixed qualified reader/source
 * judges (policy), fixed quiz policy, frozen audit subset, no repair during
 * first-write, blind identities, preserved attempts. Makes ZERO model calls:
 * every planned spawn resolves to the `injected_test_runner` route
 * (`authMode:"test"`, no API, no fallback) and no provider is reached. The
 * closed-id gate (`assertNotClosed`) confirms the new id is not a resumed old
 * seal. Pilot is NOT run in this package (design §N).
 */
export function runRecoveryPilotDryRun(
  spec: RecoveryExperimentSpecV1,
  deps: RunRecoveryPilotDryRunDeps,
  ranAt: string,
): RecoveryPilotDryRunV1 {
  // The dry run refuses to plan a CLOSED experiment (a resumed old seal).
  deps.assertNotClosed(spec.experimentId);

  const cells = spec.candidateInputs.diagnostic;
  const auditSubsetCellIds = new Set(recoveryAuditSubsetCellIds(cells));
  const fixedRoleAssignmentSha256 = spec.instrumentManifest.fixedRoleAssignmentSha256;

  const plannedSpawns: PlannedRecoverySpawnV1[] = [];
  for (const cell of cells) {
    for (const lane of PILOT_LANES) {
      // The deterministic quiz derivation + checker are code paths, but the
      // pilot exercises the FULL two-phase quiz protocol live when authorized,
      // so both quiz phases are planned as (would-be) reads.
      plannedSpawns.push({
        cellId: cell.cellId,
        authoringConfigId: cell.authoringConfigId,
        stratum: cell.stratum,
        lane,
        isAuditBackup: false,
        route: {
          executionRoute: "injected_test_runner",
          authMode: "test",
          apiKeyPresent: false,
          apiFallbackAllowed: false,
        },
      });
    }
    // The frozen audit subset adds a backup reader + a source adjudicator read —
    // chosen by the prespecified subset, NEVER by which candidate produced output.
    if (auditSubsetCellIds.has(cell.cellId)) {
      for (const lane of ["reader", "source"] as const) {
        plannedSpawns.push({
          cellId: cell.cellId,
          authoringConfigId: cell.authoringConfigId,
          stratum: cell.stratum,
          lane,
          isAuditBackup: true,
          route: {
            executionRoute: "injected_test_runner",
            authMode: "test",
            apiKeyPresent: false,
            apiFallbackAllowed: false,
          },
        });
      }
    }
  }

  const routeInvariantHeld = plannedSpawns.every(
    (s) =>
      s.route.executionRoute === "injected_test_runner" &&
      s.route.authMode === "test" &&
      s.route.apiKeyPresent === false &&
      s.route.apiFallbackAllowed === false,
  );

  return {
    schema: "split-lane-recovery-pilot-dryrun-v1",
    experimentId: spec.experimentId,
    cellCount: cells.length,
    auditSubsetCellIds: [...auditSubsetCellIds],
    plannedSpawns,
    modelCallsMade: 0,
    apiCallsMade: 0,
    routeInvariantHeld,
    fixedRoleAssignmentSha256,
    stopConditions: [...RECOVERY_PILOT_STOP_CONDITIONS],
    imp13Dormant: true,
    productionActivation: false,
    ranAt,
  };
}

// ── Recovery artifact bytes (pure; the CLI/test writes them) ───────────────────

export type RecoveryArtifactFileV1 = { relPath: string; bytes: string };

/** The committed recovery artifacts as {relPath, bytes} pairs — PURE (no disk
 *  write). The Wave-C CLI (and test 35) writes them; every relPath is confined
 *  to the isolated experiment directory and references NO canonical tree. */
export function recoveryArtifactFiles(
  spec: RecoveryExperimentSpecV1,
  sealPrep: RecoverySealPrepV1,
  dryRun: RecoveryPilotDryRunV1,
): RecoveryArtifactFileV1[] {
  const pretty = (v: unknown): string => `${JSON.stringify(v, null, 2)}\n`;
  return [
    { relPath: `${RECOVERY_EXPERIMENT_ID}/spec.json`, bytes: pretty(spec) },
    { relPath: `${RECOVERY_EXPERIMENT_ID}/seal-prep.json`, bytes: pretty(sealPrep) },
    { relPath: `${RECOVERY_EXPERIMENT_ID}/pilot-dryrun/pilot-dryrun.json`, bytes: pretty(dryRun) },
  ];
}
