import { test, expect, type Page } from "@playwright/test";
import {
  ORPHAN_BOOK_SLUGS,
  CANONICAL_BOOK_SLUGS,
  resolveCanonicalBookSlug,
} from "../lib/book-slug-aliases";

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

// PROD-DUP: retired book slugs must 308-redirect to their canonical slug. The
// redirect lives in middleware.ts (NOT next.config redirects(), which match
// case-INSENSITIVELY and would loop the case-only Getting-Things-Done rename onto
// the live canonical) and runs before the auth bounce, so the first hop is the
// canonical redirect — verifiable in dev mode. maxRedirects:0 stops at that hop
// so we assert the 308 + canonical Location exactly, and that no canonical
// self-redirects (the loop-bug regression guard).
test.describe("orphan book-slug redirects (PROD-DUP)", () => {
  const BASE = "http://127.0.0.1:3000";

  // Cover EVERY retired slug — including the uppercase `Getting-Things-Done` and
  // the apostrophe `you-can't-hurt-me`, the two with non-trivial matching
  // semantics — so the suite can't go green while a case-only or encoding edge
  // silently breaks. encodeURIComponent leaves these slugs' chars untouched, so
  // each is requested in its literal form.
  for (const orphan of ORPHAN_BOOK_SLUGS) {
    const canonical = resolveCanonicalBookSlug(orphan);
    test(`detail: ${orphan} → ${canonical}`, async ({ request }) => {
      const res = await request.get(
        `/book/library/${encodeURIComponent(orphan)}`,
        { maxRedirects: 0 },
      );
      expect(res.status(), `${orphan} should 308`).toBe(308);
      const loc = new URL(res.headers()["location"], BASE);
      expect(loc.pathname).toBe(`/book/library/${canonical}`);
    });
  }

  test("reader subtree is preserved", async ({ request }) => {
    const res = await request.get(
      "/book/library/art-of-war/chapter/laying-plans",
      { maxRedirects: 0 },
    );
    expect(res.status()).toBe(308);
    const loc = new URL(res.headers()["location"], BASE);
    expect(loc.pathname).toBe(
      "/book/library/the-art-of-war/chapter/laying-plans",
    );
  });

  test("percent-encoded apostrophe resolves (you-can%27t-hurt-me)", async ({
    request,
  }) => {
    const res = await request.get("/book/library/you-can%27t-hurt-me", {
      maxRedirects: 0,
    });
    expect(res.status()).toBe(308);
    const loc = new URL(res.headers()["location"], BASE);
    expect(loc.pathname).toBe("/book/library/you-cant-hurt-me");
  });

  // No canonical slug may redirect to itself — the failure mode of a
  // case-insensitive next.config redirect on the case-only rename
  // (Getting-Things-Done). This is the regression guard for the loop bug.
  for (const canonical of CANONICAL_BOOK_SLUGS) {
    test(`canonical ${canonical} does not self-redirect`, async ({ request }) => {
      const path = `/book/library/${canonical}`;
      const res = await request.get(path, { maxRedirects: 0 });
      if (res.status() >= 300 && res.status() < 400) {
        const loc = new URL(res.headers()["location"], BASE);
        expect(loc.pathname, `${path} must not redirect to itself`).not.toBe(
          path,
        );
      }
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
      request,
    }) => {
      // /auth/login is a 302 redirector that immediately hands off to the Cognito
      // hosted UI, so its URL never becomes a browser document URL — asserting
      // toHaveURL(/auth/login) can never match, and following the chain onward
      // requires full COGNITO_* env the CI prod bundle intentionally omits.
      // Assert the middleware's bounce at the HTTP level instead: an
      // unauthenticated request to a protected route must 3xx to /auth/login
      // carrying a relative returnTo back to the original path. maxRedirects:0
      // stops at the middleware response (we never reach Cognito).
      const res = await request.get(path, { maxRedirects: 0 });
      expect(res.status(), `${path} should redirect when unauthenticated`).toBeGreaterThanOrEqual(300);
      expect(res.status()).toBeLessThan(400);
      const location = res.headers()["location"];
      expect(location, `${path} redirect must carry a Location header`).toBeTruthy();
      const loc = new URL(location, "http://127.0.0.1:3000");
      expect(loc.pathname).toBe("/auth/login");
      expect(loc.searchParams.get("returnTo")).toBe(path);
    });
  }
});

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
