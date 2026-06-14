"use client";

import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { MessageCircle, Plus, Sparkles, X } from "lucide-react";
import type { ChapterExample, ReadingDepth } from "@/app/book/data/bookChapters";
import type { ExampleFilter } from "@/app/book/library/[bookId]/chapter/[chapterId]/hooks/useChapterState";
import { INSIGHT_POINTS_AMOUNTS } from "@/app/book/_lib/flow-points-economy";
import { track } from "@/lib/analytics";
import { fetchBookJson } from "@/app/book/_lib/book-api";
import { emitBookStorageChanged } from "@/app/book/hooks/bookStorageEvents";
import { AnimatePresence, motion } from "framer-motion";

// ─── types ────────────────────────────────────────────────────────────────────

export type ScenarioSubmissionDraft = {
  title: string;
  scenario: string;
  whatToDo: string;
  whyItMatters: string;
  scope: "work" | "school" | "personal";
};

export type UserScenarioSubmission = {
  submissionId: string;
  title: string;
  scenario: string;
  whatToDo: string;
  whyItMatters: string;
  scope: "work" | "school" | "personal";
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  reviewedAt?: string;
  reviewNotes?: string;
};

type ExamplesListProps = {
  examples: ChapterExample[];
  filter: ExampleFilter;
  onFilterChange: (value: ExampleFilter) => void;
  submissionPoints: number;
  mySubmissions: UserScenarioSubmission[];
  onSubmitScenario: (draft: ScenarioSubmissionDraft) => Promise<void>;
  fontScaleClass: string;
  readingDepth: ReadingDepth;
  onScenarioInteraction?: () => void;
  chapterId?: string;
  bookId: string;
  chapterNumber: number;
  fetchFailed?: boolean;
  onRetryFetch?: () => void;
  chapterTitle: string;
};

const SCOPE_ICONS: Record<string, string> = {
  work: "\uD83D\uDCBC",
  school: "\uD83C\uDF93",
  personal: "\uD83C\uDFE0",
  all: "\uD83C\uDF10",
};

const CARD_TREATMENT: React.CSSProperties = {
  borderLeft: "3px solid var(--cr-accent)",
};

// ─── constants ────────────────────────────────────────────────────────────────

const FILTER_OPTIONS: Array<{ id: ExampleFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "work", label: "Work" },
  { id: "school", label: "School" },
  { id: "personal", label: "Personal" },
];

const SCENARIO_REWARD = INSIGHT_POINTS_AMOUNTS.scenarioApproved;

// ─── Scenario Card with Reflection Prompt ────────────────────────────────────

