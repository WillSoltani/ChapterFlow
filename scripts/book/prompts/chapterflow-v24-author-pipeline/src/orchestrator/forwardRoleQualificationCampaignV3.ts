/**
 * Retained IMP-24 V3 live role-qualification campaign.
 *
 * This is the high-level boundary that may authorize reviewer model calls. It
 * derives an exact implementation/CI/PR gate from the current checkout and
 * live GitHub CLI evidence, prepares the
 * certified inline instrument, re-runs the ChatGPT route preflight, persists
 * the frozen plan before execution, and delegates every attempt to the
 * crash-safe live executor. It has no publish, promotion, deployment, upload,
 * merge, force-push, API-provider, SDK, or HTTP capability.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { canonicalJson, hashCanonical, sha256Hex } from "../contracts/contractUtil.js";
import { writeFileAtomic } from "../lib/atomicWrite.js";
import {
  IMP24_BASE_MAXIMUM_CALLS,
  IMP24_HARD_MAXIMUM_CALLS,
  buildRoleQualificationPlanV3,
  runRoleQualificationV3,
  type RoleQualificationRunnerResultV3,
} from "../bakeoff/migration/roleQualificationRunnerV3.js";
import { IMP24_ROLE_QUALIFICATION_ID } from "../bakeoff/migration/imp24Corpus.js";
import { IMP24_CERTIFICATION_ARTIFACT_PATHS } from "../bakeoff/migration/imp24InstrumentCertification.js";
import { IMP24B_PRE_LIVE_ARTIFACT_PATHS } from "../bakeoff/migration/imp24PreLiveFreeze.js";
import {
  createLiveQualificationExecutorV3,
  prepareLiveRoleQualificationV3,
  preflightLiveRoleQualificationV3,
  type LiveCallLedgerV3,
  type LiveQualificationPreflightV3,
  type UnpreparedLiveRoleQualificationInputV3,
} from "./forwardRoleQualificationLiveV3.js";
import {
  buildForwardRoleAssignmentFreezeV3,
  type ForwardRoleAssignmentFreezeV3,
  type ForwardV3RouteBinding,
} from "./forwardRoleAssignmentFreezeV3.js";
import { IMP24_FORWARD_PRODUCTION_INSTRUMENT_SEAL_ARTIFACT_REL_PATH } from "./forwardProductionInstrumentSeal.js";

export const IMP24_IMPLEMENTATION_CI_GATE_SCHEMA = "imp24-implementation-ci-gate-v2" as const;
export const IMP24_ROLE_QUALIFICATION_CAMPAIGN_REPORT_SCHEMA = "imp24-role-qualification-campaign-report-v1" as const;
export const IMP24_REQUIRED_BRANCH = "feat/v25-pipeline-live" as const;
export const IMP24_REQUIRED_WORKFLOW_NAME = "ChapterFlow V25 Pipeline" as const;
export const IMP24_REQUIRED_WORKFLOW_FILE = ".github/workflows/chapterflow-v25-pipeline.yml" as const;
export const IMP24_REQUIRED_WORKFLOW_JOB = "V25 Pipeline Typecheck, Contracts, and Tests" as const;
export const IMP24_REQUIRED_DRAFT_PR = 401 as const;

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

export type Imp24ImplementationCiGateV1 = {
  schema: typeof IMP24_IMPLEMENTATION_CI_GATE_SCHEMA;
  branch: typeof IMP24_REQUIRED_BRANCH;
  headSha: string;
  workflow: {
    name: typeof IMP24_REQUIRED_WORKFLOW_NAME;
    file: typeof IMP24_REQUIRED_WORKFLOW_FILE;
    job: typeof IMP24_REQUIRED_WORKFLOW_JOB;
    runId: number;
    headSha: string;
    conclusion: "PASS";
  };
  pullRequest: {
    number: typeof IMP24_REQUIRED_DRAFT_PR;
    state: "OPEN";
    isDraft: true;
    merged: false;
    mergedAt: null;
    mergeCommitSha: null;
    headBranch: typeof IMP24_REQUIRED_BRANCH;
    headSha: string;
  };
  trustedEvidence: {
    method: "git-and-gh-cli-live-query-v1";
    checkoutSha256: string;
    workflowRunSha256: string;
    pullRequestSha256: string;
  };
  verifiedAt: string;
  modelCalls: 0;
  apiCalls: 0;
  gateSha256: string;
};

export type Imp24TrustedWorkflowRunEvidenceV1 = {
  databaseId: number;
  workflowName: string;
  headBranch: string;
  headSha: string;
  status: string;
  conclusion: string;
  jobs: Array<{ name: string; status: string; conclusion: string }>;
};

export type Imp24TrustedPullRequestEvidenceV1 = {
  number: number;
  state: string;
  isDraft: boolean;
  mergedAt: string | null;
  mergeCommit: { oid?: string } | null;
  headRefName: string;
  headRefOid: string;
};

export type Imp24CheckoutIdentityV1 = {
  branch: string;
  headSha: string;
  implementationClean: boolean;
};

export type Imp24QualificationCampaignPathsV1 = {
  experimentDir: string;
  liveDir: string;
  implementationCiGate: string;
  candidateAvailability: string;
  preflight: string;
  qualificationFreeze: string;
  qualificationResult: string;
  roleRegistry: string;
  callLedger: string;
  qualificationReportJson: string;
  qualificationReportDocsJson: string;
  roleAssignmentFreeze: string;
  roleAssignmentFreezeDocsJson: string;
  qualificationReportMarkdown: string;
  roleAssignmentFreezeMarkdown: string;
};

export type Imp24RoleQualificationCampaignReportV1 = {
  schema: typeof IMP24_ROLE_QUALIFICATION_CAMPAIGN_REPORT_SCHEMA;
  experimentId: typeof IMP24_ROLE_QUALIFICATION_ID;
  status: "ROLE_SET_READY" | "ROLE_SET_NOT_READY";
  implementationCiGateSha256: string;
  implementationHeadSha: string;
  candidateAvailabilitySha256: string;
  preflightSha256: string;
  qualificationFreezeSha256: string;
  qualificationResultSha256: string;
  roleRegistrySha256: string;
  roleAssignmentFreezeSha256: string | null;
  selected: RoleQualificationRunnerResultV3["selected"];
  profileStatusCounts: Record<string, number>;
  callCounts: {
    baseMaximum: typeof IMP24_BASE_MAXIMUM_CALLS;
    hardMaximum: typeof IMP24_HARD_MAXIMUM_CALLS;
    baseCallsAttempted: number;
    infrastructureReplays: number;
    totalAttempts: number;
    brokerRequests: number;
    codexExecInvocations: number;
    cachedReceipts: number;
    apiCalls: 0;
  };
  thresholdsWeakened: false;
  holdoutsRelabeled: false;
  unavailableReplaced: false;
  retriesAdded: false;
  externalCapabilities: typeof EXTERNAL_CAPABILITIES;
  completedAt: string;
  artifactBytesSha256: Record<string, string>;
  reportSha256: string;
};

export type RunImp24RoleQualificationCampaignV3Args = {
  executeLive: boolean;
  expectedHeadSha: string;
  workflowRunId: number;
  repositoryRoot: string;
  experimentDir: string;
  input: UnpreparedLiveRoleQualificationInputV3;
  preflight: {
    authJsonPath?: string;
    codexBinary?: string;
    qualificationCacheDir?: string;
  };
  timeoutMs?: number;
};

export type Imp24RoleQualificationCampaignDryResultV1 = {
  code: 2;
  executed: false;
  result: null;
  report: null;
  roleAssignmentFreeze: null;
  modelCalls: 0;
  apiCalls: 0;
  message: string;
};

export type Imp24RoleQualificationCampaignLiveResultV1 = {
  code: 0;
  executed: true;
  result: RoleQualificationRunnerResultV3;
  report: Imp24RoleQualificationCampaignReportV1;
  roleAssignmentFreeze: Readonly<ForwardRoleAssignmentFreezeV3> | null;
  callLedger: LiveCallLedgerV3;
  preflight: LiveQualificationPreflightV3;
  paths: Imp24QualificationCampaignPathsV1;
  modelCalls: number;
  apiCalls: 0;
  message: string;
};

export class ForwardRoleQualificationCampaignV3Error extends Error {
  readonly classification = "policy_preflight_failure" as const;

  constructor(message: string) {
    super(message);
    this.name = "ForwardRoleQualificationCampaignV3Error";
  }
}

function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new ForwardRoleQualificationCampaignV3Error(message);
}

function requireGitSha(value: unknown, label: string): asserts value is string {
  requireCondition(typeof value === "string" && GIT_SHA.test(value), `${label} must be an exact lowercase 40-character git SHA`);
}

function requireSha(value: unknown, label: string): asserts value is string {
  requireCondition(typeof value === "string" && SHA256.test(value), `${label} must be a lowercase sha256`);
}

export function imp24ImplementationCiGateSha256(
  value: Omit<Imp24ImplementationCiGateV1, "gateSha256">,
): string {
  return hashCanonical(value);
}

function gitOrGhJson<T>(repositoryRoot: string, binary: "gh", args: string[], label: string): T {
  try {
    const raw = execFileSync(binary, args, {
      cwd: resolve(repositoryRoot),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 4 * 1024 * 1024,
    });
    return JSON.parse(raw) as T;
  } catch (error) {
    throw new ForwardRoleQualificationCampaignV3Error(
      `trusted ${label} query failed before any model call: ${(error as Error).message}`,
    );
  }
}

function implementationPaths(): string[] {
  const pipeline = "scripts/book/prompts/chapterflow-v24-author-pipeline";
  return [
    `${pipeline}/src`,
    `${pipeline}/config`,
    `${pipeline}/tests`,
    `${pipeline}/package.json`,
    `${pipeline}/package-lock.json`,
    IMP24_CERTIFICATION_ARTIFACT_PATHS.corpusBundle,
    IMP24_CERTIFICATION_ARTIFACT_PATHS.certificationBinding,
    IMP24_CERTIFICATION_ARTIFACT_PATHS.legacyClosure,
    IMP24_CERTIFICATION_ARTIFACT_PATHS.productionQualificationParity,
    IMP24_CERTIFICATION_ARTIFACT_PATHS.thresholds,
    IMP24_CERTIFICATION_ARTIFACT_PATHS.reportJson,
    IMP24_CERTIFICATION_ARTIFACT_PATHS.reportMarkdown,
    ...Object.values(IMP24B_PRE_LIVE_ARTIFACT_PATHS),
    "docs/v25/reports/IMP-24B_WORKTREE_LEDGER.json",
    "docs/v25/reports/IMP-24B_WORKTREE_LEDGER.md",
    "docs/v25/reports/IMP-24_PROTOCOL_DECISION.md",
    IMP24_FORWARD_PRODUCTION_INSTRUMENT_SEAL_ARTIFACT_REL_PATH,
    `${pipeline}/state/migration-experiments/contracts/schemas/reader-experience-model-output-v2.schema.json`,
    `${pipeline}/state/migration-experiments/contracts/schemas/source-integrity-model-output-v2.schema.json`,
    `${pipeline}/state/migration-experiments/contracts/schemas/quiz-integrity-model-output-v2.schema.json`,
    ".agents/skills/chapterflow-book-evaluator/references",
    IMP24_REQUIRED_WORKFLOW_FILE,
  ];
}

function defaultCheckoutIdentity(repositoryRoot: string): Imp24CheckoutIdentityV1 {
  const run = (args: string[]): string => execFileSync("git", args, {
    cwd: resolve(repositoryRoot),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
  return {
    branch: run(["branch", "--show-current"]),
    headSha: run(["rev-parse", "HEAD"]),
    implementationClean: run(["status", "--porcelain=v1", "--untracked-files=all", "--", ...implementationPaths()]).length === 0,
  };
}

export function validateImp24ImplementationCiGate(args: {
  gate: Imp24ImplementationCiGateV1;
  expectedHeadSha: string;
  checkout: Imp24CheckoutIdentityV1;
}): void {
  const gate = args.gate;
  requireGitSha(args.expectedHeadSha, "caller-supplied implementation HEAD");
  requireCondition(gate.schema === IMP24_IMPLEMENTATION_CI_GATE_SCHEMA, "implementation CI gate schema mismatch");
  const { gateSha256, ...core } = gate;
  requireSha(gateSha256, "implementation CI gate self hash");
  requireCondition(imp24ImplementationCiGateSha256(core) === gateSha256, "implementation CI gate self hash drift");
  requireCondition(gate.branch === IMP24_REQUIRED_BRANCH, `implementation CI gate branch must be ${IMP24_REQUIRED_BRANCH}`);
  requireGitSha(gate.headSha, "implementation CI gate HEAD");
  requireCondition(gate.headSha === args.expectedHeadSha, "implementation CI gate HEAD differs from the exact caller-supplied HEAD");
  requireCondition(gate.workflow.name === IMP24_REQUIRED_WORKFLOW_NAME
    && gate.workflow.file === IMP24_REQUIRED_WORKFLOW_FILE
    && gate.workflow.job === IMP24_REQUIRED_WORKFLOW_JOB
    && Number.isSafeInteger(gate.workflow.runId) && gate.workflow.runId > 0
    && gate.workflow.conclusion === "PASS"
    && gate.workflow.headSha === gate.headSha,
  "dedicated V25 implementation workflow did not PASS for the exact gated HEAD");
  requireCondition(gate.pullRequest.number === IMP24_REQUIRED_DRAFT_PR
    && gate.pullRequest.state === "OPEN"
    && gate.pullRequest.isDraft === true
    && gate.pullRequest.merged === false
    && gate.pullRequest.mergedAt === null
    && gate.pullRequest.mergeCommitSha === null
    && gate.pullRequest.headBranch === IMP24_REQUIRED_BRANCH
    && gate.pullRequest.headSha === gate.headSha,
  "implementation gate is not the unmerged draft PR #401 at the exact gated HEAD");
  requireCondition(gate.trustedEvidence.method === "git-and-gh-cli-live-query-v1",
    "implementation gate does not use the required live git/GitHub evidence method");
  requireSha(gate.trustedEvidence.checkoutSha256, "trusted checkout evidence hash");
  requireSha(gate.trustedEvidence.workflowRunSha256, "trusted workflow-run evidence hash");
  requireSha(gate.trustedEvidence.pullRequestSha256, "trusted pull-request evidence hash");
  requireCondition(Number.isFinite(Date.parse(gate.verifiedAt)), "implementation CI gate verifiedAt is invalid");
  requireCondition(gate.modelCalls === 0 && gate.apiCalls === 0, "implementation CI verification must be model/API free");
  requireCondition(args.checkout.branch === IMP24_REQUIRED_BRANCH, "current checkout is not on feat/v25-pipeline-live");
  requireGitSha(args.checkout.headSha, "current checkout HEAD");
  requireCondition(args.checkout.headSha === args.expectedHeadSha, "current checkout HEAD differs from the exact CI-gated HEAD");
  requireCondition(args.checkout.implementationClean === true,
    "current checkout has implementation/workflow/contract drift outside the exact CI-gated HEAD");
}

/** Pure validator/builder used by the production collector and model-free
 * tests. Supplying values here cannot run a campaign or write an official
 * artifact; only the production boundary below performs live queries. */
