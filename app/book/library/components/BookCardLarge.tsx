"use client";

import { ArrowRight, Check, Sparkles } from "lucide-react";
import { BookSaveButton } from "@/app/book/components/BookSaveButton";
import { BookCover } from "@/app/book/components/BookCover";
import type { LibraryBookEntry } from "@/app/book/_lib/library-data";

type BookCardEntry = Pick<
  LibraryBookEntry,
  | "id"
  | "title"
  | "author"
  | "icon"
  | "coverImage"
  | "category"
  | "difficulty"
  | "estimatedMinutes"
  | "status"
  | "progressPercent"
  | "chaptersTotal"
  | "chaptersCompleted"
  | "isNew"
>;

function statusBadge(entry: BookCardEntry): {
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

function difficultyChipClass(value: BookCardEntry["difficulty"]): string {
  if (value === "Easy") return "cf-pill cf-pill-success";
  if (value === "Medium") return "cf-pill cf-pill-warning";
  return "cf-pill cf-pill-danger";
}

type BookCardLargeProps = {
  entry: BookCardEntry;
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
    <div className="group relative w-full cursor-pointer rounded-3xl border border-(--cf-border) bg-(--cf-surface) p-4 shadow-[0_18px_45px_rgba(15,23,42,0.04)] transition duration-200 motion-safe:hover:-translate-y-1 motion-safe:hover:border-(--cf-border-strong) motion-safe:hover:shadow-[0_28px_65px_rgba(15,23,42,0.14)] focus-within:-translate-y-1 focus-within:border-(--cf-accent-border) focus-within:shadow-[0_28px_65px_rgba(15,23,42,0.14)] sm:p-5">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[radial-gradient(120%_110%_at_100%_0%,rgba(255,255,255,0.08),transparent_40%)] opacity-0 transition duration-300 group-hover:opacity-100 group-focus-within:opacity-100"
      />
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
        <div className="cf-panel-muted relative h-72 overflow-hidden rounded-2xl border border-(--cf-border) sm:h-80">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_95%_at_0%_0%,var(--cf-accent-muted),transparent_56%)]"
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
              className="h-full w-auto max-w-full aspect-[2/3] rounded-2xl border border-(--cf-border) bg-(--cf-surface) shadow-[0_16px_34px_rgba(15,23,42,0.18)] transition duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_22px_42px_rgba(15,23,42,0.24)] group-focus-within:-translate-y-1"
              imageClassName="object-cover bg-white"
              fallbackClassName="text-6xl drop-shadow-[0_10px_22px_rgba(2,6,23,0.55)]"
              sizes="(max-width: 768px) 70vw, 28vw"
            />
          </div>
          <span className="cf-pill cf-pill-info absolute bottom-3 left-3 px-2.5 py-1 text-xs opacity-100 sm:opacity-0 sm:transition sm:duration-200 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
            {entry.status === "in_progress" ? "Continue" : "Open book"}
            <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </div>

        <div className="mt-4">
          <h3 className="text-xl font-semibold tracking-tight text-(--cf-text-1) transition duration-150 group-hover:text-(--cf-accent-strong) group-focus-within:text-(--cf-accent-strong)">
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

          <div className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-(--cf-accent) transition group-hover:translate-x-0.5 group-focus-within:translate-x-0.5">
            <span>{entry.status === "in_progress" ? "Pick up where you left off" : "View book details"}</span>
            <ArrowRight className="h-4 w-4" />
          </div>
        </div>
      </button>
    </div>
  );
}
