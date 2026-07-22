"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { DUR } from "@/lib/motion";
import { ProBadge } from "./ProBadge";
import { BookCover } from "@/components/ui/BookCover";
import { formatAttributedRatingsCount } from "@/lib/book-ratings";
import { Star } from "lucide-react";

interface UserBookData {
  id: string;
  title: string;
  author: string;
  coverUrl: string;
  progressPercent: number;
  status: "not_started" | "in_progress" | "completed";
  gradient?: string;
}

interface ProBookData {
  id: string;
  title: string;
  author: string;
  coverUrl: string;
  rating: number;
  readerCount: number;
  category: string;
  gradient?: string;
}

type BookCardWorkspaceProps =
  | { variant: "user"; book: UserBookData }
  | { variant: "pro"; book: ProBookData };

const statusConfig = {
  in_progress: { label: "In Progress", color: "var(--cf-accent)" },
  not_started: { label: "Not Started", color: "var(--cf-text-soft)" },
  completed: { label: "Completed", color: "var(--cf-success-text)" },
};

export function BookCardWorkspace(props: BookCardWorkspaceProps) {
  const prefersReducedMotion = useReducedMotion();
  const { variant, book } = props;

  return (
    <Link href={`/book/library/${book.id}`} className="block flex-shrink-0">
    <motion.div
      className="overflow-hidden rounded-xl cf-focus"
      style={{
        width: 170,
        background: "var(--cf-surface-muted)",
        backdropFilter: "blur(16px) saturate(125%)",
        WebkitBackdropFilter: "blur(16px) saturate(125%)",
        border: "1px solid var(--cf-border)",
        boxShadow: "var(--cf-shadow-md)",
      }}
      whileHover={
        prefersReducedMotion
          ? undefined
          : { scale: 1.03, y: -8 }
      }
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      role="listitem"
    >
      {/* Cover */}
      <div className="relative">
        <div className="relative overflow-hidden" style={{ height: 200 }}>
          <BookCover
            bookId={book.id}
            title={book.title}
            coverGradient={book.gradient ?? "linear-gradient(135deg, var(--cf-cover-fallback-start) 0%, var(--cf-cover-fallback-end) 100%)"}
            coverImage={book.coverUrl || undefined}
            fill
            sizes="170px"
            className="ring-1 ring-white/[0.06] shadow-shadow-elevated"
          />
          {/* Subtle bottom fade for text readability */}
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-12"
            style={{
              background: "linear-gradient(to top, color-mix(in srgb, var(--cf-palette-black) 30%, transparent), transparent)",
            }}
          />
          {/* In-progress cover bar */}
          {variant === "user" && (book as UserBookData).status === "in_progress" && (
            <div
              className="absolute inset-x-0 bottom-0"
              style={{ height: 3, background: "color-mix(in srgb, var(--cf-palette-black) 30%, transparent)" }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${(book as UserBookData).progressPercent}%`,
                  background: "var(--accent-cyan)",
                  borderRadius: "0 1px 0 0",
                }}
              />
            </div>
          )}
        </div>
        {variant === "pro" && (
          <div className="absolute right-2 top-2">
            <ProBadge />
          </div>
        )}
        {variant === "user" && (book as UserBookData).status === "completed" && (
          <div
            className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full"
            style={{ background: "var(--cf-success-text)" }}
          >
            <svg width={10} height={10} viewBox="0 0 24 24" fill="none">
              <path
                d="M20 6L9 17L4 12"
                stroke="white"
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 pt-2.5">
        <p
          className="truncate text-sm font-medium"
          style={{ color: "var(--cf-text-1)" }}
        >
          {book.title}
        </p>
        <p
          className="mt-0.5 truncate text-xs"
          style={{ color: "var(--cf-text-soft)" }}
        >
          {book.author}
        </p>

        {variant === "user" && (
          <>
            {/* Progress bar */}
            <div
              className="mt-2 h-[3px] overflow-hidden rounded-full"
              style={{ background: "var(--cf-progress-track)" }}
              role="progressbar"
              aria-valuenow={(book as UserBookData).progressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <motion.div
                className="h-full rounded-full"
                style={{ background: "var(--cf-accent)" }}
                initial={prefersReducedMotion ? undefined : { width: 0 }}
                animate={{
                  width: `${(book as UserBookData).progressPercent}%`,
                }}
                transition={
                  prefersReducedMotion
                    ? { duration: 0 }
                    : { duration: DUR.reveal, ease: "easeOut", delay: 0.4 }
                }
              />
            </div>
            <p
              className="mt-1.5 text-[10px] font-medium"
              style={{
                color: statusConfig[(book as UserBookData).status].color,
              }}
            >
              {statusConfig[(book as UserBookData).status].label}
            </p>
          </>
        )}

        {variant === "pro" && (
          <div
            className="mt-2 flex items-center gap-1 text-[10px]"
            style={{ color: "var(--cf-text-3)" }}
          >
            {(book as ProBookData).rating > 0 ? (
              <>
                <Star
                  size={11}
                  strokeWidth={0}
                  aria-hidden
                  style={{ color: "var(--accent-gold)", fill: "var(--accent-gold)" }}
                />
                <span className="tabular-nums">
                  {(book as ProBookData).rating.toFixed(1)}
                </span>
                {(book as ProBookData).readerCount > 0 && (
                  <>
                    <span style={{ color: "var(--cf-text-soft)" }}>·</span>
                    {/* These stars are a curated snapshot of public Goodreads
                       aggregate data (app/book/data/bookRatings.ts), NOT in-app
                       reader ratings — attribute the source inline so users don't
                       read "4.4 · 1.2M ratings" as a ChapterFlow community score. */}
                    <span>
                      {formatAttributedRatingsCount((book as ProBookData).readerCount)}
                    </span>
                  </>
                )}
              </>
            ) : (
              <span>{(book as ProBookData).category}</span>
            )}
          </div>
        )}
      </div>
    </motion.div>
    </Link>
  );
}
