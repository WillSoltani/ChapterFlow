import assert from "node:assert/strict";
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";

import { canonicalJson, hashCanonical } from "../src/contracts/contractUtil.js";
import {
  loadImp24RoleQualificationCliArtifactsV3,
  runMigrationBakeoffCli,
} from "../src/bakeoff/migration/cli.js";
import {
  IMP24_ROLE_CANDIDATE_ORDER,
  IMP24_ROLE_QUALIFICATION_AVAILABILITY_SCHEMA,
  buildRoleQualificationPlanV3,
  candidateAvailabilitySha256,
  type CandidateAvailabilityV3,
} from "../src/bakeoff/migration/roleQualificationRunnerV3.js";
import {
  IMP24_ROLE_QUALIFICATION_EXECUTION_ID,
  certifyImp24Corpora,
} from "../src/bakeoff/migration/imp24Corpus.js";
import { PIPELINE_DIR } from "../src/bakeoff/paths.js";
import {
  IMP24_REQUIRED_BRANCH,
  IMP24_REQUIRED_DRAFT_PR,
  IMP24_REQUIRED_REPOSITORY,
  IMP24_REQUIRED_REPOSITORY_URL,
  IMP24_REQUIRED_WORKFLOW_FILE,
  IMP24_REQUIRED_WORKFLOW_JOB,
  IMP24_REQUIRED_WORKFLOW_NAME,
  buildImp24ImplementationCiGateFromEvidence,
  runImp24RoleQualificationCampaignV3,
} from "../src/orchestrator/forwardRoleQualificationCampaignV3.js";
import {
  createLiveQualificationExecutorV3,
  prepareLiveRoleQualificationV3,
  validateLiveExecEvidenceRootV3,
} from "../src/orchestrator/forwardRoleQualificationLiveV3.js";
import {
  buildImp24DTransportSmokeInputBinding,
  runImp24DTransportSmoke,
} from "../src/orchestrator/forwardTransportSmokeCampaignV3.js";
import {
  IMP24D_TRANSPORT_SMOKE_EXECUTION_ID,
  IMP24D_TRANSPORT_SMOKE_R2_EXECUTION_ID,
  IMP24D_TRANSPORT_SMOKE_EVALUATION_SCHEMA,
  IMP24D_TRANSPORT_SMOKE_INPUT_BINDING_SCHEMA,
  assertImp24DTransportSmokeInputBindingMatchesCertifiedPlan,
  buildImp24DTransportMechanicalCorrection,
  imp24DTransportSmokeCycleResultRelPath,
  validateImp24DTransportSmokeCycle,
  validateImp24DTransportSmokeReport,
  verifyImp24DTransportMechanicalCorrectionOwnership,
  type Imp24DTransportSmokeCallV1,
  type Imp24DTransportSmokeCycleV1,
  type Imp24DTransportSmokeInputBindingV1,
} from "../src/orchestrator/forwardTransportSmokeEvidenceV3.js";
import {
  IMP24D_MECHANICAL_CORRECTION_SOURCE_FILES,
  assertImp24DBoundedCorrectionCommit,
  buildImp24DQualificationSemanticProjection,
  classifyImp24DPlannedCorrectionPaths,
  imp24DQualificationSemanticProjectionSha256,
} from "../src/orchestrator/forwardTransportSmokeCorrectionV3.js";
import { test } from "./harness.js";
import { mkTestRoots } from "./testRoots.js";

const SHA = "a".repeat(64);
const HEAD = "1".repeat(40);
const REPOSITORY_ROOT = resolve(PIPELINE_DIR, "../../../..");
const PIPELINE_REL = "scripts/book/prompts/chapterflow-v24-author-pipeline";
const EXACT_CORRECTION_SOURCE_FILES = [
  `${PIPELINE_REL}/src/exec/codexTransportConfig.ts`,
  `${PIPELINE_REL}/src/orchestrator/forwardRoleQualificationLiveV3.ts`,
  `${PIPELINE_REL}/src/orchestrator/forwardTransportSmokeCorrectionV3.ts`,
] as const;

function smokeImplementationGate(headSha: string, workflowRunId: number, verifiedAt: string) {
  return buildImp24ImplementationCiGateFromEvidence({
    expectedHeadSha: headSha,
    workflowRunId,
    checkout: { branch: IMP24_REQUIRED_BRANCH, headSha, implementationClean: true },
    workflowRun: {
      databaseId: workflowRunId,
      displayName: IMP24_REQUIRED_WORKFLOW_NAME,
      workflowFile: IMP24_REQUIRED_WORKFLOW_FILE,
      headBranch: IMP24_REQUIRED_BRANCH,
      headSha,
      status: "completed",
      conclusion: "success",
      jobs: [{ name: IMP24_REQUIRED_WORKFLOW_JOB, status: "completed", conclusion: "success" }],
    },
    pullRequest: {
      number: IMP24_REQUIRED_DRAFT_PR,
      state: "OPEN",
      isDraft: true,
      mergedAt: null,
      mergeCommit: null,
      headRefName: IMP24_REQUIRED_BRANCH,
      headRefOid: headSha,
    },
    repository: {
      nameWithOwner: IMP24_REQUIRED_REPOSITORY,
      url: IMP24_REQUIRED_REPOSITORY_URL,
    },
    verifiedAt,
  });
}

function preparedSmokeInput() {
  const artifacts = loadImp24RoleQualificationCliArtifactsV3(REPOSITORY_ROOT);
  const entries = (["reader", "source", "quiz"] as const).flatMap((role) =>
    IMP24_ROLE_CANDIDATE_ORDER[role].map((profile, ordinal) => ({
      role,
      ordinal,
      ...profile,
      status: "AVAILABLE" as const,
      modelListed: true,
      visible: true,
      effortSupported: true,
      reason: "fixture exact visible model and effort",
    })));
  const availabilityCore = {
    schema: IMP24_ROLE_QUALIFICATION_AVAILABILITY_SCHEMA,
    experimentId: IMP24_ROLE_QUALIFICATION_EXECUTION_ID,
    source: "codex-local-models-cache" as const,
    sourceBytesSha256: SHA,
    sourceFetchedAt: "2026-07-14T12:00:00.000Z",
    policyBytesSha256: SHA,
    candidateOrderSha256: hashCanonical(IMP24_ROLE_CANDIDATE_ORDER),
    entries,
  };
  const input = {
    experimentId: IMP24_ROLE_QUALIFICATION_EXECUTION_ID,
    corpusBundle: artifacts.corpusBundle,
    corpusCertification: certifyImp24Corpora(artifacts.corpusBundle),
    certification: artifacts.certification,
    productionInstrumentSeal: artifacts.productionInstrumentSeal,
    candidateAvailability: {
      ...availabilityCore,
      availabilitySha256: candidateAvailabilitySha256(availabilityCore),
    },
    thresholds: artifacts.thresholds,
    thresholdBytesSha256: artifacts.thresholdBytesSha256,
  };
  return {
    input,
    prepared: prepareLiveRoleQualificationV3({ repositoryRoot: REPOSITORY_ROOT, input }),
  };
}

