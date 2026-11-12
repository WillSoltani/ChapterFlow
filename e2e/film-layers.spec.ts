import { test, expect, type Browser, type BrowserContextOptions, type Page } from "@playwright/test";
import timeline from "../components/film/book.timeline.json";
import { PROD_E2E_HEADERS } from "../playwright.config";
import { isProtectedSurfacePath } from "../lib/protected-surface";

/**
 * Film-reel layers, handlers and feel (plan Phase 5).
 *
 *   1. Touch nav over the film: no backdrop-filter for every look (?nav=1…5);
 *      over the body sections and on desktop the nav keeps today's blur.
 *   2. No permanent layers: at rest in the hero and in a city chapter no
 *      element under [data-film-segment] has a will-change; in the Hall only
 *      the two wall containers may.
 *   3. No layout reads in the scroll path: getBoundingClientRect calls during
 *      a 3 s steady scroll through two chapters stay within the film loop's
 *      geometry safety net (9 reads per 500 ms) plus 10.
 *   4. The Hall writes only changed styles (style-attribute mutations during a
 *      2 s steady scroll through it).
 *   5. One shared reduced-motion subscription (≤ 2 'change' listeners).
 *   6. The canvas is not composited under the body sections, and comes back
 *      with the right frame (scroll up, reload at Pricing, anchor jump).
 *   7. Smoothing by input: wheel 90 ms, touch 35 ms, ?smooth=0 draws the
 *      target frame on the next animation frame.
 *   8. Logged out: /books (public) is prefetched and reachable (200, no
 *      sign-in redirect), no prefetch goes into a sign-in redirect, no CSP
 *      error, and /book/library still redirects. Tagged @prod: it runs in the
 *      E2E_MODE=prod job (`next start`), the only build that prefetches; it
 *      is not part of the RUN_AUDIT dev run.
 *
 * Opt-in: RUN_AUDIT=1 npx playwright test e2e/film-layers.spec.ts --project=chromium
 */

/** Today's desktop / body nav blur, as Chromium and WebKit compute it. */
const NAV_BLUR = /^blur\(18px\) saturate\(1\.5\)$/;
const TOUCH_QUERY = "(hover: none) and (pointer: coarse)";
const PHONE: BrowserContextOptions = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true };
const DESKTOP: BrowserContextOptions = { viewport: { width: 1440, height: 900 } };
/** The edge header a production build expects (playwright.config), @prod only. */
const PROD_HEADERS = process.env.E2E_MODE === "prod" ? { ...PROD_E2E_HEADERS } : undefined;
/**
 * Hall style-attribute mutations in a 2 s steady scroll, desktop: 443 before
 * Phase 5, 429 after, 333 once the dead --hall-dolly write was dropped
 * (2026-11-11, dev server, Chromium); bound = after + 25 %.
 * Most are real changes: through the compress window every wall line's
 * opacity moves by more than its 0.01 step each frame.
 */
const HALL_STYLE_WRITES_MAX = 417;
const GBCR_MAX = 64;

const COUNT_02 = timeline.films["palace-02"].count;
const COUNT_06 = timeline.films["palace-06"].count;

async function open(browser: Browser, opts: BrowserContextOptions, url: string, init?: () => void): Promise<Page> {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  if (init) await page.addInitScript(init);
  await page.goto(url);
  await expect(page.locator("html")).toHaveAttribute("data-reel-chrome", "film", { timeout: 15_000 });
  await page.waitForTimeout(800);
  return page;
}

const navBackdrop = (page: Page) =>
  page.locator("header.rl-nav").evaluate((el) => {
    const cs = getComputedStyle(el) as CSSStyleDeclaration & { webkitBackdropFilter?: string };
    return { backdrop: cs.backdropFilter || cs.webkitBackdropFilter || "none", filter: cs.filter };
  });

/** Document top and height of a film segment. */
const segBox = (page: Page, id: string) =>
  page.locator(`#${id}`).evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { top: r.top + window.scrollY, h: r.height };
  });

const scrollToY = async (page: Page, y: number) => {
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" as ScrollBehavior }), y);
  await page.waitForFunction((y) => Math.abs(window.scrollY - y) < 2, y, { timeout: 5000 });
};

