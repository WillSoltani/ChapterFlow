import "../../../tests/_lib/dom";

import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { invalidateBookCache } from "@/lib/client/book-api-cache";
import { useBookProfile } from "./useBookProfile";

// DATA-06 (profile): an edit made just before leaving the page still reaches
// the account, once.

type Call = { url: string; method: string; body: unknown; keepalive: boolean };
let calls: Call[] = [];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

globalThis.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
  const method = (init.method ?? "GET").toUpperCase();
  calls.push({
    url: String(input),
    method,
    body: typeof init.body === "string" ? JSON.parse(init.body) : undefined,
    keepalive: init.keepalive === true,
  });
  if (method === "GET") return json({ profile: { displayName: "Maya" } });
  return json({ profile: {} });
}) as typeof fetch;

const SEED = { displayName: "Maya", pronouns: "", createdAt: "2026-01-01T00:00:00.000Z" };
const patches = () => calls.filter((c) => c.method === "PATCH");

beforeEach(() => {
  calls = [];
  window.localStorage.clear();
  invalidateBookCache("/app/api/book/me/profile");
});

afterEach(() => cleanup());

async function mountReady() {
  const view = renderHook(() => useBookProfile(SEED));
  await waitFor(() => assert.ok(calls.some((c) => c.method === "GET")), { timeout: 5000 });
  // let the GET land and serverReady flip (generous: the suite runs in parallel)
  await act(async () => {
    await new Promise((r) => setTimeout(r, 300));
  });
  return view;
}

test("unmount inside the debounce sends the pending edit once", async () => {
  const view = await mountReady();
  act(() => view.result.current.patch({ tagline: "Reading daily" }));
  view.unmount();
  await new Promise((r) => setTimeout(r, 400));
  const sent = patches();
  assert.equal(sent.length, 1);
  assert.equal((sent[0]!.body as { profile: { tagline: string } }).profile.tagline, "Reading daily");
  assert.equal(sent[0]!.keepalive, true);
});

test("pagehide sends the pending edit; the debounce does not send it again", async () => {
  const view = await mountReady();
  act(() => view.result.current.patch({ tagline: "Before leaving" }));
  act(() => {
    window.dispatchEvent(new Event("pagehide"));
  });
  await new Promise((r) => setTimeout(r, 400));
  assert.equal(patches().length, 1);
  view.unmount();
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(patches().length, 1);
});

test("no edit, no write on unmount", async () => {
  const view = await mountReady();
  view.unmount();
  await new Promise((r) => setTimeout(r, 300));
  assert.equal(patches().length, 0);
});
