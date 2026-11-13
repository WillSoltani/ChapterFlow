// Reading-day bucketing (API-04 / API-23): the reading-sessions route files a
// session under the reader's local day when the client sends it and it is
// plausible, and falls back to the old server-clock key otherwise.

import { test } from "node:test";
import assert from "node:assert/strict";
import { isValidDayKey, resolveReadingDayKey } from "./day-key-core";

test("23:30 in UTC-5 files under the reader's date, not the next UTC day", () => {
  // 2026-11-12 23:30 in Toronto (EST, UTC-5) is 2026-11-13 04:30 UTC.
  const occurredAt = "2026-11-13T04:30:00.000Z";
  assert.equal(
    resolveReadingDayKey({ clientLocalDay: "2026-11-12", occurredAt, serverNow: occurredAt }),
    "2026-11-12",
  );
});

test("a reader ahead of UTC (UTC+14) keeps their local date", () => {
  const occurredAt = "2026-11-12T11:00:00.000Z";
  assert.equal(
    resolveReadingDayKey({ clientLocalDay: "2026-11-13", occurredAt, serverNow: occurredAt }),
    "2026-11-13",
  );
});

test("a client date three days off the server clock is rejected", () => {
  const serverNow = "2026-11-12T12:00:00.000Z";
  assert.equal(
    resolveReadingDayKey({ clientLocalDay: "2026-11-09", occurredAt: serverNow, serverNow }),
    "2026-11-12",
  );
  assert.equal(
    resolveReadingDayKey({ clientLocalDay: "2026-11-15", occurredAt: serverNow, serverNow }),
    "2026-11-12",
  );
});

test("a missing localDay keeps the legacy key derived from occurredAt", () => {
  // Midday UTC is the same calendar date in every zone from UTC-11 to UTC+11, so
  // this holds whatever TZ the test process runs in.
  const serverNow = "2026-11-12T12:00:00.000Z";
  assert.equal(
    resolveReadingDayKey({ clientLocalDay: undefined, occurredAt: "2026-11-10T12:00:00.000Z", serverNow }),
    "2026-11-10",
  );
  assert.equal(
    resolveReadingDayKey({ clientLocalDay: null, occurredAt: serverNow, serverNow }),
    "2026-11-12",
  );
});

test("malformed localDay values fall back to the legacy key", () => {
  const serverNow = "2026-11-12T12:00:00.000Z";
  for (const bad of ["2026-11-31", "2026-13-01", "2026-11-12T00:00", "11/12/2026", "", 20261112, {}]) {
    assert.equal(
      resolveReadingDayKey({ clientLocalDay: bad, occurredAt: serverNow, serverNow }),
      "2026-11-12",
      `value ${JSON.stringify(bad)}`,
    );
  }
});

test("an unparseable occurredAt with no localDay falls back to the server clock", () => {
  const serverNow = "2026-11-12T12:00:00.000Z";
  assert.equal(
    resolveReadingDayKey({ clientLocalDay: undefined, occurredAt: "not-a-date", serverNow }),
    "2026-11-12",
  );
});

test("isValidDayKey accepts only real YYYY-MM-DD calendar dates", () => {
  assert.equal(isValidDayKey("2028-02-29"), true);
  assert.equal(isValidDayKey("2026-02-29"), false);
  assert.equal(isValidDayKey("2026-1-01"), false);
  assert.equal(isValidDayKey(undefined), false);
});
