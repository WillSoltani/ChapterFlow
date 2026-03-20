import { notFound } from "next/navigation";
import { requireDashboardAccess } from "@/app/_lib/require-dashboard-access";
import { getBookContentBucket, getBookTableName } from "@/app/app/api/book/_lib/env";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import { getPublishedLibraryBookDetail } from "@/app/app/api/book/_lib/library-catalog";
import { ChapterReaderClient } from "@/app/book/library/[bookId]/chapter/[chapterId]/ChapterReaderClient";

async function loadBookOrNotFound(bookId: string) {
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
      notFound();
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
  const book = await loadBookOrNotFound(bookId);
  const chapter = book.chapters.find((item) => item.id === chapterId);
  if (!chapter) notFound();

  return <ChapterReaderClient bookId={bookId} chapterId={chapterId} />;
}
