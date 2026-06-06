import "server-only";

import { requireActiveBookUser } from "@/app/app/api/book/_lib/account-guard";
import { bookOk, bookErr, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { getBookContentBucket, getBookTableName } from "@/app/app/api/book/_lib/env";
import { getJourneyProgress } from "@/app/app/api/book/_lib/journey-repo";
import { listPublishedLibraryCatalog } from "@/app/app/api/book/_lib/library-catalog";
import journeyDefinitions from "@/content/journeys/journeys.json";
import type { JourneyDefinition } from "@/app/app/api/book/_lib/types";

export const runtime = "nodejs";

type Params = { params: Promise<{ journeyId: string }> };

export async function GET(req: Request, ctx: Params) {
  return withBookApiErrors(req, async () => {
    const user = await requireActiveBookUser();
    const { journeyId } = await ctx.params;

    const def = (journeyDefinitions as JourneyDefinition[]).find(
      (d) => d.journeyId === journeyId,
    );
    if (!def) {
      return bookErr(req, 404, "not_found", "Journey not found");
    }

    const [tableName, contentBucket] = await Promise.all([
      getBookTableName(),
      getBookContentBucket(),
    ]);

    const [progress, catalog] = await Promise.all([
      getJourneyProgress(tableName, user.sub, journeyId),
      listPublishedLibraryCatalog({ tableName, contentBucket }),
    ]);

    const catalogMap = new Map(catalog.map((b) => [b.id, b]));
    const books = def.books.map((entry) => {
      const catalogBook = catalogMap.get(entry.bookId);
      return {
        bookId: entry.bookId,
        order: entry.order,
        reason: entry.reason,
        title: catalogBook?.title ?? entry.bookId,
        author: catalogBook?.author ?? "",
        coverImage: catalogBook?.coverImage ?? null,
        category: catalogBook?.category ?? "",
        completed: progress?.completedBookIds.includes(entry.bookId) ?? false,
      };
    });

    return bookOk({
      journey: {
        ...def,
        progress: progress ?? undefined,
        books,
      },
    });
  });
}
