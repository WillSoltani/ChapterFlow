// Single source of truth for the per-learning-mode quiz question count (WS3-001).
//
// This module is intentionally DEPENDENCY-FREE (no React, no lucide-react, no
// AWS, no `server-only`) so BOTH surfaces can import it directly:
//   • the client economy module (app/book/_lib/flow-points-economy.ts) re-exports
//     it as `QUIZ_QUESTION_COUNTS`;
//   • the server learning-mode seam (app/app/api/book/_lib/learning-mode.ts)
//     imports it for `quizQuestionCountForMode`, and that seam must stay unit-
//     testable under `tsx --test` — importing flow-points-economy there would
//     pull lucide-react in via the badge UI chain and break the test import.
//
// Keeping the numbers here (and not duplicated in both places) means the GET /
// /check / submit routes, the IP economy, and the server-trusted question-count
// gate can never silently diverge — a divergence would mis-size the strict quiz
// (different question set ⇒ different choiceId scheme ⇒ mis-grade).

export type QuizLearningMode = "guided" | "standard" | "challenge";

/** Number of quiz questions shown per learning mode. */
export const QUIZ_QUESTION_COUNTS: Record<QuizLearningMode, number> = {
  guided: 5,
  standard: 7,
  challenge: 10,
};
