import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { test } from "./harness.js";
import { PIPELINE_DIR } from "../src/bakeoff/paths.js";
import { hashCanonical, sha256Hex } from "../src/contracts/contractUtil.js";
import { quizItemId } from "../src/review/quizDerivation.js";
import type { ReaderCorpusCaseV2 } from "../src/bakeoff/migration/readerCorpusBuilder.js";
import type { Imp22SourceCorpusCaseV2 } from "../src/bakeoff/migration/sourceCorpusBuilder.js";
import type { QuizCorpusCaseV2 } from "../src/bakeoff/migration/quizCorpusBuilder.js";
import type { SplitLaneRoleCorpusV2 } from "../src/bakeoff/migration/corpusBuilderCore.js";
import {
  type ReviewLaneRole,
} from "../src/bakeoff/migration/reviewLaneTypes.js";
import {
  ROLE_QUALIFICATION_RECEIPT_SCHEMA,
  assembleRoleQualificationCalibrationInspection,
  evaluateSourceMissingEvidenceProbeObservation,
  roleQualificationCandidateAvailabilityHash,
  runRoleCalibration,
  runRoleQualificationHoldout,
  type Imp22RoleThresholdsV1,
  type QualificationProfileV1,
  type QualificationReceiptStatus,
  type RoleQualificationCorporaV2,
  type RoleQualificationCandidateAvailabilityV1,
  type RoleQualificationCalibrationSealV1,
  type RoleQualificationExecutionReceiptV1,
  type RoleQualificationExecutionRequestV1,
  type RoleQualificationExecutor,
  type RunRoleQualificationInputV1,
} from "../src/bakeoff/migration/roleQualificationRunner.js";

const CONTRACTS = resolve(PIPELINE_DIR, "state", "migration-experiments", "contracts");
const CORPUS_PATHS = {
  reader: resolve(CONTRACTS, "reader-corpus.imp22-v2.json"),
  source: resolve(CONTRACTS, "source-corpus.imp22-v2.json"),
  quiz: resolve(CONTRACTS, "quiz-corpus.imp22-v2.json"),
} as const;

const EXPECTED_ENVELOPE_SHA256 = {
  reader: "efaf5a3d80cbf46bcae9511030fba8fc02fbcb4a055241ca867b8c0a1729ccbe",
  source: "0e3791580c0b2461622033e9369047f5752b7de70537e276af45794f4c2b6435",
  quiz: "9d59ac17cdc79df71eac763a78450f32faea4b535136cf8ef944c63d9d470c4b",
} as const;

const EXPECTED_SUBSTANTIVE_SHA256 = {
  reader: "sha256:5743b9acec5e71c6e536cd32cd9b518b75418eb34ac4f8a14073b5f82e531cc8",
  source: "sha256:f706bcf03e7d81bf2c435d52626f4e03632fa66e1b155c73b606b503ad4d0b91",
  quiz: "sha256:bc7a9ede537e85394d7a794d09a62462bbfda2684df8426072b8a38ac25aadad",
} as const;

const PROFILES = {
  reader: [
    { profileId: "reader-1@high", model: "reader-1", effort: "high" },
    { profileId: "reader-2@high", model: "reader-2", effort: "high" },
    { profileId: "reader-unused@xhigh", model: "reader-unused", effort: "xhigh" },
  ],
  source: [
    { profileId: "source-1@xhigh", model: "source-1", effort: "xhigh" },
    { profileId: "source-2@xhigh", model: "source-2", effort: "xhigh" },
    { profileId: "source-unused@high", model: "source-unused", effort: "high" },
  ],
  quiz: [
    { profileId: "quiz-1@xhigh", model: "quiz-1", effort: "xhigh" },
    { profileId: "quiz-unused@high", model: "quiz-unused", effort: "high" },
  ],
} satisfies Record<ReviewLaneRole, QualificationProfileV1[]>;

function threshold(minRate: number, minDenominator: number, zeroMiss: boolean) {
  return { minRate, minDenominator, zeroMiss };
}

