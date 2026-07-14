/**
 * IMP-24C deterministic terminal-attestation lifecycle.
 *
 * The materializer has no model, auth, network, API, publication, or activation
 * capability. It validates two already-created Git commits and retained
 * qualification/CI evidence, then projects terminal artifacts whose bytes are
 * stable for identical inputs. The retained-CI verifier separately performs
 * the authorized read-only GitHub provenance recheck. The pre-live generator
 * never imports this module and therefore cannot own the terminal report path.
 */

import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";

import { canonicalJson, hashCanonical, sha256Hex } from "../../contracts/contractUtil.js";
import { validateWorkerReport } from "../../contracts/workerReport.js";
import { writeFileAtomic } from "../../lib/atomicWrite.js";
import { canonicalPretty } from "./corpusBuilderCore.js";
import {
  IMP24B_BRANCH,
  IMP24B_DRAFT_PR,
  IMP24C_PRE_LIVE_ARTIFACT_PATHS,
  IMP24C_STARTING_HEAD,
} from "./imp24PreLiveFreeze.js";
import { IMP24_ROLE_QUALIFICATION_R1_EXECUTION_ID } from "./imp24Corpus.js";
import {
  IMP24_BASE_MAXIMUM_CALLS,
  IMP24_HARD_MAXIMUM_CALLS,
} from "./roleQualificationRunnerV3.js";
import { QUIZ_DETERMINISTIC_CHECKER_VERSION } from "./reviewerRoleAssignment.js";
import {
  IMP24_PILOT_GOLD_FIXED_PATHS,
  verifyImp24RetainedQualificationForFinalAttestationV3,
} from "./imp24PilotGoldWorkflow.js";
import {
  validateForwardRoleAssignmentFreezeInternalV3,
  type ForwardRoleAssignmentFreezeV3,
} from "../../orchestrator/forwardRoleAssignmentFreezeV3.js";
import {
  IMP24_IMPLEMENTATION_CI_GATE_SCHEMA,
  renderRoleAssignmentFreezeV3Markdown,
  renderRoleQualificationV3LiveResultMarkdown,
  reverifyImp24ImplementationCiGateLive,
  validateImp24ImplementationCiGate,
  type Imp24ImplementationCiGateV1,
} from "../../orchestrator/forwardRoleQualificationCampaignV3.js";

export const IMP24C_FINAL_ATTESTATION_SCHEMA = "imp24c-final-attestation-v1" as const;
export const IMP24C_FINAL_ATTESTATION_PATHS = {
  implementationReport: "docs/v25/reports/implementation-report.imp-24.json",
  attestationJson: "docs/v25/reports/IMP-24C_FINAL_REPORT.json",
  attestationMarkdown: "docs/v25/reports/IMP-24C_FINAL_REPORT.md",
} as const;
export const IMP24B_CLOSURE_JSON_REL_PATH = "docs/v25/reports/IMP-24B_ZERO_CALL_LIFECYCLE_CLOSURE.json" as const;

const GIT_SHA = /^[a-f0-9]{40}$/;
const SHA256 = /^[a-f0-9]{64}$/;

type JsonObject = Record<string, unknown>;
type RoleSelection = {
  readerPrimary: string | null;
  readerAudit: string | null;
  sourcePrimary: string | null;
  sourceAdjudicator: string | null;
  quizSemanticAdjudicator: string | null;
};

export type BuildImp24CFinalAttestationOptions = {
  repositoryRoot: string;
  /** Root for retained inputs and generated report paths; defaults to repositoryRoot. */
  artifactRoot?: string;
  implementationCommit: string;
  evidenceCommit: string;
  terminalQualificationResultPath: string;
  roleAssignmentPath?: string;
  dedicatedCiEvidencePath: string;
  preliminaryReportPath?: string;
  imp24bClosurePath?: string;
};

/** Explicit non-production lifecycle fixture input. It is accepted only by
 * the fixture-named entrypoints below and is never serialized or replayed by
 * the production/CI verifier. */
export type BuildImp24CFinalAttestationFixtureOptions = BuildImp24CFinalAttestationOptions & {
  lifecycleBaselineCommit: string;
};

const IMP24C_FINAL_ATTESTATION_FIXTURE_TOKEN = Symbol("imp24c-final-attestation-fixture");

export type Imp24CFinalAttestation = {
  schema: typeof IMP24C_FINAL_ATTESTATION_SCHEMA;
  promptId: "IMP-24";
  continuationPromptId: "IMP-24C";
  executionId: typeof IMP24_ROLE_QUALIFICATION_R1_EXECUTION_ID;
  lifecycleBaselineCommit: string;
  implementationCommit: string;
  evidenceCommit: string;
  finalDecision: "PASS" | "BLOCKED";
  roleSetReady: boolean;
  roles: RoleSelection;
  qualifiedProfiles: string[];
  deterministicQuizChecker: typeof QUIZ_DETERMINISTIC_CHECKER_VERSION;
  certificationSha256: string;
  productionSealSha256: string;
  productionQualificationParitySha256: string;
  callCounts: {
    canaryCalls: number;
    holdoutCalls: number;
    infrastructureReplays: number;
    maxPlanEvents: number;
    totalAttempts: number;
    codexExecInvocations: number;
    apiCalls: 0;
  };
  qualificationResult: {
    status: "ROLE_SET_READY" | "ROLE_SET_NOT_READY";
    blockedReason: string | null;
    terminalResultBytesSha256: string;
    roleAssignmentBytesSha256: string | null;
  };
  controls: {
    thresholdsWeakened: false;
    holdoutsRelabeled: false;
    unavailableProfilesReplaced: false;
    outputInformedResampling: false;
    retriesAdded: false;
    apiFallbackAllowed: false;
    directHttpOrSdkAllowed: false;
  };
  remainingRisks: string[];
  stopBoundary: {
    pilotRun: false;
    goldRun: false;
    contentDesignScoreRun: false;
    localSolActivation: false;
    publish: false;
    promote: false;
    deploy: false;
    upload: false;
    merge: false;
    forcePush: false;
  };
  inputs: {
    terminalQualificationResultPath: string;
    roleAssignmentPath: string | null;
    dedicatedCiEvidencePath: string;
    preliminaryReportPath: string;
    imp24bClosurePath: string;
  };
  inputBytesSha256: {
    terminalQualificationResult: string;
    roleAssignment: string | null;
    dedicatedCiEvidence: string;
    preliminaryReport: string;
    imp24bClosure: string;
  };
  terminalReportBytesSha256: string;
  supersededImp24B: {
    implementationCommit: string;
    terminalEvidenceCommit: string;
    terminalAttestationCommit: string;
    disposition: string;
    mayResume: false;
    liveCalls: 0;
    apiCalls: 0;
    closureBytesSha256: string;
  };
  modelCalls: number;
  apiCalls: 0;
  attestationSha256: string;
};

export type Imp24CFinalAttestationBuild = {
  attestation: Imp24CFinalAttestation;
  implementationReport: JsonObject;
  outputs: Record<keyof typeof IMP24C_FINAL_ATTESTATION_PATHS, {
    relativePath: string;
    bytes: string;
    bytesSha256: string;
  }>;
  modelCalls: 0;
  apiCalls: 0;
};

export type Imp24CFinalAttestationMaterialization = {
  schema: "imp24c-final-attestation-materialization-v1";
  attestationSha256: string;
  outputs: Record<keyof typeof IMP24C_FINAL_ATTESTATION_PATHS, {
    relativePath: string;
    absolutePath: string;
    bytesSha256: string;
    bytes: number;
  }>;
  writes: 3;
  modelCalls: 0;
  apiCalls: 0;
};

export type Imp24CFinalAttestationVerification = {
  schema: "imp24c-final-attestation-verification-v1";
  status: "VERIFIED_BYTE_IDENTICAL_TERMINAL_ATTESTATION";
  attestationSha256: string;
  verifiedOutputCount: 3;
  writes: 0;
  modelCalls: 0;
  apiCalls: 0;
};

export class Imp24CFinalAttestationError extends Error {
  constructor(message: string, readonly issues: readonly string[] = []) {
    super(issues.length === 0 ? message : `${message}: ${issues.join("; ")}`);
    this.name = "Imp24CFinalAttestationError";
  }
}

function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Imp24CFinalAttestationError(message);
}

function requireGitSha(value: string, label: string): void {
  requireCondition(GIT_SHA.test(value), `${label} must be an exact lowercase 40-character Git SHA`);
}

function requireSha256(value: unknown, label: string): asserts value is string {
  requireCondition(typeof value === "string" && SHA256.test(value), `${label} must be a lowercase SHA-256`);
}

function asObject(value: unknown, label: string): JsonObject {
  requireCondition(value !== null && typeof value === "object" && !Array.isArray(value), `${label} must be an object`);
  return value as JsonObject;
}

function requireExactKeys(value: JsonObject, expected: readonly string[], label: string): void {
  requireCondition(canonicalJson(Object.keys(value).sort()) === canonicalJson([...expected].sort()),
    `${label} has missing or unexpected fields`);
}

