import "server-only";
import { requireAdminUser } from "@/app/app/api/book/_lib/admin-auth";
import { withBookApiErrors, bookOk } from "@/app/app/api/book/_lib/http";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import { getBookMeta, listBookVersions } from "@/app/app/api/book/_lib/repo";
import { BookApiError } from "@/app/app/api/book/_lib/errors";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ bookId: string }> }
) {
  return withBookApiErrors(req, async () => {
    await requireAdminUser();
    const { bookId } = await params;
    if (!bookId) throw new BookApiError(400, "invalid_book_id", "bookId is required.");

    const tableName = await getBookTableName();
    const [meta, versions] = await Promise.all([
      getBookMeta(tableName, bookId),
      listBookVersions(tableName, bookId),
    ]);

    return bookOk({
      bookId,
      meta,
      versions,
    });
  });
}
