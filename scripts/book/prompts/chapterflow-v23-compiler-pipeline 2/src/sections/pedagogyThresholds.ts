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
 * Distractor-tell budget: the max number of questions per chapter whose keyed
 * answer is the uniquely-longest choice by character count (rubricMetrics.distractorTell).
 * A chapter with MORE than this is a blocker. At 9 questions, 2/9 tells = 22% —
 * just above the rubric's <20% book-wide goal, and the tightest bound that leaves
 * every published >=85 book clean. (score.py ships no hedge lexicon, so the tell
 * rule is uniquely-longest-by-chars only; the contract still steers hedges into
 * distractors as writer guidance.)
 */
export const QUIZ_TELL_MAX_PER_CHAPTER = 2;

/**
 * Transfer floor: a chapter with FEWER than this many transfer questions
 * (rubricMetrics: bloomsLevel∈{apply,analyze,analyse,evaluate,create} OR a
 * scenario cue in the prompt) is a blocker. Scaled from the "6 of 9" floor so
 * chapters with 10 questions are held to the same proportion.
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
