import type { Chapter } from "./types";

export interface BookMeta {
  bookId: string;
  title: string;
  author: string;
  categories: string[];
  tags: string[];
}

export function wordsIn(t: string): number {
  const s = t.trim();
  return s ? s.split(/\s+/).length : 0;
}

/** Wrap one chapter in a minimal v21-authored package so the real app validator can check it. */
export function onePackage(chapter: Chapter, n: number, book: BookMeta): Record<string, unknown> {
  return {
    schemaVersion: "chapterflow-v21-authored",
    packageId: `${book.bookId}-v26-check`,
    createdAt: "2026-01-01T00:00:00.000Z",
    contentOwner: "chapterflow",
    book: {
      bookId: book.bookId,
      title: book.title,
      author: book.author,
      categories: book.categories,
      tags: book.tags,
    },
    chapters: [
      {
        chapterId: `${book.bookId}-ch${String(n).padStart(2, "0")}`,
        number: n,
        readingTimeMinutes: Math.max(1, Math.round(wordsIn(chapter.breakdown.fullRead) / 230)),
        ...chapter,
      },
    ],
  };
}

export async function validateChapterWithApp(
  chapter: Chapter,
  n: number,
  book: BookMeta,
): Promise<{ ok: boolean; message: string }> {
  // Dynamic import, same as scripts/book/register-api-books.ts: keeps the app tree out of module load.
  const { validateBookPackage } = await import("@/app/app/api/book/_lib/validate-book-package");
  try {
    validateBookPackage(onePackage(chapter, n, book));
    return { ok: true, message: "APP_VALIDATOR_OK chapters=1" };
  } catch (err) {
    const e = err as { message?: string; issues?: unknown; details?: unknown };
    // BookApiError carries the per-field problems in `details`; its message alone is generic.
    const extra = e.issues ?? e.details;
    const detail = extra === undefined ? "" : ` ${JSON.stringify(extra).slice(0, 600)}`;
    return { ok: false, message: `${e.message ?? String(err)}${detail}` };
  }
}
