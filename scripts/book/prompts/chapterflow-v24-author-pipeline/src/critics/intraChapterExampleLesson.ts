/**
 * Within-chapter example-lesson repetition critic (C30) — Findings 4/8 (CF-C,
 * 2026-07-08). A chapter whose examples each dramatize a DIFFERENT scene but land
 * the SAME lesson (high-output-management ch7 had 3 of 5 examples teaching the
 * identical move — "attach the local demand signal to central buying" — despite
 * QUALITY BAR rule 6's "each example teaches a DIFFERENT facet"). Rule 6 was
 * prompt-only and unenforced (gap G5); C30 is the orthogonal DETERMINISTIC signal
 * so the debt is structured + repair-routable, not only in the reader's head.
 *
 * THE DISCRIMINATOR. C30 compares each pair of the chapter's example lesson fields
 * (whyItMatters — the "why it matters" is where the reusable lesson lives) by
 * content-lemma Jaccard, and fires ONE advisory only when ≥2 pairs restate the
 * same lesson at a HIGH lexical-overlap threshold. This is a lexical FLOOR, not the
 * semantic judgment: a writer who rewords the same lesson into disjoint vocabulary
 * (HOM ch7's real prose measures <0.19 pairwise) slides under it — that reworded
 * case is the blinded reader's + example_coherence bar's job. C30 catches the cheap
 * templated path (the same lesson restated in the same words across slots), the way
 * AS9/B15 catch their lexical floors.
 *
 * SEVERITY: MINOR (advisory) — never blocks (the standing rule: lexical quality
 * gates measured INVERTED on the owner top-5). V2-GATED (mirrors GN1/SC11): runs
 * only when the chapter's sidecar is source-v2, so v1 books and the synthetic gold
 * (no on-disk sidecar) are zero-effect by construction. The pure detector
 * `findExampleLessonRepetition` is exported for direct calibration; the real gold
 * corpus (start-with-why) measures ZERO pairs ≥ threshold. See
 * tests/intra-chapter-example-lesson.test.ts.
 */

import { ChapterV21, CriticFinding } from "../types.js";
import { finding, pickEvidence, truncate } from "./shared.js";
import { contentLemmaSet } from "./intraBookFieldSimilarity.js";
import { loadChapterSidecar } from "./sourceGrounding.js";
import { detectSidecarShape } from "../source/sidecarSchema.js";

// Content-lemma Jaccard above which two example lessons are restating the SAME
// lesson. Calibrated 2026-07-08: the real gold corpus (start-with-why, 14 ch)
// tops out at 0.19 within-chapter whyItMatters Jaccard — 0.5 leaves ~0.31 of
// headroom while still catching a templated trio (whose reworded siblings share
// well over half their content lemmas).
export const EXAMPLE_LESSON_SIMILARITY = 0.5;
// A lesson with too few content lemmas makes Jaccard swing on a handful of shared
// words; require this many on BOTH sides before the ratio is trustworthy.
const EXAMPLE_LESSON_MIN_LEMMAS = 8;
// ≥ this many near-duplicate pairs before the chapter is flagged — a single shared
// pair can be coincidence; two pairs is a pattern (a same-lesson trio yields three).
const EXAMPLE_LESSON_MIN_PAIRS = 2;

export type ExampleLessonPair = { a: number; b: number; jaccard: number };

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

/** Pure detector: every pair of the chapter's example whyItMatters fields whose
 *  content-lemma Jaccard clears the same-lesson threshold. Deterministic; no disk. */
export function findExampleLessonRepetition(chapter: ChapterV21): ExampleLessonPair[] {
  const examples = chapter.examples ?? [];
  const sets = examples.map((ex) => {
    const w = pickEvidence(ex?.whyItMatters as never);
    return w ? contentLemmaSet(w) : new Set<string>();
  });
  const pairs: ExampleLessonPair[] = [];
  for (let i = 0; i < sets.length; i++) {
    for (let j = i + 1; j < sets.length; j++) {
      if (sets[i].size < EXAMPLE_LESSON_MIN_LEMMAS || sets[j].size < EXAMPLE_LESSON_MIN_LEMMAS) continue;
      const sim = jaccard(sets[i], sets[j]);
      if (sim >= EXAMPLE_LESSON_SIMILARITY) pairs.push({ a: i, b: j, jaccard: sim });
    }
  }
  return pairs;
}

/** C30 — one advisory when ≥2 example pairs restate the same lesson. V2-gated;
 *  `sidecarOverride` injects a sidecar so a test drives the gate without disk. */
export function checkExampleLessonRepetition(chapter: ChapterV21, sidecarOverride?: unknown): CriticFinding[] {
  const sidecar = sidecarOverride ?? (chapter.chapterId ? loadChapterSidecar(chapter.chapterId) : null);
  if (detectSidecarShape(sidecar) !== "v2") return []; // v2-only — v1/synthetic cannot brick

  const pairs = findExampleLessonRepetition(chapter);
  if (pairs.length < EXAMPLE_LESSON_MIN_PAIRS) return [];

  const examples = chapter.examples ?? [];
  const label = (i: number): string => examples[i]?.exampleId ?? `example[${i}]`;
  const top = [...pairs].sort((x, y) => y.jaccard - x.jaccard).slice(0, 3);
  const listed = top
    .map((p) => `${label(p.a)}↔${label(p.b)} (${(p.jaccard * 100).toFixed(0)}%)`)
    .join("; ");
  const worst = pickEvidence(examples[top[0].a]?.whyItMatters as never);
  return [
    finding(
      "C30.example_lesson_repetition" as any,
      "minor",
      `${pairs.length} example pair(s) restate the same lesson at ≥${(EXAMPLE_LESSON_SIMILARITY * 100).toFixed(0)}% content overlap: ${listed}. Each example must serve THIS chapter's job through a DIFFERENT facet or failure-mode — right now the reader meets one lesson dressed as several. Rewrite the overlapping examples' whyItMatters around distinct facets, or merge them and spend the freed slot on a facet you have not shown.`,
      truncate(worst, 160),
    ),
  ];
}
