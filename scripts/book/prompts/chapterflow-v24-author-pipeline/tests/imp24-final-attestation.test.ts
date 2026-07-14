import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { hashCanonical, sha256Hex } from "../src/contracts/contractUtil.js";
import { writeFileAtomic } from "../src/lib/atomicWrite.js";
import { canonicalPretty } from "../src/bakeoff/migration/corpusBuilderCore.js";
import {
  IMP24C_FINAL_ATTESTATION_PATHS,
  buildImp24CFinalAttestation,
  buildImp24CFinalAttestationForFixture,
  materializeImp24CFinalAttestationForFixture,
  verifyImp24CFinalAttestationForFixture,
  verifyRetainedImp24CFinalAttestationForFixture,
} from "../src/bakeoff/migration/imp24FinalAttestation.js";
import { IMP24C_PRE_LIVE_ARTIFACT_PATHS } from "../src/bakeoff/migration/imp24PreLiveFreeze.js";
import { buildFixedForwardRoleFreezePolicies } from "../src/orchestrator/forwardLiveArtifactMaterializer.js";
import { buildForwardPanelReviewPolicy } from "../src/orchestrator/forwardReviewPolicy.js";
import {
  IMP24_REQUIRED_REPOSITORY_URL,
  buildImp24ImplementationCiGateFromEvidence,
} from "../src/orchestrator/forwardRoleQualificationCampaignV3.js";
import { test } from "./harness.js";
import { diffRootManifests, walkRootManifest } from "./productionLeakGuard.js";
import { mkTestRoots } from "./testRoots.js";

const PIPELINE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPOSITORY_ROOT = resolve(PIPELINE_ROOT, "../../../..");

