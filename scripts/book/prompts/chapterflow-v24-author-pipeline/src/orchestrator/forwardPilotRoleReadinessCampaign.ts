/**
 * s16-forward-pilot-role-readiness-v1 — live campaign boundary (plan v2 P5).
 *
 * This is the ONLY module that may authorize pilot-role-readiness reviewer
 * calls. It derives an exact implementation/CI/PR gate from the current
 * checkout and live GitHub CLI evidence, loads the frozen corpus and the
 * launch-minted bind-once plan, re-runs the ChatGPT-only route preflight,
 * persists every immutable authorizer before the first possible call, and
 * delegates every attempt to the retained IMP-24 crash-safe live executor
 * under the readiness execution identity (84 base / 168 hard ceilings).
 * It has no publish, promotion, deployment, upload, merge, force-push,
 * API-provider, SDK, or HTTP capability.
 *
 * Gate note: unlike the IMP-24 campaign gate, PR #401 is required to be OPEN
 * and unmerged at the exact implementation head but is NOT required to be a
 * draft — the owner deliberately un-drafted #401 on 2026-07-15; the observed
 * draft state is recorded verbatim in the gate evidence instead.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
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
  validateForwardProductionInstrumentSeal,
  type ForwardProductionInstrumentSealV1,
} from "./forwardProductionInstrumentSeal.js";
import {
  IMP24_REQUIRED_BRANCH,
  IMP24_REQUIRED_DRAFT_PR,
  IMP24_REQUIRED_GH_REPOSITORY,
  IMP24_REQUIRED_REPOSITORY,
  IMP24_REQUIRED_REPOSITORY_URL,
  IMP24_REQUIRED_WORKFLOW_FILE,
  IMP24_REQUIRED_WORKFLOW_JOB,
  IMP24_REQUIRED_WORKFLOW_NAME,
  IMP24_WORKFLOW_RUN_QUERY_FIELDS,
  mapImp24GithubWorkflowRunQuery,
  normalizeImp24WorkflowFilePath,
  type Imp24GithubWorkflowRunQueryV1,
  type Imp24TrustedPullRequestEvidenceV1,
  type Imp24TrustedRepositoryEvidenceV1,
  type Imp24TrustedWorkflowRunEvidenceV1,
} from "./forwardRoleQualificationCampaignV3.js";
import {
  IMP24_CANDIDATE_AVAILABILITY_POLICY_BYTES_SHA256,
  IMP24_FROZEN_CANDIDATE_AVAILABILITY_POLICY,
  IMP24_LIVE_PREFLIGHT_SCHEMA,
  createLiveQualificationExecutorV3,
  discoverCandidateAvailabilityV3,
  fatalReceiptChronologyViolationsV3,
  liveCallCeilingsForExecutionIdentityV3,
  replayReceiptChronologyViolationsV3,
  validateLiveQualificationPreflightArtifactV3,
  type LiveCallLedgerV3,
  type LiveQualificationPreflightV3,
} from "./forwardRoleQualificationLiveV3.js";
import {
  candidateAvailabilityProvenanceProjectionV3,
  candidateAvailabilityProvenanceSha256,
  candidateAvailabilitySemanticProjectionV3,
  candidateAvailabilitySemanticSha256,
  instrumentCertificationBindingSha256,
  type InstrumentCertificationBindingV3,
} from "../bakeoff/migration/roleQualificationRunnerV3.js";
import { QUIZ_DETERMINISTIC_CHECKER_VERSION } from "../bakeoff/migration/reviewerRoleAssignment.js";
import {
  CANDIDATE_INSTRUMENT_CERT_REL_PATH,
  CANDIDATE_INSTRUMENT_SEAL_REL_PATH,
  PILOT_READINESS_BUDGET,
  PILOT_READINESS_STOPPING,
  PILOT_ROLE_READINESS_DIR_REL_PATH,
  PILOT_ROLE_READINESS_EXPERIMENT_ID,
  materializePilotRoleReadiness,
  type PilotRoleReadinessCorpusV1,
  type PilotRoleReadinessPlanV1,
} from "../bakeoff/migration/pilotRoleReadinessInstrument.js";
import { createPilotRoleReadinessEvaluator } from "../bakeoff/migration/pilotRoleReadinessEvaluator.js";
import {
  buildPilotReadinessExecutionRequest,
  buildPilotRoleReadinessPlanForExecution,
  preparePilotReadinessCases,
  runPilotRoleReadiness,
  stampReadinessCandidateAvailability,
  type PilotRoleReadinessFreezeV1,
  type PilotRoleReadinessRunnerResultV1,
  type ReadinessScheduleEntryV1,
  type RunPilotRoleReadinessInputV1,
} from "../bakeoff/migration/pilotRoleReadinessRunner.js";

export const PILOT_READINESS_CI_GATE_SCHEMA = "pilot-readiness-implementation-ci-gate-v1" as const;
export const PILOT_READINESS_CAMPAIGN_REPORT_SCHEMA = "pilot-role-readiness-campaign-report-v1" as const;
export const PILOT_READINESS_ROLE_FREEZE_SCHEMA = "pilot-role-freeze-v1" as const;
export const PILOT_READINESS_AVAILABILITY_PROVENANCE_LEDGER_SCHEMA =
  "pilot-readiness-candidate-availability-provenance-ledger-v1" as const;

const PIPELINE_REL = "scripts/book/prompts/chapterflow-v24-author-pipeline";
const SHA256 = /^[a-f0-9]{64}$/;
const GIT_SHA = /^[a-f0-9]{40}$/;

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

export class ForwardPilotRoleReadinessCampaignError extends Error {
  readonly classification = "policy_preflight_failure" as const;

  constructor(message: string) {
    super(message);
    this.name = "ForwardPilotRoleReadinessCampaignError";
  }
}

function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new ForwardPilotRoleReadinessCampaignError(message);
}

function requireSha(value: unknown, label: string): asserts value is string {
  requireCondition(typeof value === "string" && SHA256.test(value), `${label} must be a lowercase sha256`);
}

function requireGitSha(value: unknown, label: string): asserts value is string {
  requireCondition(typeof value === "string" && GIT_SHA.test(value), `${label} must be an exact lowercase 40-character git SHA`);
}

// ── Implementation / CI / PR gate ────────────────────────────────────────────

export type PilotReadinessCheckoutIdentityV1 = {
  branch: string;
  headSha: string;
  implementationClean: boolean;
};

export type PilotReadinessCiGateV1 = {
  schema: typeof PILOT_READINESS_CI_GATE_SCHEMA;
  branch: typeof IMP24_REQUIRED_BRANCH;
  headSha: string;
  repository: {
    nameWithOwner: typeof IMP24_REQUIRED_REPOSITORY;
    url: typeof IMP24_REQUIRED_REPOSITORY_URL;
  };
  workflow: {
    displayName: typeof IMP24_REQUIRED_WORKFLOW_NAME;
    workflowFile: typeof IMP24_REQUIRED_WORKFLOW_FILE;
    runId: number;
    headBranch: typeof IMP24_REQUIRED_BRANCH;
    headSha: string;
    status: "completed";
    conclusion: "success";
    requiredJob: {
      name: typeof IMP24_REQUIRED_WORKFLOW_JOB;
      status: "completed";
      conclusion: "success";
    };
  };
  pullRequest: {
    number: typeof IMP24_REQUIRED_DRAFT_PR;
    state: "OPEN";
    /** Recorded verbatim; the readiness gate does NOT require draft state. */
    isDraft: boolean;
    merged: false;
    mergedAt: null;
    mergeCommitSha: null;
    headBranch: typeof IMP24_REQUIRED_BRANCH;
    headSha: string;
  };
  trustedEvidence: {
    method: "git-and-gh-cli-live-query-readiness-v1";
    raw: {
      checkout: PilotReadinessCheckoutIdentityV1;
      repository: Imp24TrustedRepositoryEvidenceV1;
      workflowRun: Imp24TrustedWorkflowRunEvidenceV1;
      pullRequest: Imp24TrustedPullRequestEvidenceV1;
    };
    checkoutSha256: string;
    repositorySha256: string;
    workflowRunSha256: string;
    pullRequestSha256: string;
  };
  verifiedAt: string;
  modelCalls: 0;
  apiCalls: 0;
  gateSha256: string;
};

