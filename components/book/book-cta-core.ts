// D4 / C13: where "Continue" goes and what it says, shared by Home, Library and
// the book page so the label and the link always name the same chapter.

export function resumeChapterNumber({
  currentChapterNumber,
  chaptersCompleted,
  chapterCount,
}: {
  currentChapterNumber?: number | null | undefined;
  chaptersCompleted: number;
  chapterCount: number;
}): number {
  const next =
    typeof currentChapterNumber === "number" && Number.isFinite(currentChapterNumber)
      ? currentChapterNumber
      : chaptersCompleted + 1;
  return Math.max(1, Math.min(Math.round(next), Math.max(1, chapterCount)));
}

/** Chapter link by number; the chapter page resolves the number to the chapter. */
export function continueHref(bookId: string, chapterNumber: number): string {
  return `/book/library/${encodeURIComponent(bookId)}/chapter/${chapterNumber}`;
}

export function bookCtaLabel(chapterNumber: number): string {
  return `Continue chapter ${chapterNumber}`;
}
