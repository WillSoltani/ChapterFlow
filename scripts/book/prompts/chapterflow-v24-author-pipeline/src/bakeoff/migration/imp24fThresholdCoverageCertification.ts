/** Versioned IMP-24F model-free threshold-coverage certification path. */

import { hashCanonical } from "../../contracts/contractUtil.js";
import {
  IMP24_ROLE_QUALIFICATION_EXECUTION_ID,
  type Imp24CorpusBundle,
  type Imp24ReviewRole,
} from "./imp24Corpus.js";
import {
  certifyImp24SourceMissingEvidence,
  createImp24QualificationEvaluator,
} from "./imp24InstrumentCertification.js";
import {
  IMP24_ROLE_QUALIFICATION_RECEIPT_SCHEMA,
  IMP24_ROLE_QUALIFICATION_REQUEST_SCHEMA,
  qualificationReceiptSha256,
  qualificationRequestSha256,
  type PreparedQualificationCasesV3,
  type QualificationExecutionReceiptV3,
  type QualificationExecutionRequestV3,
} from "./roleQualificationRunnerV3.js";
import type { RecoveryRoleThresholdsV1 } from "./reviewLaneTypes.js";
import {
  IMP24F_SOURCE_MISSING_EVIDENCE_PROBE_ID,
  assertImp24fThresholdCoverageProof,
  buildImp24fThresholdCoverageProof,
  type Imp24fObservedCaseIdsByRole,
  type Imp24fThresholdCoverageProof,
} from "./imp24ThresholdCoverage.js";

export const IMP24F_THRESHOLD_COVERAGE_CERTIFICATION_SCHEMA =
  "imp24f-threshold-coverage-certification-v1" as const;

const ROLES = ["reader", "source", "quiz"] as const satisfies readonly Imp24ReviewRole[];
const HOLDOUT_PROTOCOL_METRICS = ["schemaValidity", "evidenceSpanValidity", "requiredCasesResolved"] as const;
const HASH_PLACEHOLDER = "a".repeat(64);

export type Imp24fThresholdCoverageCertification = {
  schema: typeof IMP24F_THRESHOLD_COVERAGE_CERTIFICATION_SCHEMA;
  status: "CERTIFIED_MODEL_FREE";
  coverageProof: Imp24fThresholdCoverageProof & { status: "PASS" };
  evaluatorProbeCaseCount: 110;
  evaluatorImplementation: "production-lane-v2-deterministic-fixture";
  sourceMissingEvidenceProbeCertified: true;
  modelCalls: 0;
  apiCalls: 0;
  certificationSha256: string;
};

function boundRequest(preparedCase: PreparedQualificationCasesV3[Imp24ReviewRole]["holdout"][number]): QualificationExecutionRequestV3 {
  const core: Omit<QualificationExecutionRequestV3, "requestSha256"> = {
    schema: IMP24_ROLE_QUALIFICATION_REQUEST_SCHEMA,
    experimentId: IMP24_ROLE_QUALIFICATION_EXECUTION_ID,
    scheduleId: `imp24f-coverage-${preparedCase.caseId}`,
    attemptId: `imp24f-coverage-${preparedCase.caseId}-a1`,
    replayOfAttemptId: null,
    attemptNumber: 1,
    role: preparedCase.role,
    partition: preparedCase.partition,
    caseId: preparedCase.caseId,
    family: preparedCase.family,
    profileId: "model-free-coverage-fixture@high",
    model: "model-free-coverage-fixture",
    effort: "high",
    schemaSha256: preparedCase.schemaSha256,
    promptSourceSha256: preparedCase.promptSourceSha256,
    goldSha256: preparedCase.goldSha256,
    sourceCaseSha256: preparedCase.sourceCaseSha256,
    freezeSha256: HASH_PLACEHOLDER,
    certificationSha256: HASH_PLACEHOLDER,
    productionInstrumentSealSha256: HASH_PLACEHOLDER,
    reviewProtocol: "review-evidence-envelope-v1",
    evidenceEnvelopeSha256: preparedCase.envelope.envelopeSha256,
    evidenceEnvelopeBytesSha256: preparedCase.evidenceEnvelopeBytesSha256,
    evidenceEnvelopeBytes: preparedCase.evidenceEnvelopeBytes,
    task: preparedCase.task,
  };
  return { ...core, requestSha256: qualificationRequestSha256(core) };
}

