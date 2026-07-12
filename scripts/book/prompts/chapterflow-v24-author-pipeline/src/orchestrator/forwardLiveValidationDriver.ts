/**
 * IMP-22 live pilot/gold driver.
 *
 * This is the single live boundary around the model-free validation campaign.
 * It refuses uninspected qualification, stale role/input freezes, non-ChatGPT
 * routes, unledgered author/evaluator adapters, and any manifest that carries
 * external publication authority.  The CLI must additionally require the
 * explicit `--execute-live` flag before calling this module.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";

import { hashCanonical, sha256Hex } from "../contracts/contractUtil.js";
import { canonicalJson } from "../lib/canonicalJson.js";
import { writeFileAtomic } from "../lib/atomicWrite.js";
import { PIPELINE_DIR } from "../bakeoff/paths.js";
import type { ChapterV21 } from "../types.js";
import { chapterContentHash } from "../critics/qcAttestation.js";
import type { SourcePacketV1, ChapterBriefV1 } from "../artifacts/artifactTypes.js";
import { sourcePacketHash } from "../compiler/sourcePacket.js";
import { semanticSourceHash } from "../source/sourceIntegrity.js";
import type { SourceUsePlanV1 } from "../contracts/sourceUsePlan.js";
import { sourceUsePlanHash } from "../contracts/sourceUsePlan.js";
import type { ChapterPatchV1 } from "../contracts/repairContracts.js";
import {
  assertRoleQualificationCalibrationInspection,
  type RoleQualificationCalibrationInspectionV1,
  type RoleQualificationCalibrationSealV1,
  type RoleQualificationRunnerResultV1,
} from "../bakeoff/migration/roleQualificationRunner.js";
import {
  loadAndPreflightLiveQualification,
  type LiveQualificationPreflightV1,
} from "./forwardRoleQualificationLive.js";
import { spawnCodexAgent, type CodexAgentResult, type SpawnCodexAgentOptions } from "./codexAgent.js";
import { resolveDeps, type AutopilotDeps } from "./autopilot.js";
import {
  PATCH_FILE_NAME,
  buildRepairCard,
  deriveComplaintScope,
  type RepairScope,
} from "./authorRepair.js";
import {
  applyChapterPatch,
  classifyRepairRoute,
  enumeratePatchablePaths,
  findingsFromComplaints,
  nonScopeDrift,
} from "./repairPatch.js";
import { mintChapterAttempt, unexpectedAttemptWrites } from "./chapterTransaction.js";
import { gateCandidate, rubricMetricsWithCandidate } from "./chapterTransaction.js";
import type { LeadThreadOverrideV1 } from "../compiler/chapterBrief.js";
import type { AuthorProvenance } from "../qc/sessionProvenance.js";
import { loadNameBank } from "../librarian/namePlan.js";
import { REQUIRED_SWEEP_FAMILIES, type SweepRecord } from "../qc/sweep.js";
import { loadRubricThresholds, type RubricThresholds } from "../metrics/rubricThresholds.js";
import { classifyProviderOutcome } from "./modelPolicy.js";
import {
  type ForwardChapterConductorInputV1,
  type ForwardPanelRole,
  type ForwardReviewExecutionRequestV1,
  runForwardChapterConductor,
} from "./forwardChapterConductor.js";
import { assertForwardInputFreezeFresh, type ForwardInputFreezeV1 } from "./forwardInputFreeze.js";
import {
  buildForwardLivePhaseBudget,
  categoryForForwardPanelRole,
  createForwardLiveCallLedger,
  createLedgeredForwardReviewerExecutor,
  runLedgeredForwardModelOperation,
  type ForwardLiveCallContextV1,
  type ForwardLiveCallLedgerController,
  type ForwardLiveCampaignKind,
} from "./forwardLiveCallLedger.js";
import {
  ForwardReviewerExecutorError,
  createForwardReviewerExecutor,
  type ForwardReviewerFailureCode,
} from "./forwardReviewerExecutor.js";
import {
  assertForwardRoleAssignmentFreezeFresh,
  type ForwardRoleAssignmentFreezeV1,
  type ForwardSealedQualificationBundleV1,
} from "./forwardRoleAssignmentFreeze.js";
import {
  assertManifest,
  createDeferredAuthorProducer,
  runForwardValidationCampaign,
  type ForwardCandidateRequestV1,
  type ForwardExperimentDestinationProofV1,
  type ForwardGoldBookEvaluationV1,
  type ForwardGoldEvidenceArtifactV1,
  type ForwardGoldPersistedEvidenceRefV1,
  type ForwardPersistenceReceiptV1,
  type ForwardFinalizationRouteV1,
  type ForwardValidationAttemptRecordV1,
  type ForwardFailureClassification,
  type ForwardGoldManifestV1,
  type ForwardValidationCampaignDeps,
  type ForwardValidationCampaignResultV1,
  type FrozenForwardValidationManifestV1,
} from "./forwardValidationCampaign.js";
import type { AuthorIo, PreparedAuthorCandidate } from "./authorRun.js";
import {
  validateForwardProductionInstrumentSeal,
  type ForwardProductionInstrumentSealV1,
} from "./forwardProductionInstrumentSeal.js";
import {
  buildForwardGoldSourceAwareExternalAccuracyProof,
  projectForwardGoldAdjudication,
  resolveForwardGoldEvaluatorOutputSchemaPath,
  validateForwardGoldBlindRaterOutput,
  validateForwardGoldEvaluatorInstrument,
  validateForwardGoldSweepOutputBinding,
  type ForwardGoldEvaluatorInstrumentV1,
  type ForwardGoldExpectedChapterIdentityV1,
  type ForwardGoldSourceLaneEvidenceV1,
  type ForwardGoldSourceAwareExternalAccuracyProofV1,
} from "./forwardGoldEvaluatorInstrument.js";

export const FORWARD_LIVE_CAMPAIGN_PREFLIGHT_SCHEMA = "forward-live-campaign-preflight-v1" as const;
export const FORWARD_LIVE_CAMPAIGN_RESULT_SCHEMA = "forward-live-campaign-driver-result-v1" as const;

const SHA256 = /^[a-f0-9]{64}$/;

export class ForwardLiveValidationDriverError extends Error {
  readonly classification = "policy_preflight_failure" as const;
  constructor(message: string) {
    super(message);
    this.name = "ForwardLiveValidationDriverError";
  }
}

/** Thin CLI authorization barrier. Parsing/usage code may call this with the
 * production phase closure; without `--execute-live` that closure is never
 * evaluated, so dry/mistyped invocations make exactly zero model calls. */
export async function runForwardLiveCampaignCliBoundary<T>(args: {
  phase: ForwardLiveCampaignKind;
  executeLive: boolean;
  execute: () => Promise<T>;
}): Promise<{ code: 0 | 2; executed: boolean; result: T | null; message: string }> {
  if (args.executeLive !== true) {
    return {
      code: 2,
      executed: false,
      result: null,
      message: `forward-${args.phase}: refusing to make model calls without the explicit --execute-live flag`,
    };
  }
  const result = await args.execute();
  return { code: 0, executed: true, result, message: `forward-${args.phase}: live phase completed` };
}

function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new ForwardLiveValidationDriverError(message);
}

function stableJson(value: unknown): string {
  return `${canonicalJson(value)}\n`;
}

function writeJson(path: string, value: unknown): void {
  writeFileAtomic(path, stableJson(value));
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export type ForwardInspectedQualificationProofV1 = {
  roleSetReady: true;
  qualificationResultSha256: string;
  qualificationBundleSha256: string;
  calibrationSha256: string;
  inspectionSha256: string;
  inspectionDecision: "APPROVED_FOR_HOLDOUT";
};

export type LoadedForwardQualificationArtifactsV1 = {
  qualification: ForwardInspectedQualificationProofV1;
  roleFreeze: ForwardRoleAssignmentFreezeV1;
};

function readJson<T>(path: string): T {
  try { return JSON.parse(readFileSync(path, "utf8")) as T; }
  catch (error) { throw new ForwardLiveValidationDriverError(`cannot read retained IMP-22 artifact ${path}: ${(error as Error).message}`); }
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
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

/** Production loader: summaries cannot self-assert qualification.  This reads
 * the retained calibration, human inspection, holdout, sealed bundle, and role
 * freeze, then reruns their full hash/selection/instrument validators. */
export async function loadForwardQualificationArtifacts(paths: {
  calibrationSealPath: string;
  calibrationInspectionPath: string;
  qualificationResultPath: string;
  qualificationBundlePath: string;
  roleAssignmentFreezePath: string;
  qualificationCacheDir?: string;
}): Promise<LoadedForwardQualificationArtifactsV1> {
  const calibration = readJson<RoleQualificationCalibrationSealV1>(paths.calibrationSealPath);
  const inspection = readJson<RoleQualificationCalibrationInspectionV1>(paths.calibrationInspectionPath);
  const result = readJson<RoleQualificationRunnerResultV1>(paths.qualificationResultPath);
  const qualificationBundle = deepFreeze(readJson<ForwardSealedQualificationBundleV1>(paths.qualificationBundlePath));
  const roleFreeze = deepFreeze(readJson<ForwardRoleAssignmentFreezeV1>(paths.roleAssignmentFreezePath));
  assertRoleQualificationCalibrationInspection(calibration, inspection);
  requireCondition(result.roleSetReady === true, `retained qualification role set is not ready: ${result.roleSetBlockedReason ?? "unknown"}`);
  requireCondition(hashCanonical(result) === hashCanonical(qualificationBundle.result), "sealed qualification bundle differs from the retained holdout result");
  requireCondition(result.calibrationInspection?.inspectionSha256 === inspection.inspectionSha256,
    "retained holdout result is bound to another calibration inspection");
  const current = await loadAndPreflightLiveQualification({ qualificationCacheDir: paths.qualificationCacheDir });
  const aggregator = (current.spec.instruments as unknown as {
    aggregator?: { sourceBytesSha256?: string };
  }).aggregator;
  requireCondition(hashCanonical(roleFreeze.instrumentBinding.schemaHashes) === hashCanonical(current.preflight.schemaBytesSha256),
    "current reader/source/quiz schemas differ from the retained role freeze");
  requireCondition(roleFreeze.instrumentBinding.promptSourceHashes.reader === current.preflight.promptSourceBytesSha256.reader
    && roleFreeze.instrumentBinding.promptSourceHashes.source === current.preflight.promptSourceBytesSha256.source
    && roleFreeze.instrumentBinding.promptSourceHashes.quiz === current.preflight.promptSourceBytesSha256.quiz,
  "current reader/source/quiz prompt sources differ from the retained role freeze");
  requireCondition(typeof aggregator?.sourceBytesSha256 === "string"
    && roleFreeze.instrumentBinding.promptSourceHashes.aggregate === aggregator.sourceBytesSha256,
  "current aggregate source differs from the retained role freeze");
  requireCondition(roleFreeze.instrumentBinding.executionRoute.executionProfileHash === current.preflight.executionProfileHash
    && roleFreeze.instrumentBinding.executionRoute.routePolicyVersion === current.preflight.routePolicyVersion,
  "current execution profile/route policy differs from the retained role freeze");
  assertForwardRoleAssignmentFreezeFresh(
    roleFreeze,
    qualificationBundle,
    roleFreeze.instrumentBinding,
    roleFreeze.instrumentBindingSha256,
  );
  return {
    qualification: {
      roleSetReady: true,
      qualificationResultSha256: hashCanonical(result),
      qualificationBundleSha256: qualificationBundle.bundleSha256,
      calibrationSha256: calibration.calibrationSha256,
      inspectionSha256: inspection.inspectionSha256,
      inspectionDecision: inspection.decision,
    },
    roleFreeze,
  };
}

export type ForwardNoApiChatgptRouteProofV1 = {
  executionRoute: "codex_exec_chatgpt_subscription";
  authMode: "chatgpt";
  apiKeyPresent: false;
  apiFallbackAllowed: false;
  apiCallsMade: 0;
  forbiddenProviderEnvKeysPresent: [];
  maxParallel: 2;
  executionProfileHash: string;
  routePolicyVersion: string;
};

/** Re-run the real no-call Codex/auth preflight immediately before a campaign. */
export async function loadForwardNoApiChatgptRouteProof(
  qualificationCacheDir?: string,
): Promise<ForwardNoApiChatgptRouteProofV1> {
  const loaded = await loadAndPreflightLiveQualification({ qualificationCacheDir });
  const preflight: LiveQualificationPreflightV1 = loaded.preflight;
  return {
    executionRoute: "codex_exec_chatgpt_subscription",
    authMode: preflight.authMode,
    apiKeyPresent: preflight.apiKeyPresent,
    apiFallbackAllowed: preflight.apiFallbackAllowed,
    apiCallsMade: 0,
    forbiddenProviderEnvKeysPresent: preflight.forbiddenProviderEnvKeysPresent,
    maxParallel: preflight.maxParallel,
    executionProfileHash: preflight.executionProfileHash,
    routePolicyVersion: preflight.routePolicyVersion,
  };
}

export type ForwardLiveCampaignPreflightV1 = {
  schema: typeof FORWARD_LIVE_CAMPAIGN_PREFLIGHT_SCHEMA;
  kind: ForwardLiveCampaignKind;
  experimentId: string;
  manifestSha256: string;
  inputFreezeSha256: string;
  inputMaterializationSha256: string;
  productionInstrumentSealSha256: string;
  goldEvaluatorInstrumentSha256: string | null;
  roleAssignmentFreezeSha256: string;
  roleAssignmentSha256: string;
  qualificationBundleSha256: string;
  qualificationResultSha256: string;
  calibrationSha256: string;
  inspectionSha256: string;
  executionProfileHash: string;
  routePolicyVersion: string;
  executionRoute: "codex_exec_chatgpt_subscription";
  authMode: "chatgpt";
  apiKeyPresent: false;
  apiFallbackAllowed: false;
  apiCallsMade: 0;
  maxParallel: 2;
  externalCapabilities: { publish: false; promote: false; deploy: false; upload: false };
  preflightSha256: string;
};

/** Model-free final barrier immediately before a phase may create a call ledger. */
export function preflightForwardLiveCampaign(args: {
  manifest: FrozenForwardValidationManifestV1;
  inputFreeze: ForwardInputFreezeV1;
  roleFreeze: ForwardRoleAssignmentFreezeV1;
  qualification: ForwardInspectedQualificationProofV1;
  route: ForwardNoApiChatgptRouteProofV1;
  verifiedInputMaterializationSha256: string;
  verifiedProductionInstrumentSealSha256: string;
  verifiedGoldEvaluatorInstrumentSha256?: string;
}): ForwardLiveCampaignPreflightV1 {
  assertManifest(args.manifest.manifest);
  requireCondition(hashCanonical(args.manifest.manifest) === args.manifest.manifestSha256, "live campaign manifest hash drift");
  assertForwardInputFreezeFresh(args.inputFreeze);
  requireCondition(SHA256.test(args.verifiedInputMaterializationSha256)
    && args.verifiedInputMaterializationSha256 === args.manifest.manifest.inputMaterializationSha256,
  "live campaign input materialization is unverified or bound to another manifest");
  requireCondition(SHA256.test(args.verifiedProductionInstrumentSealSha256)
    && args.verifiedProductionInstrumentSealSha256 === args.manifest.manifest.productionInstrumentSealSha256
    && args.verifiedProductionInstrumentSealSha256 === args.roleFreeze.productionInstrumentSealSha256,
  "live campaign production instrument seal is unverified or disagrees with manifest/role freeze");
  if (args.manifest.manifest.kind === "gold") {
    requireCondition(SHA256.test(args.verifiedGoldEvaluatorInstrumentSha256 ?? "")
      && args.verifiedGoldEvaluatorInstrumentSha256 === args.manifest.manifest.goldEvaluatorInstrumentSha256,
    "gold evaluator instrument is unverified or bound to another gold manifest");
  } else {
    requireCondition(args.verifiedGoldEvaluatorInstrumentSha256 === undefined,
      "pilot preflight cannot carry a gold evaluator instrument");
  }
  requireCondition(args.qualification.roleSetReady === true, "live campaign requires a role-ready holdout result");
  requireCondition(args.qualification.inspectionDecision === "APPROVED_FOR_HOLDOUT", "live campaign requires the retained calibration inspection approval");
  for (const [label, value] of Object.entries({
    qualificationResultSha256: args.qualification.qualificationResultSha256,
    qualificationBundleSha256: args.qualification.qualificationBundleSha256,
    calibrationSha256: args.qualification.calibrationSha256,
    inspectionSha256: args.qualification.inspectionSha256,
    roleAssignmentFreezeSha256: args.roleFreeze.freezeSha256,
  })) requireCondition(SHA256.test(value), `${label} must be a lowercase sha256`);
  requireCondition(args.roleFreeze.qualificationBundleSha256 === args.qualification.qualificationBundleSha256,
    "role assignment freeze is bound to another qualification bundle");
  requireCondition(args.roleFreeze.freezeSha256 === hashCanonical(Object.fromEntries(
    Object.entries(args.roleFreeze).filter(([key]) => key !== "freezeSha256"),
  )), "role assignment freeze hash drift");
  requireCondition(args.manifest.manifest.roleAssignmentSha256 === args.roleFreeze.roleAssignmentSha256,
    "campaign manifest is bound to another role assignment");
  requireCondition(args.manifest.manifest.instrumentManifestSha256 === args.roleFreeze.reviewConfig.instrumentManifestSha256,
    "campaign manifest is bound to another review instrument");
  requireCondition(args.manifest.manifest.thresholdsSha256 === args.roleFreeze.reviewConfig.instrumentManifest.thresholdsSha256,
    "campaign manifest thresholds differ from the role-qualified frozen review instrument");
  requireCondition(args.roleFreeze.reviewConfig.readerBar === 80,
    "live campaign requires the unchanged IMP-22 reader bar of 80");
  requireCondition(args.route.executionRoute === "codex_exec_chatgpt_subscription" && args.route.authMode === "chatgpt",
    "campaign route is not ChatGPT-subscription codex exec");
  requireCondition(args.route.apiKeyPresent === false && args.route.apiFallbackAllowed === false && args.route.apiCallsMade === 0,
    "campaign route permits or records an API call");
  requireCondition(args.route.forbiddenProviderEnvKeysPresent.length === 0, "campaign parent process carries a forbidden provider credential");
  requireCondition(args.route.maxParallel === 2, "campaign maxParallel must remain exactly 2");
  requireCondition(args.route.executionProfileHash === args.roleFreeze.instrumentBinding.executionRoute.executionProfileHash,
    "campaign execution profile differs from qualification");
  requireCondition(args.route.routePolicyVersion === args.roleFreeze.instrumentBinding.executionRoute.routePolicyVersion,
    "campaign route policy differs from qualification");
  requireCondition(args.roleFreeze.instrumentBinding.executionRoute.apiAllowed === false
    && args.roleFreeze.instrumentBinding.executionRoute.apiFallbackAllowed === false
    && args.roleFreeze.instrumentBinding.executionRoute.apiCallsMade === 0,
  "frozen role assignment permits an API route");
  requireCondition(args.roleFreeze.roleAssignment.readerPrimary.profileId !== args.roleFreeze.roleAssignment.readerBackup.profileId,
    "live campaign requires a distinct reader-audit profile so panel receipts cannot collide");
  requireCondition(args.roleFreeze.roleAssignment.sourcePrimary.profileId !== args.roleFreeze.roleAssignment.sourceAdjudicator.profileId,
    "live campaign requires a distinct source-adjudicator profile so panel receipts cannot collide");
  const expectedTargets = args.manifest.manifest.kind === "pilot"
    ? args.inputFreeze.pilot.flatMap((book) => book.chapters)
    : args.inputFreeze.gold.chapters;
  requireCondition(expectedTargets.length === args.manifest.manifest.targets.length, "campaign denominator differs from the frozen input assignment");
  const exactQualificationBookIds = [...new Set(args.inputFreeze.sets.qualificationBookIds)].sort((a, b) => a.localeCompare(b));
  requireCondition(hashCanonical(args.manifest.manifest.qualificationBookIds) === hashCanonical(exactQualificationBookIds),
    "campaign qualification-book exclusions differ from the frozen input assignment");
  requireCondition(args.manifest.manifest.targets.every((target) => !exactQualificationBookIds.includes(target.bookId)),
    "campaign target overlaps a qualification book");
  const expected = new Map(expectedTargets.map((target) => [`${target.bookId}/${target.chapterNumber}`, target]));
  for (const target of args.manifest.manifest.targets) {
    const frozen = expected.get(`${target.bookId}/${target.chapterNumber}`);
    requireCondition(!!frozen, `${target.bookId}/ch${target.chapterNumber}: not present in the input freeze`);
    for (const field of [
      "bookId", "chapterNumber", "chapterId", "stratum", "sourceArchiveId", "sourceComplete", "evidenceFresh",
      "sourcePacketSha256", "sourceUsePlanSha256", "sidecarSha256", "anchorCatalogSha256",
    ] as const) {
      requireCondition(target[field] === frozen[field], `${target.bookId}/ch${target.chapterNumber}: ${field} differs from the input freeze`);
    }
    requireCondition(hashCanonical(target.riskSignals) === hashCanonical(frozen.riskSignals),
      `${target.bookId}/ch${target.chapterNumber}: riskSignals differ from the input freeze`);
  }
  const core = {
    schema: FORWARD_LIVE_CAMPAIGN_PREFLIGHT_SCHEMA,
    kind: args.manifest.manifest.kind,
    experimentId: args.manifest.manifest.experimentId,
    manifestSha256: args.manifest.manifestSha256,
    inputFreezeSha256: args.inputFreeze.freezeSha256,
    inputMaterializationSha256: args.verifiedInputMaterializationSha256,
    productionInstrumentSealSha256: args.verifiedProductionInstrumentSealSha256,
    goldEvaluatorInstrumentSha256: args.verifiedGoldEvaluatorInstrumentSha256 ?? null,
    roleAssignmentFreezeSha256: args.roleFreeze.freezeSha256,
    roleAssignmentSha256: args.roleFreeze.roleAssignmentSha256,
    qualificationBundleSha256: args.qualification.qualificationBundleSha256,
    qualificationResultSha256: args.qualification.qualificationResultSha256,
    calibrationSha256: args.qualification.calibrationSha256,
    inspectionSha256: args.qualification.inspectionSha256,
    executionProfileHash: args.route.executionProfileHash,
    routePolicyVersion: args.route.routePolicyVersion,
    executionRoute: args.route.executionRoute,
    authMode: args.route.authMode,
    apiKeyPresent: false as const,
    apiFallbackAllowed: false as const,
    apiCallsMade: 0 as const,
    maxParallel: 2 as const,
    externalCapabilities: { publish: false as const, promote: false as const, deploy: false as const, upload: false as const },
  };
  return { ...core, preflightSha256: hashCanonical(core) };
}

type AuthorSpawnReceiptV1 = {
  spawn: CodexAgentResult;
  files: Array<{ relativePath: string; bytesBase64: string; bytesSha256: string }>;
};

function filesBelow(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else out.push(path);
    }
  };
  walk(root);
  return out.sort((a, b) => a.localeCompare(b));
}

