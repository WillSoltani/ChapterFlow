import { test } from "node:test";
import assert from "node:assert/strict";

import { isBookApiError } from "./errors";
import {
  paginateArray,
  parseListPaginationParams,
} from "./list-pagination-core";

/**
 * WS4-004 — `?limit=&cursor=` pagination core. `list-pagination-core.ts`
 * holds ALL of the paging logic used by notebook/saved/notifications/reviews
 * (the route files themselves import `server-only` transitively and can't be
 * unit tested), so this suite is the load-bearing coverage for the feature.
 */

type Row = { id: string; createdAt: string; value: number };

function makeRows(count: number): Row[] {
  // Newest-first, like every list route sorts (descending createdAt) — id
  // padded so string comparisons stay stable/readable in failure output.
  return Array.from({ length: count }, (_, i) => ({
    id: `row-${String(count - i).padStart(3, "0")}`,
    createdAt: new Date(2026, 0, count - i).toISOString(),
    value: count - i,
  }));
}

test("default page is capped at defaultLimit with hasMore true and a nextCursor", () => {
  const rows = makeRows(25);
  const url = new URL("https://api.chapterflow.ca/book/me/notebook");
  const params = parseListPaginationParams(url, { defaultLimit: 10, maxLimit: 50 });
  assert.equal(params.limit, 10);
  assert.equal(params.cursor, null);

  const page = paginateArray(rows, { limit: params.limit, cursor: params.cursor });
  assert.equal(page.items.length, 10);
  assert.deepEqual(
    page.items.map((r) => r.value),
    rows.slice(0, 10).map((r) => r.value)
  );
  assert.equal(page.hasMore, true);
  assert.ok(page.nextCursor && page.nextCursor.length > 0);
});

test("second page fetchable via nextCursor and final page has hasMore false and no nextCursor", () => {
  const rows = makeRows(25);
  const limit = 10;

  const page1 = paginateArray(rows, { limit, cursor: null });
  assert.equal(page1.items.length, 10);
  assert.equal(page1.hasMore, true);

  const page2 = paginateArray(rows, { limit, cursor: page1.nextCursor });
  assert.equal(page2.items.length, 10);
  assert.deepEqual(
    page2.items.map((r) => r.value),
    rows.slice(10, 20).map((r) => r.value)
  );
  assert.equal(page2.hasMore, true);
  assert.ok(page2.nextCursor);

  const page3 = paginateArray(rows, { limit, cursor: page2.nextCursor });
  assert.equal(page3.items.length, 5);
  assert.deepEqual(
    page3.items.map((r) => r.value),
    rows.slice(20, 25).map((r) => r.value)
  );
  assert.equal(page3.hasMore, false);
  assert.equal(page3.nextCursor, null);
});

test("limit is clamped to maxLimit and rejects non-integer/negative", () => {
  const clampedUrl = new URL("https://api.chapterflow.ca/book/me/notebook?limit=5000");
  const clamped = parseListPaginationParams(clampedUrl, { defaultLimit: 20, maxLimit: 50 });
  assert.equal(clamped.limit, 50);

  const withinRangeUrl = new URL("https://api.chapterflow.ca/book/me/notebook?limit=7");
  const withinRange = parseListPaginationParams(withinRangeUrl, { defaultLimit: 20, maxLimit: 50 });
  assert.equal(withinRange.limit, 7);

  for (const badLimit of ["abc", "3.5", "-1", "0", "NaN"]) {
    const url = new URL(`https://api.chapterflow.ca/book/me/notebook?limit=${badLimit}`);
    assert.throws(
      () => parseListPaginationParams(url, { defaultLimit: 20, maxLimit: 50 }),
      (thrown: unknown) => {
        assert.ok(isBookApiError(thrown), `expected BookApiError for limit=${badLimit}`);
        assert.equal((thrown as { status: number }).status, 400);
        return true;
      }
    );
  }
});

test("malformed cursor throws BookApiError 400", () => {
  const rows = makeRows(5);

  for (const badCursor of ["not-base64-json", "!!!", "e30=", Buffer.from("[1,2,3]").toString("base64url")]) {
    assert.throws(
      () => paginateArray(rows, { limit: 2, cursor: badCursor }),
      (thrown: unknown) => {
        assert.ok(isBookApiError(thrown), `expected BookApiError for cursor=${badCursor}`);
        assert.equal((thrown as { status: number }).status, 400);
        assert.equal((thrown as { code: string }).code, "invalid_cursor");
        return true;
      }
    );
  }
});

test("cursor remains stable across identical sorted input (createdAt,id tie-break)", () => {
  // Two SEPARATE array instances with identical content/order, simulating
  // two independent fetches of an unchanged dataset (the common case between
  // two page requests a few seconds apart).
  const fetchOne = makeRows(30);
  const fetchTwo = makeRows(30);
  assert.notEqual(fetchOne, fetchTwo, "must be distinct array instances, not the same reference");

  const page1 = paginateArray(fetchOne, { limit: 12, cursor: null });
  assert.equal(page1.hasMore, true);

  // Resume against the OTHER (content-identical) array instance — proves the
  // cursor locates its position by (id, createdAt) content, not by an index
  // that only happens to be valid for the exact array object it was minted
  // against.
  const page2 = paginateArray(fetchTwo, { limit: 12, cursor: page1.nextCursor });
  assert.deepEqual(
    page2.items.map((r) => r.id),
    fetchTwo.slice(12, 24).map((r) => r.id)
  );
  assert.equal(page2.hasMore, true);

  // A cursor referencing an item that's been removed since it was minted
  // falls back to the encoded offset rather than throwing or silently
  // restarting from page one.
  const shortened = fetchTwo.slice(0, 24); // drops the tie-break item at index 11
  const page2Fallback = paginateArray(shortened, { limit: 12, cursor: page1.nextCursor });
  assert.deepEqual(
    page2Fallback.items.map((r) => r.id),
    shortened.slice(12, 24).map((r) => r.id)
  );
  assert.equal(page2Fallback.hasMore, false);
});

test("a custom cursorKey extractor paginates items whose id/createdAt fields are named differently", () => {
  type SavedRow = { bookId: string; savedAt: string };
  const rows: SavedRow[] = Array.from({ length: 15 }, (_, i) => ({
    bookId: `book-${i}`,
    savedAt: new Date(2026, 0, i + 1).toISOString(),
  }));

  const page1 = paginateArray(rows, {
    limit: 10,
    cursor: null,
    cursorKey: (r) => ({ id: r.bookId, createdAt: r.savedAt }),
  });
  assert.equal(page1.items.length, 10);
  assert.equal(page1.hasMore, true);

  const page2 = paginateArray(rows, {
    limit: 10,
    cursor: page1.nextCursor,
    cursorKey: (r) => ({ id: r.bookId, createdAt: r.savedAt }),
  });
  assert.equal(page2.items.length, 5);
  assert.equal(page2.hasMore, false);
  assert.equal(page2.nextCursor, null);
});
