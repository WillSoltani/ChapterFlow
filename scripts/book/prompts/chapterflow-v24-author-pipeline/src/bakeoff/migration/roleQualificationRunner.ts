/**
 * IMP-22 additive per-role qualification runner.
 *
 * The runner is deliberately model-free: every reviewer call crosses one injected
 * executor seam, with an exact profile/model/effort/schema receipt checked before
 * output is parsed.  Corpora, candidate order, thresholds, schemas, prompts, and
 * the balanced maxParallel=2 schedule are hashed before the first call and are
 * rechecked before every attempt.  Calibration is a protocol-only barrier and is
 * never included in holdout metrics.
 */

import type { SourcePacketV1 } from "../../artifacts/artifactTypes.js";
import { renderSourceUsePlanLines } from "../../compiler/sourceUsePlanCompiler.js";
import type { EffortLevelV1 } from "../../contracts/executionProfile.js";
import { hashCanonical, sha256Hex } from "../../contracts/contractUtil.js";
import type { ReaderExperienceReviewV1 } from "../../contracts/readerExperienceReview.js";
import type { SourceIntegrityReviewUnitV1, SourceIntegrityReviewV1 } from "../../contracts/sourceIntegrityReview.js";
import { validateSourceIntegrityReview } from "../../contracts/sourceIntegrityReview.js";
import type { QuizIntegrityResultV1 } from "../../contracts/quizIntegrityReview.js";
import { ensureTrailingNewline } from "../../lib/atomicWrite.js";
import type { ChapterV21, SourceAnchorForPrompt } from "../../types.js";
import { BASELINE_MODEL } from "../../orchestrator/modelPolicy.js";
import {
  assembleReaderExperienceReview,
  buildReaderExperienceTask,
  parseReaderExperienceReview,
  readerExperienceDocHash,
} from "../../review/readerExperienceReview.js";
import { renderChapterReaderDocPhase1 } from "../../review/renderReaderDoc.js";
import {
  SOURCE_INTEGRITY_REVIEWER_ROLE,
  buildSourceIntegrityTask,
  parseSourceIntegrityReview,
  runSourceIntegrityReview,
  type SourceReviewPacketV1,
} from "../../review/sourceIntegrityReview.js";
import {
  QUIZ_INTEGRITY_ADJUDICATION_SCHEMA,
  buildQuizIntegrityAdjudicationTask,
  parseQuizIntegrityAdjudication,
  runQuizIntegrityLane,
  validateQuizIntegrityAdjudication,
} from "../../review/quizIntegrityReview.js";
import {
  buildQuizDerivation,
  commitQuizDerivation,
  quizItemId,
  renderQuizPhase2Doc,
} from "../../review/quizDerivation.js";
import type { ReaderCorpusCaseV2 } from "./readerCorpusBuilder.js";
import type { Imp22SourceCorpusCaseV2 } from "./sourceCorpusBuilder.js";
import type { QuizCorpusCaseV2 } from "./quizCorpusBuilder.js";
import {
  canonicalPretty,
  CORPUS_PARTITIONS_V2,
  SPLIT_LANE_CORPUS_V2_SCHEMA,
  type CorpusPartitionV2,
  type SplitLaneRoleCorpusV2,
} from "./corpusBuilderCore.js";
import {
  RECOVERY_ROLE_THRESHOLDS_SCHEMA,
  REQUIRED_ROLE_SET_SCHEMA,
  ROLE_QUALIFICATION_OUTCOME_SCHEMA,
  ROLE_QUALIFICATION_REGISTRY_SCHEMA,
  type RecoveryRoleThresholdsV1,
  type ReviewLaneRole,
  type RoleMetricDenominatorsV1,
  type RoleMetricRatesV1,
  type RoleQualificationOutcomeV1,
  type RoleQualificationRegistryV1,
} from "./reviewLaneTypes.js";
import {
  assembleJudgeQualification,
  assertRoleSetReady,
  qualifyRole,
} from "./roleQualification.js";

export const ROLE_QUALIFICATION_RUNNER_SCHEMA = "imp22-role-qualification-runner-v1" as const;
export const ROLE_QUALIFICATION_FREEZE_SCHEMA = "imp22-role-qualification-freeze-v1" as const;
export const ROLE_QUALIFICATION_REQUEST_SCHEMA = "imp22-role-qualification-execution-request-v1" as const;
export const ROLE_QUALIFICATION_RECEIPT_SCHEMA = "imp22-role-qualification-execution-receipt-v1" as const;
export const ROLE_QUALIFICATION_ATTEMPT_SCHEMA = "imp22-role-qualification-attempt-v1" as const;
export const ROLE_QUALIFICATION_CALIBRATION_SCHEMA = "imp22-role-qualification-calibration-v1" as const;
export const ROLE_QUALIFICATION_CANDIDATE_AVAILABILITY_SCHEMA = "imp22-role-candidate-availability-v1" as const;
export const ROLE_QUALIFICATION_CALIBRATION_INSPECTION_SCHEMA = "imp22-role-calibration-inspection-v1" as const;
export const ROLE_QUALIFICATION_CALIBRATION_INSPECTION_STATEMENT =
  "I inspected all retained calibration requests, receipts, parsed evaluations, and source refusal-probe evidence and approve this exact seal for holdout." as const;
export const MISSING_EVIDENCE_PROBE_VERSION = "source-missing-evidence-refusal-probe-v1" as const;
export const ROLE_QUALIFICATION_MAX_PARALLEL = 2 as const;

const MISSING_EVIDENCE_PROBE_INSTRUMENT = Object.freeze({
  version: MISSING_EVIDENCE_PROBE_VERSION,
  sourceRuntime: "runSourceIntegrityReview",
  expected: "SourceIntegrityLaneError refusal before spawn when sidecar is missing",
});

const ROLES: readonly ReviewLaneRole[] = ["reader", "source", "quiz"];
const ABC = "abc";

export const IMP22_ROLE_METRIC_IDS = {
  reader: [
    "schemaValidity", "hardBlockerSensitivity", "hardBlockerFalsePositiveFree",
    "cleanControlPassRate", "craftCalibrationAccuracy", "evidenceSpanValidity",
    "requiredCasesResolved",
  ],
  source: [
    "schemaValidity", "fabricationSensitivity", "causalOverreachSensitivity",
    "sourceContradictionSensitivity", "highSeverityFalsePositiveFree", "cleanCasePassRate",
    "supportStatusAccuracy", "visibleRegisterAccuracy", "evidenceSpanValidity",
    "missingEvidenceInconclusive", "requiredCasesResolved",
  ],
  quiz: [
    "schemaValidity", "wrongKeyDetection", "cleanUniquePassRate", "ambiguityDetection",
    "mechanismAccuracy", "evidenceSpanValidity", "requiredCasesResolved",
  ],
} as const;

export type QualificationProfileV1 = {
  profileId: string;
  model: string;
  effort: EffortLevelV1;
};

const profile = (model: string, effort: EffortLevelV1): QualificationProfileV1 => ({
  profileId: `${model}@${effort}`,
  model,
  effort,
});

export const DEFAULT_IMP22_ROLE_CANDIDATE_ORDER: Record<ReviewLaneRole, readonly QualificationProfileV1[]> = {
  reader: [profile("gpt-5.6-sol", "high"), profile(BASELINE_MODEL, "high"), profile("gpt-5.6-sol", "xhigh"), profile(BASELINE_MODEL, "xhigh")],
  source: [profile("gpt-5.6-sol", "xhigh"), profile(BASELINE_MODEL, "xhigh"), profile("gpt-5.6-sol", "high"), profile(BASELINE_MODEL, "high")],
  quiz: [profile("gpt-5.6-sol", "xhigh"), profile(BASELINE_MODEL, "xhigh"), profile("gpt-5.6-sol", "high"), profile(BASELINE_MODEL, "high")],
};

export type RoleQualificationCorporaV2 = {
  reader: SplitLaneRoleCorpusV2<ReaderCorpusCaseV2>;
  source: SplitLaneRoleCorpusV2<Imp22SourceCorpusCaseV2>;
  quiz: SplitLaneRoleCorpusV2<QuizCorpusCaseV2>;
};

export type RoleQualificationSchemaHashesV1 = Record<ReviewLaneRole, string>;

/** The committed IMP-22 file predates the longer exported schema constant. Both
 * tags are accepted without rewriting the caller's frozen threshold bytes. */
export type Imp22RoleThresholdsV1 = Omit<RecoveryRoleThresholdsV1, "schema"> & {
  schema: typeof RECOVERY_ROLE_THRESHOLDS_SCHEMA | "recovery-role-thresholds-v1";
};

export type RoleQualificationExecutionArtifactV1 = {
  kind: "phase1-doc" | "source-evidence" | "source-plan" | "phase2-doc";
  relPath: string;
  content: string;
  sha256: string;
};

export type RoleQualificationExecutionRequestV1 = {
  schema: typeof ROLE_QUALIFICATION_REQUEST_SCHEMA;
  scheduleId: string;
  attemptId: string;
  replayOfAttemptId: string | null;
  attemptNumber: 1 | 2;
  role: ReviewLaneRole;
  partition: CorpusPartitionV2;
  caseId: string;
  family: string;
  profileId: string;
  model: string;
  effort: EffortLevelV1;
  schemaSha256: string;
  promptSha256: string;
  freezeSha256: string;
  task: string;
  artifacts: readonly RoleQualificationExecutionArtifactV1[];
};

export type QualificationReceiptStatus =
  | "completed"
  | "timeout"
  | "provider_capacity"
  | "transient_execution_failure"
  | "refusal"
  | "policy_failure"
  | "invalid_output"
  | "integrity_failure";

export type RoleQualificationExecutionReceiptV1 = {
  schema: typeof ROLE_QUALIFICATION_RECEIPT_SCHEMA;
  executionId: string;
  status: QualificationReceiptStatus;
  role: ReviewLaneRole;
  profileId: string;
  model: string;
  effort: EffortLevelV1;
  schemaSha256: string;
  rawOutput: string | null;
  failureDetail?: string;
};

export type RoleQualificationExecutor = (
  request: RoleQualificationExecutionRequestV1,
) => Promise<RoleQualificationExecutionReceiptV1>;

