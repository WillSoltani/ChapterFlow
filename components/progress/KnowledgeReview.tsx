"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { ReviewData, ActiveBook } from "./progressTypes";

interface KnowledgeReviewProps {
  reviews: ReviewData;
  firstActiveBook: ActiveBook | null;
}

function getDayLabel(dateStr: string): string {
  const date = new Date(`${dateStr}T12:00:00`);
  return date.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 3);
}

function isToday(dateStr: string): boolean {
  const today = new Date();
  const date = new Date(`${dateStr}T12:00:00`);
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

export function KnowledgeReview({
  reviews,
  firstActiveBook,
}: KnowledgeReviewProps) {
  const prefersReduced = useReducedMotion();
  const totalDue = reviews.overdueCount + reviews.dueTodayCount;
  const hasReviews = totalDue > 0 || reviews.upcomingThisWeekCount > 0 || reviews.totalConceptsLearned > 0;

  // Determine counter color
  const counterColor =
    reviews.overdueCount > 0
      ? "var(--accent-rose)"
      : reviews.dueTodayCount > 0
        ? "var(--accent-amber)"
        : "var(--accent-emerald)";

  const bookHref = firstActiveBook
    ? `/book/library/${encodeURIComponent(firstActiveBook.id)}`
    : "/book/library";

  return (
    <motion.section
      className="rounded-2xl p-5"
      style={{
        background: "var(--cf-surface-muted)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: "1px solid var(--cf-border)",
        boxShadow: "var(--cf-shadow-md)",
      }}
      initial={{ opacity: prefersReduced ? 1 : 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.3 }}
    >
      <h2
        className="text-base font-semibold"
        style={{ color: "var(--text-heading)" }}
      >
        Knowledge Review
      </h2>

      <AnimatePresence mode="wait">
        {!hasReviews ? (
          /* State 1 — No quizzes completed yet */
          <motion.div
            key="empty"
            className="mt-4 flex flex-col items-center py-4 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <span className="text-5xl">{"\u{1F9E0}\u2728"}</span>
            <p
              className="mt-3 text-lg font-semibold"
              style={{ color: "var(--text-heading)" }}
            >
              Activate Spaced Repetition
            </p>
            <p
              className="mt-1.5 max-w-md text-sm"
              style={{ color: "var(--text-secondary)" }}
            >
              Complete your first quiz and ChapterFlow will automatically
              schedule reviews so you never forget what you learn.
            </p>
            <Link
              href={bookHref}
              className="mt-4 inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/50"
              style={{
                color: "var(--text-secondary)",
                border: "1px solid var(--cf-border-strong)",
              }}
            >
              Go to your first chapter {"\u2192"}
            </Link>
          </motion.div>
        ) : (
          /* State 2 — Reviews exist */
          <motion.div
            key="populated"
            className="mt-4 flex flex-col gap-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Primary counter */}
            <div className="flex items-baseline gap-2">
              <span
                className="font-(family-name:--font-display) text-3xl font-bold tabular-nums"
                style={{ color: counterColor }}
              >
                {totalDue}
              </span>
              <span
                className="text-sm"
                style={{ color: "var(--text-secondary)" }}
              >
                {totalDue === 0
                  ? "all caught up!"
                  : totalDue === 1
                    ? "concept to review today"
                    : "concepts to review today"}
              </span>
            </div>

            {/* Breakdown badges */}
            <div className="flex flex-wrap items-center gap-2">
              {reviews.overdueCount > 0 && (
                <span
                  className="rounded-full px-3 py-1 text-xs font-medium"
                  style={{
                    background: "rgba(244,63,94,0.1)",
                    color: "var(--cf-danger-text)",
                    border: "1px solid rgba(244,63,94,0.2)",
                  }}
                >
                  {reviews.overdueCount} overdue
                </span>
              )}
              {reviews.dueTodayCount > 0 && (
                <span
                  className="rounded-full px-3 py-1 text-xs font-medium"
                  style={{
                    background: "rgba(245,158,11,0.1)",
                    color: "var(--accent-amber)",
                    border: "1px solid rgba(245,158,11,0.2)",
                  }}
                >
                  {reviews.dueTodayCount === 1
                    ? "1 due today"
                    : `${reviews.dueTodayCount} due today`}
                </span>
              )}
              {reviews.upcomingThisWeekCount > 0 && (
                <span
                  className="rounded-full px-3 py-1 text-xs font-medium"
                  style={{
                    background: "rgba(34,211,238,0.1)",
                    color: "var(--accent-cyan)",
                    border: "1px solid rgba(34,211,238,0.2)",
                  }}
                >
                  {reviews.upcomingThisWeekCount} upcoming
                </span>
              )}
            </div>

            {/* Start Review button */}
            {totalDue > 0 && (
              <button
                type="button"
                className="cursor-pointer rounded-xl px-5 py-2.5 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/50"
                style={{
                  background: "var(--accent-cyan)",
                  color: "#fff",
                  width: "fit-content",
                  border: "1px solid rgba(34,211,238,0.3)",
                  boxShadow: "0 4px 12px rgba(34,211,238,0.25)",
                }}
              >
                Start Review {"\u2192"}
              </button>
            )}

            {/* 7-day forecast strip */}
            {reviews.forecast.length > 0 && (
              <div className="flex gap-1.5">
                {reviews.forecast.slice(0, 7).map((day) => {
                  const isTodayCell = isToday(day.date);
                  return (
                    <div
                      key={day.date}
                      className="flex flex-col items-center gap-1 rounded-lg px-2 py-1.5"
                      style={{
                        width: 40,
                        background: isTodayCell
                          ? "rgba(56,189,248,0.1)"
                          : day.count > 0
                            ? "var(--cf-surface-muted)"
                            : "transparent",
                        border: isTodayCell
                          ? "2px solid rgba(56,189,248,0.4)"
                          : "1px solid transparent",
                      }}
                    >
                      <span
                        className="text-[10px]"
                        style={{
                          color: isTodayCell
                            ? "var(--cf-accent)"
                            : "var(--text-muted)",
                        }}
                      >
                        {getDayLabel(day.date)}
                      </span>
                      {day.count > 0 ? (
                        <span
                          className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold"
                          style={{
                            background: "rgba(56,189,248,0.2)",
                            color: "var(--cf-accent)",
                          }}
                        >
                          {day.count}
                        </span>
                      ) : (
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ background: "var(--cf-border-strong)" }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}
