/**
 * Plain-language critic (E7) — enforces SIMPLE VOCABULARY and short sentences
 * across ALL reader-facing fields, not just the three breakdown tiers.
 *
 * Before this, "plain language" (R2.7) was carried only by advisory prompt
 * text plus a non-blocking Flesch-Kincaid grade (E1) on the breakdown tiers.
 * Word-choice difficulty had no critic at all, and quiz / cards / examples /
 * headlines got no readability check — a reader could hit grade-14 jargon in
 * every quiz choice and the gate stayed green. This closes both gaps:
 *
 *   E7.complex_word   — a needlessly fancy word where a common one fits
 *                       (utilize→use, leverage→use, facilitate→help). MINOR
 *                       (advisory swap; word choice is contextual).
 *   E7.long_sentence  — a reader-facing prose sentence over the length cap;
 *                       run-ons are the #1 readability killer. MAJOR.
 *   E7.dense_headline — a headline/one-liner field (hook, counterintuition,
 *                       memorable line, example title) that runs long; these
 *                       must be the simplest lines in the chapter. MAJOR.
 *
 * Curated to AVOID false positives on legitimate domain vocabulary: the swap
 * list contains only generic corporate/academic jargon that almost always has
 * a plainer everyday equivalent — never domain terms (governance, stakeholder,
 * intrinsic motivation, dependency, …) or proper nouns. keyTakeaway length is
 * deliberately left to A14 (it is spec'd as one 140–220-char sentence).
 */

import { ChapterV21, CriticFinding } from "../types.js";
import { finding } from "./shared.js";

/** Reader-facing prose sentence cap (words). Above this a sentence is a run-on
 *  that hurts comprehension; the authoring rule is "no sentence over 30 words"
 *  — we flag with a small grace so a clean 31–33-word sentence isn't nagged. */
const PROSE_SENTENCE_CAP = 34;
/** One-liner / headline fields must be tighter — they are the lines a reader
 *  skims and remembers. */
const HEADLINE_SENTENCE_CAP = 24;

/** Needlessly-complex word → plain everyday swap. Each matcher is whole-word,
 *  case-insensitive, and covers common inflections. CONSERVATIVE on purpose:
 *  only words that almost always read better as the swap in general-audience
 *  nonfiction. No domain terms, no proper nouns. */
const PLAIN_WORD_SWAPS: ReadonlyArray<{ re: RegExp; simple: string }> = [
  // -ize/-ise words must match BOTH spellings: `utilis?e` matched British
  // "utilise" but missed American "utilize" (the s was optional instead of the
  // s/z alternating), so the headline jargon word slipped the gate.
  { re: /\butili[sz](?:e|es|ed|ing|ation)\b/i, simple: "use" },
  { re: /\bfacilitat(?:e|es|ed|ing|ion)\b/i, simple: "help / run" },
  { re: /\bdemonstrat(?:e|es|ed|ing|ion)\b/i, simple: "show" },
  { re: /\bleverag(?:e|es|ed|ing)\b/i, simple: "use / build on" },
  { re: /\boptimi[sz](?:e|es|ed|ing|ation)\b/i, simple: "improve" },
  { re: /\bnumerous\b/i, simple: "many" },
  { re: /\bapproximately\b/i, simple: "about" },
  { re: /\bsufficient(?:ly)?\b/i, simple: "enough" },
  { re: /\bsubsequent(?:ly)?\b/i, simple: "later / after" },
  { re: /\bregarding\b/i, simple: "about" },
  { re: /\bendeavou?r(?:s|ed|ing)?\b/i, simple: "try" },
  { re: /\bascertain(?:s|ed|ing)?\b/i, simple: "find out" },
  { re: /\bcommenc(?:e|es|ed|ing)\b/i, simple: "start" },
  { re: /\bterminat(?:e|es|ed|ing|ion)\b/i, simple: "end" },
  { re: /\bexpedit(?:e|es|ed|ing)\b/i, simple: "speed up" },
  { re: /\belucidat(?:e|es|ed|ing)\b/i, simple: "explain" },
  { re: /\bameliorat(?:e|es|ed|ing)\b/i, simple: "improve" },
  { re: /\bcogniz(?:ant|ance)\b/i, simple: "aware" },
  { re: /\bplethora\b/i, simple: "plenty" },
  { re: /\bparamount\b/i, simple: "key" },
  { re: /\baforementioned\b/i, simple: "this" },
  { re: /\bwhilst\b/i, simple: "while" },
  { re: /\bamongst\b/i, simple: "among" },
  { re: /\bpropagat(?:e|es|ed|ing|ion)\b/i, simple: "spread" },
  { re: /\bresequenc(?:e|es|ed|ing)\b/i, simple: "reorder" },
  { re: /\bprior to\b/i, simple: "before" },
  { re: /\bin order to\b/i, simple: "to" },
  { re: /\bdue to the fact that\b/i, simple: "because" },
  { re: /\bin the event that\b/i, simple: "if" },
  { re: /\bat this point in time\b/i, simple: "now" },
  { re: /\bwith regard to\b/i, simple: "about" },
  { re: /\bthe majority of\b/i, simple: "most" },
  { re: /\bhas the ability to\b/i, simple: "can" },
  { re: /\bhave the ability to\b/i, simple: "can" },
];

function splitSentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
}

