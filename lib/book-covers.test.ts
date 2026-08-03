import { test } from "node:test";
import assert from "node:assert/strict";
import { statSync, existsSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
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

// The committed-cover invariant must hold over GIT-TRACKED files only, never the
// raw working tree: the pipeline drops untracked cover artifacts into this dir
// (e.g. a stray `behave.webp` with no AVIF sibling, or a `*.svg` left by a local
// render) that are absent on CI, and `readdirSync` would let those local strays
// fail `npm test`. Enumerating via `git ls-files` keeps the assertion about what
// actually ships.
function trackedCovers(suffix: string): string[] {
  const out = execFileSync(
    "git",
    ["ls-files", "-z", "--", `public/book-covers/*${suffix}`],
    { cwd: process.cwd(), encoding: "utf8" },
  );
  return out
    .split("\0")
    .filter(Boolean)
    .map((p) => path.basename(p));
}

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
    const primary = getBookCoverCandidates(id)[0]!;
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
    const primary = getBookCoverCandidates(id)[0]!;
    assert.ok(
      existsSync(publicFileFor(primary)),
      `aliased cover missing for ${id}: ${primary}`,
    );
  }
});

test("every committed cover WebP is non-trivial and has an AVIF sibling", () => {
  const webps = trackedCovers(".webp");
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

// Regression for the AVIF-sibling invariant being scoped to git-tracked files.
// Before this fix the test did `readdirSync`, so a stray untracked cover in the
// working tree (e.g. `behave.webp` with no `behave.avif`) failed local `npm test`
// even though it was absent on CI. This proves untracked strays are excluded.
test("committed-cover enumeration ignores untracked working-tree strays", () => {
  const tracked = trackedCovers(".webp");
  assert.ok(tracked.length > 0, "expected at least one tracked cover");

  // Every name `trackedCovers` returns must actually be tracked by git — i.e.
  // `git ls-files --error-unmatch` succeeds for it (untracked files exit non-zero).
  const sample = tracked[0];
  assert.doesNotThrow(() => {
    execFileSync(
      "git",
      ["ls-files", "--error-unmatch", "--", `public/book-covers/${sample}`],
      { cwd: process.cwd(), stdio: "ignore" },
    );
  }, `trackedCovers returned an untracked file: ${sample}`);

  // Create a genuinely untracked stray (no AVIF sibling) and confirm the helper
  // never surfaces it — the exact shape that used to break the suite.
  const strayName = "__regression-untracked-stray.webp";
  const strayPath = path.join(COVERS_DIR, strayName);
  writeFileSync(strayPath, Buffer.alloc(MIN_RASTER_BYTES + 1, 0x42));
  try {
    assert.ok(
      existsSync(strayPath),
      "fixture stray cover should exist on disk for the test window",
    );
    assert.ok(
      !trackedCovers(".webp").includes(strayName),
      "an untracked stray cover must be excluded from the tracked-cover invariant",
    );
  } finally {
    rmSync(strayPath, { force: true });
  }
});
