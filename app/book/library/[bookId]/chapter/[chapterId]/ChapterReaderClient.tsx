"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useReducedMotion } from "framer-motion";
import type { ReadingDepth } from "@/app/book/data/bookChapters";
import { trackReaderFunnel } from "@/app/book/_lib/reader-analytics";
import type { LibraryBookDetail } from "@/app/book/_lib/library-data";
import { useKeyboardShortcut } from "@/app/book/hooks/useKeyboardShortcut";
import { V21_SCHEMA_VERSION } from "@/app/book/lib/v21-adapter";
import type { ContentTone, LearningMode } from "@/app/book/settings/types/settings";
import { DEFAULT_VISIBLE_EXAMPLES } from "./components/ExamplesList";
import { ReaderAccessState } from "./components/ReaderAccessState";
import { ReaderChrome } from "./components/ReaderChrome";
import { ReaderOverlays } from "./components/ReaderOverlays";
import { ReaderPhaseContent } from "./components/ReaderPhaseContent";
import { useChapterQuiz } from "./hooks/useChapterQuiz";
import { useReaderAccess } from "./hooks/useReaderAccess";
import { useReaderExamples } from "./hooks/useReaderExamples";
import { useReaderPhaseFlow } from "./hooks/useReaderPhaseFlow";
import { useReaderProgress } from "./hooks/useReaderProgress";
import { useReaderSettings } from "./hooks/useReaderSettings";
import type { InitialChapterReaderSeed } from "./lib/chapterFromApi";
import {
  buildNextChapterRoute,
  mapLearningStyleToDepth,
  modeToDepth,
} from "./lib/reader-flow-core";

const READER_LOOP_COACHMARK_KEY = "cf-reader-loop-coachmark-seen:v1";

