/**
 * Reading-level critic. Computes Flesch-Kincaid grade per tier and fails tiers
 * that exceed their target ceiling, plus a whole-breakdown Flesch reading-ease
 * floor so the ASSEMBLED breakdown (not just each tier) clears the rubric band.
 *
 * MEASUREMENT PARITY (P02)
 * ------------------------
 * The book-score rubric (.claude/skills/book-score/RUBRIC.md §11) grades whole-
 * chapter readability as Flesch Reading Ease 72–84 (≈ FK grade ~7–8), measured
 * by score.py. This critic now measures with the SAME ruler: it imports
 * fkGrade / fleschReadingEase from ../metrics/rubricMetrics.js (the verbatim
 * score.py port). One implementation wins — the score.py-parity one — so a book
 * is measured pre-publish against the exact function that scores it after.
 *
 * The old, DIVERGENT FK impl (`fleschKincaid` + `countSyllables`, a different
 * syllable rule and word regex) is kept EXPORTED for back-compat only:
 *   - the legacy per-chapter path (generateChapter.ts, finalGate.ts) measures
 *     with it via LEGACY_TIER_TARGETS so its behaviour is byte-for-byte
 *     unchanged (it was calibrated against that counter);
 *   - readingLevels() display and tests/rubric-metrics.test.ts's documented
 *     divergence assertion still import it.
 * It is NOT the ruler the section gate uses for new authoring.
 *
 * BANDS (P02 calibration — see scratch/calibrate-readability.ts)
 * -------------------------------------------------------------
 * NEW authoring (section gate, TIER_TARGETS) is held to the rubric band:
 *   fastRead FK ≤ 7.0, deepRead ≤ 8.5, fullRead ≤ 9.5, and the assembled
 *   breakdown must read at Flesch ease ≥ 70. Ceilings only ever get TIGHTER.
 * The legacy path keeps the old, looser ceilings (LEGACY_TIER_TARGETS) so no
 * previously-shipped chapter regresses through generateChapter/finalGate.
 */

import { CriticFinding } from "../types.js";
import { finding } from "./shared.js";
import { fkGrade, fleschReadingEase } from "../metrics/rubricMetrics.js";

export type TierName = "fastRead" | "deepRead" | "fullRead";

export type TierTargetSet = {
  fastRead: { hi: number; label: string };
  deepRead: { hi: number; label: string };
  fullRead: { hi: number; label: string };
  /** Grade measurement — the canonical set uses score.py-parity fkGrade. */
  measure: (text: string) => number;
  /** Human label for the grade metric (goes into the finding message). */
  measureLabel: string;
};

/**
 * NEW calibrated bands for new authoring (section gate). Tightened from the old
 * fastRead ≤8.5 / deepRead ≤11 / fullRead ≤12 to bracket the rubric's FK ~7–8
 * target, measured with the score.py-parity counter.
 */
export const TIER_TARGETS: TierTargetSet = {
  fastRead: { hi: 7.0, label: "grade ≤7" },
  deepRead: { hi: 8.5, label: "grade ≤8.5" },
  fullRead: { hi: 9.5, label: "grade ≤9.5" },
  measure: fkGrade,
  measureLabel: "Flesch-Kincaid grade",
};

/**
 * Whole-breakdown Flesch Reading Ease floor. The rubric band is 72–84; new
 * authoring must land the ASSEMBLED breakdown at or above this floor so the
 * aggregate — not just each tier — clears the band.
 */
export const BREAKDOWN_READING_EASE_FLOOR = 70;

/**
 * Legacy ceilings + legacy counter. Frozen: the per-chapter path was calibrated
 * against these values and the divergent `fleschKincaid` counter, so it keeps
 * measuring with both to guarantee zero behaviour change on already-shipped
 * content. New enforcement (tighter ceilings, the ease floor) lives only on the
 * section-gate path via TIER_TARGETS.
 */
export const LEGACY_TIER_TARGETS: TierTargetSet = {
  fastRead: { hi: 8.5, label: "grade 7–8" },
  deepRead: { hi: 11, label: "grade 9–11" },
  fullRead: { hi: 12, label: "grade 10–12" },
  measure: fleschKincaid,
  measureLabel: "Flesch-Kincaid grade (legacy)",
};

