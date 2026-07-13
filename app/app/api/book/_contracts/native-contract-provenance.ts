import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, posix, resolve } from "node:path";

export type NativeContractCommittedProvenancePhase =
  | "committed_backend_branch"
  | "merged_backend";

export type NativeContractGitProvenanceOptions = {
  repoRoot: string;
  sourceRevision: string;
  sourceRevisionPhase: NativeContractCommittedProvenancePhase;
  trustedMainRef: string;
  requiredInputPaths: readonly string[];
  expectedMissingInputPaths: readonly string[];
  contractArtifactPath: string;
};

export type VerifiedNativeContractGitProvenance = {
  sourceRevision: string;
  sourceRevisionPhase: NativeContractCommittedProvenancePhase;
  trustedMainRef: string;
  trustedMainRevision: string;
  contractArtifactBlob: string;
  inputTreeDigest: string;
  verifiedInputPaths: string[];
  verifiedMissingInputPaths: string[];
};

type GitResult = {
  status: number;
  stdout: Buffer;
  stderr: Buffer;
};

function git(repoRoot: string, args: string[]): GitResult {
  const result = spawnSync("git", args, {
    cwd: repoRoot,
    encoding: "buffer",
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.error) {
    throw new Error(`unable to run git ${args[0] ?? "command"}: ${result.error.message}`);
  }
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? Buffer.alloc(0),
    stderr: result.stderr ?? Buffer.alloc(0),
  };
}

function gitText(repoRoot: string, args: string[], description: string): string {
  const result = git(repoRoot, args);
  if (result.status !== 0) {
    const detail = result.stderr.toString("utf8").trim();
    throw new Error(`${description}${detail ? `: ${detail}` : ""}`);
  }
  return result.stdout.toString("utf8").trim();
}

function normalizeRepoPath(path: string, label: string): string {
  const normalized = posix.normalize(path);
  if (
    path.length === 0 ||
    path.includes("\0") ||
    path.includes(":") ||
    isAbsolute(path) ||
    normalized === "." ||
    normalized === ".." ||
    normalized.startsWith("../") ||
    normalized !== path
  ) {
    throw new Error(`${label} must be a normalized repository-relative path: ${path}`);
  }
  return path;
}

function sortedUniquePaths(paths: readonly string[], label: string): string[] {
  const normalized = paths.map((path) => normalizeRepoPath(path, label));
  const unique = [...new Set(normalized)].sort();
  if (unique.length !== normalized.length) {
    throw new Error(`${label} must not contain duplicate paths`);
  }
  return unique;
}

function gitObjectExists(repoRoot: string, object: string): boolean {
  return git(repoRoot, ["cat-file", "-e", object]).status === 0;
}

function readGitBlob(repoRoot: string, revision: string, path: string): Buffer {
  const object = `${revision}:${path}`;
  if (!gitObjectExists(repoRoot, object)) {
    throw new Error(`required contract input is missing at ${revision}: ${path}`);
  }
  const objectType = gitText(
    repoRoot,
    ["cat-file", "-t", object],
    `unable to inspect contract input ${path}`
  );
  if (objectType !== "blob") {
    throw new Error(`required contract input is not a file at ${revision}: ${path}`);
  }
  const result = git(repoRoot, ["show", object]);
  if (result.status !== 0) {
    const detail = result.stderr.toString("utf8").trim();
    throw new Error(`unable to read contract input ${path}${detail ? `: ${detail}` : ""}`);
  }
  return result.stdout;
}

function gitBlobId(repoRoot: string, revision: string, path: string): string | undefined {
  const object = `${revision}:${path}`;
  if (!gitObjectExists(repoRoot, object)) return undefined;
  const objectType = gitText(
    repoRoot,
    ["cat-file", "-t", object],
    `unable to inspect contract artifact ${path}`
  );
  if (objectType !== "blob") return undefined;
  return gitText(
    repoRoot,
    ["rev-parse", "--verify", object],
    `unable to resolve contract artifact ${path}`
  );
}

function isAncestor(repoRoot: string, ancestor: string, descendant: string): boolean {
  const result = git(repoRoot, ["merge-base", "--is-ancestor", ancestor, descendant]);
  if (result.status === 0) return true;
  if (result.status === 1) return false;
  const detail = result.stderr.toString("utf8").trim();
  throw new Error(
    `unable to establish Git ancestry between ${ancestor} and ${descendant}${
      detail ? `: ${detail}` : ""
    }`
  );
}

