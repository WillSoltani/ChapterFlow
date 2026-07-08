/**
 * Manual-brief always-on rotation + deal↔practice-shape consistency (F-07/F-08).
 *
 * Manual-brief books (~113/119) skip the whole compiled VARIETY block, so campaign
 * 2's architecture-family deal never reached them. These pins prove the two
 * low-dependency levers now render always-on from the same source of truth as the
 * machine-brief deal, deterministically, and that the content-device deal and the
 * practice rotation never contradict each other.
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import {
  ARCHITECTURE_FAMILIES,
  PRACTICE_SHAPES,
  type PracticeShape,
  dealArchitectureFamilies,
  dealPracticeShapes,
  dealManualBriefRotation,
  dealBriefRotations,
  manualBriefRotationLines,
  practiceShapesForChapter,
  PRACTICE_SHAPE_EMBODIES,
} from "../src/compiler/briefRotation.js";
import { dealContentDeviceBans, type ContentDeviceId } from "../src/compiler/contentDeviceDeal.js";

// ── the lean helpers ARE the same deal as dealBriefRotations (one SoT) ──────────
test("manual-brief rotation: the lean architecture/practice helpers equal dealBriefRotations exactly (byte-identical deal)", () => {
  const bookId = "zz-manual-sot";
  const N = 14;
  const full = dealBriefRotations(bookId, N);
  const archs = dealArchitectureFamilies(bookId, N);
  const shapes = dealPracticeShapes(bookId, N);
  for (let ch = 1; ch <= N; ch++) {
    assert.equal(archs[ch - 1], full.get(ch)!.architectureFamily, `ch${ch}: architecture family matches the compiled deal`);
    assert.equal(shapes[ch - 1], full.get(ch)!.practiceShape, `ch${ch}: practice shape matches the compiled deal`);
  }
});

// ── the always-on card lines ────────────────────────────────────────────────────
test("manual-brief rotation: renders an architecture + practice line at book scale, nothing below", () => {
  const lines = manualBriefRotationLines("zz-manual", 3, 14);
  assert.equal(lines.length, 3, "header + architecture line + practice line");
  assert.ok(lines[0].includes("CHAPTER SHAPE"), "section header present");
  assert.match(lines[1], /^Architecture — [a-z-]+: /, "architecture-family line names the family and its instruction");
  assert.match(lines[2], /^Practice — Shape tryThisNow/, "practice line renders the shape instruction");
  assert.deepEqual(manualBriefRotationLines("zz-manual", 3, 3), [], "no render below book scale (N < 4)");
});

test("manual-brief rotation: deterministic per (bookId, chapterNumber, totalChapters); differs across chapters", () => {
  assert.deepEqual(
    manualBriefRotationLines("zz-manual", 5, 14),
    manualBriefRotationLines("zz-manual", 5, 14),
    "same inputs → identical lines (stable across re-runs and --only retries)",
  );
  // The whole-book architecture deal spreads under a two-thirds cap → not one family
  // on every chapter.
  const families = new Set(Array.from({ length: 14 }, (_, i) => dealManualBriefRotation("zz-manual", i + 1, 14).architectureFamily));
  assert.ok(families.size >= 3, "the architecture family varies across the book (not a monoculture)");
});

// ── deal ↔ practice-shape consistency ──────────────────────────────────────────
test("consistency: a device banned in a chapter never co-occurs with a practice shape that embodies it (real pool → holds by construction)", () => {
  // The production embodiment map is empty (the calendar-cadence practice-shell
  // device is orthogonal to every shape descriptor), so the invariant holds for every
  // chapter — a real regression guard if a calendar shape is ever added.
  for (let ch = 1; ch <= 14; ch++) {
    const { practiceShape } = dealManualBriefRotation("zz-manual", ch, 14);
    const banned = new Set<ContentDeviceId>(dealContentDeviceBans(ch, 14));
    const embodied = PRACTICE_SHAPE_EMBODIES[practiceShape];
    assert.ok(
      embodied === undefined || !banned.has(embodied),
      `ch${ch}: dealt shape ${practiceShape} must not embody a banned device`,
    );
  }
});

test("consistency: the filter MECHANISM substitutes an embodying shape away from a banned device (synthetic overlap)", () => {
  const bookId = "zz-filter";
  const ch = 1;
  const banned = dealContentDeviceBans(ch, 14); // 3 devices banned this chapter
  const dealt = dealPracticeShapes(bookId, 14)[ch - 1];
  // Map the chapter's DEALT shape onto a device it BANS → the filter must move off it.
  const embodies: Partial<Record<PracticeShape, ContentDeviceId>> = { [dealt]: banned[0] };
  const excluded = practiceShapesForChapter(ch, 14, embodies);
  assert.ok(!excluded.includes(dealt), "the embodying shape is filtered out of the allowed pool");
  const { practiceShape } = dealManualBriefRotation(bookId, ch, 14, embodies);
  assert.notEqual(practiceShape, dealt, "the resolved shape is substituted away from the banned device");
  assert.ok(embodies[practiceShape] === undefined, "the substitute does not embody a banned device");
  // Nothing dropped when there is no overlap.
  assert.deepEqual(practiceShapesForChapter(ch, 14, {}), [...PRACTICE_SHAPES], "empty embodiment map excludes nothing");
});

test("sanity: the deal pools are the campaign-2 pools (8 architecture families, 6 practice shapes)", () => {
  assert.equal(ARCHITECTURE_FAMILIES.length, 8);
  assert.equal(PRACTICE_SHAPES.length, 6);
});
