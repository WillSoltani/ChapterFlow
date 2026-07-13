/** IMP-22 fresh pilot/gold campaign harness — all execution is injected. */

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { test } from "./harness.js";
import { fxAttemptIdentity, fxChapter, fxPacket, fxPlan, fxPlanUnit } from "./migrationFixtures.js";
import { sourcePacketHash } from "../src/compiler/sourcePacket.js";
import { hashCanonical, sha256Hex } from "../src/contracts/contractUtil.js";
import type { AggregatedChapterReviewV1 } from "../src/contracts/aggregateChapterReview.js";
import type { QuizIntegrityResultV1 } from "../src/contracts/quizIntegrityReview.js";
import type { ReaderExperienceReviewV1 } from "../src/contracts/readerExperienceReview.js";
import type { SourceIntegrityReviewV1 } from "../src/contracts/sourceIntegrityReview.js";
import { sourceUsePlanHash, type SourceUsePlanV1 } from "../src/contracts/sourceUsePlan.js";
import { chapterContentHash } from "../src/critics/qcAttestation.js";
import { semanticSourceHash } from "../src/source/sourceIntegrity.js";
import type { ChapterV21 } from "../src/types.js";
import type { AuthorIo, PreparedAuthorCandidate } from "../src/orchestrator/authorRun.js";
import type { AutopilotDeps } from "../src/orchestrator/autopilot.js";
import type { ChapterAttempt } from "../src/orchestrator/chapterTransaction.js";
import { patchValueHash } from "../src/orchestrator/repairPatch.js";
import {
  FORWARD_REVIEW_ENVELOPE_SCHEMA,
  FORWARD_REVIEW_EXECUTION_RESULT_SCHEMA,
  type ForwardChapterConductorInputV1,
  type ForwardChapterConductorResultV1,
  type ForwardReviewExecutionEntryV1,
} from "../src/orchestrator/forwardChapterConductor.js";
import {
  FORWARD_CHAPTER_STRATA,
  FORWARD_DESTINATION_PROOF_SCHEMA,
  FORWARD_GOLD_EVIDENCE_SCHEMA,
  FORWARD_PERSISTENCE_RECEIPT_SCHEMA,
  FORWARD_VALIDATION_CAPABILITIES,
  GOLD_EXPERIMENT_ID,
  GOLD_ENVELOPE_EXPERIMENT_ID,
  PILOT_EXPERIMENT_ID,
  PILOT_ENVELOPE_EXPERIMENT_ID,
  buildGoldManifest,
  buildGoldManifestV2Envelope,
  buildPilotManifest,
  buildPilotManifestV2Envelope,
  createDeferredAuthorProducer,
  forwardV2SourceExecutionOrderProblems,
  nextPilotCorrectionExperimentId,
  runForwardValidationCampaign,
  type ForwardBookSelectionCandidateV1,
  type ForwardCandidateProductionV1,
  type ForwardChapterStratum,
  type ForwardExperimentDestinationProofV1,
  type ForwardSourceCoordinateV1,
  type ForwardValidationCampaignDeps,
  type ForwardValidationTargetV1,
  type FrozenForwardValidationManifestV1,
  type VerifiedSystemicRootCauseV1,
} from "../src/orchestrator/forwardValidationCampaign.js";
import { REQUIRED_SWEEP_FAMILIES, type SweepRecord } from "../src/qc/sweep.js";

type Evidence = {
  plan: SourceUsePlanV1;
  packet: ReturnType<typeof fxPacket>;
  sidecar: unknown;
  anchors: ReturnType<typeof fxPacket>["allowedAnchors"];
};

const COMMON = {
  frozenAtIso: "2026-07-12T12:00:00.000Z",
  roleAssignmentSha256: "r".repeat(64),
  instrumentManifestSha256: "i".repeat(64),
  thresholdsSha256: "t".repeat(64),
  inputMaterializationSha256: "m".repeat(64),
  productionInstrumentSealSha256: "8".repeat(64),
  goldEvaluatorInstrumentSha256: "7".repeat(64),
  qualificationBookIds: ["qualification-only-book"],
};

function evidenceFor(bookId: string, chapterNumber: number): Evidence {
  const chapterId = `${bookId}-ch${String(chapterNumber).padStart(2, "0")}`;
  const packet = fxPacket({ bookId, chapterId, chapterNumber });
  const plan = fxPlan({
    bookId,
    chapterNumber,
    sourcePacketSha256: sourcePacketHash(packet),
    units: [fxPlanUnit({
      unitId: `unit.${bookId}.${chapterNumber}`,
      origin: "source_bound",
      form: "explanation",
      claimStrength: "descriptive",
      anchorIds: [packet.allowedAnchors[0].id],
    })],
  });
  const sidecar = { schemaVersion: "source-v1", bookId, chapterNumber, facts: [`fact-${chapterNumber}`] };
  return { plan, packet, sidecar, anchors: packet.allowedAnchors };
}

function coordinate(bookId: string, chapterNumber: number, stratum: ForwardChapterStratum, evidence: Evidence): ForwardSourceCoordinateV1 {
  return {
    bookId,
    chapterNumber,
    chapterId: `${bookId}-ch${String(chapterNumber).padStart(2, "0")}`,
    stratum,
    sourceComplete: true,
    evidenceFresh: true,
    sourceUsePlanSha256: sourceUsePlanHash(evidence.plan),
    sourcePacketSha256: sourcePacketHash(evidence.packet),
    sidecarSha256: semanticSourceHash(evidence.sidecar),
    anchorCatalogSha256: hashCanonical(evidence.anchors),
    sourceArchiveId: `archive://${bookId}/ch${chapterNumber}`,
    riskSignals: stratum === "causal-quiz-sensitive" ? ["causal-teaching-claims", "difficult-quiz-design"] : [],
  };
}

function selectionBook(
  bookId: string,
  chapterCount: number,
  evidenceMap: Map<string, Evidence>,
  order: readonly ForwardChapterStratum[] = FORWARD_CHAPTER_STRATA,
): ForwardBookSelectionCandidateV1 {
  const chapters: ForwardSourceCoordinateV1[] = [];
  for (let n = 1; n <= chapterCount; n++) {
    const evidence = evidenceFor(bookId, n);
    evidenceMap.set(`${bookId}/${n}`, evidence);
    chapters.push(coordinate(bookId, n, order[(n - 1) % order.length], evidence));
  }
  return { bookId, sourceComplete: true, representativeTags: ["research", "practice", "concept"], chapters };
}

function pilotFixture(): {
  frozen: FrozenForwardValidationManifestV1;
  evidenceMap: Map<string, Evidence>;
} {
  const evidenceMap = new Map<string, Evidence>();
  const books = [selectionBook("pilot-beta", 4, evidenceMap), selectionBook("pilot-alpha", 4, evidenceMap)];
  return { frozen: buildPilotManifest({ ...COMMON, books }), evidenceMap };
}

