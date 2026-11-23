import type { ActiveBook } from "./progressTypes";

/**
 * Resolve the "Continue Learning" CTA target for an active book (C13).
 *
 * Active books are started books, so Continue goes straight into the resume
 * chapter, addressed by its number (the chapter page resolves numbers), so the
 * button label and the link always name the same chapter. Without a valid
 * number (G3: never build the malformed `/chapter/` link) it falls back to the
 * book page.
 *
 * Extracted into a JSX-free module so it can be unit-tested without dragging in
 * the component's framer-motion / next/image dependencies (the repo's
 * pure-seam test pattern).
 */
export function getBookHref(book: ActiveBook): string {
  const bookPath = `/book/library/${encodeURIComponent(book.id)}`;
  const chapterNumber = book.currentChapterNumber;
  if (Number.isInteger(chapterNumber) && chapterNumber >= 1) {
    return `${bookPath}/chapter/${chapterNumber}`;
  }
  return bookPath;
}
