/**
 * IMP-11 — clustered statistics for the migration experiments (prompt inst.
 * 13-17, 19; §16 "Statistical requirements"). PURE and SEEDED — every number a
 * report prints reproduces byte-identically from the records + the seed.
 *
 * The independence unit is the (book, chapter) BLOCK: quiz items and scenario
 * units inside one chapter are never counted as independent chapter samples,
 * and uncertainty comes from a cluster-aware bootstrap that resamples BLOCKS,
 * not samples. Rare-defect claims use the rule of three on the independent
 * unit count; a target the effective sample cannot reach is INCONCLUSIVE —
 * the target never relaxes.
 */

import { BASELINE_MODEL } from "../../orchestrator/modelPolicy.js";
import type { MigrationSampleRecordV1, PrecisionEndpointV1 } from "./experimentTypes.js";
import { mulberry32, seededU32 } from "./prng.js";

export type BlockKey = string;

export function blockKeyOf(r: Pick<MigrationSampleRecordV1, "bookId" | "chapterNumber">): BlockKey {
  return `${r.bookId}::ch${String(r.chapterNumber).padStart(2, "0")}`;
}

/** Group per-sample numeric values by block for one cell + metric. `null`
 *  values (metric unavailable for that sample) are dropped, visibly counted. */
export function valuesByBlock(
  records: MigrationSampleRecordV1[],
  cellId: string,
  metric: (r: MigrationSampleRecordV1) => number | null,
): { blocks: Map<BlockKey, number[]>; dropped: number } {
  const blocks = new Map<BlockKey, number[]>();
  let dropped = 0;
  for (const r of records) {
    if (r.cellId !== cellId) continue;
    const v = metric(r);
    if (v === null || !Number.isFinite(v)) {
      dropped++;
      continue;
    }
    const key = blockKeyOf(r);
    const arr = blocks.get(key) ?? [];
    arr.push(v);
    blocks.set(key, arr);
  }
  return { blocks, dropped };
}

export function pooledMean(blocks: Map<BlockKey, number[]>): number | null {
  let n = 0;
  let sum = 0;
  for (const vs of blocks.values()) for (const v of vs) { n++; sum += v; }
  return n === 0 ? null : sum / n;
}

/** Cluster-aware bootstrap CI: resample BLOCKS with replacement, recompute the
 *  pooled statistic. Percentile interval. Deterministic under the seed. */
export function clusterBootstrapCI(args: {
  blocks: Map<BlockKey, number[]>;
  iterations?: number;
  seed: string;
  alpha?: number;
  statistic?: (blockValues: number[][]) => number | null;
}): { lower: number; upper: number; point: number; clusters: n_stats } | null {
  const keys = [...args.blocks.keys()].sort();
  if (keys.length === 0) return null;
  const stat = args.statistic ?? ((bvs: number[][]) => {
    let n = 0;
    let sum = 0;
    for (const vs of bvs) for (const v of vs) { n++; sum += v; }
    return n === 0 ? null : sum / n;
  });
  const point = stat(keys.map((k) => args.blocks.get(k)!));
  if (point === null) return null;
  const iterations = args.iterations ?? 2000;
  const alpha = args.alpha ?? 0.05;
  const rand = mulberry32(seededU32(`${args.seed}::bootstrap`));
  const draws: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const sample: number[][] = [];
    for (let j = 0; j < keys.length; j++) {
      sample.push(args.blocks.get(keys[Math.floor(rand() * keys.length)])!);
    }
    const s = stat(sample);
    if (s !== null && Number.isFinite(s)) draws.push(s);
  }
  if (draws.length === 0) return null;
  draws.sort((a, b) => a - b);
  const lo = draws[Math.max(0, Math.floor((alpha / 2) * draws.length))];
  const hi = draws[Math.min(draws.length - 1, Math.ceil((1 - alpha / 2) * draws.length) - 1)];
  return { lower: lo, upper: hi, point, clusters: { blocks: keys.length, samples: [...args.blocks.values()].reduce((s, v) => s + v.length, 0) } };
}

type n_stats = { blocks: number; samples: number };

/** Paired per-block deltas between two cells on one metric — the paired/block
 *  comparison §16 requires. Blocks missing either side are reported, not
 *  silently dropped into the estimate. */
