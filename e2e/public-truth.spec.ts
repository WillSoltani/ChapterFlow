import { test, expect, type Browser, type Page } from "@playwright/test";
import { PROD_E2E_HEADERS } from "../playwright.config";

/**
 * What the public pages promise, checked against what they do (plan Phase 9).
 *
 *   @prod (E2E_MODE=prod: `next build` + `next start`, the real sign-in gate):
 *   1. Logged out, /books renders the catalog: 200, no redirect, no console
 *      error; /books?q=habit shows the matching books only.
 *   2. Logged out, /book/library still redirects to sign-in.
 *   3. The landing's JSON-LD parses; its SearchAction target and the
 *      Organization logo answer 200 logged out on this server.
 *
 *   dev and prod:
 *   4. The sign-up link reads "Start free" everywhere on the public pages,
 *      except exactly one "Start your first book": the landing's closing
 *      section.
 */

const PROD = process.env.E2E_MODE === "prod";
const HEADERS = PROD ? { ...PROD_E2E_HEADERS } : undefined;
const BASE = "http://127.0.0.1:3000";
/** AUTH_LOGIN_BOOK_URL (app/_lib/chapterflow-brand; its "@/" imports do not load here). */
const AUTH_LOGIN_BOOK_URL = "/auth/login?returnTo=%2Fbook";

async function loggedOutPage(browser: Browser): Promise<{ page: Page; errors: string[]; close: () => Promise<void> }> {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ...(HEADERS ? { extraHTTPHeaders: HEADERS } : {}),
  });
  const page = await ctx.newPage();
  // A redirect into sign-in would end on the live site: never reach it.
  await page.route(/^https:\/\/app\.chapterflow\.ca\//, (route) => route.abort());
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));
  return { page, errors, close: () => ctx.close() };
}

/** The catalog's result area (not the hero's search dropdown). */
const catalog = (page: Page) => page.getByRole("region", { name: "Browse the ChapterFlow catalog" });

test.describe("public truth (@prod)", () => {
  test("logged out, /books renders the catalog with no redirect and no console error @prod", async ({ browser }) => {
    const { page, errors, close } = await loggedOutPage(browser);
    const documents: string[] = [];
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) documents.push(new URL(frame.url()).pathname);
    });
    const res = await page.goto("/books");
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // The all view shelves a book in more than one row: any copy will do.
    await expect(catalog(page).getByRole("link", { name: /^Atomic Habits by /i }).first()).toBeVisible();
    // Step through the page so every card enters the viewport (and any
    // prefetch it would make fires), then let the session probe settle.
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y <= height; y += 700) {
      await page.evaluate((top) => window.scrollTo(0, top), y);
      await page.waitForTimeout(50);
    }
    await page.waitForTimeout(1500);
    expect(new URL(page.url()).pathname).toBe("/books");
    expect(documents.filter((p) => p !== "/books"), "no navigation away from /books").toEqual([]);
    expect(errors, errors.join("\n")).toEqual([]);
    await close();
  });

  test("logged out, /books?q=habit shows the matching books only @prod", async ({ browser }) => {
    const { page, errors, close } = await loggedOutPage(browser);
    const res = await page.goto("/books?q=habit");
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("textbox", { name: "Search books" })).toHaveValue("habit");
    const region = catalog(page);
    await expect(region.getByRole("link", { name: /^Atomic Habits by /i })).toBeVisible();
    await expect(region.getByRole("link", { name: /^The Art of War by /i })).toHaveCount(0);
    // Every book card in the results matches the term (title, author or category).
    const names = await region.getByRole("link", { name: / by .* chapters$/ }).evaluateAll((els) =>
      els.map((el) => el.getAttribute("aria-label") ?? ""),
    );
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) expect(name, "a result that does not match").toMatch(/habit/i);
    await page.waitForTimeout(1000);
    expect(errors, errors.join("\n")).toEqual([]);
    await close();
  });

  test("logged out, /book/library redirects to sign-in @prod", async ({ request }) => {
    const res = await request.get("/book/library", { maxRedirects: 0 });
    expect(res.status()).toBeGreaterThanOrEqual(300);
    expect(res.status()).toBeLessThan(400);
    const loc = new URL(res.headers()["location"]!, BASE);
    expect(loc.pathname).toBe("/auth/login");
    expect(loc.searchParams.get("returnTo")).toBe("/book/library");
  });

  test("the landing's JSON-LD parses; its SearchAction target and logo answer 200 logged out @prod", async ({ page, request }) => {
    await page.route(/^https:\/\/app\.chapterflow\.ca\//, (route) => route.abort());
    await page.goto("/");
    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
    expect(blocks.length).toBeGreaterThan(0);
    const items = blocks.flatMap((text) => {
      const parsed: unknown = JSON.parse(text);
      return (Array.isArray(parsed) ? parsed : [parsed]) as Array<Record<string, unknown>>;
    });
    const types = items.map((i) => i["@type"]);
    expect(types).toEqual(expect.arrayContaining(["Organization", "WebSite", "FAQPage"]));

    const site = items.find((i) => i["@type"] === "WebSite")!;
    const action = site.potentialAction as { "@type": string; target: string; "query-input": string };
    expect(action["@type"]).toBe("SearchAction");
    expect(action.target).toContain("{search_term_string}");
    expect(action["query-input"]).toBe("required name=search_term_string");
    // The URL carries the configured public host; ask this server for its
    // path and query (never the live site).
    const target = new URL(action.target.replace("{search_term_string}", "habit"));
    expect(target.pathname).toBe("/books");
    expect(target.searchParams.get("q")).toBe("habit");
    const searched = await request.get(`${target.pathname}${target.search}`, { maxRedirects: 0 });
    expect(searched.status(), "the SearchAction target answers 200 logged out").toBe(200);

    const org = items.find((i) => i["@type"] === "Organization")!;
    const logo = new URL(String(org.logo));
    expect(logo.pathname, "the logo is the brand mark, not the share image").not.toBe("/og");
    const logoRes = await request.get(logo.pathname, { maxRedirects: 0 });
    expect(logoRes.status()).toBe(200);
    expect(logoRes.headers()["content-type"]).toMatch(/^image\//);
  });
});