function failedCall(
  role: "reader" | "source",
  executionId: typeof IMP24D_TRANSPORT_SMOKE_EXECUTION_ID
    | typeof IMP24D_TRANSPORT_SMOKE_R2_EXECUTION_ID = IMP24D_TRANSPORT_SMOKE_EXECUTION_ID,
): Imp24DTransportSmokeCallV1 {
  return {
    role,
    sourceScheduleId: `v3-${role}-p1-canary-c01`,
    smokeScheduleId: `${executionId}-${role}-canary`,
    attemptId: `${executionId}-${role}-canary-a1`,
    sessionId: null,
    profileId: role === "reader" ? "gpt-5.6-sol@high" : "gpt-5.6-sol@xhigh",
    model: "gpt-5.6-sol",
    effort: role === "reader" ? "high" : "xhigh",
    requestSha256: SHA,
    evidenceEnvelopeSha256: SHA,
    evidenceEnvelopeBytesSha256: SHA,
    receiptSha256: SHA,
    receiptStatus: "policy_failure",
    processDiagnosticsRelPath: `state/${executionId}/${role}/process-diagnostics.json`,
    processDiagnosticsSha256: SHA,
    executionEvidenceSha256: SHA,
    evaluationArtifactSha256: SHA,
    requestedAt: "2026-07-14T12:00:02.000Z",
    completedAt: "2026-07-14T12:00:03.000Z",
    runnerBoundaryCrossed: false,
    chatgptAuthVerified: false,
    apiCalls: 0,
    processDiagnosticsComplete: true,
    authoritativeOutputFileProduced: false,
    schemaValidJson: false,
    envelopeAndSidecarsBound: false,
    qualificationMetricsIncluded: false,
    passed: false,
    failureClassification: "policy_failure",
    failureDetail: "preflight refused before spawn",
    diagnostics: {
      invocation: "NOT_INVOKED",
      classification: "policy_failure",
      errorName: "Error",
      errorMessage: "preflight refused before spawn",
      timedOut: false,
      exitCode: null,
      stdoutBytes: 0,
      stdoutSha256: SHA,
      stderrBytes: 0,
      stderrSha256: SHA,
    },
  };
}

function failedCycle(): Imp24DTransportSmokeCycleV1 {
  const calls = [failedCall("reader"), failedCall("source")] as [
    Imp24DTransportSmokeCallV1,
    Imp24DTransportSmokeCallV1,
  ];
  const core: Omit<Imp24DTransportSmokeCycleV1, "cycleSha256"> = {
    schema: "imp24d-transport-smoke-cycle-v1",
    cycle: 1,
    executionId: IMP24D_TRANSPORT_SMOKE_EXECUTION_ID,
    stateRoot: `scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments/${IMP24D_TRANSPORT_SMOKE_EXECUTION_ID}`,
    implementationCommit: HEAD,
    workflowRunId: 24,
    implementationCiVerifiedAt: "2026-07-14T12:00:00.000Z",
    implementationCiGateSha256: SHA,
    implementationCiGateBytesSha256: SHA,
    inputBindingSha256: SHA,
    inputBindingBytesSha256: SHA,
    candidateAvailabilitySha256: SHA,
    preflightSha256: SHA,
    qualificationFreezeSha256: SHA,
    qualificationSemanticProjectionSha256: SHA,
    certificationSha256: SHA,
    productionInstrumentSealSha256: SHA,
    productionQualificationParitySha256: SHA,
    mechanicalCorrectionSha256: null,
    correctionCommitReportBytesSha256: null,
    callLedgerSha256: SHA,
    callLedgerBytesSha256: SHA,
    calls,
    brokerRequests: 2,
    codexExecInvocations: 0,
    apiCalls: 0,
    qualificationMetricsIncluded: false,
    qualificationArtifactsCreated: false,
    status: "FAIL",
    startedAt: "2026-07-14T12:00:01.000Z",
    completedAt: "2026-07-14T12:00:04.000Z",
    processDiagnosticsSetSha256: hashCanonical(calls.map((call) => call.processDiagnosticsSha256)),
  };
  return { ...core, cycleSha256: hashCanonical(core) };
}

test("IMP-24D failed smoke cycles require both exact process diagnostics and CI-before-call chronology", () => {
  const cycle = failedCycle();
  validateImp24DTransportSmokeCycle(cycle);

  const missingDiagnostics = structuredClone(cycle);
  missingDiagnostics.calls[0].processDiagnosticsSha256 = null;
  missingDiagnostics.calls[0].processDiagnosticsComplete = false;
  missingDiagnostics.processDiagnosticsSetSha256 = hashCanonical(
    missingDiagnostics.calls.map((call) => call.processDiagnosticsSha256),
  );
  const { cycleSha256: _oldMissing, ...missingCore } = missingDiagnostics;
  missingDiagnostics.cycleSha256 = hashCanonical(missingCore);
  assert.throws(() => validateImp24DTransportSmokeCycle(missingDiagnostics),
    /cycle identity\/count\/status drift/);

  const badChronology = structuredClone(cycle);
  badChronology.implementationCiVerifiedAt = badChronology.startedAt;
  const { cycleSha256: _oldChronology, ...chronologyCore } = badChronology;
  badChronology.cycleSha256 = hashCanonical(chronologyCore);
  assert.throws(() => validateImp24DTransportSmokeCycle(badChronology),
    /cycle identity\/count\/status drift/);
});

