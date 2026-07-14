/**
 * IMP-24 live boundary for the current V3 successor execution.
 *
 * The core runner remains pure. This module proves the ChatGPT-authenticated
 * `codex exec` route, revalidates the retained production seal against current
 * repository bytes, and provides a crash-safe executor that retains the exact
 * inline envelope before entering the shared reviewer broker. Tests inject the
 * spawn function; production defaults remain inside forwardReviewerExecutor.
 */

import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, relative, resolve, sep } from "node:path";

import { PIPELINE_DIR } from "../bakeoff/paths.js";
import { canonicalJson, sha256Hex, hashCanonical } from "../contracts/contractUtil.js";
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
  IMP24_BASE_MAXIMUM_CALLS,
  IMP24_HARD_MAXIMUM_CALLS,
  IMP24_REQUIRED_ROLE_QUALIFIERS,
  IMP24_ROLE_CANDIDATE_ORDER,
  IMP24_ROLE_QUALIFICATION_AVAILABILITY_SCHEMA,
  IMP24_ROLE_QUALIFICATION_RECEIPT_SCHEMA,
  IMP24_ROLE_QUALIFICATION_REQUEST_SCHEMA,
  IMP24_ROLE_QUALIFICATION_RUNNER_SCHEMA,
  assembleQualificationAttemptV3,
  buildQualificationExecutionRequestV3,
  buildRoleQualificationPlanV3,
  candidateAvailabilitySha256,
  qualificationReceiptSha256,
  qualificationReceiptMismatchesV3,
  qualificationRequestSha256,
  scoreQualificationHoldoutV3,
  type CandidateAvailabilityV3,
  type CaseEvaluationV3,
  type QualificationAttemptV3,
  type QualificationExecutionReceiptV3,
  type QualificationExecutionRequestV3,
  type QualificationExecutorV3,
  type QualificationFreezeV3,
  type QualificationOutputEvaluatorV3,
  type QualificationReceiptStatusV3,
  type QualificationScheduleEntryV3,
  type RoleQualificationRunnerResultV3,
  type RunRoleQualificationInputV3,
} from "../bakeoff/migration/roleQualificationRunnerV3.js";
import {
  IMP24_ROLE_QUALIFICATION_EXECUTION_ID,
  type Imp24ReviewRole,
} from "../bakeoff/migration/imp24Corpus.js";
import { qualifyRole } from "../bakeoff/migration/roleQualification.js";
import {
  createImp24QualificationEvaluator,
  prepareImp24QualificationCases,
} from "../bakeoff/migration/imp24InstrumentCertification.js";
import {
  validateForwardProductionInstrumentSeal,
} from "./forwardProductionInstrumentSeal.js";
import {
  createForwardReviewerExecutor,
  ForwardReviewerExecutorError,
  type ForwardReviewerSchemaMap,
  type ForwardReviewerSpawn,
} from "./forwardReviewerExecutor.js";
import {
  FORWARD_REVIEW_EXECUTION_REQUEST_SCHEMA,
  type ForwardReviewExecutionRequestV1,
  type ForwardReviewerWorkspaceRole,
} from "./forwardChapterConductor.js";
import {
  CodexPostRunEvidenceError,
  findCodexBinary,
  spawnCodexAgent as hermeticCodexSpawn,
  type CodexAgentResult,
  type CodexRunnerBoundaryV1,
} from "./codexAgent.js";
import {
  buildCodexProcessDiagnosticsV1,
  validateCodexProcessDiagnosticsV1,
  type CodexProcessDiagnosticsV1,
} from "./codexProcessDiagnostics.js";
import {
  ROUTE_POLICY_VERSION,
  explicitRefusalSignal,
  resolveRoute,
  routeDriftFingerprint,
} from "./modelPolicy.js";

export const IMP24_LIVE_PREFLIGHT_SCHEMA = "imp24-role-qualification-live-preflight-v3" as const;
export const IMP24_LIVE_CALL_LEDGER_SCHEMA = "imp24-role-qualification-live-call-ledger-v4" as const;
export const IMP24_LIVE_ATTEMPT_RETENTION_SCHEMA = "imp24-role-qualification-live-attempt-retention-v4" as const;
export const IMP24_LIVE_ATTEMPT_EVALUATION_SCHEMA = "imp24-role-qualification-live-attempt-evaluation-v3" as const;
export const IMP24_LIVE_EXECUTION_EVIDENCE_SCHEMA = "imp24-role-qualification-live-execution-evidence-v4" as const;
export const IMP24_CANDIDATE_AVAILABILITY_POLICY_SCHEMA = "imp24-candidate-availability-policy-v1" as const;
export const IMP24D_TRANSPORT_SMOKE_EXECUTION_ID =
  "s16-forward-role-qualification-v3-envelope-transport-smoke" as const;
export const IMP24D_TRANSPORT_SMOKE_R2_EXECUTION_ID =
  "s16-forward-role-qualification-v3-envelope-transport-smoke-r2" as const;

/** Control-plane identities that may use the exact live reviewer boundary.
 * The smoke identities are diagnostic-only and are never accepted by the
 * qualification runner or its retained r2 state root. */
export type Imp24LiveExecutionIdentityV3 =
  | typeof IMP24_ROLE_QUALIFICATION_EXECUTION_ID
  | typeof IMP24D_TRANSPORT_SMOKE_EXECUTION_ID
  | typeof IMP24D_TRANSPORT_SMOKE_R2_EXECUTION_ID;

const IMP24_LIVE_EXECUTION_IDENTITIES = new Set<string>([
  IMP24_ROLE_QUALIFICATION_EXECUTION_ID,
  IMP24D_TRANSPORT_SMOKE_EXECUTION_ID,
  IMP24D_TRANSPORT_SMOKE_R2_EXECUTION_ID,
]);

function requireImp24LiveExecutionIdentityV3(
  executionId: string,
): asserts executionId is Imp24LiveExecutionIdentityV3 {
  requireCondition(IMP24_LIVE_EXECUTION_IDENTITIES.has(executionId),
    "live v3 execution identity is not an authorized qualification or transport-smoke identity");
}

export type LiveQualificationExecutionRequestV3 = Omit<
  QualificationExecutionRequestV3,
  "experimentId"
> & { experimentId: Imp24LiveExecutionIdentityV3 };

const ROLES = ["reader", "source", "quiz"] as const satisfies readonly Imp24ReviewRole[];
const SHA256 = /^[a-f0-9]{64}$/;
const LIVE_ATTEMPT_FILE_NAMES = Object.freeze([
  "evaluation.json",
  "evidence-envelope.json",
  "execution-evidence.json",
  "process-diagnostics.json",
  "receipt.json",
  "request.json",
  "retention.json",
] as const);

export const IMP24_V2_REVIEWER_SCHEMA_MAP: ForwardReviewerSchemaMap = Object.freeze({
  reader: resolve(PIPELINE_DIR, "state", "migration-experiments", "contracts", "schemas", "reader-experience-model-output-v2.schema.json"),
  source: resolve(PIPELINE_DIR, "state", "migration-experiments", "contracts", "schemas", "source-integrity-model-output-v2.schema.json"),
  quiz: resolve(PIPELINE_DIR, "state", "migration-experiments", "contracts", "schemas", "quiz-integrity-model-output-v2.schema.json"),
});

export type CandidateAvailabilityPolicyCoreV3 = {
  schema: typeof IMP24_CANDIDATE_AVAILABILITY_POLICY_SCHEMA;
  source: "codex-local-models-cache";
  sourceFile: "models_cache.json";
  maximumCacheAgeSeconds: number;
  maximumFutureSkewSeconds: number;
  requiredVisibility: "list";
  requireExactModelSlug: true;
  requireReasoningEffortSupport: true;
  skipUnavailableWithoutReordering: true;
  candidateReorderingAllowed: false;
  networkCalls: 0;
  modelCalls: 0;
  apiCalls: 0;
};

export type CandidateAvailabilityPolicyV3 = CandidateAvailabilityPolicyCoreV3 & {
  policySha256: string;
};

const IMP24_CANDIDATE_AVAILABILITY_POLICY_CORE: Readonly<CandidateAvailabilityPolicyCoreV3> = Object.freeze({
  schema: IMP24_CANDIDATE_AVAILABILITY_POLICY_SCHEMA,
  source: "codex-local-models-cache",
  sourceFile: "models_cache.json",
  maximumCacheAgeSeconds: 86_400,
  maximumFutureSkewSeconds: 300,
  requiredVisibility: "list",
  requireExactModelSlug: true,
  requireReasoningEffortSupport: true,
  skipUnavailableWithoutReordering: true,
  candidateReorderingAllowed: false,
  networkCalls: 0,
  modelCalls: 0,
  apiCalls: 0,
});

export function candidateAvailabilityPolicySha256(policy: CandidateAvailabilityPolicyCoreV3): string {
  return hashCanonical(policy);
}

/** Exact operator-facing local-discovery policy. It is frozen, self-hashed,
 * and serialized with canonicalJson; no caller may substitute a looser cache,
 * visibility, effort, or ordering policy. */
export const IMP24_FROZEN_CANDIDATE_AVAILABILITY_POLICY: Readonly<CandidateAvailabilityPolicyV3> = Object.freeze({
  ...IMP24_CANDIDATE_AVAILABILITY_POLICY_CORE,
  policySha256: candidateAvailabilityPolicySha256(IMP24_CANDIDATE_AVAILABILITY_POLICY_CORE),
});
export const IMP24_CANDIDATE_AVAILABILITY_POLICY_CANONICAL_BYTES =
  canonicalJson(IMP24_FROZEN_CANDIDATE_AVAILABILITY_POLICY);
export const IMP24_CANDIDATE_AVAILABILITY_POLICY_BYTES_SHA256 =
  sha256Hex(IMP24_CANDIDATE_AVAILABILITY_POLICY_CANONICAL_BYTES);

type LocalModelsCacheV3 = {
  fetched_at: string;
  models: Array<{
    slug: string;
    visibility?: string;
    supported_reasoning_levels?: Array<{ effort?: string }>;
  }>;
};

export type LiveQualificationPreflightV3 = {
  schema: typeof IMP24_LIVE_PREFLIGHT_SCHEMA;
  experimentId: Imp24LiveExecutionIdentityV3;
  verifiedAt: string;
  freezeSha256: string;
  certificationSha256: string;
  productionInstrumentSealSha256: string;
  corpusBundleSha256: string;
  candidateAvailabilitySha256: string;
  candidateAvailabilitySourceBytesSha256: string;
  cliVersion: string;
  cliBinary: string;
  cliSynthetic: boolean;
  executionProfileHash: string;
  routePolicyVersion: string;
  executionRoute: "codex_exec_chatgpt_subscription";
  authMode: "chatgpt";
  apiKeyPresent: false;
  apiFallbackAllowed: false;
  directHttpOrSdkAllowed: false;
  forbiddenProviderEnvKeysPresent: [];
  baseMaximumCalls: typeof IMP24_BASE_MAXIMUM_CALLS;
  hardMaximumCalls: typeof IMP24_HARD_MAXIMUM_CALLS;
  preflightSha256: string;
};

/** Validate the retained route authorizer independently of any attempt. The
 * exact binary path/version recorded here is the cross-attempt CLI identity;
 * rehashing a manifest with a different executable must not make it valid. */
export function validateLiveQualificationPreflightArtifactV3(
  preflight: LiveQualificationPreflightV3,
  expectedExecutionId: Imp24LiveExecutionIdentityV3 = IMP24_ROLE_QUALIFICATION_EXECUTION_ID,
): void {
  requireExactObjectKeys(preflight, [
    "schema", "experimentId", "verifiedAt", "freezeSha256", "certificationSha256",
    "productionInstrumentSealSha256", "corpusBundleSha256", "candidateAvailabilitySha256",
    "candidateAvailabilitySourceBytesSha256", "cliVersion", "cliBinary", "cliSynthetic",
    "executionProfileHash", "routePolicyVersion", "executionRoute", "authMode", "apiKeyPresent",
    "apiFallbackAllowed", "directHttpOrSdkAllowed", "forbiddenProviderEnvKeysPresent",
    "baseMaximumCalls", "hardMaximumCalls", "preflightSha256",
  ], "live V3 retained preflight");
  requireCondition(preflight?.schema === IMP24_LIVE_PREFLIGHT_SCHEMA
      && preflight.experimentId === expectedExecutionId,
  "live V3 retained preflight identity mismatch");
  const { preflightSha256, ...core } = preflight;
  requireSha(preflightSha256, "live V3 retained preflight hash");
  requireCondition(preflightSha256 === hashCanonical(core),
    "live V3 retained preflight self hash drift");
  requireCondition(typeof preflight.verifiedAt === "string"
      && Number.isFinite(Date.parse(preflight.verifiedAt))
      && new Date(preflight.verifiedAt).toISOString() === preflight.verifiedAt
      && typeof preflight.cliBinary === "string" && preflight.cliBinary.trim().length > 0
      && typeof preflight.cliVersion === "string" && preflight.cliVersion.trim().length > 0
      && preflight.cliSynthetic === false
      && preflight.executionProfileHash === resolveExecutionProfile("chapter-reviewer").profileHash
      && preflight.routePolicyVersion === ROUTE_POLICY_VERSION
      && preflight.executionRoute === "codex_exec_chatgpt_subscription"
      && preflight.authMode === "chatgpt"
      && preflight.apiKeyPresent === false
      && preflight.apiFallbackAllowed === false
      && preflight.directHttpOrSdkAllowed === false
      && Array.isArray(preflight.forbiddenProviderEnvKeysPresent)
      && preflight.forbiddenProviderEnvKeysPresent.length === 0
      && preflight.baseMaximumCalls === IMP24_BASE_MAXIMUM_CALLS
      && preflight.hardMaximumCalls === IMP24_HARD_MAXIMUM_CALLS,
  "live V3 retained preflight is not the exact ChatGPT-only CLI route");
}

export type LiveCallLedgerEntryV3 = {
  attemptId: string;
  scheduleId: string;
  requestSha256: string;
  evidenceEnvelopeSha256: string;
  evidenceEnvelopeBytesSha256: string;
  receiptSha256: string | null;
  processDiagnosticsSha256: string | null;
  executionEvidenceSha256: string | null;
  evaluationArtifactSha256: string | null;
  status: "REQUESTED" | QualificationReceiptStatusV3;
  cached: boolean;
  requestedAt: string;
  completedAt: string | null;
};

export type LiveCallLedgerV3 = {
  schema: typeof IMP24_LIVE_CALL_LEDGER_SCHEMA;
  experimentId: Imp24LiveExecutionIdentityV3;
  freezeSha256: string;
  certificationSha256: string;
  productionInstrumentSealSha256: string;
  entries: LiveCallLedgerEntryV3[];
  brokerRequests: number;
  codexExecInvocations: number;
  cachedReceipts: number;
  infrastructureReplays: number;
  maxPlanCapacityEvents: number;
  apiCallsMade: 0;
};

/** Return attempts that prove a request was opened after the first completed
 * campaign-fatal receipt. Requests already open at that instant are allowed to
 * drain and retain evidence later; only strictly later requestedAt values are
 * forbidden. Timestamp validity is checked by the enclosing ledger verifier. */
export function fatalReceiptChronologyViolationsV3(
  ledger: Pick<LiveCallLedgerV3, "entries">,
): string[] {
  const fatalCompletedTimes = ledger.entries
    .filter((entry) => entry.status === "policy_failure" || entry.status === "integrity_failure")
    .map((entry) => entry.completedAt === null ? Number.NaN : Date.parse(entry.completedAt))
    .filter(Number.isFinite);
  if (fatalCompletedTimes.length === 0) return [];
  const earliestFatalCompletedAt = Math.min(...fatalCompletedTimes);
  return ledger.entries
    .filter((entry) => {
      const requestedAt = Date.parse(entry.requestedAt);
      return Number.isFinite(requestedAt) && requestedAt > earliestFatalCompletedAt;
    })
    .map((entry) => entry.attemptId)
    .sort();
}

