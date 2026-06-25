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

/**
 * Quiz question count per learning mode — the SERVER-SIDE source of truth for
 * how many questions a strict (v21/v12) quiz attempt contains.
 *
 * Mirrors `QUIZ_QUESTION_COUNTS` in app/book/_lib/flow-points-economy.ts
 * (which can't be imported here — it pulls in lucide-react via the badge UI
 * chain — see learning-mode.test.ts for the pin that keeps the two in sync).
 *
 * SECURITY: this is intentionally keyed by the server-resolved learning mode,
 * NOT by a client-supplied `difficulty` query/body param. Previously the strict
 * path computed the count from `parseDifficulty(req.difficulty)`, which let a
 * reader hand-pick `difficulty=simple` (5 questions) to pass — and unlock the
 * next chapter / farm Insight Points — on the smallest possible set, regardless
 * of the mode they actually chose. Routing the count through the same
 * server-stored mode that already governs the pass threshold and the IP economy
 * closes that gaming vector. The client's reader maps the chosen mode to a
 * reading depth (guided→simple/5, standard→standard/7, challenge→deeper/10),
 * so the count a reader sees is unchanged for an honest request — only the
 * trust source moves from the request body to settings.
 */
const QUIZ_QUESTION_COUNT_BY_MODE: Record<LearningMode, number> = {
  guided: 5,
  standard: 7,
  challenge: 10,
};

/**
 * The number of questions a strict-package quiz attempt should contain for a
 * given (server-resolved) learning mode. Pure — safe to unit-test directly.
 */
export function quizQuestionCountForMode(mode: LearningMode): number {
  return QUIZ_QUESTION_COUNT_BY_MODE[mode];
}
