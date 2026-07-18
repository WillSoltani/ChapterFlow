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
import type { ExecResultV1, WorkspaceFileV1 } from "../contracts/effectiveContext.js";
import { type CodexCliQualificationV1, qualifyCodexCli, syntheticQualification } from "../exec/cliQualification.js";
import {
  assembleEffectiveContextManifest,
  buildHermeticEnv,
  buildIsolatedSession,
  defaultManifestSink,
  discoverInstructionChain,
  ExecPreflightError,
  hermeticExecArgv,
  type HermeticEnvMap,
  persistEffectiveContextManifest,
  persistExecResult,
  persistRouteResult,
  persistStructuredOutput,
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
  env: HermeticEnvMap;
  timeoutMs: number;
};

/** Runs the codex subprocess. Injectable so tests can simulate agent effects
 *  (write a chapter file, drop a submission JSON) without a real `codex`. */
export type CodexRunner = (args: CodexRunnerArgs) => Promise<{ stdout: string; stderr: string; code: number }>;

export type CodexRunnerProcessFailureKind = "timeout" | "spawn_error";

/** After SIGKILL, prefer the child's close event so trailing pipe bytes are
 * retained. A descendant can keep inherited pipes open indefinitely, though,
 * so the diagnostic path has one short deterministic upper bound. */
export const CODEX_RUNNER_POST_KILL_GRACE_MS = 1_000;

/** A runner rejection that crossed (or tried to cross) the OS process
 * boundary. Unlike a plain Error, it retains every stdout/stderr byte decoded
 * before the timeout/spawn failure so the caller can persist bounded,
 * redacted diagnostics without rerunning the process. */
export class CodexRunnerProcessError extends Error {
  readonly failureKind: CodexRunnerProcessFailureKind;
  readonly errorName: string;
  readonly errorMessage: string;
  readonly timedOut: boolean;
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;

  constructor(args: {
    failureKind: CodexRunnerProcessFailureKind;
    errorName: string;
    errorMessage: string;
    timedOut: boolean;
    exitCode: number | null;
    stdout: string;
    stderr: string;
    cause?: unknown;
  }) {
    super(args.errorMessage, args.cause === undefined ? undefined : { cause: args.cause });
    this.name = "CodexRunnerProcessError";
    this.failureKind = args.failureKind;
    this.errorName = args.errorName;
    this.errorMessage = args.errorMessage;
    this.timedOut = args.timedOut;
    this.exitCode = args.exitCode;
    this.stdout = args.stdout;
    this.stderr = args.stderr;
  }
}

/** Exact hermetic process boundary. The callback runs after every pre-run
 * envelope check and the effective-context manifest write have succeeded, and
 * immediately before the runner is invoked. A callback failure therefore
 * prevents the process call and is never counted as a Codex invocation. */
export type CodexRunnerBoundaryV1 = {
  sessionId: string;
  manifestPath: string | null;
  schemaBound: boolean;
  outputSchemaPath: string | null;
  outputSchemaSha256: string | null;
};

