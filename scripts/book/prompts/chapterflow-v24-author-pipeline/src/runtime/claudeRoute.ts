import type { ModelProcessRoute } from "./codexRoute.js";
import type { ExecutionProfile } from "./executionPolicyTypes.js";

/**
 * Task 7 — Claude Sonnet 5 production route (subscription auth via the `claude`
 * CLI), a second `ModelProcessRoute` beside `createCodexRoute`. Same contract:
 * the prompt is delivered on **stdin** (never in argv, so no prompt/source
 * bytes can leak onto the command line), the model + effort tier are the only
 * per-call parameters, and the executionPolicy env-strip (API keys removed,
 * HOME preserved) leaves the CLI on its subscription credentials (macOS
 * Keychain / `~/.claude`, not env keys).
 *
 * ── PROBE TRANSCRIPT (Task 7 Step 1) ────────────────────────────────────────
 * STATUS: **LIVE-PROBED 2026-07-22** against `/opt/homebrew/bin/claude`
 * (`claude --version` → `2.1.197 (Claude Code)`; on PATH; auth = macOS Keychain
 * subscription creds, works headless). Findings that pin the args below:
 *   claude -p / --print               headless / print mode (`-p, --print`)
 *   --output-format json              structured envelope; help: `"json" (single
 *                                     result)`, "only works with --print" — works
 *                                     WITHOUT --verbose. See normalizeClaudeStdout.
 *   --model <id>                      e.g. claude-sonnet-5 (resolves); caller-supplied,
 *                                     config-sourced — never hardcoded here.
 *   --effort <level>                  Effort level for the session; help enumerates
 *                                     exactly (low, medium, high, xhigh, max). This
 *                                     is a real per-call FLAG — effort rides in argv
 *                                     (effortArgs), NOT a thinking-budget env var.
 *   --disallowedTools "*"             READ_ONLY analog: no tool use, pure JSON answer.
 *                                     Help spells it `--disallowedTools, --disallowed-tools
 *                                     <tools...>` — both spellings accepted; camelCase used.
 *   --permission-mode acceptEdits     WORKSPACE_WRITE analog: auto-approve edits in cwd.
 *                                     Help choices include "acceptEdits". With cwd pinned
 *                                     to the isolated attempt sub-root by executionPolicy,
 *                                     files are written there with NO --add-dir needed.
 * ────────────────────────────────────────────────────────────────────────────
 */

/** Route id, exported so a preflight/doctor can identify "this is the real
 *  claude route" without a magic string literal. */
export const CLAUDE_ROUTE_ID = "claude-subscription-v1";

/** Effort tiers the installed `claude --effort <level>` flag accepts (live
 *  probe 2026-07-22). RoleRoute (Task 6) constrains config to a subset of
 *  these (low/medium/high/xhigh); "max" is accepted by the CLI and passes
 *  through verbatim if ever supplied. */
export type ClaudeEffort = "low" | "medium" | "high" | "xhigh" | "max";

function normalizeEffort(effort: string): ClaudeEffort {
  return effort === "low" || effort === "medium" || effort === "high" || effort === "xhigh" || effort === "max"
    ? effort
    : "high";
}

/** READ_ONLY analog of codex's `--sandbox read-only`: no tools at all, so the
 *  model can only return its JSON answer (nothing to read/write/execute). */
const READ_ONLY_LOCKDOWN_ARGS: readonly string[] = ["--disallowedTools", "*"];

/** WORKSPACE_WRITE analog of codex's `--sandbox workspace-write`: auto-accept
 *  edits within the launch cwd (which the executionPolicy has already pinned to
 *  the isolated attempt sub-root — no `--add-dir` needed, cwd IS the grant). */
const WORKSPACE_WRITE_ARGS: readonly string[] = ["--permission-mode", "acceptEdits"];

/** Effort → CLI args. The installed CLI exposes `--effort <level>` (live probe),
 *  so the effort tier rides in argv verbatim (unknown strings degrade to the
 *  "high" tier, never NaN and never an invalid flag value). */
export function effortArgs(effort: string): readonly string[] {
  return ["--effort", normalizeEffort(effort)];
}

/**
 * Strip a single Markdown code fence around the model's answer. Claude in `-p`
 * mode very commonly returns its JSON wrapped in a ```json … ``` (or bare ```)
 * fence (live probe 2026-07-22 — the smoke's first cooperative task came back
 * fenced), which `JSON.parse` rejects. codex emits the bare object, so part of
 * normalizing claude to that same contract is unwrapping the fence. If no fence
 * is present the text is returned unchanged (so already-bare JSON is untouched).
 */
export function stripCodeFence(text: string): string {
  const match = text.match(/```(?:[A-Za-z0-9_-]+)?[ \t]*\r?\n?([\s\S]*?)\r?\n?[ \t]*```/);
  return match ? match[1]!.trim() : text;
}

/**
 * Output-envelope adapter (Task 7 Step 4). `claude --output-format json` wraps
 * the model's answer in a result envelope:
 *   {"type":"result","subtype":"success","is_error":false,
 *    "result":"<the assistant's text — our inner JSON, sometimes fenced>", ...}
 * The gateway's validateOutput expects the *inner* JSON object directly (that is
 * the codex contract too — codex prints the bare final message). So we unwrap:
 * parse the envelope, and if it is a successful result whose `.result` is a
 * string, strip any Markdown code fence and hand back those bytes for
 * validateOutput to parse. Anything unexpected (not JSON, error envelope,
 * non-string result) falls through to the ORIGINAL bytes so validateOutput
 * fails-closed on it rather than this adapter throwing. */
/** Task 11x: a claude envelope with is_error=true is an API-side failure
 * (rate limit, content filter, 4xx/5xx) — NOT model output. Surface it as a
 * process-class failure with the API's own message so retries/diagnostics see
 * the truth instead of a schema-validation red herring. */
export function classifyClaudeStdout(stdout: Uint8Array): { errorCode: "MODEL_PROCESS_FAILED"; message: string } | null {
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(stdout);
    const envelope = JSON.parse(text) as unknown;
    if (envelope !== null && typeof envelope === "object" && !Array.isArray(envelope)) {
      const record = envelope as Record<string, unknown>;
      if (record.is_error === true) {
        const raw = typeof record.result === "string" ? record.result : "claude envelope reported is_error with no result message";
        const status = typeof record.api_error_status === "number" ? ` (api_error_status=${record.api_error_status})` : "";
        return { errorCode: "MODEL_PROCESS_FAILED", message: `${raw.slice(0, 300)}${status}` };
      }
    }
  } catch {
    // fall through — normalize/validate own the non-JSON cases
  }
  return null;
}

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
        return new TextEncoder().encode(stripCodeFence(record.result));
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
 * envelope adapter. No real process is spawned here; no model literal is
 * hardcoded (model flows in from config).
 */
export function createClaudeRoute(model: string, effort: string): ModelProcessRoute {
  return Object.freeze({
    id: CLAUDE_ROUTE_ID,
    build(profile: ExecutionProfile) {
      const base = ["-p", "--output-format", "json", "--model", model, ...effortArgs(effort)];
      const mode = profile.mode === "READ_ONLY" ? READ_ONLY_LOCKDOWN_ARGS : WORKSPACE_WRITE_ARGS;
      return { command: "claude", args: [...base, ...mode] };
    },
    normalizeStdout(stdout: Uint8Array) {
      return normalizeClaudeStdout(stdout);
    },
    classifyStdout(stdout: Uint8Array) {
      return classifyClaudeStdout(stdout);
    },
  });
}
