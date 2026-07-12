/**
 * IMP-20 WP-A2 — foundation tests for the migration-side shared types +
 * frozen cross-WP function signatures (src/bakeoff/migration/reviewLaneTypes.ts).
 *
 * These lock the Wave-A interface surface so no Wave-B lane can diverge:
 *  - the runtime constants (MIN_SOFT_DENOMINATOR, the schema-id set, the two
 *    role/status enum tuples) hold their frozen values and stay unique;
 *  - every frozen data type is instantiable at exactly its declared shape
 *    (typed fixtures — drift fails `tsc -p .` at Wave C);
 *  - every frozen function-type alias is implementable + callable at exactly
 *    its section-6.1 signature.
 *
 * The module is pure data with no I/O and no live model call, so this suite
 * makes ZERO spawns and touches no canonical state. It imports only the WP-A2
 * module (Wave-A). The two type-only A1 references inside reviewLaneTypes.ts are
 * erased at execution time, so this runs standalone before A1 lands on disk.
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";

import {
  MIN_SOFT_DENOMINATOR,
  REVIEW_LANE_ROLES,
  ROLE_QUALIFICATION_STATUSES,
  FIXED_ROLE_ASSIGNMENT_SCHEMA,
  ROLE_QUALIFICATION_REGISTRY_SCHEMA,
  REQUIRED_ROLE_SET_SCHEMA,
  ROLE_JUDGE_SELECTION_SCHEMA,
  ROLE_QUALIFICATION_OUTCOME_SCHEMA,
  RECOVERY_ROLE_THRESHOLDS_SCHEMA,
  SPLIT_LANE_INSTRUMENT_MANIFEST_SCHEMA,
  RECOVERY_EXPERIMENT_SPEC_SCHEMA,
  SPLIT_LANE_CORPUS_CONFIG_SCHEMA,
  DETERMINISTIC_CRITIC_BUNDLE_SCHEMA,
  CLOSED_EXPERIMENT_REGISTRY_SCHEMA,
} from "../src/bakeoff/migration/reviewLaneTypes.js";
import type {
  ReviewLaneRole,
  RoleQualificationStatus,
  RoleJudgeRefV1,
  FixedRoleAssignmentV1,
  RoleQualificationRegistryV1,
  RequiredRoleSetV1,
  RoleJudgeSelectionV1,
  RoleQualificationOutcomeV1,
  SoftThresholdV1,
  RecoveryRoleThresholdsV1,
  DeterministicCriticBundleV1,
  SplitLaneCorpusConfigV1,
  SplitLaneInstrumentManifestV1,
  RecoveryExperimentSpecV1,
  ClosedExperimentRegistryV1,
  AggregateChapterReviewFn,
  AssignFixedRolesFn,
  AssertRoleSetReadyFn,
  SelectRoleJudgesFn,
  QualifyRoleFn,
} from "../src/bakeoff/migration/reviewLaneTypes.js";

// ── shared fixtures ───────────────────────────────────────────────────────────

const judge: RoleJudgeRefV1 = { profileId: "gpt-5.5@high", model: "gpt-5.5", effort: "high" };

const fixedRoleAssignment: FixedRoleAssignmentV1 = {
  schema: FIXED_ROLE_ASSIGNMENT_SCHEMA,
  readerPrimary: judge,
  readerBackup: { profileId: "gpt-5.5@xhigh", model: "gpt-5.5", effort: "xhigh" },
  sourcePrimary: judge,
  sourceAdjudicator: { profileId: "gpt-5.6-sol@high", model: "gpt-5.6-sol", effort: "high" },
  quizChecker: { deterministic: true, checkerVersion: "quiz-tell-checker-v1" },
  quizAdjudicator: judge,
};

const requiredRoles: RequiredRoleSetV1 = {
  schema: REQUIRED_ROLE_SET_SCHEMA,
  reader: { primary: true, backup: true },
  source: { primary: true, independentAdjudicator: true, blindHumanAdjudicationPath: false },
  quiz: { deterministicChecker: true, semanticAdjudicator: true },
};

// The registry binds WP-A1 JudgeCapabilityQualificationV1 records; an empty
// array exercises the shape without constructing an A1 type here.
const registry: RoleQualificationRegistryV1 = {
  schema: ROLE_QUALIFICATION_REGISTRY_SCHEMA,
  profiles: [],
};

const selection: RoleJudgeSelectionV1 = {
  schema: ROLE_JUDGE_SELECTION_SCHEMA,
  role: "reader",
  status: "SELECTED",
  primaryProfileId: "gpt-5.5@high",
  backupProfileId: "gpt-5.5@xhigh",
  blockedReason: null,
  selectionRationale: ["highest held-out alignment", "lower high-severity FP rate"],
};

const outcome: RoleQualificationOutcomeV1 = {
  schema: ROLE_QUALIFICATION_OUTCOME_SCHEMA,
  role: "reader",
  status: "QUALIFIED",
  refusedUnderpowered: false,
  underpoweredMetrics: [],
  failedThresholds: [],
};

const softBar: SoftThresholdV1 = { minRate: 0.85, minDenominator: MIN_SOFT_DENOMINATOR, zeroMiss: false };
const thresholds: RecoveryRoleThresholdsV1 = {
  schema: RECOVERY_ROLE_THRESHOLDS_SCHEMA,
  thresholdsVersion: "recovery-role-thresholds-v1",
  reader: { cleanPass: softBar },
  source: { fabrication: { minRate: 1, minDenominator: 0, zeroMiss: true } },
  quiz: { ambiguity: softBar },
};

const criticBundle: DeterministicCriticBundleV1 = {
  schema: DETERMINISTIC_CRITIC_BUNDLE_SCHEMA,
  checks: [],
  bundleSha256: "0".repeat(64),
};

const corpusConfig: SplitLaneCorpusConfigV1 = {
  schema: SPLIT_LANE_CORPUS_CONFIG_SCHEMA,
  role: "source",
  sourceRoots: { bookPackagesDir: "book-packages", sidecarRoot: ".chapterflow/runs", sourcePlanRoot: undefined },
  mutationSpecPath: "migration-experiments/contracts/source-corpus-spec.json",
  cleanBaseScoreLedgerPath: "migration-experiments/contracts/clean-base-score-ledger.v1.json",
  excludedCandidateBookIds: ["start-with-why", "radical-candor"],
  minRenderBytes: 1200,
};

const instrumentManifest: SplitLaneInstrumentManifestV1 = {
  schema: SPLIT_LANE_INSTRUMENT_MANIFEST_SCHEMA,
  readerRubricVersion: "reader-experience-review-v1",
  sourceRubricVersion: "source-integrity-review-v1",
  readerSchemaSha256: "a".repeat(64),
  sourceSchemaSha256: "b".repeat(64),
  quizAdjudicationSchemaSha256: "c".repeat(64),
  quizPhase2Version: "quiz-integrity-adjudication-v1",
  aggregationVersion: "aggregated-chapter-review-v1",
  roleAssignmentPolicyVersion: "fixed-role-assignment-v1",
  fixedRoleAssignmentSha256: "d".repeat(64),
  executionProfileHash: "e".repeat(64),
  routePolicyVersion: "route-policy-v1",
  thresholdsSha256: "f".repeat(64),
  readerCorpusSha256: "1".repeat(64),
  sourceCorpusSha256: "2".repeat(64),
  quizCorpusSha256: "3".repeat(64),
};

const recoverySpec: RecoveryExperimentSpecV1 = {
  schema: RECOVERY_EXPERIMENT_SPEC_SCHEMA,
  experimentId: "s16-reviewer-recovery-v1",
  stage: "diagnostic",
  title: "Split-lane reviewer recovery — diagnostic",
  contractSchemaIds: {
    readerExperienceReview: "reader-experience-review-v1",
    sourceIntegrityReview: "source-integrity-review-v1",
    quizIntegrityResult: "quiz-integrity-result-v1",
    aggregatedChapterReview: "aggregated-chapter-review-v1",
    judgeCapabilityQualification: "judge-capability-qualification-v1",
  },
  instrumentManifest,
  roleThresholdsSha256: "9".repeat(64),
  candidateJudgeProfiles: [
    { profileId: "gpt-5.5@high", model: "gpt-5.5", effort: "high" },
    { profileId: "gpt-5.6-sol@high", model: "gpt-5.6-sol", effort: "high" },
  ],
  roleAssignment: fixedRoleAssignment,
  roleAssignmentPolicyVersion: "fixed-role-assignment-v1",
  requiredRoles,
  escalation: {
    sourceHighSeverityRequiresAdjudicator: true,
    quizAmbiguityRequiresAdjudicator: true,
    readerEscalationAdvisoryOnly: true,
  },
  strata: ["research-heavy", "abstract-conceptual", "example-heavy", "causal-quiz-sensitive"],
  candidateInputs: { diagnostic: [], confirmatory: [] },
  randomizationSeed: "seed-recovery-v1",
  schedules: { pilotSeed: "pilot-seed", diagnosticSeed: "diagnostic-seed" },
  execution: {
    authMode: "chatgpt-subscription-codex-exec",
    routePolicyVersion: "route-policy-v1",
    boundedRetry: { maxReplaysPerCall: 1, replayableOutcomes: ["provider_error"] },
    callCeiling: 640,
  },
  humanAdjudicationPause: { required: true, unadjudicatedDisputes: [] },
  imp13Dormant: true,
  productionActivation: false,
  separateAuthorizationRequired: true,
  bookSpecificExceptions: [],
};

const closure: ClosedExperimentRegistryV1 = {
  schema: CLOSED_EXPERIMENT_REGISTRY_SCHEMA,
  status: "ARCHIVED_INCONCLUSIVE_REVIEW_INSTRUMENT_MISMATCH",
  closedExperimentIds: ["layer-n-v2-qualification"],
  oldSeals: [{ experimentId: "layer-n-v2-qualification", sealId: "seal-1", sealSha256: "7".repeat(64) }],
  callLedger: {
    campaignTotalConsumed: 711,
    totalLiveCallsEverIncludingLayerNv1: 811,
    stageQLayerOCalls: 540,
    layerNv2Calls: 171,
    layerNv1Calls: 100,
    sealedHardMax: 2096,
    diagnosticCalls: 0,
    confirmatoryCalls: 0,
  },
  stageQHistory: ["stage-q-layer-o-v3: ALL_THREE_JUDGES_QUALIFIED (U2 open)"],
  layerNHistory: ["layer-n-v2: PANEL_NOT_QUALIFIED 1/3"],
  preservedArtifactHashes: {},
  authoringMigrationDecisionProduced: false,
  oldArtifactsImmutable: true,
  oldResultsAreDevelopmentEvidence: true,
  canResume: false,
  unresolvedRisks: ["R-2b stage-q raw-spawn residual"],
  closedAt: "2026-07-12T00:00:00.000Z",
};

// ── runtime constant assertions ───────────────────────────────────────────────

test("MIN_SOFT_DENOMINATOR is the frozen underpowered floor (10)", () => {
  assert.equal(MIN_SOFT_DENOMINATOR, 10);
});

test("review-lane roles + qualification statuses hold their frozen values", () => {
  assert.deepEqual([...REVIEW_LANE_ROLES], ["reader", "source", "quiz"]);
  assert.deepEqual([...ROLE_QUALIFICATION_STATUSES], ["QUALIFIED", "NOT_QUALIFIED", "NOT_TESTED"]);
});

test("every migration schema-id constant holds its frozen literal and the set is unique", () => {
  const ids: Record<string, string> = {
    FIXED_ROLE_ASSIGNMENT_SCHEMA,
    ROLE_QUALIFICATION_REGISTRY_SCHEMA,
    REQUIRED_ROLE_SET_SCHEMA,
    ROLE_JUDGE_SELECTION_SCHEMA,
    ROLE_QUALIFICATION_OUTCOME_SCHEMA,
    RECOVERY_ROLE_THRESHOLDS_SCHEMA,
    SPLIT_LANE_INSTRUMENT_MANIFEST_SCHEMA,
    RECOVERY_EXPERIMENT_SPEC_SCHEMA,
    SPLIT_LANE_CORPUS_CONFIG_SCHEMA,
    DETERMINISTIC_CRITIC_BUNDLE_SCHEMA,
    CLOSED_EXPERIMENT_REGISTRY_SCHEMA,
  };
  assert.equal(FIXED_ROLE_ASSIGNMENT_SCHEMA, "split-lane-fixed-role-assignment-v1");
  assert.equal(ROLE_QUALIFICATION_REGISTRY_SCHEMA, "split-lane-role-qualification-registry-v1");
  assert.equal(REQUIRED_ROLE_SET_SCHEMA, "split-lane-required-role-set-v1");
  assert.equal(ROLE_JUDGE_SELECTION_SCHEMA, "split-lane-role-judge-selection-v1");
  assert.equal(ROLE_QUALIFICATION_OUTCOME_SCHEMA, "split-lane-role-qualification-outcome-v1");
  assert.equal(RECOVERY_ROLE_THRESHOLDS_SCHEMA, "split-lane-recovery-role-thresholds-v1");
  assert.equal(SPLIT_LANE_INSTRUMENT_MANIFEST_SCHEMA, "split-lane-instrument-manifest-v1");
  assert.equal(RECOVERY_EXPERIMENT_SPEC_SCHEMA, "split-lane-recovery-experiment-spec-v1");
  assert.equal(SPLIT_LANE_CORPUS_CONFIG_SCHEMA, "split-lane-corpus-builder-config-v1");
  assert.equal(DETERMINISTIC_CRITIC_BUNDLE_SCHEMA, "split-lane-deterministic-critic-bundle-v1");
  assert.equal(CLOSED_EXPERIMENT_REGISTRY_SCHEMA, "split-lane-closed-experiment-registry-v1");

  const values = Object.values(ids);
  assert.equal(new Set(values).size, values.length, "schema ids must be unique");
  for (const v of values) assert.ok(v.startsWith("split-lane-"), `namespaced: ${v}`);
});

// ── frozen data-type shape assertions ─────────────────────────────────────────

test("FixedRoleAssignmentV1 carries all six role slots with a deterministic quiz checker", () => {
  assert.equal(fixedRoleAssignment.schema, FIXED_ROLE_ASSIGNMENT_SCHEMA);
  for (const slot of ["readerPrimary", "readerBackup", "sourcePrimary", "sourceAdjudicator", "quizAdjudicator"] as const) {
    const ref = fixedRoleAssignment[slot];
    assert.ok(ref.profileId && ref.model && ref.effort, `${slot} is a judge ref`);
  }
  assert.equal(fixedRoleAssignment.quizChecker.deterministic, true);
  assert.equal(typeof fixedRoleAssignment.quizChecker.checkerVersion, "string");
});

test("RequiredRoleSetV1 encodes the §F required-role structure", () => {
  assert.equal(requiredRoles.schema, REQUIRED_ROLE_SET_SCHEMA);
  assert.equal(requiredRoles.reader.primary, true);
  assert.equal(requiredRoles.reader.backup, true);
  // source: independent adjudicator OR a blind-human path — both fields present.
  assert.equal(typeof requiredRoles.source.independentAdjudicator, "boolean");
  assert.equal(typeof requiredRoles.source.blindHumanAdjudicationPath, "boolean");
  assert.equal(requiredRoles.quiz.deterministicChecker, true);
  assert.equal(requiredRoles.quiz.semanticAdjudicator, true);
});

test("RoleJudgeSelectionV1 exposes SELECTED/BLOCKED with a tie-break rationale", () => {
  assert.equal(selection.schema, ROLE_JUDGE_SELECTION_SCHEMA);
  assert.ok(["SELECTED", "BLOCKED"].includes(selection.status));
  assert.ok(Array.isArray(selection.selectionRationale));
  const blocked: RoleJudgeSelectionV1 = {
    schema: ROLE_JUDGE_SELECTION_SCHEMA,
    role: "source",
    status: "BLOCKED",
    primaryProfileId: null,
    backupProfileId: null,
    blockedReason: "only one profile qualifies for a safety-critical role and no independent adjudication path",
    selectionRationale: [],
  };
  assert.equal(blocked.status, "BLOCKED");
  assert.equal(blocked.primaryProfileId, null);
});

test("RoleQualificationOutcomeV1 separates refusedUnderpowered from NOT_QUALIFIED", () => {
  assert.equal(outcome.schema, ROLE_QUALIFICATION_OUTCOME_SCHEMA);
  const statuses: readonly RoleQualificationStatus[] = ROLE_QUALIFICATION_STATUSES;
  assert.ok(statuses.includes(outcome.status));
  assert.equal(outcome.refusedUnderpowered, false);
  const underpowered: RoleQualificationOutcomeV1 = {
    schema: ROLE_QUALIFICATION_OUTCOME_SCHEMA,
    role: "quiz",
    status: "NOT_TESTED",
    refusedUnderpowered: true,
    underpoweredMetrics: ["quizAmbiguityDetectionRate"],
    failedThresholds: [],
  };
  assert.equal(underpowered.refusedUnderpowered, true);
  assert.notEqual(underpowered.status, "NOT_QUALIFIED");
});

test("RecoveryRoleThresholdsV1 carries per-role soft bars with paired minimum denominators", () => {
  assert.equal(thresholds.schema, RECOVERY_ROLE_THRESHOLDS_SCHEMA);
  for (const role of REVIEW_LANE_ROLES) {
    assert.equal(typeof thresholds[role], "object");
  }
  assert.equal(thresholds.reader.cleanPass.minDenominator, MIN_SOFT_DENOMINATOR);
  assert.equal(thresholds.source.fabrication.zeroMiss, true);
});

test("DeterministicCriticBundleV1 is the full CriticFinding bundle with a bundle sha", () => {
  assert.equal(criticBundle.schema, DETERMINISTIC_CRITIC_BUNDLE_SCHEMA);
  assert.ok(Array.isArray(criticBundle.checks));
  assert.equal(criticBundle.bundleSha256.length, 64);
});

test("SplitLaneCorpusConfigV1 carries typed injected roots + fail-closed spec paths", () => {
  assert.equal(corpusConfig.schema, SPLIT_LANE_CORPUS_CONFIG_SCHEMA);
  const roles: readonly ReviewLaneRole[] = REVIEW_LANE_ROLES;
  assert.ok(roles.includes(corpusConfig.role));
  assert.equal(typeof corpusConfig.sourceRoots.bookPackagesDir, "string");
  assert.ok(corpusConfig.mutationSpecPath.length > 0);
  assert.ok(corpusConfig.cleanBaseScoreLedgerPath.length > 0);
  assert.deepEqual(corpusConfig.excludedCandidateBookIds, ["start-with-why", "radical-candor"]);
});

test("SplitLaneInstrumentManifestV1 binds a role-assignment component so an assignment change stales qualification", () => {
  assert.equal(instrumentManifest.schema, SPLIT_LANE_INSTRUMENT_MANIFEST_SCHEMA);
  assert.equal(typeof instrumentManifest.roleAssignmentPolicyVersion, "string");
  assert.equal(instrumentManifest.fixedRoleAssignmentSha256.length, 64);
  for (const k of ["readerCorpusSha256", "sourceCorpusSha256", "quizCorpusSha256"] as const) {
    assert.equal(instrumentManifest[k].length, 64);
  }
});

test("RecoveryExperimentSpecV1 pins the safety invariants at the type level", () => {
  assert.equal(recoverySpec.schema, RECOVERY_EXPERIMENT_SPEC_SCHEMA);
  assert.equal(recoverySpec.experimentId, "s16-reviewer-recovery-v1");
  // literal-typed invariants — the type forbids any other value.
  assert.equal(recoverySpec.imp13Dormant, true);
  assert.equal(recoverySpec.productionActivation, false);
  assert.equal(recoverySpec.separateAuthorizationRequired, true);
  assert.deepEqual(recoverySpec.bookSpecificExceptions, []);
  assert.equal(recoverySpec.execution.authMode, "chatgpt-subscription-codex-exec");
  assert.equal(recoverySpec.roleAssignment.schema, FIXED_ROLE_ASSIGNMENT_SCHEMA);
  assert.equal(recoverySpec.candidateJudgeProfiles.length, 2);
});

test("ClosedExperimentRegistryV1 records both call totals and cannot resume", () => {
  assert.equal(closure.schema, CLOSED_EXPERIMENT_REGISTRY_SCHEMA);
  assert.equal(closure.status, "ARCHIVED_INCONCLUSIVE_REVIEW_INSTRUMENT_MISMATCH");
  assert.equal(closure.callLedger.campaignTotalConsumed, 711);
  assert.equal(closure.callLedger.totalLiveCallsEverIncludingLayerNv1, 811);
  assert.equal(closure.callLedger.diagnosticCalls, 0);
  assert.equal(closure.callLedger.confirmatoryCalls, 0);
  assert.equal(closure.authoringMigrationDecisionProduced, false);
  assert.equal(closure.canResume, false);
  assert.equal(closure.oldArtifactsImmutable, true);
});

// ── frozen function-type alias assertions (section 6.1) ───────────────────────

test("AssignFixedRolesFn is implementable + returns a FixedRoleAssignmentV1", () => {
  const assign: AssignFixedRolesFn = () => fixedRoleAssignment;
  // spec/record are unused by this fake; call through casts to exercise it.
  const out = assign({} as never, {} as never);
  assert.equal(out.schema, FIXED_ROLE_ASSIGNMENT_SCHEMA);
  assert.equal(out.readerPrimary.profileId, "gpt-5.5@high");
});

test("QualifyRoleFn is implementable + returns a RoleQualificationOutcomeV1", () => {
  const qualify: QualifyRoleFn = (role, _metrics, _thresholds, denominators) => ({
    schema: ROLE_QUALIFICATION_OUTCOME_SCHEMA,
    role,
    status: (denominators.cleanPass ?? 0) < MIN_SOFT_DENOMINATOR ? "NOT_TESTED" : "QUALIFIED",
    refusedUnderpowered: (denominators.cleanPass ?? 0) < MIN_SOFT_DENOMINATOR,
    underpoweredMetrics: (denominators.cleanPass ?? 0) < MIN_SOFT_DENOMINATOR ? ["cleanPass"] : [],
    failedThresholds: [],
  });
  const powered = qualify("reader", { cleanPass: 0.9 }, thresholds, { cleanPass: 12 });
  assert.equal(powered.refusedUnderpowered, false);
  const underpowered = qualify("reader", { cleanPass: 1 }, thresholds, { cleanPass: 4 });
  assert.equal(underpowered.refusedUnderpowered, true);
  assert.equal(underpowered.status, "NOT_TESTED");
});

test("SelectRoleJudgesFn + AssertRoleSetReadyFn are implementable at their frozen signatures", () => {
  const select: SelectRoleJudgesFn = (_registry, role) => ({ ...selection, role });
  assert.equal(select(registry, "quiz").role, "quiz");

  let asserted = false;
  const assertReady: AssertRoleSetReadyFn = (reg, req) => {
    // fail-closed shape: a real impl throws when a required role is unmet.
    if (req.reader.primary && reg.profiles.length === 0) asserted = true;
  };
  assertReady(registry, requiredRoles);
  assert.equal(asserted, true);
});

test("AggregateChapterReviewFn is implementable at its section-6.1 signature", () => {
  // The return type is a WP-A1 contract; assert assignability + callability
  // without constructing the A1 shape here.
  const aggregate: AggregateChapterReviewFn = () => ({}) as never;
  assert.equal(typeof aggregate, "function");
  assert.doesNotThrow(() => aggregate({} as never));
});
