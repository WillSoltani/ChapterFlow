/**
 * IMP-24 bounded per-profile role qualification.
 *
 * This module is deliberately model- and filesystem-free. The caller supplies
 * already-compiled Review Evidence Envelope v1 cases, one injected executor,
 * and one injected lane-v2 evaluator. Every behavior-affecting input is frozen
 * before the first call and re-hashed before every attempt.
 */

import type { EffortLevelV1 } from "../../contracts/executionProfile.js";
import {
  canonicalReviewEvidenceEnvelope,
  validateReviewEvidenceEnvelope,
  type ReviewEvidenceEnvelopeV1,
} from "../../contracts/reviewEvidenceEnvelope.js";
import { hashCanonical, sha256Hex } from "../../contracts/contractUtil.js";
import type { ForwardProductionInstrumentSealV1 } from "../../orchestrator/forwardProductionInstrumentSeal.js";
import { computeForwardProductionInstrumentSealSha256 } from "../../orchestrator/forwardProductionInstrumentSeal.js";
import { BASELINE_MODEL } from "../../orchestrator/modelPolicy.js";
import {
  reviewProtocolFileAccessFailureV2,
  reviewProtocolFreshnessErrorsV2,
  reviewProtocolHasProhibitedConductorEchoV2,
} from "../../review/reviewProtocolV2.js";
import {
  IMP24_CORPUS_EXPECTED_COUNTS,
  IMP24_ROLE_QUALIFICATION_ID,
  certifyImp24Corpora,
  type Imp24CorpusBundle,
  type Imp24CorpusCertification,
  type Imp24CorpusPartitionName,
  type Imp24ReviewRole,
} from "./imp24Corpus.js";
import {
  REQUIRED_ROLE_SET_SCHEMA,
  ROLE_QUALIFICATION_OUTCOME_SCHEMA,
  ROLE_QUALIFICATION_REGISTRY_SCHEMA,
  type RecoveryRoleThresholdsV1,
  type RoleMetricDenominatorsV1,
  type RoleMetricRatesV1,
  type RoleQualificationOutcomeV1,
  type RoleQualificationRegistryV1,
} from "./reviewLaneTypes.js";
import { assembleJudgeQualification, assertRoleSetReady, qualifyRole } from "./roleQualification.js";

export const IMP24_ROLE_QUALIFICATION_RUNNER_SCHEMA = "imp24-role-qualification-runner-v3" as const;
export const IMP24_ROLE_QUALIFICATION_FREEZE_SCHEMA = "imp24-role-qualification-freeze-v3" as const;
export const IMP24_ROLE_QUALIFICATION_REQUEST_SCHEMA = "imp24-role-qualification-execution-request-v3" as const;
export const IMP24_ROLE_QUALIFICATION_RECEIPT_SCHEMA = "imp24-role-qualification-execution-receipt-v3" as const;
export const IMP24_ROLE_QUALIFICATION_ATTEMPT_SCHEMA = "imp24-role-qualification-attempt-v3" as const;
export const IMP24_ROLE_QUALIFICATION_AVAILABILITY_SCHEMA = "imp24-role-candidate-availability-v3" as const;
export const IMP24_INSTRUMENT_CERTIFICATION_BINDING_SCHEMA = "imp24-instrument-certification-binding-v1" as const;

export const IMP24_MAX_PARALLEL = 2 as const;
export const IMP24_CANARY_CASES_PER_PROFILE_ROLE = 2 as const;
export const IMP24_BASE_MAXIMUM_CALLS = 464 as const;
export const IMP24_HARD_MAXIMUM_CALLS = 928 as const;
export const IMP24_ROLE_QUALIFICATION_CALL_BUDGET_V3 = Object.freeze({
  maxParallel: IMP24_MAX_PARALLEL,
  baseMaximumCalls: IMP24_BASE_MAXIMUM_CALLS,
  hardMaximumCalls: IMP24_HARD_MAXIMUM_CALLS,
  replayPolicy: "one-replay-only-for-frozen-infrastructure-statuses",
});

const ROLES = ["reader", "source", "quiz"] as const satisfies readonly Imp24ReviewRole[];
const SHA256 = /^[a-f0-9]{64}$/;
export const IMP24_REQUIRED_ROLE_QUALIFIERS: Readonly<Record<Imp24ReviewRole, number>> = Object.freeze({
  reader: 2,
  source: 2,
  quiz: 1,
});
const INFRASTRUCTURE_REPLAY_STATUSES = new Set<QualificationReceiptStatusV3>([
  "timeout",
  "provider_capacity",
  "transient_execution_failure",
]);

export type QualificationProfileV3 = {
  profileId: string;
  model: string;
  effort: EffortLevelV1;
};

const profile = (model: string, effort: EffortLevelV1): QualificationProfileV3 => ({
  profileId: `${model}@${effort}`,
  model,
  effort,
});

/** Owner-frozen order. Availability can skip an entry but can never reorder it. */
export const IMP24_ROLE_CANDIDATE_ORDER: Readonly<Record<Imp24ReviewRole, readonly QualificationProfileV3[]>> = Object.freeze({
  reader: Object.freeze([
    profile("gpt-5.6-sol", "high"),
    profile(BASELINE_MODEL, "high"),
    profile("gpt-5.6-sol", "xhigh"),
    profile(BASELINE_MODEL, "xhigh"),
  ]),
  source: Object.freeze([
    profile("gpt-5.6-sol", "xhigh"),
    profile(BASELINE_MODEL, "xhigh"),
    profile("gpt-5.6-sol", "high"),
    profile(BASELINE_MODEL, "high"),
  ]),
  quiz: Object.freeze([
    profile("gpt-5.6-sol", "xhigh"),
    profile(BASELINE_MODEL, "xhigh"),
    profile("gpt-5.6-sol", "high"),
    profile(BASELINE_MODEL, "high"),
  ]),
});

export const IMP24_ROLE_CANDIDATE_ORDER_SHA256 = hashCanonical(IMP24_ROLE_CANDIDATE_ORDER);
export const IMP24_ROLE_QUALIFICATION_CALL_BUDGET_SHA256 = hashCanonical(IMP24_ROLE_QUALIFICATION_CALL_BUDGET_V3);

/** Frozen IMP-24 floors. `evidenceSpanValidity` is the legacy metric id retained
 * as a field-name alias for evidence-reference validity; IMP-24 raises that
 * translated validity floor to the mandatory 100% for every lane. */
export const IMP24_FROZEN_ROLE_THRESHOLDS: RecoveryRoleThresholdsV1 = Object.freeze({
  schema: "split-lane-recovery-role-thresholds-v1",
  thresholdsVersion: "imp22-forward-role-thresholds-v1",
  reader: Object.freeze({
    schemaValidity: { minRate: 1, minDenominator: 30, zeroMiss: true },
    hardBlockerSensitivity: { minRate: 1, minDenominator: 10, zeroMiss: true },
    hardBlockerFalsePositiveFree: { minRate: 1, minDenominator: 10, zeroMiss: true },
    cleanControlPassRate: { minRate: 0.9, minDenominator: 10, zeroMiss: false },
    craftCalibrationAccuracy: { minRate: 0.8, minDenominator: 10, zeroMiss: false },
    evidenceSpanValidity: { minRate: 1, minDenominator: 30, zeroMiss: true },
    requiredCasesResolved: { minRate: 1, minDenominator: 30, zeroMiss: true },
  }),
  source: Object.freeze({
    schemaValidity: { minRate: 1, minDenominator: 40, zeroMiss: true },
    fabricationSensitivity: { minRate: 1, minDenominator: 4, zeroMiss: true },
    causalOverreachSensitivity: { minRate: 1, minDenominator: 4, zeroMiss: true },
    sourceContradictionSensitivity: { minRate: 1, minDenominator: 2, zeroMiss: true },
    highSeverityFalsePositiveFree: { minRate: 1, minDenominator: 20, zeroMiss: true },
    cleanCasePassRate: { minRate: 0.9, minDenominator: 20, zeroMiss: false },
    supportStatusAccuracy: { minRate: 0.9, minDenominator: 40, zeroMiss: false },
    visibleRegisterAccuracy: { minRate: 0.9, minDenominator: 40, zeroMiss: false },
    evidenceSpanValidity: { minRate: 1, minDenominator: 40, zeroMiss: true },
    missingEvidenceInconclusive: { minRate: 1, minDenominator: 1, zeroMiss: true },
    requiredCasesResolved: { minRate: 1, minDenominator: 40, zeroMiss: true },
  }),
  quiz: Object.freeze({
    schemaValidity: { minRate: 1, minDenominator: 40, zeroMiss: true },
    wrongKeyDetection: { minRate: 1, minDenominator: 10, zeroMiss: true },
    cleanUniquePassRate: { minRate: 0.9, minDenominator: 10, zeroMiss: false },
    ambiguityDetection: { minRate: 0.9, minDenominator: 10, zeroMiss: false },
    mechanismAccuracy: { minRate: 0.9, minDenominator: 10, zeroMiss: false },
    evidenceSpanValidity: { minRate: 1, minDenominator: 40, zeroMiss: true },
    requiredCasesResolved: { minRate: 1, minDenominator: 40, zeroMiss: true },
  }),
});

