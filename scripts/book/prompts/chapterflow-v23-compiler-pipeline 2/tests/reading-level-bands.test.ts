/**
 * P02 — reading-level bands + whole-breakdown Flesch-ease floor.
 *
 * Pins the calibrated band VALUES as spec, proves the canonical measurement is
 * the score.py-parity one (rubricMetrics.fkGrade / fleschReadingEase), and
 * covers the three behaviours the section gate relies on:
 *   1. a known-easy sample clears every tier ceiling and the ease floor;
 *   2. a grade-11 sample fails the fullRead ceiling (and, showing the tightening,
 *      would have PASSED under the old LEGACY ceiling of 12);
 *   3. the whole-breakdown ease floor fires on a hard AGGREGATE even when each
 *      individual tier passes its per-tier FK ceiling.
 *
 * Sample readability numbers are measured, not asserted-magic; see
 * scratch/calibrate-readability.ts for the catalog calibration behind the bands.
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import {
  BREAKDOWN_READING_EASE_FLOOR,
  LEGACY_TIER_TARGETS,
  TIER_TARGETS,
  checkBreakdownReadingEase,
  checkReadingLevel,
} from "../src/critics/readingLevel.js";
import { fkGrade, fleschReadingEase } from "../src/metrics/rubricMetrics.js";

// ── Samples (readability verified by rubricMetrics; see comments) ────────────

/** Plain, short sentences: FK ~1.8, whole ease ~95. Clears everything. */
const EASY = "Pay before the day the balance is read. A low balance looks careful. Make the card show the care you have.";

/** ~grade-11 prose (FK 10.9): fails the new fullRead ceiling 9.5, but is under
 *  the old LEGACY ceiling of 12 — the exact prose the tightening now catches. */
const GRADE_11 =
  "If you wait until the last day to pay down the card, the bank will look at a higher balance and may decide you are a bigger risk than you really are.";

/** Three tiers that EACH pass their per-tier FK ceiling (FK 3.97 / 6.17 / 8.08)
 *  yet concatenate to Flesch ease ~62 — below the 70 floor. This is the case
 *  per-tier ceilings alone miss and the whole-breakdown floor exists to catch. */
const AGG_FAST = "Pay before the snapshot. Lower the visible balance. Make the signal match the care you already show.";
const AGG_DEEP =
  "A card system records account information. It does not read your intent. The useful move is to reduce what the system sees before the signal travels to lenders.";
const AGG_FULL =
  "The reader-facing move is practical. Make the balance visible to yourself. Reduce avoidable utilization. Set a trigger before the reportable moment. This keeps the source idea intact without promising an exact score jump.";

// ── 1. Band values are the calibrated spec ───────────────────────────────────

test("reading-level bands: TIER_TARGETS holds the calibrated new ceilings + ease floor", () => {
  assert.equal(TIER_TARGETS.fastRead.hi, 7.0);
  assert.equal(TIER_TARGETS.deepRead.hi, 8.5);
  assert.equal(TIER_TARGETS.fullRead.hi, 9.5);
  assert.equal(BREAKDOWN_READING_EASE_FLOOR, 70);
  // canonical measurement is the score.py-parity function, not the legacy counter
  assert.equal(TIER_TARGETS.measure, fkGrade, "section-gate ceilings must measure with rubricMetrics.fkGrade");
});

test("reading-level bands: ceilings only ever TIGHTEN vs the legacy frozen set", () => {
  assert.ok(TIER_TARGETS.fastRead.hi <= LEGACY_TIER_TARGETS.fastRead.hi);
  assert.ok(TIER_TARGETS.deepRead.hi <= LEGACY_TIER_TARGETS.deepRead.hi);
  assert.ok(TIER_TARGETS.fullRead.hi <= LEGACY_TIER_TARGETS.fullRead.hi);
  // and at least one is strictly tighter (this is a tightening, not a no-op)
  assert.ok(
    TIER_TARGETS.deepRead.hi < LEGACY_TIER_TARGETS.deepRead.hi ||
      TIER_TARGETS.fullRead.hi < LEGACY_TIER_TARGETS.fullRead.hi,
  );
});

// ── 2. Known-easy sample passes ──────────────────────────────────────────────

test("reading-level bands: a known-easy sample clears every tier ceiling and the ease floor", () => {
  assert.ok(fkGrade(EASY) <= TIER_TARGETS.fastRead.hi, `easy FK ${fkGrade(EASY)}`);
  for (const tier of ["fastRead", "deepRead", "fullRead"] as const) {
    assert.deepEqual(
      checkReadingLevel(EASY, tier).filter((f) => f.checkId === "prose.reading_level"),
      [],
      `easy sample must not trip the ${tier} ceiling`,
    );
  }
  assert.deepEqual(checkBreakdownReadingEase([EASY, EASY, EASY].join("\n\n")), []);
});

// ── 3. Grade-11 sample fails fullRead (and shows the tightening) ─────────────

test("reading-level bands: a grade-11 sample fails the fullRead ceiling", () => {
  assert.ok(fkGrade(GRADE_11) > TIER_TARGETS.fullRead.hi, `grade-11 FK ${fkGrade(GRADE_11)} should exceed 9.5`);
  const findings = checkReadingLevel(GRADE_11, "fullRead");
  assert.ok(
    findings.some((f) => f.checkId === "prose.reading_level" && f.severity === "major"),
    `expected a prose.reading_level finding, got ${findings.map((f) => f.checkId).join(", ") || "none"}`,
  );
});

test("reading-level bands: the grade-11 sample would have PASSED the old legacy ceiling", () => {
  // Same prose, legacy fullRead ceiling 12 (measured with the legacy counter):
  // no finding. This is precisely the prose the P02 tightening now catches.
  assert.deepEqual(checkReadingLevel(GRADE_11, "fullRead", LEGACY_TIER_TARGETS), []);
});

test("reading-level bands: the mislabeled finding id is fixed (prose.reading_level, not register.no_meta_reference)", () => {
  const findings = checkReadingLevel(GRADE_11, "fullRead");
  assert.ok(findings.length > 0);
  for (const f of findings) {
    assert.notEqual(f.checkId, "register.no_meta_reference", "finding must no longer borrow the meta-reference id");
    assert.equal(f.checkId, "prose.reading_level");
  }
});

// ── 4. Whole-breakdown floor fires on a hard aggregate even when tiers pass ──

test("reading-level bands: whole-breakdown ease floor fires even when every tier passes its FK ceiling", () => {
  // Each tier individually clears its per-tier ceiling …
  assert.deepEqual(checkReadingLevel(AGG_FAST, "fastRead").filter((f) => f.checkId === "prose.reading_level"), []);
  assert.deepEqual(checkReadingLevel(AGG_DEEP, "deepRead").filter((f) => f.checkId === "prose.reading_level"), []);
  assert.deepEqual(checkReadingLevel(AGG_FULL, "fullRead").filter((f) => f.checkId === "prose.reading_level"), []);

  // … but the assembled breakdown reads below the ease floor.
  const assembled = [AGG_FAST, AGG_DEEP, AGG_FULL].join("\n\n");
  assert.ok(fleschReadingEase(assembled) < BREAKDOWN_READING_EASE_FLOOR, `aggregate ease ${fleschReadingEase(assembled)}`);
  const findings = checkBreakdownReadingEase(assembled);
  assert.ok(
    findings.some((f) => f.checkId === "prose.reading_ease" && f.severity === "major"),
    `expected a prose.reading_ease finding, got ${findings.map((f) => f.checkId).join(", ") || "none"}`,
  );
});