export function buildImp24ImplementationCiGateFromEvidence(args: {
  expectedHeadSha: string;
  workflowRunId: number;
  checkout: Imp24CheckoutIdentityV1;
  workflowRun: Imp24TrustedWorkflowRunEvidenceV1;
  pullRequest: Imp24TrustedPullRequestEvidenceV1;
  verifiedAt: string;
}): Imp24ImplementationCiGateV1 {
  requireGitSha(args.expectedHeadSha, "expected implementation HEAD");
  requireCondition(Number.isSafeInteger(args.workflowRunId) && args.workflowRunId > 0,
    "dedicated V25 workflow run ID must be a positive integer");
  requireCondition(args.checkout.branch === IMP24_REQUIRED_BRANCH,
    `current checkout is not on ${IMP24_REQUIRED_BRANCH}`);
  requireGitSha(args.checkout.headSha, "current checkout HEAD");
  requireCondition(args.checkout.headSha === args.expectedHeadSha,
    "current checkout HEAD differs from the exact requested implementation HEAD");
  requireCondition(args.checkout.implementationClean === true,
    "current checkout has implementation/workflow/contract drift outside the exact requested HEAD");

  const run = args.workflowRun;
  requireCondition(run.databaseId === args.workflowRunId
    && run.workflowName === IMP24_REQUIRED_WORKFLOW_NAME
    && run.headBranch === IMP24_REQUIRED_BRANCH
    && run.headSha === args.expectedHeadSha
    && run.status === "completed"
    && run.conclusion === "success",
  "live GitHub evidence does not show the dedicated V25 workflow PASS on the exact implementation HEAD");
  const exactJobs = run.jobs.filter((job) => job.name === IMP24_REQUIRED_WORKFLOW_JOB);
  requireCondition(exactJobs.length === 1
    && exactJobs[0].status === "completed"
    && exactJobs[0].conclusion === "success",
  `live GitHub evidence does not show exactly one successful ${IMP24_REQUIRED_WORKFLOW_JOB} job`);

  const pr = args.pullRequest;
  requireCondition(pr.number === IMP24_REQUIRED_DRAFT_PR
    && pr.state === "OPEN"
    && pr.isDraft === true
    && pr.mergedAt === null
    && pr.mergeCommit === null
    && pr.headRefName === IMP24_REQUIRED_BRANCH
    && pr.headRefOid === args.expectedHeadSha,
  "live GitHub evidence is not the open, unmerged draft PR #401 at the exact implementation HEAD");
  requireCondition(Number.isFinite(Date.parse(args.verifiedAt)), "trusted implementation verification time is invalid");

  const core: Omit<Imp24ImplementationCiGateV1, "gateSha256"> = {
    schema: IMP24_IMPLEMENTATION_CI_GATE_SCHEMA,
    branch: IMP24_REQUIRED_BRANCH,
    headSha: args.expectedHeadSha,
    workflow: {
      name: IMP24_REQUIRED_WORKFLOW_NAME,
      file: IMP24_REQUIRED_WORKFLOW_FILE,
      job: IMP24_REQUIRED_WORKFLOW_JOB,
      runId: args.workflowRunId,
      headSha: args.expectedHeadSha,
      conclusion: "PASS",
    },
    pullRequest: {
      number: IMP24_REQUIRED_DRAFT_PR,
      state: "OPEN",
      isDraft: true,
      merged: false,
      mergedAt: null,
      mergeCommitSha: null,
      headBranch: IMP24_REQUIRED_BRANCH,
      headSha: args.expectedHeadSha,
    },
    trustedEvidence: {
      method: "git-and-gh-cli-live-query-v1",
      checkoutSha256: hashCanonical(args.checkout),
      workflowRunSha256: hashCanonical(run),
      pullRequestSha256: hashCanonical(pr),
    },
    verifiedAt: new Date(args.verifiedAt).toISOString(),
    modelCalls: 0,
    apiCalls: 0,
  };
  const gate = { ...core, gateSha256: imp24ImplementationCiGateSha256(core) };
  validateImp24ImplementationCiGate({ gate, expectedHeadSha: args.expectedHeadSha, checkout: args.checkout });
  return gate;
}

