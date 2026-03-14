import { notFound } from "next/navigation";
import { requireDashboardAccess } from "@/app/_lib/require-dashboard-access";
import { getLibraryBookById } from "@/app/book/data/mockUserLibraryState";
import { getChapterById } from "@/app/book/data/mockChapters";
import { ChapterReaderClient } from "@/app/book/library/[bookId]/chapter/[chapterId]/ChapterReaderClient";

export default async function ChapterReaderPage({
  params,
}: {
  params: Promise<{ bookId: string; chapterId: string }>;
}) {
  await requireDashboardAccess();
  const { bookId, chapterId } = await params;

  const book = getLibraryBookById(bookId);
  if (!book) notFound();

  const chapter = getChapterById(bookId, chapterId);
  if (!chapter) notFound();

  return <ChapterReaderClient bookId={bookId} chapterId={chapterId} />;
}
