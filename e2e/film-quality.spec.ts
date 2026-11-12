import { test, expect, type Page } from "@playwright/test";
import { promises as fs } from "node:fs";

/**
 * Film-reel LOADING quality (components/film/frame-cache.ts): a steady,
 * time-based scroll over the first two films must fetch every frame at most
 * once and never run more than 4 frame fetches at once.
 *
 * Phone viewport stability (components/film/use-scrub-loop.ts): on 390 × 844
 * the canvas backing store is allocated once, the loop does (almost) no work
 * at rest, stops once the reel is over, and a jump back into the reel draws
 * the frame the scroll position demands at once.
 *
 * The other film specs read the requested frame from the HUD, so they pass
 * even with a dead loader; this one reads the network and window.__filmStats.
 * For whole-reel numbers per device profile: `npm run film:quality`.
 *
 * Opt-in: RUN_AUDIT=1 npx playwright test e2e/film-quality.spec.ts --project=chromium
 */

const FRAME_RE = /\/films\/[^/?#]+\/f_\d+\.\w+/;

type Stats = {
  refetches: number;
  maxFetchInFlight: number;
  fetches: number;
  exactDraws: number;
  fallbackDraws: number;
  canvasResizes: number;
  geometryMeasures: number;
  ticksWorked: number;
  ticksSkipped: number;
};

const readStats = (page: Page) => page.evaluate(() => ({ ...(window as unknown as { __filmStats: Stats }).__filmStats }));

/** scrollTo from a rAF loop at a fixed speed, to the end of film `index`. */
const steadyScroll = (page: Page, index: number, pxPerSec: number) =>
  page.evaluate(
    ([i, speed]) =>
      new Promise<void>((resolve) => {
        const seg = document.querySelectorAll("[data-film-segment]")[i];
        if (!seg) throw new Error(`no film segment ${i}`);
        const end = seg.getBoundingClientRect().bottom + window.scrollY - window.innerHeight;
        const from = window.scrollY;
        let t0 = 0;
        const step = (t: number) => {
          if (!t0) t0 = t;
          const y = Math.min(end, from + ((t - t0) / 1000) * speed);
          window.scrollTo(0, y);
          if (y >= end) resolve();
          else requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }),
    [index, pxPerSec] as const,
  );

/**
 * Worked ticks allowed in 2 s at rest: only breath repaints. The hero breathes
 * at 0.012, quantised to 1/4000, so its value changes at most
 * 0.012 / 2 × 4000 / 2600 ms ≈ 9.2 times a second (≤ 19 in 2 s; other films
 * breathe at 0.01, ≤ 16), plus a few for a late frame landing. Measured
 * 2026-11-11 at the end of the first film (dev server, Chromium): 18 worked,
 * 102 skipped. Anything above this is the loop working while idle.
 */
const IDLE_WORKED_MAX = 24;

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

    // A steady scroll from the top to the end of the second film.
    await steadyScroll(page, 1, 900);
    await page.waitForTimeout(1500);

    const stats = await readStats(page);
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

  test("phone viewport: canvas sized once, idle at rest, stopped after the reel, a jump lands", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/?hud=1");
    await page.waitForFunction(() => !!(window as unknown as { __filmStats?: Stats }).__filmStats);
    await page.waitForTimeout(1500);

    // A steady pass over the first film, then let the glide settle.
    await steadyScroll(page, 0, 600);
    await page.waitForTimeout(1000);
    const afterPass = await readStats(page);
    expect(afterPass.canvasResizes, "the canvas backing store is allocated once").toBe(1);

    // Two seconds at rest: only breath repaints work.
    await page.waitForTimeout(2000);
    const rested = await readStats(page);
    const idleWorked = rested.ticksWorked - afterPass.ticksWorked;
    const idleSkipped = rested.ticksSkipped - afterPass.ticksSkipped;

    // Below the reel: once settled, the loop stops (no ticks at all).
    await page.evaluate(() => document.getElementById("pricing")?.scrollIntoView({ block: "start", behavior: "instant" }));
    await page.waitForTimeout(2000);
    const below = await readStats(page);
    await page.waitForTimeout(1500);
    const belowLater = await readStats(page);

    // Jump back into the middle of a later film, as an anchor or a
    // back/forward restore would, and read the HUD three frames later.
    const counts = JSON.parse(await fs.readFile("components/film/book.timeline.json", "utf8")).films as Record<string, { count: number }>;
    const jump = await page.evaluate(async () => {
      const el = document.querySelectorAll<HTMLElement>("[data-film-segment]")[3];
      const stageEl = el?.querySelector("[data-film-stage]");
      if (!el || !stageEl) throw new Error("no fourth film segment");
      const r = el.getBoundingClientRect();
      const top = r.top + window.scrollY;
      const stage = stageEl.getBoundingClientRect().height;
      // Later segments scrub over their full height from top − stage (pickActive).
      window.scrollTo(0, Math.round(top - stage + 0.45 * r.height));
      for (let i = 0; i < 3; i++) await new Promise((res) => requestAnimationFrame(res));
      const sy = window.scrollY;
      return {
        film: el.dataset.film ?? "",
        progress: (stage - (top - sy)) / r.height,
        hud: document.querySelector(".film-hud")?.textContent ?? "",
      };
    });
    const end = await readStats(page);

    const count = counts[jump.film]?.count ?? 0;
    const expF = Math.round(Math.min(1, Math.max(0, jump.progress)) * (count - 1)) + 1;
    const m = /(palace-\d\d) · f(\d{4})/.exec(jump.hud);
    console.log(
      `phone: canvasResizes ${end.canvasResizes} · geometryMeasures ${end.geometryMeasures} · ` +
        `at rest 2 s: ticksWorked +${idleWorked}, ticksSkipped +${idleSkipped} · ` +
        `below the reel 1.5 s: ticksWorked +${belowLater.ticksWorked - below.ticksWorked}, ticksSkipped +${belowLater.ticksSkipped - below.ticksSkipped} · ` +
        `jump: ${jump.film} expected f${expF}, HUD "${jump.hud}"`,
    );
    expect(idleWorked, "worked ticks at rest (breath repaints only)").toBeLessThanOrEqual(IDLE_WORKED_MAX);
    expect(idleSkipped, "the loop keeps running at rest inside the reel").toBeGreaterThan(0);
    expect(belowLater.ticksWorked, "no work below the reel").toBe(below.ticksWorked);
    expect(belowLater.ticksSkipped, "no animation frames below the reel").toBe(below.ticksSkipped);
    expect(m?.[1], "HUD names the film the jump landed in").toBe(jump.film);
    expect(Math.abs(Number(m?.[2]) - expF), "HUD frame matches the scroll position").toBeLessThanOrEqual(1);
    expect(end.canvasResizes, "still one allocation after the whole visit").toBe(1);

    // A real box change (wider window, still portrait): the first animation
    // frame after the resize event must already paint into a backing store of
    // the NEW box. The loop's tick runs before this rAF callback (it was
    // requested earlier) and before the wrapper's ResizeObserver is delivered,
    // so a loop that refits only from the observer paints one stretched frame.
    const resized = page.evaluate(
      () =>
        new Promise<{ cw: number; ch: number; bw: number; bh: number }>((resolve) => {
          const canvas = document.querySelector<HTMLCanvasElement>(".film-canvas canvas");
          if (!canvas?.parentElement) throw new Error("no film canvas");
          window.addEventListener(
            "resize",
            () =>
              requestAnimationFrame(() => {
                const b = canvas.parentElement!.getBoundingClientRect();
                resolve({ cw: canvas.width, ch: canvas.height, bw: b.width, bh: b.height });
              }),
            { once: true },
          );
        }),
    );
    await page.waitForTimeout(100);
    await page.setViewportSize({ width: 430, height: 844 });
    const box = await resized;
    console.log(`resize: box ${box.bw}×${box.bh} css, canvas ${box.cw}×${box.ch} at the first frame`);
    expect(Math.abs(box.cw / box.ch - box.bw / box.bh), "first frame after a resize paints into the new box").toBeLessThan(0.01);
    expect((await readStats(page)).canvasResizes, "one reallocation for the one box change").toBe(2);
  });
});
