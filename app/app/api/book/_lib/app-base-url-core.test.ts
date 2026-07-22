import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resolveAppBaseUrl,
  isUsableProdBaseUrl,
  buildCoverUrl,
  encodeS3Key,
} from "./app-base-url-core";

// ---------------------------------------------------------------------------
// F12: getAppBaseUrl must NOT return a loopback CHAPTERFLOW_APP_BASE_URL
// verbatim in production. Before the fix the value was returned with only
// trailing slashes stripped, so Stripe success/return URLs could point at
// http://localhost — Stripe rejects those (or redirects the user to the wrong
// place). resolveAppBaseUrl is the pure decision behind getAppBaseUrl.
// ---------------------------------------------------------------------------

test("prod: rejects a loopback explicit base URL (the F12 bug)", () => {
  assert.throws(
    () =>
      resolveAppBaseUrl({
        explicit: "http://localhost:3000",
        reqProtocol: "https:",
        reqHost: "app.chapterflow.ca",
        isProduction: true,
      }),
    /loopback\/invalid host/
  );
});

test("prod: rejects 127.0.0.1 / ::1 / *.localhost explicit base URLs", () => {
  for (const explicit of [
    "http://127.0.0.1:3000",
    "https://[::1]",
    "https://app.localhost",
  ]) {
    assert.throws(
      () =>
        resolveAppBaseUrl({
          explicit,
          reqProtocol: "https:",
          reqHost: "app.chapterflow.ca",
          isProduction: true,
        }),
      /loopback\/invalid host/,
      `expected ${explicit} to be rejected in prod`
    );
  }
});

test("prod: rejects a non-absolute / non-http explicit base URL", () => {
  for (const explicit of ["app.chapterflow.ca", "ftp://app.chapterflow.ca", "/relative"]) {
    assert.throws(
      () =>
        resolveAppBaseUrl({
          explicit,
          reqProtocol: "https:",
          reqHost: "app.chapterflow.ca",
          isProduction: true,
        }),
      `expected ${explicit} to be rejected in prod`
    );
  }
});

test("prod: returns a valid https base URL and strips trailing slashes", () => {
  assert.equal(
    resolveAppBaseUrl({
      explicit: "https://app.chapterflow.ca///",
      reqProtocol: "https:",
      reqHost: "ignored",
      isProduction: true,
    }),
    "https://app.chapterflow.ca"
  );
});

test("prod: throws when no explicit base URL is set (no request-host fallback)", () => {
  assert.throws(
    () =>
      resolveAppBaseUrl({
        explicit: null,
        reqProtocol: "https:",
        reqHost: "internal-lb.local",
        isProduction: true,
      }),
    /is not set/
  );
});

test("dev: loopback explicit base URL is allowed verbatim", () => {
  assert.equal(
    resolveAppBaseUrl({
      explicit: "http://localhost:3000/",
      reqProtocol: "http:",
      reqHost: "localhost:3001",
      isProduction: false,
    }),
    "http://localhost:3000"
  );
});

test("dev: with no explicit value, falls back to the request host", () => {
  assert.equal(
    resolveAppBaseUrl({
      explicit: undefined,
      reqProtocol: "http:",
      reqHost: "localhost:3001",
      isProduction: false,
    }),
    "http://localhost:3001"
  );
});

test("isUsableProdBaseUrl: loopback/invalid rejected, public https accepted", () => {
  assert.equal(isUsableProdBaseUrl("https://app.chapterflow.ca"), true);
  assert.equal(isUsableProdBaseUrl("http://example.com"), true);
  assert.equal(isUsableProdBaseUrl("http://localhost:3000"), false);
  assert.equal(isUsableProdBaseUrl("http://127.0.0.1"), false);
  assert.equal(isUsableProdBaseUrl("https://[::1]"), false);
  assert.equal(isUsableProdBaseUrl("not a url"), false);
  assert.equal(isUsableProdBaseUrl("ftp://example.com"), false);
});

// ---------------------------------------------------------------------------
// WS6-012: cover URL builder. Covers move off the direct public S3 URL onto the
// canonical app origin (served by CloudFront OAC → content bucket) so the content
// bucket can enforce BLOCK_ALL. buildCoverUrl lives here (a pre-existing shared,
// server-only-free module) rather than a new module, which would grow the
// app+book shared TypeScript closure via library-catalog.ts's importers.
// ---------------------------------------------------------------------------

test("buildCoverUrl builds a cover URL on the app base origin", () => {
  assert.equal(
    buildCoverUrl(
      "https://app.chapterflow.ca",
      "book-content/library/covers/the-power-of-habit.svg"
    ),
    "https://app.chapterflow.ca/book-content/library/covers/the-power-of-habit.svg"
  );
});

test("buildCoverUrl strips a trailing slash so the URL never doubles the separator", () => {
  assert.equal(
    buildCoverUrl(
      "https://app.chapterflow.ca/",
      "book-content/library/covers/make-time.svg"
    ),
    "https://app.chapterflow.ca/book-content/library/covers/make-time.svg"
  );
});

test("buildCoverUrl percent-encodes key segments while preserving the path separators", () => {
  assert.equal(
    buildCoverUrl(
      "https://app.chapterflow.ca",
      "book-content/library/covers/a b & c.svg"
    ),
    "https://app.chapterflow.ca/book-content/library/covers/a%20b%20%26%20c.svg"
  );
});

test("encodeS3Key encodes each segment but keeps the slashes", () => {
  assert.equal(
    encodeS3Key("book-content/library/covers/x y.svg"),
    "book-content/library/covers/x%20y.svg"
  );
});