function ScenarioCard({
  example,
  index,
  fontScaleClass,
  readingDepth,
  onInteraction,
  chapterId: _chapterId,
  onVisible,
  bookId: _bookId,
  chapterNumber: _chapterNumber,
  chapterTitle: _chapterTitle,
}: {
  example: ChapterExample;
  index: number;
  fontScaleClass: string;
  readingDepth: ReadingDepth;
  onInteraction?: () => void;
  chapterId?: string;
  onVisible?: (index: number) => void;
  // Deprecated: textarea-based reflection was removed. Prop kept on the type
  // briefly so callers don't need to be updated in lockstep.
  onSubmitReflection?: (exampleId: string, length: number) => void;
  bookId: string;
  chapterNumber: number;
  chapterTitle: string;
}) {
  const hasReflectionPrompt = Boolean(example.reflectionPrompt?.trim());
  const analysisGateEnabled = readingDepth !== "simple";
  const [revealed, setRevealed] = useState(!analysisGateEnabled);
  const interactionTracked = useRef(false);
  const articleRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (analysisGateEnabled || interactionTracked.current || !onInteraction) return;
    onInteraction();
    interactionTracked.current = true;
  }, [analysisGateEnabled, onInteraction]);

  useEffect(() => {
    setRevealed(!analysisGateEnabled);
  }, [analysisGateEnabled]);

  // Track currently-visible card for the progress header
  useEffect(() => {
    if (!articleRef.current || !onVisible) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
            onVisible(index);
          }
        }
      },
      { threshold: [0.5] }
    );
    observer.observe(articleRef.current);
    return () => observer.disconnect();
  }, [index, onVisible]);

  const handleReveal = useCallback(() => {
    setRevealed(true);
    if (!interactionTracked.current && onInteraction) {
      onInteraction();
      interactionTracked.current = true;
    }
  }, [onInteraction]);

  return (
    <article
      ref={articleRef}
      className="cr-glass-card overflow-hidden p-0"
      style={{
        ...CARD_TREATMENT,
        animation: `cr-card-enter 300ms ease-out ${index * 80}ms both`,
      }}
    >
      {/* Card header — title only, no scope text label (filter pill emoji conveys scope) */}
      <div className="border-b border-(--cr-glass-border) px-6 py-4">
        <h3 className="text-lg sm:text-xl font-bold text-(--cr-text-heading) leading-snug">
          {example.title}
        </h3>
      </div>

      <div className="px-6 py-5 space-y-5">
        {/* SCENARIO section */}
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-(--cr-text-secondary) mb-2">
            Scenario
          </p>
          <p className={`text-(--cr-text-primary) ${fontScaleClass}`}>
            {example.scenario}
          </p>
        </div>

        {/* Pause-and-predict gate (Deep / Full).
         *
         * Earlier versions had a textarea here ("Write your thoughts before
         * seeing the analysis...") which readers reliably ignored. We now keep
         * only the predict-then-reveal pacing: a short prompt that asks the
         * reader to pause internally, then a single button to reveal.
         *
         * Zero typing, zero character counters, zero "20 characters to earn
         * IP" gating. The reveal button itself counts as the engagement. */}
        {analysisGateEnabled && !revealed && (
          <div className="rounded-xl border border-(--cr-accent)/25 bg-(--cr-accent-muted) p-4">
            <div className="flex items-center gap-2 mb-2">
              <MessageCircle className="h-4 w-4 text-(--cr-accent)" aria-hidden="true" />
              <p className="text-sm font-semibold text-(--cr-accent)">Pause and predict</p>
            </div>

            {hasReflectionPrompt ? (
              <p
                className={[
                  "text-[14px] text-(--cr-text-secondary) leading-[1.6] mb-4",
                  fontScaleClass,
                ].join(" ")}
              >
                {example.reflectionPrompt}
              </p>
            ) : (
              <p className="text-[14px] text-(--cr-text-secondary) leading-[1.6] mb-4">
                Decide in your head what you would do here. No need to type, just settle on an answer before continuing.
              </p>
            )}

            <div className="flex items-center justify-center">
              <button
                type="button"
                onClick={handleReveal}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-(--cr-accent) px-4 py-2 text-[13px] font-semibold text-(--cr-text-inverse) transition hover:opacity-90"
              >
                Reveal the analysis
              </button>
            </div>
          </div>
        )}

        {/* WHAT TO DO section — revealed after decision */}
        <div
          className="overflow-hidden transition-all duration-500 ease-out"
          style={{
            maxHeight: revealed ? "2000px" : "0px",
            opacity: revealed ? 1 : 0,
          }}
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-(--cr-accent) mb-2">
              What To Do
            </p>
            <p className={`text-(--cr-text-heading) ${fontScaleClass}`}>
              {example.whatToDo}
            </p>
          </div>

          <div className="mt-4">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-(--cr-accent) mb-2">
              Why It Matters
            </p>
            <p className={`text-(--cr-text-primary) ${fontScaleClass}`}>
              {example.whyItMatters}
            </p>
          </div>

          {/*
           * Removed: post-reveal "Your Reflection" display, simple-depth
           * optional reflection textarea ("Share your thoughts"), and the
           * "Get AI Feedback" panel.
           *
           * All three depended on the reader typing into a textarea, which
           * the chapter UX redesign explicitly rejected. The "predict-then-
           * reveal" pacing above (Pause and predict) preserves the only piece
           * of the old flow that worked: a brief mental pause before the
           * analysis is shown. No typing required.
           *
           * If you want to bring AI feedback back, do it as a deliberate opt-
           * in surface (e.g., a small "ask the book" button that pulls the
           * shared AskBookDrawer), not as friction inside every example.
           */}
        </div>
      </div>
    </article>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export function ExamplesList({
  examples,
  filter,
  onFilterChange,
  submissionPoints: _submissionPoints,
  mySubmissions,
  onSubmitScenario,
  fontScaleClass,
  readingDepth,
  onScenarioInteraction,
  chapterId,
  bookId,
  chapterNumber,
  chapterTitle,
  fetchFailed,
  onRetryFetch,
}: ExamplesListProps) {
  void _submissionPoints;
  const reflectionAwardsKey = `cf-reflection-awards-${bookId}-${chapterNumber}`;
  const [reflectionAwards, setReflectionAwards] = useState<Set<string>>(new Set());
  const [reflectionToasts, setReflectionToasts] = useState<Array<{ id: string; exampleId: string; amount: number }>>([]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(reflectionAwardsKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setReflectionAwards(new Set(parsed.filter((v): v is string => typeof v === "string")));
        }
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reflectionAwardsKey]);

  useEffect(() => {
    try {
      window.localStorage.setItem(reflectionAwardsKey, JSON.stringify(Array.from(reflectionAwards)));
    } catch {
      // ignore
    }
  }, [reflectionAwards, reflectionAwardsKey]);

  const handleSubmitReflection = useCallback(
    async (exampleId: string, length: number) => {
      if (reflectionAwards.has(exampleId)) return;
      try {
        const result = await fetchBookJson<{
          awarded: boolean;
          amount: number;
          alreadyClaimed: boolean;
        }>(`/app/api/book/me/reflections/${encodeURIComponent(bookId)}/${chapterNumber}`, {
          method: "POST",
          body: JSON.stringify({ exampleId, reflectionLength: length }),
        });
        setReflectionAwards((prev) => {
          const next = new Set(prev);
          next.add(exampleId);
          return next;
        });
        if (result.awarded && result.amount > 0) {
          const toastId = `${exampleId}-${Date.now()}`;
          setReflectionToasts((prev) => [...prev.slice(-2), { id: toastId, exampleId, amount: result.amount }]);
          emitBookStorageChanged("insight-points");
          window.setTimeout(() => {
            setReflectionToasts((prev) => prev.filter((t) => t.id !== toastId));
          }, 3000);
        }
      } catch (err) {
        // Non-blocking — analysis already revealed
        console.warn("[reflection] Failed to submit:", err);
      }
    },
    [bookId, chapterNumber, reflectionAwards]
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const handleVisible = useCallback((index: number) => {
    setCurrentIndex(index);
  }, []);
  const [draft, setDraft] = useState<ScenarioSubmissionDraft>({
    title: "",
    scenario: "",
    whatToDo: "",
    whyItMatters: "",
    scope: "personal",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  const sortedSubmissions = useMemo(
    () =>
      [...mySubmissions].sort(
        (left, right) =>
          new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      ),
    [mySubmissions]
  );

  const canSubmit =
    draft.title.trim().length >= 6 &&
    draft.scenario.trim().length >= 40 &&
    draft.whatToDo.trim().length >= 20 &&
    draft.whyItMatters.trim().length >= 20 &&
    !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    try {
      setSubmitting(true);
      setSubmitError(null);
      await onSubmitScenario({
        title: draft.title.trim(),
        scenario: draft.scenario.trim(),
        whatToDo: draft.whatToDo.trim(),
        whyItMatters: draft.whyItMatters.trim(),
        scope: draft.scope,
      });
      setDraft({
        title: "",
        scenario: "",
        whatToDo: "",
        whyItMatters: "",
        scope: draft.scope,
      });
      setShowModal(false);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Unable to submit scenario.";
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const statusTone: Record<UserScenarioSubmission["status"], string> = {
    pending: "border-(--cr-warning)/30 bg-(--cr-warning)/10 text-(--cr-warning)",
    approved: "border-(--cr-success)/30 bg-(--cr-success-bg) text-(--cr-success)",
    rejected: "border-(--cr-error)/30 bg-(--cr-error-bg) text-(--cr-error)",
  };

  const visibleNumber = Math.min(currentIndex + 1, Math.max(examples.length, 1));

  return (
    <section className="cr-reading-content">
      {/* ── Title row ── */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 data-phase-heading className="text-2xl font-bold text-(--cr-text-heading)">
          Real-world examples
        </h2>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-1.5 rounded-full border border-(--cr-glass-border-teal) bg-(--cr-accent-muted) px-3.5 py-1.5 text-sm font-semibold text-(--cr-accent) transition hover:bg-(--cr-accent-glow)"
        >
          <Plus className="h-3.5 w-3.5" />
          Add a Scenario
          {/* IP reward indicator — kept but visually quieter. The transactional
           * yellow pill read as gamification chrome ahead of content. Now it
           * reads as a small inline note that this action awards points. */}
          <span className="ml-0.5 text-[11px] font-medium text-(--cr-text-secondary)">
            +{SCENARIO_REWARD} IP
          </span>
        </button>
      </div>

      {fetchFailed && (
        <button
          type="button"
          onClick={onRetryFetch}
          className="mb-3 w-full text-left rounded-xl border border-(--cr-glass-border) bg-(--cr-bg-surface-2) px-4 py-2 text-[12px] text-(--cr-text-secondary) hover:bg-(--cr-bg-surface-3) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--cr-accent)_50%,transparent)]"
        >
          Couldn&rsquo;t load community scenarios. Tap to retry.
        </button>
      )}

      {/* ── Filter row (sticky) ── */}
      <div
        className="sticky top-(--cr-header-h,64px) z-20 -mx-5 sm:-mx-8 px-5 sm:px-8 mb-5 flex flex-wrap items-center gap-2 py-2"
        style={{
          background:
            "color-mix(in srgb, var(--cr-bg-root) 92%, transparent)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
      >
        {FILTER_OPTIONS.map((option) => {
          const active = option.id === filter;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onFilterChange(option.id)}
              className={[
                "rounded-full border px-3 py-1.5 text-[13px] font-medium transition",
                active
                  ? "border-(--cr-accent) bg-(--cr-accent) text-(--cr-text-inverse)"
                  : "border-(--cr-glass-border) bg-(--cr-glass-nav) text-(--cr-text-secondary) hover:border-(--cr-accent)/40",
              ].join(" ")}
              aria-pressed={active}
            >
              <span className="mr-1" aria-hidden="true">
                {SCOPE_ICONS[option.id] ?? ""}
              </span>
              {option.label}
            </button>
          );
        })}
        {examples.length > 0 && (
          <span
            className="ml-auto text-[12px] tabular-nums text-(--cr-text-disabled)"
            aria-live="polite"
          >
            {visibleNumber} of {examples.length}
          </span>
        )}
      </div>

      {/* ── My submissions ── */}
      {sortedSubmissions.length > 0 && (
        <section className="mb-6 rounded-2xl border border-(--cr-glass-border) bg-(--cr-bg-surface-2) p-4">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-(--cr-text-secondary)">
            Your submissions
          </p>
          <div className="mt-3 space-y-2">
            {sortedSubmissions.slice(0, 8).map((submission) => (
              <article
                key={submission.submissionId}
                className="rounded-xl border border-(--cr-glass-border) bg-(--cr-bg-surface-1) px-3 py-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-(--cr-text-heading)">{submission.title}</p>
                  <span
                    className={[
                      "rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em]",
                      statusTone[submission.status],
                    ].join(" ")}
                  >
                    {submission.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-(--cr-text-disabled)">
                  Submitted {new Date(submission.createdAt).toLocaleString()}
                </p>
                {submission.status === "rejected" && submission.reviewNotes && (
                  <p className="mt-1.5 text-xs text-(--cr-error) leading-relaxed">
                    {submission.reviewNotes}
                  </p>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      {/* ── Scenario Cards ── */}
      <div className="space-y-5">
        {examples.length === 0 ? (
          <>
            <div className="text-center py-12 text-(--cr-text-disabled)">
              <p className="text-[15px]">No {filter} examples in this chapter.</p>
              <p className="text-[13px] mt-2">
                Try a different filter, or submit your own scenario below.
              </p>
            </div>
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setShowModal(true)}
                className="inline-flex items-center gap-1.5 rounded-full border border-(--cr-glass-border-teal) bg-(--cr-accent-muted) px-4 py-2 text-sm font-semibold text-(--cr-accent) transition hover:bg-(--cr-accent-glow)"
              >
                <Plus className="h-3.5 w-3.5" />
                Add a scenario
              </button>
            </div>
          </>
        ) : (
          examples.map((example, index) => (
            <ScenarioCard
              key={example.id}
              example={example}
              index={index}
              fontScaleClass={fontScaleClass}
              readingDepth={readingDepth}
              onInteraction={onScenarioInteraction}
              chapterId={chapterId}
              onVisible={handleVisible}
              onSubmitReflection={handleSubmitReflection}
              bookId={bookId}
              chapterNumber={chapterNumber}
              chapterTitle={chapterTitle}
            />
          ))
        )}
      </div>

      <AnimatePresence>
        {reflectionToasts.map((toast, i) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed left-1/2 -translate-x-1/2 z-40 px-4 py-2.5 rounded-full text-[13px] font-semibold flex items-center gap-2 bg-(--cr-bg-surface-2) text-(--cr-accent)"
            style={{
              bottom: `${24 + i * 48}px`,
              border:
                "1px solid color-mix(in srgb, var(--cr-accent) 35%, transparent)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            }}
            role="status"
            aria-live="polite"
          >
            <span>{"\u2728"}</span>
            +{toast.amount} IP for thinking deeply
          </motion.div>
        ))}
      </AnimatePresence>

      {/* ── Add Scenario modal ── */}
      {showModal && (
        <AddScenarioModal
          draft={draft}
          setDraft={setDraft}
          onClose={() => {
            setShowModal(false);
            setSubmitError(null);
          }}
          onSubmit={handleSubmit}
          submitting={submitting}
          canSubmit={canSubmit}
          submitError={submitError}
        />
      )}
    </section>
  );
}

// ─── Add Scenario Modal ──────────────────────────────────────────────────────

type AddScenarioModalProps = {
  draft: ScenarioSubmissionDraft;
  setDraft: Dispatch<SetStateAction<ScenarioSubmissionDraft>>;
  onClose: () => void;
  onSubmit: () => Promise<void>;
  submitting: boolean;
  canSubmit: boolean;
  submitError: string | null;
};

function AddScenarioModal({
  draft,
  setDraft,
  onClose,
  onSubmit,
  submitting,
  canSubmit,
  submitError,
}: AddScenarioModalProps) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-4 sm:items-center sm:pb-0"
      role="dialog"
      aria-modal="true"
      aria-label="Add a Scenario"
    >
      <div
        className="absolute inset-0 bg-(--cr-bg-root)/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative z-10 w-full max-w-xl overflow-y-auto rounded-2xl border border-(--cr-glass-border) bg-(--cr-bg-surface-2) p-6 shadow-[0_8px_32px_rgba(0,0,0,0.4)] sm:max-h-[90vh]">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-(--cr-accent)" />
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-(--cr-accent)">
                Insight Points reward
              </p>
            </div>
            <h2 className="mt-1.5 text-lg font-bold text-(--cr-text-heading)">
              Add your scenario
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-(--cr-text-secondary)">
              Write a relatable real-world scenario. Earn{" "}
              <span className="font-semibold text-(--cr-accent)">
                +{SCENARIO_REWARD} Insight Points
              </span>{" "}
              once approved.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-xl border border-(--cr-glass-border) p-2 text-(--cr-text-secondary) transition hover:bg-(--cr-bg-surface-3)"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-(--cr-text-secondary)">Title</label>
            <input
              value={draft.title}
              onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="A short, descriptive title"
              className="w-full rounded-xl border border-(--cr-glass-border) bg-(--cr-bg-surface-3) px-3 py-2.5 text-sm text-(--cr-text-primary) placeholder:text-(--cr-text-disabled) focus:border-(--cr-accent) focus:outline-none focus:ring-2 focus:ring-(--cr-accent-glow)"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-(--cr-text-secondary)">Scenario</label>
            <textarea
              value={draft.scenario}
              onChange={(e) => setDraft((prev) => ({ ...prev, scenario: e.target.value }))}
              placeholder="Write the situation in third-person..."
              rows={4}
              className="w-full rounded-xl border border-(--cr-glass-border) bg-(--cr-bg-surface-3) px-3 py-2.5 text-sm text-(--cr-text-primary) placeholder:text-(--cr-text-disabled) focus:border-(--cr-accent) focus:outline-none focus:ring-2 focus:ring-(--cr-accent-glow)"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-(--cr-text-secondary)">What to do</label>
            <textarea
              value={draft.whatToDo}
              onChange={(e) => setDraft((prev) => ({ ...prev, whatToDo: e.target.value }))}
              placeholder="Describe the action clearly."
              rows={3}
              className="w-full rounded-xl border border-(--cr-glass-border) bg-(--cr-bg-surface-3) px-3 py-2.5 text-sm text-(--cr-text-primary) placeholder:text-(--cr-text-disabled) focus:border-(--cr-accent) focus:outline-none focus:ring-2 focus:ring-(--cr-accent-glow)"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-(--cr-text-secondary)">Why it matters</label>
            <textarea
              value={draft.whyItMatters}
              onChange={(e) => setDraft((prev) => ({ ...prev, whyItMatters: e.target.value }))}
              placeholder="Why does applying this chapter here matter?"
              rows={3}
              className="w-full rounded-xl border border-(--cr-glass-border) bg-(--cr-bg-surface-3) px-3 py-2.5 text-sm text-(--cr-text-primary) placeholder:text-(--cr-text-disabled) focus:border-(--cr-accent) focus:outline-none focus:ring-2 focus:ring-(--cr-accent-glow)"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-(--cr-text-secondary)">Category</label>
            <div className="flex flex-wrap gap-2">
              {(["work", "school", "personal"] as const).map((scope) => {
                const active = draft.scope === scope;
                return (
                  <button
                    key={scope}
                    type="button"
                    onClick={() => setDraft((prev) => ({ ...prev, scope }))}
                    className={[
                      "rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] transition",
                      active
                        ? "border-(--cr-accent) bg-(--cr-accent) text-(--cr-text-inverse)"
                        : "border-(--cr-glass-border) text-(--cr-text-secondary) hover:border-(--cr-accent)/40",
                    ].join(" ")}
                  >
                    {scope}
                  </button>
                );
              })}
            </div>
          </div>

          <p className="text-xs leading-relaxed text-(--cr-text-disabled)">
            Submitted scenarios are automatically reviewed for quality and safety
            using AI (Anthropic). Please don&rsquo;t include personal or sensitive
            information.
          </p>

          {submitError && (
            <p className="rounded-xl border border-(--cr-error)/30 bg-(--cr-error-bg) px-3 py-2 text-sm text-(--cr-error)">
              {submitError}
            </p>
          )}

          <div className="pt-1">
            <button
              type="button"
              disabled={!canSubmit}
              onClick={onSubmit}
              className={[
                "flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition",
                canSubmit
                  ? "bg-(--cr-accent) text-(--cr-text-inverse) hover:opacity-90"
                  : "cursor-not-allowed bg-(--cr-bg-surface-3) text-(--cr-text-disabled)",
              ].join(" ")}
            >
              {submitting ? (
                <>
                  <span className="flex items-center gap-1" aria-hidden="true">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" style={{ animationDelay: "0ms" }} />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" style={{ animationDelay: "150ms" }} />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" style={{ animationDelay: "300ms" }} />
                  </span>
                  Reviewing your scenario...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  {`Submit scenario — +${SCENARIO_REWARD} if approved`}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
