import type { NotebookEntry } from "./types";

/**
 * Pure projection of a persisted chapter-state record into Notebook entries
 * (notes + bookmarked takeaways). Extracted from the /me/notebook route so the
 * serialization can be unit-tested without `server-only`/AWS at module load.
 *
 * ⚠️ The bug this fixes: the reader persists bookmarked takeaways as numeric
 * INDICES (`bookmarkedTakeaways: number[]`, see useChapterState.ts), but the
 * Notebook route used to read that same array expecting STRINGS
 * (`typeof text !== "string"` → skip), so every bookmark was silently dropped.
 * The reader now also persists the takeaway TEXT keyed by index in
 * `bookmarkedTakeawayTexts: Record<string, string>`; we read that here.
 *
 * Back-compat: legacy chapter states only have the numeric `bookmarkedTakeaways`
 * with NO `bookmarkedTakeawayTexts`. The index can't be resolved to text without
 * loading chapter content (which this route deliberately does not do), so those
 * legacy bookmarks surface nothing until they are re-bookmarked. That is the
 * accepted trade-off (see the NOTES-BOOKMARK-UNCLEAR fix notes).
 *
 * The stored text is a snapshot at the reading depth active when the reader
 * bookmarked, so it can differ from the live in-reader Practice list at another
 * depth — by design, the notebook shows what was bookmarked.
 */

export type ChapterStateMeta = {
  bookId: string;
  bookTitle: string;
  chapterNumber: number;
  chapterTitle: string;
  createdAt: string;
};

export function buildChapterStateNotebookEntries(
  state: Record<string, unknown> | undefined | null,
  meta: ChapterStateMeta,
): NotebookEntry[] {
  if (!state) return [];

  const { bookId, bookTitle, chapterNumber, chapterTitle, createdAt } = meta;
  const entries: NotebookEntry[] = [];

  // Notes (the working sibling of the bookmark path: "Save takeaways to notes"
  // writes state.notes, which has always surfaced here as a Note entry).
  const notes = state.notes;
  if (typeof notes === "string" && notes.trim()) {
    entries.push({
      id: `note:${bookId}:${chapterNumber}`,
      type: "note",
      bookId,
      bookTitle,
      chapterNumber,
      chapterTitle,
      content: notes,
      tags: [],
      createdAt,
    });
  }

  // Bookmarked takeaways — read the text map (index -> text). Numeric-keyed
  // object keys iterate in ascending order, so entries come out by index.
  const texts = state.bookmarkedTakeawayTexts;
  if (texts && typeof texts === "object" && !Array.isArray(texts)) {
    for (const [index, text] of Object.entries(texts as Record<string, unknown>)) {
      if (typeof text !== "string" || !text.trim()) continue;
      entries.push({
        id: `bookmark:${bookId}:${chapterNumber}:${index}`,
        type: "bookmark",
        bookId,
        bookTitle,
        chapterNumber,
        chapterTitle,
        content: text,
        tags: [],
        createdAt,
      });
    }
  }

  return entries;
}
