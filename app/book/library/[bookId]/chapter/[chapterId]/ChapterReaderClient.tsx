"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BookLock, CheckCircle2, CloudOff, Lightbulb, X } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { DUR, EASE } from "@/lib/motion";
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
import { useCommitments } from "@/app/book/hooks/useCommitments";
import { deriveChapterApplicationState } from "@/app/app/api/book/_lib/commitment-application-core";
import type { ChapterApplicationState } from "@/app/app/api/book/_lib/types";
import { useKeyboardShortcut } from "@/app/book/hooks/useKeyboardShortcut";
import { ChapterHeader } from "@/app/book/library/[bookId]/chapter/[chapterId]/components/ChapterHeader";
import { AutoCollapsingHookBanner } from "@/app/book/library/[bookId]/chapter/[chapterId]/components/HookBanner";
import { TryThisNow } from "@/app/book/library/[bookId]/chapter/[chapterId]/components/TryThisNow";
import { MemorableLines } from "@/app/book/library/[bookId]/chapter/[chapterId]/components/MemorableLines";
import { V21_SCHEMA_VERSION } from "@/app/book/lib/v21-adapter";
import { PhaseStepper } from "@/app/book/library/[bookId]/chapter/[chapterId]/components/PhaseStepper";
import { PhaseInterstitial } from "@/app/book/library/[bookId]/chapter/[chapterId]/components/PhaseInterstitial";
import { ChapterBackgroundOrbs } from "@/app/book/library/[bookId]/chapter/[chapterId]/components/ChapterBackgroundOrbs";
import { ContinueButton } from "@/app/book/library/[bookId]/chapter/[chapterId]/components/ContinueButton";
import {
  ExamplesList,
  DEFAULT_VISIBLE_EXAMPLES,
  type ScenarioSubmissionDraft,
  type UserScenarioSubmission,
} from "@/app/book/library/[bookId]/chapter/[chapterId]/components/ExamplesList";
import { trackReaderFunnel } from "@/app/book/_lib/reader-analytics";
import { NotesDrawer } from "@/app/book/library/[bookId]/chapter/[chapterId]/components/NotesDrawer";
import { QuizPanel } from "@/app/book/library/[bookId]/chapter/[chapterId]/components/QuizPanel";
import { SummaryCard } from "@/app/book/library/[bookId]/chapter/[chapterId]/components/SummaryCard";
import { AudioPlayer } from "@/app/book/library/[bookId]/chapter/[chapterId]/components/AudioPlayer";
import { AskBookDrawer } from "@/app/book/components/AskBookDrawer";
import { PracticePhase } from "@/app/book/library/[bookId]/chapter/[chapterId]/components/PracticePhase";
import { CommitmentPrompt } from "@/app/book/library/[bookId]/chapter/[chapterId]/components/CommitmentPrompt";
import { PatternSelector } from "@/app/book/library/[bookId]/chapter/[chapterId]/components/PatternSelector";
import type { V21ReaderPattern } from "@/app/book/lib/v21-adapter";
import { ChapterCompleteModal } from "@/app/book/library/[bookId]/chapter/[chapterId]/components/ChapterCompleteModal";
import { Confetti } from "@/components/ui/Confetti";
import { Dialog } from "@/components/ui/Dialog";
import { ChapterSkeleton } from "@/app/book/library/[bookId]/chapter/[chapterId]/components/ChapterSkeleton";
import { SessionModeOverlay } from "@/app/book/library/[bookId]/chapter/[chapterId]/components/SessionModeOverlay";
import { useChapterState, type ChapterTab, type FontScale } from "@/app/book/library/[bookId]/chapter/[chapterId]/hooks/useChapterState";
import { useChapterContent } from "@/app/book/library/[bookId]/chapter/[chapterId]/hooks/useChapterContent";
import { useQuizSession } from "@/app/book/library/[bookId]/chapter/[chapterId]/hooks/useQuizSession";
import { needsReconcile, reconcileProvisionalPass } from "@/app/book/library/[bookId]/chapter/[chapterId]/lib/quizReconcile";
import { emitBookStorageChanged } from "@/app/book/hooks/bookStorageEvents";
import { usePhaseCompletion, getPhaseThresholds } from "@/app/book/library/[bookId]/chapter/[chapterId]/hooks/usePhaseCompletion";
import { useBreakReminder } from "@/app/book/library/[bookId]/chapter/[chapterId]/hooks/useBreakReminder";
import { useBookProgress } from "@/app/book/library/hooks/useBookProgress";
import { useReadingSessionTracker } from "@/app/book/library/hooks/useReadingSessionTracker";
import type { LearningMode, ContentTone } from "@/app/book/settings/types/settings";
import { useBookViewer } from "@/app/book/hooks/useBookViewer";
import { buildShareCardUrl, buildShareText, performShare } from "@/app/book/_lib/share-card-url";
import type { LibraryBookDetail } from "@/app/book/_lib/library-data";
import { TRIAL_CTA_LABEL, UPGRADE_RETURN_PATH, MONTHLY_PRICE_WITH_CURRENCY, PRICING } from "@/lib/pricing";

