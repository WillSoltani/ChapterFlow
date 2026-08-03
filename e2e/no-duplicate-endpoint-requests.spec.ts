import { test, expect, type Page } from "@playwright/test";

// GETs the acceptance clause covers: every book API read + the session probe.
const API_PATH = /^\/app\/api\/(book\/|auth\/session$)/;

function trackApiGets(page: Page): string[] {
  const urls: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET") return;
    const url = new URL(request.url());
    if (API_PATH.test(url.pathname)) urls.push(url.pathname + url.search);
  });
  return urls;
}

function duplicates(urls: string[]): string[] {
  return urls.filter((url, index) => urls.indexOf(url) !== index);
}

test("library navigation issues at most one request per distinct endpoint", async ({ page }) => {
  const urls = trackApiGets(page);
  await page.goto("/book/library");
  await page.waitForLoadState("networkidle");
  expect(duplicates(urls)).toEqual([]);
});

test("progress navigation issues at most one request per distinct endpoint", async ({ page }) => {
  const urls = trackApiGets(page);
  await page.goto("/book/progress");
  await page.waitForLoadState("networkidle");
  expect(duplicates(urls)).toEqual([]);
});

// NOTE: a third browser-level test ("back-nav serves from cache, then
// revalidates") was removed deliberately. Both navigation mechanisms defeat
// it outside a data-plane-backed environment: page.goBack() restores from the
// back/forward cache without re-running client effects, and client-side nav
// after the 30s TTL lapse trips the dev session-expiry/onboarding redirect.
// The behavior it targeted — TTL-lapsed reads revalidate, stale value served
// first — is pinned deterministically in lib/client/book-api-cache-core.test.ts
// ("TTL: reads within the window skip the network; a stale read refetches" and
// "SWR ordering: stale value is served first, fresh value delivered via
// subscription").
