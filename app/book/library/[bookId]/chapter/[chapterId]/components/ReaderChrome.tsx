"use client";

import type { ReactNode, RefObject } from "react";
import dynamic from "next/dynamic";
import { CloudOff, Lightbulb, X } from "lucide-react";
import type { BookChapter, ReadingDepth } from "@/app/book/data/bookChapters";
import type { LibraryBookDetail } from "@/app/book/_lib/library-data";
import type { LearningMode } from "@/app/book/settings/types/settings";
import type { useReaderAccess } from "../hooks/useReaderAccess";
import type { useReaderPhaseFlow } from "../hooks/useReaderPhaseFlow";
import type { useReaderProgress } from "../hooks/useReaderProgress";
import type { useReaderSettings } from "../hooks/useReaderSettings";
import { getPhaseThresholds } from "../hooks/usePhaseCompletion";
import { AutoCollapsingHookBanner } from "./HookBanner";
import { ChapterBackgroundOrbs } from "./ChapterBackgroundOrbs";
import { ChapterHeader } from "./ChapterHeader";
import { PhaseStepper } from "./PhaseStepper";

const LazyAudioPlayer = dynamic(
  () => import("./AudioPlayer").then((module) => module.AudioPlayer),
  {
    loading: () => (
      <span className="sr-only" role="status">
        Loading audio controls…
      </span>
    ),
  },
);

type Props = {
  bookId: string;
  initialBook?: LibraryBookDetail | undefined;
  chapter: BookChapter;
  activeDepth: ReadingDepth;
  isV21Chapter: boolean;
  contentRef: RefObject<HTMLDivElement | null>;
  readerInteractionsReady: boolean;
  servingOfflineCopy: boolean;
  showLoopCoachmark: boolean;
  onDismissLoopCoachmark: () => void;
  onOpenNotes: () => void;
  onOpenShortcuts: () => void;
  onChangeLearningMode: (mode: LearningMode) => void;
  access: ReturnType<typeof useReaderAccess>;
  settings: ReturnType<typeof useReaderSettings>;
  progress: ReturnType<typeof useReaderProgress>;
  phaseFlow: ReturnType<typeof useReaderPhaseFlow>;
  phaseContent: ReactNode;
  overlays: ReactNode;
};

