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

// B15 — cross-tier content-lemma Jaccard above which the two tiers are
// restating the SAME ideas rather than layering new ones. ADVISORY (minor):
// it is a heuristic proxy for "paraphrase-restate", a defect the verbatim
// gates (E2 / B8 / BP24) are blind to because the writer reworded the
// connectives while keeping every domain concept. Calibrated 2026-06-25 on
// the gold corpus: genuine layering tops out at J(deepRead,fullRead)=0.312
// and J(fastRead,deepRead)=0.255 across the 21 real gold chapters
// (daring-greatly + start-with-why) and 0.179 across the synthetic gold; a
// reworded restate measures ~0.52. 0.42 sits in the gap with ~0.11 headroom
// over the dirtiest gold chapter and ~0.10 margin under the restate.
const CROSS_TIER_PARAPHRASE_JACCARD = 0.42;

// A tier with too few content lemmas is statistically noisy (Jaccard swings
// hard on a handful of shared words). The thinnest gold fastRead carries ~40
// content lemmas; require 20 on BOTH tiers before the ratio is trustworthy.
const CROSS_TIER_MIN_LEMMAS = 20;

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

// ── AS10 — chapter-time literal n-gram verbatim across chapters ─────────────

const LITERAL_NGRAM_WINDOW = 5;

// Minimum number of non-stopword non-short content tokens required in a
// 5-token window before it counts as a candidate templating phrase.
// Calibrated empirically: at 2 tokens, generic connectives like "must
// decide whether to" false-positive on natural prose; at 3 tokens, only
// phrases with real lexical fingerprints survive ("practical pattern
// recognition, moving from" — content tokens "practical","pattern",
// "recognition","moving").
const AS10_MIN_CONTENT_TOKENS = 3;

// Number of PRIOR chapters that must share a phrase before AS10 fires.
// A single shared phrase across two chapters can be coincidence; a phrase
// found in ≥2 prior chapters is a pattern. Corresponds to BP13's ≥3-
// total-chapter threshold (when writing chapter N, two prior chapters
// sharing a phrase means BP13 will fire at book-gate time once the
// current chapter ships and makes it 3).
const AS10_MIN_PRIOR_CHAPTERS = 2;

// Stopword list mirrors BP13's. Phrases dominated by these are
// statistically likely to coincide between unrelated chapters and would
// false-positive.
const NGRAM_STOPWORDS = new Set<string>([
  "the", "and", "that", "this", "with", "from", "have", "were", "will",
  "what", "when", "where", "which", "while", "their", "them", "they",
  "these", "those", "then", "than", "into", "over", "under", "about",
  "after", "before", "because", "could", "would", "should", "might",
  "still", "just", "also", "very", "more", "most", "some", "many",
  "much", "other", "another", "here", "there", "both",
]);

