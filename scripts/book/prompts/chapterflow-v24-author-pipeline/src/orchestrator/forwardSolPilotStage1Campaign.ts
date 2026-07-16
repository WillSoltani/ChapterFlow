/**
 * P6 stage-1 SOL pilot campaign (owner directive "go p6", plan v2).
 *
 * Authors the FIRST TWO chapters of the frozen eight-coordinate
 * s16-forward-sol-pilot-v2-envelope manifest through the production forward
 * conductor, with every reviewer role fixed by the pilot role freeze minted by
 * the pilot-role-readiness-v6 campaign (PILOT_ROLE_SET_READY, 432 live calls,
 * zero API). reader-decision-policy-v3 is ACTIVE for the first time.
 *
 * Boundary discipline mirrors forwardPilotRoleReadinessCampaign.ts:
 * executeLive literal, CI/PR gate before any call, ChatGPT-subscription-only
 * route preflight with FORBIDDEN_PROVIDER_ENV refusal, create-once authorizer
 * persistence, per-call readiness-chain recomposition (in the driver), and a
 * per-call stage-scope guard over the shared campaign ledger. The campaign
 * runs at the ENVELOPE root so stage 2 later resumes the exact same phase
 * (same ledger, same evidence store) with a widened scope and the two
 * completed chapters replaying at zero model cost.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";

import { canonicalJson, hashCanonical, sha256Hex } from "../contracts/contractUtil.js";
import { writeFileAtomic } from "../lib/atomicWrite.js";
import {
  FORBIDDEN_PROVIDER_ENV,
  assertChatgptSubscriptionAuth,
  resolveExecutionProfile,
} from "../exec/executionEnvelope.js";
import { assertFlagsSupported, qualifyCodexCli } from "../exec/cliQualification.js";
import { findCodexBinary } from "./codexAgent.js";
import { ROUTE_POLICY_VERSION } from "./modelPolicy.js";
import {
  CANDIDATE_INSTRUMENT_CERT_REL_PATH,
  CANDIDATE_INSTRUMENT_SEAL_REL_PATH,
  PILOT_ROLE_READINESS_V6_DIR_REL_PATH,
  PILOT_ROLE_READINESS_V6_EXPERIMENT_ID,
  type PilotRoleReadinessPlanV1,
} from "../bakeoff/migration/pilotRoleReadinessInstrument.js";
import { schemaPathByRole, rolePromptSourceHashes } from "../bakeoff/migration/imp24InstrumentCertification.js";
import type {
  PilotRoleReadinessFreezeV1,
  PilotRoleReadinessRunnerResultV1,
} from "../bakeoff/migration/pilotRoleReadinessRunner.js";
import {
  collectPilotReadinessCiGate,
  type PilotReadinessCiGateV1,
  type PilotRoleFreezeV1,
} from "./forwardPilotRoleReadinessCampaign.js";
import {
  SOL_PILOT_STAGE1_PLAN_SCHEMA,
  SOL_PILOT_STAGE1_STAGE_POLICY_ID,
  buildSolPilotFixedRoleAssignment,
  buildSolPilotStage1Scope,
  composeSolPilotBoundReviewConfig,
  composeSolPilotInstrumentSnapshot,
  composeSolPilotStage1QualificationProof,
  type SolPilotCertificationRecordV1,
  type SolPilotInstrumentSnapshotV1,
  type SolPilotProductionSealRecordV1,
  type SolPilotReadinessChainV1,
  type SolPilotReviewRole,
} from "./forwardSolPilotStage1Binding.js";
import {
  createExplicitExperimentAuthorDestination,
  createForwardCampaignEvidenceStore,
  createLedgeredDeferredAuthorProducer,
  runForwardLiveCampaignSolPilotStage1,
  routeExplicitForwardFirstFailure,
  validateForwardInputMaterializationArtifact,
  type ForwardNoApiChatgptRouteProofV3,
  type RunForwardLiveCampaignResultSolPilotV1,
} from "./forwardLiveValidationDriver.js";
import { assertForwardInputFreezeFresh, type ForwardInputFreezeV1 } from "./forwardInputFreeze.js";
import {
  PILOT_ENVELOPE_EXPERIMENT_ID,
  buildPilotManifestV2Envelope,
  type ForwardPilotManifestV1,
  type FrozenForwardValidationManifestV1,
} from "./forwardValidationCampaign.js";
import { buildForwardLivePhaseBudget, type ForwardLiveCallLedgerV1 } from "./forwardLiveCallLedger.js";
import type { ForwardChapterConductorInputV1 } from "./forwardChapterConductor.js";
import type { SourcePacketV1 } from "../artifacts/artifactTypes.js";

export const SOL_PILOT_STAGE1_REPORT_SCHEMA = "sol-pilot-stage1-campaign-report-v1" as const;
export const SOL_PILOT_STAGE1_AUTHORIZATION_SCHEMA = "sol-pilot-stage1-authorization-v1" as const;
export const SOL_PILOT_STAGE1_EXECUTE_LIVE = "EXECUTE_LIVE_SOL_PILOT_STAGE1" as const;

/** Runaway backstop only, never a target: half the ratified 100-call pilot
 * hard envelope for one quarter of the pilot targets. The binding stage bound
 * is the per-entry chapter-scope guard on the shared campaign ledger. */
