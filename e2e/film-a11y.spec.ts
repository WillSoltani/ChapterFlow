import { test, expect, type Page } from "@playwright/test";
import { activePins, overlap } from "./film-audit-lib";
import {
  A11Y_VIEWPORTS,
  backgroundShot,
  contrastOf,
  drawn,
  inViewport,
  isLarge,
  motionContext,
  required,
  scrollToY,
  segments,
  stageHeight,
  textItems,
  waitExact,
  luminance,
  ratio,
  type Motion,
  type Seg,
} from "./film-a11y-lib";

/**
 * Film reel accessibility and reduced motion (plan Phase 8).
 *
 *   1. Reduced motion, through the emulated OS setting and through the
 *      in-app attribute (html[data-motion="reduced"]), on 390 × 844 and
 *      1440 × 900: stepping through the reel stop by stop, every pin of every
 *      chapter is seen fully on at least once; the frame drawn is always one
 *      of the chapter's stops (between stops and in the slide-ins too); the
 *      film-audit checks (clipping, overlap, nav, size, tap targets) find
 *      nothing at any stop; the reel's length in screens is reported.
 *   2. Keyboard: Tab from the top of the page to the footer and Shift+Tab
 *      back. Every focused element inside the reel is fully visible
 *      (effective opacity ≥ 0.99), inside the viewport, not under the nav, and
 *      shows a focus indicator; the reel's tab order is document order; no
 *      trap. "Skip the film" is one of the first three tab stops and
 *      activating it puts focus after the reel, scrolled past its end.
 *      Normal motion and reduced motion, both viewports.
 *   3. Pointer focus: clicking a visible film button does not move the page;
 *      focus coming back to an element with the window does not either.
 *      Reduced motion, keyboard paging: PageDown / Space and PageUp /
 *      Shift+Space visit every stop of the reel in order, none passed.
 *      Forced colors: a focused film button keeps an outline.
 *   4. Structure (accessibility tree at the top of the page): one h1, no
 *      skipped heading level, every chapter heading and film button present
 *      with a name (pins that are off included), and no canvas, poster
 *      image, HUD or wall prose exposed.
 *   5. Contrast: every run of copy in every pin, at the moments it is fully
 *      on (normal motion: 17 positions per chapter plus each stop frame shown
 *      with the stage pinned; reduced motion: every stop), on both
 *      viewports: the WCAG ratio of its colour against the real pixels behind
 *      it (ink hidden, screenshot, worst 10 % of its text boxes) is at least
 *      4.5 (3 for large text: 24 px, or 18.66 px bold). Solid buttons by their
 *      own colours. Focus rings: the accent against the page colour ≥ 3.
 *
 * Opt-in (needs public/films): RUN_AUDIT=1 npx playwright test e2e/film-a11y.spec.ts --project=chromium
 */

const MOTIONS: Array<{ name: string; motion: Motion }> = [
  { name: "OS setting", motion: "os" },
  { name: "in-app attribute", motion: "app" },
];

async function openReel(page: Page) {
  await page.goto("/?hud=1");
  await expect(page.locator("html")).toHaveAttribute("data-reel-chrome", "film", { timeout: 20_000 });
  await page.waitForFunction(() => document.querySelector("[data-film-reel][data-film-armed]"));
  await page.waitForTimeout(800);
}

/**
 * Scroll position of stop `j` (pins.ts reducedStopScroll from the chapter's
 * top), kept 2 px inside the pinned travel: chapter tops are fractional, and
 * at the very end the next chapter's box would touch the viewport.
 */
const stopY = (s: Seg, stage: number, j: number) => {
  const y = s.top + (s.stops.length > 1 ? (j * (s.h - stage)) / (s.stops.length - 1) : 0);
  return Math.min(s.top + s.h - stage - 2, Math.max(Math.ceil(s.top) + 2, y));
};