export type CaseEvaluationV1 = {
  protocolValid: boolean;
  resolved: boolean;
  evidenceSpanValid: boolean;
  error: string | null;
  result: "PASS" | "REVISE" | "BLOCK" | "INCONCLUSIVE" | null;
  blockingCategories: string[];
  supportStatus: string | null;
  visibleRegister: string | null;
  keyCorrect: "correct" | "ambiguous" | "wrong" | null;
  keyedMechanismSupported: boolean | null;
};

export type RoleQualificationAttemptV1 = {
  schema: typeof ROLE_QUALIFICATION_ATTEMPT_SCHEMA;
  scheduleId: string;
  attemptId: string;
  replayOfAttemptId: string | null;
  attemptNumber: 1 | 2;
  role: ReviewLaneRole;
  partition: CorpusPartitionV2;
  caseId: string;
  family: string;
  profileId: string;
  receipt: RoleQualificationExecutionReceiptV1 | null;
  routeValid: boolean;
  replayEligible: boolean;
  rawOutputSha256: string | null;
  evaluation: CaseEvaluationV1 | null;
  terminalReason: string;
};

export type QualificationScheduleEntryV1 = {
  scheduleId: string;
  ordinal: number;
  wave: number;
  partition: CorpusPartitionV2;
  role: ReviewLaneRole;
  profileId: string;
  caseId: string;
  family: string;
  promptSha256: string;
  caseSha256: string;
};

export type RoleQualificationFreezeV1 = {
  schema: typeof ROLE_QUALIFICATION_FREEZE_SCHEMA;
  maxParallel: typeof ROLE_QUALIFICATION_MAX_PARALLEL;
  candidateOrderSha256: string;
  thresholdsSha256: string;
  schemaHashesSha256: string;
  candidateAvailabilitySha256: string;
  corpusHashes: Record<ReviewLaneRole, string>;
  corpusEnvelopeHashes: Record<ReviewLaneRole, string>;
  promptBundleHashes: Record<ReviewLaneRole, string>;
  scheduleSha256: string;
  missingEvidenceProbeSha256: string;
  freezeSha256: string;
};

export type CandidateAvailabilityStatusV1 = "AVAILABLE" | "UNAVAILABLE";

export type RoleQualificationCandidateAvailabilityEntryV1 = {
  role: ReviewLaneRole;
  ordinal: number;
  profileId: string;
  model: string;
  effort: EffortLevelV1;
  status: CandidateAvailabilityStatusV1;
  modelListed: boolean;
  visible: boolean;
  effortSupported: boolean;
  requiredForCalibration: boolean;
  reason: string;
};

/** Deterministic, zero-call discovery result derived by the live boundary from
 * the frozen local Codex model-cache policy. The core runner treats it as an
 * input contract and never attempts availability-based reordering. */
export type RoleQualificationCandidateAvailabilityV1 = {
  schema: typeof ROLE_QUALIFICATION_CANDIDATE_AVAILABILITY_SCHEMA;
  source: "codex-local-models-cache";
  sourceFile: "models_cache.json";
  sourceBytesSha256: string;
  sourceFetchedAt: string;
  policyBytesSha256: string;
  candidateOrderSha256: string;
  entries: readonly RoleQualificationCandidateAvailabilityEntryV1[];
  calibrationCandidatesAvailable: boolean;
  availabilitySha256: string;
};

export type RoleMetricLedgerV1 = {
  metrics: RoleMetricRatesV1;
  denominators: RoleMetricDenominatorsV1;
  numerators: Record<string, number>;
  counts: {
    hardFalsePositives: number;
    highSeverityFalsePositives: number;
    unresolvedRequiredCases: number;
  };
};

export type ProfileRoleQualificationV1 = {
  role: ReviewLaneRole;
  profile: QualificationProfileV1;
  candidateIndex: number;
  calibrationCompleted: boolean;
  calibrationValid: boolean;
  holdoutStarted: boolean;
  holdoutCaseCount: number;
  metrics: RoleMetricLedgerV1;
  outcome: RoleQualificationOutcomeV1;
};

export type SourceMissingEvidenceProbeV1 = {
  profileId: string;
  version: typeof MISSING_EVIDENCE_PROBE_VERSION;
  passed: boolean;
  executorCalls: 0;
  observed: string;
  probeSha256: string;
};

export type RoleQualificationRunnerResultV1 = {
  schema: typeof ROLE_QUALIFICATION_RUNNER_SCHEMA;
  freeze: Readonly<RoleQualificationFreezeV1>;
  schedule: readonly QualificationScheduleEntryV1[];
  attempts: readonly RoleQualificationAttemptV1[];
  sourceMissingEvidenceProbes: readonly SourceMissingEvidenceProbeV1[];
  calibrationInspection?: Readonly<RoleQualificationCalibrationInspectionV1>;
  profileRoleResults: readonly ProfileRoleQualificationV1[];
  qualifiers: Record<ReviewLaneRole, string[]>;
  selected: {
    readerPrimary: string | null;
    readerAudit: string | null;
    sourcePrimary: string | null;
    sourceAdjudicator: string | null;
    quizSemanticAdjudicator: string | null;
  };
  registry: RoleQualificationRegistryV1;
  roleSetReady: boolean;
  roleSetBlockedReason: string | null;
};

/**
 * The inspection artifact between the two execution phases.  Holdout refuses
 * unless this exact object re-hashes, binds the current freeze, covers all 24
 * calibration cases, and records protocol-valid output for all three roles.
 */
export type RoleQualificationCalibrationSealV1 = {
  schema: typeof ROLE_QUALIFICATION_CALIBRATION_SCHEMA;
  freeze: Readonly<RoleQualificationFreezeV1>;
  schedule: readonly QualificationScheduleEntryV1[];
  attempts: readonly RoleQualificationAttemptV1[];
  sourceMissingEvidenceProbes: readonly SourceMissingEvidenceProbeV1[];
  candidateAvailability: Readonly<RoleQualificationCandidateAvailabilityV1>;
  calibrationProfiles: Record<ReviewLaneRole, string>;
  roleProtocolValid: Record<ReviewLaneRole, boolean>;
  valid: boolean;
  calibrationSha256: string;
};

/** Explicit operator decision between calibration and holdout. The statement,
 * result digest, seal hash, and availability discovery are all self-hashed so
 * editing any retained evidence invalidates the gate. */
export type RoleQualificationCalibrationInspectionV1 = {
  schema: typeof ROLE_QUALIFICATION_CALIBRATION_INSPECTION_SCHEMA;
  calibrationSha256: string;
  freezeSha256: string;
  candidateAvailabilitySha256: string;
  inspectedResultsSha256: string;
  inspectedCaseCount: 24;
  inspectedAttemptCount: number;
  inspectedBy: string;
  inspectedAt: string;
  decision: "APPROVED_FOR_HOLDOUT";
  statement: typeof ROLE_QUALIFICATION_CALIBRATION_INSPECTION_STATEMENT;
  note: string | null;
  inspectionSha256: string;
};

export type RunRoleQualificationInputV1 = {
  corpora: RoleQualificationCorporaV2;
  candidateOrder: Record<ReviewLaneRole, readonly QualificationProfileV1[]>;
  thresholds: Imp22RoleThresholdsV1;
  schemaHashes: RoleQualificationSchemaHashesV1;
};

export type RunRoleQualificationDeps = {
  executor: RoleQualificationExecutor;
  candidateAvailability: RoleQualificationCandidateAvailabilityV1;
  qualifiedAt?: () => string;
};

export class RoleQualificationRunnerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RoleQualificationRunnerError";
  }
}

type QualificationCase = ReaderCorpusCaseV2 | Imp22SourceCorpusCaseV2 | QuizCorpusCaseV2;

type PreparedQualificationCase = {
  role: ReviewLaneRole;
  partition: CorpusPartitionV2;
  caseId: string;
  family: string;
  caseSha256: string;
  task: string;
  artifacts: RoleQualificationExecutionArtifactV1[];
  source: QualificationCase;
  evaluate: (raw: string) => CaseEvaluationV1;
};

type WorkResult = {
  entry: QualificationScheduleEntryV1;
  prepared: PreparedQualificationCase;
  profile: QualificationProfileV1;
  finalAttempt: RoleQualificationAttemptV1;
};

type MetricCounter = { numerator: number; denominator: number };

function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new RoleQualificationRunnerError(message);
}

function artifact(
  kind: RoleQualificationExecutionArtifactV1["kind"],
  relPath: string,
  content: string,
): RoleQualificationExecutionArtifactV1 {
  return Object.freeze({ kind, relPath, content, sha256: sha256Hex(content) });
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" ? value as Record<string, unknown> : {};
}

function exactSpans(spans: readonly string[], document: string, requireOne = true): boolean {
  return (!requireOne || spans.length > 0)
    && spans.every((span) => typeof span === "string" && span.length > 0 && document.includes(span));
}

function invalidEvaluation(error: string): CaseEvaluationV1 {
  return {
    protocolValid: false,
    resolved: false,
    evidenceSpanValid: false,
    error,
    result: null,
    blockingCategories: [],
    supportStatus: null,
    visibleRegister: null,
    keyCorrect: null,
    keyedMechanismSupported: null,
  };
}

function prepareReaderCase(c: ReaderCorpusCaseV2, schemaSha256: string): PreparedQualificationCase {
  const relPath = `reader/${c.caseId}.phase1.md`;
  const document = ensureTrailingNewline(renderChapterReaderDocPhase1(c.chapter));
  const task = buildReaderExperienceTask(relPath);
  return {
    role: "reader",
    partition: c.partition,
    caseId: c.caseId,
    family: c.kind,
    caseSha256: c.substantiveCaseSha256,
    task,
    artifacts: [artifact("phase1-doc", relPath, document)],
    source: c,
    evaluate: (raw) => {
      const parsed = parseReaderExperienceReview(raw);
      if (!parsed) return invalidEvaluation("reader output did not parse");
      let review: ReaderExperienceReviewV1;
      try {
        review = assembleReaderExperienceReview(parsed, {
          chapterContentSha256: c.provenance.variantContentSha256,
          readerDocumentSha256: readerExperienceDocHash(c.chapter),
          schemaSha256,
        });
      } catch (error) {
        return invalidEvaluation((error as Error).message);
      }
      const spans = [
        ...review.strongestEvidence,
        ...review.weakestEvidence,
        ...review.blockingFindings.flatMap((finding) => finding.evidenceSpans),
        ...review.escalationSignals.flatMap((finding) => finding.evidenceSpans),
        ...review.advisoryFindings.flatMap((finding) => finding.evidenceSpans),
      ];
      return {
        protocolValid: true,
        resolved: true,
        evidenceSpanValid: exactSpans(spans, document),
        error: null,
        result: review.blockingFindings.length > 0 ? "BLOCK" : review.recommendation === "SHIP" ? "PASS" : "REVISE",
        blockingCategories: review.blockingFindings.map((finding) => finding.category),
        supportStatus: null,
        visibleRegister: null,
        keyCorrect: null,
        keyedMechanismSupported: null,
      };
    },
  };
}