export const SOL_PILOT_STAGE1_CALL_CEILING = 50 as const;

const PIPELINE_REL = "scripts/book/prompts/chapterflow-v24-author-pipeline";
const EXTERNAL_CAPABILITIES = Object.freeze({
  publish: false,
  promote: false,
  deploy: false,
  upload: false,
  merge: false,
  forcePush: false,
  api: false,
  directHttpOrSdk: false,
} as const);

export class ForwardSolPilotStage1CampaignError extends Error {
  readonly classification = "policy_preflight_failure" as const;

  constructor(message: string) {
    super(message);
    this.name = "ForwardSolPilotStage1CampaignError";
  }
}

function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new ForwardSolPilotStage1CampaignError(message);
}

function parseJson<T>(path: string, label: string): T {
  requireCondition(existsSync(path), `${label} is missing: ${path}`);
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch (error) {
    throw new ForwardSolPilotStage1CampaignError(`${label} is not valid retained JSON: ${(error as Error).message}`);
  }
}

function atomicJson(path: string, value: unknown): void {
  writeFileAtomic(path, `${canonicalJson(value)}\n`);
}

function persistExactJson(path: string, value: unknown, label: string): void {
  if (existsSync(path)) {
    const retained = parseJson<unknown>(path, label);
    requireCondition(hashCanonical(retained) === hashCanonical(value),
      `${label} differs from the exact retained artifact on resume`);
    return;
  }
  atomicJson(path, value);
  const retained = parseJson<unknown>(path, label);
  requireCondition(hashCanonical(retained) === hashCanonical(value), `${label} atomic read-back hash mismatch`);
}

/** Per-LAUNCH records (CI gate, route preflight, authorization, report) carry
 * timestamps/CLI versions, so a fixed create-once path would wedge every
 * legitimate relaunch. Each launch's record is retained immutably under its
 * own content hash; the -latest pointer is a plain atomic overwrite. Chain-
 * bound artifacts (proof/review-config/scope) stay on strict fixed paths. */
function persistLaunchRecord(dir: string, baseName: string, value: unknown, label: string): string {
  mkdirSync(dir, { recursive: true });
  const recordSha = hashCanonical(value);
  const path = resolve(dir, `${baseName}-${recordSha.slice(0, 12)}.json`);
  persistExactJson(path, value, `${label} (launch record)`);
  atomicJson(resolve(dir, `${baseName}-latest.json`), value);
  return path;
}

// ── Paths ─────────────────────────────────────────────────────────────────────

export type SolPilotStage1PathsV1 = {
  envelopeDir: string;
  instrumentSnapshot: string;
  stagePlan: string;
  inputFreeze: string;
  inputMaterialization: string;
  liveCampaignDir: string;
  callLedger: string;
  stage1Dir: string;
  /** Per-launch immutable records (gate/route/authorization), content-addressed. */
  gatesDir: string;
  qualificationProof: string;
  reviewConfig: string;
  stageScope: string;
  stageReportDocsJson: string;
  stageReportMarkdown: string;
  readinessPlanCommitted: string;
  pilotRoleFreezeCommitted: string;
  readinessResultLive: string;
  readinessFreezeLive: string;
  readinessCallLedgerLive: string;
};

export function solPilotStage1Paths(repositoryRoot: string): SolPilotStage1PathsV1 {
  const root = resolve(repositoryRoot);
  const envelopeDir = resolve(root, PIPELINE_REL, "state/migration-experiments", PILOT_ENVELOPE_EXPERIMENT_ID);
  const stage1Dir = resolve(envelopeDir, "stage1");
  const readinessDir = resolve(root, PILOT_ROLE_READINESS_V6_DIR_REL_PATH);
  const reportDir = resolve(root, "docs", "v25", "reports");
  return {
    envelopeDir,
    instrumentSnapshot: resolve(envelopeDir, "instrument-snapshot.json"),
    stagePlan: resolve(envelopeDir, "sol-pilot-stage1-plan.json"),
    inputFreeze: resolve(envelopeDir, "input-freeze.json"),
    inputMaterialization: resolve(envelopeDir, "input-materialization.json"),
    liveCampaignDir: resolve(envelopeDir, "live-campaign"),
    callLedger: resolve(envelopeDir, "live-campaign", "call-ledger.json"),
    stage1Dir,
    gatesDir: resolve(stage1Dir, "launches"),
    qualificationProof: resolve(stage1Dir, "qualification-proof.json"),
    reviewConfig: resolve(stage1Dir, "review-config.json"),
    stageScope: resolve(stage1Dir, "stage-scope.json"),
    stageReportDocsJson: resolve(reportDir, "SOL_PILOT_STAGE1_RESULT.json"),
    stageReportMarkdown: resolve(reportDir, "SOL_PILOT_STAGE1_RESULT.md"),
    readinessPlanCommitted: resolve(readinessDir, "readiness-plan.v6.json"),
    pilotRoleFreezeCommitted: resolve(readinessDir, "pilot-role-freeze.json"),
    readinessResultLive: resolve(readinessDir, "live", "qualification-result.json"),
    readinessFreezeLive: resolve(readinessDir, "live", "readiness-freeze.json"),
    readinessCallLedgerLive: resolve(readinessDir, "live", "call-ledger.json"),
  };
}