function collectImp24ImplementationCiGate(args: {
  repositoryRoot: string;
  expectedHeadSha: string;
  workflowRunId: number;
  verifiedAt: string;
}): Imp24ImplementationCiGateV1 {
  const checkout = defaultCheckoutIdentity(args.repositoryRoot);
  const workflowRun = gitOrGhJson<Imp24TrustedWorkflowRunEvidenceV1>(args.repositoryRoot, "gh", [
    "run", "view", String(args.workflowRunId),
    "--json", "databaseId,workflowName,headBranch,headSha,status,conclusion,jobs",
  ], "dedicated V25 workflow");
  const pullRequest = gitOrGhJson<Imp24TrustedPullRequestEvidenceV1>(args.repositoryRoot, "gh", [
    "pr", "view", String(IMP24_REQUIRED_DRAFT_PR),
    "--json", "number,state,isDraft,mergedAt,mergeCommit,headRefName,headRefOid",
  ], "draft PR #401");
  return buildImp24ImplementationCiGateFromEvidence({
    expectedHeadSha: args.expectedHeadSha,
    workflowRunId: args.workflowRunId,
    checkout,
    workflowRun,
    pullRequest,
    verifiedAt: args.verifiedAt,
  });
}

function pathsFor(args: RunImp24RoleQualificationCampaignV3Args): Imp24QualificationCampaignPathsV1 {
  const experimentDir = resolve(args.experimentDir);
  const liveDir = resolve(experimentDir, "live");
  const reportDir = resolve(args.repositoryRoot, "docs", "v25", "reports");
  return {
    experimentDir,
    liveDir,
    implementationCiGate: resolve(experimentDir, "implementation-ci-gate.json"),
    candidateAvailability: resolve(experimentDir, "candidate-availability.json"),
    preflight: resolve(liveDir, "preflight.json"),
    qualificationFreeze: resolve(liveDir, "qualification-freeze.json"),
    qualificationResult: resolve(liveDir, "qualification-result.json"),
    roleRegistry: resolve(liveDir, "role-registry.json"),
    callLedger: resolve(liveDir, "call-ledger.json"),
    qualificationReportJson: resolve(experimentDir, "qualification-report.json"),
    qualificationReportDocsJson: resolve(reportDir, "ROLE_QUALIFICATION_V3_LIVE_RESULT.json"),
    roleAssignmentFreeze: resolve(experimentDir, "role-assignment-freeze.json"),
    roleAssignmentFreezeDocsJson: resolve(reportDir, "ROLE_ASSIGNMENT_FREEZE_V3.json"),
    qualificationReportMarkdown: resolve(reportDir, "ROLE_QUALIFICATION_V3_LIVE_RESULT.md"),
    roleAssignmentFreezeMarkdown: resolve(reportDir, "ROLE_ASSIGNMENT_FREEZE_V3.md"),
  };
}

