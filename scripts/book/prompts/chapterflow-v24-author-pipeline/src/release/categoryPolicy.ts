/**
 * Release-time validation of the categories and tags an operator types (R-239).
 *
 * The candidate release requires `--categories` and `--tags` to be explicit and
 * then copies them, unvalidated, straight into the reader package's `book` block.
 * Nothing downstream checks them either — `verifyProductionPackage`,
 * `promoteBook` and `productionManifest` only carry the value — while
 * `scripts/book/generate-catalog-metadata.ts` turns `categories[0]` into the
 * library shelf the book lands on. A typo, a plural, or a category the reader's
 * filter has never heard of therefore ships silently and shelves the book
 * nowhere. (The released Franklin package ships `Memoir` and `Classics`, neither
 * of which is in the taxonomy.)
 *
 * `config/categories.json` is the canonical taxonomy the model-backed categorizer
 * and the no-API categorizer already both select from, with an alias table for the
 * obvious collapses. This module holds the release to the same list:
 *
 *   - every category must resolve, case-insensitively, to a CANONICAL name
 *     (directly or through the alias table), and is normalised to that name;
 *   - an unknown category is REFUSED, and the refusal prints the taxonomy — unless
 *     the operator passes `allowNewCategory`, which is the deliberate act of
 *     adding a shelf;
 *   - tags stay free-form (the taxonomy is explicit that they do) but must be
 *     non-empty, unique and shaped like the tags the categorizer emits.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url)); // src/release
export const CATEGORIES_CONFIG_PATH = resolve(__dirname, "../../config/categories.json");

/** Reader-facing bounds. 4 categories is the ceiling the taxonomy's own
 *  description states ("selects 2–4 categories from this list per book"); one is
 *  the floor because `categories[0]` decides the shelf. */
export const MAX_CATEGORIES = 4;
export const MAX_TAGS = 12;
export const MAX_TAG_LENGTH = 40;

export type CategoryTaxonomy = Readonly<{ canonical: readonly string[]; aliases: Readonly<Record<string, string>> }>;

export function loadCategoryTaxonomy(configPath: string = CATEGORIES_CONFIG_PATH): CategoryTaxonomy {
  const raw = JSON.parse(readFileSync(configPath, "utf8")) as { canonical?: unknown; aliases?: unknown };
  const canonical = Array.isArray(raw.canonical) ? raw.canonical.filter((v): v is string => typeof v === "string") : [];
  const aliases: Record<string, string> = {};
  if (raw.aliases && typeof raw.aliases === "object" && !Array.isArray(raw.aliases)) {
    for (const [k, v] of Object.entries(raw.aliases as Record<string, unknown>)) {
      if (typeof v === "string") aliases[k] = v;
    }
  }
  return { canonical, aliases };
}

export type ReleaseMetadataPolicyResult =
  | Readonly<{ ok: true; categories: string[]; tags: string[]; /** inputs the alias table rewrote, as "typed → canonical" */ normalised: string[] }>
  | Readonly<{ ok: false; error: string }>;

/**
 * Validate + normalise the release's categories and tags.
 *
 * PURE apart from reading the taxonomy file (path injectable for tests). Never
 * throws for bad INPUT — a malformed taxonomy file is a different failure and is
 * allowed to throw, because a release that cannot read the taxonomy must not
 * proceed as if everything validated.
 */
export function validateReleaseCategoriesAndTags(input: Readonly<{
  categories: readonly string[];
  tags: readonly string[];
  /** Deliberately add a shelf the taxonomy does not carry (CLI: --new-category). */
  allowNewCategory?: boolean;
  configPath?: string;
}>): ReleaseMetadataPolicyResult {
  const taxonomy = loadCategoryTaxonomy(input.configPath);
  const lookup = new Map<string, string>();
  for (const name of taxonomy.canonical) lookup.set(name.trim().toLowerCase(), name);
  for (const [alias, target] of Object.entries(taxonomy.aliases)) {
    if (taxonomy.canonical.includes(target)) lookup.set(alias.trim().toLowerCase(), target);
  }

  const categories: string[] = [];
  const normalised: string[] = [];
  const unknown: string[] = [];
  for (const raw of input.categories) {
    const typed = typeof raw === "string" ? raw.trim() : "";
    if (typed.length === 0) return { ok: false, error: "V25_RELEASE_METADATA_INVALID: --categories contains an empty entry" };
    const canonical = lookup.get(typed.toLowerCase());
    if (canonical === undefined) {
      if (!input.allowNewCategory) { unknown.push(typed); continue; }
      if (!categories.includes(typed)) categories.push(typed);
      continue;
    }
    if (canonical !== typed) normalised.push(`${typed} → ${canonical}`);
    if (!categories.includes(canonical)) categories.push(canonical);
  }
  if (unknown.length > 0) {
    return {
      ok: false,
      error:
        `V25_RELEASE_METADATA_INVALID: ${unknown.length} category value(s) are not in the canonical taxonomy ` +
        `(${unknown.map((c) => JSON.stringify(c)).join(", ")}). ` +
        `The reader's category filter and the library shelf (catalog metadata uses categories[0]) are built from ` +
        `config/categories.json, so an unlisted category shelves the book nowhere. Canonical: ${taxonomy.canonical.join(", ")}. ` +
        "Pass --new-category to add a shelf on purpose.",
    };
  }
  if (categories.length === 0) {
    return { ok: false, error: "V25_RELEASE_METADATA_INVALID: --categories must name at least one category" };
  }
  if (categories.length > MAX_CATEGORIES) {
    return { ok: false, error: `V25_RELEASE_METADATA_INVALID: at most ${MAX_CATEGORIES} categories (got ${categories.length})` };
  }

  const tags: string[] = [];
  for (const raw of input.tags) {
    const typed = typeof raw === "string" ? raw.trim() : "";
    if (typed.length === 0) return { ok: false, error: "V25_RELEASE_METADATA_INVALID: --tags contains an empty entry" };
    if (typed.length > MAX_TAG_LENGTH) {
      return { ok: false, error: `V25_RELEASE_METADATA_INVALID: tag ${JSON.stringify(typed)} exceeds ${MAX_TAG_LENGTH} characters` };
    }
    const slug = typed.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    if (slug.length === 0) {
      return { ok: false, error: `V25_RELEASE_METADATA_INVALID: tag ${JSON.stringify(typed)} has no alphanumeric content` };
    }
    if (!tags.includes(slug)) tags.push(slug);
  }
  if (tags.length === 0) return { ok: false, error: "V25_RELEASE_METADATA_INVALID: --tags must name at least one tag" };
  if (tags.length > MAX_TAGS) {
    return { ok: false, error: `V25_RELEASE_METADATA_INVALID: at most ${MAX_TAGS} tags (got ${tags.length})` };
  }

  return { ok: true, categories, tags, normalised };
}