function thresholds(): Imp22RoleThresholdsV1 {
  return {
    schema: "recovery-role-thresholds-v1",
    thresholdsVersion: "imp22-forward-role-thresholds-v1",
    reader: {
      schemaValidity: threshold(1, 30, true),
      hardBlockerSensitivity: threshold(1, 10, true),
      hardBlockerFalsePositiveFree: threshold(1, 10, true),
      cleanControlPassRate: threshold(0.9, 10, false),
      craftCalibrationAccuracy: threshold(0.8, 10, false),
      evidenceSpanValidity: threshold(0.95, 10, false),
      requiredCasesResolved: threshold(1, 30, true),
    },
    source: {
      schemaValidity: threshold(1, 40, true),
      fabricationSensitivity: threshold(1, 4, true),
      causalOverreachSensitivity: threshold(1, 4, true),
      sourceContradictionSensitivity: threshold(1, 2, true),
      highSeverityFalsePositiveFree: threshold(1, 20, true),
      cleanCasePassRate: threshold(0.9, 20, false),
      supportStatusAccuracy: threshold(0.9, 40, false),
      visibleRegisterAccuracy: threshold(0.9, 40, false),
      evidenceSpanValidity: threshold(1, 40, true),
      missingEvidenceInconclusive: threshold(1, 1, true),
      requiredCasesResolved: threshold(1, 40, true),
    },
    quiz: {
      schemaValidity: threshold(1, 40, true),
      wrongKeyDetection: threshold(1, 10, true),
      cleanUniquePassRate: threshold(0.9, 10, false),
      ambiguityDetection: threshold(0.9, 10, false),
      mechanismAccuracy: threshold(0.9, 10, false),
      evidenceSpanValidity: threshold(0.95, 10, false),
      requiredCasesResolved: threshold(1, 40, true),
    },
  };
}

let cachedInput: RunRoleQualificationInputV1 | null = null;

function loadInput(order = PROFILES): RunRoleQualificationInputV1 {
  if (!cachedInput) {
    const corpora = Object.fromEntries(Object.entries(CORPUS_PATHS).map(([role, path]) => [
      role,
      JSON.parse(readFileSync(path, "utf8")) as SplitLaneRoleCorpusV2<unknown>,
    ])) as RoleQualificationCorporaV2;
    cachedInput = {
      corpora,
      candidateOrder: PROFILES,
      thresholds: thresholds(),
      schemaHashes: {
        reader: "96be560b412f18eb33b67df3baf8f56b3ee466b0a706eb4ea89ab12250413fd3",
        source: "39a53ae139a90d05407d986f10b7d10517b2948178db431cb2c69edf0162e296",
        quiz: "c8fd66b5b6461d8fe72a1b2f34c3da261dd33b8814bebf80c7e0c8c2b1262365",
      },
    };
  }
  return order === PROFILES ? cachedInput : { ...cachedInput, candidateOrder: order };
}

function availabilityFor(
  input: RunRoleQualificationInputV1,
  unavailableProfileIds: ReadonlySet<string> = new Set(),
): RoleQualificationCandidateAvailabilityV1 {
  const discovered = (["reader", "source", "quiz"] as const).flatMap((role) => input.candidateOrder[role].map((profile, ordinal) => {
    const available = !unavailableProfileIds.has(profile.profileId);
    return {
      role,
      ordinal,
      profileId: profile.profileId,
      model: profile.model,
      effort: profile.effort,
      status: available ? "AVAILABLE" as const : "UNAVAILABLE" as const,
      modelListed: available,
      visible: available,
      effortSupported: available,
      requiredForCalibration: false,
      reason: available ? "test inventory advertises exact model and effort" : "test inventory omits exact model and effort",
    };
  }));
  const entries = discovered.map((entry) => ({
    ...entry,
    requiredForCalibration: entry.status === "AVAILABLE"
      && !discovered.some((prior) => prior.role === entry.role && prior.ordinal < entry.ordinal && prior.status === "AVAILABLE"),
  }));
  const draft: Omit<RoleQualificationCandidateAvailabilityV1, "availabilitySha256"> = {
    schema: "imp22-role-candidate-availability-v1",
    source: "codex-local-models-cache",
    sourceFile: "models_cache.json",
    sourceBytesSha256: "a".repeat(64),
    sourceFetchedAt: "2026-07-12T12:00:00.000Z",
    policyBytesSha256: "b".repeat(64),
    candidateOrderSha256: hashCanonical(input.candidateOrder),
    entries,
    calibrationCandidatesAvailable: (["reader", "source", "quiz"] as const).every((role) => entries.some((entry) => entry.role === role && entry.requiredForCalibration)),
  };
  return { ...draft, availabilitySha256: roleQualificationCandidateAvailabilityHash(draft) };
}

function inspected(calibration: RoleQualificationCalibrationSealV1) {
  return assembleRoleQualificationCalibrationInspection({
    calibration,
    confirmedCalibrationSha256: calibration.calibrationSha256,
    inspectedBy: "test-human-inspector",
    inspectedAt: "2026-07-12T13:00:00.000Z",
  });
}

type CaseMaps = {
  reader: Map<string, ReaderCorpusCaseV2>;
  source: Map<string, Imp22SourceCorpusCaseV2>;
  quiz: Map<string, QuizCorpusCaseV2>;
};

