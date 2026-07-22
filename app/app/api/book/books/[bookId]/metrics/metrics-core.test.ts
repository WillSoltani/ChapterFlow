import assert from "node:assert/strict";
import { test } from "node:test";

import { isBookApiError } from "@/app/app/api/book/_lib/errors";

import { loadMetricsAccess } from "./metrics-core";

test("invokes catalog and progress reads concurrently", async () => {
  const order: string[] = [];
  let releaseCatalog!: (v: { currentPublishedVersion: number } | null) => void;
  let releaseProgress!: (v: unknown) => void;
  const p = loadMetricsAccess({
    getCatalogBook: () => {
      order.push("catalog");
      return new Promise((r) => (releaseCatalog = r));
    },
    getUserProgress: () => {
      order.push("progress");
      return new Promise((r) => (releaseProgress = r));
    },
  });
  assert.deepEqual(order, ["catalog", "progress"]); // both dispatched before either resolves
  releaseCatalog({ currentPublishedVersion: 3 });
  releaseProgress({});
  await p;
});

test("throws 404 book_not_found when catalog is missing or unpublished, even when progress exists", async () => {
  await assert.rejects(
    () =>
      loadMetricsAccess({
        getCatalogBook: async () => null,
        getUserProgress: async () => ({ started: true }),
      }),
    (err: unknown) => {
      assert.ok(isBookApiError(err));
      assert.equal((err as { status: number }).status, 404);
      assert.equal((err as { code: string }).code, "book_not_found");
      return true;
    }
  );

  await assert.rejects(
    () =>
      loadMetricsAccess({
        getCatalogBook: async () => ({ currentPublishedVersion: undefined }),
        getUserProgress: async () => ({ started: true }),
      }),
    (err: unknown) => {
      assert.ok(isBookApiError(err));
      assert.equal((err as { status: number }).status, 404);
      assert.equal((err as { code: string }).code, "book_not_found");
      return true;
    }
  );
});

test("throws 403 book_not_started when catalog published but progress null", async () => {
  await assert.rejects(
    () =>
      loadMetricsAccess({
        getCatalogBook: async () => ({ currentPublishedVersion: 1 }),
        getUserProgress: async () => null,
      }),
    (err: unknown) => {
      assert.ok(isBookApiError(err));
      assert.equal((err as { status: number }).status, 403);
      assert.equal((err as { code: string }).code, "book_not_started");
      return true;
    }
  );
});

test("returns catalog and progress when both present", async () => {
  const catalog = { currentPublishedVersion: 2 };
  const progress = { chaptersRead: 3 };
  const result = await loadMetricsAccess({
    getCatalogBook: async () => catalog,
    getUserProgress: async () => progress,
  });
  assert.deepEqual(result, { catalog, progress });
});
