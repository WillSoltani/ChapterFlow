"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BookLock, CheckCircle2, Sparkles } from "lucide-react";
import {
  getBookChaptersBundle,
  getChapterById,
  type ChapterExample,
  type ChapterQuizQuestion,
} from "@/app/book/data/mockChapters";
import { getLibraryBookById } from "@/app/book/data/mockUserLibraryState";
import { BookClientError, fetchBookJson } from "@/app/book/_lib/book-api";
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
import { useBookProgress } from "@/app/book/library/hooks/useBookProgress";
import { useReadingSessionTracker } from "@/app/book/library/hooks/useReadingSessionTracker";

const REQUIRED_SCORE = 80;
const BASE_COOLDOWN_SECONDS = 60;
const SCENARIO_SUBMISSION_POINTS = 25;

type QuizSessionQuestion = ChapterQuizQuestion & {
  displayOptions: [string, string, string, string];
  displayToCanonical: [number, number, number, number];
};

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

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function seededRandom(seed: number): () => number {
  let state = seed || 1;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function shuffle<T>(values: T[], rand: () => number): T[] {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rand() * (index + 1));
    const next = copy[index];
    copy[index] = copy[swapIndex];
    copy[swapIndex] = next;
  }
  return copy;
}

function buildQuizSession(
  bookId: string,
  chapterId: string,
  depth: "simple" | "standard" | "deeper",
  attemptNumber: number,
  baseQuestions: ChapterQuizQuestion[],
  retryPool: ChapterQuizQuestion[]
): QuizSessionQuestion[] {
  const targetCount = baseQuestions.length;
  const seed = hashString(`${bookId}:${chapterId}:${depth}:${attemptNumber}`);
  const rand = seededRandom(seed);
  const retrySwapCount =
    attemptNumber <= 0 ? 0 : Math.min(retryPool.length, Math.min(targetCount - 1, 2 + attemptNumber - 1));
  const baseKeepCount = Math.max(0, targetCount - retrySwapCount);

  const selectedBase = shuffle(baseQuestions, rand).slice(0, baseKeepCount);
  const selectedRetry = shuffle(retryPool, rand).slice(0, retrySwapCount);
  const chosen = shuffle([...selectedBase, ...selectedRetry], rand).slice(0, targetCount);

  return chosen.map((question) => {
    const shuffledCanonical = shuffle([0, 1, 2, 3], rand) as [number, number, number, number];
    const displayOptions = shuffledCanonical.map(
      (canonicalIndex) => question.options[canonicalIndex]
    ) as [string, string, string, string];
    return {
      ...question,
      displayOptions,
      displayToCanonical: shuffledCanonical,
    };
  });
}