function captureAuthorWorkspace(cwd: string, spawn: CodexAgentResult): AuthorSpawnReceiptV1 {
  return {
    spawn,
    files: filesBelow(cwd).map((path) => {
      const bytes = readFileSync(path);
      return { relativePath: relative(cwd, path), bytesBase64: bytes.toString("base64"), bytesSha256: sha256Hex(bytes) };
    }),
  };
}

function restoreAuthorWorkspace(cwd: string, receipt: AuthorSpawnReceiptV1): void {
  for (const file of receipt.files) {
    const path = resolve(cwd, file.relativePath);
    requireCondition(path.startsWith(`${resolve(cwd)}/`), "cached author artifact escapes its attempt workspace");
    const bytes = Buffer.from(file.bytesBase64, "base64");
    requireCondition(sha256Hex(bytes) === file.bytesSha256, `cached author artifact hash drift: ${file.relativePath}`);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, bytes);
  }
}

function providerFailure(error: unknown): ForwardReviewerFailureCode {
  if (error instanceof ForwardReviewerExecutorError) return error.code;
  return "integrity_failure";
}

const FORWARD_AUTHOR_RECEIPT_SCHEMA_PATH = resolve(
  PIPELINE_DIR,
  "state/migration-experiments/contracts/schemas/forward-author-operation-receipt.schema.json",
);
const FORWARD_REPAIR_RECEIPT_SCHEMA_PATH = resolve(
  PIPELINE_DIR,
  "state/migration-experiments/contracts/schemas/forward-repair-operation-receipt.schema.json",
);

type ForwardAuthorOperationReceiptV1 = {
  schema: "forward-author-operation-receipt-v1" | "forward-repair-operation-receipt-v1";
  operation: "author-first-write" | "author-regeneration" | "typed-repair";
  chapterId: string;
  artifactPath: string;
  artifactSha256: string;
};

export function validateForwardAuthorOperationReceipt(args: {
  finalMessage: string;
  expectedSchema: ForwardAuthorOperationReceiptV1["schema"];
  expectedOperation: ForwardAuthorOperationReceiptV1["operation"];
  expectedChapterId: string;
  expectedArtifactPath: string;
  workspaceDir: string;
}): ForwardAuthorOperationReceiptV1 {
  const invalid = (message: string): never => { throw new ForwardReviewerExecutorError(message, "invalid_output"); };
  let receipt: ForwardAuthorOperationReceiptV1;
  try { receipt = JSON.parse(args.finalMessage) as ForwardAuthorOperationReceiptV1; }
  catch (error) { throw new ForwardReviewerExecutorError(`author operation receipt is not JSON (${(error as Error).message})`, "invalid_output"); }
  if (!(receipt && typeof receipt === "object"
    && receipt.schema === args.expectedSchema
    && receipt.operation === args.expectedOperation
    && receipt.chapterId === args.expectedChapterId
    && receipt.artifactPath === args.expectedArtifactPath
    && SHA256.test(receipt.artifactSha256))) invalid("author operation receipt identity/schema is invalid");
  const artifactPath = resolve(args.workspaceDir, receipt.artifactPath);
  if (!(artifactPath.startsWith(`${resolve(args.workspaceDir)}/`) && existsSync(artifactPath))) {
    invalid("author operation receipt names a missing or escaping artifact");
  }
  if (sha256Hex(readFileSync(artifactPath)) !== receipt.artifactSha256) {
    invalid("author operation receipt artifact hash does not match the workspace bytes");
  }
  return receipt;
}

function bindForwardAuthorOperationContract(
  request: ForwardCandidateRequestV1,
  spawnOptions: SpawnCodexAgentOptions,
): { options: SpawnCodexAgentOptions; schemaSha256: string; expected: Omit<Parameters<typeof validateForwardAuthorOperationReceipt>[0], "finalMessage"> } {
  const repair = request.stage === "repair";
  const schemaPath = repair ? FORWARD_REPAIR_RECEIPT_SCHEMA_PATH : FORWARD_AUTHOR_RECEIPT_SCHEMA_PATH;
  requireCondition(existsSync(schemaPath), `forward author operation schema is missing: ${schemaPath}`);
  const schemaSha256 = sha256Hex(readFileSync(schemaPath));
  const expectedOperation = repair
    ? "typed-repair" as const
    : request.stage === "regeneration"
      ? "author-regeneration" as const
      : "author-first-write" as const;
  const expectedSchema = repair
    ? "forward-repair-operation-receipt-v1" as const
    : "forward-author-operation-receipt-v1" as const;
  const expectedArtifactPath = repair ? PATCH_FILE_NAME : chapterFileNameFor(request.target.chapterId);
  return {
    options: { ...spawnOptions, outputSchemaPath: schemaPath },
    schemaSha256,
    expected: {
      expectedSchema,
      expectedOperation,
      expectedChapterId: request.target.chapterId,
      expectedArtifactPath,
      workspaceDir: spawnOptions.cwd,
    },
  };
}

function forwardAuthorOperationReceiptInstruction(request: ForwardCandidateRequestV1): string {
  const repair = request.stage === "repair";
  const expectedOperation = repair
    ? "typed-repair"
    : request.stage === "regeneration"
      ? "author-regeneration"
      : "author-first-write";
  const expectedSchema = repair
    ? "forward-repair-operation-receipt-v1"
    : "forward-author-operation-receipt-v1";
  const expectedArtifactPath = repair ? PATCH_FILE_NAME : chapterFileNameFor(request.target.chapterId);
  const receiptInstruction = [
    "",
    "FINAL OPERATION RECEIPT",
    "After writing the required workspace artifact, return only the schema-bound JSON receipt.",
    `schema=${expectedSchema}`,
    `operation=${expectedOperation}`,
    `chapterId=${request.target.chapterId}`,
    `artifactPath=${expectedArtifactPath}`,
    "artifactSha256 must be the lowercase SHA-256 of the exact artifact bytes you wrote.",
  ].join("\n");
  return receiptInstruction;
}

export function frozenForwardExperimentChapterNumbers(
  proof: ForwardExperimentDestinationProofV1,
  requestedBookId: string,
): number[] {
  requireCondition(proof.outputRunId.includes(`--${requestedBookId}--`),
    `frozen index request ${requestedBookId} is outside the bound output run`);
  const bytes = readFileSync(proof.frozenIndexAbsPath);
  requireCondition(sha256Hex(bytes) === proof.frozenIndexSha256,
    `${requestedBookId}: experiment-local frozen index bytes drifted`);
  let parsed: unknown;
  try { parsed = JSON.parse(bytes.toString("utf8")); }
  catch (error) { throw new ForwardLiveValidationDriverError(`${requestedBookId}: frozen index is invalid JSON (${(error as Error).message})`); }
  requireCondition(Array.isArray(parsed) && parsed.length > 0, `${requestedBookId}: frozen index is empty or not an array`);
  const numbers = parsed.map((entry, index) => Number((entry as { number?: unknown })?.number ?? index + 1));
  requireCondition(numbers.every((number) => Number.isInteger(number) && number > 0),
    `${requestedBookId}: frozen index contains an invalid chapter number`);
  requireCondition(new Set(numbers).size === numbers.length, `${requestedBookId}: frozen index contains duplicate chapter numbers`);
  return numbers;
}

export function bindForwardExperimentSpawnOptions(
  proof: ForwardExperimentDestinationProofV1,
  spawnOptions: SpawnCodexAgentOptions,
  sessionId: string,
): SpawnCodexAgentOptions {
  return {
    ...spawnOptions,
    sessionId,
    manifestSink: proof.executionManifestRootAbs,
    qualificationCacheDir: proof.qualificationCacheRootAbs,
    execBaseDir: proof.execSessionRootAbs,
  };
}

export function persistForwardExperimentAuthorSession(
  root: string,
  bookId: string,
  label: string,
  result: CodexAgentResult,
): void {
  const record = { schema: "forward-author-session-log-v1", bookId, label, result };
  const path = resolve(root, `${sha256Hex(`${label}\0${result.sessionId}`).slice(0, 32)}.json`);
  if (existsSync(path)) {
    requireCondition(hashCanonical(readJson(path)) === hashCanonical(record),
      `${bookId}: experiment-local author session log drift`);
  } else {
    writeJson(path, record);
  }
}

export function campaignClassificationForModelFailure(code: ForwardReviewerFailureCode): ForwardFailureClassification {
  if (code === "policy_preflight_failure" || code === "integrity_failure" || code === "invalid_output") {
    return "STATE_OR_PROVENANCE";
  }
  return "MODEL_ROUTING";
}

function failedSpawn(result: CodexAgentResult): ForwardReviewerExecutorError | null {
  if (result.ok && result.exitCode === 0) return null;
  const outcome = classifyProviderOutcome({ completed: true, exitCode: result.exitCode, stderr: result.stderr, finalMessage: result.finalMessage });
  const code: ForwardReviewerFailureCode = outcome === "provider_rate_or_capacity"
    ? "provider_capacity"
    : outcome === "provider_safeguard_or_refusal"
      ? "refusal"
      : "transient_execution_failure";
  return new ForwardReviewerExecutorError(`author codex exec failed (${result.exitCode}): ${result.stderr || result.finalMessage}`, code);
}

export type LedgerBoundForwardCandidateProducer = ForwardValidationCampaignDeps["produceCandidate"] & {
  readonly liveLedgerBound: true;
  readonly executionBoundary: "hermetic-codex-broker" | "injected-test";
};

/** Production deferred-author adapter. Every actual author spawn is reserved in
 * the shared ledger first; exact cached candidate bytes are restored into the
 * newly minted experiment-local attempt workspace before validation resumes. */
