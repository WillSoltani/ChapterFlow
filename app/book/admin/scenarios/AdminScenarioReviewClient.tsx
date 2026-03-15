"use client";

import { useEffect, useMemo, useState } from "react";
import { BookClientError, fetchBookJson } from "@/app/book/_lib/book-api";

type PendingScenarioSubmission = {
  submissionId: string;
  userId: string;
  bookId: string;
  chapterNumber: number;
  chapterId?: string;
  title: string;
  scenario: string;
  whatToDo: string;
  whyItMatters: string;
  scope: "work" | "school" | "personal";
  pointsAwarded: number;
  createdAt: string;
  queuedAt: string;
};

export function AdminScenarioReviewClient() {
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<PendingScenarioSubmission[]>([]);
  const [notesById, setNotesById] = useState<Record<string, string>>({});

  useEffect(() => {
    let mounted = true;
    fetchBookJson<{ submissions: PendingScenarioSubmission[] }>(
      "/app/api/book/admin/scenario-submissions/pending"
    )
      .then((payload) => {
        if (!mounted) return;
        setSubmissions(payload.submissions ?? []);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!mounted) return;
        const message =
          err instanceof Error ? err.message : "Unable to load pending submissions.";
        setError(message);
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 1800);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const ordered = useMemo(
    () =>
      [...submissions].sort(
        (left, right) =>
          new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
      ),
    [submissions]
  );

  const review = async (
    submissionId: string,
    status: "approved" | "rejected"
  ) => {
    try {
      setSavingId(submissionId);
      await fetchBookJson(`/app/api/book/admin/scenario-submissions/${submissionId}`, {
        method: "PATCH",
        body: JSON.stringify({
          status,
          reviewNotes: notesById[submissionId]?.trim() || undefined,
        }),
      });
      setSubmissions((prev) =>
        prev.filter((submission) => submission.submissionId !== submissionId)
      );
      setToast(status === "approved" ? "Scenario approved." : "Scenario rejected.");
    } catch (err: unknown) {
      const message =
        err instanceof BookClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Unable to save review.";
      setError(message);
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return (
      <main className="relative min-h-screen bg-[#050813] px-4 py-10 text-slate-100 sm:px-6">
        <div className="mx-auto max-w-5xl rounded-3xl border border-white/10 bg-white/4 p-6 text-slate-300">
          Loading pending scenario submissions...
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#050813] px-4 py-10 text-slate-100 sm:px-6">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(960px_circle_at_10%_-10%,rgba(56,189,248,0.16),transparent_58%),radial-gradient(780px_circle_at_100%_0%,rgba(14,165,233,0.08),transparent_60%)]" />
      <section className="mx-auto max-w-5xl space-y-4">
        <header className="rounded-3xl border border-white/10 bg-white/4 p-5 shadow-[0_20px_50px_rgba(2,6,23,0.45)]">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
            Admin
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-100">Scenario review queue</h1>
          <p className="mt-2 text-sm text-slate-300">
            New scenario submissions stay pending until approved or rejected.
          </p>
        </header>

        {error ? (
          <div className="rounded-2xl border border-rose-300/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        ) : null}

        {ordered.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/4 px-4 py-6 text-sm text-slate-300">
            No pending submissions.
          </div>
        ) : (
          <div className="space-y-3">
            {ordered.map((submission) => {
              const saving = savingId === submission.submissionId;
              return (
                <article
                  key={submission.submissionId}
                  className="rounded-2xl border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))] p-4 shadow-[0_12px_30px_rgba(2,6,23,0.36)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-slate-400">
                        {submission.bookId} · Chapter {submission.chapterNumber} · {submission.scope}
                      </p>
                      <h2 className="mt-0.5 text-lg font-semibold text-slate-100">
                        {submission.title}
                      </h2>
                      <p className="mt-1 text-xs text-slate-400">
                        Submitted by {submission.userId} · +{submission.pointsAwarded} points ·{" "}
                        {new Date(submission.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 space-y-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                        Scenario
                      </p>
                      <p className="mt-1 text-sm text-slate-200">{submission.scenario}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-300">
                        What to do
                      </p>
                      <p className="mt-1 text-sm text-slate-100">{submission.whatToDo}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-300">
                        Why it matters
                      </p>
                      <p className="mt-1 text-sm text-slate-200">{submission.whyItMatters}</p>
                    </div>
                  </div>

                  <textarea
                    value={notesById[submission.submissionId] ?? ""}
                    onChange={(event) =>
                      setNotesById((prev) => ({
                        ...prev,
                        [submission.submissionId]: event.target.value,
                      }))
                    }
                    placeholder="Optional review notes"
                    rows={2}
                    className="mt-3 w-full rounded-xl border border-white/15 bg-white/6 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/45"
                  />

                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void review(submission.submissionId, "approved")}
                      className={[
                        "rounded-xl px-4 py-2.5 text-sm font-semibold transition",
                        saving
                          ? "cursor-not-allowed border border-white/10 bg-white/4 text-slate-500"
                          : "border border-emerald-300/35 bg-emerald-500/14 text-emerald-100 hover:bg-emerald-500/24",
                      ].join(" ")}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void review(submission.submissionId, "rejected")}
                      className={[
                        "rounded-xl px-4 py-2.5 text-sm font-semibold transition",
                        saving
                          ? "cursor-not-allowed border border-white/10 bg-white/4 text-slate-500"
                          : "border border-rose-300/35 bg-rose-500/14 text-rose-100 hover:bg-rose-500/24",
                      ].join(" ")}
                    >
                      Reject
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {toast ? (
        <div className="fixed bottom-8 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-white/18 bg-[#0b1120]/95 px-3 py-2 text-sm text-slate-100 shadow-[0_14px_28px_rgba(2,6,23,0.55)]">
          {toast}
        </div>
      ) : null}
    </main>
  );
}
