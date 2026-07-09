/**
 * C33 — beat-vocabulary echo (CF-I-1). briefRotation's INTERNAL entry/outcome beat
 * labels ("return point", "early signal", "late catch", "return moment") leaking into
 * reader prose as house phrasing (multipliers, report §7.3.3). Two signals: per-chapter
 * (≥3 distinct families) and book-level (a family across ≥3 chapters). Advisory.
 *
 * Calibration contract: a 3-family chapter FIRES, a 1-family chapter is SPARED, a family
 * across 3 chapters fires ONE book-level advisory, the synthetic gold corpus is ZERO, and
 * the real gold corpus (start-with-why, a v24 book carrying the SAME dealt vocabulary) is
 * pinned at its MEASURED count (the beat leak is a fleet-wide contract defect).
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "fs";
import { resolve } from "path";

import { test, skip } from "./harness.js";
import { makeChapter, goldChapterFiles, labelCleanCorpusChapterFiles, STATE_CHAPTERS } from "./helpers.js";
import { beatFamiliesInText } from "../src/critics/machineryPhrases.js";
import {
  beatFamiliesInChapter,
  checkBeatVocabularyEcho,
  checkBookBeatVocabularyEcho,
} from "../src/critics/beatVocabularyEcho.js";
import { runShipGate } from "../src/critics/finalGate.js";
import type { ChapterV21 } from "../src/types.js";

/** A minimal chapter carrying `prose` in its fastRead (the reader-facing surface C33 scans). */
function chapterWithProse(prose: string, number = 1): ChapterV21 {
  return { number, breakdown: { fastRead: prose, deepRead: "", fullRead: "" } } as unknown as ChapterV21;
}

// ── The pure family detector ──────────────────────────────────────────────────

test("C33: beatFamiliesInText returns DISTINCT beat families (a family counts once)", () => {
  // CF-I re-mint follow-up: "set but not yet met" is now its own watchlist family, so
  // this fixture sentence carries TWO families (it was built from the old still-open
  // instruction stem, which is exactly the surface the new family exists to catch).
  assert.deepEqual(beatFamiliesInText("The return point was set but not yet met."), ["return-point", "set-but-not-yet-met"]);
  assert.deepEqual(beatFamiliesInText("The reckoning arrives at the first sign nobody has flagged."), ["reckoning", "first-sign"]);
  // the SCOPED first-sign family spares the legitimate idiom (multipliers ch06).
  assert.deepEqual(beatFamiliesInText("You fix the hard part at the first sign of strain."), []);
  assert.deepEqual(
    beatFamiliesInText("The early signal is easy to miss, and the miss is caught late in the drill."),
    ["early-signal", "late-catch"],
  );
  // both surfaces of the late-catch family present → the family still counts ONCE.
  assert.deepEqual(beatFamiliesInText("A late catch is not enough; the risk was caught late anyway."), ["late-catch"]);
  assert.deepEqual(beatFamiliesInText("The team shipped the plan on Friday and moved on."), []);
});

// ── The chapter-level critic ──────────────────────────────────────────────────

test("C33 fires ONCE on a chapter with ≥3 distinct beat families", () => {
  const ch = chapterWithProse(
    "At the return moment the branch lead sees the early signal, and the miss is caught late before the return point is even set.",
  );
  assert.deepEqual(beatFamiliesInChapter(ch).sort(), ["early-signal", "late-catch", "return-moment", "return-point"]);
  const findings = checkBeatVocabularyEcho(ch);
  assert.equal(findings.length, 1, "one advisory per chapter");
  assert.equal(findings[0].severity, "minor", "ADVISORY — never blocks");
  assert.match(findings[0].message, /distinct dealt beat-labels/);
});

test("C33 SPARES a chapter that renders one beat once (the negative fixture)", () => {
  const ch = chapterWithProse("The branch lead catches the early signal before anyone else flags it.");
  assert.deepEqual(beatFamiliesInChapter(ch), ["early-signal"]);
  assert.equal(checkBeatVocabularyEcho(ch).length, 0, "one beat family is a legitimate rendering, not the tic");
});

test("C33 stays under threshold at exactly 2 families", () => {
  const ch = chapterWithProse("The early signal is missed, then the miss is caught late in the review.");
  assert.equal(beatFamiliesInChapter(ch).length, 2);
  assert.equal(checkBeatVocabularyEcho(ch).length, 0);
});

// ── The book-level critic ─────────────────────────────────────────────────────