export function createLedgeredDeferredAuthorProducer(args: {
  /** Omit in production. Supplying deps is an explicit injected-test seam and
   * the top-level live driver will refuse that adapter. */
  baseDeps?: AutopilotDeps;
  testOnlyAllowInjectedDeps?: true;
  controller: ForwardLiveCallLedgerController;
  phaseDir: string;
  kind: ForwardLiveCampaignKind;
  productionInstrumentSealSha256: string;
  /** Full materialization proof recheck at the immediately-preceding author
   * boundary (first write, repair, and regeneration). */
  assertInputMaterializationFresh: () => void;
  ioFor: (target: ForwardCandidateRequestV1["target"]) => { io: AuthorIo; destinationProof: ForwardExperimentDestinationProofV1 };
}): LedgerBoundForwardCandidateProducer {
  requireCondition(args.baseDeps === undefined || args.testOnlyAllowInjectedDeps === true,
    "injected author dependencies require the explicit test-only boundary flag");
  requireCondition(SHA256.test(args.productionInstrumentSealSha256),
    "author producer requires the verified production instrument seal hash");
  const baseDeps = args.baseDeps ?? resolveDeps();
  const executionBoundary = args.baseDeps === undefined ? "hermetic-codex-broker" : "injected-test";
  const producer = (async (request: ForwardCandidateRequestV1) => {
    args.assertInputMaterializationFresh();
    const destination = args.ioFor(request.target);
    let terminalModelFailure: ForwardReviewerFailureCode | null = null;
    const logicalOperationId = `${request.target.bookId}/ch${String(request.target.chapterNumber).padStart(2, "0")}/${request.stage}/author`;
    const sessionId = `imp22-${sha256Hex(logicalOperationId).slice(0, 24)}`;
    const deps: AutopilotDeps = {
      ...baseDeps,
      mkSessionId: () => sessionId,
      expectedChapterNumbers: (bookId) => frozenForwardExperimentChapterNumbers(destination.destinationProof, bookId),
      logSession: (bookId, label, result) => persistForwardExperimentAuthorSession(
        destination.destinationProof.sessionLogRootAbs,
        bookId,
        label,
        result,
      ),
      spawn: async (spawnOptions: SpawnCodexAgentOptions) => {
        const operationContract = bindForwardAuthorOperationContract(request, spawnOptions);
        const enforcedSpawnOptions = operationContract.options;
        const attemptIdentityPath = resolve(enforcedSpawnOptions.cwd, "..", "attempt.json");
        requireCondition(existsSync(attemptIdentityPath), "forward author spawn has no minted attempt identity");
        const attemptIdentity = readJson<{ promptSha256?: unknown }>(attemptIdentityPath);
        requireCondition(attemptIdentity.promptSha256 === sha256Hex(enforcedSpawnOptions.task),
          "forward author attempt prompt hash differs from the exact ledgered/model task bytes");
        const context: ForwardLiveCallContextV1 = {
          category: `${args.kind}-author-${request.stage}`,
          bookId: request.target.bookId,
          chapterNumber: request.target.chapterNumber,
          stage: request.stage,
          logicalOperationId,
        };
        const stableRequest = {
          taskSha256: sha256Hex(enforcedSpawnOptions.task),
          role: enforcedSpawnOptions.role,
          sessionId,
          sandbox: enforcedSpawnOptions.sandbox,
          model: enforcedSpawnOptions.model,
          reasoningEffort: enforcedSpawnOptions.reasoningEffort,
          timeoutMs: enforcedSpawnOptions.timeoutMs,
          outputSchemaSha256: operationContract.schemaSha256,
          outputRunId: request.target.outputRunId,
          outputRelPath: request.target.outputRelPath,
          sourcePacketSha256: request.target.sourcePacketSha256,
          sourceUsePlanSha256: request.target.sourceUsePlanSha256,
          sidecarSha256: request.target.sidecarSha256,
          anchorCatalogSha256: request.target.anchorCatalogSha256,
          productionInstrumentSealSha256: args.productionInstrumentSealSha256,
        };
        try {
          const receipt = await runLedgeredForwardModelOperation({
            controller: args.controller,
            phaseDir: args.phaseDir,
            context,
            request: stableRequest,
            execute: async (attemptNumber) => {
              const attemptSessionId = `${sessionId}-attempt-${attemptNumber}`;
              const result = await baseDeps.spawn(bindForwardExperimentSpawnOptions(
                destination.destinationProof,
                enforcedSpawnOptions,
                attemptSessionId,
              ));
              const failure = failedSpawn(result);
              if (failure) throw failure;
              validateForwardAuthorOperationReceipt({
                finalMessage: result.finalMessage,
                ...operationContract.expected,
              });
              return { executionId: result.sessionId, result: captureAuthorWorkspace(enforcedSpawnOptions.cwd, result) };
            },
            restoreCached: (cached) => restoreAuthorWorkspace(enforcedSpawnOptions.cwd, cached),
            classifyError: providerFailure,
          });
          return receipt.spawn;
        } catch (error) {
          if (error instanceof ForwardReviewerExecutorError) terminalModelFailure = error.code;
          throw error;
        }
      },
    };
    if (request.stage === "repair") {
      let repairFailureDisposition: "WRONG_ROUTE" | "WHOLE_CHAPTER_FAILURE" | "REPAIR_CONTENT_FAILURE" | "INFRASTRUCTURE" = "REPAIR_CONTENT_FAILURE";
      try {
        requireCondition(request.previous?.attemptDir, "typed repair requires the preserved first-write attempt directory");
        const priorWorkspace = resolve(request.previous.attemptDir, "workspace");
        const priorCandidates = filesBelow(priorWorkspace).filter((path) => path.endsWith(".v21-native.chapter.json"));
        requireCondition(priorCandidates.length === 1, "typed repair requires exactly one preserved first candidate");
        const originalBytes = readFileSync(priorCandidates[0], "utf8");
        const original = JSON.parse(originalBytes) as ChapterV21;
        requireCondition(sha256Hex(originalBytes) === request.previous.candidateBytesSha256,
          "typed repair base bytes differ from the preserved first-write record");
        const io = destination.io;
        const plan = io.readSourcePlan(request.target.bookId, request.target.chapterNumber);
        const packet = io.readPacket(request.target.bookId, request.target.chapterNumber);
        requireCondition(plan !== null && packet !== null, "typed repair requires the frozen source plan and packet");
        requireCondition(sourceUsePlanHash(plan) === request.target.sourceUsePlanSha256, "typed repair source plan is stale");
        const scopes = request.repairScopes as RepairScope[];
        requireCondition(scopes.length > 0, "typed repair requires at least one frozen repair scope");
        const findings = findingsFromComplaints(request.complaints, scopes);
        const routeDecision = classifyRepairRoute(findings);
        if (routeDecision.route !== "surgical" && routeDecision.route !== "section") {
          repairFailureDisposition = routeDecision.route === "regeneration" ? "WHOLE_CHAPTER_FAILURE" : "WRONG_ROUTE";
          throw new ForwardLiveValidationDriverError(`typed repair route is ${routeDecision.route}, not surgical/section`);
        }
        const menu = enumeratePatchablePaths(original, routeDecision.route, scopes);
        requireCondition(menu.length > 0, "typed repair has no patchable path in its frozen scopes");
        const repairCard = buildRepairCard({
          bookId: request.target.bookId,
          chapter: original,
          brief: io.readBrief(request.target.bookId, request.target.chapterNumber) ?? undefined,
          complaints: request.complaints,
          scopes,
          relPath: basename(priorCandidates[0]),
          plan,
          patchProtocol: {
            baseHash: sha256Hex(originalBytes),
            planHash: sourceUsePlanHash(plan),
            findingIds: findings.map((finding) => finding.findingId),
            route: routeDecision.route,
            menu,
          },
        });
        const card = `${repairCard}${forwardAuthorOperationReceiptInstruction(request)}`;
        const attempt = mintChapterAttempt({
          bookId: request.target.bookId,
          chapterNumber: request.target.chapterNumber,
          chapterId: request.target.chapterId,
          attemptKind: routeDecision.route === "section" ? "section-repair" : "surgical-repair",
          attemptSequence: 1,
          promptSha256: sha256Hex(card),
          sourcePlanHash: sourceUsePlanHash(plan),
          inputHashes: {
            sourcePacket: request.target.sourcePacketSha256,
            sourceUsePlan: request.target.sourceUsePlanSha256,
            productionInstrumentSeal: args.productionInstrumentSealSha256,
          },
          io,
          seedBytes: originalBytes,
          attemptsRoot: io.attemptsRoot(),
          evidenceRoot: io.evidenceRoot?.(),
        });
        const spawn = await deps.spawn({
          task: card,
          role: "author-repair",
          sessionId,
          cwd: attempt.workspaceDir,
          sandbox: "workspace-write",
          skipGitRepoCheck: true,
          model: request.target.writerRoute.model,
          reasoningEffort: request.target.writerRoute.effort,
        });
        const failure = failedSpawn(spawn);
        if (failure) throw failure;
        const unexpected = unexpectedAttemptWrites(attempt, [PATCH_FILE_NAME]);
        requireCondition(unexpected.length === 0, `typed repair wrote unexpected workspace files: ${unexpected.join(", ")}`);
        const patch = JSON.parse(readFileSync(resolve(attempt.workspaceDir, PATCH_FILE_NAME), "utf8")) as ChapterPatchV1;
        const applied = applyChapterPatch({
          originalBytes,
          original,
          patch,
          route: routeDecision.route,
          plan,
          issuedFindingIds: findings.map((finding) => finding.findingId),
        });
        if (!applied.ok) throw new ForwardLiveValidationDriverError(`typed repair patch rejected: ${applied.reason}`);
        requireCondition(nonScopeDrift(original, applied.chapter, applied.touchedPaths).length === 0,
          "typed repair changed protected content outside its operations");
        const bytes = `${JSON.stringify(applied.chapter, null, 2)}\n`;
        writeFileSync(attempt.candidatePath, bytes);
        const gate = await io.gateCandidate(applied.chapter, destination.destinationProof.chapterOutputAbsPath, request.target.outputRelPath);
        requireCondition(gate.code === 0, `typed repair candidate fails deterministic gate: ${gate.stderr || gate.stdout}`);
        const rubric = await io.rubricWithCandidate(request.target.bookId, request.target.chapterNumber, applied.chapter);
        requireCondition(rubric.code === 0 && !rubric.stdout.split("\n").some((line) => line.includes("FAIL")),
          "typed repair candidate fails deterministic rubric preflight");
        const prepared: PreparedAuthorCandidate = {
          bookId: request.target.bookId,
          chapterNumber: request.target.chapterNumber,
          chapterId: request.target.chapterId,
          sessionId,
          attempt,
          bytes,
          chapter: applied.chapter,
          plan,
          pendingLeadOverride: null,
          io,
        };
        return {
          ok: true as const,
          prepared,
          patch,
          patchBase: { bytes: originalBytes, chapter: original },
          routeReceipt: {
            model: request.target.writerRoute.model,
            effort: request.target.writerRoute.effort,
            outputRunId: request.target.outputRunId,
            outputRelPath: request.target.outputRelPath,
            destinationProof: destination.destinationProof,
            destinationProofSha256: hashCanonical(destination.destinationProof),
          },
        };
      } catch (error) {
        const classification = error instanceof ForwardReviewerExecutorError
          ? campaignClassificationForModelFailure(error.code)
          : terminalModelFailure
            ? campaignClassificationForModelFailure(terminalModelFailure)
            : "CONTENT_SPECIFIC";
        if (classification === "MODEL_ROUTING" || classification === "STATE_OR_PROVENANCE") repairFailureDisposition = "INFRASTRUCTURE";
        return {
          ok: false as const,
          reason: (error as Error).message,
          failureClassification: classification,
          failureDisposition: repairFailureDisposition,
        };
      }
    }
    const produced = await createDeferredAuthorProducer({
      deps,
      ioFor: () => destination,
      decorateAuthorCard: (candidateRequest, card) => `${card}${forwardAuthorOperationReceiptInstruction(candidateRequest)}`,
      attemptInputHashes: () => ({ productionInstrumentSeal: args.productionInstrumentSealSha256 }),
    })(request);
    if (!produced.ok && terminalModelFailure) {
      return {
        ok: false as const,
        reason: produced.reason,
        failureClassification: campaignClassificationForModelFailure(terminalModelFailure),
      };
    }
    return produced;
  }) as LedgerBoundForwardCandidateProducer;
  Object.defineProperty(producer, "liveLedgerBound", { value: true, enumerable: true });
  Object.defineProperty(producer, "executionBoundary", { value: executionBoundary, enumerable: true });
  return producer;
}

export type ForwardGoldEvaluatorCallV1 = {
  callId: string;
  actorId: string;
  request: unknown;
};

export type ForwardProductionGoldEvaluatorCallV1 = ForwardGoldEvaluatorCallV1 & {
  evaluationRole: "blind-rater" | "adjudicator" | "book-sweep";
  task: string;
  cwd: string;
  model: string;
  effort: "minimal" | "low" | "medium" | "high" | "xhigh";
  outputSchemaPath: string;
  outputSchemaSha256: string;
  artifacts: Array<{ relativePath: string; bytesSha256: string }>;
  instrumentSha256: string;
  productionInstrumentSealSha256: string;
  sourceHash: string;
  dispatchReceiptSha256: string;
  expectedChapters: ForwardGoldExpectedChapterIdentityV1[];
  blindRaterRole: "primary" | "verification" | null;
  sourceAwareExternalAccuracy: ForwardGoldSourceAwareExternalAccuracyProofV1;
  expectedSourceLaneEvidence: ForwardGoldSourceLaneEvidenceV1[];
};

export type ForwardProductionGoldEvaluatorResultV1 = {
  actorId: string;
  executionId: string;
  output: unknown;
  outputSha256: string;
};

export type ForwardGoldWorkerDispatchBindingV1 = {
  receipt: {
    schema: "forward-gold-worker-dispatch-receipt-v1";
    callId: string;
    actorId: string;
    evaluationRole: "blind-rater" | "adjudicator" | "book-sweep";
    instrumentSha256: string;
    productionInstrumentSealSha256: string;
    sourceHash: string;
    inspectionSha256: string;
    baseTaskSha256: string;
    artifactInventorySha256: string;
    dispatchReceiptSha256: string;
  };
  task: string;
};

/** Pure dispatch mint used by the production broker. The worker receipt binds
 * the final pre-append task plus the exact staged artifact inventory, so adding
 * blind-rater/adjudicator chain evidence necessarily changes the receipt and
 * the final ledgered task hash. */
export function buildForwardGoldWorkerDispatchBinding(args: {
  call: Pick<ForwardProductionGoldEvaluatorCallV1,
    "callId" | "actorId" | "evaluationRole" | "instrumentSha256" | "productionInstrumentSealSha256"
    | "sourceHash" | "expectedChapters" | "sourceAwareExternalAccuracy" | "task">;
  artifacts: Array<{ relativePath: string; bytesSha256: string }>;
}): ForwardGoldWorkerDispatchBindingV1 {
  requireCondition(!args.artifacts.some((artifact) => artifact.relativePath === "worker-dispatch-receipt.json"),
    `${args.call.callId}: worker dispatch may be finalized only once`);
  const inspectionSha256 = hashCanonical({
    sourceHash: args.call.sourceHash,
    expectedChapters: args.call.expectedChapters,
    sourceAwareExternalAccuracyProofSha256: args.call.sourceAwareExternalAccuracy.proofSha256,
  });
  const core = {
    schema: "forward-gold-worker-dispatch-receipt-v1" as const,
    callId: args.call.callId,
    actorId: args.call.actorId,
    evaluationRole: args.call.evaluationRole,
    instrumentSha256: args.call.instrumentSha256,
    productionInstrumentSealSha256: args.call.productionInstrumentSealSha256,
    sourceHash: args.call.sourceHash,
    inspectionSha256,
    baseTaskSha256: sha256Hex(args.call.task),
    artifactInventorySha256: hashCanonical([...args.artifacts].sort((a, b) => a.relativePath.localeCompare(b.relativePath))),
  };
  const dispatchReceiptSha256 = hashCanonical(core);
  const task = `${args.call.task}\n\nFROZEN SOURCE/DISPATCH BINDING\nsource_hash=${args.call.sourceHash}\nworker_dispatch_receipt_sha256=${dispatchReceiptSha256}\nRead worker-dispatch-receipt.json. Echo these exact hashes in every schema field that requires them. Return only the pinned role-specific JSON object; no wrapper or commentary.`;
  return { receipt: { ...core, dispatchReceiptSha256 }, task };
}

export type LedgerBoundForwardGoldEvaluator = NonNullable<ForwardValidationCampaignDeps["evaluateGoldBook"]> & {
  readonly liveLedgerBound: true;
  readonly executionBoundary: "hermetic-codex-broker" | "injected-test";
};

/** Three-call full-book adapter (two isolated blind raters plus adjudicator).
 * The deterministic assembler must persist and bind evaluator/rater/sweep
 * evidence; the campaign independently reads and re-hashes every receipt. */
export function createLedgeredForwardGoldEvaluator<TResult>(args: {
  controller: ForwardLiveCallLedgerController;
  phaseDir: string;
  buildCalls: (input: { manifest: Readonly<ForwardGoldManifestV1>; finalByChapter: Readonly<ForwardValidationCampaignResultV1["finalByChapter"]> }) => readonly [ForwardGoldEvaluatorCallV1, ForwardGoldEvaluatorCallV1, ForwardGoldEvaluatorCallV1];
  execute: (call: ForwardGoldEvaluatorCallV1) => Promise<{ executionId: string; result: TResult }>;
  assemble: (input: {
    manifest: Readonly<ForwardGoldManifestV1>;
    finalByChapter: Readonly<ForwardValidationCampaignResultV1["finalByChapter"]>;
    calls: readonly [ForwardGoldEvaluatorCallV1, ForwardGoldEvaluatorCallV1, ForwardGoldEvaluatorCallV1];
    results: readonly [TResult, TResult, TResult];
  }) => Promise<ForwardGoldBookEvaluationV1> | ForwardGoldBookEvaluationV1;
}): LedgerBoundForwardGoldEvaluator {
  const evaluator = (async (input: {
    manifest: Readonly<ForwardGoldManifestV1>;
    finalByChapter: Readonly<ForwardValidationCampaignResultV1["finalByChapter"]>;
  }) => {
    const calls = args.buildCalls(input);
    requireCondition(calls.length === 3, "gold evaluation requires exactly two blind raters plus one adjudicator");
    requireCondition(new Set(calls.map((call) => call.callId)).size === 3, "gold evaluator call ids must be distinct");
    requireCondition(new Set(calls.map((call) => call.actorId)).size === 3, "gold evaluator actors must be independent");
    const bookId = input.manifest.targets[0]?.bookId;
    requireCondition(typeof bookId === "string" && bookId.length > 0, "gold evaluator has no frozen book id");
    const results: TResult[] = [];
    for (const call of calls) {
      results.push(await runLedgeredForwardModelOperation({
        controller: args.controller,
        phaseDir: args.phaseDir,
        context: {
          category: "gold-book-evaluator",
          bookId,
          chapterNumber: null,
          stage: "book-evaluation",
          logicalOperationId: `${bookId}/book-evaluation/${call.callId}`,
        },
        request: { actorId: call.actorId, request: call.request },
        execute: () => args.execute(call),
        classifyError: providerFailure,
      }));
    }
    return args.assemble({ ...input, calls, results: results as [TResult, TResult, TResult] });
  }) as LedgerBoundForwardGoldEvaluator;
  Object.defineProperty(evaluator, "liveLedgerBound", { value: true, enumerable: true });
  Object.defineProperty(evaluator, "executionBoundary", { value: "injected-test", enumerable: true });
  return evaluator;
}

/** Production gold evaluator broker. Unlike the injected test seam above, this
 * owns the real hermetic codex-exec primitive and binds every call to an exact
 * prompt, schema, model/effort, isolated read-only workspace, and artifact
 * inventory before reserving the ledger entry. */
