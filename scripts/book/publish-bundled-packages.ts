#!/usr/bin/env tsx

import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

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

  const existing = await listPublishedCatalogItems(args.tableName);
  const publishedBookIds = new Set(
    existing
      .filter((item) => item.status === "PUBLISHED" && item.currentPublishedVersion)
      .map((item) => item.bookId)
  );

  let publishedCount = 0;
  let skippedCount = 0;

  for (const filename of files) {
    const absolutePath = path.join(packagesDir, filename);
    const raw = await fs.readFile(absolutePath, "utf8");
    const parsed = JSON.parse(raw) as {
      book?: { bookId?: string };
      chapters?: unknown[];
    };
    const bookId = parsed?.book?.bookId;
    if (!bookId) {
      console.warn(`Skipping ${filename}: missing book.bookId`);
      continue;
    }

    if (!args.force && publishedBookIds.has(bookId)) {
      skippedCount += 1;
      console.log(`Skipping ${bookId}: already published`);
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
    `Bundled package publish complete. Published: ${publishedCount}. Skipped: ${skippedCount}.`
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