export function pairedBlockDeltas(
  records: MigrationSampleRecordV1[],
  cellA: string,
  cellB: string,
  metric: (r: MigrationSampleRecordV1) => number | null,
): { deltas: Map<BlockKey, number>; missingBlocks: BlockKey[] } {
  const a = valuesByBlock(records, cellA, metric).blocks;
  const b = valuesByBlock(records, cellB, metric).blocks;
  const deltas = new Map<BlockKey, number>();
  const missing: BlockKey[] = [];
  const allKeys = new Set([...a.keys(), ...b.keys()]);
  for (const key of [...allKeys].sort()) {
    const av = a.get(key);
    const bv = b.get(key);
    if (!av?.length || !bv?.length) {
      missing.push(key);
      continue;
    }
    const am = av.reduce((s, x) => s + x, 0) / av.length;
    const bm = bv.reduce((s, x) => s + x, 0) / bv.length;
    deltas.set(key, am - bm);
  }
  return { deltas, missingBlocks: missing };
}

/** Bootstrap CI over paired deltas (blocks are the resampling unit). */
export function pairedDeltaCI(deltas: Map<BlockKey, number>, seed: string, iterations = 2000, alpha = 0.05): { point: number; lower: number; upper: number; blocks: number } | null {
  const blocks = new Map<BlockKey, number[]>();
  for (const [k, d] of deltas) blocks.set(k, [d]);
  const ci = clusterBootstrapCI({ blocks, seed, iterations, alpha });
  return ci ? { point: ci.point, lower: ci.lower, upper: ci.upper, blocks: ci.clusters.blocks } : null;
}

// ── Rare-event precision (prompt inst. 15-16) ─────────────────────────────────

/** One-sided ~95% upper bound (percent) for a rate with ZERO observed events
 *  in n independent units: the rule of three, 3/n (= 300/n percent). */
export function ruleOfThreeUpperBoundPct(independentUnits: number): number | null {
  if (!Number.isInteger(independentUnits) || independentUnits <= 0) return null;
  return 300 / independentUnits;
}

/** The mandated precision statement (inst. 15, verbatim numbers). */
export const PRECISION_STATEMENT =
  "Zero events in 36 independent units gives an approximate one-sided 95% upper bound near 8.3%; " +
  "roughly 150 zero-event units are needed for about 2%, and 300 for about 1%, before clustering adjustments.";

export type PrecisionAssessmentV1 = {
  endpointId: string;
  targetUpperBoundPct: number;
  independentUnits: number;
  observedEvents: number;
  achievedUpperBoundPct: number | null;
  supported: boolean;
  classification: "supported" | "inconclusive" | "not-rare-event";
};

/** Can the effective sample support the endpoint's claimed precision?
 *  Zero-event: rule of three vs the target. Non-zero events: the endpoint is
 *  not a rare-event bound anymore — interval estimation applies and the
 *  zero-event claim is simply not available (never overstated). */
export function assessPrecision(endpoint: PrecisionEndpointV1, observedEvents: number, independentUnits: number): PrecisionAssessmentV1 {
  if (observedEvents > 0) {
    return {
      endpointId: endpoint.id,
      targetUpperBoundPct: endpoint.targetUpperBoundPct,
      independentUnits,
      observedEvents,
      achievedUpperBoundPct: null,
      supported: false,
      classification: "not-rare-event",
    };
  }
  const achieved = ruleOfThreeUpperBoundPct(independentUnits);
  const supported = achieved !== null && achieved <= endpoint.targetUpperBoundPct && independentUnits >= endpoint.minIndependentUnits;
  return {
    endpointId: endpoint.id,
    targetUpperBoundPct: endpoint.targetUpperBoundPct,
    independentUnits,
    observedEvents: 0,
    achievedUpperBoundPct: achieved,
    supported,
    classification: supported ? "supported" : "inconclusive",
  };
}

// ── Sequential stopping / expansion (prompt inst. 14, 17) ─────────────────────

export type StoppingInterim = {
  /** Per SOL cell at the screening sample: high-severity events + acceptance. */
  solCells: Array<{ cellId: string; upheldHighSeverity: number; acceptancePct: number | null; screened: number }>;
  minPooledAcceptancePct: number;
};

