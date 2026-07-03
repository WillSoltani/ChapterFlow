/**
 * Misattribution writer-disposition lever (MA1) — a named authority must be
 * credited with a claim only when the source credits THEM with THAT claim. The
 * "Hardy move": borrowing a comparison-mention as an attribution.
 *
 * THE DEFECT (the-slight-edge ch8, a live-run factual_accuracy CORRUPTION that is
 * NOT the "Piper move" and NOT enumeration): the source compared the book to Darren
 * Hardy's *The Compound Effect* and noted a Mind Map Guy summary used the words
 * "mundane"/"unsexy" — and the chapter then framed that phrase AS DARREN HARDY'S.
 * Hardy is real, and he IS in the brief (as a comparison) — so "name absent from
 * the source" can't catch it. The error is a ROLE confusion: a name MENTIONED or
 * COMPARED is promoted to the CREDITED SOURCE of a specific claim.
 *
 * WHY THIS IS A LEVER, NOT A GATE. Whether an attribution is CORRECT is semantic —
 * it needs the brief to say who actually owns the claim — so a deterministic gate
 * would either miss it (the name is present) or fire on every legitimate citation.
 * So MA1 mirrors EW1's detector B: it surfaces every named authority carrying a
 * finding for WRITER DISPOSITION (the `evidence-audit` CLI), where the writer
 * confirms each against the brief. A false candidate costs one brief-check; nothing
 * blocks. The QC factual_accuracy axis remains the semantic backstop.
 */

import { ChapterV21 } from "../types.js";
import { splitSentences } from "./textUtils.js";

// Capitalized words that look name-shaped but never head an attribution.
const NAME_STOPWORDS = new Set([
  "The", "This", "That", "These", "Those", "Their", "They", "Them", "Then",
  "Today", "Tomorrow", "Yesterday", "Monday", "Tuesday", "Wednesday", "Thursday",
  "Friday", "Saturday", "Sunday", "January", "February", "March", "April", "May",
  "June", "July", "August", "September", "October", "November", "December",
  "When", "While", "Because", "After", "Before", "During", "Here", "There",
  "Both", "Each", "Every", "Some", "Many", "Most", "One", "Once", "Who", "Whose",
  "Which", "What", "How", "Why", "Research", "Studies", "Science", "History",
  "Chapter", "Section", "Part", "Today", "People", "Everyone", "Someone", "Anyone",
  "Our", "Your", "His", "Her", "Its", "We", "You", "She", "He", "It", "I",
  // Common sentence-initial gerunds — a "<Gerund> <verb>" never heads a real
  // attribution ("Adding calls after discharge…"), so they are not name subjects.
  "Adding", "Building", "Making", "Taking", "Giving", "Getting", "Using", "Keeping",
  "Putting", "Setting", "Doing", "Being", "Having", "Going", "Coming", "Looking",
  "Working", "Starting", "Running", "Holding", "Asking", "Showing", "Finding",
  "Noting", "Calling", "Naming", "Writing", "Reading", "Seeing", "Knowing",
]);

// Authorship / finding verbs — the grammar that CREDITS a named source with a claim.
// Strong authorship/finding verbs. Polysemous present-tense NOUNS ("notes",
// "calls", "terms", "labels") are excluded — they collide with plain nouns and
// muddy the lever; their unambiguous past forms ("noted", "called", "termed",
// "labeled") are kept.
const ATTRIBUTION_VERB =
  "argues|argued|finds|found|shows|showed|discovers|discovered|proves|proved|" +
  "coins|coined|demonstrates|demonstrated|concludes|concluded|reports|reported|" +
  "observes|observed|claimed|wrote|writes|called|describes|described|termed|" +
  "labeled|theorized|popularized|introduced|defines|defined";
// Claim nouns a possessive credits ("Hardy's idea", "Mischel's experiment").
const CLAIM_NOUN =
  "research|study|studies|experiment|experiments|work|finding|findings|theory|" +
  "theories|framework|idea|ideas|argument|claim|phrase|term|concept|principle|" +
  "law|rule|model|point|insight|observation|data|results?|notion|maxim|dictum";

// "Name <verb> [that/how/why]" — a proper name (1–2 capitalized tokens) crediting a claim.
const VERB_ATTRIB = new RegExp(
  `\\b([A-Z][a-z]+(?:\\s+[A-Z][a-z]+)?)\\s+(?:${ATTRIBUTION_VERB})\\b`,
);
// "according to Name" (the preposition may be sentence-initial — "According to …").
const ACCORDING_TO = /\b[Aa]ccording to\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/;
// "Name's <claim-noun>".
const POSSESSIVE_ATTRIB = new RegExp(
  `\\b([A-Z][a-z]+(?:\\s+[A-Z][a-z]+)?)['’]s\\s+(?:${CLAIM_NOUN})\\b`,
);

export type AttributionItem = {
  /** The credited authority as written ("Darren Hardy", "Mischel"). */
  subject: string;
  /** The full sentence, for the writer to check against the brief. */
  sentence: string;
};

function firstName(full: string): string {
  return full.trim().split(/\s+/)[0];
}

/** Pure detector: every named authority credited with a claim in `text`. The wider
 *  net for writer disposition — a false candidate costs one brief-check. Deduped by
 *  subject (first appearance wins). */
export function findAttributionClaims(text: string): AttributionItem[] {
  if (!text || typeof text !== "string") return [];
  const items: AttributionItem[] = [];
  const seen = new Set<string>();
  for (const sentence of splitSentences(text)) {
    for (const re of [VERB_ATTRIB, ACCORDING_TO, POSSESSIVE_ATTRIB]) {
      const m = re.exec(sentence);
      if (!m) continue;
      const subject = m[1];
      if (NAME_STOPWORDS.has(firstName(subject)) || NAME_STOPWORDS.has(subject)) continue;
      const key = subject.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({ subject, sentence });
    }
  }
  return items;
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
    add(`quiz.questions[${i}].explanation`, q.explanation);
  });
  chapter.reviewCards?.forEach((c, i) => {
    add(`reviewCards[${i}].front`, c.front);
    add(`reviewCards[${i}].back`, c.back);
  });
  chapter.memorableLines?.forEach((l, i) => add(`memorableLines[${i}].text`, l.text));
  return fields;
}

export type AttributionAuditItem = AttributionItem & { unit: string };

/**
 * Walk the reader-facing fields and surface every named authority credited with a
 * claim — the WIDER net for the `evidence-audit` writer lever. The writer
 * dispositions each: is this authority credited with THIS claim in the brief, or
 * merely mentioned / compared (the "Hardy move")? Deduped by subject across the
 * chapter (first unit wins). NOT a gate — the misattribution class is semantic.
 */
export function auditChapterAttributions(chapter: ChapterV21): AttributionAuditItem[] {
  const items: AttributionAuditItem[] = [];
  const seen = new Set<string>();
  for (const { unit, text } of readerFields(chapter)) {
    for (const hit of findAttributionClaims(text)) {
      const key = hit.subject.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({ unit, subject: hit.subject, sentence: hit.sentence });
    }
  }
  return items;
}
