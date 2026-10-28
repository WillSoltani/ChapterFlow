import { test, expect } from "@playwright/test";

/**
 * Film-reel engine smoke (/film preview). Requires frames in public/films —
 * run `node scripts/film/placeholder.mjs` first (CI skips if the poster 404s).
 * Frame counts come from components/film/book.timeline.json.
 */
import timeline from "../components/film/book.timeline.json";

const COUNT_00 = timeline.films["palace-00"].count;
const COUNT_06 = timeline.films["palace-06"].count;
const f = (n: number) => `f${String(n).padStart(4, "0")}`;

test.describe("film reel", () => {
  test.beforeEach(async ({ request }) => {
    const r = await request.get("/films/palace-00/poster.webp");
    test.skip(r.status() !== 200, "no film frames encoded (run scripts/film/placeholder.mjs)");
  });

  test("scrubs frames as the page scrolls and flips chrome state", async ({ page }) => {
    await page.goto("/?hud=1");
    await expect(page.locator("canvas")).toHaveCount(1);
    await expect(page.locator("#hero")).toBeVisible();

    const hud = page.locator(".film-hud");
    await expect(hud).toContainText("palace-00 · f0001", { timeout: 10_000 });
    await expect(page.locator("html")).toHaveAttribute("data-reel-chrome", "film");

    // Hero copy pinned from frame 0 is visible; later pins are hidden.
    await expect(page.locator("#hero h1")).toBeVisible();
    await expect(page.locator("#hero [data-frame-pin]").last()).toBeHidden();

    // Scroll halfway through the hero segment (4 × 100svh tall → travel 3vh).
    const vh = await page.evaluate(() => window.innerHeight);
    const heroH = await page.locator("#hero").evaluate((el) => el.getBoundingClientRect().height);
    const travel = heroH - vh;
    await page.evaluate((y) => window.scrollTo(0, y), travel * 0.5);
    // Let the rAF loop settle (scroll → rect → frame is one tick, but the
    // first paint of a freshly-fetched frame can lag a few ticks).
    await page.waitForTimeout(600);
    const mid = (await hud.textContent()) ?? "";
    const midFrame = Number(/f(\d{4})/.exec(mid)?.[1]);
    const actualP = await page.evaluate(() => {
      const el = document.querySelector("#hero")!.getBoundingClientRect();
      return -el.top / (el.height - window.innerHeight);
    });
    const expected = Math.round(actualP * (COUNT_00 - 1)) + 1;
    expect(mid).toContain("palace-00");
    expect(Math.abs(midFrame - expected)).toBeLessThanOrEqual(1);

    // Near the end of the hero every pin (incl. the last, from push_in + 20) is up.
    await page.evaluate((y) => window.scrollTo(0, y), travel * 0.9);
    await page.waitForTimeout(400);
    await expect(page.locator("#hero [data-frame-pin]").last()).toBeVisible();

    // Scroll into the second segment: film name changes, dissolve runs.
    await page.evaluate((y) => window.scrollTo(0, y), heroH + vh * 0.3);
    await page.waitForTimeout(500);
    await expect(hud).toContainText("palace-01");

    // End of page: last film, last frame, chrome → body.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(600);
    await expect(hud).toContainText(`palace-06 · ${f(COUNT_06)}`);
    await expect(page.locator("html")).toHaveAttribute("data-reel-chrome", "body");

    // Canvas actually painted something non-background. Poll: the last frame
    // is fetched on demand, and headless WebKit under parallel load can take
    // a few seconds to decode + paint it (a single read after a fixed wait
    // flaked there while the chromium run was green).
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const c = document.querySelector("canvas") as HTMLCanvasElement;
            const ctx = c.getContext("2d")!;
            const d = ctx.getImageData(0, 0, c.width, c.height).data;
            let lit = 0;
            for (let i = 0; i < d.length; i += 4 * 97) if ((d[i] ?? 0) + (d[i + 1] ?? 0) + (d[i + 2] ?? 0) > 120) lit++;
            return lit;
          }),
        { timeout: 10_000 },
      )
      .toBeGreaterThan(50);
  });

  test("hall of summary shows real English prose that compresses to the kept lines", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/?hud=1");
    const seg = page.locator("#how-it-works");
    const { top, h } = await seg.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { top: r.top + window.scrollY, h: r.height };
    });
    // Not the first segment, so the film starts one viewport early (while the
    // hero stage slides out) and scrubs over travel + vh — mirror pickActive.
    const span = h - 900 + 900;
    const at = (p: number) => Math.ceil(top) + 2 + p * span - 900;

    // Early in the corridor every wall line is up (dim), none accented.
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" as ScrollBehavior }), at(0.2));
    await page.waitForTimeout(400);
    const early = await page.$$eval("#how-it-works .hall-line", (els) =>
      els.map((e) => ({ t: e.textContent ?? "", o: Number(getComputedStyle(e).opacity), c: getComputedStyle(e).color })),
    );
    expect(early.length).toBe(8);
    for (const l of early) {
      expect(l.t).toMatch(/^[A-Za-z0-9 ,.'’;:—-]+$/); // real English, no pseudo-text
      expect(l.o).toBeGreaterThan(0.4);
    }

    // After compress: only the 3 kept lines remain, now in the accent colour.
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" as ScrollBehavior }), at(0.75));
    await page.waitForTimeout(500);
    const late = await page.$$eval("#how-it-works .hall-line", (els) =>
      els.map((e) => ({ keep: e.getAttribute("data-keep") === "1", o: Number(getComputedStyle(e).opacity), c: getComputedStyle(e).color })),
    );
    const kept = late.filter((l) => l.keep);
    const dropped = late.filter((l) => !l.keep);
    expect(kept.length).toBe(3);
    for (const l of kept) expect(l.o).toBeGreaterThan(0.9);
    for (const l of dropped) expect(l.o).toBeLessThan(0.1);
    expect(new Set(kept.map((l) => l.c)).size).toBe(1);
    expect(kept[0]?.c).not.toBe(dropped[0]?.c);
  });

  test("reduced motion quantises to discrete steps", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/?hud=1");
    const hud = page.locator(".film-hud");
    await expect(hud).toContainText("palace-00 · f0001");
    const vh = await page.evaluate(() => window.innerHeight);
    await page.evaluate((y) => window.scrollTo(0, y), vh * 0.5);
    await page.waitForTimeout(300);
    // 5 steps → only frames at k/5 of the film are ever drawn.
    const allowed = new Set(
      Array.from({ length: 6 }, (_, k) => f(Math.round((k / 5) * (COUNT_00 - 1)) + 1)),
    );
    const t = (await hud.textContent()) ?? "";
    const drawn = /f\d{4}/.exec(t)?.[0] ?? "";
    expect(allowed.has(drawn), `${drawn} not in ${[...allowed].join(",")}`).toBe(true);
  });
});