export type InstrumentCertificationBindingV3 = {
  schema: typeof IMP24_INSTRUMENT_CERTIFICATION_BINDING_SCHEMA;
  status: "CERTIFIED_MODEL_FREE";
  /** Model-free certification proved that absent required source evidence is
   * assembled as INCONCLUSIVE before any reviewer spawn. This certified probe
   * is scored once per source profile; it is not a live holdout case. */
  sourceMissingEvidenceInconclusiveCertified: true;
  experimentId: typeof IMP24_ROLE_QUALIFICATION_ID;
  corpusCertificationSha256: string;
  corpusBundleSha256: string;
  productionInstrumentSealSha256: string;
  envelopeContractSha256: string;
  envelopeCompilerSha256: string;
  modelOutputContractsSha256: string;
  productionQualificationParitySha256: string;
  scorerSha256: string;
  promptBundleSha256: string;
  schemaBundleSha256: string;
  thresholdsSha256: string;
  legacyEvidenceClosureSha256: string;
  independentAuditPasses: 2;
  modelCalls: 0;
  apiCalls: 0;
  certificationSha256: string;
};

export type CandidateAvailabilityEntryV3 = QualificationProfileV3 & {
  role: Imp24ReviewRole;
  ordinal: number;
  status: "AVAILABLE" | "UNAVAILABLE";
  modelListed: boolean;
  visible: boolean;
  effortSupported: boolean;
  reason: string;
};

export type CandidateAvailabilityV3 = {
  schema: typeof IMP24_ROLE_QUALIFICATION_AVAILABILITY_SCHEMA;
  experimentId: typeof IMP24_ROLE_QUALIFICATION_ID;
  source: "codex-local-models-cache";
  sourceBytesSha256: string;
  sourceFetchedAt: string;
  policyBytesSha256: string;
  candidateOrderSha256: string;
  entries: CandidateAvailabilityEntryV3[];
  availabilitySha256: string;
};

export type PreparedQualificationCaseV3 = {
  role: Imp24ReviewRole;
  partition: Imp24CorpusPartitionName;
  caseId: string;
  family: string;
  sourceCaseSha256: string;
  goldSha256: string;
  schemaSha256: string;
  promptSourceSha256: string;
  task: string;
  envelope: ReviewEvidenceEnvelopeV1;
  /** Exact canonical bytes returned by serializeReviewEvidenceEnvelope. */
  evidenceEnvelopeBytes: string;
  evidenceEnvelopeBytesSha256: string;
};

export type PreparedQualificationCasesV3 = Record<
  Imp24ReviewRole,
  Record<Imp24CorpusPartitionName, readonly PreparedQualificationCaseV3[]>
>;

export type RunRoleQualificationInputV3 = {
  experimentId: typeof IMP24_ROLE_QUALIFICATION_ID;
  corpusBundle: Imp24CorpusBundle;
  corpusCertification: Imp24CorpusCertification;
  certification: InstrumentCertificationBindingV3;
  productionInstrumentSeal: ForwardProductionInstrumentSealV1;
  candidateAvailability: CandidateAvailabilityV3;
  thresholds: RecoveryRoleThresholdsV1;
  thresholdBytesSha256: string;
  schemaHashes: Record<Imp24ReviewRole, string>;
  promptSourceHashes: Record<Imp24ReviewRole, string>;
  preparedCases: PreparedQualificationCasesV3;
};

export type QualificationReceiptStatusV3 =
  | "completed"
  | "timeout"
  | "provider_capacity"
  | "transient_execution_failure"
  | "refusal"
  | "policy_failure"
  | "invalid_output"
  | "integrity_failure";

type QualificationExecutionRequestCoreV3 = {
  schema: typeof IMP24_ROLE_QUALIFICATION_REQUEST_SCHEMA;
  experimentId: typeof IMP24_ROLE_QUALIFICATION_ID;
  scheduleId: string;
  attemptId: string;
  replayOfAttemptId: string | null;
  attemptNumber: 1 | 2;
  role: Imp24ReviewRole;
  partition: Imp24CorpusPartitionName;
  caseId: string;
  family: string;
  profileId: string;
  model: string;
  effort: EffortLevelV1;
  schemaSha256: string;
  promptSourceSha256: string;
  goldSha256: string;
  sourceCaseSha256: string;
  freezeSha256: string;
  certificationSha256: string;
  productionInstrumentSealSha256: string;
  reviewProtocol: "review-evidence-envelope-v1";
  evidenceEnvelopeSha256: string;
  evidenceEnvelopeBytesSha256: string;
  evidenceEnvelopeBytes: string;
  task: string;
};

export type QualificationExecutionRequestV3 = QualificationExecutionRequestCoreV3 & { requestSha256: string };

type QualificationExecutionReceiptCoreV3 = {
  schema: typeof IMP24_ROLE_QUALIFICATION_RECEIPT_SCHEMA;
  executionId: string;
  status: QualificationReceiptStatusV3;
  requestSha256: string;
  freezeSha256: string;
  certificationSha256: string;
  productionInstrumentSealSha256: string;
  role: Imp24ReviewRole;
  profileId: string;
  model: string;
  effort: EffortLevelV1;
  schemaSha256: string;
  reviewProtocol: "review-evidence-envelope-v1";
  evidenceEnvelopeSha256: string;
  evidenceEnvelopeBytesSha256: string;
  evidenceEnvelopeBytes: string;
  rawOutput: string | null;
  failureDetail?: string;
};

export type QualificationExecutionReceiptV3 = QualificationExecutionReceiptCoreV3 & { receiptSha256: string };

export type QualificationExecutorV3 = (request: QualificationExecutionRequestV3) => Promise<QualificationExecutionReceiptV3>;

/** Lane parsers/assemblers return protocol facts separately from semantic gold.
 * `semanticCorrect` is retained for canaries but never participates in the
 * canary protocol gate. */
export type CaseEvaluationV3 = {
  schemaValid: boolean;
  envelopeBound: boolean;
  evidenceReferenceValid: boolean;
  authorityCompliant: boolean;
  complete: boolean;
  fileAccessFailure: boolean;
  prohibitedConductorEcho: boolean;
  resolved: boolean;
  semanticCorrect: boolean;
  semanticSummary: string;
  metricObservations: Record<string, boolean>;
  /** Exact schema-valid model object, retained separately from the raw output.
   * Null means parsing failed before a model object could be trusted. */
  parsedOutput: unknown | null;
  parseError: string | null;
  /** Full conductor-owned V2 review assembled from the parsed output and the
   * frozen inline evidence envelope. Null means assembly did not complete. */
  assembledReview: unknown | null;
  assemblyError: string | null;
  /** Explicit deterministic projection of every resolved evidence-reference
   * pair plus unresolved target/question refs and any resolution error. */
  evidenceReferenceResolution: EvidenceReferenceResolutionV3;
};

export type EvidenceReferenceResolutionBindingV3 = {
  path: string;
  refIds: string[];
  evidenceSpans: string[];
};