/** Visible link text without decorative (aria-hidden) arrows and icons. */
async function startLinkNames(page: Page): Promise<Array<{ name: string; inClose: boolean }>> {
  return page.locator(`a[href="${AUTH_LOGIN_BOOK_URL}"]`).evaluateAll((els) =>
    els.map((el) => {
      const clone = el.cloneNode(true) as HTMLElement;
      for (const hidden of clone.querySelectorAll('[aria-hidden="true"], svg')) hidden.remove();
      const name = (el.getAttribute("aria-label") ?? clone.textContent ?? "").replace(/\s+/g, " ").trim();
      return { name, inClose: Boolean(el.closest('[aria-labelledby="recall-close-headline"]')) };
    }),
  );
}

async function expectStartLabels(page: Page): Promise<void> {
  await page.route(/^https:\/\/app\.chapterflow\.ca\//, (route) => route.abort());
  await page.goto("/");
  // The nav resolves the session before it shows its own start button.
  await page.waitForTimeout(1500);
  const landing = await startLinkNames(page);
  const first = landing.filter((l) => l.name === "Start your first book");
  expect(first, JSON.stringify(landing)).toHaveLength(1);
  expect(first[0]!.inClose, "it is the closing section's").toBe(true);
  const others = landing.filter((l) => l.name !== "Start your first book");
  expect(others.length).toBeGreaterThan(0);
  for (const l of others) expect(["Start free", "Sign in"], JSON.stringify(landing)).toContain(l.name);
  // The hero's start button is "Start free".
  await expect(page.locator("#hero").getByRole("link", { name: /^start free/i })).toHaveCount(1);

  for (const path of ["/pricing", "/books", "/contact", "/legal"]) {
    await page.goto(path);
    await page.waitForTimeout(800);
    const names = await startLinkNames(page);
    expect(names.length, `${path}: a start link`).toBeGreaterThan(0);
    for (const l of names) expect(["Start free", "Sign in"], `${path}: ${JSON.stringify(names)}`).toContain(l.name);
  }
}

// Both jobs: the dev server (session bypassed, so the nav shows "Dashboard")
// and the production build (logged out, the nav's own "Start free").
test.describe("public truth: start buttons", () => {
  test("one 'Start your first book' on the landing, at its close; 'Start free' everywhere else", async ({ page }) => {
    await expectStartLabels(page);
  });
  test("one 'Start your first book' on the landing, at its close; 'Start free' everywhere else @prod", async ({ page }) => {
    await expectStartLabels(page);
  });
});
