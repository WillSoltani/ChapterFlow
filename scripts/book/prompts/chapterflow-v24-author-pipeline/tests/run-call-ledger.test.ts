/**
 * WP-503 — unified per-run call ledger (codex-exec + Claude-side), durable,
 * size-capped, per-book rollup.
 *
 * Covers the module directly (src/telemetry/runCallLedger.ts):
 *  - append → read round-trip carries all six required fields + the NOT_METERED
 *    cost marker, never a fabricated dollar figure.
 *  - size-capped retention: both a line-count cap and a byte-budget cap evict
 *    the OLDEST entries first and never drop the newest.
 *  - rollup arithmetic: counts by family/stage/role/model/outcome, and latency
 *    p50/p95 computed only over entries with a REAL observed latency (a `null`
 *    latency is counted as "unknown", never folded in as a fabricated zero).
 *  - percentile() edge cases (empty / single-element arrays).
 *  - durability: the ledger + rollup paths are NOT matched by `git check-ignore`
 *    (the whole point of state/run-ledger/ vs the gitignored logs/exec/).
 *  - concurrency: two distinct runIds for the same book never cross-contaminate.
 *  - the per-book rollup-of-rollups aggregates across every run's jsonl.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";

import { test } from "./harness.js";
import { mkTestRoots } from "./testRoots.js";
import { PIPELINE_DIR } from "./helpers.js";
import {
  appendCallLedgerEntry,
  buildBookRollup,
  buildCallLedgerRollup,
  callLedgerPaths,
  DEFAULT_MAX_LEDGER_BYTES,
  DEFAULT_MAX_LEDGER_LINES,
  LEDGER_COST_MARKER,
  percentile,
  readCallLedgerEntries,
  writeBookRollup,
  writeCallLedgerRollup,
  type RunCallLedgerEntryV1,
} from "../src/telemetry/runCallLedger.js";

function baseEntry(over: Partial<Parameters<typeof appendCallLedgerEntry>[0]> = {}) {
  return {
    pipelineDir: "",
    bookId: "zz-ledger-mod",
    runId: "run-1",
    family: "codex-exec" as const,
    stage: "writer",
    role: "author-writer",
    model: "gpt-5.6-sol",
    effort: "high",
    latencyMs: 1000,
    outcome: "content_completed" as const,
    ...over,
  };
}

// ── append → read round-trip ────────────────────────────────────────────────
test("appendCallLedgerEntry writes an entry with all six required fields + the NOT_METERED cost marker", () => {
  const roots = mkTestRoots("run-call-ledger-roundtrip");
  try {
    const entry = appendCallLedgerEntry(baseEntry({ pipelineDir: roots.base, sessionId: "sess-1" }));
    assert.equal(entry.family, "codex-exec");
    assert.equal(entry.stage, "writer");
    assert.equal(entry.role, "author-writer");
    assert.equal(entry.model, "gpt-5.6-sol");
    assert.equal(entry.effort, "high");
    assert.equal(entry.latencyMs, 1000);
    assert.equal(entry.outcome, "content_completed");
    assert.equal(entry.cost, LEDGER_COST_MARKER, "never a fabricated dollar figure — always the NOT_METERED marker");
    assert.equal(entry.cost, "NOT_METERED");
    assert.ok(entry.at, "a real wall-clock timestamp is stamped");

    const read = readCallLedgerEntries(roots.base, "zz-ledger-mod", "run-1");
    assert.equal(read.length, 1);
    assert.deepEqual(read[0], entry);

    const paths = callLedgerPaths(roots.base, "zz-ledger-mod", "run-1");
    assert.ok(existsSync(paths.jsonl));
  } finally {
    roots.dispose();
  }
});

test("genuinely unobservable fields are recorded as explicit null, never guessed", () => {
  const roots = mkTestRoots("run-call-ledger-nulls");
  try {
    const entry = appendCallLedgerEntry(baseEntry({
      pipelineDir: roots.base,
      family: "claude-side",
      stage: "d7-rubric-audit",
      role: "primary",
      model: null,
      effort: null,
      latencyMs: null,
      outcome: "content_completed",
    }));
    assert.equal(entry.model, null);
    assert.equal(entry.effort, null);
    assert.equal(entry.latencyMs, null);
    assert.equal(entry.sessionId, null, "sessionId defaults to explicit null, not omitted/undefined");
  } finally {
    roots.dispose();
  }
});

// ── size-capped retention ────────────────────────────────────────────────────
test("size cap (line count) evicts the OLDEST entries first and never drops the newest", () => {
  const roots = mkTestRoots("run-call-ledger-linecap");
  try {
    const maxLines = 5;
    for (let i = 0; i < 12; i++) {
      appendCallLedgerEntry(baseEntry({ pipelineDir: roots.base, sessionId: `sess-${i}`, maxLines }));
    }
    const read = readCallLedgerEntries(roots.base, "zz-ledger-mod", "run-1");
    assert.equal(read.length, maxLines, "the file never grows past the line cap");
    // The retained lines are the MOST RECENT `maxLines` appends (7..11), oldest evicted.
    const sessionIds = read.map((e) => e.sessionId);
    assert.deepEqual(sessionIds, ["sess-7", "sess-8", "sess-9", "sess-10", "sess-11"]);
  } finally {
    roots.dispose();
  }
});

test("size cap (byte budget) evicts the OLDEST entries first and stays under budget", () => {
  const roots = mkTestRoots("run-call-ledger-bytecap");
  try {
    // Each serialized entry is a few hundred bytes; a tiny budget forces eviction
    // well before the (generous) default line cap would ever trigger.
    const maxBytes = 900;
    for (let i = 0; i < 10; i++) {
      appendCallLedgerEntry(baseEntry({ pipelineDir: roots.base, sessionId: `sess-${i}`, maxLines: 10_000, maxBytes }));
    }
    const paths = callLedgerPaths(roots.base, "zz-ledger-mod", "run-1");
    const bytes = readFileSync(paths.jsonl, "utf8");
    assert.ok(Buffer.byteLength(bytes, "utf8") <= maxBytes, `ledger file must stay under the byte budget, got ${Buffer.byteLength(bytes, "utf8")}`);
    const read = readCallLedgerEntries(roots.base, "zz-ledger-mod", "run-1");
    assert.ok(read.length < 10, "the byte cap evicted at least one entry");
    assert.equal(read[read.length - 1].sessionId, "sess-9", "the newest entry always survives");
  } finally {
    roots.dispose();
  }
});

test("default caps are sane (bounded, non-zero)", () => {
  assert.ok(DEFAULT_MAX_LEDGER_LINES > 0 && DEFAULT_MAX_LEDGER_LINES < 1_000_000);
  assert.ok(DEFAULT_MAX_LEDGER_BYTES > 0 && DEFAULT_MAX_LEDGER_BYTES < 100 * 1024 * 1024);
});

// ── percentile() ─────────────────────────────────────────────────────────────
test("percentile: empty input is null (never a fabricated 0)", () => {
  assert.equal(percentile([], 0.5), null);
  assert.equal(percentile([], 0.95), null);
});

test("percentile: single-element input returns that element for any p", () => {
  assert.equal(percentile([42], 0.5), 42);
  assert.equal(percentile([42], 0.95), 42);
});

test("percentile: nearest-rank over a known ascending array", () => {
  const sorted = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  assert.equal(percentile(sorted, 0.5), 50, "p50 of 10 ascending values, nearest-rank");
  assert.equal(percentile(sorted, 0.95), 100, "p95 of 10 ascending values, nearest-rank");
});

// ── rollup arithmetic ────────────────────────────────────────────────────────
function mkRollupEntry(over: Partial<RunCallLedgerEntryV1>): RunCallLedgerEntryV1 {
  return {
    schema: "run-call-ledger-entry-v1",
    at: new Date().toISOString(),
    runId: "run-x",
    bookId: "zz-rollup",
    family: "codex-exec",
    stage: "writer",
    role: "author-writer",
    model: "gpt-5.6-sol",
    effort: "high",
    latencyMs: 100,
    outcome: "content_completed",
    sessionId: null,
    cost: "NOT_METERED",
    ...over,
  };
}

test("buildCallLedgerRollup: counts by family/stage/role/model/outcome are exact", () => {
  const entries: RunCallLedgerEntryV1[] = [
    mkRollupEntry({ family: "codex-exec", stage: "writer", role: "author-writer", model: "gpt-5.6-sol", outcome: "content_completed", latencyMs: 100 }),
    mkRollupEntry({ family: "codex-exec", stage: "writer", role: "author-writer", model: "gpt-5.6-sol", outcome: "content_completed", latencyMs: 200 }),
    mkRollupEntry({ family: "codex-exec", stage: "qc-review", role: "qc-reviewer", model: "gpt-5.6-sol", outcome: "timeout", latencyMs: 300 }),
    mkRollupEntry({ family: "claude-side", stage: "d7-rubric-audit", role: "primary", model: null, outcome: "content_completed", latencyMs: null }),
    mkRollupEntry({ family: "claude-side", stage: "d7-rubric-audit", role: "adjudicator", model: null, outcome: "content_invalid", latencyMs: null }),
  ];
  const rollup = buildCallLedgerRollup("zz-rollup", "run-x", entries);
  assert.equal(rollup.totalCalls, 5);
  assert.deepEqual(rollup.byFamily, { "codex-exec": 3, "claude-side": 2 });
  assert.deepEqual(rollup.byStage, { writer: 2, "qc-review": 1, "d7-rubric-audit": 2 });
  assert.deepEqual(rollup.byRole, { "author-writer": 2, "qc-reviewer": 1, primary: 1, adjudicator: 1 });
  assert.deepEqual(rollup.byModel, { "gpt-5.6-sol": 3, unknown: 2 });
  assert.deepEqual(rollup.byOutcome, { content_completed: 3, timeout: 1, content_invalid: 1 });
  assert.equal(rollup.latency.sampledCalls, 3, "only the 3 entries with a real latencyMs count as sampled");
  assert.equal(rollup.latency.unknownLatencyCalls, 2, "the 2 null-latency D7 entries are counted as unknown, never 0");
  assert.equal(rollup.latency.p50Ms, 200);
  assert.equal(rollup.latency.p95Ms, 300);
  assert.equal(rollup.cost, "NOT_METERED");
});

test("buildCallLedgerRollup on zero entries returns an honest empty rollup", () => {
  const rollup = buildCallLedgerRollup("zz-empty", "run-x", []);
  assert.equal(rollup.totalCalls, 0);
  assert.equal(rollup.latency.p50Ms, null);
  assert.equal(rollup.latency.p95Ms, null);
  assert.equal(rollup.latency.sampledCalls, 0);
  assert.equal(rollup.latency.unknownLatencyCalls, 0);
});

test("writeCallLedgerRollup + finalize round-trip through disk", () => {
  const roots = mkTestRoots("run-call-ledger-rollup-write");
  try {
    appendCallLedgerEntry(baseEntry({ pipelineDir: roots.base, sessionId: "s1" }));
    appendCallLedgerEntry(baseEntry({ pipelineDir: roots.base, sessionId: "s2", outcome: "timeout", latencyMs: 500 }));
    const entries = readCallLedgerEntries(roots.base, "zz-ledger-mod", "run-1");
    const rollup = buildCallLedgerRollup("zz-ledger-mod", "run-1", entries);
    const path = writeCallLedgerRollup(roots.base, rollup);
    assert.ok(existsSync(path));
    const onDisk = JSON.parse(readFileSync(path, "utf8"));
    assert.equal(onDisk.totalCalls, 2);
    assert.equal(onDisk.byOutcome.content_completed, 1);
    assert.equal(onDisk.byOutcome.timeout, 1);
  } finally {
    roots.dispose();
  }
});

// ── per-book rollup-of-rollups ───────────────────────────────────────────────
test("buildBookRollup aggregates across EVERY run's jsonl for a book, staying O(1) in shape", () => {
  const roots = mkTestRoots("run-call-ledger-book-rollup");
  try {
    appendCallLedgerEntry(baseEntry({ pipelineDir: roots.base, runId: "run-a", sessionId: "a1" }));
    appendCallLedgerEntry(baseEntry({ pipelineDir: roots.base, runId: "run-a", sessionId: "a2" }));
    appendCallLedgerEntry(baseEntry({ pipelineDir: roots.base, runId: "run-b", sessionId: "b1", outcome: "timeout" }));
    const book = buildBookRollup(roots.base, "zz-ledger-mod");
    assert.equal(book.totalCalls, 3, "aggregated across BOTH runs, not just the last one");
    assert.equal(book.byOutcome.content_completed, 2);
    assert.equal(book.byOutcome.timeout, 1);

    const path = writeBookRollup(roots.base, "zz-ledger-mod");
    assert.ok(existsSync(path));
    const onDisk = JSON.parse(readFileSync(path, "utf8"));
    assert.equal(onDisk.totalCalls, 3);
  } finally {
    roots.dispose();
  }
});

test("buildBookRollup on a book with no ledger directory yet is an honest empty rollup (never throws)", () => {
  const roots = mkTestRoots("run-call-ledger-book-rollup-empty");
  try {
    const book = buildBookRollup(roots.base, "zz-never-ran");
    assert.equal(book.totalCalls, 0);
  } finally {
    roots.dispose();
  }
});

// ── concurrency: two runIds for the same book never cross-contaminate ───────
test("two distinct runIds for the same book write fully independent ledgers", () => {
  const roots = mkTestRoots("run-call-ledger-concurrency");
  try {
    for (let i = 0; i < 5; i++) appendCallLedgerEntry(baseEntry({ pipelineDir: roots.base, runId: "run-p", sessionId: `p-${i}` }));
    for (let i = 0; i < 3; i++) appendCallLedgerEntry(baseEntry({ pipelineDir: roots.base, runId: "run-q", sessionId: `q-${i}` }));
    const p = readCallLedgerEntries(roots.base, "zz-ledger-mod", "run-p");
    const q = readCallLedgerEntries(roots.base, "zz-ledger-mod", "run-q");
    assert.equal(p.length, 5);
    assert.equal(q.length, 3);
    assert.ok(p.every((e) => e.runId === "run-p" && e.sessionId?.startsWith("p-")));
    assert.ok(q.every((e) => e.runId === "run-q" && e.sessionId?.startsWith("q-")));
  } finally {
    roots.dispose();
  }
});

// ── durability: NOT under a gitignored path ─────────────────────────────────
test("the ledger + rollup paths are NOT matched by git check-ignore (durable, unlike logs/exec/)", () => {
  const bookId = "zz-ledger-durability-probe";
  const runId = "run-durability";
  const paths = callLedgerPaths(PIPELINE_DIR, bookId, runId);
  try {
    appendCallLedgerEntry(baseEntry({ pipelineDir: PIPELINE_DIR, bookId, runId, sessionId: "d1" }));
    writeCallLedgerRollup(PIPELINE_DIR, buildCallLedgerRollup(bookId, runId, readCallLedgerEntries(PIPELINE_DIR, bookId, runId)));

    for (const p of [paths.jsonl, paths.summary]) {
      const r = spawnSync("git", ["check-ignore", p], { cwd: PIPELINE_DIR, encoding: "utf8" });
      // git check-ignore exits 0 (and prints the path) when the path IS ignored,
      // 1 when it is NOT ignored. Exactly the opposite of `logs/exec/`.
      assert.equal(r.status, 1, `expected NOT ignored (durable): ${p} — git check-ignore exit ${r.status}, stdout=${r.stdout}`);
    }

    // Contrast: prove the harness itself can detect an ignored path, so a
    // status-1 result above isn't just `git check-ignore` failing to run.
    const ignoredProbe = resolve(PIPELINE_DIR, "logs", "exec", "some-manifest.json");
    const ignoredResult = spawnSync("git", ["check-ignore", ignoredProbe], { cwd: PIPELINE_DIR, encoding: "utf8" });
    assert.equal(ignoredResult.status, 0, "logs/exec/ must still be gitignored (control case)");
  } finally {
    rmSync(paths.dir, { recursive: true, force: true });
  }
});