function parseJson(bytes: Buffer, label: string): JsonObject {
  try {
    return asObject(JSON.parse(bytes.toString("utf8")), label);
  } catch (error) {
    if (error instanceof Imp24CFinalAttestationError) throw error;
    throw new Imp24CFinalAttestationError(`${label} is not valid JSON`, [(error as Error).message]);
  }
}

function safeRelativePath(root: string, value: string, label: string): string {
  requireCondition(value.trim().length > 0 && !isAbsolute(value), `${label} must be a non-empty repository-relative path`);
  const absolutePath = resolve(root, value);
  const rel = relative(root, absolutePath).replace(/\\/g, "/");
  requireCondition(rel !== "" && rel !== ".." && !rel.startsWith("../"), `${label} escapes the artifact root`);
  return rel;
}

function productionRelativePath(repositoryRoot: string, absolutePath: string): string {
  return relative(repositoryRoot, absolutePath).replace(/\\/g, "/");
}

function validateProductionFinalInputPaths(args: {
  repositoryRoot: string;
  artifactRoot: string;
  options: BuildImp24CFinalAttestationOptions;
}): void {
  requireCondition(args.repositoryRoot === resolve(IMP24_PILOT_GOLD_FIXED_PATHS.repositoryRoot)
      && args.artifactRoot === args.repositoryRoot,
    "production final attestation requires the authoritative repository/artifact root");
  const qualificationRoot = IMP24_PILOT_GOLD_FIXED_PATHS.qualificationRoot;
  const exact = {
    terminalQualificationResultPath: productionRelativePath(
      args.repositoryRoot,
      resolve(qualificationRoot, "qualification-report.json"),
    ),
    roleAssignmentPath: productionRelativePath(
      args.repositoryRoot,
      IMP24_PILOT_GOLD_FIXED_PATHS.roleAssignmentFreeze,
    ),
    dedicatedCiEvidencePath: productionRelativePath(
      args.repositoryRoot,
      resolve(qualificationRoot, "implementation-ci-gate.json"),
    ),
    preliminaryReportPath: IMP24C_PRE_LIVE_ARTIFACT_PATHS.implementationReport,
    imp24bClosurePath: IMP24B_CLOSURE_JSON_REL_PATH,
  };
  requireCondition(args.options.terminalQualificationResultPath === exact.terminalQualificationResultPath
      && (args.options.roleAssignmentPath === undefined || args.options.roleAssignmentPath === exact.roleAssignmentPath)
      && args.options.dedicatedCiEvidencePath === exact.dedicatedCiEvidencePath
      && (args.options.preliminaryReportPath ?? exact.preliminaryReportPath) === exact.preliminaryReportPath
      && (args.options.imp24bClosurePath ?? exact.imp24bClosurePath) === exact.imp24bClosurePath,
    "production final attestation requires the exact successor qualification, CI, preliminary, and closure paths");
}

function readArtifact(root: string, value: string, label: string): { relativePath: string; bytes: Buffer; value: JsonObject } {
  const relativePath = safeRelativePath(root, value, label);
  const absolutePath = resolve(root, relativePath);
  requireCondition(existsSync(absolutePath), `${label} is missing: ${relativePath}`);
  const bytes = readFileSync(absolutePath);
  return { relativePath, bytes, value: parseJson(bytes, label) };
}

function assertCommitExists(repositoryRoot: string, sha: string, label: string): void {
  try {
    execFileSync("git", ["cat-file", "-e", `${sha}^{commit}`], {
      cwd: repositoryRoot,
      stdio: ["ignore", "ignore", "pipe"],
    });
  } catch {
    throw new Imp24CFinalAttestationError(`${label} is not a known commit in this repository: ${sha}`);
  }
}

function assertCommitAncestry(repositoryRoot: string, implementationCommit: string, evidenceCommit: string): void {
  requireCondition(implementationCommit !== evidenceCommit,
    "evidence commit must be a later commit, not the implementation commit itself");
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", implementationCommit, evidenceCommit], {
      cwd: repositoryRoot,
      stdio: ["ignore", "ignore", "pipe"],
    });
  } catch {
    throw new Imp24CFinalAttestationError(
      `evidence commit does not descend from implementation commit: ${evidenceCommit} !> ${implementationCommit}`,
    );
  }
}

function assertArtifactCommittedAtCommit(args: {
  repositoryRoot: string;
  commit: string;
  commitLabel: string;
  relativePath: string;
  currentBytes: Buffer;
  label: string;
}): void {
  let committedBytes: Buffer;
  try {
    committedBytes = execFileSync("git", ["show", `${args.commit}:${args.relativePath}`], {
      cwd: args.repositoryRoot,
      encoding: "buffer",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (error) {
    throw new Imp24CFinalAttestationError(
      `${args.label} is not a committed blob in ${args.commitLabel}: ${args.relativePath}`,
      [(error as Error).message],
    );
  }
  requireCondition(committedBytes.equals(args.currentBytes),
    `${args.label} current bytes differ from ${args.commitLabel}: ${args.relativePath}`);
}

function currentTreeFiles(repositoryRoot: string, relativeRoot: string): string[] {
  const absoluteRoot = resolve(repositoryRoot, relativeRoot);
  requireCondition(existsSync(absoluteRoot), `required retained evidence root is missing: ${relativeRoot}`);
  const files: string[] = [];
  const visit = (absoluteDirectory: string): void => {
    for (const name of readdirSync(absoluteDirectory).sort()) {
      const absolutePath = resolve(absoluteDirectory, name);
      const stat = lstatSync(absolutePath);
      requireCondition(!stat.isSymbolicLink(), `retained evidence contains a symlink: ${absolutePath}`);
      if (stat.isDirectory()) visit(absolutePath);
      else {
        requireCondition(stat.isFile(), `retained evidence contains a non-file entry: ${absolutePath}`);
        files.push(relative(repositoryRoot, absolutePath).replace(/\\/g, "/"));
      }
    }
  };
  visit(absoluteRoot);
  return files.sort();
}

function assertRecoveryBEvidenceOwnership(args: {
  repositoryRoot: string;
  evidenceCommit: string;
  roleSetReady: boolean;
}): void {
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", args.evidenceCommit, "HEAD"], {
      cwd: args.repositoryRoot,
      stdio: ["ignore", "ignore", "pipe"],
    });
  } catch {
    throw new Imp24CFinalAttestationError(
      `Recovery Commit B is not an ancestor of the current final-attestation checkout: ${args.evidenceCommit}`,
    );
  }
  const relativeRoot = productionRelativePath(
    args.repositoryRoot,
    IMP24_PILOT_GOLD_FIXED_PATHS.qualificationRoot,
  );
  const currentFiles = currentTreeFiles(args.repositoryRoot, relativeRoot);
  let committedFiles: string[];
  try {
    committedFiles = execFileSync("git", [
      "ls-tree", "-r", "--name-only", args.evidenceCommit, "--", relativeRoot,
    ], {
      cwd: args.repositoryRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 64 * 1024 * 1024,
    }).split("\n").map((value) => value.trim()).filter(Boolean).sort();
  } catch (error) {
    throw new Imp24CFinalAttestationError(
      "cannot enumerate the successor retained-evidence tree at Recovery Commit B",
      [(error as Error).message],
    );
  }
  requireCondition(canonicalJson(currentFiles) === canonicalJson(committedFiles),
    "current successor retained-evidence tree differs from the exact Recovery Commit B tree");
  const reportFiles = [
    "docs/v25/reports/ROLE_QUALIFICATION_V3_R1_LIVE_RESULT.json",
    "docs/v25/reports/ROLE_QUALIFICATION_V3_R1_LIVE_RESULT.md",
  ];
  const roleReportFiles = [
    "docs/v25/reports/ROLE_ASSIGNMENT_FREEZE_V3_R1.json",
    "docs/v25/reports/ROLE_ASSIGNMENT_FREEZE_V3_R1.md",
  ];
  for (const relativePath of roleReportFiles) {
    const currentExists = existsSync(resolve(args.repositoryRoot, relativePath));
    let committedAtB = true;
    try {
      execFileSync("git", ["cat-file", "-e", `${args.evidenceCommit}:${relativePath}`], {
        cwd: args.repositoryRoot,
        stdio: ["ignore", "ignore", "ignore"],
      });
    } catch {
      committedAtB = false;
    }
    requireCondition(currentExists === args.roleSetReady && committedAtB === args.roleSetReady,
      `Recovery Commit B role-assignment report presence differs from terminal readiness: ${relativePath}`);
  }
  if (args.roleSetReady) reportFiles.push(...roleReportFiles);
  for (const relativePath of [...currentFiles, ...reportFiles]) {
    const absolutePath = resolve(args.repositoryRoot, relativePath);
    requireCondition(existsSync(absolutePath), `Recovery Commit B evidence file is missing: ${relativePath}`);
    assertArtifactCommittedAtCommit({
      repositoryRoot: args.repositoryRoot,
      commit: args.evidenceCommit,
      commitLabel: "Recovery Commit B",
      relativePath,
      currentBytes: readFileSync(absolutePath),
      label: "retained qualification evidence",
    });
  }
}

