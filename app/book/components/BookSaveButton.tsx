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
        "inline-flex h-10 w-10 items-center justify-center rounded-2xl border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/45 disabled:cursor-not-allowed disabled:opacity-60",
        saved
          ? "border-sky-300/35 bg-sky-500/16 text-sky-100 hover:bg-sky-500/22"
          : "border-white/12 bg-white/6 text-slate-300 hover:border-white/25 hover:bg-white/10 hover:text-slate-100",
        className,
      ].join(" ")}
    >
      {saved ? <BookmarkCheck className="h-4.5 w-4.5" /> : <Bookmark className="h-4.5 w-4.5" />}
    </button>
  );
}
