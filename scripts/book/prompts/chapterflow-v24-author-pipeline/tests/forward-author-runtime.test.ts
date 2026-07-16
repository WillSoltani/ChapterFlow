/** IMP-22 central local future-authoring runtime. No model/provider call. */

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { test } from "./harness.js";
import { PIPELINE_DIR } from "./helpers.js";
import { hashCanonical } from "../src/contracts/contractUtil.js";
import { fxAttemptIdentity, fxChapter, fxPacket, fxPlan, fxPlanUnit } from "./migrationFixtures.js";
import { sourcePacketHash } from "../src/compiler/sourcePacket.js";
import { sourceUsePlanHash } from "../src/contracts/sourceUsePlan.js";
import { chapterContentHash } from "../src/critics/qcAttestation.js";
import type { ChapterAttempt } from "../src/orchestrator/chapterTransaction.js";
import type { ChapterV21 } from "../src/types.js";
import { REQUIRED_SWEEP_FAMILIES, type SweepRecord } from "../src/qc/sweep.js";
import { evidenceSourceId } from "../src/qc/orchestrator/evidenceSource.js";
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
  FORWARD_REVIEW_EXECUTION_RESULT_SCHEMA,
  type ForwardChapterConductorResultV1,
  type ForwardReviewExecutionRequestV1,
  type ForwardReviewExecutionResultV1,
  type ForwardReviewerExecutor,
} from "../src/orchestrator/forwardChapterConductor.js";
import {
  FORWARD_ROLE_PROFILE_BINDING_SCHEMA,
  type BoundForwardFrozenReviewConfigV1,
  type ForwardRoleProfileBindingV1,
  type ForwardRoleSlot,
} from "../src/orchestrator/forwardRoleAssignmentFreeze.js";
import {
  LOCAL_ROUTE_PROFILE_SCHEMA,
  SOL_FORWARD_WRITER_MODEL,
  VERIFIED_NO_API_ROUTE_SCHEMA,
  bindVerifiedNoApiRoute,
  buildForwardActivationPolicy,
  fixedReviewerProfilesHash,
  rollbackForwardPolicy,
  serializeForwardActivationPolicy,
  type FixedReviewerProfilesV1,
  type ForwardActivationEvidenceV1,
  type ForwardActivationPolicyV1,
  type ForwardActivationRequestV1,
  type ForwardActivationIO,
  type VerifiedNoApiRouteCoreV1,
  type VerifiedNoApiRouteV1,
} from "../src/orchestrator/forwardActivation.js";
import {
  FORWARD_LOCAL_EXTERNAL_CAPABILITIES,
  FORWARD_LOCAL_RUNTIME_BINDING_SCHEMA,
  ForwardAuthorRuntimeError,
  createForwardAuthorChapterWriter,
  fixedReviewersFromRuntimeBinding,
  resolveForwardLocalRuntime,
  runLocalAuthoringChapter,
  serializeForwardLocalRuntimeBinding,
  validateForwardLocalRuntimeBinding,
  type ForwardLocalRuntimeBindingV1,
  type ResolveForwardLocalRuntimeInputV1,
} from "../src/orchestrator/forwardAuthorRuntime.js";
import {
  FORWARD_AUTHOR_RISK_POLICY_VERSION,
  ROUTE_POLICY_VERSION,
  RoutePreflightError,
  classifyForwardAuthoringRisk,
  type ForwardAuthoringRiskSignalsV1,
} from "../src/orchestrator/modelPolicy.js";
import type { AutopilotDeps } from "../src/orchestrator/autopilot.js";
import type { AuthorWriteOneOpts, PreparedAuthorCandidate } from "../src/orchestrator/authorRun.js";
import {
  FORWARD_LOCAL_CURRENT_EVIDENCE_SCHEMA,
  FORWARD_LOCAL_CURRENT_PATHS,
  resolveStandardForwardAutopilotControl,
  type ForwardLocalCurrentEvidenceV1,
} from "../src/orchestrator/forwardLocalAutopilot.js";

const sha = (char: string): string => char.repeat(64);

function judge(model: string, effort: RoleJudgeRefV1["effort"]): RoleJudgeRefV1 {
  return { profileId: `${model}@${effort}`, model, effort };
}

function risk(over: Partial<ForwardAuthoringRiskSignalsV1> = {}): ForwardAuthoringRiskSignalsV1 {
  return {
    sparseSourceDetail: false,
    sourceBoundNamedClaimCount: 0,
    disputedOrConflictingEvidence: false,
    causalTeachingClaims: false,
    difficultAttribution: false,
    difficultQuizDesign: false,
    crossChapterDependency: false,
    priorConsecutiveFailures: 0,
    sourceIntegrityAdjudication: false,
    repeatedFailureDiagnosis: false,
    finalReleaseVerification: false,
    ...over,
  };
}

