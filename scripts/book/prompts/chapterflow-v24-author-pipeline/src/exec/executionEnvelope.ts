/**
 * Hermetic execution envelope (IMP-00 core; F-019/F-020, gate G0).
 *
 * Assembles, for one Codex spawn: the role profile, an isolated per-spawn
 * CODEX_HOME (copied auth material ONLY), an allowlist-built child environment
 * (the pre-IMP-00 spawn spread the entire parent env), qualification-gated
 * isolation flags (`--ignore-user-config`, `--ignore-rules`, project-doc
 * neutralization), an EXPLICIT model + reasoning effort for every call, the
 * `-o` last-message capture file, and the immutable effective-context manifest
 * persisted BEFORE the process starts.
 *
 * Baseline-model note (recorded live finding, 2026-07-10): at rollback time the
 * operator's personal `~/.codex/config.toml` said `model = "gpt-5.6-sol"`, so
 * every model-unpinned v24 call site (chapter reviewers, acceptance readers,
 * research, evidence) was silently running SOL high while the code read as
 * "baseline". The profiles below pin the QUALIFIED GPT-5.5 baseline explicitly
 * for every role; IMP-02's central policy supersedes these defaults, and no SOL
 * route may return before the plan's bakeoff/canary gates authorize it.
 */

import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "fs";
import { homedir, tmpdir } from "os";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

import { hashCanonical, sha256Hex } from "../contracts/contractUtil.js";
import {
  AGENT_ROLES,
  type AgentRole,
  type CodexSandboxV1,
  type EffortLevelV1,
  type ExecutionProfileV1,
  validateExecutionProfile,
  type WorkingDirPolicyV1,
} from "../contracts/executionProfile.js";
import type { EffectiveContextManifestV1, ExecResultV1, InstructionSourceV1, WorkspaceFileV1 } from "../contracts/effectiveContext.js";
import { STRICT_PIPELINE_ENV } from "../lib/strictEnv.js";
import { assertFlagsSupported, type CodexCliQualificationV1, ExecPreflightError } from "./cliQualification.js";

export { ExecPreflightError } from "./cliQualification.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Pipeline package root (src/exec → ../..). */
export const EXEC_PIPELINE_ROOT = resolve(__dirname, "../..");

/** Default sink for effective-context manifests + result sidecars. Untracked
 *  (logs/exec/ is gitignored) — generated evidence never enters the corpus. */
export function defaultManifestSink(): string {
  return join(EXEC_PIPELINE_ROOT, "logs", "exec");
}

/** The qualified baseline model — OWNED by modelPolicy since IMP-02; re-exported
 *  here for envelope consumers. Profile defaults below resolve through the
 *  policy so the decision table lives in exactly one module. */
export { BASELINE_MODEL } from "../orchestrator/modelPolicy.js";
import { resolveRoute as policyResolveRoute } from "../orchestrator/modelPolicy.js";

/** Base environment names allowed through to every agent child process.
 *  Everything else in the parent env is DROPPED. HOME stays: agent shell
 *  commands (npx/tsx/git) need it, and CODEX_HOME (forced to the isolated dir)
 *  is what decides codex config discovery — but it is per-role debt to narrow
 *  further (IMP-01/IMP-08 record tighter lists for isolated roles). */
export const DEFAULT_ENV_ALLOWLIST: readonly string[] = [
  "PATH", "HOME", "TMPDIR", "TMP", "TEMP",
  "LANG", "LC_ALL", "LC_CTYPE", "TERM", "USER", "LOGNAME", "SHELL",
  "HTTP_PROXY", "HTTPS_PROXY", "NO_PROXY", "http_proxy", "https_proxy", "no_proxy",
];

/** Flags every v1 hermetic spawn requires from the installed CLI. */
const REQUIRED_FLAGS_BASE: readonly string[] = [
  "--sandbox", "-c", "--ignore-user-config", "--ignore-rules", "--output-last-message",
];