function validateClosure(value: JsonObject): void {
  const expected = {
    schema: "imp-24b-zero-call-lifecycle-closure-v1",
    promptId: "IMP-24",
    continuationPromptId: "IMP-24B",
    executionId: "s16-forward-role-qualification-v3-envelope",
    disposition: "BLOCKED_ZERO_CALL_CONTROL_PLANE_DEFECT",
    implementationCommit: "e9a90bc17cd997fe1707b5cd62d86ef7a4e743b8",
    terminalEvidenceCommit: "7af0f8f91f5892166f534f4438a46343c6251e82",
    terminalAttestationCommit: "0ba1b168e350fa5d6c05480a28c7c944411f54ee",
    commitTreeBindings: {
      implementation: "05418c0886a4b844e3917954b6404f2e9b701174",
      terminalEvidence: "d29aa0bd58152cde21d65cd656dd97183881ce05",
      terminalAttestation: "9b71a2cc7acd435ff8b8c0f275ecb5cddd6211e8",
    },
    implementationCiRun: 29267830570,
    implementationCiResult: "SUCCESS",
    evidenceCiRun: 29270320757,
    evidenceCiResult: "SUCCESS",
    terminalAttestationCiRuns: [29271151495, 29271155385],
    terminalAttestationCiResult: "FAILURE_CLEAN_WORKTREE_ONLY",
    liveCalls: 0,
    apiCalls: 0,
    rolesQualified: 0,
    terminalReason: "CONTROL_PLANE_IMPLEMENTATION_DEFECTS",
    mayResume: false,
    mayQualifyProfiles: false,
    stateTreeBinding: {
      path: "scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments/s16-forward-role-qualification-v3-envelope",
      commit: "7af0f8f91f5892166f534f4438a46343c6251e82",
      gitTreeSha1: "6acb571faf639291327280389e2e5d34379c1d7a",
    },
    artifactBindings: [
      {
        path: "docs/v25/reports/ROLE_QUALIFICATION_V3_EVIDENCE_MANIFEST.json",
        gitBlobSha1: "56ff8cd9b56b4ac678827b71b3b4ee043f273c57",
        bytesSha256: "cb2b0d1197f2a776b017fc05e2603dbec5a040b8edaf9cd8de04e9c817b0781f",
      },
      {
        path: "docs/v25/reports/ROLE_QUALIFICATION_V3_LIVE_RESULT.json",
        gitBlobSha1: "b52543bc3a1cb6175c4f7cd1905e5d4dc0ee86de",
        bytesSha256: "74786ec30d06b752f5e41fe2bdaec4602b3942d9d2f2646a55a5265700a13002",
      },
      {
        path: "docs/v25/reports/ROLE_QUALIFICATION_V3_LIVE_RESULT.md",
        gitBlobSha1: "84f8e11801503c3351550d4fa89076e8fc0bdf5e",
        bytesSha256: "520d7d27eb0b3fc97ae4bd18f0164220f83ea9c47c4e6d7ee76c546cb9c4d848",
      },
      {
        path: "docs/v25/reports/implementation-report.imp-24.json",
        gitBlobSha1: "03813f1130775805df3520741fcd4927dddc6d06",
        bytesSha256: "abdb1abcc08c09395618c52e2ba0b895c5b8a12fed15e0c29a2847be60cb7347",
      },
    ],
    supersededBy: {
      continuationPromptId: "IMP-24C",
      executionId: IMP24_ROLE_QUALIFICATION_R1_EXECUTION_ID,
    },
    modelCalls: 0,
  };
  requireCondition(hashCanonical(value) === hashCanonical(expected),
    "IMP-24B closure differs from the exact immutable zero-call lifecycle closure");
}

function validateDedicatedCiEvidence(value: JsonObject, implementationCommit: string): void {
  requireCondition(value.schema === IMP24_IMPLEMENTATION_CI_GATE_SCHEMA, "dedicated CI gate schema mismatch");
  requireCondition(typeof value.gateSha256 === "string" && SHA256.test(value.gateSha256),
    "dedicated CI gate self hash is missing");
  const { gateSha256: _gateSha256, ...core } = value;
  requireCondition(hashCanonical(core) === value.gateSha256, "dedicated CI gate self hash drift");
  const workflow = asObject(value.workflow, "dedicated CI workflow evidence");
  requireCondition(value.headSha === implementationCommit && workflow.headSha === implementationCommit,
    "dedicated CI evidence does not bind the exact implementation commit");
  requireCondition(workflow.displayName === "ChapterFlow V25 Pipeline"
    && workflow.workflowFile === ".github/workflows/chapterflow-v25-pipeline.yml",
  "dedicated CI evidence binds the wrong workflow identity");
  requireCondition(workflow.headBranch === IMP24B_BRANCH
    && workflow.status === "completed"
    && workflow.conclusion === "success",
  "dedicated V25 CI evidence is not completed/success");
  const requiredJob = asObject(workflow.requiredJob, "dedicated CI required job");
  requireCondition(requiredJob.name === "V25 Pipeline Typecheck, Contracts, and Tests"
    && requiredJob.status === "completed"
    && requiredJob.conclusion === "success",
  "dedicated CI evidence lacks the exact successful required job");
  const repository = asObject(value.repository, "dedicated CI repository evidence");
  requireCondition(repository.nameWithOwner === "WillSoltani/ChapterFlow"
      && repository.url === "https://github.com/WillSoltani/ChapterFlow",
    "dedicated CI evidence binds the wrong repository");
  const pullRequest = asObject(value.pullRequest, "dedicated CI pull-request evidence");
  requireCondition(pullRequest.number === IMP24B_DRAFT_PR
    && pullRequest.state === "OPEN"
    && pullRequest.isDraft === true
    && pullRequest.merged === false
    && pullRequest.headSha === implementationCommit,
  "dedicated CI evidence does not bind the open draft PR at the implementation commit");
  requireCondition(value.branch === IMP24B_BRANCH, "dedicated CI evidence binds the wrong branch");
  requireCondition(value.modelCalls === 0 && value.apiCalls === 0, "dedicated CI gate must have zero model/API calls");
  const checkout = {
    branch: IMP24B_BRANCH,
    headSha: implementationCommit,
    implementationClean: true,
  } as const;
  validateImp24ImplementationCiGate({
    gate: value as Imp24ImplementationCiGateV1,
    expectedHeadSha: implementationCommit,
    checkout,
  });
  const trustedEvidence = asObject(value.trustedEvidence, "dedicated CI trusted evidence");
  requireCondition(trustedEvidence.checkoutSha256 === hashCanonical(checkout),
    "dedicated CI trusted checkout evidence does not bind exact clean Recovery Commit A identity");
}

function roleProfileId(value: unknown, label: string): string {
  const object = asObject(value, label);
  requireCondition(typeof object.profileId === "string" && object.profileId.length > 0, `${label}.profileId is required`);
  return object.profileId;
}

function selectedFromTerminal(terminal: JsonObject): RoleSelection {
  const candidate = terminal.selected;
  if (candidate === null || typeof candidate !== "object" || Array.isArray(candidate)) {
    return {
      readerPrimary: null,
      readerAudit: null,
      sourcePrimary: null,
      sourceAdjudicator: null,
      quizSemanticAdjudicator: null,
    };
  }
  const selected = candidate as JsonObject;
  const nullable = (key: keyof RoleSelection): string | null =>
    typeof selected[key] === "string" && (selected[key] as string).length > 0 ? selected[key] as string : null;
  return {
    readerPrimary: nullable("readerPrimary"),
    readerAudit: nullable("readerAudit"),
    sourcePrimary: nullable("sourcePrimary"),
    sourceAdjudicator: nullable("sourceAdjudicator"),
    quizSemanticAdjudicator: nullable("quizSemanticAdjudicator"),
  };
}

