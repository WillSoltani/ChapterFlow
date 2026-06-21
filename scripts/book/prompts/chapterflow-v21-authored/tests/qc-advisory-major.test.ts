/**
 * H3 fix guard — deterministic majors are ADVISORY at QC.
 *
 * Before: finalize collected EVERY deterministic major via unresolvedMajors and
 * REVISE'd/HALTed on it, even though the gate documents whole classes (SC9, BP28-32,
 * C23 …) as "shadow / does not flip the gate". A corpus calibration shows every
 * deterministic major fires on at least one clean/gold reference chapter (SC9 on
 * 16/21 gold), so blocking on them demanded manual waivers on good content — the
 * documented convergence-killer.
 *
 * After: unresolvedMajors (the QC-blocking aggregator) filters through the empty
 * QC_ENFORCED_MAJORS allowlist, so deterministic majors SURFACE (currentMajorFindings
 * / formatMajorStatus) but never block the verdict. Semantic quality is gated by the
 * model QC (bar/sweep/confirm) + the deterministic BLOCKERS.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, rmSync } from "fs";
import { resolve } from "path";

import { test } from "./harness.js";
import { cleanCorpusChapterFiles, goldChapterFiles, makeChapter, STATE_CHAPTERS, writeFixtureBook } from "./helpers.js";
import { currentMajorFindings, unresolvedMajors } from "../src/qc/majorDisposition.js";
import { QC_ENFORCED_MAJORS, runShipGate } from "../src/critics/finalGate.js";
import { runBookGate } from "../src/critics/bookGate.js";

const BOOK = "zz-fixture-advisory-major";

function cleanup(): void {
  for (const f of readdirSync(STATE_CHAPTERS)) {
    if (f.startsWith(`${BOOK}-ch`)) rmSync(resolve(STATE_CHAPTERS, f), { force: true });
  }
}

test("deterministic majors surface in currentMajorFindings but are advisory-at-QC (unresolvedMajors filters to QC_ENFORCED_MAJORS)", () => {
  const oldWarn = console.warn;
  console.warn = () => {};
  try {
    cleanup();
    const chapter = makeChapter(BOOK, 1);
    writeFixtureBook(STATE_CHAPTERS, [chapter]);
    const surfaced = currentMajorFindings(BOOK, [chapter]);
    assert.ok(surfaced.length > 0, "fixture should trip at least one deterministic major (the visibility path must keep working)");
    const blocking = unresolvedMajors(BOOK, [chapter], true);
    // Every blocking major must be in the QC allowlist...
    assert.ok(blocking.every((f) => QC_ENFORCED_MAJORS.has(f.checkId)), "unresolvedMajors must only return QC-enforced majors");
    // ...and since the allowlist is empty, NONE of the surfaced majors blocks the verdict.
    assert.equal(blocking.length, 0, "advisory-at-QC: a surfaced deterministic major must not, by itself, block the QC verdict");
  } finally {
    console.warn = oldWarn;
    cleanup();
  }
});

// Calibration (corpus-gated): no id in QC_ENFORCED_MAJORS may fire on the clean/gold
// reference corpus — the same SC9-reversal rule enforced-major.test.ts applies to the
// write self-gate. Skips silently when the corpus isn't on disk (CI / fresh checkout).
test("QC_ENFORCED_MAJORS contains no major that fires on the clean/gold reference corpus", () => {
  const oldWarn = console.warn;
  console.warn = () => {};
  try {
    const corpus = [...goldChapterFiles(), ...cleanCorpusChapterFiles()].filter((b) => b.files.length > 0);
    if (corpus.length === 0) return; // reference corpus not present — nothing to calibrate here
    const firing = new Set<string>();
    for (const { bookId, files } of corpus) {
      const chapters = files.map((f) => JSON.parse(readFileSync(f, "utf8")));
      for (const ch of chapters) for (const m of runShipGate(ch).majors) firing.add(m.catalogId);
      try {
        for (const f of runBookGate(bookId, chapters).findings) if (f.severity === "major") firing.add(f.catalogId);
      } catch {
        /* a book-gate read error on a fixture is not a calibration signal */
      }
    }
    for (const id of QC_ENFORCED_MAJORS) {
      assert.ok(!firing.has(id), `QC_ENFORCED_MAJORS contains ${id}, which fires on the reference corpus — enforcing it would retroactively REVISE reference-quality books (the SC9-reversal trap).`);
    }
  } finally {
    console.warn = oldWarn;
  }
});
