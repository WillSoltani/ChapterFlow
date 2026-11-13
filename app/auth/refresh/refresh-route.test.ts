import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";

import { installServerOnlyShim } from "@/tests/_lib/server-only-shim";
import { REFRESH_ATTEMPT_COOKIE } from "@/lib/middleware-auth-core";

// SHELL-01: GET /auth/refresh (cold-load renewal) and the unchanged POST
// contract. Cognito is a mocked fetch; every env the route resolves is set so
// nothing reaches SSM or DynamoDB (the mocked id token carries no `sub`, so the
// deleted-account lookup is skipped).

type RouteModule = typeof import("./route");
let route: RouteModule;
let restoreServerOnly: (() => void) | undefined;
const realFetch = globalThis.fetch;
const ENV = {
  COGNITO_CUSTOM_DOMAIN: "https://auth.test.example",
  COGNITO_CLIENT_ID: "client-test",
} as const;
const previousEnv = new Map<string, string | undefined>();

let fetchCalls = 0;
let cognitoReply: () => Response = () => new Response("{}", { status: 400 });

before(async () => {
  for (const [key, value] of Object.entries(ENV)) {
    previousEnv.set(key, process.env[key]);
    process.env[key] = value;
  }
  restoreServerOnly = installServerOnlyShim();
  route = await import("./route");
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    return cognitoReply();
  }) as typeof fetch;
});

