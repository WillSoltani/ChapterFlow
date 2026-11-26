import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import type { ExecutionProfile } from "../../prompts/chapterflow-v24-author-pipeline/src/runtime/executionPolicyTypes";
import { createClaudeRoute } from "../../prompts/chapterflow-v24-author-pipeline/src/runtime/claudeRoute";
import { appendLedger, ledgerTotal } from "./ledger";
import { EFFORTS, type Effort, type RoleConfig } from "./types";

export class UsageLimitError extends Error {
  readonly exitCode = 3;
}
export class BudgetError extends Error {
  readonly exitCode = 4;
}
export class CallFailedError extends Error {}

/** No tools: the model only returns text. */
export const READ_ONLY_PROFILE: ExecutionProfile = {
  id: "v26-read-only",
  workDirPolicy: "ATTEMPT_ROOT",
  mode: "READ_ONLY",
  outputSchemaId: "v26-json",
  timeoutMs: 900000,
  terminateGraceMs: 5000,
  maxStdoutBytes: 16777216,
  maxStderrBytes: 1048576,
};

export function buildArgv(model: string, effort: string): string[] {
  // --restricted alone still loads the operator's claude.ai MCP connectors; --strict-mcp-config stops that.
  return [...createClaudeRoute(model, effort).build(READ_ONLY_PROFILE).args, "--strict-mcp-config"];
}

export function childEnv(base: NodeJS.ProcessEnv = process.env): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(base)) if (typeof v === "string") env[k] = v;
  // The route env is model-independent, so any model/effort pair yields it.
  Object.assign(env, createClaudeRoute("x", "high").env!(READ_ONLY_PROFILE));
  // Subscription auth only: an API key in the environment would bill the wrong account.
  delete env.OPENAI_API_KEY;
  delete env.ANTHROPIC_API_KEY;
  return env;
}

export interface CallOptions {
  role: RoleConfig;
  prompt: string;
  step: string;
  chapter: string;
  kind: "write" | "fix" | "other";
  ledgerPath: string;
  budgetUsd: number;
  cwd: string;
  timeoutMs: number;
  outPrefix?: string;
}

export interface CallResult {
  text: string;
  json: unknown | null;
  envelope: Record<string, unknown>;
  cost: number;
  effortUsed: string;
  seconds: number;
}

const USAGE_LIMIT_RE = /usage limit|rate.?limit|limit reached|too many requests|weekly limit|overloaded/i;

interface Attempt {
  stdout: string;
  stderr: string;
  code: number | null;
  seconds: number;
  timedOut: boolean;
  envelope: Record<string, unknown> | null;
}

function runClaude(o: CallOptions, effort: string): Promise<Attempt> {
  return new Promise((resolve) => {
    const started = Date.now();
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    let timedOut = false;
    let settled = false;

    const finish = (code: number | null, spawnError?: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const stdout = Buffer.concat(out).toString("utf8");
      const stderr = Buffer.concat(err).toString("utf8") + (spawnError ?? "");
      resolve({ stdout, stderr, code, seconds: (Date.now() - started) / 1000, timedOut, envelope: parseEnvelope(stdout) });
    };

    const child = spawn(o.role.bin, buildArgv(o.role.model, effort), {
      cwd: o.cwd,
      env: childEnv(),
      stdio: ["pipe", "pipe", "pipe"],
    });
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, o.timeoutMs);

    child.stdout.on("data", (c: Buffer) => out.push(c));
    child.stderr.on("data", (c: Buffer) => err.push(c));
    child.on("error", (e) => finish(null, `spawn failed: ${e.message}`));
    // "close" (not "exit") so all stdout is drained before we parse it.
    child.on("close", (code) => finish(code));
    child.stdin.on("error", () => {}); // the child may die before reading the prompt
    child.stdin.end(o.prompt);
  });
}

function parseEnvelope(stdout: string): Record<string, unknown> | null {
  try {
    const v: unknown = JSON.parse(stdout);
    return v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Strip one Markdown fence wrapped around the whole answer; inner fences are left alone. */
function stripFence(text: string): string {
  const m = text.match(/^\s*```[A-Za-z0-9_-]*[ \t]*\r?\n([\s\S]*?)\r?\n?[ \t]*```\s*$/);
  return m ? m[1]!.trim() : text;
}

function excerpt(a: Attempt): string {
  const result = typeof a.envelope?.result === "string" ? a.envelope.result : "";
  const why = a.timedOut ? "timed out" : `exit ${a.code}`;
  return `${why}; ${(result || a.stderr || a.stdout).trim().slice(0, 300)}`;
}

export async function callModel(o: CallOptions): Promise<CallResult> {
  // Reserve the cost of one call before spawning anything.
  const reserve = o.kind === "other" ? 1 : 2;
  const spent = ledgerTotal(o.ledgerPath);
  if (spent + reserve > o.budgetUsd) {
    throw new BudgetError(`BUDGET_STOP: spent $${spent.toFixed(2)} + reserve $${reserve.toFixed(2)} exceeds budget $${o.budgetUsd.toFixed(2)}`);
  }
  fs.mkdirSync(o.cwd, { recursive: true });

  let effort: string = o.role.effort;
  let retried = false;

  for (;;) {
    const a = await runClaude(o, effort);
    const env = a.envelope;
    const isError = env === null || env.is_error === true;
    const usage = env?.usage as { output_tokens?: unknown } | undefined;
    appendLedger(o.ledgerPath, {
      ts: new Date().toISOString(),
      chapter: o.chapter,
      step: retried ? `${o.step}:retry` : o.step,
      model: o.role.model,
      effort,
      cost: typeof env?.total_cost_usd === "number" ? env.total_cost_usd : 0,
      outTokens: typeof usage?.output_tokens === "number" ? usage.output_tokens : null,
      stopReason: typeof env?.stop_reason === "string" ? env.stop_reason : null,
      seconds: a.seconds,
      isError,
    });

    const resultText = typeof env?.result === "string" ? env.result : "";
    if (env?.is_error === true && (env.api_error_status === 429 || USAGE_LIMIT_RE.test(resultText) || USAGE_LIMIT_RE.test(a.stderr))) {
      throw new UsageLimitError(`USAGE_LIMIT: ${excerpt(a)}`);
    }

    // One retry in total, whatever the reason.
    if (env !== null && env.stop_reason === "max_tokens") {
      const lower = EFFORTS[EFFORTS.indexOf(effort as Effort) - 1];
      if (retried || lower === undefined) {
        throw new CallFailedError(`output hit max_tokens at effort ${effort}${retried ? " after a retry" : ""}`);
      }
      effort = lower;
      retried = true;
      continue;
    }

    if (env === null || isError || typeof env.result !== "string") {
      if (retried) throw new CallFailedError(`${o.step}: call failed twice: ${excerpt(a)}`);
      retried = true;
      continue;
    }

    const text = stripFence(env.result);
    let json: unknown | null = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* the caller decides whether prose is acceptable */
    }
    if (o.outPrefix) {
      fs.mkdirSync(path.dirname(o.outPrefix), { recursive: true });
      fs.writeFileSync(o.outPrefix + ".envelope.json", a.stdout);
      fs.writeFileSync(o.outPrefix + ".result.txt", text);
      if (json !== null) fs.writeFileSync(o.outPrefix + ".json", JSON.stringify(json, null, 2));
    }
    return { text, json, envelope: env, cost: typeof env.total_cost_usd === "number" ? env.total_cost_usd : 0, effortUsed: effort, seconds: a.seconds };
  }
}
