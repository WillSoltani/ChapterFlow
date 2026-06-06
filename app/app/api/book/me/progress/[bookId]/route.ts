import "server-only";
import { requireActiveBookUser } from "@/app/app/api/book/_lib/account-guard";
import { bookOk, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import { getUserProgress } from "@/app/app/api/book/_lib/repo";
import { BookApiError } from "@/app/app/api/book/_lib/errors";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ bookId: string }> }
) {
  return withBookApiErrors(req, async () => {
    const user = await requireActiveBookUser();
    const { bookId } = await params;
    if (!bookId) {
      throw new BookApiError(400, "invalid_book_id", "bookId is required.");
    }

    const tableName = await getBookTableName();
    const progress = await getUserProgress(tableName, user.sub, bookId);
    if (!progress) {
      throw new BookApiError(404, "progress_not_found", "No progress found for this book.");
    }

    return bookOk({ progress });
  });
}
