/**
 * IMP-24D retained transport-smoke evidence.
 *
 * This module is model-free. It verifies that the two fixed diagnostic calls
 * used the exact ChatGPT-only reviewer boundary and remained outside every
 * qualification result, registry, metric, and role-freeze artifact.
 */

import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import { relative, resolve, sep } from "node:path";

import { canonicalJson, hashCanonical, sha256Hex } from "../contracts/contractUtil.js";
import { writeFileAtomic } from "../lib/atomicWrite.js";
import {
  IMP24_ROLE_CANDIDATE_ORDER,
  IMP24_ROLE_QUALIFICATION_AVAILABILITY_SCHEMA,
  buildLegacyRoleQualificationPlanV3,
  buildRoleQualificationPlanV3,
  candidateAvailabilityProvenanceSha256,
  candidateAvailabilitySemanticSha256,
  candidateAvailabilitySha256,
  normalizedCandidateAvailabilityReasonCodeV3,
  qualificationReceiptMismatchesV3,
  type CandidateAvailabilityEntryV3,
  type CandidateAvailabilityV3,
  type QualificationExecutionReceiptV3,
} from "../bakeoff/migration/roleQualificationRunnerV3.js";
import {
  IMP24_ROLE_QUALIFICATION_R2_EXECUTION_ID,
  certifyImp24Corpora,
  type Imp24CorpusBundle,
} from "../bakeoff/migration/imp24Corpus.js";
import {
  IMP24_CERTIFICATION_ARTIFACT_PATHS,
  prepareImp24QualificationCases,
} from "../bakeoff/migration/imp24InstrumentCertification.js";
import {
  QUIZ_INTEGRITY_MODEL_OUTPUT_V2_SCHEMA,
  READER_EXPERIENCE_MODEL_OUTPUT_V2_SCHEMA,
  SOURCE_INTEGRITY_MODEL_OUTPUT_V2_SCHEMA,
} from "../contracts/reviewModelOutputV2.js";
import {
  IMP24D_TRANSPORT_SMOKE_EXECUTION_ID,
  IMP24D_TRANSPORT_SMOKE_R2_EXECUTION_ID,
  IMP24_LIVE_CALL_LEDGER_SCHEMA,
  IMP24_LIVE_EXECUTION_EVIDENCE_SCHEMA,
  prepareLiveRoleQualificationV3,
  validateExecutionEvidenceArtifact,
  validateLiveExecEvidenceRootV3,
  validateLiveQualificationPreflightArtifactV3,
  validateQualificationReceiptArtifactV3,
  type LiveAttemptExecutionEvidenceV3,
  type LiveAttemptRetentionV3,
  type LiveCallLedgerV3,
  type LiveQualificationExecutionRequestV3,
  type LiveQualificationPreflightV3,
  type UnpreparedLiveRoleQualificationInputV3,
} from "./forwardRoleQualificationLiveV3.js";
import {
  CODEX_PROCESS_DIAGNOSTICS_MAX_ERROR_BYTES,
  redactCodexProcessDiagnosticsText,
  validateCodexProcessDiagnosticsV1,
  type CodexProcessDiagnosticsV1,
} from "./codexProcessDiagnostics.js";
import {
  validateImp24ImplementationCiGate,
  type Imp24ImplementationCiGateV1,
} from "./forwardRoleQualificationCampaignV3.js";
import {
  IMP24_FORWARD_PRODUCTION_INSTRUMENT_SEAL_ARTIFACT_REL_PATH,
} from "./forwardProductionInstrumentSeal.js";
import {
  assertImp24DBoundedCorrectionCommit,
  collectImp24DPlannedCorrectionPaths,
  imp24EQualificationSemanticProjectionSha256,
  imp24DQualificationSemanticProjectionSha256,
  sameImp24DBoundedCorrectionProofPaths,
  type Imp24DBoundedCorrectionCommitProofV1,
  type Imp24DPlannedCorrectionPathsV1,
} from "./forwardTransportSmokeCorrectionV3.js";

export const IMP24D_TRANSPORT_SMOKE_REPORT_SCHEMA = "imp24d-transport-smoke-report-v1" as const;
export const IMP24D_TRANSPORT_SMOKE_CYCLE_SCHEMA = "imp24d-transport-smoke-cycle-v1" as const;
export const IMP24D_TRANSPORT_SMOKE_INPUT_BINDING_SCHEMA =
  "imp24d-transport-smoke-input-binding-v1" as const;
export const IMP24D_TRANSPORT_SMOKE_PREFLIGHT_FAILURE_SCHEMA =
  "imp24d-transport-smoke-preflight-failure-v1" as const;
export const IMP24D_TRANSPORT_SMOKE_EVALUATION_SCHEMA =
  "imp24d-transport-smoke-evaluation-v1" as const;
export const IMP24D_TRANSPORT_MECHANICAL_CORRECTION_SCHEMA =
  "imp24d-transport-mechanical-correction-v1" as const;
export const IMP24D_TRANSPORT_SMOKE_REPORT_JSON_REL_PATH =
  "docs/v25/reports/IMP-24D_TRANSPORT_SMOKE_RESULT.json" as const;
export const IMP24D_TRANSPORT_SMOKE_REPORT_MARKDOWN_REL_PATH =
  "docs/v25/reports/IMP-24D_TRANSPORT_SMOKE_RESULT.md" as const;
export { IMP24D_TRANSPORT_SMOKE_EXECUTION_ID, IMP24D_TRANSPORT_SMOKE_R2_EXECUTION_ID };

const PIPELINE_REL = "scripts/book/prompts/chapterflow-v24-author-pipeline";
const STATE_REL = `${PIPELINE_REL}/state/migration-experiments`;
const SHA256 = /^[a-f0-9]{64}$/;
const SOURCE_CASE_SHA256 = /^sha256:[a-f0-9]{64}$/;
const GIT_SHA = /^[a-f0-9]{40}$/;
const FIXED_ROLES = ["reader", "source"] as const;
const COMPLETE_ATTEMPT_FILES = Object.freeze([
  "evaluation.json",
  "evidence-envelope.json",
  "execution-evidence.json",
  "process-diagnostics.json",
  "receipt.json",
  "request.json",
  "retention.json",
] as const);
const FORBIDDEN_QUALIFICATION_ARTIFACTS = Object.freeze([
  "qualification-result.json",
  "role-registry.json",
  "role-assignment-freeze.json",
] as const);

export type Imp24DTransportSmokeRole = typeof FIXED_ROLES[number];
export type Imp24DTransportSmokeCycleNumber = 1 | 2;

export type Imp24DTransportSmokeInputCallBindingV1 = {
  role: Imp24DTransportSmokeRole;
  candidateOrdinal: number;
  profileId: string;
  model: string;
  effort: string;
  sourceScheduleId: string;
  sourceScheduleOrdinal: number;
  caseId: string;
  sourceCaseSha256: string;
  goldSha256: string;
  schemaSha256: string;
  promptSourceSha256: string;
  evidenceEnvelopeSha256: string;
  evidenceEnvelopeBytesSha256: string;
  taskSha256: string;
};

export type Imp24DTransportSmokeInputBindingV1 = {
  schema: typeof IMP24D_TRANSPORT_SMOKE_INPUT_BINDING_SCHEMA;
  executionId: typeof IMP24D_TRANSPORT_SMOKE_EXECUTION_ID
    | typeof IMP24D_TRANSPORT_SMOKE_R2_EXECUTION_ID;
  candidateAvailability: Omit<CandidateAvailabilityV3, "experimentId">;
  qualificationFreezeSha256: string;
  qualificationSemanticProjectionSha256: string;
  certificationSha256: string;
  productionInstrumentSealSha256: string;
  productionQualificationParitySha256: string;
  calls: [Imp24DTransportSmokeInputCallBindingV1, Imp24DTransportSmokeInputCallBindingV1];
  inputBindingSha256: string;
};

export type Imp24DTransportMechanicalDefectClassV1 =
  | "invalid_cli_argument"
  | "wrong_model_slug"
  | "unsupported_effort"
  | "schema_path_error"
  | "output_file_path_error"
  | "sandbox_or_path_error"
  | "timeout_wiring"
  | "route_sidecar_handling"
  | "authentication_or_entitlement_preflight"
  | "deterministic_transport_configuration";

export type Imp24DTransportMechanicalCorrectionV1 = {
  schema: typeof IMP24D_TRANSPORT_MECHANICAL_CORRECTION_SCHEMA;
  observabilityImplementationCommit: string;
  failedCycleSha256: string;
  failedProcessDiagnosticsSetSha256: string;
  diagnostics: Array<{
    role: Imp24DTransportSmokeRole;
    attemptId: string;
    processDiagnosticsSha256: string;
    classification: string;
    errorName: string | null;
    errorMessageSha256: string | null;
    stdoutSha256: string;
    stderrSha256: string;
  }>;
  defectClass: Imp24DTransportMechanicalDefectClassV1;
  rationale: string;
  changedFiles: string[];
  sourceFiles: string[];
  regressionTestFiles: string[];
  deterministicRemintFiles: string[];
  semanticProjectionSha256: string;
  correctionSha256: string;
};

export type Imp24DTransportSmokePreflightFailureV1 = {
  schema: typeof IMP24D_TRANSPORT_SMOKE_PREFLIGHT_FAILURE_SCHEMA;
  executionId: typeof IMP24D_TRANSPORT_SMOKE_EXECUTION_ID
    | typeof IMP24D_TRANSPORT_SMOKE_R2_EXECUTION_ID;
  freezeSha256: string;
  certificationSha256: string;
  productionInstrumentSealSha256: string;
  candidateAvailabilitySha256: string;
  classification: "policy_preflight_failure";
  errorName: string;
  errorMessageSha256: string;
  failedAt: string;
  preflightFailureSha256: string;
};

/** A transport-only projection. It intentionally excludes gold judgments,
 * semantic correctness, metric observations, and assembled review content. */
export type Imp24DTransportSmokeEvaluationV1 = {
  schema: typeof IMP24D_TRANSPORT_SMOKE_EVALUATION_SCHEMA;
  attemptId: string;
  requestSha256: string;
  receiptSha256: string;
  executionEvidenceSha256: string;
  rawOutputSha256: string | null;
  parsedJson: boolean;
  schemaValid: boolean;
  envelopeBound: boolean;
  qualificationMetricsIncluded: false;
  evaluationArtifactSha256: string;
};

export type Imp24DTransportSmokeCallV1 = {
  role: Imp24DTransportSmokeRole;
  sourceScheduleId: string;
  smokeScheduleId: string;
  attemptId: string;
  sessionId: string | null;
  profileId: string;
  model: string;
  effort: string;
  requestSha256: string;
  evidenceEnvelopeSha256: string;
  evidenceEnvelopeBytesSha256: string;
  receiptSha256: string | null;
  receiptStatus: string | null;
  processDiagnosticsRelPath: string;
  processDiagnosticsSha256: string | null;
  executionEvidenceSha256: string | null;
  evaluationArtifactSha256: string | null;
  requestedAt: string;
  completedAt: string;
  runnerBoundaryCrossed: boolean;
  chatgptAuthVerified: boolean;
  apiCalls: 0;
  processDiagnosticsComplete: boolean;
  authoritativeOutputFileProduced: boolean;
  schemaValidJson: boolean;
  envelopeAndSidecarsBound: boolean;
  qualificationMetricsIncluded: false;
  passed: boolean;
  failureClassification: string | null;
  failureDetail: string | null;
  diagnostics: {
    invocation: string | null;
    classification: string | null;
    errorName: string | null;
    errorMessage: string | null;
    timedOut: boolean | null;
    exitCode: number | null;
    stdoutBytes: number | null;
    stdoutSha256: string | null;
    stderrBytes: number | null;
    stderrSha256: string | null;
  };
};

