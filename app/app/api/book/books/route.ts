import "server-only";
import { withBookApiErrors, bookOk } from "@/app/app/api/book/_lib/http";
import { getBookContentBucket, getBookTableName } from "@/app/app/api/book/_lib/env";
import { listPublishedLibraryCatalog } from "@/app/app/api/book/_lib/library-catalog";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return withBookApiErrors(req, async () => {
    const [tableName, contentBucket] = await Promise.all([
      getBookTableName(),
      getBookContentBucket(),
    ]);
    const books = await listPublishedLibraryCatalog({ tableName, contentBucket });
    const response = bookOk({ books });
    // Catalog changes only on book publish events.
    // Public cache with 1-hour max-age and 24-hour stale-while-revalidate.
    response.headers.set(
      "Cache-Control",
      "public, max-age=3600, stale-while-revalidate=86400"
    );
    return response;
  });
}