/** Model-free ordering proof for the one authorized infrastructure replay.
 * A replay must appear after its exact `-a1` predecessor and cannot be
 * requested before that predecessor has completed. */
export function replayReceiptChronologyViolationsV3(
  ledger: Pick<LiveCallLedgerV3, "entries">,
): string[] {
  const byAttemptId = new Map(ledger.entries.map((entry) => [entry.attemptId, entry]));
  const indexByAttemptId = new Map(ledger.entries.map((entry, index) => [entry.attemptId, index]));
  const violations: string[] = [];
  for (const replay of ledger.entries.filter((entry) => entry.attemptId === `${entry.scheduleId}-a2`)) {
    const predecessorId = `${replay.scheduleId}-a1`;
    const predecessor = byAttemptId.get(predecessorId);
    if (predecessor === undefined
        || (indexByAttemptId.get(predecessorId) ?? Number.POSITIVE_INFINITY)
          >= (indexByAttemptId.get(replay.attemptId) ?? Number.NEGATIVE_INFINITY)) {
      violations.push(`${replay.attemptId}:predecessor-order`);
      continue;
    }
    if (predecessor.completedAt === null
        || !Number.isFinite(Date.parse(predecessor.completedAt))
        || !Number.isFinite(Date.parse(replay.requestedAt))
        || Date.parse(replay.requestedAt) < Date.parse(predecessor.completedAt)) {
      violations.push(`${replay.attemptId}:requested-before-predecessor-completed`);
    }
  }
  return violations.sort();
}

export type LiveAttemptRetentionV3 = {
  schema: typeof IMP24_LIVE_ATTEMPT_RETENTION_SCHEMA;
  requestSha256: string;
  receiptSha256: string;
  evidenceEnvelopeSha256: string;
  evidenceEnvelopeBytesSha256: string;
  processDiagnosticsSha256: string;
  executionEvidenceSha256: string;
  request: LiveQualificationExecutionRequestV3;
  receipt: QualificationExecutionReceiptV3;
  retentionSha256: string;
};

/** Fifth per-attempt evidence artifact. Raw output remains in receipt.json;
 * this file durably preserves the parsed model object, full conductor-owned
 * assembly, and explicit evidence-reference resolution returned by the frozen
 * evaluator. */
export type LiveAttemptEvaluationV3 = {
  schema: typeof IMP24_LIVE_ATTEMPT_EVALUATION_SCHEMA;
  attemptId: string;
  requestSha256: string;
  receiptSha256: string;
  executionEvidenceSha256: string;
  rawOutputSha256: string | null;
  evaluationSha256: string | null;
  parsedOutputSha256: string | null;
  assembledReviewSha256: string | null;
  evidenceReferenceResolutionSha256: string | null;
  terminalReason: string;
  evaluation: CaseEvaluationV3 | null;
  evaluationArtifactSha256: string;
};

export type LiveExecutionSidecarKindV3 =
  | "effective-context-manifest"
  | "route"
  | "structured-output"
  | "exec-result";

export type LiveExecutionSidecarBindingV3 = {
  kind: LiveExecutionSidecarKindV3;
  relPath: string;
  bytes: number;
  bytesSha256: string;
};

export type LiveAttemptExecutionEvidenceV3 = {
  schema: typeof IMP24_LIVE_EXECUTION_EVIDENCE_SCHEMA;
  attemptId: string;
  requestSha256: string;
  receiptSha256: string;
  processDiagnosticsSha256: string;
  invocation: "NOT_INVOKED_PRE_SPAWN" | "RUNNER_RETURNED" | "RUNNER_THREW";
  evidenceComplete: boolean;
  sessionId: string | null;
  schemaRequested: true;
  schemaBoundAtRunner: boolean;
  finalMessageSource: "output-file" | "stdout-fallback" | null;
  responseProduced: boolean;
  rawFinalOutputSha256: string | null;
  rawFinalOutputBytes: number | null;
  effectiveContextManifest: LiveExecutionSidecarBindingV3 | null;
  routeSidecar: LiveExecutionSidecarBindingV3 | null;
  structuredOutputSidecar: LiveExecutionSidecarBindingV3 | null;
  resultSidecar: LiveExecutionSidecarBindingV3 | null;
  missingRequiredSidecars: LiveExecutionSidecarKindV3[];
  unexpectedSidecarRelPaths: string[];
  executionEvidenceSha256: string;
};

export class ForwardRoleQualificationLiveV3Error extends Error {
  readonly classification = "policy_preflight_failure" as const;

  constructor(message: string) {
    super(message);
    this.name = "ForwardRoleQualificationLiveV3Error";
  }
}

export class ForwardRoleQualificationRetainedEvidenceIncompleteV3Error extends Error {
  readonly classification = "retained_evidence_incomplete" as const;

  constructor(message: string) {
    super(message);
    this.name = "ForwardRoleQualificationRetainedEvidenceIncompleteV3Error";
  }
}

function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new ForwardRoleQualificationLiveV3Error(message);
}

function requireExactObjectKeys(
  value: unknown,
  keys: readonly string[],
  label: string,
): asserts value is Record<string, unknown> {
  requireCondition(value !== null && typeof value === "object" && !Array.isArray(value),
    `${label} must be an object`);
  requireCondition(hashCanonical(Object.keys(value).sort()) === hashCanonical([...keys].sort()),
    `${label} has missing or unexpected fields`);
}

function requireSha(value: unknown, label: string): asserts value is string {
  requireCondition(typeof value === "string" && SHA256.test(value), `${label} must be a lowercase sha256`);
}

function writeJson(path: string, value: unknown): void {
  writeFileAtomic(path, `${JSON.stringify(value, null, 2)}\n`);
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function readExactPrettyJson<T>(path: string, label: string): T {
  const bytes = readFileSync(path, "utf8");
  let value: T;
  try {
    value = JSON.parse(bytes) as T;
  } catch (error) {
    throw new ForwardRoleQualificationLiveV3Error(`${label} is not valid JSON: ${(error as Error).message}`);
  }
  requireCondition(bytes === `${JSON.stringify(value, null, 2)}\n`,
    `${label} is not the exact retained production JSON serialization`);
  return value;
}

function readExactProductionJson<T>(path: string, label: string): T {
  const bytes = readFileSync(path, "utf8");
  let value: T;
  try {
    value = JSON.parse(bytes) as T;
  } catch (error) {
    throw new ForwardRoleQualificationLiveV3Error(
      `${label} is not valid JSON: ${(error as Error).message}`,
    );
  }
  // Live call-ledger writes are pretty JSON; campaign-final ledgers and
  // terminal artifacts are canonical JSON. No third serialization is official.
  requireCondition(bytes === `${JSON.stringify(value, null, 2)}\n` || bytes === `${canonicalJson(value)}\n`,
    `${label} is not an exact production serialization`);
  return value;
}

export function liveQualificationExecutionSessionIdV3(request: LiveQualificationExecutionRequestV3): string {
  return `imp24-v3-${sha256Hex(canonicalJson({
    attemptId: request.attemptId,
    requestSha256: request.requestSha256,
  }))}`;
}

function executionSidecarPath(manifestPath: string, suffix: ".route.json" | ".structured.json" | ".result.json"): string {
  return manifestPath.replace(/\.manifest\.json$/, suffix);
}

function executionSidecarBinding(
  phaseDir: string,
  path: string,
  kind: LiveExecutionSidecarKindV3,
): LiveExecutionSidecarBindingV3 | null {
  const logsDir = resolve(phaseDir, "exec", "logs");
  const exactPath = resolve(path);
  const rel = relative(resolve(phaseDir), exactPath).split(sep).join("/");
  if (!exactPath.startsWith(`${logsDir}${sep}`) || !rel.startsWith("exec/logs/") || !existsSync(exactPath)) return null;
  const stat = lstatSync(exactPath);
  if (!stat.isFile() || stat.isSymbolicLink()) return null;
  const bytes = readFileSync(exactPath);
  return {
    kind,
    relPath: rel,
    bytes: bytes.length,
    bytesSha256: sha256Hex(bytes),
  };
}

export function buildLiveAttemptExecutionEvidenceV3(args: {
  phaseDir: string;
  request: LiveQualificationExecutionRequestV3;
  receipt: QualificationExecutionReceiptV3;
  processDiagnosticsSha256: string;
  plannedSessionId: string;
  boundary: CodexRunnerBoundaryV1 | null;
  result: CodexAgentResult | null;
}): LiveAttemptExecutionEvidenceV3 {
  const invocation = args.boundary === null
    ? "NOT_INVOKED_PRE_SPAWN" as const
    : args.result === null
      ? "RUNNER_THREW" as const
      : "RUNNER_RETURNED" as const;
  const manifestPath = args.boundary?.manifestPath ?? null;
  const manifest = manifestPath === null
    ? null
    : executionSidecarBinding(args.phaseDir, manifestPath, "effective-context-manifest");
  const route = manifestPath === null
    ? null
    : executionSidecarBinding(args.phaseDir, executionSidecarPath(manifestPath, ".route.json"), "route");
  const structured = manifestPath === null
    ? null
    : executionSidecarBinding(args.phaseDir, executionSidecarPath(manifestPath, ".structured.json"), "structured-output");
  const resultSidecar = manifestPath === null
    ? null
    : executionSidecarBinding(args.phaseDir, executionSidecarPath(manifestPath, ".result.json"), "exec-result");
  const requiredKinds: LiveExecutionSidecarKindV3[] = invocation === "RUNNER_RETURNED"
    ? ["effective-context-manifest", "route", "structured-output", "exec-result"]
    : invocation === "RUNNER_THREW"
      ? ["effective-context-manifest", "route"]
      : [];
  const byKind = new Map<LiveExecutionSidecarKindV3, LiveExecutionSidecarBindingV3 | null>([
    ["effective-context-manifest", manifest],
    ["route", route],
    ["structured-output", structured],
    ["exec-result", resultSidecar],
  ]);
  const missingRequiredSidecars = requiredKinds.filter((kind) => byKind.get(kind) === null);

  const logsDir = resolve(args.phaseDir, "exec", "logs");
  const expectedPaths = new Set(
    [...byKind.values()].filter((value): value is LiveExecutionSidecarBindingV3 => value !== null)
      .map((value) => value.relPath),
  );
  const sessionManifestSuffix = `-${args.plannedSessionId}.manifest.json`;
  const familyNames = existsSync(logsDir)
    ? readdirSync(logsDir).filter((name) => name.endsWith(sessionManifestSuffix))
      .flatMap((name) => {
        const base = name.slice(0, -".manifest.json".length);
        return readdirSync(logsDir).filter((candidate) => candidate.startsWith(`${base}.`));
      })
    : [];
  const unexpectedSidecarRelPaths = [...new Set(familyNames
    .map((name) => `exec/logs/${name}`)
    .filter((relPath) => !expectedPaths.has(relPath)))]
    .sort();
  if (invocation === "RUNNER_THREW") {
    // A runner rejection has no ExecResult/final structured result. Any such
    // file would be an unbound sibling, not evidence for the thrown process.
    for (const binding of [structured, resultSidecar]) {
      if (binding && !unexpectedSidecarRelPaths.includes(binding.relPath)) unexpectedSidecarRelPaths.push(binding.relPath);
    }
    unexpectedSidecarRelPaths.sort();
  }
  if (invocation === "NOT_INVOKED_PRE_SPAWN") {
    for (const binding of [manifest, route, structured, resultSidecar]) {
      if (binding && !unexpectedSidecarRelPaths.includes(binding.relPath)) unexpectedSidecarRelPaths.push(binding.relPath);
    }
    unexpectedSidecarRelPaths.sort();
  }

  const rawFinalOutput = args.result === null ? null : args.result.finalMessage;
  const finalMessageSource = args.result?.finalMessageSource ?? null;
  const responseProduced = args.result !== null;
  const boundaryComplete = invocation === "NOT_INVOKED_PRE_SPAWN"
    ? args.boundary === null
    : args.boundary?.sessionId === args.plannedSessionId
      && args.boundary.manifestPath !== null
      && args.boundary.schemaBound === true
      && args.boundary.outputSchemaSha256 === args.request.schemaSha256;
  const responseBindingComplete = args.result === null
    ? args.receipt.rawOutput === null
    : args.receipt.rawOutput === rawFinalOutput;
  const core: Omit<LiveAttemptExecutionEvidenceV3, "executionEvidenceSha256"> = {
    schema: IMP24_LIVE_EXECUTION_EVIDENCE_SCHEMA,
    attemptId: args.request.attemptId,
    requestSha256: args.request.requestSha256,
    receiptSha256: args.receipt.receiptSha256,
    processDiagnosticsSha256: args.processDiagnosticsSha256,
    invocation,
    evidenceComplete: missingRequiredSidecars.length === 0
      && unexpectedSidecarRelPaths.length === 0
      && boundaryComplete
      && responseBindingComplete,
    sessionId: args.boundary?.sessionId ?? null,
    schemaRequested: true,
    schemaBoundAtRunner: args.boundary?.schemaBound ?? false,
    finalMessageSource,
    responseProduced,
    rawFinalOutputSha256: rawFinalOutput === null ? null : sha256Hex(rawFinalOutput),
    rawFinalOutputBytes: rawFinalOutput === null ? null : Buffer.byteLength(rawFinalOutput),
    effectiveContextManifest: manifest,
    routeSidecar: route,
    structuredOutputSidecar: structured,
    resultSidecar,
    missingRequiredSidecars,
    unexpectedSidecarRelPaths,
  };
  return { ...core, executionEvidenceSha256: hashCanonical(core) };
}

function readExecutionSidecar<T>(
  phaseDir: string,
  binding: LiveExecutionSidecarBindingV3,
  expectedKind: LiveExecutionSidecarKindV3,
  label: string,
): T {
  requireCondition(binding.kind === expectedKind, `${label} sidecar kind mismatch`);
  requireSha(binding.bytesSha256, `${label} sidecar bytes hash`);
  requireCondition(binding.relPath.startsWith("exec/logs/") && !binding.relPath.includes(".."),
    `${label} sidecar path is outside live/exec/logs`);
  const path = resolve(phaseDir, binding.relPath);
  const logsDir = resolve(phaseDir, "exec", "logs");
  requireCondition(path.startsWith(`${logsDir}${sep}`), `${label} sidecar path escapes live/exec/logs`);
  const stat = lstatSync(path);
  requireCondition(stat.isFile() && !stat.isSymbolicLink(), `${label} sidecar must be a regular non-symlink file`);
  const bytes = readFileSync(path);
  requireCondition(bytes.length === binding.bytes && sha256Hex(bytes) === binding.bytesSha256,
    `${label} exact sidecar bytes drift`);
  return readExactPrettyJson<T>(path, label);
}

function allowedRouteOutcomes(status: QualificationReceiptStatusV3): ReadonlySet<RouteResultV1["outcome"]> {
  if (status === "completed") return new Set(["content_completed"]);
  if (status === "timeout") return new Set(["timeout"]);
  if (status === "provider_capacity") return new Set(["provider_rate_or_capacity"]);
  if (status === "refusal") return new Set(["provider_safeguard_or_refusal"]);
  if (status === "transient_execution_failure") return new Set(["infrastructure_failure"]);
  if (status === "invalid_output") return new Set(["content_completed", "content_invalid"]);
  return new Set(["content_completed", "content_invalid", "infrastructure_failure", "policy_preflight_failure"]);
}

/** Model-free proof that the retained exec root contains only non-secret
 * qualification cache metadata and the exact bound log sidecars. Isolated
 * CODEX_HOME/session material is ephemeral and must never survive here. */
export function validateLiveExecEvidenceRootV3(
  phaseDir: string,
  referencedExecLogRelPaths: ReadonlySet<string>,
): void {
  const execDir = resolve(phaseDir, "exec");
  if (!existsSync(execDir)) {
    requireCondition(referencedExecLogRelPaths.size === 0,
      "live V3 execution evidence references logs but live/exec is absent");
    return;
  }
  const execStat = lstatSync(execDir);
  requireCondition(execStat.isDirectory() && !execStat.isSymbolicLink(),
    "live V3 exec root must be a regular non-symlink directory");
  const children = readdirSync(execDir).sort();
  const allowedChildren = new Set(["logs", "cli-qualification-cache", "sessions"]);
  requireCondition(children.every((name) => allowedChildren.has(name)),
    `live V3 exec root contains unexpected child: ${children.filter((name) => !allowedChildren.has(name)).join(", ")}`);

  const inspectNoSecretState = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const lower = name.toLowerCase();
      requireCondition(lower !== "auth.json"
          && lower !== "codex-home"
          && !lower.includes("token")
          && !/\.(?:sqlite3?|db)$/.test(lower),
      `live V3 exec root retains prohibited auth/session material: ${name}`);
      const path = resolve(dir, name);
      const stat = lstatSync(path);
      requireCondition(!stat.isSymbolicLink(), `live V3 exec root contains symlink ${name}`);
      if (stat.isDirectory()) inspectNoSecretState(path);
    }
  };
  inspectNoSecretState(execDir);

  const sessionsDir = resolve(execDir, "sessions");
  if (existsSync(sessionsDir)) {
    const sessionsStat = lstatSync(sessionsDir);
    requireCondition(sessionsStat.isDirectory() && !sessionsStat.isSymbolicLink()
        && readdirSync(sessionsDir).length === 0,
    "live V3 exec/sessions must be absent or empty after every retained attempt");
  }
  const cacheDir = resolve(execDir, "cli-qualification-cache");
  if (existsSync(cacheDir)) {
    const cacheStat = lstatSync(cacheDir);
    requireCondition(cacheStat.isDirectory() && !cacheStat.isSymbolicLink(),
      "live V3 CLI qualification cache must be a regular non-symlink directory");
    const cacheNames = readdirSync(cacheDir).sort();
    requireCondition(cacheNames.length <= 1 && cacheNames.every((name) => name === "cli-qualification.json"),
      "live V3 CLI qualification cache contains unexpected files");
    for (const name of cacheNames) {
      const stat = lstatSync(resolve(cacheDir, name));
      requireCondition(stat.isFile() && !stat.isSymbolicLink(),
        "live V3 CLI qualification cache entry must be a regular non-symlink file");
    }
  }

  const logsDir = resolve(execDir, "logs");
  const retainedLogRelPaths = existsSync(logsDir)
    ? readdirSync(logsDir).sort().map((name) => `exec/logs/${name}`)
    : [];
  if (existsSync(logsDir)) {
    const logsStat = lstatSync(logsDir);
    requireCondition(logsStat.isDirectory() && !logsStat.isSymbolicLink(),
      "live V3 exec/logs must be a regular non-symlink directory");
    for (const relPath of retainedLogRelPaths) {
      const stat = lstatSync(resolve(phaseDir, relPath));
      requireCondition(stat.isFile() && !stat.isSymbolicLink(),
        `live V3 retained ${relPath} must be a regular non-symlink file`);
    }
  }
  requireCondition(hashCanonical(retainedLogRelPaths)
      === hashCanonical([...referencedExecLogRelPaths].sort()),
  "live V3 exec/log bytes are not in exact bijection with per-attempt execution evidence");
}

