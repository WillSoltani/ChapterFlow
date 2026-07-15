#!/usr/bin/env tsx
/**
 * Register committed book packages into the API catalog (DynamoDB + S3), so
 * books published to the WEB bundle become visible to the API surface the
 * native iOS app consumes.
 *
 * Why this exists: the web app reads the BUNDLE catalog
 * (app/book/data/booksCatalog.metadata.json + bookPackages.ts), but the API
 * routes (`GET /book/books`, detail, chapters, quizzes) serve from DynamoDB
 * ingest registrations + per-version S3 artifacts. Books published bundle-only
 * (every v21-pipeline publish since 2026-06-25) are therefore invisible to the
 * API. This driver runs the EXACT production ingestion path —
 * `ingestBookPackageFromS3` (validation, category taxonomy gate, slug-alias
 * publish guard, versioned artifacts, idempotency by packageId, publish) — for
 * each target package, then rebuilds the search index and refreshes the
 * presentation index, exactly like the admin ingest+publish flow would.
 *
 * Usage (from the repo root, with an AWS profile that can write the book
 * table + content/ingest buckets):
 *
 *   AWS_PROFILE=chapterflow AWS_REGION=us-east-1 \
 *   BOOK_TABLE_NAME=... BOOK_CONTENT_BUCKET=... BOOK_INGEST_BUCKET=... \
 *     npx tsx scripts/book/register-api-books.ts --dry-run <slug> [<slug>…]
 *     npx tsx scripts/book/register-api-books.ts <slug> [<slug>…]
 *     npx tsx scripts/book/register-api-books.ts --targets-file targets.txt
 *
 * --dry-run validates every package (schema, categories, slug guard) and
 * reports what would happen, without touching AWS.
 *
 * Idempotent: identical re-runs reuse the existing version (packageId match)
 * rather than allocating duplicates; the presentation index merge is additive
 * by bookId; cover uploads skip existing objects.
 */
import { createRequire } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);

// The app libs import "server-only", which throws outside a server component
// context. Shim it exactly like scripts/book/check-catalog-state.ts does.
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

type Result = {
  bookId: string;
  ok: boolean;
  version?: number;
  detail: string;
};

