/** IMP-24E fresh, fixed two-call transport smoke. */

import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { relative, resolve, sep } from "node:path";

import {
  IMP24_ROLE_CANDIDATE_ORDER,
  buildQualificationExecutionRequestV3,
  buildRoleQualificationPlanV3,
  candidateAvailabilitySemanticSha256,
  type QualificationExecutionReceiptV3,
  type QualificationFreezeV3,
  type QualificationScheduleEntryV3,
  type RunRoleQualificationInputV3,
} from "../bakeoff/migration/roleQualificationRunnerV3.js";
import { IMP24_ROLE_QUALIFICATION_EXECUTION_ID } from "../bakeoff/migration/imp24Corpus.js";
import { canonicalJson, hashCanonical, sha256Hex } from "../contracts/contractUtil.js";
import { writeFileAtomic } from "../lib/atomicWrite.js";
import {
  parseReaderExperienceModelOutputV2,
  parseSourceIntegrityModelOutputV2,
} from "../review/reviewModelOutputV2.js";
import {
  collectImp24ImplementationCiGate,
  validateImp24ImplementationCiGate,
  type Imp24ImplementationCiGateV1,
} from "./forwardRoleQualificationCampaignV3.js";
import {
  IMP24E_TRANSPORT_SMOKE_EXECUTION_ID,
  IMP24E_TRANSPORT_SMOKE_R2_EXECUTION_ID,
  IMP24_LIVE_CALL_LEDGER_SCHEMA,
  createLiveQualificationExecutorV3,
  prepareLiveRoleQualificationV3,
  preflightLiveRoleQualificationV3,
  validateExecutionEvidenceArtifact,
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
  validateCodexProcessDiagnosticsV1,
  type CodexProcessDiagnosticsV1,
} from "./codexProcessDiagnostics.js";
import {
  imp24ESchemaProbePaths,
  verifyRetainedImp24ESchemaProbeCycle,
  type Imp24ESchemaProbeCycleV1,
} from "./imp24eSchemaProbe.js";

export { IMP24E_TRANSPORT_SMOKE_EXECUTION_ID, IMP24E_TRANSPORT_SMOKE_R2_EXECUTION_ID };

export const IMP24E_TRANSPORT_SMOKE_BINDING_SCHEMA = "imp24e-transport-smoke-binding-v1" as const;
export const IMP24E_TRANSPORT_SMOKE_EVALUATION_SCHEMA = "imp24e-transport-smoke-evaluation-v1" as const;
export const IMP24E_TRANSPORT_SMOKE_CYCLE_SCHEMA = "imp24e-transport-smoke-cycle-v1" as const;
export const IMP24E_TRANSPORT_SMOKE_REPORT_SCHEMA = "imp24e-transport-smoke-report-v1" as const;
export const IMP24E_TRANSPORT_SMOKE_REPORT_JSON_REL_PATH =
  "docs/v25/reports/IMP-24E_TRANSPORT_SMOKE_RESULT.json" as const;
export const IMP24E_TRANSPORT_SMOKE_REPORT_MARKDOWN_REL_PATH =
  "docs/v25/reports/IMP-24E_TRANSPORT_SMOKE_RESULT.md" as const;

const PIPELINE_REL = "scripts/book/prompts/chapterflow-v24-author-pipeline";
const STATE_REL = `${PIPELINE_REL}/state/migration-experiments`;
const SHA256 = /^[a-f0-9]{64}$/;
const GIT_SHA = /^[a-f0-9]{40}$/;
const COMPLETE_ATTEMPT_FILES = [
  "evaluation.json",
  "evidence-envelope.json",
  "execution-evidence.json",
  "process-diagnostics.json",
  "receipt.json",
  "request.json",
  "retention.json",
] as const;

export type Imp24ETransportSmokeCycleNumber = 1 | 2;
export type Imp24ETransportSmokeExecutionId =
  | typeof IMP24E_TRANSPORT_SMOKE_EXECUTION_ID
  | typeof IMP24E_TRANSPORT_SMOKE_R2_EXECUTION_ID;
export type Imp24ETransportSmokeRole = "reader" | "source";

