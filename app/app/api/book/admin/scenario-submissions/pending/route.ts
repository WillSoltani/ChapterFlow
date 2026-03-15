import "server-only";

import { requireAdminUser } from "@/app/app/api/book/_lib/admin-auth";
import { bookOk, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import { listPendingScenarioModerationItems } from "@/app/app/api/book/_lib/repo";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return withBookApiErrors(req, async () => {
    await requireAdminUser();
    const tableName = await getBookTableName();
    const pending = await listPendingScenarioModerationItems(tableName, 300);

    return bookOk({
      submissions: pending.map((item) => ({
        submissionId: item.submissionId,
        userId: item.userId,
        bookId: item.bookId,
        chapterNumber: item.chapterNumber,
        chapterId: item.chapterId,
        title: item.title,
        scenario: item.scenario,
        whatToDo: item.whatToDo,
        whyItMatters: item.whyItMatters,
        scope: item.scope,
        pointsAwarded: item.pointsAwarded,
        createdAt: item.createdAt,
        queuedAt: item.queuedAt,
      })),
    });
  });
}
