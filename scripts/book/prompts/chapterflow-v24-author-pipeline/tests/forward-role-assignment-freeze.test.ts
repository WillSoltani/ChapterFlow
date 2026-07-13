/** IMP-22 post-qualification role-freeze tests. No executor/provider is used. */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import { hashCanonical } from "../src/contracts/contractUtil.js";
import type { JudgeCapabilityQualificationV1 } from "../src/contracts/judgeCapabilityQualification.js";
import {
  buildRecoveryExperimentSpec,
} from "../src/bakeoff/migration/recoveryExperiment.js";
import {
  FIXED_ROLE_ASSIGNMENT_SCHEMA,
  ROLE_QUALIFICATION_REGISTRY_SCHEMA,
  type FixedRoleAssignmentV1,
  type RoleQualificationRegistryV1,
} from "../src/bakeoff/migration/reviewLaneTypes.js";
import {
  ROLE_QUALIFICATION_ATTEMPT_SCHEMA,
  ROLE_QUALIFICATION_FREEZE_SCHEMA,
  ROLE_QUALIFICATION_RECEIPT_SCHEMA,
  ROLE_QUALIFICATION_RUNNER_SCHEMA,
  type ProfileRoleQualificationV1,
  type RoleQualificationAttemptV1,
  type RoleQualificationRunnerResultV1,
} from "../src/bakeoff/migration/roleQualificationRunner.js";
import {
  FORWARD_AUDIT_SUBSET_POLICY_SCHEMA,
  FORWARD_DISAGREEMENT_POLICY_SCHEMA,
  FORWARD_ESCALATION_POLICY_SCHEMA,
  FORWARD_QUALIFICATION_INSTRUMENT_BINDING_SCHEMA,
  FORWARD_ROLE_ASSIGNMENT_FREEZE_SCHEMA,
  ForwardRoleAssignmentFreezeError,
  assertForwardAssignmentIndependence,
  assertForwardRoleAssignmentFreezeFresh,
  buildForwardRoleAssignmentFreeze,
  isInForwardReaderAuditSubset,
  sealForwardRoleQualification,
  type ForwardQualificationInstrumentBindingV1,
  type ForwardRoleFreezePoliciesV1,
} from "../src/orchestrator/forwardRoleAssignmentFreeze.js";
import { FORWARD_FROZEN_REVIEW_CONFIG_SCHEMA } from "../src/orchestrator/forwardChapterConductor.js";

const sha = (char: string): string => char.repeat(64);
const corpusHashes = {
  reader: `sha256:${sha("a")}`,
  source: `sha256:${sha("b")}`,
  quiz: `sha256:${sha("c")}`,
};
const schemaHashes = { reader: sha("d"), source: sha("e"), quiz: sha("f") };

const profiles = {
  readerPrimary: { profileId: "gpt-5.6-sol@high", model: "gpt-5.6-sol", effort: "high" as const },
  readerAuditSourcePrimary: { profileId: "gpt-5.6-sol@xhigh", model: "gpt-5.6-sol", effort: "xhigh" as const },
  sourceAdjudicator: { profileId: "gpt-5.5@xhigh", model: "gpt-5.5", effort: "xhigh" as const },
};

function roleRecord(
  role: "reader" | "source" | "quiz",
  profile: typeof profiles[keyof typeof profiles],
): ProfileRoleQualificationV1 {
  return {
    role,
    profile,
    candidateIndex: 0,
    calibrationCompleted: true,
    calibrationValid: true,
    holdoutStarted: true,
    holdoutCaseCount: 10,
    metrics: {
      metrics: {},
      denominators: {},
      numerators: {},
      counts: { hardFalsePositives: 0, highSeverityFalsePositives: 0, unresolvedRequiredCases: 0 },
    },
    outcome: {
      schema: "split-lane-role-qualification-outcome-v1",
      role,
      status: "QUALIFIED",
      refusedUnderpowered: false,
      underpoweredMetrics: [],
      failedThresholds: [],
    },
  };
}