/** scrollTo from a rAF loop at a fixed speed for `ms`. */
const steadyScroll = (page: Page, from: number, pxPerSec: number, ms: number) =>
  page.evaluate(
    ([from, speed, ms]) =>
      new Promise<void>((resolve) => {
        let t0 = 0;
        const step = (t: number) => {
          if (!t0) t0 = t;
          const e = t - t0;
          window.scrollTo(0, from + (e / 1000) * speed);
          if (e >= ms) resolve();
          else requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }),
    [from, pxPerSec, ms] as const,
  );

/** Elements under the film segments with a computed will-change. */
const willChangeHolders = (page: Page) =>
  page.evaluate(() => {
    const out: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>("[data-film-segment] *")) {
      const w = getComputedStyle(el).willChange;
      if (w && w !== "auto") out.push(`${el.tagName.toLowerCase()}.${[...el.classList].join(".")}: ${w}`);
    }
    return out;
  });

const hud = async (page: Page) => (await page.locator(".film-hud").textContent()) ?? "";

/** Expected HUD frame (1-based) of segment `seg` at the current scroll (pickActive, not the first segment). */
const expectedFrame = (page: Page, id: string, count: number) =>
  page.evaluate(
    ([id, count]) => {
      const r = document.getElementById(id)!.getBoundingClientRect();
      const vh = (document.querySelector(`#${id} [data-film-stage]`) as HTMLElement).getBoundingClientRect().height;
      const p = Math.min(1, Math.max(0, (vh - r.top) / r.height));
      return Math.round(p * (count - 1)) + 1;
    },
    [id, count] as const,
  );

const canvasLit = (page: Page) =>
  page.evaluate(() => {
    const c = document.querySelector("canvas") as HTMLCanvasElement;
    const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
    let lit = 0;
    for (let i = 0; i < d.length; i += 4 * 97) if ((d[i] ?? 0) + (d[i + 1] ?? 0) + (d[i + 2] ?? 0) > 120) lit++;
    return lit;
  });

const wrapperVisibility = (page: Page) => page.locator(".film-canvas").evaluate((el) => getComputedStyle(el).visibility);

