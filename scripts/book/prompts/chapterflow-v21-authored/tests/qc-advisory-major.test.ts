/**
 * Major-clean production policy guard.
 *
 * Deterministic majors are raw observations, not automatic passes. They all remain
 * VISIBLE through currentMajorFindings. The BLOCKING set (unresolvedMajors) is the
 * non-ADVISORY subset: advisory majors (critics/majorPolicy.ts — the FP-prone /
 * reference-corpus-firing tier) surface but never hard-gate (so they can never force
 * a human-disposition governance halt); every other (blocking) major is unresolved
 * until a narrow, reviewer-attributed, content-bound waiver closes that exact
 * finding/content.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, rmSync } from "fs";
import { resolve } from "path";

import { test } from "./harness.js";
import { cleanCorpusChapterFiles, goldChapterFiles, makeChapter, STATE_CHAPTERS, writeFixtureBook } from "./helpers.js";
import { currentMajorFindings, unresolvedMajors } from "../src/qc/majorDisposition.js";
import { QC_ENFORCED_MAJORS, runShipGate } from "../src/critics/finalGate.js";
import { runBookGate } from "../src/critics/bookGate.js";
import { isAdvisoryMajor } from "../src/critics/majorPolicy.js";

const BOOK = "zz-fixture-advisory-major";

function cleanup(): void {
  for (const f of readdirSync(STATE_CHAPTERS)) {
    if (f.startsWith(`${BOOK}-ch`)) rmSync(resolve(STATE_CHAPTERS, f), { force: true });
  }
}

test("deterministic majors all SURFACE; advisory majors are non-blocking, blocking majors are unresolved by default", () => {
  const oldWarn = console.warn;
  console.warn = () => {};
  try {
    cleanup();
    const chapter = makeChapter(BOOK, 1);
    writeFixtureBook(STATE_CHAPTERS, [chapter]);
    const surfaced = currentMajorFindings(BOOK, [chapter]);
    assert.ok(surfaced.length > 0, "fixture should trip at least one deterministic major (the visibility path must keep working)");
    // Advisory majors (reference-corpus-firing / FP-prone) surface but never block — so
    // they can never force a human-disposition governance halt. A minimal fixture trips
    // the always-firing advisory majors (E1, C2, …), so the exclusion must be exercised.
    assert.ok(surfaced.some((f) => isAdvisoryMajor(f.checkId)), "fixture should surface at least one advisory major (so the non-blocking path is exercised)");
    const blocking = unresolvedMajors(BOOK, [chapter], true);
    // No advisory major is ever blocking (the autonomy fix).
    for (const f of blocking) assert.ok(!isAdvisoryMajor(f.checkId), `advisory major ${f.checkId} must never be in the blocking set`);
    // The blocking set is EXACTLY the non-advisory subset of the surfaced majors —
    // every blocking major is unresolved without an explicit content-bound waiver.
    const blockingSurfaced = surfaced.filter((f) => !isAdvisoryMajor(f.checkId));
    assert.deepEqual(blocking.map((f) => f.id).sort(), blockingSurfaced.map((f) => f.id).sort(), "unresolvedMajors == the non-advisory subset of currentMajorFindings");
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
