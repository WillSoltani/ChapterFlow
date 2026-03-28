"use client";

import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Chip } from "@/app/book/components/ui/Chip";
import { cn } from "@/app/book/components/ui/cn";

type LibraryPaginationControlsProps = {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  rangeStart: number;
  rangeEnd: number;
  pageSize: number;
  pageSizeOptions: number[];
  pageNumbers: number[];
  canGoPrevious: boolean;
  canGoNext: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onPrevious: () => void;
  onNext: () => void;
  showSummary?: boolean;
  showPageSize?: boolean;
};

function PageButton({
  children,
  active = false,
  disabled = false,
  onClick,
  ariaLabel,
}: {
  children: ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={ariaLabel}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-10 min-w-10 items-center justify-center rounded-2xl border px-3 text-sm font-medium transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--cf-accent-border)",
        active
          ? "border-(--cf-accent-border) bg-(--cf-accent-soft) text-(--cf-info-text) shadow-shadow-card"
          : "border-(--cf-border) bg-(--cf-surface) text-(--cf-text-2) hover:border-(--cf-border-strong) hover:bg-(--cf-surface-muted)",
        disabled && "cursor-not-allowed opacity-45 hover:border-(--cf-border) hover:bg-(--cf-surface)"
      )}
    >
      {children}
    </button>
  );
}

export function LibraryPaginationControls({
  currentPage,
  totalPages,
  totalCount,
  rangeStart,
  rangeEnd,
  pageSize,
  pageSizeOptions,
  pageNumbers,
  canGoPrevious,
  canGoNext,
  onPageChange,
  onPageSizeChange,
  onPrevious,
  onNext,
  showSummary = true,
  showPageSize = true,
}: LibraryPaginationControlsProps) {
  const showPagination = totalPages > 1;

  return (
    <div className="cf-panel rounded-[28px] p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          {showSummary ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Chip tone="neutral">
                  {totalCount} {totalCount === 1 ? "book" : "books"} found
                </Chip>
                {showPagination ? <Chip tone="neutral">Page {currentPage} of {totalPages}</Chip> : null}
              </div>
              <p className="text-sm text-(--cf-text-2)">
                {totalCount === 0
                  ? "No books match the current view."
                  : `Showing ${rangeStart} to ${rangeEnd} of ${totalCount} books`}
              </p>
            </>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between lg:justify-end">
          {showPageSize ? (
            <label className="inline-flex items-center gap-3 text-sm text-(--cf-text-2)">
              <span>Books per page</span>
              <select
                value={pageSize}
                onChange={(event) => onPageSizeChange(Number(event.target.value))}
                className="cf-input rounded-2xl px-3 py-2 text-sm"
                aria-label="Books per page"
              >
                {pageSizeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {showPagination ? (
            <div className="flex flex-wrap items-center gap-2">
              <PageButton
                disabled={!canGoPrevious}
                onClick={onPrevious}
                ariaLabel="Go to previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </PageButton>

              <div className="hidden items-center gap-2 sm:flex">
                {pageNumbers[0] > 1 ? (
                  <>
                    <PageButton onClick={() => onPageChange(1)}>1</PageButton>
                    {pageNumbers[0] > 2 ? <span className="px-1 text-(--cf-text-soft)">…</span> : null}
                  </>
                ) : null}

                {pageNumbers.map((page) => (
                  <PageButton
                    key={page}
                    active={page === currentPage}
                    onClick={() => onPageChange(page)}
                    ariaLabel={`Go to page ${page}`}
                  >
                    {page}
                  </PageButton>
                ))}

                {pageNumbers[pageNumbers.length - 1] < totalPages ? (
                  <>
                    {pageNumbers[pageNumbers.length - 1] < totalPages - 1 ? (
                      <span className="px-1 text-(--cf-text-soft)">…</span>
                    ) : null}
                    <PageButton onClick={() => onPageChange(totalPages)}>{totalPages}</PageButton>
                  </>
                ) : null}
              </div>

              <div className="sm:hidden">
                <PageButton active ariaLabel={`Current page ${currentPage} of ${totalPages}`}>
                  {currentPage}/{totalPages}
                </PageButton>
              </div>

              <PageButton disabled={!canGoNext} onClick={onNext} ariaLabel="Go to next page">
                <ChevronRight className="h-4 w-4" />
              </PageButton>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
