/**
 * WP-E12 — typed subprocess driver for the ChapterFlow Book Evaluator skill's
 * deterministic python scripts (owner policy §3.1 of
 * docs/v25/V25_EVALUATOR_AND_MODEL_SELECTION_EXECUTION_PLAN.md).
 *
 * The skill (`.agents/skills/chapterflow-book-evaluator/scripts/*.py`) is a
 * READ-ONLY asset — zero skill-file edits, ever. This module only knows how to
 * SPAWN it: build the argv, run `python3` with cwd = the outer git worktree
 * root (where `.agents/skills/**` actually lives — NOT this package's own
 * `REPO_ROOT`, which `chapterPaths.ts` deliberately defines as the PIPELINE
 * package root; see `MONOREPO_ANCESTOR` there), capture stdout/stderr/exit
 * code, and parse the scripts' own JSON output into typed results. It never
 * re-implements any of the skill's scoring, hashing, or receipt logic.
 *
 * Covers the four scripts this WP's callers need:
 *   - inspect_package.py        — structural inventory + source hash
 *   - issue_worker_receipts.py  — two source-bound dispatch receipts (blind pair)
 *   - seal_blind_pair_receipt.py — seals two worker results to their receipts
 *   - validate_book_result.py   — arithmetic + contract validation (always run
 *     with `--json`; callers choose `requireFullContent` explicitly — the
 *     evaluator lane always wants `true`, since chapter sampling is disabled).
 *
 * `tempRoot` on every function below is OPTIONAL and forwarded as `--temp-root`
 * only when set; omitting it lets the script fall back to ITS OWN default
 * (`.chapterflow-*-tmp`, relative to cwd = `repoRoot`) — a real caller running
 * many diagnostics should always pass an explicit `tempRoot` scoped to its own
 * run, or debris accumulates at the worktree root.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { MONOREPO_ANCESTOR } from "../lib/chapterPaths.js";

export const EVALUATOR_SKILL_SCRIPTS_REL_DIR = ".agents/skills/chapterflow-book-evaluator/scripts";

export const EVALUATOR_SKILL_SCRIPTS = {
  inspectPackage: "inspect_package.py",
  issueWorkerReceipts: "issue_worker_receipts.py",
  sealBlindPairReceipt: "seal_blind_pair_receipt.py",
  validateBookResult: "validate_book_result.py",
} as const;

export class EvaluatorSkillHarnessError extends Error {
  readonly detail?: { exitCode: number | null; stdout: string; stderr: string; command: string[] };

  constructor(message: string, detail?: { exitCode: number | null; stdout: string; stderr: string; command: string[] }) {
    super(message);
    this.name = "EvaluatorSkillHarnessError";
    this.detail = detail;
  }
}

export type EvaluatorSkillProcessResult = {
  script: string;
  command: string[];
  cwd: string;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
};

export type EvaluatorSkillHarnessOptions = {
  /** Absolute path to the git worktree root that carries `.agents/skills/**`.
   *  Defaults to `MONOREPO_ANCESTOR` (verified on disk for every checkout of
   *  this pipeline, including its lane worktrees — see chapterPaths.ts). */
  repoRoot?: string;
  /** Override the python3 binary. Production callers should never set this;
   *  it exists so tests can exercise the "missing interpreter" path. */
  pythonBin?: string;
  /** Subprocess timeout in ms. The skill's scripts are offline and
   *  deterministic — they should never legitimately run long — so a hang past
   *  this is treated as a harness-level failure, not patience. */
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 30_000;

/** Cheap preflight: throws a helpful, specific error if `pythonBin` is not on
 *  PATH, instead of letting callers discover it from a generic ENOENT deep in
 *  a later spawn. Safe to call repeatedly (a few ms each). */
export function assertPython3Available(pythonBin = "python3"): void {
  const probe = spawnSync(pythonBin, ["--version"], { encoding: "utf8" });
  if (probe.error) {
    throw pythonSpawnError(pythonBin, probe.error, "probe");
  }
}

function pythonSpawnError(pythonBin: string, error: NodeJS.ErrnoException, script: string): EvaluatorSkillHarnessError {
  if (error.code === "ENOENT") {
    return new EvaluatorSkillHarnessError(
      `"${pythonBin}" was not found on PATH — the evaluator-skill harness requires a python3 interpreter ` +
      `(stdlib only, no third-party packages) to run ${script}. Install python3, or pass { pythonBin } pointing ` +
      `at a working interpreter.`);
  }
  return new EvaluatorSkillHarnessError(`failed to spawn "${pythonBin}" for ${script}: ${error.message}`);
}

