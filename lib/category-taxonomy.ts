/**
 * Controlled category vocabulary + alias map (DI-3 / 6B / LM-4, owner decision D4).
 *
 * Book categories are authored as free text on each package. Over time that let
 * the SAME topic fork into near-duplicate strings — on the live catalog a
 * single self-help concept was split six ways ("Self Improvement" / "Self-Help"
 * / "Personal Development" / "Self Development" / "Self Discipline" /
 * "Self Management"), "Decision Making" vs "Decision-Making" was an exact
 * case/punctuation collision, and communication split across four labels. A
 * filter pill for "Self Improvement" then silently missed the "Self-Help" books.
 *
 * This module is the single source of truth for:
 *   - CANONICAL_CATEGORIES — the controlled vocabulary every persisted category
 *     must resolve to.
 *   - CATEGORY_ALIASES — every known off-canonical variant (from the prod
 *     catalog snapshot + every on-disk book package) mapped onto a canonical.
 *   - canonicalizeCategory / canonicalizeCategories — lenient normalization used
 *     at read/display time (never throws; an unknown string passes through
 *     whitespace-cleaned so it can still merge case variants).
 *   - isCanonicalCategory / enforceCanonicalCategories — the strict publish-time
 *     gate: a category with no canonical mapping is rejected so a new synonym can
 *     never enter the catalog silently.
 *
 * Pure data + functions — no framework, AWS, React or "server-only" imports — so
 * it is safe to import from the server publish path (ingestion), the client
 * badges surface (badge-stats) and the offline backfill script alike.
 *
 * The alias map covers all 52 distinct strings observed on the prod catalog
 * (audit snapshot, .visual-audit/shots-prod/DATA-INTEGRITY.txt) and all 42 in
 * the on-disk book packages. Adding a new authored category requires either a
 * new CANONICAL_CATEGORIES entry or a new CATEGORY_ALIASES row — the publish
 * gate rejects anything else. Several singleton → parent collapses below are
 * judgement calls (flagged inline); they only rewrite live data via the deferred
 * prod backfill, which the owner reviews before applying.
 */

/** The controlled vocabulary. Every persisted category resolves to one of these. */
export const CANONICAL_CATEGORIES = [
  "Productivity",
  "Self Improvement",
  "Psychology",
  "Business",
  "Leadership",
  "Communication",
  "Strategy",
  "Management",
  "Decision Making",
  "Relationships",
  "Philosophy",
  "Behavioral Economics",
  "Entrepreneurship",
  "Innovation",
  "Learning",
  "Mental Toughness",
  "Negotiation",
  "Memoir",
  "Personal Finance",
  "Investing",
  "Career",
  "Classics",
  "Personal Safety",
  "General",
] as const;

export type CanonicalCategory = (typeof CANONICAL_CATEGORIES)[number];

/**
 * Off-canonical variant → canonical. Keys are matched case- and
 * whitespace-insensitively (see normalizeKey), so only spelling/punctuation that
 * survives that (e.g. the hyphen in "Decision-Making") needs an explicit row.
 */
