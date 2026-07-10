/**
 * Example-register critic (C31) — Findings 3/5/13 (CF-B, 2026-07-08). A chapter
 * whose example fields read as an ANALYST CARD grading the scene rather than a
 * scene narrated in its own voice: the field OPENS with a short evaluator
 * question it answers in the very next clause. HOM ch8 (Hybrid Organizations)
 * shipped eight such openers across four examples' whatToDo/whyItMatters — "What
 * changed? Separate expertise stopped passing as customer value.", "What nearly
 * failed? …", "Why does it work? …" — where ch7 of the same book uses imperative
 * "Skip this and…" openers and fires ZERO, proof the writer has a lived register
 * available. Root cause (triage): QUALITY BAR rule 7's old rubric-shaped wording
 * ("what MEASURABLY CHANGED … before→after") echoed straight into the prose, the
 * same disease the contract's label-prefix strip (authorRun.ts ~435) patched in
 * a different costume. CF-B rewrites rule 7's register; C31 is the orthogonal
 * DETERMINISTIC signal so the debt is structured + repair-routable, not only in
 * the reader's head.
 *
 * THE DISCRIMINATOR. A field trips ONLY when its text, at the very OPENING
 * position, is an interrogative of ≤8 words (a wh-/yes-no question) IMMEDIATELY
 * followed by a declarative answer. Three guards keep it narrow — the standing
 * lesson that lexical *gates* measured INVERTED (CHB14/15/17) is why this is
 * advisory and opening-position-only:
 *   (1) OPENING ONLY — a question mid-field, or a scene that merely contains a
 *       question, never trips it; the field must START with the question.
 *   (2) ANSWERED — the question must be followed by a non-question clause. A
 *       genuine rhetorical question left hanging (no answer, or answered by
 *       another question) is a legitimate move and is spared.
 *   (3) SHORT — ≤8 words. A long opening question is a real scene-setting beat,
 *       not the terse "What changed?" evaluator tic.
 *
 * CAP 6 → 8 (CF-J, 2026-07-09 — the measured undercount fix). The radical-candor
 * release review's direct read counted ~15 evaluator openers across ch02's six
 * examples; findEvaluatorOpeners reported 7. Diagnosis on the actual ch02 bytes:
 * the tic there runs to 7-8-word openers the ≤6 cap excluded — "What gets
 * protected when you wait for trust? The person's ability…" (8w), "What changes
 * after the minute is spent? …" (7w), "Which question proves you can receive
 * truth? …" (7w), "Which praise lets the person repeat the move? …" (8w),
 * "What would you ask before copying Sandberg's directness? …" (8w). Raising the
 * cap to 8 is the ONLY change the evidence justifies; the remaining reader-counted
 * openers are MID-FIELD question-then-answer turns, out of scope by design (guard
 * 1). Corpus sweep, chapters firing at cap 6 → cap 8 (per-chapter hit counts):
 *   gold start-with-why (14 ch)   2 → 2   (ch6 8→8, ch12 8→8 — unchanged)
 *   the-culture-code   (13 ch)    3 → 3   (ch4 9→11, ch10 10→10, ch16 10→10)
 *   HOM package        (16 ch)    3 → 3   (ch2 7→8, ch8 8→8, ch14 8→8)
 *   multipliers package (9 ch)    0 → 0
 *   radical-candor      (9 ch)    1 → 1   (ch2 7→12 — the undercount closed)
 * ZERO new chapters fire anywhere: the cap raise only deepens the count where the
 * tic already saturates. Threshold ≥3 fields per chapter is unchanged.
 * Threshold: ≥3 such fields in one chapter ⇒ ONE advisory finding. A single
 * evaluator opener is a stylistic choice; three across the slate is a template.
 *
 * SEVERITY: MINOR (advisory). Example voice is a semantic judgement that gates on
 * the example_coherence bar axis + the blinded reader; C31 surfaces the mechanical
 * floor and NEVER blocks (not in ENFORCED_MAJOR, not wired to any gate/contract/
 * acceptance predicate). Unlike C26/C29 this is NOT zero-FP on the gold corpus:
 * the evaluator-opener tic leaked into start-with-why too (ch6/ch12 fire), so the
 * pin test asserts the MEASURED count, not zero. See tests/example-register.test.ts.
 */

