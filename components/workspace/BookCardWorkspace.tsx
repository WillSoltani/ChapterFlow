"use client";

import Link from "next/link";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { ProBadge } from "./ProBadge";
import { getBookCoverPath } from "@/lib/book-covers";

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

function formatReaderCount(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return count.toString();
}

export function BookCardWorkspace(props: BookCardWorkspaceProps) {
  const prefersReducedMotion = useReducedMotion();
  const { variant, book } = props;

  const coverSrc = book.coverUrl || getBookCoverPath(book.id);

  return (
    <Link href={`/book/library/${book.id}`} className="block flex-shrink-0">
    <motion.div
      className="overflow-hidden rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-(--cf-page-bg)"
      style={{
        width: 170,
        background: "var(--cf-surface-muted)",
        backdropFilter: "blur(16px) saturate(125%)",
        WebkitBackdropFilter: "blur(16px) saturate(125%)",
        border: "1px solid var(--cf-border)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.3)",
      }}
      whileHover={
        prefersReducedMotion
          ? undefined
          : { scale: 1.03, y: -8, boxShadow: "0 16px 40px rgba(0,0,0,0.5)" }
      }
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      role="listitem"
    >
      {/* Cover */}
      <div className="relative">
        <div className="relative overflow-hidden" style={{ height: 200 }}>
          <Image
            src={coverSrc}
            alt={`${book.title} by ${book.author}`}
            width={170}
            height={200}
            className="h-full w-full object-cover ring-1 ring-white/[0.06] shadow-shadow-elevated"
            loading="lazy"
            sizes="170px"
          />
          {/* Subtle bottom fade for text readability */}
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-12"
            style={{
              background: "linear-gradient(to top, rgba(0,0,0,0.3), transparent)",
            }}
          />
          {/* In-progress cover bar */}
          {variant === "user" && (book as UserBookData).status === "in_progress" && (
            <div
              className="absolute inset-x-0 bottom-0"
              style={{ height: 3, background: "rgba(0,0,0,0.3)" }}
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
              style={{ background: "var(--cf-surface-muted)" }}
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
                    : { duration: 0.8, ease: "easeOut", delay: 0.4 }
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
            <span style={{ color: "var(--accent-gold)" }}>★</span>
            <span className="tabular-nums">
              {(book as ProBookData).rating}
            </span>
            <span style={{ color: "var(--cf-text-soft)" }}>·</span>
            <span>
              {formatReaderCount((book as ProBookData).readerCount)} readers
            </span>
          </div>
        )}
      </div>
    </motion.div>
    </Link>
  );
}
