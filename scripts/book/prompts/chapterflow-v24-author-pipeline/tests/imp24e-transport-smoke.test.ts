import assert from "node:assert/strict";
import { resolve } from "node:path";

import {
  loadImp24RoleQualificationCliArtifactsV3,
  runMigrationBakeoffCli,
} from "../src/bakeoff/migration/cli.js";
import { PIPELINE_DIR } from "../src/bakeoff/paths.js";
import {
  IMP24_ROLE_CANDIDATE_ORDER,
  IMP24_BASE_MAXIMUM_CALLS,
  IMP24_HARD_MAXIMUM_CALLS,
  IMP24_MAX_PARALLEL,
  IMP24_ROLE_QUALIFICATION_AVAILABILITY_SCHEMA,
  IMP24_ROLE_QUALIFICATION_FREEZE_SCHEMA,
  buildFrozenRoleQualificationScheduleV3,
  candidateAvailabilityProvenanceSha256,
  candidateAvailabilitySemanticSha256,
  candidateAvailabilitySha256,
  type QualificationFreezeV3,
  type RunRoleQualificationInputV3,
} from "../src/bakeoff/migration/roleQualificationRunnerV3.js";
import {
  IMP24_ROLE_QUALIFICATION_EXECUTION_ID,
  certifyImp24Corpora,
} from "../src/bakeoff/migration/imp24Corpus.js";
import { hashCanonical } from "../src/contracts/contractUtil.js";
import { prepareImp24QualificationCases } from "../src/bakeoff/migration/imp24InstrumentCertification.js";
import {
  IMP24E_TRANSPORT_SMOKE_CYCLE_SCHEMA,
  IMP24E_TRANSPORT_SMOKE_EXECUTION_ID,
  IMP24E_TRANSPORT_SMOKE_R2_EXECUTION_ID,
  buildImp24ETransportSmokeBinding,
  buildImp24ETransportSmokeReport,
  imp24ETransportSmokeStateRootRelPath,
  validateImp24ETransportSmokeCycle,
  type Imp24ETransportSmokeCallV1,
  type Imp24ETransportSmokeCycleV1,
  type Imp24ETransportSmokeExecutionId,
} from "../src/orchestrator/imp24eTransportSmoke.js";
import { test } from "./harness.js";

const SHA = "a".repeat(64);
const HEAD_1 = "1".repeat(40);
const HEAD_2 = "2".repeat(40);
const REPOSITORY_ROOT = resolve(PIPELINE_DIR, "../../../..");