function makeProfile(
  role: AgentRole,
  workingDir: WorkingDirPolicyV1,
  allowedSandboxes: readonly CodexSandboxV1[],
): ExecutionProfileV1 {
  // IMP-02: the model/effort defaults come from the central policy (single
  // decision table); they stay materialized on the profile because the frozen
  // ExecutionProfileV1 contract requires explicit values (hashed provenance).
  const route = policyResolveRoute({ role });
  return {
    schema: "execution-profile-v1",
    profileVersion: 1,
    role,
    workingDir,
    codexHome: "isolated-auth-only",
    ignoreUserConfig: true,
    ignoreRules: true,
    neutralizeProjectDocs: true,
    envAllowlist: DEFAULT_ENV_ALLOWLIST,
    allowedSandboxes,
    defaultModel: route.model,
    defaultReasoningEffort: route.effort,
    outputMode: "text",
    captureLastMessage: true,
    requiredCliFlags: REQUIRED_FLAGS_BASE,
    cleanup: "always",
  };
}

/** Role → profile registry (IMP-00 items 1–2). Efforts mirror TODAY's call-site
 *  values so behavior is preserved: call-site explicit model/effort always wins
 *  over the profile default; the default exists so NO call can be ambient. */
export const EXECUTION_PROFILES: Record<AgentRole, ExecutionProfileV1> = {
  "research": makeProfile("research", "pipeline-root", ["workspace-write"]),
  "source-repair": makeProfile("source-repair", "pipeline-root", ["workspace-write"]),
  "source-verify": makeProfile("source-verify", "pipeline-root", ["read-only"]),
  "source-compiler": makeProfile("source-compiler", "pipeline-root", ["workspace-write"]),
  "compiler-polish": makeProfile("compiler-polish", "caller-cwd", ["workspace-write"]),
  "autopilot-repair": makeProfile("autopilot-repair", "pipeline-root", ["workspace-write"]),
  "autopilot-scout": makeProfile("autopilot-scout", "pipeline-root", ["read-only"]),
  "qc-reviewer": makeProfile("qc-reviewer", "isolated-workspace", ["read-only"]),
  // IMP-01: writers/repairers run in isolated attempt workspaces (their cwd +
  // ONLY writable dir) — the conductor owns every canonical mutation via
  // compare-and-swap commit of a validated candidate (chapterTransaction.ts).
  "author-writer": makeProfile("author-writer", "isolated-workspace", ["workspace-write"]),
  "author-repair": makeProfile("author-repair", "isolated-workspace", ["workspace-write"]),
  // IMP-08: reviewer roles run in built role workspaces OUTSIDE the repo
  // (reviewerWorkspace.ts) — the recorded policy now states that truth.
  "chapter-reviewer": makeProfile("chapter-reviewer", "isolated-workspace", ["read-only"]),
  "book-acceptance-reader": makeProfile("book-acceptance-reader", "isolated-workspace", ["read-only"]),
  "author-evidence": makeProfile("author-evidence", "pipeline-root", ["read-only"]),
  "shipped-control": makeProfile("shipped-control", "isolated-workspace", ["read-only"]),
  "eval-reader": makeProfile("eval-reader", "isolated-workspace", ["read-only"]),
  "eval-book": makeProfile("eval-book", "isolated-workspace", ["read-only"]),
  "bakeoff-candidate": makeProfile("bakeoff-candidate", "caller-cwd", ["workspace-write"]),
  "bakeoff-judge": makeProfile("bakeoff-judge", "caller-cwd", ["read-only"]),
  "bakeoff-aux": makeProfile("bakeoff-aux", "caller-cwd", ["read-only", "workspace-write"]),
  "cli-adhoc": makeProfile("cli-adhoc", "caller-cwd", ["read-only", "workspace-write"]),
};

const profileHashMemo = new Map<AgentRole, string>();