/** Every path whose drift could change what this campaign executes or what
 * its frozen instruments were selected from. The readiness experiment dir is
 * deliberately narrowed to its two FROZEN inputs (corpus + plan): the
 * campaign itself retains its gate/availability/live evidence under that dir
 * while running, and a same-head crash-resume must not fail its own
 * cleanliness check. Those retained artifacts are protected by create-once
 * persistence, the executor's per-attempt validation, and the resume audit —
 * not by this scan. */
function readinessImplementationPaths(): string[] {
  return [
    `${PIPELINE_REL}/src`,
    `${PIPELINE_REL}/config`,
    `${PIPELINE_REL}/tests`,
    `${PIPELINE_REL}/package.json`,
    `${PIPELINE_REL}/package-lock.json`,
    `${PIPELINE_REL}/state/migration-experiments/contracts/imp24`,
    `${PIPELINE_REL}/state/migration-experiments/contracts/imp24f`,
    `${PIPELINE_REL}/state/migration-experiments/contracts/schemas`,
    `${PILOT_ROLE_READINESS_DIR_REL_PATH}/readiness-corpus.v1.json`,
    `${PILOT_ROLE_READINESS_DIR_REL_PATH}/readiness-plan.v1.json`,
    `${PIPELINE_REL}/state/migration-experiments/reader-gold-dev-pool-v1`,
    "book-packages",
    IMP24_REQUIRED_WORKFLOW_FILE,
  ];
}

function ghJson<T>(repositoryRoot: string, args: string[], label: string): T {
  try {
    const raw = execFileSync("gh", args, {
      cwd: resolve(repositoryRoot),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 4 * 1024 * 1024,
    });
    return JSON.parse(raw) as T;
  } catch (error) {
    throw new ForwardPilotRoleReadinessCampaignError(
      `trusted ${label} query failed before any model call: ${(error as Error).message}`,
    );
  }
}

