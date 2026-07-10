/**
 * R4: `calibration-scan <bookId>` — the opt-in, NON-gating live-book twin of the
 * shipped-reference-only zero-FP cast/name pins.
 *
 * P11 gave the cast-discipline (C23/C24/C25) and name-commonality (C27) zero-FP
 * pins a SHIPPED-package precondition, so they no longer run on the ACTIVE
 * campaign book. This verb restores that FP signal on demand: it runs the same
 * detectors against any on-disk book and PRINTS findings WITHOUT failing the
 * suite. Pinned here: it prints C27 findings on a planted all-exotic-cast fixture
 * and exits 0, and it exits 0 (no crash) on a book with no chapters on disk.
 *
 * Uses the REAL state/chapters dir (the CLI's chapters dir is not injectable);
 * the planted fixture is removed in finally.
 */

import assert from "node:assert/strict";
import { rmSync } from "fs";
import { resolve } from "path";

import { test } from "./harness.js";
import { makeChapter, runCli, writeFixtureBook, STATE_CHAPTERS } from "./helpers.js";
import type { ChapterV21 } from "../src/types.js";

const BOOK = "zz-fixture-calibration-scan";

// Six off-standard names, each recurring in its own scene → C27 (exotic-name
// density) fires. Mirrors the EXOTIC slate in name-commonality.test.ts.
const EXOTIC = [
  "Thomasina opens the intake desk before dawn. Thomasina checks the ledger twice.",
  "Osvald reviews the billing queue. Osvald flags a duplicate charge.",
  "Saoirse holds the release. Saoirse traces the broken scan.",
  "Rhiannon runs the training shift. Rhiannon asks for the signed note.",
  "Soledad audits the bench. Soledad restores the missing context.",
  "Eero watches the support lane. Eero links the evidence.",
];
const PAD =
  " The team reviews the live record against the signed note before the next handoff begins, checking the timestamp and the prior entry against the source carefully and without rushing past the discrepancy.";

function exoticChapter(): ChapterV21 {
  const ch = makeChapter(BOOK, 1);
  EXOTIC.forEach((s, i) => { if (i < ch.examples!.length) ch.examples![i].scenario = s + PAD; });
  return ch;
}

function cleanup(): void {
  for (const n of [1]) rmSync(resolve(STATE_CHAPTERS, `${BOOK}-ch${String(n).padStart(2, "0")}.v21-native.chapter.json`), { force: true });
}

test("calibration-scan prints cast/name findings on a planted fixture and exits 0", () => {
  cleanup();
  writeFixtureBook(STATE_CHAPTERS, [exoticChapter()]);
  try {
    const { status, out } = runCli(["calibration-scan", BOOK]);
    assert.equal(status, 0, `calibration-scan must exit 0 regardless of findings; got ${status}\n${out}`);
    assert.match(out, /C27\.exotic_name_density/, `expected the C27 finding in the scan output:\n${out}`);
    assert.match(out, /ADVISORY|Advisory/, "output must mark itself advisory / non-gating");
    assert.match(out, new RegExp(`${BOOK}-ch01`), "the finding must name the offending chapter");
  } finally {
    cleanup();
  }
});

test("calibration-scan --json emits machine-readable findings and exits 0", () => {
  cleanup();
  writeFixtureBook(STATE_CHAPTERS, [exoticChapter()]);
  try {
    const { status, out } = runCli(["calibration-scan", BOOK, "--json"]);
    assert.equal(status, 0);
    const parsed = JSON.parse(out.trim());
    assert.equal(parsed.bookId, BOOK);
    assert.equal(parsed.chaptersScanned, 1);
    assert.ok(parsed.findings.some((f: { checkId: string }) => f.checkId === "C27.exotic_name_density"), `expected C27 in JSON findings:\n${out}`);
  } finally {
    cleanup();
  }
});

test("calibration-scan exits 0 on a book with no chapters on disk (never fails the suite)", () => {
  cleanup(); // ensure nothing planted
  const { status, out } = runCli(["calibration-scan", "zz-fixture-calibration-scan-absent"]);
  assert.equal(status, 0, `an absent book must not fail the scan; got ${status}\n${out}`);
  assert.match(out, /nothing to scan/i);
});

test("calibration-scan with no bookId prints usage and exits 2", () => {
  const { status, out } = runCli(["calibration-scan"]);
  assert.equal(status, 2);
  assert.match(out, /Usage: calibration-scan/);
});
