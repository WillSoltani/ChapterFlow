/**
 * Calibration guard for the ENFORCED_MAJOR set (the curated majors that fail the
 * per-chapter write self-gate). The mission's rule: an id may be enforced ONLY if
 * it fires ZERO times across the clean + gold reference corpus. This test makes
 * that rule mechanical — adding an id that fires on any reference chapter (e.g.
 * C2/C3/E4/C23, which calibration showed all do) turns the chapter's gate verdict
 * from PASS to BLOCK and fails here, so a reference-quality book can never be
 * retroactively broken by an over-eager enforcement (the SC9-reversal trap).
 */

import assert from "node:assert/strict";
import { readFileSync } from "fs";

import { test, skip } from "./harness.js";
import { ENFORCED_MAJOR, runShipGate } from "../src/critics/finalGate.js";
import type { ChapterV21 } from "../src/types.js";
import { cleanCorpusChapterFiles, goldChapterFiles } from "./helpers.js";

function quietWarn<T>(fn: () => T): T {
  const oldWarn = console.warn;
  console.warn = () => {};
  try {
    return fn();
  } finally {
    console.warn = oldWarn;
  }
}

for (const { bookId, files } of [...goldChapterFiles(), ...cleanCorpusChapterFiles()]) {
  if (files.length === 0) {
    skip(`enforced-major calibration: ${bookId}`, `no ${bookId} chapters in state/chapters/ on this machine`);
    continue;
  }
  test(`enforced-major calibration: no ENFORCED_MAJOR fires on ${bookId} (${files.length} ch) — gate verdict unchanged`, () => {
    for (const file of files) {
      const chapter = JSON.parse(readFileSync(file, "utf8")) as ChapterV21;
      const report = quietWarn(() => runShipGate(chapter));
      const enforced = report.majors.filter((m) => ENFORCED_MAJOR.has(m.catalogId));
      assert.deepEqual(
        enforced.map((m) => `${m.catalogId}@${m.unit}`),
        [],
        `${bookId} ${file.split("/").pop()}: an ENFORCED_MAJOR fired on a reference chapter — it is NOT zero-FP on the clean corpus and must not be enforced.`,
      );
      // Enforcement must not flip a reference chapter's pass verdict.
      assert.equal(
        report.passed,
        report.blockers.length === 0,
        `${bookId} ${file.split("/").pop()}: ENFORCED_MAJOR enforcement changed the gate verdict on a reference chapter.`,
      );
    }
  });
}
