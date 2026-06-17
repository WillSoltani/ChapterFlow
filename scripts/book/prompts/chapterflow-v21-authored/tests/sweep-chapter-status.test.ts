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

function baseRec(verdict: SweepRecord["verdict"], findings: SweepRecord["findings"]): SweepRecord {
  return {
    schemaVersion: "sweep-attest-v1",
    bookId: "zz-fixture-sweep-status",
    roundId: ROUND,
    verdict,
    reviewer: "test",
    attestedAt: "2026-01-01T00:00:00.000Z",
    contentHashes: { "2": "h2", "5": "h5" },
    checkedFamilies: [],
    findings,
  };
}

test("sweepChapterStatus: a book-level REVISE only FAILS the chapters its findings name; clean unnamed chapters PASS", () => {
  const rec = baseRec("REVISE", [{ family: "persona_drift", chapters: [2], unitId: "u", quote: "q", problem: "p", expectedFix: "f" }]);
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
