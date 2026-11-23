import "../../tests/_lib/dom";

import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { act, cleanup, renderHook } from "@testing-library/react";
import { BOOK_THEME_STORAGE_KEY } from "@/app/_lib/document-theme";
import { useThemePreference } from "./useThemePreference";

type Call = { url: string; method: string; body: unknown };
let calls: Call[] = [];

globalThis.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
  calls.push({
    url: String(input),
    method: (init.method ?? "GET").toUpperCase(),
    body: typeof init.body === "string" ? JSON.parse(init.body) : undefined,
  });
  return new Response(JSON.stringify({ settings: {}, updatedAt: new Date().toISOString() }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}) as typeof fetch;

async function wait(ms: number) {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

/** A night window that contains the current time. */
function windowAroundNow() {
  const h = new Date().getHours();
  const pad = (n: number) => String(n).padStart(2, "0");
  return { darkModeFrom: `${pad(h)}:00`, darkModeTo: `${pad((h + 2) % 24)}:00` };
}

beforeEach(() => {
  calls = [];
  window.localStorage.clear();
  document.documentElement.className = "";
});

afterEach(() => {
  cleanup();
});

test("SHELL-07: inside the night window the switch shows dark", async () => {
  window.localStorage.setItem(
    BOOK_THEME_STORAGE_KEY,
    JSON.stringify({ appearance: { theme: "light" }, extended: { scheduledDarkMode: true, ...windowAroundNow() } }),
  );
  const { result } = renderHook(() => useThemePreference());
  await wait(50);
  assert.equal(result.current.hydrated, true);
  assert.equal(result.current.resolvedTheme, "dark");
});

test("SHELL-07: tapping the switch while the schedule is in charge turns it off and applies the choice", async () => {
  window.localStorage.setItem(
    BOOK_THEME_STORAGE_KEY,
    JSON.stringify({ appearance: { theme: "light" }, extended: { scheduledDarkMode: true, ...windowAroundNow() } }),
  );
  const { result } = renderHook(() => useThemePreference());
  await wait(50);

  await act(async () => {
    result.current.toggleTheme();
    await new Promise((resolve) => setTimeout(resolve, 20));
  });

  const stored = JSON.parse(window.localStorage.getItem(BOOK_THEME_STORAGE_KEY) ?? "{}");
  assert.equal(stored.extended.scheduledDarkMode, false, "the schedule is off");
  assert.equal(stored.appearance.theme, "light", "the choice (light) is kept");
  assert.equal(result.current.resolvedTheme, "light");
  assert.equal(document.documentElement.classList.contains("dark"), false, "the page is light");
  const patch = calls.find((c) => c.method === "PATCH");
  assert.deepEqual(patch?.body, {
    settings: { appearance: { theme: "light" }, extended: { scheduledDarkMode: false } },
  });
});

test("SHELL-07: with the schedule off the switch only changes the theme", async () => {
  window.localStorage.setItem(BOOK_THEME_STORAGE_KEY, JSON.stringify({ appearance: { theme: "light" } }));
  const { result } = renderHook(() => useThemePreference());
  await wait(50);
  await act(async () => {
    result.current.toggleTheme();
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
  assert.equal(result.current.resolvedTheme, "dark");
  const patch = calls.find((c) => c.method === "PATCH");
  assert.deepEqual(patch?.body, { settings: { appearance: { theme: "dark" } } });
});
