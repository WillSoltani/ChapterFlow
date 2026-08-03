/**
 * Catalog-integrity check for duplicate book records (DUP-OLD-DEGRADED).
 *
 * A slug rename that forked a second catalog record leaves two PUBLISHED rows
 * with the SAME human title but different slugs and divergent metadata (cover,
 * author byline, difficulty/variant). The newer row is the curated v21 book; the
 * older "orphan" row serves a degraded version. This module surfaces those
 * same-title sibling groups so the reconcile script (and a unit test) can flag a
 * fork.
 *
 * Scope: this is a HEURISTIC for surfacing UNKNOWN/future forks (it groups by
 * normalized title, so an orphan whose title was also paraphrased may not group
 * with its canonical). It is NOT the authority for the known forks: the alias map
 * (book-slug-aliases.ts) drives all archiving/redirects/supersede by exact slug,
 * independent of title. The reconcile script's output here is report-only.
 *
 * Edge-safe: depends only on the alias map (no node/server-only imports), so it
 * can run in scripts, server code, and tests.
 *
 * Live invokers: lib/catalog-integrity-gate.test.ts (CI gate that fails the
 * suite if an unknown fork re-enters lib/books-catalog.metadata.json) and
 * scripts/book/reconcile-prod-catalog.ts (operator-run dry-run reconcile).
 */
import { isOrphanBookSlug } from "./book-slug-aliases";

/**
 * The catalog fields this check reads. A structural subset of
 * `BookCatalogItem` (app/app/api/book/_lib/types.ts) so callers can pass real
 * catalog rows without dragging a server-only type into this edge-safe module.
 */
export type CatalogRecordLike = {
  bookId: string;
  title: string;
  author?: string;
  status?: string;
  currentPublishedVersion?: number;
  variantFamily?: string;
  cover?: { emoji?: string; color?: string };
  categories?: string[];
};

export type DuplicateTitleGroup = {
  /** Normalized grouping key. */
  normalizedTitle: string;
  /** A representative human title (the canonical record's). */
  title: string;
  /** The record that should be kept live. */
  canonicalBookId: string;
  /** Sibling records that should be retired/redirected. */
  orphanBookIds: string[];
  /** Every record in the group (canonical first). */
  records: CatalogRecordLike[];
  /** Metadata fields that diverge across the siblings (why the fork is visible). */
  divergentFields: string[];
};

/** Group key: trimmed, lower-cased, internal whitespace collapsed. */
export function normalizeTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

function coverKey(cover: CatalogRecordLike["cover"]): string {
  if (!cover) return "";
  return `${cover.emoji ?? ""}|${cover.color ?? ""}`;
}

function divergentFields(records: CatalogRecordLike[]): string[] {
  const fields: Array<{ name: string; of: (r: CatalogRecordLike) => string }> = [
    { name: "author", of: (r) => (r.author ?? "").trim().toLowerCase() },
    { name: "cover", of: (r) => coverKey(r.cover) },
    { name: "variantFamily", of: (r) => r.variantFamily ?? "" },
    {
      name: "categories",
      of: (r) => [...(r.categories ?? [])].sort().join(","),
    },
  ];
  return fields
    .filter((field) => new Set(records.map(field.of)).size > 1)
    .map((field) => field.name);
}

/**
 * Pick the record to keep within a same-title group: prefer a non-orphan slug,
 * then the highest published version (newest curated record), bookId as a stable
 * final tiebreak so the result is deterministic.
 */
function pickCanonical(records: CatalogRecordLike[]): CatalogRecordLike {
  const nonOrphans = records.filter((r) => !isOrphanBookSlug(r.bookId));
  const pool = nonOrphans.length > 0 ? nonOrphans : records;
  const [canonical] = [...pool].sort((a, b) => {
    const versionDelta =
      (b.currentPublishedVersion ?? 0) - (a.currentPublishedVersion ?? 0);
    if (versionDelta !== 0) return versionDelta;
    return a.bookId.localeCompare(b.bookId);
  });
  if (canonical === undefined) {
    throw new Error("pickCanonical: called with an empty record group");
  }
  return canonical;
}

/**
 * Find every group of >1 DISTINCT catalog records that share a normalized title.
 * Each group is a likely duplicate/fork (DUP-OLD-DEGRADED). Returns groups
 * sorted by title for stable output.
 */
export function findDuplicateTitleGroups(
  records: CatalogRecordLike[]
): DuplicateTitleGroup[] {
  const byTitle = new Map<string, CatalogRecordLike[]>();
  for (const record of records) {
    if (!record.bookId || !record.title) continue;
    const key = normalizeTitle(record.title);
    const bucket = byTitle.get(key);
    if (bucket) bucket.push(record);
    else byTitle.set(key, [record]);
  }

  const groups: DuplicateTitleGroup[] = [];
  for (const [normalized, bucket] of byTitle) {
    const distinctIds = new Set(bucket.map((r) => r.bookId));
    if (distinctIds.size < 2) continue;
    const canonical = pickCanonical(bucket);
    const ordered = [
      canonical,
      ...bucket.filter((r) => r.bookId !== canonical.bookId),
    ];
    groups.push({
      normalizedTitle: normalized,
      title: canonical.title,
      canonicalBookId: canonical.bookId,
      orphanBookIds: bucket
        .filter((r) => r.bookId !== canonical.bookId)
        .map((r) => r.bookId),
      records: ordered,
      divergentFields: divergentFields(bucket),
    });
  }

  return groups.sort((a, b) => a.title.localeCompare(b.title));
}

/**
 * Duplicate-title groups NOT fully explained by the alias map — i.e. at least
 * one non-canonical sibling is not a known retired slug from
 * book-slug-aliases.ts. These are the unknown/future forks the CI gate
 * (lib/catalog-integrity-gate.test.ts) fails the build on; known forks stay
 * report-only in scripts/book/reconcile-prod-catalog.ts.
 */
export function findUnknownDuplicateTitleGroups(
  records: CatalogRecordLike[]
): DuplicateTitleGroup[] {
  return findDuplicateTitleGroups(records).filter(
    (group) => !group.orphanBookIds.every(isOrphanBookSlug)
  );
}
