"use client";

import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { BookClientError } from "@/app/book/_lib/book-api";

/**
 * Centralized error code -> user-facing message map.
 * Eliminates per-hook error message formatting.
 */
const ERROR_MESSAGES: Record<string, string> = {
  unauthenticated: "Your session has expired. Please sign in again.",
  book_not_started: "Open this book from your library to get started.",
  chapter_locked: "Complete the previous chapter to unlock this one.",
  attempt_cooldown: "Quiz retake is temporarily locked. Try again in a moment.",
  attempt_rate_limited:
    "Too many quiz attempts. Take a break and try again later.",
  server_error: "Something went wrong. Please try again.",
};

function getErrorMessage(error: Error | null): string {
  if (!error) return ERROR_MESSAGES.server_error;
  if (error instanceof BookClientError && error.code) {
    return ERROR_MESSAGES[error.code] ?? error.message;
  }
  return error.message || ERROR_MESSAGES.server_error;
}

function DefaultErrorBanner({ error }: { error: Error | null }) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800/30 dark:bg-red-950/20 dark:text-red-300"
    >
      {getErrorMessage(error)}
    </div>
  );
}

/**
 * Declarative boundary for TanStack Query results.
 *
 * Usage:
 * ```tsx
 * <QueryBoundary
 *   query={progressQuery}
 *   loading={<ProgressSkeleton />}
 * >
 *   {(data) => <ProgressView data={data} />}
 * </QueryBoundary>
 * ```
 */
export function QueryBoundary<T>({
  query,
  loading,
  error,
  children,
}: {
  query: UseQueryResult<T>;
  loading?: ReactNode;
  error?: ReactNode;
  children: (data: T) => ReactNode;
}) {
  if (query.isLoading) return loading ?? null;
  if (query.isError)
    return error ?? <DefaultErrorBanner error={query.error} />;
  if (query.data === undefined) return loading ?? null;
  return children(query.data);
}