test.describe("film a11y", () => {
  test.skip(process.env.RUN_AUDIT !== "1", "opt-in: RUN_AUDIT=1");

  for (const vp of A11Y_VIEWPORTS)
    for (const m of MOTIONS)
      test(`reduced motion (${m.name}) ${vp.name} ${vp.width}×${vp.height}: every pin seen fully on at a stop, only stop frames drawn, no audit problem`, async ({ browser }) => {
        test.setTimeout(300_000);
        const ctx = await motionContext(browser, vp, m.motion);
        const page = await ctx.newPage();
        await openReel(page);
        if (m.motion === "app") await expect(page.locator("html")).toHaveAttribute("data-motion", "reduced");
        const segs = await segments(page);
        const stage = await stageHeight(page);
        const reelScreens = segs.reduce((n, s) => n + s.h, 0) / vp.height;
        console.log(`[reduced ${m.name} ${vp.name}] reel ${reelScreens.toFixed(2)} screens; stops ${segs.map((s) => `${s.id}:${s.stops.length}`).join(" ")}`);
        const problems: string[] = [];
        const seen = new Set<string>();
        for (const s of segs) {
          const allowed = new Set(s.stops);
          for (let j = 0; j < s.stops.length; j++) {
            const where = `${s.id}#${j} f${s.stops[j]}`;
            await scrollToY(page, stopY(s, stage, j));
            if (!(await waitExact(page, s.film, s.stops[j]!))) {
              const d = await drawn(page);
              problems.push(`${where}: drew ${d?.film} f${d?.frame}, expected the stop`);
              continue;
            }
            // Pins fully on at this stop (effective opacity, scrims included).
            const on = await page.evaluate((id) => {
              const out: string[] = [];
              for (const el of document.querySelectorAll<HTMLElement>(`#${id} [data-frame-pin]`)) {
                let o = 1;
                for (let e: Element | null = el; e; e = e.parentElement) o *= Number(getComputedStyle(e).opacity);
                if (o >= 0.99) out.push((el.textContent ?? "").trim().slice(0, 40));
              }
              return out;
            }, s.id);
            for (const t of on) seen.add(`${s.id}:${t}`);
            // The film-audit checks at this stop.
            const a = await activePins(page);
            if (a.active !== s.id) problems.push(`${where}: active stage ${a.active}`);
            for (const pin of a.pins) {
              if (pin.x < 8 || pin.y < 0 || pin.x + pin.w > vp.width - 8 || pin.y + pin.h > vp.height)
                problems.push(`${where}: CLIPPED "${pin.text}" box=${[pin.x, pin.y, pin.w, pin.h].map(Math.round)}`);
              if (pin.y < a.navBottom + 8) problems.push(`${where}: UNDER NAV "${pin.text}"`);
              if (pin.fontPx < 11) problems.push(`${where}: SMALL TEXT "${pin.text}" ${pin.fontPx}px`);
              for (const t of pin.targets) if (t.w < 44 || t.h < 44) problems.push(`${where}: SMALL TAP TARGET "${t.text}" ${Math.round(t.w)}×${Math.round(t.h)}`);
            }
            for (let i = 0; i < a.pins.length; i++)
              for (let k = i + 1; k < a.pins.length; k++) if (overlap(a.pins[i]!, a.pins[k]!)) problems.push(`${where}: OVERLAP "${a.pins[i]!.text}" × "${a.pins[k]!.text}"`);
            for (const pin of a.pins) for (const line of a.walls) if (overlap(pin, line)) problems.push(`${where}: WALL OVERLAP "${pin.text}" × wall "${line.text}"`);
          }
          // Between stops and through the slide-in: still only stop frames.
          const probes = [s.top - stage * 0.5, ...s.stops.slice(1).map((_, j) => (stopY(s, stage, j) + stopY(s, stage, j + 1)) / 2 + 3)];
          for (const y of probes) {
            if (y < 0) continue;
            await scrollToY(page, y);
            await page.waitForTimeout(250);
            const d = await drawn(page);
            if (d && d.film === s.film && !allowed.has(d.frame)) problems.push(`${s.id} @${Math.round(y)}: drew f${d.frame}, not a stop (${s.stops.join(",")})`);
          }
        }
        const all = await page.$$eval("[data-frame-pin]", (els) => els.map((e) => `${e.closest("[data-film-segment]")?.id}:${(e.textContent ?? "").trim().slice(0, 40)}`));
        for (const k of all) if (!seen.has(k)) problems.push(`NEVER FULLY ON ${k}`);
        await ctx.close();
        const uniq = [...new Set(problems)];
        console.log(`[reduced ${m.name} ${vp.name}] ${uniq.length} problem(s)\n` + uniq.map((p) => "  " + p).join("\n"));
        expect(uniq, uniq.join("\n")).toEqual([]);
      });

  test("reduced motion stays correct around the film: the in-app toggle at runtime, anchors, one start button per stop, the canvas under the body", async ({ browser }) => {
    test.setTimeout(240_000);
    const vp = A11Y_VIEWPORTS[1]!;
    const ctx = await motionContext(browser, vp, "normal");
    const page = await ctx.newPage();
    await openReel(page);
    const normal = await segments(page);
    const stage = await stageHeight(page);
    const rooms = normal.find((s) => s.id === "examples")!;
    await scrollToY(page, rooms.top + 0.45 * (rooms.h - stage));
    await page.waitForTimeout(500);
    const before = (await drawn(page))!;
    expect(before.film, "normal motion: Rooms drawn").toBe(rooms.film);
    const setMotion = (m: string) => page.evaluate((m) => (document.documentElement.dataset.motion = m), m);
    // Toggle on: every chapter takes its reduced height; the frame drawn is a
    // stop; the visitor stays in Rooms, at the stop nearest the frame shown.
    await setMotion("reduced");
    await page.waitForTimeout(600);
    const reduced = await segments(page);
    for (const s of reduced) expect(Math.abs(s.h - stage * (1 + 0.4 * (s.stops.length - 1))), `${s.id} reduced height`).toBeLessThan(2);
    let d = await drawn(page);
    const active = reduced.find((s) => s.film === d?.film)!;
    expect(active.stops, `drawn ${d?.film} f${d?.frame} is a stop`).toContain(d!.frame);
    expect(d?.film, "still in Rooms after the switch").toBe(rooms.film);
    const nearest = rooms.stops.reduce((b, f) => (Math.abs(f - before.frame) < Math.abs(b - before.frame) ? f : b), rooms.stops[0]!);
    expect(d?.frame, `the stop nearest f${before.frame}`).toBe(nearest);
    // Toggle off: the normal heights come back, the visitor is still in Rooms
    // at that frame, and the film follows the scroll again.
    await setMotion("normal");
    await page.waitForTimeout(600);
    const back = await segments(page);
    back.forEach((s, i) => expect(Math.abs(s.h - normal[i]!.h), `${s.id} normal height again`).toBeLessThan(2));
    d = await drawn(page);
    expect(d?.film, "still in Rooms after switching back").toBe(rooms.film);
    expect(Math.abs(d!.frame - nearest), `back at f${nearest} (drew f${d?.frame})`).toBeLessThanOrEqual(2);
    await scrollToY(page, back[1]!.top + 0.37 * (back[1]!.h - stage));
    await page.waitForTimeout(600);
    d = await drawn(page);
    expect(d?.film).toBe(back[1]!.film);
    // Normal motion: the frame of the scroll position again (pickActive + frameAt), not a stop.
    const hall = back[1]!;
    const want = Math.round(((0.37 * (hall.h - stage) + stage) / hall.h) * (hall.count - 1));
    expect(Math.abs(d!.frame - want), `normal motion draws f${want} (drew f${d?.frame})`).toBeLessThanOrEqual(2);
    // Reduced again. Anchors land on the chapter's start, its first stop, stage pinned.
    await setMotion("reduced");
    await page.waitForTimeout(600);
    for (const id of ["how-it-works", "examples", "why-it-works"]) {
      await page.evaluate((id) => (window.location.hash = `#${id}`), id);
      await page.waitForTimeout(600);
      const s = (await segments(page)).find((x) => x.id === id)!;
      const top = await page.locator(`#${id}`).evaluate((el) => el.getBoundingClientRect().top);
      expect(Math.abs(top), `#${id} at the top`).toBeLessThan(2);
      expect(await waitExact(page, s.film, s.stops[0]!), `#${id} shows its first stop f${s.stops[0]}`).toBe(true);
    }
    // One primary start button on screen at every stop (Phase 7's rule).
    const segsR = await segments(page);
    const counts: string[] = [];
    for (const s of segsR)
      for (let j = 0; j < s.stops.length; j++) {
        await scrollToY(page, stopY(s, stage, j));
        await page.waitForTimeout(350);
        const which = await page.evaluate(() => {
          const shown = (el: Element) => {
            const cs = getComputedStyle(el);
            if (cs.visibility !== "visible" || cs.display === "none") return false;
            let o = 1;
            for (let e: Element | null = el; e; e = e.parentElement) o *= Number(getComputedStyle(e).opacity);
            const r = el.getBoundingClientRect();
            return o >= 0.5 && r.width > 0 && r.bottom > 0 && r.top < window.innerHeight;
          };
          const out: string[] = [];
          for (const el of document.querySelectorAll("[data-film-reel] a.film-btn-primary")) if (shown(el)) out.push("film");
          for (const el of document.querySelectorAll("header.rl-nav a[data-nav-primary]")) if (shown(el)) out.push("nav");
          return out;
        });
        if (which.length !== 1) counts.push(`${s.id}#${j}: ${which.length} (${which.join("+")})`);
      }
    expect(counts, "stops without exactly one start button").toEqual([]);
    // Below the reel the canvas is not composited; back up, it returns with a stop frame.
    const pricing = await page.locator("#pricing").evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
    await scrollToY(page, pricing);
    await page.waitForTimeout(400);
    expect(await page.locator(".film-canvas").evaluate((el) => getComputedStyle(el).visibility)).toBe("hidden");
    // Below the reel a switch of mode leaves the body where it is on screen.
    const pricingTop = () => page.locator("#pricing").evaluate((el) => el.getBoundingClientRect().top);
    const atPricing = await pricingTop();
    await setMotion("normal");
    await page.waitForTimeout(600);
    expect(Math.abs((await pricingTop()) - atPricing), "pricing stays put (to normal)").toBeLessThan(2);
    await setMotion("reduced");
    await page.waitForTimeout(600);
    expect(Math.abs((await pricingTop()) - atPricing), "pricing stays put (to reduced)").toBeLessThan(2);
    const home = segsR[segsR.length - 1]!;
    await scrollToY(page, stopY(home, stage, home.stops.length - 1));
    await page.waitForTimeout(400);
    expect(await page.locator(".film-canvas").evaluate((el) => getComputedStyle(el).visibility)).toBe("visible");
    expect(await waitExact(page, home.film, home.stops.at(-1)!), "the last stop drawn again").toBe(true);
    await ctx.close();
  });

  for (const vp of A11Y_VIEWPORTS)
    for (const motion of ["normal", "os"] as const)
      test(`keyboard (${motion === "os" ? "reduced motion" : "normal motion"}) ${vp.name}: Tab to the footer and back; focused film elements visible, in view, ringed; skip the film`, async ({ browser }) => {
        test.setTimeout(240_000);
        // WebKit's plain Tab moves between form fields only (Safari's default,
        // "Press Tab to highlight each item" off); Option+Tab is its key to
        // every link and button. The page's order is the same.
        const webkit = browser.browserType().name() === "webkit";
        const TAB = webkit ? "Alt+Tab" : "Tab";
        const BACK = webkit ? "Alt+Shift+Tab" : "Shift+Tab";
        const ctx = await motionContext(browser, vp, motion);
        const page = await ctx.newPage();
        await openReel(page);
        const problems: string[] = [];

        // Skip the film: within the first three tab stops; activating it lands after the reel.
        await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
        const firstStops: string[] = [];
        let skipAt = -1;
        for (let i = 0; i < 3; i++) {
          await page.keyboard.press(TAB);
          const name = await page.evaluate(() => (document.activeElement?.textContent ?? "").trim());
          firstStops.push(name);
          if (name === "Skip the film") {
            skipAt = i + 1;
            break;
          }
        }
        expect(skipAt, `first tab stops: ${firstStops.join(" | ")}`).toBeGreaterThan(0);
        const skipShown = await page.evaluate(() => {
          const r = document.activeElement!.getBoundingClientRect();
          return r.width > 20 && r.height >= 44 && r.top >= 0 && r.left >= 0;
        });
        expect(skipShown, "the focused skip link shows").toBe(true);
        await page.keyboard.press("Enter");
        await page.waitForTimeout(300);
        const after = await page.evaluate(() => {
          const segs = [...document.querySelectorAll("[data-film-segment]")];
          const last = segs[segs.length - 1]!.getBoundingClientRect();
          const stage = document.querySelector("[data-film-stage]")!.getBoundingClientRect().height;
          const reelEnd = last.top + window.scrollY + last.height - stage;
          const a = document.activeElement!;
          const reel = document.querySelector("[data-film-reel]")!;
          const lastSeg = segs[segs.length - 1]!;
          return {
            scrollY: window.scrollY,
            reelEnd,
            id: a.id,
            afterReel: !!(lastSeg.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_FOLLOWING) && !lastSeg.contains(a),
            inReel: reel.contains(a) && !a.closest("[data-film-body]"),
          };
        });
        expect(after.afterReel && !after.inReel, `focus after the reel (${after.id})`).toBe(true);
        expect(after.scrollY, "scrolled past the reel's end").toBeGreaterThan(after.reelEnd);
        // A fresh page for the full pass (the focus navigation starting point is now after the reel).
        await openReel(page);

        const docOrder = await page.evaluate(() =>
          [...document.querySelectorAll<HTMLElement>("[data-film-segment] a[href], [data-film-segment] button, [data-film-segment] [tabindex]")]
            .filter((el) => el.tabIndex >= 0 && getComputedStyle(el).display !== "none" && el.getClientRects().length > 0)
            .map((el) => (el.textContent ?? "").trim()),
        );
        const check = async (dir: string) => {
          const s = await page.evaluate(() => {
            const a = document.activeElement as HTMLElement | null;
            if (!a || a === document.body) return null;
            const seg = a.closest("[data-film-segment]");
            const footer = !!a.closest("footer");
            if (!seg) return { inReel: false, footer, name: (a.textContent ?? "").trim() };
            let o = 1;
            for (let e: Element | null = a; e; e = e.parentElement) o *= Number(getComputedStyle(e).opacity);
            const r = a.getBoundingClientRect();
            const nav = document.querySelector(".rl-nav")?.getBoundingClientRect();
            const cs = getComputedStyle(a);
            const ring = a.matches(":focus-visible") && ((cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0) || /0px 0px 0px [1-9]/.test(cs.boxShadow));
            return {
              inReel: true,
              footer,
              name: (a.textContent ?? "").trim(),
              seg: seg.id,
              opacity: o,
              inView: r.top >= 0 && r.left >= 0 && r.bottom <= window.innerHeight && r.right <= window.innerWidth,
              underNav: nav ? r.top < nav.bottom : false,
              ring,
            };
          });
          if (s?.inReel) {
            const where = `${dir} ${s.seg}: "${s.name}"`;
            if ((s.opacity ?? 0) < 0.99) problems.push(`${where}: opacity ${s.opacity?.toFixed(2)}`);
            if (!s.inView) problems.push(`${where}: outside the viewport`);
            if (s.underNav) problems.push(`${where}: under the nav`);
            if (!s.ring) problems.push(`${where}: no focus indicator`);
          }
          return s;
        };
        const settle = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 120)))));
        const forward: string[] = [];
        let reachedFooter = false;
        for (let i = 0; i < 250 && !reachedFooter; i++) {
          await page.keyboard.press(TAB);
          await settle();
          const s = await check("Tab");
          if (s?.inReel) forward.push(s.name);
          if (s?.footer) reachedFooter = true;
        }
        expect(reachedFooter, "Tab reaches the footer (no trap)").toBe(true);
        expect(forward, "the reel's tab order is document order").toEqual(docOrder);
        const backward: string[] = [];
        let reachedTop = false;
        for (let i = 0; i < 250 && !reachedTop; i++) {
          await page.keyboard.press(BACK);
          await settle();
          const s = await check("Shift+Tab");
          if (s?.inReel) backward.push(s.name);
          if (s && !s.inReel && (s.name === "Skip to main content" || s.name === "Skip the film")) reachedTop = true;
        }
        expect(reachedTop, "Shift+Tab gets back to the top (no trap)").toBe(true);
        expect(backward, "Shift+Tab walks the reel in reverse document order").toEqual([...docOrder].reverse());
        await ctx.close();
        console.log(`[keyboard ${motion} ${vp.name}] reel tab stops: ${forward.join(" → ")}; ${problems.length} problem(s)`);
        expect(problems, problems.join("\n")).toEqual([]);
      });

  for (const vp of A11Y_VIEWPORTS)
    test(`reduced motion, keyboard paging ${vp.name}: PageDown and Space visit every stop in order, PageUp and Shift+Space every one back`, async ({ browser }) => {
      test.setTimeout(240_000);
      const ctx = await motionContext(browser, vp, "os");
      const page = await ctx.newPage();
      await openReel(page);
      const segs = await segments(page);
      const want = segs.flatMap((s) => s.stops.map((f) => `${s.film}:f${f}`));
      const reelEnd = segs.at(-1)!.top + segs.at(-1)!.h;
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      const settle = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 120)))));
      const seen = async (out: string[]) => {
        const d = await drawn(page);
        const k = d ? `${d.film}:f${d.frame}` : "none";
        if (out.at(-1) !== k) out.push(k);
      };
      // Down: PageDown and Space alternately, until the reel is behind.
      const down: string[] = [];
      await seen(down);
      for (let i = 0; i < 120; i++) {
        await page.keyboard.press(i % 2 ? "Space" : "PageDown");
        await settle();
        if ((await page.evaluate(() => window.scrollY)) > reelEnd) break;
        await seen(down);
      }
      expect(down, "every stop, in order, going down").toEqual(want);
      // Up: back from the body to the top.
      const up: string[] = [];
      for (let i = 0; i < 120; i++) {
        await page.keyboard.press(i % 2 ? "Shift+Space" : "PageUp");
        await settle();
        await seen(up);
        if ((await page.evaluate(() => window.scrollY)) <= 0) break;
      }
      expect(up, "every stop, in order, going up").toEqual([...want].reverse());
      await ctx.close();
    });

  test("focus coming back with the window does not move the page", async ({ browser }) => {
    const vp = A11Y_VIEWPORTS[1]!;
    const webkit = browser.browserType().name() === "webkit";
    const ctx = await motionContext(browser, vp, "normal");
    const page = await ctx.newPage();
    await openReel(page);
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    // Keyboard focus on the first film link.
    let inReel = false;
    for (let i = 0; i < 30 && !inReel; i++) {
      await page.keyboard.press(webkit ? "Alt+Tab" : "Tab");
      inReel = await page.evaluate(() => !!document.activeElement?.closest("[data-film-segment]"));
    }
    expect(inReel, "a film link has keyboard focus").toBe(true);
    // Read on (focus stays on the link), then the window regains focus: the
    // browser fires focus and focusin on the same element, no relatedTarget.
    const segs = await segments(page);
    await scrollToY(page, segs[3]!.top + 100);
    await page.waitForTimeout(400);
    const y0 = await page.evaluate(() => window.scrollY);
    await page.evaluate(() => {
      const a = document.activeElement!;
      a.dispatchEvent(new FocusEvent("focus", { relatedTarget: null }));
      a.dispatchEvent(new FocusEvent("focusin", { bubbles: true, relatedTarget: null }));
    });
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => window.scrollY), "scroll unchanged").toBe(y0);
    await ctx.close();
  });

  test("forced colors: a focused film button keeps a visible outline", async ({ browser }) => {
    const ctx = await motionContext(browser, A11Y_VIEWPORTS[1]!, "normal");
    const page = await ctx.newPage();
    await page.emulateMedia({ forcedColors: "active" });
    await openReel(page);
    test.skip(!(await page.evaluate(() => matchMedia("(forced-colors: active)").matches)), "this browser does not emulate forced colors");
    const webkit = browser.browserType().name() === "webkit";
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    let ring: { name: string; style: string; width: number } | null = null;
    for (let i = 0; i < 30 && !ring; i++) {
      await page.keyboard.press(webkit ? "Alt+Tab" : "Tab");
      ring = await page.evaluate(() => {
        const a = document.activeElement as HTMLElement | null;
        if (!a?.matches(".film-btn")) return null;
        const cs = getComputedStyle(a);
        return { name: (a.textContent ?? "").trim(), style: cs.outlineStyle, width: parseFloat(cs.outlineWidth) };
      });
    }
    expect(ring, "Tab reaches a film button").not.toBeNull();
    expect(ring!.style, `${ring!.name}: outline style`).not.toBe("none");
    expect(ring!.width, `${ring!.name}: outline width`).toBeGreaterThan(0);
    await ctx.close();
  });

  test("pointer focus: clicking a visible film button does not move the page", async ({ browser }) => {
    const vp = A11Y_VIEWPORTS[1]!;
    const ctx = await motionContext(browser, vp, "normal");
    const page = await ctx.newPage();
    await openReel(page);
    // Keep the page: a click on a link would navigate.
    await page.evaluate(() => document.addEventListener("click", (e) => e.preventDefault(), true));
    // `at`: share of the chapter's pinned travel. The hero at 0.69 is frame
    // 166: its buttons are fading (visible, clickable, not fully on), where a
    // KEYBOARD focus would bring them on; a click must not.
    const cases: Array<{ name: RegExp; seg: string; at: number }> = [
      { name: /start reading free/i, seg: "hero", at: 0.0 },
      { name: /step inside/i, seg: "hero", at: 0.1 },
      { name: /step inside/i, seg: "hero", at: 166 / 240 },
      { name: /browse all/i, seg: "library", at: 0.98 },
      { name: /start your first book/i, seg: "home", at: 0.98 },
    ];
    const segs = await segments(page);
    for (const c of cases) {
      const s = segs.find((x) => x.id === c.seg)!;
      await scrollToY(page, Math.round(s.top + c.at * (s.h - vp.height)));
      await page.waitForTimeout(500);
      const o = await page.locator(`#${c.seg}`).getByRole("link", { name: c.name }).evaluate((el) => {
        let o = 1;
        for (let e: Element | null = el; e; e = e.parentElement) o *= Number(getComputedStyle(e).opacity);
        return o;
      });
      expect(o, `${c.name} is visible`).toBeGreaterThan(0.05);
      const link = page.locator(`#${c.seg}`).getByRole("link", { name: c.name });
      const before = await page.evaluate(() => window.scrollY);
      await link.click();
      await page.waitForTimeout(300);
      const state = await page.evaluate(() => ({ y: window.scrollY, focused: (document.activeElement?.textContent ?? "").trim() }));
      expect(state.y, `${c.name}: scroll unchanged (focus: ${state.focused})`).toBe(before);
    }
    await ctx.close();
  });

  for (const motion of ["normal", "os"] as const)
    test(`structure (${motion === "os" ? "reduced motion" : "normal motion"}): one h1, no skipped level, every chapter heading and film button named, decoration hidden`, async ({ browser }) => {
      const ctx = await motionContext(browser, A11Y_VIEWPORTS[1]!, motion);
      const page = await ctx.newPage();
      await openReel(page);
      const tree = await page.locator("body").ariaSnapshot();
      const headings = [...tree.matchAll(/- heading "([^"]*)" \[level=(\d)\]/g)].map((m) => ({ name: m[1]!, level: Number(m[2]) }));
      expect(headings.filter((h) => h.level === 1).map((h) => h.name), "exactly one h1").toHaveLength(1);
      for (let i = 1; i < headings.length; i++)
        expect(headings[i]!.level, `"${headings[i]!.name}" after "${headings[i - 1]!.name}"`).toBeLessThanOrEqual(headings[i - 1]!.level + 1);
      // Every chapter heading and film link, from the DOM, is in the tree with its name.
      const film = await page.evaluate(() => ({
        headings: [...document.querySelectorAll("[data-film-segment] :is(h1, h2, h3)")].map((h) => (h.textContent ?? "").replace(/\s+/g, " ").trim()),
        links: [...document.querySelectorAll<HTMLElement>("[data-film-segment] :is(a[href], button)")]
          .filter((el) => getComputedStyle(el).display !== "none")
          .map((el) => (el.textContent ?? "").replace(/\s+/g, " ").trim()),
      }));
      expect(film.headings.length, "the hero h1 and six chapter headings").toBe(7);
      // Compared without white space (a <br> is a space in the tree, nothing in textContent).
      const flat = tree.replace(/\s+/g, "");
      const bare = (t: string) => t.replace(/\s+/g, "");
      for (const h of film.headings) expect(flat, `heading "${h}" in the tree`).toContain(`heading"${bare(h)}"`);
      for (const l of film.links) {
        expect(l.length, "a film link has a name").toBeGreaterThan(0);
        expect(flat, `link "${l}" in the tree`).toContain(`link"${bare(l)}"`);
      }
      // Decoration and chrome: not in the tree.
      const wall = await page.locator(".hall-line").first().textContent();
      expect(tree, "the Hall wall prose").not.toContain((wall ?? "").slice(0, 30));
      expect(await page.locator(".film-canvas").getAttribute("aria-hidden"), "the canvas layer (canvas and HTML poster)").toBe("true");
      expect(tree).not.toMatch(/- img/);
      // The page runs with ?hud=1: the HUD is there, and hidden.
      await expect(page.locator(".film-hud")).toHaveCount(1);
      expect(await page.locator(".film-hud").getAttribute("aria-hidden"), "the HUD").toBe("true");
      expect(tree).not.toContain("reel idle");
      expect(tree).not.toMatch(/palace-0\d · f\d{4}/);
      await ctx.close();
    });

  for (const vp of A11Y_VIEWPORTS)
    for (const motion of ["normal", "os"] as const)
      test(`contrast (${motion === "os" ? "reduced motion" : "normal motion"}) ${vp.name}: every run of copy ≥ 4.5:1 (large 3:1) on the real picture`, async ({ browser }) => {
        test.setTimeout(600_000);
        const ctx = await motionContext(browser, vp, motion);
        const page = await ctx.newPage();
        await openReel(page);
        const segs = await segments(page);
        const stage = await stageHeight(page);
        const worst = new Map<string, { ratio: number; need: number; where: string; kind: string }>();
        for (const s of segs) {
          const ys: number[] = [];
          if (motion === "os") for (let j = 0; j < s.stops.length; j++) ys.push(stopY(s, stage, j));
          else {
            for (let i = 0; i <= 16; i++) ys.push(Math.ceil(s.top) + 2 + (s.h - stage) * Math.min(0.985, i / 16));
            // Each stop frame, where the stage is pinned (every pin is fully on at one).
            const first = s === segs[0];
            for (const f of s.stops) {
              const p = f / (s.count - 1);
              const off = first ? p * (s.h - stage) : p * s.h - stage;
              if (off >= 0) ys.push(s.top + off);
            }
          }
          for (const y of ys) {
            await scrollToY(page, y);
            await page.waitForTimeout(motion === "os" ? 150 : 450);
            const d = await drawn(page);
            if (!d || d.film !== s.film) continue;
            await waitExact(page, s.film, d.frame);
            const items = (await textItems(page, s.id)).filter((t) => t.pinOn >= 0.99 && inViewport(t, vp));
            if (!items.length) continue;
            const bg = await backgroundShot(page);
            for (const t of items) {
              const r = contrastOf(t, bg);
              const prev = worst.get(t.key);
              if (!prev || r < prev.ratio) worst.set(t.key, { ratio: r, need: required(t), where: `${s.id} f${d.frame}`, kind: `${t.kind}${isLarge(t) ? " large" : ""}` });
            }
          }
        }
        // Focus rings: accent outer ring over a page-colour inner ring (.film-btn:focus-visible).
        const ring = await page.evaluate(() => {
          const s = getComputedStyle(document.querySelector(".landing-dark") ?? document.documentElement);
          return { accent: s.getPropertyValue("--cf-recall-accent").trim(), bg: s.getPropertyValue("--cf-recall-bg").trim() };
        });
        const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
        const ringRatio = ratio(luminance(...hex(ring.accent)), luminance(...hex(ring.bg)));
        const all = await page.$$eval("[data-frame-pin]", (els) => els.length);
        const rows = [...worst.entries()].sort((a, b) => a[1].ratio - b[1].ratio);
        console.log(
          `[contrast ${motion} ${vp.name}] ${rows.length} runs of copy measured (${all} pins); focus ring ${ringRatio.toFixed(2)}:1\n` +
            rows.map(([k, v]) => `  ${v.ratio.toFixed(2)}:1 (need ${v.need}) ${v.kind} ${k} @ ${v.where}`).join("\n"),
        );
        const fails = rows.filter(([, v]) => v.ratio < v.need).map(([k, v]) => `${k}: ${v.ratio.toFixed(2)} < ${v.need} @ ${v.where}`);
        // Every run of copy in the reel was measured at least once.
        for (const t of await textItems(page)) if (!worst.has(t.key)) fails.push(`${t.key}: never measured fully on`);
        await ctx.close();
        expect(ringRatio, "focus ring accent against the page colour").toBeGreaterThanOrEqual(3);
        expect(fails, fails.join("\n")).toEqual([]);
      });
});