export type Imp24DTransportSmokeCycleV1 = {
  schema: typeof IMP24D_TRANSPORT_SMOKE_CYCLE_SCHEMA;
  cycle: Imp24DTransportSmokeCycleNumber;
  executionId: typeof IMP24D_TRANSPORT_SMOKE_EXECUTION_ID
    | typeof IMP24D_TRANSPORT_SMOKE_R2_EXECUTION_ID;
  stateRoot: string;
  implementationCommit: string;
  workflowRunId: number;
  implementationCiVerifiedAt: string;
  implementationCiGateSha256: string;
  implementationCiGateBytesSha256: string;
  inputBindingSha256: string;
  inputBindingBytesSha256: string;
  candidateAvailabilitySha256: string;
  preflightSha256: string;
  qualificationFreezeSha256: string;
  qualificationSemanticProjectionSha256: string;
  certificationSha256: string;
  productionInstrumentSealSha256: string;
  productionQualificationParitySha256: string;
  mechanicalCorrectionSha256: string | null;
  correctionCommitReportBytesSha256: string | null;
  callLedgerSha256: string;
  callLedgerBytesSha256: string;
  calls: [Imp24DTransportSmokeCallV1, Imp24DTransportSmokeCallV1];
  brokerRequests: 2;
  codexExecInvocations: number;
  apiCalls: 0;
  qualificationMetricsIncluded: false;
  qualificationArtifactsCreated: false;
  status: "PASS" | "FAIL";
  startedAt: string;
  completedAt: string;
  processDiagnosticsSetSha256: string;
  cycleSha256: string;
};

export type Imp24DTransportSmokeReportV1 = {
  schema: typeof IMP24D_TRANSPORT_SMOKE_REPORT_SCHEMA;
  status: "PASS" | "FAIL";
  observabilityImplementationCommit: string;
  correctionCommit: string | null;
  effectiveImplementationCommit: string;
  cycles: Imp24DTransportSmokeCycleV1[];
  mechanicalCorrection: Imp24DTransportMechanicalCorrectionV1 | null;
  finalCycle: Imp24DTransportSmokeCycleNumber;
  totalCalls: 2 | 4;
  modelCalls: number;
  apiCalls: 0;
  qualificationMetricsIncluded: false;
  qualificationArtifactsCreated: false;
  reportSha256: string;
};

export type VerifiedImp24DTransportSmokeV1 = {
  report: Imp24DTransportSmokeReportV1;
  reportBytesSha256: string;
  reportMarkdownBytesSha256: string;
  status: "PASS";
  observabilityImplementationCommit: string;
  correctionCommit: string | null;
  effectiveImplementationCommit: string;
  cycles: Array<{
    executionId: Imp24DTransportSmokeCycleV1["executionId"];
    stateRoot: string;
    implementationCommit: string;
    implementationCiGateSha256: string;
    implementationCiGateBytesSha256: string;
    calls: 2;
    processDiagnosticsSetSha256: string;
    qualificationSemanticProjectionSha256: string;
    certificationSha256: string;
    productionInstrumentSealSha256: string;
    productionQualificationParitySha256: string;
    codexExecInvocations: number;
    startedAt: string;
    completedAt: string;
  }>;
  totalCalls: 2 | 4;
  modelCalls: 2 | 3 | 4;
  apiCalls: 0;
  finalImplementationCiGatePath: string;
};

export class Imp24DTransportSmokeEvidenceError extends Error {
  readonly classification = "transport_smoke_evidence_invalid" as const;

  constructor(message: string) {
    super(message);
    this.name = "Imp24DTransportSmokeEvidenceError";
  }
}

function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Imp24DTransportSmokeEvidenceError(message);
}

function parseJson<T>(path: string, label: string): T {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch (error) {
    throw new Imp24DTransportSmokeEvidenceError(
      `${label} is not valid retained JSON: ${(error as Error).message}`,
    );
  }
}