test("IMP-24 manifest wrappers preserve the frozen denominator under fresh envelope identities", () => {
  const evidenceMap = new Map<string, Evidence>();
  const pilotBooks = [
    selectionBook("pilot-alpha", 4, evidenceMap),
    selectionBook("pilot-beta", 4, evidenceMap),
  ];
  const pilot = buildPilotManifestV2Envelope({ ...COMMON, books: pilotBooks });
  assert.equal(pilot.manifest.experimentId, PILOT_ENVELOPE_EXPERIMENT_ID);
  assert.equal(pilot.manifest.targets.length, 8);
  assert.ok(pilot.manifest.targets.every((target) =>
    target.outputRunId.startsWith(`${PILOT_ENVELOPE_EXPERIMENT_ID}--`)
      && target.outputRelPath.includes(`state/migration-experiments/${PILOT_ENVELOPE_EXPERIMENT_ID}/`)));

  const goldBook = selectionBook("the-gifts-of-imperfection", 13, evidenceMap);
  const gold = buildGoldManifestV2Envelope({
    ...COMMON,
    books: [goldBook],
    pilotBookIds: pilotBooks.map((book) => book.bookId),
    pilotAccepted: true,
    pilotManifestSha256: pilot.manifestSha256,
    pilotResultSha256: "6".repeat(64),
  });
  assert.equal(gold.manifest.experimentId, GOLD_ENVELOPE_EXPERIMENT_ID);
  assert.equal(gold.manifest.targets.length, 13);
  assert.ok(gold.manifest.targets.every((target) =>
    target.outputRunId.startsWith(`${GOLD_ENVELOPE_EXPERIMENT_ID}--`)
      && target.outputRelPath.includes(`state/migration-experiments/${GOLD_ENVELOPE_EXPERIMENT_ID}/`)));

  const rootCause: VerifiedSystemicRootCauseV1 = {
    classification: "PROMPT_OR_CONTRACT",
    rootCauseId: "imp24-systemic-regression",
    severity: "P1",
    affectedChapterKeys: ["pilot-alpha/ch01"],
    regressionTestId: "imp24-envelope-correction-regression",
  };
  const correction = buildPilotManifestV2Envelope({
    ...COMMON,
    books: pilotBooks,
    correctionCycle: 1,
    priorPilotExperimentIds: [PILOT_ENVELOPE_EXPERIMENT_ID],
    priorThresholdsSha256: COMMON.thresholdsSha256,
    verifiedSystemicRootCause: rootCause,
  });
  assert.equal(correction.manifest.experimentId, `${PILOT_ENVELOPE_EXPERIMENT_ID}-correction-1`);
  assert.equal(correction.manifest.previousExperimentId, PILOT_ENVELOPE_EXPERIMENT_ID);
  assert.notEqual(PILOT_ENVELOPE_EXPERIMENT_ID, PILOT_EXPERIMENT_ID);
  assert.notEqual(GOLD_ENVELOPE_EXPERIMENT_ID, GOLD_EXPERIMENT_ID);
});

function chapterFor(target: ForwardValidationTargetV1, stage: string): ChapterV21 {
  return fxChapter({
    chapterId: target.chapterId,
    number: target.chapterNumber,
    title: `${target.stratum} ${stage}`,
    hook: `A fresh ${stage} hook for ${target.chapterId}.`,
    keyTakeaway: `Keep ${target.stratum} evidence bound during ${stage}.`,
  } as Partial<ChapterV21>);
}

function preparedFor(root: string, target: ForwardValidationTargetV1, evidence: Evidence, stage: "first-write" | "repair" | "regeneration", ordinal: number): PreparedAuthorCandidate {
  const attemptDir = join(root, target.bookId, `ch${target.chapterNumber}`, `${stage}-${ordinal}`);
  const workspaceDir = join(attemptDir, "workspace");
  mkdirSync(workspaceDir, { recursive: true });
  const chapter = chapterFor(target, stage);
  const bytes = JSON.stringify(chapter, null, 2) + "\n";
  const candidateFileName = `${target.chapterId}.v21-native.chapter.json`;
  const candidatePath = join(workspaceDir, candidateFileName);
  writeFileSync(candidatePath, bytes);
  const attemptKind = stage === "first-write" ? "author-initial" : stage === "regeneration" ? "author-regeneration" : "surgical-repair";
  const attempt: ChapterAttempt = {
    identity: fxAttemptIdentity({
      attemptId: `${target.bookId}-ch${target.chapterNumber}-${stage}-${ordinal}`,
      bookId: target.bookId,
      chapterNumber: target.chapterNumber,
      attemptKind,
      sourcePlanHash: target.sourceUsePlanSha256,
      inputHashes: { sourceUsePlan: target.sourceUsePlanSha256, sourcePacket: target.sourcePacketSha256 },
      expectedBaseSha256: null,
    }),
    attemptDir,
    workspaceDir,
    candidateFileName,
    candidatePath,
    evidenceRoot: null,
  };
  return {
    bookId: target.bookId,
    chapterNumber: target.chapterNumber,
    chapterId: target.chapterId,
    sessionId: `session-${attempt.identity.attemptId}`,
    attempt,
    bytes,
    chapter,
    plan: evidence.plan,
    pendingLeadOverride: null,
    io: {} as PreparedAuthorCandidate["io"],
  };
}

function destinationProof(root: string, target: ForwardValidationTargetV1): ForwardExperimentDestinationProofV1 {
  const experimentRootAbs = join(root, target.outputRunId);
  const proof: ForwardExperimentDestinationProofV1 = {
    schema: FORWARD_DESTINATION_PROOF_SCHEMA,
    experimentId: target.outputRunId.split("--")[0],
    outputRunId: target.outputRunId,
    outputRelPath: target.outputRelPath,
    experimentRootAbs,
    chapterOutputAbsPath: join(experimentRootAbs, "chapters", `${target.chapterId}.json`),
    provenanceRootAbs: join(experimentRootAbs, "provenance"),
    leadOverrideRootAbs: join(experimentRootAbs, "lead-overrides"),
    attemptsRootAbs: join(experimentRootAbs, "attempts"),
    evidenceRootAbs: join(experimentRootAbs, "evidence"),
    diversityLedgerRootAbs: join(experimentRootAbs, "telemetry", "diversity"),
    gateAttemptStateAbsPath: join(experimentRootAbs, "telemetry", "gate-attempts.json"),
    executionManifestRootAbs: join(experimentRootAbs, "execution", "manifests"),
    qualificationCacheRootAbs: join(experimentRootAbs, "execution", "cli-qualification-cache"),
    sessionLogRootAbs: join(experimentRootAbs, "execution", "author-sessions"),
    execSessionRootAbs: join(experimentRootAbs, "execution", "sessions"),
    frozenIndexAbsPath: join(experimentRootAbs, "frozen-inputs", "book-index.json"),
    frozenIndexSha256: "a".repeat(64),
    rubricThresholdsAbsPath: join(experimentRootAbs, "frozen-inputs", "rubric-thresholds.json"),
    rubricThresholdsSha256: "b".repeat(64),
    nameBankSnapshotAbsPath: join(experimentRootAbs, "frozen-inputs", "name-bank.json"),
    nameBankSnapshotSha256: "c".repeat(64),
    materializedInputSnapshotRootAbs: join(experimentRootAbs, "frozen-inputs", "materialized-book"),
    materializedInputSnapshotSha256: "d".repeat(64),
  };
  mkdirSync(proof.attemptsRootAbs, { recursive: true });
  return proof;
}

