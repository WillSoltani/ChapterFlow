/**
 * chapterText — extract the reader-visible prose of an assembled ChapterV21.
 *
 * WHY THIS EXISTS
 * ---------------
 * P01's rubricMetrics library measures TEXT, but nothing said which text of an
 * assembled chapter to hand it. score.py (the post-publish scorer) samples a
 * few chapters and measures only two prose slices per chapter (breakdown-only
 * for readability/nominalization, breakdown+example-scenarios for house tics).
 * P04 additionally measures the WHOLE assembled reader experience — the thing a
 * reader actually reads — which score.py never looks at. `readerVisibleText`
 * is that whole-chapter concatenation.
 *
 * The field set is ENUMERATED EXPLICITLY from ChapterV21 (no reflection/no
 * Object.keys walk) so that a rename or removal of a reader-facing field is a
 * TypeScript compile error here, not a silent drop in the measured surface.
 * The set mirrors the reader-facing fields lib/readerContent.ts ships to the
 * app (authoring/provenance payloads are deliberately excluded). `title` and
 * `counterintuition` are intentionally OUT of scope per the P04 spec's explicit
 * field list; if the rubric ever wants them, add them here and to the coverage
 * test together.
 */

import type { ChapterV21 } from "../types.js";

export type ReaderVisibleText = {
  /** Every reader-visible field, keyed by a stable dotted/indexed path. */
  byField: Record<string, string>;
  /** All reader-visible fields joined with blank lines — the whole-chapter
   *  aggregate the rubric measures for the whole-chapter readability signal. */
  all: string;
};

/** Concatenate exactly the reader-facing prose of an assembled ChapterV21.
 *  Non-string/absent values contribute nothing (an absent optional field is
 *  simply not keyed). Fields are enumerated by name so schema drift breaks the
 *  build rather than silently shrinking the measured text. */
export function readerVisibleText(chapter: ChapterV21): ReaderVisibleText {
  const byField: Record<string, string> = {};
  const put = (key: string, value: string | undefined): void => {
    if (typeof value === "string" && value.length > 0) byField[key] = value;
  };

  put("hook", chapter.hook);
  put("keyTakeaway", chapter.keyTakeaway);
  put("tryThisNow", chapter.tryThisNow);

  put("breakdown.fastRead", chapter.breakdown?.fastRead);
  put("breakdown.deepRead", chapter.breakdown?.deepRead);
  put("breakdown.fullRead", chapter.breakdown?.fullRead);

  (chapter.examples ?? []).forEach((ex, i) => {
    put(`examples[${i}].title`, ex.title);
    put(`examples[${i}].scenario`, ex.scenario);
    put(`examples[${i}].whatToDo`, ex.whatToDo);
    put(`examples[${i}].whyItMatters`, ex.whyItMatters);
  });

  (chapter.quiz?.questions ?? []).forEach((q, i) => {
    put(`quiz.questions[${i}].prompt`, q.prompt);
    (q.choices ?? []).forEach((choice, ci) => put(`quiz.questions[${i}].choices[${ci}]`, choice));
    put(`quiz.questions[${i}].explanation`, q.explanation);
  });

  (chapter.reviewCards ?? []).forEach((card, i) => {
    put(`reviewCards[${i}].front`, card.front);
    put(`reviewCards[${i}].back`, card.back);
  });

  const plan = chapter.implementationPlan;
  if (plan) {
    put("implementationPlan.title", plan.title);
    put("implementationPlan.coreSkill", plan.coreSkill);
    (plan.ifThenPlans ?? []).forEach((it, i) => {
      put(`implementationPlan.ifThenPlans[${i}].context`, it.context);
      put(`implementationPlan.ifThenPlans[${i}].plan`, it.plan);
    });
    put("implementationPlan.twentyFourHourChallenge", plan.twentyFourHourChallenge);
    put("implementationPlan.weeklyPractice", plan.weeklyPractice);
  }

  (chapter.memorableLines ?? []).forEach((line, i) => put(`memorableLines[${i}].text`, line.text));

  return { byField, all: Object.values(byField).join("\n\n") };
}

/** score.py `breakdown_prose(c)` — fastRead + deepRead + fullRead joined with
 *  blank lines. This is the EXACT prose score.py measures readability,
 *  three-plus-syllable %, sentence rhythm, and nominalization over, so the
 *  breakdown-only rubric metrics have formula AND input parity with the scorer. */
export function breakdownProse(chapter: ChapterV21): string {
  const b = chapter.breakdown;
  return [b?.fastRead, b?.deepRead, b?.fullRead].filter((p): p is string => typeof p === "string" && p.length > 0).join("\n\n");
}

/** score.py `chapter_prose(c)` — breakdown prose plus every example scenario,
 *  joined with blank lines. This is the EXACT prose score.py measures house-tic
 *  density over. */
export function chapterProse(chapter: ChapterV21): string {
  const parts = [breakdownProse(chapter), ...(chapter.examples ?? []).map((ex) => (typeof ex.scenario === "string" ? ex.scenario : ""))];
  return parts.filter((p) => p.length > 0).join("\n\n");
}