test("IMP-24D corrected lifecycle accepts a zero-invocation preflight FAIL followed by one exact two-call PASS", () => {
  const first = failedCycle();
  const { cycleSha256: _firstCycleSha256, ...firstCore } = first;
  const passedCalls = (["reader", "source"] as const).map((role) => ({
    ...failedCall(role, IMP24D_TRANSPORT_SMOKE_R2_EXECUTION_ID),
    sessionId: `imp24-smoke-r2-${role}`,
    receiptStatus: "completed",
    requestedAt: "2026-07-14T12:00:07.000Z",
    completedAt: "2026-07-14T12:00:08.000Z",
    runnerBoundaryCrossed: true,
    chatgptAuthVerified: true,
    authoritativeOutputFileProduced: true,
    schemaValidJson: true,
    envelopeAndSidecarsBound: true,
    passed: true,
    failureClassification: null,
    failureDetail: null,
    diagnostics: {
      invocation: "RUNNER_RETURNED",
      classification: "completed",
      errorName: null,
      errorMessage: null,
      timedOut: false,
      exitCode: 0,
      stdoutBytes: 10,
      stdoutSha256: SHA,
      stderrBytes: 0,
      stderrSha256: SHA,
    },
  })) as [Imp24DTransportSmokeCallV1, Imp24DTransportSmokeCallV1];
  const secondCore: Omit<Imp24DTransportSmokeCycleV1, "cycleSha256"> = {
    ...firstCore,
    cycle: 2,
    executionId: IMP24D_TRANSPORT_SMOKE_R2_EXECUTION_ID,
    stateRoot: `scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments/${IMP24D_TRANSPORT_SMOKE_R2_EXECUTION_ID}`,
    implementationCommit: "2".repeat(40),
    workflowRunId: 25,
    implementationCiVerifiedAt: "2026-07-14T12:00:05.000Z",
    calls: passedCalls,
    codexExecInvocations: 2,
    status: "PASS",
    startedAt: "2026-07-14T12:00:06.000Z",
    completedAt: "2026-07-14T12:00:09.000Z",
    processDiagnosticsSetSha256: hashCanonical(passedCalls.map((call) => call.processDiagnosticsSha256)),
    mechanicalCorrectionSha256: "b".repeat(64),
    correctionCommitReportBytesSha256: "c".repeat(64),
  };
  const second = { ...secondCore, cycleSha256: hashCanonical(secondCore) };
  const mechanicalCorrection = buildImp24DTransportMechanicalCorrection({
    cycle: first,
    defectClass: "deterministic_transport_configuration",
    rationale: "The retained process diagnostics identify one fixed transport configuration defect.",
    paths: {
      changedFiles: [
        "docs/v25/reports/IMP-24D_TRANSPORT_SMOKE_RESULT.json",
        "docs/v25/reports/IMP-24D_TRANSPORT_SMOKE_RESULT.md",
        ...EXACT_CORRECTION_SOURCE_FILES,
        "scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments/s16-forward-role-qualification-v3-envelope-transport-smoke/cycle-result.json",
        "scripts/book/prompts/chapterflow-v24-author-pipeline/tests/codex-transport-regression.test.ts",
      ].sort(),
      smokeEvidenceFiles: [
        "docs/v25/reports/IMP-24D_TRANSPORT_SMOKE_RESULT.json",
        "docs/v25/reports/IMP-24D_TRANSPORT_SMOKE_RESULT.md",
        "scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments/s16-forward-role-qualification-v3-envelope-transport-smoke/cycle-result.json",
      ].sort(),
      sourceFiles: [...EXACT_CORRECTION_SOURCE_FILES],
      regressionTestFiles: ["scripts/book/prompts/chapterflow-v24-author-pipeline/tests/codex-transport-regression.test.ts"],
      deterministicRemintFiles: [],
    },
  });
  second.mechanicalCorrectionSha256 = mechanicalCorrection.correctionSha256;
  const { cycleSha256: _secondOld, ...secondRehashedCore } = second;
  second.cycleSha256 = hashCanonical(secondRehashedCore);
  const reportCore = {
    schema: "imp24d-transport-smoke-report-v1" as const,
    status: "PASS" as const,
    observabilityImplementationCommit: first.implementationCommit,
    correctionCommit: second.implementationCommit,
    effectiveImplementationCommit: second.implementationCommit,
    cycles: [first, second],
    mechanicalCorrection,
    finalCycle: 2 as const,
    totalCalls: 4 as const,
    modelCalls: 2,
    apiCalls: 0 as const,
    qualificationMetricsIncluded: false as const,
    qualificationArtifactsCreated: false as const,
  };
  validateImp24DTransportSmokeReport({ ...reportCore, reportSha256: hashCanonical(reportCore) });
});

