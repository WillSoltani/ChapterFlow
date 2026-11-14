import "../../../tests/_lib/dom";

import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { act, cleanup, renderHook } from "@testing-library/react";
import { fetchBookJsonCached, invalidateBookCache, peekBookCache } from "@/lib/client/book-api-cache";
import { applyAndPersistDocumentTheme } from "@/app/_lib/document-theme";
import { useThemePreference } from "@/app/hooks/useThemePreference";
import { useReaderSettings } from "@/app/book/library/[bookId]/chapter/[chapterId]/hooks/useReaderSettings";
import { defaultBookPreferencesState, useBookPreferences } from "./useBookPreferences";

const STORAGE_KEY = "book-accelerator:preferences:v2";
const LAST_SYNCED_KEY = "book-accelerator:preferences:last-synced-at:v2";

type Call = { url: string; method: string; body: unknown; keepalive?: boolean | undefined };

let calls: Call[] = [];
let serverSettings: { settings: Record<string, unknown> | null; updatedAt: string | null } = {
  settings: null,
  updatedAt: null,
};
// When set, the settings GET waits for this promise before answering.
let settingsGetGate: Promise<void> | null = null;
let failWrites = false;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

globalThis.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
  const url = String(input);
  const method = (init.method ?? "GET").toUpperCase();
  calls.push({
    url,
    method,
    body: typeof init.body === "string" ? JSON.parse(init.body) : undefined,
    keepalive: init.keepalive,
  });
  if (method === "GET" && url.endsWith("/me/settings")) {
    if (settingsGetGate) await settingsGetGate;
    return json(serverSettings);
  }
  if (method !== "GET") {
    if (failWrites) return json({ error: "unavailable" }, 503);
    return json({ settings: {}, updatedAt: new Date().toISOString() });
  }
  return json({ error: "not_found" }, 404);
}) as typeof fetch;

async function wait(ms: number) {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

function writes() {
  return calls.filter(
    (c) => c.method !== "GET" && (c.url.endsWith("/me/settings") || c.url.endsWith("/me/profile")),
  );
}

beforeEach(() => {
  calls = [];
  serverSettings = { settings: null, updatedAt: null };
  settingsGetGate = null;
  failWrites = false;
  window.localStorage.clear();
  invalidateBookCache("/app/api/book/me");
});

afterEach(() => {
  cleanup();
});

test("DATA-02: mounting on a fresh browser issues zero writes", async () => {
  renderHook(() => useBookPreferences());
  await wait(900);
  assert.deepEqual(writes(), []);
});

test("DATA-02: mounting with a local copy and an older server copy issues zero writes", async () => {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ ...defaultBookPreferencesState, reading: { ...defaultBookPreferencesState.reading, fontSize: 22 } }),
  );
  window.localStorage.setItem(LAST_SYNCED_KEY, "2026-11-10T00:00:00.000Z");
  serverSettings = {
    settings: { appearance: { theme: "dark" } },
    updatedAt: "2026-11-01T00:00:00.000Z",
  };
  renderHook(() => useBookPreferences());
  await wait(900);
  assert.deepEqual(writes(), []);
});

test("DATA-02: opening the reader issues zero settings or profile writes", async () => {
  renderHook(() => useReaderSettings());
  await wait(900);
  assert.deepEqual(writes(), []);
});

test("DATA-02: a change sends only the section that changed", async () => {
  const { result } = renderHook(() => useBookPreferences());
  await wait(50);
  act(() => result.current.patchSection("reading", { fontSize: 20 }));
  await wait(700);

  const sent = writes();
  assert.equal(sent.length, 1);
  const settings = (sent[0]!.body as { settings: Record<string, unknown> }).settings;
  assert.deepEqual(Object.keys(settings), ["reading"]);
  assert.equal((settings.reading as { fontSize: number }).fontSize, 20);
});

test("DATA-02: a change made before the server read settles waits for it and survives it", async () => {
  let openGate!: () => void;
  settingsGetGate = new Promise<void>((resolve) => {
    openGate = resolve;
  });
  serverSettings = {
    settings: { appearance: { theme: "light" }, reading: { fontSize: 22 } },
    updatedAt: "2026-11-11T00:00:00.000Z",
  };

  const { result } = renderHook(() => useBookPreferences());
  await wait(20);
  act(() => result.current.patchSection("appearance", { theme: "dark" }));
  await wait(700);
  assert.deepEqual(writes(), [], "no write before the server read settles");

  openGate();
  // act() flushes React work when it exits, so settle the read in one act and
  // let the debounced save run in the next.
  await wait(20);
  await wait(700);

  assert.equal(result.current.state.appearance.theme, "dark", "the user's change is kept");
  assert.equal(result.current.state.reading.fontSize, 22, "the server copy is applied elsewhere");
  const sent = writes();
  assert.equal(sent.length, 1);
  const settings = (sent[0]!.body as { settings: Record<string, unknown> }).settings;
  assert.deepEqual(Object.keys(settings), ["appearance"]);
  assert.equal((settings.appearance as { theme: string }).theme, "dark");
});

