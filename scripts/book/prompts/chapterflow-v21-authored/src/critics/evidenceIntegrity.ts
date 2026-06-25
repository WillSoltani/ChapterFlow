/**
 * Evidence-integrity critics (EI1 / EI2) — testimonials must never masquerade
 * as research.
 *
 * THE DEFECT (new-pipeline regression vs. the old books). The writer dresses a
 * first-name / initial-only TESTIMONIAL in the grammar of evidence:
 *   "Brad's report names the hinge."
 *   "Candace P.'s report gives her the test."
 *   "John's Maui habit report makes the rule small."
 *   "Jean B.'s report points to another kind of growth."
 *   "The same success report names ketogenic diet adherence."
 * and — worst — keys a QUIZ answer to one. Trust is load-bearing: the instant a
 * reader senses the "evidence" is a hollow anecdote wearing a finding's costume,
 * they discount the teaching.
 *
 * THE CLEAN BOOKS never do this. They resolve a load-bearing claim to either a
 * REAL NAMED SOURCE with specifics ("Coco Chanel… February 1954", "Michael
 * Kosfeld's trust-game result", "the 2012 USADA case") or a PLAIN ILLUSTRATION
 * carrying no evidentiary verb (Atomic Habits' nurse just acts — nobody says
 * "the nurse's report proves").
 *
 * THE DISCRIMINATOR (calibrated on real bad + gold content, zero-FP on gold):
 *  - The defect's tell is a PERSONAL-ANECDOTE noun ("report", "account",
 *    "success report") owned by a bare given name / lone-initial subject, with a
 *    separate insight verb predicated of it.
 *  - A real cited source reads differently: a FULL name ("Michael Kosfeld's"),
 *    a SURNAME with a DOCUMENTARY noun ("Kosfeld's case shows", "Armstrong's
 *    … USADA case"), or a company/method. Those use research-class nouns
 *    (case / study / result / findings) and survive untouched.
 * So EI splits noun classes: a TESTIMONIAL noun fires for any given-name subject;
 * a RESEARCH noun fires ONLY for an unambiguous lone-initial testimonial subject
 * ("Candace P."), which a real source is never written as.
 *
 * EI1 = testimonial-as-evidence in load-bearing prose (blocker).
 * EI2 = a quiz answer keyed to a testimonial (blocker — the hard rule).
 *
 * The Piper-in-Schultz's-lab case (an invented character acting out a real
 * researcher's documented finding) is SEMANTIC, not syntactic — a regex can't
 * tell invented "Piper" from real "Schultz". That is handled by the authoring
 * law (STEP-2) + the QC publishable-bar (factual_accuracy = CORRUPTION), not here.
 */

import { ChapterV21, CriticFinding } from "../types.js";
import { finding, truncate } from "./shared.js";
import { splitSentences } from "./textUtils.js";
import { loadChapterSidecar } from "./sourceGrounding.js";
import { buildSourceAnchorCatalog } from "../source/sourceEvidence.js";

// Personal-anecdote evidence words: a person's own "report"/"account" of their
// experience. "story"/"success story" is EXCLUDED — a narrative word that legitimately
// attaches to a real named entity ("Enron's Houston success story… 2001 bankruptcy").
const TESTIMONIAL_NOUN_ALT = "success\\s+report|self[-\\s]?report|testimonial|testimony|anecdote|reports?|account";

// Documentary / research evidence words. A real source legitimately owns these
// ("Kosfeld's case shows", "a 2026 study found"), so these fire ONLY when the OWNER
// is an unambiguous lone-initial testimonial ("Candace P.'s study"), which a real
// source is never written as.
const RESEARCH_NOUN_ALT = "case|stud(?:y|ies)|results?|findings?|data|dataset|trial|experiment";

// Up to 2 premodifier words may sit between the possessive owner and the noun it
// owns — a real "<Name>'s [adj] [adj] report" noun phrase rarely exceeds two. This
// is tight enough to OWN the noun ("John's Maui habit report" ✓) yet reject a noun
// reached across a clause ("Hermine's desk shows three report pauses" ✗ — owner owns
// "desk", "report" is 3 words downstream). Lazy + bounded.
const OWNED_GAP = "(?:[A-Za-z][\\w'’-]*\\s+){0,2}?";