function artifactBlobAppearsInHistory(
  repoRoot: string,
  trustedMainRevision: string,
  contractArtifactPath: string,
  contractArtifactBlob: string
): boolean {
  const revisions = gitText(
    repoRoot,
    ["rev-list", trustedMainRevision, "--", contractArtifactPath],
    "unable to inspect trusted-main contract artifact history"
  );
  if (!revisions) return false;
  for (const revision of revisions.split("\n")) {
    if (gitBlobId(repoRoot, revision, contractArtifactPath) === contractArtifactBlob) {
      return true;
    }
  }
  return false;
}

function assertNonShallowRepository(repoRoot: string): void {
  const shallow = gitText(
    repoRoot,
    ["rev-parse", "--is-shallow-repository"],
    "unable to inspect repository history"
  );
  if (shallow !== "false") {
    throw new Error("native contract provenance requires complete non-shallow Git history");
  }
}

function resolveSourceRevision(repoRoot: string, sourceRevision: string): string {
  if (!/^[0-9a-f]{40}$/.test(sourceRevision)) {
    throw new Error("contract source revision must be a full lowercase Git SHA");
  }
  const resolved = gitText(
    repoRoot,
    ["rev-parse", "--verify", `${sourceRevision}^{commit}`],
    `contract source revision does not exist: ${sourceRevision}`
  );
  if (resolved !== sourceRevision) {
    throw new Error(`contract source revision did not resolve exactly: ${sourceRevision}`);
  }
  return resolved;
}

function resolveTrustedMainRevision(repoRoot: string, trustedMainRef: string): string {
  if (!/^refs\/(?:heads|remotes)\/[A-Za-z0-9._/-]+$/.test(trustedMainRef)) {
    throw new Error("trusted main must be an explicit refs/heads/... or refs/remotes/... ref");
  }
  const exists = git(repoRoot, ["show-ref", "--verify", "--quiet", trustedMainRef]);
  if (exists.status !== 0) {
    throw new Error(`trusted main ref does not exist: ${trustedMainRef}`);
  }
  return gitText(
    repoRoot,
    ["rev-parse", "--verify", `${trustedMainRef}^{commit}`],
    `trusted main ref does not resolve to a commit: ${trustedMainRef}`
  );
}

function assertRelevantInputsClean(repoRoot: string, paths: string[]): void {
  const status = git(repoRoot, [
    "status",
    "--porcelain=v1",
    "--untracked-files=all",
    "--",
    ...paths,
  ]);
  if (status.status !== 0) {
    const detail = status.stderr.toString("utf8").trim();
    throw new Error(`unable to inspect relevant contract input status${detail ? `: ${detail}` : ""}`);
  }
  const dirty = status.stdout.toString("utf8").trim();
  if (dirty) {
    throw new Error(`relevant contract inputs are not clean:\n${dirty}`);
  }
}

function assertExactContractChangingRevision(
  repoRoot: string,
  sourceRevision: string,
  relevantPaths: string[]
): void {
  const latest = gitText(
    repoRoot,
    ["log", "-1", "--format=%H", sourceRevision, "--", ...relevantPaths],
    "unable to find the latest contract-changing revision"
  );
  if (latest !== sourceRevision) {
    throw new Error(
      `source revision is not the latest commit changing the supplied contract inputs: ${latest}`
    );
  }
}

function inputTreeDigest(
  sourceRevision: string,
  blobs: ReadonlyMap<string, Buffer>,
  expectedMissingPaths: string[]
): string {
  const hash = createHash("sha256");
  hash.update(sourceRevision);
  hash.update("\0");
  for (const path of [...blobs.keys()].sort()) {
    hash.update(path);
    hash.update("\0");
    hash.update(blobs.get(path) ?? Buffer.alloc(0));
    hash.update("\0");
  }
  for (const path of expectedMissingPaths) {
    hash.update(path);
    hash.update("\0<expected-missing>\0");
  }
  return hash.digest("hex");
}

