import { test, expect, type APIRequestContext, type Browser, type BrowserContext, type BrowserContextOptions, type Page, type Route } from "@playwright/test";
import sharp from "sharp";
import { BOOK_REEL } from "../components/film/book-reel";
import { heroPoster } from "../components/film/first-paint";
import { FAILSAFE_MS } from "../components/film/readable-layout";
import { PORTRAIT_QUERY, pickVariant, viewBackingWidth, viewOrientation } from "../components/film/view";
import { PROD_E2E_HEADERS } from "../playwright.config";

/**
 * First paint and failure states (plan Phase 6).
 *
 * @prod (E2E_MODE=prod: `next build` + `next start`; they need the real
 * server response, production chunks and hydration timing):
 *   1. The response holds the hero <picture> (fetchpriority high) and one
 *      image preload per poster with the generated media (first-paint.ts).
 *   2. JavaScript disabled: the poster shows, no two lines of copy overlap,
 *      every chapter's copy reads in document order with no multi-screen gap.
 *   3. Hydration held back 2 s: before it, the poster and only the hero's
 *      first-frame pins show; after the canvas takes over, its picture
 *      matches the poster (band region mean abs difference ≤ 3, edges ±1 px)
 *      on a phone, a tablet and a desktop, and a phone held sideways
 *      (844 × 390, landscape poster).
 *   4. Scripts blocked: after the 8 s failsafe (readable-layout.ts) every pin
 *      is visible, no two overlap, no chapter keeps an empty multi-screen
 *      stage, and the footer is on top and clickable.
 *   5. Fonts: the landing preloads exactly the font files its first screen
 *      uses.
 *   6. The motion feature chunk loads when Pricing approaches, not at mount;
 *      a feature chunk that fails twice when the menu opens is retried and
 *      the menu still shows.
 *   Tests that need the poster to load skip without local film files (the CI
 *   prod job has none: public/films is gitignored).
 * RUN_AUDIT=1 (dev server, part of `npm run test:film`):
 *   7. One poster only, the film code's own variant, on six viewports
 *      (including a phone held sideways), and a phone window on a larger
 *      screen (the CI runner's case): where a canary shows the preload
 *      scanner sees a wider screen than the window, one speculative poster,
 *      the pick for that screen, is tolerated (scannerView).
 *   8. Every film request answered 404 (no film files): static mode (copy
 *      follows scroll, nothing hidden at the end), film requests stop, no
 *      probe, no page error.
 *   9. No 2D context: the same static-mode assertions.
 *   Phase 8: scripts load and the pins' effects run, but the reel never
 *      arms: after the failsafe every pin is visible at full opacity (the
 *      readable layout wins over the pins' inline styles).
 *  10. Recovery (Phase 6b), no reload in any of them, no page error:
 *      (a) every film request aborted for the first 6 s, then let through:
 *          the film appears (real frames drawn, data-film-static gone, the
 *          HUD on a frame) within 20 s of load;
 *      (b) the same with the context's offline switch: the film appears
 *          within 5 s of going online;
 *      (c) every film request aborted for 70 s: static mode, the request
 *          count within the bound, and after the halt nothing but probes,
 *          5 s, 15 s and 45 s after it.
 */

const PROD = process.env.E2E_MODE === "prod";
const AUDIT = process.env.RUN_AUDIT === "1";
const HEADERS = PROD ? { ...PROD_E2E_HEADERS } : undefined;

const PHONE: BrowserContextOptions = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true };
const TABLET: BrowserContextOptions = { viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const DESKTOP: BrowserContextOptions = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };
/** A phone held sideways (Phase 7): short landscape, the landscape frames. */
const SIDEWAYS: BrowserContextOptions = { viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true };

const HERO_FILM = BOOK_REEL[0]!;
const POSTER = heroPoster(HERO_FILM);

async function newContext(browser: Browser, opts: BrowserContextOptions): Promise<BrowserContext> {
  const ctx = await browser.newContext({ ...opts, ...(HEADERS ? { extraHTTPHeaders: HEADERS } : {}) });
  // Never let a request leave this machine (the live site rate-limits it).
  await ctx.route((url) => !/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(url.toString()), (route) => route.abort());
  return ctx;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Tests that need the poster to load skip when there are no film files on
 * this server (public/films is gitignored: the CI prod job has none) or the
 * film base is not local (newContext blocks every other host).
 */
async function requirePosters(request: APIRequestContext) {
  const url = POSTER.img.poster;
  if (!url.startsWith("/")) {
    test.skip(true, `film base is not local (${url}); run with frames in public/films`);
    return;
  }
  const r = await request.get(url, HEADERS ? { headers: HEADERS } : {});
  test.skip(r.status() !== 200, "no film frames encoded (run scripts/film/placeholder.mjs)");
}

/**
 * Pairs of visible lines of copy (visibility visible, opacity ≥ 0.6, not one
 * inside the other) whose boxes overlap by more than 1 px, within `segs`.
 */
const overlappingPins = (page: Page, segs: string[] | null) =>
  page.evaluate((segs) => {
    const pins = [...document.querySelectorAll<HTMLElement>("[data-film-reel] [data-frame-pin]")].filter((el) => {
      if (segs && !segs.includes(el.closest("[data-film-segment]")?.id ?? "")) return false;
      let o = 1;
      for (let e: HTMLElement | null = el; e; e = e.parentElement) o *= Number(getComputedStyle(e).opacity);
      const r = el.getBoundingClientRect();
      return getComputedStyle(el).visibility === "visible" && o >= 0.6 && r.width > 0 && r.height > 0;
    });
    const out: string[] = [];
    for (let i = 0; i < pins.length; i++)
      for (let j = i + 1; j < pins.length; j++) {
        const [a, b] = [pins[i]!, pins[j]!];
        if (a.contains(b) || b.contains(a)) continue;
        const [ra, rb] = [a.getBoundingClientRect(), b.getBoundingClientRect()];
        if (ra.left < rb.right - 1 && rb.left < ra.right - 1 && ra.top < rb.bottom - 1 && rb.top < ra.bottom - 1)
          out.push(`"${(a.textContent ?? "").trim().slice(0, 30)}" / "${(b.textContent ?? "").trim().slice(0, 30)}"`);
      }
    return out;
  }, segs);

/** Scroll the footer's first link to mid-screen; "ok" when it is the topmost element there. */
async function footerHit(page: Page): Promise<string> {
  await page.evaluate(() =>
    document.querySelector(".rl-public-footer a[href]")?.scrollIntoView({ block: "center", behavior: "instant" as ScrollBehavior }),
  );
  await page.waitForTimeout(200);
  return page.evaluate(() => {
    const link = document.querySelector<HTMLAnchorElement>(".rl-public-footer a[href]");
    if (!link) return "no footer link";
    const r = link.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return top && link.contains(top) ? "ok" : `covered by ${top?.tagName}.${String(top?.className)}`;
  });
}

/** No chapter is taller than a screen and a half plus its copy (no empty multi-screen stage). */
async function expectNoEmptyStages(page: Page, vh: number) {
  const pins = await reelPins(page);
  const segs = await page.evaluate(() => [...document.querySelectorAll("[data-film-segment]")].map((s) => ({ id: s.id, h: s.getBoundingClientRect().height })));
  for (const s of segs) {
    const copy = pins.filter((p) => p.seg === s.id);
    const span = copy.length ? Math.max(...copy.map((p) => p.bottom)) - Math.min(...copy.map((p) => p.top)) : 0;
    expect(s.h, `${s.id} height`).toBeLessThan(span + 1.5 * vh);
  }
}
const CHUNK_JS = /\/_next\/static\/chunks\/[^?#]*\.js(\?|#|$)/;

/** Copy of every chapter, in document order: text, box, visibility, opacity. */
const reelPins = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("[data-film-reel] [data-frame-pin]")].map((el) => {
      const r = el.getBoundingClientRect();
      let o = 1;
      for (let e: HTMLElement | null = el; e; e = e.parentElement) o *= Number(getComputedStyle(e).opacity);
      return {
        text: (el.textContent ?? "").trim().slice(0, 40),
        seg: el.closest("[data-film-segment]")?.id ?? "?",
        later: el.hasAttribute("data-frame-later"),
        top: r.top + window.scrollY,
        bottom: r.bottom + window.scrollY,
        x: r.left,
        y: r.top,
        w: r.width,
        h: r.height,
        visibility: getComputedStyle(el).visibility,
        opacity: o,
      };
    }),
  );

