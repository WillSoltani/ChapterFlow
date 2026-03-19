"use client";

import { ArrowRight, Check, Sparkles } from "lucide-react";
import { BookSaveButton } from "@/app/book/components/BookSaveButton";
import type { LibraryBookEntry } from "@/app/book/data/mockUserLibraryState";
import { BookCover } from "@/app/book/components/BookCover";

function statusBadge(entry: LibraryBookEntry): {
  label: string;
  className: string;
} {
  if (entry.status === "completed") {
    return {
      label: "Completed",
      className: "cf-pill cf-pill-success",
    };
  }
  if (entry.status === "in_progress") {
    return {
      label: "In Progress",
      className: "cf-pill cf-pill-info",
    };
  }
  return {
    label: entry.isNew ? "New" : "Not Started",
    className: "cf-pill",
  };
}

function difficultyChipClass(value: LibraryBookEntry["difficulty"]): string {
  if (value === "Easy") return "cf-pill cf-pill-success";
  if (value === "Medium") return "cf-pill cf-pill-warning";
  return "cf-pill cf-pill-danger";
}

type BookCardLargeProps = {
  entry: LibraryBookEntry;
  onOpen: () => void;
  saved?: boolean;
  onToggleSaved?: () => void;
};

export function BookCardLarge({
  entry,
  onOpen,
  saved = false,
  onToggleSaved,
}: BookCardLargeProps) {
  const badge = statusBadge(entry);
  const progressTone =
    entry.status === "completed"
      ? "text-(--cf-success-text)"
      : entry.status === "in_progress"
        ? "text-(--cf-accent)"
        : "text-(--cf-text-3)";

  return (
    <div className="cf-panel cf-panel-hover group relative w-full rounded-3xl p-4 sm:p-5">
      {onToggleSaved ? (
        <div className="absolute left-6 top-6 z-10">
          <BookSaveButton saved={saved} onToggle={onToggleSaved} />
        </div>
      ) : null}
      <button
        type="button"
        onClick={onOpen}
        className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--cf-accent-soft)"
        aria-label={`Open details for ${entry.title}`}
      >
        <div className="cf-panel-muted relative h-72 overflow-hidden rounded-2xl sm:h-80">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_95%_at_0%_0%,rgba(56,189,248,0.07),transparent_56%)]"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_95%_at_100%_100%,rgba(0,0,0,0.04),transparent_70%)]"
          />
          <span className="absolute right-3 top-3">
            <span
              className={[
                "px-2.5 py-1 text-xs font-medium",
                badge.className,
              ].join(" ")}
            >
              {entry.status === "completed" ? <Check className="h-3.5 w-3.5" /> : null}
              {badge.label}
            </span>
          </span>
          <div className="absolute inset-0 flex items-center justify-center px-10 py-8">
            <BookCover
              bookId={entry.id}
              title={entry.title}
              icon={entry.icon}
              coverImage={entry.coverImage}
              className="h-full w-auto max-w-full aspect-[2/3] rounded-2xl border border-(--cf-border) bg-(--cf-surface) shadow-[0_14px_30px_rgba(15,23,42,0.18)]"
              imageClassName="object-cover bg-white"
              fallbackClassName="text-6xl drop-shadow-[0_10px_22px_rgba(2,6,23,0.55)]"
              sizes="(max-width: 768px) 70vw, 28vw"
            />
          </div>
          {entry.status === "in_progress" ? (
            <span className="cf-pill cf-pill-info absolute bottom-3 left-3 px-2.5 py-1 text-xs opacity-0 transition duration-200 group-hover:opacity-100">
              Continue
              <ArrowRight className="h-3.5 w-3.5" />
            </span>
          ) : null}
        </div>

        <div className="mt-4">
          <h3 className="text-xl font-semibold tracking-tight text-(--cf-text-1) transition duration-150 group-hover:text-(--cf-text-1)">
            {entry.title}
          </h3>
          <p className="mt-0.5 text-sm text-(--cf-text-3)">{entry.author}</p>

          <div className="mt-2.5 flex flex-wrap gap-2 text-xs">
            <span className="cf-pill rounded-lg px-2.5 py-1">
              {entry.category}
            </span>
            <span
              className={[
                "rounded-lg px-2.5 py-1",
                difficultyChipClass(entry.difficulty),
              ].join(" ")}
            >
              {entry.difficulty}
            </span>
            <span className="cf-pill rounded-lg px-2.5 py-1">
              <Sparkles className="h-3 w-3" />
              ~{Math.round((entry.estimatedMinutes / 60) * 10) / 10}h
            </span>
          </div>

          <div className="mt-3.5">
            <div className="flex items-center justify-between text-xs text-(--cf-text-3)">
              <span>{entry.chaptersCompleted}/{entry.chaptersTotal} chapters</span>
              <span className={["font-medium", progressTone].join(" ")}>
                {entry.progressPercent}%
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-(--cf-border)">
              <div
                className={[
                  "h-full rounded-full transition-[width] duration-500",
                  entry.status === "completed"
                    ? "bg-(--cf-success-text)"
                    : entry.status === "in_progress"
                      ? "bg-(--cf-accent)"
                      : "bg-(--cf-text-soft)",
                ].join(" ")}
                style={{ width: `${Math.max(entry.progressPercent, 0)}%` }}
              />
            </div>
          </div>
        </div>
      </button>
    </div>
  );
}
