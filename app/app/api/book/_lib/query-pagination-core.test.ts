import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_QUERY_PAGES,
  paginateQuery,
  type QueryPage,
} from "./query-pagination-core";

/**
 * Regression for H19: `listBookVersions` (and every full-partition list in
 * repo.ts) routes through `queryAllItems`, whose page-following loop is this
 * core. A single DynamoDB Query returns at most 1MB; without following
 * `LastEvaluatedKey` the list silently drops everything past the first page.
 * The pre-fix `listBookVersions` issued one un-paginated QueryCommand, so a
 * book with enough VERSION# items lost its oldest versions — which would make
 * the ingestion idempotency check miss an existing packageId and allocate a
 * duplicate version. These tests pin the loop behavior the fix relies on.
 */

function makePage(
  items: Record<string, unknown>[],
  lastEvaluatedKey?: Record<string, unknown>
): QueryPage {
  return { items, lastEvaluatedKey };
}

test("paginateQuery returns the single page when there is no LastEvaluatedKey", async () => {
  const calls: (Record<string, unknown> | undefined)[] = [];
  const result = await paginateQuery(async (start) => {
    calls.push(start);
    return makePage([{ version: 3 }, { version: 2 }, { version: 1 }]);
  });

  assert.deepEqual(result, [{ version: 3 }, { version: 2 }, { version: 1 }]);
  // Only one fetch, and the first call gets an undefined ExclusiveStartKey.
  assert.equal(calls.length, 1);
  assert.equal(calls[0], undefined);
});

test("paginateQuery follows LastEvaluatedKey across all pages (does NOT truncate)", async () => {
  // Three pages — the pre-fix single-Query path would have returned only page 1.
  const pages: QueryPage[] = [
    makePage([{ version: 9 }, { version: 8 }], { SK: "VERSION#8" }),
    makePage([{ version: 7 }, { version: 6 }], { SK: "VERSION#6" }),
    makePage([{ version: 5 }, { version: 4 }]),
  ];
  const seenStartKeys: (Record<string, unknown> | undefined)[] = [];
  let idx = 0;

  const result = await paginateQuery(async (start) => {
    seenStartKeys.push(start);
    return pages[idx++]!;
  });

  // Every item from every page, in page+intra-page order (newest-first preserved
  // because each page resumes from the prior page's ExclusiveStartKey).
  assert.deepEqual(
    result.map((r) => r.version),
    [9, 8, 7, 6, 5, 4]
  );
  // The loop threaded each page's LastEvaluatedKey into the next fetch.
  assert.deepEqual(seenStartKeys, [
    undefined,
    { SK: "VERSION#8" },
    { SK: "VERSION#6" },
  ]);
});

test("paginateQuery stops at the page cap even if LastEvaluatedKey never clears", async () => {
  let fetches = 0;
  // Every page reports another LastEvaluatedKey — a runaway/pathological partition.
  const result = await paginateQuery(async () => {
    fetches += 1;
    return makePage([{ n: fetches }], { SK: `cursor-${fetches}` });
  }, 3);

  assert.equal(fetches, 3, "must stop at the supplied page cap");
  assert.deepEqual(
    result.map((r) => r.n),
    [1, 2, 3]
  );
});

test("default page cap is MAX_QUERY_PAGES and bounds an unending cursor", async () => {
  assert.equal(MAX_QUERY_PAGES, 50);
  let fetches = 0;
  await paginateQuery(async () => {
    fetches += 1;
    return makePage([{ n: fetches }], { SK: `cursor-${fetches}` });
  });
  assert.equal(fetches, MAX_QUERY_PAGES);
});

test("paginateQuery tolerates a page with missing items array", async () => {
  const pages: QueryPage[] = [
    { items: undefined as unknown as Record<string, unknown>[], lastEvaluatedKey: { SK: "next" } },
    makePage([{ version: 1 }]),
  ];
  let idx = 0;
  const result = await paginateQuery(async () => pages[idx++]!);
  assert.deepEqual(result, [{ version: 1 }]);
});
