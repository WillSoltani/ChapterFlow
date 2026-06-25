import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import {
  BOOK_PACKAGES,
  BOOK_PACKAGE_PRESENTATION,
  getBookPackagePresentation,
  getBookPackageByIdForTone,
} from "./bookPackages";

// Regression coverage for the "Getting-Things-Done" key-casing defect (H9).
//
// BOOK_PACKAGE_PRESENTATION and BOOK_PACKAGE_TONE_GETTERS are looked up by the
// canonical bookId, which is always kebab-case (`pkg.book.bookId`). A capitalized
// `"Getting-Things-Done"` key was therefore unreachable: the curated presentation
// silently fell back to the inferred boilerplate, and the curated entry embedded a
// 404 cover path (`getBookCoverPath("Getting-Things-Done")` -> /book-covers/Getting-Things-Done.webp,
// which is not on disk — the real raster is getting-things-done.webp). The tone
// getter likewise fell through to the hardcoded "direct" package, ignoring the
// requested tone.

const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const KNOWN_BOOK_IDS = new Set(BOOK_PACKAGES.map((pkg) => pkg.book.bookId));

/** Strip a leading slash + optional `book-covers/` prefix to a bare filename. */
function coverFilename(coverImage?: string): string | null {
  if (!coverImage) return null;
  const trimmed = coverImage.replace(/^\/+/, "").replace(/^book-covers\//, "");
  return trimmed.length > 0 ? trimmed : null;
}

test("every BOOK_PACKAGE_PRESENTATION key is a kebab-case, known bookId", () => {
  for (const key of Object.keys(BOOK_PACKAGE_PRESENTATION)) {
    assert.ok(
      KEBAB_CASE.test(key),
      `presentation key "${key}" is not kebab-case — it will never match a canonical bookId`
    );
    assert.ok(
      KNOWN_BOOK_IDS.has(key),
      `presentation key "${key}" matches no BOOK_PACKAGES bookId — the entry is unreachable`
    );
  }
});

test("getting-things-done resolves the curated presentation, not the inferred fallback", () => {
  const presentation = getBookPackagePresentation("getting-things-done");
  // Curated entry markers: the bespoke David Allen synopsis and the 📊 icon.
  // The inferred fallback synopsis starts with "A modern reading of <topics>"
  // derived from tags and never names the author/chapter count.
  assert.equal(presentation.icon, "📊");
  assert.match(presentation.synopsis, /David Allen's thirteen chapters/);
});

test("the curated getting-things-done entry embeds a real raster on disk (no 404)", () => {
  // Read the curated map entry directly (not the resolver), so this pins the cover
  // path baked into the entry itself — the capitalized entry embedded
  // /book-covers/Getting-Things-Done.webp, which is not on disk.
  const entry = BOOK_PACKAGE_PRESENTATION["getting-things-done"];
  assert.ok(entry, "the curated getting-things-done presentation entry must exist");
  const filename = coverFilename(entry.coverImage);
  assert.ok(filename, "curated entry must reference a cover file");
  // The canonical raster is the lowercase getting-things-done.webp.
  assert.equal(filename, "getting-things-done.webp");
  const onDisk = path.join(process.cwd(), "public", "book-covers", filename!);
  assert.ok(
    existsSync(onDisk),
    `cover ${filename} must exist under public/book-covers/ (was a 404 with the capitalized key)`
  );

  // And the resolver must surface that same real cover.
  const resolved = getBookPackagePresentation("getting-things-done");
  assert.equal(coverFilename(resolved.coverImage), "getting-things-done.webp");
});

test("getBookPackageByIdForTone wires the getting-things-done tone getter", () => {
  // The capitalized tone-getter key was unreachable, so this fell through to the
  // hardcoded "direct" package. After the fix the kebab-case key resolves and the
  // returned package still carries the canonical bookId for each tone.
  for (const tone of ["gentle", "direct", "competitive"] as const) {
    const pkg = getBookPackageByIdForTone("getting-things-done", tone);
    assert.ok(pkg, `tone ${tone} must resolve a package`);
    assert.equal(pkg!.book.bookId, "getting-things-done");
  }
});
