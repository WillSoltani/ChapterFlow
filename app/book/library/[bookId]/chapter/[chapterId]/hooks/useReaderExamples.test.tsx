import "../../../../../../../tests/_lib/dom";

import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { act, cleanup, renderHook } from "@testing-library/react";
import { fetchBookJsonCached, invalidateBookCache } from "@/lib/client/book-api-cache";
import { COMMITMENTS_KEY } from "@/lib/client/book-read-keys";
import { useReaderExamples } from "./useReaderExamples";

type Call = { method: string; url: string };

const realFetch = globalThis.fetch;
let calls: Call[] = [];
let postReplies: Array<{ status: number; body: unknown }> = [];
let listed: unknown[] = [];

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  calls = [];
  postReplies = [];
  listed = [];
  invalidateBookCache(COMMITMENTS_KEY);
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    calls.push({ method, url });
    if (url.endsWith("/me/commitments") && method === "POST") {
      const reply = postReplies.shift() ?? { status: 200, body: { commitment: {}, created: true } };
      return json(reply.status, reply.body);
    }
    if (url.endsWith("/me/commitments")) return json(200, { commitments: listed });
    return json(200, {});
  }) as typeof fetch;
});

afterEach(() => {
  cleanup();
  globalThis.fetch = realFetch;
});

const commitment = {
  commitmentId: "c1",
  bookId: "atomic-habits",
  chapterNumber: 2,
  status: "active",
  ifThenPlan: "If X then Y",
  followUpDate: "2099-01-01T00:00:00.000Z",
};

const params = {
  bookId: "atomic-habits",
  chapterNumber: 2,
  ifThenPlan: "If X then Y",
  followUpDays: 3 as const,
};

function mount() {
  return renderHook(() =>
    useReaderExamples({
      bookId: "atomic-habits",
      enabled: true,
      exampleFilter: "all",
      setExampleFilter: () => {},
      onToast: () => {},
    }),
  );
}

const commitmentGets = () =>
  calls.filter((call) => call.method === "GET" && call.url.endsWith("/me/commitments")).length;
const commitmentPosts = () =>
  calls.filter((call) => call.method === "POST" && call.url.endsWith("/me/commitments")).length;

test("READER-14: a commitment that already exists re-reads the list instead of serving the cached one", async () => {
  await fetchBookJsonCached(COMMITMENTS_KEY); // the list read before committing: empty
  assert.equal(commitmentGets(), 1);
  listed = [commitment];
  postReplies = [{ status: 409, body: { error: { code: "commitment_exists", message: "exists" } } }];
  const view = mount();
  await act(() => view.result.current.handleCommitment(params));
  assert.equal(commitmentGets(), 2, "the commitments list is fetched again, not served from cache");
  assert.equal(view.result.current.committedToChapter, true);
});

test("READER-14: a new commitment refreshes the list from the server", async () => {
  await fetchBookJsonCached(COMMITMENTS_KEY);
  listed = [commitment];
  const view = mount();
  await act(() => view.result.current.handleCommitment(params));
  assert.equal(commitmentPosts(), 1);
  assert.equal(commitmentGets(), 2);
  assert.equal(view.result.current.committedToChapter, true);
});

test("READER-14: a commitment still being saved is tried once more after a short wait", async () => {
  postReplies = [
    { status: 409, body: { error: { code: "idempotency_in_progress", message: "busy" } } },
    { status: 200, body: { commitment, created: true } },
  ];
  listed = [commitment];
  const view = mount();
  await act(() => view.result.current.handleCommitment(params));
  assert.equal(commitmentPosts(), 2);
  assert.equal(view.result.current.committedToChapter, true);
});
