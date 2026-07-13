/**
 * IMP-22 live role-qualification boundary.
 *
 * This is the only adapter that turns the model-free qualification runner into
 * ChatGPT-authenticated `codex exec` work.  It re-verifies the committed freeze
 * before each phase, uses the same hermetic reviewer executor as the forward
 * chapter conductor, and persists every request/receipt immediately.  A resumed
 * phase reuses an exact request-hash match; it never spends an output-informed
 * bonus call.
 */

import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, resolve } from "node:path";

import { PIPELINE_DIR } from "../bakeoff/paths.js";
import { hashCanonical, sha256Hex } from "../contracts/contractUtil.js";
import type { EffortLevelV1 } from "../contracts/executionProfile.js";
import { writeFileAtomic } from "../lib/atomicWrite.js";
import {
  FORBIDDEN_PROVIDER_ENV,
  assertChatgptSubscriptionAuth,
  defaultManifestSink,
  resolveExecutionProfile,
} from "../exec/executionEnvelope.js";
import { assertFlagsSupported, qualifyCodexCli } from "../exec/cliQualification.js";
import { findCodexBinary, spawnCodexAgent } from "./codexAgent.js";
import {
  DEFAULT_FORWARD_REVIEWER_SCHEMA_MAP,
  ForwardReviewerExecutorError,
  createForwardReviewerExecutor,
  type ForwardReviewerSpawn,
} from "./forwardReviewerExecutor.js";
import {
  FORWARD_REVIEW_EXECUTION_REQUEST_SCHEMA,
  type ForwardReviewExecutionRequestV1,
  type ForwardReviewerWorkspaceRole,
} from "./forwardChapterConductor.js";
import { ROUTE_POLICY_VERSION } from "./modelPolicy.js";
import {
  READER_EXPERIENCE_RUBRIC_VERSION,
} from "../review/readerExperienceReview.js";
import {
  SOURCE_INTEGRITY_RUBRIC_VERSION,
} from "../review/sourceIntegrityReview.js";
import {
  QUIZ_INTEGRITY_ADJUDICATION_SCHEMA,
} from "../review/quizIntegrityReview.js";
import type { RecoveryRoleThresholdsV1, ReviewLaneRole } from "../bakeoff/migration/reviewLaneTypes.js";
import {
  DEFAULT_IMP22_ROLE_CANDIDATE_ORDER,
  ROLE_QUALIFICATION_RECEIPT_SCHEMA,
  assembleRoleQualificationCalibrationInspection,
  assertRoleQualificationCalibrationInspection,
  roleQualificationCandidateAvailabilityHash,
  runRoleCalibration,
  runRoleQualificationHoldout,
  type QualificationProfileV1,
  type QualificationReceiptStatus,
  type RoleQualificationCalibrationSealV1,
  type RoleQualificationCalibrationInspectionV1,
  type RoleQualificationCandidateAvailabilityV1,
  type RoleQualificationCorporaV2,
  type RoleQualificationExecutionReceiptV1,
  type RoleQualificationExecutionRequestV1,
  type RoleQualificationRunnerResultV1,
  type RunRoleQualificationInputV1,
} from "../bakeoff/migration/roleQualificationRunner.js";

export const IMP22_ROLE_QUALIFICATION_LIVE_PREFLIGHT_SCHEMA = "imp22-role-qualification-live-preflight-v1" as const;
export const IMP22_ROLE_QUALIFICATION_CALL_LEDGER_SCHEMA = "imp22-role-qualification-call-ledger-v1" as const;
export const IMP22_ROLE_QUALIFICATION_REQUEST_RECORD_SCHEMA = "imp22-role-qualification-request-record-v1" as const;

export const IMP22_ROLE_QUALIFICATION_EXPERIMENT_ID = "s16-forward-role-qualification-v1" as const;
export const IMP23_CORRECTED_ROLE_QUALIFICATION_EXPERIMENT_ID = "s16-forward-role-qualification-v2" as const;
const ALLOWED_EXPERIMENT_IDS = new Set<string>([
  IMP22_ROLE_QUALIFICATION_EXPERIMENT_ID,
  IMP23_CORRECTED_ROLE_QUALIFICATION_EXPERIMENT_ID,
]);
const SPEC_REL = `state/migration-experiments/${IMP22_ROLE_QUALIFICATION_EXPERIMENT_ID}/spec.json`;
const DEFAULT_EXPERIMENT_DIR = resolve(PIPELINE_DIR, "state", "migration-experiments", IMP22_ROLE_QUALIFICATION_EXPERIMENT_ID);
const ROLES: readonly ReviewLaneRole[] = ["reader", "source", "quiz"];
const SHA256 = /^[a-f0-9]{64}$/;

type FrozenFileRef = {
  path: string;
  bytesSha256: string;
  substantiveSha256?: string;
  calibrationCases?: number;
  holdoutCases?: number;
};

type CandidateSpec = QualificationProfileV1 & { availability?: string };

type Imp22QualificationSpec = {
  schema: "imp22-role-qualification-spec-v1";
  experimentId: string;
  status: string;
  executionRoute: {
    provider: string;
    authMode: string;
    apiAllowed: boolean;
    apiFallbackAllowed: boolean;
    directHttpOrSdkAllowed: boolean;
    executionProfileHash: string;
    routePolicyVersion: string;
  };
  candidateOrder: Record<ReviewLaneRole, CandidateSpec[]>;
  candidateAvailability: FrozenFileRef;
  corpora: Record<ReviewLaneRole, FrozenFileRef>;
  thresholds: FrozenFileRef;
  instruments: Record<ReviewLaneRole, {
    outputSchemaPath: string;
    outputSchemaBytesSha256: string;
    promptSourcePath: string;
    promptSourceBytesSha256: string;
  }> & Record<string, unknown>;
  schedule: { maxParallel: number };
  callBudget: {
    calibration: { expectedCalls: number; maximumCallsBeforeInfrastructureReplays: number; maximumInfrastructureReplays: number };
    qualification: { expectedCalls: number; maximumCallsBeforeInfrastructureReplays: number; maximumInfrastructureReplays: number };
    total: { expectedCalls: number; hardMaximumCalls: number };
    maximumIsNotATarget: boolean;
    outputInformedBonusCalls: boolean;
  };
};