function prepareSourceCase(c: Imp22SourceCorpusCaseV2, schemaSha256: string): PreparedQualificationCase {
  const packet: SourceReviewPacketV1 = {
    role: SOURCE_INTEGRITY_REVIEWER_ROLE,
    chapterDocument: c.evidence.chapterUnit,
    sourcePlanLicense: renderSourceUsePlanLines(c.evidence.sourceUsePlan),
    sourcePacket: c.evidence.sourcePacket,
    sourceSidecar: c.evidence.sidecar,
    anchorCatalog: c.evidence.anchorCatalog,
    requiredSourceUnitIds: [c.evidence.sourceUsePlanUnit.unitId],
  };
  const built = buildSourceIntegrityTask(packet, {
    outputSchemaRelPath: "schemas/source-integrity-review.schema.json",
    schemaSha256,
  });
  const sourceDocument = JSON.stringify({
    packet: c.evidence.sourcePacket,
    sidecar: c.evidence.sidecar,
    anchorCatalog: c.evidence.anchorCatalog,
  });
  return {
    role: "source",
    partition: c.partition,
    caseId: c.caseId,
    family: c.family,
    caseSha256: hashCanonical(c),
    task: built.task,
    artifacts: [
      artifact("phase1-doc", `source/${c.caseId}.unit.txt`, c.evidence.chapterUnit),
      artifact("source-evidence", `source/${c.caseId}.evidence.json`, sourceDocument),
      artifact("source-plan", `source/${c.caseId}.plan.txt`, packet.sourcePlanLicense.join("\n")),
    ],
    source: c,
    evaluate: (raw) => {
      const parsed = parseSourceIntegrityReview(raw);
      if (!parsed) return invalidEvaluation("source output did not parse");
      const review: SourceIntegrityReviewV1 = {
        ...parsed,
        reviewerRole: "source-integrity",
        chapterContentSha256: c.evidence.provenanceHashes.chapterContentSha256,
        sourceUsePlanSha256: c.evidence.provenanceHashes.sourceUsePlanSha256,
        sourcePacketSha256: c.evidence.provenanceHashes.sourcePacketSha256,
        sidecarSha256: c.evidence.provenanceHashes.sidecarSha256,
        schemaSha256,
      };
      const errors = validateSourceIntegrityReview(review);
      if (errors.length > 0) return invalidEvaluation(errors.join("; "));
      const target = c.evidence.sourceUsePlanUnit;
      const unit = review.units.find((item) => item.unitId === target.unitId);
      if (!unit) return invalidEvaluation(`source output omitted required unit ${target.unitId}`);
      if (review.units.length !== 1) return invalidEvaluation("source qualification output substituted or added a non-target plan unit");
      if (unit.expectedOrigin !== target.origin || unit.expectedForm !== target.form || unit.claimStrengthExpected !== target.claimStrength) {
        return invalidEvaluation(`source output relabeled compiler-owned plan metadata for ${target.unitId}`);
      }
      const semanticBlockers = unit.findings.filter((finding) => finding.severity === "blocker");
      if (review.result === "BLOCK" && semanticBlockers.length === 0) {
        return invalidEvaluation("source BLOCK has no blocker-severity finding");
      }
      if (review.result !== "BLOCK" && semanticBlockers.length > 0) {
        return invalidEvaluation("source non-BLOCK output contains a blocker-severity finding");
      }
      const chapterSpanValid = exactSpans(unit.chapterEvidenceSpans, c.evidence.chapterUnit);
      const needsSourceSpan = c.evidence.expectedOrigin === "source_bound";
      const sourceSpanValid = exactSpans(unit.sourceEvidenceSpans, sourceDocument, needsSourceSpan);
      return {
        protocolValid: true,
        resolved: review.result !== "INCONCLUSIVE",
        evidenceSpanValid: chapterSpanValid && sourceSpanValid,
        error: null,
        result: review.result,
        blockingCategories: semanticBlockers.map((finding) => finding.category),
        supportStatus: unit.supportStatus,
        visibleRegister: unit.visibleRegister,
        keyCorrect: null,
        keyedMechanismSupported: null,
      };
    },
  };
}

function prepareQuizCase(c: QuizCorpusCaseV2, schemaSha256: string): PreparedQualificationCase {
  const question = c.chapter.quiz.questions[0];
  const expected = asRecord(c.expected);
  const defensible = Array.isArray(expected.defensibleAnswerIndices)
    ? expected.defensibleAnswerIndices.filter((value): value is number => Number.isInteger(value))
    : [];
  requireCondition(defensible.length > 0, `quiz case ${c.caseId} has no frozen defensible answer`);
  const derivedIndex = defensible[0];
  requireCondition(derivedIndex >= 0 && derivedIndex <= 2, `quiz case ${c.caseId} has an out-of-range defensible answer`);
  const phase1DocumentSha256 = readerExperienceDocHash(c.chapter);
  const derivation = buildQuizDerivation(c.chapter, {
    answers: [ABC[derivedIndex]],
    mechanisms: [question.explanation],
    confidence: ["high"],
    ambiguities: [c.kind === "genuine-ambiguity" ? "multiple defensible answers" : ""],
    evidence: [[question.prompt]],
  }, phase1DocumentSha256, `qualification-derivation-${c.caseId}`);
  const committed = commitQuizDerivation(derivation, {
    documentSha256: phase1DocumentSha256,
    questionCount: 1,
    itemIds: [quizItemId(c.chapter, 0)],
  });
  const relPath = `quiz/${c.caseId}.phase2.md`;
  const phase2Document = renderQuizPhase2Doc(c.chapter, committed);
  const task = buildQuizIntegrityAdjudicationTask(relPath);
  return {
    role: "quiz",
    partition: c.partition,
    caseId: c.caseId,
    family: c.kind,
    caseSha256: c.substantiveCaseSha256,
    task,
    artifacts: [artifact("phase2-doc", relPath, phase2Document)],
    source: c,
    evaluate: (raw) => {
      const parsed = parseQuizIntegrityAdjudication(raw);
      if (!parsed) return invalidEvaluation("quiz output did not parse");
      const errors = validateQuizIntegrityAdjudication(parsed, c.chapter, committed);
      if (errors.length > 0) return invalidEvaluation(errors.join("; "));
      const result: QuizIntegrityResultV1 = runQuizIntegrityLane(c.chapter, committed, raw);
      const item = parsed.items[0];
      const evidenceSpanValid = result.questions.length === 1
        && exactSpans(result.questions[0].evidenceSpans, phase2Document);
      return {
        protocolValid: true,
        resolved: result.result !== "INCONCLUSIVE",
        evidenceSpanValid,
        error: null,
        result: result.result,
        blockingCategories: [],
        supportStatus: null,
        visibleRegister: null,
        keyCorrect: item?.keyCorrect ?? null,
        keyedMechanismSupported: item?.keyedMechanismSupported ?? null,
      };
    },
  };
}

function validateCorpus<T extends QualificationCase>(
  role: ReviewLaneRole,
  corpus: SplitLaneRoleCorpusV2<T>,
  calibrationCount: number,
  holdoutCount: number,
): void {
  requireCondition(corpus.schema === SPLIT_LANE_CORPUS_V2_SCHEMA, `${role} corpus is not v2`);
  requireCondition(corpus.role === role, `${role} corpus role mismatch`);
  requireCondition(typeof corpus.substantiveCorpusSha256 === "string" && corpus.substantiveCorpusSha256.length > 0, `${role} corpus hash missing`);
  for (const partition of CORPUS_PARTITIONS_V2) {
    const envelope = corpus.partitions[partition];
    requireCondition(envelope?.partition === partition, `${role} ${partition} envelope mismatch`);
    requireCondition(Array.isArray(envelope.cases), `${role} ${partition} cases missing`);
    requireCondition(envelope.cases.every((c) => c.partition === partition && c.role === role), `${role} ${partition} contains a wrong-role/partition case`);
    requireCondition(new Set(envelope.cases.map((c) => c.caseId)).size === envelope.cases.length, `${role} ${partition} has duplicate case ids`);
  }
  requireCondition(corpus.partitions.calibration.cases.length === calibrationCount, `${role} calibration must contain exactly ${calibrationCount} cases`);
  requireCondition(corpus.partitions.holdout.cases.length === holdoutCount, `${role} holdout must contain exactly ${holdoutCount} cases`);
  const overlap = new Set(corpus.partitions.calibration.cases.map((c) => c.caseId));
  requireCondition(corpus.partitions.holdout.cases.every((c) => !overlap.has(c.caseId)), `${role} calibration overlaps holdout`);
}

function exactCounts<T>(
  where: string,
  values: readonly T[],
  keyOf: (value: T) => string,
  expected: Readonly<Record<string, number>>,
): void {
  const actual: Record<string, number> = {};
  for (const value of values) {
    const key = keyOf(value);
    actual[key] = (actual[key] ?? 0) + 1;
  }
  requireCondition(hashCanonical(actual) === hashCanonical(expected), `${where} composition drifted: ${JSON.stringify(actual)}`);
}