export function resolveExecutionProfile(role: AgentRole): { profile: ExecutionProfileV1; profileHash: string } {
  const profile = EXECUTION_PROFILES[role];
  if (!profile) {
    throw new ExecPreflightError(`unknown agent role "${role}" — every model-bearing call must declare one of: ${AGENT_ROLES.join(", ")}`);
  }
  const errors = validateExecutionProfile(profile);
  if (errors.length > 0) {
    throw new ExecPreflightError(`execution profile for role "${role}" is invalid: ${errors.join("; ")}`);
  }
  let hash = profileHashMemo.get(role);
  if (!hash) {
    hash = hashCanonical(profile);
    profileHashMemo.set(role, hash);
  }
  return { profile, profileHash: hash };
}

/** Per-spawn session directory layout:
 *    <base>/cf-exec-session-XXXX/codex-home/auth.json   (0700 dir, 0600 file)
 *    <base>/cf-exec-session-XXXX/last-message.txt
 *  Removed in `finally` after every spawn; the stale sweep is the crash net. */
export type IsolatedSession = {
  sessionDir: string;
  codexHomeDir: string;
  lastMessagePath: string;
  authMaterial: "auth.json" | "none";
  authSourcePath?: string;
  cleanup: () => void;
};

export function buildIsolatedSession(opts: {
  baseDir?: string;
  /** Real runs REQUIRE auth material (fail closed); injected-runner tests pass false. */
  requireAuth: boolean;
  /** Override the auth source dir (tests). Default: $CODEX_HOME else ~/.codex. */
  authSourceDir?: string;
}): IsolatedSession {
  const base = opts.baseDir ?? tmpdir();
  mkdirSync(base, { recursive: true });
  const sessionDir = mkdtempSync(join(base, "cf-exec-session-"));
  chmodSync(sessionDir, 0o700);
  const codexHomeDir = join(sessionDir, "codex-home");
  mkdirSync(codexHomeDir, { mode: 0o700 });
  const sourceDir = opts.authSourceDir ?? process.env.CODEX_HOME ?? join(homedir(), ".codex");
  const authSource = join(sourceDir, "auth.json");
  let authMaterial: "auth.json" | "none" = "none";
  let authSourcePath: string | undefined;
  if (existsSync(authSource)) {
    copyFileSync(authSource, join(codexHomeDir, "auth.json"));
    chmodSync(join(codexHomeDir, "auth.json"), 0o600);
    authMaterial = "auth.json";
    authSourcePath = authSource;
  } else if (opts.requireAuth) {
    try { rmSync(sessionDir, { recursive: true, force: true }); } catch { /* best-effort */ }
    throw new ExecPreflightError(
      `no codex auth material at ${authSource} — an isolated CODEX_HOME cannot authenticate. ` +
      `Refusing to fall back to the personal ~/.codex (that would reload ambient config).`,
    );
  }
  return {
    sessionDir,
    codexHomeDir,
    lastMessagePath: join(sessionDir, "last-message.txt"),
    authMaterial,
    authSourcePath,
    cleanup: () => { try { rmSync(sessionDir, { recursive: true, force: true }); } catch { /* best-effort */ } },
  };
}

/** Allowlist-built child environment. Order of precedence (later wins):
 *  allowlisted parent vars → caller env (explicit, recorded) → forced
 *  CODEX_HOME → strict pipeline invariants → per-spawn session id. */