export function validateExecutionEvidenceArtifact(args: {
  phaseDir: string;
  request: LiveQualificationExecutionRequestV3;
  receipt: QualificationExecutionReceiptV3;
  processDiagnostics: CodexProcessDiagnosticsV1;
  artifact: LiveAttemptExecutionEvidenceV3;
  /** Required on the official live/resume/post-live paths. Unit-level injected
   * executor seams may omit it because they never authorize a real CLI. */
  preflight?: LiveQualificationPreflightV3;
}): void {
  requireExactObjectKeys(args.artifact, [
    "schema", "attemptId", "requestSha256", "receiptSha256", "processDiagnosticsSha256", "invocation", "evidenceComplete",
    "sessionId", "schemaRequested", "schemaBoundAtRunner", "finalMessageSource", "responseProduced",
    "rawFinalOutputSha256", "rawFinalOutputBytes", "effectiveContextManifest", "routeSidecar",
    "structuredOutputSidecar", "resultSidecar", "missingRequiredSidecars", "unexpectedSidecarRelPaths",
    "executionEvidenceSha256",
  ], `${args.request.attemptId} execution evidence`);
  for (const binding of [
    args.artifact.effectiveContextManifest,
    args.artifact.routeSidecar,
    args.artifact.structuredOutputSidecar,
    args.artifact.resultSidecar,
  ]) {
    if (binding !== null) {
      requireExactObjectKeys(binding, ["kind", "relPath", "bytes", "bytesSha256"],
        `${args.request.attemptId} execution sidecar binding`);
    }
  }
  if (args.preflight !== undefined) {
    validateLiveQualificationPreflightArtifactV3(args.preflight, args.request.experimentId);
    requireCondition(args.preflight.freezeSha256 === args.request.freezeSha256
        && args.preflight.certificationSha256 === args.request.certificationSha256
        && args.preflight.productionInstrumentSealSha256 === args.request.productionInstrumentSealSha256,
    `${args.request.attemptId}: retained preflight belongs to different frozen request inputs`);
  }
  const { executionEvidenceSha256, ...core } = args.artifact;
  requireSha(executionEvidenceSha256, `${args.request.attemptId} execution evidence hash`);
  requireSha(args.artifact.processDiagnosticsSha256,
    `${args.request.attemptId} process diagnostics hash in execution evidence`);
  requireCondition(executionEvidenceSha256 === hashCanonical(core),
    `${args.request.attemptId}: execution evidence self hash drift`);
  requireCondition(args.artifact.schema === IMP24_LIVE_EXECUTION_EVIDENCE_SCHEMA
      && args.artifact.attemptId === args.request.attemptId
      && args.artifact.requestSha256 === args.request.requestSha256
      && args.artifact.receiptSha256 === args.receipt.receiptSha256
      && args.artifact.processDiagnosticsSha256 === args.processDiagnostics.diagnosticsSha256
      && args.artifact.schemaRequested === true,
  `${args.request.attemptId}: execution evidence identity/request/receipt binding drift`);
  validateCodexProcessDiagnosticsV1(args.processDiagnostics, {
    attemptId: args.request.attemptId,
    requestSha256: args.request.requestSha256,
    sessionId: args.artifact.sessionId,
    invocation: args.artifact.invocation === "NOT_INVOKED_PRE_SPAWN"
      ? "NOT_INVOKED"
      : args.artifact.invocation === "RUNNER_THREW"
        ? "RUNNER_THROWN"
        : "RUNNER_RETURNED",
    classification: args.receipt.status,
  });
  requireCondition(args.artifact.evidenceComplete === true
      && args.artifact.missingRequiredSidecars.length === 0
      && args.artifact.unexpectedSidecarRelPaths.length === 0,
  `${args.request.attemptId}: retained execution sidecar evidence is incomplete or extra`);

  const rawOutput = args.receipt.rawOutput;
  requireCondition(args.artifact.invocation === "RUNNER_RETURNED"
    ? typeof rawOutput === "string"
      && args.artifact.responseProduced === true
      && (args.artifact.finalMessageSource === "output-file" || args.artifact.finalMessageSource === "stdout-fallback")
      && args.artifact.rawFinalOutputSha256 === sha256Hex(rawOutput)
      && args.artifact.rawFinalOutputBytes === Buffer.byteLength(rawOutput)
    : rawOutput === null
      && args.artifact.rawFinalOutputSha256 === null
      && args.artifact.rawFinalOutputBytes === null
      && args.artifact.responseProduced === false
      && args.artifact.finalMessageSource === null,
  `${args.request.attemptId}: response-produced/raw-output binding drift`);

  if (args.artifact.invocation === "NOT_INVOKED_PRE_SPAWN") {
    requireCondition(args.artifact.sessionId === null
        && args.artifact.responseProduced === false
        && args.artifact.finalMessageSource === null
        && args.artifact.schemaBoundAtRunner === false
        && args.artifact.effectiveContextManifest === null
        && args.artifact.routeSidecar === null
        && args.artifact.structuredOutputSidecar === null
        && args.artifact.resultSidecar === null
        && args.receipt.executionId === `preflight-${args.request.attemptId}`,
    `${args.request.attemptId}: non-invoked pre-spawn execution evidence is inconsistent`);
    return;
  }

  requireCondition(args.artifact.sessionId === liveQualificationExecutionSessionIdV3(args.request)
      && args.artifact.schemaBoundAtRunner === true
      && args.receipt.executionId === args.artifact.sessionId,
  `${args.request.attemptId}: spawn-bound evidence lost its deterministic real execution identity`);
  requireCondition(args.artifact.effectiveContextManifest !== null && args.artifact.routeSidecar !== null,
    `${args.request.attemptId}: spawn-bound manifest/route sidecars are missing`);
  const manifestRelPath = args.artifact.effectiveContextManifest.relPath;
  requireCondition(manifestRelPath.endsWith(`-${args.artifact.sessionId}.manifest.json`)
      && args.artifact.routeSidecar.relPath === manifestRelPath.replace(/\.manifest\.json$/, ".route.json"),
  `${args.request.attemptId}: manifest/route are not exact sibling sidecars for the real session`);
  const manifest = readExecutionSidecar<EffectiveContextManifestV1>(args.phaseDir,
    args.artifact.effectiveContextManifest, "effective-context-manifest", `${args.request.attemptId} effective-context manifest`);
  const manifestValidationErrors = validateEffectiveContextManifest(manifest);
  requireCondition(manifestValidationErrors.length === 0,
    `${args.request.attemptId}: effective-context manifest contract errors: ${manifestValidationErrors.join("; ")}`);
  const { profile, profileHash } = resolveExecutionProfile("chapter-reviewer");
  const schemaPath = resolve(IMP24_V2_REVIEWER_SCHEMA_MAP[args.request.role]);
  const sessionsDir = resolve(args.phaseDir, "exec", "sessions");
  const retainedCodexHome = resolve(manifest.codexHome.dir);
  const retainedSessionDir = dirname(retainedCodexHome);
  const lastMessagePath = resolve(retainedSessionDir, "last-message.txt");
  const expectedArgv = [
    "exec", "--sandbox", "read-only", "--skip-git-repo-check",
    "--ignore-user-config", "--ignore-rules", "-c", "project_doc_max_bytes=0",
    "-c", `model=${args.request.model}`,
    "-c", `model_reasoning_effort=${args.request.effort}`,
    "--output-schema", schemaPath,
    "--output-last-message", lastMessagePath,
    `<task-sha256:${sha256Hex(args.request.task)}>`,
  ];
  const forcedEnvKeys = [
    "CODEX_HOME",
    "CHAPTERFLOW_SESSION_ID",
    ...Object.keys(STRICT_PIPELINE_ENV),
  ];
  const allowedEnvKeys = new Set([...profile.envAllowlist, ...forcedEnvKeys]);
  const sortedEnvKeys = [...manifest.envKeys].sort();
  const exactWorkspaceFile = {
    relPath: `evidence/${args.request.caseId}.review-evidence-envelope-v1.json`,
    sha256: args.request.evidenceEnvelopeBytesSha256,
    bytes: Buffer.byteLength(args.request.evidenceEnvelopeBytes),
  };
  const instructionSourcesValid = manifest.instructionSources.every((source) =>
    typeof source.path === "string" && source.path.length > 0
      && SHA256.test(source.sha256)
      && Number.isSafeInteger(source.bytes) && source.bytes >= 0
      && source.neutralized === true);
  requireCondition(manifest.schema === "effective-context-manifest-v1"
      && manifest.manifestVersion === 1
      && manifest.sessionId === args.artifact.sessionId
      && manifest.role === "chapter-reviewer"
      && manifest.model === args.request.model
      && manifest.reasoningEffort === args.request.effort
      && manifest.profileHash === profileHash
      && manifest.sandbox === "read-only"
      && manifest.cwdPolicy === "isolated-workspace"
      && typeof manifest.cwd === "string" && resolve(manifest.cwd) === manifest.cwd
      && manifest.taskSha256 === sha256Hex(args.request.task)
      && manifest.taskBytes === Buffer.byteLength(args.request.task)
      && typeof manifest.bin?.path === "string" && manifest.bin.path.length > 0
      && typeof manifest.bin?.version === "string" && manifest.bin.version.length > 0
      && manifest.qualification.cliVersion === manifest.bin.version
      && (args.preflight === undefined
        || manifest.bin.path === args.preflight.cliBinary
          && manifest.bin.version === args.preflight.cliVersion
          && manifest.qualification.cliVersion === args.preflight.cliVersion)
      && manifest.qualification.synthetic === false
      && hashCanonical(manifest.qualification.flagsRequired) === hashCanonical(profile.requiredCliFlags)
      && hashCanonical(manifest.argv) === hashCanonical(expectedArgv)
      && hashCanonical(manifest.strictEnv) === hashCanonical(STRICT_PIPELINE_ENV)
      && manifest.callerEnvKeys.length === 0
      && hashCanonical(manifest.envKeys) === hashCanonical(sortedEnvKeys)
      && new Set(manifest.envKeys).size === manifest.envKeys.length
      && forcedEnvKeys.every((key) => manifest.envKeys.includes(key))
      && manifest.envKeys.every((key) => allowedEnvKeys.has(key))
      && FORBIDDEN_PROVIDER_ENV.every((key) => !manifest.envKeys.includes(key))
      && manifest.codexHome.authMaterial === "auth.json"
      && typeof manifest.codexHome.authSourcePath === "string"
      && basename(manifest.codexHome.authSourcePath) === "auth.json"
      && retainedSessionDir.startsWith(`${sessionsDir}${sep}`)
      && basename(retainedSessionDir).startsWith("cf-exec-session-")
      && basename(retainedCodexHome) === "codex-home"
      && !existsSync(retainedSessionDir)
      && !existsSync(manifest.cwd)
      && instructionSourcesValid
      && manifest.workspace !== undefined
      && manifest.workspace.dir === manifest.cwd
      && manifest.workspace.files.length === 1
      && hashCanonical(manifest.workspace.files[0]) === hashCanonical(exactWorkspaceFile)
      && Number.isSafeInteger(manifest.timeoutMs) && manifest.timeoutMs > 0
      && Number.isFinite(Date.parse(manifest.createdAtIso)),
  `${args.request.attemptId}: effective-context manifest semantic binding drift`);

  const route = readExecutionSidecar<RouteResultV1>(args.phaseDir,
    args.artifact.routeSidecar, "route", `${args.request.attemptId} route`);
  const routeValidationErrors = validateRouteResult(route);
  const expectedRoute = resolveRoute({
    role: "chapter-reviewer",
    requestedModel: args.request.model,
    requestedEffort: args.request.effort,
  });
  const expectedDriftFingerprint = routeDriftFingerprint({
    model: expectedRoute.model,
    effort: expectedRoute.effort,
    taskClass: expectedRoute.taskClass,
    routePolicyVersion: expectedRoute.routePolicyVersion,
    executionProfileHash: profileHash,
    cliVersion: manifest.qualification.cliVersion,
  });
  requireCondition(routeValidationErrors.length === 0
      && route.schema === "route-result-v1"
      && route.taskClass === expectedRoute.taskClass
      && route.profileName === expectedRoute.profileName
      && route.executionRoute === "codex_exec_chatgpt_subscription"
      && route.authMode === "chatgpt"
      && route.apiKeyPresent === false
      && route.apiFallbackAllowed === false
      && route.requestedModel === expectedRoute.model
      && route.requestedEffort === expectedRoute.effort
      && route.aliasOrSnapshot === expectedRoute.model
      && route.executionProfileHash === profileHash
      && route.routePolicyVersion === expectedRoute.routePolicyVersion
      && route.cliVersion === manifest.qualification.cliVersion
      && (args.preflight === undefined || route.cliVersion === args.preflight.cliVersion)
      && route.driftFingerprint === expectedDriftFingerprint
      && allowedRouteOutcomes(args.receipt.status).has(route.outcome),
  `${args.request.attemptId}: route sidecar semantic/outcome binding drift`);
  if (args.receipt.status === "refusal") {
    requireCondition(typeof rawOutput === "string"
        && explicitRefusalSignal({
          finalMessage: rawOutput,
          transport: args.receipt.failureDetail ?? "",
        }) !== null,
    `${args.request.attemptId}: refusal receipt lacks exact refusal evidence`);
  }

  if (args.artifact.invocation === "RUNNER_THREW") {
    requireCondition(args.artifact.responseProduced === false
        && args.artifact.finalMessageSource === null
        && args.artifact.structuredOutputSidecar === null
        && args.artifact.resultSidecar === null,
    `${args.request.attemptId}: thrown runner falsely retains returned-result sidecars`);
    return;
  }

  requireCondition(args.artifact.structuredOutputSidecar !== null
      && args.artifact.resultSidecar !== null
      && typeof rawOutput === "string",
  `${args.request.attemptId}: returned runner lacks response/result sidecars`);
  requireCondition(args.artifact.structuredOutputSidecar.relPath
      === manifestRelPath.replace(/\.manifest\.json$/, ".structured.json")
      && args.artifact.resultSidecar.relPath
      === manifestRelPath.replace(/\.manifest\.json$/, ".result.json"),
  `${args.request.attemptId}: structured/result evidence is not the exact manifest sibling family`);
  const structured = readExecutionSidecar<StructuredOutputSidecarV1>(args.phaseDir,
    args.artifact.structuredOutputSidecar, "structured-output", `${args.request.attemptId} structured output`);
  let parsedOk = false;
  try { JSON.parse(rawOutput); parsedOk = true; } catch { /* exact parse result is retained below */ }
  requireCondition(structured.schema === "structured-output-sidecar-v1"
      && structured.sessionId === args.artifact.sessionId
      && structured.outputSchemaPath === schemaPath
      && structured.outputSchemaSha256 === args.request.schemaSha256
      && structured.rawFinalMessageSha256 === sha256Hex(rawOutput)
      && structured.rawFinalMessageBytes === Buffer.byteLength(rawOutput)
      && structured.parsedOk === parsedOk
      && (parsedOk
        ? structured.parseError === undefined
        : typeof structured.parseError === "string" && structured.parseError.length > 0),
  `${args.request.attemptId}: structured-output sidecar semantic/raw binding drift`);
  const result = readExecutionSidecar<ExecResultV1>(args.phaseDir,
    args.artifact.resultSidecar, "exec-result", `${args.request.attemptId} exec result`);
  requireCondition(result.schema === "exec-result-v1"
      && result.sessionId === args.artifact.sessionId
      && result.finalMessageSource === args.artifact.finalMessageSource
      && result.finalMessageSha256 === sha256Hex(rawOutput)
      && Number.isSafeInteger(result.exitCode)
      && result.ok === (result.exitCode === 0)
      && Number.isSafeInteger(result.durationMs) && result.durationMs >= 0
      && SHA256.test(result.stdoutSha256)
      && Number.isSafeInteger(result.stdoutBytes) && result.stdoutBytes >= 0
      && SHA256.test(result.stderrSha256)
      && Number.isSafeInteger(result.stderrBytes) && result.stderrBytes >= 0
      && Number.isFinite(Date.parse(result.endedAtIso)),
  `${args.request.attemptId}: exec-result sidecar semantic/raw/exit binding drift`);
  requireCondition(args.processDiagnostics.exitCode === result.exitCode
      && args.processDiagnostics.stdoutSha256 === result.stdoutSha256
      && args.processDiagnostics.stdoutBytes === result.stdoutBytes
      && args.processDiagnostics.stderrSha256 === result.stderrSha256
      && args.processDiagnostics.stderrBytes === result.stderrBytes,
  `${args.request.attemptId}: process diagnostics differs from the exact exec-result sidecar`);
  if (args.receipt.status === "completed" || args.receipt.status === "invalid_output") {
    requireCondition(result.exitCode === 0 && result.finalMessageSource === "output-file",
      `${args.request.attemptId}: content/reviewer outcome lacks an exit-zero authoritative output file`);
  } else if (args.receipt.status === "provider_capacity" || args.receipt.status === "transient_execution_failure") {
    requireCondition(result.exitCode !== 0 && result.finalMessageSource === "stdout-fallback",
      `${args.request.attemptId}: replayable execution failure must be nonzero diagnostic stdout fallback`);
  } else if (args.receipt.status === "refusal") {
    requireCondition(result.finalMessageSource === "output-file" || result.exitCode !== 0,
      `${args.request.attemptId}: refusal fallback is permitted only for a nonzero provider refusal`);
  } else {
    requireCondition(args.receipt.status === "integrity_failure",
      `${args.request.attemptId}: returned runner has an impossible terminal receipt status`);
  }
}

