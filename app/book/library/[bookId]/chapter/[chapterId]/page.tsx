import { notFound } from "next/navigation";
import { requireDashboardAccess } from "@/app/_lib/require-dashboard-access";
import { getBookContentBucket, getBookTableName } from "@/app/app/api/book/_lib/env";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import { getPublishedLibraryBookDetail } from "@/app/app/api/book/_lib/library-catalog";
import { ChapterReaderClient } from "@/app/book/library/[bookId]/chapter/[chapterId]/ChapterReaderClient";
import type { LibraryBookDetail } from "@/app/book/_lib/library-data";
import {
  BOOK_PACKAGES,
  getBookPackagePresentation,
} from "@/app/book/data/bookPackages";

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

function buildLocalFallback(bookId: string): LibraryBookDetail | null {
  const pkg = BOOK_PACKAGES.find((p) => p.book.bookId === bookId);
  if (!pkg) return null;

  const presentation = getBookPackagePresentation(bookId);

  return {
    id: pkg.book.bookId,
    title: pkg.book.title,
    author: pkg.book.author,
    icon: presentation.icon,
    coverImage: presentation.coverImage,
    category: pkg.book.categories[0] ?? "General",
    categories: pkg.book.categories,
    difficulty: presentation.difficulty,
    estimatedMinutes: pkg.chapters.reduce(
      (sum, ch) => sum + Math.max(ch.readingTimeMinutes, 1),
      0
    ),
    chapterCount: pkg.chapters.length,
    pages: presentation.pages,
    synopsis: presentation.synopsis,
    tags: pkg.book.tags ?? [],
    variantFamily: pkg.book.variantFamily,
    publishedVersion: 1,
    chapters: pkg.chapters.map((ch) => ({
      id: ch.chapterId,
      chapterId: ch.chapterId,
      number: ch.number,
      code: `ch-${ch.number}`,
      title: ch.title,
      minutes: ch.readingTimeMinutes,
    })),
  };
}

export default async function ChapterReaderPage({
  params,
}: {
  params: Promise<{ bookId: string; chapterId: string }>;
}) {
  await requireDashboardAccess();
  const { bookId, chapterId } = await params;

  const book = (await loadBook(bookId)) ?? buildLocalFallback(bookId);

  if (!book) {
    notFound();
  }

  const chapter = book.chapters.find((item) => item.id === chapterId);
  if (!chapter) notFound();

  return <ChapterReaderClient bookId={bookId} chapterId={chapterId} />;
}