/** Hide everything but the picture (copy, nav) for a screenshot; !important beats the pins' inline styles. */
const HIDE_OVERLAYS =
  "[data-film-reel] *, header, header *, .rl-nav, .rl-nav-scrim, .film-hud { visibility: hidden !important; }";

/** Screenshot in CSS px as raw RGB. */
async function shot(page: Page) {
  const png = await page.screenshot({ scale: "css" });
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}

type Region = { x0: number; y0: number; x1: number; y1: number };

/** Mean absolute difference (0–255, all channels) inside the region. */
function meanAbsDiff(a: { data: Buffer; w: number }, b: { data: Buffer; w: number }, r: Region): number {
  let sum = 0;
  let n = 0;
  for (let y = r.y0; y < r.y1; y++)
    for (let x = r.x0; x < r.x1; x++) {
      const i = (y * a.w + x) * 3;
      for (let c = 0; c < 3; c++) sum += Math.abs((a.data[i + c] ?? 0) - (b.data[i + c] ?? 0));
      n += 3;
    }
  return n ? sum / n : 0;
}

/** First and last row inside the region whose mean differs from the page colour (#06070A) by more than 6. */
function contentEdges(img: { data: Buffer; w: number }, r: Region): { top: number; bottom: number } {
  const bg = [6, 7, 10];
  let top = -1;
  let bottom = -1;
  for (let y = r.y0; y < r.y1; y++) {
    let s = 0;
    for (let x = r.x0; x < r.x1; x++) {
      const i = (y * img.w + x) * 3;
      for (let c = 0; c < 3; c++) s += Math.abs((img.data[i + c] ?? 0) - bg[c]!);
    }
    if (s / ((r.x1 - r.x0) * 3) > 6) {
      if (top < 0) top = y;
      bottom = y;
    }
  }
  return { top, bottom };
}

/** Scroll so `id`'s chapter sits at progress `p` (pickActive's rule; stage = 100svh). */
async function scrollToProgress(page: Page, id: string, p: number) {
  await page.evaluate(
    ([id, p]) => {
      const seg = document.getElementById(id as string)!;
      const segs = [...document.querySelectorAll("[data-film-segment]")];
      const first = segs[0] === seg;
      const stage = seg.querySelector("[data-film-stage]")!.getBoundingClientRect().height;
      const top = seg.getBoundingClientRect().top + window.scrollY;
      const h = seg.getBoundingClientRect().height;
      const y = first ? top + (p as number) * (h - stage) : top - stage + (p as number) * h;
      window.scrollTo({ top: y, behavior: "instant" as ScrollBehavior });
    },
    [id, p] as const,
  );
  await page.waitForTimeout(250);
}

/** Static mode holds: each chapter's copy shows in turn while scrolling; nothing is hidden at the end. */
async function expectCopyFollowsScroll(page: Page) {
  const ids = await page.evaluate(() => [...document.querySelectorAll("[data-film-segment]")].map((s) => s.id));
  expect(ids.length).toBe(7);
  for (const id of ids) {
    await scrollToProgress(page, id, 0.5);
    const shown = (await reelPins(page)).filter((p) => p.seg === id && p.visibility === "visible" && p.opacity > 0.9 && p.y < 2000 && p.y + p.h > 0);
    expect(shown.length, `${id}: copy on screen mid-chapter`).toBeGreaterThan(0);
  }
  // The reel's end: the last chapter's held copy is up.
  await scrollToProgress(page, ids.at(-1)!, 1);
  const end = (await reelPins(page)).filter((p) => p.seg === ids.at(-1) && p.visibility === "visible" && p.opacity > 0.9);
  expect(end.map((p) => p.text).join(" | ")).toMatch(/Finish the book/);
  // And the body after it.
  for (const sel of ["#request", "#faq", "#pricing"]) {
    await page.locator(sel).scrollIntoViewIfNeeded();
    await expect(page.locator(sel)).toBeVisible();
  }
}

// ────────────────────────────── @prod ──────────────────────────────