// ── Stage plan (minted create-once, committed) ────────────────────────────────

export type SolPilotStage1PlanV1 = {
  schema: typeof SOL_PILOT_STAGE1_PLAN_SCHEMA;
  experimentId: typeof PILOT_ENVELOPE_EXPERIMENT_ID;
  qualificationExperimentId: typeof PILOT_ROLE_READINESS_V6_EXPERIMENT_ID;
  stagePolicyId: typeof SOL_PILOT_STAGE1_STAGE_POLICY_ID;
  stageTargetCount: 2;
  stage1CallCeiling: typeof SOL_PILOT_STAGE1_CALL_CEILING;
  readinessPlanSha256: string;
  readinessPlanBytesSha256: string;
  pilotRoleFreezeSha256: string;
  instrumentSnapshotSha256: string;
  candidateSealRawSha256: string;
  candidateCertificationRawSha256: string;
  readerDecisionPolicy: "reader-decision-policy-v3";
  aggregatePolicy: "aggregate-chapter-review-policy-v2";
  readerBar: 80;
  externalCapabilities: typeof EXTERNAL_CAPABILITIES;
  planSha256: string;
};

function currentRoleHashes(repositoryRoot: string): {
  schemaHashes: Record<SolPilotReviewRole, string>;
  promptSourceHashes: Record<SolPilotReviewRole, string>;
} {
  const schemaPaths = schemaPathByRole(repositoryRoot);
  const schemaHashes = {
    reader: sha256Hex(readFileSync(schemaPaths.reader)),
    source: sha256Hex(readFileSync(schemaPaths.source)),
    quiz: sha256Hex(readFileSync(schemaPaths.quiz)),
  };
  return { schemaHashes, promptSourceHashes: rolePromptSourceHashes(repositoryRoot) };
}

/** Mint the create-once qualification-era instrument snapshot and the stage-1
 * plan. MUST run before any P6 instrument re-mint: the snapshot refuses to
 * mint once the imp24f bytes stop matching the frozen readiness-plan bindings. */
export function mintSolPilotStage1Artifacts(args: {
  repositoryRoot: string;
  write: boolean;
}): {
  snapshot: Readonly<SolPilotInstrumentSnapshotV1>;
  plan: SolPilotStage1PlanV1;
  written: boolean;
} {
  const root = resolve(args.repositoryRoot);
  const paths = solPilotStage1Paths(root);
  const readinessPlanBytes = readFileSync(paths.readinessPlanCommitted);
  const readinessPlan = JSON.parse(readinessPlanBytes.toString("utf8")) as PilotRoleReadinessPlanV1;
  const roleFreeze = parseJson<PilotRoleFreezeV1>(paths.pilotRoleFreezeCommitted, "pilot role freeze");
  const { freezeSha256: roleFreezeSha, ...roleFreezeCore } = roleFreeze;
  requireCondition(roleFreezeSha === hashCanonical(roleFreezeCore), "pilot role freeze self hash drift");
  requireCondition(roleFreeze.bindings.planSha256 === readinessPlan.planSha256
    && roleFreeze.bindings.planBytesSha256 === sha256Hex(readinessPlanBytes),
  "pilot role freeze is not bound to the committed readiness plan");
  const sealBytes = readFileSync(resolve(root, CANDIDATE_INSTRUMENT_SEAL_REL_PATH));
  const certBytes = readFileSync(resolve(root, CANDIDATE_INSTRUMENT_CERT_REL_PATH));
  const hashes = currentRoleHashes(root);
  const snapshot = composeSolPilotInstrumentSnapshot({
    plan: readinessPlan,
    certificationRecord: JSON.parse(certBytes.toString("utf8")) as SolPilotCertificationRecordV1,
    certificationRawSha256: sha256Hex(certBytes),
    sealRecord: JSON.parse(sealBytes.toString("utf8")) as SolPilotProductionSealRecordV1,
    sealRawSha256: sha256Hex(sealBytes),
    schemaHashes: hashes.schemaHashes,
    promptSourceHashes: hashes.promptSourceHashes,
  });
  const planCore: Omit<SolPilotStage1PlanV1, "planSha256"> = {
    schema: SOL_PILOT_STAGE1_PLAN_SCHEMA,
    experimentId: PILOT_ENVELOPE_EXPERIMENT_ID,
    qualificationExperimentId: PILOT_ROLE_READINESS_V6_EXPERIMENT_ID,
    stagePolicyId: SOL_PILOT_STAGE1_STAGE_POLICY_ID,
    stageTargetCount: 2,
    stage1CallCeiling: SOL_PILOT_STAGE1_CALL_CEILING,
    readinessPlanSha256: readinessPlan.planSha256,
    readinessPlanBytesSha256: sha256Hex(readinessPlanBytes),
    pilotRoleFreezeSha256: roleFreeze.freezeSha256,
    instrumentSnapshotSha256: snapshot.snapshotSha256,
    candidateSealRawSha256: readinessPlan.bindings.candidateSealRawSha256,
    candidateCertificationRawSha256: readinessPlan.bindings.candidateCertificationRawSha256,
    readerDecisionPolicy: "reader-decision-policy-v3",
    aggregatePolicy: "aggregate-chapter-review-policy-v2",
    readerBar: 80,
    externalCapabilities: EXTERNAL_CAPABILITIES,
  };
  const plan: SolPilotStage1PlanV1 = { ...planCore, planSha256: hashCanonical(planCore) };
  if (args.write) {
    persistExactJson(paths.instrumentSnapshot, snapshot, "sol-pilot instrument snapshot");
    persistExactJson(paths.stagePlan, plan, "sol-pilot stage-1 plan");
  }
  return { snapshot, plan, written: args.write };
}