function preparedInput() {
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
      reasonCode: "AVAILABLE" as const,
      reason: "fixture visible model and effort",
    })));
  const availabilityCore = {
    schema: IMP24_ROLE_QUALIFICATION_AVAILABILITY_SCHEMA,
    experimentId: IMP24_ROLE_QUALIFICATION_EXECUTION_ID,
    source: "codex-local-models-cache" as const,
    sourceFile: "/fixture/models-cache.json",
    sourceBytesSha256: SHA,
    sourceFetchedAt: "2026-07-14T12:00:00.000Z",
    sourceQualifiedAt: "2026-07-14T12:00:01.000Z",
    sourceAgeSeconds: 1,
    cliVersion: "codex fixture",
    policyBytesSha256: SHA,
    candidateOrderSha256: hashCanonical(IMP24_ROLE_CANDIDATE_ORDER),
    entries,
  };
  const availabilityWithLegacyPlaceholder = {
    ...availabilityCore,
    availabilitySha256: SHA,
  };
  const splitAvailability = {
    ...availabilityCore,
    semanticSha256: candidateAvailabilitySemanticSha256(availabilityCore),
    provenanceSha256: candidateAvailabilityProvenanceSha256(availabilityWithLegacyPlaceholder),
  };
  const prepared = prepareImp24QualificationCases({
    repositoryRoot: REPOSITORY_ROOT,
    corpusBundle: artifacts.corpusBundle,
  });
  const input: RunRoleQualificationInputV3 = {
    experimentId: IMP24_ROLE_QUALIFICATION_EXECUTION_ID,
    corpusBundle: artifacts.corpusBundle,
    corpusCertification: certifyImp24Corpora(artifacts.corpusBundle),
    certification: artifacts.certification,
    productionInstrumentSeal: artifacts.productionInstrumentSeal,
    candidateAvailability: {
      ...splitAvailability,
      availabilitySha256: candidateAvailabilitySha256(splitAvailability),
    },
    thresholds: artifacts.thresholds,
    thresholdBytesSha256: artifacts.thresholdBytesSha256,
    schemaHashes: prepared.schemaHashes,
    promptSourceHashes: prepared.promptSourceHashes,
    preparedCases: prepared.preparedCases,
  };
  const schedule = buildFrozenRoleQualificationScheduleV3(prepared.preparedCases);
  const freezeCore: Omit<QualificationFreezeV3, "freezeSha256"> = {
    schema: IMP24_ROLE_QUALIFICATION_FREEZE_SCHEMA,
    experimentId: IMP24_ROLE_QUALIFICATION_EXECUTION_ID,
    candidateOrderSha256: hashCanonical(IMP24_ROLE_CANDIDATE_ORDER),
    candidateAvailabilitySha256: input.candidateAvailability.semanticSha256!,
    candidateAvailabilitySemanticSha256: input.candidateAvailability.semanticSha256!,
    candidateAvailabilitySnapshotSha256: SHA,
    corpusBundleSha256: artifacts.corpusBundle.substantiveBundleSha256,
    corpusSnapshotSha256: SHA,
    corpusCertificationSha256: SHA,
    certificationSha256: artifacts.certification.certificationSha256,
    certificationSnapshotSha256: SHA,
    productionInstrumentSealSha256: artifacts.productionInstrumentSeal.sealSha256,
    productionInstrumentSealSnapshotSha256: SHA,
    productionQualificationParitySha256: artifacts.certification.productionQualificationParitySha256,
    thresholdsSha256: SHA,
    thresholdBytesSha256: artifacts.thresholdBytesSha256,
    schemaHashesSha256: hashCanonical(prepared.schemaHashes),
    promptSourceHashesSha256: hashCanonical(prepared.promptSourceHashes),
    preparedCasesSha256: SHA,
    scheduleSha256: hashCanonical(schedule),
    maxParallel: IMP24_MAX_PARALLEL,
    baseMaximumCalls: IMP24_BASE_MAXIMUM_CALLS,
    hardMaximumCalls: IMP24_HARD_MAXIMUM_CALLS,
  };
  return {
    input,
    freeze: { ...freezeCore, freezeSha256: hashCanonical(freezeCore) },
    schedule,
  };
}

function smokeCall(
  role: "reader" | "source",
  executionId: Imp24ETransportSmokeExecutionId,
  passed: boolean,
): Imp24ETransportSmokeCallV1 {
  const smokeScheduleId = `${executionId}-${role}-canary`;
  const attemptId = `${smokeScheduleId}-a1`;
  return {
    role,
    sourceScheduleId: `v3-${role}-p1-canary-c01`,
    smokeScheduleId,
    attemptId,
    profileId: IMP24_ROLE_CANDIDATE_ORDER[role][0].profileId,
    model: IMP24_ROLE_CANDIDATE_ORDER[role][0].model,
    effort: IMP24_ROLE_CANDIDATE_ORDER[role][0].effort,
    requestSha256: SHA,
    receiptSha256: SHA,
    receiptStatus: passed ? "completed" : "invalid_output",
    processDiagnosticsRelPath:
      `${imp24ETransportSmokeStateRootRelPath(executionId)}/live/attempts/${attemptId}/process-diagnostics.json`,
    processDiagnosticsSha256: SHA,
    executionEvidenceSha256: SHA,
    evaluationArtifactSha256: SHA,
    requestedAt: "2026-07-14T12:00:02.000Z",
    completedAt: "2026-07-14T12:00:03.000Z",
    runnerBoundaryCrossed: true,
    chatgptAuthVerified: true,
    processDiagnosticsComplete: true,
    authoritativeOutputFileProduced: passed,
    schemaValidJson: passed,
    envelopeAndSidecarsBound: passed,
    qualificationMetricsIncluded: false,
    apiCalls: 0,
    passed,
    failureClassification: passed ? null : "invalid_output",
    failureDetail: passed ? null : "fixture process returned invalid structured output",
    diagnostics: {
      invocation: "RUNNER_RETURNED",
      classification: passed ? "completed" : "invalid_output",
      failureKind: passed ? null : "process_exit",
      errorName: passed ? null : "Error",
      errorMessage: passed ? null : "fixture invalid output",
      timedOut: false,
      exitCode: passed ? 0 : 1,
      stdoutBytes: 2,
      stdoutSha256: SHA,
      stderrBytes: passed ? 0 : 22,
      stderrSha256: SHA,
    },
  };
}

