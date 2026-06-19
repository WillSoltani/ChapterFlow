#!/usr/bin/env tsx
/**
 * Reconcile the production book catalog (PROD-DUP / DUP-OLD-DEGRADED).
 *
 * A slug rename keyed a brand-new catalog record under the new slug but never
 * superseded the old one, so several books are live TWICE — the canonical v21
 * record plus a stale "orphan" record at the old slug serving degraded content.
 * This script enumerates the live prod catalog and produces a plan to retire the
 * orphan records (status -> ARCHIVED, which preserves the record AND every
 * reader's progress row, so it is non-destructive) and to surface the wider set
 * of non-curated published books (the 7A / PAR-1 launch-set decision).
 *
 * DRY RUN BY DEFAULT. It prints the exact delta (kept / archived / flagged) and
 * mutates nothing unless you pass BOTH --apply and --yes. Even then it only
 * archives the known orphan dup-sets (lib/book-slug-aliases.ts); the wider
 * non-curated set is report-only unless you also pass --include-non-curated.
 *
 * Usage:
 *   BOOK_TABLE_NAME=... AWS_REGION=... \
 *     npx tsx scripts/book/reconcile-prod-catalog.ts            # dry run (default)
 *
 *   BOOK_TABLE_NAME=... \
 *     npx tsx scripts/book/reconcile-prod-catalog.ts --apply --yes
 *
 * Flags:
 *   --apply               actually mutate the catalog (default: dry run)
 *   --yes                 required with --apply (confirmation)
 *   --include-non-curated also archive published records not in the curated
 *                         allowlist and not orphans (the 7A/PAR-1 wider set) —
 *                         only after the launch set is confirmed
 *   --skip-progress-scan  skip the reader-progress safety scan (faster; the scan
 *                         is a full table scan, so off-peak only)
 *
 * Notes:
 *   - Requires AWS credentials with read/write on the book table.
 *   - ARCHIVE never deletes content or progress; the orphan→canonical redirects
 *     in next.config.ts carry inbound links forward. S3 content prefixes are
 *     reported but never deleted here (a record with reader progress may still
 *     resolve content); purge them in a separate, explicitly creds-gated step.
 */
import { createRequire } from "node:module";

import { BOOK_PACKAGES } from "@/app/book/data/bookPackages";
import {
  ORPHAN_BOOK_SLUGS,
  isOrphanBookSlug,
  resolveCanonicalBookSlug,
} from "@/lib/book-slug-aliases";
import {
  findDuplicateTitleGroups,
  type CatalogRecordLike,
} from "@/lib/catalog-integrity";

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

type Args = {
  tableName: string;
  apply: boolean;
  yes: boolean;
  includeNonCurated: boolean;
  skipProgressScan: boolean;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    tableName: process.env.BOOK_TABLE_NAME || "",
    apply: false,
    yes: false,
    includeNonCurated: false,
    skipProgressScan: false,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === "--apply") args.apply = true;
    else if (value === "--yes") args.yes = true;
    else if (value === "--include-non-curated") args.includeNonCurated = true;
    else if (value === "--skip-progress-scan") args.skipProgressScan = true;
  }
  if (!args.tableName) {
    throw new Error("Missing BOOK_TABLE_NAME. Set it in env (and AWS credentials).");
  }
  if (args.apply && !args.yes) {
    throw new Error(
      "--apply requires --yes. Re-run with `--apply --yes` once you have reviewed the dry-run plan."
    );
  }
  return args;
}