function parseJson<T>(path: string, label: string): T {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch (error) {
    throw new ForwardRoleQualificationCampaignV3Error(`${label} is not valid retained JSON: ${(error as Error).message}`);
  }
}

function atomicJson(path: string, value: unknown): void {
  writeFileAtomic(path, `${canonicalJson(value)}\n`);
}

function persistExactJson(path: string, value: unknown, label: string): void {
  if (existsSync(path)) {
    const retained = parseJson<unknown>(path, label);
    requireCondition(hashCanonical(retained) === hashCanonical(value), `${label} differs from the exact retained artifact on resume`);
    return;
  }
  atomicJson(path, value);
  const retained = parseJson<unknown>(path, label);
  requireCondition(hashCanonical(retained) === hashCanonical(value), `${label} atomic read-back hash mismatch`);
}

function artifactBytesSha256(path: string, label: string): string {
  requireCondition(existsSync(path), `${label} was not retained`);
  return sha256Hex(readFileSync(path));
}

function retainedVerifiedAt(path: string, requested: string | undefined, now: () => Date): string {
  if (existsSync(path)) {
    const retained = parseJson<LiveQualificationPreflightV3>(path, "live route preflight");
    if (requested !== undefined) {
      requireCondition(new Date(requested).toISOString() === retained.verifiedAt,
        "resume verifiedAt differs from the retained live route preflight");
    }
    return retained.verifiedAt;
  }
  const value = requested ?? now().toISOString();
  requireCondition(Number.isFinite(Date.parse(value)), "live route preflight verifiedAt is invalid");
  return new Date(value).toISOString();
}