export function createProductionLedgeredForwardGoldEvaluator(args: {
  controller: ForwardLiveCallLedgerController;
  phaseDir: string;
  buildCalls: (input: { manifest: Readonly<ForwardGoldManifestV1>; finalByChapter: Readonly<ForwardValidationCampaignResultV1["finalByChapter"]> }) => readonly ForwardProductionGoldEvaluatorCallV1[];
  prepareAdjudicator?: (input: {
    call: ForwardProductionGoldEvaluatorCallV1;
    raterCalls: readonly ForwardProductionGoldEvaluatorCallV1[];
    raterResults: readonly ForwardProductionGoldEvaluatorResultV1[];
  }) => ForwardProductionGoldEvaluatorCallV1;
  prepareBookSweep?: (input: {
    call: ForwardProductionGoldEvaluatorCallV1;
    adjudicatorCall: ForwardProductionGoldEvaluatorCallV1;
    adjudicatorResult: ForwardProductionGoldEvaluatorResultV1;
  }) => ForwardProductionGoldEvaluatorCallV1;
  assemble: (input: {
    manifest: Readonly<ForwardGoldManifestV1>;
    finalByChapter: Readonly<ForwardValidationCampaignResultV1["finalByChapter"]>;
    calls: readonly ForwardProductionGoldEvaluatorCallV1[];
    results: readonly ForwardProductionGoldEvaluatorResultV1[];
  }) => Promise<ForwardGoldBookEvaluationV1> | ForwardGoldBookEvaluationV1;
}): LedgerBoundForwardGoldEvaluator {
  const evaluator = (async (input: {
    manifest: Readonly<ForwardGoldManifestV1>;
    finalByChapter: Readonly<ForwardValidationCampaignResultV1["finalByChapter"]>;
  }) => {
    const calls = [...args.buildCalls(input)];
    requireCondition(calls.length === 4, "gold evaluation requires two blind raters, one adjudicator, and one independent book sweep");
    requireCondition(new Set(calls.map((call) => call.callId)).size === 4, "gold evaluator call ids must be distinct");
    requireCondition(new Set(calls.map((call) => call.actorId)).size === 4, "gold evaluator/sweep actors must be independent");
    requireCondition(calls.filter((call) => call.evaluationRole === "blind-rater").length === 2
      && calls.filter((call) => call.evaluationRole === "adjudicator").length === 1
      && calls.filter((call) => call.evaluationRole === "book-sweep").length === 1,
    "gold evaluation requires exactly two blind-rater calls, one adjudicator, and one book sweep");
    const bookId = input.manifest.targets[0]?.bookId;
    requireCondition(typeof bookId === "string" && bookId.length > 0, "gold evaluator has no frozen book id");
    const results: ForwardProductionGoldEvaluatorResultV1[] = [];
    const validateRetainedResult = (
      call: ForwardProductionGoldEvaluatorCallV1,
      retained: ForwardProductionGoldEvaluatorResultV1,
    ): void => {
      requireCondition(retained.actorId === call.actorId
        && typeof retained.executionId === "string" && retained.executionId.trim().length > 0
        && retained.outputSha256 === hashCanonical(retained.output),
      `${call.callId}: retained evaluator result identity/hash is stale or malformed`);
      if (call.evaluationRole === "blind-rater") {
        requireCondition(call.blindRaterRole !== null, `${call.callId}: blind-rater role binding is missing`);
        validateForwardGoldBlindRaterOutput(retained.output, {
          expectedBookId: bookId,
          expectedSourceHash: call.sourceHash,
          expectedChapters: call.expectedChapters,
          expectedRaterRole: call.blindRaterRole,
          expectedDispatchReceiptSha256: call.dispatchReceiptSha256,
        });
        return;
      }
      if (call.evaluationRole === "book-sweep") {
        validateForwardGoldSweepOutputBinding(retained.output, {
          expectedSourceHash: call.sourceHash,
          expectedDispatchReceiptSha256: call.dispatchReceiptSha256,
        });
        return;
      }
      const retainedBlindRaters = calls.map((candidate, index) => ({ candidate, result: results[index] }))
        .filter((entry): entry is {
          candidate: ForwardProductionGoldEvaluatorCallV1 & { blindRaterRole: "primary" | "verification" };
          result: ForwardProductionGoldEvaluatorResultV1;
        } => entry.candidate.evaluationRole === "blind-rater"
          && entry.candidate.blindRaterRole !== null
          && entry.result !== undefined);
      const primary = retainedBlindRaters.find((entry) => entry.candidate.blindRaterRole === "primary");
      const verification = retainedBlindRaters.find((entry) => entry.candidate.blindRaterRole === "verification");
      requireCondition(primary !== undefined && verification !== undefined,
        `${call.callId}: adjudication validation requires both exact retained blind-rater outputs`);
      projectForwardGoldAdjudication(retained.output, {
        expectedBookId: bookId,
        expectedSourceHash: call.sourceHash,
        expectedChapters: call.expectedChapters,
        sourceAwareExternalAccuracy: call.sourceAwareExternalAccuracy,
        expectedSourceLaneEvidence: call.expectedSourceLaneEvidence,
        blindRaters: {
          primary: {
            output: primary.result.output,
            expectedDispatchReceiptSha256: primary.candidate.dispatchReceiptSha256,
          },
          verification: {
            output: verification.result.output,
            expectedDispatchReceiptSha256: verification.candidate.dispatchReceiptSha256,
          },
        },
      });
    };
    for (let callIndex = 0; callIndex < calls.length; callIndex++) {
      let call = calls[callIndex];
      requireCondition(/^[a-z0-9][a-z0-9._-]{0,63}$/.test(call.callId),
        `unsafe gold evaluator call id: ${call.callId}`);
      if (call.evaluationRole === "adjudicator") {
        const priorRaterCalls = calls.slice(0, callIndex).filter((candidate) => candidate.evaluationRole === "blind-rater");
        const priorRaterResults = results.filter((_, index) => calls[index].evaluationRole === "blind-rater");
        requireCondition(priorRaterCalls.length === 2 && priorRaterResults.length === 2,
          "gold adjudicator cannot run until both blind-rater receipts are retained");
        requireCondition(typeof args.prepareAdjudicator === "function",
          "gold adjudicator requires an explicit rater-output materialization callback");
        call = args.prepareAdjudicator({ call, raterCalls: priorRaterCalls, raterResults: priorRaterResults });
        calls[callIndex] = call;
      } else if (call.evaluationRole === "book-sweep") {
        const priorAdjudicatorIndex = calls.slice(0, callIndex).findIndex((candidate) => candidate.evaluationRole === "adjudicator");
        requireCondition(priorAdjudicatorIndex >= 0 && results[priorAdjudicatorIndex] !== undefined,
          "gold sweep cannot run until the adjudicated output is retained");
        requireCondition(typeof args.prepareBookSweep === "function",
          "gold sweep requires an explicit adjudicated-output binding callback");
        call = args.prepareBookSweep({
          call,
          adjudicatorCall: calls[priorAdjudicatorIndex],
          adjudicatorResult: results[priorAdjudicatorIndex],
        });
        calls[callIndex] = call;
      }
      const cwd = resolve(call.cwd);
      requireCondition(cwd.startsWith(`${resolve(args.phaseDir)}/`), `${call.callId}: evaluator workspace escapes the gold phase root`);
      requireCondition(call.task.trim().length > 0 && SHA256.test(call.outputSchemaSha256), `${call.callId}: evaluator prompt/schema binding is incomplete`);
      requireCondition(sha256Hex(readFileSync(call.outputSchemaPath)) === call.outputSchemaSha256, `${call.callId}: evaluator output schema hash drift`);
      const declared = new Map(call.artifacts.map((artifact) => [artifact.relativePath, artifact.bytesSha256]));
      const actualFiles = filesBelow(cwd).map((path) => relative(cwd, path));
      requireCondition(actualFiles.length === declared.size && actualFiles.every((path) => declared.has(path)),
        `${call.callId}: evaluator workspace contains undeclared or missing artifacts`);
      for (const [relPath, expectedSha256] of declared) {
        requireCondition(sha256Hex(readFileSync(resolve(cwd, relPath))) === expectedSha256, `${call.callId}: evaluator artifact hash drift (${relPath})`);
      }
      const retained = await runLedgeredForwardModelOperation({
        controller: args.controller,
        phaseDir: args.phaseDir,
        context: {
          category: "gold-book-evaluator",
          bookId,
          chapterNumber: null,
          stage: "book-evaluation",
          logicalOperationId: `${bookId}/book-evaluation/${call.callId}`,
        },
        request: {
          actorId: call.actorId,
          evaluationRole: call.evaluationRole,
          taskSha256: sha256Hex(call.task),
          model: call.model,
          effort: call.effort,
          outputSchemaSha256: call.outputSchemaSha256,
          instrumentSha256: call.instrumentSha256,
          productionInstrumentSealSha256: call.productionInstrumentSealSha256,
          sourceHash: call.sourceHash,
          dispatchReceiptSha256: call.dispatchReceiptSha256,
          expectedChaptersSha256: hashCanonical(call.expectedChapters),
          sourceAwareExternalAccuracyProofSha256: call.sourceAwareExternalAccuracy.proofSha256,
          artifacts: [...call.artifacts].sort((a, b) => a.relativePath.localeCompare(b.relativePath)),
        },
        execute: async (attemptNumber) => {
          const executionId = `imp22-gold-${call.callId}-attempt-${attemptNumber}`;
          const spawn = await spawnCodexAgent({
            task: call.task,
            role: "eval-book",
            sessionId: executionId,
            cwd,
            sandbox: "read-only",
            skipGitRepoCheck: true,
            model: call.model,
            reasoningEffort: call.effort,
            outputSchemaPath: call.outputSchemaPath,
            manifestSink: resolve(args.phaseDir, "execution", "gold", call.callId, "manifests"),
            qualificationCacheDir: resolve(args.phaseDir, "execution", "gold", call.callId, "cli-qualification-cache"),
            execBaseDir: resolve(args.phaseDir, "execution", "gold", call.callId, "sessions"),
          });
          const failure = failedSpawn(spawn);
          if (failure) throw failure;
          let output: unknown;
          try { output = JSON.parse(spawn.finalMessage); }
          catch (error) { throw new ForwardReviewerExecutorError(`${call.callId}: evaluator returned invalid JSON (${(error as Error).message})`, "invalid_output"); }
          const result = { actorId: call.actorId, executionId, output, outputSha256: hashCanonical(output) };
          validateRetainedResult(call, result);
          return {
            executionId,
            result,
          };
        },
        classifyError: providerFailure,
      });
      // Mandatory even on resume: runLedgeredForwardModelOperation may return a
      // cached result without invoking execute, so no downstream role may see
      // the result until the current fixed instrument has revalidated it.
      validateRetainedResult(call, retained);
      results.push(retained);
    }
    const typedResults = results;
    const evaluation = await args.assemble({ ...input, calls, results: typedResults });
    const adjudicatorIndex = calls.findIndex((call) => call.evaluationRole === "adjudicator");
    const raterIndexes = calls.map((call, index) => ({ call, index })).filter(({ call }) => call.evaluationRole === "blind-rater");
    const adjudicatorCall = calls[adjudicatorIndex];
    const adjudicatorResult = typedResults[adjudicatorIndex];
    const projectedEvaluation = {
      technicalCompleteness: evaluation.technicalCompleteness,
      epistemicInstructionalSafety: evaluation.epistemicInstructionalSafety,
      ethicsReaderAutonomy: evaluation.ethicsReaderAutonomy,
      purposeAudienceDeclaration: evaluation.purposeAudienceDeclaration,
      externalAccuracy: evaluation.externalAccuracy,
      contentDesignScore: evaluation.contentDesignScore,
    };
    const primaryIndex = raterIndexes.find(({ call }) => call.blindRaterRole === "primary")?.index;
    const verificationIndex = raterIndexes.find(({ call }) => call.blindRaterRole === "verification")?.index;
    requireCondition(primaryIndex !== undefined && verificationIndex !== undefined,
      "gold result binding requires both exact retained blind-rater outputs");
    const reprojected = projectForwardGoldAdjudication(adjudicatorResult.output, {
      expectedBookId: bookId,
      expectedSourceHash: adjudicatorCall.sourceHash,
      expectedChapters: adjudicatorCall.expectedChapters,
      sourceAwareExternalAccuracy: adjudicatorCall.sourceAwareExternalAccuracy,
      expectedSourceLaneEvidence: adjudicatorCall.expectedSourceLaneEvidence,
      blindRaters: {
        primary: {
          output: typedResults[primaryIndex].output,
          expectedDispatchReceiptSha256: calls[primaryIndex].dispatchReceiptSha256,
        },
        verification: {
          output: typedResults[verificationIndex].output,
          expectedDispatchReceiptSha256: calls[verificationIndex].dispatchReceiptSha256,
        },
      },
    });
    requireCondition(hashCanonical(projectedEvaluation) === hashCanonical(reprojected),
      "gold evaluation fields are not the deterministic projection of the exact retained adjudicator and blind-rater outputs");
    requireCondition(evaluation.evidenceBinding.evaluator.actorId === adjudicatorCall.actorId
      && evaluation.evidenceBinding.evaluator.executionId === adjudicatorResult.executionId
      && evaluation.evidenceBinding.evaluator.payloadSha256 === hashCanonical(projectedEvaluation),
    "gold evaluator evidence ref is not bound to the actual adjudicator call receipt");
    for (const { call, index } of raterIndexes) {
      const result = typedResults[index];
      requireCondition(evaluation.evidenceBinding.raters.some((ref) => ref.actorId === call.actorId
        && ref.executionId === result.executionId
        && ref.payloadSha256 === result.outputSha256),
      `gold rater evidence ref is not bound to the actual ${call.callId} receipt`);
    }
    return evaluation;
  }) as LedgerBoundForwardGoldEvaluator;
  Object.defineProperty(evaluator, "liveLedgerBound", { value: true, enumerable: true });
  Object.defineProperty(evaluator, "executionBoundary", { value: "hermetic-codex-broker", enumerable: true });
  return evaluator;
}

function panelRoleFor(request: Readonly<ForwardReviewExecutionRequestV1>, freeze: ForwardRoleAssignmentFreezeV1): ForwardPanelRole {
  const assignment = freeze.roleAssignment;
  if (request.lane === "quiz") return "quizSemanticAdjudicator";
  if (request.lane === "reader") return request.profileId === assignment.readerPrimary.profileId ? "readerPrimary" : "readerAudit";
  return request.profileId === assignment.sourcePrimary.profileId ? "sourcePrimary" : "sourceAdjudicator";
}

export type RunForwardLiveCampaignResultV1 = {
  schema: typeof FORWARD_LIVE_CAMPAIGN_RESULT_SCHEMA;
  preflight: ForwardLiveCampaignPreflightV1;
  budgetSha256: string;
  campaign: ForwardValidationCampaignResultV1;
  codexExecInvocations: number;
  cachedReceipts: number;
  infrastructureReplays: number;
  maxPlanCapacityEvents: number;
  safeguardsOrRefusals: number;
  apiCallsMade: 0;
  publish: false;
  promote: false;
  deploy: false;
  upload: false;
};

/** Run one frozen phase. The injected author producer must come from
 * createLedgeredDeferredAuthorProducer; gold likewise requires the branded
 * three-call evaluator. Reviewers are wrapped here and cannot bypass ledgering. */