test.describe("film first paint (@prod)", () => {
  test.skip(!PROD, "runs in the E2E_MODE=prod job (next build + next start)");

  test("the response holds the hero <picture> with fetchpriority high and one matching preload per poster @prod", async ({ request }) => {
    const res = await request.get("/", HEADERS ? { headers: HEADERS } : {});
    expect(res.status()).toBe(200);
    const html = await res.text();
    const block = /<div[^>]*data-film-poster[^>]*>\s*<picture>([\s\S]*?)<\/picture>/.exec(html)?.[1];
    expect(block, "the poster <picture> is in the server HTML").toBeTruthy();
    const sources = [...block!.matchAll(/<source media="([^"]*)" srcSet="([^"]*)"\/?>/g)].map((m) => ({ media: m[1], src: m[2] }));
    expect(sources).toEqual(POSTER.sources.map((s) => ({ media: s.media, src: s.src })));
    const img = /<img ([^>]*)>/.exec(block!)?.[1] ?? "";
    expect(img).toContain(`src="${POSTER.img.poster}"`);
    expect(img).toMatch(/fetchPriority="high"/i);
    expect(img).not.toMatch(/loading="lazy"/);

    // The preloads: React sends high-priority image preloads in the Link
    // header when they fit (earliest: before the first byte of HTML), else
    // as <link> in <head>. Either way, each poster exactly once, with the
    // generated media and high priority.
    const found: Array<{ href: string; media: string; high: boolean }> = [];
    for (const part of (res.headers()["link"] ?? "").split(/,\s*(?=<)/)) {
      const href = /^<([^>]+)>/.exec(part)?.[1];
      if (!href || !/rel=preload/.test(part) || !/as="?image"?/.test(part)) continue;
      found.push({ href, media: /media="([^"]*)"/.exec(part)?.[1] ?? "", high: /fetchpriority="?high"?/i.test(part) });
    }
    const head = html.slice(0, html.indexOf("</head>"));
    for (const m of head.matchAll(/<link [^>]*rel="preload"[^>]*>/g)) {
      if (!/as="image"/.test(m[0])) continue;
      found.push({
        href: /href="([^"]*)"/.exec(m[0])?.[1] ?? /imageSrcSet="([^"]*)"/i.exec(m[0])?.[1] ?? "",
        media: /media="([^"]*)"/.exec(m[0])?.[1] ?? "",
        high: /fetchPriority="high"/i.test(m[0]),
      });
    }
    expect(found.map(({ href, media }) => ({ href, media })).sort((a, b) => a.href.localeCompare(b.href))).toEqual(
      [...POSTER.preloads].sort((a, b) => a.href.localeCompare(b.href)),
    );
    expect(found.every((f) => f.high), "every poster preload is high priority").toBe(true);
    // No preload in the body (it would start late).
    expect(html.slice(html.indexOf("</head>"))).not.toMatch(/<link [^>]*as="image"/);
  });

  for (const [name, vp] of [
    ["phone", PHONE],
    ["desktop", DESKTOP],
  ] as const) {
    test(`JavaScript disabled (${name}): poster visible, hero copy apart, every chapter readable in order @prod`, async ({ browser, request }) => {
      await requirePosters(request);
      const ctx = await newContext(browser, { ...vp, javaScriptEnabled: false });
      const page = await ctx.newPage();
      await page.goto("/");
      await page.waitForLoadState("load");
      const vh = vp.viewport!.height;
      const poster = await page.locator("[data-film-poster] img").evaluate((el) => {
        const img = el as HTMLImageElement;
        const r = img.getBoundingClientRect();
        return {
          loaded: img.complete && img.naturalWidth > 0,
          shown: getComputedStyle(img.closest("[data-film-poster]")!).display !== "none" && getComputedStyle(img).visibility === "visible",
          onScreen: r.bottom > 0 && r.top < window.innerHeight && r.width > 0,
        };
      });
      expect(poster).toEqual({ loaded: true, shown: true, onScreen: true });

      const pins = await reelPins(page);
      expect(pins.length).toBeGreaterThan(20);
      // Opacity ≥ 0.6: the design's own label (0.72) and lede (0.88) opacities pass.
      const hidden = pins.filter((p) => p.visibility !== "visible" || p.opacity < 0.6 || p.w === 0 || p.h === 0);
      expect(hidden.map((p) => p.text), "every pin readable").toEqual([]);
      // No two visible text blocks overlap: the hero's, nor any chapter's
      // (a stage grid puts all its children in one cell unless the readable
      // layout turns it into a column).
      expect(await overlappingPins(page, ["hero"]), "hero overlap").toEqual([]);
      expect(await overlappingPins(page, null), "overlap anywhere in the reel").toEqual([]);
      // Reading order, and no empty multi-screen stretch between lines.
      for (let i = 1; i < pins.length; i++) {
        const a = pins[i - 1]!;
        const b = pins[i]!;
        expect(b.top, `"${b.text}" after "${a.text}"`).toBeGreaterThanOrEqual(a.top - 1);
        expect(b.top - a.bottom, `gap before "${b.text}"`).toBeLessThan(vh);
      }
      // No chapter is taller than a screen and its copy.
      await expectNoEmptyStages(page, vh);
      await ctx.close();
    });
  }

  for (const [name, vp, url] of [
    ["390x844 DPR 3", PHONE, "/"],
    ["820x1180 DPR 2", TABLET, "/"],
    ["1440x900 DPR 1", DESKTOP, "/"],
    // A phone held sideways: the landscape poster.
    ["844x390 DPR 3", SIDEWAYS, "/"],
  ] as const) {
    test(`hydration held back 2 s (${name}): poster and opening copy first, then the canvas takes over in place @prod`, async ({ browser, request }) => {
      test.setTimeout(120_000);
      await requirePosters(request);
      const ctx = await newContext(browser, vp);
      await ctx.route(CHUNK_JS, async (route) => {
        await sleep(2000);
        await route.continue().catch(() => {});
      });
      const page = await ctx.newPage();
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(url, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(
        () => {
          const img = document.querySelector<HTMLImageElement>("[data-film-poster] img");
          return !!img && img.complete && img.naturalWidth > 0;
        },
        null,
        { timeout: 30_000 },
      );
      await page.waitForTimeout(150);
      // Still before hydration: nothing has armed the reel.
      expect(await page.locator("[data-film-reel]").getAttribute("data-film-armed")).toBeNull();
      const pins = await reelPins(page);
      const hero = pins.filter((p) => p.seg === "hero");
      expect(hero.filter((p) => !p.later).length).toBeGreaterThanOrEqual(4);
      for (const p of hero) expect(p.visibility, `hero "${p.text}" (later: ${p.later})`).toBe(p.later ? "hidden" : "visible");
      for (const p of pins.filter((p) => p.later)) expect(p.visibility, `later "${p.text}"`).toBe("hidden");

      await page.addStyleTag({ content: HIDE_OVERLAYS });
      await page.waitForTimeout(100);
      const box = await page.locator("[data-film-poster] img").evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { x0: Math.max(0, Math.ceil(r.left)), y0: Math.max(0, Math.ceil(r.top)), x1: Math.min(window.innerWidth, Math.floor(r.right)), y1: Math.min(window.innerHeight, Math.floor(r.bottom)) };
      });
      const before = await shot(page);
      expect(await page.locator("[data-film-reel]").getAttribute("data-film-armed"), "the screenshot is from before hydration").toBeNull();

      // Takeover: the canvas paints, the HTML poster goes.
      await page.waitForFunction(() => getComputedStyle(document.querySelector("[data-film-poster]")!).display === "none", null, { timeout: 60_000 });
      const after = await shot(page);
      const drew = await page.evaluate(() => {
        const s = (window as unknown as { __filmStats?: { exactDraws: number; fallbackDraws: number } }).__filmStats;
        return s ? s.exactDraws + s.fallbackDraws : 0;
      });
      expect(drew, "the canvas drew a picture").toBeGreaterThan(0);
      const region = { x0: box.x0 + 1, y0: box.y0 + 1, x1: box.x1 - 1, y1: box.y1 - 1 };
      expect(region.y1 - region.y0).toBeGreaterThan(100);
      const mad = meanAbsDiff(before, after, region);
      const eb = contentEdges(before, region);
      const ea = contentEdges(after, region);
      console.log(`${name}: band ${JSON.stringify(region)} mean abs diff ${mad.toFixed(2)}, edges before ${JSON.stringify(eb)} after ${JSON.stringify(ea)}`);
      expect(mad).toBeLessThanOrEqual(3);
      expect(eb.top).toBeGreaterThanOrEqual(0);
      expect(Math.abs(ea.top - eb.top)).toBeLessThanOrEqual(1);
      expect(Math.abs(ea.bottom - eb.bottom)).toBeLessThanOrEqual(1);
      expect(errors).toEqual([]);
      await ctx.close();
    });
  }

  test("scripts blocked entirely: after the failsafe the page is readable, with its footer on top @prod", async ({ browser }) => {
    test.setTimeout(90_000);
    const ctx = await newContext(browser, PHONE);
    await ctx.route(CHUNK_JS, (route) => route.abort());
    const page = await ctx.newPage();
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const t0 = Date.now();
    await page.waitForTimeout(500);
    const early = await reelPins(page);
    expect(early.filter((p) => p.later).every((p) => p.visibility === "hidden"), "later copy hidden before the failsafe").toBe(true);
    // Before the failsafe too (a slow phone scrolled to the end): the fixed
    // poster layer never covers the footer.
    expect(await footerHit(page), "footer before the failsafe").toBe("ok");
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior }));
    expect(Date.now() - t0, "still before the failsafe").toBeLessThan(FAILSAFE_MS - 1000);
    await page.waitForTimeout(Math.max(0, FAILSAFE_MS + 600 - (Date.now() - t0)));
    const pins = await reelPins(page);
    expect(pins.filter((p) => p.visibility !== "visible").map((p) => p.text)).toEqual([]);
    // Readable, not the film's stacked stages with every line on at once:
    // copy in reading order, no overlap, no empty multi-screen stage.
    expect(await overlappingPins(page, null), "overlap after the failsafe").toEqual([]);
    for (let i = 1; i < pins.length; i++) expect(pins[i]!.top, `"${pins[i]!.text}" after "${pins[i - 1]!.text}"`).toBeGreaterThanOrEqual(pins[i - 1]!.top - 1);
    await expectNoEmptyStages(page, PHONE.viewport!.height);
    // The Hall's wall prose is decoration laid over its stage (aria-hidden):
    // it stays out of the readable page, as with no script.
    expect(await page.locator(".hall-text").evaluate((el) => getComputedStyle(el).visibility)).toBe("hidden");
    // The footer at the end is on top of the poster layer and clickable.
    expect(await footerHit(page), "footer after the failsafe").toBe("ok");
    await ctx.close();
  });

  for (const [name, vp] of [
    ["desktop", DESKTOP],
    ["phone", PHONE],
    // The CI case: headless Linux reports a 1280x720 screen behind the
    // emulated phone viewport (on macOS the emulated screen is the viewport).
    ["phone window on a larger screen", { ...PHONE, screen: { width: 1280, height: 720 } }],
  ] as const) {
    test(`fonts (${name}): every preloaded font is used by the first screen, every font it uses is preloaded @prod`, async ({ browser }) => {
      const ctx = await newContext(browser, vp);
      const page = await ctx.newPage();
      const fonts: string[] = [];
      const warnings: string[] = [];
      page.on("request", (r) => {
        if (r.resourceType() === "font") fonts.push(new URL(r.url()).pathname);
      });
      // Unused FONT preloads only. Chromium's preload scanner resolves the
      // viewport meta against the screen size, not the window: where the two
      // differ it also starts the poster preload for the screen's size and
      // reports that one unused. That is the poster's business (the
      // one-poster test, and "Known limits" in docs/FILM_REEL.md), not a
      // font fault.
      page.on("console", (m) => {
        const text = m.text();
        if (/preloaded using link preload but not used/i.test(text) && /\.woff2?\b/i.test(text)) warnings.push(text);
      });
      const res = await page.goto("/");
      const link = (await res?.allHeaders())?.["link"] ?? "";
      await page.waitForTimeout(4000);
      const preloaded = new Set<string>();
      for (const part of link.split(/,\s*(?=<)/)) if (/as="?font"?/.test(part)) preloaded.add(new URL(/^<([^>]+)>/.exec(part)![1]!, "http://x").pathname);
      for (const href of await page.evaluate(() => [...document.querySelectorAll<HTMLLinkElement>('link[rel="preload"][as="font"]')].map((l) => l.href)))
        preloaded.add(new URL(href).pathname);
      expect(preloaded.size).toBeGreaterThan(0);
      expect([...new Set(fonts)].sort(), "fonts fetched for the first screen = fonts preloaded").toEqual([...preloaded].sort());
      expect(warnings).toEqual([]);
      // Each family, weight and style the first screen draws has a loaded
      // face (the fetches above are all preloads, so it came from one).
      const used = await page.evaluate(() => {
        const faces = [...document.fonts].filter((f) => f.status === "loaded");
        const covers = (family: string, weight: number, style: string) =>
          faces.some((f) => {
            if (f.family.replace(/["']/g, "") !== family || f.style !== style) return false;
            const [lo, hi = lo] = f.weight.split(" ").map(Number) as [number, number?];
            // A 600 drawn from the 700 face is how CSS font matching resolves it.
            return weight >= lo! - 100 && weight <= (hi ?? lo!) + 100;
          });
        const out = new Map<string, boolean>();
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          if (!n.textContent?.trim() || !n.parentElement) continue;
          const range = document.createRange();
          range.selectNodeContents(n);
          const r = range.getBoundingClientRect();
          if (!r.width || r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth) continue;
          const cs = getComputedStyle(n.parentElement);
          if (cs.visibility !== "visible") continue;
          const family = cs.fontFamily.split(",")[0]!.trim().replace(/["']/g, "");
          // The fallback stacks (Arial) are never fetched.
          if (/Fallback$|^(Arial|system-ui|sans-serif|serif|monospace)$/.test(family)) continue;
          out.set(`${family} ${cs.fontWeight} ${cs.fontStyle}`, covers(family, Number(cs.fontWeight), cs.fontStyle));
        }
        return [...out].map(([f, loaded]) => ({ f, loaded }));
      });
      expect(used.length).toBeGreaterThan(2);
      expect(used.filter((u) => !u.loaded).map((u) => u.f)).toEqual([]);
      await ctx.close();
    });
  }

  test("the motion feature chunk is not loaded at mount, only when Pricing approaches @prod", async ({ browser }) => {
    test.setTimeout(90_000);
    const ctx = await newContext(browser, DESKTOP);
    const page = await ctx.newPage();
    const scripts: Array<{ t: number; url: string }> = [];
    page.on("request", (r) => {
      if (r.resourceType() === "script") scripts.push({ t: Date.now(), url: r.url() });
    });
    await page.goto("/");
    await expect(page.locator("[data-film-reel]")).toHaveAttribute("data-film-armed", "");
    await page.waitForTimeout(4000);
    const idle = scripts.length;
    // Through the reel, not yet near Pricing: nothing new.
    for (const id of ["how-it-works", "quiz", "library", "home"]) await scrollToProgress(page, id, 0.5);
    await page.waitForTimeout(1500);
    expect(scripts.slice(idle).map((s) => s.url), "no script while Pricing is far").toEqual([]);
    // Pricing within 1.5 viewports below the screen: the features load.
    await page.evaluate(() => {
      const top = document.querySelector("#pricing")!.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: top - window.innerHeight * 2.2, behavior: "instant" as ScrollBehavior });
    });
    await expect.poll(() => scripts.length - idle, { timeout: 10_000 }).toBeGreaterThan(0);
    // The billing toggle's pill is drawn once Pricing is on screen.
    await page.locator("#pricing").scrollIntoViewIfNeeded();
    const pill = page.locator('#pricing [role="radiogroup"] [aria-checked="true"] > div').first();
    await expect.poll(() => pill.evaluate((el) => Number(getComputedStyle(el).opacity)), { timeout: 5000 }).toBeGreaterThan(0.99);
    await ctx.close();
  });

  test("a motion feature chunk that fails when the menu opens is retried: the menu still shows @prod", async ({ browser }) => {
    test.setTimeout(90_000);
    const ctx = await newContext(browser, PHONE);
    // Every script chunk the page did not load at mount fails twice (the
    // bundler's own retry included), as on a phone that lost its signal.
    let armed = false;
    const tries = new Map<string, number>();
    await ctx.route(CHUNK_JS, async (route) => {
      const url = route.request().url();
      const n = (tries.get(url) ?? 0) + 1;
      tries.set(url, n);
      if (armed && n <= 2) return route.abort("internetdisconnected");
      return route.continue();
    });
    const page = await ctx.newPage();
    const problems: string[] = [];
    page.on("pageerror", (e) => problems.push(e.message));
    await page.goto("/");
    await expect(page.locator("[data-film-reel]")).toHaveAttribute("data-film-armed", "");
    await page.waitForTimeout(3000);
    const atMount = new Set(tries.keys());
    armed = true;
    for (const u of atMount) tries.set(u, 3);
    await page.getByRole("button", { name: "Open navigation menu" }).tap();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toHaveCount(1);
    await expect
      .poll(
        () =>
          dialog.evaluate((el) => {
            let o = 1;
            for (let e: Element | null = el; e; e = e.parentElement) o *= Number(getComputedStyle(e).opacity);
            return o;
          }),
        { timeout: 20_000 },
      )
      .toBeGreaterThan(0.99);
    const failedTwice = [...tries].filter(([u, n]) => !atMount.has(u) && n >= 3).map(([u]) => u);
    expect(failedTwice.length, "a new chunk failed twice and then loaded").toBeGreaterThan(0);
    expect(problems).toEqual([]);
    await ctx.close();
  });
});

