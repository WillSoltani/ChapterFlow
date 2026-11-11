import { test, expect } from "@playwright/test";

/**
 * Film-reel LOADING quality (components/film/frame-cache.ts): a steady,
 * time-based scroll over the first two films must fetch every frame at most
 * once and never run more than 4 frame fetches at once.
 *
 * The other film specs read the requested frame from the HUD, so they pass
 * even with a dead loader; this one reads the network and window.__filmStats.
 * For whole-reel numbers per device profile: `npm run film:quality`.
 *
 * Opt-in: RUN_AUDIT=1 npx playwright test e2e/film-quality.spec.ts --project=chromium
 */

const FRAME_RE = /\/films\/[^/?#]+\/f_\d+\.\w+/;

type Stats = { refetches: number; maxFetchInFlight: number; fetches: number; exactDraws: number; fallbackDraws: number };

test.describe("film quality", () => {
  test.skip(process.env.RUN_AUDIT !== "1", "opt-in: RUN_AUDIT=1");

  test.beforeEach(async ({ request }) => {
    const r = await request.get("/films/palace-00/poster.webp");
    test.skip(r.status() !== 200, "no film frames encoded (run scripts/film/placeholder.mjs)");
  });

  test("a steady pass over the first two films fetches each frame once", async ({ page }) => {
    test.setTimeout(120_000);
    const frames: string[] = [];
    page.on("request", (req) => {
      if (FRAME_RE.test(req.url())) frames.push(req.url());
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/?hud=1");
    await page.waitForFunction(() => !!(window as unknown as { __filmStats?: Stats }).__filmStats);
    await page.waitForTimeout(1500);

    // scrollTo from a rAF loop at a fixed speed, to the end of the second film.
    await page.evaluate(
      (pxPerSec) =>
        new Promise<void>((resolve) => {
          const second = document.querySelectorAll("[data-film-segment]")[1];
          if (!second) throw new Error("no second film segment");
          const end = second.getBoundingClientRect().bottom + window.scrollY - window.innerHeight;
          let t0 = 0;
          const step = (t: number) => {
            if (!t0) t0 = t;
            const y = Math.min(end, ((t - t0) / 1000) * pxPerSec);
            window.scrollTo(0, y);
            if (y >= end) resolve();
            else requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        }),
      900,
    );
    await page.waitForTimeout(1500);

    const stats = await page.evaluate(() => ({ ...(window as unknown as { __filmStats: Stats }).__filmStats }));
    const distinct = new Set(frames).size;
    console.log(
      `quality: ${frames.length} frame requests, ${distinct} distinct, fetches ${stats.fetches}, refetches ${stats.refetches}, ` +
        `max in flight ${stats.maxFetchInFlight}, exact ${stats.exactDraws}/${stats.exactDraws + stats.fallbackDraws}`,
    );
    expect(distinct, "frames were loaded").toBeGreaterThan(0);
    expect(stats.refetches).toBe(0);
    expect(stats.maxFetchInFlight).toBeLessThanOrEqual(4);
    expect(frames.length, "no frame requested twice on the network").toBeLessThanOrEqual(distinct);
  });
});
