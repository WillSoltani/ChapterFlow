/**
 * Item B — two-round sweep confirmation + the per-round sweep history it rides on.
 *
 * The cross-chapter sweep is the noisiest, most stochastic reviewer: a single read flips verdict
 * round-to-round on byte-identical content. Auto-publish must therefore require TWO independent
 * clear reads over the SAME content before shipping, so one lucky read can't carry a book to main.
 * These tests cover the append-only history (the substrate) and sweepTwoRoundConfirmed (the gate).
 */

import assert from "node:assert/strict";
import { rmSync } from "node:fs";

import { test } from "./harness.js";
import { makeChapter } from "./helpers.js";
import { chapterContentHash } from "../src/critics/qcAttestation.js";
import {
  REQUIRED_SWEEP_FAMILIES,
  appendSweepHistory,
  loadSweepHistory,
  priorSweepRecord,
  sweepTwoRoundConfirmed,
  sweepHistoryPath,
  type SweepRecord,
} from "../src/qc/sweep.js";

const BOOK = "zz-fixture-sweep-confirm";
const CHAPTERS = [makeChapter(BOOK, 1), makeChapter(BOOK, 2)];
const HASHES = Object.fromEntries(CHAPTERS.map((ch) => [String(ch.number), chapterContentHash(ch)]));

function reset(): void {
  rmSync(sweepHistoryPath(BOOK), { force: true });
}

function rec(opts: { roundId: string; at: string; verdict?: SweepRecord["verdict"]; reviewer?: string; gating?: boolean; hashes?: Record<string, string> }): SweepRecord {
  return {
    schemaVersion: "sweep-attest-v1",
    bookId: BOOK,
    roundId: opts.roundId,
    verdict: opts.verdict ?? (opts.gating ? "REVISE" : "PASS"),
    reviewer: opts.reviewer ?? "codex-qc:sweep",
    attestedAt: opts.at,
    contentHashes: opts.hashes ?? HASHES,
    checkedFamilies: [...REQUIRED_SWEEP_FAMILIES],
    findings: opts.gating
      ? [{ family: "location_stamping", severity: "blocker", chapters: [1], unitId: "u", quote: "group chat", problem: "p", expectedFix: "f" }]
      : [],
  };
}

test("history: append is newest-first and de-duplicates by roundId (a re-finalized round keeps its LAST write)", () => {
  reset();
  try {
    appendSweepHistory(rec({ roundId: "r1", at: "2026-01-01T00:00:00.000Z" }));
    appendSweepHistory(rec({ roundId: "r2", at: "2026-01-02T00:00:00.000Z", gating: true }));
    appendSweepHistory(rec({ roundId: "r2", at: "2026-01-03T00:00:00.000Z" })); // r2 re-finalized → clear
    const hist = loadSweepHistory(BOOK);
    assert.deepEqual(hist.map((r) => r.roundId), ["r2", "r1"], "newest-first, one entry per round");
    assert.equal(hist[0].verdict, "PASS", "the LAST write for r2 wins (the re-finalize)");
    assert.equal(priorSweepRecord(BOOK, "r2")?.roundId, "r1", "prior of r2 is r1");
    assert.equal(priorSweepRecord(BOOK, "r1"), null, "r1 has no prior");
  } finally {
    reset();
  }
});

test("item B: a SINGLE clear read over the current content is NOT confirmed", () => {
  reset();
  try {
    appendSweepHistory(rec({ roundId: "r1", at: "2026-01-01T00:00:00.000Z" }));
    const r = sweepTwoRoundConfirmed(BOOK, CHAPTERS);
    assert.equal(r.ok, false, "one clear read is a single lucky roll — not enough to auto-publish");
  } finally {
    reset();
  }
});

test("item B: TWO independent clear reads over IDENTICAL content ARE confirmed", () => {
  reset();
  try {
    appendSweepHistory(rec({ roundId: "r1", at: "2026-01-01T00:00:00.000Z" }));
    appendSweepHistory(rec({ roundId: "r2", at: "2026-01-02T00:00:00.000Z" })); // independent fresh read
    assert.equal(sweepTwoRoundConfirmed(BOOK, CHAPTERS).ok, true, "two independent clear reads over identical bytes confirm");
  } finally {
    reset();
  }
});

