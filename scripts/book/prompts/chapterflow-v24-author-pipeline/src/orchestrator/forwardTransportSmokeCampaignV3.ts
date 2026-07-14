/** IMP-24D fixed two-call transport-smoke conductor. */

import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { canonicalJson, hashCanonical, sha256Hex } from "../contracts/contractUtil.js";
import { writeFileAtomic } from "../lib/atomicWrite.js";
import {
  IMP24_ROLE_CANDIDATE_ORDER,
  buildQualificationExecutionRequestV3,
  buildLegacyRoleQualificationPlanV3,
  candidateAvailabilitySemanticSha256,
  type LegacyQualificationFreezeV3,
  type QualificationExecutionReceiptV3,
  type QualificationFreezeV3,
  type QualificationScheduleEntryV3,
  type RunRoleQualificationInputV3,
} from "../bakeoff/migration/roleQualificationRunnerV3.js";
import { IMP24_ROLE_QUALIFICATION_R2_EXECUTION_ID } from "../bakeoff/migration/imp24Corpus.js";
import {
  parseReaderExperienceModelOutputV2,
  parseSourceIntegrityModelOutputV2,
} from "../review/reviewModelOutputV2.js";
import {
  collectImp24ImplementationCiGate,
  validateImp24ImplementationCiGate,
} from "./forwardRoleQualificationCampaignV3.js";
import {
  IMP24D_TRANSPORT_SMOKE_EXECUTION_ID,
  IMP24D_TRANSPORT_SMOKE_R2_EXECUTION_ID,
  createLiveQualificationExecutorV3,
  prepareLiveRoleQualificationV3,
  preflightLiveRoleQualificationV3,
  type LiveQualificationExecutionRequestV3,
  type LiveQualificationPreflightV3,
  type UnpreparedLiveRoleQualificationInputV3,
} from "./forwardRoleQualificationLiveV3.js";
import {
  IMP24D_TRANSPORT_SMOKE_INPUT_BINDING_SCHEMA,
  IMP24D_TRANSPORT_SMOKE_REPORT_JSON_REL_PATH,
  IMP24D_TRANSPORT_SMOKE_REPORT_MARKDOWN_REL_PATH,
  buildImp24DTransportSmokePreflightFailure,
  buildImp24DTransportSmokeEvaluation,
  canonicalImp24DTransportSmokeReport,
  imp24DTransportSmokeCycleResultRelPath,
  imp24DTransportSmokeStateRootRelPath,
  inspectRetainedImp24DTransportSmokeCall,
  renderImp24DTransportSmokeReportMarkdown,
  sanitizeImp24DTransportSmokePreflightErrorText,
  validateImp24DTransportSmokeCycle,
  validateImp24DTransportSmokeInputBinding,
  validateImp24DTransportSmokeReport,
  validateImp24DTransportMechanicalCorrection,
  verifyImp24DTransportMechanicalCorrectionOwnership,
  verifyRetainedImp24DTransportSmokeCycle,
  type Imp24DTransportSmokeCallV1,
  type Imp24DTransportSmokeCycleNumber,
  type Imp24DTransportSmokeCycleV1,
  type Imp24DTransportSmokeInputBindingV1,
  type Imp24DTransportSmokePreflightFailureV1,
  type Imp24DTransportSmokeReportV1,
} from "./forwardTransportSmokeEvidenceV3.js";
import {
  assertImp24DBoundedCorrectionCommit,
  imp24DQualificationSemanticProjectionSha256,
} from "./forwardTransportSmokeCorrectionV3.js";

const SHA256 = /^[a-f0-9]{64}$/;
const GIT_SHA = /^[a-f0-9]{40}$/;

export type RunImp24DTransportSmokeArgs = {
  executeLive: boolean;
  cycle: Imp24DTransportSmokeCycleNumber;
  expectedHeadSha: string;
  workflowRunId: number;
  repositoryRoot: string;
  /** Invoked only after the exact implementation CI gate passes. Production
   * CLI cache/artifact reads live behind this callback. */
  loadInput: () => UnpreparedLiveRoleQualificationInputV3;
  preflight: {
    authJsonPath?: string;
    codexBinary?: string;
    qualificationCacheDir?: string;
  };
};

