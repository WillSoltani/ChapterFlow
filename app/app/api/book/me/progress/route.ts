import "server-only";
import { requireActiveBookUser } from "@/app/app/api/book/_lib/account-guard";
import { bookOk, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { getBookContentBucket, getBookTableName } from "@/app/app/api/book/_lib/env";
import {
  getUserEntitlement,
  listAllUserProgress,
  summarizeProgress,
} from "@/app/app/api/book/_lib/repo";
import { readPinnedChapterCounts } from "@/app/app/api/book/_lib/content-service";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return withBookApiErrors(req, async () => {
    const user = await requireActiveBookUser();
    const [tableName, contentBucket] = await Promise.all([
      getBookTableName(),
      getBookContentBucket(),
    ]);
    const [entitlement, progress] = await Promise.all([
      getUserEntitlement(tableName, user.sub),
      listAllUserProgress(tableName, user.sub),
    ]);

    // Whole-book completion in the summary must be judged against each user's
    // PINNED version's chapter count, not a heuristic. Each progress row's
    // manifestKey already points at its pinned manifest; read those (best-effort)
    // so summarizeProgress can compute booksCompleted exactly. Without these
    // counts a sequentially-finished book could never report as completed
    // (see book-completion-core.ts / isBookCompleted).
    const chapterCounts = await readPinnedChapterCounts({
      contentBucket,
      entries: progress.map((entry) => ({
        bookId: entry.bookId,
        manifestKey: entry.manifestKey,
      })),
    });

    return bookOk({
      summary: summarizeProgress(progress, entitlement, chapterCounts),
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
