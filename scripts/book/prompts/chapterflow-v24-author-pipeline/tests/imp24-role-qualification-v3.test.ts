import assert from "node:assert/strict";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { hashCanonical, sha256Hex } from "../src/contracts/contractUtil.js";
import {
  buildForwardProductionInstrumentSeal,
  computeForwardProductionInstrumentSealSha256,
  type ForwardProductionInstrumentSealV1,
} from "../src/orchestrator/forwardProductionInstrumentSeal.js";
import { resolveExecutionProfile } from "../src/exec/executionEnvelope.js";
import { ROUTE_POLICY_VERSION } from "../src/orchestrator/modelPolicy.js";
import {
  buildForwardRoleAssignmentFreezeV3,
  validateForwardRoleAssignmentFreezeV3,
  type BuildForwardRoleAssignmentFreezeV3Input,
  type ForwardRoleAssignmentFreezeV3,
  type ForwardRoleSlotV3,
} from "../src/orchestrator/forwardRoleAssignmentFreezeV3.js";
import {
  assertForwardV3QualificationProofFresh,
  buildForwardV3QualificationProof,
  preflightForwardLiveCampaignV3,
  FORWARD_LIVE_CAMPAIGN_PREFLIGHT_V3_SCHEMA,
  type ForwardNoApiChatgptRouteProofV3,
} from "../src/orchestrator/forwardLiveValidationDriver.js";
import {
  FORWARD_INPUT_FREEZE_SCHEMA,
  FORWARD_INPUT_SELECTION_POLICY,
  type ForwardInputFreezeV1,
} from "../src/orchestrator/forwardInputFreeze.js";
import {
  FORWARD_CHAPTER_STRATA,
  PILOT_ENVELOPE_EXPERIMENT_ID,
  buildPilotManifest,
  buildPilotManifestV2Envelope,
  type ForwardBookSelectionCandidateV1,
  type ForwardChapterStratum,
  type ForwardSourceCoordinateV1,
} from "../src/orchestrator/forwardValidationCampaign.js";
import {
  IMP24_CORPUS_EXPECTED_COUNTS,
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
  buildQualificationExecutionRequestV3,
  buildRoleQualificationPlanV3,
  candidateAvailabilitySha256,
  instrumentCertificationBindingSha256,
  qualificationReceiptSha256,
  runRoleQualificationV3,
  type CandidateAvailabilityEntryV3,
  type CandidateAvailabilityV3,
  type InstrumentCertificationBindingV3,
  type QualificationExecutionReceiptV3,
  type QualificationExecutionRequestV3,
  type QualificationReceiptStatusV3,
  type RunRoleQualificationInputV3,
} from "../src/bakeoff/migration/roleQualificationRunnerV3.js";
import { createLiveQualificationExecutorV3 } from "../src/orchestrator/forwardRoleQualificationLiveV3.js";
import { PIPELINE_DIR } from "../src/bakeoff/paths.js";
import { test } from "./harness.js";
import { mkTestRoots } from "./testRoots.js";

