import "../../tests/_lib/dom";

import assert from "node:assert/strict";
import { useEffect } from "react";
import { after, afterEach, test } from "node:test";
import { cleanup, render, waitFor } from "@testing-library/react";
import { invalidateBookCache, useBookQuery } from "./book-api-cache";

const KEY = "/app/api/book/me/badges";
const originalFetch = globalThis.fetch;
let gets = 0;

globalThis.fetch = (async (input: RequestInfo | URL) => {
  if (String(input) === KEY) gets += 1;
  return Response.json({ awards: [] });
}) as typeof fetch;

afterEach(() => cleanup());
after(() => {
  globalThis.fetch = originalFetch;
});

// Some screens write and then invalidate their own key each time a read comes
// back without the write in it yet (useBadgeSystem does this for new badges).
// Until those screens invalidate only after their write has landed, an
// invalidation must not make a mounted consumer reload on its own, or the two
// feed each other.
function SelfInvalidatingConsumer() {
  const { data } = useBookQuery<{ awards: unknown[] }>(KEY);
  useEffect(() => {
    if (data) invalidateBookCache(KEY);
  }, [data]);
  return <p>{data ? "loaded" : "loading"}</p>;
}

test("a screen that invalidates its own key after every read does not refetch in a loop", async () => {
  const before = gets;
  const view = render(<SelfInvalidatingConsumer />);
  await waitFor(() => view.getByText("loaded"));
  await new Promise((resolve) => setTimeout(resolve, 200));
  const requests = gets - before;
  assert.ok(requests <= 2, `expected at most 2 GETs, saw ${requests}`);
});
