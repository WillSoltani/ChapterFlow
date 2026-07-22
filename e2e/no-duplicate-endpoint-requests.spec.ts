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

test("back-navigation serves the library from cache, then revalidates", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/book/library");
  await page.waitForLoadState("networkidle");
  await page.goto("/book/progress");
  await page.waitForLoadState("networkidle");

  // Let the 30s cache TTL lapse so the back-nav MUST revalidate — otherwise a
  // fresh-from-memory hit issues no request and the assertion is vacuous.
  await page.waitForTimeout(31_000);

  // Delay every book API response so a cache-first paint is distinguishable
  // from a network-first one: content must appear while revalidation hangs.
  await page.route("**/app/api/book/**", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.fallback();
  });

  const revalidations = trackApiGets(page);
  await page.goBack();
  // Stale-while-revalidate: library content is on screen well inside the
  // 1500ms window every network response is being held open for.
  await expect(page.locator("main").first()).toBeVisible({ timeout: 1000 });
  // ...and the background revalidation really was issued.
  expect(revalidations.length).toBeGreaterThan(0);
});
