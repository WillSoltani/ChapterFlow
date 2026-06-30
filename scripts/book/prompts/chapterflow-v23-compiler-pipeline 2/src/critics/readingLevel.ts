/**
 * Reading-level critic. Computes Flesch-Kincaid grade level per tier and
 * fails tiers that exceed their target ceiling.
 *
 * Note: Flesch-Kincaid measures only sentence length and syllable count. It
 * undercounts conceptual difficulty (a short sentence with "plausibility"
 * still reads as easy by FK). To compensate we also flag a per-paragraph
 * "abstract word density" measure: any paragraph in fastRead with more than
 * 2 four-plus-syllable words is flagged.
 */

import { CriticFinding } from "../types.js";
import { finding } from "./shared.js";

// Reading-level ceilings tightened after user feedback: "a grade 10–12 should
// be able to easily read the content." fullRead used to be unbounded (grade
// 12+ unlimited); it's now capped at grade 12 max. deepRead drops from 12.5
// to 11. fastRead drops from 9.5 to 8.5 — still well above where current books
// actually land but a real ceiling.
const TIER_TARGETS = {
  fastRead: { lo: 6, hi: 8.5, label: "grade 7–8" },
  deepRead: { lo: 8, hi: 11, label: "grade 9–11" },
  fullRead: { lo: 9, hi: 12, label: "grade 10–12" },
} as const;

type TierName = keyof typeof TIER_TARGETS;

export function fleschKincaid(text: string): number {
  const sentences = text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  const words = (text.match(/\b[A-Za-z'-]+\b/g) ?? []) as string[];
  if (sentences.length === 0 || words.length === 0) return 0;
  const syllables = words.reduce((acc, w) => acc + countSyllables(w), 0);
  const grade = 0.39 * (words.length / sentences.length) + 11.8 * (syllables / words.length) - 15.59;
  return Math.round(grade * 10) / 10;
}

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
 *  than FK can capture. */
export function countAbstractWords(text: string): number {
  const words = (text.match(/\b[A-Za-z'-]+\b/g) ?? []) as string[];
  return words.filter((w) => countSyllables(w) >= 4).length;
}

export function checkReadingLevel(text: string, tier: TierName): CriticFinding[] {
  const target = TIER_TARGETS[tier];
  const findings: CriticFinding[] = [];

  const grade = fleschKincaid(text);
  if (grade > target.hi) {
    findings.push(
      finding(
        "register.no_meta_reference" as any,
        "major",
        `${tier}: Flesch-Kincaid grade ${grade} exceeds ceiling ${target.hi} (target ${target.label}). Shorten sentences or use plainer words.`,
      ),
    );
  }

  // fastRead also needs to clear the conceptual-load bar
  if (tier === "fastRead") {
    const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    paragraphs.forEach((p, i) => {
      const abstract = countAbstractWords(p);
      if (abstract > 2) {
        findings.push(
          finding(
            "register.no_meta_reference" as any,
            "minor",
            `fastRead ¶${i + 1}: ${abstract} four-plus-syllable words (max 2 for grade 8–9 reader). Replace academic vocabulary with plain words.`,
          ),
        );
      }
    });
  }

  return findings;
}

export const READING_LEVEL_TARGETS = TIER_TARGETS;