function validateRoleAssignment(args: {
  value: JsonObject;
  bytes: Buffer;
  terminal: JsonObject;
  ci: JsonObject;
  preliminary: JsonObject;
  implementationCommit: string;
}): RoleSelection {
  const { value, terminal } = args;
  requireCondition(value.schema === "imp24-forward-role-assignment-freeze-v3", "role-assignment freeze schema mismatch");
  requireCondition(value.experimentId === IMP24_ROLE_QUALIFICATION_R1_EXECUTION_ID, "role-assignment freeze execution identity mismatch");
  requireSha256(value.freezeSha256, "role-assignment freeze self hash");
  const { freezeSha256: _freezeSha256, ...core } = value;
  requireCondition(hashCanonical(core) === value.freezeSha256, "role-assignment freeze self hash drift");
  validateForwardRoleAssignmentFreezeInternalV3(
    value as ForwardRoleAssignmentFreezeV3,
    IMP24_ROLE_QUALIFICATION_R1_EXECUTION_ID,
  );

  for (const [label, binding] of [
    ["role-assignment implementation CI gate hash", value.implementationCiGateSha256],
    ["role-assignment call-ledger canonical hash", value.callLedgerSha256],
    ["role-assignment call-ledger bytes hash", value.callLedgerBytesSha256],
    ["role-assignment qualification-result hash", value.qualificationResultSha256],
    ["role-assignment qualification-freeze hash", value.qualificationFreezeSha256],
    ["role-assignment certification hash", value.instrumentCertificationSha256],
    ["role-assignment production-seal hash", value.productionInstrumentSealSha256],
    ["role-assignment production/qualification parity hash", value.productionQualificationParitySha256],
  ] as const) requireSha256(binding, label);
  requireGitSha(String(value.implementationHeadSha ?? ""), "role-assignment implementation head");

  requireSha256(terminal.implementationCiGateSha256, "terminal implementation CI gate hash");
  requireSha256(terminal.callLedgerSha256, "terminal call-ledger canonical hash");
  requireSha256(terminal.qualificationResultSha256, "terminal qualification-result hash");
  requireSha256(terminal.qualificationFreezeSha256, "terminal qualification-freeze hash");
  requireSha256(terminal.roleAssignmentFreezeSha256, "terminal role-assignment freeze hash");
  const terminalArtifactBytes = asObject(terminal.artifactBytesSha256, "terminal artifact byte hashes");
  requireSha256(terminalArtifactBytes.callLedger, "terminal call-ledger bytes hash");
  requireSha256(terminalArtifactBytes.roleAssignmentFreeze, "terminal role-assignment bytes hash");
  requireSha256(args.ci.gateSha256, "dedicated CI gate hash");

  requireCondition(value.implementationHeadSha === args.implementationCommit,
    "role-assignment freeze binds another implementation commit");
  requireCondition(value.implementationCiGateSha256 === args.ci.gateSha256
      && value.implementationCiGateSha256 === terminal.implementationCiGateSha256,
    "role-assignment freeze, terminal campaign, and dedicated CI gate disagree");
  requireCondition(value.qualificationResultSha256 === terminal.qualificationResultSha256
      && value.qualificationFreezeSha256 === terminal.qualificationFreezeSha256,
    "role-assignment freeze and terminal campaign qualification bindings disagree");
  requireCondition(value.callLedgerSha256 === terminal.callLedgerSha256
      && value.callLedgerBytesSha256 === terminalArtifactBytes.callLedger,
    "role-assignment freeze and terminal campaign call-ledger bindings disagree");
  requireCondition(value.freezeSha256 === terminal.roleAssignmentFreezeSha256
      && sha256Hex(args.bytes) === terminalArtifactBytes.roleAssignmentFreeze,
    "terminal campaign does not bind the exact role-assignment freeze bytes");

  const certification = asObject(value.instrumentCertification, "role-assignment instrument certification");
  requireSha256(certification.certificationSha256, "role-assignment nested certification hash");
  const { certificationSha256: _certificationSha256, ...certificationCore } = certification;
  requireCondition(hashCanonical(certificationCore) === certification.certificationSha256,
    "role-assignment nested certification self hash drift");
  requireCondition(value.instrumentCertificationSha256 === certification.certificationSha256
      && value.instrumentCertificationSha256 === args.preliminary.certificationSha256,
    "role-assignment freeze and preliminary report certification disagree");
  requireCondition(value.productionInstrumentSealSha256 === args.preliminary.productionSealSha256
      && certification.productionInstrumentSealSha256 === value.productionInstrumentSealSha256,
    "role-assignment freeze and preliminary report production seal disagree");
  requireCondition(value.productionQualificationParitySha256 === args.preliminary.productionQualificationParitySha256
      && certification.productionQualificationParitySha256 === value.productionQualificationParitySha256,
    "role-assignment freeze and preliminary report parity binding disagree");

  const roleAssignment = asObject(value.roleAssignment, "fixed role assignment");
  const selected: RoleSelection = {
    readerPrimary: roleProfileId(roleAssignment.readerPrimary, "reader primary"),
    readerAudit: roleProfileId(roleAssignment.readerBackup, "reader audit"),
    sourcePrimary: roleProfileId(roleAssignment.sourcePrimary, "source primary"),
    sourceAdjudicator: roleProfileId(roleAssignment.sourceAdjudicator, "source adjudicator"),
    quizSemanticAdjudicator: roleProfileId(roleAssignment.quizAdjudicator, "quiz adjudicator"),
  };
  requireCondition(canonicalJson(selected) === canonicalJson(selectedFromTerminal(terminal)),
    "terminal qualification selection and role-assignment freeze disagree");
  return selected;
}

function terminalRoleSetReady(terminal: JsonObject): boolean {
  requireCondition(terminal.status === "ROLE_SET_READY" || terminal.status === "ROLE_SET_NOT_READY",
    "terminal qualification result lacks an explicit terminal role-set status");
  return terminal.status === "ROLE_SET_READY";
}

function validateTerminalCampaignControls(terminal: JsonObject, implementationCommit: string): void {
  requireExactKeys(terminal, [
    "schema", "experimentId", "status", "implementationCiGateSha256", "implementationHeadSha",
    "candidateAvailabilitySha256", "preflightSha256", "qualificationFreezeSha256",
    "qualificationResultSha256", "roleRegistrySha256", "callLedgerSha256",
    "roleAssignmentFreezeSha256", "selected", "qualifiedProfiles", "profileStatusCounts",
    "callCounts", "thresholdsWeakened", "holdoutsRelabeled", "unavailableReplaced",
    "outputInformedResampling", "retriesAdded", "externalCapabilities", "completedAt",
    "artifactBytesSha256", "reportSha256",
  ], "terminal qualification campaign report");
  requireCondition(terminal.schema === "imp24-role-qualification-campaign-report-v1",
    "terminal qualification result must be the retained campaign report");
  requireCondition(terminal.implementationHeadSha === implementationCommit,
    "terminal qualification campaign does not bind the exact implementation commit");
  requireCondition(terminal.status === "ROLE_SET_READY" || terminal.status === "ROLE_SET_NOT_READY",
    "terminal qualification campaign status is invalid");
  for (const [label, binding] of [
    ["terminal implementation CI gate hash", terminal.implementationCiGateSha256],
    ["terminal candidate-availability hash", terminal.candidateAvailabilitySha256],
    ["terminal preflight hash", terminal.preflightSha256],
    ["terminal qualification freeze hash", terminal.qualificationFreezeSha256],
    ["terminal qualification result hash", terminal.qualificationResultSha256],
    ["terminal role-registry hash", terminal.roleRegistrySha256],
    ["terminal call-ledger canonical hash", terminal.callLedgerSha256],
  ] as const) requireSha256(binding, label);
  const artifactBytes = asObject(terminal.artifactBytesSha256, "terminal artifact byte hashes");
  const requiredArtifactKeys = [
    "implementationCiGate", "candidateAvailability", "preflight", "qualificationFreeze",
    "qualificationResult", "roleRegistry", "callLedger",
    ...(terminal.status === "ROLE_SET_READY" ? ["roleAssignmentFreeze"] : []),
  ];
  requireExactKeys(artifactBytes, requiredArtifactKeys, "terminal artifact byte hashes");
  for (const key of requiredArtifactKeys) requireSha256(artifactBytes[key], `terminal ${key} bytes hash`);
  if (terminal.status === "ROLE_SET_READY") {
    requireSha256(terminal.roleAssignmentFreezeSha256, "terminal role-assignment freeze hash");
  } else {
    requireCondition(terminal.roleAssignmentFreezeSha256 === null,
      "blocked terminal campaign must not bind a role-assignment freeze");
  }
  requireCondition(terminal.thresholdsWeakened === false
      && terminal.holdoutsRelabeled === false
      && terminal.unavailableReplaced === false
      && terminal.outputInformedResampling === false
      && terminal.retriesAdded === false,
    "terminal qualification campaign records threshold, holdout, replacement, or retry drift");
  const externalCapabilities = asObject(terminal.externalCapabilities, "terminal external capabilities");
  requireExactKeys(externalCapabilities, [
    "publish", "promote", "deploy", "upload", "merge", "forcePush", "api", "directHttpOrSdk",
  ], "terminal external capabilities");
  requireCondition(Object.values(externalCapabilities).every((value) => value === false),
    "terminal qualification campaign records an enabled external capability");
  requireCondition(typeof terminal.completedAt === "string" && Number.isFinite(Date.parse(terminal.completedAt)),
    "terminal qualification campaign completion time is invalid");
  const profileStatusCounts = asObject(terminal.profileStatusCounts, "terminal profile-status counts");
  requireCondition(Object.keys(profileStatusCounts).length > 0
      && Object.values(profileStatusCounts).every((value) =>
        typeof value === "number" && Number.isSafeInteger(value) && value >= 0),
    "terminal qualification campaign profile-status counts are invalid");
  terminalCallCounts(terminal);
}

