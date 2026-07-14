/**
 * IMP-24D deterministic terminal-attestation lifecycle.
 *
 * This module owns only the three IMP-24D terminal outputs. It never invokes a
 * model, creates qualification evidence, materializes a smoke run, or touches
 * the historical IMP-24B/IMP-24C lifecycle artifacts. Production entrypoints
 * accept only the two non-self-referential Git identities: the effective
 * implementation commit and the later evidence commit.
 */

import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";

import { canonicalJson, hashCanonical, sha256Hex } from "../../contracts/contractUtil.js";
import { validateWorkerReport } from "../../contracts/workerReport.js";
import { writeFileAtomic } from "../../lib/atomicWrite.js";
import {
  IMP24_ROLE_QUALIFICATION_R1_EXECUTION_ID,
  IMP24_ROLE_QUALIFICATION_R2_EXECUTION_ID,
} from "./imp24Corpus.js";
import {
  IMP24D_BRANCH,
  IMP24D_DRAFT_PR,
  IMP24D_OBSERVABILITY_FREEZE_PATHS,
  IMP24D_R1_CLOSURE_PATHS,
  IMP24D_STARTING_HEAD,
  validateImp24DObservabilityFreeze,
  verifyHistoricalImp24DObservabilityFreeze,
  type Imp24DObservabilityFreeze,
} from "./imp24ObservabilityFreeze.js";
import {
  IMP24D_R2_QUALIFICATION_FIXED_PATHS,
  IMP24_PILOT_GOLD_FIXED_PATHS,
  verifyImp24DR2RetainedQualificationForFinalAttestationV3,
  type LoadedImp24TerminalQualification,
} from "./imp24PilotGoldWorkflow.js";
import { buildLegacyRoleQualificationPlanV3 } from "./roleQualificationRunnerV3.js";
import { canonicalPretty } from "./corpusBuilderCore.js";
import { QUIZ_DETERMINISTIC_CHECKER_VERSION } from "./reviewerRoleAssignment.js";
import {
  IMP24_IMPLEMENTATION_CI_GATE_SCHEMA,
  renderRoleAssignmentFreezeV3Markdown,
  renderRoleQualificationV3LiveResultMarkdown,
  reverifyImp24ImplementationCiGateLive,
  validateImp24ImplementationCiGate,
  type Imp24ImplementationCiGateV1,
} from "../../orchestrator/forwardRoleQualificationCampaignV3.js";
import type { ForwardRoleAssignmentFreezeV3 } from "../../orchestrator/forwardRoleAssignmentFreezeV3.js";
import {
  IMP24D_TRANSPORT_SMOKE_EXECUTION_ID,
  IMP24D_TRANSPORT_SMOKE_R2_EXECUTION_ID,
  IMP24D_TRANSPORT_SMOKE_REPORT_JSON_REL_PATH,
  IMP24D_TRANSPORT_SMOKE_REPORT_MARKDOWN_REL_PATH,
  verifyRetainedImp24DTransportSmoke,
} from "../../orchestrator/forwardTransportSmokeEvidenceV3.js";
import {
  IMP24D_DETERMINISTIC_REMINT_FILES,
  assertImp24DBoundedCorrectionCommit,
  imp24DQualificationSemanticProjectionSha256,
  type Imp24DTransportSemanticCallBindingV1,
} from "../../orchestrator/forwardTransportSmokeCorrectionV3.js";

export const IMP24D_FINAL_ATTESTATION_SCHEMA = "imp24d-final-attestation-v1" as const;
export const IMP24D_FINAL_ATTESTATION_PATHS = Object.freeze({
  implementationReport: "docs/v25/reports/implementation-report.imp-24d.json",
  attestationJson: "docs/v25/reports/IMP-24D_FINAL_REPORT.json",
  attestationMarkdown: "docs/v25/reports/IMP-24D_FINAL_REPORT.md",
});

export const IMP24D_TRANSPORT_SMOKE_REPORT_PATHS = Object.freeze({
  json: IMP24D_TRANSPORT_SMOKE_REPORT_JSON_REL_PATH,
  markdown: IMP24D_TRANSPORT_SMOKE_REPORT_MARKDOWN_REL_PATH,
});

export const IMP24D_R2_REPORT_PATHS = Object.freeze({
  qualificationJson: "docs/v25/reports/ROLE_QUALIFICATION_V3_R2_LIVE_RESULT.json",
  qualificationMarkdown: "docs/v25/reports/ROLE_QUALIFICATION_V3_R2_LIVE_RESULT.md",
  roleAssignmentJson: "docs/v25/reports/ROLE_ASSIGNMENT_FREEZE_V3_R2.json",
  roleAssignmentMarkdown: "docs/v25/reports/ROLE_ASSIGNMENT_FREEZE_V3_R2.md",
});

const PIPELINE_REL = "scripts/book/prompts/chapterflow-v24-author-pipeline";
const EXPERIMENTS_REL = `${PIPELINE_REL}/state/migration-experiments`;
const QUALIFICATION_ROOT_REL = `${EXPERIMENTS_REL}/${IMP24_ROLE_QUALIFICATION_R2_EXECUTION_ID}`;
const SMOKE_ROOT_REL = `${EXPERIMENTS_REL}/${IMP24D_TRANSPORT_SMOKE_EXECUTION_ID}`;
const SMOKE_R2_ROOT_REL = `${EXPERIMENTS_REL}/${IMP24D_TRANSPORT_SMOKE_R2_EXECUTION_ID}`;
const QUALIFICATION_REPORT_REL = `${QUALIFICATION_ROOT_REL}/qualification-report.json`;
const ROLE_ASSIGNMENT_REL = `${QUALIFICATION_ROOT_REL}/role-assignment-freeze.json`;
const IMPLEMENTATION_CI_GATE_REL = `${QUALIFICATION_ROOT_REL}/implementation-ci-gate.json`;
const DETERMINISTIC_REMINT_FILES = IMP24D_DETERMINISTIC_REMINT_FILES;

const GIT_SHA = /^[a-f0-9]{40}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const SHA256_TAGGED = /^sha256:[a-f0-9]{64}$/;

type JsonObject = Record<string, unknown>;
type RoleSelection = {
  readerPrimary: string | null;
  readerAudit: string | null;
  sourcePrimary: string | null;
  sourceAdjudicator: string | null;
  quizSemanticAdjudicator: string | null;
};

export type Imp24DTransportSmokeCycleBinding = {
  executionId: string;
  stateRoot: string;
  implementationCommit: string;
  workflowRunId: number;
  implementationCiGateSha256: string;
  implementationCiGateBytesSha256: string;
  calls: 2;
  codexExecInvocations: number;
  processDiagnosticsSetSha256: string;
  qualificationSemanticProjectionSha256: string;
  certificationSha256: string;
  productionInstrumentSealSha256: string;
  productionQualificationParitySha256: string;
  result: "PASS" | "FAIL";
  implementationCiVerifiedAt: string;
  startedAt: string;
  completedAt: string;
};

export type Imp24DTransportSmokeBinding = {
  status: "PASS";
  reportPath: string;
  reportBytesSha256: string;
  markdownPath: string;
  markdownBytesSha256: string;
  observabilityImplementationCommit: string;
  correctionCommit: string | null;
  effectiveImplementationCommit: string;
  cycles: Imp24DTransportSmokeCycleBinding[];
  totalCalls: 2 | 4;
  processDiagnosticsSetSha256: string;
  /** A failed first cycle can cross zero, one, or two runner boundaries; the
   * final passing cycle always contributes exactly two. */
  modelCalls: 2 | 3 | 4;
  apiCalls: 0;
};

export type Imp24DQualificationBinding = {
  status: "ROLE_SET_READY" | "ROLE_SET_NOT_READY";
  blockedReason: string | null;
  root: string;
  terminalReportPath: string;
  terminalReportBytesSha256: string;
  terminalReportSha256: string;
  roleAssignmentPath: string | null;
  roleAssignmentBytesSha256: string | null;
  roleAssignmentFreezeSha256: string | null;
  implementationCiGatePath: string;
  implementationCiGateSha256: string;
  implementationCiGateBytesSha256: string;
  qualificationResultSha256: string;
  qualificationFreezeSha256: string;
  callLedgerSha256: string;
  callLedgerBytesSha256: string;
  attemptEvidenceSetSha256: string;
  processDiagnosticsSetSha256: string;
  preflightVerifiedAt: string;
  earliestRequestAt: string;
  attemptIds: string[];
  roles: RoleSelection;
  qualifiedProfiles: string[];
  certificationSha256: string;
  productionSealSha256: string;
  productionQualificationParitySha256: string;
  qualificationSemanticProjectionSha256: string;
  corpusBundleSha256: string;
  thresholdsSha256: string;
  promptSourceHashesSha256: string;
  schemaHashesSha256: string;
  routeBindingSha256: string;
  roleAssignmentPolicySha256: string | null;
  callCounts: {
    canaryCalls: number;
    holdoutCalls: number;
    infrastructureReplays: number;
    maxPlanEvents: number;
    totalAttempts: number;
    codexExecInvocations: number;
    apiCalls: 0;
  };
};

export type Imp24DFinalEvidence = {
  observabilityFreeze: {
    path: string;
    bytesSha256: string;
    markdownPath: string;
    markdownBytesSha256: string;
    freezeSha256: string;
    productionSealSha256: string;
    certificationSha256: string;
    productionQualificationParitySha256: string;
    frozenSemanticsSha256: string;
  };
  historicalR1: {
    executionId: typeof IMP24_ROLE_QUALIFICATION_R1_EXECUTION_ID;
    disposition: "BLOCKED_OBSERVABILITY_INCOMPLETE";
    mayResume: false;
    mayQualifyProfiles: false;
    jsonPath: string;
    jsonBytesSha256: string;
    markdownPath: string;
    markdownBytesSha256: string;
  };
  transportSmoke: Imp24DTransportSmokeBinding;
  qualification: Imp24DQualificationBinding;
  evidenceRoots: string[];
  evidenceFiles: string[];
  evidenceInventories: Record<string, string[]>;
};

export type Imp24DFinalAttestation = {
  schema: typeof IMP24D_FINAL_ATTESTATION_SCHEMA;
  promptId: "IMP-24";
  continuationPromptId: "IMP-24D";
  executionId: typeof IMP24_ROLE_QUALIFICATION_R2_EXECUTION_ID;
  branch: typeof IMP24D_BRANCH;
  draftPullRequest: typeof IMP24D_DRAFT_PR;
  startingHead: typeof IMP24D_STARTING_HEAD;
  observabilityImplementationCommit: string;
  mechanicalCorrectionCommit: string | null;
  effectiveImplementationCommit: string;
  evidenceCommit: string;
  finalDecision: "PASS" | "BLOCKED";
  roleSetReady: boolean;
  roles: RoleSelection;
  deterministicQuizChecker: typeof QUIZ_DETERMINISTIC_CHECKER_VERSION;
  qualifiedProfiles: string[];
  instrument: {
    observabilityFreezeSha256: string;
    observabilityFreezeBytesSha256: string;
    observabilityFrozenSemanticsSha256: string;
    qualificationSemanticProjectionSha256: string;
    original: {
      certificationSha256: string;
      productionSealSha256: string;
      productionQualificationParitySha256: string;
    };
    effective: {
      certificationSha256: string;
      productionSealSha256: string;
      productionQualificationParitySha256: string;
    };
    corpusBundleSha256: string;
    thresholdsSha256: string;
    promptSourceHashesSha256: string;
    schemaHashesSha256: string;
  };
  historicalR1: Imp24DFinalEvidence["historicalR1"];
  transportSmoke: Imp24DTransportSmokeBinding;
  qualification: Omit<Imp24DQualificationBinding, "roles" | "qualifiedProfiles">;
  controls: {
    thresholdsWeakened: false;
    holdoutsRelabeled: false;
    unavailableProfilesReplaced: false;
    candidateOrderChanged: false;
    outputInformedResampling: false;
    retriesAdded: false;
    apiFallbackAllowed: false;
    directHttpOrSdkAllowed: false;
  };
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
  inputBytesSha256: {
    observabilityFreeze: string;
    observabilityFreezeMarkdown: string;
    r1ClosureJson: string;
    r1ClosureMarkdown: string;
    transportSmokeReport: string;
    transportSmokeMarkdown: string;
    terminalQualificationReport: string;
    roleAssignmentFreeze: string | null;
    implementationCiGate: string;
    evidenceInventory: string;
  };
  modelCalls: number;
  apiCalls: 0;
  attestationSha256: string;
};

