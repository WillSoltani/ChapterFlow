import { notFound } from "next/navigation";
import { requireDashboardAccess } from "@/app/_lib/require-dashboard-access";
import { getBookContentBucket, getBookTableName } from "@/app/app/api/book/_lib/env";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import { getPublishedLibraryBookDetail } from "@/app/app/api/book/_lib/library-catalog";
import { ChapterReaderClient } from "@/app/book/library/[bookId]/chapter/[chapterId]/ChapterReaderClient";
import type { LibraryBookDetail } from "@/app/book/_lib/library-data";

// Production source of truth: the published manifest (DynamoDB + S3). Chapter
// IDs come from the manifest so they stay in sync with the API-backed reader.
async function loadBook(bookId: string): Promise<LibraryBookDetail | null> {
  try {
    const [tableName, contentBucket] = await Promise.all([
      getBookTableName(),
      getBookContentBucket(),
    ]);
    return await getPublishedLibraryBookDetail({
      tableName,
      contentBucket,
      bookId,
    });
  } catch (error: unknown) {
    if (error instanceof BookApiError && error.status === 404) {
      return null;
    }
    if (
      error instanceof Error &&
      (error.message.includes("Missing required") ||
        error.message.includes("BOOK_TABLE_NAME"))
    ) {
      return null;
    }
    throw error;
  }
}

export default async function ChapterReaderPage({
  params,
}: {
  params: Promise<{ bookId: string; chapterId: string }>;
}) {
  await requireDashboardAccess();
  const { bookId, chapterId } = await params;

  const book = await loadBook(bookId);

  if (!book) {
    notFound();
  }

  // Resolve the route chapterId against the published manifest. Match by
  // chapterId/id, or by chapter number for numeric URLs and legacy bookmarks.
  let chapter =
    book.chapters.find((item) => item.chapterId === chapterId || item.id === chapterId) ?? null;

  if (!chapter) {
    const chapterNumber = Number(chapterId);
    if (!Number.isNaN(chapterNumber)) {
      chapter = book.chapters.find((item) => item.number === chapterNumber) ?? null;
    }
  }

  if (!chapter) notFound();

  return (
    <ChapterReaderClient
      bookId={bookId}
      chapterId={chapter.chapterId}
      initialBook={book}
    />
  );
}
