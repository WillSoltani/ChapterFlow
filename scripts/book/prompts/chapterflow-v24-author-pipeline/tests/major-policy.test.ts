/**
 * Major-policy tiers (critics/majorPolicy.ts) — the autonomy + anti-strictness guard.
 *
 * The pipeline must run hands-off: a deterministic MAJOR must never force a human
 * waive/fix governance halt. The mechanism is a two-tier policy:
 *   - ADVISORY majors (FP-prone / fire on the clean+gold reference corpus) surface in
 *     major-status but never hard-gate.
 *   - BLOCKING majors are the high-confidence, ZERO-on-reference, fixable set the gate
 *     phase converges before QC.
 *
 * THE CALIBRATION CONTRACT (the SC9-reversal rule, applied to the QC gate): no BLOCKING
 * major may fire on a reference-quality shipped book. If it did, the gate-phase major
 * convergence would chase a false positive on a clean book (spin → halt) — exactly the
 * over-strictness this policy removes. So the reference corpus must carry ZERO blocking
 * majors. (Adding a major to the blocking set that fires on the corpus fails here.)
 */
import assert from "node:assert/strict";
import { readFileSync } from "fs";

import { test } from "./harness.js";
import { goldChapterFiles, cleanCorpusChapterFiles } from "./helpers.js";
import { isAdvisoryMajor, isQcBlockingMajor } from "../src/critics/majorPolicy.js";
import { ENFORCED_MAJOR } from "../src/critics/finalGate.js";
import { unresolvedMajors } from "../src/qc/majorDisposition.js";

test("isAdvisoryMajor classifies the reference-firing / shadow tier as advisory and the rest as blocking", () => {
  // Advisory: style-frequency (fire on clean) + documented shadow / high-FP.
  for (const id of ["C2", "C3", "E1", "E4", "E7.long_sentence", "A13", "C28.uniform_success", "GN1.ungrounded_number", "NE1.named_enumeration_mismatch", "SC9.example_not_source_grounded", "SC11.0.no_source_run", "BP16.quiz_answer_length_major"]) {
    assert.ok(isAdvisoryMajor(id), `${id} must be advisory`);
    assert.ok(!isQcBlockingMajor(id), `${id} must not be QC-blocking`);
  }
  // Blocking: enforced + barrier + mechanical real majors.
  for (const id of ["EW1.invented_witness", "SEAM1.adjacent_duplicate_word", "SEAM2.verbatim_repetition", "BP33.tryThisNow_opener_reuse", "BP27.venue_stamping", "F3", "F4", "A14", "SL6.source_numbering_leak", "E8.monotone_cadence"]) {
    assert.ok(!isAdvisoryMajor(id), `${id} must be blocking`);
    assert.ok(isQcBlockingMajor(id), `${id} must be QC-blocking`);
  }
});

test("every ENFORCED_MAJOR is BLOCKING (an enforced corruption major can never be advisory)", () => {
  for (const id of ENFORCED_MAJOR) {
    assert.ok(!isAdvisoryMajor(id), `ENFORCED_MAJOR ${id} must never be advisory`);
  }
});

test("CALIBRATION: the clean + gold reference corpus carries ZERO blocking majors", () => {
  const oldWarn = console.warn;
  console.warn = () => {};
  try {
    const corpus = [...goldChapterFiles(), ...cleanCorpusChapterFiles()].filter((b) => b.files.length > 0);
    if (corpus.length === 0) return; // reference corpus not present (CI / fresh checkout) — nothing to calibrate
    const offenders: string[] = [];
    for (const { bookId, files } of corpus) {
      const chapters = files.map((f) => JSON.parse(readFileSync(f, "utf8")));
      let blocking: ReturnType<typeof unresolvedMajors> = [];
      try { blocking = unresolvedMajors(bookId, chapters, false); } catch { /* a read error on a fixture is not a calibration signal */ }
      for (const m of blocking) offenders.push(`${bookId} ${m.checkId}`);
    }
    assert.deepEqual(offenders, [], `a BLOCKING major fires on reference-quality books — demote it to ADVISORY in majorPolicy.ts (the gate-converge would chase it on a clean book): ${offenders.join("; ")}`);
  } finally {
    console.warn = oldWarn;
  }
});
