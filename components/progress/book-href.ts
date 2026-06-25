import type { ActiveBook } from "./progressTypes";

/**
 * Resolve the "Continue Learning" CTA target for an active book.
 *
 * G3: Only build a deep `/book/library/<id>/chapter/<chapterId>` link when we
 * actually have a chapter to resume. `resumeChapterId` is sourced from
 * useBookAnalytics, which falls back to "" when the current chapter is unknown
 * and the chapter list is empty; `encodeURIComponent("")` is "", so an
 * unguarded deep link becomes the malformed `/book/library/<id>/chapter/`.
 * Guard on a non-empty id and otherwise fall through to the book detail page.
 *
 * Extracted into a JSX-free module so it can be unit-tested without dragging in
 * the component's framer-motion / next/image dependencies (the repo's
 * pure-seam test pattern).
 */
export function getBookHref(book: ActiveBook): string {
  if (
    book.resumeChapterId &&
    (book.completedChapters > 0 || book.currentStep !== "summary")
  ) {
    return `/book/library/${encodeURIComponent(book.id)}/chapter/${encodeURIComponent(book.resumeChapterId)}`;
  }
  return `/book/library/${encodeURIComponent(book.id)}`;
}
