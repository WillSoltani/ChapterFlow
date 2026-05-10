/**
 * Provider adapter: Claude Code CLI subprocess.
 *
 * Runs on the user's Claude Code Max subscription instead of a billed API key.
 * Spawns `claude -p` with `--disallowedTools` to disable tool use; uses the CLI
 * purely as a text generator.
 *
 * Requires `claude` CLI installed and authenticated via `claude /login`.
 */

import { spawn } from "child_process";
import { existsSync } from "fs";

import {
  AgentTier,
  CallOptions,
  CallResult,
  Provider,
  appendJsonInstruction,
  extractJson,
} from "./types.js";

const TIER_DEFAULT_MODELS: Record<AgentTier, string> = {
  writer: "claude-opus-4-7",
  researcher: "claude-sonnet-4-6",
  critic: "claude-haiku-4-5-20251001",
};

function findBinary(): string {
  if (process.env.CHAPTERFLOW_CLAUDE_BIN) return process.env.CHAPTERFLOW_CLAUDE_BIN;
  for (const p of [`${process.env.HOME}/.npm-global/bin/claude`, "/opt/homebrew/bin/claude", "/usr/local/bin/claude"]) {
    if (existsSync(p)) return p;
  }
  return "claude";
}

function buildCombinedPrompt(opts: CallOptions): string {
  const parts: string[] = [];
  if (opts.priorTurns) {
    for (const turn of opts.priorTurns) {
      parts.push(`${turn.role.toUpperCase()}:\n${turn.content}`);
    }
  }
  parts.push(opts.jsonMode ? appendJsonInstruction(opts.user) : opts.user);
  return parts.join("\n\n---\n\n");
}

function runSubprocess(
  bin: string,
  args: string[],
  stdin: string,
  timeoutMs: number,
): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(bin, args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGKILL");
      rejectPromise(new Error(`claude CLI timed out after ${timeoutMs}ms`));
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
    child.stdin.write(stdin);
    child.stdin.end();
  });
}

export const ClaudeCliProvider: Provider = {
  name: "anthropic-cli",
  defaultModelForTier(tier: AgentTier): string {
    return TIER_DEFAULT_MODELS[tier];
  },
  isConfigured(): boolean {
    const bin = findBinary();
    return bin === "claude" || existsSync(bin);
  },
  async call<T = string>(opts: CallOptions): Promise<CallResult<T>> {
    const model = opts.model ?? TIER_DEFAULT_MODELS[opts.tier];
    const bin = findBinary();
    const args = [
      "-p",
      "--model", model,
      "--output-format", "json",
      "--max-turns", "1",
      "--append-system-prompt", opts.system,
      "--disallowedTools", "Bash Edit Write Read Glob Grep WebFetch WebSearch Agent",
    ];
    const promptText = buildCombinedPrompt(opts);
    const startedAt = Date.now();
    const timeoutMs = opts.timeoutMs ?? 240_000;

    const { stdout, stderr, code } = await runSubprocess(bin, args, promptText, timeoutMs);
    const durationMs = Date.now() - startedAt;
    if (code !== 0) {
      const hint = stderr.includes("ENOENT") ? " — install with `npm install -g @anthropic-ai/claude-code`" : "";
      throw new Error(`claude CLI exited ${code}${hint}\nstderr: ${stderr}\nstdout: ${stdout.slice(0, 500)}`);
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

    let content: T;
    if (opts.jsonMode) {
      const jsonText = extractJson(envelopeText);
      try {
        content = JSON.parse(jsonText) as T;
      } catch (err) {
        throw new Error(`Failed to parse JSON from ${model}: ${(err as Error).message}\n---\n${envelopeText.slice(0, 500)}`);
      }
    } else {
      content = envelopeText as unknown as T;
    }

    return {
      provider: "anthropic-cli",
      model,
      durationMs,
      content,
      raw: envelopeText,
      inputTokens,
      outputTokens,
    };
  },
};