function readCommittedBytes(
  repositoryRoot: string,
  implementationCommit: string,
  relativePath: string,
  label: string,
): Buffer {
  try {
    return execFileSync("git", ["show", `${implementationCommit}:${relativePath}`], {
      cwd: resolve(repositoryRoot),
      encoding: "buffer",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (error) {
    throw new Imp24DTransportSmokeEvidenceError(
      `${label} is not a committed blob at ${implementationCommit}: ${(error as Error).message}`,
    );
  }
}

function parseCommittedJson<T>(
  repositoryRoot: string,
  implementationCommit: string,
  relativePath: string,
  label: string,
): { value: T; bytes: Buffer } {
  const bytes = readCommittedBytes(repositoryRoot, implementationCommit, relativePath, label);
  try {
    return { value: JSON.parse(bytes.toString("utf8")) as T, bytes };
  } catch (error) {
    throw new Imp24DTransportSmokeEvidenceError(
      `${label} at ${implementationCommit} is not JSON: ${(error as Error).message}`,
    );
  }
}

function relativeFromRepository(repositoryRoot: string, path: string): string {
  return relative(resolve(repositoryRoot), resolve(path)).split(sep).join("/");
}

export function sanitizeImp24DTransportSmokePreflightErrorText(value: unknown): string {
  const redacted = redactCodexProcessDiagnosticsText(String(value));
  let retained = "";
  let bytes = 0;
  for (const character of redacted) {
    const characterBytes = Buffer.byteLength(character);
    if (bytes + characterBytes > CODEX_PROCESS_DIAGNOSTICS_MAX_ERROR_BYTES) break;
    retained += character;
    bytes += characterBytes;
  }
  return retained || "transport smoke preflight failed";
}

export function imp24DTransportSmokeStateRootRelPath(
  executionId: Imp24DTransportSmokeCycleV1["executionId"],
): string {
  return `${STATE_REL}/${executionId}`;
}

export function imp24DTransportSmokeCycleResultRelPath(
  executionId: Imp24DTransportSmokeCycleV1["executionId"],
): string {
  return `${imp24DTransportSmokeStateRootRelPath(executionId)}/cycle-result.json`;
}

export function validateImp24DTransportSmokeInputBinding(
  binding: Imp24DTransportSmokeInputBindingV1,
): CandidateAvailabilityV3 {
  requireCondition(binding.schema === IMP24D_TRANSPORT_SMOKE_INPUT_BINDING_SCHEMA
      && (binding.executionId === IMP24D_TRANSPORT_SMOKE_EXECUTION_ID
        || binding.executionId === IMP24D_TRANSPORT_SMOKE_R2_EXECUTION_ID)
      && SHA256.test(binding.qualificationFreezeSha256)
      && SHA256.test(binding.qualificationSemanticProjectionSha256)
      && SHA256.test(binding.certificationSha256)
      && SHA256.test(binding.productionInstrumentSealSha256)
      && SHA256.test(binding.productionQualificationParitySha256)
      && binding.calls.length === 2
      && binding.calls[0].role === "reader"
      && binding.calls[1].role === "source",
  "IMP-24D transport-smoke input binding identity/shape drift");
  const availability = {
    ...binding.candidateAvailability,
    experimentId: IMP24_ROLE_QUALIFICATION_R2_EXECUTION_ID,
  } as unknown as CandidateAvailabilityV3;
  const hasImp24eAvailability = typeof availability.semanticSha256 === "string"
    || typeof availability.provenanceSha256 === "string";
  const expectedLegacyFullSha256 = hasImp24eAvailability
    ? (() => {
      const { availabilitySha256: _self, ...draft } = availability;
      return candidateAvailabilitySha256(draft);
    })()
    : candidateAvailabilitySha256({
      schema: availability.schema,
      experimentId: availability.experimentId,
      source: availability.source,
      sourceBytesSha256: availability.sourceBytesSha256,
      sourceFetchedAt: availability.sourceFetchedAt,
      policyBytesSha256: availability.policyBytesSha256,
      candidateOrderSha256: availability.candidateOrderSha256,
      entries: availability.entries,
    });
  requireCondition(availability.schema === IMP24_ROLE_QUALIFICATION_AVAILABILITY_SCHEMA
      && availability.candidateOrderSha256 === hashCanonical(IMP24_ROLE_CANDIDATE_ORDER)
      && availability.availabilitySha256 === expectedLegacyFullSha256,
  "IMP-24D transport-smoke candidate availability binding drift");
  if (hasImp24eAvailability) {
    requireCondition(typeof availability.semanticSha256 === "string"
        && availability.semanticSha256 === candidateAvailabilitySemanticSha256(availability)
        && typeof availability.provenanceSha256 === "string"
        && availability.provenanceSha256 === candidateAvailabilityProvenanceSha256(availability),
    "IMP-24E transport-smoke candidate availability semantic/provenance binding drift");
  }
  const expectedEntries = (["reader", "source", "quiz"] as const).flatMap((role) =>
    IMP24_ROLE_CANDIDATE_ORDER[role].map((profile, ordinal) => ({ role, ordinal, ...profile })));
  requireCondition(availability.entries.length === expectedEntries.length,
    "IMP-24D transport-smoke availability entry count drift");
  for (const [index, expected] of expectedEntries.entries()) {
    const actual = availability.entries[index] as CandidateAvailabilityEntryV3 | undefined;
    requireCondition(actual !== undefined
        && actual.role === expected.role
        && actual.ordinal === expected.ordinal
        && actual.profileId === expected.profileId
        && actual.model === expected.model
        && actual.effort === expected.effort
        && (actual.status === "AVAILABLE" || actual.status === "UNAVAILABLE")
        && (!hasImp24eAvailability
          || actual.status === (actual.modelListed && actual.visible && actual.effortSupported
            ? "AVAILABLE" : "UNAVAILABLE")
            && actual.reasonCode === normalizedCandidateAvailabilityReasonCodeV3(actual)),
    `IMP-24D transport-smoke availability order/profile drift at entry ${index}`);
  }
  for (const call of binding.calls) {
    const firstAvailable = availability.entries.find((entry) =>
      entry.role === call.role && entry.status === "AVAILABLE");
    requireCondition(firstAvailable !== undefined,
      `IMP-24D transport-smoke ${call.role} has no first AVAILABLE profile`);
    requireCondition(call.candidateOrdinal === firstAvailable.ordinal
        && call.profileId === firstAvailable.profileId
        && call.model === firstAvailable.model
        && call.effort === firstAvailable.effort,
    `IMP-24D transport-smoke ${call.role} profile is not the frozen first AVAILABLE profile`);
    requireCondition(call.sourceScheduleId
        === `v3-${call.role}-p${call.candidateOrdinal + 1}-canary-c01`
        && Number.isSafeInteger(call.sourceScheduleOrdinal) && call.sourceScheduleOrdinal >= 0,
    `IMP-24D transport-smoke ${call.role} request is not the frozen first canary`);
    const invalidHashes = Object.entries({
      goldSha256: call.goldSha256,
      schemaSha256: call.schemaSha256,
      promptSourceSha256: call.promptSourceSha256,
      evidenceEnvelopeSha256: call.evidenceEnvelopeSha256,
      evidenceEnvelopeBytesSha256: call.evidenceEnvelopeBytesSha256,
      taskSha256: call.taskSha256,
    }).filter(([, value]) => !SHA256.test(value)).map(([name]) => name);
    if (!SOURCE_CASE_SHA256.test(call.sourceCaseSha256)) invalidHashes.unshift("sourceCaseSha256");
    requireCondition(invalidHashes.length === 0,
      `IMP-24D transport-smoke ${call.role} first-canary hashes are incomplete: ${invalidHashes.join(", ")}`);
  }
  const { inputBindingSha256, ...core } = binding;
  requireCondition(SHA256.test(inputBindingSha256) && inputBindingSha256 === hashCanonical(core),
    "IMP-24D transport-smoke input-binding self hash drift");
  return availability;
}

function retainedCandidateAvailabilityIdentityV3(
  availability: Imp24DTransportSmokeInputBindingV1["candidateAvailability"],
): string {
  return availability.semanticSha256 ?? availability.availabilitySha256;
}

function deriveCertifiedSmokeInputBinding(args: {
  repositoryRoot: string;
  implementationCommit: string;
  retained: Imp24DTransportSmokeInputBindingV1;
}): Imp24DTransportSmokeInputBindingV1 {
  const repositoryRoot = resolve(args.repositoryRoot);
  const availability = validateImp24DTransportSmokeInputBinding(args.retained);
  const hasImp24eAvailability = typeof availability.semanticSha256 === "string"
    && typeof availability.provenanceSha256 === "string";
  requireCondition(GIT_SHA.test(args.implementationCommit),
    "IMP-24D committed smoke input verification requires an exact implementation commit");
  const corpusBundle = parseCommittedJson<Imp24CorpusBundle>(repositoryRoot,
    args.implementationCommit, IMP24_CERTIFICATION_ARTIFACT_PATHS.corpusBundle,
    "IMP-24 certified corpus bundle").value;
  const certification = parseCommittedJson<UnpreparedLiveRoleQualificationInputV3["certification"]>(repositoryRoot,
    args.implementationCommit, IMP24_CERTIFICATION_ARTIFACT_PATHS.certificationBinding,
    "IMP-24 instrument certification").value;
  const productionInstrumentSeal = parseCommittedJson<UnpreparedLiveRoleQualificationInputV3["productionInstrumentSeal"]>(repositoryRoot,
    args.implementationCommit, IMP24_FORWARD_PRODUCTION_INSTRUMENT_SEAL_ARTIFACT_REL_PATH,
    "IMP-24 production instrument seal").value;
  const retainedThresholds = parseCommittedJson<UnpreparedLiveRoleQualificationInputV3["thresholds"]>(repositoryRoot,
    args.implementationCommit, IMP24_CERTIFICATION_ARTIFACT_PATHS.thresholds,
    "IMP-24 frozen thresholds");
  const thresholds = retainedThresholds.value;
  const unprepared = {
    experimentId: IMP24_ROLE_QUALIFICATION_R2_EXECUTION_ID,
    corpusBundle,
    corpusCertification: certifyImp24Corpora(corpusBundle),
    certification,
    productionInstrumentSeal,
    candidateAvailability: availability,
    thresholds,
    thresholdBytesSha256: sha256Hex(retainedThresholds.bytes),
  } as unknown as UnpreparedLiveRoleQualificationInputV3;
  const prepared = hasImp24eAvailability
    ? prepareLiveRoleQualificationV3({ repositoryRoot, input: unprepared })
    : (() => {
      // Archived IMP-24D binds the implementation commit's schema/prompt
      // bytes, not whatever compatible schemas happen to be in the current
      // checkout. Compile the unchanged envelopes/tasks with current pure
      // functions, then restore those exact committed byte identities before
      // invoking the explicit legacy planner.
      const instrument = prepareImp24QualificationCases({ repositoryRoot, corpusBundle });
      const schemaRel = {
        reader: "scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments/contracts/schemas/reader-experience-model-output-v2.schema.json",
        source: "scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments/contracts/schemas/source-integrity-model-output-v2.schema.json",
        quiz: "scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments/contracts/schemas/quiz-integrity-model-output-v2.schema.json",
      } as const;
      const schemaHashes = {
        reader: sha256Hex(readCommittedBytes(repositoryRoot, args.implementationCommit,
          schemaRel.reader, "IMP-24D reader output schema")),
        source: sha256Hex(readCommittedBytes(repositoryRoot, args.implementationCommit,
          schemaRel.source, "IMP-24D source output schema")),
        quiz: sha256Hex(readCommittedBytes(repositoryRoot, args.implementationCommit,
          schemaRel.quiz, "IMP-24D quiz output schema")),
      };
      const promptModuleSha256 = sha256Hex(readCommittedBytes(repositoryRoot,
        args.implementationCommit,
        "scripts/book/prompts/chapterflow-v24-author-pipeline/src/review/reviewModelOutputV2.ts",
        "IMP-24D reviewer task module"));
      const promptSourceHashes = {
        reader: hashCanonical({
          moduleSha256: promptModuleSha256,
          builder: "buildReaderExperienceInlineReviewTask",
          schema: READER_EXPERIENCE_MODEL_OUTPUT_V2_SCHEMA,
        }),
        source: hashCanonical({
          moduleSha256: promptModuleSha256,
          builder: "buildSourceIntegrityInlineReviewTask",
          schema: SOURCE_INTEGRITY_MODEL_OUTPUT_V2_SCHEMA,
        }),
        quiz: hashCanonical({
          moduleSha256: promptModuleSha256,
          builder: "buildQuizIntegrityInlineReviewTask",
          schema: QUIZ_INTEGRITY_MODEL_OUTPUT_V2_SCHEMA,
        }),
      };
      for (const role of ["reader", "source", "quiz"] as const) {
        for (const partition of ["canary", "holdout"] as const) {
          for (const preparedCase of instrument.preparedCases[role][partition]) {
            preparedCase.schemaSha256 = schemaHashes[role];
            preparedCase.promptSourceSha256 = promptSourceHashes[role];
          }
        }
      }
      return {
        input: {
          ...unprepared,
          schemaHashes,
          promptSourceHashes,
          preparedCases: instrument.preparedCases,
        },
      };
    })();
  const plan = hasImp24eAvailability
    ? buildRoleQualificationPlanV3(prepared.input)
    : buildLegacyRoleQualificationPlanV3(prepared.input);
  const calls = (["reader", "source"] as const).map((role) => {
    const firstAvailable = availability.entries.find((entry) =>
      entry.role === role && entry.status === "AVAILABLE");
    requireCondition(firstAvailable !== undefined,
      `IMP-24D retained smoke binding has no AVAILABLE ${role} profile`);
    const entry = plan.schedule.find((candidate) => candidate.role === role
      && candidate.candidateOrdinal === firstAvailable.ordinal
      && candidate.partition === "canary"
      && candidate.caseOrdinal === 0);
    const preparedCase = prepared.input.preparedCases[role].canary[0];
    requireCondition(entry !== undefined && preparedCase !== undefined,
      `IMP-24D could not rederive the certified first ${role} canary`);
    return {
      role,
      candidateOrdinal: firstAvailable.ordinal,
      profileId: firstAvailable.profileId,
      model: firstAvailable.model,
      effort: firstAvailable.effort,
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
  }) as Imp24DTransportSmokeInputBindingV1["calls"];
  const core: Omit<Imp24DTransportSmokeInputBindingV1, "inputBindingSha256"> = {
    schema: IMP24D_TRANSPORT_SMOKE_INPUT_BINDING_SCHEMA,
    executionId: args.retained.executionId,
    candidateAvailability: args.retained.candidateAvailability,
    qualificationFreezeSha256: plan.freeze.freezeSha256,
    qualificationSemanticProjectionSha256: hasImp24eAvailability
      ? imp24EQualificationSemanticProjectionSha256({
        freeze: plan.freeze as ReturnType<typeof buildRoleQualificationPlanV3>["freeze"],
        candidateAvailability: availability,
        calls,
      })
      : imp24DQualificationSemanticProjectionSha256({
        freeze: plan.freeze,
        candidateAvailability: availability,
        calls,
      }),
    certificationSha256: plan.freeze.certificationSha256,
    productionInstrumentSealSha256: plan.freeze.productionInstrumentSealSha256,
    productionQualificationParitySha256: plan.freeze.productionQualificationParitySha256,
    calls,
  };
  return { ...core, inputBindingSha256: hashCanonical(core) };
}

export function verifyImp24DTransportSmokeInputBindingAgainstCertifiedPlan(args: {
  repositoryRoot: string;
  implementationCommit: string;
  retained: Imp24DTransportSmokeInputBindingV1;
}): Imp24DTransportSmokeInputBindingV1 {
  const certified = deriveCertifiedSmokeInputBinding(args);
  assertImp24DTransportSmokeInputBindingMatchesCertifiedPlan(args.retained, certified);
  return certified;
}

export function assertImp24DTransportSmokeInputBindingMatchesCertifiedPlan(
  retained: Imp24DTransportSmokeInputBindingV1,
  certified: Imp24DTransportSmokeInputBindingV1,
): void {
  requireCondition(hashCanonical(certified) === hashCanonical(retained),
    "IMP-24D transport-smoke input is not the exact certified first-reader/first-source canary binding");
}

function emptyDiagnostics(): Imp24DTransportSmokeCallV1["diagnostics"] {
  return {
    invocation: null,
    classification: null,
    errorName: null,
    errorMessage: null,
    timedOut: null,
    exitCode: null,
    stdoutBytes: null,
    stdoutSha256: null,
    stderrBytes: null,
    stderrSha256: null,
  };
}

export function buildImp24DTransportSmokePreflightFailure(args: {
  executionId: Imp24DTransportSmokePreflightFailureV1["executionId"];
  freezeSha256: string;
  certificationSha256: string;
  productionInstrumentSealSha256: string;
  candidateAvailabilitySha256: string;
  error: unknown;
  failedAt: string;
}): Imp24DTransportSmokePreflightFailureV1 {
  const error = args.error as { name?: unknown; message?: unknown };
  const core: Omit<Imp24DTransportSmokePreflightFailureV1, "preflightFailureSha256"> = {
    schema: IMP24D_TRANSPORT_SMOKE_PREFLIGHT_FAILURE_SCHEMA,
    executionId: args.executionId,
    freezeSha256: args.freezeSha256,
    certificationSha256: args.certificationSha256,
    productionInstrumentSealSha256: args.productionInstrumentSealSha256,
    candidateAvailabilitySha256: args.candidateAvailabilitySha256,
    classification: "policy_preflight_failure",
    errorName: sanitizeImp24DTransportSmokePreflightErrorText(
      typeof error?.name === "string" && error.name.length > 0 ? error.name : "Error",
    ),
    // Retain the bounded/redacted message only in each process-diagnostics
    // artifact. This control record binds the raw message without duplicating it.
    errorMessageSha256: sha256Hex(typeof error?.message === "string" ? error.message : String(args.error)),
    failedAt: new Date(args.failedAt).toISOString(),
  };
  return { ...core, preflightFailureSha256: hashCanonical(core) };
}

export function validateImp24DTransportSmokePreflightFailure(
  failure: Imp24DTransportSmokePreflightFailureV1,
  expectedExecutionId: Imp24DTransportSmokePreflightFailureV1["executionId"],
): void {
  const { preflightFailureSha256, ...core } = failure;
  requireCondition(failure.schema === IMP24D_TRANSPORT_SMOKE_PREFLIGHT_FAILURE_SCHEMA
      && failure.executionId === expectedExecutionId
      && SHA256.test(failure.freezeSha256)
      && SHA256.test(failure.certificationSha256)
      && SHA256.test(failure.productionInstrumentSealSha256)
      && SHA256.test(failure.candidateAvailabilitySha256)
      && failure.classification === "policy_preflight_failure"
      && typeof failure.errorName === "string" && failure.errorName.length > 0
      && SHA256.test(failure.errorMessageSha256)
      && Number.isFinite(Date.parse(failure.failedAt))
      && SHA256.test(preflightFailureSha256)
      && preflightFailureSha256 === hashCanonical(core),
  "IMP-24D transport-smoke preflight-failure artifact drift");
}

const MECHANICAL_DEFECT_CLASSES = new Set<Imp24DTransportMechanicalDefectClassV1>([
  "invalid_cli_argument",
  "wrong_model_slug",
  "unsupported_effort",
  "schema_path_error",
  "output_file_path_error",
  "sandbox_or_path_error",
  "timeout_wiring",
  "route_sidecar_handling",
  "authentication_or_entitlement_preflight",
  "deterministic_transport_configuration",
]);

function sortedUnique(values: readonly string[]): boolean {
  return canonicalJson(values) === canonicalJson([...new Set(values)].sort());
}

export function validateImp24DTransportMechanicalCorrection(
  record: Imp24DTransportMechanicalCorrectionV1,
): void {
  const { correctionSha256, ...core } = record;
  requireCondition(record.schema === IMP24D_TRANSPORT_MECHANICAL_CORRECTION_SCHEMA
      && GIT_SHA.test(record.observabilityImplementationCommit)
      && SHA256.test(record.failedCycleSha256)
      && SHA256.test(record.failedProcessDiagnosticsSetSha256)
      && record.diagnostics.length === 2
      && record.diagnostics[0].role === "reader"
      && record.diagnostics[1].role === "source"
      && record.diagnostics.every((item) => typeof item.attemptId === "string" && item.attemptId.length > 0
        && SHA256.test(item.processDiagnosticsSha256)
        && typeof item.classification === "string" && item.classification.length > 0
        && (item.errorName === null || (typeof item.errorName === "string" && item.errorName.length > 0))
        && (item.errorMessageSha256 === null || SHA256.test(item.errorMessageSha256))
        && SHA256.test(item.stdoutSha256) && SHA256.test(item.stderrSha256))
      && MECHANICAL_DEFECT_CLASSES.has(record.defectClass)
      && typeof record.rationale === "string" && record.rationale.trim().length > 0
      && Buffer.byteLength(record.rationale) <= CODEX_PROCESS_DIAGNOSTICS_MAX_ERROR_BYTES
      && record.rationale === sanitizeImp24DTransportSmokePreflightErrorText(record.rationale)
      && sortedUnique(record.changedFiles)
      && sortedUnique(record.sourceFiles) && record.sourceFiles.length > 0
      && sortedUnique(record.regressionTestFiles) && record.regressionTestFiles.length > 0
      && sortedUnique(record.deterministicRemintFiles)
      && SHA256.test(record.semanticProjectionSha256)
      && SHA256.test(correctionSha256)
      && correctionSha256 === hashCanonical(core),
  "IMP-24D mechanical-correction diagnosis record drift");
}

export function buildImp24DTransportMechanicalCorrection(args: {
  cycle: Imp24DTransportSmokeCycleV1;
  defectClass: Imp24DTransportMechanicalDefectClassV1;
  rationale: string;
  paths: Imp24DPlannedCorrectionPathsV1;
}): Imp24DTransportMechanicalCorrectionV1 {
  validateImp24DTransportSmokeCycle(args.cycle);
  requireCondition(args.cycle.cycle === 1 && args.cycle.status === "FAIL",
    "IMP-24D mechanical correction requires the terminal failed first smoke cycle");
  const rationale = sanitizeImp24DTransportSmokePreflightErrorText(args.rationale).trim();
  requireCondition(rationale.length > 0, "IMP-24D mechanical correction requires a bounded rationale");
  const core: Omit<Imp24DTransportMechanicalCorrectionV1, "correctionSha256"> = {
    schema: IMP24D_TRANSPORT_MECHANICAL_CORRECTION_SCHEMA,
    observabilityImplementationCommit: args.cycle.implementationCommit,
    failedCycleSha256: args.cycle.cycleSha256,
    failedProcessDiagnosticsSetSha256: args.cycle.processDiagnosticsSetSha256,
    diagnostics: args.cycle.calls.map((call) => ({
      role: call.role,
      attemptId: call.attemptId,
      processDiagnosticsSha256: call.processDiagnosticsSha256!,
      classification: call.diagnostics.classification!,
      errorName: call.diagnostics.errorName,
      errorMessageSha256: call.diagnostics.errorMessage === null
        ? null : sha256Hex(call.diagnostics.errorMessage),
      stdoutSha256: call.diagnostics.stdoutSha256!,
      stderrSha256: call.diagnostics.stderrSha256!,
    })),
    defectClass: args.defectClass,
    rationale,
    changedFiles: args.paths.changedFiles,
    sourceFiles: args.paths.sourceFiles,
    regressionTestFiles: args.paths.regressionTestFiles,
    deterministicRemintFiles: args.paths.deterministicRemintFiles,
    semanticProjectionSha256: args.cycle.qualificationSemanticProjectionSha256,
  };
  const record = { ...core, correctionSha256: hashCanonical(core) };
  validateImp24DTransportMechanicalCorrection(record);
  return record;
}

export function buildImp24DTransportSmokeEvaluation(args: {
  request: LiveQualificationExecutionRequestV3;
  receipt: QualificationExecutionReceiptV3;
  executionEvidenceSha256: string;
  parsedJson: boolean;
  schemaValid: boolean;
}): Imp24DTransportSmokeEvaluationV1 {
  requireCondition(SHA256.test(args.executionEvidenceSha256),
    "IMP-24D transport-smoke evaluation requires an execution-evidence hash");
  const rawOutputSha256 = typeof args.receipt.rawOutput === "string"
    ? sha256Hex(args.receipt.rawOutput)
    : null;
  const envelopeBound = qualificationReceiptMismatchesV3(
    args.request as Parameters<typeof qualificationReceiptMismatchesV3>[0],
    args.receipt,
  ).length === 0
    && sha256Hex(args.request.evidenceEnvelopeBytes) === args.request.evidenceEnvelopeBytesSha256;
  const core: Omit<Imp24DTransportSmokeEvaluationV1, "evaluationArtifactSha256"> = {
    schema: IMP24D_TRANSPORT_SMOKE_EVALUATION_SCHEMA,
    attemptId: args.request.attemptId,
    requestSha256: args.request.requestSha256,
    receiptSha256: args.receipt.receiptSha256,
    executionEvidenceSha256: args.executionEvidenceSha256,
    rawOutputSha256,
    parsedJson: args.parsedJson,
    schemaValid: args.schemaValid,
    envelopeBound,
    qualificationMetricsIncluded: false,
  };
  const artifact = { ...core, evaluationArtifactSha256: hashCanonical(core) };
  validateImp24DTransportSmokeEvaluation(artifact, {
    request: args.request,
    receipt: args.receipt,
    executionEvidenceSha256: args.executionEvidenceSha256,
  });
  return artifact;
}

export function validateImp24DTransportSmokeEvaluation(
  artifact: Imp24DTransportSmokeEvaluationV1,
  expected?: {
    request: LiveQualificationExecutionRequestV3;
    receipt: QualificationExecutionReceiptV3;
    executionEvidenceSha256: string;
  },
): void {
  const exactKeys = [
    "schema", "attemptId", "requestSha256", "receiptSha256", "executionEvidenceSha256",
    "rawOutputSha256", "parsedJson", "schemaValid", "envelopeBound",
    "qualificationMetricsIncluded", "evaluationArtifactSha256",
  ].sort();
  requireCondition(artifact !== null && typeof artifact === "object" && !Array.isArray(artifact)
      && hashCanonical(Object.keys(artifact).sort()) === hashCanonical(exactKeys),
  "IMP-24D transport-smoke evaluation must be the exact metric-free projection");
  const { evaluationArtifactSha256, ...core } = artifact;
  requireCondition(artifact.schema === IMP24D_TRANSPORT_SMOKE_EVALUATION_SCHEMA
      && typeof artifact.attemptId === "string" && artifact.attemptId.length > 0
      && SHA256.test(artifact.requestSha256)
      && SHA256.test(artifact.receiptSha256)
      && SHA256.test(artifact.executionEvidenceSha256)
      && (artifact.rawOutputSha256 === null || SHA256.test(artifact.rawOutputSha256))
      && typeof artifact.parsedJson === "boolean"
      && typeof artifact.schemaValid === "boolean"
      && (!artifact.schemaValid || artifact.parsedJson)
      && typeof artifact.envelopeBound === "boolean"
      && artifact.qualificationMetricsIncluded === false
      && SHA256.test(evaluationArtifactSha256)
      && evaluationArtifactSha256 === hashCanonical(core),
  "IMP-24D transport-smoke evaluation shape/self hash drift");
  if (expected !== undefined) {
    const expectedRawOutputSha256 = typeof expected.receipt.rawOutput === "string"
      ? sha256Hex(expected.receipt.rawOutput)
      : null;
    const expectedEnvelopeBound = qualificationReceiptMismatchesV3(
      expected.request as Parameters<typeof qualificationReceiptMismatchesV3>[0],
      expected.receipt,
    ).length === 0
      && sha256Hex(expected.request.evidenceEnvelopeBytes)
        === expected.request.evidenceEnvelopeBytesSha256;
    requireCondition(artifact.attemptId === expected.request.attemptId
        && artifact.requestSha256 === expected.request.requestSha256
        && artifact.receiptSha256 === expected.receipt.receiptSha256
        && artifact.executionEvidenceSha256 === expected.executionEvidenceSha256
        && artifact.rawOutputSha256 === expectedRawOutputSha256
        && artifact.envelopeBound === expectedEnvelopeBound,
    "IMP-24D transport-smoke evaluation binding drift");
  }
}

/** Inspect one already-retained smoke attempt. Validation errors are returned
 * as a FAIL summary so diagnostics remain reportable; no evidence is repaired. */
export function inspectRetainedImp24DTransportSmokeCall(args: {
  repositoryRoot: string;
  phaseDir: string;
  executionId: Imp24DTransportSmokeCycleV1["executionId"];
  expected: Imp24DTransportSmokeInputBindingV1["calls"][number];
  smokeScheduleId: string;
  attemptId: string;
}): Imp24DTransportSmokeCallV1 {
  const attemptDir = resolve(args.phaseDir, "attempts", args.attemptId);
  const processDiagnosticsPath = resolve(attemptDir, "process-diagnostics.json");
  const errors: string[] = [];
  let request: LiveQualificationExecutionRequestV3 | null = null;
  let receipt: QualificationExecutionReceiptV3 | null = null;
  let diagnostics: CodexProcessDiagnosticsV1 | null = null;
  let execution: LiveAttemptExecutionEvidenceV3 | null = null;
  let retention: LiveAttemptRetentionV3 | null = null;
  let evaluation: Imp24DTransportSmokeEvaluationV1 | null = null;
  let ledger: LiveCallLedgerV3 | null = null;
  let preflight: LiveQualificationPreflightV3 | null = null;
  let preflightFailure: Imp24DTransportSmokePreflightFailureV1 | null = null;
  let requestedAt = "";
  let completedAt = "";
  let processDiagnosticsComplete = false;
  let preflightValidated = false;
  let executionEvidenceValidated = false;

  const capture = (work: () => void): void => {
    try { work(); } catch (error) { errors.push((error as Error).message); }
  };
  const load = <T>(path: string, label: string): T | null => {
    try { return parseJson<T>(path, label); } catch (error) {
      errors.push((error as Error).message);
      return null;
    }
  };

  capture(() => {
    requireCondition(existsSync(attemptDir), `${args.attemptId}: retained attempt directory is missing`);
    const names = readdirSync(attemptDir).sort();
    requireCondition(hashCanonical(names) === hashCanonical(COMPLETE_ATTEMPT_FILES),
      `${args.attemptId}: exact seven-file smoke attempt evidence is required`);
    requireCondition(names.every((name) => {
      const stat = lstatSync(resolve(attemptDir, name));
      return stat.isFile() && !stat.isSymbolicLink();
    }), `${args.attemptId}: smoke attempt evidence must contain only regular non-symlink files`);
  });
  request = load(resolve(attemptDir, "request.json"), `${args.attemptId} request`);
  receipt = load(resolve(attemptDir, "receipt.json"), `${args.attemptId} receipt`);
  diagnostics = load(processDiagnosticsPath, `${args.attemptId} process diagnostics`);
  execution = load(resolve(attemptDir, "execution-evidence.json"), `${args.attemptId} execution evidence`);
  retention = load(resolve(attemptDir, "retention.json"), `${args.attemptId} retention`);
  evaluation = load(resolve(attemptDir, "evaluation.json"), `${args.attemptId} evaluation`);
  ledger = load(resolve(args.phaseDir, "call-ledger.json"), "transport-smoke call ledger");

  const preflightPath = resolve(args.phaseDir, "preflight.json");
  const preflightFailurePath = resolve(args.phaseDir, "preflight-failure.json");
  capture(() => requireCondition(existsSync(preflightPath) !== existsSync(preflightFailurePath),
    `${args.attemptId}: exactly one smoke preflight outcome must be retained`));
  if (existsSync(preflightPath)) {
    preflight = load(preflightPath, "transport-smoke preflight");
  } else if (existsSync(preflightFailurePath)) {
    const retainedFailure = load<Imp24DTransportSmokePreflightFailureV1>(
      preflightFailurePath,
      "transport-smoke preflight failure",
    );
    if (retainedFailure !== null) {
      preflightFailure = retainedFailure;
      capture(() => validateImp24DTransportSmokePreflightFailure(retainedFailure, args.executionId));
    }
  }

  if (ledger !== null) {
    capture(() => {
      requireCondition(ledger!.schema === IMP24_LIVE_CALL_LEDGER_SCHEMA
          && ledger!.experimentId === args.executionId
          && ledger!.entries.length === 2
          && ledger!.brokerRequests === 2
          && Number.isSafeInteger(ledger!.codexExecInvocations)
          && ledger!.codexExecInvocations >= 0 && ledger!.codexExecInvocations <= 2
          && ledger!.infrastructureReplays === 0
          && ledger!.apiCallsMade === 0,
      `${args.attemptId}: smoke call ledger counts/identity drift`);
    });
    const ledgerEntry = ledger.entries.find((entry) => entry.attemptId === args.attemptId);
    if (ledgerEntry === undefined) {
      errors.push(`${args.attemptId}: smoke call-ledger entry is missing`);
    } else {
      requestedAt = ledgerEntry.requestedAt;
      completedAt = ledgerEntry.completedAt ?? "";
    }
  }

  if (request !== null && receipt !== null) {
    capture(() => {
      requireCondition(request!.experimentId === args.executionId
          && request!.role === args.expected.role
          && request!.partition === "canary"
          && request!.scheduleId === args.smokeScheduleId
          && request!.attemptId === args.attemptId
          && request!.replayOfAttemptId === null
          && request!.attemptNumber === 1
          && request!.profileId === args.expected.profileId
          && request!.model === args.expected.model
          && request!.effort === args.expected.effort
          && request!.caseId === args.expected.caseId
          && request!.sourceCaseSha256 === args.expected.sourceCaseSha256
          && request!.goldSha256 === args.expected.goldSha256
          && request!.schemaSha256 === args.expected.schemaSha256
          && request!.promptSourceSha256 === args.expected.promptSourceSha256
          && request!.evidenceEnvelopeSha256 === args.expected.evidenceEnvelopeSha256
          && request!.evidenceEnvelopeBytesSha256 === args.expected.evidenceEnvelopeBytesSha256
          && sha256Hex(request!.task) === args.expected.taskSha256,
      `${args.attemptId}: smoke request identity/profile drift`);
      const { requestSha256, ...requestCore } = request!;
      requireCondition(SHA256.test(requestSha256) && requestSha256 === hashCanonical(requestCore),
        `${args.attemptId}: smoke request self hash drift`);
      requireCondition(readFileSync(resolve(attemptDir, "evidence-envelope.json"), "utf8")
          === request!.evidenceEnvelopeBytes
          && sha256Hex(request!.evidenceEnvelopeBytes) === request!.evidenceEnvelopeBytesSha256,
      `${args.attemptId}: smoke envelope bytes/hash drift`);
      validateQualificationReceiptArtifactV3({ request: request!, receipt: receipt!, label: args.attemptId });
      requireCondition(qualificationReceiptMismatchesV3(
        request! as Parameters<typeof qualificationReceiptMismatchesV3>[0],
        receipt!,
      ).length === 0, `${args.attemptId}: smoke receipt binding drift`);
    });
  }

  if (preflight !== null) {
    capture(() => {
      validateLiveQualificationPreflightArtifactV3(preflight!, args.executionId);
      preflightValidated = true;
    });
  } else if (preflightFailure !== null && request !== null && execution !== null) {
    capture(() => requireCondition(preflightFailure!.freezeSha256 === request!.freezeSha256
        && preflightFailure!.certificationSha256 === request!.certificationSha256
        && preflightFailure!.productionInstrumentSealSha256 === request!.productionInstrumentSealSha256
        && execution!.invocation === "NOT_INVOKED_PRE_SPAWN",
    `${args.attemptId}: preflight-failure attempt binding drift`));
  }

  // This validation is deliberately independent from full execution-sidecar
  // and evaluation validation. A failed transport call remains terminally
  // diagnosable even when another retained artifact proves the call failed.
  if (request !== null && receipt !== null && diagnostics !== null
      && execution !== null && retention !== null && ledger !== null) {
    capture(() => {
      validateCodexProcessDiagnosticsV1(diagnostics!, {
        attemptId: request!.attemptId,
        requestSha256: request!.requestSha256,
        sessionId: execution!.sessionId,
        invocation: execution!.invocation === "RUNNER_RETURNED"
          ? "RUNNER_RETURNED"
          : execution!.invocation === "RUNNER_THREW" ? "RUNNER_THROWN" : "NOT_INVOKED",
        classification: receipt!.status,
      });
      const { retentionSha256, ...retentionCore } = retention!;
      const { executionEvidenceSha256, ...executionCore } = execution!;
      const ledgerEntry = ledger!.entries.find((entry) => entry.attemptId === args.attemptId);
      requireCondition(SHA256.test(retentionSha256)
          && hashCanonical(retentionCore) === retentionSha256
          && retention!.requestSha256 === request!.requestSha256
          && retention!.receiptSha256 === receipt!.receiptSha256
          && retention!.processDiagnosticsSha256 === diagnostics!.diagnosticsSha256
          && retention!.executionEvidenceSha256 === executionEvidenceSha256
          && SHA256.test(executionEvidenceSha256)
          && executionEvidenceSha256 === hashCanonical(executionCore)
          && execution!.attemptId === request!.attemptId
          && execution!.requestSha256 === request!.requestSha256
          && execution!.receiptSha256 === receipt!.receiptSha256
          && execution!.processDiagnosticsSha256 === diagnostics!.diagnosticsSha256
          && ledgerEntry !== undefined
          && ledgerEntry.scheduleId === args.smokeScheduleId
          && ledgerEntry.requestSha256 === request!.requestSha256
          && ledgerEntry.receiptSha256 === receipt!.receiptSha256
          && ledgerEntry.processDiagnosticsSha256 === diagnostics!.diagnosticsSha256
          && ledgerEntry.executionEvidenceSha256 === executionEvidenceSha256,
      `${args.attemptId}: smoke process-diagnostics evidence binding drift`);
      processDiagnosticsComplete = true;
    });
  }

  if (request !== null && receipt !== null && diagnostics !== null && execution !== null) {
    capture(() => {
      validateExecutionEvidenceArtifact({
        phaseDir: args.phaseDir,
        request: request!,
        receipt: receipt!,
        processDiagnostics: diagnostics!,
        artifact: execution!,
        ...(preflight === null ? {} : { preflight }),
      });
      executionEvidenceValidated = true;
    });
  }
  if (request !== null && receipt !== null && execution !== null && evaluation !== null) {
    capture(() => validateImp24DTransportSmokeEvaluation(evaluation!, {
      request: request!,
      receipt: receipt!,
      executionEvidenceSha256: execution!.executionEvidenceSha256,
    }));
  }
  if (request !== null && receipt !== null && diagnostics !== null
      && execution !== null && evaluation !== null && ledger !== null) {
    capture(() => {
      const ledgerEntry = ledger!.entries.find((entry) => entry.attemptId === args.attemptId);
      requireCondition(ledgerEntry !== undefined
          && ledgerEntry.scheduleId === args.smokeScheduleId
          && ledgerEntry.requestSha256 === request!.requestSha256
          && ledgerEntry.receiptSha256 === receipt!.receiptSha256
          && ledgerEntry.processDiagnosticsSha256 === diagnostics!.diagnosticsSha256
          && ledgerEntry.executionEvidenceSha256 === execution!.executionEvidenceSha256
          && ledgerEntry.evaluationArtifactSha256 === evaluation!.evaluationArtifactSha256,
      `${args.attemptId}: smoke call-ledger evidence binding drift`);
    });
  }

  const diagnosticsSummary = diagnostics === null ? emptyDiagnostics() : {
    invocation: diagnostics.invocation,
    classification: diagnostics.classification,
    errorName: diagnostics.errorName,
    errorMessage: diagnostics.errorMessage,
    timedOut: diagnostics.timedOut,
    exitCode: diagnostics.exitCode,
    stdoutBytes: diagnostics.stdoutBytes,
    stdoutSha256: diagnostics.stdoutSha256,
    stderrBytes: diagnostics.stderrBytes,
    stderrSha256: diagnostics.stderrSha256,
  };
  const runnerBoundaryCrossed = diagnostics !== null
    && diagnostics.invocation !== "NOT_INVOKED"
    && typeof diagnostics.sessionId === "string";
  const chatgptAuthVerified = preflightValidated
    && preflight?.executionRoute === "codex_exec_chatgpt_subscription"
    && preflight.authMode === "chatgpt"
    && preflight.apiKeyPresent === false
    && preflight.apiFallbackAllowed === false
    && preflight.directHttpOrSdkAllowed === false;
  const authoritativeOutputFileProduced = receipt?.status === "completed"
    && execution?.invocation === "RUNNER_RETURNED"
    && execution.finalMessageSource === "output-file"
    && execution.responseProduced === true
    && typeof receipt.rawOutput === "string";
  let rawJsonValid = false;
  try {
    if (typeof receipt?.rawOutput === "string") {
      JSON.parse(receipt.rawOutput);
      rawJsonValid = true;
    }
  } catch { /* retained below */ }
  const schemaValidJson = rawJsonValid
    && evaluation?.parsedJson === true
    && evaluation.schemaValid === true;
  const envelopeAndSidecarsBound = executionEvidenceValidated
    && evaluation?.envelopeBound === true
    && execution?.schemaBoundAtRunner === true
    && execution.effectiveContextManifest !== null
    && execution.routeSidecar !== null
    && execution.structuredOutputSidecar !== null
    && execution.resultSidecar !== null;
  const passed = errors.length === 0
    && receipt?.status === "completed"
    && runnerBoundaryCrossed
    && chatgptAuthVerified
    && processDiagnosticsComplete
    && authoritativeOutputFileProduced
    && schemaValidJson
    && envelopeAndSidecarsBound;
  const failureDetail = passed ? null : [
    ...errors,
    ...(receipt?.failureDetail ? [receipt.failureDetail] : []),
    ...(receipt?.status === "completed" && !schemaValidJson
      ? ["authoritative output was not schema-valid JSON"] : []),
  ].filter(Boolean).join("; ").slice(0, 8_000) || "transport smoke failed without complete retained evidence";

  return {
    role: args.expected.role,
    sourceScheduleId: args.expected.sourceScheduleId,
    smokeScheduleId: args.smokeScheduleId,
    attemptId: args.attemptId,
    sessionId: execution?.sessionId ?? diagnostics?.sessionId ?? null,
    profileId: request?.profileId ?? args.expected.profileId,
    model: request?.model ?? args.expected.model,
    effort: request?.effort ?? args.expected.effort,
    requestSha256: request?.requestSha256 ?? "",
    evidenceEnvelopeSha256: request?.evidenceEnvelopeSha256 ?? "",
    evidenceEnvelopeBytesSha256: request?.evidenceEnvelopeBytesSha256 ?? "",
    receiptSha256: receipt?.receiptSha256 ?? null,
    receiptStatus: receipt?.status ?? null,
    processDiagnosticsRelPath: relativeFromRepository(args.repositoryRoot, processDiagnosticsPath),
    processDiagnosticsSha256: diagnostics?.diagnosticsSha256 ?? null,
    executionEvidenceSha256: execution?.executionEvidenceSha256 ?? null,
    evaluationArtifactSha256: evaluation?.evaluationArtifactSha256 ?? null,
    requestedAt,
    completedAt,
    runnerBoundaryCrossed,
    chatgptAuthVerified,
    apiCalls: 0,
    processDiagnosticsComplete,
    authoritativeOutputFileProduced,
    schemaValidJson,
    envelopeAndSidecarsBound,
    qualificationMetricsIncluded: false,
    passed,
    failureClassification: passed ? null : receipt?.status ?? "retained_evidence_incomplete",
    failureDetail,
    diagnostics: diagnosticsSummary,
  };
}

export function validateImp24DTransportSmokeCycle(cycle: Imp24DTransportSmokeCycleV1): void {
  const expectedExecutionId = cycle.cycle === 1
    ? IMP24D_TRANSPORT_SMOKE_EXECUTION_ID
    : IMP24D_TRANSPORT_SMOKE_R2_EXECUTION_ID;
  requireCondition(cycle.schema === IMP24D_TRANSPORT_SMOKE_CYCLE_SCHEMA
      && cycle.executionId === expectedExecutionId
      && cycle.stateRoot === imp24DTransportSmokeStateRootRelPath(expectedExecutionId)
      && GIT_SHA.test(cycle.implementationCommit)
      && Number.isSafeInteger(cycle.workflowRunId) && cycle.workflowRunId > 0
      && Number.isFinite(Date.parse(cycle.implementationCiVerifiedAt))
      && SHA256.test(cycle.implementationCiGateSha256)
      && SHA256.test(cycle.implementationCiGateBytesSha256)
      && SHA256.test(cycle.inputBindingSha256)
      && SHA256.test(cycle.inputBindingBytesSha256)
      && SHA256.test(cycle.candidateAvailabilitySha256)
      && SHA256.test(cycle.preflightSha256)
      && SHA256.test(cycle.qualificationFreezeSha256)
      && SHA256.test(cycle.qualificationSemanticProjectionSha256)
      && SHA256.test(cycle.certificationSha256)
      && SHA256.test(cycle.productionInstrumentSealSha256)
      && SHA256.test(cycle.productionQualificationParitySha256)
      && (cycle.cycle === 1
        ? cycle.mechanicalCorrectionSha256 === null
          && cycle.correctionCommitReportBytesSha256 === null
        : typeof cycle.mechanicalCorrectionSha256 === "string"
          && SHA256.test(cycle.mechanicalCorrectionSha256)
          && typeof cycle.correctionCommitReportBytesSha256 === "string"
          && SHA256.test(cycle.correctionCommitReportBytesSha256))
      && SHA256.test(cycle.callLedgerSha256)
      && SHA256.test(cycle.callLedgerBytesSha256)
      && cycle.calls.length === 2
      && cycle.calls[0].role === "reader"
      && cycle.calls[1].role === "source"
      && new Set(cycle.calls.map((call) => call.attemptId)).size === 2
      && cycle.calls.every((call) => call.qualificationMetricsIncluded === false
        && call.apiCalls === 0
        && call.processDiagnosticsComplete === true
        && typeof call.processDiagnosticsSha256 === "string"
        && SHA256.test(call.processDiagnosticsSha256)
        && call.processDiagnosticsRelPath.endsWith("/process-diagnostics.json")
        && call.diagnostics.invocation !== null
        && call.diagnostics.classification !== null
        && typeof call.diagnostics.stdoutBytes === "number"
        && typeof call.diagnostics.stdoutSha256 === "string"
        && SHA256.test(call.diagnostics.stdoutSha256)
        && typeof call.diagnostics.stderrBytes === "number"
        && typeof call.diagnostics.stderrSha256 === "string"
        && SHA256.test(call.diagnostics.stderrSha256))
      && cycle.brokerRequests === 2
      && Number.isSafeInteger(cycle.codexExecInvocations)
      && cycle.codexExecInvocations >= 0 && cycle.codexExecInvocations <= 2
      && (cycle.status !== "PASS" || cycle.codexExecInvocations === 2)
      && cycle.apiCalls === 0
      && cycle.qualificationMetricsIncluded === false
      && cycle.qualificationArtifactsCreated === false
      && cycle.status === (cycle.calls.every((call) => call.passed) ? "PASS" : "FAIL")
      && Number.isFinite(Date.parse(cycle.startedAt))
      && Number.isFinite(Date.parse(cycle.completedAt))
      && Date.parse(cycle.implementationCiVerifiedAt) < Date.parse(cycle.startedAt)
      && Date.parse(cycle.startedAt) <= Date.parse(cycle.completedAt)
      && cycle.calls.every((call) => Number.isFinite(Date.parse(call.requestedAt))
        && Number.isFinite(Date.parse(call.completedAt))
        && Date.parse(call.requestedAt) >= Date.parse(cycle.startedAt)
        && Date.parse(call.completedAt) >= Date.parse(call.requestedAt)
        && Date.parse(call.completedAt) <= Date.parse(cycle.completedAt))
      && SHA256.test(cycle.processDiagnosticsSetSha256)
      && cycle.processDiagnosticsSetSha256 === hashCanonical(
        cycle.calls.map((call) => call.processDiagnosticsSha256),
      ),
  "IMP-24D transport-smoke cycle identity/count/status drift");
  const { cycleSha256, ...core } = cycle;
  requireCondition(SHA256.test(cycleSha256) && cycleSha256 === hashCanonical(core),
    "IMP-24D transport-smoke cycle self hash drift");
}

export function validateImp24DTransportSmokeReport(report: Imp24DTransportSmokeReportV1): void {
  requireCondition(report.schema === IMP24D_TRANSPORT_SMOKE_REPORT_SCHEMA
      && (report.cycles.length === 1 || report.cycles.length === 2)
      && report.cycles[0].cycle === 1
      && (report.cycles.length === 1 || report.cycles[1].cycle === 2)
      && report.observabilityImplementationCommit === report.cycles[0].implementationCommit
      && report.correctionCommit === (report.cycles[1]?.implementationCommit ?? null)
      && report.effectiveImplementationCommit === report.cycles.at(-1)?.implementationCommit
      && report.finalCycle === report.cycles.length
      && report.totalCalls === report.cycles.length * 2
      && report.modelCalls === report.cycles.reduce((sum, cycle) => sum + cycle.codexExecInvocations, 0)
      && report.apiCalls === 0
      && report.qualificationMetricsIncluded === false
      && report.qualificationArtifactsCreated === false
      && report.status === (report.cycles.at(-1)?.status ?? "FAIL")
      && (report.cycles.length === 1
        ? report.cycles[0].status === "FAIL" || report.mechanicalCorrection === null
        : report.mechanicalCorrection !== null),
  "IMP-24D transport-smoke report lifecycle/count/status drift");
  report.cycles.forEach(validateImp24DTransportSmokeCycle);
  if (report.mechanicalCorrection !== null) {
    validateImp24DTransportMechanicalCorrection(report.mechanicalCorrection);
    requireCondition(report.cycles[0].status === "FAIL"
        && report.mechanicalCorrection.observabilityImplementationCommit
          === report.cycles[0].implementationCommit
        && report.mechanicalCorrection.failedCycleSha256 === report.cycles[0].cycleSha256
        && report.mechanicalCorrection.failedProcessDiagnosticsSetSha256
          === report.cycles[0].processDiagnosticsSetSha256
        && report.mechanicalCorrection.semanticProjectionSha256
          === report.cycles[0].qualificationSemanticProjectionSha256,
    "IMP-24D mechanical-correction record is not bound to the failed first cycle");
  }
  if (report.cycles.length === 2) {
    const logicalCallProjection = (cycle: Imp24DTransportSmokeCycleV1) => cycle.calls.map((call) => ({
      role: call.role,
      sourceScheduleId: call.sourceScheduleId,
      profileId: call.profileId,
      model: call.model,
      effort: call.effort,
      evidenceEnvelopeSha256: call.evidenceEnvelopeSha256,
      evidenceEnvelopeBytesSha256: call.evidenceEnvelopeBytesSha256,
    }));
    requireCondition(report.cycles[0].status === "FAIL"
        && report.cycles[1].implementationCommit !== report.cycles[0].implementationCommit
        && Date.parse(report.cycles[0].completedAt)
          < Date.parse(report.cycles[1].implementationCiVerifiedAt)
        && report.cycles[0].qualificationSemanticProjectionSha256
          === report.cycles[1].qualificationSemanticProjectionSha256
        && report.cycles[1].mechanicalCorrectionSha256
          === report.mechanicalCorrection?.correctionSha256
        && hashCanonical(logicalCallProjection(report.cycles[0]))
          === hashCanonical(logicalCallProjection(report.cycles[1])),
    "IMP-24D second smoke cycle requires one failed first cycle and one distinct correction commit");
  }
  const { reportSha256, ...core } = report;
  requireCondition(SHA256.test(reportSha256) && reportSha256 === hashCanonical(core),
    "IMP-24D transport-smoke report self hash drift");
}

export function renderImp24DTransportSmokeReportMarkdown(report: Imp24DTransportSmokeReportV1): string {
  const lines = [
    "# IMP-24D Transport Smoke Result",
    "",
    `- Status: **${report.status}**`,
    `- Observability implementation commit: \`${report.observabilityImplementationCommit}\``,
    `- Mechanical correction used: **${report.correctionCommit === null ? "no" : "yes"}**`,
    `- Effective implementation commit: \`${report.effectiveImplementationCommit}\``,
    `- Calls: **${report.totalCalls}** (${report.cycles.length} fixed two-call cycle${report.cycles.length === 1 ? "" : "s"})`,
    "- API calls: **0**",
    "- Qualification metrics: **excluded**",
    "- Qualification artifacts created: **false**",
    "",
  ];
  if (report.mechanicalCorrection !== null) {
    lines.push("## Bounded mechanical correction", "",
      `- Defect class: \`${report.mechanicalCorrection.defectClass}\``,
      `- Diagnosis: ${report.mechanicalCorrection.rationale}`,
      `- Regression tests: ${report.mechanicalCorrection.regressionTestFiles.map((path) => `\`${path}\``).join(", ")}`,
      `- Correction record: \`${report.mechanicalCorrection.correctionSha256}\``, "");
  }
  for (const cycle of report.cycles) {
    lines.push(`## Cycle ${cycle.cycle}: ${cycle.status}`, "",
      `- Execution identity: \`${cycle.executionId}\``,
      `- Exact implementation CI: run **${cycle.workflowRunId}**, commit \`${cycle.implementationCommit}\``,
      `- Reader: **${cycle.calls[0].passed ? "PASS" : "FAIL"}** — \`${cycle.calls[0].profileId}\``,
      `- Source: **${cycle.calls[1].passed ? "PASS" : "FAIL"}** — \`${cycle.calls[1].profileId}\``,
      ...cycle.calls.filter((call) => !call.passed).map((call) =>
        `- ${call.role} diagnostics: \`${call.processDiagnosticsRelPath}\` — ${call.failureDetail ?? "failed"}`),
      "");
  }
  return `${lines.join("\n")}\n`;
}

/** Model-free pre-commit diagnosis materializer. The record intentionally has
 * no correction-commit field: its exact blob is committed by the correction,
 * then cycle 2 proves ownership with `git show <correction>:<report>` before
 * any new CI/auth/root/model work. */
export function materializeImp24DTransportMechanicalCorrection(args: {
  repositoryRoot: string;
  defectClass: Imp24DTransportMechanicalDefectClassV1;
  rationale: string;
}): { record: Imp24DTransportMechanicalCorrectionV1; report: Imp24DTransportSmokeReportV1 } {
  const repositoryRoot = resolve(args.repositoryRoot);
  const reportPath = resolve(repositoryRoot, IMP24D_TRANSPORT_SMOKE_REPORT_JSON_REL_PATH);
  const markdownPath = resolve(repositoryRoot, IMP24D_TRANSPORT_SMOKE_REPORT_MARKDOWN_REL_PATH);
  requireCondition(existsSync(reportPath) && existsSync(markdownPath),
    "IMP-24D correction diagnosis requires the retained failed smoke report");
  const retained = parseJson<Imp24DTransportSmokeReportV1>(reportPath,
    "IMP-24D failed transport-smoke report");
  validateImp24DTransportSmokeReport(retained);
  requireCondition(retained.cycles.length === 1 && retained.cycles[0].status === "FAIL"
      && retained.mechanicalCorrection === null,
  "IMP-24D correction diagnosis may be materialized exactly once after the failed first cycle");
  verifyRetainedImp24DTransportSmokeCycle({
    repositoryRoot,
    executionId: IMP24D_TRANSPORT_SMOKE_EXECUTION_ID,
    expectedStatus: "FAIL",
    reportCycle: retained.cycles[0],
  });
  const paths = collectImp24DPlannedCorrectionPaths(repositoryRoot);
  const record = buildImp24DTransportMechanicalCorrection({
    cycle: retained.cycles[0],
    defectClass: args.defectClass,
    rationale: args.rationale,
    paths,
  });
  const { reportSha256: _old, ...oldCore } = retained;
  const core: Omit<Imp24DTransportSmokeReportV1, "reportSha256"> = {
    ...oldCore,
    mechanicalCorrection: record,
  };
  const report = { ...core, reportSha256: hashCanonical(core) };
  validateImp24DTransportSmokeReport(report);
  writeFileAtomic(reportPath, `${canonicalJson(report)}\n`);
  writeFileAtomic(markdownPath, renderImp24DTransportSmokeReportMarkdown(report));
  requireCondition(readFileSync(reportPath, "utf8") === `${canonicalJson(report)}\n`
      && readFileSync(markdownPath, "utf8") === renderImp24DTransportSmokeReportMarkdown(report),
  "IMP-24D correction diagnosis report read-back drift");
  return { record, report };
}

export function verifyImp24DTransportMechanicalCorrectionOwnership(args: {
  repositoryRoot: string;
  correctionCommit: string;
  retainedReportBytes?: Buffer;
}): {
  report: Imp24DTransportSmokeReportV1;
  record: Imp24DTransportMechanicalCorrectionV1;
  proof: Imp24DBoundedCorrectionCommitProofV1;
  committedReportBytesSha256: string;
} {
  const repositoryRoot = resolve(args.repositoryRoot);
  const bytes = readCommittedBytes(repositoryRoot, args.correctionCommit,
    IMP24D_TRANSPORT_SMOKE_REPORT_JSON_REL_PATH,
    "IMP-24D correction-commit diagnosis report");
  if (args.retainedReportBytes !== undefined) {
    requireCondition(bytes.equals(args.retainedReportBytes),
      "IMP-24D bounded diagnosis report is not owned byte-for-byte by the correction commit");
  }
  const report = JSON.parse(bytes.toString("utf8")) as Imp24DTransportSmokeReportV1;
  validateImp24DTransportSmokeReport(report);
  requireCondition(report.cycles.length === 1 && report.cycles[0].status === "FAIL"
      && report.mechanicalCorrection !== null,
  "IMP-24D correction commit must own one failed cycle and its bounded diagnosis record");
  const proof = assertImp24DBoundedCorrectionCommit({
    repositoryRoot,
    observabilityImplementationCommit: report.cycles[0].implementationCommit,
    correctionCommit: args.correctionCommit,
  });
  requireCondition(sameImp24DBoundedCorrectionProofPaths(report.mechanicalCorrection, proof),
    "IMP-24D correction commit paths differ from the committed diagnosis record");
  return {
    report,
    record: report.mechanicalCorrection,
    proof,
    committedReportBytesSha256: sha256Hex(bytes),
  };
}

export type VerifiedImp24DTransportSmokeCycleV1 = {
  cycle: Imp24DTransportSmokeCycleV1;
  inputBinding: Imp24DTransportSmokeInputBindingV1;
  gate: Imp24ImplementationCiGateV1;
};

/** Status-neutral deep verifier. A failed first cycle is evidence, not a
 * resumable attempt; cycle 2 must traverse this proof before any new work. */
export function verifyRetainedImp24DTransportSmokeCycle(args: {
  repositoryRoot: string;
  executionId: Imp24DTransportSmokeCycleV1["executionId"];
  expectedStatus?: "PASS" | "FAIL";
  reportCycle?: Imp24DTransportSmokeCycleV1;
}): VerifiedImp24DTransportSmokeCycleV1 {
  const repositoryRoot = resolve(args.repositoryRoot);
  const cycleNumber = args.executionId === IMP24D_TRANSPORT_SMOKE_EXECUTION_ID ? 1 : 2;
  const stateRoot = imp24DTransportSmokeStateRootRelPath(args.executionId);
  const root = resolve(repositoryRoot, stateRoot);
  const phaseDir = resolve(root, "live");
  const cyclePath = resolve(root, "cycle-result.json");
  const requireExactDirectory = (dir: string, names: readonly string[], label: string): void => {
    const stat = lstatSync(dir);
    requireCondition(stat.isDirectory() && !stat.isSymbolicLink(), `${label} must be a non-symlink directory`);
    const actual = readdirSync(dir).sort();
    requireCondition(hashCanonical(actual) === hashCanonical([...names].sort()),
      `${label} has missing or unexpected entries`);
    for (const name of actual) {
      requireCondition(!lstatSync(resolve(dir, name)).isSymbolicLink(),
        `${label} contains prohibited symlink ${name}`);
    }
  };
  requireExactDirectory(root, [
    "cycle-result.json", "implementation-ci-gate.json", "live", "smoke-input-binding.json",
  ], `IMP-24D transport-smoke cycle ${cycleNumber} root`);
  const retainedPreflightPath = resolve(phaseDir, "preflight.json");
  const retainedPreflightFailurePath = resolve(phaseDir, "preflight-failure.json");
  requireCondition(existsSync(retainedPreflightPath) !== existsSync(retainedPreflightFailurePath),
    `IMP-24D transport-smoke cycle ${cycleNumber} must retain exactly one preflight outcome`);
  requireExactDirectory(phaseDir, [
    "attempts", "call-ledger.json",
    ...(existsSync(resolve(phaseDir, "exec")) ? ["exec"] : []),
    existsSync(retainedPreflightPath) ? "preflight.json" : "preflight-failure.json",
  ], `IMP-24D transport-smoke cycle ${cycleNumber} live root`);
  requireExactDirectory(resolve(phaseDir, "attempts"), [
    `${args.executionId}-reader-canary-a1`,
    `${args.executionId}-source-canary-a1`,
  ], `IMP-24D transport-smoke cycle ${cycleNumber} attempts root`);

  const cycle = parseJson<Imp24DTransportSmokeCycleV1>(cyclePath,
    `IMP-24D transport-smoke cycle ${cycleNumber}`);
  validateImp24DTransportSmokeCycle(cycle);
  requireCondition(cycle.executionId === args.executionId && cycle.cycle === cycleNumber,
    `IMP-24D transport-smoke cycle ${cycleNumber} path/identity mismatch`);
  if (args.expectedStatus !== undefined) {
    requireCondition(cycle.status === args.expectedStatus,
      `IMP-24D transport-smoke cycle ${cycleNumber} status is not ${args.expectedStatus}`);
  }
  if (args.reportCycle !== undefined) {
    requireCondition(hashCanonical(cycle) === hashCanonical(args.reportCycle),
      `IMP-24D transport-smoke cycle ${cycleNumber} differs from the report`);
  }
  if (cycleNumber === 2) {
    const ownership = verifyImp24DTransportMechanicalCorrectionOwnership({
      repositoryRoot,
      correctionCommit: cycle.implementationCommit,
    });
    requireCondition(ownership.record.correctionSha256 === cycle.mechanicalCorrectionSha256
        && ownership.committedReportBytesSha256 === cycle.correctionCommitReportBytesSha256,
    "IMP-24D cycle 2 is not bound to the correction-commit diagnosis record");
  }

  const gatePath = resolve(root, "implementation-ci-gate.json");
  const gate = parseJson<Imp24ImplementationCiGateV1>(gatePath,
    `IMP-24D transport-smoke cycle ${cycleNumber} implementation CI gate`);
  validateImp24ImplementationCiGate({
    gate,
    expectedHeadSha: cycle.implementationCommit,
    checkout: gate.trustedEvidence.raw.checkout,
  });
  requireCondition(gate.headSha === cycle.implementationCommit
      && gate.workflow.headSha === cycle.implementationCommit
      && gate.workflow.runId === cycle.workflowRunId
      && gate.verifiedAt === cycle.implementationCiVerifiedAt
      && gate.gateSha256 === cycle.implementationCiGateSha256,
  `IMP-24D transport-smoke cycle ${cycleNumber} is not bound to exact successful implementation CI`);
  requireCondition(sha256Hex(readFileSync(gatePath)) === cycle.implementationCiGateBytesSha256,
    `IMP-24D transport-smoke cycle ${cycleNumber} implementation CI gate bytes drift`);

  const inputBindingPath = resolve(root, "smoke-input-binding.json");
  const inputBinding = parseJson<Imp24DTransportSmokeInputBindingV1>(inputBindingPath,
    `IMP-24D transport-smoke cycle ${cycleNumber} input binding`);
  const availability = validateImp24DTransportSmokeInputBinding(inputBinding);
  const certifiedBinding = verifyImp24DTransportSmokeInputBindingAgainstCertifiedPlan({
    repositoryRoot,
    implementationCommit: cycle.implementationCommit,
    retained: inputBinding,
  });
  requireCondition(inputBinding.executionId === cycle.executionId
      && inputBinding.qualificationFreezeSha256 === cycle.qualificationFreezeSha256
      && inputBinding.qualificationSemanticProjectionSha256
        === cycle.qualificationSemanticProjectionSha256
      && inputBinding.certificationSha256 === cycle.certificationSha256
      && inputBinding.productionInstrumentSealSha256 === cycle.productionInstrumentSealSha256
      && inputBinding.productionQualificationParitySha256
        === cycle.productionQualificationParitySha256
      && retainedCandidateAvailabilityIdentityV3(inputBinding.candidateAvailability)
        === cycle.candidateAvailabilitySha256
      && inputBinding.inputBindingSha256 === cycle.inputBindingSha256
      && sha256Hex(readFileSync(inputBindingPath)) === cycle.inputBindingBytesSha256,
  `IMP-24D transport-smoke cycle ${cycleNumber} input binding differs from the cycle`);
  requireCondition(inputBinding.qualificationSemanticProjectionSha256
      === certifiedBinding.qualificationSemanticProjectionSha256,
  "IMP-24D transport-smoke semantic projection drift");

  if (existsSync(retainedPreflightPath)) {
    const retainedPreflight = parseJson<LiveQualificationPreflightV3>(retainedPreflightPath,
      `IMP-24D transport-smoke cycle ${cycleNumber} preflight`);
    validateLiveQualificationPreflightArtifactV3(retainedPreflight, cycle.executionId);
    requireCondition(retainedPreflight.preflightSha256 === cycle.preflightSha256
        && retainedPreflight.candidateAvailabilitySha256 === cycle.candidateAvailabilitySha256
        && retainedPreflight.freezeSha256 === cycle.qualificationFreezeSha256,
    `IMP-24D transport-smoke cycle ${cycleNumber} preflight input binding drift`);
  } else {
    const failure = parseJson<Imp24DTransportSmokePreflightFailureV1>(retainedPreflightFailurePath,
      `IMP-24D transport-smoke cycle ${cycleNumber} preflight failure`);
    validateImp24DTransportSmokePreflightFailure(failure, cycle.executionId);
    requireCondition(cycle.status === "FAIL"
        && failure.preflightFailureSha256 === cycle.preflightSha256
        && failure.candidateAvailabilitySha256 === cycle.candidateAvailabilitySha256
        && failure.freezeSha256 === cycle.qualificationFreezeSha256,
    `IMP-24D transport-smoke cycle ${cycleNumber} preflight-failure input binding drift`);
  }
  const callLedgerPath = resolve(phaseDir, "call-ledger.json");
  const retainedLedger = parseJson<LiveCallLedgerV3>(callLedgerPath,
    `IMP-24D transport-smoke cycle ${cycleNumber} call ledger`);
  requireCondition(hashCanonical(retainedLedger) === cycle.callLedgerSha256
      && sha256Hex(readFileSync(callLedgerPath)) === cycle.callLedgerBytesSha256,
  `IMP-24D transport-smoke cycle ${cycleNumber} call-ledger object/bytes drift`);
  for (const name of FORBIDDEN_QUALIFICATION_ARTIFACTS) {
    requireCondition(!existsSync(resolve(root, name)) && !existsSync(resolve(phaseDir, name)),
      `IMP-24D transport-smoke root illegally contains qualification artifact ${name}`);
  }
  const inspected = cycle.calls.map((call, index) => inspectRetainedImp24DTransportSmokeCall({
    repositoryRoot,
    phaseDir,
    executionId: cycle.executionId,
    expected: inputBinding.calls[index],
    smokeScheduleId: `${cycle.executionId}-${inputBinding.calls[index].role}-canary`,
    attemptId: `${cycle.executionId}-${inputBinding.calls[index].role}-canary-a1`,
  }));
  requireCondition(hashCanonical(inspected) === hashCanonical(cycle.calls),
    `IMP-24D transport-smoke cycle ${cycleNumber} call summaries differ from retained evidence`);

  const referencedExecLogRelPaths = new Set<string>();
  for (const call of cycle.calls) {
    const execution = parseJson<LiveAttemptExecutionEvidenceV3>(resolve(
      phaseDir, "attempts", call.attemptId, "execution-evidence.json",
    ), `${call.attemptId} execution evidence for exec-root audit`);
    for (const binding of [
      execution.effectiveContextManifest,
      execution.routeSidecar,
      execution.structuredOutputSidecar,
      execution.resultSidecar,
    ]) if (binding !== null) referencedExecLogRelPaths.add(binding.relPath);
  }
  validateLiveExecEvidenceRootV3(phaseDir, referencedExecLogRelPaths);

  const assertNoSuccessorIdentity = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const path = resolve(dir, name);
      const stat = lstatSync(path);
      requireCondition(!stat.isSymbolicLink(),
        `IMP-24D smoke root contains prohibited symlink in ${relativeFromRepository(repositoryRoot, path)}`);
      if (stat.isDirectory()) assertNoSuccessorIdentity(path);
      else requireCondition(!readFileSync(path).includes(IMP24_ROLE_QUALIFICATION_R2_EXECUTION_ID),
        `IMP-24D smoke root retains forbidden successor r2 identity in ${relativeFromRepository(repositoryRoot, path)}`);
    }
  };
  assertNoSuccessorIdentity(root);
  return { cycle, inputBinding, gate };
}

