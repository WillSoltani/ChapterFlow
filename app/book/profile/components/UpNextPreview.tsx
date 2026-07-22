"use client";

import { ArrowUpRight, BookOpen } from "lucide-react";

export function UpNextPreview({
  label,
  bookTitle,
  category,
  onClick,
}: {
  label: string;
  bookTitle: string;
  category?: string;
  onClick: () => void;
}) {
  return (
    <div className="mt-4 border-t border-(--cf-divider) pt-4">
      <button type="button" onClick={onClick} className="group flex items-center gap-2 text-left text-sm text-(--cf-text-3) transition hover:text-(--cf-text-2)">
        <BookOpen className="h-4 w-4 shrink-0" />
        <span>
          {label}: <span className="font-medium text-(--cf-text-2) group-hover:text-(--cf-text-1)">{bookTitle}</span>
        </span>
        {category ? (
          <span className="cf-pill shrink-0 px-2 py-0.5 text-[10px] text-(--cf-text-3)">{category}</span>
        ) : null}
        <ArrowUpRight className="h-3.5 w-3.5 shrink-0 opacity-0 transition group-hover:opacity-100" />
      </button>
    </div>
  );
}
