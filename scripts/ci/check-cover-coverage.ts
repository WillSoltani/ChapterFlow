#!/usr/bin/env tsx
/**
 * Cover-coverage smoke check.
 *
 * Every book in the published library catalog (BOOK_PACKAGES, surfaced via
 * getBookPackagePresentation().coverImage) references a cover raster under
 * public/book-covers/. The prod seed step (scripts/book/publish-library-assets.ts)
 * tolerates a missing raster — it drops the coverAssetKey and the app shows a
 * placeholder — so a missing cover never hard-fails a deploy. This check exists
 * to make that gap VISIBLE: it lists every catalog book whose cover file is not
 * on disk, so missing art is caught in CI/review instead of silently shipping a
 * placeholder.
 *
 * Exit 1 if any catalog cover is missing (default), or 0 with `--warn-only`.
 *
 * Usage:
 *   npx tsx scripts/ci/check-cover-coverage.ts [--warn-only]
 */

import { existsSync } from "node:fs";
import path from "node:path";
import { BOOK_PACKAGES, getBookPackagePresentation } from "@/app/book/data/bookPackages";

const COVERS_DIR = path.join(process.cwd(), "public", "book-covers");

/** Strip a leading slash and an optional `book-covers/` prefix to a bare filename. */
function coverFilename(coverImage?: string): string | null {
  if (!coverImage) return null;
  const trimmed = coverImage.replace(/^\/+/, "").replace(/^book-covers\//, "");
  return trimmed.length > 0 ? trimmed : null;
}

function main() {
  const warnOnly = process.argv.includes("--warn-only");

  const missing: Array<{ bookId: string; filename: string }> = [];
  let withCover = 0;
  let noCoverRef = 0;

  for (const pkg of BOOK_PACKAGES) {
    const bookId = pkg.book.bookId;
    const presentation = getBookPackagePresentation(bookId);
    const filename = coverFilename(presentation.coverImage);
    if (!filename) {
      noCoverRef += 1;
      continue;
    }
    if (existsSync(path.join(COVERS_DIR, filename))) {
      withCover += 1;
    } else {
      missing.push({ bookId, filename });
    }
  }

  const total = BOOK_PACKAGES.length;
  console.log(
    `Cover coverage: ${withCover}/${total} catalog books have a cover on disk` +
      (noCoverRef > 0 ? ` (${noCoverRef} reference no cover)` : "")
  );

  if (missing.length === 0) {
    console.log("✓ every catalog cover referenced is present in public/book-covers/");
    return;
  }

  console.log(`\n${missing.length} catalog book(s) reference a cover that is MISSING on disk:`);
  for (const m of missing) {
    console.log(`  ✗ ${m.bookId} → public/book-covers/${m.filename}`);
  }

  if (warnOnly) {
    console.log("\n(--warn-only) Not failing. Add the rasters above to public/book-covers/.");
    return;
  }
  console.error(
    `\n::error::${missing.length} catalog cover(s) missing. Add the rasters to public/book-covers/ ` +
      `(the deploy seed will skip them and show a placeholder until then), or run with --warn-only.`
  );
  process.exit(1);
}

main();