function wordCount(text: string): number {
  return (text.match(/\b[A-Za-z0-9'’-]+\b/g) ?? []).length;
}

/** E7.complex_word — flag each distinct needlessly-fancy word with its swap.
 *  One finding per distinct word per field (deduped) so a repeated word isn't
 *  nagged multiple times. */
export function checkPlainVocabulary(text: string | undefined, fieldLabel: string): CriticFinding[] {
  if (!text) return [];
  const out: CriticFinding[] = [];
  const seen = new Set<string>();
  for (const { re, simple } of PLAIN_WORD_SWAPS) {
    const m = re.exec(text);
    if (!m) continue;
    const hit = m[0].toLowerCase();
    if (seen.has(hit)) continue;
    seen.add(hit);
    const at = m.index ?? 0;
    out.push(
      finding(
        "E7.complex_word" as any,
        "minor",
        `${fieldLabel}: prefer a plainer word — "${m[0]}" → ${simple}.`,
        text.slice(Math.max(0, at - 24), at + m[0].length + 24),
      ),
    );
  }
  return out;
}

/** E7.long_sentence / E7.dense_headline — flag any single sentence over the
 *  cap for its field kind. */
export function checkSentenceLength(
  text: string | undefined,
  fieldLabel: string,
  opts: { headline?: boolean } = {},
): CriticFinding[] {
  if (!text) return [];
  const cap = opts.headline ? HEADLINE_SENTENCE_CAP : PROSE_SENTENCE_CAP;
  const out: CriticFinding[] = [];
  for (const sentence of splitSentences(text)) {
    const n = wordCount(sentence);
    if (n > cap) {
      out.push(
        finding(
          opts.headline ? ("E7.dense_headline" as any) : ("E7.long_sentence" as any),
          "major",
          opts.headline
            ? `${fieldLabel}: ${n}-word sentence — a one-liner field should be one short sentence (≤${HEADLINE_SENTENCE_CAP} words). Split it or cut clauses.`
            : `${fieldLabel}: ${n}-word sentence — too long to read in one breath (cap ${PROSE_SENTENCE_CAP}). Break it into shorter sentences.`,
          sentence.slice(0, 160),
        ),
      );
    }
  }
  return out;
}

const PROSE = false;
const HEADLINE = true;

/** Run the plain-language checks over every reader-facing field of a chapter.
 *  Returns findings tagged with their E7 subcode; finalGate aggregates them. */
export function checkPlainLanguage(chapter: ChapterV21): CriticFinding[] {
  const out: CriticFinding[] = [];
  const vocab = (t: string | undefined, label: string) => out.push(...checkPlainVocabulary(t, label));
  const sent = (t: string | undefined, label: string, headline: boolean) =>
    out.push(...checkSentenceLength(t, label, { headline }));

  // One-liner fields — tight + plain.
  vocab(chapter.hook, "hook");
  sent(chapter.hook, "hook", HEADLINE);
  vocab(chapter.counterintuition, "counterintuition");
  sent(chapter.counterintuition, "counterintuition", HEADLINE);
  (chapter.memorableLines ?? []).forEach((l, i) => {
    vocab(l?.text, `memorableLines[${i}]`);
    sent(l?.text, `memorableLines[${i}]`, HEADLINE);
  });

  // keyTakeaway / tryThisNow — vocab matters; keyTakeaway length is A14's job.
  vocab(chapter.keyTakeaway, "keyTakeaway");
  vocab(chapter.tryThisNow, "tryThisNow");
  sent(chapter.tryThisNow, "tryThisNow", PROSE);

  // Breakdown prose — vocab + run-ons (E1 already scores FK grade here).
  for (const tier of ["fastRead", "deepRead", "fullRead"] as const) {
    vocab(chapter.breakdown?.[tier], `breakdown.${tier}`);
    sent(chapter.breakdown?.[tier], `breakdown.${tier}`, PROSE);
  }

  // Examples.
  (chapter.examples ?? []).forEach((ex, i) => {
    sent(ex?.title, `examples[${i}].title`, HEADLINE);
    for (const k of ["scenario", "whatToDo", "whyItMatters"] as const) {
      vocab(ex?.[k], `examples[${i}].${k}`);
      sent(ex?.[k], `examples[${i}].${k}`, PROSE);
    }
  });

  // Quiz — prompts, choices, explanations.
  (chapter.quiz?.questions ?? []).forEach((q, i) => {
    vocab(q?.prompt, `quiz[${i}].prompt`);
    sent(q?.prompt, `quiz[${i}].prompt`, PROSE);
    vocab(q?.explanation, `quiz[${i}].explanation`);
    sent(q?.explanation, `quiz[${i}].explanation`, PROSE);
    (q?.choices ?? []).forEach((c, j) => vocab(c, `quiz[${i}].choices[${j}]`));
  });

  // Review cards.
  (chapter.reviewCards ?? []).forEach((c, i) => {
    vocab(c?.front, `reviewCards[${i}].front`);
    sent(c?.front, `reviewCards[${i}].front`, PROSE);
    vocab(c?.back, `reviewCards[${i}].back`);
    sent(c?.back, `reviewCards[${i}].back`, PROSE);
  });

  // Implementation plan.
  const plan = chapter.implementationPlan;
  if (plan) {
    vocab(plan.twentyFourHourChallenge, "implementationPlan.twentyFourHourChallenge");
    sent(plan.twentyFourHourChallenge, "implementationPlan.twentyFourHourChallenge", PROSE);
    vocab(plan.weeklyPractice, "implementationPlan.weeklyPractice");
    sent(plan.weeklyPractice, "implementationPlan.weeklyPractice", PROSE);
    (plan.ifThenPlans ?? []).forEach((p, i) => {
      vocab(p?.plan, `implementationPlan.ifThenPlans[${i}].plan`);
      sent(p?.plan, `implementationPlan.ifThenPlans[${i}].plan`, PROSE);
    });
  }

  return out;
}

export const PLAIN_LANGUAGE_SWAPS = PLAIN_WORD_SWAPS;