function boundReceipt(
  request: QualificationExecutionRequestV3,
  rawOutput: string,
): QualificationExecutionReceiptV3 {
  const core: Omit<QualificationExecutionReceiptV3, "receiptSha256"> = {
    schema: IMP24_ROLE_QUALIFICATION_RECEIPT_SCHEMA,
    executionId: `model-free-${request.attemptId}`,
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

function emptyObserved(): Imp24fObservedCaseIdsByRole {
  return { reader: {}, source: {}, quiz: {} };
}

function addObservation(
  observed: Imp24fObservedCaseIdsByRole,
  role: Imp24ReviewRole,
  metricId: string,
  caseId: string,
): void {
  observed[role][metricId] = [...(observed[role][metricId] ?? []), caseId];
}

/**
 * Run every holdout fixture through the real evaluator/assembler and retain
 * only the metric-key applicability projection. No candidate output or model
 * route is consulted.
 */
export function collectImp24fEvaluatorObservationCaseIds(args: {
  corpusBundle: Imp24CorpusBundle;
  preparedCases: PreparedQualificationCasesV3;
}): Imp24fObservedCaseIdsByRole {
  const kit = createImp24QualificationEvaluator(args.corpusBundle);
  const observed = emptyObserved();
  for (const role of ROLES) {
    for (const preparedCase of args.preparedCases[role].holdout) {
      const rawOutput = kit.fixtureOutputByCaseId[preparedCase.caseId];
      if (rawOutput === undefined) throw new Error(`${preparedCase.caseId}: deterministic fixture output is missing`);
      const request = boundRequest(preparedCase);
      const receipt = boundReceipt(request, rawOutput);
      const evaluation = kit.evaluateOutput({ preparedCase, request, receipt, rawOutput });
      if (!(evaluation.schemaValid
        && evaluation.envelopeBound
        && evaluation.evidenceReferenceValid
        && evaluation.authorityCompliant
        && evaluation.complete
        && evaluation.resolved
        && evaluation.semanticCorrect)) {
        throw new Error(`${preparedCase.caseId}: deterministic evaluator probe was not fully valid: ${evaluation.semanticSummary}`);
      }
      for (const metricId of HOLDOUT_PROTOCOL_METRICS) addObservation(observed, role, metricId, preparedCase.caseId);
      for (const metricId of Object.keys(evaluation.metricObservations)) {
        if ((HOLDOUT_PROTOCOL_METRICS as readonly string[]).includes(metricId)) {
          throw new Error(`${preparedCase.caseId}: evaluator attempted to override conductor-owned ${metricId}`);
        }
        addObservation(observed, role, metricId, preparedCase.caseId);
      }
    }
  }
  certifyImp24SourceMissingEvidence(args.corpusBundle);
  addObservation(observed, "source", "missingEvidenceInconclusive", IMP24F_SOURCE_MISSING_EVIDENCE_PROBE_ID);
  return observed;
}

export function certifyImp24fThresholdCoverage(args: {
  corpusBundle: Imp24CorpusBundle;
  preparedCases: PreparedQualificationCasesV3;
  thresholds: RecoveryRoleThresholdsV1;
}): Imp24fThresholdCoverageCertification {
  const actualObservationCaseIdsByRole = collectImp24fEvaluatorObservationCaseIds(args);
  const coverageProof = buildImp24fThresholdCoverageProof({
    corpusBundle: args.corpusBundle,
    thresholds: args.thresholds,
    actualObservationCaseIdsByRole,
  });
  assertImp24fThresholdCoverageProof(coverageProof);
  const core: Omit<Imp24fThresholdCoverageCertification, "certificationSha256"> = {
    schema: IMP24F_THRESHOLD_COVERAGE_CERTIFICATION_SCHEMA,
    status: "CERTIFIED_MODEL_FREE",
    coverageProof,
    evaluatorProbeCaseCount: 110,
    evaluatorImplementation: "production-lane-v2-deterministic-fixture",
    sourceMissingEvidenceProbeCertified: true,
    modelCalls: 0,
    apiCalls: 0,
  };
  return { ...core, certificationSha256: hashCanonical(core) };
}
