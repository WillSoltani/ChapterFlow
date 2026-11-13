"use client";

import { useState, type ReactNode, type RefObject } from "react";
import dynamic from "next/dynamic";
import type { BookChapter, ReadingDepth } from "@/app/book/data/bookChapters";
import type { LibraryBookDetail } from "@/app/book/_lib/library-data";
import type { LearningMode } from "@/app/book/settings/types/settings";
import type { useReaderAccess } from "../hooks/useReaderAccess";
import type { useReaderPhaseFlow } from "../hooks/useReaderPhaseFlow";
import type { useReaderProgress } from "../hooks/useReaderProgress";
import type { useReaderSettings } from "../hooks/useReaderSettings";
import { HookLead } from "./HookBanner";
import { ChapterPager, type ChapterNeighbours } from "./ReaderChapterNav";
import { ReaderSettingsMenu } from "./ReaderSettingsMenu";
import { ReaderTopBar } from "./ReaderTopBar";

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

const MODE_LABELS: Record<LearningMode, string> = {
  guided: "Guided",
  standard: "Standard",
  challenge: "Challenge",
};

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
  askOpen: boolean;
  onOpenAsk: () => void;
  onChangeLearningMode: (mode: LearningMode) => void;
  neighbours: ChapterNeighbours;
  /** Quiz step: answered / total (0..1). Reading steps pass null. */
  progressOverride: number | null;
  access: ReturnType<typeof useReaderAccess>;
  settings: ReturnType<typeof useReaderSettings>;
  progress: ReturnType<typeof useReaderProgress>;
  phaseFlow: ReturnType<typeof useReaderPhaseFlow>;
  phaseContent: ReactNode;
  overlays: ReactNode;
};