function terminalCallCounts(terminal: JsonObject): {
  canaryCalls: number;
  holdoutCalls: number;
  infrastructureReplays: number;
  totalAttempts: number;
  codexExecInvocations: number;
  maxPlanEvents: number;
  apiCalls: 0;
} {
  const counts = asObject(terminal.callCounts, "terminal campaign call counts");
  requireExactKeys(counts, [
    "baseMaximum", "hardMaximum", "canaryCalls", "holdoutCalls", "baseCallsAttempted",
    "infrastructureReplays", "maxPlanEvents", "totalAttempts", "brokerRequests",
    "codexExecInvocations", "cachedReceipts", "apiCalls",
  ], "terminal campaign call counts");
  for (const [key, value] of Object.entries(counts)) {
    requireCondition(typeof value === "number" && Number.isSafeInteger(value) && value >= 0,
      `terminal call count ${key} is invalid`);
  }
  requireCondition(counts.baseMaximum === IMP24_BASE_MAXIMUM_CALLS
      && counts.hardMaximum === IMP24_HARD_MAXIMUM_CALLS,
    "terminal campaign call ceilings differ from the frozen 464/928 plan");
  requireCondition((counts.canaryCalls as number) + (counts.holdoutCalls as number) === counts.baseCallsAttempted
      && (counts.baseCallsAttempted as number) + (counts.infrastructureReplays as number) === counts.totalAttempts,
    "terminal campaign call totals are internally inconsistent");
  requireCondition((counts.totalAttempts as number) <= IMP24_HARD_MAXIMUM_CALLS
      && (counts.baseCallsAttempted as number) <= IMP24_BASE_MAXIMUM_CALLS
      && (counts.codexExecInvocations as number) <= (counts.totalAttempts as number)
      && (counts.cachedReceipts as number) <= (counts.totalAttempts as number)
      && counts.apiCalls === 0,
    "terminal qualification evidence records invalid call accounting or API calls");
  return {
    canaryCalls: counts.canaryCalls as number,
    holdoutCalls: counts.holdoutCalls as number,
    infrastructureReplays: counts.infrastructureReplays as number,
    totalAttempts: counts.totalAttempts as number,
    codexExecInvocations: counts.codexExecInvocations as number,
    maxPlanEvents: counts.maxPlanEvents as number,
    apiCalls: 0,
  };
}

function validateProductionRetainedQualification(args: {
  repositoryRoot: string;
  terminal: { value: JsonObject; bytes: Buffer };
  role: { value: JsonObject; bytes: Buffer } | null;
  ci: { value: JsonObject; bytes: Buffer };
  preliminary: JsonObject;
  implementationCommit: string;
  counts: ReturnType<typeof terminalCallCounts>;
}): string | null {
  const verified = verifyImp24RetainedQualificationForFinalAttestationV3();
  const proof = verified.retainedQualificationEvidence.proof;
  const roleSetReady = args.terminal.value.status === "ROLE_SET_READY";
  requireCondition(verified.retainedQualificationEvidence.result.roleSetReady === roleSetReady,
    "production final attestation terminal status differs from the fully recomputed qualification result");
  if (roleSetReady) {
    requireCondition(verified.roleFreeze !== null && args.role !== null,
      "role-ready production final attestation lacks its fully verified role-assignment freeze");
    requireCondition(hashCanonical(verified.roleFreeze) === hashCanonical(args.role.value),
      "production final attestation role freeze differs from fully recomputed retained qualification evidence");
  } else {
    requireCondition(verified.roleFreeze === null && args.role === null
        && proof.roleAssignmentFreezeSha256 === null,
      "role-set-not-ready production final attestation must not contain a role-assignment freeze");
  }
  requireCondition(proof.implementationHeadSha === args.implementationCommit
      && proof.implementationCiGateSha256 === args.ci.value.gateSha256
      && proof.implementationCiGateBytesSha256 === sha256Hex(args.ci.bytes)
      && proof.qualificationReportSha256 === args.terminal.value.reportSha256
      && proof.qualificationReportBytesSha256 === sha256Hex(args.terminal.bytes)
      && proof.roleAssignmentFreezeSha256 === (args.role?.value.freezeSha256 ?? null)
      && proof.qualificationResultSha256 === args.terminal.value.qualificationResultSha256
      && proof.qualificationFreezeSha256 === args.terminal.value.qualificationFreezeSha256
      && proof.callLedgerSha256 === args.terminal.value.callLedgerSha256,
    "production final attestation inputs differ from the fully recomputed retained-evidence proof");
  const terminalArtifactBytes = asObject(args.terminal.value.artifactBytesSha256,
    "terminal artifact byte hashes");
  requireCondition(proof.callLedgerBytesSha256 === terminalArtifactBytes.callLedger
      && proof.totalAttempts === args.counts.totalAttempts
      && proof.infrastructureReplays === args.counts.infrastructureReplays
      && proof.codexExecInvocations === args.counts.codexExecInvocations
      && proof.verificationModelCalls === 0
      && proof.apiCalls === 0,
    "production final attestation call accounting differs from fully recomputed retained evidence");
  const certification = verified.currentQualification.certification;
  requireCondition(certification.certificationSha256 === args.preliminary.certificationSha256
      && certification.productionInstrumentSealSha256 === args.preliminary.productionSealSha256
      && certification.productionQualificationParitySha256
        === args.preliminary.productionQualificationParitySha256,
    "production final attestation preliminary certification/seal/parity differ from current model-free verification");
  const qualificationDocsJson = resolve(args.repositoryRoot,
    "docs/v25/reports/ROLE_QUALIFICATION_V3_R1_LIVE_RESULT.json");
  const qualificationDocsMarkdown = resolve(args.repositoryRoot,
    "docs/v25/reports/ROLE_QUALIFICATION_V3_R1_LIVE_RESULT.md");
  requireCondition(readFileSync(qualificationDocsJson).equals(args.terminal.bytes),
    "Recovery Commit B qualification report JSON is not the exact state-report mirror");
  requireCondition(readFileSync(qualificationDocsMarkdown, "utf8") === renderRoleQualificationV3LiveResultMarkdown({
    result: verified.retainedQualificationEvidence.result,
    ledger: verified.retainedQualificationEvidence.ledger,
    gate: args.ci.value as Imp24ImplementationCiGateV1,
  }), "Recovery Commit B qualification report Markdown is not the deterministic verified-evidence rendering");
  if (roleSetReady) {
    requireCondition(args.role !== null && verified.roleFreeze !== null,
      "role-ready report mirroring requires the verified role freeze");
    const roleDocsJson = resolve(args.repositoryRoot, "docs/v25/reports/ROLE_ASSIGNMENT_FREEZE_V3_R1.json");
    const roleDocsMarkdown = resolve(args.repositoryRoot, "docs/v25/reports/ROLE_ASSIGNMENT_FREEZE_V3_R1.md");
    requireCondition(readFileSync(roleDocsJson).equals(args.role.bytes),
      "Recovery Commit B role-assignment JSON is not the exact state-freeze mirror");
    requireCondition(readFileSync(roleDocsMarkdown, "utf8") === renderRoleAssignmentFreezeV3Markdown({
      freeze: verified.roleFreeze,
      result: verified.retainedQualificationEvidence.result,
      ledger: verified.retainedQualificationEvidence.ledger,
    }), "Recovery Commit B role-assignment Markdown is not the deterministic verified-evidence rendering");
  }
  return verified.retainedQualificationEvidence.result.roleSetBlockedReason;
}

function changedFiles(repositoryRoot: string, baselineCommit: string, evidenceCommit: string): string[] {
  let tracked: string[];
  try {
    tracked = execFileSync("git", ["diff", "--name-only", baselineCommit, evidenceCommit, "--"], {
      cwd: repositoryRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 64 * 1024 * 1024,
    }).split("\n").map((item) => item.trim()).filter(Boolean);
  } catch (error) {
    throw new Imp24CFinalAttestationError("cannot derive the IMP-24C changed-file inventory", [(error as Error).message]);
  }
  return [...new Set([...tracked, ...Object.values(IMP24C_FINAL_ATTESTATION_PATHS)])].sort();
}

function finalMarkdown(attestation: Omit<Imp24CFinalAttestation, "attestationSha256"> & { attestationSha256: string }): string {
  const role = (value: string | null): string => value === null ? "none" : `\`${value}\``;
  return [
    "# IMP-24C final report",
    "",
    `Final decision: **${attestation.finalDecision}**`,
    "",
    `Successor execution: \`${attestation.executionId}\``,
    `Implementation commit: \`${attestation.implementationCommit}\``,
    `Evidence commit: \`${attestation.evidenceCommit}\``,
    `Attestation SHA-256: \`${attestation.attestationSha256}\``,
    "",
    "## Frozen roles",
    "",
    `- Reader primary: ${role(attestation.roles.readerPrimary)}`,
    `- Reader audit: ${role(attestation.roles.readerAudit)}`,
    `- Source primary: ${role(attestation.roles.sourcePrimary)}`,
    `- Source adjudicator: ${role(attestation.roles.sourceAdjudicator)}`,
    `- Quiz semantic adjudicator: ${role(attestation.roles.quizSemanticAdjudicator)}`,
    `- Deterministic quiz checker: \`${QUIZ_DETERMINISTIC_CHECKER_VERSION}\``,
    "",
    "## Retained execution",
    "",
    `- Canary calls: **${attestation.callCounts.canaryCalls}**`,
    `- Holdout calls: **${attestation.callCounts.holdoutCalls}**`,
    `- Infrastructure replays: **${attestation.callCounts.infrastructureReplays}**`,
    `- Max-plan/provider-capacity events: **${attestation.callCounts.maxPlanEvents}**`,
    `- ChatGPT-authenticated codex exec invocations: **${attestation.callCounts.codexExecInvocations}**`,
    "- API calls: **0**",
    "- Threshold weakening, holdout relabeling, replacement, output-informed resampling, and added retries: **none**",
    "- Pilot, gold, Content Design Score, local SOL activation, publication, promotion, deployment, upload, merge, and force-push: **not run**",
    "",
    "The completed IMP-24B zero-call lifecycle remains closed and immutable. This materializer requires no future commit SHA and performs no model or API call.",
    "",
  ].join("\n");
}