function caseMaps(input: RunRoleQualificationInputV1): CaseMaps {
  const mapRole = <T extends { caseId: string }>(corpus: SplitLaneRoleCorpusV2<T>): Map<string, T> => new Map(
    [...corpus.partitions.calibration.cases, ...corpus.partitions.holdout.cases].map((c) => [c.caseId, c]),
  );
  return {
    reader: mapRole(input.corpora.reader),
    source: mapRole(input.corpora.source),
    quiz: mapRole(input.corpora.quiz),
  };
}

function evidenceLine(document: string): string {
  const line = document.split("\n").find((candidate) => candidate.trim().length >= 12) ?? document.slice(0, 100);
  return line.slice(0, 180);
}

function readerRaw(request: RoleQualificationExecutionRequestV1, c: ReaderCorpusCaseV2): string {
  const span = evidenceLine(request.artifacts[0].content);
  const expected = c.expected as { expectedBlockingCategory?: string };
  const blocking = c.kind === "reader-visible-hard-blocker" ? [{
    category: expected.expectedBlockingCategory,
    unit: "chapter",
    problem: "frozen on-page blocker",
    evidenceSpans: [span],
  }] : [];
  const advisory = c.kind === "craft-nonblocker" ? [{
    category: "thin_example",
    unit: "chapter",
    problem: "frozen craft weakness",
    evidenceSpans: [span],
  }] : [];
  return JSON.stringify({
    schema: "reader-experience-review-v1",
    scores: {
      retention: 90, quizzes: 90, transfer: 90, practical: 90, summaries: 90,
      tone: 90, limits: 90, insight: 90, density: 90, beginner: 90,
    },
    quizDerivation: { answers: [], mechanisms: [], confidence: [], ambiguities: [], tells: [] },
    recommendation: c.kind === "clean" ? "SHIP" : c.kind === "craft-nonblocker" ? "REVISE" : "BLOCK",
    blockingFindings: blocking,
    escalationSignals: [],
    advisoryFindings: advisory,
    strongestEvidence: [span],
    weakestEvidence: [span],
    oneParagraphVerdict: "Canned qualification judgment.",
  });
}

function sourceRaw(c: Imp22SourceCorpusCaseV2): string {
  const sourceDocument = JSON.stringify({
    packet: c.evidence.sourcePacket,
    sidecar: c.evidence.sidecar,
    anchorCatalog: c.evidence.anchorCatalog,
  });
  const chapterSpan = c.evidence.goldChapterEvidenceSpans.find((span) => c.evidence.chapterUnit.includes(span))
    ?? c.evidence.chapterUnit.slice(0, 100);
  const sourceSpan = c.evidence.goldSourceEvidenceSpans.find((span) => sourceDocument.includes(span));
  const category = c.expected.expectedCategory;
  return JSON.stringify({
    schema: "source-integrity-review-v1",
    units: [{
      unitId: c.evidence.sourceUsePlanUnit.unitId,
      expectedOrigin: c.evidence.expectedOrigin,
      expectedForm: c.evidence.expectedForm,
      claimStrengthExpected: c.evidence.claimStrengthExpected,
      visibleRegister: c.expected.expectedVisibleRegister,
      supportStatus: c.expected.expectedSupportStatus,
      framingAdequate: c.expected.expectedFramingAdequate,
      claimStrengthFit: c.expected.expectedClaimStrengthFit,
      namedSpecificityAllowed: c.expected.expectedNamedSpecificityAllowed,
      chapterEvidenceSpans: [chapterSpan],
      sourceEvidenceSpans: sourceSpan ? [sourceSpan] : [],
      findings: category ? [{ category, severity: "blocker", explanation: "Frozen source defect." }] : [],
    }],
    result: c.expected.goldResult,
    blockingFindingIds: category ? [`${c.evidence.sourceUsePlanUnit.unitId}::${category}#0`] : [],
    rationale: "Canned qualification judgment.",
  });
}

function quizRaw(c: QuizCorpusCaseV2): string {
  const expected = c.expected as {
    defensibleAnswerIndices: number[];
    keyCorrect: "correct" | "ambiguous" | "wrong";
    keyedMechanismSupported: boolean;
  };
  const derivedAnswerIndex = expected.defensibleAnswerIndices[0];
  const keyedAnswerIndex = c.chapter.quiz.questions[0].correctIndex;
  return JSON.stringify({
    schema: "quiz-integrity-adjudication-v1",
    items: [{
      itemId: quizItemId(c.chapter, 0),
      keyedAnswerIndex,
      derivedAnswerIndex,
      agreement: keyedAnswerIndex === derivedAnswerIndex,
      keyCorrect: expected.keyCorrect,
      rationale: "Canned enum-bound adjudication.",
      defensibleAnswerIndices: expected.defensibleAnswerIndices,
      keyedMechanismSupported: expected.keyedMechanismSupported,
    }],
  });
}

