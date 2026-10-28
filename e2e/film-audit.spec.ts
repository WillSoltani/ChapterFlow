import { test, expect } from "@playwright/test";
import { activePins, backgroundLum, overlap, LUM_MEAN_MAX, LUM_P90_MAX } from "./film-audit-lib";

/**
 * Film-reel QA audit. Scrubs /film at many scroll positions across four
 * viewports and asserts, numerically, what a designer would otherwise eyeball.
 * Only pins inside the ACTIVE sticky stage are judged.
 *
 *   1. Visible pins are fully inside the viewport (no clipping).
 *   2. Visible pins never overlap each other.
 *   3. Pins stay clear of the nav pill.
 *   4. Contrast: composited background under each pin (canvas + scrim, text
 *      hidden) has mean luminance ≤ 110 and p90 ≤ 150 for near-white ink.
 *   5. The canvas paints a palace film at every step.
 *   6. Every pin becomes visible at least once across the scrub.
 *
 * Opt-in (slow, needs public/films): RUN_AUDIT=1 npx playwright test e2e/film-audit.spec.ts --project=chromium
 */

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "laptop", width: 1280, height: 720 },
  { name: "tablet", width: 834, height: 1194 },
  { name: "phone", width: 390, height: 844 },
];
const STEPS = Array.from({ length: 17 }, (_, i) => Math.min(0.985, i / 16));

test.describe("film audit", () => {
  test.skip(process.env.RUN_AUDIT !== "1", "opt-in: RUN_AUDIT=1");

  for (const vp of VIEWPORTS) {
    test(`${vp.name} ${vp.width}×${vp.height}`, async ({ browser, browserName }) => {
      // ~120 screenshots per viewport; headless WebKit rasterises in software.
      test.setTimeout(browserName === "webkit" ? 600_000 : 300_000);
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await ctx.newPage();
      await page.goto("/?hud=1");
      await page.waitForTimeout(1200);

      const segs = await page.$$eval("[data-film-segment]", (els) =>
        els.map((e) => {
          const r = e.getBoundingClientRect();
          return { id: e.id, top: r.top + window.scrollY, h: r.height };
        }),
      );
      const problems: string[] = [];
      const seen = new Set<string>();

      for (const seg of segs) {
        const travel = seg.h - vp.height;
        for (const p of STEPS) {
          // Segment tops are fractional; +2px past the ceiling so the segment is
          // unambiguously the pinned one at p=0.
          const y = Math.ceil(seg.top) + 2 + travel * p;
          await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" as ScrollBehavior }), y);
          await page.waitForFunction((y) => Math.abs(window.scrollY - y) < 2, y, { timeout: 5000 });
          await page.waitForTimeout(450);
          const s = await activePins(page);
          const where = `${seg.id}@${p}`;
          if (s.active !== seg.id) problems.push(`${where}: expected active ${seg.id}, got ${s.active}`);
          if (!s.hud.includes("palace-")) problems.push(`${where}: canvas not painting (${s.hud})`);

          const lum = await backgroundLum(page, s.pins, vp);
          s.pins.forEach((pin, i) => {
            seen.add(`${pin.seg}:${pin.text}`);
            if (pin.x < 8 || pin.y < 0 || pin.x + pin.w > vp.width - 8 || pin.y + pin.h > vp.height)
              problems.push(`${where}: CLIPPED "${pin.text}" box=${[pin.x, pin.y, pin.w, pin.h].map(Math.round)}`);
            if (pin.y < s.navBottom + 8)
              problems.push(`${where}: UNDER NAV "${pin.text}" top=${Math.round(pin.y)} nav=${Math.round(s.navBottom)}`);
            // CTA pins carry solid buttons (dark ink on accent) — contrast is the button's, not the frame's.
            const l = lum[i];
            if (!pin.interactive && l && (l.mean > LUM_MEAN_MAX || l.p90 > LUM_P90_MAX))
              problems.push(`${where}: LOW CONTRAST "${pin.text}" mean=${Math.round(l.mean)} p90=${Math.round(l.p90)}`);
          });
          for (let i = 0; i < s.pins.length; i++)
            for (let j = i + 1; j < s.pins.length; j++) {
              const a = s.pins[i];
              const b = s.pins[j];
              if (a && b && overlap(a, b)) problems.push(`${where}: OVERLAP "${a.text}" × "${b.text}"`);
            }
        }
      }

      const all = await page.$$eval("[data-frame-pin]", (els) =>
        els.map((e) => `${e.closest("[data-film-segment]")?.id}:${(e.textContent ?? "").trim().slice(0, 40)}`),
      );
      for (const k of all) if (!seen.has(k)) problems.push(`NEVER VISIBLE ${k}`);

      await ctx.close();
      const uniq = [...new Set(problems)];
      console.log(`\n[${vp.name}] ${uniq.length} problem(s)\n` + uniq.map((p) => "  " + p).join("\n"));
      expect(uniq, uniq.join("\n")).toEqual([]);
    });
  }
});