test("IMP-24D semantic projection permits code-bound remints but rejects any frozen input or complete-call drift", () => {
  const { input, prepared } = preparedSmokeInput();
  const plan = buildRoleQualificationPlanV3(prepared.input);
  const calls = (["reader", "source"] as const).map((role) => {
    const candidate = IMP24_ROLE_CANDIDATE_ORDER[role][0];
    const entry = plan.schedule.find((item) => item.role === role
      && item.candidateOrdinal === 0 && item.partition === "canary" && item.caseOrdinal === 0)!;
    return {
      role,
      candidateOrdinal: 0,
      ...candidate,
      sourceScheduleId: entry.scheduleId,
      sourceScheduleOrdinal: entry.ordinal,
      caseId: entry.caseId,
      sourceCaseSha256: entry.sourceCaseSha256,
      goldSha256: entry.goldSha256,
      schemaSha256: entry.schemaSha256,
      promptSourceSha256: entry.promptSourceSha256,
      evidenceEnvelopeSha256: entry.evidenceEnvelopeSha256,
      evidenceEnvelopeBytesSha256: entry.evidenceEnvelopeBytesSha256,
      taskSha256: entry.taskSha256,
    };
  }) as unknown as Parameters<typeof buildImp24DQualificationSemanticProjection>[0]["calls"];
  const original = imp24DQualificationSemanticProjectionSha256({
    freeze: plan.freeze,
    candidateAvailability: input.candidateAvailability,
    calls,
  });
  const reminted = {
    ...plan.freeze,
    certificationSha256: "b".repeat(64),
    certificationSnapshotSha256: "c".repeat(64),
    productionInstrumentSealSha256: "d".repeat(64),
    productionInstrumentSealSnapshotSha256: "e".repeat(64),
    productionQualificationParitySha256: "f".repeat(64),
    freezeSha256: "0".repeat(64),
  };
  assert.equal(imp24DQualificationSemanticProjectionSha256({
    freeze: reminted,
    candidateAvailability: { ...input.candidateAvailability, sourceFetchedAt: "2099-01-01T00:00:00.000Z" },
    calls,
  }), original, "code-bound remints and observation time are excluded");
  assert.notEqual(imp24DQualificationSemanticProjectionSha256({
    freeze: { ...reminted, thresholdsSha256: "1".repeat(64) },
    candidateAvailability: input.candidateAvailability,
    calls,
  }), original, "threshold drift must change the semantic projection");
  const replacementCalls = structuredClone(calls);
  replacementCalls[0].taskSha256 = "2".repeat(64);
  assert.notEqual(imp24DQualificationSemanticProjectionSha256({
    freeze: reminted,
    candidateAvailability: input.candidateAvailability,
    calls: replacementCalls,
  }), original, "any complete fixed-call drift must change the semantic projection");
});

test("IMP-24D correction path classification admits only the exact transport, provenance, and guard source set", () => {
  const pipeline = PIPELINE_REL;
  const requiredEvidenceAndTest = [
    "docs/v25/reports/IMP-24D_TRANSPORT_SMOKE_RESULT.json",
    "docs/v25/reports/IMP-24D_TRANSPORT_SMOKE_RESULT.md",
    `${pipeline}/state/migration-experiments/s16-forward-role-qualification-v3-envelope-transport-smoke/cycle-result.json`,
    `${pipeline}/tests/codex-transport-regression.test.ts`,
  ];
  assert.deepEqual([...IMP24D_MECHANICAL_CORRECTION_SOURCE_FILES], [...EXACT_CORRECTION_SOURCE_FILES]);
  assert.deepEqual(
    classifyImp24DPlannedCorrectionPaths([...requiredEvidenceAndTest, ...EXACT_CORRECTION_SOURCE_FILES]).sourceFiles,
    [...EXACT_CORRECTION_SOURCE_FILES],
  );
  for (const omitted of EXACT_CORRECTION_SOURCE_FILES) {
    assert.throws(
      () => classifyImp24DPlannedCorrectionPaths([
        ...requiredEvidenceAndTest,
        ...EXACT_CORRECTION_SOURCE_FILES.filter((path) => path !== omitted),
      ]),
      /requires the exact transport projection, live provenance verifier, correction guard/,
    );
  }

  const forbiddenCorrectionSources = [
    `${pipeline}/src/orchestrator/forwardTransportSmokeCampaignV3.ts`,
    `${pipeline}/src/orchestrator/forwardTransportSmokeEvidenceV3.ts`,
    `${pipeline}/src/orchestrator/codexProcessDiagnostics.ts`,
    `${pipeline}/src/orchestrator/codexAgent.ts`,
    `${pipeline}/src/exec/executionEnvelope.ts`,
  ];
  for (const forbidden of forbiddenCorrectionSources) {
    assert.throws(
      () => classifyImp24DPlannedCorrectionPaths([
        ...requiredEvidenceAndTest, ...EXACT_CORRECTION_SOURCE_FILES, forbidden,
      ]),
      (error: Error) => /exceeds the transport\/config allowlist/.test(error.message)
        && error.message.includes(forbidden),
      `${forbidden} must not be an IMP-24D correction source`,
    );
  }
});

