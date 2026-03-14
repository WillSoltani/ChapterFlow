import { notFound } from "next/navigation";
import { requireDashboardAccess } from "@/app/_lib/require-dashboard-access";
import { getLibraryBookById } from "@/app/book/data/mockUserLibraryState";
import { BookDetailClient } from "@/app/book/library/[bookId]/BookDetailClient";

export default async function BookDetailPage({
  params,
}: {
  params: Promise<{ bookId: string }>;
}) {
  await requireDashboardAccess();
  const { bookId } = await params;
  const entry = getLibraryBookById(bookId);
  if (!entry) notFound();

  return <BookDetailClient bookId={bookId} />;
}

