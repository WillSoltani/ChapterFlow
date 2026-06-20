/**
 * sweepChapterStatus — a book-level sweep VERDICT must not tar clean chapters. A
 * REVISE/CORRUPTION only FAILS the chapters its findings actually NAME; an unnamed,
 * hash-matching chapter PASSES instead of stranding in the "[re-QC only]" bucket (the
 * round-1 digital-minimalism confusion). A non-PASS verdict naming nothing fails closed.
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import { sweepChapterStatus, type SweepRecord } from "../src/qc/sweep.js";

const ROUND = "r-sweep-status";

// A finding for a fixture; severity defaults to "blocker" (a gating finding) unless given.
type FindingInput = Omit<SweepRecord["findings"][number], "severity"> & { severity?: "blocker" | "advisory" };

function baseRec(verdict: SweepRecord["verdict"], findings: FindingInput[]): SweepRecord {
  return {
    schemaVersion: "sweep-attest-v1",
    bookId: "zz-fixture-sweep-status",
    roundId: ROUND,
    verdict,
    reviewer: "test",
    attestedAt: "2026-01-01T00:00:00.000Z",
    contentHashes: { "2": "h2", "5": "h5" },
    checkedFamilies: [],
    findings: findings.map((f) => ({ severity: "blocker" as const, ...f })),
  };
}

const F = (chapters: number[], severity: "blocker" | "advisory"): FindingInput => ({
  family: "persona_drift",
  severity,
  chapters,
  unitId: "u",
  quote: "q",
  problem: "p",
  expectedFix: "f",
});

test("sweepChapterStatus: a book-level REVISE only FAILS the chapters its findings name; clean unnamed chapters PASS", () => {
  const rec = baseRec("REVISE", [F([2], "blocker")]);
  assert.equal(sweepChapterStatus(rec, 2, "h2", ROUND), "FAIL", "the named chapter fails");
  assert.equal(sweepChapterStatus(rec, 5, "h5", ROUND), "PASS", "an unnamed, clean chapter must NOT be stranded by a global verdict");
});

test("sweepChapterStatus: PASS verdict passes; a moved hash is STALE; another round / null is MISSING", () => {
  const pass = baseRec("PASS", []);
  assert.equal(sweepChapterStatus(pass, 5, "h5", ROUND), "PASS");
  assert.equal(sweepChapterStatus(pass, 5, "moved", ROUND), "STALE");
  assert.equal(sweepChapterStatus(pass, 5, "h5", "other-round"), "MISSING");
  assert.equal(sweepChapterStatus(null, 5, "h5", ROUND), "MISSING");
});

test("sweepChapterStatus: a non-PASS verdict whose findings name NO chapters fails CLOSED", () => {
  const rec = baseRec("REVISE", []);
  assert.equal(sweepChapterStatus(rec, 5, "h5", ROUND), "FAIL", "an unexplained REVISE must still block, not silently pass every chapter");
});

test("sweepChapterStatus: an ADVISORY-only finding naming a chapter does NOT fail it (bug #2 fix)", () => {
  // A REVISE carrying one advisory observation on ch2 + one real blocker on ch5: ch2 must
  // stay PASS (advisory is surfaced, never gating), ch5 still FAILs. Pre-fix, ch2 FAILed.
  const rec = baseRec("REVISE", [F([2], "advisory"), F([5], "blocker")]);
  assert.equal(sweepChapterStatus(rec, 2, "h2", ROUND), "PASS", "an advisory-only chapter is not gated");
  assert.equal(sweepChapterStatus(rec, 5, "h5", ROUND), "FAIL", "a blocker still FAILs its chapter");
});

test("sweepChapterStatus: an ALL-advisory REVISE fails CLOSED for every chapter (no blocker explains the verdict)", () => {
  const rec = baseRec("REVISE", [F([2], "advisory")]);
  assert.equal(sweepChapterStatus(rec, 2, "h2", ROUND), "FAIL", "an advisory does not explain a REVISE at blocker level — fail closed");
  assert.equal(sweepChapterStatus(rec, 5, "h5", ROUND), "FAIL", "and every other chapter fails closed too");
});

test("sweepChapterStatus: a legacy record finding with NO severity is treated as a blocker (fail-closed)", () => {
  // Records written before the `severity` field omit it; a chapter they name must still FAIL.
  const legacy = baseRec("REVISE", []);
  legacy.findings = [{ family: "persona_drift", chapters: [2], unitId: "u", quote: "q", problem: "p", expectedFix: "f" } as SweepRecord["findings"][number]];
  assert.equal(sweepChapterStatus(legacy, 2, "h2", ROUND), "FAIL", "an absent severity is fail-closed (blocking)");
});
