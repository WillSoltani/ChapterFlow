import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildBookMetaAndCatalogItems,
  planMetaCatalogRollback,
  type BookMetaCatalogFields,
  type MetaCatalogSnapshot,
} from "./ingest-rollback-core";

const FIELDS: BookMetaCatalogFields = {
  bookId: "atomic-habits",
  title: "Atomic Habits",
  author: "James Clear",
  categories: ["Self-Help"],
  tags: ["habits"],
  cover: { emoji: "📘", color: "#000" },
  variantFamily: "EMH",
  latestVersion: 3,
  currentPublishedVersion: 3,
  status: "PUBLISHED",
};

// --- buildBookMetaAndCatalogItems -----------------------------------------

test("META and CATALOG carry the SAME version pointer (they must move together)", () => {
  const { metaItem, catalogItem } = buildBookMetaAndCatalogItems(FIELDS, "2026-06-24T00:00:00.000Z");

  // The whole point of the TransactWrite is that these two rows never diverge.
  // If a future edit lets the pointer fields drift between them, this fails.
  assert.equal(metaItem.latestVersion, catalogItem.latestVersion);
  assert.equal(metaItem.currentPublishedVersion, catalogItem.currentPublishedVersion);
  assert.equal(metaItem.status, catalogItem.status);
  assert.equal(metaItem.updatedAt, catalogItem.updatedAt);
});

test("META and CATALOG are keyed distinctly with the right entity discriminators", () => {
  const { metaItem, catalogItem } = buildBookMetaAndCatalogItems(FIELDS, "ts");

  assert.equal(metaItem.PK, "BOOK#atomic-habits");
  assert.equal(metaItem.SK, "META");
  assert.equal(metaItem.entity, "BOOK_META");

  assert.equal(catalogItem.PK, "BOOKCATALOG");
  assert.equal(catalogItem.SK, "BOOK#atomic-habits");
  assert.equal(catalogItem.entity, "BOOK_CATALOG");
});

test("a DRAFT ingest leaves currentPublishedVersion undefined on both rows", () => {
  const { metaItem, catalogItem } = buildBookMetaAndCatalogItems(
    { ...FIELDS, status: "DRAFT", currentPublishedVersion: undefined },
    "ts"
  );
  assert.equal(metaItem.currentPublishedVersion, undefined);
  assert.equal(catalogItem.currentPublishedVersion, undefined);
  assert.equal(metaItem.status, "DRAFT");
});

// --- planMetaCatalogRollback ----------------------------------------------

const PRIOR_META = { PK: "BOOK#atomic-habits", SK: "META", currentPublishedVersion: 2 };
const PRIOR_CATALOG = { PK: "BOOKCATALOG", SK: "BOOK#atomic-habits", currentPublishedVersion: 2 };

test("rollback is a noop when the META/CATALOG pointer was never advanced", () => {
  // Failure happened before upsertBookMetaAndCatalog ran: nothing to revert.
  const snapshot: MetaCatalogSnapshot = { meta: PRIOR_META, catalog: PRIOR_CATALOG };
  assert.deepEqual(planMetaCatalogRollback(snapshot, false), { kind: "noop" });
});

test("REGRESSION: with a prior pointer, rollback RESTORES the previous version (does not strand the book)", () => {
  // The bug: ingest advanced META/CATALOG to v3, then a failure deleted v3's
  // content + VERSION row but left META/CATALOG pointing at the now-deleted v3.
  // Rollback must put the pointer back to the prior v2 rows verbatim.
  const snapshot: MetaCatalogSnapshot = { meta: PRIOR_META, catalog: PRIOR_CATALOG };
  const plan = planMetaCatalogRollback(snapshot, true);

  assert.equal(plan.kind, "restore");
  if (plan.kind !== "restore") return; // narrow
  assert.deepEqual(plan.meta, PRIOR_META);
  assert.deepEqual(plan.catalog, PRIOR_CATALOG);
  // Crucially NOT pointing at the deleted version — it carries the prior rows.
  assert.equal((plan.meta as Record<string, unknown>).currentPublishedVersion, 2);
});

test("REGRESSION: a first-ever ingest with no prior pointer DELETES the orphaned pointer on rollback", () => {
  // No META/CATALOG existed before, so the ingest created the very first pointer.
  // Leaving it would point at a deleted version; deleting it returns the table
  // to its exact pre-ingest (empty) state.
  const snapshot: MetaCatalogSnapshot = { meta: null, catalog: null };
  assert.deepEqual(planMetaCatalogRollback(snapshot, true), { kind: "delete" });
});

test("a partially-initialized book (only one side existed) restores the present side", () => {
  // restore carries each side independently; the absent side is cleared by the
  // caller so the pair ends in its exact prior shape.
  const snapshot: MetaCatalogSnapshot = { meta: PRIOR_META, catalog: null };
  const plan = planMetaCatalogRollback(snapshot, true);
  assert.equal(plan.kind, "restore");
  if (plan.kind !== "restore") return;
  assert.deepEqual(plan.meta, PRIOR_META);
  assert.equal(plan.catalog, null);
});
