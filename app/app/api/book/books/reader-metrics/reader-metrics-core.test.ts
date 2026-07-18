import assert from "node:assert/strict";
import { test } from "node:test";

import { collectReaderMetricEntries } from "./reader-metrics-core";

test("retains fulfilled reader metrics when one book load rejects", async () => {
  const metrics = await collectReaderMetricEntries(["healthy", "broken"], async (bookId) => {
    if (bookId === "broken") throw new Error("metrics store unavailable");
    return [bookId, { readersToday: 3 }] as const;
  });

  assert.deepEqual(metrics, { healthy: { readersToday: 3 } });
});

test("omits null authorization results and returns an empty object when nothing fulfills", async () => {
  const metrics = await collectReaderMetricEntries(["unpublished", "not-started"], async () => null);
  assert.deepEqual(metrics, {});
});