export function ReaderChrome({
  bookId,
  initialBook,
  chapter,
  activeDepth,
  isV21Chapter,
  contentRef,
  readerInteractionsReady,
  servingOfflineCopy,
  showLoopCoachmark,
  onDismissLoopCoachmark,
  onOpenNotes,
  onOpenShortcuts,
  onChangeLearningMode,
  access,
  settings,
  progress,
  phaseFlow,
  phaseContent,
  overlays,
}: Props) {
  const { entry, chapters } = access;
  const {
    bookPrefs,
    patchBookPrefs,
    learningMode,
    contentTone,
    settingsOpen,
    setSettingsOpen,
  } = settings;
  const { chapterProgress, readingSession } = progress;
  const { state, setReadingDepth, toggleFocusMode } = chapterProgress;
  const { phaseCompletion, setActiveTab, progressPercent } = phaseFlow;

  return (
    <main
      className="relative min-h-screen overflow-x-hidden text-(--cr-text-primary)"
      inert={readerInteractionsReady ? undefined : true}
      aria-busy={!readerInteractionsReady}
    >
      <div role="status" aria-live="polite" className="sr-only">
        {state.activeTab === "summary" && "Now reading: Summary"}
        {state.activeTab === "examples" && "Now reading: Examples"}
        {state.activeTab === "quiz" && "Now taking: Quiz"}
        {state.activeTab === "practice" && "Now on: Practice"}
      </div>
      {!state.focusMode && <ChapterBackgroundOrbs />}

      {readerInteractionsReady && (
        <div
          className={[
            "pointer-events-none fixed left-4 right-4 z-50 md:left-auto md:right-6",
            "bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] md:bottom-[calc(env(safe-area-inset-bottom)+5rem)]",
            state.focusMode ? "hidden" : "",
          ].join(" ")}
        >
          <div className="pointer-events-auto md:ml-auto">
            <LazyAudioPlayer
              bookId={bookId}
              chapterNumber={chapter.order}
              chapterTitle={`Chapter ${chapter.order}: ${chapter.title}`}
              tone={contentTone}
              variant={
                activeDepth === "simple"
                  ? "easy"
                  : activeDepth === "deeper"
                    ? "hard"
                    : "medium"
              }
              initialSpeed={bookPrefs.extended.ttsSpeed}
              onSpeedChange={(speed) => patchBookPrefs("extended", { ttsSpeed: speed })}
            />
          </div>
        </div>
      )}

      <section className="w-full px-5 pb-12 pt-3 sm:px-8 sm:pt-3 md:pb-16">
        <ChapterHeader
          bookId={bookId}
          bookTitle={initialBook?.title ?? entry.title}
          chapterLabel={`Chapter ${chapter.order}`}
          chapterTitle={chapter.title}
          author={initialBook?.author ?? entry.author}
          minutes={chapter.minutes}
          chapterOrder={chapter.order}
          totalChapters={chapters.length}
          focusMode={state.focusMode}
          onToggleFocus={toggleFocusMode}
          onOpenNotes={onOpenNotes}
          trackedMinutesToday={readingSession.todayTrackedMinutes}
          learningMode={learningMode}
          onChangeLearningMode={onChangeLearningMode}
          showProgressBar={bookPrefs.reading.showProgressBar}
          showEstimatedReadingTime={bookPrefs.reading.showEstimatedReadingTime}
          showReadingSessionTimer={bookPrefs.reading.showReadingSessionTimer}
          readingDepth={state.readingDepth}
          onChangeReadingDepth={setReadingDepth}
          showDepthSelector={false}
          onOpenShortcuts={onOpenShortcuts}
          settingsOpen={settingsOpen}
          onSettingsOpenChange={setSettingsOpen}
          fontSize={bookPrefs.reading.fontSize}
          onChangeFontSize={(fontSize) => patchBookPrefs("reading", { fontSize })}
          lineSpacing={bookPrefs.extended.lineSpacing}
          onChangeLineSpacing={(lineSpacing) => patchBookPrefs("extended", { lineSpacing })}
          contentWidth={bookPrefs.reading.contentWidth}
          onChangeContentWidth={(contentWidth) => patchBookPrefs("reading", { contentWidth })}
          fontFamily={bookPrefs.extended.fontFamily}
          onChangeFontFamily={(fontFamily) => patchBookPrefs("extended", { fontFamily })}
        />

        {isV21Chapter && chapter.hook && state.activeTab === "summary" ? (
          <div className="mt-4">
            <AutoCollapsingHookBanner
              hook={chapter.hook}
              counterintuition={chapter.counterintuition}
            />
          </div>
        ) : null}

        {!state.focusMode && (
          <div className="mt-6">
            <PhaseStepper
              currentPhase={state.activeTab}
              completedPhases={phaseCompletion.completedPhases}
              onChange={setActiveTab}
              progressPercent={progressPercent}
              isPhaseAccessible={phaseCompletion.isPhaseAccessible}
              getLockMessage={phaseCompletion.getLockMessage}
              showProgressBar={bookPrefs.reading.showProgressBar}
            />
          </div>
        )}

        {showLoopCoachmark && !state.focusMode && (
          <div className="mt-3 flex items-start gap-3 rounded-xl border border-(--cr-glass-border-teal) bg-(--cr-accent-active) p-3 text-left">
            <Lightbulb className="mt-0.5 h-4 w-4 flex-shrink-0 text-(--cr-accent)" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-(--cr-text-heading)">How this chapter works</p>
              <p className="mt-0.5 text-cf-label text-(--cr-text-secondary)">
                Read the <strong>Summary</strong>, see it in <strong>Examples</strong>, then prove
                it stuck in the <strong>Quiz</strong> to unlock the next chapter. Pick Guided,
                Standard, or Challenge in Reading settings to set how much detail you get.
              </p>
            </div>
            <button
              type="button"
              onClick={onDismissLoopCoachmark}
              className="rounded-lg p-1 text-(--cr-text-secondary) transition hover:text-(--cr-text-heading) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--cr-accent)_55%,transparent)]"
              aria-label="Dismiss tip"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {!state.focusMode &&
          state.activeTab !== "quiz" &&
          !phaseCompletion.currentPhaseReady &&
          (() => {
            const thresholds = getPhaseThresholds(learningMode, state.activeTab);
            if (!thresholds.minTime && !Math.round(thresholds.minScroll * 100)) return null;
            return (
              <p className="mt-4 text-cf-label-sm text-(--cr-text-secondary)">
                Take a moment with this section — Continue unlocks once you&apos;ve read it.
                {state.activeTab === "examples" &&
                  learningMode === "challenge" &&
                  " Be sure to react to every scenario, too."}
              </p>
            );
          })()}

        {servingOfflineCopy && (
          <p className="mt-4 flex items-center gap-1.5 text-cf-label-sm text-(--cr-text-disabled)">
            <CloudOff className="h-3.5 w-3.5" />
            Showing an offline copy — reconnect for the latest.
          </p>
        )}

        <div
          ref={contentRef}
          className="mx-auto mt-4 space-y-5"
          style={{ maxWidth: `min(${bookPrefs.reading.contentWidth}px, 72ch)` }}
        >
          {phaseContent}
        </div>
      </section>
      {overlays}
    </main>
  );
}