export type EvidenceReferenceResolutionV3 = {
  status: "RESOLVED" | "INCOMPLETE" | "FAILED" | "NOT_APPLICABLE";
  bindings: EvidenceReferenceResolutionBindingV3[];
  unresolvedTargetRefs: string[];
  unresolvedQuestionRefs: string[];
  error: {
    name: string;
    message: string;
    code: string | null;
    refId: string | null;
  } | null;
};

export type QualificationOutputEvaluatorV3 = (args: {
  preparedCase: PreparedQualificationCaseV3;
  request: QualificationExecutionRequestV3;
  receipt: QualificationExecutionReceiptV3;
  rawOutput: string;
}) => CaseEvaluationV3;

export type QualificationScheduleEntryV3 = {
  scheduleId: string;
  ordinal: number;
  role: Imp24ReviewRole;
  candidateOrdinal: number;
  profileId: string;
  partition: Imp24CorpusPartitionName;
  caseOrdinal: number;
  caseId: string;
  family: string;
  sourceCaseSha256: string;
  goldSha256: string;
  schemaSha256: string;
  promptSourceSha256: string;
  evidenceEnvelopeSha256: string;
  evidenceEnvelopeBytesSha256: string;
  taskSha256: string;
};

export type QualificationFreezeV3 = {
  schema: typeof IMP24_ROLE_QUALIFICATION_FREEZE_SCHEMA;
  experimentId: typeof IMP24_ROLE_QUALIFICATION_ID;
  candidateOrderSha256: string;
  candidateAvailabilitySha256: string;
  candidateAvailabilitySnapshotSha256: string;
  corpusBundleSha256: string;
  corpusSnapshotSha256: string;
  corpusCertificationSha256: string;
  certificationSha256: string;
  certificationSnapshotSha256: string;
  productionInstrumentSealSha256: string;
  productionInstrumentSealSnapshotSha256: string;
  productionQualificationParitySha256: string;
  thresholdsSha256: string;
  thresholdBytesSha256: string;
  schemaHashesSha256: string;
  promptSourceHashesSha256: string;
  preparedCasesSha256: string;
  scheduleSha256: string;
  maxParallel: typeof IMP24_MAX_PARALLEL;
  baseMaximumCalls: typeof IMP24_BASE_MAXIMUM_CALLS;
  hardMaximumCalls: typeof IMP24_HARD_MAXIMUM_CALLS;
  freezeSha256: string;
};

export type QualificationAttemptV3 = {
  schema: typeof IMP24_ROLE_QUALIFICATION_ATTEMPT_SCHEMA;
  scheduleOrdinal: number;
  request: QualificationExecutionRequestV3;
  receipt: QualificationExecutionReceiptV3 | null;
  routeValid: boolean;
  replayEligible: boolean;
  evaluation: CaseEvaluationV3 | null;
  protocolValid: boolean;
  semanticCorrect: boolean | null;
  rawOutputSha256: string | null;
  retainedEnvelopeBytes: string;
  retainedEnvelopeBytesSha256: string;
  terminalReason: string;
};

export type RoleMetricLedgerV3 = {
  metrics: RoleMetricRatesV1;
  denominators: RoleMetricDenominatorsV1;
  numerators: Record<string, number>;
  hardFalsePositives: number;
  highSeverityFalsePositives: number;
  unresolvedRequiredCases: number;
};

export type ProfileRoleStatusV3 =
  | "UNAVAILABLE"
  | "NOT_TESTED_SEQUENTIAL_STOP"
  | "NOT_QUALIFIED_PROTOCOL"
  | "NOT_QUALIFIED"
  | "NOT_TESTED_UNDERPOWERED"
  | "QUALIFIED";

export type ProfileRoleResultV3 = {
  role: Imp24ReviewRole;
  candidateOrdinal: number;
  profile: QualificationProfileV3;
  availability: "AVAILABLE" | "UNAVAILABLE";
  status: ProfileRoleStatusV3;
  canaryStarted: boolean;
  canaryCaseCount: number;
  canaryProtocolPassed: boolean;
  canarySemanticCorrectCount: number;
  holdoutStarted: boolean;
  holdoutCaseCount: number;
  attempts: number;
  metrics: RoleMetricLedgerV3 | null;
  outcome: RoleQualificationOutcomeV1;
};

export type RoleQualificationRunnerResultV3 = {
  schema: typeof IMP24_ROLE_QUALIFICATION_RUNNER_SCHEMA;
  experimentId: typeof IMP24_ROLE_QUALIFICATION_ID;
  freeze: Readonly<QualificationFreezeV3>;
  schedule: readonly QualificationScheduleEntryV3[];
  attempts: readonly QualificationAttemptV3[];
  profileRoleResults: readonly ProfileRoleResultV3[];
  qualifiers: Record<Imp24ReviewRole, string[]>;
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
  baseCallsAttempted: number;
  infrastructureReplays: number;
  totalAttempts: number;
  firstLiveRequestSha256: string | null;
};

export type RunRoleQualificationDepsV3 = {
  executor: QualificationExecutorV3;
  evaluateOutput: QualificationOutputEvaluatorV3;
  /** Official live campaigns persist this callback's full evaluation before
   * continuing. Pure/model-free tests may omit it. */
  retainAttemptEvaluation?: (attempt: QualificationAttemptV3) => void | Promise<void>;
  qualifiedAt?: () => string;
};

export class RoleQualificationRunnerV3Error extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RoleQualificationRunnerV3Error";
  }
}

function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new RoleQualificationRunnerV3Error(message);
}

function requireSha(value: unknown, label: string): asserts value is string {
  requireCondition(typeof value === "string" && SHA256.test(value), `${label} must be a lowercase sha256`);
}

export function qualificationRequestSha256(core: QualificationExecutionRequestCoreV3): string {
  return hashCanonical(core);
}

export function qualificationReceiptSha256(core: QualificationExecutionReceiptCoreV3): string {
  return hashCanonical(core);
}

export function instrumentCertificationBindingSha256(
  value: Omit<InstrumentCertificationBindingV3, "certificationSha256">,
): string {
  return hashCanonical(value);
}

export function candidateAvailabilitySha256(
  value: Omit<CandidateAvailabilityV3, "availabilitySha256">,
): string {
  return hashCanonical(value);
}

function validateCertification(input: RunRoleQualificationInputV3): void {
  const certification = input.certification;
  requireCondition(certification.schema === IMP24_INSTRUMENT_CERTIFICATION_BINDING_SCHEMA, "v3 instrument certification schema mismatch");
  requireCondition(certification.status === "CERTIFIED_MODEL_FREE", "live v3 qualification requires CERTIFIED_MODEL_FREE");
  requireCondition(certification.sourceMissingEvidenceInconclusiveCertified === true,
    "instrument certification did not prove source missing-evidence INCONCLUSIVE behavior");
  requireCondition(certification.experimentId === IMP24_ROLE_QUALIFICATION_ID, "certification belongs to another experiment");
  const { certificationSha256, ...draft } = certification;
  requireSha(certificationSha256, "certificationSha256");
  requireCondition(instrumentCertificationBindingSha256(draft) === certificationSha256, "instrument certification hash mismatch");
  requireCondition(certification.independentAuditPasses === 2, "instrument certification requires two independent audit passes");
  requireCondition(certification.modelCalls === 0 && certification.apiCalls === 0, "instrument certification must be model/API free");
  requireCondition(certification.corpusBundleSha256 === input.corpusBundle.substantiveBundleSha256, "certification corpus bundle binding mismatch");
  requireCondition(certification.corpusCertificationSha256 === hashCanonical(input.corpusCertification), "certification corpus audit binding mismatch");
  requireCondition(certification.productionInstrumentSealSha256 === input.productionInstrumentSeal.sealSha256, "certification production seal binding mismatch");
  requireCondition(certification.thresholdsSha256 === hashCanonical(input.thresholds), "certification thresholds binding mismatch");
  requireCondition(certification.promptBundleSha256 === hashCanonical(input.promptSourceHashes), "certification prompt bundle binding mismatch");
  requireCondition(certification.schemaBundleSha256 === hashCanonical(input.schemaHashes), "certification schema bundle binding mismatch");
  for (const [label, value] of Object.entries({
    envelopeContractSha256: certification.envelopeContractSha256,
    envelopeCompilerSha256: certification.envelopeCompilerSha256,
    modelOutputContractsSha256: certification.modelOutputContractsSha256,
    productionQualificationParitySha256: certification.productionQualificationParitySha256,
    scorerSha256: certification.scorerSha256,
    legacyEvidenceClosureSha256: certification.legacyEvidenceClosureSha256,
  })) requireSha(value, label);
}