async function main() {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes("--dry-run");
  const fileFlag = argv.indexOf("--targets-file");
  let targets: string[];
  if (fileFlag >= 0) {
    targets = readFileSync(argv[fileFlag + 1], "utf-8")
      .split(/\s+/)
      .filter(Boolean);
  } else {
    targets = argv.filter((a) => !a.startsWith("--"));
  }
  if (targets.length === 0) {
    console.error("No targets. Pass slugs or --targets-file <file>.");
    process.exit(1);
  }

  for (const name of ["BOOK_TABLE_NAME", "BOOK_CONTENT_BUCKET", "BOOK_INGEST_BUCKET"]) {
    if (!dryRun && !process.env[name]) {
      console.error(`Missing env ${name}.`);
      process.exit(1);
    }
  }

  const restore = installServerOnlyShim();
  const { validateBookPackage } = await import("@/app/app/api/book/_lib/validate-book-package");
  const { enforceCanonicalCategories, CategoryTaxonomyError } = await import(
    "@/lib/category-taxonomy"
  );
  const { evaluatePublishGuard } = await import("@/lib/book-slug-aliases");
  const { ingestBookPackageFromS3 } = await import("@/app/app/api/book/_lib/ingestion");
  const { getCatalogBook } = await import("@/app/app/api/book/_lib/repo");
  const { rebuildSearchIndex } = await import(
    "@/app/app/api/book/admin/books/[bookId]/versions/[version]/publish/search-index-builder"
  );
  const { readJsonFromS3, writeJsonToS3 } = await import(
    "@/app/app/api/book/_lib/storage"
  );
  const { s3 } = await import("@/app/app/api/_lib/aws");
  const { PutObjectCommand, HeadObjectCommand } = await import("@aws-sdk/client-s3");
  restore();

  const tableName = process.env.BOOK_TABLE_NAME ?? "";
  const contentBucket = process.env.BOOK_CONTENT_BUCKET ?? "";
  const ingestBucket = process.env.BOOK_INGEST_BUCKET ?? "";
  const results: Result[] = [];

  // ── Phase 1: per-book validation (+ registration unless --dry-run) ────────
  for (const slug of targets) {
    const pkgPath = path.join(process.cwd(), "book-packages", `${slug}.v21.json`);
    if (!existsSync(pkgPath)) {
      results.push({ bookId: slug, ok: false, detail: "package file not found" });
      continue;
    }
    const rawText = readFileSync(pkgPath, "utf-8");

    // Pre-flight the same gates ingestBookPackageFromS3 enforces, so a dry run
    // reports every rejection the real run would hit.
    try {
      const pkg = validateBookPackage(JSON.parse(rawText));
      if (!/^[a-z0-9._-]+$/.test(pkg.book.bookId)) {
        throw new Error("bookId fails slug charset");
      }
      if (pkg.book.bookId !== slug) {
        throw new Error(`package bookId "${pkg.book.bookId}" ≠ file slug "${slug}"`);
      }
      enforceCanonicalCategories([...pkg.book.categories]);
      const guard = evaluatePublishGuard(pkg.book.bookId);
      if (guard.action === "reject") {
        throw new Error(`publish guard: ${guard.code} — ${guard.message}`);
      }
      if (dryRun) {
        results.push({
          bookId: slug,
          ok: true,
          detail: `VALID (${pkg.chapters.length} chapters, packageId ${pkg.packageId ?? "none"})`,
        });
        continue;
      }
    } catch (error: unknown) {
      const message =
        error && typeof error === "object" && "issues" in (error as Record<string, unknown>)
          ? JSON.stringify((error as { issues: unknown }).issues).slice(0, 400)
          : error instanceof Error
            ? error.message
            : String(error);
      results.push({ bookId: slug, ok: false, detail: `validation: ${message}` });
      continue;
    }

    // Real run: stage the package in the ingest bucket, then run the
    // production ingestion (validates again server-side, writes versioned
    // artifacts + DDB rows, publishes).
    try {
      const ingestKey = `manual-registration/${slug}.v21.json`;
      await s3.send(
        new PutObjectCommand({
          Bucket: ingestBucket,
          Key: ingestKey,
          Body: rawText,
          ContentType: "application/json",
        }),
      );
      const outcome = await ingestBookPackageFromS3({
        tableName,
        ingestBucket,
        contentBucket,
        ingestKey,
        createdBy: "register-api-books-cli",
        publishNow: true,
      });
      const catalogRow = await getCatalogBook(tableName, slug);
      const published = catalogRow?.status === "PUBLISHED" && !!catalogRow.currentPublishedVersion;
      results.push({
        bookId: slug,
        ok: published,
        version: outcome.version,
        detail: published
          ? `PUBLISHED v${outcome.version} (${outcome.contentPrefix})`
          : `ingested v${outcome.version} but catalog row is ${catalogRow?.status ?? "MISSING"}`,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({ bookId: slug, ok: false, detail: `ingest: ${message}` });
    }
  }

  // ── Report per-book outcomes ───────────────────────────────────────────────
  console.log(`\n${dryRun ? "DRY RUN" : "REGISTRATION"} RESULTS`);
  for (const r of results) {
    console.log(`  ${r.ok ? "✓" : "✗"} ${r.bookId} — ${r.detail}`);
  }
  const succeeded = results.filter((r) => r.ok).map((r) => r.bookId);
  const failed = results.filter((r) => !r.ok);

  if (dryRun) {
    console.log(`\nDry run: ${succeeded.length} valid, ${failed.length} rejected.`);
    process.exit(failed.length > 0 ? 2 : 0);
  }

  if (succeeded.length === 0) {
    console.error("\nNothing registered; skipping index rebuilds.");
    process.exit(2);
  }

  // ── Phase 2: cover assets (best-effort) ───────────────────────────────────
  // The API presentation layer serves cover art from
  // book-content/library/covers/<slug>.webp; the web bundle keeps the same art
  // in public/book-covers/. Upload any missing covers so newly registered
  // books get real art instead of the emoji fallback.
  let coversUploaded = 0;
  for (const slug of succeeded) {
    const local = path.join(process.cwd(), "public", "book-covers", `${slug}.webp`);
    if (!existsSync(local)) continue;
    const key = `book-content/library/covers/${slug}.webp`;
    try {
      await s3.send(new HeadObjectCommand({ Bucket: contentBucket, Key: key }));
      continue; // already present
    } catch {
      /* absent → upload */
    }
    try {
      await s3.send(
        new PutObjectCommand({
          Bucket: contentBucket,
          Key: key,
          Body: readFileSync(local),
          ContentType: "image/webp",
          CacheControl: "public, max-age=31536000, immutable",
        }),
      );
      coversUploaded += 1;
    } catch (error: unknown) {
      console.warn(`  ⚠ cover upload failed for ${slug}:`, (error as Error).message);
    }
  }
  console.log(`\nCovers uploaded: ${coversUploaded}`);

  // ── Phase 3: presentation index (best-effort decoration) ─────────────────
  // book-content/library/catalog.json feeds icon/synopsis/difficulty/cover in
  // API catalog responses. Merge entries for the registered books from the
  // bundle metadata; existing entries are preserved untouched.
  try {
    const metadataRows = JSON.parse(
      readFileSync(path.join(process.cwd(), "app", "book", "data", "booksCatalog.metadata.json"), "utf-8"),
    ) as Array<Record<string, unknown>>;
    const byId = new Map(metadataRows.map((row) => [String(row.id), row]));
    const indexKey = "book-content/library/catalog.json";
    const index = await readJsonFromS3<{
      schemaVersion: string;
      generatedAt: string;
      books: Array<Record<string, unknown>>;
    }>(contentBucket, indexKey);
    const have = new Set(index.books.map((b) => String(b.bookId)));
    let added = 0;
    for (const slug of succeeded) {
      if (have.has(slug)) continue;
      const meta = byId.get(slug);
      if (!meta) continue;
      const coverKey = `book-content/library/covers/${slug}.webp`;
      let hasCover = false;
      try {
        await s3.send(new HeadObjectCommand({ Bucket: contentBucket, Key: coverKey }));
        hasCover = true;
      } catch {
        /* no cover asset */
      }
      index.books.push({
        bookId: slug,
        icon: meta.icon,
        difficulty: meta.difficulty,
        synopsis: meta.synopsis,
        estimatedMinutes: meta.estimatedMinutes,
        chapterCount: meta.chapterCount,
        ...(hasCover ? { coverAssetKey: coverKey } : {}),
      });
      added += 1;
    }
    if (added > 0) {
      index.generatedAt = new Date().toISOString();
      await writeJsonToS3(contentBucket, indexKey, index);
    }
    console.log(`Presentation index: +${added} entries (total ${index.books.length}).`);
  } catch (error: unknown) {
    console.warn("⚠ presentation-index refresh failed (non-fatal):", (error as Error).message);
  }

  // ── Phase 4: search index (same rebuild the admin publish route runs) ────
  try {
    const search = await rebuildSearchIndex();
    console.log(`Search index rebuilt: ${search.documentCount} documents.`);
  } catch (error: unknown) {
    console.error("✗ search-index rebuild FAILED (books are published; index is stale):",
      (error as Error).message);
  }

  console.log(
    `\nDone: ${succeeded.length} registered, ${failed.length} failed.` +
      (failed.length ? " Failed books remain web-only; fix and re-run (idempotent)." : ""),
  );
  process.exit(failed.length > 0 ? 2 : 0);
}

main().catch((err) => {
  console.error(err instanceof Error ? (err.stack ?? err.message) : String(err));
  process.exit(1);
});
