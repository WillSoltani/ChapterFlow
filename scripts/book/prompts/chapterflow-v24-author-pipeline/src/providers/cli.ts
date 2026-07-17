/**
 * Provider adapter: Claude Code CLI subprocess.
 *
 * Runs on the user's Claude Code Max subscription instead of a billed API key.
 * Spawns `claude -p` with `--disallowedTools` to disable tool use; uses the CLI
 * purely as a text generator.
 *
 * Requires `claude` CLI installed and authenticated via `claude /login`.
 */

import { spawn, spawnSync } from "child_process";
import { constants, existsSync, accessSync } from "fs";

import {
  AgentTier,
  CallOptions,
  Provider,
  ProviderRawResult,
  ProviderTimeoutError,
  defaultModelForProvider,
} from "./types.js";
import type { AgentRole } from "../contracts/executionProfile.js";

/** Policy P1 (owner assignment): no Claude-family model rates books or
 *  chapters. The roles below are the ones `modelPolicy.ROLE_TASK_CLASS` maps
 *  to a scoring task class ("chapter-direct-read" / "acceptance" /
 *  "bakeoff-judge") — qc-reviewer, chapter-reviewer, eval-reader, eval-book,
 *  book-acceptance-reader, bakeoff-judge. Writer/research/repair/scout roles
 *  are untouched: this refuses the RATING surface only, not the legacy CLI
 *  transport itself. `opts.role` is a precise caller pin (see
 *  `providers/router.ts` `roleForCall`); an unpinned call carries no role here
 *  (the router's tier→role fallback governs `modelPolicy` routing, not the
 *  literal `CallOptions` object handed to a provider), so only an EXPLICIT
 *  rating-role pin trips this refusal. */
const RATING_ROLES: ReadonlySet<AgentRole> = new Set<AgentRole>([
  "qc-reviewer",
  "chapter-reviewer",
  "eval-reader",
  "eval-book",
  "book-acceptance-reader",
  "bakeoff-judge",
]);

/** Thrown before any subprocess spawns when the legacy Claude Code CLI
 *  transport is asked to serve a rating/judging role. Policy P1 refuses this
 *  unconditionally — rating/judging work routes through the codex evaluator
 *  adapter instead (see V25_EVALUATOR_AND_MODEL_SELECTION_EXECUTION_PLAN.md
 *  §3). Non-rating roles (author-writer, research, …) are unaffected. */
export class AnthropicRatingRoleRefusalError extends Error {
  readonly role: AgentRole;
  constructor(role: AgentRole) {
    super(
      `Policy P1 (no Claude-family model rates books or chapters): the legacy anthropic-cli ` +
      `transport refuses to serve rating/judging role "${role}". Route rating/judging work through ` +
      `the codex evaluator adapter instead.`,
    );
    this.name = "AnthropicRatingRoleRefusalError";
    this.role = role;
  }
}

const DEFAULT_OUTPUT_LIMIT_BYTES = 1_000_000;
const TIMEOUT_KILL_GRACE_MS = 50;
const DISALLOWED_TOOLS = [
  "Task",
  "Agent",
  "Bash",
  "Edit",
  "MultiEdit",
  "Write",
  "Read",
  "Glob",
  "Grep",
  "WebFetch",
  "WebSearch",
  "NotebookEdit",
  "TodoWrite",
];

function findBinary(): string | null {
  if (process.env.CHAPTERFLOW_CLAUDE_BIN) return process.env.CHAPTERFLOW_CLAUDE_BIN;
  for (const p of [`${process.env.HOME}/.npm-global/bin/claude`, "/opt/homebrew/bin/claude", "/usr/local/bin/claude"]) {
    if (isExecutablePath(p)) return p;
  }
  return commandExists("claude") ? "claude" : null;
}

