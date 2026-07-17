/**
 * WP-603 — the `generate-book` preflight-report + run-summary artifact builders
 * (generateBookArtifacts.ts). Covers the module directly: pure builders, the
 * atomic-write/read round trip, and the best-effort ledger-rollup read-back.
 */

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join, resolve } from "path";

import { test } from "./harness.js";
import {
  GENERATE_BOOK_PREFLIGHT_REPORT_SCHEMA,
  GENERATE_BOOK_RUN_SUMMARY_SCHEMA,
  siblingArtifactPath,
  buildPreflightReport,
  writePreflightReport,
  buildRunSummary,
  writeRunSummary,
  readLedgerRollupIfPresent,
} from "../src/orchestrator/generateBookArtifacts.js";
import type { DoctorFinding } from "../src/lifecycle/doctor.js";
import { buildCallLedgerRollup } from "../src/telemetry/runCallLedger.js";

const TMP = mkdtempSync(join(tmpdir(), "gen-book-artifacts-"));

// ── siblingArtifactPath ──────────────────────────────────────────────────────────

test("siblingArtifactPath: swaps the .jsonl suffix, keeps the directory + runId stem", () => {
  const jsonl = "/x/state/run-ledger/zz-book/generate-book-zz-book-123.jsonl";
  assert.equal(
    siblingArtifactPath(jsonl, ".preflight-report.json"),
    "/x/state/run-ledger/zz-book/generate-book-zz-book-123.preflight-report.json",
  );
  assert.equal(
    siblingArtifactPath(jsonl, ".run-summary.json"),
    "/x/state/run-ledger/zz-book/generate-book-zz-book-123.run-summary.json",
  );
});

// ── preflight report ──────────────────────────────────────────────────────────────

test("buildPreflightReport: counts fatal/warn/ok exactly and retains every finding verbatim", () => {
  const findings: DoctorFinding[] = [
    { level: "fatal", check: "base-sha-match", message: "mismatch" },
    { level: "warn", check: "worktree-clean", message: "dirty" },
    { level: "warn", check: "pending-deploy", message: "stale" },
    { level: "ok", check: "name-bank-config", message: "fine" },
  ];
  const report = buildPreflightReport({ bookId: "zz-book", runId: "r1", at: "2026-07-16T00:00:00.000Z", findings });
  assert.equal(report.schema, GENERATE_BOOK_PREFLIGHT_REPORT_SCHEMA);
  assert.equal(report.fatalCount, 1);
  assert.equal(report.warnCount, 2);
  assert.equal(report.okCount, 1);
  assert.deepEqual(report.findings, findings);
});

test("writePreflightReport + read round-trip preserves the exact report", () => {
  const path = resolve(TMP, "zz-preflight-report.json");
  const report = buildPreflightReport({
    bookId: "zz-book", runId: "r1", at: "2026-07-16T00:00:00.000Z",
    findings: [{ level: "ok", check: "x", message: "y" }],
  });
  writePreflightReport(path, report);
  const readBack = JSON.parse(readFileSync(path, "utf8"));
  assert.deepEqual(readBack, report);
});

// ── ledger rollup read-back ────────────────────────────────────────────────────────

test("readLedgerRollupIfPresent: absent file → null (never throws)", () => {
  assert.equal(readLedgerRollupIfPresent(resolve(TMP, "does-not-exist.summary.json")), null);
});

test("readLedgerRollupIfPresent: corrupt JSON → null (never throws)", () => {
  const path = resolve(TMP, "corrupt.summary.json");
  writeFileSync(path, "{not json", "utf8");
  assert.equal(readLedgerRollupIfPresent(path), null);
});

test("readLedgerRollupIfPresent: a real rollup file round-trips", () => {
  const rollup = buildCallLedgerRollup("zz-book", "r1", [
    { schema: "run-call-ledger-entry-v1", at: "t", runId: "r1", bookId: "zz-book", family: "codex-exec", stage: "writer", role: "writer", model: "gpt-5.6-sol", effort: "xhigh", latencyMs: 120, outcome: "content_completed", sessionId: "s1", cost: "NOT_METERED" },
  ]);
  const path = resolve(TMP, "rollup.summary.json");
  writeFileSync(path, JSON.stringify(rollup, null, 2) + "\n", "utf8");
  const readBack = readLedgerRollupIfPresent(path);
  assert.deepEqual(readBack, rollup);
});