after(() => {
  globalThis.fetch = realFetch;
  restoreServerOnly?.();
  for (const [key, value] of previousEnv) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

beforeEach(() => {
  fetchCalls = 0;
  cognitoReply = () => new Response("{}", { status: 400 });
});

const EXPIRED = String(Math.floor(Date.now() / 1000) - 60);
const FRESH = String(Math.floor(Date.now() / 1000) + 600);
let deviceSeq = 0;

function get(returnTo: string | null, cookie: string): NextRequest {
  const url = new URL("http://localhost/auth/refresh");
  if (returnTo !== null) url.searchParams.set("returnTo", returnTo);
  deviceSeq += 1;
  return new NextRequest(url, {
    headers: { cookie: `cf_device=dev-${deviceSeq}; ${cookie}` },
  });
}

function tokens(): Response {
  // header.payload.signature with a payload that has no `sub`.
  const idToken = `e30.${Buffer.from("{}").toString("base64url")}.sig`;
  return Response.json({ id_token: idToken, access_token: "new-access", expires_in: 3600 });
}

function location(res: Response): URL {
  const value = res.headers.get("location");
  assert.ok(value, "expected a redirect");
  return new URL(value);
}

function setCookie(res: Response, name: string): string | undefined {
  return res.headers
    .getSetCookie()
    .find((line) => line.startsWith(`${name}=`));
}

test("expired session without a refresh token goes to sign-in, no exchange", async () => {
  const res = await route.GET(get("/book/library/x", `auth_expires_at=${EXPIRED}`));
  const url = location(res);
  assert.equal(url.pathname, "/auth/login");
  assert.equal(url.searchParams.get("returnTo"), "/book/library/x");
  assert.equal(fetchCalls, 0);
});

test("expired session plus refresh token renews and returns to the page", async () => {
  cognitoReply = tokens;
  const res = await route.GET(
    get("/book/library/x?tab=notes", `auth_expires_at=${EXPIRED}; refresh_token=secret-refresh`),
  );
  const url = location(res);
  assert.equal(url.pathname, "/book/library/x");
  assert.equal(url.search, "?tab=notes");
  assert.equal(fetchCalls, 1);
  assert.ok(setCookie(res, "id_token")?.includes("HttpOnly"));
  assert.ok(setCookie(res, "auth_expires_at"));
  assert.ok(setCookie(res, "cf_auth_generation"));
  const marker = setCookie(res, REFRESH_ATTEMPT_COOKIE);
  assert.ok(marker?.includes("HttpOnly"));
  assert.equal(/domain=/i.test(marker ?? ""), false);
  // No token ever appears in the redirect URL.
  assert.equal(url.href.includes("secret-refresh"), false);
  assert.equal(url.href.includes("new-access"), false);
});

test("a rejected refresh token falls through to sign-in and is cleared", async () => {
  const res = await route.GET(
    get("/dashboard", `auth_expires_at=${EXPIRED}; refresh_token=revoked`),
  );
  const url = location(res);
  assert.equal(url.pathname, "/auth/login");
  assert.equal(url.searchParams.get("returnTo"), "/dashboard");
  assert.match(setCookie(res, "refresh_token") ?? "", /Max-Age=0/);
  assert.ok(setCookie(res, REFRESH_ATTEMPT_COOKIE));
});

test("an upstream outage falls through to sign-in without touching the refresh token", async () => {
  cognitoReply = () => {
    throw new Error("network down");
  };
  const res = await route.GET(get("/dashboard", `refresh_token=r`));
  assert.equal(location(res).pathname, "/auth/login");
  assert.equal(setCookie(res, "refresh_token"), undefined);
});

test("open-redirect attempts in returnTo land on the dashboard", async () => {
  for (const evil of ["https://evil.example/x", "//evil.example", "/\\evil.example", "/auth/logout"]) {
    cognitoReply = tokens;
    const res = await route.GET(get(evil, `refresh_token=r`));
    const url = location(res);
    assert.equal(url.origin, "http://localhost", evil);
    assert.equal(url.pathname, "/dashboard", evil);
  }
});

test("no second exchange once a refresh was attempted for this navigation", async () => {
  cognitoReply = tokens;
  const res = await route.GET(
    get("/book", `auth_expires_at=${EXPIRED}; refresh_token=r; ${REFRESH_ATTEMPT_COOKIE}=1`),
  );
  assert.equal(location(res).pathname, "/auth/login");
  assert.equal(fetchCalls, 0);
});

test("a session that is already fresh returns straight away", async () => {
  const res = await route.GET(get("/book", `id_token=t; auth_expires_at=${FRESH}; refresh_token=r`));
  assert.equal(location(res).pathname, "/book");
  assert.equal(fetchCalls, 0);
});

test("no GET response can be cached, since renewals carry session cookies", async () => {
  const cases: Array<[() => Response, string]> = [
    [tokens, `auth_expires_at=${EXPIRED}; refresh_token=r`],
    [() => new Response("{}", { status: 400 }), `refresh_token=r`],
    [tokens, `auth_expires_at=${EXPIRED}`],
    [tokens, `id_token=t; auth_expires_at=${FRESH}`],
    [tokens, `refresh_token=r; ${REFRESH_ATTEMPT_COOKIE}=1`],
  ];
  for (const [reply, cookie] of cases) {
    cognitoReply = reply;
    const res = await route.GET(get("/dashboard", cookie));
    assert.equal(res.headers.get("cache-control"), "no-store", cookie);
  }
});

test("POST keeps its JSON contract for TokenExpiryGuard", async () => {
  cognitoReply = tokens;
  const res = await route.POST(
    new NextRequest("http://localhost/auth/refresh", {
      method: "POST",
      headers: { cookie: "cf_device=post-1; refresh_token=r" },
    }),
  );
  assert.equal(res.status, 200);
  const body = (await res.json()) as { ok: boolean; expiresAt: number };
  assert.equal(body.ok, true);
  assert.equal(typeof body.expiresAt, "number");
  assert.ok(setCookie(res, "id_token"));
  assert.equal(setCookie(res, REFRESH_ATTEMPT_COOKIE), undefined);

  cognitoReply = () => new Response("{}", { status: 400 });
  const rejected = await route.POST(
    new NextRequest("http://localhost/auth/refresh", {
      method: "POST",
      headers: { cookie: "cf_device=post-2; refresh_token=r" },
    }),
  );
  assert.equal(rejected.status, 401);
  const err = (await rejected.json()) as { error: { code: string } };
  assert.equal(err.error.code, "refresh_rejected");
});
