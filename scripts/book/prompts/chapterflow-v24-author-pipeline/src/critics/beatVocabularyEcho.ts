/**
 * C33 — beat-vocabulary echo (advisory, CF-I-1 2026-07-09). The v24 brief RESERVES
 * an example-entry beat and an outcome beat per chapter (briefRotation.ts). Those are
 * internal DEALING labels — the writer should render the beat, not the name. On the
 * fresh `multipliers` run the labels leaked into reader prose verbatim: "return point",
 * "early signal", "the late catch", "return moment" recur across chapters as house
 * phrasing (verification report §7.3.3). Left unchecked they become this book's
 * "Agreement nods; commitment signs" — the exact minted-house-voice defect BP34 targets,
 * one abstraction layer up (the CONTRACT's vocabulary, not a single author's line).
 *
 * Two independently-reportable signals, both MINOR/advisory (never block):
 *
 *   PER-CHAPTER (checkBeatVocabularyEcho): a single chapter whose reader-facing prose
 *   carries ≥3 DISTINCT machinery-beat families (machineryPhrases.ts). One chapter
 *   speaking a beat once is a legitimate rendering; three distinct dealt beat names in
 *   one chapter is the contract talking through the prose.
 *
 *   BOOK-LEVEL (checkBookBeatVocabularyEcho): a single beat family surfacing in ≥3
 *   chapters — the same dealt label becoming a book-wide refrain. One advisory per
 *   offending family, naming the chapters (so the CF-I repair lane can re-dispatch).
 *
 * CALIBRATION (why families, why ≥3). The phrase set is PRUNED against the v24 gold
 * corpus: start-with-why is itself a v24 machine-brief book carrying the SAME dealt
 * vocabulary, so broad tokens ("the return", "the late", "early signal" alone) fire on
 * a MAJORITY of gold chapters — the SC9-reversal over-broad trap. The four distinctive
 * families + the ≥3-distinct threshold keep it separable: measured multipliers 4/9 vs
 * gold start-with-why 3/14 (21%, under the 50% ceiling). NOT zero on gold (the leak
 * predates multipliers — it is a contract-level defect the whole v24 fleet shares); the
 * pin asserts the MEASURED count, exactly as C31 does. See tests/beat-vocabulary-echo.test.ts.
 */

import { ChapterV21, CriticFinding } from "../types.js";
import { finding, truncate } from "./shared.js";
import { beatFamiliesInText } from "./machineryPhrases.js";
import type { BookRepetitionFinding } from "./bookRepetition.js";

const MIN_DISTINCT_FAMILIES = 3;      // per-chapter threshold
const MIN_CHAPTERS_FOR_BOOK = 3;      // book-level threshold (a family across ≥3 chapters)

/** The reader-facing prose surfaces a dealt beat name leaks into. Mirrors the set the
 *  cross-book / BP34 audits scan (breakdown tiers + the short authored fields + example
 *  fields + memorable lines + coreSkill) — quiz prompts/explanations are excluded (they
 *  carry their own dealt vocabulary and are covered by C35). */
function readerFacingText(chapter: ChapterV21): string {
  const parts: Array<string | undefined> = [
    chapter.hook,
    chapter.counterintuition,
    chapter.keyTakeaway,
    chapter.tryThisNow,
    chapter.breakdown?.fastRead,
    chapter.breakdown?.deepRead,
    chapter.breakdown?.fullRead,
    chapter.implementationPlan?.coreSkill,
  ];
  for (const ex of chapter.examples ?? []) {
    parts.push(ex.title, ex.scenario, ex.whatToDo, ex.whyItMatters);
  }
  for (const m of chapter.memorableLines ?? []) parts.push(m?.text);
  return parts.filter(Boolean).join(" \n ");
}

/** The DISTINCT beat-family keys present in this chapter's reader-facing prose. Pure. */
export function beatFamiliesInChapter(chapter: ChapterV21): string[] {
  return beatFamiliesInText(readerFacingText(chapter));
}

/**
 * C33 (per-chapter) — one advisory when ≥3 distinct machinery-beat families surface in
 * one chapter's reader-facing prose. MINOR; never blocks.
 */
export function checkBeatVocabularyEcho(chapter: ChapterV21): CriticFinding[] {
  const families = beatFamiliesInChapter(chapter);
  if (families.length < MIN_DISTINCT_FAMILIES) return [];
  return [
    finding(
      "C33.beat_vocabulary_echo" as any,
      "minor",
      `${families.length} distinct dealt beat-labels surface in the reader prose (${families.join(", ")}). These are briefRotation's INTERNAL entry/outcome beat names, not reader language — the writer is rendering the contract's vocabulary instead of the moment. Rewrite each so the beat HAPPENS in the scene (someone catches the miss, the proof comes back or doesn't) without naming the dealt label.`,
      truncate(families.join(", "), 120),
    ),
  ];
}

/**
 * C33 (book-level) — one advisory per beat family that surfaces in ≥3 chapters. Names
 * the chapters so the repair lane can re-dispatch. MINOR; never blocks.
 */
export function checkBookBeatVocabularyEcho(chapters: ChapterV21[]): BookRepetitionFinding[] {
  const byFamily = new Map<string, Set<number>>();
  for (const ch of chapters) {
    for (const key of beatFamiliesInChapter(ch)) {
      if (!byFamily.has(key)) byFamily.set(key, new Set());
      byFamily.get(key)!.add(ch.number);
    }
  }
  const findings: BookRepetitionFinding[] = [];
  for (const [key, chSet] of byFamily) {
    if (chSet.size < MIN_CHAPTERS_FOR_BOOK) continue;
    const chs = [...chSet].sort((a, b) => a - b);
    findings.push({
      ...finding(
        "C33.beat_vocabulary_echo" as any,
        "minor",
        `the dealt beat-label "${key}" surfaces in ${chs.length} chapters (${chs.map((n) => `ch${n}`).join(", ")}). A briefRotation entry/outcome beat name becoming a book-wide refrain reads as house voice, not chapter teaching — render the beat in each scene without naming the label.`,
        key,
      ),
      chapters: chs,
    });
  }
  return findings.sort((a, b) => b.chapters.length - a.chapters.length || a.evidence!.localeCompare(b.evidence!));
}