// ──────────────────────────── RUN_AUDIT ────────────────────────────

/** Static mode's request bound (Phase 6): 7 posters, the first pack's 4 tries, 3 tries for each of under 49 frames. */
const STATIC_BOUND = 7 + 4 + 3 * 49;

type Counters = { exactDraws: number; fallbackDraws: number; drawAt: number; probes: number; recoveries: number; framesFailed: number };
const filmStats = (page: Page) =>
  page.evaluate(() => {
    const s = (window as unknown as { __filmStats?: Counters }).__filmStats;
    return { exactDraws: s?.exactDraws ?? 0, fallbackDraws: s?.fallbackDraws ?? 0, drawAt: s?.drawAt ?? -1, probes: s?.probes ?? 0, recoveries: s?.recoveries ?? 0, framesFailed: s?.framesFailed ?? 0 };
  });

/**
 * Init script: record when the reel goes static (window.__staticAt, wall
 * clock) and the page's request counters at that moment (__staticStarted:
 * frame fetches + pack requests started).
 */
function markStatic() {
  new MutationObserver(() => {
    const w = window as unknown as { __staticAt?: number; __staticStarted?: number; __filmStats?: { fetches: number; packRequests: number } };
    if (w.__staticAt === undefined && document.querySelector("[data-film-reel][data-film-static]")) {
      w.__staticAt = Date.now();
      w.__staticStarted = (w.__filmStats?.fetches ?? 0) + (w.__filmStats?.packRequests ?? 0);
    }
  }).observe(document, { subtree: true, attributes: true, attributeFilter: ["data-film-static"] });
}

