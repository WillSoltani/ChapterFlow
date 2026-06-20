#!/usr/bin/env tsx
/**
 * Upload the authored book packages to S3 so the server can read them at runtime
 * instead of bundling all ~37.6 MB into the OpenNext ServerFn (which exceeded
 * Lambda's 250 MiB unzipped limit and broke deploys).
 *
 * Each book-packages/<id>.v21.json is uploaded to
 *   s3://$BOOK_CONTENT_BUCKET/book-content/packages/<bookId>.v21.json
 * keyed by the package's own book.bookId — exactly where book-package-source.ts
 * (getServerBookPackage) fetches it. Idempotent: overwrites on every run, so it
 * stays in sync with the committed packages. MUST run before/with a deploy of the
 * new server code (else quiz falls back to S3 content and ask/audio 404).
 *
 * Usage:
 *   BOOK_CONTENT_BUCKET=... AWS_REGION=us-east-1 \
 *     npx tsx scripts/book/upload-book-packages-to-s3.ts            # upload all
 *     npx tsx scripts/book/upload-book-packages-to-s3.ts --dry-run  # list only
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const DRY_RUN = process.argv.includes("--dry-run");
const bucket = process.env.BOOK_CONTENT_BUCKET;
const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1";
if (!bucket) {
  console.error("Missing BOOK_CONTENT_BUCKET. Set it in env (and AWS credentials).");
  process.exit(1);
}

const packagesDir = path.join(process.cwd(), "book-packages");
const files = readdirSync(packagesDir).filter((f) => f.endsWith(".v21.json")).sort();
const s3 = new S3Client({ region });

function bookIdOf(raw: unknown, file: string): string {
  const id =
    raw && typeof raw === "object"
      ? (raw as { book?: { bookId?: unknown } }).book?.bookId
      : undefined;
  if (typeof id === "string" && id.trim()) return id.trim();
  return path.basename(file, ".v21.json"); // fallback: filename basename
}

async function main() {
  // Dedupe by bookId: a duplicate/orphan slug file (e.g. Getting-Things-Done.v21.json)
  // and its canonical (getting-things-done.v21.json) both resolve to the same bookId
  // and S3 key. Prefer the file whose basename === bookId (the canonical), so a stale
  // orphan never overwrites the canonical package.
  const byBookId = new Map<string, { file: string; body: string }>();
  for (const file of files) {
    const body = readFileSync(path.join(packagesDir, file), "utf-8");
    let raw: unknown;
    try {
      raw = JSON.parse(body);
    } catch {
      console.error(`  ✗ skip ${file}: invalid JSON`);
      continue;
    }
    const bookId = bookIdOf(raw, file);
    const existing = byBookId.get(bookId);
    const isCanonicalName = path.basename(file, ".v21.json") === bookId;
    if (!existing || isCanonicalName) byBookId.set(bookId, { file, body });
  }
  const entries = [...byBookId.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  console.log(
    `=== Upload book packages to S3 (${DRY_RUN ? "DRY RUN" : "APPLY"}) ===\n` +
      `bucket: ${bucket}\nfiles: ${files.length}, unique bookIds: ${entries.length}\n`,
  );
  let uploaded = 0;
  for (const [bookId, { file, body }] of entries) {
    const key = `book-content/packages/${bookId}.v21.json`;
    if (DRY_RUN) {
      console.log(`  · would upload ${file} → s3://${bucket}/${key} (${(body.length / 1024).toFixed(0)} KB)`);
      continue;
    }
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: "application/json",
        CacheControl: "no-cache",
      }),
    );
    uploaded += 1;
    console.log(`  ✓ ${bookId}`);
  }
  console.log(`\nSummary: ${DRY_RUN ? `would upload ${files.length}` : `uploaded ${uploaded}/${files.length}`}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