export type Imp24ETransportSmokeCallBindingV1 = {
  role: Imp24ETransportSmokeRole;
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

export type Imp24ETransportSmokeBindingV1 = {
  schema: typeof IMP24E_TRANSPORT_SMOKE_BINDING_SCHEMA;
  cycle: Imp24ETransportSmokeCycleNumber;
  executionId: Imp24ETransportSmokeExecutionId;
  candidateAvailabilitySemanticSha256: string;
  candidateAvailabilityProvenanceSha256: string | null;
  qualificationFreezeSha256: string;
  certificationSha256: string;
  productionInstrumentSealSha256: string;
  productionQualificationParitySha256: string;
  calls: [Imp24ETransportSmokeCallBindingV1, Imp24ETransportSmokeCallBindingV1];
  inputBindingSha256: string;
};

export type Imp24ETransportSmokeEvaluationV1 = {
  schema: typeof IMP24E_TRANSPORT_SMOKE_EVALUATION_SCHEMA;
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

export type Imp24ETransportSmokeCallV1 = {
  role: Imp24ETransportSmokeRole;
  sourceScheduleId: string;
  smokeScheduleId: string;
  attemptId: string;
  profileId: string;
  model: string;
  effort: string;
  requestSha256: string;
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
  processDiagnosticsComplete: boolean;
  authoritativeOutputFileProduced: boolean;
  schemaValidJson: boolean;
  envelopeAndSidecarsBound: boolean;
  qualificationMetricsIncluded: false;
  apiCalls: 0;
  passed: boolean;
  failureClassification: string | null;
  failureDetail: string | null;
  diagnostics: {
    invocation: string | null;
    classification: string | null;
    failureKind: string | null;
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

export type Imp24ETransportSmokeCycleV1 = {
  schema: typeof IMP24E_TRANSPORT_SMOKE_CYCLE_SCHEMA;
  cycle: Imp24ETransportSmokeCycleNumber;
  executionId: Imp24ETransportSmokeExecutionId;
  stateRoot: string;
  implementationCommit: string;
  workflowRunId: number;
  implementationCiVerifiedAt: string;
  implementationCiGateSha256: string;
  schemaProbeCycleSha256: string;
  schemaProbeImplementationCommit: string;
  inputBindingSha256: string;
  candidateAvailabilitySemanticSha256: string;
  candidateAvailabilityProvenanceSha256: string | null;
  preflightSha256: string;
  qualificationFreezeSha256: string;
  certificationSha256: string;
  productionInstrumentSealSha256: string;
  productionQualificationParitySha256: string;
  callLedgerSha256: string;
  calls: [Imp24ETransportSmokeCallV1, Imp24ETransportSmokeCallV1];
  brokerRequests: 2;
  codexExecInvocations: number;
  processDiagnosticsSetSha256: string;
  qualificationMetricsIncluded: false;
  qualificationArtifactsCreated: false;
  apiCalls: 0;
  status: "PASS" | "FAIL";
  startedAt: string;
  completedAt: string;
  cycleSha256: string;
};

export type Imp24ETransportSmokeReportV1 = {
  schema: typeof IMP24E_TRANSPORT_SMOKE_REPORT_SCHEMA;
  status: "PASS" | "FAIL";
  cycles: Imp24ETransportSmokeCycleV1[];
  totalBrokerRequests: 2 | 4;
  totalCodexExecInvocations: number;
  maximumCallsPerCycle: 2;
  maximumCycles: 2;
  maximumCallsAuthorized: 4;
  qualificationMetricsIncluded: false;
  qualificationArtifactsCreated: false;
  apiCalls: 0;
  reportSha256: string;
};

export type RunImp24ETransportSmokeArgs = {
  executeLive: boolean;
  cycle: Imp24ETransportSmokeCycleNumber;
  expectedHeadSha: string;
  workflowRunId: number;
  repositoryRoot: string;
  loadInput: () => UnpreparedLiveRoleQualificationInputV3;
  preflight: { authJsonPath?: string; codexBinary?: string; qualificationCacheDir?: string };
};

export type Imp24ETransportSmokeDeps = {
  clock?: () => Date;
  collectImplementationCiGate?: typeof collectImp24ImplementationCiGate;
  prepare?: typeof prepareLiveRoleQualificationV3;
  preflight?: typeof preflightLiveRoleQualificationV3;
  createExecutor?: typeof createLiveQualificationExecutorV3;
  inspectCall?: typeof inspectRetainedImp24ETransportSmokeCall;
  retainedArtifactRoot?: string;
};

export type RunImp24ETransportSmokeResult = {
  code: 0 | 1 | 2;
  executed: boolean;
  cycle: Imp24ETransportSmokeCycleNumber;
  cycleResult: Imp24ETransportSmokeCycleV1 | null;
  report: Imp24ETransportSmokeReportV1 | null;
  modelCalls: number;
  apiCalls: 0;
  message: string;
};

export class Imp24ETransportSmokeError extends Error {
  readonly classification = "transport_smoke_control_failure" as const;
  constructor(message: string) {
    super(message);
    this.name = "Imp24ETransportSmokeError";
  }
}

function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Imp24ETransportSmokeError(message);
}

function requireSha(value: unknown, label: string): asserts value is string {
  requireCondition(typeof value === "string" && SHA256.test(value), `${label} must be a lowercase SHA-256`);
}

function executionIdForCycle(cycle: Imp24ETransportSmokeCycleNumber): Imp24ETransportSmokeExecutionId {
  return cycle === 1 ? IMP24E_TRANSPORT_SMOKE_EXECUTION_ID : IMP24E_TRANSPORT_SMOKE_R2_EXECUTION_ID;
}

export function imp24ETransportSmokeStateRootRelPath(executionId: Imp24ETransportSmokeExecutionId): string {
  return `${STATE_REL}/${executionId}`;
}

export function imp24ETransportSmokeCycleResultRelPath(executionId: Imp24ETransportSmokeExecutionId): string {
  return `${imp24ETransportSmokeStateRootRelPath(executionId)}/cycle-result.json`;
}

function pretty(value: unknown): string { return `${JSON.stringify(value, null, 2)}\n`; }

function readJson<T>(path: string, label: string): T {
  try { return JSON.parse(readFileSync(path, "utf8")) as T; }
  catch (error) { throw new Imp24ETransportSmokeError(`${label} is invalid JSON: ${(error as Error).message}`); }
}

function persistExact(path: string, value: unknown, label: string): void {
  const bytes = `${canonicalJson(value)}\n`;
  if (existsSync(path)) {
    requireCondition(readFileSync(path, "utf8") === bytes, `${label} differs from retained bytes`);
    return;
  }
  writeFileAtomic(path, bytes);
  requireCondition(readFileSync(path, "utf8") === bytes, `${label} read-back drift`);
}

function fixedCallBinding(args: {
  role: Imp24ETransportSmokeRole;
  input: RunRoleQualificationInputV3;
  schedule: readonly QualificationScheduleEntryV3[];
}): Imp24ETransportSmokeCallBindingV1 {
  const available = args.input.candidateAvailability.entries.find((entry) =>
    entry.role === args.role && entry.status === "AVAILABLE");
  requireCondition(available !== undefined, `IMP-24E smoke has no AVAILABLE ${args.role} profile`);
  const candidate = IMP24_ROLE_CANDIDATE_ORDER[args.role][available.ordinal];
  requireCondition(candidate !== undefined
      && candidate.profileId === available.profileId
      && candidate.model === available.model
      && candidate.effort === available.effort,
  `IMP-24E smoke ${args.role} availability differs from frozen candidate order`);
  const entry = args.schedule.find((item) => item.role === args.role
    && item.candidateOrdinal === available.ordinal
    && item.partition === "canary"
    && item.caseOrdinal === 0);
  requireCondition(entry !== undefined, `IMP-24E smoke cannot locate first frozen ${args.role} canary`);
  const prepared = args.input.preparedCases[args.role].canary[0];
  requireCondition(prepared !== undefined
      && prepared.caseId === entry.caseId
      && prepared.envelope.envelopeSha256 === entry.evidenceEnvelopeSha256
      && prepared.evidenceEnvelopeBytesSha256 === entry.evidenceEnvelopeBytesSha256,
  `IMP-24E smoke ${args.role} first-canary prepared input drift`);
  return {
    role: args.role,
    candidateOrdinal: available.ordinal,
    profileId: available.profileId,
    model: available.model,
    effort: available.effort,
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
}

export function buildImp24ETransportSmokeBinding(args: {
  cycle: Imp24ETransportSmokeCycleNumber;
  input: RunRoleQualificationInputV3;
  freeze: QualificationFreezeV3;
  schedule: readonly QualificationScheduleEntryV3[];
}): Imp24ETransportSmokeBindingV1 {
  const semanticSha256 = candidateAvailabilitySemanticSha256(args.input.candidateAvailability);
  requireCondition(args.input.candidateAvailability.semanticSha256 === undefined
      || args.input.candidateAvailability.semanticSha256 === semanticSha256,
  "IMP-24E smoke candidate availability semantic self hash drift");
  const core: Omit<Imp24ETransportSmokeBindingV1, "inputBindingSha256"> = {
    schema: IMP24E_TRANSPORT_SMOKE_BINDING_SCHEMA,
    cycle: args.cycle,
    executionId: executionIdForCycle(args.cycle),
    candidateAvailabilitySemanticSha256: semanticSha256,
    candidateAvailabilityProvenanceSha256: args.input.candidateAvailability.provenanceSha256 ?? null,
    qualificationFreezeSha256: args.freeze.freezeSha256,
    certificationSha256: args.freeze.certificationSha256,
    productionInstrumentSealSha256: args.freeze.productionInstrumentSealSha256,
    productionQualificationParitySha256: args.freeze.productionQualificationParitySha256,
    calls: [
      fixedCallBinding({ role: "reader", input: args.input, schedule: args.schedule }),
      fixedCallBinding({ role: "source", input: args.input, schedule: args.schedule }),
    ],
  };
  return { ...core, inputBindingSha256: hashCanonical(core) };
}

function buildSmokeRequest(args: {
  executionId: Imp24ETransportSmokeExecutionId;
  binding: Imp24ETransportSmokeCallBindingV1;
  input: RunRoleQualificationInputV3;
  freeze: QualificationFreezeV3;
  schedule: readonly QualificationScheduleEntryV3[];
}): LiveQualificationExecutionRequestV3 {
  const entry = args.schedule.find((item) => item.scheduleId === args.binding.sourceScheduleId);
  const prepared = args.input.preparedCases[args.binding.role].canary[0];
  const candidate = IMP24_ROLE_CANDIDATE_ORDER[args.binding.role][args.binding.candidateOrdinal];
  requireCondition(entry !== undefined && prepared !== undefined && candidate !== undefined,
    `${args.binding.role}: fixed smoke request inputs are missing`);
  const source = buildQualificationExecutionRequestV3(entry, prepared, candidate, args.freeze, 1, null);
  const scheduleId = `${args.executionId}-${args.binding.role}-canary`;
  const attemptId = `${scheduleId}-a1`;
  const {
    requestSha256: _requestSha256,
    experimentId: _experimentId,
    scheduleId: _scheduleId,
    attemptId: _attemptId,
    ...unchanged
  } = source;
  const core: Omit<LiveQualificationExecutionRequestV3, "requestSha256"> = {
    ...unchanged,
    experimentId: args.executionId,
    scheduleId,
    attemptId,
  };
  return Object.freeze({ ...core, requestSha256: hashCanonical(core) });
}

function inspectOutput(role: Imp24ETransportSmokeRole, raw: string | null): { parsedJson: boolean; schemaValid: boolean } {
  if (typeof raw !== "string") return { parsedJson: false, schemaValid: false };
  try { JSON.parse(raw); } catch { return { parsedJson: false, schemaValid: false }; }
  try {
    if (role === "reader") parseReaderExperienceModelOutputV2(raw);
    else parseSourceIntegrityModelOutputV2(raw);
    return { parsedJson: true, schemaValid: true };
  } catch {
    return { parsedJson: true, schemaValid: false };
  }
}

function buildEvaluation(args: {
  request: LiveQualificationExecutionRequestV3;
  receipt: QualificationExecutionReceiptV3;
  executionEvidenceSha256: string;
  parsedJson: boolean;
  schemaValid: boolean;
}): Imp24ETransportSmokeEvaluationV1 {
  let receiptBound = true;
  try {
    validateQualificationReceiptArtifactV3({
      request: args.request,
      receipt: args.receipt,
      label: args.request.attemptId,
    });
  } catch {
    receiptBound = false;
  }
  const core: Omit<Imp24ETransportSmokeEvaluationV1, "evaluationArtifactSha256"> = {
    schema: IMP24E_TRANSPORT_SMOKE_EVALUATION_SCHEMA,
    attemptId: args.request.attemptId,
    requestSha256: args.request.requestSha256,
    receiptSha256: args.receipt.receiptSha256,
    executionEvidenceSha256: args.executionEvidenceSha256,
    rawOutputSha256: typeof args.receipt.rawOutput === "string" ? sha256Hex(args.receipt.rawOutput) : null,
    parsedJson: args.parsedJson,
    schemaValid: args.schemaValid,
    envelopeBound: receiptBound
      && sha256Hex(args.request.evidenceEnvelopeBytes) === args.request.evidenceEnvelopeBytesSha256,
    qualificationMetricsIncluded: false,
  };
  return { ...core, evaluationArtifactSha256: hashCanonical(core) };
}

function validateEvaluation(value: Imp24ETransportSmokeEvaluationV1): void {
  const { evaluationArtifactSha256, ...core } = value;
  requireCondition(value.schema === IMP24E_TRANSPORT_SMOKE_EVALUATION_SCHEMA
      && SHA256.test(value.requestSha256)
      && SHA256.test(value.receiptSha256)
      && SHA256.test(value.executionEvidenceSha256)
      && (value.rawOutputSha256 === null || SHA256.test(value.rawOutputSha256))
      && (!value.schemaValid || value.parsedJson)
      && value.qualificationMetricsIncluded === false
      && SHA256.test(evaluationArtifactSha256)
      && evaluationArtifactSha256 === hashCanonical(core),
  "IMP-24E smoke metric-free evaluation drift");
}

function relativeFromRoot(root: string, path: string): string {
  return relative(resolve(root), resolve(path)).split(sep).join("/");
}

export function inspectRetainedImp24ETransportSmokeCall(args: {
  repositoryRoot: string;
  phaseDir: string;
  executionId: Imp24ETransportSmokeExecutionId;
  expected: Imp24ETransportSmokeCallBindingV1;
}): Imp24ETransportSmokeCallV1 {
  const smokeScheduleId = `${args.executionId}-${args.expected.role}-canary`;
  const attemptId = `${smokeScheduleId}-a1`;
  const attemptDir = resolve(args.phaseDir, "attempts", attemptId);
  const errors: string[] = [];
  const capture = (work: () => void): void => { try { work(); } catch (error) { errors.push((error as Error).message); } };
  const load = <T>(name: string): T | null => {
    try { return readJson<T>(resolve(attemptDir, name), `${attemptId} ${name}`); }
    catch (error) { errors.push((error as Error).message); return null; }
  };
  capture(() => {
    requireCondition(existsSync(attemptDir), `${attemptId}: attempt directory is missing`);
    const names = readdirSync(attemptDir).sort();
    requireCondition(hashCanonical(names) === hashCanonical([...COMPLETE_ATTEMPT_FILES].sort()),
      `${attemptId}: exact seven-file smoke evidence is required`);
    requireCondition(names.every((name) => {
      const stat = lstatSync(resolve(attemptDir, name));
      return stat.isFile() && !stat.isSymbolicLink();
    }), `${attemptId}: smoke evidence must be regular non-symlink files`);
  });
  const request = load<LiveQualificationExecutionRequestV3>("request.json");
  const receipt = load<QualificationExecutionReceiptV3>("receipt.json");
  const diagnostics = load<CodexProcessDiagnosticsV1>("process-diagnostics.json");
  const execution = load<LiveAttemptExecutionEvidenceV3>("execution-evidence.json");
  const retention = load<LiveAttemptRetentionV3>("retention.json");
  const evaluation = load<Imp24ETransportSmokeEvaluationV1>("evaluation.json");
  let ledger: LiveCallLedgerV3 | null = null;
  let preflight: LiveQualificationPreflightV3 | null = null;
  try { ledger = readJson(resolve(args.phaseDir, "call-ledger.json"), "IMP-24E smoke call ledger"); }
  catch (error) { errors.push((error as Error).message); }
  try { preflight = readJson(resolve(args.phaseDir, "preflight.json"), "IMP-24E smoke preflight"); }
  catch (error) { errors.push((error as Error).message); }

  let requestedAt = "";
  let completedAt = "";
  let processDiagnosticsComplete = false;
  let executionEvidenceValid = false;
  let chatgptAuthVerified = false;
  if (ledger !== null) {
    capture(() => requireCondition(ledger!.schema === IMP24_LIVE_CALL_LEDGER_SCHEMA
        && ledger!.experimentId === args.executionId
        && ledger!.entries.length === 2
        && ledger!.brokerRequests === 2
        && ledger!.infrastructureReplays === 0
        && ledger!.apiCallsMade === 0,
    `${attemptId}: call ledger identity/count drift`));
    const entry = ledger.entries.find((item) => item.attemptId === attemptId);
    if (entry) { requestedAt = entry.requestedAt; completedAt = entry.completedAt ?? ""; }
    else errors.push(`${attemptId}: call ledger entry missing`);
  }
  if (preflight !== null) {
    capture(() => {
      validateLiveQualificationPreflightArtifactV3(preflight!, args.executionId);
      chatgptAuthVerified = preflight!.executionRoute === "codex_exec_chatgpt_subscription"
        && preflight!.authMode === "chatgpt"
        && preflight!.apiKeyPresent === false
        && preflight!.apiFallbackAllowed === false
        && preflight!.directHttpOrSdkAllowed === false;
    });
  }
  if (request !== null && receipt !== null) {
    capture(() => {
      requireCondition(request!.experimentId === args.executionId
          && request!.role === args.expected.role
          && request!.partition === "canary"
          && request!.scheduleId === smokeScheduleId
          && request!.attemptId === attemptId
          && request!.attemptNumber === 1
          && request!.replayOfAttemptId === null
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
      `${attemptId}: fixed canary request binding drift`);
      validateQualificationReceiptArtifactV3({ request: request!, receipt: receipt!, label: attemptId });
      requireCondition(readFileSync(resolve(attemptDir, "evidence-envelope.json"), "utf8")
          === request!.evidenceEnvelopeBytes,
      `${attemptId}: inline evidence envelope bytes drift`);
    });
  }
  if (request !== null && receipt !== null && diagnostics !== null && execution !== null && retention !== null) {
    capture(() => {
      validateCodexProcessDiagnosticsV1(diagnostics!, {
        attemptId,
        requestSha256: request!.requestSha256,
        sessionId: execution!.sessionId,
        classification: receipt!.status,
      });
      const { retentionSha256, ...retentionCore } = retention!;
      requireCondition(retentionSha256 === hashCanonical(retentionCore)
          && retention!.requestSha256 === request!.requestSha256
          && retention!.receiptSha256 === receipt!.receiptSha256
          && retention!.processDiagnosticsSha256 === diagnostics!.diagnosticsSha256
          && retention!.executionEvidenceSha256 === execution!.executionEvidenceSha256,
      `${attemptId}: process diagnostics retention binding drift`);
      processDiagnosticsComplete = true;
    });
    capture(() => {
      validateExecutionEvidenceArtifact({
        phaseDir: args.phaseDir,
        request: request!,
        receipt: receipt!,
        processDiagnostics: diagnostics!,
        artifact: execution!,
        ...(preflight === null ? {} : { preflight }),
      });
      executionEvidenceValid = true;
    });
  }
  if (evaluation !== null) capture(() => validateEvaluation(evaluation!));
  if (ledger !== null && request !== null && receipt !== null && diagnostics !== null
      && execution !== null && evaluation !== null) {
    capture(() => {
      const entry = ledger!.entries.find((item) => item.attemptId === attemptId);
      requireCondition(entry?.requestSha256 === request!.requestSha256
          && entry.receiptSha256 === receipt!.receiptSha256
          && entry.processDiagnosticsSha256 === diagnostics!.diagnosticsSha256
          && entry.executionEvidenceSha256 === execution!.executionEvidenceSha256
          && entry.evaluationArtifactSha256 === evaluation!.evaluationArtifactSha256,
      `${attemptId}: call ledger evidence hashes drift`);
    });
  }

  const authoritativeOutputFileProduced = receipt?.status === "completed"
    && execution?.invocation === "RUNNER_RETURNED"
    && execution.finalMessageSource === "output-file"
    && execution.responseProduced === true
    && typeof receipt.rawOutput === "string";
  const schemaValidJson = evaluation?.parsedJson === true && evaluation.schemaValid === true;
  const envelopeAndSidecarsBound = executionEvidenceValid
    && evaluation?.envelopeBound === true
    && execution?.schemaBoundAtRunner === true
    && execution.effectiveContextManifest !== null
    && execution.routeSidecar !== null
    && execution.structuredOutputSidecar !== null
    && execution.resultSidecar !== null;
  const runnerBoundaryCrossed = diagnostics?.invocation !== "NOT_INVOKED"
    && typeof diagnostics?.sessionId === "string";
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
  ].join("; ").slice(0, 8_000) || "transport smoke failed without complete retained evidence";
  return {
    role: args.expected.role,
    sourceScheduleId: args.expected.sourceScheduleId,
    smokeScheduleId,
    attemptId,
    profileId: request?.profileId ?? args.expected.profileId,
    model: request?.model ?? args.expected.model,
    effort: request?.effort ?? args.expected.effort,
    requestSha256: request?.requestSha256 ?? "",
    receiptSha256: receipt?.receiptSha256 ?? null,
    receiptStatus: receipt?.status ?? null,
    processDiagnosticsRelPath: relativeFromRoot(args.repositoryRoot, resolve(attemptDir, "process-diagnostics.json")),
    processDiagnosticsSha256: diagnostics?.diagnosticsSha256 ?? null,
    executionEvidenceSha256: execution?.executionEvidenceSha256 ?? null,
    evaluationArtifactSha256: evaluation?.evaluationArtifactSha256 ?? null,
    requestedAt,
    completedAt,
    runnerBoundaryCrossed,
    chatgptAuthVerified,
    processDiagnosticsComplete,
    authoritativeOutputFileProduced,
    schemaValidJson,
    envelopeAndSidecarsBound,
    qualificationMetricsIncluded: false,
    apiCalls: 0,
    passed,
    failureClassification: passed ? null : receipt?.status ?? "retained_evidence_incomplete",
    failureDetail,
    diagnostics: {
      invocation: diagnostics?.invocation ?? null,
      classification: diagnostics?.classification ?? null,
      failureKind: diagnostics?.failureKind ?? null,
      errorName: diagnostics?.errorName ?? null,
      errorMessage: diagnostics?.errorMessage ?? null,
      timedOut: diagnostics?.timedOut ?? null,
      exitCode: diagnostics?.exitCode ?? null,
      stdoutBytes: diagnostics?.stdoutBytes ?? null,
      stdoutSha256: diagnostics?.stdoutSha256 ?? null,
      stderrBytes: diagnostics?.stderrBytes ?? null,
      stderrSha256: diagnostics?.stderrSha256 ?? null,
    },
  };
}

export function validateImp24ETransportSmokeCycle(value: Imp24ETransportSmokeCycleV1): void {
  const expectedId = executionIdForCycle(value.cycle);
  const callShapeValid = (call: Imp24ETransportSmokeCallV1, role: Imp24ETransportSmokeRole): boolean => {
    const smokeScheduleId = `${expectedId}-${role}-canary`;
    const successful = call.receiptStatus === "completed"
      && call.runnerBoundaryCrossed
      && call.chatgptAuthVerified
      && call.processDiagnosticsComplete
      && call.authoritativeOutputFileProduced
      && call.schemaValidJson
      && call.envelopeAndSidecarsBound;
    return call.role === role
      && call.sourceScheduleId.length > 0
      && call.smokeScheduleId === smokeScheduleId
      && call.attemptId === `${smokeScheduleId}-a1`
      && call.profileId.length > 0 && call.model.length > 0 && call.effort.length > 0
      && SHA256.test(call.requestSha256)
      && typeof call.receiptSha256 === "string" && SHA256.test(call.receiptSha256)
      && typeof call.processDiagnosticsSha256 === "string" && SHA256.test(call.processDiagnosticsSha256)
      && typeof call.executionEvidenceSha256 === "string" && SHA256.test(call.executionEvidenceSha256)
      && typeof call.evaluationArtifactSha256 === "string" && SHA256.test(call.evaluationArtifactSha256)
      && Number.isFinite(Date.parse(call.requestedAt))
      && Number.isFinite(Date.parse(call.completedAt))
      && Date.parse(call.requestedAt) <= Date.parse(call.completedAt)
      && call.processDiagnosticsRelPath.endsWith(`/attempts/${call.attemptId}/process-diagnostics.json`)
      && call.qualificationMetricsIncluded === false
      && call.apiCalls === 0
      && call.passed === successful
      && (call.passed
        ? call.failureClassification === null && call.failureDetail === null
        : typeof call.failureClassification === "string" && call.failureClassification.length > 0
          && typeof call.failureDetail === "string" && call.failureDetail.length > 0)
      && typeof call.diagnostics.invocation === "string"
      && typeof call.diagnostics.classification === "string"
      && typeof call.diagnostics.timedOut === "boolean"
      && Number.isSafeInteger(call.diagnostics.stdoutBytes) && call.diagnostics.stdoutBytes! >= 0
      && typeof call.diagnostics.stdoutSha256 === "string" && SHA256.test(call.diagnostics.stdoutSha256)
      && Number.isSafeInteger(call.diagnostics.stderrBytes) && call.diagnostics.stderrBytes! >= 0
      && typeof call.diagnostics.stderrSha256 === "string" && SHA256.test(call.diagnostics.stderrSha256);
  };
  requireCondition(value?.schema === IMP24E_TRANSPORT_SMOKE_CYCLE_SCHEMA
      && value.executionId === expectedId
      && value.stateRoot === imp24ETransportSmokeStateRootRelPath(expectedId)
      && GIT_SHA.test(value.implementationCommit)
      && Number.isSafeInteger(value.workflowRunId) && value.workflowRunId > 0
      && Number.isFinite(Date.parse(value.implementationCiVerifiedAt))
      && SHA256.test(value.implementationCiGateSha256)
      && SHA256.test(value.schemaProbeCycleSha256)
      && GIT_SHA.test(value.schemaProbeImplementationCommit)
      && SHA256.test(value.inputBindingSha256)
      && SHA256.test(value.candidateAvailabilitySemanticSha256)
      && (value.candidateAvailabilityProvenanceSha256 === null
        || SHA256.test(value.candidateAvailabilityProvenanceSha256))
      && SHA256.test(value.preflightSha256)
      && SHA256.test(value.qualificationFreezeSha256)
      && SHA256.test(value.certificationSha256)
      && SHA256.test(value.productionInstrumentSealSha256)
      && SHA256.test(value.productionQualificationParitySha256)
      && SHA256.test(value.callLedgerSha256)
      && value.calls.length === 2
      && callShapeValid(value.calls[0], "reader")
      && callShapeValid(value.calls[1], "source")
      && value.calls.every((call) => call.qualificationMetricsIncluded === false
        && call.apiCalls === 0
        && call.processDiagnosticsComplete
        && typeof call.processDiagnosticsSha256 === "string"
        && SHA256.test(call.processDiagnosticsSha256))
      && value.brokerRequests === 2
      && Number.isSafeInteger(value.codexExecInvocations)
      && value.codexExecInvocations >= 0 && value.codexExecInvocations <= 2
      && value.processDiagnosticsSetSha256 === hashCanonical(
        value.calls.map((call) => call.processDiagnosticsSha256),
      )
      && value.qualificationMetricsIncluded === false
      && value.qualificationArtifactsCreated === false
      && value.apiCalls === 0
      && value.status === (value.calls.every((call) => call.passed) ? "PASS" : "FAIL")
      && Number.isFinite(Date.parse(value.startedAt))
      && Number.isFinite(Date.parse(value.completedAt))
      && Date.parse(value.implementationCiVerifiedAt) < Date.parse(value.startedAt)
      && Date.parse(value.startedAt) <= Date.parse(value.completedAt),
  "IMP-24E transport-smoke cycle identity/count/status drift");
  const { cycleSha256, ...core } = value;
  requireCondition(SHA256.test(cycleSha256) && cycleSha256 === hashCanonical(core),
    "IMP-24E transport-smoke cycle self hash drift");
}

export function buildImp24ETransportSmokeReport(cycles: Imp24ETransportSmokeCycleV1[]): Imp24ETransportSmokeReportV1 {
  requireCondition(cycles.length === 1 || cycles.length === 2, "IMP-24E smoke report requires one or two cycles");
  cycles.forEach(validateImp24ETransportSmokeCycle);
  requireCondition(cycles[0]?.cycle === 1
      && (cycles.length === 1 || cycles[0].status === "FAIL"
        && cycles[1]?.cycle === 2
        && cycles[0].implementationCommit !== cycles[1].implementationCommit
        && cycles[0].candidateAvailabilitySemanticSha256
          === cycles[1].candidateAvailabilitySemanticSha256
        && hashCanonical(cycles[0].calls.map((call) => ({
          role: call.role,
          sourceScheduleId: call.sourceScheduleId,
          profileId: call.profileId,
          model: call.model,
          effort: call.effort,
        }))) === hashCanonical(cycles[1].calls.map((call) => ({
          role: call.role,
          sourceScheduleId: call.sourceScheduleId,
          profileId: call.profileId,
          model: call.model,
          effort: call.effort,
        })))),
  "IMP-24E smoke report repeat chronology drift");
  const final = cycles[cycles.length - 1]!;
  const core: Omit<Imp24ETransportSmokeReportV1, "reportSha256"> = {
    schema: IMP24E_TRANSPORT_SMOKE_REPORT_SCHEMA,
    status: final.status,
    cycles,
    totalBrokerRequests: (cycles.length * 2) as 2 | 4,
    totalCodexExecInvocations: cycles.reduce((sum, cycle) => sum + cycle.codexExecInvocations, 0),
    maximumCallsPerCycle: 2,
    maximumCycles: 2,
    maximumCallsAuthorized: 4,
    qualificationMetricsIncluded: false,
    qualificationArtifactsCreated: false,
    apiCalls: 0,
  };
  return { ...core, reportSha256: hashCanonical(core) };
}

export function renderImp24ETransportSmokeReport(report: Imp24ETransportSmokeReportV1): string {
  const lines = [
    "# IMP-24E Transport Smoke Result",
    "",
    `- Status: **${report.status}**`,
    `- Cycles: **${report.cycles.length}/2 maximum**`,
    `- Calls: **${report.totalBrokerRequests}/4 maximum**`,
    `- Codex exec invocations: **${report.totalCodexExecInvocations}**`,
    "- API calls: **0**",
    "- Qualification metrics: **excluded**",
    "- Qualification artifacts created: **false**",
    "",
  ];
  for (const cycle of report.cycles) {
    lines.push(`## Cycle ${cycle.cycle}: ${cycle.status}`, "");
    lines.push(`- Exact CI: run **${cycle.workflowRunId}**, commit \`${cycle.implementationCommit}\``);
    for (const call of cycle.calls) {
      lines.push(`- ${call.role}: **${call.passed ? "PASS" : "FAIL"}** — \`${call.profileId}\``);
      lines.push(`  - process diagnostics: \`${call.processDiagnosticsRelPath}\``);
    }
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

function persistReport(root: string, report: Imp24ETransportSmokeReportV1): void {
  writeFileAtomic(resolve(root, IMP24E_TRANSPORT_SMOKE_REPORT_JSON_REL_PATH), pretty(report));
  writeFileAtomic(resolve(root, IMP24E_TRANSPORT_SMOKE_REPORT_MARKDOWN_REL_PATH),
    renderImp24ETransportSmokeReport(report));
}

function finalPassedSchemaProbe(args: {
  repositoryRoot: string;
  retainedArtifactRoot: string;
}): Imp24ESchemaProbeCycleV1 {
  const cycle2 = imp24ESchemaProbePaths(args.retainedArtifactRoot, 2).cycleResult;
  const cycle = verifyRetainedImp24ESchemaProbeCycle({
    repositoryRoot: args.repositoryRoot,
    retainedArtifactRoot: args.retainedArtifactRoot,
    cycle: existsSync(cycle2) ? 2 : 1,
  });
  requireCondition(cycle.status === "PASS", "IMP-24E transport smoke requires retained three-role schema-probe PASS");
  return cycle;
}

export function verifyRetainedImp24ETransportSmokeCycle(args: {
  repositoryRoot: string;
  retainedArtifactRoot?: string;
  cycle: Imp24ETransportSmokeCycleNumber;
}): Imp24ETransportSmokeCycleV1 {
  const root = resolve(args.retainedArtifactRoot ?? args.repositoryRoot);
  const executionId = executionIdForCycle(args.cycle);
  const cycle = readJson<Imp24ETransportSmokeCycleV1>(
    resolve(root, imp24ETransportSmokeCycleResultRelPath(executionId)),
    `IMP-24E smoke cycle ${args.cycle}`,
  );
  validateImp24ETransportSmokeCycle(cycle);
  const gate = readJson<Imp24ImplementationCiGateV1>(
    resolve(root, imp24ETransportSmokeStateRootRelPath(executionId), "implementation-ci-gate.json"),
    `IMP-24E smoke cycle ${args.cycle} CI gate`,
  );
  validateImp24ImplementationCiGate({ gate, expectedHeadSha: cycle.implementationCommit, checkout: gate.trustedEvidence.raw.checkout });
  const binding = readJson<Imp24ETransportSmokeBindingV1>(
    resolve(root, imp24ETransportSmokeStateRootRelPath(executionId), "smoke-input-binding.json"),
    `IMP-24E smoke cycle ${args.cycle} binding`,
  );
  const { inputBindingSha256, ...bindingCore } = binding;
  requireCondition(binding.schema === IMP24E_TRANSPORT_SMOKE_BINDING_SCHEMA
      && binding.cycle === cycle.cycle
      && binding.executionId === cycle.executionId
      && inputBindingSha256 === hashCanonical(bindingCore)
      && inputBindingSha256 === cycle.inputBindingSha256,
  `IMP-24E smoke cycle ${args.cycle} input binding drift`);
  const calls = binding.calls.map((expected) => inspectRetainedImp24ETransportSmokeCall({
    repositoryRoot: root,
    phaseDir: resolve(root, imp24ETransportSmokeStateRootRelPath(executionId), "live"),
    executionId,
    expected,
  })) as [Imp24ETransportSmokeCallV1, Imp24ETransportSmokeCallV1];
  requireCondition(hashCanonical(calls) === hashCanonical(cycle.calls),
    `IMP-24E smoke cycle ${args.cycle} call summaries differ from retained evidence`);
  return cycle;
}

/** Final qualification handoff gate. It selects the one authorized repeat only
 * when that repeat has a complete terminal artifact, deeply re-verifies every
 * retained call, and requires the deterministic aggregate report to match. */
export function verifyFinalPassedImp24ETransportSmoke(args: {
  repositoryRoot: string;
  retainedArtifactRoot?: string;
}): Imp24ETransportSmokeCycleV1 {
  const retainedArtifactRoot = resolve(args.retainedArtifactRoot ?? args.repositoryRoot);
  const r2Root = resolve(retainedArtifactRoot,
    imp24ETransportSmokeStateRootRelPath(IMP24E_TRANSPORT_SMOKE_R2_EXECUTION_ID));
  const r2Result = resolve(retainedArtifactRoot,
    imp24ETransportSmokeCycleResultRelPath(IMP24E_TRANSPORT_SMOKE_R2_EXECUTION_ID));
  requireCondition(!existsSync(r2Root) || existsSync(r2Result),
    "IMP-24E final smoke verifier refuses a partial r2 state root");
  const finalCycleNumber: Imp24ETransportSmokeCycleNumber = existsSync(r2Result) ? 2 : 1;
  const finalCycle = verifyRetainedImp24ETransportSmokeCycle({
    repositoryRoot: args.repositoryRoot,
    retainedArtifactRoot,
    cycle: finalCycleNumber,
  });
  const cycles = finalCycleNumber === 1
    ? [finalCycle]
    : [
      verifyRetainedImp24ETransportSmokeCycle({
        repositoryRoot: args.repositoryRoot,
        retainedArtifactRoot,
        cycle: 1,
      }),
      finalCycle,
    ];
  const expectedReport = buildImp24ETransportSmokeReport(cycles);
  requireCondition(finalCycle.status === "PASS" && expectedReport.status === "PASS",
    "IMP-24E final transport smoke has not passed");
  const reportJsonPath = resolve(retainedArtifactRoot, IMP24E_TRANSPORT_SMOKE_REPORT_JSON_REL_PATH);
  const reportMarkdownPath = resolve(retainedArtifactRoot, IMP24E_TRANSPORT_SMOKE_REPORT_MARKDOWN_REL_PATH);
  requireCondition(existsSync(reportJsonPath) && existsSync(reportMarkdownPath),
    "IMP-24E final transport-smoke aggregate report is missing");
  requireCondition(readFileSync(reportJsonPath, "utf8") === pretty(expectedReport)
      && readFileSync(reportMarkdownPath, "utf8") === renderImp24ETransportSmokeReport(expectedReport),
  "IMP-24E final transport-smoke aggregate report differs from retained call evidence");
  return finalCycle;
}

export async function runImp24ETransportSmoke(
  args: RunImp24ETransportSmokeArgs,
  deps: Imp24ETransportSmokeDeps = {},
): Promise<RunImp24ETransportSmokeResult> {
  if (args.executeLive !== true) {
    return { code: 2, executed: false, cycle: args.cycle, cycleResult: null, report: null, modelCalls: 0, apiCalls: 0,
      message: "IMP-24E transport smoke requires literal --execute-live" };
  }
  requireCondition(args.cycle === 1 || args.cycle === 2, "IMP-24E transport smoke permits only cycle 1 or 2");
  requireCondition(GIT_SHA.test(args.expectedHeadSha), "IMP-24E smoke expected HEAD must be a lowercase 40-character git SHA");
  requireCondition(Number.isSafeInteger(args.workflowRunId) && args.workflowRunId > 0,
    "IMP-24E smoke workflow run ID must be positive");
  const repositoryRoot = resolve(args.repositoryRoot);
  const retainedArtifactRoot = resolve(deps.retainedArtifactRoot ?? repositoryRoot);
  const executionId = executionIdForCycle(args.cycle);
  const root = resolve(retainedArtifactRoot, imp24ETransportSmokeStateRootRelPath(executionId));
  const cyclePath = resolve(retainedArtifactRoot, imp24ETransportSmokeCycleResultRelPath(executionId));
  if (existsSync(root)) {
    requireCondition(existsSync(cyclePath), `IMP-24E smoke ${executionId} root is partial; replay is refused`);
    const cycle = verifyRetainedImp24ETransportSmokeCycle({ repositoryRoot, retainedArtifactRoot, cycle: args.cycle });
    requireCondition(cycle.implementationCommit === args.expectedHeadSha && cycle.workflowRunId === args.workflowRunId,
      "retained IMP-24E smoke belongs to a different exact CI gate");
    const cycles = args.cycle === 1
      ? [cycle]
      : [verifyRetainedImp24ETransportSmokeCycle({ repositoryRoot, retainedArtifactRoot, cycle: 1 }), cycle];
    const report = buildImp24ETransportSmokeReport(cycles);
    persistReport(retainedArtifactRoot, report);
    return { code: cycle.status === "PASS" ? 0 : 1, executed: false, cycle: args.cycle,
      cycleResult: cycle, report, modelCalls: 0, apiCalls: 0,
      message: `IMP-24E smoke cycle ${args.cycle} retained evidence verified; no calls made` };
  }
  const qualificationRoot = resolve(retainedArtifactRoot, STATE_REL, IMP24_ROLE_QUALIFICATION_EXECUTION_ID);
  requireCondition(!existsSync(qualificationRoot),
    "IMP-24E smoke refuses because final qualification state exists before smoke PASS");
  let firstCycle: Imp24ETransportSmokeCycleV1 | null = null;
  if (args.cycle === 2) {
    firstCycle = verifyRetainedImp24ETransportSmokeCycle({ repositoryRoot, retainedArtifactRoot, cycle: 1 });
    requireCondition(firstCycle.status === "FAIL", "IMP-24E smoke repeat is forbidden after cycle 1 PASS");
    requireCondition(firstCycle.implementationCommit !== args.expectedHeadSha,
      "IMP-24E smoke repeat requires a different exact-CI correction commit");
  }
  const schemaProbe = finalPassedSchemaProbe({ repositoryRoot, retainedArtifactRoot });
  requireCondition(args.cycle === 1
    ? schemaProbe.implementationCommit === args.expectedHeadSha && schemaProbe.workflowRunId === args.workflowRunId
    : schemaProbe.implementationCommit === args.expectedHeadSha
      || schemaProbe.implementationCommit === firstCycle!.implementationCommit,
  "IMP-24E smoke is not preceded by a schema-probe PASS on the compatible implementation lineage");

  const now = (): Date => {
    const date = deps.clock?.() ?? new Date();
    requireCondition(date instanceof Date && Number.isFinite(date.getTime()), "IMP-24E smoke clock is invalid");
    return date;
  };
  const collect = deps.collectImplementationCiGate ?? collectImp24ImplementationCiGate;
  const gate = collect({ repositoryRoot, expectedHeadSha: args.expectedHeadSha,
    workflowRunId: args.workflowRunId, verifiedAt: now().toISOString() });
  validateImp24ImplementationCiGate({ gate, expectedHeadSha: args.expectedHeadSha, checkout: gate.trustedEvidence.raw.checkout });
  const startedAtDate = new Date(Math.max(now().getTime(), Date.parse(gate.verifiedAt) + 1, Date.parse(schemaProbe.completedAt) + 1));
  const prepare = deps.prepare ?? prepareLiveRoleQualificationV3;
  const prepared = prepare({ repositoryRoot, input: args.loadInput() });
  const plan = buildRoleQualificationPlanV3(prepared.input);
  const binding = buildImp24ETransportSmokeBinding({
    cycle: args.cycle,
    input: prepared.input,
    freeze: plan.freeze,
    schedule: plan.schedule,
  });
  if (firstCycle !== null) {
    const firstBinding = readJson<Imp24ETransportSmokeBindingV1>(
      resolve(retainedArtifactRoot, imp24ETransportSmokeStateRootRelPath(IMP24E_TRANSPORT_SMOKE_EXECUTION_ID), "smoke-input-binding.json"),
      "IMP-24E first smoke binding",
    );
    requireCondition(firstBinding.candidateAvailabilitySemanticSha256 === binding.candidateAvailabilitySemanticSha256
        && hashCanonical(firstBinding.calls) === hashCanonical(binding.calls),
    "IMP-24E correction smoke changed candidate semantics or either fixed canary binding");
  }
  mkdirSync(root, { recursive: true });
  persistExact(resolve(root, "implementation-ci-gate.json"), gate, "IMP-24E smoke CI gate");
  persistExact(resolve(root, "smoke-input-binding.json"), binding, "IMP-24E smoke input binding");
  const phaseDir = resolve(root, "live");
  const runPreflight = deps.preflight ?? preflightLiveRoleQualificationV3;
  const preflight = await runPreflight(prepared.input, {
    ...args.preflight,
    repositoryRoot,
    executionId,
    verifiedAt: startedAtDate.toISOString(),
  });
  const semanticSha256 = candidateAvailabilitySemanticSha256(prepared.input.candidateAvailability);
  requireCondition(preflight.experimentId === executionId
      && preflight.freezeSha256 === plan.freeze.freezeSha256
      && (preflight.candidateAvailabilitySemanticSha256 ?? preflight.candidateAvailabilitySha256) === semanticSha256,
  "IMP-24E smoke preflight is not bound to exact identity/freeze/availability semantics");
  persistExact(resolve(phaseDir, "preflight.json"), preflight, "IMP-24E smoke preflight");
  const createExecutor = deps.createExecutor ?? createLiveQualificationExecutorV3;
  const live = createExecutor({
    phaseDir,
    executionId,
    freezeSha256: plan.freeze.freezeSha256,
    certificationSha256: plan.freeze.certificationSha256,
    productionInstrumentSealSha256: plan.freeze.productionInstrumentSealSha256,
    repositoryRoot,
    productionInstrumentSeal: prepared.input.productionInstrumentSeal,
    authJsonPath: args.preflight.authJsonPath,
  });
  const requests = binding.calls.map((call) => buildSmokeRequest({
    executionId,
    binding: call,
    input: prepared.input,
    freeze: plan.freeze,
    schedule: plan.schedule,
  })) as [LiveQualificationExecutionRequestV3, LiveQualificationExecutionRequestV3];
  await Promise.allSettled(requests.map(async (request, index) => {
    let receipt: QualificationExecutionReceiptV3 | null = null;
    try { receipt = await live.controlExecutor(request); }
    catch {
      const receiptPath = resolve(phaseDir, "attempts", request.attemptId, "receipt.json");
      if (existsSync(receiptPath)) receipt = readJson(receiptPath, `${request.attemptId} receipt`);
    }
    if (receipt === null) return;
    const entry = live.ledger.entries.find((item) => item.attemptId === request.attemptId);
    requireCondition(entry !== undefined
        && entry.receiptSha256 === receipt!.receiptSha256
        && typeof entry.executionEvidenceSha256 === "string",
    `${request.attemptId}: smoke evaluation lacks complete call evidence`);
    const evaluation = buildEvaluation({
      request,
      receipt,
      executionEvidenceSha256: entry.executionEvidenceSha256,
      ...inspectOutput(binding.calls[index]!.role, receipt.rawOutput),
    });
    persistExact(resolve(phaseDir, "attempts", request.attemptId, "evaluation.json"), evaluation,
      `${request.attemptId} metric-free evaluation`);
    entry.evaluationArtifactSha256 = evaluation.evaluationArtifactSha256;
    writeFileAtomic(live.ledgerPath, pretty(live.ledger));
  }));
  requireCondition(live.ledger.entries.length === 2
      && live.ledger.brokerRequests === 2
      && live.ledger.infrastructureReplays === 0
      && live.ledger.apiCallsMade === 0,
  "IMP-24E smoke did not retain exactly two requests with zero replay/API calls");
  const inspect = deps.inspectCall ?? inspectRetainedImp24ETransportSmokeCall;
  const calls = binding.calls.map((expected) => inspect({
    repositoryRoot: retainedArtifactRoot,
    phaseDir,
    executionId,
    expected,
  })) as [Imp24ETransportSmokeCallV1, Imp24ETransportSmokeCallV1];
  const latestCompleted = Math.max(...live.ledger.entries.map((entry) =>
    entry.completedAt === null ? 0 : Date.parse(entry.completedAt)));
  const completedAt = new Date(Math.max(now().getTime(), startedAtDate.getTime(), latestCompleted)).toISOString();
  const cycleCore: Omit<Imp24ETransportSmokeCycleV1, "cycleSha256"> = {
    schema: IMP24E_TRANSPORT_SMOKE_CYCLE_SCHEMA,
    cycle: args.cycle,
    executionId,
    stateRoot: imp24ETransportSmokeStateRootRelPath(executionId),
    implementationCommit: args.expectedHeadSha,
    workflowRunId: args.workflowRunId,
    implementationCiVerifiedAt: gate.verifiedAt,
    implementationCiGateSha256: gate.gateSha256,
    schemaProbeCycleSha256: schemaProbe.cycleSha256,
    schemaProbeImplementationCommit: schemaProbe.implementationCommit,
    inputBindingSha256: binding.inputBindingSha256,
    candidateAvailabilitySemanticSha256: binding.candidateAvailabilitySemanticSha256,
    candidateAvailabilityProvenanceSha256: binding.candidateAvailabilityProvenanceSha256,
    preflightSha256: preflight.preflightSha256,
    qualificationFreezeSha256: plan.freeze.freezeSha256,
    certificationSha256: plan.freeze.certificationSha256,
    productionInstrumentSealSha256: plan.freeze.productionInstrumentSealSha256,
    productionQualificationParitySha256: plan.freeze.productionQualificationParitySha256,
    callLedgerSha256: hashCanonical(live.ledger),
    calls,
    brokerRequests: 2,
    codexExecInvocations: live.ledger.codexExecInvocations,
    processDiagnosticsSetSha256: hashCanonical(calls.map((call) => call.processDiagnosticsSha256)),
    qualificationMetricsIncluded: false,
    qualificationArtifactsCreated: false,
    apiCalls: 0,
    status: calls.every((call) => call.passed) ? "PASS" : "FAIL",
    startedAt: startedAtDate.toISOString(),
    completedAt,
  };
  const cycleResult = { ...cycleCore, cycleSha256: hashCanonical(cycleCore) };
  validateImp24ETransportSmokeCycle(cycleResult);
  persistExact(cyclePath, cycleResult, "IMP-24E smoke cycle result");
  const report = buildImp24ETransportSmokeReport(firstCycle === null ? [cycleResult] : [firstCycle, cycleResult]);
  persistReport(retainedArtifactRoot, report);
  requireCondition(!existsSync(qualificationRoot), "IMP-24E smoke created qualification state before PASS handoff");
  return {
    code: cycleResult.status === "PASS" ? 0 : 1,
    executed: true,
    cycle: args.cycle,
    cycleResult,
    report,
    modelCalls: live.ledger.codexExecInvocations,
    apiCalls: 0,
    message: cycleResult.status === "PASS"
      ? "IMP-24E fixed two-call transport smoke passed"
      : "IMP-24E fixed two-call transport smoke failed; inspect retained process diagnostics",
  };
}