function retainedQualifiedAt(path: string, requested: string | undefined, now: () => Date): string {
  if (existsSync(path)) {
    const retained = parseJson<RoleQualificationRunnerResultV3>(path, "V3 qualification result");
    const values = new Set(retained.registry.profiles.map((profile) => profile.qualifiedAt));
    requireCondition(values.size === 1, "retained V3 qualification result has inconsistent qualifiedAt values");
    const value = [...values][0];
    requireCondition(Number.isFinite(Date.parse(value)), "retained V3 qualification result has invalid qualifiedAt");
    if (requested !== undefined) {
      requireCondition(new Date(requested).toISOString() === new Date(value).toISOString(),
        "resume qualifiedAt differs from the retained V3 qualification result");
    }
    return new Date(value).toISOString();
  }
  const value = requested ?? now().toISOString();
  requireCondition(Number.isFinite(Date.parse(value)), "V3 qualification qualifiedAt is invalid");
  return new Date(value).toISOString();
}

function retainedCampaignReport(path: string): Imp24RoleQualificationCampaignReportV1 | null {
  if (!existsSync(path)) return null;
  const retained = parseJson<Imp24RoleQualificationCampaignReportV1>(path, "V3 qualification campaign report");
  requireCondition(retained.schema === IMP24_ROLE_QUALIFICATION_CAMPAIGN_REPORT_SCHEMA
    && retained.experimentId === IMP24_ROLE_QUALIFICATION_ID,
  "retained V3 qualification campaign report identity mismatch");
  const { reportSha256, ...core } = retained;
  requireSha(reportSha256, "retained V3 qualification campaign report self hash");
  requireCondition(hashCanonical(core) === reportSha256,
    "retained V3 qualification campaign report self hash drift");
  requireCondition(Number.isFinite(Date.parse(retained.completedAt)),
    "retained V3 qualification campaign report completedAt is invalid");
  return retained;
}

function stableReportProjection(report: Imp24RoleQualificationCampaignReportV1): unknown {
  const { reportSha256: _reportSha256, artifactBytesSha256, callCounts, ...identity } = report;
  const { callLedger: _callLedger, ...stableArtifactBytesSha256 } = artifactBytesSha256;
  return {
    ...identity,
    callCounts: { ...callCounts, cachedReceipts: 0 },
    artifactBytesSha256: stableArtifactBytesSha256,
  };
}

function persistCampaignReport(
  path: string,
  report: Imp24RoleQualificationCampaignReportV1,
  retained: Imp24RoleQualificationCampaignReportV1 | null,
): void {
  if (retained) {
    requireCondition(hashCanonical(stableReportProjection(retained)) === hashCanonical(stableReportProjection(report)),
      "recomposed V3 qualification campaign report changed outside retained cache-accounting fields");
    requireCondition(report.callCounts.cachedReceipts >= retained.callCounts.cachedReceipts,
      "recomposed V3 qualification campaign report reduced retained cache accounting");
  }
  atomicJson(path, report);
  const readBack = retainedCampaignReport(path);
  requireCondition(readBack !== null && hashCanonical(readBack) === hashCanonical(report),
    "V3 qualification campaign report atomic read-back hash mismatch");
}

function statusCounts(result: RoleQualificationRunnerResultV3): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of result.profileRoleResults) counts[item.status] = (counts[item.status] ?? 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
}

