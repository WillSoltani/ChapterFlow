"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BookLock, CheckCircle2, Sparkles } from "lucide-react";
import {
  getBookChaptersBundle,
  getChapterById,
  personalizeChapterForMotivation,
  type ChapterMotivationStyle,
  type ChapterExample,
  type ReadingDepth,
} from "@/app/book/data/mockChapters";
import { getLibraryBookById } from "@/app/book/data/mockUserLibraryState";
import { BookClientError, fetchBookJson } from "@/app/book/_lib/book-api";
import {
  chapterStartModeToInitialTab,
} from "@/app/book/_lib/onboarding-personalization";
import { FLOW_POINTS_AMOUNTS } from "@/app/book/_lib/flow-points-economy";
import { useOnboardingState } from "@/app/book/hooks/useOnboardingState";
import { useKeyboardShortcut } from "@/app/book/hooks/useKeyboardShortcut";
import { ChapterHeader } from "@/app/book/library/[bookId]/chapter/[chapterId]/components/ChapterHeader";
import { PhaseStepper } from "@/app/book/library/[bookId]/chapter/[chapterId]/components/PhaseStepper";
import { PhaseInterstitial } from "@/app/book/library/[bookId]/chapter/[chapterId]/components/PhaseInterstitial";
import { ChapterBackgroundOrbs } from "@/app/book/library/[bookId]/chapter/[chapterId]/components/ChapterBackgroundOrbs";
import { ContinueButton } from "@/app/book/library/[bookId]/chapter/[chapterId]/components/ContinueButton";
import {
  ExamplesList,
  type ScenarioSubmissionDraft,
  type UserScenarioSubmission,
} from "@/app/book/library/[bookId]/chapter/[chapterId]/components/ExamplesList";
import { NotesDrawer } from "@/app/book/library/[bookId]/chapter/[chapterId]/components/NotesDrawer";
import { QuizPanel } from "@/app/book/library/[bookId]/chapter/[chapterId]/components/QuizPanel";
import { SummaryCard } from "@/app/book/library/[bookId]/chapter/[chapterId]/components/SummaryCard";
import { SessionModeOverlay } from "@/app/book/library/[bookId]/chapter/[chapterId]/components/SessionModeOverlay";
import { useChapterState, type ChapterTab } from "@/app/book/library/[bookId]/chapter/[chapterId]/hooks/useChapterState";
import { useQuizSession } from "@/app/book/library/[bookId]/chapter/[chapterId]/hooks/useQuizSession";
import { usePhaseCompletion } from "@/app/book/library/[bookId]/chapter/[chapterId]/hooks/usePhaseCompletion";
import { useBookProgress } from "@/app/book/library/hooks/useBookProgress";
import { useReadingSessionTracker } from "@/app/book/library/hooks/useReadingSessionTracker";
import { InfoModal } from "@/app/book/home/components/InfoModal";
import type { LearningMode } from "@/app/book/settings/types/settings";

const SCENARIO_SUBMISSION_POINTS = FLOW_POINTS_AMOUNTS.scenarioApproved;

function mapLearningStyleToDepth(value: string): ReadingDepth {
  if (value === "concise") return "simple";
  if (value === "deep") return "deeper";
  return "standard";
}

/** Map learning mode to the content depth variant */
function modeToDepth(mode: LearningMode): ReadingDepth {
  if (mode === "guided") return "simple";
  if (mode === "challenge") return "deeper";
  return "standard";
}

function formatNoteWithTakeaways(takeaways: string[]): string {
  return [
    `Takeaways (${new Date().toLocaleDateString()}):`,
    ...takeaways.map((takeaway) => `- ${takeaway}`),
  ].join("\n");
}

function fontScaleClass(scale: "sm" | "md" | "lg"): string {
  if (scale === "sm") return "text-[0.96rem] leading-7";
  if (scale === "lg") return "text-[1.1rem] leading-8";
  return "text-[1rem] leading-7";
}

/** Compute overall chapter progress percentage based on current phase */
function computeProgressPercent(
  activeTab: ChapterTab,
  completedPhases: Set<ChapterTab>
): number {
  const phaseWeights: Record<ChapterTab, number> = {
    summary: 33,
    examples: 66,
    quiz: 100,
  };
  // If the current tab's phase is also completed, use its full weight
  if (completedPhases.has(activeTab)) return phaseWeights[activeTab];
  // Otherwise show partial progress within the current phase
  const phaseOrder: ChapterTab[] = ["summary", "examples", "quiz"];
  const currentIndex = phaseOrder.indexOf(activeTab);
  const prevWeight = currentIndex > 0 ? phaseWeights[phaseOrder[currentIndex - 1]] : 0;
  const currentWeight = phaseWeights[activeTab];
  // Show halfway through the current phase
  return prevWeight + Math.round((currentWeight - prevWeight) * 0.5);
}

