/** IMP-24 retained-evidence activation and fail-closed regression tests. */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { test } from "./harness.js";
import { mkTestRoots, type TestRoots } from "./testRoots.js";
import { canonicalJson, hashCanonical, sha256Hex } from "../src/contracts/contractUtil.js";
import { chapterContentHash } from "../src/critics/qcAttestation.js";
import type { ChapterV21 } from "../src/types.js";
import { PIPELINE_DIR } from "../src/bakeoff/paths.js";
import {
  IMP24_ROLE_QUALIFICATION_ID,
  buildImp24CorpusBundle,
  certifyImp24Corpora,
  loadImp24FrozenV2Inputs,
} from "../src/bakeoff/migration/imp24Corpus.js";
import {
  createImp24QualificationEvaluator,
  prepareImp24QualificationCases,
} from "../src/bakeoff/migration/imp24InstrumentCertification.js";
import {
  IMP24_BASE_MAXIMUM_CALLS,
  IMP24_FROZEN_ROLE_THRESHOLDS,
  IMP24_HARD_MAXIMUM_CALLS,
  IMP24_INSTRUMENT_CERTIFICATION_BINDING_SCHEMA,
  IMP24_ROLE_CANDIDATE_ORDER,
  IMP24_ROLE_QUALIFICATION_AVAILABILITY_SCHEMA,
  IMP24_ROLE_QUALIFICATION_RECEIPT_SCHEMA,
  candidateAvailabilitySha256,
  instrumentCertificationBindingSha256,
  qualificationReceiptSha256,
  runRoleQualificationV3,
  type CandidateAvailabilityEntryV3,
  type CandidateAvailabilityV3,
  type InstrumentCertificationBindingV3,
  type QualificationExecutionReceiptV3,
  type QualificationExecutionRequestV3,
  type QualificationOutputEvaluatorV3,
  type RoleQualificationRunnerResultV3,
  type RunRoleQualificationInputV3,
} from "../src/bakeoff/migration/roleQualificationRunnerV3.js";
import { resolveExecutionProfile } from "../src/exec/executionEnvelope.js";
import {
  rollbackForwardPolicy,
  serializeForwardActivationPolicy,
} from "../src/orchestrator/forwardActivation.js";
import {
  buildForwardRoleAssignmentFreezeV3,
  type BuildForwardRoleAssignmentFreezeV3Input,
  type ForwardRoleAssignmentFreezeV3,
} from "../src/orchestrator/forwardRoleAssignmentFreezeV3.js";
import { buildForwardProductionInstrumentSeal } from "../src/orchestrator/forwardProductionInstrumentSeal.js";
import {
  IMP24_LIVE_ATTEMPT_RETENTION_SCHEMA,
  IMP24_LIVE_CALL_LEDGER_SCHEMA,
  IMP24_LIVE_PREFLIGHT_SCHEMA,
  type LiveAttemptRetentionV3,
  type LiveCallLedgerV3,
  type LiveQualificationPreflightV3,
} from "../src/orchestrator/forwardRoleQualificationLiveV3.js";
import {
  FORWARD_LIVE_CAMPAIGN_PREFLIGHT_V3_SCHEMA,
  FORWARD_LIVE_CAMPAIGN_RESULT_V3_SCHEMA,
  buildForwardGoldAdjudicatorPreDispatchTask,
  buildForwardGoldEvaluatorBaseTask,
  buildForwardGoldSweepPreDispatchTask,
  buildForwardGoldWorkerDispatchBinding,
  buildForwardV3QualificationProof,
  validateForwardInputMaterializationArtifact,
  type ForwardInputMaterializationProofV1,
  type ForwardLiveCampaignPreflightV3,
  type RunForwardLiveCampaignResultV3,
} from "../src/orchestrator/forwardLiveValidationDriver.js";
import type { ForwardInputFreezeV1 } from "../src/orchestrator/forwardInputFreeze.js";
import {
  FORWARD_ATTEMPT_RECORD_SCHEMA,
  FORWARD_FIRST_WRITE_SNAPSHOT_SCHEMA,
  FORWARD_GOLD_EVIDENCE_SCHEMA,
  FORWARD_PERSISTENCE_RECEIPT_SCHEMA,
  FORWARD_VALIDATION_RESULT_SCHEMA,
  type ForwardGoldEvidenceArtifactV1,
  type ForwardGoldPersistedEvidenceRefV1,
  type ForwardPersistenceReceiptV1,
  type ForwardValidationAttemptRecordV1,
  type ForwardValidationCampaignResultV1,
  type FrozenForwardValidationManifestV1,
} from "../src/orchestrator/forwardValidationCampaign.js";
import { FORWARD_LOCAL_ACTIVATION_POLICY_REL_PATH } from "../src/orchestrator/forwardLocalActivationMaterializer.js";
import {
  buildForwardLocalActivationArtifactsV2,
  type BuildForwardLocalActivationArtifactsInputV2,
} from "../src/orchestrator/forwardLocalActivationMaterializerV2.js";
import { resolveStandardForwardAutopilotControl } from "../src/orchestrator/forwardLocalAutopilot.js";
import { ROUTE_POLICY_VERSION } from "../src/orchestrator/modelPolicy.js";
import { materializeImp24ForwardInputs } from "../src/orchestrator/forwardInputMaterialization.js";
import {
  buildGoldArtifactsV2Envelope,
  buildPilotArtifactsV2Envelope,
} from "../src/orchestrator/forwardLiveArtifactMaterializerV3.js";
import {
  FORWARD_LIVE_CALL_CATEGORIES,
  FORWARD_LIVE_CALL_LEDGER_SCHEMA,
  FORWARD_LIVE_CALL_RECEIPT_SCHEMA,
  FORWARD_LIVE_MODEL_OPERATION_RECEIPT_SCHEMA,
  buildForwardLivePhaseBudget,
  type ForwardLiveCallCategory,
  type ForwardLiveCallEntryV1,
  type ForwardLiveCallLedgerV1,
  type ForwardLivePhaseBudgetV1,
} from "../src/orchestrator/forwardLiveCallLedger.js";
import { isInForwardReaderAuditSubset } from "../src/orchestrator/forwardReviewPolicy.js";
import { REQUIRED_SWEEP_FAMILIES, type SweepRecord } from "../src/qc/sweep.js";
import {
  createReviewEvidenceEnvelope,
  serializeReviewEvidenceEnvelope,
} from "../src/review/reviewEvidenceEnvelope.js";
import {
  FORWARD_PRODUCTION_REVIEW_PROTOCOL_V2,
  productionReviewEnvelopeSetSha256,
} from "../src/review/forwardProductionReviewV2.js";
import {
  FORWARD_CHAPTER_CONDUCTOR_SCHEMA,
  FORWARD_REVIEW_ENVELOPE_SCHEMA,
  FORWARD_REVIEW_EXECUTION_REQUEST_SCHEMA,
  FORWARD_REVIEW_EXECUTION_RESULT_SCHEMA,
  type ForwardPanelRole,
  type ForwardReviewExecutionEntryV1,
  type ForwardReviewExecutionRequestV1,
  type ForwardReviewExecutionResultV1,
} from "../src/orchestrator/forwardChapterConductor.js";
import {
  verifyForwardRetainedCampaignEvidenceV3,
  type VerifiedForwardRetainedCampaignEvidenceV3,
} from "../src/orchestrator/forwardRetainedCampaignEvidenceV3.js";
import { makeForwardGoldEvaluatorOutput } from "./forwardGoldRuntimeFixtures.js";
import {
  buildForwardGoldEvaluatorInstrument,
  buildForwardGoldSourceAwareExternalAccuracyProof,
} from "../src/orchestrator/forwardGoldEvaluatorInstrument.js";
import {
  IMP24_ACTIVATION_READINESS_PROOF_SCHEMA,
  IMP24_FULL_SUITE_ATTEMPT_LEDGER_SCHEMA,
  IMP24_FULL_SUITE_COMMAND,
  IMP24_FULL_SUITE_NO_LIVE_ROUTE_ROOT,
  IMP24_FULL_SUITE_PROCESS_LOG_SCHEMA,
  verifyImp24ActivationReadinessV2,
  type Imp24FullSuiteAttemptLedgerV1,
  type Imp24FullSuiteProcessLogV1,
  type VerifiedImp24ActivationReadinessV2,
} from "../src/orchestrator/forwardActivationReadinessV2.js";
import {
  IMP24_ROLE_QUALIFICATION_CAMPAIGN_REPORT_SCHEMA,
  buildImp24ImplementationCiGateFromEvidence,
  imp24ImplementationCiGateSha256,
  type Imp24CheckoutIdentityV1,
  type Imp24ImplementationCiGateV1,
  type Imp24RoleQualificationCampaignReportV1,
  type Imp24TrustedPullRequestEvidenceV1,
  type Imp24TrustedWorkflowRunEvidenceV1,
} from "../src/orchestrator/forwardRoleQualificationCampaignV3.js";
import {
  verifyForwardRetainedRoleQualificationEvidenceV3,
  type VerifiedForwardRetainedRoleQualificationEvidenceV3,
} from "../src/orchestrator/forwardRetainedRoleQualificationEvidenceV3.js";
import { runMigrationBakeoffCli } from "../src/bakeoff/migration/cli.js";
import {
  loadImp24PreLiveActivationCertificationV1,
  recordImp24ActivationFullSuiteV3,
} from "../src/bakeoff/migration/imp24ActivationWorkflow.js";