// ── Retained-chain loader ─────────────────────────────────────────────────────

export function loadSolPilotReadinessChain(repositoryRoot: string): {
  chain: SolPilotReadinessChainV1;
  stagePlan: SolPilotStage1PlanV1;
} {
  const root = resolve(repositoryRoot);
  const paths = solPilotStage1Paths(root);
  const readinessPlanBytes = readFileSync(paths.readinessPlanCommitted);
  const readinessPlan = JSON.parse(readinessPlanBytes.toString("utf8")) as PilotRoleReadinessPlanV1;
  const roleFreeze = parseJson<PilotRoleFreezeV1>(paths.pilotRoleFreezeCommitted, "pilot role freeze");
  const readinessResult = parseJson<PilotRoleReadinessRunnerResultV1>(paths.readinessResultLive, "readiness qualification result");
  const readinessFreeze = parseJson<PilotRoleReadinessFreezeV1>(paths.readinessFreezeLive, "readiness freeze");
  const ledgerBytes = readFileSync(paths.readinessCallLedgerLive);
  const ledger = JSON.parse(ledgerBytes.toString("utf8")) as unknown;
  const snapshot = parseJson<SolPilotInstrumentSnapshotV1>(paths.instrumentSnapshot, "sol-pilot instrument snapshot");
  const stagePlan = parseJson<SolPilotStage1PlanV1>(paths.stagePlan, "sol-pilot stage-1 plan");
  const { planSha256: stagePlanSha, ...stagePlanCore } = stagePlan;
  requireCondition(stagePlanSha === hashCanonical(stagePlanCore), "sol-pilot stage-1 plan self hash drift");
  requireCondition(stagePlan.schema === SOL_PILOT_STAGE1_PLAN_SCHEMA
    && stagePlan.experimentId === PILOT_ENVELOPE_EXPERIMENT_ID
    && stagePlan.stagePolicyId === SOL_PILOT_STAGE1_STAGE_POLICY_ID
    && stagePlan.readinessPlanSha256 === readinessPlan.planSha256
    && stagePlan.readinessPlanBytesSha256 === sha256Hex(readinessPlanBytes)
    && stagePlan.pilotRoleFreezeSha256 === roleFreeze.freezeSha256
    && stagePlan.instrumentSnapshotSha256 === snapshot.snapshotSha256
    && stagePlan.candidateSealRawSha256 === readinessPlan.bindings.candidateSealRawSha256
    && stagePlan.candidateCertificationRawSha256 === readinessPlan.bindings.candidateCertificationRawSha256,
  "sol-pilot stage-1 plan is not bound to the retained readiness chain");
  const certBytes = readFileSync(resolve(root, CANDIDATE_INSTRUMENT_CERT_REL_PATH));
  const sealBytes = readFileSync(resolve(root, CANDIDATE_INSTRUMENT_SEAL_REL_PATH));
  const hashes = currentRoleHashes(root);
  const chain: SolPilotReadinessChainV1 = {
    readinessResult,
    readinessFreeze,
    roleFreeze,
    plan: readinessPlan,
    planBytesSha256: sha256Hex(readinessPlanBytes),
    callLedgerSha256: hashCanonical(ledger),
    callLedgerBytesSha256: sha256Hex(ledgerBytes),
    instrumentSnapshot: snapshot,
    currentCertificationRecord: JSON.parse(certBytes.toString("utf8")) as SolPilotCertificationRecordV1,
    currentCertificationRawSha256: sha256Hex(certBytes),
    currentSealRecord: JSON.parse(sealBytes.toString("utf8")) as SolPilotProductionSealRecordV1,
    currentSealRawSha256: sha256Hex(sealBytes),
    currentSchemaHashes: hashes.schemaHashes,
    currentPromptSourceHashes: hashes.promptSourceHashes,
  };
  return { chain, stagePlan };
}

// ── Route preflight (ChatGPT-subscription only; no API) ──────────────────────

