/**
 * The write barrier must SURFACE book-wide majors that pass book-gate (no blocker)
 * but that QC finalize will REVISE on (checks.majors must be PASS) — the BP27
 * venue / F4 phrase-budget leak that cost eat-that-frog a full QC repair round
 * after a bare-"PASS" barrier handed it off. `isUnsurfacedBarrierMajor` is the
 * single predicate behind that surfacing: it must catch a non-actionable book-wide
 * major (BP27), ignore blockers and the BP28-31 re-dispatch set (those are already
 * routed as per-chapter offenders), and ignore minors — so a clean/published book
 * (zero book-wide majors) still PASSes the barrier unchanged.
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import { isUnsurfacedBarrierMajor, isWriteBarrierActionable, type BookGateFinding } from "../src/critics/bookGate.js";

const f = (catalogId: string, severity: BookGateFinding["severity"], chapters?: number[]): BookGateFinding => ({
  catalogId,
  severity,
  message: `${catalogId} fired`,
  chapters,
});

test("isUnsurfacedBarrierMajor surfaces a book-wide major (BP27 venue) the barrier would otherwise pass silently to QC", () => {
  const venue = f("BP27.venue_stamping", "major", [6, 9, 11]);
  assert.equal(isUnsurfacedBarrierMajor(venue), true);
  // BP27 is NOT in the re-dispatch set, so it would never reach the offender list —
  // it must be surfaced as a residual major instead of vanishing into a "PASS".
  assert.equal(isWriteBarrierActionable(venue), false);
});

test("isUnsurfacedBarrierMajor ignores blockers and the BP28-31 re-dispatch majors (already offender-routed)", () => {
  assert.equal(isUnsurfacedBarrierMajor(f("BP20.quiz_ngram_template_repeat", "blocker")), false);
  for (const id of [
    "BP28.callback_frame_reuse",
    "BP29.timing_anchor_stamping",
    "BP30.action_container_reuse",
    "BP31.quiz_choice_label_uniform",
  ]) {
    assert.equal(
      isUnsurfacedBarrierMajor(f(id, "major", [1, 2])),
      false,
      `${id} is write-barrier-actionable → routed as a per-chapter offender, not a residual major`,
    );
  }
});

test("isUnsurfacedBarrierMajor ignores minors, so a clean/published book (only BP26 minors) still PASSes the barrier", () => {
  assert.equal(isUnsurfacedBarrierMajor(f("BP26.exemplar_chapter_reuse", "minor", [4, 8, 12])), false);
});
