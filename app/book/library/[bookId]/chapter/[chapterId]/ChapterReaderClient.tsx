"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
import { ChapterTabs } from "@/app/book/library/[bookId]/chapter/[chapterId]/components/ChapterTabs";
import {
  ExamplesList,
  type ScenarioSubmissionDraft,
  type UserScenarioSubmission,
} from "@/app/book/library/[bookId]/chapter/[chapterId]/components/ExamplesList";
import { NotesDrawer } from "@/app/book/library/[bookId]/chapter/[chapterId]/components/NotesDrawer";
import { QuizPanel } from "@/app/book/library/[bookId]/chapter/[chapterId]/components/QuizPanel";
import { ReadingDepthSelector } from "@/app/book/library/[bookId]/chapter/[chapterId]/components/ReadingDepthSelector";
import { SummaryCard } from "@/app/book/library/[bookId]/chapter/[chapterId]/components/SummaryCard";
import { SessionModeOverlay } from "@/app/book/library/[bookId]/chapter/[chapterId]/components/SessionModeOverlay";
import { useChapterState } from "@/app/book/library/[bookId]/chapter/[chapterId]/hooks/useChapterState";
import { useQuizSession } from "@/app/book/library/[bookId]/chapter/[chapterId]/hooks/useQuizSession";
import { useBookProgress } from "@/app/book/library/hooks/useBookProgress";
import { useReadingSessionTracker } from "@/app/book/library/hooks/useReadingSessionTracker";
import { InfoModal } from "@/app/book/home/components/InfoModal";

const SCENARIO_SUBMISSION_POINTS = FLOW_POINTS_AMOUNTS.scenarioApproved;