function scores(): ReaderExperienceReviewV1["scores"] {
  return {
    retention: 90,
    quizzes: 90,
    transfer: 90,
    practical: 90,
    summaries: 90,
    tone: 90,
    limits: 90,
    insight: 90,
    density: 90,
    beginner: 90,
  };
}

function reader(prepared: PreparedAuthorCandidate): ReaderExperienceReviewV1 {
  return {
    schema: "reader-experience-review-v1",
    reviewerRole: "reader-experience",
    chapterContentSha256: chapterContentHash(prepared.chapter),
    readerDocumentSha256: "reader-doc",
    rubricVersion: "reader-experience-review-v1",
    schemaSha256: "reader-schema",
    scores: scores(),
    quizDerivation: { answers: [], mechanisms: [], confidence: [], ambiguities: [], tells: [] },
    recommendation: "SHIP",
    blockingFindings: [], escalationSignals: [], advisoryFindings: [], strongestEvidence: [], weakestEvidence: [], oneParagraphVerdict: "clean",
  };
}

function source(prepared: PreparedAuthorCandidate, target: ForwardValidationTargetV1): SourceIntegrityReviewV1 {
  return {
    schema: "source-integrity-review-v1",
    reviewerRole: "source-integrity",
    chapterContentSha256: chapterContentHash(prepared.chapter),
    sourceUsePlanSha256: target.sourceUsePlanSha256,
    sourcePacketSha256: target.sourcePacketSha256,
    sidecarSha256: target.sidecarSha256,
    schemaSha256: "source-schema",
    units: [], result: "PASS", blockingFindingIds: [], rationale: "clean",
  };
}

function quiz(prepared: PreparedAuthorCandidate): QuizIntegrityResultV1 {
  return { schema: "quiz-integrity-result-v1", chapterContentSha256: chapterContentHash(prepared.chapter), derivationSha256: "derivation", questions: [], result: "PASS" };
}

function executionEntry(
  lane: "reader" | "source" | "quiz",
  panelRole: NonNullable<ForwardReviewExecutionEntryV1["panelRole"]>,
  i: number,
  reviewOperationKey: string = lane,
): ForwardReviewExecutionEntryV1 {
  const workspaceRole: ForwardReviewExecutionEntryV1["expected"]["workspaceRole"] = lane === "reader" ? "direct-reader" : lane === "source" ? "source-verifier" : "quiz-adjudication";
  const expected = {
    schema: "forward-review-execution-request-v1" as const,
    lane,
    reviewOperationKey,
    workspaceRole,
    profileId: `${lane}-profile`,
    model: `${lane}-model`,
    effort: "high" as const,
    schemaSha256: `${lane}-schema`,
    instrumentVersion: `${lane}-instrument`,
    roleAssignmentSha256: COMMON.roleAssignmentSha256,
    instrumentManifestSha256: COMMON.instrumentManifestSha256,
    executionProfileHash: "execution-profile",
    routePolicyVersion: "route-v1",
  };
  return {
    lane,
    reviewOperationKey,
    panelRole,
    expected,
    taskSha256: `task-${lane}`,
    artifactHashes: [],
    status: "VERIFIED",
    received: {
      schema: FORWARD_REVIEW_EXECUTION_RESULT_SCHEMA,
      executionId: `independent-${i}-${lane}`,
      lane,
      reviewOperationKey,
      workspaceRole,
      profileId: expected.profileId,
      model: expected.model,
      effort: expected.effort,
      schemaSha256: expected.schemaSha256,
      instrumentVersion: expected.instrumentVersion,
      roleAssignmentSha256: expected.roleAssignmentSha256,
      instrumentManifestSha256: expected.instrumentManifestSha256,
      executionProfileHash: expected.executionProfileHash,
      routePolicyVersion: expected.routePolicyVersion,
    },
    outputSha256: `output-${lane}`,
    failureReason: null,
  };
}

function v2SourceExecutionEntry(
  panelRole: "sourcePrimary" | "sourceAdjudicator",
  operationKey: string,
  envelopeSha256: string,
  i: number,
): ForwardReviewExecutionEntryV1 {
  const base = executionEntry("source", panelRole, i, operationKey);
  return {
    ...base,
    expected: {
      ...base.expected,
      reviewProtocol: "review-evidence-envelope-v1",
      evidenceEnvelopeSha256: envelopeSha256,
      evidenceEnvelopeBytesSha256: sha256Hex(`bytes:${operationKey}`),
    },
    received: {
      ...base.received!,
      reviewProtocol: "review-evidence-envelope-v1",
      evidenceEnvelopeSha256: envelopeSha256,
      evidenceEnvelopeBytesSha256: sha256Hex(`bytes:${operationKey}`),
    },
  };
}

test("campaign acceptance requires one ordered source execution per authoritative V2 envelope", () => {
  const hashes = ["1".repeat(64), "2".repeat(64), "3".repeat(64)];
  const primary = hashes.map((hash, index) => v2SourceExecutionEntry("sourcePrimary", `U${index + 1}`, hash, index + 1));
  assert.deepEqual(forwardV2SourceExecutionOrderProblems({
    executions: primary,
    sourceEnvelopeSha256s: hashes,
    sourceAdjudicationTriggered: false,
  }), []);

  assert.ok(forwardV2SourceExecutionOrderProblems({
    executions: primary.slice(0, 2),
    sourceEnvelopeSha256s: hashes,
    sourceAdjudicationTriggered: false,
  }).some((problem) => /exactly 3 sourcePrimary/.test(problem)));

  const reordered = [primary[1], primary[0], primary[2]];
  assert.ok(forwardV2SourceExecutionOrderProblems({
    executions: reordered,
    sourceEnvelopeSha256s: hashes,
    sourceAdjudicationTriggered: false,
  }).some((problem) => /authoritative source envelope order/.test(problem)));

  const duplicatedKey = primary.map((entry, index) => index === 1
    ? {
        ...entry,
        reviewOperationKey: "U1",
        expected: { ...entry.expected, reviewOperationKey: "U1" },
        received: { ...entry.received!, reviewOperationKey: "U1" },
      }
    : entry);
  assert.ok(forwardV2SourceExecutionOrderProblems({
    executions: duplicatedKey,
    sourceEnvelopeSha256s: hashes,
    sourceAdjudicationTriggered: false,
  }).some((problem) => /unique source operation keys/.test(problem)));

  const adjudicators = hashes.map((hash, index) =>
    v2SourceExecutionEntry("sourceAdjudicator", `U${index + 1}`, hash, index + 10));
  assert.deepEqual(forwardV2SourceExecutionOrderProblems({
    executions: [...primary, ...adjudicators],
    sourceEnvelopeSha256s: hashes,
    sourceAdjudicationTriggered: true,
  }), []);
  assert.ok(forwardV2SourceExecutionOrderProblems({
    executions: [...primary, adjudicators[1], adjudicators[0], adjudicators[2]],
    sourceEnvelopeSha256s: hashes,
    sourceAdjudicationTriggered: true,
  }).some((problem) => /adjudicator operation order|authoritative source envelope order/.test(problem)));
});

