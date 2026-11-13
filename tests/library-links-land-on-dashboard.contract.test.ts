import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import {
  AUTH_LOGIN_BOOK_URL,
  getChapterFlowLaunchHref,
} from "@/app/_lib/chapterflow-brand";

// SHELL-16: sign-in links and "Back to my library" land on /dashboard, not on
// /book (the onboarding funnel, which only bounces onboarded readers onward).
// Un-onboarded readers are still sent from /dashboard to /book by the page gate.

test("the shared sign-in link returns to the dashboard", () => {
  assert.equal(AUTH_LOGIN_BOOK_URL, "/auth/login?returnTo=%2Fdashboard");
});

test("the app launch link opens the dashboard", () => {
  assert.equal(getChapterFlowLaunchHref(), "/dashboard");
});

function source(file: string): string {
  return readFileSync(path.join(process.cwd(), file), "utf8");
}

test('"Back to my library" on the review page goes to the dashboard', () => {
  const page = source("app/review/page.tsx");
  assert.match(page, /primaryHref="\/dashboard"/);
  assert.doesNotMatch(page, /primaryHref="\/book"/);
});

test("signed-in pricing and gift fallbacks go to the dashboard", () => {
  assert.match(source("components/sections/Pricing.tsx"), /loggedIn \? "\/dashboard" : AUTH_LOGIN_BOOK_URL/);
  assert.match(source("app/gift/[code]/page.tsx"), /:\s*"\/dashboard";/);
});