export function buildHermeticEnv(opts: {
  profile: ExecutionProfileV1;
  codexHomeDir: string;
  sessionId: string;
  callerEnv?: Record<string, string>;
  baseEnv?: NodeJS.ProcessEnv;
}): { env: NodeJS.ProcessEnv; envKeys: string[]; callerEnvKeys: string[]; strictEnv: Record<string, string> } {
  const base = opts.baseEnv ?? process.env;
  const env: NodeJS.ProcessEnv = {};
  for (const name of opts.profile.envAllowlist) {
    if (base[name] !== undefined) env[name] = base[name];
  }
  const callerEnvKeys = Object.keys(opts.callerEnv ?? {}).sort();
  for (const [k, v] of Object.entries(opts.callerEnv ?? {})) env[k] = v;
  env.CODEX_HOME = opts.codexHomeDir;
  const strictEnv: Record<string, string> = { ...STRICT_PIPELINE_ENV };
  for (const [k, v] of Object.entries(strictEnv)) env[k] = v;
  env.CHAPTERFLOW_SESSION_ID = opts.sessionId;
  return { env, envKeys: Object.keys(env).sort(), callerEnvKeys, strictEnv };
}

/** Discover the project AGENTS.md chain codex WOULD read for this cwd (git
 *  root → cwd, inclusive), hashed as evidence. With neutralizeProjectDocs the
 *  chain is marked neutralized — recorded, not trusted-away (F-019). */
