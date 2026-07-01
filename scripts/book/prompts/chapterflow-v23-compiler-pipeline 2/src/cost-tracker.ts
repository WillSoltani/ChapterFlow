/**
 * v22 cost/token telemetry.
 *
 * This module is now the provider choke-point used by claudeClient.ts. It keeps
 * model behavior unchanged, but records metadata per logical stage whenever a
 * run is active. The output is intentionally content-free: no prompts, no raw
 * responses, only counts, timing, model names, and ids.
 */

import { mkdirSync } from "fs";
import { resolve } from "path";
import { writeFileAtomic } from "./lib/atomicWrite.js";
import { CallOptions, CallResult } from "./providers/types.js";
import { callModel as routerCallModel } from "./providers/router.js";

export type CostBucket = {
  calls: number;
  attempts: number;
  in: number;
  out: number;
  cacheRead: number;
  cacheWrite: number;
  usd: number;
  durationMs: number;
  jsonRepairs: number;
  retries: number;
};

export type CostCallRecord = {
  at: string;
  stage: string;
  tier: string;
  provider: string;
  model: string;
  bookId?: string;
  chapterId?: string;
  runId?: string;
  costCenter?: string;
  attempts: number;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  estimatedCostUsd: number;
  jsonRepairs: number;
  retries: number;
};

export type CostStats = CostBucket & {
  runId: string;
  startedAt: string;
  endedAt?: string;
  byModel: Record<string, CostBucket>;
  byTier: Record<string, CostBucket>;
  byStage: Record<string, CostBucket>;
  byChapter: Record<string, CostBucket>;
  callsLog: CostCallRecord[];
};

let _stats: CostStats | null = null;

/**
 * The v23 compiler conductor (book-run / book-autopilot) drives Codex via `codex exec`
 * subprocesses — it never calls `callModel()`/`beginRun()`, so `_stats` stays null for that
 * whole route and no dollar figure is ever recorded for it. That route must say so explicitly
 * wherever it reports cost: a literal "$0.00" would read as "this run was free" when the truth
 * is "this run isn't metered in dollars at all" (it's billed against the Codex subscription).
 */
export const NOT_METERED_MESSAGE = "cost: not metered (Codex subscription route)";

export function beginRun(runId = process.env.CHAPTERFLOW_RUN_ID ?? `run-${Date.now()}`): CostStats {
  _stats = {
    runId,
    startedAt: new Date().toISOString(),
    ...emptyBucket(),
    byModel: {},
    byTier: {},
    byStage: {},
    byChapter: {},
    callsLog: [],
  };
  return _stats;
}

export function endRun(): CostStats | null {
  if (_stats) _stats.endedAt = new Date().toISOString();
  const out = _stats;
  _stats = null;
  return out;
}

export function getCurrentStats(): CostStats | null {
  return _stats;
}

export async function callModel<T = string>(opts: CallOptions): Promise<CallResult<T>> {
  const result = await routerCallModel<T>(opts);
  if (_stats) recordCall(opts, result);
  return result;
}

export function writeCostManifest(stats: CostStats | null, path: string): void {
  if (!stats) return;
  mkdirSync(resolve(path, ".."), { recursive: true });
  writeFileAtomic(path, JSON.stringify(stats, null, 2));
}

export function defaultCostManifestPath(bookId: string, runId: string, stateRoot = resolve(process.cwd(), "state")): string {
  return resolve(stateRoot, "metrics", bookId, `${runId}.cost.json`);
}

export function formatStats(stats: CostStats): string {
  const lines: string[] = [];
  lines.push(`Cost telemetry ${stats.runId}`);
  lines.push(`Calls: ${stats.calls} provider call(s), ${stats.attempts} physical attempt(s)`);
  lines.push(`Tokens: ${stats.in.toLocaleString()} in / ${stats.out.toLocaleString()} out`);
  if (stats.cacheRead > 0 || stats.cacheWrite > 0) {
    lines.push(`Cache: ${stats.cacheRead.toLocaleString()} read / ${stats.cacheWrite.toLocaleString()} write`);
  }
  lines.push(`Estimated cost: $${stats.usd.toFixed(2)} USD`);
  const byStage = Object.entries(stats.byStage).sort((a, b) => b[1].usd - a[1].usd || b[1].in + b[1].out - (a[1].in + a[1].out));
  if (byStage.length > 0) {
    lines.push(`Top stages:`);
    for (const [stage, t] of byStage.slice(0, 10)) {
      lines.push(`  ${stage.padEnd(28)} calls=${String(t.calls).padStart(3)} tokens=${t.in.toLocaleString()}/${t.out.toLocaleString()} repairs=${t.jsonRepairs} cost=$${t.usd.toFixed(3)}`);
    }
  }
  return lines.join("\n");
}

function recordCall(opts: CallOptions, result: CallResult<unknown>): void {
  if (!_stats) return;
  const record: CostCallRecord = {
    at: new Date().toISOString(),
    stage: opts.stage ?? "unlabeled",
    tier: opts.tier,
    provider: result.provider,
    model: result.model,
    ...(opts.bookId ? { bookId: opts.bookId } : {}),
    ...(opts.chapterId ? { chapterId: opts.chapterId } : {}),
    ...(opts.runId ? { runId: opts.runId } : {}),
    ...(opts.costCenter ? { costCenter: opts.costCenter } : {}),
    attempts: result.attempts,
    durationMs: result.durationMs,
    inputTokens: result.inputTokens ?? 0,
    outputTokens: result.outputTokens ?? 0,
    cacheReadTokens: result.cacheReadTokens ?? 0,
    cacheWriteTokens: result.cacheWriteTokens ?? 0,
    estimatedCostUsd: result.estimatedCostUsd ?? 0,
    jsonRepairs: result.attemptMetadata.filter((a) => a.kind === "json-repair").length,
    retries: result.attemptMetadata.filter((a) => a.kind === "retry").length,
  };
  _stats.callsLog.push(record);
  add(_stats, record);
  add(bucket(_stats.byModel, result.model), record);
  add(bucket(_stats.byTier, opts.tier), record);
  add(bucket(_stats.byStage, record.stage), record);
  if (opts.chapterId) add(bucket(_stats.byChapter, opts.chapterId), record);
}

function bucket(map: Record<string, CostBucket>, key: string): CostBucket {
  return (map[key] ||= emptyBucket());
}

function emptyBucket(): CostBucket {
  return { calls: 0, attempts: 0, in: 0, out: 0, cacheRead: 0, cacheWrite: 0, usd: 0, durationMs: 0, jsonRepairs: 0, retries: 0 };
}

function add(bucket: CostBucket, record: CostCallRecord): void {
  bucket.calls += 1;
  bucket.attempts += record.attempts;
  bucket.in += record.inputTokens;
  bucket.out += record.outputTokens;
  bucket.cacheRead += record.cacheReadTokens;
  bucket.cacheWrite += record.cacheWriteTokens;
  bucket.usd += record.estimatedCostUsd;
  bucket.durationMs += record.durationMs;
  bucket.jsonRepairs += record.jsonRepairs;
  bucket.retries += record.retries;
}