async function preflightSolPilotRoute(args: {
  repositoryRoot: string;
  qualificationCacheDir?: string;
}): Promise<ForwardNoApiChatgptRouteProofV3> {
  const forbiddenPresent = FORBIDDEN_PROVIDER_ENV.filter((key) => {
    const value = process.env[key];
    return typeof value === "string" && value.length > 0;
  });
  requireCondition(forbiddenPresent.length === 0,
    `sol-pilot parent process carries prohibited provider env key(s): ${forbiddenPresent.join(", ")}`);
  const authPath = resolve(process.env.CODEX_HOME ?? resolve(homedir(), ".codex"), "auth.json");
  const auth = assertChatgptSubscriptionAuth(authPath);
  requireCondition(auth.authMode === "chatgpt" && auth.apiKeyPresent === false,
    "sol-pilot requires ChatGPT-subscription codex authentication with no API key");
  const bin = findCodexBinary();
  const cli = await qualifyCodexCli({
    bin,
    ...(args.qualificationCacheDir ? { cacheDir: args.qualificationCacheDir } : {}),
  });
  assertFlagsSupported(cli, ["--sandbox", "--skip-git-repo-check", "-c", "--ignore-user-config", "--ignore-rules", "--output-last-message", "--output-schema"]);
  requireCondition(!cli.synthetic, "synthetic CLI qualification cannot authorize production live calls");
  const executionProfile = resolveExecutionProfile("chapter-reviewer");
  requireCondition(executionProfile.profile.workingDir === "isolated-workspace"
      && executionProfile.profile.codexHome === "isolated-auth-only"
      && executionProfile.profile.allowedSandboxes.length === 1
      && executionProfile.profile.allowedSandboxes[0] === "read-only",
    "chapter-reviewer execution profile is not hermetic read-only isolation");
  return {
    executionRoute: "codex_exec_chatgpt_subscription",
    authMode: "chatgpt",
    apiKeyPresent: false,
    apiFallbackAllowed: false,
    apiCallsMade: 0,
    forbiddenProviderEnvKeysPresent: [],
    maxParallel: 2,
    executionProfileHash: executionProfile.profileHash,
    routePolicyVersion: ROUTE_POLICY_VERSION,
    directHttpOrSdkAllowed: false,
  };
}

// ── Frozen-input cleanliness (campaign-owned add-on to the CI gate) ──────────

