#!/usr/bin/env npx tsx
// Implements P3 Task 30 — Data backfill migration.
// One-time script: compute TIER and LOOP records from existing
// BOOK_PROGRESS and QUIZ_STATE data. Initialize all existing users
// at Reader tier.
//
// Usage: BOOK_TABLE_NAME=ChapterFlowApp npx tsx scripts/backfill-ip-records.ts
//
// This is a DRY RUN by default. Set BACKFILL_WRITE=true to actually write records.

import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

const tableName = process.env.BOOK_TABLE_NAME;
const dryRun = process.env.BACKFILL_WRITE !== "true";

if (!tableName) {
  console.error("Error: BOOK_TABLE_NAME environment variable is required.");
  process.exit(1);
}

console.log(`Backfill IP records — table: ${tableName}, dryRun: ${dryRun}`);

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

function padChapter(n: number): string {
  return String(Math.max(0, n)).padStart(4, "0");
}

async function main() {
  // Scan all engagement records to find users
  let lastKey: Record<string, unknown> | undefined;
  let totalUsers = 0;
  let tierCreated = 0;
  let loopCreated = 0;
  let streakCreated = 0;

  do {
    const scan = await client.send(
      new ScanCommand({
        TableName: tableName,
        FilterExpression: "entity = :entity",
        ExpressionAttributeValues: { ":entity": "BOOK_USER_ENGAGEMENT" },
        ProjectionExpression: "PK, userId",
        ExclusiveStartKey: lastKey,
      })
    );

    for (const item of scan.Items ?? []) {
      const userId = item.userId as string;
      if (!userId) continue;
      totalUsers++;

      // Check if TIER record already exists
      const tierCheck = await client.send(
        new GetCommand({
          TableName: tableName,
          Key: { PK: `BOOKUSER#${userId}`, SK: "TIER" },
          ProjectionExpression: "PK",
        })
      );

      if (!tierCheck.Item) {
        // Initialize TIER at Reader
        const now = new Date().toISOString();
        console.log(`  [TIER] Creating Reader tier for user ${userId.slice(0, 8)}...`);

        if (!dryRun) {
          try {
            await client.send(
              new PutCommand({
                TableName: tableName,
                Item: {
                  PK: `BOOKUSER#${userId}`,
                  SK: "TIER",
                  entity: "BOOK_USER_TIER",
                  userId,
                  currentTier: "reader",
                  totalLoopsCompleted: 0,
                  avgQuizScoreSum: 0,
                  avgQuizScoreCount: 0,
                  categoriesExplored: [],
                  tiersAdvanced: [],
                  tierAdvancedAt: null,
                  createdAt: now,
                  updatedAt: now,
                },
                ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)",
              })
            );
            tierCreated++;
          } catch {
            // Already exists
          }
        } else {
          tierCreated++;
        }
      }

      // Check if STREAK record already exists
      const streakCheck = await client.send(
        new GetCommand({
          TableName: tableName,
          Key: { PK: `BOOKUSER#${userId}`, SK: "STREAK" },
          ProjectionExpression: "PK",
        })
      );

      if (!streakCheck.Item) {
        const now = new Date().toISOString();
        console.log(`  [STREAK] Creating streak record for user ${userId.slice(0, 8)}...`);

        if (!dryRun) {
          try {
            await client.send(
              new PutCommand({
                TableName: tableName,
                Item: {
                  PK: `BOOKUSER#${userId}`,
                  SK: "STREAK",
                  entity: "BOOK_USER_STREAK",
                  userId,
                  currentStreak: 0,
                  longestStreak: 0,
                  lastActiveDate: null,
                  lastActiveTimezone: null,
                  streakShieldsHeld: 0,
                  shieldUsedDates: [],
                  consistencyLast30: 0,
                  consistencyAbove80Since: null,
                  milestonesReached: [],
                  createdAt: now,
                  updatedAt: now,
                },
                ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)",
              })
            );
            streakCreated++;
          } catch {
            // Already exists
          }
        } else {
          streakCreated++;
        }
      }

      // Backfill LOOP records from completed chapters in PROGRESS records
      const progressQuery = await client.send(
        new QueryCommand({
          TableName: tableName,
          KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
          ExpressionAttributeValues: {
            ":pk": `BOOKUSER#${userId}`,
            ":prefix": "PROGRESS#",
          },
        })
      );

      for (const progress of progressQuery.Items ?? []) {
        const bookId = progress.bookId as string;
        const completedChapters = progress.completedChapters as number[] | undefined;
        const bestScores = progress.bestScoreByChapter as Record<string, number> | undefined;

        if (!bookId || !completedChapters) continue;

        for (const chapter of completedChapters) {
          const loopSK = `LOOP#${bookId}#${padChapter(chapter)}`;

          // Check if LOOP record already exists
          const loopCheck = await client.send(
            new GetCommand({
              TableName: tableName,
              Key: { PK: `BOOKUSER#${userId}`, SK: loopSK },
              ProjectionExpression: "PK",
            })
          );

          if (!loopCheck.Item) {
            const score = bestScores?.[String(chapter)] ?? 0;
            const now = new Date().toISOString();
            console.log(`  [LOOP] ${bookId}:${chapter} for user ${userId.slice(0, 8)}...`);

            if (!dryRun) {
              try {
                await client.send(
                  new PutCommand({
                    TableName: tableName,
                    Item: {
                      PK: `BOOKUSER#${userId}`,
                      SK: loopSK,
                      entity: "BOOK_USER_LOOP",
                      userId,
                      bookId,
                      chapterNumber: chapter,
                      completedAt: now,
                      quizScore: score,
                      learningMode: "standard", // Default — actual mode unknown for historical data
                      isFirstAttempt: true, // Default
                      category: "", // Not available in progress data
                      createdAt: now,
                    },
                    ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)",
                  })
                );
                loopCreated++;
              } catch {
                // Already exists
              }
            } else {
              loopCreated++;
            }
          }
        }
      }

      // Throttle to avoid DynamoDB capacity issues
      if (totalUsers % 10 === 0) {
        await new Promise((r) => setTimeout(r, 100));
      }
    }

    lastKey = scan.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey);

  console.log("\n=== Backfill Summary ===");
  console.log(`Total users processed: ${totalUsers}`);
  console.log(`TIER records created: ${tierCreated}`);
  console.log(`STREAK records created: ${streakCreated}`);
  console.log(`LOOP records created: ${loopCreated}`);
  console.log(`Mode: ${dryRun ? "DRY RUN (no writes)" : "LIVE (records written)"}`);
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
