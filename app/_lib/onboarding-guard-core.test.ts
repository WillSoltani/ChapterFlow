import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldRethrowOnboardingGuardError } from "./onboarding-guard-core";

test("re-throws a Next.js redirect (digest-carrying) so the /dashboard bounce fires", () => {
  const redirectError = Object.assign(new Error("NEXT_REDIRECT"), {
    digest: "NEXT_REDIRECT;replace;/dashboard;307;",
  });
  assert.equal(shouldRethrowOnboardingGuardError(redirectError), true);

  // Plain object form (not an Error) — still a redirect, still propagate.
  assert.equal(
    shouldRethrowOnboardingGuardError({ digest: "NEXT_REDIRECT;..." }),
    true
  );
});

test("re-throws an AuthError (duck-typed by name) so it reaches the auth boundary", () => {
  const authError = new Error("INVALID_TOKEN");
  authError.name = "AuthError";
  assert.equal(shouldRethrowOnboardingGuardError(authError), true);
});

test("fails OPEN on the locally-unset data plane (BOOK_TABLE_NAME)", () => {
  // getBookTableName() → mustServerEnv() throws this in dev/CI with no data plane.
  const err = new Error("Missing env var: BOOK_TABLE_NAME");
  assert.equal(shouldRethrowOnboardingGuardError(err), false);
});

test("fails OPEN on a transient DynamoDB/network error", () => {
  // Regression: app/book/page.tsx previously RE-THREW this (error-paging a real
  // user), while app/onboarding/page.tsx swallowed it. The unified policy
  // swallows it on both routes — this assertion would fail under /book's old
  // inline catch policy.
  const ddbError = new Error("ProvisionedThroughputExceededException");
  assert.equal(shouldRethrowOnboardingGuardError(ddbError), false);
});

test("fails OPEN on null / non-object throwables", () => {
  assert.equal(shouldRethrowOnboardingGuardError(null), false);
  assert.equal(shouldRethrowOnboardingGuardError(undefined), false);
  assert.equal(shouldRethrowOnboardingGuardError("some string"), false);
});
