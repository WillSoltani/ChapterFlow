"use client";

import { useCallback, useState } from "react";
import { CheckCircle, Clock, SkipForward } from "lucide-react";
import type { BookUserCommitmentItem } from "@/app/app/api/book/_lib/types";

type Props = {
  commitments: BookUserCommitmentItem[];
  onComplete: (commitmentId: string, reflection: string) => Promise<unknown>;
  onSkip: (commitmentId: string) => Promise<unknown>;
};

export function CommitmentFollowUpCard({ commitments, onComplete, onSkip }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [reflection, setReflection] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleComplete = useCallback(async () => {
    if (!activeId || reflection.trim().length < 10 || submitting) return;
    setSubmitting(true);
    try {
      await onComplete(activeId, reflection.trim());
      setActiveId(null);
      setReflection("");
    } catch {}
    setSubmitting(false);
  }, [activeId, reflection, submitting, onComplete]);

  const handleSkip = useCallback(
    async (id: string) => {
      await onSkip(id);
    },
    [onSkip],
  );

  if (commitments.length === 0) return null;

  return (
    <section className="cf-panel rounded-[26px] border border-(--cf-warning-border) bg-(--cf-surface) p-5 sm:p-6">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="h-4 w-4 text-(--cf-warning-text)" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-(--cf-warning-text)">
          Time to Check In
        </p>
      </div>

      <div className="space-y-3">
        {commitments.map((c) => (
          <div
            key={c.commitmentId}
            className="rounded-xl border border-(--cf-border) bg-(--cf-surface-muted) p-4"
          >
            <p className="text-sm font-medium text-(--cf-text-1) leading-relaxed">
              {c.ifThenPlan}
            </p>
            <p className="mt-1 text-xs text-(--cf-text-3)">
              Committed {new Date(c.commitDate).toLocaleDateString()}
            </p>

            {activeId === c.commitmentId ? (
              <div className="mt-3">
                <textarea
                  value={reflection}
                  onChange={(e) => setReflection(e.target.value)}
                  placeholder="How did it go? What happened when you tried it?"
                  rows={3}
                  className="w-full rounded-lg border border-(--cf-border) bg-(--cf-surface) px-3 py-2 text-sm text-(--cf-text-1) placeholder:text-(--cf-text-3) focus:border-(--cf-accent) focus:outline-none"
                />
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleComplete}
                    disabled={reflection.trim().length < 10 || submitting}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-(--cf-accent) px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
                  >
                    <CheckCircle className="h-3.5 w-3.5" />
                    {submitting ? "Saving..." : "Submit (+25 IP)"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setActiveId(null); setReflection(""); }}
                    className="text-xs text-(--cf-text-3) hover:text-(--cf-text-2)"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveId(c.commitmentId)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-(--cf-accent-border) bg-(--cf-accent-soft) px-3 py-1.5 text-xs font-semibold text-(--cf-info-text) transition hover:bg-(--cf-accent-muted)"
                >
                  How did it go?
                </button>
                <button
                  type="button"
                  onClick={() => handleSkip(c.commitmentId)}
                  className="inline-flex items-center gap-1 text-xs text-(--cf-text-3) hover:text-(--cf-text-2)"
                >
                  <SkipForward className="h-3 w-3" />
                  Skip
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