function validateProductionSeal(seal: ForwardProductionInstrumentSealV1): void {
  requireCondition(seal?.schema === "forward-production-instrument-seal-v1" && seal.version === 1, "production instrument seal schema/version mismatch");
  requireSha(seal.sealSha256, "production instrument seal");
  requireCondition(computeForwardProductionInstrumentSealSha256(seal) === seal.sealSha256, "production instrument seal self hash mismatch");
  requireCondition(seal.capabilities.publish === false && seal.capabilities.promote === false
    && seal.capabilities.deploy === false && seal.capabilities.upload === false && seal.capabilities.api === false,
  "production instrument seal exposes a prohibited capability");
}

function validateAvailability(availability: CandidateAvailabilityV3): void {
  requireCondition(availability.schema === IMP24_ROLE_QUALIFICATION_AVAILABILITY_SCHEMA, "v3 candidate availability schema mismatch");
  requireCondition(availability.experimentId === IMP24_ROLE_QUALIFICATION_ID, "candidate availability belongs to another experiment");
  requireCondition(availability.source === "codex-local-models-cache", "candidate availability must derive from the local Codex models cache");
  requireSha(availability.sourceBytesSha256, "candidate availability source hash");
  requireSha(availability.policyBytesSha256, "candidate availability policy hash");
  requireCondition(Number.isFinite(Date.parse(availability.sourceFetchedAt)), "candidate availability timestamp is invalid");
  requireCondition(availability.candidateOrderSha256 === hashCanonical(IMP24_ROLE_CANDIDATE_ORDER), "candidate availability order hash mismatch");
  const expected = ROLES.flatMap((role) => IMP24_ROLE_CANDIDATE_ORDER[role].map((candidate, ordinal) => ({ role, ordinal, ...candidate })));
  requireCondition(availability.entries.length === expected.length, "candidate availability entry count differs from frozen order");
  expected.forEach((target, index) => {
    const entry = availability.entries[index];
    requireCondition(entry?.role === target.role && entry.ordinal === target.ordinal
      && entry.profileId === target.profileId && entry.model === target.model && entry.effort === target.effort,
    `candidate availability entry ${index} reordered or changed`);
    const derived = entry.modelListed && entry.visible && entry.effortSupported ? "AVAILABLE" : "UNAVAILABLE";
    requireCondition(entry.status === derived, `candidate availability status does not derive for ${entry.profileId}`);
    requireCondition(typeof entry.reason === "string" && entry.reason.trim().length > 0, `candidate availability reason missing for ${entry.profileId}`);
  });
  const { availabilitySha256, ...draft } = availability;
  requireCondition(candidateAvailabilitySha256(draft) === availabilitySha256, "candidate availability hash mismatch");
}

function corpusCaseList(bundle: Imp24CorpusBundle, role: Imp24ReviewRole, partition: Imp24CorpusPartitionName): Array<{
  caseId: string;
  substantiveCaseSha256: string;
}> {
  return bundle[role][partition].cases as Array<{ caseId: string; substantiveCaseSha256: string }>;
}

const FORBIDDEN_TASK_TEXT = /\b(?:file is at|read (?:only )?this file|open (?:the )?file|use (?:the )?(?:filesystem|shell)\s+to|inspect (?:the )?(?:workspace|path))\b|\/(?:Users|home)\/|(?:^|\s)(?:\.\.?\/)[^\s]+/i;

function validatePreparedCases(input: RunRoleQualificationInputV3): void {
  const seen = new Set<string>();
  for (const role of ROLES) {
    requireSha(input.schemaHashes[role], `${role} schema hash`);
    requireSha(input.promptSourceHashes[role], `${role} prompt source hash`);
    for (const partition of ["canary", "holdout"] as const) {
      const prepared = input.preparedCases[role][partition];
      const corpus = corpusCaseList(input.corpusBundle, role, partition);
      const expectedCount = IMP24_CORPUS_EXPECTED_COUNTS[role][partition];
      requireCondition(prepared.length === expectedCount && corpus.length === expectedCount,
        `${role} ${partition} must contain exactly ${expectedCount} frozen cases`);
      prepared.forEach((item, index) => {
        const source = corpus[index];
        requireCondition(item.role === role && item.partition === partition, `${role} ${partition} prepared case ${index} has wrong role/partition`);
        requireCondition(item.caseId === source?.caseId && item.sourceCaseSha256 === source?.substantiveCaseSha256,
          `${role} ${partition} prepared case ${index} differs from frozen corpus order/hash`);
        requireCondition(!seen.has(`${role}|${item.caseId}`), `duplicate prepared case ${role}/${item.caseId}`);
        seen.add(`${role}|${item.caseId}`);
        requireCondition(item.schemaSha256 === input.schemaHashes[role], `${item.caseId}: schema hash differs from frozen role schema`);
        requireCondition(item.promptSourceSha256 === input.promptSourceHashes[role], `${item.caseId}: prompt source hash differs from frozen role prompt`);
        requireSha(item.goldSha256, `${item.caseId} gold hash`);
        const envelopeErrors = validateReviewEvidenceEnvelope(item.envelope);
        requireCondition(envelopeErrors.length === 0, `${item.caseId}: invalid evidence envelope (${envelopeErrors.join("; ")})`);
        const expectedEnvelopeCaseId = role === "source" ? `${item.caseId}:U1` : item.caseId;
        requireCondition(item.envelope.lane === role && item.envelope.caseId === expectedEnvelopeCaseId,
          `${item.caseId}: evidence envelope lane/case binding mismatch`);
        if (role === "source") {
          const sourcePartition = item.envelope.immutableBindings.partition as Record<string, unknown> | undefined;
          requireCondition(sourcePartition?.targetRef === "U1"
              && sourcePartition.partitionIndex === 0
              && sourcePartition.partitionCount === 1,
            `${item.caseId}: qualification source envelope is not the exact isolated U1 partition`);
        }
        const canonicalBytes = canonicalReviewEvidenceEnvelope(item.envelope);
        requireCondition(item.evidenceEnvelopeBytes === canonicalBytes, `${item.caseId}: retained evidence envelope bytes are not exact canonical bytes`);
        requireCondition(item.evidenceEnvelopeBytesSha256 === sha256Hex(item.evidenceEnvelopeBytes), `${item.caseId}: evidence envelope bytes hash mismatch`);
        requireCondition(item.task.includes(item.evidenceEnvelopeBytes), `${item.caseId}: complete evidence envelope is not inline in task`);
        requireCondition(item.task.includes("All evidence required for this review is included below."), `${item.caseId}: inline evidence instruction missing`);
        requireCondition(item.task.includes("Do not use filesystem, shell, network, or external tools."), `${item.caseId}: no-tool instruction missing`);
        requireCondition(item.task.includes("Judge only the inline evidence envelope."), `${item.caseId}: inline-only instruction missing`);
        requireCondition(!FORBIDDEN_TASK_TEXT.test(item.task), `${item.caseId}: task contains file/path navigation instructions`);
      });
    }
  }
}

function validateCorpus(input: RunRoleQualificationInputV3): void {
  requireCondition(input.corpusBundle.experimentId === IMP24_ROLE_QUALIFICATION_ID, "corpus belongs to another experiment");
  const recomputed = certifyImp24Corpora(input.corpusBundle);
  requireCondition(hashCanonical(recomputed) === hashCanonical(input.corpusCertification), "retained corpus certification differs from fresh independent audits");
  requireCondition(input.corpusCertification.status === "PASS", "corpus certification did not pass");
}

function validateThresholds(thresholds: RecoveryRoleThresholdsV1): void {
  requireCondition(hashCanonical(thresholds) === hashCanonical(IMP24_FROZEN_ROLE_THRESHOLDS), "IMP-24 thresholds changed or were weakened");
}

