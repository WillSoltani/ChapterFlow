import "server-only";
import { withBookApiErrors, bookOk } from "@/app/app/api/book/_lib/http";
import { getBookContentBucket, getBookTableName } from "@/app/app/api/book/_lib/env";
import { getCatalogBook } from "@/app/app/api/book/_lib/repo";
import { getPublishedBookManifest } from "@/app/app/api/book/_lib/content-service";
import { BookApiError } from "@/app/app/api/book/_lib/errors";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ bookId: string }> }
) {
  return withBookApiErrors(req, async () => {
    const { bookId } = await params;
    if (!bookId) {
      throw new BookApiError(400, "invalid_book_id", "bookId is required.");
    }

    const tableName = await getBookTableName();
    const contentBucket = await getBookContentBucket();

    const catalog = await getCatalogBook(tableName, bookId);
    if (!catalog || !catalog.currentPublishedVersion || catalog.status !== "PUBLISHED") {
      throw new BookApiError(404, "book_not_found", "Book not found.");
    }

    const { version, manifest } = await getPublishedBookManifest({
      tableName,
      contentBucket,
      bookId,
    });

    return bookOk({
      book: {
        ...catalog,
        publishedVersion: version,
        chapterCount: manifest.chapterCount,
        chapters: manifest.chapters.map((ch) => ({
          chapterId: ch.chapterId,
          number: ch.number,
          title: ch.title,
          readingTimeMinutes: ch.readingTimeMinutes,
        })),
      },
    });
  });
}
