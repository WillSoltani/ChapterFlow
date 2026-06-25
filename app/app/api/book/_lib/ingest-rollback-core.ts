import { bookMetaSk, bookPk, catalogPk, catalogSk } from "./keys";

/**
 * Pure item-shaping + rollback-planning seam for the META/CATALOG pointer pair
 * written at the end of `ingestBookPackageFromS3`.
 *
 * Why this exists (cluster "ingest-rollback", finding B5):
 * `upsertBookMetaAndCatalog` advances the book's META and BOOK_CATALOG rows to a
 * brand-new `latestVersion`/`currentPublishedVersion`. That write was the last op
 * inside the ingest try-block, but the ingest `catch` only deleted the content
 * prefix + the VERSION draft row — it never touched META/CATALOG. So a failure
 * that left META/CATALOG pointing at the just-deleted version stranded the book:
 * `readManifest` resolves `currentPublishedVersion` -> a VERSION row that no
 * longer exists -> the whole book 500s with no published content behind it.
 *
 * Two independent gaps made that reachable:
 *   1. The two PUTs (META then CATALOG) were not atomic, so META could advance
 *      while CATALOG threw (throttle / transient), diverging the pair.
 *   2. Even a fully-successful pointer advance was never reverted on a later
 *      rollback, since the catch ignored META/CATALOG entirely.
 *
 * Fix: write META+CATALOG in a single TransactWrite (gap 1) and, before that
 * write, snapshot the prior META+CATALOG so the catch can restore the previous
 * pointer — or delete a freshly-created pointer that had no prior — on rollback
 * (gap 2). This module owns the deterministic decisions for both halves so they
 * can be unit-tested without `server-only`/AWS imports (mirrors
 * `ingestion-publish-policy.ts` / `account-guard-policy.ts`).
 */

export type BookCover = { emoji?: string; color?: string };

export interface BookMetaCatalogFields {
  bookId: string;
  title: string;
  author: string;
  categories: string[];
  tags: string[];
  cover?: BookCover;
  variantFamily: "EMH" | "PBC";
  latestVersion: number;
  currentPublishedVersion?: number;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
}

export type DdbItem = Record<string, unknown>;

/**
 * Build the META and CATALOG DynamoDB item shapes for a meta/catalog upsert.
 * Both rows carry identical denormalized fields and the same `updatedAt`, keyed
 * differently (META lives under the book PK; CATALOG under the catalog PK). The
 * caller supplies `updatedAt` so the same timestamp lands on both rows even when
 * they go out in one transaction.
 */
export function buildBookMetaAndCatalogItems(
  params: BookMetaCatalogFields,
  updatedAt: string
): { metaItem: DdbItem; catalogItem: DdbItem } {
  const shared = {
    bookId: params.bookId,
    title: params.title,
    author: params.author,
    categories: params.categories,
    tags: params.tags,
    cover: params.cover,
    variantFamily: params.variantFamily,
    latestVersion: params.latestVersion,
    currentPublishedVersion: params.currentPublishedVersion,
    status: params.status,
    updatedAt,
  };

  return {
    metaItem: {
      PK: bookPk(params.bookId),
      SK: bookMetaSk(),
      entity: "BOOK_META",
      ...shared,
    },
    catalogItem: {
      PK: catalogPk(),
      SK: catalogSk(params.bookId),
      entity: "BOOK_CATALOG",
      ...shared,
    },
  };
}

/**
 * A snapshot of the META + CATALOG rows captured just before an ingest advances
 * them, so an ingest rollback can put the book's pointer back exactly where it
 * was. `null` means "no row existed" (a first-ever ingest for this bookId).
 */
export interface MetaCatalogSnapshot {
  meta: DdbItem | null;
  catalog: DdbItem | null;
}

export type MetaCatalogRollbackPlan =
  | { kind: "noop" }
  | { kind: "restore"; meta: DdbItem | null; catalog: DdbItem | null }
  | { kind: "delete" };

/**
 * Decide how to undo the META/CATALOG pointer advance on an ingest rollback.
 *
 * - `wrotePointer === false`: the upsert never ran (failure happened earlier in
 *   the try), so there is nothing to revert. -> noop.
 * - prior META or CATALOG existed: restore each prior row exactly. -> restore.
 * - neither existed before: the ingest created the very first pointer for this
 *   book, so deleting it (rather than leaving it pointing at the now-deleted
 *   version) returns the table to its pre-ingest state. -> delete.
 *
 * A `restore` carries each prior row independently: if only one of META/CATALOG
 * existed before (a partially-initialized book), the missing side is delete-d
 * and the present side is put back, so the pair ends up in its exact prior shape.
 */
export function planMetaCatalogRollback(
  snapshot: MetaCatalogSnapshot,
  wrotePointer: boolean
): MetaCatalogRollbackPlan {
  if (!wrotePointer) return { kind: "noop" };
  if (snapshot.meta || snapshot.catalog) {
    return { kind: "restore", meta: snapshot.meta, catalog: snapshot.catalog };
  }
  return { kind: "delete" };
}