test("item B: a CORROBORATED gate in history (two consecutive gating reads on frozen content) does NOT confirm, even if a later read clears", () => {
  // The real silent-drop concern: two independent reads AGREE a chapter is gated over identical bytes
  // → a genuine pattern. A single later clear must NOT auto-confirm it. The disqualifier is
  // corroboration-aware (same as the round verdict), so it fires on a REAL gate, not on noise.
  reset();
  try {
    appendSweepHistory(rec({ roundId: "r1", at: "2026-01-01T00:00:00.000Z", gating: true })); // gates ch1
    appendSweepHistory(rec({ roundId: "r2", at: "2026-01-02T00:00:00.000Z", gating: true })); // gates ch1 again → corroborated
    appendSweepHistory(rec({ roundId: "r3", at: "2026-01-03T00:00:00.000Z" })); // a later clear (a drop)
    assert.equal(sweepTwoRoundConfirmed(BOOK, CHAPTERS).ok, false, "a corroborated real gate blocks confirmation despite a later clear");
  } finally {
    reset();
  }
});

test("item B: a LONE UNcorroborated gate flip between clears is NOISE → still confirms (corroboration-consistent with the round verdict)", () => {
  // Defect-1 regression guard: the round verdict DEMOTES an uncorroborated single flip on frozen
  // content; the confirmation check must do the same, or a confirming round's own stochastic flag
  // would poison history and false-HALT a converged book. Two independent clears (r1,r3) remain.
  reset();
  try {
    appendSweepHistory(rec({ roundId: "r1", at: "2026-01-01T00:00:00.000Z" })); // clear (does NOT gate ch1)
    appendSweepHistory(rec({ roundId: "r2", at: "2026-01-02T00:00:00.000Z", gating: true })); // lone stochastic flip on ch1
    appendSweepHistory(rec({ roundId: "r3", at: "2026-01-03T00:00:00.000Z" })); // clear
    assert.equal(sweepTwoRoundConfirmed(BOOK, CHAPTERS).ok, true, "a lone uncorroborated flip (prior read over identical bytes did not gate) is noise, not a real gate");
  } finally {
    reset();
  }
});

test("item B: if the LATEST read GATES a chapter, the book is NOT confirmed (even with an older clear)", () => {
  reset();
  try {
    appendSweepHistory(rec({ roundId: "r1", at: "2026-01-01T00:00:00.000Z" })); // clear
    appendSweepHistory(rec({ roundId: "r2", at: "2026-01-02T00:00:00.000Z", gating: true })); // latest gates ch1
    assert.equal(sweepTwoRoundConfirmed(BOOK, CHAPTERS).ok, false, "a fresh read that found a problem must block, not be overridden by a stale clear");
  } finally {
    reset();
  }
});

test("item B: clear reads over DIFFERENT (stale) content do not count — the reads must be over TODAY's bytes", () => {
  reset();
  try {
    const stale = { "1": "old1", "2": "old2" };
    appendSweepHistory(rec({ roundId: "r1", at: "2026-01-01T00:00:00.000Z", hashes: stale }));
    appendSweepHistory(rec({ roundId: "r2", at: "2026-01-02T00:00:00.000Z", hashes: stale }));
    assert.equal(sweepTwoRoundConfirmed(BOOK, CHAPTERS).ok, false, "two clear reads over OLD content do not confirm the current book");
  } finally {
    reset();
  }
});

test("item B: confirmation needs TWO INDEPENDENT (non-carry) reads — carry-forward copies never count toward the total", () => {
  reset();
  try {
    appendSweepHistory(rec({ roundId: "r1", at: "2026-01-01T00:00:00.000Z", reviewer: "carry-forward" }));
    appendSweepHistory(rec({ roundId: "r2", at: "2026-01-02T00:00:00.000Z", reviewer: "carry-forward" }));
    assert.equal(sweepTwoRoundConfirmed(BOOK, CHAPTERS).ok, false, "two carry-forward copies are not independent evidence");
    // ONE genuine read + carries is STILL not enough — a carry is a byte copy, so one real stochastic
    // read would self-confirm (the exact false-negative item B exists to prevent).
    appendSweepHistory(rec({ roundId: "r3", at: "2026-01-03T00:00:00.000Z", reviewer: "codex-qc:sweep" }));
    assert.equal(sweepTwoRoundConfirmed(BOOK, CHAPTERS).ok, false, "one genuine read + a carry must NOT self-confirm");
    // a SECOND genuine independent read → confirmed
    appendSweepHistory(rec({ roundId: "r4", at: "2026-01-04T00:00:00.000Z", reviewer: "codex-qc:sweep" }));
    assert.equal(sweepTwoRoundConfirmed(BOOK, CHAPTERS).ok, true, "two genuine independent clear reads over identical content confirm");
  } finally {
    reset();
  }
});
