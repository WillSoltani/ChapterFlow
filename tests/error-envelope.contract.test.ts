import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";

import { installServerOnlyShim } from "@/tests/_lib/server-only-shim";
import { buildSessionResponse } from "@/app/app/api/_lib/session-response-core";

// Every JSON error response across the three route stacks (`app/api/**`,
// `app/auth/**`, `app/app/api/**`) must serialize the canonical envelope
// `{ error: { code, message, requestId } }`. These tests hit each handler's
// failure path (or its extracted error mapper) and assert the shared shape.
//
// The auth/me/session modules pull in `server-only` at load time, so they are
// dynamically imported under installServerOnlyShim() (pattern proven in
// app/auth/_lib/auth-cache-generation.test.ts).

let restoreServerOnly: (() => void) | undefined;
let bookRequestsPOST: typeof import("@/app/api/book-requests/route").POST;
let refreshPOST: typeof import("@/app/auth/refresh/route").POST;

before(async () => {
  restoreServerOnly = installServerOnlyShim();
  ({ POST: bookRequestsPOST } = await import("@/app/api/book-requests/route"));
  ({ POST: refreshPOST } = await import("@/app/auth/refresh/route"));
});

after(() => restoreServerOnly?.());

function assertEnvelope(body: unknown, code: string): void {
  const b = body as { error?: { code?: unknown; message?: unknown; requestId?: unknown } };
  assert.equal(b.error?.code, code);
  assert.equal(typeof b.error?.message, "string");
  assert.equal(typeof b.error?.requestId, "string");
}

function bookRequestPost(body: unknown, ip: string): Request {
  return new Request("http://localhost/api/book-requests", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function withDevEnv<T>(run: () => Promise<T>): Promise<T> {
  const savedTable = process.env.BOOK_TABLE_NAME;
  delete process.env.BOOK_TABLE_NAME;
  return run().finally(() => {
    if (savedTable === undefined) delete process.env.BOOK_TABLE_NAME;
    else process.env.BOOK_TABLE_NAME = savedTable;
  });
}

// ── (a) book-requests intake failure paths ──────────────────────────────────

test("book-requests invalid_json → envelope", () =>
  withDevEnv(async () => {
    const res = await bookRequestsPOST(bookRequestPost("{not json", "198.51.100.1"));
    assert.equal(res.status, 400);
    assertEnvelope(await res.json(), "invalid_json");
  }));

test("book-requests invalid_title → envelope", () =>
  withDevEnv(async () => {
    const res = await bookRequestsPOST(
      bookRequestPost({ title: "x", email: "reader@example.com" }, "198.51.100.2"),
    );
    assert.equal(res.status, 400);
    assertEnvelope(await res.json(), "invalid_title");
  }));

test("book-requests invalid_email → envelope", () =>
  withDevEnv(async () => {
    const res = await bookRequestsPOST(
      bookRequestPost({ title: "A Good Title", email: "not-an-email" }, "198.51.100.3"),
    );
    assert.equal(res.status, 400);
    assertEnvelope(await res.json(), "invalid_email");
  }));

test("book-requests rate_limited → envelope after cap", () =>
  withDevEnv(async () => {
    const ip = "198.51.100.99";
    let last: Response | undefined;
    for (let i = 0; i < 11; i++) {
      last = await bookRequestsPOST(
        bookRequestPost({ title: "A Good Title", email: "reader@example.com" }, ip),
      );
    }
    assert.equal(last!.status, 429);
    assertEnvelope(await last!.json(), "rate_limited");
  }));

// ── (b) auth/refresh failure paths ──────────────────────────────────────────

test("auth/refresh with no refresh_token cookie → 401 envelope", async () => {
  const req = new NextRequest("http://localhost/auth/refresh", {
    method: "POST",
    headers: { "x-forwarded-for": "203.0.113.201" },
  });
  const res = await refreshPOST(req);
  assert.equal(res.status, 401);
  assertEnvelope(await res.json(), "no_refresh_token");
});

test("auth/refresh rate_limited → 429 envelope with Retry-After", async () => {
  const ip = "203.0.113.202";
  let last: Response | undefined;
  for (let i = 0; i < 11; i++) {
    last = await refreshPOST(
      new NextRequest("http://localhost/auth/refresh", {
        method: "POST",
        headers: { "x-forwarded-for": ip },
      }),
    );
  }
  assert.equal(last!.status, 429);
  assert.equal(last!.headers.get("retry-after"), "30");
  assertEnvelope(await last!.json(), "rate_limited");
});

// ── (c) me / session status-probe stack via the shared mapper ───────────────
// The /app/api/me and /app/api/auth/session routes now delegate to one shared
// handler whose pure mapper (buildSessionResponse) owns the envelope shape
// (WS4-003). The old per-route buildMeErrorResponse/buildSessionErrorResponse
// mappers are superseded, so the app/app/api stack's envelope contract is
// asserted here through that single mapper.

test("session-status verifier-unavailable → 503 envelope with loggedIn:null", () => {
  const r = buildSessionResponse({ kind: "verifier_unavailable" }, "req-id-1");
  assert.equal(r.status, 503);
  assert.equal((r.body as { loggedIn?: unknown }).loggedIn, null);
  assertEnvelope(r.body, "verifier_unavailable");
});

test("session-status unexpected error → 503 envelope (never a logged-out flip)", () => {
  const r = buildSessionResponse({ kind: "unexpected" }, "req-id-2");
  assert.equal(r.status, 503);
  assert.equal((r.body as { loggedIn?: unknown }).loggedIn, null);
  assertEnvelope(r.body, "verifier_unavailable");
});
