"use client";

import { useMemo, useState } from "react";
import type { ChapterExample } from "@/app/book/data/mockChapters";
import type { ExampleFilter } from "@/app/book/library/[bookId]/chapter/[chapterId]/hooks/useChapterState";

const options: Array<{ id: ExampleFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "work", label: "Work" },
  { id: "school", label: "School" },
  { id: "personal", label: "Personal" },
];

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
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Unable to submit scenario.";
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const statusTone: Record<UserScenarioSubmission["status"], string> = {
    pending: "border-amber-300/35 bg-amber-500/10 text-amber-200",
    approved: "border-emerald-300/35 bg-emerald-500/10 text-emerald-200",
    rejected: "border-rose-300/35 bg-rose-500/10 text-rose-200",
  };

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-100">Real-world examples</h2>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-sky-300/35 bg-sky-500/14 px-3 py-1.5 text-xs font-semibold text-sky-100">
            Contribution points: {submissionPoints}
          </span>
          {options.map((option) => {
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
        </div>
      </div>

      <section className="mb-4 rounded-[24px] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))] p-5 shadow-[0_18px_38px_rgba(2,6,23,0.42)]">
        <h3 className="text-lg font-semibold text-slate-100">Submit your own scenario</h3>
        <p className="mt-1 text-sm text-slate-300">
          Scenario submissions are queued for admin review before publication. Approved and rejected statuses appear below.
        </p>
        <div className="mt-4 grid gap-3">
          <input
            value={draft.title}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, title: event.target.value }))
            }
            placeholder="Scenario title"
            className="w-full rounded-xl border border-white/15 bg-white/6 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/45"
          />
          <textarea
            value={draft.scenario}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, scenario: event.target.value }))
            }
            placeholder="Write the situation in third-person (example: Maya is leading a group project...)"
            rows={4}
            className="w-full rounded-xl border border-white/15 bg-white/6 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/45"
          />
          <textarea
            value={draft.whatToDo}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, whatToDo: event.target.value }))
            }
            placeholder="What should the person do next?"
            rows={3}
            className="w-full rounded-xl border border-white/15 bg-white/6 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/45"
          />
          <textarea
            value={draft.whyItMatters}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, whyItMatters: event.target.value }))
            }
            placeholder="Why does this scenario matter?"
            rows={3}
            className="w-full rounded-xl border border-white/15 bg-white/6 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/45"
          />
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
                      ? "border-sky-300/50 bg-sky-500/16 text-sky-100"
                      : "border-white/20 bg-white/5 text-slate-300 hover:border-white/35",
                  ].join(" ")}
                >
                  {scope}
                </button>
              );
            })}
          </div>
          {submitError ? (
            <p className="text-sm text-rose-300">{submitError}</p>
          ) : null}
          <button
            type="button"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className={[
              "rounded-xl px-4 py-2.5 text-sm font-semibold transition",
              canSubmit
                ? "border border-sky-300/35 bg-sky-500/16 text-sky-100 hover:bg-sky-500/24"
                : "cursor-not-allowed border border-white/10 bg-white/4 text-slate-500",
            ].join(" ")}
          >
            {submitting ? "Submitting..." : "Submit for review (+25 points)"}
          </button>
        </div>
      </section>

      {sortedSubmissions.length > 0 ? (
        <section className="mb-4 rounded-[24px] border border-white/12 bg-white/3 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-300">Your submissions</h3>
          <div className="mt-3 space-y-2.5">
            {sortedSubmissions.slice(0, 8).map((submission) => (
              <article key={submission.submissionId} className="rounded-xl border border-white/10 bg-[#060a15]/50 px-3 py-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-slate-100">{submission.title}</p>
                  <span className={["rounded-full border px-2 py-0.5 text-xs font-semibold uppercase tracking-[0.08em]", statusTone[submission.status]].join(" ")}>
                    {submission.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  Submitted {new Date(submission.createdAt).toLocaleString()}
                </p>
                {submission.reviewNotes ? (
                  <p className="mt-1 text-sm text-slate-300">{submission.reviewNotes}</p>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <div className="space-y-4">
        {examples.map((example) => (
          <article
            key={example.id}
            className="rounded-[24px] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-5 shadow-[0_18px_38px_rgba(2,6,23,0.42)]"
          >
            <h3 className="text-3xl font-semibold text-slate-100">{example.title}</h3>

            <div className="mt-4 space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Scenario</p>
                <p className={["mt-1 text-slate-200", fontScaleClass].join(" ")}>{example.scenario}</p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-300">What to do</p>
                <p className={["mt-1 text-slate-100", fontScaleClass].join(" ")}>{example.whatToDo}</p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">Why it matters</p>
                <p className={["mt-1 text-slate-200", fontScaleClass].join(" ")}>{example.whyItMatters}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
