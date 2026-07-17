/**
 * WP-E42 — versioned price-table contract + `PRICE NOT VERIFIED` rollups.
 *
 * Covers:
 *  - loadPriceTable(pipelineDir): absent file → null; the shipped
 *    `.example.json` (ownerApproved: false) → rejected even when copied to
 *    the real path verbatim; a valid owner-approved fixture → loaded.
 *  - loadPriceTableDetailed: typed rejection reasons for every invalid/missing
 *    required field, one violation at a time.
 *  - the runCallLedger.ts rollup join (buildCallLedgerRollup / estimateSessionCost):
 *    absent/null table ⇒ priceVersion null, no `estimate` key, and the
 *    stringified rollup carries no "$" and no "estimatedCost" anywhere; a
 *    valid table ⇒ estimate priced from `trueSessionCalls` only (reingest and
 *    legacy-unknown entries excluded), priceVersion stamped from the table.
 *  - finalizeRunCallLedgerRollup / buildBookRollup wire loadPriceTable
 *    themselves — a fixture table written to disk under the pipelineDir is
 *    picked up with no caller-side plumbing.
 */

import assert from "node:assert/strict";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { test } from "./harness.js";
import { mkTestRoots } from "./testRoots.js";
import { PIPELINE_DIR } from "./helpers.js";
import {
  loadPriceTable,
  loadPriceTableDetailed,
  priceTablePath,
  PRICE_TABLE_SCHEMA,
  type PriceTableV1,
} from "../src/telemetry/priceTable.js";
import {
  appendCallLedgerEntry,
  buildCallLedgerRollup,
  estimateSessionCost,
  finalizeRunCallLedgerRollup,
  type RunCallLedgerEntryV1,
} from "../src/telemetry/runCallLedger.js";

function writeTable(pipelineDir: string, table: unknown): void {
  const path = priceTablePath(pipelineDir);
  mkdirSync(resolve(pipelineDir, "config"), { recursive: true });
  writeFileSync(path, JSON.stringify(table, null, 2));
}

function validTable(over: Partial<PriceTableV1> = {}): PriceTableV1 {
  return {
    schema: PRICE_TABLE_SCHEMA,
    priceVersion: "2026-07-17",
    effectiveDate: "2026-07-17",
    ownerApproved: true,
    prices: {
      "gpt-5.6-sol": { perSession: 2.5 },
      "gpt-5.6-terra": { perSession: 1.75 },
    },
    ...over,
  };
}

function mkEntry(over: Partial<RunCallLedgerEntryV1> = {}): RunCallLedgerEntryV1 {
  return {
    schema: "run-call-ledger-entry-v1",
    at: new Date().toISOString(),
    runId: "run-1",
    bookId: "zz-price",
    family: "codex-exec",
    stage: "writer",
    role: "author-writer",
    model: "gpt-5.6-sol",
    effort: "high",
    latencyMs: 1000,
    outcome: "content_completed",
    sessionId: null,
    cost: "NOT_METERED",
    ...over,
  };
}

// ── loadPriceTable: absent / example / valid ────────────────────────────────

test("loadPriceTable: absent config/price-table.v1.json ⇒ null", () => {
  const roots = mkTestRoots("price-table-absent");
  try {
    assert.equal(loadPriceTable(roots.base), null);
    const detailed = loadPriceTableDetailed(roots.base);
    assert.deepEqual(detailed, { status: "rejected", reason: "file-absent" });
  } finally {
    roots.dispose();
  }
});

test("loadPriceTable: the shipped .example.json (ownerApproved: false) is rejected even copied verbatim to the real path", () => {
  const roots = mkTestRoots("price-table-example");
  try {
    mkdirSync(resolve(roots.base, "config"), { recursive: true });
    const examplePath = resolve(PIPELINE_DIR, "config", "price-table.v1.example.json");
    assert.ok(existsSync(examplePath), "the example file must actually ship");
    const example = JSON.parse(readFileSync(examplePath, "utf8"));
    assert.equal(example.ownerApproved, false, "the shipped example must never be owner-approved");
    copyFileSync(examplePath, priceTablePath(roots.base));

    assert.equal(loadPriceTable(roots.base), null, "copy-pasting the example must never load");
    const detailed = loadPriceTableDetailed(roots.base);
    assert.deepEqual(detailed, { status: "rejected", reason: "not-owner-approved" });
  } finally {
    roots.dispose();
  }
});

