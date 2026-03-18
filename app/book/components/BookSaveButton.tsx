"use client";

import { Bookmark, BookmarkCheck } from "lucide-react";

type BookSaveButtonProps = {
  saved: boolean;
  onToggle: () => void;
  disabled?: boolean;
  className?: string;
};

export function BookSaveButton({
  saved,
  onToggle,
  disabled = false,
  className = "",
}: BookSaveButtonProps) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onToggle();
      }}
      disabled={disabled}
      aria-pressed={saved}
      aria-label={saved ? "Remove from Read Next" : "Save to Read Next"}
      title={saved ? "Remove from Read Next" : "Save to Read Next"}
      className={[
        "cf-btn h-10 w-10 rounded-2xl px-0 disabled:cursor-not-allowed disabled:opacity-60",
        saved
          ? "border-(--cf-accent-border) bg-(--cf-accent-soft) text-(--cf-accent)"
          : "border-(--cf-border) bg-(--cf-surface-muted) text-(--cf-text-3) hover:border-(--cf-border-strong) hover:bg-(--cf-input-bg-hover) hover:text-(--cf-text-1)",
        className,
      ].join(" ")}
    >
      {saved ? <BookmarkCheck className="h-4.5 w-4.5" /> : <Bookmark className="h-4.5 w-4.5" />}
    </button>
  );
}
