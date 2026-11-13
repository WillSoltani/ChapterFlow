import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import {
  BookClientError,
  UNAUTHORIZED_REDIRECT_KEY,
  fetchBookJson,
  planUnauthorizedRedirect,
  resetUnauthorizedRedirectForTests,
} from "./book-api";

// DATA-08: a lapsed session used to look like "your library may not be
// published yet". A plain 401 now sends the reader through /auth/refresh once
// (which renews or falls through to sign-in), then to sign-in, then gives up,
// so it can never loop.

const NOW = 1_800_000_000_000;

test("plan: refresh first, then sign-in, then stop", () => {
  const err = new BookClientError("x", 401, "unauthenticated");
  assert.equal(planUnauthorizedRedirect(err, null, NOW), "refresh");
  assert.equal(planUnauthorizedRedirect(err, { at: NOW - 1000, count: 1 }, NOW), "login");
  assert.equal(planUnauthorizedRedirect(err, { at: NOW - 1000, count: 2 }, NOW), "none");
  // An old attempt no longer counts.
  assert.equal(planUnauthorizedRedirect(err, { at: NOW - 10 * 60_000, count: 2 }, NOW), "refresh");
});

test("plan: step-up re-auth and non-401 errors are left to their callers", () => {
  assert.equal(
    planUnauthorizedRedirect(new BookClientError("x", 401, "reauth_required"), null, NOW),
    "none",
  );
  assert.equal(
    planUnauthorizedRedirect(new BookClientError("x", 401, "x", { reauth: true }), null, NOW),
    "none",
  );
  assert.equal(planUnauthorizedRedirect(new BookClientError("x", 403, "forbidden"), null, NOW), "none");
  assert.equal(planUnauthorizedRedirect(new BookClientError("x", 500), null, NOW), "none");
});

type FakeWindow = {
  location: { pathname: string; search: string; assign: (url: string) => void };
  sessionStorage: Map<string, string> & {
    getItem(k: string): string | null;
    setItem(k: string, v: string): void;
  };
};

const realFetch = globalThis.fetch;
let assigned: string[] = [];

function installWindow(pathname: string, search = ""): void {
  const store = new Map<string, string>() as FakeWindow["sessionStorage"];
  store.getItem = (k) => store.get(k) ?? null;
  store.setItem = (k, v) => void store.set(k, v);
  const fake: FakeWindow = {
    location: { pathname, search, assign: (url) => void assigned.push(url) },
    sessionStorage: store,
  };
  (globalThis as unknown as { window?: FakeWindow }).window = fake;
}

beforeEach(() => {
  assigned = [];
  resetUnauthorizedRedirectForTests();
  globalThis.fetch = (async () =>
    Response.json(
      { error: { code: "unauthenticated", message: "Authentication is required." } },
      { status: 401 },
    )) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
  delete (globalThis as unknown as { window?: unknown }).window;
  delete (globalThis as unknown as { document?: unknown }).document;
});

test("a 401 after sign-out rotated the session does not hijack the sign-out", async () => {
  installWindow("/book/settings");
  const doc = { cookie: "cf_auth_generation=11111111-1111-4111-8111-111111111111" };
  (globalThis as unknown as { document: typeof doc }).document = doc;
  globalThis.fetch = (async () => {
    // /auth/logout's response rotated the generation while this was in flight.
    doc.cookie = "cf_auth_generation=22222222-2222-4222-8222-222222222222";
    return Response.json({ error: { code: "unauthenticated", message: "x" } }, { status: 401 });
  }) as typeof fetch;
  await assert.rejects(fetchBookJson("/app/api/book/me/library"));
  assert.deepEqual(assigned, []);
});

test("a 401 sends the reader through refresh once with the current page as returnTo", async () => {
  installWindow("/book/library", "?q=habits");
  await assert.rejects(fetchBookJson("/app/api/book/me/library"), (e: unknown) => {
    return e instanceof BookClientError && e.status === 401;
  });
  // A second failing request on the same page does not navigate again.
  await assert.rejects(fetchBookJson("/app/api/book/me/profile"));
  assert.deepEqual(assigned, ["/auth/refresh?returnTo=%2Fbook%2Flibrary%3Fq%3Dhabits"]);
  const stamp = JSON.parse(
    (globalThis as unknown as { window: FakeWindow }).window.sessionStorage.getItem(
      UNAUTHORIZED_REDIRECT_KEY,
    ) ?? "null",
  ) as { count: number };
  assert.equal(stamp.count, 1);
});

test("the next page load after a failed refresh goes to sign-in, then stops", async () => {
  installWindow("/dashboard");
  const win = (globalThis as unknown as { window: FakeWindow }).window;
  win.sessionStorage.setItem(UNAUTHORIZED_REDIRECT_KEY, JSON.stringify({ at: Date.now(), count: 1 }));
  await assert.rejects(fetchBookJson("/app/api/book/me/library"));
  assert.deepEqual(assigned, ["/auth/login?returnTo=%2Fdashboard"]);

  resetUnauthorizedRedirectForTests();
  assigned = [];
  await assert.rejects(fetchBookJson("/app/api/book/me/library"));
  assert.deepEqual(assigned, []);
});

test("a reauth_required 401 does not trigger the session redirect", async () => {
  installWindow("/book/settings");
  globalThis.fetch = (async () =>
    Response.json({ error: { code: "reauth_required", message: "x" } }, { status: 401 })) as typeof fetch;
  await assert.rejects(fetchBookJson("/app/api/book/me/export"));
  assert.deepEqual(assigned, []);
});