test("IMP-24D bounded correction proof requires one direct child with failed evidence, source, test, and only exact remints", () => {
  const roots = mkTestRoots("imp24d-bounded-correction-proof");
  const root = roots.base;
  const git = (args: string[]): string => execFileSync("git", args, {
    cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
  }).trim();
  const write = (path: string, bytes = "fixture\n"): void => {
    mkdirSync(resolve(root, path, ".."), { recursive: true });
    writeFileSync(resolve(root, path), bytes);
  };
  const writeExactCorrectionSources = (): void => {
    for (const path of EXACT_CORRECTION_SOURCE_FILES) {
      write(path, readFileSync(resolve(REPOSITORY_ROOT, path), "utf8"));
    }
  };
  try {
    git(["init"]);
    git(["config", "user.name", "IMP-24D Fixture"]);
    git(["config", "user.email", "imp24d@example.invalid"]);
    write("baseline.txt");
    git(["add", "--all"]); git(["commit", "-m", "observability"]);
    const observability = git(["rev-parse", "HEAD"]);
    write("docs/v25/reports/IMP-24D_TRANSPORT_SMOKE_RESULT.json");
    write("docs/v25/reports/IMP-24D_TRANSPORT_SMOKE_RESULT.md");
    write("scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments/s16-forward-role-qualification-v3-envelope-transport-smoke/cycle-result.json");
    writeExactCorrectionSources();
    write("scripts/book/prompts/chapterflow-v24-author-pipeline/tests/codex-transport-regression.test.ts");
    write("scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments/contracts/imp24/forward-production-instrument-seal.json");
    git(["add", "--all"]); git(["commit", "-m", "bounded correction"]);
    const correction = git(["rev-parse", "HEAD"]);
    const proof = assertImp24DBoundedCorrectionCommit({
      repositoryRoot: root,
      observabilityImplementationCommit: observability,
      correctionCommit: correction,
    });
    assert.deepEqual(proof.sourceFiles, [...EXACT_CORRECTION_SOURCE_FILES]);
    assert.equal(proof.regressionTestFiles.length, 1);
    assert.equal(proof.deterministicRemintFiles.length, 1);

    git(["checkout", "-b", "tampered-verifier", observability]);
    writeExactCorrectionSources();
    write(`${PIPELINE_REL}/src/orchestrator/forwardRoleQualificationLiveV3.ts`,
      "arbitrary qualification behavior change\n");
    write("docs/v25/reports/IMP-24D_TRANSPORT_SMOKE_RESULT.json");
    write("docs/v25/reports/IMP-24D_TRANSPORT_SMOKE_RESULT.md");
    write(`${PIPELINE_REL}/state/migration-experiments/s16-forward-role-qualification-v3-envelope-transport-smoke/cycle-result.json`);
    write(`${PIPELINE_REL}/tests/codex-transport-regression.test.ts`);
    git(["add", "--all"]); git(["commit", "-m", "tampered verifier"]);
    const tamperedVerifier = git(["rev-parse", "HEAD"]);
    assert.throws(() => assertImp24DBoundedCorrectionCommit({
      repositoryRoot: root,
      observabilityImplementationCommit: observability,
      correctionCommit: tamperedVerifier,
    }), /behavior source differs from the audited transport\/provenance patch/);

    git(["checkout", "-b", "bad", observability]);
    write("scripts/book/prompts/chapterflow-v24-author-pipeline/src/bakeoff/migration/readerCorpusBuilder.ts", "semantic drift\n");
    writeExactCorrectionSources();
    write("scripts/book/prompts/chapterflow-v24-author-pipeline/tests/codex-transport-regression.test.ts");
    write("docs/v25/reports/IMP-24D_TRANSPORT_SMOKE_RESULT.json");
    write("docs/v25/reports/IMP-24D_TRANSPORT_SMOKE_RESULT.md");
    write("scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments/s16-forward-role-qualification-v3-envelope-transport-smoke/cycle-result.json");
    git(["add", "--all"]); git(["commit", "-m", "invalid correction"]);
    const invalid = git(["rev-parse", "HEAD"]);
    assert.throws(() => assertImp24DBoundedCorrectionCommit({
      repositoryRoot: root,
      observabilityImplementationCommit: observability,
      correctionCommit: invalid,
    }), /exceeds the transport\/config allowlist/);

    write("grandchild.txt");
    git(["add", "--all"]); git(["commit", "-m", "unauthorized second correction"]);
    const grandchild = git(["rev-parse", "HEAD"]);
    assert.throws(() => assertImp24DBoundedCorrectionCommit({
      repositoryRoot: root,
      observabilityImplementationCommit: observability,
      correctionCommit: grandchild,
    }), /single-parent direct correction commit/);

    git(["checkout", "-b", "missing-test", observability]);
    writeExactCorrectionSources();
    write("docs/v25/reports/IMP-24D_TRANSPORT_SMOKE_RESULT.json");
    write("docs/v25/reports/IMP-24D_TRANSPORT_SMOKE_RESULT.md");
    write("scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments/s16-forward-role-qualification-v3-envelope-transport-smoke/cycle-result.json");
    git(["add", "--all"]); git(["commit", "-m", "missing regression test"]);
    const missingTest = git(["rev-parse", "HEAD"]);
    assert.throws(() => assertImp24DBoundedCorrectionCommit({
      repositoryRoot: root,
      observabilityImplementationCommit: observability,
      correctionCommit: missingTest,
    }), /requires the exact transport projection, live provenance verifier, correction guard, and a regression test/);
  } finally {
    roots.dispose();
  }
});