const REPOSITORY_ROOT = resolve(PIPELINE_DIR, "../../../..");
const CONTRACTS_DIR = resolve(PIPELINE_DIR, "state", "migration-experiments", "contracts");
const ROLES = ["reader", "source", "quiz"] as const;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${canonicalJson(value)}\n`);
}

function writePrettyJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function allAvailable(): CandidateAvailabilityV3 {
  const entries: CandidateAvailabilityEntryV3[] = ROLES.flatMap((role) =>
    IMP24_ROLE_CANDIDATE_ORDER[role].map((candidate, ordinal) => ({
      role,
      ordinal,
      ...candidate,
      status: "AVAILABLE" as const,
      modelListed: true,
      visible: true,
      effortSupported: true,
      reason: "hermetic retained-evidence activation fixture",
    })),
  );
  const core: Omit<CandidateAvailabilityV3, "availabilitySha256"> = {
    schema: IMP24_ROLE_QUALIFICATION_AVAILABILITY_SCHEMA,
    experimentId: IMP24_ROLE_QUALIFICATION_ID,
    source: "codex-local-models-cache",
    sourceBytesSha256: "1".repeat(64),
    sourceFetchedAt: "2026-07-13T12:00:00.000Z",
    policyBytesSha256: "2".repeat(64),
    candidateOrderSha256: hashCanonical(IMP24_ROLE_CANDIDATE_ORDER),
    entries,
  };
  return { ...core, availabilitySha256: candidateAvailabilitySha256(core) };
}

function qualificationReceipt(
  request: QualificationExecutionRequestV3,
  rawOutput: string,
): QualificationExecutionReceiptV3 {
  const core: Omit<QualificationExecutionReceiptV3, "receiptSha256"> = {
    schema: IMP24_ROLE_QUALIFICATION_RECEIPT_SCHEMA,
    executionId: `activation-test-${request.attemptId}`,
    status: "completed",
    requestSha256: request.requestSha256,
    freezeSha256: request.freezeSha256,
    certificationSha256: request.certificationSha256,
    productionInstrumentSealSha256: request.productionInstrumentSealSha256,
    role: request.role,
    profileId: request.profileId,
    model: request.model,
    effort: request.effort,
    schemaSha256: request.schemaSha256,
    reviewProtocol: request.reviewProtocol,
    evidenceEnvelopeSha256: request.evidenceEnvelopeSha256,
    evidenceEnvelopeBytesSha256: request.evidenceEnvelopeBytesSha256,
    evidenceEnvelopeBytes: request.evidenceEnvelopeBytes,
    rawOutput,
  };
  return { ...core, receiptSha256: qualificationReceiptSha256(core) };
}

type ActivationQualificationFixture = {
  current: BuildForwardRoleAssignmentFreezeV3Input;
  freeze: ForwardRoleAssignmentFreezeV3;
  qualificationPreflight: LiveQualificationPreflightV3;
  input: RunRoleQualificationInputV3;
  evaluateOutput: QualificationOutputEvaluatorV3;
  qualificationExperimentDir: string;
  retainedQualificationEvidence: VerifiedForwardRetainedRoleQualificationEvidenceV3;
};

function persistQualificationEvidenceFixture(args: {
  experimentDir: string;
  input: RunRoleQualificationInputV3;
  result: RoleQualificationRunnerResultV3;
  roleAssignmentFreeze: ForwardRoleAssignmentFreezeV3;
  preflight: LiveQualificationPreflightV3;
}): void {
  const liveDir = resolve(args.experimentDir, "live");
  const candidateAvailabilityPath = resolve(args.experimentDir, "candidate-availability.json");
  const implementationGatePath = resolve(args.experimentDir, "implementation-ci-gate.json");
  const preflightPath = resolve(liveDir, "preflight.json");
  const qualificationFreezePath = resolve(liveDir, "qualification-freeze.json");
  const qualificationResultPath = resolve(liveDir, "qualification-result.json");
  const roleRegistryPath = resolve(liveDir, "role-registry.json");
  const callLedgerPath = resolve(liveDir, "call-ledger.json");
  const roleAssignmentFreezePath = resolve(args.experimentDir, "role-assignment-freeze.json");

  writeJson(candidateAvailabilityPath, args.input.candidateAvailability);
  writeJson(preflightPath, args.preflight);
  writeJson(qualificationFreezePath, args.result.freeze);
  writeJson(qualificationResultPath, args.result);
  writeJson(roleRegistryPath, args.result.registry);
  writeJson(roleAssignmentFreezePath, args.roleAssignmentFreeze);

  for (const attempt of args.result.attempts) {
    assert.ok(attempt.receipt, `${attempt.request.attemptId} must retain its receipt`);
    const attemptDir = resolve(liveDir, "attempts", attempt.request.attemptId);
    const retentionCore: Omit<LiveAttemptRetentionV3, "retentionSha256"> = {
      schema: IMP24_LIVE_ATTEMPT_RETENTION_SCHEMA,
      requestSha256: attempt.request.requestSha256,
      receiptSha256: attempt.receipt.receiptSha256,
      evidenceEnvelopeSha256: attempt.request.evidenceEnvelopeSha256,
      evidenceEnvelopeBytesSha256: attempt.request.evidenceEnvelopeBytesSha256,
      request: attempt.request,
      receipt: attempt.receipt,
    };
    writePrettyJson(resolve(attemptDir, "request.json"), attempt.request);
    mkdirSync(attemptDir, { recursive: true });
    writeFileSync(resolve(attemptDir, "evidence-envelope.json"), attempt.request.evidenceEnvelopeBytes);
    writePrettyJson(resolve(attemptDir, "receipt.json"), attempt.receipt);
    writePrettyJson(resolve(attemptDir, "retention.json"), {
      ...retentionCore,
      retentionSha256: hashCanonical(retentionCore),
    });
  }

  const ledger: LiveCallLedgerV3 = {
    schema: IMP24_LIVE_CALL_LEDGER_SCHEMA,
    experimentId: IMP24_ROLE_QUALIFICATION_ID,
    freezeSha256: args.result.freeze.freezeSha256,
    certificationSha256: args.result.freeze.certificationSha256,
    productionInstrumentSealSha256: args.result.freeze.productionInstrumentSealSha256,
    entries: args.result.attempts.map((attempt, ordinal) => ({
      attemptId: attempt.request.attemptId,
      scheduleId: attempt.request.scheduleId,
      requestSha256: attempt.request.requestSha256,
      evidenceEnvelopeSha256: attempt.request.evidenceEnvelopeSha256,
      evidenceEnvelopeBytesSha256: attempt.request.evidenceEnvelopeBytesSha256,
      receiptSha256: attempt.receipt!.receiptSha256,
      status: attempt.receipt!.status,
      cached: false,
      requestedAt: new Date(Date.parse("2026-07-13T12:02:00.000Z") + ordinal * 2).toISOString(),
      completedAt: new Date(Date.parse("2026-07-13T12:02:00.000Z") + ordinal * 2 + 1).toISOString(),
    })),
    brokerRequests: args.result.totalAttempts,
    codexExecInvocations: args.result.totalAttempts,
    cachedReceipts: 0,
    infrastructureReplays: args.result.infrastructureReplays,
    apiCallsMade: 0,
  };
  writeJson(callLedgerPath, ledger);

  const headSha = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: REPOSITORY_ROOT,
    encoding: "utf8",
  }).trim();
  const checkout: Imp24CheckoutIdentityV1 = {
    branch: "feat/v25-pipeline-live",
    headSha,
    implementationClean: true,
  };
  const workflowRun: Imp24TrustedWorkflowRunEvidenceV1 = {
    databaseId: 9002,
    workflowName: "ChapterFlow V25 Pipeline",
    headBranch: "feat/v25-pipeline-live",
    headSha,
    status: "completed",
    conclusion: "success",
    jobs: [{
      name: "V25 Pipeline Typecheck, Contracts, and Tests",
      status: "completed",
      conclusion: "success",
    }],
  };
  const pullRequest: Imp24TrustedPullRequestEvidenceV1 = {
    number: 401,
    state: "OPEN",
    isDraft: true,
    mergedAt: null,
    mergeCommit: null,
    headRefName: "feat/v25-pipeline-live",
    headRefOid: headSha,
  };
  const gate = buildImp24ImplementationCiGateFromEvidence({
    expectedHeadSha: headSha,
    workflowRunId: workflowRun.databaseId,
    checkout,
    workflowRun,
    pullRequest,
    verifiedAt: "2026-07-13T12:01:30.000Z",
  });
  writeJson(implementationGatePath, gate);

  const profileStatusCounts: Record<string, number> = {};
  for (const profileResult of args.result.profileRoleResults) {
    profileStatusCounts[profileResult.status] = (profileStatusCounts[profileResult.status] ?? 0) + 1;
  }
  const artifactPaths = {
    implementationCiGate: implementationGatePath,
    candidateAvailability: candidateAvailabilityPath,
    preflight: preflightPath,
    qualificationFreeze: qualificationFreezePath,
    qualificationResult: qualificationResultPath,
    roleRegistry: roleRegistryPath,
    callLedger: callLedgerPath,
    roleAssignmentFreeze: roleAssignmentFreezePath,
  };
  const artifactBytesSha256 = Object.fromEntries(Object.entries(artifactPaths)
    .map(([label, path]) => [label, sha256Hex(readFileSync(path))]));
  const reportCore: Omit<Imp24RoleQualificationCampaignReportV1, "reportSha256"> = {
    schema: IMP24_ROLE_QUALIFICATION_CAMPAIGN_REPORT_SCHEMA,
    experimentId: IMP24_ROLE_QUALIFICATION_ID,
    status: "ROLE_SET_READY",
    implementationCiGateSha256: gate.gateSha256,
    implementationHeadSha: gate.headSha,
    candidateAvailabilitySha256: args.preflight.candidateAvailabilitySha256,
    preflightSha256: args.preflight.preflightSha256,
    qualificationFreezeSha256: args.result.freeze.freezeSha256,
    qualificationResultSha256: hashCanonical(args.result),
    roleRegistrySha256: hashCanonical(args.result.registry),
    roleAssignmentFreezeSha256: args.roleAssignmentFreeze.freezeSha256,
    selected: args.result.selected,
    profileStatusCounts: Object.fromEntries(Object.entries(profileStatusCounts)
      .sort(([left], [right]) => left.localeCompare(right))),
    callCounts: {
      baseMaximum: IMP24_BASE_MAXIMUM_CALLS,
      hardMaximum: IMP24_HARD_MAXIMUM_CALLS,
      baseCallsAttempted: args.result.baseCallsAttempted,
      infrastructureReplays: args.result.infrastructureReplays,
      totalAttempts: args.result.totalAttempts,
      brokerRequests: ledger.brokerRequests,
      codexExecInvocations: ledger.codexExecInvocations,
      cachedReceipts: ledger.cachedReceipts,
      apiCalls: 0,
    },
    thresholdsWeakened: false,
    holdoutsRelabeled: false,
    unavailableReplaced: false,
    retriesAdded: false,
    externalCapabilities: {
      publish: false,
      promote: false,
      deploy: false,
      upload: false,
      merge: false,
      forcePush: false,
      api: false,
      directHttpOrSdk: false,
    },
    completedAt: "2026-07-13T12:04:00.000Z",
    artifactBytesSha256,
  };
  writeJson(resolve(args.experimentDir, "qualification-report.json"), {
    ...reportCore,
    reportSha256: hashCanonical(reportCore),
  });
}

let qualificationFixturePromise: Promise<ActivationQualificationFixture> | null = null;

async function qualificationFixture(): Promise<ActivationQualificationFixture> {
  if (qualificationFixturePromise) return qualificationFixturePromise;
  qualificationFixturePromise = (async () => {
    const corpusBundle = buildImp24CorpusBundle(loadImp24FrozenV2Inputs(CONTRACTS_DIR));
    const corpusCertification = certifyImp24Corpora(corpusBundle);
    const prepared = prepareImp24QualificationCases({ repositoryRoot: REPOSITORY_ROOT, corpusBundle });
    const productionInstrumentSeal = clone(buildForwardProductionInstrumentSeal({ repositoryRoot: REPOSITORY_ROOT }));
    const thresholds = clone(IMP24_FROZEN_ROLE_THRESHOLDS);
    const certificationCore: Omit<InstrumentCertificationBindingV3, "certificationSha256"> = {
      schema: IMP24_INSTRUMENT_CERTIFICATION_BINDING_SCHEMA,
      status: "CERTIFIED_MODEL_FREE",
      sourceMissingEvidenceInconclusiveCertified: true,
      experimentId: IMP24_ROLE_QUALIFICATION_ID,
      corpusCertificationSha256: hashCanonical(corpusCertification),
      corpusBundleSha256: corpusBundle.substantiveBundleSha256,
      productionInstrumentSealSha256: productionInstrumentSeal.sealSha256,
      envelopeContractSha256: "3".repeat(64),
      envelopeCompilerSha256: "4".repeat(64),
      modelOutputContractsSha256: "5".repeat(64),
      productionQualificationParitySha256: "b".repeat(64),
      scorerSha256: "6".repeat(64),
      promptBundleSha256: hashCanonical(prepared.promptSourceHashes),
      schemaBundleSha256: hashCanonical(prepared.schemaHashes),
      thresholdsSha256: hashCanonical(thresholds),
      legacyEvidenceClosureSha256: "7".repeat(64),
      independentAuditPasses: 2,
      modelCalls: 0,
      apiCalls: 0,
    };
    const certification: InstrumentCertificationBindingV3 = {
      ...certificationCore,
      certificationSha256: instrumentCertificationBindingSha256(certificationCore),
    };
    const input: RunRoleQualificationInputV3 = {
      experimentId: IMP24_ROLE_QUALIFICATION_ID,
      corpusBundle,
      corpusCertification,
      certification,
      productionInstrumentSeal,
      candidateAvailability: allAvailable(),
      thresholds,
      thresholdBytesSha256: sha256Hex(JSON.stringify(thresholds)),
      schemaHashes: prepared.schemaHashes,
      promptSourceHashes: prepared.promptSourceHashes,
      preparedCases: prepared.preparedCases,
    };
    const evaluator = createImp24QualificationEvaluator(corpusBundle);
    const result = await runRoleQualificationV3(input, {
      executor: async (request) => qualificationReceipt(request, evaluator.fixtureOutputByCaseId[request.caseId]!),
      evaluateOutput: evaluator.evaluateOutput,
      qualifiedAt: () => "2026-07-13T12:00:00.000Z",
    });
    assert.equal(result.roleSetReady, true, result.roleSetBlockedReason ?? "");
    const route = resolveExecutionProfile("chapter-reviewer");
    const current: BuildForwardRoleAssignmentFreezeV3Input = {
      result,
      certification,
      corpusBundle,
      schemaHashes: input.schemaHashes,
      promptSourceHashes: input.promptSourceHashes,
      routeBinding: {
        executionRoute: "codex_exec_chatgpt_subscription",
        authMode: "chatgpt",
        apiKeyPresent: false,
        apiFallbackAllowed: false,
        directHttpOrSdkAllowed: false,
        executionProfileHash: route.profileHash,
        routePolicyVersion: ROUTE_POLICY_VERSION,
      },
      productionInstrumentSeal,
      repositoryRoot: REPOSITORY_ROOT,
    };
    const freeze = buildForwardRoleAssignmentFreezeV3(current) as ForwardRoleAssignmentFreezeV3;
    const preflightCore: Omit<LiveQualificationPreflightV3, "preflightSha256"> = {
      schema: IMP24_LIVE_PREFLIGHT_SCHEMA,
      experimentId: IMP24_ROLE_QUALIFICATION_ID,
      verifiedAt: "2026-07-13T12:01:00.000Z",
      freezeSha256: result.freeze.freezeSha256,
      certificationSha256: certification.certificationSha256,
      productionInstrumentSealSha256: productionInstrumentSeal.sealSha256,
      corpusBundleSha256: corpusBundle.substantiveBundleSha256,
      candidateAvailabilitySha256: input.candidateAvailability.availabilitySha256,
      candidateAvailabilitySourceBytesSha256: input.candidateAvailability.sourceBytesSha256,
      cliVersion: "codex-cli 0.144.1",
      cliBinary: "codex",
      cliSynthetic: false,
      executionProfileHash: route.profileHash,
      routePolicyVersion: ROUTE_POLICY_VERSION,
      executionRoute: "codex_exec_chatgpt_subscription",
      authMode: "chatgpt",
      apiKeyPresent: false,
      apiFallbackAllowed: false,
      directHttpOrSdkAllowed: false,
      forbiddenProviderEnvKeysPresent: [],
      baseMaximumCalls: IMP24_BASE_MAXIMUM_CALLS,
      hardMaximumCalls: IMP24_HARD_MAXIMUM_CALLS,
    };
    const qualificationPreflight: LiveQualificationPreflightV3 = {
      ...preflightCore,
      preflightSha256: hashCanonical(preflightCore),
    };
    const roots = mkTestRoots("imp24-retained-role-qualification-v3");
    process.once("exit", roots.dispose);
    const qualificationExperimentDir = resolve(roots.base, "qualification-experiment");
    persistQualificationEvidenceFixture({
      experimentDir: qualificationExperimentDir,
      input,
      result,
      roleAssignmentFreeze: freeze,
      preflight: qualificationPreflight,
    });
    const retainedQualificationEvidence = verifyForwardRetainedRoleQualificationEvidenceV3({
      repositoryRoot: REPOSITORY_ROOT,
      experimentDir: qualificationExperimentDir,
      input,
      evaluateOutput: evaluator.evaluateOutput,
      roleAssignmentFreeze: freeze,
    });
    return {
      current,
      freeze,
      qualificationPreflight,
      input,
      evaluateOutput: evaluator.evaluateOutput,
      qualificationExperimentDir,
      retainedQualificationEvidence,
    };
  })();
  return qualificationFixturePromise;
}

function chapterKey(target: { bookId: string; chapterNumber: number }): string {
  return `${target.bookId}/ch${String(target.chapterNumber).padStart(2, "0")}`;
}

function passingAttempt(
  target: FrozenForwardValidationManifestV1["manifest"]["targets"][number],
  index: number,
  phaseDir: string,
): ForwardValidationAttemptRecordV1 {
  const chapter = {
    schemaVersion: "2.1",
    chapterId: target.chapterId,
    number: target.chapterNumber,
    title: `Retained gold chapter ${target.chapterNumber}`,
  } as unknown as ChapterV21;
  const outputPath = resolve(
    phaseDir,
    "live-campaign",
    "outputs",
    target.outputRunId,
    "chapters",
    `${target.chapterId}.v21-native.chapter.json`,
  );
  writeJson(outputPath, chapter);
  const candidateContentSha256 = chapterContentHash(chapter);
  const executionEnvelope = { finalStatus: "PASS" };
  return {
    schema: FORWARD_ATTEMPT_RECORD_SCHEMA,
    chapterKey: chapterKey(target),
    stage: "first-write",
    attemptId: `retained-${target.bookId}-${target.chapterNumber}`,
    attemptDir: resolve(phaseDir, "attempts", target.bookId, `ch${String(target.chapterNumber).padStart(2, "0")}`),
    candidateBytesSha256: sha256Hex(readFileSync(outputPath)),
    candidateContentSha256,
    patchSha256: null,
    reader: { blockingFindings: [] },
    source: {
      result: "PASS",
      chapterContentSha256: candidateContentSha256,
      sourceUsePlanSha256: target.sourceUsePlanSha256,
      sourcePacketSha256: target.sourcePacketSha256,
      sidecarSha256: target.sidecarSha256,
      blockingFindingIds: [],
      units: [],
    },
    quiz: { result: "PASS", questions: [] },
    aggregate: { readerComposite: 84 + (index % 3) },
    executionEnvelope,
    executionEnvelopeSha256: hashCanonical(executionEnvelope),
    disposition: "COMMITTED",
    finalStatus: "PASS",
    pass: true,
    failureClassification: null,
    repairFailureDisposition: null,
    failureReasons: [],
  } as unknown as ForwardValidationAttemptRecordV1;
}

function persistEvidence(
  phaseDir: string,
  kind: ForwardPersistenceReceiptV1["kind"],
  storageId: string,
  value: unknown,
): ForwardPersistenceReceiptV1 {
  writeJson(resolve(phaseDir, storageId), value);
  return {
    schema: FORWARD_PERSISTENCE_RECEIPT_SCHEMA,
    kind,
    storageId,
    contentSha256: hashCanonical(value),
  };
}

type GoldCallBinding = {
  callId: string;
  role: "blind-rater" | "adjudicator" | "book-sweep";
  actorId: string;
  executionId: string;
  output: unknown;
  outputSha256: string;
  request: Record<string, unknown>;
};

function buildGoldEvaluation(
  phaseDir: string,
  manifest: FrozenForwardValidationManifestV1,
  materializationProof: ForwardInputMaterializationProofV1,
  finalByChapter: Record<string, ForwardValidationAttemptRecordV1>,
  receipts: ForwardPersistenceReceiptV1[],
): { evaluation: NonNullable<ForwardValidationCampaignResultV1["goldEvaluation"]>; calls: GoldCallBinding[] } {
  assert.equal(manifest.manifest.kind, "gold");
  const goldManifest = manifest.manifest as Extract<typeof manifest.manifest, { kind: "gold" }>;
  const finalChapterContentHashes = Object.fromEntries(Object.entries(finalByChapter)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, record]) => [String(Number(key.match(/ch(\d+)$/)?.[1] ?? "0")), record.candidateContentSha256!])) as Record<string, string>;
  const bookId = goldManifest.targets[0].bookId;
  const expectedChapters = [...goldManifest.targets]
    .sort((left, right) => left.chapterNumber - right.chapterNumber)
    .map((target) => {
      const path = resolve(phaseDir, "live-campaign", "outputs", target.outputRunId, "chapters",
        `${target.chapterId}.v21-native.chapter.json`);
      const chapter = JSON.parse(readFileSync(path, "utf8")) as ChapterV21;
      return {
        chapterIndex: target.chapterNumber,
        chapterId: target.chapterId,
        title: chapter.title,
        packagePath: `chapters/ch${String(target.chapterNumber).padStart(2, "0")}.chapter.json`,
      };
    });
  const sourceLaneEvidence = expectedChapters.map((expected, index) => {
    const target = [...goldManifest.targets].sort((left, right) => left.chapterNumber - right.chapterNumber)[index];
    const final = finalByChapter[chapterKey(target)];
    return {
      ...expected,
      candidateContentSha256: final.candidateContentSha256!,
      sourceResultSha256: hashCanonical(final.source),
      executionEnvelopeSha256: final.executionEnvelopeSha256!,
      sourceStatus: "PASS" as const,
      sourceBlockerCount: 0,
      evidenceFresh: true,
    };
  });
  const sourceHash = hashCanonical({
    schema: "forward-gold-authoritative-source-inventory-v1",
    bookId,
    instrumentSha256: goldManifest.goldEvaluatorInstrumentSha256,
    materializedInputFiles: Object.entries(materializationProof.bookFileInventory[bookId] ?? {})
      .map(([relativePath, bytesSha256]) => ({ relativePath, bytesSha256 }))
      .sort((left, right) => left.relativePath.localeCompare(right.relativePath)),
    finalChapters: [...goldManifest.targets]
      .sort((left, right) => left.chapterNumber - right.chapterNumber)
      .map((target, index) => ({
        chapterIndex: target.chapterNumber,
        chapterId: target.chapterId,
        title: expectedChapters[index].title,
        candidateContentSha256: finalByChapter[chapterKey(target)].candidateContentSha256!,
        bytesSha256: sha256Hex(readFileSync(resolve(phaseDir, "live-campaign", "outputs", target.outputRunId,
          "chapters", `${target.chapterId}.v21-native.chapter.json`))),
      })),
  });
  const sourceAware = buildForwardGoldSourceAwareExternalAccuracyProof({
    bookId,
    sourceHash,
    chapters: sourceLaneEvidence,
  });
  const sweep: SweepRecord = {
    schemaVersion: "sweep-attest-v1",
    bookId,
    roundId: "imp24-retained-gold-round",
    verdict: "PASS",
    reviewer: "independent-gold-sweep",
    attestedAt: "2026-07-13T12:02:00.000Z",
    reviewerSessionId: "gold-sweep-execution",
    contentHashes: finalChapterContentHashes,
    checkedFamilies: [...REQUIRED_SWEEP_FAMILIES],
    findings: [],
  };
  const evaluationProjection = {
    technicalCompleteness: "PASS" as const,
    epistemicInstructionalSafety: "PASS" as const,
    ethicsReaderAutonomy: "PASS" as const,
    purposeAudienceDeclaration: "PASS" as const,
    externalAccuracy: "PASS" as const,
    contentDesignScore: 100,
  };
  const fixedInstrument = buildForwardGoldEvaluatorInstrument();
  assert.equal(fixedInstrument.instrumentSha256, goldManifest.goldEvaluatorInstrumentSha256);
  const inspectionSha256 = hashCanonical({
    sourceHash,
    expectedChapters,
    sourceAwareExternalAccuracyProofSha256: sourceAware.proofSha256,
  });
  const repositoryRoot = resolve(PIPELINE_DIR, "../../../..");
  const orderedTargets = [...goldManifest.targets].sort((left, right) => left.chapterNumber - right.chapterNumber);
  const preparedCalls = fixedInstrument.calls.map((call) => {
    const workspace = resolve(phaseDir, "live-campaign", "evaluator-workspaces", call.callId);
    const artifacts: Array<{ relativePath: string; bytesSha256: string }> = [];
    const writeArtifact = (relativePath: string, bytes: Buffer | string): void => {
      const path = resolve(workspace, relativePath);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, bytes);
      artifacts.push({ relativePath, bytesSha256: sha256Hex(readFileSync(path)) });
    };
    writeArtifact("evaluation-scope.json", `${canonicalJson({
      schema: "forward-gold-blind-evaluation-scope-v1",
      bookId,
      sourceHash,
      inspectionSha256,
      instrumentSha256: fixedInstrument.instrumentSha256,
      productionInstrumentSealSha256: goldManifest.productionInstrumentSealSha256,
      chapters: expectedChapters,
      sourceBoundEvaluationRequired: true,
      priorReviewVerdictsIncluded: false,
    })}\n`);
    for (const asset of fixedInstrument.referenceAssets) {
      const bytes = readFileSync(resolve(repositoryRoot, asset.repositoryRelPath));
      assert.equal(sha256Hex(bytes), asset.bytesSha256);
      writeArtifact(asset.materializedRelPath, bytes);
    }
    const copyArtifact = (relativePath: string, sourcePath: string): void =>
      writeArtifact(relativePath, readFileSync(sourcePath));
    copyArtifact(`book/${bookId}.index.json`, resolve(phaseDir, "inputs", bookId, "indexes", `${bookId}.json`));
    copyArtifact(`book/${bookId}.manual-brief.json`,
      resolve(phaseDir, "inputs", bookId, "briefs", `${bookId}.manual-brief.json`));
    for (const target of orderedTargets) {
      const nn = String(target.chapterNumber).padStart(2, "0");
      copyArtifact(`chapters/ch${nn}.chapter.json`,
        resolve(phaseDir, "live-campaign", "outputs", target.outputRunId, "chapters",
          `${target.chapterId}.v21-native.chapter.json`));
      copyArtifact(`source/ch${nn}.source.json`,
        resolve(phaseDir, "inputs", target.bookId, "source-archive", target.bookId, `ch${nn}.source.json`));
      copyArtifact(`source/ch${nn}.anchors.json`,
        resolve(phaseDir, "inputs", target.bookId, "source-archive", target.bookId, `ch${nn}.anchors.json`));
      copyArtifact(`source/ch${nn}.source-packet.json`,
        resolve(phaseDir, "inputs", target.bookId, "books", target.bookId, "runs", "imp22-inputs-v1",
          "source-packets", `ch${nn}.source-packet.json`));
      copyArtifact(`source/ch${nn}.plan.json`,
        resolve(phaseDir, "inputs", target.bookId, "books", target.bookId, "runs", "imp22-inputs-v1",
          "source-plans", `ch${nn}.plan.json`));
    }
    return { call, workspace, artifacts, writeArtifact };
  });
  const finalizeCall = (index: number, chain?: { relativePath: string; value: unknown }) => {
    const prepared = preparedCalls[index];
    if (chain) prepared.writeArtifact(chain.relativePath, `${canonicalJson(chain.value)}\n`);
    let preDispatchTask = buildForwardGoldEvaluatorBaseTask(prepared.call.prompt);
    if (prepared.call.evaluationRole === "adjudicator") {
      preDispatchTask = buildForwardGoldAdjudicatorPreDispatchTask(preDispatchTask);
    } else if (prepared.call.evaluationRole === "book-sweep") {
      preDispatchTask = buildForwardGoldSweepPreDispatchTask(preDispatchTask);
    }
    const artifactsWithoutReceipt = [...prepared.artifacts]
      .sort((left, right) => left.relativePath.localeCompare(right.relativePath));
    const binding = buildForwardGoldWorkerDispatchBinding({
      call: {
        callId: prepared.call.callId,
        actorId: prepared.call.actorId,
        evaluationRole: prepared.call.evaluationRole,
        instrumentSha256: fixedInstrument.instrumentSha256,
        productionInstrumentSealSha256: goldManifest.productionInstrumentSealSha256,
        sourceHash,
        expectedChapters,
        sourceAwareExternalAccuracy: sourceAware,
        task: preDispatchTask,
      },
      artifacts: artifactsWithoutReceipt,
    });
    prepared.writeArtifact("worker-dispatch-receipt.json", `${canonicalJson(binding.receipt)}\n`);
    return {
      dispatchReceiptSha256: binding.receipt.dispatchReceiptSha256,
      outputSchemaSha256: prepared.call.outputSchemaSha256,
      taskSha256: sha256Hex(binding.task),
      artifacts: [...prepared.artifacts].sort((left, right) => left.relativePath.localeCompare(right.relativePath)),
    };
  };
  const executionIds = fixedInstrument.calls.map((call) => `imp22-gold-${call.callId}-attempt-1`);
  const primaryEvidence = finalizeCall(0);
  const verificationEvidence = finalizeCall(1);
  const primary = makeForwardGoldEvaluatorOutput({
    role: "primary", expectedChapters, sourceHash,
    dispatchReceiptSha256: primaryEvidence.dispatchReceiptSha256, rating: 4,
  });
  const verification = makeForwardGoldEvaluatorOutput({
    role: "verification", expectedChapters, sourceHash,
    dispatchReceiptSha256: verificationEvidence.dispatchReceiptSha256, rating: 4,
  });
  for (const output of [primary, verification]) output.book.book_id = bookId;
  const adjudicatorEvidence = finalizeCall(2, {
    relativePath: "blind-rater-results.json",
    value: {
      schema: "forward-gold-blind-rater-results-v1",
      raters: [
        {
          actorId: fixedInstrument.calls[0].actorId,
          executionId: executionIds[0],
          output: primary,
          outputSha256: hashCanonical(primary),
        },
        {
          actorId: fixedInstrument.calls[1].actorId,
          executionId: executionIds[1],
          output: verification,
          outputSha256: hashCanonical(verification),
        },
      ],
    },
  });
  const adjudicated = makeForwardGoldEvaluatorOutput({ role: "adjudicated", expectedChapters, sourceHash, rating: 4 });
  adjudicated.book.book_id = bookId;
  const sweepEvidence = finalizeCall(3, {
    relativePath: "adjudicated-result-binding.json",
    value: {
      schema: "forward-gold-adjudicated-result-binding-v1",
      actorId: fixedInstrument.calls[2].actorId,
      executionId: executionIds[2],
      outputSha256: hashCanonical(adjudicated),
      sourceHash,
      dispatchReceiptSha256: adjudicatorEvidence.dispatchReceiptSha256,
    },
  });
  const sweepOutput = {
    source_hash: sourceHash,
    worker_dispatch_receipt_sha256: sweepEvidence.dispatchReceiptSha256,
    sweep,
  };
  const callEvidence = [primaryEvidence, verificationEvidence, adjudicatorEvidence, sweepEvidence];
  const outputs: unknown[] = [primary, verification, adjudicated, sweepOutput];
  const calls: GoldCallBinding[] = fixedInstrument.calls.map((fixedCall, index) => ({
      callId: fixedCall.callId,
      role: fixedCall.evaluationRole,
      actorId: fixedCall.actorId,
      executionId: executionIds[index],
      output: outputs[index],
      outputSha256: hashCanonical(outputs[index]),
      request: {
        actorId: fixedCall.actorId,
        evaluationRole: fixedCall.evaluationRole,
        taskSha256: callEvidence[index].taskSha256,
        model: fixedCall.model,
        effort: fixedCall.effort,
        outputSchemaSha256: callEvidence[index].outputSchemaSha256,
        instrumentSha256: goldManifest.goldEvaluatorInstrumentSha256,
        productionInstrumentSealSha256: goldManifest.productionInstrumentSealSha256,
        sourceHash,
        dispatchReceiptSha256: callEvidence[index].dispatchReceiptSha256,
        expectedChaptersSha256: hashCanonical(expectedChapters),
        sourceAwareExternalAccuracyProofSha256: sourceAware.proofSha256,
        artifacts: callEvidence[index].artifacts,
      },
    }));
  const payloads = [calls[0].outputSha256, calls[1].outputSha256, hashCanonical(evaluationProjection), hashCanonical(sweep)];
  const kinds = ["gold-rater", "gold-rater", "gold-evaluator", "gold-sweep"] as const;
  const refs = calls.map((call, index): ForwardGoldPersistedEvidenceRefV1 => {
    const artifact: ForwardGoldEvidenceArtifactV1 = {
      schema: FORWARD_GOLD_EVIDENCE_SCHEMA,
      kind: kinds[index],
      actorId: call.actorId,
      executionId: call.executionId,
      finalChapterContentHashes,
      payloadSha256: payloads[index],
    };
    const receipt = persistEvidence(phaseDir, kinds[index], `evidence/gold-${index + 1}.json`, artifact);
    receipts.push(receipt);
    return {
      actorId: call.actorId,
      executionId: call.executionId,
      payloadSha256: payloads[index],
      artifactSha256: receipt.contentSha256,
      receipt,
    };
  });
  return {
    calls,
    evaluation: {
      ...evaluationProjection,
      sweep,
      evidenceBinding: {
        finalChapterContentHashes,
        evaluator: refs[2],
        raters: [refs[0], refs[1]],
        sweep: refs[3],
      },
    },
  };
}

type CallSpec = {
  category: ForwardLiveCallCategory;
  bookId: string;
  chapterNumber: number | null;
  stage: "first-write" | "book-evaluation";
  logicalOperationId: string;
  request: Record<string, unknown>;
  executionId: string;
  result: unknown;
  modelOperation: boolean;
};

function envelopeSegments(lane: "reader" | "source" | "quiz") {
  if (lane === "reader") return [{ refId: "chapter.001", kind: "chapter" as const, text: "Reader fixture chapter evidence." }];
  if (lane === "source") return [
    { refId: "chapter.001", kind: "chapter" as const, text: "Source fixture chapter evidence." },
    { refId: "plan.001", kind: "plan" as const, text: "Source fixture plan evidence." },
  ];
  return [
    { refId: "chapter.001", kind: "chapter" as const, text: "Quiz fixture chapter evidence." },
    { refId: "quiz-choice.001", kind: "quiz_choice" as const, text: "Quiz fixture choice evidence." },
    { refId: "quiz-derivation.001", kind: "quiz_derivation" as const, text: "Quiz fixture derivation evidence." },
    { refId: "quiz-explanation.001", kind: "quiz_explanation" as const, text: "Quiz fixture explanation evidence." },
    { refId: "quiz-key.001", kind: "quiz_key" as const, text: "Quiz fixture key evidence." },
    { refId: "quiz-prompt.001", kind: "quiz_prompt" as const, text: "Quiz fixture prompt evidence." },
  ];
}

function reviewerBinding(args: {
  fixture: ActivationQualificationFixture;
  kind: "pilot" | "gold";
  target: FrozenForwardValidationManifestV1["manifest"]["targets"][number];
  panelRole: ForwardPanelRole;
  lane: "reader" | "source" | "quiz";
  operationKey: string;
  suffix: string;
  sharedEvidence?: {
    envelope: ReturnType<typeof createReviewEvidenceEnvelope>;
    envelopeBytes: string;
    envelopeRelPath: string;
  };
}): {
  spec: CallSpec;
  execution: ForwardReviewExecutionEntryV1;
  envelopeSha256: string;
  evidence: {
    envelope: ReturnType<typeof createReviewEvidenceEnvelope>;
    envelopeBytes: string;
    envelopeRelPath: string;
  };
} {
  const key = chapterKey(args.target);
  const evidence = args.sharedEvidence ?? (() => {
    const envelope = createReviewEvidenceEnvelope({
      lane: args.lane,
      envelopeId: `${args.target.bookId}.ch${String(args.target.chapterNumber).padStart(2, "0")}.${args.suffix}`,
      caseId: `${args.target.bookId}.ch${String(args.target.chapterNumber).padStart(2, "0")}`,
      instrumentVersion: "imp24-inline-evidence-envelope-v1",
      segments: envelopeSegments(args.lane),
    });
    return {
      envelope,
      envelopeBytes: serializeReviewEvidenceEnvelope(envelope),
      envelopeRelPath: `${args.suffix}.review-evidence-envelope.json`,
    };
  })();
  const { envelope, envelopeBytes, envelopeRelPath } = evidence;
  const roleBinding = args.fixture.freeze.roleProfileBindings[args.panelRole];
  const instrument = args.fixture.freeze.reviewConfig.instrumentManifest;
  const schemaSha256 = args.lane === "reader"
    ? instrument.readerSchemaSha256
    : args.lane === "source"
      ? instrument.sourceSchemaSha256
      : instrument.quizAdjudicationSchemaSha256;
  const instrumentVersion = args.lane === "reader"
    ? instrument.readerRubricVersion
    : args.lane === "source"
      ? instrument.sourceRubricVersion
      : instrument.quizPhase2Version;
  const workspaceRole = args.lane === "reader"
    ? "direct-reader" as const
    : args.lane === "source"
      ? "source-verifier" as const
      : "quiz-adjudication" as const;
  const task = `Review the retained evidence envelope.\n${envelopeBytes}\nReturn only the pinned result.`;
  const artifacts = [{
    kind: "evidence-envelope" as const,
    relPath: envelopeRelPath,
    content: envelopeBytes,
    sha256: sha256Hex(envelopeBytes),
  }];
  const request: ForwardReviewExecutionRequestV1 = {
    schema: FORWARD_REVIEW_EXECUTION_REQUEST_SCHEMA,
    lane: args.lane,
    reviewOperationKey: args.operationKey,
    workspaceRole,
    profileId: roleBinding.judge.profileId,
    model: roleBinding.judge.model,
    effort: roleBinding.judge.effort,
    schemaSha256,
    instrumentVersion,
    reviewProtocol: "review-evidence-envelope-v1",
    evidenceEnvelopeSha256: envelope.envelopeSha256,
    evidenceEnvelopeBytesSha256: sha256Hex(envelopeBytes),
    roleAssignmentSha256: args.fixture.freeze.roleAssignmentSha256,
    instrumentManifestSha256: args.fixture.freeze.reviewConfig.instrumentManifestSha256,
    executionProfileHash: args.fixture.freeze.routeBinding.executionProfileHash,
    routePolicyVersion: args.fixture.freeze.routeBinding.routePolicyVersion,
    task,
    artifacts,
  };
  const executionId = `${key}-${args.suffix}-exec`;
  const output = JSON.stringify({ schema_version: "2.0.0", fixture: args.suffix, verdict: "PASS" });
  const result: ForwardReviewExecutionResultV1 = {
    schema: FORWARD_REVIEW_EXECUTION_RESULT_SCHEMA,
    executionId,
    lane: request.lane,
    reviewOperationKey: request.reviewOperationKey,
    workspaceRole: request.workspaceRole,
    profileId: request.profileId,
    model: request.model,
    effort: request.effort,
    schemaSha256: request.schemaSha256,
    instrumentVersion: request.instrumentVersion,
    reviewProtocol: request.reviewProtocol,
    evidenceEnvelopeSha256: request.evidenceEnvelopeSha256,
    evidenceEnvelopeBytesSha256: request.evidenceEnvelopeBytesSha256,
    roleAssignmentSha256: request.roleAssignmentSha256,
    instrumentManifestSha256: request.instrumentManifestSha256,
    executionProfileHash: request.executionProfileHash,
    routePolicyVersion: request.routePolicyVersion,
    output,
  };
  const { task: _task, artifacts: _artifacts, ...expected } = request;
  const { output: _output, ...received } = result;
  const execution: ForwardReviewExecutionEntryV1 = {
    lane: args.lane,
    reviewOperationKey: args.operationKey,
    panelRole: args.panelRole,
    roleProfileSha256: hashCanonical({
      judge: roleBinding.judge,
      executionProfileHash: request.executionProfileHash,
      routePolicyVersion: request.routePolicyVersion,
    }),
    expected,
    taskSha256: sha256Hex(task),
    artifactHashes: artifacts.map(({ kind, relPath, sha256 }) => ({ kind, relPath, sha256 })),
    status: "VERIFIED",
    received,
    outputSha256: sha256Hex(output),
    failureReason: null,
  };
  const categorySuffix = args.panelRole === "readerPrimary" ? "reader-primary"
    : args.panelRole === "readerAudit" ? "reader-audit"
      : args.panelRole === "sourcePrimary" ? "source-primary"
        : args.panelRole === "sourceAdjudicator" ? "source-adjudicator"
          : "quiz-adjudicator";
  return {
    envelopeSha256: envelope.envelopeSha256,
    evidence,
    execution,
    spec: {
      category: `${args.kind}-${categorySuffix}` as ForwardLiveCallCategory,
      bookId: args.target.bookId,
      chapterNumber: args.target.chapterNumber,
      stage: "first-write",
      logicalOperationId: `${key}/first-write/${args.panelRole}/${args.operationKey}`,
      request: request as unknown as Record<string, unknown>,
      executionId,
      result,
      modelOperation: false,
    },
  };
}

function bindAttemptConductorEvidence(args: {
  attempt: ForwardValidationAttemptRecordV1;
  target: FrozenForwardValidationManifestV1["manifest"]["targets"][number];
  fixture: ActivationQualificationFixture;
  kind: "pilot" | "gold";
  sourcePartitionCount: number;
}): CallSpec[] {
  const reader = reviewerBinding({ ...args, panelRole: "readerPrimary", lane: "reader", operationKey: "reader", suffix: "reader-primary" });
  const audited = isInForwardReaderAuditSubset(args.fixture.freeze.panelPolicy.auditSubset, args.target);
  const readerAudit = audited
    ? reviewerBinding({
        ...args,
        panelRole: "readerAudit",
        lane: "reader",
        operationKey: "reader",
        suffix: "reader-audit",
        sharedEvidence: reader.evidence,
      })
    : null;
  const sources = Array.from({ length: args.sourcePartitionCount }, (_, index) => {
    const nn = String(index + 1).padStart(3, "0");
    return reviewerBinding({
      ...args,
      panelRole: "sourcePrimary",
      lane: "source",
      operationKey: `source-${nn}`,
      suffix: `source-primary-${nn}`,
    });
  });
  const quiz = reviewerBinding({ ...args, panelRole: "quizSemanticAdjudicator", lane: "quiz", operationKey: "quiz", suffix: "quiz" });
  const authoritative = {
    protocolVersion: FORWARD_PRODUCTION_REVIEW_PROTOCOL_V2,
    readerEnvelopeSha256: reader.envelopeSha256,
    reader: { fixture: "reader", evidenceEnvelopeSha256: reader.envelopeSha256 },
    readerAudit: readerAudit ? { fixture: "reader-audit", evidenceEnvelopeSha256: reader.envelopeSha256 } : null,
    sourceEnvelopeSha256s: sources.map((source) => source.envelopeSha256),
    source: { fixture: "source", evidenceEnvelopeSha256: hashCanonical(sources.map((source) => source.envelopeSha256)) },
    sourceAdjudication: null,
    quizEnvelopeSha256: quiz.envelopeSha256,
    quiz: { fixture: "quiz", evidenceEnvelopeSha256: quiz.envelopeSha256 },
    envelopeSetSha256: productionReviewEnvelopeSetSha256({
      readerEnvelopeSha256: reader.envelopeSha256,
      sourceEnvelopeSha256s: sources.map((source) => source.envelopeSha256),
      quizEnvelopeSha256: quiz.envelopeSha256,
    }),
  };
  const executions = [reader.execution, ...(readerAudit ? [readerAudit.execution] : []), ...sources.map((source) => source.execution), quiz.execution];
  const envelope = {
    schema: FORWARD_REVIEW_ENVELOPE_SCHEMA,
    attemptId: args.attempt.attemptId,
    candidateContentSha256: args.attempt.candidateContentSha256,
    candidateBytesSha256: args.attempt.candidateBytesSha256,
    sourceUsePlanSha256: args.target.sourceUsePlanSha256,
    sourcePacketSha256: args.target.sourcePacketSha256,
    sidecarSha256: args.target.sidecarSha256,
    anchorCatalogSha256: args.target.anchorCatalogSha256,
    frozenReviewConfigSha256: args.fixture.freeze.reviewConfigSha256,
    roleAssignmentSha256: args.fixture.freeze.roleAssignmentSha256,
    instrumentManifestSha256: args.fixture.freeze.reviewConfig.instrumentManifestSha256,
    panelPolicySha256: args.fixture.freeze.panelPolicySha256,
    reviewProtocolVersion: FORWARD_PRODUCTION_REVIEW_PROTOCOL_V2,
    readerEvidenceEnvelopeSha256: authoritative.readerEnvelopeSha256,
    sourceEvidenceEnvelopeSha256s: authoritative.sourceEnvelopeSha256s,
    quizEvidenceEnvelopeSha256: authoritative.quizEnvelopeSha256,
    evidenceEnvelopeSetSha256: authoritative.envelopeSetSha256,
    readerV2ResultSha256: hashCanonical(authoritative.reader),
    readerAuditV2ResultSha256: authoritative.readerAudit ? hashCanonical(authoritative.readerAudit) : null,
    sourceV2ResultSha256: hashCanonical(authoritative.source),
    sourceAdjudicatorV2ResultSha256: null,
    quizV2ResultSha256: hashCanonical(authoritative.quiz),
    executions,
    derivationSha256: sha256Hex(`derivation-${args.attempt.chapterKey}`),
    deterministicCriticBundleSha256: sha256Hex(`critics-${args.attempt.chapterKey}`),
    readerResultSha256: hashCanonical(args.attempt.reader),
    readerPrimaryCategory: "PASS",
    readerAuditSelected: audited,
    readerAuditProfileId: readerAudit?.execution.expected.profileId ?? null,
    readerAuditResultSha256: null,
    readerAuditCategory: audited ? "PASS" : null,
    readerAuditDisagreement: false,
    sourceResultSha256: hashCanonical(args.attempt.source),
    sourceAdjudicationTriggered: false,
    sourceAdjudicatorProfileId: null,
    sourceAdjudicatorResultSha256: null,
    sourceAdjudicationAgreement: null,
    quizResultSha256: hashCanonical(args.attempt.quiz),
    aggregateSha256: hashCanonical(args.attempt.aggregate),
    panelAdjustmentReasons: [],
    finalStatus: "PASS" as const,
    disposition: "COMMITTED" as const,
    failureReason: null,
  };
  const conductor = {
    schema: FORWARD_CHAPTER_CONDUCTOR_SCHEMA,
    disposition: "COMMITTED" as const,
    finalStatus: "PASS" as const,
    reason: "retained V3 fixture PASS",
    reader: args.attempt.reader,
    readerAudit: audited ? args.attempt.reader : null,
    source: args.attempt.source,
    sourceAdjudication: null,
    quiz: args.attempt.quiz,
    aggregate: args.attempt.aggregate,
    committedDerivation: null,
    commitResult: { ok: true, committed: true },
    authoritativeV2: authoritative,
    executionEnvelope: envelope,
    executionEnvelopeSha256: hashCanonical(envelope),
  } as unknown as NonNullable<ForwardValidationAttemptRecordV1["conductorResult"]>;
  args.attempt.executionEnvelope = conductor.executionEnvelope;
  args.attempt.executionEnvelopeSha256 = conductor.executionEnvelopeSha256;
  args.attempt.conductorResult = conductor;
  args.attempt.conductorResultSha256 = hashCanonical(conductor);
  writeJson(resolve(args.attempt.attemptDir!, "forward-review-result.json"), conductor);
  return [reader.spec, ...(readerAudit ? [readerAudit.spec] : []), ...sources.map((source) => source.spec), quiz.spec];
}

function writeCallEvidence(liveDir: string, specs: CallSpec[]): ForwardLiveCallLedgerV1["entries"] {
  return specs.map((spec): ForwardLiveCallEntryV1 => {
    const requestSha256 = hashCanonical(spec.request);
    const attemptId = sha256Hex(`${spec.logicalOperationId}\0${1}\0${requestSha256}`);
    const requestProjection = spec.modelOperation ? spec.request : {
      ...spec.request,
      task: {
        sha256: sha256Hex(String(spec.request.task)),
        bytes: Buffer.byteLength(String(spec.request.task)),
        content: spec.request.task,
      },
      artifacts: (spec.request.artifacts as Array<Record<string, unknown>>).map((artifact) => ({
        kind: artifact.kind,
        relPath: artifact.relPath,
        sha256: artifact.sha256,
        bytes: Buffer.byteLength(String(artifact.content)),
        content: artifact.content,
      })),
    };
    const requestEnvelope = {
      requestSha256,
      requestProjectionSha256: hashCanonical(requestProjection),
      request: requestProjection,
    };
    const receipt = spec.modelOperation ? {
      schema: FORWARD_LIVE_MODEL_OPERATION_RECEIPT_SCHEMA,
      status: "completed" as const,
      executionId: spec.executionId,
      result: spec.result,
      failureMessage: null,
    } : {
      schema: FORWARD_LIVE_CALL_RECEIPT_SCHEMA,
      status: "completed" as const,
      executionId: spec.executionId,
      result: spec.result,
      failureMessage: null,
    };
    const projectedReceipt = spec.modelOperation ? {
      schema: FORWARD_LIVE_CALL_RECEIPT_SCHEMA,
      status: "completed" as const,
      executionId: spec.executionId,
      result: null,
      resultSha256: hashCanonical(spec.result),
      failureMessage: null,
    } : receipt;
    const callDir = resolve(liveDir, "model-calls", sha256Hex(spec.logicalOperationId), "attempt-1");
    writeJson(resolve(callDir, "request.json"), requestEnvelope);
    writeJson(resolve(callDir, "receipt.json"), receipt);
    return {
      category: spec.category,
      bookId: spec.bookId,
      chapterNumber: spec.chapterNumber,
      stage: spec.stage,
      logicalOperationId: spec.logicalOperationId,
      attemptId,
      attemptNumber: 1,
      requestSha256,
      receiptSha256: hashCanonical(projectedReceipt),
      status: "completed",
      executionId: spec.executionId,
      cached: false,
      recordedAt: "2026-07-13T12:02:00.000Z",
    };
  });
}

function retainedCampaign(args: {
  phaseDir: string;
  manifest: FrozenForwardValidationManifestV1;
  fixture: ActivationQualificationFixture;
}): RunForwardLiveCampaignResultV3 {
  const { phaseDir, manifest, fixture } = args;
  const kind = manifest.manifest.kind;
  const liveDir = resolve(phaseDir, "live-campaign");
  const retainedInputFreeze = JSON.parse(
    readFileSync(resolve(phaseDir, "input-freeze.json"), "utf8"),
  ) as ForwardInputFreezeV1;
  const materializationProof = validateForwardInputMaterializationArtifact({
    phaseDir,
    artifactPath: resolve(phaseDir, "input-materialization.json"),
    manifest,
    inputFreeze: retainedInputFreeze,
  });
  const attempts = manifest.manifest.targets.map((target, index) => passingAttempt(target, index, phaseDir));
  const specs: CallSpec[] = [];
  for (let index = 0; index < manifest.manifest.targets.length; index++) {
    const target = manifest.manifest.targets[index];
    const attempt = attempts[index];
    const key = chapterKey(target);
    specs.push({
      category: `${kind}-author-first-write`, bookId: target.bookId, chapterNumber: target.chapterNumber,
      stage: "first-write", logicalOperationId: `${key}/first-write/author`,
      request: { kind, key, stage: "first-write", operation: "author" },
      executionId: `${key}-author-exec`, result: { key, candidateContentSha256: attempt.candidateContentSha256 }, modelOperation: true,
    });
    specs.push(...bindAttemptConductorEvidence({
      attempt,
      target,
      fixture,
      kind,
      sourcePartitionCount: materializationProof.sourcePartitionCountByChapter[key],
    }));
  }
  const finalByChapter = Object.fromEntries(attempts.map((attempt) => [attempt.chapterKey, attempt]));
  const firstWriteSnapshot = {
    schema: FORWARD_FIRST_WRITE_SNAPSHOT_SCHEMA,
    experimentId: manifest.manifest.experimentId as ForwardLiveCampaignPreflightV3["experimentId"],
    manifestSha256: manifest.manifestSha256,
    totalChapters: attempts.length,
    passCount: attempts.length,
    passRate: 1,
    entries: attempts.map((attempt) => ({
      chapterKey: attempt.chapterKey,
      attemptId: attempt.attemptId,
      candidateBytesSha256: attempt.candidateBytesSha256,
      executionEnvelopeSha256: attempt.executionEnvelopeSha256,
      finalStatus: attempt.finalStatus,
      pass: attempt.pass,
    })),
  };
  const receipts: ForwardPersistenceReceiptV1[] = attempts.map((attempt, index) =>
    persistEvidence(phaseDir, "attempt", `evidence/attempt-${String(index + 1).padStart(2, "0")}.json`, attempt));
  receipts.push(persistEvidence(phaseDir, "first-write-snapshot", "evidence/first-write-snapshot.json", firstWriteSnapshot));
  const gold = kind === "gold"
    ? buildGoldEvaluation(phaseDir, manifest, materializationProof, finalByChapter, receipts)
    : null;
  const accounting = {
    totalChapters: attempts.length,
    firstWritePassCount: attempts.length,
    firstWritePassRate: 1,
    finalPassCount: attempts.length,
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
  const campaign: ForwardValidationCampaignResultV1 = {
    schema: FORWARD_VALIDATION_RESULT_SCHEMA,
    experimentId: manifest.manifest.experimentId,
    manifestSha256: manifest.manifestSha256,
    kind,
    firstWriteSnapshot,
    firstWriteSnapshotSha256: hashCanonical(firstWriteSnapshot),
    attempts,
    finalByChapter,
    accounting,
    goldEvaluation: gold?.evaluation ?? null,
    hardFailures: [],
    accepted: true,
    capabilitiesUsed: { publish: false, promote: false, deploy: false, upload: false },
    persistenceReceipts: receipts,
  };

  for (const call of gold?.calls ?? []) {
    specs.push({
      category: "gold-book-evaluator", bookId: "the-gifts-of-imperfection", chapterNumber: null,
      stage: "book-evaluation", logicalOperationId: `the-gifts-of-imperfection/book-evaluation/${call.callId}`,
      request: call.request, executionId: call.executionId,
      result: { actorId: call.actorId, executionId: call.executionId, output: call.output, outputSha256: call.outputSha256 },
      modelOperation: true,
    });
  }
  const entries = writeCallEvidence(liveDir, specs);
  const budget = buildForwardLivePhaseBudget({
    manifest,
    panelPolicy: fixture.freeze.panelPolicy,
    sourcePartitionCountByChapter: materializationProof.sourcePartitionCountByChapter,
    ...(kind === "gold" ? { goldBookEvaluatorExpectedCalls: 4, goldBookEvaluatorMaximumCallsBeforeReplay: 4 } : {}),
  });
  const ledger: ForwardLiveCallLedgerV1 = {
    schema: FORWARD_LIVE_CALL_LEDGER_SCHEMA,
    experimentId: manifest.manifest.experimentId,
    kind,
    manifestSha256: manifest.manifestSha256,
    budgetSha256: budget.budgetSha256,
    executionRoute: "codex_exec_chatgpt_subscription",
    authMode: "chatgpt",
    apiKeyPresent: false,
    apiCallsMade: 0,
    apiFallbackAllowed: false,
    entries,
    codexExecInvocations: entries.length,
    cachedReceipts: 0,
    infrastructureReplays: 0,
    maxPlanCapacityEvents: 0,
    safeguardsOrRefusals: 0,
  };
  const qualificationProof = buildForwardV3QualificationProof({
    currentQualification: fixture.current,
    roleFreeze: fixture.freeze,
  });
  const preflightCore: Omit<ForwardLiveCampaignPreflightV3, "preflightSha256"> = {
    schema: FORWARD_LIVE_CAMPAIGN_PREFLIGHT_V3_SCHEMA,
    kind,
    experimentId: manifest.manifest.experimentId as ForwardLiveCampaignPreflightV3["experimentId"],
    manifestSha256: manifest.manifestSha256,
    inputFreezeSha256: "0".repeat(64),
    inputMaterializationSha256: manifest.manifest.inputMaterializationSha256,
    productionInstrumentSealSha256: fixture.freeze.productionInstrumentSealSha256,
    goldEvaluatorInstrumentSha256: kind === "gold" && manifest.manifest.kind === "gold" ? manifest.manifest.goldEvaluatorInstrumentSha256 : null,
    roleAssignmentFreezeSha256: fixture.freeze.freezeSha256,
    roleAssignmentSha256: fixture.freeze.roleAssignmentSha256,
    qualificationExperimentId: IMP24_ROLE_QUALIFICATION_ID,
    qualificationResultSha256: hashCanonical(fixture.current.result),
    qualificationFreezeSha256: fixture.current.result.freeze.freezeSha256,
    instrumentCertificationSha256: fixture.current.certification.certificationSha256,
    corpusBundleSha256: fixture.current.certification.corpusBundleSha256,
    qualificationProofSha256: qualificationProof.proofSha256,
    reviewProtocolVersion: "imp24-review-v2",
    executionProfileHash: fixture.qualificationPreflight.executionProfileHash,
    routePolicyVersion: fixture.qualificationPreflight.routePolicyVersion,
    executionRoute: "codex_exec_chatgpt_subscription",
    authMode: "chatgpt",
    apiKeyPresent: false,
    apiFallbackAllowed: false,
    directHttpOrSdkAllowed: false,
    forbiddenProviderEnvKeysPresent: [],
    apiCallsMade: 0,
    maxParallel: 2,
    externalCapabilities: { publish: false, promote: false, deploy: false, upload: false },
  };
  // The exact frozen input hash is read from the phase's retained input-freeze
  // by the caller and patched before this result is persisted.
  const preflight = { ...preflightCore, preflightSha256: hashCanonical(preflightCore) };
  const result: RunForwardLiveCampaignResultV3 = {
    schema: FORWARD_LIVE_CAMPAIGN_RESULT_V3_SCHEMA,
    preflight,
    budgetSha256: budget.budgetSha256,
    campaign,
    codexExecInvocations: entries.length,
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
  writeJson(resolve(liveDir, "validation-manifest.json"), manifest);
  writeJson(resolve(liveDir, "call-budget.json"), budget);
  writeJson(resolve(liveDir, "call-ledger.json"), ledger);
  return result;
}

function bindAndPersistCampaignInputFreeze(
  result: RunForwardLiveCampaignResultV3,
  inputFreezeSha256: string,
  phaseDir: string,
): void {
  result.preflight.inputFreezeSha256 = inputFreezeSha256;
  const { preflightSha256: _old, ...core } = result.preflight;
  result.preflight.preflightSha256 = hashCanonical(core);
  writeJson(resolve(phaseDir, "live-campaign", "live-preflight.json"), result.preflight);
  writeJson(resolve(phaseDir, "live-campaign", "campaign-result.json"), result);
}

function git(repositoryRoot: string, args: string[]): string {
  return execFileSync("git", args, { cwd: repositoryRoot, encoding: "utf8" }).trim();
}

function readinessFixture(
  roots: TestRoots,
  fixture: ActivationQualificationFixture,
): { verified: VerifiedImp24ActivationReadinessV2; repoRoot: string; gatePath: string; ledgerPath: string } {
  const repoRoot = resolve(roots.base, "readiness-repo");
  mkdirSync(repoRoot, { recursive: true });
  git(repoRoot, ["init", "-q"]);
  git(repoRoot, ["checkout", "-q", "-b", "feat/v25-pipeline-live"]);
  git(repoRoot, ["config", "user.email", "activation@example.invalid"]);
  git(repoRoot, ["config", "user.name", "Activation Test"]);
  writeJson(resolve(repoRoot, "marker.json"), { retained: true });
  git(repoRoot, ["add", "marker.json"]);
  git(repoRoot, ["commit", "-q", "-m", "retained readiness fixture"]);
  const headSha = git(repoRoot, ["rev-parse", "HEAD"]);
  const checkout: Imp24CheckoutIdentityV1 = { branch: "feat/v25-pipeline-live", headSha, implementationClean: true };
  const workflowRun: Imp24TrustedWorkflowRunEvidenceV1 = {
    databaseId: 9001,
    workflowName: "ChapterFlow V25 Pipeline",
    headBranch: "feat/v25-pipeline-live",
    headSha,
    status: "completed",
    conclusion: "success",
    jobs: [{ name: "V25 Pipeline Typecheck, Contracts, and Tests", status: "completed", conclusion: "success" }],
  };
  const pullRequest: Imp24TrustedPullRequestEvidenceV1 = {
    number: 401,
    state: "OPEN",
    isDraft: true,
    mergedAt: null,
    mergeCommit: null,
    headRefName: "feat/v25-pipeline-live",
    headRefOid: headSha,
  };
  const gate = buildImp24ImplementationCiGateFromEvidence({
    expectedHeadSha: headSha,
    workflowRunId: 9001,
    checkout,
    workflowRun,
    pullRequest,
    verifiedAt: "2026-07-13T12:03:00.000Z",
  });
  const evidenceDir = resolve(repoRoot, "activation-evidence");
  const gatePath = resolve(evidenceDir, "implementation-ci-gate.json");
  const ledgerPath = resolve(evidenceDir, "full-suite-attempt-ledger.json");
  writeJson(gatePath, gate);
  const summaryLine = "pass 37  fail 0  xfail(known defects) 0  xpass 0  xenv(env-absent) 0  skip 0";
  const processLog: Imp24FullSuiteProcessLogV1 = {
    schema: IMP24_FULL_SUITE_PROCESS_LOG_SCHEMA,
    command: IMP24_FULL_SUITE_COMMAND,
    stdout: `${summaryLine}\n`,
    stderr: "",
    exitCode: 0,
    signal: null,
    spawnError: null,
  };
  const logRelPath = "attempts/full-suite-attempt-001.process-log.json";
  const logPath = resolve(evidenceDir, logRelPath);
  writeJson(logPath, processLog);
  const noLiveCore = { asserted: true, rootRelPath: IMP24_FULL_SUITE_NO_LIVE_ROUTE_ROOT, filesFound: [] as string[] };
  const attemptCore = {
    sequence: 1,
    attemptId: sha256Hex(`fixture\0${headSha}`),
    command: IMP24_FULL_SUITE_COMMAND,
    implementationHeadSha: headSha,
    productionInstrumentSealSha256: fixture.freeze.productionInstrumentSealSha256,
    instrumentCertificationSha256: fixture.current.certification.certificationSha256,
    startedAt: "2026-07-13T12:03:00.000Z",
    completedAt: "2026-07-13T12:04:00.000Z",
    exitCode: 0,
    harnessSummary: {
      pass: 37, fail: 0, xfailKnownDefects: 0, xpass: 0, xenvEnvAbsent: 0, skip: 0,
      summaryLineSha256: sha256Hex(summaryLine),
    },
    noLiveRoute: { ...noLiveCore, evidenceSha256: hashCanonical(noLiveCore) },
    logRelPath,
    logBytesSha256: sha256Hex(readFileSync(logPath)),
    stdoutBytesSha256: sha256Hex(processLog.stdout),
    stderrBytesSha256: sha256Hex(processLog.stderr),
  };
  const attempt = { ...attemptCore, attemptSha256: hashCanonical(attemptCore) };
  const ledgerCore: Omit<Imp24FullSuiteAttemptLedgerV1, "ledgerSha256"> = {
    schema: IMP24_FULL_SUITE_ATTEMPT_LEDGER_SCHEMA,
    implementationHeadSha: headSha,
    productionInstrumentSealSha256: fixture.freeze.productionInstrumentSealSha256,
    instrumentCertificationSha256: fixture.current.certification.certificationSha256,
    command: IMP24_FULL_SUITE_COMMAND,
    attempts: [attempt],
    finalStatus: "PASS",
    modelCalls: 0,
    apiCalls: 0,
  };
  writeJson(ledgerPath, { ...ledgerCore, ledgerSha256: hashCanonical(ledgerCore) });
  const verified = verifyImp24ActivationReadinessV2({
    repositoryRoot: repoRoot,
    expectedHeadSha: headSha,
    implementationCiGatePath: gatePath,
    fullSuiteLedgerPath: ledgerPath,
    expectedProductionInstrumentSealSha256: fixture.freeze.productionInstrumentSealSha256,
    expectedInstrumentCertificationSha256: fixture.current.certification.certificationSha256,
  });
  return { verified, repoRoot, gatePath, ledgerPath };
}

type FullActivationFixture = {
  roots: TestRoots;
  qualification: ActivationQualificationFixture;
  pilot: VerifiedForwardRetainedCampaignEvidenceV3;
  gold: VerifiedForwardRetainedCampaignEvidenceV3;
  readiness: ReturnType<typeof readinessFixture>;
  pilotPhaseDir: string;
  goldPhaseDir: string;
  pilotInputFreezePath: string;
  goldInputFreezePath: string;
};

let fullFixturePromise: Promise<FullActivationFixture> | null = null;

async function fullFixture(): Promise<FullActivationFixture> {
  if (fullFixturePromise) return fullFixturePromise;
  fullFixturePromise = (async () => {
    const roots = mkTestRoots("imp24-retained-activation");
    process.once("exit", roots.dispose);
    const qualification = await qualificationFixture();
    const inputs = materializeImp24ForwardInputs(resolve(roots.stateRoot, "forward-inputs"));
    const common = {
      currentQualification: qualification.current,
      roleFreeze: qualification.freeze,
      inputFreeze: inputs.freeze,
      inputMaterialization: inputs.materialization,
    };
    const pilotManifest = buildPilotArtifactsV2Envelope(common);
    const pilotPhaseDir = inputs.pilotRoot;
    const pilotResult = retainedCampaign({ phaseDir: pilotPhaseDir, manifest: pilotManifest, fixture: qualification });
    bindAndPersistCampaignInputFreeze(pilotResult, inputs.freeze.freezeSha256, pilotPhaseDir);
    const pilotInputFreezePath = resolve(inputs.pilotRoot, "input-freeze.json");
    const pilot = verifyForwardRetainedCampaignEvidenceV3({
      kind: "pilot", phaseDir: pilotPhaseDir, inputFreezePath: pilotInputFreezePath, roleAssignmentFreeze: qualification.freeze,
    });
    const goldArtifacts = buildGoldArtifactsV2Envelope({ ...common, pilotManifest, pilotResult: pilotResult.campaign });
    const goldPhaseDir = inputs.goldRoot;
    const goldResult = retainedCampaign({ phaseDir: goldPhaseDir, manifest: goldArtifacts.goldManifest, fixture: qualification });
    bindAndPersistCampaignInputFreeze(goldResult, inputs.freeze.freezeSha256, goldPhaseDir);
    const goldInputFreezePath = resolve(inputs.goldRoot, "input-freeze.json");
    const gold = verifyForwardRetainedCampaignEvidenceV3({
      kind: "gold", phaseDir: goldPhaseDir, inputFreezePath: goldInputFreezePath, roleAssignmentFreeze: qualification.freeze,
    });
    return {
      roots, qualification, pilot, gold, readiness: readinessFixture(roots, qualification),
      pilotPhaseDir, goldPhaseDir, pilotInputFreezePath, goldInputFreezePath,
    };
  })();
  return fullFixturePromise;
}

async function activationInput(): Promise<BuildForwardLocalActivationArtifactsInputV2> {
  const fixture = await fullFixture();
  return {
    activationId: "imp24-forward-local-active-v3",
    activatedAt: "2026-07-13T12:05:00.000Z",
    currentQualification: fixture.qualification.current,
    roleAssignmentFreeze: fixture.qualification.freeze,
    qualificationPreflight: fixture.qualification.qualificationPreflight,
    retainedQualificationEvidence: fixture.qualification.retainedQualificationEvidence,
    pilotEvidence: fixture.pilot,
    goldEvidence: fixture.gold,
    readiness: fixture.readiness.verified,
  };
}

function copyQualificationExperiment(
  fixture: ActivationQualificationFixture,
  label: string,
): { experimentDir: string; dispose: () => void } {
  const roots = mkTestRoots(label);
  const experimentDir = resolve(roots.base, "qualification-experiment");
  cpSync(fixture.qualificationExperimentDir, experimentDir, { recursive: true });
  return { experimentDir, dispose: roots.dispose };
}

function verifyQualificationCopy(
  fixture: ActivationQualificationFixture,
  experimentDir: string,
  roleAssignmentFreeze: ForwardRoleAssignmentFreezeV3 = fixture.freeze,
): VerifiedForwardRetainedRoleQualificationEvidenceV3 {
  return verifyForwardRetainedRoleQualificationEvidenceV3({
    repositoryRoot: REPOSITORY_ROOT,
    experimentDir,
    input: fixture.input,
    evaluateOutput: fixture.evaluateOutput,
    roleAssignmentFreeze,
  });
}

test("retained qualification verifier rejects a missing ledger and a missing retained attempt", async () => {
  const fixture = await qualificationFixture();
  const missingLedger = copyQualificationExperiment(fixture, "imp24-v3-qualification-missing-ledger");
  try {
    rmSync(resolve(missingLedger.experimentDir, "live", "call-ledger.json"));
    assert.throws(() => verifyQualificationCopy(fixture, missingLedger.experimentDir),
      /qualification call ledger is not retained/);
  } finally {
    missingLedger.dispose();
  }

  const missingAttempt = copyQualificationExperiment(fixture, "imp24-v3-qualification-missing-attempt");
  try {
    const attemptId = fixture.current.result.attempts[0].request.attemptId;
    rmSync(resolve(missingAttempt.experimentDir, "live", "attempts", attemptId), {
      recursive: true,
      force: true,
    });
    assert.throws(() => verifyQualificationCopy(fixture, missingAttempt.experimentDir),
      /retained attempt has missing or extra evidence files/);
  } finally {
    missingAttempt.dispose();
  }
});

test("retained qualification verifier rejects self-rehashed raw-output drift", async () => {
  const fixture = await qualificationFixture();
  const copy = copyQualificationExperiment(fixture, "imp24-v3-qualification-raw-output-drift");
  try {
    const attempt = fixture.current.result.attempts[0];
    const attemptDir = resolve(copy.experimentDir, "live", "attempts", attempt.request.attemptId);
    const receiptPath = resolve(attemptDir, "receipt.json");
    const retentionPath = resolve(attemptDir, "retention.json");
    const receipt = readJson<QualificationExecutionReceiptV3>(receiptPath);
    receipt.rawOutput = `${receipt.rawOutput ?? ""}\nself-rehashed drift`;
    const { receiptSha256: _oldReceiptSha256, ...receiptCore } = receipt;
    receipt.receiptSha256 = qualificationReceiptSha256(receiptCore);
    const retention = readJson<LiveAttemptRetentionV3>(retentionPath);
    retention.receiptSha256 = receipt.receiptSha256;
    retention.receipt = receipt;
    const { retentionSha256: _oldRetentionSha256, ...retentionCore } = retention;
    retention.retentionSha256 = hashCanonical(retentionCore);
    writePrettyJson(receiptPath, receipt);
    writePrettyJson(retentionPath, retention);
    assert.throws(() => verifyQualificationCopy(fixture, copy.experimentDir),
      /qualification result receipt differs from retained receipt bytes/);
  } finally {
    copy.dispose();
  }
});

test("retained qualification verifier rejects frozen-schedule omission and duplication", async () => {
  const fixture = await qualificationFixture();
  for (const mutation of ["omission", "duplication"] as const) {
    const copy = copyQualificationExperiment(fixture, `imp24-v3-qualification-schedule-${mutation}`);
    try {
      const resultPath = resolve(copy.experimentDir, "live", "qualification-result.json");
      const result = readJson<RoleQualificationRunnerResultV3>(resultPath);
      const schedule = result.schedule as Array<(typeof result.schedule)[number]>;
      if (mutation === "omission") schedule.splice(0, 1);
      else schedule.push(clone(schedule[0]));
      writeJson(resultPath, result);
      assert.throws(() => verifyQualificationCopy(fixture, copy.experimentDir), /frozen schedule or inputs/);
    } finally {
      copy.dispose();
    }
  }
});

test("retained qualification verifier excludes canaries from holdout metric denominators", async () => {
  const fixture = await qualificationFixture();
  const copy = copyQualificationExperiment(fixture, "imp24-v3-qualification-canary-metric-injection");
  try {
    const resultPath = resolve(copy.experimentDir, "live", "qualification-result.json");
    const roleFreezePath = resolve(copy.experimentDir, "role-assignment-freeze.json");
    const reportPath = resolve(copy.experimentDir, "qualification-report.json");
    const result = readJson<RoleQualificationRunnerResultV3>(resultPath);
    const qualified = result.profileRoleResults.find((profile) => profile.status === "QUALIFIED" && profile.metrics !== null);
    assert.ok(qualified?.metrics);
    qualified.metrics.denominators.schemaValidity += qualified.canaryCaseCount;
    qualified.metrics.numerators.schemaValidity += qualified.canaryCaseCount;
    writeJson(resultPath, result);

    const roleFreeze = readJson<ForwardRoleAssignmentFreezeV3>(roleFreezePath);
    roleFreeze.qualificationResultSha256 = hashCanonical(result);
    const { freezeSha256: _oldFreezeSha256, ...roleFreezeCore } = roleFreeze;
    roleFreeze.freezeSha256 = hashCanonical(roleFreezeCore);
    writeJson(roleFreezePath, roleFreeze);

    const report = readJson<Imp24RoleQualificationCampaignReportV1>(reportPath);
    report.qualificationResultSha256 = hashCanonical(result);
    report.roleAssignmentFreezeSha256 = roleFreeze.freezeSha256;
    report.artifactBytesSha256.qualificationResult = sha256Hex(readFileSync(resultPath));
    report.artifactBytesSha256.roleAssignmentFreeze = sha256Hex(readFileSync(roleFreezePath));
    const { reportSha256: _oldReportSha256, ...reportCore } = report;
    report.reportSha256 = hashCanonical(reportCore);
    writeJson(reportPath, report);

    assert.throws(() => verifyQualificationCopy(fixture, copy.experimentDir, roleFreeze),
      /deterministic projection of exact canary\/holdout receipts/);
  } finally {
    copy.dispose();
  }
});

test("retained qualification verifier binds exact campaign-report counters and CI-gated HEAD evidence", async () => {
  const fixture = await qualificationFixture();
  const reportPath = resolve(fixture.qualificationExperimentDir, "qualification-report.json");
  const gatePath = resolve(fixture.qualificationExperimentDir, "implementation-ci-gate.json");
  const originalReportBytes = readFileSync(reportPath, "utf8");
  const originalGateBytes = readFileSync(gatePath, "utf8");
  try {
    const report = readJson<Imp24RoleQualificationCampaignReportV1>(reportPath);
    report.callCounts.totalAttempts += 1;
    const { reportSha256: _oldReportSha256, ...reportCore } = report;
    report.reportSha256 = hashCanonical(reportCore);
    writeJson(reportPath, report);
    assert.throws(() => verifyQualificationCopy(fixture, fixture.qualificationExperimentDir),
      /campaign report call counts are not derived/);
  } finally {
    writeFileSync(reportPath, originalReportBytes);
  }

  try {
    const gate = readJson<Imp24ImplementationCiGateV1>(gatePath);
    gate.workflow.headSha = gate.headSha === "a".repeat(40) ? "b".repeat(40) : "a".repeat(40);
    const { gateSha256: _oldGateSha256, ...gateCore } = gate;
    gate.gateSha256 = imp24ImplementationCiGateSha256(gateCore);
    writeJson(gatePath, gate);
    assert.throws(() => verifyQualificationCopy(fixture, fixture.qualificationExperimentDir),
      /dedicated V25 implementation workflow did not PASS for the exact gated HEAD/);
  } finally {
    writeFileSync(gatePath, originalGateBytes);
  }
});

function rebaseRetainedCampaignPhase(originalPhase: string, copiedPhase: string): void {
  const resultPath = resolve(copiedPhase, "live-campaign", "campaign-result.json");
  const result = readJson<RunForwardLiveCampaignResultV3>(resultPath);
  for (const attempt of result.campaign.attempts) {
    const attemptDir = attempt.attemptDir;
    if (typeof attemptDir !== "string") throw new Error("fixture attemptDir is missing");
    assert.ok(attemptDir.startsWith(`${originalPhase}/`));
    attempt.attemptDir = resolve(copiedPhase, attemptDir.slice(originalPhase.length + 1));
  }
  for (const final of Object.values(result.campaign.finalByChapter)) {
    const attemptDir = final.attemptDir;
    if (typeof attemptDir !== "string") throw new Error("fixture final attemptDir is missing");
    assert.ok(attemptDir.startsWith(`${originalPhase}/`));
    final.attemptDir = resolve(copiedPhase, attemptDir.slice(originalPhase.length + 1));
  }
  for (const receipt of result.campaign.persistenceReceipts.filter((candidate) => candidate.kind === "attempt")) {
    const path = resolve(copiedPhase, receipt.storageId);
    const retained = readJson<ForwardValidationAttemptRecordV1>(path);
    const attemptDir = retained.attemptDir;
    if (typeof attemptDir !== "string") throw new Error("fixture retained attemptDir is missing");
    assert.ok(attemptDir.startsWith(`${originalPhase}/`));
    retained.attemptDir = resolve(copiedPhase, attemptDir.slice(originalPhase.length + 1));
    writeJson(path, retained);
    receipt.contentSha256 = hashCanonical(retained);
  }
  writeJson(resultPath, result);
}

test("IMP-24 activates only from retained V3 pilot/gold and verified CI/full-suite evidence", async () => {
  const result = buildForwardLocalActivationArtifactsV2(await activationInput());
  const policy = result.artifactsByPath[FORWARD_LOCAL_ACTIVATION_POLICY_REL_PATH];
  assert.equal(policy.status, "ACTIVE");
  assert.deepEqual(policy.activatedProfile.writer, { model: "gpt-5.6-sol", effort: "high" });
  assert.deepEqual(policy.activatedProfile.highRiskWriter, { model: "gpt-5.6-sol", effort: "xhigh" });
  assert.equal(policy.previousProfile.profileId, "baseline-55");
  assert.equal(result.readinessProof.schema, IMP24_ACTIVATION_READINESS_PROOF_SCHEMA);
  assert.equal(result.qualificationEvidenceProof.implementationCiGateSha256,
    (await qualificationFixture()).retainedQualificationEvidence.proof.implementationCiGateSha256);
  assert.equal(result.qualificationEvidenceProof.qualificationReportSha256,
    (await qualificationFixture()).retainedQualificationEvidence.proof.qualificationReportSha256);
  assert.equal(result.pilotEvidenceProof.attemptCount, 8);
  assert.equal(result.goldEvidenceProof.attemptCount, 13);
  assert.deepEqual(result.externalCapabilities, { publish: false, promote: false, deploy: false, upload: false, api: false });
  assert.equal(result.modelCalls, 0);
  assert.equal(result.apiCalls, 0);
  assert.equal(result.networkCalls, 0);
});

test("normal loader accepts V3 activation and explicit rollback restores baseline-55", async () => {
  const result = buildForwardLocalActivationArtifactsV2(await activationInput());
  const stateDir = "/virtual-forward-local";
  const values = new Map(Object.entries(result.artifactsByPath).map(([relPath, value]) => [
    resolve(stateDir, relPath), `${JSON.stringify(value)}\n`,
  ]));
  const control = resolveStandardForwardAutopilotControl({
    stateDir,
    readText: (path) => values.get(path) ?? null,
    verifyCurrentInstrumentBinding: (binding) => (binding as InstrumentCertificationBindingV3).certificationSha256,
  });
  assert.equal(control.runtime.mode, "FORWARD_ACTIVE");
  const policyPath = resolve(stateDir, FORWARD_LOCAL_ACTIVATION_POLICY_REL_PATH);
  if (control.runtime.mode !== "FORWARD_ACTIVE") throw new Error("expected ACTIVE fixture");
  const store = new Map([[policyPath, serializeForwardActivationPolicy(control.runtime.policy)]]);
  const rolledBack = rollbackForwardPolicy(policyPath, {
    rollbackId: "imp24-rollback-test",
    rolledBackAt: "2026-07-13T12:06:00.000Z",
    trigger: "operator_requested",
    reason: "focused rollback verification",
  }, {
    readText: (path) => store.get(path) ?? null,
    writeTextAtomic: (path, text) => { store.set(path, text); },
  });
  assert.equal(rolledBack.status, "ROLLED_BACK");
  assert.equal(rolledBack.selectedProfile.profileId, "baseline-55");
});

test("synthetic empty-attempt campaign summaries are rejected at the activation boundary", async () => {
  const input = await activationInput();
  const synthetic = clone(input.pilotEvidence) as unknown as VerifiedForwardRetainedCampaignEvidenceV3;
  (synthetic.result.campaign.attempts as ForwardValidationAttemptRecordV1[]) = [];
  (synthetic.result.campaign.persistenceReceipts as ForwardPersistenceReceiptV1[]) = [];
  assert.throws(() => buildForwardLocalActivationArtifactsV2({ ...input, pilotEvidence: synthetic }),
    /not produced by the retained campaign verifier/);
});

test("retained verifier rejects a self-hashed campaign whose attempts and persistence were erased", async () => {
  const fixture = await fullFixture();
  const tamperedPhase = resolve(fixture.roots.base, "tampered-empty-attempts");
  cpSync(fixture.pilotPhaseDir, tamperedPhase, { recursive: true });
  const resultPath = resolve(tamperedPhase, "live-campaign", "campaign-result.json");
  const result = readJson<RunForwardLiveCampaignResultV3>(resultPath);
  result.campaign.attempts = [];
  result.campaign.persistenceReceipts = [];
  writeJson(resultPath, result);
  assert.throws(() => verifyForwardRetainedCampaignEvidenceV3({
    kind: "pilot",
    phaseDir: tamperedPhase,
    inputFreezePath: resolve(tamperedPhase, "input-freeze.json"),
    roleAssignmentFreeze: fixture.qualification.freeze,
  }), /fewer attempts|no retained persistence receipts/);
});

test("retained verifier accepts one reviewer timeout followed by the single authorized completed replay", async () => {
  const fixture = await fullFixture();
  const replayPhase = resolve(fixture.roots.base, "retained-reviewer-replay");
  cpSync(fixture.pilotPhaseDir, replayPhase, { recursive: true });
  rebaseRetainedCampaignPhase(fixture.pilotPhaseDir, replayPhase);
  const liveDir = resolve(replayPhase, "live-campaign");
  const ledgerPath = resolve(liveDir, "call-ledger.json");
  const resultPath = resolve(liveDir, "campaign-result.json");
  const ledger = readJson<ForwardLiveCallLedgerV1>(ledgerPath);
  const result = readJson<RunForwardLiveCampaignResultV3>(resultPath);
  const entryIndex = ledger.entries.findIndex((entry) => entry.category === "pilot-reader-primary");
  assert.ok(entryIndex >= 0);
  const completed = ledger.entries[entryIndex];
  const operationRoot = resolve(liveDir, "model-calls", sha256Hex(completed.logicalOperationId));
  const attempt1Dir = resolve(operationRoot, "attempt-1");
  const attempt2Dir = resolve(operationRoot, "attempt-2");
  cpSync(attempt1Dir, attempt2Dir, { recursive: true });
  const completedReceipt = readJson<Record<string, unknown>>(resolve(attempt2Dir, "receipt.json"));
  const timeoutReceipt = {
    schema: FORWARD_LIVE_CALL_RECEIPT_SCHEMA,
    status: "timeout" as const,
    executionId: null,
    result: null,
    failureMessage: "retained fixture timeout before provider result",
  };
  writeJson(resolve(attempt1Dir, "receipt.json"), timeoutReceipt);
  const failedEntry: ForwardLiveCallEntryV1 = {
    ...completed,
    receiptSha256: hashCanonical(timeoutReceipt),
    status: "timeout",
    executionId: null,
  };
  const replayEntry: ForwardLiveCallEntryV1 = {
    ...completed,
    attemptNumber: 2,
    attemptId: sha256Hex(`${completed.logicalOperationId}\0${2}\0${completed.requestSha256}`),
    receiptSha256: hashCanonical(completedReceipt),
  };
  ledger.entries.splice(entryIndex, 1, failedEntry, replayEntry);
  ledger.codexExecInvocations += 1;
  ledger.infrastructureReplays = 1;
  result.codexExecInvocations += 1;
  result.infrastructureReplays = 1;
  writeJson(ledgerPath, ledger);
  writeJson(resultPath, result);
  const verified = verifyForwardRetainedCampaignEvidenceV3({
    kind: "pilot",
    phaseDir: replayPhase,
    inputFreezePath: resolve(replayPhase, "input-freeze.json"),
    roleAssignmentFreeze: fixture.qualification.freeze,
  });
  assert.equal(verified.proof.infrastructureReplays, 1);
});

test("retained verifier rejects a self-rehashed call budget whose partition counts differ from materialized source plans", async () => {
  const fixture = await fullFixture();
  const tamperedPhase = resolve(fixture.roots.base, "tampered-partition-budget");
  cpSync(fixture.pilotPhaseDir, tamperedPhase, { recursive: true });
  rebaseRetainedCampaignPhase(fixture.pilotPhaseDir, tamperedPhase);
  const liveDir = resolve(tamperedPhase, "live-campaign");
  const manifest = readJson<FrozenForwardValidationManifestV1>(resolve(liveDir, "validation-manifest.json"));
  const original = readJson<ForwardLivePhaseBudgetV1>(resolve(liveDir, "call-budget.json"));
  const changedCounts = { ...original.sourcePartitionCountByChapter };
  const firstKey = Object.keys(changedCounts).sort()[0];
  changedCounts[firstKey] += 1;
  const changed = buildForwardLivePhaseBudget({
    manifest,
    panelPolicy: fixture.qualification.freeze.panelPolicy,
    sourcePartitionCountByChapter: changedCounts,
  });
  const ledger = readJson<ForwardLiveCallLedgerV1>(resolve(liveDir, "call-ledger.json"));
  const result = readJson<RunForwardLiveCampaignResultV3>(resolve(liveDir, "campaign-result.json"));
  ledger.budgetSha256 = changed.budgetSha256;
  result.budgetSha256 = changed.budgetSha256;
  writeJson(resolve(liveDir, "call-budget.json"), changed);
  writeJson(resolve(liveDir, "call-ledger.json"), ledger);
  writeJson(resolve(liveDir, "campaign-result.json"), result);
  assert.throws(() => verifyForwardRetainedCampaignEvidenceV3({
    kind: "pilot",
    phaseDir: tamperedPhase,
    inputFreezePath: resolve(tamperedPhase, "input-freeze.json"),
    roleAssignmentFreeze: fixture.qualification.freeze,
  }), /materialized source plans/);
});

test("retained gold verifier rejects a self-rehashed sweep result that differs from the persisted campaign projection", async () => {
  const fixture = await fullFixture();
  const tamperedPhase = resolve(fixture.roots.base, "tampered-gold-sweep-output");
  cpSync(fixture.goldPhaseDir, tamperedPhase, { recursive: true });
  rebaseRetainedCampaignPhase(fixture.goldPhaseDir, tamperedPhase);
  const liveDir = resolve(tamperedPhase, "live-campaign");
  const ledgerPath = resolve(liveDir, "call-ledger.json");
  const ledger = readJson<ForwardLiveCallLedgerV1>(ledgerPath);
  const entry = ledger.entries.find((candidate) => candidate.category === "gold-book-evaluator"
    && candidate.logicalOperationId.includes("independent-book-sweep"));
  assert.ok(entry);
  const receiptPath = resolve(liveDir, "model-calls", sha256Hex(entry.logicalOperationId),
    `attempt-${entry.attemptNumber}`, "receipt.json");
  const receipt = readJson<{
    schema: typeof FORWARD_LIVE_MODEL_OPERATION_RECEIPT_SCHEMA;
    status: "completed";
    executionId: string;
    result: { actorId: string; executionId: string; output: { sweep: SweepRecord }; outputSha256: string };
    failureMessage: null;
  }>(receiptPath);
  receipt.result.output.sweep.reviewer = "self-rehashed-but-not-campaign-sweep";
  receipt.result.outputSha256 = hashCanonical(receipt.result.output);
  writeJson(receiptPath, receipt);
  entry.receiptSha256 = hashCanonical({
    schema: FORWARD_LIVE_CALL_RECEIPT_SCHEMA,
    status: receipt.status,
    executionId: receipt.executionId,
    result: null,
    resultSha256: hashCanonical(receipt.result),
    failureMessage: receipt.failureMessage,
  });
  writeJson(ledgerPath, ledger);
  assert.throws(() => verifyForwardRetainedCampaignEvidenceV3({
    kind: "gold",
    phaseDir: tamperedPhase,
    inputFreezePath: resolve(tamperedPhase, "input-freeze.json"),
    roleAssignmentFreeze: fixture.qualification.freeze,
  }), /deterministic projections|exact retained sweep output projection/);
});

test("retained gold verifier rejects a comprehensively self-rehashed fixed-call request substitution", async () => {
  const fixture = await fullFixture();
  const tamperedPhase = resolve(fixture.roots.base, "tampered-gold-fixed-call-request");
  cpSync(fixture.goldPhaseDir, tamperedPhase, { recursive: true });
  rebaseRetainedCampaignPhase(fixture.goldPhaseDir, tamperedPhase);
  const liveDir = resolve(tamperedPhase, "live-campaign");
  const ledgerPath = resolve(liveDir, "call-ledger.json");
  const ledger = readJson<ForwardLiveCallLedgerV1>(ledgerPath);
  const entry = ledger.entries.find((candidate) => candidate.category === "gold-book-evaluator"
    && candidate.logicalOperationId.endsWith("/blind-rater-primary"));
  assert.ok(entry);
  const requestPath = resolve(liveDir, "model-calls", sha256Hex(entry.logicalOperationId),
    `attempt-${entry.attemptNumber}`, "request.json");
  const retained = readJson<{
    requestSha256: string;
    requestProjectionSha256: string;
    request: Record<string, unknown>;
  }>(requestPath);
  const artifacts = retained.request.artifacts as Array<{ relativePath: string; bytesSha256: string }>;
  const substitutedSchema = artifacts.find((artifact) => artifact.relativePath === "evaluation-scope.json");
  assert.ok(substitutedSchema);
  retained.request.model = "gpt-5.6-substituted";
  retained.request.effort = "high";
  retained.request.outputSchemaSha256 = substitutedSchema.bytesSha256;
  retained.request.taskSha256 = sha256Hex("self-rehashed substituted gold evaluator task");
  retained.requestProjectionSha256 = hashCanonical(retained.request);
  retained.requestSha256 = hashCanonical(retained.request);
  entry.requestSha256 = retained.requestSha256;
  entry.attemptId = sha256Hex(`${entry.logicalOperationId}\0${entry.attemptNumber}\0${entry.requestSha256}`);
  writeJson(requestPath, retained);
  writeJson(ledgerPath, ledger);
  assert.throws(() => verifyForwardRetainedCampaignEvidenceV3({
    kind: "gold",
    phaseDir: tamperedPhase,
    inputFreezePath: resolve(tamperedPhase, "input-freeze.json"),
    roleAssignmentFreeze: fixture.qualification.freeze,
  }), /exact built-in fixed call\/task\/route binding/);
});

test("self-hashed synthetic full-suite PASS is rejected when retained harness output says fail", async () => {
  const fixture = await fullFixture();
  const evidenceDir = resolve(fixture.readiness.repoRoot, "synthetic-readiness");
  cpSync(dirname(fixture.readiness.ledgerPath), evidenceDir, { recursive: true });
  const ledgerPath = resolve(evidenceDir, "full-suite-attempt-ledger.json");
  const ledger = readJson<Imp24FullSuiteAttemptLedgerV1>(ledgerPath);
  const attempt = ledger.attempts[0];
  const logPath = resolve(evidenceDir, attempt.logRelPath);
  const log = readJson<Imp24FullSuiteProcessLogV1>(logPath);
  const summaryLine = "pass 36  fail 1  xfail(known defects) 0  xpass 0  xenv(env-absent) 0  skip 0";
  log.stdout = `${summaryLine}\n`;
  writeJson(logPath, log);
  attempt.harnessSummary = {
    pass: 36, fail: 1, xfailKnownDefects: 0, xpass: 0, xenvEnvAbsent: 0, skip: 0,
    summaryLineSha256: sha256Hex(summaryLine),
  };
  attempt.logBytesSha256 = sha256Hex(readFileSync(logPath));
  attempt.stdoutBytesSha256 = sha256Hex(log.stdout);
  const { attemptSha256: _attemptHash, ...attemptCore } = attempt;
  attempt.attemptSha256 = hashCanonical(attemptCore);
  ledger.finalStatus = "PASS";
  const { ledgerSha256: _ledgerHash, ...ledgerCore } = ledger;
  ledger.ledgerSha256 = hashCanonical(ledgerCore);
  writeJson(ledgerPath, ledger);
  assert.throws(() => verifyImp24ActivationReadinessV2({
    repositoryRoot: fixture.readiness.repoRoot,
    expectedHeadSha: fixture.readiness.verified.proof.implementationHeadSha,
    implementationCiGatePath: fixture.readiness.gatePath,
    fullSuiteLedgerPath: ledgerPath,
    expectedProductionInstrumentSealSha256: fixture.qualification.freeze.productionInstrumentSealSha256,
    expectedInstrumentCertificationSha256: fixture.qualification.current.certification.certificationSha256,
  }), /final status is not derived|did not PASS/);
});

test("legacy V2 activation commands are closed and the V3 suite recorder has a literal dry barrier", async () => {
  assert.equal(await runMigrationBakeoffCli(["forward-activate-local"], {
    "activate-local": true,
    "local-tests-pass": true,
    "activated-at": "2026-07-13T12:00:00.000Z",
    "head-sha": "a".repeat(40),
    "dedicated-ci-url": "https://github.com/example/example/actions/runs/1",
  }), 2);
  assert.equal(await runMigrationBakeoffCli(["forward-verify-local-activation"], {}), 2);
  const dry = recordImp24ActivationFullSuiteV3(false, "");
  assert.equal(dry.code, 2);
  assert.equal(dry.executed, false);
  assert.equal(dry.modelCalls, 0);
  assert.equal(dry.apiCalls, 0);
  assert.doesNotMatch(recordImp24ActivationFullSuiteV3.toString(), /loadImp24ActivationQualificationInputsV3/);
  assert.match(recordImp24ActivationFullSuiteV3.toString(), /loadImp24PreLiveActivationCertificationV1/);
  assert.doesNotMatch(loadImp24PreLiveActivationCertificationV1.toString(), /qualificationRoot|roleFreeze|campaign|candidateAvailability/);
});