// A bare given-name possessive that directly OWNS a testimonial noun: "Brad's report",
// "John's Maui habit report". Ownership (not mere sentence co-occurrence) is the fix
// that removed the "A trend report shows Veronica's team" / "Jenna's tally … one
// report" false-positive class. Group 2 = the owner.
const GIVEN_OWNS_TESTIMONIAL = new RegExp(
  `(^|[\\s("“'])([A-Z][a-z]+)['’]s\\s+${OWNED_GAP}(?:${TESTIMONIAL_NOUN_ALT})\\b`,
  "g",
);

// A lone-initial possessive ("Candace P.'s", "Jean B.'s") owning a testimonial OR
// research noun. The "First Initial.'s" form is itself the anonymized-testimonial tell
// (a real cited author is "Elmer R. Gates" — a MIDDLE initial followed by a surname,
// never possessive on the initial), so it fires on research nouns too. Group 2 = owner.
const LONE_INITIAL_OWNS = new RegExp(
  `(^|[\\s("“'])([A-Z][a-z]+\\s+[A-Z]\\.)['’]s\\s+${OWNED_GAP}(?:${TESTIMONIAL_NOUN_ALT}|${RESEARCH_NOUN_ALT})\\b`,
  "g",
);

// Evidentiary / insight predication SOMEWHERE in the sentence — so a pure narrative
// mention ("Brad's report sat on the desk") never fires. EXCLUDES "reports/reported"
// (ambiguous with the noun) and dialogue verbs ("says"). "points to" precedes bare alts.
const INSIGHT_VERB = /\b(?:points?\s+to|names?|proves?|proved|shows?|showed|gives?|gave|makes?|made|confirms?|confirmed|demonstrates?|demonstrated|establishes?|established|reveals?|revealed|indicates?|indicated|finds?|found|suggests?|suggested)\b/i;

// Capitalized words that look name-shaped but never head a testimonial subject.
const SUBJECT_STOPWORDS = new Set([
  "The", "This", "That", "These", "Those", "Their", "They", "Today", "Tomorrow",
  "Yesterday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
  "Sunday", "January", "February", "March", "April", "May", "June", "July",
  "August", "September", "October", "November", "December", "When", "While",
  "Because", "After", "Before", "During", "Here", "There", "Both", "Each",
  "Every", "Some", "Many", "Most", "One", "Once",
]);

export type TestimonialHit = {
  /** The offending subject as written ("Brad", "Candace P.", "the success report"). */
  subject: string;
  /** Which class of pattern matched, for the message + debugging. */
  pattern: "lone_initial" | "given_name_report" | "ownerless_success_report";
  /** The full sentence, for evidence. */
  sentence: string;
};

/** Lowercased single tokens that belong to a MULTI-WORD real source entity in the
 *  chapter's source-v2 sidecar (e.g. "kosfeld" from "Michael Kosfeld", "volkswagen"
 *  from "Volkswagen Phaeton"). A bare given-name subject that matches one of these
 *  is a real cited source, not a testimonial → excluded. Multi-word-only so a lone
 *  anonymized first name ("Brad") is never accidentally exempted. */
