import "server-only";
import { withBookApiErrors, bookOk } from "@/app/app/api/book/_lib/http";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import { listPublishedCatalogItems } from "@/app/app/api/book/_lib/repo";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return withBookApiErrors(req, async () => {
    const tableName = await getBookTableName();
    const books = await listPublishedCatalogItems(tableName);
    return bookOk({
      books: books.filter((b) => b.status === "PUBLISHED" && !!b.currentPublishedVersion),
    });
  });
}