export type BuildImp24DFinalAttestationOptions = {
  repositoryRoot: string;
  artifactRoot?: string;
  implementationCommit: string;
  evidenceCommit: string;
};

export type BuildImp24DFinalAttestationFixtureOptions = BuildImp24DFinalAttestationOptions & {
  lifecycleBaselineCommit: string;
  evidence: Imp24DFinalEvidence;
  /** Explicit fixture seam. All three fixed forbidden roots are mandatory. */
  forbiddenRunRoots: readonly string[];
};

export type Imp24DFinalAttestationBuild = {
  attestation: Imp24DFinalAttestation;
  implementationReport: JsonObject;
  outputs: Record<keyof typeof IMP24D_FINAL_ATTESTATION_PATHS, {
    relativePath: string;
    bytes: string;
    bytesSha256: string;
  }>;
  modelCalls: 0;
  apiCalls: 0;
};

export type Imp24DFinalAttestationMaterialization = {
  schema: "imp24d-final-attestation-materialization-v1";
  attestationSha256: string;
  outputs: Record<keyof typeof IMP24D_FINAL_ATTESTATION_PATHS, {
    relativePath: string;
    absolutePath: string;
    bytesSha256: string;
    bytes: number;
  }>;
  writes: 3;
  modelCalls: 0;
  apiCalls: 0;
};

export type Imp24DFinalAttestationVerification = {
  schema: "imp24d-final-attestation-verification-v1";
  status: "VERIFIED_BYTE_IDENTICAL_IMP24D_FINAL_ATTESTATION";
  attestationSha256: string;
  verifiedOutputCount: 3;
  writes: 0;
  modelCalls: 0;
  apiCalls: 0;
};

export class Imp24DFinalAttestationError extends Error {
  readonly classification = "STATE_OR_PROVENANCE" as const;
  constructor(message: string, readonly details: string[] = []) {
    super(message);
    this.name = "Imp24DFinalAttestationError";
  }
}

const FIXTURE_TOKEN = Symbol("imp24d-final-attestation-fixture");

function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Imp24DFinalAttestationError(message);
}

function requireSha(value: unknown, label: string): asserts value is string {
  requireCondition(typeof value === "string" && SHA256.test(value), `${label} must be a lowercase SHA-256`);
}

function requireGitSha(value: unknown, label: string): asserts value is string {
  requireCondition(typeof value === "string" && GIT_SHA.test(value), `${label} must be an exact lowercase 40-character Git SHA`);
}

function asObject(value: unknown, label: string): JsonObject {
  requireCondition(value !== null && typeof value === "object" && !Array.isArray(value), `${label} must be an object`);
  return value as JsonObject;
}

function parseJson(bytes: Buffer, label: string): JsonObject {
  try {
    return asObject(JSON.parse(bytes.toString("utf8")), label);
  } catch (error) {
    if (error instanceof Imp24DFinalAttestationError) throw error;
    throw new Imp24DFinalAttestationError(`${label} is not valid JSON`, [(error as Error).message]);
  }
}

function safeRelativePath(root: string, path: string, label: string): string {
  requireCondition(path.trim().length > 0 && !isAbsolute(path), `${label} must be repository-relative`);
  const rel = relative(root, resolve(root, path)).replace(/\\/g, "/");
  requireCondition(rel !== "" && rel !== ".." && !rel.startsWith("../"), `${label} escapes the repository root`);
  return rel;
}

function assertForbiddenRunRootsAbsent(repositoryRoot: string, roots: readonly string[]): void {
  for (const root of roots) {
    const absoluteRoot = isAbsolute(root) ? resolve(root) : resolve(repositoryRoot, root);
    const relativeRoot = relative(repositoryRoot, absoluteRoot).replace(/\\/g, "/");
    requireCondition(relativeRoot !== "" && relativeRoot !== ".." && !relativeRoot.startsWith("../"),
      `forbidden run root escapes the repository: ${root}`);
    requireCondition(!existsSync(absoluteRoot),
      `IMP-24D stop boundary violated; forbidden pilot/gold/activation root exists: ${relativeRoot}`);
  }
}

function readArtifact(root: string, path: string, label: string): { relativePath: string; bytes: Buffer; value: JsonObject } {
  const relativePath = safeRelativePath(root, path, label);
  const absolutePath = resolve(root, relativePath);
  requireCondition(existsSync(absolutePath), `${label} is missing: ${relativePath}`);
  const bytes = readFileSync(absolutePath);
  return { relativePath, bytes, value: parseJson(bytes, label) };
}

function assertCommitExists(root: string, sha: string, label: string): void {
  try {
    execFileSync("git", ["cat-file", "-e", `${sha}^{commit}`], { cwd: root, stdio: ["ignore", "ignore", "pipe"] });
  } catch {
    throw new Imp24DFinalAttestationError(`${label} is not a known commit: ${sha}`);
  }
}

function assertAncestor(root: string, ancestor: string, descendant: string, label: string, strict = false): void {
  if (strict) requireCondition(ancestor !== descendant, `${label} requires two distinct commits`);
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", ancestor, descendant], {
      cwd: root,
      stdio: ["ignore", "ignore", "pipe"],
    });
  } catch {
    throw new Imp24DFinalAttestationError(`${label}: ${ancestor} is not an ancestor of ${descendant}`);
  }
}