export async function runForwardLiveCampaign(args: {
  phaseDir: string;
  manifest: FrozenForwardValidationManifestV1;
  inputFreeze: ForwardInputFreezeV1;
  roleFreeze: ForwardRoleAssignmentFreezeV1;
  qualification: ForwardInspectedQualificationProofV1;
  route: ForwardNoApiChatgptRouteProofV1;
  verifiedInputMaterializationSha256: string;
  verifiedProductionInstrumentSealSha256: string;
  verifiedGoldEvaluatorInstrumentSha256?: string;
  createAuthorProducer: (controller: ForwardLiveCallLedgerController) => LedgerBoundForwardCandidateProducer;
  buildConductorInput: ForwardValidationCampaignDeps["buildConductorInput"];
  routeFirstFailure: ForwardValidationCampaignDeps["routeFirstFailure"];
  classifyFailedRepair: ForwardValidationCampaignDeps["classifyFailedRepair"];
  preserveAttempt: ForwardValidationCampaignDeps["preserveAttempt"];
  freezeFirstWriteMetrics: ForwardValidationCampaignDeps["freezeFirstWriteMetrics"];
  readPersistedEvidence: ForwardValidationCampaignDeps["readPersistedEvidence"];
  beforeReviewerCall?: () => Promise<void> | void;
  loadPreservedAttempt?: ForwardValidationCampaignDeps["loadPreservedAttempt"];
  assertFinalFreshness?: (campaign: Readonly<ForwardValidationCampaignResultV1>) => Promise<void> | void;
  createGoldEvaluator?: (controller: ForwardLiveCallLedgerController) => LedgerBoundForwardGoldEvaluator;
}): Promise<RunForwardLiveCampaignResultV1> {
  const preflight = preflightForwardLiveCampaign(args);
  const budget = buildForwardLivePhaseBudget({
    manifest: args.manifest,
    panelPolicy: args.roleFreeze.panelPolicy,
    ...(args.manifest.manifest.kind === "gold"
      ? { goldBookEvaluatorExpectedCalls: 4, goldBookEvaluatorMaximumCallsBeforeReplay: 4 }
      : {}),
  });
  mkdirSync(args.phaseDir, { recursive: true });
  writeJson(resolve(args.phaseDir, "live-preflight.json"), preflight);
  writeJson(resolve(args.phaseDir, "validation-manifest.json"), args.manifest);
  const controller = createForwardLiveCallLedger({ budget, phaseDir: args.phaseDir });
  const authorProducer = args.createAuthorProducer(controller);
  requireCondition(authorProducer?.liveLedgerBound === true, "live campaign refuses an unledgered author producer");
  requireCondition(authorProducer.executionBoundary === "hermetic-codex-broker", "live campaign refuses an injected author execution boundary");
  const goldEvaluator = args.createGoldEvaluator?.(controller);
  if (args.manifest.manifest.kind === "gold") {
    requireCondition(goldEvaluator?.liveLedgerBound === true, "gold campaign refuses an unledgered evaluator");
    requireCondition(goldEvaluator.executionBoundary === "hermetic-codex-broker", "gold campaign refuses an injected evaluator execution boundary");
  }
  let active: { bookId: string; chapterNumber: number; stage: ForwardCandidateRequestV1["stage"] } | null = null;
  const stageByAttempt = new Map<string, ForwardCandidateRequestV1["stage"]>();
  const reviewer = createLedgeredForwardReviewerExecutor({
    controller,
    phaseDir: args.phaseDir,
    executor: createForwardReviewerExecutor({
      workspaceBaseDir: resolve(args.phaseDir, "reviewer-workspaces"),
      manifestSink: resolve(args.phaseDir, "execution", "reviewers", "manifests"),
      qualificationCacheDir: resolve(args.phaseDir, "execution", "reviewers", "cli-qualification-cache"),
      execBaseDir: resolve(args.phaseDir, "execution", "reviewers", "sessions"),
    }),
    contextFor: (request) => {
      requireCondition(active !== null, "reviewer executed outside a bound campaign attempt");
      const panelRole = panelRoleFor(request, args.roleFreeze);
      return {
        ...active,
        logicalOperationId: `${active.bookId}/ch${String(active.chapterNumber).padStart(2, "0")}/${active.stage}/${panelRole}`,
      };
    },
    categoryFor: (request) => categoryForForwardPanelRole(args.manifest.manifest.kind, panelRoleFor(request, args.roleFreeze)),
    beforeCall: () => args.beforeReviewerCall?.(),
  });
  const buildConductorInput: ForwardValidationCampaignDeps["buildConductorInput"] = async (input) => {
    stageByAttempt.set(input.prepared.attempt.identity.attemptId, input.stage);
    return args.buildConductorInput(input);
  };
  const conductCandidate: NonNullable<ForwardValidationCampaignDeps["conductCandidate"]> = async (input: ForwardChapterConductorInputV1) => {
    const stage = stageByAttempt.get(input.prepared.attempt.identity.attemptId);
    requireCondition(stage !== undefined, "candidate reached review without a bound campaign stage");
    active = { bookId: input.prepared.bookId, chapterNumber: input.prepared.chapterNumber, stage };
    try { return await runForwardChapterConductor(input, { executor: reviewer }); }
    finally { active = null; }
  };
  const campaign = await runForwardValidationCampaign(args.manifest, {
    produceCandidate: authorProducer,
    buildConductorInput,
    conductCandidate,
    routeFirstFailure: args.routeFirstFailure,
    classifyFailedRepair: args.classifyFailedRepair,
    preserveAttempt: args.preserveAttempt,
    freezeFirstWriteMetrics: args.freezeFirstWriteMetrics,
    readPersistedEvidence: args.readPersistedEvidence,
    ...(args.loadPreservedAttempt ? { loadPreservedAttempt: args.loadPreservedAttempt } : {}),
    ...(goldEvaluator ? { evaluateGoldBook: goldEvaluator } : {}),
  });
  await args.assertFinalFreshness?.(campaign);
  const result: RunForwardLiveCampaignResultV1 = {
    schema: FORWARD_LIVE_CAMPAIGN_RESULT_SCHEMA,
    preflight,
    budgetSha256: budget.budgetSha256,
    campaign,
    codexExecInvocations: controller.ledger.codexExecInvocations,
    cachedReceipts: controller.ledger.cachedReceipts,
    infrastructureReplays: controller.ledger.infrastructureReplays,
    maxPlanCapacityEvents: controller.ledger.maxPlanCapacityEvents,
    safeguardsOrRefusals: controller.ledger.safeguardsOrRefusals,
    apiCallsMade: 0,
    publish: false,
    promote: false,
    deploy: false,
    upload: false,
  };
  writeJson(resolve(args.phaseDir, "campaign-result.json"), result);
  return result;
}

/** Small reusable durable sink for production and injected tests. */
export function createForwardCampaignEvidenceStore(root: string): Pick<ForwardValidationCampaignDeps,
  "preserveAttempt" | "freezeFirstWriteMetrics" | "readPersistedEvidence" | "loadPreservedAttempt"> {
  const rootAbs = resolve(root);
  const byStorageId = (storageId: string): string => {
    requireCondition(typeof storageId === "string" && storageId.length > 0, "evidence storage id is empty");
    const path = resolve(rootAbs, storageId);
    requireCondition(path.startsWith(`${rootAbs}/`), `evidence storage id escapes the campaign root: ${storageId}`);
    return path;
  };
  const preserve = (kind: "attempt" | "first-write-snapshot", value: unknown, sha256: string, storageId: string) => {
    const path = byStorageId(storageId);
    if (existsSync(path)) {
      const retained = JSON.parse(readFileSync(path, "utf8"));
      requireCondition(hashCanonical(retained) === sha256,
        `${kind}: retained create-once evidence differs; refusing to overwrite a frozen campaign artifact`);
    } else {
      writeJson(path, value);
    }
    const retained = JSON.parse(readFileSync(path, "utf8"));
    requireCondition(hashCanonical(retained) === sha256, `${kind}: durable write/read-back hash mismatch`);
    return { schema: "forward-persistence-receipt-v1" as const, kind, storageId, contentSha256: sha256 };
  };
  return {
    preserveAttempt: (record, sha256) => preserve("attempt", record, sha256,
      `evidence/attempts/${record.chapterKey.replace("/", "--")}/${record.stage}-${record.attemptId ?? "production-failure"}.json`),
    freezeFirstWriteMetrics: (snapshot, sha256) => preserve("first-write-snapshot", snapshot, sha256, "evidence/first-write-snapshot.json"),
    readPersistedEvidence: (receipt) => JSON.parse(readFileSync(byStorageId(receipt.storageId), "utf8")),
    loadPreservedAttempt: ({ target, stage }) => {
      const key = `${target.bookId}--ch${String(target.chapterNumber).padStart(2, "0")}`;
      const dir = byStorageId(`evidence/attempts/${key}`);
      if (!existsSync(dir)) return null;
      const matches = readdirSync(dir).filter((name) => name.startsWith(`${stage}-`) && name.endsWith(".json")).sort();
      requireCondition(matches.length <= 1, `${target.bookId}/ch${target.chapterNumber}: multiple retained ${stage} attempts violate exact resume`);
      if (matches.length === 0) return null;
      const record = readJson<ForwardValidationCampaignResultV1["attempts"][number]>(resolve(dir, matches[0]));
      if (record.pass) {
        const outputPath = resolve(
          rootAbs,
          "live-campaign",
          "outputs",
          target.outputRunId,
          "chapters",
          chapterFileNameFor(target.chapterId),
        );
        requireCondition(existsSync(outputPath), `${record.chapterKey}: preserved PASS output is missing on resume`);
        const bytes = readFileSync(outputPath, "utf8");
        requireCondition(sha256Hex(bytes) === record.candidateBytesSha256,
          `${record.chapterKey}: preserved PASS output bytes drifted on resume`);
        let chapter: ChapterV21;
        try { chapter = JSON.parse(bytes) as ChapterV21; }
        catch (error) { throw new ForwardLiveValidationDriverError(`${record.chapterKey}: preserved PASS output is malformed (${(error as Error).message})`); }
        requireCondition(chapterContentHash(chapter) === record.candidateContentSha256,
          `${record.chapterKey}: preserved PASS content hash drifted on resume`);
        requireCondition(record.executionEnvelope?.candidateBytesSha256 === record.candidateBytesSha256
          && record.executionEnvelope?.candidateContentSha256 === record.candidateContentSha256,
        `${record.chapterKey}: preserved PASS execution envelope is stale`);
        const provenancePath = resolve(rootAbs, "live-campaign", "outputs", target.outputRunId, "provenance", `${target.chapterId}.json`);
        requireCondition(existsSync(provenancePath), `${record.chapterKey}: preserved PASS provenance is missing on resume`);
        const provenance = readJson<AuthorProvenance>(provenancePath);
        requireCondition(typeof provenance.authorSessionId === "string" && provenance.authorSessionId.length > 0
          && provenance.contentHash === record.candidateContentSha256,
        `${record.chapterKey}: preserved PASS provenance is stale on resume`);
        requireCondition(record.attemptDir !== null && existsSync(resolve(record.attemptDir, "commit-manifest.json")),
          `${record.chapterKey}: preserved PASS commit manifest is missing on resume`);
        const commit = readJson<{ phase?: string; committedSha256?: string }>(resolve(record.attemptDir!, "commit-manifest.json"));
        requireCondition(commit.phase === "committed" && commit.committedSha256 === record.candidateBytesSha256,
          `${record.chapterKey}: preserved PASS commit bracket is not complete/current`);
      }
      return record;
    },
  };
}

export type ForwardExplicitLiveArtifactPathsV1 = {
  expectedKind: ForwardLiveCampaignKind;
  phaseDir: string;
  manifestPath: string;
  inputFreezePath: string;
  inputMaterializationPath: string;
  productionInstrumentSealPath: string;
  calibrationSealPath: string;
  calibrationInspectionPath: string;
  qualificationResultPath: string;
  qualificationBundlePath: string;
  roleAssignmentFreezePath: string;
  goldEvaluatorConfigPath?: string;
};

type ForwardMaterializedBookEntryV1 = {
  bookId: string;
  stateRootRelPath: string;
  inputSha256: string;
  bookBriefSha256: string;
  chapterBriefSha256: Record<string, string>;
  files: Array<{ relativePath: string; bytesSha256: string }>;
};

export type ForwardInputMaterializationProofV1 = {
  schema: "forward-input-materialization-proof-v1";
  artifactPath: string;
  artifactBytesSha256: string;
  inputFreezeSha256: string;
  bookInputSha256: Record<string, string>;
  bookManifestSha256: Record<string, string>;
  bookFileInventory: Record<string, Record<string, string>>;
  proofSha256: string;
};

/** Re-read every author/evaluator input byte named by input-materialization.json.
 * The exact file inventory is enforced, including index, manual brief,
 * brief.json, brief.md, packet, plan, sidecar, anchors, and the per-book
 * forward-input-manifest.  This function is intentionally reusable at both
 * pre-call and final-acceptance boundaries. */
export function validateForwardInputMaterializationArtifact(args: {
  phaseDir: string;
  artifactPath: string;
  manifest: FrozenForwardValidationManifestV1;
  inputFreeze: ForwardInputFreezeV1;
}): ForwardInputMaterializationProofV1 {
  const phaseDir = resolve(args.phaseDir);
  const artifactPath = resolve(args.artifactPath);
  requireCondition(existsSync(artifactPath), `input materialization artifact is missing: ${artifactPath}`);
  const artifactBytes = readFileSync(artifactPath);
  const artifactBytesSha256 = sha256Hex(artifactBytes);
  requireCondition(artifactBytesSha256 === args.manifest.manifest.inputMaterializationSha256,
    "input materialization artifact hash differs from the frozen campaign manifest");
  let materialization: {
    schema?: unknown;
    inputFreezeSha256?: unknown;
    pilot?: unknown;
    gold?: unknown;
    priorChapterProseUsed?: unknown;
    capabilities?: unknown;
  };
  try { materialization = JSON.parse(artifactBytes.toString("utf8")); }
  catch (error) { throw new ForwardLiveValidationDriverError(`input materialization artifact is invalid JSON (${(error as Error).message})`); }
  requireCondition(materialization.schema === "imp22-forward-input-materialization-v1",
    "input materialization artifact has the wrong schema");
  requireCondition(materialization.inputFreezeSha256 === args.inputFreeze.freezeSha256,
    "input materialization artifact is bound to another input freeze");
  requireCondition(materialization.priorChapterProseUsed === false,
    "input materialization artifact admits prior chapter prose");
  requireCondition(hashCanonical(materialization.capabilities) === hashCanonical({ publish: false, promote: false, deploy: false, upload: false }),
    "input materialization artifact carries external capabilities");
  const rawEntries = args.manifest.manifest.kind === "pilot"
    ? materialization.pilot
    : [materialization.gold];
  requireCondition(Array.isArray(rawEntries), "input materialization artifact has no phase book inventory");
  const entries = rawEntries as ForwardMaterializedBookEntryV1[];
  const expectedBookIds = [...new Set(args.manifest.manifest.targets.map((target) => target.bookId))].sort();
  requireCondition(hashCanonical(entries.map((entry) => entry.bookId).sort()) === hashCanonical(expectedBookIds),
    "input materialization book inventory differs from the frozen campaign denominator");
  const bookInputSha256: Record<string, string> = {};
  const bookManifestSha256: Record<string, string> = {};
  const bookFileInventory: Record<string, Record<string, string>> = {};
  for (const entry of entries) {
    requireCondition(entry && typeof entry === "object" && typeof entry.bookId === "string" && expectedBookIds.includes(entry.bookId),
      "input materialization contains an unknown book entry");
    requireCondition(typeof entry.stateRootRelPath === "string" && !entry.stateRootRelPath.startsWith("/")
      && !entry.stateRootRelPath.split(/[\\/]/).includes("..")
      && entry.stateRootRelPath.replaceAll("\\", "/").endsWith(`/inputs/${entry.bookId}`),
    `${entry.bookId}: materialized state-root coordinate is unsafe or stale`);
    const inputRoot = resolve(phaseDir, "inputs", entry.bookId);
    requireCondition(existsSync(inputRoot), `${entry.bookId}: materialized input root is missing`);
    requireCondition(Array.isArray(entry.files) && entry.files.length > 0,
      `${entry.bookId}: materialized file inventory is empty`);
    const declared = new Map<string, string>();
    for (const file of entry.files) {
      requireCondition(typeof file.relativePath === "string" && file.relativePath.length > 0
        && !file.relativePath.startsWith("/") && !file.relativePath.split(/[\\/]/).includes(".."),
      `${entry.bookId}: materialized file path is unsafe`);
      requireCondition(SHA256.test(file.bytesSha256) && !declared.has(file.relativePath),
        `${entry.bookId}: materialized file inventory has an invalid hash or duplicate path`);
      const path = resolve(inputRoot, file.relativePath);
      requireCondition(path.startsWith(`${inputRoot}/`) && existsSync(path) && statSync(path).isFile(),
        `${entry.bookId}: materialized file is missing: ${file.relativePath}`);
      requireCondition(sha256Hex(readFileSync(path)) === file.bytesSha256,
        `${entry.bookId}: materialized file bytes drifted: ${file.relativePath}`);
      declared.set(file.relativePath, file.bytesSha256);
    }
    const actual = filesBelow(inputRoot).map((path) => relative(inputRoot, path)).sort();
    requireCondition(hashCanonical(actual) === hashCanonical([...declared.keys()].sort()),
      `${entry.bookId}: materialized input root contains undeclared or missing files`);
    const bookManifestPath = resolve(inputRoot, "forward-input-manifest.json");
    requireCondition(declared.has("forward-input-manifest.json") && existsSync(bookManifestPath),
      `${entry.bookId}: per-book forward-input-manifest is not frozen`);
    const bookManifest = readJson<{
      schema?: unknown;
      bookId?: unknown;
      bookBriefSha256?: unknown;
      chapterBriefSha256?: unknown;
      chapters?: Array<{ spec?: { chapterId?: unknown; chapterNumber?: unknown } }>;
      priorChapterProseUsed?: unknown;
    }>(bookManifestPath);
    requireCondition(bookManifest.schema === "forward-materialized-book-input-v1" && bookManifest.bookId === entry.bookId,
      `${entry.bookId}: per-book forward-input-manifest identity drift`);
    requireCondition(bookManifest.priorChapterProseUsed === false,
      `${entry.bookId}: per-book input manifest admits prior chapter prose`);
    requireCondition(hashCanonical(bookManifest) === entry.inputSha256,
      `${entry.bookId}: per-book forward-input-manifest hash drift`);
    requireCondition(bookManifest.bookBriefSha256 === entry.bookBriefSha256
      && hashCanonical(bookManifest.chapterBriefSha256) === hashCanonical(entry.chapterBriefSha256),
    `${entry.bookId}: materialization summary differs from the per-book manifest`);
    const manualBrief = readJson(resolve(inputRoot, "briefs", `${entry.bookId}.manual-brief.json`));
    requireCondition(hashCanonical(manualBrief) === entry.bookBriefSha256,
      `${entry.bookId}: manual brief hash drift`);
    const chapterSpecs = bookManifest.chapters ?? [];
    requireCondition(chapterSpecs.length === Object.keys(entry.chapterBriefSha256).length,
      `${entry.bookId}: chapter brief denominator drift`);
    for (const chapter of chapterSpecs) {
      const chapterId = chapter.spec?.chapterId;
      const chapterNumber = chapter.spec?.chapterNumber;
      requireCondition(typeof chapterId === "string" && Number.isInteger(chapterNumber),
        `${entry.bookId}: per-book manifest has an invalid chapter spec`);
      const nn = String(chapterNumber).padStart(2, "0");
      const brief = readJson(resolve(inputRoot, "books", entry.bookId, "runs", "imp22-inputs-v1", "briefs", `ch${nn}.brief.json`));
      requireCondition(hashCanonical(brief) === entry.chapterBriefSha256[chapterId],
        `${entry.bookId}/${chapterId}: chapter brief hash drift`);
      requireCondition(declared.has(`books/${entry.bookId}/runs/imp22-inputs-v1/briefs/ch${nn}.brief.md`),
        `${entry.bookId}/${chapterId}: rendered brief is outside the frozen inventory`);
    }
    bookInputSha256[entry.bookId] = entry.inputSha256;
    bookManifestSha256[entry.bookId] = hashCanonical(bookManifest);
    bookFileInventory[entry.bookId] = Object.fromEntries([...declared.entries()].sort(([a], [b]) => a.localeCompare(b)));
  }
  const core = {
    schema: "forward-input-materialization-proof-v1" as const,
    artifactPath,
    artifactBytesSha256,
    inputFreezeSha256: args.inputFreeze.freezeSha256,
    bookInputSha256,
    bookManifestSha256,
    bookFileInventory,
  };
  return { ...core, proofSha256: hashCanonical(core) };
}

