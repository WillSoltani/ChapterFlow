import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BOOK_PACKAGE_MISSING_TTL_MS,
  BOOK_PACKAGE_TTL_MS,
  createExpiringPackageCache,
} from "./book-package-cache-core";

// API-15: the server cached book packages forever, so a republished book's
// quiz kept the old questions until the server restarted, and a package that
// was missing once stayed missing. These tests drive the cache with a fake clock.

function clock(start = 1_000_000) {
  let t = start;
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms;
    },
  };
}

test("TTLs are 5 minutes for a package and 60 seconds for a missing one", () => {
  assert.equal(BOOK_PACKAGE_TTL_MS, 300_000);
  assert.equal(BOOK_PACKAGE_MISSING_TTL_MS, 60_000);
});

test("an unknown key is a miss", () => {
  const cache = createExpiringPackageCache<{ v: number }>({ now: clock().now });
  assert.deepEqual(cache.get("book-a"), { hit: false });
});

test("a cached package is served until 5 minutes pass, then refetched", () => {
  const c = clock();
  const cache = createExpiringPackageCache<{ v: number }>({ now: c.now });
  cache.set("book-a", { v: 1 });
  assert.deepEqual(cache.get("book-a"), { hit: true, value: { v: 1 } });
  c.advance(BOOK_PACKAGE_TTL_MS - 1);
  assert.deepEqual(cache.get("book-a"), { hit: true, value: { v: 1 } });
  c.advance(1);
  assert.deepEqual(cache.get("book-a"), { hit: false });
  cache.set("book-a", { v: 2 });
  assert.deepEqual(cache.get("book-a"), { hit: true, value: { v: 2 } });
});

test("a missing package is remembered for 60 seconds only", () => {
  const c = clock();
  const cache = createExpiringPackageCache<{ v: number }>({ now: c.now });
  cache.set("book-b", null);
  assert.deepEqual(cache.get("book-b"), { hit: true, value: null });
  c.advance(BOOK_PACKAGE_MISSING_TTL_MS - 1);
  assert.deepEqual(cache.get("book-b"), { hit: true, value: null });
  c.advance(1);
  assert.deepEqual(cache.get("book-b"), { hit: false });
});

test("entries expire independently", () => {
  const c = clock();
  const cache = createExpiringPackageCache<{ v: number }>({ now: c.now });
  cache.set("book-a", { v: 1 });
  c.advance(BOOK_PACKAGE_TTL_MS - 1000);
  cache.set("book-c", { v: 3 });
  c.advance(1000);
  assert.deepEqual(cache.get("book-a"), { hit: false });
  assert.deepEqual(cache.get("book-c"), { hit: true, value: { v: 3 } });
});
