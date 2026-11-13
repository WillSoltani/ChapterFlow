import { test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { middleware } from "../middleware";
import { REFRESH_ATTEMPT_COOKIE } from "./middleware-auth-core";

// SHELL-01: middleware sends an expired document navigation that still holds a
// refresh_token through GET /auth/refresh; everything else keeps the old
// /auth/login bounce (the @prod smoke expects that for a cookieless visitor).

const MANAGED_ENV_KEYS = [
  "NODE_ENV",
  "DEV_AUTH_BYPASS",
  "COGNITO_REGION",
  "COGNITO_USER_POOL_ID",
  "APP_BASE_URL",
  "CHAPTERFLOW_APP_BASE_URL",
  "ALLOW_APP_BASE_URL_IN_DEV",
  "ORIGIN_VERIFY_SECRET",
  "ORIGIN_VERIFY_MODE",
] as const;

function withProdEnv(run: () => void): void {
  const mutableEnv = process.env as Record<string, string | undefined>;
  const previous = new Map(MANAGED_ENV_KEYS.map((key) => [key, mutableEnv[key]] as const));
  try {
    for (const key of MANAGED_ENV_KEYS) delete mutableEnv[key];
    Object.assign(mutableEnv, {
      NODE_ENV: "production",
      DEV_AUTH_BYPASS: "0",
      COGNITO_REGION: "us-east-1",
      COGNITO_USER_POOL_ID: "pool-test",
      APP_BASE_URL: "https://app.chapterflow.ca",
    });
    run();
  } finally {
    for (const key of MANAGED_ENV_KEYS) {
      const value = previous.get(key);
      if (value === undefined) delete mutableEnv[key];
      else mutableEnv[key] = value;
    }
  }
}

const EXPIRED = String(Math.floor(Date.now() / 1000) - 60);
const HTML = "text/html,application/xhtml+xml";

function navigate(cookie: string, headers: Record<string, string> = {}): Response {
  return middleware(
    new NextRequest("https://app.chapterflow.ca/book/library/x?tab=notes", {
      headers: { accept: HTML, ...(cookie ? { cookie } : {}), ...headers },
    }),
  );
}

function location(res: Response): URL {
  const value = res.headers.get("location");
  assert.ok(value, "expected a redirect");
  return new URL(value);
}

test("a visitor with no cookies is still sent to sign-in", () => {
  withProdEnv(() => {
    const url = location(navigate(""));
    assert.equal(url.pathname, "/auth/login");
    assert.equal(url.searchParams.get("returnTo"), "/book/library/x?tab=notes");
  });
});

test("expired session plus refresh token goes through /auth/refresh with the same returnTo", () => {
  withProdEnv(() => {
    const res = navigate(`id_token=old; auth_expires_at=${EXPIRED}; refresh_token=r`);
    const url = location(res);
    assert.equal(url.origin, "https://app.chapterflow.ca");
    assert.equal(url.pathname, "/auth/refresh");
    assert.equal(url.searchParams.get("returnTo"), "/book/library/x?tab=notes");
    // The redirect never carries a token.
    assert.equal(url.search.includes("old"), false);
    assert.equal(/(^|[?&])r($|&)|=r($|&)/.test(url.search), false);
  });
});

test("expired session without a refresh token goes to sign-in", () => {
  withProdEnv(() => {
    assert.equal(location(navigate(`id_token=old; auth_expires_at=${EXPIRED}`)).pathname, "/auth/login");
  });
});

test("after one refresh attempt the next bounce goes to sign-in, not refresh again", () => {
  withProdEnv(() => {
    const res = navigate(
      `auth_expires_at=${EXPIRED}; refresh_token=r; ${REFRESH_ATTEMPT_COOKIE}=1`,
    );
    assert.equal(location(res).pathname, "/auth/login");
  });
});

test("client-side (RSC) navigations keep today's sign-in bounce", () => {
  withProdEnv(() => {
    const res = navigate(`auth_expires_at=${EXPIRED}; refresh_token=r`, {
      accept: "text/x-component",
      rsc: "1",
    });
    assert.equal(location(res).pathname, "/auth/login");
  });
});

test("a fresh session passes through", () => {
  withProdEnv(() => {
    const fresh = String(Math.floor(Date.now() / 1000) + 600);
    const res = navigate(`id_token=t; auth_expires_at=${fresh}; refresh_token=r`);
    assert.equal(res.headers.get("location"), null);
  });
});
