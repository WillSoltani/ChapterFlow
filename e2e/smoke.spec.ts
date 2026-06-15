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
//
// IMPORTANT: these run ONLY in the dev-bypass E2E mode (E2E_MODE unset/"dev").
// They prove the shell renders with auth bypassed and no data plane — they do
// NOT prove the production bundle, real-auth redirects, or DynamoDB-backed pages
// work. That coverage is the "@prod" block below, run against `next start`.
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

// Production-bundle smoke — runs ONLY in E2E_MODE=prod, against `next build` +
// `next start` (NODE_ENV=production, no DEV_AUTH_BYPASS). This catches
// prod-build-only crashes and dev/prod hydration drift that the dev-bypass
// shell tests above cannot, and it asserts the REAL middleware auth bounce: an
// unauthenticated request to a protected route must redirect to /auth/login
// (with a returnTo back to the original path). With auth bypassed in dev mode
// this bounce is invisible, so it is verified here exclusively.
test.describe("prod-build smoke (@prod)", () => {
  test("public landing renders on the prod bundle @prod", async ({ page }) => {
    const res = await page.goto("/");
    expect(res?.status()).toBeLessThan(400);
    await expect(page).toHaveTitle(/ChapterFlow/i);
    await expectNoErrorOverlay(page);
    await expectNotBlank(page);
  });

  for (const path of ["/dashboard", "/book", "/book/library"]) {
    test(`${path} bounces unauthenticated visitor to /auth/login @prod`, async ({
      page,
    }) => {
      await page.goto(path);
      // No id_token cookie + NODE_ENV=production -> middleware.ts redirects to
      // /auth/login and carries the original path as a relative returnTo
      // (URL-encoded, e.g. returnTo=%2Fdashboard).
      await expect(page).toHaveURL(/\/auth\/login/);
      const returnTo = new URL(page.url()).searchParams.get("returnTo");
      expect(returnTo).toBe(path);
      await expectNoErrorOverlay(page);
    });
  }
});

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