function smokeCycle(cycle: 1 | 2, status: "PASS" | "FAIL", head: string): Imp24ETransportSmokeCycleV1 {
  const executionId = cycle === 1
    ? IMP24E_TRANSPORT_SMOKE_EXECUTION_ID
    : IMP24E_TRANSPORT_SMOKE_R2_EXECUTION_ID;
  const passed = status === "PASS";
  const calls = [
    smokeCall("reader", executionId, passed),
    smokeCall("source", executionId, passed),
  ] as [Imp24ETransportSmokeCallV1, Imp24ETransportSmokeCallV1];
  const core: Omit<Imp24ETransportSmokeCycleV1, "cycleSha256"> = {
    schema: IMP24E_TRANSPORT_SMOKE_CYCLE_SCHEMA,
    cycle,
    executionId,
    stateRoot: imp24ETransportSmokeStateRootRelPath(executionId),
    implementationCommit: head,
    workflowRunId: cycle === 1 ? 25001 : 25002,
    implementationCiVerifiedAt: "2026-07-14T12:00:00.000Z",
    implementationCiGateSha256: SHA,
    schemaProbeCycleSha256: SHA,
    schemaProbeImplementationCommit: cycle === 1 ? HEAD_1 : head,
    inputBindingSha256: SHA,
    candidateAvailabilitySemanticSha256: SHA,
    candidateAvailabilityProvenanceSha256: cycle === 1 ? "b".repeat(64) : "c".repeat(64),
    preflightSha256: SHA,
    qualificationFreezeSha256: SHA,
    certificationSha256: SHA,
    productionInstrumentSealSha256: SHA,
    productionQualificationParitySha256: SHA,
    callLedgerSha256: SHA,
    calls,
    brokerRequests: 2,
    codexExecInvocations: 2,
    processDiagnosticsSetSha256: hashCanonical(calls.map((call) => call.processDiagnosticsSha256)),
    qualificationMetricsIncluded: false,
    qualificationArtifactsCreated: false,
    apiCalls: 0,
    status,
    startedAt: "2026-07-14T12:00:01.000Z",
    completedAt: "2026-07-14T12:00:04.000Z",
  };
  return { ...core, cycleSha256: hashCanonical(core) };
}

function rehashCycle(cycle: Imp24ETransportSmokeCycleV1): void {
  const { cycleSha256: _old, ...core } = cycle;
  cycle.cycleSha256 = hashCanonical(core);
}

test("IMP-24E smoke binding selects only the first frozen reader and source canary requests", () => {
  const prepared = preparedInput();
  const binding = buildImp24ETransportSmokeBinding({
    cycle: 1,
    input: prepared.input,
    freeze: prepared.freeze,
    schedule: prepared.schedule,
  });
  assert.equal(binding.executionId, IMP24E_TRANSPORT_SMOKE_EXECUTION_ID);
  assert.deepEqual(binding.calls.map((call) => call.role), ["reader", "source"]);
  assert.deepEqual(binding.calls.map((call) => call.candidateOrdinal), [0, 0]);
  assert.equal(binding.calls.every((call) => call.sourceScheduleOrdinal >= 0), true);
  assert.equal(binding.calls.every((call) => call.sourceScheduleId.includes("-canary-")), true);
  assert.equal(binding.calls.every((call) => call.caseId.length > 0 && call.taskSha256.length === 64), true);
});