function goodRaw(request: RoleQualificationExecutionRequestV1, maps: CaseMaps): string {
  if (request.role === "reader") return readerRaw(request, maps.reader.get(request.caseId)!);
  if (request.role === "source") return sourceRaw(maps.source.get(request.caseId)!);
  return quizRaw(maps.quiz.get(request.caseId)!);
}

type ExecutorOverride = {
  status?: QualificationReceiptStatus;
  rawOutput?: string | null;
  receiptPatch?: Partial<RoleQualificationExecutionReceiptV1>;
};

type ExecutorHook = (
  request: RoleQualificationExecutionRequestV1,
  rawOutput: string,
  maps: CaseMaps,
) => ExecutorOverride | undefined;

function cannedExecutor(input: RunRoleQualificationInputV1, hook?: ExecutorHook): {
  executor: RoleQualificationExecutor;
  requests: RoleQualificationExecutionRequestV1[];
  maxActive: () => number;
} {
  const maps = caseMaps(input);
  const requests: RoleQualificationExecutionRequestV1[] = [];
  let active = 0;
  let highWater = 0;
  const executor: RoleQualificationExecutor = async (request) => {
    requests.push(request);
    active += 1;
    highWater = Math.max(highWater, active);
    try {
      await new Promise<void>((resolveDone) => setImmediate(resolveDone));
      const raw = goodRaw(request, maps);
      const override = hook?.(request, raw, maps);
      const status = override?.status ?? "completed";
      const base: RoleQualificationExecutionReceiptV1 = {
        schema: ROLE_QUALIFICATION_RECEIPT_SCHEMA,
        executionId: `exec-${request.attemptId}`,
        status,
        role: request.role,
        profileId: request.profileId,
        model: request.model,
        effort: request.effort,
        schemaSha256: request.schemaSha256,
        rawOutput: override?.rawOutput !== undefined
          ? override.rawOutput
          : status === "completed" ? raw : null,
        failureDetail: status === "completed" ? undefined : `canned ${status}`,
      };
      return { ...base, ...override?.receiptPatch };
    } finally {
      active -= 1;
    }
  };
  return { executor, requests, maxActive: () => highWater };
}

function profileResult(
  results: Awaited<ReturnType<typeof runRoleQualificationHoldout>>,
  role: ReviewLaneRole,
  profileId: string,
) {
  const result = results.profileRoleResults.find((candidate) => candidate.role === role && candidate.profile.profileId === profileId);
  assert.ok(result, `missing ${role}/${profileId} result`);
  return result;
}