function conductorResult(
  input: ForwardChapterConductorInputV1,
  target: ForwardValidationTargetV1,
  pass: boolean,
  stale: boolean = false,
): ForwardChapterConductorResultV1 {
  const r = reader(input.prepared);
  const s = source(input.prepared, target);
  const q = quiz(input.prepared);
  const aggregate: AggregatedChapterReviewV1 = {
    schema: "aggregated-chapter-review-v1",
    chapterContentSha256: chapterContentHash(input.prepared.chapter),
    readerResultSha256: hashCanonical(r),
    sourceResultSha256: hashCanonical(s),
    quizResultSha256: hashCanonical(q),
    deterministicCriticBundleSha256: "critic-bundle",
    readerComposite: 90,
    readerBar: 80,
    finalStatus: pass ? "PASS" : "REVISE",
    blockingReasons: [],
    revisionReasons: pass ? [] : ["fresh content defect"],
    escalationReasons: [],
  };
  const disposition: ForwardChapterConductorResultV1["disposition"] = pass ? "COMMITTED" : "SUPERSEDED";
  // Exercise the output-independent backup-reader shape on a stable coordinate.
  // A valid committed campaign result may contain four or five executions; it
  // must not be rejected merely because it preserved the frozen panel reads.
  const readerAuditSelected = target.chapterNumber === 1;
  const executions = [
    executionEntry("reader", "readerPrimary", 1),
    ...(readerAuditSelected ? [executionEntry("reader", "readerAudit", 2)] : []),
    executionEntry("source", "sourcePrimary", readerAuditSelected ? 3 : 2),
    executionEntry("quiz", "quizSemanticAdjudicator", readerAuditSelected ? 4 : 3),
  ];
  const envelope = {
    schema: FORWARD_REVIEW_ENVELOPE_SCHEMA,
    attemptId: input.prepared.attempt.identity.attemptId,
    candidateContentSha256: chapterContentHash(input.prepared.chapter),
    candidateBytesSha256: sha256Hex(input.prepared.bytes),
    sourceUsePlanSha256: target.sourceUsePlanSha256,
    sourcePacketSha256: stale ? "stale-packet" : target.sourcePacketSha256,
    sidecarSha256: target.sidecarSha256,
    anchorCatalogSha256: target.anchorCatalogSha256,
    frozenReviewConfigSha256: hashCanonical(input.frozen),
    roleAssignmentSha256: COMMON.roleAssignmentSha256,
    instrumentManifestSha256: COMMON.instrumentManifestSha256,
    panelPolicySha256: readerAuditSelected ? "panel-policy" : null,
    executions,
    derivationSha256: "derivation",
    deterministicCriticBundleSha256: "critic-bundle",
    readerResultSha256: hashCanonical(r),
    readerPrimaryCategory: pass ? "PASS" as const : "REVISE" as const,
    readerAuditSelected,
    readerAuditProfileId: readerAuditSelected ? "reader-model@high" : null,
    readerAuditResultSha256: readerAuditSelected ? hashCanonical(r) : null,
    readerAuditCategory: readerAuditSelected ? (pass ? "PASS" as const : "REVISE" as const) : null,
    readerAuditDisagreement: false,
    sourceResultSha256: hashCanonical(s),
    sourceAdjudicationTriggered: false,
    sourceAdjudicatorProfileId: null,
    sourceAdjudicatorResultSha256: null,
    sourceAdjudicationAgreement: null,
    quizResultSha256: hashCanonical(q),
    aggregateSha256: hashCanonical(aggregate),
    finalStatus: pass ? "PASS" as const : "REVISE" as const,
    disposition,
    failureReason: pass ? null : "fresh content defect",
  };
  return {
    schema: "forward-chapter-conductor-result-v1",
    disposition,
    finalStatus: pass ? "PASS" : "REVISE",
    reason: pass ? "fresh aggregate committed" : "fresh aggregate revised",
    reader: r,
    readerAudit: readerAuditSelected ? r : null,
    source: s,
    quiz: q,
    aggregate,
    committedDerivation: null,
    commitResult: pass ? { ok: true, sessionId: input.prepared.sessionId, committed: true } : null,
    executionEnvelope: envelope,
    executionEnvelopeSha256: hashCanonical(envelope),
  };
}

function frozenConfig(target: ForwardValidationTargetV1): ForwardChapterConductorInputV1["frozen"] {
  return {
    schema: "forward-frozen-review-config-v1",
    roleAssignment: {} as ForwardChapterConductorInputV1["frozen"]["roleAssignment"],
    roleAssignmentSha256: COMMON.roleAssignmentSha256,
    instrumentManifest: {} as ForwardChapterConductorInputV1["frozen"]["instrumentManifest"],
    instrumentManifestSha256: COMMON.instrumentManifestSha256,
    readerBar: target.chapterNumber > 0 ? 80 : 80,
  };
}

