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
 * The document ends with an ANSWER KEY section on purpose: the reader is
 * instructed to derive their own quiz answers from the prose FIRST and only
 * then compare against the key (key-soundness checking).
 */

import type { ChapterV21 } from "../types.js";

/** Render a ChapterV21 JSON as a reader-facing document. */
export function renderChapterReaderDoc(ch: ChapterV21): string {
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
    L.push('   Explanation: ' + q.explanation, "");
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
  L.push("", "## ANSWER KEY (for key-soundness checking — derive your own answers from the prose FIRST)");
  (ch.quiz?.questions ?? []).forEach((q, i) => L.push('Q' + (i + 1) + ': ' + ("abc"[q.correctIndex] ?? "?")));
  return L.join("\n");
}
