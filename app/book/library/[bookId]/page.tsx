import { notFound } from "next/navigation";
import { requireDashboardAccess } from "@/app/_lib/require-dashboard-access";
import { getBookContentBucket, getBookTableName } from "@/app/app/api/book/_lib/env";
import { getPublishedLibraryBookDetail } from "@/app/app/api/book/_lib/library-catalog";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import { BookDetailClient } from "@/app/book/library/[bookId]/BookDetailClient";
import type { LibraryBookDetail } from "@/app/book/_lib/library-data";

// Production source of truth: the published catalog (DynamoDB metadata + S3
// manifest). Chapter IDs come from the manifest so they stay in sync with the
// API-backed reader. Returns null on 404 or when the book backend env is
// missing (local dev without AWS) → notFound().
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
    // In dev without DB env vars, surface a 404 rather than crashing.
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

export default async function BookDetailPage({
  params,
}: {
  params: Promise<{ bookId: string }>;
}) {
  await requireDashboardAccess();
  const { bookId } = await params;

  const book = await loadBook(bookId);

  if (!book) {
    notFound();
  }

  return <BookDetailClient bookId={bookId} book={book} />;
}
