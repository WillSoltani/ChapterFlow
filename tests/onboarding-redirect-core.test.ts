import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { shouldRedirectToOnboarding } from "@/hooks/book/onboarding-redirect-core";

// SHELL-02 / PROG-06 / DATA-03: a client page sends the reader to onboarding
// only when the server has positively said this account is not onboarded. A
// fresh browser (local default setupComplete=false), a pending check or a
// failed check never redirects. (Lives in tests/ because npm run test does not
// discover tests under hooks/.)

const base = { hydrated: true, setupComplete: false };

test("fresh browser, server check still pending: no redirect", () => {
  assert.equal(shouldRedirectToOnboarding({ ...base, serverAnswer: undefined }), false);
});

test("server check failed (no answer): no redirect", () => {
  assert.equal(shouldRedirectToOnboarding({ ...base, serverAnswer: undefined }), false);
  assert.equal(shouldRedirectToOnboarding({ ...base, serverAnswer: {} }), false);
  assert.equal(
    shouldRedirectToOnboarding({ ...base, serverAnswer: { onboardingCompleted: null } }),
    false,
  );
});

test("server says onboarded: no redirect", () => {
  assert.equal(
    shouldRedirectToOnboarding({ ...base, serverAnswer: { onboardingCompleted: true } }),
    false,
  );
});

test("server positively says not onboarded: redirect", () => {
  assert.equal(
    shouldRedirectToOnboarding({ ...base, serverAnswer: { onboardingCompleted: false } }),
    true,
  );
});

test("local state already complete, not hydrated yet, or caller opts out: no redirect", () => {
  const no = { onboardingCompleted: false };
  assert.equal(shouldRedirectToOnboarding({ ...base, setupComplete: true, serverAnswer: no }), false);
  assert.equal(shouldRedirectToOnboarding({ ...base, hydrated: false, serverAnswer: no }), false);
  assert.equal(shouldRedirectToOnboarding({ ...base, skip: true, serverAnswer: no }), false);
});

// The nine client pages use the shared rule; none redirects to onboarding on
// its own.
const ONBOARDING_REDIRECT_PAGES = [
  "app/book/library/[bookId]/BookDetailClient.tsx",
  "app/book/badges/BookBadgesClient.tsx",
  "app/book/profile/BookProfileClient.tsx",
  "app/book/journeys/JourneysClient.tsx",
  "app/book/journeys/[journeyId]/JourneyDetailClient.tsx",
  "app/book/events/EventsClient.tsx",
  "app/book/events/[eventId]/EventDetailClient.tsx",
  "components/progress/ProgressPage.tsx",
  "app/book/library/[bookId]/chapter/[chapterId]/hooks/useReaderAccess.ts",
];

for (const file of ONBOARDING_REDIRECT_PAGES) {
  test(`${file} redirects to onboarding only through the shared rule`, () => {
    const source = readFileSync(path.join(process.cwd(), file), "utf8");
    assert.match(source, /useOnboardingRedirect\(/);
    assert.doesNotMatch(source, /router\.replace\(\s*["'`]\/book["'`]\s*\)/);
  });
}