test("loadPriceTable: a valid owner-approved fixture table loads with every field intact", () => {
  const roots = mkTestRoots("price-table-valid");
  try {
    writeTable(roots.base, validTable());
    const table = loadPriceTable(roots.base);
    assert.ok(table);
    assert.equal(table!.schema, PRICE_TABLE_SCHEMA);
    assert.equal(table!.priceVersion, "2026-07-17");
    assert.equal(table!.effectiveDate, "2026-07-17");
    assert.equal(table!.ownerApproved, true);
    assert.deepEqual(table!.prices["gpt-5.6-sol"], { perSession: 2.5 });
  } finally {
    roots.dispose();
  }
});

// ── loadPriceTableDetailed: typed rejection reasons ─────────────────────────

test("loadPriceTableDetailed: unparsable JSON ⇒ invalid-json", () => {
  const roots = mkTestRoots("price-table-badjson");
  try {
    mkdirSync(resolve(roots.base, "config"), { recursive: true });
    writeFileSync(priceTablePath(roots.base), "{not json");
    assert.deepEqual(loadPriceTableDetailed(roots.base), { status: "rejected", reason: "invalid-json" });
  } finally {
    roots.dispose();
  }
});

test("loadPriceTableDetailed: array/non-object JSON ⇒ not-an-object", () => {
  const roots = mkTestRoots("price-table-array");
  try {
    writeTable(roots.base, [1, 2, 3]);
    assert.deepEqual(loadPriceTableDetailed(roots.base), { status: "rejected", reason: "not-an-object" });
  } finally {
    roots.dispose();
  }
});

test("loadPriceTableDetailed: wrong schema tag ⇒ wrong-schema", () => {
  const roots = mkTestRoots("price-table-wrongschema");
  try {
    writeTable(roots.base, validTable({ schema: "some-other-schema-v1" as never }));
    assert.deepEqual(loadPriceTableDetailed(roots.base), { status: "rejected", reason: "wrong-schema" });
  } finally {
    roots.dispose();
  }
});

test("loadPriceTableDetailed: missing priceVersion ⇒ missing-priceVersion", () => {
  const roots = mkTestRoots("price-table-nopv");
  try {
    const t = validTable() as Record<string, unknown>;
    delete t.priceVersion;
    writeTable(roots.base, t);
    assert.deepEqual(loadPriceTableDetailed(roots.base), { status: "rejected", reason: "missing-priceVersion" });
  } finally {
    roots.dispose();
  }
});

test("loadPriceTableDetailed: priceVersion without an embedded YYYY-MM-DD date ⇒ missing-priceVersion", () => {
  const roots = mkTestRoots("price-table-undatedversion");
  try {
    writeTable(roots.base, validTable({ priceVersion: "v1" }));
    assert.deepEqual(loadPriceTableDetailed(roots.base), { status: "rejected", reason: "missing-priceVersion" });
  } finally {
    roots.dispose();
  }
});

test("loadPriceTableDetailed: missing effectiveDate ⇒ missing-effectiveDate", () => {
  const roots = mkTestRoots("price-table-noed");
  try {
    const t = validTable() as Record<string, unknown>;
    delete t.effectiveDate;
    writeTable(roots.base, t);
    assert.deepEqual(loadPriceTableDetailed(roots.base), { status: "rejected", reason: "missing-effectiveDate" });
  } finally {
    roots.dispose();
  }
});

test("loadPriceTableDetailed: malformed effectiveDate (not strict YYYY-MM-DD) ⇒ missing-effectiveDate", () => {
  const roots = mkTestRoots("price-table-badeffdate");
  try {
    writeTable(roots.base, validTable({ effectiveDate: "July 17 2026" }));
    assert.deepEqual(loadPriceTableDetailed(roots.base), { status: "rejected", reason: "missing-effectiveDate" });
  } finally {
    roots.dispose();
  }
});

