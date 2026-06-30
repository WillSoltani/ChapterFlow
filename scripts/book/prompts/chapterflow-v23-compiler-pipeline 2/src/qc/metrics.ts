/**
 * Quality telemetry — one append-only record per QC finalization, so the pipeline's quality is
 * measured, not anecdotal. Each `qc-auto` finalization appends a row to a single JSONL (the
 * owner's three proposed files collapse to one source — runs/qc-attempts/failure-axes are all
 * derivable from it). `qc-metrics` aggregates the last N books: first-pass publishable rate,
 * average rounds to a clean pass, the top failing bar axis, the top deterministic blocker.
 *
 * This is OBSERVABILITY, never a gate — nothing here is read back into a verdict, and the append
 * is best-effort (a telemetry failure must never break QC). Local-only by design (state/metrics/
 * is gitignored, like gate-attempts.json) — it accrues on the canonical worktree.
 */

import { existsSync, mkdirSync, readFileSync, appendFileSync } from "fs";
import { resolve } from "path";

import { CANONICAL_STATE } from "../lib/chapterPaths.js";
import type { EvidenceChapterDecision } from "./orchestrator/finalize.js";

export const METRICS_DIR = resolve(CANONICAL_STATE, "metrics");
export const QC_FINALIZATIONS_PATH = resolve(METRICS_DIR, "qc-finalizations.jsonl");

export interface QcFinalizationMetric {
  schemaVersion: "qc-finalization-v1";
  bookId: string;
  roundId: string;
  timestamp: string;
  mode: "full" | "subset";
  incremental: boolean;
  tiebreak: boolean;
  chapters: number;
  publishable: number;
  revise: number;
  corruption: number;
  needsMoreQc: number;
  /** Per deterministic check, how many non-publishable chapters it blocked this round. */
  topFailedChecks: Record<string, number>;
  /** Per bar axis, how many chapters scored it below the publishable tier this round. */
  topBarAxes: Record<string, number>;
}

type DecisionLite = Pick<EvidenceChapterDecision, "finalVerdict" | "checks">;

/** A check "passes" iff its value is in this set; anything else (incl. MISSING/STALE on a
 *  non-publishable chapter) is counted as a block. NOT_APPLICABLE is never a block. */
const CHECK_PASS_VALUES: Record<string, ReadonlySet<string>> = {
  sourceV2: new Set(["PASS", "NOT_APPLICABLE"]),
  shipGate: new Set(["PASS", "NOT_APPLICABLE"]),
  authorCheck: new Set(["PASS", "NOT_APPLICABLE"]),
  intraBook: new Set(["PASS", "NOT_APPLICABLE"]),
  bookGate: new Set(["PASS", "NOT_APPLICABLE"]),
  sweep: new Set(["PASS", "NOT_APPLICABLE"]),
  manualKeyJudge: new Set(["PASS", "NOT_APPLICABLE"]),
  majors: new Set(["PASS", "NOT_APPLICABLE"]),
  planEnforcement: new Set(["PASS", "NOT_APPLICABLE"]),
  barRead: new Set(["GREEN"]),
  confirmRead: new Set(["PUBLISHABLE"]),
  repairLedger: new Set(["NO_OPEN_BLOCKERS"]),
};

function bump(map: Record<string, number>, key: string): void {
  map[key] = (map[key] ?? 0) + 1;
}

/** Pure: derive a finalization metric from the round's decisions + the failing bar axes the CLI
 *  extracted from the bar artifacts. topFailedChecks counts blocks only on non-publishable
 *  chapters (a passing chapter's incidental MISSING is not a "blocker"). */
export function buildQcFinalizationMetric(args: {
  bookId: string;
  roundId: string;
  timestamp: string;
  mode: "full" | "subset";
  incremental: boolean;
  tiebreak: boolean;
  decisions: DecisionLite[];
  failingBarAxes: string[];
}): QcFinalizationMetric {
  const { decisions } = args;
  const count = (v: string) => decisions.filter((d) => d.finalVerdict === v).length;
  const topFailedChecks: Record<string, number> = {};
  for (const d of decisions) {
    if (d.finalVerdict === "PUBLISHABLE") continue;
    for (const [key, value] of Object.entries(d.checks)) {
      const pass = CHECK_PASS_VALUES[key];
      if (pass && !pass.has(String(value))) bump(topFailedChecks, key);
    }
  }
  const topBarAxes: Record<string, number> = {};
  for (const axis of args.failingBarAxes) bump(topBarAxes, axis);
  return {
    schemaVersion: "qc-finalization-v1",
    bookId: args.bookId,
    roundId: args.roundId,
    timestamp: args.timestamp,
    mode: args.mode,
    incremental: args.incremental,
    tiebreak: args.tiebreak,
    chapters: decisions.length,
    publishable: count("PUBLISHABLE"),
    revise: count("REVISE"),
    corruption: count("CORRUPTION"),
    needsMoreQc: count("NEEDS_MORE_QC"),
    topFailedChecks,
    topBarAxes,
  };
}

export function loadQcFinalizationMetrics(path = QC_FINALIZATIONS_PATH): QcFinalizationMetric[] {
  if (!existsSync(path)) return [];
  const out: QcFinalizationMetric[] = [];
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t) continue;
    try {
      out.push(JSON.parse(t) as QcFinalizationMetric);
    } catch {
      /* skip a corrupt line — telemetry is advisory */
    }
  }
  return out;
}

