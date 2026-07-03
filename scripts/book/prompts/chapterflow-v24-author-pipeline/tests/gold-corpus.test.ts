/**
 * Gold-corpus calibration as a runnable suite.
 *
 * daring-greatly (ch01–07) and start-with-why (ch01–14) are the reference-
 * quality books every BLOCKER is calibrated against: a blocker that flags
 * them is by definition a false positive. Until now "zero-FP on gold" lived
 * in code comments (and rotted once — SC9). This makes it executable.
 *
 * Reads real chapters from state/chapters/ at runtime; skips loudly if the
 * corpus is not on this machine (fixture policy: no book text in git).
 */

import assert from "node:assert/strict";
import { readFileSync } from "fs";

import { runShipGate } from "../src/critics/finalGate.js";
import type { ChapterV21 } from "../src/types.js";
import { skip, test } from "./harness.js";
import { goldChapterFiles } from "./helpers.js";

for (const { bookId, files } of goldChapterFiles()) {
  if (files.length === 0) {
    skip(`gold: ${bookId} ship-gate zero-FP`, `no ${bookId} chapters in state/chapters/ on this machine`);
    continue;
  }

  test(`gold: ${bookId} — runShipGate emits ZERO blockers across ${files.length} chapters`, () => {
    const offenders: string[] = [];
    for (const file of files) {
      const chapter = JSON.parse(readFileSync(file, "utf8")) as ChapterV21;
      const report = runShipGate(chapter);
      for (const b of report.blockers) {
        offenders.push(`${chapter.chapterId}: ${b.catalogId} (${b.unit}) — ${b.message.slice(0, 120)}`);
      }
    }
    assert.deepEqual(
      offenders,
      [],
      `BLOCKER false-positives on the gold corpus (a blocker that flags gold is miscalibrated):\n` +
        offenders.join("\n"),
    );
  });
}