export function projectPreparedQualificationCasesV3(prepared: PreparedQualificationCasesV3): unknown {
  return Object.fromEntries(ROLES.map((role) => [role, Object.fromEntries((["canary", "holdout"] as const).map((partition) => [
    partition,
    prepared[role][partition].map((item) => ({
      role: item.role,
      partition: item.partition,
      caseId: item.caseId,
      family: item.family,
      sourceCaseSha256: item.sourceCaseSha256,
      goldSha256: item.goldSha256,
      schemaSha256: item.schemaSha256,
      promptSourceSha256: item.promptSourceSha256,
      taskSha256: sha256Hex(item.task),
      evidenceEnvelopeSha256: item.envelope.envelopeSha256,
      evidenceEnvelopeBytesSha256: item.evidenceEnvelopeBytesSha256,
      actualEvidenceEnvelopeBytesSha256: sha256Hex(item.evidenceEnvelopeBytes),
      canonicalEnvelopeBytesSha256: sha256Hex(canonicalReviewEvidenceEnvelope(item.envelope)),
    })),
  ]))]));
}

export function buildFrozenRoleQualificationScheduleV3(
  preparedCases: PreparedQualificationCasesV3,
): QualificationScheduleEntryV3[] {
  const schedule: QualificationScheduleEntryV3[] = [];
  let ordinal = 0;
  for (const role of ROLES) {
    IMP24_ROLE_CANDIDATE_ORDER[role].forEach((candidate, candidateOrdinal) => {
      for (const partition of ["canary", "holdout"] as const) {
        preparedCases[role][partition].forEach((item, caseOrdinal) => {
          schedule.push({
            scheduleId: `v3-${role}-p${candidateOrdinal + 1}-${partition}-c${String(caseOrdinal + 1).padStart(2, "0")}`,
            ordinal: ordinal++,
            role,
            candidateOrdinal,
            profileId: candidate.profileId,
            partition,
            caseOrdinal,
            caseId: item.caseId,
            family: item.family,
            sourceCaseSha256: item.sourceCaseSha256,
            goldSha256: item.goldSha256,
            schemaSha256: item.schemaSha256,
            promptSourceSha256: item.promptSourceSha256,
            evidenceEnvelopeSha256: item.envelope.envelopeSha256,
            evidenceEnvelopeBytesSha256: item.evidenceEnvelopeBytesSha256,
            taskSha256: sha256Hex(item.task),
          });
        });
      }
    });
  }
  requireCondition(schedule.length === IMP24_BASE_MAXIMUM_CALLS,
    `frozen v3 schedule must contain ${IMP24_BASE_MAXIMUM_CALLS} base calls (got ${schedule.length})`);
  return schedule;
}

function buildFreeze(input: RunRoleQualificationInputV3, schedule: QualificationScheduleEntryV3[]): QualificationFreezeV3 {
  const draft = {
    schema: IMP24_ROLE_QUALIFICATION_FREEZE_SCHEMA,
    experimentId: IMP24_ROLE_QUALIFICATION_ID,
    candidateOrderSha256: hashCanonical(IMP24_ROLE_CANDIDATE_ORDER),
    candidateAvailabilitySha256: input.candidateAvailability.availabilitySha256,
    candidateAvailabilitySnapshotSha256: hashCanonical(input.candidateAvailability),
    corpusBundleSha256: input.corpusBundle.substantiveBundleSha256,
    corpusSnapshotSha256: hashCanonical(input.corpusBundle),
    corpusCertificationSha256: hashCanonical(input.corpusCertification),
    certificationSha256: input.certification.certificationSha256,
    certificationSnapshotSha256: hashCanonical(input.certification),
    productionInstrumentSealSha256: input.productionInstrumentSeal.sealSha256,
    productionInstrumentSealSnapshotSha256: hashCanonical(input.productionInstrumentSeal),
    productionQualificationParitySha256: input.certification.productionQualificationParitySha256,
    thresholdsSha256: hashCanonical(input.thresholds),
    thresholdBytesSha256: input.thresholdBytesSha256,
    schemaHashesSha256: hashCanonical(input.schemaHashes),
    promptSourceHashesSha256: hashCanonical(input.promptSourceHashes),
    preparedCasesSha256: hashCanonical(projectPreparedQualificationCasesV3(input.preparedCases)),
    scheduleSha256: hashCanonical(schedule),
    maxParallel: IMP24_MAX_PARALLEL,
    baseMaximumCalls: IMP24_BASE_MAXIMUM_CALLS,
    hardMaximumCalls: IMP24_HARD_MAXIMUM_CALLS,
  } as const;
  return Object.freeze({ ...draft, freezeSha256: hashCanonical(draft) });
}

function assertFrozenInput(input: RunRoleQualificationInputV3, freeze: QualificationFreezeV3): void {
  requireCondition(input.experimentId === IMP24_ROLE_QUALIFICATION_ID, "v3 experiment identity drifted");
  requireCondition(hashCanonical(IMP24_ROLE_CANDIDATE_ORDER) === freeze.candidateOrderSha256, "candidate order changed after freeze");
  requireCondition(input.candidateAvailability.availabilitySha256 === freeze.candidateAvailabilitySha256, "candidate availability changed after freeze");
  requireCondition(hashCanonical(input.candidateAvailability) === freeze.candidateAvailabilitySnapshotSha256,
    "candidate availability contents changed after freeze");
  requireCondition(input.corpusBundle.substantiveBundleSha256 === freeze.corpusBundleSha256, "corpus bundle changed after freeze");
  requireCondition(hashCanonical(input.corpusBundle) === freeze.corpusSnapshotSha256, "corpus gold/case contents changed after freeze");
  requireCondition(hashCanonical(input.corpusCertification) === freeze.corpusCertificationSha256, "corpus certification changed after freeze");
  requireCondition(input.certification.certificationSha256 === freeze.certificationSha256, "instrument certification changed after freeze");
  requireCondition(hashCanonical(input.certification) === freeze.certificationSnapshotSha256,
    "instrument certification contents changed after freeze");
  requireCondition(input.productionInstrumentSeal.sealSha256 === freeze.productionInstrumentSealSha256, "production instrument seal changed after freeze");
  requireCondition(hashCanonical(input.productionInstrumentSeal) === freeze.productionInstrumentSealSnapshotSha256,
    "production instrument seal contents changed after freeze");
  requireCondition(input.certification.productionQualificationParitySha256 === freeze.productionQualificationParitySha256,
    "production/qualification parity binding changed after freeze");
  requireCondition(hashCanonical(input.thresholds) === freeze.thresholdsSha256, "thresholds changed after first v3 call");
  requireCondition(input.thresholdBytesSha256 === freeze.thresholdBytesSha256, "threshold bytes changed after first v3 call");
  requireCondition(hashCanonical(input.schemaHashes) === freeze.schemaHashesSha256, "schemas changed after first v3 call");
  requireCondition(hashCanonical(input.promptSourceHashes) === freeze.promptSourceHashesSha256, "prompts changed after first v3 call");
  requireCondition(hashCanonical(projectPreparedQualificationCasesV3(input.preparedCases)) === freeze.preparedCasesSha256,
    "v3 prompt/gold/case/envelope inputs changed after first live call");
}

export function buildRoleQualificationPlanV3(input: RunRoleQualificationInputV3): {
  freeze: QualificationFreezeV3;
  schedule: QualificationScheduleEntryV3[];
} {
  requireCondition(input.experimentId === IMP24_ROLE_QUALIFICATION_ID, "wrong v3 experiment identity");
  requireSha(input.thresholdBytesSha256, "threshold bytes hash");
  validateThresholds(input.thresholds);
  validateProductionSeal(input.productionInstrumentSeal);
  validateAvailability(input.candidateAvailability);
  validateCorpus(input);
  validatePreparedCases(input);
  validateCertification(input);
  const schedule = buildFrozenRoleQualificationScheduleV3(input.preparedCases);
  const freeze = buildFreeze(input, schedule);
  assertFrozenInput(input, freeze);
  return { freeze, schedule };
}