function isExecutablePath(path: string): boolean {
  try {
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function commandExists(command: string): boolean {
  const result = spawnSync(command, ["--version"], { stdio: "ignore", timeout: 3_000 });
  return !result.error && result.status === 0;
}

function hasClaudeAuthConfig(bin: string): boolean {
  if (process.env.CHAPTERFLOW_CLAUDE_SKIP_AUTH_CHECK === "1") return true;
  const home = process.env.HOME;
  if (home) {
    for (const path of [`${home}/.claude.json`, `${home}/.claude/.credentials.json`, `${home}/.config/claude/config.json`]) {
      if (existsSync(path)) return true;
    }
  }
  const result = spawnSync(bin, ["config", "get", "hasCompletedOnboarding"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    timeout: 5_000,
  });
  return !result.error && result.status === 0 && /true|1|yes/i.test(result.stdout);
}

function buildPromptPayload(opts: CallOptions): string {
  const messages = [
    { role: "system", content: opts.system },
    ...(opts.priorTurns ?? []).map((turn) => ({ role: turn.role, content: turn.content })),
    { role: "user", content: opts.user },
  ];
  return JSON.stringify({ messages });
}

function runSubprocess(
  bin: string,
  args: string[],
  stdin: string,
  timeoutMs: number,
  outputLimitBytes: number,
): Promise<{ stdout: string; stderr: string; code: number; stdoutTruncatedBytes: number; stderrTruncatedBytes: number }> {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(bin, args, {
      stdio: ["pipe", "pipe", "pipe"],
      detached: process.platform !== "win32",
    });
    const stdout = createBoundedCapture("stdout", outputLimitBytes);
    const stderr = createBoundedCapture("stderr", outputLimitBytes);
    let settled = false;
    let timedOut = false;
    let killTimer: NodeJS.Timeout | null = null;
    let terminationTimer: NodeJS.Timeout | null = null;
    const timer = setTimeout(() => {
      if (settled) return;
      timedOut = true;
      // Give direct descendants a brief chance to exit while the CLI parent is
      // still alive and can reap them. This avoids leaving killed grandchildren
      // as zombies after the provider timeout has already returned.
      killDescendants(child.pid, "SIGTERM");
      terminationTimer = setTimeout(() => {
        killProcessGroup(child.pid, "SIGTERM", child);
        killTimer = setTimeout(() => {
          killProcessGroup(child.pid, "SIGKILL", child);
        }, TIMEOUT_KILL_GRACE_MS);
        killTimer.unref();
      }, 25);
      terminationTimer.unref();
    }, timeoutMs);
    timer.unref();
    child.stdout.on("data", (d) => stdout.add(Buffer.isBuffer(d) ? d : Buffer.from(String(d))));
    child.stderr.on("data", (d) => stderr.add(Buffer.isBuffer(d) ? d : Buffer.from(String(d))));
    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (terminationTimer) clearTimeout(terminationTimer);
      if (killTimer) clearTimeout(killTimer);
      rejectPromise(err);
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (timedOut) {
        // The direct CLI process may close before its descendants have exited.
        // Re-send SIGKILL to the process group before resolving the timeout so
        // callers never observe orphaned model-provider grandchildren.
        killProcessGroup(child.pid, "SIGKILL", child);
        if (terminationTimer) clearTimeout(terminationTimer);
        if (killTimer) clearTimeout(killTimer);
        rejectPromise(new ProviderTimeoutError("anthropic-cli", timeoutMs));
        return;
      }
      if (terminationTimer) clearTimeout(terminationTimer);
      if (killTimer) clearTimeout(killTimer);
      resolvePromise({
        stdout: stdout.text(),
        stderr: stderr.text(),
        code: code ?? -1,
        stdoutTruncatedBytes: stdout.truncatedBytes,
        stderrTruncatedBytes: stderr.truncatedBytes,
      });
    });
    child.stdin.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code !== "EPIPE" && !settled) {
        settled = true;
        clearTimeout(timer);
        if (terminationTimer) clearTimeout(terminationTimer);
        if (killTimer) clearTimeout(killTimer);
        rejectPromise(err);
      }
    });
    child.stdin.write(stdin);
    child.stdin.end();
  });
}

function createBoundedCapture(label: "stdout" | "stderr", limitBytes: number): {
  readonly truncatedBytes: number;
  add(chunk: Buffer): void;
  text(): string;
} {
  const chunks: Buffer[] = [];
  let capturedBytes = 0;
  let truncatedBytes = 0;
  return {
    get truncatedBytes() {
      return truncatedBytes;
    },
    add(chunk: Buffer): void {
      const remaining = Math.max(0, limitBytes - capturedBytes);
      if (remaining > 0) {
        const slice = chunk.subarray(0, remaining);
        chunks.push(slice);
        capturedBytes += slice.length;
      }
      if (chunk.length > remaining) truncatedBytes += chunk.length - remaining;
    },
    text(): string {
      const body = Buffer.concat(chunks).toString("utf8");
      if (truncatedBytes === 0) return body;
      return `${body}\n[${label} truncated after ${limitBytes} bytes; discarded ${truncatedBytes} bytes]`;
    },
  };
}

function collectDescendantPids(pid: number): number[] {
  if (process.platform === "win32") return [];
  const seen = new Set<number>();
  const pending = [pid];
  const out: number[] = [];
  while (pending.length) {
    const parent = pending.pop()!;
    const result = spawnSync("pgrep", ["-P", String(parent)], { encoding: "utf8" });
    if (result.error || (!result.stdout && result.status !== 0)) continue;
    for (const raw of result.stdout.split(/\s+/)) {
      const childPid = Number(raw);
      if (!Number.isInteger(childPid) || childPid <= 0 || seen.has(childPid)) continue;
      seen.add(childPid);
      out.push(childPid);
      pending.push(childPid);
    }
  }
  return out;
}