test("IMP-24D diagnosis record is owned by the correction commit and semantic drift is refused before preflight/root", async () => {
  const roots = mkTestRoots("imp24d-correction-record-ownership");
  const root = roots.base;
  const git = (args: string[]): string => execFileSync("git", args, {
    cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
  }).trim();
  const write = (path: string, bytes = "fixture\n"): void => {
    mkdirSync(resolve(root, path, ".."), { recursive: true });
    writeFileSync(resolve(root, path), bytes);
  };
  const writeExactCorrectionSources = (): void => {
    for (const path of EXACT_CORRECTION_SOURCE_FILES) {
      write(path, readFileSync(resolve(REPOSITORY_ROOT, path), "utf8"));
    }
  };
  try {
    git(["init"]);
    git(["config", "user.name", "IMP-24D Fixture"]);
    git(["config", "user.email", "imp24d@example.invalid"]);
    write("baseline.txt");
    git(["add", "--all"]); git(["commit", "-m", "observability"]);
    const observability = git(["rev-parse", "HEAD"]);
    const base = failedCycle();
    const { cycleSha256: _oldCycle, ...cycleCore } = base;
    const cycle = {
      ...cycleCore,
      implementationCommit: observability,
    } as Omit<Imp24DTransportSmokeCycleV1, "cycleSha256"> & { cycleSha256: string };
    cycle.cycleSha256 = hashCanonical(cycleCore.implementationCommit === observability
      ? cycleCore : { ...cycleCore, implementationCommit: observability });
    // Rehash the actual committed-identity projection, not the original fixture.
    const { cycleSha256: _ignored, ...actualCycleCore } = cycle;
    cycle.cycleSha256 = hashCanonical(actualCycleCore);
    const originalFixture = preparedSmokeInput();
    const originalPlan = buildRoleQualificationPlanV3(originalFixture.prepared.input);
    const firstBinding = buildImp24DTransportSmokeInputBinding({
      executionId: IMP24D_TRANSPORT_SMOKE_EXECUTION_ID,
      input: originalFixture.prepared.input,
      freeze: originalPlan.freeze,
      schedule: originalPlan.schedule,
    });
    cycle.qualificationSemanticProjectionSha256 = firstBinding.qualificationSemanticProjectionSha256;
    const { cycleSha256: _preBindingHash, ...bindingCycleCore } = cycle;
    cycle.cycleSha256 = hashCanonical(bindingCycleCore);
    const changedFiles = [
      "docs/v25/reports/IMP-24D_TRANSPORT_SMOKE_RESULT.json",
      "docs/v25/reports/IMP-24D_TRANSPORT_SMOKE_RESULT.md",
      ...EXACT_CORRECTION_SOURCE_FILES,
      "scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments/s16-forward-role-qualification-v3-envelope-transport-smoke/cycle-result.json",
      "scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments/s16-forward-role-qualification-v3-envelope-transport-smoke/smoke-input-binding.json",
      "scripts/book/prompts/chapterflow-v24-author-pipeline/tests/codex-transport-regression.test.ts",
    ].sort();
    const record = buildImp24DTransportMechanicalCorrection({
      cycle,
      defectClass: "invalid_cli_argument",
      rationale: `The retained stderr identifies one invalid flag; Authorization: Bearer ${"s".repeat(80)}`,
      paths: {
        changedFiles,
        smokeEvidenceFiles: changedFiles.filter((path) => path.includes("TRANSPORT_SMOKE_RESULT")
          || path.includes("transport-smoke/cycle-result")),
        sourceFiles: [...EXACT_CORRECTION_SOURCE_FILES],
        regressionTestFiles: ["scripts/book/prompts/chapterflow-v24-author-pipeline/tests/codex-transport-regression.test.ts"],
        deterministicRemintFiles: [],
      },
    });
    assert.equal(record.rationale.includes("s".repeat(80)), false);
    assert.equal(record.failedProcessDiagnosticsSetSha256, cycle.processDiagnosticsSetSha256);
    assert.deepEqual(record.diagnostics.map((item) => item.processDiagnosticsSha256),
      cycle.calls.map((call) => call.processDiagnosticsSha256));
    const reportCore = {
      schema: "imp24d-transport-smoke-report-v1" as const,
      status: "FAIL" as const,
      observabilityImplementationCommit: observability,
      correctionCommit: null,
      effectiveImplementationCommit: observability,
      cycles: [cycle],
      mechanicalCorrection: record,
      finalCycle: 1 as const,
      totalCalls: 2 as const,
      modelCalls: 0,
      apiCalls: 0 as const,
      qualificationMetricsIncluded: false as const,
      qualificationArtifactsCreated: false as const,
    };
    const report = { ...reportCore, reportSha256: hashCanonical(reportCore) };
    validateImp24DTransportSmokeReport(report);
    write("docs/v25/reports/IMP-24D_TRANSPORT_SMOKE_RESULT.json", `${canonicalJson(report)}\n`);
    write("docs/v25/reports/IMP-24D_TRANSPORT_SMOKE_RESULT.md");
    write("scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments/s16-forward-role-qualification-v3-envelope-transport-smoke/cycle-result.json",
      `${canonicalJson(cycle)}\n`);
    write("scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments/s16-forward-role-qualification-v3-envelope-transport-smoke/smoke-input-binding.json",
      `${canonicalJson(firstBinding)}\n`);
    writeExactCorrectionSources();
    write("scripts/book/prompts/chapterflow-v24-author-pipeline/tests/codex-transport-regression.test.ts");
    git(["add", "--all"]); git(["commit", "-m", "bounded correction"]);
    const correction = git(["rev-parse", "HEAD"]);
    const owned = verifyImp24DTransportMechanicalCorrectionOwnership({
      repositoryRoot: root,
      correctionCommit: correction,
      retainedReportBytes: readFileSync(resolve(root, "docs/v25/reports/IMP-24D_TRANSPORT_SMOKE_RESULT.json")),
    });
    assert.equal(owned.record.correctionSha256, record.correctionSha256);
    assert.equal(owned.proof.correctionCommit, correction);
    assert.throws(() => verifyImp24DTransportMechanicalCorrectionOwnership({
      repositoryRoot: root,
      correctionCommit: correction,
      retainedReportBytes: Buffer.from("tampered\n"),
    }), /not owned byte-for-byte/);

    const driftedAvailability: CandidateAvailabilityV3 = structuredClone(originalFixture.input.candidateAvailability);
    driftedAvailability.entries[0] = {
      ...driftedAvailability.entries[0],
      status: "UNAVAILABLE",
      modelListed: false,
      reason: "fixture deterministic unavailable profile",
    };
    const { availabilitySha256: _oldAvailability, ...driftedAvailabilityCore } = driftedAvailability;
    driftedAvailability.availabilitySha256 = candidateAvailabilitySha256(driftedAvailabilityCore);
    const driftedInput = {
      ...originalFixture.input,
      candidateAvailability: driftedAvailability,
    };
    const driftedPrepared = prepareLiveRoleQualificationV3({
      repositoryRoot: REPOSITORY_ROOT,
      input: driftedInput,
    });
    let ciQueries = 0;
    let inputLoads = 0;
    let preflights = 0;
    let executors = 0;
    const r2Root = resolve(root,
      "scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments",
      IMP24D_TRANSPORT_SMOKE_R2_EXECUTION_ID);
    await assert.rejects(runImp24DTransportSmoke({
      executeLive: true,
      cycle: 2,
      expectedHeadSha: correction,
      workflowRunId: 25,
      repositoryRoot: root,
      loadInput: () => { inputLoads += 1; return driftedInput; },
      preflight: {},
    }, {
      collectImplementationCiGate: ({ expectedHeadSha, workflowRunId, verifiedAt }) => {
        ciQueries += 1;
        return smokeImplementationGate(expectedHeadSha, workflowRunId, verifiedAt);
      },
      prepare: () => driftedPrepared,
      verifyRetainedCycle: (() => ({ cycle, inputBinding: firstBinding, gate: {} })) as never,
      preflight: (async () => { preflights += 1; throw new Error("preflight crossed semantic barrier"); }) as never,
      createExecutor: (() => { executors += 1; throw new Error("executor crossed semantic barrier"); }) as never,
    }), /changed frozen semantics or either complete fixed call binding/);
    assert.equal(ciQueries, 1);
    assert.equal(inputLoads, 1);
    assert.equal(preflights, 0);
    assert.equal(executors, 0);
    assert.equal(existsSync(r2Root), false);
  } finally {
    roots.dispose();
  }
});

test("IMP-24D exec-root audit rejects unreferenced logs and nested symlinks", () => {
  const roots = mkTestRoots("imp24d-exec-root-audit");
  const phaseDir = resolve(roots.base, "live");
  const logsDir = resolve(phaseDir, "exec", "logs");
  try {
    mkdirSync(logsDir, { recursive: true });
    writeFileSync(resolve(logsDir, "unreferenced.json"), "{}\n");
    assert.throws(() => validateLiveExecEvidenceRootV3(phaseDir, new Set()),
      /not in exact bijection/);
    rmSync(resolve(logsDir, "unreferenced.json"));

    const sessionsDir = resolve(phaseDir, "exec", "sessions");
    const target = resolve(roots.base, "outside.txt");
    mkdirSync(sessionsDir, { recursive: true });
    writeFileSync(target, "outside\n");
    symlinkSync(target, resolve(sessionsDir, "nested-link"));
    assert.throws(() => validateLiveExecEvidenceRootV3(phaseDir, new Set()), /contains symlink/);
  } finally {
    roots.dispose();
  }
});