function runGit(root: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function commitAll(root: string, message: string): string {
  runGit(root, ["add", "--all"]);
  runGit(root, ["commit", "-m", message]);
  return runGit(root, ["rev-parse", "HEAD"]);
}

function initializeLifecycleRepository(root: string): {
  baselineCommit: string;
  implementationCommit: string;
} {
  runGit(root, ["init"]);
  runGit(root, ["config", "user.name", "IMP-24C Fixture"]);
  runGit(root, ["config", "user.email", "imp24c-fixture@example.invalid"]);
  writeFileAtomic(resolve(root, "fixture-baseline.txt"), "baseline\n");
  const baselineCommit = commitAll(root, "fixture baseline");
  writeFileAtomic(resolve(root, "fixture-implementation.txt"), "implementation\n");
  const implementationCommit = commitAll(root, "fixture implementation");
  return { baselineCommit, implementationCommit };
}

function writeJson(root: string, relativePath: string, value: unknown): void {
  writeFileAtomic(resolve(root, relativePath), canonicalPretty(value));
}

function prepareInputs(root: string, implementationCommit: string, ready = true): {
  terminalResultPath: string;
  roleAssignmentPath?: string;
  ciEvidencePath: string;
  preliminaryReportPath: string;
  closurePath: string;
} {
  const terminalResultPath = "fixtures/qualification-result.json";
  const ciEvidencePath = "fixtures/implementation-ci-gate.json";
  const preliminaryReportPath = IMP24C_PRE_LIVE_ARTIFACT_PATHS.implementationReport;
  const closurePath = "docs/v25/reports/IMP-24B_ZERO_CALL_LIFECYCLE_CLOSURE.json";
  const qualificationFreezeSha256 = "1".repeat(64);
  const qualificationResultSha256 = "2".repeat(64);
  const roleRegistrySha256 = "3".repeat(64);
  const callLedgerSha256 = "4".repeat(64);
  const callLedgerBytesSha256 = "5".repeat(64);
  const productionSealSha256 = "d".repeat(64);
  const productionQualificationParitySha256 = "e".repeat(64);
  const selected = ready ? {
    readerPrimary: "gpt-5.6-sol@high",
    readerAudit: "gpt-5.5@high",
    sourcePrimary: "gpt-5.6-sol@xhigh",
    sourceAdjudicator: "gpt-5.5@xhigh",
    quizSemanticAdjudicator: "gpt-5.6-sol@xhigh",
  } : {
    readerPrimary: "gpt-5.6-sol@high",
    readerAudit: null,
    sourcePrimary: null,
    sourceAdjudicator: null,
    quizSemanticAdjudicator: null,
  };
  const ciGate = buildImp24ImplementationCiGateFromEvidence({
    expectedHeadSha: implementationCommit,
    workflowRunId: 29267830570,
    checkout: {
      branch: "feat/v25-pipeline-live",
      headSha: implementationCommit,
      implementationClean: true,
    },
    repository: {
      nameWithOwner: "WillSoltani/ChapterFlow",
      url: IMP24_REQUIRED_REPOSITORY_URL,
    },
    workflowRun: {
      databaseId: 29267830570,
      displayName: "ChapterFlow V25 Pipeline",
      workflowFile: ".github/workflows/chapterflow-v25-pipeline.yml",
      headBranch: "feat/v25-pipeline-live",
      headSha: implementationCommit,
      status: "completed",
      conclusion: "success",
      jobs: [{
        name: "V25 Pipeline Typecheck, Contracts, and Tests",
        status: "completed",
        conclusion: "success",
      }],
    },
    pullRequest: {
      number: 401,
      state: "OPEN",
      isDraft: true,
      mergedAt: null,
      mergeCommit: null,
      headRefName: "feat/v25-pipeline-live",
      headRefOid: implementationCommit,
    },
    verifiedAt: "2026-07-13T00:00:00.000Z",
  });
  writeJson(root, ciEvidencePath, ciGate);
  const certificationCore = {
    schema: "imp24-instrument-certification-binding-v1",
    status: "CERTIFIED_MODEL_FREE",
    sourceMissingEvidenceInconclusiveCertified: true,
    experimentId: "s16-forward-role-qualification-v3-envelope",
    corpusCertificationSha256: "0".repeat(64),
    corpusBundleSha256: `sha256:${"1".repeat(64)}`,
    productionInstrumentSealSha256: productionSealSha256,
    envelopeContractSha256: "2".repeat(64),
    envelopeCompilerSha256: "3".repeat(64),
    modelOutputContractsSha256: "4".repeat(64),
    productionQualificationParitySha256,
    scorerSha256: "5".repeat(64),
    promptBundleSha256: "6".repeat(64),
    schemaBundleSha256: "7".repeat(64),
    thresholdsSha256: "8".repeat(64),
    legacyEvidenceClosureSha256: "9".repeat(64),
    independentAuditPasses: 2,
    modelCalls: 0,
    apiCalls: 0,
  };
  const certification = {
    ...certificationCore,
    certificationSha256: hashCanonical(certificationCore),
  };
  writeJson(root, preliminaryReportPath, {
    schema: "worker-implementation-report-v1",
    status: "PRE_LIVE_FREEZE",
    promptId: "IMP-24",
    continuationPromptId: "IMP-24C",
    baselineHash: "0ba1b168e350fa5d6c05480a28c7c944411f54ee",
    resultHash: "b".repeat(64),
    contractVersions: { "review-evidence-envelope": 1, "review-model-output-v2": 2 },
    filesChanged: [],
    requirementsImplemented: [],
    testsRequired: ["focused lifecycle tests"],
    testsRun: ["focused lifecycle tests: PASS"],
    testResults: { pass: 1, fail: 0, xfail: 0, xpass: 0, skip: 0, xenv: 0, commands: [] },
    gateChanges: [],
    bookSpecificExceptions: [],
    unexpectedWrites: [],
    unresolvedRisks: [],
    dependencyAssumptions: [],
    implementationCommit: null,
    evidenceCommit: null,
    certificationSha256: certification.certificationSha256,
    productionSealSha256,
    productionQualificationParitySha256,
    canaryCorpusHashes: { reader: "f".repeat(64), source: "0".repeat(64), quiz: "1".repeat(64) },
    holdoutCorpusHashes: { reader: "2".repeat(64), source: "3".repeat(64), quiz: "4".repeat(64) },
  });
  writeFileAtomic(resolve(root, closurePath), readFileSync(
    resolve(REPOSITORY_ROOT, "docs/v25/reports/IMP-24B_ZERO_CALL_LIFECYCLE_CLOSURE.json"),
    "utf8",
  ));
  let roleAssignmentPath: string | undefined;
  let roleAssignmentFreezeSha256: string | null = null;
  let roleAssignmentBytesSha256: string | undefined;
  if (ready) {
    roleAssignmentPath = "fixtures/role-assignment-freeze.json";
    const roleAssignment = {
      schema: "split-lane-fixed-role-assignment-v1",
      readerPrimary: { profileId: selected.readerPrimary, model: "gpt-5.6-sol", effort: "high" },
      readerBackup: { profileId: selected.readerAudit, model: "gpt-5.5", effort: "high" },
      sourcePrimary: { profileId: selected.sourcePrimary, model: "gpt-5.6-sol", effort: "xhigh" },
      sourceAdjudicator: { profileId: selected.sourceAdjudicator, model: "gpt-5.5", effort: "xhigh" },
      quizChecker: { deterministic: true, checkerVersion: "quiz-answer-tell-checker-v1" },
      quizAdjudicator: { profileId: selected.quizSemanticAdjudicator, model: "gpt-5.6-sol", effort: "xhigh" },
    };
    const roleAssignmentSha256 = hashCanonical(roleAssignment);
    const schemaHashes = { reader: "a".repeat(64), source: "b".repeat(64), quiz: "c".repeat(64) };
    const promptSourceHashes = { reader: "d".repeat(64), source: "e".repeat(64), quiz: "f".repeat(64) };
    const routeBinding = {
      executionRoute: "codex_exec_chatgpt_subscription",
      authMode: "chatgpt",
      apiKeyPresent: false,
      apiFallbackAllowed: false,
      directHttpOrSdkAllowed: false,
      executionProfileHash: "a".repeat(64),
      routePolicyVersion: "codex-exec-chatgpt-v1",
    };
    const binding = (slot: string, lane: "reader" | "source" | "quiz", judge: unknown) => ({
      schema: "imp24-forward-role-profile-binding-v3",
      slot,
      lane,
      judge,
      qualificationResultSha256,
      profileRoleResultSha256: "b".repeat(64),
      canaryAttemptsSha256: "c".repeat(64),
      holdoutAttemptsSha256: "d".repeat(64),
      promptSourceSha256: promptSourceHashes[lane],
      schemaSha256: schemaHashes[lane],
      envelopeCompilerSha256: certification.envelopeCompilerSha256,
      envelopeContractSha256: certification.envelopeContractSha256,
      modelOutputContractsSha256: certification.modelOutputContractsSha256,
      productionQualificationParitySha256,
      corpusBundleSha256: certification.corpusBundleSha256,
      thresholdsSha256: certification.thresholdsSha256,
      executionProfileHash: routeBinding.executionProfileHash,
      routePolicyVersion: routeBinding.routePolicyVersion,
      productionInstrumentSealSha256: productionSealSha256,
    });
    const roleProfileBindings = {
      readerPrimary: binding("readerPrimary", "reader", roleAssignment.readerPrimary),
      readerAudit: binding("readerAudit", "reader", roleAssignment.readerBackup),
      sourcePrimary: binding("sourcePrimary", "source", roleAssignment.sourcePrimary),
      sourceAdjudicator: binding("sourceAdjudicator", "source", roleAssignment.sourceAdjudicator),
      quizSemanticAdjudicator: binding("quizSemanticAdjudicator", "quiz", roleAssignment.quizAdjudicator),
    };
    const roleProfileBindingsSha256 = hashCanonical(roleProfileBindings);
    const policies = buildFixedForwardRoleFreezePolicies();
    const panelPolicy = buildForwardPanelReviewPolicy(policies);
    const instrumentManifest = {
      schema: "split-lane-instrument-manifest-v1",
      readerRubricVersion: "imp24-review-v2",
      sourceRubricVersion: "imp24-review-v2",
      readerSchemaSha256: schemaHashes.reader,
      sourceSchemaSha256: schemaHashes.source,
      quizAdjudicationSchemaSha256: schemaHashes.quiz,
      quizPhase2Version: "imp24-review-v2",
      aggregationVersion: "aggregated-chapter-review-v1",
      roleAssignmentPolicyVersion: "imp24-forward-fixed-role-assignment-v3",
      fixedRoleAssignmentSha256: roleAssignmentSha256,
      executionProfileHash: routeBinding.executionProfileHash,
      routePolicyVersion: routeBinding.routePolicyVersion,
      thresholdsSha256: certification.thresholdsSha256,
      readerCorpusSha256: "1".repeat(64),
      sourceCorpusSha256: "2".repeat(64),
      quizCorpusSha256: "3".repeat(64),
    };
    const reviewConfig = {
      schema: "forward-frozen-review-config-v1",
      roleAssignment,
      roleAssignmentSha256,
      instrumentManifest,
      instrumentManifestSha256: hashCanonical(instrumentManifest),
      readerBar: 80,
      reviewProtocolVersion: "imp24-review-v2",
      qualificationExperimentId: "s16-forward-role-qualification-v3-envelope-r1",
      qualificationResultSha256,
      qualificationFreezeSha256,
      instrumentCertificationSha256: certification.certificationSha256,
      corpusBundleSha256: certification.corpusBundleSha256,
      roleProfileBindingsSha256,
      auditSubsetPolicySha256: hashCanonical(policies.auditSubset),
      escalationPolicySha256: hashCanonical(policies.escalation),
      disagreementPolicySha256: hashCanonical(policies.disagreement),
      panelPolicy,
      panelPolicySha256: hashCanonical(panelPolicy),
      promptSourceHashes,
      schemaHashes,
      executionProfileHash: routeBinding.executionProfileHash,
      routePolicyVersion: routeBinding.routePolicyVersion,
      productionInstrumentSealSha256: productionSealSha256,
      productionQualificationParitySha256,
    };
    const freezeCore = {
      schema: "imp24-forward-role-assignment-freeze-v3",
      experimentId: "s16-forward-role-qualification-v3-envelope-r1",
      implementationHeadSha: implementationCommit,
      implementationCiGateSha256: ciGate.gateSha256,
      callLedgerSha256,
      callLedgerBytesSha256,
      qualificationResultSha256,
      qualificationFreezeSha256,
      instrumentCertification: certification,
      instrumentCertificationSha256: certification.certificationSha256,
      corpusBundleSha256: certification.corpusBundleSha256,
      schemaHashes,
      schemaHashesSha256: hashCanonical(schemaHashes),
      promptSourceHashes,
      promptSourceHashesSha256: hashCanonical(promptSourceHashes),
      routeBinding,
      routeBindingSha256: hashCanonical(routeBinding),
      roleAssignment,
      roleAssignmentSha256,
      roleProfileBindings,
      roleProfileBindingsSha256,
      auditSubsetPolicy: policies.auditSubset,
      auditSubsetPolicySha256: hashCanonical(policies.auditSubset),
      escalationPolicy: policies.escalation,
      escalationPolicySha256: hashCanonical(policies.escalation),
      disagreementPolicy: policies.disagreement,
      disagreementPolicySha256: hashCanonical(policies.disagreement),
      panelPolicy,
      panelPolicySha256: hashCanonical(panelPolicy),
      reviewConfig,
      reviewConfigSha256: hashCanonical(reviewConfig),
      productionInstrumentSealSha256: productionSealSha256,
      productionQualificationParitySha256,
      frozenAt: "2026-07-13T00:00:00.000Z",
    };
    roleAssignmentFreezeSha256 = hashCanonical(freezeCore);
    writeJson(root, roleAssignmentPath, { ...freezeCore, freezeSha256: roleAssignmentFreezeSha256 });
    roleAssignmentBytesSha256 = sha256Hex(readFileSync(resolve(root, roleAssignmentPath)));
  }
  const terminalCore = {
    schema: "imp24-role-qualification-campaign-report-v1",
    experimentId: "s16-forward-role-qualification-v3-envelope-r1",
    implementationCiGateSha256: ciGate.gateSha256,
    implementationHeadSha: implementationCommit,
    status: ready ? "ROLE_SET_READY" : "ROLE_SET_NOT_READY",
    candidateAvailabilitySha256: "0".repeat(64),
    preflightSha256: "f".repeat(64),
    qualificationFreezeSha256,
    qualificationResultSha256,
    roleRegistrySha256,
    callLedgerSha256,
    roleAssignmentFreezeSha256,
    selected,
    qualifiedProfiles: [...new Set(Object.values(selected).filter((value): value is string => value !== null))].sort(),
    profileStatusCounts: ready ? { QUALIFIED: 5 } : { NOT_QUALIFIED: 1, QUALIFIED: 1 },
    callCounts: {
      baseMaximum: 464,
      hardMaximum: 928,
      canaryCalls: 1,
      holdoutCalls: 1,
      baseCallsAttempted: 2,
      infrastructureReplays: 0,
      maxPlanEvents: 0,
      totalAttempts: 2,
      brokerRequests: 2,
      codexExecInvocations: 2,
      cachedReceipts: 0,
      apiCalls: 0,
    },
    thresholdsWeakened: false,
    holdoutsRelabeled: false,
    unavailableReplaced: false,
    outputInformedResampling: false,
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
    completedAt: "2026-07-13T00:01:00.000Z",
    artifactBytesSha256: {
      implementationCiGate: sha256Hex(readFileSync(resolve(root, ciEvidencePath))),
      candidateAvailability: "6".repeat(64),
      preflight: "7".repeat(64),
      qualificationFreeze: "8".repeat(64),
      qualificationResult: "9".repeat(64),
      roleRegistry: "a".repeat(64),
      callLedger: callLedgerBytesSha256,
      ...(roleAssignmentBytesSha256 === undefined ? {} : { roleAssignmentFreeze: roleAssignmentBytesSha256 }),
    },
  };
  writeJson(root, terminalResultPath, { ...terminalCore, reportSha256: hashCanonical(terminalCore) });
  return { terminalResultPath, roleAssignmentPath, ciEvidencePath, preliminaryReportPath, closurePath };
}

function assertFinalRejectsCiGateMutation(args: {
  fixtureName: string;
  mutate: (gate: Record<string, unknown>) => void;
  expected: RegExp;
}): void {
  const roots = mkTestRoots(args.fixtureName);
  try {
    const lifecycle = initializeLifecycleRepository(roots.base);
    const inputs = prepareInputs(roots.base, lifecycle.implementationCommit, false);
    const ciGate = JSON.parse(
      readFileSync(resolve(roots.base, inputs.ciEvidencePath), "utf8"),
    ) as Record<string, unknown>;
    args.mutate(ciGate);
    const { gateSha256: _oldGateSha256, ...ciGateCore } = ciGate;
    writeJson(roots.base, inputs.ciEvidencePath, {
      ...ciGateCore,
      gateSha256: hashCanonical(ciGateCore),
    });
    const evidenceCommit = commitAll(roots.base, `fixture ${args.fixtureName} evidence`);
    assert.throws(() => buildImp24CFinalAttestationForFixture({
      repositoryRoot: roots.base,
      artifactRoot: roots.base,
      lifecycleBaselineCommit: lifecycle.baselineCommit,
      implementationCommit: lifecycle.implementationCommit,
      evidenceCommit,
      terminalQualificationResultPath: inputs.terminalResultPath,
      dedicatedCiEvidencePath: inputs.ciEvidencePath,
      preliminaryReportPath: inputs.preliminaryReportPath,
      imp24bClosurePath: inputs.closurePath,
    }), args.expected);
  } finally {
    roots.dispose();
  }
}

test("dedicated V25 CI terminal verifier has least-privilege GitHub reads and remains read-only", () => {
  const workflow = readFileSync(
    resolve(REPOSITORY_ROOT, ".github/workflows/chapterflow-v25-pipeline.yml"),
    "utf8",
  );
  const permissionsBlock = workflow.match(/^permissions:\n((?: {2}[a-z-]+: [^\n]+\n?)+)/m);
  assert.ok(permissionsBlock, "dedicated V25 workflow must declare top-level permissions");
  const permissions = Object.fromEntries(
    permissionsBlock[1].trim().split("\n").map((line) => {
      const separator = line.indexOf(":");
      return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
    }),
  );
  assert.deepEqual(permissions, {
    contents: "read",
    actions: "read",
    "pull-requests": "read",
  });

  const terminalStepName = "      - name: Verify IMP-24C terminal attestation read-only when present";
  const terminalStepStart = workflow.indexOf(terminalStepName);
  assert.notEqual(terminalStepStart, -1, "dedicated V25 workflow must retain the terminal-attestation verifier step");
  const nextStepStart = workflow.indexOf("\n      - name:", terminalStepStart + terminalStepName.length);
  const terminalStep = workflow.slice(
    terminalStepStart,
    nextStepStart === -1 ? workflow.length : nextStepStart,
  );
  assert.match(terminalStep, /^        env:\n          GH_TOKEN: \$\{\{ github\.token \}\}$/m);
  assert.match(
    terminalStep,
    /imp24-materialize-final-attestation --verify-retained --json/,
  );
  assert.doesNotMatch(terminalStep, /--write\b/);
});

test("IMP-24C final materializer accepts known ancestral commits, writes only terminal artifacts, and verifies read-only", () => {
  const roots = mkTestRoots("imp24c-final-attestation");
  try {
    const lifecycle = initializeLifecycleRepository(roots.base);
    const inputs = prepareInputs(roots.base, lifecycle.implementationCommit, true);
    const evidenceCommit = commitAll(roots.base, "fixture evidence");
    const preliminaryBefore = readFileSync(resolve(roots.base, inputs.preliminaryReportPath!));
    const before = walkRootManifest(roots.base);
    const options = {
      repositoryRoot: roots.base,
      artifactRoot: roots.base,
      lifecycleBaselineCommit: lifecycle.baselineCommit,
      implementationCommit: lifecycle.implementationCommit,
      evidenceCommit,
      terminalQualificationResultPath: inputs.terminalResultPath,
      roleAssignmentPath: inputs.roleAssignmentPath!,
      dedicatedCiEvidencePath: inputs.ciEvidencePath,
      preliminaryReportPath: inputs.preliminaryReportPath,
      imp24bClosurePath: inputs.closurePath,
    };
    const first = buildImp24CFinalAttestationForFixture(options);
    const second = buildImp24CFinalAttestationForFixture(options);
    assert.deepEqual(first, second, "identical inputs must produce deterministic bytes");
    assert.equal(first.attestation.implementationCommit, lifecycle.implementationCommit);
    assert.equal(first.attestation.evidenceCommit, evidenceCommit);
    assert.equal(first.attestation.finalDecision, "PASS");
    assert.equal(first.attestation.roleSetReady, true);
    assert.equal(first.attestation.roles.readerPrimary, "gpt-5.6-sol@high");
    assert.deepEqual(first.attestation.callCounts, {
      canaryCalls: 1,
      holdoutCalls: 1,
      infrastructureReplays: 0,
      totalAttempts: 2,
      codexExecInvocations: 2,
      maxPlanEvents: 0,
      apiCalls: 0,
    });
    assert.equal(first.attestation.controls.thresholdsWeakened, false);
    assert.equal(first.attestation.controls.holdoutsRelabeled, false);
    assert.equal(first.attestation.controls.outputInformedResampling, false);
    assert.equal(first.attestation.stopBoundary.pilotRun, false);
    assert.equal(first.attestation.stopBoundary.localSolActivation, false);
    assert.deepEqual(first.attestation.qualifiedProfiles, [
      "gpt-5.5@high",
      "gpt-5.5@xhigh",
      "gpt-5.6-sol@high",
      "gpt-5.6-sol@xhigh",
    ]);
    assert.equal(Object.hasOwn(first.attestation, "terminalAttestationCommit"), false,
      "final report must not require its own future commit SHA");

    const materialized = materializeImp24CFinalAttestationForFixture(options);
    assert.equal(materialized.writes, 3);
    const changed = diffRootManifests(before, walkRootManifest(roots.base));
    assert.deepEqual(changed.removed, []);
    assert.deepEqual(changed.changed, []);
    assert.deepEqual(changed.added.sort(), Object.values(IMP24C_FINAL_ATTESTATION_PATHS).sort());
    assert.deepEqual(readFileSync(resolve(roots.base, inputs.preliminaryReportPath!)), preliminaryBefore,
      "final materialization must never modify pre-live artifacts");

    const beforeVerify = walkRootManifest(roots.base);
    assert.equal(verifyImp24CFinalAttestationForFixture(options).writes, 0);
    assert.equal(verifyRetainedImp24CFinalAttestationForFixture({
      repositoryRoot: roots.base,
      artifactRoot: roots.base,
    }).writes, 0);
    assert.deepEqual(walkRootManifest(roots.base), beforeVerify,
      "final verification must leave every byte unchanged");
  } finally {
    roots.dispose();
  }
});

test("IMP-24C final materializer truthfully attests a terminal blocked campaign without freezing partial roles", () => {
  const roots = mkTestRoots("imp24c-final-attestation-blocked");
  try {
    const lifecycle = initializeLifecycleRepository(roots.base);
    const inputs = prepareInputs(roots.base, lifecycle.implementationCommit, false);
    assert.equal(inputs.roleAssignmentPath, undefined);
    const evidenceCommit = commitAll(roots.base, "fixture blocked evidence");
    const options = {
      repositoryRoot: roots.base,
      artifactRoot: roots.base,
      lifecycleBaselineCommit: lifecycle.baselineCommit,
      implementationCommit: lifecycle.implementationCommit,
      evidenceCommit,
      terminalQualificationResultPath: inputs.terminalResultPath,
      dedicatedCiEvidencePath: inputs.ciEvidencePath,
      preliminaryReportPath: inputs.preliminaryReportPath,
      imp24bClosurePath: inputs.closurePath,
    };
    const built = buildImp24CFinalAttestationForFixture(options);
    assert.equal(built.attestation.finalDecision, "BLOCKED");
    assert.equal(built.attestation.roleSetReady, false);
    assert.equal(built.attestation.qualificationResult.status, "ROLE_SET_NOT_READY");
    assert.equal(built.attestation.qualificationResult.roleAssignmentBytesSha256, null);
    assert.equal(built.attestation.inputs.roleAssignmentPath, null);
    assert.equal(built.attestation.inputBytesSha256.roleAssignment, null);
    assert.ok(built.attestation.qualificationResult.blockedReason);
    assert.deepEqual(built.attestation.roles, {
      readerPrimary: null,
      readerAudit: null,
      sourcePrimary: null,
      sourceAdjudicator: null,
      quizSemanticAdjudicator: null,
    });
    assert.deepEqual(built.attestation.qualifiedProfiles, ["gpt-5.6-sol@high"]);
    assert.deepEqual(built.attestation.remainingRisks, [built.attestation.qualificationResult.blockedReason]);
    assert.equal(built.attestation.stopBoundary.pilotRun, false);
    assert.equal(built.attestation.stopBoundary.goldRun, false);
    assert.equal(built.attestation.stopBoundary.localSolActivation, false);
    assert.equal(materializeImp24CFinalAttestationForFixture(options).writes, 3);
    assert.equal(verifyImp24CFinalAttestationForFixture(options).writes, 0);
    assert.equal(verifyRetainedImp24CFinalAttestationForFixture({
      repositoryRoot: roots.base,
      artifactRoot: roots.base,
    }).writes, 0);
  } finally {
    roots.dispose();
  }
});

test("IMP-24C final materializer rejects a committed self-rehashed role freeze with unchanged profile IDs and mismatched campaign bindings", () => {
  const roots = mkTestRoots("imp24c-final-role-freeze-cross-binding");
  try {
    const lifecycle = initializeLifecycleRepository(roots.base);
    const inputs = prepareInputs(roots.base, lifecycle.implementationCommit, true);
    const roleAssignmentPath = inputs.roleAssignmentPath!;
    const roleFreeze = JSON.parse(
      readFileSync(resolve(roots.base, roleAssignmentPath), "utf8"),
    ) as Record<string, unknown>;
    const { freezeSha256: _oldFreezeSha256, ...roleFreezeCore } = roleFreeze;
    const substitutedQualificationResultSha256 = "f".repeat(64);
    const roleProfileBindings = structuredClone(
      roleFreeze.roleProfileBindings,
    ) as Record<string, Record<string, unknown>>;
    for (const binding of Object.values(roleProfileBindings)) {
      binding.qualificationResultSha256 = substitutedQualificationResultSha256;
    }
    const roleProfileBindingsSha256 = hashCanonical(roleProfileBindings);
    const reviewConfig = structuredClone(roleFreeze.reviewConfig) as Record<string, unknown>;
    reviewConfig.qualificationResultSha256 = substitutedQualificationResultSha256;
    reviewConfig.roleProfileBindingsSha256 = roleProfileBindingsSha256;
    const substitutedCore = {
      ...roleFreezeCore,
      qualificationResultSha256: substitutedQualificationResultSha256,
      roleProfileBindings,
      roleProfileBindingsSha256,
      reviewConfig,
      reviewConfigSha256: hashCanonical(reviewConfig),
    };
    writeJson(roots.base, roleAssignmentPath, {
      ...substitutedCore,
      freezeSha256: hashCanonical(substitutedCore),
    });
    const evidenceCommit = commitAll(roots.base, "fixture substituted role freeze evidence");
    assert.throws(() => buildImp24CFinalAttestationForFixture({
      repositoryRoot: roots.base,
      artifactRoot: roots.base,
      lifecycleBaselineCommit: lifecycle.baselineCommit,
      implementationCommit: lifecycle.implementationCommit,
      evidenceCommit,
      terminalQualificationResultPath: inputs.terminalResultPath,
      roleAssignmentPath,
      dedicatedCiEvidencePath: inputs.ciEvidencePath,
      preliminaryReportPath: inputs.preliminaryReportPath,
      imp24bClosurePath: inputs.closurePath,
    }), /qualification bindings disagree/);
  } finally {
    roots.dispose();
  }
});

test("IMP-24C final materializer rejects a same-profile role freeze with a self-rehashed outer model substitution", () => {
  const roots = mkTestRoots("imp24c-final-role-freeze-internal-binding");
  try {
    const lifecycle = initializeLifecycleRepository(roots.base);
    const inputs = prepareInputs(roots.base, lifecycle.implementationCommit, true);
    const roleAssignmentPath = inputs.roleAssignmentPath!;
    const roleFreeze = JSON.parse(
      readFileSync(resolve(roots.base, roleAssignmentPath), "utf8"),
    ) as Record<string, unknown>;
    const roleAssignment = roleFreeze.roleAssignment as Record<string, Record<string, unknown>>;
    roleAssignment.readerPrimary.model = "gpt-substituted";
    const { freezeSha256: _oldFreezeSha256, ...substitutedCore } = roleFreeze;
    writeJson(roots.base, roleAssignmentPath, {
      ...substitutedCore,
      freezeSha256: hashCanonical(substitutedCore),
    });
    const evidenceCommit = commitAll(roots.base, "fixture internally substituted role freeze evidence");
    assert.throws(() => buildImp24CFinalAttestationForFixture({
      repositoryRoot: roots.base,
      artifactRoot: roots.base,
      lifecycleBaselineCommit: lifecycle.baselineCommit,
      implementationCommit: lifecycle.implementationCommit,
      evidenceCommit,
      terminalQualificationResultPath: inputs.terminalResultPath,
      roleAssignmentPath,
      dedicatedCiEvidencePath: inputs.ciEvidencePath,
      preliminaryReportPath: inputs.preliminaryReportPath,
      imp24bClosurePath: inputs.closurePath,
    }), /fixed role assignment hash drift/);
  } finally {
    roots.dispose();
  }
});

test("IMP-24C final materializer rejects a top-level zero API override of nonzero typed campaign counts", () => {
  const roots = mkTestRoots("imp24c-final-api-count-override");
  try {
    const lifecycle = initializeLifecycleRepository(roots.base);
    const inputs = prepareInputs(roots.base, lifecycle.implementationCommit, false);
    const terminal = JSON.parse(
      readFileSync(resolve(roots.base, inputs.terminalResultPath), "utf8"),
    ) as Record<string, unknown>;
    const callCounts = terminal.callCounts as Record<string, unknown>;
    callCounts.apiCalls = 1;
    terminal.apiCalls = 0;
    const { reportSha256: _oldReportSha256, ...terminalCore } = terminal;
    writeJson(roots.base, inputs.terminalResultPath, {
      ...terminalCore,
      reportSha256: hashCanonical(terminalCore),
    });
    const evidenceCommit = commitAll(roots.base, "fixture campaign API-count override evidence");
    assert.throws(() => buildImp24CFinalAttestationForFixture({
      repositoryRoot: roots.base,
      artifactRoot: roots.base,
      lifecycleBaselineCommit: lifecycle.baselineCommit,
      implementationCommit: lifecycle.implementationCommit,
      evidenceCommit,
      terminalQualificationResultPath: inputs.terminalResultPath,
      dedicatedCiEvidencePath: inputs.ciEvidencePath,
      preliminaryReportPath: inputs.preliminaryReportPath,
      imp24bClosurePath: inputs.closurePath,
    }), /missing or unexpected fields/);
  } finally {
    roots.dispose();
  }
});

test("IMP-24C final materializer rejects self-rehashed CI evidence without canonical collector provenance", () => {
  const roots = mkTestRoots("imp24c-final-ci-provenance");
  try {
    const lifecycle = initializeLifecycleRepository(roots.base);
    const inputs = prepareInputs(roots.base, lifecycle.implementationCommit, false);
    const ciGate = JSON.parse(
      readFileSync(resolve(roots.base, inputs.ciEvidencePath), "utf8"),
    ) as Record<string, unknown>;
    const workflow = ciGate.workflow as Record<string, unknown>;
    workflow.runId = 0;
    const { gateSha256: _oldGateSha256, ...ciGateCore } = ciGate;
    writeJson(roots.base, inputs.ciEvidencePath, {
      ...ciGateCore,
      gateSha256: hashCanonical(ciGateCore),
    });
    const evidenceCommit = commitAll(roots.base, "fixture invalid CI provenance evidence");
    assert.throws(() => buildImp24CFinalAttestationForFixture({
      repositoryRoot: roots.base,
      artifactRoot: roots.base,
      lifecycleBaselineCommit: lifecycle.baselineCommit,
      implementationCommit: lifecycle.implementationCommit,
      evidenceCommit,
      terminalQualificationResultPath: inputs.terminalResultPath,
      dedicatedCiEvidencePath: inputs.ciEvidencePath,
      preliminaryReportPath: inputs.preliminaryReportPath,
      imp24bClosurePath: inputs.closurePath,
    }), /workflow identity does not match|positive integer/);
  } finally {
    roots.dispose();
  }
});

test("IMP-24C final materializer rejects a self-rehashed retained CI gate with the wrong repository URL", () => {
  assertFinalRejectsCiGateMutation({
    fixtureName: "imp24c-final-ci-repository-url",
    mutate: (ciGate) => {
      const trustedEvidence = ciGate.trustedEvidence as Record<string, unknown>;
      const raw = trustedEvidence.raw as Record<string, unknown>;
      const repository = raw.repository as Record<string, unknown>;
      repository.url = "https://github.com/WillSoltani/Other";
      trustedEvidence.repositorySha256 = hashCanonical(repository);
    },
    expected: /live GitHub repository identity must be exactly/,
  });
});

test("IMP-24C final materializer rejects numeric and noncanonical CI verification timestamps", () => {
  for (const [fixtureName, verifiedAt] of [
    ["imp24c-final-ci-numeric-timestamp", 0],
    ["imp24c-final-ci-noncanonical-timestamp", "2026-07-13T00:00:00Z"],
  ] as const) {
    assertFinalRejectsCiGateMutation({
      fixtureName,
      mutate: (ciGate) => {
        ciGate.verifiedAt = verifiedAt;
      },
      expected: /verifiedAt must be an exact canonical ISO timestamp/,
    });
  }
});

test("IMP-24C final materializer rejects unexpected top-level and retained-raw CI gate fields", () => {
  assertFinalRejectsCiGateMutation({
    fixtureName: "imp24c-final-ci-unexpected-top-level",
    mutate: (ciGate) => {
      ciGate.apiCallsMade = 0;
    },
    expected: /implementation CI gate has missing or unexpected fields/,
  });
  assertFinalRejectsCiGateMutation({
    fixtureName: "imp24c-final-ci-unexpected-raw",
    mutate: (ciGate) => {
      const trustedEvidence = ciGate.trustedEvidence as Record<string, unknown>;
      const raw = trustedEvidence.raw as Record<string, unknown>;
      raw.apiCalls = 0;
    },
    expected: /retained trusted evidence preimages has missing or unexpected fields/,
  });
});

test("IMP-24C production final boundary rejects repository-local fixture evidence paths", () => {
  const roots = mkTestRoots("imp24c-final-production-paths");
  try {
    const lifecycle = initializeLifecycleRepository(roots.base);
    const inputs = prepareInputs(roots.base, lifecycle.implementationCommit, true);
    const evidenceCommit = commitAll(roots.base, "fixture evidence");
    assert.throws(() => buildImp24CFinalAttestation({
      repositoryRoot: roots.base,
      artifactRoot: roots.base,
      implementationCommit: lifecycle.implementationCommit,
      evidenceCommit,
      terminalQualificationResultPath: inputs.terminalResultPath,
      roleAssignmentPath: inputs.roleAssignmentPath,
      dedicatedCiEvidencePath: inputs.ciEvidencePath,
      preliminaryReportPath: inputs.preliminaryReportPath,
      imp24bClosurePath: inputs.closurePath,
    }), /authoritative repository\/artifact root|exact successor qualification/);
  } finally {
    roots.dispose();
  }
});

test("IMP-24C final materializer rejects malformed, unknown, and non-ancestral commit identities", () => {
  const roots = mkTestRoots("imp24c-final-commit-validation");
  try {
    const lifecycle = initializeLifecycleRepository(roots.base);
    const inputs = prepareInputs(roots.base, lifecycle.implementationCommit, false);
    const evidenceCommit = commitAll(roots.base, "fixture evidence");
    const base = {
      repositoryRoot: roots.base,
      artifactRoot: roots.base,
      lifecycleBaselineCommit: lifecycle.baselineCommit,
      evidenceCommit,
      terminalQualificationResultPath: inputs.terminalResultPath,
      dedicatedCiEvidencePath: inputs.ciEvidencePath,
      preliminaryReportPath: inputs.preliminaryReportPath,
      imp24bClosurePath: inputs.closurePath,
    };
    assert.throws(() => buildImp24CFinalAttestationForFixture({
      ...base,
      implementationCommit: "a".repeat(39),
    }), /exact lowercase 40-character Git SHA/);
    assert.throws(() => buildImp24CFinalAttestationForFixture({
      ...base,
      implementationCommit: "0".repeat(40),
    }), /not a known commit/);
    assert.throws(() => buildImp24CFinalAttestationForFixture({
      ...base,
      implementationCommit: lifecycle.implementationCommit,
      evidenceCommit: lifecycle.baselineCommit,
    }), /does not descend/);
    const terminal = JSON.parse(readFileSync(resolve(roots.base, inputs.terminalResultPath), "utf8")) as Record<string, unknown>;
    terminal.completedAt = "2026-07-13T00:02:00.000Z";
    writeJson(roots.base, inputs.terminalResultPath, terminal);
    assert.throws(() => buildImp24CFinalAttestationForFixture({
      ...base,
      implementationCommit: lifecycle.implementationCommit,
    }), /terminal qualification report self hash drift/);

    const committedTerminal = JSON.parse(runGit(roots.base, [
      "show", `${evidenceCommit}:${inputs.terminalResultPath}`,
    ])) as Record<string, unknown>;
    committedTerminal.completedAt = "2026-07-13T00:03:00.000Z";
    const { reportSha256: _oldHash, ...committedTerminalCore } = committedTerminal;
    writeJson(roots.base, inputs.terminalResultPath, {
      ...committedTerminalCore,
      reportSha256: hashCanonical(committedTerminalCore),
    });
    assert.throws(() => buildImp24CFinalAttestationForFixture({
      ...base,
      implementationCommit: lifecycle.implementationCommit,
    }), /current bytes differ from Recovery Commit B/);
  } finally {
    roots.dispose();
  }
});
