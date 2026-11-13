import "../../tests/_lib/dom";

import assert from "node:assert/strict";
import { after, afterEach, test } from "node:test";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { invalidateBookCache, useBookQuery } from "./book-api-cache";

const KEY = "/app/api/book/me/badges";
const originalFetch = globalThis.fetch;
let version = 0;
let gets = 0;

globalThis.fetch = (async (input: RequestInfo | URL) => {
  if (String(input) === KEY) gets += 1;
  return Response.json({ version });
}) as typeof fetch;

afterEach(() => cleanup());
after(() => {
  globalThis.fetch = originalFetch;
});

function Consumer() {
  const { data } = useBookQuery<{ version: number }>(KEY);
  return <p>{data ? `version ${data.version}` : "loading"}</p>;
}

test("a mounted useBookQuery consumer refetches after invalidateBookCache", async () => {
  version = 1;
  const view = render(<Consumer />);
  await waitFor(() => view.getByText("version 1"));
  const before = gets;

  version = 2;
  act(() => invalidateBookCache(KEY));
  await waitFor(() => view.getByText("version 2"));
  assert.equal(gets, before + 1);
});
