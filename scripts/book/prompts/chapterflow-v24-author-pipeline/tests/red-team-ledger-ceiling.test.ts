/**
 * WP-E71 red-team — ATTACK 5 (reingest double-count) + ATTACK 8 (price fabrication).
 *
 * ATTACK 5. A resume RE-INGESTS an already-completed rating's bytes and legacy
 * entries carry no provenance. Neither may be counted as a live model session, so
 * a live-spend ceiling can be neither inflated (by reingests) nor silently
 * inflated (by treating an unlabeled legacy call as a session). This asserts
 * `countTrueSessions` / `trueSessionCalls` count ONLY `sessionKind:"session"`
 * entries, and that a `checkBudgetBeforeStage2` reading fed from that count is
 * invariant to how many reingests pile up.
 *
 * ATTACK 8. The ledger's currency is call-count + latency, never dollars. A rollup
 * built with no owner-approved price table must contain NO dollar figure anywhere;
 * and the shipped example table (`ownerApproved:false`) can never load — copying it
 * verbatim over the real path is still rejected.
 *
 * Hermetic: every ledger/price file is under a fresh tmp pipeline dir; nothing
 * touches the real pipeline `state/` or `config/`.
 */

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { test } from "./harness.js";
import {
  appendCallLedgerEntry,
  buildCallLedgerRollup,
  countTrueSessions,
  finalizeRunCallLedgerRollup,
  readCallLedgerEntries,
  LEDGER_COST_MARKER,
  type LedgerCallFamily,
  type RunCallLedgerEntryInput,
} from "../src/telemetry/runCallLedger.js";
import { loadPriceTableDetailed } from "../src/telemetry/priceTable.js";
import { checkBudgetBeforeStage2 } from "../src/bakeoff/screeningPlan.js";

const PIPELINE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function freshPipelineDir(): string {
  return mkdtempSync(join(tmpdir(), "cf-rt5-pipe-"));
}

function entry(over: Partial<RunCallLedgerEntryInput> & { family: LedgerCallFamily }): RunCallLedgerEntryInput {
  return {
    stage: "d7-rater-dispatch",
    role: "primary",
    model: "gpt-5.6-sol",
    effort: "ultra",
    latencyMs: 1000,
    outcome: "content_completed",
    ...over,
  };
}

/** Append `sessions` real sessions, `reingests` reingests, `legacy` unlabeled
 *  entries to (pipelineDir, book, run). */
function seedLedger(pipelineDir: string, book: string, run: string, counts: { sessions: number; reingests: number; legacy: number; claudeSessions?: number }): void {
  for (let i = 0; i < counts.sessions; i++) appendCallLedgerEntry({ pipelineDir, bookId: book, runId: run, ...entry({ family: "codex-exec", sessionKind: "session", attemptIndex: i + 1 }) });
  for (let i = 0; i < (counts.claudeSessions ?? 0); i++) appendCallLedgerEntry({ pipelineDir, bookId: book, runId: run, ...entry({ family: "claude-side", sessionKind: "session", model: null, effort: null }) });
  for (let i = 0; i < counts.reingests; i++) appendCallLedgerEntry({ pipelineDir, bookId: book, runId: run, ...entry({ family: "codex-exec", sessionKind: "reingest" }) });
  for (let i = 0; i < counts.legacy; i++) appendCallLedgerEntry({ pipelineDir, bookId: book, runId: run, ...entry({ family: "codex-exec" }) }); // no sessionKind
}

// ── ATTACK 5 ────────────────────────────────────────────────────────────────────

test("attack5: countTrueSessions counts only real sessions — reingests and legacy entries never count", () => {
  const pipelineDir = freshPipelineDir();
  seedLedger(pipelineDir, "zz-rt5-a", "run1", { sessions: 2, claudeSessions: 1, reingests: 3, legacy: 2 });
  const entries = readCallLedgerEntries(pipelineDir, "zz-rt5-a", "run1");
  assert.equal(entries.length, 8, "all 8 entries persisted");

  assert.equal(countTrueSessions(entries), 3, "2 codex + 1 claude real sessions; reingests/legacy excluded");
  assert.equal(countTrueSessions(entries, { family: "codex-exec" }), 2, "family filter isolates codex sessions");
  assert.equal(countTrueSessions(entries, { family: "claude-side" }), 1);

  const rollup = buildCallLedgerRollup("zz-rt5-a", "run1", entries);
  assert.equal(rollup.trueSessionCalls, 3, "trueSessionCalls mirrors countTrueSessions");
  assert.equal(rollup.bySessionKind?.session, 3);
  assert.equal(rollup.bySessionKind?.reingest, 3);
  assert.equal(rollup.bySessionKind?.unknown, 2, "legacy entries are 'unknown', never folded into 'session'");
});

