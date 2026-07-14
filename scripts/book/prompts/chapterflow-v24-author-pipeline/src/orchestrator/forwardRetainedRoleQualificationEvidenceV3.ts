/**
 * Durable, model-free verification of the exact IMP-24 V3 qualification run.
 *
 * A qualification result and role freeze are self-hashed summaries. They are
 * not sufficient evidence that the frozen canaries and holdouts were actually
 * judged. This verifier replays no model call. It instead reconstructs the
 * frozen schedule, every request, every exact inline envelope, every receipt,
 * every lane evaluation, every allowed infrastructure replay, every metric,
 * and the final 2/2/1 role selection from the retained live evidence bytes.
 */

import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import { canonicalJson, hashCanonical, sha256Hex } from "../contracts/contractUtil.js";
import {
  validateCodexProcessDiagnosticsV1,
  type CodexProcessDiagnosticsV1,
} from "./codexProcessDiagnostics.js";
import {
  IMP24_BASE_MAXIMUM_CALLS,
  IMP24_CANARY_CASES_PER_PROFILE_ROLE,
  IMP24_FROZEN_ROLE_THRESHOLDS,
  IMP24_HARD_MAXIMUM_CALLS,
  IMP24_MAX_PARALLEL,
  IMP24_ROLE_CANDIDATE_ORDER,
  IMP24_ROLE_QUALIFICATION_ATTEMPT_SCHEMA,
  IMP24_ROLE_QUALIFICATION_RECEIPT_SCHEMA,
  IMP24_ROLE_QUALIFICATION_REQUEST_SCHEMA,
  IMP24_ROLE_QUALIFICATION_RUNNER_SCHEMA,
  buildLegacyRoleQualificationPlanV3,
  buildRoleQualificationPlanV3,
  candidateAvailabilityProvenanceSha256,
  candidateAvailabilitySemanticProjectionV3,
  candidateAvailabilitySemanticSha256,
  qualificationReceiptSha256,
  qualificationRequestSha256,
  type CaseEvaluationV3,
  type ProfileRoleResultV3,
  type QualificationAttemptV3,
  type QualificationExecutionReceiptV3,
  type QualificationExecutionRequestV3,
  type QualificationOutputEvaluatorV3,
  type QualificationReceiptStatusV3,
  type QualificationScheduleEntryV3,
  type RoleMetricLedgerV3,
  type RoleQualificationRunnerResultV3,
  type RunRoleQualificationInputV3,
} from "../bakeoff/migration/roleQualificationRunnerV3.js";
import {
  IMP24_CORPUS_EXPECTED_COUNTS,
  IMP24_ROLE_QUALIFICATION_EXECUTION_ID,
  IMP24_ROLE_QUALIFICATION_R2_EXECUTION_ID,
  type Imp24ReviewRole,
} from "../bakeoff/migration/imp24Corpus.js";
import {
  REQUIRED_ROLE_SET_SCHEMA,
  ROLE_QUALIFICATION_OUTCOME_SCHEMA,
  ROLE_QUALIFICATION_REGISTRY_SCHEMA,
  type RoleMetricDenominatorsV1,
  type RoleMetricRatesV1,
  type RoleQualificationOutcomeV1,
  type RoleQualificationRegistryV1,
} from "../bakeoff/migration/reviewLaneTypes.js";
import {
  assembleJudgeQualification,
  assertRoleSetReady,
  qualifyRole,
} from "../bakeoff/migration/roleQualification.js";
import {
  IMP24_LIVE_ATTEMPT_EVALUATION_SCHEMA,
  IMP24_LIVE_EXECUTION_EVIDENCE_SCHEMA,
  IMP24_LIVE_ATTEMPT_RETENTION_SCHEMA,
  IMP24_LIVE_CALL_LEDGER_SCHEMA,
  IMP24_LIVE_PREFLIGHT_SCHEMA,
  buildAttemptEvaluationArtifact,
  fatalReceiptChronologyViolationsV3,
  replayReceiptChronologyViolationsV3,
  validateLiveExecEvidenceRootV3,
  validateExecutionEvidenceArtifact,
  validateLiveQualificationPreflightArtifactV3,
  validateQualificationReceiptArtifactV3,
  type LiveAttemptEvaluationV3,
  type LiveAttemptExecutionEvidenceV3,
  type LiveAttemptRetentionV3,
  type LiveCallLedgerV3,
  type LiveQualificationPreflightV3,
} from "./forwardRoleQualificationLiveV3.js";
import {
  validateForwardRoleAssignmentFreezeInternalV3,
  validateForwardRoleAssignmentFreezeV3,
  type ForwardRoleAssignmentFreezeV3,
  type ForwardV3RouteBinding,
} from "./forwardRoleAssignmentFreezeV3.js";
import {
  IMP24_REQUIRED_BRANCH,
  IMP24_CANDIDATE_AVAILABILITY_PROVENANCE_LEDGER_SCHEMA,
  IMP24_ROLE_QUALIFICATION_CAMPAIGN_REPORT_SCHEMA,
  validateImp24ImplementationCiGate,
  type Imp24ImplementationCiGateV1,
  type Imp24CandidateAvailabilityProvenanceLedgerV1,
  type Imp24RoleQualificationCampaignReportV1,
} from "./forwardRoleQualificationCampaignV3.js";

export const IMP24_RETAINED_ROLE_QUALIFICATION_EVIDENCE_PROOF_SCHEMA =
  "imp24-retained-role-qualification-evidence-proof-v1" as const;

const ROLES = ["reader", "source", "quiz"] as const satisfies readonly Imp24ReviewRole[];
type RetainedQualificationExecutionId =
  | typeof IMP24_ROLE_QUALIFICATION_EXECUTION_ID
  | typeof IMP24_ROLE_QUALIFICATION_R2_EXECUTION_ID;
const REQUIRED_QUALIFIERS: Readonly<Record<Imp24ReviewRole, number>> = Object.freeze({
  reader: 2,
  source: 2,
  quiz: 1,
});
const INFRASTRUCTURE_REPLAY_STATUSES = new Set<QualificationReceiptStatusV3>([
  "timeout",
  "provider_capacity",
  "transient_execution_failure",
]);
const RECEIPT_STATUSES = new Set<QualificationReceiptStatusV3>([
  "completed",
  "timeout",
  "provider_capacity",
  "transient_execution_failure",
  "refusal",
  "policy_failure",
  "invalid_output",
  "integrity_failure",
]);
const SHA256 = /^[a-f0-9]{64}$/;
const VERIFIED_RETAINED_QUALIFICATION = Symbol("verified-retained-role-qualification-v3");

export class ForwardRetainedRoleQualificationEvidenceV3Error extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ForwardRetainedRoleQualificationEvidenceV3Error";
  }
}

function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new ForwardRetainedRoleQualificationEvidenceV3Error(message);
}

function requireSha(value: unknown, label: string): asserts value is string {
  requireCondition(typeof value === "string" && SHA256.test(value), `${label} must be a lowercase sha256`);
}

function requireExactObjectKeys(value: unknown, keys: string[], label: string): asserts value is Record<string, unknown> {
  requireCondition(value !== null && typeof value === "object" && !Array.isArray(value),
    `${label} must be an object`);
  requireCondition(hashCanonical(Object.keys(value).sort()) === hashCanonical([...keys].sort()),
    `${label} has missing or unexpected fields`);
}

function prettyJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function parseExactJson<T>(path: string, label: string, serialization: "canonical" | "pretty"): T {
  requireCondition(existsSync(path), `${label} is not retained at ${path}`);
  const bytes = readFileSync(path, "utf8");
  let value: T;
  try {
    value = JSON.parse(bytes) as T;
  } catch (error) {
    throw new ForwardRetainedRoleQualificationEvidenceV3Error(
      `${label} is not valid retained JSON at ${path}: ${(error as Error).message}`,
    );
  }
  const expected = serialization === "canonical" ? `${canonicalJson(value)}\n` : prettyJson(value);
  requireCondition(bytes === expected, `${label} bytes are not the exact production JSON serialization`);
  return value;
}

function hashWithout(value: Record<string, unknown>, field: string): string {
  const copy = { ...value };
  delete copy[field];
  return hashCanonical(copy);
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): Readonly<T> {
  if (value !== null && typeof value === "object") {
    const object = value as object;
    if (!seen.has(object)) {
      seen.add(object);
      for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child, seen);
      Object.freeze(object);
    }
  }
  return value;
}

function protocolValid(evaluation: CaseEvaluationV3 | null): boolean {
  return evaluation !== null
    && evaluation.schemaValid
    && evaluation.envelopeBound
    && evaluation.evidenceReferenceValid
    && evaluation.authorityCompliant
    && evaluation.complete
    && !evaluation.fileAccessFailure
    && !evaluation.prohibitedConductorEcho;
}

