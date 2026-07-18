import "server-only";

import { requireActiveBookUser } from "@/app/app/api/book/_lib/account-guard";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import { bookOk, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { getCatalogBook, getUserProgress } from "@/app/app/api/book/_lib/repo";
import { queryDailyReaderMetricsRange } from "@/app/app/api/book/_lib/book-metrics-repo";

export const runtime = "nodejs";

// Web-only batched sibling of books/[bookId]/metrics (WS3-023). The Progress page
// needs per-title reader KPIs for the viewer's few active books; issuing one HTTP
// request per book was an N-request fan-out. This endpoint takes all book ids in
// one POST and returns their metrics together, so the page makes ONE call.
//
// Deliberately NOT folded into the /me/dashboard aggregate: that route is a fenced
// native-iOS contract producer whose success fixture structurally enumerates its
// response fields, so adding a field would be a native-contract change. This
// endpoint lives outside the native registry (no iOS producer references it), so
// it carries no contract weight — `npm run contract:native:generate` is unchanged.

const MAX_BOOK_IDS = 50;

type BookReaderMetrics = {
  readersToday: number;
  readersWeek: number;
  loopsToday: number;
  loopsWeek: number;
};

/** Aggregate the daily KPI rows into today/week totals. Mirrors the per-book route. */
function aggregateMetrics(items: Record<string, unknown>[], today: string): BookReaderMetrics {
  let readersToday = 0;
  let readersWeek = 0;
  let loopsToday = 0;
  let loopsWeek = 0;
  for (const item of items) {
    const readers = typeof item.uniqueReaders === "number" ? item.uniqueReaders : 0;
    const loops = typeof item.loopCompletions === "number" ? item.loopCompletions : 0;
    readersWeek += readers;
    loopsWeek += loops;
    if (item.dayKey === today) {
      readersToday = readers;
      loopsToday = loops;
    }
  }
  return { readersToday, readersWeek, loopsToday, loopsWeek };
}

export async function POST(req: Request) {
  return withBookApiErrors(req, async () => {
    const user = await requireActiveBookUser();

    const body = (await req.json().catch(() => null)) as { bookIds?: unknown } | null;
    if (!body || typeof body !== "object" || !Array.isArray(body.bookIds)) {
      throw new BookApiError(400, "invalid_body", "Expected { bookIds: string[] }.");
    }

    // De-dupe, drop blanks, and cap the fan-out so a caller can't enumerate the
    // whole catalog's engagement numbers in one request.
    const bookIds = Array.from(
      new Set(
        body.bookIds.filter((id): id is string => typeof id === "string" && id.length > 0),
      ),
    ).slice(0, MAX_BOOK_IDS);

    const tableName = await getBookTableName();
    const today = new Date().toISOString().slice(0, 10);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    // Per-book authorization mirrors books/[bookId]/metrics EXACTLY: the book must
    // be a published catalog title AND the caller must have started it. Books that
    // fail either check are simply omitted (no error), so the page still renders.
    const entries = await Promise.all(
      bookIds.map(async (bookId): Promise<readonly [string, BookReaderMetrics] | null> => {
        const catalog = await getCatalogBook(tableName, bookId);
        if (!catalog || !catalog.currentPublishedVersion) return null;
        const progress = await getUserProgress(tableName, user.sub, bookId);
        if (!progress) return null;
        const items = await queryDailyReaderMetricsRange(tableName, bookId, weekAgo, today);
        return [bookId, aggregateMetrics(items, today)] as const;
      }),
    );

    const metrics: Record<string, BookReaderMetrics> = {};
    for (const entry of entries) {
      if (entry) metrics[entry[0]] = entry[1];
    }

    return bookOk({ metrics });
  });
}