const SCENARIO_SUBMISSION_POINTS = INSIGHT_POINTS_AMOUNTS.scenarioApproved;

/** Dismiss-once flag for the first-chapter Summary/Examples/Quiz loop coachmark. */
const READER_LOOP_COACHMARK_KEY = "cf-reader-loop-coachmark-seen:v1";

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
  // First-real-chapter coachmark explaining the Summary/Examples/Quiz loop +
  // the READ time tiers. Shown once (chapter 1 only), then never again.
  const [showLoopCoachmark, setShowLoopCoachmark] = useState(false);

  // Phase transition interstitial state
  const [interstitial, setInterstitial] = useState<{
    from: ChapterTab;
    to: ChapterTab;
  } | null>(null);

  // Track scenario interactions for phase completion gating
  const [scenarioInteractions, setScenarioInteractions] = useState(0);

  // Content area ref for scroll tracking
  const contentRef = useRef<HTMLDivElement>(null);

  // §7 funnel timing/reach signals (refs, not state — no re-render churn).
  // Declared up here because the setActiveTab wrapper (below) reads them.
  const readerOpenedAtRef = useRef<number | null>(null);
  const firstActionFiredRef = useRef(false);
  const commitmentReachedFiredRef = useRef(false);

  // Resolve learning mode and content tone from unified settings
  const { state: bookPrefs, patchSection: patchBookPrefs, hydrated: bookPrefsHydrated } = useBookPreferences();
  const learningMode = bookPrefs.extended.learningMode;
  const contentTone = bookPrefs.extended.contentTone;
  // First-visit short path: a reader who hasn't customized their learning profile
  // starts on Fast (simple depth → the shortest existing quiz, 5 questions). Any
  // saved preference is respected (profileCustomized flips this off). Gated on
  // hydration so a same-device returning/customized reader (localStorage prefs)
  // never flips. NOTE: since RF-2, activeDepth reads this flag for ALL chapters
  // (defaultToFastPath ? "simple" : modeToDepth(learningMode)), so on a fresh
  // device whose newer settings arrive only via the async server-settings load,
  // a customized reader can paint Fast first and then do a one-time content
  // reconcile to their mode's depth once profileCustomized resolves true.
  // Per the owner decision, this lightens the DEFAULT path only — it does NOT change
  // the server-resolved pass threshold or any global setting.
  const defaultToFastPath = bookPrefsHydrated && !bookPrefs.extended.profileCustomized;

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
    ? (defaultToFastPath ? "simple" : "standard")
    : mapLearningStyleToDepth(onboarding.learningStyle);

  const {
    hydrated,
    currentChapter,
    getChapterState,
    setLastReadChapter,
    markChapterComplete,
  } = useBookProgress(bookId, chapters);

  // First-chapter loop coachmark: show once on chapter 1 only, gated on a
  // localStorage seen-flag (client-only state — no prod write).
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
  // RF-2 / D8: learning mode is the single lever that drives content depth.
  // A fresh, un-customized reader stays on the Fast short-path ("simple"); once
  // they pick a mode it maps guided→simple, standard→standard, challenge→deeper.
  // (Previously strict-v21 books read state.readingDepth instead, which let a
  // separate explicit depth switch diverge from the chosen mode — the duplicate
  // control this fix removes.) Note the possible values are unchanged, so every
  // *ByDepth surface keeps rendering exactly as before; only the source changes.
  const activeDepth: ReadingDepth = defaultToFastPath
    ? "simple"
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

  // Examples shown for the active scope filter. The reader collapses to the first
  // one (DEFAULT_VISIBLE_EXAMPLES) by default and discloses the rest behind
  // "Show more"; computed once here so the phase gate and the rendered list agree.
  const filteredExamples = useMemo(
    () =>
      [...(chapter?.examplesDetailed ?? []), ...approvedUserExamples].filter(
        (example) => state.exampleFilter === "all" || example.scope === state.exampleFilter,
      ),
    [chapter, approvedUserExamples, state.exampleFilter],
  );
  // Challenge-mode examples gate targets only the DEFAULT-VISIBLE count, so
  // expanding "Show more" is never required to advance, and a filtered-empty
  // scope (0 examples) can't strand the gate (0 >= 0 passes).
  const totalScenarios = Math.min(filteredExamples.length, DEFAULT_VISIBLE_EXAMPLES);

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

  // §1.1 — Claim the loop-complete IP (deferred from quiz submit). Idempotent
  // server-side (grant key), so re-firing is safe. Defined here (above the
  // render guards) so it is a hook-order-stable reference for both the
  // "Continue to Practice" handler and the RF-4 reconcile effect below. The
  // null-order guard is purely defensive — both callers run only after a real
  // session exists (chapter resolved) — so a future caller can't POST `.../
  // undefined/unlock`.
  const claimLoopCompleteIP = useCallback(() => {
    const order = chapter?.order;
    if (order == null) return Promise.resolve();
    return fetchBookJson(
      `/app/api/book/me/chapters/${encodeURIComponent(bookId)}/${order}/unlock`,
      { method: "POST" }
    );
  }, [bookId, chapter?.order]);

  // ── RF-4 (D5 celebrate-then-reconcile): reconcile an offline quiz pass ──────
  // A pass graded while `/submit` was unreachable is shown optimistically
  // (chapter complete + next unlocked + celebration) but never reached the
  // server — no Insight Points / streak / tier / achievements, no entitlement
  // advance. While the reader stays open, re-submit the provisional pass when
  // connectivity returns (the server records it, advancing entitlement +
  // awarding the loop pipeline that drives the modal's IP breakdown), then claim
  // the deferred loop-complete IP, then confirm to the reader so it never reads
  // as lost. Scope: in-session only — the `provisional` flag is in-memory, so a
  // tab closed/reloaded before reconnecting is reconciled by an app-level
  // pending-pass reconciler (follow-up), not here. See lib/quizReconcile.ts.
  const reconcileInFlightRef = useRef(false);
  const reconcileKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!needsReconcile(quiz.session)) return;
    const attemptKey = `${chapterId}:${quiz.session?.attemptNumber}`;
    let active = true;

    const run = async () => {
      if (reconcileInFlightRef.current) return;
      reconcileInFlightRef.current = true;
      try {
        const outcome = await reconcileProvisionalPass({
          isOnline: () => typeof navigator === "undefined" || navigator.onLine,
          submit: quiz.submit,
          claimLoopCompleteIP,
        });
        if (outcome === "confirmed") {
          // submit() already emits on a pipeline-bearing success; emit again so
          // the navbar balance also refreshes on the rare path where the first
          // submit reached the server and only its RESPONSE was lost (the
          // resubmit then returns no pipeline, so it wouldn't emit). Harmless
          // double-emit otherwise — the listener just refetches.
          emitBookStorageChanged("insight-points");
          if (active) {
            setToast("Back online — your results synced and your points were awarded.");
          }
        }
      } finally {
        reconcileInFlightRef.current = false;
      }
    };

    // One eager attempt per provisional attempt (covers a transient failure that
    // happened while already online). After that only a genuine reconnect
    // retries, so a server that keeps rejecting can't spin a retry loop.
    if (reconcileKeyRef.current !== attemptKey) {
      reconcileKeyRef.current = attemptKey;
      void run();
    }
    const onOnline = () => {
      reconcileKeyRef.current = attemptKey;
      void run();
    };
    window.addEventListener("online", onOnline);
    return () => {
      active = false;
      window.removeEventListener("online", onOnline);
    };
  }, [quiz.session, quiz.submit, chapterId, claimLoopCompleteIP]);

  // Wrapped setActiveTab that enforces gating and shows interstitial
  const setActiveTab = useCallback(
    (newTab: ChapterTab, options?: { skipInterstitial?: boolean }) => {
      const phaseOrder: ChapterTab[] = ["summary", "examples", "quiz", "practice"];
      const currentIndex = phaseOrder.indexOf(state.activeTab);
      const newIndex = phaseOrder.indexOf(newTab);

      if (newIndex > currentIndex) {
        // time-to-first-action: the reader's FIRST forward navigation (a genuine
        // user action). Fired here, not in an effect, so a hydration-driven tab
        // restore (practical-first start tab, or a returning reader's persisted
        // tab) never counts as an action and biases the metric toward ~0ms.
        if (!firstActionFiredRef.current && readerOpenedAtRef.current !== null) {
          firstActionFiredRef.current = true;
          trackReaderFunnel("time_to_first_action", {
            bookId,
            chapterNumber: chapter?.order,
            msToFirstAction: Date.now() - readerOpenedAtRef.current,
          });
        }
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
    [state.activeTab, setActiveTabRaw, phaseCompletion, bookId, chapter]
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
        // Deliberate FAIL-OPEN (availability-first): a non-paywall /start error
        // (500 / timeout / offline) resolves to "ready" so a transient backend
        // hiccup doesn't lock a legitimate reader out mid-session. Accepted
        // posture per owner decision D5 (docs/audit-fixes/02-DECISIONS.md →
        // AUTH-4) — intentionally NOT a hold-until-verified gate. The clean 402 /
        // email-verification / review branches above still block correctly.
        //
        // The leak is bounded and grants NO server-recorded benefit:
        //   - Gated SERVER content stays enforced: GET .../chapters/[n] re-runs
        //     ensureUserBookStarted() and 402s a paywalled-out user, so "ready"
        //     can only fall back to LOCAL bundle prose/examples
        //     (useChapterContent.ts), never to server-gated content.
        //   - Completion / IP / streak / unlock all flow through endpoints that
        //     independently re-check entitlement (quiz /submit, chapter /state,
        //     /unlock -> ensureUserBookStarted -> 402), so nothing is recorded
        //     for a book the user isn't entitled to. A bundled quiz grades
        //     locally only (provisional, never auto-synced).
        // So a transient outage can at most re-show already-bundled reading
        // material; it cannot unlock, grade, or pay out anything server-side.
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

  // Break reminders (SET-4) — the settings toggle promises "a gentle reminder to
  // rest your eyes during long reading sessions". This is the in-session consumer
  // of `extended.breakReminders` / `breakReminderMinutes`. It fires once per
  // interval of *engaged* reading (idle/backgrounded/mid-quiz time does not
  // count), never on the quiz tab, via the same non-animated toast lane as the
  // daily-goal nudge — so it inherently respects reduced motion (no animation).
  useBreakReminder({
    enabled:
      bookPrefs.extended.breakReminders &&
      onboardingHydrated &&
      hydrated &&
      chapterHydrated &&
      onboarding.setupComplete &&
      bookAccessStatus === "ready" &&
      !isLocked,
    intervalMinutes: bookPrefs.extended.breakReminderMinutes,
    paused: showQuiz,
    onBreak: () => setToast("Time for a quick break — rest your eyes for a moment."),
  });

  const [committedToChapter, setCommittedToChapter] = useState(false);

  // Hydrate the committed state from the server. Without this, `committedToChapter`
  // resets to false on every mount/navigation, so a commitment made in a prior
  // session (or before a mid-chapter reload) would not be reflected and the prompt
  // would invite the user to re-commit (→ a 409 on submit). Keyed on chapter.order
  // so navigating between chapters re-resolves the flag from server truth.
  const commitmentsEnabled = Boolean(chapterNumber) && Boolean(viewerIdentity?.sub);
  const {
    commitments,
    activeCommitments,
    loading: commitmentsLoading,
    refresh: refreshCommitments,
  } = useCommitments(commitmentsEnabled);
  // The active commitment for THIS chapter (if any), so the elevated prompt's
  // "Committed" view can show the real follow-up window, not the local default.
  const activeChapterCommitment = chapter
    ? activeCommitments.find(
        (c) => c.bookId === bookId && c.chapterNumber === chapter.order && c.status === "active",
      )
    : undefined;
  // Two-axis completion (feedback #4): the current chapter's DERIVED application
  // state, read from the FULL live commitment list so it is correct under either
  // ordering — commit-in-modal (today) or commit-before-quiz (Phase 2). Drives the
  // celebration's "Learned / Applied" framing only; it gates nothing and awards no
  // IP. `applied` essentially never shows at first-pass modal time (follow-through
  // happens days later) — it surfaces on re-entry and in the library.
  const chapterApplicationState: ChapterApplicationState = chapter
    ? deriveChapterApplicationState(commitments, bookId, chapter.order)
    : "none";
  // Whether the modal's CommitmentPrompt (rendered in children) will actually show —
  // it's gated on the chapter having if-then plans. Drives whether the celebration's
  // "none" invitation appears (don't say "commit below" when nothing is below).
  const commitmentAvailable = Boolean(
    chapter?.implementationPlan?.ifThenPlans?.length,
  );
  useEffect(() => {
    if (!chapter) return;
    const hasActive = activeCommitments.some(
      (c) => c.bookId === bookId && c.chapterNumber === chapter.order && c.status === "active",
    );
    setCommittedToChapter(hasActive);
  }, [bookId, chapter, activeCommitments]);

  const handleCommitment = useCallback(
    async (params: { bookId: string; chapterNumber: number; ifThenPlan: string; followUpDays: 3 | 7 }) => {
      try {
        await fetchBookJson("/app/api/book/me/commitments", {
          method: "POST",
          body: JSON.stringify(params),
        });
        setCommittedToChapter(true);
        // Re-pull server truth so the hydration effect (and any other reader of
        // activeCommitments) reflects the new commitment, not just local state.
        void refreshCommitments();
      } catch (err) {
        if (err instanceof BookClientError && err.status === 409) {
          setCommittedToChapter(true);
          void refreshCommitments();
          return;
        }
        throw err;
      }
    },
    [refreshCommitments],
  );

  // §7 funnel timing/reach signals (refs declared up near contentRef). Analytics-
  // only effects (no setState), so no churn. time_to_first_action is fired from the
  // setActiveTab user-action path, not here, so a hydration-driven tab restore
  // can't bias it.
  useEffect(() => {
    if (chapter && readerOpenedAtRef.current === null) {
      readerOpenedAtRef.current = Date.now();
    }
  }, [chapter]);
  // commitment_reached: the examples phase (where the commitment is surfaced) is shown.
  useEffect(() => {
    if (
      state.activeTab === "examples" &&
      chapter?.implementationPlan?.ifThenPlans?.length &&
      !commitmentReachedFiredRef.current
    ) {
      commitmentReachedFiredRef.current = true;
      trackReaderFunnel("commitment_reached", { bookId, chapterNumber: chapter.order });
    }
  }, [state.activeTab, chapter, bookId]);

  // ── Reader-pattern personalization (Phase 3, RDRP) ───────────────────────
  // Net-new + gated. PatternSelector only renders when the env flag is on AND a
  // chapter actually carries readerPatterns (none do yet → dark by default).
  const patternSelectorEnabled =
    process.env.NEXT_PUBLIC_BOOK_ENABLE_PATTERN_SELECTOR === "1" ||
    process.env.NEXT_PUBLIC_BOOK_ENABLE_PATTERN_SELECTOR === "true";
  const readerPatterns = chapter?.experiencePlan?.behaviorLoop?.readerPatterns ?? [];
  const [selectedPatternId, setSelectedPatternId] = useState<string | null>(null);
  const [pinnedExampleId, setPinnedExampleId] = useState<string | null>(null);
  const [planFromPattern, setPlanFromPattern] = useState<string | null>(null);

  const handlePatternPick = useCallback(
    (pattern: V21ReaderPattern) => {
      setSelectedPatternId(pattern.id);
      // Route the recommended example. mapsToExampleIndex is 0-based into the
      // UNFILTERED authored examples (chapter.examplesDetailed), so resolve there;
      // out-of-range / missing → no pin (the default first example shows).
      const authored = chapter?.examplesDetailed ?? [];
      const exIdx = pattern.mapsToExampleIndex;
      if (exIdx !== undefined && exIdx >= 0 && exIdx < authored.length) {
        setPinnedExampleId(authored[exIdx].id);
        // Never let the active scope filter hide the routed example.
        if (state.exampleFilter !== "all") setExampleFilter("all");
      } else {
        if (exIdx !== undefined) console.warn(`[PatternSelector] mapsToExampleIndex ${exIdx} out of range; showing the default example`);
        setPinnedExampleId(null);
      }
      // Pre-select the matching commitment plan (0-based into ifThenPlans);
      // out-of-range / missing → no pre-fill (all plans remain selectable).
      const plans = chapter?.implementationPlan?.ifThenPlans ?? [];
      const planIdx = pattern.mapsToPlanIndex;
      if (planIdx !== undefined && planIdx >= 0 && planIdx < plans.length) {
        setPlanFromPattern(plans[planIdx].plan);
      } else {
        if (planIdx !== undefined) console.warn(`[PatternSelector] mapsToPlanIndex ${planIdx} out of range; leaving plans unselected`);
        setPlanFromPattern(null);
      }
      trackReaderFunnel("pattern_picked", { bookId, chapterNumber: chapter?.order, patternId: pattern.id });
    },
    [chapter, state.exampleFilter, setExampleFilter, bookId],
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
            {paywallHit ? (
              // Real paywall at the highest-intent moment: lead with value +
              // price + the free trial (cyan = "doing the work" / primary CTA,
              // NOT gold). Price/trial figures come from lib/pricing.ts so the
              // wall stays in sync with the landing + settings billing copy.
              <>
                <h1 className="mt-4 text-3xl font-bold text-(--cr-text-heading)">
                  Unlimited books for {MONTHLY_PRICE_WITH_CURRENCY}/mo
                </h1>
                <p className="mt-1 text-sm text-(--cr-text-secondary)">
                  That&rsquo;s about ${(PRICING.monthlyAmount / 30).toFixed(2)} a day — and the
                  first {PRICING.trialDays} days are free. Cancel anytime.
                </p>
                {/* Benefits mirror the canonical Pro differentiators advertised
                 *  on the landing Pricing card (components/sections/Pricing.tsx:
                 *  proFeatures) + the genuinely Pro-gated audio route (free is
                 *  capped at 2 books / Lite+Standard depth). Every claim is a real
                 *  Pro unlock — no aspirational copy. */}
                <ul className="mx-auto mt-5 max-w-sm space-y-2 text-left">
                  {[
                    "Unlimited books — read every title in the library",
                    "Deeper depth mode on every chapter",
                    "Text-to-speech audio for hands-free reading",
                    "Priority requests for new titles",
                  ].map((benefit) => (
                    <li
                      key={benefit}
                      className="flex items-start gap-2 text-sm text-(--cr-text-secondary)"
                    >
                      <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-(--cr-accent)" />
                      <span>{benefit}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-6 flex flex-col items-center gap-3">
                  <Link
                    href={UPGRADE_RETURN_PATH}
                    className="inline-flex min-h-11 items-center rounded-xl bg-(--cr-accent) px-5 py-2.5 text-sm font-semibold text-(--cr-text-inverse) transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-(--cr-bg-root) focus-visible:ring-[color-mix(in_srgb,var(--cr-accent)_60%,transparent)]"
                  >
                    {TRIAL_CTA_LABEL}
                  </Link>
                  <Link
                    href={`/book/library/${encodeURIComponent(bookId)}`}
                    className="inline-flex rounded-xl border border-(--cr-glass-border-teal) bg-(--cr-accent-active) px-4 py-2 text-sm font-medium text-(--cr-accent)"
                  >
                    Back to book
                  </Link>
                </div>
              </>
            ) : (
              // Non-paywall block (transient access error): keep the original
              // copy + the quiet secondary "Back to book" (matches the sibling
              // load-error / chapter-lock terminal screens).
              <>
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
              </>
            )}
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

  // The same filtered set the gate is computed from (see filteredExamples above).
  const examples = filteredExamples;

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

    // §1.1 — Fire-and-forget; idempotent server-side so retries are safe. When
    // this POST is made offline (a provisional pass), it is lost — the RF-4
    // reconcile re-claims it on reconnect after the resubmit records the pass.
    claimLoopCompleteIP().catch(() => {});
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
            // RF-2 / D8: learning mode is the single content-depth lever (no
            // separate depth switch). Picking a mode marks the profile customized
            // (so it escapes the Fast short-path default) and maps to a content
            // depth via modeToDepth — guided→simple, standard→standard,
            // challenge→deeper — which `activeDepth` reads directly. We also keep
            // the per-chapter readingDepth and the stored contentTone in sync: the
            // quiz/audio endpoints still read tone, and useChapterState persists/
            // merges readingDepth (tone is no longer a user control — the live v21
            // catalog is tone-invariant, a single canonical voice).
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
            const messages: Record<string, string> = {
              guided: "Switched to Guided. Shorter summaries, more pacing support.",
              standard: "Switched to Standard. Balanced depth and pacing.",
              challenge: "Switched to Challenge. Deeper summaries, faster pace.",
            };
            setToast(messages[mode] ?? `Switched to ${mode}.`);
          }}
          showProgressBar={bookPrefs.reading.showProgressBar}
          showEstimatedReadingTime={bookPrefs.reading.showEstimatedReadingTime}
          showReadingSessionTimer={bookPrefs.reading.showReadingSessionTimer}
          readingDepth={state.readingDepth}
          onChangeReadingDepth={setReadingDepth}
          // RF-2 / D8: depth is driven by learning mode now, so the separate
          // gear-menu depth selector is the duplicate control we remove. The
          // Learning Mode switch above is the single depth lever.
          showDepthSelector={false}
          onOpenShortcuts={() => setShowShortcuts(true)}
          fontSize={bookPrefs.reading.fontSize}
          onChangeFontSize={(px) => patchBookPrefs("reading", { fontSize: px })}
          lineSpacing={bookPrefs.extended.lineSpacing}
          onChangeLineSpacing={(value) => patchBookPrefs("extended", { lineSpacing: value })}
          contentWidth={bookPrefs.reading.contentWidth}
          onChangeContentWidth={(px) => patchBookPrefs("reading", { contentWidth: px })}
          fontFamily={bookPrefs.extended.fontFamily}
          onChangeFontFamily={(value) => patchBookPrefs("extended", { fontFamily: value })}
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

        {/* First-chapter loop coachmark — one-time, dismiss-once (chapter 1 only).
         *  Explains the Summary → Examples → Quiz loop + how the learning mode sets
         *  the detail level, the way Apple Books / Headspace introduce a novel
         *  reading mechanic with a single first-use hint. Ties to the cyan "work"
         *  channel via
         *  --cr-accent-active; static (no ambient animation). Canonical phase
         *  names match the live PhaseStepper. */}
        {showLoopCoachmark && !state.focusMode && (
          <div className="mt-3 flex items-start gap-3 rounded-xl border border-(--cr-glass-border-teal) bg-(--cr-accent-active) p-3 text-left">
            <Lightbulb className="mt-0.5 h-4 w-4 flex-shrink-0 text-(--cr-accent)" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-(--cr-text-heading)">The same loop you just tried</p>
              <p className="mt-0.5 text-[13px] text-(--cr-text-secondary)">
                Read the <strong>Summary</strong>, see it in <strong>Examples</strong>, then prove it stuck in the{" "}
                <strong>Quiz</strong> to unlock the next chapter. Pick Guided, Standard, or Challenge in Reading settings to set how much detail you get.
              </p>
            </div>
            <button
              type="button"
              onClick={dismissLoopCoachmark}
              className="rounded-lg p-1 text-(--cr-text-secondary) transition hover:text-(--cr-text-heading) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--cr-accent)_55%,transparent)]"
              aria-label="Dismiss tip"
            >
              <X className="h-4 w-4" />
            </button>
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

        {/* Content area — constrained to the user's preferred reading width. The
         *  `min(<px>, 72ch)` cap reins the WIDE preset back to a comfortable
         *  measure (~72ch of this container's base font) while leaving the
         *  narrower presets at their px width. The ch resolves against this
         *  container's base font (the reading font-size is applied to the
         *  descendant prose, not here), so the cap is a stable column ceiling. */}
        <div
          ref={contentRef}
          className="mx-auto mt-4 space-y-5"
          style={{ maxWidth: `min(${bookPrefs.reading.contentWidth}px, 72ch)` }}
        >
          {showSummary && (
            <motion.div
              key={`summary-${activeDepth}`}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: DUR.fast, ease: EASE.standard }}
              className="space-y-4"
            >
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
              transition={{ duration: DUR.fast, ease: EASE.standard }}
            >
              {/* "Which sounds like you?" — gated, net-new, dark by default. Picking a
               *  pattern routes the recommended example + pre-fills the commitment plan. */}
              {patternSelectorEnabled && readerPatterns.length > 0 && (
                <div className="mb-6">
                  <PatternSelector
                    patterns={readerPatterns}
                    selectedId={selectedPatternId}
                    onSelect={handlePatternPick}
                    fontScaleClass={textScaleClass}
                  />
                </div>
              )}

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
                onExpand={(revealedCount) =>
                  trackReaderFunnel("example_expanded", {
                    bookId,
                    chapterNumber: chapter.order,
                    revealedCount,
                  })
                }
                pinnedExampleId={pinnedExampleId}
                chapterId={chapterId}
                bookId={bookId}
                chapterNumber={chapter.order}
                chapterTitle={chapter.title}
                fetchFailed={scenariosFetchFailed}
                onRetryFetch={() => setScenariosRefetchKey((k) => k + 1)}
              />

              {/* Commitment elevated into the default path: the chapter's central,
               *  encouraged-not-required outcome sits right after the read + example,
               *  before the quiz. Completion stays gated ONLY on the quiz pass — the
               *  commitment never blocks advancing. Reads the server-hydrated
               *  committedToChapter (Phase 0). Held until commitments hydrate so an
               *  already-committed reader doesn't briefly see the commit form flash. */}
              {!commitmentsLoading &&
                chapter.implementationPlan?.ifThenPlans &&
                chapter.implementationPlan.ifThenPlans.length > 0 && (
                  <div className="mt-6">
                    <CommitmentPrompt
                      ifThenPlans={chapter.implementationPlan.ifThenPlans}
                      bookId={bookId}
                      chapterNumber={chapter.order}
                      fontScaleClass={textScaleClass}
                      onCommit={handleCommitment}
                      hasActiveCommitment={committedToChapter}
                      activeFollowUpDays={activeChapterCommitment?.followUpDays}
                      defaultSelectedPlan={planFromPattern ?? undefined}
                    />
                  </div>
                )}

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
              transition={{ duration: DUR.fast, ease: EASE.standard }}
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
              onCheckAnswer={quiz.checkAnswer}
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
          applicationState={chapterApplicationState}
          commitmentAvailable={commitmentAvailable}
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
            failureRecovery={chapter.experiencePlan?.failureRecovery}
            transferPrompt={chapter.experiencePlan?.transferPrompt}
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
       *  times; text flows in via state) so screen readers announce mode
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
