import { test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { middleware } from "../middleware";

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

function withMiddlewareEnv(
  values: Partial<Record<(typeof MANAGED_ENV_KEYS)[number], string>>,
  run: () => void,
): void {
  const mutableEnv = process.env as Record<string, string | undefined>;
  const previous = new Map(
    MANAGED_ENV_KEYS.map((key) => [key, mutableEnv[key]] as const),
  );
  try {
    for (const key of MANAGED_ENV_KEYS) delete mutableEnv[key];
    Object.assign(mutableEnv, values);
    run();
  } finally {
    for (const key of MANAGED_ENV_KEYS) {
      const value = previous.get(key);
      if (value === undefined) delete mutableEnv[key];
      else mutableEnv[key] = value;
    }
  }
}

function protectedRequest(headers: Record<string, string>): NextRequest {
  return new NextRequest(
    "https://framework-origin.internal/book/library?chapter=2",
    { headers },
  );
}

test("GAP-01: attacker forwarded host never becomes the login redirect authority", () => {
  withMiddlewareEnv(
    {
      NODE_ENV: "production",
      DEV_AUTH_BYPASS: "0",
      COGNITO_REGION: "us-east-1",
      COGNITO_USER_POOL_ID: "pool-test",
    },
    () => {
      const response = middleware(
        protectedRequest({
          host: "app.chapterflow.ca",
          "x-forwarded-host": "evil.example, app.chapterflow.ca",
          "x-forwarded-proto": "https",
        }),
      );

      assert.equal(response.status, 307);
      const location = new URL(response.headers.get("location") ?? "");
      assert.equal(location.origin, "https://framework-origin.internal");
      assert.equal(location.pathname, "/auth/login");
      assert.equal(
        location.searchParams.get("returnTo"),
        "/book/library?chapter=2",
      );
    },
  );
});

test("PR #411 origin verification remains the first security decision", () => {
  withMiddlewareEnv(
    {
      NODE_ENV: "production",
      DEV_AUTH_BYPASS: "0",
      COGNITO_REGION: "us-east-1",
      COGNITO_USER_POOL_ID: "pool-test",
      ORIGIN_VERIFY_SECRET: "expected-test-secret",
      ORIGIN_VERIFY_MODE: "enforce",
    },
    () => {
      const response = middleware(
        protectedRequest({
          "x-origin-verify": "wrong-test-secret",
          "x-forwarded-host": "evil.example",
        }),
      );
      assert.equal(response.status, 403);
      assert.equal(response.headers.get("content-type"), "application/json");
      assert.equal(response.headers.has("location"), false);
    },
  );
});

test("API routing still passes through after origin verification", () => {
  withMiddlewareEnv({ NODE_ENV: "production" }, () => {
    const response = middleware(
      new NextRequest("https://app.chapterflow.ca/app/api/book/books"),
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-middleware-next"), "1");
  });
});