/** Deep retained PASS verifier used by the r2 campaign gate and final
 * attestation. It never runs auth, a CLI, a model, or a network query. */
export function verifyRetainedImp24DTransportSmoke(args: {
  repositoryRoot: string;
  expectedImplementationHeadSha?: string;
}): VerifiedImp24DTransportSmokeV1 {
  const repositoryRoot = resolve(args.repositoryRoot);
  const reportPath = resolve(repositoryRoot, IMP24D_TRANSPORT_SMOKE_REPORT_JSON_REL_PATH);
  const markdownPath = resolve(repositoryRoot, IMP24D_TRANSPORT_SMOKE_REPORT_MARKDOWN_REL_PATH);
  requireCondition(existsSync(reportPath) && existsSync(markdownPath),
    "retained IMP-24D transport-smoke PASS report is missing");
  const report = parseJson<Imp24DTransportSmokeReportV1>(reportPath, "IMP-24D transport-smoke report");
  validateImp24DTransportSmokeReport(report);
  requireCondition(report.status === "PASS", "retained IMP-24D transport smoke did not PASS");
  if (args.expectedImplementationHeadSha !== undefined) {
    requireCondition(report.effectiveImplementationCommit === args.expectedImplementationHeadSha,
      "retained transport-smoke PASS is not bound to the exact qualification implementation HEAD");
  }
  if (report.cycles.length === 2) {
    try {
      const directParent = execFileSync("git", [
        "rev-parse", `${report.cycles[1].implementationCommit}^`,
      ], {
        cwd: repositoryRoot,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }).trim();
      requireCondition(directParent === report.cycles[0].implementationCommit,
        "IMP-24D corrected smoke permits exactly one direct correction commit");
    } catch (error) {
      if (error instanceof Imp24DTransportSmokeEvidenceError) throw error;
      throw new Imp24DTransportSmokeEvidenceError(
        `IMP-24D correction commit parent could not be proven: ${(error as Error).message}`,
      );
    }
  }

  for (const cycle of report.cycles) {
    verifyRetainedImp24DTransportSmokeCycle({
      repositoryRoot,
      executionId: cycle.executionId,
      expectedStatus: cycle.status,
      reportCycle: cycle,
    });
  }

  for (const cycle of report.cycles) {
    const root = resolve(repositoryRoot, cycle.stateRoot);
    const phaseDir = resolve(root, "live");
    const cyclePath = resolve(root, "cycle-result.json");
    const requireExactDirectory = (dir: string, names: readonly string[], label: string): void => {
      const stat = lstatSync(dir);
      requireCondition(stat.isDirectory() && !stat.isSymbolicLink(), `${label} must be a non-symlink directory`);
      const actual = readdirSync(dir).sort();
      requireCondition(hashCanonical(actual) === hashCanonical([...names].sort()),
        `${label} has missing or unexpected entries`);
      for (const name of actual) {
        requireCondition(!lstatSync(resolve(dir, name)).isSymbolicLink(),
          `${label} contains prohibited symlink ${name}`);
      }
    };
    requireExactDirectory(root, [
      "cycle-result.json", "implementation-ci-gate.json", "live", "smoke-input-binding.json",
    ], `IMP-24D transport-smoke cycle ${cycle.cycle} root`);
    const retainedPreflightPath = resolve(phaseDir, "preflight.json");
    const retainedPreflightFailurePath = resolve(phaseDir, "preflight-failure.json");
    requireCondition(existsSync(retainedPreflightPath) !== existsSync(retainedPreflightFailurePath),
      `IMP-24D transport-smoke cycle ${cycle.cycle} must retain exactly one preflight outcome`);
    requireExactDirectory(phaseDir, [
      "attempts", "call-ledger.json",
      ...(existsSync(resolve(phaseDir, "exec")) ? ["exec"] : []),
      existsSync(retainedPreflightPath) ? "preflight.json" : "preflight-failure.json",
    ],
      `IMP-24D transport-smoke cycle ${cycle.cycle} live root`);
    requireExactDirectory(resolve(phaseDir, "attempts"), [
      `${cycle.executionId}-reader-canary-a1`,
      `${cycle.executionId}-source-canary-a1`,
    ], `IMP-24D transport-smoke cycle ${cycle.cycle} attempts root`);
    const retainedCycle = parseJson<Imp24DTransportSmokeCycleV1>(cyclePath,
      `IMP-24D transport-smoke cycle ${cycle.cycle}`);
    validateImp24DTransportSmokeCycle(retainedCycle);
    requireCondition(hashCanonical(retainedCycle) === hashCanonical(cycle),
      `IMP-24D transport-smoke cycle ${cycle.cycle} differs from the report`);
    const gatePath = resolve(root, "implementation-ci-gate.json");
    const gate = parseJson<Imp24ImplementationCiGateV1>(gatePath,
      `IMP-24D transport-smoke cycle ${cycle.cycle} implementation CI gate`);
    validateImp24ImplementationCiGate({
      gate,
      expectedHeadSha: cycle.implementationCommit,
      checkout: gate.trustedEvidence.raw.checkout,
    });
    requireCondition(gate.headSha === cycle.implementationCommit
        && gate.workflow.headSha === cycle.implementationCommit
        && gate.workflow.runId === cycle.workflowRunId
        && gate.verifiedAt === cycle.implementationCiVerifiedAt
        && gate.gateSha256 === cycle.implementationCiGateSha256,
    `IMP-24D transport-smoke cycle ${cycle.cycle} is not bound to exact successful implementation CI`);
    requireCondition(sha256Hex(readFileSync(gatePath)) === cycle.implementationCiGateBytesSha256,
      `IMP-24D transport-smoke cycle ${cycle.cycle} implementation CI gate bytes drift`);
    const inputBindingPath = resolve(root, "smoke-input-binding.json");
    const inputBinding = parseJson<Imp24DTransportSmokeInputBindingV1>(inputBindingPath,
      `IMP-24D transport-smoke cycle ${cycle.cycle} input binding`);
    validateImp24DTransportSmokeInputBinding(inputBinding);
    verifyImp24DTransportSmokeInputBindingAgainstCertifiedPlan({
      repositoryRoot,
      implementationCommit: cycle.implementationCommit,
      retained: inputBinding,
    });
    requireCondition(inputBinding.executionId === cycle.executionId
        && inputBinding.qualificationFreezeSha256 === cycle.qualificationFreezeSha256
        && retainedCandidateAvailabilityIdentityV3(inputBinding.candidateAvailability)
          === cycle.candidateAvailabilitySha256
        && inputBinding.inputBindingSha256 === cycle.inputBindingSha256
        && sha256Hex(readFileSync(inputBindingPath)) === cycle.inputBindingBytesSha256,
    `IMP-24D transport-smoke cycle ${cycle.cycle} input binding differs from the cycle`);
    if (existsSync(retainedPreflightPath)) {
      const retainedPreflight = parseJson<LiveQualificationPreflightV3>(retainedPreflightPath,
        `IMP-24D transport-smoke cycle ${cycle.cycle} preflight`);
      validateLiveQualificationPreflightArtifactV3(retainedPreflight, cycle.executionId);
      requireCondition(retainedPreflight.preflightSha256 === cycle.preflightSha256
          && retainedPreflight.candidateAvailabilitySha256 === cycle.candidateAvailabilitySha256
          && retainedPreflight.freezeSha256 === cycle.qualificationFreezeSha256,
      `IMP-24D transport-smoke cycle ${cycle.cycle} preflight input binding drift`);
    } else {
      const failure = parseJson<Imp24DTransportSmokePreflightFailureV1>(retainedPreflightFailurePath,
        `IMP-24D transport-smoke cycle ${cycle.cycle} preflight failure`);
      validateImp24DTransportSmokePreflightFailure(failure, cycle.executionId);
      requireCondition(cycle.status === "FAIL"
          && failure.preflightFailureSha256 === cycle.preflightSha256
          && failure.candidateAvailabilitySha256 === cycle.candidateAvailabilitySha256
          && failure.freezeSha256 === cycle.qualificationFreezeSha256,
      `IMP-24D transport-smoke cycle ${cycle.cycle} preflight-failure input binding drift`);
    }
    const callLedgerPath = resolve(phaseDir, "call-ledger.json");
    const retainedLedger = parseJson<LiveCallLedgerV3>(callLedgerPath,
      `IMP-24D transport-smoke cycle ${cycle.cycle} call ledger`);
    requireCondition(hashCanonical(retainedLedger) === cycle.callLedgerSha256
        && sha256Hex(readFileSync(callLedgerPath)) === cycle.callLedgerBytesSha256,
    `IMP-24D transport-smoke cycle ${cycle.cycle} call-ledger object/bytes drift`);
    for (const name of FORBIDDEN_QUALIFICATION_ARTIFACTS) {
      requireCondition(!existsSync(resolve(root, name)) && !existsSync(resolve(phaseDir, name)),
        `IMP-24D transport-smoke root illegally contains qualification artifact ${name}`);
    }
    const inspected = cycle.calls.map((call, index) => inspectRetainedImp24DTransportSmokeCall({
      repositoryRoot,
      phaseDir,
      executionId: cycle.executionId,
      expected: inputBinding.calls[index],
      smokeScheduleId: `${cycle.executionId}-${inputBinding.calls[index].role}-canary`,
      attemptId: `${cycle.executionId}-${inputBinding.calls[index].role}-canary-a1`,
    }));
    requireCondition(hashCanonical(inspected) === hashCanonical(cycle.calls),
      `IMP-24D transport-smoke cycle ${cycle.cycle} call summaries differ from retained evidence`);

    const referencedExecLogRelPaths = new Set<string>();
    for (const call of cycle.calls) {
      const execution = parseJson<LiveAttemptExecutionEvidenceV3>(resolve(
        phaseDir,
        "attempts",
        call.attemptId,
        "execution-evidence.json",
      ), `${call.attemptId} execution evidence for exec-root audit`);
      for (const binding of [
        execution.effectiveContextManifest,
        execution.routeSidecar,
        execution.structuredOutputSidecar,
        execution.resultSidecar,
      ]) {
        if (binding !== null) referencedExecLogRelPaths.add(binding.relPath);
      }
    }
    validateLiveExecEvidenceRootV3(phaseDir, referencedExecLogRelPaths);

    const assertNoSuccessorIdentity = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const path = resolve(dir, name);
        const stat = lstatSync(path);
        requireCondition(!stat.isSymbolicLink(),
          `IMP-24D smoke root contains prohibited symlink in ${relativeFromRepository(repositoryRoot, path)}`);
        if (stat.isDirectory()) assertNoSuccessorIdentity(path);
        else requireCondition(!readFileSync(path).includes(IMP24_ROLE_QUALIFICATION_R2_EXECUTION_ID),
          `IMP-24D smoke root retains forbidden successor r2 identity in ${relativeFromRepository(repositoryRoot, path)}`);
      }
    };
    assertNoSuccessorIdentity(root);
  }
  requireCondition(readFileSync(markdownPath, "utf8") === renderImp24DTransportSmokeReportMarkdown(report),
    "IMP-24D transport-smoke markdown mirror drift");

  const finalCycle = report.cycles.at(-1)!;
  requireCondition(finalCycle.status === "PASS" && finalCycle.codexExecInvocations === 2,
    "retained PASS must prove one ChatGPT-authenticated codex exec per final-cycle smoke call");
  return Object.freeze({
    report,
    reportBytesSha256: sha256Hex(readFileSync(reportPath)),
    reportMarkdownBytesSha256: sha256Hex(readFileSync(markdownPath)),
    status: "PASS" as const,
    observabilityImplementationCommit: report.observabilityImplementationCommit,
    correctionCommit: report.correctionCommit,
    effectiveImplementationCommit: report.effectiveImplementationCommit,
    cycles: report.cycles.map((cycle) => ({
      executionId: cycle.executionId,
      stateRoot: cycle.stateRoot,
      implementationCommit: cycle.implementationCommit,
      implementationCiGateSha256: cycle.implementationCiGateSha256,
      implementationCiGateBytesSha256: cycle.implementationCiGateBytesSha256,
      calls: 2 as const,
      processDiagnosticsSetSha256: cycle.processDiagnosticsSetSha256,
      qualificationSemanticProjectionSha256: cycle.qualificationSemanticProjectionSha256,
      certificationSha256: cycle.certificationSha256,
      productionInstrumentSealSha256: cycle.productionInstrumentSealSha256,
      productionQualificationParitySha256: cycle.productionQualificationParitySha256,
      codexExecInvocations: cycle.codexExecInvocations,
      startedAt: cycle.startedAt,
      completedAt: cycle.completedAt,
    })),
    totalCalls: report.totalCalls,
    modelCalls: report.modelCalls as 2 | 3 | 4,
    apiCalls: 0 as const,
    finalImplementationCiGatePath: resolve(repositoryRoot, finalCycle.stateRoot, "implementation-ci-gate.json"),
  });
}

export function canonicalImp24DTransportSmokeReport(report: Imp24DTransportSmokeReportV1): string {
  validateImp24DTransportSmokeReport(report);
  return `${canonicalJson(report)}\n`;
}
