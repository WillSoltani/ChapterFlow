import "../../tests/_lib/dom";

import assert from "node:assert/strict";
import { after, afterEach, test } from "node:test";
import { cleanup, render, waitFor } from "@testing-library/react";
import { NotificationBell } from "./NotificationBell";

const NOTIFICATIONS_PATH = "/app/api/book/me/notifications";
const originalFetch = globalThis.fetch;
const originalSetInterval = globalThis.setInterval;
const originalClearInterval = globalThis.clearInterval;

let notificationGets = 0;
let hidden = false;
const pollers = new Map<number, () => void>();
let nextPollerId = 1_000_000;

Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
Object.defineProperty(document, "visibilityState", {
  configurable: true,
  get: () => (hidden ? "hidden" : "visible"),
});

globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = String(input);
  if (url.startsWith(NOTIFICATIONS_PATH)) notificationGets += 1;
  return new Response(
    JSON.stringify({
      notifications: [
        {
          notificationId: "n1",
          type: "badge_earned",
          title: "Badge earned",
          body: "You earned a badge.",
          readAt: null,
          createdAt: new Date().toISOString(),
        },
      ],
      unreadCount: 1,
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}) as typeof fetch;

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

afterEach(() => {
  cleanup();
  hidden = false;
});

after(() => {
  globalThis.fetch = originalFetch;
  globalThis.setInterval = originalSetInterval;
  globalThis.clearInterval = originalClearInterval;
});

test("a second mount within the cache window shows the count at once and makes no new request", async () => {
  const first = render(<NotificationBell />);
  await waitFor(() => first.getByRole("button", { name: "Notifications (1 unread)" }));
  assert.equal(notificationGets, 1);
  first.unmount();

  const second = render(<NotificationBell />);
  // Seeded from the cache on the first render, before any effect runs.
  assert.ok(second.getByRole("button", { name: "Notifications (1 unread)" }));
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(notificationGets, 1);
});

test("the poll skips hidden tabs and refreshes once when the tab is shown again", async () => {
  const view = render(<NotificationBell />);
  await waitFor(() => view.getByRole("button", { name: "Notifications (1 unread)" }));
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
