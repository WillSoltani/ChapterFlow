"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import type { ActiveBook, CompletedBook, LearningStep } from "./progressTypes";
import { ChapterProgressBar } from "./ChapterProgressBar";

const STEP_CTA: Record<LearningStep, string> = {
  summary: "Read Summary",
  scenarios: "Explore Scenarios",
  quiz: "Take Quiz",
  unlock: "Unlock Next Chapter",
};

function formatRelativeDate(isoDate: string): string {
  if (!isoDate) return "";
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

interface ActiveBookRowProps {
  book: ActiveBook;
}

export function ActiveBookRow({ book }: ActiveBookRowProps) {
  const ctaText = STEP_CTA[book.currentStep];
  const href =
    book.completedChapters > 0 || book.currentStep !== "summary"
      ? `/book/library/${encodeURIComponent(book.id)}/chapter/${encodeURIComponent(book.resumeChapterId)}`
      : `/book/library/${encodeURIComponent(book.id)}`;

  return (
    <div
      className="group flex items-center gap-3 rounded-xl px-3 py-3 transition-colors"
      style={{
        background: "transparent",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--cf-surface-muted)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      {/* Cover thumbnail */}
      <div
        className="shrink-0 overflow-hidden rounded-md"
        role="img"
        aria-label={`${book.title} cover`}
        style={{
          width: 40,
          height: 56,
          background: book.coverUrl
            ? undefined
            : "linear-gradient(135deg, rgba(56,189,248,0.2), rgba(167,139,250,0.2))",
        }}
      >
        {book.coverUrl ? (
          <Image
            src={book.coverUrl}
            alt={`${book.title} cover`}
            width={40}
            height={56}
            className="h-full w-full object-cover"
            sizes="40px"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center p-1">
            <span
              className="text-[7px] font-medium leading-tight text-center"
              style={{ color: "var(--text-heading)" }}
            >
              {book.title.split(" ").slice(0, 3).join(" ")}
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p
          className="truncate text-sm font-medium"
          style={{ color: "var(--text-heading)" }}
        >
          {book.title}
        </p>
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          {book.author}
        </p>

        {/* Progress bar */}
        <div className="mt-1.5">
          <ChapterProgressBar
            totalChapters={book.totalChapters}
            completedChapters={book.completedChapters}
            currentChapterNumber={book.currentChapterNumber}
            currentStepNumber={book.currentStepNumber}
            height={4}
          />
        </div>


        {/* Last activity */}
        <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
          Last: {book.lastActivity} {"\u00B7"}{" "}
          {formatRelativeDate(book.lastActivityDate)}
        </p>
      </div>

      {/* Right side: count + action */}
      <div className="flex shrink-0 flex-col items-end gap-2">
        <span className="tabular-nums" style={{ color: "var(--text-secondary)" }}>
          <span className="text-sm font-bold" style={{ color: "var(--text-heading)" }}>
            {book.completedChapters}
          </span>
          <span className="text-xs">/{book.totalChapters}</span>
        </span>
        <Link
          href={href}
          className="inline-flex cursor-pointer items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/50"
          style={{
            background: "transparent",
            color: "var(--accent-cyan)",
            border: "1px solid var(--accent-cyan)",
          }}
        >
          {ctaText}
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}

interface CompletedBookRowProps {
  book: CompletedBook;
}

export function CompletedBookRow({ book }: CompletedBookRowProps) {
  return (
    <div
      className="group flex items-center gap-3 rounded-xl px-3 py-3 transition-colors"
      style={{ background: "transparent" }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--cf-surface-muted)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      {/* Cover thumbnail */}
      <div
        className="shrink-0 overflow-hidden rounded-md"
        style={{
          width: 40,
          height: 56,
          background:
            "linear-gradient(135deg, rgba(52,211,153,0.2), rgba(167,139,250,0.2))",
        }}
      >
        <div className="flex h-full w-full items-center justify-center p-1">
          <span
            className="text-[7px] font-medium leading-tight text-center"
            style={{ color: "var(--text-heading)" }}
          >
            {book.title.split(" ").slice(0, 3).join(" ")}
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p
          className="truncate text-sm font-medium"
          style={{ color: "var(--text-heading)" }}
        >
          {book.title}
        </p>
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          {book.author}
        </p>
        <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
          Completed{" "}
          {new Date(book.completedDate).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </p>
      </div>

      {/* Right side */}
      <div className="flex shrink-0 flex-col items-end gap-2">
        {book.avgQuizScore > 0 && (
          <span
            className="rounded-md px-2 py-0.5 text-xs font-medium tabular-nums"
            style={{
              background: "rgba(52,211,153,0.1)",
              color: "var(--cf-success-text)",
            }}
          >
            Avg: {book.avgQuizScore}%
          </span>
        )}
        <div className="flex gap-1.5">
          <Link
            href={`/book/library/${encodeURIComponent(book.id)}`}
            className="inline-flex cursor-pointer items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors"
            style={{
              background: "var(--cf-surface-muted)",
              color: "var(--text-heading)",
              border: "1px solid var(--cf-border)",
            }}
          >
            Review
          </Link>
        </div>
      </div>
    </div>
  );
}
