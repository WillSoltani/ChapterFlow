import "../../../../tests/_lib/dom";

import assert from "node:assert/strict";
import { after, afterEach, before, test } from "node:test";
import { cleanup, renderHook } from "@testing-library/react";
import { installRouteHarness, makeSpy } from "@/tests/_lib/route-harness";

// API-04: each reading-session POST carries the reader's local calendar day.
const fetchBookJson = makeSpy(async (_url: string, _init?: { body?: string }) => ({}));

const harness = installRouteHarness({
  "@/app/book/_lib/book-api": { fetchBookJson },
});

let useReadingSessionTracker: typeof import("./useReadingSessionTracker").useReadingSessionTracker;

before(async () => {
  ({ useReadingSessionTracker } = await import("./useReadingSessionTracker"));
});

afterEach(cleanup);

after(() => {
  harness.restore();
});

test("a flushed session sends localDay as the reader's local YYYY-MM-DD", async () => {
  const view = renderHook(() =>
    useReadingSessionTracker({ bookId: "book-1", chapterId: "book-1-ch01" })
  );
  await new Promise((resolve) => setTimeout(resolve, 25));
  view.unmount(); // cleanup flushes the elapsed time

  assert.equal(fetchBookJson.calls.length, 1);
  const body = JSON.parse(fetchBookJson.calls[0]?.[1]?.body ?? "{}") as {
    occurredAt?: string;
    localDay?: string;
  };
  const occurred = new Date(body.occurredAt ?? "");
  const expected = `${occurred.getFullYear()}-${String(occurred.getMonth() + 1).padStart(2, "0")}-${String(occurred.getDate()).padStart(2, "0")}`;
  assert.equal(body.localDay, expected);
});
