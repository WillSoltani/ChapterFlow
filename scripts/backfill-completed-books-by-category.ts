#!/usr/bin/env npx tsx
// Backfill BookUserTierItem.completedBooksByCategory for existing users.
//
// Rebuilds { category: [bookId, ...] } from two authoritative signals:
//   1. BOOK_USER_FLOW_POINTS_GRANT with sourceType=book_complete — proves a
//      book was fully completed.
//   2. BOOK_USER_LOOP records — carry the category for each chapter loop,
//      which is consistent across a book so we take the first non-empty one.
//
// Usage: BOOK_TABLE_NAME=ChapterFlowApp npx tsx scripts/backfill-completed-books-by-category.ts
// DRY RUN by default. Set BACKFILL_WRITE=true to actually update records.

import {
  DynamoDBDocumentClient,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

const tableName = process.env.BOOK_TABLE_NAME;
const dryRun = process.env.BACKFILL_WRITE !== "true";

if (!tableName) {
  console.error("Error: BOOK_TABLE_NAME environment variable is required.");
  process.exit(1);
}

console.log(
  `Backfill completedBooksByCategory — table: ${tableName}, dryRun: ${dryRun}`
);

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

type TierRow = {
  PK: string;
  userId: string;
  completedBooksByCategory?: Record<string, string[]>;
};

async function listCompletedBookIds(pk: string): Promise<Set<string>> {
  const res = await client.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: {
        ":pk": pk,
        ":prefix": "POINTSGRANT#book_complete#",
      },
      ProjectionExpression: "sourceId",
    })
  );
  const out = new Set<string>();
  for (const item of res.Items ?? []) {
    const sourceId = item.sourceId as string | undefined;
    if (sourceId) out.add(sourceId);
  }
  return out;
}

async function findCategoryForBook(
  pk: string,
  bookId: string
): Promise<string> {
  const res = await client.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: {
        ":pk": pk,
        ":prefix": `LOOP#${bookId}#`,
      },
      ProjectionExpression: "category",
      Limit: 20,
    })
  );
  for (const item of res.Items ?? []) {
    const category = item.category as string | undefined;
    if (category && category.trim()) return category.trim();
  }
  return "";
}

async function main() {
  let lastKey: Record<string, unknown> | undefined;
  let totalTiers = 0;
  let tiersUpdated = 0;
  let booksMapped = 0;
  let booksSkippedNoCategory = 0;

  do {
    const scan = await client.send(
      new ScanCommand({
        TableName: tableName,
        FilterExpression: "entity = :entity",
        ExpressionAttributeValues: { ":entity": "BOOK_USER_TIER" },
        ProjectionExpression: "PK, userId, completedBooksByCategory",
        ExclusiveStartKey: lastKey,
      })
    );

    for (const rawItem of scan.Items ?? []) {
      const item = rawItem as TierRow;
      const pk = item.PK;
      const userId = item.userId;
      if (!pk || !userId) continue;
      totalTiers++;

      const completedBookIds = await listCompletedBookIds(pk);
      if (completedBookIds.size === 0) continue;

      const existing = item.completedBooksByCategory ?? {};
      const rebuilt: Record<string, string[]> = {};
      // Preserve anything already mapped (e.g. from recent post-deploy loops)
      for (const [cat, ids] of Object.entries(existing)) {
        if (Array.isArray(ids) && ids.length > 0) rebuilt[cat] = [...ids];
      }

      let changed = false;
      for (const bookId of completedBookIds) {
        // Skip if already present somewhere in the map
        const already = Object.values(rebuilt).some((ids) => ids.includes(bookId));
        if (already) continue;

        const category = await findCategoryForBook(pk, bookId);
        if (!category) {
          booksSkippedNoCategory++;
          continue;
        }
        const bucket = rebuilt[category] ?? [];
        if (!bucket.includes(bookId)) {
          bucket.push(bookId);
          rebuilt[category] = bucket;
          changed = true;
          booksMapped++;
        }
      }

      if (changed) {
        console.log(
          `  [TIER] ${userId.slice(0, 8)}... → ${
            Object.keys(rebuilt).length
          } categories, ${Object.values(rebuilt).reduce(
            (n, ids) => n + ids.length,
            0
          )} completed books`
        );
        if (!dryRun) {
          await client.send(
            new UpdateCommand({
              TableName: tableName,
              Key: { PK: pk, SK: "TIER" },
              UpdateExpression:
                "SET completedBooksByCategory = :c, updatedAt = :now",
              ExpressionAttributeValues: {
                ":c": rebuilt,
                ":now": new Date().toISOString(),
              },
            })
          );
        }
        tiersUpdated++;
      }

      if (totalTiers % 10 === 0) {
        await new Promise((r) => setTimeout(r, 100));
      }
    }

    lastKey = scan.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey);

  console.log("\n=== Backfill Summary ===");
  console.log(`Tier records scanned: ${totalTiers}`);
  console.log(`Tier records updated: ${tiersUpdated}`);
  console.log(`Books mapped into a category: ${booksMapped}`);
  console.log(`Books skipped (no category on LOOP): ${booksSkippedNoCategory}`);
  console.log(`Mode: ${dryRun ? "DRY RUN (no writes)" : "LIVE (records written)"}`);
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