test("IMP-22 qualification has an explicit 24-call calibration seal, then exactly 180 holdout calls and freezes current envelopes", async () => {
  const input = loadInput();
  for (const role of ["reader", "source", "quiz"] as const) {
    const bytes = readFileSync(CORPUS_PATHS[role]);
    assert.equal(sha256Hex(bytes), EXPECTED_ENVELOPE_SHA256[role]);
    assert.equal(input.corpora[role].substantiveCorpusSha256, EXPECTED_SUBSTANTIVE_SHA256[role]);
  }

  const canned = cannedExecutor(input);
  const candidateAvailability = availabilityFor(input);
  const calibration = await runRoleCalibration(input, { executor: canned.executor, candidateAvailability });
  assert.equal(calibration.valid, true);
  assert.equal(calibration.schedule.length, 24);
  assert.equal(calibration.attempts.length, 24);
  assert.equal(canned.requests.length, 24);
  assert.ok(canned.requests.every((request) => request.partition === "calibration"), "phase 1 must expose no holdout request");
  assert.deepEqual(
    Object.fromEntries((["reader", "source", "quiz"] as const).map((role) => [role, canned.requests.filter((request) => request.role === role).length])),
    { reader: 6, source: 10, quiz: 8 },
  );
  assert.equal(calibration.sourceMissingEvidenceProbes.length, 1);
  assert.equal(calibration.sourceMissingEvidenceProbes[0].passed, true);
  assert.equal(calibration.sourceMissingEvidenceProbes[0].executorCalls, 0);

  const result = await runRoleQualificationHoldout(input, calibration, inspected(calibration), {
    executor: canned.executor,
    candidateAvailability,
    qualifiedAt: () => "2026-07-12T12:00:00.000Z",
  });
  assert.equal(canned.requests.length, 204);
  assert.equal(canned.requests.filter((request) => request.partition === "holdout").length, 180);
  assert.equal(result.attempts.length, 204);
  assert.ok(canned.maxActive() <= 2);
  assert.ok(canned.maxActive() >= 2, "balanced pool should actually exercise two-way concurrency");
  assert.deepEqual(result.freeze.corpusEnvelopeHashes, EXPECTED_ENVELOPE_SHA256);
  assert.deepEqual(result.freeze.corpusHashes, EXPECTED_SUBSTANTIVE_SHA256);
  assert.deepEqual(result.qualifiers, {
    reader: ["reader-1@high", "reader-2@high"],
    source: ["source-1@xhigh", "source-2@xhigh"],
    quiz: ["quiz-1@xhigh"],
  });
  assert.deepEqual(result.selected, {
    readerPrimary: "reader-1@high",
    readerAudit: "reader-2@high",
    sourcePrimary: "source-1@xhigh",
    sourceAdjudicator: "source-2@xhigh",
    quizSemanticAdjudicator: "quiz-1@xhigh",
  });
  assert.equal(result.roleSetReady, true);
  assert.ok(!canned.requests.some((request) => request.profileId.includes("unused")), "unused profiles must not run after 2/2/1 qualification");
  assert.deepEqual(result.sourceMissingEvidenceProbes.map((probe) => probe.profileId), ["source-1@xhigh", "source-2@xhigh"]);
  assert.ok(result.sourceMissingEvidenceProbes.every((probe) => probe.passed && probe.executorCalls === 0));

  const reader = profileResult(result, "reader", "reader-1@high").metrics;
  assert.deepEqual(reader.denominators, {
    schemaValidity: 30,
    hardBlockerSensitivity: 10,
    hardBlockerFalsePositiveFree: 10,
    cleanControlPassRate: 10,
    craftCalibrationAccuracy: 10,
    evidenceSpanValidity: 30,
    requiredCasesResolved: 30,
  });
  const source = profileResult(result, "source", "source-1@xhigh").metrics;
  assert.deepEqual(source.denominators, {
    schemaValidity: 40,
    fabricationSensitivity: 4,
    causalOverreachSensitivity: 4,
    sourceContradictionSensitivity: 2,
    highSeverityFalsePositiveFree: 20,
    cleanCasePassRate: 20,
    supportStatusAccuracy: 40,
    visibleRegisterAccuracy: 40,
    evidenceSpanValidity: 40,
    missingEvidenceInconclusive: 1,
    requiredCasesResolved: 40,
  });
  const quiz = profileResult(result, "quiz", "quiz-1@xhigh").metrics;
  assert.deepEqual(quiz.denominators, {
    schemaValidity: 40,
    wrongKeyDetection: 10,
    cleanUniquePassRate: 10,
    ambiguityDetection: 10,
    mechanismAccuracy: 10,
    evidenceSpanValidity: 40,
    requiredCasesResolved: 40,
  });
  assert.ok(Object.values(quiz.metrics).every((rate) => rate === 1));
  const quizEnums = new Set(result.attempts
    .filter((attempt) => attempt.role === "quiz" && attempt.partition === "holdout")
    .map((attempt) => attempt.evaluation?.keyCorrect));
  assert.deepEqual(quizEnums, new Set(["correct", "ambiguous", "wrong"]), "quiz scoring must preserve the three exact enum judgments");
});

test("calibration skips an unavailable first candidate without reordering and uses the next advertised profile", async () => {
  const input = loadInput();
  const canned = cannedExecutor(input);
  const firstReader = input.candidateOrder.reader[0].profileId;
  const candidateAvailability = availabilityFor(input, new Set([firstReader]));
  const calibration = await runRoleCalibration(input, { executor: canned.executor, candidateAvailability });
  assert.equal(calibration.schedule.length, 24);
  assert.equal(calibration.calibrationProfiles.reader, input.candidateOrder.reader[1].profileId);
  assert.equal(canned.requests.some((request) => request.profileId === firstReader), false, "known-unavailable profile must receive zero calls");
  assert.equal(canned.requests.filter((request) => request.role === "reader").every((request) => request.profileId === input.candidateOrder.reader[1].profileId), true);
});

test("holdout retains unavailable ordinals as zero-call evidence and continues to later frozen candidates", async () => {
  const input = loadInput();
  const unavailable = new Set([
    input.candidateOrder.reader[1].profileId,
    input.candidateOrder.source[1].profileId,
  ]);
  const candidateAvailability = availabilityFor(input, unavailable);
  const calibrationExecutor = cannedExecutor(input);
  const calibration = await runRoleCalibration(input, { executor: calibrationExecutor.executor, candidateAvailability });
  const inspection = inspected(calibration);
  const holdoutExecutor = cannedExecutor(input);
  const result = await runRoleQualificationHoldout(input, calibration, inspection, {
    executor: holdoutExecutor.executor,
    candidateAvailability,
    qualifiedAt: () => "2026-07-12T14:00:00.000Z",
  });
  assert.equal(result.roleSetReady, true);
  assert.equal(holdoutExecutor.requests.some((request) => unavailable.has(request.profileId)), false, "known-unavailable holdout profiles must receive zero calls");
  assert.deepEqual(result.qualifiers.reader, [input.candidateOrder.reader[0].profileId, input.candidateOrder.reader[2].profileId]);
  assert.deepEqual(result.qualifiers.source, [input.candidateOrder.source[0].profileId, input.candidateOrder.source[2].profileId]);
  assert.equal(result.profileRoleResults.some((record) => unavailable.has(record.profile.profileId)), false);
});

