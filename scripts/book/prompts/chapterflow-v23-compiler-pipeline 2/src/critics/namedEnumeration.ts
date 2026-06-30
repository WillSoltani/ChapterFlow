/**
 * Named-enumeration completeness critic (NE1) — when reader prose names a
 * fixed-size set ("the seven habits", "the five stages") and then enumerates it,
 * the list must contain that many items.
 *
 * THE DEFECT (the-slight-edge ch13, a live-run factual_accuracy CORRUPTION the
 * rubric self-score missed): "Coralie reads the seven habits from a small printed
 * list: show up, be consistent, pay the price." — a 3-item excerpt framed as the
 * complete seven. A reader who knows the source (or just counts) sees the teaching
 * misstate its own framework. This is the same class the publishable bar calls out
 * ("BRAVING = 7 items, not 6"); NE1 shifts it left to a deterministic gate.
 *
 * TIGHT by calibration — a colon does NOT always introduce a list. the-compound-
 * effect's "the two losses: clear them and waste money, or keep them and let the
 * eating-better setup …" is a colon-EXPLANATION of two options (the items carry
 * internal "and"/"or" and run long), NOT a two-item enumeration, and must NOT fire.
 * So NE1 fires ONLY on:
 *   - "the <N:2..12> <plural-noun>" (the named set), NOT preceded by a partial
 *     framing ("three of the seven", "some of the five"),
 *   - directly enumerated by a COLON within the same sentence,
 *   - whose items are SHORT (<=4 words) and conjunction-free (a clean list, not an
 *     explanation), and whose count differs from N,
 *   - and NOT softened by "such as / including / like / for example / e.g." (an
 *     explicitly partial illustration).
 * Calibrated zero count-mismatch on the gold corpus and across the catalog (the one
 * corpus hit — "the two losses" — is the FP this guard excludes by construction).
 */

import { ChapterV21, CriticFinding } from "../types.js";
import { finding, truncate } from "./shared.js";
import { splitSentences } from "./textUtils.js";

const NUM: Record<string, number> = {
  two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
};
const NUM_ALT = Object.keys(NUM).join("|");

// "the <number-word> <plural-noun>" — the named set. group1 = number, group2 = noun.
const NAMED_SET = new RegExp(`\\bthe\\s+(${NUM_ALT})\\s+([a-z]+s)\\b`, "i");
// Partial framing right before "the <N>" — "three of the seven habits", "some of the".
const PARTIAL_BEFORE = /\b(?:of|one|two|three|four|five|six|seven|eight|nine|ten|some|several|many|most|few|couple|handful)\s+of\s*$/i;
// Illustrative softeners near the set → an explicitly partial list, never a full enumeration.
const ILLUSTRATIVE = /\b(?:such as|including|like|for example|e\.g\.|for instance)\b/i;
// Generic words that legitimately bridge the named set to its colon-list ("the seven
// habits from a small printed LIST:"). If the word right before the colon is none of
// these and is not the set's own noun, the colon enumerates a DIFFERENT noun (the-5-am-
// club "the ten tactics … audit scarce RESOURCES: attention, …") — not the set's list.
const BRIDGE_WORDS = new Set(["list", "lists", "following", "these", "those", "them", "namely", "below", "here", "are", "is", "set"]);

export type EnumerationHit = {
  /** The named set as written ("the seven habits"). */
  phrase: string;
  /** The number the prose claims (7). */
  claimed: number;
  /** The number the list actually enumerates (3). */
  listed: number;
  /** The full sentence, for evidence. */
  sentence: string;
};

/** Split a colon-tail into clean enumeration items, or return null when it is not a
 *  clean short-item list (an explanation, compound items, or long clauses). */
