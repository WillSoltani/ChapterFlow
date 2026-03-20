import "server-only";

import { requireUser } from "@/app/app/api/_lib/auth";
import { getBookContentBucket, getBookTableName } from "@/app/app/api/book/_lib/env";
import {
  applyStartDeviceCookie,
  ensureUserBookStarted,
} from "@/app/app/api/book/_lib/ensure-book-started";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import { bookOk, withBookApiErrors } from "@/app/app/api/book/_lib/http";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ bookId: string }> }
) {
  return withBookApiErrors(req, async () => {
    const user = await requireUser();
    const { bookId } = await params;
    if (!bookId) {
      throw new BookApiError(400, "invalid_book_id", "bookId is required.");
    }

    const [tableName, contentBucket] = await Promise.all([
      getBookTableName(),
      getBookContentBucket(),
    ]);
    const started = await ensureUserBookStarted({
      req,
      user,
      tableName,
      contentBucket,
      bookId,
    });

    const response = bookOk({
      bookId,
      entitlement: {
        plan: started.entitlement.plan,
        proStatus: started.entitlement.proStatus ?? "inactive",
        freeBookSlots: started.entitlement.freeBookSlots,
        unlockedBookIds: started.entitlement.unlockedBookIds,
      },
      progress: {
        pinnedBookVersion: started.progress.pinnedBookVersion,
        currentChapterNumber: started.progress.currentChapterNumber,
        unlockedThroughChapterNumber: started.progress.unlockedThroughChapterNumber,
        completedChapters: started.progress.completedChapters,
      },
    });

    return applyStartDeviceCookie(response, started);
  });
}
