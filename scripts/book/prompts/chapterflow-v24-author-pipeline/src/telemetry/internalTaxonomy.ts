/**
 * IMP-06 — the internal-taxonomy catalog + anti-leakage checks (instruction 11).
 *
 * The pipeline's dealt pools and telemetry schemas are INTERNAL vocabulary. Two
 * leakage surfaces are checked, with different strictness:
 *
 *  CARD side — the de-recipe (chapterBrief render) removed the demoted taxonomy
 *  from writer-visible text. CARD_FORBIDDEN_LABELS is the full demoted set; the
 *  render tests assert none of it appears on a brief/card. (The RETAINED dials —
 *  openerType, challengeFrame, practiceShape, architectureFamily — render their
 *  label by design; they are allocation modes, not scene recipes, and are NOT in
 *  the card-forbidden set.)
 *
 *  PROSE side — reader prose must contain NO internal label at all, including
 *  the retained dials (a chapter that says "single-deep-case" leaked machinery —
 *  the red-team item "writer reproduces an internal feature label verbatim").
 *  PROSE_FORBIDDEN_LABELS is restricted to DISTINCTIVE forms (hyphenated or
 *  multi-word) so ordinary English ("failure", "reversal", "appositive") can
 *  never false-positive; single common words are deliberately excluded even
 *  though they name pool members.
 *
 * The check is SHADOW telemetry (surfaced via the diversity report), not a gate.
 */

import type { ChapterV21 } from "../types.js";
import {
  ARCHITECTURE_FAMILIES,
  CHALLENGE_FRAMES,
  EXAMPLE_ENTRY_POINTS,
  EXAMPLE_LENSES,
  GROUNDING_FORMS,
  IDIOM_FAMILIES,
  LIMITS_PLACEMENTS,
  MEMORABLE_SHAPES,
  PRACTICE_SHAPES,
  QUIZ_FAILURE_MODES,
  QUIZ_STEM_SHAPES,
  SHELL_REGISTERS,
  FIELD_STYLES,
  OPENER_TYPES,
  PRACTICE_VERBS,
} from "../compiler/briefRotation.js";
import { CONTENT_DEVICE_IDS } from "../compiler/contentDeviceDeal.js";
import { DIVERSITY_CHECK_CLASSES } from "./diversityConfig.js";

/** A label is DISTINCTIVE when it cannot plausibly occur in natural reader prose:
 *  hyphenated compounds and multi-word ids qualify; single dictionary words do not. */
export function isDistinctiveLabel(label: string): boolean {
  return /[-_]/.test(label) || /\s/.test(label.trim());
}

/** The DEMOTED taxonomy — pool vocabularies that must never render on a writer
 *  card after the IMP-06 de-recipe. (Retained dials are excluded by design.) */
export const CARD_FORBIDDEN_LABELS: readonly string[] = [
  ...EXAMPLE_LENSES,
  ...EXAMPLE_ENTRY_POINTS,
  ...FIELD_STYLES,
  ...IDIOM_FAMILIES,
  ...SHELL_REGISTERS,
  ...GROUNDING_FORMS,
  ...PRACTICE_VERBS.filter(isDistinctiveLabel), // "read-aloud", "cross-out" — bare verbs are legal English
  ...MEMORABLE_SHAPES.map((s) => `${s} (`), // list-render form ("reversal (a line that…")
  ...DIVERSITY_CHECK_CLASSES,
].filter((l, i, a) => a.indexOf(l) === i);

/** Every internal label with a DISTINCTIVE form — the reader-prose scan set.
 *  Includes the retained dials (legal on cards, never in prose). */
export const PROSE_FORBIDDEN_LABELS: readonly string[] = [
  ...ARCHITECTURE_FAMILIES,
  ...OPENER_TYPES,
  ...CHALLENGE_FRAMES,
  ...PRACTICE_SHAPES,
  ...EXAMPLE_LENSES,
  ...EXAMPLE_ENTRY_POINTS,
  ...FIELD_STYLES,
  ...QUIZ_STEM_SHAPES,
  ...QUIZ_FAILURE_MODES,
  ...MEMORABLE_SHAPES,
  ...LIMITS_PLACEMENTS,
  ...GROUNDING_FORMS,
  ...IDIOM_FAMILIES,
  ...SHELL_REGISTERS,
  ...PRACTICE_VERBS,
  ...CONTENT_DEVICE_IDS,
  ...DIVERSITY_CHECK_CLASSES,
]
  .filter(isDistinctiveLabel)
  .filter((l, i, a) => a.indexOf(l) === i);

function readerProse(chapter: ChapterV21): string {
  const parts: string[] = [];
  const push = (v: unknown): void => { if (typeof v === "string" && v) parts.push(v); };
  push(chapter.hook); push(chapter.counterintuition); push(chapter.tryThisNow); push(chapter.keyTakeaway);
  push(chapter.breakdown?.fastRead); push(chapter.breakdown?.deepRead); push(chapter.breakdown?.fullRead);
  for (const ex of chapter.examples ?? []) { push(ex?.title); push(ex?.scenario); push(ex?.whatToDo); push(ex?.whyItMatters); }
  for (const q of chapter.quiz?.questions ?? []) { push(q?.prompt); for (const c of q?.choices ?? []) push(c); push(q?.explanation); }
  for (const c of chapter.reviewCards ?? []) { push(c?.front); push(c?.back); }
  for (const m of chapter.memorableLines ?? []) push(m?.text);
  push(chapter.implementationPlan?.coreSkill);
  return parts.join("\n");
}

/** Internal labels found verbatim in a chapter's reader prose (case-insensitive,
 *  word-boundary-anchored). [] = clean. Shadow telemetry, never a gate. */
export function taxonomyLeaksInProse(chapter: ChapterV21): string[] {
  const prose = readerProse(chapter).toLowerCase();
  const leaks: string[] = [];
  for (const label of PROSE_FORBIDDEN_LABELS) {
    const needle = label.toLowerCase();
    const rx = new RegExp(`(?:^|[^a-z0-9-])${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:$|[^a-z0-9-])`);
    if (rx.test(prose)) leaks.push(label);
  }
  return leaks;
}
