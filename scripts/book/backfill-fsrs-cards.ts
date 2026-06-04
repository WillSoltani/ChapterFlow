#!/usr/bin/env tsx
/**
 * Backfill FSRS spaced-repetition cards for chapters users already passed.
 *
 * The quiz-submit route now seeds FSRS cards on every pass, but existing users
 * who passed chapters BEFORE that shipped have no cards. This walks every
 * BOOK_USER_LOOP record (one per passed chapter) and seeds its review cards.
 * initializeCardsForChapter dedupes per card, so this is safe to re-run.
 *
 * Usage:
 *   BOOK_TABLE_NAME=... BOOK_CONTENT_BUCKET=... \
 *     npx tsx scripts/book/backfill-fsrs-cards.ts [--dry-run] [--user <sub>]
 *
 * Notes:
 *   - Requires AWS credentials with access to the book table + content bucket.
 *   - --user <sub> limits the backfill to a single user (recommended first run).
 *   - This Scans the main table filtered to BOOK_USER_LOOP; run off-peak.
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

function installServerOnlyShim(): () => void {
  const Module = require("node:module") as {
    _load: (request: string, parent: unknown, isMain: boolean) => unknown;
  };
  const originalLoad = Module._load;
  Module._load = function patchedLoad(request: string, parent: unknown, isMain: boolean) {
    if (request === "server-only") return {};
    return originalLoad.call(this, request, parent, isMain);
  };
  return () => {
    Module._load = originalLoad;
  };
}

type LoopRow = {
  userId?: string;
  bookId?: string;
  chapterNumber?: number;
};

async function main() {
  const restore = installServerOnlyShim();
  const { ddbDoc } = await import("@/app/app/api/_lib/aws");
  const { ScanCommand } = await import("@aws-sdk/lib-dynamodb");
  const { getUserAccessibleChapter } = await import(
    "@/app/app/api/book/_lib/content-service"
  );
  const { initializeCardsForChapter } = await import("@/app/app/api/book/_lib/fsrs-repo");
  const { getUserSettingsItem } = await import("@/app/app/api/book/_lib/repo");
  restore();

  const tableName = process.env.BOOK_TABLE_NAME;
  const contentBucket = process.env.BOOK_CONTENT_BUCKET;
  if (!tableName || !contentBucket) {
    throw new Error("Set BOOK_TABLE_NAME and BOOK_CONTENT_BUCKET.");
  }

  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const userFilterIndex = args.indexOf("--user");
  const userFilter = userFilterIndex >= 0 ? args[userFilterIndex + 1] : null;

  const toneCache = new Map<string, string>();
  async function resolveTone(userId: string): Promise<string> {
    const cached = toneCache.get(userId);
    if (cached) return cached;
    let tone = "direct";
    try {
      const settings = await getUserSettingsItem(tableName!, userId);
      // Mirror the submit route's readSavedTone: the saved tone lives at
      // settings.extended.contentTone (NOT settings.contentTone).
      const extended = (settings?.settings as { extended?: { contentTone?: unknown } } | undefined)
        ?.extended;
      if (typeof extended?.contentTone === "string" && extended.contentTone.trim()) {
        tone = extended.contentTone.trim();
      }
    } catch {
      /* default tone */
    }
    toneCache.set(userId, tone);
    return tone;
  }

  let scanned = 0;
  let seeded = 0;
  let skipped = 0;
  let failed = 0;
  let lastKey: Record<string, unknown> | undefined;

  do {
    const result = await ddbDoc.send(
      new ScanCommand({
        TableName: tableName,
        FilterExpression: "entity = :entity",
        ExpressionAttributeValues: { ":entity": "BOOK_USER_LOOP" },
        ExclusiveStartKey: lastKey,
      })
    );

    for (const raw of result.Items ?? []) {
      const row = raw as LoopRow;
      scanned += 1;
      const { userId, bookId } = row;
      const chapterNumber = Number(row.chapterNumber);
      if (!userId || !bookId || !Number.isFinite(chapterNumber)) {
        skipped += 1;
        continue;
      }
      if (userFilter && userId !== userFilter) {
        skipped += 1;
        continue;
      }

      try {
        const { chapter } = await getUserAccessibleChapter({
          tableName,
          contentBucket,
          userId,
          bookId,
          chapterNumber,
        });
        const reviewCards = chapter.reviewCards ?? [];
        if (reviewCards.length === 0) {
          skipped += 1;
          continue;
        }
        if (dryRun) {
          console.log(`[dry-run] would seed ${reviewCards.length} cards: ${userId} ${bookId} ch${chapterNumber}`);
          seeded += 1;
          continue;
        }
        const tone = await resolveTone(userId);
        const created = await initializeCardsForChapter(
          tableName,
          userId,
          bookId,
          chapterNumber,
          reviewCards,
          tone
        );
        seeded += 1;
        console.log(`seeded ${created.length}/${reviewCards.length} new cards: ${userId} ${bookId} ch${chapterNumber}`);
      } catch (error) {
        failed += 1;
        console.error(`failed: ${userId} ${bookId} ch${chapterNumber}: ${String(error)}`);
      }
    }

    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  console.log(
    `\nDone. scanned=${scanned} seeded=${seeded} skipped=${skipped} failed=${failed}${dryRun ? " (dry-run)" : ""}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
