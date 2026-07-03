/**
 * Grounded-numbers critic (GN1) — invented precision in narrative prose must
 * trace to the chapter's source notes.
 *
 * THE DEFECT (the "deterministic grounded-number gate" backlog item). A writer
 * reaches for a precise statistic to sound rigorous, and fabricates one:
 *   "The notebook gets opened ninety percent of the time, which is roughly
 *    ninety percent more often than the old planner."  (Atomic Habits regen)
 * A reader who later senses the figure is invented discounts the whole teaching.
 * At QC this surfaces as a `factual_accuracy` corruption — but only the SEMANTIC
 * bar caught it; nothing deterministic did. GN1 closes that gap for the loudest,
 * lowest-false-positive form of the defect: a STATISTICAL figure (a percentage, a
 * multiplier, or a million/billion magnitude) that appears nowhere in the
 * chapter's source-v2 sidecar.
 *
 * SCOPE (calibrated HARD — every quality-major historically fires harder on clean
 * reference books than on the defect book, so this stays narrow + shadow=major):
 *   - We fire ONLY on a number bound to a precision-signaling unit: `%`/`percent`,
 *     a multiplier (`3x`, `tenfold`), or a magnitude (`2 billion`). These are the
 *     "fabricated precision" tells.
 *   - Bare counts, durations ("two weeks"), years ("1939"), clock times ("7 a.m."),
 *     and list ordinals ("one of three") carry NONE of those units, so they are
 *     never candidates — the trivially-safe classes fall out by construction.
 *   - A figure is GROUNDED (silent) when its numeric value appears anywhere in the
 *     chapter's source-v2 sidecar (testableFacts / namedExample hardSpecifics /
 *     claims / mechanisms / keyClaims / etc.). The allow-set is the union of every
 *     number the curated source notes establish.
 *
 * V2-GATED (mirrors SC11): runs only when the chapter's sidecar is source-v2.
 * v1 chapters (all current production books) return [] → zero effect, cannot brick.
 * That also makes the gold corpus (daring-greatly + start-with-why are rich-v1, and
 * the synthetic gold has no on-disk sidecar) zero-FP by construction.
 *
 * Spelled-out and digit forms normalize to one another ("ninety percent" ↔ "90%"),
 * so a number grounded in either form in the sidecar exempts either form in prose.
 *
 * Bare ungrounded QUANTITIES ("1,112 rulings") are out of scope for v1 — they are
 * far higher-FP than percentages and remain the semantic `factual_accuracy` axis's
 * job. GN1 is deliberately the narrow, deterministic complement.
 */

import { ChapterV21, CriticFinding } from "../types.js";
import { finding, truncate } from "./shared.js";
import { splitSentences } from "./textUtils.js";
import { loadChapterSidecar } from "./sourceGrounding.js";
import { detectSidecarShape } from "../source/sidecarSchema.js";

type FigureUnit = "percent" | "multiplier" | "magnitude";

export type UngroundedNumberHit = {
  /** The figure as written ("ninety percent", "90%", "3x", "2 billion"). */
  figure: string;
  /** Its numeric value, normalized to a canonical digit string ("90", "3", "2"). */
  value: string;
  /** Which precision-signaling unit bound the number. */
  unit: FigureUnit;
  /** The full sentence, for evidence. */
  sentence: string;
};

// ── Spelled-number parsing ───────────────────────────────────────────────────
const ONES: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
  fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};
const SCALES: Record<string, number> = { hundred: 100, thousand: 1000, million: 1e6, billion: 1e9, trillion: 1e12 };

function isNumberWord(w: string): boolean {
  return w in ONES || w in TENS || w in SCALES;
}

/** Parse a sequence of number-words ("ninety", "ninety five", "two hundred twenty")
 *  into an integer. Returns null if the run contains no number word. */