// One full-table scan, filtered to reader-progress records, bucketed by bookId.
// No GSI keys progress by bookId (only by user), so a scan is the only way to
// answer "does this orphan slug have active readers". Counts distinct users.
async function scanProgressByBookId(
  ddbDoc: import("@aws-sdk/lib-dynamodb").DynamoDBDocumentClient,
  ScanCommand: typeof import("@aws-sdk/lib-dynamodb").ScanCommand,
  tableName: string
): Promise<Map<string, Set<string>>> {
  const usersByBook = new Map<string, Set<string>>();
  let lastKey: Record<string, unknown> | undefined;
  do {
    const out = await ddbDoc.send(
      new ScanCommand({
        TableName: tableName,
        FilterExpression: "#entity = :progress",
        ExpressionAttributeNames: { "#entity": "entity" },
        ExpressionAttributeValues: { ":progress": "BOOK_PROGRESS" },
        ProjectionExpression: "PK, SK, bookId, userId",
        ExclusiveStartKey: lastKey,
      })
    );
    for (const item of out.Items ?? []) {
      const sk = typeof item.SK === "string" ? item.SK : "";
      const pk = typeof item.PK === "string" ? item.PK : "";
      const bookId =
        (typeof item.bookId === "string" && item.bookId) ||
        (sk.startsWith("PROGRESS#") ? sk.slice("PROGRESS#".length) : "");
      const userId =
        (typeof item.userId === "string" && item.userId) ||
        (pk.startsWith("BOOKUSER#") ? pk.slice("BOOKUSER#".length) : "");
      if (!bookId) continue;
      const set = usersByBook.get(bookId) ?? new Set<string>();
      if (userId) set.add(userId);
      usersByBook.set(bookId, set);
    }
    lastKey = out.LastEvaluatedKey;
  } while (lastKey);
  return usersByBook;
}