function fileAccessFailure(raw: string): boolean {
  return /(?:could not|cannot|can't|unable to|failed to)\s+(?:open|read|access).{0,80}(?:file|path|workspace)|file (?:was|is) not (?:available|found|accessible)/i.test(raw);
}

function prohibitedEcho(raw: string, role: Imp24ReviewRole): boolean {
  const keys = role === "source"
    ? ["unitId", "expectedOrigin", "expectedForm", "claimStrengthExpected", "blockingFindingIds"]
    : role === "quiz"
      ? ["itemId", "keyedAnswerIndex", "derivedAnswerIndex", "agreement"]
      : ["chapterContentSha256", "readerDocumentSha256", "schemaSha256"];
  return keys.some((key) => new RegExp(`"${key}"\\s*:`).test(raw));
}

function expectedRequest(args: {
  entry: QualificationScheduleEntryV3;
  input: RunRoleQualificationInputV3;
  freezeSha256: string;
  attemptNumber: 1 | 2;
  executionId: RetainedQualificationExecutionId;
}): QualificationExecutionRequestV3 {
  const { entry, input, attemptNumber } = args;
  const prepared = input.preparedCases[entry.role][entry.partition][entry.caseOrdinal];
  const candidate = IMP24_ROLE_CANDIDATE_ORDER[entry.role][entry.candidateOrdinal];
  requireCondition(prepared !== undefined && candidate !== undefined,
    `${entry.scheduleId}: frozen prepared case/profile is missing`);
  const attemptId = `${entry.scheduleId}-a${attemptNumber}`;
  const core: Omit<QualificationExecutionRequestV3, "requestSha256"> = {
    schema: IMP24_ROLE_QUALIFICATION_REQUEST_SCHEMA,
    experimentId: args.executionId as typeof IMP24_ROLE_QUALIFICATION_EXECUTION_ID,
    scheduleId: entry.scheduleId,
    attemptId,
    replayOfAttemptId: attemptNumber === 2 ? `${entry.scheduleId}-a1` : null,
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
    freezeSha256: args.freezeSha256,
    certificationSha256: input.certification.certificationSha256,
    productionInstrumentSealSha256: input.productionInstrumentSeal.sealSha256,
    reviewProtocol: "review-evidence-envelope-v1",
    evidenceEnvelopeSha256: prepared.envelope.envelopeSha256,
    evidenceEnvelopeBytesSha256: prepared.evidenceEnvelopeBytesSha256,
    evidenceEnvelopeBytes: prepared.evidenceEnvelopeBytes,
    task: prepared.task,
  };
  return { ...core, requestSha256: qualificationRequestSha256(core) };
}

function validateReceipt(
  request: QualificationExecutionRequestV3,
  receipt: QualificationExecutionReceiptV3,
  label: string,
): void {
  validateQualificationReceiptArtifactV3({ request, receipt, label });
  requireCondition(typeof receipt.executionId === "string" && receipt.executionId.length > 0,
    `${label}: receipt execution id is empty`);
  requireCondition(RECEIPT_STATUSES.has(receipt.status), `${label}: unknown receipt status ${receipt.status}`);
  requireCondition(receipt.status !== "completed" || typeof receipt.rawOutput === "string",
    `${label}: completed receipt lacks exact raw output`);
}

function recomputeAttempt(args: {
  attempt: QualificationAttemptV3;
  entry: QualificationScheduleEntryV3;
  input: RunRoleQualificationInputV3;
  evaluateOutput: QualificationOutputEvaluatorV3;
  liveDir: string;
  freezeSha256: string;
  preflight: LiveQualificationPreflightV3;
  executionId: RetainedQualificationExecutionId;
}): {
  attempt: QualificationAttemptV3;
  retentionSha256: string;
  processDiagnostics: CodexProcessDiagnosticsV1;
  processDiagnosticsSha256: string;
  executionEvidence: LiveAttemptExecutionEvidenceV3;
  executionEvidenceSha256: string;
  executionSidecarRelPaths: string[];
  evaluationArtifactSha256: string;
} {
  const attemptNumber = args.attempt.request.attemptNumber;
  requireCondition(attemptNumber === 1 || attemptNumber === 2,
    `${args.entry.scheduleId}: invalid attempt number`);
  const request = expectedRequest({
    entry: args.entry,
    input: args.input,
    freezeSha256: args.freezeSha256,
    attemptNumber,
    executionId: args.executionId,
  });
  requireCondition(hashCanonical(args.attempt.request) === hashCanonical(request),
    `${request.attemptId}: retained result request differs from the frozen schedule/input`);
  const attemptDir = resolve(args.liveDir, "attempts", request.attemptId);
  requireCondition(attemptDir.startsWith(`${resolve(args.liveDir, "attempts")}/`),
    `${request.attemptId}: retained attempt path escapes the qualification phase`);
  const names = existsSync(attemptDir) ? readdirSync(attemptDir).sort() : [];
  requireCondition(hashCanonical(names) === hashCanonical([
    "evaluation.json", "evidence-envelope.json", "execution-evidence.json", "process-diagnostics.json",
    "receipt.json", "request.json", "retention.json",
  ]), `${request.attemptId}: retained attempt has missing or extra evidence files`);
  const attemptStat = lstatSync(attemptDir);
  requireCondition(attemptStat.isDirectory() && !attemptStat.isSymbolicLink(),
    `${request.attemptId}: retained attempt directory must not be a symlink`);
  for (const name of names) {
    const evidenceStat = lstatSync(resolve(attemptDir, name));
    requireCondition(evidenceStat.isFile() && !evidenceStat.isSymbolicLink(),
      `${request.attemptId}: retained ${name} must be a regular non-symlink file`);
  }
  const retainedRequest = parseExactJson<QualificationExecutionRequestV3>(resolve(attemptDir, "request.json"),
    `${request.attemptId} request`, "pretty");
  requireCondition(hashCanonical(retainedRequest) === hashCanonical(request),
    `${request.attemptId}: exact retained request differs from the frozen request`);
  const envelopeBytes = readFileSync(resolve(attemptDir, "evidence-envelope.json"), "utf8");
  requireCondition(envelopeBytes === request.evidenceEnvelopeBytes
      && sha256Hex(envelopeBytes) === request.evidenceEnvelopeBytesSha256,
    `${request.attemptId}: exact retained evidence-envelope bytes drift`);
  const receipt = parseExactJson<QualificationExecutionReceiptV3>(resolve(attemptDir, "receipt.json"),
    `${request.attemptId} receipt`, "pretty");
  validateReceipt(request, receipt, request.attemptId);
  requireCondition(args.attempt.receipt !== null
      && hashCanonical(args.attempt.receipt) === hashCanonical(receipt),
    `${request.attemptId}: qualification result receipt differs from retained receipt bytes`);
  const processDiagnostics = parseExactJson<CodexProcessDiagnosticsV1>(
    resolve(attemptDir, "process-diagnostics.json"),
    `${request.attemptId} process diagnostics`,
    "pretty",
  );
  validateCodexProcessDiagnosticsV1(processDiagnostics, {
    attemptId: request.attemptId,
    requestSha256: request.requestSha256,
    classification: receipt.status,
  });
  const executionEvidence = parseExactJson<LiveAttemptExecutionEvidenceV3>(
    resolve(attemptDir, "execution-evidence.json"),
    `${request.attemptId} execution evidence`,
    "pretty",
  );
  requireCondition(executionEvidence.schema === IMP24_LIVE_EXECUTION_EVIDENCE_SCHEMA,
    `${request.attemptId}: execution evidence schema mismatch`);
  validateExecutionEvidenceArtifact({
    phaseDir: args.liveDir,
    request,
    receipt,
    processDiagnostics,
    artifact: executionEvidence,
    preflight: args.preflight,
  });

  const retention = parseExactJson<LiveAttemptRetentionV3>(resolve(attemptDir, "retention.json"),
    `${request.attemptId} retention`, "pretty");
  requireExactObjectKeys(retention, [
    "schema", "requestSha256", "receiptSha256", "evidenceEnvelopeSha256",
    "evidenceEnvelopeBytesSha256", "processDiagnosticsSha256", "executionEvidenceSha256",
    "request", "receipt", "retentionSha256",
  ], `${request.attemptId} retention`);
  requireCondition(retention.schema === IMP24_LIVE_ATTEMPT_RETENTION_SCHEMA,
    `${request.attemptId}: attempt retention schema mismatch`);
  const { retentionSha256, ...retentionCore } = retention;
  requireSha(retentionSha256, `${request.attemptId} retention hash`);
  requireCondition(retentionSha256 === hashCanonical(retentionCore)
      && retention.requestSha256 === request.requestSha256
      && retention.receiptSha256 === receipt.receiptSha256
      && retention.evidenceEnvelopeSha256 === request.evidenceEnvelopeSha256
      && retention.evidenceEnvelopeBytesSha256 === request.evidenceEnvelopeBytesSha256
      && retention.processDiagnosticsSha256 === processDiagnostics.diagnosticsSha256
      && retention.executionEvidenceSha256 === executionEvidence.executionEvidenceSha256
      && hashCanonical(retention.request) === hashCanonical(request)
      && hashCanonical(retention.receipt) === hashCanonical(receipt),
    `${request.attemptId}: retained request/envelope/receipt binding drift`);

  let evaluation: CaseEvaluationV3 | null = null;
  let terminalReason: string;
  if (receipt.status === "completed") {
    try {
      const preparedCase = args.input.preparedCases[request.role][request.partition][args.entry.caseOrdinal];
      evaluation = args.evaluateOutput({ preparedCase, request, receipt, rawOutput: receipt.rawOutput ?? "" });
      evaluation = {
        ...evaluation,
        fileAccessFailure: evaluation.fileAccessFailure || fileAccessFailure(receipt.rawOutput ?? ""),
        prohibitedConductorEcho: evaluation.prohibitedConductorEcho || prohibitedEcho(receipt.rawOutput ?? "", request.role),
      };
      terminalReason = protocolValid(evaluation) ? "completed" : "completed with protocol-invalid output";
    } catch (error) {
      terminalReason = `completed with invalid output: ${(error as Error).message}`;
    }
  } else {
    terminalReason = `${receipt.status}: ${receipt.failureDetail ?? ""}`.trim();
  }
  const replayEligible = INFRASTRUCTURE_REPLAY_STATUSES.has(receipt.status);
  const recomputed: QualificationAttemptV3 = {
    schema: IMP24_ROLE_QUALIFICATION_ATTEMPT_SCHEMA,
    scheduleOrdinal: args.entry.ordinal,
    request,
    receipt,
    routeValid: true,
    replayEligible,
    evaluation,
    protocolValid: receipt.status === "completed" && protocolValid(evaluation),
    semanticCorrect: evaluation?.semanticCorrect ?? null,
    rawOutputSha256: typeof receipt.rawOutput === "string" ? sha256Hex(receipt.rawOutput) : null,
    retainedEnvelopeBytes: request.evidenceEnvelopeBytes,
    retainedEnvelopeBytesSha256: request.evidenceEnvelopeBytesSha256,
    terminalReason,
  };
  requireCondition(hashCanonical(args.attempt) === hashCanonical(recomputed),
    `${request.attemptId}: retained attempt classification is not derived from its exact raw receipt`);
  const evaluationArtifact = parseExactJson<LiveAttemptEvaluationV3>(resolve(attemptDir, "evaluation.json"),
    `${request.attemptId} evaluation`, "pretty");
  requireCondition(evaluationArtifact.schema === IMP24_LIVE_ATTEMPT_EVALUATION_SCHEMA,
    `${request.attemptId}: attempt evaluation schema mismatch`);
  const { evaluationArtifactSha256, ...evaluationArtifactCore } = evaluationArtifact;
  requireSha(evaluationArtifactSha256, `${request.attemptId} evaluation artifact hash`);
  requireCondition(evaluationArtifactSha256 === hashCanonical(evaluationArtifactCore),
    `${request.attemptId}: attempt evaluation self hash drift`);
  const expectedEvaluationArtifact = buildAttemptEvaluationArtifact(
    recomputed,
    executionEvidence.executionEvidenceSha256,
  );
  requireCondition(hashCanonical(evaluationArtifact) === hashCanonical(expectedEvaluationArtifact),
    `${request.attemptId}: parsed output/conductor assembly/reference resolution differs from exact recomputation`);
  return {
    attempt: recomputed,
    retentionSha256,
    processDiagnostics,
    processDiagnosticsSha256: processDiagnostics.diagnosticsSha256,
    executionEvidence,
    executionEvidenceSha256: executionEvidence.executionEvidenceSha256,
    executionSidecarRelPaths: [
      executionEvidence.effectiveContextManifest,
      executionEvidence.routeSidecar,
      executionEvidence.structuredOutputSidecar,
      executionEvidence.resultSidecar,
    ].filter((binding): binding is NonNullable<typeof binding> => binding !== null).map((binding) => binding.relPath),
    evaluationArtifactSha256,
  };
}

type Counter = { numerator: number; denominator: number };

function scoreHoldout(role: Imp24ReviewRole, attempts: readonly QualificationAttemptV3[]): RoleMetricLedgerV3 {
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
      requireCondition(!["schemaValidity", "evidenceSpanValidity", "requiredCasesResolved"].includes(metricId),
        `${attempt.request.caseId}: evaluator overrode conductor-owned metric ${metricId}`);
      requireCondition(Object.hasOwn(IMP24_FROZEN_ROLE_THRESHOLDS[role], metricId),
        `${attempt.request.caseId}: evaluator emitted unknown ${role} metric ${metricId}`);
      requireCondition(typeof success === "boolean", `${attempt.request.caseId}: metric ${metricId} is not boolean`);
      increment(metricId, success);
    }
  }
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

