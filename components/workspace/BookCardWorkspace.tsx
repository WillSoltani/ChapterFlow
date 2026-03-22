"use client";

import { motion, useReducedMotion } from "framer-motion";
import { DashboardBookCover } from "@/components/ui/DashboardBookCover";
import { ProBadge } from "./ProBadge";

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
  in_progress: { label: "In Progress", color: "#7C3AED" },
  not_started: { label: "Not Started", color: "#6B6B80" },
  completed: { label: "Completed", color: "#10B981" },
};

function formatReaderCount(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return count.toString();
}

export function BookCardWorkspace(props: BookCardWorkspaceProps) {
  const prefersReducedMotion = useReducedMotion();
  const { variant, book } = props;

  const gradient =
    book.gradient || "linear-gradient(135deg, #2563EB, #1E40AF)";

  return (
    <motion.div
      className="flex-shrink-0 cursor-pointer rounded-xl p-3"
      style={{
        width: 160,
        background: "rgba(255,255,255,0.04)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
      whileHover={
        prefersReducedMotion
          ? undefined
          : {
              scale: 1.015,
              backgroundColor: "rgba(255,255,255,0.06)",
            }
      }
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      role="listitem"
    >
      {/* Cover */}
      <div className="relative">
        <DashboardBookCover
          title={book.title}
          gradient={gradient}
          width={136}
          height={180}
          className="w-full"
        />
        {variant === "pro" && (
          <div className="absolute right-1.5 top-1.5">
            <ProBadge />
          </div>
        )}
        {variant === "user" && (book as UserBookData).status === "completed" && (
          <div
            className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full"
            style={{ background: "#10B981" }}
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
      <div className="mt-2.5">
        <p
          className="truncate text-sm font-medium"
          style={{ color: "#F0F0F0" }}
        >
          {book.title}
        </p>
        <p
          className="mt-0.5 truncate text-xs"
          style={{ color: "#A0A0B8" }}
        >
          {book.author}
        </p>

        {variant === "user" && (
          <>
            {/* Progress bar */}
            <div
              className="mt-2 h-[3px] overflow-hidden rounded-full"
              style={{ background: "rgba(255,255,255,0.06)" }}
              role="progressbar"
              aria-valuenow={(book as UserBookData).progressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <motion.div
                className="h-full rounded-full"
                style={{ background: "#7C3AED" }}
                initial={prefersReducedMotion ? undefined : { width: 0 }}
                animate={{ width: `${(book as UserBookData).progressPercent}%` }}
                transition={
                  prefersReducedMotion
                    ? { duration: 0 }
                    : { duration: 0.8, ease: "easeOut", delay: 0.3 }
                }
              />
            </div>
            <p
              className="mt-1.5 text-[10px] font-medium"
              style={{
                color:
                  statusConfig[(book as UserBookData).status].color,
              }}
            >
              {statusConfig[(book as UserBookData).status].label}
            </p>
          </>
        )}

        {variant === "pro" && (
          <div
            className="mt-2 flex items-center gap-1 text-[10px]"
            style={{ color: "#A0A0B8" }}
          >
            <span style={{ color: "#F59E0B" }}>★</span>
            <span className="tabular-nums">
              {(book as ProBookData).rating}
            </span>
            <span style={{ color: "#6B6B80" }}>·</span>
            <span>
              {formatReaderCount((book as ProBookData).readerCount)} readers
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
