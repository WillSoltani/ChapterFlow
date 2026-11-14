import "./_lib/dom";

import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, test } from "node:test";
import { act, cleanup, renderHook } from "@testing-library/react";
import { installRouteHarness, makeSpy } from "@/tests/_lib/route-harness";

// HOME-12 / DATA-09: saving a book must not trigger a refetch of the saved list
// before the write, or a stale list can flip the bookmark back.

const log: string[] = [];
let writeImpl: () => Promise<unknown> = async () => ({});
const fetchBookJson = makeSpy(async (_url: string, init?: { method?: string }) => {
  log.push(`write:${init?.method ?? "GET"}`);
  return writeImpl();
});
const emitBookStorageChanged = makeSpy((scope: string) => {
  log.push(`emit:${scope}`);
});
const savedData = {
  saved: [{ bookId: "deep-work", savedAt: "2026-11-01T00:00:00.000Z", updatedAt: "2026-11-01T00:00:00.000Z" }],
};
const query = { data: savedData, error: undefined, loading: false, refetch: () => {} };

const harness = installRouteHarness({
  "@/lib/client/book-api": { fetchBookJson },
  "@/lib/client/book-storage-events": { emitBookStorageChanged },
  "@/lib/client/book-api-cache": {
    useBookQuery: () => query,
    invalidateBookCache: () => {
      log.push("invalidate");
    },
  },
});

let useSavedBooks: typeof import("@/hooks/book/useSavedBooks").useSavedBooks;

before(async () => {
  ({ useSavedBooks } = await import("@/hooks/book/useSavedBooks"));
});

beforeEach(() => {
  log.length = 0;
  writeImpl = async () => ({});
  fetchBookJson.calls.length = 0;
  emitBookStorageChanged.calls.length = 0;
});

afterEach(cleanup);

after(() => {
  harness.restore();
});

test("saving writes first; the saved list is refreshed only after the write", async () => {
  const view = renderHook(() => useSavedBooks(true));
  let result: { saved: boolean; error: string | null } | undefined;
  await act(async () => {
    result = await view.result.current.toggleSaved("atomic-habits", { source: "book-detail" });
  });
  assert.deepEqual(result, { saved: true, error: null });
  assert.equal(log[0], "write:PUT");
  assert.ok(log.indexOf("emit:saved-books") > log.indexOf("write:PUT"));
});

test("while the write is in flight the bookmark stays on and nothing refetches", async () => {
  let release: () => void = () => {};
  writeImpl = () => new Promise<unknown>((resolve) => { release = () => resolve({}); });
  const view = renderHook(() => useSavedBooks(true));
  let pending: Promise<unknown> = Promise.resolve();
  act(() => {
    pending = view.result.current.toggleSaved("atomic-habits");
  });
  assert.equal(view.result.current.savedSet.has("atomic-habits"), true);
  assert.equal(emitBookStorageChanged.calls.length, 0);
  await act(async () => {
    release();
    await pending;
  });
});

test("a failed write rolls back and returns the error for the caller to show", async () => {
  writeImpl = async () => {
    throw new Error("offline");
  };
  const view = renderHook(() => useSavedBooks(true));
  let result: { saved: boolean; error: string | null } | undefined;
  await act(async () => {
    result = await view.result.current.toggleSaved("deep-work");
  });
  assert.equal(log[0], "write:DELETE");
  assert.equal(result?.saved, true);
  assert.equal(result?.error, "offline");
  assert.equal(view.result.current.savedSet.has("deep-work"), true);
});
