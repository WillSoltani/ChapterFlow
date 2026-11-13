import "./_lib/dom";

import assert from "node:assert/strict";
import { after, afterEach, before, test } from "node:test";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { installRouteHarness, makeSpy } from "./_lib/route-harness";

// PROG-07 / DATA-07: analytics render from the dashboard payload alone; no
// other request may hold them back.
const neverSettles = new Promise<never>(() => {});
const fetchBookJson = makeSpy(async (_url: string) => neverSettles);

const payload = {
  catalog: [],
  progress: [],
  bookStates: [],
  chapterStates: [],
  readingDays: [],
  badgeAwards: [],
  settings: null,
};

const harness = installRouteHarness({
  "@/lib/client/book-api": { fetchBookJson },
  "@/hooks/book/useDashboardQuery": {
    useDashboardQuery: () => ({ data: payload, error: undefined, refetch: () => {} }),
  },
});

let useBookAnalytics: typeof import("@/hooks/book/useBookAnalytics").useBookAnalytics;

before(async () => {
  ({ useBookAnalytics } = await import("@/hooks/book/useBookAnalytics"));
});

afterEach(cleanup);

after(() => {
  harness.restore();
});

test("analytics are set as soon as the dashboard payload is available", async () => {
  const view = renderHook(() => useBookAnalytics([], 10));
  await waitFor(() => assert.notEqual(view.result.current.analytics, null), { timeout: 500 });
  assert.equal(view.result.current.hydrated, true);
  assert.equal(fetchBookJson.calls.length, 0);
});
