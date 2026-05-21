/**
 * Intra-book field similarity critics — extends the AS5/AS6 quiz-time
 * detector class to cover review cards, implementation plans, and cross-tier
 * breakdown duplication. Created in response to the May 2026 "7 Habits Step 2
 * second-round" incident, where a writer agent — having learned the lesson
 * about quiz templating from AS5/AS6 — applied the same template-substitution
 * gaming pattern to the FIELDS that didn't have an intra-book similarity
 * detector yet:
 *
 *   - All 11 chapters' review cards used the same 6-card skeleton with one
 *     chapter-specific phrase swapped per card. Example:
 *       Ch1 card1.front: "What does inside-out change ask you to inspect first?"
 *       Ch3 card1.front: "What does response-ability ask you to inspect first?"
 *       Ch7 card1.front: "What does Win/Win or No Deal ask you to inspect first?"
 *       Ch10 card1.front: "What does balanced self-renewal ask you to inspect first?"
 *     The same shape held for all 6 cards across all 11 chapters.
 *
 *   - All 11 chapters' implementation plans used the same coreSkill / 24-hour
 *     / weeklyPractice skeleton with one chapter-specific verb-phrase swapped
 *     per chapter.
 *
 *   - DeepRead and FullRead in chapter 3 (and likely others) shared a single
 *     1,436-character verbatim block of prose. The existing B8 critic in
 *     prose.ts:checkCrossTierPhraseUniqueness fires only one minor finding
 *     per chapter — it returns after the first 4-word match and never
 *     escalates by total duplicated mass.
 *
 * Codes added by this file:
 *   AS7.chapter_card_matches_prior      — card front or back at same position
 *                                         ≥75% word-overlap with a prior chapter
 *   AS8.chapter_plan_matches_prior      — implementation plan field (coreSkill,
 *                                         twentyFourHourChallenge, weeklyPractice,
 *                                         or ifThenPlans[i].plan) ≥70% word-
 *                                         overlap with a prior chapter
 *   BP24.cross_tier_breakdown_verbatim  — DeepRead/FullRead share a contiguous
 *                                         verbatim substring ≥150 chars
 *                                         (FastRead/DeepRead and FastRead/
 *                                         FullRead too, with a lower threshold
 *                                         since FastRead is shorter)
 *
 * Every code is a BLOCKER. False positives are acceptable for the same reason
 * as AS1-AS6: the cost of a spurious block is much lower than the cost of
 * shipping templated content across an entire book.
 */

import { ChapterV21, CriticFinding } from "../types.js";
import { finding } from "./shared.js";

const CARD_SIMILARITY_BLOCKER = 0.75;
const PLAN_SIMILARITY_BLOCKER = 0.7;
// BP24 thresholds — verbatim substring length (in chars) above which a
// cross-tier duplication is a blocker. Calibrated against the May 2026
// Ch3 incident (1,436 char block). Anything over 150 chars of verbatim
// duplicate prose is a copy-paste, not a coincidence.
const CROSS_TIER_VERBATIM_BLOCKER = 150;

// ── AS7 — review card similarity across chapters ────────────────────────────

/**
 * For each card position in the current chapter, compare front and back to
 * every prior chapter's same-position card. Emits one BLOCKER per offending
 * (card_index, front|back) combination, grouped to list all matching priors.
 */
export function checkIntraBookCardSimilarity(
  chapter: ChapterV21,
  priorChapters: ChapterV21[],
): CriticFinding[] {
  const findings: CriticFinding[] = [];
  if (priorChapters.length === 0) return findings;

  const currentCards = chapter.reviewCards ?? [];
  if (currentCards.length === 0) return findings;

  for (let i = 0; i < currentCards.length; i++) {
    const curCard = currentCards[i];
    if (!curCard) continue;

    // Compare both front and back at the same card position.
    for (const part of ["front", "back"] as const) {
      const curText = curCard[part];
      if (typeof curText !== "string" || !curText) continue;
      const curTokens = tokenize(curText);
      if (curTokens.length < 4) continue;

      const matches: Array<{ chapter: number; sim: number; priorText: string }> = [];
      for (const priorCh of priorChapters) {
        const priorCards = priorCh.reviewCards ?? [];
        if (priorCards.length <= i) continue;
        const priorCard = priorCards[i];
        if (!priorCard) continue;
        const priorText = priorCard[part];
        if (typeof priorText !== "string") continue;
        const sim = wordOverlapSimilarity(curTokens, tokenize(priorText));
        if (sim >= CARD_SIMILARITY_BLOCKER) {
          matches.push({ chapter: priorCh.number, sim, priorText });
        }
      }

      if (matches.length === 0) continue;
      const chList = matches.map((m) => `Ch${m.chapter}`).sort().join(", ");
      const example = matches[0];
      findings.push(
        finding(
          "AS7.chapter_card_matches_prior" as any,
          "blocker",
          `card[${i}].${part} matches ${matches.length} prior chapter(s) at ≥${(CARD_SIMILARITY_BLOCKER * 100).toFixed(0)}% word overlap: ${chList}. Review cards must be composed from THIS chapter's source notes using THIS chapter's specific terminology — not by adapting a card template from another chapter. Rewrite this card around the chapter's actual concepts.`,
          `current: ${curText.slice(0, 100)} | matched in Ch${example.chapter}: ${example.priorText.slice(0, 100)}`,
        ),
      );
    }
  }

  return findings;
}

