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

async function expectReducedMotionFinalState(page: Page): Promise<void> {
  await expect(page.getByRole("heading", { name: /stop forgetting/i })).toBeVisible();
  await expect(page.locator(".rl-plate-wrap")).toHaveCSS("transform", "none");
  await expect(page.locator(".rl-plate-scan")).toBeHidden();
  await expect(page.locator(".recall-reader-demo")).toBeVisible();
  await expect(page.locator(".recall-reader-demo")).toHaveCSS("opacity", "1");

  const library = page.locator("#library");
  await library.scrollIntoViewIfNeeded();
  await expect(library.locator(".rl-lib-stage")).toHaveCSS("position", "static");
  await expect(
    library.getByRole("heading", { name: /books, all real/i }),
  ).toBeVisible();

  const continuousAnimations = await page.evaluate(() =>
    document
      .getAnimations()
      .filter((animation) => animation.effect?.getTiming().iterations === Infinity)
      .map((animation) => {
        const target = (animation.effect as KeyframeEffect | null)?.target;
        return target instanceof Element
          ? target.tagName.toLowerCase() + "." + Array.from(target.classList).join(".")
          : "unknown-target";
      }),
  );
  expect(continuousAnimations).toEqual([]);
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

// Landing redesign (RECALL) regressions — the three behaviours most at risk of
// silent breakage: the mobile hero order (a conversion bug if it flips), the
// scroll-pinned library section's reduced-motion fallback (WCAG 2.3.3), and a
// present/clickable primary CTA. Run in dev mode (DEV_AUTH_BYPASS, no data
// plane). The landing reveals on scroll/in-view, so the section is scrolled into
// view before asserting.
test.describe("landing redesign", () => {
  test("at 390px the headline precedes the hero showcase", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    const h1 = page.locator("main h1").first();
    await expect(h1).toBeVisible();

    // The hero's framed visual (the FSRS retention-curve plate) renders inside
    // the .rl-hero-showcase wrapper, below the headline on phones.
    const showcase = page.locator(".rl-hero-showcase").first();

    const h1Box = await h1.boundingBox();
    const showcaseBox = await showcase.boundingBox();
    expect(h1Box, "headline must have a layout box").toBeTruthy();
    expect(showcaseBox, "hero showcase must have a layout box").toBeTruthy();

    // Headline is ABOVE the showcase (DOM-first, no order-* flip) ...
    expect(h1Box!.y).toBeLessThan(showcaseBox!.y);
    // ... and is the first thing in view above the fold.
    expect(h1Box!.y).toBeLessThan(844);
  });

  test("primary 'Start reading free' CTA is present and clickable", async ({
    page,
  }) => {
    await page.goto("/");
    const cta = page
      .getByRole("link", { name: /start reading free/i })
      .first();
    await expect(cta).toBeVisible();
    await expect(cta).toBeEnabled();
    expect(await cta.getAttribute("href")).toBeTruthy();
  });

  test("with reduced motion, the scroll-pinned library section is static and legible", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");

    const section = page.locator("#library");
    await expect(section).toHaveCount(1);
    await section.scrollIntoViewIfNeeded();

    // Reduced motion drops the scroll-pin: the inner stage is no longer sticky,
    // so nothing pins to the viewport (WCAG 2.3.3) and the choreography is
    // snapped to its final, fully-arrived state.
    await expect(section.locator(".rl-lib-stage")).toHaveCSS(
      "position",
      "static",
    );

    // ... and the section heading is rendered and legible at rest.
    await expect(
      section.getByRole("heading", { name: /books, all real/i }),
    ).toBeVisible();
  });
});

const PUBLIC_RECALL_ROUTES = [
  "/",
  "/pricing",
  "/books",
  "/contact",
  "/legal",
  "/legal/privacy",
  "/legal/cookies",
] as const;

