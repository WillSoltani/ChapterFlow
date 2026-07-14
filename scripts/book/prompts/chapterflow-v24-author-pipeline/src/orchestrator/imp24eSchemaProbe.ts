/**
 * IMP-24E bounded transport-schema probes.
 *
 * This is deliberately not a qualification runner. It executes exactly one
 * tiny synthetic reader/source/quiz request through the production
 * ChatGPT-authenticated Codex broker, retains process evidence, and records
 * `qualificationMetricsIncluded:false`. A single fresh-head repeat is the only
 * retry surface; there is no third execution identity.
 */

import { homedir } from "node:os";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { basename, relative, resolve, sep } from "node:path";

import { PIPELINE_DIR } from "../bakeoff/paths.js";
import {
  IMP24_ROLE_CANDIDATE_ORDER,
  type QualificationProfileV3,
} from "../bakeoff/migration/roleQualificationRunnerV3.js";
import { canonicalJson, hashCanonical, sha256Hex } from "../contracts/contractUtil.js";
import {
  validateEffectiveContextManifest,
  type EffectiveContextManifestV1,
  type ExecResultV1,
} from "../contracts/effectiveContext.js";
import { validateRouteResult, type RouteResultV1 } from "../contracts/routeContracts.js";
import {
  FORBIDDEN_PROVIDER_ENV,
  assertChatgptSubscriptionAuth,
  resolveExecutionProfile,
  type StructuredOutputSidecarV1,
} from "../exec/executionEnvelope.js";
import {
  assertFlagsSupported,
  qualifyCodexCli,
  type CodexCliQualificationV1,
} from "../exec/cliQualification.js";
import { writeFileAtomic } from "../lib/atomicWrite.js";
import { STRICT_PIPELINE_ENV } from "../lib/strictEnv.js";
import {
  parseQuizIntegrityModelOutputV2,
  parseReaderExperienceModelOutputV2,
  parseSourceIntegrityModelOutputV2,
} from "../review/reviewModelOutputV2.js";
import {
  CodexPostRunEvidenceError,
  CodexRunnerProcessError,
  findCodexBinary,
  spawnCodexAgent,
  type CodexAgentResult,
  type CodexRunnerBoundaryV1,
  type SpawnCodexAgentOptions,
} from "./codexAgent.js";
import {
  buildCodexProcessDiagnosticsV1,
  validateCodexProcessDiagnosticsV1,
  type CodexProcessDiagnosticsV1,
} from "./codexProcessDiagnostics.js";
import {
  collectImp24ImplementationCiGate,
  validateImp24ImplementationCiGate,
  type Imp24ImplementationCiGateV1,
} from "./forwardRoleQualificationCampaignV3.js";
import { ROUTE_POLICY_VERSION, resolveRoute } from "./modelPolicy.js";

export const IMP24E_SCHEMA_PROBE_CYCLE_SCHEMA = "imp24e-schema-probe-cycle-v1" as const;
export const IMP24E_SCHEMA_PROBE_REQUEST_SCHEMA = "imp24e-schema-probe-request-v1" as const;
export const IMP24E_SCHEMA_PROBE_RESULT_SCHEMA = "imp24e-schema-probe-result-v1" as const;
export const IMP24E_SCHEMA_PROBE_PREFLIGHT_SCHEMA = "imp24e-schema-probe-preflight-v1" as const;
export const IMP24E_SCHEMA_PROBE_LEDGER_SCHEMA = "imp24e-schema-probe-call-ledger-v1" as const;
export const IMP24E_SCHEMA_PROBE_REPORT_SCHEMA = "imp24e-schema-probe-report-v1" as const;

export const IMP24E_SCHEMA_PROBE_EXECUTION_ID =
  "s16-forward-role-qualification-v3-envelope-schema-probes" as const;
export const IMP24E_SCHEMA_PROBE_R2_EXECUTION_ID =
  "s16-forward-role-qualification-v3-envelope-schema-probes-r2" as const;
export const IMP24E_SCHEMA_PROBE_TIMEOUT_MS = 300_000 as const;
export const IMP24E_SCHEMA_PROBE_REPORT_JSON_REL_PATH =
  "docs/v25/reports/IMP-24E_SCHEMA_PROBE_RESULT.json" as const;
export const IMP24E_SCHEMA_PROBE_REPORT_MARKDOWN_REL_PATH =
  "docs/v25/reports/IMP-24E_SCHEMA_PROBE_RESULT.md" as const;

const PIPELINE_REL = "scripts/book/prompts/chapterflow-v24-author-pipeline";
const STATE_REL = `${PIPELINE_REL}/state/migration-experiments`;
const ROLES = ["reader", "source", "quiz"] as const;
const SCHEMA_REL_PATHS: Readonly<Record<Imp24ESchemaProbeRole, string>> = Object.freeze({
  reader: `${PIPELINE_REL}/state/migration-experiments/contracts/schemas/reader-experience-model-output-v2.schema.json`,
  source: `${PIPELINE_REL}/state/migration-experiments/contracts/schemas/source-integrity-model-output-v2.schema.json`,
  quiz: `${PIPELINE_REL}/state/migration-experiments/contracts/schemas/quiz-integrity-model-output-v2.schema.json`,
});
const SHA256 = /^[a-f0-9]{64}$/;
const GIT_SHA = /^[a-f0-9]{40}$/;

export type Imp24ESchemaProbeRole = typeof ROLES[number];
export type Imp24ESchemaProbeCycleNumber = 1 | 2;
export type Imp24ESchemaProbeExecutionId =
  | typeof IMP24E_SCHEMA_PROBE_EXECUTION_ID
  | typeof IMP24E_SCHEMA_PROBE_R2_EXECUTION_ID;

export type Imp24ESchemaProbeRequestV1 = {
  schema: typeof IMP24E_SCHEMA_PROBE_REQUEST_SCHEMA;
  cycle: Imp24ESchemaProbeCycleNumber;
  executionId: Imp24ESchemaProbeExecutionId;
  role: Imp24ESchemaProbeRole;
  attemptId: string;
  profileId: string;
  model: string;
  effort: QualificationProfileV3["effort"];
  schemaRelPath: string;
  schemaSha256: string;
  task: string;
  taskSha256: string;
  expectedMinimumOutputSha256: string;
  timeoutMs: typeof IMP24E_SCHEMA_PROBE_TIMEOUT_MS;
  qualificationMetricsIncluded: false;
  apiCalls: 0;
  requestSha256: string;
};

export type Imp24ESchemaProbeSidecarBindingV1 = {
  kind: "effective-context-manifest" | "route" | "structured-output" | "exec-result";
  relPath: string;
  bytes: number;
  bytesSha256: string;
};

