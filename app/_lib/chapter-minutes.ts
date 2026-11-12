import bookChapterMeta from "@/app/book/data/book-chapter-meta.json";
import { BOOKS_CATALOG_METADATA } from "@/lib/books-catalog";

/**
 * One chapter's own reading time, as the reader lists it (the per-chapter
 * metadata in app/book/data/book-chapter-meta.json), or null when the book is
 * not in the catalog or has no such chapter. For copy that names one chapter
 * of one book; copy about chapters in general uses the catalog median
 * (CATALOG_MEDIAN_CHAPTER_MINUTES in lib/catalog-stats).
 *
 * The metadata file is a few hundred KB, so call this from a Server Component
 * and hand the number to client code as a prop; importing this module from a
 * client component would ship the whole file to the browser.
 */
type ChapterMeta = { order: number; minutes: number };

const CHAPTER_META = bookChapterMeta as Record<string, { chapters: ChapterMeta[] } | undefined>;

export function chapterMinutes(bookId: string, order: number): number | null {
  if (!BOOKS_CATALOG_METADATA.some((book) => book.id === bookId)) return null;
  const chapter = CHAPTER_META[bookId]?.chapters.find((entry) => entry.order === order);
  return chapter && chapter.minutes > 0 ? chapter.minutes : null;
}
