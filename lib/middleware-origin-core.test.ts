import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resolveMiddlewareOrigin,
  type MiddlewareOriginEnv,
} from "./middleware-origin-core";

const TRUSTED_FRAMEWORK_ORIGIN = "https://chapterflow.ca";

function env(
  overrides: Partial<MiddlewareOriginEnv> = {},
): MiddlewareOriginEnv {
  return {
    nodeEnv: "production",
    ...overrides,
  };
}

function resolve(
  request: Partial<Parameters<typeof resolveMiddlewareOrigin>[0]> = {},
  environment: Partial<MiddlewareOriginEnv> = {},
): string | null {
  return resolveMiddlewareOrigin(
    {
      fallbackOrigin: TRUSTED_FRAMEWORK_ORIGIN,
      ...request,
    },
    env(environment),
  );
}

test("configured APP_BASE_URL wins over CHAPTERFLOW_APP_BASE_URL and request headers", () => {
  assert.equal(
    resolve(
      {
        forwardedHostHeader: "evil.example",
        forwardedProtoHeader: "https",
      },
      {
        appBaseUrl: "https://app.chapterflow.ca/",
        chapterFlowAppBaseUrl: "https://chapterflow.ca",
      },
    ),
    "https://app.chapterflow.ca",
  );
});

test("configured CHAPTERFLOW_APP_BASE_URL wins when APP_BASE_URL is absent", () => {
  assert.equal(
    resolve(
      { hostHeader: "evil.example" },
      { chapterFlowAppBaseUrl: "https://app.chapterflow.ca/" },
    ),
    "https://app.chapterflow.ca",
  );
});

test("invalid or production-loopback configured bases are ignored safely", () => {
  for (const appBaseUrl of [
    "javascript:alert(1)",
    "https://user@app.chapterflow.ca",
    "http://localhost:3000",
  ]) {
    assert.equal(resolve({}, { appBaseUrl }), TRUSTED_FRAMEWORK_ORIGIN);
  }
});

test("production attacker forwarded or Host authorities fall back to the framework origin", () => {
  for (const request of [
    { forwardedHostHeader: "evil.example", hostHeader: "app.chapterflow.ca" },
    { hostHeader: "evil.example" },
    { forwardedHostHeader: "app.chapterflow.ca.evil.example" },
    { forwardedHostHeader: "evil.example@app.chapterflow.ca" },
    { forwardedHostHeader: "app.chapterflow.ca/path" },
    { forwardedHostHeader: "app.chapterflow.ca?evil" },
  ]) {
    assert.equal(resolve(request), TRUSTED_FRAMEWORK_ORIGIN);
  }
});

test("production rejects attacker-controlled request and fallback authorities", () => {
  assert.equal(
    resolve({
      forwardedHostHeader: "evil.example",
      hostHeader: "evil.example",
      fallbackOrigin: "https://evil.example",
    }),
    null,
  );
});

test("the first forwarded host value controls the decision", () => {
  assert.equal(
    resolve({
      forwardedHostHeader: "evil.example, app.chapterflow.ca",
      hostHeader: "app.chapterflow.ca",
    }),
    TRUSTED_FRAMEWORK_ORIGIN,
  );
  assert.equal(
    resolve({
      forwardedHostHeader: "app.chapterflow.ca, evil.example",
      hostHeader: "evil.example",
    }),
    "https://app.chapterflow.ca",
  );
});

test("production accepts exactly the two canonical HTTPS hosts", () => {
  assert.equal(
    resolve({ hostHeader: "chapterflow.ca" }),
    "https://chapterflow.ca",
  );
  assert.equal(
    resolve({ forwardedHostHeader: "APP.CHAPTERFLOW.CA" }),
    "https://app.chapterflow.ca",
  );
});

test("canonical default ports normalize and non-default or invalid ports fail closed", () => {
  assert.equal(
    resolve({
      forwardedHostHeader: "app.chapterflow.ca:443",
      forwardedProtoHeader: "https",
    }),
    "https://app.chapterflow.ca",
  );
  for (const forwardedHostHeader of [
    "app.chapterflow.ca:8443",
    "app.chapterflow.ca:99999",
    "app.chapterflow.ca:not-a-port",
  ]) {
    assert.equal(resolve({ forwardedHostHeader }), TRUSTED_FRAMEWORK_ORIGIN);
  }
});

test("protocol parsing accepts HTTPS/defaults and rejects downgrade or non-HTTP schemes in production", () => {
  assert.equal(
    resolve({
      forwardedHostHeader: "app.chapterflow.ca",
      forwardedProtoHeader: "https, http",
    }),
    "https://app.chapterflow.ca",
  );
  assert.equal(
    resolve({ forwardedHostHeader: "app.chapterflow.ca" }),
    "https://app.chapterflow.ca",
  );
  for (const forwardedProtoHeader of ["http", "ftp", "javascript", "https:"]) {
    assert.equal(
      resolve({
        forwardedHostHeader: "app.chapterflow.ca",
        forwardedProtoHeader,
      }),
      TRUSTED_FRAMEWORK_ORIGIN,
    );
  }
});

test("development preserves valid request-host and loopback port behavior", () => {
  assert.equal(
    resolve(
      { hostHeader: "localhost:3001" },
      { nodeEnv: "development" },
    ),
    "http://localhost:3001",
  );
  assert.equal(
    resolve(
      { hostHeader: "[::1]:3010" },
      { nodeEnv: "development" },
    ),
    "http://[::1]:3010",
  );
  assert.equal(
    resolve(
      { hostHeader: "preview.internal:3002" },
      { nodeEnv: "development" },
    ),
    "http://preview.internal:3002",
  );
});

test("development configured-base gating remains unchanged", () => {
  assert.equal(
    resolve(
      { hostHeader: "localhost:3001" },
      {
        nodeEnv: "development",
        appBaseUrl: "https://preview.internal",
      },
    ),
    "http://localhost:3001",
  );
  assert.equal(
    resolve(
      { hostHeader: "localhost:3001" },
      {
        nodeEnv: "development",
        appBaseUrl: "https://preview.internal",
        allowAppBaseUrlInDev: "1",
      },
    ),
    "https://preview.internal",
  );
});
