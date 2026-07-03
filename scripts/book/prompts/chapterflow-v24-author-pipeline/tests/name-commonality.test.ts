/**
 * C27 — exotic / off-standard name density (advisory). Finding #8.
 *
 * THE DEFECT. A chapter's example cast is a slate of affected, uncommon names
 * (Thomasina, Rhiannon, Soledad, Osvald, Eero, Saoirse) that read as trying-too-
 * hard and are hard for a reader to hold across six scenes. Nothing scored
 * commonality: catalogAudit tracks cross-book name REUSE; C7 bans a specific
 * over-used HANDFUL (the opposite signal).
 *
 * THE STANDARD (owner direction 2026-06-25). Example protagonists should read as
 * standard contemporary American/Canadian names — the allocator's pool
 * (config/name-bank.json) plus the diminutives the formal pool omits
 * (config/common-given-names.json). That union is the commonality ORACLE
 * (loadStandardGivenNames); a cast name absent from it is "off-standard".
 *
 * THE CALIBRATION CONTRACT (mirrors evidence-integrity / cast-discipline):
 *  - TRUE POSITIVE fires (an all-exotic cast), AND
 *  - the GOLD corpus stays at ZERO. The gold corpus is held clean by REGENERATING
 *    daring-greatly's example casts onto standard names — the defect C27 targets is
 *    precisely that the old generation shipped an off-standard cast (Aisha, Mei,
 *    Kenji, Nikhil, Suresh, …). start-with-why was already clean (its one recurring
 *    protagonist, "Ben", is standard; the rest are real-company cases, not people).
 *
 * THE FP GUARD. The cast is the RECURRING actors via the gold-calibrated chapterCast
 * (so one-off cities/orgs and determiner-led common nouns never count — the same
 * extractor C24 proved zero-FP on a 330-chapter sweep). C27 fires only when the cast
 * is large enough to read as a slate (>= 4) AND a strict majority is off-standard
 * (> 60%). MINOR / SHADOW: it surfaces QC debt, it never blocks.
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "fs";
import { resolve } from "path";

import { test, skip } from "./harness.js";
import { makeChapter, goldChapterFiles, STATE_CHAPTERS } from "./helpers.js";
import {
  chapterCast,
  offStandardNames,
  checkNameCommonality,
} from "../src/critics/narrative.js";
import { runShipGate } from "../src/critics/finalGate.js";
import type { ChapterV21 } from "../src/types.js";

// Pad a short named snippet to a schema-valid scenario length without adding any
// new capitalized cast names ("The" is a stopword; the filler is lowercase).
const PAD =
  " The team reviews the live record against the signed note before the next handoff begins, checking the timestamp and the prior entry against the source carefully and without rushing past the discrepancy.";

// ── An all-exotic cast: six off-standard names, each recurring in its own scene ──
const EXOTIC = [
  "Thomasina opens the intake desk before dawn. Thomasina checks the ledger twice.",
  "Osvald reviews the billing queue. Osvald flags a duplicate charge.",
  "Saoirse holds the release. Saoirse traces the broken scan.",
  "Rhiannon runs the training shift. Rhiannon asks for the signed note.",
  "Soledad audits the bench. Soledad restores the missing context.",
  "Eero watches the support lane. Eero links the evidence.",
];

// ── A standard American/Canadian cast (must NOT fire) ──
const STANDARD = [
  "Sarah opens the intake desk before dawn. Sarah checks the ledger twice.",
  "Daniel reviews the billing queue. Daniel flags a duplicate charge.",
  "Megan holds the release. Megan traces the broken scan.",
  "Keith runs the training shift. Keith asks for the signed note.",
  "Rachel audits the bench. Rachel restores the missing context.",
  "Gordon watches the support lane. Gordon links the evidence.",
];

function chapterWith(scenarios: string[], bookId: string, n: number): ChapterV21 {
  const ch = makeChapter(bookId, n);
  scenarios.forEach((s, i) => { if (i < ch.examples.length) ch.examples[i].scenario = s + PAD; });
  return ch;
}

// ── Pure detector: offStandardNames ───────────────────────────────────────────

test("offStandardNames splits a mixed cast against the AM/CAN oracle", () => {
  assert.deepEqual(offStandardNames(["Thomasina", "Sarah"]), ["Thomasina"]);
  assert.deepEqual(offStandardNames(["Sarah", "Daniel", "Megan"]), []);
  // Diminutives the formal name-bank omits are carried by the supplement.
  assert.deepEqual(offStandardNames(["Ben", "Tom", "Sam"]), []);
});

// ── C27 fires on the all-exotic slate, silent on the standard one ─────────────

test("C27: checkNameCommonality fires on an all-exotic cast", () => {
  const ch = chapterWith(EXOTIC, "zz-c27-exotic", 1);
  assert.equal(chapterCast(ch.examples.map((e) => e.scenario as string)).length, 6);
  const fired = checkNameCommonality(ch);
  assert.ok(fired.some((f) => f.checkId === "C27.exotic_name_density"), `expected C27; got ${JSON.stringify(fired)}`);
  assert.ok(fired.every((f) => f.severity === "minor"), "C27 is an advisory minor");
});

test("C27: a standard American/Canadian cast never fires", () => {
  const ch = chapterWith(STANDARD, "zz-c27-standard", 2);
  assert.equal(checkNameCommonality(ch).length, 0, "a fully-standard cast is clean");
});

// ── Thresholds: min-cast guard + the strict >60% majority ─────────────────────

test("C27: a cast below the minimum size never fires (even if all exotic)", () => {
  // Only three named scenes → cast 3 < 4 → silent regardless of commonality.
  const ch = chapterWith(EXOTIC.slice(0, 3), "zz-c27-small", 3);
  assert.equal(chapterCast(ch.examples.map((e) => e.scenario as string)).length, 3);
  assert.equal(checkNameCommonality(ch).length, 0, "a 3-name cast is below the slate threshold");
});

test("C27: fires above 60% off-standard, silent at or below it", () => {
  // 4 cast, 3 off-standard (75%) → fires.
  const over = chapterWith([EXOTIC[0], EXOTIC[1], EXOTIC[2], STANDARD[0]], "zz-c27-over", 4);
  assert.ok(checkNameCommonality(over).some((f) => f.checkId === "C27.exotic_name_density"), "75% off-standard fires");
  // 4 cast, 2 off-standard (50%) → silent.
  const under = chapterWith([EXOTIC[0], EXOTIC[1], STANDARD[0], STANDARD[1]], "zz-c27-under", 5);
  assert.equal(checkNameCommonality(under).length, 0, "50% off-standard is under the strict-majority threshold");
});

// ── Ship-gate wiring + severity (surfaces as an advisory minor, never blocks) ──

test("C27: the ship gate surfaces an exotic cast as a minor (wiring + severity)", () => {
  const ch = chapterWith(EXOTIC, "zz-c27-gate", 6);
  const report = runShipGate(ch);
  assert.ok(
    report.minors.some((m) => m.catalogId === "C27.exotic_name_density"),
    `expected a C27 minor; got minors ${report.minors.map((m) => m.catalogId).join(", ")}`,
  );
  // Advisory: it must NOT appear among blockers or majors.
  assert.ok(!report.blockers.some((b) => b.catalogId === "C27.exotic_name_density"), "C27 must not block");
  assert.ok(!report.majors.some((m) => m.catalogId === "C27.exotic_name_density"), "C27 is not a major");
});

// ── Gold-corpus zero-FP calibration (the shadow-advisory calibration gate) ────

test("C27: synthetic gold corpus has ZERO findings", () => {
  for (const { bookId, files } of goldChapterFiles()) {
    for (const file of files) {
      const ch = JSON.parse(readFileSync(file, "utf8")) as ChapterV21;
      const hits = checkNameCommonality(ch);
      assert.equal(hits.length, 0, `C27 false positive on synthetic gold ${bookId} ${ch.chapterId}: ${hits.map((h) => h.message.slice(0, 100)).join(" | ")}`);
    }
  }
});

for (const bookId of ["daring-greatly", "start-with-why"]) {
  const files = existsSync(STATE_CHAPTERS)
    ? readdirSync(STATE_CHAPTERS).filter((f) => f.startsWith(`${bookId}-ch`) && f.endsWith(".v21-native.chapter.json"))
    : [];
  if (files.length === 0) {
    skip(`C27 gold zero-FP: ${bookId}`, `no ${bookId} chapters in state/chapters/ on this machine`);
    continue;
  }
  test(`C27: real gold corpus ${bookId} (${files.length} ch) emits ZERO findings (regenerated onto standard names)`, () => {
    const offenders: string[] = [];
    for (const f of files) {
      const ch = JSON.parse(readFileSync(resolve(STATE_CHAPTERS, f), "utf8")) as ChapterV21;
      const cast = chapterCast((ch.examples ?? []).map((e) => (typeof e.scenario === "string" ? e.scenario : JSON.stringify(e.scenario))));
      const off = offStandardNames(cast);
      for (const hit of checkNameCommonality(ch)) offenders.push(`${ch.chapterId}: ${hit.message.slice(0, 110)}`);
      // Documents the regen: the gold cast must be entirely standard now.
      assert.deepEqual(off, [], `${ch.chapterId} still has off-standard recurring names: ${off.join(", ")}`);
    }
    assert.equal(offenders.length, 0, `C27 false-positives on reference-quality ${bookId} (miscalibrated):\n${offenders.join("\n")}`);
  });
}
