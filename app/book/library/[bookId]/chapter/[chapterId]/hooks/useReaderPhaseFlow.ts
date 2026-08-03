"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { useRouter } from "next/navigation";
import type { BookChapter } from "@/app/book/data/bookChapters";
import { trackReaderFunnel } from "@/app/book/_lib/reader-analytics";
import type { LearningMode } from "@/app/book/settings/types/settings";
import type { ChapterTab } from "@/lib/reader-state-types";
import {
  buildNextChapterRoute,
  computeProgressPercent,
  decidePhaseTransition,
  requiredScenarioInteractions,
} from "../lib/reader-flow-core";
import { usePhaseCompletion } from "./usePhaseCompletion";

type ProgressChapter = { id: string; order: number; title: string };

export function useReaderPhaseFlow({
  bookId,
  chapterId,
  chapter,
  chapters,
  activeTab,
  setActiveTabRaw,
  learningMode,
  contentRef,
  scenarioInteractions,
  totalScenarios,
  enabled,
  focusReady,
  quizPassed,
  sessionMode,
}: {
  bookId: string;
  chapterId: string;
  chapter?: BookChapter | undefined;
  chapters: ProgressChapter[];
  activeTab: ChapterTab;
  setActiveTabRaw: (tab: ChapterTab) => void;
  learningMode: LearningMode;
  contentRef: RefObject<HTMLDivElement | null>;
  scenarioInteractions: number;
  totalScenarios: number;
  enabled: boolean;
  focusReady: boolean;
  quizPassed: boolean;
  sessionMode: boolean;
}) {
  const router = useRouter();
  const [interstitial, setInterstitial] = useState<{ from: ChapterTab; to: ChapterTab } | null>(null);
  const readerOpenedAtRef = useRef<number | null>(null);
  const firstActionFiredRef = useRef(false);
  const commitmentReachedFiredRef = useRef(false);
  const phaseCompletion = usePhaseCompletion({
    bookId,
    chapterId,
    activePhase: activeTab,
    learningMode,
    contentRef,
    scenarioInteractions,
    totalScenarios: requiredScenarioInteractions(learningMode, totalScenarios),
    enabled,
    quizPassed,
  });

  const setActiveTab = useCallback(
    (newTab: ChapterTab, options?: { skipInterstitial?: boolean }) => {
      if (!enabled) return;
      const decision = decidePhaseTransition({
        current: activeTab,
        target: newTab,
        targetAccessible: phaseCompletion.isPhaseAccessible(newTab),
        skipInterstitial: options?.skipInterstitial === true,
      });
      if (decision.kind === "blocked") return;
      if (decision.completeCurrent) {
        if (!firstActionFiredRef.current && readerOpenedAtRef.current !== null) {
          firstActionFiredRef.current = true;
          trackReaderFunnel("time_to_first_action", {
            bookId,
            chapterNumber: chapter?.order,
            msToFirstAction: Date.now() - readerOpenedAtRef.current,
          });
        }
        phaseCompletion.markPhaseCompleted(activeTab);
      }
      if (decision.kind === "forward-interstitial") {
        setInterstitial({ from: activeTab, to: newTab });
        return;
      }
      setActiveTabRaw(newTab);
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    },
    [activeTab, bookId, chapter?.order, enabled, phaseCompletion, setActiveTabRaw],
  );

  useEffect(() => {
    if (activeTab === "practice") setActiveTabRaw("quiz");
  }, [activeTab, setActiveTabRaw]);

  useEffect(() => {
    if (activeTab !== "practice") return;
    const index = chapters.findIndex((item) => item.id === chapterId);
    const next = index >= 0 ? chapters[index + 1] : undefined;
    if (!next) return;
    router.prefetch(buildNextChapterRoute(bookId, next.id, false));
    if (sessionMode) router.prefetch(buildNextChapterRoute(bookId, next.id, true));
  }, [activeTab, bookId, chapterId, chapters, router, sessionMode]);

  useEffect(() => {
    if (!focusReady) return;
    const heading = contentRef.current?.querySelector<HTMLElement>("[data-phase-heading], h2, h1");
    if (!heading) return;
    heading.setAttribute("tabindex", "-1");
    heading.focus({ preventScroll: true });
  }, [activeTab, contentRef, focusReady]);

  const handleInterstitialComplete = useCallback(() => {
    if (!interstitial) return;
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    setActiveTabRaw(interstitial.to);
    setInterstitial(null);
  }, [interstitial, setActiveTabRaw]);

  useEffect(() => {
    if (chapter && readerOpenedAtRef.current === null) readerOpenedAtRef.current = Date.now();
  }, [chapter]);

  useEffect(() => {
    if (
      activeTab === "examples" &&
      chapter?.implementationPlan?.ifThenPlans?.length &&
      !commitmentReachedFiredRef.current
    ) {
      commitmentReachedFiredRef.current = true;
      trackReaderFunnel("commitment_reached", { bookId, chapterNumber: chapter.order });
    }
  }, [activeTab, bookId, chapter]);

  return {
    phaseCompletion,
    setActiveTab,
    interstitial,
    handleInterstitialComplete,
    progressPercent: computeProgressPercent(activeTab, phaseCompletion.completedPhases),
  };
}