function recomputeProfileResults(args: {
  input: RunRoleQualificationInputV3;
  schedule: readonly QualificationScheduleEntryV3[];
  attempts: readonly QualificationAttemptV3[];
}): { profileRoleResults: ProfileRoleResultV3[]; qualifiers: Record<Imp24ReviewRole, string[]> } {
  const qualifiers: Record<Imp24ReviewRole, string[]> = { reader: [], source: [], quiz: [] };
  const profileRoleResults: ProfileRoleResultV3[] = [];
  const bySchedule = new Map<string, QualificationAttemptV3[]>();
  for (const attempt of args.attempts) {
    const values = bySchedule.get(attempt.request.scheduleId) ?? [];
    values.push(attempt);
    bySchedule.set(attempt.request.scheduleId, values);
  }
  const finalFor = (entry: QualificationScheduleEntryV3): QualificationAttemptV3 => {
    const attempts = (bySchedule.get(entry.scheduleId) ?? [])
      .sort((left, right) => left.request.attemptNumber - right.request.attemptNumber);
    requireCondition(attempts.length >= 1 && attempts.length <= 2,
      `${entry.scheduleId}: executed base case has an invalid attempt count`);
    requireCondition(attempts[0].request.attemptNumber === 1,
      `${entry.scheduleId}: first retained execution is not attempt 1`);
    if (attempts[0].replayEligible) {
      requireCondition(attempts.length === 2 && attempts[1].request.attemptNumber === 2,
        `${entry.scheduleId}: route-valid infrastructure failure lacks its one authorized replay`);
    } else {
      requireCondition(attempts.length === 1,
        `${entry.scheduleId}: valid/content/protocol judgment was replayed`);
    }
    return attempts.at(-1)!;
  };

  for (const role of ROLES) {
    for (let candidateOrdinal = 0; candidateOrdinal < IMP24_ROLE_CANDIDATE_ORDER[role].length; candidateOrdinal += 1) {
      const candidate = IMP24_ROLE_CANDIDATE_ORDER[role][candidateOrdinal];
      const availability = args.input.candidateAvailability.entries.find((entry) =>
        entry.role === role && entry.ordinal === candidateOrdinal)!;
      const profileAttempts = args.attempts.filter((attempt) =>
        attempt.request.role === role && attempt.request.profileId === candidate.profileId);
      if (qualifiers[role].length >= REQUIRED_QUALIFIERS[role]) {
        requireCondition(profileAttempts.length === 0,
          `${role}/${candidate.profileId}: sequentially stopped profile has retained model calls`);
        profileRoleResults.push({
          role,
          candidateOrdinal,
          profile: candidate,
          availability: availability.status,
          status: "NOT_TESTED_SEQUENTIAL_STOP",
          canaryStarted: false,
          canaryCaseCount: 0,
          canaryProtocolPassed: false,
          canarySemanticCorrectCount: 0,
          holdoutStarted: false,
          holdoutCaseCount: 0,
          attempts: 0,
          metrics: null,
          outcome: notTested(role),
        });
        continue;
      }
      if (availability.status === "UNAVAILABLE") {
        requireCondition(profileAttempts.length === 0,
          `${role}/${candidate.profileId}: unavailable profile has retained model calls`);
        profileRoleResults.push({
          role,
          candidateOrdinal,
          profile: candidate,
          availability: "UNAVAILABLE",
          status: "UNAVAILABLE",
          canaryStarted: false,
          canaryCaseCount: 0,
          canaryProtocolPassed: false,
          canarySemanticCorrectCount: 0,
          holdoutStarted: false,
          holdoutCaseCount: 0,
          attempts: 0,
          metrics: null,
          outcome: notTested(role),
        });
        continue;
      }
      const canaryEntries = args.schedule.filter((entry) => entry.role === role
        && entry.candidateOrdinal === candidateOrdinal && entry.partition === "canary");
      requireCondition(canaryEntries.length === IMP24_CANARY_CASES_PER_PROFILE_ROLE,
        `${role}/${candidate.profileId}: frozen canary denominator drift`);
      const canaries = canaryEntries.map(finalFor);
      const canaryProtocolPassed = canaries.every((attempt) => attempt.protocolValid);
      const canarySemanticCorrectCount = canaries.filter((attempt) => attempt.semanticCorrect === true).length;
      if (!canaryProtocolPassed) {
        requireCondition(profileAttempts.every((attempt) => attempt.request.partition === "canary"),
          `${role}/${candidate.profileId}: protocol-failed canary was followed by holdout calls`);
        profileRoleResults.push({
          role,
          candidateOrdinal,
          profile: candidate,
          availability: "AVAILABLE",
          status: "NOT_QUALIFIED_PROTOCOL",
          canaryStarted: true,
          canaryCaseCount: 2,
          canaryProtocolPassed: false,
          canarySemanticCorrectCount,
          holdoutStarted: false,
          holdoutCaseCount: 0,
          attempts: profileAttempts.length,
          metrics: null,
          outcome: protocolFailure(role),
        });
        continue;
      }
      const holdoutEntries = args.schedule.filter((entry) => entry.role === role
        && entry.candidateOrdinal === candidateOrdinal && entry.partition === "holdout");
      requireCondition(holdoutEntries.length === IMP24_CORPUS_EXPECTED_COUNTS[role].holdout,
        `${role}/${candidate.profileId}: frozen holdout denominator drift`);
      const holdouts = holdoutEntries.map(finalFor);
      const metrics = scoreHoldout(role, holdouts);
      const outcome = qualifyRole(role, metrics.metrics, args.input.thresholds, metrics.denominators);
      const status: ProfileRoleResultV3["status"] = outcome.status === "QUALIFIED"
        ? "QUALIFIED"
        : outcome.refusedUnderpowered
          ? "NOT_TESTED_UNDERPOWERED"
          : "NOT_QUALIFIED";
      profileRoleResults.push({
        role,
        candidateOrdinal,
        profile: candidate,
        availability: "AVAILABLE",
        status,
        canaryStarted: true,
        canaryCaseCount: 2,
        canaryProtocolPassed: true,
        canarySemanticCorrectCount,
        holdoutStarted: true,
        holdoutCaseCount: holdouts.length,
        attempts: profileAttempts.length,
        metrics,
        outcome,
      });
      if (status === "QUALIFIED") qualifiers[role].push(candidate.profileId);
    }
  }
  return { profileRoleResults, qualifiers };
}