export type CandidateAvailabilityPolicyV1 = {
  schema: "imp22-candidate-availability-policy-v1";
  source: "codex-local-models-cache";
  sourceFile: "models_cache.json";
  maximumCacheAgeSeconds: number;
  maximumFutureSkewSeconds: number;
  requiredVisibility: "list";
  requireExactModelSlug: true;
  requireReasoningEffortSupport: true;
  requireAtLeastOneAvailablePerRole: true;
  skipUnavailableWithoutReordering: true;
  candidateReorderingAllowed: false;
  networkCalls: 0;
  modelCalls: 0;
  apiCalls: 0;
};

type LocalCodexModelCacheV1 = {
  fetched_at: string;
  models: Array<{
    slug: string;
    visibility?: string;
    supported_reasoning_levels?: Array<{ effort?: string }>;
  }>;
};

export type LiveQualificationPreflightV1 = {
  schema: typeof IMP22_ROLE_QUALIFICATION_LIVE_PREFLIGHT_SCHEMA;
  experimentId: string;
  verifiedAt: string;
  specRelPath: string;
  specBytesSha256: string;
  corpusBytesSha256: Record<ReviewLaneRole, string>;
  corpusSubstantiveSha256: Record<ReviewLaneRole, string>;
  thresholdBytesSha256: string;
  schemaBytesSha256: Record<ReviewLaneRole, string>;
  promptSourceBytesSha256: Record<ReviewLaneRole, string>;
  candidateAvailabilityPolicyBytesSha256: string;
  candidateAvailabilitySha256: string;
  candidateAvailabilitySourceBytesSha256: string;
  candidateAvailabilitySourceFetchedAt: string;
  executionProfileHash: string;
  routePolicyVersion: string;
  cliVersion: string;
  cliBinary: string;
  authMode: "chatgpt";
  apiKeyPresent: false;
  apiFallbackAllowed: false;
  forbiddenProviderEnvKeysPresent: [];
  maxParallel: 2;
  expectedCalibrationCalls: 24;
  expectedQualificationCalls: 180;
  hardMaximumCalls: 928;
};

export type LiveQualificationCallEntryV1 = {
  attemptId: string;
  scheduleId: string;
  role: ReviewLaneRole;
  partition: "calibration" | "holdout";
  caseId: string;
  profileId: string;
  attemptNumber: 1 | 2;
  requestSha256: string;
  receiptSha256: string;
  status: QualificationReceiptStatus;
  executionId: string;
  cached: boolean;
  recordedAt: string;
};

export type LiveQualificationCallLedgerV1 = {
  schema: typeof IMP22_ROLE_QUALIFICATION_CALL_LEDGER_SCHEMA;
  experimentId: string;
  phase: "calibration" | "holdout";
  specBytesSha256: string;
  entries: LiveQualificationCallEntryV1[];
  codexExecInvocations: number;
  cachedReceipts: number;
  infrastructureReplays: number;
  maxPlanCapacityEvents: number;
  safeguardsOrRefusals: number;
  apiCallsMade: 0;
};

export type LoadedLiveQualificationV1 = {
  spec: Imp22QualificationSpec;
  specBytesSha256: string;
  input: RunRoleQualificationInputV1;
  candidateAvailability: RoleQualificationCandidateAvailabilityV1;
  preflight: LiveQualificationPreflightV1;
};

export type LiveCalibrationResultV1 = {
  calibration: RoleQualificationCalibrationSealV1;
  callLedger: LiveQualificationCallLedgerV1;
  preflight: LiveQualificationPreflightV1;
};

export type LiveHoldoutResultV1 = {
  result: RoleQualificationRunnerResultV1;
  callLedger: LiveQualificationCallLedgerV1;
  preflight: LiveQualificationPreflightV1;
};

export type LiveCalibrationInspectionResultV1 = {
  inspection: RoleQualificationCalibrationInspectionV1;
  path: string;
};

export class LiveRoleQualificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LiveRoleQualificationError";
  }
}

function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new LiveRoleQualificationError(message);
}

function stripShaPrefix(value: string): string {
  return value.startsWith("sha256:") ? value.slice("sha256:".length) : value;
}

function requireSha(value: unknown, label: string): string {
  requireCondition(typeof value === "string" && SHA256.test(stripShaPrefix(value)), `${label} must be a lowercase sha256`);
  return stripShaPrefix(value);
}

function resolveFrozenPath(relPath: string, label: string): string {
  requireCondition(typeof relPath === "string" && relPath.length > 0 && !relPath.startsWith("/"), `${label} must be pipeline-relative`);
  const abs = resolve(PIPELINE_DIR, relPath);
  requireCondition(abs.startsWith(`${PIPELINE_DIR}/`), `${label} escapes the pipeline root`);
  requireCondition(existsSync(abs), `${label} is missing: ${relPath}`);
  return abs;
}

