import { test, expect, type Browser, type BrowserContext, type BrowserContextOptions, type CDPSession, type Page } from "@playwright/test";
import timeline from "../components/film/book.timeline.json";

/**
 * Phone and tablet layout (plan Phase 7).
 *
 *   1. A phone held sideways (844 × 390, touch, DPR 3) draws the LANDSCAPE
 *      frames: every film request (poster, pack, frame) is for a landscape
 *      variant (no band tier), and exactly one poster of the first film is
 *      requested. Rotating to 390 × 844 switches to the band tier.
 *   2. Safe areas: with insets emulated (Chromium's
 *      Emulation.setSafeAreaInsetsOverride over CDP; top 47 / bottom 34 in
 *      portrait, left and right 47 / bottom 21 in landscape) no line of copy,
 *      button, nav item or footer link intersects an inset band at any
 *      chapter's main moment. A build without that CDP method (or
 *      SAFE_AREA_FALLBACK=1) re-applies the page's style sheets with every
 *      env(safe-area-inset-*) replaced by the inset in px and runs the same
 *      checks on the computed layout.
 *   3. Start button always in reach: stepping through the reel in small
 *      scroll steps on 390 × 844 and 1440 × 900, at every step at least one
 *      primary start call-to-action is visible (the hero's, the nav's, the
 *      Home chapter's) and never two at once. Reports the longest stretch
 *      without one.
 *
 * Opt-in: RUN_AUDIT=1 (part of `npm run test:film`).
 */

const AUDIT = process.env.RUN_AUDIT === "1";
const films = timeline.films as Record<string, { count: number; keys: Record<string, number> }>;
const key = (film: string, k: string) => films[film]!.keys[k]!;

const PHONE: BrowserContextOptions = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true };
const SIDEWAYS: BrowserContextOptions = { viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true };
const DESKTOP: BrowserContextOptions = { viewport: { width: 1440, height: 900 } };

async function newContext(browser: Browser, opts: BrowserContextOptions): Promise<BrowserContext> {
  const ctx = await browser.newContext(opts);
  // Never let a request leave this machine (the live site rate-limits it).
  await ctx.route((url) => !/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(url.toString()), (route) => route.abort());
  return ctx;
}

async function openLanding(ctx: BrowserContext, url = "/?hud=1"): Promise<Page> {
  const page = await ctx.newPage();
  await page.goto(url);
  await expect(page.locator("[data-film-reel]")).toHaveAttribute("data-film-armed", "", { timeout: 30_000 });
  await expect(page.locator("html")).toHaveAttribute("data-reel-chrome", "film", { timeout: 15_000 });
  await page.waitForTimeout(800);
  return page;
}

/** Scroll so chapter `id` shows `frame` of its film (pickActive's rule) and let the pins settle. */
async function goToFrame(page: Page, id: string, film: string, frame: number) {
  const p = Math.min(0.999, frame / (films[film]!.count - 1));
  await page.evaluate(
    ([id, p]) => {
      const el = document.getElementById(id as string)!;
      const first = document.querySelector("[data-film-segment]") === el;
      const stage = el.querySelector("[data-film-stage]")!.getBoundingClientRect().height;
      const r = el.getBoundingClientRect();
      const top = r.top + window.scrollY;
      const y = first ? top + (p as number) * (r.height - stage) : top - stage + (p as number) * r.height;
      window.scrollTo({ top: Math.round(y), behavior: "instant" as ScrollBehavior });
    },
    [id, p] as const,
  );
  await page.waitForTimeout(700);
}

/** Every chapter's main moments (the copy at its fullest), as in scripts/film/layout-sheets.mjs. */
const MOMENTS: Array<[string, string, number]> = [
  ["hero", "palace-00", key("palace-00", "doorway") - 16],
  ["hero", "palace-00", key("palace-00", "through") - 15],
  ["how-it-works", "palace-01", key("palace-01", "lines_lit") + 44],
  ["examples", "palace-02", key("palace-02", "room_c") + 25],
  ["examples", "palace-02", key("palace-02", "door_ahead") - 12],
  ["quiz", "palace-03", key("palace-03", "pulse") + 38],
  ["quiz", "palace-03", key("palace-03", "book_closed") - 8],
  ["why-it-works", "palace-04", key("palace-04", "light_36") + 15],
  ["library", "palace-05", key("palace-05", "orbit") + 40],
  ["home", "palace-06", key("palace-06", "hold") - 2],
];