function uniqueProfiles() {
  const seen = new Set<string>();
  const output = [] as Array<(typeof IMP24_ROLE_CANDIDATE_ORDER)[Imp24ReviewRole][number]>;
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

function recomputeResult(args: {
  input: RunRoleQualificationInputV3;
  retained: RoleQualificationRunnerResultV3;
  attempts: QualificationAttemptV3[];
  schedule: QualificationScheduleEntryV3[];
  executionId: RetainedQualificationExecutionId;
}): RoleQualificationRunnerResultV3 {
  const { profileRoleResults, qualifiers } = recomputeProfileResults(args);
  const qualifiedAtValues = new Set(args.retained.registry.profiles.map((profile) => profile.qualifiedAt));
  requireCondition(qualifiedAtValues.size === 1, "retained V3 registry has inconsistent qualifiedAt values");
  const qualifiedAt = [...qualifiedAtValues][0];
  requireCondition(Number.isFinite(Date.parse(qualifiedAt)), "retained V3 registry qualifiedAt is invalid");
  const outcomeFor = (profileId: string, role: Imp24ReviewRole): RoleQualificationOutcomeV1 =>
    profileRoleResults.find((item) => item.role === role && item.profile.profileId === profileId)?.outcome
      ?? notTested(role);
  const registry: RoleQualificationRegistryV1 = {
    schema: ROLE_QUALIFICATION_REGISTRY_SCHEMA,
    profiles: uniqueProfiles().map((candidate) => assembleJudgeQualification({
      profileId: candidate.profileId,
      model: candidate.model,
      effort: candidate.effort,
      readerOutcome: outcomeFor(candidate.profileId, "reader"),
      sourceOutcome: outcomeFor(candidate.profileId, "source"),
      quizOutcome: outcomeFor(candidate.profileId, "quiz"),
      securityBoundary: "NOT_TESTED",
      evidenceHashes: args.attempts
        .filter((attempt) => attempt.request.profileId === candidate.profileId)
        .flatMap((attempt) => [
          attempt.request.evidenceEnvelopeSha256,
          ...(attempt.rawOutputSha256 ? [attempt.rawOutputSha256] : []),
        ]),
      corpusHashes: ROLES.map((role) => args.input.corpusBundle[role].substantiveCorpusSha256),
      instrumentHashes: [
        args.retained.freeze.freezeSha256,
        args.retained.freeze.certificationSha256,
        args.retained.freeze.productionInstrumentSealSha256,
      ],
      qualifiedAt,
    })),
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
  const baseCallsAttempted = new Set(args.attempts.map((attempt) => attempt.request.scheduleId)).size;
  const infrastructureReplays = args.attempts.filter((attempt) => attempt.request.attemptNumber === 2).length;
  const maxPlanEvents = args.attempts.filter((attempt) => attempt.receipt?.status === "provider_capacity").length;
  return {
    schema: IMP24_ROLE_QUALIFICATION_RUNNER_SCHEMA,
    experimentId: args.executionId as typeof IMP24_ROLE_QUALIFICATION_EXECUTION_ID,
    freeze: args.retained.freeze,
    schedule: args.schedule,
    attempts: args.attempts,
    profileRoleResults,
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
    maxPlanEvents,
    totalAttempts: args.attempts.length,
    firstLiveRequestSha256: args.attempts[0]?.request.requestSha256 ?? null,
  };
}

function validatePreflight(
  preflight: LiveQualificationPreflightV3,
  input: RunRoleQualificationInputV3,
  freezeSha256: string,
  executionId: RetainedQualificationExecutionId,
): void {
  const historicalR2 = executionId === IMP24_ROLE_QUALIFICATION_R2_EXECUTION_ID;
  const hasImp24eAvailabilityBinding = preflight.candidateAvailabilitySemanticSha256 !== undefined
    || preflight.candidateAvailabilityProvenanceSha256 !== undefined;
  if (!historicalR2) {
    requireSha(input.candidateAvailability.semanticSha256,
      "certified qualification candidate availability semantic hash");
    requireSha(input.candidateAvailability.provenanceSha256,
      "certified qualification candidate availability provenance hash");
    requireCondition(hasImp24eAvailabilityBinding,
      "active FINAL retained qualification preflight omits IMP-24E availability bindings");
  }
  requireExactObjectKeys(preflight, [
    "schema", "experimentId", "verifiedAt", "freezeSha256", "certificationSha256",
    "productionInstrumentSealSha256", "corpusBundleSha256", "candidateAvailabilitySha256",
    ...(hasImp24eAvailabilityBinding
      ? ["candidateAvailabilitySemanticSha256", "candidateAvailabilityProvenanceSha256"]
      : []),
    "candidateAvailabilitySourceBytesSha256", "cliVersion", "cliBinary", "cliSynthetic",
    "executionProfileHash", "routePolicyVersion", "executionRoute", "authMode", "apiKeyPresent",
    "apiFallbackAllowed", "directHttpOrSdkAllowed", "forbiddenProviderEnvKeysPresent",
    "baseMaximumCalls", "hardMaximumCalls", "preflightSha256",
  ], "retained qualification preflight");
  validateLiveQualificationPreflightArtifactV3(preflight, executionId);
  requireCondition(preflight.schema === IMP24_LIVE_PREFLIGHT_SCHEMA
      && preflight.experimentId === executionId,
    "retained qualification preflight identity mismatch");
  const { preflightSha256, ...core } = preflight;
  requireSha(preflightSha256, "retained qualification preflight hash");
  requireCondition(preflightSha256 === hashCanonical(core), "retained qualification preflight self hash drift");
  const expectedAvailabilityIdentity = historicalR2 && !hasImp24eAvailabilityBinding
    ? input.candidateAvailability.availabilitySha256
    : candidateAvailabilitySemanticSha256(input.candidateAvailability);
  requireCondition(preflight.freezeSha256 === freezeSha256
      && preflight.certificationSha256 === input.certification.certificationSha256
      && preflight.productionInstrumentSealSha256 === input.productionInstrumentSeal.sealSha256
      && preflight.corpusBundleSha256 === input.corpusBundle.substantiveBundleSha256
      && preflight.candidateAvailabilitySha256 === expectedAvailabilityIdentity
      && (!hasImp24eAvailabilityBinding
        || preflight.candidateAvailabilitySemanticSha256 === expectedAvailabilityIdentity
          && preflight.candidateAvailabilityProvenanceSha256
            === input.candidateAvailability.provenanceSha256)
      && preflight.candidateAvailabilitySourceBytesSha256 === input.candidateAvailability.sourceBytesSha256,
    "retained qualification preflight belongs to different frozen inputs");
  requireCondition(preflight.executionRoute === "codex_exec_chatgpt_subscription"
      && preflight.authMode === "chatgpt"
      && preflight.apiKeyPresent === false
      && preflight.apiFallbackAllowed === false
      && preflight.directHttpOrSdkAllowed === false
      && Array.isArray(preflight.forbiddenProviderEnvKeysPresent)
      && preflight.forbiddenProviderEnvKeysPresent.length === 0
      && preflight.cliSynthetic === false
      && typeof preflight.cliVersion === "string" && preflight.cliVersion.trim().length > 0
      && typeof preflight.cliBinary === "string" && preflight.cliBinary.trim().length > 0
      && preflight.baseMaximumCalls === IMP24_BASE_MAXIMUM_CALLS
      && preflight.hardMaximumCalls === IMP24_HARD_MAXIMUM_CALLS,
    "retained qualification preflight is not the fixed ChatGPT-only 464/928 route");
  requireCondition(typeof preflight.verifiedAt === "string"
      && Number.isFinite(Date.parse(preflight.verifiedAt))
      && new Date(preflight.verifiedAt).toISOString() === preflight.verifiedAt,
    "retained qualification preflight verifiedAt must be an exact canonical ISO timestamp");
}

function validateLedger(args: {
  ledger: LiveCallLedgerV3;
  result: RoleQualificationRunnerResultV3;
  attempts: readonly QualificationAttemptV3[];
  processDiagnosticsByAttempt: ReadonlyMap<string, CodexProcessDiagnosticsV1>;
  executionEvidenceByAttempt: ReadonlyMap<string, LiveAttemptExecutionEvidenceV3>;
  executionId: RetainedQualificationExecutionId;
}): void {
  const { ledger, result, attempts } = args;
  requireExactObjectKeys(ledger, [
    "schema", "experimentId", "freezeSha256", "certificationSha256",
    "productionInstrumentSealSha256", "entries", "brokerRequests", "codexExecInvocations",
    "cachedReceipts", "infrastructureReplays", "maxPlanCapacityEvents", "apiCallsMade",
  ], "retained qualification call ledger");
  requireCondition(Array.isArray(ledger.entries), "retained qualification call ledger entries must be an array");
  for (const entry of ledger.entries) {
    requireExactObjectKeys(entry, [
      "attemptId", "scheduleId", "requestSha256", "evidenceEnvelopeSha256",
      "evidenceEnvelopeBytesSha256", "receiptSha256", "processDiagnosticsSha256", "executionEvidenceSha256",
      "evaluationArtifactSha256", "status", "cached", "requestedAt", "completedAt",
    ], "retained qualification call-ledger entry");
  }
  for (const [label, value] of [
    ["brokerRequests", ledger.brokerRequests],
    ["codexExecInvocations", ledger.codexExecInvocations],
    ["cachedReceipts", ledger.cachedReceipts],
    ["infrastructureReplays", ledger.infrastructureReplays],
    ["maxPlanCapacityEvents", ledger.maxPlanCapacityEvents],
    ["apiCallsMade", ledger.apiCallsMade],
  ] as const) {
    requireCondition(typeof value === "number" && Number.isSafeInteger(value) && value >= 0,
      `retained qualification call ledger ${label} must be a non-negative safe integer`);
  }
  requireCondition(ledger.schema === IMP24_LIVE_CALL_LEDGER_SCHEMA
      && ledger.experimentId === args.executionId
      && ledger.freezeSha256 === result.freeze.freezeSha256
      && ledger.certificationSha256 === result.freeze.certificationSha256
      && ledger.productionInstrumentSealSha256 === result.freeze.productionInstrumentSealSha256
      && ledger.apiCallsMade === 0,
    "retained qualification call ledger identity/input binding mismatch");
  requireCondition(ledger.entries.length === attempts.length
      && ledger.brokerRequests === attempts.length,
    "retained qualification call ledger does not contain exactly one entry per attempt");
  requireCondition(new Set(ledger.entries.map((entry) => entry.attemptId)).size === ledger.entries.length,
    "retained qualification call ledger contains duplicate attempt identities");
  const byAttempt = new Map(attempts.map((attempt) => [attempt.request.attemptId, attempt]));
  for (const entry of ledger.entries) {
    const attempt = byAttempt.get(entry.attemptId);
    const processDiagnostics = args.processDiagnosticsByAttempt.get(entry.attemptId);
    const executionEvidence = args.executionEvidenceByAttempt.get(entry.attemptId);
    requireCondition(attempt !== undefined && attempt.receipt !== null,
      `${entry.attemptId}: ledger entry has no exact recomputed attempt`);
    requireCondition(executionEvidence !== undefined,
      `${entry.attemptId}: ledger entry has no exact execution-evidence artifact`);
    requireCondition(processDiagnostics !== undefined,
      `${entry.attemptId}: ledger entry has no exact process-diagnostics artifact`);
    requireCondition(entry.scheduleId === attempt.request.scheduleId
        && entry.requestSha256 === attempt.request.requestSha256
        && entry.evidenceEnvelopeSha256 === attempt.request.evidenceEnvelopeSha256
        && entry.evidenceEnvelopeBytesSha256 === attempt.request.evidenceEnvelopeBytesSha256
        && entry.receiptSha256 === attempt.receipt.receiptSha256
        && entry.processDiagnosticsSha256 === processDiagnostics.diagnosticsSha256
        && entry.executionEvidenceSha256 === executionEvidence.executionEvidenceSha256
        && entry.evaluationArtifactSha256 === buildAttemptEvaluationArtifact(
          attempt,
          executionEvidence.executionEvidenceSha256,
        ).evaluationArtifactSha256
        && entry.status === attempt.receipt.status,
      `${entry.attemptId}: ledger request/envelope/receipt/execution/evaluation binding drift`);
    requireCondition(typeof entry.requestedAt === "string"
        && Number.isFinite(Date.parse(entry.requestedAt))
        && new Date(entry.requestedAt).toISOString() === entry.requestedAt
        && entry.completedAt !== null
        && typeof entry.completedAt === "string"
        && Number.isFinite(Date.parse(entry.completedAt))
        && new Date(entry.completedAt).toISOString() === entry.completedAt
        && Date.parse(entry.completedAt) >= Date.parse(entry.requestedAt),
      `${entry.attemptId}: ledger timing evidence is invalid`);
    requireCondition(typeof entry.cached === "boolean", `${entry.attemptId}: ledger cached marker is invalid`);
  }
  const fatalChronologyViolations = fatalReceiptChronologyViolationsV3(ledger);
  requireCondition(fatalChronologyViolations.length === 0,
    `retained qualification proves request(s) opened after the first completed campaign-fatal receipt: ${fatalChronologyViolations.join(", ")}`);
  const ledgerByAttemptId = new Map(ledger.entries.map((entry) => [entry.attemptId, entry]));
  for (const attempt of attempts) {
    if (attempt.request.attemptNumber !== 2) continue;
    const replayEntry = ledgerByAttemptId.get(attempt.request.attemptId);
    const predecessorId = attempt.request.replayOfAttemptId;
    const predecessorEntry = predecessorId === null ? undefined : ledgerByAttemptId.get(predecessorId);
    requireCondition(replayEntry !== undefined && predecessorEntry !== undefined,
      `${attempt.request.attemptId}: retained replay lacks one exact ledger predecessor`);
  }
  const replayChronologyViolations = replayReceiptChronologyViolationsV3(ledger);
  requireCondition(replayChronologyViolations.length === 0,
    `retained qualification replay chronology is invalid: ${replayChronologyViolations.join(", ")}`);
  const replayCount = attempts.filter((attempt) => attempt.request.attemptNumber === 2).length;
  const maxPlanCapacityEvents = attempts
    .filter((attempt) => attempt.receipt?.status === "provider_capacity").length;
  const cachedCount = ledger.entries.filter((entry) => entry.cached).length;
  const spawnCount = [...args.executionEvidenceByAttempt.values()]
    .filter((evidence) => evidence.invocation !== "NOT_INVOKED_PRE_SPAWN").length;
  requireCondition(ledger.infrastructureReplays === replayCount
      && ledger.infrastructureReplays === result.infrastructureReplays
      && ledger.maxPlanCapacityEvents === maxPlanCapacityEvents
      && ledger.maxPlanCapacityEvents === result.maxPlanEvents
      && ledger.cachedReceipts === cachedCount
      && ledger.codexExecInvocations === spawnCount,
    "retained qualification ledger call/replay/Max-plan/cache counters are not derived from exact attempts");
  requireCondition(result.baseCallsAttempted <= IMP24_BASE_MAXIMUM_CALLS
      && result.totalAttempts <= IMP24_HARD_MAXIMUM_CALLS,
    "retained qualification exceeded the frozen 464/928 call ceiling");
}

function validateImplementationGate(
  repositoryRoot: string,
  gate: Imp24ImplementationCiGateV1,
): void {
  const runGit = (gitArgs: string[]): string => {
    try {
      return execFileSync("git", gitArgs, {
        cwd: resolve(repositoryRoot),
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }).trim();
    } catch (error) {
      throw new ForwardRetainedRoleQualificationEvidenceV3Error(
        `cannot verify retained implementation CI gate with git ${gitArgs.join(" ")}: ${(error as Error).message}`,
      );
    }
  };
  const checkout = {
    branch: IMP24_REQUIRED_BRANCH,
    headSha: gate.headSha,
    // The trusted collector proved cleanliness before the first V3 call and
    // retained the hash of that exact identity. Evidence generated afterwards
    // is intentionally outside the implementation tree.
    implementationClean: true,
  };
  const currentBranch = runGit(["branch", "--show-current"]);
  const currentHead = runGit(["rev-parse", "HEAD"]);
  requireCondition(currentBranch === IMP24_REQUIRED_BRANCH || currentBranch === "",
    `retained implementation evidence must be verified on ${IMP24_REQUIRED_BRANCH} or an exact detached CI checkout`);
  runGit(["merge-base", "--is-ancestor", gate.headSha, currentHead]);
  validateImp24ImplementationCiGate({ gate, expectedHeadSha: gate.headSha, checkout });
  requireCondition(gate.trustedEvidence.checkoutSha256 === hashCanonical(checkout),
    "implementation CI gate trusted checkout hash is not the exact clean branch/HEAD identity");
}

function validateCampaignReport(args: {
  report: Imp24RoleQualificationCampaignReportV1;
  gate: Imp24ImplementationCiGateV1;
  result: RoleQualificationRunnerResultV3;
  preflight: LiveQualificationPreflightV3;
  ledger: LiveCallLedgerV3;
  roleAssignmentFreeze: ForwardRoleAssignmentFreezeV3 | null;
  paths: Record<string, string>;
  executionId: RetainedQualificationExecutionId;
}): void {
  const { report, gate, result, preflight, ledger, roleAssignmentFreeze } = args;
  requireExactObjectKeys(report, [
    "schema", "experimentId", "status", "implementationCiGateSha256", "implementationHeadSha",
    "candidateAvailabilitySha256", "preflightSha256", "qualificationFreezeSha256",
    "qualificationResultSha256", "roleRegistrySha256", "callLedgerSha256",
    "roleAssignmentFreezeSha256", "selected", "qualifiedProfiles", "profileStatusCounts",
    "callCounts", "thresholdsWeakened", "holdoutsRelabeled", "unavailableReplaced",
    "outputInformedResampling", "retriesAdded", "externalCapabilities", "completedAt",
    "artifactBytesSha256", "reportSha256",
  ], "qualification campaign report");
  const callCountKeys = [
    "baseMaximum", "hardMaximum", "canaryCalls", "holdoutCalls", "baseCallsAttempted",
    "infrastructureReplays", "maxPlanEvents", "totalAttempts", "brokerRequests",
    "codexExecInvocations", "cachedReceipts", "apiCalls",
  ];
  requireExactObjectKeys(report.callCounts, callCountKeys, "qualification campaign call counts");
  requireCondition(Object.values(report.callCounts).every((value) =>
    typeof value === "number" && Number.isSafeInteger(value) && value >= 0),
  "qualification campaign call counts must be non-negative safe integers");
  requireExactObjectKeys(report.externalCapabilities, [
    "publish", "promote", "deploy", "upload", "merge", "forcePush", "api", "directHttpOrSdk",
  ], "qualification campaign external capabilities");
  requireCondition(report.schema === IMP24_ROLE_QUALIFICATION_CAMPAIGN_REPORT_SCHEMA
      && report.experimentId === args.executionId,
    "retained qualification campaign report identity mismatch");
  const { reportSha256, ...core } = report;
  requireSha(reportSha256, "qualification campaign report hash");
  requireCondition(reportSha256 === hashCanonical(core), "qualification campaign report self hash drift");
  const expectedStatus = result.roleSetReady ? "ROLE_SET_READY" : "ROLE_SET_NOT_READY";
  requireCondition(report.status === expectedStatus
      && report.implementationCiGateSha256 === gate.gateSha256
      && report.implementationHeadSha === gate.headSha
      && report.candidateAvailabilitySha256 === preflight.candidateAvailabilitySha256
      && report.preflightSha256 === preflight.preflightSha256
      && report.qualificationFreezeSha256 === result.freeze.freezeSha256
      && report.qualificationResultSha256 === hashCanonical(result)
      && report.roleRegistrySha256 === hashCanonical(result.registry)
      && report.callLedgerSha256 === hashCanonical(ledger)
      && report.roleAssignmentFreezeSha256 === (roleAssignmentFreeze?.freezeSha256 ?? null)
      && result.roleSetReady === (roleAssignmentFreeze !== null)
      && hashCanonical(report.selected) === hashCanonical(result.selected)
      && Number.isFinite(Date.parse(report.completedAt)),
    "qualification campaign report differs from the exact gated result/selection");
  requireCondition(report.callCounts.baseMaximum === IMP24_BASE_MAXIMUM_CALLS
      && report.callCounts.hardMaximum === IMP24_HARD_MAXIMUM_CALLS
      && report.callCounts.canaryCalls === result.attempts.filter((attempt) =>
        attempt.request.attemptNumber === 1 && attempt.request.partition === "canary").length
      && report.callCounts.holdoutCalls === result.attempts.filter((attempt) =>
        attempt.request.attemptNumber === 1 && attempt.request.partition === "holdout").length
      && report.callCounts.baseCallsAttempted === result.baseCallsAttempted
      && report.callCounts.infrastructureReplays === result.infrastructureReplays
      && report.callCounts.maxPlanEvents === result.maxPlanEvents
      && report.callCounts.maxPlanEvents === ledger.maxPlanCapacityEvents
      && report.callCounts.totalAttempts === result.totalAttempts
      && report.callCounts.brokerRequests === ledger.brokerRequests
      && report.callCounts.codexExecInvocations === ledger.codexExecInvocations
      && report.callCounts.cachedReceipts === ledger.cachedReceipts
      && report.callCounts.apiCalls === 0,
    "qualification campaign report call counts are not derived from exact retained attempts/ledger");
  requireCondition(hashCanonical(report.qualifiedProfiles) === hashCanonical(
    [...new Set(Object.values(result.qualifiers).flat())].sort(),
  ), "qualification campaign report qualified profiles differ from exact recomputed qualifiers");
  requireCondition(report.thresholdsWeakened === false
      && report.holdoutsRelabeled === false
      && report.unavailableReplaced === false
      && report.outputInformedResampling === false
      && report.retriesAdded === false
      && Object.values(report.externalCapabilities).every((value) => value === false),
    "qualification campaign report records threshold/evidence/retry/capability drift");
  const expectedStatusCounts: Record<string, number> = {};
  for (const item of result.profileRoleResults) {
    expectedStatusCounts[item.status] = (expectedStatusCounts[item.status] ?? 0) + 1;
  }
  requireCondition(hashCanonical(report.profileStatusCounts)
      === hashCanonical(Object.fromEntries(Object.entries(expectedStatusCounts).sort(([left], [right]) => left.localeCompare(right)))),
  "qualification campaign report status counts differ from recomputed profiles");
  for (const [artifact, expectedHash] of Object.entries(report.artifactBytesSha256)) {
    const path = args.paths[artifact];
    requireCondition(typeof path === "string" && existsSync(path),
      `qualification campaign report references unknown/missing ${artifact} artifact`);
    requireCondition(expectedHash === sha256Hex(readFileSync(path)),
      `qualification campaign report ${artifact} byte hash drift`);
  }
  const hasImp24eAvailabilityBinding = preflight.candidateAvailabilitySemanticSha256 !== undefined;
  const requiredArtifacts = [
    "implementationCiGate", "candidateAvailability",
    ...(hasImp24eAvailabilityBinding
      ? ["candidateAvailabilitySemantic", "candidateAvailabilityProvenance"]
      : []),
    "preflight", "qualificationFreeze",
    "qualificationResult", "roleRegistry", "callLedger",
    ...(result.roleSetReady ? ["roleAssignmentFreeze"] : []),
  ];
  requireCondition(hashCanonical(Object.keys(report.artifactBytesSha256).sort()) === hashCanonical(requiredArtifacts.sort()),
    "qualification campaign report artifact byte bindings differ from the exact terminal artifact set");
  for (const artifact of requiredArtifacts) {
    requireCondition(Object.hasOwn(report.artifactBytesSha256, artifact),
      `qualification campaign report omits required ${artifact} byte binding`);
  }
}

export type Imp24RetainedRoleQualificationEvidenceProofV1 = {
  schema: typeof IMP24_RETAINED_ROLE_QUALIFICATION_EVIDENCE_PROOF_SCHEMA;
  experimentId: RetainedQualificationExecutionId;
  qualificationResultSha256: string;
  qualificationFreezeSha256: string;
  scheduleSha256: string;
  roleAssignmentFreezeSha256: string | null;
  preflightSha256: string;
  implementationHeadSha: string;
  implementationCiGateSha256: string;
  implementationCiGateBytesSha256: string;
  qualificationReportSha256: string;
  qualificationReportBytesSha256: string;
  callLedgerBytesSha256: string;
  callLedgerSha256: string;
  qualificationResultBytesSha256: string;
  attemptEvidenceSetSha256: string;
  baseCallsAttempted: number;
  infrastructureReplays: number;
  totalAttempts: number;
  codexExecInvocations: number;
  verificationModelCalls: 0;
  apiCalls: 0;
  proofSha256: string;
};

export type VerifiedForwardRetainedRoleQualificationEvidenceV3 = {
  proof: Readonly<Imp24RetainedRoleQualificationEvidenceProofV1>;
  result: Readonly<RoleQualificationRunnerResultV3>;
  preflight: Readonly<LiveQualificationPreflightV3>;
  ledger: Readonly<LiveCallLedgerV3>;
  readonly [VERIFIED_RETAINED_QUALIFICATION]: true;
};

export type VerifyForwardRetainedRoleQualificationEvidenceV3Args = {
  repositoryRoot: string;
  experimentDir: string;
  input: RunRoleQualificationInputV3;
  evaluateOutput: QualificationOutputEvaluatorV3;
  roleAssignmentFreeze: ForwardRoleAssignmentFreezeV3 | null;
};

export function assertVerifiedForwardRetainedRoleQualificationEvidenceV3(
  value: VerifiedForwardRetainedRoleQualificationEvidenceV3,
): void {
  requireCondition(value?.[VERIFIED_RETAINED_QUALIFICATION] === true,
    "V3 qualification evidence was not produced by the durable retained-evidence verifier");
  const { proofSha256, ...core } = value.proof;
  requireCondition(proofSha256 === hashCanonical(core), "retained V3 qualification proof self hash drift");
  requireCondition(value.proof.qualificationResultSha256 === hashCanonical(value.result)
      && value.proof.qualificationFreezeSha256 === value.result.freeze.freezeSha256
      && value.proof.preflightSha256 === value.preflight.preflightSha256
      && value.result.roleSetReady === (value.proof.roleAssignmentFreezeSha256 !== null),
    "retained V3 qualification branded value was mutated after verification");
}

function verifyForwardRetainedRoleQualificationEvidenceForExecutionV3(
  args: VerifyForwardRetainedRoleQualificationEvidenceV3Args,
  executionId: RetainedQualificationExecutionId,
): VerifiedForwardRetainedRoleQualificationEvidenceV3 {
  requireCondition(typeof args.evaluateOutput === "function", "retained V3 verifier requires the certified lane evaluator");
  const experimentDir = resolve(args.experimentDir);
  const liveDir = resolve(experimentDir, "live");
  const paths = {
    candidateAvailability: resolve(experimentDir, "candidate-availability.json"),
    candidateAvailabilitySemantic: resolve(experimentDir, "candidate-availability-semantic.json"),
    candidateAvailabilityProvenance: resolve(experimentDir, "candidate-availability-provenance.json"),
    preflight: resolve(liveDir, "preflight.json"),
    freeze: resolve(liveDir, "qualification-freeze.json"),
    result: resolve(liveDir, "qualification-result.json"),
    registry: resolve(liveDir, "role-registry.json"),
    ledger: resolve(liveDir, "call-ledger.json"),
    roleFreeze: resolve(experimentDir, "role-assignment-freeze.json"),
    implementationCiGate: resolve(experimentDir, "implementation-ci-gate.json"),
    campaignReport: resolve(experimentDir, "qualification-report.json"),
  };
  const historicalR2 = executionId === IMP24_ROLE_QUALIFICATION_R2_EXECUTION_ID;
  const plan = historicalR2
    ? buildLegacyRoleQualificationPlanV3(args.input)
    : buildRoleQualificationPlanV3(args.input);
  const retainedAvailability = parseExactJson<RunRoleQualificationInputV3["candidateAvailability"]>(
    paths.candidateAvailability,
    "candidate availability",
    "canonical",
  );
  if (historicalR2) {
    requireCondition(hashCanonical(retainedAvailability) === hashCanonical(args.input.candidateAvailability),
      "historical R2 candidate availability differs from the exact retained input");
  } else {
    requireSha(retainedAvailability.semanticSha256, "retained candidate availability semantic hash");
    requireSha(retainedAvailability.provenanceSha256, "retained candidate availability provenance hash");
    const expectedSemanticSha256 = candidateAvailabilitySemanticSha256(args.input.candidateAvailability);
    requireCondition(candidateAvailabilitySemanticSha256(retainedAvailability) === expectedSemanticSha256,
      "retained candidate availability semantics differ from the certified qualification input");
    const retainedSemanticProjection = parseExactJson(
      paths.candidateAvailabilitySemantic,
      "candidate availability semantic projection",
      "canonical",
    );
    requireCondition(hashCanonical(retainedSemanticProjection) === expectedSemanticSha256
        && hashCanonical(retainedSemanticProjection)
          === hashCanonical(candidateAvailabilitySemanticProjectionV3(args.input.candidateAvailability)),
    "retained candidate availability semantic projection drift");
    const provenanceLedger = parseExactJson<Imp24CandidateAvailabilityProvenanceLedgerV1>(
      paths.candidateAvailabilityProvenance,
      "candidate availability provenance ledger",
      "canonical",
    );
    const { ledgerSha256, ...ledgerCore } = provenanceLedger;
    requireCondition(provenanceLedger.schema === IMP24_CANDIDATE_AVAILABILITY_PROVENANCE_LEDGER_SCHEMA
        && provenanceLedger.candidateAvailabilitySemanticSha256 === expectedSemanticSha256
        && ledgerSha256 === hashCanonical(ledgerCore),
    "candidate availability provenance ledger identity/self hash drift");
    for (const observation of provenanceLedger.observations) {
      const { provenanceSha256, ...projection } = observation;
      requireCondition(provenanceSha256 === hashCanonical(projection),
        "candidate availability provenance ledger observation hash drift");
    }
    const expectedProvenance = [retainedAvailability, args.input.candidateAvailability]
      .map((value) => candidateAvailabilityProvenanceSha256(value));
    requireCondition(expectedProvenance.every((sha256) =>
      provenanceLedger.observations.some((item) => item.provenanceSha256 === sha256)),
    "candidate availability provenance ledger does not retain every observed refresh");
  }
  const retainedFreeze = parseExactJson(paths.freeze, "qualification freeze", "canonical");
  requireCondition(hashCanonical(retainedFreeze) === hashCanonical(plan.freeze),
    "retained qualification freeze differs from the recomputed 464-call plan");
  const result = parseExactJson<RoleQualificationRunnerResultV3>(paths.result, "qualification result", "canonical");
  requireCondition(result.schema === IMP24_ROLE_QUALIFICATION_RUNNER_SCHEMA
      && result.experimentId === executionId,
    "retained qualification result identity mismatch");
  requireCondition(hashCanonical(result.freeze) === hashCanonical(plan.freeze)
      && hashCanonical(result.schedule) === hashCanonical(plan.schedule),
    "retained qualification result changed the frozen schedule or inputs");
  const retainedRegistry = parseExactJson<RoleQualificationRegistryV1>(paths.registry, "qualification role registry", "canonical");
  requireCondition(hashCanonical(retainedRegistry) === hashCanonical(result.registry),
    "retained role registry differs from the qualification result");
  const preflight = parseExactJson<LiveQualificationPreflightV3>(paths.preflight, "qualification preflight", "canonical");
  validatePreflight(preflight, args.input, plan.freeze.freezeSha256, executionId);

  requireCondition(Array.isArray(result.attempts), "retained V3 qualification attempts must be an array");
  const sortedAttempts = [...result.attempts].sort((left, right) =>
    left.scheduleOrdinal - right.scheduleOrdinal || left.request.attemptNumber - right.request.attemptNumber);
  requireCondition(hashCanonical(sortedAttempts) === hashCanonical(result.attempts),
    "retained qualification attempts are not in frozen schedule/attempt order");
  requireCondition(new Set(result.attempts.map((attempt) => attempt.request.attemptId)).size === result.attempts.length,
    "retained qualification result reuses an attempt identity");
  const recomputed: QualificationAttemptV3[] = [];
  const processDiagnosticsByAttempt = new Map<string, CodexProcessDiagnosticsV1>();
  const executionEvidenceByAttempt = new Map<string, LiveAttemptExecutionEvidenceV3>();
  const executionSidecarRelPaths = new Set<string>();
  const evidenceBindings: Array<Record<string, unknown>> = [];
  for (const attempt of result.attempts) {
    const entry = plan.schedule[attempt.scheduleOrdinal];
    requireCondition(entry !== undefined && entry.ordinal === attempt.scheduleOrdinal
        && entry.scheduleId === attempt.request.scheduleId,
      `${attempt.request.attemptId}: attempt is outside the frozen schedule`);
    const verified = recomputeAttempt({
      attempt,
      entry,
      input: args.input,
      evaluateOutput: args.evaluateOutput,
      liveDir,
      freezeSha256: plan.freeze.freezeSha256,
      preflight,
      executionId,
    });
    recomputed.push(verified.attempt);
    processDiagnosticsByAttempt.set(verified.attempt.request.attemptId, verified.processDiagnostics);
    executionEvidenceByAttempt.set(verified.attempt.request.attemptId, verified.executionEvidence);
    for (const relPath of verified.executionSidecarRelPaths) {
      requireCondition(!executionSidecarRelPaths.has(relPath),
        `${verified.attempt.request.attemptId}: execution sidecar is bound by multiple attempts: ${relPath}`);
      executionSidecarRelPaths.add(relPath);
    }
    evidenceBindings.push({
      attemptId: verified.attempt.request.attemptId,
      requestSha256: verified.attempt.request.requestSha256,
      evidenceEnvelopeSha256: verified.attempt.request.evidenceEnvelopeSha256,
      evidenceEnvelopeBytesSha256: verified.attempt.request.evidenceEnvelopeBytesSha256,
      receiptSha256: verified.attempt.receipt!.receiptSha256,
      rawOutputSha256: verified.attempt.rawOutputSha256,
      retentionSha256: verified.retentionSha256,
      processDiagnosticsSha256: verified.processDiagnosticsSha256,
      executionEvidenceSha256: verified.executionEvidenceSha256,
      evaluationArtifactSha256: verified.evaluationArtifactSha256,
    });
  }
  const attemptsRoot = resolve(liveDir, "attempts");
  const actualAttemptDirs = existsSync(attemptsRoot) ? readdirSync(attemptsRoot).sort() : [];
  for (const name of actualAttemptDirs) {
    const attemptStat = lstatSync(resolve(attemptsRoot, name));
    requireCondition(attemptStat.isDirectory() && !attemptStat.isSymbolicLink(),
      `qualification attempts root contains non-directory or symlink entry ${name}`);
  }
  const expectedAttemptDirs = recomputed.map((attempt) => attempt.request.attemptId).sort();
  requireCondition(hashCanonical(actualAttemptDirs) === hashCanonical(expectedAttemptDirs),
    "qualification attempt directory contains missing, extra, or unledgered attempts");
  validateLiveExecEvidenceRootV3(liveDir, executionSidecarRelPaths);

  const expectedResult = recomputeResult({
    input: args.input,
    retained: result,
    attempts: recomputed,
    schedule: plan.schedule,
    executionId,
  });
  requireCondition(hashCanonical(expectedResult) === hashCanonical(result),
    "retained qualification result/role selection is not the deterministic projection of exact canary/holdout receipts");
  const ledger = parseExactJson<LiveCallLedgerV3>(paths.ledger, "qualification call ledger", "canonical");
  validateLedger({
    ledger,
    result,
    attempts: recomputed,
    processDiagnosticsByAttempt,
    executionEvidenceByAttempt,
    executionId,
  });
  const implementationCiGate = parseExactJson<Imp24ImplementationCiGateV1>(
    paths.implementationCiGate,
    "implementation CI gate",
    "canonical",
  );
  validateImplementationGate(args.repositoryRoot, implementationCiGate);
  let retainedRoleFreeze: ForwardRoleAssignmentFreezeV3 | null = null;
  if (result.roleSetReady) {
    requireCondition(result.roleSetBlockedReason === null,
      "role-ready retained qualification carries a blocked reason");
    requireCondition(args.roleAssignmentFreeze !== null,
      "role-ready retained qualification requires an explicit role-assignment freeze");
    retainedRoleFreeze = parseExactJson<ForwardRoleAssignmentFreezeV3>(
      paths.roleFreeze,
      "role-assignment freeze",
      "canonical",
    );
    requireCondition(hashCanonical(retainedRoleFreeze) === hashCanonical(args.roleAssignmentFreeze)
        && retainedRoleFreeze.freezeSha256 === hashWithout(retainedRoleFreeze as unknown as Record<string, unknown>, "freezeSha256")
        && retainedRoleFreeze.qualificationResultSha256 === hashCanonical(result),
      "retained role-assignment freeze differs from the exact qualification result/input");
    requireCondition(retainedRoleFreeze.implementationHeadSha === implementationCiGate.headSha
        && retainedRoleFreeze.implementationCiGateSha256 === implementationCiGate.gateSha256
        && retainedRoleFreeze.callLedgerSha256 === hashCanonical(ledger)
        && retainedRoleFreeze.callLedgerBytesSha256 === sha256Hex(readFileSync(paths.ledger)),
      "retained role-assignment freeze does not bind the exact implementation gate and completed call ledger");
    const routeBinding: ForwardV3RouteBinding = {
      executionRoute: "codex_exec_chatgpt_subscription",
      authMode: "chatgpt",
      apiKeyPresent: false,
      apiFallbackAllowed: false,
      directHttpOrSdkAllowed: false,
      executionProfileHash: preflight.executionProfileHash,
      routePolicyVersion: preflight.routePolicyVersion,
    };
    if (historicalR2) {
      validateForwardRoleAssignmentFreezeInternalV3(retainedRoleFreeze, executionId);
      requireCondition(retainedRoleFreeze.qualificationFreezeSha256 === result.freeze.freezeSha256
          && retainedRoleFreeze.qualificationResultSha256 === hashCanonical(result)
          && retainedRoleFreeze.instrumentCertificationSha256 === args.input.certification.certificationSha256
          && retainedRoleFreeze.corpusBundleSha256 === args.input.corpusBundle.substantiveBundleSha256
          && hashCanonical(retainedRoleFreeze.schemaHashes) === hashCanonical(args.input.schemaHashes)
          && hashCanonical(retainedRoleFreeze.promptSourceHashes) === hashCanonical(args.input.promptSourceHashes)
          && hashCanonical(retainedRoleFreeze.routeBinding) === hashCanonical(routeBinding)
          && retainedRoleFreeze.productionInstrumentSealSha256 === args.input.productionInstrumentSeal.sealSha256,
      "historical R2 role-assignment freeze differs from retained qualification inputs");
    } else {
      validateForwardRoleAssignmentFreezeV3(retainedRoleFreeze, {
        implementationHeadSha: implementationCiGate.headSha,
        implementationCiGateSha256: implementationCiGate.gateSha256,
        callLedgerSha256: hashCanonical(ledger),
        callLedgerBytesSha256: sha256Hex(readFileSync(paths.ledger)),
        result,
        certification: args.input.certification,
        corpusBundle: args.input.corpusBundle,
        schemaHashes: args.input.schemaHashes,
        promptSourceHashes: args.input.promptSourceHashes,
        routeBinding,
        productionInstrumentSeal: args.input.productionInstrumentSeal,
        repositoryRoot: args.repositoryRoot,
      });
    }
  } else {
    requireCondition(typeof result.roleSetBlockedReason === "string" && result.roleSetBlockedReason.length > 0,
      "role-set-not-ready retained qualification lacks its deterministic blocked reason");
    requireCondition(args.roleAssignmentFreeze === null,
      "role-set-not-ready retained qualification must not accept a role-assignment freeze");
    requireCondition(!existsSync(paths.roleFreeze),
      "role-set-not-ready retained qualification unexpectedly contains a role-assignment freeze file");
  }
  const campaignReport = parseExactJson<Imp24RoleQualificationCampaignReportV1>(
    paths.campaignReport,
    "qualification campaign report",
    "canonical",
  );
  validateCampaignReport({
    report: campaignReport,
    gate: implementationCiGate,
    result,
    preflight,
    ledger,
    roleAssignmentFreeze: retainedRoleFreeze,
    executionId,
    paths: {
      implementationCiGate: paths.implementationCiGate,
      candidateAvailability: paths.candidateAvailability,
      ...(!historicalR2 ? {
        candidateAvailabilitySemantic: paths.candidateAvailabilitySemantic,
        candidateAvailabilityProvenance: paths.candidateAvailabilityProvenance,
      } : {}),
      preflight: paths.preflight,
      qualificationFreeze: paths.freeze,
      qualificationResult: paths.result,
      roleRegistry: paths.registry,
      callLedger: paths.ledger,
      ...(retainedRoleFreeze === null ? {} : { roleAssignmentFreeze: paths.roleFreeze }),
    },
  });
  requireCondition(campaignReport.roleAssignmentFreezeSha256 === (retainedRoleFreeze?.freezeSha256 ?? null),
    "qualification campaign report belongs to another role-assignment freeze");

  const core = {
    schema: IMP24_RETAINED_ROLE_QUALIFICATION_EVIDENCE_PROOF_SCHEMA,
    experimentId: executionId,
    qualificationResultSha256: hashCanonical(result),
    qualificationFreezeSha256: result.freeze.freezeSha256,
    scheduleSha256: hashCanonical(result.schedule),
    roleAssignmentFreezeSha256: retainedRoleFreeze?.freezeSha256 ?? null,
    preflightSha256: preflight.preflightSha256,
    implementationHeadSha: implementationCiGate.headSha,
    implementationCiGateSha256: implementationCiGate.gateSha256,
    implementationCiGateBytesSha256: sha256Hex(readFileSync(paths.implementationCiGate)),
    qualificationReportSha256: campaignReport.reportSha256,
    qualificationReportBytesSha256: sha256Hex(readFileSync(paths.campaignReport)),
    callLedgerBytesSha256: sha256Hex(readFileSync(paths.ledger)),
    callLedgerSha256: hashCanonical(ledger),
    qualificationResultBytesSha256: sha256Hex(readFileSync(paths.result)),
    attemptEvidenceSetSha256: hashCanonical(evidenceBindings),
    baseCallsAttempted: result.baseCallsAttempted,
    infrastructureReplays: result.infrastructureReplays,
    totalAttempts: result.totalAttempts,
    codexExecInvocations: ledger.codexExecInvocations,
    verificationModelCalls: 0 as const,
    apiCalls: 0 as const,
  };
  const proof = Object.freeze({ ...core, proofSha256: hashCanonical(core) });
  const verified = {
    proof,
    result: deepFreeze(result),
    preflight: deepFreeze(preflight),
    ledger: deepFreeze(ledger),
  } as VerifiedForwardRetainedRoleQualificationEvidenceV3;
  Object.defineProperty(verified, VERIFIED_RETAINED_QUALIFICATION, { value: true, enumerable: false });
  return Object.freeze(verified);
}

/** Active IMP-24E verifier. FINAL availability semantics/provenance are
 * mandatory and no historical identity is accepted through this entrypoint. */
export function verifyForwardRetainedRoleQualificationEvidenceV3(
  args: VerifyForwardRetainedRoleQualificationEvidenceV3Args,
): VerifiedForwardRetainedRoleQualificationEvidenceV3 {
  return verifyForwardRetainedRoleQualificationEvidenceForExecutionV3(
    args,
    IMP24_ROLE_QUALIFICATION_EXECUTION_ID,
  );
}

/** Historical IMP-24D verifier. This is the only entrypoint allowed to read
 * the immutable R2 state shape and it always uses the explicit legacy plan. */
export function verifyHistoricalImp24DR2RetainedRoleQualificationEvidenceV3(
  args: VerifyForwardRetainedRoleQualificationEvidenceV3Args,
): VerifiedForwardRetainedRoleQualificationEvidenceV3 {
  return verifyForwardRetainedRoleQualificationEvidenceForExecutionV3(
    args,
    IMP24_ROLE_QUALIFICATION_R2_EXECUTION_ID,
  );
}