test("loadPriceTableDetailed: ownerApproved missing entirely ⇒ not-owner-approved", () => {
  const roots = mkTestRoots("price-table-noowner");
  try {
    const t = validTable() as Record<string, unknown>;
    delete t.ownerApproved;
    writeTable(roots.base, t);
    assert.deepEqual(loadPriceTableDetailed(roots.base), { status: "rejected", reason: "not-owner-approved" });
  } finally {
    roots.dispose();
  }
});

test("loadPriceTableDetailed: ownerApproved as a truthy non-boolean (\"true\", 1) is still rejected", () => {
  const roots = mkTestRoots("price-table-truthyowner");
  try {
    writeTable(roots.base, validTable({ ownerApproved: "true" as never }));
    assert.deepEqual(loadPriceTableDetailed(roots.base), { status: "rejected", reason: "not-owner-approved" });
  } finally {
    roots.dispose();
  }
});

test("loadPriceTableDetailed: prices missing entirely ⇒ missing-prices", () => {
  const roots = mkTestRoots("price-table-noprices");
  try {
    const t = validTable() as Record<string, unknown>;
    delete t.prices;
    writeTable(roots.base, t);
    assert.deepEqual(loadPriceTableDetailed(roots.base), { status: "rejected", reason: "missing-prices" });
  } finally {
    roots.dispose();
  }
});

test("loadPriceTableDetailed: a price entry with a negative/non-numeric perSession ⇒ invalid-price-entry", () => {
  const roots = mkTestRoots("price-table-negprice");
  try {
    writeTable(roots.base, validTable({ prices: { "gpt-5.6-sol": { perSession: -1 } } }));
    assert.deepEqual(loadPriceTableDetailed(roots.base), { status: "rejected", reason: "invalid-price-entry" });

    writeTable(roots.base, validTable({ prices: { "gpt-5.6-sol": { perSession: "cheap" as never } } }));
    assert.deepEqual(loadPriceTableDetailed(roots.base), { status: "rejected", reason: "invalid-price-entry" });
  } finally {
    roots.dispose();
  }
});

test("loadPriceTableDetailed: an empty prices object is still a valid table (zero priced models)", () => {
  const roots = mkTestRoots("price-table-emptyprices");
  try {
    writeTable(roots.base, validTable({ prices: {} }));
    const result = loadPriceTableDetailed(roots.base);
    assert.equal(result.status, "loaded");
  } finally {
    roots.dispose();
  }
});

// ── rollup join: absent table ⇒ no dollar figure anywhere ───────────────────

test("buildCallLedgerRollup: priceTable explicitly null ⇒ priceVersion null, no estimate key, no dollar figure anywhere in the stringified rollup", () => {
  const entries = [
    mkEntry({ sessionKind: "session" }),
    mkEntry({ sessionKind: "session", model: "gpt-5.6-terra" }),
    mkEntry({ sessionKind: "reingest" }),
  ];
  const rollup = buildCallLedgerRollup("zz-price", "run-1", entries, { priceTable: null });
  assert.equal(rollup.priceVersion, null);
  assert.ok(!("estimate" in rollup), "no estimate key at all when the table is null");
  const json = JSON.stringify(rollup);
  assert.ok(!json.includes("$"), "no dollar sign anywhere in the rollup");
  assert.ok(!json.includes("estimatedCost"), "no estimatedCost key anywhere in the rollup");
});

test("buildCallLedgerRollup: priceTable omitted entirely behaves exactly like pre-WP-E42 (priceVersion opt passthrough, never an estimate)", () => {
  const entries = [mkEntry({ sessionKind: "session" })];
  const rollup = buildCallLedgerRollup("zz-price", "run-1", entries, { priceVersion: "some-legacy-tag" });
  assert.equal(rollup.priceVersion, "some-legacy-tag");
  assert.ok(!("estimate" in rollup));
});

// ── rollup join: valid table ⇒ estimate priced from trueSessionCalls only ──

