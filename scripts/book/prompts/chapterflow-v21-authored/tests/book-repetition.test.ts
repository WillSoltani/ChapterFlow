/**
 * BP26/BP27 book-level repetition checks.
 */

import assert from "node:assert/strict";
import { readFileSync } from "fs";

import {
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

// Clean-corpus calibration: the new cross-chapter detectors must emit ZERO on
// shipped books. (daring-greatly + start-with-why are covered by the gold
// book-gate major-pin below.)
for (const { bookId, files } of cleanCorpusChapterFiles()) {
  if (files.length === 0) {
    skip(`clean corpus: ${bookId} BP28/BP29 stay zero`, `no ${bookId} chapters in state/chapters/ on this machine`);
    continue;
  }
  test(`clean corpus: ${bookId} — BP28 + BP29 emit ZERO findings across ${files.length} chapters`, () => {
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
  });
}

for (const { bookId, files } of goldChapterFiles()) {
  if (files.length === 0) {
    skip(`gold: ${bookId} book-gate blockers stay zero`, `no ${bookId} chapters in state/chapters/ on this machine`);
    continue;
  }

  test(`gold: ${bookId} — runBookGate emits ZERO blockers across ${files.length} chapters`, () => {
    const chapters = files.map((file) => JSON.parse(readFileSync(file, "utf8")) as ChapterV21);
    const report = quietWarn(() => runBookGate(bookId, chapters));
    const blockers = report.findings.filter((finding) => finding.severity === "blocker");
    assert.deepEqual(
      blockers.map((finding) => `${finding.catalogId}: ${finding.message.slice(0, 120)}`),
      [],
      `book-gate blocker false-positives on gold corpus`,
    );
    // Pin MAJORS too (2026-06-11 review): BP26 is minor and BP27 major, so a
    // blockers-only pin could never catch a BP27 gold false-positive.
    // Baseline at pin time: daring-greatly 0 majors; start-with-why 1 major
    // (pre-existing F4, unrelated to BP26/BP27).
    const majorBaseline: Record<string, number> = { "daring-greatly": 0, "start-with-why": 1 };
    const majors = report.findings.filter((finding) => finding.severity === "major");
    const allowed = majorBaseline[bookId];
    if (allowed !== undefined) {
      assert.ok(
        majors.length <= allowed,
        `gold majors regressed (${majors.length} > baseline ${allowed}):\n` +
          majors.map((finding) => `${finding.catalogId}: ${finding.message.slice(0, 120)}`).join("\n"),
      );
    }
  });
}
