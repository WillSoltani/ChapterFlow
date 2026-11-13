import "../../../tests/_lib/dom";

import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { SearchParamsContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import PairAcceptPage from "./page";

// next/link's idle-callback fallback reads `self`, which jsdom globals omit.
Object.defineProperty(globalThis, "self", { configurable: true, writable: true, value: globalThis });

let posts: string[] = [];

globalThis.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
  const url = String(input);
  if ((init.method ?? "GET").toUpperCase() === "POST") posts.push(url);
  return new Response(
    JSON.stringify({ pair: { userId: "u1", partnerId: "u2", pairedAt: "2026-11-13T00:00:00.000Z" }, accepted: true }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}) as typeof fetch;

const router = {
  push() {},
  replace() {},
  refresh() {},
  back() {},
  forward() {},
  prefetch() {},
} as unknown as AppRouterInstance;

function renderAt(search: string) {
  return render(
    <AppRouterContext.Provider value={router}>
      <SearchParamsContext.Provider value={new URLSearchParams(search)}>
        <PairAcceptPage />
      </SearchParamsContext.Provider>
    </AppRouterContext.Provider>,
  );
}

async function flush() {
  await act(async () => {
    for (let i = 0; i < 5; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

beforeEach(() => {
  posts = [];
});

afterEach(() => {
  cleanup();
});

test("an invite link waits for an explicit Accept invite and says what is shared", async () => {
  renderAt("code=ABC123");
  await flush();

  assert.deepEqual(posts, [], "opening the link must not accept the invite");
  assert.ok(screen.getByText("ABC123"));
  assert.match(document.body.textContent ?? "", /streak/i, "the step says what partners see");

  fireEvent.click(screen.getByRole("button", { name: "Accept invite" }));
  await flush();

  assert.deepEqual(posts, ["/app/api/book/me/pairs/accept/ABC123"]);
  assert.ok(screen.getByText(/reading partners/i));
});

test("without a code the page offers a code field instead of a dead end", async () => {
  renderAt("");
  await flush();

  const input = screen.getByLabelText("Invite code") as HTMLInputElement;
  const accept = screen.getByRole("button", { name: "Accept invite" }) as HTMLButtonElement;
  assert.equal(accept.disabled, true, "nothing to accept until a code is typed");

  fireEvent.change(input, { target: { value: " abc123 " } });
  assert.equal(accept.disabled, false);
  fireEvent.click(accept);
  await flush();

  assert.deepEqual(posts, ["/app/api/book/me/pairs/accept/ABC123"]);
});