function parseNumberWords(tokens: string[]): number | null {
  if (tokens.length === 0 || !tokens.some(isNumberWord)) return null;
  let result = 0;
  let current = 0;
  let saw = false;
  for (const t of tokens) {
    if (t in ONES) { current += ONES[t]; saw = true; }
    else if (t in TENS) { current += TENS[t]; saw = true; }
    else if (t === "hundred") { current = (current || 1) * 100; saw = true; }
    else if (t in SCALES) { result += (current || 1) * SCALES[t]; current = 0; saw = true; }
    // "and"/hyphens are passed through as empty tokens by the caller; ignore others.
  }
  if (!saw) return null;
  return result + current;
}

/** From a free-text window preceding a unit, take only the trailing run of
 *  number-words and parse it. "opened ninety" → 90; "the planner" → null. */
function trailingNumberValue(window: string): number | null {
  const tokens = window.toLowerCase().split(/[\s-]+/).filter(Boolean);
  const run: string[] = [];
  for (let i = tokens.length - 1; i >= 0; i--) {
    const t = tokens[i];
    if (isNumberWord(t) || t === "and") run.unshift(t);
    else break;
  }
  return parseNumberWords(run.filter((t) => t !== "and"));
}

function normalizeDigits(raw: string): string {
  // Strip grouping commas; drop a trailing ".0"; keep real decimals.
  const n = raw.replace(/,/g, "");
  return n.replace(/\.0+$/, "");
}

// ── Prose figure extraction (number bound to a precision-signaling unit) ──────
const DIGIT_PERCENT = /(\d[\d,]*(?:\.\d+)?)\s*(?:%|percent\b|pct\b)/gi;
const DIGIT_MULTIPLIER = /(\d[\d,]*(?:\.\d+)?)\s*(?:×|x(?![a-z])|[-\s]?fold\b)/gi;
const DIGIT_MAGNITUDE = /(\d[\d,]*(?:\.\d+)?)\s*(?:million|billion|trillion)\b/gi;
const WORD_PERCENT = /((?:[a-z][a-z]*[\s-]+){1,5})percent\b/gi;
const WORD_FOLD = /\b([a-z]+)[-]?fold\b/gi;

/** Pure detector: every statistical figure in `text` whose value is NOT in `allow`.
 *  `allow` is a set of canonical digit-strings the source notes establish. */
export function findUngroundedNumbers(text: string, allow: Set<string> = new Set()): UngroundedNumberHit[] {
  if (!text || typeof text !== "string") return [];
  const hits: UngroundedNumberHit[] = [];
  for (const sentence of splitSentences(text)) {
    const seen = new Set<string>();
    const consider = (figure: string, value: string, unit: FigureUnit) => {
      if (value === "" || allow.has(value)) return;
      const key = `${value}|${unit}`;
      if (seen.has(key)) return;
      seen.add(key);
      hits.push({ figure: figure.trim(), value, unit, sentence });
    };

    for (const m of sentence.matchAll(DIGIT_PERCENT)) consider(m[0], normalizeDigits(m[1]), "percent");
    for (const m of sentence.matchAll(DIGIT_MULTIPLIER)) consider(m[0], normalizeDigits(m[1]), "multiplier");
    for (const m of sentence.matchAll(DIGIT_MAGNITUDE)) consider(m[0], normalizeDigits(m[1]), "magnitude");
    for (const m of sentence.matchAll(WORD_PERCENT)) {
      const v = trailingNumberValue(m[1]);
      if (v === null) continue;
      consider(`${m[1].trim().split(/\s+/).slice(-3).join(" ")} percent`, String(v), "percent");
    }
    for (const m of sentence.matchAll(WORD_FOLD)) {
      const v = parseNumberWords(m[1].toLowerCase().split(/[\s-]+/).filter(Boolean));
      if (v === null) continue;
      consider(m[0], String(v), "multiplier");
    }
  }
  return hits;
}

// ── Source-grounding allow-set ────────────────────────────────────────────────
const ANY_DIGIT = /\d[\d,]*(?:\.\d+)?/g;
const ANY_NUMBER_WORD_RUN = /\b(?:(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion|trillion)(?:[\s-]+|$))+/gi;