// ── run summary ──────────────────────────────────────────────────────────────────

const BASE_SUMMARY_ARGS = {
  bookId: "zz-book",
  runId: "generate-book-zz-book-1",
  startedAt: "2026-07-16T00:00:00.000Z",
  finishedAt: "2026-07-16T00:05:00.000Z",
  model: "gpt-5.6-sol",
  effort: "xhigh",
  requireD7ShipGate: true,
  autoPublish: true,
  artifacts: {
    package: "/pkg/zz-book.v21.json",
    packageProduced: true,
    d7Receipt: "/state/books/zz-book.d7-ship-gate.json",
    d7Halt: null,
    preflightReport: "/ledger/zz-book/r1.preflight-report.json",
    runLedger: "/ledger/zz-book/r1.jsonl",
    runLedgerSummary: "/ledger/zz-book/r1.summary.json",
    bookRollup: "/ledger/zz-book/book-rollup.json",
  },
};

test("buildRunSummary: no ledger rollup available → available=false and every count null (never a fabricated zero)", () => {
  const summary = buildRunSummary({
    ...BASE_SUMMARY_ARGS,
    status: "PUBLISHED", exitCode: 0, reason: "ok", failedStep: null,
    ledgerRollup: null,
  });
  assert.equal(summary.schema, GENERATE_BOOK_RUN_SUMMARY_SCHEMA);
  assert.equal(summary.ledgerRollup.available, false);
  assert.equal(summary.ledgerRollup.totalCalls, null);
  assert.equal(summary.ledgerRollup.byOutcome, null);
  assert.equal(summary.ledgerRollup.latencyP50Ms, null);
  assert.equal(summary.ledgerRollup.latencyP95Ms, null);
  assert.equal(summary.failedStep, null);
});

test("buildRunSummary: a real rollup re-surfaces its counts verbatim (never recomputed)", () => {
  const rollup = buildCallLedgerRollup("zz-book", "r1", [
    { schema: "run-call-ledger-entry-v1", at: "t", runId: "r1", bookId: "zz-book", family: "codex-exec", stage: "writer", role: "writer", model: "gpt-5.6-sol", effort: "xhigh", latencyMs: 100, outcome: "content_completed", sessionId: "s1", cost: "NOT_METERED" },
    { schema: "run-call-ledger-entry-v1", at: "t", runId: "r1", bookId: "zz-book", family: "codex-exec", stage: "reviewer", role: "reviewer", model: "gpt-5.6-sol", effort: "high", latencyMs: 300, outcome: "content_completed", sessionId: "s2", cost: "NOT_METERED" },
  ]);
  const summary = buildRunSummary({
    ...BASE_SUMMARY_ARGS,
    status: "HALT", exitCode: 1, reason: "chapters need work", failedStep: "author-pipeline",
    ledgerRollup: rollup,
  });
  assert.equal(summary.ledgerRollup.available, true);
  assert.equal(summary.ledgerRollup.totalCalls, 2);
  assert.deepEqual(summary.ledgerRollup.byOutcome, rollup.byOutcome);
  assert.equal(summary.ledgerRollup.latencyP50Ms, rollup.latency.p50Ms);
  assert.equal(summary.ledgerRollup.latencyP95Ms, rollup.latency.p95Ms);
  assert.equal(summary.failedStep, "author-pipeline");
});

test("writeRunSummary + read round-trip preserves the exact summary, including the artifact map", () => {
  const path = resolve(TMP, "zz-run-summary.json");
  const summary = buildRunSummary({
    ...BASE_SUMMARY_ARGS,
    status: "BLOCKED_QUALITY_BAR", exitCode: 3, reason: "D7 ship gate BLOCK", failedStep: "author-pipeline",
    ledgerRollup: null,
  });
  writeRunSummary(path, summary);
  const readBack = JSON.parse(readFileSync(path, "utf8"));
  assert.deepEqual(readBack, summary);
  assert.equal(readBack.artifacts.package, BASE_SUMMARY_ARGS.artifacts.package);
  assert.equal(readBack.exitCode, 3);
});

// ── cleanup ────────────────────────────────────────────────────────────────────

test("zz cleanup: remove the generate-book-artifacts tmp root", () => {
  rmSync(TMP, { recursive: true, force: true });
});
