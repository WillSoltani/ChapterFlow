/**
 * IMP-24 live boundary for `s16-forward-role-qualification-v3-envelope`.
 *
 * The core runner remains pure. This module proves the ChatGPT-authenticated
 * `codex exec` route, revalidates the retained production seal against current
 * repository bytes, and provides a crash-safe executor that retains the exact
 * inline envelope before entering the shared reviewer broker. Tests inject the
 * spawn function; production defaults remain inside forwardReviewerExecutor.
 */

import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, resolve } from "node:path";

import { PIPELINE_DIR } from "../bakeoff/paths.js";
import { canonicalJson, sha256Hex, hashCanonical } from "../contracts/contractUtil.js";
import {
  FORBIDDEN_PROVIDER_ENV,
  assertChatgptSubscriptionAuth,
  resolveExecutionProfile,
} from "../exec/executionEnvelope.js";
import {
  assertFlagsSupported,
  qualifyCodexCli,
  type CodexCliQualificationV1,
} from "../exec/cliQualification.js";
import { writeFileAtomic } from "../lib/atomicWrite.js";
import {
  IMP24_BASE_MAXIMUM_CALLS,
  IMP24_HARD_MAXIMUM_CALLS,
  IMP24_ROLE_CANDIDATE_ORDER,
  IMP24_ROLE_QUALIFICATION_AVAILABILITY_SCHEMA,
  IMP24_ROLE_QUALIFICATION_RECEIPT_SCHEMA,
  IMP24_ROLE_QUALIFICATION_REQUEST_SCHEMA,
  buildRoleQualificationPlanV3,
  candidateAvailabilitySha256,
  qualificationReceiptSha256,
  qualificationRequestSha256,
  type CandidateAvailabilityV3,
  type QualificationExecutionReceiptV3,
  type QualificationExecutionRequestV3,
  type QualificationExecutorV3,
  type QualificationOutputEvaluatorV3,
  type QualificationReceiptStatusV3,
  type RunRoleQualificationInputV3,
} from "../bakeoff/migration/roleQualificationRunnerV3.js";
import { IMP24_ROLE_QUALIFICATION_ID, type Imp24ReviewRole } from "../bakeoff/migration/imp24Corpus.js";
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
import { findCodexBinary, spawnCodexAgent as hermeticCodexSpawn } from "./codexAgent.js";
import { ROUTE_POLICY_VERSION } from "./modelPolicy.js";

export const IMP24_LIVE_PREFLIGHT_SCHEMA = "imp24-role-qualification-live-preflight-v3" as const;
export const IMP24_LIVE_CALL_LEDGER_SCHEMA = "imp24-role-qualification-live-call-ledger-v3" as const;
export const IMP24_LIVE_ATTEMPT_RETENTION_SCHEMA = "imp24-role-qualification-live-attempt-retention-v3" as const;
export const IMP24_CANDIDATE_AVAILABILITY_POLICY_SCHEMA = "imp24-candidate-availability-policy-v1" as const;

const ROLES = ["reader", "source", "quiz"] as const satisfies readonly Imp24ReviewRole[];
const SHA256 = /^[a-f0-9]{64}$/;

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
  experimentId: typeof IMP24_ROLE_QUALIFICATION_ID;
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

export type LiveCallLedgerEntryV3 = {
  attemptId: string;
  scheduleId: string;
  requestSha256: string;
  evidenceEnvelopeSha256: string;
  evidenceEnvelopeBytesSha256: string;
  receiptSha256: string | null;
  status: "REQUESTED" | QualificationReceiptStatusV3;
  cached: boolean;
  requestedAt: string;
  completedAt: string | null;
};

export type LiveCallLedgerV3 = {
  schema: typeof IMP24_LIVE_CALL_LEDGER_SCHEMA;
  experimentId: typeof IMP24_ROLE_QUALIFICATION_ID;
  freezeSha256: string;
  certificationSha256: string;
  productionInstrumentSealSha256: string;
  entries: LiveCallLedgerEntryV3[];
  brokerRequests: number;
  codexExecInvocations: number;
  cachedReceipts: number;
  infrastructureReplays: number;
  apiCallsMade: 0;
};

