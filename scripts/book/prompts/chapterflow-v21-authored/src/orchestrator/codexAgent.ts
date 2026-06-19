/**
 * codexAgent — spawn ONE headless Codex agentic sub-session and wait for it to
 * finish a task.
 *
 * This is the worker primitive the Book Autopilot conductor uses: the conductor
 * (deterministic code) decides WHAT to do; each unit of agentic WORK (research a
 * book, author a chapter, review a QC unit, repair findings) is delegated to a
 * fresh `codex exec` session running on the user's Codex subscription — NOT a
 * billed API call. The agent gets the existing prompt/dispatch-card text verbatim
 * as its task, runs in the pipeline working dir with workspace-write so it can
 * author/edit chapter JSON and run the deterministic gate CLIs itself, then exits.
 *
 * Two invariants this enforces:
 *  - No API metering: model work goes through `codex exec` (subscription), never
 *    the openai-api / anthropic-api providers or `claude -p`.
 *  - Session independence: each spawn carries a DISTINCT CHAPTERFLOW_SESSION_ID
 *    (writer ≠ each reviewer ≠ confirm), which qc-submit records and finalize uses
 *    to REVISE-reject any author-grades-own-work / shared-reviewer collision.
 *
 * The actual subprocess is behind an injectable `runner` so the conductor's logic
 * is unit-testable WITHOUT a real `codex` binary (which need not be present in CI
 * or this dev box). The default runner shells out to `codex exec`.
 */

import { spawn } from "child_process";
import { existsSync } from "fs";

/** Strict env every pipeline agent session runs under (mirrors the `## Setup`
 *  block baked into the entry prompts). The conductor adds CHAPTERFLOW_SESSION_ID. */
export const STRICT_AGENT_ENV: Record<string, string> = {
  CHAPTERFLOW_NO_API_CODEX_QC: "1",
  CHAPTERFLOW_REQUIRE_SOURCE_VERIFY: "1",
  CHAPTERFLOW_ENFORCE_SESSION_INDEPENDENCE: "1",
};

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
  /** Working directory (the pipeline dir) so the agent runs the CLI + edits state/. */
  cwd: string;
  /** Default workspace-write (author/edit chapters); read-only for pure reviewers. */
  sandbox?: CodexSandbox;
  /** Agentic sessions are long; default 30 min. */
  timeoutMs?: number;
  /** Extra env merged over STRICT_AGENT_ENV (never overrides CHAPTERFLOW_SESSION_ID). */
  env?: Record<string, string>;
  /** Override the codex binary (else CHAPTERFLOW_CODEX_BIN or PATH `codex`). */
  bin?: string;
  /** Injectable for tests. Defaults to the real `codex exec` runner. */
  runner?: CodexRunner;
};

export type CodexAgentResult = {
  ok: boolean;
  exitCode: number;
  /** The agent's final stdout message (codex exec prints the final message to stdout). */
  finalMessage: string;
  stdout: string;
  stderr: string;
  durationMs: number;
  sessionId: string;
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

/** Build the `codex exec` argv. Flags are intentionally minimal + centralized
 *  here — confirm them against your installed codex version (`codex exec --help`)
 *  and tweak in ONE place if needed. `codex exec` runs non-interactively to
 *  completion and prints the final agent message to stdout. */
export function codexExecArgv(task: string, sandbox: CodexSandbox): string[] {
  return ["exec", "--sandbox", sandbox, task];
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

/** Spawn one headless Codex agent and resolve when it completes. Never throws on
 *  a non-zero exit — returns `{ ok: false, ... }` so the conductor decides. Only
 *  throws on spawn error / timeout (the runner rejecting). */
export async function spawnCodexAgent(opts: SpawnCodexAgentOptions): Promise<CodexAgentResult> {
  const bin = opts.bin ?? findCodexBinary();
  const sandbox = opts.sandbox ?? "workspace-write";
  const timeoutMs = opts.timeoutMs ?? 1_800_000;
  const runner = opts.runner ?? defaultCodexRunner;
  const argv = codexExecArgv(opts.task, sandbox);
  // CHAPTERFLOW_SESSION_ID is set LAST so a caller's env map can never clobber the
  // distinct per-spawn identity the independence checks depend on.
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ...STRICT_AGENT_ENV,
    ...(opts.env ?? {}),
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