function buildImp24CFinalAttestationInternal(
  options: BuildImp24CFinalAttestationOptions | BuildImp24CFinalAttestationFixtureOptions,
  fixtureToken?: symbol,
): Imp24CFinalAttestationBuild {
  const repositoryRoot = resolve(options.repositoryRoot);
  const artifactRoot = resolve(options.artifactRoot ?? repositoryRoot);
  const fixtureLifecycle = fixtureToken === IMP24C_FINAL_ATTESTATION_FIXTURE_TOKEN;
  if (!fixtureLifecycle) validateProductionFinalInputPaths({ repositoryRoot, artifactRoot, options });
  requireGitSha(options.implementationCommit, "implementation commit");
  requireGitSha(options.evidenceCommit, "evidence commit");
  const baselineCommit = fixtureLifecycle
    ? (options as BuildImp24CFinalAttestationFixtureOptions).lifecycleBaselineCommit
    : IMP24C_STARTING_HEAD;
  requireGitSha(baselineCommit, "lifecycle baseline commit");
  assertCommitExists(repositoryRoot, baselineCommit, "lifecycle baseline commit");
  assertCommitExists(repositoryRoot, options.implementationCommit, "implementation commit");
  assertCommitExists(repositoryRoot, options.evidenceCommit, "evidence commit");
  assertCommitAncestry(repositoryRoot, options.implementationCommit, options.evidenceCommit);
  if (baselineCommit !== options.implementationCommit) {
    assertCommitAncestry(repositoryRoot, baselineCommit, options.implementationCommit);
  }

  const terminal = readArtifact(artifactRoot, options.terminalQualificationResultPath, "terminal qualification result");
  requireSha256(terminal.value.reportSha256, "terminal qualification report self hash");
  const { reportSha256: _reportSha256, ...terminalCore } = terminal.value;
  requireCondition(hashCanonical(terminalCore) === terminal.value.reportSha256,
    "terminal qualification report self hash drift");
  requireCondition(terminal.value.experimentId === IMP24_ROLE_QUALIFICATION_R1_EXECUTION_ID,
    "terminal qualification result belongs to another execution identity");
  validateTerminalCampaignControls(terminal.value, options.implementationCommit);
  if (terminal.value.implementationCommit !== undefined) {
    requireCondition(terminal.value.implementationCommit === options.implementationCommit,
      "terminal qualification result binds another implementation commit");
  }
  if (terminal.value.implementationHeadSha !== undefined) {
    requireCondition(terminal.value.implementationHeadSha === options.implementationCommit,
      "terminal qualification result binds another implementation head");
  }

  const ci = readArtifact(artifactRoot, options.dedicatedCiEvidencePath, "dedicated CI evidence");
  validateDedicatedCiEvidence(ci.value, options.implementationCommit);
  const terminalArtifactBytes = asObject(terminal.value.artifactBytesSha256, "terminal artifact byte hashes");
  requireCondition(terminal.value.implementationCiGateSha256 === ci.value.gateSha256
      && terminalArtifactBytes.implementationCiGate === sha256Hex(ci.bytes),
    "terminal qualification campaign does not bind the exact dedicated CI gate");
  const preliminary = readArtifact(
    artifactRoot,
    options.preliminaryReportPath ?? IMP24C_PRE_LIVE_ARTIFACT_PATHS.implementationReport,
    "preliminary implementation report",
  );
  const preliminaryIssues = validateWorkerReport(preliminary.value);
  requireCondition(preliminaryIssues.length === 0,
    `preliminary implementation report is invalid: ${preliminaryIssues.join("; ")}`);
  requireCondition(preliminary.value.continuationPromptId === "IMP-24C"
    && preliminary.value.implementationCommit === null
    && preliminary.value.evidenceCommit === null,
  "preliminary implementation report has terminal lifecycle values");
  if (!fixtureLifecycle) {
    assertArtifactCommittedAtCommit({
      repositoryRoot,
      commit: options.implementationCommit,
      commitLabel: "Recovery Commit A",
      relativePath: preliminary.relativePath,
      currentBytes: preliminary.bytes,
      label: "preliminary implementation report",
    });
  }
  const closure = readArtifact(
    artifactRoot,
    options.imp24bClosurePath ?? IMP24B_CLOSURE_JSON_REL_PATH,
    "IMP-24B lifecycle closure",
  );
  validateClosure(closure.value);
  if (!fixtureLifecycle) {
    assertArtifactCommittedAtCommit({
      repositoryRoot,
      commit: options.implementationCommit,
      commitLabel: "Recovery Commit A",
      relativePath: closure.relativePath,
      currentBytes: closure.bytes,
      label: "IMP-24B lifecycle closure",
    });
  }

  const roleSetReady = terminalRoleSetReady(terminal.value);
  let role: ReturnType<typeof readArtifact> | null = null;
  let roles: RoleSelection = {
    readerPrimary: null,
    readerAudit: null,
    sourcePrimary: null,
    sourceAdjudicator: null,
    quizSemanticAdjudicator: null,
  };
  if (roleSetReady) {
    requireCondition(typeof options.roleAssignmentPath === "string", "ready role set requires a retained role-assignment path");
    role = readArtifact(artifactRoot, options.roleAssignmentPath, "role-assignment freeze");
    roles = validateRoleAssignment({
      value: role.value,
      bytes: role.bytes,
      terminal: terminal.value,
      ci: ci.value,
      preliminary: preliminary.value,
      implementationCommit: options.implementationCommit,
    });
  } else {
    requireCondition(options.roleAssignmentPath === undefined,
      "blocked role set must not be paired with a role-assignment freeze");
  }
  for (const artifact of [
    { ...terminal, label: "terminal qualification result" },
    { ...ci, label: "dedicated CI evidence" },
    { ...preliminary, label: "preliminary implementation report" },
    { ...closure, label: "IMP-24B lifecycle closure" },
    ...(role === null ? [] : [{ ...role, label: "role-assignment freeze" }]),
  ]) {
    assertArtifactCommittedAtCommit({
      repositoryRoot,
      commit: options.evidenceCommit,
      commitLabel: "Recovery Commit B",
      relativePath: artifact.relativePath,
      currentBytes: artifact.bytes,
      label: artifact.label,
    });
  }
  const counts = terminalCallCounts(terminal.value);
  let verifiedBlockedReason: string | null = null;
  if (!fixtureLifecycle) {
    assertRecoveryBEvidenceOwnership({
      repositoryRoot,
      evidenceCommit: options.evidenceCommit,
      roleSetReady,
    });
    verifiedBlockedReason = validateProductionRetainedQualification({
      repositoryRoot,
      terminal,
      role,
      ci,
      preliminary: preliminary.value,
      implementationCommit: options.implementationCommit,
      counts,
    });
  }
  const blockedReason = roleSetReady
    ? null
    : (verifiedBlockedReason
      ?? (typeof terminal.value.roleSetBlockedReason === "string" && terminal.value.roleSetBlockedReason.length > 0
        ? terminal.value.roleSetBlockedReason
        : "ROLE_SET_NOT_READY"));
  const qualifiedProfiles = Array.isArray(terminal.value.qualifiedProfiles)
    ? terminal.value.qualifiedProfiles.map((value) => {
      requireCondition(typeof value === "string" && value.length > 0,
        "terminal qualifiedProfiles must contain non-empty profile IDs");
      return value;
    })
    : [...new Set(Object.values(roles).filter((value): value is string => value !== null))];
  requireCondition(new Set(qualifiedProfiles).size === qualifiedProfiles.length,
    "terminal qualifiedProfiles contains duplicates");
  requireCondition(canonicalJson(qualifiedProfiles) === canonicalJson([...qualifiedProfiles].sort()),
    "terminal qualifiedProfiles must retain deterministic sorted order");
  requireCondition(Object.values(roles).every((profileId) =>
    profileId === null || qualifiedProfiles.includes(profileId)),
  "terminal fixed roles contain a profile absent from qualifiedProfiles");
  const preLiveCertification = String(preliminary.value.certificationSha256 ?? "");
  const preLiveSeal = String(preliminary.value.productionSealSha256 ?? "");
  const preLiveParity = String(preliminary.value.productionQualificationParitySha256 ?? "");
  for (const [label, value] of [["certification", preLiveCertification], ["production seal", preLiveSeal], ["parity", preLiveParity]] as const) {
    requireCondition(SHA256.test(value), `preliminary ${label} SHA-256 is missing`);
  }

  const testResults = asObject(preliminary.value.testResults, "preliminary test results");
  const report: JsonObject = {
    schema: "worker-implementation-report-v1",
    status: roleSetReady ? "TERMINAL_PASS" : "TERMINAL_BLOCKED",
    promptId: "IMP-24",
    continuationPromptId: "IMP-24C",
    baselineHash: baselineCommit,
    resultHash: sha256Hex(terminal.bytes),
    resultHashKind: "role-qualification-terminal-result-bytes-sha256",
    contractVersions: preliminary.value.contractVersions,
    filesChanged: changedFiles(repositoryRoot, baselineCommit, options.evidenceCommit),
    requirementsImplemented: [
      {
        requirementId: "IMP24C-R01-CONTROL-PLANE-RECOVERY",
        status: "implemented",
        note: "Workflow identity is split into display-name and file-path evidence; pre-live verification is read-only and terminal attestation has a separate owner.",
      },
      {
        requirementId: "IMP24C-R02-EXACT-IMPLEMENTATION-COMMIT-CI",
        status: "implemented",
        note: "The retained dedicated V25 gate binds the exact Recovery Commit A SHA.",
      },
      roleSetReady ? {
        requirementId: "IMP24C-R03-V3-R1-LIVE-ROLE-QUALIFICATION",
        status: "implemented",
        note: "The first valid role set under the frozen candidate order and thresholds is retained and fixed.",
      } : {
        requirementId: "IMP24C-R03-V3-R1-LIVE-ROLE-QUALIFICATION",
        status: "deferred",
        deferredTo: blockedReason ?? "The retained terminal qualification blocker.",
      },
    ],
    testsRequired: preliminary.value.testsRequired,
    testsRun: preliminary.value.testsRun,
    testResults,
    gateChanges: [],
    bookSpecificExceptions: [],
    unexpectedWrites: [],
    unresolvedRisks: roleSetReady ? [] : [blockedReason ?? "ROLE_SET_NOT_READY"],
    dependencyAssumptions: [
      "Recovery Commit A and Recovery Commit B are explicit inputs; the future Recovery Commit C SHA is neither required nor written.",
      "The retained IMP-24B closure is authoritative for the immutable zero-call predecessor lifecycle.",
    ],
    branch: IMP24B_BRANCH,
    draftPr: IMP24B_DRAFT_PR,
    startingLocalHead: IMP24C_STARTING_HEAD,
    startingRemoteHead: IMP24C_STARTING_HEAD,
    implementationCommit: options.implementationCommit,
    evidenceCommit: options.evidenceCommit,
    experimentId: IMP24_ROLE_QUALIFICATION_R1_EXECUTION_ID,
    finalDecision: roleSetReady ? "PASS" : "BLOCKED",
    roleSetReady,
    readerPrimary: roles.readerPrimary,
    readerAudit: roles.readerAudit,
    sourcePrimary: roles.sourcePrimary,
    sourceAdjudicator: roles.sourceAdjudicator,
    quizSemanticAdjudicator: roles.quizSemanticAdjudicator,
    deterministicQuizChecker: QUIZ_DETERMINISTIC_CHECKER_VERSION,
    fixedRoleAssignments: roles,
    qualifiedProfiles,
    certificationSha256: preLiveCertification,
    productionSealSha256: preLiveSeal,
    productionQualificationParitySha256: preLiveParity,
    canaryCorpusHashes: preliminary.value.canaryCorpusHashes,
    holdoutCorpusHashes: preliminary.value.holdoutCorpusHashes,
    canaryCalls: counts.canaryCalls,
    holdoutCalls: counts.holdoutCalls,
    infrastructureReplays: counts.infrastructureReplays,
    maxPlanEvents: counts.maxPlanEvents,
    codexExecInvocations: counts.codexExecInvocations,
    liveModelCallsMade: counts.codexExecInvocations,
    apiCallsMade: 0,
    apiCalls: 0,
    dedicatedV25CiImplementationCommit: options.implementationCommit,
    dedicatedV25CiGateSha256: String(ci.value.gateSha256 ?? sha256Hex(ci.bytes)),
    gateWeakening: false,
    holdoutRelabeling: false,
    outputInformedResampling: false,
    unavailableProfilesReplaced: false,
    retriesAdded: false,
    unboundedRetries: false,
    pilotRun: false,
    goldRun: false,
    localSolActivation: false,
    publishActivated: false,
    promoteActivated: false,
    deploymentActivated: false,
    uploadActivated: false,
    mainMerged: false,
    forcePush: false,
    supersededImp24BLifecycle: {
      closurePath: closure.relativePath,
      closureBytesSha256: sha256Hex(closure.bytes),
      implementationCommit: closure.value.implementationCommit,
      terminalEvidenceCommit: closure.value.terminalEvidenceCommit,
      terminalAttestationCommit: closure.value.terminalAttestationCommit,
      disposition: closure.value.disposition,
      mayResume: false,
    },
    inputArtifactBindings: {
      terminalQualificationResult: { path: terminal.relativePath, bytesSha256: sha256Hex(terminal.bytes) },
      roleAssignment: role === null ? null : { path: role.relativePath, bytesSha256: sha256Hex(role.bytes) },
      dedicatedCiEvidence: { path: ci.relativePath, bytesSha256: sha256Hex(ci.bytes) },
      preliminaryReport: { path: preliminary.relativePath, bytesSha256: sha256Hex(preliminary.bytes) },
    },
  };
  const reportIssues = validateWorkerReport(report);
  requireCondition(reportIssues.length === 0, `built final implementation report is invalid: ${reportIssues.join("; ")}`);
  const implementationReportBytes = canonicalPretty(report);

  const attestationCore: Omit<Imp24CFinalAttestation, "attestationSha256"> = {
    schema: IMP24C_FINAL_ATTESTATION_SCHEMA,
    promptId: "IMP-24",
    continuationPromptId: "IMP-24C",
    executionId: IMP24_ROLE_QUALIFICATION_R1_EXECUTION_ID,
    lifecycleBaselineCommit: baselineCommit,
    implementationCommit: options.implementationCommit,
    evidenceCommit: options.evidenceCommit,
    finalDecision: roleSetReady ? "PASS" : "BLOCKED",
    roleSetReady,
    roles,
    qualifiedProfiles,
    deterministicQuizChecker: QUIZ_DETERMINISTIC_CHECKER_VERSION,
    certificationSha256: preLiveCertification,
    productionSealSha256: preLiveSeal,
    productionQualificationParitySha256: preLiveParity,
    callCounts: counts,
    qualificationResult: {
      status: roleSetReady ? "ROLE_SET_READY" : "ROLE_SET_NOT_READY",
      blockedReason,
      terminalResultBytesSha256: sha256Hex(terminal.bytes),
      roleAssignmentBytesSha256: role === null ? null : sha256Hex(role.bytes),
    },
    controls: {
      thresholdsWeakened: false,
      holdoutsRelabeled: false,
      unavailableProfilesReplaced: false,
      outputInformedResampling: false,
      retriesAdded: false,
      apiFallbackAllowed: false,
      directHttpOrSdkAllowed: false,
    },
    remainingRisks: roleSetReady ? [] : [blockedReason ?? "ROLE_SET_NOT_READY"],
    stopBoundary: {
      pilotRun: false,
      goldRun: false,
      contentDesignScoreRun: false,
      localSolActivation: false,
      publish: false,
      promote: false,
      deploy: false,
      upload: false,
      merge: false,
      forcePush: false,
    },
    inputs: {
      terminalQualificationResultPath: terminal.relativePath,
      roleAssignmentPath: role?.relativePath ?? null,
      dedicatedCiEvidencePath: ci.relativePath,
      preliminaryReportPath: preliminary.relativePath,
      imp24bClosurePath: closure.relativePath,
    },
    inputBytesSha256: {
      terminalQualificationResult: sha256Hex(terminal.bytes),
      roleAssignment: role === null ? null : sha256Hex(role.bytes),
      dedicatedCiEvidence: sha256Hex(ci.bytes),
      preliminaryReport: sha256Hex(preliminary.bytes),
      imp24bClosure: sha256Hex(closure.bytes),
    },
    terminalReportBytesSha256: sha256Hex(implementationReportBytes),
    supersededImp24B: {
      implementationCommit: String(closure.value.implementationCommit),
      terminalEvidenceCommit: String(closure.value.terminalEvidenceCommit),
      terminalAttestationCommit: String(closure.value.terminalAttestationCommit),
      disposition: String(closure.value.disposition),
      mayResume: false,
      liveCalls: 0,
      apiCalls: 0,
      closureBytesSha256: sha256Hex(closure.bytes),
    },
    modelCalls: counts.codexExecInvocations,
    apiCalls: 0,
  };
  const attestation: Imp24CFinalAttestation = {
    ...attestationCore,
    attestationSha256: hashCanonical(attestationCore),
  };
  const outputs = {
    implementationReport: {
      relativePath: IMP24C_FINAL_ATTESTATION_PATHS.implementationReport,
      bytes: implementationReportBytes,
      bytesSha256: sha256Hex(implementationReportBytes),
    },
    attestationJson: {
      relativePath: IMP24C_FINAL_ATTESTATION_PATHS.attestationJson,
      bytes: canonicalPretty(attestation),
      bytesSha256: sha256Hex(canonicalPretty(attestation)),
    },
    attestationMarkdown: {
      relativePath: IMP24C_FINAL_ATTESTATION_PATHS.attestationMarkdown,
      bytes: finalMarkdown(attestation),
      bytesSha256: sha256Hex(finalMarkdown(attestation)),
    },
  };
  return { attestation, implementationReport: report, outputs, modelCalls: 0, apiCalls: 0 };
}