test.describe("film layers", () => {
  test.skip(process.env.RUN_AUDIT !== "1", "opt-in: RUN_AUDIT=1");
  test.setTimeout(180_000);

  test("touch nav over the film has no backdrop-filter, every look", async ({ browser, browserName }) => {
    for (let look = 1; look <= 5; look++) {
      const page = await open(browser, PHONE, `/?nav=${look}`);
      const coarse = await page.evaluate((q) => window.matchMedia(q).matches, TOUCH_QUERY);
      const film = await navBackdrop(page);
      if (coarse) {
        expect(film.backdrop, `look ${look} over the film`).toBe("none");
        expect(film.filter, `look ${look} over the film`).toBe("none");
      } else {
        // Chromium reports a coarse, hover-less pointer for hasTouch+isMobile;
        // an engine that does not cannot exercise the touch rule, so there the
        // nav must keep today's blur (the rule must not leak to fine pointers).
        // The Pricing and desktop checks below still run.
        expect(browserName, `${TOUCH_QUERY} must match in the Chromium phone profile`).not.toBe("chromium");
        if (look === 1) {
          test.info().annotations.push({ type: "skipped", description: `${browserName}: ${TOUCH_QUERY} does not match; touch assertion skipped` });
        }
        expect(film.backdrop, `look ${look} over the film, fine pointer`).toMatch(NAV_BLUR);
      }
      // Over Pricing: the body chrome keeps today's glass.
      await page.locator("#pricing").evaluate((el) => el.scrollIntoView({ block: "start", behavior: "instant" }));
      await expect(page.locator("html")).toHaveAttribute("data-reel-chrome", "body");
      const body = await navBackdrop(page);
      expect(body.backdrop, `look ${look} over Pricing`).toMatch(NAV_BLUR);
      await page.context().close();
    }
    const desk = await open(browser, DESKTOP, "/");
    expect((await navBackdrop(desk)).backdrop, "desktop over the film").toMatch(NAV_BLUR);
    await desk.context().close();
  });

  test("no permanent layers at rest; in the Hall only the two walls", async ({ browser }) => {
    for (const opts of [DESKTOP, PHONE]) {
      const page = await open(browser, opts, "/?hud=1");
      await page.waitForTimeout(600);
      expect(await willChangeHolders(page), "hero at rest").toEqual([]);

      const vh = opts.viewport!.height;
      const city = await segBox(page, "library");
      await scrollToY(page, Math.ceil(city.top) + 2 + (city.h - vh) * 0.9);
      await page.waitForTimeout(900);
      expect(await willChangeHolders(page), "city at rest").toEqual([]);

      const hall = await segBox(page, "how-it-works");
      await scrollToY(page, Math.ceil(hall.top) + 2 + (hall.h - vh) * 0.5);
      await page.waitForTimeout(900);
      const inHall = await willChangeHolders(page);
      expect(inHall.length, inHall.join("\n")).toBeLessThanOrEqual(2);
      for (const w of inHall) expect(w).toMatch(/hall-wall/);
      await page.context().close();
    }
  });

  test("no layout reads in the scroll path", async ({ browser }) => {
    const page = await open(browser, DESKTOP, "/", () => {
      const w = window as unknown as { __gbcr: number };
      w.__gbcr = 0;
      const orig = Element.prototype.getBoundingClientRect;
      Element.prototype.getBoundingClientRect = function (this: Element) {
        w.__gbcr++;
        return orig.call(this);
      };
    });
    // Two chapters (Summary + Examples) in 3 s.
    const hall = await segBox(page, "how-it-works");
    const rooms = await segBox(page, "examples");
    const from = Math.ceil(hall.top) - 900;
    await scrollToY(page, from);
    await page.waitForTimeout(800);
    await page.evaluate(() => ((window as unknown as { __gbcr: number }).__gbcr = 0));
    await steadyScroll(page, from, (rooms.top + rooms.h - 900 - from) / 3, 3000);
    const calls = await page.evaluate(() => (window as unknown as { __gbcr: number }).__gbcr);
    console.log(`getBoundingClientRect calls in a 3 s steady scroll through two chapters: ${calls}`);
    expect(calls).toBeLessThanOrEqual(GBCR_MAX);
    await page.context().close();
  });

  test("the Hall writes only changed styles", async ({ browser }) => {
    const page = await open(browser, DESKTOP, "/");
    const hall = await segBox(page, "how-it-works");
    const from = Math.ceil(hall.top) - 900;
    await scrollToY(page, from);
    await page.waitForTimeout(800);
    await page.evaluate(() => {
      const w = window as unknown as { __styleWrites: number };
      w.__styleWrites = 0;
      new MutationObserver((m) => (w.__styleWrites += m.length)).observe(document.getElementById("how-it-works")!, {
        subtree: true,
        attributes: true,
        attributeFilter: ["style"],
      });
    });
    await steadyScroll(page, from, hall.h / 2, 2000);
    const writes = await page.evaluate(() => (window as unknown as { __styleWrites: number }).__styleWrites);
    console.log(`style-attribute mutations under the Hall in a 2 s steady scroll: ${writes}`);
    expect(writes).toBeLessThanOrEqual(HALL_STYLE_WRITES_MAX);
    await page.context().close();
  });

  test("one shared reduced-motion subscription", async ({ browser }) => {
    const page = await open(browser, DESKTOP, "/", () => {
      const w = window as unknown as { __rmListeners: number };
      w.__rmListeners = 0;
      const orig = window.matchMedia.bind(window);
      window.matchMedia = (q: string) => {
        const mql = orig(q);
        if (/prefers-reduced-motion:\s*reduce/.test(q)) {
          const add = mql.addEventListener.bind(mql);
          const remove = mql.removeEventListener.bind(mql);
          mql.addEventListener = ((type: string, fn: EventListenerOrEventListenerObject, o?: boolean | AddEventListenerOptions) => {
            if (type === "change") w.__rmListeners++;
            add(type, fn, o);
          }) as typeof mql.addEventListener;
          mql.removeEventListener = ((type: string, fn: EventListenerOrEventListenerObject, o?: boolean | EventListenerOptions) => {
            if (type === "change") w.__rmListeners--;
            remove(type, fn, o);
          }) as typeof mql.removeEventListener;
          const addL = mql.addListener.bind(mql);
          const removeL = mql.removeListener.bind(mql);
          mql.addListener = (fn) => {
            w.__rmListeners++;
            addL(fn);
          };
          mql.removeListener = (fn) => {
            w.__rmListeners--;
            removeL(fn);
          };
        }
        return mql;
      };
    });
    const n = await page.evaluate(() => (window as unknown as { __rmListeners: number }).__rmListeners);
    console.log(`'change' listeners on (prefers-reduced-motion: reduce) after load: ${n}`);
    expect(n).toBeLessThanOrEqual(2);
    await page.context().close();
  });

  test("the canvas is not composited under the body and returns with the right frame", async ({ browser }) => {
    const page = await open(browser, DESKTOP, "/?hud=1");
    const toPricing = async () => {
      await page.locator("#pricing").evaluate((el) => el.scrollIntoView({ block: "start", behavior: "instant" }));
      await expect(page.locator("html")).toHaveAttribute("data-reel-chrome", "body");
      await expect.poll(() => wrapperVisibility(page)).toBe("hidden");
    };
    const intoLastChapter = async (how: "wheel" | "jump") => {
      const home = await segBox(page, "home");
      const y = Math.ceil(home.top) + (home.h - 900) * 0.5;
      if (how === "jump") await scrollToY(page, y);
      else {
        // Wheel up like a visitor, then settle on the exact position.
        for (let i = 0; i < 40 && (await page.evaluate(() => window.scrollY)) > y + 400; i++) {
          await page.mouse.wheel(0, -400);
          await page.waitForTimeout(30);
        }
        await scrollToY(page, y);
      }
      await page.waitForTimeout(700);
      expect(await wrapperVisibility(page)).toBe("visible");
      await expect.poll(() => canvasLit(page), { timeout: 10_000 }).toBeGreaterThan(50);
      const want = await expectedFrame(page, "home", COUNT_06);
      const got = Number(/palace-06 · f(\d{4})/.exec(await hud(page))?.[1]);
      expect(Math.abs(got - want), `HUD f${got} vs scroll f${want}`).toBeLessThanOrEqual(1);
    };

    await toPricing();
    await intoLastChapter("wheel");

    // Reload at Pricing, then scroll up.
    await toPricing();
    await page.reload();
    await page.waitForTimeout(1200);
    const pricingTop = await page.locator("#pricing").evaluate((el) => el.getBoundingClientRect().top);
    if (Math.abs(pricingTop) > 4) {
      // The browser did not restore the scroll position: land on Pricing by its anchor.
      await page.goto("/?hud=1#pricing");
      await page.waitForTimeout(1200);
    }
    await expect(page.locator("html")).toHaveAttribute("data-reel-chrome", "body");
    await expect.poll(() => wrapperVisibility(page)).toBe("hidden");
    await intoLastChapter("wheel");

    // Anchor jump from Pricing into the middle of the reel: the wrapper is
    // visible by the first animation frame after the jump.
    await toPricing();
    const firstFrame = await page.evaluate(
      () =>
        new Promise<string>((resolve) => {
          location.hash = "#examples";
          requestAnimationFrame(() => resolve(getComputedStyle(document.querySelector(".film-canvas")!).visibility));
        }),
    );
    expect(firstFrame).toBe("visible");
    await page.waitForTimeout(700);
    await expect.poll(() => canvasLit(page), { timeout: 10_000 }).toBeGreaterThan(50);
    const want = await expectedFrame(page, "examples", COUNT_02);
    const got = Number(/palace-02 · f(\d{4})/.exec(await hud(page))?.[1]);
    expect(Math.abs(got - want), `HUD f${got} vs scroll f${want}`).toBeLessThanOrEqual(1);
    await page.context().close();
  });

  test("smoothing follows the input", async ({ browser, browserName }) => {
    // Wheel: 90 ms.
    const desk = await open(browser, DESKTOP, "/?hud=1");
    await desk.mouse.move(700, 450);
    for (let i = 0; i < 4; i++) {
      await desk.mouse.wheel(0, 240);
      await desk.waitForTimeout(60);
    }
    await expect(desk.locator(".film-hud")).toContainText("input wheel · smooth 90 ms");
    await desk.context().close();

    test.skip(browserName !== "chromium", "touch scroll is driven through CDP (Chromium only)");
    const touchScroll = async (page: Page, sample: boolean) => {
      const cdp = await page.context().newCDPSession(page);
      const pt = (y: number) => [{ x: 195, y }];
      if (sample)
        await page.evaluate(() => {
          const w = window as unknown as { __feel: string[] };
          w.__feel = [];
          const tick = () => {
            w.__feel.push(document.querySelector(".film-hud")?.textContent ?? "");
            if (w.__feel.length < 400) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        });
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: pt(700) });
      for (let y = 680; y >= 200; y -= 20) {
        await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: pt(y) });
        await page.waitForTimeout(16);
      }
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await page.waitForTimeout(500);
    };

    const phone = await open(browser, PHONE, "/?hud=1");
    await touchScroll(phone, false);
    expect(await phone.evaluate(() => window.scrollY), "the touch gesture scrolled").toBeGreaterThan(100);
    await expect(phone.locator(".film-hud")).toContainText("input touch · smooth 35 ms");
    await phone.context().close();

    // ?smooth=0: every frame the drawn frame is the target frame.
    const zero = await open(browser, PHONE, "/?hud=1&smooth=0");
    await touchScroll(zero, true);
    await expect(zero.locator(".film-hud")).toContainText("input touch · smooth 0 ms");
    const samples = await zero.evaluate(() => (window as unknown as { __feel: string[] }).__feel);
    let compared = 0;
    for (const s of samples) {
      const drawn = /palace-\d\d · f(\d{4})/.exec(s)?.[1];
      const want = /want f(\d{4})/.exec(s)?.[1];
      if (!drawn || !want || !/input touch/.test(s)) continue;
      compared++;
      expect(drawn, s).toBe(want);
    }
    expect(compared, "frames sampled under touch input").toBeGreaterThan(5);
    await zero.context().close();
  });
});