function assertDirectChild(root: string, parent: string, child: string, label: string): void {
  const parents = execFileSync("git", ["rev-list", "--parents", "-n", "1", child], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim().split(/\s+/).slice(1);
  requireCondition(parents.length === 1 && parents[0] === parent,
    `${label}: ${child} must be the single-parent direct child of ${parent}`);
}

function currentHead(root: string): string {
  const head = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
  requireGitSha(head, "current final-attestation checkout HEAD");
  return head;
}

function currentTreeFiles(repositoryRoot: string, rootPath: string): string[] {
  const relativeRoot = safeRelativePath(repositoryRoot, rootPath, "evidence root");
  const absoluteRoot = resolve(repositoryRoot, relativeRoot);
  requireCondition(existsSync(absoluteRoot), `required evidence root is missing: ${relativeRoot}`);
  const out: string[] = [];
  const visit = (directory: string): void => {
    for (const name of readdirSync(directory).sort()) {
      const absolutePath = resolve(directory, name);
      const stat = lstatSync(absolutePath);
      requireCondition(!stat.isSymbolicLink(), `evidence contains a symlink: ${absolutePath}`);
      if (stat.isDirectory()) visit(absolutePath);
      else {
        requireCondition(stat.isFile(), `evidence contains a non-file entry: ${absolutePath}`);
        out.push(relative(repositoryRoot, absolutePath).replace(/\\/g, "/"));
      }
    }
  };
  visit(absoluteRoot);
  return out.sort();
}

function committedTreeFiles(repositoryRoot: string, commit: string, rootPath: string): string[] {
  return execFileSync("git", ["ls-tree", "-r", "--name-only", commit, "--", rootPath], {
    cwd: repositoryRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 64 * 1024 * 1024,
  }).split("\n").map((item) => item.trim()).filter(Boolean).sort();
}

function assertCommittedBytes(repositoryRoot: string, commit: string, relativePath: string, label: string): void {
  const currentPath = resolve(repositoryRoot, safeRelativePath(repositoryRoot, relativePath, label));
  requireCondition(existsSync(currentPath), `${label} is missing: ${relativePath}`);
  let committed: Buffer;
  try {
    committed = execFileSync("git", ["show", `${commit}:${relativePath}`], {
      cwd: repositoryRoot,
      encoding: "buffer",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (error) {
    throw new Imp24DFinalAttestationError(`${label} is not a committed blob at Evidence Commit: ${relativePath}`, [
      (error as Error).message,
    ]);
  }
  requireCondition(committed.equals(readFileSync(currentPath)), `${label} differs from Evidence Commit: ${relativePath}`);
}

function assertEvidenceOwnership(repositoryRoot: string, evidenceCommit: string, evidence: Imp24DFinalEvidence): void {
  for (const root of [...new Set(evidence.evidenceRoots)].sort()) {
    const current = currentTreeFiles(repositoryRoot, root);
    const committed = committedTreeFiles(repositoryRoot, evidenceCommit, root);
    const expected = evidence.evidenceInventories[root];
    requireCondition(Array.isArray(expected)
        && canonicalJson(current) === canonicalJson(expected)
        && canonicalJson(committed) === canonicalJson(expected),
      `evidence root inventory is not exact at the Evidence Commit: ${root}`);
    for (const path of current) assertCommittedBytes(repositoryRoot, evidenceCommit, path, "retained evidence");
  }
  for (const path of [...new Set(evidence.evidenceFiles)].sort()) {
    assertCommittedBytes(repositoryRoot, evidenceCommit, path, "retained evidence report");
  }
}

const ATTEMPT_FILES = [
  "evaluation.json", "evidence-envelope.json", "execution-evidence.json", "process-diagnostics.json",
  "receipt.json", "request.json", "retention.json",
] as const;

function assertEvidenceInventoryShape(evidence: Imp24DFinalEvidence): void {
  const roots = [...evidence.evidenceRoots].sort();
  requireCondition(canonicalJson(Object.keys(evidence.evidenceInventories).sort()) === canonicalJson(roots),
    "evidence inventory keys differ from the exact evidence roots");
  const assertRoot = (root: string, attemptIds: readonly string[], smoke: boolean): void => {
    const inventory = evidence.evidenceInventories[root];
    requireCondition(Array.isArray(inventory)
        && canonicalJson(inventory) === canonicalJson([...new Set(inventory)].sort()),
      `${root}: evidence inventory must be sorted and unique`);
    const preflightPath = `${root}/live/preflight.json`;
    const preflightFailurePath = `${root}/live/preflight-failure.json`;
    const hasPreflight = inventory.includes(preflightPath);
    const hasPreflightFailure = inventory.includes(preflightFailurePath);
    requireCondition(smoke
      ? hasPreflight !== hasPreflightFailure
      : hasPreflight && !hasPreflightFailure,
    `${root}: evidence inventory has an invalid preflight outcome`);
    const required = new Set([
      `${root}/${smoke ? "cycle-result.json" : "candidate-availability.json"}`,
      `${root}/implementation-ci-gate.json`,
      ...(smoke ? [`${root}/smoke-input-binding.json`] : [`${root}/qualification-report.json`]),
      smoke && hasPreflightFailure ? preflightFailurePath : preflightPath,
      `${root}/live/call-ledger.json`,
      ...(!smoke ? [
        `${root}/live/qualification-freeze.json`,
        `${root}/live/qualification-result.json`,
        `${root}/live/role-registry.json`,
        ...(evidence.qualification.status === "ROLE_SET_READY" ? [`${root}/role-assignment-freeze.json`] : []),
      ] : []),
      ...attemptIds.flatMap((attemptId) => ATTEMPT_FILES.map((name) =>
        `${root}/live/attempts/${attemptId}/${name}`)),
    ]);
    for (const path of required) requireCondition(inventory.includes(path), `${root}: missing expected evidence ${path}`);
    const permittedDynamic = (path: string): boolean => {
      const logPrefix = `${root}/live/exec/logs/`;
      return (path.startsWith(logPrefix) && !path.slice(logPrefix.length).includes("/"))
        || path === `${root}/live/exec/cli-qualification-cache/cli-qualification.json`;
    };
    const unknown = inventory.filter((path) => !required.has(path) && !permittedDynamic(path));
    requireCondition(unknown.length === 0, `${root}: evidence inventory contains unknown artifacts: ${unknown.join(", ")}`);
  };
  for (const cycle of evidence.transportSmoke.cycles) {
    assertRoot(cycle.stateRoot, [
      `${cycle.executionId}-reader-canary-a1`,
      `${cycle.executionId}-source-canary-a1`,
    ], true);
  }
  assertRoot(evidence.qualification.root, evidence.qualification.attemptIds, false);
}

function assertBaselineLifecyclePreserved(
  repositoryRoot: string,
  baselineCommit: string,
  implementationCommit: string,
): void {
  const protectedRoots = ["docs/v25/reports", EXPERIMENTS_REL];
  const changes = execFileSync("git", ["diff", "--name-status", baselineCommit, implementationCommit, "--", ...protectedRoots], {
    cwd: repositoryRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 64 * 1024 * 1024,
  }).split("\n").map((line) => line.trim()).filter(Boolean);
  const destructive = changes.filter((line) => {
    if (line.startsWith("A\t")) return false;
    const fields = line.split("\t");
    return fields.slice(1).some((path) => !DETERMINISTIC_REMINT_FILES.has(path));
  });
  requireCondition(destructive.length === 0,
    `starting-head lifecycle evidence was modified or deleted: ${destructive.join(", ")}`);
  const baselineFiles = committedTreeFiles(repositoryRoot, baselineCommit, protectedRoots[0])
    .concat(committedTreeFiles(repositoryRoot, baselineCommit, protectedRoots[1]));
  for (const path of baselineFiles) {
    if (!DETERMINISTIC_REMINT_FILES.has(path)) {
      assertCommittedBytes(repositoryRoot, baselineCommit, path, "starting-head lifecycle artifact");
    }
  }
}

function assertDeclaredInputBytes(repositoryRoot: string, evidence: Imp24DFinalEvidence): void {
  const check = (path: string, expected: string, label: string): void => {
    const absolutePath = resolve(repositoryRoot, safeRelativePath(repositoryRoot, path, label));
    requireCondition(existsSync(absolutePath), `${label} is missing: ${path}`);
    requireCondition(sha256Hex(readFileSync(absolutePath)) === expected, `${label} bytes hash drift: ${path}`);
  };
  check(evidence.observabilityFreeze.path, evidence.observabilityFreeze.bytesSha256, "observability freeze");
  check(evidence.observabilityFreeze.markdownPath, evidence.observabilityFreeze.markdownBytesSha256,
    "observability freeze Markdown");
  check(evidence.historicalR1.jsonPath, evidence.historicalR1.jsonBytesSha256, "r1 closure JSON");
  check(evidence.historicalR1.markdownPath, evidence.historicalR1.markdownBytesSha256, "r1 closure Markdown");
  check(evidence.transportSmoke.reportPath, evidence.transportSmoke.reportBytesSha256, "transport-smoke report");
  check(evidence.transportSmoke.markdownPath, evidence.transportSmoke.markdownBytesSha256,
    "transport-smoke Markdown");
  check(evidence.qualification.terminalReportPath, evidence.qualification.terminalReportBytesSha256,
    "r2 terminal qualification report");
  check(evidence.qualification.implementationCiGatePath, evidence.qualification.implementationCiGateBytesSha256,
    "r2 implementation CI gate");
  if (evidence.qualification.roleAssignmentPath !== null) {
    requireCondition(evidence.qualification.roleAssignmentBytesSha256 !== null,
      "role-assignment path lacks a bytes hash");
    check(evidence.qualification.roleAssignmentPath, evidence.qualification.roleAssignmentBytesSha256,
      "r2 role-assignment freeze");
  }
}

function validateSmoke(smoke: Imp24DTransportSmokeBinding): void {
  requireCondition(smoke.status === "PASS", "final attestation requires transport-smoke PASS");
  requireCondition(smoke.reportPath === IMP24D_TRANSPORT_SMOKE_REPORT_PATHS.json
      && smoke.markdownPath === IMP24D_TRANSPORT_SMOKE_REPORT_PATHS.markdown,
    "transport-smoke report paths are not authoritative");
  for (const [label, value] of [
    ["smoke report bytes", smoke.reportBytesSha256],
    ["smoke Markdown bytes", smoke.markdownBytesSha256],
    ["smoke diagnostics set", smoke.processDiagnosticsSetSha256],
  ] as const) requireSha(value, label);
  requireGitSha(smoke.observabilityImplementationCommit, "observability implementation commit");
  requireGitSha(smoke.effectiveImplementationCommit, "effective implementation commit");
  if (smoke.correctionCommit !== null) requireGitSha(smoke.correctionCommit, "mechanical correction commit");
  requireCondition((smoke.totalCalls === 2 || smoke.totalCalls === 4)
      && (smoke.modelCalls === 2 || smoke.modelCalls === 3 || smoke.modelCalls === 4),
  "transport-smoke accounting must retain 2|4 broker calls and 2|3|4 model invocations");
  requireCondition(smoke.apiCalls === 0, "transport smoke records API calls");
  const expectedCycles = smoke.correctionCommit === null ? 1 : 2;
  requireCondition(smoke.cycles.length === expectedCycles && smoke.totalCalls === expectedCycles * 2,
    "transport-smoke cycle count differs from the one-correction ceiling");
  requireCondition(smoke.cycles[0]?.executionId === IMP24D_TRANSPORT_SMOKE_EXECUTION_ID
      && smoke.cycles[0]?.stateRoot === SMOKE_ROOT_REL
      && smoke.cycles[0]?.implementationCommit === smoke.observabilityImplementationCommit,
    "first transport-smoke cycle identity mismatch");
  if (expectedCycles === 1) {
    requireCondition(smoke.cycles[0].result === "PASS"
        && smoke.effectiveImplementationCommit === smoke.observabilityImplementationCommit,
      "single-cycle smoke must pass on the observability implementation commit");
  } else {
    requireCondition(smoke.cycles[0].result === "FAIL"
        && smoke.cycles[1]?.executionId === IMP24D_TRANSPORT_SMOKE_R2_EXECUTION_ID
        && smoke.cycles[1]?.stateRoot === SMOKE_R2_ROOT_REL
        && smoke.cycles[1]?.implementationCommit === smoke.correctionCommit
        && smoke.cycles[1]?.result === "PASS"
        && smoke.effectiveImplementationCommit === smoke.correctionCommit,
      "corrected transport-smoke lifecycle is invalid");
  }
  for (const cycle of smoke.cycles) {
    requireCondition(cycle.calls === 2, `${cycle.executionId}: smoke cycle must contain exactly two calls`);
    requireCondition(Number.isSafeInteger(cycle.codexExecInvocations)
        && cycle.codexExecInvocations >= 0 && cycle.codexExecInvocations <= 2
        && (cycle.result !== "PASS" || cycle.codexExecInvocations === 2),
    `${cycle.executionId}: codex exec invocation accounting is invalid`);
    requireGitSha(cycle.implementationCommit, `${cycle.executionId}: implementation commit`);
    requireCondition(Number.isSafeInteger(cycle.workflowRunId) && cycle.workflowRunId > 0,
      `${cycle.executionId}: workflow run ID is invalid`);
    requireSha(cycle.implementationCiGateSha256, `${cycle.executionId}: CI gate hash`);
    requireSha(cycle.implementationCiGateBytesSha256, `${cycle.executionId}: CI gate bytes hash`);
    requireSha(cycle.processDiagnosticsSetSha256, `${cycle.executionId}: diagnostics set hash`);
    requireSha(cycle.qualificationSemanticProjectionSha256,
      `${cycle.executionId}: qualification semantic projection hash`);
    requireSha(cycle.certificationSha256, `${cycle.executionId}: certification hash`);
    requireSha(cycle.productionInstrumentSealSha256, `${cycle.executionId}: production seal hash`);
    requireSha(cycle.productionQualificationParitySha256,
      `${cycle.executionId}: production/qualification parity hash`);
    requireCondition(Number.isFinite(Date.parse(cycle.implementationCiVerifiedAt))
        && Number.isFinite(Date.parse(cycle.startedAt))
        && Number.isFinite(Date.parse(cycle.completedAt))
        && Date.parse(cycle.implementationCiVerifiedAt) < Date.parse(cycle.startedAt)
        && Date.parse(cycle.startedAt) <= Date.parse(cycle.completedAt),
      `${cycle.executionId}: implementation-CI/smoke chronology is invalid`);
  }
  if (smoke.cycles.length === 2) {
    requireCondition(Date.parse(smoke.cycles[0].completedAt) < Date.parse(smoke.cycles[1].implementationCiVerifiedAt),
      "corrected transport smoke did not occur after the first failed cycle completed");
    requireCondition(smoke.cycles[0].qualificationSemanticProjectionSha256
        === smoke.cycles[1].qualificationSemanticProjectionSha256,
    "frozen qualification semantic projection changed across the mechanical correction");
    requireCondition(smoke.cycles[0].certificationSha256 !== smoke.cycles[1].certificationSha256
        && smoke.cycles[0].productionInstrumentSealSha256 !== smoke.cycles[1].productionInstrumentSealSha256
        && smoke.cycles[0].productionQualificationParitySha256
          !== smoke.cycles[1].productionQualificationParitySha256,
    "mechanical correction did not retain distinct original and effective instrument remints");
  }
  requireCondition(smoke.modelCalls
      === smoke.cycles.reduce((sum, cycle) => sum + cycle.codexExecInvocations, 0),
  "transport-smoke model invocation total differs from the retained runner crossings");
  requireCondition(smoke.processDiagnosticsSetSha256 === hashCanonical(smoke.cycles.map((cycle) => ({
    executionId: cycle.executionId,
    processDiagnosticsSetSha256: cycle.processDiagnosticsSetSha256,
  }))), "transport-smoke aggregate diagnostics hash drift");
}

function validateQualification(qualification: Imp24DQualificationBinding): void {
  requireCondition(qualification.root === QUALIFICATION_ROOT_REL
      && qualification.terminalReportPath === QUALIFICATION_REPORT_REL
      && qualification.implementationCiGatePath === IMPLEMENTATION_CI_GATE_REL,
    "qualification bindings do not use the fixed r2 root");
  requireCondition(qualification.roleAssignmentPath === (qualification.status === "ROLE_SET_READY" ? ROLE_ASSIGNMENT_REL : null),
    "qualification role-assignment path differs from terminal status");
  for (const [label, value] of [
    ["terminal report bytes", qualification.terminalReportBytesSha256],
    ["terminal report self hash", qualification.terminalReportSha256],
    ["implementation CI gate", qualification.implementationCiGateSha256],
    ["implementation CI gate bytes", qualification.implementationCiGateBytesSha256],
    ["qualification result", qualification.qualificationResultSha256],
    ["qualification freeze", qualification.qualificationFreezeSha256],
    ["call ledger", qualification.callLedgerSha256],
    ["call ledger bytes", qualification.callLedgerBytesSha256],
    ["attempt evidence set", qualification.attemptEvidenceSetSha256],
    ["process diagnostics set", qualification.processDiagnosticsSetSha256],
    ["certification", qualification.certificationSha256],
    ["production seal", qualification.productionSealSha256],
    ["production/qualification parity", qualification.productionQualificationParitySha256],
    ["qualification semantic projection", qualification.qualificationSemanticProjectionSha256],
    ["thresholds", qualification.thresholdsSha256],
    ["prompt hashes", qualification.promptSourceHashesSha256],
    ["schema hashes", qualification.schemaHashesSha256],
    ["route binding", qualification.routeBindingSha256],
  ] as const) requireSha(value, label);
  requireCondition(SHA256.test(qualification.corpusBundleSha256)
      || SHA256_TAGGED.test(qualification.corpusBundleSha256),
    "qualification corpus bundle hash is invalid");
  if (qualification.roleAssignmentBytesSha256 !== null) requireSha(qualification.roleAssignmentBytesSha256, "role assignment bytes");
  if (qualification.roleAssignmentFreezeSha256 !== null) requireSha(qualification.roleAssignmentFreezeSha256, "role assignment self hash");
  if (qualification.roleAssignmentPolicySha256 !== null) requireSha(qualification.roleAssignmentPolicySha256, "role assignment policy hash");
  requireCondition(qualification.callCounts.apiCalls === 0
      && qualification.callCounts.canaryCalls + qualification.callCounts.holdoutCalls
        + qualification.callCounts.infrastructureReplays === qualification.callCounts.totalAttempts
      && qualification.callCounts.codexExecInvocations <= qualification.callCounts.totalAttempts,
    "qualification call accounting is invalid");
  requireCondition(qualification.attemptIds.length === qualification.callCounts.totalAttempts
      && canonicalJson(qualification.attemptIds) === canonicalJson([...new Set(qualification.attemptIds)].sort()),
    "qualification attempt IDs must exactly enumerate the retained attempts");
  requireCondition(Number.isFinite(Date.parse(qualification.preflightVerifiedAt))
      && Number.isFinite(Date.parse(qualification.earliestRequestAt))
      && Date.parse(qualification.preflightVerifiedAt) <= Date.parse(qualification.earliestRequestAt),
    "qualification preflight/request chronology is invalid");
  requireCondition(new Set(qualification.qualifiedProfiles).size === qualification.qualifiedProfiles.length
      && canonicalJson(qualification.qualifiedProfiles) === canonicalJson([...qualification.qualifiedProfiles].sort()),
    "qualified profiles must be unique and sorted");
  const ready = qualification.status === "ROLE_SET_READY";
  requireCondition(ready === Object.values(qualification.roles).every((value) => typeof value === "string" && value.length > 0),
    "role-set readiness differs from the five fixed role assignments");
  requireCondition(ready === (qualification.roleAssignmentPath !== null)
      && ready === (qualification.roleAssignmentBytesSha256 !== null)
      && ready === (qualification.roleAssignmentFreezeSha256 !== null)
      && ready === (qualification.roleAssignmentPolicySha256 !== null),
    "role-assignment evidence differs from terminal readiness");
  requireCondition(ready ? qualification.blockedReason === null : typeof qualification.blockedReason === "string",
    "qualification blocked reason differs from terminal readiness");
  requireCondition(Object.values(qualification.roles).every((profile) =>
    profile === null || qualification.qualifiedProfiles.includes(profile)),
  "fixed role uses an unqualified profile");
}

function validateEvidence(evidence: Imp24DFinalEvidence): void {
  requireCondition(evidence.observabilityFreeze.path === IMP24D_OBSERVABILITY_FREEZE_PATHS.json,
    "observability freeze path is not authoritative");
  requireCondition(evidence.observabilityFreeze.markdownPath === IMP24D_OBSERVABILITY_FREEZE_PATHS.markdown,
    "observability freeze Markdown path is not authoritative");
  for (const [label, value] of [
    ["observability freeze bytes", evidence.observabilityFreeze.bytesSha256],
    ["observability freeze Markdown bytes", evidence.observabilityFreeze.markdownBytesSha256],
    ["observability freeze self hash", evidence.observabilityFreeze.freezeSha256],
    ["observability production seal", evidence.observabilityFreeze.productionSealSha256],
    ["observability certification", evidence.observabilityFreeze.certificationSha256],
    ["observability parity", evidence.observabilityFreeze.productionQualificationParitySha256],
    ["observability frozen semantics", evidence.observabilityFreeze.frozenSemanticsSha256],
  ] as const) requireSha(value, label);
  requireCondition(evidence.historicalR1.executionId === IMP24_ROLE_QUALIFICATION_R1_EXECUTION_ID
      && evidence.historicalR1.disposition === "BLOCKED_OBSERVABILITY_INCOMPLETE"
      && evidence.historicalR1.mayResume === false
      && evidence.historicalR1.mayQualifyProfiles === false
      && evidence.historicalR1.jsonPath === IMP24D_R1_CLOSURE_PATHS.json
      && evidence.historicalR1.markdownPath === IMP24D_R1_CLOSURE_PATHS.markdown,
    "historical r1 closure binding is invalid");
  requireSha(evidence.historicalR1.jsonBytesSha256, "r1 closure JSON bytes");
  requireSha(evidence.historicalR1.markdownBytesSha256, "r1 closure Markdown bytes");
  validateSmoke(evidence.transportSmoke);
  validateQualification(evidence.qualification);
  requireCondition(Date.parse(evidence.transportSmoke.cycles.at(-1)!.completedAt)
      < Date.parse(evidence.qualification.preflightVerifiedAt)
      && Date.parse(evidence.transportSmoke.cycles.at(-1)!.completedAt)
        < Date.parse(evidence.qualification.earliestRequestAt),
    "r2 qualification did not start strictly after final transport-smoke PASS");
  const firstSmoke = evidence.transportSmoke.cycles[0];
  const finalSmoke = evidence.transportSmoke.cycles.at(-1)!;
  requireCondition(firstSmoke.certificationSha256 === evidence.observabilityFreeze.certificationSha256
      && firstSmoke.productionInstrumentSealSha256 === evidence.observabilityFreeze.productionSealSha256
      && firstSmoke.productionQualificationParitySha256
        === evidence.observabilityFreeze.productionQualificationParitySha256,
  "original smoke instrument differs from the Commit-A observability freeze");
  requireCondition(evidence.qualification.certificationSha256 === finalSmoke.certificationSha256
      && evidence.qualification.productionSealSha256 === finalSmoke.productionInstrumentSealSha256
      && evidence.qualification.productionQualificationParitySha256
        === finalSmoke.productionQualificationParitySha256,
  "qualification instrument differs from the final passing smoke instrument");
  requireCondition(evidence.qualification.qualificationSemanticProjectionSha256
      === finalSmoke.qualificationSemanticProjectionSha256
      && evidence.transportSmoke.cycles.every((cycle) =>
        cycle.qualificationSemanticProjectionSha256
          === evidence.qualification.qualificationSemanticProjectionSha256),
  "frozen qualification semantic projection changed between smoke and r2 qualification");
  const requiredRoots = [
    SMOKE_ROOT_REL,
    ...(evidence.transportSmoke.correctionCommit === null ? [] : [SMOKE_R2_ROOT_REL]),
    QUALIFICATION_ROOT_REL,
  ].sort();
  requireCondition(canonicalJson([...new Set(evidence.evidenceRoots)].sort()) === canonicalJson(requiredRoots),
    "evidence roots differ from the exact smoke/r2 lifecycle");
  const requiredFiles = [
    evidence.transportSmoke.reportPath,
    evidence.transportSmoke.markdownPath,
    IMP24D_R2_REPORT_PATHS.qualificationJson,
    IMP24D_R2_REPORT_PATHS.qualificationMarkdown,
    ...(evidence.qualification.status === "ROLE_SET_READY"
      ? [IMP24D_R2_REPORT_PATHS.roleAssignmentJson, IMP24D_R2_REPORT_PATHS.roleAssignmentMarkdown]
      : []),
  ].sort();
  requireCondition(canonicalJson([...new Set(evidence.evidenceFiles)].sort()) === canonicalJson(requiredFiles),
    "evidence report set differs from the exact smoke/r2 terminal report set");
  assertEvidenceInventoryShape(evidence);
}

function changedFiles(repositoryRoot: string, baselineCommit: string, evidenceCommit: string): string[] {
  const tracked = execFileSync("git", ["diff", "--name-only", baselineCommit, evidenceCommit, "--"], {
    cwd: repositoryRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 64 * 1024 * 1024,
  }).split("\n").map((item) => item.trim()).filter(Boolean);
  return [...new Set([...tracked, ...Object.values(IMP24D_FINAL_ATTESTATION_PATHS)])].sort();
}

type FinalCheckoutMode = "PRE_MATERIALIZATION" | "RETAINED_FINAL";

function diffFiles(repositoryRoot: string, from: string, to: string): string[] {
  return execFileSync("git", ["diff", "--name-only", from, to, "--"], {
    cwd: repositoryRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 64 * 1024 * 1024,
  }).split("\n").map((item) => item.trim()).filter(Boolean).sort();
}

function assertImplementationEvidenceDiff(
  repositoryRoot: string,
  implementationCommit: string,
  evidenceCommit: string,
  evidence: Imp24DFinalEvidence,
): void {
  const allowedRoots = evidence.evidenceRoots.map((root) => `${root}/`);
  const allowedFiles = new Set(evidence.evidenceFiles);
  const changed = diffFiles(repositoryRoot, implementationCommit, evidenceCommit);
  requireCondition(changed.length > 0, "Evidence Commit contains no retained smoke/r2 evidence");
  const disallowed = changed.filter((path) =>
    !allowedFiles.has(path) && !allowedRoots.some((root) => path.startsWith(root)));
  requireCondition(disallowed.length === 0,
    `effective implementation to Evidence Commit changed files outside the evidence allowlist: ${disallowed.join(", ")}`);
}

function assertFinalCheckoutLifecycle(args: {
  repositoryRoot: string;
  evidenceCommit: string;
  mode: FinalCheckoutMode;
}): void {
  const head = currentHead(args.repositoryRoot);
  const outputs = Object.values(IMP24D_FINAL_ATTESTATION_PATHS).sort();
  if (args.mode === "PRE_MATERIALIZATION") {
    requireCondition(head === args.evidenceCommit,
      "IMP-24D materialization/build requires the checkout HEAD to equal Evidence Commit exactly");
    const existing = outputs.filter((path) => existsSync(resolve(args.repositoryRoot, path)));
    requireCondition(existing.length === 0,
      `IMP-24D terminal outputs already exist before materialization: ${existing.join(", ")}`);
    return;
  }
  requireCondition(head !== args.evidenceCommit,
    "retained final-attestation verification requires a later final commit");
  assertDirectChild(args.repositoryRoot, args.evidenceCommit, head, "final-attestation lifecycle");
  const finalDiff = diffFiles(args.repositoryRoot, args.evidenceCommit, head);
  requireCondition(canonicalJson(finalDiff) === canonicalJson(outputs),
    `Evidence Commit to final commit diff must be exactly the three IMP-24D outputs: ${finalDiff.join(", ")}`);
  for (const path of outputs) assertCommittedBytes(args.repositoryRoot, head, path, "final attestation output");
}

function renderFinalMarkdown(attestation: Imp24DFinalAttestation): string {
  const role = (value: string | null): string => value === null ? "none" : `\`${value}\``;
  return [
    "# IMP-24D final V3 reviewer role freeze",
    "",
    `Final decision: **${attestation.finalDecision}**`,
    `Role set ready: **${attestation.roleSetReady ? "yes" : "no"}**`,
    "",
    `Execution: \`${attestation.executionId}\``,
    `Observability implementation commit: \`${attestation.observabilityImplementationCommit}\``,
    `Mechanical correction commit: ${attestation.mechanicalCorrectionCommit === null ? "none" : `\`${attestation.mechanicalCorrectionCommit}\``}`,
    `Effective implementation commit: \`${attestation.effectiveImplementationCommit}\``,
    `Evidence commit: \`${attestation.evidenceCommit}\``,
    `Attestation SHA-256: \`${attestation.attestationSha256}\``,
    "",
    "## Frozen reviewers",
    "",
    `- Reader primary: ${role(attestation.roles.readerPrimary)}`,
    `- Reader audit: ${role(attestation.roles.readerAudit)}`,
    `- Source primary: ${role(attestation.roles.sourcePrimary)}`,
    `- Source adjudicator: ${role(attestation.roles.sourceAdjudicator)}`,
    `- Quiz semantic adjudicator: ${role(attestation.roles.quizSemanticAdjudicator)}`,
    `- Deterministic quiz checker: \`${QUIZ_DETERMINISTIC_CHECKER_VERSION}\``,
    "",
    "## Retained calls",
    "",
    `- Diagnostic transport-smoke calls: **${attestation.transportSmoke.totalCalls}** (excluded from qualification metrics)`,
    `- Qualification canary calls: **${attestation.qualification.callCounts.canaryCalls}**`,
    `- Qualification holdout calls: **${attestation.qualification.callCounts.holdoutCalls}**`,
    `- Qualification infrastructure replays: **${attestation.qualification.callCounts.infrastructureReplays}**`,
    "- API calls: **0**",
    "",
    "The r1 execution remains closed as BLOCKED_OBSERVABILITY_INCOMPLETE. Pilot, gold, Content Design Score, local SOL activation, publication, promotion, deployment, upload, merge, and force-push were not run.",
    "",
  ].join("\n");
}

function buildImplementationReport(args: {
  repositoryRoot: string;
  baselineCommit: string;
  evidenceCommit: string;
  evidence: Imp24DFinalEvidence;
}): JsonObject {
  const ready = args.evidence.qualification.status === "ROLE_SET_READY";
  const report: JsonObject = {
    schema: "worker-implementation-report-v1",
    promptId: "IMP-24",
    baselineHash: args.baselineCommit,
    resultHash: args.evidence.qualification.terminalReportBytesSha256,
    contractVersions: { "review-evidence-envelope": 1, "review-model-output-v2": 2 },
    filesChanged: changedFiles(args.repositoryRoot, args.baselineCommit, args.evidenceCommit),
    requirementsImplemented: [
      { requirementId: "IMP24D-R01-PROCESS-OBSERVABILITY", status: "implemented", note: "Every r2 attempt is bound to bounded process diagnostics." },
      { requirementId: "IMP24D-R02-TRANSPORT-SMOKE", status: "implemented", note: "The fixed two-call transport smoke passed after at most one correction." },
      ready
        ? { requirementId: "IMP24D-R03-R2-ROLE-FREEZE", status: "implemented", note: "The first valid 2-reader / 2-source / 1-quiz role set is fixed." }
        : { requirementId: "IMP24D-R03-R2-ROLE-FREEZE", status: "deferred", deferredTo: args.evidence.qualification.blockedReason ?? "ROLE_SET_NOT_READY" },
    ],
    testsRequired: ["full model-free suite", "exact implementation-commit V25 CI", "retained evidence verification"],
    testsRun: ["bound by IMP-24D observability freeze", "bound by retained transport-smoke and r2 evidence"],
    testResults: { pass: 3, fail: 0, xfail: 0, xpass: 0, skip: 0, xenv: 0, commands: [] },
    gateChanges: [],
    bookSpecificExceptions: [],
    unexpectedWrites: [],
    unresolvedRisks: ready ? [] : [args.evidence.qualification.blockedReason ?? "ROLE_SET_NOT_READY"],
    dependencyAssumptions: [
      "The effective implementation and evidence commits are explicit inputs; the future final-attestation commit is not an input.",
      "Final exact-commit V25 CI is established after this non-self-referential report is committed.",
    ],
    continuationPromptId: "IMP-24D",
    branch: IMP24D_BRANCH,
    draftPr: IMP24D_DRAFT_PR,
    observabilityImplementationCommit: args.evidence.transportSmoke.observabilityImplementationCommit,
    mechanicalCorrectionCommit: args.evidence.transportSmoke.correctionCommit,
    effectiveImplementationCommit: args.evidence.transportSmoke.effectiveImplementationCommit,
    evidenceCommit: args.evidenceCommit,
    experimentId: IMP24_ROLE_QUALIFICATION_R2_EXECUTION_ID,
    finalDecision: ready ? "PASS" : "BLOCKED",
    roleSetReady: ready,
    transportSmokeCalls: args.evidence.transportSmoke.totalCalls,
    qualificationCalls: args.evidence.qualification.callCounts,
    apiCalls: 0,
    pilotRun: false,
    goldRun: false,
    localSolActivation: false,
    publishActivated: false,
    promoteActivated: false,
    deploymentActivated: false,
    uploadActivated: false,
    mainMerged: false,
    forcePush: false,
  };
  const issues = validateWorkerReport(report);
  requireCondition(issues.length === 0, `built IMP-24D implementation report is invalid: ${issues.join("; ")}`);
  return report;
}

function buildFromValidatedEvidence(args: {
  repositoryRoot: string;
  baselineCommit: string;
  implementationCommit: string;
  evidenceCommit: string;
  evidence: Imp24DFinalEvidence;
  checkoutMode: FinalCheckoutMode;
}): Imp24DFinalAttestationBuild {
  validateEvidence(args.evidence);
  requireGitSha(args.baselineCommit, "lifecycle baseline commit");
  requireGitSha(args.implementationCommit, "effective implementation commit");
  requireGitSha(args.evidenceCommit, "evidence commit");
  for (const [sha, label] of [
    [args.baselineCommit, "lifecycle baseline commit"],
    [args.evidence.transportSmoke.observabilityImplementationCommit, "observability implementation commit"],
    ...(args.evidence.transportSmoke.correctionCommit === null
      ? [] : [[args.evidence.transportSmoke.correctionCommit, "mechanical correction commit"] as const]),
    [args.implementationCommit, "effective implementation commit"],
    [args.evidenceCommit, "evidence commit"],
  ] as const) assertCommitExists(args.repositoryRoot, sha, label);
  requireCondition(args.implementationCommit === args.evidence.transportSmoke.effectiveImplementationCommit,
    "CLI implementation commit differs from the smoke-qualified effective implementation commit");
  assertAncestor(args.repositoryRoot, args.baselineCommit,
    args.evidence.transportSmoke.observabilityImplementationCommit,
    "IMP-24D baseline/observability ancestry");
  if (args.evidence.transportSmoke.correctionCommit !== null) {
    assertImp24DBoundedCorrectionCommit({
      repositoryRoot: args.repositoryRoot,
      observabilityImplementationCommit: args.evidence.transportSmoke.observabilityImplementationCommit,
      correctionCommit: args.evidence.transportSmoke.correctionCommit,
    });
  }
  assertAncestor(args.repositoryRoot, args.implementationCommit, args.evidenceCommit,
    "implementation/evidence ancestry", true);
  assertImplementationEvidenceDiff(args.repositoryRoot, args.implementationCommit, args.evidenceCommit, args.evidence);
  assertBaselineLifecyclePreserved(args.repositoryRoot, args.baselineCommit, args.implementationCommit);
  assertFinalCheckoutLifecycle({
    repositoryRoot: args.repositoryRoot,
    evidenceCommit: args.evidenceCommit,
    mode: args.checkoutMode,
  });
  for (const path of [
    args.evidence.observabilityFreeze.path,
    args.evidence.observabilityFreeze.markdownPath,
    args.evidence.historicalR1.jsonPath,
    args.evidence.historicalR1.markdownPath,
  ]) assertCommittedBytes(args.repositoryRoot, args.implementationCommit, path, "implementation-owned lifecycle artifact");
  for (const path of [args.evidence.historicalR1.jsonPath, args.evidence.historicalR1.markdownPath]) {
    assertCommittedBytes(args.repositoryRoot, args.evidence.transportSmoke.observabilityImplementationCommit, path,
      "observability-commit r1 closure");
  }
  assertDeclaredInputBytes(args.repositoryRoot, args.evidence);
  assertEvidenceOwnership(args.repositoryRoot, args.evidenceCommit, args.evidence);

  const qualification = args.evidence.qualification;
  const ready = qualification.status === "ROLE_SET_READY";
  const implementationReport = buildImplementationReport({
    repositoryRoot: args.repositoryRoot,
    baselineCommit: args.baselineCommit,
    evidenceCommit: args.evidenceCommit,
    evidence: args.evidence,
  });
  const implementationReportBytes = canonicalPretty(implementationReport);
  const { roles, qualifiedProfiles, ...qualificationWithoutRoles } = qualification;
  const core: Omit<Imp24DFinalAttestation, "attestationSha256"> = {
    schema: IMP24D_FINAL_ATTESTATION_SCHEMA,
    promptId: "IMP-24",
    continuationPromptId: "IMP-24D",
    executionId: IMP24_ROLE_QUALIFICATION_R2_EXECUTION_ID,
    branch: IMP24D_BRANCH,
    draftPullRequest: IMP24D_DRAFT_PR,
    startingHead: IMP24D_STARTING_HEAD,
    observabilityImplementationCommit: args.evidence.transportSmoke.observabilityImplementationCommit,
    mechanicalCorrectionCommit: args.evidence.transportSmoke.correctionCommit,
    effectiveImplementationCommit: args.implementationCommit,
    evidenceCommit: args.evidenceCommit,
    finalDecision: ready ? "PASS" : "BLOCKED",
    roleSetReady: ready,
    roles,
    deterministicQuizChecker: QUIZ_DETERMINISTIC_CHECKER_VERSION,
    qualifiedProfiles,
    instrument: {
      observabilityFreezeSha256: args.evidence.observabilityFreeze.freezeSha256,
      observabilityFreezeBytesSha256: args.evidence.observabilityFreeze.bytesSha256,
      observabilityFrozenSemanticsSha256: args.evidence.observabilityFreeze.frozenSemanticsSha256,
      qualificationSemanticProjectionSha256: qualification.qualificationSemanticProjectionSha256,
      original: {
        certificationSha256: args.evidence.observabilityFreeze.certificationSha256,
        productionSealSha256: args.evidence.observabilityFreeze.productionSealSha256,
        productionQualificationParitySha256:
          args.evidence.observabilityFreeze.productionQualificationParitySha256,
      },
      effective: {
        certificationSha256: qualification.certificationSha256,
        productionSealSha256: qualification.productionSealSha256,
        productionQualificationParitySha256: qualification.productionQualificationParitySha256,
      },
      corpusBundleSha256: qualification.corpusBundleSha256,
      thresholdsSha256: qualification.thresholdsSha256,
      promptSourceHashesSha256: qualification.promptSourceHashesSha256,
      schemaHashesSha256: qualification.schemaHashesSha256,
    },
    historicalR1: args.evidence.historicalR1,
    transportSmoke: args.evidence.transportSmoke,
    qualification: qualificationWithoutRoles,
    controls: {
      thresholdsWeakened: false,
      holdoutsRelabeled: false,
      unavailableProfilesReplaced: false,
      candidateOrderChanged: false,
      outputInformedResampling: false,
      retriesAdded: false,
      apiFallbackAllowed: false,
      directHttpOrSdkAllowed: false,
    },
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
    inputBytesSha256: {
      observabilityFreeze: args.evidence.observabilityFreeze.bytesSha256,
      observabilityFreezeMarkdown: args.evidence.observabilityFreeze.markdownBytesSha256,
      r1ClosureJson: args.evidence.historicalR1.jsonBytesSha256,
      r1ClosureMarkdown: args.evidence.historicalR1.markdownBytesSha256,
      transportSmokeReport: args.evidence.transportSmoke.reportBytesSha256,
      transportSmokeMarkdown: args.evidence.transportSmoke.markdownBytesSha256,
      terminalQualificationReport: qualification.terminalReportBytesSha256,
      roleAssignmentFreeze: qualification.roleAssignmentBytesSha256,
      implementationCiGate: qualification.implementationCiGateBytesSha256,
      evidenceInventory: hashCanonical(args.evidence.evidenceInventories),
    },
    modelCalls: args.evidence.transportSmoke.modelCalls + qualification.callCounts.codexExecInvocations,
    apiCalls: 0,
  };
  const attestation: Imp24DFinalAttestation = { ...core, attestationSha256: hashCanonical(core) };
  const attestationBytes = canonicalPretty(attestation);
  const markdownBytes = renderFinalMarkdown(attestation);
  return {
    attestation,
    implementationReport,
    outputs: {
      implementationReport: {
        relativePath: IMP24D_FINAL_ATTESTATION_PATHS.implementationReport,
        bytes: implementationReportBytes,
        bytesSha256: sha256Hex(implementationReportBytes),
      },
      attestationJson: {
        relativePath: IMP24D_FINAL_ATTESTATION_PATHS.attestationJson,
        bytes: attestationBytes,
        bytesSha256: sha256Hex(attestationBytes),
      },
      attestationMarkdown: {
        relativePath: IMP24D_FINAL_ATTESTATION_PATHS.attestationMarkdown,
        bytes: markdownBytes,
        bytesSha256: sha256Hex(markdownBytes),
      },
    },
    modelCalls: 0,
    apiCalls: 0,
  };
}

function loadObservabilityAndR1(artifactRoot: string): Pick<Imp24DFinalEvidence,
  "observabilityFreeze" | "historicalR1"> {
  const retainedFreeze = readArtifact(
    artifactRoot,
    IMP24D_OBSERVABILITY_FREEZE_PATHS.json,
    "IMP-24D observability freeze",
  );
  const freeze = retainedFreeze.value as unknown as Imp24DObservabilityFreeze;
  const freezeMarkdownPath = resolve(artifactRoot, IMP24D_OBSERVABILITY_FREEZE_PATHS.markdown);
  requireCondition(existsSync(freezeMarkdownPath), "IMP-24D observability freeze Markdown is missing");
  const freezeMarkdownBytes = readFileSync(freezeMarkdownPath);
  const issues = validateImp24DObservabilityFreeze(freeze);
  requireCondition(issues.length === 0, `retained IMP-24D observability freeze is invalid: ${issues.join("; ")}`);
  const { freezeSha256, ...freezeCore } = freeze;
  requireCondition(hashCanonical(freezeCore) === freezeSha256, "retained observability freeze self hash drift");
  requireCondition(freeze.startingHead === IMP24D_STARTING_HEAD
      && freeze.successor.executionId === IMP24_ROLE_QUALIFICATION_R2_EXECUTION_ID,
    "retained observability freeze belongs to another lifecycle");

  const closureJson = readArtifact(artifactRoot, IMP24D_R1_CLOSURE_PATHS.json, "historical r1 closure");
  const closure = closureJson.value;
  const closureMarkdownPath = resolve(artifactRoot, IMP24D_R1_CLOSURE_PATHS.markdown);
  requireCondition(existsSync(closureMarkdownPath), "historical r1 closure Markdown is missing");
  const closureMarkdown = readFileSync(closureMarkdownPath);
  const closureControls = asObject(closure.closure, "historical r1 closure controls");
  requireCondition(closure.schema === "imp-24c-r1-observability-gap-v1"
      && closure.executionId === IMP24_ROLE_QUALIFICATION_R1_EXECUTION_ID
      && closure.disposition === "BLOCKED_OBSERVABILITY_INCOMPLETE"
      && closureControls.mayResume === false
      && closureControls.mayQualifyProfiles === false,
    "historical r1 closure is not terminal BLOCKED_OBSERVABILITY_INCOMPLETE");
  requireCondition(freeze.historicalR1.closureJson.relativePath === IMP24D_R1_CLOSURE_PATHS.json
      && freeze.historicalR1.closureJson.bytesSha256 === sha256Hex(closureJson.bytes)
      && freeze.historicalR1.closureMarkdown.relativePath === IMP24D_R1_CLOSURE_PATHS.markdown
      && freeze.historicalR1.closureMarkdown.bytesSha256 === sha256Hex(closureMarkdown),
    "observability freeze does not bind the exact historical r1 closure bytes");

  return {
    observabilityFreeze: {
      path: IMP24D_OBSERVABILITY_FREEZE_PATHS.json,
      bytesSha256: sha256Hex(retainedFreeze.bytes),
      markdownPath: IMP24D_OBSERVABILITY_FREEZE_PATHS.markdown,
      markdownBytesSha256: sha256Hex(freezeMarkdownBytes),
      freezeSha256,
      productionSealSha256: freeze.currentImplementation.productionInstrumentSealSha256,
      certificationSha256: freeze.currentImplementation.certificationSha256,
      productionQualificationParitySha256: freeze.currentImplementation.productionQualificationParitySha256,
      frozenSemanticsSha256: hashCanonical(freeze.frozenSemantics),
    },
    historicalR1: {
      executionId: IMP24_ROLE_QUALIFICATION_R1_EXECUTION_ID,
      disposition: "BLOCKED_OBSERVABILITY_INCOMPLETE",
      mayResume: false,
      mayQualifyProfiles: false,
      jsonPath: IMP24D_R1_CLOSURE_PATHS.json,
      jsonBytesSha256: sha256Hex(closureJson.bytes),
      markdownPath: IMP24D_R1_CLOSURE_PATHS.markdown,
      markdownBytesSha256: sha256Hex(closureMarkdown),
    },
  };
}

function roleSelection(roleFreeze: ForwardRoleAssignmentFreezeV3 | null): RoleSelection {
  if (roleFreeze === null) {
    return {
      readerPrimary: null,
      readerAudit: null,
      sourcePrimary: null,
      sourceAdjudicator: null,
      quizSemanticAdjudicator: null,
    };
  }
  return {
    readerPrimary: roleFreeze.roleAssignment.readerPrimary.profileId,
    readerAudit: roleFreeze.roleAssignment.readerBackup.profileId,
    sourcePrimary: roleFreeze.roleAssignment.sourcePrimary.profileId,
    sourceAdjudicator: roleFreeze.roleAssignment.sourceAdjudicator.profileId,
    quizSemanticAdjudicator: roleFreeze.roleAssignment.quizAdjudicator.profileId,
  };
}

function processDiagnosticsSetSha256(
  repositoryRoot: string,
  loaded: LoadedImp24TerminalQualification,
): string {
  const bindings = loaded.retainedQualificationEvidence.ledger.entries.map((entry) => {
    requireCondition(entry.processDiagnosticsSha256 !== null,
      `${entry.attemptId}: completed r2 ledger entry has no process-diagnostics binding`);
    requireSha(entry.processDiagnosticsSha256, `${entry.attemptId}: process diagnostics hash`);
    const path = resolve(
      repositoryRoot,
      QUALIFICATION_ROOT_REL,
      "live",
      "attempts",
      entry.attemptId,
      "process-diagnostics.json",
    );
    requireCondition(existsSync(path), `${entry.attemptId}: process-diagnostics artifact is missing`);
    const bytes = readFileSync(path);
    const diagnostics = parseJson(bytes, `${entry.attemptId}: process diagnostics`);
    requireCondition(diagnostics.diagnosticsSha256 === entry.processDiagnosticsSha256,
      `${entry.attemptId}: process-diagnostics semantic hash differs from the call ledger`);
    return {
      attemptId: entry.attemptId,
      processDiagnosticsSha256: entry.processDiagnosticsSha256,
      processDiagnosticsBytesSha256: sha256Hex(bytes),
    };
  }).sort((left, right) => left.attemptId.localeCompare(right.attemptId));
  return hashCanonical(bindings);
}

function qualificationSemanticProjectionSha256(
  loaded: LoadedImp24TerminalQualification,
): string {
  const plan = buildLegacyRoleQualificationPlanV3(loaded.preparedInput);
  const availability = loaded.preparedInput.candidateAvailability;
  const calls = (["reader", "source"] as const).map((role) => {
    const firstAvailable = availability.entries.find((entry) =>
      entry.role === role && entry.status === "AVAILABLE");
    requireCondition(firstAvailable !== undefined,
      `r2 qualification has no first AVAILABLE ${role} profile for semantic projection`);
    const entry = plan.schedule.find((candidate) => candidate.role === role
      && candidate.candidateOrdinal === firstAvailable.ordinal
      && candidate.partition === "canary"
      && candidate.caseOrdinal === 0);
    requireCondition(entry !== undefined,
      `r2 qualification has no certified first ${role} canary for semantic projection`);
    return {
      role,
      candidateOrdinal: firstAvailable.ordinal,
      profileId: firstAvailable.profileId,
      model: firstAvailable.model,
      effort: firstAvailable.effort,
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
  }) as [Imp24DTransportSemanticCallBindingV1, Imp24DTransportSemanticCallBindingV1];
  return imp24DQualificationSemanticProjectionSha256({
    freeze: plan.freeze,
    candidateAvailability: availability,
    calls,
  });
}

function loadQualificationBinding(
  repositoryRoot: string,
  artifactRoot: string,
): { binding: Imp24DQualificationBinding; gate: Imp24ImplementationCiGateV1 } {
  requireCondition(resolve(artifactRoot, QUALIFICATION_ROOT_REL)
      === resolve(IMP24D_R2_QUALIFICATION_FIXED_PATHS.qualificationRoot),
    "IMP-24D final attestation must read the explicit historical R2 qualification root");
  const loaded = verifyImp24DR2RetainedQualificationForFinalAttestationV3();
  const proof = loaded.retainedQualificationEvidence.proof;
  const result = loaded.retainedQualificationEvidence.result;
  requireCondition(String(proof.experimentId) === IMP24_ROLE_QUALIFICATION_R2_EXECUTION_ID,
    "retained qualification proof belongs to another execution");
  const terminal = readArtifact(artifactRoot, QUALIFICATION_REPORT_REL, "r2 terminal qualification report");
  const gateArtifact = readArtifact(artifactRoot, IMPLEMENTATION_CI_GATE_REL, "r2 implementation CI gate");
  const gate = gateArtifact.value as unknown as Imp24ImplementationCiGateV1;
  requireCondition(gate.schema === IMP24_IMPLEMENTATION_CI_GATE_SCHEMA, "r2 implementation CI gate schema mismatch");
  validateImp24ImplementationCiGate({
    gate,
    expectedHeadSha: proof.implementationHeadSha,
    checkout: gate.trustedEvidence.raw.checkout,
  });
  requireCondition(gate.gateSha256 === proof.implementationCiGateSha256
      && sha256Hex(gateArtifact.bytes) === proof.implementationCiGateBytesSha256,
    "r2 qualification proof does not bind the exact implementation CI gate");
  requireCondition(terminal.value.reportSha256 === proof.qualificationReportSha256
      && sha256Hex(terminal.bytes) === proof.qualificationReportBytesSha256,
    "r2 qualification proof does not bind the exact terminal report");

  const docsQualificationJson = resolve(repositoryRoot, IMP24D_R2_REPORT_PATHS.qualificationJson);
  const docsQualificationMarkdown = resolve(repositoryRoot, IMP24D_R2_REPORT_PATHS.qualificationMarkdown);
  requireCondition(existsSync(docsQualificationJson) && readFileSync(docsQualificationJson).equals(terminal.bytes),
    "R2 qualification JSON report is not the exact state-report mirror");
  requireCondition(existsSync(docsQualificationMarkdown)
      && readFileSync(docsQualificationMarkdown, "utf8") === renderRoleQualificationV3LiveResultMarkdown({
        result,
        ledger: loaded.retainedQualificationEvidence.ledger,
        gate,
      }), "R2 qualification Markdown is not the deterministic retained-evidence rendering");

  const ready = result.roleSetReady;
  const roleFreeze = loaded.roleFreeze;
  let roleAssignmentBytesSha256: string | null = null;
  const terminalArtifactBytes = asObject(terminal.value.artifactBytesSha256,
    "r2 terminal report artifact byte hashes");
  if (ready) {
    requireCondition(roleFreeze !== null, "role-ready r2 qualification has no role-assignment freeze");
    const roleStateBytes = readFileSync(resolve(artifactRoot, ROLE_ASSIGNMENT_REL));
    roleAssignmentBytesSha256 = sha256Hex(roleStateBytes);
    requireCondition(roleFreeze.freezeSha256 === proof.roleAssignmentFreezeSha256,
      "r2 role-assignment semantic hash differs from retained qualification proof");
    requireCondition(roleAssignmentBytesSha256 === terminalArtifactBytes.roleAssignmentFreeze,
      "r2 role-assignment bytes differ from the terminal campaign binding");
    requireCondition(readFileSync(resolve(repositoryRoot, IMP24D_R2_REPORT_PATHS.roleAssignmentJson)).equals(roleStateBytes),
      "R2 role-assignment JSON is not the exact state-freeze mirror");
    requireCondition(readFileSync(resolve(repositoryRoot, IMP24D_R2_REPORT_PATHS.roleAssignmentMarkdown), "utf8")
      === renderRoleAssignmentFreezeV3Markdown({
        freeze: roleFreeze,
        result,
        ledger: loaded.retainedQualificationEvidence.ledger,
      }), "R2 role-assignment Markdown is not the deterministic retained-evidence rendering");
  } else {
    requireCondition(roleFreeze === null && proof.roleAssignmentFreezeSha256 === null,
      "blocked r2 qualification contains a role-assignment freeze");
  }

  const baseAttempts = result.attempts.filter((attempt) => attempt.request.attemptNumber === 1);
  const canaryCalls = baseAttempts.filter((attempt) => attempt.request.partition === "canary").length;
  const holdoutCalls = baseAttempts.filter((attempt) => attempt.request.partition === "holdout").length;
  const qualifiedProfiles = [...new Set(Object.values(result.qualifiers).flat())].sort();
  const roleAssignmentPolicySha256 = roleFreeze === null ? null : hashCanonical({
    roleAssignmentSha256: roleFreeze.roleAssignmentSha256,
    roleProfileBindingsSha256: roleFreeze.roleProfileBindingsSha256,
    auditSubsetPolicySha256: roleFreeze.auditSubsetPolicySha256,
    escalationPolicySha256: roleFreeze.escalationPolicySha256,
    disagreementPolicySha256: roleFreeze.disagreementPolicySha256,
    panelPolicySha256: roleFreeze.panelPolicySha256,
  });
  const certification = loaded.currentQualification.certification;
  const attemptIds = loaded.retainedQualificationEvidence.ledger.entries.map((entry) => entry.attemptId).sort();
  const requestTimes = loaded.retainedQualificationEvidence.ledger.entries.map((entry) => Date.parse(entry.requestedAt));
  requireCondition(requestTimes.length > 0 && requestTimes.every(Number.isFinite),
    "r2 qualification ledger has no valid request chronology");
  const binding: Imp24DQualificationBinding = {
    status: ready ? "ROLE_SET_READY" : "ROLE_SET_NOT_READY",
    blockedReason: ready ? null : (result.roleSetBlockedReason ?? "ROLE_SET_NOT_READY"),
    root: QUALIFICATION_ROOT_REL,
    terminalReportPath: QUALIFICATION_REPORT_REL,
    terminalReportBytesSha256: proof.qualificationReportBytesSha256,
    terminalReportSha256: proof.qualificationReportSha256,
    roleAssignmentPath: ready ? ROLE_ASSIGNMENT_REL : null,
    roleAssignmentBytesSha256,
    roleAssignmentFreezeSha256: roleFreeze?.freezeSha256 ?? null,
    implementationCiGatePath: IMPLEMENTATION_CI_GATE_REL,
    implementationCiGateSha256: proof.implementationCiGateSha256,
    implementationCiGateBytesSha256: proof.implementationCiGateBytesSha256,
    qualificationResultSha256: proof.qualificationResultSha256,
    qualificationFreezeSha256: proof.qualificationFreezeSha256,
    callLedgerSha256: proof.callLedgerSha256,
    callLedgerBytesSha256: proof.callLedgerBytesSha256,
    attemptEvidenceSetSha256: proof.attemptEvidenceSetSha256,
    processDiagnosticsSetSha256: processDiagnosticsSetSha256(repositoryRoot, loaded),
    preflightVerifiedAt: loaded.retainedPreflight.verifiedAt,
    earliestRequestAt: new Date(Math.min(...requestTimes)).toISOString(),
    attemptIds,
    roles: roleSelection(roleFreeze),
    qualifiedProfiles,
    certificationSha256: certification.certificationSha256,
    productionSealSha256: certification.productionInstrumentSealSha256,
    productionQualificationParitySha256: certification.productionQualificationParitySha256,
    qualificationSemanticProjectionSha256: qualificationSemanticProjectionSha256(loaded),
    corpusBundleSha256: certification.corpusBundleSha256,
    thresholdsSha256: certification.thresholdsSha256,
    promptSourceHashesSha256: hashCanonical(loaded.currentQualification.promptSourceHashes),
    schemaHashesSha256: hashCanonical(loaded.currentQualification.schemaHashes),
    routeBindingSha256: hashCanonical(loaded.currentQualification.routeBinding),
    roleAssignmentPolicySha256,
    callCounts: {
      canaryCalls,
      holdoutCalls,
      infrastructureReplays: result.infrastructureReplays,
      maxPlanEvents: loaded.retainedQualificationEvidence.ledger.maxPlanCapacityEvents,
      totalAttempts: result.totalAttempts,
      codexExecInvocations: loaded.retainedQualificationEvidence.ledger.codexExecInvocations,
      apiCalls: 0,
    },
  };
  validateQualification(binding);
  return { binding, gate };
}

function loadTransportSmokeBinding(
  repositoryRoot: string,
  expectedImplementationHeadSha: string,
): Imp24DTransportSmokeBinding {
  const verified = verifyRetainedImp24DTransportSmoke({
    repositoryRoot,
    expectedImplementationHeadSha,
  });
  const cycles: Imp24DTransportSmokeCycleBinding[] = verified.cycles.map((cycle, index) => {
    const retained = verified.report.cycles[index];
    requireCondition(retained !== undefined && retained.executionId === cycle.executionId,
      "verified transport-smoke cycle projection drift");
    return {
      ...cycle,
      workflowRunId: retained.workflowRunId,
      result: retained.status,
      implementationCiVerifiedAt: retained.implementationCiVerifiedAt,
      startedAt: retained.startedAt,
      completedAt: retained.completedAt,
    };
  });
  const processDiagnosticsAggregate = hashCanonical(cycles.map((cycle) => ({
    executionId: cycle.executionId,
    processDiagnosticsSetSha256: cycle.processDiagnosticsSetSha256,
  })));
  const binding: Imp24DTransportSmokeBinding = {
    status: "PASS",
    reportPath: IMP24D_TRANSPORT_SMOKE_REPORT_JSON_REL_PATH,
    reportBytesSha256: verified.reportBytesSha256,
    markdownPath: IMP24D_TRANSPORT_SMOKE_REPORT_MARKDOWN_REL_PATH,
    markdownBytesSha256: verified.reportMarkdownBytesSha256,
    observabilityImplementationCommit: verified.observabilityImplementationCommit,
    correctionCommit: verified.correctionCommit,
    effectiveImplementationCommit: verified.effectiveImplementationCommit,
    cycles,
    totalCalls: verified.totalCalls,
    processDiagnosticsSetSha256: processDiagnosticsAggregate,
    modelCalls: verified.modelCalls,
    apiCalls: 0,
  };
  validateSmoke(binding);
  return binding;
}

function loadProductionEvidence(
  repositoryRoot: string,
  artifactRoot: string,
  implementationCommit: string,
): { evidence: Imp24DFinalEvidence; qualificationGate: Imp24ImplementationCiGateV1 } {
  requireCondition(repositoryRoot === resolve(IMP24_PILOT_GOLD_FIXED_PATHS.repositoryRoot)
      && artifactRoot === repositoryRoot,
    "production IMP-24D final attestation requires the authoritative repository/artifact root");
  assertForbiddenRunRootsAbsent(repositoryRoot, [
    IMP24_PILOT_GOLD_FIXED_PATHS.pilotRoot,
    IMP24_PILOT_GOLD_FIXED_PATHS.goldRoot,
    resolve(repositoryRoot, EXPERIMENTS_REL, "s16-forward-local-activation-v3-envelope"),
  ]);
  const transportSmoke = loadTransportSmokeBinding(repositoryRoot, implementationCommit);
  const observabilityVerification = verifyHistoricalImp24DObservabilityFreeze({
    repositoryRoot,
    observabilityImplementationCommit: transportSmoke.observabilityImplementationCommit,
  });
  requireCondition(observabilityVerification.writes === 0
      && observabilityVerification.modelCalls === 0
      && observabilityVerification.apiCalls === 0,
    "IMP-24D observability freeze verification crossed a forbidden capability boundary");
  const historical = loadObservabilityAndR1(artifactRoot);
  requireCondition(observabilityVerification.freezeSha256 === historical.observabilityFreeze.freezeSha256,
    "deterministic observability-freeze verification differs from the retained final input");
  const qualification = loadQualificationBinding(repositoryRoot, artifactRoot);
  const finalSmoke = transportSmoke.cycles.at(-1)!;
  requireCondition(
    observabilityVerification.originalImplementation.certificationSha256
      === historical.observabilityFreeze.certificationSha256
      && observabilityVerification.originalImplementation.productionInstrumentSealSha256
        === historical.observabilityFreeze.productionSealSha256
      && observabilityVerification.originalImplementation.productionQualificationParitySha256
        === historical.observabilityFreeze.productionQualificationParitySha256,
    "historical observability verification differs from the retained Commit-A instrument",
  );
  requireCondition(
    observabilityVerification.effectiveImplementation.certificationSha256 === finalSmoke.certificationSha256
      && observabilityVerification.effectiveImplementation.productionInstrumentSealSha256
        === finalSmoke.productionInstrumentSealSha256
      && observabilityVerification.effectiveImplementation.productionQualificationParitySha256
        === finalSmoke.productionQualificationParitySha256,
    "current reminted instrument differs from the final passing smoke instrument",
  );
  requireCondition(qualification.gate.headSha === transportSmoke.effectiveImplementationCommit
      && qualification.gate.workflow.runId === transportSmoke.cycles.at(-1)?.workflowRunId,
    "r2 qualification gate does not bind the final passing smoke implementation/run identity");
  const evidenceRoots = [
    SMOKE_ROOT_REL,
    ...(transportSmoke.correctionCommit === null ? [] : [SMOKE_R2_ROOT_REL]),
    QUALIFICATION_ROOT_REL,
  ];
  const evidence: Imp24DFinalEvidence = {
    ...historical,
    transportSmoke,
    qualification: qualification.binding,
    evidenceRoots,
    evidenceFiles: [
      IMP24D_TRANSPORT_SMOKE_REPORT_JSON_REL_PATH,
      IMP24D_TRANSPORT_SMOKE_REPORT_MARKDOWN_REL_PATH,
      IMP24D_R2_REPORT_PATHS.qualificationJson,
      IMP24D_R2_REPORT_PATHS.qualificationMarkdown,
      ...(qualification.binding.status === "ROLE_SET_READY"
        ? [IMP24D_R2_REPORT_PATHS.roleAssignmentJson, IMP24D_R2_REPORT_PATHS.roleAssignmentMarkdown]
        : []),
    ],
    evidenceInventories: Object.fromEntries(evidenceRoots.map((root) => [root, currentTreeFiles(repositoryRoot, root)])),
  };
  validateEvidence(evidence);
  return { evidence, qualificationGate: qualification.gate };
}

function buildProduction(
  options: BuildImp24DFinalAttestationOptions,
  checkoutMode: FinalCheckoutMode,
): {
  built: Imp24DFinalAttestationBuild;
  qualificationGate: Imp24ImplementationCiGateV1;
  smoke: Imp24DTransportSmokeBinding;
} {
  const repositoryRoot = resolve(options.repositoryRoot);
  const artifactRoot = resolve(options.artifactRoot ?? repositoryRoot);
  requireGitSha(options.implementationCommit, "effective implementation commit");
  requireGitSha(options.evidenceCommit, "evidence commit");
  const loaded = loadProductionEvidence(repositoryRoot, artifactRoot, options.implementationCommit);
  const built = buildFromValidatedEvidence({
    repositoryRoot,
    baselineCommit: IMP24D_STARTING_HEAD,
    implementationCommit: options.implementationCommit,
    evidenceCommit: options.evidenceCommit,
    evidence: loaded.evidence,
    checkoutMode,
  });
  return { built, qualificationGate: loaded.qualificationGate, smoke: loaded.evidence.transportSmoke };
}

export function buildImp24DFinalAttestation(
  options: BuildImp24DFinalAttestationOptions,
): Imp24DFinalAttestationBuild {
  return buildProduction(options, "PRE_MATERIALIZATION").built;
}

export function materializeImp24DFinalAttestation(
  options: BuildImp24DFinalAttestationOptions,
): Imp24DFinalAttestationMaterialization {
  const production = buildProduction(options, "PRE_MATERIALIZATION");
  return materializeBuilt(production.built, resolve(options.artifactRoot ?? options.repositoryRoot));
}

export function verifyImp24DFinalAttestation(
  options: BuildImp24DFinalAttestationOptions,
): Imp24DFinalAttestationVerification {
  const production = buildProduction(options, "RETAINED_FINAL");
  return verifyBuilt(production.built, resolve(options.artifactRoot ?? options.repositoryRoot));
}

/** Reconstruct the two non-self-referential commit inputs from the retained D
 * report, then perform deterministic byte verification plus read-only live
 * provenance checks for each exact implementation CI gate. */
export function verifyRetainedImp24DFinalAttestation(args: {
  repositoryRoot: string;
  artifactRoot?: string;
}): Imp24DFinalAttestationVerification {
  const repositoryRoot = resolve(args.repositoryRoot);
  const artifactRoot = resolve(args.artifactRoot ?? repositoryRoot);
  const retained = readArtifact(artifactRoot, IMP24D_FINAL_ATTESTATION_PATHS.attestationJson,
    "retained IMP-24D final attestation");
  const attestation = retained.value as unknown as Imp24DFinalAttestation;
  requireCondition(attestation.schema === IMP24D_FINAL_ATTESTATION_SCHEMA
      && attestation.continuationPromptId === "IMP-24D"
      && attestation.executionId === IMP24_ROLE_QUALIFICATION_R2_EXECUTION_ID
      && attestation.startingHead === IMP24D_STARTING_HEAD,
    "retained IMP-24D final attestation lifecycle identity mismatch");
  const { attestationSha256, ...core } = attestation;
  requireCondition(SHA256.test(attestationSha256) && hashCanonical(core) === attestationSha256,
    "retained IMP-24D final attestation self hash drift");
  const production = buildProduction({
    repositoryRoot,
    artifactRoot,
    implementationCommit: attestation.effectiveImplementationCommit,
    evidenceCommit: attestation.evidenceCommit,
  }, "RETAINED_FINAL");
  const verified = verifyBuilt(production.built, artifactRoot);
  const smokeVerified = verifyRetainedImp24DTransportSmoke({
    repositoryRoot,
    expectedImplementationHeadSha: attestation.effectiveImplementationCommit,
  });
  for (const cycle of smokeVerified.report.cycles) {
    const gatePath = resolve(repositoryRoot, cycle.stateRoot, "implementation-ci-gate.json");
    const gate = parseJson(
      readFileSync(gatePath),
      `${cycle.executionId}: implementation CI gate`,
    ) as unknown as Imp24ImplementationCiGateV1;
    reverifyImp24ImplementationCiGateLive({ repositoryRoot, gate });
  }
  reverifyImp24ImplementationCiGateLive({ repositoryRoot, gate: production.qualificationGate });
  return verified;
}


function buildFixture(
  options: BuildImp24DFinalAttestationFixtureOptions,
  checkoutMode: FinalCheckoutMode,
): Imp24DFinalAttestationBuild {
  const repositoryRoot = resolve(options.repositoryRoot);
  const artifactRoot = resolve(options.artifactRoot ?? repositoryRoot);
  requireCondition(repositoryRoot !== resolve(IMP24_PILOT_GOLD_FIXED_PATHS.repositoryRoot),
    "fixture final-attestation entrypoints are forbidden in the authoritative repository");
  requireCondition(artifactRoot === repositoryRoot,
    "IMP-24D final-attestation fixture requires one repository/artifact root for commit ownership");
  const expectedForbiddenRoots = [
    relative(IMP24_PILOT_GOLD_FIXED_PATHS.repositoryRoot, IMP24_PILOT_GOLD_FIXED_PATHS.pilotRoot).replace(/\\/g, "/"),
    relative(IMP24_PILOT_GOLD_FIXED_PATHS.repositoryRoot, IMP24_PILOT_GOLD_FIXED_PATHS.goldRoot).replace(/\\/g, "/"),
    `${EXPERIMENTS_REL}/s16-forward-local-activation-v3-envelope`,
  ].sort();
  requireCondition(Array.isArray(options.forbiddenRunRoots)
      && canonicalJson(options.forbiddenRunRoots.map((root) =>
        relative(repositoryRoot, isAbsolute(root) ? resolve(root) : resolve(repositoryRoot, root)).replace(/\\/g, "/")).sort())
        === canonicalJson(expectedForbiddenRoots),
    "fixture must supply all three exact forbidden pilot/gold/activation roots");
  assertForbiddenRunRootsAbsent(repositoryRoot, options.forbiddenRunRoots);
  return buildFromValidatedEvidence({
    repositoryRoot,
    baselineCommit: options.lifecycleBaselineCommit,
    implementationCommit: options.implementationCommit,
    evidenceCommit: options.evidenceCommit,
    evidence: options.evidence,
    checkoutMode,
  });
}

export function buildImp24DFinalAttestationForFixture(
  options: BuildImp24DFinalAttestationFixtureOptions,
): Imp24DFinalAttestationBuild {
  return buildFixture(options, "PRE_MATERIALIZATION");
}

function materializeBuilt(
  built: Imp24DFinalAttestationBuild,
  artifactRoot: string,
): Imp24DFinalAttestationMaterialization {
  const outputs = {} as Imp24DFinalAttestationMaterialization["outputs"];
  for (const [key, item] of Object.entries(built.outputs) as Array<[
    keyof typeof IMP24D_FINAL_ATTESTATION_PATHS,
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
    schema: "imp24d-final-attestation-materialization-v1",
    attestationSha256: built.attestation.attestationSha256,
    outputs,
    writes: 3,
    modelCalls: 0,
    apiCalls: 0,
  };
}

function verifyBuilt(
  built: Imp24DFinalAttestationBuild,
  artifactRoot: string,
): Imp24DFinalAttestationVerification {
  const head = currentHead(artifactRoot);
  for (const [key, item] of Object.entries(built.outputs)) {
    const absolutePath = resolve(artifactRoot, item.relativePath);
    requireCondition(existsSync(absolutePath), `${key}: committed IMP-24D terminal artifact is missing`);
    const retained = readFileSync(absolutePath);
    requireCondition(retained.toString("utf8") === item.bytes,
      `${key}: committed IMP-24D terminal artifact differs byte-for-byte from deterministic materialization`);
    requireCondition(sha256Hex(retained) === item.bytesSha256,
      `${key}: committed IMP-24D terminal artifact bytes hash drift`);
    assertCommittedBytes(artifactRoot, head, item.relativePath, `${key}: final attestation output`);
  }
  return {
    schema: "imp24d-final-attestation-verification-v1",
    status: "VERIFIED_BYTE_IDENTICAL_IMP24D_FINAL_ATTESTATION",
    attestationSha256: built.attestation.attestationSha256,
    verifiedOutputCount: 3,
    writes: 0,
    modelCalls: 0,
    apiCalls: 0,
  };
}

export function materializeImp24DFinalAttestationForFixture(
  options: BuildImp24DFinalAttestationFixtureOptions,
): Imp24DFinalAttestationMaterialization {
  return materializeBuilt(
    buildFixture(options, "PRE_MATERIALIZATION"),
    resolve(options.artifactRoot ?? options.repositoryRoot),
  );
}

export function verifyImp24DFinalAttestationForFixture(
  options: BuildImp24DFinalAttestationFixtureOptions,
): Imp24DFinalAttestationVerification {
  return verifyBuilt(
    buildFixture(options, "RETAINED_FINAL"),
    resolve(options.artifactRoot ?? options.repositoryRoot),
  );
}
