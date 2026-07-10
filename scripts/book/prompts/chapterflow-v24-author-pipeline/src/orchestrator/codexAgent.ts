/**
 * codexAgent — spawn ONE headless Codex agentic sub-session and wait for it to
 * finish a task.
 *
 * This is the worker primitive the Book Autopilot conductor uses: the conductor
 * (deterministic code) decides WHAT to do; each unit of agentic WORK (research a
 * book, author a chapter, review a QC unit, repair findings) is delegated to a
 * fresh `codex exec` session running on the user's Codex subscription — NOT a
 * billed API call.
 *
 * IMP-00 (GPT-5.6 SOL migration, Phase 0): every REAL spawn now runs inside a
 * hermetic execution envelope. Callers declare an `AgentRole`; the envelope
 * resolves the role's frozen `ExecutionProfileV1` and enforces:
 *
 *  - isolated per-spawn CODEX_HOME holding ONLY copied auth material — the
 *    personal ~/.codex config.toml / AGENTS.md / rules NEVER load
 *    (`--ignore-user-config`, `--ignore-rules`, qualification-gated);
 *  - project AGENTS.md discovery neutralized (`-c project_doc_max_bytes=0`)
 *    with the discovered chain HASHED into the manifest as evidence — the
 *    stale v21 rules at the repo/pipeline roots stop being silent inputs;
 *  - an allowlist-built child environment (the old spawn spread the ENTIRE
 *    parent env);
 *  - an EXPLICIT model + reasoning effort on every call — during the rolled-back
 *    SOL campaign the personal config said `model = "gpt-5.6-sol"`, so every
 *    model-unpinned call site silently ran SOL while the code read as baseline;
 *  - `-o` last-message capture (authoritative finalMessage channel instead of
 *    last-stdout-line parsing);
 *  - an immutable effective-context manifest persisted BEFORE spawn, plus a
 *    result sidecar after (logs/exec/, gitignored).
 *
 * Fail-closed: a real spawn without a role, without auth material, without a
 * provable envelope, or on a CLI missing required flags THROWS
 * (`policy_preflight_failure` / `infrastructure_failure`) — it never falls back
 * to ambient behavior. Injected-runner test doubles keep the legacy path so the
 * existing suite exercises conductor logic without a codex binary; the static
 * spawn-boundary test pins every PRODUCTION call site to a declared role.
 *
 * Two pre-existing invariants stay enforced:
 *  - No API metering: model work goes through `codex exec` (subscription), never
 *    the openai-api / anthropic-api providers or `claude -p`.
 *  - Session independence: each spawn carries a DISTINCT CHAPTERFLOW_SESSION_ID
 *    (writer ≠ each reviewer ≠ confirm), which qc-submit records and finalize
 *    uses to REVISE-reject any author-grades-own-work collision.
 */

import { spawn } from "child_process";
import { existsSync, readFileSync } from "fs";

import { STRICT_PIPELINE_ENV } from "../lib/strictEnv.js";
import { sha256Hex } from "../contracts/contractUtil.js";
import type { AgentRole } from "../contracts/executionProfile.js";
import type { ExecResultV1 } from "../contracts/effectiveContext.js";
import { type CodexCliQualificationV1, qualifyCodexCli, syntheticQualification } from "../exec/cliQualification.js";
import {
  assembleEffectiveContextManifest,
  buildHermeticEnv,
  buildIsolatedSession,
  defaultManifestSink,
  discoverInstructionChain,
  ExecPreflightError,
  hermeticExecArgv,
  persistEffectiveContextManifest,
  persistExecResult,
  persistRouteResult,
  resolveExecutionProfile,
} from "../exec/executionEnvelope.js";
import { sweepStaleExecDirs } from "../exec/roleWorkspace.js";
import { buildRouteResult, classifyProviderOutcome, resolveRoute } from "./modelPolicy.js";

/** Strict env every pipeline agent session runs under (canonical list in
 *  lib/strictEnv, shared with runbook + the conductor's CLI runner so it can't
 *  drift). The conductor adds CHAPTERFLOW_SESSION_ID. */
export const STRICT_AGENT_ENV: Record<string, string> = { ...STRICT_PIPELINE_ENV };

export type CodexSandbox = "read-only" | "workspace-write" | "danger-full-access";

export type CodexRunnerArgs = {
  bin: string;
  argv: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
  timeoutMs: number;
};

/** Runs the codex subprocess. Injectable so tests can simulate agent effects
 *  (write a chapter file, drop a submission JSON) without a real `codex`. */