function mapLearningStyleToDepth(value: string): ReadingDepth {
  if (value === "concise") return "simple";
  if (value === "deep") return "deeper";
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
    setActiveTab,
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
      .catch((error: unknown) => {
        if (cancelled) return;
        if (
          error instanceof BookClientError &&
          (error.code === "paywall_book_limit" ||
            error.code === "email_verification_required" ||
            error.code === "free_access_review_required")
        ) {
          setBookAccessMessage(error.message);
          setBookAccessStatus("blocked");
          return;
        }
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
      <main className="cf-app-shell">
        <div className="mx-auto flex min-h-screen items-center justify-center px-4 text-(--cf-text-2)">
          Loading chapter...
        </div>
      </main>
    );
  }

  if (bookAccessStatus === "blocked") {
    return (
      <main className="cf-app-shell">
        <section className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-4 py-10 sm:px-6">
          <div className="w-full rounded-[28px] border border-(--cf-border) bg-(--cf-surface) p-8 text-center shadow-xl">
            <BookLock className="mx-auto h-10 w-10 text-(--cf-text-3)" />
            <h1 className="mt-4 text-3xl font-semibold text-(--cf-text-1)">
              Book access paused
            </h1>
            <p className="mt-2 text-(--cf-text-2)">
              {bookAccessMessage ||
                "We couldn't unlock this book right now. Please head back and try again."}
            </p>
            <Link
              href={`/book/library/${encodeURIComponent(bookId)}`}
              className="mt-5 inline-flex rounded-xl border border-(--cf-accent-border) bg-(--cf-accent-soft) px-4 py-2 text-sm font-medium text-(--cf-info-text)"
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
      <main className="cf-app-shell">
        <section className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-4 py-10 sm:px-6">
          <div className="w-full rounded-[28px] border border-(--cf-border) bg-(--cf-surface) p-8 text-center shadow-xl">
            <BookLock className="mx-auto h-10 w-10 text-(--cf-text-3)" />
            <h1 className="mt-4 text-3xl font-semibold text-(--cf-text-1)">Chapter locked</h1>
            <p className="mt-2 text-(--cf-text-2)">
              Pass the current chapter quiz to unlock this chapter.
            </p>
            <Link
              href={`/book/library/${encodeURIComponent(bookId)}`}
              className="mt-5 inline-flex rounded-xl border border-(--cf-accent-border) bg-(--cf-accent-soft) px-4 py-2 text-sm font-medium text-(--cf-info-text)"
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
    if (quiz.cooldownSeconds > 0) {
      const minutes = Math.max(1, Math.ceil(quiz.cooldownSeconds / 60));
      setToast(`Retake locked for ${minutes} minute${minutes === 1 ? "" : "s"}.`);
      return;
    }
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

  return (
    <main className="relative min-h-screen overflow-x-hidden text-(--cf-text-1)">
      <div className="pointer-events-none absolute inset-0 -z-20 bg-(--cf-page-bg)" />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(880px_circle_at_12%_-6%,var(--cf-accent-muted),transparent_58%),radial-gradient(780px_circle_at_100%_0%,var(--cf-warm-soft),transparent_60%)]" />

      <section
        className={[
          "mx-auto w-full px-4 pb-28 pt-4 sm:px-6 sm:pt-5 md:pb-24",
          state.focusMode
            ? showQuiz
              ? "max-w-6xl"
              : "max-w-5xl"
            : showQuiz
              ? "max-w-7xl"
              : "max-w-4xl",
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
        />

        <div className="mt-6 flex justify-center">
          <ChapterTabs value={state.activeTab} onChange={setActiveTab} />
        </div>

        <div className="mt-6 space-y-5">
          {showSummary ? (
            <>
              <ReadingDepthSelector value={state.readingDepth} onChange={setReadingDepth} />
              <SummaryCard
                blocks={chapter.summaryByDepth[state.readingDepth]}
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
              />
            </>
          ) : null}

          {showExamples ? (
            <ExamplesList
              examples={examples}
              filter={state.exampleFilter}
              onFilterChange={setExampleFilter}
              submissionPoints={engagementPoints}
              mySubmissions={userSubmissions}
              onSubmitScenario={handleSubmitScenario}
              fontScaleClass={textScaleClass}
            />
          ) : null}

          {showQuiz ? (
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
              nextChapterLabel={nextChapter ? `Unlock Chapter ${nextChapter.order} →` : "Finish Book →"}
            />
          ) : null}
        </div>
      </section>

      <NotesDrawer
        open={notesOpen}
        onClose={() => setNotesOpen(false)}
        notes={state.notes}
        onNotesChange={setNotes}
        onAddNote={() => {
          appendNote(`• ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} — `);
        }}
        onExport={() => setToast("Notes export coming in a future update.")}
        onPinTakeaway={() => {
          appendNote(`Pinned takeaway: ${chapter.takeaways[0] ?? ""}`);
          setToast("Takeaway pinned.");
        }}
      />

      {sessionMode ? (
        <SessionModeOverlay onDone={handleSessionTourDone} />
      ) : null}

      <InfoModal
        open={showQuizSuccessModal}
        title="Chapter unlocked"
        onClose={() => setShowQuizSuccessModal(false)}
      >
        <p className="text-sm leading-relaxed">
          You passed the quiz, unlocked the next chapter, and your result has been saved to your progress.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => {
              setShowQuizSuccessModal(false);
              handleUnlockNext();
            }}
            className="cf-btn cf-btn-success rounded-2xl px-4 py-3 text-sm font-semibold"
          >
            {nextChapter ? `Continue to Chapter ${nextChapter.order}` : "Finish Book"}
          </button>
          <button
            type="button"
            onClick={() => setShowQuizSuccessModal(false)}
            className="cf-btn cf-btn-secondary rounded-2xl px-4 py-3 text-sm font-semibold"
          >
            Stay here
          </button>
        </div>
      </InfoModal>

      {currentChapter ? (
        <div className="fixed bottom-20 left-4 right-4 z-50 lg:hidden">
          <button
            type="button"
            onClick={() => router.push(`/book/library/${encodeURIComponent(bookId)}/chapter/${encodeURIComponent(currentChapter.id)}`)}
            className="w-full rounded-2xl bg-linear-to-r from-(--cf-accent) to-(--cf-accent-strong) px-4 py-3 text-base font-semibold text-white shadow-[0_8px_24px_var(--cf-accent-shadow)]"
          >
            Continue Chapter {currentChapter.order} →
          </button>
        </div>
      ) : null}

      {toast ? (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-(--cf-border) bg-(--cf-surface-strong) px-3 py-2 text-sm text-(--cf-text-1) shadow-[0_14px_28px_rgba(0,0,0,0.22)]">
          {toast}
        </div>
      ) : null}

      {state.focusMode ? (
        <div className="pointer-events-none fixed bottom-6 right-6 hidden rounded-xl border border-(--cf-success-border) bg-(--cf-success-soft) px-3 py-1.5 text-xs text-(--cf-success-text) md:inline-flex md:items-center md:gap-1.5">
          <CheckCircle2 className="h-4 w-4" />
          Focus mode enabled
        </div>
      ) : (
        <div className="pointer-events-none fixed bottom-6 right-6 hidden rounded-xl border border-(--cf-border) bg-(--cf-surface-muted) px-3 py-1.5 text-xs text-(--cf-text-2) md:inline-flex md:items-center md:gap-1.5">
          <Sparkles className="h-4 w-4" />
          Tip: press N for notes, F for focus
        </div>
      )}
    </main>
  );
}
