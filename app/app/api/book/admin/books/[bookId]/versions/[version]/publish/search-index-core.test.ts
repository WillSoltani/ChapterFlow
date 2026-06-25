import { test } from "node:test";
import assert from "node:assert/strict";

import {
  decideSearchIndexWrite,
  type SearchIndexRebuildStats,
} from "./search-index-core";

function stats(
  partial: Partial<SearchIndexRebuildStats> = {},
): SearchIndexRebuildStats {
  return {
    booksConsidered: partial.booksConsidered ?? 10,
    documentCount: partial.documentCount ?? 100,
    failures: partial.failures ?? [],
  };
}

test("writes the index when there are zero read failures", () => {
  const decision = decideSearchIndexWrite(
    stats({ booksConsidered: 12, documentCount: 240, failures: [] }),
  );
  assert.deepEqual(decision, { write: true });
});

test("REFUSES the write when a per-book manifest read failed (no silent stale overwrite)", () => {
  const decision = decideSearchIndexWrite(
    stats({
      booksConsidered: 12,
      documentCount: 200,
      failures: [
        { scope: "manifest", bookId: "atomic-habits", message: "AccessDenied" },
      ],
    }),
  );
  assert.equal(decision.write, false);
  // The old code returned no decision at all and unconditionally PutObject'd —
  // this assertion fails against that behavior and passes after the fix.
  assert.equal(decision.write === false && decision.code, "search_index_rebuild_incomplete");
  if (decision.write === false) {
    assert.equal(decision.details.failureCount, 1);
    assert.equal(decision.details.booksConsidered, 12);
    assert.equal(decision.details.documentCount, 200);
  }
});

test("REFUSES the write when a per-chapter read failed", () => {
  const decision = decideSearchIndexWrite(
    stats({
      failures: [
        {
          scope: "chapter",
          bookId: "deep-work",
          chapterNumber: 3,
          message: "timeout",
        },
      ],
    }),
  );
  assert.equal(decision.write, false);
  if (decision.write === false) {
    assert.equal(decision.details.failureCount, 1);
    assert.equal(decision.details.failures[0].scope, "chapter");
    assert.equal(decision.details.failures[0].chapterNumber, 3);
  }
});

test("a single failure among many successful reads still aborts the write", () => {
  // The defect: 1 transient failure across many books silently shipped a thinner
  // index. The fix must abort even when most reads succeeded.
  const decision = decideSearchIndexWrite(
    stats({
      booksConsidered: 50,
      documentCount: 4900,
      failures: [
        { scope: "manifest", bookId: "one-bad-book", message: "ServiceUnavailable" },
      ],
    }),
  );
  assert.equal(decision.write, false);
});

test("inlined failure list is capped but the exact count is preserved", () => {
  const failures = Array.from({ length: 60 }, (_, i) => ({
    scope: "chapter" as const,
    bookId: `book-${i}`,
    chapterNumber: i,
    message: "read failed",
  }));
  const decision = decideSearchIndexWrite(stats({ failures }));
  assert.equal(decision.write, false);
  if (decision.write === false) {
    assert.equal(decision.details.failureCount, 60);
    // Capped to avoid an unbounded response/log payload.
    assert.equal(decision.details.failures.length, 25);
  }
});