export type StoppingDecision = { decision: "expand" | "stop"; reasons: string[] };

/** The FROZEN rule vocabulary. An unknown rule id throws — rules cannot be
 *  invented after sealing (threshold/stopping immutability). */
export function evaluateStopping(rules: string[], interim: StoppingInterim): StoppingDecision {
  const reasons: string[] = [];
  let expand = false;
  let stop = false;
  for (const rule of rules) {
    switch (rule) {
      case "always-expand":
        expand = true;
        reasons.push("always-expand: expansion unconditionally prespecified");
        break;
      case "never-expand":
        stop = true;
        reasons.push("never-expand: screening sample is the full design");
        break;
      case "expand-if-any-sol-cell-screens-clean": {
        const clean = interim.solCells.filter((c) => c.upheldHighSeverity === 0 && (c.acceptancePct ?? 0) >= interim.minPooledAcceptancePct);
        if (clean.length > 0) {
          expand = true;
          reasons.push(`expand-if-any-sol-cell-screens-clean: ${clean.map((c) => c.cellId).join(", ")} screened clean`);
        } else {
          reasons.push("expand-if-any-sol-cell-screens-clean: no SOL cell screened clean");
        }
        break;
      }
      case "stop-if-every-sol-cell-fails-screening": {
        const allFail = interim.solCells.length > 0 && interim.solCells.every((c) => c.upheldHighSeverity > 0 || (c.acceptancePct ?? 0) < interim.minPooledAcceptancePct);
        if (allFail) {
          stop = true;
          reasons.push("stop-if-every-sol-cell-fails-screening: every SOL cell failed the screen (futility)");
        } else {
          reasons.push("stop-if-every-sol-cell-fails-screening: not triggered");
        }
        break;
      }
      default:
        throw new Error(`unknown stopping rule "${rule}" — rules are frozen at seal; new rules require a new experiment`);
    }
  }
  // Futility stop wins over expansion (spending more samples on an already-
  // failed screen is exactly the waste the rule exists to prevent).
  if (stop) return { decision: "stop", reasons };
  return { decision: expand ? "expand" : "stop", reasons };
}

// ── Effects (prompt inst. 19) ─────────────────────────────────────────────────

export type EffectEstimateV1 = {
  effect: string;
  metric: string;
  cells: string;
  point: number | null;
  ciLower: number | null;
  ciUpper: number | null;
  blocks: number;
  missingBlocks: number;
  note?: string;
};

function effectOf(
  records: MigrationSampleRecordV1[],
  effect: string,
  metricName: string,
  cellA: string,
  cellB: string,
  metric: (r: MigrationSampleRecordV1) => number | null,
  seed: string,
): EffectEstimateV1 {
  const { deltas, missingBlocks } = pairedBlockDeltas(records, cellA, cellB, metric);
  const ci = pairedDeltaCI(deltas, `${seed}::${effect}::${metricName}::${cellA}-${cellB}`);
  return {
    effect,
    metric: metricName,
    cells: `${cellA} − ${cellB}`,
    point: ci?.point ?? null,
    ciLower: ci?.lower ?? null,
    ciUpper: ci?.upper ?? null,
    blocks: ci?.blocks ?? 0,
    missingBlocks: missingBlocks.length,
    ...(ci ? {} : { note: "no paired blocks — effect not estimable from this design" }),
  };
}

export const METRIC_ACCEPTANCE = (r: MigrationSampleRecordV1): number | null =>
  r.outcome.firstWriteDeterministicPass ? (r.review ? (r.review.pass ? 1 : 0) : null) : 0;

export const METRIC_FIRST_WRITE_PASS = (r: MigrationSampleRecordV1): number | null =>
  r.outcome.providerOutcome === "content_completed" || r.outcome.firstWriteDeterministicPass
    ? (r.outcome.firstWriteDeterministicPass ? 1 : 0)
    : null; // pure infrastructure outcomes are not quality observations

export const METRIC_COMPOSITE = (r: MigrationSampleRecordV1): number | null => r.review?.valid ? r.review.composite : null;

/** Model / effort / stack / interaction estimates over whichever pairs the
 *  design contains — pairs absent from the cell set are reported not-estimable
 *  rather than invented. */
