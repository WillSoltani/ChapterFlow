import { test, expect, type Page } from "@playwright/test";

/**
 * Intentional-redesign baselines for the canonical Recall public system.
 *
 * Tagged @visual and local-only by playwright.config.ts. The matrix is the
 * owner-approved acceptance surface: phone, exact navigation breakpoint, and
 * wide desktop across every public route material plus representative long-form
 * and table-heavy legal documents.
 */

const SURFACES = [
  { name: "home", path: "/" },
  { name: "pricing", path: "/pricing" },
  { name: "books", path: "/books" },
  { name: "contact", path: "/contact" },
  { name: "legal-hub", path: "/legal" },
  { name: "legal-privacy", path: "/legal/privacy" },
  { name: "legal-cookies", path: "/legal/cookies" },
] as const;

const VIEWPORTS = [
  { name: "390", width: 390, height: 844 },
  { name: "1024", width: 1024, height: 900 },
  { name: "1440", width: 1440, height: 1000 },
] as const;

const PREFERENCE_STORAGE_KEY = "book-accelerator:preferences:v2";

async function settle(page: Page): Promise<void> {
  await page.addStyleTag({
    content: "nextjs-portal { display: none !important; }",
  });
  await page.evaluate(async () => {
    await (document as Document & { fonts: FontFaceSet }).fonts.ready;
  });
  const reader = page.locator(".recall-reader-demo");
  if ((await reader.count()) > 0) await expect(reader).toBeVisible();
  await page.waitForTimeout(400);
}

test.describe("@visual Recall public system", () => {
  for (const viewport of VIEWPORTS) {
    for (const surface of SURFACES) {
      test(`${surface.name} — ${viewport.name}`, async ({ page }) => {
        await page.setViewportSize({
          width: viewport.width,
          height: viewport.height,
        });
        await page.addInitScript(
          ([key]) => {
            window.localStorage.setItem(
              key,
              JSON.stringify({
                appearance: { theme: "dark", reducedMotion: true },
              }),
            );
          },
          [PREFERENCE_STORAGE_KEY] as const,
        );
        await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
        const res = await page.goto(surface.path, { waitUntil: "networkidle" });
        expect(res?.status() ?? 200).toBeLessThan(400);
        await settle(page);
        await expect(page).toHaveScreenshot(
          `${surface.name}-${viewport.name}.png`,
          {
            fullPage: true,
            animations: "disabled",
            maxDiffPixelRatio: 0.01,
          },
        );
      });
    }
  }
});
