/**
 * P09 (F2) — per-chapter sweep carry-forward.
 *
 * The sweep's convergence unit is the CHAPTER at its content hash, not the whole book. A repair to
 * one chapter invalidates ONLY that chapter's clears; untouched chapters keep the independent reads
 * they already earned. These tests simulate round sequences against fixture sweep history and assert
 * the six acceptance scenarios from docs/v23/SWEEP-CARRYFORWARD-DESIGN.md.
 *
 * The two-independent-reads guarantee is PRESERVED per chapter — nothing here loosens it; it only
 * stops throwing away a clean chapter's progress when a sibling moves.
 */

import assert from "node:assert/strict";
import { existsSync, readdirSync, rmdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

import { test } from "./harness.js";
import { makeChapter } from "./helpers.js";
import { chapterContentHash } from "../src/critics/qcAttestation.js";
import {
  REQUIRED_SWEEP_FAMILIES,
  appendSweepHistory,
  buildChapterClearLedger,
  chapterClearsPath,
  hasChapterClearLedger,
  sweepHistoryPath,
  sweepRecordPath,
  sweepTwoRoundConfirmed,
  writeChapterClearLedger,
  type SweepRecord,
} from "../src/qc/sweep.js";
import { QC_ORCHESTRATOR_DIR } from "../src/qc/orchestrator/artifacts.js";

const BOOK = "zz-fixture-sweep-carryfwd";
const QC_ORCHESTRATOR_DIR_EXISTED_BEFORE_TESTS = existsSync(QC_ORCHESTRATOR_DIR);
const CHAPTERS = [1, 2, 3, 4, 5].map((n) => makeChapter(BOOK, n));
const HASHES = Object.fromEntries(CHAPTERS.map((ch) => [String(ch.number), chapterContentHash(ch)]));

// A "repaired" ch3 — same book, changed content → new hash; every other chapter's hash is untouched.
const CHAPTERS_R = CHAPTERS.map((ch) =>
  ch.number === 3 ? makeChapter(BOOK, 3, { overrides: { hook: "A deliberately rewritten hook that changes only this chapter's content hash." } }) : ch,
);
const HASHES_R = Object.fromEntries(CHAPTERS_R.map((ch) => [String(ch.number), chapterContentHash(ch)]));

function reset(): void {
  rmSync(sweepHistoryPath(BOOK), { force: true });
  rmSync(sweepRecordPath(BOOK), { force: true });
  rmSync(chapterClearsPath(BOOK), { force: true });
  rmSync(resolve(QC_ORCHESTRATOR_DIR, BOOK), { recursive: true, force: true });
  if (!QC_ORCHESTRATOR_DIR_EXISTED_BEFORE_TESTS && existsSync(QC_ORCHESTRATOR_DIR) && readdirSync(QC_ORCHESTRATOR_DIR).length === 0) {
    rmdirSync(QC_ORCHESTRATOR_DIR);
  }
}

/** A gating finding on `chapters` — location_stamping is NOT a distinctiveness-demotable family, so
 *  it reliably GATES (mirrors the existing two-round-confirm fixture). Deterministic unit/quote so
 *  two reads gating the same chapter produce the SAME v2 fingerprint (→ corroboration). */
function gatingFinding(chapters: number[]): SweepRecord["findings"][number] {
  return {
    family: "location_stamping",
    severity: "blocker",
    chapters,
    unitId: `u-${chapters.join("-")}`,
    quote: `the Riverside depot at 0600 recurs across chapters ${chapters.join(",")}`,
    problem: "same location stamp reused",
    expectedFix: "vary the setting per chapter",
  };
}

function rec(opts: { roundId: string; at: string; reviewerSessionId?: string; reviewer?: string; gate?: number[]; hashes?: Record<string, string> }): SweepRecord {
  const gating = (opts.gate?.length ?? 0) > 0;
  return {
    schemaVersion: "sweep-attest-v1",
    bookId: BOOK,
    roundId: opts.roundId,
    verdict: gating ? "REVISE" : "PASS",
    reviewer: opts.reviewer ?? "codex-qc:sweep",
    reviewerSessionId: opts.reviewerSessionId ?? `session-${opts.roundId}`,
    attestedAt: opts.at,
    contentHashes: opts.hashes ?? HASHES,
    checkedFamilies: [...REQUIRED_SWEEP_FAMILIES],
    findings: gating ? [gatingFinding(opts.gate!)] : [],
  };
}

// ── (a) clean read ×2 → publish-ready ──────────────────────────────────────────────────────────
test("P09 (a): two independent clean whole-book reads confirm every chapter → publish-ready", () => {
  reset();
  try {
    appendSweepHistory(rec({ roundId: "r1", at: "2026-02-01T00:00:00.000Z" }));
    assert.equal(hasChapterClearLedger(BOOK), true, "the first attestation materializes the clear ledger");
    assert.equal(sweepTwoRoundConfirmed(BOOK, CHAPTERS).ok, false, "one read = one clear per chapter, not two");
    appendSweepHistory(rec({ roundId: "r2", at: "2026-02-02T00:00:00.000Z" }));
    assert.equal(sweepTwoRoundConfirmed(BOOK, CHAPTERS).ok, true, "two independent clean reads → every chapter has two independent clears");
  } finally {
    reset();
  }
});

// ── (b) repair ch3 → only ch3 loses clears; untouched chapters keep progress ────────────────────
test("P09 (b): repairing ch3 invalidates ONLY ch3's clears; ch1/ch2/ch4/ch5 keep their pre-repair reads", () => {
  reset();
  try {
    appendSweepHistory(rec({ roundId: "r1", at: "2026-02-01T00:00:00.000Z" }));
    appendSweepHistory(rec({ roundId: "r2", at: "2026-02-02T00:00:00.000Z" }));
    assert.equal(sweepTwoRoundConfirmed(BOOK, CHAPTERS).ok, true, "book confirmed over the pre-repair bytes");

    // Repair ch3 (its hash changes; every other chapter's hash is identical).
    assert.notEqual(HASHES_R["3"], HASHES["3"], "the repair changes ch3's content hash");
    for (const n of ["1", "2", "4", "5"]) assert.equal(HASHES_R[n], HASHES[n], `ch${n} hash is untouched by the ch3 repair`);

    const afterRepair = sweepTwoRoundConfirmed(BOOK, CHAPTERS_R);
    assert.equal(afterRepair.ok, false, "only ch3 lost its clears, so the book is no longer confirmed");
    assert.match(afterRepair.reason ?? "", /ch3\b/, "the blocker names ch3");
    assert.doesNotMatch(afterRepair.reason ?? "", /ch1\b|ch2\b|ch4\b|ch5\b/, "untouched chapters are NOT re-flagged (they kept their clears)");

    // One clean read over the repaired book grants ch3 its first clear; still short of two.
    appendSweepHistory(rec({ roundId: "r3", at: "2026-02-03T00:00:00.000Z", hashes: HASHES_R }));
    assert.equal(sweepTwoRoundConfirmed(BOOK, CHAPTERS_R).ok, false, "ch3 has one clear at the new hash — needs a second independent read");

    // Untouched chapters were never re-cleared from scratch: their clears still carry rounds r1 & r2.
    const ledger = buildChapterClearLedger(BOOK);
    const ch1Rounds = new Set(ledger.clears.filter((c) => c.chapterNumber === 1 && c.contentHash === HASHES["1"]).map((c) => c.roundId));
    assert.ok(ch1Rounds.has("r1") && ch1Rounds.has("r2"), "ch1 still carries its pre-repair clears (r1, r2) — no re-clear from scratch");

    // A second independent clean read over the repaired book confirms.
    appendSweepHistory(rec({ roundId: "r4", at: "2026-02-04T00:00:00.000Z", hashes: HASHES_R }));
    assert.equal(sweepTwoRoundConfirmed(BOOK, CHAPTERS_R).ok, true, "ch3 now has two independent clears at the new hash → publish-ready");
  } finally {
    reset();
  }
});

// ── (c) new corroborated finding on UNCHANGED ch5 → ch5 blocked despite prior clears ─────────────
test("P09 (c): a corroborated gate on an UNCHANGED chapter blocks it despite earlier clears", () => {
  reset();
  try {
    appendSweepHistory(rec({ roundId: "r1", at: "2026-02-01T00:00:00.000Z" })); // clears ch5
    appendSweepHistory(rec({ roundId: "r2", at: "2026-02-02T00:00:00.000Z" })); // clears ch5 → ch5 has two clears
    assert.equal(sweepTwoRoundConfirmed(BOOK, CHAPTERS).ok, true, "ch5 (and all chapters) confirmed after two clean reads");

    // Two later INDEPENDENT reads agree ch5 is gated over the SAME (unchanged) bytes → corroborated.
    appendSweepHistory(rec({ roundId: "r3", at: "2026-02-03T00:00:00.000Z", gate: [5] }));
    appendSweepHistory(rec({ roundId: "r4", at: "2026-02-04T00:00:00.000Z", gate: [5] }));
    const decision = sweepTwoRoundConfirmed(BOOK, CHAPTERS);
    assert.equal(decision.ok, false, "a corroborated real gate on ch5 blocks the book even though ch5 had prior clears");
    assert.match(decision.reason ?? "", /ch5\b/, "the blocker names ch5");
    assert.doesNotMatch(decision.reason ?? "", /ch1\b|ch2\b|ch3\b|ch4\b/, "the other chapters (cleared by every read) stay clear");
  } finally {
    reset();
  }
});

// ── (d) same reviewerSessionId twice → not two independent clears ───────────────────────────────
test("P09 (d): two clears from the SAME reviewer session are one read, not two", () => {
  reset();
  try {
    appendSweepHistory(rec({ roundId: "r1", at: "2026-02-01T00:00:00.000Z", reviewerSessionId: "same-session" }));
    appendSweepHistory(rec({ roundId: "r2", at: "2026-02-02T00:00:00.000Z", reviewerSessionId: "same-session" }));
    assert.equal(sweepTwoRoundConfirmed(BOOK, CHAPTERS).ok, false, "copied/re-finalized evidence from one session is not two independent clears");
    appendSweepHistory(rec({ roundId: "r3", at: "2026-02-03T00:00:00.000Z", reviewerSessionId: "other-session" }));
    assert.equal(sweepTwoRoundConfirmed(BOOK, CHAPTERS).ok, true, "a second, genuinely independent session confirms every chapter");
  } finally {
    reset();
  }
});

// ── (e) legacy book without ledger → old whole-book semantics (equivalence + intended divergence) ─
test("P09 (e): without a ledger the gate is the UNCHANGED whole-book logic; the ledger flips it per-chapter", () => {
  reset();
  try {
    // A history where every whole-book read flags a DIFFERENT chapter (each gate uncorroborated —
    // its prior read over the same bytes did NOT gate it): the whole-book gate never sees two
    // finding-free reads, but every individual chapter accumulates ≥2 independent clears.
    appendSweepHistory(rec({ roundId: "r1", at: "2026-02-01T00:00:00.000Z" }));            // clears all
    appendSweepHistory(rec({ roundId: "r2", at: "2026-02-02T00:00:00.000Z", gate: [1] })); // clears 2..5
    appendSweepHistory(rec({ roundId: "r3", at: "2026-02-03T00:00:00.000Z", gate: [2] })); // clears 1,3,4,5
    appendSweepHistory(rec({ roundId: "r4", at: "2026-02-04T00:00:00.000Z", gate: [3] })); // clears 1,2,4,5

    // Ledger present → per-chapter: each chapter has ≥2 independent clears, no corroborated gate.
    assert.equal(hasChapterClearLedger(BOOK), true);
    assert.equal(sweepTwoRoundConfirmed(BOOK, CHAPTERS).ok, true, "per-chapter: every chapter earned two independent clears across the rotating flags");

    // Ledger absent → legacy whole-book: only r1 is a finding-free read → one clear → NOT confirmed.
    rmSync(chapterClearsPath(BOOK), { force: true });
    assert.equal(hasChapterClearLedger(BOOK), false);
    assert.equal(sweepTwoRoundConfirmed(BOOK, CHAPTERS).ok, false, "legacy whole-book: never two finding-free reads → not confirmed (old semantics preserved)");

    // Restoring the ledger restores the per-chapter verdict (the switch is purely the ledger's existence).
    writeChapterClearLedger(BOOK);
    assert.equal(sweepTwoRoundConfirmed(BOOK, CHAPTERS).ok, true, "re-materializing the ledger re-enables per-chapter carry-forward");

    // Port of the canonical whole-book cases, evaluated on the LEGACY path (ledger removed):
    reset();
    appendSweepHistory(rec({ roundId: "s1", at: "2026-03-01T00:00:00.000Z" }));
    appendSweepHistory(rec({ roundId: "s2", at: "2026-03-02T00:00:00.000Z" }));
    rmSync(chapterClearsPath(BOOK), { force: true });
    assert.equal(sweepTwoRoundConfirmed(BOOK, CHAPTERS).ok, true, "legacy: two independent clean whole-book reads over identical bytes confirm");
    assert.equal(sweepTwoRoundConfirmed(BOOK, CHAPTERS_R).ok, false, "legacy: reads over stale (pre-repair) bytes do not confirm the repaired book");
  } finally {
    reset();
  }
});
