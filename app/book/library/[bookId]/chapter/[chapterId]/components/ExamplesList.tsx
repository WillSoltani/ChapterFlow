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
import { ChevronDown, MessageCircle, Plus, Sparkles, X } from "lucide-react";
import type { ChapterExample } from "@/app/book/data/mockChapters";
import type { ExampleFilter } from "@/app/book/library/[bookId]/chapter/[chapterId]/hooks/useChapterState";
import {
  FLOW_POINTS_AMOUNTS,
  FLOW_POINTS_REWARDS,
} from "@/app/book/_lib/flow-points-economy";

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
  learningMode?: "guided" | "standard" | "challenge";
  onScenarioInteraction?: () => void;
};

// ─── constants ────────────────────────────────────────────────────────────────

const FILTER_OPTIONS: Array<{ id: ExampleFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "work", label: "Work" },
  { id: "school", label: "School" },
  { id: "personal", label: "Personal" },
];

const SCENARIO_REWARD = FLOW_POINTS_AMOUNTS.scenarioApproved;

// ─── Scenario Card with Reflection Prompt ────────────────────────────────────

function ScenarioCard({
  example,
  index,
  fontScaleClass,
  learningMode = "standard",
  onInteraction,
}: {
  example: ChapterExample;
  index: number;
  fontScaleClass: string;
  learningMode?: "guided" | "standard" | "challenge";
  onInteraction?: () => void;
}) {
  const [revealed, setRevealed] = useState(learningMode === "guided");
  // Track whether analysis was auto-revealed by Guided mode (vs user interaction)
  const [wasAutoRevealed, setWasAutoRevealed] = useState(learningMode === "guided");
  const interactionTracked = useRef(false);
  const prevMode = useRef(learningMode);

  // Reflection prompt: use authored prompt or a generic fallback
  const reflectionText = example.reflectionPrompt
    || "How would you handle this situation? Consider the risks and benefits before seeing the analysis.";

  // React to learning mode changes
  useEffect(() => {
    if (learningMode === prevMode.current) return;
    const hasInteracted = interactionTracked.current;

    if (learningMode === "guided" && !hasInteracted) {
      setRevealed(true);
      setWasAutoRevealed(true);
    } else if (prevMode.current === "guided" && wasAutoRevealed && !hasInteracted) {
      setRevealed(false);
      setWasAutoRevealed(false);
    }

    prevMode.current = learningMode;
  }, [learningMode, wasAutoRevealed]);

  const handleReveal = useCallback(() => {
    setRevealed(true);
    setWasAutoRevealed(false);
    if (!interactionTracked.current && onInteraction) {
      onInteraction();
      interactionTracked.current = true;
    }
  }, [onInteraction]);

  // Visual treatment variations
  const treatmentClass = index % 3;

  return (
    <article
      className="cr-glass-card overflow-hidden p-0"
      style={{
        animation: `cr-card-enter 300ms ease-out ${index * 80}ms both`,
      }}
    >
      {/* Card header */}
      <div className="border-b border-(--cr-glass-border) px-6 py-5">
        <h3 className="text-xl font-bold text-(--cr-text-heading)">
          {example.title}
        </h3>
      </div>

      <div className="px-6 py-5 space-y-5">
        {/* SCENARIO section */}
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-(--cr-text-secondary) mb-2">
            Scenario
          </p>
          <p
            className={[
              "text-(--cr-text-primary) leading-[1.75] tracking-[0.015em]",
              fontScaleClass,
            ].join(" ")}
            style={{ fontWeight: 450 }}
          >
            {example.scenario}
          </p>
        </div>

        {/* Reflection Prompt */}
        {!revealed && (
          <div className="cr-reflection-prompt rounded-xl border border-dashed border-(--cr-accent)/30 bg-(--cr-accent-muted) p-5">
            <div className="flex items-center gap-2.5 mb-3">
              <MessageCircle className="h-5 w-5 text-(--cr-accent)" />
              <p className="text-lg font-semibold text-(--cr-accent)">
                Pause and think
              </p>
            </div>

            <p
              className={[
                "text-(--cr-text-primary) leading-[1.75] mb-5",
                fontScaleClass,
              ].join(" ")}
            >
              {reflectionText}
            </p>

            <div className="text-center">
              <button
                type="button"
                onClick={handleReveal}
                className="inline-flex items-center gap-2 rounded-xl bg-(--cr-accent) px-6 py-3 text-base font-semibold text-(--cr-text-inverse) transition hover:opacity-90 hover:shadow-[0_4px_16px_rgba(77,182,172,0.3)]"
              >
                See Analysis &rarr;
              </button>
            </div>
          </div>
        )}

        {/* WHAT TO DO section — revealed after decision */}
        <div
          className="overflow-hidden transition-all duration-500 ease-out"
          style={{
            maxHeight: revealed ? "900px" : "0px",
            opacity: revealed ? 1 : 0,
          }}
        >
          <div className={treatmentClass === 2 ? "border-l-2 border-(--cr-accent) pl-4" : ""}>
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-(--cr-accent) mb-2">
              What To Do
            </p>
            <p
              className={[
                "text-(--cr-text-heading) leading-[1.75] tracking-[0.015em]",
                fontScaleClass,
              ].join(" ")}
              style={{ fontWeight: 450 }}
            >
              {example.whatToDo}
            </p>
          </div>

          <div className="mt-4">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-(--cr-accent) mb-2">
              Why It Matters
            </p>
            <p
              className={[
                "text-(--cr-text-primary) leading-[1.75] tracking-[0.015em]",
                fontScaleClass,
              ].join(" ")}
              style={{ fontWeight: 450 }}
            >
              {example.whyItMatters}
            </p>
          </div>

          {/* Connected to Quiz footer */}
          <div className="mt-4 rounded-lg bg-(--cr-fill-subtle) px-4 py-2.5 text-sm text-(--cr-text-secondary)">
            <span className="mr-1">{"\uD83D\uDCD6"}</span>
            Connected to: Quiz Q{((index * 2) % 10) + 1}
            {index % 2 === 0 ? `, Q${((index * 2 + 3) % 10) + 1}` : ""}
          </div>
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
  submissionPoints,
  mySubmissions,
  onSubmitScenario,
  fontScaleClass,
  learningMode = "standard",
  onScenarioInteraction,
}: ExamplesListProps) {
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
  const [showPointsPopover, setShowPointsPopover] = useState(false);

  const pointsContainerRef = useRef<HTMLDivElement>(null);

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

  // Close popover when clicking outside
  useEffect(() => {
    if (!showPointsPopover) return;
    const handler = (event: MouseEvent) => {
      if (
        pointsContainerRef.current &&
        !pointsContainerRef.current.contains(event.target as Node)
      ) {
        setShowPointsPopover(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showPointsPopover]);

  const statusTone: Record<UserScenarioSubmission["status"], string> = {
    pending: "border-(--cr-warning)/30 bg-(--cr-warning)/10 text-(--cr-warning)",
    approved: "border-(--cr-success)/30 bg-(--cr-success-bg) text-(--cr-success)",
    rejected: "border-(--cr-error)/30 bg-(--cr-error-bg) text-(--cr-error)",
  };

  return (
    <section className="cr-reading-content">
      {/* ── Header: title + filters + CTA ── */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-2xl font-bold text-(--cr-text-heading)">
            Real-world examples
          </h2>

          {/* Flow Points badge */}
          <div ref={pointsContainerRef} className="relative">
            <button
              type="button"
              onClick={() => setShowPointsPopover((prev) => !prev)}
              className="flex items-center gap-1.5 rounded-full border border-(--cr-glass-border-teal) bg-(--cr-accent-muted) px-3 py-1.5 text-xs font-semibold text-(--cr-accent) transition hover:bg-(--cr-accent-glow)"
              aria-expanded={showPointsPopover}
              aria-haspopup="true"
            >
              <Sparkles className="h-3 w-3" />
              {submissionPoints} FP
              <ChevronDown
                className={[
                  "h-3 w-3 transition-transform duration-200",
                  showPointsPopover ? "rotate-180" : "",
                ].join(" ")}
              />
            </button>

            {showPointsPopover && (
              <div className="absolute left-0 top-full z-30 mt-2 w-64 rounded-xl border border-(--cr-glass-border) bg-(--cr-bg-surface-2) p-4 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-(--cr-text-disabled)">
                  Flow Points
                </p>
                <p className="mt-1 text-2xl font-bold text-(--cr-text-heading)">
                  {submissionPoints}
                  <span className="ml-1.5 text-sm font-normal text-(--cr-text-secondary)">pts</span>
                </p>
                <div className="mt-3 space-y-1.5 border-t border-(--cr-glass-border) pt-3">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-(--cr-text-disabled)">
                    How to earn
                  </p>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-(--cr-text-secondary)">Approved scenario</span>
                    <span className="font-semibold text-(--cr-accent)">+{SCENARIO_REWARD} pts</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Filter pills + Add CTA */}
        <div className="flex flex-wrap items-center gap-2">
          {FILTER_OPTIONS.map((option) => {
            const active = option.id === filter;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onFilterChange(option.id)}
                className={[
                  "rounded-full border px-3 py-1.5 text-sm font-medium transition",
                  active
                    ? "border-(--cr-accent) bg-(--cr-accent) text-(--cr-text-inverse)"
                    : "border-(--cr-glass-border) bg-(--cr-glass-nav) text-(--cr-text-secondary) hover:border-(--cr-accent)/40",
                ].join(" ")}
                aria-pressed={active}
              >
                {option.label}
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 rounded-full border border-(--cr-glass-border-teal) bg-(--cr-accent-muted) px-3.5 py-1.5 text-sm font-semibold text-(--cr-accent) transition hover:bg-(--cr-accent-glow)"
          >
            <Plus className="h-3.5 w-3.5" />
            Add a Scenario
            <span className="rounded-full bg-(--cr-warning)/20 px-2 py-0.5 text-[11px] font-bold text-(--cr-warning)">
              +{SCENARIO_REWARD}
            </span>
          </button>
        </div>
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
              </article>
            ))}
          </div>
        </section>
      )}

      {/* ── Scenario Cards ── */}
      <div className="space-y-5">
        {examples.length === 0 ? (
          <div className="cr-glass-card flex flex-col items-center justify-center p-10 text-center">
            <p className="text-sm text-(--cr-text-secondary)">No examples for this filter yet.</p>
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-(--cr-glass-border-teal) bg-(--cr-accent-muted) px-4 py-2 text-sm font-semibold text-(--cr-accent) transition hover:bg-(--cr-accent-glow)"
            >
              <Plus className="h-3.5 w-3.5" />
              Be the first to add one
            </button>
          </div>
        ) : (
          examples.map((example, index) => (
            <ScenarioCard
              key={example.id}
              example={example}
              index={index}
              fontScaleClass={fontScaleClass}
              learningMode={learningMode}
              onInteraction={onScenarioInteraction}
            />
          ))
        )}
      </div>

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
                Flow Points reward
              </p>
            </div>
            <h2 className="mt-1.5 text-lg font-bold text-(--cr-text-heading)">
              Add your scenario
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-(--cr-text-secondary)">
              Write a relatable real-world scenario. Earn{" "}
              <span className="font-semibold text-(--cr-accent)">
                +{SCENARIO_REWARD} Flow Points
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
              <Sparkles className="h-4 w-4" />
              {submitting ? "Submitting..." : `Submit for review — +${SCENARIO_REWARD} on approval`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
