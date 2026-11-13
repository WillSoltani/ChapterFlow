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
let serverSettings: { settings: Record<string, unknown> | null; updatedAt: string | null } = {
  settings: null,
  updatedAt: null,
};

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
    return json(serverSettings);
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
  const el = Array.from(view.container.querySelectorAll("section")).find(
    (node) => node.getAttribute("aria-label") === title,
  );
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
  serverSettings = { settings: null, updatedAt: null };
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

test("ACCT-04: opening Settings on a fresh browser does not write the profile", async () => {
  renderSettings();
  await wait(1300);
  assert.deepEqual(writes("/me/profile"), []);
});

test("ACCT-04: changing the daily goal writes only that profile field", async () => {
  const view = renderSettings();
  await wait(1000);
  toggleSection(view, "Goals & Motivation");
  await wait(20);
  const goals = within(section(view, "Goals & Motivation"));
  fireEvent.click(goals.getByRole("radio", { name: /Deep/ }));
  await wait(1000);

  const sent = writes("/me/profile");
  assert.equal(sent.length, 1);
  assert.deepEqual((sent[0]!.body as { profile: unknown }).profile, { dailyGoalMinutes: 30 });
});

test("ACCT-04: the reminder time shown is the one the server sends at", async () => {
  serverSettings = {
    settings: { notifications: { reminderTimeLocal: "07:00", reminderTimezone: "America/Toronto" } },
    updatedAt: "2026-11-11T00:00:00.000Z",
  };
  const view = renderSettings();
  await wait(100);
  toggleSection(view, "Notifications");
  await wait(50);
  const input = within(section(view, "Notifications")).getByLabelText("Reminder time") as HTMLInputElement;
  assert.equal(input.value, "07:00");
});

test("ACCT-08 / LIVE-08: opening Settings writes nothing to settings or profile", async () => {
  // readingReminderEnabled defaults to true, which used to trigger a background
  // write that opted the visitor in to email.
  renderSettings();
  await wait(2000);
  assert.deepEqual(writes("/me/settings"), []);
  assert.deepEqual(writes("/me/profile"), []);
});

test("ACCT-08: switching reading reminders on is what turns email on", async () => {
  const view = renderSettings();
  await wait(100);
  toggleSection(view, "Notifications");
  await wait(50);
  const reminders = within(section(view, "Notifications")).getByRole("switch", {
    name: "Reading reminders",
  });
  fireEvent.click(reminders); // off
  await wait(50);
  assert.equal(
    writes("/me/settings").some((c) => JSON.stringify(c.body).includes('"channels"')),
    false,
    "switching reminders off does not touch email consent",
  );
  fireEvent.click(reminders); // on
  await wait(50);

  const optIns = writes("/me/settings").filter(
    (c) =>
      (c.body as { settings?: { notifications?: { channels?: { email?: boolean } } } }).settings
        ?.notifications?.channels?.email === true,
  );
  assert.equal(optIns.length, 1);
});
