/**
 * BP26/BP27 book-level repetition checks.
 */

import assert from "node:assert/strict";
import { readFileSync } from "fs";

import {
  checkBookActionContainerReuse,
  checkBookCallbackFrameReuse,
  checkBookExemplarChapterReuse,
  checkBookTimingAnchorStamping,
  checkBookVenueStamping,
} from "../src/critics/bookRepetition.js";
import { runBookGate } from "../src/critics/bookGate.js";
import type { ChapterV21 } from "../src/types.js";
import { skip, test } from "./harness.js";
import { cleanCorpusChapterFiles, goldChapterFiles, makeChapter } from "./helpers.js";

function quietWarn<T>(fn: () => T): T {
  const oldWarn = console.warn;
  console.warn = () => {};
  try {
    return fn();
  } finally {
    console.warn = oldWarn;
  }
}

test("BP26 fires when the same marquee proper noun anchors multiple chapters", () => {
  const book = "zz-fixture-bp26";
  const ch1 = makeChapter(book, 1);
  const ch2 = makeChapter(book, 2);
  ch1.breakdown.fastRead += " Marie Curie turns the laboratory result into the teaching case.";
  ch2.examples[0].scenario =
    "Marie Curie stands in the example as the repeated teaching case. The chapter should have used a different source figure for its scene.";
  const findings = quietWarn(() => checkBookExemplarChapterReuse(book, [ch1, ch2]));
  assert.ok(findings.some((f) => f.checkId === "BP26.exemplar_chapter_reuse" && f.severity === "minor"), JSON.stringify(findings));
});

test("BP27 fires when one venue appears as an example setting in more than two chapters", () => {
  const book = "zz-fixture-bp27";
  const chapters = [1, 2, 3].map((n) => {
    const ch = makeChapter(book, n);
    ch.examples[0].scenario =
      `At the kitchen table, the team treats the same setting as if it were new in chapter ${n}. The repeated place is the point of this fixture.`;
    return ch;
  });
  const findings = checkBookVenueStamping(chapters);
  assert.ok(findings.some((f) => f.checkId === "BP27.venue_stamping" && f.severity === "major"), JSON.stringify(findings));
});

test("BP28 fires when review-card callback fronts reuse one concept+frame across ≥40% of chapters", () => {
  const book = "zz-fixture-bp28";
  const objects = ["Mondays", "Tuesdays", "Deadlines", "Meetings", "Reviews"];
  const chapters = [1, 2, 3, 4, 5].map((n) => {
    const ch = makeChapter(book, n);
    // Same concept ("control filter") + same question shell, only the object
    // swapped — the-daily-stoic's repeated_unit defect. The object is a proper
    // noun, so normalizeSurfaceFrame strips it and the shared frame surfaces.
    ch.reviewCards[0].front = `How does the control filter help with ${objects[n - 1]}?`;
    return ch;
  });
  const findings = checkBookCallbackFrameReuse(chapters);
  assert.ok(
    findings.some((f) => f.checkId === "BP28.callback_frame_reuse" && f.chapters.length >= 4),
    JSON.stringify(findings),
  );
});

test("BP29 fires when try-now actions reuse one clock stamp across >2 chapters", () => {
  const book = "zz-fixture-bp29";
  const chapters = [1, 2, 3, 4, 5].map((n) => {
    const ch = makeChapter(book, n);
    // ch1/3/5 reuse the same arbitrary clock stamp (the-daily-stoic's 9:10 a.m.
    // location_stamping). Mixed forms ("9:10 a.m." vs "9:10am") normalize equal.
    if (n === 1) ch.tryThisNow = "Tomorrow at 9:10 a.m., run the assent test at your desk.";
    if (n === 3) ch.tryThisNow = "Add a 9:10am check to tomorrow's calendar at the kitchen counter.";
    if (n === 5) ch.tryThisNow = "Schedule a kindness check for tomorrow at 9:10 a.m. at your desk.";
    return ch;
  });
  const findings = checkBookTimingAnchorStamping(chapters);
  assert.ok(
    findings.some((f) => f.checkId === "BP29.timing_anchor_stamping" && f.chapters.length >= 3 && f.evidence === "9:10am"),
    JSON.stringify(findings),
  );
});

test("BP29 does not fire on situational (clock-free) try-now actions", () => {
  const book = "zz-fixture-bp29-clean";
  const chapters = [1, 2, 3, 4].map((n) => makeChapter(book, n)); // default tryThisNow has no clock
  assert.deepEqual(checkBookTimingAnchorStamping(chapters), []);
});