/** Uncaught page errors and unhandled rejections reported on the console. */
function watchProblems(page: Page): string[] {
  const problems: string[] = [];
  page.on("pageerror", (e) => problems.push(`uncaught: ${e.message}`));
  page.on("console", (m) => {
    if (/Uncaught|Unhandled/i.test(m.text())) problems.push(`${m.type()}: ${m.text()}`);
  });
  return problems;
}

/** Main-frame document loads (a reload would make it 2). */
function countLoads(page: Page): () => number {
  let n = 0;
  page.on("load", () => n++);
  return () => n;
}

/**
 * Wait (until `deadline`, wall clock) for the film: the canvas has drawn a
 * real frame (drawAt ≥ 0), the HTML poster is gone, the reel is not static
 * and the HUD names a film frame. Returns when that first held.
 */
async function waitForFilm(page: Page, deadline: number): Promise<number> {
  for (;;) {
    const state = await page.evaluate(() => {
      const s = (window as unknown as { __filmStats?: { exactDraws: number; drawAt: number } }).__filmStats;
      const reel = document.querySelector("[data-film-reel]");
      const poster = document.querySelector("[data-film-poster]");
      const hud = document.querySelector(".film-hud")?.textContent ?? "";
      return {
        drew: !!s && s.exactDraws > 0 && s.drawAt >= 0,
        staticMode: !!reel?.hasAttribute("data-film-static"),
        posterGone: !poster || getComputedStyle(poster).display === "none",
        hud,
      };
    });
    const ok = state.drew && !state.staticMode && state.posterGone && /palace-0\d[^ ]* · f\d{4}/.test(state.hud);
    if (ok) return Date.now();
    if (Date.now() > deadline) throw new Error(`the film did not appear in time: ${JSON.stringify(state)}`);
    await page.waitForTimeout(100);
  }
}