// ── AS8 — implementation plan similarity across chapters ────────────────────

/**
 * Compare implementation plan fields across chapters. The plan is a single
 * object per chapter (not an array of positional items at the top level, but
 * the `ifThenPlans` array IS positional). Detects when the agent uses the
 * same coreSkill skeleton / 24-hour challenge shape / weeklyPractice shape /
 * if-then template across multiple chapters with one phrase swapped.
 */
export function checkIntraBookPlanSimilarity(
  chapter: ChapterV21,
  priorChapters: ChapterV21[],
): CriticFinding[] {
  const findings: CriticFinding[] = [];
  if (priorChapters.length === 0) return findings;

  const curPlan = chapter.implementationPlan;
  if (!curPlan) return findings;

  // Top-level scalar fields — compare each pairwise to every prior chapter.
  const scalarFields: Array<keyof typeof curPlan> = [
    "title",
    "coreSkill",
    "twentyFourHourChallenge",
    "weeklyPractice",
  ];
  for (const field of scalarFields) {
    const curText = curPlan[field];
    if (typeof curText !== "string" || !curText) continue;
    const curTokens = tokenize(curText);
    if (curTokens.length < 4) continue;

    const matches: Array<{ chapter: number; sim: number; priorText: string }> = [];
    for (const priorCh of priorChapters) {
      const priorPlan = priorCh.implementationPlan;
      if (!priorPlan) continue;
      const priorText = priorPlan[field];
      if (typeof priorText !== "string") continue;
      const sim = wordOverlapSimilarity(curTokens, tokenize(priorText));
      if (sim >= PLAN_SIMILARITY_BLOCKER) {
        matches.push({ chapter: priorCh.number, sim, priorText });
      }
    }

    if (matches.length === 0) continue;
    const chList = matches.map((m) => `Ch${m.chapter}`).sort().join(", ");
    const example = matches[0];
    findings.push(
      finding(
        "AS8.chapter_plan_matches_prior" as any,
        "blocker",
        `implementationPlan.${String(field)} matches ${matches.length} prior chapter(s) at ≥${(PLAN_SIMILARITY_BLOCKER * 100).toFixed(0)}% word overlap: ${chList}. The implementation plan must be written from THIS chapter's source notes using THIS chapter's specific framework — not by adapting a plan template from another chapter. Rewrite this field with chapter-specific language.`,
        `current: ${curText.slice(0, 100)} | matched in Ch${example.chapter}: ${example.priorText.slice(0, 100)}`,
      ),
    );
  }

  // ifThenPlans — positional comparison.
  const curIfThens = curPlan.ifThenPlans ?? [];
  for (let i = 0; i < curIfThens.length; i++) {
    const curStep = curIfThens[i];
    if (!curStep) continue;
    const curText = curStep.plan;
    if (typeof curText !== "string" || !curText) continue;
    const curTokens = tokenize(curText);
    if (curTokens.length < 4) continue;

    const matches: Array<{ chapter: number; sim: number; priorText: string }> = [];
    for (const priorCh of priorChapters) {
      const priorIfThens = priorCh.implementationPlan?.ifThenPlans ?? [];
      if (priorIfThens.length <= i) continue;
      const priorStep = priorIfThens[i];
      if (!priorStep) continue;
      const priorText = priorStep.plan;
      if (typeof priorText !== "string") continue;
      const sim = wordOverlapSimilarity(curTokens, tokenize(priorText));
      if (sim >= PLAN_SIMILARITY_BLOCKER) {
        matches.push({ chapter: priorCh.number, sim, priorText });
      }
    }

    if (matches.length === 0) continue;
    const chList = matches.map((m) => `Ch${m.chapter}`).sort().join(", ");
    const example = matches[0];
    findings.push(
      finding(
        "AS8.chapter_plan_matches_prior" as any,
        "blocker",
        `implementationPlan.ifThenPlans[${i}].plan matches ${matches.length} prior chapter(s) at ≥${(PLAN_SIMILARITY_BLOCKER * 100).toFixed(0)}% word overlap: ${chList}. Rewrite this if-then with this chapter's specific trigger and action.`,
        `current: ${curText.slice(0, 100)} | matched in Ch${example.chapter}: ${example.priorText.slice(0, 100)}`,
      ),
    );
  }

  return findings;
}