function killPid(pid: number, signal: NodeJS.Signals): void {
  try {
    process.kill(pid, signal);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== "ESRCH") throw err;
  }
}

function killDescendants(pid: number | undefined, signal: NodeJS.Signals): void {
  if (!pid || process.platform === "win32") return;
  const descendants = collectDescendantPids(pid).reverse();
  for (const descendant of descendants) killPid(descendant, signal);
}

function killProcessGroup(pid: number | undefined, signal: NodeJS.Signals, child: ReturnType<typeof spawn>): void {
  if (!pid) return;
  const descendants = collectDescendantPids(pid).reverse();
  for (const descendant of descendants) killPid(descendant, signal);
  try {
    if (process.platform !== "win32") process.kill(-pid, signal);
    else child.kill(signal);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== "ESRCH") throw err;
  }
  if (process.platform !== "win32") killPid(pid, signal);
  for (const descendant of descendants) killPid(descendant, signal);
}

function outputLimitBytes(opts: CallOptions): number {
  const raw = opts.outputLimitBytes ?? (process.env.CHAPTERFLOW_PROVIDER_OUTPUT_LIMIT_BYTES ? Number(process.env.CHAPTERFLOW_PROVIDER_OUTPUT_LIMIT_BYTES) : DEFAULT_OUTPUT_LIMIT_BYTES);
  if (!Number.isInteger(raw) || raw < 1024 && raw !== 128) {
    throw new Error(`outputLimitBytes must be an integer >= 1024 (or 128 for tests); got ${String(raw)}`);
  }
  return raw;
}

export const ClaudeCliProvider: Provider = {
  name: "anthropic-cli",
  defaultModelForTier(tier: AgentTier): string {
    return defaultModelForProvider("anthropic-cli", tier);
  },
  isConfigured(): boolean {
    const bin = findBinary();
    if (!bin) return false;
    if (bin !== "claude" && !isExecutablePath(bin)) return false;
    if (!commandExists(bin)) return false;
    return hasClaudeAuthConfig(bin);
  },
  async call(opts: CallOptions & { model: string }): Promise<ProviderRawResult> {
    if (opts.role && RATING_ROLES.has(opts.role)) throw new AnthropicRatingRoleRefusalError(opts.role);
    const model = opts.model;
    const bin = findBinary();
    if (!bin) throw new Error("claude CLI executable not found");
    // WP-304 model lock: the model is ALWAYS pinned with an explicit `--model`
    // flag (the router resolves it through modelPolicy; it is never undefined).
    // An explicit `--model` wins over any ambient `~/.claude/settings.json`
    // default-model, so ambient user config CANNOT silently change which model a
    // call runs — the CLI-side mirror of the codex envelope's
    // `--ignore-user-config` intent for the MODEL dimension. Residual gap
    // (documented, out of scope): the Claude Code CLI exposes no
    // `--ignore-user-config` flag, so ambient NON-model config (MCP servers,
    // hooks) is not neutralized here — but all tool use is already disabled via
    // `--disallowedTools`, so no ambient config can add a tool or a second turn.
    const args = [
      "-p",
      "--model", model,
      "--output-format", "json",
      "--max-turns", "1",
      "--append-system-prompt", opts.system,
      "--disallowedTools", ...DISALLOWED_TOOLS,
    ];
    const promptText = buildPromptPayload(opts);
    const startedAt = Date.now();
    const timeoutMs = opts.timeoutMs ?? 240_000;

    const { stdout, stderr, code, stdoutTruncatedBytes } = await runSubprocess(bin, args, promptText, timeoutMs, outputLimitBytes(opts));
    const durationMs = Date.now() - startedAt;
    if (code !== 0) {
      const hint = stderr.includes("ENOENT") ? " — install with `npm install -g @anthropic-ai/claude-code`" : "";
      throw new Error(`claude CLI exited ${code}${hint}\nstderr: ${stderr}\nstdout: ${stdout}`);
    }
    if (stdoutTruncatedBytes > 0) {
      throw new Error(`claude CLI stdout exceeded capture limit; ${stdout}`);
    }

    let envelopeText = "";
    let inputTokens: number | undefined, outputTokens: number | undefined;
    try {
      const env = JSON.parse(stdout);
      envelopeText = typeof env.result === "string" ? env.result : (env.response ?? stdout);
      inputTokens = env.usage?.input_tokens ?? env.total_input_tokens;
      outputTokens = env.usage?.output_tokens ?? env.total_output_tokens;
    } catch {
      envelopeText = stdout;
    }

    const usage = { inputTokens, outputTokens };

    return {
      provider: "anthropic-cli",
      model,
      durationMs,
      raw: envelopeText,
      usage,
      inputTokens,
      outputTokens,
    };
  },
};