test("holdout requires a hash-bound human inspection of the retained calibration results", async () => {
  const input = loadInput();
  const calibrationExecutor = cannedExecutor(input);
  const candidateAvailability = availabilityFor(input);
  const calibration = await runRoleCalibration(input, {
    executor: calibrationExecutor.executor,
    candidateAvailability,
  });
  const holdoutExecutor = cannedExecutor(input);
  await assert.rejects(
    () => runRoleQualificationHoldout(input, calibration, undefined as never, {
      executor: holdoutExecutor.executor,
      candidateAvailability,
    }),
    /durable human calibration-inspection attestation/,
  );
  const inspection = inspected(calibration);
  await assert.rejects(
    () => runRoleQualificationHoldout(input, calibration, {
      ...inspection,
      inspectedResultsSha256: "f".repeat(64),
    }, {
      executor: holdoutExecutor.executor,
      candidateAvailability,
    }),
    /calibration inspection hash mismatch/,
  );
  assert.equal(holdoutExecutor.requests.length, 0, "missing or tampered inspection must precede every holdout request");
});

test("holdout rejects a tampered calibration seal before calling the executor", async () => {
  const input = loadInput();
  const calibrationExecutor = cannedExecutor(input);
  const candidateAvailability = availabilityFor(input);
  const calibration = await runRoleCalibration(input, { executor: calibrationExecutor.executor, candidateAvailability });
  const tampered = {
    ...calibration,
    roleProtocolValid: { ...calibration.roleProtocolValid, reader: false },
  };
  const holdoutExecutor = cannedExecutor(input);
  await assert.rejects(
    () => runRoleQualificationHoldout(input, tampered, inspected(calibration), { executor: holdoutExecutor.executor, candidateAvailability }),
    /calibration seal hash mismatch/,
  );
  assert.equal(holdoutExecutor.requests.length, 0);
});

test("corpus relabeling fails before calibration and cannot alter frozen holdout denominators", async () => {
  const base = loadInput();
  const target = base.corpora.source.partitions.holdout.cases.find((c) => c.expected.expectedCategory === "source_contradiction");
  assert.ok(target);
  const changedCase: Imp22SourceCorpusCaseV2 = {
    ...target,
    expected: { ...target.expected, expectedCategory: "unsupported_attribution" },
  };
  const changedSource = {
    ...base.corpora.source,
    partitions: {
      ...base.corpora.source.partitions,
      holdout: {
        ...base.corpora.source.partitions.holdout,
        cases: base.corpora.source.partitions.holdout.cases.map((c) => c.caseId === target.caseId ? changedCase : c),
      },
    },
  };
  const input: RunRoleQualificationInputV1 = {
    ...base,
    corpora: { ...base.corpora, source: changedSource },
  };
  const canned = cannedExecutor(input);
  await assert.rejects(
    () => runRoleCalibration(input, { executor: canned.executor, candidateAvailability: availabilityFor(input) }),
    /source holdout labels composition drifted/,
  );
  assert.equal(canned.requests.length, 0);
});