export function realEntityTokensFromSidecar(sidecar: unknown): Set<string> {
  const out = new Set<string>();
  try {
    if (!sidecar || (sidecar as any).schemaVersion !== "source-v2") return out;
    const catalog = buildSourceAnchorCatalog(sidecar as any);
    const phrases: string[] = [];
    for (const anchor of catalog) {
      if (anchor.label) phrases.push(anchor.label);
      for (const s of anchor.hardSpecifics ?? []) phrases.push(String(s));
    }
    for (const phrase of phrases) {
      const tokens = phrase.match(/[A-Za-z][A-Za-z'’-]+/g) ?? [];
      if (tokens.length < 2) continue; // multi-word entity only
      for (const t of tokens) out.add(t.toLowerCase());
    }
  } catch {
    /* non-v2 / malformed sidecar → no exclusions (the syntactic noun-class split
       carries zero-FP on its own; the sidecar set is only a bonus when present). */
  }
  return out;
}

/** Is `name` (a possessive owner like "Kosfeld" in "Kosfeld's") part of a real
 *  cited source — a FULL name ("Michael Kosfeld's"), a name with a trailing
 *  surname, or a known sidecar entity? Such owners are legitimate, not testimonials. */
function ownerIsRealSource(sentence: string, matchStart: number, name: string, realEntities: Set<string>): boolean {
  // Full name: a Capitalized word immediately precedes the owner ("Michael Kosfeld's").
  const before = sentence.slice(0, matchStart);
  if (/\b[A-Z][a-z]+[\s]+$/.test(before)) return true;
  // Sidecar real entity (multi-word source like "Michael Kosfeld" / "Volkswagen Phaeton").
  if (realEntities.has(name.toLowerCase())) return true;
  return false;
}

/**
 * Find every testimonial-dressed-as-evidence hit in one text span. Pure
 * (text → hits) so it is exhaustively unit-testable. `realEntities` exempts
 * owners that are known real sidecar sources (empty set when no v2 sidecar).
 */
export function findTestimonialEvidence(text: string, realEntities: Set<string> = new Set()): TestimonialHit[] {
  if (!text || typeof text !== "string") return [];
  const hits: TestimonialHit[] = [];
  for (const sentence of splitSentences(text)) {
    // An evidentiary verb must be present somewhere, so a pure narrative mention
    // ("Brad's report sat on the desk") never fires — only an evidence CLAIM does.
    if (!INSIGHT_VERB.test(sentence)) continue;

    // ── Pattern A: lone-initial possessive owning an evidence noun ──
    // "Candace P.'s report gives the test", "Jean B.'s report points to growth".
    // The "First Initial.'s" form is the anonymized-testimonial tell; a real cited
    // author ("Elmer R. Gates") is a MIDDLE initial + surname, never possessive on
    // the initial, so it cannot match this.
    let fired = false;
    LONE_INITIAL_OWNS.lastIndex = 0;
    for (let m = LONE_INITIAL_OWNS.exec(sentence); m; m = LONE_INITIAL_OWNS.exec(sentence)) {
      hits.push({ subject: m[2], pattern: "lone_initial", sentence });
      fired = true;
      break;
    }
    if (fired) continue;

    // ── Pattern B: bare given-name possessive OWNING a testimonial noun ──
    // "Brad's report names the hinge", "John's Maui habit report makes the rule".
    // Ownership-adjacency (not sentence co-occurrence) is what excludes "A trend
    // report shows Veronica's team" and "Jenna's tally … one report". Research-class
    // nouns don't fire here, protecting "Kosfeld's case shows". Real-source owners
    // (full name / sidecar entity) are excluded.
    GIVEN_OWNS_TESTIMONIAL.lastIndex = 0;
    for (let m = GIVEN_OWNS_TESTIMONIAL.exec(sentence); m; m = GIVEN_OWNS_TESTIMONIAL.exec(sentence)) {
      const name = m[2];
      if (SUBJECT_STOPWORDS.has(name)) continue;
      const ownerStart = m.index + m[1].length;
      if (ownerIsRealSource(sentence, ownerStart, name, realEntities)) continue;
      hits.push({ subject: name, pattern: "given_name_report", sentence });
      fired = true;
      break;
    }
    if (fired) continue;

    // ── Pattern C: ownerless success-report + insight verb ──
    // "The same success report names ketogenic diet adherence." ("success story" is
    // excluded for the real-entity reason above.)
    if (/\bsuccess\s+report\b/i.test(sentence)) {
      hits.push({ subject: "success report", pattern: "ownerless_success_report", sentence });
    }
  }
  return hits;
}

/** The reader-facing prose fields EI1 scans (the keyed quiz answer + explanation
 *  are owned by EI2, so they are excluded here to avoid double-flagging). */
function ei1Fields(chapter: ChapterV21): Array<{ unit: string; text: string }> {
  const fields: Array<{ unit: string; text: string }> = [];
  const bd = chapter.breakdown ?? ({} as any);
  for (const tier of ["fastRead", "deepRead", "fullRead"] as const) {
    if (bd[tier]) fields.push({ unit: `breakdown.${tier}`, text: bd[tier] });
  }
  chapter.examples?.forEach((e, i) => {
    if (e.scenario) fields.push({ unit: `examples[${i}].scenario`, text: e.scenario });
    if (e.whatToDo) fields.push({ unit: `examples[${i}].whatToDo`, text: e.whatToDo });
    if (e.whyItMatters) fields.push({ unit: `examples[${i}].whyItMatters`, text: e.whyItMatters });
  });
  chapter.quiz?.questions?.forEach((q, i) => {
    if (q.prompt) fields.push({ unit: `quiz.questions[${i}].prompt`, text: q.prompt });
    const ci = q.correctIndex;
    (q.choices ?? []).forEach((c, j) => {
      if (j !== ci && c) fields.push({ unit: `quiz.questions[${i}].choices[${j}]`, text: c });
    });
  });
  chapter.reviewCards?.forEach((c, i) => {
    if (c.front) fields.push({ unit: `reviewCards[${i}].front`, text: c.front });
    if (c.back) fields.push({ unit: `reviewCards[${i}].back`, text: c.back });
  });
  if (chapter.keyTakeaway) fields.push({ unit: "keyTakeaway", text: chapter.keyTakeaway });
  chapter.memorableLines?.forEach((l, i) => {
    if (l.text) fields.push({ unit: `memorableLines[${i}].text`, text: l.text });
  });
  return fields;
}

const EI1_FIX = "Resolve it to a real named source with specifics (a person, date, place, study, or measurable fact), or make it a plain illustration with no evidentiary verb. Do NOT merely strip the name — a vague claim is not the fix.";

/**
 * EI1 — testimonial dressed as research in load-bearing prose. BLOCKER.
 * Pass `sidecarOverride` to inject a v2 sidecar (real-entity exclusions) in tests.
 */
export function checkTestimonialEvidence(chapter: ChapterV21, sidecarOverride?: unknown): CriticFinding[] {
  const sidecar = sidecarOverride ?? (chapter.chapterId ? loadChapterSidecar(chapter.chapterId) : null);
  const realEntities = realEntityTokensFromSidecar(sidecar);
  const findings: CriticFinding[] = [];
  for (const { unit, text } of ei1Fields(chapter)) {
    for (const hit of findTestimonialEvidence(text, realEntities)) {
      findings.push(
        finding(
          "EI1.testimonial_as_evidence" as any,
          "blocker",
          `${unit}: testimonial dressed as research — "${truncate(hit.subject, 60)}" carries the grammar of evidence (a first-name/initial-only subject's personal account presented as a finding). ${EI1_FIX}`,
          hit.sentence,
        ),
      );
    }
  }
  return findings;
}

/**
 * EI2 — a quiz answer keyed to a testimonial. BLOCKER (the hard rule). Scans the
 * KEYED choice + its explanation. Complements SC11.6 (which only blocks a v2 quiz
 * whose declared key-evidence anchor is a named_example) by catching the PROSE
 * form, on v1 and v2 alike.
 */
export function checkQuizKeyTestimonial(chapter: ChapterV21, sidecarOverride?: unknown): CriticFinding[] {
  const sidecar = sidecarOverride ?? (chapter.chapterId ? loadChapterSidecar(chapter.chapterId) : null);
  const realEntities = realEntityTokensFromSidecar(sidecar);
  const findings: CriticFinding[] = [];
  chapter.quiz?.questions?.forEach((q, i) => {
    const keyed = typeof q.correctIndex === "number" ? q.choices?.[q.correctIndex] ?? "" : "";
    const id = q.questionId ?? `index ${i}`;
    for (const [field, text] of [["keyed choice", keyed], ["explanation", q.explanation ?? ""]] as const) {
      const hits = findTestimonialEvidence(text, realEntities);
      if (hits.length > 0) {
        findings.push(
          finding(
            "EI2.quiz_key_testimonial" as any,
            "blocker",
            `quiz.questions[${i}] (${id}): the correct answer is keyed to a testimonial — its ${field} grounds the key in "${truncate(hits[0].subject, 60)}" (a first-name/initial-only account dressed as evidence). A quiz key must derive from a verifiable source fact, never a testimonial. Re-key to a source-grounded fact or rewrite the keyed claim.`,
            hits[0].sentence,
          ),
        );
        break; // one EI2 finding per question is enough to block + route the repair
      }
    }
  });
  return findings;
}