function literalContentWindows(text: string): Set<string> {
  const out = new Set<string>();
  const tokens = text.split(/\s+/).filter((t) => t.length > 0);
  for (let s = 0; s + LITERAL_NGRAM_WINDOW <= tokens.length; s++) {
    const slice = tokens.slice(s, s + LITERAL_NGRAM_WINDOW);
    let contentCount = 0;
    for (const tok of slice) {
      const w = tok.toLowerCase().replace(/[^a-z0-9'-]/g, "");
      if (w.length < 4) continue;
      if (NGRAM_STOPWORDS.has(w)) continue;
      contentCount++;
    }
    if (contentCount < AS10_MIN_CONTENT_TOKENS) continue;
    out.add(slice.join(" "));
  }
  return out;
}

const AS10_FIELDS: Array<{ getter: (ch: ChapterV21) => Array<{ unit: string; text: string }> }> = [
  {
    getter: (ch) => {
      const out: Array<{ unit: string; text: string }> = [];
      const b = ch.breakdown;
      if (b?.fastRead) out.push({ unit: "breakdown.fastRead", text: b.fastRead });
      if (b?.deepRead) out.push({ unit: "breakdown.deepRead", text: b.deepRead });
      if (b?.fullRead) out.push({ unit: "breakdown.fullRead", text: b.fullRead });
      return out;
    },
  },
  {
    getter: (ch) => {
      const out: Array<{ unit: string; text: string }> = [];
      (ch.examples ?? []).forEach((ex, i) => {
        if (typeof ex?.scenario === "string" && ex.scenario) out.push({ unit: `examples[${i}].scenario`, text: ex.scenario });
        if (typeof ex?.whatToDo === "string" && ex.whatToDo) out.push({ unit: `examples[${i}].whatToDo`, text: ex.whatToDo });
        if (typeof ex?.whyItMatters === "string" && ex.whyItMatters) out.push({ unit: `examples[${i}].whyItMatters`, text: ex.whyItMatters });
      });
      return out;
    },
  },
];

/**
 * Chapter-time twin of BP13. BP13 is book-gate-only and fires after every
 * chapter is already written; by then the writer agent has produced a full
 * book of stock-phrase prose. AS10 runs at chapter-write time so the same
 * defect class is caught on the chapter being shipped.
 *
 * The May 2026 "Start With Why round 2" incident: after AS9 forced
 * scenario-position variation, the writer agent slid under AS9's 70%
 * word-overlap threshold by keeping per-example word overlap low while
 * still reusing short stock phrases ("practical pattern recognition,
 * moving from", "hiring, marketing, culture, or operations", "let it
 * define the answer") across odd/even chapter groups in whatToDo and
 * whyItMatters. AS9 passed; BP13 found 288 cross-chapter verbatim
 * matches at book-gate time, after 14 chapters had been authored.
 *
 * AS10 finds any 5-token content window (≥3 non-stopword content tokens)
 * in the current chapter's examples or breakdown that also appears
 * verbatim in the same field type of ≥2 prior chapters. Same family of
 * detection as BP13, calibrated for chapter-write time: requires a real
 * pattern (≥2 priors), not a single coincidence, and tightens content-
 * token floor from 2 to 3 to suppress generic connectives.
 */
export function checkIntraBookLiteralNgrams(
  chapter: ChapterV21,
  priorChapters: ChapterV21[],
): CriticFinding[] {
  const findings: CriticFinding[] = [];
  if (priorChapters.length === 0) return findings;

  // For each field type, build the prior chapters' content windows once.
  for (const { getter } of AS10_FIELDS) {
    const currentFields = getter(chapter);
    if (currentFields.length === 0) continue;

    // Map from window string -> list of {chapter, unit} where it appears.
    const priorWindows = new Map<string, Array<{ chapter: number; unit: string }>>();
    for (const priorCh of priorChapters) {
      for (const pf of getter(priorCh)) {
        for (const win of literalContentWindows(pf.text)) {
          if (!priorWindows.has(win)) priorWindows.set(win, []);
          priorWindows.get(win)!.push({ chapter: priorCh.number, unit: pf.unit });
        }
      }
    }

    // For each current-chapter field, find any window that appears in priors.
    // Group hits by (current unit) so each unit emits at most one finding,
    // and inside the message list the matching phrases + prior chapters.
    for (const cf of currentFields) {
      const hits: Array<{ phrase: string; chapters: number[] }> = [];
      const seenPhrases = new Set<string>();
      for (const win of literalContentWindows(cf.text)) {
        const priors = priorWindows.get(win);
        if (!priors || priors.length === 0) continue;
        if (seenPhrases.has(win)) continue;
        seenPhrases.add(win);
        const chSet = Array.from(new Set(priors.map((p) => p.chapter))).sort((a, b) => a - b);
        if (chSet.length < AS10_MIN_PRIOR_CHAPTERS) continue;
        hits.push({ phrase: win, chapters: chSet });
      }
      if (hits.length === 0) continue;
      // Cap to top 5 phrases per finding to keep the message readable; the
      // count is preserved in the message.
      hits.sort((a, b) => b.chapters.length - a.chapters.length);
      const top = hits.slice(0, 5);
      const sample = top.map((h) => `"${h.phrase}" (Ch${h.chapters.join(",")})`).join("; ");
      findings.push(
        finding(
          "AS10.chapter_field_ngram_matches_prior" as any,
          "blocker",
          `${cf.unit} contains ${hits.length} verbatim 5-token phrase(s) that also appear in prior chapter(s). Top: ${sample}${hits.length > 5 ? ` (+${hits.length - 5} more)` : ""}. Stock writer phrases recycled across chapters become visible to the reader by the third repetition. Rewrite this field from THIS chapter's source material; do not reach for the same connective phrasing used in earlier chapters.`,
          cf.text.slice(0, 180),
        ),
      );
    }
  }

  return findings;
}

// ── AS11 — chapter-time breakdown-paragraph verbatim across chapters ────────

const PARAGRAPH_VERBATIM_MIN_CHARS = 60;

function breakdownParagraphs(ch: ChapterV21): Array<{ unit: string; text: string }> {
  const out: Array<{ unit: string; text: string }> = [];
  const b = ch.breakdown;
  if (!b) return out;
  for (const tier of ["fastRead", "deepRead", "fullRead"] as const) {
    const raw = b[tier];
    if (typeof raw !== "string" || !raw) continue;
    const paras = raw.split(/\n\s*\n+/).map((p) => p.trim()).filter((p) => p.length >= PARAGRAPH_VERBATIM_MIN_CHARS);
    for (const p of paras) out.push({ unit: `breakdown.${tier}`, text: p });
  }
  return out;
}

/**
 * Chapter-time twin of BP10/BP11. The May 2026 Start With Why incident
 * shipped a single ~280-char closing paragraph ("In the next meeting, ask
 * what the current action proves…") verbatim in all 14 chapters' fullRead
 * tiers, plus four more breakdown paragraph skeletons templated across the
 * book. BP10/BP11 catch this at book-gate time — too late, the agent has
 * already written 14 chapters of templated breakdown.
 *
 * AS11 fires on any breakdown paragraph (≥60 chars) in the current chapter
 * that appears verbatim in any breakdown tier of any prior chapter.
 */
export function checkIntraBookBreakdownParagraphVerbatim(
  chapter: ChapterV21,
  priorChapters: ChapterV21[],
): CriticFinding[] {
  const findings: CriticFinding[] = [];
  if (priorChapters.length === 0) return findings;

  const currentParas = breakdownParagraphs(chapter);
  if (currentParas.length === 0) return findings;

  // Build a map from paragraph text -> list of (chapter, unit) for prior chapters.
  const priorMap = new Map<string, Array<{ chapter: number; unit: string }>>();
  for (const priorCh of priorChapters) {
    for (const p of breakdownParagraphs(priorCh)) {
      if (!priorMap.has(p.text)) priorMap.set(p.text, []);
      priorMap.get(p.text)!.push({ chapter: priorCh.number, unit: p.unit });
    }
  }

  for (const cp of currentParas) {
    const matches = priorMap.get(cp.text);
    if (!matches || matches.length === 0) continue;
    const chList = Array.from(new Set(matches.map((m) => `Ch${m.chapter}`))).join(", ");
    findings.push(
      finding(
        "AS11.chapter_breakdown_paragraph_verbatim_prior" as any,
        "blocker",
        `${cp.unit} contains a paragraph that appears verbatim in prior chapter(s): ${chList}. Breakdown paragraphs cannot be reused across chapters — every chapter's reader sees the same paragraph in sequence and the templating becomes obvious. Rewrite this paragraph from THIS chapter's source notes.`,
        cp.text.slice(0, 180),
      ),
    );
  }

  return findings;
}

// ── AS12 — chapter-time quiz correctIndex sequence match ─────────────────────

/**
 * Chapter-time twin of BP14. The May 2026 Start With Why incident shipped
 * all 14 chapters with quiz correctIndex sequence [0,1,2,0,1,2,0,1,2] — a
 * fixed rotation pattern the writer agent applied to every chapter,
 * exactly because no chapter-time gate compared sequences. AS12 fires when
 * the current chapter's correctIndex sequence is identical to any prior
 * chapter's.
 *
 * A reader who notices the answer pattern can guess the correct choice
 * without engaging with the question; sharing the pattern across the book
 * is equivalent to printing the answer key.
 */
export function checkIntraBookQuizPositionMatch(
  chapter: ChapterV21,
  priorChapters: ChapterV21[],
): CriticFinding[] {
  const findings: CriticFinding[] = [];
  if (priorChapters.length === 0) return findings;
  const qs = chapter.quiz?.questions ?? [];
  if (qs.length === 0) return findings;
  const curSeq = qs.map((q) => q.correctIndex).join(",");
  if (!curSeq) return findings;

  const matches: number[] = [];
  for (const priorCh of priorChapters) {
    const pqs = priorCh.quiz?.questions ?? [];
    if (pqs.length === 0) continue;
    const priorSeq = pqs.map((q) => q.correctIndex).join(",");
    if (priorSeq === curSeq) matches.push(priorCh.number);
  }
  if (matches.length === 0) return findings;
  const chList = matches.map((c) => `Ch${c}`).join(", ");
  findings.push(
    finding(
      "AS12.chapter_quiz_position_matches_prior" as any,
      "blocker",
      `quiz correctIndex sequence [${curSeq}] is identical to prior chapter(s): ${chList}. Templated answer positions let the reader guess without reading. Vary the correctIndex per chapter — pick each answer's slot based on which choice is the strongest distractor for THIS question, not by following a fixed rotation.`,
      `seq: ${curSeq}`,
    ),
  );
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

// ── B15 — cross-tier content-lemma overlap (paraphrase-restate proxy) ────────

/**
 * The paraphrase-restate defect E2/B8/BP24 cannot see. After the verbatim
 * gates forced the writer agent off literal copy-paste, the cheapest remaining
 * way to "fill" a longer tier is to restate the prior tier's ideas in reworded
 * sentences: keep every domain concept (checkpoint, handoff, owner, source
 * note…), change only the connectives. No two sentences match word-for-word,
 * so E2 (identical first sentence), B8 (one 4-word phrase) and BP24 (≥150-char
 * verbatim block) all pass — yet a reader gets the same content twice.
 *
 * B15 catches it by content-lemma Jaccard between adjacent tier pairs
 * (fastRead↔deepRead, deepRead↔fullRead). Genuine layering introduces NEW
 * lemmas with each tier (new scenes, a second domain, edge-case vocabulary),
 * which keeps the ratio down; a restate keeps the same lemma set, which pushes
 * it up. ADVISORY only — the precise judgment is the `prose_coherence`
 * semantic axis; B15 is the cheap deterministic flag that surfaces the
 * candidate. Fires only BELOW the BP24 verbatim floor, so the verbatim and
 * paraphrase signals never double-report the same tier pair.
 */
export type CrossTierOverlapHit = {
  tierA: "fastRead" | "deepRead" | "fullRead";
  tierB: "fastRead" | "deepRead" | "fullRead";
  jaccard: number;
};

const CONTENT_STOPWORDS = new Set<string>([
  "the", "and", "that", "this", "with", "from", "have", "were", "will", "what",
  "when", "where", "which", "while", "their", "them", "they", "these", "those",
  "then", "than", "into", "over", "under", "about", "after", "before", "because",
  "could", "would", "should", "might", "still", "just", "also", "very", "more",
  "most", "some", "many", "much", "other", "another", "here", "there", "both",
  "your", "yours", "does", "done", "each", "every", "only", "even", "like",
  "such", "being", "been", "its", "his", "her", "she", "him", "who", "whom",
  "whose", "not", "but", "for", "are", "was", "has", "had", "can", "cannot",
  "off", "out", "one", "two", "three", "first", "next", "last", "know", "make",
  "made", "take", "goes", "got", "let", "now", "day", "way", "use", "used",
  "using", "need", "needs", "keep", "keeps", "kept", "feel", "feels",
]);

/** Light deterministic lemma: lowercase, strip non-alpha, drop stopwords and
 *  short tokens, fold the most common inflections. Identical normalization to
 *  the calibration measurement so the thresholds above stay honest. */
function contentLemma(tok: string): string {
  let w = tok.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length < 4) return "";
  if (CONTENT_STOPWORDS.has(w)) return "";
  if (w.endsWith("ing") && w.length > 5) w = w.slice(0, -3);
  else if (w.endsWith("ies") && w.length > 4) w = w.slice(0, -3) + "y";
  else if (w.endsWith("ed") && w.length > 4) w = w.slice(0, -2);
  else if (w.endsWith("es") && w.length > 5) w = w.slice(0, -2);
  else if (w.endsWith("s") && w.length > 4 && !w.endsWith("ss")) w = w.slice(0, -1);
  return w.length >= 3 ? w : "";
}

export function contentLemmaSet(text: string): Set<string> {
  const out = new Set<string>();
  for (const t of text.split(/[^a-zA-Z]+/)) {
    const l = contentLemma(t);
    if (l) out.add(l);
  }
  return out;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

/** Pure detector: every adjacent tier pair whose content-lemma Jaccard clears
 *  the paraphrase threshold while staying UNDER the BP24 verbatim floor. */
export function findCrossTierContentOverlap(chapter: ChapterV21): CrossTierOverlapHit[] {
  const tiers = chapter.breakdown;
  if (!tiers) return [];
  const hits: CrossTierOverlapHit[] = [];
  const pairs: Array<[CrossTierOverlapHit["tierA"], CrossTierOverlapHit["tierB"]]> = [
    ["fastRead", "deepRead"],
    ["deepRead", "fullRead"],
  ];
  for (const [aName, bName] of pairs) {
    const a = tiers[aName];
    const b = tiers[bName];
    if (typeof a !== "string" || typeof b !== "string" || !a || !b) continue;
    // BP24 owns the verbatim case; B15 is only the paraphrase proxy BELOW it.
    if (longestCommonSubstring(a, b).length >= CROSS_TIER_VERBATIM_BLOCKER) continue;
    const la = contentLemmaSet(a);
    const lb = contentLemmaSet(b);
    if (la.size < CROSS_TIER_MIN_LEMMAS || lb.size < CROSS_TIER_MIN_LEMMAS) continue;
    const sim = jaccard(la, lb);
    if (sim >= CROSS_TIER_PARAPHRASE_JACCARD) {
      hits.push({ tierA: aName, tierB: bName, jaccard: sim });
    }
  }
  return hits;
}

export function checkCrossTierContentOverlap(chapter: ChapterV21): CriticFinding[] {
  return findCrossTierContentOverlap(chapter).map((h) =>
    finding(
      "B15.cross_tier_paraphrase" as any,
      "minor",
      `breakdown.${h.tierA} and breakdown.${h.tierB} share ${(h.jaccard * 100).toFixed(0)}% of their content vocabulary (paraphrase-restate threshold ${(CROSS_TIER_PARAPHRASE_JACCARD * 100).toFixed(0)}%) with no verbatim block to flag — the two tiers are rerunning the same ideas in reworded sentences, not layering new ones. Give ${h.tierB} a NEW concept, scene, or nuance the reader has not met yet (deepRead = the mechanism + a second domain; fullRead = edge cases, the failure mode, the reversal). prose_coherence is the precise judgment.`,
      `${h.tierA}↔${h.tierB} content-lemma Jaccard ${h.jaccard.toFixed(3)}`,
    ),
  );
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
