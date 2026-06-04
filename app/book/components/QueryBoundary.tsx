"use client";

import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { ERROR_MESSAGES, getBookErrorMessage } from "@/app/book/_lib/error-messages";

function getErrorMessage(error: Error | null): string {
  if (!error) return ERROR_MESSAGES.server_error;
  return getBookErrorMessage(error);
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