function workspaceRole(role: Imp24ReviewRole): ForwardReviewerWorkspaceRole {
  if (role === "reader") return "direct-reader";
  if (role === "source") return "source-verifier";
  return "quiz-adjudication";
}

function validateAvailabilityPolicy(policy: CandidateAvailabilityPolicyV3): void {
  requireCondition(policy?.schema === IMP24_CANDIDATE_AVAILABILITY_POLICY_SCHEMA, "v3 availability policy schema mismatch");
  requireCondition(policy.source === "codex-local-models-cache" && policy.sourceFile === "models_cache.json", "v3 availability source drift");
  requireCondition(Number.isSafeInteger(policy.maximumCacheAgeSeconds) && policy.maximumCacheAgeSeconds > 0, "v3 availability max age is invalid");
  requireCondition(Number.isSafeInteger(policy.maximumFutureSkewSeconds) && policy.maximumFutureSkewSeconds >= 0, "v3 availability future skew is invalid");
  requireCondition(policy.requiredVisibility === "list" && policy.requireExactModelSlug === true
    && policy.requireReasoningEffortSupport === true && policy.skipUnavailableWithoutReordering === true
    && policy.candidateReorderingAllowed === false,
  "v3 availability policy weakens exact order/visibility/effort requirements");
  requireCondition(policy.networkCalls === 0 && policy.modelCalls === 0 && policy.apiCalls === 0,
    "candidate discovery must remain zero-network/model/API");
  const { policySha256, ...core } = policy;
  requireSha(policySha256, "v3 availability policy self hash");
  requireCondition(candidateAvailabilityPolicySha256(core) === policySha256, "v3 availability policy self hash drift");
  requireCondition(hashCanonical(policy) === hashCanonical(IMP24_FROZEN_CANDIDATE_AVAILABILITY_POLICY),
    "v3 availability policy differs from the exact frozen policy");
}

/** Pure filesystem discovery from the local Codex models cache. */
export function discoverCandidateAvailabilityV3(args: {
  policy: CandidateAvailabilityPolicyV3;
  policyBytesSha256: string;
  modelsCachePath: string;
  verifiedAt: string;
}): CandidateAvailabilityV3 {
  validateAvailabilityPolicy(args.policy);
  requireSha(args.policyBytesSha256, "candidate availability policy bytes hash");
  requireCondition(args.policyBytesSha256 === IMP24_CANDIDATE_AVAILABILITY_POLICY_BYTES_SHA256,
    "candidate availability policy bytes hash differs from exact canonical frozen policy bytes");
  requireCondition(existsSync(args.modelsCachePath), `candidate availability cache is missing: ${basename(args.modelsCachePath)}`);
  const sourceBytes = readFileSync(args.modelsCachePath);
  let cache: LocalModelsCacheV3;
  try { cache = JSON.parse(sourceBytes.toString("utf8")) as LocalModelsCacheV3; }
  catch (error) { throw new ForwardRoleQualificationLiveV3Error(`candidate availability cache is not JSON: ${(error as Error).message}`); }
  requireCondition(Array.isArray(cache.models), "candidate availability cache has no model inventory");
  const fetchedMs = Date.parse(cache.fetched_at);
  const verifiedMs = Date.parse(args.verifiedAt);
  requireCondition(Number.isFinite(fetchedMs) && Number.isFinite(verifiedMs), "candidate availability timestamps are invalid");
  const ageSeconds = (verifiedMs - fetchedMs) / 1_000;
  requireCondition(ageSeconds <= args.policy.maximumCacheAgeSeconds, `candidate availability cache is stale (${Math.floor(ageSeconds)}s old)`);
  requireCondition(ageSeconds >= -args.policy.maximumFutureSkewSeconds, `candidate availability cache is ${Math.ceil(-ageSeconds)}s in the future`);

  const bySlug = new Map<string, LocalModelsCacheV3["models"]>();
  for (const model of cache.models) {
    requireCondition(typeof model?.slug === "string" && model.slug.length > 0, "candidate cache contains a model without a slug");
    const matches = bySlug.get(model.slug) ?? [];
    matches.push(model);
    bySlug.set(model.slug, matches);
  }
  const entries = ROLES.flatMap((role) => IMP24_ROLE_CANDIDATE_ORDER[role].map((candidate, ordinal) => {
    const matches = bySlug.get(candidate.model) ?? [];
    requireCondition(matches.length <= 1, `candidate cache has duplicate exact slug ${candidate.model}`);
    const model = matches[0];
    const modelListed = model !== undefined;
    const visible = model?.visibility === args.policy.requiredVisibility;
    const effortSupported = model?.supported_reasoning_levels?.some((level) => level.effort === candidate.effort) === true;
    const status = modelListed && visible && effortSupported ? "AVAILABLE" as const : "UNAVAILABLE" as const;
    const reason = !modelListed
      ? "exact model slug absent from local Codex cache"
      : !visible
        ? `model visibility ${String(model.visibility ?? "missing")} is not list`
        : !effortSupported
          ? `reasoning effort ${candidate.effort} is not advertised`
          : "exact visible model and effort are advertised by local Codex cache";
    return { role, ordinal, ...candidate, status, modelListed, visible, effortSupported, reason };
  }));
  const draft: Omit<CandidateAvailabilityV3, "availabilitySha256"> = {
    schema: IMP24_ROLE_QUALIFICATION_AVAILABILITY_SCHEMA,
    experimentId: IMP24_ROLE_QUALIFICATION_EXECUTION_ID,
    source: "codex-local-models-cache",
    sourceBytesSha256: sha256Hex(sourceBytes),
    sourceFetchedAt: new Date(fetchedMs).toISOString(),
    policyBytesSha256: args.policyBytesSha256,
    candidateOrderSha256: hashCanonical(IMP24_ROLE_CANDIDATE_ORDER),
    entries,
  };
  return Object.freeze({ ...draft, availabilitySha256: candidateAvailabilitySha256(draft) });
}

export type LivePreflightDepsV3 = {
  repositoryRoot: string;
  executionId?: Imp24LiveExecutionIdentityV3;
  authJsonPath?: string;
  codexBinary?: string;
  qualificationCacheDir?: string;
  env?: NodeJS.ProcessEnv;
  verifiedAt?: string;
  cliQualifier?: (args: { bin: string; cacheDir?: string }) => Promise<CodexCliQualificationV1>;
  /** Test-only: retained in the preflight as synthetic and never accepted by a
   * production caller accidentally. */
  allowSyntheticCliForTests?: boolean;
};

export type UnpreparedLiveRoleQualificationInputV3 = Omit<
  RunRoleQualificationInputV3,
  "schemaHashes" | "promptSourceHashes" | "preparedCases"
>;

/**
 * Bind the live runner to the exact model-free-certified compiler and frozen
 * gold evaluator. The deterministic fixture-output lookup stays private to
 * certification/tests and is never returned to the live execution path.
 */
export function prepareLiveRoleQualificationV3(args: {
  repositoryRoot: string;
  input: UnpreparedLiveRoleQualificationInputV3;
}): { input: RunRoleQualificationInputV3; evaluateOutput: QualificationOutputEvaluatorV3 } {
  const prepared = prepareImp24QualificationCases({
    repositoryRoot: resolve(args.repositoryRoot),
    corpusBundle: args.input.corpusBundle,
  });
  const { evaluateOutput } = createImp24QualificationEvaluator(args.input.corpusBundle);
  const input: RunRoleQualificationInputV3 = {
    ...args.input,
    schemaHashes: prepared.schemaHashes,
    promptSourceHashes: prepared.promptSourceHashes,
    preparedCases: prepared.preparedCases,
  };
  // Validate every certification/seal/corpus/envelope/freeze invariant before
  // returning anything that can be paired with the live executor.
  buildRoleQualificationPlanV3(input);
  return { input, evaluateOutput };
}

