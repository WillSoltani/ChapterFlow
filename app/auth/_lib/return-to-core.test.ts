import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_POST_LOGIN_PATH,
  isSafeInternalPath,
  recoverInAppReturnTo,
} from "./return-to-core";

test("accepts ordinary same-origin paths", () => {
  assert.equal(isSafeInternalPath("/"), true);
  assert.equal(isSafeInternalPath("/book"), true);
  assert.equal(isSafeInternalPath("/book/library/abc"), true);
  assert.equal(isSafeInternalPath("/book/gift/GIFT-1A2B3C4D"), true);
  assert.equal(isSafeInternalPath("/auth/callback?code=x&state=y"), true);
  // Encoded slashes stay same-origin once resolved with new URL(p, origin).
  assert.equal(isSafeInternalPath("/%2F%2Fevil.com"), true);
});

test("rejects protocol-relative and backslash open-redirects", () => {
  // The bug this guard exists to kill: //evil.com resolves to https://evil.com
  assert.equal(isSafeInternalPath("//evil.com"), false);
  assert.equal(isSafeInternalPath("//evil.com/path"), false);
  assert.equal(isSafeInternalPath("/\\evil.com"), false);
  assert.equal(isSafeInternalPath("/\\/evil.com"), false);
  assert.equal(isSafeInternalPath("\\\\evil.com"), false);
});

test("rejects control-character smuggling (tab/newline collapse to //)", () => {
  // WHATWG URL parsing strips TAB/LF/CR, so "/\t/evil.com" would become
  // "//evil.com" — reject anything carrying a control char.
  assert.equal(isSafeInternalPath("/\t/evil.com"), false);
  assert.equal(isSafeInternalPath("/\n/evil.com"), false);
  assert.equal(isSafeInternalPath("/\r/evil.com"), false);
  assert.equal(isSafeInternalPath("/\u0000/x"), false); // NUL byte
});

test("rejects absolute URLs and non-paths (handled by the allowlist branch, not here)", () => {
  assert.equal(isSafeInternalPath("https://evil.com"), false);
  assert.equal(isSafeInternalPath("http://evil.com"), false);
  assert.equal(isSafeInternalPath("javascript:alert(1)"), false);
  assert.equal(isSafeInternalPath("book/library"), false);
  assert.equal(isSafeInternalPath(""), false);
});

// SHELL-16: sign-in lands on the dashboard (un-onboarded readers are still sent
// to /book by the page gate), and a page-level INVALID_TOKEN bounce keeps the
// reader's target on any in-app surface, not only /book.
test("the post-login default is the dashboard", () => {
  assert.equal(DEFAULT_POST_LOGIN_PATH, "/dashboard");
});

test("recoverInAppReturnTo keeps in-app targets", () => {
  for (const path of [
    "/book",
    "/book/library/atomic-habits?tab=notes",
    "/dashboard",
    "/rewards",
    "/rewards?tab=redeem",
  ]) {
    assert.equal(recoverInAppReturnTo(path), path, path);
  }
  assert.equal(
    recoverInAppReturnTo("https://app.chapterflow.ca/rewards?x=1"),
    "/rewards?x=1",
  );
});

test("recoverInAppReturnTo falls back to the dashboard for anything else", () => {
  for (const candidate of [
    null,
    "",
    "/",
    "/books",
    "/auth/login?returnTo=/book",
    "//evil.example/book",
    "/\\evil.example",
    "https://evil.example//book",
    "not a url",
  ]) {
    assert.equal(recoverInAppReturnTo(candidate), DEFAULT_POST_LOGIN_PATH, String(candidate));
  }
});
