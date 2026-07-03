/**
 * Intra-book cross-chapter checks (AS5–AS12) — the templating detectors that
 * compare a chapter against its siblings.
 *
 * HISTORY: until Phase 1 this composition lived inline in cli.ts's
 * gate-chapter handler, which meant the ONLY command that ran it was
 * gate-chapter — promote-book and batch shipped without it (verified
 * 2026-06-09: the unreasonable-hospitality identical-card-backs incident
 * class passed promote cleanly). It is now a module so the ship path
 * (promoteBook) enforces the same checks the authoring loop does.
 *
 * Two entry points:
 *   - runIntraBookChecks(chapter, siblings)      — pure; promote passes its
 *     already-loaded chapters, so no disk discovery can silently miss.
 *   - loadSiblingChapters(chapter, chapterFile)  — disk discovery for the
 *     CLI case (gate-chapter is handed one file). Case-insensitive via the
 *     shared resolver (the old inline regex was the casing-bug class).
 */

import { readdirSync, readFileSync } from "fs";
import { dirname, resolve } from "path";

import { ChapterV21, CriticFinding } from "../types.js";
import { isSiblingFile, parseChapterId } from "../lib/chapterPaths.js";
import { checkIntraBookQuizSimilarity } from "./intraBookQuizSimilarity.js";
import {
  checkIntraBookBreakdownParagraphVerbatim,
  checkIntraBookCardSimilarity,
  checkIntraBookExampleSimilarity,
  checkIntraBookLiteralNgrams,
  checkIntraBookPlanSimilarity,
  checkIntraBookQuizPositionMatch,
} from "./intraBookFieldSimilarity.js";

/**
 * AS5/AS6 (quiz prompt+distractor) + AS7 (cards) + AS8 (plan) + AS9 (example
 * word-multiset) + AS10 (literal 5-gram in examples + breakdown) + AS11
 * (breakdown paragraph verbatim) + AS12 (quiz correctIndex sequence) — all
 * chapter-time intra-book detectors. Built incrementally as the writer-agent
 * gaming pattern moved across fields in successive incidents:
 *   round 1: salting (AS1-AS4)
 *   round 2: quiz template (AS5-AS6)
 *   round 3: card/plan template (AS7-AS8)
 *   round 4: example scenario template (AS9)
 *   round 5: stock-phrase n-grams in whatToDo/whyItMatters under AS9's
 *            70% multiset floor; whole-paragraph reuse in breakdown;
 *            fixed correctIndex rotation (AS10-AS12)
 * Together they cover the literal-verbatim, paragraph-verbatim, and
 * structural-position gaps that AS5-AS9's multiset-similarity floor
 * can't reach.
 */
export function runIntraBookChecks(chapter: ChapterV21, siblings: ChapterV21[]): CriticFinding[] {
  if (siblings.length === 0) return [];
  return [
    ...checkIntraBookQuizSimilarity(chapter, siblings),
    ...checkIntraBookCardSimilarity(chapter, siblings),
    ...checkIntraBookPlanSimilarity(chapter, siblings),
    ...checkIntraBookExampleSimilarity(chapter, siblings),
    ...checkIntraBookLiteralNgrams(chapter, siblings),
    ...checkIntraBookBreakdownParagraphVerbatim(chapter, siblings),
    ...checkIntraBookQuizPositionMatch(chapter, siblings),
  ];
}

export type SiblingLoadResult = {
  siblings: ChapterV21[];
  /** Set when sibling discovery found nothing for a ch2+ chapter — either a
   *  genuine first chapter or (the bug class) a slug/casing mismatch that
   *  silently excluded them. Callers must PRINT this; it is not a pass. */
  warning?: string;
};

/** Load every sibling chapter of the same book from the chapter file's own
 *  directory. The book ID is parsed case-insensitively from chapterId and
 *  matched via the shared resolver (chapterPaths.isSiblingFile). */
export function loadSiblingChapters(chapter: ChapterV21, chapterFile: string): SiblingLoadResult {
  const parsed = chapter.chapterId ? parseChapterId(chapter.chapterId) : null;
  if (!parsed) {
    return {
      siblings: [],
      warning:
        `intra-book critics DID NOT RUN — could not parse chapterId "${chapter.chapterId}". ` +
        `This is NOT a pass; fix the chapterId (run fix-chapter-ids).`,
    };
  }
  const bookId = parsed.bookId;
  const dir = dirname(resolve(chapterFile));
  const siblings: ChapterV21[] = [];
  try {
    for (const entry of readdirSync(dir)) {
      if (!isSiblingFile(entry, bookId)) continue;
      const full = resolve(dir, entry);
      if (full === resolve(chapterFile)) continue; // skip the chapter being gated
      try {
        siblings.push(JSON.parse(readFileSync(full, "utf8")) as ChapterV21);
      } catch {
        // skip unreadable siblings
      }
    }
  } catch {
    return { siblings: [] };
  }
  if (siblings.length === 0 && parsed.num > 1) {
    return {
      siblings,
      warning:
        `intra-book critics DID NOT RUN — 0 sibling chapters found for "${bookId}" in ${dir} ` +
        `(expected priors for ch${parsed.num}). This is NOT a pass; check chapterId/filename slug.`,
    };
  }
  return { siblings };
}
