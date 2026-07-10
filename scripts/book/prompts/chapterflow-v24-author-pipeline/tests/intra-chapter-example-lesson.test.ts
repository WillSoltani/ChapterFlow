/**
 * C30 — within-chapter example-lesson repetition critic (CF-C, Findings 4/8,
 * 2026-07-08). High-output-management ch7 had 3 of 5 examples dramatizing
 * different scenes but landing the IDENTICAL lesson ("attach the local branch
 * demand signal to central buying"), which QUALITY BAR rule 6 ("each example a
 * DIFFERENT facet") was prompt-only and never enforced. C30 is the deterministic
 * lexical FLOOR: it fires ONE advisory when ≥2 example whyItMatters pairs restate
 * one lesson at high content-lemma overlap.
 *
 * Pins: the discriminator (fires on a same-lesson trio, silent on distinct
 * lessons); the v2 gate (mirrors GN1 — v1/synthetic sidecars return []); and a
 * gold-corpus zero pin on the real reader-quality corpus (start-with-why measures
 * ZERO pairs ≥ threshold, headroom ~0.31 under 0.5).
 */

import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "fs";
import { resolve } from "path";

import { test, xenv } from "./harness.js";
import { STATE_CHAPTERS, PIPELINE_DIR } from "./helpers.js";
import {
  findExampleLessonRepetition,
  checkExampleLessonRepetition,
  EXAMPLE_LESSON_SIMILARITY,
} from "../src/critics/intraChapterExampleLesson.js";
import type { ChapterV21, Example } from "../src/types.js";

const V2 = { schemaVersion: "source-v2" as const };

function chapterWith(lessons: string[]): ChapterV21 {
  return {
    chapterId: "zz-c30-ch01",
    examples: lessons.map((whyItMatters, i) => ({
      exampleId: `ex${String(i + 1).padStart(2, "0")}`,
      title: "t",
      scenario: "A scene.",
      whatToDo: "Do it.",
      whyItMatters,
    })) as unknown as Example[],
  } as unknown as ChapterV21;
}

// A same-lesson TRIO modeled on HOM ch7: three different scenes, one lesson —
// "return the local branch demand signal to central buying". Shared content
// vocabulary across all three pushes every pair over the threshold.
const SAME_LESSON_TRIO = [
  "Attach the local branch demand signal to the central buying decision, or national scale buys the wrong stock blind.",
  "Attach the local branch demand signal to central buying, or national scale saves money while the branch stock stays wrong.",
  "Return the local branch demand signal to central buying, so national scale never buys the wrong branch stock again.",
];

// Five genuinely distinct lessons — different capabilities, different vocabulary.
const DISTINCT_LESSONS = [
  "Name one owner for the date before the plan ships, or nobody carries the deadline.",
  "Count the cost of the pause up front, because an invisible delay always looks free.",
  "Look at the defect early; every downstream step multiplies the price of a late catch.",
  "Write the escalation rule down so a junior can raise the alarm without permission.",
  "Separate expertise from the customer's actual question, or the answer arrives late.",
];

test("C30: findExampleLessonRepetition flags a same-lesson trio (≥2 pairs over threshold)", () => {
  const pairs = findExampleLessonRepetition(chapterWith(SAME_LESSON_TRIO));
  assert.ok(pairs.length >= 2, `the same-lesson trio must yield ≥2 near-duplicate pairs, got ${pairs.length}: ${JSON.stringify(pairs)}`);
  assert.ok(pairs.every((p) => p.jaccard >= EXAMPLE_LESSON_SIMILARITY), "every flagged pair clears the threshold");
});

test("C30: findExampleLessonRepetition is silent on distinct-lesson examples", () => {
  assert.deepEqual(findExampleLessonRepetition(chapterWith(DISTINCT_LESSONS)), [], "distinct lessons share too little vocabulary to flag");
});

test("C30: one pair alone does not fire (needs ≥2 — a single overlap can be coincidence)", () => {
  // Two near-identical lessons + three distinct → exactly one pair, below the ≥2 floor.
  const oneOverlap = [SAME_LESSON_TRIO[0], SAME_LESSON_TRIO[1], DISTINCT_LESSONS[2], DISTINCT_LESSONS[3], DISTINCT_LESSONS[4]];
  const pairs = findExampleLessonRepetition(chapterWith(oneOverlap));
  assert.equal(pairs.length, 1, `expected exactly one near-duplicate pair, got ${pairs.length}`);
  assert.deepEqual(checkExampleLessonRepetition(chapterWith(oneOverlap), V2), [], "one pair is below the ≥2 advisory floor");
});

test("C30: the wired critic is v2-gated — fires on a v2 sidecar, silent on v1/absent (mirrors GN1)", () => {
  const trio = chapterWith(SAME_LESSON_TRIO);
  const fired = checkExampleLessonRepetition(trio, V2);
  assert.equal(fired.length, 1, "one advisory on a v2 chapter with a same-lesson trio");
  assert.equal(fired[0].severity, "minor", "ADVISORY — never blocks");
  assert.match(fired[0].message, /same lesson/i);
  // v1 shapes / no sidecar → zero effect (cannot brick v1 or the synthetic corpus).
  assert.deepEqual(checkExampleLessonRepetition(trio, { schemaVersion: "source-v1", namedExamples: [] }), [], "a rich-v1 sidecar skips C30");
  assert.deepEqual(checkExampleLessonRepetition(trio, null), [], "no sidecar → skip");
  assert.deepEqual(checkExampleLessonRepetition(trio, undefined), [], "undefined override + no on-disk v2 sidecar → skip");
});

// Gold-corpus pin: the real reader-quality corpus measures ZERO example-lesson
// pairs at/over the threshold. Runs where the tracked gold chapters are on disk;
// xenv-skipped on a bare checkout. Measured 2026-07-08: 0 pairs, global max
// within-chapter whyItMatters Jaccard 0.19 (ch12) — ~0.31 headroom under 0.5.
function goldChapterFilesOnDisk(bookId: string): string[] {
  return existsSync(STATE_CHAPTERS)
    ? readdirSync(STATE_CHAPTERS).filter((f) => f.startsWith(`${bookId}-ch`) && f.endsWith(".v21-native.chapter.json"))
    : [];
}
xenv(
  "C30: real gold corpus (start-with-why) emits ZERO example-lesson pairs at/over threshold",
  "start-with-why gold chapters are not on disk (needs state/chapters/start-with-why-ch*)",
  () => goldChapterFilesOnDisk("start-with-why").length > 0,
  () => {
    let checked = 0;
    const hits: string[] = [];
    for (const f of goldChapterFilesOnDisk("start-with-why")) {
      const ch = JSON.parse(readFileSync(resolve(STATE_CHAPTERS, f), "utf8")) as ChapterV21;
      if (!ch.examples?.length) continue;
      checked++;
      const pairs = findExampleLessonRepetition(ch);
      if (pairs.length >= 2) hits.push(`${ch.chapterId}: ${pairs.length} pairs (max ${Math.max(...pairs.map((p) => p.jaccard)).toFixed(2)})`);
    }
    assert.ok(checked > 0, "resolved at least one gold chapter with examples");
    assert.deepEqual(hits, [], `C30 must measure ZERO firing chapters on the real gold corpus; got:\n${hits.join("\n")}`);
  },
);

// Sanity: PIPELINE_DIR resolves (guards the import wiring above).
test("C30: test wiring resolves the pipeline dir", () => {
  assert.ok(existsSync(PIPELINE_DIR), "PIPELINE_DIR must resolve");
});
