"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BookLock, CheckCircle2, CloudOff, X } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import {
  getChapterById,
  type ChapterExample,
  type ReadingDepth,
} from "@/app/book/data/bookChapters";
import { BookClientError, fetchBookJson } from "@/app/book/_lib/book-api";
import {
  chapterStartModeToInitialTab,
} from "@/app/book/_lib/onboarding-personalization";
import { INSIGHT_POINTS_AMOUNTS } from "@/app/book/_lib/flow-points-economy";
import { createReviewItem, createFlashcardReviewItem } from "@/app/book/_lib/spaced-repetition";
import { getMotivationMessage } from "@/app/book/_lib/motivation-messages";
import { useOnboardingState } from "@/app/book/hooks/useOnboardingState";
import { useBookPreferences } from "@/app/book/hooks/useBookPreferences";
import { useKeyboardShortcut } from "@/app/book/hooks/useKeyboardShortcut";
import { ChapterHeader } from "@/app/book/library/[bookId]/chapter/[chapterId]/components/ChapterHeader";
import { AutoCollapsingHookBanner } from "@/app/book/library/[bookId]/chapter/[chapterId]/components/HookBanner";
import { TryThisNow } from "@/app/book/library/[bookId]/chapter/[chapterId]/components/TryThisNow";
import { MemorableLines } from "@/app/book/library/[bookId]/chapter/[chapterId]/components/MemorableLines";
import { ReadingDepthSwitch } from "@/app/book/library/[bookId]/chapter/[chapterId]/components/ReadingDepthSwitch";
import { V21_SCHEMA_VERSION } from "@/app/book/lib/v21-adapter";
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
import { AudioPlayer } from "@/app/book/library/[bookId]/chapter/[chapterId]/components/AudioPlayer";
import { AskBookDrawer } from "@/app/book/components/AskBookDrawer";
import { PracticePhase } from "@/app/book/library/[bookId]/chapter/[chapterId]/components/PracticePhase";
import { ChapterCompleteModal } from "@/app/book/library/[bookId]/chapter/[chapterId]/components/ChapterCompleteModal";
import { Confetti } from "@/components/ui/Confetti";
import { Dialog } from "@/components/ui/Dialog";
import { ChapterSkeleton } from "@/app/book/library/[bookId]/chapter/[chapterId]/components/ChapterSkeleton";
import { SessionModeOverlay } from "@/app/book/library/[bookId]/chapter/[chapterId]/components/SessionModeOverlay";
import { useChapterState, type ChapterTab, type FontScale } from "@/app/book/library/[bookId]/chapter/[chapterId]/hooks/useChapterState";
import { useChapterContent } from "@/app/book/library/[bookId]/chapter/[chapterId]/hooks/useChapterContent";
import { useQuizSession } from "@/app/book/library/[bookId]/chapter/[chapterId]/hooks/useQuizSession";
import { usePhaseCompletion, getPhaseThresholds } from "@/app/book/library/[bookId]/chapter/[chapterId]/hooks/usePhaseCompletion";
import { useBookProgress } from "@/app/book/library/hooks/useBookProgress";
import { useReadingSessionTracker } from "@/app/book/library/hooks/useReadingSessionTracker";
import type { LearningMode, ContentTone } from "@/app/book/settings/types/settings";
import { useBookViewer } from "@/app/book/hooks/useBookViewer";
import { buildShareCardUrl, buildShareText, performShare } from "@/app/book/_lib/share-card-url";
import type { LibraryBookDetail } from "@/app/book/_lib/library-data";

const SCENARIO_SUBMISSION_POINTS = INSIGHT_POINTS_AMOUNTS.scenarioApproved;

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

/** Compute overall chapter progress percentage based on current phase */
function computeProgressPercent(
  activeTab: ChapterTab,
  completedPhases: Set<ChapterTab>
): number {
  const phaseWeights: Record<ChapterTab, number> = {
    summary: 33,
    examples: 66,
    quiz: 100,
    practice: 100,
  };
  // If the current tab's phase is also completed, use its full weight
  if (completedPhases.has(activeTab)) return phaseWeights[activeTab];
  // Otherwise show partial progress within the current phase
  const phaseOrder: ChapterTab[] = ["summary", "examples", "quiz", "practice"];
  const currentIndex = phaseOrder.indexOf(activeTab);
  const prevWeight = currentIndex > 0 ? phaseWeights[phaseOrder[currentIndex - 1]] : 0;
  const currentWeight = phaseWeights[activeTab];
  // Show halfway through the current phase
  return prevWeight + Math.round((currentWeight - prevWeight) * 0.5);
}