function scriptPath(repoRoot: string, script: string): string {
  return resolve(repoRoot, EVALUATOR_SKILL_SCRIPTS_REL_DIR, script);
}

/** Spawn one skill script and capture its result. Never throws on a normal
 *  nonzero exit (that is legitimate script output, e.g. `validate_book_result.py`
 *  reporting an invalid record) — only on inability to run it at all (missing
 *  interpreter, missing script file, timeout/signal). */
function runPython(script: string, args: string[], options: EvaluatorSkillHarnessOptions = {}): EvaluatorSkillProcessResult {
  const repoRoot = options.repoRoot ?? MONOREPO_ANCESTOR;
  const pythonBin = options.pythonBin ?? "python3";
  const target = scriptPath(repoRoot, script);
  const command = [pythonBin, target, ...args];

  if (!existsSync(target)) {
    throw new EvaluatorSkillHarnessError(
      `evaluator skill script not found: ${target} (expected the read-only chapterflow-book-evaluator skill ` +
      `checked out at the worktree root ${repoRoot}; pass { repoRoot } if this worktree nests it elsewhere)`);
  }

  const result = spawnSync(pythonBin, [target, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    maxBuffer: 64 * 1024 * 1024,
  });

  // A timed-out spawnSync sets BOTH `result.error` (code "ETIMEDOUT") AND
  // `result.signal` ("SIGTERM") — verified against this Node runtime. Check
  // the signal/timeout case FIRST, or the generic ENOENT-oriented message
  // below would swallow it and hide the actually-useful "this hung" diagnosis.
  if (result.signal || (result.error as NodeJS.ErrnoException | undefined)?.code === "ETIMEDOUT") {
    throw new EvaluatorSkillHarnessError(
      `${script} was killed (signal ${result.signal ?? "unknown"}, likely the ${options.timeoutMs ?? DEFAULT_TIMEOUT_MS}ms timeout) — ` +
      `the skill's scripts are offline/deterministic and should never legitimately hang`,
      { exitCode: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "", command });
  }
  if (result.error) {
    throw pythonSpawnError(pythonBin, result.error as NodeJS.ErrnoException, script);
  }

  return {
    script,
    command,
    cwd: repoRoot,
    exitCode: result.status,
    signal: result.signal,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function parseJsonStdout<T>(process: EvaluatorSkillProcessResult): T {
  try {
    return JSON.parse(process.stdout) as T;
  } catch (err) {
    throw new EvaluatorSkillHarnessError(
      `${process.script} exited ${process.exitCode} but stdout was not valid JSON: ${(err as Error).message}`,
      { exitCode: process.exitCode, stdout: process.stdout, stderr: process.stderr, command: process.command });
  }
}

function tryParseJsonStdout<T>(process: EvaluatorSkillProcessResult): T | null {
  if (process.stdout.trim().length === 0) return null;
  try {
    return JSON.parse(process.stdout) as T;
  } catch {
    return null;
  }
}

function readJsonFileRequired<T>(path: string, process: EvaluatorSkillProcessResult): T {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch (err) {
    throw new EvaluatorSkillHarnessError(
      `${process.script} exited 0 but its expected output file could not be read: ${path} (${(err as Error).message})`,
      { exitCode: process.exitCode, stdout: process.stdout, stderr: process.stderr, command: process.command });
  }
  try {
    return JSON.parse(raw) as T;
  } catch (err) {
    throw new EvaluatorSkillHarnessError(
      `${process.script} wrote ${path} but it is not valid JSON: ${(err as Error).message}`,
      { exitCode: process.exitCode, stdout: process.stdout, stderr: process.stderr, command: process.command });
  }
}

// ── inspect_package.py ───────────────────────────────────────────────────────

export type EvaluatorPackageInspection = {
  package_id: string;
  book_id: string;
  title: string;
  subtitle: string | null;
  package_format: string;
  schema_version_detected: string | null;
  chapter_count: number;
  word_count_estimate: number;
  component_inventory: Record<string, unknown>;
  chapter_inventory: Array<{
    chapter_index: number;
    chapter_id: string | null;
    number: number;
    title: string;
    word_count_estimate: number;
    fields: string[];
  }>;
  inventory_complete: boolean;
  inventory_errors: string[];
  warnings: string[];
  container_entry?: string;
};

export type EvaluatorInspectPackageArtifact = {
  package_path: string;
  source_hash: string;
  inspection: EvaluatorPackageInspection;
  diagnostics: Record<string, unknown>;
};

export type InspectPackageResult = {
  process: EvaluatorSkillProcessResult;
  artifact: EvaluatorInspectPackageArtifact | null;
};

export function inspectPackage(
  packagePath: string,
  options: EvaluatorSkillHarnessOptions & { tempRoot?: string; expectedSourceHash?: string } = {},
): InspectPackageResult {
  const args = ["--package", packagePath];
  if (options.tempRoot) args.push("--temp-root", options.tempRoot);
  if (options.expectedSourceHash) args.push("--expected-source-hash", options.expectedSourceHash);
  const process = runPython(EVALUATOR_SKILL_SCRIPTS.inspectPackage, args, options);
  return { process, artifact: process.exitCode === 0 ? parseJsonStdout<EvaluatorInspectPackageArtifact>(process) : null };
}

// ── issue_worker_receipts.py ─────────────────────────────────────────────────

export type EvaluatorWorkerDispatchReceipt = {
  schema_version: "1.0.0";
  artifact_type: "chapterflow_worker_dispatch_receipt";
  issuer: "chapterflow_evaluation_orchestrator";
  pair_id: string;
  issued_at_utc: string;
  run_id: string;
  book_id: string;
  source_hash: string;
  inventory_sha256: string;
  role: "primary" | "verification";
  job_id: string;
  worker_task_id: string;
  worker_session_id: string;
  binding_sha256: string;
};

export type IssueWorkerReceiptsArgs = {
  package: string;
  tempRoot?: string;
  runId: string;
  bookId: string;
  pairId: string;
  primaryJobId: string;
  primaryTaskId: string;
  primarySessionId: string;
  verificationJobId: string;
  verificationTaskId: string;
  verificationSessionId: string;
  outputDir: string;
};

export type IssueWorkerReceiptsResult = {
  process: EvaluatorSkillProcessResult;
  hashes: { primary_sha256: string; verification_sha256: string } | null;
  primaryDispatch: EvaluatorWorkerDispatchReceipt | null;
  verificationDispatch: EvaluatorWorkerDispatchReceipt | null;
  primaryDispatchPath: string;
  verificationDispatchPath: string;
};

export function issueWorkerReceipts(
  args: IssueWorkerReceiptsArgs,
  options: EvaluatorSkillHarnessOptions = {},
): IssueWorkerReceiptsResult {
  const cliArgs = [
    "--package", args.package,
    ...(args.tempRoot ? ["--temp-root", args.tempRoot] : []),
    "--run-id", args.runId,
    "--book-id", args.bookId,
    "--pair-id", args.pairId,
    "--primary-job-id", args.primaryJobId,
    "--primary-task-id", args.primaryTaskId,
    "--primary-session-id", args.primarySessionId,
    "--verification-job-id", args.verificationJobId,
    "--verification-task-id", args.verificationTaskId,
    "--verification-session-id", args.verificationSessionId,
    "--output-dir", args.outputDir,
  ];
  const process = runPython(EVALUATOR_SKILL_SCRIPTS.issueWorkerReceipts, cliArgs, options);
  const primaryDispatchPath = resolve(args.outputDir, "primary.dispatch.json");
  const verificationDispatchPath = resolve(args.outputDir, "verification.dispatch.json");
  const ok = process.exitCode === 0;
  return {
    process,
    hashes: ok ? parseJsonStdout<{ primary_sha256: string; verification_sha256: string }>(process) : null,
    primaryDispatch: ok ? readJsonFileRequired<EvaluatorWorkerDispatchReceipt>(primaryDispatchPath, process) : null,
    verificationDispatch: ok ? readJsonFileRequired<EvaluatorWorkerDispatchReceipt>(verificationDispatchPath, process) : null,
    primaryDispatchPath,
    verificationDispatchPath,
  };
}

// ── seal_blind_pair_receipt.py ───────────────────────────────────────────────

export type EvaluatorBlindPairSealWorker = {
  job_id: string;
  worker_task_id: string;
  worker_session_id: string;
  dispatch_receipt_sha256: string;
  result_canonical_sha256: string;
  judgment_sha256: string;
};

export type EvaluatorBlindPairSeal = {
  schema_version: "1.0.0";
  artifact_type: "chapterflow_blind_pair_seal";
  issuer: "chapterflow_evaluation_orchestrator";
  pair_id: string;
  sealed_at_utc: string;
  run_id: string;
  book_id: string;
  source_hash: string;
  inventory_sha256: string;
  workers: { primary: EvaluatorBlindPairSealWorker; verification: EvaluatorBlindPairSealWorker };
  binding_sha256: string;
};

export type SealBlindPairReceiptArgs = {
  package: string;
  tempRoot?: string;
  primary: string;
  verification: string;
  primaryDispatch: string;
  verificationDispatch: string;
  output: string;
};

export type SealBlindPairReceiptResult = {
  process: EvaluatorSkillProcessResult;
  summary: { pair_seal_sha256: string; output: string } | null;
  seal: EvaluatorBlindPairSeal | null;
};

export function sealBlindPairReceipt(
  args: SealBlindPairReceiptArgs,
  options: EvaluatorSkillHarnessOptions = {},
): SealBlindPairReceiptResult {
  const cliArgs = [
    "--package", args.package,
    ...(args.tempRoot ? ["--temp-root", args.tempRoot] : []),
    "--primary", args.primary,
    "--verification", args.verification,
    "--primary-dispatch", args.primaryDispatch,
    "--verification-dispatch", args.verificationDispatch,
    "--output", args.output,
  ];
  const process = runPython(EVALUATOR_SKILL_SCRIPTS.sealBlindPairReceipt, cliArgs, options);
  const ok = process.exitCode === 0;
  return {
    process,
    summary: ok ? parseJsonStdout<{ pair_seal_sha256: string; output: string }>(process) : null,
    seal: ok ? readJsonFileRequired<EvaluatorBlindPairSeal>(args.output, process) : null,
  };
}

// ── validate_book_result.py ──────────────────────────────────────────────────

export type EvaluatorValidationResult = {
  valid: boolean;
  input: string;
  error_count: number;
  errors: string[];
};

export type ValidateBookResultArgs = {
  input: string;
  schema?: string;
  expectedSourceHash?: string;
  expectedBookId?: string;
  expectedJobId?: string;
  expectedRunId?: string;
  expectedRole?: "primary" | "verification" | "adjudicated";
  sourcePackage?: string;
  inspection?: string;
  workerDispatchReceipt?: string;
  blindPairSeal?: string;
  /** The evaluator lane always wants `true` — chapter sampling is disabled
   *  (owner policy §3.2), so every real call here is full-content. Required
   *  (not defaulted) so a caller cannot forget the choice. */
  requireFullContent: boolean;
  tempRoot?: string;
  adjudicated?: boolean;
};

export type ValidateBookResultResult = {
  process: EvaluatorSkillProcessResult;
  /** Parsed `--json` payload. Present whenever the script produced one, which
   *  includes its "invalid" exit(1) path — only a harness-level failure
   *  (bad args, crash before argparse) leaves this null; check `process.exitCode`
   *  and `process.stderr` in that case. */
  result: EvaluatorValidationResult | null;
};

export function validateBookResult(
  args: ValidateBookResultArgs,
  options: EvaluatorSkillHarnessOptions = {},
): ValidateBookResultResult {
  const cliArgs = ["--input", args.input, "--json"];
  if (args.schema) cliArgs.push("--schema", args.schema);
  if (args.expectedSourceHash) cliArgs.push("--expected-source-hash", args.expectedSourceHash);
  if (args.expectedBookId) cliArgs.push("--expected-book-id", args.expectedBookId);
  if (args.expectedJobId) cliArgs.push("--expected-job-id", args.expectedJobId);
  if (args.expectedRunId) cliArgs.push("--expected-run-id", args.expectedRunId);
  if (args.expectedRole) cliArgs.push("--expected-role", args.expectedRole);
  if (args.sourcePackage) cliArgs.push("--source-package", args.sourcePackage);
  if (args.inspection) cliArgs.push("--inspection", args.inspection);
  if (args.workerDispatchReceipt) cliArgs.push("--worker-dispatch-receipt", args.workerDispatchReceipt);
  if (args.blindPairSeal) cliArgs.push("--blind-pair-seal", args.blindPairSeal);
  if (args.requireFullContent) cliArgs.push("--require-full-content");
  if (args.tempRoot) cliArgs.push("--temp-root", args.tempRoot);
  if (args.adjudicated) cliArgs.push("--adjudicated");
  const process = runPython(EVALUATOR_SKILL_SCRIPTS.validateBookResult, cliArgs, options);
  return { process, result: tryParseJsonStdout<EvaluatorValidationResult>(process) };
}
