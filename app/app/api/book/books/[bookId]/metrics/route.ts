import "server-only";

import { requireUser } from "@/app/app/api/_lib/auth";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import { bookOk, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { bookMetricsPk, dailyMetricsSk } from "@/app/app/api/book/_lib/keys";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddbDoc } from "@/app/app/api/_lib/aws";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ bookId: string }> }
) {
  return withBookApiErrors(req, async () => {
    await requireUser();
    const { bookId } = await params;

    const tableName = await getBookTableName();

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
