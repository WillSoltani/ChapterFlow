import "server-only";
import { requireUser } from "@/app/app/api/_lib/auth";
import { bookOk, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import {
  getUserEntitlement,
  listAllUserProgress,
  summarizeProgress,
} from "@/app/app/api/book/_lib/repo";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return withBookApiErrors(req, async () => {
    const user = await requireUser();
    const tableName = await getBookTableName();
    const [entitlement, progress] = await Promise.all([
      getUserEntitlement(tableName, user.sub),
      listAllUserProgress(tableName, user.sub),
    ]);

    return bookOk({
      summary: summarizeProgress(progress, entitlement),
      books: progress.map((entry) => ({
        bookId: entry.bookId,
        pinnedBookVersion: entry.pinnedBookVersion,
        currentChapterNumber: entry.currentChapterNumber,
        unlockedThroughChapterNumber: entry.unlockedThroughChapterNumber,
        completedChapters: entry.completedChapters,
        bestScoreByChapter: entry.bestScoreByChapter,
        lastOpenedAt: entry.lastOpenedAt,
        lastActiveAt: entry.lastActiveAt,
        updatedAt: entry.updatedAt,
      })),
    });
  });
}