function remainingCooldownSeconds(quizCooldownUntil: string | null): number {
  if (!quizCooldownUntil) return 0;
  const deltaMs = new Date(quizCooldownUntil).getTime() - Date.now();
  return Math.max(0, Math.ceil(deltaMs / 1000));
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
  const [quizSessionQuestions, setQuizSessionQuestions] = useState<QuizSessionQuestion[]>([]);
  const [approvedUserExamples, setApprovedUserExamples] = useState<ChapterExample[]>([]);
  const [userSubmissions, setUserSubmissions] = useState<UserScenarioSubmission[]>([]);
  const [engagementPoints, setEngagementPoints] = useState(0);

  const pauseSessionMode = () => {
    setSessionMode(false);
    router.replace(pathname);
  };

  const { state: onboarding, hydrated: onboardingHydrated } = useOnboardingState();

  const entry = useMemo(() => getLibraryBookById(bookId), [bookId]);
  const bundle = useMemo(() => getBookChaptersBundle(bookId), [bookId]);
  const chapters = bundle.chapters;
  const chapter = useMemo(() => getChapterById(bookId, chapterId), [bookId, chapterId]);

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
    setQuizAnswer,
    startQuizRetake,
    setQuizResult,
    setQuizFailureState,
    setNotes,
    appendNote,
    toggleFocusMode,
    setFontScale,
    toggleRecap,
    toggleExplanation,
  } = useChapterState(bookId, chapterId, chapter?.order);

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
    fetchBookJson(`/app/api/book/me/books/${encodeURIComponent(bookId)}/start`, {
      method: "POST",
    }).catch(() => {});
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
    const nextSession = buildQuizSession(
      bookId,
      chapter.id,
      state.readingDepth,
      state.quizRetakeCount,
      chapter.quizByDepth[state.readingDepth],
      chapter.quizRetryPool
    );
    setQuizSessionQuestions(nextSession);
  }, [
    bookId,
    chapter,
    state.readingDepth,
    state.quizRetakeCount,
  ]);

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
      !isLocked,
  });

  if (
    !entry ||
    !chapter ||
    !onboardingHydrated ||
    !hydrated ||
    !chapterHydrated ||
    !onboarding.setupComplete
  ) {
    return (
      <main className="relative min-h-screen text-slate-100">
        <div className="pointer-events-none absolute inset-0 -z-20 bg-[#050813]" />
        <div className="mx-auto flex min-h-screen items-center justify-center px-4 text-slate-300">
          Loading chapter...
        </div>
      </main>
    );
  }

  if (isLocked) {
    return (
      <main className="relative min-h-screen overflow-x-hidden text-slate-100">
        <div className="pointer-events-none absolute inset-0 -z-20 bg-[#050813]" />
        <section className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-4 py-10 sm:px-6">
          <div className="w-full rounded-[28px] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))] p-8 text-center shadow-[0_24px_60px_rgba(2,6,23,0.55)]">
            <BookLock className="mx-auto h-10 w-10 text-slate-300" />
            <h1 className="mt-4 text-3xl font-semibold text-slate-100">Chapter locked</h1>
            <p className="mt-2 text-slate-300">
              Pass the current chapter quiz to unlock this chapter.
            </p>
            <Link
              href={`/book/library/${encodeURIComponent(bookId)}`}
              className="mt-5 inline-flex rounded-xl border border-sky-300/35 bg-sky-500/14 px-4 py-2 text-sm font-medium text-sky-100"
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
  const baseQuizQuestions = chapter.quizByDepth[state.readingDepth];
  const quizQuestions =
    quizSessionQuestions.length === baseQuizQuestions.length
      ? quizSessionQuestions
      : baseQuizQuestions.map((question) => ({
          ...question,
          displayOptions: question.options,
          displayToCanonical: [0, 1, 2, 3],
        }));
  const quizDisplayQuestions: ChapterQuizQuestion[] = quizQuestions.map((question) => ({
    ...question,
    options: question.displayOptions,
    correctIndex: Math.max(
      0,
      question.displayToCanonical.indexOf(question.correctIndex)
    ),
  }));
  const requiredScore = Math.max(REQUIRED_SCORE, chapter.quizPassingScorePercent || REQUIRED_SCORE);
  const cooldownSeconds = remainingCooldownSeconds(state.quizCooldownUntil);

  const textScaleClass = fontScaleClass(state.fontScale);

  const handleSubmitQuiz = async () => {
    if (cooldownSeconds > 0) {
      const minutes = Math.ceil(cooldownSeconds / 60);
      setToast(`Retake locked for ${minutes} minute${minutes === 1 ? "" : "s"}.`);
      return;
    }

    try {
      const responses = quizQuestions.map((question) => {
        const selectedDisplayIndex = state.quizAnswers[question.id];
        const canonicalIndex =
          typeof selectedDisplayIndex === "number" &&
          selectedDisplayIndex >= 0 &&
          selectedDisplayIndex < question.displayToCanonical.length
            ? question.displayToCanonical[selectedDisplayIndex]
            : -1;
        return {
          questionId: question.id,
          selectedIndex: canonicalIndex,
        };
      });
      const result = await fetchBookJson<{
        scorePercent: number;
        passed: boolean;
        cooldownSeconds?: number;
        failureStreak?: number;
        nextAttemptAvailableAt?: string;
      }>(
        `/app/api/book/me/quiz/${encodeURIComponent(bookId)}/${chapter.order}/submit`,
        {
          method: "POST",
          body: JSON.stringify({ responses }),
        }
      );

      const nextResult = {
        score: result.scorePercent,
        passed: result.passed,
      };
      setQuizResult(nextResult);
      if (result.passed) {
        setQuizFailureState(0, null);
        markChapterComplete(chapter.id, result.scorePercent);
        setToast("Chapter unlocked.");
      } else {
        const failureStreak = Math.max(1, Math.floor(result.failureStreak ?? 1));
        const cooldownFromResult = Math.max(
          BASE_COOLDOWN_SECONDS,
          Math.floor(result.cooldownSeconds ?? BASE_COOLDOWN_SECONDS)
        );
        const fallbackUntil = new Date(
          Date.now() + cooldownFromResult * 1000
        ).toISOString();
        const cooldownUntil =
          typeof result.nextAttemptAvailableAt === "string" &&
          result.nextAttemptAvailableAt.trim()
            ? result.nextAttemptAvailableAt
            : fallbackUntil;
        setQuizFailureState(failureStreak, cooldownUntil);
        const minutes = Math.ceil(cooldownFromResult / 60);
        setToast(
          `Review the explanations and retry in ${minutes} minute${minutes === 1 ? "" : "s"}.`
        );
      }
    } catch (error: unknown) {
      if (error instanceof BookClientError && error.code === "attempt_cooldown") {
        const details =
          error.details && typeof error.details === "object"
            ? (error.details as {
                retryAfterSeconds?: number;
                nextAttemptAvailableAt?: string;
                failureStreak?: number;
              })
            : {};
        const retryAfter = Math.max(
          1,
          Math.floor(details.retryAfterSeconds ?? BASE_COOLDOWN_SECONDS)
        );
        const cooldownUntil =
          typeof details.nextAttemptAvailableAt === "string" &&
          details.nextAttemptAvailableAt.trim()
            ? details.nextAttemptAvailableAt
            : new Date(Date.now() + retryAfter * 1000).toISOString();
        setQuizFailureState(Math.max(1, Math.floor(details.failureStreak ?? 1)), cooldownUntil);
        const minutes = Math.ceil(retryAfter / 60);
        setToast(`Retake locked for ${minutes} minute${minutes === 1 ? "" : "s"}.`);
        return;
      }
      const message =
        error instanceof Error ? error.message : "Unable to submit quiz right now.";
      setToast(message);
    }
  };

  const handleUnlockNext = () => {
    if (nextChapter) {
      const nextRoute = `/book/library/${encodeURIComponent(bookId)}/chapter/${encodeURIComponent(nextChapter.id)}`;
      router.push(sessionMode ? `${nextRoute}?session=1` : nextRoute);
      return;
    }
    router.push(`/book/library/${encodeURIComponent(bookId)}`);
  };

  const handleRetryQuiz = () => {
    const retrySeconds = remainingCooldownSeconds(state.quizCooldownUntil);
    if (retrySeconds > 0) {
      const minutes = Math.ceil(retrySeconds / 60);
      setToast(`Retake locked for ${minutes} minute${minutes === 1 ? "" : "s"}.`);
      return;
    }
    startQuizRetake();
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
        `Scenario submitted for admin review. +${SCENARIO_SUBMISSION_POINTS} points earned.`
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
  const showQuiz = state.activeTab === "quiz";

  return (
    <main className="relative min-h-screen overflow-x-hidden text-slate-100">
      <div className="pointer-events-none absolute inset-0 -z-20 bg-[#050813]" />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(880px_circle_at_12%_-6%,rgba(56,189,248,0.12),transparent_58%),radial-gradient(780px_circle_at_100%_0%,rgba(2,132,199,0.08),transparent_60%)]" />

      <section
        className={[
          "mx-auto w-full px-4 pb-28 pt-4 sm:px-6 sm:pt-5 md:pb-24",
          state.focusMode ? "max-w-5xl" : "max-w-4xl",
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
              questions={quizDisplayQuestions}
              answers={state.quizAnswers}
              result={state.quizResult}
              explanationOpen={state.explanationOpen}
              requiredScore={requiredScore}
              cooldownSeconds={cooldownSeconds}
              failureStreak={state.quizFailureStreak}
              onAnswer={setQuizAnswer}
              onSubmit={handleSubmitQuiz}
              onReviewSummary={() => setActiveTab("summary")}
              onRetry={handleRetryQuiz}
              onUnlockNext={handleUnlockNext}
              onToggleExplanation={toggleExplanation}
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
        <SessionModeOverlay
          activeTab={state.activeTab}
          quizPassed={Boolean(state.quizResult?.passed)}
          onSelectStep={setActiveTab}
          onPause={pauseSessionMode}
          onClose={pauseSessionMode}
        />
      ) : null}

      {currentChapter ? (
        <div className="fixed bottom-20 left-4 right-4 z-50 lg:hidden">
          <button
            type="button"
            onClick={() => router.push(`/book/library/${encodeURIComponent(bookId)}/chapter/${encodeURIComponent(currentChapter.id)}`)}
            className="w-full rounded-2xl bg-linear-to-r from-sky-500 to-cyan-400 px-4 py-3 text-base font-semibold text-white shadow-[0_16px_35px_rgba(14,165,233,0.36)]"
          >
            Continue Chapter {currentChapter.order} →
          </button>
        </div>
      ) : null}

      {toast ? (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-white/18 bg-[#0b1120]/95 px-3 py-2 text-sm text-slate-100 shadow-[0_14px_28px_rgba(2,6,23,0.55)]">
          {toast}
        </div>
      ) : null}

      {state.focusMode ? (
        <div className="pointer-events-none fixed bottom-6 right-6 hidden rounded-xl border border-emerald-300/30 bg-emerald-500/12 px-3 py-1.5 text-xs text-emerald-200 md:inline-flex md:items-center md:gap-1.5">
          <CheckCircle2 className="h-4 w-4" />
          Focus mode enabled
        </div>
      ) : (
        <div className="pointer-events-none fixed bottom-6 right-6 hidden rounded-xl border border-white/20 bg-white/4 px-3 py-1.5 text-xs text-slate-300 md:inline-flex md:items-center md:gap-1.5">
          <Sparkles className="h-4 w-4" />
          Tip: press N for notes, F for focus
        </div>
      )}
    </main>
  );
}