test("schema-valid bad judgments, false positives, and invalid evidence fail exact metrics without replay", async () => {
  const input = loadInput({
    reader: PROFILES.reader.slice(0, 2),
    source: PROFILES.source.slice(0, 2),
    quiz: PROFILES.quiz.slice(0, 1),
  });
  let readerHardMissCase = "";
  let readerCleanFpCase = "";
  let readerBadEvidenceCount = 0;
  let sourceContradictionMissCase = "";
  let sourceCleanFpCase = "";
  let sourceBadEvidenceCase = "";
  const canned = cannedExecutor(input, (request, raw, maps) => {
    if (request.partition !== "holdout") return undefined;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (request.profileId === "reader-1@high") {
      const c = maps.reader.get(request.caseId)!;
      if (c.kind === "reader-visible-hard-blocker" && readerHardMissCase.length === 0) {
        readerHardMissCase = c.caseId;
        parsed.recommendation = "SHIP";
        parsed.blockingFindings = [];
      } else if (c.kind === "clean" && readerCleanFpCase.length === 0) {
        readerCleanFpCase = c.caseId;
        const span = evidenceLine(request.artifacts[0].content);
        parsed.recommendation = "BLOCK";
        parsed.blockingFindings = [{ category: "unsafe", unit: "chapter", problem: "false positive", evidenceSpans: [span] }];
      } else if (request.partition === "holdout" && c.kind === "craft-nonblocker" && readerBadEvidenceCount < 2) {
        readerBadEvidenceCount += 1;
        parsed.strongestEvidence = ["not present in the reader document"];
      }
      return { rawOutput: JSON.stringify(parsed) };
    }
    if (request.profileId === "source-1@xhigh") {
      const c = maps.source.get(request.caseId)!;
      const unit = (parsed.units as Array<Record<string, unknown>>)[0];
      if (c.expected.expectedCategory === "source_contradiction" && sourceContradictionMissCase.length === 0) {
        sourceContradictionMissCase = c.caseId;
        parsed.result = "PASS";
        parsed.blockingFindingIds = [];
        unit.findings = [];
      } else if (c.pairSide === "clean" && sourceCleanFpCase.length === 0) {
        sourceCleanFpCase = c.caseId;
        parsed.result = "BLOCK";
        parsed.blockingFindingIds = [`${c.evidence.sourceUsePlanUnit.unitId}::invented_detail#0`];
        unit.findings = [{ category: "invented_detail", severity: "blocker", explanation: "false positive" }];
      } else if (c.pairSide === "defect" && sourceBadEvidenceCase.length === 0) {
        sourceBadEvidenceCase = c.caseId;
        unit.chapterEvidenceSpans = ["not present in the chapter unit"];
      }
      return { rawOutput: JSON.stringify(parsed) };
    }
    return undefined;
  });

  const candidateAvailability = availabilityFor(input);
  const calibration = await runRoleCalibration(input, { executor: canned.executor, candidateAvailability });
  assert.equal(calibration.valid, true, "bad judgment is not a calibration schema/protocol failure");
  const result = await runRoleQualificationHoldout(input, calibration, inspected(calibration), { executor: canned.executor, candidateAvailability });
  const readerBad = profileResult(result, "reader", "reader-1@high");
  assert.equal(readerBad.outcome.status, "NOT_QUALIFIED");
  assert.deepEqual(readerBad.outcome.failedThresholds, [
    "hardBlockerSensitivity",
    "hardBlockerFalsePositiveFree",
    "evidenceSpanValidity",
  ]);
  const sourceBad = profileResult(result, "source", "source-1@xhigh");
  assert.equal(sourceBad.outcome.status, "NOT_QUALIFIED");
  assert.deepEqual(sourceBad.outcome.failedThresholds, [
    "sourceContradictionSensitivity",
    "highSeverityFalsePositiveFree",
    "evidenceSpanValidity",
  ]);
  assert.equal(result.qualifiers.reader.length, 1);
  assert.equal(result.qualifiers.source.length, 1);
  assert.equal(result.qualifiers.quiz.length, 1);
  assert.equal(result.roleSetReady, false);
  assert.match(result.roleSetBlockedReason ?? "", /qualified backup judge/);
  assert.equal(result.attempts.filter((attempt) => attempt.caseId === readerHardMissCase && attempt.profileId === "reader-1@high").length, 1);
  assert.equal(result.attempts.filter((attempt) => attempt.caseId === sourceContradictionMissCase && attempt.profileId === "source-1@xhigh").length, 1);
});

