/**
 * WP-503 — cost-tracker.ts's `callModel`/`claudeClient` route mirrored into the
 * unified per-run call ledger, alongside its pre-existing token/cost telemetry.
 *
 * Exercises `recordCall` (the success-path hook) and `recordFailedCall` (the
 * extracted failure-path hook) DIRECTLY — no router call, no live model call
 * (forbidden by L-22): these are the exact two functions `callModel`'s try/catch
 * delegates to, so this proves the wiring without a network hop.
 */

import assert from "node:assert/strict";
import { readFileSync, rmSync } from "node:fs";

import { test } from "./harness.js";
import {
  beginRun,
  endRun,
  recordCall,
  recordFailedCall,
  UNSPECIFIED_LEDGER_BOOK_ID,
} from "../src/cost-tracker.js";
import type { CallOptions, CallResult } from "../src/providers/types.js";
import { callLedgerDir, readCallLedgerEntries } from "../src/telemetry/runCallLedger.js";

// cost-tracker.ts resolves its OWN pipeline dir from `import.meta.url` (never
// injectable) — so these tests read the ledger back from the REAL pipeline dir
// under a dedicated, cleaned-up bookId, exactly like the durability probe in
// run-call-ledger.test.ts.
import { PIPELINE_DIR } from "./helpers.js";

function mkCallOptions(over: Partial<CallOptions> = {}): CallOptions {
  return { tier: "writer", system: "sys", user: "usr", ...over };
}

function mkCallResult(over: Partial<CallResult<string>> = {}): CallResult<string> {
  return {
    provider: "anthropic-cli",
    model: "sonnet-5",
    durationMs: 1234,
    raw: "ok",
    usage: {},
    content: "ok",
    attempts: 1,
    attemptMetadata: [{ attempt: 1, durationMs: 1234, kind: "initial" }],
    rawResponses: ["ok"],
    ...over,
  };
}

test("recordCall (success path) mirrors a callModel success into the unified ledger, in addition to the existing token/cost buckets", () => {
  const bookId = "zz-cost-tracker-success";
  try {
    const stats = beginRun("run-cost-tracker-success");
    recordCall(
      mkCallOptions({ bookId, stage: "writer-example", role: "author-writer" }),
      mkCallResult({ model: "sonnet-5", durationMs: 987, inputTokens: 10, outputTokens: 20, estimatedCostUsd: 0.01 }),
    );
    // The PRE-EXISTING telemetry is unchanged.
    assert.equal(stats.calls, 1);
    assert.equal(stats.in, 10);
    assert.equal(stats.byStage["writer-example"]?.calls, 1);

    const entries = readCallLedgerEntries(PIPELINE_DIR, bookId, stats.runId);
    assert.equal(entries.length, 1, "exactly one ledger line per callModel success");
    const e = entries[0];
    assert.equal(e.family, "claude-side");
    assert.equal(e.stage, "writer-example");
    assert.equal(e.role, "author-writer");
    assert.equal(e.model, "sonnet-5");
    assert.equal(e.effort, null, "CallOptions has no reasoning-effort concept — recorded null, never guessed");
    assert.equal(e.latencyMs, 987);
    assert.equal(e.outcome, "content_completed");
    assert.equal(e.cost, "NOT_METERED");
  } finally {
    endRun();
    rmSync(callLedgerDir(PIPELINE_DIR, bookId), { recursive: true, force: true });
  }
});

test("recordCall with no bookId still ledgers the call (never dropped) under the explicit UNSPECIFIED_LEDGER_BOOK_ID bucket", () => {
  try {
    const stats = beginRun("run-cost-tracker-nobook");
    recordCall(mkCallOptions({ stage: "categorizer" }), mkCallResult());
    const entries = readCallLedgerEntries(PIPELINE_DIR, UNSPECIFIED_LEDGER_BOOK_ID, stats.runId);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].bookId, UNSPECIFIED_LEDGER_BOOK_ID);
  } finally {
    endRun();
    rmSync(callLedgerDir(PIPELINE_DIR, UNSPECIFIED_LEDGER_BOOK_ID), { recursive: true, force: true });
  }
});

test("recordCall is a no-op (no ledger entry) when no run is active — matches the pre-existing _stats gate", () => {
  const bookId = "zz-cost-tracker-inactive";
  // No beginRun() — _stats is null.
  recordCall(mkCallOptions({ bookId }), mkCallResult());
  assert.throws(
    () => { const p = readFileSync(callLedgerDir(PIPELINE_DIR, bookId), "utf8"); void p; },
    /ENOENT|EISDIR/,
    "no ledger directory was ever created when no run is active",
  );
});

test("recordFailedCall (the callModel catch-path hook) ledgers a rejected call — never silently drops it", () => {
  const bookId = "zz-cost-tracker-failure";
  try {
    const stats = beginRun("run-cost-tracker-failure");
    recordFailedCall(mkCallOptions({ bookId, stage: "writer-hook", model: "sonnet-5" }), new Error("provider timed out after 240000ms"));
    const entries = readCallLedgerEntries(PIPELINE_DIR, bookId, stats.runId);
    assert.equal(entries.length, 1, "a rejected callModel is ledgered exactly once, never silently dropped");
    const e = entries[0];
    assert.equal(e.family, "claude-side");
    assert.equal(e.stage, "writer-hook");
    assert.equal(e.model, "sonnet-5");
    assert.equal(e.latencyMs, null, "the router throws before returning a duration — genuinely unobservable, never a placeholder 0");
    assert.equal(e.outcome, "timeout", "reuses the SAME classifyProviderOutcome the codex path uses");
  } finally {
    endRun();
    rmSync(callLedgerDir(PIPELINE_DIR, bookId), { recursive: true, force: true });
  }
});

test("recordFailedCall classifies a non-timeout error as infrastructure_failure via the shared classifier", () => {
  const bookId = "zz-cost-tracker-failure-infra";
  try {
    const stats = beginRun("run-cost-tracker-failure-infra");
    recordFailedCall(mkCallOptions({ bookId, stage: "writer-hook" }), new Error("ECONNRESET"));
    const entries = readCallLedgerEntries(PIPELINE_DIR, bookId, stats.runId);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].outcome, "infrastructure_failure");
  } finally {
    endRun();
    rmSync(callLedgerDir(PIPELINE_DIR, bookId), { recursive: true, force: true });
  }
});

test("recordFailedCall is a no-op when no run is active", () => {
  const bookId = "zz-cost-tracker-failure-inactive";
  recordFailedCall(mkCallOptions({ bookId }), new Error("boom"));
  assert.throws(
    () => { const p = readFileSync(callLedgerDir(PIPELINE_DIR, bookId), "utf8"); void p; },
    /ENOENT|EISDIR/,
  );
});