export function buildQualificationExecutionRequestV3(
  entry: QualificationScheduleEntryV3,
  prepared: PreparedQualificationCaseV3,
  candidate: QualificationProfileV3,
  freeze: QualificationFreezeV3,
  attemptNumber: 1 | 2,
  replayOfAttemptId: string | null,
): QualificationExecutionRequestV3 {
  const attemptId = `${entry.scheduleId}-a${attemptNumber}`;
  const core: QualificationExecutionRequestCoreV3 = {
    schema: IMP24_ROLE_QUALIFICATION_REQUEST_SCHEMA,
    experimentId: IMP24_ROLE_QUALIFICATION_ID,
    scheduleId: entry.scheduleId,
    attemptId,
    replayOfAttemptId,
    attemptNumber,
    role: entry.role,
    partition: entry.partition,
    caseId: entry.caseId,
    family: entry.family,
    profileId: candidate.profileId,
    model: candidate.model,
    effort: candidate.effort,
    schemaSha256: entry.schemaSha256,
    promptSourceSha256: entry.promptSourceSha256,
    goldSha256: entry.goldSha256,
    sourceCaseSha256: entry.sourceCaseSha256,
    freezeSha256: freeze.freezeSha256,
    certificationSha256: freeze.certificationSha256,
    productionInstrumentSealSha256: freeze.productionInstrumentSealSha256,
    reviewProtocol: "review-evidence-envelope-v1",
    evidenceEnvelopeSha256: prepared.envelope.envelopeSha256,
    evidenceEnvelopeBytesSha256: prepared.evidenceEnvelopeBytesSha256,
    evidenceEnvelopeBytes: prepared.evidenceEnvelopeBytes,
    task: prepared.task,
  };
  return Object.freeze({ ...core, requestSha256: qualificationRequestSha256(core) });
}

export function qualificationReceiptMismatchesV3(
  request: QualificationExecutionRequestV3,
  receipt: QualificationExecutionReceiptV3,
): string[] {
  const expected: Record<string, unknown> = {
    schema: IMP24_ROLE_QUALIFICATION_RECEIPT_SCHEMA,
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
  };
  const mismatches: string[] = [];
  for (const [key, value] of Object.entries(expected)) {
    if ((receipt as unknown as Record<string, unknown>)?.[key] !== value) mismatches.push(key);
  }
  const freshnessErrors = reviewProtocolFreshnessErrorsV2({
    reviewProtocol: request.reviewProtocol,
    lane: request.role,
    evidenceEnvelopeSha256: request.evidenceEnvelopeSha256,
    evidenceEnvelopeBytesSha256: request.evidenceEnvelopeBytesSha256,
    bindings: {
      certificationSha256: request.certificationSha256,
      evidenceEnvelopeBytesContentSha256: sha256Hex(request.evidenceEnvelopeBytes),
      freezeSha256: request.freezeSha256,
      productionInstrumentSealSha256: request.productionInstrumentSealSha256,
      schemaSha256: request.schemaSha256,
    },
  }, {
    reviewProtocol: receipt.reviewProtocol,
    lane: receipt.role,
    evidenceEnvelopeSha256: receipt.evidenceEnvelopeSha256,
    evidenceEnvelopeBytesSha256: receipt.evidenceEnvelopeBytesSha256,
    bindings: {
      certificationSha256: receipt.certificationSha256,
      evidenceEnvelopeBytesContentSha256: sha256Hex(receipt.evidenceEnvelopeBytes),
      freezeSha256: receipt.freezeSha256,
      productionInstrumentSealSha256: receipt.productionInstrumentSealSha256,
      schemaSha256: receipt.schemaSha256,
    },
  });
  if (freshnessErrors.length > 0) mismatches.push(...freshnessErrors.map((issue) => `freshness:${issue}`));
  if (typeof receipt?.executionId !== "string" || receipt.executionId.length === 0) mismatches.push("executionId");
  if (!["completed", "timeout", "provider_capacity", "transient_execution_failure", "refusal", "policy_failure", "invalid_output", "integrity_failure"].includes(receipt?.status)) mismatches.push("status");
  if (receipt?.status === "completed" && typeof receipt.rawOutput !== "string") mismatches.push("rawOutput");
  if (typeof receipt?.receiptSha256 !== "string" || !SHA256.test(receipt.receiptSha256)) mismatches.push("receiptSha256");
  else {
    const { receiptSha256, ...core } = receipt;
    if (qualificationReceiptSha256(core) !== receiptSha256) mismatches.push("receiptSha256(self)");
  }
  return mismatches;
}

export function qualificationCaseProtocolValidV3(evaluation: CaseEvaluationV3 | null): boolean {
  return evaluation !== null
    && evaluation.schemaValid
    && evaluation.envelopeBound
    && evaluation.evidenceReferenceValid
    && evaluation.authorityCompliant
    && evaluation.complete
    && !evaluation.fileAccessFailure
    && !evaluation.prohibitedConductorEcho;
}

/** Pure attempt derivation shared by the live runner and its zero-call resume
 * audit. Keeping classification and evaluator assembly on one seam prevents a
 * retained artifact from being accepted under logic that differs from the
 * logic used when the attempt was first produced. */
export function assembleQualificationAttemptV3(args: {
  scheduleOrdinal: number;
  preparedCase: PreparedQualificationCaseV3;
  request: QualificationExecutionRequestV3;
  receipt: QualificationExecutionReceiptV3 | null;
  evaluateOutput: QualificationOutputEvaluatorV3;
  thrown?: string | null;
}): QualificationAttemptV3 {
  const mismatches = args.receipt
    ? qualificationReceiptMismatchesV3(args.request, args.receipt)
    : ["missing receipt"];
  const routeValid = args.receipt !== null && mismatches.length === 0;
  const replayEligible = args.receipt !== null
    && routeValid
    && INFRASTRUCTURE_REPLAY_STATUSES.has(args.receipt.status);
  let evaluation: CaseEvaluationV3 | null = null;
  let terminalReason = "";
  if (args.receipt === null || !routeValid) {
    terminalReason = args.receipt === null
      ? `executor threw: ${args.thrown ?? "unknown"}`
      : `route receipt mismatch: ${mismatches.join(", ")}`;
  } else if (args.receipt.status === "completed") {
    try {
      evaluation = args.evaluateOutput({
        preparedCase: args.preparedCase,
        request: args.request,
        receipt: args.receipt,
        rawOutput: args.receipt.rawOutput ?? "",
      });
      evaluation = {
        ...evaluation,
        fileAccessFailure: evaluation.fileAccessFailure
          || reviewProtocolFileAccessFailureV2(args.receipt.rawOutput ?? ""),
        prohibitedConductorEcho: evaluation.prohibitedConductorEcho
          || reviewProtocolHasProhibitedConductorEchoV2(args.receipt.rawOutput ?? "", args.request.role),
      };
      terminalReason = qualificationCaseProtocolValidV3(evaluation)
        ? "completed"
        : "completed with protocol-invalid output";
    } catch (error) {
      terminalReason = `completed with invalid output: ${(error as Error).message}`;
    }
  } else {
    terminalReason = `${args.receipt.status}: ${args.receipt.failureDetail ?? ""}`.trim();
  }
  return {
    schema: IMP24_ROLE_QUALIFICATION_ATTEMPT_SCHEMA,
    scheduleOrdinal: args.scheduleOrdinal,
    request: args.request,
    receipt: args.receipt,
    routeValid,
    replayEligible,
    evaluation,
    protocolValid: routeValid
      && args.receipt?.status === "completed"
      && qualificationCaseProtocolValidV3(evaluation),
    semanticCorrect: evaluation?.semanticCorrect ?? null,
    rawOutputSha256: typeof args.receipt?.rawOutput === "string" ? sha256Hex(args.receipt.rawOutput) : null,
    retainedEnvelopeBytes: args.request.evidenceEnvelopeBytes,
    retainedEnvelopeBytesSha256: args.request.evidenceEnvelopeBytesSha256,
    terminalReason,
  };
}

type QualificationFatalLatchV3 = { tripped: boolean; error: unknown };

function tripQualificationFatalLatchV3(latch: QualificationFatalLatchV3, error: unknown): void {
  if (!latch.tripped) {
    latch.tripped = true;
    latch.error = error;
  }
}

