"use client";

import {
  type Dispatch,
  type SetStateAction,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ChevronDown, Plus, Sparkles, X } from "lucide-react";
import type { ChapterExample } from "@/app/book/data/mockChapters";
import type { ExampleFilter } from "@/app/book/library/[bookId]/chapter/[chapterId]/hooks/useChapterState";

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
};

// ─── constants ────────────────────────────────────────────────────────────────

const FILTER_OPTIONS: Array<{ id: ExampleFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "work", label: "Work" },
  { id: "school", label: "School" },
  { id: "personal", label: "Personal" },
];

const EXAMPLES_TOUR_KEY = "book-accelerator:examples-tour:v1";
const SCENARIO_REWARD = 25;
const POINTS_UNLOCK_BOOK = 600;
const POINTS_PRO_MONTH = 1000;
const POINTS_INVITE_FRIEND = 500;
const POINTS_FRIEND_SUBSCRIBES = 1000;

// ─── inline hook: first-time tour ─────────────────────────────────────────────

function useExamplesTour() {
  // Default seen=true prevents a flash before hydration
  const [seen, setSeen] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSeen(!!window.localStorage.getItem(EXAMPLES_TOUR_KEY));
    setHydrated(true);
  }, []);

  const dismiss = () => {
    window.localStorage.setItem(
      EXAMPLES_TOUR_KEY,
      JSON.stringify({ seenAt: new Date().toISOString() })
    );
    setSeen(true);
  };

  return { showBanner: hydrated && !seen, dismiss };
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
  const { showBanner, dismiss: dismissBanner } = useExamplesTour();

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

  // Close popover when clicking outside the badge container
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
    pending: "border-amber-300/35 bg-amber-500/10 text-amber-200",
    approved: "border-emerald-300/35 bg-emerald-500/10 text-emerald-200",
    rejected: "border-rose-300/35 bg-rose-500/10 text-rose-200",
  };

  // Compute the next Flow Points milestone the user is working toward
  const nextMilestone =
    submissionPoints < POINTS_UNLOCK_BOOK
      ? { label: "Unlock a free book", threshold: POINTS_UNLOCK_BOOK }
      : submissionPoints < POINTS_PRO_MONTH
        ? { label: "1 month Pro free", threshold: POINTS_PRO_MONTH }
        : null;

  return (
    <section>
      {/* ── First-time onboarding banner ──────────────────────────────────── */}
      {showBanner ? (
        <div className="mb-5 rounded-[22px] border border-violet-400/25 bg-[linear-gradient(135deg,rgba(139,92,246,0.12),rgba(99,102,241,0.07))] p-4 shadow-[0_12px_28px_rgba(139,92,246,0.1)]">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-violet-400/30 bg-violet-500/15 text-violet-300">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-violet-100">
                Earn Flow Points by contributing
              </p>
              <p className="mt-1 text-sm leading-relaxed text-slate-300">
                Post a relatable scenario and earn{" "}
                <span className="font-semibold text-violet-200">
                  +{SCENARIO_REWARD} Flow Points
                </span>{" "}
                once it&apos;s approved. Reach {POINTS_UNLOCK_BOOK} points to unlock a free
                book, or {POINTS_PRO_MONTH} for a month of Pro.
              </p>
            </div>
            <button
              type="button"
              onClick={dismissBanner}
              className="mt-0.5 shrink-0 rounded-lg p-1.5 text-slate-500 transition hover:bg-white/8 hover:text-slate-300"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : null}

      {/* ── Header: title + points badge + filters + CTA ──────────────────── */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        {/* Left: title + Flow Points badge */}
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-semibold text-slate-100">Real-world examples</h2>

          {/* Flow Points badge with popover */}
          <div ref={pointsContainerRef} className="relative">
            <button
              type="button"
              onClick={() => setShowPointsPopover((prev) => !prev)}
              className="flex items-center gap-1.5 rounded-full border border-violet-400/30 bg-violet-500/12 px-3 py-1.5 text-xs font-semibold text-violet-200 transition hover:bg-violet-500/20"
              aria-expanded={showPointsPopover}
              aria-haspopup="true"
            >
              <Sparkles className="h-3 w-3" />
              {submissionPoints} Flow Points
              <ChevronDown
                className={[
                  "h-3 w-3 transition-transform duration-200",
                  showPointsPopover ? "rotate-180" : "",
                ].join(" ")}
              />
            </button>

            {/* Points info popover */}
            {showPointsPopover ? (
              <div className="absolute left-0 top-full z-30 mt-2 w-72 rounded-[20px] border border-white/12 bg-[#0c1526] p-4 shadow-[0_20px_50px_rgba(2,6,23,0.75)]">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                  Flow Points
                </p>
                <p className="mt-1 text-2xl font-semibold text-slate-100">
                  {submissionPoints}
                  <span className="ml-1.5 text-sm font-normal text-slate-400">pts</span>
                </p>

                {/* Progress toward next milestone */}
                {nextMilestone ? (
                  <div className="mt-3">
                    <div className="mb-1.5 flex justify-between text-xs text-slate-400">
                      <span>Next: {nextMilestone.label}</span>
                      <span>
                        {submissionPoints} / {nextMilestone.threshold}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
                      <div
                        className="h-full rounded-full bg-linear-to-r from-violet-500 to-indigo-400 transition-all duration-300"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round(
                              (submissionPoints / nextMilestone.threshold) * 100
                            )
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                ) : null}

                {/* How to earn */}
                <div className="mt-3 space-y-2 border-t border-white/8 pt-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    How to earn
                  </p>
                  <div className="space-y-1.5">
                    <PointsRow label="Post a scenario" value={`+${SCENARIO_REWARD}`} />
                    <PointsRow
                      label="Invite a friend"
                      value={`+${POINTS_INVITE_FRIEND}`}
                    />
                    <PointsRow
                      label="Friend subscribes to Pro"
                      value={`+${POINTS_FRIEND_SUBSCRIBES}`}
                    />
                  </div>
                </div>

                {/* What you unlock */}
                <div className="mt-3 space-y-2 border-t border-white/8 pt-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    What you unlock
                  </p>
                  <div className="space-y-1.5">
                    <MilestoneRow
                      label="Unlock a free book"
                      value={`${POINTS_UNLOCK_BOOK} pts`}
                      reached={submissionPoints >= POINTS_UNLOCK_BOOK}
                    />
                    <MilestoneRow
                      label="1 month Pro free"
                      value={`${POINTS_PRO_MONTH} pts`}
                      reached={submissionPoints >= POINTS_PRO_MONTH}
                    />
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* Right: filter pills + Add Scenario CTA */}
        <div className="flex flex-wrap items-center gap-2">
          {FILTER_OPTIONS.map((option) => {
            const active = option.id === filter;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onFilterChange(option.id)}
                className={[
                  "rounded-full border px-3 py-1.5 text-sm transition",
                  active
                    ? "border-sky-300/45 bg-sky-500/16 text-sky-100"
                    : "border-white/20 bg-white/5 text-slate-300 hover:border-white/35",
                ].join(" ")}
                aria-pressed={active}
              >
                {option.label}
              </button>
            );
          })}

          {/* Add a Scenario CTA — visually distinct from the filter pills */}
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 rounded-full border border-violet-400/40 bg-[linear-gradient(135deg,rgba(139,92,246,0.18),rgba(99,102,241,0.13))] px-3.5 py-1.5 text-sm font-semibold text-violet-100 shadow-[0_0_18px_rgba(139,92,246,0.15)] transition-all hover:bg-[linear-gradient(135deg,rgba(139,92,246,0.26),rgba(99,102,241,0.20))] hover:shadow-[0_0_24px_rgba(139,92,246,0.22)]"
          >
            <Plus className="h-3.5 w-3.5" />
            Add a Scenario
            <span className="rounded-full border border-violet-400/35 bg-violet-500/20 px-2 py-0.5 text-[11px] font-bold text-violet-200">
              +{SCENARIO_REWARD} pts
            </span>
          </button>
        </div>
      </div>

      {/* ── My submissions panel ──────────────────────────────────────────── */}
      {sortedSubmissions.length > 0 ? (
        <section className="mb-5 rounded-[20px] border border-white/8 bg-white/[0.025] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
            Your submissions
          </p>
          <div className="mt-3 space-y-2">
            {sortedSubmissions.slice(0, 8).map((submission) => (
              <article
                key={submission.submissionId}
                className="rounded-xl border border-white/8 bg-[#060a15]/60 px-3 py-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-100">{submission.title}</p>
                  <span
                    className={[
                      "rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em]",
                      statusTone[submission.status],
                    ].join(" ")}
                  >
                    {submission.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Submitted {new Date(submission.createdAt).toLocaleString()}
                </p>
                {submission.reviewNotes ? (
                  <p className="mt-1 text-xs text-slate-400">{submission.reviewNotes}</p>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {/* ── Examples list ─────────────────────────────────────────────────── */}
      <div className="space-y-4">
        {examples.length === 0 ? (
          <div className="rounded-[24px] border border-white/8 bg-white/[0.02] p-10 text-center">
            <p className="text-sm text-slate-400">No examples for this filter yet.</p>
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-violet-400/35 bg-violet-500/14 px-4 py-2 text-sm font-semibold text-violet-200 transition hover:bg-violet-500/22"
            >
              <Plus className="h-3.5 w-3.5" />
              Be the first to add one
            </button>
          </div>
        ) : (
          examples.map((example) => (
            <article
              key={example.id}
              className="rounded-[24px] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-5 shadow-[0_18px_38px_rgba(2,6,23,0.42)]"
            >
              <h3 className="text-3xl font-semibold text-slate-100">{example.title}</h3>
              <div className="mt-4 space-y-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Scenario
                  </p>
                  <p className={["mt-1 text-slate-200", fontScaleClass].join(" ")}>
                    {example.scenario}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-300">
                    What to do
                  </p>
                  <p className={["mt-1 text-slate-100", fontScaleClass].join(" ")}>
                    {example.whatToDo}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">
                    Why it matters
                  </p>
                  <p className={["mt-1 text-slate-200", fontScaleClass].join(" ")}>
                    {example.whyItMatters}
                  </p>
                </div>
              </div>
            </article>
          ))
        )}
      </div>

      {/* ── Add Scenario modal ────────────────────────────────────────────── */}
      {showModal ? (
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
      ) : null}
    </section>
  );
}

// ─── helper sub-components ────────────────────────────────────────────────────

function PointsRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-xs text-slate-400">{label}</p>
      <span className="text-xs font-semibold text-violet-300">{value} pts</span>
    </div>
  );
}

function MilestoneRow({
  label,
  value,
  reached,
}: {
  label: string;
  value: string;
  reached: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <p className={["text-xs", reached ? "text-emerald-300" : "text-slate-400"].join(" ")}>
        {label}
        {reached ? (
          <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-emerald-400">
            ✓ reached
          </span>
        ) : null}
      </p>
      <span
        className={[
          "text-xs font-semibold",
          reached ? "text-emerald-400" : "text-slate-500",
        ].join(" ")}
      >
        {value}
      </span>
    </div>
  );
}

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
  // Scroll-lock while modal is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Escape to close
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
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/65 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-xl overflow-y-auto rounded-[28px] border border-white/12 bg-[linear-gradient(180deg,#0d1426,#080f1e)] p-6 shadow-[0_32px_80px_rgba(2,6,23,0.85)] sm:max-h-[90vh]">
        {/* Modal header */}
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-400" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-400">
                Flow Points reward
              </p>
            </div>
            <h2 className="mt-1.5 text-lg font-semibold text-slate-100">
              Add your scenario
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-400">
              Write a relatable real-world scenario for this chapter. Earn{" "}
              <span className="font-semibold text-violet-200">
                +{SCENARIO_REWARD} Flow Points
              </span>{" "}
              once the team approves it.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-xl border border-white/10 p-2 text-slate-400 transition hover:bg-white/8 hover:text-slate-200"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form fields */}
        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">
              Title
            </label>
            <input
              value={draft.title}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, title: event.target.value }))
              }
              placeholder="A short, descriptive title for your scenario"
              className="w-full rounded-xl border border-white/15 bg-white/6 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/45"
            />
            <p className="mt-1 text-right text-xs text-slate-600">
              {draft.title.trim().length} / 6+ chars
            </p>
          </div>

          {/* Scenario */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">
              Scenario
            </label>
            <textarea
              value={draft.scenario}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, scenario: event.target.value }))
              }
              placeholder="Write the situation in third-person (e.g. Maya is leading a group project when…)"
              rows={4}
              className="w-full rounded-xl border border-white/15 bg-white/6 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/45"
            />
            <p className="mt-1 text-right text-xs text-slate-600">
              {draft.scenario.trim().length} / 40+ chars
            </p>
          </div>

          {/* What to do */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">
              What to do
            </label>
            <textarea
              value={draft.whatToDo}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, whatToDo: event.target.value }))
              }
              placeholder="What should the person do next? Describe the action clearly."
              rows={3}
              className="w-full rounded-xl border border-white/15 bg-white/6 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/45"
            />
            <p className="mt-1 text-right text-xs text-slate-600">
              {draft.whatToDo.trim().length} / 20+ chars
            </p>
          </div>

          {/* Why it matters */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">
              Why it matters
            </label>
            <textarea
              value={draft.whyItMatters}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, whyItMatters: event.target.value }))
              }
              placeholder="Why does applying this chapter here actually matter?"
              rows={3}
              className="w-full rounded-xl border border-white/15 bg-white/6 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/45"
            />
            <p className="mt-1 text-right text-xs text-slate-600">
              {draft.whyItMatters.trim().length} / 20+ chars
            </p>
          </div>

          {/* Category */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">
              Category
            </label>
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
                        ? "border-violet-400/50 bg-violet-500/18 text-violet-100"
                        : "border-white/20 bg-white/5 text-slate-400 hover:border-white/35",
                    ].join(" ")}
                  >
                    {scope}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Error */}
          {submitError ? (
            <p className="rounded-xl border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
              {submitError}
            </p>
          ) : null}

          {/* Submit */}
          <div className="pt-1">
            <button
              type="button"
              disabled={!canSubmit}
              onClick={onSubmit}
              className={[
                "flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition",
                canSubmit
                  ? "border border-violet-400/40 bg-[linear-gradient(135deg,rgba(139,92,246,0.22),rgba(99,102,241,0.18))] text-violet-100 shadow-[0_8px_20px_rgba(139,92,246,0.2)] hover:shadow-[0_10px_26px_rgba(139,92,246,0.28)]"
                  : "cursor-not-allowed border border-white/10 bg-white/4 text-slate-600",
              ].join(" ")}
            >
              <Sparkles className="h-4 w-4" />
              {submitting
                ? "Submitting…"
                : `Submit for review — +${SCENARIO_REWARD} Flow Points`}
            </button>
            <p className="mt-2.5 text-center text-xs text-slate-600">
              Scenarios are reviewed before going live for all readers.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
