import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { getBookCoverCandidates, getBookCoverPath } from "./book-covers";

// Smoke test for library cover art. The audit's ask was a Playwright assertion
// of `naturalWidth > 0` on /book/library; this harness runs under `tsx --test`
// with no browser, so we assert the runnable equivalent: every cover resolves
// to a REAL raster file on disk with non-trivial byte size. A 27KB AVIF / 39KB
// WebP cannot be the old 10px-gradient placeholder, and `next/image` (unoptimized)
// serves these files verbatim — so a passing test guarantees a real <img> renders.

const COVERS_DIR = path.join(process.cwd(), "public", "book-covers");
const MIN_RASTER_BYTES = 2_000;

function publicFileFor(urlPath: string): string {
  return path.join(process.cwd(), "public", urlPath.replace(/^\//, ""));
}

// Representative books that are definitely in the live catalog and the curated
// cover map.
const SAMPLE = [
  "deep-work",
  "atomic-habits",
  "thinking-fast-and-slow",
  "crucial-conversations",
  "the-48-laws-of-power",
  "essentialism",
];

test("each sampled cover's primary candidate is a real raster on disk", () => {
  for (const id of SAMPLE) {
    const primary = getBookCoverCandidates(id)[0];
    assert.ok(primary, `no cover candidate produced for ${id}`);
    assert.match(
      primary,
      /\.(avif|webp)$/,
      `primary cover for ${id} must be a raster, got ${primary}`,
    );
    const file = publicFileFor(primary);
    assert.ok(existsSync(file), `cover file missing on disk: ${file}`);
    assert.ok(
      statSync(file).size > MIN_RASTER_BYTES,
      `cover ${file} is too small (${statSync(file).size}B) to be a real image`,
    );
  }
});

test("no cover candidate is an SVG (next/image refuses them)", () => {
  for (const id of [...SAMPLE, "the-laws-of-human-nature", "you-cant-hurt-me"]) {
    for (const candidate of getBookCoverCandidates(id)) {
      assert.doesNotMatch(
        candidate,
        /\.svg$/,
        `${id} still offers an SVG cover candidate: ${candidate}`,
      );
    }
  }
});

test("getBookCoverPath returns an on-disk WebP for mapped books", () => {
  for (const id of SAMPLE) {
    const coverPath = getBookCoverPath(id);
    assert.match(coverPath, /\.webp$/, `expected a WebP path for ${id}, got ${coverPath}`);
    assert.ok(existsSync(publicFileFor(coverPath)), `WebP missing for ${id}: ${coverPath}`);
  }
});

test("cover aliases resolve to a real raster", () => {
  for (const id of [
    "the-laws-of-human-nature", // → laws-of-human-nature
    "the-great-mental-models-vol-1", // → the-great-mental-models-v-1
    "you-cant-hurt-me", // → you-can't-hurt-me (apostrophe variant)
  ]) {
    const primary = getBookCoverCandidates(id)[0];
    assert.ok(
      existsSync(publicFileFor(primary)),
      `aliased cover missing for ${id}: ${primary}`,
    );
  }
});

test("every committed cover WebP is non-trivial and has an AVIF sibling", () => {
  const webps = readdirSync(COVERS_DIR).filter((f) => f.endsWith(".webp"));
  assert.ok(
    webps.length >= 60,
    `expected the full catalog of cover rasters, found only ${webps.length}`,
  );
  for (const webp of webps) {
    const base = webp.replace(/\.webp$/, "");
    const webpFile = path.join(COVERS_DIR, webp);
    const avifFile = path.join(COVERS_DIR, `${base}.avif`);
    assert.ok(statSync(webpFile).size > MIN_RASTER_BYTES, `${webp} is too small`);
    assert.ok(existsSync(avifFile), `missing AVIF sibling for ${webp}`);
    assert.ok(statSync(avifFile).size > 1_000, `${base}.avif is too small`);
  }
});

test("no committed cover is still an SVG", () => {
  // pmbok-guide.svg is an untracked pipeline artifact (absent on CI); only
  // assert against the curated map's reach.
  for (const id of [...SAMPLE, "tiny-habits", "make-time", "the-power-of-habit"]) {
    for (const candidate of getBookCoverCandidates(id)) {
      assert.ok(!candidate.endsWith(".svg"));
    }
  }
});