function throwIfQualificationFatalV3(latch: QualificationFatalLatchV3): void {
  if (latch.tripped) throw latch.error;
}

/** Bounded fail-closed pool. Once any worker reports a fatal runner/retention
 * error, no worker may pull another item. Already-in-flight executor calls are
 * allowed to finish so their evidence callback can complete, and the pool
 * waits for those workers to settle before returning the original failure. */
async function mapPool<T, R>(
  items: readonly T[],
  maxParallel: number,
  fatalLatch: QualificationFatalLatchV3,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const output = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(maxParallel, items.length || 1)) }, async () => {
    while (true) {
      throwIfQualificationFatalV3(fatalLatch);
      const index = next++;
      if (index >= items.length) return;
      try {
        output[index] = await fn(items[index]);
      } catch (error) {
        tripQualificationFatalLatchV3(fatalLatch, error);
        throw error;
      }
    }
  });
  await Promise.allSettled(workers);
  throwIfQualificationFatalV3(fatalLatch);
  return output;
}

type WorkResult = {
  entry: QualificationScheduleEntryV3;
  preparedCase: PreparedQualificationCaseV3;
  finalAttempt: QualificationAttemptV3;
};

async function runScheduledCase(args: {
  input: RunRoleQualificationInputV3;
  freeze: QualificationFreezeV3;
  entry: QualificationScheduleEntryV3;
  preparedCase: PreparedQualificationCaseV3;
  candidate: QualificationProfileV3;
  deps: RunRoleQualificationDepsV3;
  attempts: QualificationAttemptV3[];
  fatalLatch: QualificationFatalLatchV3;
}): Promise<WorkResult> {
  let replayOfAttemptId: string | null = null;
  let finalAttempt: QualificationAttemptV3 | null = null;
  for (const attemptNumber of [1, 2] as const) {
    // The check is inside the per-case replay loop as well as the pool pull
    // seam: a sibling retention failure may happen while this case's first
    // call is in flight, and must prevent its replay from becoming a new call.
    throwIfQualificationFatalV3(args.fatalLatch);
    assertFrozenInput(args.input, args.freeze);
    const request = buildQualificationExecutionRequestV3(
      args.entry,
      args.preparedCase,
      args.candidate,
      args.freeze,
      attemptNumber,
      replayOfAttemptId,
    );
    let receipt: QualificationExecutionReceiptV3 | null = null;
    let thrown: string | null = null;
    try {
      receipt = await args.deps.executor(request);
    } catch (error) {
      thrown = (error as Error).message;
    }
    const attempt = assembleQualificationAttemptV3({
      scheduleOrdinal: args.entry.ordinal,
      preparedCase: args.preparedCase,
      request,
      receipt,
      evaluateOutput: args.deps.evaluateOutput,
      thrown,
    });
    if (args.deps.retainAttemptEvaluation) {
      try {
        await args.deps.retainAttemptEvaluation(attempt);
      } catch (error) {
        tripQualificationFatalLatchV3(args.fatalLatch, error);
        throw error;
      }
    }
    args.attempts.push(attempt);
    finalAttempt = attempt;
    // Policy and execution-integrity failures are conductor/trust failures,
    // not profile judgments. Their complete attempt evidence is retained
    // above, then the run-wide latch stops every replay and future pool pull.
    // Treating either status as an ordinary protocol-false canary would let a
    // mutable route/schema/session defect spend later calls and eventually be
    // hidden behind a different profile's result.
    if (receipt?.status === "policy_failure" || receipt?.status === "integrity_failure") {
      const fatal = new RoleQualificationRunnerV3Error(
        `${request.attemptId}: campaign-fatal ${receipt.status} receipt; retained evidence must be diagnosed before any further qualification call`,
      );
      tripQualificationFatalLatchV3(args.fatalLatch, fatal);
      throw fatal;
    }
    // One replay only, and only for an explicit, route-valid infrastructure
    // status. Throws, malformed output, refusals, protocol failures, and bad
    // semantic judgments terminate the case immediately.
    if (attemptNumber === 1 && attempt.replayEligible) {
      replayOfAttemptId = request.attemptId;
      continue;
    }
    break;
  }
  requireCondition(finalAttempt !== null, `${args.entry.scheduleId} produced no attempt`);
  return { entry: args.entry, preparedCase: args.preparedCase, finalAttempt };
}

type Counter = { numerator: number; denominator: number };

export function scoreQualificationHoldoutV3(
  role: Imp24ReviewRole,
  attempts: readonly QualificationAttemptV3[],
): RoleMetricLedgerV3 {
  const counters: Record<string, Counter> = {};
  const increment = (metricId: string, success: boolean): void => {
    const counter = counters[metricId] ?? { numerator: 0, denominator: 0 };
    counter.denominator += 1;
    if (success) counter.numerator += 1;
    counters[metricId] = counter;
  };
  let unresolvedRequiredCases = 0;
  for (const attempt of attempts) {
    const evaluation = attempt.evaluation;
    const valid = attempt.protocolValid;
    increment("schemaValidity", valid);
    increment("evidenceSpanValidity", valid && evaluation?.evidenceReferenceValid === true);
    increment("requiredCasesResolved", valid && evaluation?.resolved === true);
    if (!valid || evaluation?.resolved !== true) unresolvedRequiredCases += 1;
    for (const [metricId, success] of Object.entries(evaluation?.metricObservations ?? {})) {
      requireCondition(!(metricId === "schemaValidity" || metricId === "evidenceSpanValidity" || metricId === "requiredCasesResolved"),
        `${attempt.request.caseId}: evaluator may not override conductor-owned metric ${metricId}`);
      requireCondition(Object.prototype.hasOwnProperty.call(IMP24_FROZEN_ROLE_THRESHOLDS[role], metricId),
        `${attempt.request.caseId}: evaluator emitted unknown ${role} metric ${metricId}`);
      requireCondition(typeof success === "boolean", `${attempt.request.caseId}: metric ${metricId} is not boolean`);
      increment(metricId, success);
    }
  }
  // IMP-24 certification runs the deterministic no-sidecar refusal probe and
  // binds its PASS into the certification self-hash. Preserve the established
  // threshold semantics by recording that certified result exactly once for
  // every tested source profile. It is deliberately not a live case, does not
  // enter the 40-case holdout, and consumes no executor call or replay.
  if (role === "source") increment("missingEvidenceInconclusive", true);
  const metrics: RoleMetricRatesV1 = {};
  const denominators: RoleMetricDenominatorsV1 = {};
  const numerators: Record<string, number> = {};
  for (const [metricId, counter] of Object.entries(counters)) {
    metrics[metricId] = counter.denominator > 0 ? counter.numerator / counter.denominator : 0;
    denominators[metricId] = counter.denominator;
    numerators[metricId] = counter.numerator;
  }
  return {
    metrics,
    denominators,
    numerators,
    hardFalsePositives: role === "reader"
      ? (denominators.hardBlockerFalsePositiveFree ?? 0) - (numerators.hardBlockerFalsePositiveFree ?? 0)
      : 0,
    highSeverityFalsePositives: role === "source"
      ? (denominators.highSeverityFalsePositiveFree ?? 0) - (numerators.highSeverityFalsePositiveFree ?? 0)
      : 0,
    unresolvedRequiredCases,
  };
}

function notTested(role: Imp24ReviewRole): RoleQualificationOutcomeV1 {
  return {
    schema: ROLE_QUALIFICATION_OUTCOME_SCHEMA,
    role,
    status: "NOT_TESTED",
    refusedUnderpowered: false,
    underpoweredMetrics: [],
    failedThresholds: [],
  };
}

function protocolFailure(role: Imp24ReviewRole): RoleQualificationOutcomeV1 {
  return {
    schema: ROLE_QUALIFICATION_OUTCOME_SCHEMA,
    role,
    status: "NOT_QUALIFIED",
    refusedUnderpowered: false,
    underpoweredMetrics: [],
    failedThresholds: ["protocolCanary"],
  };
}