function validateImp22Composition(corpora: RoleQualificationCorporaV2): void {
  exactCounts("reader calibration", corpora.reader.partitions.calibration.cases, (c) => c.kind, {
    clean: 2, "craft-nonblocker": 2, "reader-visible-hard-blocker": 2,
  });
  exactCounts("reader holdout", corpora.reader.partitions.holdout.cases, (c) => c.kind, {
    clean: 10, "craft-nonblocker": 10, "reader-visible-hard-blocker": 10,
  });
  exactCounts("quiz calibration", corpora.quiz.partitions.calibration.cases, (c) => c.kind, {
    "genuine-ambiguity": 2, "key-mismatch": 2, "mechanism-causal-key": 2, "uniquely-correct-clean": 2,
  });
  exactCounts("quiz holdout", corpora.quiz.partitions.holdout.cases, (c) => c.kind, {
    "genuine-ambiguity": 10, "key-mismatch": 10, "mechanism-causal-key": 10, "uniquely-correct-clean": 10,
  });

  const sourceFamilies = [
    "causal-overreach", "correct-claim-strength", "framed-constructed",
    "generic-historical-specificity", "generic-operational-scenario",
    "supported-source-bound", "unframed-constructed", "unsupported-invented",
    "unsupported-or-contradicted-attribution", "valid-attribution",
  ];
  exactCounts("source calibration families", corpora.source.partitions.calibration.cases, (c) => c.family,
    Object.fromEntries(sourceFamilies.map((family) => [family, 1])));
  exactCounts("source holdout families", corpora.source.partitions.holdout.cases, (c) => c.family,
    Object.fromEntries(sourceFamilies.map((family) => [family, 4])));
  exactCounts("source calibration labels", corpora.source.partitions.calibration.cases, (c) => c.expected.expectedCategory ?? "clean", {
    clean: 5,
    unsupported_attribution: 1,
    claim_strength_overreach: 1,
    missing_visible_framing: 1,
    generic_specificity_leak: 1,
    invented_detail: 1,
  });
  exactCounts("source holdout labels", corpora.source.partitions.holdout.cases, (c) => c.expected.expectedCategory ?? "clean", {
    clean: 20,
    source_contradiction: 2,
    unsupported_attribution: 2,
    claim_strength_overreach: 4,
    missing_visible_framing: 4,
    generic_specificity_leak: 4,
    invented_detail: 4,
  });
  for (const c of [...corpora.source.partitions.calibration.cases, ...corpora.source.partitions.holdout.cases]) {
    requireCondition(
      c.pairSide === "clean"
        ? c.expected.goldResult === "PASS" && c.expected.expectedCategory === null
        : c.expected.goldResult === "BLOCK" && typeof c.expected.expectedCategory === "string",
      `source case ${c.caseId} pair-side/gold label was relabeled`,
    );
  }
}

function prepareCases(input: RunRoleQualificationInputV1): Record<ReviewLaneRole, Record<CorpusPartitionV2, PreparedQualificationCase[]>> {
  validateCorpus("reader", input.corpora.reader, 6, 30);
  validateCorpus("source", input.corpora.source, 10, 40);
  validateCorpus("quiz", input.corpora.quiz, 8, 40);
  validateImp22Composition(input.corpora);
  return {
    reader: {
      calibration: input.corpora.reader.partitions.calibration.cases.map((c) => prepareReaderCase(c, input.schemaHashes.reader)),
      holdout: input.corpora.reader.partitions.holdout.cases.map((c) => prepareReaderCase(c, input.schemaHashes.reader)),
    },
    source: {
      calibration: input.corpora.source.partitions.calibration.cases.map((c) => prepareSourceCase(c, input.schemaHashes.source)),
      holdout: input.corpora.source.partitions.holdout.cases.map((c) => prepareSourceCase(c, input.schemaHashes.source)),
    },
    quiz: {
      calibration: input.corpora.quiz.partitions.calibration.cases.map((c) => prepareQuizCase(c, input.schemaHashes.quiz)),
      holdout: input.corpora.quiz.partitions.holdout.cases.map((c) => prepareQuizCase(c, input.schemaHashes.quiz)),
    },
  };
}

/** Round-robin families so no long same-family block can dominate the schedule. */
function balancedCases(cases: readonly PreparedQualificationCase[]): PreparedQualificationCase[] {
  const groups = new Map<string, PreparedQualificationCase[]>();
  for (const c of [...cases].sort((a, b) => a.caseId.localeCompare(b.caseId))) {
    const group = groups.get(c.family) ?? [];
    group.push(c);
    groups.set(c.family, group);
  }
  const keys = [...groups.keys()].sort();
  const out: PreparedQualificationCase[] = [];
  for (let index = 0; ; index++) {
    let added = false;
    for (const key of keys) {
      const item = groups.get(key)?.[index];
      if (item) { out.push(item); added = true; }
    }
    if (!added) return out;
  }
}

function interleave<T>(lists: readonly T[][]): T[] {
  const out: T[] = [];
  for (let index = 0; ; index++) {
    let added = false;
    for (const list of lists) {
      if (index < list.length) { out.push(list[index]); added = true; }
    }
    if (!added) return out;
  }
}

function buildSchedule(
  prepared: Record<ReviewLaneRole, Record<CorpusPartitionV2, PreparedQualificationCase[]>>,
  order: Record<ReviewLaneRole, readonly QualificationProfileV1[]>,
  availability: RoleQualificationCandidateAvailabilityV1,
): QualificationScheduleEntryV1[] {
  const schedule: QualificationScheduleEntryV1[] = [];
  const append = (
    partition: CorpusPartitionV2,
    wave: number,
    roleLists: Array<Array<{ role: ReviewLaneRole; p: QualificationProfileV1; c: PreparedQualificationCase }>>,
  ): void => {
    for (const { role, p, c } of interleave(roleLists)) {
      const ordinal = schedule.length;
      schedule.push({
        scheduleId: `qual-${String(ordinal + 1).padStart(5, "0")}`,
        ordinal,
        wave,
        partition,
        role,
        profileId: p.profileId,
        caseId: c.caseId,
        family: c.family,
        promptSha256: sha256Hex(c.task),
        caseSha256: c.caseSha256,
      });
    }
  };

  const available = (role: ReviewLaneRole, ordinal: number): boolean => availability.entries.some(
    (entry) => entry.role === role && entry.ordinal === ordinal && entry.status === "AVAILABLE",
  );
  const calibrationProfile = (role: ReviewLaneRole): QualificationProfileV1 | undefined => {
    const entry = availability.entries.find((candidate) => candidate.role === role && candidate.requiredForCalibration);
    return entry ? order[role][entry.ordinal] : undefined;
  };

  // Calibration is an instrument/protocol check performed once, on the first
  // AVAILABLE profile in each frozen role order: 6 + 10 + 8 = 24. Skipping an
  // unavailable profile is not reordering; its ordinal and status remain in
  // the hash-bound availability artifact and it receives zero calls.
  append("calibration", 0, ROLES.map((role) => {
    const p = calibrationProfile(role);
    return p ? balancedCases(prepared[role].calibration).map((c) => ({ role, p, c })) : [];
  }));

  // Holdout is the qualification bakeoff. Later candidates never rerun the
  // calibration partition; they receive the same inspected calibration seal.
  const waves = Math.max(...ROLES.map((role) => order[role].length));
  for (let wave = 0; wave < waves; wave++) {
    append("holdout", wave, ROLES.map((role) => {
      const p = order[role][wave];
      return p && available(role, wave) ? balancedCases(prepared[role].holdout).map((c) => ({ role, p, c })) : [];
    }));
  }
  return schedule;
}

type ThresholdFloor = { minRate: number; zeroMiss: boolean };

const THRESHOLD_FLOORS: Record<ReviewLaneRole, Record<string, ThresholdFloor>> = {
  reader: {
    schemaValidity: { minRate: 1, zeroMiss: true },
    hardBlockerSensitivity: { minRate: 1, zeroMiss: true },
    hardBlockerFalsePositiveFree: { minRate: 1, zeroMiss: true },
    cleanControlPassRate: { minRate: 0.9, zeroMiss: false },
    craftCalibrationAccuracy: { minRate: 0.8, zeroMiss: false },
    evidenceSpanValidity: { minRate: 0.95, zeroMiss: false },
    requiredCasesResolved: { minRate: 1, zeroMiss: true },
  },
  source: {
    schemaValidity: { minRate: 1, zeroMiss: true },
    fabricationSensitivity: { minRate: 1, zeroMiss: true },
    causalOverreachSensitivity: { minRate: 1, zeroMiss: true },
    sourceContradictionSensitivity: { minRate: 1, zeroMiss: true },
    highSeverityFalsePositiveFree: { minRate: 1, zeroMiss: true },
    cleanCasePassRate: { minRate: 0.9, zeroMiss: false },
    supportStatusAccuracy: { minRate: 0.9, zeroMiss: false },
    visibleRegisterAccuracy: { minRate: 0.9, zeroMiss: false },
    evidenceSpanValidity: { minRate: 1, zeroMiss: true },
    missingEvidenceInconclusive: { minRate: 1, zeroMiss: true },
    requiredCasesResolved: { minRate: 1, zeroMiss: true },
  },
  quiz: {
    schemaValidity: { minRate: 1, zeroMiss: true },
    wrongKeyDetection: { minRate: 1, zeroMiss: true },
    cleanUniquePassRate: { minRate: 0.9, zeroMiss: false },
    ambiguityDetection: { minRate: 0.9, zeroMiss: false },
    mechanismAccuracy: { minRate: 0.9, zeroMiss: false },
    evidenceSpanValidity: { minRate: 0.95, zeroMiss: false },
    requiredCasesResolved: { minRate: 1, zeroMiss: true },
  },
};

function validateThresholds(thresholds: Imp22RoleThresholdsV1): void {
  requireCondition(
    thresholds?.schema === RECOVERY_ROLE_THRESHOLDS_SCHEMA || thresholds?.schema === "recovery-role-thresholds-v1",
    "qualification thresholds schema mismatch",
  );
  for (const role of ROLES) {
    for (const [metricId, floor] of Object.entries(THRESHOLD_FLOORS[role])) {
      const bar = thresholds[role]?.[metricId];
      requireCondition(bar !== undefined, `thresholds missing ${role}.${metricId}`);
      requireCondition(bar.minRate >= floor.minRate, `threshold ${role}.${metricId} weakens IMP-22 (${bar.minRate} < ${floor.minRate})`);
      requireCondition(bar.zeroMiss === floor.zeroMiss, `threshold ${role}.${metricId} has wrong zeroMiss policy`);
      if (!bar.zeroMiss) requireCondition(bar.minDenominator >= 10, `threshold ${role}.${metricId} minimum denominator is below 10`);
    }
  }
}