export type SpawnCodexAgentOptions = {
  /** The agent's ENTIRE instruction — a prompt file or dispatch/task card, verbatim. */
  task: string;
  /** Distinct per spawn → CHAPTERFLOW_SESSION_ID (proves + enforces independence). */
  sessionId: string;
  /** Working directory (recorded verbatim in the manifest under the role's
   *  declared cwd POLICY). IMP-01 narrowed writers/repairers into isolated
   *  attempt workspaces; IMP-08 narrowed the review family into built role
   *  workspaces (reviewerWorkspace.ts) — reviewer cwds are tmpdir workspaces,
   *  never the pipeline root. */
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
  /** IMP-22 isolation seam: directory for the installed-CLI qualification
   *  cache. Defaults to the canonical manifest sink for all existing callers;
   *  experiment drivers may bind it to an experiment-local evidence root. */
  qualificationCacheDir?: string;
  /** IMP-00 test seam: base dir for the per-spawn isolated session (CODEX_HOME
   *  + last-message capture). Default: os tmpdir. */
  execBaseDir?: string;
  /** §16 D1 (owner directive 2026-07-11): path to a JSON Schema file. When set,
   *  the hermetic broker binds `codex exec --output-schema <file>` so the FINAL
   *  response is execution-layer constrained to the schema (not a prose legend),
   *  and writes a structured-output sidecar (schema path + SHA-256 + parse
   *  result). Central capability — every structured judge/reviewer call may use
   *  it; it is not a Stage-Q-only path. */
  outputSchemaPath?: string;
  /** Exact caller-constructed workspace manifest for isolated review roles.
   * The manifest is copied into the pre-spawn effective-context record so the
   * retained envelope proves every file visible to the model. */
  workspaceManifest?: { dir: string; files: WorkspaceFileV1[] };
  /** Model-free accounting/evidence signal used by the official IMP-24 live
   * adapter. It is deliberately below CLI/auth/manifest preflight and directly
   * above `runner(...)`; callers must not treat entry into spawnCodexAgent as a
   * process invocation. */
  onRunnerBoundary?: (boundary: Readonly<CodexRunnerBoundaryV1>) => void;
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

export type CodexPostRunEvidenceStage = "route" | "exec-result" | "structured-output";

/** The process returned and its exact response is already known, but a required
 * post-run evidence sidecar could not be retained. Callers must treat this as a
 * returned invocation with an integrity failure: the observation is carried on
 * the error so it cannot be mistaken for a runner rejection or lose raw output. */
export class CodexPostRunEvidenceError extends Error {
  readonly classification = "post_run_evidence_failure" as const;
  readonly stage: CodexPostRunEvidenceStage;
  readonly result: Readonly<CodexAgentResult>;

  constructor(args: {
    stage: CodexPostRunEvidenceStage;
    result: CodexAgentResult;
    cause: unknown;
  }) {
    const detail = args.cause instanceof Error ? args.cause.message : String(args.cause);
    super(`codex exec returned, but ${args.stage} evidence could not be retained: ${detail}`);
    this.name = "CodexPostRunEvidenceError";
    this.stage = args.stage;
    this.result = Object.freeze({ ...args.result });
  }
}

function persistReturnedEvidence(
  stage: CodexPostRunEvidenceStage,
  result: CodexAgentResult,
  persist: () => string | null,
): void {
  try {
    const path = persist();
    if (path === null) throw new Error("evidence sink returned no retained path");
  } catch (error) {
    throw new CodexPostRunEvidenceError({ stage, result, cause: error });
  }
}

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

export const defaultCodexRunner: CodexRunner = ({ bin, argv, cwd, env, timeoutMs }) =>
  new Promise((resolvePromise, rejectPromise) => {
    let child: ReturnType<typeof spawn>;
    try {
      // Node accepts an allowlist-built env map at runtime; the cast is needed
      // only because the root web-app program requires NODE_ENV on ProcessEnv.
      child = spawn(bin, argv, { cwd, env: env as NodeJS.ProcessEnv, stdio: ["ignore", "pipe", "pipe"] });
    } catch (error) {
      const detail = error instanceof Error ? error : new Error(String(error));
      rejectPromise(new CodexRunnerProcessError({
        failureKind: "spawn_error",
        errorName: detail.name,
        errorMessage: detail.message,
        timedOut: false,
        exitCode: null,
        stdout: "",
        stderr: "",
        cause: error,
      }));
      return;
    }
    // Retain bytes until the process observation is finalized. Decoding each
    // `data` chunk separately corrupts a UTF-8 code point split across chunks
    // and would make the retained byte/hash evidence describe replacement
    // characters rather than the exact CLI text.
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    const stdoutText = (): string => Buffer.concat(stdoutChunks).toString("utf8");
    const stderrText = (): string => Buffer.concat(stderrChunks).toString("utf8");
    let settled = false;
    let timedOut = false;
    let postKillTimer: NodeJS.Timeout | null = null;

    const rejectProcess = (error: CodexRunnerProcessError): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (postKillTimer !== null) clearTimeout(postKillTimer);
      rejectPromise(error);
    };

    const timeoutError = (exitCode: number | null): CodexRunnerProcessError =>
      new CodexRunnerProcessError({
        failureKind: "timeout",
        errorName: "TimeoutError",
        errorMessage: `codex exec timed out after ${timeoutMs}ms`,
        timedOut: true,
        exitCode,
        stdout: stdoutText(),
        stderr: stderrText(),
      });

    const timer = setTimeout(() => {
      if (settled) return;
      timedOut = true;
      // Wait for `close` after SIGKILL. Stream `data` events emitted while the
      // child terminates must be included in the typed timeout observation.
      // If kill itself errors, the `error` handler below still returns a typed
      // timeout because the timeout boundary was crossed first.
      child.kill("SIGKILL");
      postKillTimer = setTimeout(() => {
        // A descendant may still own inherited pipe descriptors. Stop
        // observing them after the bounded grace window; the error below
        // retains every byte captured up to this deterministic boundary.
        child.stdout?.destroy();
        child.stderr?.destroy();
        rejectProcess(timeoutError(
          typeof child.exitCode === "number" && child.exitCode >= 0 ? child.exitCode : null,
        ));
      }, CODEX_RUNNER_POST_KILL_GRACE_MS);
    }, timeoutMs);
    child.stdout?.on("data", (d) => stdoutChunks.push(Buffer.from(d)));
    child.stderr?.on("data", (d) => stderrChunks.push(Buffer.from(d)));
    child.on("error", (err) => {
      rejectProcess(new CodexRunnerProcessError({
        failureKind: timedOut ? "timeout" : "spawn_error",
        errorName: timedOut ? "TimeoutError" : err.name,
        errorMessage: timedOut ? `codex exec timed out after ${timeoutMs}ms` : err.message,
        timedOut,
        // Node uses negative libuv error codes (for example -2/ENOENT) when a
        // process never spawned. Those are not child exit codes.
        exitCode: timedOut && typeof child.exitCode === "number" && child.exitCode >= 0
          ? child.exitCode
          : null,
        stdout: stdoutText(),
        stderr: stderrText(),
        cause: err,
      }));
    });
    child.on("close", (code) => {
      if (settled) return;
      if (timedOut) {
        rejectProcess(timeoutError(typeof code === "number" ? code : null));
        return;
      }
      settled = true;
      clearTimeout(timer);
      if (postKillTimer !== null) clearTimeout(postKillTimer);
      resolvePromise({ stdout: stdoutText(), stderr: stderrText(), code: code ?? -1 });
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
    const env: HermeticEnvMap = {
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
    ?? (runnerInjected ? syntheticQualification() : await qualifyCodexCli({
      bin,
      cacheDir: opts.qualificationCacheDir ?? defaultManifestSink(),
    }));

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
    // §16 D1: a supplied output schema must exist and is hashed into the
    // structured-output sidecar (provenance). Fail closed on a missing schema.
    let outputSchemaSha256: string | undefined;
    if (opts.outputSchemaPath !== undefined) {
      if (!existsSync(opts.outputSchemaPath)) {
        throw new ExecPreflightError(`output schema file not found: ${opts.outputSchemaPath} — refusing to spawn a schema-bound call without its schema`);
      }
      outputSchemaSha256 = sha256Hex(readFileSync(opts.outputSchemaPath));
    }
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
      ...(opts.outputSchemaPath ? { outputSchemaPath: opts.outputSchemaPath } : {}),
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
      ...(opts.workspaceManifest ? {
        workspace: {
          dir: opts.workspaceManifest.dir,
          files: opts.workspaceManifest.files.map((file) => ({ ...file })),
        },
      } : {}),
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

    opts.onRunnerBoundary?.({
      sessionId: opts.sessionId,
      manifestPath: manifestPath ?? null,
      schemaBound: opts.outputSchemaPath !== undefined,
      outputSchemaPath: opts.outputSchemaPath ?? null,
      outputSchemaSha256: outputSchemaSha256 ?? null,
    });

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
          buildRouteResult({ role: opts.role, resolved: route, executionProfileHash: profileHash, cliVersion: qualification.version, outcome, authProof: session.authProof }),
          manifestPath,
        );
      }
      throw runnerError; // preserve the caller-visible contract (spawn error/timeout throws)
    }
    const { stdout, stderr, code } = runOut!;

    let finalMessage = "";
    let finalMessageSource: "output-file" | "stdout-fallback" = "stdout-fallback";
    try {
      // The existence of `-o` is authoritative even when Codex wrote an empty
      // response. Treating an empty capture as stdout fallback would turn a
      // content/contract failure into replay-eligible transport evidence.
      finalMessage = readFileSync(session.lastMessagePath, "utf8").trim();
      finalMessageSource = "output-file";
    } catch { /* runner produced no capture file (test double / crashed run) */ }
    if (finalMessageSource === "stdout-fallback") finalMessage = lastNonEmptyLine(stdout);

    const returnedResult: CodexAgentResult = {
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

    if (manifestPath) {
      const outcome = classifyProviderOutcome({ completed: true, exitCode: code, stderr, finalMessage });
      persistReturnedEvidence("route", returnedResult, () => persistRouteResult(
        buildRouteResult({ role: profile.role, resolved: route, executionProfileHash: profileHash, cliVersion: qualification.version, outcome, authProof: session.authProof }),
        manifestPath,
      ));

      const resultSidecar: ExecResultV1 = {
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
      persistReturnedEvidence("exec-result", returnedResult, () => persistExecResult(
        resultSidecar,
        opts.manifestSink ?? defaultManifestSink(),
        manifestPath,
      ));
    }

    // §16 D1: structured-output provenance for a schema-bound spawn.
    if (manifestPath && opts.outputSchemaPath && outputSchemaSha256) {
      const outputSchemaPath = opts.outputSchemaPath;
      let parsedOk = false; let parseError: string | undefined;
      try { JSON.parse(finalMessage); parsedOk = true; } catch (err) { parseError = (err as Error).message.slice(0, 200); }
      persistReturnedEvidence("structured-output", returnedResult, () => persistStructuredOutput({
        schema: "structured-output-sidecar-v1",
        sessionId: opts.sessionId,
        outputSchemaPath,
        outputSchemaSha256,
        rawFinalMessageSha256: sha256Hex(finalMessage),
        rawFinalMessageBytes: Buffer.byteLength(finalMessage),
        parsedOk,
        ...(parseError ? { parseError } : {}),
      }, manifestPath));
    }

    return returnedResult;
  } finally {
    // ALWAYS remove the per-spawn session dir — it holds copied auth material.
    session.cleanup();
  }
}