function selectedLines(result: RoleQualificationRunnerResultV3): string[] {
  return [
    `- Reader primary: \`${result.selected.readerPrimary ?? "NOT_QUALIFIED"}\``,
    `- Reader audit: \`${result.selected.readerAudit ?? "NOT_QUALIFIED"}\``,
    `- Source primary: \`${result.selected.sourcePrimary ?? "NOT_QUALIFIED"}\``,
    `- Source adjudicator: \`${result.selected.sourceAdjudicator ?? "NOT_QUALIFIED"}\``,
    `- Quiz semantic adjudicator: \`${result.selected.quizSemanticAdjudicator ?? "NOT_QUALIFIED"}\``,
  ];
}

export function renderRoleQualificationV3LiveResultMarkdown(args: {
  result: RoleQualificationRunnerResultV3;
  ledger: LiveCallLedgerV3;
  gate: Imp24ImplementationCiGateV1;
}): string {
  const unavailable = args.result.profileRoleResults.filter((item) => item.status === "UNAVAILABLE")
    .map((item) => `${item.role}:${item.profile.profileId}`);
  const stopped = args.result.profileRoleResults.filter((item) => item.status === "NOT_TESTED_SEQUENTIAL_STOP")
    .map((item) => `${item.role}:${item.profile.profileId}`);
  return [
    "# Role Qualification V3 Live Result",
    "",
    `- Status: **${args.result.roleSetReady ? "ROLE_SET_READY" : "ROLE_SET_NOT_READY"}**`,
    `- Experiment: \`${args.result.experimentId}\``,
    `- Exact implementation HEAD: \`${args.gate.headSha}\``,
    `- Dedicated V25 workflow: **${args.gate.workflow.conclusion}**`,
    `- Draft PR: **#${args.gate.pullRequest.number}**, open=${args.gate.pullRequest.state === "OPEN"}, draft=${args.gate.pullRequest.isDraft}, merged=${args.gate.pullRequest.merged}`,
    `- Base calls attempted: **${args.result.baseCallsAttempted}** / ${IMP24_BASE_MAXIMUM_CALLS}`,
    `- Infrastructure replays: **${args.result.infrastructureReplays}**`,
    `- Total attempts: **${args.result.totalAttempts}** / ${IMP24_HARD_MAXIMUM_CALLS}`,
    `- ChatGPT-authenticated codex exec invocations: **${args.ledger.codexExecInvocations}**`,
    `- Cached receipts reused: **${args.ledger.cachedReceipts}**`,
    "- API calls: **0**",
    `- Unavailable profiles (zero calls): ${unavailable.length > 0 ? unavailable.map((item) => `\`${item}\``).join(", ") : "none"}`,
    `- Sequential stops (zero calls): ${stopped.length > 0 ? stopped.map((item) => `\`${item}\``).join(", ") : "none"}`,
    "- Gate weakening: **none**. Thresholds, holdouts, labels, candidate order, and retry policy remained frozen.",
    "",
    "## Selected roles",
    "",
    ...selectedLines(args.result),
    "",
  ].join("\n");
}

export function renderRoleAssignmentFreezeV3Markdown(args: {
  freeze: ForwardRoleAssignmentFreezeV3;
  result: RoleQualificationRunnerResultV3;
  ledger: LiveCallLedgerV3;
}): string {
  return [
    "# Role Assignment Freeze V3",
    "",
    "- Status: **FROZEN**",
    `- Freeze SHA-256: \`${args.freeze.freezeSha256}\``,
    `- Qualification result SHA-256: \`${args.freeze.qualificationResultSha256}\``,
    `- Base calls attempted: **${args.result.baseCallsAttempted}**`,
    `- Infrastructure replays: **${args.result.infrastructureReplays}**`,
    `- ChatGPT-authenticated codex exec invocations: **${args.ledger.codexExecInvocations}**`,
    "- API calls: **0**",
    "- Gate weakening: **none**. The exact qualified profiles and all canary/holdout bindings are retained.",
    "",
    "## Fixed roles",
    "",
    ...selectedLines(args.result),
    `- Deterministic quiz checker: \`${args.freeze.roleAssignment.quizChecker.checkerVersion}\``,
    "",
  ].join("\n");
}