function attempt(role: "reader" | "source" | "quiz", profileId: string, ordinal: number): RoleQualificationAttemptV1 {
  return {
    schema: ROLE_QUALIFICATION_ATTEMPT_SCHEMA,
    scheduleId: `qual-${ordinal}`,
    attemptId: `qual-${ordinal}-a1`,
    replayOfAttemptId: null,
    attemptNumber: 1,
    role,
    partition: "holdout",
    caseId: `${role}-case-${ordinal}`,
    family: "fixture",
    profileId,
    receipt: {
      schema: ROLE_QUALIFICATION_RECEIPT_SCHEMA,
      executionId: `exec-${ordinal}`,
      status: "completed",
      role,
      profileId,
      model: profileId.split("@")[0],
      effort: profileId.endsWith("@xhigh") ? "xhigh" : "high",
      schemaSha256: schemaHashes[role],
      rawOutput: "{}",
    },
    routeValid: true,
    replayEligible: false,
    rawOutputSha256: sha("1"),
    evaluation: {
      protocolValid: true,
      resolved: true,
      evidenceSpanValid: true,
      error: null,
      result: "PASS",
      blockingCategories: [],
      supportStatus: null,
      visibleRegister: null,
      keyCorrect: null,
      keyedMechanismSupported: null,
    },
    terminalReason: "completed",
  };
}

function qualificationFixture(): { result: RoleQualificationRunnerResultV1; registry: RoleQualificationRegistryV1 } {
  const schedule = [
    { scheduleId: "qual-1", ordinal: 0, wave: 0, partition: "holdout" as const, role: "reader" as const, profileId: profiles.readerPrimary.profileId, caseId: "r1", family: "fixture", promptSha256: sha("2"), caseSha256: sha("3") },
    { scheduleId: "qual-2", ordinal: 1, wave: 0, partition: "holdout" as const, role: "source" as const, profileId: profiles.readerAuditSourcePrimary.profileId, caseId: "s1", family: "fixture", promptSha256: sha("4"), caseSha256: sha("5") },
    { scheduleId: "qual-3", ordinal: 2, wave: 0, partition: "holdout" as const, role: "quiz" as const, profileId: profiles.readerAuditSourcePrimary.profileId, caseId: "q1", family: "fixture", promptSha256: sha("6"), caseSha256: sha("7") },
  ];
  const freezeDraft = {
    schema: ROLE_QUALIFICATION_FREEZE_SCHEMA,
    maxParallel: 2 as const,
    candidateOrderSha256: sha("8"),
    thresholdsSha256: sha("9"),
    schemaHashesSha256: hashCanonical(schemaHashes),
    candidateAvailabilitySha256: sha("1"),
    corpusHashes,
    corpusEnvelopeHashes: { reader: sha("a"), source: sha("b"), quiz: sha("c") },
    promptBundleHashes: { reader: sha("d"), source: sha("e"), quiz: sha("f") },
    scheduleSha256: hashCanonical(schedule),
    missingEvidenceProbeSha256: sha("0"),
  };
  const freeze = { ...freezeDraft, freezeSha256: hashCanonical(freezeDraft) };
  const registryProfile = (
    profile: typeof profiles[keyof typeof profiles],
    statuses: Pick<JudgeCapabilityQualificationV1, "readerExperience" | "sourceIntegrity" | "quizIntegrity">,
  ): JudgeCapabilityQualificationV1 => ({
    ...profile,
    ...statuses,
    securityBoundary: "NOT_TESTED",
    evidenceHashes: [sha(profile.effort === "high" ? "1" : profile.model === "gpt-5.5" ? "2" : "3")],
    corpusHashes: Object.values(corpusHashes),
    instrumentHashes: [freeze.freezeSha256],
    qualifiedAt: "2026-07-12T12:00:00.000Z",
  });
  const registry: RoleQualificationRegistryV1 = {
    schema: ROLE_QUALIFICATION_REGISTRY_SCHEMA,
    profiles: [
      registryProfile(profiles.readerPrimary, { readerExperience: "QUALIFIED", sourceIntegrity: "NOT_TESTED", quizIntegrity: "NOT_TESTED" }),
      registryProfile(profiles.readerAuditSourcePrimary, { readerExperience: "QUALIFIED", sourceIntegrity: "QUALIFIED", quizIntegrity: "QUALIFIED" }),
      registryProfile(profiles.sourceAdjudicator, { readerExperience: "NOT_TESTED", sourceIntegrity: "QUALIFIED", quizIntegrity: "NOT_TESTED" }),
    ],
  };
  const result: RoleQualificationRunnerResultV1 = {
    schema: ROLE_QUALIFICATION_RUNNER_SCHEMA,
    freeze,
    schedule,
    attempts: [
      attempt("reader", profiles.readerPrimary.profileId, 1),
      attempt("reader", profiles.readerAuditSourcePrimary.profileId, 2),
      attempt("source", profiles.readerAuditSourcePrimary.profileId, 3),
      attempt("source", profiles.sourceAdjudicator.profileId, 4),
      attempt("quiz", profiles.readerAuditSourcePrimary.profileId, 5),
    ],
    sourceMissingEvidenceProbes: [],
    profileRoleResults: [
      roleRecord("reader", profiles.readerPrimary),
      roleRecord("reader", profiles.readerAuditSourcePrimary),
      roleRecord("source", profiles.readerAuditSourcePrimary),
      roleRecord("source", profiles.sourceAdjudicator),
      roleRecord("quiz", profiles.readerAuditSourcePrimary),
    ],
    qualifiers: {
      reader: [profiles.readerPrimary.profileId, profiles.readerAuditSourcePrimary.profileId],
      source: [profiles.readerAuditSourcePrimary.profileId, profiles.sourceAdjudicator.profileId],
      quiz: [profiles.readerAuditSourcePrimary.profileId],
    },
    selected: {
      readerPrimary: profiles.readerPrimary.profileId,
      readerAudit: profiles.readerAuditSourcePrimary.profileId,
      sourcePrimary: profiles.readerAuditSourcePrimary.profileId,
      sourceAdjudicator: profiles.sourceAdjudicator.profileId,
      quizSemanticAdjudicator: profiles.readerAuditSourcePrimary.profileId,
    },
    registry,
    roleSetReady: true,
    roleSetBlockedReason: null,
  };
  return { result, registry };
}