test("attack5: a ceiling check fed from countTrueSessions cannot be inflated by piling on reingests", () => {
  const pipelineDir = freshPipelineDir();
  // Two runs with IDENTICAL real spend (3 sessions) but wildly different reingest counts.
  seedLedger(pipelineDir, "zz-rt5-b", "lean", { sessions: 3, reingests: 0, legacy: 0 });
  seedLedger(pipelineDir, "zz-rt5-b", "resumed", { sessions: 3, reingests: 50, legacy: 5 });

  const lean = countTrueSessions(readCallLedgerEntries(pipelineDir, "zz-rt5-b", "lean"));
  const resumed = countTrueSessions(readCallLedgerEntries(pipelineDir, "zz-rt5-b", "resumed"));
  assert.equal(lean, 3);
  assert.equal(resumed, 3, "55 reingests+legacy entries did NOT inflate the true-session count");

  const check = (used: number) => checkBudgetBeforeStage2({ cumulativeSessionsUsed: used, ceiling: 150, stage1Confirmed: true, stage1AtCap: false, stage2PlannedSessions: 32 });
  const leanCheck = check(lean);
  const resumedCheck = check(resumed);
  assert.deepEqual(resumedCheck, leanCheck, "the ceiling reading is identical — reingests cannot move it");
  assert.equal(leanCheck.ok, true);
  assert.equal(leanCheck.ok ? leanCheck.remainingBeforeStage2 : -1, 147);
});

// ── ATTACK 8 ────────────────────────────────────────────────────────────────────

test("attack8: a rollup with no price table contains NO dollar figure anywhere in its JSON", () => {
  const pipelineDir = freshPipelineDir();
  seedLedger(pipelineDir, "zz-rt8-a", "run1", { sessions: 4, reingests: 1, legacy: 0 });
  const entries = readCallLedgerEntries(pipelineDir, "zz-rt8-a", "run1");

  const rollup = buildCallLedgerRollup("zz-rt8-a", "run1", entries, { priceTable: null });
  assert.equal(rollup.priceVersion, null, "PRICE NOT VERIFIED → priceVersion null");
  assert.ok(!("estimate" in rollup), "no estimate block without an owner-approved table");
  assert.equal(rollup.cost, LEDGER_COST_MARKER, "cost stays the NOT_METERED marker");

  const json = JSON.stringify(rollup);
  assert.ok(!json.includes("estimatedCost"), "no estimatedCost key");
  assert.ok(!json.includes("costPerAcceptedChapter"), "no per-chapter cost key");
  assert.ok(!/\$/.test(json), "no dollar sign anywhere in the rollup JSON");
});

test("attack8: finalizeRunCallLedgerRollup with no config price table stays PRICE-NOT-VERIFIED", () => {
  const pipelineDir = freshPipelineDir();
  seedLedger(pipelineDir, "zz-rt8-b", "run1", { sessions: 2, reingests: 0, legacy: 0 });
  const { rollup, path } = finalizeRunCallLedgerRollup(pipelineDir, "zz-rt8-b", "run1");
  assert.equal(rollup.priceVersion, null);
  assert.ok(!("estimate" in rollup));
  const persisted = readFileSync(path, "utf8");
  assert.ok(!persisted.includes("estimatedCost") && !/\$/.test(persisted), "the persisted summary carries no dollar figure");
});

test("attack8: the shipped example price table (ownerApproved:false) is rejected — copying it verbatim never loads", () => {
  // The committed example itself is not owner-approved.
  const example = JSON.parse(readFileSync(join(PIPELINE_ROOT, "config", "price-table.v1.example.json"), "utf8"));
  assert.equal(example.ownerApproved, false, "the shipped example must never be pre-approved");

  // Copy the example VERBATIM over the real load path in a tmp pipeline dir → still rejected.
  const pipelineDir = freshPipelineDir();
  mkdirSync(join(pipelineDir, "config"), { recursive: true });
  writeFileSync(join(pipelineDir, "config", "price-table.v1.json"), JSON.stringify(example, null, 2));
  const result = loadPriceTableDetailed(pipelineDir);
  assert.equal(result.status, "rejected");
  assert.equal(result.status === "rejected" ? result.reason : "", "not-owner-approved");
});

test("attack8: a truthy-but-non-boolean ownerApproved is still rejected (no soft-truthy bypass)", () => {
  const pipelineDir = freshPipelineDir();
  mkdirSync(join(pipelineDir, "config"), { recursive: true });
  const table = {
    schema: "chapterflow-price-table-v1",
    priceVersion: "2026-07-17",
    effectiveDate: "2026-07-17",
    ownerApproved: 1, // truthy, but not === true
    prices: { "gpt-5.6-sol": { perSession: 2.5 } },
  };
  writeFileSync(join(pipelineDir, "config", "price-table.v1.json"), JSON.stringify(table, null, 2));
  const result = loadPriceTableDetailed(pipelineDir);
  assert.equal(result.status, "rejected");
  assert.equal(result.status === "rejected" ? result.reason : "", "not-owner-approved");
});