function readFrozenBytes(ref: FrozenFileRef, label: string): { abs: string; bytes: Buffer; parsed: unknown; bytesSha256: string } {
  const abs = resolveFrozenPath(ref.path, label);
  const bytes = readFileSync(abs);
  const bytesSha256 = sha256Hex(bytes);
  requireCondition(bytesSha256 === requireSha(ref.bytesSha256, `${label}.bytesSha256`), `${label} byte hash drift (${ref.bytesSha256} != ${bytesSha256})`);
  let parsed: unknown;
  try { parsed = JSON.parse(bytes.toString("utf8")); }
  catch (error) { throw new LiveRoleQualificationError(`${label} is not JSON: ${(error as Error).message}`); }
  return { abs, bytes, parsed, bytesSha256 };
}

function loadSpec(specPath: string): { spec: Imp22QualificationSpec; bytesSha256: string; experimentId: string; specRelPath: string } {
  requireCondition(existsSync(specPath), `qualification spec missing: ${specPath}`);
  const bytes = readFileSync(specPath);
  let spec: Imp22QualificationSpec;
  try { spec = JSON.parse(bytes.toString("utf8")) as Imp22QualificationSpec; }
  catch (error) { throw new LiveRoleQualificationError(`qualification spec is not JSON: ${(error as Error).message}`); }
  requireCondition(spec.schema === "imp22-role-qualification-spec-v1", "qualification spec schema mismatch");
  const experimentId = basename(dirname(specPath));
  requireCondition(ALLOWED_EXPERIMENT_IDS.has(experimentId), `qualification experiment identity is not approved: ${experimentId}`);
  requireCondition(spec.experimentId === experimentId, `qualification spec experiment must match its directory identity ${experimentId}`);
  requireCondition(spec.status === "FROZEN_PRE_CALIBRATION", "qualification spec is not frozen pre-calibration");
  return {
    spec,
    bytesSha256: sha256Hex(bytes),
    experimentId,
    specRelPath: `state/migration-experiments/${experimentId}/spec.json`,
  };
}

function exactCandidateOrder(spec: Imp22QualificationSpec): Record<ReviewLaneRole, readonly QualificationProfileV1[]> {
  const order = {} as Record<ReviewLaneRole, readonly QualificationProfileV1[]>;
  for (const role of ROLES) {
    const candidates = spec.candidateOrder?.[role];
    requireCondition(Array.isArray(candidates), `candidate order missing ${role}`);
    requireCondition(
      candidates.every((candidate) => candidate.availability === "LOCAL_CACHE_DISCOVERY_REQUIRED"),
      `${role} candidate availability must use the frozen local-cache discovery contract`,
    );
    order[role] = candidates.map((candidate) => ({
      profileId: candidate.profileId,
      model: candidate.model,
      effort: candidate.effort as EffortLevelV1,
    }));
  }
  requireCondition(
    hashCanonical(order) === hashCanonical(DEFAULT_IMP22_ROLE_CANDIDATE_ORDER),
    "candidate order differs from the frozen IMP-22 role-specific order",
  );
  return order;
}

function validateAvailabilityPolicy(policy: CandidateAvailabilityPolicyV1): void {
  requireCondition(policy?.schema === "imp22-candidate-availability-policy-v1", "candidate availability policy schema mismatch");
  requireCondition(policy.source === "codex-local-models-cache", "candidate availability source must remain the local Codex model cache");
  requireCondition(policy.sourceFile === "models_cache.json", "candidate availability source filename drift");
  requireCondition(Number.isInteger(policy.maximumCacheAgeSeconds) && policy.maximumCacheAgeSeconds > 0, "candidate availability cache age limit is invalid");
  requireCondition(Number.isInteger(policy.maximumFutureSkewSeconds) && policy.maximumFutureSkewSeconds >= 0, "candidate availability future-skew limit is invalid");
  requireCondition(policy.requiredVisibility === "list", "candidate visibility policy must remain list");
  requireCondition(policy.requireExactModelSlug === true, "candidate availability must require exact model slugs");
  requireCondition(policy.requireReasoningEffortSupport === true, "candidate availability must require exact reasoning-effort support");
  requireCondition(policy.requireAtLeastOneAvailablePerRole === true, "candidate availability must require one executable candidate per role");
  requireCondition(policy.skipUnavailableWithoutReordering === true, "candidate availability must skip unavailable profiles without reordering");
  requireCondition(policy.candidateReorderingAllowed === false, "candidate availability cannot permit reordering");
  requireCondition(policy.networkCalls === 0 && policy.modelCalls === 0 && policy.apiCalls === 0, "candidate availability discovery must remain zero-call");
}

/** Discover advertised model/effort availability from the local Codex cache.
 * This function performs only filesystem reads: no CLI spawn, network, model,
 * or API call is used. */