export type Imp24ESchemaProbeResultV1 = {
  schema: typeof IMP24E_SCHEMA_PROBE_RESULT_SCHEMA;
  cycle: Imp24ESchemaProbeCycleNumber;
  executionId: Imp24ESchemaProbeExecutionId;
  role: Imp24ESchemaProbeRole;
  attemptId: string;
  requestSha256: string;
  profileId: string;
  model: string;
  effort: string;
  processDiagnosticsSha256: string;
  runnerBoundaryCrossed: boolean;
  schemaBoundAtRunner: boolean;
  chatgptAuthVerified: boolean;
  apiCalls: 0;
  finalMessageSource: "output-file" | "stdout-fallback" | null;
  authoritativeOutputFileProduced: boolean;
  authoritativeOutputRelPath: string | null;
  rawOutput: string | null;
  rawOutputSha256: string | null;
  rawOutputBytes: number | null;
  parsedJson: boolean;
  deterministicValidatorPassed: boolean;
  sidecars: Imp24ESchemaProbeSidecarBindingV1[];
  missingRequiredSidecars: string[];
  qualificationMetricsIncluded: false;
  passed: boolean;
  failureClassification: string | null;
  failureDetail: string | null;
  resultSha256: string;
};

export type Imp24ESchemaProbePreflightV1 = {
  schema: typeof IMP24E_SCHEMA_PROBE_PREFLIGHT_SCHEMA;
  cycle: Imp24ESchemaProbeCycleNumber;
  executionId: Imp24ESchemaProbeExecutionId;
  verifiedAt: string;
  implementationCiGateSha256: string;
  cliVersion: string;
  cliBinary: string;
  cliSynthetic: false;
  executionProfileHash: string;
  routePolicyVersion: typeof ROUTE_POLICY_VERSION;
  executionRoute: "codex_exec_chatgpt_subscription";
  authMode: "chatgpt";
  apiKeyPresent: false;
  apiFallbackAllowed: false;
  directHttpOrSdkAllowed: false;
  forbiddenProviderEnvKeysPresent: [];
  sandbox: "read-only";
  maximumCalls: 3;
  maximumCycles: 2;
  qualificationMetricsIncluded: false;
  apiCalls: 0;
  preflightSha256: string;
};

export type Imp24ESchemaProbeLedgerV1 = {
  schema: typeof IMP24E_SCHEMA_PROBE_LEDGER_SCHEMA;
  cycle: Imp24ESchemaProbeCycleNumber;
  executionId: Imp24ESchemaProbeExecutionId;
  entries: Array<{
    role: Imp24ESchemaProbeRole;
    attemptId: string;
    requestSha256: string;
    status: "REQUESTED" | "PASS" | "FAIL";
    processDiagnosticsSha256: string | null;
    resultSha256: string | null;
  }>;
  brokerRequests: number;
  codexExecInvocations: number;
  apiCalls: 0;
  qualificationMetricsIncluded: false;
};

export type Imp24ESchemaProbeCycleV1 = {
  schema: typeof IMP24E_SCHEMA_PROBE_CYCLE_SCHEMA;
  cycle: Imp24ESchemaProbeCycleNumber;
  executionId: Imp24ESchemaProbeExecutionId;
  implementationCommit: string;
  workflowRunId: number;
  implementationCiGateSha256: string;
  preflightSha256: string;
  results: [Imp24ESchemaProbeResultV1, Imp24ESchemaProbeResultV1, Imp24ESchemaProbeResultV1];
  brokerRequests: 3;
  codexExecInvocations: number;
  apiCalls: 0;
  qualificationMetricsIncluded: false;
  qualificationArtifactsCreated: false;
  status: "PASS" | "FAIL";
  startedAt: string;
  completedAt: string;
  cycleSha256: string;
};

export type Imp24ESchemaProbeReportV1 = {
  schema: typeof IMP24E_SCHEMA_PROBE_REPORT_SCHEMA;
  status: "PASS" | "FAIL";
  cycles: Imp24ESchemaProbeCycleV1[];
  totalBrokerRequests: number;
  totalCodexExecInvocations: number;
  maximumCallsPerCycle: 3;
  maximumCycles: 2;
  maximumCallsAuthorized: 6;
  apiCalls: 0;
  qualificationMetricsIncluded: false;
  qualificationArtifactsCreated: false;
  reportSha256: string;
};

export type Imp24ESchemaProbePathsV1 = {
  stateRoot: string;
  implementationCiGate: string;
  preflight: string;
  callLedger: string;
  cycleResult: string;
  attemptsDir: string;
  execLogsDir: string;
  execSessionsDir: string;
};

export type RunImp24ESchemaProbeArgs = {
  executeLive: boolean;
  cycle: Imp24ESchemaProbeCycleNumber;
  expectedHeadSha: string;
  workflowRunId: number;
  repositoryRoot: string;
};

type ProbePreflightRuntime = {
  artifact: Imp24ESchemaProbePreflightV1;
  qualification: CodexCliQualificationV1;
  bin: string;
};

export type Imp24ESchemaProbeDeps = {
  clock?: () => Date;
  env?: NodeJS.ProcessEnv;
  authJsonPath?: string;
  codexBinary?: string;
  collectImplementationCiGate?: typeof collectImp24ImplementationCiGate;
  preflight?: (args: {
    cycle: Imp24ESchemaProbeCycleNumber;
    executionId: Imp24ESchemaProbeExecutionId;
    implementationCiGate: Imp24ImplementationCiGateV1;
    verifiedAt: string;
  }) => Promise<ProbePreflightRuntime>;
  spawn?: (options: SpawnCodexAgentOptions) => Promise<CodexAgentResult>;
  /** Test-only retained-output root. The production CLI exposes no path flag. */
  retainedArtifactRoot?: string;
};

export type RunImp24ESchemaProbeResult = {
  code: 0 | 1 | 2;
  executed: boolean;
  cycleResult: Imp24ESchemaProbeCycleV1 | null;
  report: Imp24ESchemaProbeReportV1 | null;
  modelCalls: number;
  apiCalls: 0;
  message: string;
};

export class Imp24ESchemaProbeError extends Error {
  readonly classification = "schema_probe_control_failure" as const;

  constructor(message: string) {
    super(message);
    this.name = "Imp24ESchemaProbeError";
  }
}

function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Imp24ESchemaProbeError(message);
}

function requireSha(value: unknown, label: string): asserts value is string {
  requireCondition(typeof value === "string" && SHA256.test(value), `${label} must be a lowercase SHA-256`);
}

function executionIdForCycle(cycle: Imp24ESchemaProbeCycleNumber): Imp24ESchemaProbeExecutionId {
  return cycle === 1 ? IMP24E_SCHEMA_PROBE_EXECUTION_ID : IMP24E_SCHEMA_PROBE_R2_EXECUTION_ID;
}

export function imp24ESchemaProbePaths(
  repositoryRoot: string,
  cycle: Imp24ESchemaProbeCycleNumber,
): Imp24ESchemaProbePathsV1 {
  const stateRoot = resolve(repositoryRoot, STATE_REL, executionIdForCycle(cycle));
  return {
    stateRoot,
    implementationCiGate: resolve(stateRoot, "implementation-ci-gate.json"),
    preflight: resolve(stateRoot, "preflight.json"),
    callLedger: resolve(stateRoot, "call-ledger.json"),
    cycleResult: resolve(stateRoot, "cycle-result.json"),
    attemptsDir: resolve(stateRoot, "live", "attempts"),
    execLogsDir: resolve(stateRoot, "live", "exec", "logs"),
    execSessionsDir: resolve(stateRoot, "live", "exec", "sessions"),
  };
}