/** Legacy divergent FK impl — kept for back-compat only (see docblock). */
export function fleschKincaid(text: string): number {
  const sentences = text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  const words = (text.match(/\b[A-Za-z'-]+\b/g) ?? []) as string[];
  if (sentences.length === 0 || words.length === 0) return 0;
  const syllables = words.reduce((acc, w) => acc + countSyllables(w), 0);
  const grade = 0.39 * (words.length / sentences.length) + 11.8 * (syllables / words.length) - 15.59;
  return Math.round(grade * 10) / 10;
}

/** Legacy syllable counter — kept for back-compat (countAbstractWords, the
 *  divergence assertion in tests/rubric-metrics.test.ts). Deliberately NOT the
 *  score.py-parity `syllables`; the two disagree (e.g. "table" → 2 vs 1), which
 *  is exactly why the canonical measurement now imports fkGrade instead. */
export function countSyllables(word: string): number {
  let w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "");
  w = w.replace(/^y/, "");
  const m = w.match(/[aeiouy]+/g);
  return Math.max(1, m ? m.length : 0);
}

/** Per-paragraph "abstract word density" — counts 4+ syllable words. Used as
 *  a supplementary check on fastRead, where conceptual load matters more
 *  than FK can capture.
 *
 *  `exemptTokens` (lower-cased) holds the words the chapter is ABOUT — the source
 *  packet's own entity/place vocabulary. A long proper noun is not academic
 *  vocabulary the writer can swap for a plainer word: it is the subject, and
 *  counting it made a per-paragraph budget of 2 unspendable for any chapter whose
 *  material is named in long words. Everything else is still counted. */
export function countAbstractWords(text: string, exemptTokens: ReadonlySet<string> = new Set()): number {
  const words = (text.match(/\b[A-Za-z'-]+\b/g) ?? []) as string[];
  return words.filter((w) => countSyllables(w) >= 4 && !exemptTokens.has(w.toLowerCase())).length;
}

export function checkReadingLevel(
  text: string,
  tier: TierName,
  targets: TierTargetSet = TIER_TARGETS,
  /** Subject vocabulary exempt from the abstract-density count (see
   *  countAbstractWords). Empty for the legacy per-chapter callers, whose
   *  behaviour is therefore byte-identical. */
  abstractDensityExemptTokens: ReadonlySet<string> = new Set(),
): CriticFinding[] {
  const target = targets[tier];
  const findings: CriticFinding[] = [];

  const grade = targets.measure(text);
  if (Number.isFinite(grade) && grade > target.hi) {
    findings.push(
      finding(
        "prose.reading_level",
        "major",
        `${tier}: ${targets.measureLabel} ${grade.toFixed(1)} exceeds ceiling ${target.hi} (target ${target.label}). Shorten sentences or use plainer words.`,
      ),
    );
  }

  // fastRead also needs to clear the conceptual-load bar
  if (tier === "fastRead") {
    const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    paragraphs.forEach((p, i) => {
      const abstract = countAbstractWords(p, abstractDensityExemptTokens);
      if (abstract > 2) {
        findings.push(
          finding(
            "prose.abstract_density",
            "minor",
            `fastRead ¶${i + 1}: ${abstract} four-plus-syllable words (max 2 for a beginner reader). Replace academic vocabulary with plain words.`,
          ),
        );
      }
    });
  }

  return findings;
}

/**
 * Whole-breakdown Flesch reading-ease floor. Runs on the three tiers
 * CONCATENATED so the assembled breakdown a reader actually sees clears the
 * rubric band, even when each tier passes its per-tier FK ceiling alone.
 * Severity `major` here; the section gate wraps it as a SEC12 blocker.
 */
export function checkBreakdownReadingEase(
  breakdownText: string,
  floor: number = BREAKDOWN_READING_EASE_FLOOR,
): CriticFinding[] {
  const ease = fleschReadingEase(breakdownText);
  if (Number.isFinite(ease) && ease < floor) {
    return [
      finding(
        "prose.reading_ease",
        "major",
        `assembled breakdown reads at Flesch ease ${ease.toFixed(1)}, below the floor ${floor} (rubric band 72–84). Prefer short sentences and plain, concrete verbs over abstractions.`,
      ),
    ];
  }
  return [];
}

export const READING_LEVEL_TARGETS = TIER_TARGETS;