export function ChapterReaderClient({
  bookId,
  chapterId,
}: {
  bookId: string;
  chapterId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [notesOpen, setNotesOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [sessionMode, setSessionMode] = useState(false);
  const [showQuizSuccessModal, setShowQuizSuccessModal] = useState(false);
  const [approvedUserExamples, setApprovedUserExamples] = useState<ChapterExample[]>([]);
  const [userSubmissions, setUserSubmissions] = useState<UserScenarioSubmission[]>([]);
  const [engagementPoints, setEngagementPoints] = useState(0);
  const [bookAccessStatus, setBookAccessStatus] = useState<"loading" | "ready" | "blocked">(
    "loading"
  );
  const [bookAccessMessage, setBookAccessMessage] = useState<string | null>(null);

  // Phase transition interstitial state
  const [interstitial, setInterstitial] = useState<{
    from: ChapterTab;
    to: ChapterTab;
  } | null>(null);

  // Track scenario interactions for phase completion gating
  const [scenarioInteractions, setScenarioInteractions] = useState(0);

  // Content area ref for scroll tracking
  const contentRef = useRef<HTMLDivElement>(null);

  // Resolve learning mode from settings (localStorage)
  const [learningMode, setLearningMode] = useState<LearningMode>("standard");
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("book-accelerator:settings-ext:v1");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.learningMode === "guided" || parsed.learningMode === "standard" || parsed.learningMode === "challenge") {
          setLearningMode(parsed.learningMode);
        }
      }
    } catch {}
  }, []);

  const pauseSessionMode = () => {
    setSessionMode(false);
    router.replace(pathname);
  };

  const handleSessionTourDone = () => {
    setSessionMode(false);
    setActiveTab("summary");
    router.replace(pathname);
  };

  const { state: onboarding, hydrated: onboardingHydrated } = useOnboardingState();
  const preferredReadingDepth = mapLearningStyleToDepth(onboarding.learningStyle);
  const preferredActiveTab = chapterStartModeToInitialTab(onboarding.chapterStartMode);
  const preferredExampleFilter = onboarding.preferredExampleContext;

  const entry = useMemo(() => getLibraryBookById(bookId), [bookId]);
  const bundle = useMemo(() => getBookChaptersBundle(bookId), [bookId]);
  const chapters = bundle.chapters;
  const baseChapter = useMemo(() => getChapterById(bookId, chapterId), [bookId, chapterId]);
  const chapter = useMemo(
    () =>
      baseChapter
        ? personalizeChapterForMotivation(
            baseChapter,
            onboarding.motivationStyle as ChapterMotivationStyle
          )
        : undefined,
    [baseChapter, onboarding.motivationStyle]
  );

  const {
    hydrated,
    currentChapter,
    getChapterState,
    setLastReadChapter,
    markChapterComplete,
  } = useBookProgress(bookId, chapters);

  const {
    hydrated: chapterHydrated,
    state,
    setActiveTab: setActiveTabRaw,
    setReadingDepth,
    setExampleFilter,
    setNotes,
    appendNote,
    toggleFocusMode,
    setFontScale,
    toggleRecap,
  } = useChapterState(
    bookId,
    chapterId,
    baseChapter?.order,
    preferredReadingDepth,
    preferredActiveTab,
    preferredExampleFilter
  );

  // Total scenarios count for phase completion gating
  const totalScenarios = chapter?.examplesDetailed?.length ?? 0;

  // Phase completion tracking (scroll + time + gating)
  // Must be called before setActiveTab callback which references it
  const phaseCompletion = usePhaseCompletion({
    bookId,
    chapterId,
    activePhase: state.activeTab,
    learningMode,
    contentRef,
    scenarioInteractions,
    totalScenarios,
    enabled:
      onboardingHydrated &&
      hydrated &&
      chapterHydrated &&
      onboarding.setupComplete &&
      bookAccessStatus === "ready",
  });

  // Wrapped setActiveTab that enforces gating and shows interstitial
  const setActiveTab = useCallback(
    (newTab: ChapterTab) => {
      const phaseOrder: ChapterTab[] = ["summary", "examples", "quiz"];
      const currentIndex = phaseOrder.indexOf(state.activeTab);
      const newIndex = phaseOrder.indexOf(newTab);

      if (newIndex > currentIndex) {
        // Forward navigation: mark current phase completed first (this
        // unlocks the next phase), then show the interstitial.
        phaseCompletion.markPhaseCompleted(state.activeTab);
        setInterstitial({ from: state.activeTab, to: newTab });
      } else {
        // Backward navigation: allowed only if the target was already
        // completed or all phases have been done once.
        if (!phaseCompletion.isPhaseAccessible(newTab)) return;
        setActiveTabRaw(newTab);
      }

      // Scroll to top of content
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [state.activeTab, setActiveTabRaw, phaseCompletion]
  );

  const handleInterstitialComplete = useCallback(() => {
    if (interstitial) {
      setActiveTabRaw(interstitial.to);
      setInterstitial(null);
    }
  }, [interstitial, setActiveTabRaw]);

  useKeyboardShortcut(
    "n",
    (event) => {
      event.preventDefault();
      setNotesOpen(true);
    },
    { ignoreWhenTyping: true }
  );

  useKeyboardShortcut(
    "f",
    (event) => {
      event.preventDefault();
      toggleFocusMode();
    },
    { ignoreWhenTyping: true }
  );

  useKeyboardShortcut("Escape", () => {
    if (notesOpen) setNotesOpen(false);
    if (sessionMode) pauseSessionMode();
  });

  useEffect(() => {
    if (!onboardingHydrated) return;
    if (!onboarding.setupComplete) router.replace("/book");
  }, [onboarding.setupComplete, onboardingHydrated, router]);

  useEffect(() => {
    if (!entry || !chapter) {
      router.replace("/book/library");
    }
  }, [chapter, entry, router]);

  useEffect(() => {
    if (!chapter || !hydrated) return;
    if (getChapterState(chapter.id) !== "locked") {
      setLastReadChapter(chapter.id);
    }
  }, [chapter, hydrated, getChapterState, setLastReadChapter]);

  useEffect(() => {
    if (!entry || !chapter || !onboardingHydrated || !onboarding.setupComplete) return;
    let cancelled = false;
    setBookAccessStatus("loading");
    setBookAccessMessage(null);
    fetchBookJson(`/app/api/book/me/books/${encodeURIComponent(bookId)}/start`, {
      method: "POST",
    })
      .then(() => {
        if (cancelled) return;
        setBookAccessStatus("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setBookAccessStatus("ready");
      });
    return () => {
      cancelled = true;
    };
  }, [bookId, chapter, entry, onboarding.setupComplete, onboardingHydrated]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 1800);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (searchParams.get("session") === "1") {
      setSessionMode(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!chapter) return;
    let mounted = true;
    fetchBookJson<{
      approvedScenarios: ChapterExample[];
      mySubmissions: UserScenarioSubmission[];
      points: number;
    }>(
      `/app/api/book/me/books/${encodeURIComponent(bookId)}/chapters/${chapter.order}/scenarios`
    )
      .then((payload) => {
        if (!mounted) return;
        setApprovedUserExamples(payload.approvedScenarios ?? []);
        setUserSubmissions(payload.mySubmissions ?? []);
        setEngagementPoints(Number.isFinite(payload.points) ? payload.points : 0);
      })
      .catch(() => {
        if (!mounted) return;
        setApprovedUserExamples([]);
        setUserSubmissions([]);
      });
    return () => {
      mounted = false;
    };
  }, [bookId, chapter]);

  const chapterState = chapter ? getChapterState(chapter.id) : "locked";
  const isLocked = chapterState === "locked";
  const readingSession = useReadingSessionTracker({
    bookId,
    chapterId,
    enabled:
      onboardingHydrated &&
      hydrated &&
      chapterHydrated &&
      onboarding.setupComplete &&
      bookAccessStatus === "ready" &&
      !isLocked,
  });
  const showQuiz = state.activeTab === "quiz";
  const quiz = useQuizSession({
    bookId,
    chapterNumber: chapter?.order ?? baseChapter?.order ?? 1,
    enabled:
      Boolean(chapter) &&
      onboardingHydrated &&
      hydrated &&
      chapterHydrated &&
      onboarding.setupComplete &&
      bookAccessStatus === "ready" &&
      !isLocked &&
      showQuiz,
  });

  if (
    !entry ||
    !chapter ||
    !onboardingHydrated ||
    !hydrated ||
    !chapterHydrated ||
    !onboarding.setupComplete ||
    bookAccessStatus === "loading"
  ) {
    return (
      <main className="relative min-h-screen overflow-x-hidden">
        <ChapterBackgroundOrbs />
        <div className="mx-auto flex min-h-screen items-center justify-center px-4 text-(--cr-text-secondary)">
          Loading chapter...
        </div>
      </main>
    );
  }

  if (bookAccessStatus === "blocked") {
    return (
      <main className="relative min-h-screen overflow-x-hidden">
        <ChapterBackgroundOrbs />
        <section className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-4 py-10 sm:px-6">
          <div className="w-full cr-glass-reading p-8 text-center">
            <BookLock className="mx-auto h-10 w-10 text-(--cr-text-disabled)" />
            <h1 className="mt-4 text-3xl font-bold text-(--cr-text-heading)">
              Book access paused
            </h1>
            <p className="mt-2 text-(--cr-text-secondary)">
              {bookAccessMessage ||
                "We couldn't unlock this book right now. Please head back and try again."}
            </p>
            <Link
              href={`/book/library/${encodeURIComponent(bookId)}`}
              className="mt-5 inline-flex rounded-xl border border-(--cr-glass-border-teal) bg-(--cr-accent-muted) px-4 py-2 text-sm font-medium text-(--cr-accent)"
            >
              Back to book
            </Link>
          </div>
        </section>
      </main>
    );
  }

  if (isLocked) {
    return (
      <main className="relative min-h-screen overflow-x-hidden">
        <ChapterBackgroundOrbs />
        <section className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-4 py-10 sm:px-6">
          <div className="w-full cr-glass-reading p-8 text-center">
            <BookLock className="mx-auto h-10 w-10 text-(--cr-text-disabled)" />
            <h1 className="mt-4 text-3xl font-bold text-(--cr-text-heading)">Chapter locked</h1>
            <p className="mt-2 text-(--cr-text-secondary)">
              Pass the current chapter quiz to unlock this chapter.
            </p>
            <Link
              href={`/book/library/${encodeURIComponent(bookId)}`}
              className="mt-5 inline-flex rounded-xl border border-(--cr-glass-border-teal) bg-(--cr-accent-muted) px-4 py-2 text-sm font-medium text-(--cr-accent)"
            >
              Back to chapters
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const chapterIndex = chapters.findIndex((item) => item.id === chapter.id);
  const nextChapter = chapters[chapterIndex + 1];

  // Content depth driven by learning mode — switches instantly
  const activeDepth = modeToDepth(learningMode);
  const summaryBlocks = chapter.summaryByDepth[activeDepth] ?? chapter.summaryByDepth["standard"];

  const examples = [...chapter.examplesDetailed, ...approvedUserExamples].filter((example) => {
    if (state.exampleFilter === "all") return true;
    return example.scope === state.exampleFilter;
  });
  const textScaleClass = fontScaleClass(state.fontScale);

  const handleSubmitQuiz = async () => {
    try {
      const nextSession = await quiz.submit();
      if (nextSession?.result?.passed) {
        markChapterComplete(chapter.id, nextSession.result.scorePercent);
        phaseCompletion.markPhaseCompleted("quiz");
        setToast("Chapter unlocked.");
        setShowQuizSuccessModal(true);
      } else {
        const minutes = Math.max(1, Math.ceil((nextSession?.cooldownSeconds ?? quiz.cooldownSeconds) / 60));
        setToast(
          `Review the explanations and retry in ${minutes} minute${minutes === 1 ? "" : "s"}.`
        );
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Unable to submit quiz right now.";
      setToast(message);
    }
  };

  const handleUnlockNext = () => {
    quiz.trackNextChapterClick();
    if (nextChapter) {
      const nextRoute = `/book/library/${encodeURIComponent(bookId)}/chapter/${encodeURIComponent(nextChapter.id)}`;
      router.push(sessionMode ? `${nextRoute}?session=1` : nextRoute);
      return;
    }
    router.push(`/book/library/${encodeURIComponent(bookId)}`);
  };

  const handleRetryQuiz = () => {
    void quiz.retry();
  };

  const handleSubmitScenario = async (draft: ScenarioSubmissionDraft) => {
    try {
      const payload = await fetchBookJson<{
        submission: UserScenarioSubmission;
        points: number;
      }>(
        `/app/api/book/me/books/${encodeURIComponent(bookId)}/chapters/${chapter.order}/scenarios`,
        {
          method: "POST",
          body: JSON.stringify(draft),
        }
      );
      setUserSubmissions((prev) => [payload.submission, ...prev]);
      setEngagementPoints((prev) => Math.max(prev, payload.points));
      setToast(
        `Scenario submitted for review. Approved submissions earn +${SCENARIO_SUBMISSION_POINTS} Flow Points.`
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Unable to submit scenario right now.";
      setToast(message);
      throw error;
    }
  };

  const showSummary = state.activeTab === "summary";
  const showExamples = state.activeTab === "examples";
  const progressPercent = computeProgressPercent(state.activeTab, phaseCompletion.completedPhases);

  return (
    <main className="relative min-h-screen overflow-x-hidden text-(--cr-text-primary)">
      <ChapterBackgroundOrbs />

      <section
        className={[
          "mx-auto w-full px-4 pb-28 pt-4 sm:px-6 sm:pt-5 md:pb-24",
          state.focusMode ? "max-w-180" : "max-w-450",
        ].join(" ")}
      >
        <ChapterHeader
          bookId={bookId}
          bookTitle={entry.title}
          chapterLabel={`Chapter ${chapter.order}`}
          chapterTitle={chapter.title}
          author={entry.author}
          minutes={chapter.minutes}
          chapterOrder={chapter.order}
          totalChapters={chapters.length}
          focusMode={state.focusMode}
          onToggleFocus={toggleFocusMode}
          onOpenNotes={() => setNotesOpen(true)}
          fontScale={state.fontScale}
          onChangeFontScale={setFontScale}
          trackedMinutesToday={readingSession.todayTrackedMinutes}
          learningMode={learningMode}
          onChangeLearningMode={(mode) => {
            if (mode === learningMode) return;
            setLearningMode(mode);
            try {
              const raw = window.localStorage.getItem("book-accelerator:settings-ext:v1");
              const settings = raw ? JSON.parse(raw) : {};
              settings.learningMode = mode;
              window.localStorage.setItem("book-accelerator:settings-ext:v1", JSON.stringify(settings));
            } catch {}
            // Mode-switch toast
            const messages: Record<string, string> = {
              guided: "Switched to Guided. Hints enabled, 2 retries on quiz.",
              standard: "Switched to Standard. Balanced mode, 1 retry.",
              challenge: "Switched to Challenge. Timed quiz, no retries, 90% pass.",
            };
            setToast(messages[mode] ?? `Switched to ${mode}.`);
          }}
        />

        {/* 3-Phase Stepper */}
        <div className="mt-6">
          <PhaseStepper
            currentPhase={state.activeTab}
            completedPhases={phaseCompletion.completedPhases}
            onChange={setActiveTab}
            progressPercent={progressPercent}
            isPhaseAccessible={phaseCompletion.isPhaseAccessible}
            getLockMessage={phaseCompletion.getLockMessage}
          />
        </div>

        {/* Content area */}
        <div ref={contentRef} className="mt-6 space-y-5">
          {showSummary && (
            <>
              <SummaryCard
                blocks={summaryBlocks}
                takeaways={chapter.takeaways}
                keyQuote={chapter.keyQuote}
                recap={chapter.recap}
                showRecap={state.showRecap}
                onToggleRecap={toggleRecap}
                onSaveTakeaways={() => {
                  appendNote(formatNoteWithTakeaways(chapter.takeaways));
                  setToast("Takeaways saved to notes.");
                }}
                fontScaleClass={textScaleClass}
                learningMode={learningMode}
              />
              <ContinueButton
                ready={phaseCompletion.currentPhaseReady}
                onClick={() => setActiveTab("examples")}
                readyText="Continue to Examples"
              />
            </>
          )}

          {showExamples && (
            <>
              <ExamplesList
                examples={examples}
                filter={state.exampleFilter}
                onFilterChange={setExampleFilter}
                submissionPoints={engagementPoints}
                mySubmissions={userSubmissions}
                onSubmitScenario={handleSubmitScenario}
                fontScaleClass={textScaleClass}
                learningMode={learningMode}
                onScenarioInteraction={() => setScenarioInteractions((prev) => prev + 1)}
              />
              <ContinueButton
                ready={phaseCompletion.currentPhaseReady}
                onClick={() => setActiveTab("quiz")}
                readyText="Start the Quiz"
              />
            </>
          )}

          {showQuiz && (
            <QuizPanel
              session={quiz.session}
              answers={quiz.answers}
              explanationOpen={quiz.explanationOpen}
              loading={quiz.loading}
              submitting={quiz.submitting}
              error={quiz.error}
              cooldownSeconds={quiz.cooldownSeconds}
              onAnswer={quiz.answerQuestion}
              onSubmit={handleSubmitQuiz}
              onReviewSummary={() => setActiveTab("summary")}
              onRetry={handleRetryQuiz}
              onUnlockNext={handleUnlockNext}
              onToggleExplanation={quiz.toggleExplanation}
              nextChapterLabel={nextChapter ? `Continue to Chapter ${nextChapter.order} \u2192` : "Finish Book \u2192"}
              learningMode={learningMode}
            />
          )}
        </div>
      </section>

      <NotesDrawer
        open={notesOpen}
        onClose={() => setNotesOpen(false)}
        notes={state.notes}
        onNotesChange={setNotes}
        onAddNote={() => {
          appendNote(`\u2022 ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} \u2014 `);
        }}
        onExport={() => setToast("Notes export coming in a future update.")}
        onPinTakeaway={() => {
          appendNote(`Pinned takeaway: ${chapter.takeaways[0] ?? ""}`);
          setToast("Takeaway pinned.");
        }}
      />

      {sessionMode && (
        <SessionModeOverlay onDone={handleSessionTourDone} />
      )}

      {/* Phase transition interstitial */}
      {interstitial && (
        <PhaseInterstitial
          from={interstitial.from}
          to={interstitial.to}
          onComplete={handleInterstitialComplete}
        />
      )}

      <InfoModal
        open={showQuizSuccessModal}
        title="Chapter unlocked"
        onClose={() => setShowQuizSuccessModal(false)}
      >
        <p className="text-sm leading-relaxed text-(--cr-text-secondary)">
          You passed the quiz, unlocked the next chapter, and your result has been saved to your progress.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => {
              setShowQuizSuccessModal(false);
              handleUnlockNext();
            }}
            className="rounded-2xl bg-(--cr-accent) px-4 py-3 text-sm font-bold text-(--cr-text-inverse)"
          >
            {nextChapter ? `Continue to Chapter ${nextChapter.order}` : "Finish Book"}
          </button>
          <button
            type="button"
            onClick={() => setShowQuizSuccessModal(false)}
            className="rounded-2xl border border-(--cr-glass-border) bg-(--cr-bg-surface-3) px-4 py-3 text-sm font-semibold text-(--cr-text-primary)"
          >
            Stay here
          </button>
        </div>
      </InfoModal>

      {currentChapter && (
        <div className="fixed bottom-20 left-4 right-4 z-50 lg:hidden">
          <button
            type="button"
            onClick={() => router.push(`/book/library/${encodeURIComponent(bookId)}/chapter/${encodeURIComponent(currentChapter.id)}`)}
            className="w-full rounded-2xl bg-(--cr-accent) px-4 py-3 text-base font-bold text-(--cr-text-inverse) shadow-[0_8px_24px_rgba(77,182,172,0.3)]"
          >
            Continue Chapter {currentChapter.order} &rarr;
          </button>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-(--cr-glass-border) bg-(--cr-bg-surface-2) px-3 py-2 text-sm text-(--cr-text-primary) shadow-[0_14px_28px_rgba(0,0,0,0.22)]">
          {toast}
        </div>
      )}

      {state.focusMode ? (
        <div className="pointer-events-none fixed bottom-6 right-6 hidden rounded-xl border border-(--cr-success)/30 bg-(--cr-success-bg) px-3 py-1.5 text-xs text-(--cr-success) md:inline-flex md:items-center md:gap-1.5">
          <CheckCircle2 className="h-4 w-4" />
          Focus mode enabled
        </div>
      ) : (
        <div className="pointer-events-none fixed bottom-6 right-6 hidden rounded-xl border border-(--cr-glass-border) bg-(--cr-bg-surface-2) px-3 py-1.5 text-xs text-(--cr-text-secondary) md:inline-flex md:items-center md:gap-1.5">
          <Sparkles className="h-4 w-4" />
          Tip: press N for notes, F for focus
        </div>
      )}
    </main>
  );
}