function solPilotFrozenInputsClean(repositoryRoot: string): boolean {
  const rel = `${PIPELINE_REL}/state/migration-experiments/${PILOT_ENVELOPE_EXPERIMENT_ID}`;
  const output = execFileSync("git", [
    "status", "--porcelain=v1", "--untracked-files=all", "--",
    `${rel}/input-freeze.json`,
    `${rel}/input-materialization.json`,
    `${rel}/instrument-snapshot.json`,
    `${rel}/sol-pilot-stage1-plan.json`,
    `${rel}/inputs`,
  ], { cwd: resolve(repositoryRoot), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  return output.trim().length === 0;
}

// ── Campaign ──────────────────────────────────────────────────────────────────

export type SolPilotStage1CampaignReportV1 = {
  schema: typeof SOL_PILOT_STAGE1_REPORT_SCHEMA;
  experimentId: typeof PILOT_ENVELOPE_EXPERIMENT_ID;
  stagePolicyId: typeof SOL_PILOT_STAGE1_STAGE_POLICY_ID;
  status: "STAGE1_CHAPTERS_COMMITTED" | "STAGE1_BLOCKED";
  blockedReason: string | null;
  implementationHeadSha: string;
  implementationCiGateSha256: string;
  stagePlanSha256: string;
  qualificationProofSha256: string;
  reviewConfigSha256: string;
  manifestSha256: string;
  stageScopeSha256: string;
  executeChapterKeys: string[];
  chapterOutcomes: Array<{
    chapterKey: string;
    pass: boolean;
    finalStatus: string;
    stage: string;
    candidateContentSha256: string | null;
    candidateBytesSha256: string | null;
    outputPath: string | null;
    readerComposite: number | null;
  }>;
  callCounts: {
    ledgerEntries: number;
    codexExecInvocations: number;
    cachedReceipts: number;
    infrastructureReplays: number;
    maxPlanCapacityEvents: number;
    safeguardsOrRefusals: number;
    stageCallCeiling: number;
    apiCalls: 0;
  };
  thresholdsWeakened: false;
  holdoutsRelabeled: false;
  retriesAdded: false;
  d7RubricGate: "PENDING_CLAUDE_SIDE_AUDIT";
  externalCapabilities: typeof EXTERNAL_CAPABILITIES;
  completedAt: string;
  reportSha256: string;
};

export type RunSolPilotStage1CampaignArgs = {
  repositoryRoot: string;
  executeLive: typeof SOL_PILOT_STAGE1_EXECUTE_LIVE;
  headSha: string;
  workflowRunId: number;
};

/** Guard the shared campaign ledger to the ratified stage-1 scope: every entry
 * must belong to a scoped chapter, and the entry count must stay under the
 * frozen runaway backstop. Runs before every model call. */
export function assertLedgerWithinStageScope(
  ledgerPath: string,
  scopedChapterKeys: readonly string[],
  ceiling: number,
): void {
  if (!existsSync(ledgerPath)) return;
  const ledger = parseJson<ForwardLiveCallLedgerV1>(ledgerPath, "sol-pilot campaign call ledger");
  requireCondition(ledger.entries.length <= ceiling,
    `sol-pilot stage-1 ledger exceeded the frozen ${ceiling}-call runaway backstop`);
  for (const entry of ledger.entries) {
    requireCondition(typeof entry.bookId === "string" && Number.isInteger(entry.chapterNumber),
      `sol-pilot stage-1 refuses a ledger entry without an exact chapter coordinate: ${entry.logicalOperationId}`);
    const key = `${entry.bookId}/ch${String(entry.chapterNumber).padStart(2, "0")}`;
    requireCondition(scopedChapterKeys.includes(key),
      `sol-pilot stage-1 ledger entry is outside the ratified stage scope: ${entry.logicalOperationId}`);
  }
}

export async function runSolPilotStage1Campaign(
  args: RunSolPilotStage1CampaignArgs,
): Promise<{ report: SolPilotStage1CampaignReportV1; campaign: RunForwardLiveCampaignResultSolPilotV1 }> {
  requireCondition(args.executeLive === SOL_PILOT_STAGE1_EXECUTE_LIVE,
    "sol-pilot stage-1 live execution requires the explicit executeLive literal");
  const root = resolve(args.repositoryRoot);
  const paths = solPilotStage1Paths(root);
  for (const [label, path] of Object.entries({
    "input freeze": paths.inputFreeze,
    "input materialization": paths.inputMaterialization,
    "instrument snapshot": paths.instrumentSnapshot,
    "stage-1 plan": paths.stagePlan,
  })) requireCondition(existsSync(path), `frozen ${label} is missing (run materialize/mint first): ${path}`);

  // 1. Implementation/CI/PR gate before any model call, plus frozen-input
  //    cleanliness for the pilot envelope itself.
  const gate: PilotReadinessCiGateV1 = collectPilotReadinessCiGate({
    repositoryRoot: root,
    expectedHeadSha: args.headSha,
    workflowRunId: args.workflowRunId,
    verifiedAt: new Date().toISOString(),
  });
  requireCondition(solPilotFrozenInputsClean(root),
    "sol-pilot frozen envelope inputs (freeze/materialization/snapshot/plan/inputs) are not committed-clean");
  persistLaunchRecord(paths.gatesDir, "implementation-ci-gate", gate, "sol-pilot implementation CI gate");

  // 2. Retained readiness chain + current instrument identity.
  const { chain, stagePlan } = loadSolPilotReadinessChain(root);

  // 3. ChatGPT-only route preflight.
  const route = await preflightSolPilotRoute({
    repositoryRoot: root,
    qualificationCacheDir: resolve(paths.liveCampaignDir, "execution", "qualification-preflight-cache"),
  });
  persistLaunchRecord(paths.gatesDir, "route-preflight", route, "sol-pilot route preflight");

  // 4. Frozen role assignment, review config, and qualification proof.
  const roleAssignment = buildSolPilotFixedRoleAssignment(chain.readinessResult, chain.roleFreeze);
  const bound = composeSolPilotBoundReviewConfig({
    chain,
    roleAssignment,
    executionProfileHash: route.executionProfileHash,
    routePolicyVersion: route.routePolicyVersion,
  });
  const proof = composeSolPilotStage1QualificationProof({ chain, roleAssignment });
  persistExactJson(paths.qualificationProof, proof, "sol-pilot qualification proof");
  persistExactJson(paths.reviewConfig, bound, "sol-pilot bound review config");

  // 5. Frozen inputs -> deterministic eight-coordinate manifest -> stage scope.
  const inputFreeze = parseJson<ForwardInputFreezeV1>(paths.inputFreeze, "forward input freeze");
  assertForwardInputFreezeFresh(inputFreeze);
  const materializationBytes = readFileSync(paths.inputMaterialization);
  const manifest = buildPilotManifestV2Envelope({
    frozenAtIso: inputFreeze.frozenAtIso,
    roleAssignmentSha256: proof.roleAssignmentSha256,
    instrumentManifestSha256: bound.config.instrumentManifestSha256,
    thresholdsSha256: bound.config.instrumentManifest.thresholdsSha256,
    inputMaterializationSha256: sha256Hex(materializationBytes),
    productionInstrumentSealSha256: proof.currentProductionInstrumentSealSha256,
    qualificationBookIds: inputFreeze.sets.qualificationBookIds,
    books: inputFreeze.pilot,
    goldReservedBookIds: inputFreeze.sets.goldBookIds,
  });
  requireCondition(manifest.manifest.targets.length === 8, "sol-pilot manifest denominator drift");
  const stageScope = buildSolPilotStage1Scope(manifest);
  persistExactJson(paths.stageScope, stageScope, "sol-pilot stage scope");

  // 6. Full materialization proof (also yields exact per-chapter partition
  //    counts and the per-book input file inventory).
  const materializationProof = validateForwardInputMaterializationArtifact({
    phaseDir: paths.envelopeDir,
    artifactPath: paths.inputMaterialization,
    manifest,
    inputFreeze,
  });
  const assertInputMaterializationFresh = (): void => {
    const currentPlanBytes = readFileSync(paths.stagePlan);
    requireCondition(sha256Hex(currentPlanBytes) === sha256Hex(Buffer.from(`${canonicalJson(stagePlan)}\n`)),
      "sol-pilot stage-1 plan bytes drifted during the live campaign");
    const current = validateForwardInputMaterializationArtifact({
      phaseDir: paths.envelopeDir,
      artifactPath: paths.inputMaterialization,
      manifest,
      inputFreeze,
    });
    requireCondition(current.proofSha256 === materializationProof.proofSha256,
      "sol-pilot input materialization proof drifted after preflight");
  };

  // 7. Budget + create-once stage authorization before the first call.
  const budget = buildForwardLivePhaseBudget({
    manifest,
    panelPolicy: bound.config.panelPolicy,
    sourcePartitionCountByChapter: materializationProof.sourcePartitionCountByChapter,
  });
  requireCondition(stagePlan.stage1CallCeiling <= budget.hardMaximumCalls,
    "stage-1 runaway backstop cannot exceed the frozen full-phase hard maximum");
  const authorizationCore = {
    schema: SOL_PILOT_STAGE1_AUTHORIZATION_SCHEMA,
    experimentId: PILOT_ENVELOPE_EXPERIMENT_ID,
    stagePolicyId: stageScope.policyId,
    executeChapterKeys: [...stageScope.executeChapterKeys],
    stage1CallCeiling: stagePlan.stage1CallCeiling,
    stagePlanSha256: stagePlan.planSha256,
    gateSha256: gate.gateSha256,
    manifestSha256: manifest.manifestSha256,
    budgetSha256: budget.budgetSha256,
    qualificationProofSha256: proof.proofSha256,
    reviewConfigSha256: bound.configSha256,
    externalCapabilities: EXTERNAL_CAPABILITIES,
  };
  persistLaunchRecord(paths.gatesDir, "authorization", {
    ...authorizationCore,
    authorizationSha256: hashCanonical(authorizationCore),
  }, "sol-pilot stage-1 authorization");

  // 8. Execute through the exact production driver core.
  const evidence = createForwardCampaignEvidenceStore(paths.envelopeDir);
  const campaign = await runForwardLiveCampaignSolPilotStage1({
    phaseDir: paths.liveCampaignDir,
    manifest,
    inputFreeze,
    chain,
    proof,
    reviewConfig: bound.config,
    reviewConfigSha256: bound.configSha256,
    stageScope: { policyId: stageScope.policyId, executeChapterKeys: [...stageScope.executeChapterKeys] },
    route,
    verifiedInputMaterializationSha256: materializationProof.artifactBytesSha256,
    verifiedProductionInstrumentSealSha256: proof.currentProductionInstrumentSealSha256,
    sourcePartitionCountByChapter: materializationProof.sourcePartitionCountByChapter,
    beforePilotModelCall: () => {
      assertInputMaterializationFresh();
      assertLedgerWithinStageScope(paths.callLedger, stageScope.executeChapterKeys, stagePlan.stage1CallCeiling);
    },
    createAuthorProducer: (controller) => createLedgeredDeferredAuthorProducer({
      controller,
      phaseDir: paths.liveCampaignDir,
      kind: "pilot",
      productionInstrumentSealSha256: proof.currentProductionInstrumentSealSha256,
      assertInputMaterializationFresh,
      ioFor: (target) => createExplicitExperimentAuthorDestination({
        phaseDir: paths.envelopeDir,
        target,
        expectedInputFileInventory: materializationProof.bookFileInventory[target.bookId],
      }),
    }),
    buildConductorInput: ({ target, prepared }): ForwardChapterConductorInputV1 => {
      assertInputMaterializationFresh();
      const nn = String(target.chapterNumber).padStart(2, "0");
      const inputRoot = resolve(paths.envelopeDir, "inputs", target.bookId);
      const sidecarPath = resolve(inputRoot, "source-archive", target.bookId, `ch${nn}.source.json`);
      const anchorPath = resolve(inputRoot, "source-archive", target.bookId, `ch${nn}.anchors.json`);
      const reread = () => ({
        sourceSidecar: parseJson<unknown>(sidecarPath, `${target.bookId}/ch${nn} source sidecar`),
        anchorCatalog: parseJson<never[]>(anchorPath, `${target.bookId}/ch${nn} anchor catalog`),
      });
      const evidenceFiles = reread();
      const sourcePacket = prepared.io.readPacket(target.bookId, target.chapterNumber) as SourcePacketV1 | null;
      requireCondition(sourcePacket !== null, `${target.bookId}/ch${nn}: materialized source packet is missing`);
      return {
        prepared,
        sourcePacket: sourcePacket!,
        sourceSidecar: evidenceFiles.sourceSidecar,
        anchorCatalog: evidenceFiles.anchorCatalog,
        rereadAuthoritativeSourceEvidence: reread,
        frozen: bound.config,
      };
    },
    routeFirstFailure: ({ first }) => routeExplicitForwardFirstFailure(first),
    classifyFailedRepair: ({ repair }) => repair.repairFailureDisposition
      ?? (repair.failureClassification === "MODEL_ROUTING" || repair.failureClassification === "STATE_OR_PROVENANCE"
        ? "INFRASTRUCTURE"
        : "REPAIR_CONTENT_FAILURE"),
    ...evidence,
    beforeReviewerCall: assertInputMaterializationFresh,
    assertFinalFreshness: () => {
      assertInputMaterializationFresh();
    },
  });

  // 9. Stage verdict from the exact scoped finals (never relabeled).
  const ledger = parseJson<ForwardLiveCallLedgerV1>(paths.callLedger, "sol-pilot campaign call ledger");
  const chapterOutcomes = stageScope.executeChapterKeys.map((chapterKey) => {
    const final = campaign.campaign.finalByChapter[chapterKey];
    const target = manifest.manifest.targets.find((candidate) =>
      `${candidate.bookId}/ch${String(candidate.chapterNumber).padStart(2, "0")}` === chapterKey)!;
    return {
      chapterKey,
      pass: final?.pass === true,
      finalStatus: final?.finalStatus ?? "MISSING",
      stage: final?.stage ?? "MISSING",
      candidateContentSha256: final?.candidateContentSha256 ?? null,
      candidateBytesSha256: final?.candidateBytesSha256 ?? null,
      outputPath: final?.pass === true
        ? resolve(paths.liveCampaignDir, "outputs", target.outputRunId, "chapters")
        : null,
      readerComposite: final?.aggregate?.readerComposite ?? null,
    };
  });
  const allPassed = chapterOutcomes.every((outcome) => outcome.pass);
  const reportCore: Omit<SolPilotStage1CampaignReportV1, "reportSha256"> = {
    schema: SOL_PILOT_STAGE1_REPORT_SCHEMA,
    experimentId: PILOT_ENVELOPE_EXPERIMENT_ID,
    stagePolicyId: SOL_PILOT_STAGE1_STAGE_POLICY_ID,
    status: allPassed ? "STAGE1_CHAPTERS_COMMITTED" : "STAGE1_BLOCKED",
    blockedReason: allPassed
      ? null
      : chapterOutcomes.filter((o) => !o.pass).map((o) => `${o.chapterKey}: ${o.finalStatus}`).join("; "),
    implementationHeadSha: gate.headSha,
    implementationCiGateSha256: gate.gateSha256,
    stagePlanSha256: stagePlan.planSha256,
    qualificationProofSha256: proof.proofSha256,
    reviewConfigSha256: bound.configSha256,
    manifestSha256: manifest.manifestSha256,
    stageScopeSha256: hashCanonical(stageScope),
    executeChapterKeys: [...stageScope.executeChapterKeys],
    chapterOutcomes,
    callCounts: {
      ledgerEntries: ledger.entries.length,
      codexExecInvocations: campaign.codexExecInvocations,
      cachedReceipts: campaign.cachedReceipts,
      infrastructureReplays: campaign.infrastructureReplays,
      maxPlanCapacityEvents: campaign.maxPlanCapacityEvents,
      safeguardsOrRefusals: campaign.safeguardsOrRefusals,
      stageCallCeiling: stagePlan.stage1CallCeiling,
      apiCalls: 0,
    },
    thresholdsWeakened: false,
    holdoutsRelabeled: false,
    retriesAdded: false,
    d7RubricGate: "PENDING_CLAUDE_SIDE_AUDIT",
    externalCapabilities: EXTERNAL_CAPABILITIES,
    completedAt: new Date().toISOString(),
  };
  const report: SolPilotStage1CampaignReportV1 = { ...reportCore, reportSha256: hashCanonical(reportCore) };
  persistLaunchRecord(paths.stage1Dir, "stage1-report", report, "sol-pilot stage-1 report");
  atomicJson(paths.stageReportDocsJson, report);
  writeFileAtomic(paths.stageReportMarkdown, renderSolPilotStage1Markdown(report));
  return { report, campaign };
}

export function renderSolPilotStage1Markdown(report: SolPilotStage1CampaignReportV1): string {
  return [
    "# SOL Pilot Stage 1 — Live Result",
    "",
    `- Status: **${report.status}**`,
    ...(report.blockedReason ? [`- Blocked reason: ${report.blockedReason}`] : []),
    `- Experiment: \`${report.experimentId}\` · stage policy \`${report.stagePolicyId}\``,
    `- Exact implementation HEAD: \`${report.implementationHeadSha}\``,
    `- Qualification: \`${PILOT_ROLE_READINESS_V6_EXPERIMENT_ID}\` proof \`${report.qualificationProofSha256.slice(0, 12)}…\``,
    `- Manifest: \`${report.manifestSha256.slice(0, 12)}…\` · scope ${report.executeChapterKeys.join(", ")}`,
    `- Ledger entries: **${report.callCounts.ledgerEntries}** (ceiling ${report.callCounts.stageCallCeiling}) · codex exec **${report.callCounts.codexExecInvocations}** · replays **${report.callCounts.infrastructureReplays}** · API calls **0**`,
    "- Gate weakening: **none**. Thresholds, decision policies, role assignment, scope, and budget remained frozen.",
    `- D7 rubric gate: **${report.d7RubricGate}** (Claude-side blind rater pair + adjudicator; both chapters must reach mean >= 85).`,
    "",
    "## Chapters",
    "",
    ...report.chapterOutcomes.map((outcome) =>
      `- \`${outcome.chapterKey}\` -> **${outcome.finalStatus}** (pass=${outcome.pass}, stage=${outcome.stage}, readerComposite=${outcome.readerComposite ?? "n/a"})`),
    "",
  ].join("\n");
}
