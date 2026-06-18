import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// Content-QA invariant (audit: MEDITATIONS-GENERIC-CHAPTERS).
// A book whose chapter titles are ALL bare structural labels ("Book I", "Chapter 2",
// "Part III") — or all identical — reads as unfinished in the catalog/detail "Your
// Journey" list: the reader cannot tell what any chapter is about. This test scans the
// shipped book packages and fails if any book exhibits that pattern, so the class is
// caught before launch rather than spotted by eye on prod.

const PACKAGES_DIR = join(process.cwd(), "book-packages");

// Matches a title that is purely a structural label with no descriptive theme,
// e.g. "Book I", "Book XII", "Chapter 3", "Part IV", "Section 2." (trailing dot ok).
const GENERIC_TITLE = /^(book|chapter|part|section)\s+([ivxlcdm]+|\d+)\.?$/i;

type LoadedPackage = { file: string; titles: string[] };

function loadChapterTitles(): LoadedPackage[] {
  const files = readdirSync(PACKAGES_DIR).filter((f) => f.endsWith(".json"));
  const loaded: LoadedPackage[] = [];
  for (const file of files) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(join(PACKAGES_DIR, file), "utf8"));
    } catch {
      // Not parseable as JSON — skip (other tests cover schema validity).
      continue;
    }
    const chapters = (parsed as { chapters?: unknown })?.chapters;
    if (!Array.isArray(chapters)) continue; // not a v21 book package
    const titles = chapters
      .map((c) => (c as { title?: unknown })?.title)
      .filter((t): t is string => typeof t === "string")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    if (titles.length === 0) continue; // nothing to judge
    loaded.push({ file, titles });
  }
  return loaded;
}

function isAllGeneric(titles: string[]): boolean {
  return titles.every((t) => GENERIC_TITLE.test(t));
}

function isAllIdentical(titles: string[]): boolean {
  return titles.length > 1 && new Set(titles).size === 1;
}

test("book packages exist to scan for title quality", () => {
  const loaded = loadChapterTitles();
  assert.ok(
    loaded.length > 0,
    `expected to find at least one book package under ${PACKAGES_DIR}`,
  );
});

test("no book package has all-generic or all-identical chapter titles", () => {
  const loaded = loadChapterTitles();
  const offenders = loaded
    .filter(({ titles }) => isAllGeneric(titles) || isAllIdentical(titles))
    .map(({ file, titles }) => `${file} (e.g. ${titles.slice(0, 3).join(", ")})`);

  assert.deepEqual(
    offenders,
    [],
    `These books have chapter titles that are all bare structural labels ("Book I", ` +
      `"Chapter 2", ...) or all identical, which reads as unfinished in the catalog. ` +
      `Give each chapter a descriptive title (keeping any structural anchor is fine, ` +
      `e.g. "Book I — Debts and Lessons"):\n  ${offenders.join("\n  ")}`,
  );
});

test("the GENERIC_TITLE heuristic matches bare labels but not descriptive titles", () => {
  // Guard the heuristic itself so a future refactor cannot silently neuter the scan.
  for (const bare of ["Book I", "Book XII", "Chapter 3", "Part IV", "Section 2."]) {
    assert.ok(GENERIC_TITLE.test(bare), `expected "${bare}" to be flagged as generic`);
  }
  for (const real of [
    "Book I — Debts and Lessons",
    "Laying Plans",
    "Attack by Stratagem",
    "The Good of the Hive",
  ]) {
    assert.ok(!GENERIC_TITLE.test(real), `expected "${real}" to be treated as descriptive`);
  }
});
