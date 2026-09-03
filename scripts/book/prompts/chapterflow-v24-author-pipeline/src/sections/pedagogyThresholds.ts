/**
 * pedagogyThresholds — the per-chapter budgets that align the learning-pack and
 * summary-pack section gates with the rubric's deterministic pedagogy metrics
 * (score.py-parity, via src/metrics/rubricMetrics.ts). Single source of truth so
 * the gate (sectionGate.ts), the calibration script (scratch/calibrate-pedagogy.ts),
 * and the tests (tests/pedagogy-thresholds.test.ts) all measure against ONE ruler.
 *
 * CALIBRATION (P03, F12) — chosen so every >=85-composite tracked package passes
 * with zero blockers while POM (rank 95/98, 72% book-wide tell) trips the tell
 * budget. See scratch/calibrate-pedagogy.ts for the table and the zero-FP proof.
 *
 * The rubric goals these budgets approximate:
 *   - distractor tell < 20% book-wide (RUBRIC §3; baseline 68%)
 *   - transfer > 70% of questions test a NEW scenario (RUBRIC §3)
 *   - >= 2 clean (<=14-word) memorable lines per chapter (RUBRIC §2)
 */

/**
 * Distractor-tell budget (R-070, package 1B): the maximum SHARE of a chapter's
 * questions whose keyed answer is the uniquely-longest choice by character count
 * (rubricMetrics.distractorTell). Above it, SEC116 blocks.
 *
 * WHY IT IS A RATE AND WHY IT IS 20. This file already states the rubric goal as
 * "distractor tell < 20% book-wide (RUBRIC §3)" and the previous budget — at most 2
 * per chapter — conceded in its own comment that "2/9 tells = 22% — just above" that
 * goal, then shipped ADVISORY so nothing enforced either number. Measured on the live
 * Franklin rev-6 candidate the four chapters run 2/9, 1/9, 2/9 and 3/9 = 22.2%
 * book-wide, and only ch04 tripped the advisory; the blind six-reader panel scored
 * that book's quizzes 63. The budget is now the rubric's own number, applied per
 * chapter (the gate never sees the whole book at once, and a per-chapter bound at the
 * book-wide goal implies the book-wide goal).
 *
 * WHAT THIS STOPS BLOCKING: nothing. The old check was advisory-only; the SEC121
 * majority blocker is untouched and still fires on its own condition.
 * WHAT IT NOW CATCHES: the 22%-and-drifting chapter the shadow advisory reported and
 * nobody acted on.
 *
 * (score.py ships no hedge lexicon, so the tell rule is uniquely-longest-by-chars
 * only; SEC134 carries the hedge/qualifier shape as its own advisory.)
 */
export const QUIZ_TELL_MAX_RATE_PCT = 20;

/**
 * Transfer floor: a chapter with FEWER than this many transfer questions is a
 * blocker. Scaled from the "6 of 9" floor so chapters with 10 questions are held to
 * the same proportion.
 *
 * R-069: the gate counts a question as transfer ONLY when its own stem carries a
 * scenario cue (rubricMetrics.isTransferQuestion). It used to accept
 * `bloomsLevel ∈ {apply,…}` as an alternative, which made a metadata STRING satisfy a
 * pedagogy floor: all 36 questions of the live rev-6 book qualified, 23 of them on
 * the label alone with no cue in the stem at all. score.py's own transfer_ratio is
 * unchanged (it is the catalog's ruler and must stay comparable across books); this
 * gate is deliberately the stricter of the two, and SEC125 reports the gap.
 */
export function quizTransferFloor(questionCount: number): number {
  return Math.floor((6 / 9) * questionCount);
}

/**
 * Transfer target: at or above the floor but below this many transfer questions
 * is an ADVISORY (the rubric wants >70%; "7 of 9" ≈ 78%). Scaled the same way.
 */
export function quizTransferTarget(questionCount: number): number {
  return Math.floor((7 / 9) * questionCount);
}

/**
 * Summary memorable-lines floor: a breakdown must yield at least this many clean
 * (<=14-word) memorable-line candidates (harvested like optimizers/memorableLines.ts,
 * judged with rubricMetrics.memorableLineClean). Fewer is a blocker.
 */
export const SUMMARY_MIN_CLEAN_MEMORABLE_LINES = 2;
