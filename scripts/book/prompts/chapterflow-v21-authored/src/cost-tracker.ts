/**
 * Aggregates per-call cost/token usage during a generation run. Wraps the
 * provider router. Use beginRun() at the start of a chapter or book and
 * endRun() at the end to get a summary.
 */

import { CallOptions, CallResult } from "./providers/types.js";
import { callModel as routerCallModel } from "./providers/router.js";

export type CostStats = {
  callCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheReadTokens: number;
  totalCacheWriteTokens: number;
  totalCostUsd: number;
  byModel: Record<string, { calls: number; in: number; out: number; usd: number }>;
  byTier: Record<string, { calls: number; in: number; out: number; usd: number }>;
};

let _stats: CostStats | null = null;

export function beginRun(): void {
  _stats = {
    callCount: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCacheReadTokens: 0,
    totalCacheWriteTokens: 0,
    totalCostUsd: 0,
    byModel: {},
    byTier: {},
  };
}

export function endRun(): CostStats | null {
  const out = _stats;
  _stats = null;
  return out;
}

export function getCurrentStats(): CostStats | null {
  return _stats;
}

/** Drop-in replacement for callModel that records usage when a run is active. */
export async function callModel<T = string>(opts: CallOptions): Promise<CallResult<T>> {
  const result = await routerCallModel<T>(opts);
  if (_stats) {
    _stats.callCount += 1;
    _stats.totalInputTokens += result.inputTokens ?? 0;
    _stats.totalOutputTokens += result.outputTokens ?? 0;
    _stats.totalCacheReadTokens += result.cacheReadTokens ?? 0;
    _stats.totalCacheWriteTokens += result.cacheWriteTokens ?? 0;
    _stats.totalCostUsd += result.estimatedCostUsd ?? 0;
    const m = (_stats.byModel[result.model] ||= { calls: 0, in: 0, out: 0, usd: 0 });
    m.calls += 1;
    m.in += result.inputTokens ?? 0;
    m.out += result.outputTokens ?? 0;
    m.usd += result.estimatedCostUsd ?? 0;
    const t = (_stats.byTier[opts.tier] ||= { calls: 0, in: 0, out: 0, usd: 0 });
    t.calls += 1;
    t.in += result.inputTokens ?? 0;
    t.out += result.outputTokens ?? 0;
    t.usd += result.estimatedCostUsd ?? 0;
  }
  return result;
}

export function formatStats(stats: CostStats): string {
  const lines: string[] = [];
  lines.push(`Calls: ${stats.callCount}`);
  lines.push(`Tokens: ${stats.totalInputTokens.toLocaleString()} in / ${stats.totalOutputTokens.toLocaleString()} out`);
  if (stats.totalCacheReadTokens > 0 || stats.totalCacheWriteTokens > 0) {
    lines.push(`Cache: ${stats.totalCacheReadTokens.toLocaleString()} read / ${stats.totalCacheWriteTokens.toLocaleString()} write`);
  }
  lines.push(`Estimated cost: $${stats.totalCostUsd.toFixed(2)} USD`);
  if (Object.keys(stats.byTier).length > 0) {
    lines.push(`By tier:`);
    for (const [tier, t] of Object.entries(stats.byTier)) {
      lines.push(`  ${tier.padEnd(10)} calls=${t.calls} tokens=${t.in.toLocaleString()}/${t.out.toLocaleString()} cost=$${t.usd.toFixed(3)}`);
    }
  }
  return lines.join("\n");
}
