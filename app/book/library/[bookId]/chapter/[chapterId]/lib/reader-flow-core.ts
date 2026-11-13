import { resolveLearningMode } from "@/app/app/api/book/_lib/learning-mode";
import type { ReadingDepth } from "@/app/book/data/bookChapters";
import type { LearningMode } from "@/app/book/settings/types/settings";
import type { ChapterTab } from "@/lib/reader-state-types";

const PHASE_ORDER: readonly ChapterTab[] = ["summary", "examples", "quiz", "practice"];

const PHASE_WEIGHTS: Readonly<Record<ChapterTab, number>> = {
  summary: 33,
  examples: 66,
  quiz: 100,
  practice: 100,
};

export function mapLearningStyleToDepth(value: string): ReadingDepth {
  if (value === "concise") return "simple";
  if (value === "deep") return "deeper";
  return "standard";
}

export function modeToDepth(mode: LearningMode): ReadingDepth {
  if (mode === "guided") return "simple";
  if (mode === "challenge") return "deeper";
  return "standard";
}

/** The depth a reader first sees, from their stored settings: Lite until they
 *  customize their reading profile, then the depth of their learning mode. The
 *  chapter page resolves it on the server so the first paint already matches. */
export function initialReaderDepth(
  settings: Record<string, unknown> | null | undefined,
): ReadingDepth {
  const extended = settings?.extended;
  const customized =
    typeof extended === "object" &&
    extended !== null &&
    (extended as { profileCustomized?: unknown }).profileCustomized === true;
  return customized ? modeToDepth(resolveLearningMode(settings)) : "simple";
}

/** The depth names Settings uses (Reading profiles), shown wherever the
 *  reader names a depth or learning mode. */
export const DEPTH_LABELS: Readonly<Record<ReadingDepth, string>> = {
  simple: "Lite",
  standard: "Standard",
  deeper: "Deeper",
};

/** True when a tap on `mode` in Reading settings changes nothing. On the fast
 *  path (profile not customized) the reader gets Lite whatever the stored mode
 *  says, so every tap, even on the stored mode, is a real choice to save. */
export function learningModeTapIsNoop(
  mode: LearningMode,
  learningMode: LearningMode,
  defaultToFastPath: boolean,
): boolean {
  return mode === learningMode && !defaultToFastPath;
}

export function computeProgressPercent(
  activeTab: ChapterTab,
  completedPhases: ReadonlySet<ChapterTab>,
): number {
  if (completedPhases.has(activeTab)) return PHASE_WEIGHTS[activeTab];
  const currentIndex = PHASE_ORDER.indexOf(activeTab);
  const prevTab = currentIndex > 0 ? PHASE_ORDER[currentIndex - 1] : undefined;
  const previousWeight = prevTab !== undefined ? PHASE_WEIGHTS[prevTab] : 0;
  return previousWeight + Math.round((PHASE_WEIGHTS[activeTab] - previousWeight) * 0.5);
}

export type PhaseTransitionDecision =
  | { kind: "blocked"; completeCurrent: false }
  | { kind: "direct"; completeCurrent: boolean }
  | { kind: "forward-interstitial"; completeCurrent: true };

export function decidePhaseTransition({
  current,
  target,
  targetAccessible,
  skipInterstitial,
}: {
  current: ChapterTab;
  target: ChapterTab;
  targetAccessible: boolean;
  skipInterstitial: boolean;
}): PhaseTransitionDecision {
  const currentIndex = PHASE_ORDER.indexOf(current);
  const targetIndex = PHASE_ORDER.indexOf(target);
  if (targetIndex > currentIndex) {
    return skipInterstitial
      ? { kind: "direct", completeCurrent: true }
      : { kind: "forward-interstitial", completeCurrent: true };
  }
  if (!targetAccessible) return { kind: "blocked", completeCurrent: false };
  return { kind: "direct", completeCurrent: false };
}

export function requiredScenarioInteractions(
  learningMode: LearningMode,
  totalScenarios: number,
): number {
  return learningMode === "challenge" ? Math.max(0, totalScenarios) : 0;
}

export function buildNextChapterRoute(
  bookId: string,
  chapterId: string,
  sessionMode: boolean,
): string {
  const route = `/book/library/${encodeURIComponent(bookId)}/chapter/${encodeURIComponent(chapterId)}`;
  return sessionMode ? `${route}?session=1` : route;
}

type NeighbourLink = { order: number; title: string; href: string; locked: boolean };

/** Previous / next chapter for the step menu and the pager. Only the next
 *  chapter can be locked (it opens once this chapter's quiz is passed). */
export function buildChapterNeighbours({
  bookId,
  chapters,
  chapterId,
  sessionMode,
  getChapterState,
}: {
  bookId: string;
  chapters: ReadonlyArray<{ id: string; order: number; title: string }>;
  chapterId: string;
  sessionMode: boolean;
  getChapterState: (chapterId: string) => string;
}): { prev: NeighbourLink | null; next: NeighbourLink | null } {
  const index = chapters.findIndex((item) => item.id === chapterId);
  if (index < 0) return { prev: null, next: null };
  const prev = index > 0 ? chapters[index - 1] : undefined;
  const next = chapters[index + 1];
  return {
    prev: prev
      ? {
          order: prev.order,
          title: prev.title,
          href: buildNextChapterRoute(bookId, prev.id, sessionMode),
          locked: false,
        }
      : null,
    next: next
      ? {
          order: next.order,
          title: next.title,
          href: buildNextChapterRoute(bookId, next.id, sessionMode),
          locked: getChapterState(next.id) === "locked",
        }
      : null,
  };
}

/** The top bar's hairline on the quiz step: answered / total, 1 once graded;
 *  null (follow the page scroll) on the other steps or before a session. */
export function quizStepProgress(
  activeTab: ChapterTab,
  session: { questions: ReadonlyArray<{ questionId: string }>; result?: unknown } | null | undefined,
  answers: Readonly<Record<string, unknown>>,
): number | null {
  if (activeTab !== "quiz" || !session) return null;
  if (session.result) return 1;
  const answered = session.questions.filter((question) => Boolean(answers[question.questionId]));
  return answered.length / Math.max(1, session.questions.length);
}

export function buildReauthReturnTo(pathname: string, search: string): string {
  return `${pathname}${search ? `?${search}` : ""}`;
}
