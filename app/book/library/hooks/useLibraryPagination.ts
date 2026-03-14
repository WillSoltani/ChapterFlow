"use client";

import { useEffect, useMemo, useState } from "react";

type UseLibraryPaginationArgs<T> = {
  entries: T[];
  defaultPageSize?: number;
  pageSizeOptions?: number[];
};

type UseLibraryPaginationResult<T> = {
  pageEntries: T[];
  currentPage: number;
  totalPages: number;
  pageSize: number;
  pageSizeOptions: number[];
  totalCount: number;
  rangeStart: number;
  rangeEnd: number;
  canGoNext: boolean;
  canGoPrevious: boolean;
  pageNumbers: number[];
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  goToNextPage: () => void;
  goToPreviousPage: () => void;
};

type StoredPaginationState = {
  currentPage: number;
  pageSize: number;
};

const STORAGE_KEY = "book-accelerator:library-pagination:v1";
const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 30, 50];

function parseQueryState(search: string, pageSizeOptions: number[]): StoredPaginationState | null {
  const params = new URLSearchParams(search);
  const pageSize = Number(params.get("pageSize"));
  const currentPage = Number(params.get("page"));
  const hasPageSize = pageSizeOptions.includes(pageSize);
  const hasPage = Number.isFinite(currentPage) && currentPage > 0;

  if (!hasPageSize && !hasPage) return null;

  return {
    pageSize: hasPageSize ? pageSize : pageSizeOptions[0],
    currentPage: hasPage ? Math.floor(currentPage) : 1,
  };
}

function parseStoredState(raw: string | null, pageSizeOptions: number[]): StoredPaginationState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredPaginationState>;
    const pageSize = Number(parsed.pageSize);
    const currentPage = Number(parsed.currentPage);
    return {
      pageSize: pageSizeOptions.includes(pageSize) ? pageSize : pageSizeOptions[0],
      currentPage: Number.isFinite(currentPage) && currentPage > 0 ? Math.floor(currentPage) : 1,
    };
  } catch {
    return null;
  }
}

function clampPage(page: number, totalPages: number) {
  if (totalPages <= 0) return 1;
  return Math.min(Math.max(1, page), totalPages);
}

function buildPageNumbers(currentPage: number, totalPages: number) {
  if (totalPages <= 1) return [1];
  if (totalPages <= 5) return Array.from({ length: totalPages }, (_, index) => index + 1);

  const start = Math.max(1, currentPage - 2);
  const end = Math.min(totalPages, start + 4);
  const adjustedStart = Math.max(1, end - 4);

  return Array.from({ length: end - adjustedStart + 1 }, (_, index) => adjustedStart + index);
}

export function useLibraryPagination<T>({
  entries,
  defaultPageSize = 10,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
}: UseLibraryPaginationArgs<T>): UseLibraryPaginationResult<T> {
  const normalizedOptions = useMemo(() => {
    const options = Array.from(new Set(pageSizeOptions.map((value) => Math.max(1, Math.floor(value))))).sort(
      (left, right) => left - right
    );
    return options.includes(defaultPageSize) ? options : [defaultPageSize, ...options].sort((left, right) => left - right);
  }, [defaultPageSize, pageSizeOptions]);

  const [hydrated, setHydrated] = useState(false);
  const [pagination, setPagination] = useState<StoredPaginationState>({
    currentPage: 1,
    pageSize: normalizedOptions[0] ?? defaultPageSize,
  });

  useEffect(() => {
    const query = parseQueryState(window.location.search, normalizedOptions);
    const stored = parseStoredState(window.localStorage.getItem(STORAGE_KEY), normalizedOptions);
    const nextState =
      query ??
      stored ??
      {
        currentPage: 1,
        pageSize: normalizedOptions.includes(defaultPageSize) ? defaultPageSize : normalizedOptions[0],
      };
    setPagination((current) => {
      if (
        current.currentPage === nextState.currentPage &&
        current.pageSize === nextState.pageSize
      ) {
        return current;
      }
      return nextState;
    });
    setHydrated(true);
  }, [defaultPageSize, normalizedOptions]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pagination));
  }, [hydrated, pagination]);

  useEffect(() => {
    if (!hydrated) return;
    const params = new URLSearchParams(window.location.search);
    if (pagination.currentPage > 1) {
      params.set("page", String(pagination.currentPage));
    } else {
      params.delete("page");
    }
    if (pagination.pageSize !== defaultPageSize) {
      params.set("pageSize", String(pagination.pageSize));
    } else {
      params.delete("pageSize");
    }

    const query = params.toString();
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
    window.history.replaceState(window.history.state, "", nextUrl);
  }, [defaultPageSize, hydrated, pagination.currentPage, pagination.pageSize]);

  const totalCount = entries.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pagination.pageSize));

  useEffect(() => {
    setPagination((current) => {
      const nextPage = clampPage(current.currentPage, totalPages);
      if (nextPage === current.currentPage) return current;
      return { ...current, currentPage: nextPage };
    });
  }, [totalPages]);

  const currentPage = clampPage(pagination.currentPage, totalPages);
  const startIndex = totalCount === 0 ? 0 : (currentPage - 1) * pagination.pageSize;
  const endIndex = Math.min(startIndex + pagination.pageSize, totalCount);

  const pageEntries = useMemo(
    () => entries.slice(startIndex, endIndex),
    [endIndex, entries, startIndex]
  );

  const pageNumbers = useMemo(
    () => buildPageNumbers(currentPage, totalPages),
    [currentPage, totalPages]
  );

  return {
    pageEntries,
    currentPage,
    totalPages,
    pageSize: pagination.pageSize,
    pageSizeOptions: normalizedOptions,
    totalCount,
    rangeStart: totalCount === 0 ? 0 : startIndex + 1,
    rangeEnd: endIndex,
    canGoNext: currentPage < totalPages,
    canGoPrevious: currentPage > 1,
    pageNumbers,
    setPage: (page: number) => {
      setPagination((current) => ({
        ...current,
        currentPage: clampPage(page, totalPages),
      }));
    },
    setPageSize: (pageSize: number) => {
      const safePageSize = normalizedOptions.includes(pageSize) ? pageSize : normalizedOptions[0];
      setPagination((current) => {
        const firstVisibleIndex = (current.currentPage - 1) * current.pageSize;
        const nextPage = Math.floor(firstVisibleIndex / safePageSize) + 1;
        return {
          pageSize: safePageSize,
          currentPage: clampPage(nextPage, Math.max(1, Math.ceil(totalCount / safePageSize))),
        };
      });
    },
    goToNextPage: () => {
      setPagination((current) => ({
        ...current,
        currentPage: clampPage(current.currentPage + 1, totalPages),
      }));
    },
    goToPreviousPage: () => {
      setPagination((current) => ({
        ...current,
        currentPage: clampPage(current.currentPage - 1, totalPages),
      }));
    },
  };
}