export function effectsReport(
  records: MigrationSampleRecordV1[],
  cells: Array<{ cellId: string; model: string; effort: string; stackId: string }>,
  seed: string,
): EffectEstimateV1[] {
  const out: EffectEstimateV1[] = [];
  const find = (model: string, effort: string, stackId?: string): string | null =>
    cells.find((c) => c.model === model && c.effort === effort && (stackId === undefined || c.stackId === stackId))?.cellId ?? null;
  const metrics: Array<[string, (r: MigrationSampleRecordV1) => number | null]> = [
    ["first-write-pass", METRIC_FIRST_WRITE_PASS],
    ["acceptance", METRIC_ACCEPTANCE],
    ["composite", METRIC_COMPOSITE],
  ];
  const stacks = [...new Set(cells.map((c) => c.stackId))].sort();

  for (const [metricName, metric] of metrics) {
    for (const stackId of stacks) {
      const solXH = find("gpt-5.6-sol", "xhigh", stackId);
      const baseXH = find(BASELINE_MODEL, "xhigh", stackId);
      if (solXH && baseXH) out.push(effectOf(records, "model", metricName, solXH, baseXH, metric, seed));
      const solH = find("gpt-5.6-sol", "high", stackId);
      if (solH && solXH) out.push(effectOf(records, "effort(sol)", metricName, solXH, solH, metric, seed));
      const baseH = find(BASELINE_MODEL, "high", stackId);
      if (baseH && baseXH) out.push(effectOf(records, "effort(5.5)", metricName, baseXH, baseH, metric, seed));
    }
    if (stacks.length >= 2) {
      const [s1, s2] = stacks;
      for (const [model, effort] of [[BASELINE_MODEL, "xhigh"], ["gpt-5.6-sol", "high"], ["gpt-5.6-sol", "xhigh"]] as const) {
        const a = find(model, effort, s2);
        const b = find(model, effort, s1);
        if (a && b) out.push(effectOf(records, `stack(${model}@${effort})`, metricName, a, b, metric, seed));
      }
      // Model-by-stack interaction: difference-in-differences on paired deltas.
      const sol2 = find("gpt-5.6-sol", "xhigh", s2);
      const sol1 = find("gpt-5.6-sol", "xhigh", s1);
      const b2 = find(BASELINE_MODEL, "xhigh", s2);
      const b1 = find(BASELINE_MODEL, "xhigh", s1);
      if (sol2 && sol1 && b2 && b1) {
        const dSol = pairedBlockDeltas(records, sol2, sol1, metric).deltas;
        const dBase = pairedBlockDeltas(records, b2, b1, metric).deltas;
        const common = [...dSol.keys()].filter((k) => dBase.has(k)).sort();
        const did = new Map<BlockKey, number>();
        for (const k of common) did.set(k, dSol.get(k)! - dBase.get(k)!);
        const ci = pairedDeltaCI(did, `${seed}::interaction::${metricName}`);
        out.push({
          effect: "model×stack",
          metric: metricName,
          cells: `(${sol2}−${sol1}) − (${b2}−${b1})`,
          point: ci?.point ?? null,
          ciLower: ci?.lower ?? null,
          ciUpper: ci?.upper ?? null,
          blocks: ci?.blocks ?? 0,
          missingBlocks: 0,
          ...(ci ? {} : { note: "no common paired blocks" }),
        });
      }
    }
  }
  return out;
}

/** Effective sample summary — raw samples, blocks, books, per-cell missing. */
export function effectiveSample(records: MigrationSampleRecordV1[], expectedCells: string[], plannedPerCell: number): {
  samples: number;
  blocks: number;
  books: number;
  missingCells: Array<{ cellId: string; planned: number; got: number }>;
} {
  const blocks = new Set(records.map(blockKeyOf));
  const books = new Set(records.map((r) => r.bookId));
  const missing = expectedCells.map((cellId) => {
    const got = records.filter((r) => r.cellId === cellId).length;
    return { cellId, planned: plannedPerCell, got };
  }).filter((m) => m.got < m.planned);
  return { samples: records.length, blocks: blocks.size, books: books.size, missingCells: missing };
}