function campaignDeps(args: {
  frozen: FrozenForwardValidationManifestV1;
  evidenceMap: Map<string, Evidence>;
  root: string;
  passFor: (target: ForwardValidationTargetV1, stage: "first-write" | "repair" | "regeneration") => boolean;
  events?: string[];
  smuggleKey?: string;
  staleKey?: string;
  failedRepairDisposition?: (key: string) => "WRONG_ROUTE" | "WHOLE_CHAPTER_FAILURE" | "REPAIR_CONTENT_FAILURE" | "INFRASTRUCTURE";
}): ForwardValidationCampaignDeps {
  let ordinal = 0;
  const durable = new Map<string, unknown>();
  const targets = new Map(args.frozen.manifest.targets.map((target) => [`${target.bookId}/${target.chapterNumber}`, target]));
  return {
    produceCandidate: async (request): Promise<ForwardCandidateProductionV1> => {
      const key = `${request.target.bookId}/${request.target.chapterNumber}`;
      args.events?.push(`produce:${request.stage}:${key}`);
      const evidence = args.evidenceMap.get(key)!;
      const prepared = preparedFor(args.root, request.target, evidence, request.stage, ++ordinal);
      if (args.smuggleKey === key && request.stage === "first-write") writeFileSync(join(prepared.attempt.workspaceDir, "smuggled.txt"), "unexpected");
      const proof = destinationProof(args.root, request.target);
      const base = {
        ok: true as const,
        prepared,
        routeReceipt: {
          model: request.target.writerRoute.model,
          effort: request.target.writerRoute.effort,
          outputRunId: request.target.outputRunId,
          outputRelPath: request.target.outputRelPath,
          destinationProof: proof,
          destinationProofSha256: hashCanonical(proof),
        },
      };
      if (request.stage !== "repair") return base;
      const basePath = join(request.previous!.attemptDir!, "workspace", `${request.target.chapterId}.v21-native.chapter.json`);
      const patchBaseBytes = readFileSync(basePath, "utf8");
      const patchBaseChapter = JSON.parse(patchBaseBytes) as ChapterV21;
      const oldTakeaway = patchBaseChapter.keyTakeaway;
      const replacement = `${oldTakeaway} Repaired.`;
      const patch = {
        schema: "chapter-patch-v1" as const,
        chapterId: request.target.chapterId,
        expectedBaseHash: request.previous!.candidateBytesSha256!,
        sourcePlanHash: request.target.sourceUsePlanSha256,
        findingIds: ["finding-1"],
        operations: [{ path: "keyTakeaway", expectedOldValueHash: patchValueHash(oldTakeaway).slice(0, 16), replacement, dependencyUnitIds: [] }],
      };
      const repairedChapter = structuredClone(patchBaseChapter);
      repairedChapter.keyTakeaway = replacement;
      prepared.chapter = repairedChapter;
      prepared.bytes = JSON.stringify(repairedChapter, null, 2) + "\n";
      writeFileSync(prepared.attempt.candidatePath, prepared.bytes);
      writeFileSync(join(prepared.attempt.workspaceDir, "patch.json"), JSON.stringify(patch));
      return { ...base, prepared, patch, patchBase: { bytes: patchBaseBytes, chapter: patchBaseChapter } };
    },
    buildConductorInput: ({ target, prepared }) => {
      const evidence = args.evidenceMap.get(`${target.bookId}/${target.chapterNumber}`)!;
      return {
        prepared,
        sourcePacket: evidence.packet,
        sourceSidecar: evidence.sidecar,
        anchorCatalog: evidence.anchors,
        rereadAuthoritativeSourceEvidence: () => ({ sourceSidecar: evidence.sidecar, anchorCatalog: evidence.anchors }),
        frozen: frozenConfig(target),
      };
    },
    conductCandidate: async (input) => {
      const target = targets.get(`${input.prepared.bookId}/${input.prepared.chapterNumber}`)!;
      const stage = input.prepared.attempt.identity.attemptKind === "author-initial" ? "first-write"
        : input.prepared.attempt.identity.attemptKind === "author-regeneration" ? "regeneration" : "repair";
      args.events?.push(`conduct:${stage}:${target.bookId}/${target.chapterNumber}`);
      return conductorResult(input, target, args.passFor(target, stage), args.staleKey === `${target.bookId}/${target.chapterNumber}` && stage === "first-write");
    },
    routeFirstFailure: ({ target }) => target.chapterNumber % 2 === 1
      ? { kind: "repair", repairKind: "surgical", complaints: ["takeaway needs correction"], scopes: ["keyTakeaway"] }
      : { kind: "regeneration", complaints: ["whole chapter needs regeneration"] },
    classifyFailedRepair: ({ target }) => args.failedRepairDisposition?.(`${target.bookId}/${target.chapterNumber}`) ?? "REPAIR_CONTENT_FAILURE",
    preserveAttempt: (record, contentSha256) => {
      args.events?.push(`preserve:${record.stage}:${record.chapterKey}`);
      const storageId = `attempt:${record.chapterKey}:${record.stage}:${record.attemptId ?? "none"}`;
      durable.set(storageId, JSON.parse(JSON.stringify(record)));
      return { schema: FORWARD_PERSISTENCE_RECEIPT_SCHEMA, kind: "attempt", storageId, contentSha256 };
    },
    freezeFirstWriteMetrics: (snapshot, contentSha256) => {
      args.events?.push("freeze:first-write");
      const storageId = `first-write:${snapshot.experimentId}`;
      durable.set(storageId, JSON.parse(JSON.stringify(snapshot)));
      return { schema: FORWARD_PERSISTENCE_RECEIPT_SCHEMA, kind: "first-write-snapshot", storageId, contentSha256 };
    },
    readPersistedEvidence: (receipt) => durable.get(receipt.storageId),
  };
}

test("frozen pilot selection is deterministic, balanced 2×4, no-overlap, and risk-routed", () => {
  const evidenceMap = new Map<string, Evidence>();
  const books = [
    selectionBook("zeta", 4, evidenceMap),
    selectionBook("beta", 4, evidenceMap),
    selectionBook("alpha", 4, evidenceMap),
    selectionBook("qualification-only-book", 4, evidenceMap),
  ];
  const first = buildPilotManifest({ ...COMMON, books, goldReservedBookIds: ["zeta"] });
  const second = buildPilotManifest({ ...COMMON, books: [...books].reverse(), goldReservedBookIds: ["zeta"] });
  assert.equal(first.manifestSha256, second.manifestSha256);
  assert.deepEqual([...new Set(first.manifest.targets.map((target) => target.bookId))], ["alpha", "beta"]);
  assert.equal(first.manifest.targets.length, 8);
  for (const stratum of FORWARD_CHAPTER_STRATA) assert.equal(first.manifest.targets.filter((target) => target.stratum === stratum).length, 2);
  assert.ok(first.manifest.targets.filter((target) => target.stratum === "causal-quiz-sensitive").every((target) => target.writerRoute.effort === "xhigh"));
  assert.ok(first.manifest.targets.filter((target) => target.stratum !== "causal-quiz-sensitive").every((target) => target.writerRoute.effort === "high"));
  assert.deepEqual(first.manifest.capabilities, FORWARD_VALIDATION_CAPABILITIES);
  assert.ok(Object.isFrozen(first.manifest));
});

test("systemic correction ids are contiguous and stop after two verified cycles", () => {
  const root: VerifiedSystemicRootCauseV1 = {
    classification: "MODEL_ROUTING",
    rootCauseId: "wrong-central-route",
    severity: "P2",
    affectedChapterKeys: ["book/ch01", "book/ch02"],
    regressionTestId: "forward-validation-campaign:route",
  };
  assert.equal(nextPilotCorrectionExperimentId([PILOT_EXPERIMENT_ID], root), `${PILOT_EXPERIMENT_ID}-correction-1`);
  assert.equal(nextPilotCorrectionExperimentId([PILOT_EXPERIMENT_ID, `${PILOT_EXPERIMENT_ID}-correction-1`], root), `${PILOT_EXPERIMENT_ID}-correction-2`);
  assert.throws(() => nextPilotCorrectionExperimentId([PILOT_EXPERIMENT_ID, `${PILOT_EXPERIMENT_ID}-correction-1`, `${PILOT_EXPERIMENT_ID}-correction-2`], root), /two systemic correction cycles are exhausted/);
  assert.throws(() => nextPilotCorrectionExperimentId([PILOT_EXPERIMENT_ID], { ...root, affectedChapterKeys: ["book/ch01"] }), /at least two chapters/);
  const evidenceMap = new Map<string, Evidence>();
  const books = [selectionBook("corrected-a", 4, evidenceMap), selectionBook("corrected-b", 4, evidenceMap)];
  assert.throws(() => buildPilotManifest({
    ...COMMON,
    books,
    correctionCycle: 1,
    priorPilotExperimentIds: [PILOT_EXPERIMENT_ID],
    priorThresholdsSha256: "different-thresholds",
    verifiedSystemicRootCause: root,
  }), /retain the prior frozen thresholds hash/);
  const corrected = buildPilotManifest({
    ...COMMON,
    books,
    correctionCycle: 1,
    priorPilotExperimentIds: [PILOT_EXPERIMENT_ID],
    priorThresholdsSha256: COMMON.thresholdsSha256,
    verifiedSystemicRootCause: root,
  });
  assert.equal(corrected.manifest.experimentId, `${PILOT_EXPERIMENT_ID}-correction-1`);
});