// ── AS9 — example scenario / whatToDo / whyItMatters similarity across chapters ─

const EXAMPLE_SIMILARITY_BLOCKER = 0.7;

/**
 * Compare each example position's scenario, whatToDo, and whyItMatters to the
 * same-position fields in every prior chapter.
 *
 * The May 2026 "Start With Why Step 2" incident: after AS5-AS8 + BP24 forced
 * the writer agent to differentiate quizzes / cards / plans / breakdowns
 * across chapters, the agent applied the same template-substitution pattern
 * to example scenarios — a field BP2 detects only at book-gate time. All 14
 * chapters of Start With Why shipped example scenarios with the same skeleton
 * and only name + location + a single chapter-specific verb-phrase swapped:
 *
 *   Ch1 ex[0]: "Anika   leans over a clipboard at 8:10 a.m. in the Oakland repair bay…"
 *   Ch2 ex[0]: "Giselle leans over a clipboard at 8:10 a.m. in the Denver running store…"
 *   …
 *   Ch14 ex[0]: "Thabo  leans over a clipboard at 8:10 a.m. in the Hanna cross-country course…"
 *
 * The pattern held across multiple example positions (ex[0], ex[2], etc).
 * Per-chapter ship gates passed because no chapter-level critic compared
 * against siblings. BP2 caught it at book-gate time but by then all 14
 * chapters had been written. AS9 catches the same defect class at the
 * chapter being written so the writer must compose chapter-specific
 * examples before moving to the next chapter.
 */
export function checkIntraBookExampleSimilarity(
  chapter: ChapterV21,
  priorChapters: ChapterV21[],
): CriticFinding[] {
  const findings: CriticFinding[] = [];
  if (priorChapters.length === 0) return findings;

  const currentExamples = chapter.examples ?? [];
  if (currentExamples.length === 0) return findings;

  for (let i = 0; i < currentExamples.length; i++) {
    const curEx = currentExamples[i];
    if (!curEx) continue;

    // Compare scenario, whatToDo, and whyItMatters at the same example position.
    for (const field of ["scenario", "whatToDo", "whyItMatters"] as const) {
      const curText = curEx[field];
      if (typeof curText !== "string" || !curText) continue;
      const curTokens = tokenize(curText);
      if (curTokens.length < 6) continue;

      const matches: Array<{ chapter: number; sim: number; priorText: string }> = [];
      for (const priorCh of priorChapters) {
        const priorExamples = priorCh.examples ?? [];
        if (priorExamples.length <= i) continue;
        const priorEx = priorExamples[i];
        if (!priorEx) continue;
        const priorText = priorEx[field];
        if (typeof priorText !== "string") continue;
        const sim = wordOverlapSimilarity(curTokens, tokenize(priorText));
        if (sim >= EXAMPLE_SIMILARITY_BLOCKER) {
          matches.push({ chapter: priorCh.number, sim, priorText });
        }
      }

      if (matches.length === 0) continue;
      const chList = matches.map((m) => `Ch${m.chapter}`).sort().join(", ");
      const ex = matches[0];
      findings.push(
        finding(
          "AS9.chapter_example_matches_prior" as any,
          "blocker",
          `example[${i}].${field} matches ${matches.length} prior chapter(s) at ≥${(EXAMPLE_SIMILARITY_BLOCKER * 100).toFixed(0)}% word overlap: ${chList}. Examples must be composed from THIS chapter's source notes (namedExamples, centralConcept, hardEdge) — not by adapting a scenario template from another chapter with name/location swapped. Rewrite this example with a different scene structure, role, time, and setting.`,
          `current: ${curText.slice(0, 100)} | matched in Ch${ex.chapter}: ${ex.priorText.slice(0, 100)}`,
        ),
      );
    }
  }

  return findings;
}

// ── BP24 — cross-tier breakdown verbatim duplication (replaces / supplements B8) ─