export type CodexRunner = (args: CodexRunnerArgs) => Promise<{ stdout: string; stderr: string; code: number }>;

export type SpawnCodexAgentOptions = {
  /** The agent's ENTIRE instruction — a prompt file or dispatch/task card, verbatim. */
  task: string;
  /** Distinct per spawn → CHAPTERFLOW_SESSION_ID (proves + enforces independence). */
  sessionId: string;
  /** Working directory (recorded verbatim in the manifest under the role's
   *  declared cwd POLICY — pipeline root for legacy writer/reviewer roles until
   *  IMP-01/IMP-08 narrow them). */
  cwd: string;
  /** Default workspace-write (author/edit chapters); read-only for pure reviewers.
   *  Must be within the role profile's allowedSandboxes — else preflight failure. */
  sandbox?: CodexSandbox;
  /** Extra directories the workspace-write sandbox must allow writes to, BEYOND the cwd +
   *  /tmp (codex `--add-dir`). The pipeline writes research artifacts to repo-root
   *  `.chapterflow/runs`, which is ABOVE the pipeline-dir workdir — without this the agent
   *  can't write them and the round makes no progress. */
  writableRoots?: string[];
  /** Pass codex `--skip-git-repo-check`. Required when cwd is NOT a git repo — e.g. a
   *  blind reviewer workspace under tmpdir — else `codex exec` refuses with "Not inside a
   *  trusted directory". Safe for the read-only reviewers that run there. */
  skipGitRepoCheck?: boolean;
  /** Agentic sessions are long; default 30 min. */
  timeoutMs?: number;
  /** Extra env merged over the allowlist-built base (never overrides
   *  CHAPTERFLOW_SESSION_ID or the strict invariants). Caller-intentional and
   *  recorded per-key in the manifest. */
  env?: Record<string, string>;
  /** Override the codex binary (else CHAPTERFLOW_CODEX_BIN or PATH `codex`). */
  bin?: string;
  /** Injectable for tests. Defaults to the real `codex exec` runner. */
  runner?: CodexRunner;
  /** Bind codex `-c model_reasoning_effort=<level>`. When omitted, the ROLE
   *  PROFILE's explicit default applies — ambient inheritance is gone (IMP-00). */
  reasoningEffort?: "minimal" | "low" | "medium" | "high" | "xhigh";
  /** Bind codex `-c model=<model>`. When omitted, the ROLE PROFILE's explicit
   *  baseline default applies — ambient inheritance is gone (IMP-00). */
  model?: string;
  /** IMP-00: the agent role. REQUIRED for real spawns (default runner); resolves
   *  the frozen ExecutionProfileV1 that governs this call's envelope. Optional
   *  ONLY for injected-runner test doubles (legacy path, no codex binary). */
  role?: AgentRole;
  /** IMP-00 test seam: supply a qualification instead of probing the binary. */
  qualification?: CodexCliQualificationV1;
  /** IMP-00: directory for effective-context manifests + result sidecars.
   *  Default logs/exec under the pipeline root. `null` suppresses persistence —
   *  allowed ONLY with an injected runner (an unprovable REAL run must not run). */
  manifestSink?: string | null;
  /** IMP-00 test seam: base dir for the per-spawn isolated session (CODEX_HOME
   *  + last-message capture). Default: os tmpdir. */
  execBaseDir?: string;
};

export type CodexAgentResult = {
  ok: boolean;
  exitCode: number;
  /** The agent's final message. Hermetic runs read it from the `-o` capture file
   *  (authoritative); legacy/test runs fall back to the last stdout line. */
  finalMessage: string;
  stdout: string;
  stderr: string;
  durationMs: number;
  sessionId: string;
  /** Where finalMessage came from (hermetic runs). */
  finalMessageSource?: "output-file" | "stdout-fallback";
  /** Path of the persisted effective-context manifest (hermetic runs). */
  manifestPath?: string;
};

/** Resolve the `codex` binary. CHAPTERFLOW_CODEX_BIN wins (point it at your codex
 *  install); else common install paths; else bare `codex` on PATH. */
export function findCodexBinary(): string {
  if (process.env.CHAPTERFLOW_CODEX_BIN) return process.env.CHAPTERFLOW_CODEX_BIN;
  for (const p of [`${process.env.HOME}/.npm-global/bin/codex`, "/opt/homebrew/bin/codex", "/usr/local/bin/codex"]) {
    if (existsSync(p)) return p;
  }
  return "codex";
}

/** True when a real codex binary is resolvable (used to fail fast with a clear
 *  message instead of an opaque ENOENT mid-run). */
export function codexAvailable(bin = findCodexBinary()): boolean {
  return bin === "codex" || existsSync(bin);
}

