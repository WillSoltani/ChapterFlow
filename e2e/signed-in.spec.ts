import { test, expect, type ConsoleMessage, type Page } from "@playwright/test";
import { FIXED_NOW, FIXTURE_BOOK_TITLE } from "./support/fixtures";
import { installMockDataPlane, type MockDataPlane } from "./support/mock-data-plane";
import type { Persona } from "./support/fixtures";

// Signed-in pages against a mocked data plane (e2e/support/mock-data-plane.ts).
//
// The dev server in CI has no database, so the smoke suite can only show the
// logged-in shell. Here the browser answers /app/api/book/ from fixtures, so
// Home, Library, Progress and Settings render with real-looking data and a
// broken page, a runtime error or a phone-width overflow fails the test.
//
// This spec asserts structure and behaviour only: the page renders, nothing
// throws, nothing scrolls sideways on a phone, the tab bar is on screen. It
// deliberately checks no copy, label, count or number a design change would
// touch, and no request counts.

// `dataGet` is the page's own data read: the test fails unless the mock answered
// it with 200, so a page whose data never loaded cannot pass on the header's
// requests or a write alone.
type Case = { path: string; persona: Persona; showsBookTitle: boolean; dataGet: string };

const CASES: Case[] = [
  { path: "/dashboard", persona: "returning", showsBookTitle: true, dataGet: "me/dashboard" },
  { path: "/dashboard", persona: "new", showsBookTitle: false, dataGet: "me/dashboard" },
  { path: "/book/library", persona: "returning", showsBookTitle: true, dataGet: "me/dashboard" },
  { path: "/book/progress", persona: "returning", showsBookTitle: true, dataGet: "me/dashboard" },
  { path: "/book/settings", persona: "returning", showsBookTitle: false, dataGet: "me/settings" },
];

const VIEWPORTS = [
  { name: "phone", width: 390, height: 844, phone: true },
  { name: "desktop", width: 1440, height: 900, phone: false },
] as const;

// Fixed zone, locale and no service worker: the same render on every machine.
test.use({ timezoneId: "UTC", locale: "en-US", serviceWorkers: "block" });
// The first load of a route compiles it in the dev server.
test.setTimeout(150_000);

/** Console errors the run collects, and what the harness decides to ignore. */
function collectProblems(page: Page, plane: () => MockDataPlane | null): () => string[] {
  const problems: string[] = [];
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  page.on("console", (message: ConsoleMessage) => {
    if (message.type() !== "error") return;
    const text = message.text();
    // A request the data plane does not know answers 404; the browser logs
    // that as "Failed to load resource". Those are listed in the test output
    // instead (see "unmocked endpoints").
    if (/Failed to load resource.*404/i.test(text)) {
      const url = message.location().url;
      if (plane()?.unknownUrls.has(url)) return;
    }
    problems.push(`console.error: ${text}`);
  });
  return () => problems;
}

// Measure against the viewport the test configured, never window.innerWidth or
// innerHeight: with isMobile on, Chromium zooms the page out to fit content
// wider than the screen, and innerWidth / innerHeight grow with it, so a check
// against them can never fail.
function configuredViewport(page: Page): { width: number; height: number } {
  const size = page.viewportSize();
  if (!size) throw new Error("the phone cases need a fixed viewport");
  return size;
}

async function expectNoSidewaysScroll(page: Page): Promise<void> {
  const { width } = configuredViewport(page);
  const scroll = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scroll, `page is wider than the ${width}px phone viewport`).toBeLessThanOrEqual(width);
}

/** The fixed tab bar at the bottom of the phone screen is inside the viewport. */
async function expectTabBarOnScreen(page: Page): Promise<void> {
  const viewport = configuredViewport(page);
  const bars = await page.evaluate(({ width, height }) => {
    const out: { top: number; bottom: number; height: number }[] = [];
    for (const nav of Array.from(document.querySelectorAll("nav"))) {
      const style = getComputedStyle(nav);
      const rect = nav.getBoundingClientRect();
      if (style.position !== "fixed" || style.display === "none" || style.visibility === "hidden") continue;
      if (rect.height === 0 || rect.width < width * 0.9 || rect.top < height / 2) continue;
      out.push({ top: rect.top, bottom: rect.bottom, height: rect.height });
    }
    return out;
  }, viewport);
  expect(bars.length, "no fixed tab bar found at the bottom of the phone screen").toBeGreaterThan(0);
  for (const bar of bars) {
    expect(bar.bottom, "tab bar runs past the bottom of the screen").toBeLessThanOrEqual(viewport.height + 1);
    expect(bar.top, "tab bar starts above the screen").toBeGreaterThanOrEqual(0);
  }
}

for (const viewport of VIEWPORTS) {
  test.describe(`signed in, ${viewport.name}`, () => {
    test.use({
      viewport: { width: viewport.width, height: viewport.height },
      isMobile: viewport.phone,
      hasTouch: viewport.phone,
    });

    for (const c of CASES) {
      test(`${c.path} renders for a ${c.persona} reader`, async ({ page, context }, testInfo) => {
        const plane = await installMockDataPlane(context, c.persona);
        const problems = collectProblems(page, () => plane);
        // Before any navigation, so every date the app computes starts from the same day.
        await page.clock.install({ time: new Date(FIXED_NOW) });

        const response = await page.goto(c.path, { waitUntil: "domcontentloaded" });
        expect(await page.evaluate(() => new Date().toISOString()), "the page clock is the fixed one").toMatch(
          new RegExp(`^${FIXED_NOW.slice(0, 10)}T`),
        );
        expect(response?.ok(), `${c.path} answered ${response?.status()}`).toBe(true);
        await expect(page).toHaveURL(new RegExp(`${c.path.replace(/\//g, "\\/")}(\\?|$)`));

        if (c.showsBookTitle) {
          await expect(page.getByText(FIXTURE_BOOK_TITLE).filter({ visible: true }).first()).toBeVisible();
        } else {
          // Settings has no <main> landmark, so accept a heading too.
          await expect(page.locator("main, h1").first()).toBeVisible();
        }
        await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});

        // A page whose own data read failed or never ran must not pass.
        expect(plane.answeredGet(c.dataGet), `GET ${c.dataGet} was not answered with 200`).toBe(true);

        if (viewport.phone) {
          await expectNoSidewaysScroll(page);
          await expectTabBarOnScreen(page);
        }

        const unknown = plane.describeUnknown();
        if (unknown.length) {
          console.log(`unmocked endpoints on ${c.path} (${viewport.name}, ${c.persona}):\n  ${unknown.join("\n  ")}`);
          testInfo.annotations.push({ type: "unmocked endpoints", description: unknown.join(", ") });
        }
        expect(problems(), problems().join("\n")).toEqual([]);
      });
    }
  });
}
