/**
 * WP-603 — machine-readable run-summary + persisted preflight-report artifacts for
 * `generate-book`.
 *
 * generateBookCommand.ts (WP-601) already prints the package / D7-receipt / run-ledger
 * paths at its terminal. This module adds two DURABLE, co-located sibling artifacts so
 * an operator (or a script) can inspect a run's outcome without re-parsing stdout:
 *
 *   - a preflight-report JSON: the exact WP-602 doctor findings this run saw, so a
 *     `PREFLIGHT_FATAL`/warn decision is auditable after the fact;
 *   - a run-summary JSON: the final status/exit code/reason/failed-step, the resolved
 *     model+config, and every artifact location this run produced, in one file.
 *
 * Both are pure-data builders + ONE atomic-write choke point (`writeFileAtomic`,
 * the SAME primitive every other durable writer in this pipeline uses) — no new
 * telemetry is invented here. The run-summary's `ledgerRollup` field is a BEST-EFFORT
 * READ-BACK of the WP-503 per-run rollup (`<runId>.summary.json`) that the conductor
 * itself already wrote by the time this module runs — never independently recomputed,
 * and honestly `available: false` (never a fabricated zero-count rollup) when that
 * file doesn't exist (e.g. a halted run that never reached the conductor, or a
 * model-free test double that never wrote one).
 */

import { existsSync, readFileSync } from "fs";

import { writeFileAtomic } from "../lib/atomicWrite.js";
import type { DoctorFinding } from "../lifecycle/doctor.js";
import type { RunCallLedgerRollupV1 } from "../telemetry/runCallLedger.js";

export const GENERATE_BOOK_PREFLIGHT_REPORT_SCHEMA = "generate-book-preflight-report-v1" as const;
export const GENERATE_BOOK_RUN_SUMMARY_SCHEMA = "generate-book-run-summary-v1" as const;

/** Derive a sibling artifact path from the WP-503 ledger's `.jsonl` path (same
 *  directory, same `<runId>` stem) — keeps every per-run artifact this command
 *  writes co-located under `state/run-ledger/<bookId>/` without adding a new
 *  injected deps field (the ledger path is already injectable/test-rooted). */
export function siblingArtifactPath(ledgerJsonlPath: string, suffix: string): string {
  return ledgerJsonlPath.replace(/\.jsonl$/, suffix);
}

// ── preflight report ────────────────────────────────────────────────────────────

export type GenerateBookPreflightReportV1 = {
  schema: typeof GENERATE_BOOK_PREFLIGHT_REPORT_SCHEMA;
  bookId: string;
  runId: string;
  at: string;
  fatalCount: number;
  warnCount: number;
  okCount: number;
  findings: DoctorFinding[];
};

export function buildPreflightReport(args: {
  bookId: string;
  runId: string;
  at: string;
  findings: DoctorFinding[];
}): GenerateBookPreflightReportV1 {
  return {
    schema: GENERATE_BOOK_PREFLIGHT_REPORT_SCHEMA,
    bookId: args.bookId,
    runId: args.runId,
    at: args.at,
    fatalCount: args.findings.filter((f) => f.level === "fatal").length,
    warnCount: args.findings.filter((f) => f.level === "warn").length,
    okCount: args.findings.filter((f) => f.level === "ok").length,
    findings: args.findings,
  };
}

export function writePreflightReport(path: string, report: GenerateBookPreflightReportV1): void {
  writeFileAtomic(path, `${JSON.stringify(report, null, 2)}\n`);
}

// ── run summary ──────────────────────────────────────────────────────────────────

/** Best-effort read-back of a WP-503 per-run rollup. Never throws: a run that never
 *  reached the conductor (or a test double that never wrote one) leaves no file —
 *  reported by the caller as "not available", never a fabricated zero-count rollup. */
export function readLedgerRollupIfPresent(path: string): RunCallLedgerRollupV1 | null {
  try {
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, "utf8")) as RunCallLedgerRollupV1;
  } catch {
    return null;
  }
}

export type GenerateBookRunSummaryArtifacts = {
  package: string;
  packageProduced: boolean;
  d7Receipt: string;
  /** `null` when this run did not end in a D7 quality-bar block (nothing to point at). */
  d7Halt: string | null;
  preflightReport: string;
  runLedger: string;
  runLedgerSummary: string;
  bookRollup: string;
};

export type GenerateBookRunSummaryV1 = {
  schema: typeof GENERATE_BOOK_RUN_SUMMARY_SCHEMA;
  bookId: string;
  runId: string;
  startedAt: string;
  finishedAt: string;
  /** The classification label (OK / HALT / BLOCKED_QUALITY_BAR / LOCK_REFUSED / …). */
  status: string;
  exitCode: number;
  reason: string;
  /** Which lifecycle step this run terminated at — `null` only on a clean OK exit
   *  (never guessed on a halt: this field is populated ONLY at the one call site
   *  that reached the conductor, so it is never fabricated for a step that didn't run). */
  failedStep: string | null;
  model: string;
  effort: string;
  requireD7ShipGate: boolean;
  autoPublish: boolean;
  artifacts: GenerateBookRunSummaryArtifacts;
  ledgerRollup: {
    available: boolean;
    totalCalls: number | null;
    byOutcome: Record<string, number> | null;
    latencyP50Ms: number | null;
    latencyP95Ms: number | null;
  };
};

export function buildRunSummary(args: {
  bookId: string;
  runId: string;
  startedAt: string;
  finishedAt: string;
  status: string;
  exitCode: number;
  reason: string;
  failedStep: string | null;
  model: string;
  effort: string;
  requireD7ShipGate: boolean;
  autoPublish: boolean;
  artifacts: GenerateBookRunSummaryArtifacts;
  ledgerRollup: RunCallLedgerRollupV1 | null;
}): GenerateBookRunSummaryV1 {
  const r = args.ledgerRollup;
  return {
    schema: GENERATE_BOOK_RUN_SUMMARY_SCHEMA,
    bookId: args.bookId,
    runId: args.runId,
    startedAt: args.startedAt,
    finishedAt: args.finishedAt,
    status: args.status,
    exitCode: args.exitCode,
    reason: args.reason,
    failedStep: args.failedStep,
    model: args.model,
    effort: args.effort,
    requireD7ShipGate: args.requireD7ShipGate,
    autoPublish: args.autoPublish,
    artifacts: args.artifacts,
    ledgerRollup: {
      available: r !== null,
      totalCalls: r?.totalCalls ?? null,
      byOutcome: r?.byOutcome ?? null,
      latencyP50Ms: r?.latency?.p50Ms ?? null,
      latencyP95Ms: r?.latency?.p95Ms ?? null,
    },
  };
}

export function writeRunSummary(path: string, summary: GenerateBookRunSummaryV1): void {
  writeFileAtomic(path, `${JSON.stringify(summary, null, 2)}\n`);
}