function readinessCheckoutIdentity(repositoryRoot: string): PilotReadinessCheckoutIdentityV1 {
  const run = (args: string[]): string => execFileSync("git", args, {
    cwd: resolve(repositoryRoot),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
  return {
    branch: run(["branch", "--show-current"]),
    headSha: run(["rev-parse", "HEAD"]),
    implementationClean: run([
      "status", "--porcelain=v1", "--untracked-files=all", "--", ...readinessImplementationPaths(),
    ]).length === 0,
  };
}

export function pilotReadinessCiGateSha256(value: Omit<PilotReadinessCiGateV1, "gateSha256">): string {
  return hashCanonical(value);
}

export function buildPilotReadinessCiGateFromEvidence(args: {
  expectedHeadSha: string;
  workflowRunId: number;
  checkout: PilotReadinessCheckoutIdentityV1;
  workflowRun: Imp24TrustedWorkflowRunEvidenceV1;
  pullRequest: Imp24TrustedPullRequestEvidenceV1;
  repository: Imp24TrustedRepositoryEvidenceV1;
  verifiedAt: string;
}): PilotReadinessCiGateV1 {
  requireGitSha(args.expectedHeadSha, "expected implementation HEAD");
  requireCondition(Number.isSafeInteger(args.workflowRunId) && args.workflowRunId > 0,
    "dedicated V25 workflow run ID must be a positive integer");
  requireCondition(args.checkout.branch === IMP24_REQUIRED_BRANCH,
    `current checkout is not on ${IMP24_REQUIRED_BRANCH}`);
  requireGitSha(args.checkout.headSha, "current checkout HEAD");
  requireCondition(args.checkout.headSha === args.expectedHeadSha,
    "current checkout HEAD differs from the exact requested implementation HEAD");
  requireCondition(args.checkout.implementationClean === true,
    "current checkout has implementation/state drift outside the exact requested HEAD");

  const run = args.workflowRun;
  requireCondition(run.databaseId === args.workflowRunId,
    "live GitHub workflow evidence has the wrong run database ID");
  requireCondition(run.displayName === IMP24_REQUIRED_WORKFLOW_NAME,
    `live GitHub workflow display name must be exactly ${IMP24_REQUIRED_WORKFLOW_NAME}`);
  const workflowFile = normalizeImp24WorkflowFilePath(run.workflowFile);
  requireCondition(workflowFile === IMP24_REQUIRED_WORKFLOW_FILE,
    `live GitHub workflow file must be exactly ${IMP24_REQUIRED_WORKFLOW_FILE}`);
  requireCondition(run.headBranch === IMP24_REQUIRED_BRANCH && run.headSha === args.expectedHeadSha,
    "live GitHub workflow head differs from the exact implementation HEAD");
  requireCondition(run.status === "completed" && run.conclusion === "success",
    "live GitHub workflow did not complete successfully");
  const exactJobs = run.jobs.filter((job) => job.name === IMP24_REQUIRED_WORKFLOW_JOB);
  requireCondition(exactJobs.length === 1
      && exactJobs[0].status === "completed" && exactJobs[0].conclusion === "success",
    `live GitHub evidence does not show exactly one successful ${IMP24_REQUIRED_WORKFLOW_JOB} job`);

  requireCondition(args.repository.nameWithOwner === IMP24_REQUIRED_REPOSITORY
      && args.repository.url === IMP24_REQUIRED_REPOSITORY_URL,
    `live GitHub repository identity must be exactly ${IMP24_REQUIRED_REPOSITORY_URL}`);
  const pr = args.pullRequest;
  requireCondition(pr.number === IMP24_REQUIRED_DRAFT_PR
      && pr.state === "OPEN"
      && typeof pr.isDraft === "boolean"
      && pr.mergedAt === null
      && pr.mergeCommit === null
      && pr.headRefName === IMP24_REQUIRED_BRANCH
      && pr.headRefOid === args.expectedHeadSha,
    "live GitHub evidence is not the open, unmerged PR #401 at the exact implementation HEAD");
  requireCondition(typeof args.verifiedAt === "string"
      && Number.isFinite(Date.parse(args.verifiedAt))
      && new Date(args.verifiedAt).toISOString() === args.verifiedAt,
    "trusted implementation verification time must be an exact canonical ISO timestamp");

  const raw = JSON.parse(canonicalJson({
    checkout: args.checkout,
    repository: args.repository,
    workflowRun: args.workflowRun,
    pullRequest: args.pullRequest,
  })) as PilotReadinessCiGateV1["trustedEvidence"]["raw"];
  const core: Omit<PilotReadinessCiGateV1, "gateSha256"> = {
    schema: PILOT_READINESS_CI_GATE_SCHEMA,
    branch: IMP24_REQUIRED_BRANCH,
    headSha: args.expectedHeadSha,
    repository: {
      nameWithOwner: IMP24_REQUIRED_REPOSITORY,
      url: IMP24_REQUIRED_REPOSITORY_URL,
    },
    workflow: {
      displayName: IMP24_REQUIRED_WORKFLOW_NAME,
      workflowFile: IMP24_REQUIRED_WORKFLOW_FILE,
      runId: args.workflowRunId,
      headBranch: IMP24_REQUIRED_BRANCH,
      headSha: args.expectedHeadSha,
      status: "completed",
      conclusion: "success",
      requiredJob: {
        name: IMP24_REQUIRED_WORKFLOW_JOB,
        status: "completed",
        conclusion: "success",
      },
    },
    pullRequest: {
      number: IMP24_REQUIRED_DRAFT_PR,
      state: "OPEN",
      isDraft: pr.isDraft,
      merged: false,
      mergedAt: null,
      mergeCommitSha: null,
      headBranch: IMP24_REQUIRED_BRANCH,
      headSha: args.expectedHeadSha,
    },
    trustedEvidence: {
      method: "git-and-gh-cli-live-query-readiness-v1",
      raw,
      checkoutSha256: hashCanonical(raw.checkout),
      repositorySha256: hashCanonical(raw.repository),
      workflowRunSha256: hashCanonical(raw.workflowRun),
      pullRequestSha256: hashCanonical(raw.pullRequest),
    },
    verifiedAt: args.verifiedAt,
    modelCalls: 0,
    apiCalls: 0,
  };
  return { ...core, gateSha256: pilotReadinessCiGateSha256(core) };
}

export function validatePilotReadinessCiGate(args: {
  gate: PilotReadinessCiGateV1;
  expectedHeadSha: string;
  checkout: PilotReadinessCheckoutIdentityV1;
}): void {
  const gate = args.gate;
  requireCondition(gate.schema === PILOT_READINESS_CI_GATE_SCHEMA, "readiness CI gate schema mismatch");
  const { gateSha256, ...core } = gate;
  requireSha(gateSha256, "readiness CI gate self hash");
  requireCondition(pilotReadinessCiGateSha256(core) === gateSha256, "readiness CI gate self hash drift");
  // Rebuild from the retained preimages; every field-level requirement is
  // re-enforced by the builder, then the rebuilt gate must be byte-identical.
  const rebuilt = buildPilotReadinessCiGateFromEvidence({
    expectedHeadSha: args.expectedHeadSha,
    workflowRunId: gate.workflow.runId,
    checkout: gate.trustedEvidence.raw.checkout,
    workflowRun: gate.trustedEvidence.raw.workflowRun,
    pullRequest: gate.trustedEvidence.raw.pullRequest,
    repository: gate.trustedEvidence.raw.repository,
    verifiedAt: gate.verifiedAt,
  });
  requireCondition(hashCanonical(rebuilt) === hashCanonical(gate),
    "readiness CI gate differs from its retained trusted-evidence preimages");
  requireCondition(hashCanonical(gate.trustedEvidence.raw.checkout) === hashCanonical(args.checkout),
    "retained trusted checkout evidence differs from the current checkout identity");
}

export function collectPilotReadinessCiGate(args: {
  repositoryRoot: string;
  expectedHeadSha: string;
  workflowRunId: number;
  verifiedAt: string;
}): PilotReadinessCiGateV1 {
  const checkout = readinessCheckoutIdentity(args.repositoryRoot);
  const workflowRun = mapImp24GithubWorkflowRunQuery(ghJson<Imp24GithubWorkflowRunQueryV1>(args.repositoryRoot, [
    "run", "view", String(args.workflowRunId),
    "--repo", IMP24_REQUIRED_GH_REPOSITORY,
    "--json", IMP24_WORKFLOW_RUN_QUERY_FIELDS.join(","),
  ], "dedicated V25 workflow"));
  const pullRequest = ghJson<Imp24TrustedPullRequestEvidenceV1>(args.repositoryRoot, [
    "pr", "view", String(IMP24_REQUIRED_DRAFT_PR),
    "--repo", IMP24_REQUIRED_GH_REPOSITORY,
    "--json", "number,state,isDraft,mergedAt,mergeCommit,headRefName,headRefOid",
  ], "PR #401");
  const repository = ghJson<Imp24TrustedRepositoryEvidenceV1>(args.repositoryRoot, [
    "repo", "view", IMP24_REQUIRED_GH_REPOSITORY, "--json", "nameWithOwner,url",
  ], "repository identity");
  return buildPilotReadinessCiGateFromEvidence({
    expectedHeadSha: args.expectedHeadSha,
    workflowRunId: args.workflowRunId,
    checkout,
    workflowRun,
    pullRequest,
    repository,
    verifiedAt: args.verifiedAt,
  });
}

// ── Route preflight (readiness identity; 84/168 ceilings) ────────────────────

export async function preflightPilotRoleReadinessLive(args: {
  repositoryRoot: string;
  freeze: PilotRoleReadinessFreezeV1;
  productionInstrumentSeal: ForwardProductionInstrumentSealV1;
  candidateAvailability: RunPilotRoleReadinessInputV1["candidateAvailability"];
  verifiedAt: string;
  authJsonPath?: string;
  codexBinary?: string;
  qualificationCacheDir?: string;
}): Promise<LiveQualificationPreflightV3> {
  const currentSeal = validateForwardProductionInstrumentSeal(args.productionInstrumentSeal, {
    repositoryRoot: resolve(args.repositoryRoot),
  });
  requireCondition(currentSeal.sealSha256 === args.freeze.productionInstrumentSealSha256,
    "retained production seal differs from the frozen readiness input");
  const forbiddenProviderEnvKeysPresent = FORBIDDEN_PROVIDER_ENV.filter((key) => {
    const value = process.env[key];
    return typeof value === "string" && value.length > 0;
  });
  requireCondition(forbiddenProviderEnvKeysPresent.length === 0,
    `readiness parent process carries prohibited provider env key(s): ${forbiddenProviderEnvKeysPresent.join(", ")}`);
  const authPath = args.authJsonPath ?? resolve(process.env.CODEX_HOME ?? resolve(homedir(), ".codex"), "auth.json");
  const auth = assertChatgptSubscriptionAuth(authPath);
  const bin = args.codexBinary ?? findCodexBinary();
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

  const ceilings = liveCallCeilingsForExecutionIdentityV3(PILOT_ROLE_READINESS_EXPERIMENT_ID);
  const availabilitySemantic = candidateAvailabilitySemanticSha256(args.candidateAvailability);
  const draft: Omit<LiveQualificationPreflightV3, "preflightSha256"> = {
    schema: IMP24_LIVE_PREFLIGHT_SCHEMA,
    experimentId: PILOT_ROLE_READINESS_EXPERIMENT_ID,
    verifiedAt: new Date(args.verifiedAt).toISOString(),
    freezeSha256: args.freeze.freezeSha256,
    certificationSha256: args.freeze.certificationSha256,
    productionInstrumentSealSha256: args.freeze.productionInstrumentSealSha256,
    corpusBundleSha256: args.freeze.corpusSha256,
    candidateAvailabilitySha256: availabilitySemantic,
    candidateAvailabilitySemanticSha256: availabilitySemantic,
    candidateAvailabilityProvenanceSha256: args.candidateAvailability.provenanceSha256!,
    candidateAvailabilitySourceBytesSha256: args.candidateAvailability.sourceBytesSha256,
    cliVersion: cli.version,
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
    baseMaximumCalls: ceilings.baseMaximumCalls,
    hardMaximumCalls: ceilings.hardMaximumCalls,
  };
  const preflight = Object.freeze({ ...draft, preflightSha256: hashCanonical(draft) });
  validateLiveQualificationPreflightArtifactV3(preflight, PILOT_ROLE_READINESS_EXPERIMENT_ID);
  return preflight;
}

// ── Persistence helpers (create-once exact resume) ───────────────────────────

function atomicJson(path: string, value: unknown): void {
  writeFileAtomic(path, `${canonicalJson(value)}\n`);
}

function parseJson<T>(path: string, label: string): T {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch (error) {
    throw new ForwardPilotRoleReadinessCampaignError(`${label} is not valid retained JSON: ${(error as Error).message}`);
  }
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

export type PilotReadinessCampaignPathsV1 = {
  experimentDir: string;
  liveDir: string;
  implementationCiGate: string;
  candidateAvailability: string;
  candidateAvailabilitySemantic: string;
  candidateAvailabilityProvenance: string;
  preflight: string;
  readinessFreeze: string;
  readinessResult: string;
  callLedger: string;
  campaignReportJson: string;
  campaignReportDocsJson: string;
  campaignReportMarkdown: string;
  roleFreeze: string;
  roleFreezeDocsJson: string;
  roleFreezeMarkdown: string;
};

export function pilotReadinessCampaignPaths(repositoryRoot: string): PilotReadinessCampaignPathsV1 {
  const experimentDir = resolve(repositoryRoot, PILOT_ROLE_READINESS_DIR_REL_PATH);
  const liveDir = resolve(experimentDir, "live");
  const reportDir = resolve(repositoryRoot, "docs", "v25", "reports");
  return {
    experimentDir,
    liveDir,
    implementationCiGate: resolve(experimentDir, "implementation-ci-gate.json"),
    candidateAvailability: resolve(experimentDir, "candidate-availability.json"),
    candidateAvailabilitySemantic: resolve(experimentDir, "candidate-availability-semantic.json"),
    candidateAvailabilityProvenance: resolve(experimentDir, "candidate-availability-provenance.json"),
    preflight: resolve(liveDir, "preflight.json"),
    readinessFreeze: resolve(liveDir, "readiness-freeze.json"),
    // The retained executor arms its fresh-judgment barrier on this exact
    // basename; the readiness terminal result deliberately shares it.
    readinessResult: resolve(liveDir, "qualification-result.json"),
    callLedger: resolve(liveDir, "call-ledger.json"),
    campaignReportJson: resolve(experimentDir, "readiness-campaign-report.json"),
    campaignReportDocsJson: resolve(reportDir, "PILOT_ROLE_READINESS_LIVE_RESULT.json"),
    campaignReportMarkdown: resolve(reportDir, "PILOT_ROLE_READINESS_LIVE_RESULT.md"),
    roleFreeze: resolve(experimentDir, "pilot-role-freeze.json"),
    roleFreezeDocsJson: resolve(reportDir, "PILOT_ROLE_FREEZE_V1.json"),
    roleFreezeMarkdown: resolve(reportDir, "PILOT_ROLE_FREEZE_V1.md"),
  };
}

type ReadinessAvailabilityProvenanceLedgerV1 = {
  schema: typeof PILOT_READINESS_AVAILABILITY_PROVENANCE_LEDGER_SCHEMA;
  experimentId: typeof PILOT_ROLE_READINESS_EXPERIMENT_ID;
  candidateAvailabilitySemanticSha256: string;
  observations: Array<ReturnType<typeof candidateAvailabilityProvenanceProjectionV3> & { provenanceSha256: string }>;
  ledgerSha256: string;
};

function retainReadinessAvailabilityProvenance(
  path: string,
  availability: RunPilotRoleReadinessInputV1["candidateAvailability"],
): void {
  const semanticSha256 = candidateAvailabilitySemanticSha256(availability);
  const projection = candidateAvailabilityProvenanceProjectionV3(availability as never);
  const observation = {
    ...projection,
    provenanceSha256: candidateAvailabilityProvenanceSha256(availability as never),
  };
  const retained = existsSync(path)
    ? parseJson<ReadinessAvailabilityProvenanceLedgerV1>(path, "readiness availability provenance ledger")
    : null;
  if (retained !== null) {
    const { ledgerSha256, ...retainedCore } = retained;
    requireCondition(retained.schema === PILOT_READINESS_AVAILABILITY_PROVENANCE_LEDGER_SCHEMA
        && retained.experimentId === PILOT_ROLE_READINESS_EXPERIMENT_ID
        && retained.candidateAvailabilitySemanticSha256 === semanticSha256
        && ledgerSha256 === hashCanonical(retainedCore),
      "readiness availability provenance ledger identity/self hash drift");
  }
  const observations = retained?.observations.some((item) => item.provenanceSha256 === observation.provenanceSha256)
    ? retained.observations
    : [...(retained?.observations ?? []), observation];
  const core = {
    schema: PILOT_READINESS_AVAILABILITY_PROVENANCE_LEDGER_SCHEMA,
    experimentId: PILOT_ROLE_READINESS_EXPERIMENT_ID,
    candidateAvailabilitySemanticSha256: semanticSha256,
    observations,
  };
  atomicJson(path, { ...core, ledgerSha256: hashCanonical(core) });
}

// ── Resume audit (readiness) ─────────────────────────────────────────────────

/** Whole-phase, zero-call resume barrier for the readiness campaign. The
 * retained executor deep-validates each attempt directory on cached reuse;
 * this audit adds the cross-attempt proofs that per-attempt validation cannot
 * see: fatal/replay chronology, exact request-identity rebuild for every
 * ledger row, and schedule membership. It must complete before the runner
 * creates concurrent workers. */
export function auditPilotRoleReadinessResume(args: {
  ledger: LiveCallLedgerV3;
  freeze: PilotRoleReadinessFreezeV1;
  schedule: readonly ReadinessScheduleEntryV1[];
  input: RunPilotRoleReadinessInputV1;
  liveDir: string;
}): void {
  const ledger = args.ledger;
  requireCondition(ledger.experimentId === PILOT_ROLE_READINESS_EXPERIMENT_ID
      && ledger.freezeSha256 === args.freeze.freezeSha256
      && ledger.certificationSha256 === args.freeze.certificationSha256
      && ledger.productionInstrumentSealSha256 === args.freeze.productionInstrumentSealSha256
      && ledger.apiCallsMade === 0,
    "retained readiness call ledger belongs to different inputs");
  requireCondition(ledger.entries.length <= PILOT_READINESS_BUDGET.hardMaximumCalls,
    "retained readiness ledger exceeds the 168-call hard ceiling");
  const baseCalls = new Set(ledger.entries.map((entry) => entry.scheduleId)).size;
  requireCondition(baseCalls <= PILOT_READINESS_BUDGET.baseMaximumCalls,
    "retained readiness ledger exceeds the 84-call base ceiling");
  const fatalViolations = fatalReceiptChronologyViolationsV3(ledger);
  requireCondition(fatalViolations.length === 0,
    `retained readiness ledger opened requests after a campaign-fatal receipt: ${fatalViolations.join(", ")}`);
  const replayViolations = replayReceiptChronologyViolationsV3(ledger);
  requireCondition(replayViolations.length === 0,
    `retained readiness ledger has replay-ordering violations: ${replayViolations.join(", ")}`);

  const byScheduleId = new Map(args.schedule.map((entry) => [entry.scheduleId, entry]));
  const candidates = args.input.plan.candidateOrders;
  for (const row of ledger.entries) {
    const entry = byScheduleId.get(row.scheduleId);
    requireCondition(entry !== undefined, `retained ledger schedule id is outside the frozen schedule: ${row.scheduleId}`);
    const attemptMatch = /^(.*)-a([12])$/.exec(row.attemptId);
    requireCondition(attemptMatch !== null && attemptMatch[1] === row.scheduleId,
      `retained ledger attempt id is malformed: ${row.attemptId}`);
    const attemptNumber = Number(attemptMatch![2]) as 1 | 2;
    const candidate = candidates[entry!.role][entry!.candidateOrdinal];
    const prepared = args.input.preparedCases[entry!.role][entry!.partition][entry!.caseOrdinal];
    const rebuilt = buildPilotReadinessExecutionRequest(
      entry!, prepared, candidate, args.freeze, attemptNumber,
      attemptNumber === 2 ? `${row.scheduleId}-a1` : null,
    );
    requireCondition(rebuilt.requestSha256 === row.requestSha256,
      `retained ledger request identity does not rebuild for ${row.attemptId}`);
  }
  // Exact ledger <-> attempts-directory bijection (the executor deep-validates
  // each directory's seven-file evidence set on cached reuse).
  const attemptsDir = resolve(args.liveDir, "attempts");
  const retainedDirs = existsSync(attemptsDir)
    ? readdirSync(attemptsDir, { withFileTypes: true }).filter((item) => item.isDirectory()).map((item) => item.name).sort()
    : [];
  const ledgerAttemptIds = [...new Set(ledger.entries.map((entry) => entry.attemptId))].sort();
  requireCondition(hashCanonical(retainedDirs) === hashCanonical(ledgerAttemptIds),
    "retained attempts directories do not match the readiness call ledger exactly");
}

// ── Campaign report / role freeze ────────────────────────────────────────────

export type PilotReadinessCampaignReportV1 = {
  schema: typeof PILOT_READINESS_CAMPAIGN_REPORT_SCHEMA;
  experimentId: typeof PILOT_ROLE_READINESS_EXPERIMENT_ID;
  status: "PILOT_ROLE_SET_READY" | "BLOCKED_ROLE_READINESS";
  blockedReason: string | null;
  implementationCiGateSha256: string;
  implementationHeadSha: string;
  planSha256: string;
  freezeSha256: string;
  preflightSha256: string;
  resultSha256: string;
  callLedgerSha256: string;
  roleFreezeSha256: string | null;
  selected: PilotRoleReadinessRunnerResultV1["selected"];
  qualifiers: PilotRoleReadinessRunnerResultV1["qualifiers"];
  callCounts: {
    baseMaximum: number;
    hardMaximum: number;
    canaryCalls: number;
    holdoutCalls: number;
    baseCallsAttempted: number;
    infrastructureReplays: number;
    maxPlanEvents: number;
    totalAttempts: number;
    brokerRequests: number;
    codexExecInvocations: number;
    cachedReceipts: number;
    apiCalls: 0;
  };
  thresholdsWeakened: false;
  holdoutsRelabeled: false;
  unavailableReplaced: false;
  outputInformedResampling: false;
  retriesAdded: false;
  budgetExhausted: boolean;
  externalCapabilities: typeof EXTERNAL_CAPABILITIES;
  completedAt: string;
  reportSha256: string;
};

export type PilotRoleFreezeV1 = {
  schema: typeof PILOT_READINESS_ROLE_FREEZE_SCHEMA;
  experimentId: typeof PILOT_ROLE_READINESS_EXPERIMENT_ID;
  roles: {
    readerPrimary: string;
    readerAudit: string;
    sourcePrimary: string;
    sourceAdjudicator: string;
    quizSemanticAdjudicator: string;
    quizChecker: { deterministic: true; checkerVersion: typeof QUIZ_DETERMINISTIC_CHECKER_VERSION };
  };
  bindings: {
    planSha256: string;
    planBytesSha256: string;
    freezeSha256: string;
    resultSha256: string;
    candidateSealRawSha256: string;
    candidateCertificationRawSha256: string;
    candidateOrdersSha256: string;
    thresholdsSha256: string;
    readerDecisionPolicy: "reader-decision-policy-v3";
    aggregatePolicy: "aggregate-chapter-review-policy-v2";
    routePolicyVersion: string;
    executionRoute: "codex_exec_chatgpt_subscription";
    callLedgerSha256: string;
    callLedgerBytesSha256: string;
  };
  freezeSha256: string;
};

function buildPilotRoleFreeze(args: {
  result: PilotRoleReadinessRunnerResultV1;
  input: RunPilotRoleReadinessInputV1;
  ledger: LiveCallLedgerV3;
  ledgerBytesSha256: string;
}): PilotRoleFreezeV1 {
  const selected = args.result.selected;
  requireCondition(selected.readerPrimary !== null && selected.readerAudit !== null
      && selected.sourcePrimary !== null && selected.sourceAdjudicator !== null
      && selected.quizSemanticAdjudicator !== null,
    "pilot role freeze requires a complete ready role set");
  const core: Omit<PilotRoleFreezeV1, "freezeSha256"> = {
    schema: PILOT_READINESS_ROLE_FREEZE_SCHEMA,
    experimentId: PILOT_ROLE_READINESS_EXPERIMENT_ID,
    roles: {
      readerPrimary: selected.readerPrimary,
      readerAudit: selected.readerAudit,
      sourcePrimary: selected.sourcePrimary,
      sourceAdjudicator: selected.sourceAdjudicator,
      quizSemanticAdjudicator: selected.quizSemanticAdjudicator,
      quizChecker: { deterministic: true, checkerVersion: QUIZ_DETERMINISTIC_CHECKER_VERSION },
    },
    bindings: {
      planSha256: args.input.plan.planSha256,
      planBytesSha256: args.input.planBytesSha256,
      freezeSha256: args.result.freeze.freezeSha256,
      resultSha256: hashCanonical(args.result),
      candidateSealRawSha256: args.input.plan.bindings.candidateSealRawSha256,
      candidateCertificationRawSha256: args.input.plan.bindings.candidateCertificationRawSha256,
      candidateOrdersSha256: args.input.plan.candidateOrdersSha256,
      thresholdsSha256: args.input.plan.thresholdsSha256,
      readerDecisionPolicy: "reader-decision-policy-v3",
      aggregatePolicy: "aggregate-chapter-review-policy-v2",
      routePolicyVersion: ROUTE_POLICY_VERSION,
      executionRoute: "codex_exec_chatgpt_subscription",
      callLedgerSha256: hashCanonical(args.ledger),
      callLedgerBytesSha256: args.ledgerBytesSha256,
    },
  };
  return { ...core, freezeSha256: hashCanonical(core) };
}

export function renderPilotReadinessResultMarkdown(args: {
  result: PilotRoleReadinessRunnerResultV1;
  ledger: LiveCallLedgerV3;
  gate: PilotReadinessCiGateV1;
}): string {
  const statusLines = args.result.profileRoleResults.map((item) =>
    `- ${item.role}: \`${item.profile.profileId}\` -> **${item.status}**${
      item.outcome && item.outcome.failedThresholds.length > 0
        ? ` (${item.outcome.failedThresholds.join(", ")})`
        : ""}`);
  return [
    "# Pilot Role Readiness Live Result",
    "",
    `- Status: **${args.result.terminalState}**`,
    ...(args.result.blockedReason ? [`- Blocked reason: ${args.result.blockedReason}`] : []),
    `- Experiment: \`${args.result.experimentId}\``,
    `- Exact implementation HEAD: \`${args.gate.headSha}\``,
    `- Dedicated V25 workflow: **${args.gate.workflow.conclusion}** (run ${args.gate.workflow.runId})`,
    `- PR: **#${args.gate.pullRequest.number}**, open=${args.gate.pullRequest.state === "OPEN"}, draft=${args.gate.pullRequest.isDraft}, merged=${args.gate.pullRequest.merged}`,
    `- Base calls attempted: **${args.result.baseCallsAttempted}** / ${PILOT_READINESS_BUDGET.baseMaximumCalls}`,
    `- Infrastructure replays: **${args.result.infrastructureReplays}**`,
    `- Max-plan/provider-capacity events: **${args.ledger.maxPlanCapacityEvents}**`,
    `- Total attempts: **${args.result.totalAttempts}** / ${PILOT_READINESS_BUDGET.hardMaximumCalls}`,
    `- ChatGPT-authenticated codex exec invocations: **${args.ledger.codexExecInvocations}**`,
    `- Cached receipts reused: **${args.ledger.cachedReceipts}**`,
    "- API calls: **0**",
    "- Gate weakening: **none**. Thresholds, holdouts, labels, candidate order, stopping, budget, and replay policy remained frozen.",
    "",
    "## Selected pilot roles",
    "",
    `- Reader primary: \`${args.result.selected.readerPrimary ?? "NOT_READY"}\``,
    `- Reader audit: \`${args.result.selected.readerAudit ?? "NOT_READY"}\``,
    `- Source primary: \`${args.result.selected.sourcePrimary ?? "NOT_READY"}\``,
    `- Source adjudicator: \`${args.result.selected.sourceAdjudicator ?? "NOT_READY"}\``,
    `- Quiz semantic adjudicator: \`${args.result.selected.quizSemanticAdjudicator ?? "NOT_READY"}\``,
    `- Deterministic quiz checker: \`${QUIZ_DETERMINISTIC_CHECKER_VERSION}\``,
    "",
    "## Profile-role outcomes",
    "",
    ...statusLines,
    "",
  ].join("\n");
}

// ── Campaign driver ──────────────────────────────────────────────────────────

export type RunPilotRoleReadinessCampaignArgs = {
  executeLive: boolean;
  expectedHeadSha: string;
  workflowRunId: number;
  repositoryRoot: string;
  modelsCachePath: string;
  preflight: {
    authJsonPath?: string;
    codexBinary?: string;
    qualificationCacheDir?: string;
  };
  timeoutMs?: number;
};

export type PilotReadinessCampaignDryResultV1 = {
  code: 2;
  executed: false;
  result: null;
  report: null;
  modelCalls: 0;
  apiCalls: 0;
  message: string;
};

export type PilotReadinessCampaignLiveResultV1 = {
  code: 0 | 1;
  executed: true;
  result: PilotRoleReadinessRunnerResultV1;
  report: PilotReadinessCampaignReportV1;
  roleFreeze: PilotRoleFreezeV1 | null;
  callLedger: LiveCallLedgerV3;
  preflight: LiveQualificationPreflightV3;
  paths: PilotReadinessCampaignPathsV1;
  modelCalls: number;
  apiCalls: 0;
  message: string;
};

export async function runPilotRoleReadinessCampaign(
  args: RunPilotRoleReadinessCampaignArgs,
): Promise<PilotReadinessCampaignDryResultV1 | PilotReadinessCampaignLiveResultV1> {
  // This check must remain the first observable operation.
  if (args.executeLive !== true) {
    return {
      code: 2,
      executed: false,
      result: null,
      report: null,
      modelCalls: 0,
      apiCalls: 0,
      message: "pilot-role-readiness refused: executeLive must be the literal true value",
    };
  }
  const rawArgs = args as unknown as Record<string, unknown>;
  const forbiddenTopLevelSeams = [
    "executor", "evaluateOutput", "clock", "qualifiedAt", "spawn", "preCallVerifier",
    "loadInput", "checkoutIdentity", "implementationCiGate",
  ].filter((key) => Object.hasOwn(rawArgs, key));
  const rawPreflight = (rawArgs.preflight ?? {}) as Record<string, unknown>;
  const forbiddenPreflightSeams = ["env", "verifiedAt", "cliQualifier", "allowSyntheticCliForTests"]
    .filter((key) => Object.hasOwn(rawPreflight, key));
  requireCondition(forbiddenTopLevelSeams.length === 0 && forbiddenPreflightSeams.length === 0,
    `official readiness campaign rejects synthetic/test seams before any query or write: ${[
      ...forbiddenTopLevelSeams,
      ...forbiddenPreflightSeams.map((key) => `preflight.${key}`),
    ].join(", ")}`);
  requireGitSha(args.expectedHeadSha, "caller-supplied implementation HEAD");
  requireCondition(Number.isSafeInteger(args.workflowRunId) && args.workflowRunId > 0,
    "dedicated V25 workflow run ID must be a positive integer");
  const repositoryRoot = resolve(args.repositoryRoot);
  const paths = pilotReadinessCampaignPaths(repositoryRoot);
  const now = (): string => new Date().toISOString();

  // 1. Implementation / CI / PR gate (create-once; verifiedAt is resumed).
  const retainedGate = existsSync(paths.implementationCiGate)
    ? parseJson<PilotReadinessCiGateV1>(paths.implementationCiGate, "readiness implementation CI gate")
    : null;
  if (retainedGate !== null) {
    validatePilotReadinessCiGate({
      gate: retainedGate,
      expectedHeadSha: args.expectedHeadSha,
      checkout: readinessCheckoutIdentity(repositoryRoot),
    });
  }
  const gate = collectPilotReadinessCiGate({
    repositoryRoot,
    expectedHeadSha: args.expectedHeadSha,
    workflowRunId: args.workflowRunId,
    verifiedAt: retainedGate?.verifiedAt ?? now(),
  });

  // 2. Frozen corpus + bind-once launch plan (fails closed on any drift or on
  //    a candidate re-mint after the plan freeze).
  const materialized = materializePilotRoleReadiness({ repositoryRoot });
  requireCondition(materialized.planWritten && materialized.planSha256 !== null,
    "readiness plan is not minted — mint it with pilot-role-readiness --write --mint-plan AFTER the final candidate re-mint");
  const corpus = parseJson<PilotRoleReadinessCorpusV1>(materialized.corpusPath, "readiness corpus");
  const planBytes = readFileSync(materialized.planPath);
  const plan = JSON.parse(planBytes.toString("utf8")) as PilotRoleReadinessPlanV1;

  // 3. Candidate instrument bindings (raw bytes are the bind-once identity).
  const sealBytes = readFileSync(resolve(repositoryRoot, CANDIDATE_INSTRUMENT_SEAL_REL_PATH));
  const certBytes = readFileSync(resolve(repositoryRoot, CANDIDATE_INSTRUMENT_CERT_REL_PATH));
  const productionInstrumentSeal = JSON.parse(sealBytes.toString("utf8")) as ForwardProductionInstrumentSealV1;
  const certification = JSON.parse(certBytes.toString("utf8")) as InstrumentCertificationBindingV3;
  requireCondition(instrumentCertificationBindingSha256(
    (({ certificationSha256: _self, ...rest }) => rest)(certification) as never,
  ) === certification.certificationSha256, "candidate certification self hash drift");

  // 4. Availability discovery from the local Codex models cache.
  const candidateAvailability = stampReadinessCandidateAvailability(discoverCandidateAvailabilityV3({
    policy: IMP24_FROZEN_CANDIDATE_AVAILABILITY_POLICY,
    policyBytesSha256: IMP24_CANDIDATE_AVAILABILITY_POLICY_BYTES_SHA256,
    modelsCachePath: args.modelsCachePath,
    verifiedAt: now(),
  }));

  // 5. Prepared instruments + full model-free plan validation.
  const prepared = preparePilotReadinessCases({ repositoryRoot, corpus });
  const input: RunPilotRoleReadinessInputV1 = {
    experimentId: PILOT_ROLE_READINESS_EXPERIMENT_ID,
    corpus,
    plan,
    planBytesSha256: sha256Hex(planBytes),
    certification,
    certificationRawBytesSha256: sha256Hex(certBytes),
    productionInstrumentSeal,
    productionInstrumentSealRawBytesSha256: sha256Hex(sealBytes),
    candidateAvailability,
    schemaHashes: prepared.schemaHashes,
    promptSourceHashes: prepared.promptSourceHashes,
    preparedCases: prepared.preparedCases,
  };
  const { freeze, schedule } = buildPilotRoleReadinessPlanForExecution(input);

  // 6. Route preflight (ChatGPT-only; 84/168 ceilings; resumed verifiedAt).
  const retainedPreflight = existsSync(paths.preflight)
    ? parseJson<LiveQualificationPreflightV3>(paths.preflight, "readiness live route preflight")
    : null;
  const preflight = await preflightPilotRoleReadinessLive({
    repositoryRoot,
    freeze,
    productionInstrumentSeal,
    candidateAvailability,
    verifiedAt: retainedPreflight?.verifiedAt ?? now(),
    ...args.preflight,
  });

  // 7. Every immutable authorizer is on disk before the first possible call.
  mkdirSync(paths.liveDir, { recursive: true });
  persistExactJson(paths.implementationCiGate, gate, "readiness implementation CI gate");
  if (existsSync(paths.candidateAvailability)) {
    const retained = parseJson<RunPilotRoleReadinessInputV1["candidateAvailability"]>(
      paths.candidateAvailability, "readiness candidate availability");
    requireCondition(candidateAvailabilitySemanticSha256(retained)
        === candidateAvailabilitySemanticSha256(candidateAvailability),
      "candidate availability semantics changed on resume before live execution");
  } else {
    atomicJson(paths.candidateAvailability, candidateAvailability);
  }
  persistExactJson(paths.candidateAvailabilitySemantic,
    candidateAvailabilitySemanticProjectionV3(candidateAvailability),
    "readiness candidate availability semantic projection");
  retainReadinessAvailabilityProvenance(paths.candidateAvailabilityProvenance, candidateAvailability);
  if (existsSync(paths.preflight)) {
    const retained = parseJson<LiveQualificationPreflightV3>(paths.preflight, "readiness live route preflight");
    const stable = (value: LiveQualificationPreflightV3): unknown => {
      const {
        preflightSha256: _self,
        verifiedAt: _verifiedAt,
        candidateAvailabilitySourceBytesSha256: _sourceBytes,
        candidateAvailabilityProvenanceSha256: _provenance,
        cliVersion: _cliVersion,
        ...projection
      } = value;
      return projection;
    };
    requireCondition(hashCanonical(stable(retained)) === hashCanonical(stable(preflight)),
      "readiness live route preflight changed beyond permitted availability/CLI provenance");
  }
  atomicJson(paths.preflight, preflight);
  persistExactJson(paths.readinessFreeze, freeze, "readiness freeze");

  // 8. Retained crash-safe executor under the readiness identity.
  const live = createLiveQualificationExecutorV3({
    phaseDir: paths.liveDir,
    executionId: PILOT_ROLE_READINESS_EXPERIMENT_ID,
    freezeSha256: freeze.freezeSha256,
    certificationSha256: freeze.certificationSha256,
    productionInstrumentSealSha256: freeze.productionInstrumentSealSha256,
    repositoryRoot,
    productionInstrumentSeal,
    authJsonPath: args.preflight.authJsonPath,
    ...(args.timeoutMs ? { timeoutMs: args.timeoutMs } : {}),
  });
  auditPilotRoleReadinessResume({
    ledger: live.ledger,
    freeze,
    schedule,
    input,
    liveDir: paths.liveDir,
  });
  live.markTerminalResultBound();

  // 9. Execute the frozen plan.
  const evaluateOutput = createPilotRoleReadinessEvaluator(corpus);
  const result = await runPilotRoleReadiness(input, {
    executor: live.executor,
    evaluateOutput,
    retainAttemptEvaluation: live.retainAttemptEvaluation,
  });

  // 10. Terminal persistence (create-once exact resume) + report.
  atomicJson(paths.callLedger, live.ledger);
  persistExactJson(paths.readinessResult, result, "readiness terminal result");
  const ledgerBytesSha256 = sha256Hex(readFileSync(paths.callLedger));
  const roleFreeze = result.terminalState === "PILOT_ROLE_SET_READY"
    ? buildPilotRoleFreeze({ result, input, ledger: live.ledger, ledgerBytesSha256 })
    : null;
  if (roleFreeze) {
    persistExactJson(paths.roleFreeze, roleFreeze, "pilot role freeze");
    persistExactJson(paths.roleFreezeDocsJson, roleFreeze, "pilot role freeze report JSON");
  } else {
    requireCondition(!existsSync(paths.roleFreeze) && !existsSync(paths.roleFreezeDocsJson),
      "a retained pilot role freeze exists although the readiness role set is not ready");
  }

  const baseAttempts = result.attempts.filter((attempt) => attempt.request.attemptNumber === 1);
  const retainedReport = existsSync(paths.campaignReportJson)
    ? parseJson<PilotReadinessCampaignReportV1>(paths.campaignReportJson, "readiness campaign report")
    : null;
  const reportCore: Omit<PilotReadinessCampaignReportV1, "reportSha256"> = {
    schema: PILOT_READINESS_CAMPAIGN_REPORT_SCHEMA,
    experimentId: PILOT_ROLE_READINESS_EXPERIMENT_ID,
    status: result.terminalState,
    blockedReason: result.blockedReason,
    implementationCiGateSha256: gate.gateSha256,
    implementationHeadSha: gate.headSha,
    planSha256: plan.planSha256,
    freezeSha256: freeze.freezeSha256,
    preflightSha256: preflight.preflightSha256,
    resultSha256: hashCanonical(result),
    callLedgerSha256: hashCanonical(live.ledger),
    roleFreezeSha256: roleFreeze?.freezeSha256 ?? null,
    selected: result.selected,
    qualifiers: result.qualifiers,
    callCounts: {
      baseMaximum: PILOT_READINESS_BUDGET.baseMaximumCalls,
      hardMaximum: PILOT_READINESS_BUDGET.hardMaximumCalls,
      canaryCalls: baseAttempts.filter((attempt) => attempt.request.partition === "canary").length,
      holdoutCalls: baseAttempts.filter((attempt) => attempt.request.partition === "holdout").length,
      baseCallsAttempted: result.baseCallsAttempted,
      infrastructureReplays: result.infrastructureReplays,
      maxPlanEvents: live.ledger.maxPlanCapacityEvents,
      totalAttempts: result.totalAttempts,
      brokerRequests: live.ledger.brokerRequests,
      codexExecInvocations: live.ledger.codexExecInvocations,
      cachedReceipts: live.ledger.cachedReceipts,
      apiCalls: 0,
    },
    thresholdsWeakened: false,
    holdoutsRelabeled: false,
    unavailableReplaced: false,
    outputInformedResampling: false,
    retriesAdded: false,
    budgetExhausted: result.budgetExhausted,
    externalCapabilities: EXTERNAL_CAPABILITIES,
    completedAt: retainedReport?.completedAt ?? now(),
  };
  const report: PilotReadinessCampaignReportV1 = { ...reportCore, reportSha256: hashCanonical(reportCore) };
  atomicJson(paths.campaignReportJson, report);
  atomicJson(paths.campaignReportDocsJson, report);
  writeFileAtomic(paths.campaignReportMarkdown, renderPilotReadinessResultMarkdown({ result, ledger: live.ledger, gate }));
  if (roleFreeze) {
    writeFileAtomic(paths.roleFreezeMarkdown, [
      "# Pilot Role Freeze V1",
      "",
      "- Status: **FROZEN**",
      `- Freeze SHA-256: \`${roleFreeze.freezeSha256}\``,
      `- Readiness result SHA-256: \`${roleFreeze.bindings.resultSha256}\``,
      `- Reader primary: \`${roleFreeze.roles.readerPrimary}\` · audit: \`${roleFreeze.roles.readerAudit}\``,
      `- Source primary: \`${roleFreeze.roles.sourcePrimary}\` · adjudicator: \`${roleFreeze.roles.sourceAdjudicator}\``,
      `- Quiz semantic adjudicator: \`${roleFreeze.roles.quizSemanticAdjudicator}\``,
      `- Deterministic quiz checker: \`${roleFreeze.roles.quizChecker.checkerVersion}\``,
      "- Gate weakening: **none**.",
      "",
    ].join("\n"));
  }

  return {
    code: result.terminalState === "PILOT_ROLE_SET_READY" ? 0 : 1,
    executed: true,
    result,
    report,
    roleFreeze,
    callLedger: live.ledger,
    preflight,
    paths,
    modelCalls: live.ledger.codexExecInvocations,
    apiCalls: 0,
    message: result.terminalState === "PILOT_ROLE_SET_READY"
      ? "pilot role readiness completed and the exact pilot role set was frozen"
      : `pilot role readiness completed BLOCKED: ${result.blockedReason ?? "unknown"}`,
  };
}