test("live deferred-author adapter rejects incomplete experiment IO before any writer spawn", async () => {
  const { frozen } = pilotFixture();
  const target = frozen.manifest.targets[0];
  const root = mkdtempSync(join(tmpdir(), "forward-io-proof-"));
  let spawnCalls = 0;
  try {
    const producer = createDeferredAuthorProducer({
      deps: {
        spawn: async () => { spawnCalls += 1; throw new Error("spawn must remain unreachable"); },
      } as unknown as AutopilotDeps,
      ioFor: () => ({
        io: {} as AuthorIo,
        destinationProof: destinationProof(root, target),
      }),
    });
    await assert.rejects(() => producer({
      manifestSha256: frozen.manifestSha256,
      target,
      stage: "first-write",
      sequence: 1,
      complaints: [],
      repairScopes: [],
      previous: null,
    }), /incomplete AuthorIo.*canonical defaults are forbidden/i);
    assert.equal(spawnCalls, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a no-op durable evidence sink fails before the campaign can advance to another candidate or repair", async () => {
  const { frozen, evidenceMap } = pilotFixture();
  const root = mkdtempSync(join(tmpdir(), "forward-noop-sink-"));
  let productions = 0;
  try {
    const deps = campaignDeps({ frozen, evidenceMap, root, passFor: () => true });
    const produce = deps.produceCandidate;
    deps.produceCandidate = async (request) => { productions += 1; return produce(request); };
    deps.preserveAttempt = (_record, contentSha256) => ({
      schema: FORWARD_PERSISTENCE_RECEIPT_SCHEMA,
      kind: "attempt",
      storageId: "claimed-but-not-written",
      contentSha256,
    });
    deps.readPersistedEvidence = () => undefined;
    await assert.rejects(() => runForwardValidationCampaign(frozen, deps), /durable read-back returned no artifact/i);
    assert.equal(productions, 1, "campaign stops at the first unverifiable sink receipt");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("eight-chapter pilot freezes six-of-eight first writes before bounded finalization and reaches eight PASS", async () => {
  const { frozen, evidenceMap } = pilotFixture();
  const root = mkdtempSync(join(tmpdir(), "forward-pilot-campaign-"));
  const events: string[] = [];
  const firstFailures = new Set(frozen.manifest.targets.slice(-2).map((target) => `${target.bookId}/${target.chapterNumber}`));
  try {
    const deps = campaignDeps({
      frozen,
      evidenceMap,
      root,
      events,
      passFor: (target, stage) => stage !== "first-write" || !firstFailures.has(`${target.bookId}/${target.chapterNumber}`),
    });
    const [repairKey] = [...firstFailures];
    deps.routeFirstFailure = ({ target }) => `${target.bookId}/${target.chapterNumber}` === repairKey
      ? { kind: "repair", repairKind: "surgical", complaints: ["takeaway needs correction"], scopes: ["keyTakeaway"] }
      : { kind: "regeneration", complaints: ["whole chapter needs regeneration"] };
    const result = await runForwardValidationCampaign(frozen, deps);
    assert.equal(result.accepted, true, [
      ...result.hardFailures,
      ...result.attempts.flatMap((attempt) => attempt.failureReasons.map((reason) => `${attempt.chapterKey}/${attempt.stage}: ${reason}`)),
    ].join("; "));
    assert.equal(result.firstWriteSnapshot.passCount, 6);
    assert.equal(result.accounting.firstWritePassRate, 0.75);
    assert.equal(result.accounting.finalPassCount, 8);
    assert.equal(result.accounting.finalPassRate, 1);
    assert.equal(result.accounting.repairAttempts, 1);
    assert.equal(result.accounting.fullRegenerations, 1);
    assert.ok(events.indexOf("freeze:first-write") < events.findIndex((event) => event.startsWith("produce:repair") || event.startsWith("produce:regeneration")));
    assert.equal(result.attempts.filter((attempt) => attempt.executionEnvelope).length, 10);
    assert.ok(result.attempts.every((attempt) => attempt.attemptDir !== null));
    assert.deepEqual(result.capabilitiesUsed, { publish: false, promote: false, deploy: false, upload: false });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("campaign resumes exact preserved partial progress without reminting completed attempts", async () => {
  const { frozen, evidenceMap } = pilotFixture();
  const root = mkdtempSync(join(tmpdir(), "forward-campaign-resume-"));
  try {
    const seed = await runForwardValidationCampaign(frozen, campaignDeps({
      frozen, evidenceMap, root, passFor: () => true,
    }));
    const retainedPartial = new Map(seed.attempts.slice(0, 4).map((record) => [`${record.chapterKey}:${record.stage}`, record]));
    const resumedDeps = campaignDeps({ frozen, evidenceMap, root, passFor: () => true });
    let productions = 0;
    const produce = resumedDeps.produceCandidate;
    resumedDeps.produceCandidate = async (request) => { productions += 1; return produce(request); };
    resumedDeps.loadPreservedAttempt = ({ target, stage }) => retainedPartial.get(
      `${target.bookId}/ch${String(target.chapterNumber).padStart(2, "0")}:${stage}`,
    ) ?? null;
    const resumed = await runForwardValidationCampaign(frozen, resumedDeps);
    assert.equal(productions, 4, "only the four missing first writes are produced after a partial crash");
    assert.deepEqual(
      resumed.attempts.slice(0, 4).map((record) => record.attemptId),
      seed.attempts.slice(0, 4).map((record) => record.attemptId),
    );

    const exactDeps = campaignDeps({ frozen, evidenceMap, root, passFor: () => true });
    let exactProductions = 0;
    const exactProduce = exactDeps.produceCandidate;
    exactDeps.produceCandidate = async (request) => { exactProductions += 1; return exactProduce(request); };
    const retainedAll = new Map(resumed.attempts.map((record) => [`${record.chapterKey}:${record.stage}`, record]));
    exactDeps.loadPreservedAttempt = ({ target, stage }) => retainedAll.get(
      `${target.bookId}/ch${String(target.chapterNumber).padStart(2, "0")}:${stage}`,
    ) ?? null;
    const exact = await runForwardValidationCampaign(frozen, exactDeps);
    assert.equal(exactProductions, 0);
    assert.equal(exact.firstWriteSnapshotSha256, resumed.firstWriteSnapshotSha256);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("typed repair is independently applied to the preserved base; caller-crafted out-of-scope candidate drift is rejected", async () => {
  const { frozen, evidenceMap } = pilotFixture();
  const root = mkdtempSync(join(tmpdir(), "forward-repair-apply-proof-"));
  const failedKey = `${frozen.manifest.targets[0].bookId}/${frozen.manifest.targets[0].chapterNumber}`;
  try {
    const deps = campaignDeps({
      frozen,
      evidenceMap,
      root,
      passFor: (target, stage) => stage !== "first-write" || `${target.bookId}/${target.chapterNumber}` !== failedKey,
    });
    deps.routeFirstFailure = () => ({ kind: "repair", repairKind: "surgical", complaints: ["takeaway defect"], scopes: ["keyTakeaway"] });
    const produce = deps.produceCandidate;
    deps.produceCandidate = async (request) => {
      const production = await produce(request);
      if (request.stage === "repair" && production.ok) {
        production.prepared.chapter.title = "Caller-smuggled title drift";
        production.prepared.bytes = JSON.stringify(production.prepared.chapter, null, 2) + "\n";
        writeFileSync(production.prepared.attempt.candidatePath, production.prepared.bytes);
      }
      return production;
    };
    const result = await runForwardValidationCampaign(frozen, deps);
    const repair = result.attempts.find((attempt) => attempt.stage === "repair" && attempt.chapterKey.startsWith(frozen.manifest.targets[0].bookId));
    assert.ok(repair);
    assert.equal(repair!.failureClassification, "STATE_OR_PROVENANCE");
    assert.match(repair!.failureReasons.join(" "), /not the independently applied typed patch/i);
    assert.equal(result.accepted, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("repair is single-shot; only explicit WRONG_ROUTE may spend one regeneration", async () => {
  const { frozen, evidenceMap } = pilotFixture();
  const root = mkdtempSync(join(tmpdir(), "forward-repair-budget-"));
  const failed = new Set(frozen.manifest.targets.slice(-2).map((target) => `${target.bookId}/${target.chapterNumber}`));
  const [contentKey, wrongRouteKey] = [...failed];
  try {
    const deps = campaignDeps({
      frozen,
      evidenceMap,
      root,
      passFor: (target, stage) => {
        const key = `${target.bookId}/${target.chapterNumber}`;
        if (!failed.has(key)) return true;
        if (stage === "first-write" || stage === "repair") return false;
        return key === wrongRouteKey;
      },
      failedRepairDisposition: (key) => key === wrongRouteKey ? "WRONG_ROUTE" : "REPAIR_CONTENT_FAILURE",
    });
    // Force both failed coordinates down the repair route for this policy test.
    deps.routeFirstFailure = () => ({ kind: "repair", repairKind: "surgical", complaints: ["takeaway defect"], scopes: ["keyTakeaway"] });
    const result = await runForwardValidationCampaign(frozen, deps);
    const chapterKeyOf = (key: string) => {
      const [book, n] = key.split("/");
      return `${book}/ch${String(Number(n)).padStart(2, "0")}`;
    };
    assert.deepEqual(result.attempts.filter((a) => a.chapterKey === chapterKeyOf(contentKey)).map((a) => a.stage), ["first-write", "repair"]);
    assert.deepEqual(result.attempts.filter((a) => a.chapterKey === chapterKeyOf(wrongRouteKey)).map((a) => a.stage), ["first-write", "repair", "regeneration"]);
    assert.equal(result.accounting.repairAttempts, 2);
    assert.equal(result.accounting.fullRegenerations, 1);
    assert.equal(result.accounting.repeatedOrUnboundedRepair, 0);
    assert.equal(result.accepted, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("unexpected writer files fail closed before review and preserve the failed attempt", async () => {
  const { frozen, evidenceMap } = pilotFixture();
  const root = mkdtempSync(join(tmpdir(), "forward-unexpected-write-"));
  const bad = frozen.manifest.targets[0];
  let conductorCalls = 0;
  try {
    const deps = campaignDeps({
      frozen,
      evidenceMap,
      root,
      smuggleKey: `${bad.bookId}/${bad.chapterNumber}`,
      passFor: () => true,
    });
    const conductor = deps.conductCandidate!;
    deps.conductCandidate = async (input) => { conductorCalls += 1; return conductor(input); };
    const result = await runForwardValidationCampaign(frozen, deps);
    const record = result.attempts.find((attempt) => attempt.chapterKey === `${bad.bookId}/ch${String(bad.chapterNumber).padStart(2, "0")}`)!;
    assert.equal(conductorCalls, 7);
    assert.equal(record.disposition, "NOT_REVIEWED");
    assert.match(record.failureReasons.join(" "), /unexpected workspace write/);
    assert.equal(JSON.parse(readFileSync(join(record.attemptDir!, "outcome.json"), "utf8")).outcome, "unexpected_write");
    assert.equal(result.accepted, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("stale review/source envelope is never accepted and cannot route to content repair", async () => {
  const { frozen, evidenceMap } = pilotFixture();
  const root = mkdtempSync(join(tmpdir(), "forward-stale-envelope-"));
  const bad = frozen.manifest.targets[0];
  const events: string[] = [];
  try {
    const deps = campaignDeps({
      frozen,
      evidenceMap,
      root,
      events,
      staleKey: `${bad.bookId}/${bad.chapterNumber}`,
      passFor: () => true,
    });
    const result = await runForwardValidationCampaign(frozen, deps);
    const key = `${bad.bookId}/ch${String(bad.chapterNumber).padStart(2, "0")}`;
    const record = result.finalByChapter[key];
    assert.equal(record.pass, false);
    assert.equal(record.finalStatus, "INCONCLUSIVE");
    assert.equal(record.failureClassification, "STATE_OR_PROVENANCE");
    assert.match(record.failureReasons.join(" "), /stale source packet/);
    assert.ok(!events.some((event) => event === `produce:repair:${bad.bookId}/${bad.chapterNumber}` || event === `produce:regeneration:${bad.bookId}/${bad.chapterNumber}`));
    assert.equal(result.accounting.staleEvidenceAccepted, 0);
    assert.equal(result.accepted, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("gold selection prefers unused 8–12 chapter books, admits a complete 13-chapter book, and rejects fewer than eight", () => {
  const evidenceMap = new Map<string, Evidence>();
  const books = [
    selectionBook("gold-twelve", 12, evidenceMap),
    selectionBook("gold-eight", 8, evidenceMap),
    selectionBook("pilot-alpha", 10, evidenceMap),
  ];
  const frozen = buildGoldManifest({
    ...COMMON,
    books,
    pilotBookIds: ["pilot-alpha"],
    pilotAccepted: true,
    pilotManifestSha256: "p".repeat(64),
    pilotResultSha256: "o".repeat(64),
  });
  assert.equal(frozen.manifest.experimentId, GOLD_EXPERIMENT_ID);
  assert.equal(frozen.manifest.targets.length, 8);
  assert.ok(frozen.manifest.targets.every((target) => target.bookId === "gold-eight"));
  const long = buildGoldManifest({
    ...COMMON,
    books: [selectionBook("long", 13, evidenceMap)],
    pilotBookIds: [],
    pilotAccepted: true,
    pilotManifestSha256: "p".repeat(64),
    pilotResultSha256: "o".repeat(64),
  });
  assert.equal(long.manifest.targets.length, 13, "a full book above the preferred range must not be truncated");
  const onlyInvalid = [selectionBook("short", 7, evidenceMap)];
  assert.throws(() => buildGoldManifest({
    ...COMMON,
    books: onlyInvalid,
    pilotBookIds: [],
    pilotAccepted: true,
    pilotManifestSha256: "p".repeat(64),
    pilotResultSha256: "o".repeat(64),
  }), /at least 8 chapters/);
});

test("fresh eight-chapter gold dry run requires fresh sweep, all hard gates, score, and no publish capability", async () => {
  const evidenceMap = new Map<string, Evidence>();
  const frozen = buildGoldManifest({
    ...COMMON,
    books: [selectionBook("gold-clean", 8, evidenceMap)],
    pilotBookIds: ["pilot-alpha", "pilot-beta"],
    pilotAccepted: true,
    pilotManifestSha256: "p".repeat(64),
    pilotResultSha256: "o".repeat(64),
  });
  const root = mkdtempSync(join(tmpdir(), "forward-gold-campaign-"));
  try {
    const deps = campaignDeps({ frozen, evidenceMap, root, passFor: () => true });
    const goldDurable = new Map<string, unknown>();
    const baseReadPersistedEvidence = deps.readPersistedEvidence;
    deps.readPersistedEvidence = (receipt) => goldDurable.has(receipt.storageId)
      ? goldDurable.get(receipt.storageId)
      : baseReadPersistedEvidence(receipt);
    deps.evaluateGoldBook = async ({ manifest, finalByChapter }) => {
      const contentHashes: Record<string, string> = {};
      for (const target of manifest.targets) contentHashes[String(target.chapterNumber)] = finalByChapter[`${target.bookId}/ch${String(target.chapterNumber).padStart(2, "0")}`].candidateContentSha256!;
      const sweep: SweepRecord = {
        schemaVersion: "sweep-attest-v1",
        bookId: manifest.targets[0].bookId,
        roundId: "fresh-gold-sweep-1",
        verdict: "PASS",
        reviewer: "independent-gold-sweep",
        reviewerSessionId: "gold-sweep-session",
        attestedAt: "2026-07-12T13:00:00.000Z",
        contentHashes,
        checkedFamilies: [...REQUIRED_SWEEP_FAMILIES],
        findings: [],
      };
      const evaluationCore = {
        technicalCompleteness: "PASS" as const,
        epistemicInstructionalSafety: "PASS" as const,
        ethicsReaderAutonomy: "PASS" as const,
        purposeAudienceDeclaration: "PASS" as const,
        externalAccuracy: "PASS" as const,
        contentDesignScore: 84,
        sweep,
      };
      const evaluatorPayloadSha256 = hashCanonical({
        technicalCompleteness: evaluationCore.technicalCompleteness,
        epistemicInstructionalSafety: evaluationCore.epistemicInstructionalSafety,
        ethicsReaderAutonomy: evaluationCore.ethicsReaderAutonomy,
        purposeAudienceDeclaration: evaluationCore.purposeAudienceDeclaration,
        externalAccuracy: evaluationCore.externalAccuracy,
        contentDesignScore: evaluationCore.contentDesignScore,
      });
      const persistGold = (
        kind: "gold-evaluator" | "gold-rater" | "gold-sweep",
        actorId: string,
        executionId: string,
        payloadSha256: string,
      ) => {
        const artifact = {
          schema: FORWARD_GOLD_EVIDENCE_SCHEMA,
          kind,
          actorId,
          executionId,
          finalChapterContentHashes: contentHashes,
          payloadSha256,
        };
        const artifactSha256 = hashCanonical(artifact);
        const storageId = `${kind}:${executionId}`;
        goldDurable.set(storageId, JSON.parse(JSON.stringify(artifact)));
        return {
          actorId,
          executionId,
          payloadSha256,
          artifactSha256,
          receipt: { schema: FORWARD_PERSISTENCE_RECEIPT_SCHEMA, kind, storageId, contentSha256: artifactSha256 },
        };
      };
      const raterOneSha256 = hashCanonical({ verdict: "PASS", score: 83, rater: "blind-rater-a" });
      const raterTwoSha256 = hashCanonical({ verdict: "PASS", score: 85, rater: "blind-rater-b" });
      return {
        ...evaluationCore,
        evidenceBinding: {
          finalChapterContentHashes: contentHashes,
          evaluator: persistGold("gold-evaluator", "fresh-gold-evaluator", "gold-evaluator-exec-1", evaluatorPayloadSha256),
          raters: [
            persistGold("gold-rater", "blind-rater-a", "gold-rater-exec-a", raterOneSha256),
            persistGold("gold-rater", "blind-rater-b", "gold-rater-exec-b", raterTwoSha256),
          ],
          sweep: persistGold("gold-sweep", "independent-gold-sweep", "gold-sweep-session", hashCanonical(sweep)),
        },
      };
    };
    const result = await runForwardValidationCampaign(frozen, deps);
    assert.equal(result.accepted, true, result.hardFailures.join("; "));
    assert.equal(result.accounting.firstWritePassRate, 1);
    assert.equal(result.accounting.finalPassRate, 1);
    assert.equal(result.goldEvaluation?.contentDesignScore, 84);
    assert.equal(result.persistenceReceipts.filter((receipt) => receipt.kind.startsWith("gold-")).length, 4);
    assert.deepEqual(result.capabilitiesUsed, { publish: false, promote: false, deploy: false, upload: false });

    const rejectedRoot = mkdtempSync(join(tmpdir(), "forward-gold-stale-evidence-"));
    try {
      const rejectedDeps = campaignDeps({ frozen, evidenceMap, root: rejectedRoot, passFor: () => true });
      const rejectedBaseRead = rejectedDeps.readPersistedEvidence;
      rejectedDeps.readPersistedEvidence = (receipt) => goldDurable.has(receipt.storageId)
        ? goldDurable.get(receipt.storageId)
        : rejectedBaseRead(receipt);
      const cleanEvaluation = deps.evaluateGoldBook!;
      rejectedDeps.evaluateGoldBook = async (args) => {
        const evaluation = await cleanEvaluation(args);
        const rater = evaluation.evidenceBinding.raters[0];
        const artifact = goldDurable.get(rater.receipt.storageId) as Record<string, unknown>;
        goldDurable.set(rater.receipt.storageId, {
          ...artifact,
          finalChapterContentHashes: { "1": "stale-after-evaluation" },
        });
        return evaluation;
      };
      const rejected = await runForwardValidationCampaign(frozen, rejectedDeps);
      assert.equal(rejected.accepted, false, "stale persisted rater evidence fails the gold gate");
      assert.match(rejected.hardFailures.join(" "), /gold evidence binding failed.*gold-rater.*read-back hash/i);
    } finally {
      rmSync(rejectedRoot, { recursive: true, force: true });
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