function validateCandidateOrder(order: Record<ReviewLaneRole, readonly QualificationProfileV1[]>): void {
  for (const role of ROLES) {
    requireCondition(Array.isArray(order[role]) && order[role].length > 0, `${role} candidate order is empty`);
    requireCondition(new Set(order[role].map((p) => p.profileId)).size === order[role].length, `${role} candidate order has duplicates`);
    for (const p of order[role]) {
      requireCondition(p.profileId.length > 0 && p.model.length > 0, `${role} candidate profile is incomplete`);
      requireCondition(["minimal", "low", "medium", "high", "xhigh"].includes(p.effort), `${role} candidate ${p.profileId} has invalid effort`);
    }
  }
}

export function roleQualificationCandidateAvailabilityHash(
  availability: Omit<RoleQualificationCandidateAvailabilityV1, "availabilitySha256">,
): string {
  return hashCanonical(availability);
}

function assertCandidateAvailability(
  input: RunRoleQualificationInputV1,
  availability: RoleQualificationCandidateAvailabilityV1,
): void {
  requireCondition(
    availability?.schema === ROLE_QUALIFICATION_CANDIDATE_AVAILABILITY_SCHEMA,
    "calibration requires an IMP-22 candidate-availability freeze",
  );
  const { availabilitySha256, ...draft } = availability;
  requireCondition(
    roleQualificationCandidateAvailabilityHash(draft) === availabilitySha256,
    "candidate-availability freeze hash mismatch",
  );
  requireCondition(availability.source === "codex-local-models-cache", "candidate availability must come from the local Codex model cache");
  requireCondition(availability.sourceFile === "models_cache.json", "candidate availability source file mismatch");
  requireCondition(/^[a-f0-9]{64}$/.test(availability.sourceBytesSha256), "candidate availability source hash is invalid");
  requireCondition(/^[a-f0-9]{64}$/.test(availability.policyBytesSha256), "candidate availability policy hash is invalid");
  requireCondition(Number.isFinite(Date.parse(availability.sourceFetchedAt)), "candidate availability source timestamp is invalid");
  requireCondition(
    availability.candidateOrderSha256 === hashCanonical(input.candidateOrder),
    "candidate availability belongs to a different candidate order",
  );

  const firstAvailableOrdinal = Object.fromEntries(ROLES.map((role) => [
    role,
    availability.entries.find((entry) => entry.role === role && entry.status === "AVAILABLE")?.ordinal ?? null,
  ])) as Record<ReviewLaneRole, number | null>;
  const expected = ROLES.flatMap((role) => input.candidateOrder[role].map((profile, ordinal) => ({
    role,
    ordinal,
    profileId: profile.profileId,
    model: profile.model,
    effort: profile.effort,
    requiredForCalibration: firstAvailableOrdinal[role] === ordinal,
  })));
  requireCondition(availability.entries.length === expected.length, "candidate availability entry count differs from frozen order");
  for (let index = 0; index < expected.length; index++) {
    const entry = availability.entries[index];
    const target = expected[index];
    requireCondition(
      entry?.role === target.role
        && entry.ordinal === target.ordinal
        && entry.profileId === target.profileId
        && entry.model === target.model
        && entry.effort === target.effort
        && entry.requiredForCalibration === target.requiredForCalibration,
      `candidate availability entry ${index} differs from frozen order`,
    );
    const computed = entry.modelListed && entry.visible && entry.effortSupported ? "AVAILABLE" : "UNAVAILABLE";
    requireCondition(entry.status === computed, `candidate availability status does not derive for ${entry.profileId}`);
    requireCondition(typeof entry.reason === "string" && entry.reason.length > 0, `candidate availability reason is missing for ${entry.profileId}`);
  }
  const required = availability.entries.filter((entry) => entry.requiredForCalibration);
  const computedCalibrationAvailable = required.length === ROLES.length
    && required.every((entry) => entry.status === "AVAILABLE")
    && ROLES.every((role) => required.filter((entry) => entry.role === role).length === 1);
  requireCondition(
    availability.calibrationCandidatesAvailable === computedCalibrationAvailable,
    "candidate availability calibration-candidate summary does not derive from entries",
  );
  requireCondition(
    computedCalibrationAvailable,
    `calibration blocked: no available profile remains for ${ROLES.filter((role) => firstAvailableOrdinal[role] === null).join(", ")}`,
  );
}

function buildFreeze(
  input: RunRoleQualificationInputV1,
  prepared: Record<ReviewLaneRole, Record<CorpusPartitionV2, PreparedQualificationCase[]>>,
  schedule: QualificationScheduleEntryV1[],
  availability: RoleQualificationCandidateAvailabilityV1,
): RoleQualificationFreezeV1 {
  const corpusHashes = Object.fromEntries(ROLES.map((role) => [role, input.corpora[role].substantiveCorpusSha256])) as Record<ReviewLaneRole, string>;
  const corpusEnvelopeHashes = Object.fromEntries(ROLES.map((role) => [role, sha256Hex(canonicalPretty(input.corpora[role]))])) as Record<ReviewLaneRole, string>;
  const promptBundleHashes = Object.fromEntries(ROLES.map((role) => [
    role,
    hashCanonical(CORPUS_PARTITIONS_V2.flatMap((partition) => prepared[role][partition].map((c) => ({
      partition, caseId: c.caseId, taskSha256: sha256Hex(c.task), artifacts: c.artifacts.map((a) => ({ relPath: a.relPath, sha256: a.sha256 })),
    })))),
  ])) as Record<ReviewLaneRole, string>;
  const draft = {
    schema: ROLE_QUALIFICATION_FREEZE_SCHEMA,
    maxParallel: ROLE_QUALIFICATION_MAX_PARALLEL,
    candidateOrderSha256: hashCanonical(input.candidateOrder),
    thresholdsSha256: hashCanonical(input.thresholds),
    schemaHashesSha256: hashCanonical(input.schemaHashes),
    candidateAvailabilitySha256: availability.availabilitySha256,
    corpusHashes,
    corpusEnvelopeHashes,
    promptBundleHashes,
    scheduleSha256: hashCanonical(schedule),
    missingEvidenceProbeSha256: hashCanonical(MISSING_EVIDENCE_PROBE_INSTRUMENT),
  };
  return Object.freeze({ ...draft, freezeSha256: hashCanonical(draft) });
}

function assertFrozenInput(input: RunRoleQualificationInputV1, freeze: RoleQualificationFreezeV1): void {
  requireCondition(hashCanonical(input.candidateOrder) === freeze.candidateOrderSha256, "candidate order changed after qualification freeze");
  requireCondition(hashCanonical(input.thresholds) === freeze.thresholdsSha256, "thresholds changed after qualification freeze");
  requireCondition(hashCanonical(input.schemaHashes) === freeze.schemaHashesSha256, "schema hashes changed after qualification freeze");
  for (const role of ROLES) {
    requireCondition(input.corpora[role].substantiveCorpusSha256 === freeze.corpusHashes[role], `${role} corpus id/hash changed after freeze`);
    requireCondition(sha256Hex(canonicalPretty(input.corpora[role])) === freeze.corpusEnvelopeHashes[role], `${role} holdout/corpus envelope changed after freeze`);
  }
}

function routeMismatches(request: RoleQualificationExecutionRequestV1, receipt: RoleQualificationExecutionReceiptV1): string[] {
  const expected: Record<string, unknown> = {
    schema: ROLE_QUALIFICATION_RECEIPT_SCHEMA,
    role: request.role,
    profileId: request.profileId,
    model: request.model,
    effort: request.effort,
    schemaSha256: request.schemaSha256,
  };
  const out: string[] = [];
  for (const [key, value] of Object.entries(expected)) {
    if ((receipt as unknown as Record<string, unknown>)?.[key] !== value) out.push(key);
  }
  if (typeof receipt?.executionId !== "string" || receipt.executionId.length === 0) out.push("executionId");
  if (!["completed", "timeout", "provider_capacity", "transient_execution_failure", "refusal", "policy_failure", "invalid_output", "integrity_failure"].includes(receipt?.status)) out.push("status");
  if (receipt?.status === "completed" && typeof receipt.rawOutput !== "string") out.push("rawOutput");
  return out;
}

const INFRA_REPLAY = new Set<QualificationReceiptStatus>(["timeout", "provider_capacity", "transient_execution_failure"]);

async function mapPool<T, R>(items: readonly T[], maxParallel: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(maxParallel, items.length || 1)) }, async () => {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      out[index] = await fn(items[index]);
    }
  });
  await Promise.all(workers);
  return out;
}

function emptyEvaluation(reason: string): CaseEvaluationV1 {
  return invalidEvaluation(reason);
}