export async function preflightLiveRoleQualificationV3(
  input: RunRoleQualificationInputV3,
  deps: LivePreflightDepsV3,
): Promise<LiveQualificationPreflightV3> {
  const { freeze } = buildRoleQualificationPlanV3(input);
  const executionId = deps.executionId ?? IMP24_ROLE_QUALIFICATION_EXECUTION_ID;
  requireImp24LiveExecutionIdentityV3(executionId);
  const verifiedAt = deps.verifiedAt ?? new Date().toISOString();
  requireCondition(Number.isFinite(Date.parse(verifiedAt)), "live v3 preflight timestamp is invalid");
  const currentSeal = validateForwardProductionInstrumentSeal(input.productionInstrumentSeal, {
    repositoryRoot: resolve(deps.repositoryRoot),
  });
  requireCondition(currentSeal.sealSha256 === freeze.productionInstrumentSealSha256,
    "retained production seal differs from frozen v3 qualification input");

  const parentEnv = deps.env ?? process.env;
  const forbiddenProviderEnvKeysPresent = FORBIDDEN_PROVIDER_ENV.filter((key) => {
    const value = parentEnv[key];
    return typeof value === "string" && value.length > 0;
  });
  requireCondition(forbiddenProviderEnvKeysPresent.length === 0,
    `live v3 parent process carries prohibited provider env key(s): ${forbiddenProviderEnvKeysPresent.join(", ")}`);
  const authPath = deps.authJsonPath ?? resolve(parentEnv.CODEX_HOME ?? resolve(homedir(), ".codex"), "auth.json");
  const auth = assertChatgptSubscriptionAuth(authPath);
  const bin = deps.codexBinary ?? findCodexBinary();
  const cli = await (deps.cliQualifier ?? ((args) => qualifyCodexCli(args)))({
    bin,
    ...(deps.qualificationCacheDir ? { cacheDir: deps.qualificationCacheDir } : {}),
  });
  assertFlagsSupported(cli, ["--sandbox", "--skip-git-repo-check", "-c", "--ignore-user-config", "--ignore-rules", "--output-last-message", "--output-schema"]);
  requireCondition(!cli.synthetic || deps.allowSyntheticCliForTests === true,
    "synthetic CLI qualification cannot authorize production live calls");
  const executionProfile = resolveExecutionProfile("chapter-reviewer");
  requireCondition(executionProfile.profile.workingDir === "isolated-workspace"
    && executionProfile.profile.codexHome === "isolated-auth-only"
    && executionProfile.profile.allowedSandboxes.length === 1
    && executionProfile.profile.allowedSandboxes[0] === "read-only",
  "chapter-reviewer execution profile is not hermetic read-only isolation");

  const draft: Omit<LiveQualificationPreflightV3, "preflightSha256"> = {
    schema: IMP24_LIVE_PREFLIGHT_SCHEMA,
    experimentId: executionId,
    verifiedAt: new Date(verifiedAt).toISOString(),
    freezeSha256: freeze.freezeSha256,
    certificationSha256: freeze.certificationSha256,
    productionInstrumentSealSha256: freeze.productionInstrumentSealSha256,
    corpusBundleSha256: freeze.corpusBundleSha256,
    candidateAvailabilitySha256: input.candidateAvailability.availabilitySha256,
    candidateAvailabilitySourceBytesSha256: input.candidateAvailability.sourceBytesSha256,
    cliVersion: cli.version,
    // Retain the exact executable identity used by qualification. Attempt
    // manifests must equal this value, not merely share a basename.
    cliBinary: cli.binPath || bin,
    cliSynthetic: cli.synthetic,
    executionProfileHash: executionProfile.profileHash,
    routePolicyVersion: ROUTE_POLICY_VERSION,
    executionRoute: "codex_exec_chatgpt_subscription",
    authMode: auth.authMode,
    apiKeyPresent: auth.apiKeyPresent,
    apiFallbackAllowed: false,
    directHttpOrSdkAllowed: false,
    forbiddenProviderEnvKeysPresent: [],
    baseMaximumCalls: IMP24_BASE_MAXIMUM_CALLS,
    hardMaximumCalls: IMP24_HARD_MAXIMUM_CALLS,
  };
  return Object.freeze({ ...draft, preflightSha256: hashCanonical(draft) });
}

function emptyLedger(
  executionId: Imp24LiveExecutionIdentityV3,
  freezeSha256: string,
  certificationSha256: string,
  sealSha256: string,
): LiveCallLedgerV3 {
  return {
    schema: IMP24_LIVE_CALL_LEDGER_SCHEMA,
    experimentId: executionId,
    freezeSha256,
    certificationSha256,
    productionInstrumentSealSha256: sealSha256,
    entries: [],
    brokerRequests: 0,
    codexExecInvocations: 0,
    cachedReceipts: 0,
    infrastructureReplays: 0,
    maxPlanCapacityEvents: 0,
    apiCallsMade: 0,
  };
}

function statusFor(error: unknown): QualificationReceiptStatusV3 {
  if (error instanceof ForwardReviewerExecutorError) {
    return error.code === "policy_preflight_failure" ? "policy_failure" : error.code;
  }
  const classification = (error as { classification?: unknown } | null)?.classification;
  return classification === "policy_preflight_failure" ? "policy_failure" : "integrity_failure";
}

function retentionSha256(value: Omit<LiveAttemptRetentionV3, "retentionSha256">): string {
  return hashCanonical(value);
}

export function validateQualificationReceiptArtifactV3(args: {
  request: LiveQualificationExecutionRequestV3;
  receipt: QualificationExecutionReceiptV3;
  label?: string;
}): void {
  const label = args.label ?? args.request.attemptId;
  const receiptKeys = [
    "schema", "executionId", "status", "requestSha256", "freezeSha256", "certificationSha256",
    "productionInstrumentSealSha256", "role", "profileId", "model", "effort", "schemaSha256",
    "reviewProtocol", "evidenceEnvelopeSha256", "evidenceEnvelopeBytesSha256",
    "evidenceEnvelopeBytes", "rawOutput", "receiptSha256",
    ...(Object.hasOwn(args.receipt as object, "failureDetail") ? ["failureDetail"] : []),
  ];
  requireExactObjectKeys(args.receipt, receiptKeys, `${label} receipt`);
  const hasFailureDetail = Object.hasOwn(args.receipt, "failureDetail");
  requireCondition(args.receipt.status === "completed"
    ? !hasFailureDetail
    : hasFailureDetail
      && typeof args.receipt.failureDetail === "string"
      && args.receipt.failureDetail.trim().length > 0,
  `${label}: receipt failureDetail presence must match its completed/non-completed status`);
  const mismatches = qualificationReceiptMismatchesV3(
    args.request as QualificationExecutionRequestV3,
    args.receipt,
  );
  requireCondition(mismatches.length === 0,
    `${label}: retained receipt differs from the exact frozen request: ${mismatches.join(", ")}`);
  const { receiptSha256, ...receiptCore } = args.receipt;
  requireSha(receiptSha256, `${label} receipt hash`);
  requireCondition(qualificationReceiptSha256(receiptCore) === receiptSha256,
    `${label}: receipt self hash mismatch`);
}

function validateLiveAttemptRetentionShapeV3(retention: LiveAttemptRetentionV3, label: string): void {
  requireExactObjectKeys(retention, [
    "schema", "requestSha256", "receiptSha256", "evidenceEnvelopeSha256",
    "evidenceEnvelopeBytesSha256", "processDiagnosticsSha256", "executionEvidenceSha256",
    "request", "receipt", "retentionSha256",
  ], `${label} retention`);
}

export function buildAttemptEvaluationArtifact(
  attempt: QualificationAttemptV3,
  executionEvidenceSha256: string,
): LiveAttemptEvaluationV3 {
  requireCondition(attempt.receipt !== null,
    `attempt ${attempt.request.attemptId} has no retained receipt for its evaluation artifact`);
  requireSha(executionEvidenceSha256, `attempt ${attempt.request.attemptId} execution evidence hash`);
  const core: Omit<LiveAttemptEvaluationV3, "evaluationArtifactSha256"> = {
    schema: IMP24_LIVE_ATTEMPT_EVALUATION_SCHEMA,
    attemptId: attempt.request.attemptId,
    requestSha256: attempt.request.requestSha256,
    receiptSha256: attempt.receipt.receiptSha256,
    executionEvidenceSha256,
    rawOutputSha256: attempt.rawOutputSha256,
    evaluationSha256: attempt.evaluation === null ? null : hashCanonical(attempt.evaluation),
    parsedOutputSha256: attempt.evaluation?.parsedOutput === null || attempt.evaluation === null
      ? null
      : hashCanonical(attempt.evaluation.parsedOutput),
    assembledReviewSha256: attempt.evaluation?.assembledReview === null || attempt.evaluation === null
      ? null
      : hashCanonical(attempt.evaluation.assembledReview),
    evidenceReferenceResolutionSha256: attempt.evaluation === null
      ? null
      : hashCanonical(attempt.evaluation.evidenceReferenceResolution),
    terminalReason: attempt.terminalReason,
    evaluation: attempt.evaluation,
  };
  return { ...core, evaluationArtifactSha256: hashCanonical(core) };
}

function validateCachedAttempt(args: {
  request: LiveQualificationExecutionRequestV3;
  requestPath: string;
  receiptPath: string;
  envelopePath: string;
  retentionPath: string;
}): QualificationExecutionReceiptV3 {
  const retainedRequest = readJson<LiveQualificationExecutionRequestV3>(args.requestPath);
  const retainedReceipt = readJson<QualificationExecutionReceiptV3>(args.receiptPath);
  const retainedEnvelopeBytes = readFileSync(args.envelopePath, "utf8");
  const retention = readJson<LiveAttemptRetentionV3>(args.retentionPath);
  validateQualificationReceiptArtifactV3({
    request: args.request,
    receipt: retainedReceipt,
    label: `attempt ${args.request.attemptId}`,
  });
  validateLiveAttemptRetentionShapeV3(retention, `attempt ${args.request.attemptId}`);
  const { requestSha256: retainedRequestSha256, ...retainedRequestCore } = retainedRequest;
  requireCondition(hashCanonical(retainedRequest) === hashCanonical(args.request),
    `attempt ${args.request.attemptId} request bytes/object changed on resume`);
  requireCondition(retainedRequestSha256 === args.request.requestSha256
    && hashCanonical(retainedRequestCore) === args.request.requestSha256,
  `attempt ${args.request.attemptId} request hash mismatch on resume`);
  requireCondition(retainedEnvelopeBytes === args.request.evidenceEnvelopeBytes,
    `attempt ${args.request.attemptId} exact evidence envelope bytes changed on resume`);
  requireCondition(sha256Hex(retainedEnvelopeBytes) === args.request.evidenceEnvelopeBytesSha256,
    `attempt ${args.request.attemptId} evidence envelope bytes hash mismatch on resume`);
  const { receiptSha256 } = retainedReceipt;
  const { retentionSha256: retainedHash, ...retentionCore } = retention;
  requireCondition(retentionSha256(retentionCore) === retainedHash,
    `attempt ${args.request.attemptId} retention self hash mismatch on resume`);
  requireCondition(retention.requestSha256 === args.request.requestSha256
    && retention.receiptSha256 === receiptSha256
    && retention.evidenceEnvelopeSha256 === args.request.evidenceEnvelopeSha256
    && retention.evidenceEnvelopeBytesSha256 === args.request.evidenceEnvelopeBytesSha256
    && typeof retention.processDiagnosticsSha256 === "string"
    && SHA256.test(retention.processDiagnosticsSha256)
    && typeof retention.executionEvidenceSha256 === "string"
    && SHA256.test(retention.executionEvidenceSha256)
    && hashCanonical(retention.request) === hashCanonical(retainedRequest)
    && hashCanonical(retention.receipt) === hashCanonical(retainedReceipt),
  `attempt ${args.request.attemptId} retention bindings mismatch on resume`);
  return retainedReceipt;
}

function validateCachedProcessDiagnostics(args: {
  request: LiveQualificationExecutionRequestV3;
  receipt: QualificationExecutionReceiptV3;
  processDiagnosticsPath: string;
}): CodexProcessDiagnosticsV1 {
  const diagnostics = readExactPrettyJson<CodexProcessDiagnosticsV1>(
    args.processDiagnosticsPath,
    `attempt ${args.request.attemptId} process diagnostics`,
  );
  validateCodexProcessDiagnosticsV1(diagnostics, {
    attemptId: args.request.attemptId,
    requestSha256: args.request.requestSha256,
    sessionId: diagnostics.invocation === "NOT_INVOKED" ? null : args.receipt.executionId,
    classification: args.receipt.status,
  });
  return diagnostics;
}

function validateCachedExecutionEvidence(args: {
  phaseDir: string;
  request: LiveQualificationExecutionRequestV3;
  receipt: QualificationExecutionReceiptV3;
  processDiagnostics: CodexProcessDiagnosticsV1;
  executionEvidencePath: string;
  preflight?: LiveQualificationPreflightV3;
}): LiveAttemptExecutionEvidenceV3 {
  const artifact = readJson<LiveAttemptExecutionEvidenceV3>(args.executionEvidencePath);
  validateExecutionEvidenceArtifact({
    phaseDir: args.phaseDir,
    request: args.request,
    receipt: args.receipt,
    processDiagnostics: args.processDiagnostics,
    artifact,
    ...(args.preflight ? { preflight: args.preflight } : {}),
  });
  return artifact;
}

function validateCachedEvaluationArtifact(args: {
  request: LiveQualificationExecutionRequestV3;
  receipt: QualificationExecutionReceiptV3;
  executionEvidenceSha256: string;
  evaluationPath: string;
}): LiveAttemptEvaluationV3 {
  const artifact = readJson<LiveAttemptEvaluationV3>(args.evaluationPath);
  requireExactObjectKeys(artifact, [
    "schema", "attemptId", "requestSha256", "receiptSha256", "executionEvidenceSha256",
    "rawOutputSha256", "evaluationSha256", "parsedOutputSha256", "assembledReviewSha256",
    "evidenceReferenceResolutionSha256", "terminalReason", "evaluation", "evaluationArtifactSha256",
  ], `attempt ${args.request.attemptId} evaluation`);
  requireCondition(artifact.schema === IMP24_LIVE_ATTEMPT_EVALUATION_SCHEMA,
    `attempt ${args.request.attemptId} evaluation schema mismatch on resume`);
  const { evaluationArtifactSha256, ...artifactCore } = artifact;
  requireSha(evaluationArtifactSha256, `attempt ${args.request.attemptId} evaluation artifact hash`);
  requireCondition(evaluationArtifactSha256 === hashCanonical(artifactCore),
    `attempt ${args.request.attemptId} evaluation self hash mismatch on resume`);
  const expectedRawOutputSha256 = typeof args.receipt.rawOutput === "string"
    ? sha256Hex(args.receipt.rawOutput)
    : null;
  const expectedEvaluationSha256 = artifact.evaluation === null
    ? null
    : hashCanonical(artifact.evaluation);
  const expectedParsedOutputSha256 = artifact.evaluation?.parsedOutput === null || artifact.evaluation === null
    ? null
    : hashCanonical(artifact.evaluation.parsedOutput);
  const expectedAssembledReviewSha256 = artifact.evaluation?.assembledReview === null || artifact.evaluation === null
    ? null
    : hashCanonical(artifact.evaluation.assembledReview);
  const expectedResolutionSha256 = artifact.evaluation === null
    ? null
    : hashCanonical(artifact.evaluation.evidenceReferenceResolution);
  requireCondition(artifact.attemptId === args.request.attemptId
      && artifact.requestSha256 === args.request.requestSha256
      && artifact.receiptSha256 === args.receipt.receiptSha256
      && artifact.executionEvidenceSha256 === args.executionEvidenceSha256
      && artifact.rawOutputSha256 === expectedRawOutputSha256
      && artifact.evaluationSha256 === expectedEvaluationSha256
      && artifact.parsedOutputSha256 === expectedParsedOutputSha256
      && artifact.assembledReviewSha256 === expectedAssembledReviewSha256
      && artifact.evidenceReferenceResolutionSha256 === expectedResolutionSha256
      && typeof artifact.terminalReason === "string"
      && artifact.terminalReason.length > 0,
  `attempt ${args.request.attemptId} evaluation request/receipt/raw/component binding mismatch on resume`);
  return artifact;
}

export type LiveQualificationResumeAuditInputV3 = {
  input: RunRoleQualificationInputV3;
  freeze: Readonly<QualificationFreezeV3>;
  schedule: readonly QualificationScheduleEntryV3[];
  evaluateOutput: QualificationOutputEvaluatorV3;
  /** Official runs bind this to live/preflight.json before any worker exists. */
  preflight?: LiveQualificationPreflightV3;
};

/**
 * Model-free whole-phase barrier used before the runner can create concurrent
 * workers. Per-attempt validation remains defense in depth, but it is too late
 * to protect a fresh sibling call when another worker discovers corrupt resume
 * state. This audit therefore proves every retained attempt up front.
 */