async function main() {
  const args = parseArgs(process.argv);
  const restore = installServerOnlyShim();
  const { ddbDoc } = await import("@/app/app/api/_lib/aws");
  const { ScanCommand } = await import("@aws-sdk/lib-dynamodb");
  const { listPublishedCatalogItems, getCatalogBook, upsertBookMetaAndCatalog } =
    await import("@/app/app/api/book/_lib/repo");
  restore();

  const mode = args.apply ? "APPLY" : "DRY RUN";
  console.log(`=== ChapterFlow prod catalog reconcile (${mode}) ===\n`);

  const curatedBookIds = new Set(BOOK_PACKAGES.map((pkg) => pkg.book.bookId));
  const records: CatalogRecordLike[] = await listPublishedCatalogItems(args.tableName);
  const published = records.filter((r) => r.status === "PUBLISHED");
  const counts = {
    total: records.length,
    published: published.length,
    draft: records.filter((r) => r.status === "DRAFT").length,
    archived: records.filter((r) => r.status === "ARCHIVED").length,
  };
  console.log(
    `Catalog records: ${counts.total} (${counts.published} PUBLISHED, ` +
      `${counts.draft} DRAFT, ${counts.archived} ARCHIVED)`
  );
  console.log(`Curated allowlist: ${curatedBookIds.size} books\n`);

  // Reader-progress safety scan (counts preserved by ARCHIVE, never lost).
  let usersByBook = new Map<string, Set<string>>();
  if (args.skipProgressScan) {
    console.log("Reader-progress scan: SKIPPED (--skip-progress-scan)\n");
  } else {
    console.log("Reader-progress scan: full-table scan in progress…");
    usersByBook = await scanProgressByBookId(ddbDoc, ScanCommand, args.tableName);
    console.log(
      `Reader-progress scan: done (${usersByBook.size} book(s) have progress records)\n`
    );
  }
  const progressCount = (bookId: string): number => usersByBook.get(bookId)?.size ?? 0;

  // 1) Orphan dup-sets (the confirmed PROD-DUP records) → ARCHIVE.
  const orphanRecords = published.filter((r) => isOrphanBookSlug(r.bookId));
  // 2) Curated, published → KEEP.
  const keepRecords = published.filter(
    (r) => curatedBookIds.has(r.bookId) && !isOrphanBookSlug(r.bookId)
  );
  // 3) Non-curated, non-orphan, published → flag (7A/PAR-1 launch-set decision).
  const nonCuratedRecords = published.filter(
    (r) => !curatedBookIds.has(r.bookId) && !isOrphanBookSlug(r.bookId)
  );

  console.log(`KEEP (curated, published): ${keepRecords.length}`);
  for (const r of [...keepRecords].sort((a, b) => a.bookId.localeCompare(b.bookId))) {
    console.log(`  · ${r.bookId} (v${r.currentPublishedVersion ?? "?"})`);
  }
  console.log("");

  console.log(`ARCHIVE — orphan dup-sets (PROD-DUP): ${orphanRecords.length}`);
  for (const r of orphanRecords) {
    const canonical = resolveCanonicalBookSlug(r.bookId);
    console.log(
      `  · ${r.bookId} (v${r.currentPublishedVersion ?? "?"}, ${r.status}) → canonical ${canonical}\n` +
        `      redirect: /book/library/${r.bookId} → /book/library/${canonical}\n` +
        `      reader progress: ${progressCount(r.bookId)} user(s) [preserved by ARCHIVE]`
    );
  }
  // Orphan slugs in the alias map that are NOT currently live (already gone).
  const liveOrphanIds = new Set(orphanRecords.map((r) => r.bookId));
  const absentOrphans = ORPHAN_BOOK_SLUGS.filter((s) => !liveOrphanIds.has(s));
  if (absentOrphans.length > 0) {
    console.log(`  (already absent / not published: ${absentOrphans.join(", ")})`);
  }
  console.log("");

  // 4) Integrity check: any same-title sibling records (known or future forks).
  const dupGroups = findDuplicateTitleGroups(published);
  console.log(`Integrity check — duplicate title groups: ${dupGroups.length}`);
  for (const g of dupGroups) {
    console.log(
      `  · "${g.title}": keep ${g.canonicalBookId}; orphan(s) ${g.orphanBookIds.join(", ")}` +
        (g.divergentFields.length ? ` | divergent: ${g.divergentFields.join(", ")}` : "")
    );
  }
  console.log("");

  console.log(
    `Non-curated published (not in launch set; sequence with 7A/PAR-1): ${nonCuratedRecords.length}` +
      (args.includeNonCurated ? " [WILL ARCHIVE: --include-non-curated]" : " [report only]")
  );
  for (const r of [...nonCuratedRecords].sort((a, b) => a.bookId.localeCompare(b.bookId))) {
    console.log(
      `  · ${r.bookId} (v${r.currentPublishedVersion ?? "?"}) | reader progress: ${progressCount(r.bookId)} user(s)`
    );
  }
  console.log("");

  const toArchive = [...orphanRecords, ...(args.includeNonCurated ? nonCuratedRecords : [])];

  if (!args.apply) {
    console.log(
      `Summary (DRY RUN): would archive ${toArchive.length} record(s) ` +
        `(${orphanRecords.length} orphan${args.includeNonCurated ? ` + ${nonCuratedRecords.length} non-curated` : ""}); ` +
        `keep ${keepRecords.length}; ${dupGroups.length} duplicate group(s) flagged.`
    );
    console.log("Re-run with `--apply --yes` to execute. Nothing was changed.");
    return;
  }

  console.log(`Applying: archiving ${toArchive.length} record(s)…`);
  let archived = 0;
  for (const r of toArchive) {
    const current = await getCatalogBook(args.tableName, r.bookId);
    if (!current || current.status !== "PUBLISHED") {
      console.log(`  · skip ${r.bookId}: no longer PUBLISHED`);
      continue;
    }
    await upsertBookMetaAndCatalog(args.tableName, {
      bookId: current.bookId,
      title: current.title,
      author: current.author,
      categories: current.categories,
      tags: current.tags,
      cover: current.cover,
      variantFamily: current.variantFamily,
      latestVersion: current.latestVersion,
      currentPublishedVersion: current.currentPublishedVersion,
      status: "ARCHIVED",
    });
    archived += 1;
    console.log(`  · archived ${r.bookId} ✓`);
  }
  console.log(`\nSummary (APPLY): archived ${archived}/${toArchive.length}; kept ${keepRecords.length}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