function buildCampaignReport(args: {
  paths: Imp24QualificationCampaignPathsV1;
  gate: Imp24ImplementationCiGateV1;
  preflight: LiveQualificationPreflightV3;
  result: RoleQualificationRunnerResultV3;
  ledger: LiveCallLedgerV3;
  roleAssignmentFreeze: Readonly<ForwardRoleAssignmentFreezeV3> | null;
  completedAt: string;
}): Imp24RoleQualificationCampaignReportV1 {
  const artifactBytes = {
    implementationCiGate: artifactBytesSha256(args.paths.implementationCiGate, "implementation CI gate"),
    candidateAvailability: artifactBytesSha256(args.paths.candidateAvailability, "candidate availability"),
    preflight: artifactBytesSha256(args.paths.preflight, "live route preflight"),
    qualificationFreeze: artifactBytesSha256(args.paths.qualificationFreeze, "qualification freeze"),
    qualificationResult: artifactBytesSha256(args.paths.qualificationResult, "qualification result"),
    roleRegistry: artifactBytesSha256(args.paths.roleRegistry, "role registry"),
    callLedger: artifactBytesSha256(args.paths.callLedger, "call ledger"),
    ...(args.roleAssignmentFreeze
      ? { roleAssignmentFreeze: artifactBytesSha256(args.paths.roleAssignmentFreeze, "role assignment freeze") }
      : {}),
  };
  const core: Omit<Imp24RoleQualificationCampaignReportV1, "reportSha256"> = {
    schema: IMP24_ROLE_QUALIFICATION_CAMPAIGN_REPORT_SCHEMA,
    experimentId: IMP24_ROLE_QUALIFICATION_ID,
    status: args.result.roleSetReady ? "ROLE_SET_READY" : "ROLE_SET_NOT_READY",
    implementationCiGateSha256: args.gate.gateSha256,
    implementationHeadSha: args.gate.headSha,
    candidateAvailabilitySha256: args.preflight.candidateAvailabilitySha256,
    preflightSha256: args.preflight.preflightSha256,
    qualificationFreezeSha256: args.result.freeze.freezeSha256,
    qualificationResultSha256: hashCanonical(args.result),
    roleRegistrySha256: hashCanonical(args.result.registry),
    roleAssignmentFreezeSha256: args.roleAssignmentFreeze?.freezeSha256 ?? null,
    selected: args.result.selected,
    profileStatusCounts: statusCounts(args.result),
    callCounts: {
      baseMaximum: IMP24_BASE_MAXIMUM_CALLS,
      hardMaximum: IMP24_HARD_MAXIMUM_CALLS,
      baseCallsAttempted: args.result.baseCallsAttempted,
      infrastructureReplays: args.result.infrastructureReplays,
      totalAttempts: args.result.totalAttempts,
      brokerRequests: args.ledger.brokerRequests,
      codexExecInvocations: args.ledger.codexExecInvocations,
      cachedReceipts: args.ledger.cachedReceipts,
      apiCalls: 0,
    },
    thresholdsWeakened: false,
    holdoutsRelabeled: false,
    unavailableReplaced: false,
    retriesAdded: false,
    externalCapabilities: EXTERNAL_CAPABILITIES,
    completedAt: args.completedAt,
    artifactBytesSha256: artifactBytes,
  };
  return { ...core, reportSha256: hashCanonical(core) };
}

