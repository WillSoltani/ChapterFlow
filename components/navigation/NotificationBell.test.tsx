import "../../tests/_lib/dom";

import assert from "node:assert/strict";
import { after, afterEach, test } from "node:test";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { invalidateBookCache } from "@/lib/client/book-api-cache";
import { NotificationBell } from "./NotificationBell";

const NOTIFICATIONS_PATH = "/app/api/book/me/notifications";
const originalFetch = globalThis.fetch;
const originalSetInterval = globalThis.setInterval;
const originalClearInterval = globalThis.clearInterval;

let notificationGets = 0;
let hidden = false;
const pollers = new Map<number, () => void>();
let nextPollerId = 1_000_000;

// next/link (rendered in the open panel) schedules prefetch work through `self`.
Object.defineProperty(globalThis, "self", {
  configurable: true,
  writable: true,
  value: window,
});

Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
Object.defineProperty(document, "visibilityState", {
  configurable: true,
  get: () => (hidden ? "hidden" : "visible"),
});

// A small stand-in for the server: it remembers what was marked read, and its
// mark-read replies can be held back to model a slow network.
let readIds = new Set<string>();
let allRead = false;
let heldPosts: Array<() => void> = [];
let holdPosts = false;

function serverPayload() {
  const notifications = [
    {
      notificationId: "n1",
      type: "badge_earned",
      title: "Badge earned",
      body: "You earned a badge.",
      createdAt: new Date().toISOString(),
    },
    {
      notificationId: "n2",
      type: "account_notice",
      title: "Account notice",
      body: "Something changed.",
      createdAt: new Date().toISOString(),
    },
  ].map((n) => ({
    ...n,
    readAt: allRead || readIds.has(n.notificationId) ? new Date().toISOString() : null,
  }));
  return { notifications, unreadCount: notifications.filter((n) => !n.readAt).length };
}

function json(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  const method = (init?.method ?? "GET").toUpperCase();
  if (method === "POST") {
    if (holdPosts) await new Promise<void>((resolve) => heldPosts.push(resolve));
    if (url.endsWith("/read-all")) allRead = true;
    else readIds.add(JSON.parse(String(init?.body)).notificationId);
    return json({ ok: true });
  }
  if (url.startsWith(NOTIFICATIONS_PATH)) notificationGets += 1;
  return json(serverPayload());
}) as typeof fetch;

function releasePosts() {
  holdPosts = false;
  for (const resolve of heldPosts.splice(0)) resolve();
}

// Capture the bell's 60 s poll so a test can fire a tick on demand; every other
// interval (testing-library's waitFor) keeps the real timer.
globalThis.setInterval = ((handler: () => void, delay?: number, ...rest: unknown[]) => {
  if (delay === 60_000) {
    const id = nextPollerId++;
    pollers.set(id, handler);
    return id as unknown as ReturnType<typeof setInterval>;
  }
  return originalSetInterval(handler, delay, ...rest);
}) as typeof setInterval;
globalThis.clearInterval = ((id?: ReturnType<typeof setInterval>) => {
  if (typeof id === "number" && pollers.delete(id)) return;
  originalClearInterval(id);
}) as typeof clearInterval;

function tickPollers() {
  for (const handler of [...pollers.values()]) handler();
}

afterEach(async () => {
  cleanup();
  hidden = false;
  // Let any held mark-read reply land before the server state is reset.
  releasePosts();
  await new Promise((resolve) => setTimeout(resolve, 20));
  readIds = new Set();
  allRead = false;
  invalidateBookCache(NOTIFICATIONS_PATH);
});

after(() => {
  Reflect.deleteProperty(globalThis, "self");
  globalThis.fetch = originalFetch;
  globalThis.setInterval = originalSetInterval;
  globalThis.clearInterval = originalClearInterval;
});

test("a second mount within the cache window shows the count at once and makes no new request", async () => {
  const first = render(<NotificationBell />);
  await waitFor(() => first.getByRole("button", { name: "Notifications (2 unread)" }));
  assert.equal(notificationGets, 1);
  first.unmount();

  const second = render(<NotificationBell />);
  // Seeded from the cache on the first render, before any effect runs.
  assert.ok(second.getByRole("button", { name: "Notifications (2 unread)" }));
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(notificationGets, 1);
});

test("the poll skips hidden tabs and refreshes once when the tab is shown again", async () => {
  const view = render(<NotificationBell />);
  await waitFor(() => view.getByRole("button", { name: "Notifications (2 unread)" }));
  const before = notificationGets;

  hidden = true;
  document.dispatchEvent(new Event("visibilitychange"));
  tickPollers();
  tickPollers();
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(notificationGets, before, "no request while the tab is hidden");

  hidden = false;
  document.dispatchEvent(new Event("visibilitychange"));
  await waitFor(() => assert.equal(notificationGets, before + 1));

  // A visible tick always goes to the network, even inside the cache window.
  tickPollers();
  await waitFor(() => assert.equal(notificationGets, before + 2));
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

test("after Mark all read, the bell on the next page stays read even before the server answers", async () => {
  const first = render(<NotificationBell />);
  await waitFor(() => first.getByRole("button", { name: "Notifications (2 unread)" }));

  holdPosts = true;
  fireEvent.click(first.getByRole("button", { name: "Notifications (2 unread)" }));
  fireEvent.click(first.getByRole("button", { name: "Mark all read" }));
  first.unmount();

  const second = render(<NotificationBell />);
  assert.ok(second.getByRole("button", { name: "Notifications" }));
  await settle();
  assert.ok(second.getByRole("button", { name: "Notifications" }));
  second.unmount();

  // Once the server has it, the next page reads the server's copy.
  releasePosts();
  await settle();
  const gets = notificationGets;
  const third = render(<NotificationBell />);
  await waitFor(() => assert.equal(notificationGets, gets + 1));
  await settle();
  assert.ok(third.getByRole("button", { name: "Notifications" }));
});

test("reading one notification keeps it read on the next page within the cache window", async () => {
  const first = render(<NotificationBell />);
  await waitFor(() => first.getByRole("button", { name: "Notifications (2 unread)" }));

  holdPosts = true;
  fireEvent.click(first.getByRole("button", { name: "Notifications (2 unread)" }));
  fireEvent.click(first.getByText("Account notice"));
  await waitFor(() => first.getByRole("button", { name: "Notifications (1 unread)" }));
  first.unmount();

  const second = render(<NotificationBell />);
  assert.ok(second.getByRole("button", { name: "Notifications (1 unread)" }));
  await settle();
  assert.ok(second.getByRole("button", { name: "Notifications (1 unread)" }));
});
