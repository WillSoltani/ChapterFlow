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
import { useQuizDepthHold } from "./hooks/useQuizDepthHold";
import { useReaderSettings } from "./hooks/useReaderSettings";
import type { InitialChapterReaderSeed } from "./lib/chapterFromApi";
import {
  buildChapterNeighbours,
  buildNextChapterRoute,
  chapterDoneOnServer,
  DEPTH_LABELS,
  learningModeTapIsNoop,
  mapLearningStyleToDepth,
  modeToDepth,
  quizStepProgress,
} from "./lib/reader-flow-core";

const READER_LOOP_COACHMARK_KEY = "cf-reader-loop-coachmark-seen:v1";

export function ChapterReaderClient({
  bookId,
  chapterId,
  chapterOrder,
  initialBook,
  initialSeed,
  initialDepth,
}: {
  bookId: string;
  chapterId: string;
  chapterOrder?: number | undefined;
  initialBook?: LibraryBookDetail | undefined;
  initialSeed?: InitialChapterReaderSeed | undefined;
  /** Server-resolved first depth (undefined when the settings read failed). */
  initialDepth?: ReadingDepth | undefined;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const prefersReducedMotion = useReducedMotion();
  const readerSettings = useReaderSettings(initialDepth);
  const {
    bookPrefs,
    patchBookPrefs,
    bookPrefsHydrated,
    onboarding,
    onboardingHydrated,
    learningMode,
    contentTone,
    defaultToFastPath,
    activeDepth,
    preferredActiveTab,
    preferredExampleFilter,
    preferredFocusMode,
    preferredFontScale,
    dailyGoalMinutes,
    saveStatus,
    retrySave,
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
  const [askOpen, setAskOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  // An action shown only while its own toast text is on screen.
  const [toastAction, setToastAction] = useState<{
    toast: string;
    label: string;
    onClick: () => void;
  } | null>(null);
  const [confirmMode, setConfirmMode] = useState<LearningMode | null>(null);
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
    chapterNumber,
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

  const { quizDepth, quizTone, changeOnQuiz } = useQuizDepthHold({
    activeDepth,
    activeTone: contentTone,
    saveStatus,
    onSaveFailed: () => {
      const message = "Couldn't save your reading mode. The quiz stays as it is.";
      setToast(message);
      setToastAction({ toast: message, label: "Try again", onClick: () => retrySave() });
    },
  });
  const chapterQuiz = useChapterQuiz({
    bookId,
    chapterId,
    chapter,
    chapterNumber: chapter?.order ?? baseChapter?.order ?? 1,
    activeDepth: quizDepth,
    contentTone: quizTone,
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
    chapterDone: chapterDoneOnServer(readerProgress.chapterState, quizPassed),
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
    currentChapterNumber: hydrated ? bookProgress.currentChapter?.order : undefined,
    access: readerAccess,
  };
  if (!chapter) return <ReaderAccessState {...accessStateProps} />;

  const chapterIndex = chapters.findIndex((item) => item.id === chapter.id);
  const nextChapter = chapterIndex >= 0 ? chapters[chapterIndex + 1] : undefined;
  const neighbours = buildChapterNeighbours({
    bookId,
    chapters,
    chapterId: chapter.id,
    sessionMode,
    getChapterState: bookProgress.getChapterState,
    quizPassed,
    chapterCompleted: readerProgress.chapterState === "completed",
    onFinishChapter: () => finishChapter(),
  });
  const quizProgress = quizStepProgress(state.activeTab, quiz.session, quiz.answers);
  const handleLearningModeChange = (mode: LearningMode) => {
    if (learningModeTapIsNoop(mode, learningMode, defaultToFastPath)) return;
    // READER-12: on the Quiz tab the quiz keeps its depth until the change is
    // saved; an attempt in progress asks first, since the reload clears it.
    if (state.activeTab !== "quiz") applyLearningModeChange(mode);
    else if (chapterQuiz.attemptInProgress) setConfirmMode(mode);
    else changeOnQuiz(() => applyLearningModeChange(mode));
  };
  const applyLearningModeChange = (mode: LearningMode) => {
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
      guided: "Shorter summaries, more pacing support.",
      standard: "Balanced depth and pacing.",
      challenge: "Longer summaries, faster pace.",
    };
    setToast(`Switched to ${DEPTH_LABELS[nextDepth]}. ${messages[mode]}`);
  };
  const handleSubmitQuiz = async () => {
    if (!readerInteractionsReady) return;
    const outcome = await submitQuiz();
    if (outcome.kind === "passed") phaseCompletion.markPhaseCompleted("quiz");
  };
  // "Finish chapter", also run by the next chapter link after a pass so the
  // chapter is marked finished and its loop-complete points are claimed.
  const finishChapter = () => {
    if (!readerInteractionsReady) return false;
    phaseCompletion.markPhaseCompleted("quiz");
    phaseCompletion.markPhaseCompleted("practice");
    markChapterComplete(chapter.id, chapterQuiz.completionScore);
    claimLoopCompleteIP().catch(() => {});
    return true;
  };
  const handleContinueToPractice = () => {
    if (finishChapter()) setShowCompleteModal(true);
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
        askOpen={askOpen}
        onOpenAsk={() => setAskOpen(true)}
        neighbours={neighbours}
        progressOverride={quizProgress}
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
            askOpen={askOpen}
            onAskOpenChange={setAskOpen}
            sessionMode={sessionMode}
            onSessionTourDone={handleSessionTourDone}
            showCompleteModal={showCompleteModal}
            onCompleteOpenChange={setShowCompleteModal}
            showShortcuts={showShortcuts}
            onShortcutsOpenChange={setShowShortcuts}
            toast={toast}
            onToastChange={setToast}
            toastAction={toastAction?.toast === toast ? toastAction : null}
            modeConfirm={
              confirmMode && {
                label: DEPTH_LABELS[modeToDepth(confirmMode)],
                onCancel: () => setConfirmMode(null),
                onConfirm: () => {
                  setConfirmMode(null);
                  changeOnQuiz(() => applyLearningModeChange(confirmMode));
                },
              }
            }
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