test("IMP-24D preflight failure terminalizes both fixed calls with complete metric-free diagnostics and no retained secret", async () => {
  const roots = mkTestRoots("imp24d-preflight-failure-smoke");
  const secret = `OPENAI_API_KEY=${"x".repeat(160)}`;
  const { input, prepared } = preparedSmokeInput();
  const campaignTimes = [
    "2026-07-14T12:00:00.000Z",
    "2026-07-14T12:00:01.000Z",
    "2026-07-14T12:00:04.000Z",
  ];
  let clockIndex = 0;
  try {
    const result = await runImp24DTransportSmoke({
      executeLive: true,
      cycle: 1,
      expectedHeadSha: HEAD,
      workflowRunId: 24,
      repositoryRoot: roots.base,
      loadInput: () => input,
      preflight: {},
    }, {
      clock: () => new Date(campaignTimes[Math.min(clockIndex++, campaignTimes.length - 1)]),
      collectImplementationCiGate: ({ expectedHeadSha, workflowRunId, verifiedAt }) =>
        smokeImplementationGate(expectedHeadSha, workflowRunId, verifiedAt),
      prepare: () => prepared,
      preflight: async () => { throw new Error(`preflight rejected ${secret}`); },
      createExecutor: (deps) => createLiveQualificationExecutorV3({
        ...deps,
        workspaceBaseDir: roots.workspacesRoot,
        clock: () => new Date("2026-07-14T12:00:02.000Z"),
      }),
    });
    assert.equal(result.code, 1);
    assert.equal(result.executed, true);
    assert.equal(result.modelCalls, 0);
    assert.equal(result.report?.status, "FAIL");
    assert.equal(result.cycleResult?.calls.length, 2);
    assert.ok(result.cycleResult?.calls.every((call) =>
      call.processDiagnosticsComplete
      && call.diagnostics.invocation === "NOT_INVOKED"
      && call.qualificationMetricsIncluded === false
      && call.passed === false));

    const stateRoot = resolve(roots.base,
      `scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments/${IMP24D_TRANSPORT_SMOKE_EXECUTION_ID}`);
    assert.equal(existsSync(resolve(stateRoot, "live", "exec")), false,
      "a shared preflight failure must not fabricate an exec root");
    for (const role of ["reader", "source"] as const) {
      const evaluationPath = resolve(
        stateRoot,
        "live",
        "attempts",
        `${IMP24D_TRANSPORT_SMOKE_EXECUTION_ID}-${role}-canary-a1`,
        "evaluation.json",
      );
      const evaluation = JSON.parse(readFileSync(evaluationPath, "utf8")) as Record<string, unknown>;
      assert.equal(evaluation.schema, IMP24D_TRANSPORT_SMOKE_EVALUATION_SCHEMA);
      assert.equal(evaluation.qualificationMetricsIncluded, false);
      assert.equal(evaluation.schemaValid, false);
      assert.equal("semanticCorrect" in evaluation, false);
      assert.equal("metricObservations" in evaluation, false);
      assert.equal("evaluation" in evaluation, false);
    }

    const assertNoSecret = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const path = resolve(dir, name);
        const stat = lstatSync(path);
        assert.equal(stat.isSymbolicLink(), false);
        if (stat.isDirectory()) assertNoSecret(path);
        else assert.equal(readFileSync(path, "utf8").includes(secret), false,
          `preflight credential leaked into ${path}`);
      }
    };
    assertNoSecret(stateRoot);
  } finally {
    roots.dispose();
  }
});

test("IMP-24D deep certified-call comparison rejects a self-rehashed replacement case/task/hash binding", () => {
  const entries = (["reader", "source", "quiz"] as const).flatMap((role) =>
    IMP24_ROLE_CANDIDATE_ORDER[role].map((profile, ordinal) => ({
      role,
      ordinal,
      ...profile,
      status: "AVAILABLE" as const,
      modelListed: true,
      visible: true,
      effortSupported: true,
      reason: "fixture exact visible model and effort",
    })));
  const availabilityCore = {
    schema: IMP24_ROLE_QUALIFICATION_AVAILABILITY_SCHEMA,
    experimentId: IMP24_ROLE_QUALIFICATION_EXECUTION_ID,
    source: "codex-local-models-cache" as const,
    sourceBytesSha256: SHA,
    sourceFetchedAt: "2026-07-14T12:00:00.000Z",
    policyBytesSha256: SHA,
    candidateOrderSha256: hashCanonical(IMP24_ROLE_CANDIDATE_ORDER),
    entries,
  };
  const { experimentId: _r2, ...candidateAvailability } = {
    ...availabilityCore,
    availabilitySha256: candidateAvailabilitySha256(availabilityCore),
  };
  const calls = (["reader", "source"] as const).map((role, index) => {
    const profile = IMP24_ROLE_CANDIDATE_ORDER[role][0];
    return {
      role,
      candidateOrdinal: 0,
      ...profile,
      sourceScheduleId: `v3-${role}-p1-canary-c01`,
      sourceScheduleOrdinal: index,
      caseId: `${role}-certified-c01`,
      sourceCaseSha256: SHA,
      goldSha256: SHA,
      schemaSha256: SHA,
      promptSourceSha256: SHA,
      evidenceEnvelopeSha256: SHA,
      evidenceEnvelopeBytesSha256: SHA,
      taskSha256: SHA,
    };
  }) as Imp24DTransportSmokeInputBindingV1["calls"];
  const core: Omit<Imp24DTransportSmokeInputBindingV1, "inputBindingSha256"> = {
    schema: IMP24D_TRANSPORT_SMOKE_INPUT_BINDING_SCHEMA,
    executionId: IMP24D_TRANSPORT_SMOKE_EXECUTION_ID,
    candidateAvailability,
    qualificationFreezeSha256: SHA,
    qualificationSemanticProjectionSha256: SHA,
    certificationSha256: SHA,
    productionInstrumentSealSha256: SHA,
    productionQualificationParitySha256: SHA,
    calls,
  };
  const certified = { ...core, inputBindingSha256: hashCanonical(core) };
  const tampered = structuredClone(certified);
  tampered.calls[0].caseId = "replacement-reader-case";
  tampered.calls[0].taskSha256 = "b".repeat(64);
  const { inputBindingSha256: _old, ...tamperedCore } = tampered;
  tampered.inputBindingSha256 = hashCanonical(tamperedCore);
  assert.throws(() => assertImp24DTransportSmokeInputBindingMatchesCertifiedPlan(tampered, certified),
    /not the exact certified first-reader\/first-source canary binding/);
});

