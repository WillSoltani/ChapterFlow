"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Clock, Target } from "lucide-react";

type IfThenPlan = { plan: string; context?: string };

type CommitmentPromptProps = {
  ifThenPlans: IfThenPlan[];
  bookId: string;
  chapterNumber: number;
  fontScaleClass: string;
  onCommit: (params: {
    bookId: string;
    chapterNumber: number;
    ifThenPlan: string;
    followUpDays: 3 | 7;
  }) => Promise<void>;
  hasActiveCommitment: boolean;
  /** The follow-up window of the EXISTING active commitment (when hydrated from
   *  the server), so the "Committed" view shows the real value rather than the
   *  local default. Undefined until known / for a not-yet-committed chapter. */
  activeFollowUpDays?: 3 | 7;
};

export function CommitmentPrompt({
  ifThenPlans,
  bookId,
  chapterNumber,
  fontScaleClass,
  onCommit,
  hasActiveCommitment,
  activeFollowUpDays,
}: CommitmentPromptProps) {
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [followUpDays, setFollowUpDays] = useState<3 | 7>(3);
  const [submitting, setSubmitting] = useState(false);
  const [committed, setCommitted] = useState(hasActiveCommitment);
  const [error, setError] = useState<string | null>(null);

  // The committed flag is hydrated asynchronously by the parent (server truth via
  // useCommitments), so the prop can flip from false→true after mount. Mirror it
  // into local state so the "Committed" view appears without needing a remount.
  useEffect(() => {
    setCommitted(hasActiveCommitment);
  }, [hasActiveCommitment]);

  const handleCommit = useCallback(async () => {
    if (!selectedPlan || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await onCommit({ bookId, chapterNumber, ifThenPlan: selectedPlan, followUpDays });
      setCommitted(true);
    } catch (e) {
      console.error("Failed to create commitment:", e);
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [selectedPlan, submitting, onCommit, bookId, chapterNumber, followUpDays]);

  if (committed) {
    return (
      <section className="cr-glass-card border-(--cr-success)/30 px-6 py-5">
        <div className="flex items-center gap-2">
          <Check className="h-4 w-4 text-(--cr-success)" />
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-(--cr-success)">
            Committed
          </p>
        </div>
        <p className={`mt-2 text-(--cr-text-secondary) leading-relaxed ${fontScaleClass}`}>
          Check back on your home page in {activeFollowUpDays ?? followUpDays} days to reflect on how it went.
        </p>
      </section>
    );
  }

  if (ifThenPlans.length === 0) return null;

  return (
    <section className="cr-glass-card border-(--cr-accent)/20 px-6 py-5">
      <div className="flex items-center gap-2 mb-3">
        <Target className="h-4 w-4 text-(--cr-accent)" />
        <p className="text-xs font-bold uppercase tracking-[0.1em] text-(--cr-accent)">
          Apply This Week
        </p>
      </div>
      <p className={`mb-4 text-(--cr-text-secondary) leading-relaxed ${fontScaleClass}`}>
        Pick one action to try this week, then reflect on how it went.
      </p>

      <ul className="space-y-2.5">
        {ifThenPlans.map((plan, i) => {
          const isSelected = selectedPlan === plan.plan;
          return (
            <li key={i}>
              <button
                type="button"
                onClick={() => setSelectedPlan(isSelected ? null : plan.plan)}
                className={`w-full text-left rounded-lg border px-4 py-3 transition ${
                  isSelected
                    ? "border-(--cr-accent)/50 bg-(--cr-accent)/10"
                    : "border-(--cr-glass-border) bg-(--cr-bg-surface-3) hover:border-(--cr-accent)/30"
                }`}
              >
                <p className={`text-[14px] leading-relaxed ${
                  isSelected ? "text-(--cr-text-heading)" : "text-(--cr-text-secondary)"
                }`}>
                  {plan.plan}
                </p>
              </button>
            </li>
          );
        })}
      </ul>

      {selectedPlan && (
        <div className="mt-4 flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[12px] text-(--cr-text-disabled)">
            <Clock className="h-3.5 w-3.5" />
            <span>Check in after</span>
          </div>
          <div className="flex gap-1.5">
            {([3, 7] as const).map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => setFollowUpDays(days)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  followUpDays === days
                    ? "bg-(--cr-accent) text-(--cr-text-inverse)"
                    : "border border-(--cr-glass-border) bg-(--cr-bg-surface-2) text-(--cr-text-secondary) hover:bg-(--cr-bg-surface-1)"
                }`}
              >
                {days} days
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={handleCommit}
            disabled={submitting}
            className="ml-auto rounded-xl bg-(--cr-accent) px-4 py-2 text-sm font-semibold text-(--cr-text-inverse) transition hover:brightness-110 disabled:opacity-50"
          >
            {submitting ? "Saving..." : "Commit"}
          </button>
        </div>
      )}

      {error && (
        <p className="mt-2 text-xs text-(--cr-error)">{error}</p>
      )}
    </section>
  );
}