test("DATA-02: a change made just before leaving is still sent", async () => {
  const { result, unmount } = renderHook(() => useBookPreferences());
  await wait(50);
  act(() => result.current.patchSection("reading", { fontSize: 21 }));
  unmount();
  await wait(50);

  const sent = writes();
  assert.equal(sent.length, 1);
  const settings = (sent[0]!.body as { settings: Record<string, unknown> }).settings;
  assert.equal((settings.reading as { fontSize: number }).fontSize, 21);
});

test("SHELL-08: changing the theme keeps colour-blind mode on", async () => {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      ...defaultBookPreferencesState,
      extended: { ...defaultBookPreferencesState.extended, colorBlindMode: "protanopia" },
    }),
  );
  const { result } = renderHook(() => useBookPreferences());
  await wait(50);
  assert.equal(document.documentElement.dataset.colorBlindMode, "protanopia");

  act(() => result.current.patchSection("appearance", { theme: "dark" }));
  await wait(20);
  assert.equal(document.documentElement.dataset.colorBlindMode, "protanopia");
});

test("SHELL-06 / DATA-11: the header theme switch is taken in without a write and kept by the next change", async () => {
  const { result } = renderHook(() => useBookPreferences());
  await wait(50);

  act(() => {
    applyAndPersistDocumentTheme({ theme: "dark" });
  });
  await wait(700);
  assert.equal(result.current.state.appearance.theme, "dark", "the hook took in the switch");
  assert.deepEqual(writes(), [], "taking it in is not a change of its own");

  act(() => result.current.patchSection("reading", { fontSize: 20 }));
  await wait(700);
  const sent = writes();
  assert.equal(sent.length, 1);
  assert.deepEqual(Object.keys((sent[0]!.body as { settings: Record<string, unknown> }).settings), ["reading"]);
  const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}");
  assert.equal(stored.appearance?.theme, "dark", "the local copy keeps the switched theme");
  assert.equal(document.documentElement.classList.contains("dark"), true, "the page stays dark");
});

test("SHELL-06: a theme change from another tab is taken in", async () => {
  const { result } = renderHook(() => useBookPreferences());
  await wait(50);
  const other = { ...result.current.state, appearance: { ...result.current.state.appearance, theme: "dark" } };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(other));
  act(() => {
    // tests/_lib/dom does not expose StorageEvent as a global; jsdom's window has it.
    const { StorageEvent: JsdomStorageEvent } = window as unknown as { StorageEvent: typeof StorageEvent };
    window.dispatchEvent(new JsdomStorageEvent("storage", { key: STORAGE_KEY }));
  });
  await wait(700);
  assert.equal(result.current.state.appearance.theme, "dark");
  assert.deepEqual(writes(), []);
});

test("DATA-06: a change pending when the page is hidden is sent with keepalive", async () => {
  const { result } = renderHook(() => useBookPreferences());
  await wait(50);
  act(() => result.current.patchSection("reading", { fontSize: 23 }));
  act(() => {
    window.dispatchEvent(new Event("pagehide"));
  });
  await wait(20);
  const sent = writes();
  assert.equal(sent.length, 1);
  assert.equal(sent[0]!.keepalive, true);
  assert.equal(((sent[0]!.body as { settings: { reading: { fontSize: number } } }).settings.reading).fontSize, 23);
  await wait(700);
  assert.equal(writes().length, 1, "the debounced save does not send it again");
});

test("DATA-11: the header theme switch saves through the shared client and refreshes the settings cache", async () => {
  await fetchBookJsonCached("/app/api/book/me/settings");
  assert.ok(peekBookCache("/app/api/book/me/settings"), "settings are cached");
  const { result } = renderHook(() => useThemePreference());
  await wait(50);
  await act(async () => {
    await result.current.setThemePreference("dark");
  });
  const sent = writes();
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0]!.body, { settings: { appearance: { theme: "dark" } } });
  assert.equal(peekBookCache("/app/api/book/me/settings"), undefined, "the cached settings were dropped");
});