export type LiveAttemptRetentionV3 = {
  schema: typeof IMP24_LIVE_ATTEMPT_RETENTION_SCHEMA;
  requestSha256: string;
  receiptSha256: string;
  evidenceEnvelopeSha256: string;
  evidenceEnvelopeBytesSha256: string;
  request: QualificationExecutionRequestV3;
  receipt: QualificationExecutionReceiptV3;
  retentionSha256: string;
};

export class ForwardRoleQualificationLiveV3Error extends Error {
  readonly classification = "policy_preflight_failure" as const;

  constructor(message: string) {
    super(message);
    this.name = "ForwardRoleQualificationLiveV3Error";
  }
}

function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new ForwardRoleQualificationLiveV3Error(message);
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
    experimentId: IMP24_ROLE_QUALIFICATION_ID,
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
    experimentId: IMP24_ROLE_QUALIFICATION_ID,
    verifiedAt: new Date(verifiedAt).toISOString(),
    freezeSha256: freeze.freezeSha256,
    certificationSha256: freeze.certificationSha256,
    productionInstrumentSealSha256: freeze.productionInstrumentSealSha256,
    corpusBundleSha256: freeze.corpusBundleSha256,
    candidateAvailabilitySha256: input.candidateAvailability.availabilitySha256,
    candidateAvailabilitySourceBytesSha256: input.candidateAvailability.sourceBytesSha256,
    cliVersion: cli.version,
    cliBinary: basename(cli.binPath || bin),
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