function runtimeBinding(over: {
  qualificationBundleSha256?: string;
  roleAssignmentFreezeSha256?: string;
  instrumentBindingSha256?: string;
} = {}): ForwardLocalRuntimeBindingV1 {
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
  const executionProfileHash = sha("1");
  // WP-302 bumped ROUTE_POLICY_VERSION (v1.0 → v2.0) for the 5.6 cutover; the
  // ACTIVE-policy fixtures must carry the CURRENT central version or the runtime
  // fails them closed as stale. Track the live constant so future bumps don't
  // silently re-stale this fixture.
  const routePolicyVersion = ROUTE_POLICY_VERSION;
  const schemas = { reader: sha("2"), source: sha("3"), quiz: sha("4") };
  const manifest = {
    schema: SPLIT_LANE_INSTRUMENT_MANIFEST_SCHEMA,
    readerRubricVersion: "reader-experience-review-v1",
    sourceRubricVersion: "source-integrity-review-v1",
    readerSchemaSha256: schemas.reader,
    sourceSchemaSha256: schemas.source,
    quizAdjudicationSchemaSha256: schemas.quiz,
    quizPhase2Version: "quiz-integrity-adjudication-v1",
    aggregationVersion: "aggregated-chapter-review-v1",
    roleAssignmentPolicyVersion: "imp22-forward-fixed-role-assignment-v1",
    fixedRoleAssignmentSha256: roleAssignmentSha256,
    executionProfileHash,
    routePolicyVersion,
    thresholdsSha256: sha("5"),
    readerCorpusSha256: `sha256:${sha("6")}`,
    sourceCorpusSha256: `sha256:${sha("7")}`,
    quizCorpusSha256: `sha256:${sha("8")}`,
  };
  const panel = buildForwardPanelReviewPolicy({
    auditSubset: {
      schema: FORWARD_AUDIT_SUBSET_POLICY_SCHEMA,
      policyVersion: "forward-audit-v1",
      strategy: "sha256-chapter-coordinate-bucket-v1",
      salt: "forward-runtime-test",
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
      policyVersion: "forward-disagreement-v1",
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

  const slotData: Array<[ForwardRoleSlot, "reader" | "source" | "quiz", RoleJudgeRefV1, string]> = [
    ["readerPrimary", "reader", roleAssignment.readerPrimary, schemas.reader],
    ["readerAudit", "reader", roleAssignment.readerBackup, schemas.reader],
    ["sourcePrimary", "source", roleAssignment.sourcePrimary, schemas.source],
    ["sourceAdjudicator", "source", roleAssignment.sourceAdjudicator, schemas.source],
    ["quizSemanticAdjudicator", "quiz", roleAssignment.quizAdjudicator, schemas.quiz],
  ];
  const roleProfileBindings = {} as Record<ForwardRoleSlot, ForwardRoleProfileBindingV1>;
  slotData.forEach(([slot, lane, selectedJudge, schemaSha256], index) => {
    roleProfileBindings[slot] = {
      schema: FORWARD_ROLE_PROFILE_BINDING_SCHEMA,
      slot,
      lane,
      judge: selectedJudge,
      profileSha256: hashCanonical({ judge: selectedJudge, executionProfileHash, routePolicyVersion }),
      qualificationRecordSha256: String(index + 1).repeat(64),
      promptSourceSha256: String(index + 2).repeat(64),
      qualificationPromptBundleSha256: String(index + 3).repeat(64),
      schemaSha256,
      executionProfileHash,
      routePolicyVersion,
    };
  });
  const roleProfileBindingsSha256 = hashCanonical(roleProfileBindings);
  const qualificationBundleSha256 = over.qualificationBundleSha256 ?? sha("9");
  const instrumentBindingSha256 = over.instrumentBindingSha256 ?? sha("a");
  const reviewConfig: BoundForwardFrozenReviewConfigV1 = {
    schema: FORWARD_FROZEN_REVIEW_CONFIG_SCHEMA,
    roleAssignment,
    roleAssignmentSha256,
    instrumentManifest: manifest,
    instrumentManifestSha256: hashCanonical(manifest),
    readerBar: 85,
    qualificationBundleSha256,
    instrumentBindingSha256,
    roleProfileBindingsSha256,
    auditSubsetPolicySha256: panel.auditSubsetPolicySha256,
    escalationPolicySha256: panel.escalationPolicySha256,
    disagreementPolicySha256: panel.disagreementPolicySha256,
    panelPolicy: panel,
    panelPolicySha256: hashCanonical(panel),
    recoveryExperimentSealSha256: sha("b"),
    promptSourceHashes: { reader: sha("c"), source: sha("d"), quiz: sha("e"), aggregate: sha("f") },
  };
  const draft = {
    schema: FORWARD_LOCAL_RUNTIME_BINDING_SCHEMA,
    localOnly: true as const,
    qualificationBundleSha256,
    roleAssignmentFreezeSha256: over.roleAssignmentFreezeSha256 ?? sha("0"),
    instrumentBindingSha256,
    reviewConfig,
    reviewConfigSha256: hashCanonical(reviewConfig),
    roleProfileBindings,
    roleProfileBindingsSha256,
    executionProfileHash,
    routePolicyVersion,
    publish: false as const,
    promotion: false as const,
    deployment: false as const,
    upload: false as const,
    apiFallbackAllowed: false as const,
  };
  return { ...draft, bindingSha256: hashCanonical(draft) };
}

function noApiRoute(binding: ForwardLocalRuntimeBindingV1, cliVersion = "codex-cli-test"): VerifiedNoApiRouteV1 {
  const core: VerifiedNoApiRouteCoreV1 = {
    schema: VERIFIED_NO_API_ROUTE_SCHEMA,
    verified: true,
    executionRoute: "codex_exec_chatgpt_subscription",
    authMode: "chatgpt",
    apiKeyPresent: false,
    apiFallbackAllowed: false,
    routePolicyVersion: binding.routePolicyVersion,
    executionProfileHash: binding.executionProfileHash,
    cliVersion,
  };
  return bindVerifiedNoApiRoute(core);
}

function activation(
  binding = runtimeBinding(),
  fixed = fixedReviewersFromRuntimeBinding(binding),
  evidenceOverride?: ForwardActivationEvidenceV1,
): {
  policy: Extract<ForwardActivationPolicyV1, { status: "ACTIVE" }>;
  evidence: ForwardActivationEvidenceV1;
  route: VerifiedNoApiRouteV1;
} {
  const evidence: ForwardActivationEvidenceV1 = evidenceOverride ?? {
    qualificationEvidenceHash: binding.qualificationBundleSha256,
    pilotEvidenceHash: sha("c"),
    goldBookEvidenceHash: sha("d"),
  };
  const route = noApiRoute(binding);
  const request: ForwardActivationRequestV1 = {
    activationId: "forward-runtime-active-1",
    activatedAt: "2026-07-12T18:00:00.000Z",
    qualificationPassed: true,
    pilotPassed: true,
    goldBookPassed: true,
    hardGateFailures: [],
    frozenRoleAssignmentHash: fixedReviewerProfilesHash(fixed),
    fixedReviewerProfiles: fixed,
    noApiRoute: route,
    previousProfile: {
      schema: LOCAL_ROUTE_PROFILE_SCHEMA,
      profileId: "previous-qualified-local-v1",
      writer: { model: "baseline-model", effort: "high" },
      highRiskWriter: { model: "baseline-model", effort: "xhigh" },
      reviewers: fixed,
    },
    evidence,
  };
  const policy = buildForwardActivationPolicy(request);
  if (policy.status !== "ACTIVE") throw new Error("activation fixture unexpectedly rolled back");
  return { policy, evidence, route };
}

function activeResolveInput(binding = runtimeBinding()): ResolveForwardLocalRuntimeInputV1 {
  const active = activation(binding);
  return {
    activationPolicyText: serializeForwardActivationPolicy(active.policy),
    runtimeBindingText: serializeForwardLocalRuntimeBinding(binding),
    currentEvidence: active.evidence,
    currentNoApiRoute: active.route,
    currentInstrumentBindingSha256: binding.instrumentBindingSha256,
    currentReviewConfigSha256: binding.reviewConfigSha256,
    currentRoleAssignmentFreezeSha256: binding.roleAssignmentFreezeSha256,
  };
}

function rolledBackPolicy(): ForwardActivationPolicyV1 {
  const active = activation().policy;
  let text = serializeForwardActivationPolicy(active);
  const io: ForwardActivationIO = {
    readText: () => text,
    writeTextAtomic: (_path, next) => { text = next; },
  };
  return rollbackForwardPolicy("/explicit/local/policy.json", {
    rollbackId: "rollback-runtime-1",
    rolledBackAt: "2026-07-12T19:00:00.000Z",
    trigger: "operator_requested",
    reason: "test rollback",
  }, io);
}

function currentEvidenceArtifact(kind: "pilot" | "gold", payload: unknown): ForwardLocalCurrentEvidenceV1 {
  const draft = {
    schema: FORWARD_LOCAL_CURRENT_EVIDENCE_SCHEMA,
    kind,
    payload,
    payloadSha256: hashCanonical(payload),
  };
  return { ...draft, evidenceSha256: hashCanonical(draft) };
}

function standardActiveFiles(stateDir = "/virtual/forward-local"): {
  files: Map<string, string>;
  binding: ForwardLocalRuntimeBindingV1;
} {
  const qualificationDraft = {
    schema: "fixture-qualified-bundle",
    result: "PASS",
    seal: { experimentId: "s16-forward-role-qualification-v2" },
  };
  const qualification = { ...qualificationDraft, bundleSha256: hashCanonical(qualificationDraft) };
  const instrumentBinding = { schema: "fixture-current-instrument", version: 1 };
  const roleFreezeDraft = { schema: "fixture-current-role-freeze", roleSet: "fixed" };
  const roleFreeze = { ...roleFreezeDraft, freezeSha256: hashCanonical(roleFreezeDraft) };
  const accounting = (totalChapters: number) => ({
    totalChapters,
    firstWritePassRate: 0.75,
    finalPassRate: 1,
    finalSourceBlockers: 0,
    finalQuizBlockers: 0,
    finalReaderHardBlockers: 0,
    stateProvenanceSchemaFailures: 0,
    unexpectedWrites: 0,
    staleEvidenceAccepted: 0,
  });
  const pilot = currentEvidenceArtifact("pilot", {
    schema: "forward-validation-campaign-result-v1", kind: "pilot", accepted: true,
    hardFailures: [], accounting: accounting(8), goldEvaluation: null,
  });
  const gold = currentEvidenceArtifact("gold", {
    schema: "forward-validation-campaign-result-v1", kind: "gold", accepted: true,
    hardFailures: [], accounting: accounting(13),
    goldEvaluation: {
      technicalCompleteness: "PASS", epistemicInstructionalSafety: "PASS",
      ethicsReaderAutonomy: "PASS", purposeAudienceDeclaration: "PASS",
      externalAccuracy: "PASS", contentDesignScore: 84,
      sweep: { verdict: "PASS" },
    },
  });
  const binding = runtimeBinding({
    qualificationBundleSha256: qualification.bundleSha256,
    roleAssignmentFreezeSha256: roleFreeze.freezeSha256,
    instrumentBindingSha256: hashCanonical(instrumentBinding),
  });
  const evidence: ForwardActivationEvidenceV1 = {
    qualificationEvidenceHash: qualification.bundleSha256,
    pilotEvidenceHash: pilot.evidenceSha256,
    goldBookEvidenceHash: gold.evidenceSha256,
  };
  const active = activation(binding, fixedReviewersFromRuntimeBinding(binding), evidence);
  const files = new Map<string, string>([
    [resolve(stateDir, "activation-policy.json"), serializeForwardActivationPolicy(active.policy)],
    [resolve(stateDir, "runtime-binding.json"), serializeForwardLocalRuntimeBinding(binding)],
    [resolve(stateDir, FORWARD_LOCAL_CURRENT_PATHS.qualification), JSON.stringify(qualification)],
    [resolve(stateDir, FORWARD_LOCAL_CURRENT_PATHS.pilot), JSON.stringify(pilot)],
    [resolve(stateDir, FORWARD_LOCAL_CURRENT_PATHS.gold), JSON.stringify(gold)],
    [resolve(stateDir, FORWARD_LOCAL_CURRENT_PATHS.instrumentBinding), JSON.stringify(instrumentBinding)],
    [resolve(stateDir, FORWARD_LOCAL_CURRENT_PATHS.reviewConfig), JSON.stringify(binding.reviewConfig)],
    [resolve(stateDir, FORWARD_LOCAL_CURRENT_PATHS.roleAssignmentFreeze), JSON.stringify(roleFreeze)],
    [resolve(stateDir, FORWARD_LOCAL_CURRENT_PATHS.noApiRoute), JSON.stringify(active.route)],
  ]);
  return { files, binding };
}

test("central risk policy routes ordinary to high and any frozen high-risk signal to xhigh", () => {
  const ordinary = classifyForwardAuthoringRisk(risk());
  assert.equal(ordinary.policyVersion, FORWARD_AUTHOR_RISK_POLICY_VERSION);
  assert.equal(ordinary.riskClass, "ordinary");
  assert.deepEqual(ordinary.reasons, []);

  const high = classifyForwardAuthoringRisk(risk({ causalTeachingClaims: true, sourceBoundNamedClaimCount: 3 }));
  assert.equal(high.riskClass, "high-risk");
  assert.deepEqual(high.reasons, ["several_source_bound_named_claims", "causal_teaching_claims"]);
  assert.throws(
    () => classifyForwardAuthoringRisk({ ...risk(), outputInformedOverride: false } as never),
    RoutePreflightError,
  );
});

test("no activation policy preserves the explicit central baseline and never enters split-lane review", async () => {
  const runtime = resolveForwardLocalRuntime({ activationPolicyText: null });
  let reviewCalled = false;
  let seen: AuthorWriteOneOpts | undefined;
  const result = await runLocalAuthoringChapter({
    runtime,
    bookId: "future-book",
    chapterNumber: 1,
    riskSignals: risk(),
    authorDeps: { log: () => undefined } as unknown as AutopilotDeps,
  }, {
    writeCandidate: async (_book, _chapter, _deps, opts) => {
      seen = opts;
      return { ok: true, sessionId: "baseline-writer", committed: true };
    },
    conductReview: async () => {
      reviewCalled = true;
      throw new Error("must not review");
    },
  });
  assert.equal(result.mode, "BASELINE");
  // WP-501/WP-302: the central baseline route is the provisional 5.6 default
  // (was gpt-5.5, void per directive-1).
  assert.equal(seen?.model, "gpt-5.6-sol");
  assert.equal(seen?.effort, "xhigh");
  assert.equal(seen?.deferCommit, false);
  assert.equal(reviewCalled, false);
  assert.deepEqual(result.externalCapabilities, FORWARD_LOCAL_EXTERNAL_CAPABILITIES);
});

test("validated ACTIVE policy forces SOL writer preparation then hands the fixed review config to the real conductor seam", async () => {
  const runtime = resolveForwardLocalRuntime(activeResolveInput());
  assert.equal(runtime.mode, "FORWARD_ACTIVE");
  const pending = { bookId: "future-book", chapterNumber: 1, chapterId: "future-book-ch01" } as PreparedAuthorCandidate;
  let seenWrite: AuthorWriteOneOpts | undefined;
  let seenFixedReader = "";
  const executor: ForwardReviewerExecutor = async () => { throw new Error("injected conductor does not call executor"); };
  const dummyReview = { disposition: "COMMITTED", finalStatus: "PASS" } as ForwardChapterConductorResultV1;
  const result = await runLocalAuthoringChapter({
    runtime,
    bookId: "future-book",
    chapterNumber: 1,
    riskSignals: risk(),
    authorDeps: { log: () => undefined } as unknown as AutopilotDeps,
    reviewerExecutor: executor,
    loadReviewEvidence: () => ({
      sourcePacket: {} as never,
      sourceSidecar: {},
      anchorCatalog: [],
      rereadAuthoritativeSourceEvidence: () => ({ sourceSidecar: {}, anchorCatalog: [] }),
    }),
  }, {
    writeCandidate: async (_book, _chapter, _deps, opts) => {
      seenWrite = opts;
      return { ok: true, sessionId: "sol-writer", committed: false, pending };
    },
    conductReview: async (input, deps) => {
      seenFixedReader = input.frozen.roleAssignment.readerPrimary.profileId;
      assert.equal(input.prepared, pending);
      assert.equal(deps.executor, executor);
      assert.equal(input.frozen, runtime.binding.reviewConfig);
      return dummyReview;
    },
  });

  assert.equal(seenWrite?.model, SOL_FORWARD_WRITER_MODEL);
  assert.equal(seenWrite?.effort, "high");
  assert.equal(seenWrite?.deferCommit, true);
  assert.equal(seenFixedReader, runtime.binding.reviewConfig.roleAssignment.readerPrimary.profileId);
  assert.equal(result.mode, "FORWARD_ACTIVE");
  assert.equal(result.status, "REVIEWED");
  assert.equal(result.reviewResult, dummyReview);
  assert.deepEqual(result.externalCapabilities, {
    publish: false, promotion: false, deployment: false, upload: false, apiFallback: false,
  });
});

test("ACTIVE high-risk chapter routes only the writer to SOL xhigh", async () => {
  const runtime = resolveForwardLocalRuntime(activeResolveInput());
  const pending = {} as PreparedAuthorCandidate;
  let seenEffort: AuthorWriteOneOpts["effort"];
  const result = await runLocalAuthoringChapter({
    runtime,
    bookId: "future-book",
    chapterNumber: 2,
    riskSignals: risk({ difficultAttribution: true }),
    authorDeps: { log: () => undefined } as unknown as AutopilotDeps,
    reviewerExecutor: async () => { throw new Error("not used"); },
    loadReviewEvidence: () => ({
      sourcePacket: {} as never, sourceSidecar: {}, anchorCatalog: [],
      rereadAuthoritativeSourceEvidence: () => ({ sourceSidecar: {}, anchorCatalog: [] }),
    }),
  }, {
    writeCandidate: async (_book, _chapter, _deps, opts) => {
      seenEffort = opts!.effort;
      return { ok: true, sessionId: "sol-xhigh", committed: false, pending };
    },
    conductReview: async () => ({ disposition: "COMMITTED", finalStatus: "PASS" } as ForwardChapterConductorResultV1),
  });
  assert.equal(seenEffort, "xhigh");
  assert.equal(result.route.riskPolicy.riskClass, "high-risk");
  assert.deepEqual(result.route.riskPolicy.reasons, ["difficult_attribution"]);
});

test("book-level adapter returns success only from conductor-committed PASS and preserves the central route", async () => {
  const runtime = resolveForwardLocalRuntime(activeResolveInput());
  const pending = {} as PreparedAuthorCandidate;
  let writerEffort: AuthorWriteOneOpts["effort"];
  const committed = { ok: true as const, sessionId: "forward-commit", committed: true as const };
  const chapterWriter = createForwardAuthorChapterWriter({
    runtime,
    riskSignalsFor: () => risk({ causalTeachingClaims: true }),
    reviewerExecutor: async () => { throw new Error("injected conductor does not call executor"); },
    loadReviewEvidence: () => ({
      sourcePacket: {} as never, sourceSidecar: {}, anchorCatalog: [],
      rereadAuthoritativeSourceEvidence: () => ({ sourceSidecar: {}, anchorCatalog: [] }),
    }),
  }, {
    writeCandidate: async (_book, _chapter, _deps, opts) => {
      writerEffort = opts!.effort;
      return { ok: true, sessionId: "pending", committed: false, pending };
    },
    conductReview: async () => ({
      disposition: "COMMITTED",
      finalStatus: "PASS",
      reason: "fresh aggregate committed",
      commitResult: committed,
    } as ForwardChapterConductorResultV1),
  });
  const result = await chapterWriter(
    "future-book",
    5,
    { log: () => undefined } as unknown as AutopilotDeps,
    {},
  );
  assert.deepEqual(result, committed);
  assert.equal(writerEffort, "xhigh");
});

test("ACTIVE reviewer infrastructure INCONCLUSIVE fails closed without another author or repair call", async () => {
  const runtime = resolveForwardLocalRuntime(activeResolveInput());
  const pending = {} as PreparedAuthorCandidate;
  let writerCalls = 0;
  let reviewCalls = 0;
  let repairCalls = 0;
  const chapterWriter = createForwardAuthorChapterWriter({
    runtime,
    riskSignalsFor: () => risk(),
    reviewerExecutor: async () => { throw new Error("not used by injected conductor"); },
    loadReviewEvidence: () => ({
      sourcePacket: {} as never, sourceSidecar: {}, anchorCatalog: [],
      rereadAuthoritativeSourceEvidence: () => ({ sourceSidecar: {}, anchorCatalog: [] }),
    }),
  }, {
    writeCandidate: async () => {
      writerCalls += 1;
      return { ok: true, sessionId: "only-writer", committed: false, pending };
    },
    conductReview: async () => {
      reviewCalls += 1;
      return {
        disposition: "SUPERSEDED",
        finalStatus: "INCONCLUSIVE",
        reason: "reader executor timeout/refusal; frozen wrapper exhausted its infrastructure replay",
        commitResult: null,
      } as ForwardChapterConductorResultV1;
    },
    prepareTypedRepair: async () => {
      repairCalls += 1;
      return { ok: false, reason: "must not run", failureDisposition: "INFRASTRUCTURE" };
    },
  });
  const result = await chapterWriter("future-book", 7, { log: () => undefined } as unknown as AutopilotDeps, {});
  assert.equal(result.ok, false);
  assert.equal(writerCalls, 1, "no author regeneration is spent on reviewer infrastructure");
  assert.equal(reviewCalls, 1);
  assert.equal(repairCalls, 0, "no typed content repair is spent on INCONCLUSIVE infrastructure");
});

test("ACTIVE typed-repair infrastructure failure does not masquerade as WRONG_ROUTE regeneration", async () => {
  const runtime = resolveForwardLocalRuntime(activeResolveInput());
  const pending = {} as PreparedAuthorCandidate;
  let writerCalls = 0;
  let repairCalls = 0;
  const chapterWriter = createForwardAuthorChapterWriter({
    runtime,
    riskSignalsFor: () => risk(),
    reviewerExecutor: async () => { throw new Error("not used"); },
    loadReviewEvidence: () => ({
      sourcePacket: {} as never, sourceSidecar: {}, anchorCatalog: [],
      rereadAuthoritativeSourceEvidence: () => ({ sourceSidecar: {}, anchorCatalog: [] }),
    }),
  }, {
    writeCandidate: async () => {
      writerCalls += 1;
      return { ok: true, sessionId: `writer-${writerCalls}`, committed: false, pending };
    },
    conductReview: async () => ({
      disposition: "SUPERSEDED",
      finalStatus: "REVISE",
      reason: "quiz cue requires repair",
      reader: { blockingFindings: [], advisoryFindings: [{ category: "quiz_cue", unit: "quiz", problem: "key is visibly cued", evidenceSpans: [] }] },
      source: null,
      quiz: null,
      commitResult: null,
    } as unknown as ForwardChapterConductorResultV1),
    prepareTypedRepair: async () => {
      repairCalls += 1;
      return { ok: false, reason: "repair reviewer capacity exhausted", failureDisposition: "INFRASTRUCTURE" };
    },
  });
  const result = await chapterWriter("future-book", 8, { log: () => undefined } as unknown as AutopilotDeps, {});
  assert.equal(result.ok, false);
  assert.equal(writerCalls, 1, "repair infrastructure failure cannot spend the regeneration slot");
  assert.equal(repairCalls, 1);
});

test("ACTIVE content REVISE spends exactly one typed repair and accepts only its fixed-panel committed PASS", async () => {
  const runtime = resolveForwardLocalRuntime(activeResolveInput());
  const first = { marker: "first" } as unknown as PreparedAuthorCandidate;
  const repaired = { marker: "repair" } as unknown as PreparedAuthorCandidate;
  const committed = { ok: true as const, sessionId: "repair-commit", committed: true as const };
  let writerCalls = 0;
  let repairCalls = 0;
  let reviewCalls = 0;
  const chapterWriter = createForwardAuthorChapterWriter({
    runtime, riskSignalsFor: () => risk(), reviewerExecutor: async () => { throw new Error("not used"); },
    loadReviewEvidence: () => ({ sourcePacket: {} as never, sourceSidecar: {}, anchorCatalog: [], rereadAuthoritativeSourceEvidence: () => ({ sourceSidecar: {}, anchorCatalog: [] }) }),
  }, {
    writeCandidate: async () => { writerCalls += 1; return { ok: true, sessionId: "first", committed: false, pending: first }; },
    prepareTypedRepair: async () => { repairCalls += 1; return { ok: true, sessionId: "repair", committed: false, pending: repaired }; },
    conductReview: async (input) => {
      reviewCalls += 1;
      if (input.prepared === first) return {
        disposition: "SUPERSEDED", finalStatus: "REVISE", reason: "quiz cue",
        reader: { blockingFindings: [], advisoryFindings: [{ category: "quiz_cue", unit: "quiz", problem: "key is visibly cued", evidenceSpans: [] }] },
        source: null, quiz: null, commitResult: null,
      } as unknown as ForwardChapterConductorResultV1;
      assert.equal(input.prepared, repaired);
      return { disposition: "COMMITTED", finalStatus: "PASS", reason: "fixed", commitResult: committed } as ForwardChapterConductorResultV1;
    },
  });
  assert.deepEqual(await chapterWriter("future-book", 9, { log: () => undefined } as unknown as AutopilotDeps, {}), committed);
  assert.equal(writerCalls, 1, "typed repair does not remint a full author candidate");
  assert.equal(repairCalls, 1);
  assert.equal(reviewCalls, 2, "first and repaired candidates each receive the fixed panel exactly once");
});

test("ACTIVE whole-chapter REVISE spends one regeneration and cannot loop", async () => {
  const runtime = resolveForwardLocalRuntime(activeResolveInput());
  const candidates = [{ marker: "first" }, { marker: "regen" }] as unknown as PreparedAuthorCandidate[];
  const committed = { ok: true as const, sessionId: "regen-commit", committed: true as const };
  let writerCalls = 0;
  let reviewCalls = 0;
  const chapterWriter = createForwardAuthorChapterWriter({
    runtime, riskSignalsFor: () => risk(), reviewerExecutor: async () => { throw new Error("not used"); },
    loadReviewEvidence: () => ({ sourcePacket: {} as never, sourceSidecar: {}, anchorCatalog: [], rereadAuthoritativeSourceEvidence: () => ({ sourceSidecar: {}, anchorCatalog: [] }) }),
  }, {
    writeCandidate: async () => {
      const pending = candidates[writerCalls++];
      if (!pending) throw new Error("unbounded regeneration attempted");
      return { ok: true, sessionId: `writer-${writerCalls}`, committed: false, pending };
    },
    conductReview: async () => {
      reviewCalls += 1;
      return reviewCalls === 1
        ? { disposition: "SUPERSEDED", finalStatus: "REVISE", reason: "breakdown architecture fails", reader: { blockingFindings: [], advisoryFindings: [{ category: "pacing", unit: "breakdown", problem: "whole prose architecture fails", evidenceSpans: [] }] }, source: null, quiz: null, commitResult: null } as unknown as ForwardChapterConductorResultV1
        : { disposition: "COMMITTED", finalStatus: "PASS", reason: "fixed", commitResult: committed } as ForwardChapterConductorResultV1;
    },
  });
  assert.deepEqual(await chapterWriter("future-book", 10, { log: () => undefined } as unknown as AutopilotDeps, {}), committed);
  assert.equal(writerCalls, 2, "one first write plus exactly one full regeneration");
  assert.equal(reviewCalls, 2);
});

test("ROLLED_BACK policy restores its recorded previous writer and skips the forward reviewer stack", async () => {
  const runtime = resolveForwardLocalRuntime({ activationPolicyText: serializeForwardActivationPolicy(rolledBackPolicy()) });
  assert.equal(runtime.mode, "BASELINE");
  assert.equal(runtime.reason, "ROLLED_BACK");
  let seen: AuthorWriteOneOpts | undefined;
  const result = await runLocalAuthoringChapter({
    runtime,
    bookId: "future-book",
    chapterNumber: 3,
    riskSignals: risk(),
    authorDeps: { log: () => undefined } as unknown as AutopilotDeps,
  }, {
    writeCandidate: async (_book, _chapter, _deps, opts) => {
      seen = opts;
      return { ok: true, sessionId: "rollback-writer", committed: true };
    },
  });
  assert.equal(result.mode, "BASELINE");
  assert.equal(seen?.model, "baseline-model");
  assert.equal(seen?.effort, "high");
  assert.equal(seen?.deferCommit, false);
});

test("malformed or stale ACTIVE state refuses before a writer can run", async () => {
  assert.throws(
    () => resolveForwardLocalRuntime({ activationPolicyText: "{not-json" }),
    ForwardAuthorRuntimeError,
  );

  const staleEvidence = activeResolveInput();
  staleEvidence.currentEvidence = { ...staleEvidence.currentEvidence!, pilotEvidenceHash: sha("0") };
  assert.throws(() => resolveForwardLocalRuntime(staleEvidence), /evidence is stale/);

  const staleReview = activeResolveInput();
  staleReview.currentReviewConfigSha256 = sha("0");
  assert.throws(() => resolveForwardLocalRuntime(staleReview), /review config is stale/);

  const staleRoute = activeResolveInput();
  const routeBinding = runtimeBinding();
  staleRoute.currentNoApiRoute = noApiRoute(routeBinding, "different-cli");
  assert.throws(() => resolveForwardLocalRuntime(staleRoute), /route proof is stale/);

  const binding = runtimeBinding();
  const differentFixed: FixedReviewerProfilesV1 = {
    ...fixedReviewersFromRuntimeBinding(binding),
    readerPrimary: {
      profileId: "gpt-5.9-judge@high", model: "gpt-5.9-judge", effort: "high", qualificationHash: sha("f"),
    },
  };
  const mismatched = activation(binding, differentFixed);
  assert.throws(() => resolveForwardLocalRuntime({
    ...activeResolveInput(binding),
    activationPolicyText: serializeForwardActivationPolicy(mismatched.policy),
  }), /fixed reviewer stack is stale/);

  let writerCalled = false;
  const activeRuntime = resolveForwardLocalRuntime(activeResolveInput());
  await assert.rejects(
    runLocalAuthoringChapter({
      runtime: activeRuntime,
      bookId: "future-book",
      chapterNumber: 4,
      riskSignals: risk(),
      authorDeps: { log: () => undefined } as unknown as AutopilotDeps,
      // Missing executor and evidence loader: both are pre-spawn requirements.
    }, {
      writeCandidate: async () => {
        writerCalled = true;
        return { ok: false, reason: "must not run" };
      },
    }),
    /review-evidence loader/,
  );
  assert.equal(writerCalled, false);
});

test("normal-path factory reads independent current artifacts and refuses self-consistent stale activation files", () => {
  const stateDir = "/virtual/forward-local";
  const { files, binding } = standardActiveFiles(stateDir);
  const readText = (path: string): string | null => files.get(path) ?? null;
  let observedQualificationExperimentId: string | null = null;
  const control = resolveStandardForwardAutopilotControl({
    stateDir,
    readText,
    riskSignalsFor: () => risk(),
    reviewerExecutor: async () => { throw new Error("no execution in factory test"); },
    loadReviewEvidence: () => { throw new Error("no evidence load in factory test"); },
    verifyCurrentInstrumentBinding: (current, qualificationExperimentId) => {
      observedQualificationExperimentId = qualificationExperimentId;
      return hashCanonical(current);
    },
  });
  assert.equal(control.runtime.mode, "FORWARD_ACTIVE");
  assert.equal(observedQualificationExperimentId, "s16-forward-role-qualification-v2");
  if (control.runtime.mode === "FORWARD_ACTIVE") {
    assert.equal(control.runtime.binding.bindingSha256, binding.bindingSha256);
  }

  const onlySelfConsistent = new Map([...files].filter(([path]) =>
    path.endsWith("activation-policy.json") || path.endsWith("runtime-binding.json")));
  assert.throws(
    () => resolveStandardForwardAutopilotControl({ stateDir, readText: (path) => onlySelfConsistent.get(path) ?? null }),
    /current artifact is missing/,
    "policy+binding cannot vouch for their own freshness",
  );

  const tampered = new Map(files);
  const pilotPath = resolve(stateDir, FORWARD_LOCAL_CURRENT_PATHS.pilot);
  const pilot = JSON.parse(tampered.get(pilotPath)!) as ForwardLocalCurrentEvidenceV1;
  tampered.set(pilotPath, JSON.stringify({ ...pilot, payload: { result: "REVISE" } }));
  assert.throws(
    () => resolveStandardForwardAutopilotControl({
      stateDir,
      readText: (path) => tampered.get(path) ?? null,
      verifyCurrentInstrumentBinding: (current) => hashCanonical(current),
    }),
    /pilot payload hash drift/,
  );
});

test("normal ACTIVE path retains a real conductor result and writes real-sweep-bound acceptance last", async () => {
  const root = mkdtempSync(join(tmpdir(), "forward-local-ready-test-"));
  const stateDir = join(root, "forward-local");
  const bookId = "future-ready-book";
  try {
    const currentFiles = standardActiveFiles(stateDir);
    for (const [path, text] of currentFiles.files) {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, text);
    }
    const chapter = fxChapter({
      chapterId: `${bookId}-ch01`, number: 1, title: "Defaults and friction",
      hook: "Friction hides in defaults.",
      breakdown: {
        fastRead: "A team shortened a form and completion rose.",
        deepRead: "Removing a field reduced the work required to continue.",
        fullRead: "The same mechanism applies when a default path carries avoidable steps.",
      },
      keyTakeaway: "Change the default path, not the person.", tryThisNow: "Remove one field.",
      examples: [{ title: "Shorter form", scenario: "A team removed one optional field.", whatToDo: "Cut one field.", whyItMatters: "Completion improved." }],
      quiz: { passingScorePercent: 70, questions: [{ questionId: "q1", prompt: "Why did completion rise?", choices: ["The team advertised", "A field was removed", "Users were paid"], correctIndex: 1, explanation: "Removing the field lowered friction." }] },
      reviewCards: [{ front: "What moved behavior?", back: "The default." }],
      implementationPlan: { title: "Reduce friction", coreSkill: "Spot defaults", ifThenPlans: [{ context: "designing a form", plan: "cut one field" }], twentyFourHourChallenge: "Remove one field.", weeklyPractice: "Audit one default." },
      memorableLines: [{ text: "Defaults decide.", why: "Compact." }],
    } as Partial<ChapterV21>);
    const packet = fxPacket({ bookId, chapterId: chapter.chapterId, chapterNumber: 1 });
    const plan = fxPlan({
      bookId, chapterNumber: 1, sourcePacketSha256: sourcePacketHash(packet),
      units: [fxPlanUnit({ unitId: "unit.fact.ch01.fact.1", origin: "source_bound", form: "explanation", claimStrength: "descriptive", anchorIds: ["ch01.fact.1"] })],
    });
    const bytes = `${JSON.stringify(chapter, null, 2)}\n`;
    const attemptDir = join(root, "attempt");
    const workspaceDir = join(attemptDir, "workspace");
    mkdirSync(workspaceDir, { recursive: true });
    const attempt: ChapterAttempt = {
      identity: fxAttemptIdentity({
        attemptId: `${bookId}-ch01-author-initial-test`, bookId, chapterNumber: 1,
        sourcePlanHash: sourceUsePlanHash(plan),
        inputHashes: { sourceUsePlan: sourceUsePlanHash(plan), sourcePacket: sourcePacketHash(packet) },
        expectedBaseSha256: null,
      }),
      attemptDir, workspaceDir, candidateFileName: `${bookId}-ch01.v21-native.chapter.json`,
      candidatePath: join(workspaceDir, `${bookId}-ch01.v21-native.chapter.json`), evidenceRoot: null,
    };
    writeFileSync(attempt.candidatePath, bytes);
    let canonicalBytes: string | null = null;
    let provenance: ReturnType<PreparedAuthorCandidate["io"]["readProvenance"]> = null;
    const loadChapters = (_id: string): ChapterV21[] => canonicalBytes ? [JSON.parse(canonicalBytes) as ChapterV21] : [];
    const io = {
      readPacket: () => packet, readSourcePlan: () => plan,
      readChapterFile: () => canonicalBytes,
      writeChapterFile: (_book: string, _chapter: number, next: string) => { canonicalBytes = next; },
      removeChapterFile: () => { canonicalBytes = null; },
      readLeadOverride: () => null, writeLeadOverride: () => undefined, removeLeadOverride: () => undefined,
      recordProvenance: (chapterId: string, sessionId: string, contentHash?: string) => {
        provenance = { schemaVersion: "author-provenance-v2", chapterId, authorSessionId: sessionId, stampedAt: "2026-07-12T00:00:00.000Z", contentHash };
      },
      readProvenance: () => provenance,
      restoreProvenance: (_chapterId: string, previous: typeof provenance) => { provenance = previous; },
      loadChapters,
    } as unknown as PreparedAuthorCandidate["io"];
    const prepared: PreparedAuthorCandidate = {
      bookId, chapterNumber: 1, chapterId: chapter.chapterId, sessionId: "author-session-ready",
      attempt, bytes, chapter, plan, pendingLeadOverride: null, io,
    };
    let execution = 0;
    const reviewerExecutor: ForwardReviewerExecutor = async (request: ForwardReviewExecutionRequestV1): Promise<ForwardReviewExecutionResultV1> => {
      execution += 1;
      const output = request.lane === "reader"
        ? JSON.stringify({
            schema: "reader-experience-review-v1",
            scores: { retention: 92, quizzes: 92, transfer: 92, practical: 92, summaries: 92, tone: 92, limits: 92, insight: 92, density: 92, beginner: 92 },
            quizDerivation: { answers: ["b"], mechanisms: ["The prose says a field was removed."], confidence: ["high"], ambiguities: [""], tells: [] },
            recommendation: "SHIP", blockingFindings: [], escalationSignals: [], advisoryFindings: [],
            strongestEvidence: ["Change the default path."], weakestEvidence: [], oneParagraphVerdict: "Clear and usable.",
          })
        : request.lane === "source"
          ? JSON.stringify({
              schema: "source-integrity-review-v1",
              units: [{
                unitId: "unit.fact.ch01.fact.1", expectedOrigin: "source_bound", expectedForm: "explanation", claimStrengthExpected: "descriptive",
                visibleRegister: "clearly_sourced", supportStatus: "SUPPORTED", framingAdequate: null, claimStrengthFit: true, namedSpecificityAllowed: true,
                chapterEvidenceSpans: ["A team shortened a form and completion rose."], sourceEvidenceSpans: ["Synthetic claim ch01.fact.1"], findings: [],
              }],
              result: "PASS", blockingFindingIds: [], rationale: "source PASS",
            })
          : JSON.stringify({
              schema: "quiz-integrity-adjudication-v1",
              items: [{ itemId: "q1", keyedAnswerIndex: 1, derivedAnswerIndex: 1, agreement: true, keyCorrect: "correct", rationale: "Only the removed-field choice is supported.", defensibleAnswerIndices: [1], keyedMechanismSupported: true }],
            });
      return {
        schema: FORWARD_REVIEW_EXECUTION_RESULT_SCHEMA, executionId: `${request.lane}-ready-${execution}`,
        lane: request.lane, reviewOperationKey: request.reviewOperationKey,
        workspaceRole: request.workspaceRole, profileId: request.profileId,
        model: request.model, effort: request.effort, schemaSha256: request.schemaSha256,
        instrumentVersion: request.instrumentVersion, roleAssignmentSha256: request.roleAssignmentSha256,
        instrumentManifestSha256: request.instrumentManifestSha256,
        executionProfileHash: request.executionProfileHash, routePolicyVersion: request.routePolicyVersion, output,
      };
    };
    const sweepRoundId = "r20260712000000-abcdef";
    const rawSweepPath = join(stateDir, "raw-submissions", `${bookId}.${sweepRoundId}.sweep.json`);
    const rawSweepSubmission = {
      schemaVersion: "qc-sweep-submission-v1",
      bookId,
      roundId: sweepRoundId,
      role: "sweep",
      reviewer: "codex-qc:forward-sweep",
      reviewerSessionId: "independent-sweep-session",
      verdict: "PASS",
      checkedFamilies: [...REQUIRED_SWEEP_FAMILIES],
      findings: [],
    };
    mkdirSync(dirname(rawSweepPath), { recursive: true });
    writeFileSync(rawSweepPath, `${JSON.stringify(rawSweepSubmission, null, 2)}\n`);
    const rawSweepSourceId = evidenceSourceId({
      bookId, roundId: sweepRoundId, sourceRole: "sweep",
      submissionFile: rawSweepPath, sourceKind: "raw_submission",
    });
    const control = resolveStandardForwardAutopilotControl({
      stateDir,
      verifyCurrentInstrumentBinding: (current) => hashCanonical(current),
      riskSignalsFor: () => risk(),
      loadChapters: loadChapters as typeof import("../src/qc/manualKeyJudge.js").loadBookChapters,
      loadReviewEvidence: () => ({
        sourcePacket: packet, sourceSidecar: { schemaVersion: "source-v1", namedExamples: [] }, anchorCatalog: packet.allowedAnchors,
        rereadAuthoritativeSourceEvidence: () => ({ sourceSidecar: { schemaVersion: "source-v1", namedExamples: [] }, anchorCatalog: packet.allowedAnchors }),
      }),
      reviewerExecutor,
      runtimeDeps: {
        writeCandidate: async () => ({ ok: true, sessionId: prepared.sessionId, committed: false, pending: prepared }),
        conductReview: async (input, deps) => {
          const { runForwardChapterConductor } = await import("../src/orchestrator/forwardChapterConductor.js");
          const result = await runForwardChapterConductor(input, deps);
          if (result.finalStatus !== "PASS") throw new Error(`fixture review ${result.finalStatus}: ${JSON.stringify({ aggregate: result.aggregate, panel: result.executionEnvelope.panelAdjustmentReasons })}`);
          return result;
        },
      },
      runBookSweep: async (_book, chapters): Promise<SweepRecord> => ({
        schemaVersion: "sweep-attest-v1", bookId, roundId: sweepRoundId, verdict: "PASS",
        reviewer: "codex-qc:forward-sweep", reviewerSessionId: "independent-sweep-session",
        attestedAt: "2026-07-12T00:00:00.000Z", rawSubmissionFile: rawSweepPath,
        rawEvidenceSourceId: rawSweepSourceId, rawEvidenceSourceKind: "raw_submission",
        contentHashes: Object.fromEntries(chapters.map((item) => [String(item.number), chapterContentHash(item)])),
        checkedFamilies: [...REQUIRED_SWEEP_FAMILIES], findings: [],
      }),
    });
    const authorDeps = { log: () => undefined } as unknown as AutopilotDeps;
    const written = await control.writeOneChapter(bookId, 1, authorDeps, {});
    assert.equal(written.ok, true, written.ok ? "" : written.reason);
    assert.ok(written.ok && "committed" in written && written.committed === true);
    const retainedDir = join(stateDir, "books", bookId, "chapters");
    assert.equal(readFileSync(join(retainedDir, readdirSync(retainedDir)[0]), "utf8").includes("forward-chapter-conductor-result-v1"), true);
    const finalized = await control.finalizeBookAcceptance!(bookId, authorDeps);
    assert.equal(finalized.accepted, true, finalized.reason);
    const reread = control.readBookAcceptance(bookId);
    assert.equal(reread.accepted, true, reread.reason);
    const acceptance = JSON.parse(readFileSync(finalized.artifactPath, "utf8")) as { bookSweep: { artifactRelPath: string } };
    const sweep = JSON.parse(readFileSync(join(stateDir, "books", bookId, acceptance.bookSweep.artifactRelPath), "utf8")) as {
      sourceSweepSha256: string;
      sourceSweep: SweepRecord;
      rawSweepSubmission: { bytesSha256: string; contentSha256: string; path: string };
    };
    assert.equal(sweep.sourceSweepSha256, hashCanonical(sweep.sourceSweep));
    assert.deepEqual(sweep.sourceSweep.checkedFamilies, [...REQUIRED_SWEEP_FAMILIES]);
    const originalRawBytes = readFileSync(rawSweepPath, "utf8");
    assert.equal(sweep.rawSweepSubmission.path, rawSweepPath);
    assert.equal(sweep.rawSweepSubmission.bytesSha256.length, 64);
    assert.equal(sweep.rawSweepSubmission.contentSha256, hashCanonical(rawSweepSubmission));

    // Byte-only tampering (JSON content remains identical) must still stale the
    // acceptance, proving the wrapper binds actual retained bytes, not metadata.
    writeFileSync(rawSweepPath, `${originalRawBytes}\n`);
    const tampered = control.readBookAcceptance(bookId);
    assert.equal(tampered.accepted, false);
    assert.match(tampered.reason, /raw submission bytes\/path binding changed/i);
    writeFileSync(rawSweepPath, originalRawBytes);
    assert.equal(control.readBookAcceptance(bookId).accepted, true, "restored exact raw bytes recover the valid acceptance");
    rmSync(rawSweepPath, { force: true });
    const deleted = control.readBookAcceptance(bookId);
    assert.equal(deleted.accepted, false);
    assert.match(deleted.reason, /raw submission is missing\/unreadable/i);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("normal-path factory preserves absent and ROLLED_BACK baseline states without forward evidence files", () => {
  const absent = resolveStandardForwardAutopilotControl({
    stateDir: "/virtual/absent",
    readText: () => null,
    riskSignalsFor: () => risk(),
  });
  assert.equal(absent.runtime.mode, "BASELINE");
  assert.equal(absent.runtime.reason, "NO_POLICY");

  const stateDir = "/virtual/rolled-back";
  const policyPath = resolve(stateDir, "activation-policy.json");
  const rolledBack = resolveStandardForwardAutopilotControl({
    stateDir,
    readText: (path) => path === policyPath ? serializeForwardActivationPolicy(rolledBackPolicy()) : null,
    riskSignalsFor: () => risk(),
  });
  assert.equal(rolledBack.runtime.mode, "BASELINE");
  assert.equal(rolledBack.runtime.reason, "ROLLED_BACK");
});

test("runtime binding tamper and external capability enablement are unrepresentable", () => {
  const binding = runtimeBinding();
  assert.deepEqual(validateForwardLocalRuntimeBinding(binding), []);
  for (const field of ["publish", "promotion", "deployment", "upload", "apiFallbackAllowed"] as const) {
    const tampered = structuredClone(binding) as unknown as Record<string, unknown>;
    tampered[field] = true;
    assert.ok(validateForwardLocalRuntimeBinding(tampered).length > 0, field);
  }
  const source = readFileSync(resolve(PIPELINE_DIR, "src", "orchestrator", "forwardAuthorRuntime.ts"), "utf8");
  assert.doesNotMatch(source, /process\.env|from ["'](?:node:)?fs["']|OPENAI_API_KEY|CODEX_API_KEY/);
  assert.doesNotMatch(source, /publish:\s*true|promotion:\s*true|deployment:\s*true|upload:\s*true|apiFallbackAllowed:\s*true/);

  // WP-202: the ship path is DECOUPLED from the forward readiness/qualification stack.
  // book-autopilot (cli.ts) and book-run (liveRun.ts) no longer resolve the standard
  // forward factory, no longer consult FORWARD_ACTIVE, and no longer pass forward control
  // into the conductor — the default author writer routes through modelPolicy (WP-301).
  // These NEGATIVE assertions guard against re-introducing the retired ship-path wiring.
  const cli = readFileSync(resolve(PIPELINE_DIR, "src", "cli.ts"), "utf8");
  const liveRun = readFileSync(resolve(PIPELINE_DIR, "src", "orchestrator", "liveRun.ts"), "utf8");
  for (const [label, entrypoint] of [["book-autopilot", cli], ["book-run", liveRun]] as const) {
    assert.doesNotMatch(entrypoint, /resolveStandardForwardAutopilotControl\(\)/, `${label} must not resolve the retired forward factory (WP-202)`);
    assert.doesNotMatch(entrypoint, /forwardControl\.runtime\.mode === "FORWARD_ACTIVE"/, `${label} must not consult FORWARD_ACTIVE on the ship path (WP-202)`);
    assert.doesNotMatch(entrypoint, /forwardAutopilotControl: forwardControl/, `${label} must not pass forward control into the conductor (WP-202)`);
  }
});
