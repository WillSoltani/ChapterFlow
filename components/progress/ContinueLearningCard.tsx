"use client";

import Link from "next/link";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import type { ActiveBook, LearningStep } from "./progressTypes";
import { StepIndicator } from "./StepIndicator";
import { ChapterProgressBar } from "./ChapterProgressBar";

interface ContinueLearningCardProps {
  primaryBook: ActiveBook;
  otherBooks: ActiveBook[];
  onSwitchBook?: (bookId: string) => void;
}

const STEP_CTA: Record<LearningStep, string> = {
  summary: "Read Summary",
  scenarios: "Explore Scenarios",
  quiz: "Take Quiz",
  unlock: "Unlock Next Chapter",
};

function getBookHref(book: ActiveBook): string {
  if (book.completedChapters > 0 || book.currentStep !== "summary") {
    return `/book/library/${encodeURIComponent(book.id)}/chapter/${encodeURIComponent(book.resumeChapterId)}`;
  }
  return `/book/library/${encodeURIComponent(book.id)}`;
}

export function ContinueLearningCard({
  primaryBook,
  otherBooks,
  onSwitchBook,
}: ContinueLearningCardProps) {
  const prefersReduced = useReducedMotion();
  const ctaText = STEP_CTA[primaryBook.currentStep];
  const bookHref = getBookHref(primaryBook);

  return (
    <motion.div
      className="rounded-2xl p-6"
      style={{
        background: "var(--cf-surface-muted)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        border: "1px solid var(--cf-border-strong)",
        boxShadow: "var(--cf-shadow-lg)",
      }}
      initial={{
        opacity: prefersReduced ? 1 : 0,
        x: prefersReduced ? 0 : 20,
      }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, ease: "easeOut", delay: 0.4 }}
    >
      {/* Header label */}
      <h2
        className="text-xs font-semibold uppercase tracking-wider"
        style={{ color: "var(--text-muted)" }}
      >
        Continue Learning
      </h2>

      {/* Book info */}
      <div className="mt-4 flex gap-4">
        {/* Cover */}
        <div
          className="shrink-0 overflow-hidden rounded-lg"
          role="img"
          aria-label={`${primaryBook.title} cover`}
          style={{
            width: 80,
            height: 120,
            background: primaryBook.coverUrl
              ? undefined
              : "linear-gradient(135deg, rgba(56,189,248,0.3), rgba(167,139,250,0.3))",
            boxShadow: "var(--cf-shadow-md)",
          }}
        >
          {primaryBook.coverUrl ? (
            <Image
              src={primaryBook.coverUrl}
              alt={`${primaryBook.title} cover`}
              width={80}
              height={120}
              className="h-full w-full object-cover"
              sizes="80px"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center p-2 text-center">
              <span
                className="text-[10px] font-semibold leading-tight"
                style={{ color: "var(--text-heading)" }}
              >
                {primaryBook.title}
              </span>
            </div>
          )}
        </div>

        {/* Title block */}
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <h3
            className="text-lg font-semibold leading-snug"
            style={{ color: "var(--text-heading)" }}
          >
            {primaryBook.title}
          </h3>
          <p
            className="mt-0.5 text-sm"
            style={{ color: "var(--text-secondary)" }}
          >
            {primaryBook.author}
          </p>
          {primaryBook.readersCount > 0 && (
            <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
              {primaryBook.readersCount.toLocaleString()} readers learning this
            </p>
          )}
        </div>
      </div>

      {/* 4-Step Learning Loop Indicator */}
      <div className="mt-5">
        <StepIndicator
          currentStep={primaryBook.currentStepNumber}
          size="md"
        />
      </div>

      {/* Chapter context */}
      <p className="mt-3 text-sm" style={{ color: "var(--text-secondary)" }}>
        Chapter {primaryBook.currentChapterNumber} of{" "}
        {primaryBook.totalChapters} {"\u00B7"}{" "}
        {primaryBook.currentChapterTitle}
      </p>

      {/* Chapter progress bar */}
      <div className="mt-3">
        <ChapterProgressBar
          totalChapters={primaryBook.totalChapters}
          completedChapters={primaryBook.completedChapters}
          currentChapterNumber={primaryBook.currentChapterNumber}
          currentStepNumber={primaryBook.currentStepNumber}
          height={6}
        />
      </div>

      {/* Action button */}
      <Link href={bookHref} className="mt-5 block">
        <motion.button
          type="button"
          className="w-full cursor-pointer rounded-xl px-6 py-3.5 text-base font-semibold text-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--cf-accent-border) focus-visible:ring-offset-2 focus-visible:ring-offset-(--cf-page-bg)"
          style={{
            background: "linear-gradient(135deg, var(--cf-accent), var(--cf-accent-strong))",
            border: "1px solid rgba(6,182,212,0.3)",
            boxShadow: "0 4px 16px rgba(6,182,212,0.2)",
          }}
          whileHover={{ scale: 1.02, y: -1 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 400, damping: 17 }}
        >
          {ctaText} {"\u2192"}
        </motion.button>
      </Link>

      {/* Next reward teaser */}
      <p className="mt-3 text-xs" style={{ color: "var(--text-muted)" }}>
        Complete this step to earn +50 FP and progress toward{" "}
        {"\u{1F3C5}"} First Steps
      </p>

      {/* Other active books */}
      {otherBooks.length > 0 && (
        <div className="mt-5 border-t pt-4" style={{ borderColor: "var(--cf-border)" }}>
          <span
            className="text-xs"
            style={{ color: "var(--text-muted)" }}
          >
            Other active books
          </span>
          <div className="mt-2 flex gap-3 overflow-x-auto pb-1 snap-x">
            {otherBooks.map((book) => (
              <button
                key={book.id}
                type="button"
                onClick={() => onSwitchBook?.(book.id)}
                className="flex shrink-0 cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 transition-colors snap-start"
                style={{
                  background: "var(--cf-surface-muted)",
                  border: "1px solid var(--cf-border)",
                  minWidth: 200,
                }}
              >
                {/* Mini cover */}
                <div
                  className="shrink-0 overflow-hidden rounded"
                  style={{
                    width: 36,
                    height: 52,
                    background: book.coverUrl
                      ? undefined
                      : "linear-gradient(135deg, rgba(56,189,248,0.2), rgba(167,139,250,0.2))",
                  }}
                >
                  {book.coverUrl ? (
                    <Image
                      src={book.coverUrl}
                      alt={`${book.title} cover`}
                      width={36}
                      height={52}
                      className="h-full w-full object-cover"
                      sizes="36px"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <span
                        className="text-[7px] font-medium leading-tight"
                        style={{ color: "var(--text-heading)" }}
                      >
                        {book.title.split(" ").slice(0, 2).join(" ")}
                      </span>
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <p
                    className="truncate text-xs font-medium"
                    style={{ color: "var(--text-heading)" }}
                  >
                    {book.title}
                  </p>
                  <div className="mt-1">
                    <StepIndicator
                      currentStep={book.currentStepNumber}
                      size="sm"
                    />
                  </div>
                </div>
                <ArrowRight
                  className="h-3.5 w-3.5 shrink-0"
                  style={{ color: "var(--text-muted)" }}
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

/** Empty state when user has no active books */
export function NoActiveBooksCard() {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-2xl p-8 text-center"
      style={{
        background: "var(--cf-surface-muted)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: "1px solid var(--cf-border)",
      }}
    >
      <span className="text-4xl">{"\u{1F4DA}"}</span>
      <h3
        className="mt-3 text-lg font-semibold"
        style={{ color: "var(--text-heading)" }}
      >
        Choose Your First Book
      </h3>
      <p
        className="mt-1.5 text-sm"
        style={{ color: "var(--text-secondary)" }}
      >
        Start with any of our 95+ books {"\u2014"} 2 are completely free.
      </p>
      <Link
        href="/book/library"
        className="mt-4 inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all"
        style={{
          background: "var(--accent-teal)",
          color: "var(--bg-base)",
        }}
      >
        Browse Library {"\u2192"}
      </Link>
    </div>
  );
}
