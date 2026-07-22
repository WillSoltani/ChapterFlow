import type { ModelProcessRoute } from "./codexRoute.js";
import type { ExecutionProfile } from "./executionPolicyTypes.js";

/**
 * Task 7 — Claude Sonnet 5 production route (subscription auth via the `claude`
 * CLI), a second `ModelProcessRoute` beside `createCodexRoute`. Same contract:
 * the prompt is delivered on **stdin** (never in argv, so no prompt/source
 * bytes can leak onto the command line), the model + effort tier are the only
 * per-call parameters, and the executionPolicy env-strip (API keys removed,
 * HOME preserved) leaves the CLI on its `~/.claude` subscription credentials.
 *
 * ── PROBE TRANSCRIPT (Task 7 Step 1) ────────────────────────────────────────
 * STATUS: **DERIVED, NOT LIVE-PROBED.** The `claude` CLI is not installed in
 * the implementation environment (`which claude` → not found) and this is a
 * non-interactive session with no way to run `claude /login`, so the one-time
 * live probe (`claude --version`, `claude --help`, two headless calls) and the
 * Step 5 live smoke could not be executed here. The args below are pinned from
 * the documented Claude Code headless (`-p`) CLI contract and MUST be confirmed
 * by the live probe + smoke before `config/model-routing.json` is flipped to
 * the claude-cli D1 defaults (Task 7 Step 6, deliberately left un-flipped).
 *
 * Documented contract the args rely on (confirm each in the live probe):
 *   claude -p                         headless / print mode (no REPL)
 *   --output-format json              structured envelope (see normalizeClaudeStdout)
 *   --model <id>                      e.g. claude-sonnet-5 (supplied by caller, config-sourced)
 *   --disallowedTools "*"             READ_ONLY analog: no tool use, pure JSON answer
 *   --permission-mode acceptEdits     WORKSPACE_WRITE analog: auto-approve edits in cwd
 * Effort tier → thinking budget is conveyed via the MAX_THINKING_TOKENS env var
 * (Claude Code exposes no per-call effort/thinking FLAG as of this contract), so
 * effort flows through `env()` below, not argv. If the live probe finds a real
 * effort/thinking flag, move the mapping from `thinkingBudgetEnv` into
 * `effortArgs` — everything else stays.
 * ────────────────────────────────────────────────────────────────────────────
 */

/** Route id, exported so a preflight/doctor can identify "this is the real
 *  claude route" without a magic string literal. */
export const CLAUDE_ROUTE_ID = "claude-subscription-v1";

export type ClaudeEffort = "low" | "medium" | "high" | "xhigh";

/** Effort tier → extended-thinking token budget (Task 7 Step 1 mapping;
 *  MAX_THINKING_TOKENS env var — the documented Claude Code thinking control).
 *  Adjust the numbers to live-probe findings; the mechanism (env, not flag)
 *  is the part that must be confirmed. */
export const CLAUDE_THINKING_BUDGET_BY_EFFORT: Readonly<Record<ClaudeEffort, number>> = Object.freeze({
  low: 4096,
  medium: 8192,
  high: 16384,
  xhigh: 32768,
});

/** The env var name the thinking budget is written to. Route-supplied env is
 *  merged by the gateway AFTER the executionPolicy env-strip and is guarded so
 *  it can never reintroduce a forbidden provider key (see modelGateway). */
export const CLAUDE_THINKING_ENV_VAR = "MAX_THINKING_TOKENS" as const;

/** READ_ONLY analog of codex's `--sandbox read-only`: no tools at all, so the
 *  model can only return its JSON answer (nothing to read/write/execute). */
const READ_ONLY_LOCKDOWN_ARGS: readonly string[] = ["--disallowedTools", "*"];

/** WORKSPACE_WRITE analog of codex's `--sandbox workspace-write`: auto-accept
 *  edits within the launch cwd (which the executionPolicy has already pinned to
 *  the isolated attempt sub-root — no `--add-dir` needed, cwd IS the grant). */
const WORKSPACE_WRITE_ARGS: readonly string[] = ["--permission-mode", "acceptEdits"];

function normalizeEffort(effort: string): ClaudeEffort {
  return effort === "low" || effort === "medium" || effort === "high" || effort === "xhigh"
    ? effort
    : "high";
}

/** Effort → CLI args. Empty today: the documented headless CLI exposes no
 *  effort/thinking flag, so tiering rides on `env()` (MAX_THINKING_TOKENS). If a
 *  live probe surfaces a flag, fill this in and drop the env mapping. */
export function effortArgs(_effort: string): readonly string[] {
  return [];
}

/** Effort → route-supplied env (the thinking budget). Merged post-policy by the
 *  gateway; the gateway rejects any forbidden key, so this stays a security-safe
 *  additive channel. */
export function thinkingBudgetEnv(effort: string): Readonly<Record<string, string>> {
  const budget = CLAUDE_THINKING_BUDGET_BY_EFFORT[normalizeEffort(effort)];
  return Object.freeze({ [CLAUDE_THINKING_ENV_VAR]: String(budget) });
}

/**
 * Output-envelope adapter (Task 7 Step 4). `claude --output-format json` wraps
 * the model's answer in a result envelope:
 *   {"type":"result","subtype":"success","is_error":false,
 *    "result":"<the assistant's text — our inner JSON>", "session_id":..., ...}
 * The gateway's validateOutput expects the *inner* JSON object directly (that is
 * the codex contract too — codex prints the bare final message). So we unwrap:
 * parse the envelope, and if it is a successful result whose `.result` is a
 * string, hand back exactly those bytes for validateOutput to parse. Anything
 * unexpected (not JSON, error envelope, non-string result) falls through to the
 * ORIGINAL bytes so validateOutput fails-closed on it rather than this adapter
 * throwing. */
export function normalizeClaudeStdout(stdout: Uint8Array): Uint8Array {
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(stdout);
    const envelope = JSON.parse(text) as unknown;
    if (
      envelope !== null
      && typeof envelope === "object"
      && !Array.isArray(envelope)
    ) {
      const record = envelope as Record<string, unknown>;
      if (record.is_error === true) return stdout;
      if (typeof record.result === "string") {
        return new TextEncoder().encode(record.result);
      }
    }
  } catch {
    // Non-UTF8 / non-JSON / oversized — leave untouched; validateOutput rejects it.
  }
  return stdout;
}

/**
 * Construct the claude route for a resolved role route's (model, effort).
 * Mirrors createCodexRoute's shape: pure {command, args} builder plus the
 * envelope adapter and the effort→env mapping. No real process is spawned here;
 * no model literal is hardcoded (model flows in from config).
 */
export function createClaudeRoute(model: string, effort: string): ModelProcessRoute {
  return Object.freeze({
    id: CLAUDE_ROUTE_ID,
    build(profile: ExecutionProfile) {
      const base = ["-p", "--output-format", "json", "--model", model, ...effortArgs(effort)];
      const mode = profile.mode === "READ_ONLY" ? READ_ONLY_LOCKDOWN_ARGS : WORKSPACE_WRITE_ARGS;
      return { command: "claude", args: [...base, ...mode] };
    },
    env(_profile: ExecutionProfile) {
      return thinkingBudgetEnv(effort);
    },
    normalizeStdout(stdout: Uint8Array) {
      return normalizeClaudeStdout(stdout);
    },
  });
}
