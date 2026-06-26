/**
 * Monotone SHORT-sentence cadence (E8) — the short-side twin of the long-drone
 * arm in checkCadenceVariance.
 *
 * THE DEFECT (new-pipeline regression). A tier reads choppy/listy: a SUSTAINED run
 * of short, same-length declaratives with no long flowing sentence to break the
 * rhythm ("Each one moves the fight upstream. The first names the cue. The second
 * closes the window. The third makes reversal harder…"). It is the inverse of the
 * ≥25-word drone the existing critic catches.
 *
 * This suite is the executable calibration contract (mirrors evidence-integrity.test.ts):
 *  - TRUE POSITIVES (verbatim runs lifted from the audited defect books + the seeded
 *    f6 corpus span) each FIRE — a gate that flags nothing is useless;
 *  - MUST_NOT_FIRE constructions stay silent, INCLUDING atomic-habits-ch12's
 *    intentional telegraphic cello-routine staccato (a reference-quality device, not
 *    the defect — guarded by the run-mean floor);
 *  - the GOLD corpus (synthetic goldChapterFiles() + the real daring-greatly /
 *    start-with-why chapters) stays at ZERO. The gold zero-FP assertion is the
 *    load-bearing one. See the CALIBRATION NOTE in src/critics/prose.ts for why the
 *    original spec's CoefVar<0.50 arm was dropped (it fired on the majority of gold
 *    tiers) and why a run-mean floor was added (to spare deliberate action staccato).
 *
 * Shadow MAJOR: E8.monotone_cadence surfaces as QC debt; it is NOT in ENFORCED_MAJOR,
 * so it does not block. The wiring test asserts it surfaces in `.majors`, not `.blockers`.
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "fs";
import { resolve } from "path";

import { test, skip } from "./harness.js";
import { makeChapter, goldChapterFiles, STATE_CHAPTERS } from "./helpers.js";
import { REGRESSIONS, bookText } from "./fixtures/regressions.js";
import { findMonotoneShortRun, checkSentenceLengthVariance } from "../src/critics/prose.js";
import { runShipGate } from "../src/critics/finalGate.js";
import type { ChapterV21 } from "../src/types.js";

// ── The real defect: SUSTAINED runs of short, same-length declaratives (must FIRE) ──
// The first two are VERBATIM from the audited defect books (willpower / tiny-habits
// regen); the third is a synthetic expository-monotone passage.
const TRUE_POSITIVES: Array<[string, string]> = [
  [
    "willpower-ch07 deepRead (verbatim, run 7, mean 6.0)",
    "Each one moves the fight upstream. The first names the cue. The second closes the window. " +
      "The third makes reversal harder. The fourth lets other people see the promise. " +
      "The fifth takes the trigger out of reach. You are not admitting defeat.",
  ],
  [
    "tiny-habits-regen ch06 fullRead (verbatim, run 10, mean 6.5)",
    "It is a witness against you.\n\nThe better test is not size. The better test is signal. " +
      "Does the behavior happen without a fight? Does it still fit the prompt? Do you feel even a small yes afterward? " +
      "If so, you can choose a path. Stretch the habit by one inch. Multiply by adding a related recipe. " +
      "Stabilize by letting the small version keep working.",
  ],
  [
    "synthetic expository-monotone (run 8, mean 5.6)",
    "Defaults handle small repeat calls. Routines keep daily choices from reopening. " +
      "Option limits stop search loops. Time blocks protect deep work. Checklists catch the easy misses. " +
      "Templates remove the blank page. Each one saves a little willpower. Together they free the mind.",
  ],
];

// ── Clean / varied / intentional constructions a real book uses (must NOT fire) ────
const MUST_NOT_FIRE: Array<[string, string]> = [
  // INTENTIONAL telegraphic action-sequence — verbatim from atomic-habits-ch12's cello
  // routine. Reference-quality device (run mean ~3.2), excluded by the run-mean floor.
  [
    "atomic-habits cello staccato (verbatim, intentional device)",
    "Door opens, 6:40. Coat off, shoes off. Case in the hall closet. Unzip, kneeling. " +
      "Lift the cello out. Find the bow. Tighten the bow. Rosin the bow. Sit down.",
  ],
  // Mixed cadence with a long subordinate-clause sentence between the short ones.
  [
    "varied: short + long + short (the prevention pattern)",
    "After the celebration, your brain wants to repeat the behavior. That is the whole trick. " +
      "You do not need more discipline; you need a feeling of success attached to something small, " +
      "fired the instant the tiny action ends so the loop closes before doubt can creep in. " +
      "Plant it after a routine. Celebrate it. Let it wire in.",
  ],
  // A short run BROKEN by one long flowing sentence — exactly what the fix asks for.
  [
    "short run broken by a long flowing sentence",
    "Defaults handle the small calls. Routines protect the morning. But the real gain shows up only " +
      "when you stop treating every repeated decision as a fresh negotiation and let the structure carry " +
      "the weight for you. Checklists catch the misses. Templates kill the blank page. Each one helps.",
  ],
  // Short sentences whose LENGTHS vary (band > 3) — good staccato, not monotone.
  [
    "varied-length short staccato",
    "Go. Check the entry. Compare it to yesterday's signed note. Stop. The total is off by one record. " +
      "Fix it. Then restart the queue. Done.",
  ],
];

test("E8: findMonotoneShortRun fires on every monotone true-positive", () => {
  for (const [label, text] of TRUE_POSITIVES) {
    const run = findMonotoneShortRun(text);
    assert.ok(run && run.length >= 7, `expected a monotone run for ${label}: got ${JSON.stringify(run)}`);
  }
});

test("E8: findMonotoneShortRun stays silent on every varied / intentional construction", () => {
  for (const [label, text] of MUST_NOT_FIRE) {
    const run = findMonotoneShortRun(text);
    assert.equal(run, null, `false positive on ${label}: "${text}" → ${JSON.stringify(run)}`);
  }
});

test("E8: checkSentenceLengthVariance emits a major-shaped finding on the defect", () => {
  const findings = checkSentenceLengthVariance(TRUE_POSITIVES[0][1], "breakdown.deepRead");
  assert.equal(findings.length, 1, "expected exactly one E8 finding");
  assert.equal(findings[0].severity, "major");
  assert.ok(findings[0].evidence && findings[0].evidence.length > 0, "E8 must quote the offending run as evidence");
});

test("E8: the ship gate surfaces a planted monotone tier as a MAJOR, not a blocker (wiring + severity)", () => {
  const ch = makeChapter("zz-e8-gate", 5, {
    overrides: {
      breakdown: {
        fastRead:
          "A short clean opening tier with ordinary prose, mixing a brief line with a longer one that " +
          "earns its length by carrying a real clause, so the rhythm never flattens into a list.",
        deepRead: TRUE_POSITIVES[0][1],
        fullRead:
          "The longest tier expands the idea with neutral exposition, varying sentence length deliberately " +
          "so that a short verdict can land after a longer, clause-bearing sentence that sets it up first.",
      } as any,
    },
  });
  const report = runShipGate(ch);
  assert.ok(
    report.majors.some((m) => m.catalogId === "E8.monotone_cadence"),
    `expected an E8 ship-gate major; got majors ${report.majors.map((m) => m.catalogId).join(", ")}`,
  );
  assert.ok(
    !report.blockers.some((b) => b.catalogId === "E8.monotone_cadence"),
    "E8 must NOT be a blocker (shadow major)",
  );
});

// ── Regression-corpus integration (tests/fixtures/regressions.ts, finding #6 = f6) ──

test("E8: every seeded f6 corpus span fires the detector", () => {
  assert.ok(REGRESSIONS.f6.length >= 1, "f6 should be seeded with at least one monotone-cadence span");
  for (const { span, source } of REGRESSIONS.f6) {
    assert.ok(findMonotoneShortRun(span), `f6 span did not fire E8 (${source}): "${span.slice(0, 80)}…"`);
  }
});

test("E8: every f6 corpus span is verbatim in its source book (calibration anchor)", () => {
  let checked = 0;
  for (const { span, book, source } of REGRESSIONS.f6) {
    const text = bookText(book);
    if (text === null) continue; // live package absent on this machine
    assert.ok(text.includes(span), `f6 span not verbatim in ${book} (${source})`);
    checked += 1;
  }
  if (checked === 0) skip("E8 f6 verbatim", "no f6 source package present on this machine");
});

// ── Gold-corpus zero-FP calibration (the blocker-promotion gate) ──────────────

test("E8: synthetic gold corpus has ZERO monotone-cadence findings", () => {
  for (const { bookId, files } of goldChapterFiles()) {
    for (const file of files) {
      const ch = JSON.parse(readFileSync(file, "utf8")) as ChapterV21;
      for (const tier of ["fastRead", "deepRead", "fullRead"] as const) {
        const text = (ch.breakdown as any)?.[tier] ?? "";
        const hits = checkSentenceLengthVariance(text, `breakdown.${tier}`);
        assert.equal(hits.length, 0, `E8 false positive on synthetic gold ${bookId} ${ch.chapterId}.${tier}: ${hits.map((h) => h.message.slice(0, 120)).join(" | ")}`);
      }
    }
  }
});

for (const bookId of ["daring-greatly", "start-with-why"]) {
  const files = existsSync(STATE_CHAPTERS)
    ? readdirSync(STATE_CHAPTERS).filter((f) => f.startsWith(`${bookId}-ch`) && f.endsWith(".v21-native.chapter.json"))
    : [];
  if (files.length === 0) {
    skip(`E8 gold zero-FP: ${bookId}`, `no ${bookId} chapters in state/chapters/ on this machine`);
    continue;
  }
  test(`E8: real gold corpus ${bookId} (${files.length} ch) emits ZERO monotone-cadence findings`, () => {
    const offenders: string[] = [];
    for (const f of files) {
      const ch = JSON.parse(readFileSync(resolve(STATE_CHAPTERS, f), "utf8")) as ChapterV21;
      for (const tier of ["fastRead", "deepRead", "fullRead"] as const) {
        const text = (ch.breakdown as any)?.[tier] ?? "";
        for (const hit of checkSentenceLengthVariance(text, `breakdown.${tier}`)) {
          offenders.push(`${ch.chapterId}.${tier}: ${hit.message.slice(0, 140)}`);
        }
      }
    }
    assert.equal(offenders.length, 0, `E8 false-positives on reference-quality ${bookId} (miscalibrated):\n${offenders.join("\n")}`);
  });
}
