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
      <div className="rounded-2xl border border-white/14 bg-[#0a1224]/96 p-3 shadow-[0_24px_60px_rgba(2,6,23,0.6)] backdrop-blur-xl">
        {!search ? (
          <p className="px-2 py-6 text-center text-sm text-slate-400">
            Type to search books and chapters.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            <section className="rounded-xl border border-white/10 bg-white/2 p-2">
              <p className="px-2 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
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
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-slate-200 transition hover:bg-white/8"
                    >
                      <BookText className="h-4 w-4 text-sky-300" />
                      <span className="flex-1 truncate">{book.title}</span>
                      <span className="text-xs text-slate-400">{book.author}</span>
                    </button>
                  ))
                ) : (
                  <p className="px-2 py-2 text-sm text-slate-500">No book matches.</p>
                )}
              </div>
            </section>

            <section className="rounded-xl border border-white/10 bg-white/2 p-2">
              <p className="px-2 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
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
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-slate-200 transition hover:bg-white/8"
                    >
                      <FileText className="h-4 w-4 text-cyan-300" />
                      <span className="min-w-0 flex-1 truncate">
                        {chapter.bookTitle} · {chapter.chapterLabel} {chapter.chapterTitle}
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="px-2 py-2 text-sm text-slate-500">No chapter matches.</p>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