async function runScheduledCase(args: {
  input: RunRoleQualificationInputV1;
  freeze: RoleQualificationFreezeV1;
  entry: QualificationScheduleEntryV1;
  prepared: PreparedQualificationCase;
  profile: QualificationProfileV1;
  executor: RoleQualificationExecutor;
  attempts: RoleQualificationAttemptV1[];
}): Promise<WorkResult> {
  let replayOfAttemptId: string | null = null;
  let finalAttempt: RoleQualificationAttemptV1 | null = null;
  for (const attemptNumber of [1, 2] as const) {
    assertFrozenInput(args.input, args.freeze);
    const attemptId = `${args.entry.scheduleId}-a${attemptNumber}`;
    const request: RoleQualificationExecutionRequestV1 = Object.freeze({
      schema: ROLE_QUALIFICATION_REQUEST_SCHEMA,
      scheduleId: args.entry.scheduleId,
      attemptId,
      replayOfAttemptId,
      attemptNumber,
      role: args.entry.role,
      partition: args.entry.partition,
      caseId: args.entry.caseId,
      family: args.entry.family,
      profileId: args.profile.profileId,
      model: args.profile.model,
      effort: args.profile.effort,
      schemaSha256: args.input.schemaHashes[args.entry.role],
      promptSha256: args.entry.promptSha256,
      freezeSha256: args.freeze.freezeSha256,
      task: args.prepared.task,
      artifacts: Object.freeze([...args.prepared.artifacts]),
    });
    let receipt: RoleQualificationExecutionReceiptV1 | null = null;
    let thrown: string | null = null;
    try {
      receipt = await args.executor(request);
    } catch (error) {
      thrown = (error as Error).message;
    }
    const mismatches = receipt ? routeMismatches(request, receipt) : [];
    const routeValid = receipt !== null && mismatches.length === 0;
    const status: QualificationReceiptStatus = receipt?.status ?? "transient_execution_failure";
    const replayEligible = routeValid ? INFRA_REPLAY.has(status) : receipt === null;
    let evaluation: CaseEvaluationV1 | null = null;
    let terminalReason: string;
    if (!routeValid) {
      terminalReason = receipt === null
        ? `executor threw: ${thrown ?? "unknown execution failure"}`
        : `route receipt mismatch: ${mismatches.join(", ")}`;
    } else if (status === "completed") {
      evaluation = args.prepared.evaluate(receipt?.rawOutput ?? "");
      terminalReason = evaluation.protocolValid ? "completed" : `completed with invalid output: ${evaluation.error}`;
    } else {
      terminalReason = `${status}: ${receipt?.failureDetail ?? ""}`.trim();
      if (status === "refusal") evaluation = emptyEvaluation("reviewer refusal");
    }
    const attempt: RoleQualificationAttemptV1 = {
      schema: ROLE_QUALIFICATION_ATTEMPT_SCHEMA,
      scheduleId: args.entry.scheduleId,
      attemptId,
      replayOfAttemptId,
      attemptNumber,
      role: args.entry.role,
      partition: args.entry.partition,
      caseId: args.entry.caseId,
      family: args.entry.family,
      profileId: args.profile.profileId,
      receipt,
      routeValid,
      replayEligible,
      rawOutputSha256: typeof receipt?.rawOutput === "string" ? sha256Hex(receipt.rawOutput) : null,
      evaluation,
      terminalReason,
    };
    args.attempts.push(attempt);
    finalAttempt = attempt;
    // Exactly one replay, only for an infrastructure class. A schema-valid bad
    // judgment, low score, invalid schema, refusal, or route mismatch terminates.
    if (attemptNumber === 1 && replayEligible) {
      replayOfAttemptId = attemptId;
      continue;
    }
    break;
  }
  requireCondition(finalAttempt !== null, `schedule entry ${args.entry.scheduleId} produced no attempt`);
  if (!finalAttempt.evaluation) finalAttempt.evaluation = emptyEvaluation(finalAttempt.terminalReason);
  return { entry: args.entry, prepared: args.prepared, profile: args.profile, finalAttempt };
}

export function evaluateSourceMissingEvidenceProbeObservation(input: {
  threw: boolean;
  observed: string;
  spawnCalls: number;
}): boolean {
  return input.threw
    && input.spawnCalls === 0
    && /requires the source sidecar/i.test(input.observed);
}

async function runSourceMissingEvidenceProbe(
  profileId: string,
  sourceCase: Imp22SourceCorpusCaseV2,
  schemaSha256: string,
  expectedProbeSha256: string,
): Promise<SourceMissingEvidenceProbeV1> {
  let spawnCalls = 0;
  let threw = false;
  let observed = "no refusal";
  try {
    await runSourceIntegrityReview({
      chapter: { chapterId: `${sourceCase.bookId}-ch${String(sourceCase.chapterNumber).padStart(2, "0")}`, number: sourceCase.chapterNumber } as ChapterV21,
      plan: sourceCase.evidence.sourceUsePlan,
      packet: sourceCase.evidence.sourcePacket,
      sidecar: null,
      anchorCatalog: sourceCase.evidence.anchorCatalog,
      schemaSha256,
    }, {
      spawn: async () => { spawnCalls += 1; return { finalMessage: "{}" }; },
    });
  } catch (error) {
    threw = true;
    observed = (error as Error).message;
  }
  const passed = evaluateSourceMissingEvidenceProbeObservation({ threw, observed, spawnCalls });
  const probeSha256 = hashCanonical(MISSING_EVIDENCE_PROBE_INSTRUMENT);
  requireCondition(probeSha256 === expectedProbeSha256, "missing-evidence probe instrument hash drifted");
  return { profileId, version: MISSING_EVIDENCE_PROBE_VERSION, passed, executorCalls: 0, observed, probeSha256 };
}

function increment(counters: Record<string, MetricCounter>, metricId: string, success: boolean): void {
  const counter = counters[metricId] ?? { numerator: 0, denominator: 0 };
  counter.denominator += 1;
  if (success) counter.numerator += 1;
  counters[metricId] = counter;
}

function scoreRole(
  role: ReviewLaneRole,
  results: readonly WorkResult[],
  sourceProbePassed: boolean,
): RoleMetricLedgerV1 {
  const counters: Record<string, MetricCounter> = {};
  let hardFalsePositives = 0;
  let highSeverityFalsePositives = 0;
  let unresolvedRequiredCases = 0;
  for (const work of results) {
    const evaluation = work.finalAttempt.evaluation ?? emptyEvaluation("missing evaluation");
    increment(counters, "schemaValidity", evaluation.protocolValid);
    increment(counters, "evidenceSpanValidity", evaluation.protocolValid && evaluation.evidenceSpanValid);
    increment(counters, "requiredCasesResolved", evaluation.protocolValid && evaluation.resolved);
    if (!evaluation.protocolValid || !evaluation.resolved) unresolvedRequiredCases += 1;

    if (role === "reader") {
      const c = work.prepared.source as ReaderCorpusCaseV2;
      if (c.kind === "reader-visible-hard-blocker") {
        const expectedCategory = String(asRecord(c.expected).expectedBlockingCategory ?? "");
        increment(counters, "hardBlockerSensitivity", evaluation.result === "BLOCK" && evaluation.blockingCategories.includes(expectedCategory));
      }
      if (c.kind === "clean") {
        const fpFree = evaluation.blockingCategories.length === 0;
        increment(counters, "hardBlockerFalsePositiveFree", fpFree);
        increment(counters, "cleanControlPassRate", evaluation.result === "PASS" && fpFree);
        if (!fpFree) hardFalsePositives += 1;
      }
      if (c.kind === "craft-nonblocker") {
        increment(counters, "craftCalibrationAccuracy", evaluation.result === "REVISE" && evaluation.blockingCategories.length === 0);
      }
    } else if (role === "source") {
      const c = work.prepared.source as Imp22SourceCorpusCaseV2;
      const category = c.expected.expectedCategory;
      if (category === "invented_detail") increment(counters, "fabricationSensitivity", evaluation.result === "BLOCK" && evaluation.blockingCategories.includes(category));
      if (category === "claim_strength_overreach") increment(counters, "causalOverreachSensitivity", evaluation.result === "BLOCK" && evaluation.blockingCategories.includes(category));
      if (category === "source_contradiction") increment(counters, "sourceContradictionSensitivity", evaluation.result === "BLOCK" && evaluation.blockingCategories.includes(category));
      if (c.pairSide === "clean") {
        const fpFree = evaluation.blockingCategories.length === 0 && evaluation.result !== "BLOCK";
        increment(counters, "highSeverityFalsePositiveFree", fpFree);
        increment(counters, "cleanCasePassRate", evaluation.result === "PASS");
        if (!fpFree) highSeverityFalsePositives += 1;
      }
      increment(counters, "supportStatusAccuracy", evaluation.supportStatus === c.expected.expectedSupportStatus);
      increment(counters, "visibleRegisterAccuracy", evaluation.visibleRegister === c.expected.expectedVisibleRegister);
    } else {
      const c = work.prepared.source as QuizCorpusCaseV2;
      const expected = asRecord(c.expected);
      if (c.kind === "key-mismatch") increment(counters, "wrongKeyDetection", evaluation.result === "BLOCK" && evaluation.keyCorrect === "wrong");
      if (c.kind === "uniquely-correct-clean") increment(counters, "cleanUniquePassRate", evaluation.result === "PASS" && evaluation.keyCorrect === "correct");
      if (c.kind === "genuine-ambiguity") increment(counters, "ambiguityDetection", evaluation.result === "BLOCK" && evaluation.keyCorrect === "ambiguous");
      if (c.kind === "mechanism-causal-key") {
        const expectedMechanism = expected.keyedMechanismSupported === true;
        const expectedResult = expected.goldResult === "PASS" ? "PASS" : "BLOCK";
        increment(counters, "mechanismAccuracy", evaluation.result === expectedResult && evaluation.keyedMechanismSupported === expectedMechanism);
      }
    }
  }
  if (role === "source") increment(counters, "missingEvidenceInconclusive", sourceProbePassed);
  const metrics: RoleMetricRatesV1 = {};
  const denominators: RoleMetricDenominatorsV1 = {};
  const numerators: Record<string, number> = {};
  for (const metricId of IMP22_ROLE_METRIC_IDS[role]) {
    const counter = counters[metricId] ?? { numerator: 0, denominator: 0 };
    numerators[metricId] = counter.numerator;
    denominators[metricId] = counter.denominator;
    metrics[metricId] = counter.denominator > 0 ? counter.numerator / counter.denominator : Number.NaN;
  }
  return {
    metrics,
    denominators,
    numerators,
    counts: { hardFalsePositives, highSeverityFalsePositives, unresolvedRequiredCases },
  };
}

function explicitImp22Outcome(
  role: ReviewLaneRole,
  ledger: RoleMetricLedgerV1,
  thresholds: Imp22RoleThresholdsV1,
): RoleQualificationOutcomeV1 {
  const base = qualifyRole(role, ledger.metrics, thresholds as RecoveryRoleThresholdsV1, ledger.denominators);
  const failed = new Set(base.failedThresholds);
  if (ledger.counts.unresolvedRequiredCases !== 0) failed.add("requiredCasesResolved");
  if (role === "reader" && ledger.counts.hardFalsePositives !== 0) failed.add("hardBlockerFalsePositiveFree");
  if (role === "source" && ledger.counts.highSeverityFalsePositives !== 0) failed.add("highSeverityFalsePositiveFree");
  return {
    ...base,
    status: failed.size > 0 ? "NOT_QUALIFIED" : base.status,
    failedThresholds: [...failed],
  };
}

