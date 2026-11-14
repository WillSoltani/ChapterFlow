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
let entitlements: unknown = null;
// When set, the settings read waits for it (a slow connection).
let holdSettingsRead: Promise<void> | null = null;

function entitlementsPayload(plan: "FREE" | "PRO", extra: Record<string, unknown> = {}) {
  return {
    entitlement: {
      plan,
      proStatus: plan === "PRO" ? "active" : "inactive",
      freeBookSlots: 2,
      unlockedBookIds: [],
      unlockedBooksCount: 0,
      remainingFreeStarts: 2,
      cancelAtPeriodEnd: false,
      ...extra,
    },
    paywall: {
      price: "$7.99/month",
      pricingTiers: [
        { interval: "monthly", price: "$7.99", label: "Monthly", period: "month" },
        { interval: "annual", price: "$5.99", label: "Annual", annualTotal: "$71.88", period: "year" },
      ],
      benefits: [],
    },
  };
}

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
    if (holdSettingsRead) await holdSettingsRead;
    return json(serverSettings);
  }
  if (method === "GET" && url.endsWith("/me/entitlements") && entitlements) {
    return json(entitlements);
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

function renderSettings(props: { openUpgrade?: boolean } = {}) {
  return render(
    <AppRouterContext.Provider value={router}>
      <BookSettingsClient
        isAdmin={false}
        userEmail="reader@example.com"
        appVersion="test"
        openUpgrade={props.openUpgrade}
      />
    </AppRouterContext.Provider>,
  );
}

async function wait(ms: number) {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

async function waitUntil(check: () => boolean, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  while (!check() && Date.now() < deadline) await wait(50);
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
  holdSettingsRead = null;
  entitlements = null;
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

test("ACCT-13: a failed profile write is re-sent with the next profile change", async () => {
  failWrites = true;
  const view = renderSettings();
  await wait(1000);
  toggleSection(view, "Goals & Motivation");
  await wait(20);
  const goals = within(section(view, "Goals & Motivation"));
  fireEvent.click(goals.getByRole("radio", { name: /Deep/ }));
  await wait(1000);
  assert.equal(writes("/me/profile").length, 1, "the first profile write was attempted");

  // Back online; the user makes another change without pressing Retry.
  failWrites = false;
  fireEvent.click(goals.getByRole("radio", { name: "Off" }));
  await wait(1000);

  const sent = writes("/me/profile");
  assert.equal(sent.length, 2);
  assert.deepEqual((sent[1]!.body as { profile: unknown }).profile, {
    streakMode: false,
    dailyGoalMinutes: 30,
  });
});

test("ACCT-13: one write succeeding does not hide another write that failed", async () => {
  const view = renderSettings();
  await wait(1000);
  toggleSection(view, "Notifications");
  await wait(50);
  const reminders = within(section(view, "Notifications")).getByRole("switch", {
    name: "Reading reminders",
  });
  fireEvent.click(reminders); // off: a preferences write only
  await wait(900);

  failWrites = true;
  fireEvent.click(reminders); // on: the email opt-in write fails
  await wait(900);
  assert.match(view.getByRole("alert").textContent ?? "", /Couldn.t save/);

  // Back online; an unrelated profile write succeeds.
  failWrites = false;
  toggleSection(view, "Goals & Motivation");
  await wait(20);
  fireEvent.click(within(section(view, "Goals & Motivation")).getByRole("radio", { name: /Deep/ }));
  await wait(1000);
  assert.equal(writes("/me/profile").length, 1, "the profile write went through");

  const alert = view.getByRole("alert");
  assert.match(alert.textContent ?? "", /Couldn.t save/, "the failed opt-in is still reported");

  fireEvent.click(within(alert).getByRole("button", { name: "Retry" }));
  await wait(100);
  assert.equal(view.queryByRole("alert"), null);
  const optIns = writes("/me/settings").filter(
    (c) =>
      (c.body as { settings?: { notifications?: { channels?: { email?: boolean } } } }).settings
        ?.notifications?.channels?.email === true,
  );
  assert.equal(optIns.length, 2, "Retry re-sends the failed opt-in");
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

test("ACCT-13: a failed save says so and offers a retry; Saved shows only after success", async () => {
  failWrites = true;
  const view = renderSettings();
  await wait(100);
  toggleSection(view, "Appearance");
  await wait(20);
  fireEvent.click(within(section(view, "Appearance")).getByRole("radio", { name: "Dark" }));
  await wait(900);

  assert.equal(view.queryByText("Saved"), null, "no Saved toast for a failed write");
  const alert = view.getByRole("alert");
  assert.match(alert.textContent ?? "", /Couldn.t save/);

  failWrites = false;
  fireEvent.click(within(alert).getByRole("button", { name: "Retry" }));
  await wait(100);

  assert.equal(view.queryByRole("alert"), null);
  assert.ok(view.getByText("Saved"));
  const appearanceWrites = writes("/me/settings").filter(
    (c) => (c.body as { settings?: { appearance?: unknown } }).settings?.appearance,
  );
  assert.equal(appearanceWrites.length, 2, "the retry re-sends the change");
});

test("ACCT-06: upgrade=1 opens Account, focuses the subscription button and writes nothing", async () => {
  entitlements = entitlementsPayload("FREE");
  const view = renderSettings({ openUpgrade: true });
  await wait(1500);
  // Focus lands one frame after the button appears; allow for a slow render.
  await waitUntil(() => document.activeElement?.id === "subscription-cta", 5000);

  const header = section(view, "Account & Subscription").querySelector("button[aria-expanded]");
  assert.equal(header?.getAttribute("aria-expanded"), "true", "Account is open");
  assert.equal(document.activeElement?.id, "subscription-cta", "the subscription button has focus");
  assert.equal(writes("/me/settings").length, 0, "opening it wrote no section state");
  const stored = JSON.parse(window.localStorage.getItem("book-accelerator:preferences:v2") ?? "{}");
  assert.notEqual(stored.extended?.sectionStates?.account, true, "the stored section state stays closed");

  // Closing it again is a plain UI change: the stored state was already closed.
  fireEvent.click(header!);
  await wait(900);
  assert.equal(header?.getAttribute("aria-expanded"), "false");
  assert.equal(writes("/me/settings").length, 0);
});

test("ACCT-06: without upgrade=1 Account stays closed", async () => {
  entitlements = entitlementsPayload("FREE");
  const view = renderSettings();
  await wait(300);
  const header = section(view, "Account & Subscription").querySelector("button[aria-expanded]");
  assert.equal(header?.getAttribute("aria-expanded"), "false");
});

test("ACCT-14: no Free upsell while the plan loads; a Pro reader gets the Pro controls", async () => {
  entitlements = entitlementsPayload("PRO", { proSource: "stripe" });
  const view = renderSettings();
  assert.equal(view.queryByText(/Learn more/), null, "no upsell before the plan is known");
  await wait(300);
  assert.equal(view.queryByText(/Learn more/), null, "no upsell for a Pro reader");
  assert.ok(view.getByText("Playback speed"), "the Pro text-to-speech control shows");
});

test("ACCT-14: a failed plan read shows an error with a retry instead of the Free upsell", async () => {
  const view = renderSettings();
  await wait(300);
  assert.equal(view.queryByText(/Learn more/), null);
  const tryAgain = view.getAllByRole("button", { name: "Try again" });
  assert.ok(tryAgain.length > 0, "the plan error offers a retry");
  assert.ok(view.getAllByText(/Couldn.t load your plan/).length > 0);

  entitlements = entitlementsPayload("FREE");
  fireEvent.click(tryAgain[0]!);
  await wait(300);
  assert.ok(view.getAllByText(/Learn more/).length > 0, "a Free reader sees the Pro cards after the retry");
});

test("ACCT-09: a Pro feature card opens the subscription card instead of starting checkout", async () => {
  entitlements = entitlementsPayload("FREE");
  const view = renderSettings();
  await wait(300);
  const tts = view.container.querySelector("#text-to-speech") as HTMLElement;
  fireEvent.click(within(tts).getByRole("button", { name: /Learn more/ }));
  await wait(50);
  const dialog = view.getByRole("dialog");
  // The scroll must run once the dialog has closed and Account has opened: a
  // scroll started in the commit that closes the dialog (scroll lock release,
  // focus back to "Learn more", Account still growing) stops short of the card.
  const scrolls: { id: string; block: unknown; bodyOverflow: string }[] = [];
  const proto = window.HTMLElement.prototype as unknown as { scrollIntoView?: unknown };
  const hadScroll = Object.prototype.hasOwnProperty.call(proto, "scrollIntoView");
  const prevScroll = proto.scrollIntoView;
  proto.scrollIntoView = function (this: HTMLElement, opts?: ScrollIntoViewOptions) {
    scrolls.push({ id: this.id, block: opts?.block, bodyOverflow: document.body.style.overflow });
  };
  try {
    fireEvent.click(within(dialog).getAllByRole("button").find((b) => /Upgrade|trial/i.test(b.textContent ?? ""))!);
    assert.equal(scrolls.length, 0, "no scroll in the commit that closes the dialog");
    await waitUntil(() => scrolls.length > 0, 5000);
    await wait(300);
  } finally {
    if (hadScroll) proto.scrollIntoView = prevScroll;
    else delete proto.scrollIntoView;
  }
  assert.equal(scrolls.length, 1, "one scroll, after the dialog closed");
  // jsdom has no layout, so the card "fits" and its top is scrolled under the
  // header; a card taller than the screen centres the button instead.
  assert.deepEqual(
    { id: scrolls[0]?.id, block: scrolls[0]?.block },
    { id: "subscription", block: "start" },
    "the subscription card is scrolled into view",
  );
  assert.equal(scrolls[0]?.bodyOverflow, "", "the dialog had released the page scroll");

  assert.equal(calls.filter((c) => c.url.includes("/billing/")).length, 0, "no checkout was started");
  assert.equal(view.queryByRole("dialog"), null, "the feature dialog closed");
  const header = section(view, "Account & Subscription").querySelector("button[aria-expanded]");
  assert.equal(header?.getAttribute("aria-expanded"), "true", "Account is open");
  assert.equal(document.activeElement?.id, "subscription-cta", "the subscription button has focus");
  assert.equal(writes("/me/settings").length, 0, "opening it wrote nothing");
});

test("ACCT-15: a failed delete keeps the dialog open with its error", async () => {
  const view = renderSettings();
  await wait(100);
  toggleSection(view, "Account & Subscription");
  await wait(50);
  failWrites = true;
  fireEvent.click(view.getByRole("button", { name: /Delete account/ }));
  await wait(50);
  let dialog = view.getByRole("dialog");
  fireEvent.click(within(dialog).getByRole("button", { name: /Continue/ }));
  await wait(50);
  dialog = view.getByRole("dialog");
  fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "DELETE" } });
  fireEvent.click(within(dialog).getByRole("button", { name: /Permanently delete/ }));
  await wait(200);

  assert.equal(calls.filter((c) => c.url.endsWith("/me/account/delete")).length, 1, "the delete was sent");
  const open = view.getByRole("dialog");
  assert.match(within(open).getByRole("alert").textContent ?? "", /couldn't delete/);
});

test("ACCT-15: a failed deactivate keeps the dialog open with its error", async () => {
  const view = renderSettings();
  await wait(100);
  toggleSection(view, "Account & Subscription");
  await wait(50);
  failWrites = true;
  fireEvent.click(view.getByRole("button", { name: /Deactivate account/ }));
  await wait(50);
  const dialog = view.getByRole("dialog");
  fireEvent.click(within(dialog).getByRole("button", { name: /^Deactivate$/ }));
  await wait(200);

  assert.equal(calls.filter((c) => c.url.endsWith("/me/account/deactivate")).length, 1);
  assert.match(within(view.getByRole("dialog")).getByRole("alert").textContent ?? "", /couldn't deactivate/);
});

function lastExtendedWrite() {
  return writes("/me/settings")
    .map((c) => (c.body as { settings?: { extended?: Record<string, unknown> } }).settings?.extended)
    .filter((e): e is Record<string, unknown> => e !== undefined)
    .at(-1);
}

test("ACCT-02: choosing Deeper sets the reading depth the reader and quizzes use", async () => {
  const view = renderSettings();
  await wait(100);
  const reading = within(section(view, "Reading Experience"));
  fireEvent.click(reading.getByRole("radio", { name: /Deeper/ }));
  await wait(900);

  const extended = lastExtendedWrite();
  assert.ok(extended, "the profile change was saved");
  assert.equal(extended.learningMode, "challenge");
  assert.equal(extended.profileCustomized, true, "the choice counts as the reader's own");
  assert.equal(extended.contentTone, "competitive");
});

test("the ticked reading profile is the depth the reader gets: Lite until a depth is chosen", async () => {
  const view = renderSettings();
  await wait(100);
  const reading = within(section(view, "Reading Experience"));
  assert.equal(reading.getByRole("radio", { name: /Lite/ }).getAttribute("aria-checked"), "true");
  assert.equal(reading.getByRole("radio", { name: /Standard/ }).getAttribute("aria-checked"), "false");
});

test("a depth picked in the reader shows as the ticked profile in Settings", async () => {
  // The reader's mode menu saves the learning mode, not the profile id.
  serverSettings = {
    settings: { extended: { learningMode: "challenge", profileCustomized: true, readingProfile: "balanced" } },
    updatedAt: new Date().toISOString(),
  };
  const view = renderSettings();
  await wait(200);
  const reading = within(section(view, "Reading Experience"));
  assert.equal(reading.getByRole("radio", { name: /Deeper/ }).getAttribute("aria-checked"), "true");
  assert.equal(reading.getByRole("radio", { name: /Standard/ }).getAttribute("aria-checked"), "false");
});

test("ACCT-02: picking a profile in the preferences wizard sets the depth", async () => {
  const view = renderSettings();
  await wait(100);
  toggleSection(view, "Account & Subscription");
  await wait(50);
  fireEvent.click(view.getByRole("button", { name: "Refresh" }));
  await wait(50);
  fireEvent.click(within(view.getByRole("dialog")).getByRole("radio", { name: /Deep Diver/ }));
  for (let i = 0; i < 3; i += 1) {
    fireEvent.click(within(view.getByRole("dialog")).getByRole("button", { name: "Next" }));
    await wait(30);
  }
  fireEvent.click(within(view.getByRole("dialog")).getByRole("button", { name: /Update my preferences/ }));
  await wait(900);

  const extended = lastExtendedWrite();
  assert.ok(extended);
  assert.equal(extended.learningMode, "challenge");
  assert.equal(extended.readingProfile, "deep");
  assert.equal(extended.profileCustomized, true);
  assert.equal(extended.contentTone, "competitive");
});

test("finishing the preferences wizard without a change leaves an untouched account's depth alone", async () => {
  // An account that never chose a depth reads on the short path with its own
  // quiz rules. Confirming the wizard without picking a profile must not move
  // it to another depth or change those rules.
  const view = renderSettings();
  await wait(100);
  await finishWizardUntouched(view);

  const extended = lastExtendedWrite();
  assert.ok(extended, "the wizard saved the other choices");
  assert.equal(extended.profileCustomized, false);
  assert.equal(extended.learningMode, "standard");
  assert.equal(extended.readingProfile, "balanced");
});

test("the preferences wizard cannot be opened before the saved settings have arrived", async () => {
  let release!: () => void;
  holdSettingsRead = new Promise<void>((resolve) => {
    release = resolve;
  });
  const view = renderSettings();
  await wait(100);
  toggleSection(view, "Account & Subscription");
  await wait(50);
  const refresh = view.getByRole("button", { name: "Refresh" }) as HTMLButtonElement;
  try {
    assert.equal(refresh.disabled, true, "disabled while the saved settings are loading");
  } finally {
    release();
    holdSettingsRead = null;
  }
  await wait(100);
  assert.equal(refresh.disabled, false);
});

async function finishWizardUntouched(view: ReturnType<typeof renderSettings>) {
  toggleSection(view, "Account & Subscription");
  await wait(50);
  fireEvent.click(view.getByRole("button", { name: "Refresh" }));
  await wait(50);
  for (let i = 0; i < 3; i += 1) {
    fireEvent.click(within(view.getByRole("dialog")).getByRole("button", { name: "Next" }));
    await wait(30);
  }
  fireEvent.click(within(view.getByRole("dialog")).getByRole("button", { name: /Update my preferences/ }));
  await wait(900);
}

for (const [mode, profile] of [
  ["standard", "balanced"],
  ["challenge", "deep"],
] as const) {
  test(`finishing the preferences wizard without a change keeps a ${mode} reader's choices`, async () => {
    // The wizard is mounted before the saved settings load; it must start from
    // the reader's current choices each time it opens, not from the defaults.
    serverSettings = {
      settings: {
        extended: {
          learningMode: mode,
          profileCustomized: true,
          readingProfile: profile,
          dailyGoalPreset: 20,
          motivationPersona: "partner",
        },
      },
      updatedAt: new Date().toISOString(),
    };
    const view = renderSettings();
    await wait(200);
    await finishWizardUntouched(view);

    const extended = lastExtendedWrite();
    assert.ok(extended, "the wizard saved");
    assert.equal(extended.learningMode, mode);
    assert.equal(extended.readingProfile, profile);
    assert.equal(extended.dailyGoalPreset, 20);
    assert.equal(extended.motivationPersona, "partner");
  });
}

test("ACCT-20: the Rival style promises no leaderboard", async () => {
  const view = renderSettings();
  await wait(100);
  toggleSection(view, "Goals & Motivation");
  await wait(20);
  fireEvent.click(within(section(view, "Goals & Motivation")).getByRole("radio", { name: /Rival/ }));
  await wait(400);
  assert.doesNotMatch(view.container.textContent ?? "", /leaderboard/i);
});

test("ACCT-23: Weekly chapter goal is hidden; the reading-time setting names the reader", async () => {
  const view = renderSettings();
  await wait(100);
  toggleSection(view, "Goals & Motivation");
  await wait(20);
  assert.equal(view.queryByText("Weekly chapter goal"), null);
  const readingTime = view.container.querySelector("#reading-time");
  assert.match(readingTime?.textContent ?? "", /in the reader/);

  fireEvent.change(view.getByRole("textbox", { name: "Search settings" }), { target: { value: "weekly chapter" } });
  await wait(20);
  assert.equal(view.queryByText("Weekly chapter goal"), null, "search does not reveal it either");
});

test("ACCT-26: Back goes to Home", async () => {
  const view = renderSettings();
  await wait(50);
  const back = view.getByRole("link", { name: "Back to Home" });
  assert.equal(back.getAttribute("href"), "/dashboard");
  assert.match(back.className, /(^|\s)h-11 w-11(\s|$)/, "a 44px touch target");
});

test("ACCT-26: every searchable setting has a row on the page", async () => {
  const { SETTINGS_SEARCH_INDEX } = await import("./constants/searchKeywords");
  const view = renderSettings();
  await wait(100);
  for (const title of ["Goals & Motivation", "Appearance", "Accessibility", "Notifications", "Account & Subscription"]) {
    toggleSection(view, title);
    await wait(20);
  }
  await wait(400);
  const missing = SETTINGS_SEARCH_INDEX.map((item) => item.id).filter(
    (id) => !view.container.querySelector(`[id="${id}"]`),
  );
  assert.deepEqual(missing, []);
});

test("ACCT-26: search highlights the matching rows", async () => {
  const view = renderSettings();
  await wait(100);
  fireEvent.change(view.getByRole("textbox", { name: "Search settings" }), { target: { value: "font size" } });
  await wait(400);
  const fontSize = view.container.querySelector("#font-size") as HTMLElement;
  const fontFamily = view.container.querySelector("#font-family") as HTMLElement;
  assert.equal(fontSize.dataset.highlighted, "true");
  assert.notEqual(fontFamily.dataset.highlighted, "true");

  fireEvent.change(view.getByRole("textbox", { name: "Search settings" }), { target: { value: "delete" } });
  await wait(400);
  const del = view.container.querySelector("#delete-account") as HTMLElement | null;
  assert.equal(del?.dataset.highlighted, "true");
});

test("ACCT-21: the weekly summary says once a week; the Email switch shows and writes email consent", async () => {
  serverSettings = {
    settings: { notifications: { channels: { email: true } } },
    updatedAt: "2026-11-11T00:00:00.000Z",
  };
  const view = renderSettings();
  await wait(100);
  toggleSection(view, "Notifications");
  await wait(50);
  const notifications = within(section(view, "Notifications"));
  assert.match(view.container.querySelector("#weekly-summary")?.textContent ?? "", /once a week/);
  assert.doesNotMatch(view.container.textContent ?? "", /every Monday/);

  const email = notifications.getByRole("switch", { name: "Email" });
  assert.equal(email.getAttribute("aria-checked"), "true");
  assert.equal(notifications.queryByText(/Email is off/), null, "no hint while email is on");

  fireEvent.click(email);
  await wait(100);
  const sent = writes("/me/settings").filter(
    (c) => JSON.stringify(c.body).includes('"channels"'),
  );
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0]!.body, { settings: { notifications: { channels: { email: false } } } });
  assert.equal(email.getAttribute("aria-checked"), "false");
  assert.ok(notifications.getAllByText(/Email is off/).length >= 2, "the email categories say they will not be sent");
});

test("ACCT-21: with no email consent stored the Email switch shows off", async () => {
  const view = renderSettings();
  await wait(100);
  toggleSection(view, "Notifications");
  await wait(50);
  const email = within(section(view, "Notifications")).getByRole("switch", { name: "Email" });
  assert.equal(email.getAttribute("aria-checked"), "false");
});

test("SHELL-22: the header and tab bar sit outside the page entrance animation", async () => {
  const view = renderSettings();
  await wait(50);
  const main = view.container.querySelector("#main") as HTMLElement;
  const animated = (el: Element | null) => {
    for (let node = el?.parentElement ?? null; node; node = node.parentElement) {
      if (node.style.opacity !== "" || node.style.transform !== "") return true;
    }
    return false;
  };
  assert.equal(animated(main), true, "the page content still has its entrance");
  const navs = Array.from(view.container.querySelectorAll("header, nav")).filter(
    (el) => !main.contains(el),
  );
  assert.ok(navs.length > 0, "the shared header renders");
  for (const nav of navs) assert.equal(animated(nav), false, "the header is not animated with the page");
});
