import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import {
  CANONICAL_CATEGORIES,
  CATEGORY_ALIASES,
  CategoryTaxonomyError,
  canonicalizeCategories,
  canonicalizeCategory,
  enforceCanonicalCategories,
  isCanonicalCategory,
} from "@/lib/category-taxonomy";

const CANONICAL_SET = new Set<string>(CANONICAL_CATEGORIES);

// The 52 distinct category strings observed on the live prod catalog
// (audit snapshot, .visual-audit/shots-prod/DATA-INTEGRITY.txt). Every one of
// these must resolve to a canonical category so the publish gate never
// false-throws on existing content and the deferred prod backfill is total.
const PROD_CATEGORY_STRINGS = [
  "Business", "Strategy", "Management", "Leadership", "Productivity",
  "Self Improvement", "Psychology", "Relationships", "Personal Development",
  "Decision Making", "Behavioral Economics", "Innovation", "Mental Toughness",
  "Self Discipline", "Resilience", "Memoir", "Sports", "Self-Help",
  "Communication", "Negotiation", "Philosophy", "Self Development", "Focus",
  "Entrepreneurship", "Career", "Messaging", "Learning", "Personal Finance",
  "Decision-Making", "Business Communication", "Public Speaking", "Conflict",
  "Execution", "Self Management", "Personal Safety", "Violence Prevention",
  "Threat Assessment", "Boundaries", "Interpersonal Relations", "Body Language",
  "Society", "Human Behavior", "Reporting", "Investing", "Classics",
  "Political Philosophy", "Moral Psychology", "Politics", "Religion",
  "Creativity", "Writing", "Risk",
];

test("the documented duplicate splits collapse onto a single canonical", () => {
  // Self-improvement cluster (the 6-way split)
  assert.equal(canonicalizeCategory("Self-Help"), "Self Improvement");
  assert.equal(canonicalizeCategory("Personal Development"), "Self Improvement");
  assert.equal(canonicalizeCategory("Self Development"), "Self Improvement");
  assert.equal(canonicalizeCategory("Self Discipline"), "Self Improvement");
  assert.equal(canonicalizeCategory("Self Management"), "Self Improvement");
  // Decision-making exact collision
  assert.equal(canonicalizeCategory("Decision-Making"), "Decision Making");
  // Communication cluster
  assert.equal(canonicalizeCategory("Business Communication"), "Communication");
  assert.equal(canonicalizeCategory("Public Speaking"), "Communication");
  assert.equal(canonicalizeCategory("Messaging"), "Communication");
});

test("canonical categories are stable under canonicalization (closure)", () => {
  for (const category of CANONICAL_CATEGORIES) {
    assert.equal(canonicalizeCategory(category), category, `${category} should be its own canonical`);
    assert.equal(isCanonicalCategory(category), true);
  }
});

test("alias map only points at real canonical categories", () => {
  for (const [variant, canonical] of Object.entries(CATEGORY_ALIASES)) {
    assert.ok(
      CANONICAL_SET.has(canonical),
      `alias ${variant} -> ${canonical} targets a non-canonical category`
    );
    // An alias must not also be a canonical (would be ambiguous/redundant).
    assert.ok(
      !CANONICAL_SET.has(variant),
      `${variant} is both a canonical category and an alias key`
    );
  }
});

test("matching is case- and whitespace-insensitive", () => {
  assert.equal(canonicalizeCategory("  self   improvement "), "Self Improvement");
  assert.equal(canonicalizeCategory("SELF-HELP"), "Self Improvement");
  assert.equal(canonicalizeCategory("decision making"), "Decision Making");
  assert.equal(isCanonicalCategory("  PSYCHOLOGY  "), true);
});

test("every prod catalog string resolves to a canonical category", () => {
  for (const raw of PROD_CATEGORY_STRINGS) {
    assert.equal(isCanonicalCategory(raw), true, `prod string ${raw!} is not in the taxonomy`);
    const canonical = canonicalizeCategory(raw);
    assert.ok(
      CANONICAL_SET.has(canonical),
      `prod string ${raw} canonicalized to non-canonical ${canonical}`
    );
  }
});

test("every authored on-disk package category is in the taxonomy", () => {
  // Living coverage guard: a new book authored with an off-taxonomy category
  // fails here (in `npm run test`) before it can ever reach the publish gate.
  const dir = join(process.cwd(), "book-packages");
  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
  const offenders: string[] = [];
  for (const file of files) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(join(dir, file), "utf8"));
    } catch {
      continue;
    }
    const book = (parsed as { book?: { categories?: unknown } } | null)?.book;
    const categories = Array.isArray(book?.categories) ? book.categories : [];
    for (const category of categories) {
      if (typeof category === "string" && category.trim() && !isCanonicalCategory(category)) {
        offenders.push(`${file}: ${category}`);
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `off-taxonomy categories in book packages (add an alias/canonical):\n${offenders.join("\n")}`
  );
});

test("canonicalizeCategories dedupes and keeps the primary category first", () => {
  // The Gift of Fear's authored cluster — primary "Personal Safety" must stay
  // categories[0] after the singleton collapses + dedupe.
  assert.deepEqual(
    canonicalizeCategories([
      "Personal Safety",
      "Psychology",
      "Violence Prevention",
      "Threat Assessment",
      "Boundaries",
    ]),
    ["Personal Safety", "Psychology", "Relationships"]
  );
  // Blank entries are dropped.
  assert.deepEqual(canonicalizeCategories(["", "   ", "Self-Help"]), ["Self Improvement"]);
});

test("an unknown category passes through cleaned but is not canonical", () => {
  assert.equal(canonicalizeCategory("  Quantum   Basket  Weaving "), "Quantum Basket Weaving");
  assert.equal(isCanonicalCategory("Quantum Basket Weaving"), false);
  assert.equal(canonicalizeCategory(""), "");
  assert.equal(isCanonicalCategory(""), false);
});

test("enforceCanonicalCategories rejects unknowns and normalizes the rest", () => {
  assert.throws(
    () => enforceCanonicalCategories(["Self-Help", "Made Up Category"]),
    (error: unknown) => {
      assert.ok(error instanceof CategoryTaxonomyError);
      assert.deepEqual(error.invalidCategories, ["Made Up Category"]);
      return true;
    }
  );
  // Blank entries are not "unknown" — they are dropped, not rejected.
  assert.deepEqual(
    enforceCanonicalCategories(["Self-Help", "", "Decision-Making", "Decision Making"]),
    ["Self Improvement", "Decision Making"]
  );
});