export function auditLiveQualificationResumeV3(args: LiveQualificationResumeAuditInputV3 & {
  phaseDir: string;
  ledgerPath: string;
  ledger: LiveCallLedgerV3;
}): void {
  requireCondition(typeof args.evaluateOutput === "function",
    "live V3 resume audit requires the frozen model-free evaluator");
  const rebuiltPlan = buildRoleQualificationPlanV3(args.input);
  requireCondition(hashCanonical(rebuiltPlan.freeze) === hashCanonical(args.freeze)
      && hashCanonical(rebuiltPlan.schedule) === hashCanonical(args.schedule),
  "live V3 resume audit inputs differ from the exact frozen plan");
  if (args.preflight !== undefined) {
    validateLiveQualificationPreflightArtifactV3(args.preflight);
    requireCondition(args.preflight.freezeSha256 === args.freeze.freezeSha256
        && args.preflight.certificationSha256 === args.freeze.certificationSha256
        && args.preflight.productionInstrumentSealSha256 === args.freeze.productionInstrumentSealSha256,
    "live V3 resume preflight belongs to different frozen inputs");
  }

  const phaseStat = lstatSync(args.phaseDir);
  requireCondition(phaseStat.isDirectory() && !phaseStat.isSymbolicLink(),
    "live V3 resume phase must be a regular non-symlink directory");
  const ledgerStat = lstatSync(args.ledgerPath);
  requireCondition(ledgerStat.isFile() && !ledgerStat.isSymbolicLink(),
    "live V3 resume call ledger must be a regular non-symlink file");
  const retainedLedger = readExactProductionJson<LiveCallLedgerV3>(
    args.ledgerPath,
    "live V3 resume call ledger",
  );
  requireCondition(hashCanonical(retainedLedger) === hashCanonical(args.ledger),
    "live V3 in-memory and retained call ledgers differ before resume");
  requireExactObjectKeys(args.ledger, [
    "schema", "experimentId", "freezeSha256", "certificationSha256",
    "productionInstrumentSealSha256", "entries", "brokerRequests", "codexExecInvocations",
    "cachedReceipts", "infrastructureReplays", "maxPlanCapacityEvents", "apiCallsMade",
  ], "live V3 resume call ledger");
  requireCondition(args.ledger.schema === IMP24_LIVE_CALL_LEDGER_SCHEMA
      && args.ledger.experimentId === IMP24_ROLE_QUALIFICATION_EXECUTION_ID
      && args.ledger.freezeSha256 === args.freeze.freezeSha256
      && args.ledger.certificationSha256 === args.freeze.certificationSha256
      && args.ledger.productionInstrumentSealSha256 === args.freeze.productionInstrumentSealSha256
      && args.ledger.apiCallsMade === 0
      && Array.isArray(args.ledger.entries),
  "live V3 resume call ledger identity/bindings are invalid");
  requireCondition(Number.isSafeInteger(args.ledger.brokerRequests)
      && Number.isSafeInteger(args.ledger.codexExecInvocations)
      && Number.isSafeInteger(args.ledger.cachedReceipts)
      && Number.isSafeInteger(args.ledger.infrastructureReplays)
      && Number.isSafeInteger(args.ledger.maxPlanCapacityEvents)
      && args.ledger.brokerRequests === args.ledger.entries.length
      && args.ledger.codexExecInvocations >= 0
      && args.ledger.codexExecInvocations <= args.ledger.brokerRequests
      && args.ledger.cachedReceipts === args.ledger.entries.filter((entry) => entry.cached === true).length
      && args.ledger.maxPlanCapacityEvents
        === args.ledger.entries.filter((entry) => entry.status === "provider_capacity").length,
  "live V3 resume call ledger counters are inconsistent");
  requireCondition(args.ledger.entries.length <= IMP24_HARD_MAXIMUM_CALLS,
    "live V3 resume call ledger exceeds the hard call ceiling");

  const expectedRequests = new Map<string, {
    entry: QualificationScheduleEntryV3;
    request: QualificationExecutionRequestV3;
  }>();
  for (const entry of args.schedule) {
    const prepared = args.input.preparedCases[entry.role][entry.partition][entry.caseOrdinal];
    const candidate = IMP24_ROLE_CANDIDATE_ORDER[entry.role][entry.candidateOrdinal];
    requireCondition(prepared !== undefined && candidate !== undefined,
      `${entry.scheduleId}: resume audit frozen case/profile is missing`);
    for (const attemptNumber of [1, 2] as const) {
      const request = buildQualificationExecutionRequestV3(
        entry,
        prepared,
        candidate,
        args.freeze,
        attemptNumber,
        attemptNumber === 1 ? null : `${entry.scheduleId}-a1`,
      );
      requireCondition(!expectedRequests.has(request.attemptId),
        `${request.attemptId}: duplicate attempt identity in the frozen schedule`);
      expectedRequests.set(request.attemptId, { entry, request });
    }
  }

  const ledgerAttemptIds = args.ledger.entries.map((entry) => entry.attemptId);
  requireCondition(new Set(ledgerAttemptIds).size === ledgerAttemptIds.length,
    "live V3 resume call ledger contains duplicate attempt ids");
  const attemptsRoot = resolve(args.phaseDir, "attempts");
  const retainedAttemptNames = existsSync(attemptsRoot) ? readdirSync(attemptsRoot).sort() : [];
  if (existsSync(attemptsRoot)) {
    const attemptsRootStat = lstatSync(attemptsRoot);
    requireCondition(attemptsRootStat.isDirectory() && !attemptsRootStat.isSymbolicLink(),
      "live V3 retained attempts root must be a regular non-symlink directory");
  }
  requireCondition(hashCanonical(retainedAttemptNames) === hashCanonical([...ledgerAttemptIds].sort()),
    "live V3 resume requires exact ledger-to-attempt-directory equality; retained evidence is incomplete or extra");

  const recomputedAttemptById = new Map<string, QualificationAttemptV3>();
  let recomputedCodexExecInvocations = 0;
  let recomputedInfrastructureReplays = 0;
  const spawnBoundExecutionIds = new Set<string>();
  const referencedExecLogRelPaths = new Set<string>();
  for (const ledgerEntry of args.ledger.entries) {
    requireExactObjectKeys(ledgerEntry, [
      "attemptId", "scheduleId", "requestSha256", "evidenceEnvelopeSha256",
      "evidenceEnvelopeBytesSha256", "receiptSha256", "processDiagnosticsSha256", "executionEvidenceSha256",
      "evaluationArtifactSha256", "status", "cached", "requestedAt", "completedAt",
    ], "live V3 resume call-ledger entry");
    const expected = expectedRequests.get(ledgerEntry.attemptId);
    requireCondition(expected !== undefined,
      `${ledgerEntry.attemptId}: retained attempt is outside the exact frozen schedule`);
    const { entry, request } = expected;
    const attemptDir = resolve(attemptsRoot, ledgerEntry.attemptId);
    requireCondition(attemptDir.startsWith(`${attemptsRoot}/`),
      `${ledgerEntry.attemptId}: retained attempt path escapes the live phase`);
    const attemptStat = lstatSync(attemptDir);
    requireCondition(attemptStat.isDirectory() && !attemptStat.isSymbolicLink(),
      `${ledgerEntry.attemptId}: retained attempt must be a regular non-symlink directory`);
    const retainedNames = readdirSync(attemptDir).sort();
    requireCondition(hashCanonical(retainedNames) === hashCanonical(LIVE_ATTEMPT_FILE_NAMES),
      `${ledgerEntry.attemptId}: resume audit requires exact seven-file evidence`);
    for (const name of retainedNames) {
      const evidenceStat = lstatSync(resolve(attemptDir, name));
      requireCondition(evidenceStat.isFile() && !evidenceStat.isSymbolicLink(),
        `${ledgerEntry.attemptId}: retained ${name} must be a regular non-symlink file`);
    }

    const requestPath = resolve(attemptDir, "request.json");
    const receiptPath = resolve(attemptDir, "receipt.json");
    const envelopePath = resolve(attemptDir, "evidence-envelope.json");
    const retentionPath = resolve(attemptDir, "retention.json");
    const processDiagnosticsPath = resolve(attemptDir, "process-diagnostics.json");
    const executionEvidencePath = resolve(attemptDir, "execution-evidence.json");
    const evaluationPath = resolve(attemptDir, "evaluation.json");
    const exactRequest = readExactPrettyJson<QualificationExecutionRequestV3>(
      requestPath,
      `${ledgerEntry.attemptId} request`,
    );
    requireCondition(hashCanonical(exactRequest) === hashCanonical(request),
      `${ledgerEntry.attemptId}: retained request differs from its exact frozen schedule request`);
    const receipt = validateCachedAttempt({ request, requestPath, receiptPath, envelopePath, retentionPath });
    readExactPrettyJson<QualificationExecutionReceiptV3>(receiptPath, `${ledgerEntry.attemptId} receipt`);
    const retention = readExactPrettyJson<LiveAttemptRetentionV3>(
      retentionPath,
      `${ledgerEntry.attemptId} retention`,
    );
    validateLiveAttemptRetentionShapeV3(retention, ledgerEntry.attemptId);
    requireCondition(retention.schema === IMP24_LIVE_ATTEMPT_RETENTION_SCHEMA,
      `${ledgerEntry.attemptId}: retained attempt retention schema mismatch`);
    validateQualificationReceiptArtifactV3({ request, receipt, label: ledgerEntry.attemptId });
    requireCondition(receipt.status !== "completed" || typeof receipt.rawOutput === "string",
      `${ledgerEntry.attemptId}: completed receipt lacks exact raw output`);

    const processDiagnostics = validateCachedProcessDiagnostics({
      request,
      receipt,
      processDiagnosticsPath,
    });
    const executionEvidence = validateCachedExecutionEvidence({
      phaseDir: args.phaseDir,
      request,
      receipt,
      processDiagnostics,
      executionEvidencePath,
      ...(args.preflight ? { preflight: args.preflight } : {}),
    });
    requireCondition(retention.processDiagnosticsSha256 === processDiagnostics.diagnosticsSha256
        && retention.executionEvidenceSha256 === executionEvidence.executionEvidenceSha256,
    `${ledgerEntry.attemptId}: retention diagnostics/execution-evidence binding drift`);
    readExactPrettyJson<LiveAttemptExecutionEvidenceV3>(
      executionEvidencePath,
      `${ledgerEntry.attemptId} execution evidence`,
    );
    for (const binding of [
      executionEvidence.effectiveContextManifest,
      executionEvidence.routeSidecar,
      executionEvidence.structuredOutputSidecar,
      executionEvidence.resultSidecar,
    ]) {
      if (binding) {
        requireCondition(!referencedExecLogRelPaths.has(binding.relPath),
          `${ledgerEntry.attemptId}: exec/log sidecar is referenced by multiple attempts: ${binding.relPath}`);
        referencedExecLogRelPaths.add(binding.relPath);
      }
    }

    const evaluationArtifact = validateCachedEvaluationArtifact({
      request,
      receipt,
      executionEvidenceSha256: executionEvidence.executionEvidenceSha256,
      evaluationPath,
    });
    readExactPrettyJson<LiveAttemptEvaluationV3>(evaluationPath, `${ledgerEntry.attemptId} evaluation`);
    const preparedCase = args.input.preparedCases[entry.role][entry.partition][entry.caseOrdinal];
    const recomputedAttempt = assembleQualificationAttemptV3({
      scheduleOrdinal: entry.ordinal,
      preparedCase,
      request,
      receipt,
      evaluateOutput: args.evaluateOutput,
    });
    requireCondition(recomputedAttempt.routeValid,
      `${ledgerEntry.attemptId}: retained official-live receipt is not route-valid`);
    const expectedEvaluationArtifact = buildAttemptEvaluationArtifact(
      recomputedAttempt,
      executionEvidence.executionEvidenceSha256,
    );
    requireCondition(hashCanonical(evaluationArtifact) === hashCanonical(expectedEvaluationArtifact),
      `${ledgerEntry.attemptId}: retained parsed output/conductor assembly/reference resolution differs from model-free recomputation`);

    requireCondition(ledgerEntry.scheduleId === request.scheduleId
        && ledgerEntry.requestSha256 === request.requestSha256
        && ledgerEntry.evidenceEnvelopeSha256 === request.evidenceEnvelopeSha256
        && ledgerEntry.evidenceEnvelopeBytesSha256 === request.evidenceEnvelopeBytesSha256
        && ledgerEntry.receiptSha256 === receipt.receiptSha256
        && ledgerEntry.processDiagnosticsSha256 === processDiagnostics.diagnosticsSha256
        && ledgerEntry.executionEvidenceSha256 === executionEvidence.executionEvidenceSha256
        && ledgerEntry.evaluationArtifactSha256 === evaluationArtifact.evaluationArtifactSha256
        && ledgerEntry.status === receipt.status
        && typeof ledgerEntry.cached === "boolean"
        && typeof ledgerEntry.requestedAt === "string"
        && Number.isFinite(Date.parse(ledgerEntry.requestedAt))
        && new Date(ledgerEntry.requestedAt).toISOString() === ledgerEntry.requestedAt
        && ledgerEntry.completedAt !== null
        && typeof ledgerEntry.completedAt === "string"
        && Number.isFinite(Date.parse(ledgerEntry.completedAt))
        && new Date(ledgerEntry.completedAt).toISOString() === ledgerEntry.completedAt
        && Date.parse(ledgerEntry.completedAt) >= Date.parse(ledgerEntry.requestedAt),
    `${ledgerEntry.attemptId}: call-ledger request/receipt/execution/evaluation/timestamp binding drift`);
    if (executionEvidence.invocation !== "NOT_INVOKED_PRE_SPAWN") {
      requireCondition(executionEvidence.sessionId !== null
          && !spawnBoundExecutionIds.has(executionEvidence.sessionId),
      `${ledgerEntry.attemptId}: duplicate spawn-bound execution id ${String(executionEvidence.sessionId)}`);
      spawnBoundExecutionIds.add(executionEvidence.sessionId);
      recomputedCodexExecInvocations += 1;
    }
    if (request.attemptNumber === 2) recomputedInfrastructureReplays += 1;
    recomputedAttemptById.set(request.attemptId, recomputedAttempt);
  }

  const fatalChronologyViolations = fatalReceiptChronologyViolationsV3(args.ledger);
  requireCondition(fatalChronologyViolations.length === 0,
    `live V3 resume proves request(s) opened after the first completed campaign-fatal receipt: ${fatalChronologyViolations.join(", ")}`);

  for (const ledgerEntry of args.ledger.entries) {
    const expected = expectedRequests.get(ledgerEntry.attemptId)!;
    if (expected.request.attemptNumber !== 2) continue;
    const priorAttemptId = `${expected.request.scheduleId}-a1`;
    const priorAttempt = recomputedAttemptById.get(priorAttemptId);
    requireCondition(priorAttempt?.replayEligible === true,
      `${ledgerEntry.attemptId}: retained replay lacks one exact eligible infrastructure predecessor`);
  }
  const replayChronologyViolations = replayReceiptChronologyViolationsV3(args.ledger);
  requireCondition(replayChronologyViolations.length === 0,
    `live V3 resume replay chronology is invalid: ${replayChronologyViolations.join(", ")}`);

  // mapPool takes base schedule entries monotonically from the frozen batch.
  // With two workers a crash may leave a proper prefix complete (and at most
  // two calls in flight), but it can never produce a later base entry while an
  // earlier entry in the same batch was never started. Accepting such a gap
  // would let resume replace a judgment that the later entry proves had
  // already been passed in traversal order.
  const retainedBaseScheduleIds = new Set(args.ledger.entries.map((entry) => entry.scheduleId));
  for (const role of ROLES) {
    for (let candidateOrdinal = 0;
      candidateOrdinal < IMP24_ROLE_CANDIDATE_ORDER[role].length;
      candidateOrdinal += 1) {
      for (const partition of ["canary", "holdout"] as const) {
        const batch = args.schedule.filter((entry) => entry.role === role
          && entry.candidateOrdinal === candidateOrdinal
          && entry.partition === partition);
        const retainedBatch = batch.filter((entry) => retainedBaseScheduleIds.has(entry.scheduleId));
        if (retainedBatch.length === 0) continue;
        const expectedPrefix = batch.slice(0, retainedBatch.length);
        requireCondition(hashCanonical(retainedBatch.map((entry) => entry.scheduleId))
            === hashCanonical(expectedPrefix.map((entry) => entry.scheduleId)),
        `${role}/${candidateOrdinal}/${partition}: retained base attempts are not an exact frozen batch prefix`);
      }
    }
  }
  requireCondition(args.ledger.infrastructureReplays === recomputedInfrastructureReplays,
    "live V3 resume infrastructure replay counter differs from retained replay attempts");
  requireCondition(args.ledger.codexExecInvocations === recomputedCodexExecInvocations,
    "live V3 resume codex-exec counter differs from retained spawn-bound receipts");

  validateLiveExecEvidenceRootV3(args.phaseDir, referencedExecLogRelPaths);

  // Prove the retained subset is reachable under the runner's exact
  // role/candidate gates. Membership in the frozen schedule alone is not
  // enough: a later candidate judgment can be valid in isolation but orphaned
  // once an earlier candidate earns the sequential-stop quota.
  const reachableScheduleIds = new Set<string>();
  const finalAttemptFor = (entry: QualificationScheduleEntryV3): QualificationAttemptV3 | null => {
    const first = recomputedAttemptById.get(`${entry.scheduleId}-a1`);
    if (!first) return null;
    return first.replayEligible
      ? recomputedAttemptById.get(`${entry.scheduleId}-a2`) ?? null
      : first;
  };
  roleTraversal: for (const role of ROLES) {
    let qualifiedProfiles = 0;
    for (let candidateOrdinal = 0; candidateOrdinal < IMP24_ROLE_CANDIDATE_ORDER[role].length; candidateOrdinal += 1) {
      if (qualifiedProfiles >= IMP24_REQUIRED_ROLE_QUALIFIERS[role]) continue;
      const availability = args.input.candidateAvailability.entries.find((candidate) =>
        candidate.role === role && candidate.ordinal === candidateOrdinal);
      requireCondition(availability !== undefined,
        `${role}/${candidateOrdinal}: resume audit candidate availability is missing`);
      if (availability.status === "UNAVAILABLE") continue;

      const canaryEntries = args.schedule.filter((entry) => entry.role === role
        && entry.candidateOrdinal === candidateOrdinal
        && entry.partition === "canary");
      canaryEntries.forEach((entry) => reachableScheduleIds.add(entry.scheduleId));
      const canaries = canaryEntries.map(finalAttemptFor);
      if (canaries.some((attempt) => attempt === null)) {
        break roleTraversal;
      }
      const completedCanaries = canaries as QualificationAttemptV3[];
      if (!completedCanaries.every((attempt) => attempt.protocolValid)) continue;

      const holdoutEntries = args.schedule.filter((entry) => entry.role === role
        && entry.candidateOrdinal === candidateOrdinal
        && entry.partition === "holdout");
      holdoutEntries.forEach((entry) => reachableScheduleIds.add(entry.scheduleId));
      const holdouts = holdoutEntries.map(finalAttemptFor);
      if (holdouts.some((attempt) => attempt === null)) {
        break roleTraversal;
      }
      const ledger = scoreQualificationHoldoutV3(role, holdouts as QualificationAttemptV3[]);
      const outcome = qualifyRole(role, ledger.metrics, args.input.thresholds, ledger.denominators);
      if (outcome.status === "QUALIFIED") qualifiedProfiles += 1;
    }
  }
  const unreachableRetainedScheduleIds = [...new Set(args.ledger.entries.map((entry) => entry.scheduleId))]
    .filter((scheduleId) => !reachableScheduleIds.has(scheduleId))
    .sort();
  requireCondition(unreachableRetainedScheduleIds.length === 0,
    `live V3 resume contains retained attempts unreachable under frozen sequential gates: ${unreachableRetainedScheduleIds.join(", ")}`);

  const resultPath = resolve(args.phaseDir, "qualification-result.json");
  const roleRegistryPath = resolve(args.phaseDir, "role-registry.json");
  requireCondition(!existsSync(roleRegistryPath) || existsSync(resultPath),
    "live V3 role registry is retained without its terminal qualification result");
  if (existsSync(resultPath)) {
    const resultStat = lstatSync(resultPath);
    requireCondition(resultStat.isFile() && !resultStat.isSymbolicLink(),
      "live V3 terminal qualification result must be a regular non-symlink file");
    const result = readExactProductionJson<RoleQualificationRunnerResultV3>(
      resultPath,
      "live V3 terminal qualification result",
    );
    requireCondition(result.schema === IMP24_ROLE_QUALIFICATION_RUNNER_SCHEMA
        && result.experimentId === IMP24_ROLE_QUALIFICATION_EXECUTION_ID
        && hashCanonical(result.freeze) === hashCanonical(args.freeze)
        && hashCanonical(result.schedule) === hashCanonical(args.schedule),
    "live V3 terminal qualification result differs from the exact frozen plan");
    requireCondition(result.totalAttempts === result.attempts.length
        && result.baseCallsAttempted === new Set(result.attempts.map((attempt) => attempt.request.scheduleId)).size
        && result.infrastructureReplays === result.attempts.filter((attempt) => attempt.request.attemptNumber === 2).length,
    "live V3 terminal qualification result counters differ from its exact attempts");
    const resultAttemptIds = result.attempts.map((attempt) => attempt.request.attemptId);
    requireCondition(new Set(resultAttemptIds).size === resultAttemptIds.length
        && hashCanonical([...resultAttemptIds].sort()) === hashCanonical([...ledgerAttemptIds].sort()),
    "live V3 terminal qualification result attempt set differs from the exact audited ledger/directories");
    for (const resultAttempt of result.attempts) {
      const recomputed = recomputedAttemptById.get(resultAttempt.request.attemptId);
      requireCondition(recomputed !== undefined
          && hashCanonical(resultAttempt) === hashCanonical(recomputed),
      `${resultAttempt.request.attemptId}: terminal result attempt differs from retained model-free recomputation`);
    }
    if (existsSync(roleRegistryPath)) {
      const registryStat = lstatSync(roleRegistryPath);
      requireCondition(registryStat.isFile() && !registryStat.isSymbolicLink(),
        "live V3 retained role registry must be a regular non-symlink file");
      const registry = readExactProductionJson<unknown>(roleRegistryPath, "live V3 retained role registry");
      requireCondition(hashCanonical(registry) === hashCanonical(result.registry),
        "live V3 retained role registry differs from its terminal qualification result");
    }
  }
}