function pretty(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function persistExact(path: string, bytes: string, label: string): void {
  if (existsSync(path)) {
    requireCondition(readFileSync(path, "utf8") === bytes, `${label} differs from retained bytes`);
    return;
  }
  writeFileAtomic(path, bytes);
  requireCondition(readFileSync(path, "utf8") === bytes, `${label} read-back drift`);
}

function persistMutable(path: string, bytes: string, label: string): void {
  writeFileAtomic(path, bytes);
  requireCondition(readFileSync(path, "utf8") === bytes, `${label} read-back drift`);
}

function readExactJson<T>(path: string, label: string): T {
  requireCondition(existsSync(path), `${label} is missing`);
  const bytes = readFileSync(path, "utf8");
  let value: T;
  try { value = JSON.parse(bytes) as T; }
  catch (error) { throw new Imp24ESchemaProbeError(`${label} is invalid JSON: ${(error as Error).message}`); }
  requireCondition(bytes === pretty(value) || bytes === `${canonicalJson(value)}\n`,
    `${label} is not an exact retained serialization`);
  return value;
}

const MINIMUM_OUTPUTS: Readonly<Record<Imp24ESchemaProbeRole, unknown>> = Object.freeze({
  reader: Object.freeze({
    schema: "reader-experience-model-output-v2",
    scores: {
      retention: 50, quizzes: 50, transfer: 50, practical: 50, summaries: 50,
      tone: 50, limits: 50, insight: 50, density: 50, beginner: 50,
    },
    quizDerivation: {
      answers: ["a"], mechanisms: ["synthetic mechanism"], confidence: ["high"],
      ambiguities: [], tells: [], evidenceRefIds: [["probe.chapter.1"]],
    },
    recommendation: "SHIP",
    blockingFindings: [],
    escalationSignals: [],
    advisoryFindings: [],
    strongestEvidenceRefIds: ["probe.chapter.1"],
    weakestEvidenceRefIds: ["probe.chapter.1"],
    oneParagraphVerdict: "Synthetic transport probe output.",
  }),
  source: Object.freeze({
    schema: "source-integrity-model-output-v2",
    assessments: [{
      targetRef: "probe.target.1",
      visibleRegister: "clearly_generic",
      supportStatus: "NOT_APPLICABLE",
      framingAdequate: null,
      claimStrengthFit: null,
      namedSpecificityAllowed: null,
      findings: [],
      rationale: "Synthetic transport probe output.",
    }],
  }),
  quiz: Object.freeze({
    schema: "quiz-integrity-model-output-v2",
    items: [{
      questionRef: "probe.question.1",
      keyCorrect: "correct",
      defensibleAnswerIndices: [0],
      keyedMechanismSupported: true,
      rationale: "Synthetic transport probe output.",
      evidenceRefIds: ["probe.question.1"],
    }],
  }),
});

export function imp24ESchemaProbeMinimumOutput(role: Imp24ESchemaProbeRole): unknown {
  return JSON.parse(canonicalJson(MINIMUM_OUTPUTS[role])) as unknown;
}

export function imp24ESchemaProbeTask(role: Imp24ESchemaProbeRole): string {
  const exact = canonicalJson(MINIMUM_OUTPUTS[role]);
  return [
    `IMP-24E ${role} transport-schema probe only.`,
    "This is synthetic and must not be treated as a review or qualification judgment.",
    "Return exactly the following smallest valid JSON object and no prose:",
    exact,
  ].join("\n");
}

function schemaPathForRole(repositoryRoot: string, role: Imp24ESchemaProbeRole): string {
  return resolve(repositoryRoot, SCHEMA_REL_PATHS[role]);
}

function profileForRole(role: Imp24ESchemaProbeRole): QualificationProfileV3 {
  const profile = IMP24_ROLE_CANDIDATE_ORDER[role][0];
  requireCondition(profile !== undefined, `schema probe has no frozen first ${role} profile`);
  return profile;
}

export function buildImp24ESchemaProbeRequest(args: {
  cycle: Imp24ESchemaProbeCycleNumber;
  role: Imp24ESchemaProbeRole;
  repositoryRoot: string;
}): Imp24ESchemaProbeRequestV1 {
  const executionId = executionIdForCycle(args.cycle);
  const profile = profileForRole(args.role);
  const schemaPath = schemaPathForRole(args.repositoryRoot, args.role);
  const schemaRelPath = relative(resolve(args.repositoryRoot), schemaPath).split(sep).join("/");
  requireCondition(schemaRelPath.startsWith(`${PIPELINE_REL}/state/migration-experiments/contracts/schemas/`),
    `${args.role} schema probe path escaped the fixed model-facing schema inventory`);
  const schemaSha256 = sha256Hex(readFileSync(schemaPath));
  const task = imp24ESchemaProbeTask(args.role);
  const attemptId = `${executionId}-${args.role}-a1`;
  const core: Omit<Imp24ESchemaProbeRequestV1, "requestSha256"> = {
    schema: IMP24E_SCHEMA_PROBE_REQUEST_SCHEMA,
    cycle: args.cycle,
    executionId,
    role: args.role,
    attemptId,
    profileId: profile.profileId,
    model: profile.model,
    effort: profile.effort,
    schemaRelPath,
    schemaSha256,
    task,
    taskSha256: sha256Hex(task),
    expectedMinimumOutputSha256: hashCanonical(MINIMUM_OUTPUTS[args.role]),
    timeoutMs: IMP24E_SCHEMA_PROBE_TIMEOUT_MS,
    qualificationMetricsIncluded: false,
    apiCalls: 0,
  };
  return Object.freeze({ ...core, requestSha256: hashCanonical(core) });
}

export function validateImp24ESchemaProbeRequest(
  value: Imp24ESchemaProbeRequestV1,
  repositoryRoot: string,
): void {
  requireCondition(value?.schema === IMP24E_SCHEMA_PROBE_REQUEST_SCHEMA, "schema probe request schema mismatch");
  requireCondition(ROLES.includes(value.role), "schema probe request role is invalid");
  requireCondition(value.cycle === 1 || value.cycle === 2, "schema probe request cycle is invalid");
  requireCondition(value.executionId === executionIdForCycle(value.cycle), "schema probe request identity/cycle mismatch");
  const expected = buildImp24ESchemaProbeRequest({ cycle: value.cycle, role: value.role, repositoryRoot });
  requireCondition(canonicalJson(value) === canonicalJson(expected), `${value.role} schema probe request drift`);
}

function parseOutput(role: Imp24ESchemaProbeRole, raw: string): boolean {
  try {
    if (role === "reader") parseReaderExperienceModelOutputV2(raw);
    else if (role === "source") parseSourceIntegrityModelOutputV2(raw);
    else parseQuizIntegrityModelOutputV2(raw);
    return true;
  } catch {
    return false;
  }
}

function sidecarPath(manifestPath: string, suffix: ".route.json" | ".structured.json" | ".result.json"): string {
  return manifestPath.replace(/\.manifest\.json$/, suffix);
}

function bindSidecar(
  phaseDir: string,
  path: string | null,
  kind: Imp24ESchemaProbeSidecarBindingV1["kind"],
): Imp24ESchemaProbeSidecarBindingV1 | null {
  if (path === null || !existsSync(path)) return null;
  const exact = resolve(path);
  const logs = resolve(phaseDir, "live", "exec", "logs");
  const relPath = relative(resolve(phaseDir), exact).split(sep).join("/");
  const stat = lstatSync(exact);
  requireCondition(exact.startsWith(`${logs}${sep}`) && stat.isFile() && !stat.isSymbolicLink(),
    `schema probe ${kind} sidecar escaped the retained exec/logs root`);
  const bytes = readFileSync(exact);
  return { kind, relPath, bytes: bytes.length, bytesSha256: sha256Hex(bytes) };
}

function collectSidecars(
  phaseDir: string,
  boundary: CodexRunnerBoundaryV1 | null,
): { bindings: Imp24ESchemaProbeSidecarBindingV1[]; missing: string[] } {
  const manifestPath = boundary?.manifestPath ?? null;
  const candidates = [
    ["effective-context-manifest", manifestPath],
    ["route", manifestPath === null ? null : sidecarPath(manifestPath, ".route.json")],
    ["structured-output", manifestPath === null ? null : sidecarPath(manifestPath, ".structured.json")],
    ["exec-result", manifestPath === null ? null : sidecarPath(manifestPath, ".result.json")],
  ] as const;
  const bindings = candidates.flatMap(([kind, path]) => {
    const binding = bindSidecar(phaseDir, path, kind);
    return binding === null ? [] : [binding];
  });
  const present = new Set(bindings.map((binding) => binding.kind));
  return { bindings, missing: candidates.map(([kind]) => kind).filter((kind) => !present.has(kind)) };
}

function validateSuccessfulSidecars(args: {
  phaseDir: string;
  request: Imp24ESchemaProbeRequestV1;
  result: CodexAgentResult;
  boundary: CodexRunnerBoundaryV1;
  bindings: Imp24ESchemaProbeSidecarBindingV1[];
  preflight: Imp24ESchemaProbePreflightV1;
  diagnostics: CodexProcessDiagnosticsV1;
}): void {
  const byKind = new Map(args.bindings.map((binding) => [binding.kind, binding]));
  const readBinding = <T>(kind: Imp24ESchemaProbeSidecarBindingV1["kind"]): T => {
    const binding = byKind.get(kind);
    requireCondition(binding !== undefined, `${args.request.attemptId}: missing ${kind} sidecar`);
    const path = resolve(args.phaseDir, binding.relPath);
    const bytes = readFileSync(path);
    requireCondition(bytes.length === binding.bytes && sha256Hex(bytes) === binding.bytesSha256,
      `${args.request.attemptId}: ${kind} sidecar hash drift`);
    return JSON.parse(bytes.toString("utf8")) as T;
  };
  const manifest = readBinding<EffectiveContextManifestV1>("effective-context-manifest");
  const profile = resolveExecutionProfile("chapter-reviewer");
  requireCondition(validateEffectiveContextManifest(manifest).length === 0
      && manifest.sessionId === args.result.sessionId
      && manifest.role === "chapter-reviewer"
      && manifest.model === args.request.model
      && manifest.reasoningEffort === args.request.effort
      && manifest.profileHash === profile.profileHash
      && manifest.sandbox === "read-only"
      && manifest.cwdPolicy === "isolated-workspace"
      && manifest.taskSha256 === args.request.taskSha256
      && manifest.taskBytes === Buffer.byteLength(args.request.task)
      && manifest.qualification.synthetic === false
      && manifest.qualification.cliVersion === args.preflight.cliVersion
      && manifest.strictEnv.CHAPTERFLOW_NO_API_CODEX_QC === STRICT_PIPELINE_ENV.CHAPTERFLOW_NO_API_CODEX_QC
      && FORBIDDEN_PROVIDER_ENV.every((key) => !manifest.envKeys.includes(key)),
  `${args.request.attemptId}: effective-context manifest is not the exact read-only ChatGPT broker envelope`);
  const route = readBinding<RouteResultV1>("route");
  requireCondition(validateRouteResult(route).length === 0
      && route.executionRoute === "codex_exec_chatgpt_subscription"
      && route.authMode === "chatgpt"
      && route.apiKeyPresent === false
      && route.apiFallbackAllowed === false
      && route.requestedModel === args.request.model
      && route.requestedEffort === args.request.effort
      && route.executionProfileHash === profile.profileHash
      && route.routePolicyVersion === ROUTE_POLICY_VERSION,
  `${args.request.attemptId}: route sidecar is not the exact ChatGPT-only route`);
  const structured = readBinding<StructuredOutputSidecarV1>("structured-output");
  requireCondition(structured.schema === "structured-output-sidecar-v1"
      && structured.sessionId === args.result.sessionId
      && resolve(structured.outputSchemaPath) === resolve(args.boundary.outputSchemaPath ?? "")
      && structured.outputSchemaSha256 === args.request.schemaSha256
      && structured.rawFinalMessageSha256 === sha256Hex(args.result.finalMessage)
      && structured.rawFinalMessageBytes === Buffer.byteLength(args.result.finalMessage)
      && structured.parsedOk === true,
  `${args.request.attemptId}: structured-output sidecar is not bound to authoritative JSON`);
  const execResult = readBinding<ExecResultV1>("exec-result");
  requireCondition(execResult.schema === "exec-result-v1"
      && execResult.sessionId === args.result.sessionId
      && execResult.exitCode === args.result.exitCode
      && execResult.ok === args.result.ok
      && execResult.finalMessageSource === args.result.finalMessageSource
      && execResult.finalMessageSha256 === sha256Hex(args.result.finalMessage)
      && execResult.stdoutSha256 === args.diagnostics.stdoutSha256
      && execResult.stderrSha256 === args.diagnostics.stderrSha256,
  `${args.request.attemptId}: exec-result sidecar differs from process diagnostics`);
}

function preflightSha256(value: Omit<Imp24ESchemaProbePreflightV1, "preflightSha256">): string {
  return hashCanonical(value);
}

async function productionPreflight(args: {
  cycle: Imp24ESchemaProbeCycleNumber;
  executionId: Imp24ESchemaProbeExecutionId;
  implementationCiGate: Imp24ImplementationCiGateV1;
  verifiedAt: string;
  deps: Imp24ESchemaProbeDeps;
}): Promise<ProbePreflightRuntime> {
  const parentEnv = args.deps.env ?? process.env;
  const forbidden = FORBIDDEN_PROVIDER_ENV.filter((key) => {
    const value = parentEnv[key];
    return typeof value === "string" && value.length > 0;
  });
  requireCondition(forbidden.length === 0,
    `schema probe parent process carries prohibited provider env key(s): ${forbidden.join(", ")}`);
  const authPath = args.deps.authJsonPath
    ?? resolve(parentEnv.CODEX_HOME ?? resolve(homedir(), ".codex"), "auth.json");
  const auth = assertChatgptSubscriptionAuth(authPath);
  requireCondition(auth.authMode === "chatgpt" && auth.apiKeyPresent === false,
    "schema probe requires ChatGPT subscription auth without an API key");
  const bin = args.deps.codexBinary ?? findCodexBinary();
  const qualification = await qualifyCodexCli({ bin });
  assertFlagsSupported(qualification,
    ["--sandbox", "--skip-git-repo-check", "-c", "--ignore-user-config", "--ignore-rules", "--output-last-message", "--output-schema"]);
  requireCondition(qualification.synthetic === false, "synthetic CLI qualification cannot authorize schema probes");
  const profile = resolveExecutionProfile("chapter-reviewer");
  requireCondition(profile.profile.workingDir === "isolated-workspace"
      && profile.profile.codexHome === "isolated-auth-only"
      && profile.profile.allowedSandboxes.length === 1
      && profile.profile.allowedSandboxes[0] === "read-only",
  "schema probe chapter-reviewer execution profile is not hermetic read-only isolation");
  for (const role of ROLES) {
    const candidate = profileForRole(role);
    const route = resolveRoute({ role: "chapter-reviewer", requestedModel: candidate.model, requestedEffort: candidate.effort });
    requireCondition(route.model === candidate.model && route.effort === candidate.effort,
      `${role} schema-probe route did not resolve exactly`);
  }
  const core: Omit<Imp24ESchemaProbePreflightV1, "preflightSha256"> = {
    schema: IMP24E_SCHEMA_PROBE_PREFLIGHT_SCHEMA,
    cycle: args.cycle,
    executionId: args.executionId,
    verifiedAt: args.verifiedAt,
    implementationCiGateSha256: args.implementationCiGate.gateSha256,
    cliVersion: qualification.version,
    cliBinary: qualification.binPath || bin,
    cliSynthetic: false,
    executionProfileHash: profile.profileHash,
    routePolicyVersion: ROUTE_POLICY_VERSION,
    executionRoute: "codex_exec_chatgpt_subscription",
    authMode: "chatgpt",
    apiKeyPresent: false,
    apiFallbackAllowed: false,
    directHttpOrSdkAllowed: false,
    forbiddenProviderEnvKeysPresent: [],
    sandbox: "read-only",
    maximumCalls: 3,
    maximumCycles: 2,
    qualificationMetricsIncluded: false,
    apiCalls: 0,
  };
  return {
    artifact: { ...core, preflightSha256: preflightSha256(core) },
    qualification,
    bin: qualification.binPath || bin,
  };
}

function validatePreflight(value: Imp24ESchemaProbePreflightV1, gate: Imp24ImplementationCiGateV1): void {
  requireCondition(value?.schema === IMP24E_SCHEMA_PROBE_PREFLIGHT_SCHEMA
      && value.executionId === executionIdForCycle(value.cycle)
      && value.implementationCiGateSha256 === gate.gateSha256
      && value.cliSynthetic === false
      && value.executionProfileHash === resolveExecutionProfile("chapter-reviewer").profileHash
      && value.routePolicyVersion === ROUTE_POLICY_VERSION
      && value.executionRoute === "codex_exec_chatgpt_subscription"
      && value.authMode === "chatgpt"
      && value.apiKeyPresent === false
      && value.apiFallbackAllowed === false
      && value.directHttpOrSdkAllowed === false
      && value.forbiddenProviderEnvKeysPresent.length === 0
      && value.sandbox === "read-only"
      && value.maximumCalls === 3
      && value.maximumCycles === 2
      && value.qualificationMetricsIncluded === false
      && value.apiCalls === 0,
  "schema probe preflight weakens the fixed ChatGPT-only call boundary");
  const { preflightSha256: retained, ...core } = value;
  requireSha(retained, "schema probe preflight hash");
  requireCondition(retained === preflightSha256(core), "schema probe preflight self hash drift");
}

function requestResultSha256(value: Omit<Imp24ESchemaProbeResultV1, "resultSha256">): string {
  return hashCanonical(value);
}

function failureDetail(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

async function runOneProbe(args: {
  repositoryRoot: string;
  phaseDir: string;
  request: Imp24ESchemaProbeRequestV1;
  preflight: ProbePreflightRuntime;
  ledger: Imp24ESchemaProbeLedgerV1;
  paths: Imp24ESchemaProbePathsV1;
  spawn: (options: SpawnCodexAgentOptions) => Promise<CodexAgentResult>;
}): Promise<Imp24ESchemaProbeResultV1> {
  const attemptDir = resolve(args.paths.attemptsDir, args.request.attemptId);
  requireCondition(!existsSync(attemptDir), `${args.request.attemptId}: retained attempt already exists; replay is refused`);
  mkdirSync(attemptDir, { recursive: true });
  const requestPath = resolve(attemptDir, "request.json");
  const diagnosticsPath = resolve(attemptDir, "process-diagnostics.json");
  const resultPath = resolve(attemptDir, "result.json");
  const outputPath = resolve(attemptDir, "authoritative-output.json");
  persistExact(requestPath, pretty(args.request), `${args.request.attemptId} request`);
  const ledgerEntry: Imp24ESchemaProbeLedgerV1["entries"][number] = {
    role: args.request.role,
    attemptId: args.request.attemptId,
    requestSha256: args.request.requestSha256,
    status: "REQUESTED",
    processDiagnosticsSha256: null,
    resultSha256: null,
  };
  args.ledger.entries.push(ledgerEntry);
  args.ledger.brokerRequests += 1;
  requireCondition(args.ledger.brokerRequests <= 3 && args.ledger.entries.length <= 3,
    "schema probe per-cycle three-call budget exceeded");
  persistMutable(args.paths.callLedger, pretty(args.ledger), "schema probe call ledger");

  const sessionId = `imp24e-schema-probe-${sha256Hex(canonicalJson({
    attemptId: args.request.attemptId,
    requestSha256: args.request.requestSha256,
  }))}`;
  const workspaceDir = resolve(args.phaseDir, "live", "workspaces", args.request.role);
  mkdirSync(workspaceDir, { recursive: true });
  let boundary: CodexRunnerBoundaryV1 | null = null;
  let result: CodexAgentResult | null = null;
  let error: unknown = null;
  try {
    result = await args.spawn({
      task: args.request.task,
      sessionId,
      cwd: workspaceDir,
      sandbox: "read-only",
      writableRoots: [],
      skipGitRepoCheck: true,
      timeoutMs: args.request.timeoutMs,
      model: args.request.model,
      reasoningEffort: args.request.effort,
      role: "chapter-reviewer",
      outputSchemaPath: resolve(args.repositoryRoot, args.request.schemaRelPath),
      workspaceManifest: { dir: workspaceDir, files: [] },
      manifestSink: args.paths.execLogsDir,
      execBaseDir: args.paths.execSessionsDir,
      qualification: args.preflight.qualification,
      bin: args.preflight.bin,
      onRunnerBoundary: (observed) => {
        requireCondition(observed.sessionId === sessionId
            && observed.manifestPath !== null
            && observed.schemaBound === true
            && observed.outputSchemaSha256 === args.request.schemaSha256,
        `${args.request.attemptId}: broker boundary is not bound to the fixed schema request`);
        boundary = { ...observed };
        args.ledger.codexExecInvocations += 1;
        requireCondition(args.ledger.codexExecInvocations <= 3,
          "schema probe process-boundary count exceeded the per-cycle budget");
        persistMutable(args.paths.callLedger, pretty(args.ledger), "schema probe call ledger");
      },
    });
  } catch (caught) {
    error = caught;
    if (caught instanceof CodexPostRunEvidenceError) result = { ...caught.result };
  } finally {
    rmSync(workspaceDir, { recursive: true, force: true });
  }

  // Assignments occur through the broker callback/catch closure, which TS does
  // not include in its local control-flow narrowing. Snapshot them explicitly.
  const observedResult = result as CodexAgentResult | null;
  const observedBoundary = boundary as CodexRunnerBoundaryV1 | null;
  const returned = observedResult !== null;
  const outputFile = observedResult?.finalMessageSource === "output-file";
  const rawOutput = observedResult?.finalMessage ?? null;
  let parsedJson = false;
  if (rawOutput !== null) {
    try { JSON.parse(rawOutput); parsedJson = true; } catch { /* retained below */ }
  }
  const deterministicValidatorPassed = rawOutput !== null && parseOutput(args.request.role, rawOutput);
  const classification = returned
    ? observedResult!.exitCode !== 0
      ? "transport_failure"
      : !outputFile || !deterministicValidatorPassed
        ? "invalid_output"
        : "completed"
    : observedBoundary !== null && error instanceof CodexRunnerProcessError && error.failureKind === "timeout"
      ? "timeout"
      : observedBoundary === null
        ? "policy_failure"
        : "transport_failure";
  const diagnostics = buildCodexProcessDiagnosticsV1({
    attemptId: args.request.attemptId,
    requestSha256: args.request.requestSha256,
    sessionId: observedBoundary === null ? null : sessionId,
    invocation: returned ? "RUNNER_RETURNED" : observedBoundary === null ? "NOT_INVOKED" : "RUNNER_THROWN",
    classification,
    ...(returned ? {
      result: { stdout: observedResult!.stdout, stderr: observedResult!.stderr, exitCode: observedResult!.exitCode },
    } : {}),
    ...(error === null ? {} : { error }),
  });
  validateCodexProcessDiagnosticsV1(diagnostics, {
    attemptId: args.request.attemptId,
    requestSha256: args.request.requestSha256,
    sessionId: observedBoundary === null ? null : sessionId,
    classification,
  });
  persistExact(diagnosticsPath, pretty(diagnostics), `${args.request.attemptId} process diagnostics`);
  const sidecars = collectSidecars(args.phaseDir, observedBoundary);
  let sidecarError: unknown = null;
  if (observedResult !== null && observedBoundary !== null && sidecars.missing.length === 0) {
    try {
      validateSuccessfulSidecars({
        phaseDir: args.phaseDir,
        request: args.request,
        result: observedResult,
        boundary: observedBoundary,
        bindings: sidecars.bindings,
        preflight: args.preflight.artifact,
        diagnostics,
      });
    } catch (caught) {
      sidecarError = caught;
    }
  }
  const passed = returned
    && observedResult!.ok === true
    && observedResult!.exitCode === 0
    && outputFile
    && parsedJson
    && deterministicValidatorPassed
    && observedBoundary !== null
    && observedBoundary.schemaBound === true
    && sidecars.missing.length === 0
    && sidecarError === null;
  if (passed) persistExact(outputPath, `${rawOutput}\n`, `${args.request.attemptId} authoritative output`);
  const failure = passed
    ? null
    : sidecarError ?? error ?? new Error(
      `schema probe failed: exit=${String(observedResult?.exitCode ?? null)} output=${String(observedResult?.finalMessageSource ?? null)} parsed=${String(parsedJson)} validated=${String(deterministicValidatorPassed)} missingSidecars=${sidecars.missing.join(",")}`,
    );
  const core: Omit<Imp24ESchemaProbeResultV1, "resultSha256"> = {
    schema: IMP24E_SCHEMA_PROBE_RESULT_SCHEMA,
    cycle: args.request.cycle,
    executionId: args.request.executionId,
    role: args.request.role,
    attemptId: args.request.attemptId,
    requestSha256: args.request.requestSha256,
    profileId: args.request.profileId,
    model: args.request.model,
    effort: args.request.effort,
    processDiagnosticsSha256: diagnostics.diagnosticsSha256,
    runnerBoundaryCrossed: observedBoundary !== null,
    schemaBoundAtRunner: observedBoundary?.schemaBound === true,
    chatgptAuthVerified: args.preflight.artifact.authMode === "chatgpt"
      && args.preflight.artifact.apiKeyPresent === false,
    apiCalls: 0,
    finalMessageSource: observedResult?.finalMessageSource ?? null,
    authoritativeOutputFileProduced: outputFile,
    authoritativeOutputRelPath: passed
      ? relative(args.phaseDir, outputPath).split(sep).join("/")
      : null,
    rawOutput,
    rawOutputSha256: rawOutput === null ? null : sha256Hex(rawOutput),
    rawOutputBytes: rawOutput === null ? null : Buffer.byteLength(rawOutput),
    parsedJson,
    deterministicValidatorPassed,
    sidecars: sidecars.bindings,
    missingRequiredSidecars: sidecars.missing,
    qualificationMetricsIncluded: false,
    passed,
    failureClassification: passed ? null : classification,
    failureDetail: failure === null ? null : failureDetail(failure),
  };
  const probeResult = { ...core, resultSha256: requestResultSha256(core) };
  persistExact(resultPath, pretty(probeResult), `${args.request.attemptId} result`);
  ledgerEntry.status = passed ? "PASS" : "FAIL";
  ledgerEntry.processDiagnosticsSha256 = diagnostics.diagnosticsSha256;
  ledgerEntry.resultSha256 = probeResult.resultSha256;
  persistMutable(args.paths.callLedger, pretty(args.ledger), "schema probe call ledger");
  return probeResult;
}

export function validateImp24ESchemaProbeCycle(value: Imp24ESchemaProbeCycleV1): void {
  requireCondition(value?.schema === IMP24E_SCHEMA_PROBE_CYCLE_SCHEMA
      && (value.cycle === 1 || value.cycle === 2)
      && value.executionId === executionIdForCycle(value.cycle)
      && GIT_SHA.test(value.implementationCommit)
      && Number.isSafeInteger(value.workflowRunId) && value.workflowRunId > 0
      && value.results.length === 3
      && canonicalJson(value.results.map((result) => result.role)) === canonicalJson(ROLES)
      && new Set(value.results.map((result) => result.attemptId)).size === 3
      && value.brokerRequests === 3
      && Number.isSafeInteger(value.codexExecInvocations)
      && value.codexExecInvocations >= 0 && value.codexExecInvocations <= 3
      && value.apiCalls === 0
      && value.qualificationMetricsIncluded === false
      && value.qualificationArtifactsCreated === false
      && value.status === (value.results.every((result) => result.passed) ? "PASS" : "FAIL")
      && Number.isFinite(Date.parse(value.startedAt))
      && Number.isFinite(Date.parse(value.completedAt))
      && Date.parse(value.completedAt) >= Date.parse(value.startedAt),
  "IMP-24E schema probe cycle identity/count/status drift");
  for (const result of value.results) {
    requireCondition(result.schema === IMP24E_SCHEMA_PROBE_RESULT_SCHEMA
        && result.cycle === value.cycle
        && result.executionId === value.executionId
        && result.qualificationMetricsIncluded === false
        && result.apiCalls === 0,
    `${result.role} schema probe result binding drift`);
    const { resultSha256, ...core } = result;
    requireSha(resultSha256, `${result.role} schema probe result hash`);
    requireCondition(resultSha256 === requestResultSha256(core), `${result.role} schema probe result self hash drift`);
  }
  const { cycleSha256, ...core } = value;
  requireSha(cycleSha256, "schema probe cycle hash");
  requireCondition(cycleSha256 === hashCanonical(core), "schema probe cycle self hash drift");
}

export function verifyRetainedImp24ESchemaProbeCycle(args: {
  repositoryRoot: string;
  cycle: Imp24ESchemaProbeCycleNumber;
  retainedArtifactRoot?: string;
}): Imp24ESchemaProbeCycleV1 {
  const retainedArtifactRoot = resolve(args.retainedArtifactRoot ?? args.repositoryRoot);
  const paths = imp24ESchemaProbePaths(retainedArtifactRoot, args.cycle);
  const cycle = readExactJson<Imp24ESchemaProbeCycleV1>(paths.cycleResult, "schema probe cycle result");
  validateImp24ESchemaProbeCycle(cycle);
  const gate = readExactJson<Imp24ImplementationCiGateV1>(paths.implementationCiGate, "schema probe implementation CI gate");
  validateImp24ImplementationCiGate({
    gate,
    expectedHeadSha: cycle.implementationCommit,
    checkout: gate.trustedEvidence.raw.checkout,
  });
  const preflight = readExactJson<Imp24ESchemaProbePreflightV1>(paths.preflight, "schema probe preflight");
  validatePreflight(preflight, gate);
  const ledger = readExactJson<Imp24ESchemaProbeLedgerV1>(paths.callLedger, "schema probe call ledger");
  requireCondition(ledger.schema === IMP24E_SCHEMA_PROBE_LEDGER_SCHEMA
      && ledger.cycle === cycle.cycle
      && ledger.executionId === cycle.executionId
      && ledger.entries.length === 3
      && ledger.brokerRequests === 3
      && ledger.codexExecInvocations === cycle.codexExecInvocations
      && ledger.apiCalls === 0
      && ledger.qualificationMetricsIncluded === false,
  "schema probe retained call ledger drift");
  for (const result of cycle.results) {
    const attemptDir = resolve(paths.attemptsDir, result.attemptId);
    const request = readExactJson<Imp24ESchemaProbeRequestV1>(resolve(attemptDir, "request.json"), `${result.role} schema probe request`);
    validateImp24ESchemaProbeRequest(request, args.repositoryRoot);
    const diagnostics = readExactJson<CodexProcessDiagnosticsV1>(resolve(attemptDir, "process-diagnostics.json"), `${result.role} schema probe diagnostics`);
    validateCodexProcessDiagnosticsV1(diagnostics, {
      attemptId: result.attemptId,
      requestSha256: result.requestSha256,
      classification: diagnostics.classification,
    });
    requireCondition(diagnostics.diagnosticsSha256 === result.processDiagnosticsSha256,
      `${result.role} schema probe diagnostics/result binding drift`);
    const retainedResult = readExactJson<Imp24ESchemaProbeResultV1>(resolve(attemptDir, "result.json"), `${result.role} schema probe result`);
    requireCondition(canonicalJson(retainedResult) === canonicalJson(result), `${result.role} cycle/result bytes drift`);
    if (result.passed) {
      requireCondition(result.authoritativeOutputRelPath !== null, `${result.role} PASS lacks authoritative output path`);
      const outputPath = resolve(paths.stateRoot, result.authoritativeOutputRelPath);
      const raw = readFileSync(outputPath, "utf8");
      requireCondition(raw === `${result.rawOutput}\n` && parseOutput(result.role, result.rawOutput ?? ""),
        `${result.role} retained authoritative output drift`);
    }
  }
  return cycle;
}

function reportSha256(value: Omit<Imp24ESchemaProbeReportV1, "reportSha256">): string {
  return hashCanonical(value);
}

export function buildImp24ESchemaProbeReport(cycles: Imp24ESchemaProbeCycleV1[]): Imp24ESchemaProbeReportV1 {
  requireCondition(cycles.length >= 1 && cycles.length <= 2, "schema probe report must contain one or two cycles");
  cycles.forEach(validateImp24ESchemaProbeCycle);
  requireCondition(cycles[0]?.cycle === 1
      && (cycles.length === 1 || cycles[0].status === "FAIL" && cycles[1]?.cycle === 2),
  "schema probe report repeat chronology is invalid");
  const final = cycles[cycles.length - 1]!;
  const core: Omit<Imp24ESchemaProbeReportV1, "reportSha256"> = {
    schema: IMP24E_SCHEMA_PROBE_REPORT_SCHEMA,
    status: final.status,
    cycles,
    totalBrokerRequests: cycles.reduce((sum, cycle) => sum + cycle.brokerRequests, 0),
    totalCodexExecInvocations: cycles.reduce((sum, cycle) => sum + cycle.codexExecInvocations, 0),
    maximumCallsPerCycle: 3,
    maximumCycles: 2,
    maximumCallsAuthorized: 6,
    apiCalls: 0,
    qualificationMetricsIncluded: false,
    qualificationArtifactsCreated: false,
  };
  return { ...core, reportSha256: reportSha256(core) };
}

export function renderImp24ESchemaProbeReport(report: Imp24ESchemaProbeReportV1): string {
  const lines = [
    "# IMP-24E Schema Probe Result",
    "",
    `- Status: **${report.status}**`,
    `- Cycles: **${report.cycles.length}/2 maximum**`,
    `- Broker requests: **${report.totalBrokerRequests}/6 maximum**`,
    `- Codex exec invocations: **${report.totalCodexExecInvocations}**`,
    "- API calls: **0**",
    "- Qualification metrics: **excluded**",
    "- Qualification artifacts created: **false**",
    "",
  ];
  for (const cycle of report.cycles) {
    lines.push(`## Cycle ${cycle.cycle}: ${cycle.status}`, "");
    lines.push(`- Exact CI: run **${cycle.workflowRunId}**, commit \`${cycle.implementationCommit}\``);
    for (const result of cycle.results) {
      lines.push(`- ${result.role}: **${result.passed ? "PASS" : "FAIL"}** — \`${result.profileId}\``);
    }
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

function persistReport(repositoryRoot: string, report: Imp24ESchemaProbeReportV1): void {
  persistMutable(resolve(repositoryRoot, IMP24E_SCHEMA_PROBE_REPORT_JSON_REL_PATH), pretty(report), "IMP-24E schema probe report");
  persistMutable(resolve(repositoryRoot, IMP24E_SCHEMA_PROBE_REPORT_MARKDOWN_REL_PATH), renderImp24ESchemaProbeReport(report), "IMP-24E schema probe markdown report");
}

export async function runImp24ESchemaProbes(
  args: RunImp24ESchemaProbeArgs,
  deps: Imp24ESchemaProbeDeps = {},
): Promise<RunImp24ESchemaProbeResult> {
  if (args.executeLive !== true) {
    return {
      code: 2, executed: false, cycleResult: null, report: null, modelCalls: 0, apiCalls: 0,
      message: "IMP-24E schema probes require literal --execute-live",
    };
  }
  requireCondition(args.cycle === 1 || args.cycle === 2, "schema probe cycle must be 1 or 2");
  requireCondition(GIT_SHA.test(args.expectedHeadSha), "schema probe expected HEAD must be a lowercase 40-character git SHA");
  requireCondition(Number.isSafeInteger(args.workflowRunId) && args.workflowRunId > 0,
    "schema probe workflow run ID must be a positive integer");
  const repositoryRoot = resolve(args.repositoryRoot);
  const retainedArtifactRoot = resolve(deps.retainedArtifactRoot ?? repositoryRoot);
  const paths = imp24ESchemaProbePaths(retainedArtifactRoot, args.cycle);
  if (existsSync(paths.cycleResult)) {
    const retained = verifyRetainedImp24ESchemaProbeCycle({
      repositoryRoot,
      retainedArtifactRoot,
      cycle: args.cycle,
    });
    requireCondition(retained.implementationCommit === args.expectedHeadSha
        && retained.workflowRunId === args.workflowRunId,
    "retained schema probe cycle belongs to a different exact CI gate");
    const cycles = args.cycle === 1
      ? [retained]
      : [verifyRetainedImp24ESchemaProbeCycle({ repositoryRoot, retainedArtifactRoot, cycle: 1 }), retained];
    const report = buildImp24ESchemaProbeReport(cycles);
    persistReport(retainedArtifactRoot, report);
    return {
      code: retained.status === "PASS" ? 0 : 1,
      executed: false,
      cycleResult: retained,
      report,
      modelCalls: 0,
      apiCalls: 0,
      message: `IMP-24E schema probe cycle ${args.cycle} retained evidence verified; no calls made`,
    };
  }
  requireCondition(!existsSync(paths.stateRoot) || readdirSync(paths.stateRoot).length === 0,
    `schema probe cycle ${args.cycle} root is partial; replay is refused`);
  let firstCycle: Imp24ESchemaProbeCycleV1 | null = null;
  if (args.cycle === 2) {
    firstCycle = verifyRetainedImp24ESchemaProbeCycle({ repositoryRoot, retainedArtifactRoot, cycle: 1 });
    requireCondition(firstCycle.status === "FAIL", "schema probe repeat is forbidden after cycle 1 PASS");
    requireCondition(firstCycle.implementationCommit !== args.expectedHeadSha,
      "schema probe repeat requires a different exact-CI implementation commit");
  }
  const now = (): Date => {
    const date = deps.clock?.() ?? new Date();
    requireCondition(date instanceof Date && Number.isFinite(date.getTime()), "schema probe clock returned an invalid date");
    return date;
  };
  const gateVerifiedAt = now().toISOString();
  const collect = deps.collectImplementationCiGate ?? collectImp24ImplementationCiGate;
  const gate = collect({
    repositoryRoot,
    expectedHeadSha: args.expectedHeadSha,
    workflowRunId: args.workflowRunId,
    verifiedAt: gateVerifiedAt,
  });
  validateImp24ImplementationCiGate({
    gate,
    expectedHeadSha: args.expectedHeadSha,
    checkout: gate.trustedEvidence.raw.checkout,
  });
  const executionId = executionIdForCycle(args.cycle);
  const preflightRuntime = deps.preflight
    ? await deps.preflight({ cycle: args.cycle, executionId, implementationCiGate: gate, verifiedAt: now().toISOString() })
    : await productionPreflight({
      cycle: args.cycle,
      executionId,
      implementationCiGate: gate,
      verifiedAt: now().toISOString(),
      deps,
    });
  validatePreflight(preflightRuntime.artifact, gate);
  requireCondition(preflightRuntime.qualification.synthetic === false,
    "schema probe runtime cannot use synthetic CLI qualification");

  mkdirSync(paths.stateRoot, { recursive: true });
  persistExact(paths.implementationCiGate, pretty(gate), "schema probe implementation CI gate");
  persistExact(paths.preflight, pretty(preflightRuntime.artifact), "schema probe preflight");
  const ledger: Imp24ESchemaProbeLedgerV1 = {
    schema: IMP24E_SCHEMA_PROBE_LEDGER_SCHEMA,
    cycle: args.cycle,
    executionId,
    entries: [],
    brokerRequests: 0,
    codexExecInvocations: 0,
    apiCalls: 0,
    qualificationMetricsIncluded: false,
  };
  persistExact(paths.callLedger, pretty(ledger), "schema probe call ledger");
  const startedAt = now().toISOString();
  const results: Imp24ESchemaProbeResultV1[] = [];
  const spawn = deps.spawn ?? spawnCodexAgent;
  for (const role of ROLES) {
    const request = buildImp24ESchemaProbeRequest({ cycle: args.cycle, role, repositoryRoot });
    results.push(await runOneProbe({
      repositoryRoot,
      phaseDir: paths.stateRoot,
      request,
      preflight: preflightRuntime,
      ledger,
      paths,
      spawn,
    }));
  }
  requireCondition(results.length === 3, "schema probe cycle did not execute the exact three-role plan");
  const cycleCore: Omit<Imp24ESchemaProbeCycleV1, "cycleSha256"> = {
    schema: IMP24E_SCHEMA_PROBE_CYCLE_SCHEMA,
    cycle: args.cycle,
    executionId,
    implementationCommit: args.expectedHeadSha,
    workflowRunId: args.workflowRunId,
    implementationCiGateSha256: gate.gateSha256,
    preflightSha256: preflightRuntime.artifact.preflightSha256,
    results: results as Imp24ESchemaProbeCycleV1["results"],
    brokerRequests: 3,
    codexExecInvocations: ledger.codexExecInvocations,
    apiCalls: 0,
    qualificationMetricsIncluded: false,
    qualificationArtifactsCreated: false,
    status: results.every((result) => result.passed) ? "PASS" : "FAIL",
    startedAt,
    completedAt: now().toISOString(),
  };
  const cycleResult = { ...cycleCore, cycleSha256: hashCanonical(cycleCore) };
  validateImp24ESchemaProbeCycle(cycleResult);
  persistExact(paths.cycleResult, pretty(cycleResult), "schema probe cycle result");
  const report = buildImp24ESchemaProbeReport(firstCycle === null ? [cycleResult] : [firstCycle, cycleResult]);
  persistReport(retainedArtifactRoot, report);
  return {
    code: cycleResult.status === "PASS" ? 0 : 1,
    executed: true,
    cycleResult,
    report,
    modelCalls: ledger.codexExecInvocations,
    apiCalls: 0,
    message: `IMP-24E schema probe cycle ${args.cycle}: ${cycleResult.status}`,
  };
}