export function buildImp24CFinalAttestation(
  options: BuildImp24CFinalAttestationOptions,
): Imp24CFinalAttestationBuild {
  return buildImp24CFinalAttestationInternal(options);
}

export function buildImp24CFinalAttestationForFixture(
  options: BuildImp24CFinalAttestationFixtureOptions,
): Imp24CFinalAttestationBuild {
  return buildImp24CFinalAttestationInternal(options, IMP24C_FINAL_ATTESTATION_FIXTURE_TOKEN);
}

function materializeImp24CFinalAttestationInternal(
  options: BuildImp24CFinalAttestationOptions | BuildImp24CFinalAttestationFixtureOptions,
  fixtureToken?: symbol,
): Imp24CFinalAttestationMaterialization {
  const built = buildImp24CFinalAttestationInternal(options, fixtureToken);
  const artifactRoot = resolve(options.artifactRoot ?? options.repositoryRoot);
  const outputs = {} as Imp24CFinalAttestationMaterialization["outputs"];
  for (const [key, item] of Object.entries(built.outputs) as Array<[
    keyof typeof IMP24C_FINAL_ATTESTATION_PATHS,
    { relativePath: string; bytes: string; bytesSha256: string },
  ]>) {
    const absolutePath = resolve(artifactRoot, item.relativePath);
    writeFileAtomic(absolutePath, item.bytes);
    const retained = readFileSync(absolutePath);
    requireCondition(retained.toString("utf8") === item.bytes && sha256Hex(retained) === item.bytesSha256,
      `${key}: terminal artifact atomic read-back mismatch`);
    outputs[key] = {
      relativePath: item.relativePath,
      absolutePath,
      bytesSha256: item.bytesSha256,
      bytes: retained.length,
    };
  }
  return {
    schema: "imp24c-final-attestation-materialization-v1",
    attestationSha256: built.attestation.attestationSha256,
    outputs,
    writes: 3,
    modelCalls: 0,
    apiCalls: 0,
  };
}