/** The film's variant name in a poster URL (/films/<name>/poster.webp). */
const posterName = (url: string) => /\/films\/(palace-0\d(?:-b\d+)?)\/poster\.webp/.exec(url)?.[1] ?? null;

/**
 * What Chromium's HTML preload scanner sees in this context, measured, not
 * guessed: no platform sniffing, no screen object. The scanner resolves the
 * viewport meta's width=device-width against the SCREEN, not the window, so
 * where a phone window sits on a larger screen (headless Linux: 1280x720
 * behind every emulated phone) it evaluates <link rel=preload media> for
 * that screen and starts a speculative poster; the real document then loads
 * the right one. Real phones have screen = window.
 *
 * A canary document, served by a route inside this context, carries the same
 * viewport meta as the landing and three kinds of image preload, each to a
 * routed canary URL:
 *   - control (no media): must be requested, or the canary proves nothing;
 *   - wider: media matching only viewports clearly wider than the window
 *     (≥ 1.25 × its width). The document itself never matches it, so a
 *     request can only come from the scanner seeing a wider screen;
 *   - one per hero poster preload, with the landing's own media (first-
 *     paint.ts): the document requests the window's pick, and the scanner
 *     the pick for the screen it sees.
 * Returns whether the scanner sees a wider screen, and every poster the
 * replica picked (by variant name, in request order).
 */
async function scannerView(ctx: BrowserContext, windowWidth: number): Promise<{ widerScreen: boolean; picks: string[] }> {
  const token = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const base = `/__film-canary/${token}`;
  const seen: string[] = [];
  const pattern = new RegExp(`/__film-canary/${token}/`);
  const handler = (route: Route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === `${base}/`) {
      const attr = (v: string) => v.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
      const links = [
        `<link rel="preload" as="image" href="${base}/control.gif">`,
        `<link rel="preload" as="image" href="${base}/wider.gif" media="(min-width: ${Math.ceil(windowWidth * 1.25)}px)">`,
        ...POSTER.preloads.map((p) => `<link rel="preload" as="image" href="${base}/pick/${posterName(p.href)}.gif" media="${attr(p.media)}">`),
      ];
      return route.fulfill({
        status: 200,
        contentType: "text/html; charset=utf-8",
        body: `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">${links.join("")}</head><body></body></html>`,
      });
    }
    seen.push(path.slice(base.length + 1));
    // A 1x1 transparent GIF.
    return route.fulfill({ status: 200, contentType: "image/gif", body: Buffer.from("R0lGODlhAQABAAAAACH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64") });
  };
  await ctx.route(pattern, handler);
  const page = await ctx.newPage();
  try {
    await page.goto(`${base}/`, { waitUntil: "load" });
    await expect.poll(() => seen.includes("control.gif"), { message: "the canary's control preload was requested", timeout: 5_000 }).toBe(true);
    await page.waitForTimeout(300);
  } finally {
    await page.close();
    await ctx.unroute(pattern, handler);
  }
  const picks = [...new Set(seen.filter((s) => s.startsWith("pick/")).map((s) => s.slice("pick/".length, -".gif".length)))];
  return { widerScreen: seen.includes("wider.gif"), picks };
}

