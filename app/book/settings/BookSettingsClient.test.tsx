import "../../../tests/_lib/dom";

import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { act, cleanup, fireEvent, render, within } from "@testing-library/react";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { invalidateBookCache } from "@/lib/client/book-api-cache";
import { BookSettingsClient } from "./BookSettingsClient";

// next/link's idle-callback fallback reads `self`, which jsdom globals omit.
Object.defineProperty(globalThis, "self", { configurable: true, writable: true, value: globalThis });

type Call = { url: string; method: string; body: unknown };

let calls: Call[] = [];
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
  });
  if (method === "GET" && url.endsWith("/me/settings")) {
    return json({ settings: null, updatedAt: null });
  }
  if (method !== "GET") {
    if (failWrites) return json({ error: "unavailable" }, 503);
    return json({ settings: {}, updatedAt: new Date().toISOString() });
  }
  // Everything else (entitlements, viewer, notifications, ...) is irrelevant
  // to these tests; a 404 keeps those hooks on their empty state.
  return json({ error: "not_found" }, 404);
}) as typeof fetch;

const router = {
  push() {},
  replace() {},
  refresh() {},
  back() {},
  forward() {},
  prefetch() {},
} as unknown as AppRouterInstance;

function renderSettings() {
  return render(
    <AppRouterContext.Provider value={router}>
      <BookSettingsClient isAdmin={false} userEmail="reader@example.com" appVersion="test" />
    </AppRouterContext.Provider>,
  );
}

async function wait(ms: number) {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

function writes(path: string) {
  return calls.filter((c) => c.method !== "GET" && c.url.endsWith(path));
}

function section(view: ReturnType<typeof render>, title: string) {
  const el = view.container.querySelector(`section[aria-label="${title}"]`);
  assert.ok(el, `section ${title} is rendered`);
  return el as HTMLElement;
}

function toggleSection(view: ReturnType<typeof render>, title: string) {
  const header = section(view, title).querySelector("button[aria-expanded]");
  assert.ok(header, `section ${title} has a header button`);
  fireEvent.click(header);
}

beforeEach(() => {
  calls = [];
  failWrites = false;
  window.localStorage.clear();
  invalidateBookCache("/app/api/book/me");
  document.documentElement.className = "";
});

afterEach(() => {
  cleanup();
});

test("ACCT-01: a theme change survives expanding another section and a reload", async () => {
  const view = renderSettings();
  await wait(50);

  toggleSection(view, "Appearance");
  await wait(20);
  const appearance = within(section(view, "Appearance"));
  fireEvent.click(appearance.getByRole("radio", { name: "Dark" }));
  await wait(20);
  // Expanding another section is a preference write of its own (sectionStates).
  toggleSection(view, "Notifications");
  await wait(900);

  const stored = JSON.parse(window.localStorage.getItem("book-accelerator:preferences:v2") ?? "{}");
  assert.equal(stored.appearance?.theme, "dark", "local copy keeps the theme");
  assert.equal(stored.extended?.sectionStates?.notifications, true, "local copy keeps the section state");

  // The last settings write that carries an appearance section has the new theme.
  const appearanceWrites = writes("/me/settings")
    .map((c) => (c.body as { settings?: { appearance?: { theme?: string } } }).settings?.appearance)
    .filter((a): a is { theme?: string } => a !== undefined);
  assert.equal(appearanceWrites.at(-1)?.theme, "dark", "the server keeps the theme");

  cleanup();
  const reloaded = renderSettings();
  await wait(50);
  // Appearance was left expanded, so it reopens expanded.
  const dark = within(section(reloaded, "Appearance")).getByRole("radio", { name: "Dark" });
  assert.equal(dark.getAttribute("aria-checked"), "true", "theme is still Dark after reload");
});
