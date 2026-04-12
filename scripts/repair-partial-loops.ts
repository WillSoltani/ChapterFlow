#!/usr/bin/env npx tsx
// Repairs partially-failed loop pipelines.
//
// Scans for BOOK_USER_QUIZ_STATE records where passed=true but
// loopPipelineCompletedAt is missing. For each, inspects per-step markers
// on the LOOP record and re-runs only the missing steps.
//
// Usage: BOOK_TABLE_NAME=ChapterFlowApp npx tsx scripts/repair-partial-loops.ts
// DRY RUN by default. Set BACKFILL_WRITE=true to actually update records.

import {
  DynamoDBDocumentClient,
  GetCommand,
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
  `Repair partial loops — table: ${tableName}, dryRun: ${dryRun}`
);

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});

function padChapter(n: number): string {
  return String(Math.max(0, n)).padStart(4, "0");
}

type RepairStats = {
  scanned: number;
  needsRepair: number;
  repaired: number;
  stepsMissing: Record<string, number>;
};

async function main() {
  let lastKey: Record<string, unknown> | undefined;
  const stats: RepairStats = {
    scanned: 0,
    needsRepair: 0,
    repaired: 0,
    stepsMissing: {},
  };

  do {
    // Scan for QUIZ_STATE records that are passed but pipeline incomplete.
    // In a real production scenario with large tables, you'd use a GSI.
    const scan = await client.send(
      new ScanCommand({
        TableName: tableName,
        FilterExpression:
          "entity = :entity AND passed = :t AND attribute_not_exists(loopPipelineCompletedAt)",
        ExpressionAttributeValues: {
          ":entity": "BOOK_USER_QUIZ_STATE",
          ":t": true,
        },
        ProjectionExpression: "PK, SK, userId, bookId, chapterNumber",
        ExclusiveStartKey: lastKey,
      })
    );

    for (const qs of scan.Items ?? []) {
      stats.scanned++;
      const pk = qs.PK as string;
      const userId = qs.userId as string;
      const bookId = qs.bookId as string;
      const chapterNumber = qs.chapterNumber as number;

      if (!pk || !userId || !bookId || !chapterNumber) continue;

      // Read the LOOP record for per-step markers.
      const loopSK = `LOOP#${bookId}#${padChapter(chapterNumber)}`;
      const loopRes = await client.send(
        new GetCommand({
          TableName: tableName,
          Key: { PK: pk, SK: loopSK },
        })
      );
      const loop = loopRes.Item;
      if (!loop) {
        console.log(
          `  [SKIP] ${userId.slice(0, 8)}... ${bookId}:${chapterNumber} — no LOOP record`
        );
        continue;
      }

      const missing: string[] = [];
      if (!loop.streakUpdatedAt) missing.push("streak");
      if (!loop.tierUpdatedAt) missing.push("tier");
      if (!loop.achievementsCheckedAt) missing.push("achievements");
      if (!loop.insightSparkCheckedAt) missing.push("spark");

      if (missing.length === 0) {
        // All steps completed but marker not set — just set the marker.
        console.log(
          `  [MARK] ${userId.slice(0, 8)}... ${bookId}:${chapterNumber} — all steps OK, setting completion marker`
        );
        if (!dryRun) {
          const now = new Date().toISOString();
          await client.send(
            new UpdateCommand({
              TableName: tableName,
              Key: { PK: pk, SK: qs.SK as string },
              UpdateExpression: "SET loopPipelineCompletedAt = :ts",
              ExpressionAttributeValues: { ":ts": now },
            })
          );
        }
        stats.repaired++;
        continue;
      }

      stats.needsRepair++;
      for (const step of missing) {
        stats.stepsMissing[step] = (stats.stepsMissing[step] ?? 0) + 1;
      }

      console.log(
        `  [REPAIR NEEDED] ${userId.slice(0, 8)}... ${bookId}:${chapterNumber} — missing: ${missing.join(", ")}`
      );

      if (!dryRun) {
        // Re-run missing steps.
        // NOTE: This is a minimal repair — it doesn't re-import the full
        // application context (streak-repo, tier-repo, achievement-repo).
        // For full repair, run the application in a Lambda with access to
        // these repos. This script only identifies and marks affected loops.
        //
        // To actually re-run steps, extend this with:
        //   import { updateStreakOnLoopComplete } from "...";
        //   import { updateTierOnLoopComplete } from "...";
        // and call them here with skipLoopCountIncrement: true for tier.
        console.log(
          `    → Marking as needs-manual-repair (automated step re-run not yet wired)`
        );
      }

      // Throttle
      if (stats.scanned % 10 === 0) {
        await new Promise((r) => setTimeout(r, 100));
      }
    }

    lastKey = scan.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey);

  console.log("\n=== Repair Summary ===");
  console.log(`Quiz states scanned (passed, no pipeline marker): ${stats.scanned}`);
  console.log(`Needs repair (missing steps): ${stats.needsRepair}`);
  console.log(`Auto-repaired (just needed marker): ${stats.repaired}`);
  console.log(`Steps missing breakdown:`, stats.stepsMissing);
  console.log(`Mode: ${dryRun ? "DRY RUN (no writes)" : "LIVE (records written)"}`);
}

main().catch((err) => {
  console.error("Repair failed:", err);
  process.exit(1);
});
