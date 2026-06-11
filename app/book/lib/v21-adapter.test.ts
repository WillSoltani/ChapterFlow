import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { normalizeV21Package } from "./v21-adapter";

// Run from the repo root (npm test), so process.cwd() is the project root.
const rawPkg = JSON.parse(
  readFileSync(
    join(process.cwd(), "book-packages", "atomic-habits.v21.json"),
    "utf8",
  ),
) as unknown;

/**
 * Regression guard for the C1 "blank Summary" class of bug: v21 chapter prose
 * lives in `breakdown.{fastRead,deepRead,fullRead}`, and must be mapped into
 * the reader's `contentVariants.{easy,medium,hard}` with non-empty
 * `chapterBreakdown` + `summaryBlocks`. If a future change routes v21 through
 * the wrong normalizer (the original C1 bug), these assertions fail.
 */
test("normalizeV21Package fills non-empty Summary content for every chapter (guards C1)", () => {
  const pkg = normalizeV21Package(rawPkg);
  assert.equal(pkg.schemaVersion, "chapterflow-v21-authored");
  assert.ok(pkg.chapters.length > 0, "expected the package to have chapters");

  for (const ch of pkg.chapters) {
    const variants = ch.contentVariants;
    assert.ok(
      Object.keys(variants).length > 0,
      `chapter ${ch.number} has zero contentVariants (C1 regression)`,
    );

    for (const key of ["easy", "medium", "hard"] as const) {
      const v = variants[key];
      assert.ok(v, `chapter ${ch.number} is missing the ${key} variant`);
      assert.ok(
        typeof v!.chapterBreakdown === "string" &&
          v!.chapterBreakdown.trim().length > 0,
        `chapter ${ch.number} ${key} has empty chapterBreakdown`,
      );
      assert.ok(
        Array.isArray(v!.summaryBlocks) && v!.summaryBlocks.length > 0,
        `chapter ${ch.number} ${key} has empty summaryBlocks`,
      );
    }
  }
});

test("normalizeV21Package rejects a non-v21 package", () => {
  assert.throws(() => normalizeV21Package({ schemaVersion: "nstd" }));
});
