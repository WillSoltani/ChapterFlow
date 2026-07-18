/** Pure IMP-23 local activation materialization tests; no I/O or executor. */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import { hashCanonical } from "../src/contracts/contractUtil.js";
import {
  FIXED_ROLE_ASSIGNMENT_SCHEMA,
  SPLIT_LANE_INSTRUMENT_MANIFEST_SCHEMA,
  type FixedRoleAssignmentV1,
  type RoleJudgeRefV1,
} from "../src/bakeoff/migration/reviewLaneTypes.js";
import {
  FORWARD_AUDIT_SUBSET_POLICY_SCHEMA,
  FORWARD_DISAGREEMENT_POLICY_SCHEMA,
  FORWARD_ESCALATION_POLICY_SCHEMA,
  buildForwardPanelReviewPolicy,
} from "../src/orchestrator/forwardReviewPolicy.js";
import {
  FORWARD_FROZEN_REVIEW_CONFIG_SCHEMA,
} from "../src/orchestrator/forwardChapterConductor.js";
import {
  FORWARD_QUALIFICATION_INSTRUMENT_BINDING_SCHEMA,
  FORWARD_ROLE_ASSIGNMENT_FREEZE_SCHEMA,
  FORWARD_ROLE_PROFILE_BINDING_SCHEMA,
  FORWARD_SEALED_QUALIFICATION_BUNDLE_SCHEMA,
  type BoundForwardFrozenReviewConfigV1,
  type ForwardQualificationInstrumentBindingV1,
  type ForwardRoleAssignmentFreezeV1,
  type ForwardRoleProfileBindingV1,
  type ForwardRoleSlot,
  type ForwardSealedQualificationBundleV1,
} from "../src/orchestrator/forwardRoleAssignmentFreeze.js";
import {
  FORWARD_LOCAL_CURRENT_PATHS,
} from "../src/orchestrator/forwardLocalAutopilot.js";
import {
  FORWARD_LIVE_CAMPAIGN_PREFLIGHT_SCHEMA,
  FORWARD_LIVE_CAMPAIGN_RESULT_SCHEMA,
  type RunForwardLiveCampaignResultV1,
} from "../src/orchestrator/forwardLiveValidationDriver.js";
import {
  IMP22_ROLE_QUALIFICATION_LIVE_PREFLIGHT_SCHEMA,
  type LiveQualificationPreflightV1,
} from "../src/orchestrator/forwardRoleQualificationLive.js";
import {
  FORWARD_LOCAL_ACTIVATION_POLICY_REL_PATH,
  FORWARD_LOCAL_RUNTIME_BINDING_REL_PATH,
  IMP23_QUALIFICATION_EXPERIMENT_ID,
  buildForwardLocalActivationArtifacts,
  type BuildForwardLocalActivationArtifactsInputV1,
} from "../src/orchestrator/forwardLocalActivationMaterializer.js";

const sha = (char: string): string => char.repeat(64);
const ROUTE = "route-policy-v1.0";
const PROFILE = sha("1");

function judge(model: string, effort: RoleJudgeRefV1["effort"]): RoleJudgeRefV1 {
  return { profileId: `${model}@${effort}`, model, effort };
}