test.describe("film layout (Phase 7)", () => {
  test.skip(!AUDIT, "opt-in: RUN_AUDIT=1");

  test("a phone held sideways draws the landscape frames: every film request is a landscape variant, one poster of the first film", async ({ browser }) => {
    test.setTimeout(120_000);
    const ctx = await newContext(browser, SIDEWAYS);
    const page = await ctx.newPage();
    const film: string[] = [];
    page.on("request", (r) => {
      const m = /\/films\/(palace-0\d[^/]*)\/([^?]+)/.exec(r.url());
      if (m) film.push(`${m[1]}/${m[2]}`);
    });
    await page.goto("/?hud=1");
    await expect(page.locator("[data-film-reel]")).toHaveAttribute("data-film-armed", "");
    // Scroll a little into the hero and into the Hall so frames and packs are asked for.
    await goToFrame(page, "hero", "palace-00", 120);
    await goToFrame(page, "how-it-works", "palace-01", 120);
    await page.waitForTimeout(1500);
    expect(film.length, "film requests were made").toBeGreaterThan(5);
    const banded = film.filter((u) => /^palace-0\d-(b\d+|p)\//.test(u));
    expect(banded, "no band-tier (or legacy portrait) request").toEqual([]);
    const posters0 = film.filter((u) => u.startsWith("palace-00/poster"));
    expect(posters0, "exactly one poster of the first film").toEqual(["palace-00/poster.webp"]);
    const hud = await page.locator(".film-hud").textContent();
    expect(hud ?? "").toMatch(/palace-01 · f/);
    // Rotate: the band tier from then on, like any orientation flip.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(1500);
    const after = await page.evaluate(() => [...((window as unknown as { __filmCaches?: Map<string, unknown> }).__filmCaches?.keys() ?? [])]);
    expect(after.some((k) => /^palace-01-b900@/.test(k)), `caches after rotating: ${after.join(", ")}`).toBe(true);
    await ctx.close();
  });

  for (const [name, opts, insets] of [
    ["portrait 390x844", PHONE, { top: 47, bottom: 34, left: 0, right: 0 }],
    ["landscape 844x390", SIDEWAYS, { top: 0, bottom: 21, left: 47, right: 47 }],
  ] as const) {
    test(`safe areas (${name}): no copy, button, nav item or footer link inside an inset band`, async ({ browser, browserName }) => {
      test.setTimeout(180_000);
      test.skip(browserName !== "chromium", "safe-area insets are emulated over Chromium's CDP");
      const ctx = await newContext(browser, opts);
      const page = await ctx.newPage();
      const cdp: CDPSession = await ctx.newCDPSession(page);
      let emulated = process.env.SAFE_AREA_FALLBACK !== "1";
      if (emulated) {
        try {
          await cdp.send("Emulation.setSafeAreaInsetsOverride" as never, { insets } as never);
        } catch (e) {
          emulated = false;
          console.log(`safe areas: Emulation.setSafeAreaInsetsOverride unavailable (${String(e).slice(0, 120)})`);
        }
      }
      await page.goto("/?hud=1");
      await expect(page.locator("[data-film-reel]")).toHaveAttribute("data-film-armed", "");
      await page.waitForTimeout(800);
      if (emulated) {
        // The override is live: env() reads the insets.
        const env = await page.evaluate(() => {
          const d = document.createElement("div");
          d.style.cssText = "position:fixed;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)";
          document.body.append(d);
          const cs = getComputedStyle(d);
          const out = { top: parseFloat(cs.paddingTop), right: parseFloat(cs.paddingRight), bottom: parseFloat(cs.paddingBottom), left: parseFloat(cs.paddingLeft) };
          d.remove();
          return out;
        });
        expect(env).toEqual(insets);
      } else {
        // No emulation in this build (or SAFE_AREA_FALLBACK=1): the page's own
        // style sheets are re-applied with every env(safe-area-inset-*) set
        // to the inset in px, so the computed paddings and offsets are those
        // a phone with these insets gets, and the same geometry checks run.
        console.log(`safe areas ${name}: no CDP inset emulation; env(safe-area-inset-*) substituted in the style sheets`);
        const replaced = await page.evaluate((ins) => {
          let n = 0;
          const text: string[] = [];
          for (const sheet of [...document.styleSheets]) {
            let rules: CSSRuleList;
            try {
              rules = sheet.cssRules;
            } catch {
              continue;
            }
            const css = [...rules].map((r) => r.cssText).join("\n");
            const out = css.replace(/env\(\s*safe-area-inset-(top|right|bottom|left)\s*(?:,[^)]*)?\)/g, (_, side: "top" | "right" | "bottom" | "left") => {
              n++;
              return `${ins[side]}px`;
            });
            text.push(out);
            sheet.disabled = true;
          }
          const style = document.createElement("style");
          style.dataset.safeAreaFallback = "";
          style.textContent = text.join("\n");
          document.head.append(style);
          return n;
        }, insets);
        expect(replaced, "env(safe-area-inset-*) uses substituted").toBeGreaterThan(10);
        await page.waitForTimeout(500);
        // The substitution is live: the nav sits below the top inset (or
        // at its usual offset where the inset is 0) and the footer's inner
        // padding clears the side insets.
        const nav = await page.evaluate(() => {
          const n = document.querySelector("header.rl-nav")!;
          const f = document.querySelector(".rl-public-footer-inner");
          const cs = f ? getComputedStyle(f) : null;
          return { top: parseFloat(getComputedStyle(n).top), footLeft: cs ? parseFloat(cs.paddingLeft) : -1, footRight: cs ? parseFloat(cs.paddingRight) : -1 };
        });
        if (insets.top) expect(nav.top, "nav top = the top inset").toBe(insets.top);
        if (insets.left) expect(nav.footLeft, "footer left padding ≥ the left inset").toBeGreaterThanOrEqual(insets.left);
        if (insets.right) expect(nav.footRight, "footer right padding ≥ the right inset").toBeGreaterThanOrEqual(insets.right);
      }

      const problems: string[] = [];
      // Copy that scrolls with the page (the footer) passes under the top
      // inset like any page content; it must stay clear of the side insets,
      // and of the bottom one once the page has scrolled to its end.
      const check = async (where: string, sides: { top: boolean; bottom: boolean } = { top: true, bottom: true }) => {
        const hits = await page.evaluate(([ins, sides]) => {
          const W = window.innerWidth;
          const H = window.innerHeight;
          const opacity = (el: Element) => {
            let o = 1;
            for (let e: Element | null = el; e; e = e.parentElement) o *= Number(getComputedStyle(e).opacity);
            return o;
          };
          const els: Array<[string, Element]> = [];
          for (const el of document.querySelectorAll("[data-film-reel] [data-frame-pin], [data-film-reel] .hall-line")) els.push(["copy", el]);
          for (const el of document.querySelectorAll("[data-film-reel] a[href], [data-film-reel] button")) els.push(["button", el]);
          for (const el of document.querySelectorAll("header.rl-nav a[href], header.rl-nav button")) els.push(["nav", el]);
          for (const el of document.querySelectorAll(".rl-public-footer a[href], .rl-public-footer p")) els.push(["footer", el]);
          const out: string[] = [];
          for (const [kind, el] of els) {
            const cs = getComputedStyle(el);
            if (cs.visibility !== "visible" || cs.display === "none" || opacity(el) < 0.05) continue;
            const r = el.getBoundingClientRect();
            if (r.width < 1 || r.height < 1 || r.bottom <= 0 || r.top >= H || r.right <= 0 || r.left >= W) continue;
            const bands: string[] = [];
            const scrolls = kind === "footer";
            if (ins.top && (sides.top || !scrolls) && r.top < ins.top) bands.push(`top ${Math.round(r.top)}`);
            if (ins.bottom && (sides.bottom || !scrolls) && r.bottom > H - ins.bottom) bands.push(`bottom ${Math.round(H - r.bottom)}`);
            if (ins.left && r.left < ins.left) bands.push(`left ${Math.round(r.left)}`);
            if (ins.right && r.right > W - ins.right) bands.push(`right ${Math.round(W - r.right)}`);
            if (bands.length) out.push(`${kind} "${(el.textContent ?? "").trim().slice(0, 30)}" in ${bands.join(", ")}`);
          }
          return out;
        }, [insets, sides] as const);
        for (const h of hits) problems.push(`${where}: ${h}`);
      };
      for (const [id, film, frame] of MOMENTS) {
        await goToFrame(page, id, film, frame);
        await check(`${id} f${frame + 1}`);
      }
      // The footer, scrolled fully into view.
      await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" as ScrollBehavior }));
      await page.waitForTimeout(500);
      await check("page end", { top: false, bottom: true });
      // The mobile menu.
      await page.locator('button[aria-label="Open navigation menu"]').click();
      await page.waitForTimeout(600);
      const menu = await page.evaluate((ins) => {
        const W = window.innerWidth;
        const H = window.innerHeight;
        const out: string[] = [];
        for (const el of document.querySelectorAll("#chapterflow-public-navigation a[href], #chapterflow-public-navigation button, #chapterflow-public-navigation h2")) {
          const r = el.getBoundingClientRect();
          if (r.width < 1 || r.bottom <= 0 || r.top >= H) continue;
          if ((ins.top && r.top < ins.top) || (ins.bottom && r.bottom > H - ins.bottom) || (ins.left && r.left < ins.left) || (ins.right && r.right > W - ins.right))
            out.push(`menu "${(el.textContent ?? el.getAttribute("aria-label") ?? "").trim().slice(0, 30)}" ${[r.left, r.top, r.right, r.bottom].map(Math.round)}`);
        }
        return out;
      }, insets);
      problems.push(...menu);
      console.log(`safe areas ${name}: ${problems.length} problem(s)\n${problems.join("\n")}`);
      expect(problems, problems.join("\n")).toEqual([]);
      await ctx.close();
    });
  }

  for (const [name, opts] of [
    ["390x844 touch", PHONE],
    ["1440x900", DESKTOP],
  ] as const) {
    test(`start button always in reach (${name}): at least one primary start CTA at every step, never two`, async ({ browser }) => {
      test.setTimeout(300_000);
      const ctx = await newContext(browser, opts);
      const page = await openLanding(ctx);
      // The nav resolves the session before it shows any primary action.
      await page.waitForTimeout(1200);
      const { end, vh } = await page.evaluate(() => {
        const segs = [...document.querySelectorAll("[data-film-segment]")];
        const last = segs[segs.length - 1]!;
        const stage = last.querySelector("[data-film-stage]")!.getBoundingClientRect().height;
        const r = last.getBoundingClientRect();
        return { end: r.top + window.scrollY + r.height - stage, vh: stage };
      });
      const step = Math.round(vh * 0.08);
      const rows: Array<{ y: number; n: number; which: string[] }> = [];
      for (let y = 0; y <= end + step; y += step) {
        const yy = Math.min(y, end);
        await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" as ScrollBehavior }), yy);
        await page.waitForTimeout(140);
        const which = await page.evaluate(() => {
          const H = window.innerHeight;
          const W = window.innerWidth;
          const shown = (el: Element) => {
            const cs = getComputedStyle(el);
            if (cs.visibility !== "visible" || cs.display === "none") return false;
            let o = 1;
            for (let e: Element | null = el; e; e = e.parentElement) o *= Number(getComputedStyle(e).opacity);
            if (o < 0.5) return false;
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < H && r.right > 0 && r.left < W;
          };
          const out: string[] = [];
          for (const el of document.querySelectorAll("[data-film-reel] a.film-btn-primary")) if (shown(el)) out.push(`film:${el.closest("[data-film-segment]")?.id}`);
          for (const el of document.querySelectorAll("header.rl-nav a[data-nav-primary]")) if (shown(el)) out.push("nav");
          return out;
        });
        rows.push({ y: yy, n: which.length, which });
        if (yy >= end) break;
      }
      // Longest stretch (px of scroll) with no start CTA on screen.
      let longest = 0;
      let runStart = -1;
      for (const r of rows) {
        if (r.n === 0 && runStart < 0) runStart = r.y;
        if (r.n > 0 && runStart >= 0) {
          longest = Math.max(longest, r.y - runStart);
          runStart = -1;
        }
      }
      if (runStart >= 0) longest = Math.max(longest, end - runStart);
      const none = rows.filter((r) => r.n === 0).map((r) => Math.round(r.y));
      const two = rows.filter((r) => r.n > 1).map((r) => `${Math.round(r.y)} (${r.which.join("+")})`);
      console.log(
        `start CTA ${name}: ${rows.length} steps of ${step}px over ${Math.round(end)}px; longest stretch without one ${Math.round(longest)}px (${(longest / vh).toFixed(2)} screens); ` +
          `steps without: ${none.length}, with two: ${two.length}`,
      );
      expect(none, `scroll positions with no start CTA: ${none.join(", ")}`).toEqual([]);
      expect(two, `scroll positions with two primary start CTAs: ${two.join(", ")}`).toEqual([]);
      await ctx.close();
    });
  }
});
