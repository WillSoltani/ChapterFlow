import "server-only";
import { withBookApiErrors, bookOk } from "@/app/app/api/book/_lib/http";
import { getAppBaseUrl, getBookContentBucket, getBookTableName } from "@/app/app/api/book/_lib/env";
import { getPublishedLibraryBookDetail } from "@/app/app/api/book/_lib/library-catalog";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import { BOOK_DETAIL_CACHE_CONTROL } from "@/app/app/api/book/_lib/cache-control-core";

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
    const appBaseUrl = await getAppBaseUrl(req.url);

    const book = await getPublishedLibraryBookDetail({
      tableName,
      contentBucket,
      bookId,
      appBaseUrl,
    });

    const response = bookOk({ book });
    response.headers.set("Cache-Control", BOOK_DETAIL_CACHE_CONTROL);
    return response;
  });
}