function bindingInput(): Omit<ForwardQualificationInstrumentBindingV1, "qualificationPromptBundleHashes"> {
  return {
    schema: FORWARD_QUALIFICATION_INSTRUMENT_BINDING_SCHEMA,
    schemaHashes,
    promptSourceHashes: { reader: sha("1"), source: sha("2"), quiz: sha("3"), aggregate: sha("4") },
    instrumentVersions: {
      reader: "reader-experience-review-v1",
      source: "source-integrity-review-v1",
      quiz: "quiz-integrity-adjudication-v1",
      aggregate: "aggregated-chapter-review-v1",
    },
    executionRoute: {
      authMode: "chatgpt-subscription-codex-exec",
      executionProfileHash: sha("5"),
      routePolicyVersion: "route-policy-v1.0",
      routeEvidenceSha256: sha("6"),
      apiAllowed: false,
      apiFallbackAllowed: false,
      apiCallsMade: 0,
    },
  };
}

function policies(): ForwardRoleFreezePoliciesV1 {
  return {
    auditSubset: {
      schema: FORWARD_AUDIT_SUBSET_POLICY_SCHEMA,
      policyVersion: "balanced-forward-reader-audit-v1",
      strategy: "sha256-chapter-coordinate-bucket-v1",
      salt: "imp22-forward-reader-audit-v1",
      modulus: 4,
      includedBuckets: [0],
      coordinateFields: ["bookId", "chapterNumber"],
      frozenBeforeCandidateOutput: true,
      outputIndependent: true,
    },
    escalation: {
      schema: FORWARD_ESCALATION_POLICY_SCHEMA,
      sourceHighSeverityRequiresAdjudicator: true,
      quizAmbiguityRequiresAdjudicator: true,
      readerEscalationAdvisoryOnly: true,
      adjudicatorOperationalFailure: "INCONCLUSIVE",
      outputInformedJudgeRotationAllowed: false,
    },
    disagreement: {
      schema: FORWARD_DISAGREEMENT_POLICY_SCHEMA,
      policyVersion: "fail-closed-forward-disagreement-v1",
      readerPrimaryAuditDisagreement: "REVISE",
      sourceHighSeverityUnresolvedDisagreement: "INCONCLUSIVE",
      quizDeterministicBlockerPrevails: true,
      quizUnresolvedSemanticDisagreement: "INCONCLUSIVE",
      outputInformedResamplingAllowed: false,
      independenceLimitations: {
        readerAudit: { allowSameExactProfile: false, reason: null, mitigation: null },
        sourceAdjudicator: { allowSameExactProfile: false, reason: null, mitigation: null },
      },
    },
  };
}

