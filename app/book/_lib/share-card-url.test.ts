import "../../../tests/_lib/dom";

import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { performShare } from "./share-card-url";

const originalFetch = globalThis.fetch;
const nav = globalThis.navigator as unknown as Record<string, unknown>;

type FetchCall = { url: string; init?: RequestInit };
let fetchCalls: FetchCall[] = [];
let clipboardWrites: string[] = [];

const baseOpts = {
  title: "ChapterFlow",
  text: "I finished a chapter",
  url: "https://example.test/card",
  tracking: { cardType: "chapter" as const, bookId: "b1", chapterNumber: 2 },
};

function setNavigator(share: unknown) {
  Object.defineProperty(nav, "share", { configurable: true, writable: true, value: share });
  Object.defineProperty(nav, "clipboard", {
    configurable: true,
    writable: true,
    value: { writeText: async (text: string) => void clipboardWrites.push(text) },
  });
}

beforeEach(() => {
  fetchCalls = [];
  clipboardWrites = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    fetchCalls.push({ url: String(input), ...(init ? { init } : {}) });
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  Reflect.deleteProperty(nav, "share");
  Reflect.deleteProperty(nav, "clipboard");
});

test("a completed native share is tracked at the real endpoint with keepalive", async () => {
  setNavigator(async () => {});
  assert.equal(await performShare(baseOpts), "shared");
  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0]?.url, "/app/api/book/me/share-events");
  assert.equal(fetchCalls[0]?.init?.method, "POST");
  assert.equal(fetchCalls[0]?.init?.keepalive, true);
  assert.equal(clipboardWrites.length, 0);
});

test("cancelling the share sheet copies nothing and tracks nothing", async () => {
  setNavigator(async () => {
    throw new DOMException("Share canceled", "AbortError");
  });
  assert.equal(await performShare(baseOpts), "unsupported");
  assert.equal(clipboardWrites.length, 0);
  assert.equal(fetchCalls.length, 0);
});

test("a failed native share still falls back to the clipboard", async () => {
  setNavigator(async () => {
    throw new DOMException("Not allowed", "NotAllowedError");
  });
  assert.equal(await performShare(baseOpts), "copied");
  assert.equal(clipboardWrites.length, 1);
  assert.equal(fetchCalls[0]?.url, "/app/api/book/me/share-events");
});
