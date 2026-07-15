/**
 * Chapter Format v25 (D8) — deterministic write-time checks.
 *
 * Spec: docs/v25/CHAPTER_FORMAT_V25.md; ratification: plan v2 (D7-D10). Only
 * the schema-crisp check gates (F25.quiz_feedback — the F-2 feedback block);
 * the semantic requirements (layer independence, cognitive economy) get
 * ADVISORY heuristics here and their real enforcement at the rubric-audit gate
 * (STIER-2 lesson: lexical gates on semantic properties invert — CHB14/15/17).
 *
 * Enforcement is opt-in via ShipGateOptions.formatV25 so gate-chapter replays
 * of the shipped pre-v25 corpus stay green; the production authoring path
 * (runLocalAuthoringChapter) always opts in.
 */

import type { ChapterV21 } from "../types.js";

export type FormatV25Finding = {
  catalogId: "F25.quiz_feedback" | "F25.duplicate_example" | "F25.tier_serial_opener";
  unit: string;
  message: string;
  evidence?: string;
};

/** Reader-facing components a quiz revisit pointer may name. Example/Card
 *  references carry an index that must exist in the chapter. */
const REVISIT_FIXED_COMPONENTS = new Set([
  "hook", "counterintuition", "fast read", "deep read", "full read",
  "implementation plan", "try this now", "key takeaway",
]);

function revisitComponentResolves(component: string, chapter: ChapterV21): boolean {
  const normalized = component.trim().toLowerCase();
  if (REVISIT_FIXED_COMPONENTS.has(normalized)) return true;
  const indexed = /^(example|card) (\d+)$/.exec(normalized);
  if (indexed !== null) {
    const index = Number(indexed[2]);
    const count = indexed[1] === "example" ? chapter.examples.length : chapter.reviewCards.length;
    return index >= 1 && index <= count;
  }
  return false;
}

/** F-2 (HARD when Format v25 is enforced): every quiz question carries a
 *  complete feedback block — one rationale per choice and a revisit pointer
 *  that resolves to a real reader-facing component. */
export function checkFormatV25QuizFeedback(chapter: ChapterV21): FormatV25Finding[] {
  const findings: FormatV25Finding[] = [];
  chapter.quiz.questions.forEach((question, index) => {
    const unit = `quiz.questions[${index}]`;
    const rationales = question.choiceRationales;
    if (!Array.isArray(rationales) || rationales.length !== question.choices.length
      || rationales.some((entry) => typeof entry !== "string" || entry.trim().length === 0)) {
      findings.push({
        catalogId: "F25.quiz_feedback",
        unit,
        message: `question ${index + 1} needs choiceRationales: exactly ${question.choices.length} nonempty rationales, one per choice in choice order (why the key is right; the misconception each distractor encodes)`,
      });
    }
    const revisit = question.revisit;
    if (revisit === undefined || typeof revisit.component !== "string" || typeof revisit.ref !== "string"
      || revisit.ref.trim().length === 0 || !revisitComponentResolves(revisit.component, chapter)) {
      findings.push({
        catalogId: "F25.quiz_feedback",
        unit,
        message: `question ${index + 1} needs revisit {component, ref} naming a real reader-facing component (Hook, Counterintuition, Fast/Deep/Full read, Example N, Card N, Implementation plan, Try this now, Key takeaway)`,
        evidence: revisit === undefined ? undefined : JSON.stringify(revisit),
      });
    }
  });
  return findings;
}

function contentTokens(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((token) => token.length > 0);
}

function nGrams(tokens: string[], n: number): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i + n <= tokens.length; i += 1) out.add(tokens.slice(i, i + n).join(" "));
  return out;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const item of a) if (b.has(item)) intersection += 1;
  return intersection / (a.size + b.size - intersection);
}

const DUPLICATE_EXAMPLE_JACCARD = 0.35;

/** F-3 heuristic (ADVISORY): two examples staging the same underlying
 *  demonstration (the duplicate-Harlow defect). 5-gram Jaccard over the
 *  example bodies — advisory only; the rubric-audit gate owns the real call. */
export function checkFormatV25DuplicateExamples(chapter: ChapterV21): FormatV25Finding[] {
  const findings: FormatV25Finding[] = [];
  const grams = chapter.examples.map((example) =>
    nGrams(contentTokens(`${example.scenario} ${example.whatToDo} ${example.whyItMatters}`), 5));
  for (let a = 0; a < grams.length; a += 1) {
    for (let b = a + 1; b < grams.length; b += 1) {
      const similarity = jaccard(grams[a], grams[b]);
      if (similarity > DUPLICATE_EXAMPLE_JACCARD) {
        findings.push({
          catalogId: "F25.duplicate_example",
          unit: `examples[${a}]/examples[${b}]`,
          message: `examples ${a + 1} and ${b + 1} appear to stage the same demonstration (5-gram Jaccard ${similarity.toFixed(2)} > ${DUPLICATE_EXAMPLE_JACCARD})`,
        });
      }
    }
  }
  return findings;
}

/** Serial-opener heuristics for F-1 (ADVISORY): a deeper tier that opens as a
 *  continuation of another tier's scene, or uses explicit back-reference
 *  connectives. The real layer-independence call is the rubric-audit gate's
 *  per-layer adjudication; this only surfaces the mechanical tells the
 *  verified corpus showed ("Rachel's proof works…", "Those three patterns…",
 *  "as we saw"). */
const SERIAL_POSSESSIVE_OPENER = /^[A-Z][a-z]+['’]s\s/;
const SERIAL_DEICTIC_OPENER = /^(Those|These|That same)\s/;
const SERIAL_BACK_REFERENCE = /\b(as we saw|as noted above|as shown above|earlier we|we saw earlier|the study above)\b/i;

export function checkFormatV25TierSerialOpeners(chapter: ChapterV21): FormatV25Finding[] {
  const findings: FormatV25Finding[] = [];
  const tiers: Array<[string, string]> = [
    ["breakdown.deepRead", chapter.breakdown.deepRead],
    ["breakdown.fullRead", chapter.breakdown.fullRead],
  ];
  for (const [unit, text] of tiers) {
    const trimmed = text.trimStart();
    if (SERIAL_POSSESSIVE_OPENER.test(trimmed) || SERIAL_DEICTIC_OPENER.test(trimmed)) {
      findings.push({
        catalogId: "F25.tier_serial_opener",
        unit,
        message: "tier opens as a continuation of another tier's scene — each read tier must establish its own context (a reader in this app mode sees ONLY this tier)",
        evidence: trimmed.slice(0, 80),
      });
    }
    if (SERIAL_BACK_REFERENCE.test(text)) {
      findings.push({
        catalogId: "F25.tier_serial_opener",
        unit,
        message: "tier carries an explicit back-reference connective — deeper tiers restate context in fresh words, never point at text the reader may not have",
        evidence: SERIAL_BACK_REFERENCE.exec(text)?.[0],
      });
    }
  }
  return findings;
}

/** All Format v25 deterministic findings for the ship gate. */
export function checkFormatV25(chapter: ChapterV21): FormatV25Finding[] {
  return [
    ...checkFormatV25QuizFeedback(chapter),
    ...checkFormatV25DuplicateExamples(chapter),
    ...checkFormatV25TierSerialOpeners(chapter),
  ];
}
