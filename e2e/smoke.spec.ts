import { test, expect, type Page } from "@playwright/test";

// Smoke suite: confirms the critical funnels and the authed app shell actually
// render in a real browser — not that specific seeded content exists. Catches
// 500s, white screens, crashed client components, and auth bounces.

async function expectNoErrorOverlay(page: Page): Promise<void> {
  await expect(
    page.getByText(
      /Application error|Unhandled Runtime Error|This page could not be found/i,
    ),
  ).toHaveCount(0);
}

async function expectNotBlank(page: Page): Promise<void> {
  const text = (await page.locator("body").innerText()).trim();
  expect(text.length).toBeGreaterThan(20);
}

// Public marketing / funnel pages — server-rendered, no auth or DB needed.
test.describe("public funnel", () => {
  test("landing page renders", async ({ page }) => {
    const res = await page.goto("/");
    expect(res?.status()).toBeLessThan(400);
    await expect(page).toHaveTitle(/ChapterFlow/i);
    await expect(page.getByText(/stop forgetting/i).first()).toBeVisible();
  });

  test("pricing page renders", async ({ page }) => {
    const res = await page.goto("/pricing");
    expect(res?.status()).toBeLessThan(400);
    await expect(page).toHaveTitle(/pricing/i);
    await expectNoErrorOverlay(page);
    await expectNotBlank(page);
  });

  test("signup page renders", async ({ page }) => {
    const res = await page.goto("/signup");
    expect(res?.status()).toBeLessThan(400);
    await expect(page.getByText(/start reading smarter/i).first()).toBeVisible();
  });
});

// Authenticated app shell — reachable locally via DEV_AUTH_BYPASS=1 (set by the
// `dev` script). Book data may be empty without BOOK_TABLE_NAME, so we assert
// the shell renders and the route does not bounce to auth or crash.
test.describe("app shell (dev-auth-bypass)", () => {
  for (const path of ["/dashboard", "/book", "/book/library", "/book/progress"]) {
    test(`${path} renders without error`, async ({ page }) => {
      const res = await page.goto(path);
      expect(res?.status()).toBeLessThan(400);
      await expect(page).toHaveURL(new RegExp(escapeRegex(path)));
      await expectNoErrorOverlay(page);
      await expectNotBlank(page);
    });
  }
});

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