function cleanListItems(tail: string): string[] | null {
  // Take up to the sentence-ending period (the list lives in this sentence).
  const listText = tail.split(/(?<=[.?!])\s/)[0].replace(/[.?!]\s*$/, "").trim();
  if (!listText) return null;
  // A clean enumeration is COMMA-separated. Split on commas FIRST, then strip only a
  // LEADING Oxford "and/or" per item ("…, and practice integrity"). An item that
  // STILL carries an INTERNAL "and/or" — or runs long — is a compound clause (an
  // EXPLANATION: "clear them AND waste money", "stay in the role AND absorb the cost"),
  // not a clean list item, so bail. (Folding all "and/or" up front would erase exactly
  // the signal that separates a list from an explanation — the original bug.)
  const parts = listText
    .split(",")
    .map((s) => s.trim().replace(/^(?:and|or)\s+/i, ""))
    .filter(Boolean);
  if (parts.length < 2) return null; // not a comma-separated list
  for (const item of parts) {
    if (/\b(?:and|or)\b/i.test(item)) return null; // internal conjunction → compound, not a clean item
    if (item.split(/\s+/).length > 4) return null; // long clause → explanation, not a list item
  }
  return parts;
}

/** Pure detector: every named-set enumeration in `text` whose item count ≠ the
 *  named number. Tight (see file header) so a colon-explanation never trips it. */
export function findEnumerationMismatch(text: string): EnumerationHit[] {
  if (!text || typeof text !== "string") return [];
  const hits: EnumerationHit[] = [];
  for (const sentence of splitSentences(text)) {
    const m = NAMED_SET.exec(sentence);
    if (!m) continue;
    const claimed = NUM[m[1].toLowerCase()];
    const before = sentence.slice(0, m.index);
    if (PARTIAL_BEFORE.test(before)) continue; // "three of the seven habits"
    // The colon must follow the set within a short window (allow "… from a small list:").
    const after = sentence.slice(m.index + m[0].length);
    const colon = after.search(/:/);
    if (colon < 0 || colon > 40) continue; // no direct enumeration
    const between = after.slice(0, colon);
    if (ILLUSTRATIVE.test(between) || ILLUSTRATIVE.test(before)) continue; // partial illustration
    if (/[.?!]/.test(between)) continue; // colon is in a later sentence-fragment, not this set's list
    // The colon must enumerate THIS set: the word right before it is the set's own
    // noun or a generic bridge word ("…from a small printed list:"). Otherwise the
    // colon belongs to a different noun (5am-club "…audit scarce resources:").
    const bridge = between.trim().toLowerCase();
    const lastBridge = bridge.split(/\s+/).pop() ?? "";
    if (bridge && lastBridge !== m[2].toLowerCase() && !BRIDGE_WORDS.has(lastBridge)) continue;
    const items = cleanListItems(after.slice(colon + 1));
    if (!items) continue;
    if (items.length === claimed) continue; // complete — good
    hits.push({ phrase: m[0], claimed, listed: items.length, sentence });
  }
  return hits;
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
  chapter.reviewCards?.forEach((c, i) => {
    add(`reviewCards[${i}].front`, c.front);
    add(`reviewCards[${i}].back`, c.back);
  });
  chapter.memorableLines?.forEach((l, i) => add(`memorableLines[${i}].text`, l.text));
  return fields;
}

const NE1_FIX =
  "List all the items the named set claims, or reframe the wording as a selection ('three of the seven habits', 'habits such as …'). Do not present an excerpt as the complete set.";

/**
 * NE1 — a named fixed-size set enumerated with the wrong number of items. SHADOW =
 * major (a deterministic complement to the semantic factual_accuracy axis; advisory
 * until a gold proof clears it for blocker promotion). Fires only on the tight
 * colon-list count-mismatch (see file header), so a colon-explanation never trips it.
 */
export function checkNamedEnumeration(chapter: ChapterV21): CriticFinding[] {
  const findings: CriticFinding[] = [];
  for (const { unit, text } of readerFields(chapter)) {
    for (const hit of findEnumerationMismatch(text)) {
      findings.push(
        finding(
          "NE1.named_enumeration_mismatch" as any,
          "major",
          `${unit}: named-set enumeration mismatch — "${truncate(hit.phrase, 40)}" claims ${hit.claimed} but the list enumerates ${hit.listed} (an excerpt framed as the complete set reads as factual_accuracy corruption at QC). ${NE1_FIX}`,
          hit.sentence,
        ),
      );
    }
  }
  return findings;
}
