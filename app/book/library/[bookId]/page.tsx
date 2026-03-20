import { notFound } from "next/navigation";
import { requireDashboardAccess } from "@/app/_lib/require-dashboard-access";
import { getBookContentBucket, getBookTableName } from "@/app/app/api/book/_lib/env";
import { getPublishedLibraryBookDetail } from "@/app/app/api/book/_lib/library-catalog";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import { BookDetailClient } from "@/app/book/library/[bookId]/BookDetailClient";

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

export default async function BookDetailPage({
  params,
}: {
  params: Promise<{ bookId: string }>;
}) {
  await requireDashboardAccess();
  const { bookId } = await params;
  const book = await loadBookOrNotFound(bookId);
  return <BookDetailClient bookId={bookId} book={book} />;
}