/** Every number the chapter's source notes establish, as canonical digit-strings.
 *  Built from the WHOLE sidecar text so any curated figure (a hardSpecific, a
 *  testableFact claim, a mechanism, a keyClaim) exempts the same figure in prose. */
export function groundedNumberTokens(sidecar: unknown): Set<string> {
  const out = new Set<string>();
  if (!sidecar) return out;
  let text = "";
  try {
    text = JSON.stringify(sidecar);
  } catch {
    return out;
  }
  for (const m of text.matchAll(ANY_DIGIT)) out.add(normalizeDigits(m[0]));
  for (const m of text.matchAll(ANY_NUMBER_WORD_RUN)) {
    const v = parseNumberWords(m[0].toLowerCase().split(/[\s-]+/).filter(Boolean));
    if (v !== null) out.add(String(v));
  }
  return out;
}

// ── Reader-facing field walker ────────────────────────────────────────────────
function readerFields(chapter: ChapterV21): Array<{ unit: string; text: string }> {
  const fields: Array<{ unit: string; text: string }> = [];
  const add = (unit: string, text: unknown) => {
    if (typeof text === "string" && text.trim()) fields.push({ unit, text });
  };
  add("hook", chapter.hook);
  add("counterintuition", chapter.counterintuition);
  add("tryThisNow", chapter.tryThisNow);
  add("keyTakeaway", chapter.keyTakeaway);
  const bd = chapter.breakdown ?? ({} as any);
  for (const tier of ["fastRead", "deepRead", "fullRead"] as const) add(`breakdown.${tier}`, bd[tier]);
  chapter.examples?.forEach((e, i) => {
    add(`examples[${i}].title`, e.title);
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
  const impl = chapter.implementationPlan;
  if (impl) {
    add("implementationPlan.coreSkill", impl.coreSkill);
    impl.ifThenPlans?.forEach((it, i) => {
      add(`implementationPlan.ifThenPlans[${i}].context`, it.context);
      add(`implementationPlan.ifThenPlans[${i}].plan`, it.plan);
    });
    add("implementationPlan.twentyFourHourChallenge", impl.twentyFourHourChallenge);
    add("implementationPlan.weeklyPractice", impl.weeklyPractice);
  }
  return fields;
}

const GN1_FIX =
  "Trace every reader-facing number to a sidecar testableFact / hardSpecific / groundedNumber, or write it qualitatively ('most nights', 'far more often'). Do not invent precision to sound rigorous.";

const UNIT_NOUN: Record<FigureUnit, string> = {
  percent: "percentage",
  multiplier: "multiplier",
  magnitude: "magnitude figure",
};

/**
 * GN1 — ungrounded statistical figure in reader prose. SHADOW = major (high-FP
 * risk; calibrate before any blocker promotion). v2-gated: returns [] when the
 * chapter has no source-v2 sidecar, so v1 chapters never brick.
 * Pass `sidecarOverride` to inject a v2 sidecar in tests.
 */
export function checkGroundedNumbers(chapter: ChapterV21, sidecarOverride?: unknown): CriticFinding[] {
  const sidecar = sidecarOverride ?? (chapter.chapterId ? loadChapterSidecar(chapter.chapterId) : null);
  if (detectSidecarShape(sidecar) !== "v2") return []; // v2-only — v1 cannot brick
  const allow = groundedNumberTokens(sidecar);
  const findings: CriticFinding[] = [];
  for (const { unit, text } of readerFields(chapter)) {
    for (const hit of findUngroundedNumbers(text, allow)) {
      findings.push(
        finding(
          "GN1.ungrounded_number" as any,
          "major",
          `${unit}: ungrounded ${UNIT_NOUN[hit.unit]} — "${truncate(hit.figure, 60)}" traces to no number in this chapter's source notes (invented precision reads as factual_accuracy corruption at QC). ${GN1_FIX}`,
          hit.sentence,
        ),
      );
    }
  }
  return findings;
}
