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

export function buildReauthReturnTo(pathname: string, search: string): string {
  return `${pathname}${search ? `?${search}` : ""}`;
}