test("only infrastructure terminal statuses replay once; policy/schema/integrity/refusal and route failures do not", async () => {
  const input = loadInput();
  const readerCases = input.corpora.reader.partitions.calibration.cases;
  const timeoutCase = readerCases[0].caseId;
  const policyCase = readerCases[1].caseId;
  const invalidOutputCase = input.corpora.source.partitions.calibration.cases[0].caseId;
  const integrityCase = input.corpora.source.partitions.calibration.cases[1].caseId;
  const refusalCase = input.corpora.quiz.partitions.calibration.cases[0].caseId;
  const routeCase = input.corpora.quiz.partitions.calibration.cases[1].caseId;
  const canned = cannedExecutor(input, (request) => {
    if (request.caseId === timeoutCase && request.attemptNumber === 1) return { status: "timeout" };
    if (request.caseId === policyCase) return { status: "policy_failure" };
    if (request.caseId === invalidOutputCase) return { status: "invalid_output" };
    if (request.caseId === integrityCase) return { status: "integrity_failure" };
    if (request.caseId === refusalCase) return { status: "refusal" };
    if (request.caseId === routeCase) return { receiptPatch: { model: "wrong-route-model" } };
    return undefined;
  });
  const candidateAvailability = availabilityFor(input);
  const calibration = await runRoleCalibration(input, { executor: canned.executor, candidateAvailability });
  assert.equal(calibration.valid, false);
  assert.equal(canned.requests.length, 25, "24 scheduled cases plus exactly one infrastructure replay");
  const timeoutAttempts = calibration.attempts.filter((attempt) => attempt.caseId === timeoutCase);
  assert.equal(timeoutAttempts.length, 2);
  assert.equal(timeoutAttempts[0].replayEligible, true);
  assert.equal(timeoutAttempts[1].replayOfAttemptId, timeoutAttempts[0].attemptId);
  for (const caseId of [policyCase, invalidOutputCase, integrityCase, refusalCase, routeCase]) {
    const attempts = calibration.attempts.filter((attempt) => attempt.caseId === caseId);
    assert.equal(attempts.length, 1, `${caseId} must not replay`);
    assert.equal(attempts[0].replayEligible, false);
  }
  assert.equal(calibration.attempts.find((attempt) => attempt.caseId === routeCase)?.routeValid, false);

  const holdoutExecutor = cannedExecutor(input);
  await assert.rejects(
    () => runRoleQualificationHoldout(input, calibration, inspected(calibration), { executor: holdoutExecutor.executor, candidateAvailability }),
    /calibration seal is not valid|source missing-evidence refusal probe did not pass/,
  );
  assert.equal(holdoutExecutor.requests.length, 0);
});

test("source calibration rejects a substituted plan unit and a BLOCK backed only by major findings", async () => {
  const input = loadInput();
  const [substitutedCase, severityCase] = input.corpora.source.partitions.calibration.cases;
  const canned = cannedExecutor(input, (request) => {
    if (request.caseId !== substitutedCase.caseId && request.caseId !== severityCase.caseId) return undefined;
    const c = request.caseId === substitutedCase.caseId ? substitutedCase : severityCase;
    const parsed = JSON.parse(sourceRaw(c)) as Record<string, unknown>;
    const unit = (parsed.units as Array<Record<string, unknown>>)[0];
    if (request.caseId === substitutedCase.caseId) unit.unitId = "substituted-plan-unit";
    else {
      parsed.result = "BLOCK";
      parsed.blockingFindingIds = ["major-only"];
      unit.findings = [{ category: "invented_detail", severity: "major", explanation: "not blocker severity" }];
    }
    return { rawOutput: JSON.stringify(parsed) };
  });
  const calibration = await runRoleCalibration(input, { executor: canned.executor, candidateAvailability: availabilityFor(input) });
  assert.equal(calibration.valid, false);
  const substituted = calibration.attempts.find((attempt) => attempt.caseId === substitutedCase.caseId)!;
  const majorOnly = calibration.attempts.find((attempt) => attempt.caseId === severityCase.caseId)!;
  assert.equal(substituted.evaluation?.protocolValid, false);
  assert.match(substituted.evaluation?.error ?? "", /omitted required unit/);
  assert.equal(majorOnly.evaluation?.protocolValid, false);
  assert.match(majorOnly.evaluation?.error ?? "", /no blocker-severity finding/);
});

test("calibration cannot be valid when any retained evidence span is not exact", async () => {
  const input = loadInput();
  const target = input.corpora.reader.partitions.calibration.cases[0];
  const canned = cannedExecutor(input, (request) => {
    if (request.caseId !== target.caseId) return undefined;
    const parsed = JSON.parse(readerRaw(request, target)) as Record<string, unknown>;
    parsed.strongestEvidence = ["not present in the retained phase-1 document"];
    return { rawOutput: JSON.stringify(parsed) };
  });
  const calibration = await runRoleCalibration(input, { executor: canned.executor, candidateAvailability: availabilityFor(input) });
  assert.equal(calibration.valid, false);
  assert.equal(calibration.roleProtocolValid.reader, false);
  assert.equal(calibration.attempts.find((attempt) => attempt.caseId === target.caseId)?.evaluation?.evidenceSpanValid, false);
});

test("source missing-evidence probe predicate is fail-closed and never treats a spawn or non-refusal as success", () => {
  assert.equal(evaluateSourceMissingEvidenceProbeObservation({
    threw: true,
    observed: "source lane requires the source sidecar",
    spawnCalls: 0,
  }), true);
  assert.equal(evaluateSourceMissingEvidenceProbeObservation({ threw: false, observed: "no refusal", spawnCalls: 0 }), false);
  assert.equal(evaluateSourceMissingEvidenceProbeObservation({ threw: true, observed: "unrelated error", spawnCalls: 0 }), false);
  assert.equal(evaluateSourceMissingEvidenceProbeObservation({
    threw: true,
    observed: "source lane requires the source sidecar",
    spawnCalls: 1,
  }), false);
});
