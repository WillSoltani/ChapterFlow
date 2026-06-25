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
 * `server-only` / AWS imports (and of the badge UI's lucide-react chain — the
 * per-mode count comes from the dependency-free quiz-question-counts.ts, NOT
 * flow-points-economy.ts) so it can be unit-tested directly.
 *
 * See docs/audit-fixes/SET-1.md.
 */

import { QUIZ_QUESTION_COUNTS } from "@/app/book/_lib/quiz-question-counts";

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
 * Quiz question count per learning mode — resolved from the single
 * dependency-free source of truth (quiz-question-counts.ts), the SAME map the
 * client economy module re-exports as `QUIZ_QUESTION_COUNTS`. Imported from the
 * neutral module (not flow-points-economy.ts) so this seam stays free of the
 * badge UI's lucide-react chain and remains unit-testable under `tsx --test`.
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
 *
 * The number of questions a strict-package quiz attempt should contain for a
 * given (server-resolved) learning mode. Pure — safe to unit-test directly.
 */
export function quizQuestionCountForMode(mode: LearningMode): number {
  return QUIZ_QUESTION_COUNTS[mode];
}

/**
 * The strict-quiz question count for the first-visit "Fast short-path": a reader
 * who has NOT customized their learning profile starts on the shortest existing
 * quiz (5 questions), regardless of which mode their settings resolve to.
 *
 * This mirrors the client exactly: in ChapterReaderClient.tsx the quiz is sized
 * by `activeDepth = defaultToFastPath ? "simple" : modeToDepth(learningMode)`,
 * where `defaultToFastPath = bookPrefsHydrated && !extended.profileCustomized`
 * and "simple" depth maps to 5 questions (== the guided count). Picking any mode
 * in the reader/settings UI sets `profileCustomized: true`, which is what takes
 * a reader OFF this short-path and onto their mode's count. Pinned to the guided
 * count so the fast path and the guided mode stay one number.
 */
const FAST_PATH_QUIZ_QUESTION_COUNT = QUIZ_QUESTION_COUNTS.guided;

/**
 * Whether the reader has customized their learning profile, read from the same
 * server-stored settings item the routes already read `learningMode` from. The
 * client persists this under `settings.extended.profileCustomized` (the source
 * of truth) via the settings PATCH handler, so it is reliably readable here.
 * Absent / non-boolean / corrupt shapes → `false` (un-customized → fast path),
 * matching the client default (`profileCustomized: false`).
 */
function resolveProfileCustomized(
  settings: Record<string, unknown> | null | undefined,
): boolean {
  const extended = settings?.extended;
  if (!isRecord(extended)) return false;
  return extended.profileCustomized === true;
}

/**
 * The authoritative question count for a strict (v21/v12) quiz attempt, resolved
 * ENTIRELY from server-stored settings — never the request body. This is the
 * single seam the GET / /check / submit routes share so the question set (and
 * therefore the choiceId scheme) stays identical across all three.
 *
 * Two server-trusted inputs, no client-supplied `difficulty`:
 *   • un-customized reader (`profileCustomized` false / absent) → the Fast
 *     short-path's 5-question set, regardless of resolved mode. This preserves
 *     the default first-visit experience that on `main` was driven by the client
 *     sending `difficulty=simple`; moving it server-side keeps the UX while
 *     making it un-gameable per-request.
 *   • customized reader → `quizQuestionCountForMode(resolveLearningMode(...))`
 *     (guided→5, standard→7, challenge→10), exactly what the client's
 *     `modeToDepth` mapping yields once `profileCustomized` is true.
 *
 * SECURITY (A9): the count derives only from PERSISTED settings, so a reader can
 * no longer hand-pick the smallest set via a request param to clear a strict
 * quiz / farm Insight Points on the 5-question floor. A customized challenge
 * reader is sized at 10 and cannot shrink it; the 5-question fast path remains
 * exactly the count any honest un-customized reader already receives.
 */
export function resolveStrictQuizQuestionCount(
  settings: Record<string, unknown> | null | undefined,
): number {
  if (!resolveProfileCustomized(settings)) {
    return FAST_PATH_QUIZ_QUESTION_COUNT;
  }
  return quizQuestionCountForMode(resolveLearningMode(settings));
}
