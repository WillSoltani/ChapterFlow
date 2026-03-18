"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { BookText, FileText } from "lucide-react";
import { BOOKS_CATALOG } from "@/app/book/data/booksCatalog";
import { getBookChaptersBundle } from "@/app/book/data/mockChapters";

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

  const { books, chapters } = useMemo(() => {
    if (!search) {
      return {
        books: [] as BookResult[],
        chapters: [] as ChapterResult[],
      };
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

    return {
      books: bookResults,
      chapters: chapterResults,
    };
  }, [search]);

  if (!open) return null;

  return (
    <div className="absolute inset-x-0 top-12 z-40">
      <div className="cf-panel-strong rounded-2xl p-3">
        {!search ? (
          <p className="px-2 py-6 text-center text-sm text-(--cf-text-3)">
            Type to search books and chapters.
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
          </div>
        )}
      </div>
    </div>
  );
}
