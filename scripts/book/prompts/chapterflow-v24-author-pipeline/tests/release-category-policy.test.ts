/**
 * R-239 — the release's categories/tags are validated against the canonical
 * taxonomy instead of copied through unread.
 *
 * The candidate release requires --categories/--tags to be explicit and then
 * copies them into the reader package. `generate-catalog-metadata.ts` turns
 * `categories[0]` into the library shelf, so an unlisted category shelves the book
 * nowhere — the released Franklin package ships "Memoir" and "Classics", neither
 * of which is in config/categories.json.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { test } from "./harness.js";
import { runCli } from "./helpers.js";
import {
  CATEGORIES_CONFIG_PATH,
  MAX_CATEGORIES,
  loadCategoryTaxonomy,
  validateReleaseCategoriesAndTags,
} from "../src/release/categoryPolicy.js";

const TAGS = ["focus", "habits"];

test("R-239: a category outside config/categories.json is REFUSED and the taxonomy is printed", () => {
  const result = validateReleaseCategoriesAndTags({ categories: ["Memoir", "Classics", "Self-Help"], tags: TAGS });
  assert.equal(result.ok, false, "the exact categories the released Franklin package ships must be refused");
  assert.ok(!result.ok);
  assert.match(result.error, /V25_RELEASE_METADATA_INVALID/);
  assert.match(result.error, /"Memoir"/);
  assert.match(result.error, /"Classics"/);
  assert.match(result.error, /Canonical: Psychology, Self-Help/, "the refusal names the taxonomy the operator must choose from");
  assert.match(result.error, /--new-category/, "and names the deliberate escape hatch");
});

test("R-239: --new-category is the deliberate act that lets an unlisted shelf through", () => {
  const result = validateReleaseCategoriesAndTags({ categories: ["Memoir", "Self-Help"], tags: TAGS, allowNewCategory: true });
  assert.ok(result.ok, result.ok ? "" : result.error);
  assert.deepEqual(result.categories, ["Memoir", "Self-Help"], "the new shelf is kept verbatim, the known one canonicalised");
});

test("R-239: aliases normalise to their canonical name, and duplicates collapse", () => {
  const result = validateReleaseCategoriesAndTags({ categories: ["self-help", "Personal Development", "Focus"], tags: TAGS });
  assert.ok(result.ok, result.ok ? "" : result.error);
  assert.deepEqual(result.categories, ["Self-Help", "Productivity"], "two aliases of Self-Help collapse; Focus maps to Productivity");
  assert.ok(result.normalised.some((n) => n.includes("self-help → Self-Help")), "the rewrite is reported to the operator");
});

test("R-239: tags are shape-validated and slug-normalised; empties and over-long tags refuse", () => {
  const ok = validateReleaseCategoriesAndTags({ categories: ["Self-Help"], tags: ["Deep Work", "deep-work", "Habits"] });
  assert.ok(ok.ok, ok.ok ? "" : ok.error);
  assert.deepEqual(ok.tags, ["deep-work", "habits"], "tags slug-normalise and de-duplicate");

  const empty = validateReleaseCategoriesAndTags({ categories: ["Self-Help"], tags: ["  "] });
  assert.equal(empty.ok, false);
  const long = validateReleaseCategoriesAndTags({ categories: ["Self-Help"], tags: ["x".repeat(41)] });
  assert.equal(long.ok, false);
  const punctuation = validateReleaseCategoriesAndTags({ categories: ["Self-Help"], tags: ["!!!"] });
  assert.equal(punctuation.ok, false, "a tag with no alphanumeric content is not a tag");
  const noTags = validateReleaseCategoriesAndTags({ categories: ["Self-Help"], tags: [] });
  assert.equal(noTags.ok, false);
});

test("R-239: at most MAX_CATEGORIES, at least one", () => {
  const taxonomy = loadCategoryTaxonomy();
  const tooMany = validateReleaseCategoriesAndTags({ categories: taxonomy.canonical.slice(0, MAX_CATEGORIES + 1), tags: TAGS });
  assert.equal(tooMany.ok, false);
  const none = validateReleaseCategoriesAndTags({ categories: [], tags: TAGS });
  assert.equal(none.ok, false);
});

test("R-239: the taxonomy this module validates against is the one the categorizers already use", () => {
  const raw = JSON.parse(readFileSync(CATEGORIES_CONFIG_PATH, "utf8")) as { canonical: string[] };
  const taxonomy = loadCategoryTaxonomy();
  assert.deepEqual([...taxonomy.canonical], raw.canonical);
  assert.ok(taxonomy.canonical.includes("Self-Help") && taxonomy.canonical.length >= 17);
});

/** The wiring, through the real CLI. The check runs before the composition is
 *  built, so nothing is read from or written to any v25 root. */
test("R-239: promote-book's candidate release REFUSES an unlisted category (exit 2, nothing touched)", () => {
  const result = runCli([
    "promote-book", "zz-category-policy-book",
    "--title", "T", "--author", "A",
    "--categories", "Memoir,Classics,Self-Help",
    "--tags", "fixture",
    "--v25-root", "/nonexistent-v25-root-category-policy",
    "--attempt-root", "/nonexistent-attempt-root-category-policy",
    "--candidate-id", "candidate-1",
    "--manifest-digest", "deadbeef",
    "--source-git-sha", "sha",
  ]);
  assert.equal(result.status, 2, result.out);
  assert.match(result.out, /V25_RELEASE_METADATA_INVALID/);
  assert.match(result.out, /"Memoir"/);
  assert.equal(existsSync("/nonexistent-v25-root-category-policy"), false, "the refusal precedes any root creation");
});