test("buildCallLedgerRollup + estimateSessionCost: estimate sums perSession over sessionKind===\"session\" entries only, excludes reingest/legacy", () => {
  const table = validTable();
  const entries = [
    mkEntry({ sessionKind: "session", model: "gpt-5.6-sol" }),      // 2.50
    mkEntry({ sessionKind: "session", model: "gpt-5.6-terra" }),    // 1.75
    mkEntry({ sessionKind: "reingest", model: "gpt-5.6-sol" }),     // excluded
    mkEntry({ model: "gpt-5.6-sol" }),                              // legacy, excluded
  ];
  const rollup = buildCallLedgerRollup("zz-price", "run-1", entries, { priceTable: table });
  assert.equal(rollup.priceVersion, "2026-07-17", "priceVersion is stamped from the table");
  assert.ok(rollup.estimate);
  assert.equal(rollup.estimate!.priceVersion, "2026-07-17");
  assert.equal(rollup.estimate!.effectiveDate, "2026-07-17");
  assert.equal(rollup.estimate!.estimatedCost, 4.25, "2.50 + 1.75, reingest/legacy never priced");
  assert.equal(rollup.estimate!.pricedSessionCalls, 2);
  assert.equal(rollup.estimate!.unpricedSessionCalls, 0);
  assert.ok(!("costPerAcceptedChapter" in rollup.estimate!), "omitted when acceptedChapterCount is not supplied");
});

test("estimateSessionCost: a session entry whose model has no price-table entry contributes $0 and is tallied unpriced, never guessed", () => {
  const table = validTable();
  const entries = [
    mkEntry({ sessionKind: "session", model: "gpt-5.6-sol" }),
    mkEntry({ sessionKind: "session", model: "some-unpriced-model" }),
    mkEntry({ sessionKind: "session", model: null }),
  ];
  const estimate = estimateSessionCost(entries, table);
  assert.equal(estimate.estimatedCost, 2.5);
  assert.equal(estimate.pricedSessionCalls, 1);
  assert.equal(estimate.unpricedSessionCalls, 2);
});

test("estimateSessionCost: costPerAcceptedChapter present only for a positive finite acceptedChapterCount", () => {
  const table = validTable();
  const entries = [mkEntry({ sessionKind: "session", model: "gpt-5.6-sol" })];

  const withCount = estimateSessionCost(entries, table, { acceptedChapterCount: 5 });
  assert.equal(withCount.costPerAcceptedChapter, 0.5);

  const zeroCount = estimateSessionCost(entries, table, { acceptedChapterCount: 0 });
  assert.ok(!("costPerAcceptedChapter" in zeroCount), "zero would divide-by-zero into Infinity — omitted instead");

  const noCount = estimateSessionCost(entries, table);
  assert.ok(!("costPerAcceptedChapter" in noCount));
});

// ── finalizeRunCallLedgerRollup / buildBookRollup wire loadPriceTable themselves ──

test("finalizeRunCallLedgerRollup: a fixture table on disk under pipelineDir is picked up with no caller-side plumbing", () => {
  const roots = mkTestRoots("price-table-finalize");
  try {
    writeTable(roots.base, validTable());
    appendCallLedgerEntry({
      pipelineDir: roots.base,
      bookId: "zz-price-finalize",
      runId: "run-1",
      family: "codex-exec",
      stage: "writer",
      role: "author-writer",
      model: "gpt-5.6-sol",
      effort: "high",
      latencyMs: 500,
      outcome: "content_completed",
      sessionKind: "session",
    });
    const { rollup } = finalizeRunCallLedgerRollup(roots.base, "zz-price-finalize", "run-1");
    assert.equal(rollup.priceVersion, "2026-07-17");
    assert.ok(rollup.estimate);
    assert.equal(rollup.estimate!.estimatedCost, 2.5);
  } finally {
    roots.dispose();
  }
});

test("finalizeRunCallLedgerRollup: no table on disk ⇒ priceVersion null, no estimate, exactly like before WP-E42", () => {
  const roots = mkTestRoots("price-table-finalize-absent");
  try {
    appendCallLedgerEntry({
      pipelineDir: roots.base,
      bookId: "zz-price-finalize-absent",
      runId: "run-1",
      family: "codex-exec",
      stage: "writer",
      role: "author-writer",
      model: "gpt-5.6-sol",
      effort: "high",
      latencyMs: 500,
      outcome: "content_completed",
      sessionKind: "session",
    });
    const { rollup } = finalizeRunCallLedgerRollup(roots.base, "zz-price-finalize-absent", "run-1");
    assert.equal(rollup.priceVersion, null);
    assert.ok(!("estimate" in rollup));
  } finally {
    roots.dispose();
  }
});
