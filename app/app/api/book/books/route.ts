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
    return bookOk({ books });
  });
}