export function discoverRoleQualificationCandidateAvailability(args: {
  candidateOrder: Record<ReviewLaneRole, readonly QualificationProfileV1[]>;
  policy: CandidateAvailabilityPolicyV1;
  policyBytesSha256: string;
  modelsCachePath: string;
  verifiedAt: string;
}): RoleQualificationCandidateAvailabilityV1 {
  validateAvailabilityPolicy(args.policy);
  requireCondition(existsSync(args.modelsCachePath), `candidate availability cache is missing: ${basename(args.modelsCachePath)}`);
  const sourceBytes = readFileSync(args.modelsCachePath);
  let cache: LocalCodexModelCacheV1;
  try { cache = JSON.parse(sourceBytes.toString("utf8")) as LocalCodexModelCacheV1; }
  catch (error) { throw new LiveRoleQualificationError(`candidate availability cache is not JSON: ${(error as Error).message}`); }
  requireCondition(Array.isArray(cache.models), "candidate availability cache has no model inventory");
  const fetchedMs = Date.parse(cache.fetched_at);
  const verifiedMs = Date.parse(args.verifiedAt);
  requireCondition(Number.isFinite(fetchedMs), "candidate availability cache fetched_at is invalid");
  requireCondition(Number.isFinite(verifiedMs), "candidate availability verifiedAt is invalid");
  const ageSeconds = (verifiedMs - fetchedMs) / 1_000;
  requireCondition(ageSeconds <= args.policy.maximumCacheAgeSeconds, `candidate availability cache is stale (${Math.floor(ageSeconds)}s old)`);
  requireCondition(ageSeconds >= -args.policy.maximumFutureSkewSeconds, `candidate availability cache timestamp is ${Math.ceil(-ageSeconds)}s in the future`);

  const bySlug = new Map<string, LocalCodexModelCacheV1["models"]>();
  for (const model of cache.models) {
    requireCondition(typeof model?.slug === "string" && model.slug.length > 0, "candidate availability cache contains a model without a slug");
    const group = bySlug.get(model.slug) ?? [];
    group.push(model);
    bySlug.set(model.slug, group);
  }

  const discovered = ROLES.flatMap((role) => args.candidateOrder[role].map((profile, ordinal) => {
    const matches = bySlug.get(profile.model) ?? [];
    requireCondition(matches.length <= 1, `candidate availability cache has duplicate exact slug ${profile.model}`);
    const model = matches[0];
    const modelListed = model !== undefined;
    const visible = model?.visibility === args.policy.requiredVisibility;
    const effortSupported = model?.supported_reasoning_levels?.some((level) => level.effort === profile.effort) === true;
    const status = modelListed && visible && effortSupported ? "AVAILABLE" as const : "UNAVAILABLE" as const;
    const reason = !modelListed
      ? "exact model slug is absent from the local Codex cache"
      : !visible
        ? `model visibility is ${String(model.visibility ?? "missing")}, expected ${args.policy.requiredVisibility}`
        : !effortSupported
          ? `reasoning effort ${profile.effort} is not advertised by the local Codex cache`
          : "exact visible model and reasoning effort are advertised by the local Codex cache";
    return {
      role,
      ordinal,
      profileId: profile.profileId,
      model: profile.model,
      effort: profile.effort,
      status,
      modelListed,
      visible,
      effortSupported,
      requiredForCalibration: false,
      reason,
    };
  }));
  const calibrationOrdinal = Object.fromEntries(ROLES.map((role) => [
    role,
    discovered.find((entry) => entry.role === role && entry.status === "AVAILABLE")?.ordinal ?? null,
  ])) as Record<ReviewLaneRole, number | null>;
  const entries = discovered.map((entry) => ({
    ...entry,
    requiredForCalibration: calibrationOrdinal[entry.role] === entry.ordinal,
  }));
  const calibrationCandidatesAvailable = ROLES.every((role) => calibrationOrdinal[role] !== null);
  const draft: Omit<RoleQualificationCandidateAvailabilityV1, "availabilitySha256"> = {
    schema: "imp22-role-candidate-availability-v1",
    source: "codex-local-models-cache",
    sourceFile: "models_cache.json",
    sourceBytesSha256: sha256Hex(sourceBytes),
    sourceFetchedAt: new Date(fetchedMs).toISOString(),
    policyBytesSha256: requireSha(args.policyBytesSha256, "candidate availability policy hash"),
    candidateOrderSha256: hashCanonical(args.candidateOrder),
    entries,
    calibrationCandidatesAvailable,
  };
  const availability = Object.freeze({
    ...draft,
    availabilitySha256: roleQualificationCandidateAvailabilityHash(draft),
  });
  requireCondition(
    calibrationCandidatesAvailable,
    `calibration blocked by candidate availability: no advertised profile remains for ${ROLES.filter((role) => calibrationOrdinal[role] === null).join(", ")}`,
  );
  return availability;
}

function verifyCallBudget(spec: Imp22QualificationSpec): void {
  requireCondition(spec.schedule?.maxParallel === 2, "qualification maxParallel must remain 2");
  requireCondition(spec.callBudget?.calibration?.expectedCalls === 24, "calibration expected calls must remain 24");
  requireCondition(spec.callBudget.calibration.maximumCallsBeforeInfrastructureReplays === 24, "calibration base maximum must remain 24");
  requireCondition(spec.callBudget.calibration.maximumInfrastructureReplays === 24, "calibration permits at most one infrastructure replay per call");
  requireCondition(spec.callBudget?.qualification?.expectedCalls === 180, "qualification expected calls must remain 180");
  requireCondition(spec.callBudget.qualification.maximumCallsBeforeInfrastructureReplays === 440, "qualification base maximum must remain 440");
  requireCondition(spec.callBudget.qualification.maximumInfrastructureReplays === 440, "qualification permits at most one infrastructure replay per call");
  requireCondition(spec.callBudget?.total?.expectedCalls === 204, "total expected calls must remain 204");
  requireCondition(spec.callBudget.total.hardMaximumCalls === 928, "total hard maximum must remain 928");
  requireCondition(spec.callBudget.maximumIsNotATarget === true, "maximumIsNotATarget must remain true");
  requireCondition(spec.callBudget.outputInformedBonusCalls === false, "output-informed bonus calls must remain disabled");
}

function corpusCounts(role: ReviewLaneRole, corpus: RoleQualificationCorporaV2[ReviewLaneRole]): void {
  const expected = role === "reader" ? [6, 30] : role === "source" ? [10, 40] : [8, 40];
  requireCondition(corpus.partitions.calibration.cases.length === expected[0], `${role} calibration count drift`);
  requireCondition(corpus.partitions.holdout.cases.length === expected[1], `${role} holdout count drift`);
}

