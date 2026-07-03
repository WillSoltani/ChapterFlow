/**
 * Mechanical-seam critic (SEAM1/SEAM2) — reader prose must never carry the
 * mechanical wreckage of a generation glitch: a word stuttered back-to-back, or a
 * phrase stamped out verbatim three times.
 *
 * THE DEFECT (a corpus-quality eval found these "corruption seams" in ~22 of 130
 * shipped packages — MECHANICAL generator artifacts, not writing-quality misses,
 * the cheapest high-impact class to gate). The reader-facing signatures:
 *   "Emma Tries side side room"                       → adjacent word duplication
 *   a clause stamped out three times verbatim          → templated-loop repetition
 * Both read as instant word-salad — the prose's coherence collapses the moment a
 * reader hits them. The existing antiSalting (AS1-4: id-tokens, jammed proper
 * nouns, doubled periods, quiz templating) and scaffoldLeak (SL1-5: format tags,
 * domain labels, props, citations, publication metadata) families cover the
 * structured leaks; SEAM closes the two remaining DETERMINISTIC gaps.
 *
 * SCOPE (the provably-clean, mechanical half — never a judgment call):
 *   - SEAM1 fires on a lowercase content word (>=4 letters) repeated immediately
 *     ("side side"), excluding the handful of legitimate English reduplications
 *     ("the fact THAT THAT happened", "blah blah", place-name halves). Capitalized
 *     dups are exempt (proper-name / place-name reduplication: "Walla Walla",
 *     "Bora Bora") — a capitalized-dup bug is left to the semantic prose bar.
 *   - SEAM2 fires when a single reader field repeats the SAME >=6-word run, or the
 *     same whole sentence, THREE+ times verbatim — the templated-loop signature. A
 *     callback (twice) never trips it; only the triple-stamp does.
 * The token-substitution class ("same" rendered as "patricke" x14) is a STOCHASTIC
 * model artifact with no clean deterministic signal (a nonsense token is
 * indistinguishable from rare jargon without a lexicon → high FP), so it is left to
 * the semantic prose_coherence bar, not gated here.
 *
 * Calibrated ZERO-FP across the committed book corpus + the gold corpus (the FP
 * scan is the gold-corpus + book-repetition tests). Mechanical corruption is
 * blocker-class once a clean proof clears it; until then SHADOW = major.
 */

import { ChapterV21, CriticFinding } from "../types.js";
import { finding, truncate } from "./shared.js";
import { splitSentences } from "./textUtils.js";

// ── SEAM1 — ADJACENT DUPLICATE WORD ───────────────────────────────────────────
// Lowercase content word (>=4 letters) stuttered back-to-back. `\s+` only (no
// punctuation between) so a comma'd repeat ("ready, ready") — usually deliberate —
// never matches; the bug is the seamless "side side". The `\1` backreference is
// exact-case, and the leading `[a-z]{4,}` requires lowercase, so capitalized
// proper-name reduplication ("Walla Walla", "Bora Bora") is exempt by construction.
const ADJACENT_DUP = /\b([a-z]{4,})\s+\1\b/g;

// The legitimate >=4-letter lowercase reduplications English actually writes.
// "that that" is the common grammatical one ("the fact that that happened"); the
// rest are onomatopoeic / place-name halves that can appear in dialogue or names.
const LEGIT_DUP = new Set([
  "that", "blah", "knock", "beep", "night", "choo", "boom", "bang", "goody",
  "yada", "bora", "walla", "baden", "pago", "sing", "couscous", "mahi", "tsetse",
]);

export type SeamHit = {
  /** Which seam class matched, for the message + routing. */
  kind: "adjacent_duplicate" | "verbatim_repetition";
  /** The offending unit as written ("side side" / the repeated run). */
  fragment: string;
  /** How many times the run repeats (verbatim_repetition only; 2 for a dup). */
  count: number;
  /** The full sentence (or the field head), for evidence. */
  sentence: string;
};

/** Pure detector: every adjacent lowercase content-word duplication in `text`. A
 *  match straddling a HYPHENATED compound ("almost-good good", "voice-over over")
 *  is NOT a stutter — one "word" is a compound member — so a hyphen/apostrophe on
 *  either flank of the run disqualifies it. */
export function findAdjacentDuplicates(text: string): SeamHit[] {
  if (!text || typeof text !== "string") return [];
  const hits: SeamHit[] = [];
  for (const sentence of splitSentences(text)) {
    const seen = new Set<string>();
    ADJACENT_DUP.lastIndex = 0;
    for (let m = ADJACENT_DUP.exec(sentence); m; m = ADJACENT_DUP.exec(sentence)) {
      const word = m[1];
      if (LEGIT_DUP.has(word)) continue;
      const before = sentence[m.index - 1];
      const after = sentence[m.index + m[0].length];
      if (before === "-" || before === "'" || before === "’") continue; // compound tail: "almost-good good"
      if (after === "-" || after === "'" || after === "’") continue; // compound head: "over over-eager"
      if (seen.has(word)) continue;
      seen.add(word);
      hits.push({ kind: "adjacent_duplicate", fragment: `${word} ${word}`, count: 2, sentence });
    }
  }
  return hits;
}