/** Layout A, "Page": one thin sticky top bar holds all chrome; below it the
 *  chapter is set like a page of a book in one centred column (title, lead,
 *  text, the end-of-step button, then Previous / Next chapter). */
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
  askOpen,
  onOpenAsk,
  onChangeLearningMode,
  neighbours,
  progressOverride,
  access,
  settings,
  progress,
  phaseFlow,
  phaseContent,
  overlays,
}: Props) {
  const { entry, chapters } = access;
  const { bookPrefs, patchBookPrefs, learningMode, contentTone, settingsOpen, setSettingsOpen } =
    settings;
  const { chapterProgress } = progress;
  const { state, setReadingDepth, toggleFocusMode, syncFailed } = chapterProgress;
  const { phaseCompletion, setActiveTab } = phaseFlow;
  const [audioOpen, setAudioOpen] = useState(false);

  // The text column is measured in the reading font's size, so a line keeps
  // its length when the font size changes: Narrow (the default) sets about 68
  // characters per line, Medium and Wide about 78 and 88. 4rem = side margins.
  const contentWidth = bookPrefs.reading.contentWidth;
  const columnEm = contentWidth <= 720 ? 29 : contentWidth >= 880 ? 37 : 33;
  const columnMaxWidth = `calc(var(--reading-font-size, 18px) * ${columnEm} + 4rem)`;
  const bookTitle = initialBook?.title ?? entry.title;
  const author = initialBook?.author ?? entry.author;
  const meta = [
    bookTitle,
    author,
    bookPrefs.reading.showEstimatedReadingTime ? `${chapter.minutes} min read` : null,
    learningMode !== "standard" ? `${MODE_LABELS[learningMode]} mode` : null,
  ].filter(Boolean);

  return (
    <main
      className="relative min-h-screen overflow-x-clip bg-(--cr-bg-root) text-(--cr-text-primary)"
      inert={readerInteractionsReady ? undefined : true}
      aria-busy={!readerInteractionsReady}
    >
      <div role="status" aria-live="polite" className="sr-only">
        {state.activeTab === "summary" && "Now reading: Summary"}
        {state.activeTab === "examples" && "Now reading: Examples"}
        {state.activeTab === "quiz" && "Now taking: Quiz"}
        {state.activeTab === "practice" && "Now on: Practice"}
      </div>

      <ReaderTopBar
        bookId={bookId}
        chapterOrder={chapter.order}
        totalChapters={chapters.length}
        chapterTitle={chapter.title}
        contentRef={contentRef}
        currentPhase={state.activeTab}
        completedPhases={phaseCompletion.completedPhases}
        isPhaseAccessible={phaseCompletion.isPhaseAccessible}
        getLockMessage={phaseCompletion.getLockMessage}
        onSelectPhase={setActiveTab}
        neighbours={neighbours}
        progressOverride={progressOverride}
        showProgress={bookPrefs.reading.showProgressBar}
        focusMode={state.focusMode}
        onToggleFocus={toggleFocusMode}
        audioOpen={audioOpen}
        onToggleAudio={() => setAudioOpen((open) => !open)}
        audioSlot={
          readerInteractionsReady && (
            <LazyAudioPlayer
              layout="inline"
              open={audioOpen}
              onOpenChange={setAudioOpen}
              bookId={bookId}
              chapterNumber={chapter.order}
              chapterTitle={`Chapter ${chapter.order}: ${chapter.title}`}
              tone={contentTone}
              variant={
                activeDepth === "simple" ? "easy" : activeDepth === "deeper" ? "hard" : "medium"
              }
              initialSpeed={bookPrefs.extended.ttsSpeed}
              onSpeedChange={(speed) => patchBookPrefs("extended", { ttsSpeed: speed })}
            />
          )
        }
        askOpen={askOpen}
        onOpenAsk={onOpenAsk}
        onOpenNotes={onOpenNotes}
        settingsOpen={settingsOpen}
        onToggleSettings={() => setSettingsOpen(!settingsOpen)}
        settingsMenu={
          <ReaderSettingsMenu
            open={settingsOpen}
            onClose={() => setSettingsOpen(false)}
            learningMode={learningMode}
            onChangeLearningMode={onChangeLearningMode}
            showDepthSelector={false}
            readingDepth={state.readingDepth}
            onChangeReadingDepth={setReadingDepth}
            focusMode={state.focusMode}
            onToggleFocus={toggleFocusMode}
            fontSize={bookPrefs.reading.fontSize}
            onChangeFontSize={(fontSize) => patchBookPrefs("reading", { fontSize })}
            lineSpacing={bookPrefs.extended.lineSpacing}
            onChangeLineSpacing={(lineSpacing) => patchBookPrefs("extended", { lineSpacing })}
            contentWidth={bookPrefs.reading.contentWidth}
            onChangeContentWidth={(contentWidth) => patchBookPrefs("reading", { contentWidth })}
            fontFamily={bookPrefs.extended.fontFamily}
            onChangeFontFamily={(fontFamily) => patchBookPrefs("extended", { fontFamily })}
          />
        }
        onOpenShortcuts={onOpenShortcuts}
        columnMaxWidth={columnMaxWidth}
      />

      <article
        className="mx-auto w-full px-5 pb-[calc(env(safe-area-inset-bottom)+4rem)] sm:px-8"
        style={{ maxWidth: columnMaxWidth }}
      >
        <div className="pb-7 pt-6 sm:pb-10 sm:pt-14">
          <p className="text-cf-caption font-medium uppercase tracking-[0.16em] text-(--cr-text-secondary)">
            Chapter {chapter.order}
          </p>
          <h1 className="mt-2 font-(family-name:--font-reading) text-[1.75rem] font-medium leading-[1.15] tracking-[-0.01em] text-balance text-(--cr-text-heading) sm:text-[2.5rem]">
            {chapter.title}
          </h1>
          <p className="mt-2.5 text-cf-caption text-(--cr-text-secondary)">{meta.join(" · ")}</p>
          {servingOfflineCopy && (
            <p className="mt-1 text-cf-caption text-(--cr-text-secondary)">
              Showing an offline copy. Reconnect for the latest.
            </p>
          )}
          {syncFailed && (
            <p className="mt-1 text-cf-caption text-(--cr-warning)" role="status">
              Changes saved on this device only.
            </p>
          )}
        </div>

        {showLoopCoachmark && !state.focusMode && (
          <p className="mb-7 border-l-2 border-(--cr-glass-border) pl-4 text-cf-label-sm leading-relaxed text-(--cr-text-secondary)">
            Read the Summary, see it at work in Examples, then pass the Quiz to open the next
            chapter. Reading settings sets how much detail you get.{" "}
            <button
              type="button"
              onClick={onDismissLoopCoachmark}
              className="font-medium text-(--cr-text-primary) underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--cr-accent)_55%,transparent)]"
            >
              Got it
            </button>
          </p>
        )}

        {isV21Chapter && chapter.hook && state.activeTab === "summary" ? (
          <div className="mb-5">
            <HookLead hook={chapter.hook} counterintuition={chapter.counterintuition} />
          </div>
        ) : null}

        <div ref={contentRef} className="space-y-5">
          {phaseContent}
        </div>

        <ChapterPager neighbours={neighbours} />
      </article>
      {overlays}
    </main>
  );
}