export function ChapterReaderClient({
  bookId,
  chapterId,
  initialBook,
}: {
  bookId: string;
  chapterId: string;
  initialBook?: LibraryBookDetail;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const prefersReducedMotion = useReducedMotion();
  const { identity: viewerIdentity } = useBookViewer();
  const [notesOpen, setNotesOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [sessionMode, setSessionMode] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  // Quiz success modal removed: chapter completion now happens after Practice phase
  const [approvedUserExamples, setApprovedUserExamples] = useState<ChapterExample[]>([]);
  const [userSubmissions, setUserSubmissions] = useState<UserScenarioSubmission[]>([]);
  const [scenariosFetchFailed, setScenariosFetchFailed] = useState(false);
  const [scenariosRefetchKey, setScenariosRefetchKey] = useState(0);
  const [contentRefetchKey, setContentRefetchKey] = useState(0);
  const [engagementPoints, setEngagementPoints] = useState(0);
  const [bookAccessStatus, setBookAccessStatus] = useState<"loading" | "ready" | "blocked">(
    "loading"
  );
  const [bookAccessMessage, setBookAccessMessage] = useState<string | null>(null);
  const [paywallHit, setPaywallHit] = useState(false);

  // Phase transition interstitial state
  const [interstitial, setInterstitial] = useState<{
    from: ChapterTab;
    to: ChapterTab;
  } | null>(null);

  // Track scenario interactions for phase completion gating
  const [scenarioInteractions, setScenarioInteractions] = useState(0);

  // Content area ref for scroll tracking
  const contentRef = useRef<HTMLDivElement>(null);

  // Resolve learning mode and content tone from unified settings
  const { state: bookPrefs, patchSection: patchBookPrefs } = useBookPreferences();
  const learningMode = bookPrefs.extended.learningMode;
  const contentTone = bookPrefs.extended.contentTone;

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
  const preferredActiveTab: ChapterTab = bookPrefs.reading.defaultChapterTab || chapterStartModeToInitialTab(onboarding.chapterStartMode);
  const preferredExampleFilter = onboarding.preferredExampleContext;
  const preferredFocusMode = bookPrefs.reading.focusModeDefault;
  const preferredFontScale: FontScale = bookPrefs.reading.fontSize <= 14 ? "sm" : bookPrefs.reading.fontSize >= 18 ? "lg" : "md";

  // Title/author for headers/share — sourced from the published manifest.
  const entry = useMemo(
    () => ({ title: initialBook?.title ?? bookId, author: initialBook?.author ?? "" }),
    [initialBook, bookId],
  );
  // Chapter list (id/order/title) for navigation + progress — from the manifest.
  const chapters = useMemo(
    () =>
      (initialBook?.chapters ?? []).map((c) => ({
        id: c.chapterId,
        order: c.number,
        title: c.title,
      })),
    [initialBook],
  );
  // Translate the string chapterId (route param) → integer chapterNumber for
  // the content/quiz/state APIs, using the manifest.
  const chapterNumber = useMemo(
    () => initialBook?.chapters.find((c) => c.chapterId === chapterId)?.number,
    [initialBook, chapterId],
  );
  const bookMeta = useMemo(
    () => ({
      bookId,
      title: initialBook?.title,
      author: initialBook?.author,
      categories: initialBook?.categories,
      tags: initialBook?.tags,
    }),
    [bookId, initialBook],
  );
  const localFallback = useCallback(
    () => getChapterById(bookId, chapterId, contentTone),
    [bookId, chapterId, contentTone],
  );
  // Production content path: fetch from the API, adapt to the BookChapter UI
  // shape, fall back to the local package on any error (offline/dev/gated).
  const {
    chapter: baseChapter,
    hydrated: contentHydrated,
    source: contentSource,
    error: contentError,
    status: contentStatus,
  } = useChapterContent({
    bookId,
    chapterNumber,
    book: bookMeta,
    localFallback,
    refetchKey: contentRefetchKey,
  });
  // We're serving a cached/offline copy: the live fetch failed for a CONNECTIVITY
  // reason (network error → no HTTP status) and we fell back to the local
  // package. Surfaced as a non-blocking notice so the reader knows the content
  // may be stale (does NOT block reading). An access/gating error carries an HTTP
  // status (401/402/403/404) — that is NOT "offline", so we don't tell an online
  // user to "reconnect"; those paths are handled by the access guards above.
  const servingOfflineCopy =
    contentSource === "local" && contentError !== null && contentStatus === null;
  // Force the chapter's id to the manifest/route chapterId. The content payload
  // can carry a different internal chapterId (e.g. "ch02-identity-driven-change")
  // than the manifest ("atomic-habits-ch02"); progress/unlock state is keyed by
  // the manifest id, so the reader must use it for getChapterState/navigation.
  const chapter = useMemo(
    () => (baseChapter ? { ...baseChapter, id: chapterId } : undefined),
    [baseChapter, chapterId],
  );
  const preferredReadingDepth: ReadingDepth = baseChapter?.isStrictV12
    ? "standard"
    : mapLearningStyleToDepth(onboarding.learningStyle);

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
    markRecapSeen,
    toggleBookmarkedTakeaway,
    syncFailed,
  } = useChapterState(
    bookId,
    chapterId,
    baseChapter?.order,
    preferredReadingDepth,
    preferredActiveTab,
    preferredExampleFilter,
    preferredFocusMode,
    preferredFontScale
  );

  const chapterState = chapter ? getChapterState(chapter.id) : "locked";
  const isLocked = chapterState === "locked";

  const showQuiz = state.activeTab === "quiz";
  const activeDepth: ReadingDepth = chapter?.isStrictV12
    ? state.readingDepth
    : modeToDepth(learningMode);
  const quiz = useQuizSession({
    bookId,
    chapterNumber: chapter?.order ?? baseChapter?.order ?? 1,
    difficulty: activeDepth,
    contentTone,
    enabled:
      Boolean(chapter) &&
      onboardingHydrated &&
      hydrated &&
      chapterHydrated &&
      onboarding.setupComplete &&
      bookAccessStatus === "ready" &&
      !isLocked &&
      showQuiz,
    localQuiz: chapter
      ? {
          chapterId: chapter.id,
          questions: chapter.quizByDepth[activeDepth] ?? chapter.quiz,
          passingScorePercent: chapter.quizPassingScorePercent,
        }
      : undefined,
    retryIncorrectOnly: bookPrefs.learning.retryIncorrectOnly,
  });

  // Single source of truth for "the quiz has been passed": the live quiz
  // session. The legacy `state.quizResult` path was never written in the live
  // flow (setQuizResult is unused and the PATCH route stores it as null), so it
  // was always false; the previously persisted state never reflected reality.
  const quizPassed = quiz.session?.result?.passed === true;

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
    quizPassed,
  });

  // Wrapped setActiveTab that enforces gating and shows interstitial
  const setActiveTab = useCallback(
    (newTab: ChapterTab, options?: { skipInterstitial?: boolean }) => {
      const phaseOrder: ChapterTab[] = ["summary", "examples", "quiz", "practice"];
      const currentIndex = phaseOrder.indexOf(state.activeTab);
      const newIndex = phaseOrder.indexOf(newTab);

      if (newIndex > currentIndex) {
        // Forward navigation: mark current phase completed first (this
        // unlocks the next phase), then show the interstitial.
        phaseCompletion.markPhaseCompleted(state.activeTab);
        if (options?.skipInterstitial) {
          setActiveTabRaw(newTab);
          window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
        } else {
          setInterstitial({ from: state.activeTab, to: newTab });
        }
      } else {
        // Backward navigation: allowed only if the target was already
        // completed or all phases have been done once.
        if (!phaseCompletion.isPhaseAccessible(newTab)) return;
        setActiveTabRaw(newTab);
        window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
      }
    },
    [state.activeTab, setActiveTabRaw, phaseCompletion]
  );

  // The Practice tab is no longer reachable through the stepper. If a user
  // lands on it (persisted state, deep link), bounce them to the quiz so the
  // unified completion flow can take over.
  useEffect(() => {
    if (state.activeTab === "practice") {
      setActiveTabRaw("quiz");
    }
  }, [state.activeTab, setActiveTabRaw]);

  // Prefetch the next chapter route when user reaches Practice
  useEffect(() => {
    if (state.activeTab !== "practice") return;
    const list = chapters;
    const idx = list.findIndex((c) => c.id === chapterId);
    const next = idx >= 0 ? list[idx + 1] : undefined;
    if (!next) return;
    const nextRoute = `/book/library/${encodeURIComponent(bookId)}/chapter/${encodeURIComponent(next.id)}`;
    router.prefetch(nextRoute);
    if (sessionMode) router.prefetch(`${nextRoute}?session=1`);
  }, [state.activeTab, bookId, chapterId, chapters, router, sessionMode]);

  // Focus the first heading after a phase change
  useEffect(() => {
    if (!chapterHydrated) return;
    const heading = contentRef.current?.querySelector<HTMLElement>(
      "[data-phase-heading], h2, h1"
    );
    if (heading) {
      heading.setAttribute("tabindex", "-1");
      heading.focus({ preventScroll: true });
    }
  }, [state.activeTab, chapterHydrated]);

  const handleInterstitialComplete = useCallback(() => {
    if (interstitial) {
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
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
      setShowShortcuts((v) => !v);
    },
    { ignoreWhenTyping: true }
  );

  useEffect(() => {
    if (!onboardingHydrated) return;
    if (!onboarding.setupComplete) router.replace("/book");
  }, [onboarding.setupComplete, onboardingHydrated, router]);

  // Content-fetch failure no longer ejects to the library — when the fetch has
  // settled with no chapter we render an in-place error card (below) with a
  // retry, so the user keeps their place and gets an explanation.

  useEffect(() => {
    if (!chapter || !hydrated) return;
    if (getChapterState(chapter.id) !== "locked") {
      setLastReadChapter(chapter.id);
    }
  }, [chapter, hydrated, getChapterState, setLastReadChapter]);

  useEffect(() => {
    // NOTE: deliberately NOT gated on `chapter`. The /start access check only
    // needs bookId, and access status must resolve to ready/blocked even when
    // the chapter content fetch failed — otherwise the in-place content-error
    // card (which requires bookAccessStatus === "ready") is unreachable and the
    // reader spins on the skeleton forever.
    if (!entry || !onboardingHydrated || !onboarding.setupComplete) return;
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
      .catch((err) => {
        if (cancelled) return;
        if (
          err instanceof BookClientError &&
          (err.status === 402 || err.code === "paywall_book_limit")
        ) {
          setBookAccessStatus("blocked");
          setBookAccessMessage(
            "You\u2019ve reached your free book limit. Upgrade to Pro to unlock unlimited books."
          );
          setPaywallHit(true);
          return;
        }
        if (
          err instanceof BookClientError &&
          (err.code === "email_verification_required" ||
            err.code === "free_access_review_required")
        ) {
          setBookAccessStatus("blocked");
          setBookAccessMessage(
            err.code === "email_verification_required"
              ? "Please verify your email address to continue."
              : "Your access is under review. Please contact support if this persists."
          );
          return;
        }
        setBookAccessStatus("ready");
      });
    return () => {
      cancelled = true;
    };
  }, [bookId, entry, onboarding.setupComplete, onboardingHydrated]);

  useEffect(() => {
    if (!toast) return;
    // Content-aware dismiss: short confirmations clear quickly, but longer
    // decision-relevant messages (quiz-fail coaching + score, submit errors)
    // linger so they can actually be read.
    const isLong = toast.length > 40;
    const duration = isLong ? 5000 : 1800;
    const timeout = window.setTimeout(() => setToast(null), duration);
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
        setScenariosFetchFailed(false);
      })
      .catch(() => {
        if (!mounted) return;
        setApprovedUserExamples([]);
        setUserSubmissions([]);
        setScenariosFetchFailed(true);
      });
    return () => {
      mounted = false;
    };
  }, [bookId, chapter, scenariosRefetchKey]);

  const dailyGoalMinutes = bookPrefs.extended.dailyGoalPreset || 10;
  const readingSession = useReadingSessionTracker({
    bookId,
    chapterId,
    enabled:
      onboardingHydrated &&
      hydrated &&
      chapterHydrated &&
      onboarding.setupComplete &&
      bookAccessStatus === "ready" &&
      !isLocked &&
      bookPrefs.privacy.saveReadingHistory,
    dailyGoalMinutes,
  });

  // Daily goal celebration — show toast once when goal is first reached
  const dailyGoalCelebrated = useRef(false);
  useEffect(() => {
    if (readingSession.dailyGoalReached && !dailyGoalCelebrated.current) {
      dailyGoalCelebrated.current = true;
      const persona = bookPrefs.extended.motivationPersona || "coach";
      const msg = getMotivationMessage(persona, "daily_goal", { goal: dailyGoalMinutes });
      setToast(msg);
    }
  }, [readingSession.dailyGoalReached, dailyGoalMinutes, bookPrefs.extended.motivationPersona]);

  const [committedToChapter, setCommittedToChapter] = useState(false);

  const handleCommitment = useCallback(
    async (params: { bookId: string; chapterNumber: number; ifThenPlan: string; followUpDays: 3 | 7 }) => {
      try {
        await fetchBookJson("/app/api/book/me/commitments", {
          method: "POST",
          body: JSON.stringify(params),
        });
        setCommittedToChapter(true);
      } catch (err) {
        if (err instanceof BookClientError && err.status === 409) {
          setCommittedToChapter(true);
          return;
        }
        throw err;
      }
    },
    [],
  );

  // The content fetch has settled but there is genuinely no chapter to show
  // (e.g. the API failed and there's no local fallback). Render an in-place
  // error card instead of silently ejecting to the library — the user keeps
  // their URL and can retry. Must precede the skeleton guard, which also fires
  // on `!chapter` and would otherwise spin forever.
  if (
    onboardingHydrated &&
    onboarding.setupComplete &&
    bookAccessStatus === "ready" &&
    contentHydrated &&
    !chapter
  ) {
    return (
      <main className="relative min-h-screen overflow-x-hidden">
        <ChapterBackgroundOrbs />
        <section className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-4 py-10 sm:px-6">
          <div role="alert" className="w-full cr-glass-reading p-8 text-center">
            <CloudOff className="mx-auto h-10 w-10 text-(--cr-text-disabled)" />
            <h1 className="mt-4 text-3xl font-bold text-(--cr-text-heading)">
              Couldn&apos;t load this chapter
            </h1>
            <p className="mt-2 text-(--cr-text-secondary)">
              We hit a problem loading this chapter&apos;s content. Check your connection and try
              again.
            </p>
            <div className="mt-5 flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={() => setContentRefetchKey((k) => k + 1)}
                className="inline-flex min-h-11 items-center rounded-xl bg-(--cr-accent) px-5 py-2.5 text-sm font-semibold text-(--cr-text-inverse) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-(--cr-bg-root) focus-visible:ring-[color-mix(in_srgb,var(--cr-accent)_60%,transparent)]"
              >
                Try again
              </button>
              <Link
                href={`/book/library/${encodeURIComponent(bookId)}`}
                className="inline-flex min-h-11 items-center rounded-xl border border-(--cr-glass-border-teal) bg-(--cr-accent-muted) px-4 py-2 text-sm font-medium text-(--cr-accent)"
              >
                Back to book
              </Link>
            </div>
          </div>
        </section>
      </main>
    );
  }

  // Blocked access is a terminal state — show it BEFORE the skeleton guard so a
  // paywalled API-only book with no local fallback (chapter never loads) still
  // explains why instead of spinning on the skeleton forever.
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
            <div className="mt-5 flex flex-col items-center gap-3">
              {paywallHit && (
                <Link
                  href="/book/settings"
                  className="inline-flex rounded-xl px-5 py-2.5 text-sm font-semibold text-(--cr-text-inverse) bg-(--cr-accent)"
                >
                  Upgrade to Pro
                </Link>
              )}
              <Link
                href={`/book/library/${encodeURIComponent(bookId)}`}
                className="inline-flex rounded-xl border border-(--cr-glass-border-teal) bg-(--cr-accent-muted) px-4 py-2 text-sm font-medium text-(--cr-accent)"
              >
                Back to book
              </Link>
            </div>
          </div>
        </section>
      </main>
    );
  }

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
        <ChapterSkeleton />
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

  const isV21Chapter = chapter.schemaVersion === V21_SCHEMA_VERSION;

  const summaryBlocks = chapter.summaryByDepth[activeDepth] ?? chapter.summaryByDepth["standard"];
  const activeTakeaways = chapter.takeawaysByDepth[activeDepth] ?? chapter.takeaways;
  const activeRecap = chapter.recapByDepth[activeDepth] ?? [];
  const activeActivationPrompt = chapter.activationPromptByDepth[activeDepth] ?? chapter.activationPrompt;
  const activeSelfCheckPrompts =
    chapter.selfCheckPromptsByDepth[activeDepth] ?? chapter.selfCheckPrompts;
  const activeReflectionPrompts =
    chapter.reflectionPromptsByDepth[activeDepth] ?? chapter.reflectionPrompts;
  const activeClosingPrompt =
    chapter.closingPromptByDepth[activeDepth] ?? chapter.closingPrompt;
  const activePredictionPrompt =
    chapter.predictionPromptByDepth[activeDepth] ?? chapter.predictionPrompt;

  const examples = [...chapter.examplesDetailed, ...approvedUserExamples].filter((example) => {
    if (state.exampleFilter === "all") return true;
    return example.scope === state.exampleFilter;
  });

  // Font size, line height, and letter spacing are now controlled via CSS variables
  // on .cr-reading-content — no Tailwind class overrides needed.
  const textScaleClass = "";

  const handleSubmitQuiz = async () => {
    try {
      const submitResult = await quiz.submit();
      const nextSession = submitResult?.session ?? null;
      const persona = bookPrefs.extended.motivationPersona || "coach";
      if (nextSession?.result?.passed) {
        // Mark the phase done; the celebration is the single ChapterCompleteModal
        // surface, opened when the user taps "Continue to Practice" on the
        // ResultsScreen. No separate celebration overlay or achievement toasts.
        phaseCompletion.markPhaseCompleted("quiz");
      } else {
        setToast(getMotivationMessage(persona, "quiz_fail", { score: nextSession?.result?.scorePercent }));
      }

      // Enroll into spaced-repetition review queue (non-fatal if localStorage is full)
      try {
        if (nextSession?.questions) {
          for (const q of nextSession.questions) {
            if (q.isCorrect === false && q.correctChoiceId) {
              createReviewItem({
                chapterId,
                bookId,
                bookTitle: entry?.title ?? "",
                chapterTitle: chapter?.title ?? "",
                questionId: q.questionId,
                questionText: q.prompt,
                choices: q.choices,
                correctChoiceId: q.correctChoiceId,
                explanation: q.explanation ?? "",
              });
            }
          }
        }

        // Enroll chapter review cards (flashcards) on quiz pass
        if (nextSession?.result?.passed && chapter?.reviewCards) {
          for (const card of chapter.reviewCards) {
            createFlashcardReviewItem({
              chapterId,
              bookId,
              bookTitle: entry?.title ?? "",
              chapterTitle: chapter?.title ?? "",
              cardId: card.id,
              front: card.front,
              back: card.back,
              difficulty: card.difficulty,
            });
          }
        }
      } catch (enrollError) {
        console.warn("Failed to enroll items into spaced-repetition review:", enrollError);
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Unable to submit quiz right now.";
      setToast(message);
    }
  };

  // After quiz pass, we no longer push the user into a separate Practice
  // phase — the practice content is shown inside ChapterCompleteModal.
  const handleContinueToPractice = () => {
    phaseCompletion.markPhaseCompleted("quiz");
    phaseCompletion.markPhaseCompleted("practice");
    const score = quiz.session?.result?.scorePercent ?? 0;
    markChapterComplete(chapter.id, score);
    setShowCompleteModal(true);

    // §1.1 — Claim the loop-complete IP (deferred from quiz submit).
    // Fire-and-forget; idempotent server-side so retries are safe.
    fetchBookJson(
      `/app/api/book/me/chapters/${encodeURIComponent(bookId)}/${chapter.order}/unlock`,
      { method: "POST" }
    ).catch(() => {});
  };

  const handleChapterCompleteNext = () => {
    setShowCompleteModal(false);
    quiz.trackNextChapterClick();
    if (nextChapter) {
      const nextRoute = `/book/library/${encodeURIComponent(bookId)}/chapter/${encodeURIComponent(nextChapter.id)}`;
      router.push(sessionMode ? `${nextRoute}?session=1` : nextRoute);
      return;
    }
    router.push(`/book/library/${encodeURIComponent(bookId)}`);
  };

  const handleChapterCompleteLibrary = () => {
    setShowCompleteModal(false);
    router.push(`/book/library/${encodeURIComponent(bookId)}`);
  };

  const handleRetryQuiz = () => {
    void quiz.retry();
  };

  const handleSubmitScenario = async (draft: ScenarioSubmissionDraft) => {
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

    if (payload.submission.status === "rejected") {
      throw new Error(payload.submission.reviewNotes ?? "Did not meet quality criteria.");
    }

    if (payload.submission.status === "approved") {
      setEngagementPoints((prev) => Math.max(prev, payload.points));
      setToast(`Scenario approved! +${SCENARIO_SUBMISSION_POINTS} Insight Points earned.`);
    } else {
      setToast(`Scenario submitted for review. Approved submissions earn +${SCENARIO_SUBMISSION_POINTS} Insight Points.`);
    }
  };

  const showSummary = state.activeTab === "summary";
  const showExamples = state.activeTab === "examples";
  const progressPercent = computeProgressPercent(state.activeTab, phaseCompletion.completedPhases);

  return (
    <main className="relative min-h-screen overflow-x-hidden text-(--cr-text-primary)">
      <div role="status" aria-live="polite" className="sr-only">
        {state.activeTab === "summary" && "Now reading: Summary"}
        {state.activeTab === "examples" && "Now reading: Examples"}
        {state.activeTab === "quiz" && "Now taking: Quiz"}
        {state.activeTab === "practice" && "Now on: Practice"}
      </div>
      {!state.focusMode && <ChapterBackgroundOrbs />}

      {/* Floating audio surface — persists across ALL phases so playback,
       *  scrub position, speed, and the fetched buffer survive when you
       *  continue past Summary (it used to unmount and re-download). Hidden via
       *  CSS (display:none, NOT unmounted) in focus mode so the buffer is kept.
       *  Stacks ABOVE the Ask-the-book launcher with a safe-area-aware offset
       *  so the two FABs never collide at the bottom edge (incl. ≤390px). */}
      <div
        className={[
          // Mobile: dock full-width-with-gutters (left-4 right-4) so the expanded
          // card hugs the reading column edge-to-edge instead of overhanging the
          // prose. md+: revert to the right-anchored auto-width float (left-auto
          // cancels the mobile left edge), so desktop/tablet are unchanged.
          "pointer-events-none fixed left-4 right-4 z-50 md:left-auto md:right-6",
          "bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] md:bottom-[calc(env(safe-area-inset-bottom)+5rem)]",
          state.focusMode ? "hidden" : "",
        ].join(" ")}
      >
        <div className="pointer-events-auto md:ml-auto">
          <AudioPlayer
            bookId={bookId}
            chapterNumber={chapter.order}
            chapterTitle={`Chapter ${chapter.order}: ${chapter.title}`}
            tone={contentTone}
            variant={activeDepth === "simple" ? "easy" : activeDepth === "deeper" ? "hard" : "medium"}
          />
        </div>
      </div>


      <section
        className="w-full px-5 pb-12 pt-3 sm:px-8 sm:pt-3 md:pb-16"
      >
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
          onOpenNotes={() => setNotesOpen(true)}
          trackedMinutesToday={readingSession.todayTrackedMinutes}
          learningMode={learningMode}
          onChangeLearningMode={(mode) => {
            if (mode === learningMode) return;
            // Mode presets: each mode bundles a depth + tone so the content
            // actually changes when the user picks a different mode. Users
            // can still override depth/tone individually via the "Customize"
            // disclosure in the settings menu.
            const presets: Record<LearningMode, { depth: ReadingDepth; tone: ContentTone }> = {
              guided: { depth: "simple", tone: "gentle" },
              standard: { depth: "standard", tone: "gentle" },
              challenge: { depth: "deeper", tone: "competitive" },
            };
            const preset = presets[mode];
            patchBookPrefs("extended", {
              learningMode: mode,
              contentTone: preset.tone,
            });
            // readingDepth lives on per-chapter state (drives strict-v12 content)
            setReadingDepth(preset.depth);
            const messages: Record<string, string> = {
              guided: "Switched to Guided. More pacing support and feedback.",
              standard: "Switched to Standard. Balanced pacing and feedback.",
              challenge: "Switched to Challenge. Faster pace, fewer interruptions.",
            };
            setToast(messages[mode] ?? `Switched to ${mode}.`);
          }}
          contentTone={contentTone}
          onChangeContentTone={(tone) => {
            if (tone === contentTone) return;
            // Persist the preference (it still parameterizes the quiz endpoint's
            // tone) but show no "tone changed" toast: the live catalog is all
            // v21, whose prose is tone-invariant (a single canonical voice), so
            // the chapter text does not actually change. The old toast claimed
            // a prose change that never happened.
            patchBookPrefs("extended", { contentTone: tone });
          }}
          showProgressBar={bookPrefs.reading.showProgressBar}
          showEstimatedReadingTime={bookPrefs.reading.showEstimatedReadingTime}
          showReadingSessionTimer={bookPrefs.reading.showReadingSessionTimer}
          readingDepth={state.readingDepth}
          onChangeReadingDepth={setReadingDepth}
          showDepthSelector={chapter.isStrictV12}
          onOpenShortcuts={() => setShowShortcuts(true)}
          fontSize={bookPrefs.reading.fontSize}
          onChangeFontSize={(px) => patchBookPrefs("reading", { fontSize: px })}
          lineSpacing={bookPrefs.extended.lineSpacing}
          onChangeLineSpacing={(value) => patchBookPrefs("extended", { lineSpacing: value })}
          contentWidth={bookPrefs.reading.contentWidth}
          onChangeContentWidth={(px) => patchBookPrefs("reading", { contentWidth: px })}
        />

        {/* Hook banner: only on the Summary phase. Sits BELOW the chapter
         *  header (back nav + title) so the navbar gets visual primacy. The
         *  banner auto-collapses to a compact line once the reader has
         *  scrolled past the first viewport so it stops dominating the page. */}
        {isV21Chapter && chapter.hook && state.activeTab === "summary" ? (
          <div className="mt-4">
            <AutoCollapsingHookBanner
              hook={chapter.hook}
              counterintuition={chapter.counterintuition}
            />
          </div>
        ) : null}

        {/* 3-Phase Stepper — hidden in focus mode */}
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

        {/* Single hint above the fold so users know what unlocks "Continue".
         *  Comprehension-framed — we deliberately hide the raw time/scroll
         *  quota so the gate reads as "engage with the section", not a number
         *  to game. */}
        {!state.focusMode && state.activeTab !== "quiz" && !phaseCompletion.currentPhaseReady && (() => {
          const t = getPhaseThresholds(learningMode, state.activeTab);
          const seconds = t.minTime;
          const pct = Math.round(t.minScroll * 100);
          if (!seconds && !pct) return null;
          return (
            <p className="mt-4 text-[12px] text-(--cr-text-secondary)">
              Take a moment with this section — Continue unlocks once you&apos;ve read it.
              {state.activeTab === "examples" && learningMode === "challenge" && " Be sure to react to every scenario, too."}
            </p>
          );
        })()}

        {/* Non-blocking offline notice — reuses the quiz "saved locally"
         *  provisional banner styling. Reading is never blocked; this only
         *  tells the reader the content may be a stale cached copy. */}
        {servingOfflineCopy && (
          <p className="mt-4 flex items-center gap-1.5 text-[12px] text-(--cr-text-disabled)">
            <CloudOff className="h-3.5 w-3.5" />
            Showing an offline copy — reconnect for the latest.
          </p>
        )}

        {/* Content area — constrained to user's preferred reading width for comfortable line length */}
        <div
          ref={contentRef}
          className="mx-auto mt-4 space-y-5"
          style={{ maxWidth: `${bookPrefs.reading.contentWidth}px` }}
        >
          {showSummary && (
            <motion.div
              key={`summary-${state.readingDepth}`}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="space-y-4"
            >
              {isV21Chapter ? (
                <ReadingDepthSwitch
                  value={state.readingDepth}
                  onChange={setReadingDepth}
                />
              ) : null}
              <SummaryCard
                blocks={summaryBlocks}
                takeaways={activeTakeaways}
                recap={activeRecap}
                onSaveTakeaways={() => {
                  const hasBookmarks = state.bookmarkedTakeaways.length > 0;
                  const selected = hasBookmarks
                    ? activeTakeaways.filter((_, i) => state.bookmarkedTakeaways.includes(i))
                    : activeTakeaways;
                  appendNote(formatNoteWithTakeaways(selected));
                  setToast(hasBookmarks ? "Bookmarked takeaways saved to notes." : "Takeaways saved to notes.");
                }}
                bookmarkedTakeaways={new Set(state.bookmarkedTakeaways)}
                onToggleBookmarkTakeaway={(index) => {
                  const removing = state.bookmarkedTakeaways.includes(index);
                  toggleBookmarkedTakeaway(index);
                  setToast(removing ? "Bookmark removed." : "Takeaway bookmarked.");
                }}
                fontScaleClass={textScaleClass}
                learningMode={learningMode}
                activationPrompt={activeActivationPrompt}
                selfCheckPrompts={activeSelfCheckPrompts}
                reflectionPrompts={activeReflectionPrompts}
                closingPrompt={activeClosingPrompt}
                onRecapVisible={markRecapSeen}
                /* Audio is now a floating control rendered separately so it's
                 * accessible from anywhere in the chapter, not buried at the
                 * bottom of the SummaryCard footer. Save takeaways stays in
                 * the footer; audio lives bottom-right. */
              />
              {isV21Chapter ? <TryThisNow text={chapter.tryThisNow} /> : null}
              {isV21Chapter && chapter.memorableLines && chapter.memorableLines.length > 0 ? (
                <MemorableLines lines={chapter.memorableLines} />
              ) : null}
              <ContinueButton
                ready={phaseCompletion.currentPhaseReady}
                onClick={() => setActiveTab("examples")}
                readyText="Continue to Examples"
                scrollPercent={phaseCompletion.scrollPercent}
                timeOnPhase={phaseCompletion.timeOnPhase}
                {...getPhaseThresholds(learningMode, "summary")}
              />
            </motion.div>
          )}

          {showExamples && (
            <motion.div
              key={`examples-${activeDepth}`}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              <ExamplesList
                examples={examples}
                filter={state.exampleFilter}
                onFilterChange={setExampleFilter}
                submissionPoints={engagementPoints}
                mySubmissions={userSubmissions}
                onSubmitScenario={handleSubmitScenario}
                fontScaleClass={textScaleClass}
                readingDepth={activeDepth}
                onScenarioInteraction={() => setScenarioInteractions((prev) => prev + 1)}
                chapterId={chapterId}
                bookId={bookId}
                chapterNumber={chapter.order}
                chapterTitle={chapter.title}
                fetchFailed={scenariosFetchFailed}
                onRetryFetch={() => setScenariosRefetchKey((k) => k + 1)}
              />
              <ContinueButton
                ready={phaseCompletion.currentPhaseReady}
                onClick={() => setActiveTab("quiz")}
                readyText="Start the Quiz"
                scrollPercent={phaseCompletion.scrollPercent}
                timeOnPhase={phaseCompletion.timeOnPhase}
                {...getPhaseThresholds(learningMode, "examples")}
              />
            </motion.div>
          )}

          {showQuiz && (
            <motion.div
              key={`quiz-${activeDepth}`}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
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
              onContinueToPractice={handleContinueToPractice}
              onToggleExplanation={quiz.toggleExplanation}
              learningMode={learningMode}
              questionFlow={bookPrefs.learning.questionPresentationStyle}
              shuffleQuestions={chapter.isStrictV12 ? false : bookPrefs.learning.shuffleQuestionOrder}
              retryIncorrectOnly={bookPrefs.learning.retryIncorrectOnly}
            />
            {quiz.session?.provisional && (
              <p
                className="text-[12px] mt-2 flex items-center gap-1.5 text-(--cr-text-disabled)"
                role="status"
              >
                <span>{"\u23F3"}</span>
                Results saved locally — they&apos;ll sync and award points when you&apos;re back online.
              </p>
            )}
            </motion.div>
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
        onExport={() => {
          if (!state.notes.trim()) {
            setToast("No notes to export.");
            return;
          }
          const content = `# Notes: ${chapter.title}\n\n${state.notes}`;
          const blob = new Blob([content], { type: "text/markdown" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `notes-${chapterId}.md`;
          a.click();
          URL.revokeObjectURL(url);
          setToast("Notes exported.");
        }}
        onPinTakeaway={() => {
          appendNote(`Pinned takeaway: ${activeTakeaways[0] ?? ""}`);
          setToast("Takeaway pinned.");
        }}
      />

      {sessionMode && (
        <SessionModeOverlay onDone={handleSessionTourDone} />
      )}

      {/* One celebration confetti burst, fired at the page level (viewport-
       *  relative, reduced-motion-aware) the moment the quiz is passed. */}
      <Confetti
        trigger={quiz.session?.result?.passed === true}
        origin="center"
        colors={["--cr-accent", "--cr-success", "--cr-warning"]}
      />

      {/* Chapter complete — the single celebration surface (IP breakdown +
       *  achievements row + streak + practice handoff), built on the Wave-0
       *  Dialog (Escape / focus-trap / scroll-lock / closable back to chapter). */}
      {showCompleteModal && (
        <ChapterCompleteModal
          open={showCompleteModal}
          onClose={() => setShowCompleteModal(false)}
          chapterTitle={chapter.title}
          chapterNumber={chapter.order}
          quizScore={quiz.session?.result?.scorePercent ?? 0}
          loopPipeline={quiz.lastLoopPipeline}
          hasNextChapter={Boolean(nextChapter)}
          onNext={handleChapterCompleteNext}
          onLibrary={handleChapterCompleteLibrary}
          onShare={async () => {
            const isBookComplete = !nextChapter;
            const params = isBookComplete
              ? { type: "book" as const, bookTitle: entry?.title ?? bookId, author: entry?.author, userName: viewerIdentity.displayName }
              : { type: "chapter" as const, bookTitle: entry?.title ?? bookId, author: entry?.author, chapter: String(chapter.order), takeaway: chapter.keyTakeawayCard ?? "", userName: viewerIdentity.displayName };
            return performShare({
              title: isBookComplete ? `Finished ${entry?.title ?? bookId}` : `Chapter ${chapter.order} Complete`,
              text: buildShareText(params),
              url: buildShareCardUrl(params),
            });
          }}
        >
          <PracticePhase
            keyTakeawayCard={chapter.keyTakeawayCard}
            implementationPlan={chapter.implementationPlan}
            reviewCards={chapter.reviewCards}
            predictionPrompt={activePredictionPrompt}
            fontScaleClass={textScaleClass}
            onContinueToNextChapter={handleChapterCompleteNext}
            nextChapterLabel={nextChapter ? `Continue to Chapter ${nextChapter.order} \u2192` : "Finish Book \u2192"}
            bookmarkedTakeaways={
              state.bookmarkedTakeaways
                .filter((i) => i < activeTakeaways.length)
                .map((i) => activeTakeaways[i])
            }
            chapterId={chapterId}
            bookId={bookId}
            chapterNumber={chapter.order}
            onBookmarkStep={(text) => {
              appendNote(`\u2022 Step: ${text}`);
              setToast("Step saved to notes.");
            }}
            onCommit={handleCommitment}
            hasActiveCommitment={committedToChapter}
            hideContinueCta
          />
        </ChapterCompleteModal>
      )}

      {/* Keyboard shortcuts overlay \u2014 rendered through the shared Dialog so it
       *  gets a portal, focus trap, initial focus, focus restore, scroll lock,
       *  aria-modal and Escape/backdrop close for free (a11y launch gap fix). */}
      {showShortcuts && (
        <Dialog
          open={showShortcuts}
          onClose={() => setShowShortcuts(false)}
          size="sm"
          ariaLabel="Keyboard shortcuts"
        >
          <div className="p-6">
            <h3 className="text-[16px] font-semibold mb-4 text-(--cr-text-heading)">
              Keyboard Shortcuts
            </h3>
            <div className="space-y-3 text-[13px] text-(--cr-text-secondary)">
              {(
                [
                  ["1 \u2013 4", "Select quiz answer"],
                  ["Enter", "Submit answer"],
                  ["F", "Toggle focus mode"],
                  ["N", "Open notes"],
                  ["Esc", "Close drawers / overlays"],
                  ["?", "Show this overlay"],
                ] as const
              ).map(([key, desc]) => (
                <div key={key} className="flex items-center justify-between">
                  <span>{desc}</span>
                  <kbd
                    className="px-2 py-0.5 rounded text-[12px] font-mono bg-(--cr-bg-surface-3) border border-(--cr-glass-border) text-(--cr-text-heading)"
                  >
                    {key}
                  </kbd>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowShortcuts(false)}
              className="mt-5 w-full py-2 rounded-full text-[13px] bg-(--cr-bg-surface-3) text-(--cr-text-secondary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--cr-accent)_55%,transparent)]"
            >
              Close
            </button>
          </div>
        </Dialog>
      )}

      {/* Phase transition interstitial */}
      {interstitial && (
        <PhaseInterstitial
          from={interstitial.from}
          to={interstitial.to}
          onComplete={handleInterstitialComplete}
        />
      )}



      {/* Bottom-CENTER lane (sync pill above the toast) — kept clear of the
       *  bottom-right FAB column and padded for the iOS home indicator.
       *  Both surfaces are wrapped in a PERSISTENT live region (mounted at all
       *  times; text flows in via state) so screen readers announce mode/tone
       *  switches, bookmark/notes/step confirmations, daily-goal, quiz-fail
       *  coaching and the offline sync pill as they appear. */}
      <div role="status" aria-live="polite" aria-atomic="true">
        {syncFailed && !toast && (
          <div className="pointer-events-none fixed bottom-[calc(env(safe-area-inset-bottom)+5rem)] left-1/2 z-40 -translate-x-1/2 inline-flex items-center gap-1.5 rounded-xl border border-(--cr-warning)/30 bg-(--cr-warning)/10 px-3 py-2 text-xs text-(--cr-warning)">
            <CloudOff className="h-3.5 w-3.5" />
            Changes saved locally only
          </div>
        )}

        {toast && (
          <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+1.5rem)] left-1/2 z-50 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-start gap-2 rounded-xl border border-(--cr-glass-border) bg-(--cr-bg-surface-2) px-3 py-2 text-sm text-(--cr-text-primary) shadow-[0_14px_28px_rgba(0,0,0,0.22)]">
            <span>{toast}</span>
            <button
              type="button"
              onClick={() => setToast(null)}
              aria-label="Dismiss notification"
              className="-mr-1 -mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-(--cr-text-secondary) hover:text-(--cr-text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--cr-accent)_60%,transparent)]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Focus-mode indicator anchored bottom-LEFT so it never sits under the
       *  bottom-right FAB column (the Ask launcher stays visible in focus mode). */}
      {state.focusMode && (
        <div className="pointer-events-none fixed bottom-[calc(env(safe-area-inset-bottom)+1.5rem)] left-6 hidden rounded-xl border border-(--cr-success)/30 bg-(--cr-success-bg) px-3 py-1.5 text-xs text-(--cr-success) md:inline-flex md:items-center md:gap-1.5">
          <CheckCircle2 className="h-4 w-4" />
          Focus mode enabled
        </div>
      )}

      {/* Ask the Book — AI chat drawer */}
      <AskBookDrawer bookId={bookId} bookTitle={entry?.title ?? bookId} chapterNumber={chapter?.order} />
    </main>
  );
}
