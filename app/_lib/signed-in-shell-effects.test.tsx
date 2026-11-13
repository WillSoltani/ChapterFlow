import "../../tests/_lib/dom";

import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { after, afterEach, beforeEach, test } from "node:test";
import { cleanup, render, waitFor } from "@testing-library/react";
import type { ComponentType } from "react";

const require = createRequire(import.meta.url);
const Module = require("node:module") as {
  _load: (request: string, parent: unknown, isMain: boolean) => unknown;
};
const originalLoad = Module._load;
const originalFetch = globalThis.fetch;
let pathname = "/";

Module._load = function patchedLoad(request, parent, isMain) {
  if (request === "next/navigation") return { usePathname: () => pathname };
  return originalLoad.call(this, request, parent, isMain);
};

const PREFS_KEY = "book-accelerator:preferences:v2";
const LAST_SYNCED_KEY = "book-accelerator:preferences:last-synced-at:v2";
const SETTINGS_PATH = "/app/api/book/me/settings";
const BEACON_PATH = "/app/api/book/me/analytics/beacon";

let requests: Array<{ url: string; method: string; type: string | undefined }> = [];

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  const method = init?.method ?? "GET";
  const body = typeof init?.body === "string" ? (JSON.parse(init.body) as { type?: string }) : {};
  requests.push({ url, method, type: body.type });
  if (url === SETTINGS_PATH) {
    return Response.json({
      settings: {
        appearance: { theme: "dark", reducedMotion: true },
        accessibility: { highContrastMode: true },
        extended: { colorBlindMode: "tritanopia" },
      },
      updatedAt: "2026-11-13T09:00:00.000Z",
    });
  }
  return Response.json({ ok: true });
}) as typeof fetch;

/** A fresh copy of the shell, as on a new page load (module state reset). */
function loadShell(): ComponentType {
  for (const key of Object.keys(require.cache)) {
    if (/app[\\/]_lib[\\/](signed-in-shell-effects|analytics-beacon)/.test(key)) {
      delete require.cache[key];
    }
  }
  const { invalidateBookCache } = require("@/lib/client/book-api-cache") as {
    invalidateBookCache: (prefix: string) => void;
  };
  invalidateBookCache(SETTINGS_PATH);
  return (require("./signed-in-shell-effects") as { SignedInShellEffects: ComponentType })
    .SignedInShellEffects;
}

const settingsGets = () => requests.filter((r) => r.url === SETTINGS_PATH && r.method === "GET");
const beacons = () => requests.filter((r) => r.url === BEACON_PATH);
const settle = () => new Promise((resolve) => setTimeout(resolve, 30));

beforeEach(() => {
  requests = [];
  window.localStorage.clear();
  // Opted in to usage analytics; theme stored earlier on this device.
  window.localStorage.setItem(
    PREFS_KEY,
    JSON.stringify({ appearance: { theme: "light" }, privacy: { analyticsParticipation: true } }),
  );
  window.localStorage.setItem(LAST_SYNCED_KEY, "2026-11-01T00:00:00.000Z");
  const root = document.documentElement;
  root.classList.remove("dark");
  delete root.dataset.motion;
  delete root.dataset.contrast;
  delete root.dataset.colorBlindMode;
});

afterEach(() => cleanup());

after(() => {
  Module._load = originalLoad;
  globalThis.fetch = originalFetch;
});

test("public pages fetch no settings and send no beacon", async () => {
  const Shell = loadShell();
  for (const path of ["/", "/pricing"]) {
    pathname = path;
    const view = render(<Shell />);
    await settle();
    view.unmount();
  }
  assert.deepEqual(requests, []);
});

test("arriving from a public page reports no navigation from it", async () => {
  const Shell = loadShell();
  pathname = "/pricing";
  const view = render(<Shell />);
  await settle();

  pathname = "/dashboard";
  view.rerender(<Shell />);
  await waitFor(() => assert.ok(beacons().some((b) => b.type === "session_context")));
  await settle();
  assert.equal(beacons().filter((b) => b.type === "navigation").length, 0);
});

test("Home applies newer server preferences once per page load and sends the beacon", async () => {
  const Shell = loadShell();
  pathname = "/dashboard";
  const view = render(<Shell />);

  await waitFor(() => assert.ok(document.documentElement.classList.contains("dark")));
  const root = document.documentElement;
  assert.equal(root.dataset.motion, "reduced");
  assert.equal(root.dataset.contrast, "high");
  assert.equal(root.dataset.colorBlindMode, "tritanopia");
  const stored = JSON.parse(window.localStorage.getItem(PREFS_KEY) ?? "{}");
  assert.equal(stored.appearance.theme, "dark");
  assert.equal(stored.privacy.analyticsParticipation, true, "other stored settings are kept");
  // The shell never records a sync; useBookPreferences owns that marker.
  assert.equal(window.localStorage.getItem(LAST_SYNCED_KEY), "2026-11-01T00:00:00.000Z");
  assert.ok(beacons().some((b) => b.type === "session_context"));

  pathname = "/book/library";
  view.rerender(<Shell />);
  await waitFor(() => assert.ok(beacons().some((b) => b.type === "navigation")));
  assert.equal(settingsGets().length, 1);
  assert.equal(beacons().filter((b) => b.type === "session_context").length, 1);
});

test("Settings and the chapter reader keep the beacon but skip the shell sync", async () => {
  for (const path of ["/book/settings", "/book/library/atomic-habits/chapter/atomic-habits-ch04"]) {
    const Shell = loadShell();
    requests = [];
    pathname = path;
    const view = render(<Shell />);
    await waitFor(() => assert.ok(beacons().some((b) => b.type === "session_context"), path));
    await settle();
    assert.equal(settingsGets().length, 0, path);
    view.unmount();
  }
  assert.equal(document.documentElement.classList.contains("dark"), false);
});

test("server preferences already seen on this device are not re-applied", async () => {
  window.localStorage.setItem(LAST_SYNCED_KEY, "2026-11-13T09:00:00.000Z");
  const Shell = loadShell();
  pathname = "/rewards";
  render(<Shell />);
  await waitFor(() => assert.equal(settingsGets().length, 1));
  await settle();
  assert.equal(JSON.parse(window.localStorage.getItem(PREFS_KEY) ?? "{}").appearance.theme, "light");
  assert.equal(document.documentElement.classList.contains("dark"), false);
});