function notTested(role: ReviewLaneRole): RoleQualificationOutcomeV1 {
  return {
    schema: ROLE_QUALIFICATION_OUTCOME_SCHEMA,
    role,
    status: "NOT_TESTED",
    refusedUnderpowered: false,
    underpoweredMetrics: [],
    failedThresholds: [],
  };
}

function profileList(order: Record<ReviewLaneRole, readonly QualificationProfileV1[]>): QualificationProfileV1[] {
  const seen = new Set<string>();
  const out: QualificationProfileV1[] = [];
  const max = Math.max(...ROLES.map((role) => order[role].length));
  for (let index = 0; index < max; index++) {
    for (const role of ROLES) {
      const p = order[role][index];
      if (p && !seen.has(p.profileId)) { seen.add(p.profileId); out.push(p); }
    }
  }
  return out;
}

type QualificationPlan = {
  prepared: Record<ReviewLaneRole, Record<CorpusPartitionV2, PreparedQualificationCase[]>>;
  preparedByKey: Map<string, PreparedQualificationCase>;
  schedule: QualificationScheduleEntryV1[];
  freeze: RoleQualificationFreezeV1;
};

function buildQualificationPlan(
  input: RunRoleQualificationInputV1,
  availability: RoleQualificationCandidateAvailabilityV1,
): QualificationPlan {
  validateCandidateOrder(input.candidateOrder);
  validateThresholds(input.thresholds);
  assertCandidateAvailability(input, availability);
  for (const role of ROLES) requireCondition(typeof input.schemaHashes[role] === "string" && input.schemaHashes[role].length > 0, `${role} schema hash missing`);
  const prepared = prepareCases(input);
  const preparedByKey = new Map<string, PreparedQualificationCase>();
  for (const role of ROLES) for (const partition of CORPUS_PARTITIONS_V2) {
    for (const c of prepared[role][partition]) preparedByKey.set(`${role}|${partition}|${c.caseId}`, c);
  }
  const schedule = buildSchedule(prepared, input.candidateOrder, availability);
  const freeze = buildFreeze(input, prepared, schedule, availability);
  assertFrozenInput(input, freeze);
  return { prepared, preparedByKey, schedule, freeze };
}

function assertExecutor(deps: RunRoleQualificationDeps): void {
  requireCondition(typeof deps?.executor === "function", "role qualification requires an injected executor");
}

function calibrationSealHash(seal: Omit<RoleQualificationCalibrationSealV1, "calibrationSha256">): string {
  return hashCanonical(seal);
}

/**
 * Phase 1. Executes only the 24-case calibration partition, once, on the first
 * available profile in each frozen role order. Returning this seal is the inspection barrier:
 * no holdout request is reachable from this function.
 */
export async function runRoleCalibration(
  input: RunRoleQualificationInputV1,
  deps: RunRoleQualificationDeps,
): Promise<RoleQualificationCalibrationSealV1> {
  assertExecutor(deps);
  assertCandidateAvailability(input, deps.candidateAvailability);
  const plan = buildQualificationPlan(input, deps.candidateAvailability);
  const attempts: RoleQualificationAttemptV1[] = [];
  const entries = plan.schedule.filter((entry) => entry.partition === "calibration");
  const completed = await mapPool(entries, ROLE_QUALIFICATION_MAX_PARALLEL, async (entry) => {
    const p = input.candidateOrder[entry.role].find((profile) => profile.profileId === entry.profileId);
    const c = plan.preparedByKey.get(`${entry.role}|calibration|${entry.caseId}`);
    requireCondition(p !== undefined && c !== undefined, `calibration schedule ${entry.scheduleId} cannot resolve its frozen profile/case`);
    return runScheduledCase({ input, freeze: plan.freeze, entry, prepared: c, profile: p, executor: deps.executor, attempts });
  });
  attempts.sort((a, b) => a.scheduleId.localeCompare(b.scheduleId) || a.attemptNumber - b.attemptNumber);

  const calibrationProfiles = Object.fromEntries(ROLES.map((role) => {
    const profile = deps.candidateAvailability.entries.find((entry) => entry.role === role && entry.requiredForCalibration);
    requireCondition(profile !== undefined, `${role} has no available calibration profile`);
    return [role, profile.profileId];
  })) as Record<ReviewLaneRole, string>;
  const roleProtocolValid = Object.fromEntries(ROLES.map((role) => {
    const roleWork = completed.filter((work) => work.entry.role === role);
    return [role, roleWork.length === plan.prepared[role].calibration.length
      && roleWork.every((work) => work.finalAttempt.routeValid
        && work.finalAttempt.evaluation?.protocolValid === true
        && work.finalAttempt.evaluation.evidenceSpanValid === true)];
  })) as Record<ReviewLaneRole, boolean>;

  const sentinel = input.corpora.source.partitions.calibration.cases[0];
  const sourceProbe = await runSourceMissingEvidenceProbe(
    calibrationProfiles.source,
    sentinel,
    input.schemaHashes.source,
    plan.freeze.missingEvidenceProbeSha256,
  );
  const valid = ROLES.every((role) => roleProtocolValid[role]) && sourceProbe.passed;
  const draft: Omit<RoleQualificationCalibrationSealV1, "calibrationSha256"> = {
    schema: ROLE_QUALIFICATION_CALIBRATION_SCHEMA,
    freeze: plan.freeze,
    schedule: Object.freeze(entries),
    attempts: Object.freeze(attempts),
    sourceMissingEvidenceProbes: Object.freeze([sourceProbe]),
    candidateAvailability: deps.candidateAvailability,
    calibrationProfiles,
    roleProtocolValid,
    valid,
  };
  return Object.freeze({ ...draft, calibrationSha256: calibrationSealHash(draft) });
}

function assertCalibrationSeal(
  input: RunRoleQualificationInputV1,
  plan: QualificationPlan,
  seal: RoleQualificationCalibrationSealV1,
): void {
  requireCondition(seal?.schema === ROLE_QUALIFICATION_CALIBRATION_SCHEMA, "holdout requires an IMP-22 calibration seal");
  const { calibrationSha256, ...draft } = seal;
  requireCondition(calibrationSealHash(draft) === calibrationSha256, "calibration seal hash mismatch");
  requireCondition(seal.freeze.freezeSha256 === plan.freeze.freezeSha256, "calibration seal belongs to a different qualification freeze");
  requireCondition(seal.freeze.candidateAvailabilitySha256 === seal.candidateAvailability.availabilitySha256,
    "calibration seal freeze is bound to different availability evidence");
  assertFrozenInput(input, seal.freeze);
  assertCandidateAvailability(input, seal.candidateAvailability);

  const expectedEntries = plan.schedule.filter((entry) => entry.partition === "calibration");
  requireCondition(hashCanonical(seal.schedule) === hashCanonical(expectedEntries), "calibration schedule does not match the frozen 24-case barrier");
  requireCondition(seal.schedule.length === 24, `calibration barrier must cover exactly 24 cases (got ${seal.schedule.length})`);
  requireCondition(seal.attempts.every((attempt) => attempt.partition === "calibration"), "calibration seal contains a holdout attempt");

  const computedRoleValidity = {} as Record<ReviewLaneRole, boolean>;
  for (const role of ROLES) {
    const calibrationEntry = seal.candidateAvailability.entries.find((entry) => entry.role === role && entry.requiredForCalibration);
    requireCondition(calibrationEntry !== undefined, `${role} calibration availability entry is missing`);
    const first = input.candidateOrder[role][calibrationEntry.ordinal];
    requireCondition(seal.calibrationProfiles[role] === first.profileId, `${role} calibration profile is not the first available candidate in frozen order`);
    const roleEntries = expectedEntries.filter((entry) => entry.role === role);
    computedRoleValidity[role] = roleEntries.every((entry) => {
      const attempts = seal.attempts.filter((attempt) => attempt.scheduleId === entry.scheduleId);
      const final = attempts.sort((a, b) => a.attemptNumber - b.attemptNumber).at(-1);
      return final?.profileId === first.profileId
        && final.routeValid
        && final.evaluation?.protocolValid === true
        && final.evaluation.evidenceSpanValid === true;
    });
    requireCondition(computedRoleValidity[role] === seal.roleProtocolValid[role], `${role} calibration validity does not derive from retained attempts`);
  }
  const sourceProbe = seal.sourceMissingEvidenceProbes.find((probe) => probe.profileId === seal.calibrationProfiles.source);
  requireCondition(sourceProbe?.passed === true && sourceProbe.executorCalls === 0, "source missing-evidence refusal probe did not pass before holdout");
  const computedValid = ROLES.every((role) => computedRoleValidity[role]) && sourceProbe.passed;
  requireCondition(seal.valid === computedValid && computedValid, "calibration seal is not valid; holdout remains blocked");
}

function calibrationInspectionResultsHash(seal: RoleQualificationCalibrationSealV1): string {
  return hashCanonical({
    attempts: seal.attempts,
    sourceMissingEvidenceProbes: seal.sourceMissingEvidenceProbes,
    calibrationProfiles: seal.calibrationProfiles,
    roleProtocolValid: seal.roleProtocolValid,
    valid: seal.valid,
  });
}

function calibrationInspectionHash(
  inspection: Omit<RoleQualificationCalibrationInspectionV1, "inspectionSha256">,
): string {
  return hashCanonical(inspection);
}

/** Assemble the operator record only after the caller echoes the exact seal
 * hash. Live CLI callers additionally require an explicit --approve-holdout
 * flag before reaching this function. */
