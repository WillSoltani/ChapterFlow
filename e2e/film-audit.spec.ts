import { test, expect } from "@playwright/test";
import { activePins, backgroundLum, overlap, LUM_MEAN_MAX, LUM_P90_MAX } from "./film-audit-lib";

/**
 * Film-reel QA audit. Scrubs the landing at many scroll positions across seven
 * viewports and asserts, numerically, what a designer would otherwise eyeball.
 * Only pins inside the ACTIVE sticky stage are judged.
 *
 *   1. Visible pins are fully inside the viewport (no clipping).
 *   2. Visible pins never overlap each other, nor a shown line of the
 *      Hall's wall prose (Phase 7 review: the compact stage put a lit wall
 *      line under the Hall headline).
 *   3. Pins stay clear of the nav pill.
 *   4. Contrast: composited background under each pin (canvas + scrim, text
 *      hidden) has mean luminance ≤ 110 and p90 ≤ 150 for near-white ink.
 *   5. The canvas paints a palace film at every step.
 *   6. Every pin becomes visible at least once across the scrub.
 *   7. No pin's text is set below 11 px (.film-label), and every link or
 *      button inside a pin is a tap target of at least 44 × 44 px.
 *
 * Viewports: desktop, laptop, tablet and phone as before, plus (Phase 7) a
 * small phone (360 × 740), the smallest (320 × 568) and a phone held sideways
 * (844 × 390, the compact stage), those three with touch and a mobile viewport.
 *
 * Opt-in (slow, needs public/films): RUN_AUDIT=1 npx playwright test e2e/film-audit.spec.ts --project=chromium
 */

type Viewport = { name: string; width: number; height: number; mobile?: boolean };
const VIEWPORTS: Viewport[] = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "laptop", width: 1280, height: 720 },
  { name: "tablet", width: 834, height: 1194 },
  { name: "phone", width: 390, height: 844 },
  // Phase 7: small phones and a phone held sideways (touch, mobile viewport).
  { name: "small phone", width: 360, height: 740, mobile: true },
  { name: "smallest phone", width: 320, height: 568, mobile: true },
  { name: "landscape phone", width: 844, height: 390, mobile: true },
];
/** The smallest copy the reel sets (.film-label, 11 px) and the smallest tap target. */
const MIN_FONT_PX = 11;
const MIN_TAP_PX = 44;
const STEPS = Array.from({ length: 17 }, (_, i) => Math.min(0.985, i / 16));

test.describe("film audit", () => {
  test.skip(process.env.RUN_AUDIT !== "1", "opt-in: RUN_AUDIT=1");

  for (const vp of VIEWPORTS) {
    test(`${vp.name} ${vp.width}×${vp.height}`, async ({ browser, browserName }) => {
      // ~120 screenshots per viewport; headless WebKit rasterises in software.
      test.setTimeout(browserName === "webkit" ? 600_000 : 300_000);
      const ctx = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        ...(vp.mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}),
      });
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
            if (pin.fontPx < MIN_FONT_PX) problems.push(`${where}: SMALL TEXT "${pin.text}" ${pin.fontPx}px`);
            for (const t of pin.targets)
              if (t.w < MIN_TAP_PX || t.h < MIN_TAP_PX) problems.push(`${where}: SMALL TAP TARGET "${t.text}" ${Math.round(t.w)}×${Math.round(t.h)}`);
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
          for (const pin of s.pins)
            for (const line of s.walls)
              if (overlap(pin, line)) problems.push(`${where}: WALL OVERLAP "${pin.text}" × wall "${line.text}"`);
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