// ── SEAM2 — VERBATIM TRIPLE-REPETITION ────────────────────────────────────────
// A templated-loop stamps the SAME long run out three+ times within a SINGLE reader
// field (cross-field reuse is the repetition family's job, not a mechanical seam).
// The window is the calibration knob: deliberate ANAPHORA repeats a SHORT memorable
// opener and then diverges ("What would have to be true … for X?", "… for Y?"), so
// a 6-word window FPs on it — but a 10-word EXACT run repeated 3x is something only
// a glitch produces (the corpus proof: window=10 keeps all 5 real seams — garbled
// word-salad + scenario-loops — and drops every anaphora FP). Three is the floor: a
// callback (twice) is deliberate; a triple verbatim stamp of a 10-word run is not.
const REPEAT_WINDOW = 10;
const REPEAT_MIN_COUNT = 3;

/** Lowercase word tokens (apostrophes kept, everything else dropped). */
function wordTokens(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+(?:'[a-z]+)?/g) ?? []);
}

/** Pure detector: the same >=10-word run repeated >=3x verbatim within `text`. At
 *  most one hit per field (the most-repeated run). */
export function findVerbatimRepetition(text: string): SeamHit[] {
  if (!text || typeof text !== "string") return [];
  const words = wordTokens(text);
  if (words.length < REPEAT_WINDOW * REPEAT_MIN_COUNT) return [];
  const gramCounts = new Map<string, number>();
  let worst: { gram: string; count: number } | null = null;
  for (let i = 0; i + REPEAT_WINDOW <= words.length; i++) {
    const gram = words.slice(i, i + REPEAT_WINDOW).join(" ");
    const c = (gramCounts.get(gram) ?? 0) + 1;
    gramCounts.set(gram, c);
    if (c >= REPEAT_MIN_COUNT && (!worst || c > worst.count)) worst = { gram, count: c };
  }
  if (worst) {
    return [{ kind: "verbatim_repetition", fragment: worst.gram, count: worst.count, sentence: worst.gram }];
  }
  return [];
}

// ── Reader-facing field walker (mirrors the sibling critics) ──────────────────
function readerFields(chapter: ChapterV21): Array<{ unit: string; text: string }> {
  const fields: Array<{ unit: string; text: string }> = [];
  const add = (unit: string, text: unknown) => {
    if (typeof text === "string" && text.trim()) fields.push({ unit, text });
  };
  add("hook", chapter.hook);
  add("counterintuition", chapter.counterintuition);
  add("keyTakeaway", chapter.keyTakeaway);
  const bd = chapter.breakdown ?? ({} as any);
  for (const tier of ["fastRead", "deepRead", "fullRead"] as const) add(`breakdown.${tier}`, bd[tier]);
  chapter.examples?.forEach((e, i) => {
    add(`examples[${i}].scenario`, e.scenario);
    add(`examples[${i}].whatToDo`, e.whatToDo);
    add(`examples[${i}].whyItMatters`, e.whyItMatters);
  });
  chapter.quiz?.questions?.forEach((q, i) => {
    add(`quiz.questions[${i}].prompt`, q.prompt);
    (q.choices ?? []).forEach((c, j) => add(`quiz.questions[${i}].choices[${j}]`, c));
    add(`quiz.questions[${i}].explanation`, q.explanation);
  });
  chapter.reviewCards?.forEach((c, i) => {
    add(`reviewCards[${i}].front`, c.front);
    add(`reviewCards[${i}].back`, c.back);
  });
  chapter.memorableLines?.forEach((l, i) => add(`memorableLines[${i}].text`, l.text));
  return fields;
}

const SEAM1_FIX =
  "Remove the stuttered duplicate — a word repeated back-to-back is a generation glitch, not prose. Read the sentence aloud and write the intended single word.";
const SEAM2_FIX =
  "Collapse the verbatim triple-repeat into one statement (or rewrite each instance to carry NEW ground). A clause stamped out three times identically is a templated-loop artifact.";

/**
 * SEAM1/SEAM2 — mechanical corruption seams in reader prose (a stuttered word, a
 * verbatim triple-repeat). SHADOW = major until the gold + corpus FP proof clears
 * them for blocker promotion (mechanical corruption is blocker-class — broken text,
 * not a quality judgment). Shape-based, so runs on v1 + v2 chapters alike.
 */
export function checkMechanicalSeams(chapter: ChapterV21): CriticFinding[] {
  const findings: CriticFinding[] = [];
  for (const { unit, text } of readerFields(chapter)) {
    for (const hit of findAdjacentDuplicates(text)) {
      findings.push(
        finding(
          "SEAM1.adjacent_duplicate_word" as any,
          "major",
          `${unit}: adjacent duplicate word — "${truncate(hit.fragment, 40)}" stutters the same word back-to-back (a generation glitch; reads as prose_coherence corruption at QC). ${SEAM1_FIX}`,
          hit.sentence,
        ),
      );
    }
    for (const hit of findVerbatimRepetition(text)) {
      findings.push(
        finding(
          "SEAM2.verbatim_repetition" as any,
          "major",
          `${unit}: verbatim repetition — a run repeats ${hit.count}x identically ("${truncate(hit.fragment, 48)}…"; a templated-loop artifact, reads as prose_coherence corruption at QC). ${SEAM2_FIX}`,
          hit.sentence,
        ),
      );
    }
  }
  return findings;
}