function emptyLedger(freezeSha256: string, certificationSha256: string, sealSha256: string): LiveCallLedgerV3 {
  return {
    schema: IMP24_LIVE_CALL_LEDGER_SCHEMA,
    experimentId: IMP24_ROLE_QUALIFICATION_ID,
    freezeSha256,
    certificationSha256,
    productionInstrumentSealSha256: sealSha256,
    entries: [],
    brokerRequests: 0,
    codexExecInvocations: 0,
    cachedReceipts: 0,
    infrastructureReplays: 0,
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

function validateCachedAttempt(args: {
  request: QualificationExecutionRequestV3;
  requestPath: string;
  receiptPath: string;
  envelopePath: string;
  retentionPath: string;
}): QualificationExecutionReceiptV3 {
  const retainedRequest = readJson<QualificationExecutionRequestV3>(args.requestPath);
  const retainedReceipt = readJson<QualificationExecutionReceiptV3>(args.receiptPath);
  const retainedEnvelopeBytes = readFileSync(args.envelopePath, "utf8");
  const retention = readJson<LiveAttemptRetentionV3>(args.retentionPath);
  const { requestSha256: retainedRequestSha256, ...retainedRequestCore } = retainedRequest;
  requireCondition(hashCanonical(retainedRequest) === hashCanonical(args.request),
    `attempt ${args.request.attemptId} request bytes/object changed on resume`);
  requireCondition(retainedRequestSha256 === args.request.requestSha256
    && qualificationRequestSha256(retainedRequestCore) === args.request.requestSha256,
  `attempt ${args.request.attemptId} request hash mismatch on resume`);
  requireCondition(retainedEnvelopeBytes === args.request.evidenceEnvelopeBytes,
    `attempt ${args.request.attemptId} exact evidence envelope bytes changed on resume`);
  requireCondition(sha256Hex(retainedEnvelopeBytes) === args.request.evidenceEnvelopeBytesSha256,
    `attempt ${args.request.attemptId} evidence envelope bytes hash mismatch on resume`);
  const { receiptSha256, ...receiptCore } = retainedReceipt;
  requireCondition(qualificationReceiptSha256(receiptCore) === receiptSha256,
    `attempt ${args.request.attemptId} receipt self hash mismatch on resume`);
  const { retentionSha256: retainedHash, ...retentionCore } = retention;
  requireCondition(retentionSha256(retentionCore) === retainedHash,
    `attempt ${args.request.attemptId} retention self hash mismatch on resume`);
  requireCondition(retention.requestSha256 === args.request.requestSha256
    && retention.receiptSha256 === receiptSha256
    && retention.evidenceEnvelopeSha256 === args.request.evidenceEnvelopeSha256
    && retention.evidenceEnvelopeBytesSha256 === args.request.evidenceEnvelopeBytesSha256
    && hashCanonical(retention.request) === hashCanonical(retainedRequest)
    && hashCanonical(retention.receipt) === hashCanonical(retainedReceipt),
  `attempt ${args.request.attemptId} retention bindings mismatch on resume`);
  return retainedReceipt;
}

export type LiveQualificationExecutorDepsV3 = {
  phaseDir: string;
  freezeSha256: string;
  certificationSha256: string;
  productionInstrumentSealSha256: string;
  repositoryRoot?: string;
  productionInstrumentSeal?: RunRoleQualificationInputV3["productionInstrumentSeal"];
  authJsonPath?: string;
  env?: NodeJS.ProcessEnv;
  /** Test-only seam. Production callers omit it and supply repositoryRoot,
   * productionInstrumentSeal, and ChatGPT auth for per-spawn revalidation. */
  preCallVerifier?: (request: QualificationExecutionRequestV3) => void;
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
): { executor: QualificationExecutorV3; ledger: LiveCallLedgerV3; ledgerPath: string } {
  requireSha(deps.freezeSha256, "live v3 freeze hash");
  requireSha(deps.certificationSha256, "live v3 certification hash");
  requireSha(deps.productionInstrumentSealSha256, "live v3 production seal hash");
  requireCondition(typeof deps.preCallVerifier === "function"
    || (typeof deps.repositoryRoot === "string" && deps.repositoryRoot.length > 0 && deps.productionInstrumentSeal !== undefined),
  "live v3 executor requires per-call production-seal/auth verification inputs");
  const phaseDir = resolve(deps.phaseDir);
  const ledgerPath = resolve(phaseDir, "call-ledger.json");
  const ledger = existsSync(ledgerPath)
    ? readJson<LiveCallLedgerV3>(ledgerPath)
    : emptyLedger(deps.freezeSha256, deps.certificationSha256, deps.productionInstrumentSealSha256);
  requireCondition(ledger.schema === IMP24_LIVE_CALL_LEDGER_SCHEMA
    && ledger.experimentId === IMP24_ROLE_QUALIFICATION_ID
    && ledger.freezeSha256 === deps.freezeSha256
    && ledger.certificationSha256 === deps.certificationSha256
    && ledger.productionInstrumentSealSha256 === deps.productionInstrumentSealSha256
    && ledger.apiCallsMade === 0,
  "retained live v3 call ledger belongs to different or unsafe inputs");
  mkdirSync(phaseDir, { recursive: true });
  if (!existsSync(ledgerPath)) writeJson(ledgerPath, ledger);

  const now = (): string => (deps.clock?.() ?? new Date()).toISOString();

  const verifyImmediatelyBeforeSpawn = (request: QualificationExecutionRequestV3): void => {
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

  const executor: QualificationExecutorV3 = async (request) => {
    requireCondition(request.schema === IMP24_ROLE_QUALIFICATION_REQUEST_SCHEMA
      && request.experimentId === IMP24_ROLE_QUALIFICATION_ID,
    "live v3 executor rejected wrong request schema/identity");
    requireCondition(request.freezeSha256 === deps.freezeSha256
      && request.certificationSha256 === deps.certificationSha256
      && request.productionInstrumentSealSha256 === deps.productionInstrumentSealSha256,
    "live v3 executor request binding differs from preflight");
    const { requestSha256, ...requestCore } = request;
    requireCondition(qualificationRequestSha256(requestCore) === requestSha256, "live v3 request self hash mismatch");
    requireCondition(request.reviewProtocol === "review-evidence-envelope-v1"
      && sha256Hex(request.evidenceEnvelopeBytes) === request.evidenceEnvelopeBytesSha256,
    "live v3 request does not retain exact evidence envelope bytes/hash");

    const attemptDir = resolve(phaseDir, "attempts", request.attemptId);
    const requestPath = resolve(attemptDir, "request.json");
    const receiptPath = resolve(attemptDir, "receipt.json");
    const envelopePath = resolve(attemptDir, "evidence-envelope.json");
    const retentionPath = resolve(attemptDir, "retention.json");
    const present = [requestPath, receiptPath, envelopePath, retentionPath].map(existsSync);
    if (present.some(Boolean)) {
      requireCondition(present.every(Boolean),
        `attempt ${request.attemptId} is partial; refuse replay because a valid prior judgment cannot be ruled out`);
      const cached = validateCachedAttempt({ request, requestPath, receiptPath, envelopePath, retentionPath });
      const ledgerEntry = ledger.entries.find((entry) => entry.attemptId === request.attemptId);
      requireCondition(ledgerEntry?.requestSha256 === request.requestSha256
        && ledgerEntry.receiptSha256 === cached.receiptSha256
        && ledgerEntry.status === cached.status,
      `attempt ${request.attemptId} call ledger differs from retained receipt`);
      // Cache accounting is retained per unique attempt, not per resume
      // traversal. Repeated crash recovery therefore has stable call counts
      // and cannot make the ledger/report drift merely by validating the same
      // completed receipt again.
      ledgerEntry.cached = true;
      ledger.cachedReceipts = ledger.entries.filter((candidate) => candidate.cached).length;
      writeJson(ledgerPath, ledger);
      return cached;
    }

    writeJson(requestPath, request);
    writeFileAtomic(envelopePath, request.evidenceEnvelopeBytes);
    const entry: LiveCallLedgerEntryV3 = {
      attemptId: request.attemptId,
      scheduleId: request.scheduleId,
      requestSha256: request.requestSha256,
      evidenceEnvelopeSha256: request.evidenceEnvelopeSha256,
      evidenceEnvelopeBytesSha256: request.evidenceEnvelopeBytesSha256,
      receiptSha256: null,
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
    let brokerReachedSpawn = false;
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
          // This is the actual spawn seam. Revalidate mutable external state
          // immediately before it, then count only a real broker invocation.
          verifyImmediatelyBeforeSpawn(request);
          brokerReachedSpawn = true;
          ledger.codexExecInvocations += 1;
          writeJson(ledgerPath, ledger);
          return (deps.spawn ?? hermeticCodexSpawn)(options);
        },
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
      const status = statusFor(error);
      receiptCore = {
        schema: IMP24_ROLE_QUALIFICATION_RECEIPT_SCHEMA,
        executionId: `${brokerReachedSpawn ? "failed-exec" : "preflight"}-${request.attemptId}`,
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
        rawOutput: null,
        failureDetail: (error as Error).message.slice(0, 2_000),
      };
    }
    const receipt: QualificationExecutionReceiptV3 = {
      ...receiptCore,
      receiptSha256: qualificationReceiptSha256(receiptCore),
    };
    writeJson(receiptPath, receipt);
    const retentionCore: Omit<LiveAttemptRetentionV3, "retentionSha256"> = {
      schema: IMP24_LIVE_ATTEMPT_RETENTION_SCHEMA,
      requestSha256: request.requestSha256,
      receiptSha256: receipt.receiptSha256,
      evidenceEnvelopeSha256: request.evidenceEnvelopeSha256,
      evidenceEnvelopeBytesSha256: request.evidenceEnvelopeBytesSha256,
      request,
      receipt,
    };
    writeJson(retentionPath, { ...retentionCore, retentionSha256: retentionSha256(retentionCore) });
    entry.receiptSha256 = receipt.receiptSha256;
    entry.status = receipt.status;
    entry.completedAt = now();
    writeJson(ledgerPath, ledger);
    return receipt;
  };
  return { executor, ledger, ledgerPath };
}
