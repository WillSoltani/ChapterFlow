import "server-only";

import { requireActiveBookUser } from "@/app/app/api/book/_lib/account-guard";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import { bookOk, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { bookMetricsPk, dailyMetricsSk } from "@/app/app/api/book/_lib/keys";
import { getCatalogBook, getUserProgress } from "@/app/app/api/book/_lib/repo";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddbDoc } from "@/app/app/api/_lib/aws";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ bookId: string }> }
) {
  return withBookApiErrors(req, async () => {
    const user = await requireActiveBookUser();
    const { bookId } = await params;

    const tableName = await getBookTableName();

    // Per-title reader/loop KPIs are business-sensitive: do not let any logged-in
    // user enumerate engagement numbers across the whole catalog (L22). Require
    // (1) the book to be a published catalog title, and (2) the caller to have
    // actually started it — the only legitimate consumer (the Progress page)
    // requests metrics solely for the viewer's own active books.
    const catalog = await getCatalogBook(tableName, bookId);
    if (!catalog || !catalog.currentPublishedVersion) {
      throw new BookApiError(404, "book_not_found", "Published book not found.");
    }

    const progress = await getUserProgress(tableName, user.sub, bookId);
    if (!progress) {
      throw new BookApiError(
        403,
        "book_not_started",
        "Start this book to view its reader activity."
      );
    }

    const today = new Date().toISOString().slice(0, 10);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const res = await ddbDoc.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression:
          "PK = :pk AND SK BETWEEN :start AND :end",
        ExpressionAttributeValues: {
          ":pk": bookMetricsPk(bookId),
          ":start": dailyMetricsSk(weekAgo),
          ":end": dailyMetricsSk(today),
        },
      })
    );

    let readersToday = 0;
    let readersWeek = 0;
    let loopsToday = 0;
    let loopsWeek = 0;

    for (const item of res.Items ?? []) {
      const readers = typeof item.uniqueReaders === "number" ? item.uniqueReaders : 0;
      const loops = typeof item.loopCompletions === "number" ? item.loopCompletions : 0;
      readersWeek += readers;
      loopsWeek += loops;
      if (item.dayKey === today) {
        readersToday = readers;
        loopsToday = loops;
      }
    }

    return bookOk({
      bookId,
      readersToday,
      readersWeek,
      loopsToday,
      loopsWeek,
    });
  });
}