test("C33 book-level fires ONE advisory per family recurring across ≥3 chapters", () => {
  const chapters = [
    chapterWithProse("The early signal shows up in the intake queue.", 1),
    chapterWithProse("The early signal is easy to miss during a busy shift.", 2),
    chapterWithProse("The early signal returns before anyone flags the drift.", 3),
    chapterWithProse("Nothing recurs here; the plan just ships on Friday.", 4),
  ];
  const findings = checkBookBeatVocabularyEcho(chapters);
  assert.equal(findings.length, 1, "one book-level advisory for the recurring family");
  assert.equal(findings[0].checkId, "C33.beat_vocabulary_echo");
  assert.equal(findings[0].severity, "minor");
  assert.deepEqual(findings[0].chapters, [1, 2, 3]);
  assert.match(findings[0].message, /surfaces in 3 chapters/);
});

test("C33 book-level SPARES a family in only 2 chapters", () => {
  const chapters = [
    chapterWithProse("The return point is set here.", 1),
    chapterWithProse("The return point is set here too.", 2),
  ];
  assert.equal(checkBookBeatVocabularyEcho(chapters).length, 0);
});

// ── Ship-gate wiring + severity ───────────────────────────────────────────────

test("C33: the ship gate surfaces the beat-vocabulary echo as a minor (wiring + severity)", () => {
  const ch = makeChapter("zz-c33-gate", 4);
  ch.breakdown.fastRead =
    "At the return moment the shift lead notices the early signal in the resistor log, and the miss is caught late only after the return point has already slipped past the mark, which turns a cheap fix into an expensive rework cycle later that week.";
  const report = runShipGate(ch);
  assert.ok(report.minors.some((m) => m.catalogId === "C33.beat_vocabulary_echo"), `expected a C33 minor; got ${report.minors.map((m) => m.catalogId).join(", ")}`);
  assert.ok(!report.blockers.some((b) => b.catalogId === "C33.beat_vocabulary_echo"), "C33 must never be a blocker");
});

test("C33: an unplanted makeChapter is beat-vocabulary clean", () => {
  assert.equal(checkBeatVocabularyEcho(makeChapter("zz-c33-clean", 3)).length, 0);
});

// ── Gold-corpus calibration pins ──────────────────────────────────────────────

test("C33: synthetic gold corpus has ZERO beat-vocabulary findings (per-chapter + book-level)", () => {
  for (const { bookId, files } of [...goldChapterFiles(), ...labelCleanCorpusChapterFiles()]) {
    const chapters = files.map((f) => JSON.parse(readFileSync(f, "utf8")) as ChapterV21);
    for (const ch of chapters) {
      assert.equal(checkBeatVocabularyEcho(ch).length, 0, `C33 per-chapter false positive on synthetic gold ${bookId} ${ch.chapterId}`);
    }
    assert.equal(checkBookBeatVocabularyEcho(chapters).length, 0, `C33 book-level false positive on synthetic gold ${bookId}`);
  }
});

// The real gold corpus is NOT zero: start-with-why is a v24 machine-brief book carrying the
// SAME dealt beat vocabulary, so it fires per-chapter (ch2/9/10) and book-level (4 families).
// The pins record the MEASURED counts (the leak is a fleet-wide contract defect CF-I-2 fixes).
{
  const bookId = "start-with-why";
  const files = existsSync(STATE_CHAPTERS)
    ? readdirSync(STATE_CHAPTERS).filter((f) => f.startsWith(`${bookId}-ch`) && f.endsWith(".v21-native.chapter.json"))
    : [];
  if (files.length === 0) {
    skip(`C33 gold pin: ${bookId}`, `no ${bookId} chapters in state/chapters/ on this machine`);
  } else {
    test(`C33: real gold corpus ${bookId} (${files.length} ch) emits its MEASURED counts`, () => {
      const chapters = files.map((f) => JSON.parse(readFileSync(resolve(STATE_CHAPTERS, f), "utf8")) as ChapterV21);
      const perChapter = chapters.filter((ch) => checkBeatVocabularyEcho(ch).length > 0).length;
      const bookLevel = checkBookBeatVocabularyEcho(chapters).length;
      assert.equal(perChapter, 3, `C33 per-chapter gold pin drifted (expected 3: start-with-why ch2/9/10; got ${perChapter})`);
      assert.equal(bookLevel, 4, `C33 book-level gold pin drifted (expected 4 families; got ${bookLevel})`);
    });
  }
}
