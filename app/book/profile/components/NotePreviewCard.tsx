"use client";

import { ArrowUpRight } from "lucide-react";
import { renderInlineMarkdown } from "./profile-markdown";

export function NotePreviewCard({
  title, body, meta, actionLabel, onAction,
}: {
  title: string; body: string; meta: string; actionLabel?: string; onAction?: () => void;
}) {
  return (
    <div className="rounded-3xl border border-(--cf-border) bg-(--cf-surface) p-4 shadow-shadow-card">
      <p className="text-sm font-semibold text-(--cf-text-1)">{title}</p>
      <p className="mt-3 line-clamp-4 text-sm leading-7 text-(--cf-text-2)">{renderInlineMarkdown(body)}</p>
      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.18em] text-(--cf-text-3)">{meta}</p>
        {actionLabel && onAction ? (
          <button type="button" onClick={onAction} className="inline-flex items-center gap-1 text-sm text-(--cf-accent) transition hover:text-(--cf-accent-strong)">
            {actionLabel}<ArrowUpRight className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