export type Imp24DTransportSmokeDeps = {
  clock?: () => Date;
  collectImplementationCiGate?: typeof collectImp24ImplementationCiGate;
  prepare?: typeof prepareLiveRoleQualificationV3;
  preflight?: typeof preflightLiveRoleQualificationV3;
  createExecutor?: typeof createLiveQualificationExecutorV3;
  inspectCall?: typeof inspectRetainedImp24DTransportSmokeCall;
  verifyRetainedCycle?: typeof verifyRetainedImp24DTransportSmokeCycle;
  assertCorrectionCommit?: typeof assertImp24DBoundedCorrectionCommit;
};

export type RunImp24DTransportSmokeResult = {
  code: 0 | 1 | 2;
  executed: boolean;
  cycle: Imp24DTransportSmokeCycleNumber;
  cycleResult: Imp24DTransportSmokeCycleV1 | null;
  report: Imp24DTransportSmokeReportV1 | null;
  modelCalls: number;
  apiCalls: 0;
  message: string;
};

export class Imp24DTransportSmokeCampaignError extends Error {
  readonly classification = "transport_smoke_control_failure" as const;

  constructor(message: string) {
    super(message);
    this.name = "Imp24DTransportSmokeCampaignError";
  }
}

function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Imp24DTransportSmokeCampaignError(message);
}

function parseJson<T>(path: string, label: string): T {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch (error) {
    throw new Imp24DTransportSmokeCampaignError(
      `${label} is not valid retained JSON: ${(error as Error).message}`,
    );
  }
}

function persistExactCanonicalJson(path: string, value: unknown, label: string): void {
  const bytes = `${canonicalJson(value)}\n`;
  if (existsSync(path)) {
    requireCondition(readFileSync(path, "utf8") === bytes, `${label} differs from retained bytes`);
    return;
  }
  writeFileAtomic(path, bytes);
  requireCondition(readFileSync(path, "utf8") === bytes, `${label} read-back drift`);
}

function executionIdForCycle(cycle: Imp24DTransportSmokeCycleNumber) {
  return cycle === 1 ? IMP24D_TRANSPORT_SMOKE_EXECUTION_ID : IMP24D_TRANSPORT_SMOKE_R2_EXECUTION_ID;
}