export function materializeImp24CFinalAttestation(
  options: BuildImp24CFinalAttestationOptions,
): Imp24CFinalAttestationMaterialization {
  return materializeImp24CFinalAttestationInternal(options);
}

export function materializeImp24CFinalAttestationForFixture(
  options: BuildImp24CFinalAttestationFixtureOptions,
): Imp24CFinalAttestationMaterialization {
  return materializeImp24CFinalAttestationInternal(options, IMP24C_FINAL_ATTESTATION_FIXTURE_TOKEN);
}

function verifyImp24CFinalAttestationInternal(
  options: BuildImp24CFinalAttestationOptions | BuildImp24CFinalAttestationFixtureOptions,
  fixtureToken?: symbol,
): Imp24CFinalAttestationVerification {
  const built = buildImp24CFinalAttestationInternal(options, fixtureToken);
  const artifactRoot = resolve(options.artifactRoot ?? options.repositoryRoot);
  for (const [key, item] of Object.entries(built.outputs)) {
    const absolutePath = resolve(artifactRoot, item.relativePath);
    requireCondition(existsSync(absolutePath), `${key}: committed terminal artifact is missing`);
    const retained = readFileSync(absolutePath);
    requireCondition(retained.toString("utf8") === item.bytes,
      `${key}: committed terminal artifact differs byte-for-byte from deterministic materialization`);
    requireCondition(sha256Hex(retained) === item.bytesSha256,
      `${key}: committed terminal artifact bytes hash drift`);
  }
  return {
    schema: "imp24c-final-attestation-verification-v1",
    status: "VERIFIED_BYTE_IDENTICAL_TERMINAL_ATTESTATION",
    attestationSha256: built.attestation.attestationSha256,
    verifiedOutputCount: 3,
    writes: 0,
    modelCalls: 0,
    apiCalls: 0,
  };
}

export function verifyImp24CFinalAttestation(
  options: BuildImp24CFinalAttestationOptions,
): Imp24CFinalAttestationVerification {
  return verifyImp24CFinalAttestationInternal(options);
}

export function verifyImp24CFinalAttestationForFixture(
  options: BuildImp24CFinalAttestationFixtureOptions,
): Imp24CFinalAttestationVerification {
  return verifyImp24CFinalAttestationInternal(options, IMP24C_FINAL_ATTESTATION_FIXTURE_TOKEN);
}

/** Reconstruct verification inputs from the retained self-hashed attestation.
 * This is the no-argument path used by dedicated CI on Recovery Commit C. */
export function verifyRetainedImp24CFinalAttestation(args: {
  repositoryRoot: string;
  artifactRoot?: string;
}): Imp24CFinalAttestationVerification {
  const artifactRoot = resolve(args.artifactRoot ?? args.repositoryRoot);
  const retainedPath = resolve(artifactRoot, IMP24C_FINAL_ATTESTATION_PATHS.attestationJson);
  requireCondition(existsSync(retainedPath), "retained IMP-24C final attestation is missing");
  const retained = parseJson(readFileSync(retainedPath), "retained IMP-24C final attestation") as Imp24CFinalAttestation;
  requireCondition(retained.schema === IMP24C_FINAL_ATTESTATION_SCHEMA, "retained final attestation schema mismatch");
  const { attestationSha256, ...core } = retained;
  requireCondition(SHA256.test(attestationSha256) && hashCanonical(core) === attestationSha256,
    "retained final attestation self hash drift");
  requireCondition(retained.lifecycleBaselineCommit === IMP24C_STARTING_HEAD,
    "retained final attestation cannot substitute the production lifecycle baseline");
  const ci = readArtifact(
    artifactRoot,
    retained.inputs.dedicatedCiEvidencePath,
    "retained dedicated CI evidence",
  );
  reverifyImp24ImplementationCiGateLive({
    repositoryRoot: args.repositoryRoot,
    gate: ci.value as Imp24ImplementationCiGateV1,
  });
  return verifyImp24CFinalAttestation({
    repositoryRoot: args.repositoryRoot,
    artifactRoot,
    implementationCommit: retained.implementationCommit,
    evidenceCommit: retained.evidenceCommit,
    terminalQualificationResultPath: retained.inputs.terminalQualificationResultPath,
    ...(retained.inputs.roleAssignmentPath === null ? {} : { roleAssignmentPath: retained.inputs.roleAssignmentPath }),
    dedicatedCiEvidencePath: retained.inputs.dedicatedCiEvidencePath,
    preliminaryReportPath: retained.inputs.preliminaryReportPath,
    imp24bClosurePath: retained.inputs.imp24bClosurePath,
  });
}

export function verifyRetainedImp24CFinalAttestationForFixture(args: {
  repositoryRoot: string;
  artifactRoot?: string;
}): Imp24CFinalAttestationVerification {
  const artifactRoot = resolve(args.artifactRoot ?? args.repositoryRoot);
  const retainedPath = resolve(artifactRoot, IMP24C_FINAL_ATTESTATION_PATHS.attestationJson);
  requireCondition(existsSync(retainedPath), "retained IMP-24C fixture attestation is missing");
  const retained = parseJson(readFileSync(retainedPath), "retained IMP-24C fixture attestation") as Imp24CFinalAttestation;
  const { attestationSha256, ...core } = retained;
  requireCondition(retained.schema === IMP24C_FINAL_ATTESTATION_SCHEMA
      && SHA256.test(attestationSha256)
      && hashCanonical(core) === attestationSha256,
    "retained fixture attestation self hash drift");
  return verifyImp24CFinalAttestationForFixture({
    repositoryRoot: args.repositoryRoot,
    artifactRoot,
    implementationCommit: retained.implementationCommit,
    evidenceCommit: retained.evidenceCommit,
    terminalQualificationResultPath: retained.inputs.terminalQualificationResultPath,
    ...(retained.inputs.roleAssignmentPath === null ? {} : { roleAssignmentPath: retained.inputs.roleAssignmentPath }),
    dedicatedCiEvidencePath: retained.inputs.dedicatedCiEvidencePath,
    preliminaryReportPath: retained.inputs.preliminaryReportPath,
    imp24bClosurePath: retained.inputs.imp24bClosurePath,
    lifecycleBaselineCommit: retained.lifecycleBaselineCommit,
  });
}