test("IMP-24E smoke permits two fixed calls and one fresh-head repeat only", () => {
  const first = smokeCycle(1, "FAIL", HEAD_1);
  const second = smokeCycle(2, "PASS", HEAD_2);
  validateImp24ETransportSmokeCycle(first);
  validateImp24ETransportSmokeCycle(second);
  const report = buildImp24ETransportSmokeReport([first, second]);
  assert.equal(report.status, "PASS");
  assert.equal(report.totalBrokerRequests, 4);
  assert.equal(report.maximumCallsPerCycle, 2);
  assert.equal(report.maximumCycles, 2);
  assert.equal(report.maximumCallsAuthorized, 4);
  assert.equal(report.qualificationMetricsIncluded, false);
  assert.equal(report.qualificationArtifactsCreated, false);
  assert.equal(report.apiCalls, 0);

  const sameHead = smokeCycle(2, "PASS", HEAD_1);
  assert.throws(() => buildImp24ETransportSmokeReport([first, sameHead]),
    /repeat chronology drift/);
  const changedSemantics = smokeCycle(2, "PASS", HEAD_2);
  changedSemantics.candidateAvailabilitySemanticSha256 = "d".repeat(64);
  rehashCycle(changedSemantics);
  assert.throws(() => buildImp24ETransportSmokeReport([first, changedSemantics]),
    /repeat chronology drift/);
  const replayAfterPass = smokeCycle(1, "PASS", HEAD_1);
  assert.throws(() => buildImp24ETransportSmokeReport([replayAfterPass, second]),
    /repeat chronology drift/);
});

test("IMP-24E smoke cycle rejects role substitution and incomplete diagnostics", () => {
  const wrongRole = smokeCycle(1, "FAIL", HEAD_1);
  wrongRole.calls.reverse();
  rehashCycle(wrongRole);
  assert.throws(() => validateImp24ETransportSmokeCycle(wrongRole),
    /cycle identity\/count\/status drift/);

  const incomplete = smokeCycle(1, "FAIL", HEAD_1);
  incomplete.calls[0].processDiagnosticsComplete = false;
  incomplete.calls[0].processDiagnosticsSha256 = null;
  incomplete.processDiagnosticsSetSha256 = hashCanonical(
    incomplete.calls.map((call) => call.processDiagnosticsSha256),
  );
  rehashCycle(incomplete);
  assert.throws(() => validateImp24ETransportSmokeCycle(incomplete),
    /cycle identity\/count\/status drift/);
});

test("IMP-24E smoke CLI dry and override barriers precede the injected campaign", async () => {
  let touched = 0;
  let capturedCycle: number | null = null;
  const deps = {
    imp24RoleQualificationV3: {
      modelsCachePath: "/fixture/models-cache.json",
      runImp24ETransportSmoke: async (args: { cycle: 1 | 2 }) => {
        touched += 1;
        capturedCycle = args.cycle;
        return {
          code: 1 as const,
          executed: true,
          cycle: args.cycle,
          cycleResult: null,
          report: null,
          modelCalls: 0,
          apiCalls: 0 as const,
          message: "fixture",
        };
      },
    },
  };
  const originalError = console.error;
  const originalLog = console.log;
  console.error = () => undefined;
  console.log = () => undefined;
  try {
    assert.equal(await runMigrationBakeoffCli(["imp24e-transport-smoke"], {
      campaign: true, // WP-202: un-gate the quarantined subverb
      "head-sha": HEAD_1,
      "workflow-run-id": "25001",
    }, deps), 2);
    assert.equal(await runMigrationBakeoffCli(["imp24e-transport-smoke"], {
      campaign: true, // WP-202: un-gate the quarantined subverb
      "execute-live": true,
      "head-sha": HEAD_1,
      "workflow-run-id": "25001",
      timeout: "1",
    }, deps), 2);
    assert.equal(touched, 0);
    assert.equal(await runMigrationBakeoffCli(["imp24e-transport-smoke-r2"], {
      campaign: true, // WP-202: un-gate the quarantined subverb
      "execute-live": true,
      "head-sha": HEAD_2,
      "workflow-run-id": "25002",
    }, deps), 1);
  } finally {
    console.error = originalError;
    console.log = originalLog;
  }
  assert.equal(touched, 1);
  assert.equal(capturedCycle, 2);
});