test.describe("film first paint (audit)", () => {
  test.skip(!AUDIT, "opt-in: RUN_AUDIT=1");

  // Phase 8 (carried over from the Phase 6 review): the film code loads and
  // the pins' effects run (inline opacity 0 on every pin that is off), but
  // the reel never arms. The readable layout must win over those inline
  // styles: every pin shows, fully, after the failsafe.
  test("scripts load but the reel never arms: after the failsafe every pin is fully visible over its inline styles", async ({ browser }) => {
    test.setTimeout(90_000);
    const ctx = await newContext(browser, PHONE);
    // Arming prevented: the attribute is taken off as soon as it is set
    // (a MutationObserver callback runs before the next style recalc).
    await ctx.addInitScript(() => {
      new MutationObserver((records) => {
        for (const r of records) if (r.target instanceof Element && r.target.hasAttribute("data-film-armed")) r.target.removeAttribute("data-film-armed");
      }).observe(document, { subtree: true, attributes: true, attributeFilter: ["data-film-armed"] });
    });
    const page = await ctx.newPage();
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const t0 = Date.now();
    // The effects ran: later pins carry an inline opacity of 0.
    await page.waitForFunction(() => [...document.querySelectorAll<HTMLElement>("[data-frame-later][data-frame-pin]")].some((el) => el.style.opacity === "0"));
    expect(await page.locator("[data-film-reel][data-film-armed]").count(), "the reel is not armed").toBe(0);
    expect(Date.now() - t0, "still before the failsafe").toBeLessThan(FAILSAFE_MS - 1000);
    await page.waitForTimeout(Math.max(0, FAILSAFE_MS + 600 - (Date.now() - t0)));
    // Scroll through the page: the loop keeps writing pins as it goes.
    const end = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < end; y += 600) {
      await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" as ScrollBehavior }), y);
      await page.waitForTimeout(60);
    }
    const pins = await reelPins(page);
    const inline = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>("[data-frame-pin]")].filter((el) => el.style.opacity === "0").length);
    expect(inline, "pins with inline opacity 0 (the case is reproduced)").toBeGreaterThan(0);
    expect(pins.filter((p) => p.visibility !== "visible" || p.opacity < 0.99).map((p) => `${p.seg}: "${p.text}" ${p.visibility} ${p.opacity.toFixed(2)}`)).toEqual([]);
    expect(await overlappingPins(page, null), "overlap after the failsafe").toEqual([]);
    await ctx.close();
  });

  for (const [w, h, dpr, screen] of [
    [390, 844, 3],
    [430, 932, 3],
    [820, 1180, 2],
    [1440, 900, 1],
    [1280, 720, 2],
    [844, 390, 3],
    // The CI case on any OS: headless Linux reports a 1280x720 screen behind
    // the emulated phone window (on macOS the emulated screen is the window).
    [390, 844, 3, { width: 1280, height: 720 }],
  ] as const) {
    const on = screen ? ` (phone window on a larger ${screen.width}x${screen.height} screen)` : "";
    test(`one poster only at ${w}x${h} DPR ${dpr}${on}: the film code's own variant`, async ({ browser }) => {
      const ctx = await newContext(browser, {
        viewport: { width: w, height: h },
        deviceScaleFactor: dpr,
        ...(w < 1024 ? { isMobile: true, hasTouch: true } : {}),
        ...(screen ? { screen } : {}),
      });
      // Before the landing, in the same context: does the preload scanner
      // see the window, or a wider screen?
      const scanner = await scannerView(ctx, w);
      const page = await ctx.newPage();
      const posters: string[] = [];
      page.on("request", (r) => {
        const name = posterName(r.url());
        if (name) posters.push(name);
      });
      await page.goto("/");
      await expect(page.locator("[data-film-reel]")).toHaveAttribute("data-film-armed", "");
      // The film code loads every film's poster for its own pick.
      await expect.poll(() => posters.filter((p) => p.startsWith("palace-01")).length, { timeout: 15_000 }).toBeGreaterThan(0);
      await page.waitForTimeout(500);
      const env = await page.evaluate((q) => ({ portrait: matchMedia(q).matches, w: innerWidth, dpr: devicePixelRatio }), PORTRAIT_QUERY);
      const want = pickVariant(HERO_FILM, { orientation: env.portrait ? "portrait" : "landscape", backingWidth: viewBackingWidth(env.w, env.dpr) }).name;
      const first = posters.filter((p) => p.startsWith("palace-00"));
      console.log(`${w}x${h} DPR ${dpr}${on}: scanner sees a wider screen: ${scanner.widerScreen}; canary picks ${JSON.stringify(scanner.picks)}; want ${want}; first film posters ${JSON.stringify(first)}`);
      if (!scanner.widerScreen) {
        // The scanner sees the window: the canary's poster replica picks the
        // window's poster only, and the landing fetches exactly that one.
        expect(scanner.picks, "the canary's poster preloads pick the window's poster only").toEqual([want]);
        expect(first, "exactly one poster of the first film").toEqual([want]);
      } else {
        // The scanner sees a larger screen: it may start the poster the pick
        // rule gives for that screen (measured by the canary's replica of the
        // poster preloads) before the document loads the window's. One such
        // speculative poster is tolerated; nothing else changes.
        const speculative = scanner.picks.filter((p) => p !== want);
        const note = `the preload scanner sees a screen wider than the window: one speculative poster tolerated (${speculative.join(", ") || "none: the screen's pick is the window's"})`;
        test.info().annotations.push({ type: "preload scanner", description: note });
        console.log(`${w}x${h} DPR ${dpr}${on}: ${note}`);
        expect(scanner.picks, "the canary's poster preloads include the window's pick").toContain(want);
        expect(speculative.length, "the scanner's screen gives one pick").toBeLessThanOrEqual(1);
        if (screen) {
          // A screen this test set: the canary's speculative pick is the pick
          // rule's for that screen (or none when it is the window's).
          const forScreen = pickVariant(HERO_FILM, { orientation: viewOrientation(screen.width, screen.height), backingWidth: viewBackingWidth(screen.width, dpr) }).name;
          expect(speculative, `the canary's speculative pick is the pick rule's for ${screen.width}x${screen.height}`).toEqual(forScreen === want ? [] : [forScreen]);
        }
        expect(first.filter((p) => p === want), "the film's own variant poster of the first film, once").toEqual([want]);
        const others = first.filter((p) => p !== want);
        expect(others.length, "at most one other poster of the first film").toBeLessThanOrEqual(1);
        expect(others, "the other poster is the scanner's pick for the screen").toEqual(others.length ? speculative : []);
      }
      // The film code picked the same tier for the next film.
      const tier = want.slice("palace-00".length);
      expect(posters.filter((p) => p.startsWith("palace-01"))).toEqual([`palace-01${tier}`]);
      const current = await page.locator("[data-film-poster] img").evaluate((el) => new URL((el as HTMLImageElement).currentSrc).pathname);
      expect(current).toBe(`/films/${want}/poster.webp`);
      await ctx.close();
    });
  }

  test("every film request answered 404 (no film files): static mode, copy follows scroll, requests stop, no probe, no error", async ({ browser }) => {
    test.setTimeout(120_000);
    const ctx = await newContext(browser, DESKTOP);
    const film: number[] = [];
    await ctx.route(/\/films\//, (route) => {
      film.push(Date.now());
      return route.fulfill({ status: 404, contentType: "text/plain", body: "missing" });
    });
    const page = await ctx.newPage();
    const problems = watchProblems(page);
    const t0 = Date.now();
    await page.goto("/");
    await expect(page.locator("[data-film-reel]")).toHaveAttribute("data-film-static", "", { timeout: 20_000 });
    await page.waitForTimeout(Math.max(0, 20_000 - (Date.now() - t0)));
    const total = film.length;
    const late = film.filter((t) => t - t0 > 12_000).length;
    console.log(`404: film requests in 20 s: ${total}; after 12 s: ${late}`);
    // The retry rule's bound: 7 posters (one try each), the first film's pack
    // (1 try + 3 retries), and at most 3 tries for each frame the scheduler
    // wanted before the film was declared unreachable (a desktop window plus
    // the next film's opening: under 49 frames).
    expect(total).toBeLessThanOrEqual(STATIC_BOUND);
    expect(late, "requests stopped").toBe(0);
    expect(await filmStats(page), "every failure was permanent: nothing to probe for").toMatchObject({ probes: 0, recoveries: 0 });
    // The HTML poster failed too: the page colour shows, nothing is stuck hidden.
    await expect(page.locator("[data-film-poster]")).not.toHaveCSS("display", "none");
    await expectCopyFollowsScroll(page);
    // Back online, shown again: nothing transient failed, so nothing is retried.
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await page.waitForTimeout(6000);
    expect(film.length, "scrolling the whole reel in static mode requests nothing").toBe(total);
    expect(problems).toEqual([]);
    await ctx.close();
  });

  test("recovery (a): film requests aborted for the first 6 s after load, then let through: the film appears within 20 s, no reload", async ({ browser }) => {
    test.setTimeout(90_000);
    const ctx = await newContext(browser, DESKTOP);
    let open = false;
    const film: Array<{ t: number; ok: boolean }> = [];
    await ctx.route(/\/films\//, (route) => {
      film.push({ t: Date.now(), ok: open });
      return open ? route.continue() : route.abort();
    });
    await ctx.addInitScript(markStatic);
    const page = await ctx.newPage();
    const problems = watchProblems(page);
    const loads = countLoads(page);
    const t0 = Date.now();
    const opener = setTimeout(() => (open = true), 6000);
    await page.goto("/?hud=1");
    const appeared = await waitForFilm(page, t0 + 20_000);
    clearTimeout(opener);
    const s = await filmStats(page);
    const staticAt = await page.evaluate(() => (window as unknown as { __staticAt?: number }).__staticAt ?? null);
    console.log(
      `recovery (a): film after ${((appeared - t0) / 1000).toFixed(1)} s; static ${staticAt ? `at ${((staticAt - t0) / 1000).toFixed(1)} s` : "never"}; ` +
        `${film.filter((f) => !f.ok).length} failed + ${film.filter((f) => f.ok).length} passed film requests; recoveries ${s.recoveries}, probes ${s.probes}`,
    );
    expect(appeared - t0, "the film appears within 20 s of load").toBeLessThanOrEqual(20_000);
    expect(film.some((f) => !f.ok), "film requests did fail in the first 6 s").toBe(true);
    expect(s.recoveries, "a recovery signal forgave the drop").toBeGreaterThan(0);
    expect(loads(), "no reload").toBe(1);
    expect(problems).toEqual([]);
    await ctx.close();
  });

  test("recovery (b): offline then online with the context's offline switch: the film appears within 5 s of going online, no reload", async ({ browser }) => {
    test.setTimeout(90_000);
    const ctx = await newContext(browser, DESKTOP);
    // Film requests fail from the start; the offline switch takes over once
    // the page's own code has loaded (the dev server serves it over the
    // same network).
    let open = false;
    await ctx.route(/\/films\//, (route) => (open ? route.continue() : route.abort("internetdisconnected")));
    await ctx.addInitScript(markStatic);
    const page = await ctx.newPage();
    const problems = watchProblems(page);
    const loads = countLoads(page);
    const t0 = Date.now();
    await page.goto("/?hud=1");
    await expect(page.locator("[data-film-reel]")).toHaveAttribute("data-film-armed", "");
    await ctx.setOffline(true);
    await page.waitForTimeout(Math.max(0, 6000 - (Date.now() - t0)));
    const before = await filmStats(page);
    expect(before.exactDraws + before.fallbackDraws, "nothing drawn while offline").toBe(0);
    open = true;
    await ctx.setOffline(false);
    const tOnline = Date.now();
    const appeared = await waitForFilm(page, tOnline + 5_000);
    const s = await filmStats(page);
    const staticAt = await page.evaluate(() => (window as unknown as { __staticAt?: number }).__staticAt ?? null);
    console.log(
      `recovery (b): offline ${((tOnline - t0) / 1000).toFixed(1)} s after load; film ${((appeared - tOnline) / 1000).toFixed(1)} s after online; ` +
        `static ${staticAt ? `at ${((staticAt - t0) / 1000).toFixed(1)} s` : "never"}; recoveries ${s.recoveries}, probes ${s.probes}`,
    );
    expect(appeared - tOnline, "the film appears within 5 s of going online").toBeLessThanOrEqual(5_000);
    expect(loads(), "no reload").toBe(1);
    expect(problems).toEqual([]);
    await ctx.close();
  });

  test("recovery (c): every film request aborted for 70 s: static mode, bounded requests, nothing but probes after the halt", async ({ browser }) => {
    test.setTimeout(180_000);
    const ctx = await newContext(browser, DESKTOP);
    const film: Array<{ t: number; path: string }> = [];
    await ctx.route(/\/films\//, (route) => {
      film.push({ t: Date.now(), path: new URL(route.request().url()).pathname });
      return route.abort();
    });
    await ctx.addInitScript(markStatic);
    const page = await ctx.newPage();
    const problems = watchProblems(page);
    const loads = countLoads(page);
    const t0 = Date.now();
    await page.goto("/");
    await expect(page.locator("[data-film-reel]")).toHaveAttribute("data-film-static", "", { timeout: 20_000 });
    await page.waitForTimeout(Math.max(0, 70_000 - (Date.now() - t0)));
    const staticAt = (await page.evaluate(() => (window as unknown as { __staticAt?: number }).__staticAt ?? null))!;
    expect(staticAt).not.toBeNull();
    const s = await filmStats(page);
    const started = await page.evaluate(() => {
      const w = window as unknown as { __staticStarted?: number; __filmStats?: { fetches: number; packRequests: number } };
      return { atHalt: w.__staticStarted ?? -1, now: (w.__filmStats?.fetches ?? 0) + (w.__filmStats?.packRequests ?? 0) };
    });
    // A fetch the page started just before the halt reaches the route a
    // moment after the marker: requests within 500 ms of it are in flight
    // from before (the counters above prove nothing started after).
    const after = film.filter((f) => f.t > staticAt + 500);
    console.log(
      `recovery (c): ${film.length} film requests in 70 s; static at ${((staticAt - t0) / 1000).toFixed(1)} s; ` +
        `intercepted after it: ${film.filter((f) => f.t > staticAt).map((f) => `${((f.t - staticAt) / 1000).toFixed(1)} s ${f.path}`).join(", ")}; ` +
        `probes ${s.probes}; frame fetches + pack requests started: ${started.atHalt} at the halt, ${started.now} now`,
    );
    expect(film.length, "today's bound plus at most 10 probes").toBeLessThanOrEqual(STATIC_BOUND + 10);
    expect(started.now, "no frame fetch or pack request started after the halt").toBe(started.atHalt);
    // After the halt: the probes and nothing else (no request between them).
    expect(after.length).toBe(s.probes);
    expect(after.every((f) => f.path === `/films/${HERO_FILM.landscape.name}/poster.webp`), "only the active film's poster").toBe(true);
    const offsets = after.map((f) => (f.t - staticAt) / 1000);
    expect(offsets.length, "probes 5 s, 15 s and 45 s after the halt").toBe(3);
    for (const [i, want] of [5, 15, 45].entries()) expect(Math.abs(offsets[i]! - want), `probe ${i + 1} at ${want} s`).toBeLessThanOrEqual(1.5);
    await expect(page.locator("[data-film-reel]")).toHaveAttribute("data-film-static", "");
    await expect(page.locator("[data-film-poster]")).not.toHaveCSS("display", "none");
    await expectCopyFollowsScroll(page);
    expect(loads(), "no reload").toBe(1);
    expect(problems).toEqual([]);
    await ctx.close();
  });

  test("no 2D context: static mode from the start, the poster stays, copy follows scroll", async ({ browser }) => {
    test.setTimeout(90_000);
    const ctx = await newContext(browser, DESKTOP);
    await ctx.addInitScript(() => {
      const get = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
        if (type === "2d") return null;
        return (get as (...a: unknown[]) => RenderingContext | null).call(this, type, ...rest);
      } as typeof HTMLCanvasElement.prototype.getContext;
    });
    const film: string[] = [];
    const page = await ctx.newPage();
    page.on("request", (r) => {
      if (/\/films\//.test(r.url())) film.push(new URL(r.url()).pathname);
    });
    const problems: string[] = [];
    page.on("pageerror", (e) => problems.push(`uncaught: ${e.message}`));
    await page.goto("/");
    await expect(page.locator("[data-film-reel]")).toHaveAttribute("data-film-static", "");
    await page.waitForTimeout(3000);
    // Only the HTML poster: no frame, pack or film-code poster is loaded.
    expect(film).toEqual([`/films/${HERO_FILM.landscape.name}/poster.webp`]);
    await expect(page.locator("[data-film-poster]")).not.toHaveCSS("display", "none");
    await expectCopyFollowsScroll(page);
    expect(film.length).toBe(1);
    expect(problems).toEqual([]);
    await ctx.close();
  });
});
