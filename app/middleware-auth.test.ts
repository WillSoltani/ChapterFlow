import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { middleware } from "../middleware";

// Guard for X1: in production the auth middleware must NOT redirect /app/api/*
// routes (they self-authenticate at the handler). Before the fix, the Stripe
// webhook at /app/api/book/billing/webhook was 302'd to /auth/login, so Stripe
// disabled the endpoint and payments/cancellations/refunds silently stopped.

const SAVED = {
  NODE_ENV: process.env.NODE_ENV,
  COGNITO_REGION: process.env.COGNITO_REGION,
  COGNITO_USER_POOL_ID: process.env.COGNITO_USER_POOL_ID,
  DEV_AUTH_BYPASS: process.env.DEV_AUTH_BYPASS,
};

function setEnv(v: string | undefined, key: keyof typeof SAVED): void {
  if (v === undefined) delete process.env[key];
  else process.env[key] = v;
}

function asProd(): void {
  // Production, Cognito configured, no dev bypass — the path that issues the
  // real redirect for unauthenticated requests.
  process.env.NODE_ENV = "production";
  process.env.COGNITO_REGION = "us-east-1";
  process.env.COGNITO_USER_POOL_ID = "ci-pool";
  delete process.env.DEV_AUTH_BYPASS;
}

function restoreEnv(): void {
  setEnv(SAVED.NODE_ENV, "NODE_ENV");
  setEnv(SAVED.COGNITO_REGION, "COGNITO_REGION");
  setEnv(SAVED.COGNITO_USER_POOL_ID, "COGNITO_USER_POOL_ID");
  setEnv(SAVED.DEV_AUTH_BYPASS, "DEV_AUTH_BYPASS");
}

function req(path: string): NextRequest {
  // No auth cookies — mimics Stripe (and any unauthenticated caller).
  return new NextRequest(new URL(`https://app.example.com${path}`), {
    method: "POST",
  });
}

test("X1: Stripe webhook (/app/api/*) is not redirected in production", () => {
  asProd();
  try {
    const res = middleware(req("/app/api/book/billing/webhook"));
    assert.equal(
      res.headers.get("location"),
      null,
      "webhook must reach its handler, not be 302'd to /auth/login",
    );
  } finally {
    restoreEnv();
  }
});

test("X1: other /app/api/* routes are not redirected either", () => {
  asProd();
  try {
    for (const p of [
      "/app/api/book/email/unsubscribe?token=x",
      "/app/api/book/me/settings",
    ]) {
      assert.equal(middleware(req(p)).headers.get("location"), null, p);
    }
  } finally {
    restoreEnv();
  }
});

test("UI pages still require auth: unauthenticated /app page redirects to /auth/login", () => {
  asProd();
  try {
    const res = middleware(req("/app/dashboard"));
    const loc = res.headers.get("location");
    assert.ok(
      loc && loc.includes("/auth/login"),
      "an unauthenticated protected page must still redirect to login",
    );
  } finally {
    restoreEnv();
  }
});