test.describe("shared Recall public chrome", () => {
  for (const path of PUBLIC_RECALL_ROUTES) {
    test(`${path} has one shared shell and no mobile overflow`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      const res = await page.goto(path);
      expect(res?.status()).toBeLessThan(400);
      await expectNoErrorOverlay(page);
      await expect(page.locator("header.rl-nav")).toHaveCount(1);
      await expect(page.locator("main#main")).toHaveCount(1);
      await expect(page.locator("footer.rl-public-footer")).toHaveCount(1);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth + 1,
        ),
        `${path} must not overflow horizontally at 390px`,
      ).toBe(true);
    });
  }

  test("mobile menu traps focus, restores it, and unlocks after navigation", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/pricing");

    const trigger = page.getByRole("button", { name: "Open navigation menu" });
    const triggerBox = await trigger.boundingBox();
    expect(triggerBox?.width).toBeGreaterThanOrEqual(44);
    expect(triggerBox?.height).toBeGreaterThanOrEqual(44);

    await trigger.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Navigation" });
    const close = page.getByRole("button", { name: "Close navigation menu" });
    await expect(dialog).toBeVisible();
    await expect(close).toBeFocused();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");

    // Auth status resolves asynchronously. Wait until the final menu action is
    // present before asserting first↔last wraparound, otherwise the trap can
    // correctly wrap to the last navigation link that existed at keydown time.
    const menuAction = dialog.getByRole("link", {
      name: /start free|dashboard/i,
    });
    await expect(menuAction).toBeVisible();
    await page.keyboard.press("Shift+Tab");
    await expect(menuAction).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(close).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe("");

    await page.keyboard.press("Space");
    await page
      .getByRole("dialog", { name: "Navigation" })
      .getByRole("link", { name: "Books" })
      .click();
    await expect(page).toHaveURL(/\/books$/);
    await expect(page.getByRole("dialog", { name: "Navigation" })).toHaveCount(0);
    expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
  });

  test("skip link is first and moves keyboard focus to main", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/contact");
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("link", { name: "Skip to main content" }),
    ).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("main#main")).toBeFocused();
  });

  test("paper folio keyboard focus uses the contrast-safe Recall ink", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/legal/privacy");
    const policyLink = page.getByRole("link", { name: "Cookie Policy" });
    await policyLink.focus();
    await expect(policyLink).toHaveCSS("outline-color", "rgb(82, 101, 194)");
    await expect(policyLink).toHaveCSS("outline-width", "2px");
  });

  test("1024px breakpoint closes the mobile dialog without an orphan lock", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1023, height: 900 });
    await page.goto("/pricing");
    const trigger = page.getByRole("button", { name: "Open navigation menu" });
    await expect(trigger).toBeVisible();
    await expect(
      page.locator("header.rl-nav nav[aria-label='Primary']"),
    ).toBeHidden();
    await trigger.click();
    await expect(page.getByRole("dialog", { name: "Navigation" })).toBeVisible();

    await page.setViewportSize({ width: 1024, height: 900 });
    await expect(page.getByRole("dialog", { name: "Navigation" })).toHaveCount(0);
    await expect(trigger).toBeHidden();
    await expect(
      page.locator("header.rl-nav nav[aria-label='Primary']"),
    ).toBeVisible();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
  });

  test("home persistent CTA appears only after the hero boundary", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const headerAction = page.locator("header.rl-nav").getByRole("link", {
      name: /start free|dashboard/i,
    });
    const heroAction = page
      .getByRole("link", { name: "Start reading free" })
      .first();
    await expect(heroAction).toBeVisible();
    const heroActionBox = await heroAction.boundingBox();
    expect(heroActionBox?.height).toBeGreaterThanOrEqual(44);
    await expect(headerAction).toHaveCount(0);

    await page.evaluate(() => {
      const sentinel = document.querySelector<HTMLElement>("[data-public-hero-end]");
      if (!sentinel) throw new Error("missing public hero boundary");
      window.scrollTo(0, sentinel.offsetTop + 120);
    });
    await expect(headerAction).toHaveCount(1);

    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(headerAction).toHaveCount(0);
  });

  test("OS reduced motion renders the meaningful final state", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expectReducedMotionFinalState(page);
  });

  test("in-app reduced motion matches the OS final state", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "book-accelerator:preferences:v2",
        JSON.stringify({
          appearance: { theme: "dark", reducedMotion: true },
        }),
      );
    });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-motion", "reduced");
    await expectReducedMotionFinalState(page);
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