function fixedCallBinding(args: {
  role: "reader" | "source";
  input: RunRoleQualificationInputV3;
  freeze: LegacyQualificationFreezeV3;
  schedule: readonly QualificationScheduleEntryV3[];
}): Imp24DTransportSmokeInputBindingV1["calls"][number] {
  const availability = args.input.candidateAvailability.entries.find((entry) =>
    entry.role === args.role && entry.status === "AVAILABLE");
  requireCondition(availability !== undefined,
    `IMP-24D transport smoke cannot run: no frozen ${args.role} profile is AVAILABLE`);
  const frozenCandidate = IMP24_ROLE_CANDIDATE_ORDER[args.role][availability.ordinal];
  requireCondition(frozenCandidate !== undefined
      && frozenCandidate.profileId === availability.profileId
      && frozenCandidate.model === availability.model
      && frozenCandidate.effort === availability.effort,
  `IMP-24D transport smoke ${args.role} availability differs from frozen candidate order`);
  const entry = args.schedule.find((candidate) =>
    candidate.role === args.role
      && candidate.candidateOrdinal === availability.ordinal
      && candidate.partition === "canary"
      && candidate.caseOrdinal === 0);
  requireCondition(entry !== undefined,
    `IMP-24D transport smoke cannot locate the frozen first ${args.role} canary`);
  const prepared = args.input.preparedCases[args.role].canary[0];
  requireCondition(prepared !== undefined
      && prepared.caseId === entry.caseId
      && prepared.envelope.envelopeSha256 === entry.evidenceEnvelopeSha256
      && prepared.evidenceEnvelopeBytesSha256 === entry.evidenceEnvelopeBytesSha256,
  `IMP-24D transport smoke ${args.role} first-canary prepared input drift`);
  return {
    role: args.role,
    candidateOrdinal: availability.ordinal,
    profileId: availability.profileId,
    model: availability.model,
    effort: availability.effort,
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

export function buildImp24DTransportSmokeInputBinding(args: {
  executionId: typeof IMP24D_TRANSPORT_SMOKE_EXECUTION_ID | typeof IMP24D_TRANSPORT_SMOKE_R2_EXECUTION_ID;
  input: RunRoleQualificationInputV3;
  freeze: LegacyQualificationFreezeV3;
  schedule: readonly QualificationScheduleEntryV3[];
}): Imp24DTransportSmokeInputBindingV1 {
  const { experimentId: _successorExecutionIdentity, ...candidateAvailability } = args.input.candidateAvailability;
  const core: Omit<Imp24DTransportSmokeInputBindingV1, "inputBindingSha256"> = {
    schema: IMP24D_TRANSPORT_SMOKE_INPUT_BINDING_SCHEMA,
    executionId: args.executionId,
    candidateAvailability,
    qualificationFreezeSha256: args.freeze.freezeSha256,
    calls: [
      fixedCallBinding({ role: "reader", input: args.input, freeze: args.freeze, schedule: args.schedule }),
      fixedCallBinding({ role: "source", input: args.input, freeze: args.freeze, schedule: args.schedule }),
    ],
    qualificationSemanticProjectionSha256: "",
    certificationSha256: args.freeze.certificationSha256,
    productionInstrumentSealSha256: args.freeze.productionInstrumentSealSha256,
    productionQualificationParitySha256: args.freeze.productionQualificationParitySha256,
  };
  core.qualificationSemanticProjectionSha256 = imp24DQualificationSemanticProjectionSha256({
    freeze: args.freeze,
    candidateAvailability: args.input.candidateAvailability,
    calls: core.calls,
  });
  const binding = { ...core, inputBindingSha256: hashCanonical(core) };
  validateImp24DTransportSmokeInputBinding(binding);
  return binding;
}

/** IMP-24E comparison rule for a retained/fresh fixed smoke binding. The
 * retained container may have different cache provenance and consequently a
 * different self hash; the ordered behavior projection and both exact calls
 * may not differ. */
export function sameImp24ETransportSmokeBindingSemantics(
  left: Imp24DTransportSmokeInputBindingV1,
  right: Imp24DTransportSmokeInputBindingV1,
): boolean {
  const projectAvailability = (binding: Imp24DTransportSmokeInputBindingV1) =>
    candidateAvailabilitySemanticSha256(binding.candidateAvailability);
  return projectAvailability(left) === projectAvailability(right)
    && hashCanonical(left.calls) === hashCanonical(right.calls);
}

function buildSmokeRequest(args: {
  executionId: typeof IMP24D_TRANSPORT_SMOKE_EXECUTION_ID | typeof IMP24D_TRANSPORT_SMOKE_R2_EXECUTION_ID;
  binding: Imp24DTransportSmokeInputBindingV1["calls"][number];
  input: RunRoleQualificationInputV3;
  freeze: LegacyQualificationFreezeV3;
  schedule: readonly QualificationScheduleEntryV3[];
}): LiveQualificationExecutionRequestV3 {
  const entry = args.schedule.find((candidate) => candidate.scheduleId === args.binding.sourceScheduleId);
  requireCondition(entry !== undefined, `${args.binding.role}: frozen source schedule entry is missing`);
  const prepared = args.input.preparedCases[args.binding.role].canary[0];
  const candidate = IMP24_ROLE_CANDIDATE_ORDER[args.binding.role][args.binding.candidateOrdinal];
  requireCondition(prepared !== undefined && candidate !== undefined,
    `${args.binding.role}: frozen smoke request inputs are missing`);
  const source = buildQualificationExecutionRequestV3(
    entry,
    prepared,
    candidate,
    args.freeze as unknown as QualificationFreezeV3,
    1,
    null,
  );
  const smokeScheduleId = `${args.executionId}-${args.binding.role}-canary`;
  const attemptId = `${smokeScheduleId}-a1`;
  const {
    requestSha256: _sourceRequestSha256,
    experimentId: _successorExecutionIdentity,
    scheduleId: _sourceScheduleId,
    attemptId: _sourceAttemptId,
    ...unchanged
  } = source;
  const core: Omit<LiveQualificationExecutionRequestV3, "requestSha256"> = {
    ...unchanged,
    experimentId: args.executionId,
    scheduleId: smokeScheduleId,
    attemptId,
  };
  return Object.freeze({ ...core, requestSha256: hashCanonical(core) });
}

function inspectTransportOutput(
  role: "reader" | "source",
  rawOutput: string | null,
): { parsedJson: boolean; schemaValid: boolean } {
  if (typeof rawOutput !== "string") return { parsedJson: false, schemaValid: false };
  let parsedJson = false;
  try {
    JSON.parse(rawOutput);
    parsedJson = true;
  } catch {
    return { parsedJson: false, schemaValid: false };
  }
  try {
    if (role === "reader") parseReaderExperienceModelOutputV2(rawOutput);
    else parseSourceIntegrityModelOutputV2(rawOutput);
    return { parsedJson, schemaValid: true };
  } catch {
    return { parsedJson, schemaValid: false };
  }
}

function materializeReport(repositoryRoot: string): Imp24DTransportSmokeReportV1 {
  let mechanicalCorrection: Imp24DTransportSmokeReportV1["mechanicalCorrection"] = null;
  const retainedReportPath = resolve(repositoryRoot, IMP24D_TRANSPORT_SMOKE_REPORT_JSON_REL_PATH);
  if (existsSync(retainedReportPath)) {
    const retained = parseJson<Imp24DTransportSmokeReportV1>(retainedReportPath,
      "retained IMP-24D transport-smoke report");
    validateImp24DTransportSmokeReport(retained);
    mechanicalCorrection = retained.mechanicalCorrection;
  }
  const cycles: Imp24DTransportSmokeCycleV1[] = [];
  for (const [cycle, executionId] of [
    [1, IMP24D_TRANSPORT_SMOKE_EXECUTION_ID],
    [2, IMP24D_TRANSPORT_SMOKE_R2_EXECUTION_ID],
  ] as const) {
    const path = resolve(repositoryRoot, imp24DTransportSmokeCycleResultRelPath(executionId));
    if (!existsSync(path)) continue;
    const retained = parseJson<Imp24DTransportSmokeCycleV1>(path,
      `IMP-24D transport-smoke cycle ${cycle}`);
    validateImp24DTransportSmokeCycle(retained);
    requireCondition(retained.cycle === cycle && retained.executionId === executionId,
      `IMP-24D transport-smoke cycle ${cycle} path/identity mismatch`);
    cycles.push(retained);
  }
  requireCondition(cycles.length >= 1 && cycles.length <= 2,
    "IMP-24D transport-smoke report requires one or two retained cycles");
  const finalCycle = cycles.at(-1)!;
  const core: Omit<Imp24DTransportSmokeReportV1, "reportSha256"> = {
    schema: "imp24d-transport-smoke-report-v1",
    status: finalCycle.status,
    observabilityImplementationCommit: cycles[0].implementationCommit,
    correctionCommit: cycles[1]?.implementationCommit ?? null,
    effectiveImplementationCommit: finalCycle.implementationCommit,
    cycles,
    mechanicalCorrection,
    finalCycle: cycles.length as 1 | 2,
    totalCalls: (cycles.length * 2) as 2 | 4,
    modelCalls: cycles.reduce((sum, item) => sum + item.codexExecInvocations, 0),
    apiCalls: 0,
    qualificationMetricsIncluded: false,
    qualificationArtifactsCreated: false,
  };
  const report = { ...core, reportSha256: hashCanonical(core) };
  validateImp24DTransportSmokeReport(report);
  writeFileAtomic(resolve(repositoryRoot, IMP24D_TRANSPORT_SMOKE_REPORT_JSON_REL_PATH),
    canonicalImp24DTransportSmokeReport(report));
  writeFileAtomic(resolve(repositoryRoot, IMP24D_TRANSPORT_SMOKE_REPORT_MARKDOWN_REL_PATH),
    renderImp24DTransportSmokeReportMarkdown(report));
  return report;
}

export async function runImp24DTransportSmoke(
  args: RunImp24DTransportSmokeArgs,
  deps: Imp24DTransportSmokeDeps = {},
): Promise<RunImp24DTransportSmokeResult> {
  if (args.executeLive !== true) {
    return {
      code: 2,
      executed: false,
      cycle: args.cycle,
      cycleResult: null,
      report: null,
      modelCalls: 0,
      apiCalls: 0,
      message: "IMP-24D transport smoke refused: executeLive must be literal true",
    };
  }
  requireCondition(args.cycle === 1 || args.cycle === 2,
    "IMP-24D transport smoke permits only fixed cycle 1 or fixed cycle 2");
  requireCondition(GIT_SHA.test(args.expectedHeadSha),
    "IMP-24D transport smoke requires an exact lowercase 40-character implementation HEAD");
  requireCondition(Number.isSafeInteger(args.workflowRunId) && args.workflowRunId > 0,
    "IMP-24D transport smoke requires a positive dedicated V25 workflow run ID");
  const repositoryRoot = resolve(args.repositoryRoot);
  const successorRoot = resolve(repositoryRoot,
    `scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments/${IMP24_ROLE_QUALIFICATION_R2_EXECUTION_ID}`);
  requireCondition(!existsSync(successorRoot),
    "IMP-24D transport smoke refuses because the r2 qualification root already exists before smoke PASS");

  const executionId = executionIdForCycle(args.cycle);
  const root = resolve(repositoryRoot, imp24DTransportSmokeStateRootRelPath(executionId));
  const cycleResultPath = resolve(repositoryRoot, imp24DTransportSmokeCycleResultRelPath(executionId));
  if (existsSync(root)) {
    requireCondition(existsSync(cycleResultPath),
      `IMP-24D transport-smoke ${executionId} root is partial; rerun is refused`);
    const verified = (deps.verifyRetainedCycle ?? verifyRetainedImp24DTransportSmokeCycle)({
      repositoryRoot,
      executionId,
    });
    const cycleResult = verified.cycle;
    const report = materializeReport(repositoryRoot);
    return {
      code: cycleResult.status === "PASS" ? 0 : 1,
      executed: false,
      cycle: args.cycle,
      cycleResult,
      report,
      modelCalls: 0,
      apiCalls: 0,
      message: `IMP-24D transport-smoke ${executionId} retained result revalidated without a new call`,
    };
  }

  let correctionRecord: Imp24DTransportSmokeReportV1["mechanicalCorrection"] = null;
  let correctionCommitReportBytesSha256: string | null = null;
  if (args.cycle === 2) {
    const firstPath = resolve(repositoryRoot,
      imp24DTransportSmokeCycleResultRelPath(IMP24D_TRANSPORT_SMOKE_EXECUTION_ID));
    requireCondition(existsSync(firstPath),
      "IMP-24D correction smoke is forbidden before the first fixed two-call cycle is retained");
    const firstIdentity = parseJson<Imp24DTransportSmokeCycleV1>(firstPath,
      "IMP-24D first transport-smoke cycle identity");
    validateImp24DTransportSmokeCycle(firstIdentity);
    requireCondition(firstIdentity.implementationCommit !== args.expectedHeadSha,
      "IMP-24D correction cycle requires a distinct implementation commit");
    const reportPath = resolve(repositoryRoot, IMP24D_TRANSPORT_SMOKE_REPORT_JSON_REL_PATH);
    requireCondition(existsSync(reportPath),
      "IMP-24D correction smoke requires the correction-commit diagnosis report");
    const retainedReportBytes = readFileSync(reportPath);
    const retainedReport = parseJson<Imp24DTransportSmokeReportV1>(reportPath,
      "IMP-24D correction-commit diagnosis report");
    validateImp24DTransportSmokeReport(retainedReport);
    requireCondition(retainedReport.cycles.length === 1
        && retainedReport.cycles[0].status === "FAIL"
        && retainedReport.mechanicalCorrection !== null,
    "IMP-24D correction smoke requires one failed first cycle and its bounded diagnosis record");
    const firstShallow = parseJson<Imp24DTransportSmokeCycleV1>(firstPath,
      "IMP-24D first transport-smoke cycle");
    validateImp24DTransportSmokeCycle(firstShallow);
    requireCondition(firstShallow.status === "FAIL"
        && hashCanonical(firstShallow) === hashCanonical(retainedReport.cycles[0]),
    "IMP-24D correction smoke is not bound to the failed first cycle");
    if (deps.assertCorrectionCommit !== undefined) {
      deps.assertCorrectionCommit({
        repositoryRoot,
        observabilityImplementationCommit: firstShallow.implementationCommit,
        correctionCommit: args.expectedHeadSha,
      });
    }
    const ownership = verifyImp24DTransportMechanicalCorrectionOwnership({
      repositoryRoot,
      correctionCommit: args.expectedHeadSha,
      retainedReportBytes,
    });
    (deps.verifyRetainedCycle ?? verifyRetainedImp24DTransportSmokeCycle)({
      repositoryRoot,
      executionId: IMP24D_TRANSPORT_SMOKE_EXECUTION_ID,
      expectedStatus: "FAIL",
      reportCycle: retainedReport.cycles[0],
    });
    correctionRecord = ownership.record;
    validateImp24DTransportMechanicalCorrection(correctionRecord);
    correctionCommitReportBytesSha256 = ownership.committedReportBytesSha256;
  }

  const now = deps.clock ?? (() => new Date());
  const gateClockDate = now();
  requireCondition(gateClockDate instanceof Date && Number.isFinite(gateClockDate.getTime()),
    "IMP-24D transport-smoke CI-gate clock is invalid");
  const collectGate = deps.collectImplementationCiGate ?? collectImp24ImplementationCiGate;
  const gate = collectGate({
    repositoryRoot,
    expectedHeadSha: args.expectedHeadSha,
    workflowRunId: args.workflowRunId,
    verifiedAt: gateClockDate.toISOString(),
  });
  validateImp24ImplementationCiGate({
    gate,
    expectedHeadSha: args.expectedHeadSha,
    checkout: gate.trustedEvidence.raw.checkout,
  });
  const observedStartDate = now();
  requireCondition(observedStartDate instanceof Date && Number.isFinite(observedStartDate.getTime()),
    "IMP-24D transport-smoke start clock is invalid");
  const startedAtDate = new Date(Math.max(
    observedStartDate.getTime(),
    Date.parse(gate.verifiedAt) + 1,
  ));

  const prepare = deps.prepare ?? prepareLiveRoleQualificationV3;
  const prepared = prepare({ repositoryRoot, input: args.loadInput() });
  const plan = buildLegacyRoleQualificationPlanV3(prepared.input);
  const inputBinding = buildImp24DTransportSmokeInputBinding({
    executionId,
    input: prepared.input,
    freeze: plan.freeze,
    schedule: plan.schedule,
  });
  if (args.cycle === 2) {
    const firstBindingPath = resolve(repositoryRoot,
      imp24DTransportSmokeStateRootRelPath(IMP24D_TRANSPORT_SMOKE_EXECUTION_ID),
      "smoke-input-binding.json");
    const firstBinding = parseJson<Imp24DTransportSmokeInputBindingV1>(firstBindingPath,
      "IMP-24D first transport-smoke input binding");
    validateImp24DTransportSmokeInputBinding(firstBinding);
    requireCondition(correctionRecord !== null
        && correctionRecord.semanticProjectionSha256
          === firstBinding.qualificationSemanticProjectionSha256
        && sameImp24ETransportSmokeBindingSemantics(inputBinding, firstBinding),
    "IMP-24D corrected smoke changed frozen semantics or either complete fixed call binding");
  }
  mkdirSync(root, { recursive: true });
  const phaseDir = resolve(root, "live");
  persistExactCanonicalJson(resolve(root, "implementation-ci-gate.json"), gate,
    "IMP-24D transport-smoke implementation CI gate");
  persistExactCanonicalJson(resolve(root, "smoke-input-binding.json"), inputBinding,
    "IMP-24D transport-smoke input binding");

  const runPreflight = deps.preflight ?? preflightLiveRoleQualificationV3;
  let preflight: LiveQualificationPreflightV3 | null = null;
  let preflightFailure: Imp24DTransportSmokePreflightFailureV1 | null = null;
  let preflightError: Error | null = null;
  try {
    preflight = await runPreflight(prepared.input, {
      ...args.preflight,
      repositoryRoot,
      executionId,
      verifiedAt: startedAtDate.toISOString(),
    });
    const expectedAvailabilityIdentity = prepared.input.candidateAvailability.semanticSha256
      ?? prepared.input.candidateAvailability.availabilitySha256;
    requireCondition(preflight.experimentId === executionId
        && preflight.freezeSha256 === plan.freeze.freezeSha256
        && preflight.candidateAvailabilitySha256 === expectedAvailabilityIdentity,
    "IMP-24D smoke preflight is not bound to the smoke identity and frozen inputs");
    persistExactCanonicalJson(resolve(phaseDir, "preflight.json"), preflight,
      "IMP-24D transport-smoke preflight");
  } catch (error) {
    const original = error as Error;
    preflightError = Object.assign(new Error(sanitizeImp24DTransportSmokePreflightErrorText(
      original.message || original.name || "smoke preflight failed",
    )), {
      name: "Imp24DTransportSmokePreflightError",
      classification: "policy_preflight_failure" as const,
    });
    preflightFailure = buildImp24DTransportSmokePreflightFailure({
      executionId,
      freezeSha256: plan.freeze.freezeSha256,
      certificationSha256: plan.freeze.certificationSha256,
      productionInstrumentSealSha256: plan.freeze.productionInstrumentSealSha256,
      candidateAvailabilitySha256: prepared.input.candidateAvailability.semanticSha256
        ?? prepared.input.candidateAvailability.availabilitySha256,
      error: original,
      failedAt: startedAtDate.toISOString(),
    });
    persistExactCanonicalJson(resolve(phaseDir, "preflight-failure.json"), preflightFailure,
      "IMP-24D transport-smoke preflight failure");
  }

  const createExecutor = deps.createExecutor ?? createLiveQualificationExecutorV3;
  const live = createExecutor({
    phaseDir,
    executionId,
    freezeSha256: plan.freeze.freezeSha256,
    certificationSha256: plan.freeze.certificationSha256,
    productionInstrumentSealSha256: plan.freeze.productionInstrumentSealSha256,
    ...(preflightError === null ? {
      repositoryRoot,
      productionInstrumentSeal: prepared.input.productionInstrumentSeal,
      authJsonPath: args.preflight.authJsonPath,
    } : {
      preCallVerifier: () => { throw preflightError; },
    }),
  });
  const requests = inputBinding.calls.map((binding) => buildSmokeRequest({
    executionId,
    binding,
    input: prepared.input,
    freeze: plan.freeze,
    schedule: plan.schedule,
  })) as [LiveQualificationExecutionRequestV3, LiveQualificationExecutionRequestV3];

  await Promise.allSettled(requests.map(async (request, index) => {
    let receipt: QualificationExecutionReceiptV3 | null = null;
    try {
      receipt = await live.controlExecutor(request);
    } catch (error) {
      const retainedReceiptPath = resolve(phaseDir, "attempts", request.attemptId, "receipt.json");
      if (existsSync(retainedReceiptPath)) {
        receipt = parseJson<QualificationExecutionReceiptV3>(retainedReceiptPath,
          `${request.attemptId} retained smoke receipt`);
      }
    }
    if (receipt !== null) {
      const ledgerEntry = live.ledger.entries.find((entry) => entry.attemptId === request.attemptId);
      requireCondition(ledgerEntry !== undefined
          && ledgerEntry.requestSha256 === request.requestSha256
          && ledgerEntry.receiptSha256 === receipt!.receiptSha256
          && typeof ledgerEntry.executionEvidenceSha256 === "string",
      `${request.attemptId}: transport evaluation cannot bind to complete call evidence`);
      const transportFacts = inspectTransportOutput(inputBinding.calls[index].role, receipt.rawOutput);
      const evaluation = buildImp24DTransportSmokeEvaluation({
        request,
        receipt,
        executionEvidenceSha256: ledgerEntry.executionEvidenceSha256,
        ...transportFacts,
      });
      const evaluationPath = resolve(phaseDir, "attempts", request.attemptId, "evaluation.json");
      persistExactCanonicalJson(evaluationPath, evaluation,
        `${request.attemptId} metric-free transport evaluation`);
      requireCondition(ledgerEntry.evaluationArtifactSha256 === null
          || ledgerEntry.evaluationArtifactSha256 === evaluation.evaluationArtifactSha256,
      `${request.attemptId}: transport evaluation conflicts with call-ledger evidence`);
      ledgerEntry.evaluationArtifactSha256 = evaluation.evaluationArtifactSha256;
      writeFileAtomic(live.ledgerPath, `${JSON.stringify(live.ledger, null, 2)}\n`);
      const retainedLedger = parseJson<typeof live.ledger>(live.ledgerPath,
        `${request.attemptId} transport-smoke call ledger`);
      requireCondition(hashCanonical(retainedLedger) === hashCanonical(live.ledger),
        `${request.attemptId}: transport-smoke call-ledger read-back drift`);
    }
  }));

  requireCondition(live.ledger.brokerRequests === 2 && live.ledger.entries.length === 2
      && live.ledger.infrastructureReplays === 0 && live.ledger.apiCallsMade === 0,
  "IMP-24D smoke did not retain exactly two fixed broker requests with zero replay/API calls");
  const inspect = deps.inspectCall ?? inspectRetainedImp24DTransportSmokeCall;
  const calls = inputBinding.calls.map((expected) => inspect({
    repositoryRoot,
    phaseDir,
    executionId,
    expected,
    smokeScheduleId: `${executionId}-${expected.role}-canary`,
    attemptId: `${executionId}-${expected.role}-canary-a1`,
  })) as [Imp24DTransportSmokeCallV1, Imp24DTransportSmokeCallV1];
  const observedCompletedAtDate = now();
  requireCondition(observedCompletedAtDate instanceof Date && Number.isFinite(observedCompletedAtDate.getTime()),
    "IMP-24D transport-smoke completion clock is invalid");
  const latestCallCompletedAt = Math.max(...live.ledger.entries.map((entry) =>
    entry.completedAt === null ? 0 : Date.parse(entry.completedAt)));
  const completedAtDate = new Date(Math.max(
    observedCompletedAtDate.getTime(),
    startedAtDate.getTime(),
    latestCallCompletedAt,
  ));
  const gatePath = resolve(root, "implementation-ci-gate.json");
  const inputBindingPath = resolve(root, "smoke-input-binding.json");
  const callLedgerPath = resolve(phaseDir, "call-ledger.json");
  const status = calls.every((call) => call.passed) ? "PASS" as const : "FAIL" as const;
  const cycleCore: Omit<Imp24DTransportSmokeCycleV1, "cycleSha256"> = {
    schema: "imp24d-transport-smoke-cycle-v1",
    cycle: args.cycle,
    executionId,
    stateRoot: imp24DTransportSmokeStateRootRelPath(executionId),
    implementationCommit: args.expectedHeadSha,
    workflowRunId: args.workflowRunId,
    implementationCiVerifiedAt: gate.verifiedAt,
    implementationCiGateSha256: gate.gateSha256,
    implementationCiGateBytesSha256: sha256Hex(readFileSync(gatePath)),
    inputBindingSha256: inputBinding.inputBindingSha256,
    inputBindingBytesSha256: sha256Hex(readFileSync(inputBindingPath)),
    candidateAvailabilitySha256: prepared.input.candidateAvailability.semanticSha256
      ?? prepared.input.candidateAvailability.availabilitySha256,
    preflightSha256: preflight?.preflightSha256 ?? preflightFailure!.preflightFailureSha256,
    qualificationFreezeSha256: plan.freeze.freezeSha256,
    qualificationSemanticProjectionSha256: inputBinding.qualificationSemanticProjectionSha256,
    certificationSha256: plan.freeze.certificationSha256,
    productionInstrumentSealSha256: plan.freeze.productionInstrumentSealSha256,
    productionQualificationParitySha256: plan.freeze.productionQualificationParitySha256,
    mechanicalCorrectionSha256: correctionRecord?.correctionSha256 ?? null,
    correctionCommitReportBytesSha256,
    callLedgerSha256: hashCanonical(live.ledger),
    callLedgerBytesSha256: sha256Hex(readFileSync(callLedgerPath)),
    calls,
    brokerRequests: 2,
    codexExecInvocations: live.ledger.codexExecInvocations,
    apiCalls: 0,
    qualificationMetricsIncluded: false,
    qualificationArtifactsCreated: false,
    status,
    startedAt: startedAtDate.toISOString(),
    completedAt: completedAtDate.toISOString(),
    processDiagnosticsSetSha256: hashCanonical(calls.map((call) => call.processDiagnosticsSha256)),
  };
  requireCondition(SHA256.test(sha256Hex(readFileSync(callLedgerPath))),
    "IMP-24D transport-smoke call ledger bytes could not be hashed");
  const cycleResult = { ...cycleCore, cycleSha256: hashCanonical(cycleCore) };
  validateImp24DTransportSmokeCycle(cycleResult);
  persistExactCanonicalJson(cycleResultPath, cycleResult, "IMP-24D transport-smoke cycle result");
  const report = materializeReport(repositoryRoot);
  requireCondition(!existsSync(successorRoot),
    "IMP-24D transport smoke unexpectedly created the r2 qualification root before PASS handoff");
  return {
    code: status === "PASS" ? 0 : 1,
    executed: true,
    cycle: args.cycle,
    cycleResult,
    report,
    modelCalls: live.ledger.codexExecInvocations,
    apiCalls: 0,
    message: status === "PASS"
      ? "IMP-24D fixed two-call transport smoke passed"
      : "IMP-24D fixed two-call transport smoke failed; inspect retained process diagnostics",
  };
}
