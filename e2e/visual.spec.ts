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

  // Full-page screenshots do not naturally intersect below-the-fold native
  // lazy images. Walk the document at viewport-sized intervals so the browser
  // requests the real covers under production loading semantics, then wait for
  // every requested image to settle before returning to the canonical top view.
  const imageState = await page.evaluate(async () => {
    const pauseForPaint = () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
    const renderedLazyImages = Array.from(document.images).filter(
      (image) => image.loading === "lazy" && image.getClientRects().length > 0,
    );

    for (const image of renderedLazyImages) {
      image.scrollIntoView({ block: "center", inline: "nearest" });
      await pauseForPaint();
    }

    await Promise.all(
      renderedLazyImages.map(
        (image) =>
          new Promise<void>((resolve) => {
            if (image.complete) {
              resolve();
              return;
            }
            let timeout = 0;
            const done = () => {
              window.clearTimeout(timeout);
              resolve();
            };
            timeout = window.setTimeout(done, 4000);
            image.addEventListener("load", done, { once: true });
            image.addEventListener("error", done, { once: true });
          }),
      ),
    );

    const renderedImages = Array.from(document.images).filter(
      (image) => image.getClientRects().length > 0,
    );
    await Promise.all(
      renderedImages
        .filter((image) => image.complete && image.naturalWidth > 0)
        .map((image) =>
          Promise.race([
            image.decode().catch(() => undefined),
            new Promise<void>((resolve) => window.setTimeout(resolve, 2000)),
          ]),
        ),
    );

    for (const element of document.querySelectorAll<HTMLElement>("*")) {
      if (element.scrollLeft !== 0) element.scrollLeft = 0;
    }
    window.scrollTo(0, 0);
    await pauseForPaint();

    const renderedImagesAfterSettle = Array.from(document.images).filter(
      (image) => image.getClientRects().length > 0,
    );

    return {
      pending: renderedImagesAfterSettle
        .filter((image) => !image.complete)
        .map((image) => image.currentSrc || image.src || "unknown image"),
      broken: renderedImagesAfterSettle
        .filter((image) => image.complete && image.naturalWidth === 0)
        .map((image) => image.currentSrc || image.src || "unknown image"),
    };
  });
  expect(imageState.pending, "all rendered images must settle before capture").toEqual([]);
  expect(imageState.broken, "all rendered images must decode before capture").toEqual([]);
  await page.waitForTimeout(150);
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
            // A 1% full-page allowance let an entire coverflow regress to blank
            // rectangles because it occupied a localized part of a tall page.
            // Keep enough antialiasing tolerance for cross-run stability while
            // making meaningful component-sized drift fail closed.
            maxDiffPixelRatio: 0.002,
          },
        );
      });
    }
  }
});
