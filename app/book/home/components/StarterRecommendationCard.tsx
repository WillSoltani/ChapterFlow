"use client";

import Link from "next/link";
import { Sparkles, X } from "lucide-react";
import type { StarterPrescription } from "@/app/book/hooks/useStarterPrescription";

type Props = {
  prescription: StarterPrescription;
  onDismiss: () => void;
};

export function StarterRecommendationCard({ prescription, onDismiss }: Props) {
  const chapterRoute = `/book/library/${encodeURIComponent(prescription.bookId)}/chapter/ch01?session=1`;

  return (
    <article className="cf-panel relative overflow-hidden rounded-[26px] border border-(--cf-accent-border) bg-[linear-gradient(135deg,var(--cf-accent-soft),var(--cf-surface))] p-5 sm:p-6">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-12 -top-16 h-56 w-56 rounded-full bg-(--cf-accent-muted) blur-3xl"
      />

      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-(--cf-accent)" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-(--cf-accent)">
              Your Recommended Start
            </p>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-(--cf-text-3) transition hover:bg-(--cf-surface-muted) hover:text-(--cf-text-1)"
            aria-label="Dismiss recommendation"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <h3 className="mt-3 text-xl font-semibold text-(--cf-text-1)">
          {prescription.bookTitle}
        </h3>
        <p className="mt-0.5 text-sm text-(--cf-text-3)">
          by {prescription.bookAuthor}
        </p>

        <p className="mt-3 text-sm leading-relaxed text-(--cf-text-2)">
          {prescription.reasonDetail}
        </p>

        <div className="mt-4 flex items-center gap-3">
          <Link
            href={chapterRoute}
            className="inline-flex items-center gap-2 rounded-xl bg-linear-to-r from-(--cf-accent) to-(--cf-accent-strong) px-4 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_var(--cf-accent-shadow)] transition hover:brightness-110"
          >
            Start Chapter 1
          </Link>
          <span className="rounded-full border border-(--cf-accent-border) bg-(--cf-surface) px-3 py-1 text-xs font-semibold text-(--cf-info-text)">
            {prescription.reason}
          </span>
        </div>
      </div>
    </article>
  );
}