function completeFixture() {
  const { result, registry } = qualificationFixture();
  const qualification = sealForwardRoleQualification({
    experimentId: "s16-forward-role-qualification-v1",
    result,
    registry,
    instrumentBinding: bindingInput(),
    sealedAt: "2026-07-12T12:30:00.000Z",
  });
  const currentInstrumentBinding = qualification.instrumentBinding;
  const baseRecoverySpec = buildRecoveryExperimentSpec({
    readerSchemaSha256: schemaHashes.reader,
    sourceSchemaSha256: schemaHashes.source,
    quizAdjudicationSchemaSha256: schemaHashes.quiz,
    executionProfileHash: currentInstrumentBinding.executionRoute.executionProfileHash,
    routePolicyVersion: currentInstrumentBinding.executionRoute.routePolicyVersion,
    thresholdsSha256: result.freeze.thresholdsSha256,
    readerCorpusSha256: corpusHashes.reader,
    sourceCorpusSha256: corpusHashes.source,
    quizCorpusSha256: corpusHashes.quiz,
    randomizationSeed: "fixture-randomization",
    pilotSeed: "fixture-pilot",
    diagnosticSeed: "fixture-diagnostic",
  });
  return { qualification, currentInstrumentBinding, baseRecoverySpec };
}

test("post-qualification freeze produces exact fixed roles, an IMP-20 recovery seal, and a conductor-ready config", () => {
  const fx = completeFixture();
  const freeze = buildForwardRoleAssignmentFreeze({
    ...fx,
    currentInstrumentBindingSha256: hashCanonical(fx.currentInstrumentBinding),
    baseRecoverySpecSha256: hashCanonical(fx.baseRecoverySpec),
    policies: policies(),
    readerBar: 80,
    frozenAt: "2026-07-12T13:00:00.000Z",
  });
  assert.equal(freeze.schema, FORWARD_ROLE_ASSIGNMENT_FREEZE_SCHEMA);
  assert.equal(freeze.roleAssignment.readerPrimary.profileId, profiles.readerPrimary.profileId);
  assert.equal(freeze.roleAssignment.readerBackup.profileId, profiles.readerAuditSourcePrimary.profileId);
  assert.equal(freeze.roleAssignment.sourcePrimary.profileId, profiles.readerAuditSourcePrimary.profileId);
  assert.equal(freeze.roleAssignment.sourceAdjudicator.profileId, profiles.sourceAdjudicator.profileId);
  assert.equal(freeze.roleAssignment.quizAdjudicator.profileId, profiles.readerAuditSourcePrimary.profileId);
  assert.equal(freeze.roleAssignment.quizChecker.checkerVersion, "quiz-answer-tell-checker-v1");
  assert.equal(freeze.recoveryExperimentSeal.schema, "split-lane-recovery-seal-v1");
  assert.equal(freeze.recoveryExperimentSeal.specSha256, freeze.recoveryExperimentSpecSha256);
  assert.equal(freeze.recoveryExperimentSpec.productionActivation, false);
  assert.equal(freeze.recoveryExperimentSpec.imp13Dormant, true);
  assert.equal(freeze.reviewConfig.schema, FORWARD_FROZEN_REVIEW_CONFIG_SCHEMA);
  assert.equal(freeze.reviewConfig.roleAssignmentSha256, freeze.roleAssignmentSha256);
  assert.equal(freeze.reviewConfig.panelPolicySha256, freeze.panelPolicySha256);
  assert.equal(freeze.reviewConfig.panelPolicy.policySha256, freeze.panelPolicy.policySha256);
  assert.equal(freeze.reviewConfig.panelPolicy.auditSubsetPolicySha256, freeze.auditSubsetPolicySha256);
  assert.equal(freeze.reviewConfig.panelPolicy.escalationPolicySha256, freeze.escalationPolicySha256);
  assert.equal(freeze.reviewConfig.panelPolicy.disagreementPolicySha256, freeze.disagreementPolicySha256);
  assert.ok(Object.isFrozen(freeze) && Object.isFrozen(freeze.reviewConfig) && Object.isFrozen(freeze.roleProfileBindings.readerPrimary));
  assert.doesNotThrow(() => assertForwardRoleAssignmentFreezeFresh(
    freeze,
    fx.qualification,
    fx.currentInstrumentBinding,
    hashCanonical(fx.currentInstrumentBinding),
  ));
});

test("sealing fails closed on a missing or unqualified required role", () => {
  const fx = qualificationFixture();
  fx.registry.profiles.find((profile) => profile.profileId === profiles.sourceAdjudicator.profileId)!.sourceIntegrity = "NOT_QUALIFIED";
  fx.result.registry = fx.registry;
  assert.throws(
    () => sealForwardRoleQualification({
      experimentId: "s16-forward-role-qualification-v1",
      result: fx.result,
      registry: fx.registry,
      instrumentBinding: bindingInput(),
      sealedAt: "2026-07-12T12:30:00.000Z",
    }),
    ForwardRoleAssignmentFreezeError,
  );
});

