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
    reviewerSessionId: `session-${ROUND}`,
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

test("sweepChapterStatus: an ALL-advisory REVISE does NOT block any chapter (bug #2 — sweep ≤ publish gate)", () => {
  // The sweep must not be a STRICTER gate than the publish decision it feeds (which ignores
  // advisory/minor). A REVISE carrying only advisory observations is surfaced but gates nothing
  // — the convergence fix: a single minor templating echo can no longer demote the whole book.
  const rec = baseRec("REVISE", [F([2], "advisory"), F([5], "advisory")]);
  assert.equal(sweepChapterStatus(rec, 2, "h2", ROUND), "PASS", "an advisory-cited REVISE does not gate the named chapter");
  assert.equal(sweepChapterStatus(rec, 5, "h5", ROUND), "PASS", "nor any other chapter");
});

test("sweepChapterStatus: a CORRUPTION with no cited blocker STILL fails closed (serious-but-uncited)", () => {
  // CORRUPTION is the most serious verdict; if the reviewer claims it but cites no blocker, we
  // never silently ship — every chapter fails closed. (Only the all-advisory REVISE relaxes.)
  const rec = baseRec("CORRUPTION", [F([2], "advisory")]);
  assert.equal(sweepChapterStatus(rec, 2, "h2", ROUND), "FAIL", "an uncited CORRUPTION fails closed");
  assert.equal(sweepChapterStatus(rec, 5, "h5", ROUND), "FAIL", "for every chapter");
});

test("sweepChapterStatus: a legacy record finding with NO severity is treated as a blocker (fail-closed)", () => {
  // Records written before the `severity` field omit it; a chapter they name must still FAIL.
  const legacy = baseRec("REVISE", []);
  legacy.findings = [{ family: "persona_drift", chapters: [2], unitId: "u", quote: "q", problem: "p", expectedFix: "f" } as SweepRecord["findings"][number]];
  assert.equal(sweepChapterStatus(legacy, 2, "h2", ROUND), "FAIL", "an absent severity is fail-closed (blocking)");
});

// A finding with an explicit family + quote (the distinctiveness-guard fixtures).
const FQ = (family: SweepRecord["findings"][number]["family"], quote: string, chapters: number[], severity: "blocker" | "advisory" = "blocker"): FindingInput => ({
  family,
  severity,
  chapters,
  unitId: "u",
  quote,
  problem: "p",
  expectedFix: "f",
});

function priorRec(rec: SweepRecord, reviewerSessionId = "session-prior"): SweepRecord {
  return { ...rec, roundId: "r-prior-sweep-status", reviewerSessionId };
}

test("sweepChapterStatus: a repeated_unit BLOCKER anchored on a non-distinctive quote ('had already') does NOT gate (the-undoing-project regression)", () => {
  // r20260620130507-d0c017: three blocker repeated_unit findings quoting the tense auxiliaries
  // 'had already' / 'has already' / 'was already' demoted 7/12 -> 1/12. A 2-word common phrase
  // cannot prove distinctive reuse, so it is surfaced but never gates the chapters it names.
  const rec = baseRec("REVISE", [FQ("repeated_unit", "had already", [2, 5], "blocker")]);
  assert.equal(sweepChapterStatus(rec, 2, "h2", ROUND), "PASS", "a non-distinctive repetition quote must not demote a named chapter");
  assert.equal(sweepChapterStatus(rec, 5, "h5", ROUND), "PASS", "nor any other chapter it names");
});

test("sweepChapterStatus: a repeated_unit BLOCKER on a DISTINCTIVE (>=20 char) quote STILL gates (non-vacuous — real templating blocks)", () => {
  // The guard rejects ONLY non-distinctive anchors. A genuine copy-pasted unit (a real templating
  // defect) is long enough to discriminate and must still FAIL its chapters.
  const rec = baseRec("REVISE", [FQ("repeated_unit", "she sees the error halfway through the meeting", [2], "blocker")]);
  assert.equal(sweepChapterStatus(rec, 2, "h2", ROUND), "FAIL", "a distinctive reused unit still gates");
  assert.equal(sweepChapterStatus(rec, 5, "h5", ROUND), "PASS", "an unnamed clean chapter still passes");
});

