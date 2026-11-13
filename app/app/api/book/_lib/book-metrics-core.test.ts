import { test } from "node:test";
import assert from "node:assert/strict";
import { aggregateMetrics, dailyReaderMarkerSk } from "./book-metrics-core";

// API-08: "readers today" counted loop completions. The daily rows now count a
// reader once per day; these tests pin the today/week aggregation shared by
// books/[bookId]/metrics and books/reader-metrics.

test("aggregateMetrics: today's row gives today's numbers, the week sums every row", () => {
  const items = [
    { dayKey: "2026-11-10", uniqueReaders: 2, loopCompletions: 5 },
    { dayKey: "2026-11-12", uniqueReaders: 3, loopCompletions: 4 },
    { dayKey: "2026-11-13", uniqueReaders: 1, loopCompletions: 6 },
  ];
  assert.deepEqual(aggregateMetrics(items, "2026-11-13"), {
    readersToday: 1,
    readersWeek: 6,
    loopsToday: 6,
    loopsWeek: 15,
  });
});

test("aggregateMetrics: no row for today gives zero today", () => {
  const items = [{ dayKey: "2026-11-12", uniqueReaders: 3, loopCompletions: 4 }];
  assert.deepEqual(aggregateMetrics(items, "2026-11-13"), {
    readersToday: 0,
    readersWeek: 3,
    loopsToday: 0,
    loopsWeek: 4,
  });
});

test("aggregateMetrics: non-numeric counters count as zero", () => {
  const items = [{ dayKey: "2026-11-13", uniqueReaders: "7", loopCompletions: null }];
  assert.deepEqual(aggregateMetrics(items, "2026-11-13"), {
    readersToday: 0,
    readersWeek: 0,
    loopsToday: 0,
    loopsWeek: 0,
  });
  assert.deepEqual(aggregateMetrics([], "2026-11-13"), {
    readersToday: 0,
    readersWeek: 0,
    loopsToday: 0,
    loopsWeek: 0,
  });
});

test("dailyReaderMarkerSk is per day and per reader, outside the DAY# row range", () => {
  assert.equal(dailyReaderMarkerSk("2026-11-13", "user-1"), "METRICSREADER#2026-11-13#user-1");
  assert.notEqual(
    dailyReaderMarkerSk("2026-11-13", "user-1"),
    dailyReaderMarkerSk("2026-11-14", "user-1"),
  );
  // The KPI query reads SK BETWEEN DAY#<start> AND DAY#<end>; a marker must
  // never fall inside that range.
  const marker = dailyReaderMarkerSk("2026-11-13", "user-1");
  assert.ok(!(marker >= "DAY#2026-11-06" && marker <= "DAY#2026-11-13"));
});
