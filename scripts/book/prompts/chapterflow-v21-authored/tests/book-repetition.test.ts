/**
 * BP26/BP27 book-level repetition checks.
 */

import assert from "node:assert/strict";
import { readFileSync } from "fs";

import { checkBookExemplarChapterReuse, checkBookVenueStamping } from "../src/critics/bookRepetition.js";
import { runBookGate } from "../src/critics/bookGate.js";
import type { ChapterV21 } from "../src/types.js";
import { skip, test } from "./harness.js";
import { goldChapterFiles, makeChapter } from "./helpers.js";

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