export function assertExplicitForwardManifestKind(
  expectedKind: ForwardLiveCampaignKind,
  manifest: FrozenForwardValidationManifestV1,
): void {
  requireCondition(manifest.manifest.kind === expectedKind,
    `forward-${expectedKind}: explicit manifest kind is ${manifest.manifest.kind}; refusing before any live call`);
}

function chapterFileNameFor(chapterId: string): string {
  return `${chapterId}.v21-native.chapter.json`;
}

function readJsonOrNull<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  return readJson<T>(path);
}

/** Build a complete AuthorIo whose every mutable surface is below one exact
 * output-run directory. Immutable packets/plans/briefs remain below the
 * materialized phase input root; no default canonical AuthorIo method survives. */
export function createExplicitExperimentAuthorDestination(args: {
  phaseDir: string;
  target: ForwardCandidateRequestV1["target"];
  /** Exact per-book file map returned by the immediately preceding full
   * input-materialization proof. */
  expectedInputFileInventory: Record<string, string>;
  /** Hermetic test seam; production always uses chapterTransaction.gateCandidate. */
  gateCandidateImpl?: typeof gateCandidate;
}): { io: AuthorIo; destinationProof: ForwardExperimentDestinationProofV1 } {
  const phaseDir = resolve(args.phaseDir);
  const target = args.target;
  const experimentRootAbs = resolve(phaseDir, "live-campaign", "outputs", target.outputRunId);
  requireCondition(basename(experimentRootAbs) === target.outputRunId, "output-run root identity drift");
  const chaptersRoot = resolve(experimentRootAbs, "chapters");
  const provenanceRootAbs = resolve(experimentRootAbs, "provenance");
  const leadOverrideRootAbs = resolve(experimentRootAbs, "lead-overrides");
  const attemptsRootAbs = resolve(experimentRootAbs, "attempts");
  const evidenceRootAbs = resolve(experimentRootAbs, "evidence");
  const diversityLedgerRootAbs = resolve(experimentRootAbs, "telemetry", "diversity");
  const gateAttemptStateAbsPath = resolve(experimentRootAbs, "telemetry", "gate-attempts.json");
  const executionManifestRootAbs = resolve(experimentRootAbs, "execution", "manifests");
  const qualificationCacheRootAbs = resolve(experimentRootAbs, "execution", "cli-qualification-cache");
  const sessionLogRootAbs = resolve(experimentRootAbs, "execution", "author-sessions");
  const execSessionRootAbs = resolve(experimentRootAbs, "execution", "sessions");
  const materializedInputSnapshotRootAbs = resolve(experimentRootAbs, "frozen-inputs", "materialized-book");
  const frozenIndexAbsPath = resolve(experimentRootAbs, "frozen-inputs", "book-index.json");
  const rubricThresholdsAbsPath = resolve(experimentRootAbs, "frozen-inputs", "rubric-thresholds.json");
  const nameBankSnapshotAbsPath = resolve(experimentRootAbs, "frozen-inputs", "name-bank.json");
  const chapterOutputAbsPath = resolve(chaptersRoot, chapterFileNameFor(target.chapterId));
  const sourceInputRoot = resolve(phaseDir, "inputs", target.bookId);
  const sourceRunRoot = resolve(sourceInputRoot, "books", target.bookId, "runs", "imp22-inputs-v1");
  const sourceArchiveInputRoot = resolve(sourceInputRoot, "source-archive", target.bookId);
  const sourceIndexPath = resolve(sourceInputRoot, "indexes", `${target.bookId}.json`);
  for (const path of [sourceRunRoot, sourceArchiveInputRoot, sourceIndexPath]) {
    requireCondition(existsSync(path), `materialized forward input root is missing: ${path}`);
  }
  const createOnceSnapshot = (path: string, bytes: Buffer | string): string => {
    const expected = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
    if (existsSync(path)) {
      requireCondition(sha256Hex(readFileSync(path)) === sha256Hex(expected),
        `experiment-local frozen input drift: ${path}`);
    } else {
      mkdirSync(dirname(path), { recursive: true });
      writeFileAtomic(path, expected.toString("utf8"));
    }
    return sha256Hex(readFileSync(path));
  };
  const materializedInputSnapshotEntries = filesBelow(sourceInputRoot).map((sourcePath) => {
    const relativePath = relative(sourceInputRoot, sourcePath);
    const destinationPath = resolve(materializedInputSnapshotRootAbs, relativePath);
    requireCondition(destinationPath.startsWith(`${materializedInputSnapshotRootAbs}/`),
      `materialized input snapshot path escapes its output run: ${relativePath}`);
    const bytesSha256 = createOnceSnapshot(destinationPath, readFileSync(sourcePath));
    return { relativePath, bytesSha256 };
  });
  const expectedInputSnapshotEntries = Object.entries(args.expectedInputFileInventory)
    .map(([relativePath, bytesSha256]) => ({ relativePath, bytesSha256 }))
    .sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  requireCondition(hashCanonical(materializedInputSnapshotEntries) === hashCanonical(expectedInputSnapshotEntries),
    `${target.bookId}: output-run input snapshot differs from the verified materialization inventory`);
  const materializedInputSnapshotSha256 = hashCanonical(expectedInputSnapshotEntries);
  const runRoot = resolve(materializedInputSnapshotRootAbs, "books", target.bookId, "runs", "imp22-inputs-v1");
  const sourceArchiveRoot = resolve(materializedInputSnapshotRootAbs, "source-archive", target.bookId);
  const frozenIndexSourcePath = resolve(materializedInputSnapshotRootAbs, "indexes", `${target.bookId}.json`);
  const frozenIndexSha256 = createOnceSnapshot(frozenIndexAbsPath, readFileSync(frozenIndexSourcePath));
  const rubricThresholds: RubricThresholds = loadRubricThresholds();
  const rubricThresholdsSha256 = createOnceSnapshot(rubricThresholdsAbsPath, stableJson(rubricThresholds));
  const nameBank = loadNameBank();
  const nameBankSnapshotSha256 = createOnceSnapshot(nameBankSnapshotAbsPath, stableJson(nameBank));
  requireCondition(nameBank.length > 0, "materialized forward author destination requires a non-empty frozen name bank");
  const gateSourceSidecar = readJson<unknown>(resolve(sourceArchiveRoot, `ch${String(target.chapterNumber).padStart(2, "0")}.source.json`));
  requireCondition(semanticSourceHash(gateSourceSidecar) === target.sidecarSha256,
    `${target.bookId}/ch${target.chapterNumber}: experiment gate source sidecar is stale`);
  const gateSourcePlan = readJson<SourceUsePlanV1>(resolve(runRoot, "source-plans", `ch${String(target.chapterNumber).padStart(2, "0")}.plan.json`));
  requireCondition(sourceUsePlanHash(gateSourcePlan) === target.sourceUsePlanSha256,
    `${target.bookId}/ch${target.chapterNumber}: experiment gate source-use plan is stale`);
  const gateBrief = readJson<ChapterBriefV1>(resolve(runRoot, "briefs", `ch${String(target.chapterNumber).padStart(2, "0")}.brief.json`));
  const dealtCount = (gateBrief as { rotationSchemaVersion?: unknown; exampleCount?: unknown }).exampleCount;
  const gateExampleFloor = typeof (gateBrief as { rotationSchemaVersion?: unknown }).rotationSchemaVersion === "string"
    && Number.isInteger(dealtCount) && Number(dealtCount) >= 4 && Number(dealtCount) <= 6
    ? Number(dealtCount)
    : 6;
  const nn = (n: number) => String(n).padStart(2, "0");
  const chapterPath = (bookId: string, n: number) => resolve(
    phaseDir,
    "live-campaign",
    "outputs",
    `${target.outputRunId.slice(0, target.outputRunId.indexOf(`--${target.bookId}--`))}--${bookId}--ch${nn(n)}`,
    "chapters",
    chapterFileNameFor(`${bookId}-ch${nn(n)}`),
  );
  const readJsonInput = <T>(path: string): T | null => readJsonOrNull<T>(path);
  const loadChapters = (bookId: string): ChapterV21[] => {
    const outputsRoot = resolve(phaseDir, "live-campaign", "outputs");
    if (!existsSync(outputsRoot)) return [];
    const out: ChapterV21[] = [];
    for (const runId of readdirSync(outputsRoot).sort()) {
      if (!runId.includes(`--${bookId}--ch`)) continue;
      const dir = resolve(outputsRoot, runId, "chapters");
      if (!existsSync(dir)) continue;
      const match = runId.match(/--ch(\d+)$/);
      if (!match) continue;
      const own = resolve(dir, chapterFileNameFor(`${bookId}-ch${match[1]}`));
      if (!existsSync(own)) continue;
      try { out.push(JSON.parse(readFileSync(own, "utf8")) as ChapterV21); } catch { /* fail later at explicit read */ }
    }
    return out.sort((a, b) => a.number - b.number);
  };
  const provenancePath = (chapterId: string) => resolve(provenanceRootAbs, `${chapterId}.json`);
  const leadPath = (bookId: string, n: number) => resolve(leadOverrideRootAbs, `${bookId}-ch${nn(n)}.json`);
  const syncGateSiblingContext = (): void => {
    const authoritative = loadChapters(target.bookId).filter((chapter) => chapter.number !== target.chapterNumber);
    const expected = new Set(authoritative.map((chapter) => chapterFileNameFor(chapter.chapterId)));
    mkdirSync(chaptersRoot, { recursive: true });
    for (const name of readdirSync(chaptersRoot).filter((file) => file.endsWith(".chapter.json"))) {
      if (name === chapterFileNameFor(target.chapterId)) continue;
      if (!expected.has(name)) rmSync(resolve(chaptersRoot, name), { force: true });
    }
    for (const chapter of authoritative) {
      writeFileAtomic(resolve(chaptersRoot, chapterFileNameFor(chapter.chapterId)), `${JSON.stringify(chapter, null, 2)}\n`);
    }
  };
  const io: AuthorIo = {
    chapterExists: (bookId, n) => existsSync(chapterPath(bookId, n)),
    readBriefMd: (_bookId, n) => {
      const path = resolve(runRoot, "briefs", `ch${nn(n)}.brief.md`);
      return existsSync(path) ? readFileSync(path, "utf8") : null;
    },
    readBrief: (_bookId, n) => readJsonInput<ChapterBriefV1>(resolve(runRoot, "briefs", `ch${nn(n)}.brief.json`)),
    readPacket: (_bookId, n) => readJsonInput<SourcePacketV1>(resolve(runRoot, "source-packets", `ch${nn(n)}.source-packet.json`)),
    readSourcePlan: (_bookId, n) => readJsonInput<SourceUsePlanV1>(resolve(runRoot, "source-plans", `ch${nn(n)}.plan.json`)),
    loadChapters,
    nameBankOk: () => nameBank.length > 0,
    voiceCard: () => null,
    authorSessionOf: (chapterId) => readJsonOrNull<AuthorProvenance>(provenancePath(chapterId))?.authorSessionId,
    recordProvenance: (chapterId, authorSessionId, contentHash) => writeJson(provenancePath(chapterId), {
      schemaVersion: "author-provenance-v2",
      chapterId,
      authorSessionId,
      stampedAt: new Date().toISOString(),
      contentHash,
      producer: "whole-chapter-writer",
    } satisfies AuthorProvenance),
    readProvenance: (chapterId) => readJsonOrNull<AuthorProvenance>(provenancePath(chapterId)),
    restoreProvenance: (chapterId, previous) => {
      const path = provenancePath(chapterId);
      if (previous === null) rmSync(path, { force: true });
      else writeJson(path, previous);
    },
    readChapterFile: (bookId, n) => {
      const path = chapterPath(bookId, n);
      return existsSync(path) ? readFileSync(path, "utf8") : null;
    },
    writeChapterFile: (bookId, n, bytes) => writeFileAtomic(chapterPath(bookId, n), bytes),
    removeChapterFile: (bookId, n) => rmSync(chapterPath(bookId, n), { force: true }),
    readLeadOverride: (bookId, n) => readJsonOrNull<LeadThreadOverrideV1>(leadPath(bookId, n)),
    writeLeadOverride: (bookId, n, value) => writeJson(leadPath(bookId, n), value),
    removeLeadOverride: (bookId, n) => rmSync(leadPath(bookId, n), { force: true }),
    // Ignore authorRun's logical manifest outputRelPath here. The deterministic
    // gate's sibling context must be the actual experiment-local committed
    // output directory used by this complete AuthorIo.
    gateCandidate: (candidate, _logicalCanonicalAbsPath, attemptKey) => {
      syncGateSiblingContext();
      return (args.gateCandidateImpl ?? gateCandidate)(candidate, chapterOutputAbsPath, attemptKey, {
        gateAttemptStatePath: gateAttemptStateAbsPath,
        sourceSidecar: gateSourceSidecar,
        disableCanonicalKeyJudgeAdvisory: true,
        shipGate: {
          isolationMode: "experiment",
          allocatedNames: [],
          exampleFloor: gateExampleFloor,
          sourceSidecar: gateSourceSidecar,
          sourceUsePlan: gateSourcePlan,
        },
      });
    },
    rubricWithCandidate: (bookId, n, candidate) => rubricMetricsWithCandidate(bookId, n, candidate, loadChapters, rubricThresholds),
    attemptsRoot: () => attemptsRootAbs,
    evidenceRoot: () => evidenceRootAbs,
    diversityLedgerRoot: () => diversityLedgerRootAbs,
  };
  return {
    io,
    destinationProof: {
      schema: "forward-experiment-destination-proof-v1",
      experimentId: target.outputRunId.slice(0, target.outputRunId.indexOf(`--${target.bookId}--`)),
      outputRunId: target.outputRunId,
      outputRelPath: target.outputRelPath,
      experimentRootAbs,
      chapterOutputAbsPath,
      provenanceRootAbs,
      leadOverrideRootAbs,
      attemptsRootAbs,
      evidenceRootAbs,
      diversityLedgerRootAbs,
      gateAttemptStateAbsPath,
      executionManifestRootAbs,
      qualificationCacheRootAbs,
      sessionLogRootAbs,
      execSessionRootAbs,
      frozenIndexAbsPath,
      frozenIndexSha256,
      rubricThresholdsAbsPath,
      rubricThresholdsSha256,
      nameBankSnapshotAbsPath,
      nameBankSnapshotSha256,
      materializedInputSnapshotRootAbs,
      materializedInputSnapshotSha256,
    },
  };
}

function explicitConductorInputBuilder(
  phaseDir: string,
  roleFreeze: ForwardRoleAssignmentFreezeV1,
  assertInputMaterializationFresh: () => void,
): ForwardValidationCampaignDeps["buildConductorInput"] {
  return ({ target, prepared }) => {
    assertInputMaterializationFresh();
    const nn = String(target.chapterNumber).padStart(2, "0");
    const inputRoot = resolve(phaseDir, "inputs", target.bookId);
    const sidecarPath = resolve(inputRoot, "source-archive", target.bookId, `ch${nn}.source.json`);
    const anchorPath = resolve(inputRoot, "source-archive", target.bookId, `ch${nn}.anchors.json`);
    const reread = () => ({ sourceSidecar: readJson<unknown>(sidecarPath), anchorCatalog: readJson<never[]>(anchorPath) });
    const evidence = reread();
    const sourcePacket = prepared.io.readPacket(target.bookId, target.chapterNumber);
    requireCondition(sourcePacket !== null, `${target.bookId}/ch${nn}: materialized source packet is missing`);
    return {
      prepared,
      sourcePacket,
      sourceSidecar: evidence.sourceSidecar,
      anchorCatalog: evidence.anchorCatalog,
      rereadAuthoritativeSourceEvidence: reread,
      frozen: roleFreeze.reviewConfig,
    };
  };
}

function assertExplicitTargetInputsFresh(
  phaseDir: string,
  target: ForwardCandidateRequestV1["target"],
): void {
  const nn = String(target.chapterNumber).padStart(2, "0");
  const inputRoot = resolve(phaseDir, "inputs", target.bookId);
  const runRoot = resolve(inputRoot, "books", target.bookId, "runs", "imp22-inputs-v1");
  const sourceRoot = resolve(inputRoot, "source-archive", target.bookId);
  const packet = readJson<SourcePacketV1>(resolve(runRoot, "source-packets", `ch${nn}.source-packet.json`));
  const plan = readJson<SourceUsePlanV1>(resolve(runRoot, "source-plans", `ch${nn}.plan.json`));
  const sidecar = readJson<unknown>(resolve(sourceRoot, `ch${nn}.source.json`));
  const anchors = readJson<unknown[]>(resolve(sourceRoot, `ch${nn}.anchors.json`));
  requireCondition(sourcePacketHash(packet) === target.sourcePacketSha256, `${target.bookId}/ch${nn}: final source packet drift`);
  requireCondition(sourceUsePlanHash(plan) === target.sourceUsePlanSha256, `${target.bookId}/ch${nn}: final source plan drift`);
  requireCondition(semanticSourceHash(sidecar) === target.sidecarSha256, `${target.bookId}/ch${nn}: final source sidecar drift`);
  requireCondition(hashCanonical(anchors) === target.anchorCatalogSha256, `${target.bookId}/ch${nn}: final anchor catalog drift`);
}