/**
 * Detects substantial verbatim copy-paste between breakdown tiers within ONE
 * chapter. The May 2026 Ch3 incident had 1,436 characters of verbatim prose
 * shared between DeepRead and FullRead — the entire middle of DeepRead was
 * copied into FullRead. The existing B8 critic in prose.ts returns after the
 * first 4-word match and reports it as MINOR; it has no mass-based
 * escalation.
 *
 * BP24 computes the longest common contiguous substring between each pair of
 * tiers. If LCS ≥ 150 chars, the tiers contain a copy-paste block and the
 * gate blocks. This is independent of B8 and intentionally more aggressive.
 */
export function checkBreakdownCrossTierVerbatim(chapter: ChapterV21): CriticFinding[] {
  const findings: CriticFinding[] = [];
  const tiers = chapter.breakdown;
  if (!tiers) return findings;

  const tierNames = ["fastRead", "deepRead", "fullRead"] as const;
  const pairs: Array<[typeof tierNames[number], typeof tierNames[number]]> = [
    ["fastRead", "deepRead"],
    ["fastRead", "fullRead"],
    ["deepRead", "fullRead"],
  ];

  for (const [aName, bName] of pairs) {
    const a = tiers[aName];
    const b = tiers[bName];
    if (typeof a !== "string" || typeof b !== "string" || !a || !b) continue;
    const lcs = longestCommonSubstring(a, b);
    if (lcs.length >= CROSS_TIER_VERBATIM_BLOCKER) {
      findings.push(
        finding(
          "BP24.cross_tier_breakdown_verbatim" as any,
          "blocker",
          `breakdown.${aName} and breakdown.${bName} share a verbatim substring of ${lcs.length} chars (blocker threshold ${CROSS_TIER_VERBATIM_BLOCKER}). Tiers must layer content — fastRead is scene+rule, deepRead adds mechanism+second scene, fullRead adds third angle+limits — not duplicate prose. Rewrite ${bName} to extend ${aName} with new content rather than copy from it.`,
          lcs.slice(0, 200),
        ),
      );
    }
  }

  return findings;
}

// ── helpers ─────────────────────────────────────────────────────────────────

function tokenize(s: string): string[] {
  return s.toLowerCase().split(/[^a-z0-9']+/).filter(Boolean);
}

function wordOverlapSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const counterA = new Map<string, number>();
  for (const w of a) counterA.set(w, (counterA.get(w) ?? 0) + 1);
  const counterB = new Map<string, number>();
  for (const w of b) counterB.set(w, (counterB.get(w) ?? 0) + 1);
  let shared = 0;
  for (const [w, ca] of counterA) {
    const cb = counterB.get(w) ?? 0;
    shared += Math.min(ca, cb);
  }
  return shared / Math.max(a.length, b.length);
}

/**
 * Longest common contiguous substring between two strings. Uses a rolling
 * window approach with a Set-of-substrings to keep memory bounded. Returns
 * the longest verbatim shared substring found, or empty if none.
 *
 * For typical chapter sizes (fullRead ~3000 chars), this completes in well
 * under 100ms with the seed-and-extend approach: pick a seed length, find
 * shared seeds, extend each match in both directions until they diverge,
 * keep the longest.
 */
function longestCommonSubstring(a: string, b: string): string {
  const SEED = 30; // any verbatim block ≥ 30 chars is a candidate to extend
  if (a.length < SEED || b.length < SEED) return "";

  // Build a set of seed-length substrings in b.
  const bSeeds = new Set<string>();
  for (let i = 0; i + SEED <= b.length; i++) bSeeds.add(b.slice(i, i + SEED));

  let best = "";
  for (let i = 0; i + SEED <= a.length; i++) {
    const seed = a.slice(i, i + SEED);
    if (!bSeeds.has(seed)) continue;
    // Found a seed match. Find ALL occurrences of seed in b, extend each.
    let from = 0;
    while ((from = b.indexOf(seed, from)) !== -1) {
      // Extend backward
      let aStart = i;
      let bStart = from;
      while (aStart > 0 && bStart > 0 && a[aStart - 1] === b[bStart - 1]) {
        aStart--;
        bStart--;
      }
      // Extend forward
      let aEnd = i + SEED;
      let bEnd = from + SEED;
      while (aEnd < a.length && bEnd < b.length && a[aEnd] === b[bEnd]) {
        aEnd++;
        bEnd++;
      }
      const candidate = a.slice(aStart, aEnd);
      if (candidate.length > best.length) best = candidate;
      from++;
    }
  }
  return best;
}