test("role-freeze builder refuses any reader bar other than the pinned IMP-22 value 80", () => {
  const fx = completeFixture();
  assert.throws(() => buildForwardRoleAssignmentFreeze({
    ...fx,
    currentInstrumentBindingSha256: hashCanonical(fx.currentInstrumentBinding),
    baseRecoverySpecSha256: hashCanonical(fx.baseRecoverySpec),
    policies: policies(),
    readerBar: 0,
    frozenAt: "2026-07-12T13:00:00.000Z",
  }), /readerBar must remain exactly 80/);
});

test("builder refuses mutable pseudo-seals and prompt/schema/route hash drift", () => {
  const fx = completeFixture();
  const mutableQualification = structuredClone(fx.qualification);
  assert.throws(
    () => buildForwardRoleAssignmentFreeze({
      qualification: mutableQualification,
      currentInstrumentBinding: fx.currentInstrumentBinding,
      currentInstrumentBindingSha256: hashCanonical(fx.currentInstrumentBinding),
      baseRecoverySpec: fx.baseRecoverySpec,
      baseRecoverySpecSha256: hashCanonical(fx.baseRecoverySpec),
      policies: policies(),
      readerBar: 80,
      frozenAt: "2026-07-12T13:00:00.000Z",
    }),
    /mutable sealed input refused/,
  );

  const stale = structuredClone(fx.currentInstrumentBinding);
  stale.schemaHashes.reader = sha("0");
  assert.throws(
    () => buildForwardRoleAssignmentFreeze({
      ...fx,
      currentInstrumentBinding: stale,
      currentInstrumentBindingSha256: hashCanonical(stale),
      baseRecoverySpecSha256: hashCanonical(fx.baseRecoverySpec),
      policies: policies(),
      readerBar: 80,
      frozenAt: "2026-07-12T13:00:00.000Z",
    }),
    /stale against qualification/,
  );

  const staleRoute = structuredClone(fx.currentInstrumentBinding);
  staleRoute.executionRoute.routePolicyVersion = "route-policy-v2-drift";
  assert.throws(
    () => buildForwardRoleAssignmentFreeze({
      ...fx,
      currentInstrumentBinding: staleRoute,
      currentInstrumentBindingSha256: hashCanonical(staleRoute),
      baseRecoverySpecSha256: hashCanonical(fx.baseRecoverySpec),
      policies: policies(),
      readerBar: 80,
      frozenAt: "2026-07-12T13:00:00.000Z",
    }),
    /stale against qualification/,
  );
});

test("same exact profile is refused unless an explicit limitation records reason and mitigation", () => {
  const duplicate: FixedRoleAssignmentV1 = {
    schema: FIXED_ROLE_ASSIGNMENT_SCHEMA,
    readerPrimary: profiles.readerPrimary,
    readerBackup: profiles.readerPrimary,
    sourcePrimary: profiles.readerAuditSourcePrimary,
    sourceAdjudicator: profiles.sourceAdjudicator,
    quizChecker: { deterministic: true, checkerVersion: "quiz-answer-tell-checker-v1" },
    quizAdjudicator: profiles.readerAuditSourcePrimary,
  };
  const strict = policies().disagreement;
  assert.throws(() => assertForwardAssignmentIndependence(duplicate, strict), /same exact profile/);
  const recorded = structuredClone(strict);
  recorded.independenceLimitations.readerAudit = {
    allowSameExactProfile: true,
    reason: "No second operational profile is available during the bounded validation window.",
    mitigation: "Audit disagreement cannot pass; it routes to REVISE and is reported as a limitation.",
  };
  assert.doesNotThrow(() => assertForwardAssignmentIndependence(duplicate, recorded));
});

test("reader audit subset membership is deterministic and output-independent", () => {
  const policy = policies().auditSubset;
  const coordinate = { bookId: "fresh-book", chapterNumber: 7 };
  const first = isInForwardReaderAuditSubset(policy, coordinate);
  assert.equal(isInForwardReaderAuditSubset(policy, coordinate), first);
  assert.equal(isInForwardReaderAuditSubset(structuredClone(policy), coordinate), first);
});
