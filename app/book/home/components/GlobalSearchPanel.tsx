"use client";

import { useDeferredValue, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { BookText, FileText, Lightbulb, Loader2, MessageSquare } from "lucide-react";
import { BOOKS_CATALOG } from "@/app/book/data/booksCatalog";
import { getBookChaptersBundle } from "@/app/book/data/bookChapters";
import { useGlobalSearch } from "@/app/book/hooks/useGlobalSearch";
import type { SearchResult, GroupedResults } from "@/app/book/types/search";

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

/**
 * Build a chapter URL segment. Prefers the full chapter slug (e.g. "ch01-the-habit-loop")
 * when available; otherwise falls back to the plain chapter number, which resolves
 * via the numeric fallback in app/book/library/[bookId]/chapter/[chapterId]/page.tsx.
 */
function buildChapterPath(result: { chapterId?: string; chapterNumber?: number }): string {
  if (result.chapterId) return encodeURIComponent(result.chapterId);
  return String(result.chapterNumber ?? 1);
}

/** The route a given result navigates to (shared by click and keyboard Enter). */
function resultHref(r: SearchResult): string {
  if (r.type === "book") return `/book/library/${encodeURIComponent(r.bookId)}`;
  return `/book/library/${encodeURIComponent(r.bookId)}/chapter/${buildChapterPath(r)}`;
}

/* ── Local fallback helpers (used when S3 index hasn't loaded) ── */

function localBookSearch(search: string): SearchResult[] {
  return BOOKS_CATALOG.filter((book) => {
    const searchable = `${book.title} ${book.author} ${book.category}`.toLowerCase();
    return searchable.includes(search);
  })
    .slice(0, 6)
    .map((book) => ({
      id: `book:${book.id}`,
      type: "book" as const,
      bookId: book.id,
      bookTitle: book.title,
      author: book.author,
      text: `${book.title} by ${book.author}`,
      tags: [],
      categories: [],
      score: 0,
    }));
}

function localChapterSearch(search: string): SearchResult[] {
  const results: SearchResult[] = [];
  for (const book of BOOKS_CATALOG) {
    const chaptersBundle = getBookChaptersBundle(book.id);
    for (const chapter of chaptersBundle.chapters) {
      const searchable = `${book.title} ${chapter.title} ${chapter.code}`.toLowerCase();
      if (!searchable.includes(search)) continue;
      results.push({
        id: `chapter:${book.id}:${chapter.id}`,
        type: "chapter" as const,
        bookId: book.id,
        bookTitle: book.title,
        author: book.author,
        chapterId: chapter.id,
        chapterNumber: chapter.order,
        chapterTitle: `${chapter.code} ${chapter.title}`,
        text: `${chapter.title} ${book.title}`,
        tags: [],
        categories: [],
        score: 0,
      });
      if (results.length >= 10) return results;
    }
  }
  return results;
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
  const { ensureLoaded, indexLoaded, isLoading, error, search: searchIndex } = useGlobalSearch();

  // Lazy-load the enhanced index when the panel opens
  useEffect(() => {
    if (open) ensureLoaded();
  }, [open, ensureLoaded]);

  // Unified results: prefer S3 index, fall back to local catalog
  const results = useMemo((): GroupedResults => {
    if (!deferredSearch) return EMPTY_RESULTS;

    if (indexLoaded) {
      return searchIndex(deferredSearch);
    }

    // Fallback: local books/chapters only
    return {
      books: localBookSearch(deferredSearch),
      chapters: localChapterSearch(deferredSearch),
      takeaways: [],
      examples: [],
    };
  }, [deferredSearch, indexLoaded, searchIndex]);

  // Flatten in render order so a single index maps the keyboard highlight to a
  // concrete result/href.
  const flat = useMemo(
    () => [...results.books, ...results.chapters, ...results.takeaways, ...results.examples],
    [results],
  );
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

  // Section offsets into the flattened list (must match render order above).
  const chaptersOffset = results.books.length;
  const takeawaysOffset = chaptersOffset + results.chapters.length;
  const examplesOffset = takeawaysOffset + results.takeaways.length;

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
    <div className="absolute inset-x-0 top-12 z-40">
      <div className="cf-panel-strong rounded-2xl p-3">
        {!hasQuery ? (
          <p className="px-2 py-6 text-center text-sm text-(--cf-text-3)">
            Type to search books, chapters, takeaways, and examples.
          </p>
        ) : (
          <div
            role="listbox"
            id={listboxId}
            aria-label="Search results"
            className="grid gap-3 md:grid-cols-2"
          >
            {/* Books */}
            <section role="group" aria-labelledby={`${idPrefix}-gs-books-label`} className="cf-panel-muted rounded-xl p-2">
              <p id={`${idPrefix}-gs-books-label`} className="px-2 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-(--cf-text-3)">
                Books
              </p>
              <div className="space-y-1">
                {results.books.length ? (
                  results.books.map((r, i) => {
                    const gi = i;
                    const active = gi === activeIndex;
                    return (
                      <button
                        key={r.id}
                        ref={active ? activeOptionRef : undefined}
                        type="button"
                        role="option"
                        id={`${idPrefix}-gs-opt-${gi}`}
                        aria-selected={active}
                        onClick={() => go(r)}
                        className={optionBase + optionState(active)}
                      >
                        <BookText className="h-4 w-4 text-(--cf-accent)" />
                        <span className="flex-1 truncate">{r.bookTitle}</span>
                        <span className="text-xs text-(--cf-text-3)">{r.author}</span>
                      </button>
                    );
                  })
                ) : (
                  <p className="px-2 py-2 text-sm text-(--cf-text-3)">No book matches.</p>
                )}
              </div>
            </section>

            {/* Chapters */}
            <section role="group" aria-labelledby={`${idPrefix}-gs-chapters-label`} className="cf-panel-muted rounded-xl p-2">
              <p id={`${idPrefix}-gs-chapters-label`} className="px-2 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-(--cf-text-3)">
                Chapters
              </p>
              <div className="space-y-1">
                {results.chapters.length ? (
                  results.chapters.map((r, i) => {
                    const gi = chaptersOffset + i;
                    const active = gi === activeIndex;
                    return (
                      <button
                        key={r.id}
                        ref={active ? activeOptionRef : undefined}
                        type="button"
                        role="option"
                        id={`${idPrefix}-gs-opt-${gi}`}
                        aria-selected={active}
                        onClick={() => go(r)}
                        className={optionBase + optionState(active)}
                      >
                        <FileText className="h-4 w-4 text-(--cf-accent)" />
                        <span className="min-w-0 flex-1 truncate">
                          {r.bookTitle} · {r.chapterTitle ?? `Ch. ${r.chapterNumber}`}
                        </span>
                      </button>
                    );
                  })
                ) : (
                  <p className="px-2 py-2 text-sm text-(--cf-text-3)">No chapter matches.</p>
                )}
              </div>
            </section>

            {/* Takeaways */}
            <section role="group" aria-labelledby={`${idPrefix}-gs-takeaways-label`} className="cf-panel-muted rounded-xl p-2">
              <p id={`${idPrefix}-gs-takeaways-label`} className="px-2 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-(--cf-text-3)">
                Key Takeaways
              </p>
              <div className="space-y-1">
                {isLoading ? (
                  <div className="flex items-center gap-2 px-2 py-3 text-sm text-(--cf-text-3)">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading…
                  </div>
                ) : results.takeaways.length ? (
                  results.takeaways.map((t, i) => {
                    const gi = takeawaysOffset + i;
                    const active = gi === activeIndex;
                    return (
                      <button
                        key={t.id}
                        ref={active ? activeOptionRef : undefined}
                        type="button"
                        role="option"
                        id={`${idPrefix}-gs-opt-${gi}`}
                        aria-selected={active}
                        onClick={() => go(t)}
                        className={"items-start " + optionBase + optionState(active)}
                      >
                        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-(--cf-accent)" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate">{t.text}</p>
                          <p className="text-xs text-(--cf-text-3)">{t.bookTitle} · Ch. {t.chapterNumber}</p>
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <p className="px-2 py-2 text-sm text-(--cf-text-3)">
                    {error ? "Search unavailable." : "No takeaway matches."}
                  </p>
                )}
              </div>
            </section>

            {/* Examples */}
            <section role="group" aria-labelledby={`${idPrefix}-gs-examples-label`} className="cf-panel-muted rounded-xl p-2">
              <p id={`${idPrefix}-gs-examples-label`} className="px-2 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-(--cf-text-3)">
                Examples
              </p>
              <div className="space-y-1">
                {isLoading ? (
                  <div className="flex items-center gap-2 px-2 py-3 text-sm text-(--cf-text-3)">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading…
                  </div>
                ) : results.examples.length ? (
                  results.examples.map((e, i) => {
                    const gi = examplesOffset + i;
                    const active = gi === activeIndex;
                    return (
                      <button
                        key={e.id}
                        ref={active ? activeOptionRef : undefined}
                        type="button"
                        role="option"
                        id={`${idPrefix}-gs-opt-${gi}`}
                        aria-selected={active}
                        onClick={() => go(e)}
                        className={"items-start " + optionBase + optionState(active)}
                      >
                        <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-(--cf-accent)" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate">{e.text}</p>
                          <p className="text-xs text-(--cf-text-3)">{e.bookTitle} · Ch. {e.chapterNumber}</p>
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <p className="px-2 py-2 text-sm text-(--cf-text-3)">
                    {error ? "Search unavailable." : "No example matches."}
                  </p>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