export function discoverInstructionChain(cwd: string, neutralized: boolean): InstructionSourceV1[] {
  const chain: InstructionSourceV1[] = [];
  const dirs: string[] = [];
  let dir = resolve(cwd);
  for (let depth = 0; depth < 64; depth++) {
    dirs.push(dir);
    if (existsSync(join(dir, ".git"))) break; // git root found — codex discovery stops here
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  dirs.reverse(); // git root (or highest ancestor probed) first, cwd last
  for (const d of dirs) {
    const p = join(d, "AGENTS.md");
    if (!existsSync(p)) continue;
    try {
      const bytes = readFileSync(p);
      chain.push({ path: p, sha256: sha256Hex(bytes), bytes: bytes.length, neutralized });
    } catch { /* unreadable — skip; absence from the manifest is itself evidence */ }
  }
  return chain;
}

/** Build the hermetic `codex exec` argv. Flag order is FIXED (manifests diff
 *  cleanly): sandbox → git-check → isolation → project-doc neutralization →
 *  model → effort → add-dirs → output capture → task (always last). */
export function hermeticExecArgv(opts: {
  profile: ExecutionProfileV1;
  qualification: CodexCliQualificationV1;
  sandbox: CodexSandboxV1;
  model: string;
  reasoningEffort: string;
  writableRoots: readonly string[];
  skipGitRepoCheck: boolean;
  lastMessagePath: string;
  task: string;
}): string[] {
  assertFlagsSupported(opts.qualification, opts.profile.requiredCliFlags);
  if (!opts.profile.allowedSandboxes.includes(opts.sandbox)) {
    throw new ExecPreflightError(
      `role "${opts.profile.role}" does not allow sandbox "${opts.sandbox}" (allowed: ${opts.profile.allowedSandboxes.join(", ")})`,
    );
  }
  const argv = ["exec", "--sandbox", opts.sandbox];
  if (opts.skipGitRepoCheck) argv.push("--skip-git-repo-check");
  if (opts.profile.ignoreUserConfig) argv.push("--ignore-user-config");
  if (opts.profile.ignoreRules) argv.push("--ignore-rules");
  if (opts.profile.neutralizeProjectDocs) argv.push("-c", "project_doc_max_bytes=0");
  argv.push("-c", `model=${opts.model}`);
  argv.push("-c", `model_reasoning_effort=${opts.reasoningEffort}`);
  if (opts.sandbox === "workspace-write") for (const dir of opts.writableRoots) argv.push("--add-dir", dir);
  argv.push("--output-last-message", opts.lastMessagePath);
  argv.push(opts.task);
  return argv;
}

export function assembleEffectiveContextManifest(opts: {
  sessionId: string;
  role: AgentRole;
  profile: ExecutionProfileV1;
  profileHash: string;
  binPath: string;
  qualification: CodexCliQualificationV1;
  argv: string[];
  cwd: string;
  envKeys: string[];
  callerEnvKeys: string[];
  strictEnv: Record<string, string>;
  codexHome: { dir: string; authMaterial: "auth.json" | "none"; authSourcePath?: string };
  instructionSources: InstructionSourceV1[];
  workspace?: { dir: string; files: WorkspaceFileV1[] };
  model: string;
  reasoningEffort: string;
  sandbox: CodexSandboxV1;
  timeoutMs: number;
  task: string;
}): EffectiveContextManifestV1 {
  const taskSha256 = sha256Hex(opts.task);
  const argvRecorded = opts.argv.slice();
  argvRecorded[argvRecorded.length - 1] = `<task-sha256:${taskSha256}>`;
  let binSha256: string | undefined;
  try {
    const st = statSync(opts.binPath);
    if (st.isFile() && st.size < 512 * 1024 * 1024) binSha256 = sha256Hex(readFileSync(opts.binPath));
  } catch { /* PATH-resolved bare name — version identity only */ }
  return {
    schema: "effective-context-manifest-v1",
    manifestVersion: 1,
    sessionId: opts.sessionId,
    role: opts.role,
    profileHash: opts.profileHash,
    bin: { path: opts.binPath, version: opts.qualification.version, ...(binSha256 ? { sha256: binSha256 } : {}) },
    argv: argvRecorded,
    cwd: opts.cwd,
    cwdPolicy: opts.profile.workingDir,
    envKeys: opts.envKeys,
    callerEnvKeys: opts.callerEnvKeys,
    strictEnv: opts.strictEnv,
    codexHome: opts.codexHome,
    instructionSources: opts.instructionSources,
    ...(opts.workspace ? { workspace: opts.workspace } : {}),
    model: opts.model,
    reasoningEffort: opts.reasoningEffort,
    sandbox: opts.sandbox,
    timeoutMs: opts.timeoutMs,
    taskSha256,
    taskBytes: Buffer.byteLength(opts.task),
    qualification: {
      cliVersion: opts.qualification.version,
      flagsRequired: [...opts.profile.requiredCliFlags],
      synthetic: opts.qualification.synthetic,
    },
    createdAtIso: new Date().toISOString(),
  };
}

function manifestBaseName(manifest: EffectiveContextManifestV1): string {
  const ts = manifest.createdAtIso.replace(/[:.]/g, "").replace("T", "-").slice(0, 17);
  const sid = manifest.sessionId.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
  return `${ts}-${sid}`;
}

/** Persist the manifest BEFORE spawn (IMP-00 item 9). A sink failure is an
 *  infrastructure failure — an unprovable envelope must not run. */
export function persistEffectiveContextManifest(manifest: EffectiveContextManifestV1, sinkDir: string): string {
  try {
    mkdirSync(sinkDir, { recursive: true });
    const path = join(sinkDir, `${manifestBaseName(manifest)}.manifest.json`);
    writeFileSync(path, JSON.stringify(manifest, null, 2) + "\n");
    return path;
  } catch (err) {
    const e = new Error(`cannot persist effective-context manifest to ${sinkDir}: ${(err as Error).message} — refusing to run an unprovable envelope`);
    (e as Error & { classification: string }).classification = "infrastructure_failure";
    throw e;
  }
}

export function persistExecResult(result: ExecResultV1, sinkDir: string, manifestPath: string): string | null {
  try {
    const path = manifestPath.replace(/\.manifest\.json$/, ".result.json");
    writeFileSync(path, JSON.stringify(result, null, 2) + "\n");
    return path;
  } catch {
    return null; // the run already happened; result-sidecar loss is logged by callers, never a crash
  }
}

/** IMP-02: persist the RouteResultV1 sidecar beside the manifest — the route
 *  provenance + provider outcome + drift fingerprint for this exact spawn. */
export function persistRouteResult(route: object, manifestPath: string): string | null {
  try {
    const path = manifestPath.replace(/\.manifest\.json$/, ".route.json");
    writeFileSync(path, JSON.stringify(route, null, 2) + "\n");
    return path;
  } catch {
    return null;
  }
}
