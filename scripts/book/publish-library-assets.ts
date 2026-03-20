#!/usr/bin/env tsx

import fs from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import {
  BOOK_PACKAGES,
  getBookPackagePresentation,
} from "@/app/book/data/bookPackages";

const REGION =
  process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1";
const DEFAULT_PREFIX = "book-content/library";
const CONTENT_TYPES: Record<string, string> = {
  ".avif": "image/avif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

type Args = {
  bucket: string;
  prefix: string;
  dryRun: boolean;
};

type LibraryCatalogIndexBook = {
  bookId: string;
  icon: string;
  difficulty: "Easy" | "Medium" | "Hard";
  synopsis: string;
  pages?: number;
  estimatedMinutes: number;
  chapterCount: number;
  coverAssetKey?: string;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    bucket: process.env.BOOK_CONTENT_BUCKET || "",
    prefix: DEFAULT_PREFIX,
    dryRun: false,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const value = argv[index];
    const next = argv[index + 1];
    if (value === "--bucket" && next) {
      args.bucket = next;
      index += 1;
      continue;
    }
    if (value === "--prefix" && next) {
      args.prefix = next.replace(/^\/+|\/+$/g, "");
      index += 1;
      continue;
    }
    if (value === "--dry-run") {
      args.dryRun = true;
    }
  }

  if (!args.bucket) {
    throw new Error("Missing BOOK_CONTENT_BUCKET. Pass --bucket or set BOOK_CONTENT_BUCKET.");
  }

  return args;
}

function contentTypeFor(filename: string): string {
  const extension = path.extname(filename).toLowerCase();
  return CONTENT_TYPES[extension] || "application/octet-stream";
}

function resolveCoverFilename(coverImage?: string): string | null {
  if (!coverImage) return null;
  const trimmed = coverImage.replace(/^\/+/, "");
  if (!trimmed.startsWith("book-covers/")) return null;
  return trimmed.slice("book-covers/".length);
}

function buildCatalog(prefix: string): LibraryCatalogIndexBook[] {
  return [...BOOK_PACKAGES]
    .sort((left, right) => left.book.title.localeCompare(right.book.title))
    .map((pkg) => {
      const presentation = getBookPackagePresentation(pkg.book.bookId);
      const coverFilename = resolveCoverFilename(presentation.coverImage);
      return {
        bookId: pkg.book.bookId,
        icon: presentation.icon,
        difficulty: presentation.difficulty,
        synopsis: presentation.synopsis,
        pages: presentation.pages,
        estimatedMinutes: pkg.chapters.reduce(
          (sum, chapter) => sum + Math.max(chapter.readingTimeMinutes, 1),
          0
        ),
        chapterCount: pkg.chapters.length,
        coverAssetKey: coverFilename ? `${prefix}/covers/${coverFilename}` : undefined,
      };
    });
}

async function putObject(params: {
  s3: S3Client;
  bucket: string;
  key: string;
  body: string | Buffer;
  cacheControl: string;
}) {
  await params.s3.send(
    new PutObjectCommand({
      Bucket: params.bucket,
      Key: params.key,
      Body: params.body,
      ContentType: contentTypeFor(params.key),
      CacheControl: params.cacheControl,
    })
  );
}

async function main() {
  const args = parseArgs(process.argv);
  const s3 = new S3Client({ region: REGION });
  const root = process.cwd();
  const coversDir = path.join(root, "public", "book-covers");
  const catalog = buildCatalog(args.prefix);
  const usedCoverFiles = new Set(
    catalog
      .map((item) => item.coverAssetKey?.split("/").at(-1) || null)
      .filter((item): item is string => Boolean(item))
  );

  const catalogBody = JSON.stringify(
    {
      schemaVersion: "2026-03-19.library-catalog.v1",
      generatedAt: new Date().toISOString(),
      books: catalog,
    },
    null,
    2
  );

  console.log(`Preparing ${catalog.length} catalog entries for s3://${args.bucket}/${args.prefix}`);

  if (args.dryRun) {
    console.log("Dry run enabled. No objects will be uploaded.");
    return;
  }

  for (const filename of usedCoverFiles) {
    const absolutePath = path.join(coversDir, filename);
    const body = await fs.readFile(absolutePath);
    const key = `${args.prefix}/covers/${filename}`;
    await putObject({
      s3,
      bucket: args.bucket,
      key,
      body,
      cacheControl: "public, max-age=31536000, immutable",
    });
    console.log(`Uploaded ${key}`);
  }

  await putObject({
    s3,
    bucket: args.bucket,
    key: `${args.prefix}/catalog.json`,
    body: catalogBody,
    cacheControl: "public, max-age=300",
  });

  console.log(`Uploaded ${args.prefix}/catalog.json`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