test("BP30 fires when the timer/calendar container saturates >=50% of chapters", () => {
  const book = "zz-fixture-bp30";
  // 7 of 8 chapters funnel the action into a timer/calendar container (0.875),
  // even though the surrounding action differs — the-daily-stoic's migrated
  // location_stamping (the container, not the clock).
  const chapters = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => {
    const ch = makeChapter(book, n);
    if (n !== 4) ch.tryThisNow = `Set a 10-minute timer before you handle situation ${n}.`;
    return ch;
  });
  const findings = checkBookActionContainerReuse(chapters);
  assert.ok(
    findings.some((f) => f.checkId === "BP30.action_container_reuse" && f.chapters.length >= 4),
    JSON.stringify(findings),
  );
});

test("BP30 does NOT count NEGATED container mentions (the actionMechanismPlan prevention copy)", () => {
  const book = "zz-fixture-bp30-negation";
  // Every chapter echoes the prevention directive's negation ("not a timer / NOT a
  // calendar event") but the actual action is a non-scheduling one. BP30 must read
  // these as zero container use, not a saturating reuse.
  const chapters = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => {
    const ch = makeChapter(book, n);
    ch.tryThisNow = `Write one line about today — NOT a timer or calendar event, just the sentence.`;
    return ch;
  });
  assert.deepEqual(checkBookActionContainerReuse(chapters), []);
});

test("BP30 does NOT fire when the timer/calendar container is sparse (one scheduling chapter)", () => {
  const book = "zz-fixture-bp30-clean";
  // Only ch2 uses a timer (the one scheduling chapter); the rest are varied
  // situational actions. 1/8 = 0.125, well under the 0.50 density floor.
  const chapters = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => {
    const ch = makeChapter(book, n);
    if (n === 2) ch.tryThisNow = "Set a 5-minute timer and free-write what you are avoiding.";
    return ch;
  });
  assert.deepEqual(checkBookActionContainerReuse(chapters), []);
});

// Clean-corpus calibration: the new cross-chapter detectors must emit ZERO on
// shipped books. (daring-greatly + start-with-why are covered by the gold
// book-gate major-pin below.)
for (const { bookId, files } of cleanCorpusChapterFiles()) {
  if (files.length === 0) {
    skip(`clean corpus: ${bookId} BP28/BP29 stay zero`, `no ${bookId} chapters in state/chapters/ on this machine`);
    continue;
  }
  test(`clean corpus: ${bookId} — BP28 + BP29 + BP30 emit ZERO findings across ${files.length} chapters`, () => {
    const chapters = files.map((file) => JSON.parse(readFileSync(file, "utf8")) as ChapterV21);
    assert.deepEqual(
      checkBookCallbackFrameReuse(chapters).map((f) => `${f.evidence} → ${f.chapters.join(",")}`),
      [],
      `BP28 callback-frame false-positive on ${bookId}`,
    );
    assert.deepEqual(
      checkBookTimingAnchorStamping(chapters).map((f) => `${f.evidence} → ${f.chapters.join(",")}`),
      [],
      `BP29 timing-stamp false-positive on ${bookId}`,
    );
    assert.deepEqual(
      checkBookActionContainerReuse(chapters).map((f) => `${f.evidence} → ${f.chapters.join(",")}`),
      [],
      `BP30 action-container false-positive on ${bookId}`,
    );
  });
}

for (const { bookId, files, stateDir } of goldChapterFiles()) {
  if (files.length === 0) {
    skip(`gold: ${bookId} book-gate blockers stay zero`, `synthetic corpus did not generate files`);
    continue;
  }

  test(`gold: ${bookId} — runBookGate emits ZERO blockers across ${files.length} chapters`, () => {
    const chapters = files.map((file) => JSON.parse(readFileSync(file, "utf8")) as ChapterV21);
    const report = quietWarn(() => runBookGate(bookId, chapters, { stateDir }));
    const blockers = report.findings.filter((finding) => finding.severity === "blocker");
    assert.deepEqual(
      blockers.map((finding) => `${finding.catalogId}: ${finding.message.slice(0, 120)}`),
      [],
      `book-gate blocker false-positives on gold corpus`,
    );
    // Pin MAJORS too: BP26 is minor and BP27 major, so a blockers-only pin
    // could never catch a BP27 clean-corpus false-positive.
    const majors = report.findings.filter((finding) => finding.severity === "major");
    assert.deepEqual(
      majors.map((finding) => `${finding.catalogId}: ${finding.message.slice(0, 120)}`),
      [],
      `gold majors regressed:\n${majors.map((finding) => `${finding.catalogId}: ${finding.message.slice(0, 120)}`).join("\n")}`,
    );
  });
}