import { ChapterV21, CriticFinding } from "../types.js";
import { finding, pickEvidence, truncate } from "./shared.js";

// A field opener reads as an evaluator question when it starts with a wh-word or a
// yes/no auxiliary. Auxiliaries add no corpus noise (measured: zero chapters fire
// on auxiliaries alone across the shipped catalog) but cover "Does it work? Yes."
const INTERROGATIVE_OPENER =
  /^(what|why|where|when|who|whom|whose|which|how|is|are|was|were|do|does|did|can|could|should|would|will|have|has|had|am|must|may|might|shall)\b/i;
// A terse evaluator question ("What changed?") vs a real scene-setting question.
// 6 → 8 per the CF-J undercount fix (see the header justification table).
const MAX_OPENER_WORDS = 8;
// The reader-facing example fields C31 reads. A field is one of these strings.
const FIELDS = ["scenario", "whatToDo", "whyItMatters"] as const;
// One evaluator opener is a stylistic choice; three across the slate is a template.
const MIN_EVALUATOR_FIELDS = 3;

/** The leading question span (up to and including the first "?"), or null when the
 *  text does not OPEN on a question. Pure. */
function leadingQuestion(text: string): string | null {
  if (typeof text !== "string") return null;
  const t = text.trim();
  const m = t.match(/^([^?]*\?)/);
  return m ? m[1].trim() : null;
}

/**
 * Pure detector: does this field OPEN with a short evaluator question answered in
 * the next clause? (text → boolean) — exhaustively unit-testable.
 */
export function opensWithAnsweredQuestion(text: string): boolean {
  const opener = leadingQuestion(text);
  if (opener === null) return false;
  if (!INTERROGATIVE_OPENER.test(opener)) return false;
  const words = opener.replace(/\?+$/, "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > MAX_OPENER_WORDS) return false;
  // What follows the question must be a DECLARATIVE answer — a hanging rhetorical
  // question (nothing after, or answered by another question) is a legitimate move.
  const rest = (text as string).trim().slice(opener.length).trim();
  if (rest.length === 0) return false;
  const firstAnswerSentence = (rest.match(/^[^.?!]*[.?!]?/) ?? [rest])[0].trim();
  if (firstAnswerSentence.endsWith("?")) return false;
  return true;
}

export type EvaluatorOpenerHit = { exampleId: string; field: string; opener: string };

/** Every example field that opens on an answered evaluator question. Deterministic;
 *  no disk. Exported for direct calibration. */
export function findEvaluatorOpeners(chapter: ChapterV21): EvaluatorOpenerHit[] {
  const hits: EvaluatorOpenerHit[] = [];
  (chapter.examples ?? []).forEach((ex: any, i) => {
    for (const field of FIELDS) {
      const text = pickEvidence(ex?.[field]);
      if (opensWithAnsweredQuestion(text)) {
        hits.push({
          exampleId: ex?.exampleId ?? `example[${i}]`,
          field,
          opener: leadingQuestion(text) ?? "",
        });
      }
    }
  });
  return hits;
}

/**
 * C31 — one advisory when ≥3 example fields open on an answered evaluator question.
 * MINOR; never blocks.
 */
export function checkExampleRegister(chapter: ChapterV21): CriticFinding[] {
  const hits = findEvaluatorOpeners(chapter);
  if (hits.length < MIN_EVALUATOR_FIELDS) return [];
  const listed = hits
    .slice(0, 4)
    .map((h) => `${h.exampleId}.${h.field} ("${h.opener}")`)
    .join("; ");
  return [
    finding(
      "C31.example_evaluator_register" as any,
      "minor",
      `${hits.length} example field(s) open with a short evaluator question answered in the next clause: ${listed}. This is analyst-card register — the field GRADES the scene ("What changed? …") instead of narrating it. Rewrite each to SHOW the consequence happening in the scene's own voice (a decision landing, someone gaining/losing/paying), not a Q&A about it.`,
      truncate(hits[0].opener, 120),
    ),
  ];
}