export type LiveQualificationExecutorDepsV3 = {
  phaseDir: string;
  executionId?: Imp24LiveExecutionIdentityV3;
  freezeSha256: string;
  certificationSha256: string;
  productionInstrumentSealSha256: string;
  repositoryRoot?: string;
  productionInstrumentSeal?: RunRoleQualificationInputV3["productionInstrumentSeal"];
  authJsonPath?: string;
  env?: NodeJS.ProcessEnv;
  /** Test-only seam. Production callers omit it and supply repositoryRoot,
   * productionInstrumentSeal, and ChatGPT auth for per-spawn revalidation. */
  preCallVerifier?: (request: LiveQualificationExecutionRequestV3) => void;
  schemaMap?: ForwardReviewerSchemaMap;
  spawn?: ForwardReviewerSpawn;
  workspaceBaseDir?: string;
  timeoutMs?: number;
  clock?: () => Date;
};

/** Build a retained executor. Existing complete attempts are reused only after
 * exact request, envelope, receipt, and retention self-hashes all revalidate.
 * A partial attempt stops: it is never guessed/replayed. */
export function createLiveQualificationExecutorV3(
  deps: LiveQualificationExecutorDepsV3,
): {
  executor: QualificationExecutorV3;
  controlExecutor: (request: LiveQualificationExecutionRequestV3) => Promise<QualificationExecutionReceiptV3>;
  retainAttemptEvaluation: (attempt: QualificationAttemptV3) => void;
  auditResume: (args: LiveQualificationResumeAuditInputV3) => void;
  ledger: LiveCallLedgerV3;
  ledgerPath: string;
} {
  requireSha(deps.freezeSha256, "live v3 freeze hash");
  requireSha(deps.certificationSha256, "live v3 certification hash");
  requireSha(deps.productionInstrumentSealSha256, "live v3 production seal hash");
  const executionId = deps.executionId ?? IMP24_ROLE_QUALIFICATION_EXECUTION_ID;
  requireImp24LiveExecutionIdentityV3(executionId);
  requireCondition(typeof deps.preCallVerifier === "function"
    || (typeof deps.repositoryRoot === "string" && deps.repositoryRoot.length > 0 && deps.productionInstrumentSeal !== undefined),
  "live v3 executor requires per-call production-seal/auth verification inputs");
  const phaseDir = resolve(deps.phaseDir);
  const retainedPreflightPath = resolve(phaseDir, "preflight.json");
  const retainedPreflight = existsSync(retainedPreflightPath)
    ? readExactProductionJson<LiveQualificationPreflightV3>(retainedPreflightPath, "live V3 retained preflight")
    : null;
  requireCondition(typeof deps.preCallVerifier === "function" || retainedPreflight !== null,
    "live v3 production executor requires its retained phase preflight before any call");
  if (retainedPreflight !== null) {
    validateLiveQualificationPreflightArtifactV3(retainedPreflight, executionId);
    requireCondition(retainedPreflight.freezeSha256 === deps.freezeSha256
        && retainedPreflight.certificationSha256 === deps.certificationSha256
        && retainedPreflight.productionInstrumentSealSha256 === deps.productionInstrumentSealSha256,
    "live v3 retained phase preflight belongs to different executor inputs");
  }
  const ledgerPath = resolve(phaseDir, "call-ledger.json");
  const ledger = existsSync(ledgerPath)
    ? readJson<LiveCallLedgerV3>(ledgerPath)
    : emptyLedger(executionId, deps.freezeSha256, deps.certificationSha256, deps.productionInstrumentSealSha256);
  requireCondition(ledger.schema === IMP24_LIVE_CALL_LEDGER_SCHEMA
    && ledger.experimentId === executionId
    && ledger.freezeSha256 === deps.freezeSha256
    && ledger.certificationSha256 === deps.certificationSha256
    && ledger.productionInstrumentSealSha256 === deps.productionInstrumentSealSha256
    && ledger.apiCallsMade === 0
    && Number.isSafeInteger(ledger.maxPlanCapacityEvents)
    && ledger.maxPlanCapacityEvents === ledger.entries.filter((entry) => entry.status === "provider_capacity").length,
  "retained live v3 call ledger belongs to different or unsafe inputs");
  mkdirSync(phaseDir, { recursive: true });
  if (!existsSync(ledgerPath)) writeJson(ledgerPath, ledger);

  const now = (): string => (deps.clock?.() ?? new Date()).toISOString();
  let terminalResultBoundByResumeAudit = false;

  const verifyImmediatelyBeforeSpawn = (request: LiveQualificationExecutionRequestV3): void => {
    if (deps.preCallVerifier) {
      deps.preCallVerifier(request);
      return;
    }
    const current = validateForwardProductionInstrumentSeal(deps.productionInstrumentSeal!, {
      repositoryRoot: resolve(deps.repositoryRoot!),
    });
    requireCondition(current.sealSha256 === request.productionInstrumentSealSha256
      && current.sealSha256 === deps.productionInstrumentSealSha256,
    "production instrument bytes drifted after v3 preflight");
    const parentEnv = deps.env ?? process.env;
    const forbidden = FORBIDDEN_PROVIDER_ENV.filter((key) => {
      const value = parentEnv[key];
      return typeof value === "string" && value.length > 0;
    });
    requireCondition(forbidden.length === 0,
      `prohibited provider environment appeared after v3 preflight: ${forbidden.join(", ")}`);
    const authPath = deps.authJsonPath ?? resolve(parentEnv.CODEX_HOME ?? resolve(homedir(), ".codex"), "auth.json");
    const auth = assertChatgptSubscriptionAuth(authPath);
    requireCondition(auth.authMode === "chatgpt" && auth.apiKeyPresent === false,
      "ChatGPT subscription auth drifted after v3 preflight");
    const executionProfile = resolveExecutionProfile("chapter-reviewer");
    requireCondition(executionProfile.profile.workingDir === "isolated-workspace"
      && executionProfile.profile.codexHome === "isolated-auth-only"
      && executionProfile.profile.allowedSandboxes.length === 1
      && executionProfile.profile.allowedSandboxes[0] === "read-only",
    "chapter-reviewer route drifted after v3 preflight");
  };

  const controlExecutor = async (request: LiveQualificationExecutionRequestV3) => {
    requireCondition(request.schema === IMP24_ROLE_QUALIFICATION_REQUEST_SCHEMA
      && request.experimentId === executionId,
    "live v3 executor rejected wrong request schema/identity");
    requireCondition(request.freezeSha256 === deps.freezeSha256
      && request.certificationSha256 === deps.certificationSha256
      && request.productionInstrumentSealSha256 === deps.productionInstrumentSealSha256,
    "live v3 executor request binding differs from preflight");
    const { requestSha256, ...requestCore } = request;
    requireCondition(hashCanonical(requestCore) === requestSha256, "live v3 request self hash mismatch");
    requireCondition(request.reviewProtocol === "review-evidence-envelope-v1"
      && sha256Hex(request.evidenceEnvelopeBytes) === request.evidenceEnvelopeBytesSha256,
    "live v3 request does not retain exact evidence envelope bytes/hash");

    const attemptDir = resolve(phaseDir, "attempts", request.attemptId);
    const requestPath = resolve(attemptDir, "request.json");
    const receiptPath = resolve(attemptDir, "receipt.json");
    const envelopePath = resolve(attemptDir, "evidence-envelope.json");
    const retentionPath = resolve(attemptDir, "retention.json");
    const processDiagnosticsPath = resolve(attemptDir, "process-diagnostics.json");
    const executionEvidencePath = resolve(attemptDir, "execution-evidence.json");
    const evaluationPath = resolve(attemptDir, "evaluation.json");
    const retainedNames = existsSync(attemptDir) ? readdirSync(attemptDir).sort() : [];
    if (retainedNames.length > 0) {
      const attemptStat = lstatSync(attemptDir);
      requireCondition(attemptStat.isDirectory() && !attemptStat.isSymbolicLink(),
        `attempt ${request.attemptId} retained directory must be a regular non-symlink directory`);
      requireCondition(hashCanonical(retainedNames) === hashCanonical(LIVE_ATTEMPT_FILE_NAMES),
        `attempt ${request.attemptId} is partial; exact seven-file evidence is required and replay is refused because a valid prior judgment cannot be ruled out`);
      for (const name of retainedNames) {
        const retainedStat = lstatSync(resolve(attemptDir, name));
        requireCondition(retainedStat.isFile() && !retainedStat.isSymbolicLink(),
          `attempt ${request.attemptId} retained ${name} must be a regular non-symlink file`);
      }
      const cached = validateCachedAttempt({ request, requestPath, receiptPath, envelopePath, retentionPath });
      const ledgerEntry = ledger.entries.find((entry) => entry.attemptId === request.attemptId);
      requireCondition(ledgerEntry?.requestSha256 === request.requestSha256
        && ledgerEntry.receiptSha256 === cached.receiptSha256
        && ledgerEntry.status === cached.status,
      `attempt ${request.attemptId} call ledger differs from retained receipt`);
      const retainedProcessDiagnostics = validateCachedProcessDiagnostics({
        request,
        receipt: cached,
        processDiagnosticsPath,
      });
      const retainedExecutionEvidence = validateCachedExecutionEvidence({
        phaseDir,
        request,
        receipt: cached,
        processDiagnostics: retainedProcessDiagnostics,
        executionEvidencePath,
        ...(retainedPreflight ? { preflight: retainedPreflight } : {}),
      });
      const retainedRetention = readJson<LiveAttemptRetentionV3>(retentionPath);
      requireCondition(retainedRetention.processDiagnosticsSha256 === retainedProcessDiagnostics.diagnosticsSha256
          && retainedRetention.executionEvidenceSha256 === retainedExecutionEvidence.executionEvidenceSha256,
      `attempt ${request.attemptId} retention diagnostics/execution-evidence hash differs from retained evidence`);
      requireCondition(ledgerEntry.processDiagnosticsSha256 === retainedProcessDiagnostics.diagnosticsSha256
          && ledgerEntry.executionEvidenceSha256 === retainedExecutionEvidence.executionEvidenceSha256,
      `attempt ${request.attemptId} call ledger diagnostics/execution-evidence hash differs from retained evidence`);
      const retainedEvaluation = validateCachedEvaluationArtifact({
        request,
        receipt: cached,
        executionEvidenceSha256: retainedExecutionEvidence.executionEvidenceSha256,
        evaluationPath,
      });
      requireCondition(ledgerEntry.evaluationArtifactSha256 === retainedEvaluation.evaluationArtifactSha256,
        `attempt ${request.attemptId} call ledger evaluation hash differs from retained evaluation`);
      // Cache accounting is retained per unique attempt, not per resume
      // traversal. Repeated crash recovery therefore has stable call counts
      // and cannot make the ledger/report drift merely by validating the same
      // completed receipt again.
      ledgerEntry.cached = true;
      ledger.cachedReceipts = ledger.entries.filter((candidate) => candidate.cached).length;
      writeJson(ledgerPath, ledger);
      return cached;
    }

    requireCondition(!terminalResultBoundByResumeAudit,
      `attempt ${request.attemptId} is absent although a terminal qualification result is retained; refuse a fresh judgment`);

    writeJson(requestPath, request);
    writeFileAtomic(envelopePath, request.evidenceEnvelopeBytes);
    const entry: LiveCallLedgerEntryV3 = {
      attemptId: request.attemptId,
      scheduleId: request.scheduleId,
      requestSha256: request.requestSha256,
      evidenceEnvelopeSha256: request.evidenceEnvelopeSha256,
      evidenceEnvelopeBytesSha256: request.evidenceEnvelopeBytesSha256,
      receiptSha256: null,
      processDiagnosticsSha256: null,
      executionEvidenceSha256: null,
      evaluationArtifactSha256: null,
      status: "REQUESTED",
      cached: false,
      requestedAt: now(),
      completedAt: null,
    };
    requireCondition(!ledger.entries.some((candidate) => candidate.attemptId === request.attemptId),
      `attempt id ${request.attemptId} is already present in the call ledger`);
    ledger.entries.push(entry);
    ledger.brokerRequests += 1;
    if (request.attemptNumber === 2) ledger.infrastructureReplays += 1;
    writeJson(ledgerPath, ledger);

    let receiptCore: Omit<QualificationExecutionReceiptV3, "receiptSha256">;
    const plannedSessionId = liveQualificationExecutionSessionIdV3(request);
    const spawnObservation: {
      boundary: CodexRunnerBoundaryV1 | null;
      result: CodexAgentResult | null;
      error: unknown;
    } = { boundary: null, result: null, error: null };
    let attemptError: unknown = null;
    try {
      const envelope = JSON.parse(request.evidenceEnvelopeBytes) as { instrumentVersion?: unknown };
      requireCondition(typeof envelope.instrumentVersion === "string" && envelope.instrumentVersion.length > 0,
        "live v3 evidence envelope instrumentVersion is missing");
      const forwardRequest: ForwardReviewExecutionRequestV1 = {
        schema: FORWARD_REVIEW_EXECUTION_REQUEST_SCHEMA,
        lane: request.role,
        reviewOperationKey: request.scheduleId,
        workspaceRole: workspaceRole(request.role),
        profileId: request.profileId,
        model: request.model,
        effort: request.effort,
        schemaSha256: request.schemaSha256,
        instrumentVersion: envelope.instrumentVersion,
        reviewProtocol: "review-evidence-envelope-v1",
        evidenceEnvelopeSha256: request.evidenceEnvelopeSha256,
        evidenceEnvelopeBytesSha256: request.evidenceEnvelopeBytesSha256,
        roleAssignmentSha256: hashCanonical(IMP24_ROLE_CANDIDATE_ORDER),
        instrumentManifestSha256: request.freezeSha256,
        executionProfileHash: resolveExecutionProfile("chapter-reviewer").profileHash,
        routePolicyVersion: ROUTE_POLICY_VERSION,
        task: request.task,
        artifacts: [{
          kind: "evidence-envelope",
          relPath: `evidence/${request.caseId}.review-evidence-envelope-v1.json`,
          content: request.evidenceEnvelopeBytes,
          sha256: request.evidenceEnvelopeBytesSha256,
        }],
      };
      const forwardExecutor = createForwardReviewerExecutor({
        schemaMap: deps.schemaMap ?? IMP24_V2_REVIEWER_SCHEMA_MAP,
        spawn: async (options) => {
          // Mutable trust is checked before entering the hermetic broker. The
          // call counter moves only at codexAgent's lower process boundary,
          // after CLI/auth/manifest preflight and directly before runner(...).
          verifyImmediatelyBeforeSpawn(request);
          const spawn = deps.spawn ?? hermeticCodexSpawn;
          try {
            const result = await spawn({
              ...options,
              onRunnerBoundary: (boundary) => {
                requireCondition(boundary.sessionId === plannedSessionId
                    && boundary.manifestPath !== null
                    && boundary.schemaBound === true
                    && boundary.outputSchemaPath === (options.outputSchemaPath ?? null)
                    && boundary.outputSchemaSha256 === request.schemaSha256,
                `attempt ${request.attemptId} hermetic runner boundary is not bound to its exact session/manifest/schema`);
                ledger.codexExecInvocations += 1;
                try {
                  writeJson(ledgerPath, ledger);
                } catch (error) {
                  ledger.codexExecInvocations -= 1;
                  throw new ForwardRoleQualificationRetainedEvidenceIncompleteV3Error(
                    `attempt ${request.attemptId} could not retain its process-boundary call count before runner: ${(error as Error).message}`,
                  );
                }
                spawnObservation.boundary = { ...boundary };
              },
            });
            spawnObservation.result = result;
            return result;
          } catch (error) {
            spawnObservation.error = error;
            if (error instanceof CodexPostRunEvidenceError) {
              // The subprocess returned; only post-run evidence persistence
              // failed. Preserve its authoritative output/source so the attempt
              // is retained as RUNNER_RETURNED + integrity/incomplete.
              spawnObservation.result = { ...error.result };
            }
            throw error;
          }
        },
        sessionIdFactory: () => plannedSessionId,
        ...(deps.workspaceBaseDir ? { workspaceBaseDir: deps.workspaceBaseDir } : {}),
        ...(deps.timeoutMs ? { timeoutMs: deps.timeoutMs } : {}),
        manifestSink: resolve(phaseDir, "exec", "logs"),
        qualificationCacheDir: resolve(phaseDir, "exec", "cli-qualification-cache"),
        execBaseDir: resolve(phaseDir, "exec", "sessions"),
      });
      const result = await forwardExecutor(forwardRequest);
      receiptCore = {
        schema: IMP24_ROLE_QUALIFICATION_RECEIPT_SCHEMA,
        executionId: result.executionId,
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
        rawOutput: result.output,
      };
    } catch (error) {
      attemptError = error;
      const status = statusFor(error);
      receiptCore = {
        schema: IMP24_ROLE_QUALIFICATION_RECEIPT_SCHEMA,
        executionId: spawnObservation.boundary?.sessionId ?? `preflight-${request.attemptId}`,
        status,
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
        rawOutput: spawnObservation.result?.finalMessage ?? null,
        failureDetail: ((error as Error).message.trim()
          || (error as Error).name.trim()
          || "unknown qualification execution failure").slice(0, 2_000),
      };
    }
    const receipt: QualificationExecutionReceiptV3 = {
      ...receiptCore,
      receiptSha256: qualificationReceiptSha256(receiptCore),
    };
    writeJson(receiptPath, receipt);
    const diagnosticsInvocation = spawnObservation.boundary === null
      ? "NOT_INVOKED" as const
      : spawnObservation.result === null
        ? "RUNNER_THROWN" as const
        : "RUNNER_RETURNED" as const;
    const processDiagnostics = buildCodexProcessDiagnosticsV1({
      attemptId: request.attemptId,
      requestSha256: request.requestSha256,
      sessionId: spawnObservation.boundary?.sessionId ?? null,
      invocation: diagnosticsInvocation,
      classification: receipt.status,
      ...(spawnObservation.result === null ? {} : {
        result: {
          stdout: spawnObservation.result.stdout,
          stderr: spawnObservation.result.stderr,
          exitCode: spawnObservation.result.exitCode,
        },
      }),
      ...((spawnObservation.error ?? attemptError) === null ? {} : {
        error: spawnObservation.error ?? attemptError,
      }),
    });
    try {
      writeJson(processDiagnosticsPath, processDiagnostics);
      const retainedProcessDiagnostics = readExactPrettyJson<CodexProcessDiagnosticsV1>(
        processDiagnosticsPath,
        `attempt ${request.attemptId} process diagnostics`,
      );
      validateCodexProcessDiagnosticsV1(retainedProcessDiagnostics, {
        attemptId: request.attemptId,
        requestSha256: request.requestSha256,
        sessionId: processDiagnostics.sessionId,
        invocation: processDiagnostics.invocation,
        classification: receipt.status,
      });
      requireCondition(hashCanonical(retainedProcessDiagnostics) === hashCanonical(processDiagnostics),
        `attempt ${request.attemptId} process-diagnostics read-back hash mismatch`);
    } catch (error) {
      throw new ForwardRoleQualificationRetainedEvidenceIncompleteV3Error(
        `attempt ${request.attemptId} could not retain exact process diagnostics: ${(error as Error).message}`,
      );
    }
    const executionEvidence = buildLiveAttemptExecutionEvidenceV3({
      phaseDir,
      request,
      receipt,
      processDiagnosticsSha256: processDiagnostics.diagnosticsSha256,
      plannedSessionId,
      boundary: spawnObservation.boundary,
      result: spawnObservation.result,
    });
    try {
      writeJson(executionEvidencePath, executionEvidence);
      const retainedExecutionEvidence = readExactPrettyJson<LiveAttemptExecutionEvidenceV3>(
        executionEvidencePath,
        `attempt ${request.attemptId} execution evidence`,
      );
      requireCondition(hashCanonical(retainedExecutionEvidence) === hashCanonical(executionEvidence),
        `attempt ${request.attemptId} execution-evidence read-back hash mismatch`);
    } catch (error) {
      if (error instanceof ForwardRoleQualificationRetainedEvidenceIncompleteV3Error) throw error;
      throw new ForwardRoleQualificationRetainedEvidenceIncompleteV3Error(
        `attempt ${request.attemptId} could not retain exact execution evidence: ${(error as Error).message}`,
      );
    }
    let executionEvidenceFailure: ForwardRoleQualificationRetainedEvidenceIncompleteV3Error | null = null;
    try {
      validateExecutionEvidenceArtifact({
        phaseDir,
        request,
        receipt,
        processDiagnostics,
        artifact: executionEvidence,
        ...(retainedPreflight ? { preflight: retainedPreflight } : {}),
      });
    } catch (error) {
      executionEvidenceFailure = new ForwardRoleQualificationRetainedEvidenceIncompleteV3Error(
        `attempt ${request.attemptId} retained execution evidence is incomplete: ${(error as Error).message}`,
      );
    }
    const retentionCore: Omit<LiveAttemptRetentionV3, "retentionSha256"> = {
      schema: IMP24_LIVE_ATTEMPT_RETENTION_SCHEMA,
      requestSha256: request.requestSha256,
      receiptSha256: receipt.receiptSha256,
      evidenceEnvelopeSha256: request.evidenceEnvelopeSha256,
      evidenceEnvelopeBytesSha256: request.evidenceEnvelopeBytesSha256,
      processDiagnosticsSha256: processDiagnostics.diagnosticsSha256,
      executionEvidenceSha256: executionEvidence.executionEvidenceSha256,
      request,
      receipt,
    };
    writeJson(retentionPath, { ...retentionCore, retentionSha256: retentionSha256(retentionCore) });
    entry.receiptSha256 = receipt.receiptSha256;
    entry.processDiagnosticsSha256 = processDiagnostics.diagnosticsSha256;
    entry.executionEvidenceSha256 = executionEvidence.executionEvidenceSha256;
    entry.status = receipt.status;
    entry.completedAt = now();
    ledger.maxPlanCapacityEvents = ledger.entries.filter((candidate) => candidate.status === "provider_capacity").length;
    writeJson(ledgerPath, ledger);
    if (executionEvidenceFailure) throw executionEvidenceFailure;
    return receipt;
  };
  const retainAttemptEvaluation = (attempt: QualificationAttemptV3): void => {
    const attemptDir = resolve(phaseDir, "attempts", attempt.request.attemptId);
    const evaluationPath = resolve(attemptDir, "evaluation.json");
    const corePaths = ["request.json", "receipt.json", "evidence-envelope.json", "process-diagnostics.json", "execution-evidence.json", "retention.json"]
      .map((name) => resolve(attemptDir, name));
    requireCondition(corePaths.every(existsSync),
      `attempt ${attempt.request.attemptId} cannot retain evaluation without its complete six-file call evidence`);
    const entry = ledger.entries.find((candidate) => candidate.attemptId === attempt.request.attemptId);
    requireCondition(entry?.requestSha256 === attempt.request.requestSha256
      && entry.receiptSha256 === attempt.receipt?.receiptSha256
      && typeof entry.processDiagnosticsSha256 === "string"
      && typeof entry.executionEvidenceSha256 === "string",
    `attempt ${attempt.request.attemptId} evaluation cannot bind to its call-ledger entry`);
    const artifact = buildAttemptEvaluationArtifact(attempt, entry.executionEvidenceSha256);
    requireCondition(entry.evaluationArtifactSha256 === null
      || entry.evaluationArtifactSha256 === artifact.evaluationArtifactSha256,
    `attempt ${attempt.request.attemptId} call-ledger evaluation hash conflicts with retained evaluation`);
    if (existsSync(evaluationPath)) {
      const retained = readJson<LiveAttemptEvaluationV3>(evaluationPath);
      requireCondition(hashCanonical(retained) === hashCanonical(artifact),
        `attempt ${attempt.request.attemptId} retained evaluation differs on resume`);
    } else {
      writeJson(evaluationPath, artifact);
      const retained = readJson<LiveAttemptEvaluationV3>(evaluationPath);
      requireCondition(hashCanonical(retained) === hashCanonical(artifact),
        `attempt ${attempt.request.attemptId} evaluation read-back hash mismatch`);
    }
    entry.evaluationArtifactSha256 = artifact.evaluationArtifactSha256;
    writeJson(ledgerPath, ledger);
  };
  const auditResume = (auditArgs: LiveQualificationResumeAuditInputV3): void => {
    auditLiveQualificationResumeV3({
      ...auditArgs,
      ...(retainedPreflight ? { preflight: retainedPreflight } : {}),
      phaseDir,
      ledgerPath,
      ledger,
    });
    terminalResultBoundByResumeAudit = existsSync(resolve(phaseDir, "qualification-result.json"));
  };
  const executor: QualificationExecutorV3 = (request) => controlExecutor(request);
  return { executor, controlExecutor, retainAttemptEvaluation, auditResume, ledger, ledgerPath };
}
