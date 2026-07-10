/**
 * renderReaderDoc — render a ChapterV21 JSON as a single reader-facing text
 * document for the v24 blinded reader-review instrument (component A1).
 *
 * IMPORTANT: this is a FAITHFUL port of the validated live-panel renderer.
 * Reader reviews quote VERBATIM substrings of this document and those quotes
 * are byte-verified against it (adjudicateReview), so the exact output —
 * headers, prefixes, spacing, blank-line rhythm — is a compatibility surface.
 * Do not "clean up" the formatting; a one-character drift invalidates the
 * byte-verification contract the instrument was calibrated on.
 *
 * The LEGACY document ends with an ANSWER KEY section: the reader was
 * instructed to derive their own quiz answers from the prose FIRST and only
 * then compare against the key (an instruction-based blind).
 *
 * DELIBERATE FORMAT CHANGE (2026-07-03, instrument hardening — NOT cleanup):
 * per-question explanations moved from under the choices into the ANSWER KEY
 * rows. An execution ch01 reviewer caught that an explanation printed below
 * the choices discloses the intended key BEFORE the key section, defeating
 * derive-first. Review carry-forward binds docHash, so no pre-change review
 * can be reused across this change.
 *
 * IMP-08 (F-015): the blind is now TECHNICAL. renderChapterReaderDocPhase1
 * renders the same body WITHOUT the key section; direct readers derive in a
 * role workspace that physically lacks the key, and only the phase-2
 * adjudicator (quizDerivation.renderQuizPhase2Doc) ever sees key +
 * explanations — bundled with the already-committed derivation. The legacy
 * combined renderer is retained for the key-judge blinding slice and the
 * book-sample body build; review carry binds docHash (now over the phase-1
 * bytes, hashVersion v3), so no pre-split review can be reused either.
 */

import type { ChapterV21 } from "../types.js";

/** Phase-1 renderer version (IMP-08). Stamped on reviews produced from the
 *  phase-1 document so a renderer evolution is an EXPLICIT instrument change,
 *  never a silent one (the docHash it feeds re-stales carries anyway). */
export const READER_DOC_PHASE1_VERSION = "phase1-v1" as const;

/** The shared reader-facing body: title through memorable lines, quiz prompts +
 *  choices included, NO answer key and NO explanations. Exactly the legacy
 *  renderer's lines above its ANSWER KEY section — reader quotes are interior
 *  substrings of this body, so byte-verification carries over unchanged. */
function renderReaderBodyLines(ch: ChapterV21): string[] {
  const L: string[] = [];
  const p = (s?: string): void => { if (s) L.push(s, ""); };
  L.push('# ' + ch.title, "");
  L.push("## Hook"); p(ch.hook);
  L.push("## Fast read"); p(ch.breakdown?.fastRead);
  L.push("## Deep read"); p(ch.breakdown?.deepRead);
  L.push("## Full read"); p(ch.breakdown?.fullRead);
  L.push("## Key takeaway"); p(ch.keyTakeaway);
  L.push("## Try this now"); p(ch.tryThisNow);
  L.push("## Examples");
  (ch.examples ?? []).forEach((e, i) => {
    L.push('### Example ' + (i + 1) + ': ' + e.title);
    p(e.scenario); L.push('What to do: ' + e.whatToDo, ""); L.push('Why it matters: ' + e.whyItMatters, "");
  });
  L.push("## Quiz");
  (ch.quiz?.questions ?? []).forEach((q, i) => {
    L.push('Q' + (i + 1) + '. ' + q.prompt);
    (q.choices ?? []).forEach((c, ci) => L.push('   ' + "abc"[ci] + ') ' + c));
    L.push("");
  });
  L.push("## Review cards");
  (ch.reviewCards ?? []).forEach((c, i) => L.push('Card ' + (i + 1) + ' — Front: ' + c.front, '          Back: ' + c.back, ""));
  const plan = ch.implementationPlan;
  if (plan) {
    L.push("## Implementation plan", 'Title: ' + plan.title, 'Core skill: ' + plan.coreSkill);
    (plan.ifThenPlans ?? []).forEach((it, i) => L.push('If-then ' + (i + 1) + ': [' + it.context + '] ' + it.plan));
    L.push('24-hour challenge: ' + plan.twentyFourHourChallenge, 'Weekly practice: ' + plan.weeklyPractice, "");
  }
  L.push("## Memorable lines");
  (ch.memorableLines ?? []).forEach((m) => L.push('- ' + m.text));
  return L;
}

/** Render a ChapterV21 JSON as a reader-facing document (LEGACY, key-bearing).
 *  Retained for the surfaces that still consume the combined shape — the
 *  key-judge blinding slice (authorEvidence.renderBlindedChapterDoc), the
 *  book-sample body build, and pre-IMP-08 forensics. New review lanes use
 *  renderChapterReaderDocPhase1 (below); no reviewer workspace ever hosts
 *  THIS renderer's output for a key-blind role. */
export function renderChapterReaderDoc(ch: ChapterV21): string {
  const L = renderReaderBodyLines(ch);
  L.push("", "## ANSWER KEY (for key-soundness checking — derive your own answers from the prose FIRST)");
  (ch.quiz?.questions ?? []).forEach((q, i) =>
    L.push('Q' + (i + 1) + ': ' + ("abc"[q.correctIndex] ?? "?") + (q.explanation ? ' — ' + q.explanation : '')));
  return L.join("\n");
}

/** IMP-08 phase-1 document: reader-facing prose + quiz prompts/choices ONLY.
 *  No answer key, no explanations (the legacy renderer already keeps
 *  explanations exclusively in its key rows, so the body carries none), no
 *  hidden metadata. This is the ONLY chapter document a direct reader / quiz
 *  deriver / tiebreak reader ever receives; the information barrier is the
 *  document itself plus the role workspace, not an instruction. */
export function renderChapterReaderDocPhase1(ch: ChapterV21): string {
  return renderReaderBodyLines(ch).join("\n");
}