function assertExplicitCampaignFinalFreshness(
  phaseDir: string,
  manifest: FrozenForwardValidationManifestV1,
  campaign: Readonly<ForwardValidationCampaignResultV1>,
): void {
  for (const target of manifest.manifest.targets) {
    assertExplicitTargetInputsFresh(phaseDir, target);
    const nn = String(target.chapterNumber).padStart(2, "0");
    const record = campaign.finalByChapter[`${target.bookId}/ch${nn}`];
    if (!record?.pass) continue;
    const path = resolve(phaseDir, "live-campaign", "outputs", target.outputRunId, "chapters", chapterFileNameFor(target.chapterId));
    requireCondition(existsSync(path), `${target.bookId}/ch${nn}: final committed output is missing`);
    const bytes = readFileSync(path, "utf8");
    requireCondition(sha256Hex(bytes) === record.candidateBytesSha256, `${target.bookId}/ch${nn}: final committed bytes drift`);
    requireCondition(chapterContentHash(JSON.parse(bytes) as ChapterV21) === record.candidateContentSha256,
      `${target.bookId}/ch${nn}: final committed content drift`);
  }
}

function persistGoldArtifact(
  evidenceRoot: string,
  kind: "gold-evaluator" | "gold-rater" | "gold-sweep",
  actorId: string,
  executionId: string,
  payloadSha256: string,
  finalChapterContentHashes: Record<string, string>,
  suffix: string,
): ForwardGoldPersistedEvidenceRefV1 {
  const artifact: ForwardGoldEvidenceArtifactV1 = {
    schema: "forward-gold-evidence-v1",
    kind,
    actorId,
    executionId,
    finalChapterContentHashes,
    payloadSha256,
  };
  const artifactSha256 = hashCanonical(artifact);
  const storageId = `evidence/gold/${suffix}.json`;
  const path = resolve(evidenceRoot, storageId);
  if (existsSync(path)) requireCondition(hashCanonical(readJson(path)) === artifactSha256, `${kind}: retained evidence drift`);
  else writeJson(path, artifact);
  const receipt: ForwardPersistenceReceiptV1 = {
    schema: "forward-persistence-receipt-v1",
    kind,
    storageId,
    contentSha256: artifactSha256,
  };
  return { actorId, executionId, payloadSha256, artifactSha256, receipt };
}

/** Pure hard gate used by the production gold assembler and negative tests.
 * Verdict summaries/hashes alone are insufficient: actual final ChapterV21
 * prose, an adjudicated evaluation payload, and a fresh independent sweep are
 * all mandatory. */
export function validateForwardGoldEvaluationArtifacts(args: {
  bookId: string;
  finalChapters: ChapterV21[];
  finalChapterContentHashes: Record<string, string>;
  adjudicatorOutput: unknown;
  sweepOutput: unknown;
}): {
  evaluation: Omit<ForwardGoldBookEvaluationV1, "sweep" | "evidenceBinding">;
  sweep: SweepRecord;
} {
  requireCondition(args.finalChapters.length >= 8, "gold evaluation requires the actual full final ChapterV21 book");
  const adjudicatorOutput = args.adjudicatorOutput as {
    evaluation?: Omit<ForwardGoldBookEvaluationV1, "sweep" | "evidenceBinding">;
  };
  const sweepOutput = args.sweepOutput as { sweep?: SweepRecord };
  requireCondition(adjudicatorOutput?.evaluation !== undefined,
    "gold adjudicator output omitted its final evaluation");
  requireCondition(sweepOutput?.sweep !== undefined, "gold book-sweep call omitted its sweep artifact");
  const evaluation = adjudicatorOutput.evaluation;
  for (const field of [
    "technicalCompleteness",
    "epistemicInstructionalSafety",
    "ethicsReaderAutonomy",
    "purposeAudienceDeclaration",
    "externalAccuracy",
  ] as const) {
    requireCondition(evaluation[field] === "PASS" || evaluation[field] === "FAIL",
      `gold adjudicator evaluation has invalid ${field}`);
  }
  requireCondition(Number.isFinite(evaluation.contentDesignScore)
    && evaluation.contentDesignScore >= 0 && evaluation.contentDesignScore <= 100,
  "gold adjudicator evaluation has an invalid content-design score");
  const sweep = sweepOutput.sweep;
  const actualHashes: Record<string, string> = {};
  for (const chapter of args.finalChapters) {
    requireCondition(Number.isInteger(chapter.number) && chapter.number > 0,
      "gold final book contains an invalid chapter number");
    const key = String(chapter.number);
    requireCondition(actualHashes[key] === undefined, `gold final book repeats chapter ${key}`);
    actualHashes[key] = chapterContentHash(chapter);
  }
  requireCondition(Object.keys(args.finalChapterContentHashes).length === args.finalChapters.length
    && hashCanonical(args.finalChapterContentHashes) === hashCanonical(actualHashes),
  "gold final chapter hash binding is stale against the supplied final ChapterV21 prose");
  requireCondition(sweep.schemaVersion === "sweep-attest-v1" && sweep.bookId === args.bookId && sweep.verdict === "PASS",
    "gold sweep is not a PASS for the frozen book");
  requireCondition(typeof sweep.roundId === "string" && sweep.roundId.trim().length > 0,
    "gold sweep omitted its independent round identity");
  requireCondition(typeof sweep.reviewer === "string" && sweep.reviewer.trim().length > 0,
    "gold sweep omitted its independent reviewer identity");
  requireCondition(typeof sweep.reviewerSessionId === "string" && sweep.reviewerSessionId.trim().length > 0,
    "gold sweep omitted its independent reviewer session identity");
  requireCondition(typeof sweep.attestedAt === "string" && Number.isFinite(Date.parse(sweep.attestedAt)),
    "gold sweep attestation timestamp is invalid");
  requireCondition(hashCanonical(sweep.contentHashes) === hashCanonical(args.finalChapterContentHashes),
    "gold sweep is stale against final chapter content");
  requireCondition(Array.isArray(sweep.checkedFamilies)
    && new Set(sweep.checkedFamilies).size === sweep.checkedFamilies.length
    && REQUIRED_SWEEP_FAMILIES.every((family) => sweep.checkedFamilies.includes(family)),
    "gold sweep omitted a required family");
  const finalChapterNumbers = new Set(args.finalChapters.map((chapter) => chapter.number));
  requireCondition(Array.isArray(sweep.findings), "gold sweep findings are not an array");
  for (const finding of sweep.findings) {
    requireCondition(REQUIRED_SWEEP_FAMILIES.includes(finding.family), "gold sweep finding has an invalid family");
    requireCondition(finding.severity === "blocker" || finding.severity === "advisory",
      "gold sweep finding has an invalid severity");
    requireCondition(Array.isArray(finding.chapters) && finding.chapters.length > 0
      && finding.chapters.every((chapter) => finalChapterNumbers.has(chapter)),
    "gold sweep finding references a chapter outside the supplied final book");
    for (const [label, value] of Object.entries({
      unitId: finding.unitId,
      quote: finding.quote,
      problem: finding.problem,
      expectedFix: finding.expectedFix,
    })) requireCondition(typeof value === "string" && value.trim().length > 0,
      `gold sweep finding omitted ${label}`);
  }
  requireCondition(sweep.findings.every((finding) => finding.severity !== "blocker"),
    "gold sweep contains blocking findings");
  return { evaluation, sweep };
}

function explicitGoldEvaluatorFactory(
  phaseDir: string,
  config: Readonly<ForwardGoldEvaluatorInstrumentV1>,
  productionInstrumentSealSha256: string,
  assertInputMaterializationFresh: () => void,
  verifiedBookFileInventory: Record<string, Record<string, string>>,
): (controller: ForwardLiveCallLedgerController) => LedgerBoundForwardGoldEvaluator {
  requireCondition(config.schema === "forward-explicit-gold-evaluator-config-v1" && config.calls.length === 4,
    "fixed gold evaluator instrument must freeze exactly four calls");
  requireCondition(config.calls[0]?.evaluationRole === "blind-rater"
    && config.calls[1]?.evaluationRole === "blind-rater"
    && config.calls[2]?.evaluationRole === "adjudicator"
    && config.calls[3]?.evaluationRole === "book-sweep",
  "explicit gold evaluator config order must be blind-rater, blind-rater, adjudicator, book-sweep");
  for (const call of config.calls) requireCondition(/^[a-z0-9][a-z0-9._-]{0,63}$/.test(call.callId),
    `unsafe gold evaluator callId: ${call.callId}`);
  requireCondition(SHA256.test(productionInstrumentSealSha256),
    "fixed gold evaluator requires the verified production instrument seal hash");
  const writeCreateOnce = (path: string, text: string): void => {
    if (existsSync(path)) requireCondition(readFileSync(path, "utf8") === text, `gold evaluator retained artifact drift: ${path}`);
    else writeFileAtomic(path, text);
  };
  const finalizeDispatch = (
    base: ForwardProductionGoldEvaluatorCallV1,
    artifactsWithoutReceipt: Array<{ relativePath: string; bytesSha256: string }>,
  ): ForwardProductionGoldEvaluatorCallV1 => {
    const binding = buildForwardGoldWorkerDispatchBinding({ call: base, artifacts: artifactsWithoutReceipt });
    const dispatchReceiptSha256 = binding.receipt.dispatchReceiptSha256;
    const dispatchRelPath = "worker-dispatch-receipt.json";
    const dispatchPath = resolve(base.cwd, dispatchRelPath);
    writeCreateOnce(dispatchPath, stableJson(binding.receipt));
    const task = binding.task;
    return {
      ...base,
      task,
      request: {
        instrumentSha256: base.instrumentSha256,
        sourceHash: base.sourceHash,
        dispatchReceiptSha256,
        taskSha256: sha256Hex(task),
      },
      dispatchReceiptSha256,
      artifacts: [
        ...artifactsWithoutReceipt,
        { relativePath: dispatchRelPath, bytesSha256: sha256Hex(readFileSync(dispatchPath)) },
      ],
    };
  };
  const deriveSourceContext = (
    manifest: Readonly<ForwardGoldManifestV1>,
    finalByChapter: Readonly<ForwardValidationCampaignResultV1["finalByChapter"]>,
  ) => {
    const bookId = manifest.targets[0].bookId;
    const entries = [...manifest.targets].sort((a, b) => a.chapterNumber - b.chapterNumber).map((target) => {
      const key = `${target.bookId}/ch${String(target.chapterNumber).padStart(2, "0")}`;
      const final = finalByChapter[key];
      requireCondition(final?.pass === true && final.candidateContentSha256 !== null
        && final.executionEnvelope !== null && final.executionEnvelopeSha256 !== null && final.source !== null,
      `${key}: gold source inventory requires a retained final PASS with source/envelope evidence`);
      requireCondition(final.executionEnvelopeSha256 === hashCanonical(final.executionEnvelope),
        `${key}: gold source inventory has a stale execution envelope`);
      const outputPath = resolve(phaseDir, "live-campaign", "outputs", target.outputRunId, "chapters", chapterFileNameFor(target.chapterId));
      requireCondition(existsSync(outputPath), `${key}: final experiment-local chapter bytes are missing`);
      const bytes = readFileSync(outputPath);
      const chapter = JSON.parse(bytes.toString("utf8")) as ChapterV21;
      requireCondition(chapter.chapterId === target.chapterId && chapter.number === target.chapterNumber
        && chapterContentHash(chapter) === final.candidateContentSha256,
      `${key}: final chapter identity/content differs from the retained PASS`);
      const source = final.source;
      const evidenceFresh = source.chapterContentSha256 === final.candidateContentSha256
        && source.sourceUsePlanSha256 === target.sourceUsePlanSha256
        && source.sourcePacketSha256 === target.sourcePacketSha256
        && source.sidecarSha256 === target.sidecarSha256;
      return {
        target,
        final,
        chapter,
        outputPath,
        bytesSha256: sha256Hex(bytes),
        expectedChapter: {
          chapterIndex: target.chapterNumber,
          chapterId: target.chapterId,
          title: chapter.title,
          packagePath: `chapters/ch${String(target.chapterNumber).padStart(2, "0")}.chapter.json`,
        } satisfies ForwardGoldExpectedChapterIdentityV1,
        sourceEvidence: {
          chapterIndex: target.chapterNumber,
          chapterId: target.chapterId,
          title: chapter.title,
          packagePath: `chapters/ch${String(target.chapterNumber).padStart(2, "0")}.chapter.json`,
          candidateContentSha256: final.candidateContentSha256,
          sourceResultSha256: hashCanonical(source),
          executionEnvelopeSha256: final.executionEnvelopeSha256,
          sourceStatus: source.result === "PASS" ? "PASS" as const : source.result === "BLOCK" ? "REVISE" as const : "INCONCLUSIVE" as const,
          sourceBlockerCount: source.blockingFindingIds.length,
          evidenceFresh,
        },
      };
    });
    const expectedChapters = entries.map((entry) => entry.expectedChapter);
    const sourceHash = hashCanonical({
      schema: "forward-gold-authoritative-source-inventory-v1",
      bookId,
      instrumentSha256: config.instrumentSha256,
      materializedInputFiles: Object.entries(verifiedBookFileInventory[bookId] ?? {})
        .map(([relativePath, bytesSha256]) => ({ relativePath, bytesSha256 }))
        .sort((a, b) => a.relativePath.localeCompare(b.relativePath)),
      finalChapters: entries.map((entry) => ({
        chapterIndex: entry.expectedChapter.chapterIndex,
        chapterId: entry.expectedChapter.chapterId,
        title: entry.expectedChapter.title,
        candidateContentSha256: entry.final.candidateContentSha256,
        bytesSha256: entry.bytesSha256,
      })),
    });
    const sourceAwareExternalAccuracy = buildForwardGoldSourceAwareExternalAccuracyProof({
      bookId,
      sourceHash,
      chapters: entries.map((entry) => entry.sourceEvidence),
    });
    const inspectionSha256 = hashCanonical({
      sourceHash,
      expectedChapters,
      sourceAwareExternalAccuracyProofSha256: sourceAwareExternalAccuracy.proofSha256,
    });
    return { bookId, entries, expectedChapters, sourceHash, sourceAwareExternalAccuracy, inspectionSha256 };
  };
  return (controller) => createProductionLedgeredForwardGoldEvaluator({
    controller,
    phaseDir: resolve(phaseDir, "live-campaign"),
    buildCalls: ({ manifest, finalByChapter }) => {
      assertInputMaterializationFresh();
      const sourceContext = deriveSourceContext(manifest, finalByChapter);
      const { bookId } = sourceContext;
      const assertVerifiedMaterializedSource = (source: string, sourceBookId: string): void => {
        const inputRoot = resolve(phaseDir, "inputs", sourceBookId);
        const relativePath = relative(inputRoot, resolve(source));
        requireCondition(!relativePath.startsWith("..")
          && verifiedBookFileInventory[sourceBookId]?.[relativePath] === sha256Hex(readFileSync(source)),
        `${sourceBookId}: gold evaluator copy is outside or differs from the verified materialization (${relativePath})`);
      };
      const repositoryRoot = resolve(PIPELINE_DIR, "../../../..");
      const built = config.calls.map((call, callIndex) => {
        const workspaceRoot = resolve(phaseDir, "live-campaign", "evaluator-workspaces");
        const cwd = resolve(workspaceRoot, call.callId);
        requireCondition(cwd.startsWith(`${workspaceRoot}/`), `${call.callId}: evaluator workspace escapes its phase root`);
        const scopePath = resolve(cwd, "evaluation-scope.json");
        writeCreateOnce(scopePath, stableJson({
          schema: "forward-gold-blind-evaluation-scope-v1",
          bookId,
          sourceHash: sourceContext.sourceHash,
          inspectionSha256: sourceContext.inspectionSha256,
          instrumentSha256: config.instrumentSha256,
          productionInstrumentSealSha256,
          chapters: sourceContext.expectedChapters,
          sourceBoundEvaluationRequired: true,
          priorReviewVerdictsIncluded: false,
        }));
        const artifacts: Array<{ relativePath: string; bytesSha256: string }> = [
          { relativePath: "evaluation-scope.json", bytesSha256: sha256Hex(readFileSync(scopePath)) },
        ];
        for (const asset of config.referenceAssets) {
          const source = resolve(repositoryRoot, asset.repositoryRelPath);
          requireCondition(existsSync(source) && sha256Hex(readFileSync(source)) === asset.bytesSha256,
            `${call.callId}: fixed gold instrument asset drift (${asset.repositoryRelPath})`);
          const destination = resolve(cwd, asset.materializedRelPath);
          requireCondition(destination.startsWith(`${cwd}/`), `${call.callId}: materialized instrument asset escapes workspace`);
          writeCreateOnce(destination, readFileSync(source, "utf8"));
          artifacts.push({ relativePath: asset.materializedRelPath, bytesSha256: asset.bytesSha256 });
        }
        for (const copy of [
          { rel: `book/${bookId}.index.json`, source: resolve(phaseDir, "inputs", bookId, "indexes", `${bookId}.json`) },
          { rel: `book/${bookId}.manual-brief.json`, source: resolve(phaseDir, "inputs", bookId, "briefs", `${bookId}.manual-brief.json`) },
        ]) {
          requireCondition(existsSync(copy.source), `gold evaluator book-level declaration is missing: ${copy.source}`);
          assertVerifiedMaterializedSource(copy.source, bookId);
          const text = readFileSync(copy.source, "utf8");
          const destination = resolve(cwd, copy.rel);
          writeCreateOnce(destination, text);
          artifacts.push({ relativePath: copy.rel, bytesSha256: sha256Hex(Buffer.from(text)) });
        }
        for (const target of manifest.targets) {
          assertExplicitTargetInputsFresh(phaseDir, target);
          const nn = String(target.chapterNumber).padStart(2, "0");
          const sourceEntry = sourceContext.entries.find((entry) => entry.target.chapterId === target.chapterId);
          requireCondition(sourceEntry !== undefined, `${target.bookId}/ch${nn}: final source context is missing`);
          const copies = [
            { rel: `chapters/ch${nn}.chapter.json`, source: sourceEntry.outputPath },
            { rel: `source/ch${nn}.source.json`, source: resolve(phaseDir, "inputs", target.bookId, "source-archive", target.bookId, `ch${nn}.source.json`) },
            { rel: `source/ch${nn}.anchors.json`, source: resolve(phaseDir, "inputs", target.bookId, "source-archive", target.bookId, `ch${nn}.anchors.json`) },
            { rel: `source/ch${nn}.source-packet.json`, source: resolve(phaseDir, "inputs", target.bookId, "books", target.bookId, "runs", "imp22-inputs-v1", "source-packets", `ch${nn}.source-packet.json`) },
            { rel: `source/ch${nn}.plan.json`, source: resolve(phaseDir, "inputs", target.bookId, "books", target.bookId, "runs", "imp22-inputs-v1", "source-plans", `ch${nn}.plan.json`) },
          ];
          for (const copy of copies) {
            requireCondition(existsSync(copy.source), `${target.bookId}/ch${nn}: evaluator source artifact is missing (${copy.source})`);
            if (!copy.rel.startsWith("chapters/")) assertVerifiedMaterializedSource(copy.source, target.bookId);
            const text = readFileSync(copy.source, "utf8");
            const destination = resolve(cwd, copy.rel);
            writeCreateOnce(destination, text);
            artifacts.push({ relativePath: copy.rel, bytesSha256: sha256Hex(Buffer.from(text)) });
          }
        }
        requireCondition(call.promptSha256 === sha256Hex(call.prompt), `${call.callId}: fixed gold prompt hash drift`);
        const base: ForwardProductionGoldEvaluatorCallV1 = {
          callId: call.callId,
          actorId: call.actorId,
          evaluationRole: call.evaluationRole,
          request: {},
          task: `${call.prompt}\n\nREQUIRED AUTHORITATIVE INPUTS\nRead every file under chapters/, source/, and book/. The book index and manual brief are authoritative for the purpose-and-audience declaration; hashes or prior verdicts are not substitutes for reading the prose and sources.`,
          cwd,
          model: call.model,
          effort: call.effort,
          outputSchemaPath: resolveForwardGoldEvaluatorOutputSchemaPath(call, { repositoryRoot }),
          outputSchemaSha256: call.outputSchemaSha256,
          artifacts,
          instrumentSha256: config.instrumentSha256,
          productionInstrumentSealSha256,
          sourceHash: sourceContext.sourceHash,
          dispatchReceiptSha256: "",
          expectedChapters: sourceContext.expectedChapters,
          blindRaterRole: call.evaluationRole === "blind-rater"
            ? (callIndex === 0 ? "primary" : "verification")
            : null,
          sourceAwareExternalAccuracy: sourceContext.sourceAwareExternalAccuracy,
          expectedSourceLaneEvidence: sourceContext.entries.map((entry) => entry.sourceEvidence),
        };
        return call.evaluationRole === "blind-rater" ? finalizeDispatch(base, artifacts) : base;
      }) as ForwardProductionGoldEvaluatorCallV1[];
      assertInputMaterializationFresh();
      return built;
    },
    prepareAdjudicator: ({ call, raterCalls, raterResults }) => {
      requireCondition(raterCalls.length === 2 && raterResults.length === 2,
        "gold adjudicator requires two retained blind-rater outputs");
      const relPath = "blind-rater-results.json";
      const path = resolve(call.cwd, relPath);
      const text = stableJson({
        schema: "forward-gold-blind-rater-results-v1",
        raters: raterCalls.map((rater, index) => ({
          actorId: rater.actorId,
          executionId: raterResults[index].executionId,
          output: raterResults[index].output,
          outputSha256: raterResults[index].outputSha256,
        })),
      });
      writeCreateOnce(path, text);
      return finalizeDispatch({
        ...call,
        task: `${call.task}\n\nADJUDICATION INPUT\nRead ${relPath}. Reconcile both independent blind reads against the actual chapter/source files. Return only the pinned adjudicated-book record. The independent sweep is produced by its separate worker and must not appear in this result.`,
      }, [...call.artifacts, { relativePath: relPath, bytesSha256: sha256Hex(Buffer.from(text)) }]);
    },
    prepareBookSweep: ({ call, adjudicatorCall, adjudicatorResult }) => {
      requireCondition(adjudicatorCall.evaluationRole === "adjudicator"
        && adjudicatorResult.actorId === adjudicatorCall.actorId,
      "gold sweep requires the exact retained adjudicator result");
      const relPath = "adjudicated-result-binding.json";
      const path = resolve(call.cwd, relPath);
      const text = stableJson({
        schema: "forward-gold-adjudicated-result-binding-v1",
        actorId: adjudicatorCall.actorId,
        executionId: adjudicatorResult.executionId,
        outputSha256: adjudicatorResult.outputSha256,
        sourceHash: adjudicatorCall.sourceHash,
        dispatchReceiptSha256: adjudicatorCall.dispatchReceiptSha256,
      });
      writeCreateOnce(path, text);
      return finalizeDispatch({
        ...call,
        task: `${call.task}\n\nADJUDICATION CHAIN BINDING\nRead ${relPath} only to bind this independent sweep to the exact validated adjudication execution. Do not inherit its verdict or scores: independently read every final chapter and perform every sweep family against the actual prose.`,
      }, [...call.artifacts, { relativePath: relPath, bytesSha256: sha256Hex(Buffer.from(text)) }]);
    },
    assemble: ({ manifest, finalByChapter, calls, results }) => {
      assertInputMaterializationFresh();
      const sourceContext = deriveSourceContext(manifest, finalByChapter);
      const adjudicatorIndex = calls.findIndex((call) => call.evaluationRole === "adjudicator");
      const sweepIndex = calls.findIndex((call) => call.evaluationRole === "book-sweep");
      const primaryIndex = calls.findIndex((call) => call.blindRaterRole === "primary");
      const verificationIndex = calls.findIndex((call) => call.blindRaterRole === "verification");
      requireCondition(adjudicatorIndex >= 0 && sweepIndex >= 0 && primaryIndex >= 0 && verificationIndex >= 0,
        "gold evaluation omitted a required fixed-instrument call");
      requireCondition(calls.every((call) => call.sourceHash === sourceContext.sourceHash
        && hashCanonical(call.expectedChapters) === hashCanonical(sourceContext.expectedChapters)
        && call.sourceAwareExternalAccuracy.proofSha256 === sourceContext.sourceAwareExternalAccuracy.proofSha256
        && hashCanonical(call.expectedSourceLaneEvidence) === hashCanonical(sourceContext.entries.map((entry) => entry.sourceEvidence))),
      "gold evaluator calls are stale against the final authoritative source context");
      const finalChapterContentHashes = Object.fromEntries(manifest.targets.map((target) => [
        String(target.chapterNumber),
        finalByChapter[`${target.bookId}/ch${String(target.chapterNumber).padStart(2, "0")}`].candidateContentSha256!,
      ]));
      const finalChapters = manifest.targets.map((target) => readJson<ChapterV21>(resolve(
        phaseDir, "live-campaign", "outputs", target.outputRunId, "chapters", chapterFileNameFor(target.chapterId),
      )));
      const adjudicated = projectForwardGoldAdjudication(results[adjudicatorIndex].output, {
        expectedBookId: sourceContext.bookId,
        expectedSourceHash: sourceContext.sourceHash,
        expectedChapters: sourceContext.expectedChapters,
        sourceAwareExternalAccuracy: sourceContext.sourceAwareExternalAccuracy,
        expectedSourceLaneEvidence: sourceContext.entries.map((entry) => entry.sourceEvidence),
        blindRaters: {
          primary: {
            output: results[primaryIndex].output,
            expectedDispatchReceiptSha256: calls[primaryIndex].dispatchReceiptSha256,
          },
          verification: {
            output: results[verificationIndex].output,
            expectedDispatchReceiptSha256: calls[verificationIndex].dispatchReceiptSha256,
          },
        },
      });
      const validated = validateForwardGoldEvaluationArtifacts({
        bookId: manifest.targets[0].bookId,
        finalChapters,
        finalChapterContentHashes,
        adjudicatorOutput: { evaluation: adjudicated },
        sweepOutput: results[sweepIndex].output,
      });
      requireCondition(hashCanonical(validated.evaluation) === hashCanonical(adjudicated),
        "gold compatibility projection drifted during full-book sweep validation");
      const sweep = validated.sweep;
      const projectedPayloadSha256 = hashCanonical(validated.evaluation);
      const evaluator = persistGoldArtifact(phaseDir, "gold-evaluator", calls[adjudicatorIndex].actorId,
        results[adjudicatorIndex].executionId, projectedPayloadSha256, finalChapterContentHashes, "evaluator");
      const raterRefs = calls.map((call, index) => ({ call, index }))
        .filter(({ call }) => call.evaluationRole === "blind-rater")
        .map(({ call, index }, position) => persistGoldArtifact(phaseDir, "gold-rater", call.actorId,
          results[index].executionId, results[index].outputSha256, finalChapterContentHashes, `rater-${position + 1}`));
      const sweepRef = persistGoldArtifact(phaseDir, "gold-sweep", calls[sweepIndex].actorId,
        results[sweepIndex].executionId, hashCanonical(sweep), finalChapterContentHashes, "sweep");
      requireCondition(raterRefs.length === 2, "gold assembler did not retain exactly two rater refs");
      return {
        ...validated.evaluation,
        sweep,
        evidenceBinding: {
          finalChapterContentHashes,
          evaluator,
          raters: raterRefs as [ForwardGoldPersistedEvidenceRefV1, ForwardGoldPersistedEvidenceRefV1],
          sweep: sweepRef,
        },
      };
    },
  });
}

