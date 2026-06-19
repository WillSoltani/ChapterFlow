/**
 * Single source of truth for retired ("orphan") book slugs and the canonical
 * slug each one resolves to (PROD-DUP / DUP-OLD-DEGRADED).
 *
 * Background: the publish pipeline keys a catalog record by `book.bookId`
 * (= the URL slug). A past slug rename therefore wrote a brand-new record under
 * the new slug but never superseded the old one, so several books still have a
 * stale, lower-quality record live on prod under the old slug (placeholder
 * cover, paraphrased chapter titles, wrong difficulty/byline). Opening the old
 * slug serves that degraded version instead of the curated v21 one.
 *
 * This map is the join point for the three fixes that retire those orphans:
 *   1. the publish dedupe guard — `evaluatePublishGuard` (consumed by
 *      app/app/api/book/_lib/ingestion.ts): rejects (re)publishing an orphan
 *      slug and supersedes existing orphan records when the canonical
 *      republishes, so a rename can never again fork a second live record;
 *   2. the orphan → canonical 308 redirects (middleware.ts — done there, not in
 *      next.config redirects(), because Next matches redirect sources
 *      case-INSENSITIVELY and the case-only `Getting-Things-Done` rename would
 *      otherwise loop the live canonical onto itself), so inbound links /
 *      bookmarks / crawler URLs for the old slug land on the canonical;
 *   3. the dry-run catalog reconcile (scripts/book/reconcile-prod-catalog.ts),
 *      which archives the live orphan records.
 *
 * Keys are the EXACT prod bookId/slug strings (case- and punctuation-sensitive,
 * e.g. the capitalized `Getting-Things-Done` and the apostrophe in
 * `you-can't-hurt-me`) so they match DynamoDB items and URL paths verbatim.
 *
 * This module must stay edge-safe: NO node/server-only imports and NO side
 * effects, so it can be imported from the Next config, edge middleware, server
 * code, maintenance scripts, and unit tests alike.
 */
export const BOOK_SLUG_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  // Can't Hurt Me — canonical: you-cant-hurt-me (v2)
  "cant-hurt-me": "you-cant-hurt-me",
  "you-can't-hurt-me": "you-cant-hurt-me",
  // Getting Things Done — canonical: getting-things-done (v3).
  // The capitalized slug is the orphan; the lowercase is canonical.
  "Getting-Things-Done": "getting-things-done",
  // How to Win Friends and Influence People — canonical full slug (v4)
  "friends-and-influence": "how-to-win-friends-and-influence-people",
  "friends-and-influence-student-edition": "how-to-win-friends-and-influence-people",
  // The 33 Strategies of War — canonical: the-33-strategies-of-war (v3)
  "33-strategies-of-war": "the-33-strategies-of-war",
  // The Art of War — canonical: the-art-of-war (v4)
  "art-of-war": "the-art-of-war",
  // The Laws of Human Nature — canonical: the-laws-of-human-nature (v4)
  "laws-of-human-nature": "the-laws-of-human-nature",
});

/** Every retired slug (the keys of the alias map). */
export const ORPHAN_BOOK_SLUGS: readonly string[] = Object.freeze(
  Object.keys(BOOK_SLUG_ALIASES)
);

/** Every canonical slug an orphan resolves to (de-duplicated). */
export const CANONICAL_BOOK_SLUGS: readonly string[] = Object.freeze(
  Array.from(new Set(Object.values(BOOK_SLUG_ALIASES)))
);

/** True if `slug` is a known retired/orphan slug. */
export function isOrphanBookSlug(slug: string): boolean {
  return Object.prototype.hasOwnProperty.call(BOOK_SLUG_ALIASES, slug);
}

/**
 * Resolve any slug to its canonical form. Idempotent: a canonical or unknown
 * slug is returned unchanged, so this is safe to call on every slug.
 */
export function resolveCanonicalBookSlug(slug: string): string {
  return BOOK_SLUG_ALIASES[slug] ?? slug;
}

/** All orphan slugs that resolve to the given canonical slug (its old slugs). */
export function orphanSlugsForCanonical(canonicalSlug: string): string[] {
  return ORPHAN_BOOK_SLUGS.filter(
    (orphan) => BOOK_SLUG_ALIASES[orphan] === canonicalSlug
  );
}

export type PublishGuardDecision =
  | {
      action: "reject";
      code: "orphan_slug";
      bookId: string;
      canonicalSlug: string;
      message: string;
    }
  | {
      action: "publish";
      /**
       * Old/orphan slugs of THIS book that should be retired (archived) once it
       * publishes under its canonical slug. Empty for any book that has never
       * been renamed.
       */
      supersedeSlugs: string[];
    };

/**
 * Decide whether a book may publish under `bookId`, purely from the static alias
 * map (no I/O — the caller performs any DynamoDB reads/writes the decision
 * implies, which keeps this unit-testable).
 *
 *  - Publishing UNDER a retired slug is rejected: the rename's canonical slug is
 *    the only one that may go live, so an orphan record can never be re-created.
 *  - Publishing a canonical slug that has known old slugs returns those slugs in
 *    `supersedeSlugs` so the caller can archive the stale records (a rename now
 *    retires the old record instead of forking a second live one).
 */
export function evaluatePublishGuard(bookId: string): PublishGuardDecision {
  if (isOrphanBookSlug(bookId)) {
    const canonicalSlug = resolveCanonicalBookSlug(bookId);
    return {
      action: "reject",
      code: "orphan_slug",
      bookId,
      canonicalSlug,
      message:
        `Refusing to publish retired slug "${bookId}": it was superseded by ` +
        `"${canonicalSlug}". Publish under the canonical slug instead ` +
        `(see lib/book-slug-aliases.ts).`,
    };
  }
  return { action: "publish", supersedeSlugs: orphanSlugsForCanonical(bookId) };
}
