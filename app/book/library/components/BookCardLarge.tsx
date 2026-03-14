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
      className: "border-emerald-300/30 bg-emerald-400/18 text-emerald-100",
    };
  }
  if (entry.status === "in_progress") {
    return {
      label: "In Progress",
      className: "border-sky-300/30 bg-sky-400/18 text-sky-100",
    };
  }
  return {
    label: entry.isNew ? "New" : "Not Started",
    className: "border-white/30 bg-white/8 text-slate-200",
  };
}

function difficultyChipClass(value: LibraryBookEntry["difficulty"]): string {
  if (value === "Easy") return "border-emerald-300/28 bg-emerald-400/12 text-emerald-200";
  if (value === "Medium") return "border-amber-300/28 bg-amber-400/12 text-amber-200";
  return "border-rose-300/28 bg-rose-400/12 text-rose-200";
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

  return (
    <div className="group relative w-full rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))] p-4 transition duration-200 hover:-translate-y-1 hover:border-sky-300/30 hover:shadow-[0_22px_52px_rgba(2,6,23,0.58)] sm:p-5">
      {onToggleSaved ? (
        <div className="absolute left-6 top-6 z-10">
          <BookSaveButton saved={saved} onToggle={onToggleSaved} />
        </div>
      ) : null}
      <button
        type="button"
        onClick={onOpen}
        className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/45"
        aria-label={`Open details for ${entry.title}`}
      >
        <div className="relative h-72 overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(140deg,rgba(51,65,85,0.6),rgba(30,41,59,0.65))] sm:h-80">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_95%_at_0%_0%,rgba(56,189,248,0.10),transparent_56%)]"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_95%_at_100%_100%,rgba(2,6,23,0.35),transparent_70%)]"
          />
          <span className="absolute right-3 top-3">
            <span
              className={[
                "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium",
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
              className="h-full w-full rounded-2xl border border-white/10 bg-white/6"
              imageClassName="object-contain bg-white"
              fallbackClassName="text-6xl drop-shadow-[0_10px_22px_rgba(2,6,23,0.55)]"
              sizes="(max-width: 768px) 70vw, 28vw"
            />
          </div>
          {entry.status === "in_progress" ? (
            <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full border border-sky-300/25 bg-sky-400/12 px-2.5 py-1 text-xs text-sky-100 opacity-0 transition duration-200 group-hover:opacity-100">
              Continue
              <ArrowRight className="h-3.5 w-3.5" />
            </span>
          ) : null}
        </div>

        <div className="mt-4">
          <h3 className="text-xl font-semibold tracking-tight text-slate-100 transition duration-150 group-hover:text-white">
            {entry.title}
          </h3>
          <p className="mt-0.5 text-sm text-slate-400">{entry.author}</p>

          <div className="mt-2.5 flex flex-wrap gap-2 text-xs">
            <span className="rounded-lg border border-white/20 bg-white/6 px-2.5 py-1 text-slate-300">
              {entry.category}
            </span>
            <span
              className={[
                "rounded-lg border px-2.5 py-1",
                difficultyChipClass(entry.difficulty),
              ].join(" ")}
            >
              {entry.difficulty}
            </span>
            <span className="inline-flex items-center gap-1 rounded-lg border border-white/12 bg-white/3 px-2.5 py-1 text-slate-400">
              <Sparkles className="h-3 w-3" />
              ~{Math.round((entry.estimatedMinutes / 60) * 10) / 10}h
            </span>
          </div>

          <div className="mt-3.5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>{entry.chaptersCompleted}/{entry.chaptersTotal} chapters</span>
              <span className={entry.status === "completed" ? "font-medium text-emerald-300" : entry.status === "in_progress" ? "font-medium text-sky-300" : ""}>
                {entry.progressPercent}%
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-900/60">
              <div
                className={[
                  "h-full rounded-full transition-[width] duration-500",
                  entry.status === "completed"
                    ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]"
                    : entry.status === "in_progress"
                      ? "bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.4)]"
                      : "bg-white/20",
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
