/**
 * SET-1 — learning-mode resolution (single source of truth).
 *
 * Learning mode (guided / standard / challenge) is the per-reader difficulty
 * lever. Server-side it drives:
 *   • the Insight-Point economy — CHAPTER_FP (quiz pass) + LOOP_COMPLETE_IP
 *     (loop complete), both keyed by mode;
 *   • for non-strict books, the quiz question count (QUIZ_QUESTION_COUNTS) and
 *     the pass threshold (QUIZ_PASS_THRESHOLDS);
 *   • the audio narration context (ctx-guided / ctx-challenge).
 *
 * Storage: the reader + settings UI persist the chosen mode under
 * `settings.extended.learningMode` (the client's source of truth). The settings
 * PATCH handler mirrors that to canonical top-level `settings.learningMode` on
 * every save, and `resolveLearningMode()` below falls back to
 * `settings.extended.learningMode` for users whose mode was only ever written
 * under `extended` before the mirror existed — so stored data self-heals with
 * no batch migration.
 *
 * Every server read MUST resolve through `resolveLearningMode` so the question
 * set — and therefore the choiceId scheme — stays identical across the quiz GET,
 * /check and submit routes; a divergence there silently mis-grades. Kept free of
 * `server-only` / AWS imports so it can be unit-tested directly.
 *
 * See docs/audit-fixes/SET-1.md.
 */

export type LearningMode = "guided" | "standard" | "challenge";

export const DEFAULT_LEARNING_MODE: LearningMode = "standard";

export function isValidLearningMode(value: unknown): value is LearningMode {
  return value === "guided" || value === "standard" || value === "challenge";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Resolve the effective learning mode from a stored settings object, preferring
 * the canonical top-level `learningMode` and falling back to the legacy
 * `extended.learningMode`. Anything unknown / absent → DEFAULT_LEARNING_MODE.
 */
export function resolveLearningMode(
  settings: Record<string, unknown> | null | undefined,
): LearningMode {
  const topLevel = settings?.learningMode;
  if (isValidLearningMode(topLevel)) return topLevel;

  const extended = settings?.extended;
  const extendedMode = isRecord(extended) ? extended.learningMode : undefined;
  if (isValidLearningMode(extendedMode)) return extendedMode;

  return DEFAULT_LEARNING_MODE;
}