export async function loadAndPreflightLiveQualification(opts: {
  specPath?: string;
  verifiedAt?: string;
  modelsCachePath?: string;
  qualificationCacheDir?: string;
} = {}): Promise<LoadedLiveQualificationV1> {
  const verifiedAt = opts.verifiedAt ?? new Date().toISOString();
  const specPath = opts.specPath ?? resolve(PIPELINE_DIR, SPEC_REL);
  const { spec, bytesSha256: specBytesSha256, experimentId, specRelPath } = loadSpec(specPath);
  verifyCallBudget(spec);

  requireCondition(spec.executionRoute?.provider === "codex exec", "execution provider must be codex exec");
  requireCondition(spec.executionRoute.authMode === "chatgpt", "execution auth mode must be chatgpt");
  requireCondition(spec.executionRoute.apiAllowed === false, "API execution must remain disabled");
  requireCondition(spec.executionRoute.apiFallbackAllowed === false, "API fallback must remain disabled");
  requireCondition(spec.executionRoute.directHttpOrSdkAllowed === false, "direct HTTP/SDK execution must remain disabled");

  const forbiddenProviderEnvKeysPresent = FORBIDDEN_PROVIDER_ENV.filter((key) => {
    const value = process.env[key];
    return typeof value === "string" && value.length > 0;
  });
  requireCondition(
    forbiddenProviderEnvKeysPresent.length === 0,
    `live qualification parent process carries prohibited provider env key(s): ${forbiddenProviderEnvKeysPresent.join(", ")}; unset them before running`,
  );

  const profile = resolveExecutionProfile("chapter-reviewer");
  requireCondition(profile.profileHash === spec.executionRoute.executionProfileHash, "chapter-reviewer execution profile hash drift");
  requireCondition(spec.executionRoute.routePolicyVersion === ROUTE_POLICY_VERSION, "route policy version drift");

  const authDir = process.env.CODEX_HOME ?? resolve(homedir(), ".codex");
  const authProof = assertChatgptSubscriptionAuth(resolve(authDir, "auth.json"));
  const bin = findCodexBinary();
  const cli = await qualifyCodexCli({ bin, cacheDir: opts.qualificationCacheDir ?? defaultManifestSink() });
  assertFlagsSupported(cli, [...profile.profile.requiredCliFlags, "--skip-git-repo-check", "--output-schema"]);

  const corpora = {} as RoleQualificationCorporaV2;
  const corpusBytesSha256 = {} as Record<ReviewLaneRole, string>;
  const corpusSubstantiveSha256 = {} as Record<ReviewLaneRole, string>;
  const schemaHashes = {} as Record<ReviewLaneRole, string>;
  const promptHashes = {} as Record<ReviewLaneRole, string>;

  for (const role of ROLES) {
    const ref = spec.corpora?.[role];
    requireCondition(ref !== undefined, `qualification spec missing ${role} corpus ref`);
    const frozen = readFrozenBytes(ref, `${role} corpus`);
    const corpus = frozen.parsed as RoleQualificationCorporaV2[ReviewLaneRole];
    requireCondition(corpus.role === role, `${role} corpus role mismatch`);
    requireCondition(
      corpus.substantiveCorpusSha256 === ref.substantiveSha256,
      `${role} substantive corpus hash drift (${String(ref.substantiveSha256)} != ${String(corpus.substantiveCorpusSha256)})`,
    );
    corpusCounts(role, corpus);
    (corpora as unknown as Record<ReviewLaneRole, RoleQualificationCorporaV2[ReviewLaneRole]>)[role] = corpus;
    corpusBytesSha256[role] = frozen.bytesSha256;
    corpusSubstantiveSha256[role] = corpus.substantiveCorpusSha256;

    const instrument = spec.instruments?.[role];
    requireCondition(instrument !== undefined, `qualification spec missing ${role} instrument`);
    const schemaAbs = resolveFrozenPath(instrument.outputSchemaPath, `${role} output schema`);
    const schemaSha = sha256Hex(readFileSync(schemaAbs));
    requireCondition(schemaSha === requireSha(instrument.outputSchemaBytesSha256, `${role} schema hash`), `${role} output schema hash drift`);
    requireCondition(resolve(DEFAULT_FORWARD_REVIEWER_SCHEMA_MAP[role]) === schemaAbs, `${role} schema path differs from the enforced reviewer map`);
    schemaHashes[role] = schemaSha;

    const promptAbs = resolveFrozenPath(instrument.promptSourcePath, `${role} prompt source`);
    const promptSha = sha256Hex(readFileSync(promptAbs));
    requireCondition(promptSha === requireSha(instrument.promptSourceBytesSha256, `${role} prompt source hash`), `${role} prompt source hash drift`);
    promptHashes[role] = promptSha;
  }

  for (const key of ["qualificationScorer", "reviewerExecutor", "liveBoundary"] as const) {
    const binding = (spec.instruments as Record<string, unknown>)[key] as {
      sourcePath?: unknown;
      sourceBytesSha256?: unknown;
    } | undefined;
    requireCondition(binding !== undefined, `qualification spec missing ${key} source binding`);
    requireCondition(typeof binding.sourcePath === "string", `${key}.sourcePath is missing`);
    const abs = resolveFrozenPath(binding.sourcePath, `${key} source`);
    const actual = sha256Hex(readFileSync(abs));
    requireCondition(
      actual === requireSha(binding.sourceBytesSha256, `${key}.sourceBytesSha256`),
      `${key} source hash drift`,
    );
  }

  const thresholdFrozen = readFrozenBytes(spec.thresholds, "qualification thresholds");
  const thresholds = thresholdFrozen.parsed as RecoveryRoleThresholdsV1;
  const candidateOrder = exactCandidateOrder(spec);
  requireCondition(spec.candidateAvailability !== undefined, "qualification spec missing candidate availability policy ref");
  const availabilityPolicyFrozen = readFrozenBytes(spec.candidateAvailability, "candidate availability policy");
  const availabilityPolicy = availabilityPolicyFrozen.parsed as CandidateAvailabilityPolicyV1;
  const candidateAvailability = discoverRoleQualificationCandidateAvailability({
    candidateOrder,
    policy: availabilityPolicy,
    policyBytesSha256: availabilityPolicyFrozen.bytesSha256,
    modelsCachePath: opts.modelsCachePath ?? resolve(authDir, availabilityPolicy.sourceFile ?? "models_cache.json"),
    verifiedAt,
  });

  const preflight: LiveQualificationPreflightV1 = {
    schema: IMP22_ROLE_QUALIFICATION_LIVE_PREFLIGHT_SCHEMA,
    experimentId,
    verifiedAt,
    specRelPath,
    specBytesSha256,
    corpusBytesSha256,
    corpusSubstantiveSha256,
    thresholdBytesSha256: thresholdFrozen.bytesSha256,
    schemaBytesSha256: schemaHashes,
    promptSourceBytesSha256: promptHashes,
    candidateAvailabilityPolicyBytesSha256: availabilityPolicyFrozen.bytesSha256,
    candidateAvailabilitySha256: candidateAvailability.availabilitySha256,
    candidateAvailabilitySourceBytesSha256: candidateAvailability.sourceBytesSha256,
    candidateAvailabilitySourceFetchedAt: candidateAvailability.sourceFetchedAt,
    executionProfileHash: profile.profileHash,
    routePolicyVersion: ROUTE_POLICY_VERSION,
    cliVersion: cli.version,
    cliBinary: basename(cli.binPath || bin),
    authMode: authProof.authMode,
    apiKeyPresent: authProof.apiKeyPresent,
    apiFallbackAllowed: false,
    forbiddenProviderEnvKeysPresent: [],
    maxParallel: 2,
    expectedCalibrationCalls: 24,
    expectedQualificationCalls: 180,
    hardMaximumCalls: 928,
  };

  return {
    spec,
    specBytesSha256,
    input: { corpora, candidateOrder, thresholds, schemaHashes },
    candidateAvailability,
    preflight,
  };
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileAtomic(path, `${JSON.stringify(value, null, 2)}\n`);
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function emptyLedger(phase: "calibration" | "holdout", specBytesSha256: string, experimentId: string): LiveQualificationCallLedgerV1 {
  return {
    schema: IMP22_ROLE_QUALIFICATION_CALL_LEDGER_SCHEMA,
    experimentId,
    phase,
    specBytesSha256,
    entries: [],
    codexExecInvocations: 0,
    cachedReceipts: 0,
    infrastructureReplays: 0,
    maxPlanCapacityEvents: 0,
    safeguardsOrRefusals: 0,
    apiCallsMade: 0,
  };
}

function statusFor(error: unknown): QualificationReceiptStatus {
  if (error instanceof ForwardReviewerExecutorError) {
    if (error.code === "policy_preflight_failure") return "policy_failure";
    return error.code;
  }
  const classification = (error as { classification?: unknown } | null)?.classification;
  if (classification === "policy_preflight_failure") return "policy_failure";
  return "integrity_failure";
}

function instrumentVersion(role: ReviewLaneRole): string {
  if (role === "reader") return READER_EXPERIENCE_RUBRIC_VERSION;
  if (role === "source") return SOURCE_INTEGRITY_RUBRIC_VERSION;
  return QUIZ_INTEGRITY_ADJUDICATION_SCHEMA;
}

function workspaceRole(role: ReviewLaneRole): ForwardReviewerWorkspaceRole {
  if (role === "reader") return "direct-reader";
  if (role === "source") return "source-verifier";
  return "quiz-adjudication";
}

function requestRecord(request: RoleQualificationExecutionRequestV1, requestSha256: string): object {
  return {
    schema: IMP22_ROLE_QUALIFICATION_REQUEST_RECORD_SCHEMA,
    requestSha256,
    request: {
      ...request,
      task: { sha256: sha256Hex(request.task), bytes: Buffer.byteLength(request.task) },
      artifacts: request.artifacts.map((artifact) => ({
        kind: artifact.kind,
        relPath: artifact.relPath,
        sha256: artifact.sha256,
        bytes: Buffer.byteLength(artifact.content),
      })),
    },
  };
}

export function createLiveQualificationExecutor(args: {
  phase: "calibration" | "holdout";
  specBytesSha256: string;
  experimentId?: string;
  phaseDir: string;
  timeoutMs?: number;
  /** Test-only seam. Production callers omit this and always reach the real
   * ChatGPT-authenticated spawn broker after live preflight. */
  spawn?: ForwardReviewerSpawn;
}): { executor: (request: RoleQualificationExecutionRequestV1) => Promise<RoleQualificationExecutionReceiptV1>; ledger: LiveQualificationCallLedgerV1 } {
  const phaseDir = resolve(args.phaseDir);
  const ledgerPath = resolve(phaseDir, "call-ledger.json");
  // Qualification is an experiment, so its broker evidence and transient
  // execution state must never bleed into the pipeline-wide logs/exec sink or
  // reuse its CLI-qualification cache. Keep every spawn-owned path under the
  // retained phase root. Other spawnCodexAgent callers retain normal defaults.
  const liveExecRoot = resolve(phaseDir, "exec");
  const manifestSink = resolve(liveExecRoot, "logs");
  const execBaseDir = resolve(liveExecRoot, "sessions");
  const qualificationCacheDir = resolve(liveExecRoot, "cli-qualification-cache");
  const ledger = existsSync(ledgerPath)
    ? readJson<LiveQualificationCallLedgerV1>(ledgerPath)
    : emptyLedger(args.phase, args.specBytesSha256, args.experimentId ?? IMP22_ROLE_QUALIFICATION_EXPERIMENT_ID);
  requireCondition(ledger.schema === IMP22_ROLE_QUALIFICATION_CALL_LEDGER_SCHEMA, `${args.phase} call ledger schema mismatch`);
  requireCondition(ledger.specBytesSha256 === args.specBytesSha256, `${args.phase} call ledger belongs to a different spec freeze`);
  requireCondition(ledger.experimentId === (args.experimentId ?? IMP22_ROLE_QUALIFICATION_EXPERIMENT_ID), `${args.phase} call ledger belongs to a different experiment identity`);

  let liveSpawnStarted = false;
  const forwardExecutor = createForwardReviewerExecutor({
    timeoutMs: args.timeoutMs,
    spawn: async (options) => {
      liveSpawnStarted = true;
      ledger.codexExecInvocations += 1;
      writeJson(ledgerPath, ledger);
      return (args.spawn ?? spawnCodexAgent)({
        ...options,
        manifestSink,
        execBaseDir,
        qualificationCacheDir,
      });
    },
  });

  const persistLedgerEntry = (
    request: RoleQualificationExecutionRequestV1,
    requestSha256: string,
    receipt: RoleQualificationExecutionReceiptV1,
    cached: boolean,
  ): void => {
    const receiptSha256 = hashCanonical(receipt);
    const existing = ledger.entries.find((entry) => entry.attemptId === request.attemptId);
    if (existing) {
      requireCondition(existing.requestSha256 === requestSha256 && existing.receiptSha256 === receiptSha256, `attempt ${request.attemptId} ledger drift`);
      if (cached) ledger.cachedReceipts += 1;
    } else {
      ledger.entries.push({
        attemptId: request.attemptId,
        scheduleId: request.scheduleId,
        role: request.role,
        partition: request.partition,
        caseId: request.caseId,
        profileId: request.profileId,
        attemptNumber: request.attemptNumber,
        requestSha256,
        receiptSha256,
        status: receipt.status,
        executionId: receipt.executionId,
        cached,
        recordedAt: new Date().toISOString(),
      });
      if (request.attemptNumber === 2) ledger.infrastructureReplays += 1;
      if (receipt.status === "provider_capacity") ledger.maxPlanCapacityEvents += 1;
      if (receipt.status === "refusal") ledger.safeguardsOrRefusals += 1;
    }
    writeJson(ledgerPath, ledger);
  };

  const executor = async (request: RoleQualificationExecutionRequestV1): Promise<RoleQualificationExecutionReceiptV1> => {
    const requestSha256 = hashCanonical(request);
    const attemptDir = resolve(phaseDir, "attempts", request.attemptId);
    const requestPath = resolve(attemptDir, "request.json");
    const receiptPath = resolve(attemptDir, "receipt.json");
    if (existsSync(requestPath) || existsSync(receiptPath)) {
      requireCondition(existsSync(requestPath) && existsSync(receiptPath), `attempt ${request.attemptId} has a partial persisted request/receipt pair`);
      const priorRequest = readJson<{ requestSha256?: string }>(requestPath);
      requireCondition(priorRequest.requestSha256 === requestSha256, `attempt ${request.attemptId} request hash changed on resume`);
      const priorReceipt = readJson<RoleQualificationExecutionReceiptV1>(receiptPath);
      persistLedgerEntry(request, requestSha256, priorReceipt, true);
      return priorReceipt;
    }

    writeJson(requestPath, requestRecord(request, requestSha256));
    liveSpawnStarted = false;
    let receipt: RoleQualificationExecutionReceiptV1;
    try {
      const forwardRequest: ForwardReviewExecutionRequestV1 = {
        schema: FORWARD_REVIEW_EXECUTION_REQUEST_SCHEMA,
        lane: request.role,
        workspaceRole: workspaceRole(request.role),
        profileId: request.profileId,
        model: request.model,
        effort: request.effort,
        schemaSha256: request.schemaSha256,
        instrumentVersion: instrumentVersion(request.role),
        // Qualification precedes assignment; bind the request to its immutable
        // candidate-order/freeze identity without pretending an assignment exists.
        roleAssignmentSha256: sha256Hex(`qualification-candidate-order:${request.freezeSha256}`),
        instrumentManifestSha256: request.freezeSha256,
        executionProfileHash: resolveExecutionProfile("chapter-reviewer").profileHash,
        routePolicyVersion: ROUTE_POLICY_VERSION,
        task: request.task,
        artifacts: request.artifacts,
      };
      const result = await forwardExecutor(forwardRequest);
      receipt = {
        schema: ROLE_QUALIFICATION_RECEIPT_SCHEMA,
        executionId: result.executionId,
        status: "completed",
        role: request.role,
        profileId: request.profileId,
        model: request.model,
        effort: request.effort,
        schemaSha256: request.schemaSha256,
        rawOutput: result.output,
      };
    } catch (error) {
      const status = statusFor(error);
      receipt = {
        schema: ROLE_QUALIFICATION_RECEIPT_SCHEMA,
        executionId: `${liveSpawnStarted ? "failed-exec" : "preflight"}-${request.attemptId}`,
        status,
        role: request.role,
        profileId: request.profileId,
        model: request.model,
        effort: request.effort,
        schemaSha256: request.schemaSha256,
        rawOutput: null,
        failureDetail: (error as Error).message.slice(0, 2000),
      };
    }
    writeJson(receiptPath, receipt);
    persistLedgerEntry(request, requestSha256, receipt, false);
    return receipt;
  };
  return { executor, ledger };
}

export async function runLiveRoleCalibration(opts: {
  specPath?: string;
  experimentDir?: string;
  timeoutMs?: number;
} = {}): Promise<LiveCalibrationResultV1> {
  const loaded = await loadAndPreflightLiveQualification({ specPath: opts.specPath });
  const experimentDir = opts.experimentDir ?? DEFAULT_EXPERIMENT_DIR;
  const phaseDir = resolve(experimentDir, "live", "calibration");
  writeJson(resolve(experimentDir, "live", "preflight.json"), loaded.preflight);
  writeJson(resolve(experimentDir, "live", "candidate-availability.json"), loaded.candidateAvailability);
  const live = createLiveQualificationExecutor({
    phase: "calibration",
    experimentId: loaded.preflight.experimentId,
    specBytesSha256: loaded.specBytesSha256,
    phaseDir,
    timeoutMs: opts.timeoutMs,
  });
  const calibration = await runRoleCalibration(loaded.input, {
    executor: live.executor,
    candidateAvailability: loaded.candidateAvailability,
  });
  writeJson(resolve(phaseDir, "calibration-seal.json"), calibration);
  writeJson(resolve(phaseDir, "call-ledger.json"), live.ledger);
  return { calibration, callLedger: live.ledger, preflight: loaded.preflight };
}

/** Persist the explicit human barrier after the operator has inspected the
 * retained calibration seal. This path is model-free and refuses replacement
 * by a different record. */
export function attestLiveRoleCalibration(opts: {
  experimentDir?: string;
  confirmedCalibrationSha256: string;
  inspectedBy: string;
  inspectedAt?: string;
  note?: string;
  approveHoldout: true;
}): LiveCalibrationInspectionResultV1 {
  requireCondition(opts.approveHoldout === true, "calibration inspection requires explicit holdout approval");
  const experimentDir = opts.experimentDir ?? DEFAULT_EXPERIMENT_DIR;
  const calibrationPath = resolve(experimentDir, "live", "calibration", "calibration-seal.json");
  const inspectionPath = resolve(experimentDir, "live", "calibration", "calibration-inspection.json");
  requireCondition(existsSync(calibrationPath), "calibration inspection is blocked until the calibration seal is persisted");
  const calibration = readJson<RoleQualificationCalibrationSealV1>(calibrationPath);
  requireCondition(calibration.valid === true, "calibration inspection cannot approve an invalid calibration seal");
  requireCondition(
    opts.confirmedCalibrationSha256 === calibration.calibrationSha256,
    "--confirm-calibration-sha does not match the retained calibration seal",
  );
  if (existsSync(inspectionPath)) {
    const retained = readJson<RoleQualificationCalibrationInspectionV1>(inspectionPath);
    assertRoleQualificationCalibrationInspection(calibration, retained);
    requireCondition(retained.inspectedBy === opts.inspectedBy.trim(), "calibration inspection is already retained under a different operator");
    return { inspection: retained, path: inspectionPath };
  }
  const inspection = assembleRoleQualificationCalibrationInspection({
    calibration,
    confirmedCalibrationSha256: opts.confirmedCalibrationSha256,
    inspectedBy: opts.inspectedBy,
    inspectedAt: opts.inspectedAt ?? new Date().toISOString(),
    note: opts.note,
  });
  writeJson(inspectionPath, inspection);
  const retained = readJson<RoleQualificationCalibrationInspectionV1>(inspectionPath);
  assertRoleQualificationCalibrationInspection(calibration, retained);
  requireCondition(retained.inspectionSha256 === inspection.inspectionSha256, "calibration inspection read-back hash mismatch");
  return { inspection: retained, path: inspectionPath };
}

export async function runLiveRoleQualificationHoldout(opts: {
  specPath?: string;
  experimentDir?: string;
  timeoutMs?: number;
  qualifiedAt?: string;
} = {}): Promise<LiveHoldoutResultV1> {
  const loaded = await loadAndPreflightLiveQualification({ specPath: opts.specPath });
  const experimentDir = opts.experimentDir ?? DEFAULT_EXPERIMENT_DIR;
  const calibrationPath = resolve(experimentDir, "live", "calibration", "calibration-seal.json");
  requireCondition(existsSync(calibrationPath), "holdout is blocked until the inspected calibration seal is persisted");
  const calibration = readJson<RoleQualificationCalibrationSealV1>(calibrationPath);
  requireCondition(calibration.valid === true, "holdout is blocked because calibration is not valid");
  const inspectionPath = resolve(experimentDir, "live", "calibration", "calibration-inspection.json");
  requireCondition(existsSync(inspectionPath), "holdout is blocked until the human calibration-inspection attestation is persisted");
  const inspection = readJson<RoleQualificationCalibrationInspectionV1>(inspectionPath);
  assertRoleQualificationCalibrationInspection(calibration, inspection);

  const phaseDir = resolve(experimentDir, "live", "holdout");
  const live = createLiveQualificationExecutor({
    phase: "holdout",
    experimentId: loaded.preflight.experimentId,
    specBytesSha256: loaded.specBytesSha256,
    phaseDir,
    timeoutMs: opts.timeoutMs,
  });
  const result = await runRoleQualificationHoldout(loaded.input, calibration, inspection, {
    executor: live.executor,
    candidateAvailability: loaded.candidateAvailability,
    ...(opts.qualifiedAt ? { qualifiedAt: () => opts.qualifiedAt! } : {}),
  });
  writeJson(resolve(phaseDir, "qualification-result.json"), result);
  writeJson(resolve(phaseDir, "role-registry.json"), result.registry);
  writeJson(resolve(phaseDir, "call-ledger.json"), live.ledger);
  return { result, callLedger: live.ledger, preflight: loaded.preflight };
}