test("IMP-24D fixed smoke CLI rejects timeout/profile/case overrides before any artifact or cache read", async () => {
  let loads = 0;
  let campaigns = 0;
  const originalError = console.error;
  console.error = () => undefined;
  try {
    const forbiddenFlags: Array<Record<string, string>> = [
      { "timeout-ms": "1000" },
      { profile: "gpt-5.6-sol@high" },
      { case: "replacement-case" },
    ];
    for (const forbidden of forbiddenFlags) {
      const code = await runMigrationBakeoffCli(["imp24-transport-smoke-v3"], {
        "execute-live": true,
        "head-sha": HEAD,
        "workflow-run-id": "24",
        "models-cache": "/must/not/be/read",
        ...forbidden,
      }, {
        imp24RoleQualificationV3: {
          loadArtifacts: () => { loads += 1; throw new Error("must not load"); },
          runTransportSmoke: async () => { campaigns += 1; throw new Error("must not run"); },
        },
      });
      assert.equal(code, 2);
    }
  } finally {
    console.error = originalError;
  }
  assert.equal(loads, 0);
  assert.equal(campaigns, 0);
});

test("IMP-24D cycle2 rejects a non-distinct correction before CI, cache, auth, root, or model work", async () => {
  const roots = mkTestRoots("imp24d-cycle2-barrier");
  let inputLoads = 0;
  let ciQueries = 0;
  let preflights = 0;
  try {
    const cycle = failedCycle();
    const cyclePath = resolve(roots.base,
      imp24DTransportSmokeCycleResultRelPath(IMP24D_TRANSPORT_SMOKE_EXECUTION_ID));
    mkdirSync(resolve(cyclePath, ".."), { recursive: true });
    writeFileSync(cyclePath, `${JSON.stringify(cycle)}\n`);
    await assert.rejects(runImp24DTransportSmoke({
      executeLive: true,
      cycle: 2,
      expectedHeadSha: cycle.implementationCommit,
      workflowRunId: 25,
      repositoryRoot: roots.base,
      loadInput: () => { inputLoads += 1; throw new Error("input crossed correction barrier"); },
      preflight: {},
    }, {
      collectImplementationCiGate: (() => { ciQueries += 1; throw new Error("CI crossed correction barrier"); }) as never,
      preflight: (async () => { preflights += 1; throw new Error("auth crossed correction barrier"); }) as never,
    }), /distinct implementation commit/);
    assert.equal(inputLoads, 0);
    assert.equal(ciQueries, 0);
    assert.equal(preflights, 0);
    assert.equal(existsSync(resolve(roots.base,
      "scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments/s16-forward-role-qualification-v3-envelope-transport-smoke-r2")), false);
  } finally {
    roots.dispose();
  }
});

test("IMP-24D retained smoke resume requires deep evidence verification before CI, cache, auth, or model work", async () => {
  const roots = mkTestRoots("imp24d-retained-smoke-deep-verify");
  let deepVerifications = 0;
  let inputLoads = 0;
  let ciQueries = 0;
  let preflights = 0;
  let executors = 0;
  try {
    const cycle = failedCycle();
    const cyclePath = resolve(roots.base,
      imp24DTransportSmokeCycleResultRelPath(IMP24D_TRANSPORT_SMOKE_EXECUTION_ID));
    mkdirSync(resolve(cyclePath, ".."), { recursive: true });
    writeFileSync(cyclePath, `${JSON.stringify(cycle)}\n`);
    await assert.rejects(runImp24DTransportSmoke({
      executeLive: true,
      cycle: 1,
      expectedHeadSha: cycle.implementationCommit,
      workflowRunId: 24,
      repositoryRoot: roots.base,
      loadInput: () => { inputLoads += 1; throw new Error("input crossed retained-evidence barrier"); },
      preflight: {},
    }, {
      verifyRetainedCycle: (() => {
        deepVerifications += 1;
        throw new Error("missing process-diagnostics.json");
      }) as never,
      collectImplementationCiGate: (() => { ciQueries += 1; throw new Error("CI crossed retained-evidence barrier"); }) as never,
      preflight: (async () => { preflights += 1; throw new Error("auth crossed retained-evidence barrier"); }) as never,
      createExecutor: (() => { executors += 1; throw new Error("executor crossed retained-evidence barrier"); }) as never,
    }), /missing process-diagnostics\.json/);
    assert.equal(deepVerifications, 1);
    assert.equal(inputLoads, 0);
    assert.equal(ciQueries, 0);
    assert.equal(preflights, 0);
    assert.equal(executors, 0);
  } finally {
    roots.dispose();
  }
});

test("IMP-24D r2 campaign refuses before input load or successor-root creation when retained smoke PASS is absent", async () => {
  const roots = mkTestRoots("imp24d-r2-smoke-gate");
  let inputLoads = 0;
  const experimentDir = resolve(roots.base,
    "scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments",
    IMP24_ROLE_QUALIFICATION_EXECUTION_ID);
  try {
    await assert.rejects(runImp24RoleQualificationCampaignV3({
      executeLive: true,
      expectedHeadSha: HEAD,
      workflowRunId: 24,
      repositoryRoot: roots.base,
      experimentDir,
      loadInput: () => { inputLoads += 1; throw new Error("input crossed smoke barrier"); },
      preflight: {},
    }), /transport-smoke PASS report is missing/);
    assert.equal(inputLoads, 0);
    assert.equal(existsSync(experimentDir), false);
  } finally {
    roots.dispose();
  }
});