test("sweepChapterStatus: scene_skeleton follows the same distinctiveness rule; persona_drift / location_stamping are unaffected (short names/venues are legitimate)", () => {
  assert.equal(sweepChapterStatus(baseRec("REVISE", [FQ("scene_skeleton", "was already", [2, 5], "blocker")]), 2, "h2", ROUND), "PASS", "non-distinctive cross-chapter scene_skeleton does not gate");
  assert.equal(sweepChapterStatus(baseRec("REVISE", [FQ("scene_skeleton", "opens at the desk with the clock ticking past the deadline", [2], "blocker")]), 2, "h2", ROUND), "FAIL", "distinctive scene_skeleton still gates");
  // Scope guard: persona_drift (a reused NAME) and location_stamping (a reused VENUE) legitimately
  // carry short quotes — the distinctiveness rule must NOT touch them.
  assert.equal(sweepChapterStatus(baseRec("REVISE", [FQ("persona_drift", "Genevieve", [2], "blocker")]), 2, "h2", ROUND), "FAIL", "a short persona_drift quote still gates");
  assert.equal(sweepChapterStatus(baseRec("REVISE", [FQ("location_stamping", "the dock", [2], "blocker")]), 2, "h2", ROUND), "FAIL", "a short location_stamping quote still gates");
  // A SINGLE-chapter finding is a local defect, not a cross-chapter reuse claim — its quote length is
  // irrelevant, so it still gates (the sweep's repeated_unit DEFAULT bucket must not swallow a real
  // single-chapter quiz/behavioral finding with a short quote).
  assert.equal(sweepChapterStatus(baseRec("REVISE", [FQ("repeated_unit", "A labelled choice.", [2], "blocker")]), 2, "h2", ROUND), "FAIL", "a single-chapter short-quote finding still gates");
});

// ── Mechanism 1 — sticky per-chapter carry / cross-round corroboration ────────────────────────
// A single stochastic sweep read must not FAIL a chapter whose bytes never moved when the prior
// round did NOT gate it (the proven cross-chapter-sweep non-determinism). The `prior` arg is
// injected here so these stay pure (no disk).
test("Mechanism 1: an UNCORROBORATED gate on byte-frozen content (prior PASSed it) is DEMOTED to PASS", () => {
  const cur = baseRec("REVISE", [F([2], "blocker")]);
  const priorClear = baseRec("PASS", []); // PASS → recordGatesChapter(prior,2) = false; contentHashes {2:h2} match
  assert.equal(sweepChapterStatus(cur, 2, "h2", ROUND, priorClear), "PASS", "an uncorroborated upward flip on frozen content must not gate");
});

test("Mechanism 1: a CORROBORATED gate (prior ALSO gated the chapter) STILL FAILs over frozen content", () => {
  const cur = baseRec("REVISE", [F([2], "blocker")]);
  const priorGated = priorRec(baseRec("REVISE", [F([2], "blocker")])); // same defect, different session → corroborated
  assert.equal(sweepChapterStatus(cur, 2, "h2", ROUND, priorGated), "FAIL", "two independent reads agreeing on a gate must block");
});

test("Mechanism 1: a prior persona defect does NOT corroborate a current unrelated location defect on frozen content", () => {
  const cur = baseRec("REVISE", [FQ("location_stamping", "the dock", [2], "blocker")]);
  const priorDifferentDefect = priorRec(baseRec("REVISE", [FQ("persona_drift", "Genevieve", [2], "blocker")]));
  assert.equal(sweepChapterStatus(cur, 2, "h2", ROUND, priorDifferentDefect), "PASS", "corroboration requires the same grounded defect, not just the same chapter");
});

test("Mechanism 1: the same submission copied into two rounds does NOT count as two independent reads", () => {
  const cur = baseRec("REVISE", [F([2], "blocker")]);
  const copiedPrior = priorRec(baseRec("REVISE", [F([2], "blocker")]), cur.reviewerSessionId);
  assert.equal(sweepChapterStatus(cur, 2, "h2", ROUND, copiedPrior), "PASS", "same reviewer session cannot corroborate itself");
});

test("Mechanism 1: when the chapter's CONTENT CHANGED since the prior round, a fresh single read is trusted (gate stands)", () => {
  const cur = baseRec("REVISE", [F([2], "blocker")]);
  const priorOtherContent = baseRec("PASS", []);
  priorOtherContent.contentHashes = { "2": "h2-OLD", "5": "h5" }; // ch2 moved since prior → not frozen
  assert.equal(sweepChapterStatus(cur, 2, "h2", ROUND, priorOtherContent), "FAIL", "a gate on freshly-changed content is not a flip — it stands on one read");
});

test("Mechanism 1: with NO prior round the gate stands (fail-safe = today's behavior)", () => {
  const cur = baseRec("REVISE", [F([2], "blocker")]);
  assert.equal(sweepChapterStatus(cur, 2, "h2", ROUND, null), "FAIL", "no prior corroboration data ⇒ gate, never silently pass");
});

test("Mechanism 1: a CORRUPTION verdict is NEVER demoted, even on byte-frozen content the prior PASSed (parity with checkSweep)", () => {
  // Corroboration suppresses only stochastic REVISE flips. A CORRUPTION must always FAIL — else the
  // per-chapter gate (PASS) would diverge from checkSweep (which keeps an unconditional CORRUPTION block).
  const cur = baseRec("CORRUPTION", [F([2], "blocker")]);
  const priorClear = baseRec("PASS", []);
  assert.equal(sweepChapterStatus(cur, 2, "h2", ROUND, priorClear), "FAIL", "CORRUPTION is never demoted by corroboration");
});