/** Concrete CLI production entrypoint. Every path is supplied explicitly by
 * the operator; it never guesses a role freeze, qualification record, manifest,
 * input denominator, phase destination, or evaluator policy. */
export async function runForwardLiveCampaignFromExplicitArtifacts(
  paths: ForwardExplicitLiveArtifactPathsV1,
): Promise<RunForwardLiveCampaignResultV1> {
  const phaseDir = resolve(paths.phaseDir);
  const manifest = readJson<FrozenForwardValidationManifestV1>(resolve(paths.manifestPath));
  assertExplicitForwardManifestKind(paths.expectedKind, manifest);
  const inputFreeze = readJson<ForwardInputFreezeV1>(resolve(paths.inputFreezePath));
  const retainedProductionInstrumentSeal = readJson<ForwardProductionInstrumentSealV1>(resolve(paths.productionInstrumentSealPath));
  const productionInstrumentSeal = validateForwardProductionInstrumentSeal(retainedProductionInstrumentSeal);
  requireCondition(productionInstrumentSeal.sealSha256 === manifest.manifest.productionInstrumentSealSha256,
    "explicit production-instrument seal differs from the frozen campaign manifest");
  const assertProductionInstrumentFresh = (): void => {
    const current = validateForwardProductionInstrumentSeal(retainedProductionInstrumentSeal);
    requireCondition(current.sealSha256 === productionInstrumentSeal.sealSha256,
      "production instrument seal drifted during the live campaign");
  };
  const materializationProof = validateForwardInputMaterializationArtifact({
    phaseDir,
    artifactPath: resolve(paths.inputMaterializationPath),
    manifest,
    inputFreeze,
  });
  const assertInputMaterializationFresh = (): void => {
    assertProductionInstrumentFresh();
    const current = validateForwardInputMaterializationArtifact({
      phaseDir,
      artifactPath: resolve(paths.inputMaterializationPath),
      manifest,
      inputFreeze,
    });
    requireCondition(current.proofSha256 === materializationProof.proofSha256,
      "input materialization proof drifted after preflight");
  };
  const goldInstrument = manifest.manifest.kind === "gold"
    ? validateForwardGoldEvaluatorInstrument(readJson(resolve(paths.goldEvaluatorConfigPath ?? "")))
    : null;
  if (goldInstrument !== null) {
    requireCondition(manifest.manifest.kind === "gold"
      && goldInstrument.instrumentSha256 === manifest.manifest.goldEvaluatorInstrumentSha256,
      "explicit fixed gold evaluator instrument differs from the frozen gold campaign manifest");
  } else {
    requireCondition(paths.goldEvaluatorConfigPath === undefined,
      "pilot campaign cannot carry a gold evaluator instrument path");
  }
  const qualificationCacheDir = resolve(phaseDir, "live-campaign", "execution", "qualification-preflight-cache");
  const loaded = await loadForwardQualificationArtifacts({
    calibrationSealPath: resolve(paths.calibrationSealPath),
    calibrationInspectionPath: resolve(paths.calibrationInspectionPath),
    qualificationResultPath: resolve(paths.qualificationResultPath),
    qualificationBundlePath: resolve(paths.qualificationBundlePath),
    roleAssignmentFreezePath: resolve(paths.roleAssignmentFreezePath),
    qualificationCacheDir,
  });
  const route = await loadForwardNoApiChatgptRouteProof(qualificationCacheDir);
  const evidence = createForwardCampaignEvidenceStore(phaseDir);
  return runForwardLiveCampaign({
    phaseDir: resolve(phaseDir, "live-campaign"),
    manifest,
    inputFreeze,
    roleFreeze: loaded.roleFreeze,
    qualification: loaded.qualification,
    route,
    verifiedInputMaterializationSha256: materializationProof.artifactBytesSha256,
    verifiedProductionInstrumentSealSha256: productionInstrumentSeal.sealSha256,
    ...(goldInstrument !== null ? { verifiedGoldEvaluatorInstrumentSha256: goldInstrument.instrumentSha256 } : {}),
    createAuthorProducer: (controller) => createLedgeredDeferredAuthorProducer({
      controller,
      phaseDir: resolve(phaseDir, "live-campaign"),
      kind: manifest.manifest.kind,
      productionInstrumentSealSha256: productionInstrumentSeal.sealSha256,
      assertInputMaterializationFresh,
      ioFor: (target) => createExplicitExperimentAuthorDestination({
        phaseDir,
        target,
        expectedInputFileInventory: materializationProof.bookFileInventory[target.bookId],
      }),
    }),
    buildConductorInput: explicitConductorInputBuilder(phaseDir, loaded.roleFreeze, assertInputMaterializationFresh),
    routeFirstFailure: ({ first }) => routeExplicitForwardFirstFailure(first),
    classifyFailedRepair: ({ repair }) => repair.repairFailureDisposition
      ?? (repair.failureClassification === "MODEL_ROUTING" || repair.failureClassification === "STATE_OR_PROVENANCE"
        ? "INFRASTRUCTURE"
        : "REPAIR_CONTENT_FAILURE"),
    ...evidence,
    beforeReviewerCall: assertInputMaterializationFresh,
    assertFinalFreshness: (campaign) => {
      assertInputMaterializationFresh();
      assertExplicitCampaignFinalFreshness(phaseDir, manifest, campaign);
    },
    ...(manifest.manifest.kind === "gold"
      ? {
          createGoldEvaluator: explicitGoldEvaluatorFactory(
            phaseDir,
            goldInstrument!,
            productionInstrumentSeal.sealSha256,
            assertInputMaterializationFresh,
            materializationProof.bookFileInventory,
          ),
        }
      : {}),
  });
}

/** Production correction router: only a verified content REVISE may spend a
 * new author call. Exhausted reviewer infrastructure, refusal, invalid output,
 * INCONCLUSIVE instruments, scorer errors, and state/provenance failures stop. */
export function routeExplicitForwardFirstFailure(
  first: ForwardValidationAttemptRecordV1,
): ForwardFinalizationRouteV1 {
  const complaints = first.failureReasons.length > 0 ? first.failureReasons : ["forward first-write review did not pass"];
  if (first.failureClassification === "CONTENT_SPECIFIC") return { kind: "regeneration", complaints };
  if (first.failureClassification !== null) {
    return { kind: "stop", classification: first.failureClassification, reason: complaints.join(" | ") };
  }
  if (first.finalStatus === "REVISE" && first.aggregate !== null && first.executionEnvelope !== null) {
    const findingComplaints = [
      ...((first.reader?.blockingFindings ?? []) as unknown as Array<{ message?: string; detail?: string }>).flatMap((finding) => [finding.message, finding.detail].filter((value): value is string => typeof value === "string")),
      ...(first.source?.units.flatMap((unit) => unit.findings.map((finding) => finding.explanation)) ?? []),
    ];
    const detailed = (findingComplaints.length > 0 ? findingComplaints : complaints)
      .filter((value, index, all) => value.trim().length > 0 && all.indexOf(value) === index);
    const scopes: string[] = [];
    let repairable = detailed.length > 0;
    for (const complaint of detailed) {
      const scope = deriveComplaintScope(complaint);
      if (scope === null || scope === "VETO") { repairable = false; break; }
      if (!scopes.includes(scope)) scopes.push(scope);
    }
    if (repairable && scopes.length > 0 && scopes.length <= 3) {
      return { kind: "repair", repairKind: "surgical", complaints: detailed, scopes };
    }
    return { kind: "regeneration", complaints };
  }
  return {
    kind: "stop",
    classification: "REVIEW_INSTRUMENT",
    reason: `non-content ${first.finalStatus} review failure cannot spend an author correction: ${complaints.join(" | ")}`,
  };
}