export function assertNativeContractGitProvenance(
  options: NativeContractGitProvenanceOptions
): VerifiedNativeContractGitProvenance {
  const repoRoot = resolve(options.repoRoot);
  const contractArtifactPath = normalizeRepoPath(
    options.contractArtifactPath,
    "contract artifact path"
  );
  const requiredInputPaths = sortedUniquePaths(
    [...options.requiredInputPaths, contractArtifactPath],
    "required contract input paths"
  );
  const expectedMissingInputPaths = sortedUniquePaths(
    options.expectedMissingInputPaths,
    "expected-missing contract input paths"
  );
  const overlap = expectedMissingInputPaths.find((path) => requiredInputPaths.includes(path));
  if (overlap) {
    throw new Error(`contract input cannot be both required and expected missing: ${overlap}`);
  }

  assertNonShallowRepository(repoRoot);
  const sourceRevision = resolveSourceRevision(repoRoot, options.sourceRevision);
  const head = gitText(repoRoot, ["rev-parse", "--verify", "HEAD^{commit}"], "HEAD is invalid");
  if (head !== sourceRevision) {
    throw new Error(`backend HEAD ${head} does not equal contract source revision ${sourceRevision}`);
  }
  const trustedMainRevision = resolveTrustedMainRevision(repoRoot, options.trustedMainRef);

  const blobs = new Map<string, Buffer>();
  for (const path of requiredInputPaths) {
    const revisionBytes = readGitBlob(repoRoot, sourceRevision, path);
    const worktreePath = resolve(repoRoot, path);
    if (!existsSync(worktreePath)) {
      throw new Error(`required contract input is missing from the worktree: ${path}`);
    }
    blobs.set(path, revisionBytes);
  }
  for (const path of expectedMissingInputPaths) {
    if (gitObjectExists(repoRoot, `${sourceRevision}:${path}`)) {
      throw new Error(`expected-missing contract input exists at ${sourceRevision}: ${path}`);
    }
    if (existsSync(resolve(repoRoot, path))) {
      throw new Error(`expected-missing contract input exists in the worktree: ${path}`);
    }
  }

  const relevantPaths = [...requiredInputPaths, ...expectedMissingInputPaths].sort();
  assertRelevantInputsClean(repoRoot, relevantPaths);
  for (const [path, revisionBytes] of blobs) {
    const worktreeBytes = readFileSync(resolve(repoRoot, path));
    if (!worktreeBytes.equals(revisionBytes)) {
      throw new Error(`contract input bytes do not match ${sourceRevision}: ${path}`);
    }
  }
  assertExactContractChangingRevision(repoRoot, sourceRevision, relevantPaths);

  const sourceIsInTrustedMain = isAncestor(repoRoot, sourceRevision, trustedMainRevision);
  const contractArtifactBlob = gitBlobId(repoRoot, sourceRevision, contractArtifactPath);
  if (!contractArtifactBlob) {
    throw new Error(`contract artifact is not a Git blob at ${sourceRevision}: ${contractArtifactPath}`);
  }
  if (options.sourceRevisionPhase === "committed_backend_branch") {
    if (sourceIsInTrustedMain) {
      throw new Error("committed backend branch revision is already reachable from trusted main");
    }
    if (
      artifactBlobAppearsInHistory(
        repoRoot,
        trustedMainRevision,
        contractArtifactPath,
        contractArtifactBlob
      )
    ) {
      throw new Error(
        "committed backend branch contract artifact is already integrated into trusted main"
      );
    }
  } else if (options.sourceRevisionPhase === "merged_backend") {
    if (!sourceIsInTrustedMain) {
      throw new Error("merged backend revision is not reachable from trusted main");
    }
  } else {
    const unreachable: never = options.sourceRevisionPhase;
    throw new Error(`unsupported native contract provenance phase: ${String(unreachable)}`);
  }

  return {
    sourceRevision,
    sourceRevisionPhase: options.sourceRevisionPhase,
    trustedMainRef: options.trustedMainRef,
    trustedMainRevision,
    contractArtifactBlob,
    inputTreeDigest: inputTreeDigest(sourceRevision, blobs, expectedMissingInputPaths),
    verifiedInputPaths: requiredInputPaths,
    verifiedMissingInputPaths: expectedMissingInputPaths,
  };
}
