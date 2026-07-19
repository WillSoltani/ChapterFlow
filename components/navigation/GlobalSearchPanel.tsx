"use client";

import { useDeferredValue, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { BookText } from "lucide-react";
import { BOOKS_CATALOG } from "@/lib/books-catalog";
import {
  useGlobalSearch,
  tokenizeQuery,
  scoreBookMatch,
} from "@/hooks/book/useGlobalSearch";
import type { SearchResult, GroupedResults } from "@/lib/search-types";

type GlobalSearchPanelProps = {
  open: boolean;
  query: string;
  onClose: () => void;
  /**
   * Unique prefix for the listbox + option ids (there are two panel instances —
   * desktop + mobile — so their ids must not collide). Also used by TopNav to
   * build the input's aria-activedescendant.
   */
  idPrefix?: string;
  /** Index of the keyboard-highlighted result in the flattened list (-1 = none). */
  activeIndex?: number;
  /** Reports the flattened result hrefs (render order) up so the input's Enter
   * handler can navigate to the highlighted one. */
  onResultsChange?: (hrefs: string[]) => void;
};

const EMPTY_RESULTS: GroupedResults = { books: [], chapters: [], takeaways: [], examples: [] };

/** The route a given book result navigates to (shared by click and keyboard Enter). */
function resultHref(r: SearchResult): string {
  return `/book/library/${encodeURIComponent(r.bookId)}`;
}

/* ── Local fallback (used when the S3 index hasn't loaded) ── */

/**
 * Books-only catalog search that mirrors the enhanced-index scorer: same
 * tokenizer (stop-words filtered) and same title+author match/ranking, so the
 * local and prod paths surface the same books in the same order.
 */
function localBookSearch(query: string): SearchResult[] {
  const terms = tokenizeQuery(query);
  if (terms.length === 0) return [];

  return BOOKS_CATALOG.map((book) => ({
    book,
    score: scoreBookMatch(book.title, book.author, terms),
  }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(({ book, score }) => ({
      id: `book:${book.id}`,
      type: "book" as const,
      bookId: book.id,
      bookTitle: book.title,
      author: book.author,
      text: `${book.title} by ${book.author}`,
      tags: [],
      categories: [],
      score,
    }));
}

export function GlobalSearchPanel({
  open,
  query,
  onClose,
  idPrefix = "gs",
  activeIndex = -1,
  onResultsChange,
}: GlobalSearchPanelProps) {
  const router = useRouter();
  const search = query.trim().toLowerCase();
  const deferredSearch = useDeferredValue(search);
  const { ensureLoaded, indexLoaded, isLoading, search: searchIndex } = useGlobalSearch();

  // Lazy-load the enhanced index when the panel opens
  useEffect(() => {
    if (open) ensureLoaded();
  }, [open, ensureLoaded]);

  // Books-only results: prefer S3 index, fall back to local catalog
  const results = useMemo((): GroupedResults => {
    if (!deferredSearch) return EMPTY_RESULTS;

    if (indexLoaded) {
      return searchIndex(deferredSearch);
    }

    // Fallback: local books only
    return { books: localBookSearch(deferredSearch), chapters: [], takeaways: [], examples: [] };
  }, [deferredSearch, indexLoaded, searchIndex]);

  // Flatten in render order so a single index maps the keyboard highlight to a
  // concrete result/href.
  const flat = results.books;
  const hrefSig = flat.map(resultHref).join("\n");

  // Report the navigable hrefs up to the owner (TopNav) for Enter handling.
  useEffect(() => {
    onResultsChange?.(hrefSig ? hrefSig.split("\n") : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hrefSig]);

  // Keep the highlighted option scrolled into view.
  const activeOptionRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (activeIndex >= 0) activeOptionRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (!open) return null;

  const hasQuery = search.length > 0;
  const listboxId = `${idPrefix}-global-search-listbox`;

  const optionBase =
    "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-(--cf-text-2) transition";
  const optionState = (active: boolean) =>
    active
      ? " bg-(--cf-accent-muted) text-(--cf-text-1)"
      : " hover:bg-(--cf-accent-muted) hover:text-(--cf-text-1)";

  const go = (r: SearchResult) => {
    onClose();
    router.push(resultHref(r));
  };

  return (
    <div className="absolute inset-x-0 top-12 z-40 lg:left-auto lg:w-[min(640px,calc(100vw-2rem))]">
      <div className="cf-panel-strong rounded-2xl p-3">
        {!hasQuery ? (
          <p className="px-2 py-6 text-center text-sm text-(--cf-text-3)">
            Type to search the library by title or author.
          </p>
        ) : (
          <div
            role="listbox"
            id={listboxId}
            aria-label="Search results"
            aria-busy={isLoading && results.books.length === 0}
          >
            <section role="group" aria-labelledby={`${idPrefix}-gs-books-label`} className="cf-panel-muted rounded-xl p-2">
              <p id={`${idPrefix}-gs-books-label`} className="px-2 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-(--cf-text-3)">
                Books
              </p>
              <div className="space-y-1">
                {results.books.length ? (
                  results.books.map((r, i) => {
                    const active = i === activeIndex;
                    return (
                      <button
                        key={r.id}
                        ref={active ? activeOptionRef : undefined}
                        type="button"
                        role="option"
                        id={`${idPrefix}-gs-opt-${i}`}
                        aria-selected={active}
                        onClick={() => go(r)}
                        className={optionBase + optionState(active)}
                      >
                        <BookText className="h-4 w-4 text-(--cf-accent)" />
                        <span className="min-w-0 flex-1 truncate">{r.bookTitle}</span>
                        <span className="text-xs text-(--cf-text-3)">{r.author}</span>
                      </button>
                    );
                  })
                ) : isLoading ? (
                  <p className="px-2 py-2 text-sm text-(--cf-text-3)">Searching…</p>
                ) : (
                  <p className="px-2 py-2 text-sm text-(--cf-text-3)">No books match.</p>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