/** The signature that makes a re-run idempotent: the outcome minus the timestamp. */
function outcomeSignature(m: QcFinalizationMetric): string {
  const { timestamp: _t, ...rest } = m;
  return JSON.stringify(rest);
}

/** Best-effort, idempotent append. Never throws (a telemetry failure must not break QC). Skips a
 *  byte-identical re-run of the same (bookId, roundId) so re-finalizing an unchanged round does
 *  not double-count — matching the pipeline's re-run idempotency discipline. */
export function appendQcFinalizationMetric(metric: QcFinalizationMetric, path = QC_FINALIZATIONS_PATH): void {
  try {
    const existing = loadQcFinalizationMetrics(path);
    const sig = outcomeSignature(metric);
    const priorSame = existing.filter((m) => m.bookId === metric.bookId && m.roundId === metric.roundId);
    if (priorSame.some((m) => outcomeSignature(m) === sig)) return; // unchanged re-run
    mkdirSync(resolve(path, ".."), { recursive: true });
    appendFileSync(path, JSON.stringify(metric) + "\n", "utf8");
  } catch {
    /* swallow — observability must never break the QC run */
  }
}

export interface QcMetricsSummary {
  finalizations: number;
  books: number;
  firstPass: { passed: number; total: number; rate: number | null };
  avgRoundsToPass: number | null;
  topRevisedAxis: { axis: string; count: number } | null;
  topBlocker: { check: string; count: number } | null;
}

function maxEntry(map: Record<string, number>): { key: string; count: number } | null {
  let best: { key: string; count: number } | null = null;
  for (const [key, count] of Object.entries(map)) {
    if (!best || count > best.count) best = { key, count };
  }
  return best;
}

function isAllPublishable(m: QcFinalizationMetric): boolean {
  return m.chapters > 0 && m.publishable === m.chapters && m.revise === 0 && m.corruption === 0 && m.needsMoreQc === 0;
}

/** Pure: aggregate the most recent `lastNBooks` books' finalization history. */
export function aggregateQcMetrics(records: QcFinalizationMetric[], lastNBooks = 10): QcMetricsSummary {
  // Group by book, order books by latest activity, keep the most recent N.
  const byBook = new Map<string, QcFinalizationMetric[]>();
  for (const r of records) {
    const arr = byBook.get(r.bookId) ?? [];
    arr.push(r);
    byBook.set(r.bookId, arr);
  }
  const books = [...byBook.entries()].map(([bookId, rs]) => ({
    bookId,
    rounds: rs.slice().sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
    latest: rs.reduce((m, r) => (r.timestamp > m ? r.timestamp : m), ""),
  }));
  books.sort((a, b) => b.latest.localeCompare(a.latest));
  const window = books.slice(0, lastNBooks);

  let passedFirst = 0;
  const roundsToPass: number[] = [];
  const axes: Record<string, number> = {};
  const checks: Record<string, number> = {};
  let finalizations = 0;

  for (const book of window) {
    if (book.rounds.length > 0 && isAllPublishable(book.rounds[0])) passedFirst++;
    const idx = book.rounds.findIndex(isAllPublishable);
    if (idx >= 0) roundsToPass.push(idx + 1);
    for (const r of book.rounds) {
      finalizations++;
      for (const [axis, n] of Object.entries(r.topBarAxes)) axes[axis] = (axes[axis] ?? 0) + n;
      for (const [check, n] of Object.entries(r.topFailedChecks)) checks[check] = (checks[check] ?? 0) + n;
    }
  }

  const total = window.length;
  const topAxis = maxEntry(axes);
  const topCheck = maxEntry(checks);
  return {
    finalizations,
    books: total,
    firstPass: { passed: passedFirst, total, rate: total > 0 ? passedFirst / total : null },
    avgRoundsToPass: roundsToPass.length > 0 ? roundsToPass.reduce((a, b) => a + b, 0) / roundsToPass.length : null,
    topRevisedAxis: topAxis ? { axis: topAxis.key, count: topAxis.count } : null,
    topBlocker: topCheck ? { check: topCheck.key, count: topCheck.count } : null,
  };
}

export function formatQcMetrics(summary: QcMetricsSummary, lastNBooks: number): string {
  if (summary.books === 0) {
    return "QC metrics — no finalizations recorded yet. Run a book through qc-auto; each finalization appends one row.";
  }
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const L: string[] = [];
  L.push(`QC metrics — last ${Math.min(lastNBooks, summary.books)} book(s), ${summary.finalizations} finalization(s)`);
  L.push(
    summary.firstPass.rate == null
      ? "- first-pass publishable rate: n/a"
      : `- first-pass publishable rate: ${pct(summary.firstPass.rate)} (${summary.firstPass.passed}/${summary.firstPass.total} books)`,
  );
  L.push(`- average QC rounds to a clean pass: ${summary.avgRoundsToPass == null ? "n/a (no book has passed yet)" : summary.avgRoundsToPass.toFixed(1)}`);
  L.push(`- top failing bar axis: ${summary.topRevisedAxis ? `${summary.topRevisedAxis.axis} (×${summary.topRevisedAxis.count})` : "none recorded"}`);
  L.push(`- top deterministic blocker: ${summary.topBlocker ? `${summary.topBlocker.check} (×${summary.topBlocker.count})` : "none recorded"}`);
  return L.join("\n");
}
