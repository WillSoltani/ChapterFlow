import { test, expect } from "@playwright/test";

/**
 * Film-reel runtime audit: scrub smoothness + continuity.
 *
 *   1. Fast wheel-scroll through the whole reel never shows a hole: the hud
 *      frame always advances monotonically within a segment and the drawn
 *      frame never falls more than 40 frames behind the requested one.
 *   2. Segment handoffs land on the next film's early frames (dissolve runs).
 *   3. rAF loop stays ≥ 45 fps while scrubbing at 2 screens/s.
 *   4. Body content (request/faq/pricing) is reachable and the chrome flips
 *      to "body" once the last segment finishes.
 *   5. Anchor nav links land on the correct segment (scroll-behavior: auto).
 *
 * Opt-in: RUN_AUDIT=1 npx playwright test e2e/film-perf.spec.ts --project=chromium
 */

test.describe("film perf", () => {
  test.skip(process.env.RUN_AUDIT !== "1", "opt-in: RUN_AUDIT=1");

  test("fast scrub has no holes, keeps fps, hands off to body", async ({ page, browserName }) => {
    // Headless WebKit rasterises in software (no GPU): swapping ANY
    // full-viewport image per frame — canvas or <img> — caps at ~22–25 fps there
    // (measured: canvas 25, <img src> swap 22, page with canvas hidden 55).
    // Real Safari composites on the GPU. Gate accordingly.
    const MIN_FPS = browserName === "webkit" ? 20 : 45;
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/?hud=1");
    await page.waitForTimeout(1500);

    // Instrument: record every hud change with a timestamp + rAF count.
    await page.evaluate(() => {
      const w = window as unknown as { __log: Array<[number, string]>; __raf: number };
      w.__log = [];
      w.__raf = 0;
      const hud = document.querySelector(".film-hud")!;
      new MutationObserver(() => w.__log.push([performance.now(), hud.textContent ?? ""])).observe(hud, {
        childList: true, characterData: true, subtree: true,
      });
      const tick = () => { w.__raf++; requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    });

    // Scrub the whole reel at ~2 screens/s with wheel events.
    const total = await page.evaluate(() => document.body.scrollHeight - window.innerHeight);
    const t0 = Date.now();
    const rafStart = await page.evaluate(() => (window as unknown as { __raf: number }).__raf);
    let y = 0;
    while (y < total) {
      await page.mouse.wheel(0, 300);
      y += 300;
      await page.waitForTimeout(16);
    }
    await page.waitForTimeout(600);
    const elapsed = (Date.now() - t0) / 1000;
    const rafEnd = await page.evaluate(() => (window as unknown as { __raf: number }).__raf);
    const fps = (rafEnd - rafStart) / elapsed;

    const log = await page.evaluate(() => (window as unknown as { __log: Array<[number, string]> }).__log);
    const parsed = log
      .map(([t, s]) => {
        const m = /(palace-\d\d) · f(\d{4})/.exec(s);
        return m ? { t, film: m[1], f: Number(m[2]) } : null;
      })
      .filter((x): x is { t: number; film: string; f: number } => !!x);

    // 1. Monotonic within a film; 2. handoff lands early in the next film.
    const problems: string[] = [];
    for (let i = 1; i < parsed.length; i++) {
      const a = parsed[i - 1];
      const b = parsed[i];
      if (!a || !b) continue;
      if (a.film === b.film) {
        if (b.f < a.f - 2) problems.push(`backwards ${a.film} f${a.f}→f${b.f}`);
      } else {
        if (b.f > 40) problems.push(`handoff ${a.film}→${b.film} landed at f${b.f} (dissolve skipped)`);
      }
    }
    const films = [...new Set(parsed.map((p) => p.film))];
    expect(films, "every film was drawn").toEqual(["palace-00", "palace-01", "palace-02", "palace-03", "palace-04", "palace-05", "palace-06"]);
    expect(problems, problems.join("\n")).toEqual([]);
    console.log(`scrub: ${parsed.length} frame draws in ${elapsed.toFixed(1)}s, rAF ${fps.toFixed(0)} fps`);
    expect(fps).toBeGreaterThan(MIN_FPS);

    // 4. Body reachable, chrome = body at the end.
    await expect(page.locator("html")).toHaveAttribute("data-reel-chrome", "body");
    await expect(page.locator("#pricing")).toBeAttached();
    const faqTop = await page.locator("#faq").evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
    await page.evaluate((y) => window.scrollTo({ top: y - 40, behavior: "instant" as ScrollBehavior }), faqTop);
    await page.waitForTimeout(300);
    await expect(page.locator("#faq")).toBeInViewport();

    // 5. Anchor links jump straight to their segment (no smooth whip).
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior }));
    await page.waitForTimeout(200);
    await page.locator('header.rl-nav nav[aria-label="Primary"] a[href$="#how-it-works"]').click();
    // The nav link is a Next <Link> and the page is dynamic (per-request CSP
    // nonce), so the hash navigation first round-trips for the RSC payload and
    // only then scrolls; poll for the landing instead of sleeping. The landing
    // itself must still be exact (no smooth whip: scroll-behavior is forced to
    // auto under the reel), hence the 2px bound once it has happened.
    const segTopAfter = () =>
      page.evaluate(() => document.querySelector("#how-it-works")!.getBoundingClientRect().top);
    await expect.poll(async () => Math.abs(await segTopAfter()), { timeout: 10_000 }).toBeLessThan(2);
    await page.waitForTimeout(200);
    const after = await page.evaluate(() => ({
      segTop: document.querySelector("#how-it-works")!.getBoundingClientRect().top,
      hud: document.querySelector(".film-hud")?.textContent ?? "",
    }));
    expect(Math.abs(after.segTop)).toBeLessThan(2);
    expect(after.hud).toContain("palace-01");
  });
});
