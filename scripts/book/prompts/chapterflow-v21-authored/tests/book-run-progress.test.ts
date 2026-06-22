/**
 * book-run progress reporting — the two user-facing bits of logic the live wrapper adds:
 * the MIDDLE chapter selection (printed for review at end of a run) and the per-chapter QC
 * verdict line. Both are pure helpers in liveRun.ts so they can be unit-tested without a run.
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import { middleChapterNumber, formatChapterVerdicts } from "../src/orchestrator/liveRun.js";

test("middleChapterNumber: ceil(N/2) — odd picks the true center, even picks the lower-middle", () => {
  assert.equal(middleChapterNumber(11), 6, "11 chapters → ch6 (5 before, 5 after)");
  assert.equal(middleChapterNumber(10), 5, "10 chapters → ch5");
  assert.equal(middleChapterNumber(13), 7);
  assert.equal(middleChapterNumber(1), 1, "a single chapter is its own middle");
  assert.equal(middleChapterNumber(2), 1);
  // Defensive: never index below 1 even on a degenerate count.
  assert.equal(middleChapterNumber(0), 1);
});

test("formatChapterVerdicts: sorts by chapter, marks PUBLISHABLE with ✓, names other verdicts", () => {
  const out = formatChapterVerdicts([
    { chapterNumber: 3, finalVerdict: "REVISE" },
    { chapterNumber: 1, finalVerdict: "PUBLISHABLE" },
    { chapterNumber: 2, finalVerdict: "PUBLISHABLE" },
  ]);
  assert.equal(out, "ch1 ✓ · ch2 ✓ · ch3 REVISE", "sorted ascending; ✓ for publishable; verdict named otherwise");
});

test("formatChapterVerdicts: an all-clear book renders all ✓; missing verdict → UNKNOWN; empty → ''", () => {
  assert.equal(
    formatChapterVerdicts([{ chapterNumber: 1, finalVerdict: "PUBLISHABLE" }, { chapterNumber: 2, finalVerdict: "PUBLISHABLE" }]),
    "ch1 ✓ · ch2 ✓",
  );
  assert.equal(formatChapterVerdicts([{ chapterNumber: 4 }]), "ch4 UNKNOWN", "no finalVerdict → UNKNOWN, never crashes");
  assert.equal(formatChapterVerdicts([]), "", "empty matrix → empty string");
});
