import "../../tests/_lib/dom";

import assert from "node:assert/strict";
import { after, afterEach, beforeEach, test } from "node:test";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { TokenExpiryGuard } from "./TokenExpiryGuard";

const originalFetch = globalThis.fetch;
let refreshStatus: number | "network-error" = "network-error";
let refreshCalls = 0;

function setExpiry(secondsFromNow: number) {
  document.cookie = `auth_expires_at=${Math.floor(Date.now() / 1000) + secondsFromNow}; path=/`;
}

function wake() {
  act(() => {
    window.dispatchEvent(new window.Event("focus"));
  });
}

beforeEach(() => {
  refreshStatus = "network-error";
  refreshCalls = 0;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    if (String(input).includes("/auth/refresh")) {
      refreshCalls += 1;
      if (refreshStatus === "network-error") throw new TypeError("offline");
      return new Response(null, { status: refreshStatus });
    }
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
});

afterEach(() => {
  cleanup();
  document.cookie = "auth_expires_at=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
});

after(() => {
  globalThis.fetch = originalFetch;
});

test("the expiry warning clears once another tab has renewed the session", async () => {
  setExpiry(60); // inside the renewal window; this tab's own renewal fails
  const view = render(<TokenExpiryGuard />);
  await waitFor(() => assert.ok(view.getByRole("alert")));

  // Another tab renewed the cookie.
  setExpiry(60 * 60);
  wake();
  await waitFor(() => assert.equal(view.queryByRole("alert"), null));
});

test("a lapsed session announces cf:session-expiring before leaving", async () => {
  setExpiry(-5);
  const view = render(<TokenExpiryGuard />);
  await waitFor(() => assert.ok(view.getByRole("alert")));

  const events: string[] = [];
  const onExpiring = () => events.push("cf:session-expiring");
  window.addEventListener("cf:session-expiring", onExpiring);
  try {
    wake();
    await waitFor(() => assert.deepEqual(events, ["cf:session-expiring"]));
  } finally {
    window.removeEventListener("cf:session-expiring", onExpiring);
  }
});

test("a refused renewal announces cf:session-expiring before leaving", async () => {
  refreshStatus = 401;
  setExpiry(60);
  const events: string[] = [];
  const onExpiring = () => events.push("cf:session-expiring");
  window.addEventListener("cf:session-expiring", onExpiring);
  try {
    render(<TokenExpiryGuard />);
    await waitFor(() => assert.deepEqual(events, ["cf:session-expiring"]));
    assert.equal(refreshCalls, 1);
  } finally {
    window.removeEventListener("cf:session-expiring", onExpiring);
  }
});
