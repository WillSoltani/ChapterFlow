import { test, expect, type Page } from "@playwright/test";

/**
 * Visual-regression baselines for the token-heavy public surfaces.
 *
 * PRIMARY PURPOSE: gate value-preserving token/design-system refactors. A
 * "collapse the accent families into --cf-* / re-ladder the shadows" change is
 * supposed to be pixel-identical — if it shifts any rendered color, radius, or
 * elevation, that shows up here as a screenshot diff instead of silently
 * shipping (the build never catches a wrong-but-valid color).
 *
 * Tagged @visual so it can be run on its own:
 *   npm run test:visual           # compare against committed baselines
 *   npm run test:visual:update    # (re)generate baselines
 *
 * CROSS-OS CAVEAT: Playwright rasterizes with the host's font stack, so a macOS
 * baseline will not match a Linux CI run (sub-pixel AA differs). Baselines must
 * be regenerated in the target environment (the Playwright Linux docker image
 * or a Linux CI runner) before this is promoted to a blocking CI gate. Until
 * then it is a LOCAL gate for token refactors (baseline on main -> apply the
 * refactor -> diff, both on the same host).
 */

const SURFACES = [
  { name: "landing", path: "/" },
  { name: "pricing", path: "/pricing" },
  { name: "signup", path: "/signup" },
] as const;

const THEMES = ["dark", "light"] as const;

// The app's theme is class-based (.dark on <html>), set by an inline script that
// reads this localStorage key and DEFAULTS to light — so prefers-color-scheme
// emulation has no effect. Seed the preference before the page's scripts run.
const THEME_STORAGE_KEY = "book-accelerator:preferences:v2";

async function settle(page: Page): Promise<void> {
  // Wait for webfonts so glyph metrics are stable, and give lazy/in-view
  // sections a beat to mount before the (animation-disabled) capture.
  await page.evaluate(async () => {
    await (document as Document & { fonts: FontFaceSet }).fonts.ready;
  });
  await page.waitForTimeout(400);
}

test.describe("@visual public surfaces", () => {
  for (const theme of THEMES) {
    for (const surface of SURFACES) {
      test(`${surface.name} — ${theme}`, async ({ page }) => {
        await page.addInitScript(
          ([key, value]) => {
            window.localStorage.setItem(
              key,
              JSON.stringify({ appearance: { theme: value } }),
            );
          },
          [THEME_STORAGE_KEY, theme] as const,
        );
        await page.emulateMedia({ colorScheme: theme });
        const res = await page.goto(surface.path, { waitUntil: "networkidle" });
        expect(res?.status() ?? 200).toBeLessThan(400);
        await settle(page);
        await expect(page).toHaveScreenshot(`${surface.name}-${theme}.png`, {
          fullPage: true,
          animations: "disabled",
          // Tolerate a hair of sub-pixel AA noise; a real color/radius/shadow
          // change moves far more pixels than this.
          maxDiffPixelRatio: 0.01,
        });
      });
    }
  }
});