function qualificationAndFreeze(): {
  qualificationBundle: ForwardSealedQualificationBundleV1;
  roleAssignmentFreeze: ForwardRoleAssignmentFreezeV1;
} {
  const schemas = { reader: sha("2"), source: sha("3"), quiz: sha("4") };
  const instrumentBinding: ForwardQualificationInstrumentBindingV1 = {
    schema: FORWARD_QUALIFICATION_INSTRUMENT_BINDING_SCHEMA,
    schemaHashes: schemas,
    promptSourceHashes: { reader: sha("5"), source: sha("6"), quiz: sha("7"), aggregate: sha("8") },
    qualificationPromptBundleHashes: { reader: sha("9"), source: sha("a"), quiz: sha("b") },
    instrumentVersions: {
      reader: "reader-experience-review-v1",
      source: "source-integrity-review-v1",
      quiz: "quiz-integrity-adjudication-v1",
      aggregate: "aggregated-chapter-review-v1",
    },
    executionRoute: {
      authMode: "chatgpt-subscription-codex-exec",
      executionProfileHash: PROFILE,
      routePolicyVersion: ROUTE,
      routeEvidenceSha256: sha("c"),
      apiAllowed: false,
      apiFallbackAllowed: false,
      apiCallsMade: 0,
    },
  };
  const result = { retained: "v2-result" };
  const registry = { retained: "v2-registry" };
  const sealDraft = {
    schema: "imp22-forward-role-qualification-seal-v1" as const,
    experimentId: IMP23_QUALIFICATION_EXPERIMENT_ID,
    sealed: true as const,
    qualificationResultSha256: hashCanonical(result),
    registrySha256: hashCanonical(registry),
    qualificationFreezeSha256: sha("d"),
    instrumentBindingSha256: hashCanonical(instrumentBinding),
    selectedRoleSetSha256: sha("e"),
    sealedAt: "2026-07-13T02:00:00.000Z",
  };
  const seal = { ...sealDraft, sealSha256: hashCanonical(sealDraft) };
  const bundleDraft = {
    schema: FORWARD_SEALED_QUALIFICATION_BUNDLE_SCHEMA,
    result,
    registry,
    instrumentBinding,
    seal,
  };
  const qualificationBundle = {
    ...bundleDraft,
    bundleSha256: hashCanonical(bundleDraft),
  } as unknown as ForwardSealedQualificationBundleV1;

  const roleAssignment: FixedRoleAssignmentV1 = {
    schema: FIXED_ROLE_ASSIGNMENT_SCHEMA,
    readerPrimary: judge("gpt-5.6-sol", "high"),
    readerBackup: judge("gpt-5.6-sol", "xhigh"),
    sourcePrimary: judge("gpt-5.7-judge", "high"),
    sourceAdjudicator: judge("gpt-5.7-judge", "xhigh"),
    quizChecker: { deterministic: true, checkerVersion: "quiz-answer-tell-checker-v1" },
    quizAdjudicator: judge("gpt-5.8-judge", "high"),
  };
  const roleAssignmentSha256 = hashCanonical(roleAssignment);
  const panel = buildForwardPanelReviewPolicy({
    auditSubset: {
      schema: FORWARD_AUDIT_SUBSET_POLICY_SCHEMA,
      policyVersion: "activation-test-audit-v1",
      strategy: "sha256-chapter-coordinate-bucket-v1",
      salt: "activation-test",
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
      policyVersion: "activation-test-disagreement-v1",
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
  });
  const roleSlots: Array<[ForwardRoleSlot, "reader" | "source" | "quiz", RoleJudgeRefV1, string]> = [
    ["readerPrimary", "reader", roleAssignment.readerPrimary, schemas.reader],
    ["readerAudit", "reader", roleAssignment.readerBackup, schemas.reader],
    ["sourcePrimary", "source", roleAssignment.sourcePrimary, schemas.source],
    ["sourceAdjudicator", "source", roleAssignment.sourceAdjudicator, schemas.source],
    ["quizSemanticAdjudicator", "quiz", roleAssignment.quizAdjudicator, schemas.quiz],
  ];
  const roleProfileBindings = {} as Record<ForwardRoleSlot, ForwardRoleProfileBindingV1>;
  roleSlots.forEach(([slot, lane, selected, schemaSha256], index) => {
    roleProfileBindings[slot] = {
      schema: FORWARD_ROLE_PROFILE_BINDING_SCHEMA,
      slot,
      lane,
      judge: selected,
      profileSha256: hashCanonical({ judge: selected, executionProfileHash: PROFILE, routePolicyVersion: ROUTE }),
      qualificationRecordSha256: String(index + 1).repeat(64),
      promptSourceSha256: String(index + 2).repeat(64),
      qualificationPromptBundleSha256: String(index + 3).repeat(64),
      schemaSha256,
      executionProfileHash: PROFILE,
      routePolicyVersion: ROUTE,
    };
  });
  const roleProfileBindingsSha256 = hashCanonical(roleProfileBindings);
  const manifest = {
    schema: SPLIT_LANE_INSTRUMENT_MANIFEST_SCHEMA,
    readerRubricVersion: "reader-experience-review-v1" as const,
    sourceRubricVersion: "source-integrity-review-v1" as const,
    readerSchemaSha256: schemas.reader,
    sourceSchemaSha256: schemas.source,
    quizAdjudicationSchemaSha256: schemas.quiz,
    quizPhase2Version: "quiz-integrity-adjudication-v1" as const,
    aggregationVersion: "aggregated-chapter-review-v1" as const,
    roleAssignmentPolicyVersion: "imp22-forward-fixed-role-assignment-v1" as const,
    fixedRoleAssignmentSha256: roleAssignmentSha256,
    executionProfileHash: PROFILE,
    routePolicyVersion: ROUTE,
    thresholdsSha256: sha("f"),
    readerCorpusSha256: `sha256:${sha("1")}`,
    sourceCorpusSha256: `sha256:${sha("2")}`,
    quizCorpusSha256: `sha256:${sha("3")}`,
  };
  const reviewConfig: BoundForwardFrozenReviewConfigV1 = {
    schema: FORWARD_FROZEN_REVIEW_CONFIG_SCHEMA,
    roleAssignment,
    roleAssignmentSha256,
    instrumentManifest: manifest,
    instrumentManifestSha256: hashCanonical(manifest),
    readerBar: 80,
    qualificationBundleSha256: qualificationBundle.bundleSha256,
    instrumentBindingSha256: hashCanonical(instrumentBinding),
    roleProfileBindingsSha256,
    auditSubsetPolicySha256: panel.auditSubsetPolicySha256,
    escalationPolicySha256: panel.escalationPolicySha256,
    disagreementPolicySha256: panel.disagreementPolicySha256,
    panelPolicy: panel,
    panelPolicySha256: hashCanonical(panel),
    recoveryExperimentSealSha256: sha("4"),
    promptSourceHashes: instrumentBinding.promptSourceHashes,
  };
  const freezeDraft = {
    schema: FORWARD_ROLE_ASSIGNMENT_FREEZE_SCHEMA,
    qualificationBundleSha256: qualificationBundle.bundleSha256,
    qualificationSealSha256: seal.sealSha256,
    instrumentBinding,
    instrumentBindingSha256: hashCanonical(instrumentBinding),
    roleAssignment,
    roleAssignmentSha256,
    roleProfileBindings,
    roleProfileBindingsSha256,
    reviewConfig,
    reviewConfigSha256: hashCanonical(reviewConfig),
    productionInstrumentSealSha256: sha("b"),
  };
  const roleAssignmentFreeze = {
    ...freezeDraft,
    freezeSha256: hashCanonical(freezeDraft),
  } as unknown as ForwardRoleAssignmentFreezeV1;
  return { qualificationBundle, roleAssignmentFreeze };
}

function qualificationPreflight(): LiveQualificationPreflightV1 {
  return {
    schema: IMP22_ROLE_QUALIFICATION_LIVE_PREFLIGHT_SCHEMA,
    experimentId: IMP23_QUALIFICATION_EXPERIMENT_ID,
    verifiedAt: "2026-07-13T02:01:00.000Z",
    specRelPath: `state/migration-experiments/${IMP23_QUALIFICATION_EXPERIMENT_ID}/spec.json`,
    specBytesSha256: sha("5"),
    corpusBytesSha256: { reader: sha("6"), source: sha("7"), quiz: sha("8") },
    corpusSubstantiveSha256: { reader: sha("9"), source: sha("a"), quiz: sha("b") },
    thresholdBytesSha256: sha("c"),
    schemaBytesSha256: { reader: sha("2"), source: sha("3"), quiz: sha("4") },
    promptSourceBytesSha256: { reader: sha("5"), source: sha("6"), quiz: sha("7") },
    candidateAvailabilityPolicyBytesSha256: sha("d"),
    candidateAvailabilitySha256: sha("e"),
    candidateAvailabilitySourceBytesSha256: sha("f"),
    candidateAvailabilitySourceFetchedAt: "2026-07-13T02:00:00.000Z",
    executionProfileHash: PROFILE,
    routePolicyVersion: ROUTE,
    cliVersion: "codex-cli 0.144.1",
    cliBinary: "codex",
    authMode: "chatgpt",
    apiKeyPresent: false,
    apiFallbackAllowed: false,
    forbiddenProviderEnvKeysPresent: [],
    maxParallel: 2,
    expectedCalibrationCalls: 24,
    expectedQualificationCalls: 180,
    hardMaximumCalls: 928,
  };
}

function liveResult(
  kind: "pilot" | "gold",
  qualificationBundleSha256: string,
  roleAssignmentFreeze: ForwardRoleAssignmentFreezeV1,
): RunForwardLiveCampaignResultV1 {
  const manifestSha256 = kind === "pilot" ? sha("6") : sha("7");
  const accounting = {
    totalChapters: kind === "pilot" ? 8 : 13,
    firstWritePassCount: kind === "pilot" ? 6 : 10,
    firstWritePassRate: kind === "pilot" ? 0.75 : 10 / 13,
    finalPassCount: kind === "pilot" ? 8 : 13,
    finalPassRate: 1,
    finalSourceBlockers: 0,
    finalQuizBlockers: 0,
    finalReaderHardBlockers: 0,
    wrongQuizKeys: 0,
    unsupportedSourceBoundInventedDetails: 0,
    misleadingConstructedFraming: 0,
    genericHistoricalSpecificityLeaks: 0,
    unsupportedHighSeverityCausalClaims: 0,
    repairAttempts: 0,
    fullRegenerations: 0,
    chaptersRequiringContentRepair: 0,
    repeatedOrUnboundedRepair: 0,
    stateProvenanceSchemaFailures: 0,
    unexpectedWrites: 0,
    staleEvidenceAccepted: 0,
  };
  const campaign = {
    schema: "forward-validation-campaign-result-v1" as const,
    experimentId: kind === "pilot" ? "s16-forward-sol-pilot-v1" : "s16-forward-sol-gold-book-v1",
    manifestSha256,
    kind,
    firstWriteSnapshot: {},
    firstWriteSnapshotSha256: sha("8"),
    attempts: [],
    finalByChapter: {},
    accounting,
    goldEvaluation: kind === "gold" ? {
      technicalCompleteness: "PASS",
      epistemicInstructionalSafety: "PASS",
      ethicsReaderAutonomy: "PASS",
      purposeAudienceDeclaration: "PASS",
      externalAccuracy: "PASS",
      contentDesignScore: 84,
      sweep: { verdict: "PASS" },
      evidenceBinding: {},
    } : null,
    hardFailures: [],
    accepted: true,
    capabilitiesUsed: { publish: false, promote: false, deploy: false, upload: false },
    persistenceReceipts: [],
  } as unknown as RunForwardLiveCampaignResultV1["campaign"];
  const preflightDraft = {
    schema: FORWARD_LIVE_CAMPAIGN_PREFLIGHT_SCHEMA,
    kind,
    experimentId: kind === "pilot" ? "s16-forward-sol-pilot-v1" : "s16-forward-sol-gold-book-v1",
    manifestSha256,
    inputFreezeSha256: sha("9"),
    inputMaterializationSha256: sha("a"),
    productionInstrumentSealSha256: sha("b"),
    goldEvaluatorInstrumentSha256: kind === "gold" ? sha("c") : null,
    roleAssignmentFreezeSha256: roleAssignmentFreeze.freezeSha256,
    roleAssignmentSha256: roleAssignmentFreeze.roleAssignmentSha256,
    qualificationBundleSha256,
    qualificationResultSha256: sha("d"),
    calibrationSha256: sha("e"),
    inspectionSha256: sha("f"),
    executionProfileHash: PROFILE,
    routePolicyVersion: ROUTE,
    executionRoute: "codex_exec_chatgpt_subscription" as const,
    authMode: "chatgpt" as const,
    apiKeyPresent: false as const,
    apiFallbackAllowed: false as const,
    apiCallsMade: 0 as const,
    maxParallel: 2 as const,
    externalCapabilities: { publish: false as const, promote: false as const, deploy: false as const, upload: false as const },
  };
  const preflight = { ...preflightDraft, preflightSha256: hashCanonical(preflightDraft) };
  return {
    schema: FORWARD_LIVE_CAMPAIGN_RESULT_SCHEMA,
    preflight,
    budgetSha256: sha("1"),
    campaign,
    codexExecInvocations: 1,
    cachedReceipts: 0,
    infrastructureReplays: 0,
    maxPlanCapacityEvents: 0,
    safeguardsOrRefusals: 0,
    apiCallsMade: 0,
    publish: false,
    promote: false,
    deploy: false,
    upload: false,
  };
}

function fixture(): BuildForwardLocalActivationArtifactsInputV1 {
  const { qualificationBundle, roleAssignmentFreeze } = qualificationAndFreeze();
  return {
    activationId: "imp23-forward-local-active-1",
    activatedAt: "2026-07-13T02:02:00.000Z",
    qualificationBundle,
    roleAssignmentFreeze,
    qualificationPreflight: qualificationPreflight(),
    pilotLiveResult: liveResult("pilot", qualificationBundle.bundleSha256, roleAssignmentFreeze),
    goldLiveResult: liveResult("gold", qualificationBundle.bundleSha256, roleAssignmentFreeze),
  };
}

test("materializes every current/runtime/policy path with exact rollback and zero calls", () => {
  const result = buildForwardLocalActivationArtifacts(fixture());
  assert.deepEqual(Object.keys(result.artifactsByPath).sort(), [
    ...Object.values(FORWARD_LOCAL_CURRENT_PATHS),
    FORWARD_LOCAL_RUNTIME_BINDING_REL_PATH,
    FORWARD_LOCAL_ACTIVATION_POLICY_REL_PATH,
  ].sort());
  const policy = result.artifactsByPath[FORWARD_LOCAL_ACTIVATION_POLICY_REL_PATH];
  assert.equal(policy.status, "ACTIVE");
  assert.equal(policy.previousProfile.profileId, "baseline-55");
  assert.deepEqual(policy.previousProfile.writer, { model: "gpt-5.5", effort: "xhigh" });
  assert.deepEqual(policy.previousProfile.highRiskWriter, { model: "gpt-5.5", effort: "xhigh" });
  assert.deepEqual(policy.previousProfile.reviewers, policy.activatedProfile.reviewers);
  assert.equal(result.modelCalls, 0);
  assert.equal(result.apiCalls, 0);
  assert.equal(result.networkCalls, 0);
  assert.ok(Object.isFrozen(result) && Object.isFrozen(result.artifactsByPath));
});

test("refuses a v1 qualification/v2 preflight mismatch", () => {
  const input = fixture();
  const sealDraft = { ...input.qualificationBundle.seal, experimentId: "s16-forward-role-qualification-v1" };
  delete (sealDraft as Partial<typeof sealDraft>).sealSha256;
  const seal = { ...sealDraft, sealSha256: hashCanonical(sealDraft) } as typeof input.qualificationBundle.seal;
  const bundleDraft = { ...input.qualificationBundle, seal };
  delete (bundleDraft as Partial<typeof bundleDraft>).bundleSha256;
  const qualificationBundle = { ...bundleDraft, bundleSha256: hashCanonical(bundleDraft) } as typeof input.qualificationBundle;
  assert.throws(() => buildForwardLocalActivationArtifacts({ ...input, qualificationBundle }), /corrected v2/);
});

test("refuses a rejected live campaign", () => {
  const input = fixture();
  const campaign = { ...input.pilotLiveResult.campaign, accepted: false, hardFailures: ["rejected"] };
  assert.throws(() => buildForwardLocalActivationArtifacts({
    ...input,
    pilotLiveResult: { ...input.pilotLiveResult, campaign },
  }), /not accepted/);
});

test("refuses API use or any external capability", () => {
  const input = fixture();
  assert.throws(() => buildForwardLocalActivationArtifacts({
    ...input,
    pilotLiveResult: { ...input.pilotLiveResult, apiCallsMade: 1 } as unknown as RunForwardLiveCampaignResultV1,
  }), /API call or external capability/);
  assert.throws(() => buildForwardLocalActivationArtifacts({
    ...input,
    goldLiveResult: {
      ...input.goldLiveResult,
      campaign: {
        ...input.goldLiveResult.campaign,
        capabilitiesUsed: { publish: true, promote: false, deploy: false, upload: false },
      },
    } as unknown as RunForwardLiveCampaignResultV1,
  }), /used an external capability/);
});

test("refuses a failed gold hard gate or sweep", () => {
  const input = fixture();
  const goldEvaluation = { ...input.goldLiveResult.campaign.goldEvaluation!, externalAccuracy: "FAIL" as const };
  assert.throws(() => buildForwardLocalActivationArtifacts({
    ...input,
    goldLiveResult: {
      ...input.goldLiveResult,
      campaign: { ...input.goldLiveResult.campaign, goldEvaluation },
    },
  }), /failed hard gate or sweep/);
});