export async function runImp24RoleQualificationCampaignV3(
  args: RunImp24RoleQualificationCampaignV3Args,
): Promise<Imp24RoleQualificationCampaignDryResultV1 | Imp24RoleQualificationCampaignLiveResultV1> {
  // This check must remain the first observable operation. A dry/mistyped call
  // does not inspect auth, probe a CLI, write state, or invoke an injected spawn.
  if (args.executeLive !== true) {
    return {
      code: 2,
      executed: false,
      result: null,
      report: null,
      roleAssignmentFreeze: null,
      modelCalls: 0,
      apiCalls: 0,
      message: "V3 role qualification refused: executeLive must be the literal true value",
    };
  }

  const rawArgs = args as unknown as Record<string, unknown>;
  const forbiddenTopLevelSeams = [
    "implementationCiGate", "checkoutIdentity", "executor", "qualifiedAt", "clock", "reportOutputDir",
    "spawn", "preCallVerifier", "trustedEvidenceCollector",
  ].filter((key) => Object.hasOwn(rawArgs, key));
  const rawPreflight = (rawArgs.preflight ?? {}) as Record<string, unknown>;
  const forbiddenPreflightSeams = ["env", "verifiedAt", "cliQualifier", "allowSyntheticCliForTests"]
    .filter((key) => Object.hasOwn(rawPreflight, key));
  requireCondition(forbiddenTopLevelSeams.length === 0 && forbiddenPreflightSeams.length === 0,
    `official V3 campaign rejects synthetic/test seams before any query or write: ${[
      ...forbiddenTopLevelSeams,
      ...forbiddenPreflightSeams.map((key) => `preflight.${key}`),
    ].join(", ")}`);

  const now = () => new Date();
  requireGitSha(args.expectedHeadSha, "caller-supplied implementation HEAD");
  requireCondition(Number.isSafeInteger(args.workflowRunId) && args.workflowRunId > 0,
    "dedicated V25 workflow run ID must be a positive integer");

  const paths = pathsFor(args);
  const downstreamWithoutTerminalResult = [
    paths.roleRegistry,
    paths.qualificationReportJson,
    paths.qualificationReportDocsJson,
    paths.qualificationReportMarkdown,
    paths.roleAssignmentFreeze,
    paths.roleAssignmentFreezeDocsJson,
    paths.roleAssignmentFreezeMarkdown,
  ].filter(existsSync);
  requireCondition(existsSync(paths.qualificationResult) || downstreamWithoutTerminalResult.length === 0,
    "retained V3 downstream qualification artifacts exist without the terminal qualification result; refuse live resume");
  const retainedGate = existsSync(paths.implementationCiGate)
    ? parseJson<Imp24ImplementationCiGateV1>(paths.implementationCiGate, "implementation CI gate")
    : null;
  const gateVerifiedAt = retainedGate?.verifiedAt ?? now().toISOString();
  const implementationCiGate = collectImp24ImplementationCiGate({
    repositoryRoot: args.repositoryRoot,
    expectedHeadSha: args.expectedHeadSha,
    workflowRunId: args.workflowRunId,
    verifiedAt: gateVerifiedAt,
  });
  const prepared = prepareLiveRoleQualificationV3({ repositoryRoot: args.repositoryRoot, input: args.input });
  const plan = buildRoleQualificationPlanV3(prepared.input);
  const verifiedAt = retainedVerifiedAt(paths.preflight, undefined, now);
  const preflight = await preflightLiveRoleQualificationV3(prepared.input, {
    ...args.preflight,
    repositoryRoot: args.repositoryRoot,
    verifiedAt,
  });

  // Every immutable authorizer and the 464/928 plan is on disk before the
  // first possible model call. Existing files are create-once exact resumes.
  persistExactJson(paths.implementationCiGate, implementationCiGate, "implementation CI gate");
  persistExactJson(paths.candidateAvailability, prepared.input.candidateAvailability, "candidate availability");
  persistExactJson(paths.preflight, preflight, "live route preflight");
  persistExactJson(paths.qualificationFreeze, plan.freeze, "qualification freeze");

  const live = createLiveQualificationExecutorV3({
    phaseDir: paths.liveDir,
    freezeSha256: plan.freeze.freezeSha256,
    certificationSha256: plan.freeze.certificationSha256,
    productionInstrumentSealSha256: plan.freeze.productionInstrumentSealSha256,
    repositoryRoot: args.repositoryRoot,
    productionInstrumentSeal: prepared.input.productionInstrumentSeal,
    authJsonPath: args.preflight.authJsonPath,
    ...(args.timeoutMs ? { timeoutMs: args.timeoutMs } : {}),
  });
  // Whole-phase, zero-call resume barrier. This must finish before the runner
  // creates its two concurrent workers; otherwise one fresh sibling could
  // spawn while another worker discovers corrupt retained evidence lazily.
  live.auditResume({
    input: prepared.input,
    freeze: plan.freeze,
    schedule: plan.schedule,
    evaluateOutput: prepared.evaluateOutput,
  });
  const qualifiedAt = retainedQualifiedAt(paths.qualificationResult, undefined, now);
  const result = await runRoleQualificationV3(prepared.input, {
    executor: live.executor,
    evaluateOutput: prepared.evaluateOutput,
    retainAttemptEvaluation: live.retainAttemptEvaluation,
    qualifiedAt: () => qualifiedAt,
  });

  // The live executor updates this same path before/after every broker event;
  // rewrite it atomically once more so the completed ledger has no torn tail.
  atomicJson(paths.callLedger, live.ledger);
  persistExactJson(paths.qualificationResult, result, "V3 qualification result");
  persistExactJson(paths.roleRegistry, result.registry, "V3 role registry");

  const routeBinding: ForwardV3RouteBinding = {
    executionRoute: "codex_exec_chatgpt_subscription",
    authMode: "chatgpt",
    apiKeyPresent: false,
    apiFallbackAllowed: false,
    directHttpOrSdkAllowed: false,
    executionProfileHash: preflight.executionProfileHash,
    routePolicyVersion: preflight.routePolicyVersion,
  };
  const roleAssignmentFreeze = result.roleSetReady
    ? buildForwardRoleAssignmentFreezeV3({
      result,
      certification: prepared.input.certification,
      corpusBundle: prepared.input.corpusBundle,
      schemaHashes: prepared.input.schemaHashes,
      promptSourceHashes: prepared.input.promptSourceHashes,
      routeBinding,
      productionInstrumentSeal: prepared.input.productionInstrumentSeal,
      repositoryRoot: args.repositoryRoot,
    })
    : null;
  if (roleAssignmentFreeze) {
    persistExactJson(paths.roleAssignmentFreeze, roleAssignmentFreeze, "V3 role assignment freeze");
    persistExactJson(paths.roleAssignmentFreezeDocsJson, roleAssignmentFreeze, "V3 role assignment freeze report JSON");
  } else {
    requireCondition(!existsSync(paths.roleAssignmentFreeze),
      "a retained role assignment freeze exists although the current V3 role set is not ready");
    requireCondition(!existsSync(paths.roleAssignmentFreezeDocsJson),
      "a retained role assignment freeze report exists although the current V3 role set is not ready");
  }

  const retainedReport = retainedCampaignReport(paths.qualificationReportJson);
  const completedAt = retainedReport?.completedAt ?? now().toISOString();
  requireCondition(Number.isFinite(Date.parse(completedAt)), "campaign completion time is invalid");
  const report = buildCampaignReport({
    paths,
    gate: implementationCiGate,
    preflight,
    result,
    ledger: live.ledger,
    roleAssignmentFreeze,
    completedAt,
  });
  persistCampaignReport(paths.qualificationReportJson, report, retainedReport);
  // A terminal resume legitimately raises cachedReceipts and rewrites only the
  // call-ledger byte hash. Apply the same stable-projection check to the docs
  // mirror as the experiment report, then synchronize both atomically.
  const retainedDocsReport = retainedCampaignReport(paths.qualificationReportDocsJson);
  persistCampaignReport(paths.qualificationReportDocsJson, report, retainedDocsReport);
  writeFileAtomic(paths.qualificationReportMarkdown, renderRoleQualificationV3LiveResultMarkdown({
    result,
    ledger: live.ledger,
    gate: implementationCiGate,
  }));
  if (roleAssignmentFreeze) {
    writeFileAtomic(paths.roleAssignmentFreezeMarkdown, renderRoleAssignmentFreezeV3Markdown({
      freeze: roleAssignmentFreeze,
      result,
      ledger: live.ledger,
    }));
  }

  return {
    code: 0,
    executed: true,
    result,
    report,
    roleAssignmentFreeze,
    callLedger: live.ledger,
    preflight,
    paths,
    modelCalls: live.ledger.codexExecInvocations,
    apiCalls: 0,
    message: result.roleSetReady
      ? "V3 live role qualification completed and the exact role assignment was frozen"
      : "V3 live role qualification completed; frozen holdouts did not produce a complete role set",
  };
}