export function ChapterReaderClient({
  bookId,
  chapterId,
  chapterOrder,
  initialBook,
  initialSeed,
}: {
  bookId: string;
  chapterId: string;
  chapterOrder?: number | undefined;
  initialBook?: LibraryBookDetail | undefined;
  initialSeed?: InitialChapterReaderSeed | undefined;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const prefersReducedMotion = useReducedMotion();
  const readerSettings = useReaderSettings();
  const {
    bookPrefs,
    patchBookPrefs,
    bookPrefsHydrated,
    onboarding,
    onboardingHydrated,
    learningMode,
    contentTone,
    defaultToFastPath,
    preferredActiveTab,
    preferredExampleFilter,
    preferredFocusMode,
    preferredFontScale,
    dailyGoalMinutes,
  } = readerSettings;
  const readerAccess = useReaderAccess({
    bookId,
    chapterId,
    chapterOrder,
    initialBook,
    initialSeed,
    contentTone,
    onboarding,
    onboardingHydrated,
  });
  const {
    entry,
    chapters,
    chapterNumber,
    baseChapter,
    chapter,
    servingOfflineCopy,
    initialProgressFloor,
    hasAttestedSeed,
    effectiveOnboardingComplete,
    bookAccessStatus,
  } = readerAccess;
  const [notesOpen, setNotesOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [sessionMode, setSessionMode] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showLoopCoachmark, setShowLoopCoachmark] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const preferredReadingDepth: ReadingDepth = baseChapter?.isStrictV12
    ? defaultToFastPath
      ? "simple"
      : "standard"
    : mapLearningStyleToDepth(onboarding.learningStyle);
  const readerProgress = useReaderProgress({
    bookId,
    chapterId,
    chapter,
    chapters,
    initialProgressFloor,
    preferredReadingDepth,
    preferredActiveTab,
    preferredExampleFilter,
    preferredFocusMode,
    preferredFontScale,
    onboardingHydrated,
    effectiveOnboardingComplete,
    bookAccessStatus,
    hasAttestedSeed,
    bookPrefs,
    bookPrefsHydrated,
    dailyGoalMinutes,
    onToast: setToast,
  });
  const { bookProgress, chapterProgress, isLocked, readerInteractionsReady } = readerProgress;
  const { hydrated, markChapterComplete } = bookProgress;
  const {
    hydrated: chapterHydrated,
    state,
    setActiveTab: setActiveTabRaw,
    setReadingDepth,
    setExampleFilter,
    toggleFocusMode,
  } = chapterProgress;

  useEffect(() => {
    if (chapter?.order !== 1) return;
    try {
      if (!localStorage.getItem(READER_LOOP_COACHMARK_KEY)) setShowLoopCoachmark(true);
    } catch {}
  }, [chapter?.order]);
  const dismissLoopCoachmark = useCallback(() => {
    setShowLoopCoachmark(false);
    try {
      localStorage.setItem(READER_LOOP_COACHMARK_KEY, "1");
    } catch {}
  }, []);

  const activeDepth: ReadingDepth = defaultToFastPath ? "simple" : modeToDepth(learningMode);
  const chapterQuiz = useChapterQuiz({
    bookId,
    chapterId,
    chapter,
    chapterNumber: chapter?.order ?? baseChapter?.order ?? 1,
    activeDepth,
    contentTone,
    enabled: Boolean(chapter) && readerInteractionsReady,
    showQuiz: state.activeTab === "quiz",
    retryIncorrectOnly: bookPrefs.learning.retryIncorrectOnly,
    motivationPersona: bookPrefs.extended.motivationPersona,
    bookTitle: entry.title,
    onToast: setToast,
  });
  const { quiz, quizPassed, submitQuiz, retryQuiz, claimLoopCompleteIP } = chapterQuiz;
  const readerExamples = useReaderExamples({
    bookId,
    chapterOrder,
    chapterNumber,
    chapter,
    enabled: readerInteractionsReady,
    exampleFilter: state.exampleFilter,
    setExampleFilter,
    onToast: setToast,
  });
  const totalScenarios = Math.min(
    readerExamples.filteredExamples.length,
    DEFAULT_VISIBLE_EXAMPLES,
  );
  const phaseFlow = useReaderPhaseFlow({
    bookId,
    chapterId,
    chapter,
    chapters,
    activeTab: state.activeTab,
    setActiveTabRaw,
    learningMode,
    contentRef,
    scenarioInteractions: readerExamples.scenarioInteractions,
    totalScenarios,
    enabled: readerInteractionsReady,
    focusReady: chapterHydrated,
    quizPassed,
    sessionMode,
  });
  const { phaseCompletion, setActiveTab } = phaseFlow;

  const pauseSessionMode = () => {
    setSessionMode(false);
    router.replace(pathname);
  };
  const handleSessionTourDone = () => {
    setSessionMode(false);
    setActiveTab("summary");
    router.replace(pathname);
  };

  useKeyboardShortcut(
    "n",
    (event) => {
      if (!readerInteractionsReady) return;
      event.preventDefault();
      setNotesOpen(true);
    },
    { ignoreWhenTyping: true },
  );
  useKeyboardShortcut(
    "f",
    (event) => {
      if (!readerInteractionsReady) return;
      event.preventDefault();
      toggleFocusMode();
    },
    { ignoreWhenTyping: true },
  );
  useKeyboardShortcut("Escape", () => {
    if (showShortcuts) {
      setShowShortcuts(false);
      return;
    }
    if (notesOpen) setNotesOpen(false);
    if (sessionMode) pauseSessionMode();
  });
  useKeyboardShortcut(
    "?",
    (event) => {
      event.preventDefault();
      setShowShortcuts((visible) => !visible);
    },
    { ignoreWhenTyping: true },
  );

  useEffect(() => {
    if (!toast) return;
    const duration = toast.length > 40 ? 5000 : 1800;
    const timeout = window.setTimeout(() => setToast(null), duration);
    return () => window.clearTimeout(timeout);
  }, [toast]);
  useEffect(() => {
    if (searchParams.get("session") === "1") setSessionMode(true);
  }, [searchParams]);

  const accessStateProps = {
    bookId,
    pathname,
    search: searchParams.toString(),
    onboardingHydrated,
    progressHydrated: hydrated,
    chapterHydrated,
    isLocked,
    access: readerAccess,
  };
  if (!chapter) return <ReaderAccessState {...accessStateProps} />;

  const chapterIndex = chapters.findIndex((item) => item.id === chapter.id);
  const nextChapter = chapters[chapterIndex + 1];
  const handleLearningModeChange = (mode: LearningMode) => {
    if (mode === learningMode) return;
    const toneByMode: Record<LearningMode, ContentTone> = {
      guided: "gentle",
      standard: "gentle",
      challenge: "competitive",
    };
    const nextDepth = modeToDepth(mode);
    if (nextDepth !== activeDepth) {
      trackReaderFunnel("depth_changed", {
        bookId,
        chapterNumber: chapter.order,
        depth: nextDepth,
      });
    }
    patchBookPrefs("extended", {
      learningMode: mode,
      contentTone: toneByMode[mode],
      profileCustomized: true,
    });
    setReadingDepth(nextDepth);
    const messages: Record<LearningMode, string> = {
      guided: "Switched to Guided. Shorter summaries, more pacing support.",
      standard: "Switched to Standard. Balanced depth and pacing.",
      challenge: "Switched to Challenge. Deeper summaries, faster pace.",
    };
    setToast(messages[mode]);
  };
  const handleSubmitQuiz = async () => {
    if (!readerInteractionsReady) return;
    const outcome = await submitQuiz();
    if (outcome.kind === "passed") phaseCompletion.markPhaseCompleted("quiz");
  };
  const handleContinueToPractice = () => {
    if (!readerInteractionsReady) return;
    phaseCompletion.markPhaseCompleted("quiz");
    phaseCompletion.markPhaseCompleted("practice");
    markChapterComplete(chapter.id, chapterQuiz.completionScore);
    setShowCompleteModal(true);
    claimLoopCompleteIP().catch(() => {});
  };
  const handleRetryQuiz = () => {
    if (readerInteractionsReady) void retryQuiz();
  };
  const handleChapterCompleteNext = () => {
    setShowCompleteModal(false);
    quiz.trackNextChapterClick();
    if (nextChapter) {
      trackReaderFunnel("next_chapter_started", {
        bookId,
        chapterNumber: chapter.order,
        nextChapterNumber: nextChapter.order,
      });
      router.push(buildNextChapterRoute(bookId, nextChapter.id, sessionMode));
      return;
    }
    router.push(`/book/library/${encodeURIComponent(bookId)}`);
  };
  const handleChapterCompleteLibrary = () => {
    setShowCompleteModal(false);
    router.push(`/book/library/${encodeURIComponent(bookId)}`);
  };

  return (
    <ReaderAccessState {...accessStateProps}>
      <ReaderChrome
        bookId={bookId}
        initialBook={initialBook}
        chapter={chapter}
        activeDepth={activeDepth}
        isV21Chapter={chapter.schemaVersion === V21_SCHEMA_VERSION}
        contentRef={contentRef}
        readerInteractionsReady={readerInteractionsReady}
        servingOfflineCopy={servingOfflineCopy}
        showLoopCoachmark={showLoopCoachmark}
        onDismissLoopCoachmark={dismissLoopCoachmark}
        onOpenNotes={() => setNotesOpen(true)}
        onOpenShortcuts={() => setShowShortcuts(true)}
        onChangeLearningMode={handleLearningModeChange}
        access={readerAccess}
        settings={readerSettings}
        progress={readerProgress}
        phaseFlow={phaseFlow}
        phaseContent={
          <ReaderPhaseContent
            bookId={bookId}
            chapterId={chapterId}
            chapter={chapter}
            activeDepth={activeDepth}
            prefersReducedMotion={prefersReducedMotion}
            settings={readerSettings}
            progress={readerProgress}
            phaseFlow={phaseFlow}
            chapterQuiz={chapterQuiz}
            examples={readerExamples}
            onToast={setToast}
            onSubmitQuiz={handleSubmitQuiz}
            onRetryQuiz={handleRetryQuiz}
            onContinueToPractice={handleContinueToPractice}
          />
        }
        overlays={
          <ReaderOverlays
            bookId={bookId}
            chapterId={chapterId}
            chapter={chapter}
            activeDepth={activeDepth}
            nextChapter={nextChapter}
            notesOpen={notesOpen}
            onNotesOpenChange={setNotesOpen}
            sessionMode={sessionMode}
            onSessionTourDone={handleSessionTourDone}
            showCompleteModal={showCompleteModal}
            onCompleteOpenChange={setShowCompleteModal}
            showShortcuts={showShortcuts}
            onShortcutsOpenChange={setShowShortcuts}
            toast={toast}
            onToastChange={setToast}
            onChapterCompleteNext={handleChapterCompleteNext}
            onChapterCompleteLibrary={handleChapterCompleteLibrary}
            access={readerAccess}
            progress={readerProgress}
            phaseFlow={phaseFlow}
            chapterQuiz={chapterQuiz}
            examples={readerExamples}
          />
        }
      />
    </ReaderAccessState>
  );
}
