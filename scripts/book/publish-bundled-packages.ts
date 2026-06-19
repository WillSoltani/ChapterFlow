#!/usr/bin/env tsx

import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { BOOK_PACKAGES } from "@/app/book/data/bookPackages";

const REGION =
  process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1";
const INGEST_PREFIX = "book-ingest/bootstrap";
const require = createRequire(import.meta.url);

function installServerOnlyShim(): () => void {
  const Module = require("node:module") as {
    _load: (request: string, parent: unknown, isMain: boolean) => unknown;
  };
  const originalLoad = Module._load;
  Module._load = function patchedLoad(
    request: string,
    parent: unknown,
    isMain: boolean
  ) {
    if (request === "server-only") {
      return {};
    }
    return originalLoad.call(this, request, parent, isMain);
  };
  return () => {
    Module._load = originalLoad;
  };
}

type Args = {
  tableName: string;
  ingestBucket: string;
  contentBucket: string;
  createdBy: string;
  force: boolean;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    tableName: process.env.BOOK_TABLE_NAME || "",
    ingestBucket: process.env.BOOK_INGEST_BUCKET || "",
    contentBucket: process.env.BOOK_CONTENT_BUCKET || "",
    createdBy: process.env.BOOK_INGEST_CREATED_BY || "seed:bundled-packages",
    force: false,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const value = argv[index];
    const next = argv[index + 1];
    if (value === "--table" && next) {
      args.tableName = next;
      index += 1;
      continue;
    }
    if (value === "--ingest-bucket" && next) {
      args.ingestBucket = next;
      index += 1;
      continue;
    }
    if (value === "--content-bucket" && next) {
      args.contentBucket = next;
      index += 1;
      continue;
    }
    if (value === "--created-by" && next) {
      args.createdBy = next;
      index += 1;
      continue;
    }
    if (value === "--force") {
      args.force = true;
    }
  }

  if (!args.tableName || !args.ingestBucket || !args.contentBucket) {
    throw new Error(
      "Missing BOOK_TABLE_NAME, BOOK_INGEST_BUCKET, or BOOK_CONTENT_BUCKET."
    );
  }

  return args;
}

function isJsonFilename(value: string): boolean {
  return value.endsWith(".json");
}

async function main() {
  const args = parseArgs(process.argv);
  const s3 = new S3Client({ region: REGION });
  const restoreServerOnly = installServerOnlyShim();
  const [{ ingestBookPackageFromS3 }, { listPublishedCatalogItems }] = await Promise.all([
    import("@/app/app/api/book/_lib/ingestion"),
    import("@/app/app/api/book/_lib/repo"),
  ]);
  restoreServerOnly();
  const packagesDir = path.join(process.cwd(), "book-packages");
  const files = (await fs.readdir(packagesDir))
    .filter(isJsonFilename)
    .sort((left, right) => left.localeCompare(right));

  // Allowlist: the seed may publish ONLY books wired into the curated
  // presentation catalog (BOOK_PACKAGES — the same source publish-library-assets.ts
  // uses). On-disk packages that are NOT in the catalog have no cover, synopsis,
  // search entry, or reader fallback, so auto-publishing them leaks unreviewed
  // books to prod with no easy un-publish (PAR-1). Derived from BOOK_PACKAGES so
  // the publish set can never silently drift from what the app presents.
  const curatedBookIds = new Set(BOOK_PACKAGES.map((pkg) => pkg.book.bookId));
  console.log(
    `Curated allowlist: ${curatedBookIds.size} books (filtering ${files.length} on-disk packages).`
  );

  const existing = await listPublishedCatalogItems(args.tableName);
  const publishedBookIds = new Set(
    existing
      .filter((item) => item.status === "PUBLISHED" && item.currentPublishedVersion)
      .map((item) => item.bookId)
  );

  let publishedCount = 0;
  let skippedCount = 0;
  let notCuratedCount = 0;
  let contentLessCount = 0;

  for (const filename of files) {
    const absolutePath = path.join(packagesDir, filename);
    const raw = await fs.readFile(absolutePath, "utf8");
    const parsed = JSON.parse(raw) as {
      book?: { bookId?: string; chapters?: unknown[] };
      chapters?: unknown[];
    };
    const bookId = parsed?.book?.bookId;
    if (!bookId) {
      console.warn(`Skipping ${filename}: missing book.bookId`);
      continue;
    }

    if (!curatedBookIds.has(bookId)) {
      notCuratedCount += 1;
      console.log(`Skipping ${bookId}: not in curated catalog (allowlist)`);
      continue;
    }

    if (!args.force && publishedBookIds.has(bookId)) {
      skippedCount += 1;
      console.log(`Skipping ${bookId}: already published`);
      continue;
    }

    // Publish gate (DI-2): never publish a content-less catalog row. A package
    // with an empty `chapters` array passes validateBookPackage — it only checks
    // the field IS an array, not that it holds any items — so without this guard
    // ingestBookPackageFromS3({ publishNow: true }) would write a PUBLISHED
    // catalog row (later given a `type=book` search doc on the next index
    // rebuild) with ZERO chapter docs: a book that shows up in the catalog,
    // recommendations and search yet reads as empty/broken when opened. That was
    // the prod state DI-2 found for ~14 books. Require >=1 chapter before we
    // publish, mirroring validateBookPackage's top-level-or-book.chapters lookup.
    // Skip + warn (consistent with the per-book try/catch below) so one malformed
    // package can't publish a ghost row or abort the rest of the run.
    const chapterCount = Array.isArray(parsed?.chapters)
      ? parsed.chapters.length
      : Array.isArray(parsed?.book?.chapters)
        ? parsed.book.chapters.length
        : 0;
    if (chapterCount < 1) {
      contentLessCount += 1;
      console.warn(
        `Skipping ${bookId}: refusing to publish a content-less book (0 chapters)`
      );
      continue;
    }

    const ingestKey = `${INGEST_PREFIX}/${bookId}/${Date.now()}-${filename}`;
    try {
      await s3.send(
        new PutObjectCommand({
          Bucket: args.ingestBucket,
          Key: ingestKey,
          Body: raw,
          ContentType: "application/json; charset=utf-8",
          CacheControl: "no-store",
        })
      );

      const result = await ingestBookPackageFromS3({
        tableName: args.tableName,
        ingestBucket: args.ingestBucket,
        contentBucket: args.contentBucket,
        ingestKey,
        createdBy: args.createdBy,
        publishNow: true,
      });

      publishedCount += 1;
      console.log(`Published ${bookId} v${result.version}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`Skipping ${bookId}: ${message}`);
      skippedCount += 1;
    }
  }

  console.log(
    `Bundled package publish complete. Published: ${publishedCount}. ` +
      `Already-published skipped: ${skippedCount}. ` +
      `Not-curated skipped (allowlist): ${notCuratedCount}. ` +
      `Content-less skipped (no chapters): ${contentLessCount}.`
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