export function assembleRoleQualificationCalibrationInspection(args: {
  calibration: RoleQualificationCalibrationSealV1;
  confirmedCalibrationSha256: string;
  inspectedBy: string;
  inspectedAt: string;
  note?: string | null;
}): RoleQualificationCalibrationInspectionV1 {
  requireCondition(
    args.confirmedCalibrationSha256 === args.calibration.calibrationSha256,
    "calibration inspection confirmation does not match the retained seal hash",
  );
  requireCondition(args.calibration.schedule.length === 24, "calibration inspection requires all 24 scheduled case results");
  requireCondition(args.calibration.attempts.length >= 24, "calibration inspection requires every retained attempt");
  requireCondition(typeof args.inspectedBy === "string" && args.inspectedBy.trim().length >= 2, "calibration inspection requires an operator identifier");
  requireCondition(Number.isFinite(Date.parse(args.inspectedAt)), "calibration inspection timestamp is invalid");
  const draft: Omit<RoleQualificationCalibrationInspectionV1, "inspectionSha256"> = {
    schema: ROLE_QUALIFICATION_CALIBRATION_INSPECTION_SCHEMA,
    calibrationSha256: args.calibration.calibrationSha256,
    freezeSha256: args.calibration.freeze.freezeSha256,
    candidateAvailabilitySha256: args.calibration.candidateAvailability.availabilitySha256,
    inspectedResultsSha256: calibrationInspectionResultsHash(args.calibration),
    inspectedCaseCount: 24,
    inspectedAttemptCount: args.calibration.attempts.length,
    inspectedBy: args.inspectedBy.trim(),
    inspectedAt: new Date(args.inspectedAt).toISOString(),
    decision: "APPROVED_FOR_HOLDOUT",
    statement: ROLE_QUALIFICATION_CALIBRATION_INSPECTION_STATEMENT,
    note: args.note?.trim() || null,
  };
  return Object.freeze({ ...draft, inspectionSha256: calibrationInspectionHash(draft) });
}

export function assertRoleQualificationCalibrationInspection(
  seal: RoleQualificationCalibrationSealV1,
  inspection: RoleQualificationCalibrationInspectionV1,
): void {
  requireCondition(
    inspection?.schema === ROLE_QUALIFICATION_CALIBRATION_INSPECTION_SCHEMA,
    "holdout requires a durable human calibration-inspection attestation",
  );
  const { inspectionSha256, ...draft } = inspection;
  requireCondition(calibrationInspectionHash(draft) === inspectionSha256, "calibration inspection hash mismatch");
  requireCondition(inspection.calibrationSha256 === seal.calibrationSha256, "calibration inspection belongs to a different seal");
  requireCondition(inspection.freezeSha256 === seal.freeze.freezeSha256, "calibration inspection belongs to a different qualification freeze");
  requireCondition(
    inspection.candidateAvailabilitySha256 === seal.candidateAvailability.availabilitySha256,
    "calibration inspection belongs to different candidate-availability evidence",
  );
  requireCondition(
    inspection.inspectedResultsSha256 === calibrationInspectionResultsHash(seal),
    "calibration inspection does not bind the retained calibration results",
  );
  requireCondition(inspection.inspectedCaseCount === 24 && seal.schedule.length === 24, "calibration inspection must cover exactly 24 scheduled cases");
  requireCondition(inspection.inspectedAttemptCount === seal.attempts.length, "calibration inspection must cover every retained attempt");
  requireCondition(typeof inspection.inspectedBy === "string" && inspection.inspectedBy.trim().length >= 2, "calibration inspection operator is missing");
  requireCondition(Number.isFinite(Date.parse(inspection.inspectedAt)), "calibration inspection timestamp is invalid");
  requireCondition(inspection.decision === "APPROVED_FOR_HOLDOUT", "calibration inspection did not approve holdout");
  requireCondition(
    inspection.statement === ROLE_QUALIFICATION_CALIBRATION_INSPECTION_STATEMENT,
    "calibration inspection statement mismatch",
  );
}

/**
 * Phase 2. Requires an explicitly supplied, inspected Phase-1 seal. Executes
 * holdout only and stops as soon as reader/source/quiz have 2/2/1 qualifiers.
 */
export async function runRoleQualificationHoldout(
  input: RunRoleQualificationInputV1,
  calibration: RoleQualificationCalibrationSealV1,
  inspection: RoleQualificationCalibrationInspectionV1,
  deps: RunRoleQualificationDeps,
): Promise<RoleQualificationRunnerResultV1> {
  assertExecutor(deps);
  const plan = buildQualificationPlan(input, deps.candidateAvailability);
  assertCalibrationSeal(input, plan, calibration);
  assertRoleQualificationCalibrationInspection(calibration, inspection);

  const attempts: RoleQualificationAttemptV1[] = [...calibration.attempts];
  const probes: SourceMissingEvidenceProbeV1[] = [...calibration.sourceMissingEvidenceProbes];
  const sourceProbeByProfile = new Map(probes.map((probe) => [probe.profileId, probe]));
  const profileRoleResults: ProfileRoleQualificationV1[] = [];
  const qualifiers: Record<ReviewLaneRole, string[]> = { reader: [], source: [], quiz: [] };
  const required: Record<ReviewLaneRole, number> = { reader: 2, source: 2, quiz: 1 };
  const maxWaves = Math.max(...ROLES.map((role) => input.candidateOrder[role].length));

  for (let wave = 0; wave < maxWaves; wave++) {
    const active = ROLES.filter((role) => qualifiers[role].length < required[role]
      && input.candidateOrder[role][wave]
      && deps.candidateAvailability.entries.some((entry) => entry.role === role && entry.ordinal === wave && entry.status === "AVAILABLE"));
    if (active.length === 0) continue;

    for (const role of active) {
      if (role !== "source") continue;
      const p = input.candidateOrder.source[wave];
      if (!sourceProbeByProfile.has(p.profileId)) {
        const probe = await runSourceMissingEvidenceProbe(
          p.profileId,
          input.corpora.source.partitions.calibration.cases[0],
          input.schemaHashes.source,
          plan.freeze.missingEvidenceProbeSha256,
        );
        probes.push(probe);
        sourceProbeByProfile.set(p.profileId, probe);
      }
    }

    const entries = plan.schedule.filter((entry) => entry.wave === wave && entry.partition === "holdout" && active.includes(entry.role));
    const holdout = await mapPool(entries, ROLE_QUALIFICATION_MAX_PARALLEL, async (entry) => {
        const p = input.candidateOrder[entry.role][wave];
        const c = plan.preparedByKey.get(`${entry.role}|holdout|${entry.caseId}`);
        requireCondition(p !== undefined && c !== undefined, `schedule ${entry.scheduleId} cannot resolve its frozen profile/case`);
        return runScheduledCase({ input, freeze: plan.freeze, entry, prepared: c, profile: p, executor: deps.executor, attempts });
    });
    for (const role of active) {
      const p = input.candidateOrder[role][wave];
      const probe = role === "source" ? sourceProbeByProfile.get(p.profileId) : undefined;
      const roleHoldout = holdout.filter((work) => work.entry.role === role);
      const ledger = scoreRole(role, roleHoldout, probe?.passed === true);
      const outcome = explicitImp22Outcome(role, ledger, input.thresholds);
      const record: ProfileRoleQualificationV1 = {
        role,
        profile: p,
        candidateIndex: wave,
        calibrationCompleted: true,
        calibrationValid: calibration.roleProtocolValid[role],
        holdoutStarted: true,
        holdoutCaseCount: roleHoldout.length,
        metrics: ledger,
        outcome,
      };
      profileRoleResults.push(record);
      if (outcome.status === "QUALIFIED") qualifiers[role].push(p.profileId);
    }
    if (ROLES.every((role) => qualifiers[role].length >= required[role])) break;
  }

  attempts.sort((a, b) => a.scheduleId.localeCompare(b.scheduleId) || a.attemptNumber - b.attemptNumber);
  const allProfiles = profileList(input.candidateOrder);
  const qualifiedAt = deps.qualifiedAt?.() ?? new Date().toISOString();
  const registry: RoleQualificationRegistryV1 = {
    schema: ROLE_QUALIFICATION_REGISTRY_SCHEMA,
    profiles: allProfiles.map((p) => {
      const outcomeFor = (role: ReviewLaneRole) => profileRoleResults.find((result) => result.role === role && result.profile.profileId === p.profileId)?.outcome ?? notTested(role);
      return assembleJudgeQualification({
        profileId: p.profileId,
        model: p.model,
        effort: p.effort,
        readerOutcome: outcomeFor("reader"),
        sourceOutcome: outcomeFor("source"),
        quizOutcome: outcomeFor("quiz"),
        securityBoundary: "NOT_TESTED",
        evidenceHashes: attempts.filter((attempt) => attempt.profileId === p.profileId && attempt.rawOutputSha256).map((attempt) => attempt.rawOutputSha256!),
        corpusHashes: ROLES.map((role) => plan.freeze.corpusHashes[role]),
        instrumentHashes: [plan.freeze.freezeSha256, calibration.calibrationSha256, inspection.inspectionSha256],
        qualifiedAt,
      });
    }),
  };
  let roleSetReady = true;
  let roleSetBlockedReason: string | null = null;
  try {
    assertRoleSetReady(registry, {
      schema: REQUIRED_ROLE_SET_SCHEMA,
      reader: { primary: true, backup: true },
      source: { primary: true, independentAdjudicator: true, blindHumanAdjudicationPath: false },
      quiz: { deterministicChecker: true, semanticAdjudicator: true },
    });
  } catch (error) {
    roleSetReady = false;
    roleSetBlockedReason = (error as Error).message;
  }

  return {
    schema: ROLE_QUALIFICATION_RUNNER_SCHEMA,
    freeze: plan.freeze,
    schedule: Object.freeze(plan.schedule),
    attempts: Object.freeze(attempts),
    sourceMissingEvidenceProbes: Object.freeze(probes),
    calibrationInspection: inspection,
    profileRoleResults: Object.freeze(profileRoleResults),
    qualifiers,
    selected: {
      readerPrimary: qualifiers.reader[0] ?? null,
      readerAudit: qualifiers.reader[1] ?? null,
      sourcePrimary: qualifiers.source[0] ?? null,
      sourceAdjudicator: qualifiers.source[1] ?? null,
      quizSemanticAdjudicator: qualifiers.quiz[0] ?? null,
    },
    registry,
    roleSetReady,
    roleSetBlockedReason,
  };
}

/** Convenience composition for model-free tests and already-approved callers. */
export async function runRoleQualification(
  input: RunRoleQualificationInputV1,
  deps: RunRoleQualificationDeps & {
    inspectCalibration: (calibration: RoleQualificationCalibrationSealV1) => Promise<RoleQualificationCalibrationInspectionV1>;
  },
): Promise<RoleQualificationRunnerResultV1> {
  const calibration = await runRoleCalibration(input, deps);
  requireCondition(typeof deps.inspectCalibration === "function", "combined qualification requires an explicit calibration inspection callback");
  const inspection = await deps.inspectCalibration(calibration);
  return runRoleQualificationHoldout(input, calibration, inspection, deps);
}