const REPOSITORY_ROOT = resolve(PIPELINE_DIR, "../../../..");
const CONTRACTS_DIR = resolve(PIPELINE_DIR, "state", "migration-experiments", "contracts");
const ROLES = ["reader", "source", "quiz"] as const;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function testSeal(): ForwardProductionInstrumentSealV1 {
  const core: Omit<ForwardProductionInstrumentSealV1, "sealSha256"> = {
    schema: "forward-production-instrument-seal-v1",
    version: 1,
    inventoryPolicy: "all-pipeline-src-config-live-schemas-runtime-lock-plus-fixed-gold-assets-v2",
    files: [],
    capabilities: { publish: false, promote: false, deploy: false, upload: false, api: false },
  };
  return { ...core, sealSha256: computeForwardProductionInstrumentSealSha256(core) };
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
      reason: "test-local exact visible model and effort",
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

function buildBaseInput(): RunRoleQualificationInputV3 {
  const corpusBundle = buildImp24CorpusBundle(loadImp24FrozenV2Inputs(CONTRACTS_DIR));
  const corpusCertification = certifyImp24Corpora(corpusBundle);
  const prepared = prepareImp24QualificationCases({ repositoryRoot: REPOSITORY_ROOT, corpusBundle });
  const productionInstrumentSeal = testSeal();
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
  return {
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
}

const BASE_INPUT = buildBaseInput();

function freshInput(): RunRoleQualificationInputV3 {
  return clone(BASE_INPUT);
}

function receipt(
  request: QualificationExecutionRequestV3,
  status: QualificationReceiptStatusV3,
  rawOutput: string | null,
): QualificationExecutionReceiptV3 {
  const core: Omit<QualificationExecutionReceiptV3, "receiptSha256"> = {
    schema: IMP24_ROLE_QUALIFICATION_RECEIPT_SCHEMA,
    executionId: `test-${request.attemptId}`,
    status,
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
    ...(status === "completed" ? {} : { failureDetail: `injected ${status}` }),
  };
  return { ...core, receiptSha256: qualificationReceiptSha256(core) };
}

function markUnavailable(
  input: RunRoleQualificationInputV3,
  predicate: (entry: CandidateAvailabilityEntryV3) => boolean,
): void {
  for (const entry of input.candidateAvailability.entries) {
    if (!predicate(entry)) continue;
    entry.status = "UNAVAILABLE";
    entry.modelListed = false;
    entry.visible = false;
    entry.effortSupported = false;
    entry.reason = "test-local unavailable";
  }
  const { availabilitySha256: _old, ...core } = input.candidateAvailability;
  input.candidateAvailability.availabilitySha256 = candidateAvailabilitySha256(core);
}

function retainOnly(input: RunRoleQualificationInputV3, role: "reader" | "source" | "quiz", ordinal: number): void {
  markUnavailable(input, (entry) => !(entry.role === role && entry.ordinal === ordinal));
}

test("IMP-24 V3 earns 2/2/1 roles from exact frozen gold while canary semantics stay outside the protocol gate", async () => {
  const input = freshInput();
  const kit = createImp24QualificationEvaluator(input.corpusBundle);
  assert.equal(Object.keys(kit.fixtureOutputByCaseId).length, 116);
  const result = await runRoleQualificationV3(input, {
    executor: async (request) => receipt(request, "completed", kit.fixtureOutputByCaseId[request.caseId]!),
    evaluateOutput: (args) => {
      const evaluated = kit.evaluateOutput(args);
      return args.request.partition === "canary" ? { ...evaluated, semanticCorrect: false } : evaluated;
    },
    qualifiedAt: () => "2026-07-13T12:00:00.000Z",
  });

  assert.equal(result.schedule.length, IMP24_BASE_MAXIMUM_CALLS);
  assert.equal(result.freeze.baseMaximumCalls, 464);
  assert.equal(result.freeze.hardMaximumCalls, IMP24_HARD_MAXIMUM_CALLS);
  assert.equal(result.baseCallsAttempted, 190);
  assert.equal(result.totalAttempts, 190);
  assert.equal(result.infrastructureReplays, 0);
  assert.equal(result.roleSetReady, true, result.roleSetBlockedReason ?? "");
  assert.deepEqual(Object.fromEntries(ROLES.map((role) => [role, result.qualifiers[role].length])), {
    reader: 2,
    source: 2,
    quiz: 1,
  });

  for (const role of ROLES) {
    const qualified = result.profileRoleResults.filter((item) => item.role === role && item.status === "QUALIFIED");
    assert.equal(qualified.length, role === "quiz" ? 1 : 2);
    for (const item of qualified) {
      assert.equal(item.canaryCaseCount, 2);
      assert.equal(item.canaryProtocolPassed, true);
      assert.equal(item.canarySemanticCorrectCount, 0, "semantic canary failure must not become protocol failure");
      assert.equal(item.holdoutCaseCount, IMP24_CORPUS_EXPECTED_COUNTS[role].holdout);
      assert.equal(item.metrics?.denominators.schemaValidity, IMP24_CORPUS_EXPECTED_COUNTS[role].holdout,
        "canaries must not enter holdout metrics");
      assert.equal(item.metrics?.denominators.evidenceSpanValidity, IMP24_CORPUS_EXPECTED_COUNTS[role].holdout);
    }
  }

  const sourceLedgers = result.profileRoleResults
    .filter((item) => item.role === "source" && item.status === "QUALIFIED")
    .map((item) => item.metrics!);
  for (const ledger of sourceLedgers) {
    assert.equal(ledger.denominators.missingEvidenceInconclusive, 1,
      "the certified deterministic probe contributes exactly one observation");
    assert.equal(ledger.numerators.missingEvidenceInconclusive, 1);
    assert.equal(ledger.metrics.missingEvidenceInconclusive, 1);
  }
  assert.ok(result.profileRoleResults
    .filter((item) => item.status === "NOT_TESTED_SEQUENTIAL_STOP")
    .every((item) => item.attempts === 0 && item.holdoutCaseCount === 0));
  assert.ok(result.attempts.every((attempt) =>
    attempt.request.evidenceEnvelopeBytes === attempt.retainedEnvelopeBytes
      && attempt.request.evidenceEnvelopeBytesSha256 === attempt.retainedEnvelopeBytesSha256
      && attempt.receipt?.evidenceEnvelopeBytes === attempt.request.evidenceEnvelopeBytes));
});

test("IMP-24 V3 fatal retention latch bounds concurrency and prevents later base calls or replay", async () => {
  const input = freshInput();
  const kit = createImp24QualificationEvaluator(input.corpusBundle);
  const plan = buildRoleQualificationPlanV3(input);
  const readerHoldout = plan.schedule.filter((entry) => entry.role === "reader"
    && entry.candidateOrdinal === 0
    && entry.partition === "holdout");
  assert.ok(readerHoldout.length > 2);
  const firstHoldout = readerHoldout[0];
  const secondHoldout = readerHoldout[1];
  const requests: QualificationExecutionRequestV3[] = [];
  const retainedAttemptIds: string[] = [];

  await assert.rejects(runRoleQualificationV3(input, {
    executor: async (request) => {
      requests.push(request);
      if (request.scheduleId === secondHoldout.scheduleId) {
        // Keep the second worker genuinely in flight until the first worker's
        // retention callback trips the fatal latch. Its typed infrastructure
        // result would ordinarily request a2, which the latch must suppress.
        await new Promise<void>((resolvePromise) => setImmediate(resolvePromise));
        return receipt(request, "timeout", null);
      }
      return receipt(request, "completed", kit.fixtureOutputByCaseId[request.caseId]!);
    },
    evaluateOutput: kit.evaluateOutput,
    retainAttemptEvaluation: async (attempt) => {
      if (attempt.request.scheduleId === firstHoldout.scheduleId) {
        throw new Error("synthetic retained-evidence write failure");
      }
      retainedAttemptIds.push(attempt.request.attemptId);
    },
  }), /synthetic retained-evidence write failure/);

  assert.equal(requests.length, 4,
    "only two canaries and the two already-in-flight holdouts may reach the executor");
  assert.deepEqual(requests.map((request) => request.scheduleId), [
    ...plan.schedule.filter((entry) => entry.role === "reader"
      && entry.candidateOrdinal === 0
      && entry.partition === "canary").map((entry) => entry.scheduleId),
    firstHoldout.scheduleId,
    secondHoldout.scheduleId,
  ]);
  assert.ok(requests.every((request) => request.attemptNumber === 1),
    "the in-flight infrastructure failure must not replay after the fatal latch trips");
  assert.ok(retainedAttemptIds.includes(`${secondHoldout.scheduleId}-a1`),
    "the already-in-flight sibling must finish retaining its terminal evidence");
  await new Promise<void>((resolvePromise) => setImmediate(resolvePromise));
  assert.equal(requests.length, 4,
    "mapPool must settle its workers before rejecting, leaving no background worker to drain the holdout");
});

test("IMP-24 V3 retains policy/integrity failures before the fatal latch stops every later executor call", async () => {
  for (const fatalStatus of ["policy_failure", "integrity_failure"] as const) {
    const input = freshInput();
    retainOnly(input, "reader", 0);
    const kit = createImp24QualificationEvaluator(input.corpusBundle);
    const plan = buildRoleQualificationPlanV3(input);
    const readerCanaries = plan.schedule.filter((entry) => entry.role === "reader"
      && entry.candidateOrdinal === 0
      && entry.partition === "canary");
    assert.equal(readerCanaries.length, 2);
    const calls: QualificationExecutionRequestV3[] = [];
    const retained: string[] = [];

    await assert.rejects(runRoleQualificationV3(input, {
      executor: async (request) => {
        calls.push(request);
        if (request.scheduleId === readerCanaries[1].scheduleId) {
          await new Promise<void>((resolvePromise) => setImmediate(resolvePromise));
          return receipt(request, "completed", kit.fixtureOutputByCaseId[request.caseId]!);
        }
        return receipt(request, fatalStatus, null);
      },
      evaluateOutput: kit.evaluateOutput,
      retainAttemptEvaluation: async (attempt) => {
        retained.push(attempt.request.attemptId);
      },
    }), new RegExp(`campaign-fatal ${fatalStatus} receipt`));

    assert.deepEqual(calls.map((request) => request.scheduleId), readerCanaries.map((entry) => entry.scheduleId),
      `${fatalStatus} may drain only the canary sibling already in flight`);
    assert.deepEqual(retained.sort(), readerCanaries.map((entry) => `${entry.scheduleId}-a1`).sort(),
      `${fatalStatus} and its in-flight sibling must both retain terminal attempt evidence`);
    assert.ok(calls.every((request) => request.attemptNumber === 1),
      `${fatalStatus} must prevent replay and every later holdout/profile call`);
    await new Promise<void>((resolvePromise) => setImmediate(resolvePromise));
    assert.equal(calls.length, 2, `${fatalStatus} must leave no background worker draining calls`);
  }
});

test("IMP-24 V3 whole-phase resume audit stops a partial canary before its fresh concurrent sibling can spawn", async () => {
  const roots = mkTestRoots("imp24-v3-zero-call-resume-barrier");
  try {
    const input = freshInput();
    const kit = createImp24QualificationEvaluator(input.corpusBundle);
    const plan = buildRoleQualificationPlanV3(input);
    const canaryBatch = plan.schedule.filter((entry) => entry.role === "reader"
      && entry.candidateOrdinal === 0
      && entry.partition === "canary");
    assert.equal(canaryBatch.length, 2, "the regression requires the exact two-worker canary batch");
    const firstEntry = canaryBatch[0];
    const freshSibling = canaryBatch[1];
    const prepared = input.preparedCases.reader.canary[firstEntry.caseOrdinal];
    const candidate = IMP24_ROLE_CANDIDATE_ORDER.reader[firstEntry.candidateOrdinal];
    const partialRequest = buildQualificationExecutionRequestV3(
      firstEntry,
      prepared,
      candidate,
      plan.freeze,
      1,
      null,
    );
    const phaseDir = resolve(roots.base, "live");
    let spawnCalls = 0;
    const live = createLiveQualificationExecutorV3({
      phaseDir,
      freezeSha256: plan.freeze.freezeSha256,
      certificationSha256: plan.freeze.certificationSha256,
      productionInstrumentSealSha256: plan.freeze.productionInstrumentSealSha256,
      preCallVerifier: () => undefined,
      workspaceBaseDir: roots.workspacesRoot,
      spawn: async (options) => {
        spawnCalls += 1;
        return {
          ok: true,
          exitCode: 0,
          finalMessage: "{}",
          stdout: "{}",
          stderr: "",
          durationMs: 1,
          sessionId: options.sessionId,
          finalMessageSource: "output-file",
        };
      },
    });
    live.auditResume({
      input,
      freeze: plan.freeze,
      schedule: plan.schedule,
      evaluateOutput: kit.evaluateOutput,
    });
    assert.equal(spawnCalls, 0, "a genuinely fresh empty phase must pass the model-free barrier at zero calls");
    const partialDir = resolve(phaseDir, "attempts", partialRequest.attemptId);
    mkdirSync(partialDir, { recursive: true });
    writeFileSync(resolve(partialDir, "request.json"), `${JSON.stringify(partialRequest, null, 2)}\n`);
    writeFileSync(resolve(partialDir, "evidence-envelope.json"), partialRequest.evidenceEnvelopeBytes);
    live.ledger.entries.push({
      attemptId: partialRequest.attemptId,
      scheduleId: partialRequest.scheduleId,
      requestSha256: partialRequest.requestSha256,
      evidenceEnvelopeSha256: partialRequest.evidenceEnvelopeSha256,
      evidenceEnvelopeBytesSha256: partialRequest.evidenceEnvelopeBytesSha256,
      receiptSha256: null,
      executionEvidenceSha256: null,
      evaluationArtifactSha256: null,
      status: "REQUESTED",
      cached: false,
      requestedAt: "2026-07-13T12:00:00.000Z",
      completedAt: null,
    });
    live.ledger.brokerRequests = 1;
    writeFileSync(live.ledgerPath, `${JSON.stringify(live.ledger, null, 2)}\n`);

    await assert.rejects((async () => {
      live.auditResume({
        input,
        freeze: plan.freeze,
        schedule: plan.schedule,
        evaluateOutput: kit.evaluateOutput,
      });
      return runRoleQualificationV3(input, {
        executor: live.executor,
        evaluateOutput: kit.evaluateOutput,
        retainAttemptEvaluation: live.retainAttemptEvaluation,
      });
    })(), /resume audit requires exact five-file evidence/);
    assert.equal(spawnCalls, 0,
      "the fresh sibling must never race ahead of a partial retained attempt in the same mapPool batch");
    assert.equal(existsSync(resolve(phaseDir, "attempts", `${freshSibling.scheduleId}-a1`)), false);
    assert.equal(live.ledger.codexExecInvocations, 0);
    assert.equal(live.ledger.brokerRequests, 1,
      "the retained REQUESTED marker remains untouched; the barrier adds no broker request");
  } finally {
    roots.dispose();
  }
});

test("IMP-24 V3 isolates protocol failure, skips unavailable candidates at zero calls, and preserves frozen order", async () => {
  const input = freshInput();
  markUnavailable(input, (entry) => entry.role === "source" && entry.ordinal === 0);
  const kit = createImp24QualificationEvaluator(input.corpusBundle);
  const seen: QualificationExecutionRequestV3[] = [];
  const failedReader = IMP24_ROLE_CANDIDATE_ORDER.reader[0].profileId;
  const unavailableSource = IMP24_ROLE_CANDIDATE_ORDER.source[0].profileId;
  const result = await runRoleQualificationV3(input, {
    executor: async (request) => {
      seen.push(request);
      return receipt(request, "completed", kit.fixtureOutputByCaseId[request.caseId]!);
    },
    evaluateOutput: (args) => {
      const evaluated = kit.evaluateOutput(args);
      return args.request.role === "reader" && args.request.profileId === failedReader && args.request.partition === "canary"
        ? { ...evaluated, authorityCompliant: false }
        : evaluated;
    },
    qualifiedAt: () => "2026-07-13T12:00:00.000Z",
  });

  const failed = result.profileRoleResults.find((item) => item.role === "reader" && item.profile.profileId === failedReader)!;
  assert.equal(failed.status, "NOT_QUALIFIED_PROTOCOL");
  assert.equal(failed.canaryCaseCount, 2);
  assert.equal(failed.holdoutStarted, false);
  assert.equal(failed.attempts, 2);
  assert.equal(result.roleSetReady, true);
  assert.deepEqual(result.qualifiers.reader, [
    IMP24_ROLE_CANDIDATE_ORDER.reader[1].profileId,
    IMP24_ROLE_CANDIDATE_ORDER.reader[2].profileId,
  ]);
  assert.deepEqual(result.qualifiers.source, [
    IMP24_ROLE_CANDIDATE_ORDER.source[1].profileId,
    IMP24_ROLE_CANDIDATE_ORDER.source[2].profileId,
  ]);
  assert.equal(seen.filter((request) => request.role === "source" && request.profileId === unavailableSource).length, 0);
  const unavailable = result.profileRoleResults.find((item) => item.role === "source" && item.profile.profileId === unavailableSource)!;
  assert.equal(unavailable.status, "UNAVAILABLE");
  assert.equal(unavailable.attempts, 0);
});

test("IMP-24 V3 permits one explicit infrastructure replay and never replays malformed content", async () => {
  const replayInput = freshInput();
  retainOnly(replayInput, "reader", 0);
  const replayKit = createImp24QualificationEvaluator(replayInput.corpusBundle);
  let injectedInfrastructure = false;
  const replayed = await runRoleQualificationV3(replayInput, {
    executor: async (request) => {
      if (!injectedInfrastructure && request.attemptNumber === 1) {
        injectedInfrastructure = true;
        return receipt(request, "provider_capacity", null);
      }
      return receipt(request, "completed", replayKit.fixtureOutputByCaseId[request.caseId]!);
    },
    evaluateOutput: replayKit.evaluateOutput,
    qualifiedAt: () => "2026-07-13T12:00:00.000Z",
  });
  assert.equal(replayed.baseCallsAttempted, 32);
  assert.equal(replayed.infrastructureReplays, 1);
  assert.equal(replayed.totalAttempts, 33);
  const replayScheduleId = replayed.attempts.find((attempt) => attempt.request.attemptNumber === 2)!.request.scheduleId;
  assert.deepEqual(replayed.attempts
    .filter((attempt) => attempt.request.scheduleId === replayScheduleId)
    .map((attempt) => attempt.request.attemptNumber), [1, 2]);

  const malformedInput = freshInput();
  retainOnly(malformedInput, "reader", 0);
  const malformedKit = createImp24QualificationEvaluator(malformedInput.corpusBundle);
  let first = true;
  const malformed = await runRoleQualificationV3(malformedInput, {
    executor: async (request) => {
      const raw = first ? "{}" : malformedKit.fixtureOutputByCaseId[request.caseId]!;
      first = false;
      return receipt(request, "completed", raw);
    },
    evaluateOutput: malformedKit.evaluateOutput,
    qualifiedAt: () => "2026-07-13T12:00:00.000Z",
  });
  assert.equal(malformed.baseCallsAttempted, 2);
  assert.equal(malformed.totalAttempts, 2);
  assert.equal(malformed.infrastructureReplays, 0);
  assert.equal(malformed.profileRoleResults.find((item) => item.role === "reader" && item.candidateOrdinal === 0)?.status,
    "NOT_QUALIFIED_PROTOCOL");
});

test("IMP-24 V3 fails closed on weakened thresholds and post-first-call gold drift", async () => {
  const weakened = freshInput();
  weakened.thresholds.reader.cleanControlPassRate.minRate = 0.5;
  assert.throws(() => buildRoleQualificationPlanV3(weakened), /thresholds changed or were weakened/);

  const drifted = freshInput();
  retainOnly(drifted, "reader", 0);
  const kit = createImp24QualificationEvaluator(drifted.corpusBundle);
  let calls = 0;
  await assert.rejects(
    runRoleQualificationV3(drifted, {
      executor: async (request) => {
        calls += 1;
        if (calls === 1) {
          const expected = drifted.corpusBundle.reader.holdout.cases[0].expected as unknown as Record<string, unknown>;
          expected.expectedRecommendation = expected.expectedRecommendation === "SHIP" ? "BLOCK" : "SHIP";
        }
        return receipt(request, "completed", kit.fixtureOutputByCaseId[request.caseId]!);
      },
      evaluateOutput: kit.evaluateOutput,
    }),
    /corpus gold\/case contents changed after freeze/,
  );
  assert.ok(calls >= 1 && calls <= 2, "drift must stop before any holdout or later profile");
});

type RoleFreezeFixture = {
  current: BuildForwardRoleAssignmentFreezeV3Input;
  freeze: ForwardRoleAssignmentFreezeV3;
};

let roleFreezeFixturePromise: Promise<RoleFreezeFixture> | null = null;

async function buildRoleFreezeFixture(): Promise<RoleFreezeFixture> {
  if (roleFreezeFixturePromise) return roleFreezeFixturePromise;
  roleFreezeFixturePromise = (async () => {
    const input = freshInput();
    const productionInstrumentSeal = clone(buildForwardProductionInstrumentSeal({ repositoryRoot: REPOSITORY_ROOT }));
    input.productionInstrumentSeal = productionInstrumentSeal;
    const { certificationSha256: _old, ...oldCertificationCore } = input.certification;
    const certificationCore: Omit<InstrumentCertificationBindingV3, "certificationSha256"> = {
      ...oldCertificationCore,
      productionInstrumentSealSha256: productionInstrumentSeal.sealSha256,
    };
    input.certification = {
      ...certificationCore,
      certificationSha256: instrumentCertificationBindingSha256(certificationCore),
    };
    const kit = createImp24QualificationEvaluator(input.corpusBundle);
    const result = await runRoleQualificationV3(input, {
      executor: async (request) => receipt(request, "completed", kit.fixtureOutputByCaseId[request.caseId]!),
      evaluateOutput: kit.evaluateOutput,
      qualifiedAt: () => "2026-07-13T12:00:00.000Z",
    });
    assert.equal(result.roleSetReady, true, result.roleSetBlockedReason ?? "");
    const current: BuildForwardRoleAssignmentFreezeV3Input = {
      result,
      certification: input.certification,
      corpusBundle: input.corpusBundle,
      schemaHashes: input.schemaHashes,
      promptSourceHashes: input.promptSourceHashes,
      routeBinding: {
        executionRoute: "codex_exec_chatgpt_subscription",
        authMode: "chatgpt",
        apiKeyPresent: false,
        apiFallbackAllowed: false,
        directHttpOrSdkAllowed: false,
        executionProfileHash: resolveExecutionProfile("chapter-reviewer").profileHash,
        routePolicyVersion: ROUTE_POLICY_VERSION,
      },
      productionInstrumentSeal,
      repositoryRoot: REPOSITORY_ROOT,
    };
    const freeze = buildForwardRoleAssignmentFreezeV3(current) as ForwardRoleAssignmentFreezeV3;
    return { current, freeze };
  })();
  return roleFreezeFixturePromise;
}

function rehashRoleFreeze(freeze: ForwardRoleAssignmentFreezeV3): void {
  const { freezeSha256: _old, ...core } = freeze;
  freeze.freezeSha256 = hashCanonical(core);
}

const SLOT_LANE: Record<ForwardRoleSlotV3, "reader" | "source" | "quiz"> = {
  readerPrimary: "reader",
  readerAudit: "reader",
  sourcePrimary: "source",
  sourceAdjudicator: "source",
  quizSemanticAdjudicator: "quiz",
};

function selectedProfileForSlot(
  result: RoleFreezeFixture["current"]["result"],
  slot: ForwardRoleSlotV3,
): string {
  if (slot === "readerPrimary") return result.selected.readerPrimary!;
  if (slot === "readerAudit") return result.selected.readerAudit!;
  if (slot === "sourcePrimary") return result.selected.sourcePrimary!;
  if (slot === "sourceAdjudicator") return result.selected.sourceAdjudicator!;
  return result.selected.quizSemanticAdjudicator!;
}

test("IMP-24 V3 role freeze binds role-ready 2/2/1 selection to exact independent canary and holdout evidence", async () => {
  const { current, freeze } = await buildRoleFreezeFixture();
  assert.equal(freeze.roleAssignment.readerPrimary.profileId, current.result.selected.readerPrimary);
  assert.equal(freeze.roleAssignment.readerBackup.profileId, current.result.selected.readerAudit);
  assert.equal(freeze.roleAssignment.sourcePrimary.profileId, current.result.selected.sourcePrimary);
  assert.equal(freeze.roleAssignment.sourceAdjudicator.profileId, current.result.selected.sourceAdjudicator);
  assert.equal(freeze.roleAssignment.quizAdjudicator.profileId, current.result.selected.quizSemanticAdjudicator);
  assert.notEqual(freeze.roleAssignment.readerPrimary.profileId, freeze.roleAssignment.readerBackup.profileId);
  assert.notEqual(freeze.roleAssignment.sourcePrimary.profileId, freeze.roleAssignment.sourceAdjudicator.profileId);
  assert.equal(freeze.reviewConfig.roleAssignmentSha256, freeze.roleAssignmentSha256);
  assert.equal(freeze.qualificationResultSha256, hashCanonical(current.result));
  assert.equal(freeze.productionQualificationParitySha256,
    current.certification.productionQualificationParitySha256);
  assert.equal(freeze.reviewConfig.productionQualificationParitySha256,
    freeze.productionQualificationParitySha256);

  for (const slot of Object.keys(freeze.roleProfileBindings) as ForwardRoleSlotV3[]) {
    const lane = SLOT_LANE[slot];
    const profileId = selectedProfileForSlot(current.result, slot);
    const binding = freeze.roleProfileBindings[slot];
    const canary = current.result.attempts.filter((attempt) => attempt.request.role === lane
      && attempt.request.profileId === profileId && attempt.request.partition === "canary");
    const holdout = current.result.attempts.filter((attempt) => attempt.request.role === lane
      && attempt.request.profileId === profileId && attempt.request.partition === "holdout");
    const roleResult = current.result.profileRoleResults.find((item) => item.role === lane && item.profile.profileId === profileId)!;
    assert.equal(new Set(canary.map((attempt) => attempt.request.scheduleId)).size, 2);
    assert.equal(new Set(holdout.map((attempt) => attempt.request.scheduleId)).size,
      IMP24_CORPUS_EXPECTED_COUNTS[lane].holdout);
    assert.equal(binding.canaryAttemptsSha256, hashCanonical(canary));
    assert.equal(binding.holdoutAttemptsSha256, hashCanonical(holdout));
    assert.equal(binding.profileRoleResultSha256, hashCanonical(roleResult));
    assert.equal(binding.promptSourceSha256, current.promptSourceHashes[lane]);
    assert.equal(binding.schemaSha256, current.schemaHashes[lane]);
    assert.equal(binding.qualificationResultSha256, freeze.qualificationResultSha256);
    assert.equal(binding.productionQualificationParitySha256,
      freeze.productionQualificationParitySha256);
  }
  validateForwardRoleAssignmentFreezeV3(freeze, current);
});

test("IMP-24 V3 role freeze rejects incomplete retained evidence and nested recomputed drift", async () => {
  const fixture = await buildRoleFreezeFixture();

  const incomplete = clone(fixture.current);
  const readerPrimary = incomplete.result.selected.readerPrimary!;
  const omitted = incomplete.result.attempts.find((attempt) => attempt.request.role === "reader"
    && attempt.request.profileId === readerPrimary && attempt.request.partition === "holdout")!;
  incomplete.result.attempts = incomplete.result.attempts.filter((attempt) => attempt !== omitted);
  assert.throws(() => buildForwardRoleAssignmentFreezeV3(incomplete), /holdout|attempt|coverage|evidence/i,
    "a profile result counter cannot substitute for the exact retained holdout");

  const corpusDrift = clone(fixture.current);
  const expected = corpusDrift.corpusBundle.reader.holdout.cases[0].expected as unknown as Record<string, unknown>;
  expected.expectedRecommendation = expected.expectedRecommendation === "SHIP" ? "BLOCK" : "SHIP";
  assert.throws(() => buildForwardRoleAssignmentFreezeV3(corpusDrift), /corpus|gold|snapshot|drift/i,
    "the retained corpus id cannot mask nested gold drift");

  const bindingDrift = clone(fixture.freeze);
  bindingDrift.roleProfileBindings.readerPrimary.holdoutAttemptsSha256 = "0".repeat(64);
  bindingDrift.roleProfileBindingsSha256 = hashCanonical(bindingDrift.roleProfileBindings);
  rehashRoleFreeze(bindingDrift);
  assert.throws(() => validateForwardRoleAssignmentFreezeV3(bindingDrift, fixture.current), /profile binding|holdout|qualification evidence|drift/i,
    "recomputed child and outer hashes must not bless a binding that differs from current qualification evidence");

  const configDrift = clone(fixture.freeze);
  const changedPromptHash = configDrift.reviewConfig.promptSourceHashes.reader === "9".repeat(64)
    ? "8".repeat(64)
    : "9".repeat(64);
  configDrift.reviewConfig.promptSourceHashes.reader = changedPromptHash;
  configDrift.reviewConfigSha256 = hashCanonical(configDrift.reviewConfig);
  rehashRoleFreeze(configDrift);
  assert.notEqual(hashCanonical(configDrift), hashCanonical(fixture.freeze));
  assert.notEqual(configDrift.reviewConfig.promptSourceHashes.reader, fixture.current.promptSourceHashes.reader);
  assert.throws(() => validateForwardRoleAssignmentFreezeV3(configDrift, fixture.current), /review config|prompt|drift|deterministic projection|differs/i,
    "recomputed child and outer hashes must not bless a conductor config that differs from the frozen top-level bindings");
});

test("IMP-24 V3 role freeze refuses a non-ready set and collapsed independent assignments", async () => {
  const fixture = await buildRoleFreezeFixture();
  const notReady = clone(fixture.current);
  notReady.result.roleSetReady = false;
  notReady.result.roleSetBlockedReason = "injected missing role";
  assert.throws(() => buildForwardRoleAssignmentFreezeV3(notReady), /role set is not ready/);

  const collapsed = clone(fixture.current);
  collapsed.result.selected.readerAudit = collapsed.result.selected.readerPrimary;
  assert.throws(() => buildForwardRoleAssignmentFreezeV3(collapsed), /reader primary and audit must be different/);
});

function campaignCoordinate(
  bookId: string,
  chapterNumber: number,
  stratum: ForwardChapterStratum,
): ForwardSourceCoordinateV1 {
  return {
    bookId,
    chapterNumber,
    chapterId: `${bookId}-ch${String(chapterNumber).padStart(2, "0")}`,
    stratum,
    sourceComplete: true,
    evidenceFresh: true,
    sourceUsePlanSha256: sha256Hex(`v3-plan-${bookId}-${chapterNumber}`),
    sourcePacketSha256: sha256Hex(`v3-packet-${bookId}-${chapterNumber}`),
    sidecarSha256: sha256Hex(`v3-sidecar-${bookId}-${chapterNumber}`),
    anchorCatalogSha256: sha256Hex(`v3-anchors-${bookId}-${chapterNumber}`),
    sourceArchiveId: `v3-archive-${bookId}`,
    riskSignals: [],
  };
}

function campaignBook(bookId: string, chapterCount = 4): ForwardBookSelectionCandidateV1 {
  return {
    bookId,
    sourceComplete: true,
    representativeTags: ["imp24-envelope-fixture"],
    chapters: Array.from({ length: chapterCount }, (_, index) => campaignCoordinate(
      bookId,
      index + 1,
      FORWARD_CHAPTER_STRATA[index % FORWARD_CHAPTER_STRATA.length],
    )),
  };
}

function v3CampaignFixture(fixture: RoleFreezeFixture) {
  const pilotBooks = [campaignBook("radical-candor"), campaignBook("start-with-why")];
  const gold = campaignBook("the-gifts-of-imperfection", 8);
  const qualificationBookIds = ["qualification-only"];
  const common = {
    frozenAtIso: "2026-07-13T12:00:00.000Z",
    roleAssignmentSha256: fixture.freeze.roleAssignmentSha256,
    instrumentManifestSha256: fixture.freeze.reviewConfig.instrumentManifestSha256,
    thresholdsSha256: fixture.freeze.reviewConfig.instrumentManifest.thresholdsSha256,
    inputMaterializationSha256: "a".repeat(64),
    productionInstrumentSealSha256: fixture.freeze.productionInstrumentSealSha256,
    qualificationBookIds,
  };
  const manifest = buildPilotManifestV2Envelope({
    ...common,
    books: pilotBooks,
    goldReservedBookIds: [gold.bookId],
  });
  const goldAssignment = gold.chapters.map((chapter) => ({
    bookId: chapter.bookId,
    chapterNumber: chapter.chapterNumber,
    chapterId: chapter.chapterId,
    stratum: chapter.stratum,
    sourcePacketSha256: chapter.sourcePacketSha256,
    sourceUsePlanSha256: chapter.sourceUsePlanSha256,
    sidecarSha256: chapter.sidecarSha256,
    anchorCatalogSha256: chapter.anchorCatalogSha256,
  }));
  const inputCore: Omit<ForwardInputFreezeV1, "freezeSha256"> = {
    schema: FORWARD_INPUT_FREEZE_SCHEMA,
    policyVersion: FORWARD_INPUT_SELECTION_POLICY,
    frozenAtIso: common.frozenAtIso,
    sets: {
      qualificationBookIds,
      pilotBookIds: pilotBooks.map((book) => book.bookId),
      goldBookIds: [gold.bookId],
    },
    pilot: pilotBooks,
    pilotInputHashes: Object.fromEntries(pilotBooks.map((book) => [book.bookId, hashCanonical(book)])),
    gold,
    goldInputHash: hashCanonical(gold),
    goldStratumAssignmentSha256: hashCanonical(goldAssignment),
    goldChapterCount: gold.chapters.length,
    goldCampaignHarnessCompatible: true,
    sourceFiles: [],
  };
  const inputFreeze = { ...inputCore, freezeSha256: hashCanonical(inputCore) };
  const qualification = buildForwardV3QualificationProof({
    currentQualification: fixture.current,
    roleFreeze: fixture.freeze,
  });
  const route: ForwardNoApiChatgptRouteProofV3 = {
    executionRoute: "codex_exec_chatgpt_subscription",
    authMode: "chatgpt",
    apiKeyPresent: false,
    apiFallbackAllowed: false,
    directHttpOrSdkAllowed: false,
    apiCallsMade: 0,
    forbiddenProviderEnvKeysPresent: [],
    maxParallel: 2,
    executionProfileHash: fixture.freeze.routeBinding.executionProfileHash,
    routePolicyVersion: fixture.freeze.routeBinding.routePolicyVersion,
  };
  return {
    manifest,
    inputFreeze,
    qualification,
    route,
    verifiedInputMaterializationSha256: common.inputMaterializationSha256,
    verifiedProductionInstrumentSealSha256: common.productionInstrumentSealSha256,
  };
}

test("IMP-24 V3 campaign proof/preflight accepts only the exact fresh envelope identities and no legacy attestation", async () => {
  const fixture = await buildRoleFreezeFixture();
  const campaign = v3CampaignFixture(fixture);
  const args = {
    ...campaign,
    roleFreeze: fixture.freeze,
    currentQualification: fixture.current,
  };
  const preflight = preflightForwardLiveCampaignV3(args);
  assert.equal(preflight.schema, FORWARD_LIVE_CAMPAIGN_PREFLIGHT_V3_SCHEMA);
  assert.equal(preflight.experimentId, PILOT_ENVELOPE_EXPERIMENT_ID);
  assert.equal(preflight.qualificationExperimentId, IMP24_ROLE_QUALIFICATION_ID);
  assert.equal(preflight.qualificationResultSha256, hashCanonical(fixture.current.result));
  assert.equal(preflight.instrumentCertificationSha256, fixture.current.certification.certificationSha256);
  assert.equal(preflight.corpusBundleSha256, fixture.current.certification.corpusBundleSha256);
  assert.equal(preflight.qualificationProofSha256, campaign.qualification.proofSha256);
  assert.equal(preflight.reviewProtocolVersion, "imp24-review-v2");
  assert.equal("qualificationBundleSha256" in preflight, false);
  assert.equal("calibrationSha256" in preflight, false);
  assert.equal("inspectionSha256" in preflight, false);
  const { preflightSha256, ...preflightCore } = preflight;
  assert.equal(preflightSha256, hashCanonical(preflightCore));

  const { proofSha256: _oldProof, ...retainedProofCore } = clone(campaign.qualification);
  const proofCore = { ...retainedProofCore, instrumentCertificationSha256: "0".repeat(64) };
  const tamperedProof = { ...proofCore, proofSha256: hashCanonical(proofCore) };
  assert.throws(() => assertForwardV3QualificationProofFresh({
    proof: tamperedProof,
    currentQualification: fixture.current,
    roleFreeze: fixture.freeze,
  }), /differs from the exact current result\/certificate\/freeze\/seal/,
  "recomputing a proof self-hash cannot substitute another certification identity");
  assert.throws(() => assertForwardV3QualificationProofFresh({
    proof: {
      schema: "forward-inspected-qualification-proof-v1",
      roleSetReady: true,
    } as never,
    currentQualification: fixture.current,
    roleFreeze: fixture.freeze,
  }), /wrong schema\/identity/,
  "closed V1/V2 qualification artifacts cannot reconstruct V3 freshness");

  const legacyManifest = buildPilotManifest({
    frozenAtIso: campaign.inputFreeze.frozenAtIso,
    roleAssignmentSha256: fixture.freeze.roleAssignmentSha256,
    instrumentManifestSha256: fixture.freeze.reviewConfig.instrumentManifestSha256,
    thresholdsSha256: fixture.freeze.reviewConfig.instrumentManifest.thresholdsSha256,
    inputMaterializationSha256: campaign.verifiedInputMaterializationSha256,
    productionInstrumentSealSha256: campaign.verifiedProductionInstrumentSealSha256,
    qualificationBookIds: campaign.inputFreeze.sets.qualificationBookIds,
    books: campaign.inputFreeze.pilot,
    goldReservedBookIds: campaign.inputFreeze.sets.goldBookIds,
  });
  assert.throws(() => preflightForwardLiveCampaignV3({ ...args, manifest: legacyManifest }),
    /exact fresh envelope experiment identity/,
  "the legacy pilot identity cannot retain new envelope evidence");
});
