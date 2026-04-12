"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { BookText, FileText, Lightbulb, MessageSquare } from "lucide-react";
import { BOOKS_CATALOG } from "@/app/book/data/booksCatalog";
import { getBookChaptersBundle } from "@/app/book/data/mockChapters";
import { useGlobalSearch } from "@/app/book/hooks/useGlobalSearch";

type GlobalSearchPanelProps = {
  open: boolean;
  query: string;
  onClose: () => void;
};

type BookResult = {
  id: string;
  title: string;
  author: string;
};

type ChapterResult = {
  key: string;
  bookId: string;
  chapterId: string;
  bookTitle: string;
  chapterLabel: string;
  chapterTitle: string;
};

export function GlobalSearchPanel({ open, query, onClose }: GlobalSearchPanelProps) {
  const router = useRouter();
  const search = query.trim().toLowerCase();
  const globalSearch = useGlobalSearch();

  // Lazy-load the enhanced index when the panel opens
  useEffect(() => {
    if (open) globalSearch.ensureLoaded();
  }, [open, globalSearch]);

  // Enhanced search results from the S3 index
  const enhanced = useMemo(() => {
    if (!globalSearch.indexLoaded || !search) return null;
    return globalSearch.search(search);
  }, [globalSearch, search]);

  // Fallback to local catalog search
  const { books, chapters } = useMemo(() => {
    if (!search) {
      return { books: [] as BookResult[], chapters: [] as ChapterResult[] };
    }

    const bookResults = BOOKS_CATALOG.filter((book) => {
      const searchable = `${book.title} ${book.author} ${book.category}`.toLowerCase();
      return searchable.includes(search);
    })
      .slice(0, 6)
      .map((book) => ({ id: book.id, title: book.title, author: book.author }));

    const chapterResults: ChapterResult[] = [];
    for (const book of BOOKS_CATALOG) {
      const chaptersBundle = getBookChaptersBundle(book.id);
      for (const chapter of chaptersBundle.chapters) {
        const searchable = `${book.title} ${chapter.title} ${chapter.code}`.toLowerCase();
        if (!searchable.includes(search)) continue;
        chapterResults.push({
          key: `${book.id}:${chapter.id}`,
          bookId: book.id,
          chapterId: chapter.id,
          bookTitle: book.title,
          chapterLabel: chapter.code,
          chapterTitle: chapter.title,
        });
        if (chapterResults.length >= 10) break;
      }
      if (chapterResults.length >= 10) break;
    }

    return { books: bookResults, chapters: chapterResults };
  }, [search]);

  if (!open) return null;

  // Use enhanced results if the index is loaded and has matches
  const hasEnhanced = enhanced && (enhanced.takeaways.length > 0 || enhanced.examples.length > 0);

  return (
    <div className="absolute inset-x-0 top-12 z-40">
      <div className="cf-panel-strong rounded-2xl p-3">
        {!search ? (
          <p className="px-2 py-6 text-center text-sm text-(--cf-text-3)">
            Type to search books, chapters, takeaways, and examples.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            <section className="cf-panel-muted rounded-xl p-2">
              <p className="px-2 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-(--cf-text-3)">
                Books
              </p>
              <div className="space-y-1">
                {books.length ? (
                  books.map((book) => (
                    <button
                      key={book.id}
                      type="button"
                      onClick={() => {
                        onClose();
                        router.push(`/book/library/${encodeURIComponent(book.id)}`);
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-(--cf-text-2) transition hover:bg-(--cf-accent-muted) hover:text-(--cf-text-1)"
                    >
                      <BookText className="h-4 w-4 text-(--cf-accent)" />
                      <span className="flex-1 truncate">{book.title}</span>
                      <span className="text-xs text-(--cf-text-3)">{book.author}</span>
                    </button>
                  ))
                ) : (
                  <p className="px-2 py-2 text-sm text-(--cf-text-3)">No book matches.</p>
                )}
              </div>
            </section>

            <section className="cf-panel-muted rounded-xl p-2">
              <p className="px-2 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-(--cf-text-3)">
                Chapters
              </p>
              <div className="space-y-1">
                {chapters.length ? (
                  chapters.map((chapter) => (
                    <button
                      key={chapter.key}
                      type="button"
                      onClick={() => {
                        onClose();
                        router.push(
                          `/book/library/${encodeURIComponent(chapter.bookId)}/chapter/${encodeURIComponent(chapter.chapterId)}`
                        );
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-(--cf-text-2) transition hover:bg-(--cf-accent-muted) hover:text-(--cf-text-1)"
                    >
                      <FileText className="h-4 w-4 text-(--cf-accent)" />
                      <span className="min-w-0 flex-1 truncate">
                        {chapter.bookTitle} · {chapter.chapterLabel} {chapter.chapterTitle}
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="px-2 py-2 text-sm text-(--cf-text-3)">No chapter matches.</p>
                )}
              </div>
            </section>

            {/* Enhanced results: Takeaways + Examples (from S3 index) */}
            {hasEnhanced && (
              <>
                {enhanced.takeaways.length > 0 && (
                  <section className="cf-panel-muted rounded-xl p-2">
                    <p className="px-2 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-(--cf-text-3)">
                      Key Takeaways
                    </p>
                    <div className="space-y-1">
                      {enhanced.takeaways.map((t) => (
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
                      ))}
                    </div>
                  </section>
                )}

                {enhanced.examples.length > 0 && (
                  <section className="cf-panel-muted rounded-xl p-2">
                    <p className="px-2 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-(--cf-text-3)">
                      Examples
                    </p>
                    <div className="space-y-1">
                      {enhanced.examples.map((e) => (
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
                      ))}
                    </div>
                  </section>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
