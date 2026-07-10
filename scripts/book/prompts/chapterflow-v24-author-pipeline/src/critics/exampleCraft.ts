/**
 * Example-craft critic (C29) — a thin / manufactured example (Phase 5,
 * 2026-07-04 gold run). start-with-why halted in part on chapters whose examples
 * felt invented only to fill a required slot: a vague unnamed blob with no
 * causal movement, restating the lesson instead of dramatizing a decision. The
 * blinded reader caught these semantically; C29 is the orthogonal DETERMINISTIC
 * signal so the debt is structured + repair-routable, not only in the reader's
 * head.
 *
 * THE DISCRIMINATOR. C29 fires only when an example scenario has BOTH:
 *   (1) NO concrete specificity — no proper noun (a named person/place/org), no
 *       number/quantity, and no clock-time. A real example almost always names
 *       someone or something or counts a stake; a scenario with none reads as a
 *       generic "a manager once tried to…" placeholder.
 *   (2) NO causal movement — none of the cause→effect / before→after connectives
 *       (because, so, led to, caused, after, once, when, until, then, which
 *       meant, as a result, drove, forced, …). A teaching example shows a
 *       decision producing a consequence; a scenario with no movement just
 *       states a static situation or restates the lesson.
 * Requiring BOTH-absent is what makes it gold-safe: every clean-corpus scenario
 * carries a named anchor OR a causal movement (nearly always both), so it never
 * trips. Only the empty placeholder — no name, no number, no movement — does.
 *
 * SEVERITY: MINOR (advisory). Example craft is a semantic judgement that gates
 * on the `example_coherence` bar axis + the blinded reader; C29 surfaces the
 * mechanical floor as QC debt and NEVER blocks (the standing rule: lexical
 * quality gates measured INVERTED on the owner top-5). The test pins ZERO
 * findings on the gold corpus — see tests/example-craft.test.ts.
 */

import { ChapterV21, CriticFinding } from "../types.js";
import { finding, truncate, pickEvidence } from "./shared.js";

// (1) Concrete-specificity signals. Any ONE present ⇒ the scenario is not an
//     empty blob, so C29 does not fire.
const NUMBER_RE = /\b\d/; // any digit (a count, a year, a clock time, a dollar figure, "3 prompts")
const CLOCK_RE = /\b\d{1,2}(:\d{2})?\s*(a\.?m\.?|p\.?m\.?)\b/i;
// Spelled-out cardinals — grounded scenes often count in words ("fourteen
// kilograms", "sixty-eight and four months out"). Treat as specificity too.
const SPELLED_NUMBER_RE = /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|dozen)\b/i;

/** Capitalized words that legitimately OPEN a sentence/clause but are NOT names —
 *  function words, common openers, and the imperative verbs example scenes open
 *  on ("Picture…", "Imagine…"). A capitalized token NOT in this set (and not a
 *  spelled cardinal, which counts as a number instead) reads as a proper noun. */
const CAPITALIZED_NON_NAMES = new Set([
  "the", "a", "an", "this", "that", "these", "those", "it", "its", "he", "his", "him",
  "she", "her", "they", "them", "their", "we", "our", "us", "you", "your", "i", "my",
  "when", "while", "after", "before", "once", "if", "as", "but", "and", "or", "so",
  "yet", "for", "nor", "then", "now", "here", "there", "what", "which", "who", "whom",
  "why", "how", "where", "whether", "because", "since", "though", "although", "unless",
  "until", "each", "every", "both", "all", "some", "most", "many", "few", "no", "not",
  "another", "other", "next", "last", "first", "second", "third", "meanwhile", "later",
  "soon", "today", "tomorrow", "yesterday", "everyone", "someone", "nobody", "anyone",
  "everything", "something", "nothing", "imagine", "picture", "consider", "notice",
  "think", "suppose", "say", "watch", "look", "listen", "remember", "assume", "on", "in",
  "at", "by", "to", "of", "with", "from", "into", "over", "under", "across", "during",
]);

/** A proper noun = a capitalized word (with a lowercase tail) that is not a
 *  common opener/function word and not a spelled cardinal — "Laura", "Aravind",
 *  "Kitty", "Apple" read as names anywhere in the text, including sentence start. */
function hasProperNoun(text: string): boolean {
  for (const raw of text.split(/\s+/)) {
    const w = raw.replace(/^[("'‘“]+/, "").replace(/[)"'’”,.;:!?]+$/, "");
    if (!/^[A-ZÀ-Þ][a-zà-ÿ][A-Za-zà-ÿ'’-]*$/.test(w)) continue; // Cap + lowercase tail
    const lower = w.toLowerCase();
    if (CAPITALIZED_NON_NAMES.has(lower)) continue;
    if (SPELLED_NUMBER_RE.test(lower)) continue; // counted as a number, not a name
    return true;
  }
  return false;
}

// (2) Causal / temporal movement connectives — a decision producing a consequence.
const CAUSAL_MOVEMENT_RE = /\b(because|so that|\bso\b|led to|leads to|leading to|caused|causes|causing|after|before|once|when|until|then|which meant|as a result|resulting in|results in|resulted in|drove|forced|prompted|triggered|turned into|ended up|gave way to|in turn|therefore|hence|thus|meant that|made (?:her|him|them|it) )\b/i;

export function checkExampleCraft(chapter: ChapterV21): CriticFinding[] {
  const findings: CriticFinding[] = [];
  for (const ex of chapter.examples ?? []) {
    const scenario = pickEvidence(ex.scenario);
    if (typeof scenario !== "string" || scenario.trim().length === 0) continue;

    const hasSpecificity = NUMBER_RE.test(scenario) || CLOCK_RE.test(scenario) || SPELLED_NUMBER_RE.test(scenario) || hasProperNoun(scenario);
    const hasMovement = CAUSAL_MOVEMENT_RE.test(scenario);

    if (!hasSpecificity && !hasMovement) {
      findings.push(
        finding(
          "C29.example_thinness" as any,
          "minor",
          `${ex.exampleId ?? "example"} scenario is thin — no named person/place/number AND no cause→effect movement, so it reads as a slot-filler placeholder rather than a lived decision-and-consequence. Anchor it to a specific actor/stake from the chapter's own research and show the before→after the move produces.`,
          truncate(scenario, 120),
        ),
      );
    }
  }
  return findings;
}
