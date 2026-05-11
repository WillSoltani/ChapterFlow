#!/usr/bin/env tsx

/**
 * Publish a single book package to the production catalog. Mirrors
 * publish-bundled-packages.ts but takes one --file path and always force-
 * publishes (so the version is bumped even if the bookId is already in the
 * catalog). Used to roll the v21 rewrite of a book that previously shipped
 * as v13 (.modern.json).
 *
 * Reads the same env as publish-bundled-packages.ts:
 *   BOOK_TABLE_NAME, BOOK_INGEST_BUCKET, BOOK_CONTENT_BUCKET, AWS_REGION
 *
 *   npx tsx scripts/book/publish-single-package.ts \
 *     --file book-packages/how-to-win-friends-and-influence-people.v21.json
 */

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
    isMain: boolean,
  ) {
    if (request === "server-only") return {};
    return originalLoad.call(this, request, parent, isMain);
  };
  return () => {
    Module._load = originalLoad;
  };
}

type Args = {
  file: string;
  tableName: string;
  ingestBucket: string;
  contentBucket: string;
  createdBy: string;
  force: boolean;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    file: "",
    tableName: process.env.BOOK_TABLE_NAME || "",
    ingestBucket: process.env.BOOK_INGEST_BUCKET || "",
    contentBucket: process.env.BOOK_CONTENT_BUCKET || "",
    createdBy: process.env.BOOK_INGEST_CREATED_BY || "publish:single",
    force: false,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const v = argv[i];
    const next = argv[i + 1];
    if (v === "--file" && next) {
      args.file = next;
      i += 1;
      continue;
    }
    if (v === "--created-by" && next) {
      args.createdBy = next;
      i += 1;
      continue;
    }
    if (v === "--force") {
      args.force = true;
    }
  }
  if (!args.file) throw new Error("--file <book-package.json> required");
  if (!args.tableName || !args.ingestBucket || !args.contentBucket) {
    throw new Error(
      "Missing BOOK_TABLE_NAME, BOOK_INGEST_BUCKET, or BOOK_CONTENT_BUCKET in env.",
    );
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  const s3 = new S3Client({ region: REGION });
  const restoreServerOnly = installServerOnlyShim();
  const { ingestBookPackageFromS3 } = await import("@/app/app/api/book/_lib/ingestion");
  restoreServerOnly();

  const absolutePath = path.resolve(process.cwd(), args.file);
  const raw = await fs.readFile(absolutePath, "utf8");
  const parsed = JSON.parse(raw) as { book?: { bookId?: string } };
  const bookId = parsed?.book?.bookId;
  if (!bookId) throw new Error(`Missing book.bookId in ${args.file}`);

  // Reject non-kebab-case bookIds. Multiple v13 packages carried bookIds with
  // accidental mixed-case (e.g. "Getting-Things-Done"); ingesting those creates
  // a separate DDB catalog row from the existing lowercase entry, leaving the
  // book unreachable in the library. Fail fast so the operator fixes it before
  // the network round trip and S3 write.
  const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  if (!KEBAB_CASE.test(bookId)) {
    throw new Error(
      `book.bookId "${bookId}" is not kebab-case (lowercase, hyphenated).\n` +
      `  Fix the bookId field inside ${args.file} AND rename the file to match before re-running.\n` +
      `  Expected pattern: ${KEBAB_CASE.source}\n` +
      `  Example: getting-things-done, atomic-habits, the-power-of-habit.`,
    );
  }
  const fileBasename = path.basename(args.file).replace(/\.v21\.json$/, "");
  if (fileBasename !== bookId) {
    throw new Error(
      `File name "${path.basename(args.file)}" does not match book.bookId "${bookId}".\n` +
      `  Rename the file to "${bookId}.v21.json" before publishing, otherwise the catalog row and S3 path will drift.`,
    );
  }

  // bookId-uniqueness check. The DDB catalog allows different bookIds to
  // coexist as separate rows, which means publishing "you-cant-hurt-me"
  // when "you-can't-hurt-me" already exists creates a duplicate library
  // entry instead of updating the canonical one. Detect by normalizing
  // every existing bookId (strip apostrophes/dashes/dots, lowercase) and
  // comparing — if the normalized form matches an existing row that has
  // a DIFFERENT exact bookId, fail unless --force is passed.
  if (!args.force) {
    const restoreShim2 = installServerOnlyShim();
    const repo = await import("@/app/app/api/book/_lib/repo");
    restoreShim2();
    const items = await repo.listPublishedCatalogItems(args.tableName);
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    const target = norm(bookId);
    const collisions = items.filter((it: any) => it.bookId !== bookId && norm(it.bookId) === target);
    if (collisions.length > 0) {
      const list = collisions.map((c: any) => `    - "${c.bookId}" (v${c.currentPublishedVersion ?? "?"} ${c.status})`).join("\n");
      throw new Error(
        `bookId "${bookId}" collides with existing catalog row(s) under different exact ids:\n${list}\n` +
        `  Publishing would create a duplicate library entry. Two options:\n` +
        `  1. Rename your file + book.bookId field to the existing canonical id, then re-publish.\n` +
        `  2. Run again with --force ONLY if you've already archived/cleaned the colliding rows.\n` +
        `  Caught: Can't Hurt Me migrated to "you-cant-hurt-me" while the existing catalog row was "you-can't-hurt-me", creating a duplicate.`,
      );
    }
  }

  const ingestKey = `${INGEST_PREFIX}/${bookId}/${Date.now()}-${path.basename(args.file)}`;
  console.log(`1) Uploading ${args.file} to s3://${args.ingestBucket}/${ingestKey}`);
  await s3.send(
    new PutObjectCommand({
      Bucket: args.ingestBucket,
      Key: ingestKey,
      Body: raw,
      ContentType: "application/json; charset=utf-8",
      CacheControl: "no-store",
    }),
  );
  console.log(`2) Ingesting (publishNow=true) ...`);
  const result = await ingestBookPackageFromS3({
    tableName: args.tableName,
    ingestBucket: args.ingestBucket,
    contentBucket: args.contentBucket,
    ingestKey,
    createdBy: args.createdBy,
    publishNow: true,
  });
  console.log(`✓ Published ${bookId} v${result.version}`);
}

main().catch((err: unknown) => {
  console.error("✗ Publish failed:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
