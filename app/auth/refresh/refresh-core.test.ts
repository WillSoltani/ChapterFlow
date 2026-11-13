import { test } from "node:test";
import assert from "node:assert/strict";
import {
  REFRESH_DEFAULT_RETURN_TO,
  loginPathFor,
  planRefreshGet,
  resolveRefreshReturnTo,
} from "./refresh-core";

test("keeps a same-origin path with its query", () => {
  assert.equal(resolveRefreshReturnTo("/book/library/x?tab=notes"), "/book/library/x?tab=notes");
  assert.equal(resolveRefreshReturnTo("/dashboard"), "/dashboard");
});

test("rejects open-redirect attempts and falls back to the dashboard", () => {
  for (const raw of [
    "https://evil.example/",
    "https://app.chapterflow.ca/book",
    "//evil.example",
    "/\\evil.example",
    "/\t/evil.example",
    "javascript:alert(1)",
    "",
    null,
    undefined,
  ]) {
    assert.equal(resolveRefreshReturnTo(raw), REFRESH_DEFAULT_RETURN_TO, String(raw));
  }
});

test("never returns into an /auth route, so refresh cannot chain into itself", () => {
  for (const raw of [
    "/auth/refresh?returnTo=/auth/refresh",
    "/auth/logout",
    "/AUTH/login",
    "/auth",
    // Dot segments and encoded dots resolve into /auth once the URL is built.
    "/./auth/logout",
    "/%2e/auth/logout",
    "/%2E%2E/auth/logout",
    "/book/../auth/logout",
    "/book/%2e%2e/auth/refresh",
  ]) {
    assert.equal(resolveRefreshReturnTo(raw), REFRESH_DEFAULT_RETURN_TO, raw);
  }
});

test("plans one exchange at most", () => {
  assert.equal(
    planRefreshGet({ sessionFresh: true, refreshAttempted: true, hasRefreshToken: true }),
    "return",
  );
  assert.equal(
    planRefreshGet({ sessionFresh: false, refreshAttempted: false, hasRefreshToken: true }),
    "exchange",
  );
  assert.equal(
    planRefreshGet({ sessionFresh: false, refreshAttempted: true, hasRefreshToken: true }),
    "login",
  );
  assert.equal(
    planRefreshGet({ sessionFresh: false, refreshAttempted: false, hasRefreshToken: false }),
    "login",
  );
});

test("the sign-in fallback carries the sanitized returnTo", () => {
  assert.equal(
    loginPathFor("/book/library/x?a=1&b=2"),
    "/auth/login?returnTo=%2Fbook%2Flibrary%2Fx%3Fa%3D1%26b%3D2",
  );
});
