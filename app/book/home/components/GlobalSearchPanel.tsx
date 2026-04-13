"use client";

import { useDeferredValue, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { BookText, FileText, Lightbulb, Loader2, MessageSquare } from "lucide-react";
import { BOOKS_CATALOG } from "@/app/book/data/booksCatalog";
import { getBookChaptersBundle } from "@/app/book/data/mockChapters";
import { useGlobalSearch } from "@/app/book/hooks/useGlobalSearch";
import type { SearchResult, GroupedResults } from "@/app/book/types/search";

type GlobalSearchPanelProps = {
  open: boolean;
  query: string;
  onClose: () => void;
};

const EMPTY_RESULTS: GroupedResults = { books: [], chapters: [], takeaways: [], examples: [] };

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
        chapterNumber: parseInt(chapter.id.replace(/\D/g, ""), 10) || 1,
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

export function GlobalSearchPanel({ open, query, onClose }: GlobalSearchPanelProps) {
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

  if (!open) return null;

  const hasQuery = search.length > 0;

  return (
    <div className="absolute inset-x-0 top-12 z-40">
      <div className="cf-panel-strong rounded-2xl p-3">
        {!hasQuery ? (
          <p className="px-2 py-6 text-center text-sm text-(--cf-text-3)">
            Type to search books, chapters, takeaways, and examples.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {/* Books */}
            <section className="cf-panel-muted rounded-xl p-2">
              <p className="px-2 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-(--cf-text-3)">
                Books
              </p>
              <div className="space-y-1">
                {results.books.length ? (
                  results.books.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => {
                        onClose();
                        router.push(`/book/library/${encodeURIComponent(r.bookId)}`);
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-(--cf-text-2) transition hover:bg-(--cf-accent-muted) hover:text-(--cf-text-1)"
                    >
                      <BookText className="h-4 w-4 text-(--cf-accent)" />
                      <span className="flex-1 truncate">{r.bookTitle}</span>
                      <span className="text-xs text-(--cf-text-3)">{r.author}</span>
                    </button>
                  ))
                ) : (
                  <p className="px-2 py-2 text-sm text-(--cf-text-3)">No book matches.</p>
                )}
              </div>
            </section>

            {/* Chapters */}
            <section className="cf-panel-muted rounded-xl p-2">
              <p className="px-2 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-(--cf-text-3)">
                Chapters
              </p>
              <div className="space-y-1">
                {results.chapters.length ? (
                  results.chapters.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => {
                        onClose();
                        router.push(
                          `/book/library/${encodeURIComponent(r.bookId)}/chapter/ch${String(r.chapterNumber ?? 1).padStart(2, "0")}`
                        );
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-(--cf-text-2) transition hover:bg-(--cf-accent-muted) hover:text-(--cf-text-1)"
                    >
                      <FileText className="h-4 w-4 text-(--cf-accent)" />
                      <span className="min-w-0 flex-1 truncate">
                        {r.bookTitle} · {r.chapterTitle ?? `Ch. ${r.chapterNumber}`}
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="px-2 py-2 text-sm text-(--cf-text-3)">No chapter matches.</p>
                )}
              </div>
            </section>

            {/* Takeaways */}
            <section className="cf-panel-muted rounded-xl p-2">
              <p className="px-2 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-(--cf-text-3)">
                Key Takeaways
              </p>
              <div className="space-y-1">
                {isLoading ? (
                  <div className="flex items-center gap-2 px-2 py-3 text-sm text-(--cf-text-3)">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading…
                  </div>
                ) : results.takeaways.length ? (
                  results.takeaways.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        onClose();
                        router.push(
                          `/book/library/${encodeURIComponent(t.bookId)}/chapter/ch${String(t.chapterNumber ?? 1).padStart(2, "0")}`
                        );
                      }}
                      className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left text-sm text-(--cf-text-2) transition hover:bg-(--cf-accent-muted) hover:text-(--cf-text-1)"
                    >
                      <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-(--cf-accent)" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate">{t.text}</p>
                        <p className="text-xs text-(--cf-text-3)">{t.bookTitle} · Ch. {t.chapterNumber}</p>
                      </div>
                    </button>
                  ))
                ) : (
                  <p className="px-2 py-2 text-sm text-(--cf-text-3)">
                    {error ? "Search unavailable." : "No takeaway matches."}
                  </p>
                )}
              </div>
            </section>

            {/* Examples */}
            <section className="cf-panel-muted rounded-xl p-2">
              <p className="px-2 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-(--cf-text-3)">
                Examples
              </p>
              <div className="space-y-1">
                {isLoading ? (
                  <div className="flex items-center gap-2 px-2 py-3 text-sm text-(--cf-text-3)">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading…
                  </div>
                ) : results.examples.length ? (
                  results.examples.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => {
                        onClose();
                        router.push(
                          `/book/library/${encodeURIComponent(e.bookId)}/chapter/ch${String(e.chapterNumber ?? 1).padStart(2, "0")}`
                        );
                      }}
                      className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left text-sm text-(--cf-text-2) transition hover:bg-(--cf-accent-muted) hover:text-(--cf-text-1)"
                    >
                      <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-(--cf-accent)" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate">{e.text}</p>
                        <p className="text-xs text-(--cf-text-3)">{e.bookTitle} · Ch. {e.chapterNumber}</p>
                      </div>
                    </button>
                  ))
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