function allUniqueProfiles(): QualificationProfileV3[] {
  const seen = new Set<string>();
  const output: QualificationProfileV3[] = [];
  for (let ordinal = 0; ordinal < 4; ordinal += 1) {
    for (const role of ROLES) {
      const candidate = IMP24_ROLE_CANDIDATE_ORDER[role][ordinal];
      if (!seen.has(candidate.profileId)) {
        seen.add(candidate.profileId);
        output.push(candidate);
      }
    }
  }
  return output;
}

/** Execute the frozen v3 plan. No executor call is possible until every
 * certification, corpus, seal, availability, threshold, envelope, and schedule
 * invariant has passed model-free preflight. */
export async function runRoleQualificationV3(
  input: RunRoleQualificationInputV3,
  deps: RunRoleQualificationDepsV3,
): Promise<RoleQualificationRunnerResultV3> {
  requireCondition(typeof deps?.executor === "function", "v3 qualification requires an injected executor");
  requireCondition(typeof deps?.evaluateOutput === "function", "v3 qualification requires an injected lane-v2 evaluator");
  const { freeze, schedule } = buildRoleQualificationPlanV3(input);
  const attempts: QualificationAttemptV3[] = [];
  const profileRoleResults: ProfileRoleResultV3[] = [];
  const qualifiers: Record<Imp24ReviewRole, string[]> = { reader: [], source: [], quiz: [] };
  const fatalLatch: QualificationFatalLatchV3 = { tripped: false, error: null };

  for (const role of ROLES) {
    for (let candidateOrdinal = 0; candidateOrdinal < IMP24_ROLE_CANDIDATE_ORDER[role].length; candidateOrdinal += 1) {
      const candidate = IMP24_ROLE_CANDIDATE_ORDER[role][candidateOrdinal];
      const availability = input.candidateAvailability.entries.find((entry) => entry.role === role && entry.ordinal === candidateOrdinal)!;
      if (qualifiers[role].length >= IMP24_REQUIRED_ROLE_QUALIFIERS[role]) {
        profileRoleResults.push({
          role, candidateOrdinal, profile: candidate, availability: availability.status,
          status: "NOT_TESTED_SEQUENTIAL_STOP", canaryStarted: false, canaryCaseCount: 0,
          canaryProtocolPassed: false, canarySemanticCorrectCount: 0, holdoutStarted: false,
          holdoutCaseCount: 0, attempts: 0, metrics: null, outcome: notTested(role),
        });
        continue;
      }
      if (availability.status === "UNAVAILABLE") {
        profileRoleResults.push({
          role, candidateOrdinal, profile: candidate, availability: "UNAVAILABLE",
          status: "UNAVAILABLE", canaryStarted: false, canaryCaseCount: 0,
          canaryProtocolPassed: false, canarySemanticCorrectCount: 0, holdoutStarted: false,
          holdoutCaseCount: 0, attempts: 0, metrics: null, outcome: notTested(role),
        });
        continue;
      }

      const canaryEntries = schedule.filter((entry) => entry.role === role
        && entry.candidateOrdinal === candidateOrdinal && entry.partition === "canary");
      requireCondition(canaryEntries.length === IMP24_CANARY_CASES_PER_PROFILE_ROLE,
        `${role}/${candidate.profileId} must receive exactly two canaries`);
      const canary = await mapPool(canaryEntries, IMP24_MAX_PARALLEL, fatalLatch, async (entry) => {
        const preparedCase = input.preparedCases[role].canary[entry.caseOrdinal];
        return runScheduledCase({ input, freeze, entry, preparedCase, candidate, deps, attempts, fatalLatch });
      });
      const canaryProtocolPassed = canary.every((work) => work.finalAttempt.protocolValid);
      const canarySemanticCorrectCount = canary.filter((work) => work.finalAttempt.semanticCorrect === true).length;
      if (!canaryProtocolPassed) {
        profileRoleResults.push({
          role, candidateOrdinal, profile: candidate, availability: "AVAILABLE",
          status: "NOT_QUALIFIED_PROTOCOL", canaryStarted: true, canaryCaseCount: 2,
          canaryProtocolPassed: false, canarySemanticCorrectCount, holdoutStarted: false,
          holdoutCaseCount: 0,
          attempts: attempts.filter((attempt) => attempt.request.role === role && attempt.request.profileId === candidate.profileId).length,
          metrics: null, outcome: protocolFailure(role),
        });
        continue;
      }

      const holdoutEntries = schedule.filter((entry) => entry.role === role
        && entry.candidateOrdinal === candidateOrdinal && entry.partition === "holdout");
      requireCondition(holdoutEntries.length === IMP24_CORPUS_EXPECTED_COUNTS[role].holdout,
        `${role}/${candidate.profileId} holdout is not the complete frozen role holdout`);
      const holdout = await mapPool(holdoutEntries, IMP24_MAX_PARALLEL, fatalLatch, async (entry) => {
        const preparedCase = input.preparedCases[role].holdout[entry.caseOrdinal];
        return runScheduledCase({ input, freeze, entry, preparedCase, candidate, deps, attempts, fatalLatch });
      });
      const ledger = scoreQualificationHoldoutV3(role, holdout.map((work) => work.finalAttempt));
      const outcome = qualifyRole(role, ledger.metrics, input.thresholds, ledger.denominators);
      const status: ProfileRoleStatusV3 = outcome.status === "QUALIFIED"
        ? "QUALIFIED"
        : outcome.refusedUnderpowered
          ? "NOT_TESTED_UNDERPOWERED"
          : "NOT_QUALIFIED";
      profileRoleResults.push({
        role, candidateOrdinal, profile: candidate, availability: "AVAILABLE", status,
        canaryStarted: true, canaryCaseCount: 2, canaryProtocolPassed: true,
        canarySemanticCorrectCount, holdoutStarted: true, holdoutCaseCount: holdout.length,
        attempts: attempts.filter((attempt) => attempt.request.role === role && attempt.request.profileId === candidate.profileId).length,
        metrics: ledger, outcome,
      });
      if (status === "QUALIFIED") qualifiers[role].push(candidate.profileId);
    }
  }

  attempts.sort((left, right) => left.scheduleOrdinal - right.scheduleOrdinal
    || left.request.attemptNumber - right.request.attemptNumber);
  requireCondition(attempts.length <= IMP24_HARD_MAXIMUM_CALLS, "v3 qualification exceeded the hard call ceiling");
  const infrastructureReplays = attempts.filter((attempt) => attempt.request.attemptNumber === 2).length;
  const baseCallsAttempted = new Set(attempts.map((attempt) => attempt.request.scheduleId)).size;
  const qualifiedAt = deps.qualifiedAt?.() ?? new Date().toISOString();
  const profiles = allUniqueProfiles();
  const registry: RoleQualificationRegistryV1 = {
    schema: ROLE_QUALIFICATION_REGISTRY_SCHEMA,
    profiles: profiles.map((candidate) => {
      const outcome = (role: Imp24ReviewRole): RoleQualificationOutcomeV1 => profileRoleResults
        .find((item) => item.role === role && item.profile.profileId === candidate.profileId)?.outcome ?? notTested(role);
      return assembleJudgeQualification({
        profileId: candidate.profileId,
        model: candidate.model,
        effort: candidate.effort,
        readerOutcome: outcome("reader"),
        sourceOutcome: outcome("source"),
        quizOutcome: outcome("quiz"),
        securityBoundary: "NOT_TESTED",
        evidenceHashes: attempts
          .filter((attempt) => attempt.request.profileId === candidate.profileId)
          .flatMap((attempt) => [attempt.request.evidenceEnvelopeSha256, ...(attempt.rawOutputSha256 ? [attempt.rawOutputSha256] : [])]),
        corpusHashes: ROLES.map((role) => input.corpusBundle[role].substantiveCorpusSha256),
        instrumentHashes: [freeze.freezeSha256, freeze.certificationSha256, freeze.productionInstrumentSealSha256],
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
    schema: IMP24_ROLE_QUALIFICATION_RUNNER_SCHEMA,
    experimentId: IMP24_ROLE_QUALIFICATION_ID,
    freeze,
    schedule: Object.freeze(schedule),
    attempts: Object.freeze(attempts),
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
    baseCallsAttempted,
    infrastructureReplays,
    totalAttempts: attempts.length,
    firstLiveRequestSha256: attempts[0]?.request.requestSha256 ?? null,
  };
}