/** LEGACY argv builder — the pre-IMP-00 minimal flag set. Kept for the
 *  injected-runner path so existing conductor tests exercise unchanged logic;
 *  real spawns use `hermeticExecArgv` (exec/executionEnvelope.ts), which adds
 *  the isolation and capture flags. Confirm flags against your installed codex
 *  (`codex exec --help`); the hermetic path does that automatically via CLI
 *  qualification. */
export function codexExecArgv(task: string, sandbox: CodexSandbox, writableRoots: string[] = [], skipGitRepoCheck = false, reasoningEffort?: string, model?: string): string[] {
  const argv = ["exec", "--sandbox", sandbox];
  if (skipGitRepoCheck) argv.push("--skip-git-repo-check");
  if (model) argv.push("-c", `model=${model}`);
  if (reasoningEffort) argv.push("-c", `model_reasoning_effort=${reasoningEffort}`);
  if (sandbox === "workspace-write") for (const dir of writableRoots) argv.push("--add-dir", dir);
  argv.push(task);
  return argv;
}

const defaultCodexRunner: CodexRunner = ({ bin, argv, cwd, env, timeoutMs }) =>
  new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(bin, argv, { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGKILL");
      rejectPromise(new Error(`codex exec timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      rejectPromise(err);
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolvePromise({ stdout, stderr, code: code ?? -1 });
    });
  });

function lastNonEmptyLine(s: string): string {
  const lines = s.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return lines.length ? lines[lines.length - 1] : s.trim();
}

let sweptStaleThisProcess = false;

/** Spawn one headless Codex agent and resolve when it completes. Never throws on
 *  a non-zero exit — returns `{ ok: false, ... }` so the conductor decides. Throws
 *  on spawn error / timeout (the runner rejecting) and on IMP-00 preflight
 *  failures (missing role/auth/CLI capability, unprovable envelope). */
export async function spawnCodexAgent(opts: SpawnCodexAgentOptions): Promise<CodexAgentResult> {
  const bin = opts.bin ?? findCodexBinary();
  const sandbox = opts.sandbox ?? "workspace-write";
  const timeoutMs = opts.timeoutMs ?? 1_800_000;
  const runnerInjected = opts.runner !== undefined;
  const runner = opts.runner ?? defaultCodexRunner;

  if (!opts.role) {
    if (!runnerInjected) {
      throw new ExecPreflightError(
        `spawnCodexAgent: a REAL codex spawn requires a declared agent role (session ${opts.sessionId}). ` +
        `Ambient, role-less execution was removed by IMP-00 — declare the role at the call site.`,
      );
    }
    // Injected-runner test double without a role: legacy path, byte-for-byte
    // pre-IMP-00 behavior so conductor tests keep exercising unchanged logic.
    const argv = codexExecArgv(opts.task, sandbox, opts.writableRoots, opts.skipGitRepoCheck, opts.reasoningEffort, opts.model);
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      ...(opts.env ?? {}),
      ...STRICT_AGENT_ENV,
      CHAPTERFLOW_SESSION_ID: opts.sessionId,
    };
    const startedAt = Date.now();
    const { stdout, stderr, code } = await runner({ bin, argv, cwd: opts.cwd, env, timeoutMs });
    return {
      ok: code === 0,
      exitCode: code,
      finalMessage: lastNonEmptyLine(stdout),
      stdout,
      stderr,
      durationMs: Date.now() - startedAt,
      sessionId: opts.sessionId,
    };
  }

  // ── Hermetic path (IMP-00) ────────────────────────────────────────────────
  const { profile, profileHash } = resolveExecutionProfile(opts.role);
  if (opts.manifestSink === null && !runnerInjected) {
    throw new ExecPreflightError("spawnCodexAgent: manifest persistence cannot be suppressed for a REAL spawn (unprovable envelope)");
  }
  const qualification = opts.qualification
    ?? (runnerInjected ? syntheticQualification() : await qualifyCodexCli({ bin, cacheDir: defaultManifestSink() }));

  if (!sweptStaleThisProcess) {
    sweptStaleThisProcess = true;
    try { sweepStaleExecDirs({ baseDir: opts.execBaseDir }); } catch { /* best-effort crash net */ }
  }

  const session = buildIsolatedSession({
    baseDir: opts.execBaseDir,
    requireAuth: !runnerInjected,
  });
  try {
    // IMP-02: the model/effort decision goes through the ONE typed policy —
    // call-site explicit values ride above the normal-profile matrix, invalid
    // values fail closed BEFORE any process, and the resolved route is
    // fingerprinted into a per-spawn sidecar.
    const route = resolveRoute({ role: opts.role, requestedModel: opts.model, requestedEffort: opts.reasoningEffort });
    const model = route.model;
    const reasoningEffort = route.effort;
    const argv = hermeticExecArgv({
      profile,
      qualification,
      sandbox,
      model,
      reasoningEffort,
      writableRoots: opts.writableRoots ?? [],
      skipGitRepoCheck: opts.skipGitRepoCheck ?? false,
      lastMessagePath: session.lastMessagePath,
      task: opts.task,
    });
    const { env, envKeys, callerEnvKeys, strictEnv } = buildHermeticEnv({
      profile,
      codexHomeDir: session.codexHomeDir,
      sessionId: opts.sessionId,
      callerEnv: opts.env,
    });
    const manifest = assembleEffectiveContextManifest({
      sessionId: opts.sessionId,
      role: opts.role,
      profile,
      profileHash,
      binPath: bin,
      qualification,
      argv,
      cwd: opts.cwd,
      envKeys,
      callerEnvKeys,
      strictEnv,
      codexHome: { dir: session.codexHomeDir, authMaterial: session.authMaterial, ...(session.authSourcePath ? { authSourcePath: session.authSourcePath } : {}) },
      instructionSources: discoverInstructionChain(opts.cwd, profile.neutralizeProjectDocs),
      model,
      reasoningEffort,
      sandbox,
      timeoutMs,
      task: opts.task,
    });
    let manifestPath: string | undefined;
    if (opts.manifestSink !== null) {
      manifestPath = persistEffectiveContextManifest(manifest, opts.manifestSink ?? defaultManifestSink());
    }

    const startedAt = Date.now();
    let runOut: { stdout: string; stderr: string; code: number } | undefined;
    let runnerError: Error | undefined;
    try {
      runOut = await runner({ bin, argv, cwd: opts.cwd, env, timeoutMs });
    } catch (err) {
      runnerError = err as Error;
    }
    const durationMs = Date.now() - startedAt;

    // IMP-02: the route sidecar is written for EVERY spawn that got a manifest —
    // including timed-out/died runs (a timeout is a distinct provider outcome,
    // never a content failure, never silently replayed).
    if (runnerError) {
      if (manifestPath) {
        const outcome = classifyProviderOutcome({ completed: false, errorMessage: runnerError.message });
        persistRouteResult(
          buildRouteResult({ role: opts.role, resolved: route, executionProfileHash: profileHash, cliVersion: qualification.version, outcome }),
          manifestPath,
        );
      }
      throw runnerError; // preserve the caller-visible contract (spawn error/timeout throws)
    }
    const { stdout, stderr, code } = runOut!;

    let finalMessage = "";
    let finalMessageSource: "output-file" | "stdout-fallback" = "stdout-fallback";
    try {
      const captured = readFileSync(session.lastMessagePath, "utf8").trim();
      if (captured.length > 0) {
        finalMessage = captured;
        finalMessageSource = "output-file";
      }
    } catch { /* runner produced no capture file (test double / crashed run) */ }
    if (finalMessageSource === "stdout-fallback") finalMessage = lastNonEmptyLine(stdout);

    if (manifestPath) {
      const outcome = classifyProviderOutcome({ completed: true, exitCode: code, stderr, finalMessage });
      persistRouteResult(
        buildRouteResult({ role: opts.role, resolved: route, executionProfileHash: profileHash, cliVersion: qualification.version, outcome }),
        manifestPath,
      );
    }

    if (manifestPath) {
      const result: ExecResultV1 = {
        schema: "exec-result-v1",
        sessionId: opts.sessionId,
        exitCode: code,
        ok: code === 0,
        durationMs,
        stdoutSha256: sha256Hex(stdout),
        stdoutBytes: Buffer.byteLength(stdout),
        stderrSha256: sha256Hex(stderr),
        stderrBytes: Buffer.byteLength(stderr),
        finalMessageSource,
        finalMessageSha256: sha256Hex(finalMessage),
        endedAtIso: new Date().toISOString(),
      };
      persistExecResult(result, opts.manifestSink ?? defaultManifestSink(), manifestPath);
    }

    return {
      ok: code === 0,
      exitCode: code,
      finalMessage,
      stdout,
      stderr,
      durationMs,
      sessionId: opts.sessionId,
      finalMessageSource,
      ...(manifestPath ? { manifestPath } : {}),
    };
  } finally {
    // ALWAYS remove the per-spawn session dir — it holds copied auth material.
    session.cleanup();
  }
}
