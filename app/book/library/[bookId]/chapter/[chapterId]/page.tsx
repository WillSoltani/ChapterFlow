import { notFound } from "next/navigation";
import { requireDashboardAccess } from "@/app/_lib/require-dashboard-access";
import { getBookContentBucket, getBookTableName } from "@/app/app/api/book/_lib/env";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import { getPublishedLibraryBookDetail } from "@/app/app/api/book/_lib/library-catalog";
import { loadInitialChapterContent } from "@/app/app/api/book/_lib/initial-chapter-content";
import { ChapterReaderClient } from "@/app/book/library/[bookId]/chapter/[chapterId]/ChapterReaderClient";
import { findLibraryChapterSummary, type LibraryBookDetail } from "@/app/book/_lib/library-data";

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
  const access = await requireDashboardAccess();
  const { bookId, chapterId } = await params;

  // Load the published book detail AND server-hydrate the chapter's content in
  // parallel (WS3-024). `loadInitialChapterContent` reuses the React-cached
  // `getPublishedLibraryBookDetail`, so the manifest is read once across both —
  // TTFB doesn't double (loading.tsx trap); the content read adds only its own
  // progress + chapter S3 reads. It fails closed to null (no hydration) for any
  // not-started / paywalled / locked / logged-out viewer, so gating is unchanged.
  const [book, initialSeed] = await Promise.all([
    loadBook(bookId),
    access.onboarding === "confirmed_complete"
      ? loadInitialChapterContent(bookId, chapterId)
      : Promise.resolve(null),
  ]);

  if (!book) {
    notFound();
  }

  // Resolve the route chapterId against the published manifest (shared resolver,
  // identical to the match loadInitialChapterContent used). Match by chapterId/id,
  // or by chapter number for numeric URLs and legacy bookmarks.
  const chapter = findLibraryChapterSummary(book, chapterId);

  if (!chapter) notFound();

  return (
    <ChapterReaderClient
      bookId={bookId}
      chapterId={chapter.chapterId}
      chapterOrder={chapter.number}
      initialBook={book}
      initialChapter={initialSeed?.content}
    />
  );
}
