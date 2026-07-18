/**
 * Mechanical-seam critic (SEAM1/SEAM2) — reader prose must never carry a stuttered
 * word ("side side") or a verbatim triple-repeat of a long run (a templated-loop
 * glitch).
 *
 * THE DEFECT (a corpus-quality eval found these in ~22 shipped packages — MECHANICAL
 * generator artifacts, not writing quality): "Emma Tries side side room";
 * a 10-word clause stamped out three times. SEAM shifts them to a deterministic gate.
 *
 * The calibration contract: the real seams fire; a HYPHENATED compound straddle
 * ("almost-good good", "voice-over over"), the legitimate "the fact that that"
 * reduplication, and DELIBERATE ANAPHORA (a short opener repeated with divergent
 * tails — Playing to Win's "what would have to be true … for X?") all stay silent;
 * and the gold corpus is ZERO. Across the 132-package corpus the only fires are the
 * 10 genuine seams (zero FP).
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "fs";
import { resolve } from "path";

import { test, xenv } from "./harness.js";
import { makeChapter, goldChapterFiles, STATE_CHAPTERS } from "./helpers.js";
import { findAdjacentDuplicates, findVerbatimRepetition, checkMechanicalSeams } from "../src/critics/mechanicalSeam.js";
import { runShipGate, ENFORCED_MAJOR } from "../src/critics/finalGate.js";
import type { ChapterV21 } from "../src/types.js";

// ── SEAM1 — adjacent duplicate word ───────────────────────────────────────────
const SEAM1_TRUE: Array<[string, string]> = [
  ["the eval's 'side side'", "The hall opens onto the side side room where the lesson lands."],
  ["'chapter chapter'", "The chapter chapter title announces contempt for the familiar."],
  ["'contrast contrast'", "The contrast contrast is intentionally abrasive at the start."],
  ["'doing doing'", "The question is what the threat is doing doing."],
];

const SEAM1_SILENT: Array<[string, string]> = [
  ["hyphenated compound tail ('almost-good good')", "It keeps the learner from calling almost-good good enough."],
  ["hyphenated compound head ('voice-over over')", "He inserts a softening voice-over over the most challenging scene."],
  ["legit grammatical 'that that'", "The hard part is that that decision can never be undone."],
  ["allowlisted reduplication ('blah blah')", "He waved it off with a bored blah blah and moved on."],
  ["short function word ('the the' is <4 letters)", "She set the the bar — wait, this is too short to count."],
  ["comma'd repeat is deliberate, not a stutter", "She was ready, ready at last, and stepped onto the stage."],
];

test("SEAM1: findAdjacentDuplicates fires on every real stutter", () => {
  for (const [label, sentence] of SEAM1_TRUE) {
    const hits = findAdjacentDuplicates(sentence);
    assert.ok(hits.length >= 1, `expected a SEAM1 hit for ${label}: "${sentence}"`);
  }
});

test("SEAM1: stays silent on compounds / legit reduplications / short words / comma'd repeats", () => {
  for (const [label, sentence] of SEAM1_SILENT) {
    const hits = findAdjacentDuplicates(sentence);
    assert.equal(hits.length, 0, `SEAM1 false positive on ${label}: "${sentence}" → ${JSON.stringify(hits)}`);
  }
});

// ── SEAM2 — verbatim triple-repetition ────────────────────────────────────────
const RUN = "the system makes the same quiet mistake again and again"; // exactly 10 words
const SEAM2_TRUE: Array<[string, string]> = [
  ["a 10-word run stamped 3x", `First ${RUN}. Then ${RUN}. Later ${RUN}, and nothing changes.`],
];

const SEAM2_SILENT: Array<[string, string]> = [
  // Deliberate anaphora: the 6-word opener repeats, but the 10-grams diverge at word 7.
  ["anaphora with divergent tails", "What would have to be true for the plan to work? What would have to be true for the team to commit? What would have to be true for the budget to clear?"],
  // A callback repeats once (twice total) — deliberate, below the triple floor.
  ["a run repeated only twice (a callback)", `Early on, ${RUN}. By the end, ${RUN}.`],
];

test("SEAM2: findVerbatimRepetition fires on a 10-word run stamped 3x", () => {
  for (const [label, text] of SEAM2_TRUE) {
    const hits = findVerbatimRepetition(text);
    assert.ok(hits.length >= 1 && hits[0].count >= 3, `expected a SEAM2 hit for ${label}: ${JSON.stringify(hits)}`);
  }
});

test("SEAM2: stays silent on deliberate anaphora and twice-only callbacks", () => {
  for (const [label, text] of SEAM2_SILENT) {
    const hits = findVerbatimRepetition(text);
    assert.equal(hits.length, 0, `SEAM2 false positive on ${label} → ${JSON.stringify(hits)}`);
  }
});

// ── Chapter-level + ship-gate wiring ──────────────────────────────────────────
test("SEAM: checkMechanicalSeams flags planted seams as MAJOR; a clean chapter is silent", () => {
  const ch = makeChapter("zz-seam-plant", 1, {
    overrides: {
      breakdown: {
        fastRead: "A clean opening tier with ordinary prose and nothing repeated at all.",
        deepRead: "The chapter chapter title lands hard before the real lesson begins here.",
        fullRead: `One writer keeps a habit: ${RUN}. A second: ${RUN}. A third: ${RUN}.`,
      } as any,
    },
  });
  const findings = checkMechanicalSeams(ch);
  assert.ok(findings.some((f) => f.checkId === "SEAM1.adjacent_duplicate_word"), "expected a SEAM1 finding");
  assert.ok(findings.some((f) => f.checkId === "SEAM2.verbatim_repetition"), "expected a SEAM2 finding");
  assert.ok(findings.every((f) => f.severity === "major"), "SEAM findings are major (enforced)");

  // A chapter of genuinely clean (non-repetitive) prose is SEAM-silent. (The bare
  // makeChapter padder stamps an identical filler clause — a fixture quirk that
  // SEAM2 rightly flags — so the clean case overrides the tiers with real prose.)
  const clean = makeChapter("zz-seam-clean", 2, {
    overrides: {
      breakdown: {
        fastRead: "A short opening tier that states the idea plainly and moves on without circling back.",
        deepRead: "The second tier develops the mechanism with fresh detail, naming the trade-off a reader feels and the cost of ignoring it.",
        fullRead: "The longest tier widens the lens to a different setting, then lands the lesson once, cleanly, before the examples take over.",
      } as any,
    },
  });
  assert.equal(checkMechanicalSeams(clean).length, 0, "clean prose must be SEAM-silent");
});

test("SEAM: the ship gate surfaces a planted stutter as an ENFORCED MAJOR (fails the write self-gate, never a blocker)", () => {
  const ch = makeChapter("zz-seam-gate", 3, {
    overrides: {
      breakdown: {
        fastRead: "A short clean opening tier with ordinary prose throughout this part.",
        deepRead: "The hall opens onto the side side room where the lesson finally lands.",
        fullRead: "The longest tier expands the idea with neutral exposition throughout the whole section here.",
      } as any,
    },
  });
  const report = runShipGate(ch);
  assert.ok(
    report.majors.some((m) => m.catalogId === "SEAM1.adjacent_duplicate_word"),
    `expected a SEAM1 ship-gate major; got: ${report.majors.map((m) => m.catalogId).join(", ")}`,
  );
  // SEAM is ENFORCED (fails runShipGate().passed) but is never a hard blocker.
  assert.ok(ENFORCED_MAJOR.has("SEAM1.adjacent_duplicate_word"), "SEAM1 is enforced (must fix before submit)");
  assert.ok(!report.blockers.some((b) => b.catalogId.startsWith("SEAM")), "SEAM is a MAJOR, not a hard blocker");
});

test("SEAM: synthetic gold corpus has ZERO seam findings", () => {
  for (const { bookId, files } of goldChapterFiles()) {
    for (const file of files) {
      const ch = JSON.parse(readFileSync(file, "utf8")) as ChapterV21;
      assert.equal(checkMechanicalSeams(ch).length, 0, `SEAM false positive on synthetic gold ${bookId} ${ch.chapterId}`);
    }
  }
});

function realGoldFiles(): string[] {
  if (!existsSync(STATE_CHAPTERS)) return [];
  return readdirSync(STATE_CHAPTERS).filter((f) => /^(daring-greatly|start-with-why)-ch\d+\.v21-native\.chapter\.json$/.test(f));
}

xenv(
  "SEAM: real gold chapters (daring-greatly + start-with-why) have ZERO seam findings",
  "requires both real gold corpora under state/chapters/; the clean V25 branch deliberately excludes historical chapter state",
  () => {
    const files = realGoldFiles();
    return files.some((f) => f.startsWith("daring-greatly-ch"))
      && files.some((f) => f.startsWith("start-with-why-ch"));
  },
  () => {
  const files = realGoldFiles();
  for (const f of files) {
    const ch = JSON.parse(readFileSync(resolve(STATE_CHAPTERS, f), "utf8")) as ChapterV21;
    assert.equal(checkMechanicalSeams(ch).length, 0, `SEAM false positive on real gold ${ch.chapterId}`);
  }
  },
);