// Next only prefetches <Link>s in a production build, and only a production
// build runs the real sign-in redirect, so this gate runs in the @prod job
// (E2E_MODE=prod: `next build` + `next start`), not under RUN_AUDIT on the dev
// server, where it could never fail.
test.describe("film layers: prefetch (@prod)", () => {
  test("logged out: /books is public and prefetched with no CSP error; /book/library still redirects @prod", async ({ browser, request }) => {
    const ctx = await browser.newContext({ ...DESKTOP, ...(PROD_HEADERS ? { extraHTTPHeaders: PROD_HEADERS } : {}) });
    const page = await ctx.newPage();
    // The redirect target is the live site: never let a request reach it.
    await page.route(/^https:\/\/app\.chapterflow\.ca\//, (route) => route.abort());
    const books: string[] = [];
    const prefetches: string[] = [];
    const csp: string[] = [];
    page.on("request", (r) => {
      const u = new URL(r.url());
      const prefetch = u.searchParams.has("_rsc") || Boolean(r.headers()["next-router-prefetch"]);
      if (prefetch) prefetches.push(r.url());
      if (prefetch && (u.pathname === "/books" || u.pathname.startsWith("/books/"))) books.push(r.url());
    });
    page.on("console", (m) => {
      if (/Content[ -]Security[ -]Policy|Refused to connect/i.test(m.text())) csp.push(m.text());
    });
    await page.goto("/");
    await page.waitForTimeout(1000);
    // Step through the whole page so every link (the nav's, the City
    // chapter's, the footer's) enters the viewport and Next's viewport
    // prefetch can fire.
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y <= height; y += 600) {
      await page.evaluate((top) => window.scrollTo(0, top), y);
      await page.waitForTimeout(60);
    }
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(2000);
    // Sanity: prefetching is live in this build.
    expect(prefetches.length, "Next prefetches public links in this build").toBeGreaterThan(0);
    // /books is the public catalog: the nav and the City chapter prefetch it,
    // and that prefetch lands on the page, not in a sign-in redirect.
    expect(books.length, "the public /books is prefetched").toBeGreaterThan(0);
    // No prefetch goes into a sign-in redirect (a protected surface or an
    // /auth/ route), and nothing trips the CSP.
    const intoSignIn = prefetches.filter((u) => {
      const path = new URL(u).pathname;
      return path.startsWith("/auth/") || isProtectedSurfacePath(path);
    });
    expect(intoSignIn, intoSignIn.join("\n")).toEqual([]);
    expect(csp, csp.join("\n")).toEqual([]);
    await ctx.close();

    // Reachability, logged out: /books answers 200 itself (no redirect to
    // sign-in), with or without a query or a trailing slash; a protected
    // surface still redirects to sign-in.
    for (const path of ["/books", "/books?q=habit"]) {
      const res = await request.get(path, { maxRedirects: 0 });
      expect(res.status(), `${path} answers 200 logged out`).toBe(200);
    }
    const slash = await request.get("/books/", { maxRedirects: 0 });
    if (slash.status() >= 300 && slash.status() < 400) {
      expect(new URL(slash.headers()["location"]!, "http://127.0.0.1:3000").pathname, "/books/ normalises to /books").toBe("/books");
    } else {
      expect(slash.status()).toBe(200);
    }
    const gated = await request.get("/book/library", { maxRedirects: 0 });
    expect(gated.status(), "/book/library redirects logged out").toBeGreaterThanOrEqual(300);
    expect(gated.status()).toBeLessThan(400);
    expect(new URL(gated.headers()["location"]!, "http://127.0.0.1:3000").pathname).toBe("/auth/login");
  });
});