export const CATEGORY_ALIASES: Record<string, CanonicalCategory> = {
  // ── Self-improvement cluster (the 6-way split, decision D4) ──
  "Self-Help": "Self Improvement",
  "Personal Development": "Self Improvement",
  "Self Development": "Self Improvement",
  "Self Discipline": "Self Improvement",
  "Self Management": "Self Improvement",

  // ── Decision making (exact case/punctuation collision + judgement) ──
  "Decision-Making": "Decision Making",
  Risk: "Decision Making", // singleton → judgement/risk topic

  // ── Communication cluster (decision D4 + singleton collapses) ──
  "Business Communication": "Communication",
  "Public Speaking": "Communication",
  Messaging: "Communication",
  "Body Language": "Communication", // reading people / nonverbal — judgement
  Writing: "Communication", // singleton → judgement
  Reporting: "Business", // PMBOK-style status reporting — judgement (Business, not Communication)

  // ── Psychology cluster ──
  "Human Behavior": "Psychology",
  "Moral Psychology": "Psychology",

  // ── Relationships cluster ──
  "Interpersonal Relations": "Relationships",
  Boundaries: "Relationships", // singleton → judgement (vs Self Improvement)

  // ── Philosophy / society cluster (singleton collapses) ──
  "Political Philosophy": "Philosophy",
  Politics: "Philosophy",
  Society: "Philosophy",
  Religion: "Philosophy",

  // ── Resilience / toughness ──
  Resilience: "Mental Toughness",
  Sports: "Mental Toughness", // peak-performance / sports psychology — judgement

  // ── Negotiation / conflict ──
  Conflict: "Negotiation",

  // ── Productivity-adjacent singletons ──
  Execution: "Productivity",
  Focus: "Productivity",

  // ── Innovation / creativity ──
  Creativity: "Innovation",

  // ── Personal-safety cluster (The Gift of Fear) ──
  "Violence Prevention": "Personal Safety",
  "Threat Assessment": "Personal Safety",
};

function normalizeKey(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toLowerCase();
}

const CANONICAL_BY_KEY = new Map<string, CanonicalCategory>(
  CANONICAL_CATEGORIES.map((category) => [normalizeKey(category), category])
);

const ALIAS_BY_KEY = new Map<string, CanonicalCategory>(
  Object.entries(CATEGORY_ALIASES).map(([variant, canonical]) => [
    normalizeKey(variant),
    canonical,
  ])
);

/** Thrown by enforceCanonicalCategories when a category has no canonical mapping. */
export class CategoryTaxonomyError extends Error {
  readonly invalidCategories: string[];
  constructor(invalidCategories: string[]) {
    super(
      `Categories not in the controlled taxonomy: ${invalidCategories.join(", ")}. ` +
        `Add a canonical entry to CANONICAL_CATEGORIES or an alias to CATEGORY_ALIASES in lib/category-taxonomy.ts.`
    );
    this.name = "CategoryTaxonomyError";
    this.invalidCategories = invalidCategories;
  }
}

/** True if `raw` resolves to a known canonical category (directly or via an alias). */
export function isCanonicalCategory(raw: string): boolean {
  const key = normalizeKey(raw);
  if (!key) return false;
  return CANONICAL_BY_KEY.has(key) || ALIAS_BY_KEY.has(key);
}

/**
 * Lenient normalization. Returns the canonical form for a known category or
 * alias; an unknown non-empty string is returned whitespace-cleaned (never
 * thrown) so display-side counting still merges accidental case/spacing variants
 * even before the catalog has been backfilled. Empty/blank input → "".
 */
export function canonicalizeCategory(raw: string): string {
  const key = normalizeKey(raw);
  if (!key) return "";
  const direct = CANONICAL_BY_KEY.get(key);
  if (direct) return direct;
  const alias = ALIAS_BY_KEY.get(key);
  if (alias) return alias;
  return raw.trim().replace(/\s+/g, " ");
}

/**
 * Lenient list normalization: canonicalize each entry, drop blanks, and dedupe
 * while preserving first-occurrence order (so categories[0] — the primary
 * category surfaced as the filter pill — stays stable).
 */
export function canonicalizeCategories(list: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of list) {
    const canonical = canonicalizeCategory(raw);
    if (!canonical || seen.has(canonical)) continue;
    seen.add(canonical);
    out.push(canonical);
  }
  return out;
}

/**
 * Strict publish-time gate. Rejects any non-blank category with no canonical
 * mapping (throws CategoryTaxonomyError); otherwise returns the canonicalized,
 * deduped list. Use this where a new synonym must never silently enter the
 * persisted catalog.
 */
export function enforceCanonicalCategories(list: readonly string[]): string[] {
  const invalid = list.filter(
    (category) => category.trim().length > 0 && !isCanonicalCategory(category)
  );
  if (invalid.length > 0) {
    throw new CategoryTaxonomyError(invalid);
  }
  return canonicalizeCategories(list);
}
